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

  router.get('/playlists', validate({ query: pageQuery }), async (req, res) => {
    const { cursor, limit } = req.query;
    const userId = req.user.id;
    const rows = await prisma.playlist.findMany({
      where: { AND: [{ OR: [{ createdBy: userId }, { saves: { some: { userId } }, isPublic: true }] }, cursorWhere(cursor, 'updatedAt')] },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: playlistInclude(userId),
    });
    const { items, nextCursor } = page(rows, limit, 'updatedAt');
    res.json({ data: items.map((p) => serialize.playlist(p, userId)), nextCursor });
  });

  router.get('/artists', validate({ query: pageQuery }), async (req, res) => {
    const { cursor, limit } = req.query;
    const userId = req.user.id;
    const rows = await prisma.artist.findMany({
      where: { subscribers: { some: { userId } }, ...cursorWhere(cursor, 'name', 'asc') },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      include: { subscribers: { where: { userId } }, _count: { select: { subscribers: true } } },
    });
    const { items, nextCursor } = page(rows, limit, 'name');
    res.json({ data: items.map((a) => serialize.artist(a, userId)), nextCursor });
  });

  router.get('/albums', validate({ query: pageQuery }), async (req, res) => {
    const { cursor, limit } = req.query;
    const rows = await prisma.album.findMany({
      where: { media: { some: { media: { likes: { some: { userId: req.user.id } } } } }, ...cursorWhere(cursor, 'name', 'asc') },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      include: { media: { take: 1, include: { media: { select: { thumbnailPath: true, artists: { include: { artist: true } } } } } } },
    });
    const { items, nextCursor } = page(rows, limit, 'name');
    res.json({ data: items.map(serialize.album), nextCursor });
  });

  return router;
}
