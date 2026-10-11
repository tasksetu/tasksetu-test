// Migration Script: Initialize Task Edit Approval Toggles for all organizations
// Sets dueDateApprovalEnabled, statusApprovalEnabled, priorityApprovalEnabled, assigneeApprovalEnabled to false
// for all existing organizations where they are not yet explicitly set.

import mongoose from "mongoose";
import dotenv from "dotenv";
import { Organization } from "../modals/organizationModal.js";

dotenv.config();

export async function runMigration() {
  const mongoUri =
    process.env.DATABASE_URL ||
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    "mongodb://localhost:27017/admin-task-manager";

  console.log("🔄 Starting Task Edit Approval Toggles migration...");
  console.log(`Connecting to database...`);

  let shouldCloseConnection = false;
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
    shouldCloseConnection = true;
  }
  console.log("✅ Database connection established.");

  try {
    const filter = {
      $or: [
        { dueDateApprovalEnabled: { $exists: false } },
        { statusApprovalEnabled: { $exists: false } },
        { priorityApprovalEnabled: { $exists: false } },
        { assigneeApprovalEnabled: { $exists: false } },
        { dueDateApprovalEnabled: null },
        { statusApprovalEnabled: null },
        { priorityApprovalEnabled: null },
        { assigneeApprovalEnabled: null },
      ],
    };

    const countToUpdate = await Organization.countDocuments(filter);
    console.log(`Found ${countToUpdate} organizations needing toggle initialization.`);

    const result = await Organization.updateMany(filter, {
      $set: {
        dueDateApprovalEnabled: false,
        statusApprovalEnabled: false,
        priorityApprovalEnabled: false,
        assigneeApprovalEnabled: false,
      },
    });

    console.log(`✅ Successfully updated ${result.modifiedCount} organizations.`);
    console.log("All organizations now have the 4 approval toggles configured (default: false).");

    return {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    };
  } finally {
    if (shouldCloseConnection) {
      await mongoose.disconnect();
      console.log("Closed database connection.");
    }
  }
}

// Execute directly if run as CLI
const isDirectRun = process.argv[1] && process.argv[1].includes("migrate-task-edit-approval-toggles");
if (isDirectRun) {
  runMigration()
    .then(() => {
      console.log("Migration completed successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
