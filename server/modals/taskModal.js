import mongoose from "mongoose";

const TaskSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      maxlength: [100, 'Task title cannot exceed 100 characters'],
    },
    taskType: {
      type: String,
      enum: ["regular", "recurring", "milestone", "approval"],
      default: "regular",
      required: true,
    },
    mainTaskType: {
      type: String,
      enum: ["regular", "recurring", "milestone", "approval"],
      default: "regular",
    },
    createdByRole: {
      type: [String],
      enum: ["super_admin", "org_admin", "manager", "individual", "employee"],
      default: ["employee"],
      required: true,
    },
    taskTypeAdvanced: {
      type: String,
      enum: ["simple", "complex"],
      default: "simple",
    },
    description: {
      type: String,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    priority: {
      type: String,
      default: "medium",
      lowercase: true,
      trim: true
    },
    category: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      // Dynamic statuses are configured per-organization in TaskStatusConfig
      // and validated at the API layer.
      default: "OPEN",
      trim: true,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    startDate: {
      type: Date,
      default: null,
    },
    visibility: {
      type: String,
      enum: ["Private", "Public", "private", "public", "team"],
      default: "Private",
    },
    tags: [
      {
        type: String,
      },
    ],
    collaborators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    dependencies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
      },
    ],
    attachments: [
      {
        _id: {
          type: mongoose.Schema.Types.ObjectId,
          default: () => new mongoose.Types.ObjectId()
        },
        originalName: {
          type: String,
          required: false
        },
        filename: {
          type: String,
          required: false
        },
        path: {
          type: String,
          required: false
        },
        size: Number,
        mimetype: String,
        url: String,
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        },
        uploadedAt: {
          type: Date,
          default: Date.now
        },
        version: {
          type: Number,
          default: 1
        },
        deleted: {
          type: Boolean,
          default: false
        },
        deletedAt: Date,
        deletedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        },
        // Legacy fields for backward compatibility
        id: String,
        name: String,
        type: String,
      },
    ],
    // External links
    links: [
      {
        _id: {
          type: mongoose.Schema.Types.ObjectId,
          default: () => new mongoose.Types.ObjectId()
        },
        url: {
          type: String,
          required: true
        },
        title: String,
        description: String,
        addedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        },
        createdAt: {
          type: Date,
          default: Date.now
        },
        deleted: {
          type: Boolean,
          default: false
        },
        deletedAt: Date,
        deletedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        }
      }
    ],
    // Deleted attachments for audit trail
    deletedAttachments: [
      {
        _id: mongoose.Schema.Types.ObjectId,
        originalName: String,
        filename: String,
        path: String,
        size: Number,
        mimetype: String,
        url: String,
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        },
        uploadedAt: Date,
        deletedAt: Date,
        deletedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        }
      }
    ],
    customFields: {
      type: Object,
      default: {},
    },
    // Comments and activity
    comments: [{
      _id: {
        type: String, // Changed to String to match your controller implementation
        required: true,
      },
      text: {
        type: String,
        required: true,
      },
      content: {
        type: String, // Added for backward compatibility
      },
      author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      parentId: {
        type: String, // Reference to parent comment _id for replies
        default: null,
      },
      mentions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      }],
      attachments: {
        type: [{
          id: { type: String },
          name: { type: String },
          filename: { type: String },
          size: { type: Number },
          type: { type: String },
          url: { type: String }
        }],
        default: []
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
      updatedAt: {
        type: Date,
        default: Date.now,
      },
      isEdited: {
        type: Boolean,
        default: false,
      },
    }],
    referenceProcess: {
      type: String,
      default: null,
    },
    customForm: {
      type: String,
      default: null,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    is_deleted: { type: Boolean, default: false },
    deleted_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deleted_at: { type: Date, default: null },
    // Recurring task fields
    isRecurring: {
      type: Boolean,
      default: false,
    },
    // ✅ Parent/Instance tracking for recurring tasks (Section 4.3)
    // parentRecurringTaskId: If this task is a recurrence instance, this is the parent template
    parentRecurringTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },
    // instanceNumber: Which occurrence in the sequence is this task (1 = first, 2 = second, etc.)
    instanceNumber: {
      type: Number,
      default: null,
    },
    // occurrenceCount: For parent templates only - total count of instances created so far
    occurrenceCount: {
      type: Number,
      default: 0,
    },
    // isParentRecurring: If true, this is a parent recurring template (not an instance)
    isParentRecurring: {
      type: Boolean,
      default: false,
    },
    // <RecurringTaskIcon size={size} className="flex-shrink-0" /> Contributors for recurring tasks (visibility & notifications, no assignment)
    // Contributors are in addition to the single assignee
    contributors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    recurrencePattern: {
      frequency: {
        type: String,
        enum: ["daily", "weekly", "monthly", "yearly", "custom"],
      },
      patternType: String,
      repeatEvery: Number,
      startTime: String,
      weekdays: [String],
      monthDays: [Number],
      monthlyMode: String,
      specificDate: Number,
      monthPosition: String,
      monthWeekday: String,
      yearMonths: [String],
      yearDay: Number,
      customDates: [Date],
      anchorField: String,
      interval: {
        type: Number,
        default: 1,
      },
      daysOfWeek: [{
        type: Number, // 0 = Sunday, 1 = Monday, etc.
      }],
      dayOfMonth: {
        type: Number,
      },
      // ✅ End condition handling (Section 4.4)
      endCondition: {
        type: String,
        enum: ["never", "after", "by_date"],
        default: "never",
      },
      // occurrences: Number of instances to create (used when endCondition === 'after')
      occurrences: {
        type: Number,
        default: null,
      },
      // endDate: Calendar date boundary (used when endCondition === 'by_date')
      endDate: {
        type: Date,
        default: null,
      },
      maxOccurrences: {
        type: Number,
      },
    },
    nextDueDate: {
      type: Date,
    },
    // Milestone task fields
    isMilestone: {
      type: Boolean,
      default: false,
    },
    milestoneType: {
      type: String,
      enum: ["standalone", "linked", "project"],
      default: "standalone",
    },
    milestoneData: {
      linkedTaskIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
      }],
      completionCriteria: [String],
      deliverables: [String],
      stakeholders: [String],
    },
    linkedTasks: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
    }],
    // Bidirectional mapping: Reference to milestone if this task is linked to one
    linkedToMilestone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },
    // Approval task fields
    isApprovalTask: {
      type: Boolean,
      default: false,
    },
    approvalMode: {
      type: String,
      enum: ["any", "all", "sequential"],
      default: "any",
    },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "auto_approved"],
      default: "pending",
    },
    approvers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    approverOrder: [{
      approverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      order: {
        type: Number,
      },
      status: {
        type: String,
        enum: ["pending", "approved", "rejected", "awaiting_turn", "skipped"],
        default: "awaiting_turn",
      },
      decidedAt: {
        type: Date,
      },
    }],
    currentApproverIndex: {
      type: Number,
      default: 0,
    },
    approvalDecisions: [{
      approverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      decision: {
        type: String,
        enum: ["approve", "reject", "auto_approve"],
      },
      comment: String,
      decidedAt: {
        type: Date,
        default: Date.now,
      },
      isAutoApproval: {
        type: Boolean,
        default: false,
      },
    }],
    autoApproveEnabled: {
      type: Boolean,
      default: false,
    },
    autoApproveAfter: {
      type: Date,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
    },

    // Snooze Task Fields
    isSnooze: {
      type: Boolean,
      default: false,
    },
    snoozeUntil: {
      type: Date,
      default: null,
    },
    snoozeReason: {
      type: String,
      default: null,
    },
    snoozedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    snoozedAt: {
      type: Date,
      default: null,
    },

    // Risk Task Fields
    isRisk: {
      type: Boolean,
      default: false,
    },
    riskLevel: {
      type: String,
      enum: ["low", "medium", "high"],
      default: null,
    },
    riskReason: {
      type: String,
      default: null,
    },
    riskMarkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    riskMarkedAt: {
      type: Date,
      default: null,
    },

    // Mitigation Fields
    mitigationReason: {
      type: String,
      default: null,
    },
    mitigatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    mitigatedAt: {
      type: Date,
      default: null,
    },

    // Task Completion Fields
    completedDate: {
      type: Date,
      default: null,
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    completionNotes: {
      type: String,
      default: null,
    },

    // Task Cancellation Fields
    cancelNotes: {
      type: String,
      default: null,
    },

    // Form Attachment Fields (Phase I - Form-Subtask Linkage)
    attached_form_version_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FormVersion",
      default: null,
      description: "Locked version of form attached to this subtask (Phase I - Version Locking)"
    },
    form_submission_status: {
      type: String,
      enum: ["NOT_STARTED", "IN_PROGRESS", "SUBMITTED"],
      default: "NOT_STARTED",
      description: "Status of form submission for this subtask"
    },
    form_submitted_at: {
      type: Date,
      default: null,
      description: "When the form was submitted"
    },
    form_submitted_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      description: "User who submitted the form"
    },

    // Email to Task Fields
    source: {
      type: String,
      enum: ["manual", "email", "api", "quick-task", "form"],
      default: "manual",
      description: "Source of task creation"
    },
    sourceEmail: {
      type: String,
      default: null,
      description: "Email address from which task was created (if source is email)"
    },
    sourceSubject: {
      type: String,
      default: null,
      description: "Original email subject (if source is email)"
    },
  },
  { timestamps: true }
);

// Soft delete method
TaskSchema.statics.softDeleteTask = async function (taskId, userId) {
  return this.findByIdAndUpdate(taskId, {
    is_deleted: true,
    deleted_by: userId,
    deleted_at: new Date(),
  });
};

// Hard delete method
TaskSchema.statics.hardDeleteTask = async function (taskId) {
  return this.findByIdAndDelete(taskId);
};

// Recover method
TaskSchema.statics.recoverTask = async function (taskId) {
  return this.findByIdAndUpdate(taskId, {
    is_deleted: false,
    deleted_by: null,
    deleted_at: null,
  });
};
export default mongoose.models.Task || mongoose.model("Task", TaskSchema);
