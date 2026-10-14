import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../lib/http.js';
import { playlistInclude, tracksByIds } from '../lib/serializers.js';

const TYPES = ['all', 'songs', 'artists', 'albums', 'playlists', 'youtube'];

export function searchRoutes({ prisma, auth, serialize, scraper, events, logger }) {
  const router = Router();
  const q = z.string().trim().min(1).max(200);

  router.get('/', auth.optionalAuth, validate({ query: z.object({ q, type: z.enum(TYPES).default('all'), limit: z.coerce.number().int().min(1).max(50).default(20) }) }), async (req, res) => {
    const { q: term, type, limit } = req.query;
    const userId = req.user?.id;
    const want = (t) => type === 'all' || type === t;
    const like = `%${term.replace(/[\\%_]/g, '\\$&')}%`;

    const [songIds, artists, albums, playlists, youtube] = await Promise.all([
      want('songs')
        ? prisma.$queryRaw`
            SELECT m.id FROM media m
            WHERE m.status = 'completed' AND (m.title ILIKE ${like} OR EXISTS (
              SELECT 1 FROM media_artists ma JOIN artists a ON a.id = ma.artist_id WHERE ma.media_id = m.id AND a.name ILIKE ${like}))
            ORDER BY similarity(m.title, ${term}) DESC, m.play_count DESC LIMIT ${limit}`
        : [],
      want('artists')
        ? prisma.artist.findMany({ where: { name: { contains: term, mode: 'insensitive' } }, take: limit, include: { subscribers: userId ? { where: { userId } } : false, _count: { select: { subscribers: true } } } })
        : [],
      want('albums')
        ? prisma.album.findMany({ where: { name: { contains: term, mode: 'insensitive' } }, take: limit, include: { media: { take: 1, include: { media: { select: { thumbnailPath: true, artists: { include: { artist: true } } } } } } } })
        : [],
      want('playlists')
        ? prisma.playlist.findMany({ where: { isPublic: true, name: { contains: term, mode: 'insensitive' } }, take: limit, include: playlistInclude(userId) })
        : [],
      want('youtube') ? scraper.search(term, Math.min(limit, 20)).catch((err) => (logger.warn({ err: err.message }, 'scraper search failed'), [])) : [],
    ]);

    const songs = await tracksByIds(prisma, songIds.map((r) => r.id), userId);
    const known = youtube.length
      ? await prisma.media.findMany({ where: { status: 'completed', sourceId: { in: youtube.map((y) => y.videoId) } }, select: { id: true, sourceId: true } })
      : [];
    const bySource = new Map(known.map((m) => [m.sourceId, m.id]));
    if (userId) events.ingest(userId, [{ type: 'search', query: term }]).catch(() => {});

    res.json({
      data: {
        songs: songs.map(serialize.track),
        artists: artists.map((a) => serialize.artist(a, userId)),
        albums: albums.map(serialize.album),
        playlists: playlists.map((p) => serialize.playlist(p, userId)),
        youtube: youtube.map((y) => ({
          videoId: y.videoId,
          url: y.url,
          title: y.title,
          channel: y.channel,
          thumbnailUrl: y.thumbnailUrl,
          durationSec: y.durationSec,
          downloaded: bySource.has(y.videoId),
          mediaId: bySource.get(y.videoId) ?? null,
        })),
      },
    });
  });

  router.get('/suggestions', auth.optionalAuth, validate({ query: z.object({ q }) }), async (req, res) => {
    const term = req.query.q;
    const [titles, artistNames, remote] = await Promise.all([
      prisma.media.findMany({ where: { status: 'completed', title: { startsWith: term, mode: 'insensitive' } }, select: { title: true }, take: 5, orderBy: { playCount: 'desc' } }),
      prisma.artist.findMany({ where: { name: { startsWith: term, mode: 'insensitive' } }, select: { name: true }, take: 3 }),
      scraper.suggestions(term).catch(() => []),
    ]);
    const all = [...titles.map((t) => t.title), ...artistNames.map((a) => a.name), ...remote];
    res.json({ data: [...new Map(all.map((s) => [s.toLowerCase(), s])).values()].slice(0, 8) });
  });

  return router;
}
