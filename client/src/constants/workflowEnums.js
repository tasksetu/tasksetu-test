/**
 * Workflow Engine — Frontend Enum Constants
 *
 * Mirror of server/constants/workflowEnums.js for use in React components.
 * Single source of truth for all workflow-related constants on the client.
 */

// ─── Task Type ────────────────────────────────────────────────────────────────
export const TaskType = Object.freeze({
  REGULAR: "regular",
  EMAIL: "email",
  APPROVAL: "approval",
  MILESTONE: "milestone",
  RECURRING: "recurring",
  SUBTASK: "subtask",
});

export const TaskTypeLabel = Object.freeze({
  regular: "Regular Task",
  email: "Email Task",
  approval: "Approval Task",
  milestone: "Milestone",
  recurring: "Recurring Task",
  subtask: "Subtask",
});

// Icon names (for use with lucide-react)
export const TaskTypeIcon = Object.freeze({
  regular: "CheckSquare",
  email: "Mail",
  approval: "ShieldCheck",
  milestone: "Flag",
  recurring: "RefreshCw",
  subtask: "ListTodo",
});

// ─── Workflow Type ────────────────────────────────────────────────────────────
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
  CUSTOM: "custom",
});

export const WorkflowTypeLabel = Object.freeze({
  vendor_onboarding: "Vendor Onboarding",
  employee_onboarding: "Employee Onboarding",
  client_onboarding: "Client Onboarding",
  procurement: "Procurement",
  purchase_approval: "Purchase Approval",
  leave_approval: "Leave Approval",
  asset_allocation: "Asset Allocation",
  it_request: "IT Request",
  legal_review: "Legal Review",
  custom: "Custom Workflow",
});

// For react-select options
export const workflowTypeOptions = Object.entries(WorkflowTypeLabel).map(
  ([value, label]) => ({ value, label }),
);

// ─── Approval Mode ────────────────────────────────────────────────────────────
export const ApprovalMode = Object.freeze({
  ANY: "any",
  ALL: "all",
  SEQUENTIAL: "sequential",
});

export const ApprovalModeLabel = Object.freeze({
  any: "Any One",
  all: "All Must Approve",
  sequential: "Sequential",
});

// ─── Parent Cancellation Mode ─────────────────────────────────────────────────
export const ParentCancellationMode = Object.freeze({
  CANCEL_ON_REJECTION: "cancel_on_rejection",
  IGNORE_REJECTION: "ignore_rejection",
});

export const ParentCancellationModeLabel = Object.freeze({
  cancel_on_rejection: "Cancel Parent if any Subtask is Rejected/Cancelled",
  ignore_rejection: "Ignore Subtask Rejection (Default)",
});

// ─── Rejection Action ─────────────────────────────────────────────────────────
export const RejectionAction = Object.freeze({
  TERMINATE: "terminate",
  REINITIATE: "reinitiate",
});

// ─── Email Recipient Source ───────────────────────────────────────────────────
export const RecipientSource = Object.freeze({
  MANUAL: "manual",
  FORM: "form",
  PREVIOUS_FORM: "previous_form",
});

// ─── Recipient Status ─────────────────────────────────────────────────────────
export const RecipientStatus = Object.freeze({
  PENDING: "pending",
  SENT: "sent",
  DELIVERED: "delivered",
  OPENED: "opened",
  SUBMITTED: "submitted",
  FAILED: "failed",
});

export const RecipientStatusLabel = Object.freeze({
  pending: "Pending",
  sent: "Sent",
  delivered: "Delivered",
  opened: "Opened",
  submitted: "Submitted",
  failed: "Failed",
});

export const RecipientStatusColor = Object.freeze({
  pending: "gray",
  sent: "blue",
  delivered: "cyan",
  opened: "yellow",
  submitted: "green",
  failed: "red",
});

// ─── Variable Mapping Source ──────────────────────────────────────────────────
export const VariableMappedFrom = Object.freeze({
  CURRENT_FORM: "current_form",
  FORM_LIBRARY: "form_library",
  PREVIOUS_FORM: "previous_form",
  STATIC: "static",
});

// ─── Terminal Statuses ────────────────────────────────────────────────────────
export const TERMINAL_STATUSES = ["COMPLETED", "CANCELLED", "REJECTED", "DONE"];

export const isTerminalStatus = (status) =>
  TERMINAL_STATUSES.includes(status?.toUpperCase?.());

// ─── Task Type option lists for selects ───────────────────────────────────────
export const subtaskTypeOptions = [
  { value: TaskType.REGULAR, label: TaskTypeLabel.regular, icon: "CheckSquare" },
  { value: TaskType.EMAIL, label: TaskTypeLabel.email, icon: "Mail" },
  { value: TaskType.APPROVAL, label: TaskTypeLabel.approval, icon: "ShieldCheck" },
  { value: TaskType.MILESTONE, label: TaskTypeLabel.milestone, icon: "Flag" },
];
