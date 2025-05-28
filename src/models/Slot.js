const mongoose = require('mongoose');

/**
 * Slot Schema
 * Represents a time slot for a service
 */
const SlotSchema = new mongoose.Schema({
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: [true, 'Service ID is required']
  },
  date: {
    type: Date,
    required: [true, 'Date is required']
  },
  timeSlot: {
    type: String,
    required: [true, 'Time slot is required'],
    validate: {
      validator: function(v) {
        // Format: HH:MM-HH:MM (e.g. 10:00-11:00)
        return /^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(v);
      },
      message: props => `${props.value} is not a valid time slot format. Use HH:MM-HH:MM format.`
    }
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index for quick lookups by date and availability
SlotSchema.index({ date: 1, isAvailable: 1 });
// Compound index for quick lookups by service and date
SlotSchema.index({ serviceId: 1, date: 1 });

/**
 * Static method to find available slots for a service on a specific date
 */
SlotSchema.statics.findAvailableSlots = async function(serviceId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return this.find({
    serviceId,
    date: { $gte: startOfDay, $lte: endOfDay },
    isAvailable: true
  }).sort('timeSlot');
};

/**
 * Static method to reserve a slot for a booking
 */
SlotSchema.statics.reserveSlot = async function(slotId, bookingId) {
  return this.findByIdAndUpdate(
    slotId,
    { isAvailable: false, bookingId },
    { new: true, runValidators: true }
  );
};

/**
 * Static method to release a slot when a booking is cancelled
 */
SlotSchema.statics.releaseSlot = async function(bookingId) {
  return this.findOneAndUpdate(
    { bookingId },
    { isAvailable: true, bookingId: null },
    { new: true }
  );
};

const Slot = mongoose.model('Slot', SlotSchema);

module.exports = Slot; 