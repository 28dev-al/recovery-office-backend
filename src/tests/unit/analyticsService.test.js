const mongoose = require('mongoose');
const analyticsService = require('../../services/analyticsService');
const Booking = require('../../models/Booking');
const Service = require('../../models/Service');
const Client = require('../../models/Client');
const Waitlist = require('../../models/Waitlist');

// Mock the dependencies
jest.mock('../../models/Booking');
jest.mock('../../models/Service');
jest.mock('../../models/Client');
jest.mock('../../models/Waitlist');
jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

describe('Analytics Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getBookingStats', () => {
    it('should return booking statistics for the specified date range', async () => {
      // Mock data
      const mockStatusStats = [
        { _id: 'confirmed', count: 10 },
        { _id: 'completed', count: 5 },
        { _id: 'cancelled', count: 2 }
      ];
      
      const mockDailyBookings = [
        { _id: '2023-06-01', count: 3 },
        { _id: '2023-06-02', count: 5 },
        { _id: '2023-06-03', count: 9 }
      ];
      
      const mockRevenueData = [
        { _id: null, totalRevenue: 1500 }
      ];
      
      // Setup mocks
      Booking.aggregate
        .mockImplementationOnce(() => Promise.resolve(mockStatusStats))
        .mockImplementationOnce(() => Promise.resolve(mockDailyBookings))
        .mockImplementationOnce(() => Promise.resolve(mockRevenueData));
      
      Booking.countDocuments.mockResolvedValue(3);
      
      // Call the service
      const startDate = '2023-06-01';
      const endDate = '2023-06-30';
      const result = await analyticsService.getBookingStats(startDate, endDate);
      
      // Assertions
      expect(Booking.aggregate).toHaveBeenCalledTimes(3);
      expect(Booking.countDocuments).toHaveBeenCalledTimes(1);
      
      expect(result).toHaveProperty('statusCounts');
      expect(result.statusCounts).toEqual({
        confirmed: 10,
        completed: 5,
        cancelled: 2
      });
      
      expect(result).toHaveProperty('dailyBookings');
      expect(result.dailyBookings).toEqual(mockDailyBookings);
      
      expect(result).toHaveProperty('totalRevenue');
      expect(result.totalRevenue).toEqual(1500);
      
      expect(result).toHaveProperty('recurringCount');
      expect(result.recurringCount).toEqual(3);
    });
    
    it('should handle errors gracefully', async () => {
      // Setup mock to throw an error
      Booking.aggregate.mockImplementation(() => {
        throw new Error('Database error');
      });
      
      // Call the service and expect it to throw
      await expect(analyticsService.getBookingStats('2023-06-01', '2023-06-30'))
        .rejects
        .toThrow('Failed to retrieve booking statistics');
    });
  });

  describe('getServicePopularity', () => {
    it('should return service popularity metrics', async () => {
      // Mock data
      const mockServiceStats = [
        {
          _id: 0,
          serviceId: new mongoose.Types.ObjectId(),
          name: 'Service A',
          category: 'Category 1',
          price: 100,
          bookingCount: 15,
          revenue: 1500
        },
        {
          _id: 0,
          serviceId: new mongoose.Types.ObjectId(),
          name: 'Service B',
          category: 'Category 2',
          price: 200,
          bookingCount: 10,
          revenue: 2000
        }
      ];
      
      const mockWaitlistStats = [
        { _id: mockServiceStats[0].serviceId, waitlistCount: 5 },
        { _id: mockServiceStats[1].serviceId, waitlistCount: 2 }
      ];
      
      // Setup mocks
      Booking.aggregate.mockResolvedValue(mockServiceStats);
      Waitlist.aggregate.mockResolvedValue(mockWaitlistStats);
      
      // Call the service
      const result = await analyticsService.getServicePopularity('2023-06-01', '2023-06-30');
      
      // Assertions
      expect(Booking.aggregate).toHaveBeenCalledTimes(1);
      expect(Waitlist.aggregate).toHaveBeenCalledTimes(1);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('waitlistCount', 5);
      expect(result[1]).toHaveProperty('waitlistCount', 2);
    });
  });

  describe('getClientAcquisition', () => {
    it('should return client acquisition metrics', async () => {
      // Mock data for monthly aggregation
      const mockAcquisitionData = [
        { 
          _id: { year: 2023, month: 6 }, 
          count: 20, 
          marketingConsent: 15 
        },
        { 
          _id: { year: 2023, month: 5 }, 
          count: 15, 
          marketingConsent: 10 
        }
      ];
      
      // Setup mock
      Client.aggregate.mockResolvedValue(mockAcquisitionData);
      
      // Call the service
      const result = await analyticsService.getClientAcquisition('monthly', 6);
      
      // Assertions
      expect(Client.aggregate).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
      
      // Check format of returned data
      expect(result[0]).toHaveProperty('period');
      expect(result[0]).toHaveProperty('count');
      expect(result[0]).toHaveProperty('marketingConsent');
    });
  });

  describe('getDashboardData', () => {
    it('should combine all metrics for dashboard', async () => {
      // Mock the individual service methods
      const mockBookingStats = { statusCounts: { confirmed: 10 } };
      const mockTopServices = [{ name: 'Service A', bookingCount: 15 }];
      const mockClientAcquisition = [{ period: '2023-06', count: 20 }];
      const mockWaitlistMetrics = { statusCounts: { pending: 5 } };
      
      // Create spies on the service methods
      jest.spyOn(analyticsService, 'getBookingStats').mockResolvedValue(mockBookingStats);
      jest.spyOn(analyticsService, 'getServicePopularity').mockResolvedValue(mockTopServices);
      jest.spyOn(analyticsService, 'getClientAcquisition').mockResolvedValue(mockClientAcquisition);
      jest.spyOn(analyticsService, 'getWaitlistMetrics').mockResolvedValue(mockWaitlistMetrics);
      
      // Call the service
      const result = await analyticsService.getDashboardData('2023-06-01', '2023-06-30');
      
      // Assertions
      expect(analyticsService.getBookingStats).toHaveBeenCalledTimes(1);
      expect(analyticsService.getServicePopularity).toHaveBeenCalledTimes(1);
      expect(analyticsService.getClientAcquisition).toHaveBeenCalledTimes(1);
      expect(analyticsService.getWaitlistMetrics).toHaveBeenCalledTimes(1);
      
      expect(result).toHaveProperty('bookingStats', mockBookingStats);
      expect(result).toHaveProperty('topServices', mockTopServices);
      expect(result).toHaveProperty('clientAcquisition', mockClientAcquisition);
      expect(result).toHaveProperty('waitlistMetrics', mockWaitlistMetrics);
    });
  });
}); 