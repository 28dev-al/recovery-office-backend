/**
 * Waitlist Routes
 * Endpoints for waitlist management
 */
const express = require('express');
const router = express.Router();
const waitlistController = require('../controllers/waitlistController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const cacheMiddleware = require('../middleware/cacheMiddleware');

/**
 * @route   POST /api/waitlist
 * @desc    Add client to waitlist
 * @access  Public
 */
router.post('/', waitlistController.addToWaitlist);

/**
 * @route   GET /api/waitlist
 * @desc    Get waitlist entries (admin/staff only)
 * @access  Private
 */
router.get(
  '/',
  protect,
  restrictTo('admin', 'staff'),
  cacheMiddleware.cacheResponse('waitlist', 300), // Cache for 5 minutes
  waitlistController.getWaitlist
);

/**
 * @route   POST /api/waitlist/notify/:slotId
 * @desc    Notify clients on waitlist for a specific slot
 * @access  Private/Admin
 */
router.post(
  '/notify/:slotId',
  protect,
  restrictTo('admin'),
  waitlistController.notifyWaitlist
);

/**
 * @route   POST /api/waitlist/process/:waitlistId/:bookingId
 * @desc    Process a waitlist entry when client books
 * @access  Public (but typically called from booking controller)
 */
router.post(
  '/process/:waitlistId/:bookingId',
  waitlistController.processWaitlistBooking
);

/**
 * @route   DELETE /api/waitlist/:id
 * @desc    Cancel a waitlist entry
 * @access  Private
 */
router.delete(
  '/:id',
  protect,
  cacheMiddleware.invalidateCache(['waitlist:*']),
  waitlistController.cancelWaitlistEntry
);

/**
 * @route   POST /api/waitlist/cleanup
 * @desc    Clean up expired waitlist entries
 * @access  Private/Admin
 */
router.post(
  '/cleanup',
  protect,
  restrictTo('admin'),
  cacheMiddleware.invalidateCache(['waitlist:*']),
  waitlistController.cleanupExpiredEntries
);

module.exports = router; 