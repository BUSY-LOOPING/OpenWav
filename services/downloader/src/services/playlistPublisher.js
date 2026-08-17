import { getChannel, EXCHANGE_DOWNLOAD, QUEUE_PLAYLIST  } from '../rabbit.js';

export async function publishPlaylistJob({ taskId, url, format, quality, requestedBy }) {
    const channel = getChannel();
    channel.publish(
        EXCHANGE_DOWNLOAD,
        QUEUE_PLAYLIST,
        Buffer.from(JSON.stringify({ taskId, url, format, quality, requestedBy })),
        { persistent: true }
    );
}