/**
 * Test Factory for generating test data
 * Provides easy-to-use functions for creating consistent test entities
 */
const mongoose = require('mongoose');
const User = require('../../models/User');
const Client = require('../../models/Client');
const Service = require('../../models/Service');
const Booking = require('../../models/Booking');
const Slot = require('../../models/Slot');
const RefreshToken = require('../../models/RefreshToken');

/**
 * Create a user with given properties or defaults
 * 
 * @param {Object} userProps - User properties to override defaults
 * @returns {Promise<Object>} Created user document
 */
exports.createUser = async (userProps = {}) => {
  const defaultProps = {
    firstName: 'Test',
    lastName: 'User',
    email: `test${Math.floor(Math.random() * 10000)}@example.com`,
    password: 'password123',
    role: 'staff',
    isActive: true
  };
  
  const userDetails = { ...defaultProps, ...userProps };
  return await User.create(userDetails);
};

/**
 * Create an admin user
 * 
 * @param {Object} adminProps - Admin properties to override defaults
 * @returns {Promise<Object>} Created admin user document
 */
exports.createAdmin = async (adminProps = {}) => {
  return await exports.createUser({ 
    role: 'admin', 
    email: `admin${Math.floor(Math.random() * 10000)}@example.com`,
    ...adminProps
  });
};

/**
 * Create a client with given properties or defaults
 * 
 * @param {Object} clientProps - Client properties to override defaults
 * @returns {Promise<Object>} Created client document
 */
exports.createClient = async (clientProps = {}) => {
  const defaultProps = {
    firstName: 'Test',
    lastName: 'Client',
    email: `client${Math.floor(Math.random() * 10000)}@example.com`,
    phone: '+441234567890',
    preferredContactMethod: 'email',
    gdprConsent: true,
    marketingConsent: false
  };
  
  const clientDetails = { ...defaultProps, ...clientProps };
  return await Client.create(clientDetails);
};

/**
 * Create a service with given properties or defaults
 * 
 * @param {Object} serviceProps - Service properties to override defaults
 * @returns {Promise<Object>} Created service document
 */
exports.createService = async (serviceProps = {}) => {
  const defaultProps = {
    name: 'Test Service',
    description: 'This is a test service',
    duration: 60,
    price: 100,
    category: 'consultation',
    isActive: true
  };
  
  const serviceDetails = { ...defaultProps, ...serviceProps };
  return await Service.create(serviceDetails);
};

/**
 * Create a booking with given properties or defaults
 * 
 * @param {Object} bookingProps - Booking properties to override defaults
 * @param {boolean} createDependencies - Whether to create client and service if not provided
 * @returns {Promise<Object>} Created booking document
 */
exports.createBooking = async (bookingProps = {}, createDependencies = true) => {
  // Create client and service if not provided and createDependencies is true
  let clientId = bookingProps.clientId;
  let serviceId = bookingProps.serviceId;
  
  if (createDependencies) {
    if (!clientId) {
      const client = await exports.createClient();
      clientId = client._id;
    }
    
    if (!serviceId) {
      const service = await exports.createService();
      serviceId = service._id;
    }
  }
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowFormatted = tomorrow.toISOString().split('T')[0];
  
  const defaultProps = {
    clientId,
    serviceId,
    date: tomorrowFormatted,
    timeSlot: '10:00-11:00',
    status: 'confirmed',
    notes: 'Test booking'
  };
  
  const bookingDetails = { ...defaultProps, ...bookingProps };
  return await Booking.create(bookingDetails);
};

/**
 * Create a time slot with given properties or defaults
 * 
 * @param {Object} slotProps - Slot properties to override defaults
 * @param {boolean} createDependencies - Whether to create service if not provided
 * @returns {Promise<Object>} Created slot document
 */
exports.createSlot = async (slotProps = {}, createDependencies = true) => {
  // Create service if not provided and createDependencies is true
  let serviceId = slotProps.serviceId;
  
  if (createDependencies && !serviceId) {
    const service = await exports.createService();
    serviceId = service._id;
  }
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowFormatted = tomorrow.toISOString().split('T')[0];
  
  const defaultProps = {
    serviceId,
    date: tomorrowFormatted,
    timeSlot: '10:00-11:00',
    isAvailable: true
  };
  
  const slotDetails = { ...defaultProps, ...slotProps };
  return await Slot.create(slotDetails);
};

/**
 * Create a refresh token for a user
 * 
 * @param {Object} user - User to create token for
 * @param {Object} tokenProps - Token properties to override defaults
 * @returns {Promise<Object>} Created refresh token document and token string
 */
exports.createRefreshToken = async (user, tokenProps = {}) => {
  if (!user) {
    throw new Error('User is required to create a refresh token');
  }
  
  const token = user.generateRefreshToken();
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now
  
  const defaultProps = {
    token,
    userId: user._id,
    expiresAt,
    ip: '127.0.0.1',
    userAgent: 'Test Browser',
    isRevoked: false
  };
  
  const tokenDetails = { ...defaultProps, ...tokenProps };
  const refreshToken = await RefreshToken.create(tokenDetails);
  
  return { refreshToken, token };
};

/**
 * Generate a JWT token for a user
 * 
 * @param {Object} user - User to generate token for
 * @returns {string} JWT token
 */
exports.generateToken = (user) => {
  if (!user) {
    throw new Error('User is required to generate a token');
  }
  
  return user.generateAuthToken();
};

/**
 * Clean up test data
 * 
 * @returns {Promise<void>}
 */
exports.cleanup = async () => {
  await User.deleteMany({});
  await Client.deleteMany({});
  await Service.deleteMany({});
  await Booking.deleteMany({});
  await Slot.deleteMany({});
  await RefreshToken.deleteMany({});
}; 