import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useActiveRole } from "@/components/RoleSwitcher";
import { useAuth } from "@/features/shared/hooks/useAuth";
import { Button } from "@/components/ui/button";
import axios from "axios";
import {
  Users,
  TrendingUp,
  Clock,
  CheckSquare,
  AlertTriangle,
  Target,
  BarChart3,
  ArrowUpRight,
  Zap,
  ArrowLeftRight,
  AlertOctagon,
  X,
  Gauge,
  FileSpreadsheet,
  FileText,
  CalendarClock,
  Search,
  LayoutGrid,
  Calendar as CalendarIcon,
  Star,
  Pin,
  CheckCircle2,
  Clock3,
  Bell,
  PanelTop,
  ListChecks,
  Flame,
  Activity,
  Crown,
  Loader,
} from "lucide-react";
import ReactECharts from "echarts-for-react";
import ExportButton from "@/components/ExportButton";
import { useShowToast } from "@/utils/ToastMessage";
import QuickTaskWidget from "@/components/tasks/QuickTaskWidget";
import { useLocation } from "wouter";
import {
  RegularTaskIcon,
  RecurringTaskIcon,
  QuickTaskIcon,
  MilestoneTaskIcon,
  ApprovalTaskIcon,
} from "../components/common/TaskIcons";
import CustomConfirmationModal from "@/pages/newComponents/CustomConfirmationModal";

// Helper function for stats
function computeStatsFromTasks(tasks) {
  if (!tasks || !Array.isArray(tasks))
    return {
      completedTasks: 0,
      totalTasks: 0,
      inProgressTasks: 0,
      upcomingDeadlines: 0,
      overdueTasks: 0,
      tasksByPriority: { urgent: 0 },
      openCount: 0,
      inProgressCount: 0,
      completedCount: 0,
      overdueCount: 0,
    };
  const now = new Date();
  const statusOf = (s) => (s || "").toLowerCase();
  const openCount = tasks.filter((t) =>
    ["pending", "todo", "open"].includes(statusOf(t.status)),
  ).length;
  const inProgressCount = tasks.filter((t) =>
    ["in_progress", "in-progress", "doing", "inprogress"].includes(
      statusOf(t.status),
    ),
  ).length;
  const completedCount = tasks.filter((t) =>
    ["completed", "done"].includes(statusOf(t.status)),
  ).length;
  const overdueCount = tasks.filter(
    (t) =>
      t.dueDate &&
      new Date(t.dueDate) < now &&
      !["completed", "done"].includes(statusOf(t.status)),
  ).length;
  return {
    completedTasks: completedCount,
    totalTasks: tasks.length,
    inProgressTasks: inProgressCount,
    upcomingDeadlines: tasks.filter(
      (t) =>
        t.dueDate &&
        new Date(t.dueDate) > now &&
        !["completed", "done"].includes(statusOf(t.status)),
    ).length,
    overdueTasks: overdueCount,
    tasksByPriority: {
      urgent: tasks.filter((t) => (t.priority || "").toLowerCase() === "high")
        .length,
    },
    openCount,
    inProgressCount,
    completedCount,
    overdueCount,
  };
}

// Helper for task type icon
function getTaskTypeIcon(task, size = 14) {
  if (!task) return null;
  if (task.taskType === "milestone" || task.taskType === "Milestone") {
    return <MilestoneTaskIcon size={size} className="flex-shrink-0" />;
  }
  if (task.isRecurring || task.taskType === "recurring") {
    return <RecurringTaskIcon size={size} className="flex-shrink-0" />;
  }
  if (task.taskType === "quick" || task.taskType === "quicktask") {
    return <QuickTaskIcon size={size} className="flex-shrink-0" />;
  }
  if (task.taskType === "approval") {
    return <ApprovalTaskIcon size={size} className="flex-shrink-0" />;
  }
  return <RegularTaskIcon size={size} className="flex-shrink-0" />;
}

// Helper for status badge
function getStatusBadge(status) {
  const s = (status || "").toLowerCase().replace(/[^a-z]/g, "");
  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded-sm ${
        s === "completed" || s === "done"
          ? "text-green-700 bg-green-100"
          : s === "in_progress" || s === "inprogress"
            ? "text-blue-700 bg-blue-100"
            : s === "pending" || s === "open"
              ? "text-gray-700 bg-gray-100"
              : s === "blocked"
                ? "text-red-700 bg-red-100"
                : s === "onhold"
                  ? "text-yellow-700 bg-yellow-100"
                  : "text-gray-700 bg-gray-100"
      }`}
    >
      {(status || "—").replace(/_/g, " ")}
    </span>
  );
}

const ManagerDashboard = () => {
  const { showSuccessToast, showErrorToast } = useShowToast();
  const { activeRole } = useActiveRole();
  const [location, setLocation] = useLocation();
  const [selectedTimeRange, setSelectedTimeRange] = useState("all");
  const [selectedMember, setSelectedMember] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [memberFilter, setMemberFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    frequency: "weekly",
    time: "09:00",
    email: "",
  });
  const [focusTab, setFocusTab] = useState("today");
  const [taskListFilter, setTaskListFilter] = useState("all");

  const { user } = useAuth();
  const token = localStorage.getItem("token");

  // Fetch my tasks using axios
  const { data: myTasksResponse, isLoading: tasksLoading } = useQuery({
    queryKey: ["/api/mytasks", activeRole],
    queryFn: async () => {
      const queryParams = new URLSearchParams({
        page: 1,
        limit: 1000,
        activeRole: activeRole,
      });
      const response = await axios.get(
        `/api/mytasks?${queryParams.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      console.log("API Response:", response.data);

      let tasks = [];
      if (response.data?.success && response.data?.data?.tasks) {
        tasks = response.data.data.tasks;
      } else if (response.data?.tasks) {
        tasks = response.data.tasks;
      } else if (Array.isArray(response.data)) {
        tasks = response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        tasks = response.data.data;
      }

      console.log("Extracted tasks:", tasks.length);
      return tasks;
    },
    enabled: !!user && !!token,
  });

  // Fetch team members
  const { data: teamMembersRaw, isLoading: membersLoading } = useQuery({
    queryKey: ["/api/team-members"],
    queryFn: async () => {
      const response = await axios.get("/api/team-members", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const members = response.data?.data || response.data || [];
      return Array.isArray(members) ? members : [];
    },
    enabled: !!user && !!token,
  });

  const { data: milestonesData, isLoading: milestonesLoading } = useQuery({
    queryKey: ["/api/milestone-tasks", activeRole, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const response = await axios.get("/api/milestone-tasks", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    },
  });

  const { data: dashboardData, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard-stats", activeRole, user?.id],
    queryFn: async () => {
      const response = await axios.get("/api/dashboard-stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data?.data || {};
    },
    enabled: !!user && !!token,
  });

  // Data Processing
  const dashboardCounts = dashboardData || {};
  const teamData = dashboardCounts?.teamData || {};

  const teamTasksData = useMemo(() => {
    if (!myTasksResponse) return [];
    return Array.isArray(myTasksResponse) ? myTasksResponse : [];
  }, [myTasksResponse]);

  // CRITICAL FIX: Only filter out org_admin, keep all other employees
  const teamMembers = useMemo(() => {
    let members = [];

    // Function to check if role is org_admin
    const isOrgAdmin = (role) => {
      if (!role) return false;
      const roleLower = String(role).toLowerCase();
      return (
        roleLower === "org_admin" ||
        roleLower === "orgadmin" ||
        roleLower === "organization_admin"
      );
    };

    if (teamData?.employeeStats) {
      members = teamData.employeeStats
        .filter((m) => !isOrgAdmin(m.role)) // ONLY remove org_admin
        .map((m) => ({
          ...m,
          id: m.id || m._id,
          status: m.status || "online",
        }));
    } else if (teamMembersRaw) {
      members = teamMembersRaw
        .filter((m) => !isOrgAdmin(m.role)) // ONLY remove org_admin
        .map((m) => {
          const mTasks = teamTasksData.filter((t) => {
            let assigneeId = null;
            if (typeof t.assignedTo === "string") assigneeId = t.assignedTo;
            else if (t.assignedTo?._id) assigneeId = t.assignedTo._id;
            else if (t.assignedTo?.id) assigneeId = t.assignedTo.id;
            return assigneeId === String(m.id || m._id);
          });

          const activeTasks = mTasks.filter(
            (t) =>
              t.status !== "completed" &&
              t.status !== "DONE" &&
              t.status !== "COMPLETED",
          ).length;
          const overdueTasks = mTasks.filter(
            (t) =>
              t.status !== "completed" &&
              t.status !== "DONE" &&
              t.status !== "COMPLETED" &&
              t.dueDate &&
              new Date(t.dueDate) < new Date(),
          ).length;
          const completedTasks = mTasks.filter(
            (t) =>
              t.status === "completed" ||
              t.status === "DONE" ||
              t.status === "COMPLETED",
          );
          const onTime = completedTasks.filter(
            (t) =>
              t.completedDate &&
              t.dueDate &&
              new Date(t.completedDate) <= new Date(t.dueDate),
          ).length;
          const performance =
            completedTasks.length > 0
              ? Math.round((onTime / completedTasks.length) * 100)
              : 100;

          return {
            id: m.id,
            name:
              m.fullName || `${m.firstName || ""} ${m.lastName || ""}`.trim(),
            role: m.role || "Member",
            avatar: (m.firstName?.[0] || "") + (m.lastName?.[0] || ""),
            tasks: mTasks.length,
            performance: performance,
            productivity: performance,
            overdueTasks: overdueTasks,
            activeTasks: activeTasks,
            completedOnTimeThisMonth: onTime,
            overdueClosedThisMonth: completedTasks.length - onTime,
            capacity: 10,
            status: m.isActive ? "online" : "offline",
            lastActivity: m.lastLoginAt
              ? new Date(m.lastLoginAt).toLocaleDateString()
              : "Never",
          };
        });
    }

    console.log(
      "Team members (org_admin filtered out, employees kept):",
      members.length,
    );
    return Array.isArray(members) ? members : [];
  }, [teamData, teamMembersRaw, teamTasksData]);

  const teamStatsForHeader = useMemo(() => {
    const totalTasks = teamTasksData.length;
    const completedTasks = teamTasksData.filter(
      (t) =>
        t.status === "completed" ||
        t.status === "DONE" ||
        t.status === "COMPLETED",
    ).length;
    const inProgressTasks = teamTasksData.filter(
      (t) => t.status === "in_progress" || t.status === "INPROGRESS",
    ).length;
    const overdueTasks = teamTasksData.filter(
      (t) =>
        t.dueDate &&
        new Date(t.dueDate) < new Date() &&
        t.status !== "completed" &&
        t.status !== "DONE" &&
        t.status !== "COMPLETED",
    ).length;

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      overdueTasks,
      completionPercentage:
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    };
  }, [teamTasksData]);

  const teamStats = useMemo(() => {
    if (!dashboardCounts) {
      return {
        totalTeamMembers: teamMembers.length,
        activeTasks: 0,
        completedTasksThisMonth: 0,
        overdueItems: 0,
        teamProductivity: 0,
        avgTaskCompletionTime: "N/A",
        upcomingDeadlines: 0,
        teamSatisfaction: 5.0,
      };
    }

    return {
      totalTeamMembers: teamData?.totalEmployees || teamMembers.length,
      activeTasks: dashboardCounts.beforeDueDateCount || 0,
      completedTasksThisMonth: dashboardCounts.completedThisMonthCount || 0,
      overdueItems: dashboardCounts.pastDueDateCount || 0,
      teamProductivity:
        dashboardCounts.productivity ||
        (teamTasksData.length > 0
          ? Math.round(
              ((teamTasksData.length - teamStatsForHeader.overdueTasks) /
                teamTasksData.length) *
                100,
            )
          : 100),
      avgTaskCompletionTime:
        dashboardCounts.efficiency?.avgTaskCompletionTime || "N/A",
      upcomingDeadlines: dashboardCounts.beforeDueDateCount || 0,
      teamSatisfaction: dashboardCounts.productivity
        ? (dashboardCounts.productivity / 20).toFixed(1)
        : 4.8,
      isExpired: dashboardCounts.license?.isExpired || false,
    };
  }, [
    dashboardCounts,
    teamMembers,
    teamData,
    teamTasksData,
    teamStatsForHeader,
  ]);

  // Today Focus Tasks
  const todayStr = new Date().toISOString().split("T")[0];

  const todayFocusTasksData = useMemo(() => {
    return teamTasksData
      .filter((t) => t.dueDate && t.dueDate.slice(0, 10) === todayStr)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 8);
  }, [teamTasksData, todayStr]);

  const overdueFocusTasksData = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return teamTasksData
      .filter((t) => {
        if (!t.dueDate) return false;
        const dueDate = new Date(t.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const status = (t.status || "").toUpperCase();
        return (
          dueDate < now &&
          status !== "DONE" &&
          status !== "COMPLETED" &&
          status !== "CANCELLED"
        );
      })
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 8);
  }, [teamTasksData]);

  const approvalFocusTasksData = useMemo(() => {
    return teamTasksData
      .filter(
        (t) =>
          t.taskType === "approval" &&
          t.status !== "DONE" &&
          t.status !== "COMPLETED",
      )
      .slice(0, 8);
  }, [teamTasksData]);

  const focusTabTasks = useMemo(() => {
    if (focusTab === "today") return todayFocusTasksData;
    if (focusTab === "overdue") return overdueFocusTasksData;
    return approvalFocusTasksData;
  }, [
    focusTab,
    todayFocusTasksData,
    overdueFocusTasksData,
    approvalFocusTasksData,
  ]);

  // KPI Cards
  const kpiCards = useMemo(
    () => [
      {
        label: "Total Team Tasks",
        value: teamStatsForHeader.totalTasks,
        linkLabel: "View all tasks",
        icon: ListChecks,
        iconColor: "text-blue-600",
        iconBg: "bg-blue-50",
        testId: "card-total-tasks",
        onClick: () => setLocation(`/tasks?activeRole=${activeRole}`),
      },
      {
        label: "Completed",
        value: teamStatsForHeader.completedTasks,
        linkLabel: "View completed",
        icon: CheckSquare,
        iconColor: "text-green-600",
        iconBg: "bg-green-50",
        testId: "card-completed",
        onClick: () =>
          setLocation(`/tasks?statusFilter=DONE&activeRole=${activeRole}`),
      },
      {
        label: "In Progress",
        value: teamStatsForHeader.inProgressTasks,
        linkLabel: "View in progress",
        icon: Clock,
        iconColor: "text-yellow-600",
        iconBg: "bg-yellow-50",
        testId: "card-inprogress",
        onClick: () =>
          setLocation(
            `/tasks?statusFilter=INPROGRESS&activeRole=${activeRole}`,
          ),
      },
      {
        label: "Overdue",
        value: teamStatsForHeader.overdueTasks,
        subtitle:
          teamStatsForHeader.overdueTasks > 0
            ? `${teamStatsForHeader.overdueTasks} need attention`
            : "All on track",
        subtitleColor:
          teamStatsForHeader.overdueTasks > 0 ? "#dc2626" : "#16a34a",
        linkLabel: "View overdue",
        icon: AlertTriangle,
        iconColor: "text-red-600",
        iconBg: "bg-red-50",
        testId: "card-overdue",
        onClick: () =>
          setLocation(`/tasks?dueDateFilter=overdue&activeRole=${activeRole}`),
      },
      {
        label: "Team Productivity",
        value: `${teamStats.teamProductivity}%`,
        linkLabel: "View report",
        icon: TrendingUp,
        iconColor: "text-indigo-600",
        iconBg: "bg-indigo-50",
        testId: "card-productivity",
        onClick: () =>
          setLocation(`/reports?tab=team&activeRole=${activeRole}`),
        isProgressCard: true,
        percentage: teamStats.teamProductivity,
      },
      {
        label: "Active Members",
        value: teamMembers.filter((m) => m.status === "online").length,
        subtitle: `${teamMembers.length} total members`,
        icon: Users,
        iconColor: "text-purple-600",
        iconBg: "bg-purple-50",
        testId: "card-members",
        onClick: () => {},
      },
    ],
    [
      teamStatsForHeader,
      teamStats.teamProductivity,
      teamMembers,
      activeRole,
      setLocation,
    ],
  );

  // Process team tasks for display
  const teamTasks = useMemo(() => {
    if (!teamTasksData.length) return [];

    return teamTasksData.map((t) => ({
      ...t,
      id: t._id || t.id,
      assignee: (() => {
        if (t.assignedTo?.fullName) return t.assignedTo.fullName;
        if (t.assignedTo?.firstName)
          return `${t.assignedTo.firstName} ${t.assignedTo.lastName || ""}`.trim();
        if (typeof t.assignedTo === "string") return "Assigned User";
        return t.assigneeName || "Unassigned";
      })(),
      assigneeId: (() => {
        if (typeof t.assignedTo === "string") return t.assignedTo;
        if (t.assignedTo?._id) return t.assignedTo._id;
        if (t.assignedTo?.id) return t.assignedTo.id;
        return t.assigneeId || "";
      })(),
      type: t.taskType || "regular",
    }));
  }, [teamTasksData]);

  // FILTERED TASKS
  const filteredTasks = useMemo(() => {
    try {
      if (!teamTasks.length) return [];

      let tasks = [...teamTasks];

      if (searchQuery) {
        const query = searchQuery.toLowerCase().trim();
        tasks = tasks.filter(
          (t) =>
            (t.title?.toLowerCase() || "").includes(query) ||
            (t.description?.toLowerCase() || "").includes(query) ||
            (t.assignee?.toLowerCase() || "").includes(query) ||
            (t.priority?.toLowerCase() || "").includes(query),
        );
      }

      if (memberFilter !== "all") {
        tasks = tasks.filter(
          (t) => String(t.assigneeId || "") === String(memberFilter),
        );
      }

      if (priorityFilter !== "all") {
        tasks = tasks.filter(
          (t) =>
            (t.priority || "").toLowerCase() === priorityFilter.toLowerCase(),
        );
      }

      if (dueFrom) {
        tasks = tasks.filter(
          (t) => t.dueDate && new Date(t.dueDate) >= new Date(dueFrom),
        );
      }
      if (dueTo) {
        tasks = tasks.filter(
          (t) => t.dueDate && new Date(t.dueDate) <= new Date(dueTo),
        );
      }

      const now = new Date();

      if (selectedTimeRange === "this_week") {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        tasks = tasks.filter(
          (t) => t.createdAt && new Date(t.createdAt) >= weekAgo,
        );
      } else if (selectedTimeRange === "this_month") {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        tasks = tasks.filter(
          (t) => t.createdAt && new Date(t.createdAt) >= startOfMonth,
        );
      } else if (selectedTimeRange === "last_month") {
        const startOfLastMonth = new Date(
          now.getFullYear(),
          now.getMonth() - 1,
          1,
        );
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        tasks = tasks.filter(
          (t) =>
            t.createdAt &&
            new Date(t.createdAt) >= startOfLastMonth &&
            new Date(t.createdAt) <= endOfLastMonth,
        );
      }

      if (taskListFilter === "today") {
        tasks = tasks.filter(
          (t) =>
            t.dueDate &&
            new Date(t.dueDate).toDateString() === new Date().toDateString(),
        );
      } else if (taskListFilter === "overdue") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        tasks = tasks.filter((t) => {
          if (!t.dueDate) return false;
          const dueDate = new Date(t.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          const status = (t.status || "").toUpperCase();
          return (
            dueDate < today &&
            status !== "DONE" &&
            status !== "COMPLETED" &&
            status !== "CANCELLED"
          );
        });
      }

      return tasks;
    } catch (error) {
      console.error("filteredTasks error:", error);
      return [];
    }
  }, [
    teamTasks,
    searchQuery,
    memberFilter,
    priorityFilter,
    dueFrom,
    dueTo,
    selectedTimeRange,
    taskListFilter,
  ]);

  const projectStats = useMemo(() => {
    const milestones = milestonesData?.milestones || [];
    const taskBasedMilestones = teamTasksData.filter(
      (t) => t.isMilestone || t.taskType === "milestone",
    );

    const combined = [...milestones];

    taskBasedMilestones.forEach((tm) => {
      if (!combined.some((m) => m._id === tm._id || m.title === tm.title)) {
        const linkedIds =
          tm.linkedTasks?.length > 0
            ? tm.linkedTasks
            : tm.milestoneData?.linkedTaskIds || [];

        combined.push({
          _id: tm._id,
          title: tm.title,
          status: tm.status === "DONE" ? "ACHIEVED" : tm.status,
          dueDate: tm.dueDate,
          priority: tm.priority,
          progressPercentage: tm.progress || 0,
          linkedTasks: linkedIds.map((ltId) => ({ taskId: ltId })),
          isTaskBased: true,
          assignedTo: tm.assignedTo,
        });
      }
    });

    return combined
      .map((m) => {
        const totalTasks = m.linkedTasks?.length || 0;
        let progress = m.progressPercentage || 0;

        if (m.isTaskBased) {
          const linkedTasks = teamTasksData.filter((t) =>
            m.linkedTasks?.some(
              (lt) => (lt.taskId?._id || lt.taskId) === t._id,
            ),
          );
          if (totalTasks > 0 && !m.progressPercentage) {
            progress = Math.round(
              (linkedTasks.filter((t) => t.status === "DONE").length /
                totalTasks) *
                100,
            );
          }
        }

        return {
          id: m._id,
          name: m.title,
          progress: progress,
          status: m.status === "ACHIEVED" ? "completed" : "active",
          health: m.isAtRisk ? "risk" : "good",
          priority: m.priority || "medium",
          totalTasks: totalTasks,
        };
      })
      .slice(0, 4);
  }, [milestonesData, teamTasksData]);

  const weeklyPerformance = useMemo(() => {
    if (teamData?.weeklyPerformance) return teamData.weeklyPerformance;

    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const performance = days.map((day) => ({ day, completed: 0, assigned: 0 }));

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    teamTasksData.forEach((task) => {
      if (task.createdAt && new Date(task.createdAt) >= oneWeekAgo) {
        const dayIndex = new Date(task.createdAt).getDay();
        const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1;

        if (adjustedIndex >= 0 && adjustedIndex < 7) {
          performance[adjustedIndex].assigned++;
          const status = (task.status || "").toUpperCase();
          if (status === "DONE" || status === "COMPLETED") {
            performance[adjustedIndex].completed++;
          }
        }
      }
    });

    return performance;
  }, [teamData, teamTasksData]);

  // Productivity & Efficiency Chart
  const efficiencyPie = useMemo(() => {
    let onTime = 0,
      late = 0;

    for (const t of filteredTasks) {
      const status = (t.status || "").toUpperCase();
      const isDone = status === "DONE" || status === "COMPLETED";
      if (!isDone || !t.dueDate || !(t.completedDate || t.completedAt))
        continue;

      const compDate = new Date(t.completedDate || t.completedAt);
      const dueDate = new Date(t.dueDate);

      if (compDate <= dueDate) onTime++;
      else late++;
    }

    if (onTime === 0 && late === 0) {
      const totalTasks = filteredTasks.length;
      if (totalTasks === 0) {
        return {
          tooltip: { trigger: "item" },
          series: [
            {
              type: "pie",
              radius: ["45%", "70%"],
              data: [
                { value: 1, name: "No Data", itemStyle: { color: "#e5e7eb" } },
              ],
              label: { show: true, formatter: "No tasks", position: "center" },
            },
          ],
        };
      }
      return {
        tooltip: { trigger: "item" },
        series: [
          {
            type: "pie",
            radius: ["45%", "70%"],
            data: [
              {
                value: totalTasks,
                name: "Pending Tasks",
                itemStyle: { color: "#fbbf24" },
              },
            ],
            label: {
              show: true,
              formatter: "No completed tasks",
              position: "center",
            },
          },
        ],
      };
    }

    return {
      tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
      series: [
        {
          name: "Efficiency",
          type: "pie",
          radius: ["45%", "70%"],
          label: { show: true, formatter: "{b}: {d}%" },
          labelLine: { show: true },
          data: [
            { value: onTime, name: "On-time", itemStyle: { color: "#16a34a" } },
            { value: late, name: "Late", itemStyle: { color: "#ef4444" } },
          ],
        },
      ],
    };
  }, [filteredTasks]);

  // Workload by Priority Chart
  const workloadStacked = useMemo(() => {
    if (!teamMembers.length) {
      return {
        title: {
          show: true,
          text: "No team members found",
          left: "center",
          top: "center",
        },
        xAxis: { type: "category", data: [] },
        yAxis: { type: "value" },
        series: [],
      };
    }

    const map = new Map(
      teamMembers.map((m) => [
        String(m.id),
        { name: m.name || "Unknown", high: 0, medium: 0, low: 0 },
      ]),
    );

    for (const t of filteredTasks) {
      const pid = String(t.assigneeId);
      if (map.has(pid)) {
        const priority = (t.priority || "low").toLowerCase();
        if (priority === "high" || priority === "urgent") {
          map.get(pid).high++;
        } else if (priority === "medium") {
          map.get(pid).medium++;
        } else {
          map.get(pid).low++;
        }
      }
    }

    const names = Array.from(map.values()).map((x) => x.name);
    const highData = Array.from(map.values()).map((x) => x.high);
    const mediumData = Array.from(map.values()).map((x) => x.medium);
    const lowData = Array.from(map.values()).map((x) => x.low);

    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      legend: { bottom: 0, orient: "horizontal", left: "center" },
      grid: {
        left: "8%",
        right: "5%",
        top: "10%",
        bottom: "15%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: names,
        axisLabel: { rotate: 25, interval: 0, fontSize: 11 },
      },
      yAxis: { type: "value", name: "Number of Tasks" },
      series: [
        {
          name: "High Priority",
          type: "bar",
          stack: "total",
          itemStyle: { color: "#ef4444", borderRadius: [4, 4, 0, 0] },
          data: highData,
          label: {
            show: true,
            position: "inside",
            formatter: (params) => (params.value > 0 ? params.value : ""),
          },
        },
        {
          name: "Medium Priority",
          type: "bar",
          stack: "total",
          itemStyle: { color: "#f59e0b" },
          data: mediumData,
          label: {
            show: true,
            position: "inside",
            formatter: (params) => (params.value > 0 ? params.value : ""),
          },
        },
        {
          name: "Low Priority",
          type: "bar",
          stack: "total",
          itemStyle: { color: "#10b981", borderRadius: [0, 0, 4, 4] },
          data: lowData,
          label: {
            show: true,
            position: "inside",
            formatter: (params) => (params.value > 0 ? params.value : ""),
          },
        },
      ],
    };
  }, [filteredTasks, teamMembers]);

  const getStatusColor = (status) => {
    switch (status) {
      case "online":
        return "bg-green-500";
      case "busy":
        return "bg-yellow-500";
      case "offline":
        return "bg-gray-400";
      default:
        return "bg-gray-400";
    }
  };

  const getPriorityColor = (priority) => {
    switch ((priority || "").toLowerCase()) {
      case "urgent":
      case "high":
        return "text-red-600 bg-red-50";
      case "medium":
        return "text-yellow-600 bg-yellow-50";
      case "low":
        return "text-green-600 bg-green-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const handleOpenMember = (member) => {
    setSelectedMember(member);
  };
  const handleCloseMember = () => setSelectedMember(null);

  const isLoading =
    membersLoading || tasksLoading || milestonesLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-lg text-gray-600">Loading team dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen font-['Open_Sans','Helvetica_Neue',Helvetica,Arial,sans-serif]"
      style={{ backgroundColor: "#f3f3f4" }}
    >
      <div className="p-4">
        {/* PAGE HEADER */}
        <div className="bg-white border border-gray-200 rounded-sm px-5 py-4 shadow-sm mb-3 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2
              className="text-[22px] font-medium m-0 leading-none"
              style={{ color: "#676a6c" }}
            >
              {(() => {
                const h = new Date().getHours();
                const greeting =
                  h < 12
                    ? "🌤️ Good morning"
                    : h < 17
                      ? "☀️ Good afternoon"
                      : "🌙 Good evening";
                return (
                  <>
                    {greeting},{" "}
                    <span className="font-semibold text-blue-600">
                      {user?.firstName || "Manager"}
                    </span>
                  </>
                );
              })()}
            </h2>
            <p className="text-sm mt-2 m-0" style={{ color: "#9a9a9a" }}>
              Your team has{" "}
              <span className="font-semibold text-gray-700">
                {teamStatsForHeader.totalTasks}
              </span>{" "}
              tasks,{" "}
              <span className="font-semibold text-gray-700">
                {teamStatsForHeader.completedTasks}
              </span>{" "}
              completed.
            </p>
          </div>

          {/* Team Progress Bar */}
          {(() => {
            const progressPercentage = teamStatsForHeader.completionPercentage;
            const progressText =
              progressPercentage <= 20
                ? "Team needs a push 🚀"
                : progressPercentage <= 50
                  ? "Building momentum ✨"
                  : progressPercentage <= 80
                    ? "Team is crushing it 🔥"
                    : "Exceptional team performance 🏆";

            return (
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-3 border-r border-gray-200 pr-5">
                  <div className="relative w-14 h-14">
                    <svg viewBox="0 0 44 44" className="w-14 h-14 -rotate-90">
                      <circle
                        cx="22"
                        cy="22"
                        r="18"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="4"
                      />
                      <circle
                        cx="22"
                        cy="22"
                        r="18"
                        fill="none"
                        stroke="#14b8a6"
                        strokeWidth="4"
                        strokeDasharray={`${(progressPercentage / 100) * 113} 113`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-bold text-gray-800">
                        {progressPercentage}%
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">
                      Team progress
                    </p>
                    <p className="text-sm font-semibold text-gray-700">
                      {progressPercentage >= 80
                        ? "Excellent"
                        : progressPercentage >= 50
                          ? "On Track"
                          : "Needs Focus"}
                    </p>
                  </div>
                </div>
                <div className="max-w-[180px]">
                  <p className="text-sm font-medium text-gray-700 leading-[18px]">
                    {progressText}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Filters & Actions */}
        <div className="bg-white border border-gray-200 rounded-sm p-3 mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search tasks or members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value || "")}
                className="h-8 pl-9 pr-3 w-full border border-gray-200 rounded-sm bg-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>

            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value)}
              className="h-8 px-2 text-sm border border-gray-200 rounded-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Time</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
            </select>

            <select
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
              className="h-8 px-2 text-sm border border-gray-200 rounded-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All members</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || "Unnamed"}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-8 px-2 text-sm border border-gray-200 rounded-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <ExportButton reportType="team" buttonText="Export" />
            <Button
              variant="default"
              className="h-8 rounded-sm bg-blue-600 hover:bg-blue-700 text-white text-sm"
              onClick={() => setScheduleOpen(true)}
            >
              <CalendarClock className="w-3.5 h-3.5 mr-1.5" />
              Schedule
            </Button>
          </div>
        </div>

        {/* TODAY FOCUS */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-sm mb-3">
          <div
            className="py-2.5 px-4 border-b border-gray-200 flex items-center justify-between rounded-sm"
            style={{ backgroundColor: "#f9f9f9" }}
          >
            <h5
              className="text-xs font-semibold uppercase tracking-wider m-0 flex items-center gap-1.5"
              style={{ color: "#676a6c" }}
            >
              <Star size={12} className="text-yellow-500" /> Today Focus - Team
              Tasks
            </h5>
            <div className="flex gap-1">
              {["today", "overdue", "approvals"].map((tab) => (
                <button
                  key={tab}
                  className={`py-0.5 px-2.5 text-xs font-medium transition-colors border rounded-sm ${
                    focusTab === tab
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white border-gray-300 hover:bg-gray-50"
                  }`}
                  style={focusTab !== tab ? { color: "#676a6c" } : {}}
                  onClick={() => setFocusTab(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {focusTabTasks.length > 0 ? (
            <div className="relative">
              <div
                className="overflow-x-auto scrollbar-thin"
                style={{ scrollbarWidth: "thin" }}
              >
                <div
                  className="flex gap-2.5 p-3"
                  style={{ minWidth: "max-content" }}
                >
                  {focusTabTasks.map((task) => (
                    <div
                      className="relative bg-white border border-gray-200 rounded-sm p-4 hover:shadow-md transition-all duration-300 cursor-pointer"
                      key={task._id || task.id}
                      style={{ width: "260px", flexShrink: 0 }}
                      onClick={() =>
                        setLocation(
                          `/tasks/${task._id}?activeRole=${activeRole}`,
                        )
                      }
                    >
                      <div
                        className={`absolute left-0 top-0 h-full w-1 rounded-sm ${
                          task.priority === "high"
                            ? "bg-red-500"
                            : task.priority === "medium"
                              ? "bg-yellow-500"
                              : "bg-green-500"
                        }`}
                      />
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 min-w-0">
                          {getTaskTypeIcon(task, 14)}
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-gray-800 truncate">
                              {task.title}
                            </h4>
                            <p className="text-xs text-gray-400 mt-0.5">
                              Assigned to: {task.assignee || "Unassigned"}
                            </p>
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-sm bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-700 flex-shrink-0">
                          {task.assignee?.[0] || "T"}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div>
                          <p
                            className={`text-xs font-semibold ${
                              task.priority === "high"
                                ? "text-red-500"
                                : task.priority === "medium"
                                  ? "text-yellow-600"
                                  : "text-blue-500"
                            }`}
                          >
                            {task.dueDate
                              ? (() => {
                                  const diff = Math.round(
                                    (new Date(task.dueDate) - new Date()) /
                                      60000,
                                  );
                                  if (diff > 0 && diff < 1440) {
                                    return `Due in ${Math.floor(diff / 60)}h ${diff % 60}m`;
                                  }
                                  return `Due ${new Date(task.dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`;
                                })()
                              : "No due date"}
                          </p>
                        </div>
                        <div
                          className={`text-xs font-semibold flex items-center gap-1 ${
                            task.priority === "high"
                              ? "text-red-500"
                              : task.priority === "medium"
                                ? "text-yellow-600"
                                : "text-blue-500"
                          }`}
                        >
                          <span>⚑</span>
                          <span className="capitalize">
                            {task.priority || "Low"}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3">{getStatusBadge(task.status)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3">
              <div className="bg-green-50 border border-green-200 text-green-700 py-2 px-3 text-sm flex items-center gap-2 rounded-sm">
                <CheckSquare size={14} /> No team tasks found for this tab.
              </div>
            </div>
          )}
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5 mb-3">
          {kpiCards.map(
            ({
              label,
              value,
              icon: Icon,
              iconColor,
              iconBg,
              testId,
              onClick,
              isProgressCard,
              percentage,
            }) => (
              <div
                key={testId}
                onClick={onClick}
                data-testid={testId}
                className="group bg-white border border-[#e7e7e9] rounded-sm px-4 pt-2 pb-2 cursor-pointer transition-all duration-300 hover:shadow-[0_3px_14px_rgba(0,0,0,0.05)] hover:-translate-y-[1px] min-h-[126px] flex flex-col justify-between overflow-hidden relative"
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-[#8e8e93] uppercase tracking-[0.08em] leading-none">
                      {label}
                    </p>
                    <h2 className="text-[30px] font-bold text-[#1f2937] tracking-tight leading-none mt-2">
                      {value}
                    </h2>
                  </div>
                  <div
                    className={`w-10 h-10 flex items-center justify-center flex-shrink-0 shadow-sm border border-white/50 ${iconBg}`}
                  >
                    <Icon className={iconColor} size={15} />
                  </div>
                </div>
                <div className="mt-auto pt-1 w-full opacity-95">
                  {isProgressCard ? (
                    <svg
                      viewBox="0 0 110 38"
                      width="100%"
                      height="38"
                      preserveAspectRatio="none"
                    >
                      <rect
                        x="0"
                        y="13"
                        width="110"
                        height="7"
                        rx="3.5"
                        fill="#e0e7ff"
                      />
                      <rect
                        x="0"
                        y="13"
                        width={`${(percentage || 0) * 1.1}`}
                        height="7"
                        rx="3.5"
                        fill="#4f46e5"
                      />
                      <text
                        x="0"
                        y="33"
                        fontSize="8"
                        fill="#6b7280"
                        fontFamily="sans-serif"
                      >
                        Team productivity
                      </text>
                      <text
                        x="82"
                        y="33"
                        fontSize="8"
                        fill="#4f46e5"
                        fontFamily="sans-serif"
                        fontWeight="700"
                      >
                        {percentage || 0}%
                      </text>
                    </svg>
                  ) : label === "Overdue" ? (
                    <svg
                      viewBox="0 0 110 38"
                      width="100%"
                      height="38"
                      preserveAspectRatio="none"
                    >
                      <rect
                        x="2"
                        y="18"
                        width="10"
                        height="16"
                        rx="2"
                        fill="#fda4af"
                        opacity="0.7"
                      />
                      <rect
                        x="17"
                        y="10"
                        width="10"
                        height="24"
                        rx="2"
                        fill="#ef4444"
                        opacity="0.9"
                      />
                      <rect
                        x="32"
                        y="21"
                        width="10"
                        height="13"
                        rx="2"
                        fill="#fda4af"
                        opacity="0.65"
                      />
                      <rect
                        x="47"
                        y="6"
                        width="10"
                        height="28"
                        rx="2"
                        fill="#dc2626"
                      />
                      <rect
                        x="62"
                        y="14"
                        width="10"
                        height="20"
                        rx="2"
                        fill="#fb7185"
                        opacity="0.75"
                      />
                      <rect
                        x="77"
                        y="22"
                        width="10"
                        height="12"
                        rx="2"
                        fill="#fda4af"
                        opacity="0.6"
                      />
                      <rect
                        x="92"
                        y="9"
                        width="10"
                        height="25"
                        rx="2"
                        fill="#ef4444"
                        opacity="0.9"
                      />
                    </svg>
                  ) : label === "Completed" ? (
                    <svg
                      viewBox="0 0 110 38"
                      width="100%"
                      height="38"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient
                          id="grad-completed"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#3b82f6"
                            stopOpacity="0.22"
                          />
                          <stop
                            offset="100%"
                            stopColor="#3b82f6"
                            stopOpacity="0"
                          />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0,30 C10,26 20,24 30,19 C40,15 50,17 60,12 C70,8 80,10 90,5 C100,3 105,2 110,1"
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M0,30 C10,26 20,24 30,19 C40,15 50,17 60,12 C70,8 80,10 90,5 C100,3 105,2 110,1 L110,38 L0,38 Z"
                        fill="url(#grad-completed)"
                      />
                    </svg>
                  ) : label === "In Progress" ? (
                    <svg
                      viewBox="0 0 110 38"
                      width="100%"
                      height="38"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient
                          id="grad-progress"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#10b981"
                            stopOpacity="0.2"
                          />
                          <stop
                            offset="100%"
                            stopColor="#10b981"
                            stopOpacity="0"
                          />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0,20 C8,11 16,28 24,18 C32,7 40,24 48,15 C56,8 64,21 72,12 C80,4 88,18 96,10 C102,5 106,8 110,6"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M0,20 C8,11 16,28 24,18 C32,7 40,24 48,15 C56,8 64,21 72,12 C80,4 88,18 96,10 C102,5 106,8 110,6 L110,38 L0,38 Z"
                        fill="url(#grad-progress)"
                      />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 110 38"
                      width="100%"
                      height="38"
                      preserveAspectRatio="none"
                    >
                      <rect
                        x="2"
                        y="20"
                        width="11"
                        height="14"
                        rx="2"
                        fill="#fbbf24"
                        opacity="0.65"
                      />
                      <rect
                        x="17"
                        y="14"
                        width="11"
                        height="20"
                        rx="2"
                        fill="#f59e0b"
                        opacity="0.75"
                      />
                      <rect
                        x="32"
                        y="18"
                        width="11"
                        height="16"
                        rx="2"
                        fill="#fbbf24"
                        opacity="0.7"
                      />
                      <rect
                        x="47"
                        y="8"
                        width="11"
                        height="26"
                        rx="2"
                        fill="#d97706"
                        opacity="0.95"
                      />
                      <rect
                        x="62"
                        y="12"
                        width="11"
                        height="22"
                        rx="2"
                        fill="#f59e0b"
                        opacity="0.78"
                      />
                      <rect
                        x="77"
                        y="4"
                        width="11"
                        height="30"
                        rx="2"
                        fill="#b45309"
                      />
                      <rect
                        x="92"
                        y="10"
                        width="11"
                        height="24"
                        rx="2"
                        fill="#f59e0b"
                        opacity="0.88"
                      />
                    </svg>
                  )}
                </div>
                <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-gray-200 to-transparent opacity-60" />
              </div>
            ),
          )}
        </div>

        {/* MODERN GRAPHS SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
          <div className="bg-white rounded-sm shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <div className="w-6 h-6 rounded-sm bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-white" />
                </div>
                Productivity & Efficiency
              </h2>
              <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-sm">
                {
                  filteredTasks.filter(
                    (t) => t.status === "DONE" || t.status === "COMPLETED",
                  ).length
                }{" "}
                completed
              </span>
            </div>
            <div className="p-5">
              <ReactECharts option={efficiencyPie} style={{ height: 280 }} />
            </div>
          </div>

          <div className="bg-white rounded-sm shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <div className="w-6 h-6 rounded-sm bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-white" />
                </div>
                Workload by Priority
              </h2>
              <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-sm">
                {filteredTasks.length} total tasks
              </span>
            </div>
            <div className="p-5">
              <ReactECharts option={workloadStacked} style={{ height: 300 }} />
            </div>
          </div>
        </div>

        {/* MAIN CONTENT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Team Members List */}
          <div className="lg:col-span-2 bg-white rounded-sm shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center">
                <Users className="w-4 h-4 mr-2 text-blue-500" />
                Team Members
              </h2>
            </div>
            <div className="p-4">
              <div className="space-y-2">
                {teamMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => handleOpenMember(member)}
                    className="w-full text-left flex items-center justify-between p-3 bg-gray-50 rounded-sm hover:bg-gray-100 transition-all duration-200 border border-transparent hover:border-gray-200"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-sm flex items-center justify-center text-white font-semibold text-xs shadow-sm">
                          {member.avatar || "U"}
                        </div>
                        <div
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-sm ring-2 ring-white ${getStatusColor(member.status)}`}
                        ></div>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800 text-sm">
                          {member.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-sm">
                            {Array.isArray(member.role)
                              ? member.role.join(", ")
                              : member.role}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center space-x-3 text-sm">
                        <div>
                          <p className="text-gray-500 text-[10px]">Active</p>
                          <p className="font-semibold text-gray-700 text-xs">
                            {member.activeTasks}
                          </p>
                        </div>
                        <div>
                          <p className="text-rose-500 text-[10px]">Overdue</p>
                          <p className="font-semibold text-rose-600 text-xs">
                            {member.overdueTasks}
                          </p>
                        </div>
                        <div className="pl-2 border-l border-gray-200">
                          <p className="font-semibold text-gray-800 text-xs">
                            {member.productivity}%
                          </p>
                          <p className="text-[9px] text-gray-400">
                            Productivity
                          </p>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Stats Sidebar */}
          <div className="space-y-3">
            <div className="bg-white rounded-sm shadow-sm border border-gray-100 flex flex-col">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-800 flex items-center">
                  <CheckSquare className="w-4 h-4 mr-2 text-emerald-500" />
                  Milestones Progress
                </h2>
              </div>
              <div className="p-4 space-y-3">
                {projectStats.map((ms) => (
                  <div
                    key={ms.name}
                    className="border border-gray-100 rounded-sm p-3 bg-gray-50/30"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {ms.name}
                      </p>
                      <span className="text-xs text-gray-500 bg-white px-1.5 py-0.5 rounded-sm shadow-sm">
                        {ms.progress}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-sm h-1.5 mb-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-sm transition-all duration-300"
                        style={{ width: `${Math.min(100, ms.progress)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-500">
                        {ms.totalTasks} tasks
                      </span>
                      {ms.health === "risk" ? (
                        <span className="text-rose-600 font-medium">
                          ⚠️ At risk
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-medium">
                          On track
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {projectStats.length === 0 && (
                  <div className="text-center py-6">
                    <Target className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No milestones yet</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-sm shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800 flex items-center">
                  <BarChart3 className="w-4 h-4 mr-2 text-emerald-500" />
                  Weekly Performance
                </h3>
              </div>
              <div className="p-4">
                <div className="space-y-2">
                  {weeklyPerformance.map((day, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-gray-500 w-7">
                        {day.day}
                      </span>
                      <div className="flex-1 bg-gray-100 rounded-sm h-1.5">
                        <div
                          className="bg-gradient-to-r from-blue-400 to-blue-600 h-1.5 rounded-sm transition-all duration-300"
                          style={{
                            width: `${Math.min(100, day.assigned > 0 ? (day.completed / day.assigned) * 100 : 0)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">
                        {day.completed}/{day.assigned}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* TEAM TASK LIST */}
        <div
          className="bg-white border border-gray-200 shadow-sm rounded-sm mt-3"
          id="team-tasks"
        >
          <div
            className="py-2.5 px-4 border-b border-gray-200 rounded-sm"
            style={{ backgroundColor: "#f9f9f9" }}
          >
            <div className="flex items-center justify-between mb-2">
              <h5
                className="text-xs font-semibold uppercase tracking-wider m-0"
                style={{ color: "#676a6c" }}
              >
                Team Task List
              </h5>
              <div className="flex gap-1">
                {[
                  { key: "all", label: "All", count: teamTasks.length },
                  {
                    key: "today",
                    label: "Today",
                    count: teamTasks.filter(
                      (t) =>
                        t.dueDate &&
                        new Date(t.dueDate).toDateString() ===
                          new Date().toDateString(),
                    ).length,
                  },
                  {
                    key: "overdue",
                    label: "Overdue",
                    count: teamTasks.filter((t) => {
                      const now = new Date();
                      now.setHours(0, 0, 0, 0);
                      if (!t.dueDate) return false;
                      const dueDate = new Date(t.dueDate);
                      dueDate.setHours(0, 0, 0, 0);
                      const status = (t.status || "").toUpperCase();
                      return (
                        dueDate < now &&
                        status !== "DONE" &&
                        status !== "COMPLETED" &&
                        status !== "CANCELLED"
                      );
                    }).length,
                  },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setTaskListFilter(tab.key)}
                    className={`px-2.5 py-0.5 text-xs font-medium border rounded-sm transition-colors ${taskListFilter === tab.key ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 bg-white hover:bg-gray-50"}`}
                    style={
                      taskListFilter !== tab.key ? { color: "#676a6c" } : {}
                    }
                  >
                    {tab.label}{" "}
                    <span
                      className={`ml-0.5 ${taskListFilter === tab.key ? "text-blue-200" : "text-gray-400"}`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            {filteredTasks.length > 0 ? (
              <table className="w-full">
                <thead style={{ backgroundColor: "#f9f9f9" }}>
                  <tr>
                    <th
                      className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "#676a6c" }}
                    >
                      Task
                    </th>
                    <th
                      className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "#676a6c" }}
                    >
                      Assignee
                    </th>
                    <th
                      className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "#676a6c" }}
                    >
                      Due Date
                    </th>
                    <th
                      className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "#676a6c" }}
                    >
                      Priority
                    </th>
                    <th
                      className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "#676a6c" }}
                    >
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTasks.slice(0, 5).map((task) => (
                    <tr
                      key={task.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() =>
                        setLocation(
                          `/tasks/${task.id}?activeRole=${activeRole}`,
                        )
                      }
                    >
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5">
                          {getTaskTypeIcon(task, 13)}
                          <span
                            className="text-sm font-medium truncate max-w-[200px] block"
                            style={{ color: "#676a6c" }}
                            title={task.title}
                          >
                            {task.title}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-sm text-gray-600">
                        {task.assignee}
                      </td>
                      <td
                        className="py-2 px-3 text-xs whitespace-nowrap"
                        style={{ color: "#9a9a9a" }}
                      >
                        {task.dueDate
                          ? new Date(task.dueDate).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                            })
                          : "—"}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-sm ${
                            task.priority === "high"
                              ? "text-red-600 bg-red-50 border border-red-200"
                              : task.priority === "medium"
                                ? "text-yellow-600 bg-yellow-50 border border-yellow-200"
                                : "text-green-600 bg-green-50 border border-green-200"
                          }`}
                        >
                          {task.priority || "Low"}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        {getStatusBadge(task.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-6">
                <CheckSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">
                  No tasks match your filters
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Schedule modal */}
      {scheduleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">
                Schedule Report Email
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setScheduleOpen(false)}
                className="rounded-sm"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="p-5 space-y-4">
              <select
                className="border border-gray-200 rounded-sm px-3 py-2 w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                value={scheduleForm.frequency}
                onChange={(e) =>
                  setScheduleForm((s) => ({ ...s, frequency: e.target.value }))
                }
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <input
                type="time"
                className="h-10 border border-gray-200 rounded-sm px-3 py-2 w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                value={scheduleForm.time}
                onChange={(e) =>
                  setScheduleForm((s) => ({ ...s, time: e.target.value }))
                }
              />
              <input
                type="email"
                className="h-10 border border-gray-200 rounded-sm px-3 py-2 w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="manager@company.com"
                value={scheduleForm.email}
                onChange={(e) =>
                  setScheduleForm((s) => ({ ...s, email: e.target.value }))
                }
              />
            </div>
            <div className="px-5 py-4 border-t flex justify-end gap-3 bg-gray-50">
              <Button
                variant="outline"
                className="h-9 rounded-sm border-gray-200"
                onClick={() => setScheduleOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                className="h-9 rounded-sm bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  setScheduleOpen(false);
                  showSuccessToast("Schedule saved (stub)");
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Member Drill-Down Panel */}
      {selectedMember && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={handleCloseMember}
          />
          <div className="absolute right-0 top-0 h-full w-full sm:w-[32rem] bg-white shadow-2xl border-l border-gray-100 flex flex-col animate-in slide-in-from-right duration-300">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-sm flex items-center justify-center text-white font-semibold shadow-sm">
                  {selectedMember.avatar}
                </div>
                <div>
                  <div className="font-semibold text-gray-800 text-lg">
                    {selectedMember.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {selectedMember.role}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCloseMember}
                className="rounded-sm"
              >
                <X className="w-5 h-5 text-gray-500" />
              </Button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <h4 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-blue-500" /> Assigned Tasks
              </h4>
              <div className="space-y-4">
                {teamTasks
                  .filter(
                    (t) => String(t.assigneeId) === String(selectedMember.id),
                  )
                  .map((t) => (
                    <div
                      key={t.id}
                      className="border border-gray-100 rounded-sm p-4 bg-white shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-gray-800 flex items-center gap-2 flex-wrap">
                            {getTaskTypeIcon(t, 14)}
                            <span className="truncate" title={t.title}>
                              {t.title}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Due:{" "}
                            {t.dueDate
                              ? new Date(t.dueDate).toLocaleDateString()
                              : "N/A"}
                          </div>
                          <div
                            className={`inline-flex mt-2 px-2 py-0.5 rounded-sm text-xs font-medium ${getPriorityColor(t.priority)}`}
                          >
                            Priority: {t.priority}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                {teamTasks.filter(
                  (t) => String(t.assigneeId) === String(selectedMember.id),
                ).length === 0 && (
                  <div className="text-center py-8">
                    <CheckSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">
                      No tasks assigned to {selectedMember.name}.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerDashboard;
