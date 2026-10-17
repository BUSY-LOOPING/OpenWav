import { Router } from 'express';
import { z } from 'zod';
import { PLAYLIST_TASK_STATUS, isPlaylistUrl } from '@openwav/shared';
import { badRequest, notFound } from '../lib/errors.js';
import { uuidParam, validate } from '../lib/http.js';
import { playlistInclude, trackInclude } from '../lib/serializers.js';

const fields = {
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(5000).nullable(),
  isPublic: z.boolean(),
};

export function playlistRoutes({ prisma, auth, serialize, playlists, downloads, limits }) {
  const router = Router();
  const idParams = validate({ params: uuidParam });

  async function full(id, userId) {
    const p = await prisma.playlist.findUnique({
      where: { id },
      include: { ...playlistInclude(userId), tracks: { orderBy: { position: 'asc' }, include: { media: { include: trackInclude(userId) } } } },
    });
    if (!p || (!p.isPublic && p.createdBy !== userId)) throw notFound('Playlist');
    const job =
      p.createdBy === userId &&
      (await prisma.playlistTask.findFirst({
        where: { targetPlaylistId: id, status: { in: [PLAYLIST_TASK_STATUS.queued, PLAYLIST_TASK_STATUS.resolving, PLAYLIST_TASK_STATUS.downloading] } },
        orderBy: { createdAt: 'desc' },
        include: { tasks: { orderBy: { position: 'asc' }, select: { id: true, title: true, url: true, status: true, progress: true, position: true } } },
      }));
    return {
      ...serialize.playlist(p, userId),
      tracks: p.tracks.filter((t) => t.media.status === 'completed').map((t) => ({ ...serialize.track(t.media), position: t.position, addedAt: t.addedAt })),
      import: job ? { status: job.status, url: job.url, total: job.totalTracks, tasks: job.tasks } : null,
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

  router.put('/:id/order', auth.authenticate, idParams, validate({ body: z.object({ mediaIds: z.array(z.string().uuid()).max(5000) }) }), async (req, res) => {
    await playlists.reorder(req.params.id, req.body.mediaIds, req.user.id);
    res.status(204).end();
  });

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
