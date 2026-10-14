import { beforeEach, describe, expect, it } from 'vitest';
import { bearer, buildApp, createTrack, createUser, prisma, resetDb } from './helpers.js';

let ctx, admin, user;
beforeEach(async () => {
  await resetDb();
  ctx = buildApp();
  admin = await createUser({ role: 'admin' });
  user = await createUser();
});

const as = (who) => bearer(ctx.deps, who);

describe('admin', () => {
  it('is admin only', async () => {
    expect((await ctx.request.get('/api/v1/admin/stats').set(as(user))).status).toBe(403);
    expect((await ctx.request.get('/api/v1/admin/stats')).status).toBe(401);
    expect((await ctx.request.get('/api/v1/admin/stats').set(as(admin))).status).toBe(200);
  });

  it('reports service health and latency percentiles', async () => {
    const res = await ctx.request.get('/api/v1/admin/health').set(as(admin));
    expect(res.body.data.http).toEqual({ p95Ms: 120, p99Ms: 400, errorRate: 0 });
    expect(Object.fromEntries(res.body.data.services.map((s) => [s.name, s.status]))).toMatchObject({ postgres: 'up', redis: 'up', rabbitmq: 'up', kafka: 'up' });
  });

  it('stores only YouTube and Google cookies, never returns them, and can remove them', async () => {
    const line = (domain, name, exp = 1900000000) => [domain, 'TRUE', '/', 'TRUE', String(exp), name, 'secret'].join('\t');
    const content = ['# Netscape HTTP Cookie File', line('.youtube.com', 'SID'), `#HttpOnly_${line('.youtube.com', 'HSID', 1800000000)}`, line('.google.com', 'NID'), line('.bank.com', 'X')].join('\n');
    expect((await ctx.request.put('/api/v1/admin/ytdlp/cookies').set(as(admin)).send({ content: line('.bank.com', 'X') })).status).toBe(400);
    const res = await ctx.request.put('/api/v1/admin/ytdlp/cookies').set(as(admin)).send({ content }).expect(200);
    expect(res.body.data).toMatchObject({ configured: true, entries: 3, domains: ['google.com', 'youtube.com'], expiresAt: new Date(1800000000 * 1000).toISOString() });
    expect(JSON.stringify(res.body)).not.toContain('secret');
    const stored = (await prisma.setting.findUnique({ where: { key: 'ytdlp.cookies' } })).value.content;
    expect(stored).toContain('#HttpOnly_.youtube.com');
    expect(stored).not.toContain('bank.com');
    expect((await ctx.request.get('/api/v1/admin/settings').set(as(admin))).body.data['ytdlp.cookies']).toBeUndefined();
    await ctx.request.delete('/api/v1/admin/ytdlp/cookies').set(as(admin)).expect(204);
    expect((await ctx.request.get('/api/v1/admin/ytdlp/cookies').set(as(admin))).body.data.configured).toBe(false);
  });

  it('exposes ops tool links and auto-discovery runs with live task status', async () => {
    const health = await ctx.request.get('/api/v1/admin/health').set(as(admin));
    expect(health.body.data.links.map((l) => l.name)).toContain('Grafana');

    const run = await ctx.request.post('/api/v1/admin/discovery/run').set(as(admin)).expect(202);
    const task = await prisma.downloadTask.create({ data: { url: 'https://www.youtube.com/watch?v=x', status: 'downloading', progress: 40 } });
    await prisma.setting.create({ data: { key: 'discovery.last_run', value: { startedAt: run.body.data.requestedAt, finishedAt: null, sources: [], taskIds: [task.id], playlistTaskIds: [] } } });
    const res = await ctx.request.get('/api/v1/admin/discovery').set(as(admin)).expect(200);
    expect(res.body.data).toMatchObject({ requestedAt: run.body.data.requestedAt, counts: { downloading: 1 }, settings: { 'discovery.enabled': true } });
    expect(res.body.data.tasks[0]).toMatchObject({ id: task.id, progress: 40 });
    expect((await ctx.request.post('/api/v1/admin/discovery/run').set(as(user))).status).toBe(403);
  });

  it('bans users, revoking their sessions, and refuses self-demotion', async () => {
    await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: 'h1', expiresAt: new Date(Date.now() + 1e6) } });
    await ctx.request.patch(`/api/v1/admin/users/${user.id}`).set(as(admin)).send({ isActive: false }).expect(200);
    expect((await prisma.refreshToken.findFirst()).revokedAt).not.toBeNull();
    expect((await ctx.request.get('/api/v1/auth/me').set(as(user))).status).toBe(403);
    expect((await ctx.request.patch(`/api/v1/admin/users/${admin.id}`).set(as(admin)).send({ role: 'user' })).status).toBe(400);
  });

  it('filters downloads by several statuses and cancels with a worker signal', async () => {
    const queued = await prisma.downloadTask.create({ data: { url: 'https://youtu.be/a', status: 'queued' } });
    await prisma.downloadTask.create({ data: { url: 'https://youtu.be/b', status: 'downloading' } });
    await prisma.downloadTask.create({ data: { url: 'https://youtu.be/c', status: 'completed' } });
    const list = await ctx.request.get('/api/v1/admin/downloads?status=queued,downloading').set(as(admin));
    expect(list.body.data.map((t) => t.status).sort()).toEqual(['downloading', 'queued']);
    const res = await ctx.request.post(`/api/v1/admin/downloads/${queued.id}/cancel`).set(as(admin));
    expect(res.body.data.status).toBe('cancelled');
    expect(ctx.redis.published).toContainEqual(['download:cancel', queued.id]);
  });

  it('retries failed downloads by republishing them', async () => {
    const failed = await prisma.downloadTask.create({ data: { url: 'https://youtu.be/f', status: 'failed', format: 'mp3', quality: '192k', retryCount: 3 } });
    const res = await ctx.request.post(`/api/v1/admin/downloads/bulk`).set(as(admin)).send({ action: 'retry', ids: [failed.id] });
    expect(res.body.data.affected).toBe(1);
    expect(ctx.channel.messages[0].body).toMatchObject({ taskId: failed.id, url: 'https://youtu.be/f' });
    expect(await prisma.downloadTask.findUnique({ where: { id: failed.id } })).toMatchObject({ status: 'queued', retryCount: 0 });
  });

  it('edits track artists and deletes media with its storage objects', async () => {
    const track = await createTrack({ thumbnailPath: 'cover.jpg' });
    const edit = await ctx.request.patch(`/api/v1/admin/media/${track.id}`).set(as(admin)).send({ title: 'Renamed', artistNames: ['A', 'B'] });
    expect(edit.body.data).toMatchObject({ title: 'Renamed', artists: [{ name: 'A' }, { name: 'B' }] });
    await ctx.request.delete(`/api/v1/admin/media/${track.id}`).set(as(admin)).expect(204);
    expect(ctx.external.storage.sent.map((c) => c.input)).toEqual([
      { Bucket: 'audio', Key: track.filePath },
      { Bucket: 'covers', Key: 'cover.jpg' },
    ]);
  });

  it('validates settings keys and types', async () => {
    const current = await ctx.request.get('/api/v1/admin/settings').set(as(admin));
    expect(current.body.data['events.sample_rate']).toBe(1);
    expect((await ctx.request.patch('/api/v1/admin/settings').set(as(admin)).send({ nope: 1 })).status).toBe(400);
    expect((await ctx.request.patch('/api/v1/admin/settings').set(as(admin)).send({ 'events.sample_rate': 'all' })).status).toBe(400);
    const ok = await ctx.request.patch('/api/v1/admin/settings').set(as(admin)).send({ 'events.sample_rate': 0.5, 'alerts.p95_ms': 300 });
    expect(ok.body.data).toMatchObject({ 'events.sample_rate': 0.5, 'alerts.p95_ms': 300 });
  });
});
