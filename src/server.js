/**
 * Recovery Office API Server
 * Main application entry point
 */

// Load environment variables first, before any other imports
const dotenv = require('dotenv');
const path = require('path');

// Try to load .env file from multiple possible locations
try {
  const envPaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'backend/.env'),
    path.resolve(process.cwd(), '../.env')
  ];
  
  for (const envPath of envPaths) {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      console.log(`Loaded environment variables from ${envPath}`);
      console.log(`MONGODB_URI: ${process.env.MONGODB_URI ? 'SET' : 'NOT SET'}`);
      console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
      break;
    }
  }
} catch {
  console.warn('Warning: Failed to load .env file, will rely on environment variables');
}

// Now import all other dependencies
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const { setupSwagger } = require('./config/swagger');

// Import configuration
const config = require('./config');

// Import database connection
const DatabaseConnection = require('./config/database');

// Import request middleware
const { addRequestId, logRequest } = require('./middleware/requestMiddleware');

// Import routes
const serviceRoutes = require('./routes/serviceRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const clientRoutes = require('./routes/clientRoutes');
const slotRoutes = require('./routes/slotRoutes');
const authRoutes = require('./routes/authRoutes');
const waitlistRoutes = require('./routes/waitlistRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const testRoutes = require('./routes/testRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

// Import error handlers
const { errorHandler, notFound } = require('./middleware/errorMiddleware');
const logger = require('./utils/logger');

// Initialize Redis if enabled
const redisClient = require('./utils/redisClient');
const cacheMiddleware = require('./middleware/cacheMiddleware');

// Initialize express app
const app = express();

// ===== CRITICAL: COMPREHENSIVE CORS CONFIGURATION (MUST BE FIRST) =====
console.log('🔧 Configuring CORS for cross-origin requests...');

// Enhanced CORS options with comprehensive configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'https://recovery-office-online.netlify.app',
      'https://recovery-office.com',
      'https://www.recovery-office.com'
    ];
    
    console.log(`[CORS] Checking origin: ${origin}`);
    
    if (allowedOrigins.includes(origin)) {
      console.log(`[CORS] ✅ Origin allowed: ${origin}`);
      return callback(null, true);
    } else {
      console.log(`[CORS] ❌ Origin blocked: ${origin}`);
      const corsError = new Error(`CORS: Origin ${origin} not allowed`);
      return callback(corsError, false);
    }
  },
  credentials: true, // Allow cookies and auth headers
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With', 
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
    'X-API-Key'
  ],
  exposedHeaders: [
    'Content-Length',
    'Content-Type',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Headers',
    'Access-Control-Allow-Methods'
  ],
  optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  maxAge: 86400 // 24 hours preflight cache
};

// Apply CORS middleware FIRST - before any other middleware
app.use(cors(corsOptions));

// Enhanced preflight handler for all routes
app.options('*', (req, res) => {
  console.log(`[CORS] OPTIONS preflight request for ${req.path} from origin: ${req.get('Origin')}`);
  
  // Set all necessary CORS headers manually for preflight
  res.header('Access-Control-Allow-Origin', req.get('Origin') || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers', 
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Access-Control-Request-Method, Access-Control-Request-Headers, X-API-Key');
  res.header('Access-Control-Max-Age', '86400');
  
  console.log(`[CORS] ✅ Preflight response sent for ${req.path}`);
  res.status(200).end();
});

// Additional manual CORS headers for all responses
app.use((req, res, next) => {
  const origin = req.get('Origin');
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001', 
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'https://recovery-office-online.netlify.app',
    'https://recovery-office.com',
    'https://www.recovery-office.com'    
  ];
  
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers', 
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Access-Control-Request-Method, Access-Control-Request-Headers, X-API-Key');
  
  next();
});

console.log('✅ CORS configuration complete');
console.log('📋 Allowed origins: http://localhost:3000, http://localhost:3001');
console.log('📋 Allowed methods: GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
console.log('📋 Credentials: Enabled');

// Database connection will be handled in startServer() function

// Request ID middleware - add before any other middleware
app.use(addRequestId);

// Middleware
if (config.env === 'development') {
  app.use(morgan(config.logging.format));
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: config.env === 'production' ? {
    directives: config.csp.directives
  } : false
}));
app.use(mongoSanitize());
app.use(xss());

// Rate limiting
if (!config.rateLimit.enabled === false) {
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use('/api', limiter);
}

// More strict rate limiting for authentication routes
if (!config.authRateLimit.enabled === false) {
  const authLimiter = rateLimit({
    windowMs: config.authRateLimit.windowMs,
    max: config.authRateLimit.max,
    message: 'Too many login attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
}

// Body parser
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Request logging
app.use(logRequest);

// Compression
app.use(compression());

// Request debugging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  console.log('Origin:', req.headers.origin || 'No origin header');
  console.log('User-Agent:', req.headers['user-agent'] || 'No user-agent');
  
  // Log request body for debugging (except for sensitive routes)
  if (req.method !== 'GET' && !req.url.includes('/auth/')) {
    console.log('Request body:', JSON.stringify(req.body, null, 2));
  }
  
  // Log response when it's finished
  const originalSend = res.send;
  res.send = function(data) {
    console.log(`[${timestamp}] Response ${req.method} ${req.url} - Status: ${res.statusCode}`);
    originalSend.call(this, data);
  };
  
  next();
});

// Routes
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/test', testRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Cache clear route (admin only)
const { protect, restrictTo } = require('./middleware/authMiddleware');
app.post('/api/cache/clear',
  protect,
  restrictTo('admin'),
  cacheMiddleware.clearCache()
);

// Swagger API documentation (only in development)
if (config.env === 'development') {
  setupSwagger(app);
}

// ===== CORS TESTING ENDPOINT =====
app.get('/api/cors-test', (req, res) => {
  console.log('[CORS-TEST] Testing CORS configuration');
  console.log(`[CORS-TEST] Origin: ${req.get('Origin')}`);
  console.log(`[CORS-TEST] Method: ${req.method}`);
  console.log(`[CORS-TEST] Headers:`, req.headers);
  
  res.json({
    status: 'success',
    message: 'CORS is working correctly!',
    data: {
      origin: req.get('Origin'),
      method: req.method,
      timestamp: new Date().toISOString(),
      userAgent: req.get('User-Agent'),
      corsHeaders: {
        allowOrigin: res.get('Access-Control-Allow-Origin'),
        allowMethods: res.get('Access-Control-Allow-Methods'),
        allowHeaders: res.get('Access-Control-Allow-Headers'),
        allowCredentials: res.get('Access-Control-Allow-Credentials')
      }
    }
  });
});

// Database connection test endpoint
app.get('/api/db-test', async (req, res) => {
  try {
    // Check if we're connected to MongoDB
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({
        status: 'error',
        message: 'Database not connected',
        readyState: mongoose.connection.readyState
      });
    }
    
    // Get connection stats
    const stats = await mongoose.connection.db.stats();
    
    return res.status(200).json({
      status: 'success',
      message: 'Database connection successful',
      connection: {
        host: mongoose.connection.host,
        name: mongoose.connection.name,
        port: mongoose.connection.port,
        models: Object.keys(mongoose.models)
      },
      stats: {
        collections: stats.collections,
        objects: stats.objects,
        avgObjSize: stats.avgObjSize,
        dataSize: stats.dataSize,
        storageSize: stats.storageSize,
        indexes: stats.indexes,
        indexSize: stats.indexSize
      }
    });
  } catch (error) {
    logger.error('Database test failed', { 
      service: 'recovery-office-api',
      error: error.message 
    });
    
    return res.status(500).json({
      status: 'error',
      message: 'Failed to test database connection',
      error: config.env === 'production' ? 'Internal server error' : error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = DatabaseConnection.getConnectionStatus();
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    environment: process.env.NODE_ENV,
    cluster: 'cluster0.jk9gqg.mongodb.net'
  });
});

// Status endpoint - similar to health but with more system information
app.get('/api/status', async (req, res) => {
  try {
    // Get system information
    const systemInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100,
        limit: '~1536MB' // Typical Node.js memory limit
      },
      uptime: {
        process: Math.floor(process.uptime()),
        system: Math.floor(require('os').uptime())
      }
    };

    // Check database connection
    let databaseStatus = 'connected';
    let databaseInfo = {};
    try {
      await mongoose.connection.db.admin().ping();
      databaseInfo = {
        host: mongoose.connection.host,
        name: mongoose.connection.name,
        readyState: mongoose.connection.readyState,
        models: Object.keys(mongoose.models).length
      };
    } catch (dbError) {
      databaseStatus = 'error';
      databaseInfo = { error: dbError.message };
    }

    // Check Redis connection if enabled
    let redisStatus = 'disabled';
    let redisInfo = {};
    if (config.redis && config.redis.enabled) {
      try {
        await redisClient.ping();
        redisStatus = 'connected';
        redisInfo = { host: config.redis.host, port: config.redis.port };
      } catch (redisError) {
        redisStatus = 'error';
        redisInfo = { error: redisError.message };
      }
    }

    return res.status(200).json({
      status: 'operational',
      service: 'recovery-office-api',
      environment: config.env,
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
      system: systemInfo,
      database: {
        status: databaseStatus,
        ...databaseInfo
      },
      redis: {
        status: redisStatus,
        ...redisInfo
      },
      api: {
        endpoints: [
          '/api/health',
          '/api/status',
          '/api/services',
          '/api/bookings',
          '/api/clients',
          '/api/slots',
          '/api/auth'
        ],
        rateLimit: {
          enabled: !config.rateLimit.enabled === false,
          windowMs: config.rateLimit.windowMs,
          maxRequests: config.rateLimit.max
        }
      }
    });
  } catch (error) {
    logger.error('Status check failed', { 
      service: 'recovery-office-api',
      error: error.message 
    });
    
    return res.status(500).json({
      status: 'error',
      service: 'recovery-office-api',
      message: 'Unable to retrieve system status',
      error: config.env === 'production' ? 'Internal server error' : error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server with database connection
async function startServer() {
  try {
    console.log('🚀 Starting Recovery Office Backend Server...');
    
    // Connect to database first
    await DatabaseConnection.connect();
    
    // Start the server
    const PORT = config.server.port;
    const HOST = config.server.host;
    
    // Only start server if not in test mode (for Jest)
    if (process.env.NODE_ENV !== 'test') {
      app.listen(PORT, HOST, () => {
        console.log('=====================================');
        console.log(`🌐 Recovery Office API Server running on port ${PORT}`);
        console.log(`🌍 Environment: ${config.env}`);
        console.log(`📡 CORS enabled for: ${process.env.ALLOWED_ORIGINS}`);
        console.log(`💾 Database: Connected to MongoDB Atlas`);
        console.log(`🏢 Cluster: cluster0.jk9gqg.mongodb.net`);
        console.log(`📊 Database: recovery-office`);
        console.log('=====================================');
      });
    }
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`, {
    service: 'recovery-office-api',
    error: err
  });
  // Give the server a chance to finish current requests before exiting
  console.error('UNHANDLED REJECTION! Shutting down...');
  // Only exit in non-test environments
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`, {
    service: 'recovery-office-api',
    error: err
  });
  console.error('UNCAUGHT EXCEPTION! Shutting down...');
  // Only exit in non-test environments
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
});

module.exports = app; // For testing 