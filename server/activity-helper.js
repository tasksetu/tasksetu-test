import mongoose from "mongoose";

// Activity Helper Functions for comprehensive tracking
export class ActivityHelper {

  // Activity type constants with icons
  static ACTIVITY_TYPES = {
    // Task activities
    TASK_CREATED: { type: 'task_created', icon: '➕', category: 'task' },
    TASK_UPDATED: { type: 'task_updated', icon: '✏️', category: 'task' },
    TASK_DELETED: { type: 'task_deleted', icon: '🗑️', category: 'task' },
    TASK_STATUS_CHANGED: { type: 'task_status_changed', icon: '🔄', category: 'task' },
    STATUS_CHANGED: { type: 'status_changed', icon: '🔄', category: 'task' },
    FIELD_UPDATED: { type: 'field_updated', icon: '✏️', category: 'task' },
    TASK_PRIORITY_CHANGED: { type: 'task_priority_changed', icon: '⚡', category: 'task' },
    TASK_ASSIGNED: { type: 'task_assigned', icon: '👤', category: 'task' },
    TASK_UNASSIGNED: { type: 'task_unassigned', icon: '❌', category: 'task' },
    TASK_DUE_DATE_CHANGED: { type: 'task_due_date_changed', icon: '📅', category: 'task' },
    TASK_TIME_ESTIMATE_CHANGED: { type: 'task_time_estimate_changed', icon: '⏱️', category: 'task' },
    TASK_COMPLETED: { type: 'task_completed', icon: '✅', category: 'task' },
    TASK_REOPENED: { type: 'task_reopened', icon: '🔓', category: 'task' },
    TASK_SNOOZED: { type: 'task_snoozed', icon: '⏰', category: 'task' },
    TASK_UNSNOOZED: { type: 'task_unsnoozed', icon: '🔔', category: 'task' },
    TASK_RISK_MARKED: { type: 'task_risk_marked', icon: '⚠️', category: 'task' },
    TASK_RISK_MITIGATED: { type: 'task_risk_mitigated', icon: '✅', category: 'task' },

    // Subtask activities
    SUBTASK_CREATED: { type: 'subtask_created', icon: '📝', category: 'subtask' },
    SUBTASK_ADDED: { type: 'subtask_added', icon: '➕', category: 'subtask' },
    SUBTASK_UPDATED: { type: 'subtask_updated', icon: '✏️', category: 'subtask' },
    SUBTASK_DELETED: { type: 'subtask_deleted', icon: '🗑️', category: 'subtask' },
    SUBTASK_COMPLETED: { type: 'subtask_completed', icon: '✅', category: 'subtask' },
    SUBTASK_STATUS_CHANGED: { type: 'subtask_status_changed', icon: '🔄', category: 'subtask' },

    // Comment activities
    COMMENT_ADDED: { type: 'comment_added', icon: '💬', category: 'comment' },
    COMMENT_REPLIED: { type: 'comment_replied', icon: '↩️', category: 'comment' },
    COMMENT_UPDATED: { type: 'comment_updated', icon: '✏️', category: 'comment' },
    COMMENT_DELETED: { type: 'comment_deleted', icon: '🗑️', category: 'comment' },

    // Approval activities
    APPROVAL_REQUESTED: { type: 'approval_requested', icon: '🔍', category: 'approval' },
    APPROVAL_APPROVED: { type: 'approval_approved', icon: '✅', category: 'approval' },
    APPROVAL_REJECTED: { type: 'approval_rejected', icon: '❌', category: 'approval' },

    // File activities
    FILE_ATTACHED: { type: 'file_attached', icon: '📎', category: 'file' },
    FILE_REMOVED: { type: 'file_removed', icon: '🗑️', category: 'file' },

    // Project activities
    PROJECT_CREATED: { type: 'project_created', icon: '📁', category: 'project' },
    PROJECT_UPDATED: { type: 'project_updated', icon: '✏️', category: 'project' },
    PROJECT_ARCHIVED: { type: 'project_archived', icon: '📦', category: 'project' },

    // User activities
    USER_JOINED: { type: 'user_joined', icon: '👋', category: 'user' },
    USER_LEFT: { type: 'user_left', icon: '👋', category: 'user' },
    ROLE_CHANGED: { type: 'role_changed', icon: '🔑', category: 'user' }
  };

  /**
   * Generate activity description based on type and data
   */
  static generateDescription(activityType, data = {}) {
    const { taskTitle, oldValue, newValue, userName, assignedTo, comment, fileName } = data;

    switch (activityType.type) {
      case 'task_created':
        return `Task "${taskTitle}" was created`;

      case 'task_updated':
        // Show specific fields that were updated
        if (data.changes && data.changes.length > 0) {
          const fieldNames = data.changes.map(c => c.field).join(', ');
          return `Task "${taskTitle}" ${fieldNames} updated`;
        }
        return `Task "${taskTitle}" was updated`;

      case 'task_deleted':
        return `Task "${taskTitle}" was deleted`;

      case 'task_status_changed':
      case 'status_changed':
        return `Task "${taskTitle}" status changed from "${oldValue}" to "${newValue}"`;

      case 'field_updated':
        const fields = data.changedFields?.join(', ') || 'fields';
        return `Task "${taskTitle}" was updated (${fields})`;

      case 'task_priority_changed':
        return `Task "${taskTitle}" priority changed from "${oldValue}" to "${newValue}"`;

      case 'task_assigned':
        return `Task "${taskTitle}" was assigned to ${assignedTo}`;

      case 'task_unassigned':
        return `Task "${taskTitle}" was unassigned from ${assignedTo}`;

      case 'task_due_date_changed':
        return `Task "${taskTitle}" due date changed to ${newValue}`;

      case 'task_time_estimate_changed':
        return `Task "${taskTitle}" estimate changed from ${oldValue} hours to ${newValue} hours`;

      case 'task_completed':
        return `Task "${taskTitle}" was marked as completed`;

      case 'task_reopened':
        return `Task "${taskTitle}" was reopened`;

      case 'task_snoozed':
        return `Task "${taskTitle}" was snoozed until ${newValue}`;

      case 'task_unsnoozed':
        return `Task "${taskTitle}" woke up from snooze`;

      case 'task_risk_marked':
        if (data.riskReason) {
          return `Task "${taskTitle}" was marked as risk - Reason: ${data.riskReason}`;
        }
        return `Task "${taskTitle}" was marked as risk`;

      case 'task_risk_mitigated':
        if (data.mitigationReason) {
          return `Task "${taskTitle}" risk was mitigated - Reason: ${data.mitigationReason}`;
        }
        return `Task "${taskTitle}" risk was mitigated`;

      case 'subtask_created':
      case 'subtask_added':
        return `Subtask "${data.subtaskTitle}" was created in task "${taskTitle}"`;

      case 'subtask_updated':
        return `Subtask "${data.subtaskTitle}" was updated in task "${taskTitle}"`;

      case 'subtask_deleted':
        return `Subtask "${data.subtaskTitle}" was deleted from task "${taskTitle}"`;

      case 'subtask_completed':
        return `Subtask "${data.subtaskTitle}" was completed in task "${taskTitle}"`;

      case 'subtask_status_changed':
        return `Subtask "${data.subtaskTitle}" status changed from "${oldValue}" to "${newValue}"`;

      case 'comment_added':
        if (data.subtaskId) {
          return `Comment was added to subtask "${data.subtaskTitle}" in task "${taskTitle}"`;
        }
        return `Comment was added to task "${taskTitle}"`;

      case 'comment_replied':
        if (data.subtaskId) {
          return `Replied to a comment on subtask "${data.subtaskTitle}"`;
        }
        return `Replied to a comment on task "${taskTitle}"`;

      case 'comment_updated':
        if (data.subtaskId) {
          return `Comment was updated in subtask "${data.subtaskTitle}"`;
        }
        return `Comment was updated in task "${taskTitle}"`;

      case 'comment_deleted':
        if (data.subtaskId) {
          return `Comment was deleted from subtask "${data.subtaskTitle}"`;
        }
        return `Comment was deleted from task "${taskTitle}"`;

      case 'approval_requested':
        return `Approval was requested for task "${taskTitle}"`;

      case 'approval_approved':
        return `Task "${taskTitle}" was approved`;

      case 'approval_rejected':
        return `Task "${taskTitle}" approval was rejected`;

      case 'file_attached':
        return `File "${fileName}" was attached to task "${taskTitle}"`;

      case 'file_removed':
        return `File "${fileName}" was removed from task "${taskTitle}"`;

      case 'project_created':
        return `Project "${data.projectName}" was created`;

      case 'project_updated':
        return `Project "${data.projectName}" was updated`;

      case 'project_archived':
        return `Project "${data.projectName}" was archived`;

      case 'user_joined':
        return `${userName} joined the organization`;

      case 'user_left':
        return `${userName} left the organization`;

      case 'role_changed':
        return `${userName} role changed from "${oldValue}" to "${newValue}"`;

      default:
        return `Activity performed on ${data.entityType || 'item'}`;
    }
  }

  /**
   * Create activity data object
   */
  static createActivityData({
    activityType,
    userId,
    organizationId,
    relatedId,
    relatedType,
    data = {}
  }) {
    console.log('🏗️ [ACTIVITY HELPER] Creating activity data:', {
      activityType,
      userId,
      organizationId,
      relatedId,
      relatedType,
      data
    });

    const description = this.generateDescription(activityType, data);

    console.log('📝 [ACTIVITY HELPER] Generated description:', description);

    const activityData = {
      type: activityType.type,
      description,
      user: userId,
      organization: organizationId,
      relatedId,
      relatedType: relatedType?.toLowerCase() || 'task',
      metadata: {
        icon: activityType.icon,
        category: activityType.category,
        data,
        timestamp: new Date()
      }
    };

    console.log('✅ [ACTIVITY HELPER] Final activity data:', JSON.stringify(activityData, null, 2));

    return activityData;
  }

  /**
   * Format activity for display in feed
   */
  static formatActivityForFeed(activity, user = null) {
    return {
      id: activity._id,
      type: activity.type,
      description: activity.description,
      icon: activity.metadata?.icon || '📝',
      category: activity.metadata?.category || 'general',
      user: user ? {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar
      } : null,
      timestamp: activity.createdAt,
      relatedId: activity.relatedId,
      relatedType: activity.relatedType,
      metadata: activity.metadata || {}
    };
  }

  /**
   * Get activity type by string
   */
  static getActivityType(typeString) {
    return Object.values(this.ACTIVITY_TYPES).find(type => type.type === typeString);
  }

  /**
   * Create comparison data for update activities
   */
  static createComparisonData(oldData, newData, fields = []) {
    const changes = [];

    for (const field of fields) {
      if (oldData[field] !== newData[field] && newData[field] !== undefined) {
        changes.push({
          field: field,
          oldValue: oldData[field],
          newValue: newData[field]
        });
      }
    }

    return changes;
  }

  /**
   * Directly log an activity to the database
   * Fixes broken calls in taskController.js and other controllers
   */
  static async logActivity(params) {
    try {
      const Activity = mongoose.model("Activity");

      // Map params to schema
      const activityData = {
        type: params.type || params.activityType?.type,
        description: params.description || (params.activityType ? this.generateDescription(params.activityType, params.data) : 'Activity performed'),
        user: params.user || params.userId,
        organization: params.organization || params.organizationId,
        relatedId: params.relatedId || params.task || params.taskId,
        relatedType: (params.relatedType || 'task').toLowerCase(),
        metadata: {
          icon: params.metadata?.icon || params.activityType?.icon || '📝',
          category: params.metadata?.category || params.activityType?.category || 'general',
          data: params.data || params.metadata || {},
          timestamp: new Date()
        }
      };

      console.log('📝 [ACTIVITY HELPER] logActivity derived data:', JSON.stringify(activityData, null, 2));

      const activity = new Activity(activityData);
      const saved = await activity.save();

      console.log('✅ [ACTIVITY HELPER] Activity saved via logActivity:', saved._id);
      return saved;
    } catch (error) {
      console.error('❌ [ACTIVITY HELPER] logActivity failed:', error);
      // We don't throw to avoid breaking the main flow, similar to trackActivity
      return null;
    }
  }
}

export default ActivityHelper;