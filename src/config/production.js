/**
 * Production environment configuration
 */
module.exports = {
  // Environment
  env: 'production',
  
  // Server
  server: {
    port: process.env.PORT || 5000,
    host: process.env.HOST || '0.0.0.0'
  },
  
  // Database
  database: {
    uri: process.env.MONGODB_URI,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      autoIndex: false // Don't build indexes in production
    }
  },
  
  // Security
  security: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m', // Shorter token lifetime in production
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    adminApiKey: process.env.ADMIN_API_KEY
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // 100 requests per IP
  },
  
  // Auth rate limiting (more strict in production)
  authRateLimit: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5 // 5 requests per IP
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'combined'
  },
  
  // CORS
  cors: {
    origin: process.env.FRONTEND_URL || 'https://recovery28.netlify.app',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  
  // Email
  email: {
    service: process.env.EMAIL_SERVICE || 'sendgrid',
    from: process.env.EMAIL_FROM || 'noreply@recovery-office.com',
    apiKey: process.env.EMAIL_API_KEY
  },
  
  // Content Security Policy
  csp: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  
  // Redis configuration
  redis: {
    enabled: process.env.REDIS_ENABLED === 'true' || true, // Enabled by default in production
    url: process.env.REDIS_URL,
    defaultTTL: parseInt(process.env.REDIS_TTL || '3600'),
    // Additional production settings
    tlsEnabled: process.env.REDIS_TLS_ENABLED === 'true' || false,
    password: process.env.REDIS_PASSWORD
  }
}; 