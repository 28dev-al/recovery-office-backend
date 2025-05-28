/**
 * Redis client for caching
 * Provides connection to Redis server and basic utility methods
 */
const Redis = require('ioredis');
const config = require('../config');
const logger = require('./logger');

let redisClient;

// Check if Redis is enabled in config
if (config.redis && config.redis.enabled) {
  redisClient = new Redis(config.redis.url, {
    retryStrategy: (times) => Math.min(times * 50, 2000),
    connectTimeout: 10000,
    maxRetriesPerRequest: 3
  });

  redisClient.on('error', (err) => {
    logger.error(`Redis error: ${err.message}`, { error: err });
  });

  redisClient.on('connect', () => {
    logger.info('Connected to Redis');
  });

  redisClient.on('reconnecting', () => {
    logger.info('Reconnecting to Redis');
  });
} else {
  // Create a mock Redis client if Redis is disabled
  logger.info('Redis is disabled, using mock Redis client');
  
  const cache = new Map();
  
  redisClient = {
    get: async (key) => {
      const item = cache.get(key);
      if (!item) return null;
      
      if (item.expiry && item.expiry < Date.now()) {
        cache.delete(key);
        return null;
      }
      
      return item.value;
    },
    set: async (key, value, expiryMode, time) => {
      let expiry = null;
      if (expiryMode === 'EX' && time) {
        expiry = Date.now() + (time * 1000);
      }
      
      cache.set(key, { value, expiry });
      return 'OK';
    },
    setex: async (key, seconds, value) => {
      const expiry = Date.now() + (seconds * 1000);
      cache.set(key, { value, expiry });
      return 'OK';
    },
    del: async (...keys) => {
      let count = 0;
      for (const key of keys) {
        if (cache.delete(key)) count++;
      }
      return count;
    },
    keys: async (pattern) => {
      const regex = new RegExp(pattern.replace('*', '.*'));
      const keys = [];
      for (const key of cache.keys()) {
        if (regex.test(key)) keys.push(key);
      }
      return keys;
    },
    flushall: async () => {
      cache.clear();
      return 'OK';
    }
  };
}

module.exports = redisClient; 