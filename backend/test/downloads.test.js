import { beforeEach, describe, expect, it } from 'vitest';
import { canonicalUrl } from '../src/services/downloads.js';
import { bearer, buildApp, createTrack, createUser, prisma, resetDb } from './helpers.js';

let ctx, user;
beforeEach(async () => {
  await resetDb();
  ctx = buildApp();
  user = await createUser();
});

const download = (body) => ctx.request.post('/api/v1/downloads').set(bearer(ctx.deps, user)).send(body);

describe('canonicalUrl', () => {
  it.each([
    ['https://youtu.be/abc123', 'https://www.youtube.com/watch?v=abc123', 'abc123'],
    ['https://music.youtube.com/watch?v=abc123&si=x', 'https://www.youtube.com/watch?v=abc123', 'abc123'],
    ['https://soundcloud.com/a/b', 'https://soundcloud.com/a/b', null],
  ])('%s', (input, url, sourceId) => {
    expect(canonicalUrl(input)).toEqual({ url, sourceId });
  });
});

describe('POST /downloads', () => {
  it('queues a job with the full contract payload including the user', async () => {
    const res = await download({ url: 'https://youtu.be/newsong1' });
    expect(res.status).toBe(202);
    expect(ctx.channel.messages).toEqual([
      {
        exchange: 'downloads.exchange',
        routingKey: 'downloads',
        body: { taskId: res.body.data.taskId, url: 'https://www.youtube.com/watch?v=newsong1', format: 'mp3', quality: '192k', userId: user.id, playlistTaskId: null, playlistId: null, position: null },
      },
    ]);
  });

  it('returns the existing track instead of downloading it again', async () => {
    const track = await createTrack({ sourceId: 'dupe1', url: 'https://www.youtube.com/watch?v=dupe1' });
    const res = await download({ url: 'https://music.youtube.com/watch?v=dupe1' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ type: 'track', mediaId: track.id });
    expect(ctx.channel.messages).toHaveLength(0);
  });

  it('routes playlist URLs to the playlist queue', async () => {
    const res = await download({ url: 'https://www.youtube.com/playlist?list=PL123' });
    expect(res.body.data.type).toBe('playlist');
    expect(ctx.channel.messages[0]).toMatchObject({ routingKey: 'playlists', body: { playlistTaskId: res.body.data.playlistTaskId, userId: user.id } });
  });

  it('blocks domains that are not allowed', async () => {
    const res = await download({ url: 'https://evil.example.com/song' });
    expect(res.status).toBe(400);
    expect(await prisma.downloadTask.count()).toBe(0);
  });

  it('marks the task failed and answers 503 when the broker is down', async () => {
    ctx.channel.fail = true;
    const res = await download({ url: 'https://youtu.be/brokerdown' });
    expect(res.status).toBe(503);
    const task = await prisma.downloadTask.findFirst();
    expect(task).toMatchObject({ status: 'failed', errorMessage: 'broker down' });
  });

  it('enforces the per-user daily limit', async () => {
    await prisma.setting.create({ data: { key: 'downloads.max_per_user_per_day', value: 1 } });
    expect((await download({ url: 'https://youtu.be/one' })).status).toBe(202);
    const res = await download({ url: 'https://youtu.be/two' });
    expect(res.status).toBe(429);
  });

  it('lists only the caller’s tasks', async () => {
    await download({ url: 'https://youtu.be/mine' });
    const someoneElse = await createUser();
    await prisma.downloadTask.create({ data: { url: 'https://youtu.be/theirs', requestedBy: someoneElse.id } });
    const res = await ctx.request.get('/api/v1/downloads').set(bearer(ctx.deps, user));
    expect(res.body.data.map((t) => t.url)).toEqual(['https://www.youtube.com/watch?v=mine']);
  });
});

describe('progress tickets', () => {
  it('issues a short-lived ticket bound to the user', async () => {
    const res = await ctx.request.post('/api/v1/tickets').set(bearer(ctx.deps, user)).send({ purpose: 'progress' });
    expect(res.status).toBe(201);
    expect(ctx.deps.tokens.verifyTicket(res.body.data.ticket, 'progress')).toBe(user.id);
    expect(() => ctx.deps.tokens.verifyTicket(res.body.data.ticket, 'other')).toThrow();
  });

  it('rejects the stream without a valid ticket', async () => {
    expect((await ctx.request.get('/api/v1/progress?ticket=nope')).status).toBe(401);
  });

  it('delivers progress only to the task owner', () => {
    const writes = { mine: [], theirs: [] };
    const fakeRes = (bucket) => ({ writeHead() {}, write: (s) => writes[bucket].push(s) });
    const req = { on() {} };
    ctx.deps.progress.attach('user-a', req, fakeRes('mine'));
    ctx.deps.progress.attach('user-b', req, fakeRes('theirs'));
    ctx.deps.progress.dispatch(JSON.stringify({ taskId: 't1', status: 'downloading', progress: 40, userId: 'user-a' }));
    expect(writes.mine.at(-1)).toBe('data: {"taskId":"t1","status":"downloading","progress":40}\n\n');
    expect(writes.theirs.some((w) => w.includes('t1'))).toBe(false);
  });
});
