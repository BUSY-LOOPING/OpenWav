import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

const PROGRESS = /^progress:(\d+)\/(\d+|NA)$/;
const PERCENT = /\[download\]\s+([\d.]+)%/;

export function parseProgress(line) {
  const exact = PROGRESS.exec(line.trim());
  if (exact) {
    const total = Number(exact[2]);
    return Number.isFinite(total) && total > 0 ? Math.min(100, (Number(exact[1]) / total) * 100) : null;
  }
  const pct = PERCENT.exec(line);
  return pct ? Math.min(100, Number(pct[1])) : null;
}

export function parseArtists(raw) {
  const value = raw.artists?.length ? raw.artists.join(', ') : raw.artist || raw.creator || raw.uploader || raw.channel || '';
  return [...new Set(value.replace(/\s*-\s*Topic$/i, '').split(/\s*(?:,|&|\bfeat\.?|\bft\.?|\bx\b)\s*/i).map((a) => a.trim()).filter(Boolean))];
}

export function parseMetadata(raw) {
  const thumbs = (raw.thumbnails ?? []).filter((t) => t.url).sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return {
    sourceId: raw.id ?? null,
    title: raw.track || raw.title || 'Unknown title',
    description: raw.description ?? null,
    duration: raw.duration ? Math.round(raw.duration) : null,
    thumbnailUrl: thumbs[0]?.url ?? raw.thumbnail ?? null,
    platform: /youtube/i.test(raw.extractor_key ?? raw.extractor ?? '') ? 'youtube' : (raw.extractor_key ?? 'unknown').toLowerCase(),
    artists: parseArtists(raw),
    album: raw.album ?? null,
    releaseYear: raw.release_year ?? (raw.upload_date ? Number(raw.upload_date.slice(0, 4)) : null),
    metadata: {
      tags: Array.isArray(raw.tags) ? raw.tags.slice(0, 30) : [],
      categories: raw.categories ?? [],
      uploader: raw.uploader ?? raw.channel ?? null,
      uploadDate: raw.upload_date ?? null,
      webpageUrl: raw.webpage_url ?? null,
    },
  };
}

export function parsePlaylist(raw, fallbackUrl) {
  if (!Array.isArray(raw.entries)) return { title: raw.title ?? null, entries: [{ url: raw.webpage_url ?? fallbackUrl }] };
  return {
    title: raw.title ?? null,
    entries: raw.entries
      .filter((e) => e && (e.url || e.id))
      .map((e) => ({ url: e.url?.startsWith('http') ? e.url : `https://www.youtube.com/watch?v=${e.id}` })),
  };
}

export function baseArgs(env = process.env) {
  return [
    '--js-runtimes',
    env.YTDLP_JS_RUNTIME || 'node',
    ...(env.YTDLP_COOKIES_FILE ? ['--cookies', env.YTDLP_COOKIES_FILE] : []),
  ];
}

export function createYtdlp({ bin = process.env.YTDLP_PATH || 'yt-dlp', spawnFn = spawn, logger, env = process.env, cookies = async () => null, tempDir = tmpdir() } = {}) {
  async function run(args, opts) {
    const content = await cookies().catch((err) => logger?.warn({ err: err.message }, 'cookies unavailable'));
    if (!content) return spawnRun(baseArgs(env), args, opts);
    const file = path.join(tempDir, `cookies-${randomUUID()}.txt`);
    await writeFile(file, content, { mode: 0o600 });
    try {
      return await spawnRun(baseArgs({ ...env, YTDLP_COOKIES_FILE: file }), args, opts);
    } finally {
      await rm(file, { force: true });
    }
  }

  function spawnRun(prefix, args, { onLine, signal } = {}) {
    return new Promise((resolve, reject) => {
      const child = spawnFn(bin, [...prefix, ...args], { stdio: ['ignore', 'pipe', 'pipe'], signal });
      const out = [];
      const err = [];
      readline.createInterface({ input: child.stdout }).on('line', (line) => {
        out.push(line);
        onLine?.(line);
      });
      readline.createInterface({ input: child.stderr }).on('line', (line) => {
        err.push(line);
        logger?.debug({ line }, 'yt-dlp');
      });
      const cancelled = () => Object.assign(new Error('Cancelled'), { cancelled: true });
      child.on('error', (err) => reject(signal?.aborted ? cancelled() : err));
      child.on('close', (code) => {
        if (signal?.aborted) return reject(cancelled());
        if (code === 0) return resolve(out);
        reject(new Error(err.filter((l) => l.startsWith('ERROR')).at(-1) ?? `yt-dlp exited with ${code}`));
      });
    });
  }

  const json = async (args, opts) => JSON.parse((await run(args, opts)).join('\n'));

  return {
    probe: (url, signal) => json(['--no-playlist', '--dump-single-json', '--no-warnings', url], { signal }).then(parseMetadata),
    playlist: (url) => json(['--flat-playlist', '--dump-single-json', '--no-warnings', url]).then((raw) => parsePlaylist(raw, url)),
    async download({ url, dir, name, format, quality, onProgress, signal }) {
      const lines = await run(
        [
          '--no-playlist',
          '--no-warnings',
          '--newline',
          '-x',
          '--audio-format',
          format,
          '--audio-quality',
          quality.replace(/k$/, 'K'),
          '--postprocessor-args',
          'ExtractAudio:-af loudnorm=I=-14:TP=-1.5:LRA=11',
          '--progress-template',
          'download:progress:%(progress.downloaded_bytes)s/%(progress.total_bytes,progress.total_bytes_estimate)s',
          '--print',
          'after_move:filepath',
          '-o',
          `${dir}/${name}.%(ext)s`,
          url,
        ],
        {
          signal,
          onLine: (line) => {
            const pct = parseProgress(line);
            if (pct !== null) onProgress?.(pct);
          },
        },
      );
      const path = lines.filter((l) => l.startsWith(dir)).at(-1);
      if (!path) throw new Error('yt-dlp did not report an output file');
      return path;
    },
  };
}
