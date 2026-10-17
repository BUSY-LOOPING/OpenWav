import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createPrisma } from '@openwav/db';
import { createLogger } from '@openwav/shared/logger';
import { beforeEach, describe, expect, inject, it } from 'vitest';
import { createJobs, slugify } from '../src/jobs.js';

const prisma = createPrisma(inject('databaseUrl'));
const logger = createLogger('test');
logger.level = 'silent';

const meta = {
  sourceId: 'vid1',
  title: 'Song',
  description: null,
  duration: 180,
  thumbnailUrl: 'https://i.ytimg.com/x.jpg',
  platform: 'youtube',
  artists: ['Artist One', 'Artist Two'],
  album: 'The Album',
  releaseYear: 2020,
  metadata: { tags: ['pop'] },
};

let ctx;
async function setup(ytdlpOverrides = {}) {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'dl-'));
  const events = [];
  const published = [];
  const retries = [];
  const ytdlp = {
    probe: async () => meta,
    playlist: async () => ({ title: 'YT List', entries: [{ url: 'https://youtu.be/a' }, { url: 'https://youtu.be/b' }] }),
    download: async ({ dir, name, onProgress }) => {
      onProgress(50);
      onProgress(100);
      const file = path.join(dir, `${name}.mp3`);
      await writeFile(file, 'audio');
      return file;
    },
    ...ytdlpOverrides,
  };
  const storage = { uploads: [], uploadAudio: async (_p, key) => (storage.uploads.push(key), 5), uploadCover: async (_u, id) => `${id}.jpg` };
  const jobs = createJobs({
    prisma,
    ytdlp,
    storage,
    tempDir,
    logger,
    emit: (e) => events.push(e),
    publishDownload: async (j) => published.push(j),
    publishRetry: async (j, delay) => retries.push([j, delay]),
  });
  ctx = { jobs, events, published, retries, storage };
  return ctx;
}

const user = () => prisma.user.create({ data: { username: `u${Math.random()}`.slice(0, 20), email: `${Math.random()}@t.io`, passwordHash: 'x' } });
const job = (task, extra = {}) => ({ taskId: task.id, url: task.url, format: 'mp3', quality: '192k', userId: task.requestedBy, playlistTaskId: null, playlistId: null, position: null, ...extra });

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE users, media, artists, albums, playlists, download_tasks, playlist_tasks CASCADE');
});

describe('slugify', () => {
  it('normalises accents and punctuation', () => {
    expect(slugify('Beyoncé & JAY-Z!')).toBe('beyonce-jay-z');
    expect(slugify('!!!')).toBe('unknown');
  });
});

describe('download job', () => {
  it('stores media with artists, album, cover and progress events', async () => {
    const { jobs, events, storage } = await setup();
    const u = await user();
    const task = await prisma.downloadTask.create({ data: { url: 'https://www.youtube.com/watch?v=vid1', requestedBy: u.id } });
    const mediaId = await jobs.download(job(task));
    const media = await prisma.media.findUnique({ where: { id: mediaId }, include: { artists: { include: { artist: true } }, albums: { include: { album: true } } } });
    expect(media).toMatchObject({ title: 'Song', sourceId: 'vid1', filePath: 'vid1.mp3', thumbnailPath: 'vid1.jpg', uploadedBy: u.id, status: 'completed' });
    expect(media.artists.map((a) => a.artist.name).sort()).toEqual(['Artist One', 'Artist Two']);
    expect(media.albums[0].album.name).toBe('The Album');
    expect(storage.uploads).toEqual(['vid1.mp3']);
    expect(await prisma.downloadTask.findUnique({ where: { id: task.id } })).toMatchObject({ status: 'completed', progress: 100, mediaId });
    expect(events.map((e) => e.status)).toEqual(['downloading', 'downloading', 'downloading', 'uploading', 'completed']);
    expect(events.every((e) => e.userId === u.id)).toBe(true);
  });

  it('skips cancelled tasks without running yt-dlp', async () => {
    let probed = false;
    const { jobs } = await setup({ probe: async () => ((probed = true), meta) });
    const task = await prisma.downloadTask.create({ data: { url: 'https://youtu.be/x', status: 'cancelled' } });
    expect(await jobs.download(job(task))).toBe('skipped');
    expect(probed).toBe(false);
  });

  it('schedules a delayed retry, then fails permanently after the last attempt', async () => {
    const { jobs, retries, events } = await setup({ download: async () => Promise.reject(new Error('ERROR: 403')) });
    const task = await prisma.downloadTask.create({ data: { url: 'https://youtu.be/x' } });
    expect(await jobs.download(job(task))).toBe('retried');
    expect(retries[0][1]).toBe(30_000);
    expect(await prisma.downloadTask.findUnique({ where: { id: task.id } })).toMatchObject({ status: 'queued', retryCount: 1 });
    await prisma.downloadTask.update({ where: { id: task.id }, data: { retryCount: 2 } });
    expect(await jobs.download(job(task))).toBe('failed');
    expect(await prisma.downloadTask.findUnique({ where: { id: task.id } })).toMatchObject({ status: 'failed', retryCount: 3, errorMessage: 'ERROR: 403' });
    expect(events.at(-1)).toMatchObject({ status: 'failed', error: 'ERROR: 403' });
  });

  it('adds the track to the target playlist and completes the parent playlist task', async () => {
    const { jobs } = await setup();
    const u = await user();
    const playlist = await prisma.playlist.create({ data: { name: 'Imported playlist', createdBy: u.id } });
    const parent = await prisma.playlistTask.create({ data: { url: 'https://www.youtube.com/playlist?list=1', requestedBy: u.id, status: 'downloading' } });
    const task = await prisma.downloadTask.create({ data: { url: 'https://youtu.be/vid1', requestedBy: u.id, playlistTaskId: parent.id } });
    await jobs.download(job(task, { playlistTaskId: parent.id, playlistId: playlist.id, position: 1 }));
    expect(await prisma.playlist.findUnique({ where: { id: playlist.id } })).toMatchObject({ totalTracks: 1, totalDuration: 180 });
    expect((await prisma.playlistTask.findUnique({ where: { id: parent.id } })).status).toBe('completed');
  });
});

describe('download job dedupe', () => {
  it('reuses an existing track without running yt-dlp', async () => {
    const { jobs, storage } = await setup({ probe: async () => { throw new Error('should not probe'); } });
    const u = await user();
    const have = await prisma.media.create({ data: { title: 'Song', url: 'https://www.youtube.com/watch?v=vid1', sourceId: 'vid1', format: 'mp3', status: 'completed', duration: 180 } });
    const playlist = await prisma.playlist.create({ data: { name: 'Mine', createdBy: u.id } });
    const task = await prisma.downloadTask.create({ data: { url: 'https://youtu.be/vid1', requestedBy: u.id } });
    expect(await jobs.download(job(task, { playlistId: playlist.id }))).toBe(have.id);
    expect(storage.uploads).toEqual([]);
    expect(await prisma.downloadTask.findUnique({ where: { id: task.id } })).toMatchObject({ status: 'completed', mediaId: have.id, progress: 100 });
    expect(await prisma.playlist.findUnique({ where: { id: playlist.id } })).toMatchObject({ totalTracks: 1, totalDuration: 180 });
  });
});

describe('playlist job', () => {
  it('fans out child tasks with positions and renames an imported playlist', async () => {
    const { jobs, published } = await setup();
    const u = await user();
    const playlist = await prisma.playlist.create({ data: { name: 'Imported playlist', createdBy: u.id } });
    const parent = await prisma.playlistTask.create({ data: { url: 'https://www.youtube.com/playlist?list=1', requestedBy: u.id } });
    const count = await jobs.playlist({ playlistTaskId: parent.id, url: parent.url, format: 'mp3', quality: '192k', userId: u.id, playlistId: playlist.id });
    expect(count).toBe(2);
    expect(published.map((p) => [p.url, p.position, p.playlistTaskId])).toEqual([
      ['https://youtu.be/a', 1, parent.id],
      ['https://youtu.be/b', 2, parent.id],
    ]);
    expect((await prisma.playlist.findUnique({ where: { id: playlist.id } })).name).toBe('YT List');
    expect(await prisma.playlistTask.findUnique({ where: { id: parent.id } })).toMatchObject({ status: 'downloading', totalTracks: 2 });
  });

  it('links tracks already in the library instead of downloading them again', async () => {
    const { jobs, published } = await setup({
      playlist: async () => ({ title: 'YT List', entries: [{ url: 'https://www.youtube.com/watch?v=a', title: 'Have it' }, { url: 'https://youtu.be/b', title: 'New one' }] }),
    });
    const u = await user();
    const have = await prisma.media.create({ data: { title: 'Have it', url: 'https://music.youtube.com/watch?v=a', sourceId: 'a', format: 'mp3', status: 'completed', duration: 100 } });
    const playlist = await prisma.playlist.create({ data: { name: 'Imported playlist', createdBy: u.id } });
    const parent = await prisma.playlistTask.create({ data: { url: 'https://www.youtube.com/playlist?list=1', requestedBy: u.id } });
    await jobs.playlist({ playlistTaskId: parent.id, url: parent.url, format: 'mp3', quality: '192k', userId: u.id, playlistId: playlist.id });
    expect(published.map((p) => [p.url, p.position])).toEqual([['https://youtu.be/b', 2]]);
    const children = await prisma.downloadTask.findMany({ where: { playlistTaskId: parent.id }, orderBy: { position: 'asc' } });
    expect(children.map((c) => [c.title, c.status, c.mediaId])).toEqual([
      ['Have it', 'completed', have.id],
      ['New one', 'queued', null],
    ]);
    expect(await prisma.playlistTrack.findMany({ where: { playlistId: playlist.id }, select: { mediaId: true, position: true } })).toEqual([{ mediaId: have.id, position: 1 }]);
    expect((await prisma.playlistTask.findUnique({ where: { id: parent.id } })).status).toBe('downloading');
  });

  it('completes straight away when every track is already in the library', async () => {
    const { jobs, published } = await setup();
    const u = await user();
    await prisma.media.createMany({ data: ['a', 'b'].map((id) => ({ title: id, url: `https://www.youtube.com/watch?v=${id}`, sourceId: id, format: 'mp3', status: 'completed' })) });
    const parent = await prisma.playlistTask.create({ data: { url: 'https://www.youtube.com/playlist?list=1', requestedBy: u.id } });
    await jobs.playlist({ playlistTaskId: parent.id, url: parent.url, format: 'mp3', quality: '192k', userId: u.id, playlistId: null });
    expect(published).toEqual([]);
    expect((await prisma.playlistTask.findUnique({ where: { id: parent.id } })).status).toBe('completed');
  });

  it('fails empty playlists', async () => {
    const { jobs } = await setup({ playlist: async () => ({ title: null, entries: [] }) });
    const parent = await prisma.playlistTask.create({ data: { url: 'https://www.youtube.com/playlist?list=2' } });
    await jobs.playlist({ playlistTaskId: parent.id, url: parent.url, format: 'mp3', quality: '192k', userId: null, playlistId: null });
    expect(await prisma.playlistTask.findUnique({ where: { id: parent.id } })).toMatchObject({ status: 'failed', errorMessage: 'Playlist is empty' });
  });
});
