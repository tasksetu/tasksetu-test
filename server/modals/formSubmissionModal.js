import mongoose from "mongoose";

/**
 * Form Submission Schema
 * Stores all form responses submitted by users (internal or external)
 * Spec: Module 5 - Custom Forms - Submission handling
 */

const formSubmissionSchema = new mongoose.Schema(
  {
    submission_id: {
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
    // Reference to the specific version that was submitted
    form_version_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "FormVersion",
      index: true,
    },
    // User who submitted (null for anonymous/external submissions)
    submitted_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    // The actual form response data (JSON object with field_id -> value mapping)
    submission_data_json: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    // Source of submission
    source: {
      type: String,
      enum: ["TASK", "SUBTASK", "EXTERNAL", "DIRECT"],
      default: "DIRECT",
      index: true,
    },
    // If submitted from a task context
    source_task_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
      index: true,
    },
    // If submitted from a subtask context
    source_subtask_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task", // Subtasks are in Task collection
      default: null,
      index: true,
    },
    // For external submissions via tokenized URL
    external_token: {
      type: String,
      default: null,
      index: true,
    },
    // IP address of submitter (for audit and spam prevention)
    source_ip: {
      type: String,
      default: null,
    },
    // Submission timestamp
    submitted_at: {
      type: Date,
      default: Date.now,
      index: true,
    },
    // Status of submission (for approval workflows)
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "COMPLETED"],
      default: "COMPLETED",
      index: true,
    },
    // File attachments uploaded with this submission
    attachments: [
      {
        file_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "FileStore",
        },
        field_id: String, // Which form field this file belongs to
        filename: String,
        file_path: String,
        file_size: Number,
        mime_type: String,
        uploaded_at: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Additional metadata
    metadata: {
      user_agent: String,
      browser: String,
      device: String,
      location: {
        latitude: Number,
        longitude: Number,
      },
      submission_duration_seconds: Number, // How long user took to fill form
    },
    // Review information (if approval workflow)
    reviewed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewed_at: {
      type: Date,
      default: null,
    },
    review_notes: {
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
formSubmissionSchema.index({ form_id: 1, submitted_at: -1 });
formSubmissionSchema.index({ form_id: 1, status: 1 });
formSubmissionSchema.index({ submitted_by: 1, submitted_at: -1 });

// Compound indexes for common queries
formSubmissionSchema.index({ form_id: 1, source: 1, submitted_at: -1 });
formSubmissionSchema.index({ form_id: 1, submitted_by: 1, submitted_at: -1 });

// Virtual for easy access to submission ID
formSubmissionSchema.virtual("id").get(function () {
  return this.submission_id || this._id;
});

// Method to check if submission is from external source
formSubmissionSchema.methods.isExternal = function () {
  return this.source === "EXTERNAL" && this.external_token !== null;
};

// Method to check if submission is anonymous
formSubmissionSchema.methods.isAnonymous = function () {
  return this.submitted_by === null;
};

// Static method to get submissions count for a form
formSubmissionSchema.statics.getSubmissionCount = async function (formId) {
  return await this.countDocuments({ form_id: formId });
};

// Static method to get latest submission for a form
formSubmissionSchema.statics.getLatestSubmission = async function (formId) {
  return await this.findOne({ form_id: formId })
    .sort({ submitted_at: -1 })
    .limit(1);
};

export const FormSubmission = mongoose.model(
  "FormSubmission",
  formSubmissionSchema
);
