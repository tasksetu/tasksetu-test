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
    path: "/tasks/create",
  },
  quickTasks: {
    id: "quick-tasks",
    label: "Quick Tasks",
    icon: Zap,
    path: "/quick-tasks",
  },
  regularTasks: {
    id: "regular-tasks",
    label: "Regular Tasks",
    icon: RegularTaskIcon,
    path: "/regular-tasks",
  },
  recurring: {
    id: "recurring",
    label: "Recurring",
    icon: RecurringTaskIcon,
    path: "/recurring",
  },
  calendar: {
    id: "calendar",
    label: "Calendar",
    icon: Calendar,
    path: "/calendar",
  },

  approvals: {
    id: "approvals",
    label: "Approvals",
    icon: ApprovalTaskIcon,
    path: "/approvals",
  },
  milestones: {
    id: "milestones",
    label: "Milestones",
    icon: MilestoneTaskIcon,
    path: "/milestones",
  },
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
        icon: ClipboardCheck,
        path: "/form-builder",
      },
      {
        id: "form-version-history",
        label: "Form Version History",
        icon: Clock,
        path: "/form-version-history",
      },
    ],
  },
  // Settings for employee & manager (view only)
  settingsViewOnly: {
    id: "settings",
    label: "Settings",
    icon: Settings,
    children: [
      { id: "profile", label: "Profile", icon: User, path: "/profile" },
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
      { id: "profile", label: "Profile", icon: User, path: "/profile" },
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
};

// Role → menu mapping
export const sidebarMenus = {
  employee: [
    baseItems.dashboard,
    baseItems.myTasks,
    baseItems.createTask,
    baseItems.quickTasks,
    baseItems.regularTasks,
    baseItems.recurring,
    baseItems.calendar,
    baseItems.settingsViewOnly,
    baseItems.help,
    baseItems.logout,
  ],

  individual: [
    baseItems.dashboard,
    baseItems.myTasks,
    baseItems.createTask,
    baseItems.quickTasks,
    baseItems.regularTasks,
    baseItems.recurring,
    baseItems.calendar,
    baseItems.settingsManagement,
    baseItems.help,
    baseItems.logout,
  ],

  manager: [
    baseItems.dashboard,
    baseItems.myTasks,
    // { id: "team-tasks", label: "Team Tasks", icon: Users, path: "/tasks/team" },
    baseItems.createTask,
    baseItems.quickTasks,
    baseItems.calendar,
    baseItems.regularTasks,
    baseItems.recurring,
    baseItems.milestones,
    baseItems.approvals,
    {
      id: "reports",
      label: "Reporting & Analytics",
      icon: BarChart3,
      children: [
        {
          id: "organization-analytics",
          label: "Organization Analytics",
          icon: Building2,
          path: "/reports/organization",
        },
        {
          id: "my-productivity",
          label: "My Productivity",
          icon: TrendingUp,
          path: "/reports/productivity",
        },
        {
          id: "team-analytics",
          label: "Team Analytics",
          icon: PieChart,
          path: "/reports/team",
        },
        {
          id: "overdue-tasks",
          label: "Overdue Tasks",
          icon: AlertTriangle,
          path: "/overdue-tasks",
        },
      ],
    },
    baseItems.settingsViewOnly,
    baseItems.help,
    baseItems.logout,
  ],

  org_admin: [
    baseItems.dashboard,
    baseItems.myTasks,
    { id: "team-tasks", label: "Team Tasks", icon: Users, path: "/tasks/team" },
    baseItems.createTask,
    baseItems.quickTasks,
    baseItems.calendar,
    baseItems.regularTasks,
    baseItems.recurring,
    baseItems.milestones,
    baseItems.approvals,
    {
      id: "reports",
      label: "Reporting & Analytics",
      icon: BarChart3,
      children: [
        {
          id: "organization-analytics",
          label: "Organization Analytics",
          icon: Building2,
          path: "/reports/organization",
        },
        {
          id: "team-analytics",
          label: "Team Analytics",
          icon: PieChart,
          path: "/reports/team",
        },
        {
          id: "my-productivity",
          label: "My Productivity",
          icon: TrendingUp,
          path: "/reports/productivity",
        },
      ],
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
  ],

  superadmin: [
    {
      id: "platform-overview",
      label: "Platform Overview",
      icon: Monitor,
      path: "/superadmin/overview",
    },
    {
      id: "license-mapping",
      label: "License Mapping",
      icon: Key,
      path: "/superadmin/licenses",
    },
    {
      id: "system-configurations",
      label: "System Configurations",
      icon: Cog,
      path: "/superadmin/config",
    },
    {
      id: "notification-rules",
      label: "Global Notification Rules",
      icon: BellRing,
      path: "/superadmin/notifications",
    },
    {
      id: "platform-users",
      label: "All Platform Users",
      icon: Database,
      path: "/superadmin/users",
    },
    {
      id: "global-forms",
      label: "Global Form Library",
      icon: Library,
      path: "/superadmin/forms",
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: Activity,
      children: [
        {
          id: "adoption-metrics",
          label: "Adoption Metrics",
          icon: TrendingUp,
          path: "/superadmin/analytics/adoption",
        },
        {
          id: "module-usage",
          label: "Module Usage",
          icon: Layers,
          path: "/superadmin/analytics/modules",
        },
        {
          id: "system-performance",
          label: "System Performance",
          icon: Server,
          path: "/superadmin/analytics/performance",
        },
      ],
    },
    {
      id: "audit-logs",
      label: "Audit Logs",
      icon: FileSearch,
      path: "/superadmin/audit",
    },
    {
      id: "overrides",
      label: "Overrides",
      icon: UserCheck,
      path: "/superadmin/overrides",
    },
    { id: "my-profile", label: "My Profile", icon: User, path: "/profile" },
    baseItems.help,
    baseItems.logout,
  ],
};

// Role mapping
const roleMapping = {
  employee: "employee",
  manager: "manager",
  individual: "individual",
  org_admin: "org_admin",
  superadmin: "superadmin",
  super_admin: "superadmin",
};

export const getMenuByRole = (role) => {
  console.log("Getting menu for role:", roleMapping[role]);
  return sidebarMenus[roleMapping[role]] || sidebarMenus.employee;
};

export const findActiveItem = (menu, currentPath) => {
  for (const item of menu) {
    if (item.path === currentPath) return item;
    if (item.children) {
      const activeChild = findActiveItem(item.children, currentPath);
      if (activeChild) return { parent: item, child: activeChild };
    }
  }
  return null;
};import {
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
    path: "/tasks/create",
  },
  quickTasks: {
    id: "quick-tasks",
    label: "Quick Tasks",
    icon: Zap,
    path: "/quick-tasks",
  },
  regularTasks: {
    id: "regular-tasks",
    label: "Regular Tasks",
    icon: RegularTaskIcon,
    path: "/regular-tasks",
  },
  recurring: {
    id: "recurring",
    label: "Recurring",
    icon: RecurringTaskIcon,
    path: "/recurring",
  },
  calendar: {
    id: "calendar",
    label: "Calendar",
    icon: Calendar,
    path: "/calendar",
  },
  approvals: {
    id: "approvals",
    label: "Approvals",
    icon: ApprovalTaskIcon,
    path: "/approvals",
  },
  milestones: {
    id: "milestones",
    label: "Milestones",
    icon: MilestoneTaskIcon,
    path: "/milestones",
  },

  // Settings for employee & manager (view only)
  settingsViewOnly: {
    id: "settings",
    label: "Settings",
    icon: Settings,
    children: [
      { id: "profile", label: "Profile", icon: User, path: "/profile" },
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
      { id: "profile", label: "Profile", icon: User, path: "/profile" },
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
};

// Role → menu mapping
export const sidebarMenus = {
  employee: [
    baseItems.dashboard,
    baseItems.myTasks,
    baseItems.createTask,
    baseItems.quickTasks,
    baseItems.regularTasks,
    baseItems.recurring,
    baseItems.calendar,
    baseItems.settingsViewOnly,
    baseItems.help,
    baseItems.logout,
  ],

  individual: [
    baseItems.dashboard,
    baseItems.myTasks,
    baseItems.createTask,
    baseItems.quickTasks,
    baseItems.regularTasks,
    baseItems.recurring,
    baseItems.calendar,
    baseItems.settingsManagement,
    baseItems.help,
    baseItems.logout,
  ],

  manager: [
    baseItems.dashboard,
    baseItems.myTasks,
    { id: "team-tasks", label: "Team Tasks", icon: Users, path: "/tasks/team" },
    baseItems.createTask,
    baseItems.quickTasks,
    baseItems.calendar,
    baseItems.regularTasks,
    baseItems.recurring,
    baseItems.milestones,
    baseItems.approvals,
    {
      id: "reports",
      label: "Reporting & Analytics",
      icon: BarChart3,
      children: [
        {
          id: "my-productivity",
          label: "My Productivity",
          icon: TrendingUp,
          path: "/reports/productivity",
        },
        {
          id: "team-analytics",
          label: "Team Analytics",
          icon: PieChart,
          path: "/reports/team",
        },
        {
          id: "overdue-tasks",
          label: "Overdue Tasks",
          icon: AlertTriangle,
          path: "/overdue-tasks",
        },
      ],
    },
    baseItems.settingsViewOnly,
    baseItems.help,
    baseItems.logout,
  ],

  org_admin: [
    baseItems.dashboard,
    baseItems.myTasks,
    { id: "team-tasks", label: "Team Tasks", icon: Users, path: "/tasks/team" },
    baseItems.createTask,
    baseItems.quickTasks,
    baseItems.calendar,
    baseItems.regularTasks,
    baseItems.recurring,
    baseItems.milestones,
    baseItems.approvals,
    {
      id: "reports",
      label: "Reporting & Analytics",
      icon: BarChart3,
      children: [
        {
          id: "organization-analytics",
          label: "Organization Analytics",
          icon: Building2,
          path: "/reports/organization",
        },
        {
          id: "team-analytics",
          label: "Team Analytics",
          icon: PieChart,
          path: "/reports/team",
        },
        {
          id: "my-productivity",
          label: "My Productivity",
          icon: TrendingUp,
          path: "/reports/productivity",
        },
      ],
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
    baseItems.settingsManagement,
    baseItems.help,
    baseItems.logout,
  ],

  superadmin: [
    {
      id: "platform-overview",
      label: "Platform Overview",
      icon: Monitor,
      path: "/superadmin/overview",
    },
    {
      id: "license-mapping",
      label: "License Mapping",
      icon: Key,
      path: "/superadmin/licenses",
    },
    {
      id: "system-configurations",
      label: "System Configurations",
      icon: Cog,
      path: "/superadmin/config",
    },
    {
      id: "notification-rules",
      label: "Global Notification Rules",
      icon: BellRing,
      path: "/superadmin/notifications",
    },
    {
      id: "platform-users",
      label: "All Platform Users",
      icon: Database,
      path: "/superadmin/users",
    },
    {
      id: "global-forms",
      label: "Global Form Library",
      icon: Library,
      path: "/superadmin/forms",
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: Activity,
      children: [
        {
          id: "adoption-metrics",
          label: "Adoption Metrics",
          icon: TrendingUp,
          path: "/superadmin/analytics/adoption",
        },
        {
          id: "module-usage",
          label: "Module Usage",
          icon: Layers,
          path: "/superadmin/analytics/modules",
        },
        {
          id: "system-performance",
          label: "System Performance",
          icon: Server,
          path: "/superadmin/analytics/performance",
        },
      ],
    },
    {
      id: "audit-logs",
      label: "Audit Logs",
      icon: FileSearch,
      path: "/superadmin/audit",
    },
    {
      id: "overrides",
      label: "Overrides",
      icon: UserCheck,
      path: "/superadmin/overrides",
    },
    { id: "my-profile", label: "My Profile", icon: User, path: "/profile" },
    baseItems.help,
    baseItems.logout,
  ],
};

// Role mapping
const roleMapping = {
  employee: "employee",
  manager: "manager",
  individual: "individual",
  org_admin: "org_admin",
  superadmin: "superadmin",
  super_admin: "superadmin",
};

export const getMenuByRole = (role) => {
  console.log("Getting menu for role:", roleMapping[role]);
  return sidebarMenus[roleMapping[role]] || sidebarMenus.employee;
};

export const findActiveItem = (menu, currentPath) => {
  for (const item of menu) {
    if (item.path === currentPath) return item;
    if (item.children) {
      const activeChild = findActiveItem(item.children, currentPath);
      if (activeChild) return { parent: item, child: activeChild };
    }
  }
  return null;
};