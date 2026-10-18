import { chmod, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createYtdlp, parseArtists, parseMetadata, parsePlaylist, parseProgress } from '../src/ytdlp.js';

describe('parsers', () => {
  it.each([
    ['progress:50/200', 25],
    ['progress:10/NA', null],
    ['[download]  45.3% of 3.2MiB', 45.3],
    ['[ExtractAudio] Destination', null],
  ])('parseProgress(%s)', (line, expected) => {
    expect(parseProgress(line)).toBe(expected);
  });

  it('splits artists and strips Topic channels', () => {
    expect(parseArtists({ artist: 'Daft Punk feat. Pharrell & Nile Rodgers' })).toEqual(['Daft Punk', 'Pharrell', 'Nile Rodgers']);
    expect(parseArtists({ uploader: 'Adele - Topic' })).toEqual(['Adele']);
    expect(parseArtists({ artists: ['A', 'B'] })).toEqual(['A', 'B']);
  });

  it('maps yt-dlp metadata and picks the widest thumbnail', () => {
    const meta = parseMetadata({
      id: 'abc',
      title: 'Song (Official Video)',
      track: 'Song',
      duration: 201.4,
      extractor_key: 'Youtube',
      thumbnails: [{ url: 'small', width: 120 }, { url: 'big', width: 1280 }],
      tags: ['pop'],
      upload_date: '20240101',
    });
    expect(meta).toMatchObject({ sourceId: 'abc', title: 'Song', duration: 201, thumbnailUrl: 'big', platform: 'youtube', releaseYear: 2024 });
  });

  it('expands flat playlists to watch URLs', () => {
    expect(parsePlaylist({ title: 'P', entries: [{ id: 'a', title: 'Song A' }, null, { url: 'https://youtu.be/b' }] }, 'x')).toEqual({
      title: 'P',
      entries: [
        { url: 'https://www.youtube.com/watch?v=a', title: 'Song A' },
        { url: 'https://youtu.be/b', title: null },
      ],
    });
  });
});

describe('spawned yt-dlp', () => {
  async function fakeBin(script) {
    const dir = await mkdtemp(path.join(tmpdir(), 'ytdlp-'));
    const bin = path.join(dir, 'yt-dlp');
    await writeFile(bin, `#!/usr/bin/env node\n${script}\n`);
    await chmod(bin, 0o755);
    return { bin, dir };
  }

  it('passes uploaded cookies through a private temp file that is removed afterwards', async () => {
    const { bin, dir } = await fakeBin(`
      const fs = require('node:fs');
      const file = process.argv[process.argv.indexOf('--cookies') + 1];
      fs.writeFileSync(require('node:path').join(__dirname, 'seen.json'), JSON.stringify({ content: fs.readFileSync(file, 'utf8'), mode: fs.statSync(file).mode & 0o777 }));
      console.log(JSON.stringify({ id: 'x', title: 'T' }));
    `);
    const meta = await createYtdlp({ bin, tempDir: dir, cookies: async () => '# Netscape HTTP Cookie File\n' }).probe('u');
    expect(meta.sourceId).toBe('x');
    expect(JSON.parse(await readFile(path.join(dir, 'seen.json'), 'utf8'))).toEqual({ content: '# Netscape HTTP Cookie File\n', mode: 0o600 });
    expect((await readdir(dir)).filter((f) => f.startsWith('cookies-'))).toEqual([]);
  });

  it('streams progress line by line and returns the final file path', async () => {
    const { bin, dir } = await fakeBin(`
      const out = process.argv[process.argv.indexOf('-o') + 1].replace('%(ext)s', 'mp3');
      for (const n of [10, 50, 100]) console.log('progress:' + n + '/100');
      console.log(out);
    `);
    const seen = [];
    const file = await createYtdlp({ bin }).download({ url: 'https://youtu.be/x', dir, name: 'task', format: 'mp3', quality: '192k', onProgress: (p) => seen.push(p) });
    expect(seen).toEqual([10, 50, 100]);
    expect(file).toBe(`${dir}/task.mp3`);
  });

  it.each([
    ['opus', '-c:a libopus -b:a 160k'],
    ['m4a', '-c:a aac -b:a 160k'],
    ['mp3', '-c:a libmp3lame -b:a 160k'],
    ['flac', '-c:a flac'],
  ])('forces a %s encoder so loudnorm never meets stream copy', async (format, codec) => {
    const { bin, dir } = await fakeBin(`
      const args = process.argv;
      require('node:fs').writeFileSync(require('node:path').join(__dirname, 'pp.txt'), args[args.indexOf('--postprocessor-args') + 1]);
      console.log(args[args.indexOf('-o') + 1].replace('%(ext)s', '${format}'));
    `);
    await createYtdlp({ bin }).download({ url: 'u', dir, name: 'task', format, quality: '160k' });
    expect(await readFile(path.join(dir, 'pp.txt'), 'utf8')).toBe(`ExtractAudio:-af loudnorm=I=-14:TP=-1.5:LRA=11 ${codec}`);
  });

  it('passes arguments without a shell', async () => {
    const { bin } = await fakeBin(`console.log(JSON.stringify({ id: process.argv.at(-1), title: 't' }))`);
    const meta = await createYtdlp({ bin }).probe('https://x/$(rm -rf ~);`id`');
    expect(meta.sourceId).toBe('https://x/$(rm -rf ~);`id`');
  });

  it('surfaces the last ERROR line on failure', async () => {
    const { bin } = await fakeBin(`console.error('WARNING: meh'); console.error('ERROR: Video unavailable'); process.exit(1)`);
    await expect(createYtdlp({ bin }).probe('u')).rejects.toThrow('ERROR: Video unavailable');
  });

  it('kills the process when aborted', async () => {
    const { bin, dir } = await fakeBin(`setTimeout(() => {}, 60000)`);
    const controller = new AbortController();
    const pending = createYtdlp({ bin }).download({ url: 'u', dir, name: 'n', format: 'mp3', quality: '192k', signal: controller.signal });
    setTimeout(() => controller.abort(), 100);
    await expect(pending).rejects.toMatchObject({ cancelled: true });
  });
});
