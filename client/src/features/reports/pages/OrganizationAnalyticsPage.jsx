import React, { useEffect, useState } from "react";
import {
  CheckSquare,
  AlertTriangle,
  Users,
  Activity,
  CheckCircle,
  Target,
  Clock,
  TrendingUp,
  BarChart3,
  UserCheck,
  Calendar,
  Loader,
} from "lucide-react";
import {
  KPICard,
  TaskLineChart,
  TaskDonutChart,
  TaskBarChart,
  TaskHeatmap,
  ReportsFilterBar,
} from "../components";
import {
  useOrganizationAnalytics,
  useOverdueTasksReport,
  useProductivityEfficiencyReport,
  useWorkloadDistributionReport,
  useActivityEngagementReport,
  useMilestoneAchievementReport,
  useRecurringTaskAdherenceReport,
  useQuickTaskConversionReport,
  useTaskCompletionStatusReport,
} from "../hooks/useReports";
import { exportReport } from "../utils/exportUtils";
import useLicense from "../../../hooks/useLicense";
import { canAccessReport } from "../utils/rolePermissions";
import { useAuth } from "@/features/shared/hooks/useAuth";
import { useLocation } from "wouter";

/**
 * Analytics Page
 * Shows organization-wide performance, department comparisons, risk heatmap
 * Path: /reports/organization
 * Role: Org Admin (viewing full organization data)
 */
const OrganizationAnalyticsPage = () => {
  const [, navigate] = useLocation();
  const { user, isLoading: userLoading } = useAuth();
  const { features, isLoading: licenseLoading } = useLicense();
  const [activeTab, setActiveTab] = useState(null);
  const [orgUsers, setOrgUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  // Safety net: if license/user takes >8s, stop blocking the UI
  const [licenseTimedOut, setLicenseTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLicenseTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, []);
  const [tabInitComplete, setTabInitComplete] = useState(false);
  const [filters, setFilters] = useState({
    dateRange: "30",
    status: "",
    priority: "",
    department: "",
    user: "",
  });

  // Task Completion & Status Report
  const completionReport = useTaskCompletionStatusReport(filters, {
    enabled: activeTab === "completion",
    useExternalFilters: true,
  });

  // Main Organization Overview Report
  const overviewReport = useOrganizationAnalytics(filters, {
    enabled: activeTab === "overview",
    useExternalFilters: true,
  });

  // Individual Tab Reports - Only enabled when the tab is active
  const overdueReport = useOverdueTasksReport(filters, {
    enabled: activeTab === "overdue",
    useExternalFilters: true,
  });

  const productivityReport = useProductivityEfficiencyReport(filters, {
    enabled: activeTab === "productivity",
    useExternalFilters: true,
  });

  const workloadReport = useWorkloadDistributionReport(filters, {
    enabled: activeTab === "workload",
    useExternalFilters: true,
  });

  const activityReport = useActivityEngagementReport(filters, {
    enabled: activeTab === "activity",
    useExternalFilters: true,
  });

  const milestoneReport = useMilestoneAchievementReport(filters, {
    enabled: activeTab === "milestones",
    useExternalFilters: true,
  });

  const recurringReport = useRecurringTaskAdherenceReport(filters, {
    enabled: activeTab === "recurring",
    useExternalFilters: true,
  });

  const quickTaskReport = useQuickTaskConversionReport(filters, {
    enabled: activeTab === "quicktasks",
    useExternalFilters: true,
  });

  // Map active report based on current tab for top-level state (license, loading, error)
  const activeReport =
    activeTab === "completion"
      ? completionReport
      : activeTab === "overdue"
        ? overdueReport
        : activeTab === "productivity"
          ? productivityReport
          : activeTab === "workload"
            ? workloadReport
            : activeTab === "activity"
              ? activityReport
              : activeTab === "milestones"
                ? milestoneReport
                : activeTab === "recurring"
                  ? recurringReport
                  : activeTab === "quicktasks"
                    ? quickTaskReport
                    : overviewReport;

  const { data, loading, error, license: licenseInfo } = activeReport;

  const handleFilterChange = (newFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  // Fetch org users for the "User" filter dropdown
  useEffect(() => {
    let cancelled = false;
    const fetchOrgUsers = async () => {
      try {
        setUsersLoading(true);
        const token = localStorage.getItem("token");
        const res = await fetch("/api/organization-employees", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(await res.text());
        const payload = await res.json();

        const employees = payload?.employees || [];
        const mapped = employees.map((u) => ({
          id: u._id,
          name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email,
          email: u.email,
          department: u.department,
        }));

        if (!cancelled) setOrgUsers(mapped);
      } catch (e) {
        console.warn(
          "Failed to fetch organization users for report filters:",
          e,
        );
        if (!cancelled) setOrgUsers([]);
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    };

    fetchOrgUsers();
    return () => {
      cancelled = true;
    };
  }, []);

  const allTabs = [
    {
      id: "completion",
      label: "Completion & Status",
      icon: BarChart3,
      reportId: "task-completion-status",
    },
    {
      id: "overdue",
      label: "Overdue Tasks",
      icon: AlertTriangle,
      reportId: "overdue-tasks",
    },
    {
      id: "productivity",
      label: "Productivity",
      icon: TrendingUp,
      reportId: "productivity-efficiency",
    },
    {
      id: "workload",
      label: "Workload",
      icon: Users,
      reportId: "workload-distribution",
    },
    {
      id: "milestones",
      label: "Milestones",
      icon: Target,
      reportId: "milestone-achievement",
    },
    {
      id: "recurring",
      label: "Recurring",
      icon: Clock,
      reportId: "recurring-task-adherence",
    },
    {
      id: "quicktasks",
      label: "Quick Tasks",
      icon: CheckSquare,
      reportId: "quick-task-conversion",
    },
    {
      id: "activity",
      label: "Activity",
      icon: UserCheck,
      reportId: "activity-engagement",
    },
  ];

  // Filter tabs based on license and role
  const tabs = allTabs.filter((tab) =>
    canAccessReport(tab.reportId, user?.role, features),
  );

  // Set initial active tab to first available based on license
  useEffect(() => {
    const readyToDecide = !licenseLoading && !userLoading;
    const timedOut = licenseTimedOut;
    if ((readyToDecide || timedOut) && !tabInitComplete) {
      if (tabs.length > 0 && !activeTab) {
        setActiveTab(tabs[0].id);
      }
      setTabInitComplete(true);
    }
  }, [
    tabs,
    licenseLoading,
    userLoading,
    licenseTimedOut,
    activeTab,
    tabInitComplete,
  ]);

  const handleExport = (format) => {
    if (!data) return;

    // Check if license is expired
    const licenseExpired =
      licenseInfo?.isExpired ||
      licenseInfo?.status === "expired" ||
      error?.toString().includes("EXPIRED");

    if (licenseExpired) {
      alert(
        "Reporting exports are disabled for expired licenses. Please renew your subscription.",
      );
      return;
    }

    const completionRate =
      data?.kpis?.totalOrgTasks > 0
        ? ((data.kpis.completed / data.kpis.totalOrgTasks) * 100).toFixed(1)
        : 0;

    const title = "Analytics Report";
    const filename = `organization-analytics-${new Date().toISOString().slice(0, 10)}`;

    // Multi-tab PDF export (important tables for all tabs)
    if (String(format).toLowerCase() === "pdf") {
      const dateRangeLabel =
        filters?.startDate && filters?.endDate
          ? `${filters.startDate} to ${filters.endDate}`
          : filters?.dateRange
            ? `Last ${filters.dateRange} days`
            : "—";

      const sections = [
        {
          title: "Overview",
          summary: {
            "Date range": dateRangeLabel,
            "Total Organization Tasks": data?.kpis?.totalOrgTasks || 0,
            Completed: data?.kpis?.completed || 0,
            "Active Teams": data?.kpis?.activeTeams || 0,
            "Risk Tasks": data?.kpis?.riskTasks || 0,
            "Completion Rate": `${completionRate}%`,
          },
          tables: [
            {
              title: "Department Performance Summary",
              columns: [
                { header: "Department", key: "department" },
                { header: "Total", key: "total" },
                { header: "Completed", key: "completed" },
                { header: "In Progress", key: "inProgress" },
                { header: "Open", key: "open" },
                { header: "Overdue", key: "overdue" },
                { header: "Completion %", key: "completionPercent" },
              ],
              data: (data?.tasksByDepartment || []).map((d) => ({
                department: d.name,
                total: d.tasks ?? 0,
                completed: d.completed ?? 0,
                inProgress: d.inProgress ?? 0,
                open: d.open ?? 0,
                overdue: d.overdue ?? 0,
                completionPercent:
                  d.tasks > 0
                    ? `${((d.completed / d.tasks) * 100).toFixed(1)}%`
                    : "0%",
              })),
            },
          ],
        },
        {
          title: "Overdue Tasks",
          summary: {
            "Total Overdue": overdueReport.data?.summary?.totalOverdue ?? 0,
            "Critical Overdue":
              overdueReport.data?.summary?.criticalOverdue ?? 0,
            "High Priority Overdue":
              overdueReport.data?.summary?.highPriorityOverdue ?? 0,
          },
          tables: [
            {
              title: "Overdue by User",
              columns: [
                { header: "User", key: "userName" },
                { header: "Total Overdue", key: "totalOverdue" },
                { header: "Critical Overdue", key: "criticalOverdue" },
              ],
              data: (overdueReport.data?.overdueByUser || []).map((u) => ({
                userName: u.userName,
                totalOverdue: u.totalOverdue ?? 0,
                criticalOverdue: u.criticalOverdue ?? 0,
              })),
            },
            {
              title: "Top Overdue Tasks (Top 10)",
              columns: [
                { header: "Task", key: "title" },
                { header: "Assignee", key: "userName" },
                { header: "Priority", key: "priority" },
                { header: "Days Overdue", key: "overdueDays" },
              ],
              data: (overdueReport.data?.overdueTasks || [])
                .slice(0, 10)
                .map((t) => ({
                  title: t.title,
                  userName: t.userName || t.assignee || "—",
                  priority: t.priority || "—",
                  overdueDays: t.overdueDays ?? "—",
                })),
            },
          ],
        },
        {
          title: "Productivity & Efficiency",
          summary: {
            "Total Completed":
              productivityReport.data?.summary?.totalCompleted ?? 0,
            "On Time": productivityReport.data?.summary?.onTime ?? 0,
            Late: productivityReport.data?.summary?.late ?? 0,
            "On-Time Rate": `${productivityReport.data?.summary?.onTimePercentage ?? 0}%`,
          },
          tables: [
            {
              title: "Efficiency by Priority",
              columns: [
                { header: "Priority", key: "priority" },
                { header: "Total Completed", key: "total" },
                { header: "On Time", key: "onTime" },
                { header: "Efficiency %", key: "efficiency" },
              ],
              data: (productivityReport.data?.efficiencyByPriority || []).map(
                (p) => ({
                  priority: p.priority,
                  total: p.total ?? 0,
                  onTime: p.onTime ?? 0,
                  efficiency: `${p.efficiency ?? 0}%`,
                }),
              ),
            },
            {
              title: "User Efficiency Rankings (Top 10)",
              columns: [
                { header: "User", key: "userName" },
                { header: "Total Tasks", key: "totalTasks" },
                { header: "On Time", key: "onTimeTasks" },
                { header: "Efficiency %", key: "efficiency" },
              ],
              data: (productivityReport.data?.userEfficiency || [])
                .slice(0, 10)
                .map((u) => ({
                  userName: u.userName,
                  totalTasks: u.totalTasks ?? 0,
                  onTimeTasks: u.onTimeTasks ?? 0,
                  efficiency: `${u.efficiency ?? 0}%`,
                })),
            },
          ],
        },
        {
          title: "Workload Distribution",
          summary: {
            "Total Users": workloadReport.data?.summary?.totalUsers ?? 0,
            "Active Users": workloadReport.data?.summary?.activeUsers ?? 0,
            "Avg Tasks/User":
              workloadReport.data?.summary?.averageTasksPerUser ?? 0,
            Overloaded: workloadReport.data?.summary?.overloaded ?? 0,
          },
          tables: [
            {
              title: "Workload by Department",
              columns: [
                { header: "Department", key: "department" },
                { header: "Users", key: "totalUsers" },
                { header: "Total Tasks", key: "totalTasks" },
                { header: "Avg Tasks/User", key: "averageTasksPerUser" },
              ],
              data: (workloadReport.data?.departmentWorkload || []).map(
                (d) => ({
                  department: d.department,
                  totalUsers: d.totalUsers ?? 0,
                  totalTasks: d.totalTasks ?? 0,
                  averageTasksPerUser: d.averageTasksPerUser ?? 0,
                }),
              ),
            },
            {
              title: "Individual User Workload (Top 20)",
              columns: [
                { header: "User", key: "userName" },
                { header: "Department", key: "department" },
                { header: "Total Tasks", key: "totalTasks" },
                { header: "High Priority", key: "highPriority" },
                { header: "In Progress", key: "inProgress" },
              ],
              data: (workloadReport.data?.workloadDistribution || [])
                .slice(0, 20)
                .map((u) => ({
                  userName: u.userName,
                  department: u.department,
                  totalTasks: u.totalTasks ?? 0,
                  highPriority:
                    (u.byPriority?.high ?? 0) + (u.byPriority?.urgent ?? 0),
                  inProgress: u.byStatus?.inProgress ?? 0,
                })),
            },
          ],
        },
        {
          title: "Milestones",
          summary: {
            "Total Milestones":
              milestoneReport.data?.summary?.totalMilestones ?? 0,
            Achieved: milestoneReport.data?.summary?.achieved ?? 0,
            Missed: milestoneReport.data?.summary?.missed ?? 0,
            "In Progress": milestoneReport.data?.summary?.inProgress ?? 0,
            "Achievement Rate": `${milestoneReport.data?.summary?.achievementRate ?? 0}%`,
          },
          tables: [
            {
              title: "Recent Milestones (Top 10)",
              columns: [
                { header: "Title", key: "title" },
                { header: "Assignee", key: "assignee" },
                { header: "Status", key: "status" },
                { header: "Due", key: "dueDate" },
                { header: "Completed", key: "completedAt" },
              ],
              data: (milestoneReport.data?.recentMilestones || [])
                .slice(0, 10)
                .map((m) => ({
                  title: m.title,
                  assignee: m.assignee,
                  status: m.status,
                  dueDate: m.dueDate,
                  completedAt: m.completedAt || "—",
                })),
            },
          ],
        },
        {
          title: "Recurring Task Adherence",
          summary: {
            "Total Recurring":
              recurringReport.data?.summary?.totalRecurring ?? 0,
            Completed: recurringReport.data?.summary?.completed ?? 0,
            "On Time": recurringReport.data?.summary?.onTime ?? 0,
            Missed: recurringReport.data?.summary?.missed ?? 0,
            "On-time Rate": `${recurringReport.data?.summary?.adherenceRate ?? 0}%`,
          },
          tables: [
            {
              title: "Missed Recurring Tasks (Top 10)",
              columns: [
                { header: "Task", key: "title" },
                { header: "Assignee", key: "assignee" },
                { header: "Type", key: "missedType" },
                { header: "Due", key: "dueDate" },
                { header: "Completed", key: "completedAt" },
              ],
              data: (recurringReport.data?.recentMissedRecurring || [])
                .slice(0, 10)
                .map((t) => ({
                  title: t.title,
                  assignee: t.assignee,
                  missedType: t.missedType,
                  dueDate: t.dueDate,
                  completedAt: t.completedAt || "—",
                })),
            },
          ],
        },
        {
          title: "Quick Task Conversion",
          summary: {
            "Total Quick Tasks":
              quickTaskReport.data?.summary?.totalQuickTasks ?? 0,
            "Converted to Full Tasks":
              quickTaskReport.data?.summary?.convertedTasks ?? 0,
            "Conversion Rate": `${quickTaskReport.data?.summary?.conversionRate ?? 0}%`,
          },
          tables: [
            {
              title: "Recent Conversions (Top 10)",
              columns: [
                { header: "Quick Task", key: "title" },
                { header: "User", key: "assignee" },
                { header: "Created", key: "createdAt" },
                { header: "Converted", key: "lastModified" },
              ],
              data: (quickTaskReport.data?.recentConversions || [])
                .slice(0, 10)
                .map((t) => ({
                  title: t.title,
                  assignee: t.assignee,
                  createdAt: t.createdAt,
                  lastModified: t.lastModified,
                })),
            },
          ],
        },
        {
          title: "Activity & Engagement",
          summary: {
            "Total Users": activityReport.data?.summary?.totalUsers ?? 0,
            "Active Users": activityReport.data?.summary?.activeUsers ?? 0,
            "Total Comments": activityReport.data?.summary?.totalComments ?? 0,
            "Total Updates": activityReport.data?.summary?.totalUpdates ?? 0,
            "Logins (signal)": activityReport.data?.summary?.totalLogins ?? 0,
            "Engagement Rate": `${activityReport.data?.summary?.engagementRate ?? 0}%`,
          },
          tables: [
            {
              title: "Engagement by Department",
              columns: [
                { header: "Department", key: "name" },
                { header: "Users", key: "users" },
                { header: "Total Score", key: "totalScore" },
                { header: "Avg Score", key: "avgScore" },
              ],
              data: (activityReport.data?.departmentEngagement || []).map(
                (d) => ({
                  name: d.name,
                  users: d.users ?? 0,
                  totalScore: d.totalScore ?? 0,
                  avgScore: d.avgScore ?? 0,
                }),
              ),
            },
            {
              title: "Top Contributors (Top 10)",
              columns: [
                { header: "User", key: "name" },
                { header: "Comments", key: "commentsCount" },
                { header: "Tasks Completed", key: "tasksCompleted" },
                { header: "Updates", key: "updatesCount" },
                { header: "Logins", key: "loginsCount" },
                { header: "Score", key: "engagementScore" },
              ],
              data: (activityReport.data?.userEngagement || [])
                .slice(0, 10)
                .map((u) => ({
                  name: u.name,
                  commentsCount: u.commentsCount ?? 0,
                  tasksCompleted: u.tasksCompleted ?? 0,
                  updatesCount: u.updatesCount ?? 0,
                  loginsCount: u.loginsCount ?? 0,
                  engagementScore: u.engagementScore ?? 0,
                })),
            },
          ],
        },
      ];

      return exportReport("pdf", { title, filename, sections });
    }

    const summary = {
      "Total Organization Tasks": data?.kpis?.totalOrgTasks || 0,
      Completed: data?.kpis?.completed || 0,
      "Active Teams": data?.kpis?.activeTeams || 0,
      "Risk Tasks": data?.kpis?.riskTasks || 0,
      "Completion Rate": `${completionRate}%`,
    };

    const columns = [
      { header: "Team/Department", key: "team" },
      { header: "Total Tasks", key: "total" },
      { header: "Completed", key: "completed" },
      { header: "In Progress", key: "inProgress" },
      { header: "Risk", key: "risk" },
    ];

    // Prepare department performance data for export
    const exportData = (data.departmentPerformance || []).map((dept) => ({
      team: dept.name,
      total: dept.total || 0,
      completed: dept.completed || 0,
      inProgress: dept.inProgress || 0,
      risk: dept.risk || 0,
    }));

    exportReport(format, title, exportData, columns, summary, filename);
  };

  // Export handlers for individual tabs
  const handleExportCompletion = (format) => {
    if (!completionReport.data) return;
    const title = "Task Completion & Status Report";
    const filename = `completion-report-${new Date().toISOString().slice(0, 10)}`;
    const columns = [
      { header: "Status", key: "status" },
      { header: "Count", key: "count" },
      { header: "Percentage", key: "percentage" },
    ];
    const exportData = (completionReport.data?.statusDistribution || []).map(
      (s) => ({
        status: s.name || s.status,
        count: s.value || 0,
        percentage: `${s.percentage || 0}%`,
      }),
    );
    const summary = {
      "Total Tasks": completionReport.data?.kpis?.totalTasks || 0,
      Completed: completionReport.data?.kpis?.completed || 0,
      "In Progress": completionReport.data?.kpis?.inProgress || 0,
      Open: completionReport.data?.kpis?.open || 0,
    };
    exportReport(format, title, exportData, columns, summary, filename);
  };

  const handleExportOverdue = (format) => {
    if (!overdueReport.data) return;
    const title = "Overdue Tasks Report";
    const filename = `overdue-report-${new Date().toISOString().slice(0, 10)}`;
    const columns = [
      { header: "Task", key: "title" },
      { header: "Assignee", key: "userName" },
      { header: "Priority", key: "priority" },
      { header: "Days Overdue", key: "overdueDays" },
    ];
    const exportData = (overdueReport.data?.overdueTasks || []).map((t) => ({
      title: t.title,
      userName: t.userName || t.assignee || "—",
      priority: t.priority || "—",
      overdueDays: t.overdueDays || 0,
    }));
    const summary = {
      "Total Overdue": overdueReport.data?.summary?.totalOverdue || 0,
      "Critical Overdue": overdueReport.data?.summary?.criticalOverdue || 0,
      "High Priority Overdue":
        overdueReport.data?.summary?.highPriorityOverdue || 0,
    };
    exportReport(format, title, exportData, columns, summary, filename);
  };

  const handleExportProductivity = (format) => {
    if (!productivityReport.data) return;
    const title = "Productivity & Efficiency Report";
    const filename = `productivity-report-${new Date().toISOString().slice(0, 10)}`;
    const columns = [
      { header: "User", key: "userName" },
      { header: "Total Tasks", key: "totalTasks" },
      { header: "On Time", key: "onTimeTasks" },
      { header: "Efficiency %", key: "efficiency" },
    ];
    const exportData = (productivityReport.data?.userEfficiency || []).map(
      (u) => ({
        userName: u.userName,
        totalTasks: u.totalTasks || 0,
        onTimeTasks: u.onTimeTasks || 0,
        efficiency: u.efficiency || 0,
      }),
    );
    const summary = {
      "Total Completed": productivityReport.data?.summary?.totalCompleted || 0,
      "On Time": productivityReport.data?.summary?.onTime || 0,
      Late: productivityReport.data?.summary?.late || 0,
      "On-Time Rate": `${productivityReport.data?.summary?.onTimePercentage || 0}%`,
    };
    exportReport(format, title, exportData, columns, summary, filename);
  };

  const handleExportWorkload = (format) => {
    if (!workloadReport.data) return;
    const title = "Workload Distribution Report";
    const filename = `workload-report-${new Date().toISOString().slice(0, 10)}`;
    const columns = [
      { header: "User", key: "userName" },
      { header: "Department", key: "department" },
      { header: "Total Tasks", key: "totalTasks" },
      { header: "High Priority", key: "highPriority" },
      { header: "In Progress", key: "inProgress" },
    ];
    const exportData = (workloadReport.data?.workloadDistribution || []).map(
      (u) => ({
        userName: u.userName,
        department: u.department,
        totalTasks: u.totalTasks || 0,
        highPriority: (u.byPriority?.high || 0) + (u.byPriority?.urgent || 0),
        inProgress: u.byStatus?.inProgress || 0,
      }),
    );
    const summary = {
      "Total Users": workloadReport.data?.summary?.totalUsers || 0,
      "Active Users": workloadReport.data?.summary?.activeUsers || 0,
      "Avg Tasks/User": workloadReport.data?.summary?.averageTasksPerUser || 0,
      Overloaded: workloadReport.data?.summary?.overloaded || 0,
    };
    exportReport(format, title, exportData, columns, summary, filename);
  };

  const handleExportMilestones = (format) => {
    if (!milestoneReport.data) return;
    const title = "Milestones Report";
    const filename = `milestones-report-${new Date().toISOString().slice(0, 10)}`;
    const columns = [
      { header: "Title", key: "title" },
      { header: "Assignee", key: "assignee" },
      { header: "Status", key: "status" },
      { header: "Due Date", key: "dueDate" },
    ];
    const exportData = (milestoneReport.data?.recentMilestones || []).map(
      (m) => ({
        title: m.title,
        assignee: m.assignee || "—",
        status: m.status,
        dueDate: m.dueDate || "—",
      }),
    );
    const summary = {
      "Total Milestones": milestoneReport.data?.summary?.totalMilestones || 0,
      Achieved: milestoneReport.data?.summary?.achieved || 0,
      Missed: milestoneReport.data?.summary?.missed || 0,
      "Achievement Rate": `${milestoneReport.data?.summary?.achievementRate || 0}%`,
    };
    exportReport(format, title, exportData, columns, summary, filename);
  };

  const handleExportRecurring = (format) => {
    if (!recurringReport.data) return;
    const title = "Recurring Task Adherence Report";
    const filename = `recurring-report-${new Date().toISOString().slice(0, 10)}`;
    const columns = [
      { header: "Task", key: "title" },
      { header: "Assignee", key: "assignee" },
      { header: "Type", key: "missedType" },
      { header: "Due Date", key: "dueDate" },
    ];
    const exportData = (recurringReport.data?.recentMissedRecurring || []).map(
      (t) => ({
        title: t.title,
        assignee: t.assignee || "—",
        missedType: t.missedType || "—",
        dueDate: t.dueDate || "—",
      }),
    );
    const summary = {
      "Total Recurring": recurringReport.data?.summary?.totalRecurring || 0,
      Completed: recurringReport.data?.summary?.completed || 0,
      "On Time": recurringReport.data?.summary?.onTime || 0,
      Missed: recurringReport.data?.summary?.missed || 0,
    };
    exportReport(format, title, exportData, columns, summary, filename);
  };

  const handleExportQuickTasks = (format) => {
    if (!quickTaskReport.data) return;
    const title = "Quick Task Conversion Report";
    const filename = `quick-tasks-report-${new Date().toISOString().slice(0, 10)}`;
    const columns = [
      { header: "Quick Task", key: "title" },
      { header: "User", key: "assignee" },
      { header: "Created", key: "createdAt" },
      { header: "Converted", key: "lastModified" },
    ];
    const exportData = (quickTaskReport.data?.recentConversions || []).map(
      (t) => ({
        title: t.title,
        assignee: t.assignee || "—",
        createdAt: t.createdAt || "—",
        lastModified: t.lastModified || "—",
      }),
    );
    const summary = {
      "Total Quick Tasks": quickTaskReport.data?.summary?.totalQuickTasks || 0,
      Converted: quickTaskReport.data?.summary?.convertedTasks || 0,
      "Conversion Rate": `${quickTaskReport.data?.summary?.conversionRate || 0}%`,
    };
    exportReport(format, title, exportData, columns, summary, filename);
  };

  const handleExportActivity = (format) => {
    if (!activityReport.data) return;
    const title = "Activity & Engagement Report";
    const filename = `activity-report-${new Date().toISOString().slice(0, 10)}`;
    const columns = [
      { header: "User", key: "name" },
      { header: "Comments", key: "commentsCount" },
      { header: "Tasks Completed", key: "tasksCompleted" },
      { header: "Updates", key: "updatesCount" },
      { header: "Engagement Score", key: "engagementScore" },
    ];
    const exportData = (activityReport.data?.userEngagement || []).map((u) => ({
      name: u.name,
      commentsCount: u.commentsCount || 0,
      tasksCompleted: u.tasksCompleted || 0,
      updatesCount: u.updatesCount || 0,
      engagementScore: u.engagementScore || 0,
    }));
    const summary = {
      "Total Users": activityReport.data?.summary?.totalUsers || 0,
      "Active Users": activityReport.data?.summary?.activeUsers || 0,
      "Engagement Rate": `${activityReport.data?.summary?.engagementRate || 0}%`,
    };
    exportReport(format, title, exportData, columns, summary, filename);
  };

  if (error) {
    console.error("🚨 Analytics Error:", error);

    // Check if this is a license error (expired or feature not included)
    let isLicenseError = false;
    const errStr = error?.message || String(error);

    try {
      // Handle JSON error responses from API
      const parsed = JSON.parse(errStr);
      isLicenseError =
        parsed.error?.includes("EXPIRED") ||
        parsed.reason?.includes("EXPIRED") ||
        parsed.message?.toLowerCase().includes("expired") ||
        parsed.error === "FEATURE_NOT_IN_LICENSE" ||
        parsed.error === "SUBSCRIPTION_EXPIRED" ||
        parsed.error === "TRIAL_EXPIRED";
    } catch (e) {
      // Fallback to string matching
      isLicenseError =
        errStr.includes("EXPIRED") ||
        errStr.includes("FEATURE_NOT_IN_LICENSE") ||
        errStr.includes("403") ||
        errStr.includes("Forbidden");
    }

    // Capture specific error message for technical display
    let errMessage = "An error occurred while fetching report data.";
    try {
      const parsed = JSON.parse(errStr);
      errMessage = parsed.message || parsed.error || errStr;
    } catch (e) {
      errMessage = errStr;
    }

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="p-7 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Activity className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Failed to load report
            </h3>
            <div className="bg-red-50 p-3 rounded text-sm text-red-700 border border-red-100 mb-3 break-words">
              {errMessage}
            </div>
            {isLicenseError && (
              <p className="text-sm text-amber-700 mb-3 font-medium">
                ⚠️ This may be due to an expired license. Please check your
                billing settings.
              </p>
            )}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-sm transition-colors"
              >
                Try Again
              </button>
              {isLicenseError && (
                <button
                  onClick={() => (window.location.href = "/admin/billing")}
                  className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 px-4 rounded-sm transition-colors"
                >
                  Go to Billing
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // License loaded but no reports are accessible (expired / no plan / wrong role)
  if (!activeTab && tabInitComplete) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">📄</span>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No Reports Available
          </h3>
          <p className="text-gray-600 mb-4">
            Your current plan does not include access to any analytics reports,
            or your subscription may have expired.
          </p>
          <button
            onClick={() => navigate("/admin/subscription")}
            className="inline-block px-5 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 transition-colors font-medium"
          >
            View Billing &amp; Upgrade
          </button>
        </div>
      </div>
    );
  }

  // Full-screen init loader (tabs not ready yet)
  if (!activeTab && !tabInitComplete) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader className="w-8 h-8 animate-spin text-blue-600" />
          <h3 className="text-lg font-medium text-gray-900">
            Loading Analytics
          </h3>
          <p className="text-sm text-gray-500">
            Checking license and report access...
          </p>
        </div>
      </div>
    );
  }

  const completionRate =
    data?.kpis?.totalOrgTasks > 0
      ? ((data.kpis.completed / data.kpis.totalOrgTasks) * 100).toFixed(1)
      : 0;

  const renderTabContent = () => {
    switch (activeTab) {
      case "completion":
        return renderCompletionTab();
      case "overdue":
        return renderOverdueTab();
      case "productivity":
        return renderProductivityTab();
      case "workload":
        return renderWorkloadTab();
      case "milestones":
        return renderMilestonesTab();
      case "recurring":
        return renderRecurringTab();
      case "quicktasks":
        return renderQuickTasksTab();
      case "activity":
        return renderActivityTab();
      default:
        return renderCompletionTab();
    }
  };

  const renderCompletionTab = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 mb-3">
          📊 Task Completion & Status Report
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => handleExportCompletion("pdf")}
            className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-sm hover:bg-red-700 transition-colors text-sm font-medium"
          >
            📄 PDF
          </button>
          <button
            onClick={() => handleExportCompletion("excel")}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-sm hover:bg-green-700 transition-colors text-sm font-medium"
          >
            📊 Excel
          </button>
          <button
            onClick={() => handleExportCompletion("csv")}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            📋 CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-3">
        <KPICard
          title="Total Tasks"
          value={completionReport.data?.kpis?.totalTasks || 0}
          icon={CheckSquare}
          color="blue"
          description="Total tasks found"
          loading={completionReport.loading}
        />
        <KPICard
          title="Open"
          value={completionReport.data?.kpis?.open || 0}
          icon={Activity}
          color="indigo"
          description="Not yet started"
          loading={completionReport.loading}
        />
        <KPICard
          title="In Progress"
          value={completionReport.data?.kpis?.inProgress || 0}
          icon={TrendingUp}
          color="yellow"
          description="Currently working"
          loading={completionReport.loading}
        />
        <KPICard
          title="Completed"
          value={completionReport.data?.kpis?.completed || 0}
          icon={CheckCircle}
          color="green"
          description="Finished tasks"
          loading={completionReport.loading}
        />
        <KPICard
          title="Overdue"
          value={completionReport.data?.kpis?.overdue || 0}
          icon={AlertTriangle}
          color="red"
          description="Past due date"
          loading={completionReport.loading}
        />
        <KPICard
          title="On Hold"
          value={completionReport.data?.kpis?.onHold || 0}
          icon={Clock}
          color="orange"
          description="Paused tasks"
          loading={completionReport.loading}
        />
      </div>

      {/* Status Distribution Chart */}
      <TaskDonutChart
        data={completionReport.data?.statusDistribution || []}
        title="Status Overview"
        colors={["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#6b7280"]}
        height={350}
        loading={completionReport.loading}
      />
    </div>
  );

  const renderOverdueTab = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 mb-3">
          ⏰ Overdue Tasks Report
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => handleExportOverdue("pdf")}
            className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-sm hover:bg-red-700 transition-colors text-sm font-medium"
          >
            📄 PDF
          </button>
          <button
            onClick={() => handleExportOverdue("excel")}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-sm hover:bg-green-700 transition-colors text-sm font-medium"
          >
            📊 Excel
          </button>
          <button
            onClick={() => handleExportOverdue("csv")}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            📋 CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <KPICard
          title="Total Overdue"
          value={overdueReport.data?.summary?.totalOverdue || 0}
          icon={AlertTriangle}
          color="red"
          description="Tasks past due"
          loading={overdueReport.loading}
        />
        <KPICard
          title="Critical Overdue"
          value={overdueReport.data?.summary?.criticalOverdue || 0}
          icon={Calendar}
          color="orange"
          description="7+ days overdue"
          loading={overdueReport.loading}
        />
        <KPICard
          title="High Priority Overdue"
          value={overdueReport.data?.summary?.highPriorityOverdue || 0}
          icon={TrendingUp}
          color="yellow"
          description="Urgent/High priority"
          loading={overdueReport.loading}
        />
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Overdue by User Table */}
        <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Overdue by User
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 font-medium text-gray-600">
                    User
                  </th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">
                    Total
                  </th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">
                    Critical
                  </th>
                </tr>
              </thead>
              <tbody>
                {(overdueReport.data?.overdueByUser || []).map(
                  (user, index) => (
                    <tr
                      key={index}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-2 px-2 font-medium text-gray-900">
                        {user.userName}
                      </td>
                      <td className="py-2 px-2 text-red-600 text-right font-medium">
                        {user.totalOverdue}
                      </td>
                      <td className="py-2 px-2 text-orange-600 text-right font-medium">
                        {user.criticalOverdue}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Individual Overdue Tasks */}
        <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Top Overdue Tasks
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 font-medium text-gray-600">
                    Task
                  </th>
                  <th className="text-center py-2 px-2 font-medium text-gray-600">
                    Priority
                  </th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">
                    Days
                  </th>
                </tr>
              </thead>
              <tbody>
                {(overdueReport.data?.overdueTasks || [])
                  .slice(0, 10)
                  .map((task, index) => (
                    <tr
                      key={index}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td
                        className="py-2 px-2 text-gray-900 truncate max-w-32"
                        title={task.title}
                      >
                        {task.title.length > 25
                          ? `${task.title.substring(0, 25)}...`
                          : task.title}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            task.priority === "urgent"
                              ? "bg-red-100 text-red-800"
                              : task.priority === "high"
                                ? "bg-orange-100 text-orange-800"
                                : task.priority === "medium"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-green-100 text-green-800"
                          }`}
                        >
                          {task.priority?.charAt(0).toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-red-600 text-right font-medium">
                        {task.overdueDays}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const renderProductivityTab = () => {
    // Debug productivity data
    console.log("🔍 Productivity Tab Render:", {
      hasData: !!productivityReport.data,
      data: productivityReport.data,
      loading: productivityReport.loading,
      error: productivityReport.error,
      summary: productivityReport.data?.summary,
    });

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            📈 Productivity & Efficiency
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => handleExportProductivity("pdf")}
              className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-sm hover:bg-red-700 transition-colors text-sm font-medium"
            >
              📄 PDF
            </button>
            <button
              onClick={() => handleExportProductivity("excel")}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-sm hover:bg-green-700 transition-colors text-sm font-medium"
            >
              📊 Excel
            </button>
            <button
              onClick={() => handleExportProductivity("csv")}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              📋 CSV
            </button>
          </div>
        </div>

        {/* Error Message */}
        {productivityReport.error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-3">
            <p>
              <strong>Error loading productivity data:</strong>{" "}
              {productivityReport.error.message || productivityReport.error}
            </p>
          </div>
        )}

        {/* No Data Message */}
        {!productivityReport.loading &&
          !productivityReport.error &&
          productivityReport.data?.summary?.totalCompleted === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded mb-3">
              <p>
                <strong>No productivity data available.</strong> Complete some
                tasks with due dates to see productivity metrics.
              </p>
            </div>
          )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <KPICard
            title="Total Completed"
            value={productivityReport.data?.summary?.totalCompleted || 0}
            icon={CheckCircle}
            color="blue"
            description="Tasks completed"
            loading={productivityReport.loading}
          />
          <KPICard
            title="On Time"
            value={productivityReport.data?.summary?.onTime || 0}
            icon={CheckSquare}
            color="green"
            description="Completed on time"
            loading={productivityReport.loading}
          />
          <KPICard
            title="Late"
            value={productivityReport.data?.summary?.late || 0}
            icon={AlertTriangle}
            color="red"
            description="Completed late"
            loading={productivityReport.loading}
          />
          <KPICard
            title="On-Time Rate"
            value={`${productivityReport.data?.summary?.onTimePercentage || 0}%`}
            icon={TrendingUp}
            color="teal"
            description="Efficiency %"
            loading={productivityReport.loading}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
          <TaskDonutChart
            title="Efficiency by Priority"
            height={300}
            loading={productivityReport.loading}
            colors={["#ef4444", "#f59e0b", "#3b82f6", "#10b981"]}
            data={(productivityReport.data?.efficiencyByPriority || []).map(
              (p) => ({
                name: p.priority,
                value: p.efficiency || 0,
              }),
            )}
          />

          <TaskLineChart
            data={productivityReport.data?.weeklyEfficiency || []}
            // Use the actual date field so TaskLineChart parses a real date,
            // avoiding bogus year 2001 from strings like "Week 1"
            xKey="date"
            lines={[
              {
                key: "efficiency",
                color: "#3b82f6",
                name: "Weekly Efficiency %",
              },
            ]}
            title="Weekly Efficiency Trend"
            height={300}
            loading={productivityReport.loading}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                  Rank
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                  User
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  Total Tasks
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  On Time
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  Efficiency %
                </th>
              </tr>
            </thead>
            <tbody>
              {(productivityReport.data?.userEfficiency || []).map(
                (user, index) => (
                  <tr
                    key={index}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">
                      #{index + 1}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900">
                      {user.userName}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 text-right">
                      {user.totalTasks}
                    </td>
                    <td className="py-3 px-4 text-sm text-green-600 text-right font-medium">
                      {user.onTimeTasks}
                    </td>
                    <td className="py-3 px-4 text-sm text-blue-600 text-right font-bold">
                      {user.efficiency}%
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderWorkloadTab = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          ⚖️ Workload Distribution Report
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => handleExportWorkload("pdf")}
            className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-sm hover:bg-red-700 transition-colors text-sm font-medium"
          >
            📄 PDF
          </button>
          <button
            onClick={() => handleExportWorkload("excel")}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-sm hover:bg-green-700 transition-colors text-sm font-medium"
          >
            📊 Excel
          </button>
          <button
            onClick={() => handleExportWorkload("csv")}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            📋 CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
        <KPICard
          title="Total Users"
          value={workloadReport.data?.summary?.totalUsers || 0}
          icon={Users}
          color="blue"
          description="In organization"
          loading={workloadReport.loading}
        />
        <KPICard
          title="Active Users"
          value={workloadReport.data?.summary?.activeUsers || 0}
          icon={UserCheck}
          color="green"
          description="With assigned tasks"
          loading={workloadReport.loading}
        />
        <KPICard
          title="Avg Tasks/User"
          value={workloadReport.data?.summary?.averageTasksPerUser || 0}
          icon={BarChart3}
          color="teal"
          description="Average workload"
          loading={workloadReport.loading}
        />
        <KPICard
          title="Overloaded"
          value={workloadReport.data?.summary?.overloaded || 0}
          icon={AlertTriangle}
          color="red"
          description="Users above avg"
          loading={workloadReport.loading}
        />
      </div>

      {/* Department Workload Chart */}
      <div className="mb-3">
        <TaskBarChart
          data={workloadReport.data?.departmentWorkload || []}
          xKey="department"
          bars={[
            { key: "totalTasks", color: "#3b82f6", name: "Total Tasks" },
            {
              key: "averageTasksPerUser",
              color: "#10b981",
              name: "Avg Tasks/User",
            },
          ]}
          title="Workload by Department"
          height={320}
          loading={workloadReport.loading}
        />
      </div>

      {/* Individual User Workload */}
      <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          Individual User Workload
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                  User
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                  Department
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  Total Tasks
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  High Priority
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  In Progress
                </th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">
                  Load Status
                </th>
              </tr>
            </thead>
            <tbody>
              {(workloadReport.data?.workloadDistribution || [])
                .slice(0, 20)
                .map((user, index) => {
                  const avgTasks =
                    workloadReport.data?.summary?.averageTasksPerUser || 0;
                  const loadStatus =
                    user.totalTasks > avgTasks * 1.5
                      ? "Overloaded"
                      : user.totalTasks < avgTasks * 0.5
                        ? "Underloaded"
                        : "Balanced";
                  const statusColor =
                    loadStatus === "Overloaded"
                      ? "text-red-600"
                      : loadStatus === "Underloaded"
                        ? "text-yellow-600"
                        : "text-green-600";

                  return (
                    <tr
                      key={index}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">
                        {user.userName}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        {user.department}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900 text-right font-medium">
                        {user.totalTasks}
                      </td>
                      <td className="py-3 px-4 text-sm text-orange-600 text-right">
                        {user.byPriority.high + user.byPriority.urgent}
                      </td>
                      <td className="py-3 px-4 text-sm text-blue-600 text-right">
                        {user.byStatus.inProgress}
                      </td>
                      <td
                        className={`py-3 px-4 text-sm text-center font-medium ${statusColor}`}
                      >
                        {loadStatus}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderMilestonesTab = () => {
    const summary = milestoneReport.data?.summary || {};
    const achieved = summary.achieved ?? 0;
    const missed = summary.missed ?? 0;
    const inProgress = summary.inProgress ?? 0;
    const total = summary.totalMilestones ?? 0;
    const achievementRate = summary.achievementRate ?? 0;
    const healthLabel =
      achievementRate >= 80
        ? "Healthy"
        : achievementRate >= 50
          ? "Needs attention"
          : "At risk";

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            🎯 Milestone Achievement Report
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => handleExportMilestones("pdf")}
              className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-sm hover:bg-red-700 transition-colors text-sm font-medium"
            >
              📄 PDF
            </button>
            <button
              onClick={() => handleExportMilestones("excel")}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-sm hover:bg-green-700 transition-colors text-sm font-medium"
            >
              📊 Excel
            </button>
            <button
              onClick={() => handleExportMilestones("csv")}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              📋 CSV
            </button>
          </div>
        </div>
        <p className="text-gray-600 text-sm mb-3">
          High-level health indicator: project/process milestones achieved vs.
          missed. Filter by timeframe, team above.
        </p>

        <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <KPICard
              title="Total Milestones"
              value={total}
              icon={Target}
              color="blue"
              description="All milestones in scope"
              loading={milestoneReport.loading}
            />
            <KPICard
              title="Achieved"
              value={achieved}
              icon={CheckCircle}
              color="green"
              description="Successfully completed"
              loading={milestoneReport.loading}
            />
            <KPICard
              title="Missed"
              value={missed}
              icon={AlertTriangle}
              color="red"
              description="Past due, not completed"
              loading={milestoneReport.loading}
            />
            <KPICard
              title="In Progress"
              value={inProgress}
              icon={Clock}
              color="orange"
              description="Currently active"
              loading={milestoneReport.loading}
            />
          </div>

          {/* High-level health indicator */}
          <div className="mb-3 p-4 rounded-sm bg-gray-50 border border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-1">
              Health indicator
            </h3>
            <p className="text-lg font-semibold text-gray-900">
              Achievement rate:{" "}
              <span
                className={
                  achievementRate >= 80
                    ? "text-green-600"
                    : achievementRate >= 50
                      ? "text-amber-600"
                      : "text-red-600"
                }
              >
                {achievementRate}%
              </span>
              {" — "}
              {healthLabel}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="py-3 px-4 text-sm font-medium text-gray-600 text-left">
                    Achieved
                  </th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-600 text-left">
                    Missed
                  </th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-600 text-left">
                    In Progress
                  </th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-600 text-left">
                    Total
                  </th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-600 text-left">
                    Achievement Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm font-bold text-green-600">
                    {achieved}
                  </td>
                  <td className="py-3 px-4 text-sm font-bold text-red-600">
                    {missed}
                  </td>
                  <td className="py-3 px-4 text-sm font-bold text-orange-600">
                    {inProgress}
                  </td>
                  <td className="py-3 px-4 text-sm font-bold text-gray-900">
                    {total}
                  </td>
                  <td className="py-3 px-4 text-sm font-bold text-blue-600">
                    {achievementRate}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderRecurringTab = () => {
    const summary = recurringReport.data?.summary || {};
    const totalRecurring = summary.totalRecurring ?? 0;
    const completed = summary.completed ?? 0;
    const onTime = summary.onTime ?? 0;
    const missed = summary.missed ?? 0;
    const adherenceRate = summary.adherenceRate ?? 0; // % of completed that were on time
    const completionRate = summary.completionRate ?? 0; // % completed out of total

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            🔄 Recurring Task Adherence Report
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => handleExportRecurring("pdf")}
              className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-sm hover:bg-red-700 transition-colors text-sm font-medium"
            >
              📄 PDF
            </button>
            <button
              onClick={() => handleExportRecurring("excel")}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-sm hover:bg-green-700 transition-colors text-sm font-medium"
            >
              📊 Excel
            </button>
            <button
              onClick={() => handleExportRecurring("csv")}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              📋 CSV
            </button>
          </div>
        </div>
        <p className="text-gray-600 text-sm mb-3">
          Shows the % of recurring work completed on time, and highlights missed
          deadlines so repetitive operational work doesn’t slip.
        </p>

        <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
            <KPICard
              title="Total Recurring"
              value={totalRecurring}
              icon={Clock}
              color="blue"
              description="All recurring tasks"
              loading={recurringReport.loading}
            />
            <KPICard
              title="Completed"
              value={completed}
              icon={CheckCircle}
              color="green"
              description="Successfully completed"
              loading={recurringReport.loading}
            />
            <KPICard
              title="On Time"
              value={onTime}
              icon={CheckCircle}
              color="teal"
              description="Completed on/before due date"
              loading={recurringReport.loading}
            />
            <KPICard
              title="Missed"
              value={missed}
              icon={AlertTriangle}
              color="red"
              description="Overdue or completed late"
              loading={recurringReport.loading}
            />
            <KPICard
              title="On-time Rate"
              value={`${adherenceRate}%`}
              icon={TrendingUp}
              color="purple"
              description="% of completed done on time"
              loading={recurringReport.loading}
            />
          </div>

          {/* High-level health indicator */}
          <div className="mb-3 p-4 rounded-sm bg-gray-50 border border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-1">
              Health indicator
            </h3>
            <p className="text-lg font-semibold text-gray-900">
              On-time rate:{" "}
              <span
                className={
                  adherenceRate >= 80
                    ? "text-green-600"
                    : adherenceRate >= 50
                      ? "text-amber-600"
                      : "text-red-600"
                }
              >
                {adherenceRate}%
              </span>
              <span className="text-gray-500 font-medium">
                {" "}
                (completion rate: {completionRate}%)
              </span>
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="py-3 px-4 text-sm font-medium text-gray-600 text-left">
                    Completed
                  </th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-600 text-left">
                    On Time
                  </th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-600 text-left">
                    Missed
                  </th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-600 text-left">
                    On-time Rate
                  </th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-600 text-left">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm font-bold text-green-600">
                    {completed}
                  </td>
                  <td className="py-3 px-4 text-sm font-bold text-teal-600">
                    {onTime}
                  </td>
                  <td className="py-3 px-4 text-sm font-bold text-red-600">
                    {missed}
                  </td>
                  <td className="py-3 px-4 text-sm font-bold text-blue-600">
                    {adherenceRate}%
                  </td>
                  <td className="py-3 px-4 text-sm font-bold text-gray-900">
                    {totalRecurring}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Highlight missed recurring tasks */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Missed Recurring Tasks
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="py-3 px-4 text-left font-medium text-gray-600">
                      Task
                    </th>
                    <th className="py-3 px-4 text-left font-medium text-gray-600">
                      Assignee
                    </th>
                    <th className="py-3 px-4 text-left font-medium text-gray-600">
                      Type
                    </th>
                    <th className="py-3 px-4 text-right font-medium text-gray-600">
                      Due
                    </th>
                    <th className="py-3 px-4 text-right font-medium text-gray-600">
                      Completed
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(recurringReport.data?.recentMissedRecurring || [])
                    .length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-6 px-4 text-center text-sm text-gray-500"
                      >
                        No missed recurring tasks found for the selected period.
                      </td>
                    </tr>
                  )}
                  {(recurringReport.data?.recentMissedRecurring || []).map(
                    (t, index) => (
                      <tr
                        key={t.id || index}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {t.title}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700">
                          {t.assignee}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${t.missedType === "OVERDUE_OPEN" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}
                          >
                            {t.missedType === "OVERDUE_OPEN"
                              ? "Overdue (Open)"
                              : "Completed Late"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700 text-right">
                          {t.dueDate}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700 text-right">
                          {t.completedAt || "-"}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderQuickTasksTab = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          ⚡ Quick Task Conversion Report
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => handleExportQuickTasks("pdf")}
            className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-sm hover:bg-red-700 transition-colors text-sm font-medium"
          >
            📄 PDF
          </button>
          <button
            onClick={() => handleExportQuickTasks("excel")}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-sm hover:bg-green-700 transition-colors text-sm font-medium"
          >
            📊 Excel
          </button>
          <button
            onClick={() => handleExportQuickTasks("csv")}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            📋 CSV
          </button>
        </div>
      </div>
      <p className="text-gray-600 text-sm mb-3">
        Tracks how many Quick Tasks were converted into full tasks (higher
        conversion often indicates better workflow discipline). Use filters
        above for timeframe/team.
      </p>

      <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <KPICard
            title="Total Quick Tasks"
            value={quickTaskReport.data?.summary?.totalQuickTasks || 0}
            icon={CheckSquare}
            color="blue"
            description="Created as quick tasks"
            loading={quickTaskReport.loading}
          />
          <KPICard
            title="Converted to Full Tasks"
            value={quickTaskReport.data?.summary?.convertedTasks || 0}
            icon={TrendingUp}
            color="green"
            description="Quick → full task conversions"
            loading={quickTaskReport.loading}
          />
          <KPICard
            title="Conversion Rate"
            value={`${quickTaskReport.data?.summary?.conversionRate || 0}%`}
            icon={Activity}
            color="teal"
            description="Converted out of total quick tasks"
            loading={quickTaskReport.loading}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="py-3 px-4 text-sm font-medium text-gray-600 text-left">
                  Converted
                </th>
                <th className="py-3 px-4 text-sm font-medium text-gray-600 text-left">
                  Total Quick Tasks
                </th>
                <th className="py-3 px-4 text-sm font-medium text-gray-600 text-left">
                  Conversion Rate
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 text-sm font-bold text-green-600">
                  {quickTaskReport.data?.summary?.convertedTasks || 0}
                </td>
                <td className="py-3 px-4 text-sm font-bold text-gray-900">
                  {quickTaskReport.data?.summary?.totalQuickTasks || 0}
                </td>
                <td className="py-3 px-4 text-sm font-bold text-blue-600">
                  {quickTaskReport.data?.summary?.conversionRate || 0}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Table of converted tasks */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Recently Converted Quick Tasks
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="py-3 px-4 text-left font-medium text-gray-600">
                    Task
                  </th>
                  <th className="py-3 px-4 text-left font-medium text-gray-600">
                    Assignee
                  </th>
                  <th className="py-3 px-4 text-left font-medium text-gray-600">
                    Created By
                  </th>
                  <th className="py-3 px-4 text-right font-medium text-gray-600">
                    Created
                  </th>
                  <th className="py-3 px-4 text-right font-medium text-gray-600">
                    Converted
                  </th>
                </tr>
              </thead>
              <tbody>
                {(quickTaskReport.data?.recentConversions || []).length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-6 px-4 text-center text-sm text-gray-500"
                    >
                      No converted quick tasks found for the selected period.
                    </td>
                  </tr>
                )}
                {(quickTaskReport.data?.recentConversions || []).map(
                  (task, index) => (
                    <tr
                      key={task.id || index}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {task.title}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        {task.assignee || "—"}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        {task.createdBy || "—"}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 text-right">
                        {task.createdAt || "—"}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 text-right">
                        {task.lastModified || task.convertedAt || "—"}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const renderActivityTab = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          👥 Activity & Engagement Report
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => handleExportActivity("pdf")}
            className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-sm hover:bg-red-700 transition-colors text-sm font-medium"
          >
            📄 PDF
          </button>
          <button
            onClick={() => handleExportActivity("excel")}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-sm hover:bg-green-700 transition-colors text-sm font-medium"
          >
            📊 Excel
          </button>
          <button
            onClick={() => handleExportActivity("csv")}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-sm hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            📋 CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
        <KPICard
          title="Total Users"
          value={activityReport.data?.summary?.totalUsers || 0}
          icon={Users}
          color="blue"
          description="In organization"
          loading={activityReport.loading}
        />
        <KPICard
          title="Active Users"
          value={activityReport.data?.summary?.activeUsers || 0}
          icon={UserCheck}
          color="green"
          description="Users with activity"
          loading={activityReport.loading}
        />
        <KPICard
          title="Logins (signal)"
          value={activityReport.data?.summary?.totalLogins || 0}
          icon={Activity}
          color="orange"
          description="Users logged in during period"
          loading={activityReport.loading}
        />
        <KPICard
          title="Engagement Rate"
          value={`${activityReport.data?.summary?.engagementRate || 0}%`}
          icon={TrendingUp}
          color="teal"
          description="User activity rate"
          loading={activityReport.loading}
        />
      </div>

      {/* Engagement Status Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        <TaskDonutChart
          data={(activityReport.data?.departmentEngagement || []).map((d) => ({
            name: d.name,
            // TaskDonutChart expects `value` (dataKey="value")
            // Use totalScore to show share of engagement by department
            value: d.totalScore || 0,
          }))}
          title="Engagement by Department"
          colors={["#10b981", "#3b82f6", "#f59e0b", "#ef4444"]}
          height={300}
          loading={activityReport.loading}
        />

        <TaskLineChart
          data={activityReport.data?.engagementTrend || []}
          xKey="date"
          lines={[
            { key: "comments", color: "#3b82f6", name: "Comments" },
            { key: "tasks", color: "#10b981", name: "Tasks" },
          ]}
          title="Daily Engagement Trend"
          height={300}
          loading={activityReport.loading}
        />
      </div>

      {/* Top Contributors */}
      <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          Top Contributors
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                  Rank
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                  User
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  Comments
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  Tasks Completed
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  Engagement Score
                </th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">
                  Activity Level
                </th>
              </tr>
            </thead>
            <tbody>
              {(activityReport.data?.userEngagement || [])
                .slice(0, 10)
                .map((user, index) => (
                  <tr
                    key={index}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">
                      #{index + 1}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900">
                      {user.name}
                    </td>
                    <td className="py-3 px-4 text-sm text-blue-600 text-right">
                      {user.commentsCount}
                    </td>
                    <td className="py-3 px-4 text-sm text-green-600 text-right">
                      {user.tasksCompleted}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 text-right font-bold">
                      {user.engagementScore}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          user.engagementScore > 50
                            ? "bg-green-100 text-green-800"
                            : user.engagementScore > 20
                              ? "bg-blue-100 text-blue-800"
                              : user.engagementScore > 0
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                        }`}
                      >
                        {user.engagementScore > 50
                          ? "High"
                          : user.engagementScore > 20
                            ? "Medium"
                            : user.engagementScore > 0
                              ? "Low"
                              : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 [&_.card]:!rounded-sm [&_input:not([type='checkbox']):not([type='radio'])]:!rounded-sm [&_select]:!rounded-sm [&_textarea]:!rounded-sm [&_.form-input]:!rounded-sm [&_.form-select]:!rounded-sm [&_.form-textarea]:!rounded-sm [&_button:not(.rounded-full)]:!rounded-sm [&_table]:!rounded-sm [&_.bg-white.border]:!rounded-sm [&_.rounded-sm]:!rounded-sm [&_.rounded-md]:!rounded-sm [&_.rounded-lg]:!rounded-sm [&_.rounded-xl]:!rounded-sm [&_.rounded]:!rounded-sm [&_input]:h-8 [&_input]:min-h-8 [&_input]:max-h-8 [&_input]:py-0 [&_input]:box-border [&_select]:h-8 [&_select]:min-h-8 [&_select]:max-h-8 [&_select]:py-0 [&_select]:box-border [&_textarea]:min-h-8 [&_.form-input]:h-8 [&_.form-input]:min-h-8 [&_.form-input]:max-h-8 [&_.form-input]:py-0 [&_.form-input]:box-border [&_.form-select]:h-8 [&_.form-select]:min-h-8 [&_.form-select]:max-h-8 [&_.form-select]:py-0 [&_.form-select]:box-border [&_button.bg-red-600]:h-8 [&_button.bg-red-600]:min-h-8 [&_button.bg-red-600]:py-0 [&_button.bg-green-600]:h-8 [&_button.bg-green-600]:min-h-8 [&_button.bg-green-600]:py-0 [&_button.bg-blue-600]:h-8 [&_button.bg-blue-600]:min-h-8 [&_button.bg-blue-600]:py-0">
      <div className="flex">
        {/* Main Content Area */}
        <div className="flex-1 py-4 px-6">
          {" "}
          {/* Remove fixed left margin */}
          {/* Header */}
          <div className="mb-3">
            <h1
              className="text-2xl md:text-2xl font-normal m-0"
              style={{ color: "#676a6c" }}
            >
              Analytics And Reports
            </h1>
            <p className="mt-0 text-sm text-blue-600">
              Comprehensive task management insights across all 8 key reports
            </p>

            {/* Real Data Verification Badge */}
            {data && (
              <div className="mt-3 inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800 border border-green-200">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                ✅ Real Data:{" "}
                {data.kpis?.totalOrgTasks ??
                  data.kpis?.totalTasks ??
                  data.summary?.totalOverdue ??
                  data.summary?.totalCompleted ??
                  data.summary?.totalUsers ??
                  "Connected"}{" "}
                {data.kpis || data.summary ? "records" : ""}
              </div>
            )}
          </div>
          {/* Filters */}
          <div className="mb-3">
            <ReportsFilterBar
              onFilterChange={handleFilterChange}
              showTeamFilter={true}
              showUserFilter={true}
              showExport={true}
              onExport={handleExport}
              loading={loading || usersLoading}
              teams={(data?.tasksByDepartment || []).map((dept, index) => ({
                id: dept.name || `dept-${index}`,
                name: dept.name || "Unassigned",
              }))}
              users={orgUsers}
            />
          </div>
          {/* Tabs Navigation */}
          <div className="bg-white rounded-sm shadow-sm border border-gray-200 mb-3">
            <div className="border-b border-gray-200">
              <nav className="flex overflow-x-auto px-2" aria-label="Tabs">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`${
                      activeTab === tab.id
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    } whitespace-nowrap py-2 px-2 border-b-2 font-medium text-xs md:text-sm flex items-center space-x-1 min-w-max`}
                  >
                    <tab.icon size={14} />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-3 md:p-4">
              {!data ? (
                <div className="flex items-center justify-center min-h-[400px]">
                  <div className="flex flex-col items-center gap-3">
                    <Loader className="w-8 h-8 animate-spin text-blue-600" />
                    <h3 className="text-lg font-medium text-gray-900">
                      Loading Analytics
                    </h3>
                    <div className="mt-1 text-sm text-gray-500">
                      <p>Analyzing organization tasks</p>
                      <p>Computing completion trends</p>
                      <p>Processing department data</p>
                    </div>
                  </div>
                </div>
              ) : (
                renderTabContent()
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizationAnalyticsPage;
