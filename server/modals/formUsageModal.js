import mongoose from "mongoose";

/**
 * Form Usage Schema
 * Tracks when forms are attached to tasks/subtasks/processes
 * Provides audit trail for form attachments and unlinking
 * Spec: Module 5 - Custom Forms - Attachment & Task integration
 */

const formUsageSchema = new mongoose.Schema(
  {
    usage_id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true,
    },
    // Reference to the form template
form_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "FormVersion"
    },
    // What type of entity is this form attached to
    attached_to_type: {
      type: String,
      enum: ["TASK", "SUBTASK", "PROCESS", "MILESTONE"],
      required: true
    },
    // The ID of the entity (task/subtask/process/milestone)
    attached_to_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    // Additional reference fields for easier querying
    task_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null
    },
    subtask_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task", // Subtasks are in Task collection
      default: null
    },
    // Who attached this form
    attached_by: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User"
    },
    // Reference to the specific version that was attached
    form_version_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "FormVersion"
    },
    // When was it attached
    attached_at: {
      type: Date,
      default: Date.now
    },
    // Unlink information
    unlinked_at: {
      type: Date,
      default: null,
    },
    unlinked_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Reason for unlinking (optional)
    unlink_reason: {
      type: String,
      default: null,
    },
    // Force unlink flag (used when admin overrides restriction)
    force_unlinked: {
      type: Boolean,
      default: false,
    },
    // Status of this attachment
    status: {
      type: String,
      enum: ["ACTIVE", "UNLINKED", "ARCHIVED"],
      default: "ACTIVE"
    },
    // Configuration for this specific usage
    config: {
      // Should form submission trigger task completion?
      auto_complete_task: {
        type: Boolean,
        default: false,
      },
      // Should form submission change task status?
      auto_change_status: {
        type: String,
        enum: ["", "TODO", "IN_PROGRESS", "COMPLETED", "ON_HOLD"],
        default: "",
      },
      // Should notifications be sent on submission?
      notify_on_submit: {
        type: Boolean,
        default: true,
      },
      // Who should be notified
      notify_users: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      // Is this form required for task completion?
      required_for_completion: {
        type: Boolean,
        default: false,
      },
    },
    // Submission tracking
    submission_count: {
      type: Number,
      default: 0,
    },
    last_submission_at: {
      type: Date,
      default: null,
    },
    last_submission_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Metadata
    metadata: {
      form_title: String, // Snapshot of form title at attach time
      form_version_number: Number, // Snapshot of version number
      attached_from: String, // UI source: 'task_edit', 'subtask_modal', etc.
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
formUsageSchema.index({ form_id: 1 });
formUsageSchema.index({ attached_to_type: 1, attached_to_id: 1 });
formUsageSchema.index({ task_id: 1 });
formUsageSchema.index({ subtask_id: 1 });
formUsageSchema.index({ attached_by: 1, attached_at: -1 });

// Compound indexes for common queries
formUsageSchema.index({ form_id: 1, attached_at: -1 });

// Unique constraint: One active form per task/subtask
// (prevents multiple active forms on same entity)
formUsageSchema.index(
  { attached_to_type: 1, attached_to_id: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "ACTIVE" },
  }
);

// Virtual for easy access to usage ID
formUsageSchema.virtual("id").get(function () {
  return this.usage_id || this._id;
});

// Method to check if usage is active
formUsageSchema.methods.isActive = function () {
  return this.status === "ACTIVE" && this.unlinked_at === null;
};

// Method to check if can be unlinked
formUsageSchema.methods.canUnlink = function () {
  // Can unlink if no submissions or if forced
  return this.submission_count === 0 || this.force_unlinked;
};

// Method to unlink
formUsageSchema.methods.unlink = async function (userId, reason = null, force = false) {
  this.unlinked_at = new Date();
  this.unlinked_by = userId;
  this.unlink_reason = reason;
  this.force_unlinked = force;
  this.status = "UNLINKED";
  return await this.save();
};

// Method to increment submission count
formUsageSchema.methods.recordSubmission = async function (userId) {
  this.submission_count += 1;
  this.last_submission_at = new Date();
  this.last_submission_by = userId;
  return await this.save();
};

// Static method to get active usage for a task/subtask
formUsageSchema.statics.getActiveUsage = async function (
  attachedToType,
  attachedToId
) {
  return await this.findOne({
    attached_to_type: attachedToType,
    attached_to_id: attachedToId,
    status: "ACTIVE",
  })
    .populate("form_id")
    .populate("form_version_id")
    .populate("attached_by", "firstName lastName email");
};

// Static method to check if form has active usage
formUsageSchema.statics.hasActiveUsage = async function (formId) {
  const count = await this.countDocuments({
    form_id: formId,
    status: "ACTIVE",
  });
  return count > 0;
};

// Static method to get all active usages for a form (for dependency check)
formUsageSchema.statics.getActiveUsagesForForm = async function (formId) {
  return await this.find({
    form_id: formId,
    status: "ACTIVE",
  })
    .populate("task_id", "title task_code")
    .populate("subtask_id", "title")
    .populate("attached_by", "firstName lastName email")
    .sort({ attached_at: -1 });
};

export const FormUsage = mongoose.model("FormUsage", formUsageSchema);
