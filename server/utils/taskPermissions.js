/**
 * Backend Task Creation Permissions Module
 * Based on Tasksetu PRD Document - Role-based Access Control
 * 
 * This module validates task creation permissions on the server side
 */

/**
 * Task Type Permissions Matrix (Backend Version)
 */
const TASK_TYPE_PERMISSIONS = {
  // Individual User - Can create regular and recurring tasks (self-assign only)
  'individual-user': {
    canCreate: {
      regular: true,
      recurring: true,
      milestone: true,    // ✅ Can create milestones (ENABLED)
      approval: false,    // Cannot create approval tasks
      quick: true
    },
    canAssignToOthers: false,
    assignmentScope: 'self-only'
  },
  'individual': {
    canCreate: {
      regular: true,
      recurring: true,
      milestone: true,    // ✅ Can create milestones (ENABLED)
      approval: false,    // Cannot create approval tasks
      quick: true
    },
    canAssignToOthers: false,
    assignmentScope: 'self-only'
  },

  // Company User (Employee) - Phase I Restrictions
  'company-user': {
    canCreate: {
      regular: true,
      recurring: true, // Phase I: self-assign only
      milestone: true,    // ✅ Can create milestones (ENABLED)
      approval: true,     // ✅ Can create approval workflows (ENABLED)
      quick: true
    },
    canAssignToOthers: false,
    assignmentScope: 'self-only'
  },
  'employee': {
    canCreate: {
      regular: true,
      recurring: true,
      milestone: true,    // ✅ Can create milestones (ENABLED)
      approval: true,     // ✅ Can create approval workflows (ENABLED)
      quick: true
    },
    canAssignToOthers: false,
    assignmentScope: 'self-only'
  },
  'user': {
    canCreate: {
      regular: true,
      recurring: true,
      milestone: false,
      approval: false,
      quick: true
    },
    canAssignToOthers: false,
    assignmentScope: 'self-only'
  },
  'normal-user': {
    canCreate: {
      regular: true,
      recurring: true,
      milestone: false,
      approval: false,
      quick: true
    },
    canAssignToOthers: false,
    assignmentScope: 'self-only'
  },

  // Manager - Team Management Permissions
  'manager': {
    canCreate: {
      regular: true,
      recurring: true,
      milestone: true,
      approval: true,
      quick: true
    },
    canAssignToOthers: true,
    assignmentScope: 'team'
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
    assignmentScope: 'organization'
  },
  'org_admin': {
    canCreate: {
      regular: true,
      recurring: true,
      milestone: true,
      approval: true,
      quick: true
    },
    canAssignToOthers: true,
    assignmentScope: 'organization'
  },
  'admin': {
    canCreate: {
      regular: true,
      recurring: true,
      milestone: true,
      approval: true,
      quick: true
    },
    canAssignToOthers: true,
    assignmentScope: 'organization'
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
    assignmentScope: 'platform'
  },
  'super-admin': {
    canCreate: {
      regular: true,
      recurring: true,
      milestone: true,
      approval: true,
      quick: true
    },
    canAssignToOthers: true,
    assignmentScope: 'platform'
  },
  'super_admin': {
    canCreate: {
      regular: true,
      recurring: true,
      milestone: true,
      approval: true,
      quick: true
    },
    canAssignToOthers: true,
    assignmentScope: 'platform'
  }
};

/**
 * Check if a role can create a specific task type
 * @param {string|string[]} userRole - User's role(s)
 * @param {string} taskType - Type of task
 * @returns {boolean}
 */
const canCreateTaskType = (userRole, taskType) => {
  if (!userRole || !taskType) return false;

  // Handle array of roles - check if ANY role has permission
  const roles = Array.isArray(userRole) ? userRole : [userRole];

  for (const role of roles) {
    const permissions = TASK_TYPE_PERMISSIONS[role];
    if (permissions && permissions.canCreate[taskType]) {
      return true;
    }
  }

  return false;
};

/**
 * Check if a role can assign tasks to others
 * @param {string|string[]} userRole - User's role(s)
 * @returns {boolean}
 */
const canAssignToOthers = (userRole) => {
  if (!userRole) return false;

  // Handle array of roles - check if ANY role has permission
  const roles = Array.isArray(userRole) ? userRole : [userRole];

  for (const role of roles) {
    const permissions = TASK_TYPE_PERMISSIONS[role];
    if (permissions && permissions.canAssignToOthers) {
      return true;
    }
  }

  return false;
};

/**
 * Get assignment scope for a role
 * @param {string|string[]} userRole - User's role(s)
 * @returns {string} - Highest permission level among roles
 */
const getAssignmentScope = (userRole) => {
  if (!userRole) return 'self-only';

  const roles = Array.isArray(userRole) ? userRole : [userRole];
  const scopePriority = ['platform', 'organization', 'team', 'self-only'];

  let highestScope = 'self-only';

  for (const role of roles) {
    const permissions = TASK_TYPE_PERMISSIONS[role];
    if (permissions) {
      const currentScope = permissions.assignmentScope;
      const currentPriority = scopePriority.indexOf(currentScope);
      const highestPriority = scopePriority.indexOf(highestScope);

      if (currentPriority < highestPriority) {
        highestScope = currentScope;
      }
    }
  }

  return highestScope;
};

/**
 * Get error message for denied permission
 * @param {string|string[]} userRole - User's role(s)
 * @param {string} taskType - Type of task
 * @returns {string}
 */
const getPermissionDeniedMessage = (userRole, taskType) => {
  const roles = Array.isArray(userRole) ? userRole : [userRole];
  const roleString = roles.join(', ');

  const messages = {
    recurring: `Access denied: Users with role "${roleString}" cannot create recurring tasks. Recurring task creation requires Company User role or higher.`,
    milestone: `Access denied: Users with role "${roleString}" cannot create milestone tasks. Milestone creation requires Manager or Admin role.`,
    approval: `Access denied: Users with role "${roleString}" cannot create approval workflows. Approval task creation requires Manager or Admin role.`
  };

  return messages[taskType] || `Access denied: Users with role "${roleString}" cannot create ${taskType} tasks.`;
};

/**
 * Validate task creation permissions
 * @param {Object} user - User object with role
 * @param {string} taskType - Type of task to create
 * @param {string} assignedTo - User ID of assignee (if assigning to others)
 * @returns {Object} - { allowed: boolean, message: string }
 */
const validateTaskCreation = (user, taskType, assignedTo = null) => {
  if (!user || !user.role) {
    return {
      allowed: false,
      message: 'User role not found. Cannot validate permissions.'
    };
  }

  const userRole = user.role;
  const userId = (user._id || user.id).toString();

  console.log('🔐 [BACKEND] PERMISSION VALIDATION - User:', user.email || user.name);
  console.log('🔐 [BACKEND] PERMISSION VALIDATION - Role:', userRole);
  console.log('🔐 [BACKEND] PERMISSION VALIDATION - Task Type:', taskType);
  console.log('🔐 [BACKEND] PERMISSION VALIDATION - Assigned To (raw):', assignedTo);
  console.log('🔐 [BACKEND] PERMISSION VALIDATION - User ID:', userId);

  // Check if user can create this task type
  if (!canCreateTaskType(userRole, taskType)) {
    console.error('🔐 [BACKEND] PERMISSION DENIED - Cannot create task type');
    return {
      allowed: false,
      message: getPermissionDeniedMessage(userRole, taskType)
    };
  }

  console.log('🔐 [BACKEND] PERMISSION CHECK - Can create task type: ✓');

  // Check if assigning to someone else
  // If assignedTo is null/undefined, treat as self-assignment
  if (!assignedTo) {
    console.log('🔐 [BACKEND] PERMISSION CHECK - No assignedTo specified, treating as self-assignment');
    return {
      allowed: true,
      message: 'Task creation allowed'
    };
  }

  const assignedToStr = assignedTo.toString();
  const isAssigningToOthers = assignedToStr !== userId;

  console.log('🔐 [BACKEND] PERMISSION CHECK - Assigned To (normalized):', assignedToStr);
  console.log('🔐 [BACKEND] PERMISSION CHECK - User ID (normalized):', userId);
  console.log('🔐 [BACKEND] PERMISSION CHECK - Is assigning to others:', isAssigningToOthers);

  if (isAssigningToOthers && !canAssignToOthers(userRole)) {
    console.error('🔐 [BACKEND] PERMISSION DENIED - Cannot assign to others');
    const roles = Array.isArray(userRole) ? userRole : [userRole];
    const roleString = roles.join(', ');

    // Phase I restriction message
    if (roles.some(r => ['employee', 'company-user', 'user', 'normal-user'].includes(r))) {
      return {
        allowed: false,
        message: `Access denied: Phase I restriction - Company users can only assign tasks to themselves. Team assignment will be available in future phases.`
      };
    }

    return {
      allowed: false,
      message: `Access denied: Users with role "${roleString}" can only assign tasks to themselves.`
    };
  }

  console.log('🔐 [BACKEND] PERMISSION CHECK - Assignment permission: ✓');
  console.log('🔐 [BACKEND] PERMISSION VALIDATION - Task creation ALLOWED');

  return {
    allowed: true,
    message: 'Task creation allowed'
  };
};

/**
 * Helper to get highest priority role from user roles
 * @param {string|string[]} userRole - User's role(s)
 * @returns {string}
 */
const getHighestPriorityRole = (userRole) => {
  const roles = Array.isArray(userRole) ? userRole : [userRole];
  const rolePriority = [
    'super-admin',
    'super_admin',
    'tasksetu-admin',
    'org_admin',
    'company-admin',
    'admin',
    'manager',
    'employee',
    'company-user',
    'user',
    'normal-user',
    'individual-user',
    'individual'
  ];

  for (const priorityRole of rolePriority) {
    if (roles.includes(priorityRole)) {
      return priorityRole;
    }
  }

  return roles[0] || 'employee'; // Default to first role or employee
};

export {
  TASK_TYPE_PERMISSIONS,
  canCreateTaskType,
  canAssignToOthers,
  getAssignmentScope,
  getPermissionDeniedMessage,
  validateTaskCreation,
  getHighestPriorityRole
};
