/**
 * VisibilityService — Task Visibility Engine
 *
 * Manages which users can view tasks beyond the standard assignee/collaborator list.
 * Visible users have read-only access: view, comment, view attachments, view form data.
 * They CANNOT edit, complete, or reassign.
 */

import { Task, TaskVisibility } from "../models.js";

class VisibilityServiceClass {
  /**
   * Add a user to the visible users list for a task.
   *
   * @param {Object} options
   * @param {ObjectId} options.taskId
   * @param {ObjectId} options.userId - User to grant visibility to
   * @param {ObjectId} options.addedBy - User granting the visibility
   * @param {ObjectId} options.organizationId
   * @param {Object} [options.permissions] - Override default permissions
   * @returns {Promise<Object>} - The TaskVisibility document
   */
  async addVisibleUser({ taskId, userId, addedBy, organizationId, permissions = {} }) {
    const existing = await TaskVisibility.findOne({ task: taskId, user: userId });
    if (existing) {
      // Update permissions if already exists
      return await TaskVisibility.findByIdAndUpdate(
        existing._id,
        {
          $set: {
            canView: permissions.canView ?? existing.canView,
            canComment: permissions.canComment ?? existing.canComment,
            canViewAttachments: permissions.canViewAttachments ?? existing.canViewAttachments,
            canViewFormData: permissions.canViewFormData ?? existing.canViewFormData,
          },
        },
        { new: true },
      );
    }

    return await TaskVisibility.create({
      task: taskId,
      user: userId,
      addedBy,
      organization: organizationId,
      canView: permissions.canView ?? true,
      canComment: permissions.canComment ?? true,
      canViewAttachments: permissions.canViewAttachments ?? true,
      canViewFormData: permissions.canViewFormData ?? true,
    });
  }

  /**
   * Remove a user from the visible users list.
   *
   * @param {ObjectId} taskId
   * @param {ObjectId} userId
   */
  async removeVisibleUser(taskId, userId) {
    return await TaskVisibility.findOneAndDelete({ task: taskId, user: userId });
  }

  /**
   * Get all visible users for a task.
   *
   * @param {ObjectId} taskId
   * @returns {Promise<Array>} - Array of TaskVisibility documents
   */
  async getVisibleUsers(taskId) {
    return await TaskVisibility.find({ task: taskId })
      .populate("user", "name email avatar")
      .populate("addedBy", "name email");
  }

  /**
   * Get the visibility record for a specific user on a task.
   * Returns null if the user has no visibility grant.
   *
   * @param {ObjectId} taskId
   * @param {ObjectId} userId
   * @returns {Promise<Object|null>}
   */
  async getUserVisibility(taskId, userId) {
    return await TaskVisibility.findOne({ task: taskId, user: userId });
  }

  /**
   * Check whether a user can view a task.
   * Returns true if the user is: assignee, creator, collaborator, or has a visibility grant.
   *
   * @param {ObjectId} taskId
   * @param {Object} user - The user to check
   * @returns {Promise<{ canView: boolean, isReadOnly: boolean, permissions: Object|null }>}
   */
  async canUserViewTask(taskId, user) {
    const task = await Task.findById(taskId).select(
      "assignedTo createdBy collaborators organization",
    );
    if (!task) return { canView: false, isReadOnly: false, permissions: null };

    const userId = user._id.toString();

    // Assignee, creator, collaborator → full access
    if (
      task.assignedTo?.toString() === userId ||
      task.createdBy?.toString() === userId ||
      task.collaborators?.some((c) => c.toString() === userId)
    ) {
      return { canView: true, isReadOnly: false, permissions: null };
    }

    // Check visibility grant
    const visibility = await TaskVisibility.findOne({
      task: taskId,
      user: user._id,
    });

    if (visibility?.canView) {
      return {
        canView: true,
        isReadOnly: true,
        permissions: {
          canComment: visibility.canComment,
          canViewAttachments: visibility.canViewAttachments,
          canViewFormData: visibility.canViewFormData,
        },
      };
    }

    return { canView: false, isReadOnly: false, permissions: null };
  }

  /**
   * Get all tasks visible to a user (via TaskVisibility grants).
   * Returns tasks as read-only with their visibility permissions.
   *
   * @param {ObjectId} userId
   * @param {ObjectId} organizationId
   * @returns {Promise<Array>}
   */
  async getVisibleTasksForUser(userId, organizationId) {
    const visibilityGrants = await TaskVisibility.find({
      user: userId,
      organization: organizationId,
      canView: true,
    }).select("task canComment canViewAttachments canViewFormData");

    if (!visibilityGrants.length) return [];

    const taskIds = visibilityGrants.map((v) => v.task);
    const tasks = await Task.find({
      _id: { $in: taskIds },
      isDeleted: { $ne: true },
    }).populate("assignedTo createdBy", "name email avatar");

    // Attach visibility permissions and isReadOnly flag to each task
    return tasks.map((task) => {
      const grant = visibilityGrants.find(
        (v) => v.task.toString() === task._id.toString(),
      );
      return {
        ...task.toObject(),
        isReadOnly: true,
        visibilityPermissions: {
          canComment: grant?.canComment ?? false,
          canViewAttachments: grant?.canViewAttachments ?? false,
          canViewFormData: grant?.canViewFormData ?? false,
        },
      };
    });
  }
}

export const VisibilityService = new VisibilityServiceClass();
