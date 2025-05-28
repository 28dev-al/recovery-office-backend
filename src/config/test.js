/**
 * Test environment configuration
 */
module.exports = {
  // Environment
  env: 'test',
  
  // Server
  server: {
    port: process.env.TEST_PORT || 5001,
    host: process.env.TEST_HOST || 'localhost'
  },
  
  // Database - uses MongoDB memory server in tests
  database: {
    uri: process.env.TEST_MONGODB_URI,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  
  // Security
  security: {
    jwtSecret: 'test-jwt-secret',
    jwtExpiresIn: '15m',
    jwtRefreshSecret: 'test-jwt-refresh-secret',
    jwtRefreshExpiresIn: '7d',
    adminApiKey: 'test-admin-api-key'
  },
  
  // Rate limiting - disabled for tests
  rateLimit: {
    enabled: false
  },
  
  // Auth rate limiting - disabled for tests
  authRateLimit: {
    enabled: false
  },
  
  // Logging
  logging: {
    level: 'error', // Only log errors in test environment
    format: 'dev'
  },
  
  // CORS - not relevant for tests
  cors: {
    origin: '*'
  },
  
  // Email - use mock for testing
  email: {
    service: 'mock',
    from: 'test@recovery-office.com'
  },
  
  // Redis configuration - disabled for tests, use in-memory mock
  redis: {
    enabled: false,
    url: null,
    defaultTTL: 60 // Short TTL for tests
  }
}; 