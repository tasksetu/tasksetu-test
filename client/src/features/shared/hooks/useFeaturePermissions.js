import { useRole } from './useRole';

/**
 * Custom hook for feature-specific permissions
 * Determines what actions a user can perform within features
 */
export const useFeaturePermissions = () => {
  const { role, canAccessFeature, isAdmin, isSuperAdmin } = useRole();

  // Task management permissions
  const taskPermissions = {
    canCreateTask: true, // All authenticated users
    canEditOwnTasks: true,
    canEditAllTasks: isAdmin,
    canDeleteTasks: isAdmin,
    canAssignTasks: isAdmin,
    canViewAllTasks: canAccessFeature('user_management'),
    canManageRecurring: true,
    canApproveTasksFrom: [],
    canCreateMilestones: canAccessFeature('reports'),
  };

  // Calendar permissions
  const calendarPermissions = {
    canViewCalendar: canAccessFeature('calendar'),
    canCreateEvents: true,
    canEditOwnEvents: true,
    canEditAllEvents: isAdmin,
    canManageTeamCalendar: isAdmin,
    canIntegrateExternalCalendars: true,
  };

  // Dashboard permissions
  const dashboardPermissions = {
    canViewPersonalDashboard: true,
    canViewTeamDashboard: canAccessFeature('reports'),
    canViewOrgDashboard: isAdmin,
    canViewSystemDashboard: isSuperAdmin,
    canCustomizeDashboard: true,
    canExportReports: canAccessFeature('reports'),
  };

  // User management permissions
  const userPermissions = {
    canInviteUsers: isAdmin,
    canManageUsers: isAdmin,
    canAssignRoles: isAdmin,
    canViewUserProfiles: canAccessFeature('user_management'),
    canManagePermissions: isSuperAdmin,
  };

  // System permissions
  const systemPermissions = {
    canAccessSystemSettings: isSuperAdmin,
    canManageLicenses: isSuperAdmin,
    canViewAuditLogs: isSuperAdmin,
    canManageIntegrations: isAdmin,
    canBackupData: isSuperAdmin,
  };

  return {
    tasks: taskPermissions,
    calendar: calendarPermissions,
    dashboard: dashboardPermissions,
    users: userPermissions,
    system: systemPermissions,
    // Helper function to check specific permission
    hasPermission: (feature, permission) => {
      const featurePerms = {
        tasks: taskPermissions,
        calendar: calendarPermissions,
        dashboard: dashboardPermissions,
        users: userPermissions,
        system: systemPermissions,
      };
      return featurePerms[feature]?.[permission] || false;
    }
  };
};