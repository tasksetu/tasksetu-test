import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from '@/components/ui/button';
import { usePermissions } from "@/features/shared/hooks/usePermissions";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { PERMISSIONS } from "@/features/shared/services/rbacService";
import {
  Home,
  CheckSquare,
  Plus,
  Calendar,
  Target,
  ClipboardCheck,
  Users,
  Shield,
  FileText,
  BarChart3,
  Settings,
  Key,
  Cog,
  Building2,
  UserPlus,
  Monitor,
  Database,
  Activity,
  ChevronDown,
  ChevronRight,
  Bell,
} from "lucide-react";

/**
 * Dynamic Sidebar Component with RBAC Integration
 * Shows/hides menu items based on user permissions
 */
export const DynamicSidebar = ({ isCollapsed = false, onToggle }) => {
  const [location, setLocation] = useLocation();
  const { role, canAccessRoute, hasPermission, user } = usePermissions();
  const [expandedItems, setExpandedItems] = useState({});

  const toggleExpanded = (itemId) => {
    setExpandedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  // Dynamic menu configuration based on user role and permissions
  const getMenuItems = () => {
    const baseItems = [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: Home,
        path: "/dashboard",
        alwaysShow: true,
      },
      {
        id: "tasks",
        label: "My Tasks",
        icon: CheckSquare,
        path: "/tasks",
        alwaysShow: true,
      },
      {
        id: "create-task",
        label: "Create Task",
        icon: Plus,
        path: "/tasks/create",
        permission: PERMISSIONS.CREATE_TASK,
      },
      {
        id: "calendar",
        label: "Calendar",
        icon: Calendar,
        path: "/calendar",
        alwaysShow: true,
      },
    ];

    // Manager and above get team management features
    const teamItems = [
      // {
      //   id: "team-tasks",
      //   label: "Team Tasks",
      //   icon: Users,
      //   path: "/tasks/team",
      //   permission: PERMISSIONS.MANAGE_TEAM_TASKS,
      // },
      {
        id: "milestones",
        label: "Milestones",
        icon: Target,
        path: "/milestones",
        permission: PERMISSIONS.MANAGE_TEAM_TASKS,
      },
      {
        id: "approvals",
        label: "Approvals",
        icon: ClipboardCheck,
        path: "/approvals",
        permission: PERMISSIONS.MANAGE_TEAM_TASKS,
      },
    ];

    // Admin features
    const adminItems = [
      {
        id: "administration",
        label: "Administration",
        icon: Settings,
        children: [
          {
            id: "user-management",
            label: "User Management",
            icon: Users,
            path: "/admin/user-management",
            permission: PERMISSIONS.MANAGE_USERS,
          },
          {
            id: "team-members",
            label: "Team Members",
            icon: Users,
            path: "/admin/team-members",
            permission: PERMISSIONS.VIEW_USERS,
          },
          // {
          //   id: "invite-users",
          //   label: "Invite Users",
          //   icon: UserPlus,
          //   path: "/admin/invite-users",
          //   permission: PERMISSIONS.INVITE_USERS,
          // },
          {
            id: "organization",
            label: "Organization",
            icon: Building2,
            path: "/admin/org-profile",
            permission: PERMISSIONS.MANAGE_ORGANIZATION,
          },
          {
            id: "roles",
            label: "Roles & Permissions",
            icon: Shield,
            path: "/admin/roles",
            permission: PERMISSIONS.MANAGE_ROLES,
          },
          {
            id: "plans-licenses",
            label: "Plans & Licenses",
            icon: Key,
            path: "/license",
            permission: PERMISSIONS.MANAGE_BILLING,
          },
          {
            id: "status-management",
            label: "Status Management",
            icon: Cog,
            path: "/admin/status-management",
            permission: PERMISSIONS.MANAGE_ORGANIZATION,
          },
          {
            id: "priority-management",
            label: "Priority Management",
            icon: Cog,
            path: "/admin/priority-management",
            permission: PERMISSIONS.MANAGE_ORGANIZATION,
          },
        ],
      },
      {
        id: "reports",
        label: "Reports",
        icon: BarChart3,
        path: "/admin/reports",
        permission: PERMISSIONS.VIEW_ORG_REPORTS,
      },
      {
        id: "forms",
        label: "Form Builder",
        icon: FileText,
        path: "/admin/form-builder",
        permission: PERMISSIONS.MANAGE_ORGANIZATION,
      },
    ];

    // Super Admin features
    const superAdminItems = [
      {
        id: "system-admin",
        label: "System Administration",
        icon: Monitor,
        children: [
          {
            id: "companies",
            label: "Companies",
            icon: Building2,
            path: "/super-admin/companies",
            permission: PERMISSIONS.MANAGE_COMPANIES,
          },
          {
            id: "system-users",
            label: "All Users",
            icon: Users,
            path: "/super-admin/users",
            permission: PERMISSIONS.SYSTEM_ADMIN,
          },
          {
            id: "audit-logs",
            label: "Audit Logs",
            icon: Activity,
            path: "/super-admin/logs",
            permission: PERMISSIONS.VIEW_AUDIT_LOGS,
          },
          {
            id: "license-control",
            label: "License Control",
            icon: Key,
            path: "/super-admin/license-control",
            permission: PERMISSIONS.SYSTEM_ADMIN,
          },
          {
            id: "system-settings",
            label: "System Settings",
            icon: Database,
            path: "/super-admin/settings",
            permission: PERMISSIONS.SYSTEM_ADMIN,
          },
        ],
      },
    ];

    // Individual user gets personal billing
    const individualItems = [
      {
        id: "subscription",
        label: "Subscription",
        icon: Key,
        path: "/subscription",
        permission: PERMISSIONS.MANAGE_BILLING,
        roles: ["individual"],
      },
    ];

    // Combine items based on role
    let allItems = [...baseItems];

    // Add team items for manager and above
    if (hasPermission(PERMISSIONS.MANAGE_TEAM_TASKS)) {
      allItems = [...allItems, ...teamItems];
    }

    // Add admin items for admin roles
    if (hasPermission(PERMISSIONS.MANAGE_ORGANIZATION)) {
      allItems = [...allItems, ...adminItems];
    }

    // Add super admin items
    if (hasPermission(PERMISSIONS.SYSTEM_ADMIN)) {
      allItems = [...allItems, ...superAdminItems];
    }

    // Add individual items for individual users
    if (role === "individual") {
      allItems = [...allItems, ...individualItems];
    }

    return allItems;
  };

  const renderMenuItem = (item, depth = 0) => {
    const isActive = location === item.path;
    const isExpanded = expandedItems[item.id];
    const hasChildren = item.children && item.children.length > 0;

    // Check if item should be shown
    const shouldShow =
      item.alwaysShow ||
      (item.permission && hasPermission(item.permission)) ||
      (item.roles && item.roles.includes(role)) ||
      (hasChildren &&
        item.children?.some((child) =>
          child.permission ? hasPermission(child.permission) : true,
        ));

    if (!shouldShow) return null;

    const ItemIcon = item.icon;
    const paddingLeft = depth * 16 + 16;

    return (
      <div key={item.id}>
        <div
          className={`flex items-center px-4 py-2 cursor-pointer transition-colors ${isActive
              ? "bg-blue-100 text-blue-700 border-r-2 border-blue-700"
              : "text-gray-700 hover:bg-gray-100"
            }`}
          style={{ paddingLeft: `${paddingLeft}px` }}
          onClick={() => {
            if (hasChildren) {
              toggleExpanded(item.id);
            } else if (item.path) {
              setLocation(item.path);
            }
          }}
        >
          <ItemIcon className="w-5 h-5 mr-3" />
          {!isCollapsed && (
            <>
              <span className="flex-1">{item.label}</span>
              {hasChildren && (
                <span className="ml-2">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </span>
              )}
            </>
          )}
        </div>

        {hasChildren && isExpanded && !isCollapsed && (
          <div className="bg-gray-50">
            {item.children.map((child) => renderMenuItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Get workspace name based on role and organization
  const getWorkspaceName = () => {
    const orgName =
      user?.organizationName || user?.organization?.name || "Organization";
    const hasOrganization = user?.organizationId || user?.organization;

    if (["individual"].includes(role)) {
      return "Personal Workspace";
    }

    if (
      ["admin", "org_admin", "manager", "employee", "member"].includes(role)
    ) {
      if (hasOrganization) {
        return `${orgName} Workspace`;
      } else if (role === "member") {
        return "Personal Workspace";
      }
      return "Organization Workspace";
    }

    if (["super_admin", "superadmin"].includes(role)) {
      return "Super Admin Panel";
    }

    return "Personal Workspace";
  };

  const menuItems = getMenuItems();

  return (
    <div
      className={`bg-white border-r border-gray-200 h-full transition-all duration-300 ${isCollapsed ? "w-16" : "w-64"
        }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div>
              <h1 className="text-xl font-bold text-gray-900">TaskSetu</h1>
              <p className="text-sm text-gray-600">{getWorkspaceName()}</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            data-testid="sidebar-toggle"
          >
            <Monitor className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Menu Items */}
      <div className="py-2 overflow-y-auto">
        {menuItems.map((item) => renderMenuItem(item))}
      </div>

      {/* Footer */}
      {!isCollapsed && (
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
          <div className="flex items-center text-sm text-gray-600">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
            Role: {role || "Unknown"}
          </div>
        </div>
      )}
    </div>
  );
};

export default DynamicSidebar;
