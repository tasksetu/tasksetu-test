import mongoose from "mongoose";

/**
 * Task Priority Config (Organization-scoped)
 * - Source of truth for task priority dropdowns/filters and due date rules.
 * - Tasks store `priority` as the `code` from this collection (lowercase).
 */
const taskPriorityConfigSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true
    },
    code: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    color: {
      type: String,
      default: "#6B7280",
      trim: true,
    },
order: {
      type: Number,
      default: 0
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    active: {
      type: Boolean,
      default: true
    },
    // Used for due date auto-calculation
    daysToDue: {
      type: Number,
      default: 14,
      min: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

taskPriorityConfigSchema.index({ organizationId: 1, code: 1 }, { unique: true });

export default mongoose.models.TaskPriorityConfig ||
  mongoose.model("TaskPriorityConfig", taskPriorityConfigSchema);

