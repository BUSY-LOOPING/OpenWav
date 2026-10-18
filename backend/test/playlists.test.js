import { beforeEach, describe, expect, it } from 'vitest';
import { bearer, buildApp, createTrack, createUser, prisma, resetDb } from './helpers.js';

let ctx, owner, other, a, b, c;
beforeEach(async () => {
  await resetDb();
  ctx = buildApp();
  owner = await createUser();
  other = await createUser();
  [a, b, c] = await Promise.all([createTrack({ duration: 100 }), createTrack({ duration: 200 }), createTrack({ duration: 300 })]);
});

const create = (body = {}) => ctx.request.post('/api/v1/playlists').set(bearer(ctx.deps, owner)).send({ name: 'Mix', ...body });

describe('playlists', () => {
  it('creates private playlists when asked', async () => {
    const res = await create({ isPublic: false });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: 'Mix', isPublic: false, isOwner: true, trackCount: 0 });
    expect((await ctx.request.get(`/api/v1/playlists/${res.body.data.id}`).set(bearer(ctx.deps, other))).status).toBe(404);
    expect((await ctx.request.get(`/api/v1/playlists/${res.body.data.id}`)).status).toBe(404);
  });

  it('shows the running import with every entry to the owner only', async () => {
    const { id } = (await create()).body.data;
    const job = await prisma.playlistTask.create({ data: { url: 'https://www.youtube.com/playlist?list=1', requestedBy: owner.id, targetPlaylistId: id, status: 'downloading', totalTracks: 2 } });
    await prisma.downloadTask.createMany({
      data: [
        { url: 'https://youtu.be/b', title: 'Second', playlistTaskId: job.id, position: 2, status: 'downloading', progress: 40 },
        { url: 'https://youtu.be/a', title: 'First', playlistTaskId: job.id, position: 1, status: 'completed', progress: 100 },
      ],
    });
    const mine = (await ctx.request.get(`/api/v1/playlists/${id}`).set(bearer(ctx.deps, owner))).body.data.import;
    expect(mine).toMatchObject({ status: 'downloading', running: true, url: 'https://www.youtube.com/playlist?list=1', total: 2 });
    expect(mine.tasks.map((t) => [t.position, t.title, t.status, t.progress])).toEqual([
      [1, 'First', 'completed', 100],
      [2, 'Second', 'downloading', 40],
    ]);
    expect((await ctx.request.get(`/api/v1/playlists/${id}`).set(bearer(ctx.deps, other))).body.data.import).toBeNull();
    await prisma.playlistTask.update({ where: { id: job.id }, data: { status: 'completed' } });
    await prisma.downloadTask.updateMany({ where: { title: 'Second' }, data: { status: 'failed', errorMessage: 'Daily download limit reached' } });
    const finished = (await ctx.request.get(`/api/v1/playlists/${id}`).set(bearer(ctx.deps, owner))).body.data.import;
    expect(finished).toMatchObject({ running: false });
    expect(finished.tasks.find((t) => t.title === 'Second')).toMatchObject({ status: 'failed', reason: 'daily_limit' });
    await prisma.downloadTask.updateMany({ where: { title: 'Second' }, data: { status: 'completed' } });
    expect((await ctx.request.get(`/api/v1/playlists/${id}`).set(bearer(ctx.deps, owner))).body.data.import).toBeNull();
  });

  it('serves public playlists without login', async () => {
    const { id } = (await create()).body.data;
    const res = await ctx.request.get(`/api/v1/playlists/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.isOwner).toBe(false);
  });

  it('adds, removes and reorders tracks, keeping positions and totals consistent', async () => {
    const { id } = (await create()).body.data;
    for (const t of [a, b, c]) {
      expect((await ctx.request.post(`/api/v1/playlists/${id}/tracks`).set(bearer(ctx.deps, owner)).send({ mediaId: t.id })).status).toBe(201);
    }
    expect((await ctx.request.delete(`/api/v1/playlists/${id}/tracks/${b.id}`).set(bearer(ctx.deps, owner))).status).toBe(204);
    let pl = (await ctx.request.get(`/api/v1/playlists/${id}`).set(bearer(ctx.deps, owner))).body.data;
    expect(pl.tracks.map((t) => [t.id, t.position])).toEqual([[a.id, 1], [c.id, 2]]);
    expect(pl).toMatchObject({ trackCount: 2, durationSec: 400 });

    await ctx.request.put(`/api/v1/playlists/${id}/order`).set(bearer(ctx.deps, owner)).send({ mediaIds: [c.id, a.id] }).expect(204);
    pl = (await ctx.request.get(`/api/v1/playlists/${id}`).set(bearer(ctx.deps, owner))).body.data;
    expect(pl.tracks.map((t) => t.id)).toEqual([c.id, a.id]);
  });

  it('forbids non-owners from modifying', async () => {
    const { id } = (await create()).body.data;
    const res = await ctx.request.post(`/api/v1/playlists/${id}/tracks`).set(bearer(ctx.deps, other)).send({ mediaId: a.id });
    expect(res.status).toBe(403);
    expect((await ctx.request.delete(`/api/v1/playlists/${id}`).set(bearer(ctx.deps, other))).status).toBe(403);
    expect((await ctx.request.patch(`/api/v1/playlists/${id}`).set(bearer(ctx.deps, other)).send({ name: 'x' })).status).toBe(403);
  });

  it('lets others save public playlists into their library', async () => {
    const { id } = (await create()).body.data;
    await ctx.request.put(`/api/v1/playlists/${id}/save`).set(bearer(ctx.deps, other)).expect(200);
    const lib = await ctx.request.get('/api/v1/library/playlists').set(bearer(ctx.deps, other));
    expect(lib.body.data.map((p) => [p.id, p.saved, p.isOwner])).toEqual([[id, true, false]]);
  });

  it('rejects unknown tracks and bad ids', async () => {
    const { id } = (await create()).body.data;
    expect((await ctx.request.post(`/api/v1/playlists/${id}/tracks`).set(bearer(ctx.deps, owner)).send({ mediaId: owner.id })).status).toBe(404);
    expect((await ctx.request.get('/api/v1/playlists/not-a-uuid')).status).toBe(400);
  });

  it('deletes the playlist for its owner', async () => {
    const { id } = (await create()).body.data;
    await ctx.request.delete(`/api/v1/playlists/${id}`).set(bearer(ctx.deps, owner)).expect(204);
    expect(await prisma.playlist.count()).toBe(0);
  });
});
