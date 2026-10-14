import http from 'node:http';
import { createPrisma } from '@openwav/db';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { createSchedulerJobs } from '../src/jobs.js';

const prisma = createPrisma(inject('databaseUrl'));
const ago = (min) => new Date(Date.now() - min * 60_000);

const song = (id) => ({ videoId: id, url: `https://www.youtube.com/watch?v=${id}`, title: id });
const scraper = http.createServer((req, res) => {
  const { pathname, searchParams } = new URL(req.url, 'http://x');
  if (pathname === '/artist') return res.end(JSON.stringify({ item: searchParams.get('q') === 'Known' ? { name: 'Known', browseId: 'UC1', thumbnailUrl: 'https://img/known' } : null }));
  if (pathname === '/charts') return res.end(JSON.stringify({ items: [song('c1'), song('shared')] }));
  if (searchParams.get('q') === 'top broken songs') return (res.statusCode = 502), res.end('{}');
  res.end(JSON.stringify({ items: [song(`${searchParams.get('q').replace(/\W/g, '')}`), song('shared'), song('have')] }));
});
beforeAll(() => new Promise((r) => scraper.listen(0, r)));
afterAll(() => scraper.close());

let published, playlists, admin, jobs, clock;
beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE users, settings, download_tasks, playlist_tasks, media, artists CASCADE');
  published = [];
  playlists = [];
  clock = Date.now();
  admin = { calls: [], alterConfigs: async (c) => admin.calls.push(c) };
  jobs = createSchedulerJobs({
    prisma,
    kafkaAdmin: admin,
    scraperUrl: `http://127.0.0.1:${scraper.address().port}`,
    publishDownload: async (j) => published.push(j),
    publishPlaylist: async (j) => playlists.push(j),
    now: () => clock,
  });
});

const setUpdatedAt = (id, date) => prisma.$executeRaw`UPDATE download_tasks SET updated_at = ${date} WHERE id = ${id}::uuid`;

describe('scheduler jobs', () => {
  it('requeues stuck downloads and leaves healthy ones alone', async () => {
    const stuck = await prisma.downloadTask.create({ data: { url: 'https://youtu.be/a', status: 'downloading', format: 'mp3', quality: '192k' } });
    const fresh = await prisma.downloadTask.create({ data: { url: 'https://youtu.be/b', status: 'downloading' } });
    const done = await prisma.downloadTask.create({ data: { url: 'https://youtu.be/c', status: 'completed' } });
    await setUpdatedAt(stuck.id, ago(45));
    await setUpdatedAt(done.id, ago(999));
    expect(await jobs.recoverStale()).toBe(1);
    expect(published).toEqual([expect.objectContaining({ taskId: stuck.id, url: 'https://youtu.be/a', format: 'mp3' })]);
    expect((await prisma.downloadTask.findUnique({ where: { id: stuck.id } })).status).toBe('queued');
    expect((await prisma.downloadTask.findUnique({ where: { id: fresh.id } })).status).toBe('downloading');
  });

  it('prunes old terminal tasks only', async () => {
    const old = await prisma.downloadTask.create({ data: { url: 'https://youtu.be/a', status: 'failed' } });
    const active = await prisma.downloadTask.create({ data: { url: 'https://youtu.be/b', status: 'queued' } });
    await setUpdatedAt(old.id, ago(31 * 1440));
    await setUpdatedAt(active.id, ago(31 * 1440));
    expect(await jobs.pruneTasks()).toBe(1);
    expect(await prisma.downloadTask.count()).toBe(1);
  });

  it('pushes the admin retention setting to the Kafka topic', async () => {
    await prisma.setting.create({ data: { key: 'events.retention_days', value: 7 } });
    expect(await jobs.syncEventRetention()).toBe(7);
    expect(admin.calls[0].resources[0]).toEqual({ type: 2, name: 'openwav.events', configEntries: [{ name: 'retention.ms', value: String(7 * 86_400_000) }] });
  });

  it('removes expired refresh tokens', async () => {
    const user = await prisma.user.create({ data: { username: 'sched', email: 's@t.io', passwordHash: 'x' } });
    await prisma.refreshToken.createMany({
      data: [
        { userId: user.id, tokenHash: 'old', expiresAt: ago(1) },
        { userId: user.id, tokenHash: 'live', expiresAt: new Date(Date.now() + 1e6) },
      ],
    });
    expect(await jobs.pruneTokens()).toBe(1);
  });

  it('fills missing artist images and does not re-check misses for a week', async () => {
    const known = await prisma.artist.create({ data: { name: 'Known', slug: 'known' } });
    const unknown = await prisma.artist.create({ data: { name: 'Nobody', slug: 'nobody' } });
    await prisma.artist.create({ data: { name: 'Has', slug: 'has', imageUrl: 'https://img/has' } });
    expect(await jobs.enrichArtists()).toBe(1);
    expect(await prisma.artist.findUnique({ where: { id: known.id } })).toMatchObject({ imageUrl: 'https://img/known', metadata: { ytBrowseId: 'UC1' } });
    expect((await prisma.artist.findUnique({ where: { id: unknown.id } })).metadata.imageCheckedAt).toBeTruthy();
    expect(await jobs.enrichArtists()).toBe(0);
    clock += 8 * 86_400_000;
    expect(await jobs.enrichArtists()).toBe(0);
    expect(Date.parse((await prisma.artist.findUnique({ where: { id: unknown.id } })).metadata.imageCheckedAt)).toBe(clock);
  });

  it('discovers tracks from every source, skips known ones, and runs only when due or requested', async () => {
    const owner = await prisma.user.create({ data: { username: 'boss', email: 'b@t.io', passwordHash: 'x', role: 'admin' } });
    await prisma.media.create({ data: { title: 'Have', url: 'https://www.youtube.com/watch?v=have', sourceId: 'have', status: 'completed' } });
    await prisma.setting.createMany({
      data: [
        { key: 'discovery.genres', value: ['pop', 'broken'] },
        { key: 'discovery.queries', value: [] },
        { key: 'discovery.playlists', value: ['https://www.youtube.com/playlist?list=PL1'] },
      ],
    });

    expect(await jobs.discover()).toBe(3);
    expect(published.map((j) => j.url).sort()).toEqual(['c1', 'shared', 'toppopsongs'].map((id) => song(id).url).sort());
    expect(published.every((j) => j.userId === owner.id)).toBe(true);
    expect(playlists).toEqual([expect.objectContaining({ url: 'https://www.youtube.com/playlist?list=PL1', userId: owner.id })]);
    const run = (await prisma.setting.findUnique({ where: { key: 'discovery.last_run' } })).value;
    expect(run.sources.find((x) => x.label === 'broken').error).toMatch(/502/);
    expect(run.sources.find((x) => x.label === 'pop')).toMatchObject({ found: 3, queued: 1, skipped: 2 });

    clock += 60_000;
    expect(await jobs.discover()).toBe('idle');
    await prisma.setting.create({ data: { key: 'discovery.run_requested_at', value: new Date(clock).toISOString() } });
    clock += 1000;
    expect(await jobs.discover()).toBe(0);
  });
});
