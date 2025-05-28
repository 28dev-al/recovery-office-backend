/**
 * Logger utility for structured logging
 * Uses Winston for flexible, multi-transport logging
 */
const winston = require('winston');
const path = require('path');
require('winston-daily-rotate-file');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create file transports for production
const fileTransports = [];

// Only add file transports in production
if (process.env.NODE_ENV === 'production') {
  // Daily rotating file for all logs
  fileTransports.push(
    new winston.transports.DailyRotateFile({
      filename: path.join('logs', 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'info'
    })
  );
  
  // Separate file for errors
  fileTransports.push(
    new winston.transports.DailyRotateFile({
      filename: path.join('logs', 'errors-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'error'
    })
  );
}

// Configure logger with appropriate transports based on environment
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'recovery-office-api' },
  transports: [
    // Console transport for all environments
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          // Format console output for better readability
          const metaString = Object.keys(meta).length 
            ? `\n${JSON.stringify(meta, null, 2)}` 
            : '';
            
          return `${timestamp} [${level}]: ${
            typeof message === 'object' ? JSON.stringify(message) : message
          }${metaString}`;
        })
      )
    }),
    // Add file transports for production
    ...fileTransports
  ]
});

// Utility function to add request ID to logs
logger.addRequestId = (id) => {
  return {
    info: (message) => logger.info({ ...message, requestId: id }),
    error: (message) => logger.error({ ...message, requestId: id }),
    warn: (message) => logger.warn({ ...message, requestId: id }),
    debug: (message) => logger.debug({ ...message, requestId: id })
  };
};

module.exports = logger; 