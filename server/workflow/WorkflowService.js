/**
 * WorkflowService — Central Orchestrator
 *
 * This is the top-level entry point for all workflow state transitions.
 * Controllers call this service; it delegates to sub-services.
 *
 * Design Principle: Generic workflow engine.
 * No hardcoded workflow types (Vendor, Employee, etc.).
 * All business logic is configuration-driven.
 */

import { Task } from "../models.js";
import { TaskTransitionService } from "./TaskTransitionService.js";
import { LinkedTaskService } from "./LinkedTaskService.js";
import { MilestoneService } from "./MilestoneService.js";
import { ApprovalService } from "./ApprovalService.js";
import { EmailTaskService } from "./EmailTaskService.js";
import { isTerminalStatus, WorkflowStatus, TaskType } from "../constants/workflowEnums.js";

class WorkflowServiceClass {
  /**
   * Main entry point for all task status changes.
   * Called by taskController instead of inline logic.
   *
   * @param {Object} task - The Mongoose Task document (pre-change)
   * @param {string} newStatus - The requested new status
   * @param {Object} actor - The user making the change { _id, name, ... }
   * @param {Object} options - Additional options (reason, rejectionAction, etc.)
   * @returns {Promise<Object>} - Updated task document
   */
  async handleStatusChange(task, newStatus, actor, options = {}) {
    // 1. Validate the transition is allowed
    await TaskTransitionService.validateTransition(task, newStatus, actor);

    // 2. Record startedAt when moving to IN_PROGRESS
    const updates = { status: newStatus };
    if (newStatus === WorkflowStatus.IN_PROGRESS && !task.startedAt) {
      updates.startedAt = new Date();
    }

    // 3. Record completedAt for terminal statuses
    if (isTerminalStatus(newStatus)) {
      updates.completedAt = new Date();
    }

    // 4. Apply the status update
    const updatedTask = await Task.findByIdAndUpdate(
      task._id,
      { $set: updates },
      { new: true },
    ).populate("assignedTo createdBy parentTask");

    // 5. Post-transition side effects (non-blocking, fire-and-forget where safe)
    await this._runPostTransitionHooks(updatedTask, task.status, newStatus, actor, options);

    return updatedTask;
  }

  /**
   * Execute all side effects after a status change.
   * Each hook is isolated — a failure in one does not roll back others.
   */
  async _runPostTransitionHooks(task, oldStatus, newStatus, actor, options) {
    const isNowCompleted = newStatus === WorkflowStatus.COMPLETED;
    const isNowRejected = newStatus === WorkflowStatus.REJECTED;
    const isNowCancelled = newStatus === WorkflowStatus.CANCELLED;
    const isNowInProgress = newStatus === WorkflowStatus.IN_PROGRESS;

    try {
      // Email Task: auto-send when moving to IN_PROGRESS
      if (isNowInProgress && task.taskType === TaskType.EMAIL) {
        await EmailTaskService.sendEmailTask(task).catch((err) =>
          console.error("[WorkflowService] Email send failed:", err),
        );
      }

      // Milestone: auto-complete if all linked tasks are done
      if (isNowCompleted && task.parentTask) {
        await MilestoneService.onSubtaskCompleted(task._id).catch((err) =>
          console.error("[WorkflowService] Milestone eval failed:", err),
        );
      }

      // Linked Task Engine: auto-initiate tasks waiting on this one
      if (isNowCompleted) {
        await LinkedTaskService.onTaskCompleted(task._id).catch((err) =>
          console.error("[WorkflowService] Auto-initiate failed:", err),
        );
      }

      // Parent Cancellation: evaluate parent when subtask is rejected/cancelled
      if ((isNowRejected || isNowCancelled) && task.parentTask) {
        await this.evaluateParentOnSubtaskRejection(
          task.parentTask,
          task._id,
          actor,
        ).catch((err) =>
          console.error("[WorkflowService] Parent eval failed:", err),
        );
      }
    } catch (err) {
      console.error("[WorkflowService] Post-transition hook error:", err);
    }
  }

  /**
   * Evaluate the parent task/process when a subtask becomes Rejected or Cancelled.
   * Behavior is controlled by parentCancellationMode on the parent.
   *
   * @param {ObjectId} parentTaskId
   * @param {ObjectId} subtaskId - The subtask that was rejected/cancelled
   * @param {Object} actor
   */
  async evaluateParentOnSubtaskRejection(parentTaskId, subtaskId, actor) {
    const parent = await Task.findById(parentTaskId);
    if (!parent || isTerminalStatus(parent.status)) return;

    const mode = parent.configuration?.parentCancellationMode || "ignore_rejection";

    if (mode === "cancel_on_rejection") {
      console.log(
        `[WorkflowService] Cancelling parent ${parentTaskId} due to subtask ${subtaskId} rejection`,
      );
      await Task.findByIdAndUpdate(parentTaskId, {
        $set: {
          status: WorkflowStatus.CANCELLED,
          completedAt: new Date(),
          metadata: {
            ...(parent.metadata || {}),
            cancelledDueToSubtask: subtaskId,
            cancelledAt: new Date(),
          },
        },
      });
    }
    // ignore_rejection: do nothing
  }
}

export const WorkflowService = new WorkflowServiceClass();
