const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { protect, restrictTo, apiKeyAuth } = require('../middleware/authMiddleware');
const cacheMiddleware = require('../middleware/cacheMiddleware');

/**
 * Common middleware for admin routes - supports both JWT and legacy API key
 */
const adminAuth = [
  (req, res, next) => {
    // Try JWT first, if it fails, try API key
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      return protect(req, res, next);
    }
    
    // If no Bearer token, try API key
    return apiKeyAuth(req, res, next);
  },
  // If using JWT auth, check for admin role
  (req, res, next) => {
    if (req.user) {
      return restrictTo('admin')(req, res, next);
    }
    
    // If using API key auth, it's already validated
    next();
  }
];

/**
 * @route   GET /api/services
 * @desc    Get all services
 * @access  Public
 */
router.get(
  '/', 
  cacheMiddleware.cacheResponse('services', 86400), // Cache for 24 hours
  serviceController.getAllServices
);

/**
 * @route   GET /api/services/:id
 * @desc    Get service by ID
 * @access  Public
 */
router.get(
  '/:id', 
  cacheMiddleware.cacheResponse('services', 86400), // Cache for 24 hours
  serviceController.getServiceById
);

/**
 * @route   POST /api/services
 * @desc    Create a new service
 * @access  Private/Admin
 */
router.post(
  '/', 
  adminAuth, 
  cacheMiddleware.invalidateCache(['services:*']), // Invalidate services cache on create
  serviceController.createService
);

/**
 * @route   PUT /api/services/:id
 * @desc    Update a service
 * @access  Private/Admin
 */
router.put(
  '/:id', 
  adminAuth, 
  cacheMiddleware.invalidateCache(['services:*']), // Invalidate services cache on update
  serviceController.updateService
);

/**
 * @route   DELETE /api/services/:id
 * @desc    Delete a service
 * @access  Private/Admin
 */
router.delete(
  '/:id', 
  adminAuth, 
  cacheMiddleware.invalidateCache(['services:*']), // Invalidate services cache on delete
  serviceController.deleteService
);

/**
 * @route   GET /api/services/category/:category
 * @desc    Get services by category
 * @access  Public
 */
router.get('/category/:category', serviceController.getServicesByCategory);

/**
 * @route   GET /api/services/categories
 * @desc    Get all service categories
 * @access  Public
 */
router.get(
  '/categories', 
  cacheMiddleware.cacheResponse('categories', 86400), // Cache for 24 hours
  serviceController.getServiceCategories
);

// GET /api/services - Return services from MongoDB exactly as stored
router.get('/', async (req, res) => {
  try {
    console.log('[Services API] GET /api/services - Fetching from MongoDB Atlas');
    
    // Connect to your existing MongoDB collection
    const db = req.app.locals.db || global.db;
    
    if (!db) {
      throw new Error('Database connection not available');
    }
    
    const services = await db.collection('services').find({ isActive: true }).toArray();

    console.log(`[Services API] Found ${services.length} services in MongoDB:`, 
      services.map(s => ({ _id: s._id, name: s.name }))
    );

    // CRITICAL FIX: Return services array directly (not wrapped in object)
    res.json(services);
  } catch (error) {
    console.error('[Services API] MongoDB error:', error);
    res.status(500).json({
      error: 'Failed to fetch services from database',
      message: error.message
    });
  }
});

module.exports = router; 