const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const TimeSlot = require('../models/TimeSlot');
const Service = require('../models/Service');
const Client = require('../models/Client');
const emailService = require('../utils/emailService');
const recurrenceService = require('../services/recurrenceService');
const { NotFoundError } = require('../utils/AppError');
const logger = require('../utils/logger');

/**
 * Create a new booking
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with booking details
 */
exports.createBooking = async (req, res, _next) => {
  try {
    console.log('[Booking Controller] === BOOKING CREATION DEBUG START ===');
    console.log('[Booking Controller] Request body:', req.body);
    console.log('[Booking Controller] Request headers:', req.headers);

    const {
      clientId,
      serviceId,
      serviceName,
      date,
      timeSlot,
      notes,
      urgencyLevel,
      estimatedValue,
      status,
      isRecurring,
      recurrencePattern,
      recurrenceEndDate,
      recurrenceCount
    } = req.body;
    
    console.log('[Booking Controller] Creating booking with data:', {
      clientId,
      serviceId,
      serviceName,
      date,
      timeSlot,
      urgencyLevel,
      estimatedValue,
      status
    });
    
    // CRITICAL: Validate serviceId format before proceeding
    console.log('[Booking Controller] Validating serviceId:', {
      serviceId,
      type: typeof serviceId,
      length: serviceId?.length,
      isValidFormat: mongoose.Types.ObjectId.isValid(serviceId)
    });

    if (!serviceId) {
      console.error('[Booking Controller] Missing serviceId in request');
      return res.status(400).json({
        status: 'error',
        message: 'serviceId is required',
        code: 'MISSING_SERVICE_ID',
        details: {
          received: serviceId,
          expectedType: 'MongoDB ObjectId (24 character hex string)'
        }
      });
    }

    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      console.error('[Booking Controller] Invalid serviceId format:', {
        received: serviceId,
        type: typeof serviceId,
        length: serviceId?.length,
        expected: 'MongoDB ObjectId (24 character hex string)',
        example: '6830bb99da51afb0a6180bed'
      });
      
      return res.status(400).json({
        status: 'error',
        message: `Invalid serviceId format. Received: "${serviceId}". Expected: MongoDB ObjectId.`,
        code: 'INVALID_SERVICE_ID',
        details: {
          receivedServiceId: serviceId,
          receivedType: typeof serviceId,
          receivedLength: serviceId?.length,
          expectedFormat: 'MongoDB ObjectId (24 character hex string)',
          example: '6830bb99da51afb0a6180bed',
          validationHelp: 'ServiceId must be a 24-character hexadecimal string representing a MongoDB ObjectId'
        }
      });
    }

    // CRITICAL: Validate clientId format
    if (!clientId || !mongoose.Types.ObjectId.isValid(clientId)) {
      console.error('[Booking Controller] Invalid clientId format:', clientId);
      return res.status(400).json({
        status: 'error',
        message: `Invalid clientId format. Received: "${clientId}". Expected: MongoDB ObjectId.`,
        code: 'INVALID_CLIENT_ID',
        details: {
          receivedClientId: clientId,
          expectedFormat: 'MongoDB ObjectId (24 character hex string)'
        }
      });
    }

    // CRITICAL: Verify service exists in database
    console.log('[Booking Controller] Checking if service exists in database...');
    const serviceExists = await Service.findById(serviceId);

    if (!serviceExists) {
      console.error('[Booking Controller] Service not found in database:', serviceId);
      
      // Get list of available services for debugging
      const availableServices = await Service.find({}, '_id name').lean();
      console.log('[Booking Controller] Available services:', availableServices);
      
      return res.status(404).json({
        status: 'error',
        message: `Service not found with ID: ${serviceId}`,
        code: 'SERVICE_NOT_FOUND',
        details: {
          serviceId,
          availableServices: availableServices.map(s => ({
            id: s._id,
            name: s.name
          })),
          totalAvailableServices: availableServices.length
        }
      });
    }

    console.log('[Booking Controller] ✅ Service found:', {
      serviceId: serviceExists._id,
      serviceName: serviceExists.name,
      isActive: serviceExists.isActive
    });

    // CRITICAL: Verify client exists in database
    console.log('[Booking Controller] Checking if client exists in database...');
    const clientExists = await Client.findById(clientId);

    if (!clientExists) {
      console.error('[Booking Controller] Client not found in database:', clientId);
      return res.status(404).json({
        status: 'error',
        message: `Client not found with ID: ${clientId}`,
        code: 'CLIENT_NOT_FOUND',
        details: {
          clientId,
          note: 'Client must be created before booking can be made'
        }
      });
    }

    console.log('[Booking Controller] ✅ Client found:', {
      clientId: clientExists._id,
      clientName: `${clientExists.firstName} ${clientExists.lastName}`,
      clientEmail: clientExists.email
    });

    // Continue with booking creation using valid ObjectIds
    const bookingData = {
      clientId: new mongoose.Types.ObjectId(clientId),
      serviceId: new mongoose.Types.ObjectId(serviceId),
      serviceName: serviceName || serviceExists.name,
      date: new Date(date),
      timeSlot,
      notes: notes || '',
      urgencyLevel: urgencyLevel || 'standard',
      estimatedValue: estimatedValue || 0,
      status: status || 'confirmed',
      createdBy: req.user ? req.user._id : undefined,
      // Recurrence fields
      isRecurring: isRecurring || false,
      recurrencePattern: recurrencePattern || 'none',
      recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate) : undefined,
      recurrenceCount: recurrenceCount || 0
    };

    console.log('[Booking Controller] Creating booking with data:', bookingData);

    const newBooking = new Booking(bookingData);
    const savedBooking = await newBooking.save();

    console.log('[Booking Controller] ✅ Booking created successfully:', {
      bookingId: savedBooking._id,
      bookingReference: savedBooking.reference,
      clientId: savedBooking.clientId,
      serviceId: savedBooking.serviceId,
      serviceName: savedBooking.serviceName
    });
    console.log('[Booking Controller] === BOOKING CREATION DEBUG END ===');

    // For recovery consultations, we'll skip slot management since we don't have a slot system
    // and focus on the core booking functionality
    
    // Generate booking reference if not already generated by the model
    if (!savedBooking.reference) {
      savedBooking.reference = `RO-${Date.now()}-${savedBooking._id.toString().slice(-6).toUpperCase()}`;
      await savedBooking.save();
    }

    // Send confirmation email (non-blocking)
    try {
      await emailService.sendBookingConfirmation(
        clientExists.email,
        clientExists.firstName,
        {
          serviceName: savedBooking.serviceName,
          date: new Date(date),
          timeSlot,
          reference: savedBooking.reference,
          isRecurring: savedBooking.isRecurring,
          recurrencePattern: savedBooking.recurrencePattern
        }
      );
      
      savedBooking.confirmationSent = true;
      await savedBooking.save({ validateBeforeSave: false });
    } catch (error) {
      console.error('[Booking Controller] Error sending confirmation email:', error.message);
      // Don't fail the booking if email fails
    }

    // Notify admin (non-blocking)
    try {
      await emailService.sendAdminNotification(
        'New Booking',
        {
          clientName: `${clientExists.firstName} ${clientExists.lastName}`,
          clientEmail: clientExists.email,
          serviceName: savedBooking.serviceName,
          date: new Date(date),
          timeSlot,
          reference: savedBooking.reference,
          urgencyLevel: savedBooking.urgencyLevel,
          estimatedValue: savedBooking.estimatedValue,
          isRecurring: savedBooking.isRecurring,
          recurrencePattern: savedBooking.recurrencePattern
        }
      );
    } catch (error) {
      console.error('[Booking Controller] Error sending admin notification:', error.message);
      // Don't fail the booking if notification fails
    }

    return res.status(201).json({
      status: 'success',
      data: savedBooking,
      message: 'Booking created successfully'
    });
  } catch (error) {
    console.error('[Booking Controller] ❌ Error creating booking:', error);
    console.error('[Booking Controller] Error stack:', error.stack);
    
    // Check if it's a validation error
    if (error.name === 'ValidationError') {
      console.error('[Booking Controller] Mongoose validation error:', error.errors);
      return res.status(400).json({
        status: 'error',
        message: 'Booking validation failed',
        code: 'VALIDATION_ERROR',
        errors: Object.keys(error.errors).map(key => ({
          field: key,
          message: error.errors[key].message
        }))
      });
    }

    // Check if it's a cast error (like ObjectId casting)
    if (error.name === 'CastError') {
      console.error('[Booking Controller] MongoDB cast error:', {
        path: error.path,
        value: error.value,
        kind: error.kind
      });
      return res.status(400).json({
        status: 'error',
        message: `Invalid ${error.path} format: ${error.value}`,
        code: 'CAST_ERROR',
        details: {
          field: error.path,
          receivedValue: error.value,
          expectedType: error.kind
        }
      });
    }

    logger.error('Booking creation failed', { 
      service: 'recovery-office-api',
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      status: 'error',
      message: 'Failed to create booking',
      code: 'SERVER_ERROR',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
};

/**
 * Get booking by ID
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with booking
 */
exports.getBookingById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const booking = await Booking.findById(id)
      .populate('clientId', 'firstName lastName email phone')
      .populate('serviceId', 'name duration price');
    
    if (!booking) {
      throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
    }
    
    // Check if this is part of a recurring series
    let seriesInfo = null;
    
    if (booking.isRecurring || booking.parentBookingId) {
      if (booking.isRecurring && booking.childBookings?.length > 0) {
        // This is a parent booking
        const childCount = await Booking.countDocuments({
          parentBookingId: booking._id
        });
        
        seriesInfo = {
          isParent: true,
          childCount,
          pattern: booking.recurrencePattern
        };
      } else if (booking.parentBookingId) {
        // This is a child booking
        const parent = await Booking.findById(booking.parentBookingId);
        const siblingCount = await Booking.countDocuments({
          parentBookingId: booking.parentBookingId
        });
        
        seriesInfo = {
          isParent: false,
          parentId: booking.parentBookingId,
          parentReference: parent?.reference,
          siblingCount,
          pattern: parent?.recurrencePattern
        };
      }
    }
    
    return res.status(200).json({
      status: 'success',
      data: {
        booking,
        seriesInfo
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update booking
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with updated booking
 */
exports.updateBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, cancellationReason, notes } = req.body;
    
    // Find booking
    const booking = await Booking.findById(id);
    
    if (!booking) {
      throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
    }
    
    // Update fields
    if (status) {
      booking.status = status;
      
      // If cancelling, add cancellation reason
      if (status === 'cancelled' && cancellationReason) {
        booking.cancellationReason = cancellationReason;
      }
      
      // If cancelling, release the slot
      if (status === 'cancelled') {
        await TimeSlot.findOneAndUpdate(
          { bookingId: booking._id },
          { isAvailable: true, bookingId: null }
        );
      }
    }
    
    if (notes) {
      booking.notes = notes;
    }
    
    // Track who updated the booking
    booking.updatedBy = req.user._id;
    
    // Save booking
    await booking.save();
    
    return res.status(200).json({
      status: 'success',
      data: {
        booking
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel booking
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with cancelled status
 */
exports.cancelBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { 
      cancellationReason, 
      cancelFutureBookings = false,
      cancelEntireSeries = false
    } = req.body;
    
    // Find booking
    const booking = await Booking.findById(id);
    
    if (!booking) {
      throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
    }
    
    // Check if this is a recurring booking or part of a series
    const isRecurring = booking.isRecurring || booking.parentBookingId;
    
    if (isRecurring && (cancelFutureBookings || cancelEntireSeries)) {
      // Cancel series of bookings
      const results = await recurrenceService.cancelBookingSeries(
        booking, 
        cancellationReason, 
        req.user, 
        !cancelEntireSeries // If cancelEntireSeries is true, cancelFutureOnly is false
      );
      
      return res.status(200).json({
        status: 'success',
        message: `Successfully cancelled ${results.cancelled} bookings in the series`,
        data: {
          cancelledBookings: results.bookingIds,
          totalCancelled: results.cancelled
        }
      });
    } else {
      // Cancel just this booking
      booking.status = 'cancelled';
      booking.cancellationReason = cancellationReason;
      booking.updatedBy = req.user ? req.user._id : undefined;
      
      // Save booking
      await booking.save();
      
      // Release the slot
      await TimeSlot.findOneAndUpdate(
        { bookingId: booking._id },
        { isAvailable: true, bookingId: null }
      );
      
      return res.status(200).json({
        status: 'success',
        message: 'Booking cancelled successfully',
        data: {
          booking
        }
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get all bookings (admin)
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with bookings
 */
exports.getAllBookings = async (req, res, next) => {
  try {
    const { 
      status, 
      date, 
      serviceId, 
      clientId,
      page = 1,
      limit = 20,
      sortBy = 'date',
      sortOrder = 'desc',
      isRecurring
    } = req.query;
    
    // Build query
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (date) {
      // If date is provided, find bookings for that day
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      
      query.date = { $gte: startDate, $lte: endDate };
    }
    
    if (serviceId) {
      query.serviceId = serviceId;
    }
    
    if (clientId) {
      query.clientId = clientId;
    }
    
    if (isRecurring !== undefined) {
      query.isRecurring = isRecurring === 'true';
    }
    
    // Set up pagination
    const skip = (page - 1) * limit;
    
    // Set up sorting
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Get bookings
    const bookings = await Booking.find(query)
      .populate('clientId', 'firstName lastName email')
      .populate('serviceId', 'name duration')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await Booking.countDocuments(query);
    
    return res.status(200).json({
      status: 'success',
      data: {
        bookings,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get client bookings
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response
 */
exports.getClientBookings = async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { status, upcoming = 'true' } = req.query;
    
    // Validate client
    const client = await Client.findById(clientId);
    if (!client) {
      throw new NotFoundError('Client not found', 'CLIENT_NOT_FOUND');
    }
    
    // Build query
    const query = { clientId };
    
    if (status) {
      query.status = status;
    }
    
    // Filter for upcoming or past bookings
    if (upcoming === 'true') {
      query.date = { $gte: new Date() };
    } else {
      query.date = { $lt: new Date() };
    }
    
    // Get bookings
    const bookings = await Booking.find(query)
      .populate('serviceId', 'name duration price')
      .sort({ date: upcoming === 'true' ? 1 : -1 });
    
    return res.status(200).json({
      status: 'success',
      data: {
        bookings
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get bookings by reference
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response
 */
exports.getBookingByReference = async (req, res, next) => {
  try {
    const { reference } = req.params;
    
    const booking = await Booking.findOne({ reference })
      .populate('clientId', 'firstName lastName email phone')
      .populate('serviceId', 'name duration price');
    
    if (!booking) {
      throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
    }
    
    return res.status(200).json({
      status: 'success',
      data: {
        booking
      }
    });
  } catch (error) {
    next(error);
  }
}; 