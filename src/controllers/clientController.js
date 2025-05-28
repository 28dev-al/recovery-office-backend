const Client = require('../models/Client');

/**
 * Register a new client
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with client details
 */
exports.registerClient = async (req, res, next) => {
  try {
    const { 
      firstName, 
      lastName, 
      email, 
      phone, 
      preferredContactMethod, 
      gdprConsent, 
      marketingConsent,
      // Additional recovery consultation fields
      company,
      caseType,
      estimatedLoss,
      urgencyLevel,
      additionalNotes
    } = req.body;

    console.log('[Client Controller] Creating client with data:', {
      firstName,
      lastName,
      email,
      phone,
      company,
      caseType,
      estimatedLoss,
      urgencyLevel
    });

    // Validate required fields
    if (!firstName || !lastName || !email || !phone) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required client information',
        code: 'MISSING_PARAMETERS'
      });
    }

    // Check if client already exists with this email
    const existingClient = await Client.findOne({ email: email.toLowerCase() });
    if (existingClient) {
      console.log('[Client Controller] Client already exists:', existingClient._id);
      return res.status(200).json({
        status: 'success',
        message: 'Client already exists',
        data: existingClient
      });
    }

    // Create new client with all fields
    const clientData = {
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone,
      preferredContactMethod: preferredContactMethod || 'email',
      gdprConsent: gdprConsent || false,
      marketingConsent: marketingConsent || false,
      notes: req.body.notes || additionalNotes || '',
      status: 'active'
    };

    // Add recovery consultation specific fields if provided
    if (company) clientData.company = company;
    if (caseType) clientData.caseType = caseType;
    if (estimatedLoss !== undefined) clientData.estimatedLoss = estimatedLoss;
    if (urgencyLevel) clientData.urgencyLevel = urgencyLevel;

    const client = await Client.create(clientData);

    console.log('[Client Controller] Client created successfully:', client._id);

    return res.status(201).json({
      success: true,
      data: {
        _id: client._id,
        ...client.toObject()
      }
    });
  } catch (err) {
    console.error('[Client Controller] Error creating client:', err);
    
    // Handle duplicate key error
    if (err.code === 11000) {
      return res.status(400).json({
        status: 'error',
        message: 'A client with this email already exists',
        code: 'DUPLICATE_EMAIL'
      });
    }
    next(err);
  }
};

/**
 * Get client by ID
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with client
 */
exports.getClientById = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({
        status: 'error',
        message: 'Client not found',
        code: 'CLIENT_NOT_FOUND'
      });
    }

    return res.status(200).json({
      status: 'success',
      data: client
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get client bookings
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with client's bookings
 */
exports.getClientBookings = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({
        status: 'error',
        message: 'Client not found',
        code: 'CLIENT_NOT_FOUND'
      });
    }

    // Get active bookings for this client
    const bookings = await client.getActiveBookings();

    return res.status(200).json({
      status: 'success',
      results: bookings.length,
      data: bookings
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update client
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with updated client
 */
exports.updateClient = async (req, res, next) => {
  try {
    // Allowed fields to update
    const allowedUpdates = [
      'firstName', 
      'lastName', 
      'phone', 
      'preferredContactMethod', 
      'gdprConsent', 
      'marketingConsent', 
      'notes', 
      'status'
    ];
    
    // Filter out non-allowed fields
    const updateData = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updateData[key] = req.body[key];
      }
    });
    
    const client = await Client.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    );

    if (!client) {
      return res.status(404).json({
        status: 'error',
        message: 'Client not found',
        code: 'CLIENT_NOT_FOUND'
      });
    }

    return res.status(200).json({
      status: 'success',
      data: client
    });
  } catch (err) {
    next(err);
  }
}; 