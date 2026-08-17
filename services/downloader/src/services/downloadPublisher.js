import { getChannel, EXCHANGE_DOWNLOAD, QUEUE_DOWNLOAD } from '../rabbit.js';

export function publishDownloadJob({ taskId, url, format, quality, requestedBy }) {
    const channel = getChannel();
    channel.publish(
        EXCHANGE_DOWNLOAD,
        QUEUE_DOWNLOAD,        
        Buffer.from(JSON.stringify({ taskId, url, format, quality, requestedBy })),
        { persistent: true }    
    );
}