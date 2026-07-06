import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true,
    },
    name: {
      type: String,
      required: true,
      unique: true,
    }
  }
);

// Index for performance
categorySchema.index({ name: 1 }, { unique: true });

export const FormCategory = mongoose.model("FormCategory", categorySchema);
