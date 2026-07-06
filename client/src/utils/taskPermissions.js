/**
 * Task Creation Permissions Module
 * Based on Tasksetu PRD Document - Role-based Access Control
 * 
 * This module defines which roles can create which task types
 * and whom they can assign tasks to.
 */

/**
 * Role Definitions (as per PRD document):
 * 1. individual-user / individual: Personal user, can only create tasks for self
 * 2. company-user / employee: Company employee, Phase I restrictions apply
 * 3. manager: Can manage team tasks
 * 4. company-admin / org_admin / admin: Full organization access
 * 5. tasksetu-admin / super-admin: Platform-wide access
 */

/**
 * Task Type Permissions Matrix
 * Based on PRD Sections: Task Management, Recurring Tasks, Milestone, Approval Workflow
 */
export const TASK_TYPE_PERMISSIONS = {
  // Individual User - Most restricted
  'individual-user': {
    canCreate: {
      regular: true,      // Can create regular tasks
      recurring: true,    // Can create recurring tasks
      milestone: false,   // Cannot create milestones
      approval: false,    // Cannot create approval tasks
      quick: true         // Can create quick tasks
    },
    canAssignToOthers: false,
    assignmentScope: 'self-only',
    description: 'Individual users can only assign tasks to themselves'
  },

  // Individual (alias for individual-user)
  'individual': {
    canCreate: {
      regular: true,      // Can create regular tasks
      recurring: true,    // Can create recurring tasks
      milestone: true,    // ✅ Can create milestones (ENABLED)
      approval: false,    // Cannot create approval tasks
      quick: true         // Can create quick tasks
    },
    canAssignToOthers: false,
    assignmentScope: 'self-only',
    description: 'Individual users can only assign tasks to themselves'
  },

  // Member (alias for individual-user)
  'member': {
    canCreate: {
      regular: true,      // Can create regular tasks
      recurring: true,    // Can create recurring tasks
      milestone: true,    // ✅ Can create milestones (ENABLED)
      approval: false,    // Cannot create approval tasks
      quick: true         // Can create quick tasks
    },
    canAssignToOthers: false,
    assignmentScope: 'self-only',
    description: 'Individual users can only assign tasks to themselves'
  },

  // Company User (Employee) - Phase I Restrictions
  'company-user': {
    canCreate: {
      regular: true,      // Can create regular tasks
      recurring: true,    // Can create recurring tasks (Phase I: self-assign only)
      milestone: true,    // ✅ Can create milestones (ENABLED)
      approval: true,     // ✅ Can create approval workflows (ENABLED)
      quick: true         // Can create quick tasks
    },
    canAssignToOthers: false, // Phase I restriction
    assignmentScope: 'self-only',
    description: 'Phase I: Company users can assign to self only. Future: can assign to peers.'
  },

  // Employee (alias for company-user)
  'employee': {
    canCreate: {
      regular: true,
      recurring: true,
      milestone: true,    // ✅ Can create milestones (ENABLED)
      approval: true,     // ✅ Can create approval workflows (ENABLED)
      quick: true
    },
    canAssignToOthers: false,
    assignmentScope: 'self-only',
    description: 'Phase I: Employees can assign to self only'
  },

  // Org Member (alias for company-user)
  'org_member': {
    canCreate: {
      regular: true,
      recurring: true,
      milestone: true,    // ✅ Can create milestones (ENABLED)
      approval: true,     // ✅ Can create approval workflows (ENABLED)
      quick: true
    },
    canAssignToOthers: false,
    assignmentScope: 'self-only',
    description: 'Phase I: Organization members can assign to self only'
  },

  // Manager - Team Management Permissions
  'manager': {
    canCreate: {
      regular: true,      // Can create all task types
      recurring: true,    // Can create recurring tasks
      milestone: true,    // Can create milestones
      approval: true,     // Can create approval workflows
      quick: true         // Can create quick tasks
    },
    canAssignToOthers: true,
    assignmentScope: 'team',
    description: 'Managers can assign to self + team members (subordinates)'
  },

  // Company Admin - Full Organization Access
  'company-admin': {
    canCreate: {
      regular: true,
      recurring: true,
      milestone: true,
      approval: true,
      quick: true
    },
    canAssignToOthers: true,
    assignmentScope: 'organization',
    description: 'Company admins can assign to anyone in organization'
  },

  // Organization Admin (alias for company-admin)
  'org_admin': {
    canCreate: {
      regular: true,
      recurring: true,
      milestone: true,
      approval: true,
      quick: true
    },
    canAssignToOthers: true,
    assignmentScope: 'organization',
    description: 'Organization admins have full access'
  },

  // Admin (alias for company-admin)
  'admin': {
    canCreate: {
      regular: true,
      recurring: true,
      milestone: true,
      approval: true,
      quick: true
    },
    canAssignToOthers: true,
    assignmentScope: 'organization',
    description: 'Admins have full organization access'
  },

  // Tasksetu Super Admin - Platform-wide Access
  'tasksetu-admin': {
    canCreate: {
      regular: true,
      recurring: true,
      milestone: true,
      approval: true,
      quick: true
    },
    canAssignToOthers: true,
    assignmentScope: 'platform',
    description: 'Tasksetu admins can assign to anyone across all companies'
  },

  // Super Admin (alias for tasksetu-admin)
  'super-admin': {
    canCreate: {
      regular: true,
      recurring: true,
      milestone: true,
      approval: true,
      quick: true
    },
    canAssignToOthers: true,
    assignmentScope: 'platform',
    description: 'Super admins have platform-wide access'
  },

  // Super_Admin (alias for tasksetu-admin)
  'super_admin': {
    canCreate: {
      regular: true,
      recurring: true,
      milestone: true,
      approval: true,
      quick: true
    },
    canAssignToOthers: true,
    assignmentScope: 'platform',
    description: 'Super admins have platform-wide access'
  }
};

/**
 * Check if a role can create a specific task type
 * @param {string} role - User's role
 * @param {string} taskType - Type of task (regular, recurring, milestone, approval, quick)
 * @returns {boolean}
 */
export const canCreateTaskType = (role, taskType) => {
  if (!role || !taskType) return false;

  const permissions = TASK_TYPE_PERMISSIONS[role];
  if (!permissions) {
    console.warn(`Unknown role: ${role}. Defaulting to most restrictive permissions.`);
    return false;
  }

  return permissions.canCreate[taskType] || false;
};

/**
 * Check if a role can assign tasks to others
 * @param {string} role - User's role
 * @returns {boolean}
 */
export const canAssignToOthers = (role) => {
  if (!role) return false;

  const permissions = TASK_TYPE_PERMISSIONS[role];
  if (!permissions) return false;

  return permissions.canAssignToOthers;
};

/**
 * Get assignment scope for a role
 * @param {string} role - User's role
 * @returns {string} - 'self-only', 'team', 'organization', or 'platform'
 */
export const getAssignmentScope = (role) => {
  if (!role) return 'self-only';

  const permissions = TASK_TYPE_PERMISSIONS[role];
  if (!permissions) return 'self-only';

  return permissions.assignmentScope;
};

/**
 * Get all allowed task types for a role
 * @param {string} role - User's role
 * @returns {string[]} - Array of allowed task types
 */
export const getAllowedTaskTypes = (role) => {
  if (!role) return ['regular']; // Default to most restrictive

  const permissions = TASK_TYPE_PERMISSIONS[role];
  if (!permissions) return ['regular'];

  return Object.keys(permissions.canCreate).filter(
    taskType => permissions.canCreate[taskType]
  );
};

/**
 * Get permission description for a role
 * @param {string} role - User's role
 * @returns {string}
 */
export const getPermissionDescription = (role) => {
  if (!role) return 'No permissions defined';

  const permissions = TASK_TYPE_PERMISSIONS[role];
  if (!permissions) return 'Unknown role';

  return permissions.description;
};

/**
 * Get restriction message for task creation
 * @param {string} role - User's role
 * @param {string} taskType - Type of task
 * @returns {string|null} - Restriction message or null if allowed
 */
export const getRestrictionMessage = (role, taskType) => {
  if (canCreateTaskType(role, taskType)) {
    return null; // No restriction
  }

  // Specific restriction messages based on PRD
  const messages = {
    'individual-user': {
      milestone: 'Individual users cannot create milestones. Contact your manager.',
      approval: 'Individual users cannot create approval workflows. Contact your manager.'
    },
    'individual': {
      milestone: 'Individual users cannot create milestones. Contact your manager.',
      approval: 'Individual users cannot create approval workflows. Contact your manager.'
    },
    'member': {
      milestone: 'Individual users cannot create milestones. Contact your manager.',
      approval: 'Individual users cannot create approval workflows. Contact your manager.'
    },
    'company-user': {
      milestone: 'Milestone creation requires Manager or Admin role.',
      approval: 'Approval workflow creation requires Manager or Admin role.'
    },
    'employee': {
      milestone: 'Milestone creation requires Manager or Admin role.',
      approval: 'Approval workflow creation requires Manager or Admin role.'
    },
    'org_member': {
      milestone: 'Milestone creation requires Manager or Admin role.',
      approval: 'Approval workflow creation requires Manager or Admin role.'
    }
  };

  return messages[role]?.[taskType] || `You don't have permission to create ${taskType} tasks.`;
};

/**
 * Validate task creation permissions
 * @param {string} role - User's role
 * @param {string} taskType - Type of task
 * @param {boolean} assigningToOthers - Whether assigning to someone else
 * @returns {object} - { allowed: boolean, message: string }
 */
export const validateTaskCreation = (role, taskType, assigningToOthers = false) => {
  // Check task type permission
  if (!canCreateTaskType(role, taskType)) {
    return {
      allowed: false,
      message: getRestrictionMessage(role, taskType)
    };
  }

  // Check assignment permission
  if (assigningToOthers && !canAssignToOthers(role)) {
    return {
      allowed: false,
      message: getPermissionDescription(role)
    };
  }

  return {
    allowed: true,
    message: 'Task creation allowed'
  };
};

/**
 * Get available task types for UI display
 * @param {string} role - User's role
 * @returns {Array} - Array of task type objects with metadata
 */
export const getAvailableTaskTypesForUI = (role) => {
  const allTaskTypes = [
    {
      id: 'regular',
      name: 'Regular Task',
      description: 'Standard one-time task',
      icon: 'ClipboardList',
      color: 'blue'
    },
    {
      id: 'recurring',
      name: 'Recurring Task',
      description: 'Repeats based on schedule',
      icon: 'RotateCcw',
      color: 'green',
      note: 'Creates multiple task instances automatically'
    },
    {
      id: 'milestone',
      name: 'Milestone',
      description: 'Project checkpoint',
      icon: 'Target',
      color: 'purple',
      requiresRole: 'Manager+'
    },
    {
      id: 'approval',
      name: 'Approval Task',
      description: 'Requires approval workflow',
      icon: 'CheckCircle',
      color: 'orange',
      requiresRole: 'Manager+'
    },
    {
      id: 'quick',
      name: 'Quick Task',
      description: 'Fast task creation',
      icon: 'Zap',
      color: 'yellow'
    }
  ];

  const allowedTypes = getAllowedTaskTypes(role);

  return allTaskTypes.map(taskType => ({
    ...taskType,
    enabled: allowedTypes.includes(taskType.id),
    disabled: !allowedTypes.includes(taskType.id),
    restrictionMessage: getRestrictionMessage(role, taskType.id)
  }));
};

export default {
  TASK_TYPE_PERMISSIONS,
  canCreateTaskType,
  canAssignToOthers,
  getAssignmentScope,
  getAllowedTaskTypes,
  getPermissionDescription,
  getRestrictionMessage,
  validateTaskCreation,
  getAvailableTaskTypesForUI
};
