/**
 * Recurrence Service
 * Handles generation and management of recurring bookings
 */
const moment = require('moment');
const Booking = require('../models/Booking');
const Slot = require('../models/Slot');
const { ConflictError } = require('../utils/AppError');
const logger = require('../utils/logger');

/**
 * Generate recurring bookings based on a parent booking
 * 
 * @param {Object} parentBooking - The parent booking
 * @param {string} pattern - Recurrence pattern ('daily', 'weekly', 'biweekly', 'monthly')
 * @param {Date|string} endDate - End date for recurrence
 * @param {number} count - Number of occurrences (alternative to endDate)
 * @returns {Promise<Array>} Array of created bookings
 */
exports.generateRecurringBookings = async (parentBooking, pattern, endDate = null, count = null) => {
  // Validate input
  if (!pattern || pattern === 'none') {
    return [];
  }
  
  // Calculate iterations based on count or end date
  let iterations = 0;
  const startDate = moment(parentBooking.date);
  
  if (count && count > 0) {
    iterations = count;
  } else if (endDate) {
    const endMoment = moment(endDate);
    
    if (pattern === 'daily') {
      iterations = endMoment.diff(startDate, 'days');
    } else if (pattern === 'weekly') {
      iterations = endMoment.diff(startDate, 'weeks');
    } else if (pattern === 'biweekly') {
      iterations = Math.floor(endMoment.diff(startDate, 'weeks') / 2);
    } else if (pattern === 'monthly') {
      iterations = endMoment.diff(startDate, 'months');
    }
  } else {
    // Default to 10 occurrences if neither count nor endDate provided
    iterations = 10;
  }
  
  // Limit iterations for safety
  iterations = Math.min(iterations, 52); // Maximum 1 year for weekly
  
  logger.info(`Generating ${iterations} recurring bookings with pattern: ${pattern}`);
  
  // Store created bookings
  const childBookings = [];
  
  // Generate bookings
  for (let i = 1; i <= iterations; i++) {
    let newDate;
    
    // Calculate date based on pattern
    if (pattern === 'daily') {
      newDate = moment(startDate).add(i, 'days');
    } else if (pattern === 'weekly') {
      newDate = moment(startDate).add(i, 'weeks');
    } else if (pattern === 'biweekly') {
      newDate = moment(startDate).add(i * 2, 'weeks');
    } else if (pattern === 'monthly') {
      newDate = moment(startDate).add(i, 'months');
    }
    
    // Check if slot exists and is available
    const slot = await Slot.findOne({
      serviceId: parentBooking.serviceId,
      date: {
        $gte: newDate.startOf('day').toDate(),
        $lte: newDate.endOf('day').toDate()
      },
      timeSlot: parentBooking.timeSlot,
      isAvailable: true
    });
    
    if (!slot) {
      logger.warn(`No available slot found for ${newDate.format('YYYY-MM-DD')} at ${parentBooking.timeSlot}`);
      continue; // Skip if slot not available
    }
    
    try {
      // Create child booking
      const childBooking = new Booking({
        clientId: parentBooking.clientId,
        serviceId: parentBooking.serviceId,
        date: newDate.toDate(),
        timeSlot: parentBooking.timeSlot,
        status: 'confirmed',
        isRecurring: true,
        recurrencePattern: pattern,
        parentBookingId: parentBooking._id,
        notes: parentBooking.notes ? `${parentBooking.notes} (Recurring)` : 'Recurring booking'
      });
      
      await childBooking.save();
      childBookings.push(childBooking);
      
      // Update slot availability
      slot.isAvailable = false;
      slot.bookingId = childBooking._id;
      await slot.save();
      
      logger.info(`Created recurring booking: ${childBooking._id} for ${newDate.format('YYYY-MM-DD')}`);
    } catch (error) {
      logger.error(`Error creating recurring booking: ${error.message}`, { error });
    }
  }
  
  return childBookings;
};

/**
 * Cancel a series of bookings
 * 
 * @param {Object} booking - The booking to cancel (either parent or any child)
 * @param {string} reason - Cancellation reason
 * @param {Object} user - User performing the cancellation
 * @param {boolean} cancelFutureOnly - Whether to cancel only future bookings
 * @returns {Promise<Object>} Result of cancellation
 */
exports.cancelBookingSeries = async (booking, reason, user = null, cancelFutureOnly = true) => {
  try {
    // Determine if this is a parent or child booking
    const isParent = booking.isRecurring && !booking.parentBookingId;
    const today = new Date();
    let bookingsToCancel = [];
    let parentBooking = booking;
    
    if (!isParent) {
      // This is a child booking, get the parent
      parentBooking = await Booking.findById(booking.parentBookingId);
      
      if (!parentBooking) {
        throw new Error('Parent booking not found');
      }
    }
    
    // Build query for bookings to cancel
    let query = {};
    
    if (cancelFutureOnly) {
      // Cancel only this booking and future bookings
      if (isParent) {
        query = {
          $or: [
            { _id: booking._id }, // The parent
            { 
              parentBookingId: booking._id,
              date: { $gte: today }
            }
          ]
        };
      } else {
        // This is a child, cancel only from this date forward
        query = {
          $or: [
            { _id: booking._id }, // This booking
            {
              parentBookingId: parentBooking._id,
              date: { $gte: booking.date }
            }
          ]
        };
      }
    } else {
      // Cancel the entire series
      query = {
        $or: [
          { _id: parentBooking._id }, // The parent
          { parentBookingId: parentBooking._id } // All children
        ]
      };
    }
    
    // Get bookings to cancel
    bookingsToCancel = await Booking.find(query);
    
    // Process cancellations
    const bookingIds = bookingsToCancel.map(b => b._id);
    const results = {
      total: bookingsToCancel.length,
      cancelled: 0,
      failed: 0,
      bookingIds: []
    };
    
    // Update booking statuses
    const updateResult = await Booking.updateMany(
      { _id: { $in: bookingIds } },
      { 
        status: 'cancelled',
        cancellationReason: reason,
        updatedBy: user ? user._id : undefined
      }
    );
    
    results.cancelled = updateResult.modifiedCount;
    results.bookingIds = bookingIds;
    
    // Release reserved slots
    for (const bookingId of bookingIds) {
      try {
        await Slot.findOneAndUpdate(
          { bookingId },
          { 
            isAvailable: true,
            bookingId: null
          }
        );
      } catch (error) {
        logger.error(`Error releasing slot for booking ${bookingId}: ${error.message}`);
        results.failed++;
      }
    }
    
    logger.info(`Cancelled ${results.cancelled} bookings in series`);
    return results;
  } catch (error) {
    logger.error(`Error cancelling booking series: ${error.message}`, { error });
    throw error;
  }
};

/**
 * Reschedule a series of bookings
 * 
 * @param {Object} booking - The booking to reschedule (either parent or any child)
 * @param {string} newTimeSlot - New time slot
 * @param {Date|string} newDate - New date (optional, only applies to this booking)
 * @param {boolean} rescheduleFutureOnly - Whether to reschedule only future bookings
 * @param {Object} user - User performing the rescheduling
 * @returns {Promise<Object>} Result of rescheduling
 */
exports.rescheduleBookingSeries = async (booking, newTimeSlot, newDate = null, rescheduleFutureOnly = true, user = null) => {
  // Implementation for rescheduling a series
  // This is a more complex operation that would need to check slot availability
  // for each booking in the series
  // For brevity, this implementation is not included here
  throw new Error('Not implemented: rescheduleBookingSeries');
}; 