const mongoose = require('mongoose');

/**
 * RefreshToken Schema
 * Used for tracking refresh tokens and implementing token blacklisting
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    isRevoked: {
      type: Boolean,
      default: false
    },
    ip: {
      type: String,
      required: false
    },
    userAgent: {
      type: String,
      required: false
    },
    expiresAt: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Create index for token lookup
refreshTokenSchema.index({ token: 1 });

// Create index for user's tokens
refreshTokenSchema.index({ userId: 1 });

// Create index for expired tokens
refreshTokenSchema.index({ expiresAt: 1 });

// Check if token is expired
refreshTokenSchema.methods.isExpired = function() {
  return Date.now() >= this.expiresAt.getTime();
};

// Add static method to clean expired tokens
refreshTokenSchema.statics.removeExpiredTokens = async function() {
  return this.deleteMany({ expiresAt: { $lt: new Date() } });
};

// Add static method to revoke all tokens for a user
refreshTokenSchema.statics.revokeAllUserTokens = async function(userId) {
  return this.updateMany(
    { userId, isRevoked: false },
    { $set: { isRevoked: true } }
  );
};

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

module.exports = RefreshToken; 