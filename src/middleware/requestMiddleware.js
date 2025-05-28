/**
 * Request middleware for the Recovery Office API
 * Handles request ID generation and request logging
 */
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Add a unique request ID to each request
 * This helps with tracing requests through logs
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
exports.addRequestId = (req, res, next) => {
  // Generate a UUID for the request
  const requestId = uuidv4();
  
  // Add the ID to the request object
  req.id = requestId;
  
  // Add to response headers
  res.setHeader('X-Request-ID', requestId);
  
  next();
};

/**
 * Log request details
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
exports.logRequest = (req, res, next) => {
  // Create a logger with the request ID
  req.logger = logger.addRequestId(req.id);
  
  // Log request details
  req.logger.info({
    message: `${req.method} ${req.originalUrl}`,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    query: req.query,
    // Don't log sensitive data like passwords
    body: req.method !== 'GET' ? sanitizeRequestBody(req.body) : undefined
  });
  
  // Log response when finished
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const level = res.statusCode >= 400 ? 'warn' : 'info';
    
    req.logger[level]({
      message: `${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`,
      statusCode: res.statusCode,
      duration,
      responseTime: `${duration}ms`
    });
  });
  
  next();
};

/**
 * Sanitize request body to remove sensitive information from logs
 * 
 * @param {Object} body - Request body
 * @returns {Object} Sanitized body
 */
const sanitizeRequestBody = (body) => {
  if (!body) return {};
  
  // Create a copy of the body
  const sanitized = { ...body };
  
  // List of sensitive fields to redact
  const sensitiveFields = ['password', 'token', 'refreshToken', 'accessToken', 'apiKey', 'secret'];
  
  // Redact sensitive fields
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
}; 