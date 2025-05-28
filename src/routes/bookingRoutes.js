const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { validateBooking, validateBookingUpdate } = require('../middleware/validationMiddleware');
const authMiddleware = require('../middleware/authMiddleware');

// Booking routes with controller-based implementation
router.get('/', bookingController.getAllBookings);
router.get('/:id', bookingController.getBookingById);
router.post('/', validateBooking, bookingController.createBooking);
router.put('/:id', validateBookingUpdate, bookingController.updateBooking);
router.delete('/:id', authMiddleware.requireAuth, bookingController.deleteBooking);

// Booking status routes
router.patch('/:id/status', authMiddleware.requireAuth, bookingController.updateBookingStatus);
router.get('/status/:status', bookingController.getBookingsByStatus);

// Booking analytics routes
router.get('/analytics/summary', authMiddleware.requireAuth, bookingController.getBookingsSummary);
router.get('/analytics/revenue', authMiddleware.requireAuth, bookingController.getRevenueAnalytics);

// Date-based booking routes
router.get('/date/:date', bookingController.getBookingsByDate);
router.get('/date-range/:startDate/:endDate', bookingController.getBookingsByDateRange);

// Service-specific booking routes
router.get('/service/:serviceId', bookingController.getBookingsByService);

// Export router
module.exports = router;
