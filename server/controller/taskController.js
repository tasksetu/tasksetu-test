// Get all trashed (soft-deleted) tasks for the current user
import auditLogger from "../utils/auditLogger.js";

export const getTrashedTasks = async (req, res) => {
  try {
    const userId = req.user.id;
    // Find all tasks where isDeleted=true and assignedTo or createdBy is current user
    const filter = {
      isDeleted: true,
      $or: [{ assignedTo: userId }, { createdBy: userId }],
    };
    const trashedTasksRaw = await Task.find(filter)
      .populate("deletedBy", "name email firstName lastName")
      .sort({ deletedAt: -1 });
    // Map fields to frontend expectations
    const trashedTasks = trashedTasksRaw.map((task) => {
      const t = task.toObject();
      const deleter = t.deletedBy;
      return {
        ...t,
        is_deleted: t.isDeleted,
        deleted_at: t.deletedAt || null,
        deleted_by: deleter
          ? {
              _id: deleter._id,
              name:
                deleter.name ||
                `${deleter.firstName || ""} ${deleter.lastName || ""}`.trim() ||
                deleter.email,
              email: deleter.email,
            }
          : null,
      };
    });
    res.json({ success: true, data: trashedTasks });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch trashed tasks",
        error: error.message,
      });
  }
};
import mongoose from "mongoose";
import { storage } from "../mongodb-storage.js";
import { ActivityHelper } from "../activity-helper.js";
import { calculateNextOccurrence } from "../utils/recurringTaskValidator.js"; // Import new validator for upfront generation
import {
  calculateNextDueDate,
  getTaskTypeLabel,
  getTaskOrganizationId,
  createNextRecurringOccurrence,
  calculateFirstOccurrence,
} from "../utils/helperFunction.js";
import { User } from "../modals/userModal.js";
import Task from "../modals/taskModal.js";
import TaskStatusConfig from "../modals/taskStatusConfigModal.js";
import TaskPriorityConfig from "../modals/taskPriorityConfigModal.js";
import { QuickTask } from "../modals/quickTaskModal.js";
import { FeatureUsageTracking } from "../modals/featureUsageTrackingModal.js";
import {
  validateTaskCreation,
  canCreateTaskType,
  canAssignToOthers as checkCanAssignToOthers,
  getPermissionDeniedMessage,
  getHighestPriorityRole,
} from "../utils/taskPermissions.js";
import {
  validateRecurrencePattern,
  generateRecurrenceSummary,
  generateDetailedExplanation,
} from "../utils/recurringTaskValidator.js";
import { NotificationService } from "../services/notificationService.js";
import {
  TriggerEvent,
  EntityType,
  NotificationPriority,
  ChannelType,
} from "../modals/notificationModal.js";
import * as licenseService from "../services/licenseService.js";
import viteConfig from "../../vite.config.js";
import NotificationLogger from "../services/notificationLogger.js";
import EnhancedNotificationHelper from "../services/enhancedNotificationHelper.js";
import { TimezoneHelper } from "../utils/timezoneHelper.js";

// Utility function to strip HTML tags from text
const stripHtml = (html) => {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").trim();
};

// 🎨 Centralized Status Color Mapping for TaskSetu
// ✅ Based on Document Specification - Using EXACT uppercase status values
// Database me sirf ye 5 core statuses store honge: OPEN, INPROGRESS, ONHOLD, DONE, CANCELLED
const STATUS_COLOR_MAP = {
  // ✅ Core Task Statuses (Document Specified - Uppercase Only)
  OPEN: "#9CA3AF", // Gray - Task created, work not started (Document: #9CA3AF)
  INPROGRESS: "#3B82F6", // Blue - Actively working (Document: #3B82F6)
  ONHOLD: "#F59E0B", // Orange - Temporarily paused (Document: #F59E0B)
  DONE: "#10B981", // Green - Successfully finished (Document: #10B981)
  CANCELLED: "#EF4444", // Red - Intentionally terminated (Document: #EF4444)
  OVERDUE: "#DC2626", // Dark Red - Derived/Calculated status (Document: #DC2626)

  // Task Type Colors (for task type badges)
  regular: "#3B82F6", // Blue
  recurring: "#8B5CF6", // Purple
  milestone: "#10B981", // Green
  approval: "#F59E0B", // Amber/Yellow
};

// Default organization status seed (used when org has no TaskStatusConfig yet)
// ✅ Lifecycle Flow: OPEN → IN PROGRESS → DONE
//                          ↘ ON HOLD
//                          ↘ CANCELLED
const DEFAULT_TASK_STATUS_CONFIGS = [
  {
    code: "OPEN",
    label: "Open",
    description: "Task is created but not yet started",
    color: "#6c757d",
    order: 1,
    isDefault: true,
    isFinal: false,
    systemStatus: "OPEN",
    // From OPEN, can transition to: IN PROGRESS, ON HOLD, or CANCELLED
    allowedTransitions: ["INPROGRESS", "ONHOLD", "CANCELLED"],
  },
  {
    code: "INPROGRESS",
    label: "In Progress",
    description: "Task is being actively worked on",
    color: "#3498db",
    order: 2,
    isDefault: false,
    isFinal: false,
    systemStatus: "INPROGRESS",
    // From IN PROGRESS, can transition to: DONE, ON HOLD, or CANCELLED
    allowedTransitions: ["DONE", "ONHOLD", "CANCELLED"],
  },
  {
    code: "ONHOLD",
    label: "On Hold",
    description: "Task is temporarily paused",
    color: "#f39c12",
    order: 3,
    isDefault: false,
    isFinal: false,
    systemStatus: "ONHOLD",
    // From ON HOLD, can only resume to: IN PROGRESS (no reverse, no cancel from hold)
    allowedTransitions: ["INPROGRESS"],
  },
  {
    code: "DONE",
    label: "Completed",
    description: "Task has been completed successfully",
    color: "#28a745",
    order: 4,
    isDefault: false,
    isFinal: true,
    systemStatus: "DONE",
    // DONE is a final status - no further transitions allowed
    allowedTransitions: [],
  },
  {
    code: "CANCELLED",
    label: "Cancelled",
    description: "Task was cancelled and will not be completed",
    color: "#dc3545",
    order: 5,
    isDefault: false,
    isFinal: true,
    systemStatus: "CANCELLED",
    // CANCELLED is a final status - no further transitions allowed
    allowedTransitions: [],
  },
];

async function ensureDefaultTaskStatusConfigs(organizationId, userId = null) {
  try {
    if (!organizationId) return;
    const existingCount = await TaskStatusConfig.countDocuments({
      organizationId,
    });
    if (existingCount > 0) return;

    const docs = DEFAULT_TASK_STATUS_CONFIGS.map((s) => ({
      ...s,
      organizationId,
      active: true,
      // allowedTransitions already set in DEFAULT_TASK_STATUS_CONFIGS with proper lifecycle
      createdBy: userId,
      updatedBy: userId,
    }));

    await TaskStatusConfig.insertMany(docs, { ordered: false });
  } catch (e) {
    // Non-fatal: do not block task operations if seeding fails (e.g., race conditions)
    console.error("ensureDefaultTaskStatusConfigs error:", e?.message || e);
  }
}

const DEFAULT_TASK_PRIORITY_CONFIGS = [
  {
    code: "low",
    label: "Low",
    color: "#22C55E",
    order: 1,
    isDefault: false,
    daysToDue: 30,
  },
  {
    code: "medium",
    label: "Medium",
    color: "#3B82F6",
    order: 2,
    isDefault: true,
    daysToDue: 14,
  },
  {
    code: "high",
    label: "High",
    color: "#F97316",
    order: 3,
    isDefault: false,
    daysToDue: 7,
  },
  {
    code: "critical",
    label: "Critical",
    color: "#EF4444",
    order: 4,
    isDefault: false,
    daysToDue: 2,
  },
  {
    code: "urgent",
    label: "Urgent",
    color: "#DC2626",
    order: 5,
    isDefault: false,
    daysToDue: 1,
  },
];

async function ensureDefaultTaskPriorityConfigs(organizationId, userId = null) {
  try {
    if (!organizationId) return;
    const existingCount = await TaskPriorityConfig.countDocuments({
      organizationId,
    });
    if (existingCount > 0) return;

    const docs = DEFAULT_TASK_PRIORITY_CONFIGS.map((p) => ({
      ...p,
      organizationId,
      active: true,
      createdBy: userId,
      updatedBy: userId,
    }));

    try {
      await TaskPriorityConfig.insertMany(docs, { ordered: false });
    } catch (e) {
      if (e?.code !== 11000) throw e;
    }
  } catch (e) {
    // Non-fatal: do not block task operations if seeding fails (e.g., race conditions)
    console.error("ensureDefaultTaskPriorityConfigs error:", e?.message || e);
  }
}

// Helper: recalc assigned/completed counters for a user (counts non-deleted tasks; includes subtasks)
async function recalcUserTaskCounters(userId) {
  try {
    if (!userId) return;
    const uid = userId.toString ? userId.toString() : userId;
    const assignedCount = await Task.countDocuments({
      assignedTo: uid,
      isDeleted: { $ne: true },
    });
    const completedCount = await Task.countDocuments({
      assignedTo: uid,
      status: "DONE",
      isDeleted: { $ne: true },
    });
    await User.findByIdAndUpdate(uid, {
      assignedTasks: assignedCount,
      completedTasks: completedCount,
    });
  } catch (err) {
    console.error("recalcUserTaskCounters error:", {
      userId,
      error: err.message,
    });
  }
}

// Helper: Create notification for task-related events
async function createTaskNotification(triggerEvent, task, options = {}) {
  try {
    const {
      targetUserId = null,
      title = null,
      message = null,
      priority = NotificationPriority.NORMAL,
      channels = [ChannelType.IN_APP, ChannelType.EMAIL],
      metadata = {},
    } = options;

    // Determine target user - default to assignee if not specified
    const notificationUserId = targetUserId || task.assignedTo;

    if (!notificationUserId) {
      console.log("No target user found for notification");
      return;
    }

    // Don't send notification to self for task creation
    const creatorId =
      task.createdBy?._id?.toString() || task.createdBy?.toString();
    if (
      triggerEvent === TriggerEvent.TASK_CREATED &&
      creatorId === notificationUserId?.toString()
    ) {
      console.log("Skipping self-notification for task creation");
      return;
    }

    // Generate default title and message if not provided
    const taskTitle = task.title || "Untitled Task";
    let notificationTitle = title;
    let notificationMessage = message;

    if (!notificationTitle || !notificationMessage) {
      switch (triggerEvent) {
        case TriggerEvent.TASK_CREATED:
          notificationTitle = title || "New Task Assigned";
          notificationMessage =
            message || `You have been assigned a new task: "${taskTitle}"`;
          break;
        case TriggerEvent.TASK_UPDATED:
          notificationTitle = title || "Task Updated";
          notificationMessage =
            message || `Task "${taskTitle}" has been updated`;
          break;
        case TriggerEvent.TASK_REASSIGNED:
          notificationTitle = title || "Task Reassigned";
          notificationMessage =
            message || `Task "${taskTitle}" has been assigned to you`;
          break;
        case TriggerEvent.TASK_COMPLETED:
          notificationTitle = title || "Task Completed";
          notificationMessage =
            message || `Task "${taskTitle}" has been completed`;
          break;
        case TriggerEvent.SUBTASK_ADDED:
          notificationTitle = title || "New Subtask Added";
          notificationMessage =
            message || `A new subtask "${taskTitle}" has been added`;
          break;
        case TriggerEvent.TASK_STATUS_CHANGED:
          notificationTitle = title || "Task Status Changed";
          notificationMessage =
            message ||
            `Task "${taskTitle}" status has been changed to ${task.status}`;
          break;
        case TriggerEvent.COMMENT_ADDED:
          notificationTitle = title || "New Comment";
          notificationMessage =
            message || `A new comment has been added to task "${taskTitle}"`;
          break;
        case TriggerEvent.TASK_SNOOZED:
          notificationTitle = title || "Task Snoozed";
          notificationMessage =
            message ||
            `Task "${taskTitle}" has been snoozed until ${metadata.snoozeUntil || "further notice"}`;
          break;
        case TriggerEvent.TASK_UNSNOOZED:
          notificationTitle = title || "Task Wake-up";
          notificationMessage =
            message || `Task "${taskTitle}" is now active and ready for work`;
          break;
        default:
          notificationTitle = title || "Task Notification";
          notificationMessage =
            message || `Task "${taskTitle}" has been updated`;
      }
    }

    const notificationData = {
      user_id: notificationUserId,
      trigger_event: triggerEvent,
      related_entity: {
        entity_type: task.isSubtask ? EntityType.SUBTASK : EntityType.TASK,
        entity_id: task._id,
      },
      title: notificationTitle,
      message: notificationMessage,
      priority: priority,
      channels: channels,
      metadata: {
        taskId: task._id,
        taskTitle: taskTitle,
        taskStatus: task.status,
        taskPriority: task.priority,
        isSubtask: task.isSubtask || false,
        parentTaskId: task.parentTaskId || null,
        ...metadata,
      },
    };

    const notification =
      await NotificationService.createNotification(notificationData);

    if (notification) {
      console.log(`✅ Notification created for ${triggerEvent}:`, {
        notificationId: notification._id,
        userId: notificationUserId,
        taskId: task._id,
        title: notificationTitle,
      });
    }

    return notification;
  } catch (error) {
    console.error("Error creating task notification:", error);
  }
}

export const createTask = async (req, res) => {
  try {
    console.log(
      "\n\n🚀 [CREATE TASK] ========== STARTING TASK CREATION ==========",
    );
    console.log("🚀 [CREATE TASK] Timestamp:", new Date().toISOString());

    const user = req.user;
    const taskData = req.body;

    console.log(
      "📦 [CREATE TASK] Raw Request Body:",
      JSON.stringify(taskData, null, 2),
    );
    console.log("👤 [CREATE TASK] User Info:", {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    });

    // 🔐 ROLE-BASED PERMISSION VALIDATION (Phase I Implementation)
    console.log("\n🔐 [BACKEND] =================================");
    console.log("🔐 [BACKEND] TASK CREATION PERMISSION CHECK");
    console.log("🔐 [BACKEND] =================================");
    console.log("🔐 [BACKEND] User:", user.email || user.name);
    console.log("🔐 [BACKEND] User Role:", user.role);
    console.log("🔐 [BACKEND] Task Type:", taskData.taskType);
    console.log(
      "🔐 [BACKEND] Assigned To (from request):",
      taskData.assignedTo,
    );
    console.log("🔐 [BACKEND] Assigned To type:", typeof taskData.assignedTo);

    // Validate task creation permission
    const permissionCheck = validateTaskCreation(
      user,
      taskData.taskType,
      taskData.assignedTo || user.id,
    );

    if (!permissionCheck.allowed) {
      console.error("🔐 [BACKEND] ❌ PERMISSION DENIED");
      console.error("🔐 [BACKEND] Reason:", permissionCheck.message);
      console.log("🔐 [BACKEND] =================================\n\n");
      return res.status(403).json({
        success: false,
        message: permissionCheck.message,
      });
    }

    console.log("🔐 [BACKEND] ✅ PERMISSION GRANTED");
    console.log("🔐 [BACKEND] =================================\n");

    // ✅ Validate title length
    if (!taskData.title || taskData.title.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Task title is required",
      });
    }

    if (taskData.title.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Task title cannot exceed 100 characters",
      });
    }

    // 🏷️ Multi-tier tag parsing (handles array, JSON string, or single string)
    console.log("🏷️ [PARSE TAGS] Starting tag parsing...");
    // 🏷️ Multi-tier tag parsing (handles array, JSON string, or single string)
    console.log("🏷️ [PARSE TAGS] Starting tag parsing...");
    let parsedTags = [];
    if (taskData.tags) {
      console.log("🏷️ [PARSE TAGS] Raw tags:", taskData.tags);
      console.log("🏷️ [PARSE TAGS] Tags type:", typeof taskData.tags);

      if (Array.isArray(taskData.tags)) {
        parsedTags = taskData.tags;
        console.log("🏷️ [PARSE TAGS] Already array:", parsedTags);
      } else if (typeof taskData.tags === "string") {
        try {
          const parsed = JSON.parse(taskData.tags);
          parsedTags = Array.isArray(parsed) ? parsed : [parsed];
          console.log("🏷️ [PARSE TAGS] Parsed from JSON:", parsedTags);
        } catch (e) {
          // Not valid JSON, treat as single tag string
          parsedTags = [taskData.tags];
          console.log("🏷️ [PARSE TAGS] Single string tag:", parsedTags);
        }
      }
    }
    console.log("🏷️ [PARSE TAGS] Final parsed tags:", parsedTags);

    // Parse JSON fields
    console.log("\n📋 [PARSE DATA] Parsing JSON fields...");

    // 🔗 Parse linkedTaskIds properly
    let parsedLinkedTaskIds = [];
    if (taskData.linkedTaskIds) {
      try {
        const parsed =
          typeof taskData.linkedTaskIds === "string"
            ? JSON.parse(taskData.linkedTaskIds)
            : taskData.linkedTaskIds;
        parsedLinkedTaskIds = Array.isArray(parsed) ? parsed : [parsed];
        console.log(
          "🔗 [PARSE DATA] Parsed linkedTaskIds:",
          parsedLinkedTaskIds,
        );
      } catch (e) {
        console.error(
          "❌ [PARSE DATA] Error parsing linkedTaskIds:",
          e.message,
        );
        parsedLinkedTaskIds = [];
      }
    }

    // 🏔️ Parse milestoneData properly
    let parsedMilestoneData = null;
    if (taskData.milestoneData) {
      try {
        parsedMilestoneData =
          typeof taskData.milestoneData === "string"
            ? JSON.parse(taskData.milestoneData)
            : taskData.milestoneData;

        // Ensure linkedTaskIds in milestoneData is also properly parsed
        if (parsedMilestoneData && parsedMilestoneData.linkedTaskIds) {
          parsedMilestoneData.linkedTaskIds = Array.isArray(
            parsedMilestoneData.linkedTaskIds,
          )
            ? parsedMilestoneData.linkedTaskIds
            : [parsedMilestoneData.linkedTaskIds];
        }
        console.log(
          "🏔️ [PARSE DATA] Parsed milestoneData:",
          parsedMilestoneData,
        );
      } catch (e) {
        console.error(
          "❌ [PARSE DATA] Error parsing milestoneData:",
          e.message,
        );
        parsedMilestoneData = null;
      }
    }

    // 👥 Parse contributorIds (handle array, JSON string, or FormData array)
    console.log("👥 [PARSE CONTRIBUTORS] Starting contributor parsing...");
    let parsedContributorIds = [];
    if (taskData.contributorIds) {
      console.log(
        "👥 [PARSE CONTRIBUTORS] Raw contributorIds:",
        taskData.contributorIds,
      );
      console.log(
        "👥 [PARSE CONTRIBUTORS] Type:",
        typeof taskData.contributorIds,
      );

      if (Array.isArray(taskData.contributorIds)) {
        // Already an array (from FormData or direct array)
        parsedContributorIds = taskData.contributorIds;
        console.log(
          "👥 [PARSE CONTRIBUTORS] Already array:",
          parsedContributorIds,
        );
      } else if (typeof taskData.contributorIds === "string") {
        try {
          // Try JSON parsing first
          const parsed = JSON.parse(taskData.contributorIds);
          parsedContributorIds = Array.isArray(parsed) ? parsed : [parsed];
          console.log(
            "👥 [PARSE CONTRIBUTORS] Parsed from JSON:",
            parsedContributorIds,
          );
        } catch (e) {
          // Not valid JSON, treat as single ID string
          parsedContributorIds = [taskData.contributorIds];
          console.log(
            "👥 [PARSE CONTRIBUTORS] Single string ID:",
            parsedContributorIds,
          );
        }
      }
    }
    console.log(
      "👥 [PARSE CONTRIBUTORS] Final parsed contributors:",
      parsedContributorIds,
    );

    const parsedTaskData = {
      ...taskData,
      tags: parsedTags,
      collaboratorIds: taskData.collaboratorIds
        ? JSON.parse(taskData.collaboratorIds)
        : [],
      contributorIds: parsedContributorIds,
      dependsOnTaskIds: taskData.dependsOnTaskIds
        ? typeof taskData.dependsOnTaskIds === "string"
          ? JSON.parse(taskData.dependsOnTaskIds)
          : taskData.dependsOnTaskIds
        : [],
      recurrencePattern: taskData.recurrencePattern
        ? JSON.parse(taskData.recurrencePattern)
        : null,
      milestoneData: parsedMilestoneData,
      approvalData: taskData.approvalData
        ? JSON.parse(taskData.approvalData)
        : null,
      approverIds: taskData.approverIds ? JSON.parse(taskData.approverIds) : [],
      linkedTaskIds: parsedLinkedTaskIds,
    };

    // 🔐 Phase I RBAC: Validate contributor IDs if provided
    // Contributors must exist in the same organization
    if (
      parsedTaskData.collaboratorIds &&
      parsedTaskData.collaboratorIds.length > 0 &&
      user.organizationId
    ) {
      console.log(
        "👥 [CONTRIBUTOR VALIDATION] Checking contributors:",
        parsedTaskData.collaboratorIds,
      );

      // Import User model for validation
      const User = (await import("../modals/userModal.js")).User;

      // Validate each contributor ID
      for (const contributorId of parsedTaskData.collaboratorIds) {
        try {
          const contributor = await User.findById(contributorId)
            .select("_id organization_id")
            .lean();

          if (!contributor) {
            console.error(
              "❌ [CONTRIBUTOR VALIDATION] User not found:",
              contributorId,
            );
            return res.status(400).json({
              success: false,
              message: `Contributor with ID ${contributorId} does not exist`,
              error: "INVALID_CONTRIBUTOR",
            });
          }

          // Verify contributor is in same organization
          const contributorOrgId = contributor.organization_id?.toString();
          const userOrgId = user.organizationId?.toString();

          if (contributorOrgId !== userOrgId) {
            console.error(
              "❌ [CONTRIBUTOR VALIDATION] Contributor not in same organization:",
              {
                contributorId,
                contributorOrgId,
                userOrgId,
              },
            );
            return res.status(400).json({
              success: false,
              message: `Contributor must be from the same organization`,
              error: "CONTRIBUTOR_ORG_MISMATCH",
            });
          }

          console.log(
            "✅ [CONTRIBUTOR VALIDATION] Valid contributor:",
            contributorId,
          );
        } catch (validationError) {
          console.error(
            "❌ [CONTRIBUTOR VALIDATION] Error validating contributor:",
            validationError,
          );
          return res.status(500).json({
            success: false,
            message: "Error validating contributor",
            error: validationError.message,
          });
        }
      }

      console.log("✅ [CONTRIBUTOR VALIDATION] All contributors validated");
    }

    // 🔄 Recurring Task Contributors Validation (PRD 4.3)
    // Contributors: Multiple non-assigning users with visibility + notifications only
    if (
      parsedTaskData.taskType === "recurring" &&
      parsedTaskData.contributorIds &&
      parsedTaskData.contributorIds.length > 0 &&
      user.organizationId
    ) {
      console.log(
        "🔄 [RECURRING CONTRIBUTORS] Validating contributors for recurring task:",
        parsedTaskData.contributorIds,
      );

      const User = (await import("../modals/userModal.js")).User;
      const assignedToId =
        parsedTaskData.assignedTo?.toString?.() ||
        String(parsedTaskData.assignedTo) ||
        user.id;

      for (const contributorId of parsedTaskData.contributorIds) {
        try {
          // Validate contributor exists
          const contributor = await User.findById(contributorId)
            .select("_id organization_id")
            .lean();

          if (!contributor) {
            console.error(
              "❌ [RECURRING CONTRIBUTORS] User not found:",
              contributorId,
            );
            return res.status(400).json({
              success: false,
              message: `Contributor with ID ${contributorId} does not exist`,
              error: "INVALID_CONTRIBUTOR",
            });
          }

          // Verify contributor is in same organization
          const contributorOrgId = contributor.organization_id?.toString();
          const userOrgId = user.organizationId?.toString();

          if (contributorOrgId !== userOrgId) {
            console.error(
              "❌ [RECURRING CONTRIBUTORS] Contributor not in same organization:",
              {
                contributorId,
                contributorOrgId,
                userOrgId,
              },
            );
            return res.status(400).json({
              success: false,
              message: `Contributor must be from the same organization`,
              error: "CONTRIBUTOR_ORG_MISMATCH",
            });
          }

          // Verify contributor is different from assignee
          if (contributorId.toString() === assignedToId.toString()) {
            console.error(
              "❌ [RECURRING CONTRIBUTORS] Contributor cannot be the same as assignee:",
              contributorId,
            );
            return res.status(400).json({
              success: false,
              message: `Contributor cannot be the same as the assignee`,
              error: "CONTRIBUTOR_ASSIGNEE_CONFLICT",
            });
          }

          console.log(
            "✅ [RECURRING CONTRIBUTORS] Valid contributor:",
            contributorId,
          );
        } catch (validationError) {
          console.error(
            "❌ [RECURRING CONTRIBUTORS] Error validating contributor:",
            validationError,
          );
          return res.status(500).json({
            success: false,
            message: "Error validating recurring task contributor",
            error: validationError.message,
          });
        }
      }

      console.log(
        "✅ [RECURRING CONTRIBUTORS] All contributors validated for recurring task",
      );
    }

    console.log(
      "📋 [PARSE DATA] Parsed task data keys:",
      Object.keys(parsedTaskData),
    );
    console.log("📋 [PARSE DATA] assignedTo:", parsedTaskData.assignedTo);
    console.log("📋 [PARSE DATA] taskType:", parsedTaskData.taskType);
    console.log("📋 [PARSE DATA] title:", parsedTaskData.title);

    console.log(
      "🔍 DEBUG BACKEND - Raw request body:",
      JSON.stringify(taskData, null, 2),
    );
    console.log(
      "🔍 DEBUG BACKEND - Parsed task data:",
      JSON.stringify(parsedTaskData, null, 2),
    );
    console.log(
      "🔍 DEBUG BACKEND - Recurrence pattern raw:",
      taskData.recurrencePattern,
    );
    console.log(
      "🔍 DEBUG BACKEND - Recurrence pattern parsed:",
      parsedTaskData.recurrencePattern,
    );
    console.log(
      "🔍 DEBUG BACKEND - Start date from parsed data:",
      parsedTaskData.startDate,
    );
    console.log(
      "🔍 DEBUG BACKEND - Due date from parsed data:",
      parsedTaskData.dueDate,
    );
    console.log("🔍 DEBUG BACKEND - Task type:", parsedTaskData.taskType);
    viteConfig;
    // Handle attachments
    let attachments = [];
    if (req.files && req.files.length > 0) {
      attachments = req.files.map((file) => ({
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype,
        url: `/uploads/task-attachments/${file.filename}`,
        uploadedBy: user.id,
        uploadedAt: new Date(),
        version: 1,
        deleted: false,
        // Legacy fields for backward compatibility
        id: Date.now() + Math.random(),
        name: file.originalname,
        type: file.mimetype,
      }));
    }

    console.log(
      "DEBUG - parsedTaskData.createdByRole:",
      parsedTaskData.createdByRole,
    );
    console.log("DEBUG - user.role:", user.role);
    console.log("DEBUG - user.role type:", typeof user.role);

    // Determine the createdByRole - prefer request data, then handle user role array
    let createdByRole = parsedTaskData.createdByRole;
    if (!createdByRole) {
      if (Array.isArray(user.role)) {
        // If user has multiple roles, pick the highest priority one
        const rolePriority = [
          "super_admin",
          "org_admin",
          "manager",
          "employee",
          "individual",
        ];
        createdByRole =
          user.role.find((role) => rolePriority.includes(role)) || "employee";
      } else {
        createdByRole = user.role || "employee";
      }
    }

    console.log("DEBUG - final createdByRole:", createdByRole);

    // 🏔️ MILESTONE TASK CREATION VALIDATION (Doc Ref: 4.3.1)
    // Uses permission matrix from taskPermissions.js
    if (parsedTaskData.taskType === "milestone") {
      const userRoles = Array.isArray(user.role) ? user.role : [user.role];
      const normalizedRole = userRoles[0] || user.role; // Get the primary role

      console.log("🏔️ Milestone task creation attempt:", {
        userRoles,
        normalizedRole,
      });

      // ✅ Use permission matrix to check if user can create milestones
      if (!canCreateTaskType(normalizedRole, "milestone")) {
        console.error(
          "❌ Permission denied: User role cannot create milestone tasks",
        );
        return res.status(403).json({
          success: false,
          message:
            "Access denied: Your role does not have permission to create milestone tasks.",
        });
      }

      console.log("✅ Milestone task creation permission granted");

      // 🏔️ Milestone tasks DO NOT support tags - clear them
      parsedTaskData.tags = [];
      console.log(
        "🏔️ Cleared tags for milestone task (milestone tasks do not support tags)",
      );
    }

    // 👤 APPROVAL TASK CREATION VALIDATION
    // Uses permission matrix from taskPermissions.js
    if (parsedTaskData.taskType === "approval") {
      const userRoles = Array.isArray(user.role) ? user.role : [user.role];
      const normalizedRole = userRoles[0] || user.role; // Get the primary role

      console.log("✅ Approval task creation attempt:", {
        userRoles,
        normalizedRole,
      });

      // ✅ Use permission matrix to check if user can create approval tasks
      if (!canCreateTaskType(normalizedRole, "approval")) {
        console.error(
          "❌ Permission denied: User role cannot create approval tasks",
        );
        return res.status(403).json({
          success: false,
          message:
            "Access denied: Your role does not have permission to create approval tasks.",
        });
      }

      console.log("✅ Approval task creation permission granted");
    }

    // ✅ Dynamic Status Validation (DB is source of truth for organization users)
    if (user.organizationId) {
      await ensureDefaultTaskStatusConfigs(user.organizationId, user.id);
      await ensureDefaultTaskPriorityConfigs(user.organizationId, user.id);

      const requestedStatus =
        parsedTaskData.status !== undefined && parsedTaskData.status !== null
          ? String(parsedTaskData.status).trim().toUpperCase()
          : "";

      if (requestedStatus) {
        const exists = await TaskStatusConfig.findOne({
          organizationId: user.organizationId,
          code: requestedStatus,
          active: true,
        }).lean();

        if (!exists) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid status. Please select a valid status from the list.",
          });
        }
        parsedTaskData.status = requestedStatus;
      } else {
        const defaultStatus =
          (await TaskStatusConfig.findOne({
            organizationId: user.organizationId,
            isDefault: true,
            active: true,
          })
            .sort({ order: 1, createdAt: 1 })
            .lean()) ||
          (await TaskStatusConfig.findOne({
            organizationId: user.organizationId,
            code: "OPEN",
            active: true,
          }).lean());

        parsedTaskData.status = defaultStatus?.code || "OPEN";
      }
    } else if (parsedTaskData.status) {
      // Non-organization (individual) users: normalize only
      parsedTaskData.status = String(parsedTaskData.status)
        .trim()
        .toUpperCase();
    }

    // ✅ Dynamic Priority Validation (DB is source of truth for organization users)
    if (user.organizationId) {
      const requestedPriority =
        parsedTaskData.priority !== undefined &&
        parsedTaskData.priority !== null
          ? String(parsedTaskData.priority).trim().toLowerCase()
          : "";

      if (requestedPriority) {
        const exists = await TaskPriorityConfig.findOne({
          organizationId: user.organizationId,
          code: requestedPriority,
          active: true,
        }).lean();

        if (!exists) {
          console.error("❌ INVALID PRIORITY ATTEMPT:", {
            requestedPriority,
            userId: user.id,
            organizationId: user.organizationId,
          });
          return res.status(400).json({
            success: false,
            message: `Invalid priority "${requestedPriority}". Please select a valid priority from the list.`,
          });
        }
        parsedTaskData.priority = requestedPriority;
      } else {
        const defaultPriority =
          (await TaskPriorityConfig.findOne({
            organizationId: user.organizationId,
            isDefault: true,
            active: true,
          })
            .sort({ order: 1, createdAt: 1 })
            .lean()) ||
          (await TaskPriorityConfig.findOne({
            organizationId: user.organizationId,
            code: "medium",
            active: true,
          }).lean());

        parsedTaskData.priority = defaultPriority?.code || "medium";
      }
    } else if (parsedTaskData.priority) {
      parsedTaskData.priority = String(parsedTaskData.priority)
        .trim()
        .toLowerCase();
    }

    // Helper: parse a date string treating it as UTC if no timezone info is present.
    // Prevents server local-time offset from shifting the stored timestamp.
    const parseDateAsUTC = (dateStr) => {
      if (!dateStr) return null;
      const str = String(dateStr).trim();
      // If the string already carries timezone info (Z, +HH:MM, or -HH:MM after time part) use as-is.
      // Regex checks for a trailing Z or a +/- offset after at least HH:MM time portion.
      const hasTimezone = /[Zz]$|(T\d{2}:\d{2}(:\d{2})?(\.\d+)?[+-]\d{2}:?\d{2})$/.test(str);
      const normalised = hasTimezone ? str : str + 'Z';
      const d = new Date(normalised);
      return isNaN(d.getTime()) ? null : d;
    };

    // Base Task (with improved recurring logic)
    let baseTask = {
      title: parsedTaskData.title,
      description: parsedTaskData.description || "",
      createdBy: user.id,
      createdByRole: createdByRole,
      assignedTo: parsedTaskData.assignedTo || user.id,
      status: parsedTaskData.status || "OPEN",
      priority: parsedTaskData.priority || "medium",
      dueDate: parseDateAsUTC(parsedTaskData.dueDate),
      timeEstimate: parsedTaskData.timeEstimate || 0, // In hours (0 by default)
      startDate: parseDateAsUTC(parsedTaskData.startDate),
      taskType: parsedTaskData.taskType || "regular",
      mainTaskType: parsedTaskData.mainTaskType || parsedTaskData.taskType,
      taskTypeAdvanced: parsedTaskData.taskTypeAdvanced || "simple",
      tags: parsedTaskData.tags,
      category: parsedTaskData.category,
      visibility: parsedTaskData.visibility || "private",
      collaborators: parsedTaskData.collaboratorIds,
      contributors: parsedTaskData.contributorIds || [],
      dependencies:
        parsedTaskData.dependsOnTaskIds &&
        parsedTaskData.dependsOnTaskIds.length > 0
          ? parsedTaskData.dependsOnTaskIds
          : [],
      attachments: attachments,
      customFields: {},
      referenceProcess: parsedTaskData.referenceProcess || null,
      customForm: parsedTaskData.customForm || null,
      isArchived: false,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (user.organizationId) {
      baseTask.organization = user.organizationId;
    }

    // Task type specific fields
    switch (parsedTaskData.taskType) {
      case "recurring": {
        console.log("🔄 DEBUG BACKEND - Processing recurring task case");
        console.log(
          "🔄 DEBUG BACKEND - Recurrence pattern data:",
          JSON.stringify(parsedTaskData.recurrencePattern, null, 2),
        );

        // Get user timezone for recurring task calculations
        const recurringUserTimezone = await TimezoneHelper.getUserTimezone(
          user.id,
        );

        // ✅ VALIDATE RECURRENCE PATTERN
        const validation = validateRecurrencePattern(
          parsedTaskData.recurrencePattern,
          recurringUserTimezone,
        );

        if (!validation.valid) {
          console.error(
            "❌ BACKEND VALIDATION - Invalid recurrence pattern:",
            validation.errors,
          );
          return res.status(400).json({
            success: false,
            message: "Invalid recurrence pattern",
            errors: validation.errors,
          });
        }

        console.log(
          "✅ BACKEND VALIDATION - Recurrence pattern validated successfully",
        );
        console.log(
          "✅ BACKEND VALIDATION - Sanitized pattern:",
          JSON.stringify(validation.sanitized, null, 2),
        );

        // Use sanitized (normalized) pattern
        const sanitizedPattern = validation.sanitized;

        baseTask.isRecurring = true;
        baseTask.recurrencePattern = sanitizedPattern;

        // Store the full recurrence configuration for better compatibility
        baseTask.recurringConfig = sanitizedPattern;

        // ✅ ========== PARENT/INSTANCE STATUS TRACKING ==========
        // Section 4.3 - Recurring Task Logic & Instance Management
        //
        // ARCHITECTURE:
        // - Parent recurring task = Template/Container (system-managed status)
        // - Each instance = Independent child task (manual status control)
        //
        // PARENT TASK PROPERTIES:
        baseTask.isParentRecurring = true; // Flag: this is the parent template
        baseTask.parentRecurringTaskId = null; // Parent has no parent
        baseTask.occurrenceCount = 1; // Track total instances generated (1st instance)
        baseTask.instanceNumber = 1; // First instance sequence number
        baseTask.isStatusSystemManaged = true; // Flag to prevent manual status changes

        // ✅ PARENT STATUS RULES (Section 4.6 - Status Management):
        // Initial: OPEN (first instance not started)
        //
        // Auto-update conditions:
        // 1. Current active instance INPROGRESS → Parent INPROGRESS
        // 2. All instances DONE + no upcoming → Parent DONE
        // 3. All past instances DONE + future scheduled → Parent INPROGRESS
        // 4. First instance not started → Parent OPEN
        baseTask.status = "OPEN";

        // ✅ INSTANCE STATUS RULES (Section 4.3):
        // - Each new instance always starts as OPEN
        // - Instance status can be changed manually (OPEN → INPROGRESS → DONE)
        // - Instance has own lifecycle independent of parent
        // - Parent auto-updates when instance status changes
        // ========================================================

        // Generate human-readable summary
        const recurrenceSummary = generateRecurrenceSummary(
          sanitizedPattern,
          recurringUserTimezone,
        );
        const detailedExplanation = generateDetailedExplanation(
          sanitizedPattern,
          recurringUserTimezone,
        );

        console.log(
          "📝 BACKEND - Generated recurrence summary:",
          recurrenceSummary,
        );
        console.log(
          "📋 BACKEND - Detailed explanation:",
          JSON.stringify(detailedExplanation, null, 2),
        );

        // Store summary in task metadata for display
        baseTask.recurrenceDescription = recurrenceSummary;
        baseTask.recurrenceExplanation = detailedExplanation;

        // Store summary in task for display
        if (!baseTask.description || baseTask.description.trim() === "") {
          baseTask.description = `Recurring task: ${recurrenceSummary}`;
        }

        // ✅ Calculate first occurrence using backend logic (matching frontend)
        // This ensures proper handling of edge cases like Feb 29, month-end dates, etc.
        const firstOccurrenceDate = calculateFirstOccurrence(
          sanitizedPattern,
          recurringUserTimezone,
        );

        console.log(
          "🔄 DEBUG BACKEND - Due Date Handling for Recurring Task:",
          {
            frontendProvidedDueDate: parsedTaskData.dueDate,
            frontendProvidedNextDueDate: parsedTaskData.nextDueDate,
            backendCalculatedFirstOccurrence: firstOccurrenceDate.toISOString(),
            patternType: sanitizedPattern.patternType,
            startDate: sanitizedPattern.startDate,
            repeatEvery: sanitizedPattern.repeatEvery,
            weekdays: sanitizedPattern.weekdays,
          },
        );

        // ✅ IMPORTANT: Use frontend-provided dueDate if available, otherwise use calculated
        let finalDueDate = firstOccurrenceDate;
        let finalNextDueDate = null;

        if (parsedTaskData.dueDate) {
          console.log(
            "🔄 DEBUG BACKEND - Using FRONTEND dueDate:",
            parsedTaskData.dueDate,
          );
          finalDueDate = new Date(parsedTaskData.dueDate);
        } else {
          console.log(
            "🔄 DEBUG BACKEND - Using BACKEND calculated dueDate:",
            firstOccurrenceDate.toISOString(),
          );
        }

        if (parsedTaskData.nextDueDate) {
          console.log(
            "🔄 DEBUG BACKEND - Using FRONTEND nextDueDate:",
            parsedTaskData.nextDueDate,
          );
          finalNextDueDate = new Date(parsedTaskData.nextDueDate);

          // Also check nextDueDate against boundary
          if (
            sanitizedPattern.endCondition === "by_date" &&
            sanitizedPattern.endDate
          ) {
            const endDateObj = new Date(sanitizedPattern.endDate);
            endDateObj.setUTCHours(0, 0, 0, 0);

            const nextDueDateOnly = new Date(finalNextDueDate);
            nextDueDateOnly.setUTCHours(0, 0, 0, 0);

            if (nextDueDateOnly > endDateObj) {
              console.log(
                "⚠️ [RECURRING] nextDueDate exceeds end date, clearing it",
              );
              finalNextDueDate = null; // Don't fail, just clear the next occurrence link
            }
          }
        }

        baseTask.dueDate = finalDueDate;
        baseTask.nextDueDate = finalNextDueDate;

        console.log("🔄 DEBUG BACKEND - Final dates after merging:", {
          dueDate: baseTask.dueDate.toISOString(),
          nextDueDate: baseTask.nextDueDate?.toISOString(),
        });

        // ✅ Debug log - Recurring Task Creation Summary
        console.log("🔄 ========== RECURRING TASK CREATED ==========");
        console.log("🔄 [PARENT TEMPLATE] Task details:", {
          title: baseTask.title,
          startDate: baseTask.startDate?.toISOString(),
          firstOccurrenceDueDate: baseTask.dueDate?.toISOString(),
          nextDueDate: baseTask.nextDueDate?.toISOString(),
          status: baseTask.status,
          isParentRecurring: baseTask.isParentRecurring,
          isStatusSystemManaged: baseTask.isStatusSystemManaged,
          occurrenceCount: baseTask.occurrenceCount,
        });
        console.log("🔄 [RECURRENCE PATTERN]:", {
          patternType: sanitizedPattern.patternType,
          repeatEvery: sanitizedPattern.repeatEvery,
          monthlyMode: sanitizedPattern.monthlyMode,
          specificDate: sanitizedPattern.specificDate,
          endCondition: sanitizedPattern.endCondition,
          occurrences: sanitizedPattern.occurrences,
          endDate: sanitizedPattern.endDate,
        });
        console.log("🔄 [SUMMARY]:", recurrenceSummary);
        console.log("🔄 =============================================");
        break;
      }
      case "milestone": {
        console.log("🏔️ [MILESTONE TASK] Processing milestone task creation");
        console.log(
          "🏔️ [MILESTONE TASK] Milestone type:",
          parsedTaskData.milestoneType,
        );
        console.log(
          "🏔️ [MILESTONE TASK] Linked task IDs:",
          parsedTaskData.linkedTaskIds,
        );
        console.log(
          "🏔️ [MILESTONE TASK] Milestone data:",
          parsedTaskData.milestoneData,
        );

        baseTask.isMilestone = true;
        baseTask.milestoneType = parsedTaskData.milestoneType || "standalone";

        // 🔗 Handle linked tasks for linked milestone type
        if (
          parsedTaskData.milestoneType === "linked" &&
          parsedTaskData.linkedTaskIds &&
          parsedTaskData.linkedTaskIds.length > 0
        ) {
          console.log("🔗 [LINKED MILESTONE] Processing linked milestone");

          // Validate and convert linkedTaskIds to ObjectIds
          const validLinkedTaskIds = [];
          for (const taskId of parsedTaskData.linkedTaskIds) {
            try {
              // Convert to ObjectId if it's a valid ID
              const objectId = mongoose.Types.ObjectId.isValid(taskId)
                ? new mongoose.Types.ObjectId(taskId)
                : taskId;
              validLinkedTaskIds.push(objectId);
              console.log("✅ [LINKED MILESTONE] Valid task ID:", taskId);
            } catch (err) {
              console.error(
                "❌ [LINKED MILESTONE] Invalid task ID:",
                taskId,
                err.message,
              );
            }
          }

          console.log(
            "🔗 [LINKED MILESTONE] Valid linked task IDs count:",
            validLinkedTaskIds.length,
          );

          if (validLinkedTaskIds.length === 0) {
            console.error("❌ [LINKED MILESTONE] No valid linked tasks found");
            return res.status(400).json({
              success: false,
              message:
                "Linked milestone type requires at least one valid linked task",
            });
          }

          // Set linkedTasks array (top-level field for easy querying)
          baseTask.linkedTasks = validLinkedTaskIds;

          // Also set in milestoneData for consistency
          if (!baseTask.milestoneData) {
            baseTask.milestoneData = {};
          }
          baseTask.milestoneData.linkedTaskIds = validLinkedTaskIds;

          console.log(
            "✅ [LINKED MILESTONE] Set linkedTasks:",
            baseTask.linkedTasks,
          );
          console.log(
            "✅ [LINKED MILESTONE] Set milestoneData.linkedTaskIds:",
            baseTask.milestoneData.linkedTaskIds,
          );

          // ✅ Calculate due date from linked tasks (take the highest/latest due date)
          try {
            const linkedTasksData = await Task.find(
              { _id: { $in: validLinkedTaskIds } },
              { dueDate: 1, title: 1 },
            ).lean();

            console.log(
              "🔗 [LINKED MILESTONE] Fetched linked tasks for due date calculation:",
              linkedTasksData.length,
            );

            if (linkedTasksData && linkedTasksData.length > 0) {
              // Filter tasks with valid due dates and sort by due date (descending)
              const dueDates = linkedTasksData
                .filter((task) => task.dueDate)
                .map((task) => ({
                  dueDate: new Date(task.dueDate),
                  title: task.title,
                }))
                .sort((a, b) => b.dueDate - a.dueDate);

              if (dueDates.length > 0) {
                const latestDueDate = dueDates[0].dueDate;
                baseTask.dueDate = latestDueDate;
                console.log(
                  "🔗 [LINKED MILESTONE] Calculated due date from linked tasks:",
                  {
                    latestDueDate: latestDueDate.toISOString(),
                    tasksConsidered: dueDates.map((d) => ({
                      title: d.title,
                      dueDate: d.dueDate.toISOString(),
                    })),
                  },
                );
              } else {
                console.warn(
                  "⚠️  [LINKED MILESTONE] No linked tasks have due dates, using provided due date",
                );
              }
            } else {
              console.warn(
                "⚠️  [LINKED MILESTONE] Could not fetch linked tasks data",
              );
            }
          } catch (err) {
            console.error(
              "❌ [LINKED MILESTONE] Error calculating due date from linked tasks:",
              err.message,
            );
            // Continue with provided due date if calculation fails
          }

          // TODO: Update linked tasks to reference this milestone (bidirectional mapping)
          // This will be done after task creation
        } else {
          // Standalone milestone - no linked tasks
          baseTask.linkedTasks = [];
          if (!baseTask.milestoneData) {
            baseTask.milestoneData = {};
          }
          baseTask.milestoneData.linkedTaskIds = [];
          console.log("📍 [STANDALONE MILESTONE] No linked tasks");
        }

        // Set other milestone data if provided
        if (parsedTaskData.milestoneData) {
          baseTask.milestoneData = {
            ...baseTask.milestoneData,
            completionCriteria:
              parsedTaskData.milestoneData.completionCriteria || [],
            deliverables: parsedTaskData.milestoneData.deliverables || [],
            stakeholders: parsedTaskData.milestoneData.stakeholders || [],
          };
          console.log(
            "📋 [MILESTONE TASK] Set milestone data:",
            baseTask.milestoneData,
          );
        }

        console.log(
          "✅ [MILESTONE TASK] Milestone task configuration complete",
        );
        break;
      }
      case "approval":
        // ✅ Validate approval task due date is not in the past
        if (parsedTaskData.dueDate) {
          const dueDateObj = new Date(parsedTaskData.dueDate);
          const userTimezone = await TimezoneHelper.getUserTimezone(user.id);
          const { startOfDay: today } =
            TimezoneHelper.getDayBoundaries(userTimezone);

          if (dueDateObj < today) {
            return res.status(400).json({
              success: false,
              message: "Approval task due date must be today or later",
              error: "INVALID_DUE_DATE",
              providedDate: parsedTaskData.dueDate,
            });
          }
        }

        baseTask.isApprovalTask = true;
        baseTask.approvalMode = parsedTaskData.approvalMode || "any";
        baseTask.approvalStatus = "pending";
        baseTask.approvers = parsedTaskData.approverIds || [];

        // Parse auto-approval settings properly
        baseTask.autoApproveEnabled =
          parsedTaskData.autoApproveEnabled === true ||
          parsedTaskData.autoApproveEnabled === "true";

        // Convert autoApproveAfter string to Date object if provided
        if (parsedTaskData.autoApproveAfter) {
          const autoApproveDate = new Date(parsedTaskData.autoApproveAfter);
          if (!isNaN(autoApproveDate.getTime())) {
            baseTask.autoApproveAfter = autoApproveDate;
            console.log(
              "✅ [APPROVAL TASK] Auto-approve after:",
              autoApproveDate.toISOString(),
            );
          } else {
            console.error(
              "❌ [APPROVAL TASK] Invalid auto-approve date:",
              parsedTaskData.autoApproveAfter,
            );
          }
        }

        // ✅ Sequential mode setup: Create approverOrder with sequential status
        if (baseTask.approvalMode === "sequential") {
          baseTask.approverOrder = (parsedTaskData.approverIds || []).map(
            (id, index) => ({
              approverId: id,
              order: index + 1,
              status: index === 0 ? "pending" : "awaiting_turn", // Only first approver is pending
            }),
          );
          baseTask.currentApproverIndex = 0;
          console.log("✅ [APPROVAL TASK] Sequential mode configured:", {
            totalApprovers: baseTask.approverOrder.length,
            currentApprover: baseTask.approverOrder[0]?.approverId,
            approverOrder: baseTask.approverOrder.map((a) => ({
              order: a.order,
              status: a.status,
            })),
          });
        } else {
          console.log("✅ [APPROVAL TASK] Any/All mode configured:", {
            mode: baseTask.approvalMode,
            approversCount: baseTask.approvers.length,
          });
        }
        break;
    }

    // Save task
    const createdTask = await storage.createTask(baseTask);

    // ✅ UPFRONT RECURRENCE GENERATION
    // If this is a new recurring task, generate all future instances immediately based on the pattern
    // Use baseTask.recurrencePattern as it is the sanitized and validated version
    if (
      baseTask.isRecurring &&
      baseTask.recurrencePattern &&
      baseTask.recurrencePattern.patternType
    ) {
      // Since createdTask is immutable or const, use baseTask copy logic
      // But first, check if it's really the parent recurring task we just created
      // We need to fetch it or rely on baseTask properties we set earlier
      // baseTask.isParentRecurring should be true if it was set

      if (baseTask.isParentRecurring) {
        console.log(
          "🔄 [UPFRONT RECURRENCE] Generating all instances for recurring task:",
          baseTask.title,
        );

        try {
          // Use the sanitized pattern from baseTask
          const pattern = baseTask.recurrencePattern;

          // Start from the due date of the parent task
          // We must use createdTask.dueDate because baseTask might have raw string
          let currentDate = new Date(
            createdTask.dueDate || createdTask.startDate || Date.now(),
          );

          // Initialize instance count. Parent is #1.
          let instanceCount = 1;

          // Define limits based on end condition
          // 'never' -> 30 instances buffer
          // 'by_date' -> handled by date check
          // 'after' -> handled by count check
          const effectiveLimit = pattern.endCondition === "never" ? 30 : 365;

          // Clone base task data for instances
          // Make a shallow copy of baseTask to start with
          const instanceBase = { ...baseTask };

          // Remove ID and timestamps if they exist (baseTask usually doesn't have _id unless updated)
          delete instanceBase._id;
          delete instanceBase.createdAt;
          delete instanceBase.updatedAt;

          // Ensure instances are children of the parent
          instanceBase.isParentRecurring = false;
          instanceBase.parentRecurringTaskId = createdTask._id;

          // Main Loop
          while (true) {
            // Calculate next date from CURRENT date
            // Important: calculateNextOccurrence expects "currentDate" to be the last occurrence date
            // We use 'UTC' as default timezone to ensure consistency.
            const nextDate = calculateNextOccurrence(
              currentDate,
              pattern,
              "UTC",
            );

            // Break if no valid next date (end condition mismatched or calculation ended)
            if (!nextDate) {
              // This handles 'by_date' end condition returning null when passed
              console.log(
                "🔄 [UPFRONT RECURRENCE] End condition met (by date or calculation). Stopping generation.",
              );
              break;
            }

            // Break if count limit reached (for 'after' N occurrences)
            if (
              pattern.endCondition === "after" &&
              instanceCount >= pattern.occurrences
            ) {
              console.log(
                "🔄 [UPFRONT RECURRENCE] Occurrence count limit reached. Stopping generation.",
              );
              break;
            }

            // Special handling for 'never' -> create 30 instances buffer
            if (pattern.endCondition === "never" && instanceCount >= 30) {
              console.log(
                "🔄 [UPFRONT RECURRENCE] Infinite series buffer limit (30) reached. Stopping generation.",
              );
              break;
            }

            // Absolute safety break
            if (instanceCount >= effectiveLimit) {
              console.log(
                "🔄 [UPFRONT RECURRENCE] Safety limit reached (365). Stopping generation.",
              );
              break;
            }

            // Increment count for the NEXT instance
            instanceCount++;

            // Prepare next task object
            const nextTaskData = {
              ...instanceBase,
              dueDate: nextDate,
              startDate: nextDate, // Align start date with due date for instances
              isRecurring: true,
              recurrencePattern: pattern,
              instanceNumber: instanceCount,
              occurrenceCount: 0, // Instances don't track total count
              status: "OPEN",
              parentRecurringTaskId: createdTask._id,
              isParentRecurring: false,
              comments: [], // Start fresh
            };

            // Save the instance to database
            await storage.createTask(nextTaskData);
            console.log(
              `✅ [UPFRONT RECURRENCE] Generated instance #${instanceCount} for date: ${nextDate.toISOString()}`,
            );

            // Update current date for next iteration
            currentDate = nextDate;
          }

          // Update parent with total count of generated instances
          const Task = (await import("../modals/taskModal.js")).default;
          await Task.findByIdAndUpdate(createdTask._id, {
            occurrenceCount: instanceCount,
          });
          console.log(
            `✅ [UPFRONT RECURRENCE] Generation complete. Total instances: ${instanceCount}`,
          );
        } catch (err) {
          console.error(
            "❌ [UPFRONT RECURRENCE] Error generating instances:",
            err,
          );
        }
      }
    }

    // � BIDIRECTIONAL MAPPING: Update linked tasks to reference this milestone
    if (
      createdTask.isMilestone &&
      createdTask.milestoneType === "linked" &&
      createdTask.linkedTasks &&
      createdTask.linkedTasks.length > 0
    ) {
      console.log(
        "🔗 [BIDIRECTIONAL MAPPING] Updating linked tasks to reference milestone",
      );
      console.log("🔗 [BIDIRECTIONAL MAPPING] Milestone ID:", createdTask._id);
      console.log(
        "🔗 [BIDIRECTIONAL MAPPING] Linked task IDs:",
        createdTask.linkedTasks,
      );

      try {
        // Import Task model
        const Task = (await import("../modals/taskModal.js")).default;

        // Update each linked task to reference this milestone
        const updatePromises = createdTask.linkedTasks.map(
          async (linkedTaskId) => {
            try {
              const updatedTask = await Task.findByIdAndUpdate(
                linkedTaskId,
                {
                  $set: { linkedToMilestone: createdTask._id },
                },
                { new: true },
              );

              if (updatedTask) {
                console.log(
                  `✅ [BIDIRECTIONAL MAPPING] Updated task ${linkedTaskId} to reference milestone ${createdTask._id}`,
                );
                return { success: true, taskId: linkedTaskId };
              } else {
                console.warn(
                  `⚠️  [BIDIRECTIONAL MAPPING] Task ${linkedTaskId} not found`,
                );
                return {
                  success: false,
                  taskId: linkedTaskId,
                  reason: "Task not found",
                };
              }
            } catch (err) {
              console.error(
                `❌ [BIDIRECTIONAL MAPPING] Error updating task ${linkedTaskId}:`,
                err.message,
              );
              return {
                success: false,
                taskId: linkedTaskId,
                reason: err.message,
              };
            }
          },
        );

        const results = await Promise.all(updatePromises);
        const successCount = results.filter((r) => r.success).length;
        const failCount = results.filter((r) => !r.success).length;

        console.log(
          `✅ [BIDIRECTIONAL MAPPING] Completed: ${successCount} success, ${failCount} failed`,
        );

        if (failCount > 0) {
          console.warn(
            "⚠️  [BIDIRECTIONAL MAPPING] Some linked tasks could not be updated:",
            results
              .filter((r) => !r.success)
              .map((r) => ({ taskId: r.taskId, reason: r.reason })),
          );
        }
      } catch (err) {
        console.error(
          "❌ [BIDIRECTIONAL MAPPING] Error in bidirectional mapping:",
          err.message,
        );
        // Don't fail task creation if bidirectional mapping fails
      }
    }

    // �🔄 Enhanced Debug: Log created task details with complete analysis
    if (createdTask.isRecurring) {
      console.log("🔄 === RECURRING TASK CREATION ANALYSIS ===");
      console.log("🔄 Task Created Successfully:", {
        taskId: createdTask._id,
        title: createdTask.title,
        isRecurring: createdTask.isRecurring,
        taskType: createdTask.taskType,

        // Due Date Analysis
        originalDueDate: createdTask.dueDate,
        originalDueDateType: typeof createdTask.dueDate,
        originalDueDateValue: createdTask.dueDate
          ? createdTask.dueDate.toString()
          : "NULL",

        nextDueDate: createdTask.nextDueDate,
        nextDueDateType: typeof createdTask.nextDueDate,
        nextDueDateValue: createdTask.nextDueDate
          ? createdTask.nextDueDate.toString()
          : "NULL",

        // Pattern Analysis
        recurrencePattern: createdTask.recurrencePattern,
        frequency: createdTask.recurrencePattern?.frequency,
        interval: createdTask.recurrencePattern?.interval,
        anchorField: createdTask.recurrencePattern?.anchorField,

        // Validation
        hasValidDueDate: !!createdTask.dueDate,
        hasValidNextDueDate: !!createdTask.nextDueDate,
        hasValidPattern: !!createdTask.recurrencePattern,

        // Frontend Display Logic Test
        displayDateForFrontend: createdTask.nextDueDate || createdTask.dueDate,
        shouldShowInTable: !!(createdTask.nextDueDate || createdTask.dueDate),

        // MongoDB State
        mongoState: {
          _id: createdTask._id,
          dueDate: createdTask.dueDate,
          nextDueDate: createdTask.nextDueDate,
          isRecurring: createdTask.isRecurring,
        },
      });

      // Additional validation checks
      if (!createdTask.dueDate && !createdTask.nextDueDate) {
        console.log(
          "⚠️  WARNING: Recurring task created without any due date!",
        );
      }

      if (!createdTask.recurrencePattern) {
        console.log(
          "⚠️  WARNING: Recurring task created without recurrence pattern!",
        );
      }

      console.log("🔄 === END RECURRING TASK CREATION ANALYSIS ===");
    } else {
      // Also log regular tasks for comparison
      console.log("📝 Regular Task Created:", {
        taskId: createdTask._id,
        title: createdTask.title,
        taskType: createdTask.taskType,
        dueDate: createdTask.dueDate,
        hasDueDate: !!createdTask.dueDate,
      });
    }

    // If approval task, create approval records
    if (parsedTaskData.taskType === "approval" && parsedTaskData.approverIds) {
      for (const approverId of parsedTaskData.approverIds) {
        await storage.createTaskApproval({
          taskId: createdTask._id,
          approverId: approverId,
          status: "pending",
          createdAt: new Date(),
        });
      }
    }

    // Recalculate counters for assignee
    await recalcUserTaskCounters(createdTask?.assignedTo);

    // � Log Task Creation
    try {
      await auditLogger.logTaskCreated(createdTask, req.user, req);
    } catch (auditError) {
      console.error(
        "⚠️ [AUDIT] Error logging task creation:",
        auditError.message,
      );
    }

    // �🔄 Check if this task was converted from a Quick Task
    // Look for quickTaskId in the request body or metadata
    console.log(
      "🔍 [QUICK TASK CONVERSION] Checking for quickTaskId in request...",
    );
    console.log(
      "🔍 [QUICK TASK CONVERSION] taskData.quickTaskId:",
      taskData.quickTaskId,
    );
    console.log(
      "🔍 [QUICK TASK CONVERSION] req.body.quickTaskId:",
      req.body.quickTaskId,
    );

    const quickTaskId =
      taskData.quickTaskId ||
      taskData.convertedFromQuickTaskId ||
      req.body.quickTaskId;

    console.log("🔍 [QUICK TASK CONVERSION] Final quickTaskId:", quickTaskId);

    if (quickTaskId) {
      try {
        console.log(
          "🔄 [QUICK TASK CONVERSION] Detected Quick Task conversion",
        );
        console.log("🔄 [QUICK TASK CONVERSION] Quick Task ID:", quickTaskId);
        console.log(
          "🔄 [QUICK TASK CONVERSION] Created Task ID:",
          createdTask._id,
        );
        console.log(
          "🔄 [QUICK TASK CONVERSION] Task Type:",
          parsedTaskData.taskType,
        );

        // Find and update the Quick Task
        const quickTask = await QuickTask.findById(quickTaskId);

        if (quickTask) {
          console.log("🔄 [QUICK TASK CONVERSION] Quick Task found:", {
            id: quickTask._id,
            title: quickTask.title,
            currentStatus: quickTask.status,
            currentConvertedStatus: quickTask.convertedToTask,
          });

          // Check if already converted
          if (quickTask.convertedToTask?.isConverted) {
            console.log(
              "⚠️  [QUICK TASK CONVERSION] Quick Task already marked as converted",
            );
          } else {
            // Mark Quick Task as converted
            quickTask.convertedToTask = {
              isConverted: true,
              taskId: createdTask._id,
              convertedAt: new Date(),
            };
            quickTask.status = "done";
            quickTask.completedAt = new Date();

            const savedQuickTask = await quickTask.save();

            console.log(
              "✅ [QUICK TASK CONVERSION] Quick Task marked as converted successfully",
            );
            console.log("✅ [QUICK TASK CONVERSION] Saved Quick Task:", {
              quickTaskId: savedQuickTask._id,
              convertedToTaskId: savedQuickTask.convertedToTask.taskId,
              isConverted: savedQuickTask.convertedToTask.isConverted,
              status: savedQuickTask.status,
              convertedAt: savedQuickTask.convertedToTask.convertedAt,
            });
          }
        } else {
          console.log(
            "⚠️  [QUICK TASK CONVERSION] Quick Task not found with ID:",
            quickTaskId,
          );
        }
      } catch (conversionError) {
        // Don't fail the task creation if conversion marking fails
        console.error(
          "❌ [QUICK TASK CONVERSION] Error marking Quick Task as converted:",
          conversionError,
        );
        console.error(
          "❌ [QUICK TASK CONVERSION] Error stack:",
          conversionError.stack,
        );
      }
    } else {
      console.log(
        "ℹ️  [QUICK TASK CONVERSION] No quickTaskId found in request",
      );
    }
    // 🔔 Create notification for task creation using enhanced helper
    try {
      NotificationLogger.logTaskCreation(
        "USING_ENHANCED_HELPER",
        {
          taskId: createdTask._id,
          taskType: createdTask.taskType,
        },
        "START",
      );

      const notificationResult =
        await EnhancedNotificationHelper.notifyTaskCreation(createdTask, {
          taskType: createdTask.taskType,
          createdBy: user.id,
          collaborators: createdTask.collaborators || [],
          approvers: createdTask.approvers || [],
        });

      NotificationLogger.logTaskCreation(
        "ENHANCED_NOTIFICATIONS_SENT",
        {
          taskId: createdTask._id,
          assigneeNotifications: notificationResult.assignee.length,
          collaboratorNotifications: notificationResult.collaborators.length,
          approverNotifications: notificationResult.approvers.length,
          errors: notificationResult.errors.length,
        },
        "SUCCESS",
      );
    } catch (notificationError) {
      console.error("Error creating task notifications:", notificationError);
      NotificationLogger.logTaskCreation(
        "NOTIFICATION_ERROR",
        {
          error: notificationError.message,
          stack: notificationError.stack,
        },
        "ERROR",
      );
      // Don't fail task creation if notification fails
    }

    // 📊 Track feature usage based on task type
    console.log("\n📊 ======= USAGE TRACKING BLOCK START =======");
    console.log(
      "📊 [USAGE TRACKING] ENTERING USAGE TRACKING - createdTask._id:",
      createdTask?._id,
    );
    console.log(
      "📊 [USAGE TRACKING] createdTask.taskType:",
      createdTask?.taskType,
    );
    try {
      // ✅ FIXED: Use user_id and feature_code from middleware (set by checkDynamicTaskFeature)
      const userId = req.featureUsage?.user_id || req.user?.id || req.user?._id;
      console.log(
        "📊 [USAGE TRACKING] req.featureUsage:",
        JSON.stringify(req.featureUsage),
      );
      console.log(
        "📊 [USAGE TRACKING] req.user:",
        JSON.stringify({ id: req.user?.id, _id: req.user?._id }),
      );

      if (userId) {
        // ✅ Use feature code from middleware if available, otherwise determine from task
        let featureCode = req.featureUsage?.feature_code;

        // Fallback: Determine feature code if not set by middleware
        if (!featureCode) {
          featureCode = "TASK_BASIC"; // Default for regular tasks
          if (createdTask.isRecurring) {
            featureCode = "TASK_RECUR";
          } else if (
            createdTask.isApprovalTask ||
            createdTask.taskType === "approval"
          ) {
            featureCode = "TASK_APPROVAL";
          } else if (
            createdTask.isMilestone ||
            createdTask.taskType === "milestone"
          ) {
            // Check if milestone has linked tasks
            const hasLinkedTasks =
              (createdTask.linkedTasks && createdTask.linkedTasks.length > 0) ||
              (createdTask.milestoneData?.linkedTaskIds &&
                createdTask.milestoneData.linkedTaskIds.length > 0);
            if (hasLinkedTasks) {
              featureCode = "PROC_CREATE"; // Milestone with linked tasks
            } else {
              featureCode = "TASK_MSTONE"; // Milestone without linked tasks
            }
          }
        }

        console.log(`📊 [USAGE TRACKING] Tracking ${featureCode} usage`);
        console.log(
          "📊 [USAGE TRACKING] Feature from middleware:",
          req.featureUsage?.feature_code,
        );
        console.log("📊 [USAGE TRACKING] Task Type:", createdTask.taskType);
        console.log(
          "📊 [USAGE TRACKING] Is Recurring:",
          createdTask.isRecurring,
        );
        console.log(
          "📊 [USAGE TRACKING] Is Approval:",
          createdTask.isApprovalTask,
        );
        console.log(
          "📊 [USAGE TRACKING] Is Milestone:",
          createdTask.isMilestone,
        );
        console.log("📊 [USAGE TRACKING] User ID:", userId);
        console.log(
          "📊 [USAGE TRACKING] Additional Feature:",
          req.featureUsage?.additional_feature,
        );

        // Use licenseService.consumeFeature for proper usage tracking (USER-LEVEL)
        const consumeResult = await licenseService.consumeFeature(
          userId,
          featureCode,
          1,
        );

        if (consumeResult.success) {
          console.log(
            `✅ [USAGE TRACKING] Successfully tracked ${featureCode} usage. New usage:`,
            consumeResult.usage,
          );
        } else {
          console.warn(
            `⚠️ [USAGE TRACKING] Failed to track ${featureCode} usage:`,
            consumeResult.message,
          );
        }

        // ✅ Also consume PROC_CREATE if milestone has linked tasks
        const additionalFeature = req.featureUsage?.additional_feature;
        if (additionalFeature) {
          console.log(
            `📊 [USAGE TRACKING] Also consuming additional feature: ${additionalFeature}`,
          );
          const additionalConsumeResult = await licenseService.consumeFeature(
            userId,
            additionalFeature,
            1,
          );

          if (additionalConsumeResult.success) {
            console.log(
              `✅ [USAGE TRACKING] Successfully tracked ${additionalFeature} usage. New usage:`,
              additionalConsumeResult.usage,
            );
          } else {
            console.warn(
              `⚠️ [USAGE TRACKING] Failed to track ${additionalFeature} usage:`,
              additionalConsumeResult.message,
            );
          }
        }
      } else {
        console.warn("⚠️ [USAGE TRACKING] No user ID found for usage tracking");
      }
    } catch (trackingError) {
      console.error("❌ [USAGE TRACKING] Error tracking usage:", trackingError);
      console.error("❌ [USAGE TRACKING] Error stack:", trackingError.stack);
      // Don't fail task creation if tracking fails
    }
    console.log("📊 ======= USAGE TRACKING BLOCK END =======\n");

    res.status(201).json({
      success: true,
      message: `${getTaskTypeLabel(parsedTaskData.taskType)} created successfully`,
      task: createdTask,
    });
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create task",
      error: error.message,
    });
  }
};

/**
 * Phase I RBAC: Get Team Tasks for Managers
 * Returns tasks assigned to subordinates (employees under this manager)
 *
 * Access: Manager role only
 * Filter: Tasks where assignedTo is in manager's subordinates list
 *
 * @route GET /api/tasks/team-tasks
 * @access Protected (Manager only)
 */
export const getTeamTasks = async (req, res) => {
  try {
    const user = req.user;
    const {
      status,
      priority,
      page = 1,
      limit = 50,
      search,
      subordinateId, // Optional: filter by specific subordinate
    } = req.query;

    console.log("👥 [GET TEAM TASKS] API Called:", {
      userId: user.id,
      userRole: user.role,
      organizationId: user.organizationId,
      filters: { status, priority, subordinateId },
    });

    // Verify user is a manager
    const userRoles = Array.isArray(user.role) ? user.role : [user.role];
    const isManager = userRoles.includes("manager");
    const isOrgAdmin =
      userRoles.includes("org_admin") || userRoles.includes("company-admin");
    const isTasksetuAdmin =
      userRoles.includes("tasksetu-admin") || userRoles.includes("super-admin");

    if (!isManager && !isOrgAdmin && !isTasksetuAdmin) {
      console.log("❌ [GET TEAM TASKS] Access denied: User is not a manager");
      return res.status(403).json({
        success: false,
        message: "Access denied: Only managers can view team tasks",
      });
    }

    // Get user with subordinates populated
    const User = (await import("../modals/userModal.js")).User;
    const userWithSubordinates = await User.findById(user.id)
      .select("subordinates")
      .lean();

    const subordinates = userWithSubordinates?.subordinates || [];

    console.log("👥 [GET TEAM TASKS] Manager subordinates:", {
      subordinatesCount: subordinates.length,
      subordinateIds: subordinates,
    });

    // Build filter for team tasks
    const filter = {
      isDeleted: { $ne: true },
      isSubtask: { $ne: true }, // Only main tasks
      organization: user.organizationId, // Same organization
    };

    // If a manager or admin, we now show all organization tasks by default
    // "data orgnization ke jitne emplyee h unke basis pr hoga"
    if (isManager || isOrgAdmin || isTasksetuAdmin) {
      console.log(
        "ℹ️ [GET TEAM TASKS] Manager/Admin viewing organization tasks",
      );
    } else {
      // Fallback or additional check for other roles if needed
    }

    // Apply additional filters
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (subordinateId) {
      filter.assignedTo = subordinateId;
    } else if (isManager && !isOrgAdmin && !isTasksetuAdmin) {
      // Optional: If we ONLY want subordinates for non-admin managers
      // by default, we could uncomment this:
      // filter.assignedTo = { $in: [...subordinates, user.id] };
      // But user asked for organization-wide.
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    console.log("🔍 [GET TEAM TASKS] Filter:", filter);

    // Get team tasks using storage layer
    const tasks = await storage.getTasksByFilter(filter, {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
    });

    // Count total tasks for pagination
    const totalTasks = await storage.countTasksByFilter(filter);
    const totalPages = Math.ceil(totalTasks / parseInt(limit));
    const hasNext = parseInt(page) < totalPages;
    const hasPrev = parseInt(page) > 1;

    console.log("✅ [GET TEAM TASKS] Success:", {
      tasksReturned: tasks.length,
      totalTasks,
      currentPage: page,
    });

    res.json({
      success: true,
      message: "Team tasks retrieved successfully",
      data: {
        tasks: tasks,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalTasks,
          hasNextPage: hasNext,
          hasPrevPage: hasPrev,
          limit: parseInt(limit),
        },
        subordinates: subordinates.length, // Additional context
      },
    });
  } catch (error) {
    console.error("❌ [GET TEAM TASKS] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve team tasks",
      error: error.message,
    });
  }
};

export const createSubtask = async (req, res) => {
  try {
    const user = req.user;
    const { parentTaskId } = req.params;
    const taskData = req.body;

    console.log("🚀 createSubtask API called:", {
      parentTaskId,
      userId: user.id,
      userRole: user.role,
      taskDataTitle: taskData.title,
    });

    // ✅ Validate subtask title length
    if (!taskData.title || taskData.title.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Subtask title is required",
      });
    }

    if (taskData.title.length > 60) {
      return res.status(400).json({
        success: false,
        message: "Subtask title cannot exceed 60 characters",
      });
    }

    // 🔹 Validate parent task exists
    const parentTask = await storage.getTaskById(parentTaskId);
    if (!parentTask) {
      return res
        .status(404)
        .json({ success: false, message: "Parent task not found" });
    }

    // ✅ NEW VALIDATION: Milestone tasks cannot have subtasks
    const parentTaskType = (
      parentTask.taskType ||
      parentTask.mainTaskType ||
      ""
    ).toLowerCase();
    if (parentTaskType === "milestone") {
      console.error("❌ Milestone tasks cannot have subtasks");
      return res.status(400).json({
        success: false,
        message:
          "Milestone tasks cannot have subtasks. Please use the main task or create a separate regular task.",
      });
    }

    // 🔹 Role extraction
    const roles = Array.isArray(user.role) ? user.role : [user.role];
    const isTasksetuAdmin =
      roles.includes("tasksetu-admin") || roles.includes("super-admin");
    const isOrgAdmin =
      roles.includes("org_admin") ||
      roles.includes("company-admin") ||
      roles.includes("admin");
    const isManager = roles.includes("manager");
    const isEmployee =
      roles.includes("employee") ||
      roles.includes("user") ||
      roles.includes("normal-user");
    const isIndividual = roles.includes("individual");

    // =====================================================================
    // 📘 Document Ref: 4.2.6, 6.3 — Status-based restrictions
    // =====================================================================
    const allowedStatuses = ["OPEN", "INPROGRESS", "REOPENED"];
    const status = (parentTask.status || "").toUpperCase();

    if (!allowedStatuses.includes(status)) {
      // Managers/Admins may override for ONHOLD
      const isOnHoldAllowed =
        status === "ONHOLD" && (isManager || isOrgAdmin || isTasksetuAdmin);
      if (!isOnHoldAllowed) {
        console.error(
          "❌ Parent task in invalid status for subtask creation:",
          status,
        );
        return res.status(400).json({
          success: false,
          message: `Subtask cannot be created when parent task is ${status}. Only OPEN or INPROGRESS tasks support subtasks.`,
        });
      }
    }

    // =====================================================================
    // 📘 Document Ref: 4.2.2 — Individual user restriction (UPDATED)
    // ✅ Individual users CAN now create subtasks on their OWN tasks
    // =====================================================================
    if (isIndividual) {
      // Allow individual users to create subtasks only on their own tasks
      const parentTaskCreatedById =
        parentTask.createdBy?._id?.toString() ||
        parentTask.createdBy?.toString();
      const userId = user.id?.toString() || user._id?.toString();
      const isOwnTask = parentTaskCreatedById === userId;

      if (!isOwnTask) {
        return res.status(403).json({
          success: false,
          message:
            "Individual users can only create subtasks on their own tasks.",
        });
      }
      // If it's their own task, allow subtask creation - continue to next checks
    }

    // 🚫 CONTRIBUTORS PERMISSION CHECK: Recurring task contributors cannot create subtasks
    if (parentTask.isRecurring && parentTask.contributors) {
      const userId = user.id?.toString() || user._id?.toString();
      const isContributor = parentTask.contributors.some((contributor) => {
        const contribId =
          contributor?._id?.toString() || contributor?.toString();
        return contribId === userId;
      });

      // Also check if they are the assignee or creator
      const parentTaskCreatedById =
        parentTask.createdBy?._id?.toString() ||
        parentTask.createdBy?.toString();
      const parentTaskAssignedTo =
        parentTask.assignedTo?._id?.toString() ||
        parentTask.assignedTo?.toString();
      const isCreatorOrAssignee =
        parentTaskCreatedById === userId || parentTaskAssignedTo === userId;

      if (isContributor && !isCreatorOrAssignee) {
        console.error(
          "❌ Contributors cannot create subtasks on recurring tasks",
        );
        return res.status(403).json({
          success: false,
          message:
            "Access denied: Contributors cannot create subtasks on recurring tasks.",
        });
      }
    }

    // =====================================================================
    // 📘 Document Ref: 4.2.2 — Task Type Restrictions
    // =====================================================================
    if (
      parentTask.taskType === "approval" ||
      parentTask.isApprovalTask === true
    ) {
      return res.status(400).json({
        success: false,
        message: "Subtasks are not allowed for Approval tasks.",
      });
    }

    if (parentTask.taskType === "quick" || parentTask.isQuickTask === true) {
      return res.status(400).json({
        success: false,
        message: "Subtasks are not allowed for Quick tasks.",
      });
    }

    // 🔹 No nested subtasks allowed
    if (parentTask.isSubtask === true || parentTask.parentTaskId) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot create subtask under another subtask. Only 1-level hierarchy allowed.",
      });
    }

    // =====================================================================
    // 📘 Document Ref: 4.3.2 — Milestone Task Restriction (UPDATED)
    // ✅ NEW RULE: Milestone tasks cannot have subtasks at all
    // =====================================================================
    if (
      parentTask.taskType === "milestone" ||
      parentTask.isMilestone === true
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Milestone tasks cannot have subtasks. Milestones are standalone tasks that mark important project points.",
      });
    }

    // =====================================================================
    // 📘 Document Ref: 4.2.6 — Recurring pattern restriction
    // =====================================================================
    if (parentTask.taskType === "recurring" && parentTask.isRecurringPattern) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot create subtask under recurring pattern task. Only recurring instances can have subtasks.",
      });
    }

    // =====================================================================
    // 🔹 Parent Status Validation (Completed / Cancelled)
    // =====================================================================
    if (["DONE", "CANCELLED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot create subtask for ${status} task. Completed or cancelled tasks are locked.`,
      });
    }

    // =====================================================================
    // 📘 Organization-level validation (unchanged)
    // =====================================================================
    let taskOrgId =
      parentTask.organization?._id?.toString() ||
      parentTask.organization?.toString() ||
      null;
    let userOrgId =
      user.organizationId?.toString() || user.organization?.toString() || null;

    if (taskOrgId && !userOrgId) {
      return res.status(403).json({
        success: false,
        message:
          "Cannot create subtask in organization task as individual user.",
      });
    }

    if (!taskOrgId && userOrgId) {
      return res.status(403).json({
        success: false,
        message:
          "Cannot create subtask in individual task from organization account.",
      });
    }

    if (taskOrgId && userOrgId && taskOrgId !== userOrgId) {
      return res.status(403).json({
        success: false,
        message: "Cannot create subtask for task outside your organization.",
      });
    }

    // =====================================================================
    // 📘 Role-based permission checks (updated to allow assignee subtask creation)
    // =====================================================================
    let hasPermission = false;
    const isMilestoneTask =
      parentTask.taskType === "milestone" || parentTask.isMilestone === true;

    // 🔹 Extract IDs properly (handle both ObjectId and populated objects)
    const parentTaskCreatedById =
      parentTask.createdBy?._id?.toString() || parentTask.createdBy?.toString();
    const parentTaskAssignedToId =
      parentTask.assignedTo?._id?.toString() ||
      parentTask.assignedTo?.toString();
    const userId = user.id?.toString();

    const isOwnTask = parentTaskCreatedById === userId;
    const isAssignedToSelf = parentTaskAssignedToId === userId;

    console.log("🔍 Permission check details:", {
      userId: userId,
      parentTaskId: parentTask._id,
      parentTaskType: parentTask.taskType,
      parentTaskCreatedById: parentTaskCreatedById,
      parentTaskAssignedToId: parentTaskAssignedToId,
      isOwnTask,
      isAssignedToSelf,
      isMilestoneTask,
      roles: {
        isTasksetuAdmin,
        isOrgAdmin,
        isManager,
        isEmployee,
        isIndividual,
      },
    });

    // 🔹 Admin/Manager always have permission
    if (isTasksetuAdmin || isOrgAdmin) {
      hasPermission = true;
      console.log("✅ Permission granted: Admin/Super Admin");
    } else if (isManager) {
      const isTeamTask = true; // TODO: implement proper team check
      hasPermission = isOwnTask || isAssignedToSelf || isTeamTask;
      console.log("✅ Permission granted: Manager", {
        isOwnTask,
        isAssignedToSelf,
        isTeamTask,
      });
    } else if (isEmployee) {
      // 🔹 Employees can create subtasks if they own the task or are assigned to it
      // 🔹 For assignees: can create subtasks for regular and recurring tasks only
      if (isMilestoneTask) {
        hasPermission = false; // Milestone tasks cannot have subtasks
        console.log("❌ Permission denied: Milestone task");
      } else {
        hasPermission = isOwnTask || isAssignedToSelf;
        console.log("🔍 Employee permission check:", {
          hasPermission,
          isOwnTask,
          isAssignedToSelf,
        });
      }
    }

    // 🔹 Additional check: Assignees can create subtasks for regular/recurring tasks
    // This ensures assignees (regardless of role) can create subtasks
    if (!hasPermission && isAssignedToSelf) {
      const parentTaskType = (parentTask.taskType || "regular").toLowerCase();
      const isRegularOrRecurring =
        parentTaskType === "regular" || parentTaskType === "recurring";

      console.log("🔍 Assignee fallback check:", {
        parentTaskType,
        isRegularOrRecurring,
        isAssignedToSelf,
      });

      if (isRegularOrRecurring) {
        hasPermission = true;
        console.log(
          "✅ Assignee granted permission to create subtask for regular/recurring task",
        );
      }
    }

    console.log("🎯 Final permission decision:", { hasPermission });

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: You do not have permission to create subtasks for this task.",
      });
    }

    // =====================================================================
    // 🔹 Parse task data (unchanged)
    // =====================================================================
    // 🔹 Parse task data with multi-tier tag parsing
    // =====================================================================
    let parsedTags = [];

    // 🏔️ Milestone tasks and their subtasks DO NOT support tags
    const isMilestoneParent =
      parentTask.taskType === "milestone" || parentTask.isMilestone === true;

    if (!isMilestoneParent && taskData.tags) {
      if (Array.isArray(taskData.tags)) {
        parsedTags = taskData.tags;
      } else if (typeof taskData.tags === "string") {
        try {
          const parsed = JSON.parse(taskData.tags);
          parsedTags = Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
          // Not valid JSON, treat as single tag string
          parsedTags = [taskData.tags];
        }
      }
    }

    const parsedTaskData = {
      ...taskData,
      tags: parsedTags,
      collaboratorIds: taskData.collaboratorIds
        ? JSON.parse(taskData.collaboratorIds)
        : [],
      dependsOnTaskIds: taskData.dependsOnTaskIds
        ? typeof taskData.dependsOnTaskIds === "string"
          ? JSON.parse(taskData.dependsOnTaskIds)
          : taskData.dependsOnTaskIds
        : [],
    };

    // ✅ TAGS INHERITANCE (only for non-milestone tasks)
    if (
      !isMilestoneParent &&
      (!parsedTaskData.tags || parsedTaskData.tags.length === 0)
    ) {
      parsedTaskData.tags = parentTask.tags || [];
    }

    // ✅ DUE DATE VALIDATION
    if (parsedTaskData.dueDate && parentTask.dueDate) {
      const subDue = new Date(parsedTaskData.dueDate);
      const parDue = new Date(parentTask.dueDate);
      if (subDue > parDue) {
        const userTimezone = await TimezoneHelper.getUserTimezone(userId);
        return res.status(400).json({
          success: false,
          message: `Subtask due date (${TimezoneHelper.formatInTimezone(subDue, userTimezone)}) cannot exceed parent task due date (${TimezoneHelper.formatInTimezone(parDue, userTimezone)})`,
        });
      }
    }

    // 🔹 Handle attachments (unchanged)
    let attachments = [];
    if (req.files?.length > 0) {
      attachments = req.files.map((file) => ({
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype,
        url: `/uploads/task-attachments/${file.filename}`,
        uploadedBy: user.id,
        uploadedAt: new Date(),
        version: 1,
        deleted: false,
        // Legacy fields for backward compatibility
        id: Date.now() + Math.random(),
        name: file.originalname,
        type: file.mimetype,
      }));
    }

    // 🔹 Determine createdByRole (unchanged)
    let createdByRole = parsedTaskData.createdByRole;
    if (!createdByRole) {
      const rolePriority = [
        "super_admin",
        "org_admin",
        "manager",
        "employee",
        "individual",
      ];
      createdByRole = Array.isArray(user.role)
        ? user.role.find((r) => rolePriority.includes(r)) || "employee"
        : user.role || "employee";
    }

    // ✅ Dynamic Status Validation for subtasks (organization-scoped)
    const parentOrgId = parentTask.organization || user.organizationId;
    if (parentOrgId) {
      await ensureDefaultTaskStatusConfigs(parentOrgId, user.id);
      await ensureDefaultTaskPriorityConfigs(parentOrgId, user.id);
      const requestedStatus =
        parsedTaskData.status !== undefined && parsedTaskData.status !== null
          ? String(parsedTaskData.status).trim().toUpperCase()
          : "";

      if (requestedStatus) {
        const exists = await TaskStatusConfig.findOne({
          organizationId: parentOrgId,
          code: requestedStatus,
          active: true,
        }).lean();

        if (!exists) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid status. Please select a valid status from the list.",
          });
        }
        parsedTaskData.status = requestedStatus;
      } else {
        // Default to parent's status if set, otherwise org default
        const defaultStatus =
          (parentTask.status
            ? String(parentTask.status).trim().toUpperCase()
            : "") ||
          (
            await TaskStatusConfig.findOne({
              organizationId: parentOrgId,
              isDefault: true,
              active: true,
            })
              .sort({ order: 1, createdAt: 1 })
              .lean()
          )?.code ||
          "OPEN";
        parsedTaskData.status = defaultStatus;
      }
    }

    // ✅ Dynamic Priority Validation for subtasks (organization-scoped)
    if (parentOrgId) {
      const requestedPriority =
        parsedTaskData.priority !== undefined &&
        parsedTaskData.priority !== null
          ? String(parsedTaskData.priority).trim().toLowerCase()
          : "";

      if (requestedPriority) {
        const exists = await TaskPriorityConfig.findOne({
          organizationId: parentOrgId,
          code: requestedPriority,
          active: true,
        }).lean();

        if (!exists) {
          console.error("❌ INVALID SUBTASK PRIORITY ATTEMPT:", {
            requestedPriority,
            userId: user.id,
            parentOrgId,
          });
          return res.status(400).json({
            success: false,
            message: `Invalid priority "${requestedPriority}". Please select a valid priority from the list.`,
          });
        }
        parsedTaskData.priority = requestedPriority;
      } else {
        parsedTaskData.priority = parentTask.priority || "medium";
      }
    }

    // ✅ Construct subtask data
    // 🎨 IMPORTANT: Subtasks inherit parent's taskType for correct color coding
    // isSubtask flag identifies it as a subtask, but taskType determines the color
    const subtaskData = {
      title: parsedTaskData.title,
      description: parsedTaskData.description || "",
      createdBy: user.id,
      createdByRole,
      assignedTo: parsedTaskData.assignedTo || user.id,
      status: parsedTaskData.status || "OPEN",
      priority: parsedTaskData.priority || parentTask.priority || "medium",
      dueDate: parsedTaskData.dueDate ? new Date(parsedTaskData.dueDate) : null,
      startDate: parsedTaskData.startDate
        ? new Date(parsedTaskData.startDate)
        : null,
      taskType: parentTask.taskType, // ✅ INHERIT parent's taskType (regular/milestone/recurring/approval)
      mainTaskType: parentTask.taskType, // Keep for backward compatibility
      parentTaskId,
      tags: parsedTaskData.tags,
      category: parsedTaskData.category || parentTask.category,
      visibility:
        parsedTaskData.visibility || parentTask.visibility || "private",
      collaborators:
        parsedTaskData.collaboratorIds?.length > 0
          ? parsedTaskData.collaboratorIds
          : (parentTask.collaborators || [])
              .map((c) => {
                if (typeof c === "string") return c;
                return (
                  c?._id?.toString?.() ||
                  c?.id?.toString?.() ||
                  c?.toString?.() ||
                  c
                );
              })
              .filter(Boolean),
      dependencies: parsedTaskData.dependsOnTaskIds || [],
      attachments,
      isSubtask: true, // ✅ This flag identifies it as a subtask
      isArchived: false,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (parentTask.organization)
      subtaskData.organization = parentTask.organization;
    if (parentTask.companyId) subtaskData.companyId = parentTask.companyId;

    const createdSubtask = await storage.createTask(subtaskData);
    await recalcUserTaskCounters(createdSubtask?.assignedTo);

    // ✅ DO NOT auto-update parent status when subtask is created
    // Parent should remain in its current state until subtask status changes
    // Business Logic:
    // - If all subtasks are OPEN, parent stays OPEN
    // - Parent only moves to INPROGRESS when at least one subtask is INPROGRESS
    console.log(
      "✅ Subtask created, parent task status remains:",
      parentTask.status,
    );

    // 🎯 Track Activity - Subtask Created
    try {
      await storage.trackActivity({
        activityType: ActivityHelper.ACTIVITY_TYPES.SUBTASK_ADDED,
        userId: user.id,
        organizationId: parentTask.organization,
        relatedId: parentTaskId,
        relatedType: "task",
        data: {
          subtaskId: createdSubtask._id,
          subtaskTitle: createdSubtask.title,
          parentTaskTitle: parentTask.title,
          taskTitle: parentTask.title,
          assignedTo: createdSubtask.assignedTo,
        },
      });
    } catch (activityError) {
      console.error(
        "Failed to track subtask creation activity:",
        activityError,
      );
    }
    // 🔔 Create notification for subtask creation
    try {
      // Notify assignee if different from creator
      if (
        createdSubtask.assignedTo &&
        createdSubtask.assignedTo.toString() !== user.id.toString()
      ) {
        await createTaskNotification(
          TriggerEvent.SUBTASK_ADDED,
          createdSubtask,
          {
            targetUserId: createdSubtask.assignedTo,
            title: "New Subtask Assigned",
            message: `You have been assigned a new subtask: "${createdSubtask.title}"`,
            priority:
              createdSubtask.priority === "urgent" ||
              createdSubtask.priority === "high"
                ? NotificationPriority.URGENT
                : NotificationPriority.NORMAL,
          },
        );
      }

      // Notify parent task assignee if different from subtask creator and assignee
      const parentAssigneeId =
        parentTask.assignedTo?._id?.toString() ||
        parentTask.assignedTo?.toString();
      if (
        parentAssigneeId &&
        parentAssigneeId !== user.id.toString() &&
        parentAssigneeId !== createdSubtask.assignedTo?.toString()
      ) {
        await createTaskNotification(
          TriggerEvent.SUBTASK_ADDED,
          createdSubtask,
          {
            targetUserId: parentAssigneeId,
            title: "Subtask Added to Your Task",
            message: `A new subtask "${createdSubtask.title}" has been added to your task "${parentTask.title}"`,
            priority: NotificationPriority.NORMAL,
          },
        );
      }

      // Notify parent task creator if different from subtask creator, assignee, and parent assignee
      const parentCreatorId =
        parentTask.createdBy?._id?.toString() ||
        parentTask.createdBy?.toString();
      if (
        parentCreatorId &&
        parentCreatorId !== user.id.toString() &&
        parentCreatorId !== createdSubtask.assignedTo?.toString() &&
        parentCreatorId !== parentAssigneeId
      ) {
        await createTaskNotification(
          TriggerEvent.SUBTASK_ADDED,
          createdSubtask,
          {
            targetUserId: parentCreatorId,
            title: "Subtask Added to Your Task",
            message: `A new subtask "${createdSubtask.title}" has been added to task "${parentTask.title}"`,
            priority: NotificationPriority.NORMAL,
          },
        );
      }

      // Notify collaborators about subtask creation
      if (
        createdSubtask.collaborators &&
        createdSubtask.collaborators.length > 0
      ) {
        for (const collaboratorId of createdSubtask.collaborators) {
          if (
            collaboratorId.toString() !== user.id.toString() &&
            collaboratorId.toString() !== createdSubtask.assignedTo?.toString()
          ) {
            await createTaskNotification(
              TriggerEvent.SUBTASK_ADDED,
              createdSubtask,
              {
                targetUserId: collaboratorId,
                title: "Added as Collaborator to Subtask",
                message: `You have been added as a collaborator to subtask: "${createdSubtask.title}"`,
                priority: NotificationPriority.NORMAL,
              },
            );
          }
        }
      }
    } catch (notificationError) {
      console.error("Error creating subtask notifications:", notificationError);
      // Don't fail subtask creation if notification fails
    }

    // 📊 Track TASK_SUB feature usage
    try {
      // ✅ FIXED: Use user_id instead of entity (updated for user-level licensing)
      const userId = req.featureUsage?.user_id || req.user?.id || req.user?._id;

      if (userId) {
        console.log("📊 [USAGE TRACKING] Tracking TASK_SUB usage");
        console.log("📊 [USAGE TRACKING] User ID:", userId);

        // Use licenseService.consumeFeature for proper usage tracking (USER-LEVEL)
        const consumeResult = await licenseService.consumeFeature(
          userId,
          "TASK_SUB",
          1,
        );

        if (consumeResult.success) {
          console.log(
            "✅ [USAGE TRACKING] Successfully tracked TASK_SUB usage. New usage:",
            consumeResult.usage,
          );
        } else {
          console.warn(
            "⚠️ [USAGE TRACKING] Failed to track TASK_SUB usage:",
            consumeResult.message,
          );
        }
      } else {
        console.warn(
          "⚠️ [USAGE TRACKING] No user ID found for TASK_SUB usage tracking",
        );
      }
    } catch (trackingError) {
      console.error(
        "❌ [USAGE TRACKING] Error tracking TASK_SUB usage:",
        trackingError,
      );
      // Don't fail subtask creation if tracking fails
    }

    res.status(201).json({
      success: true,
      message: "Subtask created successfully",
      subtask: createdSubtask,
      parentTask: { _id: parentTask._id, title: parentTask.title },
    });
  } catch (error) {
    console.error("Error creating subtask:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create subtask",
      error: error.message,
    });
  }
};

export const getSubtasks = async (req, res) => {
  try {
    const user = req.user;
    const { parentTaskId } = req.params;
    const { status, priority, page = 1, limit = 50, search } = req.query;

    // Validate parent task exists and user has access
    const parentTask = await storage.getTaskById(parentTaskId);
    if (!parentTask) {
      return res.status(404).json({
        success: false,
        message: "Parent task not found",
      });
    }

    // Check permissions
    if (parentTask.organization && user.organizationId) {
      const taskOrgId = getTaskOrganizationId(parentTask.organization);
      const userOrgId = user.organizationId?.toString() || user.organizationId;

      if (taskOrgId !== userOrgId) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }
    } else if (!parentTask.organization && !user.organizationId) {
      if (
        parentTask.createdBy &&
        user.id &&
        parentTask.createdBy.toString() !== user.id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }
    }

    // Build filter for subtasks
    const filter = {
      parentTaskId: parentTaskId,
      isSubtask: true,
      isDeleted: { $ne: true },
    };

    // Apply additional filters
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Get subtasks
    const subtasks = await storage.getTasksByFilter(filter, {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
    });

    // Count total subtasks for pagination
    const totalSubtasks = await storage.countTasksByFilter(filter);
    const totalPages = Math.ceil(totalSubtasks / parseInt(limit));
    const hasNext = parseInt(page) < totalPages;
    const hasPrev = parseInt(page) > 1;

    res.json({
      success: true,
      message: "Subtasks retrieved successfully",
      data: {
        parentTask: {
          _id: parentTask._id,
          title: parentTask.title,
          status: parentTask.status,
        },
        subtasks: subtasks,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalSubtasks,
          hasNextPage: hasNext,
          hasPrevPage: hasPrev,
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching subtasks:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch subtasks",
      error: error.message,
    });
  }
};

export const updateSubtask = async (req, res) => {
  try {
    const { parentTaskId, subtaskId } = req.params;
    const user = req.user;
    const updates = req.body;
    // Declare roles once at the top
    const roles = Array.isArray(user.role) ? user.role : [user.role];

    // Validate parent task exists and user has access
    const parentTask = await storage.getTaskById(parentTaskId);
    if (!parentTask) {
      return res.status(404).json({
        success: false,
        message: "Parent task not found",
      });
    }

    // ❌ VALIDATION: Parent task is DONE - no subtask edits allowed
    if (parentTask.status === "DONE") {
      console.log(
        "❌ [UPDATE SUBTASK] Parent task is completed, cannot edit subtasks",
      );
      return res.status(400).json({
        success: false,
        message:
          "Parent task is already completed. Subtasks of completed tasks cannot be edited.",
      });
    }

    // Check parent task permissions - Allow individual users to access their own tasks
    const isIndividualUser = roles.includes("individual");

    if (parentTask.organization && user.organizationId) {
      const taskOrgId = getTaskOrganizationId(parentTask.organization);
      const userOrgId = user.organizationId?.toString() || user.organizationId;

      if (taskOrgId !== userOrgId) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }
    } else if (!parentTask.organization && !user.organizationId) {
      // For individual users, allow access if they own the parent task
      const parentTaskCreatorId =
        parentTask.createdBy?._id?.toString() ||
        parentTask.createdBy?.toString();
      const userId = user.id?.toString() || user._id?.toString();

      if (!isIndividualUser && parentTaskCreatorId !== userId) {
        // Non-individual users must own the task
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }
      // Individual users will be checked later in the detailed permission check
    }

    // Get and validate subtask
    const subtask = await storage.getTaskById(subtaskId);
    console.log("--- DEBUG updateSubtask: subtask retrieval ---");
    console.log(
      "subtask:",
      subtask
        ? {
            id: subtask._id,
            title: subtask.title,
            isSubtask: subtask.isSubtask,
            parentTaskId: subtask.parentTaskId,
          }
        : null,
    );
    console.log(
      "parentTaskId param:",
      parentTaskId,
      "type:",
      typeof parentTaskId,
    );
    console.log(
      "subtask.parentTaskId (toString):",
      subtask?.parentTaskId?.toString(),
    );
    // Normalize parent IDs for comparison (handle populated objects or ObjectId)
    const normalizeId = (val) => {
      if (!val) return null;
      if (typeof val === "string") return val;
      if (val._id) return val._id.toString();
      if (val.toString) return val.toString();
      return String(val);
    };

    const subtaskParentIdStr = normalizeId(subtask?.parentTaskId);
    const parentTaskIdStr = normalizeId(parentTaskId);

    console.log("--- DEBUG updateSubtask: parentId comparison ---");
    console.log("subtaskParentIdStr:", subtaskParentIdStr);
    console.log("parentTaskIdStr:", parentTaskIdStr);

    if (
      !subtask ||
      !subtask.isSubtask ||
      !subtaskParentIdStr ||
      subtaskParentIdStr !== parentTaskIdStr
    ) {
      return res.status(404).json({
        success: false,
        message: "Subtask not found or does not belong to this parent task",
      });
    }

    // 🔹 Role-based permission check for updating subtask
    const isTasksetuAdmin =
      roles.includes("tasksetu-admin") || roles.includes("super-admin");
    const isOrgAdmin =
      roles.includes("org_admin") ||
      roles.includes("company-admin") ||
      roles.includes("admin");
    const isManager = roles.includes("manager");
    const isEmployee =
      roles.includes("employee") ||
      roles.includes("user") ||
      roles.includes("normal-user");
    const isIndividual = roles.includes("individual");

    // 🔹 Extract IDs properly (handle both ObjectId and populated objects)
    const subtaskCreatedById =
      subtask.createdBy?._id?.toString() || subtask.createdBy?.toString();
    const subtaskAssignedToId =
      subtask.assignedTo?._id?.toString() || subtask.assignedTo?.toString();
    const parentTaskAssignedToId =
      parentTask.assignedTo?._id?.toString() ||
      parentTask.assignedTo?.toString();
    const parentTaskCreatedById =
      parentTask.createdBy?._id?.toString() || parentTask.createdBy?.toString();
    const userId = user.id?.toString() || user._id?.toString();

    const isOwnSubtask = subtaskCreatedById === userId;
    const isAssignedToSelf = subtaskAssignedToId === userId;
    const isParentAssignee = parentTaskAssignedToId === userId;
    const isParentOwner = parentTaskCreatedById === userId;

    console.log("DEBUG - updateSubtask permission check:", {
      userId,
      userIdSource: user.id ? "user.id" : "user._id",
      isIndividual,
      isEmployee,
      isManager,
      isOrgAdmin,
      isTasksetuAdmin,
      subtaskCreatedById,
      subtaskAssignedToId,
      parentTaskCreatedById,
      parentTaskAssignedToId,
      isOwnSubtask,
      isAssignedToSelf,
      isParentOwner,
      isParentAssignee,
    });

    let hasUpdatePermission = false;

    // Admin/Manager always have permission
    if (isTasksetuAdmin || isOrgAdmin || isManager) {
      hasUpdatePermission = true;
      console.log("DEBUG - Permission granted: Admin/Manager");
    }
    // Individual users can update subtasks if they own parent task, created subtask, or are assigned to subtask
    else if (isIndividual) {
      hasUpdatePermission =
        isParentOwner || isParentAssignee || isOwnSubtask || isAssignedToSelf;
      console.log("DEBUG - Individual user permission check:", {
        isParentOwner,
        isParentAssignee,
        isOwnSubtask,
        isAssignedToSelf,
        hasUpdatePermission,
      });
    }
    // Employees and assignees can update their own subtasks or subtasks assigned to them
    else if (isEmployee || isParentAssignee) {
      hasUpdatePermission =
        isOwnSubtask || isAssignedToSelf || isParentAssignee;
      console.log("DEBUG - Employee permission check:", {
        isOwnSubtask,
        isAssignedToSelf,
        isParentAssignee,
        hasUpdatePermission,
      });
    }

    console.log("DEBUG - Final permission result:", { hasUpdatePermission });

    if (!hasUpdatePermission) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: You do not have permission to update this subtask.",
      });
    }

    // Track previous assignee for counter adjustments
    const prevAssignee = subtask.assignedTo?.toString();

    // Prepare update data - map 'assignee' to 'assignedTo' if present
    const updateData = {
      ...updates,
      updatedAt: new Date(),
    };

    // Handle field name mapping: frontend sends 'assignee', backend uses 'assignedTo'
    if (updates.assignee) {
      // Validate if assignee is a valid ObjectId or 'self'
      if (updates.assignee === "self") {
        updateData.assignedTo = user.id; // Assign to current user
      } else if (mongoose.Types.ObjectId.isValid(updates.assignee)) {
        updateData.assignedTo = updates.assignee; // Already a valid ObjectId
      } else {
        // Invalid assignee value - reject with clear error
        return res.status(400).json({
          success: false,
          message:
            'Invalid assignee value. Expected a valid user ID or "self".',
          error: `Received: "${updates.assignee}" (type: ${typeof updates.assignee})`,
        });
      }
      delete updateData.assignee; // Remove the old field name
    }

    // Parse dueDate/startDate treating no-timezone strings as UTC
    const parseDueDateAsUTCSub = (dateStr) => {
      if (!dateStr) return null;
      const str = String(dateStr).trim();
      const hasTimezone = /[Zz]$|(T\d{2}:\d{2}(:\d{2})?(\.[0-9]+)?[+-]\d{2}:?\d{2})$/.test(str);
      const normalised = hasTimezone ? str : str + 'Z';
      const d = new Date(normalised);
      return isNaN(d.getTime()) ? null : d;
    };
    if (updates.dueDate) updateData.dueDate = parseDueDateAsUTCSub(updates.dueDate);
    if (updates.startDate) updateData.startDate = parseDueDateAsUTCSub(updates.startDate);

    // 📎 Handle attachments - merge new files with existing attachments
    if (req.files && req.files.length > 0) {
      // Get existing attachments (excluding ones marked for removal)
      const existingAttachments = subtask.attachments
        ? subtask.attachments.filter((att) => att && !att.deleted)
        : [];

      // Process new uploaded files
      const newAttachments = req.files.map((file) => ({
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype,
        url: `/uploads/task-attachments/${file.filename}`,
        uploadedBy: user.id,
        uploadedAt: new Date(),
        version: 1,
        deleted: false,
        // Legacy fields for backward compatibility
        id: Date.now() + Math.random(),
        name: file.originalname,
        type: file.mimetype,
      }));

      console.log("📎 [UPDATE SUBTASK] Processing attachments:", {
        existingCount: existingAttachments.length,
        newCount: newAttachments.length,
        totalAfterMerge: existingAttachments.length + newAttachments.length,
      });

      // If existingAttachments are provided in update body, parse them
      let attachmentsToKeep = existingAttachments;
      if (updates.existingAttachments) {
        // existingAttachments is an array of URLs/names to keep
        const urlsToKeep = Array.isArray(updates.existingAttachments)
          ? updates.existingAttachments
          : [updates.existingAttachments];

        attachmentsToKeep = existingAttachments.filter(
          (att) =>
            urlsToKeep.includes(att.url) ||
            urlsToKeep.includes(att.name) ||
            urlsToKeep.includes(att.originalName),
        );

        console.log("📎 [UPDATE SUBTASK] Kept existing attachments:", {
          totalBefore: existingAttachments.length,
          totalAfterFilter: attachmentsToKeep.length,
          removed: existingAttachments.length - attachmentsToKeep.length,
        });
      }

      // Merge existing (kept) with new attachments
      updateData.attachments = [...attachmentsToKeep, ...newAttachments];
    } else if (updates.existingAttachments) {
      // No new files, but we need to filter existing ones
      const existingAttachments = subtask.attachments
        ? subtask.attachments.filter((att) => att && !att.deleted)
        : [];

      const urlsToKeep = Array.isArray(updates.existingAttachments)
        ? updates.existingAttachments
        : [updates.existingAttachments];

      const attachmentsToKeep = existingAttachments.filter(
        (att) =>
          urlsToKeep.includes(att.url) ||
          urlsToKeep.includes(att.name) ||
          urlsToKeep.includes(att.originalName),
      );

      console.log("📎 [UPDATE SUBTASK] Filtered existing attachments:", {
        totalBefore: existingAttachments.length,
        totalAfter: attachmentsToKeep.length,
      });

      updateData.attachments = attachmentsToKeep;
    }

    // Remove existingAttachments from updateData (it's not a DB field)
    delete updateData.existingAttachments;

    // Update subtask
    const updatedSubtask = await storage.updateTask(
      subtaskId,
      updateData,
      user.id,
    );

    // Recalculate counters for affected users (old and new assignee if changed)
    const newAssignee =
      updates.assignedTo || updatedSubtask?.assignedTo || prevAssignee;
    await recalcUserTaskCounters(prevAssignee);
    await recalcUserTaskCounters(newAssignee);

    // 🔄 Auto-update parent task status based on subtask status changes
    let updatedParentTask = parentTask;
    if (updates.status) {
      // Get all subtasks of parent task
      const allSubtasks = await Task.find({
        parentTaskId: parentTaskId,
        isSubtask: true,
        isDeleted: false,
      });

      console.log("🔍 Checking subtasks for parent status update:", {
        parentTaskId,
        totalSubtasks: allSubtasks.length,
        updatedSubtaskStatus: updates.status,
      });

      // Check if all subtasks are OPEN (not started)
      const allSubtasksOpen =
        allSubtasks.length > 0 &&
        allSubtasks.every((st) => st.status === "OPEN");

      // Check if any subtask is INPROGRESS, ONHOLD
      const hasInProgressSubtask = allSubtasks.some(
        (st) => st.status === "INPROGRESS" || st.status === "ONHOLD",
      );

      // Check if all subtasks are completed (DONE or CANCELLED)
      const allSubtasksCompleted =
        allSubtasks.length > 0 &&
        allSubtasks.every(
          (st) => st.status === "DONE" || st.status === "CANCELLED",
        );

      let newParentStatus = null;

      if (allSubtasksCompleted) {
        // All subtasks are done/cancelled -> Mark parent as DONE
        newParentStatus = "DONE";
        console.log("✅ All subtasks completed, setting parent to DONE");
      } else if (allSubtasksOpen) {
        // All subtasks are still OPEN -> Keep parent as OPEN
        newParentStatus = "OPEN";
        console.log("📋 All subtasks are OPEN, setting parent to OPEN");
      } else if (hasInProgressSubtask) {
        // At least one subtask is in progress or on hold -> Mark parent as INPROGRESS
        newParentStatus = "INPROGRESS";
        console.log(
          "🔄 At least one subtask in progress, setting parent to INPROGRESS",
        );
      }

      // Update parent task status if needed
      if (newParentStatus && parentTask.status !== newParentStatus) {
        console.log("📝 Updating parent task status:", {
          from: parentTask.status,
          to: newParentStatus,
        });

        const parentUpdateData = {
          status: newParentStatus,
          updatedAt: new Date(),
        };

        // If marking parent as DONE, add completion fields
        if (newParentStatus === "DONE") {
          parentUpdateData.completedDate = new Date();
          parentUpdateData.completedBy = user.id;
        }

        updatedParentTask = await storage.updateTask(
          parentTaskId,
          parentUpdateData,
          user.id,
        );

        console.log(
          "✅ Parent task status updated successfully to:",
          newParentStatus,
        );
      }
    }

    // Get fresh parent task with populated fields
    const freshParentTask = await Task.findById(parentTaskId)
      .populate("assignedTo", "firstName lastName email")
      .populate("createdBy", "firstName lastName email");

    // 🎯 Track Activity - Subtask Updated
    try {
      const changedFields = [];
      if (updateData.title) changedFields.push("title");
      if (updateData.status) changedFields.push("status");
      if (updateData.priority) changedFields.push("priority");
      if (updateData.assignedTo) changedFields.push("assignedTo");

      await storage.trackActivity({
        activityType:
          updateData.status === "DONE"
            ? ActivityHelper.ACTIVITY_TYPES.SUBTASK_COMPLETED
            : ActivityHelper.ACTIVITY_TYPES.SUBTASK_UPDATED,
        userId: user.id,
        organizationId: parentTask.organization,
        relatedId: parentTaskId,
        relatedType: "task",
        data: {
          subtaskId: subtaskId,
          subtaskTitle: updatedSubtask.title,
          parentTaskTitle: parentTask.title,
          taskTitle: parentTask.title,
          changedFields: changedFields,
          oldValue: subtask.status,
          newValue: updateData.status || subtask.status,
        },
      });
    } catch (activityError) {
      console.error("Failed to track subtask update activity:", activityError);
    }

    // 🔔 Send notifications for subtask updates
    try {
      // If subtask was completed, notify relevant parties
      if (updateData.status === "DONE" || updateData.status === "completed") {
        // Notify parent task assignee if different from updater
        const parentAssigneeId =
          parentTask.assignedTo?._id?.toString() ||
          parentTask.assignedTo?.toString();
        if (parentAssigneeId && parentAssigneeId !== user.id.toString()) {
          await createTaskNotification(
            TriggerEvent.SUBTASK_COMPLETED,
            updatedSubtask,
            {
              targetUserId: parentAssigneeId,
              title: "Subtask Completed",
              message: `Subtask "${updatedSubtask.title}" has been completed in task "${parentTask.title}"`,
              priority: NotificationPriority.NORMAL,
              metadata: {
                parentTaskId: parentTaskId,
                parentTaskTitle: parentTask.title,
              },
            },
          );
        }

        // Notify parent task creator if different from assignee and updater
        const parentCreatorId =
          parentTask.createdBy?._id?.toString() ||
          parentTask.createdBy?.toString();
        if (
          parentCreatorId &&
          parentCreatorId !== user.id.toString() &&
          parentCreatorId !== parentAssigneeId
        ) {
          await createTaskNotification(
            TriggerEvent.SUBTASK_COMPLETED,
            updatedSubtask,
            {
              targetUserId: parentCreatorId,
              title: "Subtask Completed",
              message: `Subtask "${updatedSubtask.title}" has been completed in task "${parentTask.title}"`,
              priority: NotificationPriority.NORMAL,
              metadata: {
                parentTaskId: parentTaskId,
                parentTaskTitle: parentTask.title,
              },
            },
          );
        }
        console.log(
          `🔔 Subtask completion notifications sent for: ${updatedSubtask.title}`,
        );
      }
    } catch (notificationError) {
      console.error(
        "Failed to send subtask notification:",
        notificationError.message,
      );
      // Don't fail the update if notification fails
    }

    res.json({
      success: true,
      message: "Subtask updated successfully",
      data: {
        subtask: updatedSubtask,
        parentTask: freshParentTask || updatedParentTask || parentTask,
        parentStatusUpdated:
          updatedParentTask && updatedParentTask.status !== parentTask.status,
      },
    });
  } catch (error) {
    console.error("Error updating subtask:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update subtask",
      error: error.message,
    });
  }
};

export const deleteSubtask = async (req, res) => {
  try {
    const { parentTaskId, subtaskId } = req.params;
    const user = req.user;

    console.log("=== DELETE SUBTASK DEBUG ===");
    console.log("Parent Task ID:", parentTaskId);
    console.log("Subtask ID to delete:", subtaskId);
    console.log("User attempting delete:", {
      id: user.id,
      organizationId: user.organizationId,
    });

    // Validate parent task exists and user has access
    const parentTask = await storage.getTaskById(parentTaskId);
    if (!parentTask) {
      console.log("Parent task not found");
      return res.status(404).json({
        success: false,
        message: "Parent task not found",
      });
    }

    console.log("Found parent task:", {
      id: parentTask._id,
      title: parentTask.title,
      organization: parentTask.organization,
    });

    // Check basic organization permissions (for org users only)
    if (parentTask.organization && user.organizationId) {
      const taskOrgId = getTaskOrganizationId(parentTask.organization);
      const userOrgId = user.organizationId?.toString() || user.organizationId;
      console.log("Organization check:", {
        taskOrgId,
        userOrgId,
        match: taskOrgId === userOrgId,
      });

      if (taskOrgId !== userOrgId) {
        console.log("Access denied: Organization mismatch");
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }
    }
    // For individual users, don't block here - let role-based checks below handle it
    // Individual users can delete their own subtasks even if they don't own the parent task

    // Get and validate subtask
    const subtask = await storage.getTaskById(subtaskId);
    console.log(
      "Found subtask:",
      subtask
        ? {
            id: subtask._id,
            title: subtask.title,
            parentTaskId: subtask.parentTaskId,
            isSubtask: subtask.isSubtask,
            isDeleted: subtask.isDeleted,
          }
        : "Not found",
    );

    // Extract parent task ID - handle both ObjectId and populated object
    const subtaskParentId =
      subtask?.parentTaskId?._id?.toString() ||
      subtask?.parentTaskId?.toString();

    if (!subtask || !subtask.isSubtask || subtaskParentId !== parentTaskId) {
      console.log("Subtask validation failed:", {
        subtaskExists: !!subtask,
        isSubtask: subtask?.isSubtask,
        subtaskParentId,
        requestedParentId: parentTaskId,
        idsMatch: subtaskParentId === parentTaskId,
      });
      return res.status(404).json({
        success: false,
        message: "Subtask not found or does not belong to this parent task",
      });
    }

    // 🔹 Role-based permission check for updating subtask
    const roles = Array.isArray(user.role) ? user.role : [user.role];
    const isTasksetuAdmin =
      roles.includes("tasksetu-admin") || roles.includes("super-admin");
    const isOrgAdmin =
      roles.includes("org_admin") ||
      roles.includes("company-admin") ||
      roles.includes("admin");
    const isManager = roles.includes("manager");
    const isEmployee =
      roles.includes("employee") ||
      roles.includes("user") ||
      roles.includes("normal-user");
    const isIndividual = roles.includes("individual");

    // 🔹 Extract IDs properly (handle both ObjectId and populated objects)
    const subtaskCreatedById =
      subtask.createdBy?._id?.toString() || subtask.createdBy?.toString();
    const subtaskAssignedToId =
      subtask.assignedTo?._id?.toString() || subtask.assignedTo?.toString();
    const parentTaskAssignedToId =
      parentTask.assignedTo?._id?.toString() ||
      parentTask.assignedTo?.toString();
    const parentTaskCreatedById =
      parentTask.createdBy?._id?.toString() || parentTask.createdBy?.toString();
    const userId = user.id?.toString();

    const isOwnSubtask = subtaskCreatedById === userId;
    const isAssignedToSelf = subtaskAssignedToId === userId;
    const isParentAssignee = parentTaskAssignedToId === userId;
    const isParentOwner = parentTaskCreatedById === userId;

    let hasDeletePermission = false;

    // Admin/Manager always have permission
    if (isTasksetuAdmin || isOrgAdmin || isManager) {
      hasDeletePermission = true;
    }
    // Individual users can delete subtasks on their own parent task OR subtasks they created
    else if (isIndividual) {
      hasDeletePermission = isParentOwner || isOwnSubtask;
      console.log("DEBUG - Individual user delete permission check:", {
        isParentOwner,
        isOwnSubtask,
        hasDeletePermission,
      });
    }
    // Employees and assignees can delete their own subtasks only (not subtasks assigned to them)
    else if (isEmployee || isParentAssignee) {
      hasDeletePermission = isOwnSubtask; // Only creator can delete
    }

    if (!hasDeletePermission) {
      return res.status(403).json({
        success: false,
        message: "Access denied: You can only delete subtasks you created.",
      });
    }

    // Status validation: subtask must be OPEN, ONHOLD, or CANCELLED
    const DELETABLE_SUBTASK_STATUSES = ["OPEN", "ONHOLD", "CANCELLED"];
    if (
      subtask.status &&
      !DELETABLE_SUBTASK_STATUSES.includes(subtask.status)
    ) {
      console.log("❌ Subtask status check failed:", subtask.status);
      return res.status(400).json({
        success: false,
        message: `Cannot delete subtask with status "${subtask.status}". Only subtasks with status OPEN, ONHOLD or CANCELLED can be deleted.`,
      });
    }

    console.log("Permissions passed, proceeding with soft delete...");

    // Keep assignee for counter recalculation
    const assignee = subtask?.assignedTo;

    // Soft delete subtask
    const updateResult = await storage.updateTask(
      subtaskId,
      {
        isDeleted: true,
        deletedBy: user.id,
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
      user.id,
    );

    // Activity feed: "Subtask deleted by {User} on {Date}"
    try {
      await ActivityHelper.logActivity({
        activityType: ActivityHelper.ACTIVITY_TYPES.SUBTASK_DELETED,
        user: user.id,
        organization: subtask.organization || null,
        relatedId: parentTaskId,
        relatedType: "task",
        data: {
          taskTitle: subtask.title,
          subtaskId: subtaskId,
          parentTaskId: parentTaskId,
          deletedBy: user.email || user.name || user.id,
          deletedAt: new Date().toISOString(),
        },
      });
    } catch (actErr) {
      console.error("Failed to log subtask delete activity:", actErr);
    }

    console.log("Subtask soft delete result:", updateResult);
    console.log("=== DELETE SUBTASK COMPLETE ===");

    // Recalculate counters for subtask assignee after delete
    await recalcUserTaskCounters(assignee);

    // 🔄 Auto-update parent task status after subtask deletion
    // Get all remaining non-deleted subtasks
    const remainingSubtasks = await Task.find({
      parentTaskId: parentTaskId,
      isSubtask: true,
      isDeleted: false,
    });

    console.log("🔍 Checking remaining subtasks after deletion:", {
      parentTaskId,
      remainingCount: remainingSubtasks.length,
    });

    if (remainingSubtasks.length === 0) {
      // No more subtasks, revert parent to OPEN
      if (parentTask.status === "INPROGRESS" || parentTask.status === "DONE") {
        console.log("✅ No remaining subtasks, reverting parent to OPEN");
        await storage.updateTask(
          parentTaskId,
          {
            status: "OPEN",
            updatedAt: new Date(),
          },
          user.id,
        );
      }
    } else {
      // Check status of remaining subtasks
      const allOpen = remainingSubtasks.every((st) => st.status === "OPEN");
      const allCompleted = remainingSubtasks.every(
        (st) => st.status === "DONE" || st.status === "CANCELLED",
      );
      const hasInProgress = remainingSubtasks.some(
        (st) => st.status === "INPROGRESS" || st.status === "ONHOLD",
      );

      if (allCompleted && parentTask.status !== "DONE") {
        // All remaining subtasks are done, mark parent as DONE
        console.log(
          "✅ All remaining subtasks completed, marking parent as DONE",
        );
        await storage.updateTask(
          parentTaskId,
          {
            status: "DONE",
            completedDate: new Date(),
            completedBy: user.id,
            updatedAt: new Date(),
          },
          user.id,
        );
      } else if (allOpen && parentTask.status !== "OPEN") {
        // All remaining subtasks are OPEN, mark parent as OPEN
        console.log(
          "📋 All remaining subtasks are OPEN, marking parent as OPEN",
        );
        await storage.updateTask(
          parentTaskId,
          {
            status: "OPEN",
            updatedAt: new Date(),
          },
          user.id,
        );
      } else if (hasInProgress && parentTask.status === "OPEN") {
        // At least one subtask in progress, mark parent as INPROGRESS
        console.log(
          "🔄 At least one subtask in progress, marking parent as INPROGRESS",
        );
        await storage.updateTask(
          parentTaskId,
          {
            status: "INPROGRESS",
            updatedAt: new Date(),
          },
          user.id,
        );
      }
    }

    // 🎯 Track Activity - Subtask Deleted
    try {
      await storage.trackActivity({
        activityType: ActivityHelper.ACTIVITY_TYPES.SUBTASK_DELETED,
        userId: user.id,
        organizationId: parentTask.organization,
        relatedId: parentTaskId,
        relatedType: "task",
        data: {
          subtaskId: subtaskId,
          subtaskTitle: subtask.title,
          parentTaskTitle: parentTask.title,
          taskTitle: parentTask.title,
        },
      });
    } catch (activityError) {
      console.error(
        "Failed to track subtask deletion activity:",
        activityError,
      );
    }

    res.json({
      success: true,
      message: "Subtask deleted successfully",
      data: {
        deletedSubtaskId: subtaskId,
        parentTask: {
          _id: parentTask._id,
          title: parentTask.title,
        },
      },
    });
  } catch (error) {
    console.error("Error deleting subtask:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete subtask",
      error: error.message,
    });
  }
};

// Subtask Comment Functions
export const addSubtaskComment = async (req, res) => {
  try {
    const { parentTaskId, subtaskId } = req.params;
    let { content, comment, mentions, parentId } = req.body;
    const user = req.user;

    // Parse mentions if it comes as JSON string from FormData
    if (typeof mentions === "string") {
      try {
        mentions = JSON.parse(mentions);
      } catch (e) {
        console.log("⚠️ Failed to parse mentions, using as is:", mentions);
      }
    }

    // Handle both 'content' and 'comment' fields for compatibility
    const commentContent = content || comment;

    console.log("🔍 [BACKEND] Step 1: addSubtaskComment called");
    console.log("📦 [BACKEND] Step 2: Request Params:", {
      parentTaskId,
      subtaskId,
    });
    console.log("📌 [BACKEND] Step 3: Param Types:", {
      parentTaskIdType: typeof parentTaskId,
      subtaskIdType: typeof subtaskId,
      parentTaskIdValue: JSON.stringify(parentTaskId),
      subtaskIdValue: JSON.stringify(subtaskId),
    });
    console.log("📋 [BACKEND] Step 4: Request Body:", req.body);
    console.log("👤 [BACKEND] Step 5: User:", {
      userId: user.id,
      userName: user.name || user.username,
    });
    console.log("💬 [BACKEND] Step 6: Comment Content:", commentContent);
    if (!commentContent || commentContent.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Comment content is required",
      });
    }

    // Get parent task to check permissions
    const parentTask = await storage.getTaskById(parentTaskId);
    if (!parentTask) {
      return res.status(404).json({
        success: false,
        message: "Parent task not found",
      });
    }

    // Get subtask to validate it exists and belongs to parent (without populating comments)
    const Task = (await import("../models.js")).Task;
    const subtask = await Task.findById(subtaskId).select("_id title");
    if (!subtask) {
      return res.status(404).json({
        success: false,
        message: "Subtask not found",
      });
    }

    // Check if user has permission to comment
    const canComment = checkCommentPermission(user, parentTask);
    if (!canComment) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to comment on this subtask",
      });
    }

    // Process mentions - extract user IDs from mention objects
    let mentionUserIds = [];
    if (mentions && Array.isArray(mentions)) {
      mentionUserIds = mentions
        .map((m) => {
          // Handle both object format {id: "..."} and string format "userId"
          if (typeof m === "string") return m;
          if (m && m.id) return m.id;
          return null;
        })
        .filter(Boolean); // Remove any null/undefined values

      console.log("DEBUG - Processed subtask mentions:", {
        receivedMentions: mentions,
        extractedUserIds: mentionUserIds,
        count: mentionUserIds.length,
      });
    }

    // Handle file attachments if present
    const attachments = [];
    if (req.files && req.files.length > 0) {
      console.log(
        "📎 Processing subtask comment attachments:",
        req.files.length,
      );
      for (const file of req.files) {
        attachments.push({
          id:
            new Date().getTime().toString() +
            "-" +
            Math.random().toString(36).substr(2, 9),
          name: file.originalname,
          filename: file.filename,
          size: file.size,
          type: file.mimetype,
          url: `/uploads/task-attachments/${file.filename}`,
        });
      }
    }

    // Create comment object for MongoDB - use ObjectId for author and mentions
    const mongoose = (await import("mongoose")).default;
    const newComment = {
      _id: new Date().getTime().toString(),
      text: commentContent.trim(),
      content: commentContent.trim(),
      author: new mongoose.Types.ObjectId(user.id), // Convert to ObjectId
      mentions: mentionUserIds.map((id) => new mongoose.Types.ObjectId(id)), // Convert each to ObjectId
      parentId: parentId ? parentId.toString() : null,
      attachments: attachments,
      createdAt: new Date(),
      updatedAt: new Date(),
      isEdited: false,
    };

    console.log("DEBUG - Creating subtask comment with data:", {
      ...newComment,
      author: newComment.author.toString(),
      mentions: newComment.mentions.map((m) => m.toString()),
    });

    // Add comment to subtask using $push (avoids population issues)
    await Task.findByIdAndUpdate(
      subtaskId,
      { $push: { comments: newComment } },
      { new: true },
    );

    console.log("DEBUG - Subtask comment added successfully");

    // 🎯 Track Activity - Subtask Comment Added (tracked on parent task)
    try {
      await storage.trackActivity({
        activityType: parentId
          ? ActivityHelper.ACTIVITY_TYPES.COMMENT_REPLIED
          : ActivityHelper.ACTIVITY_TYPES.COMMENT_ADDED,
        userId: user.id,
        organizationId: parentTask.organization,
        relatedId: parentTaskId, // Track on parent task
        relatedType: "task",
        data: {
          commentId: newComment._id,
          commentPreview: commentContent.trim().substring(0, 100),
          isReply: !!parentId,
          parentCommentId: parentId || null,
          subtaskId: subtaskId,
          subtaskTitle: subtask.title,
          taskTitle: parentTask.title,
        },
      });
    } catch (activityError) {
      console.error("Failed to track subtask comment activity:", activityError);
    }

    // Fetch the comment with populated author and mentions for response
    const User = (await import("../modals/userModal.js")).User;
    const populatedAuthor = await User.findById(user.id).select(
      "_id email firstName lastName role department designation",
    );

    let populatedMentions = [];
    if (mentionUserIds.length > 0) {
      populatedMentions = await User.find({ _id: { $in: mentionUserIds } })
        .select("_id email firstName lastName role department designation")
        .lean();
    }

    // Format the response comment with full user objects
    const responseComment = {
      _id: newComment._id,
      text: newComment.text,
      content: newComment.content,
      author: {
        _id: populatedAuthor._id,
        email: populatedAuthor.email,
        firstName: populatedAuthor.firstName,
        lastName: populatedAuthor.lastName,
        role: populatedAuthor.role,
        department: populatedAuthor.department,
        designation: populatedAuthor.designation,
      },
      mentions: populatedMentions.map((m) => ({
        id: m._id.toString(),
        name: `${m.firstName} ${m.lastName}`.trim() || m.email,
        firstName: m.firstName,
        lastName: m.lastName,
        email: m.email,
        role: m.role,
        department: m.department,
        designation: m.designation,
      })),
      parentId: newComment.parentId,
      createdAt: newComment.createdAt,
      updatedAt: newComment.updatedAt,
      isEdited: newComment.isEdited,
    };

    console.log("DEBUG - Subtask comment added successfully");

    // 🔔 Create notification for subtask comment with enhanced logging
    try {
      const plainTextComment = stripHtml(commentContent);

      NotificationLogger.logCommentAddition(
        "NOTIFICATION_START",
        {
          subtaskId,
          parentTaskId,
          commentedBy: user.id,
          commentPreview: plainTextComment.substring(0, 50),
        },
        "START",
      );

      // Use enhanced notification helper for comment notifications
      await EnhancedNotificationHelper.notifyComment(
        parentTask,
        newComment,
        user.id,
      );

      NotificationLogger.logCommentAddition(
        "NOTIFICATION_SUCCESS",
        {
          subtaskId,
          commentId: newComment._id,
        },
        "SUCCESS",
      );
    } catch (notificationError) {
      console.error(
        "Error creating subtask comment notifications:",
        notificationError,
      );
      NotificationLogger.logCommentAddition(
        "NOTIFICATION_ERROR",
        {
          error: notificationError.message,
        },
        "ERROR",
      );
      // Don't fail comment creation if notification fails
    }

    res.status(201).json({
      success: true,
      message: "Subtask comment added successfully",
      data: responseComment,
    });
  } catch (error) {
    console.error("Error adding subtask comment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add subtask comment",
      error: error.message,
    });
  }
};

export const getSubtaskComments = async (req, res) => {
  try {
    const { parentTaskId, subtaskId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const user = req.user;

    console.log("DEBUG - getSubtaskComments called:", {
      parentTaskId,
      subtaskId,
      userId: user.id,
    });

    // Get parent task to check permissions
    const parentTask = await storage.getTaskById(parentTaskId);
    if (!parentTask) {
      return res.status(404).json({
        success: false,
        message: "Parent task not found",
      });
    }

    // Get subtask to validate it exists
    const subtask = await storage.getTaskById(subtaskId);
    if (!subtask) {
      return res.status(404).json({
        success: false,
        message: "Subtask not found",
      });
    }

    // Check if user has permission to view comments
    const canComment = checkCommentPermission(user, parentTask);
    if (!canComment) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Get comments from MongoDB subtask with populated author and mentions
    let populatedSubtask;
    try {
      populatedSubtask = await Task.findById(subtaskId)
        .populate({
          path: "comments.author",
          model: "User",
          select: "firstName lastName email",
        })
        .populate({
          path: "comments.mentions",
          model: "User",
          select: "firstName lastName email role department designation",
        })
        .lean() // ✅ Use lean() to get plain objects with attachments
        .exec();
    } catch (populateError) {
      console.error("DEBUG - Subtask population failed:", populateError);
      populatedSubtask = null;
    }

    const comments = populatedSubtask?.comments || subtask.comments || [];

    console.log("DEBUG - Found subtask comments:", comments.length);

    // Process comments to format mentions and nest replies
    const processedComments = comments.map((comment) => {
      const text = comment.content || comment.text || "[Content not available]";

      // Handle author
      let authorInfo;
      if (
        comment.author &&
        typeof comment.author === "object" &&
        comment.author.firstName
      ) {
        authorInfo = {
          _id: comment.author._id,
          firstName: comment.author.firstName || "Unknown",
          lastName: comment.author.lastName || "User",
          email: comment.author.email || "",
        };
      } else {
        authorInfo = {
          _id: comment.author,
          firstName: "Unknown",
          lastName: "User",
          email: "",
        };
      }

      // Process mentions
      let mentionsInfo = [];
      if (comment.mentions && Array.isArray(comment.mentions)) {
        mentionsInfo = comment.mentions
          .map((mention) => {
            if (mention && typeof mention === "object" && mention.firstName) {
              return {
                id: mention._id.toString(),
                name: `${mention.firstName} ${mention.lastName}`.trim(),
                firstName: mention.firstName,
                lastName: mention.lastName,
                email: mention.email || "",
                role: mention.role || [],
                department: mention.department || "",
                designation: mention.designation || "",
              };
            }
            return mention;
          })
          .filter(Boolean);
      }

      // Extract attachments - with lean() we get direct access
      const attachmentsData = comment.attachments || [];

      return {
        _id: comment._id,
        text: text,
        content: text,
        author: authorInfo,
        mentions: mentionsInfo,
        parentId: comment.parentId || null,
        attachments: attachmentsData, // Include attachments from raw document
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        isEdited: comment.isEdited || false,
      };
    });

    // 🔧 FIX: Nest replies under their parent comments
    // Separate top-level comments and replies
    const topLevelComments = processedComments.filter((c) => !c.parentId);
    const repliesMap = {};

    console.log(
      "DEBUG - Subtask nesting - Total processed comments:",
      processedComments.length,
    );
    console.log(
      "DEBUG - Subtask nesting - Top-level comments:",
      topLevelComments.length,
    );

    // Group replies by parentId (ensure both are strings for comparison)
    processedComments.forEach((comment) => {
      if (comment.parentId) {
        const parentIdStr = comment.parentId.toString();
        if (!repliesMap[parentIdStr]) {
          repliesMap[parentIdStr] = [];
        }
        repliesMap[parentIdStr].push(comment);
        console.log("DEBUG - Subtask reply mapped:", {
          replyId: comment._id,
          parentId: parentIdStr,
          text: comment.text?.substring(0, 30),
        });
      }
    });

    console.log("DEBUG - Subtask repliesMap keys:", Object.keys(repliesMap));
    console.log(
      "DEBUG - Subtask repliesMap structure:",
      Object.entries(repliesMap).map(([key, replies]) => ({
        parentId: key,
        repliesCount: replies.length,
      })),
    );

    // Attach replies to their parent comments (ensure _id is string for lookup)
    const commentsWithReplies = topLevelComments.map((comment) => {
      const commentIdStr = comment._id.toString();
      const replies = repliesMap[commentIdStr] || [];

      console.log("DEBUG - Subtask attaching replies:", {
        commentId: commentIdStr,
        repliesCount: replies.length,
        text: comment.text?.substring(0, 30),
      });

      return {
        ...comment,
        replies: replies,
      };
    });

    console.log("DEBUG - Nested comments structure:", {
      totalComments: processedComments.length,
      topLevelComments: topLevelComments.length,
      totalReplies: Object.values(repliesMap).flat().length,
    });

    // Apply pagination to TOP-LEVEL comments only
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedComments = commentsWithReplies.slice(startIndex, endIndex);

    res.status(200).json({
      success: true,
      data: {
        comments: paginatedComments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: topLevelComments.length, // Count only top-level comments for pagination
          totalPages: Math.ceil(topLevelComments.length / limit),
        },
        subtask: {
          id: subtask._id,
          title: subtask.title,
        },
        parentTask: {
          id: parentTask._id,
          title: parentTask.title,
        },
      },
    });
  } catch (error) {
    console.error("Error getting subtask comments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get subtask comments",
      error: error.message,
    });
  }
};

export const updateSubtaskComment = async (req, res) => {
  try {
    const { parentTaskId, subtaskId, commentId } = req.params;
    const { comment, content, mentions } = req.body;
    const user = req.user;

    // Handle both 'content' and 'comment' fields for compatibility
    const commentContent = content || comment;

    if (!commentContent || commentContent.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Comment text is required",
      });
    }

    // Validate parent task exists and user has access
    const parentTask = await storage.getTaskById(parentTaskId);
    if (!parentTask) {
      return res.status(404).json({
        success: false,
        message: "Parent task not found",
      });
    }

    // Get and validate subtask (without populating to avoid CastError)
    const Task = (await import("../models.js")).Task;
    const subtask = await Task.findById(subtaskId).select(
      "_id title parentTaskId isSubtask comments",
    );
    if (
      !subtask ||
      !subtask.isSubtask ||
      subtask.parentTaskId?.toString() !== parentTaskId
    ) {
      return res.status(404).json({
        success: false,
        message: "Subtask not found or does not belong to this parent task",
      });
    }

    // Find the comment
    const comments = subtask.comments || [];
    const commentIndex = comments.findIndex((c) => c._id === commentId);

    if (commentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    const existingComment = comments[commentIndex];

    // Check if user is the author of the comment
    if (existingComment.author.toString() !== user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own comments",
      });
    }

    // Process mentions if provided
    let mentionUserIds = [];
    if (mentions && Array.isArray(mentions)) {
      const mongoose = (await import("mongoose")).default;
      mentionUserIds = mentions
        .map((m) => {
          if (typeof m === "string") return new mongoose.Types.ObjectId(m);
          if (m && m.id) return new mongoose.Types.ObjectId(m.id);
          return null;
        })
        .filter(Boolean);
    }

    // Update the comment using MongoDB $set operator to avoid population issues
    const mongoose = (await import("mongoose")).default;
    const updateResult = await Task.findOneAndUpdate(
      {
        _id: subtaskId,
        "comments._id": commentId,
      },
      {
        $set: {
          "comments.$.text": commentContent.trim(),
          "comments.$.content": commentContent.trim(),
          "comments.$.updatedAt": new Date(),
          "comments.$.isEdited": true,
          ...(mentions && { "comments.$.mentions": mentionUserIds }),
        },
      },
      { new: true },
    );

    if (!updateResult) {
      return res.status(404).json({
        success: false,
        message: "Failed to update comment",
      });
    }

    // Get updated comment for response
    const updatedComment = updateResult.comments.find(
      (c) => c._id === commentId,
    );

    // Populate author and mentions for response
    const User = (await import("../modals/userModal.js")).User;
    const populatedAuthor = await User.findById(updatedComment.author).select(
      "_id email firstName lastName role department designation",
    );

    let populatedMentions = [];
    if (updatedComment.mentions && updatedComment.mentions.length > 0) {
      populatedMentions = await User.find({
        _id: { $in: updatedComment.mentions },
      })
        .select("_id email firstName lastName role department designation")
        .lean();
    }

    const responseComment = {
      _id: updatedComment._id,
      text: updatedComment.text,
      content: updatedComment.content,
      author: {
        _id: populatedAuthor._id,
        email: populatedAuthor.email,
        firstName: populatedAuthor.firstName,
        lastName: populatedAuthor.lastName,
        role: populatedAuthor.role,
        department: populatedAuthor.department,
        designation: populatedAuthor.designation,
      },
      mentions: populatedMentions.map((m) => ({
        id: m._id.toString(),
        name: `${m.firstName} ${m.lastName}`.trim() || m.email,
        firstName: m.firstName,
        lastName: m.lastName,
        email: m.email,
        role: m.role,
        department: m.department,
        designation: m.designation,
      })),
      parentId: updatedComment.parentId,
      createdAt: updatedComment.createdAt,
      updatedAt: updatedComment.updatedAt,
      isEdited: updatedComment.isEdited,
    };

    res.json({
      success: true,
      message: "Comment updated successfully",
      data: {
        comment: responseComment,
        subtask: {
          _id: subtask._id,
          title: subtask.title,
        },
        parentTask: {
          _id: parentTask._id,
          title: parentTask.title,
        },
      },
    });
  } catch (error) {
    console.error("Error updating subtask comment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update comment",
      error: error.message,
    });
  }
};

export const deleteSubtaskComment = async (req, res) => {
  try {
    const { parentTaskId, subtaskId, commentId } = req.params;
    const user = req.user;

    // Validate parent task exists and user has access
    const parentTask = await storage.getTaskById(parentTaskId);
    if (!parentTask) {
      return res.status(404).json({
        success: false,
        message: "Parent task not found",
      });
    }

    // Get and validate subtask (without populating to avoid CastError)
    const Task = (await import("../models.js")).Task;
    const subtask = await Task.findById(subtaskId).select(
      "_id title parentTaskId isSubtask comments",
    );
    if (
      !subtask ||
      !subtask.isSubtask ||
      subtask.parentTaskId?.toString() !== parentTaskId
    ) {
      return res.status(404).json({
        success: false,
        message: "Subtask not found or does not belong to this parent task",
      });
    }

    // Find the comment
    const comments = subtask.comments || [];
    const existingComment = comments.find((c) => c._id === commentId);

    if (!existingComment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check if user is the author of the comment or has admin privileges
    const canDelete =
      existingComment.author.toString() === user.id.toString() ||
      user.role === "org_admin" ||
      (Array.isArray(user.role) && user.role.includes("org_admin"));

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message:
          "You can only delete your own comments or need admin privileges",
      });
    }

    // Remove the comment using $pull to avoid population issues
    await Task.findByIdAndUpdate(
      subtaskId,
      {
        $pull: { comments: { _id: commentId } },
      },
      { new: true },
    );

    res.json({
      success: true,
      message: "Comment deleted successfully",
      data: {
        deletedCommentId: commentId,
        subtask: {
          _id: subtask._id,
          title: subtask.title,
        },
        parentTask: {
          _id: parentTask._id,
          title: parentTask.title,
        },
      },
    });
  } catch (error) {
    console.error("Error deleting subtask comment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete comment",
      error: error.message,
    });
  }
};

// Reply to Subtask Comment API
export const replyToSubtaskComment = async (req, res) => {
  try {
    console.log("🚀 [SUBTASK REPLY API] Started - Step 1: Initial Request");
    const { parentTaskId, subtaskId, commentId } = req.params;
    let { content, mentions } = req.body;
    const user = req.user;

    // Parse mentions if it comes as JSON string from FormData
    if (typeof mentions === "string") {
      try {
        mentions = JSON.parse(mentions);
      } catch (e) {
        console.log(
          "⚠️ Failed to parse mentions in subtask reply, using as is:",
          mentions,
        );
      }
    }

    console.log("📥 [SUBTASK REPLY API] Step 2: Request Data:", {
      parentTaskId,
      subtaskId,
      commentId,
      userId: user?.id,
      contentLength: content?.length,
      mentionsCount: mentions?.length,
    });

    // Validate input
    if (!content || content.trim() === "") {
      console.log(
        "❌ [SUBTASK REPLY API] Step 3: Validation Failed - Empty Content",
      );
      return res.status(400).json({
        success: false,
        message: "Reply content is required",
      });
    }
    console.log("✅ [SUBTASK REPLY API] Step 3: Content Validation Passed");

    // Get parent task to check permissions
    console.log("🔍 [SUBTASK REPLY API] Step 4: Fetching Parent Task...");
    const parentTask = await storage.getTaskById(parentTaskId);
    if (!parentTask) {
      console.log("❌ [SUBTASK REPLY API] Step 4: Parent Task Not Found");
      return res.status(404).json({
        success: false,
        message: "Parent task not found",
      });
    }
    console.log("✅ [SUBTASK REPLY API] Step 4: Parent Task Found");

    // Get subtask to validate it exists (without populating comments)
    console.log("🔍 [SUBTASK REPLY API] Step 5: Fetching Subtask...");
    const TaskModel = (await import("../models.js")).Task;
    const subtask =
      await TaskModel.findById(subtaskId).select("_id title comments");
    if (!subtask) {
      console.log("❌ [SUBTASK REPLY API] Step 5: Subtask Not Found");
      return res.status(404).json({
        success: false,
        message: "Subtask not found",
      });
    }
    console.log("✅ [SUBTASK REPLY API] Step 5: Subtask Found:", {
      subtaskId: subtask._id,
      commentsCount: subtask.comments?.length,
    });

    // Check if user has permission to comment
    console.log("🔐 [SUBTASK REPLY API] Step 6: Checking Permissions...");
    const canComment = checkCommentPermission(user, parentTask);
    if (!canComment) {
      console.log("❌ [SUBTASK REPLY API] Step 6: Permission Denied");
      return res.status(403).json({
        success: false,
        message: "You do not have permission to reply to this comment",
      });
    }
    console.log("✅ [SUBTASK REPLY API] Step 6: Permission Granted");

    // Verify the parent comment exists
    console.log("🔍 [SUBTASK REPLY API] Step 7: Finding Parent Comment...");
    const parentComment = subtask.comments?.find(
      (c) => c._id.toString() === commentId,
    );
    if (!parentComment) {
      console.log("❌ [SUBTASK REPLY API] Step 7: Parent Comment Not Found:", {
        searchingFor: commentId,
        availableComments: subtask.comments?.map((c) => c._id.toString()),
      });
      return res.status(404).json({
        success: false,
        message: "Parent comment not found",
      });
    }
    console.log("✅ [SUBTASK REPLY API] Step 7: Parent Comment Found");

    // Process mentions - extract user IDs from mention objects
    console.log("🔧 [SUBTASK REPLY API] Step 8: Processing Mentions...");
    let mentionUserIds = [];
    if (mentions && Array.isArray(mentions)) {
      mentionUserIds = mentions
        .map((m) => {
          if (typeof m === "string") {
            console.log("  📌 Processing mention string:", m);
            return m;
          }
          if (m && m.id) {
            console.log("  📌 Processing mention object:", {
              id: m.id,
              name: m.name,
            });
            return m.id;
          }
          console.log("  ⚠️ Invalid mention format:", m);
          return null;
        })
        .filter(Boolean);

      console.log("✅ [SUBTASK REPLY API] Step 8: Mentions Processed:", {
        receivedCount: mentions.length,
        extractedCount: mentionUserIds.length,
        mentionUserIds,
      });
    }

    // Create reply object for MongoDB - use ObjectId for author and mentions
    console.log("📝 [SUBTASK REPLY API] Step 9: Creating Reply Object...");
    const replyId = new Date().getTime().toString();

    // Handle file attachments if present
    const attachments = [];
    if (req.files && req.files.length > 0) {
      console.log("📎 Processing subtask reply attachments:", req.files.length);
      for (const file of req.files) {
        attachments.push({
          id:
            new Date().getTime().toString() +
            "-" +
            Math.random().toString(36).substr(2, 9),
          name: file.originalname,
          filename: file.filename,
          size: file.size,
          type: file.mimetype,
          url: `/uploads/task-attachments/${file.filename}`,
        });
      }
    }

    const newReply = {
      _id: replyId,
      text: content.trim(),
      author: new mongoose.Types.ObjectId(user.id),
      mentions: mentionUserIds.map((id) => new mongoose.Types.ObjectId(id)),
      parentId: commentId,
      attachments: attachments,
      createdAt: new Date(),
      updatedAt: new Date(),
      isEdited: false,
    };

    console.log("✅ [SUBTASK REPLY API] Step 9: Reply Object Created:", {
      replyId,
      authorId: user.id,
      mentionIds: mentionUserIds,
      parentId: commentId,
    });

    // Add reply to subtask using $push
    console.log(
      "💾 [SUBTASK REPLY API] Step 10: Updating Subtask in Database...",
    );
    try {
      await TaskModel.findByIdAndUpdate(
        subtaskId,
        { $push: { comments: newReply } },
        { new: true, runValidators: false },
      );
      console.log(
        "✅ [SUBTASK REPLY API] Step 10: Subtask Updated Successfully",
      );
    } catch (updateError) {
      console.error("❌ [SUBTASK REPLY API] Step 10: Subtask Update Failed:", {
        error: updateError.message,
        stack: updateError.stack,
      });
      throw updateError;
    }

    // 🎯 Track Activity - Comment Replied
    console.log("📊 [SUBTASK REPLY API] Step 11: Tracking Activity...");
    try {
      await storage.trackActivity({
        activityType: ActivityHelper.ACTIVITY_TYPES.COMMENT_REPLIED,
        userId: user.id,
        organizationId: parentTask.organization,
        relatedId: parentTaskId,
        relatedType: "task",
        data: {
          commentId: newReply._id,
          commentPreview: content.trim().substring(0, 100),
          isReply: true,
          parentCommentId: commentId,
          subtaskId: subtaskId,
          subtaskTitle: subtask.title,
          taskTitle: parentTask.title,
        },
      });
      console.log(
        "✅ [SUBTASK REPLY API] Step 11: Activity Tracked Successfully",
      );
    } catch (activityError) {
      console.error(
        "⚠️ [SUBTASK REPLY API] Step 11: Activity Tracking Failed (non-critical):",
        activityError.message,
      );
    }

    // Fetch the reply with populated author and mentions for response
    console.log("👥 [SUBTASK REPLY API] Step 12: Populating User Data...");
    const UserModel = (await import("../modals/userModal.js")).User;
    const populatedAuthor = await UserModel.findById(user.id).select(
      "_id email firstName lastName role department designation",
    );

    let populatedMentions = [];
    if (mentionUserIds.length > 0) {
      populatedMentions = await UserModel.find({ _id: { $in: mentionUserIds } })
        .select("_id email firstName lastName role department designation")
        .lean();
      console.log(
        "✅ [SUBTASK REPLY API] Step 12: Populated Mentions:",
        populatedMentions.length,
      );
    }

    // Format the response reply with full user objects
    console.log("📦 [SUBTASK REPLY API] Step 13: Formatting Response...");
    const responseReply = {
      _id: replyId,
      text: newReply.text,
      author: {
        _id: populatedAuthor._id,
        email: populatedAuthor.email,
        firstName: populatedAuthor.firstName,
        lastName: populatedAuthor.lastName,
        role: populatedAuthor.role,
        department: populatedAuthor.department,
        designation: populatedAuthor.designation,
      },
      mentions: populatedMentions.map((m) => ({
        id: m._id.toString(),
        name: `${m.firstName} ${m.lastName}`.trim() || m.email,
        firstName: m.firstName,
        lastName: m.lastName,
        email: m.email,
        role: m.role,
        department: m.department,
        designation: m.designation,
      })),
      parentId: newReply.parentId,
      createdAt: newReply.createdAt,
      updatedAt: newReply.updatedAt,
      isEdited: newReply.isEdited,
    };

    console.log("🎉 [SUBTASK REPLY API] Step 14: SUCCESS - Sending Response");
    res.status(201).json({
      success: true,
      message: "Reply added successfully",
      data: responseReply,
    });
  } catch (error) {
    console.error("💥 [SUBTASK REPLY API] FATAL ERROR:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    res.status(500).json({
      success: false,
      message: "Failed to add reply",
      error: error.message,
    });
  }
};

// Task Comment Functions
// export const addTaskComment = async (req, res) => {

//   console.log('================= ADD TASK COMMENT API CALLED =================');
//   try {
//     console.log('🚀 [ADD COMMENT API] Started - Step 1: Initial Request');
//     const { taskId } = req.params;
//     const { content, comment, mentions, parentId } = req.body;
//     const user = req.user;

//     // Handle both 'content' and 'comment' fields for compatibility
//     const commentContent = content || comment;

//     console.log('📥 [ADD COMMENT API] Step 2: Request Data:', {
//       taskId,
//       userId: user?.id,
//       contentLength: commentContent?.length,
//       mentionsCount: mentions?.length,
//       hasParentId: !!parentId
//     });

//     if (!commentContent || commentContent.trim() === '') {
//       console.log('❌ [ADD COMMENT API] Step 3: Validation Failed - Empty Content');
//       return res.status(400).json({
//         success: false,
//         message: 'Comment text is required',
//         debug: { receivedContent: content, receivedComment: comment }
//       });
//     }
//     console.log('✅ [ADD COMMENT API] Step 3: Content Validation Passed');

//     // Get the task to check permissions
//     console.log('🔍 [ADD COMMENT API] Step 4: Fetching Task...');
//     const task = await storage.getTaskById(taskId);
//     if (!task) {
//       console.log('❌ [ADD COMMENT API] Step 4: Task Not Found');
//       return res.status(404).json({
//         success: false,
//         message: 'Task not found'
//       });
//     }
//     console.log('✅ [ADD COMMENT API] Step 4: Task Found:', {
//       taskId: task._id,
//       existingComments: task.comments?.length || 0
//     });

//     // Check if user has permission to comment on this task
//     console.log('🔐 [ADD COMMENT API] Step 5: Checking Permissions...');
//     const canComment = checkCommentPermission(user, task);
//     if (!canComment) {
//       console.log('❌ [ADD COMMENT API] Step 5: Permission Denied');
//       return res.status(403).json({
//         success: false,
//         message: 'You do not have permission to comment on this task'
//       });
//     }
//     console.log('✅ [ADD COMMENT API] Step 5: Permission Granted');

//     // Process mentions - extract user IDs from mention objects
//     console.log('🔧 [ADD COMMENT API] Step 6: Processing Mentions...');
//     let mentionUserIds = [];
//     if (mentions && Array.isArray(mentions)) {
//       mentionUserIds = mentions
//         .map(m => {
//           // Handle both object format {id: "..."} and string format "userId"
//           if (typeof m === 'string') {
//             console.log('  📌 Processing mention string:', m);
//             return m;
//           }
//           if (m && m.id) {
//             console.log('  📌 Processing mention object:', { id: m.id, name: m.name });
//             return m.id;
//           }
//           console.log('  ⚠️ Invalid mention format:', m);
//           return null;
//         })
//         .filter(Boolean); // Remove any null/undefined values

//       console.log('✅ [ADD COMMENT API] Step 6: Mentions Processed:', {
//         receivedCount: mentions.length,
//         extractedCount: mentionUserIds.length,
//         mentionUserIds
//       });
//     }

//     // 🔧 Convert user.id to string if it's an ObjectId
//     const authorIdString = user.id?.toString ? user.id.toString() : user.id;

//     console.log('📝 [ADD COMMENT API] Step 7: Creating Comment Object...');
//     console.log('  🔍 Author ID validation:', {
//       originalUserId: user.id,
//       userIdType: typeof user.id,
//       convertedId: authorIdString,
//       convertedType: typeof authorIdString
//     });

//     // Create comment object for MongoDB according to schema
//     const newComment = {
//       _id: new Date().getTime().toString(),
//       text: commentContent.trim(), // Use 'text' field as per schema
//       content: commentContent.trim(), // Also add content field for compatibility
//       author: authorIdString, // ✅ Save ONLY string ID, NOT ObjectId object
//       mentions: mentionUserIds, // ✅ Store only user IDs (strings), not full user objects
//       parentId: parentId ? parentId.toString() : null, // Ensure parentId is string or null
//       createdAt: new Date(),
//       updatedAt: new Date(),
//       isEdited: false
//     };

//     console.log('✅ [ADD COMMENT API] Step 7: Comment Object Created:', {
//       commentId: newComment._id,
//       authorType: typeof newComment.author,
//       mentionsCount: newComment.mentions.length,
//       allMentionsAreStrings: newComment.mentions.every(m => typeof m === 'string')
//     });

//     // 🔧 FIX: Clean existing comments to ensure all fields are proper types
//     console.log('🧹 [ADD COMMENT API] Step 8: Cleaning Existing Comments...');
//     const cleanedComments = task.comments ? task.comments.map((comment, index) => {
//       const cleanedComment = { ...comment.toObject ? comment.toObject() : comment };

//       console.log(`  🔍 Cleaning comment ${index + 1}:`, {
//         commentId: cleanedComment._id,
//         authorType: typeof cleanedComment.author,
//         mentionsCount: cleanedComment.mentions?.length || 0
//       });

//       // 🔧 Clean author - ensure it's string ID
//       if (cleanedComment.author) {
//         if (typeof cleanedComment.author === 'object' && cleanedComment.author._id) {
//           console.log(`    🔧 Converting populated author to string for comment ${index + 1}`);
//           cleanedComment.author = cleanedComment.author._id.toString();
//         } else if (cleanedComment.author.toString) {
//           console.log(`    🔧 Converting ObjectId author to string for comment ${index + 1}`);
//           cleanedComment.author = cleanedComment.author.toString();
//         }
//       }

//       // 🔧 Process mentions to string IDs only
//       if (cleanedComment.mentions && Array.isArray(cleanedComment.mentions)) {
//         cleanedComment.mentions = cleanedComment.mentions.map(mention => {
//           // If it's a full user object with id field
//           if (typeof mention === 'object' && mention !== null && mention.id) {
//             return mention.id.toString ? mention.id.toString() : mention.id;
//           }
//           // If it's a full user object with _id field
//           if (typeof mention === 'object' && mention !== null && mention._id) {
//             return mention._id.toString();
//           }
//           // If it's an ObjectId object
//           if (mention && typeof mention === 'object' && mention.toString) {
//             return mention.toString();
//           }
//           // Already a string
//           return mention;
//         });

//         console.log(`    ✅ Mentions cleaned for comment ${index + 1}:`, {
//           allStrings: cleanedComment.mentions.every(m => typeof m === 'string')
//         });
//       }

//       return cleanedComment;
//     }) : [];

//     console.log('✅ [ADD COMMENT API] Step 8: Existing Comments Cleaned:', {
//       totalExistingComments: cleanedComments.length
//     });

//     // Add new comment to cleaned comments array
//     console.log('➕ [ADD COMMENT API] Step 9: Adding New Comment...');
//     cleanedComments.push(newComment);
//     console.log('✅ [ADD COMMENT API] Step 9: Comment Added, Total Comments:', cleanedComments.length);

//     // 🔍 Final validation
//     console.log('🔍 [ADD COMMENT API] Step 10: Final Validation...');
//     cleanedComments.forEach((comment, idx) => {
//       if (comment.author && typeof comment.author !== 'string') {
//         console.log(`  ⚠️ Converting comment ${idx + 1} author to string`);
//         comment.author = comment.author.toString();
//       }
//       if (comment.mentions && Array.isArray(comment.mentions)) {
//         comment.mentions = comment.mentions.map(m =>
//           typeof m !== 'string' ? (m.toString ? m.toString() : m) : m
//         );
//       }
//     });
//     console.log('✅ [ADD COMMENT API] Step 10: All Comments Validated');

//     // // Update task with new comment
//     console.log('💾 [ADD COMMENT API] Step 11: Updating Task in Database...');
//     try {
//       await storage.updateTask(taskId, { comments: cleanedComments }, user.id);
//       console.log('✅ [ADD COMMENT API] Step 11: Task Updated Successfully');
//     } catch (updateError) {
//       console.error('❌ [ADD COMMENT API] Step 11: Update Failed:', {
//         error: updateError.message,
//         stack: updateError.stack
//       });
//       throw updateError;
//     }

//     const commentUpdateData = { comments: task.comments };
//     console.log('DEBUG - addTaskComment: Updating with keys:', Object.keys(commentUpdateData));
//     console.log('DEBUG - addTaskComment: Comments array length:', task.comments.length);

//     await storage.updateTask(taskId, commentUpdateData, user.id);

//     // 🎯 Track Activity - Comment Added
//     console.log('📊 [ADD COMMENT API] Step 12: Tracking Activity...');
//     try {
//       const activityData = {
//         activityType: parentId
//           ? ActivityHelper.ACTIVITY_TYPES.COMMENT_REPLIED
//           : ActivityHelper.ACTIVITY_TYPES.COMMENT_ADDED,
//         userId: user.id,
//         organizationId: task.organization,
//         relatedId: taskId,
//         relatedType: 'task',
//         data: {
//           commentId: newComment._id,
//           commentPreview: commentContent.trim().substring(0, 100),
//           isReply: !!parentId,
//           parentCommentId: parentId || null,
//           taskTitle: task.title
//         }
//       };

//       await storage.trackActivity(activityData);
//       console.log('✅ [ADD COMMENT API] Step 12: Activity Tracked Successfully');
//     } catch (activityError) {
//       console.error('⚠️ [ADD COMMENT API] Step 12: Activity Tracking Failed (non-critical):', activityError.message);
//     }

//     // 👥 [ADD COMMENT API] Step 13: Populate User Data for Response
//     console.log('👥 [ADD COMMENT API] Step 13: Populating User Data...');
//     let populatedAuthor = null;
//     let populatedMentions = [];

//     try {
//       // Get author data
//       const authorId = newComment.author?.toString ? newComment.author.toString() : newComment.author;
//       populatedAuthor = await User.findById(authorId)
//         .select('_id email firstName lastName role department designation')
//         .lean();

//       console.log('✅ [ADD COMMENT API] Step 13a: Author Populated:', {
//         authorId,
//         found: !!populatedAuthor
//       });

//       // Get mentions data if any
//       if (mentionUserIds.length > 0) {
//         populatedMentions = await User.find({ _id: { $in: mentionUserIds } })
//           .select('_id email firstName lastName role department designation')
//           .lean();

//         console.log('✅ [ADD COMMENT API] Step 13b: Mentions Populated:', {
//           count: populatedMentions.length
//         });
//       }
//     } catch (populateError) {
//       console.error('⚠️ [ADD COMMENT API] Step 13: User Population Failed (non-critical):', populateError.message);
//     }

//     // Create response with populated data (for frontend display)
//     const responseComment = {
//       _id: newComment._id,
//       text: newComment.text,
//       content: newComment.content,
//       author: populatedAuthor ? {
//         _id: populatedAuthor._id,
//         email: populatedAuthor.email,
//         firstName: populatedAuthor.firstName,
//         lastName: populatedAuthor.lastName,
//         role: populatedAuthor.role,
//         department: populatedAuthor.department,
//         designation: populatedAuthor.designation
//       } : { _id: newComment.author }, // Fallback to just ID
//       mentions: populatedMentions.map(m => ({
//         id: m._id.toString(),
//         name: `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.email,
//         firstName: m.firstName,
//         lastName: m.lastName,
//         email: m.email,
//         role: m.role,
//         department: m.department,
//         designation: m.designation
//       })),
//       parentId: newComment.parentId,
//       createdAt: newComment.createdAt,
//       updatedAt: newComment.updatedAt,
//       isEdited: newComment.isEdited
//     };

//     console.log('🎉 [ADD COMMENT API] Step 14: SUCCESS - Sending Response with Populated Data');
//     console.log('📤 [ADD COMMENT API] Response Comment Author:', responseComment.author);
//     console.log('📤 [ADD COMMENT API] Response Comment Mentions:', responseComment.mentions);

//     // 🔔 Create notification for comment
//     try {
//       // Notify task assignee if different from commenter
//       if (task.assignedTo && task.assignedTo.toString() !== user.id.toString()) {
//         const plainTextComment = stripHtml(commentContent);
//         await createTaskNotification(TriggerEvent.COMMENT_ADDED, task, {
//           targetUserId: task.assignedTo,
//           title: 'New Comment Added',
//           message: `A new comment has been added to task "${task.title}": ${plainTextComment.substring(0, 50)}${plainTextComment.length > 50 ? '...' : ''}`,
//           priority: NotificationPriority.NORMAL,
//           metadata: {
//             commentId: newComment._id,
//             commentText: plainTextComment.substring(0, 100)
//           }
//         });
//       }

//       // Notify task creator if different from commenter and assignee
//       if (task.createdBy &&
//           task.createdBy.toString() !== user.id.toString() &&
//           task.createdBy.toString() !== task.assignedTo?.toString()) {
//         const plainTextComment = stripHtml(commentContent);
//         await createTaskNotification(TriggerEvent.COMMENT_ADDED, task, {
//           targetUserId: task.createdBy,
//           title: 'New Comment Added',
//           message: `A new comment has been added to task "${task.title}": ${plainTextComment.substring(0, 50)}${plainTextComment.length > 50 ? '...' : ''}`,
//           priority: NotificationPriority.NORMAL,
//           metadata: {
//             commentId: newComment._id,
//             commentText: plainTextComment.substring(0, 100)
//           }
//         });
//       }

//       // Notify mentioned users
//       if (mentions && mentions.length > 0) {
//         const plainTextComment = stripHtml(commentContent);
//         for (const mentionedUserId of mentions) {
//           if (mentionedUserId.toString() !== user.id.toString()) {
//             await createTaskNotification(TriggerEvent.USER_MENTIONED, task, {
//               targetUserId: mentionedUserId,
//               title: 'You were mentioned',
//               message: `You were mentioned in a comment on task "${task.title}": ${plainTextComment.substring(0, 50)}${plainTextComment.length > 50 ? '...' : ''}`,
//               priority: NotificationPriority.NORMAL,
//               metadata: {
//                 commentId: newComment._id,
//                 commentText: plainTextComment.substring(0, 100)
//               }
//             });
//           }
//         }
//       }

//       // Notify collaborators
//       if (task.collaborators && task.collaborators.length > 0) {
//         const plainTextComment = stripHtml(commentContent);
//         for (const collaboratorId of task.collaborators) {
//           if (collaboratorId.toString() !== user.id.toString() &&
//               collaboratorId.toString() !== task.assignedTo?.toString() &&
//               collaboratorId.toString() !== task.createdBy?.toString()) {
//             await createTaskNotification(TriggerEvent.COMMENT_ADDED, task, {
//               targetUserId: collaboratorId,
//               title: 'New Comment Added',
//               message: `A new comment has been added to task "${task.title}": ${plainTextComment.substring(0, 50)}${plainTextComment.length > 50 ? '...' : ''}`,
//               priority: NotificationPriority.NORMAL,
//               metadata: {
//                 commentId: newComment._id,
//                 commentText: plainTextComment.substring(0, 100)
//               }
//             });
//           }
//         }
//       }
//     } catch (notificationError) {
//       console.error('Error creating comment notifications:', notificationError);
//       // Don't fail comment creation if notification fails
//     }

//     res.status(201).json({
//       success: true,
//       message: 'Comment added successfully',
//       data: responseComment  // ✅ Send populated data, not raw newComment
//     });

//   } catch (error) {
//     console.error('💥 [ADD COMMENT API] FATAL ERROR:', {
//       message: error.message,
//       stack: error.stack,
//       taskId: req.params.taskId || req.params.id,
//       userId: req.user?.id
//     });
//     res.status(500).json({
//       success: false,
//       message: 'Failed to add comment',
//       error: error.message
//     });
//   }
// };

export const addTaskComment = async (req, res) => {
  console.log(" addTaskComment hi hi");
  console.log("🚀 addTaskComment triggered...");

  try {
    const { taskId } = req.params;
    let { content, comment, mentions, parentId } = req.body;
    const user = req.user;

    // Parse mentions if it comes as JSON string from FormData
    if (typeof mentions === "string") {
      try {
        mentions = JSON.parse(mentions);
      } catch (e) {
        console.log("⚠️ Failed to parse mentions, using as is:", mentions);
      }
    }

    const commentContent = content || comment;

    if (!commentContent || commentContent.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Comment text is required",
      });
    }

    const task = await storage.getTaskById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Check if user has permission to comment on this task
    const canComment = checkCommentPermission(user, task);
    if (!canComment) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to comment on this task",
      });
    }

    const authorIdString = user.id?.toString
      ? user.id.toString()
      : String(user.id);

    let mentionUserIds = Array.isArray(mentions)
      ? mentions.map((m) => (typeof m === "string" ? m : m.id)).filter(Boolean)
      : [];

    // Import mongoose for ObjectId conversion
    const mongoose = (await import("mongoose")).default;

    // Handle file attachments if present
    const attachments = [];
    if (req.files && req.files.length > 0) {
      console.log("📎 Processing comment attachments:", req.files.length);
      for (const file of req.files) {
        attachments.push({
          id:
            new Date().getTime().toString() +
            "-" +
            Math.random().toString(36).substr(2, 9),
          name: file.originalname,
          filename: file.filename,
          size: file.size,
          type: file.mimetype,
          url: `/uploads/task-attachments/${file.filename}`,
        });
      }
      console.log(
        "✅ Created attachments array:",
        JSON.stringify(attachments, null, 2),
      );
    } else {
      console.log("ℹ️ No files attached to this comment");
    }

    const newComment = {
      _id: new Date().getTime().toString(),
      text: commentContent.trim(),
      author: new mongoose.Types.ObjectId(authorIdString),
      mentions: mentionUserIds.map((id) => new mongoose.Types.ObjectId(id)),
      parentId: parentId ? parentId.toString() : null,
      attachments: attachments.length > 0 ? attachments : [], // Ensure empty array instead of undefined
      createdAt: new Date(),
      updatedAt: new Date(),
      isEdited: false,
    };

    console.log("📝 Created newComment object:", {
      id: newComment._id,
      hasText: !!newComment.text,
      hasAttachments: !!newComment.attachments,
      attachmentsCount: newComment.attachments?.length || 0,
      attachmentsData: newComment.attachments,
      fullObject: newComment,
    });

    // ✅ Alternative approach: Get task, add comment, and save
    console.log("💾 Pushing comment to database...");
    console.log(
      "📦 Exact data being pushed:",
      JSON.stringify({ comments: newComment }, null, 2),
    );

    // Add debug info about attachments specifically
    console.log("🔍 ATTACHMENT DEBUG:", {
      attachmentsExists: !!newComment.attachments,
      attachmentsType: typeof newComment.attachments,
      attachmentsLength: newComment.attachments?.length || 0,
      attachmentsData: newComment.attachments,
      isArray: Array.isArray(newComment.attachments),
    });

    // Try direct approach: Get task, modify, and save
    const taskToUpdate = await Task.findById(taskId);
    if (!taskToUpdate) {
      throw new Error("Task not found for update");
    }

    // Add the comment with all fields explicitly
    taskToUpdate.comments.push(newComment);
    const savedTask = await taskToUpdate.save({ validateBeforeSave: false });

    console.log(
      "✅ Comment added to task. Total comments:",
      savedTask?.comments?.length,
    );

    // Verify the comment was saved with attachments - use lean query for accurate check
    const taskAfterSave = await Task.findById(taskId).select("comments").lean();
    const savedComment = taskAfterSave?.comments?.find(
      (c) => c._id === newComment._id,
    );
    console.log("🔍 Saved comment verification (LEAN query):", {
      found: !!savedComment,
      hasAttachments: !!savedComment?.attachments,
      attachmentsCount: savedComment?.attachments?.length || 0,
      attachmentsData: savedComment?.attachments,
      rawComment: savedComment,
    });

    // 🔧 CRITICAL FIX: If attachments are missing, manually update the comment to add them
    if (
      savedComment &&
      (!savedComment.attachments || savedComment.attachments.length === 0) &&
      attachments.length > 0
    ) {
      console.log(
        "⚠️ FIXING MISSING ATTACHMENTS: Manually updating comment with attachments",
      );

      await Task.findOneAndUpdate(
        { _id: taskId, "comments._id": newComment._id },
        {
          $set: {
            "comments.$.attachments": attachments,
            "comments.$.updatedAt": new Date(),
          },
        },
        { new: true, strict: false },
      );

      console.log("✅ FIXED: Attachments manually added to comment");

      // Re-verify after the fix
      const taskAfterFix = await Task.findById(taskId)
        .select("comments")
        .lean();
      const fixedComment = taskAfterFix?.comments?.find(
        (c) => c._id === newComment._id,
      );
      console.log("🔍 After fix verification:", {
        found: !!fixedComment,
        hasAttachments: !!fixedComment?.attachments,
        attachmentsCount: fixedComment?.attachments?.length || 0,
        attachmentsData: fixedComment?.attachments,
      });
    }

    // ✅ Populate response
    const populatedAuthor = await User.findById(authorIdString)
      .select("_id firstName lastName email role")
      .lean();

    const populatedMentions =
      mentionUserIds.length > 0
        ? await User.find({ _id: { $in: mentionUserIds } })
            .select("_id firstName lastName email role")
            .lean()
        : [];

    const responseComment = {
      ...newComment,
      author: populatedAuthor || { _id: authorIdString },
      mentions: populatedMentions.map((m) => ({
        id: m._id.toString(),
        name: `${m.firstName || ""} ${m.lastName || ""}`.trim() || m.email,
      })),
    };

    /**
     ✅ Notification System with Enhanced Logging
    */
    try {
      const plainText = stripHtml(commentContent);

      NotificationLogger.logCommentAddition(
        "NOTIFICATION_START",
        {
          taskId,
          commentedBy: user.id,
          plainTextPreview: plainText.substring(0, 50),
        },
        "START",
      );

      // Use enhanced notification helper
      await EnhancedNotificationHelper.notifyComment(task, newComment, user.id);

      NotificationLogger.logCommentAddition(
        "NOTIFICATION_SUCCESS",
        {
          taskId,
          commentId: newComment._id,
        },
        "SUCCESS",
      );
    } catch (err) {
      console.error("⚠ Notification Failed:", err.message);
      NotificationLogger.logCommentAddition(
        "NOTIFICATION_ERROR",
        {
          taskId,
          error: err.message,
        },
        "ERROR",
      );
    }

    // 🎯 Track Activity - Comment Added
    try {
      await storage.trackActivity({
        activityType: parentId
          ? ActivityHelper.ACTIVITY_TYPES.COMMENT_REPLIED
          : ActivityHelper.ACTIVITY_TYPES.COMMENT_ADDED,
        userId: user.id,
        organizationId: task.organization,
        relatedId: taskId,
        relatedType: "task",
        data: {
          commentId: newComment._id,
          commentPreview: commentContent.trim().substring(0, 100),
          isReply: !!parentId,
          parentCommentId: parentId || null,
          taskTitle: task.title,
        },
      });
      console.log("✅ Comment activity tracked successfully");
    } catch (activityError) {
      console.error("Failed to track comment activity:", activityError);
    }

    return res.status(201).json({
      success: true,
      message: "Comment added successfully",
      data: responseComment,
    });
  } catch (error) {
    console.error("💥 Error adding comment:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add comment",
      error: error.message,
    });
  }
};

// Helper function to check if user is mentioned in any comment on the task
function isUserMentionedInTask(userId, task) {
  if (!task.comments || !Array.isArray(task.comments)) {
    return false;
  }

  const userIdStr = userId.toString ? userId.toString() : userId;

  // Check all comments and their replies for mentions
  for (const comment of task.comments) {
    // Check main comment mentions
    if (comment.mentions && Array.isArray(comment.mentions)) {
      for (const mention of comment.mentions) {
        const mentionId = mention._id?.toString
          ? mention._id.toString()
          : mention.id?.toString
            ? mention.id.toString()
            : mention.toString
              ? mention.toString()
              : mention;
        if (mentionId === userIdStr) {
          console.log(`   ✓ User is mentioned in comment ${comment._id}`);
          return true;
        }
      }
    }

    // Check reply mentions
    if (comment.replies && Array.isArray(comment.replies)) {
      for (const reply of comment.replies) {
        if (reply.mentions && Array.isArray(reply.mentions)) {
          for (const mention of reply.mentions) {
            const mentionId = mention._id?.toString
              ? mention._id.toString()
              : mention.id?.toString
                ? mention.id.toString()
                : mention.toString
                  ? mention.toString()
                  : mention;
            if (mentionId === userIdStr) {
              console.log(
                `   ✓ User is mentioned in reply to comment ${comment._id}`,
              );
              return true;
            }
          }
        }
      }
    }
  }

  return false;
}

// Helper function to check comment permissions
// FOR COMPANY USERS: Collaborators, Contributors, and Mentioned users can view/comment
// FOR INDIVIDUAL USERS: Only own tasks or when tagged as collaborator
function checkCommentPermission(user, task) {
  console.log(
    "\n\n🔐 ═════════════════════════════════════════════════════════════",
  );
  console.log("🔐 [STEP 1] STARTING PERMISSION CHECK");
  console.log(
    "🔐 ═════════════════════════════════════════════════════════════",
  );

  console.log("\n📋 [STEP 1.1] User Information:");
  console.log("   User ID:", user.id || user._id);
  console.log("   User Role(s):", user.role);
  console.log("   User Email:", user.email);
  console.log("   User Organization:", user.organizationId);

  console.log("\n📋 [STEP 1.2] Task Information:");
  console.log("   Task ID:", task._id);
  console.log("   Task Title:", task.title);
  console.log("   Created By:", task.createdBy);
  console.log("   Assigned To:", task.assignedTo);
  console.log("   Collaborators Array:", task.collaborators);
  console.log("   Contributors Array:", task.contributors);
  console.log("   Task Visibility:", task.visibility);

  // Handle user role - it might be an array, use first role or check if user has role
  const userRole = Array.isArray(user.role) ? user.role[0] : user.role;
  const userRoles = Array.isArray(user.role) ? user.role : [user.role];

  console.log("\n🔍 [STEP 2] CHECKING ADMIN ROLES:");

  // Tasksetu Admin (platform level)
  if (
    userRoles.includes("tasksetu-admin") ||
    userRoles.includes("super-admin")
  ) {
    console.log("✅ [RESULT] Permission GRANTED: Tasksetu Admin");
    console.log(
      "🔐 ═════════════════════════════════════════════════════════════\n",
    );
    return true;
  }

  // Company Admin (org_admin) - all company tasks
  if (
    userRoles.includes("org_admin") ||
    userRoles.includes("company-admin") ||
    userRoles.includes("admin")
  ) {
    console.log("✅ [RESULT] Permission GRANTED: Company Admin");
    console.log(
      "🔐 ═════════════════════════════════════════════════════════════\n",
    );
    return true;
  }

  console.log("❌ User is not admin");

  // Extract user ID for comparison
  const userId = user.id?.toString() || user._id?.toString();

  console.log("\n🔍 [STEP 3] CHECKING BASIC PERMISSIONS:");
  console.log("   Extracted User ID:", userId);

  // Check if user is task assignee or creator
  // Handle both string IDs and populated objects
  const getIdFromField = (field) => {
    if (!field) return null;
    if (typeof field === "string") return field;
    if (field._id) return field._id.toString();
    if (field.id) return field.id.toString(); // ← FIX: Check for 'id' property (not just _id)
    if (field.toString) return field.toString();
    return null;
  };

  const taskAssignedToId = getIdFromField(task.assignedTo);
  const taskCreatedById = getIdFromField(task.createdBy);

  const isTaskAssignee = taskAssignedToId === userId;
  const isTaskCreator = taskCreatedById === userId;

  console.log("   Task Created By ID:", taskCreatedById);
  console.log("   Task Assigned To ID:", taskAssignedToId);
  console.log("   Is Task Creator:", isTaskCreator);
  console.log("   Is Task Assignee:", isTaskAssignee);

  // Check if user is tagged as collaborator
  // Note: The task model only has 'collaborators' field, not 'contributors'
  console.log("\n🔍 [STEP 4] CHECKING COLLABORATORS:");
  console.log("   Collaborators Array:", task.collaborators);
  console.log("   Collaborators Count:", task.collaborators?.length || 0);

  const isCollaboratorInTask =
    task.collaborators &&
    task.collaborators.some((c) => {
      const collaboratorId = getIdFromField(c);
      console.log("   - Checking collaborator:", {
        original: c,
        extracted: collaboratorId,
        matches: collaboratorId === userId,
      });
      return collaboratorId === userId;
    });

  console.log("   Result - Is Collaborator:", isCollaboratorInTask);

  // For backward compatibility, also check contributors field if it exists
  console.log("\n🔍 [STEP 5] CHECKING CONTRIBUTORS (BACKWARD COMPAT):");
  console.log("   Contributors Array:", task.contributors);
  console.log("   Contributors Count:", task.contributors?.length || 0);

  const isTaggedContributor =
    task.contributors &&
    task.contributors.some((c) => {
      const contributorId = getIdFromField(c);
      console.log("   - Checking contributor:", {
        original: c,
        extracted: contributorId,
        matches: contributorId === userId,
      });
      return contributorId === userId;
    });

  console.log("   Result - Is Tagged Contributor:", isTaggedContributor);

  // Check if user is designated as an approver for this task
  const isApprover = (task.approvers || []).some((approver) => {
    if (approver && typeof approver === "object") {
      return (
        approver._id?.toString() === userId ||
        approver.id?.toString() === userId
      );
    }
    return approver?.toString() === userId;
  });
  console.log("   Result - Is Approver:", isApprover);

  // ✨ NEW: Check if user is mentioned in any comment on this task
  console.log("\n🔍 [STEP 5.5] CHECKING IF USER IS MENTIONED IN COMMENTS:");
  const isMentionedInComments = isUserMentionedInTask(userId, task);
  console.log("   Result - Is Mentioned in Comments:", isMentionedInComments);

  console.log("\n📊 [STEP 6] SUMMARY OF ALL CHECKS:");
  console.log({
    isTaskAssignee,
    isTaskCreator,
    isTaggedContributor,
    isCollaboratorInTask,
    isApprover,
    isMentionedInComments,
    userId,
    taskAssignedToId,
    taskCreatedById,
    userRole,
    userRoles,
  });

  // Approver check - any approver has access to the task comments and attachments
  if (isApprover) {
    console.log("✅ [RESULT] Permission GRANTED: User is an approver of this task");
    console.log(
      "🔐 ═════════════════════════════════════════════════════════════\n",
    );
    return true;
  }

  // Manager - own tasks + subordinates' tasks
  console.log("\n🔍 [STEP 7] CHECKING MANAGER PERMISSIONS:");
  if (userRoles.includes("manager")) {
    console.log("   ✓ User has MANAGER role");

    // Own task
    if (isTaskAssignee || isTaskCreator) {
      console.log("✅ [RESULT] Permission GRANTED: Manager own task");
      console.log(
        "🔐 ═════════════════════════════════════════════════════════════\n",
      );
      return true;
    }

    // Subordinate's task (task assigned to employee under this manager)
    const hasEmployeeCreator = Array.isArray(task.createdByRole)
      ? task.createdByRole.includes("employee")
      : task.createdByRole === "employee";

    if (
      task.assignedToRole === "employee" ||
      hasEmployeeCreator
    ) {
      console.log("✅ [RESULT] Permission GRANTED: Manager subordinate task");
      console.log(
        "🔐 ═════════════════════════════════════════════════════════════\n",
      );
      return true;
    }

    // Tagged as contributor/collaborator/mentioned
    if (isTaggedContributor || isCollaboratorInTask || isMentionedInComments) {
      console.log(
        "✅ [RESULT] Permission GRANTED: Manager tagged as contributor/collaborator/mentioned",
      );
      console.log(
        "🔐 ═════════════════════════════════════════════════════════════\n",
      );
      return true;
    }
  } else {
    console.log("   ✗ User is NOT a manager");
  }

  // Employee (Normal User) - company users: own tasks OR tagged/mentioned
  console.log("\n🔍 [STEP 8] CHECKING EMPLOYEE PERMISSIONS:");
  if (
    userRoles.includes("employee") ||
    userRoles.includes("normal-user") ||
    userRoles.includes("user") ||
    !userRole
  ) {
    console.log("   ✓ User has EMPLOYEE/NORMAL-USER/USER role");

    // Own task
    if (isTaskAssignee || isTaskCreator) {
      console.log("✅ [RESULT] Permission GRANTED: Employee own task");
      console.log(
        "🔐 ═════════════════════════════════════════════════════════════\n",
      );
      return true;
    }

    // Tagged as contributor/collaborator/mentioned - COMPANY USERS CAN ACCESS
    if (isTaggedContributor || isCollaboratorInTask || isMentionedInComments) {
      console.log(
        "✅ [RESULT] Permission GRANTED: Employee tagged as contributor/collaborator/mentioned",
      );
      console.log(
        "🔐 ═════════════════════════════════════════════════════════════\n",
      );
      return true;
    }
  } else {
    console.log("   ✗ User is NOT an employee/normal-user/user");
  }

  // Individual User - only own tasks or when tagged as collaborator
  console.log("\n🔍 [STEP 9] CHECKING INDIVIDUAL USER PERMISSIONS:");
  if (userRoles.includes("individual")) {
    console.log("   ✓ User has INDIVIDUAL role");
    console.log("   Checking individual user permissions:", {
      userId,
      taskAssignedToId,
      taskCreatedById,
      isTaskAssignee,
      isTaskCreator,
      isCollaboratorInTask,
    });

    // Own task (creator or assignee)
    if (isTaskAssignee || isTaskCreator) {
      console.log("✅ [RESULT] Permission GRANTED: Individual user own task");
      console.log(
        "🔐 ═════════════════════════════════════════════════════════════\n",
      );
      return true;
    }

    // Tagged as collaborator
    if (isCollaboratorInTask) {
      console.log(
        "✅ [RESULT] Permission GRANTED: Individual user tagged as collaborator",
      );
      console.log(
        "🔐 ═════════════════════════════════════════════════════════════\n",
      );
      return true;
    }

    // If user is not creator, assignee, or collaborator, deny access
    console.log(
      "❌ [RESULT] Permission DENIED: Individual user not authorized for this task",
    );
    console.log(
      "🔐 ═════════════════════════════════════════════════════════════\n",
    );
    return false;
  } else {
    console.log("   ✗ User is NOT an individual");
  }

  console.log("\n❌ [STEP 10] FINAL CHECK - NO MATCHING ROLE FOUND");
  console.log("   User Roles:", userRoles);
  console.log("   Checked: admin, employee, manager, individual");
  console.log("❌ [RESULT] Permission DENIED: No matching conditions");
  console.log(
    "🔐 ═════════════════════════════════════════════════════════════\n",
  );
  // Default - no permission
  return false;
}

export const getTaskComments = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const user = req.user;

    console.log(
      "\n\n📝 ═════════════════════════════════════════════════════════════",
    );
    console.log("📝 [API] GET /api/tasks/{taskId}/comments - STARTED");
    console.log(
      "📝 ═════════════════════════════════════════════════════════════",
    );

    console.log("\n📦 [REQUEST] Incoming Request Details:");
    console.log("   Task ID:", taskId);
    console.log("   User ID:", user.id);
    console.log("   User Email:", user.email);
    console.log("   User Roles:", user.role);
    console.log("   Page:", page);
    console.log("   Limit:", limit);

    // Get task to check permissions
    console.log("\n🔍 [STEP 1] Fetching Task from Database...");
    const task = await storage.getTaskById(taskId);

    if (!task) {
      console.log("❌ [ERROR] Task not found");
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    console.log("✅ [STEP 1] Task Found:");
    console.log("   Title:", task.title);
    console.log("   Created By:", task.createdBy);
    console.log("   Assigned To:", task.assignedTo);
    console.log("   Collaborators:", task.collaborators);
    console.log("   Comments Count:", task.comments?.length || 0);

    // Check if user has permission to view comments
    console.log("\n🔐 [STEP 2] Checking Permission...");
    const canComment = checkCommentPermission(user, task);

    if (!canComment) {
      console.log("❌ [PERMISSION] Access DENIED - User cannot view comments");
      console.log(
        "📝 ═════════════════════════════════════════════════════════════\n",
      );
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    console.log("✅ [PERMISSION] Access GRANTED - User can view comments");

    // Get task with populated comment authors and mentions using explicit population
    console.log("\n📊 [STEP 3] Populating Comment Data...");
    let populatedTask;
    try {
      populatedTask = await Task.findById(taskId)
        .populate({
          path: "comments.author",
          model: "User",
          select: "firstName lastName email",
        })
        .populate({
          path: "comments.mentions",
          model: "User",
          select: "firstName lastName email role department designation",
        })
        .lean() // ✅ Use lean() to get plain JavaScript objects instead of Mongoose documents
        .exec();
      console.log("✅ [STEP 3] Population Successful (with lean):");
      console.log("   Comments Count:", populatedTask?.comments?.length || 0);
      if (populatedTask?.comments?.[0]) {
        console.log(
          "   Sample Comment Keys:",
          Object.keys(populatedTask.comments[0]),
        );
        console.log(
          "   Sample Has Attachments:",
          !!populatedTask.comments[0].attachments,
        );
        console.log(
          "   Sample Attachments:",
          populatedTask.comments[0].attachments,
        );
      }
    } catch (populateError) {
      console.error("⚠️  [STEP 3] Population Failed:", populateError.message);
      populatedTask = null;
    }

    const comments = populatedTask?.comments || task.comments || [];

    console.log("\n📤 [STEP 4] Preparing Response...");
    console.log("   Total Comments:", comments.length);
    console.log("DEBUG - Found task comments:", comments.length);
    console.log(
      "DEBUG - Raw comments with parentId check:",
      comments.map((c) => ({
        id: c._id,
        content: c.content,
        text: c.text,
        parentId: c.parentId,
        hasParentId: !!c.parentId,
        hasContent: !!(c.content || c.text),
        author: c.author,
        fullCommentObject: c,
      })),
    );

    // Process comments with populated author data
    const processedComments = comments.map((comment) => {
      // Handle both content and text fields for backward compatibility
      const text = comment.content || comment.text || "[Content not available]";

      console.log("DEBUG - Processing comment:", {
        id: comment._id,
        hasContent: !!comment.content,
        hasText: !!comment.text,
        finalText: text,
        parentId: comment.parentId,
        hasAttachments: !!comment.attachments,
        attachmentsLength: comment.attachments?.length || 0,
        attachmentsData: comment.attachments,
        rawAuthor: comment.author,
        authorType: typeof comment.author,
        authorPopulated:
          comment.author &&
          typeof comment.author === "object" &&
          comment.author.firstName,
        authorData:
          comment.author && typeof comment.author === "object"
            ? {
                id: comment.author._id,
                firstName: comment.author.firstName,
                lastName: comment.author.lastName,
                email: comment.author.email,
              }
            : "Not populated",
      });

      // Handle author information based on whether it's populated or not
      let authorInfo;

      if (
        comment.author &&
        typeof comment.author === "object" &&
        comment.author.firstName
      ) {
        // Author is populated from our populate query
        authorInfo = {
          _id: comment.author._id,
          firstName: comment.author.firstName || "Unknown",
          lastName: comment.author.lastName || "User",
          email: comment.author.email || "",
        };
        console.log("DEBUG - Using populated author data:", authorInfo);
      } else {
        // Author is ObjectId reference - fallback to Unknown
        console.log("DEBUG - Author not populated, using fallback");
        authorInfo = {
          _id: comment.author,
          firstName: "Unknown",
          lastName: "User",
          email: "",
        };
      }

      // Process mentions - convert to user objects if populated
      let mentionsInfo = [];
      if (comment.mentions && Array.isArray(comment.mentions)) {
        mentionsInfo = comment.mentions
          .map((mention) => {
            // Check if mention is already a populated user object
            if (mention && typeof mention === "object" && mention.firstName) {
              return {
                id: mention._id.toString(),
                name: `${mention.firstName} ${mention.lastName}`.trim(),
                firstName: mention.firstName,
                lastName: mention.lastName,
                email: mention.email || "",
                role: mention.role || [],
                department: mention.department || "",
                designation: mention.designation || "",
              };
            }
            // If it's just an ID string, return it as is (shouldn't happen with populate)
            return mention;
          })
          .filter(Boolean);
      }

      console.log("DEBUG - Processed mentions:", {
        commentId: comment._id,
        rawMentions: comment.mentions,
        mentionsCount: mentionsInfo.length,
        firstMention: mentionsInfo[0],
      });

      // Extract attachments - with lean() we get direct access to the array
      const attachmentsData = comment.attachments || [];
      console.log("DEBUG - Processing attachments (lean):", {
        commentId: comment._id,
        hasAttachments: !!comment.attachments,
        attachmentsLength: attachmentsData.length,
        attachmentsData: attachmentsData,
      });

      const processedComment = {
        _id: comment._id,
        text: text,
        content: text, // Include both for compatibility
        author: authorInfo,
        mentions: mentionsInfo, // Now contains full user objects
        parentId: comment.parentId || null,
        attachments: attachmentsData.length > 0 ? attachmentsData : [], // ✅ Ensure empty array instead of undefined
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        isEdited: comment.isEdited || false,
      };

      console.log("DEBUG - Final processed comment:", {
        id: processedComment._id,
        hasText: !!processedComment.text,
        parentId: processedComment.parentId,
        isReply: !!processedComment.parentId,
        hasAttachments: !!processedComment.attachments,
        attachmentsCount: processedComment.attachments?.length || 0,
        authorName: `${processedComment.author.firstName} ${processedComment.author.lastName}`,
        authorId: processedComment.author._id,
        authorPopulated: processedComment.author.firstName !== "Unknown",
      });

      return processedComment;
    });

    // Organize comments with nested replies structure
    console.log("DEBUG - Starting to organize comments:", {
      totalProcessedComments: processedComments.length,
      commentsWithParentId: processedComments.filter((c) => c.parentId).length,
      commentsWithoutParentId: processedComments.filter((c) => !c.parentId)
        .length,
      allComments: processedComments.map((c) => ({
        id: c._id,
        parentId: c.parentId,
        text: c.text?.substring(0, 30),
      })),
    });

    // Create a map to hold all comments
    const commentMap = new Map();

    // Initialize all comments in the map with empty replies array
    processedComments.forEach((comment) => {
      commentMap.set(comment._id.toString(), {
        ...comment,
        replies: [],
      });
    });

    console.log("DEBUG - Comment map initialized:", {
      mapSize: commentMap.size,
      commentIds: Array.from(commentMap.keys()),
    });

    // Separate top-level comments from replies and nest replies
    const topLevelComments = [];

    processedComments.forEach((comment) => {
      const commentId = comment._id.toString();
      const parentId = comment.parentId?.toString();

      console.log("DEBUG - Processing comment for nesting:", {
        commentId,
        parentId,
        isReply: !!parentId,
        text: comment.text?.substring(0, 30),
      });

      if (!parentId || parentId === "null" || parentId === "") {
        // This is a top-level comment
        topLevelComments.push(commentId);
        console.log("DEBUG - Added to top-level:", commentId);
      } else {
        // This is a reply - add it to parent's replies array
        const parentComment = commentMap.get(parentId);

        console.log("DEBUG - Reply processing:", {
          replyId: commentId,
          parentId,
          parentFound: !!parentComment,
          availableParents: Array.from(commentMap.keys()),
        });

        if (parentComment) {
          const replyData = commentMap.get(commentId);
          if (replyData) {
            parentComment.replies.push(replyData);
            console.log("DEBUG - Reply nested successfully:", {
              replyId: commentId,
              parentId,
              parentRepliesCount: parentComment.replies.length,
            });
          }
        } else {
          console.log("DEBUG - MISSING PARENT for reply:", {
            replyId: commentId,
            expectedParentId: parentId,
            availableParents: Array.from(commentMap.keys()),
          });
        }
      }
    });

    console.log("DEBUG - After processing all comments:", {
      topLevelCommentsCount: topLevelComments.length,
      topLevelIds: topLevelComments,
      commentsWithReplies: Array.from(commentMap.values())
        .filter((c) => c.replies.length > 0)
        .map((c) => ({
          id: c._id,
          repliesCount: c.replies.length,
          replies: c.replies.map((r) => ({
            id: r._id,
            text: r.text?.substring(0, 20),
          })),
        })),
    });

    // Get final nested structure - only top-level comments with their replies nested
    const nestedComments = topLevelComments
      .map((id) => {
        const comment = commentMap.get(id);
        if (comment && comment.replies && comment.replies.length > 0) {
          // Sort replies by creation date (oldest first)
          comment.replies.sort(
            (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
          );
          console.log("DEBUG - Sorted replies for comment:", {
            commentId: id,
            repliesCount: comment.replies.length,
            replies: comment.replies.map((r) => ({
              id: r._id,
              createdAt: r.createdAt,
              text: r.text?.substring(0, 20),
            })),
          });
        }
        return comment;
      })
      .filter((comment) => comment !== null && comment !== undefined);

    console.log("DEBUG - Final nested structure BEFORE sending response:", {
      totalProcessedComments: processedComments.length,
      topLevelCommentsAfterNesting: nestedComments.length,
      commentsWithReplies: nestedComments.filter(
        (c) => c && c.replies && c.replies.length > 0,
      ).length,
      firstCommentReplies: nestedComments[0]?.replies?.length || 0,
      finalStructure: nestedComments.map((c) => ({
        commentId: c?._id,
        text: c?.text?.substring(0, 40),
        isTopLevel: !c?.parentId,
        repliesCount: c?.replies?.length || 0,
        actualReplies:
          c?.replies?.map((r) => ({
            replyId: r._id,
            parentId: r.parentId,
            author: `${r.author?.firstName} ${r.author?.lastName}`,
            text: r.text?.substring(0, 40),
          })) || [],
      })),
      responsePreview: nestedComments.map((c) => ({
        _id: c._id,
        text: c.text?.substring(0, 30),
        repliesLength: c.replies?.length || 0,
      })),
    });

    // Apply pagination to top-level comments only (replies stay with parent)
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedComments = nestedComments.slice(startIndex, endIndex);

    // Calculate total replies count
    const totalRepliesCount = nestedComments.reduce((count, comment) => {
      return count + (comment.replies?.length || 0);
    }, 0);

    res.status(200).json({
      success: true,
      data: {
        comments: paginatedComments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: nestedComments.length, // Count of top-level comments
          totalPages: Math.ceil(nestedComments.length / limit),
          totalCommentsWithReplies: nestedComments.length, // Only top-level comments count, not including replies
          totalReplies: totalRepliesCount, // Count of replies only
        },
        summary: {
          topLevelComments: nestedComments.length,
          totalReplies: totalRepliesCount,
          commentsWithReplies: nestedComments.filter(
            (c) => c.replies && c.replies.length > 0,
          ).length,
        },
      },
    });
  } catch (error) {
    console.error("Error getting task comments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get comments",
      error: error.message,
    });
  }
};

export const updateTaskComment = async (req, res) => {
  try {
    const { taskId, commentId } = req.params;
    const { content, mentions } = req.body;
    const user = req.user;

    console.log("DEBUG - updateTaskComment called:", {
      taskId,
      commentId,
      userId: user.id,
    });
    console.log("🔍 [BACKEND EDIT] Step 1: Request Body:", req.body);
    console.log("📋 [BACKEND EDIT] Step 2: Comment Content:", content);
    console.log("👥 [BACKEND EDIT] Step 3: Mentions:", mentions);

    // Get the task
    const task = await storage.getTaskById(taskId, user.id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found or access denied",
      });
    }

    console.log(
      "📊 [BACKEND EDIT] Step 4: Task found, comments count:",
      task.comments?.length,
    );
    console.log(
      "🔍 [BACKEND EDIT] Step 5: Looking for comment with ID:",
      commentId,
    );

    // Find the comment
    const comment = task.comments?.find(
      (c) => c._id === commentId || c.id === commentId,
    );
    if (!comment) {
      console.error("❌ [BACKEND EDIT] Comment not found in task comments");
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    console.log("✅ [BACKEND EDIT] Step 6: Comment found:", {
      commentId: comment._id,
      currentContent: comment.text || comment.content,
      author: comment.author,
    });

    // Check permissions - user can edit own comments or moderators can edit any
    const canEdit = checkCommentEditPermission(user, task, comment);
    if (!canEdit) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to edit this comment",
      });
    }

    // 🔧 FIX: Process mentions to ensure only ObjectIds are saved
    const processedMentions =
      mentions && Array.isArray(mentions)
        ? mentions.map((mention) => {
            // If mention is an object with id, extract the id
            if (typeof mention === "object" && mention !== null) {
              return mention.id || mention._id;
            }
            // If it's already a string/ObjectId, use it as is
            return mention;
          })
        : comment.mentions || [];

    // Update comment - save in both content and text fields for compatibility
    comment.text = content; // Schema uses 'text' field
    comment.content = content; // Frontend compatibility
    comment.mentions = processedMentions; // Use processed mentions (ObjectIds only)
    comment.updatedAt = new Date();
    comment.isEdited = true;

    console.log("DEBUG - Updating comment with data:", {
      commentId: comment._id,
      newText: content,
      newContent: content,
      processedMentions,
      updatedAt: comment.updatedAt,
      isEdited: comment.isEdited,
    });

    console.log(
      "📊 [BACKEND EDIT] Step 7: BEFORE cleaning - Total comments:",
      task.comments.length,
    );

    // 🔧 FIX: Clean all comments to ensure mentions and author are ObjectIds only
    const mongoose = (await import("mongoose")).default;
    const cleanedComments = task.comments.map((c) => {
      const cleanedComment = { ...(c.toObject ? c.toObject() : c) };

      // Process author to ObjectId only
      if (cleanedComment.author) {
        try {
          if (
            typeof cleanedComment.author === "object" &&
            cleanedComment.author !== null
          ) {
            cleanedComment.author = new mongoose.Types.ObjectId(
              cleanedComment.author._id || cleanedComment.author.id,
            );
          } else if (
            typeof cleanedComment.author === "string" &&
            mongoose.Types.ObjectId.isValid(cleanedComment.author)
          ) {
            cleanedComment.author = new mongoose.Types.ObjectId(
              cleanedComment.author,
            );
          }
        } catch (err) {
          console.warn(
            "⚠️ [EDIT] Invalid author ID, keeping as-is:",
            err.message,
          );
        }
      }

      // Process mentions to ObjectIds only
      if (cleanedComment.mentions && Array.isArray(cleanedComment.mentions)) {
        cleanedComment.mentions = cleanedComment.mentions.map((mention) => {
          try {
            if (typeof mention === "object" && mention !== null) {
              return new mongoose.Types.ObjectId(mention._id || mention.id);
            } else if (
              typeof mention === "string" &&
              mongoose.Types.ObjectId.isValid(mention)
            ) {
              return new mongoose.Types.ObjectId(mention);
            }
          } catch (err) {
            console.warn(
              "⚠️ [EDIT] Invalid mention ID, keeping as-is:",
              err.message,
            );
            return mention;
          }
          return mention;
        });
      }

      // Ensure _id is ObjectId - but only if it's a valid ObjectId format
      if (cleanedComment._id) {
        try {
          if (
            typeof cleanedComment._id === "string" &&
            mongoose.Types.ObjectId.isValid(cleanedComment._id)
          ) {
            cleanedComment._id = new mongoose.Types.ObjectId(
              cleanedComment._id,
            );
          }
        } catch (err) {
          console.warn(
            "⚠️ [EDIT] Invalid comment _id, keeping as-is:",
            err.message,
          );
        }
      }

      return cleanedComment;
    });

    console.log(
      "📊 [BACKEND EDIT] Step 8: AFTER cleaning - Total comments:",
      cleanedComments.length,
    );
    console.log(
      "🔍 [BACKEND EDIT] Step 9: Edited comment in cleaned array:",
      cleanedComments.find((c) => c._id?.toString() === commentId.toString()),
    );

    // Update task with modified comment
    await storage.updateTask(taskId, { comments: cleanedComments }, user.id);

    console.log("✅ [BACKEND EDIT] Step 10: Task updated successfully");
    console.log("DEBUG - Comment updated successfully");

    // 🎯 Track Activity - Comment Updated
    try {
      await storage.trackActivity({
        activityType: ActivityHelper.ACTIVITY_TYPES.COMMENT_UPDATED,
        userId: user.id,
        organizationId: task.organization,
        relatedId: taskId,
        relatedType: "task",
        data: {
          commentId: comment._id,
          commentPreview: content.substring(0, 100),
          taskTitle: task.title,
        },
      });
    } catch (activityError) {
      console.error("Failed to track comment edit activity:", activityError);
    }

    res.status(200).json({
      success: true,
      message: "Comment updated successfully",
      data: comment,
    });
  } catch (error) {
    console.error("Error updating task comment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update comment",
      error: error.message,
    });
  }
};

export const deleteTaskComment = async (req, res) => {
  try {
    const { taskId, commentId } = req.params;
    const user = req.user;

    console.log("DEBUG - deleteTaskComment called:", {
      taskId,
      commentId,
      userId: user.id,
    });

    // Get the task
    const task = await storage.getTaskById(taskId, user.id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found or access denied",
      });
    }

    // Find the comment
    const commentIndex = task.comments?.findIndex(
      (c) => c._id === commentId || c.id === commentId,
    );
    if (commentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    const comment = task.comments[commentIndex];

    // Check permissions - user can delete own comments or moderators can delete any
    const canDelete = checkCommentDeletePermission(user, task, comment);
    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to delete this comment",
      });
    }

    // Remove comment
    task.comments.splice(commentIndex, 1);

    console.log(
      "🧹 [DELETE] Step 1: Cleaning comments before save, count:",
      task.comments.length,
    );

    // 🔧 FIX: Clean all remaining comments to ensure only ObjectIds are saved
    const mongoose = (await import("mongoose")).default;
    const cleanedComments = task.comments.map((c) => {
      const cleanedComment = { ...(c.toObject ? c.toObject() : c) };

      // Process author to ObjectId only
      if (cleanedComment.author) {
        if (
          typeof cleanedComment.author === "object" &&
          cleanedComment.author !== null
        ) {
          try {
            cleanedComment.author = new mongoose.Types.ObjectId(
              cleanedComment.author._id || cleanedComment.author.id,
            );
          } catch (err) {
            console.warn(
              "⚠️ [DELETE] Invalid author ID, keeping as-is:",
              cleanedComment.author._id || cleanedComment.author.id,
            );
          }
        } else if (typeof cleanedComment.author === "string") {
          try {
            cleanedComment.author = new mongoose.Types.ObjectId(
              cleanedComment.author,
            );
          } catch (err) {
            console.warn(
              "⚠️ [DELETE] Invalid author ID string, keeping as-is:",
              cleanedComment.author,
            );
          }
        }
      }

      // Process mentions to ObjectIds only
      if (cleanedComment.mentions && Array.isArray(cleanedComment.mentions)) {
        cleanedComment.mentions = cleanedComment.mentions.map((mention) => {
          try {
            if (typeof mention === "object" && mention !== null) {
              return new mongoose.Types.ObjectId(mention._id || mention.id);
            } else if (typeof mention === "string") {
              return new mongoose.Types.ObjectId(mention);
            }
          } catch (err) {
            console.warn(
              "⚠️ [DELETE] Invalid mention ID, keeping as-is:",
              mention,
            );
            return mention;
          }
          return mention;
        });
      }

      // Ensure _id is ObjectId - but only if it's a valid ObjectId format
      if (cleanedComment._id) {
        try {
          if (
            typeof cleanedComment._id === "string" &&
            mongoose.Types.ObjectId.isValid(cleanedComment._id)
          ) {
            cleanedComment._id = new mongoose.Types.ObjectId(
              cleanedComment._id,
            );
          }
          // If it's already an ObjectId or not valid format, keep as-is
        } catch (err) {
          console.warn(
            "⚠️ [DELETE] Invalid comment _id, keeping as-is:",
            cleanedComment._id,
          );
        }
      }

      return cleanedComment;
    });

    console.log(
      "✅ [DELETE] Step 2: Cleaned comments, count:",
      cleanedComments.length,
    );

    // Update task without the deleted comment
    await storage.updateTask(taskId, { comments: cleanedComments }, user.id);

    console.log("DEBUG - Comment deleted successfully");

    // 🎯 Track Activity - Comment Deleted
    try {
      await storage.trackActivity({
        activityType: ActivityHelper.ACTIVITY_TYPES.COMMENT_DELETED,
        userId: user.id,
        organizationId: task.organization,
        relatedId: taskId,
        relatedType: "task",
        data: {
          commentId: comment._id,
          taskTitle: task.title,
        },
      });
    } catch (activityError) {
      console.error("Failed to track comment delete activity:", activityError);
    }

    res.status(200).json({
      success: true,
      message: "Comment deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting task comment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete comment",
      error: error.message,
    });
  }
};

// Helper function to check comment edit permissions
function checkCommentEditPermission(user, task, comment) {
  console.log("DEBUG - checkCommentEditPermission:", {
    userRole: user.role,
    userId: user.id,
    commentAuthor: comment.author,
    commentId: comment._id,
  });

  // Handle role as array or string - Tasksetu Admin or Company Admin can edit any comment
  const userRoles = Array.isArray(user.role) ? user.role : [user.role];
  if (
    userRoles.includes("tasksetu-admin") ||
    userRoles.includes("super-admin") ||
    userRoles.includes("company-admin") ||
    userRoles.includes("admin") ||
    userRoles.includes("org_admin")
  ) {
    console.log("DEBUG - Edit permission granted: Admin role");
    return true;
  }

  // User can edit their own comments if they have comment access to the task
  // Handle both populated and non-populated author objects
  let isOwnComment = false;
  if (comment.author) {
    const commentAuthorId =
      comment.author._id || comment.author.id || comment.author;
    const currentUserId = user._id || user.id;
    isOwnComment = commentAuthorId.toString() === currentUserId.toString();
    console.log("DEBUG - Comment ownership check:", {
      commentAuthorId: commentAuthorId.toString(),
      currentUserId: currentUserId.toString(),
      isOwnComment,
    });
  }

  if (isOwnComment && checkCommentPermission(user, task)) {
    console.log("DEBUG - Edit permission granted: Own comment");
    return true;
  }

  console.log("DEBUG - Edit permission denied");
  return false;
}

// Helper function to check comment delete permissions
function checkCommentDeletePermission(user, task, comment) {
  console.log("🔒 [DELETE PERMISSION] Step 1: Checking permissions");
  console.log("👤 [DELETE PERMISSION] User Info:", {
    userId: user.id,
    userRole: user.role,
    roleType: Array.isArray(user.role) ? "array" : typeof user.role,
  });
  console.log("💬 [DELETE PERMISSION] Comment Info:", {
    commentId: comment._id,
    commentAuthor: comment.author,
    authorType: typeof comment.author,
  });

  // Handle role as array or string - Tasksetu Admin or Company Admin can delete any comment (moderation)
  const userRoles = Array.isArray(user.role) ? user.role : [user.role];
  console.log("📋 [DELETE PERMISSION] Normalized user roles:", userRoles);

  const adminRoles = [
    "tasksetu-admin",
    "super-admin",
    "company-admin",
    "admin",
    "org_admin",
  ];
  const hasAdminRole = userRoles.some((role) => adminRoles.includes(role));

  console.log("🎭 [DELETE PERMISSION] Admin role check:", {
    hasAdminRole,
    matchedRoles: userRoles.filter((role) => adminRoles.includes(role)),
  });

  if (hasAdminRole) {
    console.log("✅ [DELETE PERMISSION] GRANTED: Admin role");
    return true;
  }

  // User can delete their own comments if they have comment access to the task
  // Handle both populated and non-populated author objects
  let isOwnComment = false;
  if (comment.author) {
    const commentAuthorId =
      comment.author._id || comment.author.id || comment.author;
    const currentUserId = user._id || user.id;
    isOwnComment = commentAuthorId.toString() === currentUserId.toString();
    console.log("🔍 [DELETE PERMISSION] Ownership check:", {
      commentAuthorId: commentAuthorId.toString(),
      currentUserId: currentUserId.toString(),
      isOwnComment,
    });
  }

  if (isOwnComment && checkCommentPermission(user, task)) {
    console.log("✅ [DELETE PERMISSION] GRANTED: Own comment");
    return true;
  }

  console.log("❌ [DELETE PERMISSION] DENIED");
  return false;
}

// Reply to Task Comment API
export const replyToTaskComment = async (req, res) => {
  try {
    console.log("🚀 [REPLY API] Started - Step 1: Initial Request");
    const { taskId, commentId } = req.params;
    let { content, comment, mentions } = req.body;
    const user = req.user;

    // Parse mentions if it comes as JSON string from FormData
    if (typeof mentions === "string") {
      try {
        mentions = JSON.parse(mentions);
      } catch (e) {
        console.log(
          "⚠️ Failed to parse mentions in reply, using as is:",
          mentions,
        );
      }
    }

    console.log("📥 [REPLY API] Step 2: Request Data:", {
      taskId,
      commentId,
      userId: user?.id,
      contentLength: content?.length,
      mentionsCount: mentions?.length,
      rawBodyKeys: Object.keys(req.body),
    });

    // Handle both 'content' and 'comment' fields for compatibility
    const replyContent = content || comment;

    if (!replyContent || replyContent.trim() === "") {
      console.log("❌ [REPLY API] Step 3: Validation Failed - Empty Content");
      return res.status(400).json({
        success: false,
        message: "Reply content is required",
        debug: { receivedContent: content, receivedComment: comment },
      });
    }

    console.log("✅ [REPLY API] Step 3: Content Validation Passed");

    // Get the task to check permissions
    console.log("🔍 [REPLY API] Step 4: Fetching Task...");
    const task = await storage.getTaskById(taskId);
    if (!task) {
      console.log("❌ [REPLY API] Step 4: Task Not Found");
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }
    console.log("✅ [REPLY API] Step 4: Task Found:", {
      taskId: task._id,
      commentsCount: task.comments?.length,
    });

    // Check if parent comment exists
    console.log("🔍 [REPLY API] Step 5: Finding Parent Comment...");
    const parentComment = task.comments?.find(
      (c) => c._id === commentId || c.id === commentId,
    );
    if (!parentComment) {
      console.log("❌ [REPLY API] Step 5: Parent Comment Not Found:", {
        searchingFor: commentId,
        availableComments: task.comments?.map((c) => ({ id: c._id || c.id })),
      });
      return res.status(404).json({
        success: false,
        message: "Parent comment not found",
      });
    }
    console.log("✅ [REPLY API] Step 5: Parent Comment Found:", {
      commentId: parentComment._id,
    });

    // Check if user has permission to comment on this task
    console.log("🔐 [REPLY API] Step 6: Checking Permissions...");
    const canComment = checkCommentPermission(user, task);
    if (!canComment) {
      console.log("❌ [REPLY API] Step 6: Permission Denied");
      return res.status(403).json({
        success: false,
        message: "You do not have permission to reply to comments on this task",
      });
    }
    console.log("✅ [REPLY API] Step 6: Permission Granted");

    // 🔧 FIX: Process mentions to ensure only ObjectIds are saved
    console.log("🔧 [REPLY API] Step 7: Processing Mentions...");
    const processedMentions =
      mentions && Array.isArray(mentions)
        ? mentions.map((mention) => {
            // If mention is an object with id, extract the id
            if (typeof mention === "object" && mention !== null) {
              const mentionId = mention.id || mention._id;
              console.log("  📌 Processing mention object:", {
                hasId: !!mention.id,
                hasObjectId: !!mention._id,
                extracted: mentionId,
                type: typeof mentionId,
              });
              return mentionId;
            }
            // If it's already a string/ObjectId, use it as is
            console.log("  📌 Processing mention string:", mention);
            return mention;
          })
        : [];

    console.log("✅ [REPLY API] Step 7: Mentions Processed:", {
      originalCount: mentions?.length || 0,
      processedCount: processedMentions.length,
      processedMentions,
    });

    // Create reply object for MongoDB according to schema
    // 🚨 CRITICAL: Only save ObjectId references, NOT full user objects
    console.log("📝 [REPLY API] Step 8: Creating Reply Object...");
    const replyId = new Date().getTime().toString();

    // 🔧 Convert user.id to string if it's an ObjectId
    const authorIdString = user.id?.toString ? user.id.toString() : user.id;

    console.log("🔍 [REPLY API] Step 8a: Validating Author ID:", {
      originalUserId: user.id,
      userIdType: typeof user.id,
      hasToString: !!user.id?.toString,
      convertedId: authorIdString,
      convertedType: typeof authorIdString,
      isString: typeof authorIdString === "string",
    });

    console.log("🔍 [REPLY API] Step 8b: Validating Mention IDs:", {
      mentionIds: processedMentions,
      allStrings: processedMentions.every((m) => typeof m === "string"),
    });

    // Handle file attachments if present
    const attachments = [];
    if (req.files && req.files.length > 0) {
      console.log("📎 Processing reply attachments:", req.files.length);
      for (const file of req.files) {
        attachments.push({
          id:
            new Date().getTime().toString() +
            "-" +
            Math.random().toString(36).substr(2, 9),
          name: file.originalname,
          filename: file.filename,
          size: file.size,
          type: file.mimetype,
          url: `/uploads/task-attachments/${file.filename}`,
        });
      }
    }

    const newReply = {
      _id: replyId,
      text: replyContent.trim(), // Use 'text' field as per schema
      content: replyContent.trim(), // Also add content field for compatibility
      author: authorIdString, // ✅ Save ONLY ObjectId string, NOT ObjectId object
      mentions: processedMentions, // ✅ Save ONLY ObjectId strings, NOT full user objects
      parentId: commentId.toString(), // Ensure parentId is a string and link to parent comment
      attachments: attachments,
      createdAt: new Date(),
      updatedAt: new Date(),
      isEdited: false,
    };

    console.log("✅ [REPLY API] Step 8: Reply Object Created:", {
      replyId,
      authorId: newReply.author,
      authorType: typeof newReply.author,
      parentId: newReply.parentId,
      mentionsCount: newReply.mentions.length,
      mentionTypes: newReply.mentions.map((m) => typeof m),
      contentPreview: newReply.text.substring(0, 50) + "...",
    });

    // 🔧 FIX: Clean existing comments to ensure mentions are ObjectIds only
    console.log("🧹 [REPLY API] Step 9: Cleaning Existing Comments...");
    const cleanedComments = task.comments.map((comment, index) => {
      const cleanedComment = {
        ...(comment.toObject ? comment.toObject() : comment),
      };

      console.log(`  🔍 Cleaning comment ${index + 1}:`, {
        commentId: cleanedComment._id,
        hasAuthor: !!cleanedComment.author,
        authorType: typeof cleanedComment.author,
        hasMentions: !!cleanedComment.mentions,
        mentionsCount: cleanedComment.mentions?.length || 0,
      });

      // 🔧 FIX: Clean author - ensure it's string ID, not ObjectId object
      if (cleanedComment.author) {
        if (
          typeof cleanedComment.author === "object" &&
          cleanedComment.author._id
        ) {
          // Populated object with _id
          console.log(
            `    🔧 Converting populated author object to ID string for comment ${index + 1}`,
          );
          cleanedComment.author = cleanedComment.author._id.toString();
        } else if (cleanedComment.author.toString) {
          // ObjectId object (not populated, but still object)
          console.log(
            `    🔧 Converting ObjectId author to string for comment ${index + 1}`,
          );
          cleanedComment.author = cleanedComment.author.toString();
        }
        console.log(
          `    ✅ Author cleaned: type = ${typeof cleanedComment.author}`,
        );
      }

      // 🔧 FIX: Process mentions to string IDs only
      if (cleanedComment.mentions && Array.isArray(cleanedComment.mentions)) {
        const originalMentions = [...cleanedComment.mentions];
        console.log(
          `    🔍 Original mentions for comment ${index + 1}:`,
          originalMentions,
        );

        cleanedComment.mentions = cleanedComment.mentions.map(
          (mention, mIndex) => {
            console.log(`      📌 Mention ${mIndex + 1}:`, {
              type: typeof mention,
              hasId: !!(mention && mention.id),
              hasObjectId: !!(mention && mention._id),
              hasToString: !!(mention && mention.toString),
              value: mention,
            });

            // If it's a full user object with id field (like from your error)
            if (typeof mention === "object" && mention !== null && mention.id) {
              console.log(
                `        ✂️ Extracting 'id' field from mention object`,
              );
              return mention.id.toString ? mention.id.toString() : mention.id;
            }

            // If it's a full user object with _id field (populated)
            if (
              typeof mention === "object" &&
              mention !== null &&
              mention._id
            ) {
              console.log(
                `        ✂️ Extracting '_id' field from mention object`,
              );
              return mention._id.toString();
            }

            // If it's an ObjectId object (not populated, but still object)
            if (mention && typeof mention === "object" && mention.toString) {
              console.log(`        ✂️ Converting ObjectId to string`);
              return mention.toString();
            }

            // Already a string
            console.log(`        ✅ Already a string ID`);
            return mention;
          },
        );

        console.log(`    ✅ Mentions cleaned for comment ${index + 1}:`, {
          before: originalMentions.length,
          after: cleanedComment.mentions.length,
          allStrings: cleanedComment.mentions.every(
            (m) => typeof m === "string",
          ),
          cleanedMentions: cleanedComment.mentions,
        });
      }

      return cleanedComment;
    });

    console.log("✅ [REPLY API] Step 9: Comments Cleaned:", {
      totalComments: cleanedComments.length,
    });

    // Add new reply to cleaned comments array
    console.log("➕ [REPLY API] Step 10: Adding Reply to Comments Array...");
    cleanedComments.push(newReply);
    console.log(
      "✅ [REPLY API] Step 10: Reply Added, Total Comments:",
      cleanedComments.length,
    );

    // 🔍 Final validation before DB save
    console.log("🔍 [REPLY API] Step 11: Final Validation Before Save...");
    const lastComment = cleanedComments[cleanedComments.length - 1];
    console.log("  📋 Last comment (our new reply):", {
      _id: lastComment._id,
      authorType: typeof lastComment.author,
      authorValue: lastComment.author,
      mentionsType: Array.isArray(lastComment.mentions)
        ? "array"
        : typeof lastComment.mentions,
      mentionsCount: lastComment.mentions?.length,
      allMentionsAreStrings: lastComment.mentions?.every(
        (m) => typeof m === "string",
      ),
      mentionsSample: lastComment.mentions?.slice(0, 2),
    });

    // 🚨 FINAL CHECK: Ensure ALL comments have string IDs (not ObjectId objects)
    console.log("  🔍 Validating ALL comments before save...");
    cleanedComments.forEach((comment, idx) => {
      console.log(`    Comment ${idx + 1}:`, {
        authorType: typeof comment.author,
        mentionsAllStrings: comment.mentions?.every(
          (m) => typeof m === "string",
        ),
      });

      // Final conversion if needed
      if (comment.author && typeof comment.author !== "string") {
        console.log(
          `    ⚠️ Comment ${idx + 1} author is not string, converting...`,
        );
        comment.author = comment.author.toString();
      }

      if (comment.mentions && Array.isArray(comment.mentions)) {
        comment.mentions = comment.mentions.map((m) => {
          if (typeof m !== "string") {
            console.log(
              `    ⚠️ Comment ${idx + 1} has non-string mention, converting...`,
            );
            return m.toString ? m.toString() : m;
          }
          return m;
        });
      }
    });

    console.log("  ✅ All comments validated and converted to strings");

    // Update task with new reply
    console.log("💾 [REPLY API] Step 12: Updating Task in Database...");
    try {
      await storage.updateTask(taskId, { comments: cleanedComments }, user.id);
      console.log("✅ [REPLY API] Step 12: Task Updated Successfully");
    } catch (updateError) {
      console.error("❌ [REPLY API] Step 12: Task Update Failed:", {
        error: updateError.message,
        stack: updateError.stack,
      });
      throw updateError;
    }

    // 🎯 Track Activity - Comment Replied
    console.log("📊 [REPLY API] Step 13: Tracking Activity...");
    try {
      await storage.trackActivity({
        activityType: ActivityHelper.ACTIVITY_TYPES.COMMENT_REPLIED,
        userId: user.id,
        organizationId: task.organization,
        relatedId: taskId,
        relatedType: "task",
        data: {
          commentId: newReply._id,
          commentPreview: replyContent.trim().substring(0, 100),
          isReply: true,
          parentCommentId: commentId,
          taskTitle: task.title,
        },
      });
      console.log("✅ [REPLY API] Step 13: Activity Tracked Successfully");
    } catch (activityError) {
      console.error(
        "⚠️ [REPLY API] Step 13: Activity Tracking Failed (non-critical):",
        activityError.message,
      );
    }

    // 👥 [REPLY API] Step 14: Populate User Data for Response (Frontend needs full objects)
    console.log("👥 [REPLY API] Step 14: Populating User Data for Response...");
    let populatedAuthor = null;
    let populatedMentions = [];

    try {
      // Get author data
      populatedAuthor = await User.findById(user.id)
        .select("_id email firstName lastName role department designation")
        .lean();

      console.log("✅ [REPLY API] Step 14a: Author Populated:", {
        authorId: populatedAuthor?._id,
        name: `${populatedAuthor?.firstName} ${populatedAuthor?.lastName}`,
      });

      // Get mentions data if any
      if (processedMentions.length > 0) {
        populatedMentions = await User.find({ _id: { $in: processedMentions } })
          .select("_id email firstName lastName role department designation")
          .lean();

        console.log("✅ [REPLY API] Step 14b: Mentions Populated:", {
          count: populatedMentions.length,
        });
      }
    } catch (populateError) {
      console.error(
        "⚠️ [REPLY API] Step 14: User Population Failed (non-critical):",
        populateError.message,
      );
    }

    // Create response with populated data (for frontend display)
    const responseReply = {
      _id: newReply._id,
      text: newReply.text,
      content: newReply.content,
      author: populatedAuthor
        ? {
            _id: populatedAuthor._id,
            email: populatedAuthor.email,
            firstName: populatedAuthor.firstName,
            lastName: populatedAuthor.lastName,
            role: populatedAuthor.role,
            department: populatedAuthor.department,
            designation: populatedAuthor.designation,
          }
        : { _id: user.id }, // Fallback to just ID if population fails
      mentions: populatedMentions.map((m) => ({
        id: m._id.toString(),
        name: `${m.firstName || ""} ${m.lastName || ""}`.trim() || m.email,
        firstName: m.firstName,
        lastName: m.lastName,
        email: m.email,
        role: m.role,
        department: m.department,
        designation: m.designation,
      })),
      parentId: newReply.parentId,
      createdAt: newReply.createdAt,
      updatedAt: newReply.updatedAt,
      isEdited: newReply.isEdited,
    };

    console.log(
      "🎉 [REPLY API] Step 15: SUCCESS - Sending Response with Populated Data",
    );
    res.status(201).json({
      success: true,
      message: "Reply added successfully",
      data: responseReply, // Send populated data to frontend
    });
  } catch (error) {
    console.error("💥 [REPLY API] FATAL ERROR:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    res.status(500).json({
      success: false,
      message: "Failed to add reply",
      error: error.message,
    });
  }
};

export const getTasks = async (req, res) => {
  try {
    const user = req.user;
    const {
      type,
      status,
      assignee,
      project,
      priority,
      page = 1,
      limit = 50,
      search,
    } = req.query;

    console.log("🔍 GET TASKS API CALLED - Enhanced Debug Mode");

    const filter = {
      isDeleted: { $ne: true },
      parentTaskId: { $exists: false }, // Only parent tasks, exclude subtasks
    };

    // Filter by organization for org users, or by creator for individual users
    if (user.organizationId) {
      filter.organization = user.organizationId;
    } else {
      filter.createdBy = user.id;
    }

    // Apply filters
    if (type) filter.taskType = type;
    if (status) filter.status = status;
    if (assignee) filter.assignedTo = assignee;
    if (project) filter.project = project;
    if (priority) filter.priority = priority;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    console.log("🔍 Applied Filter:", filter);

    const tasks = await storage.getTasksByFilter(filter, {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
    });

    console.log("🔍 Total Tasks Found:", tasks ? tasks.length : 0);

    const userTimezone = await TimezoneHelper.getUserTimezone(user.id);

    // 🔄 Enhanced Debug: Log ALL task data with focus on recurring tasks
    if (tasks && tasks.length > 0) {
      console.log("🔄 === COMPLETE TASK DEBUG ANALYSIS ===");

      tasks.forEach((task, index) => {
        console.log(`🔍 Task ${index + 1}:`, {
          id: task._id,
          title: task.title,
          taskType: task.taskType,
          isRecurring: task.isRecurring,
          status: task.status,

          // Due Date Fields Debug
          dueDate: task.dueDate,
          dueDateType: typeof task.dueDate,
          dueDateValue: task.dueDate ? task.dueDate.toString() : "NULL",

          // Recurring Specific Fields
          nextDueDate: task.nextDueDate,
          nextDueDateType: typeof task.nextDueDate,
          nextDueDateValue: task.nextDueDate
            ? task.nextDueDate.toString()
            : "NULL",

          // Recurrence Pattern
          recurrencePattern: task.recurrencePattern,
          hasRecurrencePattern: !!task.recurrencePattern,

          // Date Analysis
          hasDueDate: !!task.dueDate,
          hasNextDueDate: !!task.nextDueDate,
          isValidDueDate: task.dueDate instanceof Date,
          isValidNextDueDate: task.nextDueDate instanceof Date,

          // Frontend Display Logic Test
          calculatedDisplayDate: task.isRecurring
            ? task.nextDueDate || task.dueDate
            : task.dueDate,

          // Complete Raw Object for Debugging
          fullTask: JSON.stringify(task, null, 2),
        });

        // Special focus on recurring tasks
        if (task.isRecurring) {
          console.log("🔄 RECURRING TASK DEEP ANALYSIS:", {
            taskId: task._id,
            title: task.title,

            // Date Validation
            originalDueDateExists: !!task.dueDate,
            nextDueDateExists: !!task.nextDueDate,

            // Date Values
            originalDueDate: task.dueDate,
            nextDueDate: task.nextDueDate,

            // Pattern Analysis
            recurrencePattern: task.recurrencePattern,
            frequency: task.recurrencePattern?.frequency,
            interval: task.recurrencePattern?.interval,

            // Status
            currentStatus: task.status,

            // What Frontend Should Display
            shouldDisplayDate: task.nextDueDate || task.dueDate,
            shouldDisplayDateFormatted: task.nextDueDate
              ? TimezoneHelper.formatInTimezone(
                  new Date(task.nextDueDate),
                  userTimezone,
                )
              : task.dueDate
                ? TimezoneHelper.formatInTimezone(
                    new Date(task.dueDate),
                    userTimezone,
                  )
                : "No Date",

            // Database State Check
            mongoDbState: {
              _id: task._id,
              dueDate: task.dueDate,
              nextDueDate: task.nextDueDate,
              isRecurring: task.isRecurring,
              taskType: task.taskType,
            },
          });
        }
      });

      // Summary Analysis
      const recurringTasks = tasks.filter((task) => task.isRecurring);
      const tasksWithDueDate = tasks.filter((task) => task.dueDate);
      const tasksWithNextDueDate = tasks.filter((task) => task.nextDueDate);
      const recurringTasksWithDueDate = recurringTasks.filter(
        (task) => task.dueDate,
      );
      const recurringTasksWithNextDueDate = recurringTasks.filter(
        (task) => task.nextDueDate,
      );

      console.log("📊 TASK SUMMARY ANALYSIS:", {
        totalTasks: tasks.length,
        recurringTasks: recurringTasks.length,
        tasksWithDueDate: tasksWithDueDate.length,
        tasksWithNextDueDate: tasksWithNextDueDate.length,
        recurringTasksWithDueDate: recurringTasksWithDueDate.length,
        recurringTasksWithNextDueDate: recurringTasksWithNextDueDate.length,

        // Problem Detection
        recurringTasksWithoutAnyDate: recurringTasks.filter(
          (task) => !task.dueDate && !task.nextDueDate,
        ).length,
        problemTasks: recurringTasks
          .filter((task) => !task.dueDate && !task.nextDueDate)
          .map((task) => ({
            id: task._id,
            title: task.title,
            taskType: task.taskType,
            isRecurring: task.isRecurring,
          })),
      });

      console.log("🔄 === END TASK DEBUG ANALYSIS ===");
    }

    console.log(
      "✅ Sending response to frontend with",
      tasks ? tasks.length : 0,
      "tasks",
    );

    res.json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    console.error("❌ Error fetching tasks:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch tasks",
      error: error.message,
    });
  }
};

export const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    console.log("DEBUG - getTaskById controller called with id:", id);
    const task = await storage.getTaskById(id);
    console.log(
      "DEBUG - Controller received task with subtasks:",
      task?.subtasks ? task.subtasks.length : "undefined",
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Check if user has access to this task
    // Handle organization-based access control with proper null checks
    if (task.organization && user.organizationId) {
      // Handle both populated and non-populated organization field
      const taskOrgId = getTaskOrganizationId(task.organization);
      const userOrgId = user.organizationId?.toString() || user.organizationId;

      if (taskOrgId !== userOrgId) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }
    } else if (!task.organization && !user.organizationId) {
      // For individual users without organization, check if they have access to the task
      const userId = user.id?.toString() || user._id?.toString();
      const createdById =
        task.createdBy?._id?.toString() || task.createdBy?.toString();
      const assignedToId =
        task.assignedTo?._id?.toString() || task.assignedTo?.toString();

      // Check if user is creator, assignee, collaborator, or contributor
      const isCreator = createdById === userId;
      const isAssignee = assignedToId === userId;
      const isCollaborator = task.collaborators?.some(
        (collab) => (collab._id?.toString() || collab.toString()) === userId,
      );
      const isContributor = task.contributors?.some(
        (contrib) => (contrib._id?.toString() || contrib.toString()) === userId,
      );

      if (!isCreator && !isAssignee && !isCollaborator && !isContributor) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // If it's an approval task, get approval details
    if (task.isApprovalTask) {
      const approvals = await storage.getTaskApprovals(id);
      task.approvalDetails = approvals;
    }

    // Convert task to plain object to allow modification
    let taskData = task.toObject ? task.toObject() : { ...task };

    // If task has a form attached, get current user's submission only
    if (taskData.attached_form_version_id) {
      try {
        const FormSubmission = (
          await import("../modals/formSubmissionModal.js")
        ).FormSubmission;
        const formVersionId =
          taskData.attached_form_version_id._id ||
          taskData.attached_form_version_id;

        const userSubmission = await FormSubmission.findOne({
          form_version_id: formVersionId,
          submitted_by: user.userId,
          $or: [{ source_task_id: id }, { source_subtask_id: id }],
        }).select("_id status submitted_at");

        // Replace form_submission_id with current user's submission only
        if (userSubmission) {
          taskData.form_submission_id = userSubmission._id;
          taskData.form_submission_status = userSubmission.status;
        } else {
          taskData.form_submission_id = null;
          taskData.form_submission_status = null;
        }
      } catch (formError) {
        console.error("Error fetching user form submission:", formError);
        // Don't fail the whole request, just set to null
        taskData.form_submission_id = null;
        taskData.form_submission_status = null;
      }
    }

    // Get recent activities for this task
    const activities = await storage.getActivitiesForTask(id, 20);
    taskData.activities = activities;

    console.log(
      "DEBUG - Final task response has subtasks:",
      taskData?.subtasks ? taskData.subtasks.length : "undefined",
    );

    // Normalize user fields to ensure frontend gets objects instead of raw IDs
    const normalizeUser = (u) => {
      if (!u) return null;
      // If already populated object
      if (typeof u === "object") {
        return {
          id: u._id
            ? u._id.toString
              ? u._id.toString()
              : u._id
            : u.id || null,
          firstName: u.firstName || u.firstName || "",
          lastName: u.lastName || u.lastName || "",
          email: u.email || u.email || "",
          avatar: u.avatar || u.profileImageUrl || null,
        };
      }
      // If it's an ID string, return as id only
      return { id: u };
    };

    // Normalize top-level users
    taskData.assignedTo = normalizeUser(taskData.assignedTo);
    taskData.createdBy = normalizeUser(taskData.createdBy);

    // Normalize collaborators array
    if (taskData.collaborators && Array.isArray(taskData.collaborators)) {
      taskData.collaborators = taskData.collaborators.map((c) =>
        normalizeUser(c),
      );
    }

    // Normalize approvers array
    if (taskData.approvers && Array.isArray(taskData.approvers)) {
      taskData.approvers = taskData.approvers.map((a) =>
        normalizeUser(a)
      );
    }

    // Normalize approverOrder array
    if (taskData.approverOrder && Array.isArray(taskData.approverOrder)) {
      taskData.approverOrder = taskData.approverOrder.map((ao) => ({
        ...ao,
        approverId: normalizeUser(ao.approverId)
      }));
    }

    // Normalize approvalDecisions array
    if (taskData.approvalDecisions && Array.isArray(taskData.approvalDecisions)) {
      taskData.approvalDecisions = taskData.approvalDecisions.map((ad) => ({
        ...ad,
        approverId: normalizeUser(ad.approverId)
      }));
    }

    // Ensure parent task title is available (if parentTaskId populated earlier in storage)
    console.log("DEBUG - parentTaskId type and value:", {
      type: typeof taskData.parentTaskId,
      value: taskData.parentTaskId,
      isObject: typeof taskData.parentTaskId === "object",
      hasTitle: taskData.parentTaskId?.title,
    });

    if (taskData.parentTaskId) {
      if (typeof taskData.parentTaskId === "object") {
        taskData.parentTaskTitle = taskData.parentTaskId.title || null;
        taskData.parentTask = {
          id: taskData.parentTaskId._id
            ? taskData.parentTaskId._id.toString()
            : taskData.parentTaskId,
          title: taskData.parentTaskId.title || "",
        };
      } else if (typeof taskData.parentTaskId === "string") {
        // If it's a string ID, just keep it as is (frontend can fallback)
        taskData.parentTaskTitle = taskData.parentTaskTitle || null;
      }
    }

    // Normalize subtasks' user fields and collaborators
    if (taskData.subtasks && Array.isArray(taskData.subtasks)) {
      taskData.subtasks = taskData.subtasks.map((st) => {
        const copy = { ...st };
        copy.assignedTo = normalizeUser(copy.assignedTo);
        copy.createdBy = normalizeUser(copy.createdBy);
        if (copy.collaborators && Array.isArray(copy.collaborators)) {
          copy.collaborators = copy.collaborators.map((c) => normalizeUser(c));
        }
        return copy;
      });
    }

    res.json({ success: true, data: taskData });
  } catch (error) {
    console.error("Error fetching task:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch task",
      error: error.message,
    });
  }
};

export const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const updates = req.body;
    const uploadedFiles = req.files; // 🆕 Get uploaded files from multer

    console.log("🔄 [UPDATE TASK] =================================");
    console.log("🔄 [UPDATE TASK] REQUEST RECEIVED");
    console.log("🔄 [UPDATE TASK] Method:", req.method);
    console.log("🔄 [UPDATE TASK] URL:", req.originalUrl);
    console.log("🔄 [UPDATE TASK] Task ID from params:", id);
    console.log(
      "🔄 [UPDATE TASK] Request Body:",
      JSON.stringify(updates, null, 2),
    );
    console.log("🔄 [UPDATE TASK] User:", user?.email || "Unknown");
    console.log("🔄 [UPDATE TASK] =================================");
    console.log("📝 [UPDATE TASK] Starting task update...");
    console.log("📝 [UPDATE TASK] Task ID:", id);
    console.log(
      "📝 [UPDATE TASK] Has uploaded files:",
      !!uploadedFiles && uploadedFiles.length > 0,
    );
    if (uploadedFiles && uploadedFiles.length > 0) {
      console.log("📝 [UPDATE TASK] Files count:", uploadedFiles.length);
    }

    // 👥 Parse contributorIds for update (handle array, JSON string, or FormData array)
    console.log("👥 [UPDATE CONTRIBUTORS] Parsing contributor updates...");
    if (updates.contributorIds) {
      console.log(
        "👥 [UPDATE CONTRIBUTORS] Raw contributorIds:",
        updates.contributorIds,
      );
      console.log(
        "👥 [UPDATE CONTRIBUTORS] Type:",
        typeof updates.contributorIds,
      );

      if (Array.isArray(updates.contributorIds)) {
        // Already an array
        console.log(
          "👥 [UPDATE CONTRIBUTORS] Already array:",
          updates.contributorIds,
        );
      } else if (typeof updates.contributorIds === "string") {
        try {
          // Try JSON parsing first
          const parsed = JSON.parse(updates.contributorIds);
          updates.contributorIds = Array.isArray(parsed) ? parsed : [parsed];
          console.log(
            "👥 [UPDATE CONTRIBUTORS] Parsed from JSON:",
            updates.contributorIds,
          );
        } catch (e) {
          // Not valid JSON, treat as single ID string
          updates.contributorIds = [updates.contributorIds];
          console.log(
            "👥 [UPDATE CONTRIBUTORS] Single string ID:",
            updates.contributorIds,
          );
        }
      }
    }
    console.log(
      "👥 [UPDATE CONTRIBUTORS] Final contributors for update:",
      updates.contributorIds,
    );

    const task = await storage.getTaskById(id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // ❌ VALIDATION: Task is DONE - no edits allowed (status, priority, subtask, etc.)
    if (task.status === "DONE") {
      console.log("❌ [UPDATE TASK] Task is already completed, cannot edit");
      return res.status(400).json({
        success: false,
        message:
          "Task is already completed. Completed tasks cannot be edited (status, priority, due date, etc.). No changes allowed.",
      });
    }

    // 🔐 ROLE-BASED PERMISSION VALIDATION FOR TASK UPDATES
    console.log("🔐 [UPDATE TASK] =================================");
    console.log("🔐 [UPDATE TASK] User:", user.email || "Unknown");
    console.log("🔐 [UPDATE TASK] User Role:", user.role);
    console.log("🔐 [UPDATE TASK] Task ID:", id);
    console.log("🔐 [UPDATE TASK] Task Assigned To:", task.assignedTo);
    console.log("🔐 [UPDATE TASK] Task Created By:", task.createdBy);

    const userRole = getHighestPriorityRole(user.role);
    const userId = user.id.toString();
    // Handle both populated objects and raw ObjectIds
    const taskAssignedTo =
      task.assignedTo?._id?.toString() || task.assignedTo?.toString();
    const taskCreatedBy =
      task.createdBy?._id?.toString() || task.createdBy?.toString();

    console.log("🔐 [UPDATE TASK] Highest Priority Role:", userRole);
    console.log("🔐 [UPDATE TASK] User ID:", userId);
    console.log(
      "🔐 [UPDATE TASK] Task Assigned To (resolved):",
      taskAssignedTo,
    );
    console.log("🔐 [UPDATE TASK] Task Created By (resolved):", taskCreatedBy);

    // 🚫 CONTRIBUTORS PERMISSION CHECK: Recurring task contributors cannot edit
    if (task.isRecurring && task.contributors) {
      const isContributor = task.contributors.some((contributor) => {
        const contribId =
          contributor?._id?.toString() || contributor?.toString();
        return contribId === userId;
      });

      if (
        isContributor &&
        !(taskAssignedTo === userId || taskCreatedBy === userId)
      ) {
        console.error(
          "🔐 [UPDATE TASK] ❌ PERMISSION DENIED - Contributors cannot edit recurring tasks",
        );
        console.log("🔐 [UPDATE TASK] =================================");
        return res.status(403).json({
          success: false,
          message:
            "Access denied: Contributors cannot edit tasks. They have read-only access.",
        });
      }
    }

    // Individual User / Employee: Can only update own tasks
    if (
      [
        "individual",
        "individual-user",
        "employee",
        "company-user",
        "user",
        "normal-user",
      ].includes(userRole)
    ) {
      console.log(
        "🔐 [UPDATE TASK] Role Type: Individual/Employee - checking ownership",
      );

      if (taskAssignedTo !== userId && taskCreatedBy !== userId) {
        console.error("🔐 [UPDATE TASK] ❌ PERMISSION DENIED - Not task owner");
        console.log("🔐 [UPDATE TASK] =================================");
        return res.status(403).json({
          success: false,
          message:
            "Access denied: You can only update tasks assigned to you or created by you.",
        });
      }

      console.log("🔐 [UPDATE TASK] ✅ Task ownership verified");
    }

    // Manager: Can update own + subordinate tasks (TODO: requires manager-subordinate mapping)
    // For now, managers can update tasks in their organization
    if (userRole === "manager") {
      console.log(
        "🔐 [UPDATE TASK] Role Type: Manager - checking organization access",
      );
      // Organization check will be done below
    }

    // Company Admin / Org Admin: Can update any task in organization
    if (["company-admin", "org_admin", "admin"].includes(userRole)) {
      console.log(
        "🔐 [UPDATE TASK] Role Type: Company Admin - full organization access",
      );
      // Organization check will be done below
    }

    // Super Admin: No direct task access (internal admin only)
    if (["super-admin", "super_admin", "tasksetu-admin"].includes(userRole)) {
      console.error(
        "🔐 [UPDATE TASK] ❌ PERMISSION DENIED - Super Admin should not access task operations",
      );
      console.log("🔐 [UPDATE TASK] =================================");
      return res.status(403).json({
        success: false,
        message:
          "Access denied: Super Admins do not have access to task operations.",
      });
    }

    console.log("🔐 [UPDATE TASK] ✅ Role-based permission check passed");

    // Check organization permissions
    if (task.organization && user.organizationId) {
      const taskOrgId = getTaskOrganizationId(task.organization);
      const userOrgId = user.organizationId?.toString() || user.organizationId;

      console.log("🔐 [UPDATE TASK] Checking organization match...");
      console.log("🔐 [UPDATE TASK] Task Org:", taskOrgId);
      console.log("🔐 [UPDATE TASK] User Org:", userOrgId);

      if (taskOrgId !== userOrgId) {
        console.error(
          "🔐 [UPDATE TASK] ❌ PERMISSION DENIED - Organization mismatch",
        );
        console.log("🔐 [UPDATE TASK] =================================");
        return res.status(403).json({
          success: false,
          message:
            "Access denied: You do not have permission to update tasks from other organizations.",
        });
      }

      console.log("🔐 [UPDATE TASK] ✅ Organization check passed");
    } else if (!task.organization && !user.organizationId) {
      // For individual users without organization, check if they created the task
      console.log("🔐 [UPDATE TASK] No organization - checking task creator");

      if (taskCreatedBy && userId && taskCreatedBy !== userId) {
        console.error(
          "🔐 [UPDATE TASK] ❌ PERMISSION DENIED - Not task creator",
        );
        console.log("🔐 [UPDATE TASK] =================================");
        return res.status(403).json({
          success: false,
          message: "Access denied: You can only update your own tasks.",
        });
      }

      console.log("🔐 [UPDATE TASK] ✅ Task creator check passed");
    }

    console.log("🔐 [UPDATE TASK] ✅ ALL PERMISSION CHECKS PASSED");
    console.log("🔐 [UPDATE TASK] =================================");

    // ✅ Validate title if present in updates (enforce same max length as creation)
    if (updates.title !== undefined) {
      if (!updates.title || updates.title.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Task title is required",
        });
      }

      if (updates.title.length > 100) {
        return res.status(400).json({
          success: false,
          message: "Task title cannot exceed 100 characters",
        });
      }
    }

    // ✅ APPROVAL TASK VALIDATIONS (Spec 4.5)
    if (task.isApprovalTask) {
      const userRoles = Array.isArray(user.role) ? user.role : [user.role];
      const isAdmin = userRoles.some((r) =>
        ["super_admin", "org_admin"].includes(r),
      );

      // 1. Prevent approval task -> regular task conversion
      if (updates.taskType && updates.taskType !== "approval") {
        return res.status(400).json({
          success: false,
          message:
            "Cannot convert approval task to another type. Approval tasks are immutable once created.",
          error: "APPROVAL_TASK_IMMUTABLE",
        });
      }

      // 2. Lock approvers after first decision (admin override allowed)
      const hasDecisions =
        task.approvalDecisions && task.approvalDecisions.length > 0;
      if (hasDecisions && updates.approvers) {
        if (!isAdmin) {
          return res.status(403).json({
            success: false,
            message:
              "Cannot change approvers after first decision. Contact admin for override.",
            error: "APPROVERS_LOCKED",
            existingDecisions: task.approvalDecisions.length,
          });
        } else {
          console.warn(
            `⚠️  ADMIN OVERRIDE: ${user.email} changing approvers on task ${id} with ${task.approvalDecisions.length} existing decisions`,
          );
          // ✅ Log audit entry for admin override (optional: implement audit log here)
        }
      }

      // 3. Validate due date is not in the past (for new due dates)
      if (updates.dueDate) {
        const newDueDate = new Date(updates.dueDate);
        const userTimezone = await TimezoneHelper.getUserTimezone(user.id);
        const { startOfDay: today } =
          TimezoneHelper.getDayBoundaries(userTimezone);

        if (newDueDate < today) {
          return res.status(400).json({
            success: false,
            message: "Approval task due date must be today or later",
            error: "INVALID_DUE_DATE",
            providedDate: updates.dueDate,
          });
        }
      }

      console.log("✅ [APPROVAL TASK] All approval task validations passed");
    }

    // 🔄 Recurring Task Contributors Validation for Updates (PRD 4.3)
    // Contributors: Multiple non-assigning users with visibility + notifications only
    if (
      task.isRecurring &&
      updates.contributorIds &&
      updates.contributorIds.length > 0 &&
      user.organizationId
    ) {
      console.log(
        "🔄 [RECURRING CONTRIBUTORS UPDATE] Validating contributors for recurring task:",
        updates.contributorIds,
      );

      const User = (await import("../modals/userModal.js")).User;
      const assignedToId =
        updates.assignedTo?.toString?.() ||
        updates.assignedTo ||
        task.assignedTo?.toString() ||
        task.assignedTo;

      for (const contributorId of updates.contributorIds) {
        try {
          // Validate contributor exists
          const contributor = await User.findById(contributorId)
            .select("_id organization_id")
            .lean();

          if (!contributor) {
            console.error(
              "❌ [RECURRING CONTRIBUTORS UPDATE] User not found:",
              contributorId,
            );
            return res.status(400).json({
              success: false,
              message: `Contributor with ID ${contributorId} does not exist`,
              error: "INVALID_CONTRIBUTOR",
            });
          }

          // Verify contributor is in same organization
          const contributorOrgId = contributor.organization_id?.toString();
          const userOrgId = user.organizationId?.toString();

          if (contributorOrgId !== userOrgId) {
            console.error(
              "❌ [RECURRING CONTRIBUTORS UPDATE] Contributor not in same organization:",
              {
                contributorId,
                contributorOrgId,
                userOrgId,
              },
            );
            return res.status(400).json({
              success: false,
              message: `Contributor must be from the same organization`,
              error: "CONTRIBUTOR_ORG_MISMATCH",
            });
          }

          // Verify contributor is different from assignee
          if (contributorId.toString() === assignedToId.toString()) {
            console.error(
              "❌ [RECURRING CONTRIBUTORS UPDATE] Contributor cannot be the same as assignee:",
              contributorId,
            );
            return res.status(400).json({
              success: false,
              message: `Contributor cannot be the same as the assignee`,
              error: "CONTRIBUTOR_ASSIGNEE_CONFLICT",
            });
          }

          console.log(
            "✅ [RECURRING CONTRIBUTORS UPDATE] Valid contributor:",
            contributorId,
          );
        } catch (validationError) {
          console.error(
            "❌ [RECURRING CONTRIBUTORS UPDATE] Error validating contributor:",
            validationError,
          );
          return res.status(500).json({
            success: false,
            message: "Error validating recurring task contributor",
            error: validationError.message,
          });
        }
      }

      console.log(
        "✅ [RECURRING CONTRIBUTORS UPDATE] All contributors validated for recurring task",
      );
    }

    const prevAssignee =
      task.assignedTo?._id?.toString() || task.assignedTo?.toString();
    const prevStatus = task.status;
    const prevTimeEstimate = task.timeEstimate; // Capture previous estimate for activity tracking

    console.log("📊 [UPDATE TASK] Tracked previous values:", {
      prevStatus,
      prevAssignee,
      prevTimeEstimate,
      taskTitle: task.title,
      updatesIncludeEstimate: updates.timeEstimate !== undefined,
    });

    const updateData = {
      ...updates,
      updatedAt: new Date(),
    };
    // Parse dueDate/startDate treating no-timezone strings as UTC (prevent server local-time shift)
    const parseDueDateAsUTC = (dateStr) => {
      if (!dateStr) return null;
      const str = String(dateStr).trim();
      const hasTimezone = /[Zz]$|(T\d{2}:\d{2}(:\d{2})?(\.[0-9]+)?[+-]\d{2}:?\d{2})$/.test(str);
      const normalised = hasTimezone ? str : str + 'Z';
      const d = new Date(normalised);
      return isNaN(d.getTime()) ? null : d;
    };
    if (updates.dueDate) updateData.dueDate = parseDueDateAsUTC(updates.dueDate);
    if (updates.startDate) updateData.startDate = parseDueDateAsUTC(updates.startDate);

    // 🆕 Handle file uploads if present
    if (uploadedFiles && uploadedFiles.length > 0) {
      console.log("📎 [UPDATE TASK] Processing uploaded files...");

      // Get existing attachments
      const existingAttachments = task.attachments || [];

      // Create new attachment objects
      const newAttachments = uploadedFiles.map((file) => ({
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype,
        url: `/uploads/${file.filename}`,
        uploadedBy: user.id,
        uploadedAt: new Date(),
        version: 1,
        deleted: false,
      }));

      console.log("📎 [UPDATE TASK] New attachments:", newAttachments.length);

      // Merge with existing attachments
      updateData.attachments = [...existingAttachments, ...newAttachments];

      console.log(
        "📎 [UPDATE TASK] Total attachments after merge:",
        updateData.attachments.length,
      );
    }

    // 🔄 Handle contributors update for recurring tasks
    if (updates.contributorIds && updates.contributorIds.length >= 0) {
      console.log(
        "🔄 [UPDATE TASK] Processing contributors update:",
        updates.contributorIds,
      );
      updateData.contributors = updates.contributorIds;
    }

    console.log(
      "DEBUG - updateTask: Update data keys:",
      Object.keys(updateData),
    );
    console.log("DEBUG - updateTask: Has comments:", !!updateData.comments);
    console.log("DEBUG - updateTask: Has assignedTo:", !!updateData.assignedTo);
    console.log("DEBUG - updateTask: Has status:", !!updateData.status);

    // ✅ If status is being updated, validate against organization status configs
    if (updates.status !== undefined && updates.status !== null) {
      const normalized = String(updates.status).trim().toUpperCase();

      // ✅ SUBTASK COMPLETION VALIDATION
      // Ensure all subtasks are completed before marking parent as DONE
      if (["DONE", "COMPLETED"].includes(normalized)) {
        if (task.subtasks && task.subtasks.length > 0) {
          const incompleteSubtasks = task.subtasks.filter((st) => {
            const stStatus = String(st.status || "OPEN").toUpperCase();
            return !["DONE", "COMPLETED", "CANCELLED"].includes(stStatus);
          });

          if (incompleteSubtasks.length > 0) {
            console.log(
              "❌ Cannot complete task - incomplete subtasks found:",
              incompleteSubtasks.length,
            );
            return res.status(400).json({
              success: false,
              message: `Cannot mark task as completed. There are ${incompleteSubtasks.length} incomplete subtask(s). Please complete them first.`,
              incompleteSubtasks: incompleteSubtasks.length,
            });
          }
        }

        // ✅ MILESTONE LINKED TASKS VALIDATION
        // A milestone cannot be marked as "Done" until all linked tasks are completed
        if (
          task.taskType === "milestone" ||
          task.mainTaskType === "milestone"
        ) {
          const linkedTaskIds =
            task.linkedTasks || task.milestoneData?.linkedTaskIds || [];
          if (linkedTaskIds.length > 0) {
            const Task = (await import("../modals/taskModal.js")).default;
            const linkedTasks = await Task.find({
              _id: { $in: linkedTaskIds },
              isDeleted: { $ne: true },
            })
              .select("_id title status")
              .lean();

            const incompleteLinked = linkedTasks.filter((lt) => {
              const ltStatus = String(lt.status || "OPEN").toUpperCase();
              return !["DONE", "COMPLETED", "CANCELLED"].includes(ltStatus);
            });

            if (incompleteLinked.length > 0) {
              console.log(
                "❌ Cannot complete milestone - incomplete linked tasks:",
                incompleteLinked.length,
              );
              return res.status(400).json({
                success: false,
                message: `Cannot mark milestone as Done. ${incompleteLinked.length} linked task(s) are still pending.`,
                error: "MILESTONE_LINKED_TASKS_INCOMPLETE",
                incompleteLinkedTasks: incompleteLinked.map((t) => ({
                  id: t._id,
                  title: t.title,
                  status: t.status,
                })),
              });
            }
          }
        }
      }

      const orgIdForStatus = task.organization || user.organizationId;

      if (orgIdForStatus) {
        await ensureDefaultTaskStatusConfigs(orgIdForStatus, user.id);
        const statusCfg = await TaskStatusConfig.findOne({
          organizationId: orgIdForStatus,
          code: normalized,
          active: true,
        }).lean();

        if (!statusCfg) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid status. Please select a valid status from the list.",
          });
        }

        // ✅ STATUS LIFECYCLE VALIDATION - Check allowedTransitions
        const currentStatusCode = String(task.status || "")
          .trim()
          .toUpperCase();
        let currentStatusConfig = null;

        if (currentStatusCode && currentStatusCode !== normalized) {
          currentStatusConfig = await TaskStatusConfig.findOne({
            organizationId: orgIdForStatus,
            code: currentStatusCode,
            active: true,
          }).lean();

          if (currentStatusConfig) {
            // Layer 1: Check allowedTransitions array
            if (
              Array.isArray(currentStatusConfig.allowedTransitions) &&
              currentStatusConfig.allowedTransitions.length > 0
            ) {
              const isTransitionAllowed =
                currentStatusConfig.allowedTransitions.includes(normalized);

              console.log("🔍 [UPDATE TASK] Transition Workflow Validation:", {
                currentStatus: currentStatusCode,
                requestedStatus: normalized,
                allowedTransitions: currentStatusConfig.allowedTransitions,
                isAllowed: isTransitionAllowed,
              });

              if (!isTransitionAllowed) {
                console.log("❌ [UPDATE TASK] Status transition not allowed");
                return res.status(400).json({
                  success: false,
                  message: `Cannot change status from "${currentStatusConfig.label}" to "${statusCfg.label}". This transition is not allowed.`,
                  error: "TRANSITION_NOT_ALLOWED",
                  currentStatus: currentStatusConfig.label,
                  requestedStatus: statusCfg.label,
                  allowedTransitions: currentStatusConfig.allowedTransitions,
                });
              }

              console.log("✅ [UPDATE TASK] Status transition allowed");
            }

            // Layer 2: Prevent reverse status flow
            const statusHierarchy = {
              OPEN: 1,
              INPROGRESS: 2,
              ONHOLD: 2,
              DONE: 3,
              CANCELLED: 3,
            };

            const currentLevel = statusHierarchy[currentStatusCode];
            const newLevel = statusHierarchy[normalized];

            if (currentLevel > newLevel && currentStatusCode !== "ONHOLD") {
              console.log("❌ [UPDATE TASK] Reverse status flow not allowed");
              return res.status(400).json({
                success: false,
                message: `Cannot move task backwards from "${currentStatusConfig.label}" to "${statusCfg.label}". Please follow the proper workflow.`,
                error: "REVERSE_FLOW_NOT_ALLOWED",
              });
            }

            // Layer 3: Lock final statuses (DONE, CANCELLED)
            if (currentStatusConfig.isFinal === true) {
              console.log("❌ [UPDATE TASK] Cannot change from final status");
              return res.status(400).json({
                success: false,
                message: `Cannot change status from "${currentStatusConfig.label}". This is a final status.`,
                error: "FINAL_STATUS_LOCKED",
              });
            }
          }
        }
      }

      updates.status = normalized;
      updateData.status = normalized;

      // ✅ Auto-set progress to 100% if marked as DONE
      if (["DONE", "COMPLETED"].includes(normalized)) {
        updates.progress = 100;
        updateData.progress = 100;
      }
    }

    // ✅ If priority is being updated, validate against organization priority configs
    if (updates.priority !== undefined && updates.priority !== null) {
      const normalized = String(updates.priority).trim().toLowerCase();
      const orgIdForPriority = task.organization || user.organizationId;

      if (orgIdForPriority) {
        await ensureDefaultTaskPriorityConfigs(orgIdForPriority, user.id);
        const priorityCfg = await TaskPriorityConfig.findOne({
          organizationId: orgIdForPriority,
          code: normalized,
          active: true,
        }).lean();

        if (!priorityCfg) {
          console.error("❌ INVALID PRIORITY UPDATE ATTEMPT:", {
            requestedPriority: normalized,
            taskId: id,
            userId: user.id,
            orgId: orgIdForPriority,
          });
          return res.status(400).json({
            success: false,
            message: `Invalid priority "${normalized}". Please select a valid priority from the list.`,
          });
        }
      }

      updates.priority = normalized;
      updateData.priority = normalized;
    }

    const updatedTask = await storage.updateTask(id, updateData, user.id);

    // 🔗 MILESTONE DUE DATE SYNC: If this task is linked to a milestone, update milestone's due date
    if (updates.dueDate || updates.status) {
      try {
        console.log(
          "🔗 [MILESTONE SYNC] Checking if task is linked to a milestone...",
        );

        // Find milestones that have this task linked
        const linkedMilestones = await Task.find(
          {
            isMilestone: true,
            milestoneType: "linked",
            linkedTasks: id,
            status: { $ne: "DONE" }, // Only update active (not completed) milestones
          },
          { _id: 1, title: 1, status: 1, linkedTasks: 1 },
        ).lean();

        console.log(
          "🔗 [MILESTONE SYNC] Found linked milestones:",
          linkedMilestones.length,
        );

        for (const milestone of linkedMilestones) {
          try {
            console.log("🔗 [MILESTONE SYNC] Processing milestone:", {
              milestoneId: milestone._id,
              title: milestone.title,
              linkedTasksCount: milestone.linkedTasks?.length || 0,
            });

            // Fetch all linked tasks to calculate new due date
            const linkedTasksData = await Task.find(
              { _id: { $in: milestone.linkedTasks } },
              { dueDate: 1, title: 1, status: 1 },
            ).lean();

            console.log(
              "🔗 [MILESTONE SYNC] Fetched linked tasks data:",
              linkedTasksData.length,
            );

            if (linkedTasksData && linkedTasksData.length > 0) {
              // Filter tasks with valid due dates and sort by due date (descending)
              const dueDates = linkedTasksData
                .filter((task) => task.dueDate)
                .map((task) => ({
                  dueDate: new Date(task.dueDate),
                  title: task.title,
                }))
                .sort((a, b) => b.dueDate - a.dueDate);

              if (dueDates.length > 0) {
                const latestDueDate = dueDates[0].dueDate;
                console.log(
                  "🔗 [MILESTONE SYNC] Calculated new milestone due date:",
                  {
                    latestDueDate: latestDueDate.toISOString(),
                    tasksConsidered: dueDates.length,
                  },
                );

                // Update milestone's due date
                const updatedMilestone = await Task.findByIdAndUpdate(
                  milestone._id,
                  { $set: { dueDate: latestDueDate, updatedAt: new Date() } },
                  { new: true },
                );

                console.log("✅ [MILESTONE SYNC] Updated milestone due date:", {
                  milestoneId: milestone._id,
                  title: milestone.title,
                  newDueDate: latestDueDate.toISOString(),
                });

                // Optional: Track activity for milestone due date change
                try {
                  await storage.trackActivity({
                    activityType: "MILESTONE_DUE_DATE_UPDATED",
                    userId: user.id,
                    organizationId: task.organization,
                    relatedId: milestone._id,
                    relatedType: "task",
                    data: {
                      milestoneId: milestone._id,
                      milestoneTitle: milestone.title,
                      triggeredBy: id,
                      triggeredByTitle: task.title,
                      newDueDate: latestDueDate.toISOString(),
                      reason: "Linked task due date changed",
                    },
                  });
                } catch (activityError) {
                  console.warn(
                    "⚠️  [MILESTONE SYNC] Could not track milestone update activity:",
                    activityError.message,
                  );
                }
              } else {
                console.warn(
                  "⚠️  [MILESTONE SYNC] No linked tasks with valid due dates found",
                );
              }
            } else {
              console.warn(
                "⚠️  [MILESTONE SYNC] Could not fetch linked tasks data",
              );
            }
          } catch (milestoneError) {
            console.error(
              "❌ [MILESTONE SYNC] Error processing milestone:",
              milestoneError.message,
            );
          }
        }

        console.log(
          "✅ [MILESTONE SYNC] Milestone due date synchronization complete",
        );
      } catch (err) {
        console.error(
          "❌ [MILESTONE SYNC] Error in milestone sync:",
          err.message,
        );
        // Don't fail task update if milestone sync fails
      }
    }
    if (updates.timeEstimate !== undefined && updates.timeEstimate !== null) {
      const newTimeEstimate = updates.timeEstimate;

      // Only log if estimate actually changed
      if (prevTimeEstimate !== newTimeEstimate) {
        console.log("⏱️ [ESTIMATE CHANGE] Time estimate changed:", {
          taskId: id,
          taskTitle: task.title,
          oldEstimate: prevTimeEstimate,
          newEstimate: newTimeEstimate,
          changedBy: user.email,
        });

        try {
          await storage.trackActivity({
            activityType:
              ActivityHelper.ACTIVITY_TYPES.TASK_TIME_ESTIMATE_CHANGED,
            userId: user.id,
            organizationId: task.organization,
            relatedId: id,
            relatedType: "task",
            data: {
              taskId: id,
              taskTitle: task.title,
              oldValue: `${prevTimeEstimate}`,
              newValue: `${newTimeEstimate}`,
              changedBy: user.email,
            },
          });
          console.log("✅ [ESTIMATE CHANGE] Activity logged successfully");
        } catch (estimateActivityError) {
          console.error(
            "❌ [ESTIMATE CHANGE] Error logging estimate change activity:",
            estimateActivityError.message,
          );
        }
      }
    }

    // 📜 Log Audit Logs
    try {
      if (updates.status && prevStatus !== updates.status) {
        await auditLogger.logTaskStatusChanged(
          updatedTask,
          prevStatus,
          updates.status,
          user,
          req,
        );
      } else {
        // Log generic update with change keys
        const changeKeys = Object.keys(updates).filter(
          (k) => k !== "updatedAt",
        );
        if (changeKeys.length > 0) {
          await auditLogger.logTaskUpdated(
            updatedTask,
            { fields: changeKeys },
            user,
            req,
          );
        }
      }
    } catch (auditError) {
      console.error(
        "⚠️ [AUDIT] Error logging task update:",
        auditError.message,
      );
    }

    // Recalculate counters if assignee or status possibly changed
    const newAssignee =
      updates.assignedTo || updatedTask?.assignedTo || prevAssignee;
    if (newAssignee) {
      await recalcUserTaskCounters(prevAssignee);
      await recalcUserTaskCounters(newAssignee);
    } else {
      // If only status changed without reassignment, still recalc assignee
      await recalcUserTaskCounters(prevAssignee);
    }

    // ✅ Activity tracking is handled by storage.updateTask()
    // No need for duplicate tracking here
    // 🔔 Create notifications for task updates using enhanced helper
    const updateKeys = Object.keys(updateData);
    const isOnlyCommentUpdate =
      updateKeys.length === 2 && updateData.comments && updateData.updatedAt;
    const newAssigneeId =
      updates.assignedTo?._id?.toString() || updates.assignedTo?.toString();
    const wasReassigned =
      newAssigneeId && prevAssignee && prevAssignee !== newAssigneeId;
    const statusChanged = updates.status && prevStatus !== updates.status;

    try {
      NotificationLogger.logTaskUpdate(
        "USING_ENHANCED_HELPER",
        {
          taskId: id,
          updateKeys,
          wasReassigned,
          statusChanged,
          isCommentOnly: isOnlyCommentUpdate,
          prevAssignee: wasReassigned ? prevAssignee : undefined,
        },
        "START",
      );

      // Don't create update notifications if only comments are being updated
      if (!isOnlyCommentUpdate) {
        // Prepare change information
        const changes = {};
        if (wasReassigned) {
          changes.assignedTo = newAssigneeId;
          changes._prevAssignee = prevAssignee; // Pass old assignee for TASK_REASSIGNED notification
        }
        if (statusChanged) changes.status = updates.status;

        // Get all changed fields
        updateKeys.forEach((key) => {
          if (updateData[key] !== undefined && key !== "updatedAt") {
            changes[key] = updateData[key];
          }
        });

        // Use enhanced notification helper
        const notificationResult =
          await EnhancedNotificationHelper.notifyTaskUpdate(
            updatedTask,
            changes,
            user.id,
          );

        NotificationLogger.logTaskUpdate(
          "ENHANCED_NOTIFICATIONS_SENT",
          {
            taskId: id,
            usersNotified: notificationResult.length,
          },
          "SUCCESS",
        );
      } else {
        NotificationLogger.logTaskUpdate(
          "SKIPPED_COMMENT_ONLY_UPDATE",
          {
            taskId: id,
            reason: "Only comments were updated",
          },
          "SKIP",
        );
      }
    } catch (notificationError) {
      console.error(
        "Error creating task update notifications:",
        notificationError,
      );
      NotificationLogger.logTaskUpdate(
        "NOTIFICATION_ERROR",
        {
          error: notificationError.message,
        },
        "ERROR",
      );
      // Don't fail task update if notification fails
    }

    res.json({
      success: true,
      message: "Task updated successfully",
      data: updatedTask,
    });
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update task",
      error: error.message,
    });
  }
};

export const updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const user = req.user;

    console.log("🔍 UPDATE TASK STATUS API CALLED:", {
      taskId: id,
      newStatus: status,
      userId: user?.id,
      userName: user?.firstName + " " + user?.lastName,
      userRole: user?.role,
      timestamp: new Date().toISOString(),
    });

    if (status === undefined || status === null) {
      console.log("❌ Status validation failed - no status provided");
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    // Normalize to uppercase status CODE (DB-driven list per organization)
    const normalizedStatus = String(status).trim().toUpperCase();
    if (!normalizedStatus) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }
    console.log("🔍 Normalized status value:", { status, normalizedStatus });

    console.log("🔍 Fetching task from database...");
    const task = await storage.getTaskById(id);

    if (!task) {
      console.log("❌ Task not found in database:", id);
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    console.log("✅ Task found:", {
      taskId: task._id,
      currentStatus: task.status,
      newStatus: status,
      title: task.title,
      assignedTo: task.assignedTo,
      createdBy: task.createdBy,
    });

    // ❌ VALIDATION: Task is already DONE - no status changes allowed
    if (task.status === "DONE") {
      console.log("❌ Task is already completed, cannot change status");
      return res.status(400).json({
        success: false,
        message:
          "Task is already completed. Completed tasks cannot be edited or have their status changed.",
      });
    }

    // Check permissions
    console.log("🔍 Checking permissions...");
    if (task.organization && user.organizationId) {
      const taskOrgId = getTaskOrganizationId(task.organization);
      const userOrgId = user.organizationId?.toString() || user.organizationId;

      console.log("🔍 Organization permission check:", {
        taskOrgId,
        userOrgId,
      });

      if (taskOrgId !== userOrgId) {
        console.log("❌ Access denied - organization mismatch");
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }
    } else if (!task.organization && !user.organizationId) {
      // For individual users without organization, check if they created the task, are assigned to it, or are collaborators
      const userId = user.id?.toString() || user._id?.toString();
      const taskCreatedBy =
        task.createdBy?._id?.toString() || task.createdBy?.toString();
      const taskAssignedTo =
        task.assignedTo?._id?.toString() || task.assignedTo?.toString();

      const isCreator = taskCreatedBy === userId;
      const isAssignee = taskAssignedTo === userId;
      const isCollaborator = task.collaborators?.some(
        (collab) => (collab._id?.toString() || collab.toString()) === userId,
      );

      console.log("🔍 Individual user permission check:", {
        userId,
        taskCreatedBy,
        taskAssignedTo,
        isCreator,
        isAssignee,
        isCollaborator,
      });

      if (!isCreator && !isAssignee && !isCollaborator) {
        console.log(
          "❌ Access denied - not creator, assignee, or collaborator",
        );
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }
    }

    console.log("✅ Permission check passed");

    // ✅ SUBTASK COMPLETION VALIDATION
    // Ensure all subtasks are completed before marking parent as DONE
    if (["DONE", "COMPLETED"].includes(normalizedStatus)) {
      if (task.subtasks && task.subtasks.length > 0) {
        const incompleteSubtasks = task.subtasks.filter((st) => {
          const stStatus = String(st.status || "OPEN").toUpperCase();
          return !["DONE", "COMPLETED", "CANCELLED"].includes(stStatus);
        });

        if (incompleteSubtasks.length > 0) {
          console.log(
            "❌ Cannot complete task - incomplete subtasks found:",
            incompleteSubtasks.length,
          );
          return res.status(400).json({
            success: false,
            message: `Cannot mark task as completed. There are ${incompleteSubtasks.length} incomplete subtask(s). Please complete them first.`,
            incompleteSubtasks: incompleteSubtasks.length,
          });
        }
      }

      // ✅ MILESTONE LINKED TASKS VALIDATION
      // A milestone cannot be marked as "Done" until all linked tasks are completed
      if (task.taskType === "milestone" || task.mainTaskType === "milestone") {
        const linkedTaskIds =
          task.linkedTasks || task.milestoneData?.linkedTaskIds || [];
        if (linkedTaskIds.length > 0) {
          const Task = (await import("../modals/taskModal.js")).default;
          const linkedTasks = await Task.find({
            _id: { $in: linkedTaskIds },
            isDeleted: { $ne: true },
          })
            .select("_id title status")
            .lean();

          const incompleteLinked = linkedTasks.filter((lt) => {
            const ltStatus = String(lt.status || "OPEN").toUpperCase();
            return !["DONE", "COMPLETED", "CANCELLED"].includes(ltStatus);
          });

          if (incompleteLinked.length > 0) {
            console.log(
              "❌ Cannot complete milestone - incomplete linked tasks:",
              incompleteLinked.length,
            );
            return res.status(400).json({
              success: false,
              message: `Cannot mark milestone as Done. ${incompleteLinked.length} linked task(s) are still pending.`,
              error: "MILESTONE_LINKED_TASKS_INCOMPLETE",
              incompleteLinkedTasks: incompleteLinked.map((t) => ({
                id: t._id,
                title: t.title,
                status: t.status,
              })),
            });
          }
        }
      }
    }

    // ✅ Validate requested status against organization's DB-configured statuses
    // This ensures all dropdowns/filters across the app can rely on DB as the source of truth.
    const orgIdForStatus = task.organization || user.organizationId;
    if (orgIdForStatus) {
      await ensureDefaultTaskStatusConfigs(orgIdForStatus, user?.id || null);
      const statusConfig = await TaskStatusConfig.findOne({
        organizationId: orgIdForStatus,
        code: normalizedStatus,
        active: true,
      }).lean();

      if (!statusConfig) {
        console.log("❌ Status not found in TaskStatusConfig:", {
          orgIdForStatus,
          normalizedStatus,
        });
        return res.status(400).json({
          success: false,
          message:
            "Invalid status. Please select a valid status from the list.",
        });
      }

      // ✅ TRANSITION WORKFLOW VALIDATION
      // Check if the current status has allowedTransitions defined
      const currentStatusCode = String(task.status || "")
        .trim()
        .toUpperCase();
      let currentStatusConfig = null; // Declare outside to use in multiple validations

      // Fetch all status configs for label mapping
      const allStatusConfigs = await TaskStatusConfig.find({
        organizationId: orgIdForStatus,
        active: true,
      }).lean();

      if (currentStatusCode && currentStatusCode !== normalizedStatus) {
        currentStatusConfig = await TaskStatusConfig.findOne({
          organizationId: orgIdForStatus,
          code: currentStatusCode,
          active: true,
        }).lean();

        if (currentStatusConfig) {
          // If allowedTransitions is defined and not empty, validate transition
          if (
            Array.isArray(currentStatusConfig.allowedTransitions) &&
            currentStatusConfig.allowedTransitions.length > 0
          ) {
            const isTransitionAllowed =
              currentStatusConfig.allowedTransitions.includes(normalizedStatus);

            console.log("🔍 Transition Workflow Validation:", {
              currentStatus: currentStatusCode,
              requestedStatus: normalizedStatus,
              allowedTransitions: currentStatusConfig.allowedTransitions,
              isAllowed: isTransitionAllowed,
            });

            if (!isTransitionAllowed) {
              console.log("❌ Status transition not allowed");
              return res.status(400).json({
                success: false,
                message: `Cannot change status from "${currentStatusConfig.label}" to "${statusConfig.label}". This transition is not allowed.`,
                error: "TRANSITION_NOT_ALLOWED",
                allowedTransitions: currentStatusConfig.allowedTransitions
                  .map((code) => {
                    const s = allStatusConfigs.find((st) => st.code === code);
                    return s ? s.label : code;
                  })
                  .join(", "),
              });
            }

            console.log("✅ Status transition allowed");
          }

          // ✅ ADDITIONAL SAFETY: Prevent Reverse Status Flow
          // This is an extra validation layer to ensure no backward status changes
          const statusHierarchy = {
            OPEN: 1,
            INPROGRESS: 2,
            ONHOLD: 2, // Same level as INPROGRESS
            DONE: 3,
            CANCELLED: 3,
          };

          const currentLevel = statusHierarchy[currentStatusCode];
          const newLevel = statusHierarchy[normalizedStatus];

          // Prevent reverse flow: INPROGRESS/ONHOLD → OPEN
          if (currentLevel > newLevel && currentStatusCode !== "ONHOLD") {
            console.log("❌ Reverse status flow not allowed");
            return res.status(400).json({
              success: false,
              message: `Cannot move task backwards from "${currentStatusConfig.label}" to "${statusConfig.label}". Please follow the proper workflow.`,
              error: "REVERSE_FLOW_NOT_ALLOWED",
            });
          }

          // Prevent changing from final statuses
          if (currentStatusConfig.isFinal === true) {
            console.log("❌ Cannot change from final status");
            return res.status(400).json({
              success: false,
              message: `Cannot change status from "${currentStatusConfig.label}". This is a final status.`,
              error: "FINAL_STATUS_LOCKED",
            });
          }
        }
      }
    }

    // --- Parent-Subtask Status Sync Logic (Document Spec) ---
    // Helper: get all subtasks for a task
    async function getSubtasksOfTask(taskId) {
      const Task = (await import("../modals/taskModal.js")).default;
      return Task.find({ parentTask: taskId, isDeleted: { $ne: true } }).lean();
    }

    // Helper: get parent task if this is a subtask
    async function getParentTaskIfSubtask(task) {
      if (task.parentTask) {
        const Task = (await import("../modals/taskModal.js")).default;
        return Task.findById(task.parentTask).lean();
      }
      return null;
    }

    // Helper: derive parent status from subtasks (document logic)
    function deriveParentStatusFromSubtasks(subtasks) {
      if (!subtasks || subtasks.length === 0) return null;
      const statusSet = new Set(
        subtasks.map((st) => (st.status || "").toUpperCase()),
      );
      if (statusSet.size === 1) {
        const only = Array.from(statusSet)[0];
        if (only === "OPEN") return "OPEN";
        if (only === "INPROGRESS") return "INPROGRESS";
        if (only === "ONHOLD") return "ONHOLD";
        if (only === "DONE") return "DONE";
        if (only === "CANCELLED") return "CANCELLED";
      }
      if (statusSet.has("ONHOLD")) return "ONHOLD";
      if (statusSet.has("INPROGRESS")) return "INPROGRESS";
      if (statusSet.has("OPEN")) return "INPROGRESS"; // Mixed Open+InProgress = InProgress
      if (statusSet.has("DONE") && statusSet.size === 1) return "DONE";
      if (statusSet.has("CANCELLED") && statusSet.size === 1)
        return "CANCELLED";
      // Mixed: if any in progress, parent is in progress
      if (statusSet.has("INPROGRESS")) return "INPROGRESS";
      return null;
    }

    // ✅ Helper: Validate status is in uppercase format
    // Since we now only use uppercase values (OPEN, INPROGRESS, ONHOLD, DONE, CANCELLED)
    // this function simply returns the value as-is for validation purposes
    function toCoreStatus(val) {
      if (!val) return "";
      // All status values are already in uppercase format
      return val;
    }

    // 1. If this is a subtask, update subtask and then auto-sync parent
    if (task.parentTask) {
      // Update subtask status
      const updateData = {
        status: normalizedStatus,
        updatedAt: new Date(),
      };
      // ✅ Save notes into the correct field based on the status
      if (notes !== undefined && notes !== null) {
        if (normalizedStatus === "CANCELLED") {
          updateData.cancelNotes = notes;
        } else {
          updateData.completionNotes = notes;
        }
      }
      if (normalizedStatus === "DONE") {
        updateData.completedDate = new Date();
        updateData.completedBy = user.id;
      }
      const Task = (await import("../modals/taskModal.js")).default;
      await Task.findByIdAndUpdate(id, updateData);

      // After subtask update, fetch all siblings and auto-update parent
      const parentTask = await getParentTaskIfSubtask(task);
      if (parentTask) {
        const subtasks = await getSubtasksOfTask(parentTask._id);
        const derivedStatus = deriveParentStatusFromSubtasks(subtasks);
        if (
          derivedStatus &&
          toCoreStatus(parentTask.status) !== derivedStatus
        ) {
          // Only update if parent status is not already correct
          const Task = (await import("../modals/taskModal.js")).default;
          await Task.findByIdAndUpdate(parentTask._id, {
            status: derivedStatus,
            updatedAt: new Date(),
          });
        }
      }
      // Return updated subtask
      const updatedSubtask = await Task.findById(id).lean();

      // 📜 Log Audit Entry
      try {
        await auditLogger.logTaskStatusChanged(
          updatedSubtask,
          task.status,
          normalizedStatus,
          user,
          req,
        );
      } catch (auditError) {
        console.error(
          "⚠️ [AUDIT] Error logging subtask status change:",
          auditError.message,
        );
      }

      // 🔔 Send notifications for subtask status change
      try {
        const isSubtaskCompleted = ["DONE", "COMPLETED"].includes(
          normalizedStatus,
        );
        const subtaskTrigger = isSubtaskCompleted
          ? TriggerEvent.SUBTASK_COMPLETED
          : TriggerEvent.TASK_UPDATED;

        // Notify parent task assignee if different from updater
        const pAssigneeId =
          parentTask?.assignedTo?._id?.toString() ||
          parentTask?.assignedTo?.toString();
        if (pAssigneeId && pAssigneeId !== user.id.toString()) {
          await createTaskNotification(
            subtaskTrigger,
            {
              ...updatedSubtask,
              isSubtask: true,
              parentTaskId: task.parentTask,
            },
            {
              targetUserId: pAssigneeId,
              title: isSubtaskCompleted
                ? `Subtask Completed: ${updatedSubtask.title}`
                : `Subtask Status Changed: ${updatedSubtask.title}`,
              message: isSubtaskCompleted
                ? `Subtask "${updatedSubtask.title}" has been completed`
                : `Subtask "${updatedSubtask.title}" status changed to ${normalizedStatus}`,
              priority: NotificationPriority.NORMAL,
            },
          );
        }

        // Notify parent task creator if different from updater and assignee
        const pCreatorId =
          parentTask?.createdBy?._id?.toString() ||
          parentTask?.createdBy?.toString();
        if (
          pCreatorId &&
          pCreatorId !== user.id.toString() &&
          pCreatorId !== pAssigneeId
        ) {
          await createTaskNotification(
            subtaskTrigger,
            {
              ...updatedSubtask,
              isSubtask: true,
              parentTaskId: task.parentTask,
            },
            {
              targetUserId: pCreatorId,
              title: isSubtaskCompleted
                ? `Subtask Completed: ${updatedSubtask.title}`
                : `Subtask Status Changed: ${updatedSubtask.title}`,
              message: isSubtaskCompleted
                ? `Subtask "${updatedSubtask.title}" has been completed`
                : `Subtask "${updatedSubtask.title}" status changed to ${normalizedStatus}`,
              priority: NotificationPriority.NORMAL,
            },
          );
        }
      } catch (notifErr) {
        console.error(
          "Failed to send subtask status change notification:",
          notifErr.message,
        );
      }

      // ✅ Re-fetch subtask fresh so cancelNotes is included in response
      const freshSubtask = await Task.findById(id).lean();

      return res.json({
        success: true,
        message: "Subtask status updated successfully (parent auto-synced)",
        data: freshSubtask || updatedSubtask,
      });
    }

    // 2. If this is a parent task, validate against subtasks before allowing status change
    const subtasks = await getSubtasksOfTask(task._id);
    if (subtasks && subtasks.length > 0) {
      // Parent cannot be set to a lower progress than any subtask
      const subtaskStatuses = subtasks.map((st) => toCoreStatus(st.status));
      const maxSubtaskStatus = (() => {
        if (subtaskStatuses.includes("INPROGRESS")) return "INPROGRESS";
        if (subtaskStatuses.includes("ONHOLD")) return "ONHOLD";
        if (subtaskStatuses.includes("OPEN")) return "OPEN";
        if (subtaskStatuses.includes("DONE")) return "DONE";
        if (subtaskStatuses.includes("CANCELLED")) return "CANCELLED";
        return "OPEN";
      })();
      const parentCoreStatus = toCoreStatus(normalizedStatus);

      // 🚫 CRITICAL VALIDATION: Parent cannot be marked as DONE unless ALL subtasks are DONE or CANCELLED
      if (parentCoreStatus === "DONE") {
        const incompleteSubtasks = subtasks.filter((st) => {
          const stStatus = toCoreStatus(st.status);
          return stStatus !== "DONE" && stStatus !== "CANCELLED";
        });

        if (incompleteSubtasks.length > 0) {
          console.log("❌ Cannot mark parent as DONE - incomplete subtasks:", {
            parentTaskId: task._id,
            totalSubtasks: subtasks.length,
            incompleteCount: incompleteSubtasks.length,
            incompleteSubtasks: incompleteSubtasks.map((st) => ({
              id: st._id,
              title: st.title,
              status: st.status,
            })),
          });

          // Check if user is Admin (can force complete)
          const userRoles = Array.isArray(user.role) ? user.role : [user.role];
          const isAdmin =
            userRoles.includes("org_admin") ||
            userRoles.includes("company-admin") ||
            userRoles.includes("admin") ||
            userRoles.includes("super-admin") ||
            userRoles.includes("tasksetu-admin");

          const forceComplete = req.body.forceComplete === true;

          if (!isAdmin || !forceComplete) {
            return res.status(400).json({
              success: false,
              message: `Parent task cannot be marked as Done. Please complete all ${incompleteSubtasks.length} pending subtask(s) first.`,
              incompleteSubtasks: incompleteSubtasks.map((st) => ({
                id: st._id,
                title: st.title,
                status: st.status,
              })),
              allowForceComplete: isAdmin, // Tell frontend if force complete is allowed
              hint: isAdmin
                ? "As an admin, you can force complete this task by setting forceComplete=true"
                : null,
            });
          }

          console.log(
            "⚙️ Admin override: Forcing parent task completion despite incomplete subtasks:",
            {
              adminUser: user.email || user.name,
              adminRole: user.role,
              incompleteSubtasksCount: incompleteSubtasks.length,
            },
          );
        }
      }

      // If any subtask is in progress, parent cannot be set to OPEN
      if (maxSubtaskStatus === "INPROGRESS" && parentCoreStatus === "OPEN") {
        return res.status(400).json({
          success: false,
          message:
            "Parent cannot be set to OPEN while any subtask is INPROGRESS",
        });
      }

      // If any subtask is INPROGRESS, parent cannot be set to DONE
      if (
        subtaskStatuses.some((s) => s === "INPROGRESS") &&
        parentCoreStatus === "DONE"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Parent cannot be set to DONE while any subtask is INPROGRESS",
        });
      }

      // If any subtask is ONHOLD, parent must be ONHOLD
      if (subtaskStatuses.includes("ONHOLD") && parentCoreStatus !== "ONHOLD") {
        return res.status(400).json({
          success: false,
          message: "Parent must be ONHOLD if any subtask is ONHOLD",
        });
      }
    }

    // --- Continue with original update logic for parent task ---
    const updateData = {
      status: normalizedStatus,
      updatedAt: new Date(),
    };

    // ✅ Save notes into the correct field based on the status
    if (notes !== undefined && notes !== null) {
      if (normalizedStatus === "CANCELLED") {
        updateData.cancelNotes = notes;
      } else {
        updateData.completionNotes = notes;
      }
    }

    // ✅ Auto-set progress to 100% if marked as DONE
    if (["DONE", "COMPLETED"].includes(normalizedStatus)) {
      updateData.progress = 100;
    }
    // Add completion data for DONE status
    if (normalizedStatus === "DONE") {
      updateData.completedDate = new Date();
      updateData.completedBy = user.id;

      // 🔍 DEBUG: Log recurring task fields to diagnose issue
      console.log("🔍 DEBUG - Checking recurring task fields:", {
        taskId: task._id,
        title: task.title,
        taskType: task.taskType,
        isRecurring: task.isRecurring,
        hasRecurrencePattern: !!task.recurrencePattern,
        isParentRecurring: task.isParentRecurring,
        instanceNumber: task.instanceNumber,
        parentRecurringTaskId: task.parentRecurringTaskId,
      });

      // 🔄 Handle Recurring Task Auto-generation on Completion - DISABLED (Upfront Generation Implemented)
      /*
      if (task.isRecurring && task.recurrencePattern) {
        console.log('🔄 Processing recurring task completion:', {
          taskId: task._id,
          title: task.title,
          currentDueDate: task.dueDate,
          completedDate: updateData.completedDate
        });
        try {
          // Create next occurrence using enhanced logic
          const nextOccurrence = createNextRecurringOccurrence(task, updateData.completedDate, await TimezoneHelper.getUserTimezone(user.id));
          if (nextOccurrence) {
            // Save next occurrence
            const createdNextTask = await storage.createTask(nextOccurrence);
            console.log('✅ Next recurring occurrence created:', {
              originalTaskId: task._id,
              nextTaskId: createdNextTask._id,
              nextDueDate: createdNextTask.dueDate,
              nextNextDueDate: createdNextTask.nextDueDate
            });

            // ✅ Increment occurrenceCount on parent template (Section 4.3)
            try {
              const parentId = task.parentRecurringTaskId || task._id;
              const TaskModel = (await import("../modals/taskModal.js")).default;
              await TaskModel.findByIdAndUpdate(parentId, { $inc: { occurrenceCount: 1 } });
              console.log(`📈 Incremented occurrenceCount for parent task: ${parentId}`);
            } catch (incError) {
              console.error('❌ Error incrementing parent occurrenceCount:', incError);
            }

            // Add activity log for recurrence
            if (!task.comments) task.comments = [];
            task.comments.push({
              _id: Date.now().toString() + Math.random(),
              text: `🔄 Recurring Task: Next occurrence generated with due date ${TimezoneHelper.formatInTimezone(new Date(createdNextTask.dueDate), await TimezoneHelper.getUserTimezone(user.id))}`,
              author: user.id,
              createdAt: new Date(),
              updatedAt: new Date(),
              isEdited: false
            });
            updateData.comments = task.comments;
          } else {
            console.log('🏁 Recurring task sequence ended - no more occurrences');
            // Add completion log for ended recurrence
            if (!task.comments) task.comments = [];
            task.comments.push({
              _id: Date.now().toString() + Math.random(),
              text: `🏁 Recurring Task: Sequence completed - no more occurrences scheduled`,
              author: user.id,
              createdAt: new Date(),
              updatedAt: new Date(),
              isEdited: false
            });
            updateData.comments = task.comments;
          }
        } catch (recurringError) {
          console.error('❌ Error creating next recurring occurrence:', recurringError);
          // Add error log but don't fail the completion
          if (!task.comments) task.comments = [];
          task.comments.push({
            _id: Date.now().toString() + Math.random(),
            text: `⚠️ Recurring Task: Error creating next occurrence - ${recurringError.message}`,
            author: user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
            isEdited: false
          });
          updateData.comments = task.comments;
        }
      }
      */
    }

    console.log("🔍 Updating task with data:", updateData);
    // Update only the status
    const updatedTask = await storage.updateTask(id, updateData, user.id);
    console.log("✅ Task updated successfully:", {
      taskId: updatedTask?._id,
      oldStatus: task.status,
      originalRequestedStatus: status,
      normalizedStatus: normalizedStatus,
      newStatus: updatedTask?.status,
      completedDate: updatedTask?.completedDate,
      completedBy: updatedTask?.completedBy,
    });

    // 📜 Log Audit Entry
    try {
      await auditLogger.logTaskStatusChanged(
        updatedTask,
        task.status,
        normalizedStatus,
        user,
        req,
      );
    } catch (auditError) {
      console.error(
        "⚠️ [AUDIT] Error logging task status change:",
        auditError.message,
      );
    }

    // 🔔 Send notifications for status change
    try {
      const oldStatus = task.status;
      const newStatus = normalizedStatus;
      const changedByUserId = user.id;

      // Determine if task was completed
      const isCompleted = ["DONE", "COMPLETED"].includes(newStatus);
      const triggerEvent = isCompleted
        ? TriggerEvent.TASK_COMPLETED
        : TriggerEvent.TASK_UPDATED;
      const notifPriority = isCompleted
        ? NotificationPriority.URGENT
        : NotificationPriority.NORMAL;

      const statusMessage = isCompleted
        ? `Task "${updatedTask.title}" has been completed`
        : `Task "${updatedTask.title}" status changed from ${oldStatus} to ${newStatus}`;
      const statusTitle = isCompleted
        ? `Task Completed: ${updatedTask.title}`
        : `Status Changed: ${updatedTask.title}`;

      // Collect all users to notify (assignee, creator, collaborators) — exclude the person who made the change
      const notifyUserIds = new Set();

      const assigneeId =
        updatedTask.assignedTo?._id?.toString() ||
        updatedTask.assignedTo?.toString();
      if (assigneeId && assigneeId !== changedByUserId.toString()) {
        notifyUserIds.add(assigneeId);
      }

      const creatorId =
        updatedTask.createdBy?._id?.toString() ||
        updatedTask.createdBy?.toString();
      if (creatorId && creatorId !== changedByUserId.toString()) {
        notifyUserIds.add(creatorId);
      }

      if (
        updatedTask.collaborators &&
        Array.isArray(updatedTask.collaborators)
      ) {
        for (const collab of updatedTask.collaborators) {
          const collabId = collab?._id?.toString() || collab?.toString();
          if (collabId && collabId !== changedByUserId.toString()) {
            notifyUserIds.add(collabId);
          }
        }
      }

      for (const targetUserId of notifyUserIds) {
        await createTaskNotification(triggerEvent, updatedTask, {
          targetUserId,
          title: statusTitle,
          message: statusMessage,
          priority: notifPriority,
          channels: [ChannelType.IN_APP, ChannelType.EMAIL],
          metadata: {
            statusChange: { from: oldStatus, to: newStatus },
            changedBy: changedByUserId,
          },
        });
      }

      console.log(
        `🔔 Status change notifications sent to ${notifyUserIds.size} user(s) for task: ${updatedTask.title}`,
      );
    } catch (notificationError) {
      console.error(
        "Failed to send status change notification:",
        notificationError.message,
      );
      // Don't fail the status update if notification fails
    }

    // ✅ Activity tracking is handled by storage.updateTask()
    // No need for duplicate tracking here

    // Recalculate counters for current assignee
    await recalcUserTaskCounters(updatedTask?.assignedTo);

    // 🎯 Update milestone progress if this task is linked to a milestone
    if (updatedTask.linkedToMilestone) {
      console.log(
        "🔗 [MILESTONE] Task is linked to milestone, updating progress...",
      );
      await updateMilestoneProgressOnTaskChange(updatedTask._id);
    }

    console.log("✅ Sending success response to client");

    // ✅ Re-fetch fresh from DB so all fields including cancelNotes appear in response
    const freshTask = await Task.findById(id).lean();

    res.json({
      success: true,
      message: "Task status updated successfully",
      data: freshTask || updatedTask,
    });
  } catch (error) {
    console.error("❌ ERROR in updateTaskStatus:", {
      error: error.message,
      stack: error.stack,
      taskId: req.params?.id,
      status: req.body?.status,
      userId: req.user?.id,
    });
    res.status(500).json({
      success: false,
      message: "Failed to update task status",
      error: error.message,
    });
  }
};

// 🔄 Scheduled Recurring Task Generation (Cron Job Function)
export const generateScheduledRecurringTasks = async () => {
  try {
    console.log("🔄 Starting scheduled recurring task generation...");

    // Find all active recurring tasks that need next occurrence
    const recurringTasks = await storage.getAllTasks({
      isRecurring: true,
      status: { $ne: "cancelled" },
      nextDueDate: { $lte: new Date(Date.now() + 24 * 60 * 60 * 1000) }, // Within next 24 hours
    });

    console.log(`🔍 Found ${recurringTasks.length} recurring tasks to process`);

    let processedCount = 0;
    let errorCount = 0;

    for (const task of recurringTasks) {
      try {
        // Check if next occurrence already exists
        const existingNextTask = await storage.getAllTasks({
          title: task.title,
          dueDate: task.nextDueDate,
          createdBy: task.createdBy,
          isRecurring: true,
        });

        if (existingNextTask.length === 0) {
          // Create next occurrence
          const nextOccurrence = createNextRecurringOccurrence(
            task,
            null,
            await TimezoneHelper.getUserTimezone(
              task.assignedTo || task.createdBy,
            ),
          );

          if (nextOccurrence) {
            const createdTask = await storage.createTask(nextOccurrence);
            processedCount++;

            console.log(
              `✅ Created scheduled occurrence for: ${task.title} (Due: ${nextOccurrence.dueDate})`,
            );

            // ✅ Increment occurrenceCount on parent template (Section 4.3)
            try {
              const parentId = task.parentRecurringTaskId || task._id;
              // We'll use a direct update here for efficiency
              const TaskModel = (await import("../modals/taskModal.js"))
                .default;
              await TaskModel.findByIdAndUpdate(parentId, {
                $inc: { occurrenceCount: 1 },
              });
              console.log(
                `📈 Incremented occurrenceCount for parent task: ${parentId}`,
              );
            } catch (incError) {
              console.error(
                "❌ Error incrementing parent occurrenceCount:",
                incError,
              );
            }

            // 🔔 Send notification for recurring task instance
            try {
              if (createdTask.assignedTo) {
                await createTaskNotification(
                  TriggerEvent.RECURRING_INSTANCE_CREATED,
                  createdTask,
                  {
                    targetUserId: createdTask.assignedTo,
                    title: "Recurring Task: New Instance",
                    message: `A new instance of recurring task "${createdTask.title}" has been created and is due on ${TimezoneHelper.formatInTimezone(new Date(createdTask.dueDate), await TimezoneHelper.getUserTimezone(createdTask.assignedTo))}`,
                    priority:
                      createdTask.priority === "urgent" ||
                      createdTask.priority === "high"
                        ? NotificationPriority.URGENT
                        : NotificationPriority.NORMAL,
                    metadata: {
                      isRecurringInstance: true,
                      parentTaskId: task._id,
                      dueDate: createdTask.dueDate,
                    },
                  },
                );
                console.log(
                  `🔔 Notification sent for recurring task instance: ${createdTask.title}`,
                );
              }
            } catch (notificationError) {
              console.error(
                `⚠️ Failed to send notification for recurring task instance:`,
                notificationError.message,
              );
              // Don't fail the task creation if notification fails
            }
          }
        } else {
          console.log(`⏭️  Next occurrence already exists for: ${task.title}`);
        }
      } catch (taskError) {
        console.error(
          `❌ Error processing recurring task ${task._id}:`,
          taskError,
        );
        errorCount++;
      }
    }

    console.log(
      `🔄 Recurring task generation completed: ${processedCount} created, ${errorCount} errors`,
    );

    return {
      success: true,
      processed: processedCount,
      errors: errorCount,
      total: recurringTasks.length,
    };
  } catch (error) {
    console.error("❌ Error in scheduled recurring task generation:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// 🔄 Manual Skip Recurring Task Occurrence
export const skipRecurringTaskOccurrence = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const user = req.user;

    const task = await storage.getTaskById(id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    if (!task.isRecurring) {
      return res.status(400).json({
        success: false,
        message: "This is not a recurring task",
      });
    }

    // Calculate next occurrence after skipping current one
    const skippedDueDate = task.nextDueDate;
    const newNextDueDate = calculateNextDueDate(
      task.recurrencePattern,
      skippedDueDate,
      task.recurrencePattern.anchorField || "startDate",
    );

    // Update task with new next due date
    const updateData = {
      nextDueDate: newNextDueDate,
      updatedAt: new Date(),
    };

    // Add skip activity log
    if (!task.comments) task.comments = [];
    task.comments.push({
      _id: Date.now().toString() + Math.random(),
      text: `⏭️ Recurring Task: Occurrence skipped for ${TimezoneHelper.formatInTimezone(new Date(skippedDueDate), await TimezoneHelper.getUserTimezone(user.id))}${reason ? ` - Reason: ${reason}` : ""}`,
      author: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      isEdited: false,
    });

    updateData.comments = task.comments;

    const updatedTask = await storage.updateTask(id, updateData, user.id);

    res.json({
      success: true,
      message: "Recurring task occurrence skipped successfully",
      data: {
        skippedDate: skippedDueDate,
        nextDueDate: newNextDueDate,
        task: updatedTask,
      },
    });
  } catch (error) {
    console.error("Error skipping recurring task occurrence:", error);
    res.status(500).json({
      success: false,
      message: "Failed to skip recurring task occurrence",
      error: error.message,
    });
  }
};

// 🔄 Stop/Pause Recurring Task
export const stopRecurringTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const user = req.user;

    const task = await storage.getTaskById(id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    if (!task.isRecurring) {
      return res.status(400).json({
        success: false,
        message: "This is not a recurring task",
      });
    }

    // Stop recurrence by removing nextDueDate and adding end date
    const updateData = {
      nextDueDate: null,
      "recurrencePattern.endDate": new Date(),
      updatedAt: new Date(),
    };

    // Add stop activity log
    if (!task.comments) task.comments = [];
    task.comments.push({
      _id: Date.now().toString() + Math.random(),
      text: `🛑 Recurring Task: Recurrence stopped manually${reason ? ` - Reason: ${reason}` : ""}`,
      author: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      isEdited: false,
    });

    updateData.comments = task.comments;

    const updatedTask = await storage.updateTask(id, updateData, user.id);

    res.json({
      success: true,
      message: "Recurring task stopped successfully",
      data: updatedTask,
    });
  } catch (error) {
    console.error("Error stopping recurring task:", error);
    res.status(500).json({
      success: false,
      message: "Failed to stop recurring task",
      error: error.message,
    });
  }
};

export const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    console.log("=== DELETE TASK DEBUG ===");
    console.log("Task ID to delete:", id);
    console.log("User attempting delete:", {
      id: user.id,
      organizationId: user.organizationId,
    });
    console.log("🔍 DELETE FUNCTION CALLED - Starting validation...");
    console.log(
      "🚨 TESTING - If you see this, deleteTask function is being called!",
    );

    const task = await storage.getTaskById(id);
    console.log(
      "Found task:",
      task
        ? {
            id: task._id,
            title: task.title,
            createdBy: task.createdBy,
            organization: task.organization,
            isDeleted: task.isDeleted,
          }
        : "Not found",
    );

    if (!task) {
      console.log("Task not found in database");
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // 🔐 ROLE-BASED PERMISSION VALIDATION FOR TASK DELETION
    console.log("🔐 [DELETE TASK] =================================");
    console.log("🔐 [DELETE TASK] User:", user.email || "Unknown");
    console.log("🔐 [DELETE TASK] User Role:", user.role);
    console.log("🔐 [DELETE TASK] Task ID:", id);
    console.log("🔐 [DELETE TASK] Task Assigned To (raw):", task.assignedTo);
    console.log("🔐 [DELETE TASK] Task Created By (raw):", task.createdBy);
    console.log(
      "🔐 [DELETE TASK] Task Collaborators (raw):",
      task.collaborators,
    );

    const userRole = getHighestPriorityRole(user.role);
    const userId = user.id?.toString() || user._id?.toString();

    // Properly extract IDs handling both populated and non-populated fields
    const taskAssignedTo =
      task.assignedTo?._id?.toString() || task.assignedTo?.toString();
    const taskCreatedBy =
      task.createdBy?._id?.toString() || task.createdBy?.toString();

    console.log("🔐 [DELETE TASK] Highest Priority Role:", userRole);
    console.log("🔐 [DELETE TASK] User ID (normalized):", userId);
    console.log(
      "🔐 [DELETE TASK] Task Assigned To (normalized):",
      taskAssignedTo,
    );
    console.log(
      "🔐 [DELETE TASK] Task Created By (normalized):",
      taskCreatedBy,
    );

    // 🚫 CONTRIBUTORS PERMISSION CHECK: Recurring task contributors cannot delete
    if (task.isRecurring && task.contributors) {
      const isContributor = task.contributors.some((contributor) => {
        const contribId =
          contributor?._id?.toString() || contributor?.toString();
        return contribId === userId;
      });

      if (
        isContributor &&
        !(taskAssignedTo === userId || taskCreatedBy === userId)
      ) {
        console.error(
          "🔐 [DELETE TASK] ❌ PERMISSION DENIED - Contributors cannot delete recurring tasks",
        );
        console.log("🔐 [DELETE TASK] =================================");
        return res.status(403).json({
          success: false,
          message: "Access denied: Contributors cannot delete tasks.",
        });
      }
    }

    // Individual User / Employee: Can only delete own tasks
    if (
      [
        "individual",
        "individual-user",
        "employee",
        "company-user",
        "user",
        "normal-user",
      ].includes(userRole)
    ) {
      console.log(
        "🔐 [DELETE TASK] Role Type: Individual/Employee - checking ownership",
      );

      // Check if user is creator, assignee, or collaborator
      const isCreator = taskCreatedBy === userId;
      const isAssignee = taskAssignedTo === userId;
      const isCollaborator = task.collaborators?.some((collab) => {
        const collabId = collab._id?.toString() || collab.toString();
        console.log("🔐 [DELETE TASK] Checking collaborator:", {
          collabId,
          userId,
          match: collabId === userId,
        });
        return collabId === userId;
      });

      console.log("🔐 [DELETE TASK] Ownership checks:", {
        userId,
        taskCreatedBy,
        taskAssignedTo,
        isCreator,
        isAssignee,
        isCollaborator,
        hasCollaborators: !!task.collaborators,
        collaboratorsCount: task.collaborators?.length || 0,
      });

      if (!isCreator && !isAssignee && !isCollaborator) {
        console.error(
          "🔐 [DELETE TASK] ❌ PERMISSION DENIED - Not task owner or collaborator",
        );
        console.log("🔐 [DELETE TASK] =================================");
        return res.status(403).json({
          success: false,
          message:
            "Access denied: You can only delete tasks assigned to you, created by you, or where you are a collaborator.",
        });
      }

      console.log("🔐 [DELETE TASK] ✅ Task ownership verified");
    }

    // Manager: Can delete own + subordinate tasks (TODO: requires manager-subordinate mapping)
    // For now, managers can delete tasks in their organization
    if (userRole === "manager") {
      console.log(
        "🔐 [DELETE TASK] Role Type: Manager - checking organization access",
      );
      // Organization check will be done below
    }

    // Company Admin / Org Admin: Can delete any task in organization
    if (["company-admin", "org_admin", "admin"].includes(userRole)) {
      console.log(
        "🔐 [DELETE TASK] Role Type: Company Admin - full organization access",
      );
      // Organization check will be done below
    }

    // Super Admin: No direct task access (internal admin only)
    if (["super-admin", "super_admin", "tasksetu-admin"].includes(userRole)) {
      console.error(
        "🔐 [DELETE TASK] ❌ PERMISSION DENIED - Super Admin should not access task operations",
      );
      console.log("🔐 [DELETE TASK] =================================");
      return res.status(403).json({
        success: false,
        message:
          "Access denied: Super Admins do not have access to task operations.",
      });
    }

    console.log("🔐 [DELETE TASK] ✅ Role-based permission check passed");

    // Check organization permissions
    if (task.organization && user.organizationId) {
      const taskOrgId = getTaskOrganizationId(task.organization);
      const userOrgId = user.organizationId?.toString() || user.organizationId;

      console.log("🔐 [DELETE TASK] Checking organization match...");
      console.log("🔐 [DELETE TASK] Task Org:", taskOrgId);
      console.log("🔐 [DELETE TASK] User Org:", userOrgId);

      if (taskOrgId !== userOrgId) {
        console.log(
          "🔐 [DELETE TASK] ❌ PERMISSION DENIED - Organization mismatch",
        );
        console.log("🔐 [DELETE TASK] =================================");
        return res.status(403).json({
          success: false,
          message:
            "Access denied: You do not have permission to delete tasks from other organizations.",
        });
      }

      console.log("🔐 [DELETE TASK] ✅ Organization check passed");
    } else if (!task.organization && !user.organizationId) {
      // For individual users without organization, check if they created the task, are assigned, or are collaborator
      console.log(
        "🔐 [DELETE TASK] No organization - checking task relationship",
      );
      const taskCreatedById =
        task.createdBy?._id?.toString() || task.createdBy?.toString();
      const taskAssignedToId =
        task.assignedTo?._id?.toString() || task.assignedTo?.toString();
      const userId = user.id?.toString() || user._id?.toString();

      const isCreator = taskCreatedById === userId;
      const isAssignee = taskAssignedToId === userId;
      const isCollaborator = task.collaborators?.some((collab) => {
        const collabId = collab._id?.toString() || collab.toString();
        return collabId === userId;
      });

      console.log("🔐 [DELETE TASK] Individual user relationship checks:", {
        userId,
        taskCreatedById,
        taskAssignedToId,
        isCreator,
        isAssignee,
        isCollaborator,
      });

      if (!isCreator && !isAssignee && !isCollaborator) {
        console.log(
          "🔐 [DELETE TASK] ❌ PERMISSION DENIED - Not task creator, assignee, or collaborator",
        );
        console.log("🔐 [DELETE TASK] =================================");
        return res.status(403).json({
          success: false,
          message:
            "Access denied: You can only delete tasks you created, are assigned to, or are a collaborator on.",
        });
      }

      console.log("🔐 [DELETE TASK] ✅ Task relationship check passed");
    }

    console.log("🔐 [DELETE TASK] ✅ ALL PERMISSION CHECKS PASSED");
    console.log("🔐 [DELETE TASK] =================================");

    console.log(
      "✅ Permissions passed, checking task-specific delete conditions...",
    );

    // TASK TYPE-SPECIFIC DELETE VALIDATION
    const taskType = task.taskType || "regular";
    console.log("🔍 Task type detection:", {
      taskType: taskType,
      taskTaskType: task.taskType,
      mainTaskType: task.mainTaskType,
      taskId: id,
      taskTitle: task.title,
    });

    // Helper function to check if task has subtasks
    const hasSubtasks = async (taskId) => {
      try {
        const subtasks = await storage.getSubtasksByParentId(taskId);
        return subtasks && subtasks.length > 0;
      } catch (error) {
        console.error("Error checking subtasks:", error);
        return false;
      }
    };

    // Helper function to check if user is admin
    const isAdmin = (user) => {
      return (
        user.role === "admin" ||
        user.role === "company_admin" ||
        user.role === "tasksetu_admin"
      );
    };

    // Helper function to check if task is linked to milestone
    const isLinkedToMilestone = (task) => {
      return task.milestone && task.milestone !== null && task.milestone !== "";
    };

    // Helper function to check if task is part of approval workflow
    const isApprovalLinked = (task) => {
      return task.approvalWorkflow && task.approvalWorkflow !== null;
    };

    // Helper function to check if task is recurring child
    const isRecurringChild = (task) => {
      return task.parentRecurringId && task.parentRecurringId !== null;
    };

    // Helper function to check if task is converted from quick task
    const isConvertedFromQuickTask = (task) => {
      return task.convertedFromQuickTask === true;
    };

    // TASK-SPECIFIC DELETE CONDITIONS
    let deleteAllowed = true;
    let errorMessage = "";

    console.log(
      "🔍 Switch statement - taskType.toLowerCase():",
      taskType.toLowerCase(),
    );

    // Helper: allowed statuses for deletion
    const DELETABLE_STATUSES = ["OPEN", "ONHOLD", "CANCELLED"];

    // Helper: check subtask statuses for parent task deletion
    const checkSubtaskStatusesForDeletion = async (taskId) => {
      try {
        const subtasks = await storage.getSubtasksByParentId(taskId);
        if (!subtasks || subtasks.length === 0)
          return { allowed: true, blockers: [] };
        // Filter only non-deleted subtasks
        const activeSubtasks = subtasks.filter((st) => !st.isDeleted);
        if (activeSubtasks.length === 0) return { allowed: true, blockers: [] };
        const blockerSubtasks = activeSubtasks.filter(
          (st) => !["ONHOLD", "CANCELLED"].includes(st.status),
        );
        if (blockerSubtasks.length > 0) {
          return {
            allowed: false,
            blockers: blockerSubtasks.map((st) => ({
              id: st._id,
              title: st.title,
              status: st.status,
            })),
          };
        }
        return { allowed: true, blockers: [] };
      } catch (error) {
        console.error("Error checking subtask statuses:", error);
        return { allowed: true, blockers: [] };
      }
    };

    switch (taskType.toLowerCase()) {
      case "regular":
        console.log(
          "🔍 Validating Regular Task delete conditions...",
          task.status,
        );

        // Condition 1: Task Status must be OPEN, ONHOLD, or CANCELLED
        if (task.status && !DELETABLE_STATUSES.includes(task.status)) {
          deleteAllowed = false;
          errorMessage = `Cannot delete task with status "${task.status}". Only tasks with status OPEN, ONHOLD or CANCELLED can be deleted.`;
          console.log("❌ Regular Task: Status check failed -", task.status);
        }

        // Condition 2: Check subtask statuses (if any exist)
        if (deleteAllowed) {
          const subtaskCheck = await checkSubtaskStatusesForDeletion(id);
          if (!subtaskCheck.allowed) {
            deleteAllowed = false;
            const blockerList = subtaskCheck.blockers
              .map((b) => `"${b.title}" (${b.status})`)
              .join(", ");
            errorMessage = `Cannot delete task: The following subtask(s) are not ONHOLD or CANCELLED: ${blockerList}. Please update their status before deleting.`;
            console.log(
              "❌ Regular Task: Subtasks blocking deletion:",
              subtaskCheck.blockers,
            );
          }
        }

        // Condition 3: Created by Current User (already checked above)
        console.log("✅ Regular Task: Creator check passed");

        // Condition 4: Not Linked with Milestone
        if (deleteAllowed && isLinkedToMilestone(task)) {
          deleteAllowed = false;
          errorMessage = "Cannot delete a started or dependent task.";
          console.log("❌ Regular Task: Linked to milestone");
        }

        // Condition 5: Not Part of Approval Workflow
        if (deleteAllowed && isApprovalLinked(task)) {
          deleteAllowed = false;
          errorMessage = "Cannot delete a started or dependent task.";
          console.log("❌ Regular Task: Part of approval workflow");
        }

        // Condition 6: Not Recurring Child
        if (deleteAllowed && isRecurringChild(task)) {
          deleteAllowed = false;
          errorMessage = "Cannot delete a started or dependent task.";
          console.log("❌ Regular Task: Is recurring child");
        }

        // Admin Override
        if (!deleteAllowed && isAdmin(user)) {
          console.log(
            "⚙️ Admin override: Allowing delete despite restrictions",
          );
          deleteAllowed = true;
          errorMessage = "";
        }

        break;

      case "recurring":
        console.log("🔍 Validating Recurring Task delete conditions...");

        // Check if this is parent pattern or instance
        if (task.isRecurringInstance) {
          console.log("🔍 Validating Recurring Instance delete conditions...");

          // Instance conditions - allow OPEN, ONHOLD, CANCELLED
          if (task.status && !DELETABLE_STATUSES.includes(task.status)) {
            deleteAllowed = false;
            errorMessage = `Cannot delete recurring instance with status "${task.status}". Only instances with status OPEN, ONHOLD or CANCELLED can be deleted.`;
            console.log(
              "❌ Recurring Instance: Status check failed -",
              task.status,
            );
          }

          if (deleteAllowed) {
            const subtaskCheck = await checkSubtaskStatusesForDeletion(id);
            if (!subtaskCheck.allowed) {
              deleteAllowed = false;
              const blockerList = subtaskCheck.blockers
                .map((b) => `"${b.title}" (${b.status})`)
                .join(", ");
              errorMessage = `Cannot delete recurring instance: The following subtask(s) are not ONHOLD or CANCELLED: ${blockerList}. Please update their status before deleting.`;
              console.log(
                "❌ Recurring Instance: Subtasks blocking deletion:",
                subtaskCheck.blockers,
              );
            }
          }
        } else {
          console.log("🔍 Validating Recurring Pattern delete conditions...");

          // Parent pattern conditions
          // Check if any instances are in progress
          try {
            const activeInstances =
              await storage.getActiveRecurringInstances(id);
            if (activeInstances && activeInstances.length > 0) {
              deleteAllowed = false;
              errorMessage = "Stop recurring pattern before deletion.";
              console.log("❌ Recurring Pattern: Has active instances");
            }
          } catch (error) {
            console.error("Error checking active instances:", error);
          }

          // Check if recurrence is stopped
          if (deleteAllowed && task.recurrenceActive === true) {
            deleteAllowed = false;
            errorMessage = "Stop recurring pattern before deletion.";
            console.log("❌ Recurring Pattern: Recurrence still active");
          }
        }

        // Admin Override
        if (!deleteAllowed && isAdmin(user)) {
          console.log(
            "⚙️ Admin override: Allowing delete despite restrictions",
          );
          deleteAllowed = true;
          errorMessage = "";
        }

        break;

      case "milestone":
        console.log("🔍 Validating Milestone Task delete conditions...");

        // Condition 1: Milestone Status must be OPEN, ONHOLD, or CANCELLED
        if (task.status && !DELETABLE_STATUSES.includes(task.status)) {
          deleteAllowed = false;
          errorMessage = `Cannot delete milestone with status "${task.status}". Only milestones with status OPEN, ONHOLD or CANCELLED can be deleted.`;
          console.log("❌ Milestone: Status check failed -", task.status);
        }

        // Condition 2: Check subtask statuses (if any exist)
        if (deleteAllowed) {
          const subtaskCheck = await checkSubtaskStatusesForDeletion(id);
          if (!subtaskCheck.allowed) {
            deleteAllowed = false;
            const blockerList = subtaskCheck.blockers
              .map((b) => `"${b.title}" (${b.status})`)
              .join(", ");
            errorMessage = `Cannot delete milestone: The following subtask(s) are not ONHOLD or CANCELLED: ${blockerList}. Please update their status before deleting.`;
            console.log(
              "❌ Milestone: Subtasks blocking deletion:",
              subtaskCheck.blockers,
            );
          }
        }

        // Removed Condition 3: Created by Manager / Admin check
        // All users can now delete milestones if they are open and have no subtasks

        // Admin Override
        if (!deleteAllowed && isAdmin(user)) {
          console.log(
            "⚙️ Admin override: Allowing delete despite restrictions",
          );
          deleteAllowed = true;
          errorMessage = "";
        }

        break;

      case "approval":
        console.log("🔍 Validating Approval Task delete conditions...");

        // Condition 1: Approval Task status must be OPEN, ONHOLD, or CANCELLED
        if (task.status && !DELETABLE_STATUSES.includes(task.status)) {
          deleteAllowed = false;
          errorMessage = `Cannot delete approval task with status "${task.status}". Only tasks with status OPEN, ONHOLD or CANCELLED can be deleted.`;
          console.log("❌ Approval: Status check failed -", task.status);
        }

        // Condition 2: Any approval/rejection/comment exists
        if (
          deleteAllowed &&
          (task.approvalComments?.length > 0 || task.approvalStatus)
        ) {
          deleteAllowed = false;
          errorMessage = "Locked for audit compliance.";
          console.log("❌ Approval: Has approval actions");
        }

        // Condition 3: Check subtask statuses (if any exist)
        if (deleteAllowed) {
          const subtaskCheck = await checkSubtaskStatusesForDeletion(id);
          if (!subtaskCheck.allowed) {
            deleteAllowed = false;
            const blockerList = subtaskCheck.blockers
              .map((b) => `"${b.title}" (${b.status})`)
              .join(", ");
            errorMessage = `Cannot delete approval task: The following subtask(s) are not ONHOLD or CANCELLED: ${blockerList}. Please update their status before deleting.`;
            console.log(
              "❌ Approval: Subtasks blocking deletion:",
              subtaskCheck.blockers,
            );
          }
        }

        // Admin Override (Only by Tasksetu Admin)
        if (!deleteAllowed && user.role === "tasksetu_admin") {
          console.log(
            "⚙️ Tasksetu Admin override: Allowing delete despite restrictions",
          );
          deleteAllowed = true;
          errorMessage = "";
        }

        break;

      case "subtask":
        console.log("🔍 Validating Sub-task delete conditions...");

        // Condition 1: Parent Task Active
        if (task.parentTaskId) {
          try {
            const parentTask = await storage.getTaskById(task.parentTaskId);
            if (!parentTask || parentTask.isDeleted) {
              deleteAllowed = false;
              errorMessage =
                "Cannot delete sub-task: parent task not found or deleted.";
              console.log("❌ Sub-task: Parent task not found or deleted");
            }
          } catch (error) {
            console.error("Error checking parent task:", error);
            deleteAllowed = false;
            errorMessage =
              "Cannot delete sub-task: parent task not found or deleted.";
          }
        }

        // Condition 2: Sub-task Status must be OPEN, ONHOLD, or CANCELLED
        if (
          deleteAllowed &&
          task.status &&
          !DELETABLE_STATUSES.includes(task.status)
        ) {
          deleteAllowed = false;
          errorMessage = `Cannot delete sub-task with status "${task.status}". Only subtasks with status OPEN, ONHOLD or CANCELLED can be deleted.`;
          console.log("❌ Sub-task: Status check failed -", task.status);
        }

        // Condition 3: Created by parent owner (already checked above)
        console.log("✅ Sub-task: Creator check passed");

        // Condition 4: Not linked to milestone/approval
        if (
          deleteAllowed &&
          (isLinkedToMilestone(task) || isApprovalLinked(task))
        ) {
          deleteAllowed = false;
          errorMessage =
            "Cannot delete sub-task: linked to milestone or approval workflow.";
          console.log("❌ Sub-task: Linked to milestone/approval");
        }

        break;

      case "quick":
        console.log("🔍 Validating Quick Task delete conditions...");

        // Condition 1: Task not converted to full task
        if (isConvertedFromQuickTask(task)) {
          deleteAllowed = false;
          errorMessage =
            "Quick task already converted or completed; cannot delete.";
          console.log("❌ Quick Task: Already converted");
        }

        // Condition 2: Created by self (already checked above)
        console.log("✅ Quick Task: Creator check passed");

        // Condition 3: Status must be OPEN, ONHOLD, or CANCELLED
        if (
          deleteAllowed &&
          task.status &&
          !DELETABLE_STATUSES.includes(task.status)
        ) {
          deleteAllowed = false;
          errorMessage = `Cannot delete quick task with status "${task.status}". Only tasks with status OPEN, ONHOLD or CANCELLED can be deleted.`;
          console.log("❌ Quick Task: Status check failed -", task.status);
        }

        break;

      default:
        console.log("🔍 Validating Default Task delete conditions...", {
          taskType: taskType,
          taskTypeLowerCase: taskType.toLowerCase(),
          taskStatus: task.status,
        });
        // For unknown task types, apply basic conditions
        if (task.status && !DELETABLE_STATUSES.includes(task.status)) {
          deleteAllowed = false;
          errorMessage = `Cannot delete task with status "${task.status}". Only tasks with status OPEN, ONHOLD or CANCELLED can be deleted.`;
          console.log("❌ Default Task: Status check failed -", task.status);
        }

        if (deleteAllowed) {
          const subtaskCheck = await checkSubtaskStatusesForDeletion(id);
          if (!subtaskCheck.allowed) {
            deleteAllowed = false;
            const blockerList = subtaskCheck.blockers
              .map((b) => `"${b.title}" (${b.status})`)
              .join(", ");
            errorMessage = `Cannot delete task: The following subtask(s) are not ONHOLD or CANCELLED: ${blockerList}. Please update their status before deleting.`;
            console.log(
              "❌ Default Task: Subtasks blocking deletion:",
              subtaskCheck.blockers,
            );
          }
        }

        // Admin Override
        if (!deleteAllowed && isAdmin(user)) {
          console.log(
            "⚙️ Admin override: Allowing delete despite restrictions",
          );
          deleteAllowed = true;
          errorMessage = "";
        }
    }

    // FINAL VALIDATION RESULT
    console.log("🔍 FINAL VALIDATION RESULT:", {
      deleteAllowed: deleteAllowed,
      errorMessage: errorMessage,
      taskType: taskType,
      taskStatus: task.status,
    });

    if (!deleteAllowed) {
      console.log("❌ DELETE REJECTED:", errorMessage);
      return res.status(400).json({
        success: false,
        message: errorMessage,
      });
    }

    console.log(
      "✅ All delete conditions passed, proceeding with soft delete...",
    );

    // Keep assignee for counter recalculation
    const assignee = task?.assignedTo;

    // Soft delete
    const updateResult = await storage.updateTask(
      id,
      {
        isDeleted: true,
        deletedBy: user.id,
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
      user.id,
    );

    // Activity feed: "Task deleted by {User} on {Date}"
    try {
      await ActivityHelper.logActivity({
        activityType: ActivityHelper.ACTIVITY_TYPES.TASK_DELETED,
        user: user.id,
        organization: task.organization || null,
        relatedId: id,
        relatedType: "task",
        data: {
          taskTitle: task.title,
          taskType: taskType,
          deletedBy: user.email || user.name || user.id,
          deletedAt: new Date().toISOString(),
        },
      });
    } catch (actErr) {
      console.error("Failed to log delete activity:", actErr);
    }

    // Audit log for task deletion
    await auditLogger.logTaskDeletion(task, user, req);

    // Verify the update by fetching the task again
    const updatedTask = await storage.getTaskById(id);
    console.log("Task state AFTER update:", {
      id: updatedTask?._id,
      title: updatedTask?.title,
      isDeleted: updatedTask?.isDeleted,
      updatedAt: updatedTask?.updatedAt,
    });

    // Double check with direct database query
    if (updatedTask && !updatedTask.isDeleted) {
      console.error("❌ WARNING: Task was not properly marked as deleted!");
      console.error(
        "Expected isDeleted: true, but got:",
        updatedTask.isDeleted,
      );
    } else if (updatedTask && updatedTask.isDeleted) {
      console.log("✅ Task successfully marked as deleted in database");
    } else {
      console.error("❌ ERROR: Could not retrieve updated task from database");
    }

    // ADDITIONAL DATABASE VERIFICATION - Direct MongoDB check
    try {
      const directDbCheck = await storage.directTaskCheck(id);
      console.log("🔍 DIRECT DATABASE CHECK:", directDbCheck);
    } catch (dbError) {
      console.error("Error in direct database check:", dbError);
    }

    // Recalculate counters for assignee after delete
    await recalcUserTaskCounters(assignee);

    console.log("=== DELETE TASK COMPLETE ===");

    res.json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete task",
      error: error.message,
    });
  }
};

export const approveOrRejectTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, comment } = req.body; // action: 'approve' or 'reject'
    const user = req.user;

    // Use Task.findById() to get Mongoose document with .save() method
    const task = await Task.findById(id);

    if (!task || !task.isApprovalTask) {
      return res.status(404).json({
        success: false,
        message: "Approval task not found",
      });
    }

    // ✅ SECURITY: Prevent creator self-approval (unless explicitly in approvers list)
    if (task.createdBy && task.createdBy.toString() === user.id.toString()) {
      const creatorIsApprover =
        task.approvers &&
        task.approvers.some(
          (approverId) => approverId.toString() === user.id.toString(),
        );

      if (!creatorIsApprover) {
        return res.status(403).json({
          success: false,
          message:
            "Task creator cannot approve their own task unless explicitly assigned as approver",
          error: "SELF_APPROVAL_DENIED",
        });
      } else {
        console.warn(
          `⚠️  SELF-APPROVAL WARNING: Creator ${user.email} is approving their own task ${task._id}`,
        );
      }
    }

    // ✅ Sequential mode: Verify it's current approver's turn
    if (task.approvalMode === "sequential") {
      const currentApproverIndex = task.currentApproverIndex || 0;
      const currentApprover =
        task.approverOrder && task.approverOrder[currentApproverIndex];

      if (
        !currentApprover ||
        currentApprover.approverId.toString() !== user.id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Not your turn to approve. Please wait for previous approvers.",
          error: "NOT_YOUR_TURN",
          currentApprover: currentApprover
            ? {
                order: currentApprover.order,
                status: currentApprover.status,
              }
            : null,
        });
      }
    } else {
      // ✅ Any/All mode: Check if user is in approvers list
      if (
        !task.approvers ||
        !task.approvers.some(
          (approverId) => approverId.toString() === user.id.toString(),
        )
      ) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to approve this task",
        });
      }
    }

    // ✅ Record decision in approvalDecisions array
    const approvalDecision = {
      approverId: user.id,
      decision: action,
      comment: comment || "",
      decidedAt: new Date(),
      isAutoApproval: false,
    };

    task.approvalDecisions = task.approvalDecisions || [];
    task.approvalDecisions.push(approvalDecision);

    // ✅ Process based on approval mode
    if (task.approvalMode === "sequential") {
      const currentIndex = task.currentApproverIndex || 0;

      // Update current approver's status in approverOrder
      if (task.approverOrder && task.approverOrder[currentIndex]) {
        task.approverOrder[currentIndex].status =
          action === "approve" ? "approved" : "rejected";
        task.approverOrder[currentIndex].decidedAt = new Date();
      }

      if (action === "approve") {
        // Move to next approver
        task.currentApproverIndex = currentIndex + 1;

        // Check if more approvers remain
        if (task.currentApproverIndex < (task.approverOrder?.length || 0)) {
          // ✅ Notify next approver
          const nextApprover = task.approverOrder[task.currentApproverIndex];
          nextApprover.status = "pending";

          await task.save(); // Save before notification

          await createTaskNotification(TriggerEvent.APPROVAL_REQUESTED, task, {
            targetUserId: nextApprover.approverId,
            title: "Your Turn: Sequential Approval Required",
            message: `Previous approver approved. You are approver #${nextApprover.order} for task: "${task.title}". Please review.`,
            priority: NotificationPriority.URGENT,
            metadata: {
              approvalOrder: nextApprover.order,
              totalApprovers: task.approverOrder.length,
              previousApproverDecision: "approved",
            },
          });

          console.log(
            `✅ [SEQUENTIAL] Notified next approver (order ${nextApprover.order}):`,
            nextApprover.approverId,
          );
        } else {
          // ✅ All approved in sequence
          task.approvalStatus = "approved";
          task.status = "DONE";
          console.log(
            `✅ [SEQUENTIAL] All approvers approved. Task completed.`,
          );
        }
      } else if (action === "reject") {
        // ✅ Sequential: One rejection ends the chain
        task.approvalStatus = "rejected";
        task.status = "CANCELLED";
        console.log(
          `❌ [SEQUENTIAL] Task rejected by approver order ${task.approverOrder[currentIndex].order}`,
        );
      }
    } else {
      // ✅ Any/All mode logic
      const approvedCount = task.approvalDecisions.filter(
        (d) => d.decision === "approve",
      ).length;
      const rejectedCount = task.approvalDecisions.filter(
        (d) => d.decision === "reject",
      ).length;

      if (task.approvalMode === "any" && approvedCount > 0) {
        task.approvalStatus = "approved";
        task.status = "DONE";
        console.log(`✅ [ANY MODE] Task approved (first approver)`);
      } else if (
        task.approvalMode === "all" &&
        approvedCount === task.approvers.length
      ) {
        task.approvalStatus = "approved";
        task.status = "DONE";
        console.log(
          `✅ [ALL MODE] Task approved (all ${task.approvers.length} approvers)`,
        );
      } else if (rejectedCount > 0 && task.approvalMode === "any") {
        task.approvalStatus = "rejected";
        task.status = "CANCELLED";
        console.log(`❌ [ANY MODE] Task rejected`);
      } else if (rejectedCount > 0 && task.approvalMode === "all") {
        task.approvalStatus = "rejected";
        task.status = "CANCELLED";
        console.log(`❌ [ALL MODE] Task rejected`);
      }
    }

    await task.save();

    // 🔔 Create notifications for approval response
    try {
      const approver = await User.findById(user.id).select(
        "firstName lastName email",
      );
      const approverName = approver
        ? `${approver.firstName} ${approver.lastName}`.trim()
        : "Someone";

      if (action === "approve") {
        // Notify task creator
        if (
          task.createdBy &&
          task.createdBy.toString() !== user.id.toString()
        ) {
          await createTaskNotification(TriggerEvent.APPROVAL_APPROVED, task, {
            targetUserId: task.createdBy,
            title: "Approval Granted",
            message: `${approverName} approved your task: "${task.title}"${comment ? " - Comment: " + comment : ""}`,
            priority: NotificationPriority.NORMAL,
            metadata: {
              approverName: approverName,
              comment: comment || null,
            },
          });
        }

        // If task is fully approved, notify assignee
        if (task.approvalStatus === "approved") {
          if (
            task.assignedTo &&
            task.assignedTo.toString() !== task.createdBy?.toString()
          ) {
            await createTaskNotification(TriggerEvent.APPROVAL_APPROVED, task, {
              targetUserId: task.assignedTo,
              title: "Task Fully Approved",
              message: `Task "${task.title}" has been fully approved and can proceed`,
              priority: NotificationPriority.NORMAL,
            });
          }
        }
      } else if (action === "reject") {
        // Notify task creator
        if (
          task.createdBy &&
          task.createdBy.toString() !== user.id.toString()
        ) {
          await createTaskNotification(TriggerEvent.APPROVAL_DENIED, task, {
            targetUserId: task.createdBy,
            title: "Approval Denied",
            message: `${approverName} rejected your task: "${task.title}"${comment ? " - Reason: " + comment : ""}`,
            priority: NotificationPriority.URGENT,
            metadata: {
              approverName: approverName,
              comment: comment || null,
            },
          });
        }

        // Notify assignee about rejection
        if (
          task.assignedTo &&
          task.assignedTo.toString() !== user.id.toString() &&
          task.assignedTo.toString() !== task.createdBy?.toString()
        ) {
          await createTaskNotification(TriggerEvent.APPROVAL_DENIED, task, {
            targetUserId: task.assignedTo,
            title: "Task Rejected",
            message: `Task "${task.title}" was rejected${comment ? " - Reason: " + comment : ""}`,
            priority: NotificationPriority.URGENT,
            metadata: {
              approverName: approverName,
              comment: comment || null,
            },
          });
        }
      }
    } catch (notificationError) {
      console.error("Error creating approval notification:", notificationError);
      // Don't fail the approval if notification fails
    }

    res.json({
      success: true,
      message: `Task ${action}d successfully`,
      approvalStatus: task.approvalStatus,
      currentApproverIndex:
        task.approvalMode === "sequential"
          ? task.currentApproverIndex
          : undefined,
      data: {
        taskId: task._id,
        approvalMode: task.approvalMode,
        approvalStatus: task.approvalStatus,
        taskStatus: task.status,
      },
    });
  } catch (error) {
    console.error("Error processing approval:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process approval",
      error: error.message,
    });
  }
};

export const getTasksByType = async (req, res) => {
  try {
    const user = req.user;
    const userRoles = Array.isArray(user.role) ? user.role : [user.role];
    const { type } = req.params;
    const {
      status,
      assignee,
      priority,
      page = 1,
      limit = 50,
      search,
      startDate,
      endDate,
      category,
    } = req.query;

    console.log("🔍 GET TASKS BY TYPE API CALLED:", {
      type,
      status,
      priority,
      page,
      limit,
      search,
    });

    // Validate task type
    const validTaskTypes = ["regular", "recurring", "milestone", "approval"];
    if (!validTaskTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid task type. Must be one of: regular, recurring, milestone, approval",
        validTypes: validTaskTypes,
      });
    }

    const filter = {
      taskType: type,
      isDeleted: { $ne: true },
      // ✅ Section 4.3: Exclude parent recurring templates, show only instances
      // Parent recurring task = template/container (not shown in task lists)
      // Child instances = actual tasks shown to users with correct due dates
      $or: [
        { isParentRecurring: { $ne: true } }, // Non-recurring tasks OR instances
        { isParentRecurring: { $exists: false } }, // Tasks created before this field existed
      ],
    };

    // -----------------------
    // ROLE-BASED FILTERING
    // -----------------------
    if (userRoles.includes("org_admin")) {
      // Org Admin: full org visibility, all tasks
      filter.organization = user.organizationId;
      // Optional: Approval tasks read-only logic can be applied in frontend if needed
    } else if (userRoles.includes("manager")) {
      // Manager: own tasks + tasks of their team
      const { User } = await import("../modals/userModal.js");
      const teamMembers = await User.find({
        managerId: user.id,
        status: "active",
      }).select("_id");
      const teamMemberIds = teamMembers.map((u) => u._id);

      filter.$or = [
        { assignedTo: user.id },
        { createdBy: user.id },
        { assignedTo: { $in: teamMemberIds } },
        { createdBy: { $in: teamMemberIds } },
        { approvers: user.id },
      ];
    } else if (userRoles.includes("employee")) {
      // Employee: only own tasks
      filter.$or = [
        { assignedTo: user.id },
        { createdBy: user.id },
        { approvers: user.id },
      ];
    } else {
      // Individual / fallback
      filter.createdBy = user.id;
    }

    // -----------------------
    // ADDITIONAL FILTERS
    // -----------------------
    if (status) filter.status = status;
    if (assignee) filter.assignedTo = assignee;
    if (priority) filter.priority = priority;
    if (category) filter.category = { $regex: category, $options: "i" };

    // Date range filter
    if (startDate && endDate)
      filter.dueDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    else if (startDate) filter.dueDate = { $gte: new Date(startDate) };
    else if (endDate) filter.dueDate = { $lte: new Date(endDate) };

    // Search filter
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ];
    }

    // Type-specific filter
    switch (type) {
      case "recurring":
        filter.isRecurring = true;
        break;
      case "milestone":
        filter.isMilestone = true;
        break;
      case "approval":
        filter.isApprovalTask = true;
        break;
    }

    // -----------------------
    // FETCH TASKS
    // -----------------------
    const tasks = await storage.getTasksByFilter(filter, {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
    });

    // -----------------------
    // POPULATE COLLABORATORS
    // -----------------------
    const allCollaboratorIds = new Set();
    if (tasks && tasks.length > 0) {
      for (let task of tasks) {
        if (Array.isArray(task.collaborators)) {
          task.collaborators.forEach((id) => {
            if (id) allCollaboratorIds.add(id.toString());
          });
        }
      }
    }

    let collaboratorsMap = {};
    if (allCollaboratorIds.size > 0) {
      const { User } = await import("../modals/userModal.js");
      const users = await User.find({
        _id: { $in: Array.from(allCollaboratorIds) },
        status: "active",
      })
        .select(
          "_id firstName lastName email role department designation avatar",
        )
        .lean();

      users.forEach((u) => {
        collaboratorsMap[u._id.toString()] = {
          id: u._id,
          name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email,
          email: u.email,
          role: Array.isArray(u.role) ? u.role : [u.role],
          department: u.department || "",
          designation: u.designation || "",
          avatar: u.avatar || null,
        };
      });
    }

    // -----------------------
    // POPULATE APPROVERS FOR APPROVAL TASKS
    // -----------------------
    const allApproverIds = new Set();
    if (tasks && tasks.length > 0) {
      for (let task of tasks) {
        if (task.isApprovalTask && Array.isArray(task.approvers)) {
          task.approvers.forEach((id) => {
            if (id) allApproverIds.add(id.toString());
          });
        }
      }
    }

    let approversMap = {};
    if (allApproverIds.size > 0) {
      const { User } = await import("../modals/userModal.js");
      const approverUsers = await User.find({
        _id: { $in: Array.from(allApproverIds) },
        status: "active",
      })
        .select(
          "_id firstName lastName email role department designation avatar",
        )
        .lean();

      approverUsers.forEach((u) => {
        approversMap[u._id.toString()] = {
          id: u._id,
          name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email,
          email: u.email,
          role: Array.isArray(u.role) ? u.role[0] : u.role, // Use first role for display
          department: u.department || "",
          designation: u.designation || "",
          avatar: u.avatar || null,
        };
      });
    }

    // -----------------------
    // POPULATE LINKED TASKS FOR MILESTONES
    // -----------------------
    const allLinkedTaskIds = new Set();
    if (tasks && tasks.length > 0) {
      for (let task of tasks) {
        if (task.isMilestone && Array.isArray(task.linkedTasks)) {
          task.linkedTasks.forEach((id) => {
            if (id) allLinkedTaskIds.add(id.toString());
          });
        }
      }
    }

    let linkedTasksMap = {};
    if (allLinkedTaskIds.size > 0) {
      const linkedTasksData = await storage.getTasksByFilter(
        {
          _id: { $in: Array.from(allLinkedTaskIds) },
          isDeleted: { $ne: true },
        },
        { page: 1, limit: 1000, sort: { createdAt: -1 } },
      );

      linkedTasksData.forEach((t) => {
        linkedTasksMap[t._id.toString()] = {
          _id: t._id,
          title: t.title,
          status: t.status,
          completed: t.status === "DONE" || t.status === "COMPLETED",
        };
      });
    }

    // -----------------------
    // GROUP TASKS BY CREATED ROLE
    // -----------------------
    const roleList = [
      "super_admin",
      "org_admin",
      "manager",
      "individual",
      "employee",
    ];
    const groupedTasks = {};
    roleList.forEach((role) => (groupedTasks[role] = []));

    if (tasks && tasks.length > 0) {
      for (let task of tasks) {
        task.statusColor = STATUS_COLOR_MAP[task.status] || "#6B7280";

        // ✅ Log recurring task details for debugging
        if (task.isRecurring) {
          console.log(`🔄 [GET TASKS BY TYPE] Recurring Task/Instance:`, {
            id: task._id,
            title: task.title,
            isParentRecurring: task.isParentRecurring,
            instanceNumber: task.instanceNumber,
            parentRecurringTaskId: task.parentRecurringTaskId,
            dueDate: task.dueDate,
            status: task.status,
          });
        }

        // 🏔️ Populate linked tasks for milestones
        if (task.isMilestone && Array.isArray(task.linkedTasks)) {
          const populatedLinkedTasks = task.linkedTasks
            .map((id) => linkedTasksMap[id?.toString()])
            .filter(Boolean);

          // Add to milestoneData for frontend consumption
          if (!task.milestoneData) {
            task.milestoneData = {};
          }
          task.milestoneData.linkedTaskIds = populatedLinkedTasks;

          console.log(
            `🏔️ [MILESTONE] Populated linked tasks for milestone "${task.title}":`,
            {
              milestoneId: task._id,
              linkedTaskCount: populatedLinkedTasks.length,
              linkedTasks: populatedLinkedTasks.map((t) => ({
                id: t._id,
                title: t.title,
                status: t.status,
              })),
            },
          );
        }

        // ✅ Populate approvers for approval tasks
        if (task.isApprovalTask && Array.isArray(task.approvers)) {
          const populatedApprovers = task.approvers
            .map((approverId) => {
              const approverData = approversMap[approverId?.toString()];
              if (!approverData) return null;

              // Get approval decision for this approver
              const decision = task.approvalDecisions?.find(
                (d) => d.approverId?.toString() === approverId?.toString(),
              );

              // Get status from approverOrder for sequential mode
              let approverStatus = "pending";
              if (task.approvalMode === "sequential" && task.approverOrder) {
                const orderEntry = task.approverOrder.find(
                  (o) => o.approverId?.toString() === approverId?.toString(),
                );
                if (orderEntry) {
                  approverStatus = orderEntry.status || "pending";
                }
              } else if (decision) {
                // For any/all modes, check approval decisions
                approverStatus =
                  decision.decision === "approve"
                    ? "approved"
                    : decision.decision === "reject"
                      ? "rejected"
                      : "pending";
              }

              return {
                ...approverData,
                status: approverStatus,
                comment: decision?.comment || null,
                approvedAt: decision?.decidedAt || null,
              };
            })
            .filter(Boolean);

          task.approvers = populatedApprovers;

          console.log(
            `✅ [APPROVAL] Populated approvers for task "${task.title}":`,
            {
              taskId: task._id,
              approvalMode: task.approvalMode,
              approversCount: populatedApprovers.length,
              approvers: populatedApprovers.map((a) => ({
                id: a.id,
                name: a.name,
                status: a.status,
                role: a.role,
              })),
            },
          );
        }

        if (Array.isArray(task.collaborators)) {
          task.collaborators = task.collaborators
            .map((id) => collaboratorsMap[id?.toString()])
            .filter(Boolean);
        } else {
          task.collaborators = [];
        }

        if (groupedTasks[task.createdByRole]) {
          groupedTasks[task.createdByRole].push(task);
        }

        if (task.isApprovalTask) {
          try {
            const approvals = await storage.getTaskApprovals(task._id);
            task.approvalDetails = approvals;
          } catch (err) {
            console.error("Error fetching approvals for task:", task._id, err);
          }
        }
      }
    }

    // -----------------------
    // PAGINATION
    // -----------------------
    const totalTasks = tasks ? tasks.length : 0;
    const totalPages = Math.ceil(totalTasks / parseInt(limit));
    const hasNext = parseInt(page) < totalPages;
    const hasPrev = parseInt(page) > 1;

    // ✅ Log summary for debugging
    const recurringInstancesCount = tasks
      ? tasks.filter((t) => t.isRecurring && !t.isParentRecurring).length
      : 0;
    console.log(`✅ [GET TASKS BY TYPE] Summary for type "${type}":`, {
      totalTasks,
      recurringInstancesCount,
      parentTemplatesFiltered: "All parent templates excluded (Section 4.3)",
      pagination: { currentPage: parseInt(page), totalPages, hasNext, hasPrev },
    });

    res.json({
      success: true,
      data: {
        roles: groupedTasks,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalTasks,
          hasNextPage: hasNext,
          hasPrevPage: hasPrev,
          limit: parseInt(limit),
        },
        statusColorMap: STATUS_COLOR_MAP,
      },
    });
  } catch (error) {
    console.error("Error fetching tasks by type:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch tasks by type",
      error: error.message,
    });
  }
};

export const getMyTasks = async (req, res) => {
  try {
    const {
      status,
      priority,
      page = 1,
      limit = 10,
      search,
      role,
      activeRole,
    } = req.query;

    const user = req.user;
    const userRoles = Array.isArray(user.role) ? user.role : [user.role];

    console.log("🔍 GET MY TASKS API CALLED:", {
      status,
      priority,
      page,
      limit,
      search,
      role,
      activeRole,
      userId: user.id,
      userRoles,
      organizationId: user.organizationId,
    });

    // ✅ FIX: subordinates fetch karo (teamMembers nahi)
    // ✅ FALLBACK: agar subordinates empty hai toh org ke saare employees fetch karo
    let teamMemberIds = [];
    if (userRoles.includes("manager")) {
      const managerUser = await User.findById(user.id).select("subordinates");
      const subordinateIds = (managerUser?.subordinates || []).map((id) =>
        id.toString()
      );

      console.log("👥 Manager subordinates from DB:", subordinateIds);

      if (subordinateIds.length > 0) {
        // ✅ subordinates properly set hain — use karo
        teamMemberIds = subordinateIds;
      } else {
        // ✅ FALLBACK: subordinates empty hai, same org ke saare employees fetch karo
        console.log(
          "👥 subordinates empty — falling back to org employees"
        );
        if (user.organizationId) {
          const orgEmployees = await User.find({
            organization_id: user.organizationId,
            role: { $in: ["employee", "manager"] },
            _id: { $ne: user.id }, // manager ko exclude karo
            status: "active",
          }).select("_id");

          teamMemberIds = orgEmployees.map((u) => u._id.toString());
          console.log(
            "👥 Fallback org employees found:",
            teamMemberIds.length,
            teamMemberIds
          );
        }
      }
    }

    const showSnooze = req.query.showSnooze === "true";

    // Base filter
    const filter = {
      isDeleted: { $ne: true },
      isSubtask: { $ne: true },
      $and: [
        ...(showSnooze
          ? [{ $or: [{ isSnooze: true }] }]
          : [
              {
                $or: [
                  { isSnooze: { $ne: true } },
                  { isSnooze: { $exists: false } },
                ],
              },
            ]),
        {
          $or: [
            { isParentRecurring: { $ne: true } },
            { isParentRecurring: { $exists: false } },
          ],
        },
      ],
    };

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // ✅ Role-based DB filter
    if (userRoles.includes("org_admin")) {
      if (user.organizationId) {
        filter.organization = user.organizationId;
      }
    } else if (userRoles.includes("manager")) {
      // ✅ FIX: Manager sees own tasks + team members tasks
      filter.$or = [
        { assignedTo: user.id },
        { createdBy: user.id },
        ...(teamMemberIds.length > 0
          ? [
              { assignedTo: { $in: teamMemberIds } },
              { createdBy: { $in: teamMemberIds } },
            ]
          : []),
      ];
    } else if (userRoles.includes("employee")) {
      filter.$or = [{ assignedTo: user.id }, { createdBy: user.id }];
    } else {
      filter.createdBy = user.id;
    }

    if (role) {
      filter.createdByRole = role;
    }

    const allTasksFromDB = await storage.getTasksByFilter(filter, {
      sort: { createdAt: -1 },
      limit: 10000,
      page: 1,
    });

    console.log(
      "🔍 Tasks fetched from DB:",
      allTasksFromDB ? allTasksFromDB.length : 0
    );

    const allTasksWithSubtasks = [];

    for (const task of allTasksFromDB) {
      const existingSubtasks = task.subtasks || [];

      const enhancedSubtasks = existingSubtasks.map((subtask) => ({
        ...subtask,
        isSnooze: subtask.isSnooze || false,
        snoozeUntil: subtask.snoozeUntil || null,
        snoozeReason: subtask.snoozeReason || null,
        snoozedBy: subtask.snoozedBy || null,
        snoozedAt: subtask.snoozedAt || null,
        isRisk: subtask.isRisk || false,
        riskLevel: subtask.riskLevel || null,
        riskReason: subtask.riskReason || null,
        riskMarkedBy: subtask.riskMarkedBy || null,
        riskMarkedAt: subtask.riskMarkedAt || null,
        completedDate: subtask.completedDate || null,
        completedBy: subtask.completedBy || null,
        completionNotes: subtask.completionNotes || null,
        statusColor: STATUS_COLOR_MAP[subtask.status] || "#6B7280",
      }));

      const taskWithSubtasks = {
        ...task,
        subtasks: enhancedSubtasks || [],
        isSnooze: task.isSnooze || false,
        snoozeUntil: task.snoozeUntil || null,
        snoozeReason: task.snoozeReason || null,
        snoozedBy: task.snoozedBy || null,
        snoozedAt: task.snoozedAt || null,
        isRisk: task.isRisk || false,
        riskLevel: task.riskLevel || null,
        riskReason: task.riskReason || null,
        riskMarkedBy: task.riskMarkedBy || null,
        riskMarkedAt: task.riskMarkedAt || null,
        completedDate: task.completedDate || null,
        completedBy: task.completedBy || null,
        completionNotes: task.completionNotes || null,
        statusColor: STATUS_COLOR_MAP[task.status] || "#6B7280",
      };

      // 🎯 ROLE-BASED VISIBILITY LOGIC
      let isVisibleForActiveRole = true;

      if (activeRole && userRoles.includes(activeRole)) {
        const taskCreatedByRoles = Array.isArray(task.createdByRole)
          ? task.createdByRole
          : [task.createdByRole];

        const taskAssigneeId =
          task.assignedTo?._id?.toString() || task.assignedTo?.toString();
        const taskCreatorId =
          task.createdBy?._id?.toString() || task.createdBy?.toString();

        const isUserAssignee = taskAssigneeId === user.id.toString();
        const isUserCreator = taskCreatorId === user.id.toString();

        // ✅ FIX: teamMemberIds mein ab subordinates ya fallback org employees hain
        const isTeamMemberAssignee = teamMemberIds.includes(taskAssigneeId);
        const isTeamMemberCreator = teamMemberIds.includes(taskCreatorId);

        if (activeRole === "manager") {
          if (
            isUserCreator ||
            isUserAssignee ||
            isTeamMemberAssignee ||
            isTeamMemberCreator
          ) {
            isVisibleForActiveRole = true;
          } else {
            isVisibleForActiveRole = false;
          }
        } else if (activeRole === "org_admin") {
          isVisibleForActiveRole = true;
        } else if (activeRole === "employee") {
          if (isUserCreator) {
            isVisibleForActiveRole = taskCreatedByRoles.includes("employee");
          } else if (isUserAssignee) {
            isVisibleForActiveRole = true;
          } else {
            isVisibleForActiveRole = false;
          }
        } else {
          if (isUserCreator) {
            isVisibleForActiveRole = taskCreatedByRoles.includes(activeRole);
          } else if (isUserAssignee) {
            if (taskCreatedByRoles.includes("org_admin")) {
              isVisibleForActiveRole =
                activeRole === "employee" || activeRole === "manager";
            } else {
              isVisibleForActiveRole =
                activeRole === "employee" || activeRole === "manager";
            }
          } else {
            isVisibleForActiveRole = activeRole === "org_admin";
          }
        }
      }

      if (isVisibleForActiveRole) {
        allTasksWithSubtasks.push(taskWithSubtasks);
      }
    }

    console.log(
      "🔍 Tasks after role filter:",
      allTasksWithSubtasks.length,
      "/",
      allTasksFromDB.length
    );

    // Pagination on filtered results
    const totalFilteredTasks = allTasksWithSubtasks.length;
    const totalPages = Math.ceil(totalFilteredTasks / parseInt(limit));
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedTasks = allTasksWithSubtasks.slice(startIndex, endIndex);

    const hasNext = parseInt(page) < totalPages;
    const hasPrev = parseInt(page) > 1;

    console.log(
      "🔍 Sending response:",
      paginatedTasks.length,
      "tasks, page",
      parseInt(page),
      "/",
      totalPages
    );

    res.json({
      success: true,
      data: {
        tasks: paginatedTasks,
        pagination: {
          currentPage: parseInt(page),
          totalPages: totalPages,
          totalTasks: totalFilteredTasks,
          hasNextPage: hasNext,
          hasPrevPage: hasPrev,
          limit: parseInt(limit),
        },
        statusColorMap: STATUS_COLOR_MAP,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching MyTasks:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch tasks by type",
      error: error.message,
    });
  }
};

// Snooze Task API
export const snoozeTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { snoozeUntil, reason } = req.body;
    const user = req.user;

    console.log("🔍 SNOOZE API DEBUG:", {
      taskId,
      snoozeUntil,
      reason,
      userId: user?.id,
      userIdType: typeof user?.id,
      userName: user?.firstName + " " + user?.lastName,
    });

    // Validate required fields
    if (!snoozeUntil) {
      return res.status(400).json({
        success: false,
        message: "Snooze until date is required",
      });
    }

    // Validate snooze time is in the future
    const snoozeDate = new Date(snoozeUntil);
    if (snoozeDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Invalid snooze time. Snooze date must be in the future.",
      });
    }

    const task = await storage.getTaskById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    console.log("🔍 TASK FOUND:", {
      taskId: task._id,
      taskType: task.taskType,
      isApprovalTask: task.isApprovalTask,
      status: task.status,
      assignedTo: task.assignedTo,
      assignedToType: typeof task.assignedTo,
      collaboratorIds: task.collaboratorIds,
    });

    // ❌ VALIDATION 1: Approval tasks CANNOT be snoozed (Document Rule)
    if (task.isApprovalTask || task.taskType === "approval") {
      return res.status(400).json({
        success: false,
        message:
          "Approval tasks cannot be snoozed to maintain workflow continuity.",
      });
    }

    // ❌ VALIDATION 2: Only active tasks can be snoozed (OPEN, INPROGRESS, OVERDUE)
    const allowedStatuses = ["OPEN", "INPROGRESS", "OVERDUE"];
    if (!allowedStatuses.includes(task.status)) {
      const statusMessages = {
        DONE: "Cannot snooze completed task.",
        CANCELLED: "Cannot snooze cancelled task.",
        ONHOLD: "Task is already on hold. Cannot snooze.",
      };
      return res.status(400).json({
        success: false,
        message:
          statusMessages[task.status] ||
          `Cannot snooze task with status: ${task.status}. Snooze available only for active (open/in-progress/overdue) tasks.`,
      });
    }

    // ⚠️ VALIDATION 3: Milestone tasks - Only Manager/Company Admin can snooze
    if (task.taskType === "milestone" || task.type === "milestone") {
      const userRoles = Array.isArray(user.role) ? user.role : [user.role];
      const canSnoozeMilestone = userRoles.some((role) =>
        ["manager", "org_admin", "super_admin"].includes(role),
      );

      if (!canSnoozeMilestone) {
        return res.status(403).json({
          success: false,
          message: "Only Managers and Admins can snooze milestone tasks.",
        });
      }
    }

    // ✅ VALIDATION 4: Check user permissions (assignee, collaborator, manager, or admin)
    const userRoles = Array.isArray(user.role) ? user.role : [user.role];
    const isIndividualUser = userRoles.includes("individual");
    const isAdmin = userRoles.some((role) =>
      ["org_admin", "super_admin", "manager"].includes(role),
    );

    // Normalize user ID and task IDs for comparison
    const userId = user.id?.toString() || user._id?.toString();
    const taskAssignedToId =
      task.assignedTo?._id?.toString() || task.assignedTo?.toString();
    const taskCreatedById =
      task.createdBy?._id?.toString() || task.createdBy?.toString();
    const userOrgId =
      user.organizationId?.toString() || user.organization_id?.toString();
    const taskOrgId = (task.organization?._id || task.organization)?.toString();

    const isAssignee = taskAssignedToId === userId;
    const isCreator = taskCreatedById === userId;
    const isCollaborator =
      task.collaboratorIds?.some((id) => id.toString() === userId) ||
      task.collaborators?.some(
        (collab) => (collab._id?.toString() || collab.toString()) === userId,
      );

    let hasPermission = false;

    // Check permission based on user type (Organization vs Individual)
    if (isIndividualUser) {
      // 1. INDIVIDUAL USER LOGIC (Unchanged for backwards compatibility)
      // Individual users can snooze their own tasks or tasks they're collaborator on
      hasPermission = isAssignee || isCreator || isCollaborator;
      console.log("SNOOZE - Individual permission check:", { hasPermission });
    } else {
      // 2. ORGANIZATION USER LOGIC (Enhanced for Employee/Manager/Admin)
      // A) Basic ownership/involvement
      if (isAssignee || isCreator || isCollaborator) {
        hasPermission = true;
      }
      // B) Manager/Admin permissions - Must be in the Same Organization
      else if (isAdmin && userOrgId && taskOrgId && userOrgId === taskOrgId) {
        hasPermission = true;
      }

      console.log("SNOOZE - Organization permission check:", {
        hasPermission,
        isAdmin,
        sameOrg: userOrgId === taskOrgId,
      });
    }

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to snooze this task. Only assignee, creator, collaborators, or admins within the organization can snooze tasks.",
      });
    }

    // ✅ Update task with snooze data (WITHOUT changing due date or assignment)
    const updatedTask = await storage.updateTask(taskId, {
      isSnooze: true,
      snoozeUntil: snoozeDate,
      snoozeReason: reason || null,
      snoozedBy: user.id,
      snoozedAt: new Date(),
      updatedBy: user.id,
      updatedAt: new Date(),
      // NOTE: Due date and assignment remain unchanged as per specification
    });

    // Log activity for snooze
    const snoozeUserTimezone = await TimezoneHelper.getUserTimezone(user.id);
    await storage.createActivity({
      type: "TASK_SNOOZED",
      description: `Task snoozed until ${TimezoneHelper.formatDateTimeInTimezone(snoozeDate, snoozeUserTimezone)}${reason ? `. Reason: ${reason}` : ""}`,
      user: user.id,
      relatedId: task._id,
      relatedType: "task",
      metadata: {
        taskId: task._id.toString(),
        snoozeUntil: snoozeDate,
        reason: reason,
      },
    });

    // ✅ ORGANIZATION LOGIC: Notify assignee if someone else snoozed their task
    if (task.organization && task.assignedTo) {
      const assigneeId = task.assignedTo?._id || task.assignedTo;
      if (assigneeId && assigneeId.toString() !== user.id.toString()) {
        await createTaskNotification(TriggerEvent.TASK_SNOOZED, updatedTask, {
          targetUserId: assigneeId,
          metadata: {
            snoozeUntil: TimezoneHelper.formatDateTimeInTimezone(
              snoozeDate,
              snoozeUserTimezone,
            ),
            snoozedBy: user.firstName + " " + user.lastName,
            reason: reason || "No reason provided",
          },
        });
      }
    }

    console.log("✅ Task snoozed successfully:", {
      taskId: updatedTask._id,
      dueDate: task.dueDate, // Unchanged
      snoozeUntil: snoozeDate,
      snoozedBy: user.id,
    });

    res.json({
      success: true,
      message:
        "Task snoozed successfully. Task will be hidden from My Tasks Dashboard until snooze expiry.",
      data: updatedTask,
    });
  } catch (error) {
    console.error("Error snoozing task:", error);
    res.status(500).json({
      success: false,
      message: "Failed to snooze task",
      error: error.message,
    });
  }
};

// Unsnooze Task API
export const unsnoozeTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const user = req.user;

    const task = await storage.getTaskById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // ✅ Check if task is actually snoozed
    if (!task.isSnooze) {
      return res.status(400).json({
        success: false,
        message: "Task is not currently snoozed.",
      });
    }

    // ✅ Check user permissions (assignee, collaborator, manager, or admin)
    const userRoles = Array.isArray(user.role) ? user.role : [user.role];
    const isIndividualUser = userRoles.includes("individual");
    const isAdmin = userRoles.some((role) =>
      ["org_admin", "super_admin", "manager"].includes(role),
    );

    // Normalize IDs for comparison
    const userId = user.id?.toString();
    const taskAssignedToId =
      task.assignedTo?._id?.toString() || task.assignedTo?.toString();
    const taskCreatedById =
      task.createdBy?._id?.toString() || task.createdBy?.toString();
    const userOrgId =
      user.organizationId?.toString() || user.organization_id?.toString();
    const taskOrgId = (task.organization?._id || task.organization)?.toString();

    const isAssignee = taskAssignedToId === userId;
    const isCreator = taskCreatedById === userId;
    const isCollaborator =
      task.collaboratorIds?.some((id) => id.toString() === userId) ||
      task.collaborators?.some(
        (collab) => (collab._id?.toString() || collab.toString()) === userId,
      );

    let hasPermission = false;

    // Check permission based on user type (Organization vs Individual)
    if (isIndividualUser) {
      // 1. INDIVIDUAL USER LOGIC (Unchanged for backwards compatibility)
      hasPermission = isAssignee || isCreator || isCollaborator;
    } else {
      // 2. ORGANIZATION USER LOGIC
      if (isAssignee || isCreator || isCollaborator) {
        hasPermission = true;
      } else if (isAdmin && userOrgId && taskOrgId && userOrgId === taskOrgId) {
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to unsnooze this task.",
      });
    }

    // Determine if this is manual unsnooze or automatic wake-up
    const isManualUnsnooze = req.body.manual !== false; // Default to manual unless specified
    const unsnoozedBy = isManualUnsnooze
      ? "manually"
      : "automatically (wake-up)";

    // ✅ Remove snooze data (WITHOUT changing due date or assignment)
    const updatedTask = await storage.updateTask(taskId, {
      isSnooze: false,
      snoozeUntil: null,
      snoozeReason: null,
      snoozedBy: null,
      snoozedAt: null,
      updatedBy: user.id,
      updatedAt: new Date(),
      // NOTE: Due date and assignment remain unchanged as per specification
    });

    // Log activity for unsnooze
    await storage.createActivity({
      type: "TASK_UNSNOOZED",
      description: `Task unsnoozed ${unsnoozedBy}`,
      user: user.id,
      relatedId: task._id,
      relatedType: "task",
      metadata: {
        taskId: task._id.toString(),
        unsnoozeType: unsnoozedBy,
      },
    });

    // ✅ ORGANIZATION LOGIC: Notify assignee if someone else unsnoozed their task
    if (task.organization && task.assignedTo) {
      const assigneeId = task.assignedTo?._id || task.assignedTo;
      if (assigneeId && assigneeId.toString() !== user.id.toString()) {
        await createTaskNotification(TriggerEvent.TASK_UNSNOOZED, updatedTask, {
          targetUserId: assigneeId,
          metadata: {
            unsnoozedBy: user.firstName + " " + user.lastName,
          },
        });
      }
    }

    console.log("✅ Task unsnoozed successfully:", {
      taskId: updatedTask._id,
      dueDate: task.dueDate, // Unchanged
      previousSnoozeDate: task.snoozeUntil,
      unsnoozeType: unsnoozedBy,
    });

    res.json({
      success: true,
      message: `Task unsnoozed successfully. Task will reappear in My Tasks Dashboard.`,
      data: updatedTask,
    });
  } catch (error) {
    console.error("Error unsnoozing task:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unsnooze task",
      error: error.message,
    });
  }
};

// Mark Task as Risk API
export const markTaskAsRisk = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { riskReason, riskLevel } = req.body;
    const user = req.user;

    const task = await storage.getTaskById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    console.log("🔍 MARK AS RISK - TASK FOUND:", {
      taskId: task._id,
      taskType: task.taskType,
      isApprovalTask: task.isApprovalTask,
      status: task.status,
      assignedTo: task.assignedTo,
    });

    // ❌ VALIDATION 1: Cannot mark completed or cancelled tasks as risk
    const invalidStatuses = ["DONE", "CANCELLED"];
    if (invalidStatuses.includes(task.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot mark ${task.status === "DONE" ? "completed" : "cancelled"} task as risk. Risk flag not available after task completion.`,
      });
    }

    // ⚠️ VALIDATION 2: Approval tasks - Limited (only before submission)
    if (task.isApprovalTask || task.taskType === "approval") {
      // If approval task is already submitted/in review, cannot mark as risk
      if (
        task.approvalStatus &&
        ["submitted", "approved", "rejected"].includes(
          task.approvalStatus.toLowerCase(),
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Cannot mark approval task as risk after submission. Risk marking only available before submission.",
        });
      }
    }

    // ✅ VALIDATION 3: Only active tasks (OPEN, INPROGRESS, ONHOLD, OVERDUE) can be marked as risk
    const allowedStatuses = ["OPEN", "INPROGRESS", "ONHOLD", "OVERDUE"];
    if (!allowedStatuses.includes(task.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot mark task as risk with status: ${task.status}. Risk flag available only for active tasks (Open/In Progress/On Hold/Overdue).`,
      });
    }

    // ✅ VALIDATION 4: Check user permissions (assignee, creator, collaborator, manager, or admin)
    const userRoles = Array.isArray(user.role) ? user.role : [user.role];
    const isAdmin = userRoles.some((role) =>
      ["org_admin", "super_admin", "manager"].includes(role),
    );

    // Handle both ObjectId and populated object formats
    const getIdString = (field) => {
      if (!field) return null;
      if (typeof field === "string") return field;
      if (field._id) return field._id.toString();
      if (field.id) return field.id.toString();
      return field.toString();
    };

    const taskAssignedToId = getIdString(task.assignedTo);
    const taskCreatedById = getIdString(task.createdBy);
    const userId = user.id.toString();

    const isAssignee = taskAssignedToId === userId;
    const isCreator = taskCreatedById === userId;
    const isCollaborator = (task.collaborators || task.collaboratorIds)?.some(
      (id) => getIdString(id) === userId,
    );

    // Debug permission check
    console.log("🔐 MARK AS RISK - PERMISSION CHECK:", {
      userId,
      taskAssignedToId,
      taskCreatedById,
      taskCollaborators: (task.collaborators || task.collaboratorIds)?.map(
        (id) => getIdString(id),
      ),
      isAssignee,
      isCreator,
      isCollaborator,
      isAdmin,
      userRoles,
    });

    // Allow if user is assignee, creator, collaborator, or admin
    const hasPermission = isAssignee || isCreator || isCollaborator || isAdmin;

    console.log("🔐 MARK AS RISK - HAS PERMISSION:", hasPermission);

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to mark this task as risk.",
      });
    }

    // ✅ VALIDATION 5: Validate risk level
    const validRiskLevels = ["low", "medium", "high"];
    const finalRiskLevel =
      riskLevel && validRiskLevels.includes(riskLevel.toLowerCase())
        ? riskLevel.toLowerCase()
        : "medium";

    // ✅ Update task with risk data
    const updatedTask = await storage.updateTask(taskId, {
      isRisk: true,
      riskLevel: finalRiskLevel,
      riskReason: riskReason || "Task requires attention",
      riskMarkedBy: user.id,
      riskMarkedAt: new Date(),
      updatedBy: user.id,
      updatedAt: new Date(),
    });

    // ✅ If it's a subtask, also mark parent task as having risk
    if (task.parentTaskId) {
      await storage.updateTask(task.parentTaskId, {
        hasRisk: true,
        updatedBy: user.id,
        updatedAt: new Date(),
      });
    }

    // Log activity
    try {
      await storage.trackActivity({
        activityType: ActivityHelper.ACTIVITY_TYPES.TASK_RISK_MARKED,
        userId: user.id,
        organizationId: getTaskOrganizationId(task.organization),
        relatedId: taskId,
        relatedType: "task",
        data: {
          taskTitle: task.title,
          riskLevel: finalRiskLevel,
          riskReason: riskReason || "Task requires attention",
        },
      });
    } catch (activityError) {
      console.error("❌ Activity logging failed:", activityError);
    }

    // 🔔 Send notification to managers about risk marking
    try {
      const taskOrgId =
        getTaskOrganizationId(task.organization) || user.organizationId;
      if (taskOrgId) {
        // Find managers and org_admins in the same organization
        const managers = await User.find({
          organization_id: taskOrgId,
          role: { $in: ["manager", "org_admin"] },
          isActive: true,
        }).select("_id");

        for (const manager of managers) {
          // Don't notify the person who marked it
          if (manager._id.toString() === user.id.toString()) continue;
          await createTaskNotification(TriggerEvent.OVERDUE_ESCALATION, task, {
            targetUserId: manager._id,
            title: `⚠️ Task Marked as Risk: ${task.title}`,
            message: `Task "${task.title}" has been marked as ${finalRiskLevel} risk. Reason: ${riskReason || "Task requires attention"}`,
            priority: NotificationPriority.URGENT,
            channels: [ChannelType.IN_APP, ChannelType.EMAIL],
            metadata: {
              riskLevel: finalRiskLevel,
              riskReason: riskReason || "Task requires attention",
              markedBy: user.id,
            },
          });
        }
        console.log(
          `🔔 Risk marking notifications sent to ${managers.length} manager(s) for task: ${task.title}`,
        );
      }

      // Also notify task creator and assignee (if different from risk marker)
      const taskCreatorId =
        task.createdBy?._id?.toString() || task.createdBy?.toString();
      if (taskCreatorId && taskCreatorId !== user.id.toString()) {
        await createTaskNotification(TriggerEvent.TASK_UPDATED, task, {
          targetUserId: taskCreatorId,
          title: `⚠️ Task Marked as Risk: ${task.title}`,
          message: `Your task "${task.title}" has been marked as ${finalRiskLevel} risk`,
          priority: NotificationPriority.URGENT,
          channels: [ChannelType.IN_APP, ChannelType.EMAIL],
          metadata: {
            riskLevel: finalRiskLevel,
            riskReason: riskReason || "Task requires attention",
          },
        });
      }
      const taskAssigneeId =
        task.assignedTo?._id?.toString() || task.assignedTo?.toString();
      if (
        taskAssigneeId &&
        taskAssigneeId !== user.id.toString() &&
        taskAssigneeId !== taskCreatorId
      ) {
        await createTaskNotification(TriggerEvent.TASK_UPDATED, task, {
          targetUserId: taskAssigneeId,
          title: `⚠️ Task Marked as Risk: ${task.title}`,
          message: `Task "${task.title}" assigned to you has been marked as ${finalRiskLevel} risk`,
          priority: NotificationPriority.URGENT,
          channels: [ChannelType.IN_APP, ChannelType.EMAIL],
          metadata: {
            riskLevel: finalRiskLevel,
            riskReason: riskReason || "Task requires attention",
          },
        });
      }
    } catch (notificationError) {
      console.error(
        "Failed to send risk marking notification:",
        notificationError.message,
      );
      // Don't fail the risk marking if notification fails
    }

    res.json({
      success: true,
      message: `Task marked as ${finalRiskLevel} risk successfully. This will be flagged for managerial escalation.`,
      data: updatedTask,
    });
  } catch (error) {
    console.error("Error marking task as risk:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark task as risk",
      error: error.message,
    });
  }
};

// Unmark Task as Risk API
export const unmarkTaskAsRisk = async (req, res) => {
  try {
    const { taskId } = req.params;
    const user = req.user;

    const task = await storage.getTaskById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // ✅ Check if task is actually marked as risk
    if (!task.isRisk) {
      return res.status(400).json({
        success: false,
        message: "Task is not currently marked as risk.",
      });
    }

    // ✅ Check user permissions (assignee, collaborator, manager, or admin)
    const userRoles = Array.isArray(user.role) ? user.role : [user.role];
    const isAdmin = userRoles.some((role) =>
      ["org_admin", "super_admin", "manager"].includes(role),
    );

    // Handle both ObjectId and populated object formats
    const getIdString = (field) => {
      if (!field) return null;
      if (typeof field === "string") return field;
      if (field._id) return field._id.toString();
      if (field.id) return field.id.toString();
      return field.toString();
    };

    const taskAssignedToId = getIdString(task.assignedTo);
    const taskCreatedById = getIdString(task.createdBy);
    const userId = user.id.toString();

    const isAssignee = taskAssignedToId === userId;
    const isCreator = taskCreatedById === userId;
    const isCollaborator = (task.collaborators || task.collaboratorIds)?.some(
      (id) => getIdString(id) === userId,
    );

    const hasPermission = isAssignee || isCreator || isCollaborator || isAdmin;

    console.log("🔐 UNMARK AS RISK - PERMISSION CHECK:", {
      userId,
      taskAssignedToId,
      taskCreatedById,
      isAdmin,
      isAssignee,
      isCreator,
      isCollaborator,
      hasPermission,
    });

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to unmark this task as risk.",
      });
    }

    const { mitigationReason } = req.body;

    // ✅ Remove risk data and add mitigation info
    const updatedTask = await storage.updateTask(taskId, {
      isRisk: false,
      riskLevel: null,
      riskReason: null,
      riskMarkedBy: null,
      riskMarkedAt: null,
      mitigationReason: mitigationReason || null,
      mitigatedBy: user.id,
      mitigatedAt: new Date(),
      updatedBy: user.id,
      updatedAt: new Date(),
    });

    // ✅ If it's a subtask, check if parent still has other risky subtasks
    if (task.parentTaskId) {
      const parentTask = await storage.getTaskById(task.parentTaskId);
      if (parentTask && parentTask.subtasks) {
        const hasOtherRiskySubtasks = parentTask.subtasks.some(
          (st) => st._id.toString() !== taskId && st.isRisk,
        );

        if (!hasOtherRiskySubtasks) {
          await storage.updateTask(task.parentTaskId, {
            hasRisk: false,
            updatedBy: user.id,
            updatedAt: new Date(),
          });
        }
      }
    }

    // Log activity
    try {
      await storage.trackActivity({
        activityType: ActivityHelper.ACTIVITY_TYPES.TASK_RISK_MITIGATED,
        userId: user.id,
        organizationId: getTaskOrganizationId(task.organization),
        relatedId: taskId,
        relatedType: "task",
        data: {
          taskTitle: task.title,
          mitigationReason: mitigationReason || null,
        },
      });
    } catch (activityError) {
      console.error("❌ Activity logging failed:", activityError);
    }

    res.json({
      success: true,
      message: "Task risk status removed successfully.",
      data: updatedTask,
    });
  } catch (error) {
    console.error("Error unmarking task as risk:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unmark task as risk",
      error: error.message,
    });
  }
};

// Quick Mark Task as Done API
export const quickMarkAsDone = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { completionNotes, forceComplete } = req.body;
    const user = req.user;

    const task = await storage.getTaskById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // ❌ VALIDATION: Task is already DONE - cannot mark done again
    if (task.status === "DONE") {
      console.log("❌ Task is already completed, cannot mark as done again");
      return res.status(400).json({
        success: false,
        message: "Task is already completed. No further changes allowed.",
      });
    }

    // Check permissions - allow assignee, creator, collaborator, or admin
    const userRoles = Array.isArray(user.role) ? user.role : [user.role];
    const isAdmin = userRoles.some((role) =>
      ["org_admin", "super_admin", "manager"].includes(role),
    );

    // Handle both ObjectId and populated object formats
    const getIdString = (field) => {
      if (!field) return null;
      if (typeof field === "string") return field;
      if (field._id) return field._id.toString();
      if (field.id) return field.id.toString();
      return field.toString();
    };

    const taskAssignedToId = getIdString(task.assignedTo);
    const taskCreatedById = getIdString(task.createdBy);
    const userId = user.id.toString();

    const isAssignee = taskAssignedToId === userId;
    const isCreator = taskCreatedById === userId;
    const isCollaborator = task.collaboratorIds?.some(
      (id) => getIdString(id) === userId,
    );

    // Debug permission check
    console.log("🔐 QUICK DONE - PERMISSION CHECK:", {
      userId,
      taskAssignedToId,
      taskCreatedById,
      taskCollaboratorIds: task.collaboratorIds?.map((id) => getIdString(id)),
      isAssignee,
      isCreator,
      isCollaborator,
      isAdmin,
      userRoles,
    });

    // Allow if user is assignee, creator, collaborator, or admin
    const hasPermission = isAssignee || isCreator || isCollaborator || isAdmin;

    console.log("🔐 QUICK DONE - HAS PERMISSION:", hasPermission);

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to complete this task",
      });
    }

    // Check if user is admin for force complete
    const adminRoles = [
      "org_admin",
      "company-admin",
      "admin",
      "super-admin",
      "tasksetu-admin",
    ];
    const isAdminForForceComplete =
      adminRoles.includes(user.role) ||
      (Array.isArray(user.role) &&
        user.role.some((r) => adminRoles.includes(r)));

    // Check if task can be marked as done (no incomplete subtasks)
    const subtasks = await storage.getTasksByFilter({ parentTask: taskId });
    const incompleteSubtasks = subtasks.filter(
      (subtask) => subtask.status !== "DONE" && subtask.status !== "cancelled",
    );

    if (incompleteSubtasks.length > 0) {
      // Allow admin to force complete even with incomplete subtasks
      if (!forceComplete || !isAdminForForceComplete) {
        return res.status(400).json({
          success: false,
          message: `Cannot complete task. ${incompleteSubtasks.length} subtask(s) are still incomplete.`,
        });
      }

      // Log admin force complete action
      console.log(
        `[ADMIN FORCE COMPLETE] ${user.email} (${user.role}) force-completed task ${taskId} with ${incompleteSubtasks.length} incomplete subtask(s)`,
      );
    }

    // ✅ MILESTONE LINKED TASKS VALIDATION
    // A milestone cannot be marked as "Done" until all linked tasks are completed
    if (task.taskType === "milestone" || task.mainTaskType === "milestone") {
      const linkedTaskIds =
        task.linkedTasks || task.milestoneData?.linkedTaskIds || [];
      if (linkedTaskIds.length > 0) {
        const Task = (await import("../modals/taskModal.js")).default;
        const linkedTasks = await Task.find({
          _id: { $in: linkedTaskIds },
          isDeleted: { $ne: true },
        })
          .select("_id title status")
          .lean();

        const incompleteLinked = linkedTasks.filter((lt) => {
          const ltStatus = String(lt.status || "OPEN").toUpperCase();
          return !["DONE", "COMPLETED", "CANCELLED"].includes(ltStatus);
        });

        if (incompleteLinked.length > 0) {
          console.log(
            "❌ Cannot complete milestone - incomplete linked tasks:",
            incompleteLinked.length,
          );
          return res.status(400).json({
            success: false,
            message: `Cannot mark milestone as Done. ${incompleteLinked.length} linked task(s) are still pending.`,
            error: "MILESTONE_LINKED_TASKS_INCOMPLETE",
            incompleteLinkedTasks: incompleteLinked.map((t) => ({
              id: t._id,
              title: t.title,
              status: t.status,
            })),
          });
        }
      }
    }

    // Update task to completed status
    const updatedTask = await storage.updateTask(taskId, {
      status: "DONE",
      progress: 100,
      completedDate: new Date(),
      completedBy: user.id,
      completionNotes:
        completionNotes ||
        (forceComplete
          ? `Task force-completed by admin with ${incompleteSubtasks.length} incomplete subtask(s)`
          : null),
      updatedBy: user.id,
      updatedAt: new Date(),
    });

    // Recalculate counters for current assignee
    await recalcUserTaskCounters(updatedTask?.assignedTo);

    res.json({
      success: true,
      message: forceComplete
        ? `Task force-completed successfully (${incompleteSubtasks.length} subtask(s) still pending)`
        : "Task marked as completed successfully",
      data: updatedTask,
    });
  } catch (error) {
    console.error("Error marking task as done:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark task as done",
      error: error.message,
    });
  }
};

// Activity Feed Endpoints
export const getTaskActivities = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { limit = 20 } = req.query;
    const user = req.user;

    // Check if user has access to this task
    const task = await storage.getTaskById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Check permissions (similar to getTaskById)
    if (task.organization && user.organizationId) {
      const taskOrgId = getTaskOrganizationId(task.organization);
      const userOrgId = user.organizationId?.toString() || user.organizationId;

      if (taskOrgId !== userOrgId) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }
    }

    const activities = await storage.getActivitiesForTask(
      taskId,
      parseInt(limit),
    );

    res.json({
      success: true,
      data: {
        activities,
        taskTitle: task.title,
        taskId: taskId,
      },
    });
  } catch (error) {
    console.error("Error fetching task activities:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch task activities",
      error: error.message,
    });
  }
};

export const getOrganizationActivities = async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const user = req.user;

    if (!user.organizationId) {
      return res.status(403).json({
        success: false,
        message: "Organization access required",
      });
    }

    const activities = await storage.getActivitiesForOrganization(
      user.organizationId,
      parseInt(limit),
    );

    res.json({
      success: true,
      data: {
        activities,
        organizationId: user.organizationId,
      },
    });
  } catch (error) {
    console.error("Error fetching organization activities:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch organization activities",
      error: error.message,
    });
  }
};

export const getRecentActivities = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const activities = await storage.getRecentActivities(parseInt(limit));

    res.json({
      success: true,
      data: {
        activities,
      },
    });
  } catch (error) {
    console.error("Error fetching recent activities:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch recent activities",
      error: error.message,
    });
  }
};

// Get All Attachments of a Task
export const getTaskAttachments = async (req, res) => {
  try {
    const { taskId } = req.params;
    const user = req.user;

    console.log("📎 [GET TASK ATTACHMENTS] Task ID:", taskId);
    console.log("👤 [GET TASK ATTACHMENTS] User:", user.email);

    // Find the task
    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    console.log("✅ [GET TASK ATTACHMENTS] Task found:", task.title);

    // Check permission - user should have access to the task
    const hasPermission = checkCommentPermission(user, task);

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view attachments of this task",
      });
    }

    // Filter out deleted attachments and ensure URLs are correct
    const activeAttachments = task.attachments
      ? task.attachments
          .filter((att) => !att.deleted)
          .map((att) => {
            // Convert Mongoose subdocument to plain object
            const plainAtt = att.toObject
              ? att.toObject()
              : { ...(att._doc || att) };
            // ✅ Ensure URL has the correct path - fix incorrect URLs that don't include task-attachments
            let url = plainAtt.url;
            if (url && !url.includes("/task-attachments/")) {
              // If URL is just `/uploads/filename`, add task-attachments
              if (
                url.startsWith("/uploads/") &&
                !url.startsWith("/uploads/task-attachments/")
              ) {
                url = `/uploads/task-attachments/${plainAtt.filename || url.split("/").pop()}`;
                console.log(
                  "🔧 [GET TASK ATTACHMENTS] Reconstructed URL:",
                  url,
                );
              }
            }
            return {
              _id: plainAtt._id,
              originalName: plainAtt.originalName,
              filename: plainAtt.filename,
              size: plainAtt.size,
              mimetype: plainAtt.mimetype,
              url: url,
              uploadedBy: plainAtt.uploadedBy,
              uploadedAt: plainAtt.uploadedAt,
              version: plainAtt.version,
            };
          })
      : [];

    console.log(
      "📎 [GET TASK ATTACHMENTS] Total attachments:",
      activeAttachments.length,
    );

    return res.status(200).json({
      success: true,
      message: "Task attachments retrieved successfully",
      data: {
        taskId: task._id,
        taskTitle: task.title,
        attachments: activeAttachments,
        totalCount: activeAttachments.length,
      },
    });
  } catch (error) {
    console.error("❌ [GET TASK ATTACHMENTS] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch task attachments",
      error: error.message,
    });
  }
};

// Add Attachments to a Task
export const addTaskAttachments = async (req, res) => {
  try {
    const { taskId } = req.params;
    const user = req.user;
    const files = req.files; // multer will provide uploaded files

    console.log("📎 [ADD TASK ATTACHMENTS] Task ID:", taskId);
    console.log("👤 [ADD TASK ATTACHMENTS] User:", user.email);
    console.log(
      "📁 [ADD TASK ATTACHMENTS] Files count:",
      files ? files.length : 0,
    );

    // Validate files
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files provided. Please upload at least one attachment.",
      });
    }

    // Find the task
    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    console.log("✅ [ADD TASK ATTACHMENTS] Task found:", task.title);

    // Check permission - user should have access to the task
    const hasPermission = checkCommentPermission(user, task);

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to add attachments to this task",
      });
    }

    // Prepare new attachments
    const newAttachments = files.map((file) => ({
      originalName: file.originalname,
      filename: file.filename,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype,
      url: `/uploads/task-attachments/${file.filename}`,
      uploadedBy: user.id,
      uploadedAt: new Date(),
      version: 1,
      deleted: false,
    }));

    // Add attachments to task
    if (!task.attachments) {
      task.attachments = [];
    }
    task.attachments.push(...newAttachments);

    // Save the task
    await task.save();

    console.log("✅ [ADD TASK ATTACHMENTS] Attachments added successfully");
    console.log(
      "📊 [ADD TASK ATTACHMENTS] New attachments count:",
      newAttachments.length,
    );

    // 🎯 Track Activity - File Attached
    try {
      for (const attachment of newAttachments) {
        await storage.trackActivity({
          activityType: ActivityHelper.ACTIVITY_TYPES.FILE_ATTACHED,
          userId: user.id,
          organizationId: task.organization,
          relatedId: taskId,
          relatedType: "task",
          data: {
            fileName: attachment.originalName,
            fileSize: `${(attachment.size / 1024).toFixed(2)}KB`,
            fileId: attachment._id,
            taskTitle: task.title,
          },
        });
      }
    } catch (activityError) {
      console.error("Failed to track file attachment activity:", activityError);
    }

    // 🔔 Send notification for file upload
    try {
      // Notify task assignee if different from uploader
      if (
        task.assignedTo &&
        task.assignedTo.toString() !== user.id.toString()
      ) {
        await createTaskNotification(TriggerEvent.FILE_UPLOADED, task, {
          targetUserId: task.assignedTo,
          title: "New File Uploaded",
          message: `${newAttachments.length} file(s) uploaded to task: "${task.title}"`,
          priority: NotificationPriority.NORMAL,
          metadata: {
            filesCount: newAttachments.length,
            fileNames: newAttachments.map((a) => a.originalName).join(", "),
          },
        });
      }

      // Notify task creator if different from uploader and assignee
      if (
        task.createdBy &&
        task.createdBy.toString() !== user.id.toString() &&
        task.createdBy.toString() !== task.assignedTo?.toString()
      ) {
        await createTaskNotification(TriggerEvent.FILE_UPLOADED, task, {
          targetUserId: task.createdBy,
          title: "New File Uploaded",
          message: `${newAttachments.length} file(s) uploaded to task: "${task.title}"`,
          priority: NotificationPriority.NORMAL,
          metadata: {
            filesCount: newAttachments.length,
            fileNames: newAttachments.map((a) => a.originalName).join(", "),
          },
        });
      }

      // Notify collaborators if different from uploader, assignee, and creator
      if (task.collaborators && Array.isArray(task.collaborators)) {
        for (const collab of task.collaborators) {
          const collabId = collab?._id?.toString() || collab?.toString();
          if (
            collabId &&
            collabId !== user.id.toString() &&
            collabId !== task.assignedTo?.toString() &&
            collabId !== task.createdBy?.toString()
          ) {
            await createTaskNotification(TriggerEvent.FILE_UPLOADED, task, {
              targetUserId: collabId,
              title: "New File Uploaded",
              message: `${newAttachments.length} file(s) uploaded to task: "${task.title}"`,
              priority: NotificationPriority.NORMAL,
              metadata: {
                filesCount: newAttachments.length,
                fileNames: newAttachments.map((a) => a.originalName).join(", "),
              },
            });
          }
        }
      }
      console.log(`🔔 File upload notifications sent for task: ${task.title}`);
    } catch (notificationError) {
      console.error(
        "Failed to send file upload notification:",
        notificationError.message,
      );
      // Don't fail the upload if notification fails
    }

    return res.status(200).json({
      success: true,
      message: `${newAttachments.length} attachment(s) added successfully`,
      data: {
        taskId: task._id,
        taskTitle: task.title,
        addedAttachments: newAttachments,
        totalAttachments: task.attachments.filter((att) => !att.deleted).length,
      },
    });
  } catch (error) {
    console.error("❌ [ADD TASK ATTACHMENTS] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add task attachments",
      error: error.message,
    });
  }
};

// Delete Attachment from a Task
export const deleteTaskAttachment = async (req, res) => {
  try {
    const { taskId, attachmentId } = req.params;
    const user = req.user;

    console.log("🗑️ [DELETE ATTACHMENT] Task ID:", taskId);
    console.log("🗑️ [DELETE ATTACHMENT] Attachment ID:", attachmentId);
    console.log("👤 [DELETE ATTACHMENT] User:", user.email);

    // Find the task
    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Check permission
    const hasPermission = checkCommentPermission(user, task);

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to delete attachments from this task",
      });
    }

    // Find the attachment
    const attachmentIndex = task.attachments.findIndex(
      (att) => att._id.toString() === attachmentId && !att.deleted,
    );

    if (attachmentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Attachment not found or already deleted",
      });
    }

    const attachment = task.attachments[attachmentIndex];

    // Soft delete the attachment
    task.attachments[attachmentIndex].deleted = true;
    task.attachments[attachmentIndex].deletedAt = new Date();
    task.attachments[attachmentIndex].deletedBy = user.id;

    // Save the task
    await task.save();

    console.log("✅ [DELETE ATTACHMENT] Attachment deleted successfully");

    // 🎯 Track Activity - File Deleted
    try {
      await storage.trackActivity({
        activityType: ActivityHelper.ACTIVITY_TYPES.FILE_REMOVED,
        userId: user.id,
        organizationId: task.organization,
        relatedId: taskId,
        relatedType: "task",
        data: {
          fileName: attachment.originalName,
          fileId: attachmentId,
          taskTitle: task.title,
        },
      });
    } catch (activityError) {
      console.error("Failed to track file deletion activity:", activityError);
    }

    return res.status(200).json({
      success: true,
      message: "Attachment deleted successfully",
      data: {
        taskId: task._id,
        attachmentId: attachmentId,
        totalAttachments: task.attachments.filter((att) => !att.deleted).length,
      },
    });
  } catch (error) {
    console.error("❌ [DELETE ATTACHMENT] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete attachment",
      error: error.message,
    });
  }
};

// Debug endpoint to check recent activities
export const debugActivities = async (req, res) => {
  try {
    const { taskId } = req.params;
    const user = req.user;

    console.log("🔍 [DEBUG ACTIVITIES] Fetching activities for task:", taskId);

    // Get task to verify it exists
    const task = await storage.getTaskById(taskId, user.organizationId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Get all activities for this task
    const activities = await storage.getActivitiesForTask(
      taskId,
      user.organizationId,
    );

    console.log("✅ [DEBUG ACTIVITIES] Found activities:", activities.length);
    console.log(
      "📋 [DEBUG ACTIVITIES] Activities:",
      JSON.stringify(activities, null, 2),
    );

    res.json({
      success: true,
      taskId,
      taskTitle: task.title,
      activityCount: activities.length,
      activities: activities,
    });
  } catch (error) {
    console.error("❌ [DEBUG ACTIVITIES] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch debug activities",
      error: error.message,
    });
  }
};

// ============================================
// 🎯 MILESTONE → LINKED TASK LOGIC IMPLEMENTATION
// ============================================
// As per Document Section 4.4: Milestone Task Workflow

/**
 * Helper function to calculate milestone progress based on linked tasks
 * Progress = (Completed Linked Tasks ÷ Total Linked Tasks) × 100
 */
async function calculateMilestoneProgress(milestone) {
  try {
    const linkedTasks = milestone.linkedTasks || [];

    if (linkedTasks.length === 0) {
      milestone.progress = 0;
      return;
    }

    // Fetch all linked tasks to check their status
    const tasks = await Task.find({ _id: { $in: linkedTasks } }).select(
      "status",
    );

    const completedCount = tasks.filter((t) => t.status === "DONE").length;
    const totalCount = tasks.length;

    // Calculate progress percentage
    milestone.progress = Math.round((completedCount / totalCount) * 100);

    // 🚀 Auto-update milestone status based on progress
    if (milestone.progress === 100 && milestone.status !== "DONE") {
      const previousStatus = milestone.status;
      milestone.status = "DONE";
      milestone.completedDate = new Date();
      console.log(
        `✅ [AUTO-UPDATE] Milestone "${milestone.title}" auto-marked as DONE (all linked tasks completed)`,
      );

      // 🔔 Send notification for milestone achieved
      try {
        if (milestone.assignedTo) {
          await createTaskNotification(
            TriggerEvent.MILESTONE_ACHIEVED,
            milestone,
            {
              targetUserId: milestone.assignedTo,
              title: "Milestone Achieved! 🎉",
              message: `Milestone "${milestone.title}" has been completed! All linked tasks are done.`,
              priority: NotificationPriority.NORMAL,
              metadata: {
                previousStatus: previousStatus,
                progress: 100,
                completedDate: milestone.completedDate,
              },
            },
          );
        }

        // Notify creator if different from assignee
        if (
          milestone.createdBy &&
          milestone.createdBy.toString() !== milestone.assignedTo?.toString()
        ) {
          await createTaskNotification(
            TriggerEvent.MILESTONE_ACHIEVED,
            milestone,
            {
              targetUserId: milestone.createdBy,
              title: "Milestone Achieved! 🎉",
              message: `Milestone "${milestone.title}" has been completed! All linked tasks are done.`,
              priority: NotificationPriority.NORMAL,
              metadata: {
                previousStatus: previousStatus,
                progress: 100,
                completedDate: milestone.completedDate,
              },
            },
          );
        }
        console.log(
          `🔔 Notification sent for milestone achieved: ${milestone.title}`,
        );
      } catch (notificationError) {
        console.error(
          `⚠️ Failed to send milestone achieved notification:`,
          notificationError.message,
        );
      }
    } else if (
      milestone.progress > 0 &&
      milestone.progress < 100 &&
      milestone.status === "OPEN"
    ) {
      milestone.status = "INPROGRESS";
      console.log(
        `⏳ [AUTO-UPDATE] Milestone "${milestone.title}" auto-marked as INPROGRESS`,
      );
    } else if (milestone.progress === 0 && milestone.status !== "OPEN") {
      // If all tasks are reopened, revert milestone to OPEN
      if (linkedTasks.length > 0) {
        milestone.status = "OPEN";
        milestone.completedDate = null;
        console.log(
          `🔄 [AUTO-UPDATE] Milestone "${milestone.title}" reverted to OPEN (tasks reopened)`,
        );
      }
    }

    console.log(
      `📊 [PROGRESS] Milestone: ${milestone.title} | Progress: ${milestone.progress}% (${completedCount}/${totalCount})`,
    );
  } catch (error) {
    console.error("❌ [CALCULATE PROGRESS] Error:", error);
    milestone.progress = 0;
  }
}

/**
 * Update milestone progress when a linked task status changes
 * Called from updateTaskStatus controller
 */
export async function updateMilestoneProgressOnTaskChange(taskId) {
  try {
    // Find task to get its linked milestone
    const task = await Task.findById(taskId).select("linkedToMilestone status");

    if (!task || !task.linkedToMilestone) {
      return; // Task not linked to any milestone
    }

    // Fetch the milestone
    const milestone = await Task.findById(task.linkedToMilestone);

    if (!milestone) {
      console.warn(
        `⚠️ [MILESTONE UPDATE] Milestone ${task.linkedToMilestone} not found`,
      );
      return;
    }

    // Recalculate progress
    await calculateMilestoneProgress(milestone);
    await milestone.save();

    console.log(
      `✅ [MILESTONE UPDATE] Updated progress for milestone "${milestone.title}" after task "${task._id}" status change`,
    );

    // Log activity
    try {
      await ActivityHelper.logActivity({
        type: "milestone_progress_updated",
        description: `Milestone progress updated to ${milestone.progress}% after linked task status change`,
        task: milestone._id,
        relatedId: taskId,
        relatedType: "task",
        metadata: {
          icon: "📊",
          category: "milestone",
          progress: milestone.progress,
          milestoneStatus: milestone.status,
          linkedTaskId: taskId,
        },
      });
    } catch (activityError) {
      console.error("❌ Activity logging failed:", activityError);
    }
  } catch (error) {
    console.error("❌ [MILESTONE UPDATE] Error:", error);
  }
}

/**
 * Get Overdue Tasks
 * Returns tasks that have passed their due date and are not completed
 */
export const getOverdueTasks = async (req, res) => {
  try {
    console.log("=== Get Overdue Tasks ===");
    console.log("req.user:", req.user);

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const userId = req.user.id || req.user._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User ID not found in request",
      });
    }
    const { search, priority, category } = req.query;

    console.log("User ID:", userId);
    console.log("User object:", JSON.stringify(req.user, null, 2));
    console.log("Filters:", { search, priority, category });

    // Build query filter
    const now = new Date();
    const queryFilter = {
      assignedTo: userId,
      dueDate: { $lt: now, $ne: null },
      status: { $nin: ["DONE", "CANCELLED"] },
      $or: [{ isDeleted: { $exists: false } }, { isDeleted: false }],
    };

    // Apply additional filters
    if (priority && priority !== "all") {
      queryFilter.priority = priority;
    }

    if (category && category !== "all") {
      queryFilter.category = category;
    }

    // Build search filter
    if (search) {
      queryFilter.$and = [
        {
          $or: [
            { title: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
          ],
        },
      ];
    }

    console.log("Query Filter:", JSON.stringify(queryFilter));

    // Fetch overdue tasks
    const tasks = await Task.find(queryFilter)
      .select(
        "title description category priority status dueDate createdAt assignedTo tags",
      )
      .populate("assignedTo", "firstName lastName email")
      .sort({ dueDate: 1 }) // Oldest overdue first
      .lean();

    console.log(`Found ${tasks.length} overdue tasks`);

    // Calculate days overdue for each task
    const tasksWithOverdueDays = tasks.map((task) => ({
      ...task,
      daysOverdue: Math.floor(
        (now - new Date(task.dueDate)) / (1000 * 60 * 60 * 24),
      ),
    }));

    res.json({
      success: true,
      data: {
        tasks: tasksWithOverdueDays,
        total: tasksWithOverdueDays.length,
      },
    });
  } catch (error) {
    console.error("Error fetching overdue tasks:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch overdue tasks",
      error: error.message,
    });
  }
};

/**
 * Get Overdue Task Statistics
 * Returns summary statistics for overdue tasks
 */
export const getOverdueTaskStats = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    const now = new Date();
    const overdueQuery = {
      assignedTo: userId,
      dueDate: { $lt: now, $ne: null },
      status: { $nin: ["DONE", "CANCELLED"] },
      $or: [{ isDeleted: { $exists: false } }, { isDeleted: false }],
    };

    // Get total overdue count
    const totalOverdue = await Task.countDocuments(overdueQuery);

    // Get by priority
    const byPriority = await Task.aggregate([
      { $match: overdueQuery },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]);

    // Get by category
    const byCategory = await Task.aggregate([
      { $match: overdueQuery },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]);

    res.json({
      success: true,
      data: {
        totalOverdue,
        byPriority: byPriority.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        byCategory: byCategory.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    console.error("Error fetching overdue task stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch overdue task statistics",
      error: error.message,
    });
  }
};

// ============================================
// 🎯 MILESTONE → LINKED TASK LOGIC IMPLEMENTATION
// ============================================
// As per Document Section 4.4: Milestone Task Workflow

/**
 * @route GET /api/tasks/available-for-linking
 * @desc Get all regular tasks available for milestone linking
 * @access Private
 * @queryParam {string} excludeTaskIds - Comma-separated task IDs to exclude
 * @queryParam {string} milestoneRole - Role of the user creating the milestone (to filter tasks by createdByRole)
 */
export const getAvailableTasksForLinking = async (req, res) => {
  try {
    console.log(
      "\n🔗 [AVAILABLE TASKS] Fetching tasks & subtasks for milestone linking",
    );

    const user = req.user;
    const { excludeTaskIds, milestoneRole, includeSubtasks = true } = req.query;

    console.log("🔗 [AVAILABLE TASKS] Request params:", {
      userId: user.id,
      userRoles: user.role,
      milestoneRole: milestoneRole,
      excludeTaskIds: excludeTaskIds,
      includeSubtasks: includeSubtasks,
    });

    // Parse excluded task IDs (tasks already linked to this milestone)
    const excludeIds = excludeTaskIds
      ? excludeTaskIds.split(",").map((id) => id.trim())
      : [];

    // Build query to get linkable PARENT tasks
    const parentTaskQuery = {
      // ✅ Only regular and recurring tasks can be linked (per document)
      taskType: { $in: ["regular", "recurring"] },

      // ❌ Exclude deleted/inactive tasks
      isDeleted: { $ne: true },

      // ❌ Exclude subtasks - we want parent tasks only in this query
      isSubtask: false,

      // ❌ Exclude tasks already linked to ANY milestone
      // This ensures a task can only be linked to one milestone at a time
      $or: [
        { linkedToMilestone: { $exists: false } },
        { linkedToMilestone: null },
      ],

      // ❌ Exclude milestone and approval tasks
      mainTaskType: { $nin: ["milestone", "approval"] },
    };

    // 🔒 INDIVIDUAL USER RESTRICTION: Only fetch own tasks
    if (!user.organizationId) {
      // Individual user - can only see their own tasks
      parentTaskQuery.createdBy = user.id;
      console.log(
        "🔒 [AVAILABLE TASKS] Individual user restriction applied - filtering by createdBy",
      );
    } else {
      // Organization user - can see all org tasks
      parentTaskQuery.organization = user.organizationId;
      console.log(
        "🔒 [AVAILABLE TASKS] Organization user - showing all org tasks",
      );
    }

    // 🎯 Filter by createdByRole if milestoneRole is provided
    if (milestoneRole) {
      parentTaskQuery.createdByRole = milestoneRole;
      console.log(
        `🎯 [AVAILABLE TASKS] Filtering tasks by createdByRole: ${milestoneRole}`,
      );
    } else {
      console.log(
        "⚠️ [AVAILABLE TASKS] No milestoneRole provided, showing all tasks in organization",
      );
    }

    // Exclude already linked tasks
    if (excludeIds.length > 0) {
      parentTaskQuery._id = { $nin: excludeIds };
    }

    console.log(
      "🔍 [AVAILABLE TASKS - PARENT] Query filter:",
      JSON.stringify(parentTaskQuery, null, 2),
    );

    // ═════════════════════════════════════════════════════════════════
    // STEP 1: Fetch parent tasks
    // ═════════════════════════════════════════════════════════════════
    const parentTasks = await Task.find(parentTaskQuery)
      .select(
        "_id title description status priority dueDate assignedTo createdBy createdByRole taskType mainTaskType createdAt",
      )
      .populate("assignedTo", "firstName lastName email")
      .populate("createdBy", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(100) // Limit for performance
      .lean();

    console.log(
      `✅ [AVAILABLE TASKS] Found ${parentTasks.length} linkable parent tasks`,
    );

    // ═════════════════════════════════════════════════════════════════
    // STEP 2: Fetch subtasks for each parent task (if includeSubtasks = true)
    // ═════════════════════════════════════════════════════════════════
    let allSubtasks = [];
    let subtasksByParentId = {};

    if (includeSubtasks === "true" || includeSubtasks === true) {
      console.log("🔗 [AVAILABLE TASKS] Including subtasks in results");

      // Fetch all subtasks that belong to the parent tasks we found
      const parentTaskIds = parentTasks.map((t) => t._id.toString());

      const subtaskQuery = {
        parentTaskId: { $in: parentTaskIds },
        isSubtask: true,
        isDeleted: { $ne: true },
        // Subtasks should also not be linked to any milestone
        $or: [
          { linkedToMilestone: { $exists: false } },
          { linkedToMilestone: null },
        ],
      };

      // 🔒 INDIVIDUAL USER RESTRICTION: Only fetch own subtasks
      if (!user.organizationId) {
        // Individual user - can only see subtasks of their own tasks
        subtaskQuery.createdBy = user.id;
        console.log(
          "🔒 [AVAILABLE TASKS - SUBTASKS] Individual user restriction applied - filtering by createdBy",
        );
      }

      // Apply same createdByRole filter if provided
      if (milestoneRole) {
        subtaskQuery.createdByRole = milestoneRole;
      }

      console.log(
        "🔍 [AVAILABLE TASKS - SUBTASKS] Query filter:",
        JSON.stringify(subtaskQuery, null, 2),
      );

      allSubtasks = await Task.find(subtaskQuery)
        .select(
          "_id parentTaskId title description status priority dueDate assignedTo createdBy createdByRole taskType mainTaskType createdAt",
        )
        .populate("assignedTo", "firstName lastName email")
        .populate("createdBy", "firstName lastName email")
        .lean();

      console.log(
        `✅ [AVAILABLE TASKS] Found ${allSubtasks.length} linkable subtasks`,
      );

      // Group subtasks by parentTaskId for easy lookup
      allSubtasks.forEach((subtask) => {
        const parentId = subtask.parentTaskId.toString();
        if (!subtasksByParentId[parentId]) {
          subtasksByParentId[parentId] = [];
        }
        subtasksByParentId[parentId].push(subtask);
      });
    }

    // ═════════════════════════════════════════════════════════════════
    // STEP 3: Format response with parent tasks and their subtasks
    // ═════════════════════════════════════════════════════════════════
    const formattedTasks = parentTasks.map((task) => {
      const parentId = task._id.toString();
      const subtasks = subtasksByParentId[parentId] || [];

      return {
        _id: task._id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        createdAt: task.createdAt,
        createdByRole: task.createdByRole,
        assignedTo: task.assignedTo
          ? {
              _id: task.assignedTo._id,
              name: `${task.assignedTo.firstName} ${task.assignedTo.lastName}`.trim(),
              email: task.assignedTo.email,
            }
          : null,
        createdBy: task.createdBy
          ? {
              _id: task.createdBy._id,
              name: `${task.createdBy.firstName} ${task.createdBy.lastName}`.trim(),
            }
          : null,
        taskType: task.taskType || "regular",
        // NEW: Include subtasks as children
        subtasks: subtasks.map((subtask) => ({
          _id: subtask._id,
          title: subtask.title,
          description: subtask.description,
          status: subtask.status,
          priority: subtask.priority,
          dueDate: subtask.dueDate,
          createdAt: subtask.createdAt,
          parentTaskId: subtask.parentTaskId,
          createdByRole: subtask.createdByRole,
          assignedTo: subtask.assignedTo
            ? {
                _id: subtask.assignedTo._id,
                name: `${subtask.assignedTo.firstName} ${subtask.assignedTo.lastName}`.trim(),
                email: subtask.assignedTo.email,
              }
            : null,
          createdBy: subtask.createdBy
            ? {
                _id: subtask.createdBy._id,
                name: `${subtask.createdBy.firstName} ${subtask.createdBy.lastName}`.trim(),
              }
            : null,
          taskType: "subtask",
        })),
        hasSubtasks: subtasks.length > 0,
        subtaskCount: subtasks.length,
      };
    });

    res.status(200).json({
      success: true,
      message: `Found ${formattedTasks.length} parent tasks and ${allSubtasks.length} subtasks available for linking`,
      data: {
        tasks: formattedTasks,
        subtasksByParentId: subtasksByParentId,
        totalParentTasks: formattedTasks.length,
        totalSubtasks: allSubtasks.length,
        totalCount: formattedTasks.length + allSubtasks.length,
        filteredByRole: milestoneRole || null,
        includeSubtasks: includeSubtasks === "true" || includeSubtasks === true,
      },
    });
  } catch (error) {
    console.error("❌ [AVAILABLE TASKS] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch available tasks",
      error: error.message,
    });
  }
};

/**
 * @route POST /api/milestones/:id/link-task
 * @desc Link a task to a milestone (bidirectional mapping)
 * @access Private
 */
export const linkTaskToMilestone = async (req, res) => {
  try {
    console.log("\n🔗 [LINK TASK] Starting task linking process");

    const milestoneId = req.params.id;
    const { taskId, taskIds } = req.body;
    const user = req.user;

    // Normalize input to array
    let tasksToProcess = [];
    if (taskIds && Array.isArray(taskIds)) {
      tasksToProcess = taskIds;
    } else if (taskId) {
      tasksToProcess = [taskId];
    }

    // Validate input
    if (tasksToProcess.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Task ID(s) are required",
      });
    }

    // Fetch milestone
    const milestone = await Task.findById(milestoneId);
    if (!milestone) {
      return res.status(404).json({
        success: false,
        message: "Milestone not found",
      });
    }

    // Validate milestone type
    if (
      milestone.taskType !== "milestone" &&
      milestone.mainTaskType !== "milestone"
    ) {
      return res.status(400).json({
        success: false,
        message: "Task is not a milestone",
      });
    }

    // ✅ ACCESS CONTROL: Only individual users or milestone creator can link tasks
    const userRole = Array.isArray(user.role) ? user.role[0] : user.role;
    const isIndividual = userRole === "individual";
    const isCreator = milestone.createdBy?.toString() === user.id?.toString();

    if (!isIndividual && !isCreator) {
      console.log(
        "❌ [LINK TASK] Permission denied - User is not individual or creator",
      );
      return res.status(403).json({
        success: false,
        message:
          "Only individual users or milestone creators can link tasks to milestones",
      });
    }

    const results = {
      success: [],
      failed: [],
    };

    // Process each task
    for (const currentTaskId of tasksToProcess) {
      try {
        // Fetch task to link
        const taskToLink = await Task.findById(currentTaskId);
        if (!taskToLink) {
          results.failed.push({ id: currentTaskId, reason: "Task not found" });
          continue;
        }

        // ❌ Validation: Cannot link milestone to milestone (prevent recursive linking)
        if (
          taskToLink.taskType === "milestone" ||
          taskToLink.mainTaskType === "milestone"
        ) {
          results.failed.push({
            id: currentTaskId,
            reason: "Cannot link a milestone to another milestone",
          });
          continue;
        }

        // ❌ Validation: Only regular or recurring tasks can be linked
        if (
          !["regular", "recurring", "subtask"].includes(taskToLink.taskType) &&
          !["regular", "recurring", "subtask"].includes(taskToLink.mainTaskType)
        ) {
          // Relaxed check to include subtasks if needed, or based on business logic.
          // Original logic: if (!['regular', 'recurring'].includes(taskToLink.taskType))
          // Keeping original strict check but safer
          if (!["regular", "recurring"].includes(taskToLink.taskType)) {
            results.failed.push({
              id: currentTaskId,
              reason: "Only regular or recurring tasks can be linked",
            });
            continue;
          }
        }

        // Check if task is already linked
        // Ensure linkedTasks is initialized
        if (!milestone.linkedTasks) milestone.linkedTasks = [];

        // Check if already linked to THIS milestone
        if (
          milestone.linkedTasks.some((id) => id.toString() === currentTaskId)
        ) {
          results.failed.push({
            id: currentTaskId,
            reason: "Task already linked to this milestone",
          });
          continue;
        }

        // 🔄 Bidirectional Mapping: Update both milestone and task
        // 1. Add task to milestone's linkedTasks array
        milestone.linkedTasks.push(currentTaskId);

        // 2. Set milestone reference in task
        taskToLink.linkedToMilestone = milestoneId;

        // 🔧 Normalize priority to lowercase to avoid validation errors
        if (taskToLink.priority) {
          taskToLink.priority = taskToLink.priority.toLowerCase();
        }

        // Save task
        await taskToLink.save();

        results.success.push({ id: currentTaskId, title: taskToLink.title });

        // 📊 Activity Feed: Log the linking action
        try {
          await ActivityHelper.logActivity({
            type: "milestone_task_linked",
            description: `Linked task "${taskToLink.title}" to milestone "${milestone.title}"`,
            user: user.id,
            task: milestoneId,
            relatedId: currentTaskId,
            relatedType: "task",
            metadata: {
              icon: "🔗",
              category: "milestone",
              linkedTaskId: currentTaskId,
              linkedTaskTitle: taskToLink.title,
              milestoneTitle: milestone.title,
            },
          });
        } catch (activityError) {
          console.error(
            "❌ [LINK TASK] Activity logging failed:",
            activityError,
          );
        }
      } catch (err) {
        console.error(
          `❌ [LINK TASK] Error processing task ${currentTaskId}:`,
          err,
        );
        results.failed.push({ id: currentTaskId, reason: err.message });
      }
    }

    // Save milestone after all updates
    await milestone.save();

    // Calculate milestone progress
    await calculateMilestoneProgress(milestone);

    console.log(
      `✅ [LINK TASK] Linking processed. Success: ${results.success.length}, Failed: ${results.failed.length}`,
    );

    res.status(200).json({
      success: true,
      message: `Successfully linked ${results.success.length} tasks`,
      data: {
        milestone: {
          _id: milestone._id,
          title: milestone.title,
          linkedTasksCount: milestone.linkedTasks.length,
          progress: milestone.progress,
        },
        results,
      },
    });
  } catch (error) {
    console.error("❌ [LINK TASK] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to link task to milestone",
      error: error.message,
    });
  }
};

/**
 * @route DELETE /api/milestones/:id/unlink-task/:taskId
 * @desc Unlink a task from a milestone
 * @access Private
 */
export const unlinkTaskFromMilestone = async (req, res) => {
  try {
    console.log("\n🔓 [UNLINK TASK] Starting task unlinking process");

    const milestoneId = req.params.id;
    const taskId = req.params.taskId;
    const user = req.user;

    // Fetch milestone
    const milestone = await Task.findById(milestoneId);
    if (!milestone) {
      return res.status(404).json({
        success: false,
        message: "Milestone not found",
      });
    }

    // ✅ ACCESS CONTROL: Only individual users or milestone creator can unlink tasks
    const userRole = Array.isArray(user.role) ? user.role[0] : user.role;
    const isIndividual = userRole === "individual";
    const isCreator = milestone.createdBy?.toString() === user.id?.toString();

    if (!isIndividual && !isCreator) {
      console.log(
        "❌ [UNLINK TASK] Permission denied - User is not individual or creator",
      );
      return res.status(403).json({
        success: false,
        message:
          "Only individual users or milestone creators can unlink tasks from milestones",
      });
    }

    // Fetch task
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Check if task is actually linked
    const linkedTasks = milestone.linkedTasks || [];
    if (!linkedTasks.some((id) => id.toString() === taskId)) {
      return res.status(400).json({
        success: false,
        message: "Task is not linked to this milestone",
      });
    }

    // 🔄 Bidirectional Mapping: Update both milestone and task
    // 1. Remove task from milestone's linkedTasks array
    milestone.linkedTasks = linkedTasks.filter(
      (id) => id.toString() !== taskId,
    );

    // 2. Remove milestone reference from task
    task.linkedToMilestone = null;

    // Recalculate milestone progress
    await calculateMilestoneProgress(milestone);

    // Save both entities
    await milestone.save();
    await task.save();

    // 📊 Activity Feed: Log the unlinking action
    try {
      await ActivityHelper.logActivity({
        type: "milestone_task_unlinked",
        description: `Unlinked task "${task.title}" from milestone "${milestone.title}"`,
        user: user.id,
        task: milestoneId,
        relatedId: taskId,
        relatedType: "task",
        metadata: {
          icon: "🔓",
          category: "milestone",
          unlinkedTaskId: taskId,
          unlinkedTaskTitle: task.title,
          milestoneTitle: milestone.title,
        },
      });
    } catch (activityError) {
      console.error("❌ [UNLINK TASK] Activity logging failed:", activityError);
    }

    console.log(
      `✅ [UNLINK TASK] Successfully unlinked task ${taskId} from milestone ${milestoneId}`,
    );

    res.status(200).json({
      success: true,
      message: "Task unlinked from milestone successfully",
      data: {
        milestone: {
          _id: milestone._id,
          title: milestone.title,
          linkedTasksCount: milestone.linkedTasks.length,
          progress: milestone.progress,
        },
      },
    });
  } catch (error) {
    console.error("❌ [UNLINK TASK] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unlink task from milestone",
      error: error.message,
    });
  }
};

/**
 * @route GET /api/milestones/:id/linked-tasks
 * @desc Get all tasks linked to a milestone with full details
 * @access Private
 */
export const getMilestoneLinkedTasks = async (req, res) => {
  try {
    console.log("\n📋 [LINKED TASKS] Fetching linked tasks for milestone");

    const milestoneId = req.params.id;

    // Fetch milestone
    const milestone = await Task.findById(milestoneId).populate({
      path: "linkedTasks",
      select:
        "title description status priority dueDate assignedTo createdBy completedDate",
      populate: [
        { path: "assignedTo", select: "firstName lastName email" },
        { path: "createdBy", select: "firstName lastName email" },
      ],
    });

    if (!milestone) {
      return res.status(404).json({
        success: false,
        message: "Milestone not found",
      });
    }

    const linkedTasks = milestone.linkedTasks || [];

    console.log(`✅ [LINKED TASKS] Found ${linkedTasks.length} linked tasks`);

    res.status(200).json({
      success: true,
      message: `Found ${linkedTasks.length} linked tasks`,
      data: {
        milestone: {
          _id: milestone._id,
          title: milestone.title,
          progress: milestone.progress,
          status: milestone.status,
        },
        linkedTasks: linkedTasks.map((task) => ({
          _id: task._id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
          completedDate: task.completedDate,
          assignedTo: task.assignedTo
            ? {
                _id: task.assignedTo._id,
                name: `${task.assignedTo.firstName} ${task.assignedTo.lastName}`.trim(),
                email: task.assignedTo.email,
              }
            : null,
          createdBy: task.createdBy
            ? {
                _id: task.createdBy._id,
                name: `${task.createdBy.firstName} ${task.createdBy.lastName}`.trim(),
              }
            : null,
        })),
        totalCount: linkedTasks.length,
        completedCount: linkedTasks.filter((t) => t.status === "DONE").length,
      },
    });
  } catch (error) {
    console.error("❌ [LINKED TASKS] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch linked tasks",
      error: error.message,
    });
  }
};

// 🔔 Helper function to create due date notifications
export const createDueDateNotifications = async () => {
  try {
    const now = new Date();

    // Fetch all active tasks with due dates in a broad range (past + next 3 days)
    // We'll classify each task per its assignee's timezone
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const candidateTasks = await Task.find({
      dueDate: { $lt: threeDaysFromNow },
      status: { $nin: ["completed", "cancelled"] },
      isDeleted: { $ne: true },
      assignedTo: { $ne: null },
    }).populate("assignedTo", "firstName lastName email");

    let dueTodayCount = 0;
    let dueSoonCount = 0;
    let overdueCount = 0;

    for (const task of candidateTasks) {
      if (!task.assignedTo) continue;

      const userTimezone = await TimezoneHelper.getUserTimezone(
        task.assignedTo._id,
      );
      const { startOfDay: userTodayStart, endOfDay: userTodayEnd } =
        TimezoneHelper.getDayBoundaries(userTimezone);
      const dueDate = new Date(task.dueDate);

      if (dueDate >= userTodayStart && dueDate <= userTodayEnd) {
        // Task is due today in user's timezone
        dueTodayCount++;
        await createTaskNotification(TriggerEvent.TASK_DUE_TODAY, task, {
          targetUserId: task.assignedTo._id,
          title: "Task Due Today",
          message: `Task "${task.title}" is due today`,
          priority: NotificationPriority.URGENT,
          channels: [ChannelType.IN_APP, ChannelType.EMAIL, ChannelType.PUSH],
        });
      } else if (dueDate > userTodayEnd && dueDate < threeDaysFromNow) {
        // Task is due soon (within next 2 days) in user's timezone
        dueSoonCount++;
        await createTaskNotification(TriggerEvent.TASK_DUE_SOON, task, {
          targetUserId: task.assignedTo._id,
          title: "Task Due Soon",
          message: `Task "${task.title}" is due on ${TimezoneHelper.formatInTimezone(task.dueDate, userTimezone)}`,
          priority: NotificationPriority.NORMAL,
        });
      } else if (dueDate < userTodayStart) {
        // Task is overdue in user's timezone
        overdueCount++;
        const daysPastDue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
        await createTaskNotification(TriggerEvent.TASK_OVERDUE, task, {
          targetUserId: task.assignedTo._id,
          title: "Task Overdue",
          message: `Task "${task.title}" is ${daysPastDue} day${daysPastDue > 1 ? "s" : ""} overdue`,
          priority: NotificationPriority.URGENT,
          channels: [ChannelType.IN_APP, ChannelType.EMAIL, ChannelType.PUSH],
          metadata: {
            daysPastDue: daysPastDue,
          },
        });

        // Create escalation notification for tasks overdue by more than 3 days
        if (daysPastDue > 3) {
          // Notify task creator
          if (task.createdBy) {
            await createTaskNotification(
              TriggerEvent.OVERDUE_ESCALATION,
              task,
              {
                targetUserId: task.createdBy,
                title: "Task Overdue - Escalation",
                message: `Task "${task.title}" assigned to ${task.assignedTo.firstName} ${task.assignedTo.lastName} is ${daysPastDue} days overdue`,
                priority: NotificationPriority.URGENT,
                channels: [ChannelType.IN_APP, ChannelType.EMAIL],
                metadata: {
                  daysPastDue: daysPastDue,
                  assigneeName: `${task.assignedTo.firstName} ${task.assignedTo.lastName}`,
                },
              },
            );
          }

          // Notify managers in the same organization
          try {
            const assigneeUser = await User.findById(
              task.assignedTo._id,
            ).select("organization_id");
            if (assigneeUser?.organization_id) {
              const managers = await User.find({
                organization_id: assigneeUser.organization_id,
                role: { $in: ["manager", "org_admin"] },
                isActive: true,
              }).select("_id");

              const creatorIdStr =
                task.createdBy?._id?.toString() || task.createdBy?.toString();
              for (const manager of managers) {
                // Skip if manager is already the creator (already notified above)
                if (manager._id.toString() === creatorIdStr) continue;
                // Skip if manager is the assignee
                if (manager._id.toString() === task.assignedTo._id.toString())
                  continue;
                await createTaskNotification(
                  TriggerEvent.OVERDUE_ESCALATION,
                  task,
                  {
                    targetUserId: manager._id,
                    title: "⚠️ Task Overdue - Manager Escalation",
                    message: `Task "${task.title}" assigned to ${task.assignedTo.firstName} ${task.assignedTo.lastName} is ${daysPastDue} days overdue. Please follow up.`,
                    priority: NotificationPriority.URGENT,
                    channels: [ChannelType.IN_APP, ChannelType.EMAIL],
                    metadata: {
                      daysPastDue: daysPastDue,
                      assigneeName: `${task.assignedTo.firstName} ${task.assignedTo.lastName}`,
                      escalationLevel: "manager",
                    },
                  },
                );
              }
            }
          } catch (managerEscalationError) {
            console.error(
              "Failed to send manager escalation notification:",
              managerEscalationError.message,
            );
          }
        }
      }
    }

    console.log(`✅ Due date notifications created:`, {
      dueToday: dueTodayCount,
      dueSoon: dueSoonCount,
      overdue: overdueCount,
    });

    return {
      success: true,
      processed: {
        dueToday: dueTodayCount,
        dueSoon: dueSoonCount,
        overdue: overdueCount,
      },
    };
  } catch (error) {
    console.error("Error creating due date notifications:", error);
    return { success: false, error: error.message };
  }
};
