/**
 * Workflow Engine — Shared Enum Definitions
 *
 * Single source of truth for all workflow-related enums.
 * Used by both backend models and service layers.
 * Frontend can import equivalent constants from client/src/constants/workflowEnums.js
 */

// ─── Task Type Enum ──────────────────────────────────────────────────────────
// Defines the type of every task/subtask in the workflow engine.
// All values are lowercase strings for backward-compatibility with existing DB records.
export const TaskType = Object.freeze({
  REGULAR: "regular",
  EMAIL: "email",
  APPROVAL: "approval",
  MILESTONE: "milestone",
  RECURRING: "recurring", // legacy — kept for backward compat
  SUBTASK: "subtask",     // legacy — kept for backward compat
});

export const TASK_TYPE_VALUES = Object.values(TaskType);

// Human-readable labels for each TaskType
export const TaskTypeLabel = Object.freeze({
  [TaskType.REGULAR]: "Regular Task",
  [TaskType.EMAIL]: "Email Task",
  [TaskType.APPROVAL]: "Approval Task",
  [TaskType.MILESTONE]: "Milestone",
  [TaskType.RECURRING]: "Recurring Task",
  [TaskType.SUBTASK]: "Subtask",
});

// ─── Workflow Type Enum ───────────────────────────────────────────────────────
// Defines what kind of business process a parent workflow represents.
// The engine is fully generic — this is metadata only.
export const WorkflowType = Object.freeze({
  VENDOR_ONBOARDING: "vendor_onboarding",
  EMPLOYEE_ONBOARDING: "employee_onboarding",
  CLIENT_ONBOARDING: "client_onboarding",
  PROCUREMENT: "procurement",
  PURCHASE_APPROVAL: "purchase_approval",
  LEAVE_APPROVAL: "leave_approval",
  ASSET_ALLOCATION: "asset_allocation",
  IT_REQUEST: "it_request",
  LEGAL_REVIEW: "legal_review",
  CUSTOM: "custom", // user-defined workflow
});

export const WORKFLOW_TYPE_VALUES = Object.values(WorkflowType);

export const WorkflowTypeLabel = Object.freeze({
  [WorkflowType.VENDOR_ONBOARDING]: "Vendor Onboarding",
  [WorkflowType.EMPLOYEE_ONBOARDING]: "Employee Onboarding",
  [WorkflowType.CLIENT_ONBOARDING]: "Client Onboarding",
  [WorkflowType.PROCUREMENT]: "Procurement",
  [WorkflowType.PURCHASE_APPROVAL]: "Purchase Approval",
  [WorkflowType.LEAVE_APPROVAL]: "Leave Approval",
  [WorkflowType.ASSET_ALLOCATION]: "Asset Allocation",
  [WorkflowType.IT_REQUEST]: "IT Request",
  [WorkflowType.LEGAL_REVIEW]: "Legal Review",
  [WorkflowType.CUSTOM]: "Custom Workflow",
});

// ─── Parent Cancellation Mode ─────────────────────────────────────────────────
// Controls what happens to a parent workflow when a subtask is rejected/cancelled.
export const ParentCancellationMode = Object.freeze({
  CANCEL_ON_REJECTION: "cancel_on_rejection",
  IGNORE_REJECTION: "ignore_rejection",
});

export const PARENT_CANCELLATION_MODE_VALUES = Object.values(ParentCancellationMode);

// ─── Approval Mode Enum ───────────────────────────────────────────────────────
export const ApprovalMode = Object.freeze({
  ANY: "any",           // First approver's decision is final
  ALL: "all",           // Every approver must approve
  SEQUENTIAL: "sequential", // Approvers review in ordered sequence
});

export const APPROVAL_MODE_VALUES = Object.values(ApprovalMode);

// ─── Approval Status Enum ─────────────────────────────────────────────────────
export const ApprovalStatus = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  AUTO_APPROVED: "auto_approved",
});

export const APPROVAL_STATUS_VALUES = Object.values(ApprovalStatus);

// ─── Approval Decision Action (on Rejection) ──────────────────────────────────
export const RejectionAction = Object.freeze({
  TERMINATE: "terminate",           // Follow parent cancellation mode
  REINITIATE: "reinitiate",         // Re-initiate the context task
});

export const REJECTION_ACTION_VALUES = Object.values(RejectionAction);

// ─── Email Recipient Source ───────────────────────────────────────────────────
export const RecipientSource = Object.freeze({
  MANUAL: "manual",       // Manually entered name + email
  FORM: "form",           // Mapped from a form field
  PREVIOUS_FORM: "previous_form", // Mapped from a previous task's form response
});

export const RECIPIENT_SOURCE_VALUES = Object.values(RecipientSource);

// ─── Email Recipient Status ───────────────────────────────────────────────────
export const RecipientStatus = Object.freeze({
  PENDING: "pending",      // Not sent yet
  SENT: "sent",           // Email sent
  DELIVERED: "delivered",  // Email delivered (if tracking supported)
  OPENED: "opened",        // Email opened
  SUBMITTED: "submitted",  // Form submitted by recipient
  FAILED: "failed",        // Sending failed
});

export const RECIPIENT_STATUS_VALUES = Object.values(RecipientStatus);

// ─── Visibility Permission ────────────────────────────────────────────────────
// Permissions granted to users in TaskVisibility
export const VisibilityPermission = Object.freeze({
  VIEW: "view",
  COMMENT: "comment",
  VIEW_ATTACHMENTS: "view_attachments",
  VIEW_FORM_DATA: "view_form_data",
});

export const VISIBILITY_PERMISSION_VALUES = Object.values(VisibilityPermission);

// ─── Milestone Type ───────────────────────────────────────────────────────────
export const MilestoneType = Object.freeze({
  STANDALONE: "standalone",
  LINKED: "linked",
  PROJECT: "project",
});

export const MILESTONE_TYPE_VALUES = Object.values(MilestoneType);

// ─── Task Status (Workflow-level) ─────────────────────────────────────────────
// These are the well-known workflow statuses.
// Actual per-org statuses are stored in TaskStatusConfig.
// These are used internally by the workflow engine for transition logic.
export const WorkflowStatus = Object.freeze({
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  REJECTED: "REJECTED",
  DONE: "DONE",
});

export const TERMINAL_STATUSES = [
  WorkflowStatus.COMPLETED,
  WorkflowStatus.CANCELLED,
  WorkflowStatus.REJECTED,
  WorkflowStatus.DONE,
];

export const isTerminalStatus = (status) =>
  TERMINAL_STATUSES.includes(status?.toUpperCase());
