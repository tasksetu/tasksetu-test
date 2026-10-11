import "dotenv/config";
import mongoose from "mongoose";
import Task from "../server/modals/taskModal.js";
import { TaskChangeRequest } from "../server/modals/taskChangeRequestModal.js";

async function run() {
  const uri = process.env.DATABASE_URL || process.env.MONGODB_URI;
  if (!uri) throw new Error("No DATABASE_URL or MONGODB_URI in env");
  await mongoose.connect(uri);

  const latestTask = await Task.findOne({ dueDate: { $ne: null } }).sort({ updatedAt: -1 }).lean();
  console.log("LATEST TASK:", {
    id: latestTask?._id,
    title: latestTask?.title,
    dueDate: latestTask?.dueDate,
    dueDateISO: latestTask?.dueDate ? new Date(latestTask.dueDate).toISOString() : null
  });

  const latestCR = await TaskChangeRequest.findOne().sort({ createdAt: -1 }).lean();
  console.log("LATEST CHANGE REQUEST:", {
    id: latestCR?._id,
    requestedChanges: latestCR?.requestedChanges,
    status: latestCR?.status,
    reason: latestCR?.reason
  });

  await mongoose.disconnect();
}

run().catch(console.error);
