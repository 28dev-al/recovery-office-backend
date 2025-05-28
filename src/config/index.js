/**
 * Configuration file for the Recovery Office API
 * Loads environment-specific configuration
 */
const path = require('path');

// Load environment variables if not in production
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
}

// Default configuration for all environments
const defaultConfig = {
  env: process.env.NODE_ENV || 'development',
  server: {
    port: process.env.PORT || 5000,
    host: process.env.HOST || '0.0.0.0'
  },
  database: {
    uri: process.env.MONGODB_URI,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'recovery-office-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    cookieExpires: process.env.JWT_COOKIE_EXPIRES_IN || 7
  },
  cors: {
    origin: [
      'http://localhost:3000',    // React dev server
      'http://127.0.0.1:3000',   // Alternative localhost
      'https://recovery28.netlify.app'  // Production Netlify
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    optionsSuccessStatus: 200
  },
  redis: {
    enabled: process.env.REDIS_ENABLED === 'true',
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
    defaultTTL: process.env.REDIS_DEFAULT_TTL || 3600 // 1 hour
  },
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutes
    max: process.env.RATE_LIMIT_MAX || 100 // 100 requests per window
  },
  authRateLimit: {
    enabled: process.env.AUTH_RATE_LIMIT_ENABLED !== 'false',
    windowMs: process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutes
    max: process.env.AUTH_RATE_LIMIT_MAX || 10 // 10 requests per window
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'dev'
  },
  csp: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"]
    }
  },
  email: {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
    from: process.env.EMAIL_FROM || 'noreply@recovery-office.com'
  }
};

// Environment-specific configurations
const environments = {
  development: {
    database: {
      uri: process.env.MONGODB_URI || 'mongodb+srv://the8dev1:4MvgYz0CtKTy6DUD@recovery-office-cluster.s6qxlbt.mongodb.net/recovery-office?retryWrites=true&w=majority&appName=recovery-office-cluster'
    },
    logging: {
      level: 'debug',
      format: 'dev'
    }
  },
  
  test: {
    database: {
      uri: process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/recovery-office-test',
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        autoIndex: false, // Don't build indexes for test
        serverSelectionTimeoutMS: 5000, // Lower timeout for tests
        socketTimeoutMS: 45000
      }
    },
    jwt: {
      secret: 'test-secret-key'
    },
    redis: {
      enabled: false
    },
    rateLimit: {
      enabled: false
    },
    authRateLimit: {
      enabled: false
    },
    logging: {
      level: process.env.TEST_LOG_LEVEL || 'error'
    }
  },
  
  production: {
    logging: {
      level: 'info',
      format: 'combined'
    }
  }
};

// Get environment-specific config
const envConfig = environments[process.env.NODE_ENV] || environments.development;

// Merge with default config (deep merge for nested objects)
const config = {
  ...defaultConfig,
  ...envConfig,
  database: {
    ...defaultConfig.database,
    ...(envConfig.database || {})
  },
  jwt: {
    ...defaultConfig.jwt,
    ...(envConfig.jwt || {})
  },
  logging: {
    ...defaultConfig.logging,
    ...(envConfig.logging || {})
  },
  redis: {
    ...defaultConfig.redis,
    ...(envConfig.redis || {})
  }
};

module.exports = config; 