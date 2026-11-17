const NOISE = /\b(cover|karaoke|instrumental|remix|8d|sped ?up|slowed|reverb|nightcore|reaction|tribute|bass ?boosted)\b/i;
const SUFFIX = { K: 1e3, M: 1e6, B: 1e9 };

export const normalize = (s = '') =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const tokens = (s) => new Set(normalize(s).split(' ').filter(Boolean));

export function parseCount(value) {
  const m = /^([\d.]+)\s*([KMB])?/i.exec(String(value ?? '').replace(/,/g, ''));
  return m ? Number(m[1]) * (SUFFIX[m[2]?.toUpperCase()] ?? 1) : 0;
}

const who = (item) => (item.artists?.length ? item.artists : [item.channel ?? '']).join(' ');

// YouTube's order is a strong prior; on top of it reward explaining the whole query and popularity,
// and push down covers, remixes and sped-up uploads nobody asked for
export function scoreSong(query, item, index = 0, count = 1) {
  const q = tokens(query);
  if (!q.size) return 0;
  const title = tokens(item.title);
  const artist = tokens(who(item));
  const coverage = [...q].filter((t) => title.has(t) || artist.has(t)).length / q.size;
  const exact = normalize(item.title) === normalize(query) || normalize(`${item.title} ${who(item)}`) === normalize(query) ? 1 : 0;
  const noise = NOISE.test(item.title) && !NOISE.test(query) ? 1 : 0;
  const popularity = Math.min(1, Math.log10(1 + parseCount(item.views)) / 10);
  const prior = 1 - index / Math.max(count, 1);
  return coverage * 3 + exact * 1.5 - noise * 2.5 + popularity + prior + (item.type === 'song' ? 0.3 : 0);
}

export function rankSongs(query, items) {
  const seen = new Set();
  return items
    .map((item, i) => ({ item, score: scoreSong(query, item, i, items.length) }))
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item)
    .filter((item) => {
      const key = `${normalize(item.title)}|${normalize(item.artists?.[0] ?? item.channel)}`;
      return !seen.has(key) && seen.add(key);
    });
}

export function pickTop(query, { songs, videos, albums, artists }) {
  const q = normalize(query);
  const artist = artists.find((a) => normalize(a.name) === q);
  if (artist) return artist;
  const best = rankSongs(query, [...songs, ...videos])[0];
  const album = albums.find((a) => normalize(a.title) === q);
  if (album && (!best || normalize(best.title) !== q)) return album;
  return best ?? albums[0] ?? artists[0] ?? null;
}

// The songs shown beside the top result: the artist's own songs, or the next best matches
export function songsBeside(top, songs, take = 3) {
  if (!top) return [];
  if (top.type === 'artist') {
    const name = normalize(top.name);
    return songs.filter((s) => (s.artists ?? []).some((a) => normalize(a) === name)).slice(0, take);
  }
  return songs.filter((s) => s.videoId !== top.videoId).slice(0, take);
}
