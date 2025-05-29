const Booking = require('../models/Booking');
const Client = require('../models/Client');
const Service = require('../models/Service');

const dashboardController = {
  // GET /api/dashboard/analytics - FIXED VERSION
  getOverviewStats: async (req, res) => {
    try {
      console.log('[Dashboard Controller] Fetching overview stats using Mongoose...');
      
      // Use Mongoose models instead of req.app.locals.db
      const bookings = await Booking.find().lean().catch(err => {
        console.error('[Dashboard] Booking find error:', err);
        return [];
      });
      
      const clients = await Client.find().lean().catch(err => {
        console.error('[Dashboard] Client find error:', err);
        return [];
      });
      
      const services = await Service.find().lean().catch(err => {
        console.error('[Dashboard] Service find error:', err);
        return [];
      });

      console.log(`[Dashboard] Found ${bookings.length} bookings, ${clients.length} clients, ${services.length} services`);

      // Calculate statistics
      const totalBookings = bookings.length;
      const totalRevenue = bookings.reduce((sum, booking) => {
        return sum + (booking.price || booking.totalAmount || 0);
      }, 0);
      
      const activeClients = clients.filter(client => 
        client.status === 'active' || !client.status
      ).length;
      
      const completedBookings = bookings.filter(b => b.status === 'completed').length;
      const successRate = totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0;

      const response = {
        status: 'success',
        data: {
          totalBookings,
          totalRevenue,
          activeClients,
          successRate,
          averageBookingValue: totalBookings > 0 ? totalRevenue / totalBookings : 0,
          todayBookings: 0,
          statusBreakdown: bookings.reduce((acc, booking) => {
            const status = booking.status || 'pending';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
          }, {})
        }
      };

      console.log('[Dashboard Controller] Overview stats calculated successfully');
      res.json(response);

    } catch (error) {
      console.error('[Dashboard Controller] Error fetching overview stats:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch overview statistics',
        error: error.message
      });
    }
  },

  // GET /api/dashboard/bookings - FIXED VERSION WITH CLIENT DATA POPULATION
  getRecentBookings: async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 10;
      console.log(`[Dashboard Controller] Fetching ${limit} recent bookings with client data...`);
      
      // Fetch bookings and populate client data
      const bookings = await Booking.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      console.log(`[Dashboard Controller] Found ${bookings.length} bookings, populating client data...`);

      // Manually populate client data for each booking
      const bookingsWithClients = await Promise.all(
        bookings.map(async (booking) => {
          try {
            // Find the client by clientId
            const client = await Client.findById(booking.clientId).lean();
            
            console.log(`[Dashboard Controller] Booking ${booking._id} -> Client:`, client?.firstName, client?.lastName);
            
            return {
              _id: booking._id,
              id: booking._id.toString(),
              
              // CLIENT DATA - Multiple ways to access
              clientId: booking.clientId,
              clientName: client ? `${client.firstName} ${client.lastName}`.trim() : 'Client not found',
              firstName: client?.firstName || '',
              lastName: client?.lastName || '',
              email: client?.email || '',
              phone: client?.phone || '',
              
              // BOOKING DATA
              serviceName: booking.serviceName || 'Unknown Service',
              date: booking.date || booking.createdAt,
              timeSlot: booking.timeSlot || 'Time not available',
              time: booking.timeSlot || 'To be confirmed',
              status: booking.status || 'pending',
              urgencyLevel: booking.urgencyLevel || 'standard',
              
              // VALUE DATA
              value: booking.estimatedValue || booking.price || booking.totalAmount || 0,
              price: booking.estimatedValue || booking.price || booking.totalAmount || 0,
              totalAmount: booking.estimatedValue || booking.price || booking.totalAmount || 0,
              estimatedValue: booking.estimatedValue || 0,
              
              // ADDITIONAL DATA
              reference: booking.reference,
              notes: booking.notes || '',
              paymentStatus: booking.paymentStatus || 'unpaid',
              createdAt: booking.createdAt,
              
              // NESTED CLIENT OBJECT (for compatibility)
              client: client ? {
                _id: client._id,
                name: `${client.firstName} ${client.lastName}`.trim(),
                firstName: client.firstName,
                lastName: client.lastName,
                email: client.email,
                phone: client.phone,
                preferredContactMethod: client.preferredContactMethod
              } : null,
              
              // CLIENT INFO OBJECT (alternative structure)
              clientInfo: client ? {
                name: `${client.firstName} ${client.lastName}`.trim(),
                firstName: client.firstName,
                lastName: client.lastName,
                email: client.email,
                phone: client.phone,
                estimatedLoss: client.estimatedLoss || 0,
                caseType: client.caseType,
                notes: client.notes
              } : null
            };
          } catch (clientError) {
            console.error(`[Dashboard Controller] Error fetching client for booking ${booking._id}:`, clientError);
            
            return {
              _id: booking._id,
              id: booking._id.toString(),
              clientId: booking.clientId,
              clientName: 'Client data error',
              serviceName: booking.serviceName || 'Unknown Service',
              date: booking.date || booking.createdAt,
              timeSlot: booking.timeSlot || 'Time not available',
              time: booking.timeSlot || 'To be confirmed',
              status: booking.status || 'pending',
              value: booking.estimatedValue || 0,
              price: booking.estimatedValue || 0,
              urgencyLevel: booking.urgencyLevel || 'standard',
              createdAt: booking.createdAt
            };
          }
        })
      );

      console.log(`[Dashboard Controller] Successfully populated client data for ${bookingsWithClients.length} bookings`);

      // Log sample data for debugging
      if (bookingsWithClients.length > 0) {
        console.log('[Dashboard Controller] Sample booking with client data:', {
          _id: bookingsWithClients[0]._id,
          clientName: bookingsWithClients[0].clientName,
          firstName: bookingsWithClients[0].firstName,
          lastName: bookingsWithClients[0].lastName,
          email: bookingsWithClients[0].email,
          phone: bookingsWithClients[0].phone,
          serviceName: bookingsWithClients[0].serviceName,
          value: bookingsWithClients[0].value
        });
      }

      res.json({
        status: 'success',
        data: bookingsWithClients
      });

    } catch (error) {
      console.error('[Dashboard Controller] Error fetching bookings with clients:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch recent bookings with client data',
        error: error.message
      });
    }
  },

  // GET /api/dashboard/activities - FIXED VERSION
  getRecentActivities: async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 20;
      console.log(`[Dashboard Controller] Generating ${limit} recent activities using Mongoose...`);
      
      const recentBookings = await Booking.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
        .catch(err => {
          console.error('[Dashboard] Activities bookings error:', err);
          return [];
        });
      
      const recentClients = await Client.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
        .catch(err => {
          console.error('[Dashboard] Activities clients error:', err);
          return [];
        });

      const activities = [];

      // Add booking activities
      recentBookings.forEach(booking => {
        activities.push({
          _id: `booking-${booking._id}`,
          type: 'booking_created',
          clientName: booking.clientName || 'Client',
          description: `New booking created for ${booking.serviceName || 'service'}`,
          timestamp: booking.createdAt,
          metadata: { bookingId: booking._id }
        });
      });

      // Add client activities  
      recentClients.forEach(client => {
        activities.push({
          _id: `client-${client._id}`,
          type: 'client_registered',
          clientName: client.name || `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'New Client',
          description: 'New client registered for recovery services',
          timestamp: client.createdAt,
          metadata: { clientId: client._id }
        });
      });

      // Sort and limit
      const sortedActivities = activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);

      console.log(`[Dashboard Controller] Generated ${sortedActivities.length} activities`);
      
      res.json({
        status: 'success',
        data: sortedActivities
      });

    } catch (error) {
      console.error('[Dashboard Controller] Error generating activities:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to generate recent activities',
        error: error.message
      });
    }
  },

  // GET /api/dashboard/analytics/dashboard - FIXED VERSION
  getAnalyticsData: async (req, res) => {
    try {
      console.log('[Dashboard Controller] Fetching analytics data using Mongoose...');
      
      const bookings = await Booking.find().lean().catch(() => []);
      const services = await Service.find().lean().catch(() => []);

      // Generate service popularity
      const serviceStats = services.map(service => {
        const serviceBookings = bookings.filter(booking => 
          booking.serviceName === service.name || 
          booking.serviceId === service._id.toString()
        );
        
        const revenue = serviceBookings.reduce((sum, booking) => {
          return sum + (booking.price || booking.totalAmount || 0);
        }, 0);

        return {
          serviceId: service._id,
          name: service.name,
          bookingCount: serviceBookings.length,
          revenue: revenue
        };
      });

      const response = {
        status: 'success',
        data: {
          bookingStats: {
            totalRevenue: bookings.reduce((sum, b) => sum + (b.price || b.totalAmount || 0), 0),
            statusCounts: bookings.reduce((acc, booking) => {
              const status = booking.status || 'pending';
              acc[status] = (acc[status] || 0) + 1;
              return acc;
            }, {})
          },
          topServices: serviceStats
        }
      };

      console.log('[Dashboard Controller] Analytics data generated successfully');
      res.json(response);

    } catch (error) {
      console.error('[Dashboard Controller] Error fetching analytics:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch analytics data',
        error: error.message
      });
    }
  },

  // GET /api/dashboard/analytics/service-popularity - FIXED VERSION
  getServicePopularity: async (req, res) => {
    try {
      console.log('[Dashboard Controller] Fetching service popularity using Mongoose...');
      
      const bookings = await Booking.find().lean().catch(() => []);
      const services = await Service.find().lean().catch(() => []);

      const servicePopularity = services.map(service => {
        const serviceBookings = bookings.filter(booking => 
          booking.serviceName === service.name || 
          booking.serviceId === service._id.toString()
        );
        
        const revenue = serviceBookings.reduce((sum, booking) => {
          return sum + (booking.price || booking.totalAmount || 0);
        }, 0);

        return {
          serviceId: service._id,
          name: service.name,
          bookingCount: serviceBookings.length,
          revenue: revenue
        };
      });

      console.log('[Dashboard Controller] Service popularity calculated successfully');
      
      res.json({
        status: 'success',
        data: servicePopularity
      });

    } catch (error) {
      console.error('[Dashboard Controller] Error fetching service popularity:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch service popularity',
        error: error.message
      });
    }
  },

  // GET /api/dashboard/clients - NEW METHOD FOR DIRECT CLIENT ACCESS
  getClients: async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      console.log(`[Dashboard Controller] Fetching ${limit} clients directly from clients collection...`);

      const clients = await Client.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      const formattedClients = clients.map(client => ({
        _id: client._id,
        id: client._id.toString(),
        name: `${client.firstName} ${client.lastName}`.trim(),
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        phone: client.phone,
        preferredContactMethod: client.preferredContactMethod,
        caseType: client.caseType,
        estimatedLoss: client.estimatedLoss || 0,
        urgencyLevel: client.urgencyLevel,
        status: 'active', // Default status
        createdAt: client.createdAt,
        lastActivity: client.lastActivity,
        notes: client.notes
      }));

      console.log(`[Dashboard Controller] Found ${formattedClients.length} clients directly from collection`);

      res.json({
        status: 'success',
        data: formattedClients
      });

    } catch (error) {
      console.error('[Dashboard Controller] Error fetching clients:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch clients',
        error: error.message
      });
    }
  }
};

module.exports = dashboardController; 