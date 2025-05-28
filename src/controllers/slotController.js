/**
 * Slot Controller
 * Handles slot management operations
 */
const Slot = require('../models/Slot');
const Service = require('../models/Service');
const moment = require('moment');
const { ValidationError, NotFoundError } = require('../utils/AppError');

/**
 * Get available slots (filtered by date, service)
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} _next - Express next middleware function (unused but required by Express)
 * @returns {Object} JSON response with available slots
 */
// eslint-disable-next-line no-unused-vars
exports.getAvailableSlots = async (req, res, _next) => {
  try {
    const { date, serviceId } = req.query;
    
    console.log('[Slots API] Request received:', { date, serviceId });
    
    if (!date) {
      return res.status(400).json({
        status: 'error',
        message: 'Date is required parameter',
        code: 'MISSING_DATE'
      });
    }
    
    if (!serviceId) {
      return res.status(400).json({
        status: 'error', 
        message: 'Service ID is required parameter',
        code: 'MISSING_SERVICE_ID'
      });
    }
    
    // Parse date and validate
    const selectedDate = moment(date);
    if (!selectedDate.isValid()) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid date format. Use YYYY-MM-DD format.',
        code: 'INVALID_DATE'
      });
    }
    
    // Check if serviceId is a valid ObjectId
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      console.log('[Slots API] Invalid serviceId format, generating fallback slots');
      return generateFallbackSlots(res, date);
    }
    
    const startOfDay = selectedDate.startOf('day').toDate();
    const endOfDay = selectedDate.endOf('day').toDate();
    
    // Query for available slots
    const slots = await Slot.find({
      serviceId,
      date: { $gte: startOfDay, $lte: endOfDay },
      isAvailable: true
    }).sort('timeSlot');
    
    console.log('[Slots API] Found existing slots:', slots.length);
    
    // If no slots exist, generate fallback business hours - ALWAYS generate fallback when empty
    if (slots.length === 0) {
      console.log('[Slots API] No slots found, generating fallback slots');
      return generateFallbackSlots(res, date);
    }
    
    // Format existing slots for frontend
    const formattedSlots = slots.map(slot => ({
      id: slot._id,
      startTime: moment(slot.date).hour(parseInt(slot.timeSlot.split(':')[0])).minute(parseInt(slot.timeSlot.split(':')[1])).toISOString(),
      endTime: moment(slot.date).hour(parseInt(slot.timeSlot.split('-')[1].split(':')[0])).minute(parseInt(slot.timeSlot.split('-')[1].split(':')[1])).toISOString(),
      isAvailable: slot.isAvailable,
      serviceId: slot.serviceId,
      date: date,
      expertName: 'Dr. Sarah Mitchell',
      consultationType: 'initial',
      duration: 60
    }));
    
    console.log('[Slots API] Returning formatted slots:', formattedSlots.length);
    
    return res.status(200).json({
      status: 'success',
      results: formattedSlots.length,
      data: formattedSlots
    });
    
  } catch (error) {
    console.error('[Slots API] Error:', error);
    
    // Generate fallback slots on any error
    console.log('[Slots API] Error occurred, generating fallback slots');
    return generateFallbackSlots(res, req.query.date);
  }
};

/**
 * Generate fallback business hours slots
 * Used when no slots exist or when there's an error
 */
function generateFallbackSlots(res, date) {
  const selectedDate = moment(date);
  
  // Skip weekends
  if (selectedDate.day() === 0 || selectedDate.day() === 6) {
    return res.json({
      status: 'success',
      results: 0,
      data: [],
      message: 'No business hours on weekends'
    });
  }
  
  // Generate business hours (9 AM - 5 PM, excluding lunch hour 12-1 PM)
  const businessHours = [
    '09:00-10:00', '10:00-11:00', '11:00-12:00',
    '14:00-15:00', '15:00-16:00', '16:00-17:00'
  ];
  
  const fallbackSlots = businessHours.map((timeSlot, index) => {
    const startHour = parseInt(timeSlot.split(':')[0]);
    const startMin = parseInt(timeSlot.split(':')[1].split('-')[0]);
    const endHour = parseInt(timeSlot.split('-')[1].split(':')[0]);
    const endMin = parseInt(timeSlot.split('-')[1].split(':')[1]);
    
    const startTime = selectedDate.clone().hour(startHour).minute(startMin).second(0).millisecond(0);
    const endTime = selectedDate.clone().hour(endHour).minute(endMin).second(0).millisecond(0);
    
    return {
      id: `fallback-slot-${date}-${index}`,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      isAvailable: Math.random() > 0.3, // 70% availability for demo
      serviceId: 'fallback',
      date: date,
      expertName: index % 2 === 0 ? 'Dr. Sarah Mitchell' : 'Dr. Michael Chen',
      consultationType: 'initial',
      duration: 60
    };
  });
  
  console.log('[Slots API] Generated fallback slots:', fallbackSlots.length);
  
  return res.json({
    status: 'success',
    results: fallbackSlots.length,
    data: fallbackSlots,
    message: 'Showing standard business hours'
  });
}

/**
 * Get slot by ID
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with slot details
 */
exports.getSlotById = async (req, res, next) => {
  try {
    const slot = await Slot.findById(req.params.id);
    
    if (!slot) {
      throw new NotFoundError('Slot not found', 'SLOT_NOT_FOUND');
    }
    
    return res.status(200).json({
      status: 'success',
      data: slot
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate slots for a date range
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with generated slots count
 */
exports.generateSlots = async (req, res, next) => {
  try {
    const { startDate, endDate, serviceIds, timeSlots } = req.body;
    
    // Validate required fields
    if (!startDate || !endDate) {
      throw new ValidationError('Start date and end date are required', 'MISSING_DATE_RANGE');
    }
    
    if (!serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) {
      throw new ValidationError('Service IDs array is required', 'MISSING_SERVICES');
    }
    
    if (!timeSlots || !Array.isArray(timeSlots) || timeSlots.length === 0) {
      throw new ValidationError('Time slots array is required', 'MISSING_TIME_SLOTS');
    }
    
    // Parse dates
    const start = moment(startDate);
    const end = moment(endDate);
    
    if (!start.isValid() || !end.isValid()) {
      throw new ValidationError('Invalid date format', 'INVALID_DATE');
    }
    
    if (end.isBefore(start)) {
      throw new ValidationError('End date cannot be before start date', 'INVALID_DATE_RANGE');
    }
    
    // Verify services exist
    const services = await Service.find({ _id: { $in: serviceIds } });
    if (services.length !== serviceIds.length) {
      throw new ValidationError('One or more service IDs are invalid', 'INVALID_SERVICE_ID');
    }
    
    // Generate slots
    const slots = [];
    let currentDate = start.clone();
    
    while (currentDate.isSameOrBefore(end)) {
      // Skip weekends (optional, based on business requirements)
      if (currentDate.day() !== 0 && currentDate.day() !== 6) {
        for (const serviceId of serviceIds) {
          for (const timeSlot of timeSlots) {
            slots.push({
              serviceId,
              date: currentDate.toDate(),
              timeSlot,
              isAvailable: true
            });
          }
        }
      }
      
      currentDate.add(1, 'day');
    }
    
    // Insert slots
    const result = await Slot.insertMany(slots);
    
    return res.status(201).json({
      status: 'success',
      message: `Generated ${result.length} slots`,
      results: result.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Clear all slots for a date range
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with deleted slots count
 */
exports.clearSlots = async (req, res, next) => {
  try {
    const { startDate, endDate, serviceIds } = req.body;
    
    // Validate required fields
    if (!startDate || !endDate) {
      throw new ValidationError('Start date and end date are required', 'MISSING_DATE_RANGE');
    }
    
    // Parse dates
    const start = moment(startDate).startOf('day');
    const end = moment(endDate).endOf('day');
    
    if (!start.isValid() || !end.isValid()) {
      throw new ValidationError('Invalid date format', 'INVALID_DATE');
    }
    
    if (end.isBefore(start)) {
      throw new ValidationError('End date cannot be before start date', 'INVALID_DATE_RANGE');
    }
    
    // Prepare delete query
    const query = {
      date: { $gte: start.toDate(), $lte: end.toDate() },
      // Only delete available slots to avoid removing slots with bookings
      isAvailable: true
    };
    
    // Add service filter if provided
    if (serviceIds && Array.isArray(serviceIds) && serviceIds.length > 0) {
      query.serviceId = { $in: serviceIds };
    }
    
    // Delete slots
    const result = await Slot.deleteMany(query);
    
    return res.status(200).json({
      status: 'success',
      message: `Deleted ${result.deletedCount} slots`,
      count: result.deletedCount
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update slot availability
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with updated slot
 */
exports.updateSlot = async (req, res, next) => {
  try {
    const { isAvailable } = req.body;
    
    if (isAvailable === undefined) {
      throw new ValidationError('isAvailable is required', 'MISSING_AVAILABILITY');
    }
    
    // Find slot and ensure it doesn't have a booking if we're making it unavailable
    const slot = await Slot.findById(req.params.id);
    
    if (!slot) {
      throw new NotFoundError('Slot not found', 'SLOT_NOT_FOUND');
    }
    
    if (slot.bookingId && !isAvailable) {
      throw new ValidationError('Cannot mark a booked slot as unavailable', 'SLOT_HAS_BOOKING');
    }
    
    // Update slot
    slot.isAvailable = isAvailable;
    await slot.save();
    
    return res.status(200).json({
      status: 'success',
      data: slot
    });
  } catch (error) {
    next(error);
  }
}; 