import mongoose from "mongoose";

export const ReviewType = {
  REVIEW: "REVIEW",
  RECOGNITION: "RECOGNITION",
  NOTICE: "NOTICE",
};

export const ReviewStatus = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  ACKNOWLEDGED: "ACKNOWLEDGED",
  COMPLETED: "COMPLETED",
  ARCHIVED: "ARCHIVED",
};

const performanceReviewSchema = new mongoose.Schema(
  {
    reviewType: {
      type: String,
      enum: Object.values(ReviewType),
      default: ReviewType.REVIEW,
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    // Reporting / Evaluation Period
    period: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      periodType: {
        type: String,
        enum: ["weekly", "monthly", "quarterly", "annual", "custom"],
        default: "monthly",
      },
    },
    // Documented achievements and context
    positiveAchievements: {
      type: String,
      default: "",
    },
    // Documented missed commitments linked directly to task evidence
    missedCommitments: [
      {
        taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
        taskTitle: { type: String, default: "" },
        dueDate: { type: Date, default: null },
        completedDate: { type: Date, default: null },
        overdueDays: { type: Number, default: 0 },
        reason: { type: String, default: "" },
      },
    ],
    // Workload context, external dependencies, blockers
    workloadAndBlockerContext: {
      type: String,
      default: "",
    },
    // Specific improvement objectives agreed upon
    improvementObjectives: [
      {
        objective: { type: String, required: true },
        targetDate: { type: Date, default: null },
        status: {
          type: String,
          enum: ["pending", "in_progress", "met", "unmet"],
          default: "pending",
        },
      },
    ],
    // Manager summary notes & feedback
    managerComments: {
      type: String,
      default: "",
    },
    // Optional private manager notes (only visible to managers & admins)
    privateManagerNotes: {
      type: String,
      default: "",
    },
    // Recognition details (when reviewType === 'RECOGNITION')
    recognitionDetails: {
      badge: { type: String, default: "Star Performer" },
      category: {
        type: String,
        enum: [
          "Consistent Delivery",
          "On-Time Excellence",
          "Quality & Innovation",
          "Team Collaboration",
          "Leadership",
          "Fast Improvement",
        ],
        default: "On-Time Excellence",
      },
      citation: { type: String, default: "" },
    },
    // Performance notice details (when reviewType === 'NOTICE')
    noticeDetails: {
      severity: {
        type: String,
        enum: ["low", "moderate", "formal"],
        default: "moderate",
      },
      violationType: {
        type: String,
        default: "Repeated Overdue Deliverables",
      },
      correctiveActionPlan: { type: String, default: "" },
    },
    // Employee response and formal acknowledgement
    employeeResponse: {
      response: { type: String, default: "" },
      acknowledged: { type: Boolean, default: false },
      acknowledgedAt: { type: Date, default: null },
    },
    // Scheduled follow-up date for progress review
    followUpDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(ReviewStatus),
      default: ReviewStatus.SUBMITTED,
      index: true,
    },
    // Auditable change history
    auditHistory: [
      {
        action: { type: String, required: true },
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        performedAt: { type: Date, default: Date.now },
        notes: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

export const PerformanceReview =
  mongoose.models.PerformanceReview ||
  mongoose.model("PerformanceReview", performanceReviewSchema);

export default PerformanceReview;
