/**
 * ApprovalService — Approval Decision Engine
 *
 * Handles all approval-related operations:
 *  - Approve / Reject decisions
 *  - Sequential approval order management
 *  - Approval History (immutable, multi-cycle)
 *  - Reject & Terminate vs Reject & Re-initiate
 *  - Context Task re-initiation
 */

import { Task, ApprovalHistory } from "../models.js";
import { WorkflowStatus, ApprovalMode, ApprovalStatus, RejectionAction } from "../constants/workflowEnums.js";

class ApprovalServiceClass {
  /**
   * Submit an approval decision.
   *
   * @param {Object} options
   * @param {ObjectId} options.taskId
   * @param {Object} options.actor - The approver user
   * @param {string} options.decision - "approve" | "reject"
   * @param {string} [options.comment]
   * @param {string} [options.rejectionAction] - "terminate" | "reinitiate"
   * @param {string} [options.rejectionReason]
   * @returns {Promise<Object>} - Updated task
   */
  async submitDecision({ taskId, actor, decision, comment, rejectionAction, rejectionReason }) {
    const task = await Task.findById(taskId);
    if (!task) throw new Error("Approval task not found.");
    if (!task.isApprovalTask && task.taskType !== "approval") {
      throw new Error("This task is not an approval task.");
    }

    // Verify actor is an approver
    const isApprover = task.approvers?.some(
      (a) => a.toString() === actor._id.toString(),
    );
    if (!isApprover) throw new Error("You are not an approver for this task.");

    // Determine current approval cycle
    const lastHistory = await ApprovalHistory.findOne({ task: taskId })
      .sort({ cycle: -1 })
      .select("cycle");
    const currentCycle = lastHistory?.cycle || 1;

    // Record in ApprovalHistory (immutable append)
    await ApprovalHistory.create({
      task: taskId,
      organization: task.organization,
      cycle: currentCycle,
      approver: actor._id,
      status: decision === "approve" ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
      reason: comment || rejectionReason || null,
      rejectionAction: decision === "reject" ? (rejectionAction || RejectionAction.TERMINATE) : null,
      decidedAt: new Date(),
    });

    // Record in task's approvalDecisions array
    await Task.findByIdAndUpdate(taskId, {
      $push: {
        approvalDecisions: {
          approverId: actor._id,
          decision: decision === "approve" ? "approve" : "reject",
          comment: comment || rejectionReason || null,
          decidedAt: new Date(),
        },
      },
    });

    if (decision === "approve") {
      return await this._handleApproval(task, actor, currentCycle);
    } else {
      return await this._handleRejection(task, actor, rejectionAction, rejectionReason, currentCycle);
    }
  }

  /**
   * Handle an approval decision based on the approval mode.
   */
  async _handleApproval(task, actor, cycle) {
    const mode = task.approvalMode || ApprovalMode.ANY;

    if (mode === ApprovalMode.ANY) {
      // First approval wins — mark task as Approved
      return await Task.findByIdAndUpdate(
        task._id,
        {
          $set: {
            approvalStatus: ApprovalStatus.APPROVED,
            status: WorkflowStatus.COMPLETED,
            completedAt: new Date(),
          },
        },
        { new: true },
      );
    }

    if (mode === ApprovalMode.ALL) {
      // Check if all approvers have approved in this cycle
      const approvedInCycle = await ApprovalHistory.find({
        task: task._id,
        cycle,
        status: ApprovalStatus.APPROVED,
      });
      const allApproved = task.approvers.every((approverId) =>
        approvedInCycle.some((h) => h.approver.toString() === approverId.toString()),
      );

      if (allApproved) {
        return await Task.findByIdAndUpdate(
          task._id,
          {
            $set: {
              approvalStatus: ApprovalStatus.APPROVED,
              status: WorkflowStatus.COMPLETED,
              completedAt: new Date(),
            },
          },
          { new: true },
        );
      }
      // Not all approved yet — do nothing, wait for others
      return task;
    }

    if (mode === ApprovalMode.SEQUENTIAL) {
      // Advance to next approver in sequence
      const nextIndex = (task.currentApproverIndex || 0) + 1;
      if (nextIndex >= task.approvers.length) {
        // All sequential approvers have approved
        return await Task.findByIdAndUpdate(
          task._id,
          {
            $set: {
              approvalStatus: ApprovalStatus.APPROVED,
              status: WorkflowStatus.COMPLETED,
              completedAt: new Date(),
              currentApproverIndex: nextIndex,
            },
          },
          { new: true },
        );
      } else {
        // Move to next approver
        return await Task.findByIdAndUpdate(
          task._id,
          { $set: { currentApproverIndex: nextIndex } },
          { new: true },
        );
      }
    }

    return task;
  }

  /**
   * Handle a rejection decision.
   * rejectionAction: "terminate" | "reinitiate"
   */
  async _handleRejection(task, actor, rejectionAction, reason, cycle) {
    const action = rejectionAction || RejectionAction.TERMINATE;

    // Mark task as Rejected
    await Task.findByIdAndUpdate(task._id, {
      $set: {
        approvalStatus: ApprovalStatus.REJECTED,
        status: WorkflowStatus.REJECTED,
        completedAt: new Date(),
      },
    });

    if (action === RejectionAction.REINITIATE && task.contextTaskId) {
      await this.reInitiateContextTask(task.contextTaskId, task._id, cycle);
    }
    // "terminate" follows the parent cancellation mode (handled by WorkflowService)

    return await Task.findById(task._id);
  }

  /**
   * Re-initiate the context task after a rejection.
   * The context task moves back to IN_PROGRESS (new cycle begins).
   *
   * @param {ObjectId} contextTaskId
   * @param {ObjectId} approvalTaskId - The approval task that was rejected
   * @param {number} rejectedCycle
   */
  async reInitiateContextTask(contextTaskId, approvalTaskId, rejectedCycle) {
    const contextTask = await Task.findById(contextTaskId);
    if (!contextTask) return;

    await Task.findByIdAndUpdate(contextTaskId, {
      $set: {
        status: WorkflowStatus.IN_PROGRESS,
        startedAt: new Date(),
        completedAt: null,
        metadata: {
          ...(contextTask.metadata || {}),
          reinitiatedFromApproval: approvalTaskId,
          reinitiatedCycle: rejectedCycle,
          reinitiatedAt: new Date(),
        },
      },
    });

    // Reset the approval task for a new cycle
    const newCycle = rejectedCycle + 1;
    await Task.findByIdAndUpdate(approvalTaskId, {
      $set: {
        approvalStatus: "pending",
        status: WorkflowStatus.OPEN,
        completedAt: null,
        currentApproverIndex: 0,
      },
    });

    // Create pending history entries for the new cycle
    const approvalTask = await Task.findById(approvalTaskId);
    if (approvalTask?.approvers) {
      for (const approverId of approvalTask.approvers) {
        await ApprovalHistory.create({
          task: approvalTaskId,
          organization: approvalTask.organization,
          cycle: newCycle,
          approver: approverId,
          status: "pending",
          decidedAt: new Date(),
        });
      }
    }

    console.log(
      `[ApprovalService] Re-initiated context task ${contextTaskId}, approval task enters cycle ${newCycle}`,
    );
  }

  /**
   * Get the complete approval history for a task, grouped by cycle.
   *
   * @param {ObjectId} taskId
   * @returns {Promise<Array>} - History grouped by cycle
   */
  async getApprovalHistory(taskId) {
    const history = await ApprovalHistory.find({ task: taskId })
      .sort({ cycle: 1, createdAt: 1 })
      .populate("approver", "name email avatar");

    // Group by cycle
    const cycles = {};
    for (const entry of history) {
      if (!cycles[entry.cycle]) cycles[entry.cycle] = [];
      cycles[entry.cycle].push(entry);
    }

    return Object.entries(cycles).map(([cycle, decisions]) => ({
      cycle: Number(cycle),
      decisions,
    }));
  }
}

export const ApprovalService = new ApprovalServiceClass();
