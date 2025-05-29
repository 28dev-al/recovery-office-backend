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
 * Dashboard controller-based routes (using Mongoose models)
 */
router.get('/analytics', dashboardController.getOverviewStats);
router.get('/bookings', dashboardController.getRecentBookings);
router.get('/activities', dashboardController.getRecentActivities);
router.get('/analytics/dashboard', dashboardController.getAnalyticsData);
router.get('/analytics/service-popularity', dashboardController.getServicePopularity);

/**
 * Additional dashboard routes
 */

// GET /api/dashboard/clients - Controller-based clients data with population
router.get('/clients', dashboardController.getClients);

// GET /api/dashboard/stream - Server-Sent Events endpoint
router.get('/stream', (req, res) => {
  // Set headers for Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initial connection message
  res.write('data: {"type":"connected","message":"Dashboard stream connected"}\n\n');

  // Keep connection alive with periodic heartbeat
  const heartbeatInterval = setInterval(() => {
    res.write(`data: {"type":"heartbeat","timestamp":"${new Date().toISOString()}"}\n\n`);
  }, 30000);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    console.log('[Dashboard Stream] Client disconnected');
    res.end();
  });
});

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'Dashboard API is healthy and using Mongoose controllers',
    timestamp: new Date().toISOString(),
    endpoints: [
      '/api/dashboard/analytics',
      '/api/dashboard/bookings',
      '/api/dashboard/activities',
      '/api/dashboard/analytics/dashboard',
      '/api/dashboard/analytics/service-popularity',
      '/api/dashboard/clients',
      '/api/dashboard/stream'
    ]
  });
});

module.exports = router; 