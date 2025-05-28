const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { validateBooking } = require('../middleware/validationMiddleware');
const { protect } = require('../middleware/authMiddleware');

// ✅ WORKING ROUTES - Only using functions that actually exist

// Public booking routes
router.get('/', bookingController.getAllBookings);
router.get('/:id', bookingController.getBookingById);
router.post('/', validateBooking, bookingController.createBooking);

// Protected routes (require authentication)
router.put('/:id', protect, bookingController.updateBooking);
router.post('/:id/cancel', protect, bookingController.cancelBooking);

// Client-specific routes
router.get('/client/:clientId', bookingController.getClientBookings);

// Reference lookup route
router.get('/reference/:reference', bookingController.getBookingByReference);

module.exports = router;
