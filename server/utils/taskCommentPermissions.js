/**
 * Task Comment Permissions Module (Backend)
 * Based on Tasksetu PRD - Role-based Access Control for Comments
 * 
 * This module validates comment permissions on the server side
 * based on roles, collaborator status, contributor status, and mention status.
 */

/**
 * Base Comment Permissions by Role
 */
const ROLE_COMMENT_PERMISSIONS = {
  // Admin/Super Admin roles - Full access
  'tasksetu-admin': {
    canView: true,
    canAdd: true,
    canEdit: true,
    canDelete: true,
    canModerate: true,
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

  // Manager - Team task access
  'manager': {
    canView: true,
    canAdd: true,
    canEdit: true,
    canDelete: true,
    canModerate: false,
    canMention: true,
    canAttachFiles: true
  },

  // Employee/Regular User
  'employee': {
    canView: true,
    canAdd: false,
    canEdit: true,
    canDelete: true,
    canModerate: false,
    canMention: false,
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
    canAdd: false,
    canEdit: true,
    canDelete: true,
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
 * Check if user is task creator
 * @param {string} userId - User ID
 * @param {Object} task - Task object
 * @returns {boolean}
 */
const isTaskCreator = (userId, task) => {
  if (!userId || !task) return false;

  const normalizedUserId = userId.toString?.() || userId;
  const creatorId = task.creatorId?.toString?.() || task.creatorId || 
                    task.createdBy?._id?.toString?.() || task.createdBy?._id;

  return normalizedUserId === creatorId;
};

/**
 * Check if user is task assignee
 * @param {string} userId - User ID
 * @param {Object} task - Task object
 * @returns {boolean}
 */
const isTaskAssignee = (userId, task) => {
  if (!userId || !task) return false;

  const normalizedUserId = userId.toString?.() || userId;
  const assigneeId = task.assigneeId?.toString?.() || task.assigneeId;

  return normalizedUserId === assigneeId;
};

/**
 * Check if user is task collaborator
 * @param {string} userId - User ID
 * @param {Object} task - Task object
 * @returns {boolean}
 */
const isTaskCollaborator = (userId, task) => {
  if (!userId || !task || !task.collaborators) return false;

  const normalizedUserId = userId.toString?.() || userId;

  return task.collaborators.some(collaborator => {
    const cId = collaborator.toString?.() || collaborator?._id?.toString?.() || collaborator;
    return cId === normalizedUserId;
  });
};

/**
 * Check if user is task contributor
 * @param {string} userId - User ID
 * @param {Object} task - Task object
 * @returns {boolean}
 */
const isTaskContributor = (userId, task) => {
  if (!userId || !task || !task.contributors) return false;

  const normalizedUserId = userId.toString?.() || userId;

  return task.contributors.some(contributor => {
    const cId = contributor.toString?.() || contributor?._id?.toString?.() || contributor;
    return cId === normalizedUserId;
  });
};

/**
 * Check if user is mentioned in task comments
 * @param {string} userId - User ID
 * @param {Object} task - Task object
 * @returns {boolean}
 */
const isUserMentioned = (userId, task) => {
  if (!userId || !task || !task.comments) return false;

  const normalizedUserId = userId.toString?.() || userId;

  // Check main comments
  const mentionedInComments = task.comments.some(comment => {
    if (!comment.mentions) return false;
    return comment.mentions.some(mention => {
      const mentionId = mention.toString?.() || mention?.id?.toString?.() || mention;
      return mentionId === normalizedUserId;
    });
  });

  if (mentionedInComments) return true;

  // Check replies
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
 * Get base permissions for a role
 * @param {string|string[]} userRole - User role(s)
 * @returns {Object} - Base permission object
 */
const getBasePermissions = (userRole) => {
  const roles = Array.isArray(userRole) ? userRole : [userRole];

  // Check for highest privilege role first
  for (const role of roles) {
    if (ROLE_COMMENT_PERMISSIONS[role]) {
      return ROLE_COMMENT_PERMISSIONS[role];
    }
  }

  // Default to most restrictive
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
 * Check comment permissions based on role and task context
 * Used by backend API to validate comment operations
 * 
 * @param {string|string[]} userRole - User's role(s)
 * @param {Object} task - Task object with collaborators, contributors, comments
 * @param {string} userId - User's ID
 * @returns {Object} - Permission object
 */
const checkCommentPermissions = (userRole, task, userId) => {
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
  const basePermissions = getBasePermissions(userRole);
  const roles = Array.isArray(userRole) ? userRole : [userRole];

  // Admin/Super Admin always have full access
  const isAdmin = roles.some(r => 
    ['admin', 'org_admin', 'company-admin', 'tasksetu-admin', 'super-admin', 'super_admin'].includes(r)
  );

  if (isAdmin) {
    return {
      canView: true,
      canAdd: true,
      canEdit: true,
      canDelete: true,
      canModerate: true,
      canMention: true,
      canAttachFiles: true
    };
  }

  // Check task context
  const creator = isTaskCreator(userId, task);
  const assignee = isTaskAssignee(userId, task);
  const collaborator = isTaskCollaborator(userId, task);
  const contributor = isTaskContributor(userId, task);
  const mentioned = isUserMentioned(userId, task);
  const isManager = roles.includes('manager');

  // Task creator has full access
  if (creator) {
    return {
      canView: true,
      canAdd: true,
      canEdit: true,
      canDelete: true,
      canModerate: false,
      canMention: true,
      canAttachFiles: true
    };
  }

  // Manager can comment on any task
  if (isManager) {
    return {
      canView: true,
      canAdd: true,
      canEdit: true,
      canDelete: true,
      canModerate: false,
      canMention: true,
      canAttachFiles: true
    };
  }

  // Assignee, collaborator, contributor, or mentioned user can add comments
  if (assignee || collaborator || contributor || mentioned) {
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

  // Default: view only
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
 * Get permission reason for logging/debugging
 * @param {string|string[]} userRole - User's role(s)
 * @param {Object} task - Task object
 * @param {string} userId - User's ID
 * @returns {string} - Reason for permission grant/denial
 */
const getPermissionReason = (userRole, task, userId) => {
  const roles = Array.isArray(userRole) ? userRole : [userRole];

  // Check admin
  if (roles.some(r => ['admin', 'org_admin', 'company-admin', 'tasksetu-admin', 'super-admin', 'super_admin'].includes(r))) {
    return 'Admin user has full access';
  }

  // Check creator
  if (isTaskCreator(userId, task)) {
    return 'User is task creator';
  }

  // Check manager
  if (roles.includes('manager')) {
    return 'Manager has team task access';
  }

  // Check assignee
  if (isTaskAssignee(userId, task)) {
    return 'User is task assignee';
  }

  // Check collaborator
  if (isTaskCollaborator(userId, task)) {
    return 'User is task collaborator';
  }

  // Check contributor
  if (isTaskContributor(userId, task)) {
    return 'User is task contributor';
  }

  // Check mentioned
  if (isUserMentioned(userId, task)) {
    return 'User is mentioned in task comments';
  }

  return 'User has no specific task access';
};

module.exports = {
  ROLE_COMMENT_PERMISSIONS,
  isTaskCreator,
  isTaskAssignee,
  isTaskCollaborator,
  isTaskContributor,
  isUserMentioned,
  getBasePermissions,
  checkCommentPermissions,
  getPermissionReason
};
