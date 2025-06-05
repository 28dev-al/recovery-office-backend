const Joi = require('joi');

/**
 * Validate Google Ads lead submission
 * Specific validation for Google Ads landing page form
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
exports.validateGoogleAdsLead = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string()
      .min(2)
      .max(100)
      .required()
      .pattern(/^[a-zA-Z\s\-'.,]+$/)
      .messages({
        'string.empty': 'Name is required',
        'string.min': 'Name must be at least 2 characters',
        'string.max': 'Name cannot exceed 100 characters',
        'string.pattern.base': 'Name contains invalid characters',
        'any.required': 'Name is required'
      }),
    
    email: Joi.string()
      .email({ tlds: { allow: false } })
      .required()
      .lowercase()
      .messages({
        'string.email': 'Please provide a valid email address',
        'string.empty': 'Email is required',
        'any.required': 'Email is required'
      }),
    
    phone: Joi.string()
      .pattern(/^(\+\d{1,3}[- ]?)?\d{10,14}$/)
      .required()
      .messages({
        'string.pattern.base': 'Please provide a valid phone number (10-14 digits)',
        'string.empty': 'Phone number is required',
        'any.required': 'Phone number is required'
      }),
    
    estimated_loss: Joi.string()
      .max(50)
      .allow('', null)
      .messages({
        'string.max': 'Estimated loss description cannot exceed 50 characters'
      }),
    
    loss_type: Joi.string()
      .valid(
        'cryptocurrency-recovery',
        'investment-fraud', 
        'financial-scam',
        'binary-options',
        'forex-scam',
        'romance-scam',
        'pig-butchering',
        'other'
      )
      .required()
      .messages({
        'any.only': 'Please select a valid loss type',
        'string.empty': 'Loss type is required',
        'any.required': 'Loss type is required'
      }),
    
    urgency_level: Joi.string()
      .valid('normal', 'urgent', 'emergency')
      .default('normal')
      .messages({
        'any.only': 'Urgency level must be normal, urgent, or emergency'
      }),
    
    description: Joi.string()
      .max(1000)
      .allow('', null)
      .messages({
        'string.max': 'Description cannot exceed 1000 characters'
      }),
    
    // Optional UTM tracking parameters
    utm_source: Joi.string().max(100).allow('', null),
    utm_medium: Joi.string().max(100).allow('', null),
    utm_campaign: Joi.string().max(100).allow('', null),
    utm_content: Joi.string().max(100).allow('', null),
    utm_term: Joi.string().max(100).allow('', null),
    
    // GDPR consent (required for EU visitors)
    gdpr_consent: Joi.boolean().default(false),
    marketing_consent: Joi.boolean().default(false)
  });

  const { error, value } = schema.validate(req.body, {
    abortEarly: false, // Return all validation errors
    stripUnknown: true // Remove unknown fields
  });
  
  if (error) {
    const errorMessages = error.details.map(detail => detail.message);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorMessages,
      code: 'VALIDATION_ERROR'
    });
  }
  
  // Replace request body with validated and sanitized data
  req.body = value;
  next();
};

/**
 * Validate Google Ads lead update
 * For updating lead status, priority, notes, etc.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
exports.validateGoogleAdsLeadUpdate = (req, res, next) => {
  const schema = Joi.object({
    leadStatus: Joi.string()
      .valid('new', 'contacted', 'qualified', 'converted', 'closed', 'unqualified')
      .optional()
      .messages({
        'any.only': 'Invalid lead status'
      }),
    
    priority: Joi.string()
      .valid('normal', 'urgent', 'emergency')
      .optional()
      .messages({
        'any.only': 'Priority must be normal, urgent, or emergency'
      }),
    
    qualificationScore: Joi.number()
      .min(0)
      .max(100)
      .optional()
      .messages({
        'number.min': 'Qualification score cannot be negative',
        'number.max': 'Qualification score cannot exceed 100'
      }),
    
    qualificationNotes: Joi.string()
      .max(500)
      .allow('', null)
      .optional()
      .messages({
        'string.max': 'Qualification notes cannot exceed 500 characters'
      }),
    
    assignedTo: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Invalid user ID format'
      }),
    
    // Contact note fields
    contactNote: Joi.string()
      .max(500)
      .optional()
      .messages({
        'string.max': 'Contact note cannot exceed 500 characters'
      }),
    
    contactMethod: Joi.string()
      .valid('phone', 'email', 'whatsapp', 'sms')
      .when('contactNote', {
        is: Joi.exist(),
        then: Joi.required(),
        otherwise: Joi.optional()
      })
      .messages({
        'any.only': 'Contact method must be phone, email, whatsapp, or sms',
        'any.required': 'Contact method is required when adding a contact note'
      }),
    
    contactOutcome: Joi.string()
      .valid('answered', 'voicemail', 'no-answer', 'busy', 'invalid', 'callback-requested')
      .when('contactNote', {
        is: Joi.exist(),
        then: Joi.required(),
        otherwise: Joi.optional()
      })
      .messages({
        'any.only': 'Invalid contact outcome',
        'any.required': 'Contact outcome is required when adding a contact note'
      })
  });

  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    const errorMessages = error.details.map(detail => detail.message);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorMessages,
      code: 'VALIDATION_ERROR'
    });
  }
  
  req.body = value;
  next();
};

/**
 * Validate lead search/filter parameters
 * For dashboard filtering and searching
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
exports.validateGoogleAdsLeadSearch = (req, res, next) => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string()
      .valid('createdAt', 'name', 'email', 'leadStatus', 'priority', 'contactAttempts')
      .default('createdAt'),
    sortOrder: Joi.string()
      .valid('asc', 'desc')
      .default('desc'),
    
    // Filter parameters
    leadStatus: Joi.alternatives().try(
      Joi.string().valid('new', 'contacted', 'qualified', 'converted', 'closed', 'unqualified'),
      Joi.array().items(Joi.string().valid('new', 'contacted', 'qualified', 'converted', 'closed', 'unqualified'))
    ).optional(),
    
    priority: Joi.alternatives().try(
      Joi.string().valid('normal', 'urgent', 'emergency'),
      Joi.array().items(Joi.string().valid('normal', 'urgent', 'emergency'))
    ).optional(),
    
    lossType: Joi.alternatives().try(
      Joi.string().valid('cryptocurrency-recovery', 'investment-fraud', 'financial-scam', 'binary-options', 'forex-scam', 'romance-scam', 'pig-butchering', 'other'),
      Joi.array().items(Joi.string().valid('cryptocurrency-recovery', 'investment-fraud', 'financial-scam', 'binary-options', 'forex-scam', 'romance-scam', 'pig-butchering', 'other'))
    ).optional(),
    
    source: Joi.alternatives().try(
      Joi.string().valid('google-ads', 'facebook-ads', 'landing-page', 'other'),
      Joi.array().items(Joi.string().valid('google-ads', 'facebook-ads', 'landing-page', 'other'))
    ).optional(),
    
    assignedTo: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional(),
    
    // Date range filters
    dateFrom: Joi.date().iso().optional(),
    dateTo: Joi.date().iso().min(Joi.ref('dateFrom')).optional(),
    
    // Search query
    search: Joi.string().max(100).optional(),
    
    // Special filters
    overdue: Joi.boolean().optional(),
    unassigned: Joi.boolean().optional()
  });

  const { error, value } = schema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    const errorMessages = error.details.map(detail => detail.message);
    return res.status(400).json({
      success: false,
      message: 'Invalid search parameters',
      errors: errorMessages,
      code: 'VALIDATION_ERROR'
    });
  }
  
  req.query = value;
  next();
};

/**
 * Rate limiting validation for Google Ads leads
 * Prevents spam submissions from same IP
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
exports.validateRateLimit = async (req, res, next) => {
  try {
    const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    const GoogleAdsLead = require('../models/GoogleAdsLead');
    
    // Check submissions from this IP in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentSubmissions = await GoogleAdsLead.countDocuments({
      ipAddress: clientIp,
      createdAt: { $gte: oneHourAgo }
    });
    
    // Allow max 5 submissions per IP per hour
    if (recentSubmissions >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Too many submissions from this IP address. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 3600 // 1 hour in seconds
      });
    }
    
    // Check for duplicate email/phone in last 24 hours (prevent duplicate leads)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const duplicateLead = await GoogleAdsLead.findOne({
      $or: [
        { email: req.body.email },
        { phone: req.body.phone }
      ],
      createdAt: { $gte: twentyFourHoursAgo }
    });
    
    if (duplicateLead) {
      return res.status(409).json({
        success: false,
        message: 'A request with this email or phone number was already submitted recently.',
        code: 'DUPLICATE_SUBMISSION',
        existingReference: duplicateLead.referenceNumber
      });
    }
    
    // Store IP address for tracking
    req.clientIp = clientIp;
    next();
    
  } catch (error) {
    console.error('Rate limit validation error:', error);
    // Don't block submission if rate limiting fails
    next();
  }
};

/**
 * Sanitize input data to prevent XSS and injection attacks
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
exports.sanitizeInput = (req, res, next) => {
  try {
    const sanitizeString = (str) => {
      if (typeof str !== 'string') return str;
      
      // Remove HTML tags and potentially dangerous characters
      return str
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '')
        .replace(/[<>'"]/g, '')
        .trim();
    };
    
    // Sanitize all string fields in request body
    if (req.body) {
      Object.keys(req.body).forEach(key => {
        if (typeof req.body[key] === 'string') {
          req.body[key] = sanitizeString(req.body[key]);
        }
      });
    }
    
    next();
  } catch (error) {
    console.error('Input sanitization error:', error);
    next();
  }
};

module.exports = {
  validateGoogleAdsLead: exports.validateGoogleAdsLead,
  validateGoogleAdsLeadUpdate: exports.validateGoogleAdsLeadUpdate,
  validateGoogleAdsLeadSearch: exports.validateGoogleAdsLeadSearch,
  validateRateLimit: exports.validateRateLimit,
  sanitizeInput: exports.sanitizeInput
}; 