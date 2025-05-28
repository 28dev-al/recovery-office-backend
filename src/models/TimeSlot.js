const mongoose = require('mongoose');

/**
 * TimeSlot Schema
 * Represents available time slots for bookings
 */
const timeSlotSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, 'Date is required']
    },
    slot: {
      type: String,
      required: [true, 'Time slot is required'],
      validate: {
        validator: function(v) {
          // Validate time slot format (HH:MM-HH:MM)
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]-([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: props => `${props.value} is not a valid time slot format (HH:MM-HH:MM)`
      }
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'Service is required for time slot']
    },
    isAvailable: {
      type: Boolean,
      default: true
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null
    },
    capacity: {
      type: Number,
      default: 1,
      min: 1,
      max: 10
    },
    isBlocked: {
      type: Boolean,
      default: false
    },
    blockedReason: {
      type: String,
      maxlength: [200, 'Blocking reason cannot exceed 200 characters']
    }
  },
  {
    timestamps: true
  }
);

// Add compound index for date and slot
timeSlotSchema.index({ date: 1, slot: 1, serviceId: 1 }, { unique: true });
timeSlotSchema.index({ isAvailable: 1 });
timeSlotSchema.index({ date: 1, isAvailable: 1 });

// Method to check if slot can be booked
timeSlotSchema.methods.canBeBooked = function() {
  return this.isAvailable && !this.isBlocked && this.bookingId === null;
};

// Static method to find all available slots for a service on a specific date
timeSlotSchema.statics.findAvailableSlots = async function(serviceId, date) {
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);
  
  return this.find({
    serviceId,
    date: {
      $gte: startDate,
      $lte: endDate
    },
    isAvailable: true,
    isBlocked: false,
    bookingId: null
  }).sort('slot');
};

// Static method to generate slots for a date range
timeSlotSchema.statics.generateSlotsForDateRange = async function(
  serviceId,
  startDate,
  endDate,
  slotDuration = 60, // in minutes
  startTime = '09:00',
  endTime = '17:00',
  excludeDays = [0, 6] // Sunday and Saturday by default
) {
  const service = await mongoose.model('Service').findById(serviceId);
  if (!service) {
    throw new Error('Service not found');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const slots = [];

  // Loop through each day in the range
  for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
    // Skip excluded days (e.g., weekends)
    if (excludeDays.includes(day.getDay())) continue;

    // Parse start and end time
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    // Create slots
    const currentDate = new Date(day);
    currentDate.setHours(startHour, startMinute, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(endHour, endMinute, 0, 0);

    while (currentDate < dayEnd) {
      const slotStart = `${currentDate.getHours().toString().padStart(2, '0')}:${currentDate
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;

      const slotEndTime = new Date(currentDate);
      slotEndTime.setMinutes(slotEndTime.getMinutes() + slotDuration);

      // Check if the slot end time exceeds the day end
      if (slotEndTime > dayEnd) break;

      const slotEnd = `${slotEndTime.getHours().toString().padStart(2, '0')}:${slotEndTime
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;

      slots.push({
        date: new Date(day),
        slot: `${slotStart}-${slotEnd}`,
        serviceId,
        isAvailable: true
      });

      currentDate.setMinutes(currentDate.getMinutes() + slotDuration);
    }
  }

  // Insert slots in batches
  if (slots.length > 0) {
    await this.insertMany(slots, { ordered: false });
  }

  return slots;
};

const TimeSlot = mongoose.model('TimeSlot', timeSlotSchema);

module.exports = TimeSlot; 