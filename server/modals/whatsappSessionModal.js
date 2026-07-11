import mongoose from "mongoose";

const whatsappSessionSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    currentStep: {
      type: String,
      default: "idle", // "idle", "awaiting_quick_task_title", "awaiting_regular_task_title", "awaiting_regular_task_date"
    },
    tempData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

export const WhatsappSession = mongoose.model("WhatsappSession", whatsappSessionSchema);
