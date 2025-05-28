const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const { 
  ValidationError, 
  AuthenticationError, 
  ConflictError 
} = require('../utils/AppError');

/**
 * Register a new user
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with user and token
 */
exports.register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;
    
    // Only allow admin users to create other admin users, staff is default
    const userRole = role === 'admin' ? 'staff' : 'staff';
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new ConflictError('Email already in use', 'EMAIL_IN_USE');
    }
    
    // Create new user
    const newUser = await User.create({
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
      role: userRole // Ensure only staff accounts are created through registration
    });
    
    // Generate tokens
    const accessToken = newUser.generateAuthToken();
    const refreshToken = newUser.generateRefreshToken();
    
    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now
    
    await RefreshToken.create({
      token: refreshToken,
      userId: newUser._id,
      expiresAt,
      ip: req.ip || null,
      userAgent: req.headers['user-agent'] || null
    });
    
    // Update last login
    newUser.lastLogin = Date.now();
    await newUser.save({ validateBeforeSave: false });
    
    // Remove password from response
    newUser.password = undefined;
    
    // Log successful registration
    req.logger?.info({
      message: `User registered: ${newUser._id}`,
      userId: newUser._id
    });
    
    return res.status(201).json({
      status: 'success',
      data: {
        user: newUser,
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: process.env.JWT_EXPIRES_IN || '1h'
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Login user
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with user and tokens
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Validate email and password
    if (!email || !password) {
      throw new ValidationError('Please provide email and password', 'MISSING_CREDENTIALS');
    }
    
    // Find user with password
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    
    // Check if user exists and password is correct
    if (!user || !(await user.comparePassword(password))) {
      throw new AuthenticationError('Incorrect email or password', 'INVALID_CREDENTIALS');
    }
    
    // Check if user is active
    if (!user.isActive) {
      throw new AuthenticationError(
        'Your account has been deactivated. Please contact an administrator',
        'ACCOUNT_DEACTIVATED'
      );
    }
    
    // Generate tokens
    const accessToken = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken();
    
    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now
    
    await RefreshToken.create({
      token: refreshToken,
      userId: user._id,
      expiresAt,
      ip: req.ip || null,
      userAgent: req.headers['user-agent'] || null
    });
    
    // Update last login
    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });
    
    // Remove password from response
    user.password = undefined;
    
    // Log successful login
    req.logger?.info({
      message: `User logged in: ${user._id}`,
      userId: user._id
    });
    
    return res.status(200).json({
      status: 'success',
      data: {
        user,
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: process.env.JWT_EXPIRES_IN || '1h'
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Refresh access token using refresh token
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with new tokens
 */
exports.refreshToken = async (req, res, next) => {
  try {
    // The verifyRefreshToken middleware already validated the token
    // and added user and refreshToken to request object
    const { user, refreshToken: tokenDocument } = req;
    
    // Generate new tokens
    const accessToken = user.generateAuthToken();
    const newRefreshToken = user.generateRefreshToken();
    
    // Store new refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now
    
    await RefreshToken.create({
      token: newRefreshToken,
      userId: user._id,
      expiresAt,
      ip: req.ip || null,
      userAgent: req.headers['user-agent'] || null
    });
    
    // Revoke old refresh token (token rotation for security)
    tokenDocument.isRevoked = true;
    await tokenDocument.save();
    
    return res.status(200).json({
      status: 'success',
      data: {
        tokens: {
          accessToken,
          refreshToken: newRefreshToken,
          expiresIn: process.env.JWT_EXPIRES_IN || '1h'
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Logout user (revoke refresh token)
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response
 */
exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      // Find and revoke the refresh token
      await RefreshToken.findOneAndUpdate(
        { token: refreshToken },
        { isRevoked: true }
      );
    }
    
    return res.status(200).json({
      status: 'success',
      message: 'Successfully logged out'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get current user information
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with user data
 */
exports.getCurrentUser = async (req, res, next) => {
  try {
    const user = req.user;
    
    return res.status(200).json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (err) {
    next(err);
  }
}; 