import Redis from 'ioredis';
import { logger } from './logger.js';

let redisClient;
let redisSubscriber;

const progressListeners = new Map();

const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: 0,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    keepAlive: 30000,
    connectTimeout: 10000,
    commandTimeout: 5000,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        logger.warn(`Redis connection attempt ${times}, retrying in ${delay}ms`);
        return delay;
    }
};

const connectRedis = async () => {
    try {
        redisClient = new Redis(redisConfig);

        redisClient.on('connect',      ()   => logger.info('Redis connected successfully'));
        redisClient.on('ready',        ()   => logger.info('Redis ready for commands'));
        redisClient.on('error',        (err) => logger.error('Redis connection error:', err));
        redisClient.on('close',        ()   => logger.warn('Redis connection closed'));
        redisClient.on('reconnecting', (ms) => logger.info(`Redis reconnecting in ${ms}ms`));
        redisClient.on('end',          ()   => logger.warn('Redis connection ended'));

        await redisClient.ping();
        logger.info(`Redis connected at ${redisConfig.host}:${redisConfig.port}`);

        redisSubscriber = new Redis(redisConfig);

        await redisSubscriber.subscribe('download:progress');

        redisSubscriber.on('message', (channel, message) => {
            try {
                const data = JSON.parse(message);
                const listeners = progressListeners.get(data.taskId);
                if (!listeners || listeners.size === 0) return;

                const payload = `data: ${JSON.stringify(data)}\n\n`;
                const isTerminal = data.status === 'completed' || data.status === 'failed';

                for (const res of listeners) {
                    res.write(payload);
                    if (isTerminal) {
                        res.end();
                        listeners.delete(res);
                    }
                }

                // Cleanup map entry when all listeners are done
                if (isTerminal && listeners.size === 0) {
                    progressListeners.delete(data.taskId);
                }
            } catch (err) {
                logger.error('Progress subscriber message error:', err);
            }
        });

        redisSubscriber.on('error', (err) => {
            logger.error('Redis subscriber error:', err);
        });

        return redisClient;
    } catch (error) {
        logger.error('Redis connection failed:', error);
        throw error;
    }
};

// ─── Progress SSE Helpers ─────────────────────────────────────────────────────

const addProgressListener = (taskId, res) => {
    if (!progressListeners.has(taskId)) {
        progressListeners.set(taskId, new Set());
    }
    progressListeners.get(taskId).add(res);
};

const removeProgressListener = (taskId, res) => {
    const listeners = progressListeners.get(taskId);
    if (!listeners) return;
    listeners.delete(res);
    if (listeners.size === 0) {
        progressListeners.delete(taskId);
    }
};

// ─── Getters ──────────────────────────────────────────────────────────────────

const getRedisClient = () => {
    if (!redisClient) throw new Error('Redis not initialized. Call connectRedis first.');
    return redisClient;
};

const getRedisSubscriber = () => {
    if (!redisSubscriber) throw new Error('Redis subscriber not initialized');
    return redisSubscriber;
};

// ─── Utilities ────────────────────────────────────────────────────

const redisUtils = {
    async setEx(key, value, ttl = 3600) {
        try {
            const client = getRedisClient();
            const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
            return await client.setex(key, ttl, stringValue);
        } catch (error) {
            logger.error(`Redis setEx error for key ${key}:`, error);
            throw error;
        }
    },

    async get(key, parseJson = false) {
        try {
            const client = getRedisClient();
            const value = await client.get(key);
            if (!value) return null;
            if (parseJson) {
                try { return JSON.parse(value); }
                catch { return value; }
            }
            return value;
        } catch (error) {
            logger.error(`Redis get error for key ${key}:`, error);
            throw error;
        }
    },

    async del(key)              { return getRedisClient().del(key); },
    async exists(key)           { return getRedisClient().exists(key); },
    async expire(key, ttl)      { return getRedisClient().expire(key, ttl); },
    async ttl(key)              { return getRedisClient().ttl(key); },
    async incr(key)             { return getRedisClient().incr(key); },
    async decr(key)             { return getRedisClient().decr(key); },
    async sadd(key, ...members) { return getRedisClient().sadd(key, ...members); },
    async srem(key, ...members) { return getRedisClient().srem(key, ...members); },
    async sismember(key, member){ return getRedisClient().sismember(key, member); },
    async smembers(key)         { return getRedisClient().smembers(key); },
    async keys(pattern)         { return getRedisClient().keys(pattern); },
    async flushdb()             { return getRedisClient().flushdb(); },
    async llen(key)             { return getRedisClient().llen(key); },

    async hset(key, field, value) {
        const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        return getRedisClient().hset(key, field, stringValue);
    },

    async hget(key, field, parseJson = false) {
        const value = await getRedisClient().hget(key, field);
        if (!value) return null;
        if (parseJson) { try { return JSON.parse(value); } catch { return value; } }
        return value;
    },

    async hgetall(key, parseJson = false) {
        const hash = await getRedisClient().hgetall(key);
        if (!parseJson) return hash;
        const parsed = {};
        for (const [field, value] of Object.entries(hash)) {
            try { parsed[field] = JSON.parse(value); } catch { parsed[field] = value; }
        }
        return parsed;
    },

    async hdel(key, ...fields) { return getRedisClient().hdel(key, ...fields); },

    async lpush(key, ...values) {
        const stringValues = values.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v));
        return getRedisClient().lpush(key, ...stringValues);
    },

    async rpop(key, parseJson = false) {
        const value = await getRedisClient().rpop(key);
        if (!value) return null;
        if (parseJson) { try { return JSON.parse(value); } catch { return value; } }
        return value;
    },

    async invalidatePattern(pattern) {
        const keys = await getRedisClient().keys(pattern);
        if (keys.length > 0) return getRedisClient().del(...keys);
        return 0;
    },
};

const sessionUtils = {
    async storeSession(userId, sessionData, ttl = 86400) {
        return redisUtils.setEx(`session:${userId}`, sessionData, ttl);
    },
    async getSession(userId) {
        return redisUtils.get(`session:${userId}`, true);
    },
    async deleteSession(userId) {
        return redisUtils.del(`session:${userId}`);
    },
    async storeRefreshToken(tokenHash, userId, ttl = 604800) {
        return redisUtils.setEx(`refresh_token:${tokenHash}`, userId, ttl);
    },
    async validateRefreshToken(tokenHash) {
        return redisUtils.get(`refresh_token:${tokenHash}`);
    },
    async revokeRefreshToken(tokenHash) {
        return redisUtils.del(`refresh_token:${tokenHash}`);
    },
};

const cacheUtils = {
    async cacheUser(userId, userData, ttl = 3600) {
        return redisUtils.setEx(`user:${userId}`, userData, ttl);
    },
    async getCachedUser(userId) {
        return redisUtils.get(`user:${userId}`, true);
    },
    async cacheMediaInfo(url, mediaInfo, ttl = 86400) {
        return redisUtils.setEx(`media_info:${Buffer.from(url).toString('base64')}`, mediaInfo, ttl);
    },
    async getCachedMediaInfo(url) {
        return redisUtils.get(`media_info:${Buffer.from(url).toString('base64')}`, true);
    },
    async cacheSettings(type, settings, ttl = 3600) {
        return redisUtils.setEx(`settings:${type}`, settings, ttl);
    },
    async getCachedSettings(type) {
        return redisUtils.get(`settings:${type}`, true);
    },
    async invalidatePattern(pattern) {
        return redisUtils.invalidatePattern(pattern);
    },
};

const rateLimitUtils = {
    async checkRateLimit(identifier, limit, window) {
        const key = `rate_limit:${identifier}`;
        const current = await redisUtils.incr(key);
        if (current === 1) await redisUtils.expire(key, window);
        return {
            current,
            limit,
            remaining: Math.max(0, limit - current),
            exceeded: current > limit,
        };
    },
    async resetRateLimit(identifier) {
        return redisUtils.del(`rate_limit:${identifier}`);
    },
};

// ─── Shutdown ─────────────────────────────────────────────────────────────────

const closeRedis = async () => {
    try {
        if (redisSubscriber) await redisSubscriber.quit();
        if (redisClient)     await redisClient.quit();
        logger.info('Redis connections closed gracefully');
    } catch (error) {
        logger.error('Error closing Redis:', error);
        redisClient?.disconnect();
        redisSubscriber?.disconnect();
    }
};

process.on('SIGINT',  closeRedis);
process.on('SIGTERM', closeRedis);

export {
    connectRedis,
    getRedisClient,
    getRedisSubscriber,
    addProgressListener,
    removeProgressListener,
    redisUtils,
    sessionUtils,
    cacheUtils,
    rateLimitUtils,
    closeRedis,
};