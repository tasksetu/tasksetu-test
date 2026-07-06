import {
  Home,
  CheckSquare,
  Plus,
  Zap,
  Calendar,
  Target,
  ClipboardCheck,
  TrendingUp,
  AlertTriangle,
  User,
  Bell,
  HelpCircle,
  LogOut,
  Users,
  Shield,
  FileText,
  BarChart3,
  Settings,
  Monitor,
  Key,
  Cog,
  BellRing,
  Database,
  Library,
  Activity,
  Server,
  FileSearch,
  UserCheck,
  Building2,
  Clock,
  List,
  UserCircle,
  Briefcase,
  PieChart,
  Layers,
  Flag,
  File,
  CreditCard,
  FileSpreadsheet,
  Trash2,
} from "lucide-react";
import {
  ApprovalTaskIcon,
  MilestoneTaskIcon,
  RecurringTaskIcon,
  RegularTaskIcon,
} from "../../components/common/TaskIcons";

// ✅ Define atomic reusable menu items
const baseItems = {
  dashboard: {
    id: "dashboard",
    label: "Dashboard",
    icon: Home,
    path: "/dashboard",
  },
  myTasks: {
    id: "my-tasks",
    label: "My Tasks",
    icon: CheckSquare,
    path: "/tasks",
  },
  createTask: {
    id: "create-task",
    label: "Create Task",
    icon: Plus,
    children: [
      {
        id: "create-regular",
        label: "Regular Task",
        icon: RegularTaskIcon,
        path: "/tasks/create?type=regular",
      },
      {
        id: "create-recurring",
        label: "Recurring Task",
        icon: RecurringTaskIcon,
        path: "/tasks/create?type=recurring",
      },
      {
        id: "create-milestone",
        label: "Milestone",
        icon: MilestoneTaskIcon,
        path: "/tasks/create?type=milestone",
      },
    ],
  },
  quickTasks: {
    id: "quick-tasks",
    label: "Quick Tasks",
    icon: Zap,
    path: "/quick-tasks",
    feature: "TASK_QUICK",
  },
  // regularTasks: {
  //   id: "regular-tasks",
  //   label: "Regular Tasks",
  //   icon: RegularTaskIcon,
  //   path: "/regular-tasks",
  //   feature: "TASK_BASIC",
  // },
  // recurring: {
  //   id: "recurring",
  //   label: "Recurring",
  //   icon: RecurringTaskIcon,
  //   path: "/recurring",
  //   feature: "TASK_RECUR",
  // },
  // calendar: {
  //   id: "calendar",
  //   label: "Calendar",
  //   icon: Calendar,
  //   path: "/calendar",
  //   feature: "TASK_CAL",
  // },
  approvals: {
    id: "approvals",
    label: "Approvals",
    icon: ApprovalTaskIcon,
    path: "/approvals",
    feature: "TASK_APPROVAL",
  },
  // trashTasks: {
  //   id: "trash-tasks",
  //   label: "Trash Tasks",
  //   icon: Trash2,
  //   path: "/tasks/trash",
  // },
  // milestones: {
  //   id: "milestones",
  //   label: "Milestones",
  //   icon: MilestoneTaskIcon,
  //   path: "/milestones",
  //   feature: "TASK_MSTONE",
  // },
  // form modules
  form: {
    id: "form",
    label: "Forms",
    icon: ClipboardCheck,
    children: [
      {
        id: "form-library",
        label: "Form Library",
        icon: ClipboardCheck,
        path: "/form-library",
      },
      {
        id: "form-builder",
        label: "Form Builder",
        icon: FileSpreadsheet,
        path: "/form-builder",
      },
      // {
      //   id: "form-version-history",
      //   label: "Form Version History",
      //   icon: Clock,
      //   path: "/form-version-history",
      // },
    ],
  },
  // Settings for employee & manager (view only)
  settingsViewOnly: {
    id: "settings",
    label: "Settings",
    icon: Settings,
    children: [
      { id: "profile", label: "Profile", icon: User, path: "/edit-profile" },
      {
        id: "license-view",
        label: "License",
        icon: Key,
        path: "/admin/subscription",
      },
      {
        id: "notifications",
        label: "Notifications",
        icon: Bell,
        path: "/notifications",
      },
    ],
  },
  // Settings for individual & org_admin (management access)
  settingsManagement: {
    id: "settings",
    label: "Settings",
    icon: Settings,
    children: [
      { id: "profile", label: "Profile", icon: User, path: "/edit-profile" },
      {
        id: "license-management",
        label: "License Management",
        icon: Key,
        path: "/admin/subscription",
      },
      {
        id: "billing-management",
        label: "Billing Management",
        icon: CreditCard,
        path: "/admin/billing",
      },
      {
        id: "notifications",
        label: "Notifications",
        icon: Bell,
        path: "/notifications",
      },
    ],
  },
  help: {
    id: "help",
    label: "Help & Support",
    icon: HelpCircle,
    path: "/help",
  },
  logout: { id: "logout", label: "Logout", icon: LogOut, action: "logout" },
  license: {
    id: "license",
    label: "License",
    icon: Key,
    isLicense: true,
  },
};

// Role → menu mapping
export const sidebarMenus = {
  employee: [
    baseItems.dashboard,
    baseItems.myTasks,
    baseItems.createTask,
    baseItems.quickTasks,
    baseItems.approvals,
    baseItems.trashTasks,
    {
      id: "reports",
      label: "Reporting & Analytics",
      icon: BarChart3,
      path: "/reports",
    },
    baseItems.form,
    baseItems.settingsViewOnly,
    baseItems.help,
    baseItems.logout,
    baseItems.license,
  ],

  individual: [
    // Added dedicated menu for individual users
    baseItems.dashboard,
    baseItems.myTasks,
    baseItems.createTask,
    baseItems.quickTasks,
    baseItems.trashTasks,
    {
      id: "reports",
      label: "Reporting & Analytics",
      icon: BarChart3,
      path: "/reports",
    },
    baseItems.form,
    baseItems.settingsManagement, // Individual users manage their own subscription
    baseItems.help,
    baseItems.logout,
    baseItems.license,
  ],

  manager: [
    baseItems.dashboard,
    baseItems.myTasks,
    // { id: "team-tasks", label: "Team Tasks", icon: Users, path: "/tasks/team" },
    baseItems.createTask,
    baseItems.quickTasks,
    baseItems.approvals,
    baseItems.trashTasks,
    {
      id: "reports",
      label: "Reporting & Analytics",
      icon: BarChart3,
      path: "/reports",
    },
    baseItems.form,
    baseItems.settingsViewOnly,
    baseItems.help,
    baseItems.logout,
    baseItems.license,
  ],

  org_admin: [
    baseItems.dashboard,
    baseItems.myTasks,
    // { id: "team-tasks", label: "Team Tasks", icon: Users, path: "/tasks/team" },
    baseItems.createTask,
    baseItems.quickTasks,
    baseItems.approvals,
    baseItems.trashTasks,
    {
      id: "reports",
      label: "Reporting & Analytics",
      icon: BarChart3,
      path: "/reports",
    },
    {
      id: "admin",
      label: "Administration",
      icon: Shield,
      children: [
        {
          id: "user-management",
          label: "User Management",
          icon: Users,
          path: "/admin/users",
        },
        {
          id: "team-members",
          label: "Team Members",
          icon: Users,
          path: "/admin/team-members",
        },
        // {
        //   id: "company-profile",
        //   label: "Company Profile",
        //   icon: Building2,
        //   path: "/admin/org-profile",
        // },
        {
          id: "status-management",
          label: "Status Management",
          icon: Cog,
          path: "/admin/status",
        },
        {
          id: "priority-management",
          label: "Priority Management",
          icon: Flag,
          path: "/admin/priority",
        },
      ],
    },
    baseItems.form,
    baseItems.settingsManagement,
    baseItems.help,
    baseItems.logout,
    baseItems.license,
  ],

  admin: [
    baseItems.dashboard,
    baseItems.myTasks,
    // { id: "team-tasks", label: "Team Tasks", icon: Users, path: "/tasks/team" },
    baseItems.createTask,
    baseItems.quickTasks,
    baseItems.approvals,
    baseItems.trashTasks,
    {
      id: "reports",
      label: "Reporting & Analytics",
      icon: BarChart3,
      path: "/reports",
    },
    {
      id: "admin",
      label: "Administration",
      icon: Shield,
      children: [
        {
          id: "user-management",
          label: "User Management",
          icon: Users,
          path: "/admin/users",
        },
        {
          id: "team-members",
          label: "Team Members",
          icon: Users,
          path: "/admin/team-members",
        },
        // {
        //   id: "company-profile",
        //   label: "Company Profile",
        //   icon: Building2,
        //   path: "/admin/org-profile",
        // },
        {
          id: "status-management",
          label: "Status Management",
          icon: Cog,
          path: "/admin/status",
        },
        {
          id: "priority-management",
          label: "Priority Management",
          icon: Flag,
          path: "/admin/priority",
        },
      ],
    },
    baseItems.form,
    baseItems.settingsManagement,
    baseItems.help,
    baseItems.logout,
    baseItems.license,
  ],

  // Note: super_admin uses SuperAdminLayout with SuperAdminSidebar, not this config
  // Keeping this commented for reference in case needed for future admin delegation features
  // super_admin: [] - removed as AdminLayout is never used for super_admin role
};

// ✅ Role name mapping for consistency (canonical keys must exist in sidebarMenus)
export const roleMapping = {
  employee: "employee",
  manager: "manager",
  // treat "individual" like employee for menus (no dedicated menu defined)
  individual: "individual", // Changed to "individual" to use dedicated menu
  // common admin variants
  admin: "admin",
  org_admin: "org_admin", // changed from "admin" to "org_admin"
  company_admin: "admin",
  // super_admin uses dedicated SuperAdminLayout, not this config
};

// Canonicalize any incoming role to a sidebarMenus key
export const normalizeRole = (role) => {
  const key = String(role || "").toLowerCase();
  return roleMapping[key] || key;
};

export const getMenuByRole = (role) => {
  const key = normalizeRole(role);
  return sidebarMenus[key] || sidebarMenus.employee;
};

/** Match a menu `path` (may include query) against wouter pathname + search. */
export const menuItemMatchesLocation = (itemPath, pathname, search = "") => {
  if (!itemPath) return false;
  const searchNorm = search.startsWith("?") ? search.slice(1) : search;
  if (!itemPath.includes("?")) {
    return itemPath === pathname;
  }
  const [pathPart, queryPart] = itemPath.split("?");
  if (pathname !== pathPart) return false;
  const itemParams = new URLSearchParams(queryPart);
  const currentParams = new URLSearchParams(searchNorm);
  for (const [key, val] of itemParams) {
    if (currentParams.get(key) !== val) return false;
  }
  return true;
};

export const findActiveItem = (menu, pathname, search = "") => {
  for (const item of menu) {
    if (item.path && menuItemMatchesLocation(item.path, pathname, search)) {
      return item;
    }
    if (item.children) {
      const activeChild = findActiveItem(item.children, pathname, search);
      if (activeChild) return { parent: item, child: activeChild };
    }
  }
  return null;
};
