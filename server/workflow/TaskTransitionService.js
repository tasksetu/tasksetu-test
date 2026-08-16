/**
 * TaskTransitionService — Status Transition Validation
 *
 * All transition validation rules live here.
 * Controllers and WorkflowService call this before any status change.
 * Throws descriptive errors for invalid transitions.
 */

import { Task } from "../models.js";
import { LinkedTaskService } from "./LinkedTaskService.js";
import { WorkflowStatus, TaskType, isTerminalStatus } from "../constants/workflowEnums.js";

class TaskTransitionServiceClass {
  /**
   * Validate that a status transition is allowed.
   * Throws an error with a user-friendly message if blocked.
   *
   * @param {Object} task - The current Task document
   * @param {string} newStatus - The requested status
   * @param {Object} actor - The user requesting the change
   */
  async validateTransition(task, newStatus, actor) {
    // 1. Cannot transition from a terminal status
    if (isTerminalStatus(task.status)) {
      throw new Error(
        `Task is already in a terminal status (${task.status}) and cannot be changed.`,
      );
    }

    // 2. Milestone tasks cannot be manually completed
    if (task.taskType === TaskType.MILESTONE && newStatus === WorkflowStatus.COMPLETED) {
      throw new Error(
        "Milestone tasks are completed automatically when all linked tasks are done. Manual completion is not allowed.",
      );
    }

    // 3. Linked Task Engine: block status changes if prerequisite task is not completed
    if (task.linkedTaskId) {
      await LinkedTaskService.validateLinkedTaskCompletion(task);
    }

    // 4. (Future) Form-required validation
    // if (task.form_required_for_completion && newStatus is completion status) { ... }

    return true;
  }

  /**
   * Check whether the actor is allowed to change the task status.
   * Returns false if the actor has no permission.
   *
   * @param {Object} task
   * @param {Object} actor
   * @returns {boolean}
   */
  canActorChangeStatus(task, actor) {
    if (!actor?._id) return false;

    const actorId = actor._id.toString();
    const assigneeId = task.assignedTo?.toString();
    const creatorId = task.createdBy?.toString();

    // Assignee and creator can always change status
    if (actorId === assigneeId || actorId === creatorId) return true;

    // Org admins and managers have override permission
    const elevatedRoles = ["org_admin", "super_admin", "manager"];
    if (actor.roles?.some((r) => elevatedRoles.includes(r))) return true;

    return false;
  }
}

export const TaskTransitionService = new TaskTransitionServiceClass();
