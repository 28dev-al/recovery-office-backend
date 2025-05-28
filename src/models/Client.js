const mongoose = require('mongoose');

/**
 * Client Schema
 * Represents a client in the system
 */
const clientSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters']
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address'
      ]
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      match: [
        /^(\+\d{1,3}[- ]?)?\d{10,14}$/,
        'Please provide a valid phone number'
      ]
    },
    preferredContactMethod: {
      type: String,
      enum: ['email', 'phone', 'both'],
      default: 'email'
    },
    address: {
      street: {
        type: String,
        trim: true
      },
      city: {
        type: String,
        trim: true
      },
      state: {
        type: String,
        trim: true
      },
      postalCode: {
        type: String,
        trim: true
      },
      country: {
        type: String,
        trim: true,
        default: 'United Kingdom'
      }
    },
    dateOfBirth: {
      type: Date
    },
    notes: {
      type: String,
      maxlength: [1000, 'Notes cannot exceed 1000 characters']
    },
    // Recovery consultation specific fields
    company: {
      type: String,
      trim: true,
      maxlength: [100, 'Company name cannot exceed 100 characters']
    },
    caseType: {
      type: String,
      enum: ['cryptocurrency-recovery', 'investment-fraud', 'financial-scam', 'regulatory-complaint', 'other'],
      default: 'other'
    },
    estimatedLoss: {
      type: Number,
      min: [0, 'Estimated loss cannot be negative'],
      max: [100000000, 'Please contact us directly for amounts over £100M']
    },
    urgencyLevel: {
      type: String,
      enum: ['standard', 'urgent', 'emergency'],
      default: 'standard'
    },
    // GDPR and consent fields
    gdprConsent: {
      type: Boolean,
      required: [true, 'GDPR consent is required']
    },
    gdprConsentDate: {
      type: Date,
      default: Date.now
    },
    marketingConsent: {
      type: Boolean,
      default: false
    },
    marketingConsentDate: {
      type: Date
    },
    // Consent update history
    consentHistory: [
      {
        type: {
          type: String,
          enum: ['gdpr', 'marketing'],
          required: true
        },
        status: {
          type: Boolean,
          required: true
        },
        date: {
          type: Date,
          required: true,
          default: Date.now
        },
        ipAddress: String,
        userAgent: String
      }
    ],
    // For data retention policy
    lastActivity: {
      type: Date,
      default: Date.now
    },
    dataRetentionDate: {
      type: Date
    },
    isAnonymized: {
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
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Create indexes for better query performance
// Index for email searches (unique, so automatically indexed)
clientSchema.index({ email: 1 });

// Index for name searches
clientSchema.index({ firstName: 1, lastName: 1 });

// Index for phone searches
clientSchema.index({ phone: 1 });

// Index for marketing consent status (for marketing campaigns)
clientSchema.index({ marketingConsent: 1 });

// Index for data retention queries
clientSchema.index({ lastActivity: 1, isAnonymized: 1 });

// Virtual for full name
clientSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for client bookings
clientSchema.virtual('bookings', {
  ref: 'Booking',
  localField: '_id',
  foreignField: 'clientId'
});

// Update last activity date
clientSchema.pre('save', function(next) {
  this.lastActivity = new Date();
  
  // Set data retention date if not already set
  if (!this.dataRetentionDate) {
    const retentionDate = new Date();
    // Default retention period: 7 years after creation
    retentionDate.setFullYear(retentionDate.getFullYear() + 7);
    this.dataRetentionDate = retentionDate;
  }
  
  // If marketing consent is given, update the consent date
  if (this.isModified('marketingConsent') && this.marketingConsent) {
    this.marketingConsentDate = new Date();
  }
  
  next();
});

// Method to anonymize client data
clientSchema.methods.anonymize = async function() {
  const anonymousData = {
    firstName: 'Anonymous',
    lastName: 'User',
    email: `anonymized-${this._id}@example.com`,
    phone: '0000000000',
    address: {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: ''
    },
    notes: '',
    isAnonymized: true
  };
  
  Object.assign(this, anonymousData);
  return this.save();
};

// Update consent history
clientSchema.methods.updateConsent = function(type, status, ipAddress, userAgent) {
  const consentRecord = {
    type,
    status,
    date: new Date(),
    ipAddress,
    userAgent
  };
  
  this.consentHistory.push(consentRecord);
  
  if (type === 'gdpr') {
    this.gdprConsent = status;
    this.gdprConsentDate = consentRecord.date;
  } else if (type === 'marketing') {
    this.marketingConsent = status;
    this.marketingConsentDate = status ? consentRecord.date : null;
  }
  
  return this.save();
};

const Client = mongoose.model('Client', clientSchema);

module.exports = Client; 