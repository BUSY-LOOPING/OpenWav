import Redis from 'ioredis';
import { logger } from '../utils/logger.js';

const publisher = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
    retryStrategy: (times) => Math.min(times * 100, 3000),
});

publisher.on('error', (err) => logger.error('Redis publisher error:', err));
publisher.on('connect', () => logger.info('Redis publisher connected'));

export function emitProgress(taskId, status, progress = null, title = null, error = null) {
    logger.info(`[redis:publish] ${taskId} → ${status} ${progress ?? ''}`);
    publisher.publish('download:progress', JSON.stringify({
        taskId, status, progress, title, error,
        timestamp: new Date().toISOString(),
    })).catch((err) => logger.error(`emitProgress failed for ${taskId}:`, err));
}

export default publisher;