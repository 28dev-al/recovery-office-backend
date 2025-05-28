/**
 * Test file for the complete booking flow
 * 
 * This file provides a basic test to validate the end-to-end booking process
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const Client = require('../models/Client');
const Service = require('../models/Service');
const TimeSlot = require('../models/TimeSlot');
const Booking = require('../models/Booking');
const emailService = require('../utils/emailService');

// Mock the email service
jest.mock('../utils/emailService', () => ({
  sendBookingConfirmation: jest.fn().mockResolvedValue({ success: true }),
  sendStaffNotification: jest.fn().mockResolvedValue({ success: true })
}));

describe('Booking Flow', () => {
  let testClient;
  let testService;
  let testTimeSlot;
  let testBooking;

  beforeAll(async () => {
    // Connect to the test database
    await mongoose.connect(process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/recovery-office-test', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    // Clear test data
    await Client.deleteMany({});
    await Service.deleteMany({});
    await TimeSlot.deleteMany({});
    await Booking.deleteMany({});
  });

  afterAll(async () => {
    // Disconnect from the test database
    await mongoose.connection.close();
  });

  test('Complete booking flow - happy path', async () => {
    // Step 1: Create a service
    const serviceResponse = await request(app)
      .post('/api/services')
      .set('x-api-key', process.env.ADMIN_API_KEY)
      .send({
        name: 'Test Service',
        description: 'A test service for booking flow',
        duration: 60,
        price: 100,
        icon: 'https://example.com/icon.png',
        isActive: true,
        category: 'consultation'
      });

    expect(serviceResponse.status).toBe(201);
    testService = serviceResponse.body.data;

    // Step 2: Generate time slots for the service
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const generateResponse = await request(app)
      .post('/api/slots/generate')
      .set('x-api-key', process.env.ADMIN_API_KEY)
      .send({
        serviceId: testService._id,
        startDate: tomorrow.toISOString().split('T')[0],
        endDate: nextWeek.toISOString().split('T')[0],
        slotDuration: 60,
        startTime: '09:00',
        endTime: '17:00'
      });

    expect(generateResponse.status).toBe(201);
    
    // Step 3: Get available slots
    const slotsResponse = await request(app)
      .get(`/api/slots?serviceId=${testService._id}&date=${tomorrow.toISOString().split('T')[0]}`);
    
    expect(slotsResponse.status).toBe(200);
    expect(slotsResponse.body.data.length).toBeGreaterThan(0);
    testTimeSlot = slotsResponse.body.data[0];
    
    // Step 4: Register a client
    const clientResponse = await request(app)
      .post('/api/clients')
      .send({
        firstName: 'Test',
        lastName: 'Client',
        email: 'test@example.com',
        phone: '+1234567890',
        preferredContactMethod: 'email',
        gdprConsent: true,
        marketingConsent: false
      });
    
    expect(clientResponse.status).toBe(201);
    testClient = clientResponse.body.data;
    
    // Step 5: Create a booking
    const bookingResponse = await request(app)
      .post('/api/bookings')
      .send({
        clientId: testClient._id,
        serviceId: testService._id,
        date: tomorrow.toISOString().split('T')[0],
        timeSlot: testTimeSlot.slot,
        notes: 'Test booking'
      });
    
    expect(bookingResponse.status).toBe(201);
    testBooking = bookingResponse.body.data;
    
    // Verify booking was created
    expect(testBooking.clientId).toBe(testClient._id);
    expect(testBooking.serviceId).toBe(testService._id);
    expect(testBooking.status).toBe('scheduled');
    expect(testBooking.referenceNumber).toBeTruthy();
    
    // Check that email service was called
    expect(emailService.sendBookingConfirmation).toHaveBeenCalled();
    expect(emailService.sendStaffNotification).toHaveBeenCalled();
    
    // Step 6: Verify the time slot is no longer available
    const updatedSlotsResponse = await request(app)
      .get(`/api/slots?serviceId=${testService._id}&date=${tomorrow.toISOString().split('T')[0]}`);
    
    expect(updatedSlotsResponse.status).toBe(200);
    const slotStillAvailable = updatedSlotsResponse.body.data.some(
      slot => slot.id === testTimeSlot.id
    );
    expect(slotStillAvailable).toBe(false);
    
    // Step 7: Get booking by ID
    const getBookingResponse = await request(app)
      .get(`/api/bookings/${testBooking._id}`);
    
    expect(getBookingResponse.status).toBe(200);
    expect(getBookingResponse.body.data._id).toBe(testBooking._id);
    
    // Step 8: Update booking
    const updateBookingResponse = await request(app)
      .patch(`/api/bookings/${testBooking._id}`)
      .send({
        notes: 'Updated notes for test booking'
      });
    
    expect(updateBookingResponse.status).toBe(200);
    expect(updateBookingResponse.body.data.notes).toBe('Updated notes for test booking');
    
    // Step 9: Cancel booking
    const cancelBookingResponse = await request(app)
      .delete(`/api/bookings/${testBooking._id}`)
      .send({
        reason: 'Testing cancellation'
      });
    
    expect(cancelBookingResponse.status).toBe(200);
    expect(cancelBookingResponse.body.data.status).toBe('cancelled');
    
    // Step 10: Verify the time slot is available again
    const finalSlotsResponse = await request(app)
      .get(`/api/slots?serviceId=${testService._id}&date=${tomorrow.toISOString().split('T')[0]}`);
    
    expect(finalSlotsResponse.status).toBe(200);
    const slotAvailableAgain = finalSlotsResponse.body.data.some(
      slot => slot.slot === testTimeSlot.slot
    );
    expect(slotAvailableAgain).toBe(true);
  });
}); 