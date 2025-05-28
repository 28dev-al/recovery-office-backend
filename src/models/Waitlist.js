/**
 * Waitlist Model
 * Allows clients to join a waitlist for fully booked slots
 */
const mongoose = require('mongoose');

const waitlistSchema = new mongoose.Schema(
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
    requestedDate: {
      type: Date,
      required: [true, 'Requested date is required']
    },
    preferredTimeSlots: [{
      type: String,
      validate: {
        validator: function(timeSlot) {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeSlot);
        },
        message: 'Time slot must be in format HH:MM-HH:MM'
      }
    }],
    status: {
      type: String,
      enum: ['pending', 'notified', 'booked', 'expired', 'cancelled'],
      default: 'pending'
    },
    notes: {
      type: String,
      maxlength: 500
    },
    priority: {
      type: Number,
      default: 0,
      min: 0,
      max: 10
    },
    notifiedAt: {
      type: Date
    },
    bookedAt: {
      type: Date
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    },
    expiresAt: {
      type: Date,
      default: function() {
        // Default expiry is 30 days from requested date
        const expiry = new Date(this.requestedDate);
        expiry.setDate(expiry.getDate() + 30);
        return expiry;
      }
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better query performance
waitlistSchema.index({ clientId: 1, status: 1 });
waitlistSchema.index({ serviceId: 1, requestedDate: 1, status: 1 });
waitlistSchema.index({ status: 1, expiresAt: 1 });
waitlistSchema.index({ priority: -1, createdAt: 1 }); // For prioritized ordering

// Virtual for retrieving client details
waitlistSchema.virtual('client', {
  ref: 'Client',
  localField: 'clientId',
  foreignField: '_id',
  justOne: true
});

// Virtual for retrieving service details
waitlistSchema.virtual('service', {
  ref: 'Service',
  localField: 'serviceId',
  foreignField: '_id',
  justOne: true
});

// Method to mark waitlist entry as notified
waitlistSchema.methods.markAsNotified = async function() {
  this.status = 'notified';
  this.notifiedAt = new Date();
  return this.save();
};

// Method to mark waitlist entry as booked
waitlistSchema.methods.markAsBooked = async function(bookingId) {
  this.status = 'booked';
  this.bookedAt = new Date();
  this.bookingId = bookingId;
  return this.save();
};

// Method to mark waitlist entry as expired
waitlistSchema.methods.markAsExpired = async function() {
  this.status = 'expired';
  return this.save();
};

// Method to mark waitlist entry as cancelled
waitlistSchema.methods.markAsCancelled = async function() {
  this.status = 'cancelled';
  return this.save();
};

// Static method to find and process expired waitlist entries
waitlistSchema.statics.processExpired = async function() {
  const now = new Date();
  
  const expiredEntries = await this.find({
    status: 'pending',
    expiresAt: { $lte: now }
  });
  
  for (const entry of expiredEntries) {
    await entry.markAsExpired();
  }
  
  return expiredEntries.length;
};

// Static method to find waitlist entries for a slot
waitlistSchema.statics.findForSlot = async function(serviceId, date, limit = 5) {
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);
  
  return this.find({
    serviceId,
    requestedDate: { $gte: startDate, $lte: endDate },
    status: 'pending'
  })
  .sort({ priority: -1, createdAt: 1 })
  .limit(limit)
  .populate('clientId', 'firstName lastName email phone preferredContactMethod');
};

const Waitlist = mongoose.model('Waitlist', waitlistSchema);

module.exports = Waitlist; 