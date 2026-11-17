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

  const items = async (id, user, query = '') => {
    const all = [];
    let cursor = '';
    do {
      const res = await ctx.request.get(`/api/v1/playlists/${id}/items?limit=1${query}${cursor ? `&cursor=${cursor}` : ''}`).set(user ? bearer(ctx.deps, user) : {});
      expect(res.status).toBe(200);
      all.push(...res.body.data);
      cursor = res.body.nextCursor;
    } while (cursor);
    return all;
  };

  it('pages downloaded tracks and pending import entries together in playlist order, pending only for the owner', async () => {
    const { id } = (await create()).body.data;
    await ctx.request.post(`/api/v1/playlists/${id}/tracks`).set(bearer(ctx.deps, owner)).send({ mediaId: a.id }).expect(201);
    const job = await prisma.playlistTask.create({ data: { url: 'https://www.youtube.com/playlist?list=1', requestedBy: owner.id, targetPlaylistId: id, status: 'downloading', totalTracks: 3 } });
    await prisma.downloadTask.createMany({
      data: [
        { url: 'https://www.youtube.com/watch?v=b', title: 'Second', playlistTaskId: job.id, position: 2, status: 'downloading', progress: 40 },
        { url: 'https://www.youtube.com/watch?v=a', title: 'First', playlistTaskId: job.id, position: 1, status: 'completed', progress: 100 },
        { url: 'https://www.youtube.com/watch?v=c', title: 'Third', playlistTaskId: job.id, position: 3, status: 'failed', errorMessage: 'Storage limit reached' },
      ],
    });
    const mine = await items(id, owner, '&sort=position');
    expect(mine.map((i) => [i.position, i.track?.id ?? null, i.pending?.title ?? null, i.pending?.progress ?? null])).toEqual([
      [1, a.id, null, null],
      [2, null, 'Second', 40],
      [3, null, 'Third', 0],
    ]);
    expect(mine[2].pending).toMatchObject({ status: 'failed', reason: 'storage_limit', url: 'https://www.youtube.com/watch?v=c' });
    expect((await items(id, other, '&sort=position')).map((i) => i.track.id)).toEqual([a.id]);
    expect((await items(id, owner, '&pending=true')).map((i) => i.pending.title)).toEqual(['Second', 'Third']);
    expect((await items(id, owner)).map((i) => i.track.id)).toEqual([a.id]);

    const summary = (await ctx.request.get(`/api/v1/playlists/${id}`).set(bearer(ctx.deps, owner))).body.data;
    expect(summary).not.toHaveProperty('tracks');
    expect(summary.import).toMatchObject({ status: 'downloading', running: true, total: 3, done: 1, failed: 1 });
    expect((await ctx.request.get(`/api/v1/playlists/${id}`).set(bearer(ctx.deps, other))).body.data.import).toBeNull();
    await prisma.playlistTask.update({ where: { id: job.id }, data: { status: 'completed' } });
    expect((await ctx.request.get(`/api/v1/playlists/${id}`).set(bearer(ctx.deps, owner))).body.data.import).toMatchObject({ running: false, failed: 1 });
    await prisma.downloadTask.updateMany({ where: { status: { not: 'completed' } }, data: { status: 'completed' } });
    expect((await ctx.request.get(`/api/v1/playlists/${id}`).set(bearer(ctx.deps, owner))).body.data.import).toBeNull();
    expect((await ctx.request.get(`/api/v1/playlists/${id}/items?cursor=junk`)).status).toBe(400);
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
    expect((await items(id, owner, '&sort=position')).map((i) => [i.track.id, i.position])).toEqual([[a.id, 1], [c.id, 2]]);
    expect((await ctx.request.get(`/api/v1/playlists/${id}`).set(bearer(ctx.deps, owner))).body.data).toMatchObject({ trackCount: 2, durationSec: 400 });

    await ctx.request.post(`/api/v1/playlists/${id}/tracks`).set(bearer(ctx.deps, owner)).send({ mediaId: b.id }).expect(201);
    const move = (mediaId, position) => ctx.request.put(`/api/v1/playlists/${id}/tracks/${mediaId}/position`).set(bearer(ctx.deps, owner)).send({ position });
    await move(b.id, 1).expect(204);
    expect((await items(id, owner, '&sort=position')).map((i) => [i.track.id, i.position])).toEqual([[b.id, 1], [a.id, 2], [c.id, 3]]);
    await move(b.id, 3).expect(204);
    expect((await items(id, owner, '&sort=position')).map((i) => [i.track.id, i.position])).toEqual([[a.id, 1], [c.id, 2], [b.id, 3]]);
  });

  it('sorts by most recently added by default, or oldest, or title', async () => {
    const { id } = (await create()).body.data;
    await prisma.media.update({ where: { id: a.id }, data: { title: 'Zebra' } });
    await prisma.media.update({ where: { id: b.id }, data: { title: 'Apple' } });
    await prisma.media.update({ where: { id: c.id }, data: { title: 'Mango' } });
    for (const [i, t] of [a, b, c].entries()) {
      await prisma.playlistTrack.create({ data: { playlistId: id, mediaId: t.id, position: i + 1, addedAt: new Date(Date.UTC(2026, 0, i + 1)) } });
    }
    const ids = async (sort) => (await items(id, owner, sort ? `&sort=${sort}` : '')).map((i) => i.track.id);
    expect(await ids()).toEqual([c.id, b.id, a.id]);
    expect(await ids('oldest')).toEqual([a.id, b.id, c.id]);
    expect(await ids('title')).toEqual([b.id, c.id, a.id]);
    expect(await ids('title_desc')).toEqual([a.id, c.id, b.id]);
    expect((await ctx.request.get(`/api/v1/playlists/${id}/items?sort=bogus`)).status).toBe(400);
    expect((await ctx.request.put(`/api/v1/playlists/${id}/tracks/${b.id}/position`).set(bearer(ctx.deps, other)).send({ position: 1 })).status).toBe(403);
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
