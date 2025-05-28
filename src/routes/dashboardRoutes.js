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

/**
 * Get all bookings for dashboard table
 * GET /api/dashboard/bookings
 */
router.get('/bookings', async (req, res) => {
  try {
    console.log('[Dashboard API] Fetching all bookings from MongoDB...');

    // Get all bookings with populated client and service data
    const bookings = await Booking.find({})
      .populate('clientId', 'firstName lastName email phone')
      .populate('serviceId', 'name price duration')
      .sort({ createdAt: -1 })
      .exec();

    console.log(`[Dashboard API] Found ${bookings.length} real bookings in database`);

    // Format bookings for dashboard display
    const formattedBookings = bookings.map(booking => ({
      _id: booking._id,
      reference: booking.reference || `BK-${booking._id.toString().slice(-6)}`,
      clientName: booking.clientId ? 
        `${booking.clientId.firstName} ${booking.clientId.lastName}` : 
        'Unknown Client',
      clientEmail: booking.clientId?.email || '',
      serviceName: booking.serviceId?.name || 'Unknown Service',
      servicePrice: booking.serviceId?.price || 0,
      date: booking.date,
      timeSlot: booking.timeSlot,
      status: booking.status || 'pending',
      estimatedValue: booking.estimatedValue || booking.serviceId?.price || 0,
      urgencyLevel: booking.urgencyLevel || 'standard',
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      // Additional fields for dashboard
      clientInfo: {
        name: booking.clientId ? `${booking.clientId.firstName} ${booking.clientId.lastName}` : 'Unknown',
        email: booking.clientId?.email,
        phone: booking.clientId?.phone
      },
      service: {
        name: booking.serviceId?.name,
        price: booking.serviceId?.price,
        duration: booking.serviceId?.duration
      }
    }));

    console.log(`[Dashboard API] Returning ${formattedBookings.length} formatted bookings`);

    res.json({
      status: 'success',
      results: formattedBookings.length,
      data: formattedBookings
    });
  } catch (error) {
    console.error('[Dashboard API] Error fetching bookings:', error);
    logger.error('Dashboard bookings fetch failed', { error: error.message });
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch bookings',
      error: error.message
    });
  }
});

/**
 * Get dashboard analytics and statistics
 * GET /api/dashboard/analytics
 */
router.get('/analytics', async (req, res) => {
  try {
    console.log('[Dashboard API] Calculating real analytics from MongoDB...');

    // Get counts and data in parallel
    const [totalBookings, totalClients, bookings, services] = await Promise.all([
      Booking.countDocuments(),
      Client.countDocuments(),
      Booking.find({}).populate('serviceId', 'price').exec(),
      Service.find({}).exec()
    ]);

    console.log(`[Dashboard API] Analytics data: ${totalBookings} bookings, ${totalClients} clients`);

    // Calculate total revenue from real bookings
    const totalRevenue = bookings.reduce((sum, booking) => {
      return sum + (booking.estimatedValue || booking.serviceId?.price || 0);
    }, 0);

    // Calculate success rate
    const completedBookings = bookings.filter(b => b.status === 'completed').length;
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
    const successfulBookings = completedBookings + confirmedBookings;
    const successRate = totalBookings > 0 ? (successfulBookings / totalBookings) * 100 : 0;

    // Get recent activity from real data
    const recentActivity = bookings
      .slice(0, 5)
      .map(booking => ({
        _id: booking._id,
        type: 'booking_created',
        clientName: booking.clientId ? 'Client' : 'Unknown',
        description: `New booking for ${booking.serviceId?.name || 'service'}`,
        timestamp: booking.createdAt
      }));

    const analytics = {
      totalBookings,
      totalRevenue: Math.round(totalRevenue),
      activeClients: totalClients,
      successRate: Math.round(successRate * 10) / 10,
      recentActivity,
      // Additional metrics
      statusBreakdown: {
        pending: bookings.filter(b => b.status === 'pending').length,
        confirmed: bookings.filter(b => b.status === 'confirmed').length,
        completed: bookings.filter(b => b.status === 'completed').length,
        cancelled: bookings.filter(b => b.status === 'cancelled').length
      },
      averageBookingValue: totalBookings > 0 ? Math.round(totalRevenue / totalBookings) : 0,
      totalServices: services.length
    };

    console.log('[Dashboard API] Real analytics calculated:', analytics);

    res.json({
      status: 'success',
      data: analytics
    });
  } catch (error) {
    console.error('[Dashboard API] Error calculating analytics:', error);
    logger.error('Dashboard analytics calculation failed', { error: error.message });
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to calculate analytics',
      error: error.message
    });
  }
});

/**
 * Get recent activities for dashboard feed
 * GET /api/dashboard/activities
 */
router.get('/activities', async (req, res) => {
  try {
    console.log('[Dashboard API] Fetching recent activities from MongoDB...');

    // Get recent bookings and clients
    const [recentBookings, recentClients] = await Promise.all([
      Booking.find({})
        .populate('clientId', 'firstName lastName')
        .populate('serviceId', 'name')
        .sort({ createdAt: -1 })
        .limit(10)
        .exec(),
      Client.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .exec()
    ]);

    console.log(`[Dashboard API] Found ${recentBookings.length} recent bookings, ${recentClients.length} recent clients`);

    // Create activity feed from real data
    const activities = [
      // Booking activities
      ...recentBookings.map(booking => ({
        _id: `booking-${booking._id}`,
        type: 'booking_created',
        clientName: booking.clientId ? 
          `${booking.clientId.firstName} ${booking.clientId.lastName}` : 
          'Unknown Client',
        description: `New booking for ${booking.serviceId?.name || 'service'}`,
        timestamp: booking.createdAt,
        metadata: {
          bookingId: booking._id,
          serviceName: booking.serviceId?.name,
          status: booking.status
        }
      })),
      // Client registration activities
      ...recentClients.map(client => ({
        _id: `client-${client._id}`,
        type: 'client_registered',
        clientName: `${client.firstName} ${client.lastName}`,
        description: 'New client registered for recovery services',
        timestamp: client.createdAt,
        metadata: {
          clientId: client._id,
          caseType: client.caseType,
          estimatedLoss: client.estimatedLoss
        }
      }))
    ];

    // Sort by timestamp and limit to 15 most recent
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const limitedActivities = activities.slice(0, 15);

    console.log(`[Dashboard API] Returning ${limitedActivities.length} real activities`);

    res.json({
      status: 'success',
      results: limitedActivities.length,
      data: limitedActivities
    });
  } catch (error) {
    console.error('[Dashboard API] Error fetching activities:', error);
    logger.error('Dashboard activities fetch failed', { error: error.message });
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch activities',
      error: error.message
    });
  }
});

/**
 * Get service statistics for dashboard
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
 * Get client statistics for dashboard
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

module.exports = router; 