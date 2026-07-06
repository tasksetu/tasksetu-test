import { useAuth } from './useAuth';
import { TASK_TYPE_PERMISSIONS, canCreateTaskType } from '../../../utils/taskPermissions';

/**
 * Custom hook for role-based functionality
 * Determines user capabilities and access levels
 */
export const useRole = () => {
  const { user, role, hasOrganization } = useAuth();

  // Role hierarchy and permissions (updated for prompt requirements)
  const roleHierarchy = {
    'individual': 1,
    'member': 1,
    'employee': 2,      // Normal User (Employee) - Personal productivity focus
    'org_member': 2,
    'manager': 3,       // Manager - Team oversight capabilities
    'admin': 4,         // Company Admin - Full organizational control
    'org_admin': 4,
    'superadmin': 5,
    'super_admin': 5,
  };

  const getRoleLevel = (roleToCheck = role) => {
    return roleHierarchy[roleToCheck] || 1;
  };

  const hasPermission = (requiredRole) => {
    return getRoleLevel() >= getRoleLevel(requiredRole);
  };

  // Feature access permissions
  const canAccessFeature = (feature) => {
    const featurePermissions = {
      'dashboard': true, // All roles can access dashboard
      'tasks': true, // All roles can manage tasks
      'calendar': true, // All roles can access calendar
      'reports': getRoleLevel() >= 2, // Employee level and above
      'user_management': getRoleLevel() >= 3, // Admin level and above
      'system_config': getRoleLevel() >= 4, // SuperAdmin only
    };

    return featurePermissions[feature] || false;
  };

  // UI context for role-based rendering
  const getUIContext = () => {
    if (getRoleLevel() >= 4) return 'superadmin';
    if (getRoleLevel() >= 3) return 'organization';
    if (hasOrganization) return 'orgMember';
    return 'individual';
  };

  return {
    role,
    roleLevel: getRoleLevel(),
    hasOrganization,
    hasPermission,
    canAccessFeature,
    uiContext: getUIContext(),

    // Legacy role checks (for backward compatibility)
    isIndividual: !hasOrganization && getRoleLevel() <= 2,
    isOrgMember: hasOrganization && getRoleLevel() <= 2,
    isAdmin: getRoleLevel() >= 4,
    isSuperAdmin: getRoleLevel() >= 5,

    // New role-specific checks based on prompt requirements
    isEmployee: role === 'employee' || getRoleLevel() === 2,
    isManager: role === 'manager' || getRoleLevel() === 3,
    isCompanyAdmin: role === 'admin' || role === 'org_admin' || getRoleLevel() === 4,

    // Permission helpers for task creation (based on TASK_TYPE_PERMISSIONS matrix)
    canManageTeam: getRoleLevel() >= 3, // Manager and above
    canManageOrganization: getRoleLevel() >= 4, // Admin and above
    canAssignToOthers: getRoleLevel() >= 3, // Manager and above
    canCreateMilestones: canCreateTaskType(role, 'milestone'), // ✅ Uses permission matrix
    canCreateApprovals: canCreateTaskType(role, 'approval'), // ✅ Uses permission matrix
    canSetCriticalPriority: getRoleLevel() >= 3, // Manager and above
  };
};