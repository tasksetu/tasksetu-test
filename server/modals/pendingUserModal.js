import mongoose from "mongoose";
// Pending User Schema for email verification during registration
const pendingUserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  type: { type: String, enum: ["individual", "organization"], required: true },
  organizationName: { type: String }, // Only for organization type
  organizationSlug: { type: String }, // Only for organization type
  licenseId: {
    type: String,
    enum: ["Explore (Free)", "Plan", "Execute", "Optimize"],
    required: function () {
      // Only require license when user is active
      return this.status !== "invited";
    },
    default: "Explore (Free)",
  },
  department: { type: String, maxlength: 50 },
  designation: { type: String, maxlength: 50 },
  location: { type: String, maxlength: 50 },
  verificationCode: { type: String },
  verificationExpires: { type: Date },
  isVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: Date.now, expires: 86400 }, // 24 hours
});
export const PendingUser = mongoose.model("PendingUser", pendingUserSchema);