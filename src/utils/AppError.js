/**
 * Base application error class
 * Extends Error to include operational status and additional metadata
 */
class AppError extends Error {
  constructor(message, errorCode, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode || 'ERROR';
    this.isOperational = isOperational;
    this.service = 'recovery-office-api';
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request - Validation Error
 */
class ValidationError extends AppError {
  constructor(message, errorCode = 'VALIDATION_ERROR', isOperational = true) {
    super(message, errorCode, 400, isOperational);
  }
}

/**
 * 404 Not Found - Resource Not Found Error
 */
class NotFoundError extends AppError {
  constructor(message, errorCode = 'RESOURCE_NOT_FOUND', isOperational = true) {
    super(message, errorCode, 404, isOperational);
  }
}

/**
 * 401 Unauthorized - Authentication Error
 */
class AuthenticationError extends AppError {
  constructor(message, errorCode = 'AUTHENTICATION_ERROR', isOperational = true) {
    super(message, errorCode, 401, isOperational);
  }
}

/**
 * 403 Forbidden - Authorization Error
 */
class AuthorizationError extends AppError {
  constructor(message, errorCode = 'AUTHORIZATION_ERROR', isOperational = true) {
    super(message, errorCode, 403, isOperational);
  }
}

/**
 * 409 Conflict - Resource Conflict Error
 */
class ConflictError extends AppError {
  constructor(message, errorCode = 'CONFLICT_ERROR', isOperational = true) {
    super(message, errorCode, 409, isOperational);
  }
}

/**
 * 500 Internal Server Error
 */
class InternalError extends AppError {
  constructor(message, errorCode = 'SERVER_ERROR', isOperational = false) {
    super(message, errorCode, 500, isOperational);
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  InternalError
}; 