import crypto from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { signStreamUrl } from '../src/lib/tokens.js';
import { bearer, buildApp, createTrack, createUser, prisma, resetDb } from './helpers.js';

let ctx, user, track;
beforeEach(async () => {
  await resetDb();
  ctx = buildApp();
  user = await createUser();
  track = await createTrack({ title: 'Blinding Lights', metadata: { tags: ['Pop', 'synthwave'] } });
  const artist = await prisma.artist.create({ data: { name: 'The Weeknd', slug: 'the-weeknd' } });
  await prisma.mediaArtist.create({ data: { mediaId: track.id, artistId: artist.id } });
});

describe('stream URLs', () => {
  it('match nginx secure_link: md5(expires + uri + " " + secret) base64url', () => {
    const { url } = signStreamUrl({ baseUrl: 'https://h', prefix: 'stream', key: 'a b.mp3', secret: 's3cret', ttlSec: 60, now: 1_000_000_000_000 });
    const expires = 1_000_000_060;
    const expected = crypto.createHash('md5').update(`${expires}/stream/a%20b.mp3 s3cret`).digest('base64url');
    expect(url).toBe(`https://h/stream/a%20b.mp3?md5=${expected}&expires=${expires}`);
    expect(expected).not.toMatch(/[=+/]/);
  });

  it('are only issued to signed-in users for completed tracks', async () => {
    expect((await ctx.request.post(`/api/v1/media/${track.id}/stream`)).status).toBe(401);
    const res = await ctx.request.post(`/api/v1/media/${track.id}/stream`).set(bearer(ctx.deps, user));
    expect(res.status).toBe(200);
    expect(res.body.data.url).toMatch(/^\/stream\/audio-\d+\.mp3\?md5=/);
    const pending = await createTrack({ status: 'pending' });
    expect((await ctx.request.post(`/api/v1/media/${pending.id}/stream`).set(bearer(ctx.deps, user))).status).toBe(404);
  });
});

describe('tracks and likes', () => {
  it('serialises tracks with artists and like state', async () => {
    await ctx.request.put(`/api/v1/media/${track.id}/like`).set(bearer(ctx.deps, user)).expect(200);
    const res = await ctx.request.get(`/api/v1/media/${track.id}`).set(bearer(ctx.deps, user));
    expect(res.body.data).toMatchObject({ id: track.id, title: 'Blinding Lights', artists: [{ name: 'The Weeknd' }], liked: true, durationSec: 200 });
    await ctx.request.delete(`/api/v1/media/${track.id}/like`).set(bearer(ctx.deps, user)).expect(200);
    const liked = await ctx.request.get('/api/v1/library/liked').set(bearer(ctx.deps, user));
    expect(liked.body.data).toEqual([]);
  });

  it('paginates liked songs with a cursor', async () => {
    for (let i = 0; i < 3; i++) {
      const t = await createTrack();
      await prisma.like.create({ data: { userId: user.id, mediaId: t.id, createdAt: new Date(Date.now() - i * 1000) } });
    }
    const first = await ctx.request.get('/api/v1/library/liked?limit=2').set(bearer(ctx.deps, user));
    expect(first.body.data).toHaveLength(2);
    const second = await ctx.request.get(`/api/v1/library/liked?limit=2&cursor=${first.body.nextCursor}`).set(bearer(ctx.deps, user));
    expect(second.body.data).toHaveLength(1);
    expect(second.body.nextCursor).toBeNull();
  });
});

describe('events', () => {
  it('records plays into history and produces enabled events to Kafka', async () => {
    const events = [
      { type: 'play_start', mediaId: track.id, durationSec: 200 },
      { type: 'play_progress', mediaId: track.id, positionSec: 30 },
      { type: 'play_complete', mediaId: track.id },
    ];
    const res = await ctx.request.post('/api/v1/events').set(bearer(ctx.deps, user)).send({ events });
    expect(res.status).toBe(202);
    const history = await prisma.userHistory.findFirst({ where: { userId: user.id } });
    expect(history).toMatchObject({ playCount: 1, completed: true });
    expect((await prisma.media.findUnique({ where: { id: track.id } })).playCount).toBe(1);
    const sent = ctx.producer.sent[0];
    expect(sent.topic).toBe('openwav.events');
    expect(sent.messages.map((m) => JSON.parse(m.value).type)).toEqual(['play_start', 'play_progress', 'play_complete']);
    expect(sent.messages[0].key).toBe(user.id);
  });

  it('drops disabled event types but still keeps history', async () => {
    await prisma.setting.create({ data: { key: 'events.types', value: ['like'] } });
    await ctx.request.post('/api/v1/events').set(bearer(ctx.deps, user)).send({ events: [{ type: 'play_start', mediaId: track.id }] }).expect(202);
    expect(ctx.producer.sent).toHaveLength(0);
    expect(await prisma.userHistory.count()).toBe(1);
  });

  it('validates event payloads', async () => {
    const res = await ctx.request.post('/api/v1/events').set(bearer(ctx.deps, user)).send({ events: [{ type: 'hack' }] });
    expect(res.status).toBe(400);
  });
});

describe('home, explore and search', () => {
  it('falls back to popular tracks when the recommender is down', async () => {
    ctx = buildApp({ recommender: { forUser: async () => Promise.reject(new Error('down')), similar: async () => [], health: async () => ({}) } });
    const res = await ctx.request.get('/api/v1/home').set(bearer(ctx.deps, user));
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ id: 'quick_picks', subtitle: 'Popular right now' });
    expect(res.body.data[0].items[0].id).toBe(track.id);
  });

  it('uses recommender order when available', async () => {
    const second = await createTrack();
    ctx = buildApp({ recommender: { forUser: async () => [second.id, track.id], similar: async () => [], health: async () => ({}) } });
    const res = await ctx.request.get('/api/v1/home').set(bearer(ctx.deps, user));
    expect(res.body.data[0].items.map((t) => t.id)).toEqual([second.id, track.id]);
  });

  it('finds mood tracks by tag case-insensitively', async () => {
    const res = await ctx.request.get('/api/v1/explore/moods/Commute');
    expect(res.body.data.map((t) => t.id)).toEqual([track.id]);
  });

  it('searches YouTube Music by default across every type and marks songs already in the library', async () => {
    const calls = [];
    ctx = buildApp({
      scraper: {
        search: async (q, limit, kind) => {
          calls.push([kind, limit]);
          if (kind === 'songs') return [
            { type: 'song', videoId: track.sourceId, url: track.url, title: 'Blinding Lights', channel: 'The Weeknd', thumbnailUrl: null, durationSec: 200 },
            { type: 'song', videoId: 'fresh', url: 'https://www.youtube.com/watch?v=fresh', title: 'New', channel: 'X', thumbnailUrl: null, durationSec: null },
          ];
          if (kind === 'artists') return [{ type: 'artist', browseId: 'UC1', name: 'The Weeknd', thumbnailUrl: 'https://img', url: 'https://music.youtube.com/channel/UC1' }];
          return [];
        },
        suggestions: async () => ['blinding lights remix'],
        health: async () => ({}),
      },
    });
    const res = await ctx.request.get('/api/v1/search?q=the weeknd').set(bearer(ctx.deps, user));
    expect(res.body.data.library).toBeNull();
    expect(calls.map((c) => c[0]).sort()).toEqual(['albums', 'artists', 'playlists', 'songs', 'videos']);
    expect(res.body.data.online.top).toMatchObject({ type: 'artist', name: 'The Weeknd' });
    expect(res.body.data.online.songs.map((y) => [y.videoId, y.downloaded, y.mediaId])).toEqual([
      [track.sourceId, true, track.id],
      ['fresh', false, null],
    ]);

    calls.length = 0;
    await ctx.request.get('/api/v1/search?q=weeknd&type=songs');
    expect(calls).toEqual([['songs', 20]]);

    const lib = await ctx.request.get('/api/v1/search?q=weeknd&scope=library').set(bearer(ctx.deps, user));
    expect(lib.body.data.online).toBeNull();
    expect(lib.body.data.library.songs.map((s) => s.id)).toEqual([track.id]);
    expect((await ctx.request.get('/api/v1/search?q=weeknd&scope=library&type=videos')).status).toBe(400);

    const suggest = await ctx.request.get('/api/v1/search/suggestions?q=blind');
    expect(suggest.body.data).toEqual(['Blinding Lights', 'blinding lights remix']);
  });

  it('keeps working when the scraper fails', async () => {
    ctx = buildApp({ scraper: { search: async () => Promise.reject(new Error('blocked')), suggestions: async () => [], health: async () => ({}) } });
    const res = await ctx.request.get('/api/v1/search?q=blinding');
    expect(res.status).toBe(200);
    expect(res.body.data.online).toMatchObject({ songs: [], videos: [], albums: [], artists: [], playlists: [], top: null });
  });
});
