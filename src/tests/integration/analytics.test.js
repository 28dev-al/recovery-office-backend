const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Booking = require('../../models/Booking');
const Service = require('../../models/Service');
const Client = require('../../models/Client');
const Waitlist = require('../../models/Waitlist');
const User = require('../../models/User');
const jwt = require('jsonwebtoken');
const config = require('../../config');

// Set env to test
process.env.NODE_ENV = 'test';

// Import app after setting NODE_ENV
const app = require('../../server');

// Mock redis to avoid actual caching during tests
jest.mock('../../utils/redisClient', () => {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    expire: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1)
  };
});

describe('Analytics API', () => {
  let mongoServer;
  let adminToken;
  let serviceId;
  let clientId;
  
  // Setup in-memory MongoDB server
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Connect to the in-memory database
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    // Create admin user for testing protected routes
    const adminUser = await User.create({
      email: 'admin@test.com',
      password: 'Password123!',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin'
    });
    
    // Generate JWT for admin
    adminToken = jwt.sign(
      { id: adminUser._id, role: adminUser.role },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    
    // Seed test data
    await seedTestData();
  });
  
  // Clean up after tests
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });
  
  // Seed the database with test data
  async function seedTestData() {
    // Create a service
    const service = await Service.create({
      name: 'Financial Consultation',
      description: 'One-hour financial consultation session',
      duration: 60,
      price: 150,
      category: 'Consultation',
      isActive: true
    });
    serviceId = service._id;
    
    // Create a client
    const client = await Client.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '123-456-7890',
      marketingConsent: true
    });
    clientId = client._id;
    
    // Create bookings with different statuses
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    
    await Booking.create([
      {
        clientId,
        serviceId,
        date: today,
        timeSlot: '10:00-11:00',
        status: 'confirmed',
        createdAt: today
      },
      {
        clientId,
        serviceId,
        date: yesterday,
        timeSlot: '14:00-15:00',
        status: 'completed',
        createdAt: yesterday
      },
      {
        clientId,
        serviceId,
        date: twoDaysAgo,
        timeSlot: '09:00-10:00',
        status: 'cancelled',
        createdAt: twoDaysAgo
      },
      {
        clientId,
        serviceId,
        date: twoDaysAgo,
        timeSlot: '11:00-12:00',
        status: 'completed',
        isRecurring: true,
        createdAt: twoDaysAgo
      }
    ]);
    
    // Create waitlist entries
    await Waitlist.create([
      {
        clientId,
        serviceId,
        requestedDate: today,
        preferredTimeSlots: ['13:00-14:00', '15:00-16:00'],
        status: 'pending'
      },
      {
        clientId,
        serviceId,
        requestedDate: yesterday,
        preferredTimeSlots: ['09:00-10:00'],
        status: 'notified'
      }
    ]);
  }
  
  describe('GET /api/analytics/dashboard', () => {
    it('should return dashboard data for admins', async () => {
      const response = await request(app)
        .get('/api/analytics/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0]
        });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('bookingStats');
      expect(response.body.data).toHaveProperty('topServices');
      expect(response.body.data).toHaveProperty('clientAcquisition');
      expect(response.body.data).toHaveProperty('waitlistMetrics');
    });
    
    it('should return 401 for unauthorized users', async () => {
      const response = await request(app)
        .get('/api/analytics/dashboard');
      
      expect(response.status).toBe(401);
    });
  });
  
  describe('GET /api/analytics/booking-stats', () => {
    it('should return booking statistics for admins', async () => {
      const response = await request(app)
        .get('/api/analytics/booking-stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0]
        });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('statusCounts');
      expect(response.body.data).toHaveProperty('recurringCount');
      expect(response.body.data).toHaveProperty('dailyBookings');
      expect(response.body.data).toHaveProperty('totalRevenue');
    });
  });
  
  describe('GET /api/analytics/service-popularity', () => {
    it('should return service popularity metrics for admins', async () => {
      const response = await request(app)
        .get('/api/analytics/service-popularity')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          limit: 5
        });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(Array.isArray(response.body.data)).toBe(true);
      
      if (response.body.data.length > 0) {
        expect(response.body.data[0]).toHaveProperty('name');
        expect(response.body.data[0]).toHaveProperty('bookingCount');
        expect(response.body.data[0]).toHaveProperty('revenue');
        expect(response.body.data[0]).toHaveProperty('waitlistCount');
      }
    });
  });
  
  describe('GET /api/analytics/client-acquisition', () => {
    it('should return client acquisition metrics for admins', async () => {
      const response = await request(app)
        .get('/api/analytics/client-acquisition')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          period: 'monthly',
          limit: 6
        });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(Array.isArray(response.body.data)).toBe(true);
      
      if (response.body.data.length > 0) {
        expect(response.body.data[0]).toHaveProperty('period');
        expect(response.body.data[0]).toHaveProperty('count');
        expect(response.body.data[0]).toHaveProperty('marketingConsent');
      }
    });
    
    it('should validate period parameter', async () => {
      const response = await request(app)
        .get('/api/analytics/client-acquisition')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          period: 'invalid'
        });
      
      expect(response.status).toBe(400);
    });
  });
  
  describe('GET /api/analytics/waitlist-metrics', () => {
    it('should return waitlist metrics for admins', async () => {
      const response = await request(app)
        .get('/api/analytics/waitlist-metrics')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0]
        });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('totalCount');
      expect(response.body.data).toHaveProperty('statusCounts');
      expect(response.body.data).toHaveProperty('serviceBreakdown');
    });
  });
  
  describe('GET /api/analytics/reports/:reportType/:format', () => {
    it('should generate a CSV report', async () => {
      const response = await request(app)
        .get('/api/analytics/reports/booking-stats/csv')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0]
        });
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
    });
    
    it('should validate report type parameter', async () => {
      const response = await request(app)
        .get('/api/analytics/reports/invalid-report/csv')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(400);
    });
    
    it('should validate format parameter', async () => {
      const response = await request(app)
        .get('/api/analytics/reports/booking-stats/invalid-format')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(400);
    });
  });
  
  describe('POST /api/analytics/schedule-report', () => {
    it('should schedule a report for email delivery', async () => {
      const response = await request(app)
        .post('/api/analytics/schedule-report')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reportType: 'booking-stats',
          format: 'pdf',
          email: 'admin@test.com',
          frequency: 'once',
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0]
        });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('scheduled');
    });
    
    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/analytics/schedule-report')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reportType: 'booking-stats',
          format: 'pdf'
          // missing email field
        });
      
      expect(response.status).toBe(400);
    });
  });
}); 