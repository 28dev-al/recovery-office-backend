const Joi = require('joi');

/**
 * Validate booking request
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
exports.validateBooking = (req, res, next) => {
  const schema = Joi.object({
    clientId: Joi.string().required().messages({
      'string.empty': 'Client ID is required',
      'any.required': 'Client ID is required'
    }),
    serviceId: Joi.string().required().messages({
      'string.empty': 'Service ID is required',
      'any.required': 'Service ID is required'
    }),
    serviceName: Joi.string().max(100).allow('', null).messages({
      'string.max': 'Service name cannot exceed 100 characters'
    }),
    date: Joi.alternatives().try(
      Joi.date().iso(),
      Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)
    ).required().messages({
      'alternatives.match': 'Date must be a valid date in YYYY-MM-DD format or ISO format',
      'any.required': 'Date is required'
    }),
    timeSlot: Joi.alternatives().try(
      Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
      Joi.string().max(50)
    ).required().messages({
      'alternatives.match': 'Time slot must be in format HH:MM-HH:MM or valid time string',
      'string.empty': 'Time slot is required',
      'any.required': 'Time slot is required'
    }),
    notes: Joi.string().max(500).allow('', null).messages({
      'string.max': 'Notes cannot exceed 500 characters'
    }),
    // Additional fields for recovery consultation bookings
    urgencyLevel: Joi.string().valid('standard', 'urgent', 'emergency').default('standard'),
    estimatedValue: Joi.number().min(0).max(100000000).allow(null).messages({
      'number.min': 'Estimated value cannot be negative',
      'number.max': 'Please contact us directly for amounts over £100M'
    }),
    status: Joi.string().valid('pending', 'confirmed', 'cancelled', 'completed').default('confirmed')
  });

  const { error } = schema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.details[0].message,
      code: 'VALIDATION_ERROR'
    });
  }
  
  next();
};

/**
 * Validate client registration
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
exports.validateClientRegistration = (req, res, next) => {
  const schema = Joi.object({
    firstName: Joi.string().max(50).required().messages({
      'string.empty': 'First name is required',
      'string.max': 'First name cannot exceed 50 characters',
      'any.required': 'First name is required'
    }),
    lastName: Joi.string().max(50).required().messages({
      'string.empty': 'Last name is required',
      'string.max': 'Last name cannot exceed 50 characters',
      'any.required': 'Last name is required'
    }),
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'string.empty': 'Email is required',
      'any.required': 'Email is required'
    }),
    phone: Joi.string().pattern(/^(\+\d{1,3}[- ]?)?\d{10,14}$/).required().messages({
      'string.pattern.base': 'Please provide a valid phone number',
      'string.empty': 'Phone number is required',
      'any.required': 'Phone number is required'
    }),
    preferredContactMethod: Joi.string().valid('email', 'phone', 'both').default('email'),
    gdprConsent: Joi.boolean().required().valid(true).messages({
      'any.only': 'GDPR consent is required',
      'any.required': 'GDPR consent is required'
    }),
    marketingConsent: Joi.boolean().default(false),
    notes: Joi.string().max(1000).allow('', null).messages({
      'string.max': 'Notes cannot exceed 1000 characters'
    }),
    // Additional fields for recovery consultation bookings
    company: Joi.string().max(100).allow('', null).messages({
      'string.max': 'Company name cannot exceed 100 characters'
    }),
    caseType: Joi.string().valid(
      'cryptocurrency-recovery', 
      'investment-fraud', 
      'financial-scam', 
      'regulatory-complaint',
      'other'
    ).default('other'),
    estimatedLoss: Joi.number().min(0).max(100000000).allow(null).messages({
      'number.min': 'Estimated loss cannot be negative',
      'number.max': 'Please contact us directly for amounts over £100M'
    }),
    urgencyLevel: Joi.string().valid('standard', 'urgent', 'emergency').default('standard'),
    // Additional notes fields
    additionalNotes: Joi.string().max(1000).allow('', null).messages({
      'string.max': 'Additional notes cannot exceed 1000 characters'
    })
  });

  const { error } = schema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.details[0].message,
      code: 'VALIDATION_ERROR'
    });
  }
  
  next();
};

/**
 * Validate user login request
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
exports.validateLogin = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'string.empty': 'Email is required',
      'any.required': 'Email is required'
    }),
    password: Joi.string().required().messages({
      'string.empty': 'Password is required',
      'any.required': 'Password is required'
    })
  });

  const { error } = schema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.details[0].message,
      code: 'VALIDATION_ERROR'
    });
  }
  
  next();
};

/**
 * Validate user registration request
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
exports.validateUserRegistration = (req, res, next) => {
  const schema = Joi.object({
    firstName: Joi.string().max(50).required().messages({
      'string.empty': 'First name is required',
      'string.max': 'First name cannot exceed 50 characters',
      'any.required': 'First name is required'
    }),
    lastName: Joi.string().max(50).required().messages({
      'string.empty': 'Last name is required',
      'string.max': 'Last name cannot exceed 50 characters',
      'any.required': 'Last name is required'
    }),
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'string.empty': 'Email is required',
      'any.required': 'Email is required'
    }),
    password: Joi.string().min(8).required().messages({
      'string.empty': 'Password is required',
      'string.min': 'Password must be at least 8 characters long',
      'any.required': 'Password is required'
    }),
    role: Joi.string().valid('admin', 'staff').default('staff')
  });

  const { error } = schema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.details[0].message,
      code: 'VALIDATION_ERROR'
    });
  }
  
  next();
};

/**
 * Validate refresh token request
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
exports.validateRefreshToken = (req, res, next) => {
  const schema = Joi.object({
    refreshToken: Joi.string().required().messages({
      'string.empty': 'Refresh token is required',
      'any.required': 'Refresh token is required'
    })
  });

  const { error } = schema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.details[0].message,
      code: 'VALIDATION_ERROR'
    });
  }
  
  next();
}; 