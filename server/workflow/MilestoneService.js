/**
 * MilestoneService — Milestone Auto-Completion Engine
 *
 * Rules (from spec):
 *  - Milestone has no assignee, no manual completion, no edit
 *  - Completion is automatic: whenever ALL linked tasks become Completed,
 *    the Milestone is automatically marked Completed
 */

import { Task } from "../models.js";
import { WorkflowStatus, TaskType } from "../constants/workflowEnums.js";

class MilestoneServiceClass {
  /**
   * Called whenever any task completes.
   * Checks if this task is linked to a Milestone and evaluates it.
   *
   * @param {ObjectId} completedSubtaskId
   */
  async onSubtaskCompleted(completedSubtaskId) {
    // Find any milestone tasks that have this task in their linkedTasks array
    const milestones = await Task.find({
      taskType: TaskType.MILESTONE,
      linkedTasks: completedSubtaskId,
    });

    for (const milestone of milestones) {
      await this.evaluateMilestone(milestone._id);
    }

    // Also check if parent task is a milestone
    const subtask = await Task.findById(completedSubtaskId).select("parentTask parentTaskId");
    const parentId = subtask?.parentTask || subtask?.parentTaskId;
    if (parentId) {
      const parent = await Task.findById(parentId).select("taskType isMilestone");
      if (parent && (parent.taskType === TaskType.MILESTONE || parent.isMilestone)) {
        await this.evaluateMilestone(parentId);
      }
    }
  }

  /**
   * Evaluate whether a milestone should be automatically completed.
   * Marks as Completed if all linked tasks are in a completed state.
   *
   * @param {ObjectId} milestoneId
   */
  async evaluateMilestone(milestoneId) {
    const milestone = await Task.findById(milestoneId).populate("linkedTasks");
    if (!milestone) return;
    if (milestone.status === WorkflowStatus.COMPLETED) return;

    const completedStatuses = [
      WorkflowStatus.COMPLETED,
      WorkflowStatus.DONE,
      "COMPLETED",
      "DONE",
      "completed",
      "done",
    ];

    // Also evaluate subtasks if no explicit linkedTasks array
    let tasksToCheck = milestone.linkedTasks || [];

    if (tasksToCheck.length === 0) {
      // Fall back to checking child subtasks
      const subtasks = await Task.find({
        $or: [
          { parentTask: milestoneId },
          { parentTaskId: milestoneId },
        ],
        isDeleted: { $ne: true },
      }).select("status title");
      tasksToCheck = subtasks;
    }

    if (tasksToCheck.length === 0) return; // No tasks linked → don't auto-complete

    const allCompleted = tasksToCheck.every((t) =>
      completedStatuses.includes(t.status),
    );

    if (allCompleted) {
      await Task.findByIdAndUpdate(milestoneId, {
        $set: {
          status: WorkflowStatus.COMPLETED,
          completedAt: new Date(),
          metadata: {
            ...(milestone.metadata || {}),
            autoCompletedAt: new Date(),
            autoCompletedReason: "All linked tasks completed",
          },
        },
      });
      console.log(
        `[MilestoneService] Auto-completed milestone ${milestoneId} (${milestone.title})`,
      );
    }
  }
}

export const MilestoneService = new MilestoneServiceClass();
