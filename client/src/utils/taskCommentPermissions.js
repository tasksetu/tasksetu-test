/**
 * Task Comment Permissions Module (Frontend)
 * Based on Tasksetu PRD - Role-based Access Control for Comments
 * 
 * This module defines who can view, add, edit, and delete comments on tasks
 * based on roles, collaborator status, contributor status, and mention status.
 */

/**
 * Comment Permission Matrix
 * Determines what actions users can perform on task comments
 */
export const COMMENT_PERMISSION_MATRIX = {
  // Admin/Super Admin - Full access to all comments
  'tasksetu-admin': {
    canView: true,
    canAdd: true,
    canEdit: true,       // Can edit any comment
    canDelete: true,     // Can delete any comment
    canModerate: true,   // Can moderate (delete others' comments)
    canMention: true,
    canAttachFiles: true
  },
  'super-admin': {
    canView: true,
    canAdd: true,
    canEdit: true,
    canDelete: true,
    canModerate: true,
    canMention: true,
    canAttachFiles: true
  },
  'super_admin': {
    canView: true,
    canAdd: true,
    canEdit: true,
    canDelete: true,
    canModerate: true,
    canMention: true,
    canAttachFiles: true
  },
  'org_admin': {
    canView: true,
    canAdd: true,
    canEdit: true,
    canDelete: true,
    canModerate: true,
    canMention: true,
    canAttachFiles: true
  },
  'admin': {
    canView: true,
    canAdd: true,
    canEdit: true,
    canDelete: true,
    canModerate: true,
    canMention: true,
    canAttachFiles: true
  },
  'company-admin': {
    canView: true,
    canAdd: true,
    canEdit: true,
    canDelete: true,
    canModerate: true,
    canMention: true,
    canAttachFiles: true
  },

  // Manager - Can comment and moderate on team tasks
  'manager': {
    canView: true,
    canAdd: true,
    canEdit: true,       // Can edit own comments
    canDelete: true,     // Can delete own comments
    canModerate: false,  // Cannot moderate others' comments
    canMention: true,
    canAttachFiles: true
  },

  // Employee/Normal User - Limited access
  'employee': {
    canView: true,
    canAdd: false,       // Depends on task assignment/collaboration
    canEdit: true,       // Can edit own comments
    canDelete: true,     // Can delete own comments
    canModerate: false,
    canMention: false,   // Depends on task collaboration
    canAttachFiles: false
  },
  'user': {
    canView: true,
    canAdd: false,
    canEdit: true,
    canDelete: true,
    canModerate: false,
    canMention: false,
    canAttachFiles: false
  },
  'company-user': {
    canView: true,
    canAdd: false,
    canEdit: true,
    canDelete: true,
    canModerate: false,
    canMention: false,
    canAttachFiles: false
  },
  'normal-user': {
    canView: true,
    canAdd: false,
    canEdit: true,
    canDelete: true,
    canModerate: false,
    canMention: false,
    canAttachFiles: false
  },

  // Individual User - Most restricted
  'individual': {
    canView: true,
    canAdd: false,       // Depends on collaboration
    canEdit: true,       // Can edit own comments
    canDelete: true,     // Can delete own comments
    canModerate: false,
    canMention: false,
    canAttachFiles: false
  },
  'individual-user': {
    canView: true,
    canAdd: false,
    canEdit: true,
    canDelete: true,
    canModerate: false,
    canMention: false,
    canAttachFiles: false
  }
};

/**
 * Task-specific Permission Modifiers
 * These enhance base role permissions based on task context
 */
export const TASK_CONTEXT_MODIFIERS = {
  // User is task creator/owner
  isTaskCreator: {
    canView: true,
    canAdd: true,
    canEdit: true,
    canDelete: true,
    canModerate: false,
    canMention: true,
    canAttachFiles: true
  },

  // User is task assignee
  isTaskAssignee: {
    canView: true,
    canAdd: true,
    canEdit: true,
    canDelete: false,
    canModerate: false,
    canMention: true,
    canAttachFiles: true
  },

  // User is task collaborator (explicitly added)
  isTaskCollaborator: {
    canView: true,
    canAdd: true,
    canEdit: true,
    canDelete: false,
    canModerate: false,
    canMention: true,
    canAttachFiles: true
  },

  // User is task contributor (may have contributed)
  isTaskContributor: {
    canView: true,
    canAdd: true,
    canEdit: true,
    canDelete: false,
    canModerate: false,
    canMention: true,
    canAttachFiles: true
  },

  // User is mentioned in task comments
  isUserMentioned: {
    canView: true,
    canAdd: true,
    canEdit: true,
    canDelete: false,
    canModerate: false,
    canMention: true,
    canAttachFiles: true
  }
};

/**
 * Check if user has comment permission based on role and task context
 * @param {string} userRole - User's role
 * @param {Object} task - Task object with collaborators, contributors, comments
 * @param {string} userId - User's ID
 * @returns {Object} - Permission object with canAdd, canEdit, canDelete, etc.
 */
export const getCommentPermissions = (userRole, task, userId) => {
  if (!userRole || !task || !userId) {
    return {
      canView: true,
      canAdd: false,
      canEdit: false,
      canDelete: false,
      canModerate: false,
      canMention: false,
      canAttachFiles: false
    };
  }

  // Get base permissions from role
  const basePermissions = COMMENT_PERMISSION_MATRIX[userRole] || {
    canView: true,
    canAdd: false,
    canEdit: true,
    canDelete: true,
    canModerate: false,
    canMention: false,
    canAttachFiles: false
  };

  // Normalize user ID
  const normalizedUserId = userId.toString?.() || userId;
  
  // Check task context modifiers
  const isCreator = normalizedUserId === (task.creatorId?.toString?.() || task.creatorId || task.createdBy?._id?.toString?.() || task.createdBy?._id);
  const isAssignee = normalizedUserId === (task.assigneeId?.toString?.() || task.assigneeId);
  
  const isCollaborator = task.collaborators?.some(c => {
    const cId = c.toString?.() || c?._id?.toString?.() || c;
    return cId === normalizedUserId;
  });

  const isContributor = task.contributors?.some(c => {
    const cId = c.toString?.() || c?._id?.toString?.() || c;
    return cId === normalizedUserId;
  });

  const isMentioned = task.comments?.some(comment => {
    const mentions = comment.mentions || [];
    return mentions.some(m => {
      const mId = m.toString?.() || m?.id?.toString?.() || m;
      return mId === normalizedUserId;
    });
  }) || (task.comments?.some(comment => 
    comment.replies?.some(reply => 
      reply.mentions?.some(m => {
        const mId = m.toString?.() || m?.id?.toString?.() || m;
        return mId === normalizedUserId;
      })
    )
  ));

  // Check if user is admin/manager/creator - they can always comment
  const isHighPrivilege = ['admin', 'org_admin', 'company-admin', 'tasksetu-admin', 'super-admin', 'super_admin'].includes(userRole) || isCreator;
  
  if (isHighPrivilege) {
    return {
      canView: true,
      canAdd: true,
      canEdit: true,
      canDelete: true,
      canModerate: !isCreator, // Creators can't moderate (delete others)
      canMention: true,
      canAttachFiles: true
    };
  }

  // For employees and regular users, check if they have any context access
  const hasContextAccess = isAssignee || isCollaborator || isContributor || isMentioned;

  if (hasContextAccess) {
    return {
      canView: true,
      canAdd: true,
      canEdit: true,
      canDelete: false,
      canModerate: false,
      canMention: true,
      canAttachFiles: true
    };
  }

  // No permission
  return {
    canView: true,
    canAdd: false,
    canEdit: false,
    canDelete: false,
    canModerate: false,
    canMention: false,
    canAttachFiles: false
  };
};

/**
 * Check if user is mentioned in task comments
 * @param {string} userId - User's ID to check
 * @param {Object} task - Task with comments array
 * @returns {boolean}
 */
export const isUserMentionedInTask = (userId, task) => {
  if (!userId || !task || !task.comments) return false;

  const normalizedUserId = userId.toString?.() || userId;

  // Check mentions in main comments
  const mentionedInComments = task.comments.some(comment => {
    if (!comment.mentions) return false;
    return comment.mentions.some(mention => {
      const mentionId = mention.toString?.() || mention?.id?.toString?.() || mention;
      return mentionId === normalizedUserId;
    });
  });

  if (mentionedInComments) return true;

  // Check mentions in replies
  const mentionedInReplies = task.comments.some(comment => {
    if (!comment.replies) return false;
    return comment.replies.some(reply => {
      if (!reply.mentions) return false;
      return reply.mentions.some(mention => {
        const mentionId = mention.toString?.() || mention?.id?.toString?.() || mention;
        return mentionId === normalizedUserId;
      });
    });
  });

  return mentionedInReplies;
};

/**
 * Check if user is a collaborator on the task
 * @param {string} userId - User's ID to check
 * @param {Object} task - Task object
 * @returns {boolean}
 */
export const isUserCollaborator = (userId, task) => {
  if (!userId || !task || !task.collaborators) return false;

  const normalizedUserId = userId.toString?.() || userId;
  
  return task.collaborators.some(collaborator => {
    const cId = collaborator.toString?.() || collaborator?._id?.toString?.() || collaborator;
    return cId === normalizedUserId;
  });
};

/**
 * Check if user is a contributor on the task
 * @param {string} userId - User's ID to check
 * @param {Object} task - Task object
 * @returns {boolean}
 */
export const isUserContributor = (userId, task) => {
  if (!userId || !task || !task.contributors) return false;

  const normalizedUserId = userId.toString?.() || userId;
  
  return task.contributors.some(contributor => {
    const cId = contributor.toString?.() || contributor?._id?.toString?.() || contributor;
    return cId === normalizedUserId;
  });
};

/**
 * Get detailed permission reason/explanation
 * @param {string} userRole - User's role
 * @param {Object} task - Task object
 * @param {string} userId - User's ID
 * @returns {Object} - { hasAccess: boolean, reason: string }
 */
export const getPermissionReason = (userRole, task, userId) => {
  const normalizedUserId = userId.toString?.() || userId;

  // Check privilege levels
  if (['admin', 'org_admin', 'company-admin', 'tasksetu-admin', 'super-admin', 'super_admin'].includes(userRole)) {
    return {
      hasAccess: true,
      reason: `${userRole} users have full access to all tasks`
    };
  }

  // Check if creator
  const isCreator = normalizedUserId === (task.creatorId?.toString?.() || task.creatorId || task.createdBy?._id?.toString?.() || task.createdBy?._id);
  if (isCreator) {
    return {
      hasAccess: true,
      reason: 'You are the task creator'
    };
  }

  // Check if assignee
  const isAssignee = normalizedUserId === (task.assigneeId?.toString?.() || task.assigneeId);
  if (isAssignee) {
    return {
      hasAccess: true,
      reason: 'You are the task assignee'
    };
  }

  // Check collaborators
  if (isUserCollaborator(userId, task)) {
    return {
      hasAccess: true,
      reason: 'You are added as a task collaborator'
    };
  }

  // Check contributors
  if (isUserContributor(userId, task)) {
    return {
      hasAccess: true,
      reason: 'You are a task contributor'
    };
  }

  // Check mentions
  if (isUserMentionedInTask(userId, task)) {
    return {
      hasAccess: true,
      reason: 'You are mentioned in task comments'
    };
  }

  // Check manager access
  if (userRole === 'manager') {
    return {
      hasAccess: true,
      reason: 'Managers can comment on team tasks'
    };
  }

  return {
    hasAccess: false,
    reason: 'You do not have permission to comment on this task'
  };
};

export default {
  COMMENT_PERMISSION_MATRIX,
  TASK_CONTEXT_MODIFIERS,
  getCommentPermissions,
  isUserMentionedInTask,
  isUserCollaborator,
  isUserContributor,
  getPermissionReason
};
