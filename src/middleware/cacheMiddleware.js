/**
 * Cache middleware for the Recovery Office API
 * Handles caching of responses and cache invalidation
 */
const redisClient = require('../utils/redisClient');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Cache response middleware
 * Caches GET request responses for a specified duration
 * 
 * @param {string} prefix - Cache key prefix for the route
 * @param {number} ttl - Time to live in seconds (defaults to config value)
 * @returns {Function} Express middleware function
 */
exports.cacheResponse = (prefix, ttl) => async (req, res, next) => {
  // Skip caching for non-GET requests
  if (req.method !== 'GET') {
    return next();
  }
  
  // Skip caching if Redis is disabled
  if (!config.redis.enabled) {
    return next();
  }
  
  const cacheTTL = ttl || config.redis.defaultTTL;
  
  // Create a unique cache key based on the route and query parameters
  const cacheKey = `${prefix}:${req.originalUrl}`;
  
  try {
    // Try to get data from cache
    const cachedData = await redisClient.get(cacheKey);
    
    if (cachedData) {
      // If cached data exists, parse and return it
      const data = JSON.parse(cachedData);
      logger.debug(`Cache hit: ${cacheKey}`);
      return res.status(200).json(data);
    }
    
    logger.debug(`Cache miss: ${cacheKey}`);
    
    // Store original send method
    const originalSend = res.send;
    
    // Override send method to cache successful responses
    res.send = function(body) {
      if (res.statusCode === 200) {
        try {
          // Only cache JSON responses
          const data = JSON.parse(body);
          
          // Don't cache error responses
          if (data.status !== 'error') {
            redisClient.setex(cacheKey, cacheTTL, body);
            logger.debug(`Cached: ${cacheKey} for ${cacheTTL}s`);
          }
        } catch (error) {
          logger.error(`Error caching response: ${error.message}`);
        }
      }
      
      // Call the original send method
      originalSend.call(this, body);
    };
    
    return next();
  } catch (error) {
    logger.error(`Cache error: ${error.message}`, { error });
    return next();
  }
};

/**
 * Cache invalidation middleware
 * Invalidates cache when data is modified
 * 
 * @param {string[]} patterns - Array of key patterns to invalidate
 * @returns {Function} Express middleware function
 */
exports.invalidateCache = (patterns) => async (req, res, next) => {
  // Skip invalidation if Redis is disabled
  if (!config.redis.enabled) {
    return next();
  }
  
  // Store original send method
  const originalSend = res.send;
  
  // Override send method to invalidate cache on successful responses
  res.send = async function(body) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        for (const pattern of patterns) {
          const keys = await redisClient.keys(pattern);
          
          if (keys.length > 0) {
            await redisClient.del(...keys);
            logger.debug(`Invalidated cache for pattern: ${pattern} (${keys.length} keys)`);
          }
        }
      } catch (error) {
        logger.error(`Cache invalidation error: ${error.message}`, { error });
      }
    }
    
    // Call the original send method
    originalSend.call(this, body);
  };
  
  return next();
};

/**
 * Clears the entire cache
 * Use with caution! This should only be used in admin routes
 * 
 * @returns {Function} Express middleware function
 */
exports.clearCache = () => async (req, res, next) => {
  // Skip if Redis is disabled
  if (!config.redis.enabled) {
    return next();
  }
  
  try {
    await redisClient.flushall();
    logger.info('Cache cleared');
    
    return res.status(200).json({
      status: 'success',
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    logger.error(`Error clearing cache: ${error.message}`, { error });
    
    return res.status(500).json({
      status: 'error',
      message: 'Failed to clear cache',
      error: error.message
    });
  }
}; 