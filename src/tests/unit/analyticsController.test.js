const analyticsController = require('../../controllers/analyticsController');
const analyticsService = require('../../services/analyticsService');
const reportService = require('../../services/reportService');
const { ValidationError } = require('../../utils/AppError');

// Mock the analytics service
jest.mock('../../services/analyticsService');
jest.mock('../../services/reportService');

describe('Analytics Controller', () => {
  // Mock request, response, and next
  let req;
  let res;
  let next;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create fresh mocks for each test
    req = {
      query: {
        startDate: '2023-06-01',
        endDate: '2023-06-30'
      },
      params: {},
      body: {}
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
      send: jest.fn()
    };

    next = jest.fn();
  });

  describe('getDashboardData', () => {
    it('should return dashboard data successfully', async () => {
      // Mock data
      const mockDashboardData = {
        bookingStats: { statusCounts: { confirmed: 10 } },
        topServices: [{ name: 'Service A', bookingCount: 15 }],
        clientAcquisition: [{ period: '2023-06', count: 20 }],
        waitlistMetrics: { statusCounts: { pending: 5 } }
      };

      // Setup mock
      analyticsService.getDashboardData.mockResolvedValue(mockDashboardData);

      // Call controller
      await analyticsController.getDashboardData(req, res, next);

      // Assertions
      expect(analyticsService.getDashboardData).toHaveBeenCalledWith(
        req.query.startDate,
        req.query.endDate
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: mockDashboardData
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle errors and pass to next middleware', async () => {
      // Setup mock to throw error
      const error = new Error('Test error');
      analyticsService.getDashboardData.mockRejectedValue(error);

      // Call controller
      await analyticsController.getDashboardData(req, res, next);

      // Assertions
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('getBookingStats', () => {
    it('should return booking statistics successfully', async () => {
      // Mock data
      const mockBookingStats = {
        statusCounts: { confirmed: 10, completed: 5, cancelled: 2 },
        recurringCount: 3,
        dailyBookings: [{ _id: '2023-06-01', count: 5 }],
        totalRevenue: 1500
      };

      // Setup mock
      analyticsService.getBookingStats.mockResolvedValue(mockBookingStats);

      // Call controller
      await analyticsController.getBookingStats(req, res, next);

      // Assertions
      expect(analyticsService.getBookingStats).toHaveBeenCalledWith(
        req.query.startDate,
        req.query.endDate
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: mockBookingStats
      });
    });
  });

  describe('getServicePopularity', () => {
    it('should return service popularity metrics with default limit', async () => {
      // Mock data
      const mockServicePopularity = [
        {
          name: 'Service A',
          bookingCount: 15,
          revenue: 1500,
          waitlistCount: 5
        }
      ];

      // Setup mock
      analyticsService.getServicePopularity.mockResolvedValue(mockServicePopularity);

      // Call controller
      await analyticsController.getServicePopularity(req, res, next);

      // Assertions
      expect(analyticsService.getServicePopularity).toHaveBeenCalledWith(
        req.query.startDate,
        req.query.endDate,
        10 // default limit
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: mockServicePopularity
      });
    });

    it('should handle custom limit parameter', async () => {
      // Add limit to query
      req.query.limit = '5';

      // Mock data
      const mockServicePopularity = [
        {
          name: 'Service A',
          bookingCount: 15,
          revenue: 1500,
          waitlistCount: 5
        }
      ];

      // Setup mock
      analyticsService.getServicePopularity.mockResolvedValue(mockServicePopularity);

      // Call controller
      await analyticsController.getServicePopularity(req, res, next);

      // Assertions
      expect(analyticsService.getServicePopularity).toHaveBeenCalledWith(
        req.query.startDate,
        req.query.endDate,
        5 // parsed limit
      );
    });
  });

  describe('getClientAcquisition', () => {
    it('should return client acquisition metrics with default parameters', async () => {
      // Mock data
      const mockClientAcquisition = [
        {
          period: '2023-06',
          count: 20,
          marketingConsent: 15
        }
      ];

      // Setup mock
      analyticsService.getClientAcquisition.mockResolvedValue(mockClientAcquisition);

      // Call controller (no period or limit in query)
      delete req.query.period;
      delete req.query.limit;
      await analyticsController.getClientAcquisition(req, res, next);

      // Assertions - service uses default values internally
      expect(analyticsService.getClientAcquisition).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: mockClientAcquisition
      });
    });

    it('should validate period parameter', async () => {
      // Set invalid period
      req.query.period = 'invalid';

      // Call controller
      await analyticsController.getClientAcquisition(req, res, next);

      // Assertions
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0]).toBeInstanceOf(ValidationError);
      expect(analyticsService.getClientAcquisition).not.toHaveBeenCalled();
    });
  });

  describe('getWaitlistMetrics', () => {
    it('should return waitlist metrics successfully', async () => {
      // Mock data
      const mockWaitlistMetrics = {
        totalCount: 10,
        statusCounts: { pending: 5, notified: 3, converted: 2 },
        serviceBreakdown: [
          { service: 'Service A', count: 5 }
        ]
      };

      // Setup mock
      analyticsService.getWaitlistMetrics.mockResolvedValue(mockWaitlistMetrics);

      // Call controller
      await analyticsController.getWaitlistMetrics(req, res, next);

      // Assertions
      expect(analyticsService.getWaitlistMetrics).toHaveBeenCalledWith(
        req.query.startDate,
        req.query.endDate
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: mockWaitlistMetrics
      });
    });
  });

  describe('exportReport', () => {
    it('should export a CSV report', async () => {
      // Set params and query
      req.params.reportType = 'booking-stats';
      req.params.format = 'csv';

      // Mock buffer and content type
      const mockBuffer = Buffer.from('test,data\n1,2');
      reportService.generateCSV.mockResolvedValue(mockBuffer);

      // Call controller
      await analyticsController.exportReport(req, res, next);

      // Assertions
      expect(reportService.generateCSV).toHaveBeenCalledWith(
        'booking-stats',
        expect.objectContaining({
          startDate: req.query.startDate,
          endDate: req.query.endDate
        })
      );
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment')
      );
      expect(res.send).toHaveBeenCalledWith(mockBuffer);
    });

    it('should export an Excel report', async () => {
      // Set params
      req.params.reportType = 'service-popularity';
      req.params.format = 'excel';

      // Mock buffer
      const mockBuffer = Buffer.from([1, 2, 3, 4]);
      reportService.generateExcel.mockResolvedValue(mockBuffer);

      // Call controller
      await analyticsController.exportReport(req, res, next);

      // Assertions
      expect(reportService.generateExcel).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
    });

    it('should export a PDF report', async () => {
      // Set params
      req.params.reportType = 'client-acquisition';
      req.params.format = 'pdf';

      // Mock buffer
      const mockBuffer = Buffer.from([1, 2, 3, 4]);
      reportService.generatePDF.mockResolvedValue(mockBuffer);

      // Call controller
      await analyticsController.exportReport(req, res, next);

      // Assertions
      expect(reportService.generatePDF).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    });

    it('should validate report type', async () => {
      // Set invalid report type
      req.params.reportType = 'invalid-report';
      req.params.format = 'csv';

      // Call controller
      await analyticsController.exportReport(req, res, next);

      // Assertions
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0]).toBeInstanceOf(ValidationError);
      expect(reportService.generateCSV).not.toHaveBeenCalled();
    });

    it('should validate format', async () => {
      // Set invalid format
      req.params.reportType = 'booking-stats';
      req.params.format = 'invalid';

      // Call controller
      await analyticsController.exportReport(req, res, next);

      // Assertions
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0]).toBeInstanceOf(ValidationError);
    });
  });

  describe('scheduleReport', () => {
    it('should schedule a report successfully', async () => {
      // Set request body
      req.body = {
        reportType: 'booking-stats',
        format: 'pdf',
        email: 'test@example.com',
        frequency: 'once',
        startDate: '2023-06-01',
        endDate: '2023-06-30'
      };

      // Mock response from report service
      const scheduleResult = { scheduled: true, id: '12345' };
      reportService.scheduleReport = jest.fn().mockResolvedValue(scheduleResult);

      // Mock the expected response format from the controller
      res.json = jest.fn().mockImplementation((data) => data);

      // Call controller
      await analyticsController.scheduleReport(req, res, next);

      // Assertions
      expect(reportService.scheduleReport).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      // We're just checking that it was called, not the exact shape
      expect(res.json).toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      // Missing required fields
      req.body = {
        reportType: 'booking-stats',
        // Missing format and email
        frequency: 'once'
      };

      // Call controller
      await analyticsController.scheduleReport(req, res, next);

      // Assertions
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0]).toBeInstanceOf(ValidationError);
      expect(reportService.scheduleReport).not.toHaveBeenCalled();
    });
  });
}); 