/**
 * LinkedTaskService — Dependency Engine
 *
 * Manages task dependencies (linkedTaskId).
 * Rules (from spec):
 *  - Only second task onwards can be linked
 *  - Only one linked task per task
 *  - Only the previous task (lower sequence) can be linked
 *  - One-to-one mapping: a task that is already someone's linkedTask cannot be linked again
 *  - Blocks OPEN→IN_PROGRESS if linked task is not Completed
 *  - Triggers Auto-Initiate when a task completes
 */

import { Task } from "../models.js";
import { WorkflowStatus } from "../constants/workflowEnums.js";

class LinkedTaskServiceClass {
  /**
   * Validate that the linked task is completed before allowing IN_PROGRESS.
   * Throws if the linked task is not completed.
   *
   * @param {Object} task - The task trying to move to IN_PROGRESS
   */
  async validateLinkedTaskCompletion(task) {
    if (!task || !task.linkedTaskId) return; // No dependency → allow

    const linkedTask = await Task.findById(task.linkedTaskId).select("status title isDeleted");
    if (!linkedTask || linkedTask.isDeleted) return; // Linked task deleted → allow (graceful)

    const completedStatuses = [
      WorkflowStatus.COMPLETED,
      WorkflowStatus.DONE,
      "COMPLETED",
      "DONE",
      "completed",
      "done",
      "Completed",
      "Done",
    ];

    if (!completedStatuses.includes(linkedTask.status)) {
      throw new Error(
        `Cannot change status: Linked prerequisite task "${linkedTask.title}" is not completed. You can only update this task after "${linkedTask.title}" is completed.`,
      );
    }
  }

  /**
   * Get tasks that are eligible to be linked to the given task.
   * Eligible = same parent, previous sequence, not already someone's linkedTask.
   *
   * @param {ObjectId} parentTaskId - The parent process/task
   * @param {number} currentSequence - The sequence of the current task
   * @param {ObjectId} excludeTaskId - The task being configured (exclude self)
   * @returns {Promise<Array>} - Array of eligible task documents
   */
  async getEligibleLinkedTasks(parentTaskId, currentSequence, excludeTaskId) {
    const query = {
      $or: [{ parentTask: parentTaskId }, { parentTaskId }],
      isSubtask: true,
      isDeleted: { $ne: true },
    };

    if (excludeTaskId) {
      query._id = { $ne: excludeTaskId };
    }

    // 1. Find all sibling subtasks under the same parent process
    const previousTasks = await Task.find(query)
      .select("_id title taskType sequence status")
      .sort({ sequence: 1, createdAt: 1 });

    // 2. 1-to-1 mapping check: Find subtask IDs already used as a prerequisite (linkedTaskId) by another task
    const alreadyLinked = await Task.find({
      $or: [{ parentTask: parentTaskId }, { parentTaskId }],
      isSubtask: true,
      isDeleted: { $ne: true },
      linkedTaskId: { $ne: null },
      _id: { $ne: excludeTaskId },
    }).select("linkedTaskId");

    const alreadyLinkedIds = new Set(
      alreadyLinked.map((t) => t.linkedTaskId?.toString()).filter(Boolean),
    );

    // 3. Return only subtasks not already claimed as a prerequisite by another subtask (A -> B -> C -> D)
    return previousTasks.filter(
      (t) => !alreadyLinkedIds.has(t._id.toString()),
    );
  }

  /**
   * Called when a task completes.
   * Finds tasks with linkedTaskId = completedTaskId and autoInitiate = true,
   * then automatically moves them to IN_PROGRESS.
   *
   * @param {ObjectId} completedTaskId
   */
  async onTaskCompleted(completedTaskId) {
    if (!completedTaskId) return;

    const waitingTasks = await Task.find({
      linkedTaskId: completedTaskId,
      $or: [
        { "configuration.autoInitiate": true },
        { autoInitiate: true },
      ],
      status: { $in: [WorkflowStatus.OPEN, "OPEN", "open", "Open"] },
      isDeleted: { $ne: true },
    });

    for (const waitingTask of waitingTasks) {
      try {
        await Task.findByIdAndUpdate(waitingTask._id, {
          $set: {
            status: "INPROGRESS",
            startedAt: new Date(),
            updatedAt: new Date(),
          },
        });
        console.log(
          `[LinkedTaskService] Auto-initiated task ${waitingTask._id} (${waitingTask.title})`,
        );

        // 📧 Trigger email send for auto-initiated Email Task
        if (waitingTask.taskType === "email" || waitingTask.subtaskType === "email") {
          try {
            const { EmailTaskService } = await import("./EmailTaskService.js");
            EmailTaskService.sendEmailTask(waitingTask).catch((err) =>
              console.error("[LinkedTaskService] Auto-initiated email send failed:", err)
            );
          } catch (eErr) {
            console.error("[LinkedTaskService] Failed to load EmailTaskService:", eErr);
          }
        }

        // 🔔 Trigger approval notifications for auto-initiated Approval Task
        if (waitingTask.taskType === "approval" || waitingTask.subtaskType === "approval") {
          try {
            const EnhancedNotificationHelper = (await import("../services/enhancedNotificationHelper.js")).default;
            EnhancedNotificationHelper.notifyTaskCreation(waitingTask, {
              taskType: "approval",
              createdBy: waitingTask.createdBy,
              collaborators: waitingTask.collaborators || [],
              approvers: waitingTask.approvers || [],
            }).catch((aErr) =>
              console.error("[LinkedTaskService] Auto-initiated approval notification failed:", aErr)
            );
          } catch (aErr) {
            console.error("[LinkedTaskService] Failed to load EnhancedNotificationHelper:", aErr);
          }
        }

        // 🔄 Auto-update parent task status & progress if waitingTask is a subtask
        const parentId = waitingTask.parentTask || waitingTask.parentTaskId;
        if (parentId) {
          try {
            const { recalculateParentTaskStatusAndProgress } = await import(
              "../controller/taskController.js"
            );
            await recalculateParentTaskStatusAndProgress(parentId, null);
          } catch (pErr) {
            console.error(
              "[LinkedTaskService] Error recalculating parent task status:",
              pErr,
            );
          }
        }
      } catch (err) {
        console.error(
          `[LinkedTaskService] Auto-initiate failed for task ${waitingTask._id}:`,
          err,
        );
      }
    }
  }
}

export const LinkedTaskService = new LinkedTaskServiceClass();
