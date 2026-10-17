import fs from 'node:fs/promises';
import { MAX_RETRIES, PLAYLIST_TASK_STATUS, TASK_STATUS, TERMINAL_TASK_STATUSES, retryDelayMs } from '@openwav/shared';
import { counter, gauge, histogram } from '@openwav/shared/metrics';

const jobs = counter('download_jobs_total', 'Download jobs by outcome', ['status']);
const duration = histogram('download_job_duration_seconds', 'Download job duration', ['status']);
const inFlight = gauge('downloads_in_flight', 'Downloads currently running');

export const slugify = (value) =>
  value.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 200) || 'unknown';

const sourceIdOf = (raw) => {
  const url = new URL(raw);
  return url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v');
};

export function createJobs({ prisma, ytdlp, storage, emit, publishDownload, publishRetry, tempDir, logger }) {
  const controllers = new Map();

  function findExisting(url, format) {
    const sourceId = sourceIdOf(url);
    return prisma.media.findFirst({ where: { status: 'completed', OR: [{ url, format }, ...(sourceId ? [{ sourceId }] : [])] }, select: { id: true } });
  }

  async function linkToPlaylist(tx, job, mediaId) {
    if (!job.playlistId) return;
    const { _max } = await tx.playlistTrack.aggregate({ where: { playlistId: job.playlistId }, _max: { position: true } });
    await tx.playlistTrack.upsert({
      where: { playlistId_mediaId: { playlistId: job.playlistId, mediaId } },
      create: { playlistId: job.playlistId, mediaId, addedBy: job.userId, position: job.position ?? (_max.position ?? 0) + 1 },
      update: {},
    });
    const [{ count, total }] = await tx.$queryRaw`
      SELECT count(*)::int AS count, coalesce(sum(m.duration), 0)::int AS total
      FROM playlist_tracks pt JOIN media m ON m.id = pt.media_id WHERE pt.playlist_id = ${job.playlistId}::uuid`;
    await tx.playlist.update({ where: { id: job.playlistId }, data: { totalTracks: count, totalDuration: total } });
  }

  const completeTask = (tx, taskId, mediaId) =>
    tx.downloadTask.update({ where: { id: taskId }, data: { status: TASK_STATUS.completed, progress: 100, mediaId, completedAt: new Date(), errorMessage: null } });

  async function finishPlaylistTask(playlistTaskId) {
    if (!playlistTaskId) return;
    const [parent, counts] = await Promise.all([
      prisma.playlistTask.findUnique({ where: { id: playlistTaskId }, select: { totalTracks: true } }),
      prisma.downloadTask.groupBy({ by: ['status'], where: { playlistTaskId }, _count: true }),
    ]);
    const created = counts.reduce((n, c) => n + c._count, 0);
    const pending = counts.filter((c) => !TERMINAL_TASK_STATUSES.includes(c.status)).reduce((n, c) => n + c._count, 0);
    // Children finishing while the playlist is still fanning out must not close it early
    if (pending || created < (parent?.totalTracks ?? 0)) return;
    const completed = counts.find((c) => c.status === TASK_STATUS.completed)?._count ?? 0;
    await prisma.playlistTask.updateMany({
      where: { id: playlistTaskId, status: { not: PLAYLIST_TASK_STATUS.cancelled } },
      data: completed ? { status: PLAYLIST_TASK_STATUS.completed } : { status: PLAYLIST_TASK_STATUS.failed, errorMessage: 'No tracks could be downloaded' },
    });
  }

  async function saveMedia(task, job, meta, objectKey, fileSize, coverKey) {
    return prisma.$transaction(async (tx) => {
      const media = await tx.media.upsert({
        where: { url_format: { url: job.url, format: job.format } },
        create: {
          title: meta.title,
          description: meta.description,
          url: job.url,
          sourceId: meta.sourceId,
          platform: meta.platform,
          duration: meta.duration,
          filePath: objectKey,
          thumbnailPath: coverKey ?? meta.thumbnailUrl,
          fileSize: BigInt(fileSize),
          format: job.format,
          quality: job.quality,
          status: 'completed',
          uploadedBy: job.userId,
          metadata: meta.metadata,
        },
        update: { status: 'completed', filePath: objectKey, fileSize: BigInt(fileSize), thumbnailPath: coverKey ?? meta.thumbnailUrl },
      });
      for (const [position, name] of meta.artists.entries()) {
        const artist = await tx.artist.upsert({ where: { slug: slugify(name) }, create: { name, slug: slugify(name) }, update: {} });
        await tx.mediaArtist.upsert({
          where: { mediaId_artistId_role: { mediaId: media.id, artistId: artist.id, role: 'artist' } },
          create: { mediaId: media.id, artistId: artist.id, position },
          update: {},
        });
      }
      if (meta.album) {
        const album = await tx.album.upsert({
          where: { slug: slugify(`${meta.album}-${meta.artists[0] ?? ''}`) },
          create: { name: meta.album, slug: slugify(`${meta.album}-${meta.artists[0] ?? ''}`), coverImageUrl: coverKey, releaseDate: meta.releaseYear ? new Date(Date.UTC(meta.releaseYear, 0, 1)) : null },
          update: {},
        });
        await tx.mediaAlbum.upsert({ where: { mediaId_albumId: { mediaId: media.id, albumId: album.id } }, create: { mediaId: media.id, albumId: album.id }, update: {} });
      }
      await linkToPlaylist(tx, job, media.id);
      await completeTask(tx, task.id, media.id);
      return media;
    });
  }

  async function download(job) {
    const task = await prisma.downloadTask.findUnique({ where: { id: job.taskId } });
    if (!task || task.status === TASK_STATUS.cancelled || task.status === TASK_STATUS.completed) return 'skipped';
    const say = (status, progress = null, title = null, error = null) => emit({ taskId: task.id, status, progress, title, error, userId: job.userId });
    const existing = await findExisting(job.url, job.format);
    if (existing) {
      await prisma.$transaction(async (tx) => {
        await linkToPlaylist(tx, job, existing.id);
        await completeTask(tx, task.id, existing.id);
      });
      say(TASK_STATUS.completed, 100, task.title);
      jobs.inc({ status: 'existing' });
      await finishPlaylistTask(job.playlistTaskId);
      return existing.id;
    }
    const controller = new AbortController();
    controllers.set(task.id, controller);
    const stop = duration.startTimer();
    inFlight.inc();
    let file = null;
    try {
      await prisma.downloadTask.update({ where: { id: task.id }, data: { status: TASK_STATUS.downloading, startedAt: new Date(), progress: 0 } });
      const meta = await ytdlp.probe(job.url, controller.signal);
      say(TASK_STATUS.downloading, 2, meta.title);
      let last = 0;
      file = await ytdlp.download({
        url: job.url,
        dir: tempDir,
        name: task.id,
        format: job.format,
        quality: job.quality,
        signal: controller.signal,
        onProgress: (pct) => {
          const scaled = Math.round(2 + pct * 0.88);
          if (scaled - last >= 2) {
            last = scaled;
            say(TASK_STATUS.downloading, scaled, meta.title);
            prisma.downloadTask.update({ where: { id: task.id }, data: { progress: scaled } }).catch(() => {});
          }
        },
      });
      if ((await prisma.downloadTask.findUnique({ where: { id: task.id }, select: { status: true } }))?.status === TASK_STATUS.cancelled) {
        throw Object.assign(new Error('Cancelled'), { cancelled: true });
      }
      say(TASK_STATUS.uploading, 92, meta.title);
      await prisma.downloadTask.update({ where: { id: task.id }, data: { status: TASK_STATUS.uploading, progress: 92 } });
      const ext = file.split('.').pop();
      const objectKey = `${meta.sourceId ?? task.id}.${ext}`;
      const fileSize = await storage.uploadAudio(file, objectKey, ext);
      const coverKey = meta.thumbnailUrl ? await storage.uploadCover(meta.thumbnailUrl, meta.sourceId ?? task.id).catch((err) => (logger.warn({ err: err.message }, 'cover upload failed'), null)) : null;
      const media = await saveMedia(task, job, meta, objectKey, fileSize, coverKey);
      say(TASK_STATUS.completed, 100, meta.title);
      jobs.inc({ status: 'completed' });
      stop({ status: 'completed' });
      return media.id;
    } catch (err) {
      if (err.cancelled) {
        say(TASK_STATUS.cancelled);
        jobs.inc({ status: 'cancelled' });
        stop({ status: 'cancelled' });
        return 'cancelled';
      }
      const retryCount = task.retryCount + 1;
      const finalAttempt = retryCount >= MAX_RETRIES;
      await prisma.downloadTask.update({
        where: { id: task.id },
        data: { status: finalAttempt ? TASK_STATUS.failed : TASK_STATUS.queued, retryCount, errorMessage: err.message.slice(0, 2000), progress: 0 },
      });
      if (finalAttempt) {
        say(TASK_STATUS.failed, null, null, err.message);
        jobs.inc({ status: 'failed' });
      } else {
        say(TASK_STATUS.queued, 0, null, err.message);
        await publishRetry(job, retryDelayMs(retryCount - 1));
        jobs.inc({ status: 'retried' });
      }
      stop({ status: finalAttempt ? 'failed' : 'retried' });
      logger.warn({ taskId: task.id, retryCount, err: err.message }, 'download failed');
      return finalAttempt ? 'failed' : 'retried';
    } finally {
      inFlight.dec();
      controllers.delete(task.id);
      if (file) await fs.rm(file, { force: true });
      await finishPlaylistTask(job.playlistTaskId);
    }
  }

  async function playlist(job) {
    const task = await prisma.playlistTask.findUnique({ where: { id: job.playlistTaskId } });
    if (!task || task.status === PLAYLIST_TASK_STATUS.cancelled) return 0;
    await prisma.playlistTask.update({ where: { id: task.id }, data: { status: PLAYLIST_TASK_STATUS.resolving } });
    try {
      const { title, entries } = await ytdlp.playlist(job.url);
      if (!entries.length) throw new Error('Playlist is empty');
      if (job.playlistId && title) {
        await prisma.playlist.updateMany({ where: { id: job.playlistId, name: 'Imported playlist' }, data: { name: title.slice(0, 150) } });
      }
      await prisma.playlistTask.update({ where: { id: task.id }, data: { status: PLAYLIST_TASK_STATUS.downloading, totalTracks: entries.length } });
      for (const [i, entry] of entries.entries()) {
        const childJob = { url: entry.url, format: job.format, quality: job.quality, userId: job.userId, playlistTaskId: task.id, playlistId: job.playlistId, position: i + 1 };
        const data = { url: entry.url, title: entry.title?.slice(0, 500), requestedBy: job.userId, format: job.format, quality: job.quality, playlistTaskId: task.id, targetPlaylistId: job.playlistId, position: i + 1 };
        const existing = await findExisting(entry.url, job.format);
        if (existing) {
          await prisma.$transaction(async (tx) => {
            const child = await tx.downloadTask.create({ data });
            await linkToPlaylist(tx, childJob, existing.id);
            await completeTask(tx, child.id, existing.id);
          });
          continue;
        }
        const child = await prisma.downloadTask.create({ data });
        await publishDownload({ taskId: child.id, ...childJob });
      }
      await finishPlaylistTask(task.id);
      return entries.length;
    } catch (err) {
      await prisma.playlistTask.update({ where: { id: task.id }, data: { status: PLAYLIST_TASK_STATUS.failed, errorMessage: err.message.slice(0, 2000) } });
      logger.warn({ playlistTaskId: task.id, err: err.message }, 'playlist failed');
      return 0;
    }
  }

  return {
    download,
    playlist,
    cancel: (taskId) => controllers.get(taskId)?.abort(),
    running: () => controllers.size,
  };
}
