const Service = require('../models/Service');
const mongoose = require('mongoose');

/**
 * Get all services
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with services
 */
exports.getAllServices = async (req, res, next) => {
  try {
    console.log('🔧 [Services API] Fetching services from database...');
    
    // Add query parameters for filtering
    const filter = { isActive: true };
    
    if (req.query.category) {
      filter.category = req.query.category;
    }

    const services = await Service.find(filter).sort('name').lean();
    
    console.log('🔧 [Services API] Raw database services:', services.length);

    // CRITICAL: Ensure every service has proper _id field
    const formattedServices = services.map((service, index) => {
      // Validate that _id exists and is valid
      if (!service._id) {
        console.error('🚨 [Services API] Service missing _id:', service.name || `Service ${index}`);
        // Generate temporary ObjectId for development
        service._id = new mongoose.Types.ObjectId();
      }

      // Ensure _id is properly formatted
      const serviceId = service._id.toString();
      
      return {
        _id: service._id,                    // CRITICAL: Include MongoDB ObjectId
        id: serviceId,                       // Also provide as string for compatibility
        name: service.name,
        description: service.description,
        duration: service.duration,
        price: service.price,
        icon: service.icon,
        category: service.category,
        isActive: service.isActive,
        slug: service.slug,
        createdAt: service.createdAt,
        updatedAt: service.updatedAt,
        // Formatted fields for frontend
        formattedPrice: service.price ? `£${service.price}` : '£0',
        formattedDuration: service.duration === 60 ? '1 hour' : 
                          service.duration > 60 ? `${Math.floor(service.duration / 60)} hour ${service.duration % 60} minutes` :
                          `${service.duration} minutes`,
        // Debug info for development
        debugInfo: {
          hasMongoId: !!service._id,
          mongoIdString: serviceId,
          isValidObjectId: mongoose.Types.ObjectId.isValid(service._id)
        }
      };
    });

    console.log('✅ [Services API] All services have _id field:', formattedServices.every(s => s._id));
    console.log('✅ [Services API] Sample service structure:', {
      id: formattedServices[0]?.id,
      _id: formattedServices[0]?._id,
      name: formattedServices[0]?.name,
      hasDebugInfo: !!formattedServices[0]?.debugInfo
    });

    return res.status(200).json(formattedServices);
  } catch (err) {
    console.error('🚨 [Services API] Error:', err);
    next(err);
  }
};

/**
 * Get service by ID
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with service
 */
exports.getServiceById = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return res.status(404).json({
        status: 'error',
        message: 'Service not found',
        code: 'SERVICE_NOT_FOUND'
      });
    }

    return res.status(200).json({
      status: 'success',
      data: service
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new service
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with created service
 */
exports.createService = async (req, res, next) => {
  try {
    const newService = await Service.create(req.body);

    return res.status(201).json({
      status: 'success',
      data: newService
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update a service
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with updated service
 */
exports.updateService = async (req, res, next) => {
  try {
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    if (!service) {
      return res.status(404).json({
        status: 'error',
        message: 'Service not found',
        code: 'SERVICE_NOT_FOUND'
      });
    }

    return res.status(200).json({
      status: 'success',
      data: service
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a service
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with deleted status
 */
exports.deleteService = async (req, res, next) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);

    if (!service) {
      return res.status(404).json({
        status: 'error',
        message: 'Service not found',
        code: 'SERVICE_NOT_FOUND'
      });
    }

    return res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get services by category
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with services
 */
exports.getServicesByCategory = async (req, res, next) => {
  try {
    const services = await Service.find({ 
      category: req.params.category,
      isActive: true 
    }).sort('name');

    return res.status(200).json({
      status: 'success',
      results: services.length,
      data: services
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get all service categories
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with categories
 */
exports.getServiceCategories = async (req, res, next) => {
  try {
    const categories = await Service.distinct('category', { isActive: true });

    return res.status(200).json({
      status: 'success',
      results: categories.length,
      data: categories
    });
  } catch (err) {
    next(err);
  }
}; 