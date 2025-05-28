const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { validateBooking } = require('../middleware/validationMiddleware');
const { protect, restrictTo, apiKeyAuth } = require('../middleware/authMiddleware');
const { ObjectId } = require('mongodb');

/**
 * @route   POST /api/bookings
 * @desc    Create a new booking
 * @access  Public
 */
router.post('/', validateBooking, bookingController.createBooking);

/**
 * @route   GET /api/bookings/:id
 * @desc    Get booking by ID
 * @access  Public for own booking (with validation), Private for admin/staff
 */
router.get('/:id', bookingController.getBookingById);

/**
 * @route   PATCH /api/bookings/:id
 * @desc    Update booking
 * @access  Public for own booking (with validation), Private for admin/staff
 */
router.patch('/:id', bookingController.updateBooking);

/**
 * @route   DELETE /api/bookings/:id
 * @desc    Cancel booking
 * @access  Public for own booking (with validation), Private for admin/staff
 */
router.delete('/:id', bookingController.cancelBooking);

/**
 * @route   GET /api/bookings
 * @desc    Get all bookings (admin)
 * @access  Private/Admin
 */
// Support both legacy API key auth and new JWT auth
router.get('/',
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
  },
  bookingController.getAllBookings
);

// POST /api/clients - Create new client
router.post('/clients', async (req, res) => {
  try {
    console.log('[Clients API] POST /api/clients - Creating new client');
    console.log('[Clients API] Request body:', req.body);

    const db = req.app.locals.db || global.db;
    const clientData = {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('clients').insertOne(clientData);

    console.log('[Clients API] Client created with ID:', result.insertedId);

    res.status(201).json({
      success: true,
      data: {
        _id: result.insertedId,
        ...clientData
      }
    });
  } catch (error) {
    console.error('[Clients API] Error creating client:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create client',
      message: error.message
    });
  }
});

// POST /api/bookings - Create new booking
router.post('/bookings', async (req, res) => {
  try {
    console.log('[Bookings API] POST /api/bookings - Creating new booking');
    console.log('[Bookings API] Request body:', req.body);

    const db = req.app.locals.db || global.db;

    // Generate booking reference
    const bookingReference = 'RO-' + Math.random().toString(36).substr(2, 8).toUpperCase();

    const bookingData = {
      ...req.body,
      reference: bookingReference,
      status: 'confirmed',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('bookings').insertOne(bookingData);

    console.log('[Bookings API] Booking created with ID:', result.insertedId);
    console.log('[Bookings API] Booking reference:', bookingReference);

    res.status(201).json({
      success: true,
      data: {
        _id: result.insertedId,
        reference: bookingReference,
        ...bookingData
      }
    });
  } catch (error) {
    console.error('[Bookings API] Error creating booking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create booking',
      message: error.message
    });
  }
});

// GET /api/bookings/:id - Get booking by ID
router.get('/bookings/:id', async (req, res) => {
  try {
    const db = req.app.locals.db || global.db;
    const booking = await db.collection('bookings').findOne({
      _id: new ObjectId(req.params.id)
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('[Bookings API] Error fetching booking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch booking',
      message: error.message
    });
  }
});

module.exports = router; 