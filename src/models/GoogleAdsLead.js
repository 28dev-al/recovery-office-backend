const mongoose = require('mongoose');

/**
 * Google Ads Lead Schema
 * Represents a lead captured from Google Ads landing page
 * SEPARATE from existing booking/consultation systems
 */
const googleAdsLeadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address'
      ]
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [
        /^(\+\d{1,3}[- ]?)?\d{10,14}$/,
        'Please provide a valid phone number'
      ]
    },
    estimatedLoss: {
      type: String,
      trim: true,
      maxlength: [50, 'Estimated loss cannot exceed 50 characters']
    },
    lossType: {
      type: String,
      required: [true, 'Loss type is required'],
      enum: [
        'cryptocurrency-recovery',
        'investment-fraud', 
        'financial-scam',
        'binary-options',
        'forex-scam',
        'romance-scam',
        'pig-butchering',
        'other'
      ]
    },
    urgencyLevel: {
      type: String,
      enum: ['normal', 'urgent', 'emergency'],
      default: 'normal'
    },
    description: {
      type: String,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      trim: true
    },
    source: {
      type: String,
      default: 'google-ads',
      enum: ['google-ads', 'facebook-ads', 'landing-page', 'other']
    },
    leadStatus: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'converted', 'closed', 'unqualified'],
      default: 'new'
    },
    priority: {
      type: String,
      enum: ['normal', 'urgent', 'emergency'],
      default: 'normal'
    },
    referenceNumber: {
      type: String,
      unique: true,
      default: function() {
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
        const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `GAL-${dateStr}-${randomStr}`;
      }
    },
    // Contact tracking
    contactAttempts: {
      type: Number,
      default: 0,
      min: 0
    },
    lastContactedAt: {
      type: Date
    },
    contactNotes: [{
      note: {
        type: String,
        maxlength: 500
      },
      contactedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      contactMethod: {
        type: String,
        enum: ['phone', 'email', 'whatsapp', 'sms']
      },
      outcome: {
        type: String,
        enum: ['answered', 'voicemail', 'no-answer', 'busy', 'invalid', 'callback-requested']
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    // Lead qualification
    qualificationScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    qualificationNotes: {
      type: String,
      maxlength: 500
    },
    // Conversion tracking
    convertedAt: {
      type: Date
    },
    convertedToBookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    },
    // IP and tracking data
    ipAddress: {
      type: String,
      trim: true
    },
    userAgent: {
      type: String,
      trim: true
    },
    utmSource: {
      type: String,
      trim: true
    },
    utmMedium: {
      type: String,
      trim: true
    },
    utmCampaign: {
      type: String,
      trim: true
    },
    utmContent: {
      type: String,
      trim: true
    },
    utmTerm: {
      type: String,
      trim: true
    },
    // Admin tracking
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    assignedAt: {
      type: Date
    },
    // Email confirmations
    confirmationSent: {
      type: Boolean,
      default: false
    },
    confirmationSentAt: {
      type: Date
    },
    internalNotificationSent: {
      type: Boolean,
      default: false
    },
    internalNotificationSentAt: {
      type: Date
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Create indexes for better query performance
googleAdsLeadSchema.index({ email: 1 });
googleAdsLeadSchema.index({ phone: 1 });
googleAdsLeadSchema.index({ leadStatus: 1, createdAt: -1 });
googleAdsLeadSchema.index({ priority: 1, createdAt: -1 });
googleAdsLeadSchema.index({ source: 1, createdAt: -1 });
googleAdsLeadSchema.index({ referenceNumber: 1 });
googleAdsLeadSchema.index({ assignedTo: 1, leadStatus: 1 });
googleAdsLeadSchema.index({ createdAt: -1 });

// Virtual for getting lead age in hours
googleAdsLeadSchema.virtual('ageInHours').get(function() {
  return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60));
});

// Virtual for getting response time requirement based on priority
googleAdsLeadSchema.virtual('responseTimeHours').get(function() {
  switch (this.priority) {
    case 'emergency': return 1;
    case 'urgent': return 4;
    default: return 24;
  }
});

// Virtual for checking if lead is overdue
googleAdsLeadSchema.virtual('isOverdue').get(function() {
  if (this.leadStatus === 'contacted' || this.leadStatus === 'converted' || this.leadStatus === 'closed') {
    return false;
  }
  return this.ageInHours > this.responseTimeHours;
});

// Pre-save middleware to set priority based on estimated loss
googleAdsLeadSchema.pre('save', function(next) {
  // Auto-set priority based on estimated loss if not already set
  if (this.isNew && this.priority === 'normal' && this.estimatedLoss) {
    const lossStr = this.estimatedLoss.toLowerCase();
    
    // Emergency: >£100k or mentions "urgent", "emergency", "immediate"
    if (lossStr.includes('100') || 
        lossStr.includes('million') || 
        lossStr.includes('urgent') || 
        lossStr.includes('emergency') || 
        lossStr.includes('immediate')) {
      this.priority = 'emergency';
    }
    // Urgent: >£10k or mentions "soon", "asap", "quickly"
    else if (lossStr.includes('50') || 
             lossStr.includes('thousand') || 
             lossStr.includes('soon') || 
             lossStr.includes('asap') || 
             lossStr.includes('quickly')) {
      this.priority = 'urgent';
    }
  }
  
  next();
});

// Instance method to add contact note
googleAdsLeadSchema.methods.addContactNote = function(note, contactedBy, contactMethod, outcome) {
  this.contactNotes.push({
    note,
    contactedBy,
    contactMethod,
    outcome,
    createdAt: new Date()
  });
  
  this.contactAttempts += 1;
  this.lastContactedAt = new Date();
  
  // Update status if successfully contacted
  if (outcome === 'answered' || outcome === 'callback-requested') {
    this.leadStatus = 'contacted';
  }
  
  return this.save();
};

// Instance method to convert to booking
googleAdsLeadSchema.methods.convertToBooking = function(bookingId, userId) {
  this.leadStatus = 'converted';
  this.convertedAt = new Date();
  this.convertedToBookingId = bookingId;
  this.assignedTo = userId;
  
  return this.save();
};

// Static method to get leads requiring immediate attention
googleAdsLeadSchema.statics.getUrgentLeads = function() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
  
  return this.find({
    leadStatus: { $in: ['new', 'contacted'] },
    $or: [
      { priority: 'emergency', createdAt: { $lt: oneHourAgo } },
      { priority: 'urgent', createdAt: { $lt: fourHoursAgo } },
      { priority: 'normal', createdAt: { $lt: twentyFourHoursAgo } }
    ]
  }).sort({ priority: -1, createdAt: 1 });
};

// Static method to get lead statistics
googleAdsLeadSchema.statics.getLeadStats = function(startDate, endDate) {
  const matchStage = startDate && endDate ? {
    createdAt: { $gte: startDate, $lte: endDate }
  } : {};
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalLeads: { $sum: 1 },
        newLeads: { $sum: { $cond: [{ $eq: ['$leadStatus', 'new'] }, 1, 0] } },
        contactedLeads: { $sum: { $cond: [{ $eq: ['$leadStatus', 'contacted'] }, 1, 0] } },
        qualifiedLeads: { $sum: { $cond: [{ $eq: ['$leadStatus', 'qualified'] }, 1, 0] } },
        convertedLeads: { $sum: { $cond: [{ $eq: ['$leadStatus', 'converted'] }, 1, 0] } },
        emergencyLeads: { $sum: { $cond: [{ $eq: ['$priority', 'emergency'] }, 1, 0] } },
        urgentLeads: { $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] } },
        averageResponseTime: { $avg: '$contactAttempts' }
      }
    }
  ]);
};

const GoogleAdsLead = mongoose.model('GoogleAdsLead', googleAdsLeadSchema);

module.exports = GoogleAdsLead; 