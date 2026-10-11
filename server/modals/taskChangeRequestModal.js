import mongoose from "mongoose";

export const ChangeRequestStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
  CONFLICT: "CONFLICT",
};

export const ActionSource = {
  EMAIL: "EMAIL",
  IN_APP: "IN_APP",
};

/**
 * Task Change Request Schema
 * Stores requested changes to protected fields (dueDate, status, priority, assignedTo)
 * until approved or rejected by the task creator / authorized manager.
 */
const taskChangeRequestSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    approverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ChangeRequestStatus),
      default: ChangeRequestStatus.PENDING,
      index: true,
    },
    /**
     * Structure:
     * {
     *   dueDate: { old: "2026-10-06T...", new: "2026-10-10T..." },
     *   priority: { old: "high", new: "medium" },
     *   status: { old: "IN_PROGRESS", new: "COMPLETED" },
     *   assignedTo: { old: "...", new: "..." }
     * }
     */
    requestedChanges: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    // Employee's reason for the changes
    reason: {
      type: String,
      default: "",
      trim: true,
    },
    // Approver's mandatory reason upon approval or rejection
    approverReason: {
      type: String,
      default: null,
      trim: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    actionSource: {
      type: String,
      enum: Object.values(ActionSource),
      default: null,
    },
    // Stored conflict snapshot if task was modified while request was pending
    conflictDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast lookup
taskChangeRequestSchema.index({ taskId: 1, status: 1 });
taskChangeRequestSchema.index({ approverId: 1, status: 1 });
taskChangeRequestSchema.index({ requestedBy: 1, status: 1 });
taskChangeRequestSchema.index({ createdAt: -1 });

export const TaskChangeRequest =
  mongoose.models.TaskChangeRequest ||
  mongoose.model("TaskChangeRequest", taskChangeRequestSchema);

export default TaskChangeRequest;
