/**
 * Analytics Routes
 * Endpoints for analytics and reporting
 */
const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const cacheMiddleware = require('../middleware/cacheMiddleware');

// All routes in this file are restricted to admin users
router.use(protect);
router.use(restrictTo('admin'));

/**
 * @route   GET /api/analytics/dashboard
 * @desc    Get dashboard data (combined metrics)
 * @access  Private/Admin
 */
router.get(
  '/dashboard',
  cacheMiddleware.cacheResponse('analytics-dashboard', 300), // Cache for 5 minutes
  analyticsController.getDashboardData
);

/**
 * @route   GET /api/analytics/bookings
 * @desc    Get booking statistics
 * @access  Private/Admin
 */
router.get(
  '/bookings',
  cacheMiddleware.cacheResponse('analytics-bookings', 300),
  analyticsController.getBookingStats
);

/**
 * @route   GET /api/analytics/services
 * @desc    Get service popularity metrics
 * @access  Private/Admin
 */
router.get(
  '/services',
  cacheMiddleware.cacheResponse('analytics-services', 300),
  analyticsController.getServicePopularity
);

/**
 * @route   GET /api/analytics/clients
 * @desc    Get client acquisition metrics
 * @access  Private/Admin
 */
router.get(
  '/clients',
  cacheMiddleware.cacheResponse('analytics-clients', 300),
  analyticsController.getClientAcquisition
);

/**
 * @route   GET /api/analytics/waitlist
 * @desc    Get waitlist metrics
 * @access  Private/Admin
 */
router.get(
  '/waitlist',
  cacheMiddleware.cacheResponse('analytics-waitlist', 300),
  analyticsController.getWaitlistMetrics
);

/**
 * @route   GET /api/analytics/export/:reportType/:format
 * @desc    Export a report in the specified format
 * @access  Private/Admin
 */
router.get(
  '/export/:reportType/:format',
  analyticsController.exportReport
);

/**
 * @route   POST /api/analytics/schedule-report
 * @desc    Schedule a report to be sent via email
 * @access  Private/Admin
 */
router.post(
  '/schedule-report',
  analyticsController.scheduleReport
);

module.exports = router; 