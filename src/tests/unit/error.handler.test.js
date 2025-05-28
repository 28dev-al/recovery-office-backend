/**
 * Unit tests for error handling middleware
 */
const { errorHandler } = require('../../middleware/errorMiddleware');
const { AppError, ValidationError, NotFoundError, InternalError } = require('../../utils/AppError');
const logger = require('../../utils/logger');

// Mock the logger to prevent actual logging during tests
jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

describe('Error Handler Middleware', () => {
  // Set up mocks for request, response, and next
  let req;
  let res;
  let next;
  
  beforeEach(() => {
    // Mock environment for development mode
    process.env.NODE_ENV = 'development';
    
    // Reset mocks
    req = {
      originalUrl: '/test',
      method: 'GET',
      id: 'test-request-id'
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    next = jest.fn();
    
    // Clear all mocks
    jest.clearAllMocks();
  });
  
  test('should handle AppError in development mode', () => {
    // Create an AppError
    const error = new ValidationError('Validation failed', 'TEST_ERROR');
    error.details = { field: 'test' };
    
    // Call the error handler
    errorHandler(error, req, res, next);
    
    // Check if logger was called
    expect(logger.error).toHaveBeenCalled();
    
    // Check if response was called with correct status and payload
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'fail',
      message: 'Validation failed',
      code: 'TEST_ERROR',
      details: { field: 'test' },
      stack: expect.any(String)
    }));
  });
  
  test('should handle AppError in production mode without stack trace', () => {
    // Set environment to production
    process.env.NODE_ENV = 'production';
    
    // Create an AppError
    const error = new NotFoundError('Resource not found');
    
    // Call the error handler
    errorHandler(error, req, res, next);
    
    // Check if response was called with correct status and payload
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'fail',
      message: 'Resource not found',
      code: 'RESOURCE_NOT_FOUND'
    }));
    
    // Should not include stack trace
    expect(res.json.mock.calls[0][0]).not.toHaveProperty('stack');
  });
  
  test('should handle Mongoose validation errors', () => {
    // Mock a Mongoose validation error
    const error = new Error('Validation error');
    error.name = 'ValidationError';
    error.errors = {
      field1: { message: 'Field1 is required' },
      field2: { message: 'Field2 is invalid' }
    };
    
    // Call the error handler
    errorHandler(error, req, res, next);
    
    // Check if response was called with correct status and payload
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'fail',
      message: 'Validation failed',
      details: expect.arrayContaining(['Field1 is required', 'Field2 is invalid']),
      code: 'VALIDATION_FAILED'
    }));
  });
  
  test('should handle JWT errors', () => {
    // Mock a JWT error
    const error = new Error('Invalid signature');
    error.name = 'JsonWebTokenError';
    
    // Call the error handler
    errorHandler(error, req, res, next);
    
    // Check if response was called with correct status and payload
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'fail',
      message: 'Invalid token',
      code: 'INVALID_TOKEN'
    }));
  });
  
  test('should handle unknown errors in production with generic message', () => {
    // Set environment to production
    process.env.NODE_ENV = 'production';
    
    // Create a generic error
    const error = new Error('Something went wrong internally');
    
    // Call the error handler
    errorHandler(error, req, res, next);
    
    // Check if response was called with correct status and payload
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      message: 'Something went wrong'
    }));
    
    // Should not include stack trace
    expect(res.json.mock.calls[0][0]).not.toHaveProperty('stack');
  });
}); 