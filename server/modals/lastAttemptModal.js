import mongoose from "mongoose";

// Login Attempt Schema for tracking failed login attempts
const loginAttemptSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      index: true,
    },
    attemptCount: {
      type: Number,
      default: 1,
    },
    firstAttemptAt: {
      type: Date,
      default: Date.now,
    },
    lastAttemptAt: {
      type: Date,
      default: Date.now,
    },
    isLocked: {
      type: Boolean,
      default: false,
    },
    lockoutExpiresAt: {
      type: Date,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// TTL index to automatically delete records after 24 hours
loginAttemptSchema.index({ lastAttemptAt: 1 }, { expireAfterSeconds: 86400 }); // 24 hours
export const LoginAttempt = mongoose.model("LoginAttempt", loginAttemptSchema);