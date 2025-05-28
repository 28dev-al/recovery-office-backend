/**
 * Swagger configuration for API documentation
 */
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Swagger definition
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Recovery Office API',
    version: '1.0.0',
    description: 'API for Recovery Office booking system',
    contact: {
      name: 'Recovery Office Support',
      email: 'support@recovery-office.com'
    },
    license: {
      name: 'Proprietary',
      url: 'https://recovery-office.com/terms'
    }
  },
  servers: [
    {
      url: '/api',
      description: 'Development server'
    },
    {
      url: 'https://api.recovery-office.com/api',
      description: 'Production server'
    }
  ],
  tags: [
    {
      name: 'Auth',
      description: 'Authentication endpoints'
    },
    {
      name: 'Bookings',
      description: 'Booking management'
    },
    {
      name: 'Services',
      description: 'Service management'
    },
    {
      name: 'Clients',
      description: 'Client management'
    },
    {
      name: 'Slots',
      description: 'Time slot management'
    },
    {
      name: 'Waitlist',
      description: 'Waitlist management'
    },
    {
      name: 'Analytics',
      description: 'Analytics and reporting'
    }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      },
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-KEY'
      }
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            example: 'error'
          },
          message: {
            type: 'string',
            example: 'Error message'
          },
          code: {
            type: 'string',
            example: 'ERROR_CODE'
          }
        }
      },
      Booking: {
        type: 'object',
        required: ['clientId', 'serviceId', 'date', 'timeSlot'],
        properties: {
          _id: {
            type: 'string',
            description: 'Auto-generated MongoDB ID'
          },
          clientId: {
            type: 'string',
            description: 'Reference to Client model'
          },
          serviceId: {
            type: 'string',
            description: 'Reference to Service model'
          },
          date: {
            type: 'string',
            format: 'date',
            description: 'Booking date'
          },
          timeSlot: {
            type: 'string',
            description: 'Time slot (e.g. 10:00-11:00)'
          },
          status: {
            type: 'string',
            enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no-show'],
            description: 'Booking status'
          },
          paymentStatus: {
            type: 'string',
            enum: ['unpaid', 'paid', 'refunded', 'partial'],
            description: 'Payment status'
          },
          notes: {
            type: 'string',
            description: 'Booking notes'
          },
          reference: {
            type: 'string',
            description: 'Unique booking reference'
          },
          isRecurring: {
            type: 'boolean',
            description: 'Whether this is a recurring booking'
          },
          recurrencePattern: {
            type: 'string',
            enum: ['none', 'daily', 'weekly', 'biweekly', 'monthly'],
            description: 'Recurrence pattern'
          },
          recurrenceEndDate: {
            type: 'string',
            format: 'date',
            description: 'End date for recurring bookings'
          },
          parentBookingId: {
            type: 'string',
            description: 'Reference to parent booking for recurring series'
          }
        }
      },
      Client: {
        type: 'object',
        required: ['firstName', 'lastName', 'email', 'phone'],
        properties: {
          _id: {
            type: 'string',
            description: 'Auto-generated MongoDB ID'
          },
          firstName: {
            type: 'string'
          },
          lastName: {
            type: 'string'
          },
          email: {
            type: 'string',
            format: 'email'
          },
          phone: {
            type: 'string'
          },
          preferredContactMethod: {
            type: 'string',
            enum: ['email', 'phone', 'sms']
          },
          marketingConsent: {
            type: 'boolean'
          }
        }
      },
      Service: {
        type: 'object',
        required: ['name', 'duration', 'price'],
        properties: {
          _id: {
            type: 'string',
            description: 'Auto-generated MongoDB ID'
          },
          name: {
            type: 'string'
          },
          description: {
            type: 'string'
          },
          duration: {
            type: 'number',
            description: 'Duration in minutes'
          },
          price: {
            type: 'number'
          },
          category: {
            type: 'string'
          },
          isActive: {
            type: 'boolean'
          }
        }
      },
      Slot: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            description: 'Auto-generated MongoDB ID'
          },
          serviceId: {
            type: 'string',
            description: 'Reference to Service model'
          },
          date: {
            type: 'string',
            format: 'date'
          },
          timeSlot: {
            type: 'string',
            description: 'Time slot (e.g. 10:00-11:00)'
          },
          isAvailable: {
            type: 'boolean'
          },
          bookingId: {
            type: 'string',
            description: 'Reference to Booking model if slot is booked'
          }
        }
      },
      Waitlist: {
        type: 'object',
        required: ['clientId', 'serviceId', 'requestedDate'],
        properties: {
          _id: {
            type: 'string',
            description: 'Auto-generated MongoDB ID'
          },
          clientId: {
            type: 'string',
            description: 'Reference to Client model'
          },
          serviceId: {
            type: 'string',
            description: 'Reference to Service model'
          },
          requestedDate: {
            type: 'string',
            format: 'date',
            description: 'Requested date'
          },
          preferredTimeSlots: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Preferred time slots'
          },
          status: {
            type: 'string',
            enum: ['pending', 'notified', 'booked', 'expired', 'cancelled'],
            description: 'Waitlist entry status'
          },
          notes: {
            type: 'string'
          },
          priority: {
            type: 'number',
            description: 'Priority (0-10, higher is more important)'
          }
        }
      },
      DashboardResponse: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            example: 'success'
          },
          data: {
            type: 'object',
            properties: {
              periodStart: {
                type: 'string',
                format: 'date-time'
              },
              periodEnd: {
                type: 'string',
                format: 'date-time'
              },
              bookingStats: {
                type: 'object'
              },
              topServices: {
                type: 'array',
                items: {
                  type: 'object'
                }
              },
              clientAcquisition: {
                type: 'array',
                items: {
                  type: 'object'
                }
              },
              waitlistMetrics: {
                type: 'object'
              }
            }
          }
        }
      }
    }
  }
};

// Swagger options
const options = {
  swaggerDefinition,
  // Path to the API docs
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js',
    './src/models/*.js'
  ]
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJsdoc(options);

// Setup Swagger middleware
exports.setupSwagger = (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Recovery Office API Documentation'
  }));

  // Serve swagger.json
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}; 