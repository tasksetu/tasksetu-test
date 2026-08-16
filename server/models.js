import mongoose from "mongoose";

// Project Schema
const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "archived", "completed"],
      default: "active",
    },
    color: {
      type: String,
      default: "#3B82F6",
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    settings: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

// Task Status Schema
const taskStatusSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    color: {
      type: String,
      default: "#6B7280",
    },
    order: {
      type: Number,
      default: 0,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Task Schema
const taskSchema = new mongoose.Schema(
  {
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: false,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      // Dynamic statuses are configured per-organization in TaskStatusConfig
      // and validated at the API layer.
      default: "OPEN",
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    priority: {
      type: String,
      default: "medium",
      lowercase: true,
      trim: true,
    },
    dueDate: Date,
    completedAt: Date,
    timeEstimate: {
      type: Number, // In hours
      default: 0,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    metadata: {
      type: Object,
      default: {},
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurringConfig: {
      type: Object,
      default: null,
    },
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
      daysOfWeek: [
        {
          type: Number, // 0 = Sunday, 1 = Monday, etc.
        },
      ],
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
    occurrenceCount: {
      type: Number,
      default: 0,
      // Tracks how many times this recurring task has occurred
    },
    nextDueDate: {
      type: Date,
      default: null,
    },
    parentTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
    },
    order: {
      type: Number,
      default: 0,
    },
    estimatedHours: Number,
    actualHours: Number,
    // Advanced task fields for comprehensive task management
    // Workflow Engine: taskType drives which configuration panels are shown
    // and which services handle status transitions.
    // Values: "regular" | "email" | "approval" | "milestone" | "recurring" | "subtask"
    taskType: {
      type: String,
      enum: ["regular", "recurring", "milestone", "approval", "subtask", "email"],
      default: "regular",
    },
    mainTaskType: {
      type: String,
      enum: ["regular", "recurring", "milestone", "approval", "subtask", "email"],
      default: "regular",
    }, // The top-level task type classification
    // Subtask specific fields
    parentTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: false,
    },
    isSubtask: {
      type: Boolean,
      default: false,
    },
    // Form attachment fields (Custom Forms Module integration)
    attached_form_version_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FormVersion",
      default: null,
    },
    form_submission_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FormSubmission",
      default: null,
    },
    form_submission_status: {
      type: String,
      enum: ["NOT_STARTED", "IN_PROGRESS", "SUBMITTED", "APPROVED", "REJECTED"],
      default: "NOT_STARTED",
    },
    form_required_for_completion: {
      type: Boolean,
      default: false,
    },
    createdByRole: {
      type: [String],
      enum: ["super_admin", "org_admin", "manager", "individual", "employee"],
      default: ["employee"],
      required: true,
    },
    taskTypeAdvanced: {
      type: String,
      enum: ["simple", "complex", "recurring", "milestone", "approval"],
      default: "simple",
    }, // Task complexity classification
    category: { type: String, default: "" },
    visibility: {
      type: String,
      enum: ["private", "public", "team", "organization", "Private", "Public"],
      default: "Private",
    },
    collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    // <RecurringTaskIcon size={size} className="flex-shrink-0" /> Contributors for recurring tasks (visibility & notifications, no assignment)
    // Contributors are in addition to the single assignee
    contributors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    dependencies: [{ type: String }], // Store as strings for now, can be converted to ObjectIds later when tasks exist
    attachments: [
      {
        _id: {
          type: mongoose.Schema.Types.ObjectId,
          default: () => new mongoose.Types.ObjectId(),
        },
        originalName: { type: String, required: true },
        filename: { type: String, required: true },
        path: { type: String, required: true },
        size: { type: Number, required: true },
        mimetype: { type: String },
        url: { type: String, required: true },
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
        version: { type: Number, default: 1 },
        deleted: {
          type: Boolean,
          default: false,
        },
        deletedAt: Date,
        deletedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    // External links
    links: [
      {
        _id: {
          type: mongoose.Schema.Types.ObjectId,
          default: () => new mongoose.Types.ObjectId(),
        },
        url: {
          type: String,
          required: true,
        },
        title: String,
        description: String,
        addedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        deleted: {
          type: Boolean,
          default: false,
        },
        deletedAt: Date,
        deletedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
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
          ref: "User",
        },
        uploadedAt: Date,
        deleted: Boolean,
        deletedAt: Date,
        deletedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],

    customFields: { type: Map, of: mongoose.Schema.Types.Mixed },

    // Comments array for subtasks and tasks
    comments: [
      {
        _id: { type: String, required: true },
        text: { type: String, required: true },
        content: { type: String }, // Added for backward compatibility
        author: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        parentId: { type: String, default: null }, // Added parentId field for reply nesting
        mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        attachments: [
          {
            filename: String,
            url: String,
            size: Number,
            mimeType: String,
          },
        ],
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
        isEdited: { type: Boolean, default: false },
      },
    ],

    // Advanced options fields - always available regardless of task type
    referenceProcess: { type: String, default: null }, // Links to existing process/workflow
    customForm: { type: String, default: null }, // Links to predefined form for data collection

    // Milestone fields
    isMilestone: { type: Boolean, default: false },
    milestoneType: {
      type: String,
      enum: ["standalone", "linked", "project"],
      default: "standalone",
    },
    milestoneData: {
      type: { type: String },
      linkedTaskIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Task" }],
      completionCriteria: [{ type: String }],
      deliverables: [{ type: String }],
      stakeholders: [{ type: String }],
    },
    linkedTasks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Task" }],
    // Bidirectional mapping: Reference to milestone if this task is linked to one
    linkedToMilestone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },

    // Approval task fields
    isApprovalTask: { type: Boolean, default: false },
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
    approvers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    approverOrder: [
      {
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
      },
    ],
    currentApproverIndex: {
      type: Number,
      default: 0,
    },
    approvalDecisions: [
      {
        approverId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        decision: { type: String, enum: ["approve", "reject", "auto_approve"] },
        comment: { type: String },
        decidedAt: { type: Date, default: Date.now },
        isAutoApproval: { type: Boolean, default: false },
      },
    ],
    autoApproveEnabled: { type: Boolean, default: false },
    autoApproveAfter: { type: Date }, // Date when auto-approval should trigger

    // Snooze Task Fields
    isSnooze: { type: Boolean, default: false },
    snoozeUntil: { type: Date, default: null },
    snoozeReason: { type: String, default: null },
    snoozedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    snoozedAt: { type: Date, default: null },

    // Risk Task Fields
    isRisk: { type: Boolean, default: false },
    riskLevel: { type: String, enum: ["low", "medium", "high"], default: null },
    riskReason: { type: String, default: null },
    riskMarkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    riskMarkedAt: { type: Date, default: null },

    // Mitigation Fields
    mitigationReason: { type: String, default: null },
    mitigatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    mitigatedAt: { type: Date, default: null },

    // Task Completion Fields
    completedDate: { type: Date, default: null },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    completionNotes: { type: String, default: null },

    // Google Calendar Integration
    googleCalendarEventId: { type: String, default: null },

    // ─── Workflow Engine Fields (Phase 2) ────────────────────────────────────

    // The type of business process this parent task represents.
    // Used as metadata only — the engine is fully generic.
    // Example: "vendor_onboarding", "employee_onboarding", "procurement" etc.
    workflowType: {
      type: String,
      enum: [
        "vendor_onboarding",
        "employee_onboarding",
        "client_onboarding",
        "procurement",
        "purchase_approval",
        "leave_approval",
        "asset_allocation",
        "it_request",
        "legal_review",
        "custom",
      ],
      default: null,
    },

    // Sequence/order of this task within its parent process.
    // Used by the Linked Task Engine to determine eligibility.
    sequence: {
      type: Number,
      default: 0,
    },

    // Single dependency link: this task cannot move to IN_PROGRESS
    // until the linkedTaskId task is Completed.
    // Separate from linkedTasks (which is the milestone array).
    linkedTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },

    // For Approval Tasks: the task that should be re-initiated
    // when the approver chooses "Reject & Re-initiate".
    contextTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },

    // Timestamp when this task transitioned to IN_PROGRESS.
    // Used for Auto-Complete and Auto-Initiate scheduling.
    startedAt: {
      type: Date,
      default: null,
    },

    // Per-task workflow configuration object.
    // Stored as a structured sub-document (not free-form Object)
    // to allow indexed queries by the scheduler.
    configuration: {
      // Auto-Initiate: automatically move to IN_PROGRESS when linkedTask completes.
      // Only valid when linkedTaskId is set.
      autoInitiate: {
        type: Boolean,
        default: false,
      },

      // Auto-Complete: automatically mark Completed after N days of being IN_PROGRESS.
      autoComplete: {
        type: Boolean,
        default: false,
      },
      autoCompleteAfterDays: {
        type: Number,
        default: null,
      },

      // Parent Cancellation Mode (set on parent/workflow tasks).
      // cancel_on_rejection: Cancel parent if any subtask is Rejected/Cancelled.
      // ignore_rejection: Default — parent continues regardless.
      parentCancellationMode: {
        type: String,
        enum: ["cancel_on_rejection", "ignore_rejection"],
        default: "ignore_rejection",
      },
    },

    // ─── Email Task Configuration ─────────────────────────────────────────────
    // Only populated when taskType === "email".
    // Stored on the task itself so the WorkflowEngine can render/send without
    // joining another collection.
    emailConfig: {
      // Email recipients — supports manual entry and form-field mapping.
      recipients: [
        {
          name: { type: String },
          email: { type: String },
          // source: manual = typed in, form = mapped from form field,
          //         previous_form = mapped from a previous task's form response,
          //         form_submission = imported from form response submissions
          source: {
            type: String,
            enum: ["manual", "form", "previous_form", "form_submission"],
            default: "manual",
          },
          // Per-recipient custom variable key-value pairs (Case I & Case II)
          variables: {
            type: Map,
            of: String,
            default: {},
          },
          // For source=form: which form and field to pull the email from
          formId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Form",
            default: null,
            set: (v) => (v === "" ? null : v),
          },
          fieldId: { type: String, default: null },
          // For source=previous_form: which sibling task's form response
          previousTaskId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Task",
            default: null,
            set: (v) => (v === "" ? null : v),
          },
        },
      ],

      // Email subject (can be the task name or a custom value)
      subject: { type: String, default: null },

      // HTML email body template.
      // Supports dynamic variables: {variableKey}
      body: { type: String, default: null },

      // Variable definitions for template substitution.
      // Maximum 10 variables per spec.
      variables: [
        {
          key: { type: String },           // Template key, e.g. "VendorName"
          label: { type: String },          // Display label
          // Where to source the variable value from:
          // "current_form" = current task's form, "form_library" = a specific form
          mappedFrom: {
            type: String,
            enum: ["current_form", "form_library", "previous_form", "static"],
            default: "static",
          },
          formId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Form",
            default: null,
            set: (v) => (v === "" ? null : v),
          },
          fieldId: { type: String, default: null },
          staticValue: { type: String, default: null }, // for mappedFrom=static
        },
      ],

      // If set, a secure public URL will be generated and appended to the email.
      // Recipients can submit this form without a Tasksetu account.
      attachedFormId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Form",
        default: null,
        set: (v) => (v === "" ? null : v),
      },
      formLinkEnabled: { type: Boolean, default: false },

      // Auto-Complete this email task after N days (overrides task-level config).
      autoComplete: { type: Boolean, default: false },
      autoCompleteAfterDays: { type: Number, default: null },

      // Tracks how many times the email has been sent/re-sent
      sendCount: { type: Number, default: 0 },
      lastSentAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  },
);

// Task Comment Schema
const taskCommentSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    attachments: [
      {
        filename: String,
        url: String,
        size: Number,
        mimeType: String,
      },
    ],
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: Date,
  },
  {
    timestamps: true,
  },
);

const activitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    relatedType: {
      type: String, // e.g., 'task', 'project', 'user'
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);
// Task Assignment Schema
const taskAssignmentSchema = new mongoose.Schema({
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Task",
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  assignedAt: {
    type: Date,
    default: Date.now,
  },
});

// Task Audit Log Schema
const taskAuditLogSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    oldValues: Object,
    newValues: Object,
    metadata: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

// Usage Tracking Schema
const usageTrackingSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    month: {
      type: String,
      required: true,
    },
    activeUsers: {
      type: Number,
      default: 0,
    },
    tasksCreated: {
      type: Number,
      default: 0,
    },
    tasksCompleted: {
      type: Number,
      default: 0,
    },
    commentsPosted: {
      type: Number,
      default: 0,
    },
    storageUsed: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// ─── Task Indexes ──────────────────────────────────────────────────────────
taskSchema.index({ organization: 1 });
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ createdBy: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ linkedTaskId: 1 });                          // Linked Task Engine
taskSchema.index({ "configuration.autoInitiate": 1 });          // Auto Initiate scheduler
taskSchema.index({ "configuration.autoComplete": 1, status: 1 }); // Auto Complete scheduler
taskSchema.index({ workflowType: 1, organization: 1 });          // Workflow type filtering
taskSchema.index({ sequence: 1, parentTask: 1 });               // Sequence ordering
taskCommentSchema.index({ task: 1 });
usageTrackingSchema.index({ organization: 1, month: 1 }, { unique: true });

// ─── TaskVisibility Schema ─────────────────────────────────────────────────
// Stores which users can view a task beyond the assignee/collaborators.
// Visible users get read-only access: view, comment, view attachments, view form data.
const taskVisibilitySchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    // Granular read-only permissions
    canView: { type: Boolean, default: true },
    canComment: { type: Boolean, default: true },
    canViewAttachments: { type: Boolean, default: true },
    canViewFormData: { type: Boolean, default: true },
    // Cannot edit, complete, or reassign — enforced at API layer
  },
  { timestamps: true },
);
taskVisibilitySchema.index({ task: 1, user: 1 }, { unique: true });
taskVisibilitySchema.index({ user: 1, organization: 1 });

// ─── ApprovalHistory Schema ────────────────────────────────────────────────
// Immutable audit trail of every approval decision across all cycles.
// Never overwritten — new records are appended per decision.
const approvalHistorySchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    // Cycle number: increments each time the approval is re-initiated
    cycle: {
      type: Number,
      required: true,
      default: 1,
    },
    approver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["approved", "rejected", "auto_approved", "pending"],
      required: true,
    },
    reason: { type: String, default: null },
    // Action taken on rejection
    rejectionAction: {
      type: String,
      enum: ["terminate", "reinitiate", null],
      default: null,
    },
    isAutoApproval: { type: Boolean, default: false },
    decidedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
approvalHistorySchema.index({ task: 1, cycle: 1 });
approvalHistorySchema.index({ task: 1, approver: 1 });
approvalHistorySchema.index({ organization: 1 });

// ─── EmailRecipientTracking Schema ────────────────────────────────────────
// Per-recipient status tracking for Email Tasks.
// One document per recipient per email task.
const emailRecipientTrackingSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: false,
      default: null,
    },
    name: { type: String, default: null },
    email: { type: String, required: true, lowercase: true, trim: true },
    // Current status of this recipient
    status: {
      type: String,
      enum: ["pending", "sent", "delivered", "opened", "submitted", "failed"],
      default: "pending",
    },
    // Which send cycle this tracking record belongs to (1 = first send, 2 = re-send, etc.)
    sendCycle: { type: Number, default: 1 },
    sentAt: { type: Date, default: null },
    openedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    failureReason: { type: String, default: null },
    // The secure form token generated for this recipient
    formToken: { type: String, default: null },
    // Reference to the form submission if the recipient submitted the form
    formSubmissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FormSubmission",
      default: null,
    },
  },
  { timestamps: true },
);
emailRecipientTrackingSchema.index({ task: 1, email: 1 });
emailRecipientTrackingSchema.index({ task: 1, status: 1 });
emailRecipientTrackingSchema.index({ formToken: 1 }, { sparse: true });

// ─── WorkflowFormToken Schema ──────────────────────────────────────────────
// Secure, time-limited tokens for public form URLs.
// Allows external recipients to submit forms without a Tasksetu account.
// URL format: /public/forms/{token}
const workflowFormTokenSchema = new mongoose.Schema(
  {
    // Cryptographically secure random token (UUID v4)
    token: {
      type: String,
      required: true,
      unique: true,
    },
    // The Email Task this token belongs to
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: false,
      default: null,
    },
    // The Form to render for this token
    form: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Form",
      required: true,
    },
    // The specific recipient this token was generated for
    recipientEmail: { type: String, lowercase: true, trim: true },
    recipientName: { type: String, default: null },
    // Reference to the EmailRecipientTracking record
    recipientTrackingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EmailRecipientTracking",
      default: null,
    },
    // Expiry: null = no expiry, otherwise the token is rejected after this date
    expiresAt: { type: Date, default: null },
    // Has this token already been used to submit?
    isUsed: { type: Boolean, default: false },
    usedAt: { type: Date, default: null },
    // Configurable: allow multiple submissions or only one
    allowMultipleSubmissions: { type: Boolean, default: false },
    submissionCount: { type: Number, default: 0 },
    // Reference to the form submission created by this token
    formSubmissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FormSubmission",
      default: null,
    },
  },
  { timestamps: true },
);
workflowFormTokenSchema.index({ task: 1 });
workflowFormTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

// Export models
// Form Category Schema (for organizing form templates)
const formCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,
    color: {
      type: String,
      default: "#3B82F6", // Default blue
    },
    icon: String,
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Index for faster category lookups
formCategorySchema.index({ organization: 1, isActive: 1 });
formCategorySchema.index({ organization: 1, name: 1 }, { unique: true });

// Form Tag Schema (for flexible categorization and search)
const formTagSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    color: {
      type: String,
      default: "#6B7280", // Default gray
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    usageCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Index for tag lookups and autocomplete
formTagSchema.index({ organization: 1, name: 1 }, { unique: true });
formTagSchema.index({ organization: 1, usageCount: -1 });

// Form Schema (enhanced with tags and categories)
const formSchema = new mongoose.Schema(
  {
    form_code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      alias: "owner_user_id",
    },
    // ✅ Category (single selection for primary organization)
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FormCategory",
      default: null,
    },
    // ✅ Tags (multi-select for flexible search and filtering)
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "FormTag",
      },
    ],
    // Legacy string tags support (migrate to references)
    tagNames: [String],
    fields: [
      {
        id: {
          type: String,
          required: true,
        },
        type: {
          type: String,
          required: true,
          enum: [
            "text",
            "textarea",
            "number",
            "email",
            "phone",
            "url",
            "date",
            "datetime",
            "dropdown",
            "multiselect",
            "radio",
            "checkbox",
            "file",
            "signature",
            "rating",
            "toggle",
            "richtext",
            "lookup",
            "location",
            "title",
            "label",
          ],
        },
        label: {
          type: String,
          required: true,
        },
        placeholder: String,
        helpText: String,
        required: {
          type: Boolean,
          default: false,
        },
        readOnly: {
          type: Boolean,
          default: false,
        },
        defaultValue: mongoose.Schema.Types.Mixed,
        options: [String], // For dropdown, multiselect, radio, checkbox
        validation: {
          min: Number,
          max: Number,
          minLength: Number,
          maxLength: Number,
          pattern: String,
          customMessage: String,
        },
        conditionalLogic: {
          show: mongoose.Schema.Types.Mixed, // Condition tree
          enable: mongoose.Schema.Types.Mixed,
        },
        order: {
          type: Number,
          default: 0,
        },
        cssClass: String,
        columnSpan: {
          type: Number,
          default: 1,
          min: 1,
          max: 3,
        },
      },
    ],
    // Form status (as per spec 5.8)
    status: {
      type: String,
      enum: ["DRAFT", "PUBLISHED", "ARCHIVED", "DEPRECATED"],
      default: "DRAFT",
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    current_version_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FormVersion",
    },
    // Visibility & Scope
    visibility: {
      type: String,
      enum: ["PUBLIC", "PRIVATE", "ORG"],
      default: "ORG",
    },
    scope: {
      type: String,
      enum: ["INTERNAL", "EXTERNAL"],
      default: "INTERNAL",
    },
    // Publishing dates
    start_at: Date,
    end_at: Date,
    accessLink: {
      type: String,
      unique: true,
      sparse: true,
    },
    externalSubmissionEnabled: {
      type: Boolean,
      default: false,
    },
    settings: {
      allowAnonymous: {
        type: Boolean,
        default: true,
      },
      maxSubmissions: Number,
      submitMessage: {
        type: String,
        default: "Thank you for your submission!",
      },
      redirectUrl: String,
      requireCaptcha: {
        type: Boolean,
        default: false,
      },
      notifyOnSubmission: {
        type: Boolean,
        default: true,
      },
    },
    // Usage tracking
    usageCount: {
      type: Number,
      default: 0,
    },
    lastUsedAt: Date,
    submissionCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for form search and filtering
formSchema.index({ organization: 1, status: 1 });
formSchema.index({ organization: 1, category: 1 });
formSchema.index({ organization: 1, tags: 1 });
formSchema.index({ title: "text", description: "text" });
formSchema.index({ organization: 1, createdBy: 1 });

// Pre-save hook to auto-generate form_code
formSchema.pre("save", async function (next) {
  if (!this.form_code) {
    const count = await mongoose
      .model("Form")
      .countDocuments({ organization: this.organization });
    this.form_code = `FORM-${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

// Process Flow Schema
const processFlowSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    form: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Form",
      required: true,
    },
    steps: [
      {
        id: {
          type: String,
          required: true,
        },
        title: {
          type: String,
          required: true,
        },
        description: String,
        type: {
          type: String,
          required: true,
          enum: ["task", "approval", "notification", "conditional"],
        },
        assignedTo: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
        ],
        dueInDays: Number,
        conditions: [
          {
            field: String,
            operator: {
              type: String,
              enum: [
                "equals",
                "not_equals",
                "contains",
                "greater_than",
                "less_than",
              ],
            },
            value: String,
          },
        ],
        nextSteps: [String], // Array of step IDs
        order: {
          type: Number,
          default: 0,
        },
      },
    ],
    flowType: {
      type: String,
      required: true,
      enum: ["sequential", "parallel", "conditional"],
      default: "sequential",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Form Response Schema
const formResponseSchema = new mongoose.Schema(
  {
    form: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Form",
      required: true,
    },
    processFlow: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProcessFlow",
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    submitterEmail: String, // For anonymous submissions
    responses: [
      {
        fieldId: {
          type: String,
          required: true,
        },
        fieldLabel: String,
        value: mongoose.Schema.Types.Mixed,
      },
    ],
    status: {
      type: String,
      enum: ["submitted", "in_progress", "completed", "rejected"],
      default: "submitted",
    },
    currentStep: String, // Current step ID in process flow
    stepHistory: [
      {
        stepId: String,
        stepTitle: String,
        status: {
          type: String,
          enum: ["pending", "completed", "rejected", "skipped"],
        },
        assignedTo: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        completedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        comments: String,
        completedAt: Date,
      },
    ],
    metadata: {
      ipAddress: String,
      userAgent: String,
      referrer: String,
    },
  },
  {
    timestamps: true,
  },
);

// Process Instance Schema (for tracking workflow execution)
const processInstanceSchema = new mongoose.Schema(
  {
    processFlow: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProcessFlow",
      required: true,
    },
    formResponse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FormResponse",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "completed", "terminated", "paused"],
      default: "active",
    },
    currentSteps: [String], // Current active step IDs
    completedSteps: [String], // Completed step IDs
    variables: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

export const Project = mongoose.model("Project", projectSchema);
export const TaskStatus = mongoose.model("TaskStatus", taskStatusSchema);
export const Task = mongoose.model("Task", taskSchema);
export const Activity = mongoose.model("Activity", activitySchema);
export const TaskComment = mongoose.model("TaskComment", taskCommentSchema);
export const TaskAssignment = mongoose.model(
  "TaskAssignment",
  taskAssignmentSchema,
);
export const TaskAuditLog = mongoose.model("TaskAuditLog", taskAuditLogSchema);
export const UsageTracking = mongoose.model(
  "UsageTracking",
  usageTrackingSchema,
);
export const FormCategory = mongoose.model("FormCategory", formCategorySchema);
export const FormTag = mongoose.model("FormTag", formTagSchema);
export const Form = mongoose.model("Form", formSchema);
export const ProcessFlow = mongoose.model("ProcessFlow", processFlowSchema);
export const FormResponse = mongoose.model("FormResponse", formResponseSchema);
export const ProcessInstance = mongoose.model(
  "ProcessInstance",
  processInstanceSchema,
);

// ─── Workflow Engine Models (Phase 2) ─────────────────────────────────────
export const TaskVisibility = mongoose.model(
  "TaskVisibility",
  taskVisibilitySchema,
);
export const ApprovalHistory = mongoose.model(
  "ApprovalHistory",
  approvalHistorySchema,
);
export const EmailRecipientTracking = mongoose.model(
  "EmailRecipientTracking",
  emailRecipientTrackingSchema,
);
export const WorkflowFormToken = mongoose.model(
  "WorkflowFormToken",
  workflowFormTokenSchema,
);

// Organization Hierarchy Schema
const organizationHierarchySchema = new mongoose.Schema(
  {
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reporty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organization_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

export const OrganizationHierarchy = mongoose.model(
  "OrganizationHierarchy",
  organizationHierarchySchema,
);
