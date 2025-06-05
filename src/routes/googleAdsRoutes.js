const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// Import Google Ads controller and validation
const googleAdsController = require('../controllers/googleAdsController');
const {
  validateGoogleAdsLead,
  validateGoogleAdsLeadUpdate,
  validateGoogleAdsLeadSearch,
  validateRateLimit,
  sanitizeInput
} = require('../middleware/googleAdsValidation');

// Import authentication middleware for protected routes
const { protect, restrictTo } = require('../middleware/authMiddleware');

// ===== RATE LIMITING CONFIGURATION =====

// Strict rate limiting for lead submission endpoint
const leadSubmissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Maximum 5 submissions per IP per hour
  message: {
    success: false,
    message: 'Too many lead submissions from this IP address. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false
});

// More lenient rate limiting for dashboard/admin routes
const dashboardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Maximum 100 requests per IP per 15 minutes
  message: {
    success: false,
    message: 'Too many dashboard requests. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ===== PUBLIC ROUTES (Lead Submission) =====

/**
 * @route   POST /api/google-ads/leads
 * @desc    Submit a new Google Ads lead from landing page
 * @access  Public (with rate limiting)
 * @security Rate limited to 5 submissions per IP per hour
 */
router.post('/leads',
  leadSubmissionLimiter,        // Rate limiting
  sanitizeInput,                // XSS protection
  validateRateLimit,            // Custom duplicate/spam checking
  validateGoogleAdsLead,        // Validation
  googleAdsController.createLead
);

// ===== PROTECTED ROUTES (Admin/Staff Only) =====

/**
 * @route   GET /api/google-ads/leads
 * @desc    Get all Google Ads leads with filtering and pagination
 * @access  Private (Admin/Staff)
 */
router.get('/leads',
  dashboardLimiter,
  protect,
  restrictTo('admin', 'staff'),
  validateGoogleAdsLeadSearch,
  googleAdsController.getLeads
);

/**
 * @route   GET /api/google-ads/leads/stats
 * @desc    Get Google Ads lead statistics
 * @access  Private (Admin/Staff)
 */
router.get('/leads/stats',
  dashboardLimiter,
  protect,
  restrictTo('admin', 'staff'),
  googleAdsController.getLeadStats
);

/**
 * @route   GET /api/google-ads/leads/:id
 * @desc    Get a specific Google Ads lead by ID
 * @access  Private (Admin/Staff)
 */
router.get('/leads/:id',
  dashboardLimiter,
  protect,
  restrictTo('admin', 'staff'),
  googleAdsController.getLeadById
);

/**
 * @route   PATCH /api/google-ads/leads/:id
 * @desc    Update a Google Ads lead (status, priority, notes, etc.)
 * @access  Private (Admin/Staff)
 */
router.patch('/leads/:id',
  dashboardLimiter,
  protect,
  restrictTo('admin', 'staff'),
  sanitizeInput,
  validateGoogleAdsLeadUpdate,
  googleAdsController.updateLead
);

/**
 * @route   GET /api/google-ads/leads/reference/:reference
 * @desc    Get a Google Ads lead by reference number
 * @access  Private (Admin/Staff)
 */
router.get('/leads/reference/:reference',
  dashboardLimiter,
  protect,
  restrictTo('admin', 'staff'),
  googleAdsController.getLeadByReference
);

// ===== UTILITY ROUTES =====

/**
 * @route   GET /api/google-ads/test
 * @desc    Test endpoint for Google Ads API connectivity
 * @access  Public
 */
router.get('/test', (req, res) => {
  console.log('[Google Ads Routes] Test endpoint accessed');
  console.log('[Google Ads Routes] Origin:', req.get('Origin'));
  console.log('[Google Ads Routes] User-Agent:', req.get('User-Agent'));
  console.log('[Google Ads Routes] IP:', req.ip || req.connection.remoteAddress);

  res.json({
    success: true,
    message: 'Google Ads API is working correctly!',
    data: {
      timestamp: new Date().toISOString(),
      origin: req.get('Origin'),
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip || req.connection.remoteAddress,
      endpoint: '/api/google-ads/test',
      availableEndpoints: [
        'POST /api/google-ads/leads',
        'GET /api/google-ads/leads',
        'GET /api/google-ads/leads/stats',
        'GET /api/google-ads/leads/:id',
        'PATCH /api/google-ads/leads/:id',
        'GET /api/google-ads/leads/reference/:reference'
      ]
    }
  });
});

/**
 * @route   GET /api/google-ads/health
 * @desc    Health check for Google Ads API endpoints
 * @access  Public
 */
router.get('/health', async (req, res) => {
  try {
    const GoogleAdsLead = require('../models/GoogleAdsLead');
    
    // Test database connectivity
    const leadCount = await GoogleAdsLead.countDocuments();
    
    res.json({
      success: true,
      message: 'Google Ads API is healthy',
      data: {
        timestamp: new Date().toISOString(),
        database: {
          status: 'connected',
          totalLeads: leadCount
        },
        endpoints: {
          submission: 'POST /api/google-ads/leads',
          dashboard: 'GET /api/google-ads/leads',
          statistics: 'GET /api/google-ads/leads/stats'
        },
        rateLimit: {
          submissionLimit: '5 per hour per IP',
          dashboardLimit: '100 per 15 minutes per IP'
        }
      }
    });
  } catch (error) {
    console.error('[Google Ads Routes] Health check failed:', error);
    
    res.status(500).json({
      success: false,
      message: 'Google Ads API health check failed',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
});

// ===== ERROR HANDLING =====

// Handle 404 for non-existent Google Ads routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Google Ads API endpoint not found: ${req.method} ${req.originalUrl}`,
    code: 'ENDPOINT_NOT_FOUND',
    availableEndpoints: [
      'POST /api/google-ads/leads',
      'GET /api/google-ads/leads',
      'GET /api/google-ads/leads/stats',
      'GET /api/google-ads/leads/:id',
      'PATCH /api/google-ads/leads/:id',
      'GET /api/google-ads/leads/reference/:reference',
      'GET /api/google-ads/test',
      'GET /api/google-ads/health'
    ]
  });
});

module.exports = router; 