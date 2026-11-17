import { Router } from 'express';
import { z } from 'zod';
import { DAILY_LIMIT_MESSAGE, PLAYLIST_TASK_STATUS, STORAGE_LIMIT_MESSAGE, TASK_STATUS, isPlaylistUrl } from '@openwav/shared';
import { badRequest, notFound } from '../lib/errors.js';
import { decodeCursor, page, pageQuery, uuidParam, validate } from '../lib/http.js';
import { playlistInclude, trackInclude } from '../lib/serializers.js';

const fields = {
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(5000).nullable(),
  isPublic: z.boolean(),
};

export function playlistRoutes({ prisma, auth, serialize, playlists, downloads, limits }) {
  const router = Router();
  const idParams = validate({ params: uuidParam });

  const REASONS = { [DAILY_LIMIT_MESSAGE]: 'daily_limit', [STORAGE_LIMIT_MESSAGE]: 'storage_limit' };
  const RUNNING = [PLAYLIST_TASK_STATUS.queued, PLAYLIST_TASK_STATUS.resolving, PLAYLIST_TASK_STATUS.downloading];

  async function visible(id, userId) {
    const p = await prisma.playlist.findUnique({ where: { id }, include: playlistInclude(userId) });
    if (!p || (!p.isPublic && p.createdBy !== userId)) throw notFound('Playlist');
    return p;
  }

  const latestImport = (p, userId) =>
    p.createdBy === userId ? prisma.playlistTask.findFirst({ where: { targetPlaylistId: p.id }, orderBy: { createdAt: 'desc' } }) : null;

  async function full(id, userId) {
    const p = await visible(id, userId);
    const job = await latestImport(p, userId);
    const counts = job ? await prisma.downloadTask.groupBy({ by: ['status'], where: { playlistTaskId: job.id }, _count: true }) : [];
    const count = (...statuses) => counts.filter((c) => statuses.includes(c.status)).reduce((n, c) => n + c._count, 0);
    const running = !!job && RUNNING.includes(job.status);
    const failed = count(TASK_STATUS.failed, TASK_STATUS.cancelled);
    return {
      ...serialize.playlist(p, userId),
      import:
        running || failed
          ? { status: job.status, running, url: job.url, total: job.totalTracks, done: count(TASK_STATUS.completed), failed }
          : null,
    };
  }

  router.post('/', auth.authenticate, validate({ body: z.object({ name: fields.name, description: fields.description.optional(), isPublic: fields.isPublic.optional() }) }), async (req, res) => {
    const p = await playlists.createOwned(req.user.id, req.body);
    res.status(201).json({ data: await full(p.id, req.user.id) });
  });

  router.post('/import', auth.authenticate, limits.downloads, validate({ body: z.object({ url: z.string().url().max(1000), name: fields.name.optional(), isPublic: fields.isPublic.optional() }) }), async (req, res) => {
    const list = new URL(req.body.url).searchParams.get('list');
    const url = list ? `https://www.youtube.com/playlist?list=${encodeURIComponent(list)}` : req.body.url;
    if (!isPlaylistUrl(url)) throw badRequest('URL is not a playlist');
    const result = await downloads.create({ url, userId: req.user.id, name: req.body.name ?? 'Imported playlist', isPublic: req.body.isPublic ?? true });
    res.status(202).json({ data: { playlistId: result.playlistId, playlistTaskId: result.playlistTaskId } });
  });

  router.get('/:id', auth.optionalAuth, idParams, async (req, res) => {
    res.json({ data: await full(req.params.id, req.user?.id) });
  });

  router.get('/:id/items', auth.optionalAuth, idParams, validate({ query: pageQuery }), async (req, res) => {
    const userId = req.user?.id;
    const { cursor, limit } = req.query;
    const p = await visible(req.params.id, userId);
    const job = await latestImport(p, userId);
    const after = cursor ? decodeCursor(cursor) : null;
    const afterWhere = after ? { OR: [{ position: { gt: after.value } }, { position: after.value, id: { gt: after.id } }] } : {};
    const order = [{ position: 'asc' }, { id: 'asc' }];
    const [tracks, tasks] = await Promise.all([
      prisma.playlistTrack.findMany({ where: { playlistId: p.id, media: { status: 'completed' }, ...afterWhere }, orderBy: order, take: limit + 1, include: { media: { include: trackInclude(userId) } } }),
      job
        ? prisma.downloadTask.findMany({
            where: { playlistTaskId: job.id, status: { not: TASK_STATUS.completed }, position: { not: null }, ...afterWhere },
            orderBy: order,
            take: limit + 1,
            select: { id: true, url: true, title: true, status: true, progress: true, position: true, errorMessage: true },
          })
        : [],
    ]);
    // Downloaded tracks and still-pending import entries share one position-ordered list
    const merged = [
      ...tracks.map((t) => ({ id: t.id, position: t.position, track: { ...serialize.track(t.media), position: t.position, addedAt: t.addedAt }, pending: null })),
      ...tasks.map(({ errorMessage, ...t }) => ({ id: t.id, position: t.position, track: null, pending: { ...t, reason: REASONS[errorMessage] ?? null } })),
    ].sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : 1));
    const { items, nextCursor } = page(merged, limit, 'position');
    res.json({ data: items, nextCursor });
  });

  router.patch('/:id', auth.authenticate, idParams, validate({ body: z.object({ name: fields.name.optional(), description: fields.description.optional(), isPublic: fields.isPublic.optional() }) }), async (req, res) => {
    await playlists.owned(req.params.id, req.user.id);
    await prisma.playlist.update({ where: { id: req.params.id }, data: req.body });
    res.json({ data: await full(req.params.id, req.user.id) });
  });

  router.delete('/:id', auth.authenticate, idParams, async (req, res) => {
    await playlists.owned(req.params.id, req.user.id);
    await prisma.playlist.delete({ where: { id: req.params.id } });
    res.status(204).end();
  });

  router.post('/:id/tracks', auth.authenticate, idParams, validate({ body: z.object({ mediaId: z.string().uuid() }) }), async (req, res) => {
    await playlists.addTrack(req.params.id, req.body.mediaId, req.user.id);
    res.status(201).end();
  });

  router.delete('/:id/tracks/:mediaId', auth.authenticate, validate({ params: z.object({ id: z.string().uuid(), mediaId: z.string().uuid() }) }), async (req, res) => {
    await playlists.removeTrack(req.params.id, req.params.mediaId, req.user.id);
    res.status(204).end();
  });

  router.put(
    '/:id/tracks/:mediaId/position',
    auth.authenticate,
    validate({ params: z.object({ id: z.string().uuid(), mediaId: z.string().uuid() }), body: z.object({ position: z.number().int().min(1) }) }),
    async (req, res) => {
      await playlists.move(req.params.id, req.params.mediaId, req.body.position, req.user.id);
      res.status(204).end();
    },
  );

  router.put('/:id/save', auth.authenticate, idParams, async (req, res) => {
    const p = await prisma.playlist.findUnique({ where: { id: req.params.id }, select: { isPublic: true, createdBy: true } });
    if (!p || (!p.isPublic && p.createdBy !== req.user.id)) throw notFound('Playlist');
    await prisma.playlistSave.upsert({
      where: { userId_playlistId: { userId: req.user.id, playlistId: req.params.id } },
      create: { userId: req.user.id, playlistId: req.params.id },
      update: {},
    });
    res.json({ data: { saved: true } });
  });

  router.delete('/:id/save', auth.authenticate, idParams, async (req, res) => {
    await prisma.playlistSave.deleteMany({ where: { userId: req.user.id, playlistId: req.params.id } });
    res.json({ data: { saved: false } });
  });

  return router;
}
