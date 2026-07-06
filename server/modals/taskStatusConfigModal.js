import mongoose from "mongoose";

/**
 * Task Status Config (Organization-scoped)
 * - Used to drive all task status dropdowns/filters dynamically from DB.
 * - Tasks store `status` as the `code` from this collection.
 */
const taskStatusConfigSchema = new mongoose.Schema(
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
      uppercase: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
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
      default: false,
    },
    isFinal: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: true
    },
    // Reserved for future workflow support (safe default = empty array)
    allowedTransitions: {
      type: [String],
      default: [],
    },
    // System status mapping for custom statuses
    // Maps company custom statuses to core system statuses (OPEN, INPROGRESS, ONHOLD, DONE, CANCELLED)
    // This ensures proper lifecycle and logic even with custom status names
    systemStatus: {
      type: String,
      enum: ['OPEN', 'INPROGRESS', 'ONHOLD', 'DONE', 'CANCELLED'],
      required: function () {
        // systemStatus is required for all statuses
        // For built-in statuses, it matches the code
        // For custom statuses, admin must map to a core status
        return true;
      },
      default: function () {
        // Auto-map if status code matches a core status
        const coreStatuses = ['OPEN', 'INPROGRESS', 'ONHOLD', 'DONE', 'CANCELLED'];
        return coreStatuses.includes(this.code) ? this.code : 'OPEN';
      },
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

taskStatusConfigSchema.index({ organizationId: 1, code: 1 }, { unique: true });

export default mongoose.models.TaskStatusConfig ||
  mongoose.model("TaskStatusConfig", taskStatusConfigSchema);

