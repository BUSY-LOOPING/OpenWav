import { getChannel, EXCHANGE_DOWNLOAD, QUEUE_PLAYLIST, QUEUE_DOWNLOAD } from '../config/rabbit.js';

export function publishDownloadJob({ taskId, url, userId, quality, format }) {
    const channel = getChannel();
    if (!channel) throw new Error('RabbitMQ publisher not connected');
    channel.publish(
        EXCHANGE_DOWNLOAD,
        QUEUE_DOWNLOAD,
        Buffer.from(JSON.stringify({taskId, url, userId, quality, format})),
        {persistent: true}
    )
}

export function publishPlaylistJob({ playlistId, url, userId, quality, format }) {
  const ch = getChannel();
  ch.publish(
    EXCHANGE_DOWNLOAD,
    QUEUE_PLAYLIST,
    Buffer.from(JSON.stringify({ playlistId, url, userId, quality, format })),
    { persistent: true }
  );
}