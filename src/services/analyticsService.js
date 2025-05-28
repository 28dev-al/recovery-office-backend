/**
 * Analytics Service
 * Provides business metrics and reporting capabilities
 */
const moment = require('moment');
const Booking = require('../models/Booking');
const Client = require('../models/Client');
const Service = require('../models/Service');
const Waitlist = require('../models/Waitlist');
const { InternalError } = require('../utils/AppError');
const logger = require('../utils/logger');

/**
 * Get booking statistics for a date range
 * 
 * @param {Date|string} startDate - Start date for statistics (default: 30 days ago)
 * @param {Date|string} endDate - End date for statistics (default: today)
 * @returns {Promise<Object>} Booking statistics
 */
exports.getBookingStats = async (startDate, endDate) => {
  try {
    const start = startDate ? new Date(startDate) : moment().subtract(30, 'days').toDate();
    const end = endDate ? new Date(endDate) : new Date();
    
    // Get booking counts by status
    const statusStats = await Booking.aggregate([
      {
        $match: {
          date: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Format results into a more user-friendly object
    const statusCounts = {};
    statusStats.forEach(stat => {
      statusCounts[stat._id] = stat.count;
    });
    
    // Count recurring bookings
    const recurringCount = await Booking.countDocuments({
      date: { $gte: start, $lte: end },
      isRecurring: true
    });
    
    // Get bookings per day for the period
    const dailyBookings = await Booking.aggregate([
      {
        $match: {
          date: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);
    
    // Calculate total revenue for confirmed/completed bookings
    const revenueData = await Booking.aggregate([
      {
        $match: {
          date: { $gte: start, $lte: end },
          status: { $in: ['confirmed', 'completed'] }
        }
      },
      {
        $lookup: {
          from: 'services',
          localField: 'serviceId',
          foreignField: '_id',
          as: 'service'
        }
      },
      {
        $unwind: '$service'
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$service.price' }
        }
      }
    ]);
    
    const totalRevenue = revenueData.length > 0 ? revenueData[0].totalRevenue : 0;
    
    return {
      periodStart: start,
      periodEnd: end,
      statusCounts,
      recurringCount,
      dailyBookings,
      totalRevenue
    };
  } catch (error) {
    logger.error(`Error getting booking stats: ${error.message}`, { error });
    throw new InternalError('Failed to retrieve booking statistics');
  }
};

/**
 * Get service popularity metrics
 * 
 * @param {Date|string} startDate - Start date for statistics (default: 30 days ago)
 * @param {Date|string} endDate - End date for statistics (default: today)
 * @param {number} limit - Maximum number of services to return (default: 10)
 * @returns {Promise<Array>} Service popularity data
 */
exports.getServicePopularity = async (startDate, endDate, limit = 10) => {
  try {
    const start = startDate ? new Date(startDate) : moment().subtract(30, 'days').toDate();
    const end = endDate ? new Date(endDate) : new Date();
    
    // Get booking counts by service
    const serviceStats = await Booking.aggregate([
      {
        $match: {
          date: { $gte: start, $lte: end },
          status: { $in: ['confirmed', 'completed'] }
        }
      },
      {
        $group: {
          _id: '$serviceId',
          bookingCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'services',
          localField: '_id',
          foreignField: '_id',
          as: 'serviceDetails'
        }
      },
      {
        $unwind: '$serviceDetails'
      },
      {
        $project: {
          _id: 0,
          serviceId: '$_id',
          name: '$serviceDetails.name',
          category: '$serviceDetails.category',
          price: '$serviceDetails.price',
          bookingCount: 1,
          revenue: { $multiply: ['$bookingCount', '$serviceDetails.price'] }
        }
      },
      {
        $sort: { bookingCount: -1 }
      },
      {
        $limit: limit
      }
    ]);
    
    // Get waitlist counts by service
    const waitlistStats = await Waitlist.aggregate([
      {
        $match: {
          requestedDate: { $gte: start, $lte: end },
          status: { $in: ['pending', 'notified'] }
        }
      },
      {
        $group: {
          _id: '$serviceId',
          waitlistCount: { $sum: 1 }
        }
      }
    ]);
    
    // Create a map of service IDs to waitlist counts
    const waitlistCountMap = {};
    waitlistStats.forEach(stat => {
      waitlistCountMap[stat._id.toString()] = stat.waitlistCount;
    });
    
    // Add waitlist counts to service stats
    const servicesWithWaitlist = serviceStats.map(service => ({
      ...service,
      waitlistCount: waitlistCountMap[service.serviceId.toString()] || 0
    }));
    
    return servicesWithWaitlist;
  } catch (error) {
    logger.error(`Error getting service popularity: ${error.message}`, { error });
    throw new InternalError('Failed to retrieve service popularity metrics');
  }
};

/**
 * Get client acquisition metrics
 * 
 * @param {string} period - Time period grouping ('daily', 'weekly', 'monthly')
 * @param {number} limit - Maximum number of periods to return (default: 12)
 * @returns {Promise<Array>} Client acquisition data
 */
exports.getClientAcquisition = async (period = 'monthly', limit = 12) => {
  try {
    let groupBy;
    let sortBy;
    let format;
    
    // Configure grouping based on period
    switch (period) {
      case 'daily':
        groupBy = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
        sortBy = { '_id': -1 };
        format = 'YYYY-MM-DD';
        break;
      case 'weekly':
        groupBy = { 
          year: { $year: '$createdAt' },
          week: { $week: '$createdAt' }
        };
        sortBy = { '_id.year': -1, '_id.week': -1 };
        format = 'YYYY-[W]WW';
        break;
      case 'monthly':
      default:
        groupBy = { 
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        };
        sortBy = { '_id.year': -1, '_id.month': -1 };
        format = 'YYYY-MM';
    }
    
    // Get client acquisition data
    const acquisitionData = await Client.aggregate([
      {
        $group: {
          _id: groupBy,
          count: { $sum: 1 },
          marketingConsent: {
            $sum: { $cond: [{ $eq: ['$marketingConsent', true] }, 1, 0] }
          }
        }
      },
      {
        $sort: sortBy
      },
      {
        $limit: limit
      }
    ]);
    
    // Format results based on the period
    let formattedData;
    
    if (period === 'daily') {
      formattedData = acquisitionData.map(item => ({
        period: item._id,
        count: item.count,
        marketingConsent: item.marketingConsent
      }));
    } else if (period === 'weekly') {
      formattedData = acquisitionData.map(item => {
        const date = moment().year(item._id.year).week(item._id.week).startOf('week');
        return {
          period: date.format(format),
          count: item.count,
          marketingConsent: item.marketingConsent
        };
      });
    } else {
      formattedData = acquisitionData.map(item => {
        const date = moment().year(item._id.year).month(item._id.month - 1).startOf('month');
        return {
          period: date.format(format),
          count: item.count,
          marketingConsent: item.marketingConsent
        };
      });
    }
    
    // Reverse the array to get chronological order
    return formattedData.reverse();
  } catch (error) {
    logger.error(`Error getting client acquisition: ${error.message}`, { error });
    throw new InternalError('Failed to retrieve client acquisition metrics');
  }
};

/**
 * Get waitlist metrics
 * 
 * @param {Date|string} startDate - Start date for statistics (default: 30 days ago)
 * @param {Date|string} endDate - End date for statistics (default: today)
 * @returns {Promise<Object>} Waitlist metrics
 */
exports.getWaitlistMetrics = async (startDate, endDate) => {
  try {
    const start = startDate ? new Date(startDate) : moment().subtract(30, 'days').toDate();
    const end = endDate ? new Date(endDate) : new Date();
    
    // Get waitlist counts by status
    const statusStats = await Waitlist.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Format results into a more user-friendly object
    const statusCounts = {};
    statusStats.forEach(stat => {
      statusCounts[stat._id] = stat.count;
    });
    
    // Calculate conversion rate (waitlist entries that became bookings)
    const convertedCount = statusCounts.booked || 0;
    const totalCount = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
    const conversionRate = totalCount > 0 ? (convertedCount / totalCount) * 100 : 0;
    
    // Calculate average time from waitlist to booking
    const conversionTimeData = await Waitlist.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          status: 'booked',
          bookedAt: { $exists: true, $ne: null }
        }
      },
      {
        $project: {
          conversionTimeHours: {
            $divide: [
              { $subtract: ['$bookedAt', '$createdAt'] },
              3600000 // Convert milliseconds to hours
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          averageConversionTime: { $avg: '$conversionTimeHours' },
          minConversionTime: { $min: '$conversionTimeHours' },
          maxConversionTime: { $max: '$conversionTimeHours' }
        }
      }
    ]);
    
    const conversionTime = conversionTimeData.length > 0 ? conversionTimeData[0] : {
      averageConversionTime: 0,
      minConversionTime: 0,
      maxConversionTime: 0
    };
    
    // Get waitlist entries by service
    const serviceStats = await Waitlist.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$serviceId',
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'services',
          localField: '_id',
          foreignField: '_id',
          as: 'service'
        }
      },
      {
        $unwind: '$service'
      },
      {
        $project: {
          _id: 0,
          serviceId: '$_id',
          serviceName: '$service.name',
          count: 1
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 5
      }
    ]);
    
    return {
      periodStart: start,
      periodEnd: end,
      statusCounts,
      conversionRate: parseFloat(conversionRate.toFixed(2)),
      conversionTime: {
        average: parseFloat(conversionTime.averageConversionTime.toFixed(2)),
        min: parseFloat(conversionTime.minConversionTime.toFixed(2)),
        max: parseFloat(conversionTime.maxConversionTime.toFixed(2))
      },
      topServices: serviceStats
    };
  } catch (error) {
    logger.error(`Error getting waitlist metrics: ${error.message}`, { error });
    throw new InternalError('Failed to retrieve waitlist metrics');
  }
};

/**
 * Get dashboard data (combined metrics)
 * 
 * @param {Date|string} startDate - Start date for statistics (default: 30 days ago)
 * @param {Date|string} endDate - End date for statistics (default: today)
 * @returns {Promise<Object>} Combined dashboard metrics
 */
exports.getDashboardData = async (startDate, endDate) => {
  try {
    const start = startDate ? new Date(startDate) : moment().subtract(30, 'days').toDate();
    const end = endDate ? new Date(endDate) : new Date();
    
    const [
      bookingStats,
      topServices,
      clientAcquisition,
      waitlistMetrics
    ] = await Promise.all([
      exports.getBookingStats(start, end),
      exports.getServicePopularity(start, end, 5),
      exports.getClientAcquisition('monthly', 6),
      exports.getWaitlistMetrics(start, end)
    ]);
    
    return {
      periodStart: start,
      periodEnd: end,
      bookingStats,
      topServices,
      clientAcquisition,
      waitlistMetrics
    };
  } catch (error) {
    logger.error(`Error getting dashboard data: ${error.message}`, { error });
    throw new InternalError('Failed to retrieve dashboard data');
  }
}; 