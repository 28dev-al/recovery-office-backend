const mongoose = require('mongoose');

/**
 * Service Schema
 * Represents services offered by Recovery Office for booking
 */
const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true,
      maxlength: [100, 'Service name cannot exceed 100 characters']
    },
    description: {
      type: String,
      required: [true, 'Service description is required'],
      trim: true,
      maxlength: [1000, 'Service description cannot exceed 1000 characters']
    },
    duration: {
      type: Number,
      required: [true, 'Service duration is required'],
      min: [15, 'Service duration must be at least 15 minutes'],
      max: [480, 'Service duration cannot exceed 480 minutes (8 hours)']
    },
    price: {
      type: Number,
      min: 0,
      default: 0
    },
    icon: {
      type: String,
      default: 'https://images2.imgbox.com/86/72/GE2VLjan_o.png'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    category: {
      type: String,
      required: true,
      enum: ['recovery', 'consultation', 'investigation', 'legal', 'compliance'],
      default: 'consultation'
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true
    }
  },
  {
    timestamps: true,
    toJSON: { 
      virtuals: true,
      transform: function(doc, ret) {
        ret.formattedPrice = `£${ret.price}`;
        ret.formattedDuration = ret.duration === 60 ? '1 hour' : 
                               ret.duration > 60 ? `${Math.floor(ret.duration / 60)} hour ${ret.duration % 60} minutes` :
                               `${ret.duration} minutes`;
        return ret;
      }
    },
    toObject: { virtuals: true }
  }
);

// Create slug from service name before saving
serviceSchema.pre('save', function(next) {
  this.slug = this.name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  next();
});

// Virtual for formatted price
serviceSchema.virtual('formattedPrice').get(function() {
  if (this.price === 0) return 'Free consultation';
  return `£${this.price}`;
});

// Virtual for formatted duration
serviceSchema.virtual('formattedDuration').get(function() {
  if (this.duration === 60) return '1 hour';
  if (this.duration > 60) {
    const hours = Math.floor(this.duration / 60);
    const minutes = this.duration % 60;
    if (minutes === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
  return `${this.duration} minutes`;
});

const Service = mongoose.model('Service', serviceSchema);

module.exports = Service; 