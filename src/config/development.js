/**
 * Development environment configuration
 */
module.exports = {
  // Environment
  env: 'development',
  
  // Server
  server: {
    port: process.env.PORT || 5000,
    host: process.env.HOST || 'localhost'
  },
  
  // Database
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/recovery-office-dev',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  
  // Security
  security: {
    jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-jwt-refresh-secret-change-in-production',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    adminApiKey: process.env.ADMIN_API_KEY || 'dev-api-key-change-in-production'
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // 100 requests per IP
  },
  
  // Auth rate limiting
  authRateLimit: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10 // 10 requests per IP
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
    format: 'dev'
  },
  
  // CORS
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  
  // Email (for development we use console logging)
  email: {
    service: 'console',
    from: 'dev@recovery-office.com'
  },
  
  // Redis configuration
  redis: {
    enabled: process.env.REDIS_ENABLED === 'true' || false,
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    defaultTTL: 3600 // 1 hour in seconds
  }
}; 