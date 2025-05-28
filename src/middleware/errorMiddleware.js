/**
 * Custom error handling middleware for the Recovery Office API
 */
const { AppError } = require('../utils/AppError');
const logger = require('../utils/logger');

// Handle 404 errors
const notFound = (req, res, next) => {
  const error = new AppError(`Not Found - ${req.originalUrl}`, 'RESOURCE_NOT_FOUND', 404);
  next(error);
};

// Main error handler
const errorHandler = (err, req, res, next) => {
  // Log error
  logger.error({
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode || 500,
    errorCode: err.errorCode || 'SERVER_ERROR',
    path: req.originalUrl,
    method: req.method,
    requestId: req.id,
    isOperational: err.isOperational
  });
  
  // Determine the response status text
  const status = (err.statusCode && err.statusCode < 500) ? 'fail' : 'error';
  
  // Mongoose duplicate key error
  if (err.code === 11000) {
    return res.status(400).json({
      status: 'fail',
      message: 'Duplicate resource found',
      details: err.keyValue,
      code: 'DUPLICATE_RESOURCE'
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({
      status: 'fail',
      message: 'Validation failed',
      details: errors,
      code: 'VALIDATION_FAILED'
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 'fail',
      message: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      status: 'fail',
      message: 'Token expired',
      code: 'TOKEN_EXPIRED'
    });
  }
  
  // If the error is a known AppError
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: status,
      message: err.message,
      code: err.errorCode,
      details: err.details,
      // Only include stack trace in development mode for operational errors
      ...(process.env.NODE_ENV === 'development' && err.isOperational 
          ? { stack: err.stack } 
          : {})
    });
  }

  // For unknown errors
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong' 
      : (err.message || 'An unexpected error occurred'),
    code: err.code || 'SERVER_ERROR',
    // Only include stack trace in development
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
};

module.exports = { notFound, errorHandler }; 