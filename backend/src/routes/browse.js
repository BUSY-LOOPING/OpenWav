import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Router } from 'express';
import { z } from 'zod';
import { notFound } from '../lib/errors.js';
import { uuidParam, validate } from '../lib/http.js';
import { playlistInclude, trackInclude, tracksByIds } from '../lib/serializers.js';
import { signStreamUrl } from '../lib/tokens.js';

export const MOODS = {
  Chill: ['chill', 'lofi', 'relax', 'ambient', 'acoustic'],
  Christmas: ['christmas', 'holiday', 'xmas'],
  Commute: ['pop', 'hits', 'indie', 'rock'],
  Energize: ['energy', 'upbeat', 'edm', 'dance'],
  'Feel-good': ['happy', 'feel good', 'summer', 'upbeat'],
  Focus: ['focus', 'study', 'instrumental', 'piano'],
  Gaming: ['gaming', 'game', 'video game', 'synthwave'],
  Halloween: ['halloween', 'spooky', 'horror'],
  Party: ['party', 'dance', 'club', 'house'],
  Romance: ['love', 'romantic', 'romance'],
  Sad: ['sad', 'emotional', 'ballad', 'heartbreak'],
  Sleep: ['sleep', 'calm', 'meditation'],
  Workout: ['workout', 'gym', 'motivation', 'training'],
};

export const GENRES = {
  African: ['african', 'afrobeats', 'amapiano', 'afropop'],
  Arabic: ['arabic', 'khaleeji', 'arab pop'],
  Blues: ['blues'],
  'Bollywood and Desi': ['bollywood', 'desi', 'hindi', 'punjabi', 'filmi'],
  Brazilian: ['brazilian', 'sertanejo', 'funk carioca', 'mpb', 'bossa nova'],
  'Christian & gospel': ['christian', 'gospel', 'worship'],
  Classical: ['classical', 'orchestra', 'opera'],
  'Country and Americana': ['country', 'americana', 'bluegrass'],
  'Dance and electronic': ['edm', 'electronic', 'house', 'techno', 'dance'],
  Family: ['kids', 'children', 'family'],
  'Folk and acoustic': ['folk', 'acoustic', 'singer-songwriter'],
  Francophone: ['french', 'francophone', 'chanson'],
  'Hip-hop': ['hip hop', 'hip-hop', 'rap', 'trap'],
  'Indie and alternative': ['indie', 'alternative', 'alt rock'],
  'J-Pop': ['j-pop', 'jpop', 'japanese', 'anime'],
  Jazz: ['jazz', 'swing', 'bebop'],
  'K-Pop': ['k-pop', 'kpop', 'korean'],
  Latin: ['latin', 'reggaeton', 'salsa', 'bachata'],
  'Mandopop & Cantopop': ['mandopop', 'cantopop', 'c-pop', 'chinese'],
  Metal: ['metal', 'heavy metal', 'metalcore'],
  Pop: ['pop'],
  'R&B and soul': ['r&b', 'rnb', 'soul', 'neo soul'],
  'Reggae and caribbean': ['reggae', 'dancehall', 'soca', 'caribbean'],
  Rock: ['rock', 'hard rock', 'classic rock'],
  'Soundtracks and musicals': ['soundtrack', 'ost', 'musical', 'score'],
};

const MOOD_TAGS = new Map(Object.entries({ ...MOODS, ...GENRES }).map(([label, tags]) => [label.toLowerCase(), tags]));

export function browseRoutes({ prisma, auth, serialize, settings, recommender, lyrics, config, logger }) {
  const router = Router();
  const tracks = (rows) => rows.map(serialize.track);
  const completed = { status: 'completed' };

  const popular = (userId, take = 20, skip = 0) =>
    prisma.media.findMany({ where: completed, orderBy: [{ playCount: 'desc' }, { createdAt: 'desc' }], take, skip, include: trackInclude(userId) });

  async function personalised(userId, limit) {
    if (!(await settings.get('recommender.enabled'))) return [];
    try {
      return await tracksByIds(prisma, await recommender.forUser(userId, limit), userId);
    } catch (err) {
      logger.warn({ err: err.message }, 'recommender unavailable, falling back');
      return [];
    }
  }

  const moodTracks = (mood, userId, take = 50) =>
    prisma.$queryRaw`
      SELECT m.id FROM media m
      WHERE m.status = 'completed' AND EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(coalesce(m.metadata->'tags', '[]'::jsonb)) t WHERE lower(t) = ANY(${MOOD_TAGS.get(mood)})
      )
      ORDER BY m.play_count DESC, m.created_at DESC LIMIT ${take}`.then((rows) => tracksByIds(prisma, rows.map((r) => r.id), userId));

  router.get('/home', auth.authenticate, async (req, res) => {
    const userId = req.user.id;
    const [recs, history, liked, playlists, fresh, topArtists] = await Promise.all([
      personalised(userId, 24),
      prisma.userHistory.findMany({ where: { userId, media: completed }, orderBy: { playedAt: 'desc' }, take: 12, include: { media: { include: trackInclude(userId) } } }),
      prisma.like.findMany({ where: { userId, media: completed }, orderBy: { createdAt: 'desc' }, take: 12, include: { media: { include: trackInclude(userId) } } }),
      prisma.playlist.findMany({ where: { isPublic: true, totalTracks: { gt: 0 }, NOT: { createdBy: userId } }, orderBy: [{ totalTracks: 'desc' }], take: 12, include: playlistInclude(userId) }),
      prisma.media.findMany({ where: completed, orderBy: { createdAt: 'desc' }, take: 12, include: trackInclude(userId) }),
      prisma.$queryRaw`
        SELECT ma.artist_id AS id FROM user_history h JOIN media_artists ma ON ma.media_id = h.media_id
        WHERE h.user_id = ${userId}::uuid GROUP BY ma.artist_id ORDER BY sum(h.play_count) DESC LIMIT 12`,
    ]);
    const quick = recs.length ? recs : await popular(userId, 24);
    const artists = topArtists.length
      ? await prisma.artist.findMany({ where: { id: { in: topArtists.map((a) => a.id) } }, include: { subscribers: { where: { userId } }, _count: { select: { subscribers: true } } } })
      : [];
    const sections = [
      { id: 'quick_picks', title: 'Quick picks', subtitle: recs.length ? 'Start radio from a song' : 'Popular right now', kind: 'quick_picks', items: tracks(quick) },
      { id: 'listen_again', title: 'Listen again', subtitle: req.user.username, kind: 'tracks', items: tracks(history.map((h) => h.media)) },
      { id: 'liked', title: 'From your likes', subtitle: null, kind: 'tracks', items: tracks(liked.map((l) => l.media)) },
      { id: 'artists', title: 'Your favourite artists', subtitle: null, kind: 'artists', items: artists.map((a) => serialize.artist(a, userId)) },
      { id: 'playlists', title: 'Recommended playlists', subtitle: null, kind: 'playlists', items: playlists.map((p) => serialize.playlist(p, userId)) },
      { id: 'new_releases', title: 'New on OpenWav', subtitle: null, kind: 'tracks', items: tracks(fresh) },
    ].filter((s) => s.items.length);
    res.json({ data: sections });
  });

  router.get('/explore', auth.optionalAuth, async (req, res) => {
    const userId = req.user?.id;
    const [newReleases, charts] = await Promise.all([
      prisma.media.findMany({ where: completed, orderBy: { createdAt: 'desc' }, take: 20, include: trackInclude(userId) }),
      popular(userId, 50),
    ]);
    res.json({ data: { newReleases: tracks(newReleases), charts: tracks(charts), moods: Object.keys(MOODS), genres: Object.keys(GENRES) } });
  });

  router.get('/explore/moods/:mood', auth.optionalAuth, validate({ params: z.object({ mood: z.string().toLowerCase().pipe(z.enum([...MOOD_TAGS.keys()])) }) }), async (req, res) => {
    res.json({ data: tracks(await moodTracks(req.params.mood, req.user?.id)) });
  });

  const findTrack = async (id, userId) => {
    const media = await prisma.media.findFirst({ where: { id, ...completed }, include: trackInclude(userId) });
    if (!media) throw notFound('Track');
    return media;
  };

  router.get('/media/:id', auth.optionalAuth, validate({ params: uuidParam }), async (req, res) => {
    res.json({ data: serialize.track(await findTrack(req.params.id, req.user?.id)) });
  });

  router.get('/media/:id/related', auth.optionalAuth, validate({ params: uuidParam }), async (req, res) => {
    const userId = req.user?.id;
    const media = await findTrack(req.params.id, userId);
    let related = [];
    if (await settings.get('recommender.enabled')) {
      related = await recommender.similar(media.id, 25).then((ids) => tracksByIds(prisma, ids, userId)).catch(() => []);
    }
    if (!related.length) {
      const artistIds = media.artists.map((a) => a.artist.id);
      related = await prisma.media.findMany({
        where: { ...completed, id: { not: media.id }, ...(artistIds.length ? { artists: { some: { artistId: { in: artistIds } } } } : {}) },
        orderBy: { playCount: 'desc' },
        take: 25,
        include: trackInclude(userId),
      });
    }
    res.json({ data: tracks(related.filter((t) => t.id !== media.id)) });
  });

  router.get('/media/:id/lyrics', auth.optionalAuth, validate({ params: uuidParam }), async (req, res) => {
    const media = await findTrack(req.params.id);
    res.json({ data: await lyrics.find({ title: media.title, artist: media.artists[0]?.artist.name, durationSec: media.duration }) });
  });

  router.post('/media/:id/stream', auth.authenticate, validate({ params: uuidParam }), async (req, res) => {
    const media = await prisma.media.findFirst({ where: { id: req.params.id, ...completed }, select: { filePath: true } });
    if (!media?.filePath) throw notFound('Track');
    res.json({
      data: signStreamUrl({ baseUrl: '', prefix: 'stream', key: media.filePath, secret: config.STREAM_SIGNING_SECRET, ttlSec: config.STREAM_URL_TTL_SEC }),
    });
  });

  router.put('/media/:id/like', auth.authenticate, validate({ params: uuidParam }), async (req, res) => {
    await findTrack(req.params.id);
    await prisma.like.upsert({ where: { userId_mediaId: { userId: req.user.id, mediaId: req.params.id } }, create: { userId: req.user.id, mediaId: req.params.id }, update: {} });
    res.json({ data: { liked: true } });
  });

  router.delete('/media/:id/like', auth.authenticate, validate({ params: uuidParam }), async (req, res) => {
    await prisma.like.deleteMany({ where: { userId: req.user.id, mediaId: req.params.id } });
    res.json({ data: { liked: false } });
  });

  router.get('/artists/:id', auth.optionalAuth, validate({ params: uuidParam }), async (req, res) => {
    const userId = req.user?.id;
    const artist = await prisma.artist.findUnique({
      where: { id: req.params.id },
      include: { subscribers: userId ? { where: { userId } } : false, _count: { select: { subscribers: true } } },
    });
    if (!artist) throw notFound('Artist');
    const [topTracks, albums] = await Promise.all([
      prisma.media.findMany({ where: { ...completed, artists: { some: { artistId: artist.id } } }, orderBy: [{ playCount: 'desc' }, { createdAt: 'desc' }], take: 20, include: trackInclude(userId) }),
      prisma.album.findMany({
        where: { media: { some: { media: { artists: { some: { artistId: artist.id } } } } } },
        take: 20,
        include: { media: { take: 1, include: { media: { select: { thumbnailPath: true, artists: { include: { artist: true } } } } } } },
      }),
    ]);
    res.json({ data: { ...serialize.artist(artist, userId), topTracks: tracks(topTracks), albums: albums.map(serialize.album) } });
  });

  router.put('/artists/:id/subscription', auth.authenticate, validate({ params: uuidParam }), async (req, res) => {
    if (!(await prisma.artist.findUnique({ where: { id: req.params.id }, select: { id: true } }))) throw notFound('Artist');
    await prisma.artistSubscription.upsert({
      where: { userId_artistId: { userId: req.user.id, artistId: req.params.id } },
      create: { userId: req.user.id, artistId: req.params.id },
      update: {},
    });
    res.json({ data: { subscribed: true } });
  });

  router.delete('/artists/:id/subscription', auth.authenticate, validate({ params: uuidParam }), async (req, res) => {
    await prisma.artistSubscription.deleteMany({ where: { userId: req.user.id, artistId: req.params.id } });
    res.json({ data: { subscribed: false } });
  });

  router.get('/albums/:id', auth.optionalAuth, validate({ params: uuidParam }), async (req, res) => {
    const userId = req.user?.id;
    const album = await prisma.album.findUnique({
      where: { id: req.params.id },
      include: { media: { orderBy: { trackNumber: 'asc' }, include: { media: { include: trackInclude(userId) } } } },
    });
    if (!album) throw notFound('Album');
    res.json({ data: { ...serialize.album(album), tracks: tracks(album.media.map((m) => m.media).filter((m) => m.status === 'completed')) } });
  });

  router.get('/me/preferences', auth.authenticate, async (req, res) => {
    const rows = await prisma.userSetting.findMany({ where: { userId: req.user.id } });
    res.json({ data: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
  });

  router.patch('/me/preferences', auth.authenticate, validate({ body: z.record(z.string().regex(/^[a-z_.]{1,100}$/), z.json()).refine((v) => Object.keys(v).length <= 50) }), async (req, res) => {
    await prisma.$transaction(
      Object.entries(req.body).map(([key, value]) =>
        prisma.userSetting.upsert({ where: { userId_key: { userId: req.user.id, key } }, create: { userId: req.user.id, key, value }, update: { value } }),
      ),
    );
    const rows = await prisma.userSetting.findMany({ where: { userId: req.user.id } });
    res.json({ data: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
  });

  return router;
}

export async function deleteMediaObjects({ storage, config }, media) {
  const keys = [
    media.filePath && { Bucket: config.S3_BUCKET_AUDIO, Key: media.filePath },
    media.thumbnailPath && !/^https?:\/\//.test(media.thumbnailPath) && { Bucket: config.S3_BUCKET_COVERS, Key: media.thumbnailPath },
  ].filter(Boolean);
  await Promise.all(keys.map((k) => storage.send(new DeleteObjectCommand(k))));
}
