import mongoose from "mongoose";
// Organization Schema
const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    description: String,
    logo: String,
    maxUsers: {
      type: Number,
      default: 10,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    settings: {
      type: Object,
      default: {},
    },
    industry: String,
    size: {
      type: String,
      enum: ["small", "medium", "large"],
      default: "medium",
    },
    numberOfEmployees: {
      type: Number,
      min: 1,
      required: false,
    },
    website: String,
    status: {
      type: String,
      enum: ["active", "inactive", "pending"],
      default: "active",
    },
    
    // 🚫 DEPRECATED: Old single-license model (keep for migration)
    license_code: {
      type: String,
      uppercase: true,
      trim: true,
      default: null,
      ref: 'License',
      deprecated: true,
      comment: 'DEPRECATED: Company now owns a pool of licenses via CompanyLicense model',
    },
    
    // Audit & Compliance Settings (Spec 5.12)
    audit_retention_days: {
      type: Number,
      default: 2555, // 7 years (default compliance standard)
      min: 365, // Minimum 1 year
      max: 3650, // Maximum 10 years
    },
  },
  {
    timestamps: true,
  }
);
organizationSchema.index({ name: 1 }); // for faster name lookups
export const Organization = mongoose.model("Organization", organizationSchema);