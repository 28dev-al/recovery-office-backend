const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const RefreshToken = require('../../models/RefreshToken');
const app = require('../../server');

// Mock .env values for tests
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

let mongoServer;

/**
 * Connect to a new in-memory database before running tests
 */
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

/**
 * Remove and close the db and server after all tests
 */
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

/**
 * Clear database collections between tests
 */
afterEach(async () => {
  await User.deleteMany({});
  await RefreshToken.deleteMany({});
});

describe('Auth Controller', () => {
  describe('User Registration', () => {
    test('Should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          password: 'password123'
        });
      
      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data.user).toHaveProperty('_id');
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.user.role).toBe('staff');
      expect(response.body.data.tokens).toHaveProperty('accessToken');
      expect(response.body.data.tokens).toHaveProperty('refreshToken');
      
      // User should be in database
      const user = await User.findOne({ email: 'test@example.com' });
      expect(user).not.toBeNull();
    });
    
    test('Should not register a user with an existing email', async () => {
      // First create a user
      await User.create({
        firstName: 'Existing',
        lastName: 'User',
        email: 'existing@example.com',
        password: 'password123'
      });
      
      // Try to register with the same email
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Test',
          lastName: 'User',
          email: 'existing@example.com',
          password: 'password123'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('EMAIL_IN_USE');
    });
  });
  
  describe('User Login', () => {
    test('Should login a user successfully', async () => {
      // Create a test user
      const user = await User.create({
        firstName: 'Login',
        lastName: 'Test',
        email: 'login@example.com',
        password: 'password123'
      });
      
      // Login with the created user
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'password123'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.user).toHaveProperty('_id');
      expect(response.body.data.user.email).toBe('login@example.com');
      expect(response.body.data.tokens).toHaveProperty('accessToken');
      expect(response.body.data.tokens).toHaveProperty('refreshToken');
    });
    
    test('Should not login with incorrect password', async () => {
      // Create a test user
      const user = await User.create({
        firstName: 'Login',
        lastName: 'Test',
        email: 'login@example.com',
        password: 'password123'
      });
      
      // Try to login with incorrect password
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'wrongpassword'
        });
      
      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });
    
    test('Should not login with inactive account', async () => {
      // Create an inactive test user
      const user = await User.create({
        firstName: 'Inactive',
        lastName: 'User',
        email: 'inactive@example.com',
        password: 'password123',
        isActive: false
      });
      
      // Try to login with inactive account
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'inactive@example.com',
          password: 'password123'
        });
      
      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('ACCOUNT_DEACTIVATED');
    });
  });
  
  describe('Token Refresh', () => {
    test('Should refresh tokens successfully', async () => {
      // Create a test user
      const user = await User.create({
        firstName: 'Refresh',
        lastName: 'Test',
        email: 'refresh@example.com',
        password: 'password123'
      });
      
      // Generate a refresh token
      const refreshToken = user.generateRefreshToken();
      
      // Store token in database
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now
      
      await RefreshToken.create({
        token: refreshToken,
        userId: user._id,
        expiresAt,
        ip: '127.0.0.1'
      });
      
      // Use token to get a new access token
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken
        });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.tokens).toHaveProperty('accessToken');
      expect(response.body.data.tokens).toHaveProperty('refreshToken');
    });
    
    test('Should not refresh with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'invalid-token'
        });
      
      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
    });
  });
  
  describe('Protected Routes', () => {
    test('Should access protected route with valid token', async () => {
      // Create a test user
      const user = await User.create({
        firstName: 'Protected',
        lastName: 'Route',
        email: 'protected@example.com',
        password: 'password123'
      });
      
      // Generate a token
      const token = user.generateAuthToken();
      
      // Access protected route
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.user.email).toBe('protected@example.com');
    });
    
    test('Should not access protected route with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
    });
    
    test('Should not access protected route without token', async () => {
      const response = await request(app)
        .get('/api/auth/me');
      
      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('AUTH_REQUIRED');
    });
  });
}); 