/**
 * Analytics Controller
 * Handles analytics and reporting related requests
 */
const analyticsService = require('../services/analyticsService');
const reportService = require('../services/reportService');
const { ValidationError } = require('../utils/AppError');

/**
 * Get dashboard data (combined metrics)
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with dashboard metrics
 */
exports.getDashboardData = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dashboardData = await analyticsService.getDashboardData(startDate, endDate);
    
    return res.status(200).json({
      status: 'success',
      data: dashboardData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get booking statistics
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with booking statistics
 */
exports.getBookingStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    const bookingStats = await analyticsService.getBookingStats(startDate, endDate);
    
    return res.status(200).json({
      status: 'success',
      data: bookingStats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get service popularity metrics
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with service popularity metrics
 */
exports.getServicePopularity = async (req, res, next) => {
  try {
    const { startDate, endDate, limit } = req.query;
    
    const servicePopularity = await analyticsService.getServicePopularity(
      startDate, 
      endDate, 
      limit ? parseInt(limit) : 10
    );
    
    return res.status(200).json({
      status: 'success',
      data: servicePopularity
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get client acquisition metrics
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with client acquisition metrics
 */
exports.getClientAcquisition = async (req, res, next) => {
  try {
    const { period, limit } = req.query;
    
    // Validate period
    if (period && !['daily', 'weekly', 'monthly'].includes(period)) {
      throw new ValidationError(
        'Period must be one of: daily, weekly, monthly',
        'INVALID_PERIOD'
      );
    }
    
    const clientAcquisition = await analyticsService.getClientAcquisition(
      period, 
      limit ? parseInt(limit) : 12
    );
    
    return res.status(200).json({
      status: 'success',
      data: clientAcquisition
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get waitlist metrics
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with waitlist metrics
 */
exports.getWaitlistMetrics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    const waitlistMetrics = await analyticsService.getWaitlistMetrics(startDate, endDate);
    
    return res.status(200).json({
      status: 'success',
      data: waitlistMetrics
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Export a report in the specified format
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} Report file download
 */
exports.exportReport = async (req, res, next) => {
  try {
    const { reportType, format } = req.params;
    const { startDate, endDate, period, limit } = req.query;
    
    // Validate report type
    const validReportTypes = ['booking-stats', 'service-popularity', 'client-acquisition', 'waitlist-metrics'];
    if (!validReportTypes.includes(reportType)) {
      throw new ValidationError(
        `Invalid report type. Must be one of: ${validReportTypes.join(', ')}`,
        'INVALID_REPORT_TYPE'
      );
    }
    
    // Validate format
    const validFormats = ['csv', 'excel', 'pdf'];
    if (!validFormats.includes(format)) {
      throw new ValidationError(
        `Invalid format. Must be one of: ${validFormats.join(', ')}`,
        'INVALID_FORMAT'
      );
    }
    
    // Prepare filters
    const filters = { startDate, endDate, period, limit: limit ? parseInt(limit) : undefined };
    
    // Generate report
    let reportBuffer;
    let contentType;
    let extension;
    
    switch (format) {
      case 'csv':
        reportBuffer = await reportService.generateCSV(reportType, filters);
        contentType = 'text/csv';
        extension = 'csv';
        break;
      case 'excel':
        reportBuffer = await reportService.generateExcel(reportType, filters);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        extension = 'xlsx';
        break;
      case 'pdf':
        reportBuffer = await reportService.generatePDF(reportType, filters);
        contentType = 'application/pdf';
        extension = 'pdf';
        break;
    }
    
    // Set headers for file download
    const filename = `recovery-office-${reportType}-report.${extension}`;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    
    // Send report
    return res.send(reportBuffer);
  } catch (error) {
    next(error);
  }
};

/**
 * Schedule a report to be sent via email
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with scheduling result
 */
exports.scheduleReport = async (req, res, next) => {
  try {
    const { 
      reportType, 
      format, 
      email, 
      frequency = 'once',
      startDate, 
      endDate, 
      period
    } = req.body;
    
    // Validate required fields
    if (!reportType || !format || !email) {
      throw new ValidationError(
        'Report type, format, and email are required',
        'MISSING_REQUIRED_FIELDS'
      );
    }
    
    // Validate report type
    const validReportTypes = ['booking-stats', 'service-popularity', 'client-acquisition', 'waitlist-metrics'];
    if (!validReportTypes.includes(reportType)) {
      throw new ValidationError(
        `Invalid report type. Must be one of: ${validReportTypes.join(', ')}`,
        'INVALID_REPORT_TYPE'
      );
    }
    
    // Validate format
    const validFormats = ['csv', 'excel', 'pdf'];
    if (!validFormats.includes(format)) {
      throw new ValidationError(
        `Invalid format. Must be one of: ${validFormats.join(', ')}`,
        'INVALID_FORMAT'
      );
    }
    
    // Validate frequency
    const validFrequencies = ['once', 'daily', 'weekly', 'monthly'];
    if (!validFrequencies.includes(frequency)) {
      throw new ValidationError(
        `Invalid frequency. Must be one of: ${validFrequencies.join(', ')}`,
        'INVALID_FREQUENCY'
      );
    }
    
    // Prepare filters
    const filters = { startDate, endDate, period };
    
    // Schedule report
    const result = await reportService.scheduleReport(
      reportType,
      filters,
      email,
      format,
      frequency
    );
    
    return res.status(200).json({
      status: 'success',
      message: `Report has been scheduled for delivery to ${email}`,
      data: result
    });
  } catch (error) {
    next(error);
  }
}; 