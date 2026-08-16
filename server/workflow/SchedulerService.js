/**
 * SchedulerService — Workflow Scheduler
 *
 * Runs periodic jobs for:
 *  - Auto-Complete: marks IN_PROGRESS tasks as Completed after N days
 *  - Auto-Approval: marks approval tasks as auto-approved after the autoApproveAfter date
 *
 * Integrates with the existing cronJobService.js pattern.
 * Jobs run every hour (configurable).
 */

import { Task, ApprovalHistory } from "../models.js";
import { WorkflowStatus, ApprovalStatus } from "../constants/workflowEnums.js";

class SchedulerServiceClass {
  /**
   * Run the Auto-Complete job.
   * Finds all IN_PROGRESS tasks with autoComplete=true where
   * startedAt + autoCompleteAfterDays <= now.
   */
  async runAutoCompleteJob() {
    const now = new Date();

    const candidates = await Task.find({
      status: { $in: [WorkflowStatus.IN_PROGRESS, "IN_PROGRESS", "In Progress"] },
      "configuration.autoComplete": true,
      "configuration.autoCompleteAfterDays": { $gt: 0 },
      startedAt: { $ne: null },
      isDeleted: { $ne: true },
    });

    let completedCount = 0;

    for (const task of candidates) {
      const days = task.configuration.autoCompleteAfterDays;
      const deadline = new Date(task.startedAt);
      deadline.setDate(deadline.getDate() + days);

      if (now >= deadline) {
        try {
          await Task.findByIdAndUpdate(task._id, {
            $set: {
              status: WorkflowStatus.COMPLETED,
              completedAt: now,
              metadata: {
                ...(task.metadata || {}),
                autoCompletedAt: now,
                autoCompletedReason: `Auto-completed after ${days} days`,
              },
            },
          });
          completedCount++;
          console.log(
            `[SchedulerService] Auto-completed task ${task._id} (${task.title}) after ${days} days`,
          );
        } catch (err) {
          console.error(
            `[SchedulerService] Auto-complete failed for ${task._id}:`,
            err,
          );
        }
      }
    }

    console.log(
      `[SchedulerService] Auto-complete job done. Completed: ${completedCount}`,
    );
    return completedCount;
  }

  /**
   * Run the Auto-Approval job.
   * Finds all approval tasks where autoApproveEnabled=true and
   * autoApproveAfter <= now, then marks them as auto-approved.
   */
  async runAutoApprovalJob() {
    const now = new Date();

    const candidates = await Task.find({
      taskType: "approval",
      autoApproveEnabled: true,
      autoApproveAfter: { $lte: now },
      approvalStatus: "pending",
      isDeleted: { $ne: true },
    });

    let approvedCount = 0;

    for (const task of candidates) {
      try {
        // Record in history
        await ApprovalHistory.create({
          task: task._id,
          organization: task.organization,
          cycle: 1,
          approver: task.createdBy,
          status: ApprovalStatus.AUTO_APPROVED,
          isAutoApproval: true,
          decidedAt: now,
        });

        await Task.findByIdAndUpdate(task._id, {
          $set: {
            approvalStatus: ApprovalStatus.AUTO_APPROVED,
            status: WorkflowStatus.COMPLETED,
            completedAt: now,
          },
          $push: {
            approvalDecisions: {
              approverId: task.createdBy,
              decision: "auto_approve",
              comment: "Auto-approved: no approver action within the deadline",
              decidedAt: now,
              isAutoApproval: true,
            },
          },
        });

        approvedCount++;
        console.log(
          `[SchedulerService] Auto-approved task ${task._id} (${task.title})`,
        );
      } catch (err) {
        console.error(
          `[SchedulerService] Auto-approval failed for ${task._id}:`,
          err,
        );
      }
    }

    console.log(
      `[SchedulerService] Auto-approval job done. Approved: ${approvedCount}`,
    );
    return approvedCount;
  }

  /**
   * Email Task Auto-Complete job.
   * Finds IN_PROGRESS email tasks with emailConfig.autoComplete=true
   * where startedAt + autoCompleteAfterDays <= now.
   */
  async runEmailAutoCompleteJob() {
    const now = new Date();

    const candidates = await Task.find({
      taskType: "email",
      status: { $in: [WorkflowStatus.IN_PROGRESS, "IN_PROGRESS", "In Progress"] },
      "emailConfig.autoComplete": true,
      "emailConfig.autoCompleteAfterDays": { $gt: 0 },
      startedAt: { $ne: null },
      isDeleted: { $ne: true },
    });

    let completedCount = 0;

    for (const task of candidates) {
      const days = task.emailConfig.autoCompleteAfterDays;
      const deadline = new Date(task.startedAt);
      deadline.setDate(deadline.getDate() + days);

      if (now >= deadline) {
        await Task.findByIdAndUpdate(task._id, {
          $set: {
            status: WorkflowStatus.COMPLETED,
            completedAt: now,
          },
        });
        completedCount++;
      }
    }

    return completedCount;
  }
}

export const SchedulerService = new SchedulerServiceClass();
