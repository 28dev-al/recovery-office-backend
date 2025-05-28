const express = require('express');
const router = express.Router();
const slotController = require('../controllers/slotController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const cacheMiddleware = require('../middleware/cacheMiddleware');

/**
 * @route   GET /api/slots
 * @desc    Get available slots (filtered by date, service)
 * @access  Public
 */
router.get(
  '/',
  cacheMiddleware.cacheResponse('slots', 300), // Cache for 5 minutes, shorter TTL as this changes frequently
  slotController.getAvailableSlots
);

/**
 * @route   GET /api/slots/:id
 * @desc    Get slot by ID
 * @access  Public
 */
router.get(
  '/:id',
  cacheMiddleware.cacheResponse('slots', 300), // Cache for 5 minutes
  slotController.getSlotById
);

/**
 * @route   POST /api/slots/generate
 * @desc    Generate slots for a date range
 * @access  Private/Admin
 */
router.post(
  '/generate',
  protect,
  restrictTo('admin'),
  cacheMiddleware.invalidateCache(['slots:*']), // Invalidate all slot cache
  slotController.generateSlots
);

/**
 * @route   DELETE /api/slots/clear
 * @desc    Clear all slots for a date range
 * @access  Private/Admin
 */
router.delete(
  '/clear',
  protect,
  restrictTo('admin'),
  cacheMiddleware.invalidateCache(['slots:*']), // Invalidate all slot cache
  slotController.clearSlots
);

/**
 * @route   PATCH /api/slots/:id
 * @desc    Update slot availability
 * @access  Private/Admin
 */
router.patch(
  '/:id',
  protect,
  restrictTo('admin'),
  cacheMiddleware.invalidateCache(['slots:*']), // Invalidate all slot cache
  slotController.updateSlot
);

module.exports = router; 