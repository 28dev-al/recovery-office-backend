/**
 * Test Routes for Recovery Office API
 * 
 * Provides debugging and testing endpoints for service data validation
 */

const express = require('express');
const router = express.Router();
const Service = require('../models/Service');
const Client = require('../models/Client');
const Booking = require('../models/Booking');
const mongoose = require('mongoose');

// GET /api/test/services - Debug service data
router.get('/services', async (req, res) => {
  try {
    console.log('[Test Routes] Fetching services for debugging...');
    
    const services = await Service.find({}).lean();

    const serviceDebugInfo = services.map(service => ({
      _id: service._id,
      id: service._id.toString(),
      name: service.name,
      description: service.description,
      price: service.price,
      duration: service.duration,
      isActive: service.isActive,
      category: service.category,
      isValidObjectId: /^[0-9a-fA-F]{24}$/.test(service._id.toString()),
      idLength: service._id.toString().length,
      objectIdType: typeof service._id,
      rawObjectId: service._id
    }));

    console.log(`[Test Routes] Found ${services.length} services`);
    console.log('[Test Routes] Service ObjectIds:', serviceDebugInfo.map(s => ({ name: s.name, id: s.id })));

    res.json({
      status: 'success',
      data: serviceDebugInfo,
      totalServices: services.length,
      allValidObjectIds: serviceDebugInfo.every(s => s.isValidObjectId),
      summary: {
        totalServices: services.length,
        validObjectIds: serviceDebugInfo.filter(s => s.isValidObjectId).length,
        invalidObjectIds: serviceDebugInfo.filter(s => !s.isValidObjectId).length
      },
      message: 'Service debug information retrieved successfully'
    });
  } catch (error) {
    console.error('[Test Routes] Error fetching service debug info:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve service debug info',
      error: error.message
    });
  }
});

// GET /api/test/clients - Debug client data
router.get('/clients', async (req, res) => {
  try {
    const clients = await Client.find({}).lean();

    const clientDebugInfo = clients.map(client => ({
      _id: client._id,
      id: client._id.toString(),
      name: `${client.firstName} ${client.lastName}`,
      email: client.email,
      isValidObjectId: /^[0-9a-fA-F]{24}$/.test(client._id.toString()),
      idLength: client._id.toString().length,
      createdAt: client.createdAt
    }));

    res.json({
      status: 'success',
      data: clientDebugInfo,
      totalClients: clients.length,
      message: 'Client debug information retrieved successfully'
    });
  } catch (error) {
    console.error('[Test Routes] Error fetching client debug info:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve client debug info',
      error: error.message
    });
  }
});

// GET /api/test/bookings - Debug booking data
router.get('/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find({})
      .populate('clientId', 'firstName lastName email')
      .populate('serviceId', 'name')
      .lean();

    const bookingDebugInfo = bookings.map(booking => ({
      _id: booking._id,
      id: booking._id.toString(),
      clientId: booking.clientId,
      serviceId: booking.serviceId,
      serviceName: booking.serviceName,
      date: booking.date,
      status: booking.status,
      reference: booking.reference,
      isValidBookingId: /^[0-9a-fA-F]{24}$/.test(booking._id.toString()),
      isValidClientId: mongoose.Types.ObjectId.isValid(booking.clientId),
      isValidServiceId: mongoose.Types.ObjectId.isValid(booking.serviceId),
      createdAt: booking.createdAt
    }));

    res.json({
      status: 'success',
      data: bookingDebugInfo,
      totalBookings: bookings.length,
      message: 'Booking debug information retrieved successfully'
    });
  } catch (error) {
    console.error('[Test Routes] Error fetching booking debug info:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve booking debug info',
      error: error.message
    });
  }
});

// POST /api/test/validate-ids - Test ObjectId validation
router.post('/validate-ids', async (req, res) => {
  try {
    const { serviceId, clientId } = req.body;

    console.log('[Test Routes] Validating IDs:', { serviceId, clientId });

    const validationResults = {
      serviceId: {
        value: serviceId,
        type: typeof serviceId,
        length: serviceId?.length,
        isValidFormat: mongoose.Types.ObjectId.isValid(serviceId),
        isValidRegex: /^[0-9a-fA-F]{24}$/.test(serviceId || ''),
        existsInDatabase: false
      },
      clientId: {
        value: clientId,
        type: typeof clientId,
        length: clientId?.length,
        isValidFormat: mongoose.Types.ObjectId.isValid(clientId),
        isValidRegex: /^[0-9a-fA-F]{24}$/.test(clientId || ''),
        existsInDatabase: false
      }
    };

    // Check if service exists
    if (validationResults.serviceId.isValidFormat) {
      const serviceExists = await Service.findById(serviceId);
      validationResults.serviceId.existsInDatabase = !!serviceExists;
      if (serviceExists) {
        validationResults.serviceId.serviceName = serviceExists.name;
      }
    }

    // Check if client exists
    if (validationResults.clientId.isValidFormat) {
      const clientExists = await Client.findById(clientId);
      validationResults.clientId.existsInDatabase = !!clientExists;
      if (clientExists) {
        validationResults.clientId.clientName = `${clientExists.firstName} ${clientExists.lastName}`;
      }
    }

    const allValid = validationResults.serviceId.isValidFormat && 
                     validationResults.serviceId.existsInDatabase &&
                     validationResults.clientId.isValidFormat && 
                     validationResults.clientId.existsInDatabase;

    res.json({
      status: 'success',
      data: validationResults,
      allValid,
      canCreateBooking: allValid,
      message: 'ID validation completed'
    });
  } catch (error) {
    console.error('[Test Routes] Error validating IDs:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to validate IDs',
      error: error.message
    });
  }
});

// GET /api/test/database-stats - Get database statistics
router.get('/database-stats', async (req, res) => {
  try {
    const [serviceCount, clientCount, bookingCount] = await Promise.all([
      Service.countDocuments(),
      Client.countDocuments(),
      Booking.countDocuments()
    ]);

    const stats = {
      services: serviceCount,
      clients: clientCount,
      bookings: bookingCount,
      total: serviceCount + clientCount + bookingCount
    };

    res.json({
      status: 'success',
      data: stats,
      message: 'Database statistics retrieved successfully'
    });
  } catch (error) {
    console.error('[Test Routes] Error fetching database stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve database statistics',
      error: error.message
    });
  }
});

module.exports = router; 