// Feature Flags Management
import mongoose from "mongoose";

const featureFlagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    enum: [
      "CALENDAR_ENABLED",
      "EMAIL_TO_TASK_ENABLED",
      "EXTERNAL_FORMS_ENABLED",
      "RECURRING_TASKS_ENABLED",
      "QUICK_TASKS_ENABLED",
      "APPROVAL_WORKFLOW_ENABLED",
      "SSO_ENABLED",
      "API_ENABLED"
    ]
  },
  description: String,
  enabled: {
    type: Boolean,
    default: false
  },
  rollout_percentage: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  change_log: [{
    changed_from: Boolean,
    changed_to: Boolean,
    changed_at: Date,
    changed_by: String
  }]
});

// Check if model already exists before creating
export const FeatureFlag = mongoose.models.FeatureFlag || mongoose.model("FeatureFlag", featureFlagSchema);

// Audit Log Schema
const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: [
      "LICENSE_CHANGE",
      "FEATURE_TOGGLE",
      "COMPANY_SUSPENSION",
      "ADMIN_ACTION",
      "USER_MANAGEMENT",
      "INTEGRATION_CHANGE",
      "PRICING_UPDATE",
      "ESCALATION_RULE_UPDATE",
      "NOTIFICATION_TRIGGER_UPDATE"
    ]
  },
  admin_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  admin_name: String,
  target_type: {
    type: String,
    enum: ["ORGANIZATION", "USER", "LICENSE", "SYSTEM"]
  },
  target_id: mongoose.Schema.Types.ObjectId,
  target_name: String,
  details: mongoose.Schema.Types.Mixed,
  ip_address: String,
  user_agent: String,
  status: {
    type: String,
    enum: ["SUCCESS", "FAILED"],
    default: "SUCCESS"
  },
  error_message: String,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Check if model already exists before creating
export const AuditLog = mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);
