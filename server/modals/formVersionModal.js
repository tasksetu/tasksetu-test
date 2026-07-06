import mongoose from "mongoose";
import { TimezoneHelper } from "../utils/timezoneHelper.js";

/**
 * Form Version Schema
 * Stores snapshots of form templates when published
 * Enables version history and rollback capability
 * Spec: Module 5 - Custom Forms - Publish / lifecycle / governance
 */

const versionSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true,
    },
    version_id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true,
    },
    // Reference to the form template
    form_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "FormTemplate",
      index: true,
    },
    form_template_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "FormTemplate",
    },
    // Version number (auto-incremented: 1, 2, 3, etc.)
    version_number: {
      type: Number,
      required: true,
      index: true,
    },
    // Complete snapshot of the form at publish time
    snapshot_data: {
      title: { type: String, required: true },
      description: String,
      fields: { type: Array, required: true }, // Full field definitions
      settings: { type: Object, default: {} },
      category_id: String,
      tags: [String],
      visibility: String,
      scope: String,
    },
    // Publishing metadata
    release_notes: {
      type: String,
      default: "",
    },
    published_by: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
      index: true,
    },
    published_at: {
      type: Date,
      default: Date.now,
      index: true,
    },
    // Validity period (optional)
    start_at: {
      type: Date,
      default: null,
    },
    end_at: {
      type: Date,
      default: null,
    },
    // External submission configuration
    external_submission_enabled: {
      type: Boolean,
      default: false,
    },
    external_token: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values, unique only when value is set
      // No default - field will be omitted if not provided
    },
    external_token_expiry: {
      type: Date,
      // No default - field will be omitted if not provided
    },
    // External URL for public submissions
    external_url: {
      type: String,
      // No default - field will be omitted if not provided
    },
    // Password protection for external forms (hashed)
    external_password: {
      type: String,
      // No default - field will be omitted if not provided
    },
    // CAPTCHA requirement for external submissions
    require_captcha: {
      type: Boolean,
      default: false,
    },
    // Publisher's IANA timezone (e.g. 'Asia/Kolkata') — used for date boundary checks
    timezone: {
      type: String,
      default: "UTC",
    },
    // Usage statistics
    usage_count: {
      type: Number,
      default: 0,
    },
    submission_count: {
      type: Number,
      default: 0,
    },
    last_submission_at: {
      type: Date,
      default: null,
    },
    // Version status
    status: {
      type: String,
      enum: ["ACTIVE", "DEPRECATED", "ARCHIVED"],
      default: "ACTIVE",
      index: true,
    },
    deprecated_at: {
      type: Date,
      default: null,
    },
    deprecation_reason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

// Indexes for performance
versionSchema.index({ form_id: 1, version_number: -1 });
versionSchema.index({ form_template_id: 1 });
versionSchema.index({ published_by: 1, published_at: -1 });
versionSchema.index({ form_id: 1, version_number: 1 }, { unique: true });

// Virtual for easy access to version ID
versionSchema.virtual("id").get(function () {
  return this.version_id || this._id;
});

// Method to check if version is active
versionSchema.methods.isActive = function () {
  const now = new Date();
  const tz = this.timezone || 'UTC';

  // start_at: form is not yet available before start-of-day in publisher's timezone
  let startOk = true;
  if (this.start_at) {
    const { startOfDay } = TimezoneHelper.getDayBoundaries(tz, this.start_at);
    startOk = now >= startOfDay;
  }

  // end_at: form expires after end-of-day in publisher's timezone
  let endOk = true;
  if (this.end_at) {
    const { endOfDay } = TimezoneHelper.getDayBoundaries(tz, this.end_at);
    endOk = now <= endOfDay;
  }

  return this.status === "ACTIVE" && startOk && endOk;
};

// Method to check if external token is expired
/**
 * Check if external token has expired (P1 - Spec 5.11 requirement)
 * Checks both token-specific expiry and form validity period
 */
versionSchema.methods.isExternalTokenExpired = function () {
  const now = new Date();

  // Check token-specific expiry first
  if (this.external_token_expiry && now > this.external_token_expiry) {
    return true;
  }

  // Check form validity period (end_at) using publisher's timezone
  if (this.end_at) {
    const tz = this.timezone || 'UTC';
    const { endOfDay } = TimezoneHelper.getDayBoundaries(tz, this.end_at);
    if (now > endOfDay) return true;
  }

  return false;
};

// Method to deprecate this version
versionSchema.methods.deprecate = async function (reason = null) {
  this.status = "DEPRECATED";
  this.deprecated_at = new Date();
  this.deprecation_reason = reason;
  return await this.save();
};

// Method to record submission
versionSchema.methods.recordSubmission = async function () {
  this.submission_count += 1;
  this.last_submission_at = new Date();
  return await this.save();
};

// Method to record usage (attachment)
versionSchema.methods.recordUsage = async function () {
  this.usage_count += 1;
  return await this.save();
};

// Static method to get next version number for a form
versionSchema.statics.getNextVersionNumber = async function (formId) {
  const latestVersion = await this.findOne({ form_id: formId })
    .sort({ version_number: -1 })
    .limit(1);
  return latestVersion ? latestVersion.version_number + 1 : 1;
};

// Static method to get latest version for a form
versionSchema.statics.getLatestVersion = async function (formId) {
  return await this.findOne({ form_id: formId, status: "ACTIVE" })
    .sort({ version_number: -1 })
    .limit(1);
};

// Static method to get version by external token
versionSchema.statics.getByExternalToken = async function (token) {
  return await this.findOne({
    external_token: token,
    external_submission_enabled: true,
    status: "ACTIVE",
  }).populate("form_id");
};

export const FormVersion = mongoose.model("FormVersion", versionSchema);
