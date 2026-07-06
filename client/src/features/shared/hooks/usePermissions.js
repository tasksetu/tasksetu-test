import { useAuth } from './useAuth';
import RBACService, { PERMISSIONS } from '../services/rbacService';

/**
 * Custom hook for permission-based access control
 * Provides granular permission checking for UI components
 */
export const usePermissions = () => {
  const { user, role } = useAuth();
  
  /**
   * Check if user has specific permission
   */
  const hasPermission = (permission) => {
    if (!role) return false;
    return RBACService.hasPermission(role, permission);
  };
  
  /**
   * Check if user can access specific route
   */
  const canAccessRoute = (route) => {
    if (!role) return false;
    return RBACService.canAccessRoute(role, route);
  };
  
  /**
   * Check if user has role level or higher
   */
  const hasRoleLevel = (requiredRole) => {
    if (!role) return false;
    return RBACService.hasRoleLevel(role, requiredRole);
  };
  
  // Task-specific permissions
  const taskPermissions = {
    canCreateTask: hasPermission(PERMISSIONS.CREATE_TASK),
    canEditOwnTask: hasPermission(PERMISSIONS.EDIT_OWN_TASK),
    canEditAnyTask: hasPermission(PERMISSIONS.EDIT_ANY_TASK),
    canDeleteTask: hasPermission(PERMISSIONS.DELETE_TASK),
    canAssignTask: hasPermission(PERMISSIONS.ASSIGN_TASK),
    canViewAllTasks: hasPermission(PERMISSIONS.VIEW_ALL_TASKS),
    canManageTeamTasks: hasPermission(PERMISSIONS.MANAGE_TEAM_TASKS),
  };
  
  // User management permissions
  const userPermissions = {
    canViewUsers: hasPermission(PERMISSIONS.VIEW_USERS),
    canInviteUsers: hasPermission(PERMISSIONS.INVITE_USERS),
    canManageUsers: hasPermission(PERMISSIONS.MANAGE_USERS),
    canDeleteUsers: hasPermission(PERMISSIONS.DELETE_USERS),
  };
  
  // Organization permissions
  const orgPermissions = {
    canManageOrganization: hasPermission(PERMISSIONS.MANAGE_ORGANIZATION),
    canViewOrgSettings: hasPermission(PERMISSIONS.VIEW_ORGANIZATION_SETTINGS),
    canEditOrgSettings: hasPermission(PERMISSIONS.EDIT_ORGANIZATION_SETTINGS),
    canManageRoles: hasPermission(PERMISSIONS.MANAGE_ROLES),
    canManageBilling: hasPermission(PERMISSIONS.MANAGE_BILLING),
    canManageIntegrations: hasPermission(PERMISSIONS.MANAGE_INTEGRATIONS),
  };
  
  // Report permissions
  const reportPermissions = {
    canViewReports: hasPermission(PERMISSIONS.VIEW_REPORTS),
    canViewTeamReports: hasPermission(PERMISSIONS.VIEW_TEAM_REPORTS),
    canViewOrgReports: hasPermission(PERMISSIONS.VIEW_ORG_REPORTS),
  };
  
  // System permissions
  const systemPermissions = {
    canManageCompanies: hasPermission(PERMISSIONS.MANAGE_COMPANIES),
    isSystemAdmin: hasPermission(PERMISSIONS.SYSTEM_ADMIN),
    canViewAuditLogs: hasPermission(PERMISSIONS.VIEW_AUDIT_LOGS),
  };
  
  // Form field permissions (for dynamic form control)
  const fieldPermissions = {
    canManageVisibility: RBACService.canManageVisibility(role),
    canAssignToOthers: RBACService.canAssignToOthers(role),
    canSetCriticalPriority: hasRoleLevel('manager'),
    canCreateMilestones: hasPermission(PERMISSIONS.MANAGE_TEAM_TASKS),
    canCreateApprovals: hasPermission(PERMISSIONS.MANAGE_TEAM_TASKS),
  };
  
  return {
    // Core permission checking functions
    hasPermission,
    canAccessRoute,
    hasRoleLevel,
    
    // Grouped permissions for easy access
    task: taskPermissions,
    user: userPermissions,
    organization: orgPermissions,
    reports: reportPermissions,
    system: systemPermissions,
    fields: fieldPermissions,
    
    // User context
    role,
    user,
    isAuthenticated: !!user,
  };
};

export default usePermissions;