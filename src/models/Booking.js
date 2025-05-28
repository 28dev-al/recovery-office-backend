const mongoose = require('mongoose');

/**
 * Booking Schema
 * Represents a booking in the system
 */
const bookingSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: [true, 'Client is required']
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'Service is required']
    },
    serviceName: {
      type: String,
      maxlength: [100, 'Service name cannot exceed 100 characters']
    },
    date: {
      type: Date,
      required: [true, 'Date is required']
    },
    timeSlot: {
      type: String,
      required: [true, 'Time slot is required']
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no-show'],
      default: 'pending'
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid', 'refunded', 'partial'],
      default: 'unpaid'
    },
    notes: {
      type: String,
      maxlength: 500
    },
    // Recovery consultation specific fields
    urgencyLevel: {
      type: String,
      enum: ['standard', 'urgent', 'emergency'],
      default: 'standard'
    },
    estimatedValue: {
      type: Number,
      min: [0, 'Estimated value cannot be negative'],
      max: [100000000, 'Please contact us directly for amounts over £100M']
    },
    reference: {
      type: String,
      unique: true,
      default: () => Math.random().toString(36).substring(2, 10).toUpperCase()
    },
    confirmationSent: {
      type: Boolean,
      default: false
    },
    reminderSent: {
      type: Boolean,
      default: false
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    cancellationReason: {
      type: String,
      maxlength: 200
    },
    // Enhanced recurring booking fields
    isRecurring: {
      type: Boolean,
      default: false
    },
    recurrencePattern: {
      type: String,
      enum: ['none', 'daily', 'weekly', 'biweekly', 'monthly'],
      default: 'none'
    },
    recurrenceEndDate: {
      type: Date
    },
    recurrenceCount: {
      type: Number,
      min: 0,
      default: 0
    },
    // Track parent-child relationships for recurring bookings
    parentBookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    },
    childBookings: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    }]
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Create indexes for better query performance
// Index for fetching a client's bookings
bookingSchema.index({ clientId: 1, date: 1 });

// Index for fetching bookings for a particular service and date
bookingSchema.index({ serviceId: 1, date: 1, status: 1 });

// Index for searching by status and date range (for admin dashboard)
bookingSchema.index({ status: 1, date: 1 });

// Index for searching by reference (for quick lookup)
bookingSchema.index({ reference: 1 });

// Index for checking availability (avoiding double bookings)
bookingSchema.index({ date: 1, timeSlot: 1, status: 1 });

// Index for recurring bookings
bookingSchema.index({ isRecurring: 1, recurrencePattern: 1 });
bookingSchema.index({ parentBookingId: 1 });

// Virtual field to get the start time
bookingSchema.virtual('startTime').get(function() {
  if (!this.timeSlot) return null;
  return this.timeSlot.split('-')[0];
});

// Virtual field to get the end time
bookingSchema.virtual('endTime').get(function() {
  if (!this.timeSlot) return null;
  return this.timeSlot.split('-')[1];
});

// Virtual for retrieving client details
bookingSchema.virtual('client', {
  ref: 'Client',
  localField: 'clientId',
  foreignField: '_id',
  justOne: true
});

// Virtual for retrieving service details
bookingSchema.virtual('service', {
  ref: 'Service',
  localField: 'serviceId',
  foreignField: '_id',
  justOne: true
});

// Virtual for retrieving related bookings in a series
bookingSchema.virtual('seriesBookings', {
  ref: 'Booking',
  localField: 'parentBookingId',
  foreignField: 'parentBookingId',
  options: { sort: { date: 1 } }
});

/**
 * Pre-remove hook to handle cascade delete for recurring bookings
 * Removes all child bookings when a parent booking is deleted
 */
bookingSchema.pre('remove', async function(next) {
  if (this.isRecurring && this.childBookings && this.childBookings.length > 0) {
    const Booking = this.constructor;
    await Booking.deleteMany({ _id: { $in: this.childBookings } });
  }
  next();
});

/**
 * Method to cancel all future bookings in a series
 * 
 * @param {string} reason - Cancellation reason
 * @param {Object} user - User performing the cancellation
 * @returns {Promise<Array>} - Array of cancelled bookings
 */
bookingSchema.methods.cancelSeries = async function(reason, user = null) {
  const today = new Date();
  const Booking = this.constructor;
  
  // If this is a parent booking, cancel all future child bookings
  if (this.isRecurring && this.childBookings && this.childBookings.length > 0) {
    const cancellations = await Booking.updateMany(
      { 
        _id: { $in: this.childBookings },
        date: { $gt: today }
      },
      { 
        status: 'cancelled',
        cancellationReason: reason,
        updatedBy: user ? user._id : undefined
      }
    );
    
    return cancellations;
  }
  
  // If this is a child booking, cancel all future bookings in the series
  if (this.parentBookingId) {
    const parent = await Booking.findById(this.parentBookingId);
    
    if (parent) {
      const cancellations = await Booking.updateMany(
        {
          parentBookingId: parent._id,
          date: { $gt: today }
        },
        {
          status: 'cancelled',
          cancellationReason: reason,
          updatedBy: user ? user._id : undefined
        }
      );
      
      return cancellations;
    }
  }
  
  return [];
};

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking; 