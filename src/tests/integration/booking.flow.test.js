/**
 * Integration test for the complete booking flow
 * Tests the entire booking process from service selection to booking confirmation
 */
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../../server');
const Service = require('../../models/Service');
const Client = require('../../models/Client');
const User = require('../../models/User');
const Slot = require('../../models/Slot');

// Mock email service
jest.mock('../../services/emailService', () => ({
  sendBookingConfirmation: jest.fn().mockResolvedValue(true),
  sendAdminNotification: jest.fn().mockResolvedValue(true)
}));

const emailService = require('../../services/emailService');

let mongoServer;
let adminUser;
let adminToken;

/**
 * Connect to a new in-memory database before running tests
 */
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
  
  // Create admin user for authenticated operations
  adminUser = await User.create({
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@test.com',
    password: 'password123',
    role: 'admin'
  });
  
  // Login to get token
  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'admin@test.com',
      password: 'password123'
    });
  
  adminToken = loginResponse.body.data.tokens.accessToken;
});

/**
 * Clear collections between tests
 */
beforeEach(async () => {
  await Service.deleteMany({});
  await Client.deleteMany({});
  await Slot.deleteMany({});
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

describe('Booking Flow Integration', () => {
  it('should complete the entire booking process from service selection to confirmation', async () => {
    // Step 1: Create a service (as admin)
    const serviceData = {
      name: 'Financial Recovery Consultation',
      description: 'Initial consultation for financial recovery',
      duration: 60,
      price: 150,
      category: 'consultation',
      isActive: true
    };
    
    const serviceResponse = await request(app)
      .post('/api/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(serviceData);
    
    expect(serviceResponse.status).toBe(201);
    const serviceId = serviceResponse.body.data.service._id;
    
    // Step 2: Generate time slots for today and tomorrow (as admin)
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    const todayFormatted = today.toISOString().split('T')[0];
    const tomorrowFormatted = tomorrow.toISOString().split('T')[0];
    
    const slotGenerationResponse = await request(app)
      .post('/api/slots/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        startDate: todayFormatted,
        endDate: tomorrowFormatted,
        serviceId,
        startTime: '09:00',
        endTime: '17:00',
        slotDuration: 60,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6] // All days
      });
    
    expect(slotGenerationResponse.status).toBe(201);
    
    // Step 3: Check available slots for tomorrow
    const availableSlotsResponse = await request(app)
      .get(`/api/slots?date=${tomorrowFormatted}&serviceId=${serviceId}`);
    
    expect(availableSlotsResponse.status).toBe(200);
    expect(availableSlotsResponse.body.data.slots.length).toBeGreaterThan(0);
    
    // Get the first available slot
    const selectedSlot = availableSlotsResponse.body.data.slots[0];
    const selectedTime = selectedSlot.timeSlot;
    
    // Step 4: Create a client
    const clientData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+441234567890',
      preferredContactMethod: 'email',
      gdprConsent: true,
      marketingConsent: false
    };
    
    const clientResponse = await request(app)
      .post('/api/clients')
      .send(clientData);
    
    expect(clientResponse.status).toBe(201);
    const clientId = clientResponse.body.data.client._id;
    
    // Step 5: Create a booking
    const bookingData = {
      clientId,
      serviceId,
      date: tomorrowFormatted,
      timeSlot: selectedTime,
      notes: 'This is a test booking from the integration test'
    };
    
    const bookingResponse = await request(app)
      .post('/api/bookings')
      .send(bookingData);
    
    expect(bookingResponse.status).toBe(201);
    const bookingId = bookingResponse.body.data.booking._id;
    const bookingReference = bookingResponse.body.data.booking.reference;
    
    // Verify booking was created correctly
    expect(bookingResponse.body.data.booking.clientId).toBe(clientId);
    expect(bookingResponse.body.data.booking.serviceId).toBe(serviceId);
    expect(bookingResponse.body.data.booking.timeSlot).toBe(selectedTime);
    
    // Check that email notification was sent
    expect(emailService.sendBookingConfirmation).toHaveBeenCalledTimes(1);
    expect(emailService.sendAdminNotification).toHaveBeenCalledTimes(1);
    
    // Step 6: Check the booking details
    const bookingDetailsResponse = await request(app)
      .get(`/api/bookings/${bookingId}`);
    
    expect(bookingDetailsResponse.status).toBe(200);
    expect(bookingDetailsResponse.body.data.booking._id).toBe(bookingId);
    
    // Step 7: Check that the slot is no longer available
    const updatedSlotsResponse = await request(app)
      .get(`/api/slots?date=${tomorrowFormatted}&serviceId=${serviceId}`);
    
    const bookedSlot = updatedSlotsResponse.body.data.slots.find(
      slot => slot.timeSlot === selectedTime
    );
    
    expect(bookedSlot.isAvailable).toBe(false);
    expect(bookedSlot.bookingId.toString()).toBe(bookingId);
    
    // Step 8: Admin can view all bookings
    const allBookingsResponse = await request(app)
      .get('/api/bookings')
      .set('Authorization', `Bearer ${adminToken}`);
    
    expect(allBookingsResponse.status).toBe(200);
    expect(allBookingsResponse.body.data.bookings.length).toBeGreaterThan(0);
    
    const foundBooking = allBookingsResponse.body.data.bookings.find(
      booking => booking._id === bookingId
    );
    
    expect(foundBooking).toBeDefined();
    expect(foundBooking.reference).toBe(bookingReference);
  });
}); 