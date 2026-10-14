import { Router } from 'express';
import { cursorWhere, page, pageQuery, validate } from '../lib/http.js';
import { playlistInclude, trackInclude } from '../lib/serializers.js';

export function libraryRoutes({ prisma, auth, serialize }) {
  const router = Router();
  router.use(auth.authenticate);

  router.get('/liked', validate({ query: pageQuery }), async (req, res) => {
    const { cursor, limit } = req.query;
    const userId = req.user.id;
    const rows = await prisma.like.findMany({
      where: { userId, media: { status: 'completed' }, ...cursorWhere(cursor) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: { media: { include: trackInclude(userId) } },
    });
    const { items, nextCursor } = page(rows, limit);
    res.json({ data: items.map((l) => serialize.track(l.media)), nextCursor });
  });

  router.get('/history', validate({ query: pageQuery }), async (req, res) => {
    const { cursor, limit } = req.query;
    const userId = req.user.id;
    const rows = await prisma.userHistory.findMany({
      where: { userId, media: { status: 'completed' }, ...cursorWhere(cursor, 'playedAt') },
      orderBy: [{ playedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: { media: { include: trackInclude(userId) } },
    });
    const { items, nextCursor } = page(rows, limit, 'playedAt');
    res.json({ data: items.map((h) => ({ ...serialize.track(h.media), playedAt: h.playedAt })), nextCursor });
  });

  router.get('/playlists', async (req, res) => {
    const userId = req.user.id;
    const [owned, saved] = await Promise.all([
      prisma.playlist.findMany({ where: { createdBy: userId }, orderBy: { updatedAt: 'desc' }, include: playlistInclude(userId) }),
      prisma.playlist.findMany({ where: { saves: { some: { userId } }, OR: [{ isPublic: true }, { createdBy: userId }] }, orderBy: { updatedAt: 'desc' }, include: playlistInclude(userId) }),
    ]);
    res.json({ data: [...owned, ...saved.filter((p) => p.createdBy !== userId)].map((p) => serialize.playlist(p, userId)) });
  });

  router.get('/artists', async (req, res) => {
    const userId = req.user.id;
    const artists = await prisma.artist.findMany({
      where: { subscribers: { some: { userId } } },
      orderBy: { name: 'asc' },
      include: { subscribers: { where: { userId } }, _count: { select: { subscribers: true } } },
    });
    res.json({ data: artists.map((a) => serialize.artist(a, userId)) });
  });

  router.get('/albums', async (req, res) => {
    const albums = await prisma.album.findMany({
      where: { media: { some: { media: { likes: { some: { userId: req.user.id } } } } } },
      orderBy: { name: 'asc' },
      include: { media: { take: 1, include: { media: { select: { thumbnailPath: true, artists: { include: { artist: true } } } } } } },
    });
    res.json({ data: albums.map(serialize.album) });
  });

  return router;
}
