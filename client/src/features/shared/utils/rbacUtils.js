/**
 * RBAC Utility Functions
 * Helper functions for common RBAC operations
 */

import RBACService, { PERMISSIONS, ROLES } from '../services/rbacService';

/**
 * Check if user can edit a specific task
 */
export const canEditTask = (userRole, userId, taskOwnerId, taskId) => {
  // Users can always edit their own tasks
  if (userId === taskOwnerId) {
    return RBACService.hasPermission(userRole, PERMISSIONS.EDIT_OWN_TASK);
  }
  
  // Managers and above can edit any task
  return RBACService.hasPermission(userRole, PERMISSIONS.EDIT_ANY_TASK);
};

/**
 * Check if user can delete a specific task
 */
export const canDeleteTask = (userRole, userId, taskOwnerId) => {
  // Only task owner or users with delete permission can delete
  if (userId === taskOwnerId) {
    return RBACService.hasPermission(userRole, PERMISSIONS.EDIT_OWN_TASK);
  }
  
  return RBACService.hasPermission(userRole, PERMISSIONS.DELETE_TASK);
};

/**
 * Filter assignment options based on user permissions
 */
export const getFilteredAssignmentOptions = (userRole, allOptions, userId) => {
  if (RBACService.canAssignToOthers(userRole)) {
    return allOptions;
  }
  
  // Only allow self-assignment
  return allOptions.filter(option => option.value === 'self' || option.value === userId);
};

/**
 * Get priority options based on user role
 */
export const getFilteredPriorityOptions = (userRole, allOptions) => {
  if (RBACService.hasPermission(userRole, PERMISSIONS.MANAGE_TEAM_TASKS)) {
    return allOptions;
  }
  
  // Remove critical priority for lower roles
  return allOptions.filter(option => 
    option.value !== 'Critical' && option.value !== 'critical'
  );
};

/**
 * Get navigation items based on user role
 */
export const getFilteredNavigation = (userRole, allNavItems) => {
  return allNavItems.filter(item => {
    if (item.alwaysShow) return true;
    if (item.permission) return RBACService.hasPermission(userRole, item.permission);
    if (item.route) return RBACService.canAccessRoute(userRole, item.route);
    if (item.roleLevel) return RBACService.hasRoleLevel(userRole, item.roleLevel);
    return true;
  });
};

/**
 * Check if field should be visible to user
 */
export const isFieldVisible = (userRole, fieldConfig) => {
  if (fieldConfig.alwaysVisible) return true;
  if (fieldConfig.permission) return RBACService.hasPermission(userRole, fieldConfig.permission);
  if (fieldConfig.roleLevel) return RBACService.hasRoleLevel(userRole, fieldConfig.roleLevel);
  return true;
};

/**
 * Check if field should be disabled for user
 */
export const isFieldDisabled = (userRole, fieldConfig) => {
  if (fieldConfig.alwaysEnabled) return false;
  if (fieldConfig.disablePermission) return !RBACService.hasPermission(userRole, fieldConfig.disablePermission);
  if (fieldConfig.disableRoleLevel) return !RBACService.hasRoleLevel(userRole, fieldConfig.disableRoleLevel);
  return false;
};

/**
 * Get role display name
 */
export const getRoleDisplayName = (role) => {
  const roleNames = {
    [ROLES.INDIVIDUAL]: 'Individual User',
    [ROLES.MEMBER]: 'Member',
    [ROLES.EMPLOYEE]: 'Employee',
    [ROLES.MANAGER]: 'Manager',
    [ROLES.ADMIN]: 'Admin',
    [ROLES.ORG_ADMIN]: 'Organization Admin',
    [ROLES.SUPER_ADMIN]: 'Super Admin',
    [ROLES.SUPERADMIN]: 'Super Admin',
  };
  
  return roleNames[role] || role;
};

/**
 * Get role color for UI display
 */
export const getRoleColor = (role) => {
  const roleColors = {
    [ROLES.INDIVIDUAL]: 'bg-gray-500',
    [ROLES.MEMBER]: 'bg-blue-500',
    [ROLES.EMPLOYEE]: 'bg-green-500',
    [ROLES.MANAGER]: 'bg-yellow-500',
    [ROLES.ADMIN]: 'bg-purple-500',
    [ROLES.ORG_ADMIN]: 'bg-purple-600',
    [ROLES.SUPER_ADMIN]: 'bg-red-500',
    [ROLES.SUPERADMIN]: 'bg-red-600',
  };
  
  return roleColors[role] || 'bg-gray-400';
};

/**
 * Validate form data based on user permissions
 */
export const validateFormPermissions = (userRole, formData) => {
  const errors = {};
  
  // Check assignment permissions
  if (formData.assignedTo && formData.assignedTo.value !== 'self') {
    if (!RBACService.canAssignToOthers(userRole)) {
      errors.assignedTo = 'You can only assign tasks to yourself';
    }
  }
  
  // Check priority permissions
  if (formData.priority && (formData.priority.value === 'Critical' || formData.priority.value === 'critical')) {
    if (!RBACService.hasPermission(userRole, PERMISSIONS.MANAGE_TEAM_TASKS)) {
      errors.priority = 'Critical priority requires manager role or higher';
    }
  }
  
  // Check visibility permissions
  if (formData.visibility && formData.visibility !== 'private') {
    if (!RBACService.canManageVisibility(userRole)) {
      errors.visibility = 'You can only create private tasks';
    }
  }
  
  return errors;
};

export default {
  canEditTask,
  canDeleteTask,
  getFilteredAssignmentOptions,
  getFilteredPriorityOptions,
  getFilteredNavigation,
  isFieldVisible,
  isFieldDisabled,
  getRoleDisplayName,
  getRoleColor,
  validateFormPermissions,
};