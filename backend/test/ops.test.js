import { beforeEach, describe, expect, it } from 'vitest';
import { bearer, buildApp, createTrack, createUser, prisma, resetDb } from './helpers.js';

let ctx, admin, user;
beforeEach(async () => {
  await resetDb();
  await prisma.$executeRawUnsafe('TRUNCATE audit_logs, play_events, search_misses, refresh_tokens CASCADE');
  ctx = buildApp();
  admin = await createUser({ role: 'admin' });
  user = await createUser();
});

const as = (who) => bearer(ctx.deps, who);
const deadMessage = (body, routingKey = 'downloads') => ({ content: Buffer.from(JSON.stringify(body)), properties: { headers: { 'x-death': [{ queue: routingKey, reason: 'rejected', count: 2, 'routing-keys': [routingKey] }] } } });

describe('audit log', () => {
  it('records admin changes with the actor and pages newest first', async () => {
    await ctx.request.patch(`/api/v1/admin/users/${user.id}`).set(as(admin)).send({ isActive: false }).expect(200);
    await ctx.request.patch('/api/v1/admin/settings').set(as(admin)).send({ 'downloads.concurrency': 5 }).expect(200);
    const first = (await ctx.request.get('/api/v1/admin/audit?limit=1').set(as(admin)).expect(200)).body;
    expect(first.data[0]).toMatchObject({ action: 'settings.update', actor: admin.username, details: { 'downloads.concurrency': 5 } });
    const second = (await ctx.request.get(`/api/v1/admin/audit?limit=1&cursor=${first.nextCursor}`).set(as(admin))).body;
    expect(second.data[0]).toMatchObject({ action: 'user.update', targetType: 'user', targetId: user.id, details: { isActive: false } });
    expect((await ctx.request.get('/api/v1/admin/audit?action=user').set(as(admin))).body.data).toHaveLength(1);
    expect((await ctx.request.get('/api/v1/admin/audit').set(as(user))).status).toBe(403);
  });

  it('pushes scraper settings to Redis for the scraper to pick up', async () => {
    await ctx.request.patch('/api/v1/admin/settings').set(as(admin)).send({ 'scraper.timeout_sec': 12 }).expect(200);
    expect(JSON.parse(await ctx.redis.get('scraper:config'))).toMatchObject({ timeoutSec: 12, cacheTtlSec: 21600, maxConcurrency: 4, retries: 2 });
  });
});

describe('sessions', () => {
  it('keeps one session per device across refreshes and lets user and admin sign it out', async () => {
    const login = () => ctx.request.post('/api/v1/auth/login').set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit Safari/604.1').send({ email: user.email, password: 'secret123' });
    const phone = (await login().expect(200)).body.data.tokens;
    await ctx.request.post('/api/v1/auth/login').set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537').send({ email: user.email, password: 'secret123' }).expect(200);
    const refreshed = (await ctx.request.post('/api/v1/auth/refresh').send({ refreshToken: phone.refreshToken }).expect(200)).body.data.tokens;

    const mine = (await ctx.request.get('/api/v1/auth/sessions').set({ Authorization: `Bearer ${refreshed.accessToken}` }).expect(200)).body.data;
    expect(mine.map((s) => [s.device, s.current]).sort()).toEqual([
      ['Chrome on Windows', false],
      ['Safari on iOS', true],
    ]);
    const windows = mine.find((s) => !s.current);
    await ctx.request.delete(`/api/v1/auth/sessions/${windows.id}`).set({ Authorization: `Bearer ${refreshed.accessToken}` }).expect(204);
    expect((await ctx.request.get(`/api/v1/admin/users/${user.id}/sessions`).set(as(admin))).body.data.map((s) => s.device)).toEqual(['Safari on iOS']);

    await ctx.request.delete(`/api/v1/admin/users/${user.id}/sessions`).set(as(admin)).expect(204);
    expect((await ctx.request.post('/api/v1/auth/refresh').send({ refreshToken: refreshed.refreshToken })).status).toBe(401);
    expect((await prisma.auditLog.findFirst({ where: { action: 'session.revoke_all' } })).targetId).toBe(user.id);
  });
});

describe('per-user permissions', () => {
  const download = (url) => ctx.request.post('/api/v1/downloads').set(as(user)).send({ url });

  it('blocks downloads, overrides the daily limit and caps quality', async () => {
    await prisma.user.update({ where: { id: user.id }, data: { canDownload: false } });
    expect((await download('https://youtu.be/blocked')).status).toBe(403);
    expect((await ctx.request.post('/api/v1/playlists/import').set(as(user)).send({ url: 'https://www.youtube.com/playlist?list=PLz' })).status).toBe(403);

    await ctx.request.patch(`/api/v1/admin/users/${user.id}`).set(as(admin)).send({ canDownload: true, dailyDownloadLimit: 1, maxQuality: '128k' }).expect(200);
    const res = await ctx.request.post('/api/v1/downloads').set(as(user)).send({ url: 'https://youtu.be/capped', quality: '320k' }).expect(202);
    expect(ctx.channel.messages.at(-1).body).toMatchObject({ taskId: res.body.data.taskId, quality: '128k' });
    expect((await download('https://youtu.be/second')).status).toBe(429);
    const listed = (await ctx.request.get('/api/v1/admin/users').set(as(admin))).body.data.find((u) => u.id === user.id);
    expect(listed.permissions).toEqual({ canDownload: true, dailyDownloadLimit: 1, maxQuality: '128k' });
  });
});

describe('jobs and queues', () => {
  it('reports queue depth, pauses downloads, peeks and replays dead letters', async () => {
    const task = await prisma.downloadTask.create({ data: { url: 'https://www.youtube.com/watch?v=dead1', title: 'Dead one', status: 'failed', errorMessage: 'boom', retryCount: 3 } });
    ctx.channel.dead.push(deadMessage({ taskId: task.id, url: task.url }), deadMessage({ playlistTaskId: task.id, url: 'https://www.youtube.com/playlist?list=1' }, 'playlists'));

    const queues = (await ctx.request.get('/api/v1/admin/queues').set(as(admin)).expect(200)).body.data;
    expect(queues.queues.find((q) => q.name === 'downloads.dead').messages).toBe(2);
    expect(queues.paused).toBe(false);

    const peek = (await ctx.request.get('/api/v1/admin/queues/dead').set(as(admin)).expect(200)).body.data;
    expect(peek[0]).toMatchObject({ queue: 'downloads', deaths: 2, title: 'Dead one', error: 'boom' });
    expect(ctx.channel.dead).toHaveLength(2);

    await ctx.request.put('/api/v1/admin/queues/paused').set(as(admin)).send({ paused: true }).expect(200);
    expect((await ctx.request.get('/api/v1/admin/queues').set(as(admin))).body.data.paused).toBe(true);

    expect((await ctx.request.post('/api/v1/admin/queues/dead/replay').set(as(admin)).expect(200)).body.data).toEqual({ replayed: 2 });
    expect(ctx.channel.messages.map((m) => m.routingKey)).toEqual(['downloads', 'playlists']);
    expect(await prisma.downloadTask.findUnique({ where: { id: task.id } })).toMatchObject({ status: 'queued', retryCount: 0, errorMessage: null });

    ctx.channel.dead.push(deadMessage({ taskId: task.id }));
    expect((await ctx.request.delete('/api/v1/admin/queues/dead').set(as(admin)).expect(200)).body.data).toEqual({ purged: 1 });
    expect((await prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' } })).map((a) => a.action)).toEqual(['queue.pause', 'queue.dead_replay', 'queue.dead_purge']);
  });
});

describe('yt-dlp health', () => {
  it('combines the worker status with recent download outcomes and requests updates', async () => {
    await ctx.redis.set('ytdlp:status', JSON.stringify({ version: '2025.01.01', latest: '2025.02.01' }));
    await prisma.downloadTask.createMany({
      data: [
        { url: 'https://youtu.be/1', status: 'completed', startedAt: new Date(), completedAt: new Date() },
        { url: 'https://youtu.be/2', status: 'failed', startedAt: new Date(), errorMessage: 'Sign in to confirm you are not a bot' },
        { url: 'https://youtu.be/3', status: 'failed', errorMessage: 'Daily download limit reached' },
      ],
    });
    const data = (await ctx.request.get('/api/v1/admin/ytdlp').set(as(admin)).expect(200)).body.data;
    expect(data.status).toMatchObject({ version: '2025.01.01', latest: '2025.02.01' });
    expect(data.last24h).toEqual({ completed: 1, failed: 1, successRate: 0.5 });
    expect(data.topErrors).toEqual([{ message: 'Sign in to confirm you are not a bot', count: 1 }]);
    await ctx.request.post('/api/v1/admin/ytdlp/update').set(as(admin)).expect(202);
    expect(ctx.redis.published).toContainEqual(['ytdlp:update', admin.id]);
  });
});

describe('storage', () => {
  it('previews and removes only old tracks nobody liked, playlisted or played recently', async () => {
    const old = new Date(Date.now() - 400 * 86_400_000);
    const unused = await createTrack({ createdAt: old, fileSize: 1000, thumbnailPath: 'cover.jpg' });
    const liked = await createTrack({ createdAt: old, fileSize: 2000 });
    const played = await createTrack({ createdAt: old, fileSize: 3000 });
    await createTrack({ fileSize: 4000 });
    await prisma.like.create({ data: { userId: user.id, mediaId: liked.id } });
    await prisma.userHistory.create({ data: { userId: user.id, mediaId: played.id } });

    const storage = (await ctx.request.get('/api/v1/admin/storage').set(as(admin)).expect(200)).body.data;
    expect(storage.cleanup.preview).toMatchObject({ days: 180, count: 1, bytes: 1000 });
    expect(storage.library).toEqual({ tracks: 4, bytes: 10_000 });
    expect(storage.largest[0].fileSize).toBe(4000);
    expect(storage.databaseBytes).toBeGreaterThan(0);

    expect((await ctx.request.post('/api/v1/admin/storage/cleanup').set(as(admin)).expect(200)).body.data).toEqual({ removed: 1, bytes: 1000 });
    expect(await prisma.media.findUnique({ where: { id: unused.id } })).toBeNull();
    expect(ctx.external.storage.sent.map((c) => c.input.Key)).toEqual([unused.filePath, 'cover.jpg']);
  });

  it('runs the scheduled cleanup at most once a day and only when enabled', async () => {
    await createTrack({ createdAt: new Date(Date.now() - 400 * 86_400_000) });
    expect(await ctx.deps.cleanup.tick()).toBeNull();
    await prisma.setting.create({ data: { key: 'storage.cleanup_enabled', value: true } });
    ctx.deps.settings.invalidate();
    expect(await ctx.deps.cleanup.tick()).toEqual({ removed: 1, bytes: 0 });
    expect(await ctx.deps.cleanup.tick()).toBeNull();
  });
});

describe('analytics', () => {
  it('counts plays, listeners, top tracks and searches that found nothing', async () => {
    const track = await createTrack();
    await ctx.request.post('/api/v1/events').set(as(user)).send({ events: [{ type: 'play_start', mediaId: track.id }, { type: 'play_start', mediaId: track.id }] }).expect(202);
    await ctx.request.post('/api/v1/events').set(as(admin)).send({ events: [{ type: 'play_start', mediaId: track.id }] }).expect(202);
    await ctx.request.get('/api/v1/search?q=nothing+here&scope=library').set(as(user)).expect(200);
    await ctx.request.get('/api/v1/search?q=Nothing+Here&scope=library').set(as(user)).expect(200);

    const data = (await ctx.request.get('/api/v1/admin/analytics?days=7').set(as(admin)).expect(200)).body.data;
    expect(data.totals).toEqual({ plays: 3, listeners: 2 });
    expect(data.daily).toHaveLength(7);
    expect(data.daily.at(-1)).toMatchObject({ plays: 3, listeners: 2, signups: 2 });
    expect(data.topTracks[0]).toMatchObject({ id: track.id, plays: 3, listeners: 2 });
    expect(data.topUsers[0]).toMatchObject({ username: user.username, plays: 2 });
    expect(data.searchMisses).toEqual([{ term: 'nothing here', count: 2 }]);
  });
});

describe('scraper console', () => {
  it('runs a whitelisted scraper call with the given params and clears its cache', async () => {
    const calls = [];
    ctx = buildApp({
      scraper: {
        ...ctx.external.scraper,
        raw: async (path, params, opts) => (calls.push([path, params, opts]), { status: 200, durationMs: 12, body: { items: [] } }),
        stats: async () => ({ config: { timeoutSec: 8 }, cache: { entries: 3, hits: 5, misses: 1 } }),
        clearCache: async () => ({ cleared: 3 }),
      },
    });
    const run = await ctx.request.post('/api/v1/admin/scraper/run').set(as(admin)).send({ endpoint: 'search', params: { q: 'abba', filter: 'albums' }, fresh: true }).expect(200);
    expect(run.body.data).toEqual({ status: 200, durationMs: 12, body: { items: [] } });
    expect(calls).toEqual([['/search', { q: 'abba', filter: 'albums' }, { fresh: true }]]);
    expect((await ctx.request.post('/api/v1/admin/scraper/run').set(as(admin)).send({ endpoint: '../etc' })).status).toBe(400);
    const status = (await ctx.request.get('/api/v1/admin/scraper').set(as(admin)).expect(200)).body.data;
    expect(status).toMatchObject({ health: 'up', stats: { cache: { hits: 5 } }, settings: { 'scraper.timeout_sec': 8 } });
    expect((await ctx.request.delete('/api/v1/admin/scraper/cache').set(as(admin)).expect(200)).body.data).toEqual({ cleared: 3 });
  });
});
