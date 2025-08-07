import Redis from 'ioredis';
import {logger} from './logger.js';


let redisClient;

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

    // Event listeners
    redisClient.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    redisClient.on('ready', () => {
      logger.info('Redis ready for commands');
    });

    redisClient.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });

    redisClient.on('close', () => {
      logger.warn('Redis connection closed');
    });

    redisClient.on('reconnecting', (ms) => {
      logger.info(`Redis reconnecting in ${ms}ms`);
    });

    redisClient.on('end', () => {
      logger.warn('Redis connection ended');
    });

    // Test connection
    await redisClient.connect();
    await redisClient.ping();
    
    logger.info(`Redis connected at ${redisConfig.host}:${redisConfig.port}`);
    return redisClient;

  } catch (error) {
    logger.error('Redis connection failed:', error);
    throw error;
  }
};

const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis not initialized. Call connectRedis first.');
  }
  return redisClient;
};

// Redis utility functions
const redisUtils = {
  // Set with expiration
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

  // Get and parse JSON
  async get(key, parseJson = false) {
    try {
      const client = getRedisClient();
      const value = await client.get(key);
      
      if (!value) return null;
      
      if (parseJson) {
        try {
          return JSON.parse(value);
        } catch (parseError) {
          logger.warn(`Failed to parse JSON for key ${key}:`, parseError);
          return value;
        }
      }
      
      return value;
    } catch (error) {
      logger.error(`Redis get error for key ${key}:`, error);
      throw error;
    }
  },

  // Delete key
  async del(key) {
    try {
      const client = getRedisClient();
      return await client.del(key);
    } catch (error) {
      logger.error(`Redis del error for key ${key}:`, error);
      throw error;
    }
  },

  // Check if key exists
  async exists(key) {
    try {
      const client = getRedisClient();
      return await client.exists(key);
    } catch (error) {
      logger.error(`Redis exists error for key ${key}:`, error);
      throw error;
    }
  },

  // Set expiration
  async expire(key, ttl) {
    try {
      const client = getRedisClient();
      return await client.expire(key, ttl);
    } catch (error) {
      logger.error(`Redis expire error for key ${key}:`, error);
      throw error;
    }
  },

  // Get TTL
  async ttl(key) {
    try {
      const client = getRedisClient();
      return await client.ttl(key);
    } catch (error) {
      logger.error(`Redis ttl error for key ${key}:`, error);
      throw error;
    }
  },

  // Increment counter
  async incr(key) {
    try {
      const client = getRedisClient();
      return await client.incr(key);
    } catch (error) {
      logger.error(`Redis incr error for key ${key}:`, error);
      throw error;
    }
  },

  // Add to set
  async sadd(key, ...members) {
    try {
      const client = getRedisClient();
      return await client.sadd(key, ...members);
    } catch (error) {
      logger.error(`Redis sadd error for key ${key}:`, error);
      throw error;
    }
  },

  // Remove from set
  async srem(key, ...members) {
    try {
      const client = getRedisClient();
      return await client.srem(key, ...members);
    } catch (error) {
      logger.error(`Redis srem error for key ${key}:`, error);
      throw error;
    }
  },

  // Check if member in set
  async sismember(key, member) {
    try {
      const client = getRedisClient();
      return await client.sismember(key, member);
    } catch (error) {
      logger.error(`Redis sismember error for key ${key}:`, error);
      throw error;
    }
  },

  // Get all set members
  async smembers(key) {
    try {
      const client = getRedisClient();
      return await client.smembers(key);
    } catch (error) {
      logger.error(`Redis smembers error for key ${key}:`, error);
      throw error;
    }
  },

  // Hash operations
  async hset(key, field, value) {
    try {
      const client = getRedisClient();
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      return await client.hset(key, field, stringValue);
    } catch (error) {
      logger.error(`Redis hset error for key ${key}:`, error);
      throw error;
    }
  },

  async hget(key, field, parseJson = false) {
    try {
      const client = getRedisClient();
      const value = await client.hget(key, field);
      
      if (!value) return null;
      
      if (parseJson) {
        try {
          return JSON.parse(value);
        } catch (parseError) {
          logger.warn(`Failed to parse JSON for key ${key}, field ${field}:`, parseError);
          return value;
        }
      }
      
      return value;
    } catch (error) {
      logger.error(`Redis hget error for key ${key}, field ${field}:`, error);
      throw error;
    }
  },

  async hgetall(key, parseJson = false) {
    try {
      const client = getRedisClient();
      const hash = await client.hgetall(key);
      
      if (parseJson) {
        const parsed = {};
        for (const [field, value] of Object.entries(hash)) {
          try {
            parsed[field] = JSON.parse(value);
          } catch (parseError) {
            parsed[field] = value;
          }
        }
        return parsed;
      }
      
      return hash;
    } catch (error) {
      logger.error(`Redis hgetall error for key ${key}:`, error);
      throw error;
    }
  },

  async hdel(key, ...fields) {
    try {
      const client = getRedisClient();
      return await client.hdel(key, ...fields);
    } catch (error) {
      logger.error(`Redis hdel error for key ${key}:`, error);
      throw error;
    }
  },

  // List operations
  async lpush(key, ...values) {
    try {
      const client = getRedisClient();
      const stringValues = values.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v));
      return await client.lpush(key, ...stringValues);
    } catch (error) {
      logger.error(`Redis lpush error for key ${key}:`, error);
      throw error;
    }
  },

  async rpop(key, parseJson = false) {
    try {
      const client = getRedisClient();
      const value = await client.rpop(key);
      
      if (!value) return null;
      
      if (parseJson) {
        try {
          return JSON.parse(value);
        } catch (parseError) {
          logger.warn(`Failed to parse JSON for key ${key}:`, parseError);
          return value;
        }
      }
      
      return value;
    } catch (error) {
      logger.error(`Redis rpop error for key ${key}:`, error);
      throw error;
    }
  },

  async llen(key) {
    try {
      const client = getRedisClient();
      return await client.llen(key);
    } catch (error) {
      logger.error(`Redis llen error for key ${key}:`, error);
      throw error;
    }
  },

  // Pattern matching
  async keys(pattern) {
    try {
      const client = getRedisClient();
      return await client.keys(pattern);
    } catch (error) {
      logger.error(`Redis keys error for pattern ${pattern}:`, error);
      throw error;
    }
  },

  // Flush database (use with caution)
  async flushdb() {
    try {
      const client = getRedisClient();
      return await client.flushdb();
    } catch (error) {
      logger.error('Redis flushdb error:', error);
      throw error;
    }
  }
};

// Session management utilities
const sessionUtils = {
  // Store user session
  async storeSession(userId, sessionData, ttl = 86400) {
    const key = `session:${userId}`;
    return await redisUtils.setEx(key, sessionData, ttl);
  },

  // Get user session
  async getSession(userId) {
    const key = `session:${userId}`;
    return await redisUtils.get(key, true);
  },

  // Delete user session
  async deleteSession(userId) {
    const key = `session:${userId}`;
    return await redisUtils.del(key);
  },

  // Store refresh token
  async storeRefreshToken(tokenHash, userId, ttl = 604800) {
    const key = `refresh_token:${tokenHash}`;
    return await redisUtils.setEx(key, userId, ttl);
  },

  // Validate refresh token
  async validateRefreshToken(tokenHash) {
    const key = `refresh_token:${tokenHash}`;
    return await redisUtils.get(key);
  },

  // Revoke refresh token
  async revokeRefreshToken(tokenHash) {
    const key = `refresh_token:${tokenHash}`;
    return await redisUtils.del(key);
  }
};

// Cache utilities
const cacheUtils = {
  // Cache user data
  async cacheUser(userId, userData, ttl = 3600) {
    const key = `user:${userId}`;
    return await redisUtils.setEx(key, userData, ttl);
  },

  // Get cached user
  async getCachedUser(userId) {
    const key = `user:${userId}`;
    return await redisUtils.get(key, true);
  },

  // Cache media info
  async cacheMediaInfo(url, mediaInfo, ttl = 86400) {
    const key = `media_info:${Buffer.from(url).toString('base64')}`;
    return await redisUtils.setEx(key, mediaInfo, ttl);
  },

  // Get cached media info
  async getCachedMediaInfo(url) {
    const key = `media_info:${Buffer.from(url).toString('base64')}`;
    return await redisUtils.get(key, true);
  },

  // Cache settings
  async cacheSettings(type, settings, ttl = 3600) {
    const key = `settings:${type}`;
    return await redisUtils.setEx(key, settings, ttl);
  },

  // Get cached settings
  async getCachedSettings(type) {
    const key = `settings:${type}`;
    return await redisUtils.get(key, true);
  },

  // Invalidate cache pattern
  async invalidatePattern(pattern) {
    try {
      const keys = await redisUtils.keys(pattern);
      if (keys.length > 0) {
        const client = getRedisClient();
        return await client.del(...keys);
      }
      return 0;
    } catch (error) {
      logger.error(`Error invalidating cache pattern ${pattern}:`, error);
      throw error;
    }
  }
};

// Rate limiting utilities
const rateLimitUtils = {
  // Check rate limit
  async checkRateLimit(identifier, limit, window) {
    const key = `rate_limit:${identifier}`;
    const current = await redisUtils.incr(key);
    
    if (current === 1) {
      await redisUtils.expire(key, window);
    }
    
    return {
      current,
      limit,
      remaining: Math.max(0, limit - current),
      exceeded: current > limit
    };
  },

  // Reset rate limit
  async resetRateLimit(identifier) {
    const key = `rate_limit:${identifier}`;
    return await redisUtils.del(key);
  }
};

// Graceful shutdown
const closeRedis = async () => {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info('Redis connection closed gracefully');
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
      redisClient.disconnect();
    }
  }
};

process.on('SIGINT', closeRedis);
process.on('SIGTERM', closeRedis);

export  {
  connectRedis,
  getRedisClient,
  redisUtils,
  sessionUtils,
  cacheUtils,
  rateLimitUtils,
  closeRedis
};