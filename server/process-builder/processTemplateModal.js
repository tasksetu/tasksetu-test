import mongoose from "mongoose";

const processStepSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: [true, "Step name is required"],
      trim: true,
    },
    title: {
      type: String,
    },
    taskType: {
      type: String,
      enum: ["Regular", "Milestone", "Approval", "Email"],
      default: "Regular",
    },
    subtaskType: {
      type: String,
      default: "regular",
    },
    mainTaskType: {
      type: String,
      default: "regular",
    },
    assignedUserId: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, "Assigned user is required"],
    },
    assignedTo: {
      type: mongoose.Schema.Types.Mixed,
    },
    dueDays: {
      type: Number,
      default: 3,
      min: 0,
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
    },
    status: {
      type: String,
      default: "Open",
    },
    visibility: {
      type: String,
      enum: ["Private", "Public"],
      default: "Private",
    },
    tags: [
      {
        type: String,
      },
    ],
    description: {
      type: String,
      default: "",
    },
    approvalRequired: {
      type: Boolean,
      default: false,
    },
    formId: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    linkedTaskId: {
      type: String,
      default: null,
    },
    linkedToMilestone: {
      type: String,
      default: null,
    },
    configuration: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ autoInitiate: false }),
    },
    // Subtask type specific configuration fields
    emailConfig: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    emailSubject: {
      type: String,
      default: "",
    },
    emailBody: {
      type: String,
      default: "",
    },
    emailAutoComplete: {
      type: Boolean,
      default: false,
    },
    isApprovalTask: {
      type: Boolean,
      default: false,
    },
    approvalMode: {
      type: String,
      default: "any",
    },
    approvers: [
      {
        type: String,
      },
    ],
    approverIds: [
      {
        type: String,
      },
    ],
    approvalInstructions: {
      type: String,
      default: "",
    },
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
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    linkedTasks: [
      {
        type: String,
      },
    ],
    milestoneNotes: {
      type: String,
      default: "",
    },
  },
  { _id: false, strict: false }
);

const processTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Process name is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Process description is required"],
      trim: true,
    },
    status: {
      type: String,
      enum: ["Active", "Draft", "Archived"],
      default: "Active",
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: false,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    steps: {
      type: [processStepSchema],
      default: [],
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

export const ProcessTemplate =
  mongoose.models.ProcessTemplate ||
  mongoose.model("ProcessTemplate", processTemplateSchema);

export default ProcessTemplate;
