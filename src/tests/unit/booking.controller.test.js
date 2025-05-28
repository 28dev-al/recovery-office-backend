/**
 * Unit tests for the booking controller
 */
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../../server');
const Booking = require('../../models/Booking');
const Slot = require('../../models/Slot');
const testFactory = require('../fixtures/testFactory');

// Mock email service
jest.mock('../../services/emailService', () => ({
  sendBookingConfirmation: jest.fn().mockResolvedValue(true),
  sendAdminNotification: jest.fn().mockResolvedValue(true)
}));

const emailService = require('../../services/emailService');

let mongoServer;
let adminUser;
let adminToken;
let testClient;
let testService;
let testSlot;

/**
 * Connect to a new in-memory database before running tests
 */
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

/**
 * Set up test data before each test
 */
beforeEach(async () => {
  // Clean up previous test data
  await testFactory.cleanup();
  
  // Create test data
  adminUser = await testFactory.createAdmin();
  adminToken = testFactory.generateToken(adminUser);
  testClient = await testFactory.createClient();
  testService = await testFactory.createService();
  
  // Create a test slot
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowFormatted = tomorrow.toISOString().split('T')[0];
  
  testSlot = await testFactory.createSlot({
    serviceId: testService._id,
    date: tomorrowFormatted,
    timeSlot: '10:00-11:00',
    isAvailable: true
  });
  
  // Reset mocks
  jest.clearAllMocks();
});

/**
 * Remove and close the db and server after all tests
 */
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('BookingController', () => {
  describe('createBooking', () => {
    test('should successfully create a booking with valid inputs', async () => {
      const bookingData = {
        clientId: testClient._id.toString(),
        serviceId: testService._id.toString(),
        date: testSlot.date.toISOString().split('T')[0],
        timeSlot: testSlot.timeSlot,
        notes: 'Test booking notes'
      };
      
      const response = await request(app)
        .post('/api/bookings')
        .send(bookingData);
      
      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data.booking).toHaveProperty('_id');
      expect(response.body.data.booking.clientId).toBe(testClient._id.toString());
      expect(response.body.data.booking.serviceId).toBe(testService._id.toString());
      expect(response.body.data.booking.timeSlot).toBe(testSlot.timeSlot);
      
      // Verify slot is marked as unavailable
      const updatedSlot = await Slot.findById(testSlot._id);
      expect(updatedSlot.isAvailable).toBe(false);
      expect(updatedSlot.bookingId.toString()).toBe(response.body.data.booking._id);
      
      // Verify emails were sent
      expect(emailService.sendBookingConfirmation).toHaveBeenCalledTimes(1);
      expect(emailService.sendAdminNotification).toHaveBeenCalledTimes(1);
    });
    
    test('should reject double bookings for the same time slot', async () => {
      // First, create a booking
      const booking = await testFactory.createBooking({
        clientId: testClient._id,
        serviceId: testService._id,
        date: testSlot.date,
        timeSlot: testSlot.timeSlot
      });
      
      // Mark the slot as unavailable
      await Slot.findByIdAndUpdate(testSlot._id, {
        isAvailable: false,
        bookingId: booking._id
      });
      
      // Try to book the same slot again
      const bookingData = {
        clientId: testClient._id.toString(),
        serviceId: testService._id.toString(),
        date: testSlot.date.toISOString().split('T')[0],
        timeSlot: testSlot.timeSlot,
        notes: 'This should fail'
      };
      
      const response = await request(app)
        .post('/api/bookings')
        .send(bookingData);
      
      expect(response.status).toBe(409);
      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('SLOT_UNAVAILABLE');
    });
    
    test('should handle service not found scenarios', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      const bookingData = {
        clientId: testClient._id.toString(),
        serviceId: nonExistentId.toString(),
        date: testSlot.date.toISOString().split('T')[0],
        timeSlot: testSlot.timeSlot
      };
      
      const response = await request(app)
        .post('/api/bookings')
        .send(bookingData);
      
      expect(response.status).toBe(404);
      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('SERVICE_NOT_FOUND');
    });
    
    test('should handle client not found scenarios', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      const bookingData = {
        clientId: nonExistentId.toString(),
        serviceId: testService._id.toString(),
        date: testSlot.date.toISOString().split('T')[0],
        timeSlot: testSlot.timeSlot
      };
      
      const response = await request(app)
        .post('/api/bookings')
        .send(bookingData);
      
      expect(response.status).toBe(404);
      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('CLIENT_NOT_FOUND');
    });
  });
  
  describe('getBookingById', () => {
    test('should retrieve a booking by ID', async () => {
      // Create a test booking
      const booking = await testFactory.createBooking({
        clientId: testClient._id,
        serviceId: testService._id
      });
      
      const response = await request(app)
        .get(`/api/bookings/${booking._id}`);
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.booking._id).toBe(booking._id.toString());
    });
    
    test('should return 404 for non-existent booking', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .get(`/api/bookings/${nonExistentId}`);
      
      expect(response.status).toBe(404);
      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('BOOKING_NOT_FOUND');
    });
  });
  
  describe('getAllBookings', () => {
    test('should retrieve all bookings for admin users', async () => {
      // Create multiple test bookings
      await testFactory.createBooking({
        clientId: testClient._id,
        serviceId: testService._id,
        status: 'confirmed'
      });
      
      await testFactory.createBooking({
        clientId: testClient._id,
        serviceId: testService._id,
        status: 'cancelled'
      });
      
      const response = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.bookings.length).toBe(2);
    });
    
    test('should filter bookings by status', async () => {
      // Create multiple test bookings with different statuses
      await testFactory.createBooking({
        clientId: testClient._id,
        serviceId: testService._id,
        status: 'confirmed'
      });
      
      await testFactory.createBooking({
        clientId: testClient._id,
        serviceId: testService._id,
        status: 'cancelled'
      });
      
      const response = await request(app)
        .get('/api/bookings?status=cancelled')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.bookings.length).toBe(1);
      expect(response.body.data.bookings[0].status).toBe('cancelled');
    });
  });
  
  describe('updateBooking', () => {
    test('should update a booking status', async () => {
      // Create a test booking
      const booking = await testFactory.createBooking({
        clientId: testClient._id,
        serviceId: testService._id,
        status: 'confirmed'
      });
      
      const updateData = {
        status: 'cancelled',
        cancellationReason: 'Test cancellation'
      };
      
      const response = await request(app)
        .patch(`/api/bookings/${booking._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.booking.status).toBe('cancelled');
      expect(response.body.data.booking.cancellationReason).toBe('Test cancellation');
    });
  });
  
  describe('cancelBooking', () => {
    test('should cancel a booking', async () => {
      // Create a test booking
      const booking = await testFactory.createBooking({
        clientId: testClient._id,
        serviceId: testService._id,
        status: 'confirmed'
      });
      
      // Mark a slot as taken
      await Slot.create({
        serviceId: testService._id,
        date: booking.date,
        timeSlot: booking.timeSlot,
        isAvailable: false,
        bookingId: booking._id
      });
      
      const response = await request(app)
        .delete(`/api/bookings/${booking._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancellationReason: 'Test cancellation' });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      
      // Verify booking is cancelled
      const updatedBooking = await Booking.findById(booking._id);
      expect(updatedBooking.status).toBe('cancelled');
      
      // Verify slot is available again
      const updatedSlot = await Slot.findOne({
        serviceId: testService._id,
        date: booking.date,
        timeSlot: booking.timeSlot
      });
      
      expect(updatedSlot.isAvailable).toBe(true);
      expect(updatedSlot.bookingId).toBeUndefined();
    });
  });
}); 