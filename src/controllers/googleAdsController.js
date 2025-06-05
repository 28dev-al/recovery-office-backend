const mongoose = require('mongoose');
const GoogleAdsLead = require('../models/GoogleAdsLead');
const emailService = require('../utils/emailService');
const logger = require('../utils/logger');

/**
 * Create a new Google Ads lead
 * POST /api/google-ads/leads
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with lead details
 */
exports.createLead = async (req, res, next) => {
  try {
    console.log('[Google Ads Controller] === LEAD CREATION START ===');
    console.log('[Google Ads Controller] Request body:', req.body);
    console.log('[Google Ads Controller] Client IP:', req.clientIp);

    const {
      name,
      email,
      phone,
      estimated_loss,
      loss_type,
      urgency_level,
      description,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
      gdpr_consent,
      marketing_consent
    } = req.body;

    // Prepare lead data
    const leadData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      estimatedLoss: estimated_loss || '',
      lossType: loss_type,
      urgencyLevel: urgency_level || 'normal',
      description: description || '',
      source: 'google-ads',
      leadStatus: 'new',
      priority: urgency_level || 'normal',
      
      // UTM tracking data
      utmSource: utm_source || '',
      utmMedium: utm_medium || '',
      utmCampaign: utm_campaign || '',
      utmContent: utm_content || '',
      utmTerm: utm_term || '',
      
      // IP and user agent for tracking
      ipAddress: req.clientIp,
      userAgent: req.get('User-Agent') || '',
      
      // Email tracking
      confirmationSent: false,
      internalNotificationSent: false
    };

    console.log('[Google Ads Controller] Creating lead with data:', leadData);

    // Create and save lead
    const newLead = new GoogleAdsLead(leadData);
    const savedLead = await newLead.save();

    console.log('[Google Ads Controller] ✅ Lead created successfully:', {
      leadId: savedLead._id,
      referenceNumber: savedLead.referenceNumber,
      email: savedLead.email,
      phone: savedLead.phone,
      priority: savedLead.priority
    });

    // Send confirmation email to client (non-blocking)
    try {
      console.log('[Google Ads Controller] Sending client confirmation email...');
      
      // Use existing email service methods for now
      const clientEmailResult = await emailService.sendBookingConfirmation(
        savedLead.email,
        savedLead.name,
        {
          serviceName: `${savedLead.lossType} Recovery Consultation`,
          date: new Date(),
          timeSlot: 'To be confirmed',
          reference: savedLead.referenceNumber,
          isRecurring: false,
          recurrencePattern: 'none'
        }
      );

      if (clientEmailResult && clientEmailResult.success) {
        savedLead.confirmationSent = true;
        savedLead.confirmationSentAt = new Date();
        await savedLead.save({ validateBeforeSave: false });
        console.log('✅ [Google Ads Controller] Client confirmation email sent');
      }
    } catch (emailError) {
      console.error('[Google Ads Controller] Error sending client email:', emailError.message);
    }

    // Send internal notification email (non-blocking)
    try {
      console.log('[Google Ads Controller] Sending internal notification email...');
      
      const internalEmailResult = await emailService.sendAdminNotification(
        'New Google Ads Lead',
        {
          clientName: savedLead.name,
          clientEmail: savedLead.email,
          clientPhone: savedLead.phone,
          serviceName: `${savedLead.lossType} Recovery`,
          date: new Date(),
          timeSlot: 'To be confirmed',
          reference: savedLead.referenceNumber,
          urgencyLevel: savedLead.urgencyLevel,
          estimatedValue: savedLead.estimatedLoss,
          isRecurring: false,
          recurrencePattern: 'none'
        }
      );

      if (internalEmailResult && internalEmailResult.success) {
        savedLead.internalNotificationSent = true;
        savedLead.internalNotificationSentAt = new Date();
        await savedLead.save({ validateBeforeSave: false });
        console.log('✅ [Google Ads Controller] Internal notification email sent');
      }
    } catch (emailError) {
      console.error('[Google Ads Controller] Error sending internal notification:', emailError.message);
    }

    console.log('[Google Ads Controller] === LEAD CREATION END ===');

    // Return success response
    return res.status(201).json({
      success: true,
      message: 'Lead captured successfully',
      lead_id: savedLead._id,
      reference_number: savedLead.referenceNumber,
      response_time: getResponseTimeMessage(savedLead.priority)
    });

  } catch (error) {
    console.error('[Google Ads Controller] ❌ Error creating lead:', error);
    
    // Check if it's a validation error
    if (error.name === 'ValidationError') {
      const errorMessages = Object.keys(error.errors).map(key => error.errors[key].message);
      return res.status(400).json({
        success: false,
        message: 'Lead validation failed',
        errors: errorMessages,
        code: 'VALIDATION_ERROR'
      });
    }

    // Check for duplicate key error (unique constraints)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A lead with this reference number already exists',
        code: 'DUPLICATE_REFERENCE'
      });
    }

    logger.error('Google Ads lead creation failed', { 
      service: 'recovery-office-api',
      error: error.message,
      stack: error.stack,
      leadData: req.body
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to create lead',
      code: 'SERVER_ERROR',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
};

/**
 * Get all Google Ads leads with filtering and pagination
 * GET /api/google-ads/leads
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with leads list
 */
exports.getLeads = async (req, res, next) => {
  try {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      leadStatus,
      priority,
      lossType,
      source,
      assignedTo,
      dateFrom,
      dateTo,
      search,
      overdue,
      unassigned
    } = req.query;

    // Build filter query
    const filter = {};

    if (leadStatus) {
      filter.leadStatus = Array.isArray(leadStatus) ? { $in: leadStatus } : leadStatus;
    }

    if (priority) {
      filter.priority = Array.isArray(priority) ? { $in: priority } : priority;
    }

    if (lossType) {
      filter.lossType = Array.isArray(lossType) ? { $in: lossType } : lossType;
    }

    if (source) {
      filter.source = Array.isArray(source) ? { $in: source } : source;
    }

    if (assignedTo) {
      filter.assignedTo = assignedTo;
    }

    if (unassigned === true || unassigned === 'true') {
      filter.assignedTo = { $exists: false };
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    // Search filter (name, email, phone, description)
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { referenceNumber: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    // Execute queries in parallel
    const [leads, totalCount] = await Promise.all([
      GoogleAdsLead.find(filter)
        .populate('assignedTo', 'firstName lastName email')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      GoogleAdsLead.countDocuments(filter)
    ]);

    // Add overdue filter if requested (done after DB query for performance)
    let filteredLeads = leads;
    if (overdue === true || overdue === 'true') {
      filteredLeads = leads.filter(lead => {
        if (lead.leadStatus === 'contacted' || lead.leadStatus === 'converted' || lead.leadStatus === 'closed') {
          return false;
        }
        const ageInHours = Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60));
        const responseTimeHours = lead.priority === 'emergency' ? 1 : lead.priority === 'urgent' ? 4 : 24;
        return ageInHours > responseTimeHours;
      });
    }

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return res.status(200).json({
      success: true,
      data: {
        leads: filteredLeads,
        pagination: {
          currentPage: page,
          totalPages,
          totalLeads: totalCount,
          leadsPerPage: limit,
          hasNextPage,
          hasPrevPage
        },
        filters: {
          leadStatus,
          priority,
          lossType,
          source,
          assignedTo,
          dateFrom,
          dateTo,
          search,
          overdue,
          unassigned
        }
      }
    });

  } catch (error) {
    console.error('[Google Ads Controller] Error fetching leads:', error);
    
    logger.error('Google Ads leads fetch failed', { 
      service: 'recovery-office-api',
      error: error.message,
      filters: req.query
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch leads',
      code: 'SERVER_ERROR',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
};

/**
 * Get lead by ID
 * GET /api/google-ads/leads/:id
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with lead details
 */
exports.getLeadById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid lead ID format',
        code: 'INVALID_ID'
      });
    }

    const lead = await GoogleAdsLead.findById(id)
      .populate('assignedTo', 'firstName lastName email')
      .populate('contactNotes.contactedBy', 'firstName lastName email');

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found',
        code: 'LEAD_NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        lead
      }
    });

  } catch (error) {
    console.error('[Google Ads Controller] Error fetching lead by ID:', error);
    
    logger.error('Google Ads lead fetch by ID failed', { 
      service: 'recovery-office-api',
      error: error.message,
      leadId: req.params.id
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch lead',
      code: 'SERVER_ERROR',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
};

/**
 * Update lead status and details
 * PATCH /api/google-ads/leads/:id
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with updated lead
 */
exports.updateLead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      leadStatus,
      priority,
      qualificationScore,
      qualificationNotes,
      assignedTo,
      contactNote,
      contactMethod,
      contactOutcome
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid lead ID format',
        code: 'INVALID_ID'
      });
    }

    const lead = await GoogleAdsLead.findById(id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found',
        code: 'LEAD_NOT_FOUND'
      });
    }

    // Update basic fields
    if (leadStatus) lead.leadStatus = leadStatus;
    if (priority) lead.priority = priority;
    if (qualificationScore !== undefined) lead.qualificationScore = qualificationScore;
    if (qualificationNotes !== undefined) lead.qualificationNotes = qualificationNotes;
    
    // Handle assignment
    if (assignedTo) {
      lead.assignedTo = assignedTo;
      lead.assignedAt = new Date();
    }

    // Add contact note if provided
    if (contactNote && contactMethod && contactOutcome) {
      await lead.addContactNote(contactNote, req.user?._id, contactMethod, contactOutcome);
    }

    // Save the updated lead
    const updatedLead = await lead.save();

    console.log('[Google Ads Controller] ✅ Lead updated successfully:', {
      leadId: updatedLead._id,
      referenceNumber: updatedLead.referenceNumber,
      leadStatus: updatedLead.leadStatus,
      priority: updatedLead.priority
    });

    return res.status(200).json({
      success: true,
      message: 'Lead updated successfully',
      data: {
        lead: updatedLead
      }
    });

  } catch (error) {
    console.error('[Google Ads Controller] Error updating lead:', error);
    
    if (error.name === 'ValidationError') {
      const errorMessages = Object.keys(error.errors).map(key => error.errors[key].message);
      return res.status(400).json({
        success: false,
        message: 'Lead validation failed',
        errors: errorMessages,
        code: 'VALIDATION_ERROR'
      });
    }

    logger.error('Google Ads lead update failed', { 
      service: 'recovery-office-api',
      error: error.message,
      leadId: req.params.id,
      updateData: req.body
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to update lead',
      code: 'SERVER_ERROR',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
};

/**
 * Get lead statistics
 * GET /api/google-ads/leads/stats
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with statistics
 */
exports.getLeadStats = async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;

    // Build date filter
    const dateFilter = {};
    if (dateFrom || dateTo) {
      dateFilter.createdAt = {};
      if (dateFrom) dateFilter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) dateFilter.createdAt.$lte = new Date(dateTo);
    }

    // Get stats using aggregation
    const stats = await GoogleAdsLead.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalLeads: { $sum: 1 },
          newLeads: { $sum: { $cond: [{ $eq: ['$leadStatus', 'new'] }, 1, 0] } },
          contactedLeads: { $sum: { $cond: [{ $eq: ['$leadStatus', 'contacted'] }, 1, 0] } },
          qualifiedLeads: { $sum: { $cond: [{ $eq: ['$leadStatus', 'qualified'] }, 1, 0] } },
          convertedLeads: { $sum: { $cond: [{ $eq: ['$leadStatus', 'converted'] }, 1, 0] } },
          emergencyLeads: { $sum: { $cond: [{ $eq: ['$priority', 'emergency'] }, 1, 0] } },
          urgentLeads: { $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] } },
          averageContactAttempts: { $avg: '$contactAttempts' }
        }
      }
    ]);

    const overallStats = stats[0] || {
      totalLeads: 0,
      newLeads: 0,
      contactedLeads: 0,
      qualifiedLeads: 0,
      convertedLeads: 0,
      emergencyLeads: 0,
      urgentLeads: 0,
      averageContactAttempts: 0
    };

    // Calculate conversion rates
    const conversionRate = overallStats.totalLeads > 0 
      ? ((overallStats.convertedLeads / overallStats.totalLeads) * 100).toFixed(2)
      : 0;

    const qualificationRate = overallStats.totalLeads > 0 
      ? ((overallStats.qualifiedLeads / overallStats.totalLeads) * 100).toFixed(2)
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        overview: {
          ...overallStats,
          conversionRate: parseFloat(conversionRate),
          qualificationRate: parseFloat(qualificationRate)
        },
        dateRange: {
          from: dateFrom || null,
          to: dateTo || null
        }
      }
    });

  } catch (error) {
    console.error('[Google Ads Controller] Error fetching lead stats:', error);
    
    logger.error('Google Ads lead stats fetch failed', { 
      service: 'recovery-office-api',
      error: error.message
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch lead statistics',
      code: 'SERVER_ERROR',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
};

/**
 * Get lead by reference number
 * GET /api/google-ads/leads/reference/:reference
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with lead details
 */
exports.getLeadByReference = async (req, res, next) => {
  try {
    const { reference } = req.params;

    const lead = await GoogleAdsLead.findOne({ referenceNumber: reference })
      .populate('assignedTo', 'firstName lastName email')
      .populate('contactNotes.contactedBy', 'firstName lastName email');

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found with this reference number',
        code: 'LEAD_NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        lead
      }
    });

  } catch (error) {
    console.error('[Google Ads Controller] Error fetching lead by reference:', error);
    
    logger.error('Google Ads lead fetch by reference failed', { 
      service: 'recovery-office-api',
      error: error.message,
      reference: req.params.reference
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch lead',
      code: 'SERVER_ERROR',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
};

/**
 * Helper function to get response time message based on priority
 * 
 * @param {string} priority - Lead priority level
 * @returns {string} Response time message
 */
function getResponseTimeMessage(priority) {
  switch (priority) {
    case 'emergency':
      return 'We\'ll contact you within 1 hour';
    case 'urgent':
      return 'We\'ll contact you within 4 hours';
    default:
      return 'We\'ll contact you within 24 hours';
  }
}

module.exports = {
  createLead: exports.createLead,
  getLeads: exports.getLeads,
  getLeadById: exports.getLeadById,
  updateLead: exports.updateLead,
  getLeadStats: exports.getLeadStats,
  getLeadByReference: exports.getLeadByReference
}; 