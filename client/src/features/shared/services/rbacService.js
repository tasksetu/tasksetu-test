/**
 * Role-Based Access Control (RBAC) Service
 * Centralized permissions and route access management
 */

// Role definitions based on client requirements
export const ROLES = {
  INDIVIDUAL: 'individual',
  MEMBER: 'member', 
  EMPLOYEE: 'employee',
  MANAGER: 'manager',
  ADMIN: 'admin',
  ORG_ADMIN: 'org_admin',
  SUPER_ADMIN: 'super_admin',
  SUPERADMIN: 'superadmin'
};

// Role hierarchy (higher number = more permissions)
export const ROLE_HIERARCHY = {
  [ROLES.INDIVIDUAL]: 1,
  [ROLES.MEMBER]: 1,
  [ROLES.EMPLOYEE]: 2,
  [ROLES.MANAGER]: 3,
  [ROLES.ADMIN]: 4,
  [ROLES.ORG_ADMIN]: 4,
  [ROLES.SUPER_ADMIN]: 5,
  [ROLES.SUPERADMIN]: 5,
};

// Permission definitions
export const PERMISSIONS = {
  // Task Management
  CREATE_TASK: 'create_task',
  EDIT_OWN_TASK: 'edit_own_task',
  EDIT_ANY_TASK: 'edit_any_task',
  DELETE_TASK: 'delete_task',
  ASSIGN_TASK: 'assign_task',
  VIEW_ALL_TASKS: 'view_all_tasks',
  MANAGE_TEAM_TASKS: 'manage_team_tasks',
  
  // User Management
  VIEW_USERS: 'view_users',
  INVITE_USERS: 'invite_users',
  MANAGE_USERS: 'manage_users',
  DELETE_USERS: 'delete_users',
  
  // Organization Management
  MANAGE_ORGANIZATION: 'manage_organization',
  VIEW_ORGANIZATION_SETTINGS: 'view_org_settings',
  EDIT_ORGANIZATION_SETTINGS: 'edit_org_settings',
  
  // Reports and Analytics
  VIEW_REPORTS: 'view_reports',
  VIEW_TEAM_REPORTS: 'view_team_reports',
  VIEW_ORG_REPORTS: 'view_org_reports',
  
  // Settings and Configuration
  MANAGE_ROLES: 'manage_roles',
  MANAGE_BILLING: 'manage_billing',
  MANAGE_INTEGRATIONS: 'manage_integrations',
  
  // System Administration
  MANAGE_COMPANIES: 'manage_companies',
  SYSTEM_ADMIN: 'system_admin',
  VIEW_AUDIT_LOGS: 'view_audit_logs',
};

// Role-based permission mapping
export const ROLE_PERMISSIONS = {
  [ROLES.INDIVIDUAL]: [
    PERMISSIONS.CREATE_TASK,
    PERMISSIONS.EDIT_OWN_TASK,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.MANAGE_BILLING, // For personal account
  ],
  
  [ROLES.MEMBER]: [
    PERMISSIONS.CREATE_TASK,
    PERMISSIONS.EDIT_OWN_TASK,
    PERMISSIONS.VIEW_REPORTS,
  ],
  
  [ROLES.EMPLOYEE]: [
    PERMISSIONS.CREATE_TASK,
    PERMISSIONS.EDIT_OWN_TASK,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_USERS,
  ],
  
  [ROLES.MANAGER]: [
    PERMISSIONS.CREATE_TASK,
    PERMISSIONS.EDIT_OWN_TASK,
    PERMISSIONS.EDIT_ANY_TASK,
    PERMISSIONS.ASSIGN_TASK,
    PERMISSIONS.VIEW_ALL_TASKS,
    PERMISSIONS.MANAGE_TEAM_TASKS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_TEAM_REPORTS,
    PERMISSIONS.VIEW_USERS,
  ],
  
  [ROLES.ADMIN]: [
    PERMISSIONS.CREATE_TASK,
    PERMISSIONS.EDIT_OWN_TASK,
    PERMISSIONS.EDIT_ANY_TASK,
    PERMISSIONS.DELETE_TASK,
    PERMISSIONS.ASSIGN_TASK,
    PERMISSIONS.VIEW_ALL_TASKS,
    PERMISSIONS.MANAGE_TEAM_TASKS,
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.INVITE_USERS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_ORGANIZATION,
    PERMISSIONS.VIEW_ORGANIZATION_SETTINGS,
    PERMISSIONS.EDIT_ORGANIZATION_SETTINGS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_TEAM_REPORTS,
    PERMISSIONS.VIEW_ORG_REPORTS,
    PERMISSIONS.MANAGE_ROLES,
    PERMISSIONS.MANAGE_BILLING,
    PERMISSIONS.MANAGE_INTEGRATIONS,
  ],
  
  [ROLES.ORG_ADMIN]: [
    PERMISSIONS.CREATE_TASK,
    PERMISSIONS.EDIT_OWN_TASK,
    PERMISSIONS.EDIT_ANY_TASK,
    PERMISSIONS.DELETE_TASK,
    PERMISSIONS.ASSIGN_TASK,
    PERMISSIONS.VIEW_ALL_TASKS,
    PERMISSIONS.MANAGE_TEAM_TASKS,
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.INVITE_USERS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_ORGANIZATION,
    PERMISSIONS.VIEW_ORGANIZATION_SETTINGS,
    PERMISSIONS.EDIT_ORGANIZATION_SETTINGS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_TEAM_REPORTS,
    PERMISSIONS.VIEW_ORG_REPORTS,
    PERMISSIONS.MANAGE_ROLES,
    PERMISSIONS.MANAGE_BILLING,
    PERMISSIONS.MANAGE_INTEGRATIONS,
  ],
  
  [ROLES.SUPER_ADMIN]: [
    ...Object.values(PERMISSIONS)
  ],
  
  [ROLES.SUPERADMIN]: [
    ...Object.values(PERMISSIONS)
  ],
};

// Route access mapping
export const ROUTE_PERMISSIONS = {
  // Dashboard routes
  '/dashboard': [],
  '/admin-dashboard': [PERMISSIONS.MANAGE_ORGANIZATION],
  '/super-admin': [PERMISSIONS.SYSTEM_ADMIN],
  
  // Task Management
  '/tasks': [],
  '/tasks/create': [PERMISSIONS.CREATE_TASK],
  '/tasks/my': [PERMISSIONS.VIEW_ALL_TASKS],
  '/tasks/team': [PERMISSIONS.MANAGE_TEAM_TASKS],
  '/tasks/company': [PERMISSIONS.VIEW_ORG_REPORTS],
  '/calendar': [],
  '/milestones': [PERMISSIONS.MANAGE_TEAM_TASKS],
  '/approvals': [PERMISSIONS.MANAGE_TEAM_TASKS],
  
  // User Management
  '/admin/users': [PERMISSIONS.VIEW_USERS],
  '/admin/user-management': [PERMISSIONS.MANAGE_USERS],
  '/admin/team-members': [PERMISSIONS.VIEW_USERS],
  '/admin/invite-users': [PERMISSIONS.INVITE_USERS],
  '/invite-users': [PERMISSIONS.INVITE_USERS],
  
  // Organization Management
  '/admin/org-profile': [PERMISSIONS.MANAGE_ORGANIZATION],
  '/admin/settings': [PERMISSIONS.EDIT_ORGANIZATION_SETTINGS],
  '/admin/roles': [PERMISSIONS.MANAGE_ROLES],
  
  // Billing and Plans
  '/admin/plans': [PERMISSIONS.MANAGE_BILLING],
  '/admin/subscription': [PERMISSIONS.MANAGE_BILLING],
  '/plans-licenses': [PERMISSIONS.MANAGE_BILLING],
  
  // Reports
  '/reports': [PERMISSIONS.VIEW_REPORTS],
  '/admin/reports': [PERMISSIONS.VIEW_ORG_REPORTS],
  '/admin/analytics': [PERMISSIONS.VIEW_ORG_REPORTS],
  
  // System Administration
  '/super-admin/companies': [PERMISSIONS.MANAGE_COMPANIES],
  '/super-admin/users': [PERMISSIONS.SYSTEM_ADMIN],
  '/super-admin/logs': [PERMISSIONS.VIEW_AUDIT_LOGS],
  
  // Forms and Processes
  '/forms': [PERMISSIONS.MANAGE_ORGANIZATION],
  '/admin/form-builder': [PERMISSIONS.MANAGE_ORGANIZATION],
  '/admin/integrations': [PERMISSIONS.MANAGE_INTEGRATIONS],
  
  // Management Tools
  '/management/users': [PERMISSIONS.MANAGE_USERS],
  '/management/roles': [PERMISSIONS.MANAGE_ROLES],
  '/admin/status-management': [PERMISSIONS.MANAGE_ORGANIZATION],
  '/admin/priority-management': [PERMISSIONS.MANAGE_ORGANIZATION],
};

/**
 * RBAC Service Class
 */
export class RBACService {
  
  /**
   * Get role level for comparison
   */
  static getRoleLevel(role) {
    return ROLE_HIERARCHY[role] || 0;
  }
  
  /**
   * Check if user has permission
   */
  static hasPermission(userRole, permission) {
    const permissions = ROLE_PERMISSIONS[userRole] || [];
    return permissions.includes(permission);
  }
  
  /**
   * Check if user has higher or equal role level
   */
  static hasRoleLevel(userRole, requiredRole) {
    return this.getRoleLevel(userRole) >= this.getRoleLevel(requiredRole);
  }
  
  /**
   * Check if user can access route
   */
  static canAccessRoute(userRole, route) {
    const requiredPermissions = ROUTE_PERMISSIONS[route];
    
    // If no specific permissions required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }
    
    // Check if user has any of the required permissions
    return requiredPermissions.some(permission => 
      this.hasPermission(userRole, permission)
    );
  }
  
  /**
   * Get allowed routes for a user role
   */
  static getAllowedRoutes(userRole) {
    return Object.keys(ROUTE_PERMISSIONS).filter(route => 
      this.canAccessRoute(userRole, route)
    );
  }
  
  /**
   * Check if user can assign tasks to others
   */
  static canAssignToOthers(userRole) {
    return this.hasPermission(userRole, PERMISSIONS.ASSIGN_TASK);
  }
  
  /**
   * Check if user can edit visibility settings
   */
  static canManageVisibility(userRole) {
    return this.getRoleLevel(userRole) >= this.getRoleLevel(ROLES.MANAGER);
  }
  
  /**
   * Get redirect path for role after unauthorized access
   */
  static getRedirectPath(userRole) {
    if (this.getRoleLevel(userRole) >= this.getRoleLevel(ROLES.SUPER_ADMIN)) {
      return '/super-admin';
    }
    if (this.getRoleLevel(userRole) >= this.getRoleLevel(ROLES.ADMIN)) {
      return '/admin-dashboard';
    }
    return '/dashboard';
  }
}

export default RBACService;