import { Router } from 'express';
import { z } from 'zod';
import { badRequest, notFound, unavailable } from '../lib/errors.js';
import { validate } from '../lib/http.js';
import { playlistInclude, tracksByIds } from '../lib/serializers.js';

const SCOPES = ['online', 'library'];
const ONLINE = ['songs', 'videos', 'albums', 'artists', 'playlists'];
const LIBRARY = ['songs', 'artists', 'albums', 'playlists'];

export function searchRoutes({ prisma, auth, serialize, scraper, events, logger }) {
  const router = Router();
  const q = z.string().trim().min(1).max(200);

  async function library(term, want, limit, userId) {
    const like = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
    const [songIds, artists, albums, playlists] = await Promise.all([
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
    ]);
    const songs = await tracksByIds(prisma, songIds.map((r) => r.id), userId);
    return {
      songs: songs.map(serialize.track),
      artists: artists.map((a) => serialize.artist(a, userId)),
      albums: albums.map(serialize.album),
      playlists: playlists.map((p) => serialize.playlist(p, userId)),
    };
  }

  async function markDownloaded(tracks) {
    const ids = tracks.map((t) => t.videoId);
    const known = ids.length ? await prisma.media.findMany({ where: { status: 'completed', sourceId: { in: ids } }, select: { id: true, sourceId: true } }) : [];
    const bySource = new Map(known.map((m) => [m.sourceId, m.id]));
    return tracks.map((t) => ({ ...t, downloaded: bySource.has(t.videoId), mediaId: bySource.get(t.videoId) ?? null }));
  }

  async function online(term, want, limit) {
    const lists = await Promise.all(
      ONLINE.map((kind) =>
        want(kind) ? scraper.search(term, limit, kind).catch((err) => (logger.warn({ err: err.message, kind }, 'scraper search failed'), [])) : [],
      ),
    );
    const result = Object.fromEntries(ONLINE.map((kind, i) => [kind, lists[i]]));
    const marked = await markDownloaded([...result.songs, ...result.videos]);
    result.songs = marked.slice(0, result.songs.length);
    result.videos = marked.slice(result.songs.length);
    const exactArtist = result.artists.find((a) => a.name.toLowerCase() === term.toLowerCase());
    result.top = exactArtist ?? result.songs[0] ?? result.videos[0] ?? result.albums[0] ?? null;
    return result;
  }

  router.get(
    '/',
    auth.optionalAuth,
    validate({
      query: z.object({
        q,
        scope: z.enum(SCOPES).default('online'),
        type: z.enum(['all', ...ONLINE]).default('all'),
        limit: z.coerce.number().int().min(1).max(50).optional(),
      }),
    }),
    async (req, res) => {
      const { q: term, scope, type } = req.query;
      const userId = req.user?.id;
      const want = (t) => type === 'all' || type === t;
      if (scope === 'library' && type !== 'all' && !LIBRARY.includes(type)) throw badRequest(`Library search has no ${type}`);
      const limit = req.query.limit ?? (type === 'all' ? 6 : 20);
      if (userId) events.ingest(userId, [{ type: 'search', query: term }]).catch(() => {});
      const data = scope === 'online' ? { online: await online(term, want, limit), library: null } : { online: null, library: await library(term, want, limit, userId) };
      res.json({ data });
    },
  );

  router.get('/playlist/:id', auth.optionalAuth, validate({ params: z.object({ id: z.string().regex(/^[\w-]{10,80}$/) }) }), async (req, res) => {
    const item = await scraper.playlist(req.params.id).catch((err) => {
      throw err.status === 404 ? notFound('Playlist') : unavailable('Could not load this playlist from YouTube');
    });
    if (!item) throw notFound('Playlist');
    res.json({ data: { ...item, tracks: await markDownloaded(item.tracks) } });
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
