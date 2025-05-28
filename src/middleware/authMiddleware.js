/**
 * Authentication middleware for protecting routes
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { 
  AuthenticationError, 
  AuthorizationError, 
  ValidationError 
} = require('../utils/AppError');

/**
 * Basic API key authentication for admin routes (legacy method)
 * This will eventually be deprecated in favor of JWT authentication
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
exports.apiKeyAuth = (req, res, next) => {
  // Get API key from request header
  const apiKey = req.headers['x-api-key'];
  
  // Check if API key exists and matches the environment variable
  if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
    return next(new AuthenticationError('Unauthorized access', 'UNAUTHORIZED'));
  }
  
  next();
};

/**
 * JWT authentication middleware
 * Verifies the JWT token from Authorization header
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
exports.protect = async (req, res, next) => {
  try {
    // 1) Get token from authorization header
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      throw new AuthenticationError(
        'You are not logged in. Please log in to get access',
        'AUTH_REQUIRED'
      );
    }

    // 2) Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 3) Check if user still exists
    const user = await User.findById(decoded.id);
    if (!user) {
      throw new AuthenticationError(
        'The user belonging to this token no longer exists',
        'USER_NOT_FOUND'
      );
    }
    
    // 4) Check if user changed password after token was issued
    if (user.isPasswordChangedAfterTokenIssued(decoded.iat)) {
      throw new AuthenticationError(
        'User recently changed password. Please log in again',
        'PASSWORD_CHANGED'
      );
    }

    // 5) Check if user is active
    if (!user.isActive) {
      throw new AuthenticationError(
        'This user account has been deactivated',
        'USER_INACTIVE'
      );
    }
    
    // Add user to request object
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return next(new AuthenticationError(
        'Invalid token. Please log in again',
        'INVALID_TOKEN'
      ));
    }
    
    if (err.name === 'TokenExpiredError') {
      return next(new AuthenticationError(
        'Your token has expired. Please log in again',
        'TOKEN_EXPIRED'
      ));
    }
    
    next(err);
  }
};

/**
 * Role-based access restriction middleware
 * 
 * @param {...String} roles - Allowed roles for the route
 * @returns {Function} Middleware function
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // Check if user has the required role
    if (!roles.includes(req.user.role)) {
      return next(new AuthorizationError(
        'You do not have permission to perform this action',
        'FORBIDDEN'
      ));
    }
    
    next();
  };
};

/**
 * Verify refresh token middleware
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
exports.verifyRefreshToken = async (req, res, next) => {
  try {
    // 1) Get refresh token from request body
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw new ValidationError(
        'Refresh token is required',
        'REFRESH_TOKEN_REQUIRED'
      );
    }
    
    // 2) Verify token signature
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    // 3) Check if token type is refresh
    if (decoded.type !== 'refresh') {
      throw new AuthenticationError(
        'Invalid token type',
        'INVALID_TOKEN_TYPE'
      );
    }
    
    // 4) Check if token exists in database and is not revoked
    const storedToken = await RefreshToken.findOne({ token: refreshToken, isRevoked: false });
    
    if (!storedToken) {
      throw new AuthenticationError(
        'Invalid or revoked refresh token',
        'INVALID_REFRESH_TOKEN'
      );
    }
    
    // 5) Check if token is expired
    if (storedToken.isExpired()) {
      // Revoke the token
      storedToken.isRevoked = true;
      await storedToken.save();
      
      throw new AuthenticationError(
        'Refresh token expired',
        'REFRESH_TOKEN_EXPIRED'
      );
    }
    
    // 6) Get user
    const user = await User.findById(decoded.id);
    
    if (!user || !user.isActive) {
      // Revoke the token
      storedToken.isRevoked = true;
      await storedToken.save();
      
      throw new AuthenticationError(
        'User not found or inactive',
        'USER_NOT_FOUND_OR_INACTIVE'
      );
    }
    
    // Add user and token to request
    req.user = user;
    req.refreshToken = storedToken;
    
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return next(new AuthenticationError(
        'Invalid refresh token',
        'INVALID_REFRESH_TOKEN'
      ));
    }
    
    if (err.name === 'TokenExpiredError') {
      return next(new AuthenticationError(
        'Refresh token expired',
        'REFRESH_TOKEN_EXPIRED'
      ));
    }
    
    next(err);
  }
};

/**
 * Admin access restriction middleware (shortcut for restrictTo('admin'))
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
exports.adminOnly = (req, res, next) => {
  // Check if user exists and has admin role
  if (!req.user || req.user.role !== 'admin') {
    return next(new AuthorizationError(
      'This route is restricted to admin users',
      'ADMIN_ONLY'
    ));
  }
  
  next();
}; 