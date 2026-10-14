import { EXCHANGE, QUEUES, TASK_STATUS, isAllowedDomain, isPlaylistUrl, publishJson } from '@openwav/shared';
import { AppError, badRequest, unavailable } from '../lib/errors.js';

const YT_HOSTS = /(^|\.)(youtube\.com|youtu\.be|music\.youtube\.com)$/;

export function canonicalUrl(raw) {
  const url = new URL(raw);
  if (!YT_HOSTS.test(url.hostname)) return { url: url.toString(), sourceId: null };
  const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v');
  if (!id || isPlaylistUrl(raw)) return { url: url.toString(), sourceId: null };
  return { url: `https://www.youtube.com/watch?v=${id}`, sourceId: id };
}

export function createDownloadService({ prisma, settings, channel, playlists }) {
  async function guard(rawUrl, userId) {
    const s = await settings.all();
    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw badRequest('Invalid URL');
    }
    if (!['http:', 'https:'].includes(parsed.protocol) || !isAllowedDomain(rawUrl, s['downloads.allowed_domains'])) {
      throw badRequest(`Downloads from ${parsed.hostname} are not allowed`);
    }
    if (userId) {
      const since = new Date(Date.now() - 86_400_000);
      const count = await prisma.downloadTask.count({ where: { requestedBy: userId, createdAt: { gte: since } } });
      if (count >= s['downloads.max_per_user_per_day']) throw new AppError(429, 'RATE_LIMITED', 'Daily download limit reached');
    }
    return s;
  }

  async function publish(routingKey, payload, onFail) {
    try {
      await publishJson(channel(), EXCHANGE, routingKey, payload);
    } catch (err) {
      await onFail(err);
      throw unavailable('Download queue is unavailable, try again shortly');
    }
  }

  async function create({ url: rawUrl, format, quality, userId, playlistId = null, name, isPublic }) {
    const s = await guard(rawUrl, userId);
    format ??= s['downloads.default_format'];
    quality ??= s['downloads.default_quality'];

    if (isPlaylistUrl(rawUrl)) {
      const target = playlistId ?? (name !== undefined ? (await playlists.createOwned(userId, { name, isPublic })).id : null);
      const task = await prisma.playlistTask.create({ data: { url: rawUrl, requestedBy: userId, format, quality, targetPlaylistId: target } });
      await publish(QUEUES.playlist, { playlistTaskId: task.id, url: rawUrl, format, quality, userId, playlistId: target }, (err) =>
        prisma.playlistTask.update({ where: { id: task.id }, data: { status: 'failed', errorMessage: err.message } }),
      );
      return { type: 'playlist', playlistTaskId: task.id, playlistId: target };
    }

    const { url, sourceId } = canonicalUrl(rawUrl);
    const existing = await prisma.media.findFirst({
      where: { status: 'completed', OR: [{ url, format }, ...(sourceId ? [{ sourceId }] : [])] },
      select: { id: true },
    });
    if (existing) {
      if (playlistId) await playlists.addTrack(playlistId, existing.id, userId);
      return { type: 'track', mediaId: existing.id };
    }

    const task = await prisma.downloadTask.create({ data: { url, requestedBy: userId, format, quality, targetPlaylistId: playlistId } });
    await publish(QUEUES.download, { taskId: task.id, url, format, quality, userId, playlistTaskId: null, playlistId, position: null }, (err) =>
      prisma.downloadTask.update({ where: { id: task.id }, data: { status: TASK_STATUS.failed, errorMessage: err.message } }),
    );
    return { type: 'track', taskId: task.id };
  }

  async function retry(taskId) {
    const task = await prisma.downloadTask.update({
      where: { id: taskId },
      data: { status: TASK_STATUS.queued, errorMessage: null, progress: 0, retryCount: 0 },
    });
    await publish(
      QUEUES.download,
      {
        taskId: task.id,
        url: task.url,
        format: task.format,
        quality: task.quality,
        userId: task.requestedBy,
        playlistTaskId: task.playlistTaskId,
        playlistId: task.targetPlaylistId,
        position: task.position,
      },
      () => {},
    );
    return task;
  }

  return { create, retry };
}
