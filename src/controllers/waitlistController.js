/**
 * Waitlist Controller
 * Handles waitlist-related operations
 */
const Waitlist = require('../models/Waitlist');
const Client = require('../models/Client');
const Service = require('../models/Service');
const Slot = require('../models/Slot');
const emailService = require('../services/emailService');
const { 
  ValidationError, 
  NotFoundError, 
  ConflictError
} = require('../utils/AppError');

/**
 * Add a client to the waitlist
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response
 */
exports.addToWaitlist = async (req, res, next) => {
  try {
    const {
      clientId,
      serviceId,
      requestedDate,
      preferredTimeSlots,
      notes,
      priority
    } = req.body;
    
    // Validate client
    const client = await Client.findById(clientId);
    if (!client) {
      throw new NotFoundError('Client not found', 'CLIENT_NOT_FOUND');
    }
    
    // Validate service
    const service = await Service.findById(serviceId);
    if (!service) {
      throw new NotFoundError('Service not found', 'SERVICE_NOT_FOUND');
    }
    
    // Check if client is already on waitlist for this service and date
    const existingEntry = await Waitlist.findOne({
      clientId,
      serviceId,
      requestedDate: new Date(requestedDate),
      status: 'pending'
    });
    
    if (existingEntry) {
      throw new ConflictError('Client already on waitlist for this service and date', 'ALREADY_ON_WAITLIST');
    }
    
    // Create waitlist entry
    const waitlistEntry = new Waitlist({
      clientId,
      serviceId,
      requestedDate: new Date(requestedDate),
      preferredTimeSlots: preferredTimeSlots || [],
      notes,
      priority: priority || 0,
      createdBy: req.user ? req.user._id : undefined
    });
    
    await waitlistEntry.save();
    
    // Send confirmation to client
    try {
      await emailService.sendWaitlistConfirmation(
        client.email,
        client.firstName,
        {
          serviceName: service.name,
          requestedDate: new Date(requestedDate)
        }
      );
    } catch (error) {
      req.logger?.error({
        message: `Error sending waitlist confirmation: ${error.message}`,
        error,
        waitlistId: waitlistEntry._id
      });
      // Continue even if email fails
    }
    
    return res.status(201).json({
      status: 'success',
      message: 'Added to waitlist successfully',
      data: {
        waitlistEntry
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get waitlist entries
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response
 */
exports.getWaitlist = async (req, res, next) => {
  try {
    const {
      status,
      serviceId,
      clientId,
      date,
      page = 1,
      limit = 20
    } = req.query;
    
    // Build query
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (serviceId) {
      query.serviceId = serviceId;
    }
    
    if (clientId) {
      query.clientId = clientId;
    }
    
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      
      query.requestedDate = { $gte: startDate, $lte: endDate };
    }
    
    // Set up pagination
    const skip = (page - 1) * limit;
    
    // Get waitlist entries
    const waitlistEntries = await Waitlist.find(query)
      .populate('clientId', 'firstName lastName email phone preferredContactMethod')
      .populate('serviceId', 'name duration')
      .sort({ priority: -1, createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await Waitlist.countDocuments(query);
    
    return res.status(200).json({
      status: 'success',
      data: {
        waitlist: waitlistEntries,
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
 * Notify clients on waitlist when a slot becomes available
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response
 */
exports.notifyWaitlist = async (req, res, next) => {
  try {
    const { slotId } = req.params;
    
    // Get the slot
    const slot = await Slot.findById(slotId).populate('serviceId');
    if (!slot || !slot.isAvailable) {
      throw new NotFoundError('Available slot not found', 'SLOT_NOT_FOUND');
    }
    
    // Find waitlist entries for this service and date
    const waitlistEntries = await Waitlist.findForSlot(
      slot.serviceId._id,
      slot.date,
      3 // Limit to 3 clients
    );
    
    if (waitlistEntries.length === 0) {
      return res.status(200).json({
        status: 'success',
        message: 'No pending waitlist entries for this slot',
        data: {
          notifiedCount: 0
        }
      });
    }
    
    // Track successfully notified clients
    const notifiedEntries = [];
    
    // Notify each client on waitlist
    for (const entry of waitlistEntries) {
      try {
        const client = entry.clientId;
        
        // Send notification email
        await emailService.sendWaitlistNotification(
          client.email,
          client.firstName,
          {
            serviceName: slot.serviceId.name,
            date: slot.date,
            timeSlot: slot.timeSlot,
            bookingLink: `${process.env.FRONTEND_URL}/booking?slot=${slot._id}&waitlist=${entry._id}`
          }
        );
        
        // Update waitlist entry status
        await entry.markAsNotified();
        
        notifiedEntries.push(entry);
      } catch (error) {
        req.logger?.error({
          message: `Error notifying waitlist client: ${error.message}`,
          error,
          waitlistId: entry._id
        });
        // Continue with next client even if one fails
      }
    }
    
    return res.status(200).json({
      status: 'success',
      message: `Notified ${notifiedEntries.length} clients on waitlist`,
      data: {
        notifiedEntries,
        notifiedCount: notifiedEntries.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Process a waitlist entry when a client books from the waitlist
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response
 */
exports.processWaitlistBooking = async (req, res, next) => {
  try {
    const { waitlistId, bookingId } = req.params;
    
    // Validate waitlist entry
    const waitlistEntry = await Waitlist.findById(waitlistId);
    if (!waitlistEntry) {
      throw new NotFoundError('Waitlist entry not found', 'WAITLIST_NOT_FOUND');
    }
    
    // Mark waitlist entry as booked
    await waitlistEntry.markAsBooked(bookingId);
    
    return res.status(200).json({
      status: 'success',
      message: 'Waitlist entry processed successfully',
      data: {
        waitlistEntry
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel a waitlist entry
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response
 */
exports.cancelWaitlistEntry = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Find waitlist entry
    const waitlistEntry = await Waitlist.findById(id);
    if (!waitlistEntry) {
      throw new NotFoundError('Waitlist entry not found', 'WAITLIST_NOT_FOUND');
    }
    
    // Cancel waitlist entry
    await waitlistEntry.markAsCancelled();
    
    return res.status(200).json({
      status: 'success',
      message: 'Waitlist entry cancelled successfully',
      data: {
        waitlistEntry
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Clean up expired waitlist entries
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response
 */
exports.cleanupExpiredEntries = async (req, res, next) => {
  try {
    const count = await Waitlist.processExpired();
    
    return res.status(200).json({
      status: 'success',
      message: `Processed ${count} expired waitlist entries`,
      data: {
        processedCount: count
      }
    });
  } catch (error) {
    next(error);
  }
}; 