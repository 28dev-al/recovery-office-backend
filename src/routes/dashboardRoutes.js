/**
 * Dashboard API Routes
 * Provides real-time data from MongoDB for the Recovery Office admin dashboard
 */

const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Client = require('../models/Client');
const Service = require('../models/Service');
const logger = require('../utils/logger');
const dashboardController = require('../controllers/dashboardController');

/**
 * Get dashboard analytics and statistics (Main endpoint)
 * GET /api/dashboard/analytics
 */
router.get('/analytics', dashboardController.getOverviewStats);

/**
 * Get all bookings for dashboard table
 * GET /api/dashboard/bookings
 */
router.get('/bookings', dashboardController.getRecentBookings);

/**
 * Get recent activities for dashboard feed
 * GET /api/dashboard/activities
 */
router.get('/activities', dashboardController.getRecentActivities);

/**
 * Get analytics data for charts
 * GET /api/dashboard/analytics/dashboard
 */
router.get('/analytics/dashboard', dashboardController.getAnalyticsData);

/**
 * Get service popularity data
 * GET /api/dashboard/analytics/service-popularity
 */
router.get('/analytics/service-popularity', dashboardController.getServicePopularity);

/**
 * Get service statistics for dashboard (Legacy endpoint - using Mongoose)
 * GET /api/dashboard/service-stats
 */
router.get('/service-stats', async (req, res) => {
  try {
    console.log('[Dashboard API] Calculating service statistics...');

    const [services, bookings] = await Promise.all([
      Service.find({}).exec(),
      Booking.find({}).populate('serviceId').exec()
    ]);

    // Calculate stats per service
    const serviceStats = services.map(service => {
      const serviceBookings = bookings.filter(b => 
        b.serviceId && b.serviceId._id.toString() === service._id.toString()
      );
      
      const revenue = serviceBookings.reduce((sum, booking) => 
        sum + (booking.estimatedValue || service.price || 0), 0
      );

      return {
        _id: service._id,
        name: service.name,
        price: service.price,
        bookingCount: serviceBookings.length,
        revenue: revenue,
        averageValue: serviceBookings.length > 0 ? revenue / serviceBookings.length : 0,
        isActive: service.isActive !== false
      };
    });

    console.log(`[Dashboard API] Service stats calculated for ${serviceStats.length} services`);

    res.json({
      status: 'success',
      data: serviceStats
    });
  } catch (error) {
    console.error('[Dashboard API] Error calculating service stats:', error);
    logger.error('Dashboard service stats calculation failed', { error: error.message });
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to calculate service statistics',
      error: error.message
    });
  }
});

/**
 * Get client statistics for dashboard (Legacy endpoint - using Mongoose)
 * GET /api/dashboard/client-stats
 */
router.get('/client-stats', async (req, res) => {
  try {
    console.log('[Dashboard API] Calculating client statistics...');

    const clients = await Client.find({}).exec();
    
    // Calculate client metrics
    const totalClients = clients.length;
    const totalEstimatedLoss = clients.reduce((sum, client) => sum + (client.estimatedLoss || 0), 0);
    const averageLoss = totalClients > 0 ? totalEstimatedLoss / totalClients : 0;
    
    // Group by case type
    const caseTypeBreakdown = clients.reduce((acc, client) => {
      const caseType = client.caseType || 'unknown';
      acc[caseType] = (acc[caseType] || 0) + 1;
      return acc;
    }, {});

    // Group by urgency level
    const urgencyBreakdown = clients.reduce((acc, client) => {
      const urgency = client.urgencyLevel || 'standard';
      acc[urgency] = (acc[urgency] || 0) + 1;
      return acc;
    }, {});

    const clientStats = {
      totalClients,
      totalEstimatedLoss: Math.round(totalEstimatedLoss),
      averageLoss: Math.round(averageLoss),
      caseTypeBreakdown,
      urgencyBreakdown,
      recentClients: clients
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
        .map(client => ({
          _id: client._id,
          name: `${client.firstName} ${client.lastName}`,
          caseType: client.caseType,
          estimatedLoss: client.estimatedLoss,
          createdAt: client.createdAt
        }))
    };

    console.log(`[Dashboard API] Client stats calculated: ${totalClients} total clients`);

    res.json({
      status: 'success',
      data: clientStats
    });
  } catch (error) {
    console.error('[Dashboard API] Error calculating client stats:', error);
    logger.error('Dashboard client stats calculation failed', { error: error.message });
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to calculate client statistics',
      error: error.message
    });
  }
});

/**
 * Health check for dashboard
 * GET /api/dashboard/health
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'Dashboard API is healthy',
    timestamp: new Date().toISOString(),
    endpoints: [
      '/api/dashboard/analytics',
      '/api/dashboard/bookings', 
      '/api/dashboard/activities',
      '/api/dashboard/analytics/dashboard',
      '/api/dashboard/analytics/service-popularity',
      '/api/dashboard/service-stats',
      '/api/dashboard/client-stats'
    ]
  });
});

module.exports = router; 