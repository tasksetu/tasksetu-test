import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useActiveRole } from "@/components/RoleSwitcher";
import { useShowToast } from "@/utils/ToastMessage";
import { useTaskStatuses } from "@/hooks/useTaskStatuses";
import { useTaskPriorities } from "@/hooks/useTaskPriorities";
import {
  BarChart3,
  Clock,
  CheckSquare,
  AlertTriangle,
  Target,
  Calendar,
  Download,
  Zap,
  FolderTree,
  UserCheck,
  Bell,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  Flame,
  ListChecks,
  Trophy,
  Users,
  Loader,
  Star,
  Activity,
  TrendingUp,
  Crown,
  ArrowUpRight,
  X,
  Filter,
  CalendarClock,
} from "lucide-react";
import { useAuth } from "@/features/shared/hooks/useAuth";
import {
  RegularTaskIcon,
  RecurringTaskIcon,
  QuickTaskIcon,
  MilestoneTaskIcon,
  ApprovalTaskIcon,
} from "../components/common/TaskIcons";

const TASK_DISPLAY_LIMIT = 15;

const OrganizationDashboard = () => {
  const [location, setLocation] = useLocation();
  const { activeRole } = useActiveRole();
  const { showSuccessToast } = useShowToast();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    frequency: "weekly",
    day: "Monday",
    time: "09:00",
    email: "",
  });
  const [calendarView, setCalendarView] = useState("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [taskFilters, setTaskFilters] = useState({
    search: "",
    status: "all",
    priority: "all",
    dueDate: "all",
  });
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const { data: taskStatuses = [] } = useTaskStatuses();
  const { data: taskPriorities = [] } = useTaskPriorities();
  const { user } = useAuth();

  const { data: dashboardStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["/api/dashboard-stats", activeRole, user?.id],
    queryFn: async () => {
      const res = await fetch("/api/dashboard-stats", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            errorData.message ||
            "Failed to fetch dashboard stats",
        );
      }
      const data = await res.json();
      return data.data;
    },
    enabled: !!user,
    staleTime: 60000,
  });

  const {
    data: tasksResponse,
    isLoading: isLoadingTasks,
    error: tasksError,
  } = useQuery({
    queryKey: [
      "/api/mytasks",
      activeRole,
      taskFilters.status,
      taskFilters.priority,
      taskFilters.dueDate,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("page", "1");
      params.append("limit", "50");
      if (activeRole) params.append("activeRole", activeRole);
      if (taskFilters.status !== "all")
        params.append("status", taskFilters.status);
      if (taskFilters.priority !== "all")
        params.append("priority", taskFilters.priority);
      if (taskFilters.dueDate !== "all")
        params.append("dueDate", taskFilters.dueDate);

      const response = await fetch(`/api/mytasks?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            errorData.message ||
            `Failed to fetch tasks: ${response.status}`,
        );
      }
      return response.json();
    },
    enabled: !!localStorage.getItem("token") && !!activeRole,
    retry: 1,
    staleTime: 30000,
  });

  const pct = (a, b) => (b === 0 ? 0 : Math.round((a / b) * 100));

  const currentStats = {
    completedTasks: dashboardStats?.completedTodayCount || 0,
    beforeDueDate: dashboardStats?.beforeDueDateCount || 0,
    milestoneCount: dashboardStats?.milestoneTasksCount || 0,
    collaboratorCount: dashboardStats?.collaboratorTasksCount || 0,
    overdueTasks: dashboardStats?.pastDueDateCount || 0,
    approvalCount: dashboardStats?.approvalTasksCount || 0,
    teamActivity: dashboardStats?.productivity || 0,
  };

  const allTasks = useMemo(() => {
    return (
      tasksResponse?.data?.tasks ||
      tasksResponse?.tasks ||
      tasksResponse?.data ||
      []
    );
  }, [tasksResponse]);

  const taskGridData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return allTasks.map((task) => {
      const dueDate = task.dueDate ? new Date(task.dueDate) : null;
      return {
        id: task._id || task.id,
        title: task.title,
        assignee:
          task.assignedTo?.firstName ||
          task.assignedTo?.username ||
          "Unassigned",
        dueDate: dueDate ? dueDate.toISOString().split("T")[0] : "No due date",
        status: task.status,
        priority: task.priority || "medium",
        hasSubtasks: task.subtasks && task.subtasks.length > 0,
        isPastDue: dueDate && dueDate < today && task.status !== "DONE",
        isDueToday: dueDate && dueDate.toDateString() === today.toDateString(),
        taskType: task.taskType,
        isSubtask: task.isSubtask,
        tags: task.tags || [],
        progress: task.progress || 0,
      };
    });
  }, [allTasks]);

  const getCalendarDateRange = () => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);
    if (calendarView === "month") {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    } else if (calendarView === "week") {
      const dayOfWeek = start.getDay();
      start.setDate(start.getDate() - dayOfWeek);
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime());
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }
    return { start, end };
  };

  const calendarTasks = useMemo(() => {
    const { start: viewStart, end: viewEnd } = getCalendarDateRange();
    return allTasks
      .filter((task) => {
        const taskDate = task.createdAt
          ? new Date(task.createdAt)
          : task.dueDate
            ? new Date(task.dueDate)
            : null;
        if (!taskDate) return false;
        return taskDate >= viewStart && taskDate <= viewEnd;
      })
      .map((task) => ({
        id: task._id || task.id,
        title: task.title,
        date: new Date(task.createdAt || task.dueDate)
          .toISOString()
          .split("T")[0],
        type: task.taskType || "regular",
        status: task.status,
      }));
  }, [allTasks, currentDate, calendarView]);

  const completedTasksFilter = useMemo(
    () => allTasks.filter((t) => t.status === "DONE"),
    [allTasks],
  );
  const orgCompletion = useMemo(() => {
    const onTime = completedTasksFilter.filter((t) => {
      const dueDate = t.dueDate ? new Date(t.dueDate) : null;
      const completedDate = t.completedAt
        ? new Date(t.completedAt)
        : new Date();
      return dueDate && completedDate <= dueDate;
    }).length;
    const overdueClosed = completedTasksFilter.filter((t) => {
      const dueDate = t.dueDate ? new Date(t.dueDate) : null;
      const completedDate = t.completedAt
        ? new Date(t.completedAt)
        : new Date();
      return dueDate && completedDate > dueDate;
    }).length;
    return { onTime, overdueClosed };
  }, [completedTasksFilter]);

  const orgOnTimeRate = pct(
    orgCompletion.onTime,
    orgCompletion.onTime + orgCompletion.overdueClosed,
  );

  const openTasks = useMemo(
    () =>
      allTasks.filter((t) => t.status === "OPEN" || t.status === "INPROGRESS")
        .length,
    [allTasks],
  );

  const dueTodayTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return allTasks.filter((t) => {
      const d = t.dueDate ? new Date(t.dueDate) : null;
      return (
        d && d.toDateString() === today.toDateString() && t.status !== "DONE"
      );
    }).length;
  }, [allTasks]);

  const totalCompletedCount = useMemo(
    () => allTasks.filter((t) => t.status === "DONE").length,
    [allTasks],
  );
  const completionRate = pct(totalCompletedCount, allTasks.length);

  const highPriorityOpen = useMemo(
    () =>
      allTasks.filter(
        (t) =>
          (t.priority === "high" ||
            t.priority === "urgent" ||
            t.priority === "critical") &&
          t.status !== "DONE",
      ).length,
    [allTasks],
  );

  const moduleUsage = useMemo(() => {
    const quick = dashboardStats?.quickTasksCount || 0;
    const full = (dashboardStats?.regularTasksCount || 0) - quick;
    return { quick, full };
  }, [dashboardStats]);

  const totalModule = moduleUsage.quick + moduleUsage.full;
  const quickPct = pct(moduleUsage.quick, totalModule);
  const fullPct = 100 - quickPct;

  const exportDashboardData = () => {
    const rows = [];
    rows.push(["Dashboard Summary"]);
    rows.push(["Metric", "Value"]);
    rows.push(["Completed Today", currentStats.completedTasks]);
    rows.push(["Completed Before Due", currentStats.beforeDueDate]);
    rows.push(["Milestones Achieved", currentStats.milestoneCount]);
    rows.push(["Collaborator Tasks", currentStats.collaboratorCount]);
    rows.push(["Tasks Past Due", currentStats.overdueTasks]);
    rows.push(["Approvals Awaiting", currentStats.approvalCount]);
    rows.push([]);
    rows.push([
      "Task ID",
      "Title",
      "Status",
      "Priority",
      "Due Date",
      "Completed Date",
    ]);
    allTasks.forEach((t) =>
      rows.push([
        t._id || t.id,
        t.title,
        t.status,
        t.priority,
        t.dueDate ? new Date(t.dueDate).toISOString().split("T")[0] : "",
        t.completedDate
          ? new Date(t.completedDate).toISOString().split("T")[0]
          : "",
      ]),
    );
    const csv = rows
      .map((r) =>
        r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","),
      )
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `org-dashboard-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleTaskClick = (taskId) => {
    setLocation(`/tasks/${taskId}`);
  };
  const handleBulkAction = (action) => {
    console.log("Bulk action:", action, "on tasks:", selectedTasks);
  };

  const filteredTasks = useMemo(() => {
    return taskGridData.filter((task) => {
      if (
        taskFilters.search &&
        !task.title.toLowerCase().includes(taskFilters.search.toLowerCase())
      )
        return false;
      if (taskFilters.status !== "all" && task.status !== taskFilters.status)
        return false;
      if (
        taskFilters.priority !== "all" &&
        task.priority !== taskFilters.priority
      )
        return false;
      if (taskFilters.dueDate !== "all") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const taskDueDate =
          task.dueDate !== "No due date" ? new Date(task.dueDate) : null;
        if (taskFilters.dueDate === "today") {
          if (
            !taskDueDate ||
            taskDueDate.toDateString() !== today.toDateString()
          )
            return false;
        } else if (taskFilters.dueDate === "overdue") {
          if (!taskDueDate || taskDueDate >= today || task.status === "DONE")
            return false;
        } else if (taskFilters.dueDate === "upcoming") {
          const nextWeek = new Date(today);
          nextWeek.setDate(nextWeek.getDate() + 7);
          if (!taskDueDate || taskDueDate < today || taskDueDate > nextWeek)
            return false;
        }
      }
      return true;
    });
  }, [taskGridData, taskFilters]);

  const visibleTasks = showAllTasks
    ? filteredTasks
    : filteredTasks.slice(0, TASK_DISPLAY_LIMIT);
  const hiddenCount = filteredTasks.length - TASK_DISPLAY_LIMIT;

  const handleDateChange = (direction) => {
    const newDate = new Date(currentDate);
    if (calendarView === "month")
      newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1));
    else if (calendarView === "week")
      newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7));
    else newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1));
    setCurrentDate(newDate);
  };

  const handleCalendarDateClick = () => {
    setLocation("/tasks/create");
  };

  const handleFilterChange = (key, value) => {
    setShowAllTasks(false);
    setTaskFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Helper functions for icons and badges
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

  function getPriorityBadge(priority) {
    const p = (priority || "").toLowerCase();
    if (p === "high" || p === "urgent" || p === "critical")
      return (
        <span className="px-2 py-0.5 text-xs font-medium border rounded-sm text-red-600 bg-red-50 border-red-200">
          {priority}
        </span>
      );
    if (p === "medium")
      return (
        <span className="px-2 py-0.5 text-xs font-medium border rounded-sm text-yellow-600 bg-yellow-50 border-yellow-200">
          Medium
        </span>
      );
    return (
      <span className="px-2 py-0.5 text-xs font-medium border rounded-sm text-green-600 bg-green-50 border-green-200">
        Low
      </span>
    );
  }

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

  const getStatusLabel = (status) => {
    const fromDb = (Array.isArray(taskStatuses) ? taskStatuses : []).find(
      (s) => s && s.code === status,
    )?.label;
    if (fromDb) return fromDb;
    switch (status) {
      case "OPEN":
        return "Open";
      case "INPROGRESS":
        return "In Progress";
      case "DONE":
        return "Done";
      case "ONHOLD":
        return "On Hold";
      case "CANCELLED":
        return "Cancelled";
      default:
        return status?.replace("_", " ") || "Open";
    }
  };

  // KPI Cards - First Row (6 cards as before)
  const kpiCards = [
    {
      label: "Completed Today",
      value: currentStats.completedTasks,
      linkLabel: "Show all completed",
      icon: CheckSquare,
      iconColor: "text-green-600",
      iconBg: "bg-green-50",
      testId: "card-completed-today",
      onClick: () => setLocation("/tasks?statusFilter=DONE"),
    },
    {
      label: "Before Due Date",
      value: currentStats.beforeDueDate || 0,
      linkLabel: "Show all on-time",
      icon: Clock,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50",
      testId: "card-completed-before-due",
      onClick: () => setLocation("/tasks?dueDateFilter=upcoming"),
    },
    {
      label: "Milestones",
      value: currentStats.milestoneCount || 0,
      linkLabel: "Show all milestones",
      icon: Target,
      iconColor: "text-purple-600",
      iconBg: "bg-purple-50",
      testId: "card-milestones",
      onClick: () => setLocation("/tasks?taskTypeFilter=Milestone"),
    },
    {
      label: "Collaborator",
      value: currentStats.collaboratorCount || 0,
      linkLabel: "Show collaborator tasks",
      icon: UserCheck,
      iconColor: "text-indigo-600",
      iconBg: "bg-indigo-50",
      testId: "card-collaborator-tasks",
      onClick: () => setLocation("/tasks"),
    },
    {
      label: "Past Due",
      value: currentStats.overdueTasks,
      linkLabel: "Show all overdue",
      icon: AlertTriangle,
      iconColor: "text-red-600",
      iconBg: "bg-red-50",
      testId: "card-past-due",
      onClick: () => setLocation("/tasks?dueDateFilter=overdue"),
    },
    {
      label: "Approvals",
      value: currentStats.approvalCount || 0,
      linkLabel: "Show all approvals",
      icon: Bell,
      iconColor: "text-yellow-600",
      iconBg: "bg-yellow-50",
      testId: "card-approvals",
      onClick: () => setLocation("/tasks?taskTypeFilter=Approval"),
    },
  ];

  // New KPI Cards - Second Row (4 cards as before)
  const newKpiCards = [
    {
      label: "Open Tasks",
      value: openTasks,
      icon: ListChecks,
      iconColor: "text-cyan-600",
      iconBg: "bg-cyan-50",
      linkLabel: "View open tasks",
      testId: "card-open-tasks",
      onClick: () => setLocation("/tasks?statusFilter=OPEN"),
    },
    {
      label: "Due Today",
      value: dueTodayTasks,
      icon: Flame,
      iconColor: "text-orange-500",
      iconBg: "bg-orange-50",
      linkLabel: "Show due today",
      testId: "card-due-today",
      onClick: () => setLocation("/tasks?dueDateFilter=today"),
    },
    {
      label: "Completion Rate",
      value: `${completionRate}%`,
      icon: Trophy,
      iconColor: "text-amber-500",
      iconBg: "bg-amber-50",
      linkLabel: "View completed",
      testId: "card-completion-rate",
      onClick: () => setLocation("/tasks?statusFilter=DONE"),
      isProgressCard: true,
      percentage: completionRate,
    },
    {
      label: "High Priority",
      value: highPriorityOpen,
      icon: AlertTriangle,
      iconColor: "text-rose-600",
      iconBg: "bg-rose-50",
      linkLabel: "Show high priority",
      testId: "card-high-priority",
      onClick: () => setLocation("/tasks?priorityFilter=high"),
    },
  ];

  if (isLoadingStats && isLoadingTasks) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-lg text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (tasksError) {
    return (
      <div
        className="flex flex-col items-center justify-center h-[260px] gap-3"
        style={{ backgroundColor: "#f3f3f4" }}
      >
        <div className="w-[52px] h-[52px] bg-red-100 rounded-sm flex items-center justify-center">
          <AlertTriangle className="text-red-600" size={24} />
        </div>
        <p className="font-semibold text-gray-900 m-0">Failed to load tasks</p>
        <p className="text-sm m-0" style={{ color: "#676a6c" }}>
          {tasksError.message}
        </p>
        <Button
          onClick={() => window.location.reload()}
          className="mt-2 h-9 text-sm rounded-sm"
        >
          Reload Page
        </Button>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen font-['Open_Sans','Helvetica_Neue',Helvetica,Arial,sans-serif] [&_*]:box-border"
      style={{ backgroundColor: "#f3f3f4" }}
    >
      <div className="p-4">
        {/* PAGE HEADER - Modern style like Individual Dashboard */}
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
                      {user?.organization?.name || "Organization"}
                    </span>
                  </>
                );
              })()}
            </h2>
            <p className="text-sm mt-2 m-0" style={{ color: "#9a9a9a" }}>
              Dashboard <span className="text-blue-600">Organization Workspace</span>
            </p>
          </div>

          {/* Team Progress Bar - Modern style */}
          {(() => {
            const progressPercentage = completionRate;
            const progressText =
              progressPercentage <= 20
                ? "Organization needs a push 🚀"
                : progressPercentage <= 50
                  ? "Building momentum ✨"
                  : progressPercentage <= 80
                    ? "Organization is crushing it 🔥"
                    : "Outstanding organizational performance 🏆";

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
                      Org progress
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

        {/* ROW 1: 6 KPI cards - Modern styling */}
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
                  {label === "Past Due" ? (
                    <svg viewBox="0 0 110 38" width="100%" height="38" preserveAspectRatio="none">
                      <rect x="2" y="18" width="10" height="16" rx="2" fill="#fda4af" opacity="0.7" />
                      <rect x="17" y="10" width="10" height="24" rx="2" fill="#ef4444" opacity="0.9" />
                      <rect x="32" y="21" width="10" height="13" rx="2" fill="#fda4af" opacity="0.65" />
                      <rect x="47" y="6" width="10" height="28" rx="2" fill="#dc2626" />
                      <rect x="62" y="14" width="10" height="20" rx="2" fill="#fb7185" opacity="0.75" />
                      <rect x="77" y="22" width="10" height="12" rx="2" fill="#fda4af" opacity="0.6" />
                      <rect x="92" y="9" width="10" height="25" rx="2" fill="#ef4444" opacity="0.9" />
                    </svg>
                  ) : label === "Completed Today" ? (
                    <svg viewBox="0 0 110 38" width="100%" height="38" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="grad-completed-org" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d="M0,30 C10,26 20,24 30,19 C40,15 50,17 60,12 C70,8 80,10 90,5 C100,3 105,2 110,1" fill="none" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" />
                      <path d="M0,30 C10,26 20,24 30,19 C40,15 50,17 60,12 C70,8 80,10 90,5 C100,3 105,2 110,1 L110,38 L0,38 Z" fill="url(#grad-completed-org)" />
                    </svg>
                  ) : label === "Before Due Date" ? (
                    <svg viewBox="0 0 110 38" width="100%" height="38" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="grad-progress-org" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d="M0,20 C8,11 16,28 24,18 C32,7 40,24 48,15 C56,8 64,21 72,12 C80,4 88,18 96,10 C102,5 106,8 110,6" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" />
                      <path d="M0,20 C8,11 16,28 24,18 C32,7 40,24 48,15 C56,8 64,21 72,12 C80,4 88,18 96,10 C102,5 106,8 110,6 L110,38 L0,38 Z" fill="url(#grad-progress-org)" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 110 38" width="100%" height="38" preserveAspectRatio="none">
                      <rect x="2" y="20" width="11" height="14" rx="2" fill="#fbbf24" opacity="0.65" />
                      <rect x="17" y="14" width="11" height="20" rx="2" fill="#f59e0b" opacity="0.75" />
                      <rect x="32" y="18" width="11" height="16" rx="2" fill="#fbbf24" opacity="0.7" />
                      <rect x="47" y="8" width="11" height="26" rx="2" fill="#d97706" opacity="0.95" />
                      <rect x="62" y="12" width="11" height="22" rx="2" fill="#f59e0b" opacity="0.78" />
                      <rect x="77" y="4" width="11" height="30" rx="2" fill="#b45309" />
                      <rect x="92" y="10" width="11" height="24" rx="2" fill="#f59e0b" opacity="0.88" />
                    </svg>
                  )}
                </div>
                <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-gray-200 to-transparent opacity-60" />
              </div>
            ),
          )}
        </div>

        {/* ROW 2: 4 New KPI cards - Modern styling */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 mb-3">
          {newKpiCards.map(
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
                    <svg viewBox="0 0 110 38" width="100%" height="38" preserveAspectRatio="none">
                      <rect x="0" y="13" width="110" height="7" rx="3.5" fill="#e0e7ff" />
                      <rect x="0" y="13" width={`${(percentage || 0) * 1.1}`} height="7" rx="3.5" fill="#4f46e5" />
                      <text x="0" y="33" fontSize="8" fill="#6b7280" fontFamily="sans-serif">Org completion</text>
                      <text x="82" y="33" fontSize="8" fill="#4f46e5" fontFamily="sans-serif" fontWeight="700">{percentage || 0}%</text>
                    </svg>
                  ) : label === "Due Today" ? (
                    <svg viewBox="0 0 110 38" width="100%" height="38" preserveAspectRatio="none">
                      {[12, 18, 26, 20, 32, 24, 30].map((h, i) => (
                        <rect
                          key={i}
                          x={i * 15 + 2}
                          y={38 - h}
                          width="10"
                          height={h}
                          rx="3"
                          fill="#fb923c"
                          opacity={dueTodayTasks > i ? 1 : 0.25}
                        />
                      ))}
                    </svg>
                  ) : (
                    <svg viewBox="0 0 110 38" width="100%" height="38" preserveAspectRatio="none">
                      <rect x="2" y="20" width="11" height="14" rx="2" fill="#fbbf24" opacity="0.65" />
                      <rect x="17" y="14" width="11" height="20" rx="2" fill="#f59e0b" opacity="0.75" />
                      <rect x="32" y="18" width="11" height="16" rx="2" fill="#fbbf24" opacity="0.7" />
                      <rect x="47" y="8" width="11" height="26" rx="2" fill="#d97706" opacity="0.95" />
                      <rect x="62" y="12" width="11" height="22" rx="2" fill="#f59e0b" opacity="0.78" />
                      <rect x="77" y="4" width="11" height="30" rx="2" fill="#b45309" />
                      <rect x="92" y="10" width="11" height="24" rx="2" fill="#f59e0b" opacity="0.88" />
                    </svg>
                  )}
                </div>
                <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-gray-200 to-transparent opacity-60" />
              </div>
            ),
          )}
        </div>

        {/* Filters Bar - Modern style */}
        <div className="bg-white border border-gray-200 rounded-sm p-3 mb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-1.5 transition-colors border rounded-sm ${
                  showFilters
                    ? "bg-blue-50 text-blue-600 border-blue-300"
                    : "border-gray-300 hover:bg-gray-100"
                }`}
                style={!showFilters ? { color: "#9a9a9a" } : {}}
              >
                <Filter size={13} />
              </button>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={13}
                />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={taskFilters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  className="w-full h-8 pl-8 pr-3 text-sm border border-gray-300 rounded-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  style={{ color: "#676a6c" }}
                />
              </div>
              {selectedTasks.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <button
                    className="px-2.5 py-1 text-xs font-medium bg-green-600 text-white rounded-sm hover:bg-green-700 transition-colors"
                    onClick={() => handleBulkAction("complete")}
                  >
                    Complete ({selectedTasks.length})
                  </button>
                  <button
                    className="px-2.5 py-1 text-xs font-medium bg-yellow-500 text-white rounded-sm hover:bg-yellow-600 transition-colors"
                    onClick={() => handleBulkAction("postpone")}
                  >
                    Postpone
                  </button>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-8 rounded-sm text-xs"
                onClick={() => setLocation("/organization-hierarchy")}
              >
                <Users size={14} className="mr-1" />
                Hierarchy
              </Button>
              <Button
                variant="outline"
                className="h-8 rounded-sm text-xs"
                onClick={exportDashboardData}
              >
                <Download size={14} className="mr-1" />
                Export
              </Button>
              <Button
                variant="default"
                className="h-8 rounded-sm bg-blue-600 hover:bg-blue-700 text-white text-sm"
                onClick={() => setScheduleOpen(true)}
              >
                <CalendarClock size={14} className="mr-1.5" />
                Schedule
              </Button>
            </div>
          </div>

          {/* Filter dropdowns */}
          {showFilters && (
            <div className="flex flex-wrap gap-2 mt-2">
              <select
                value={taskFilters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                className="h-8 border border-gray-300 rounded-sm px-2 text-xs"
                style={{ color: "#676a6c" }}
              >
                <option value="all">All Status</option>
                {(Array.isArray(taskStatuses) ? taskStatuses : [])
                  .filter((s) => s && s.active)
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  .map((s) => (
                    <option key={s._id || s.code} value={s.code}>
                      {s.label}
                    </option>
                  ))}
              </select>
              <select
                value={taskFilters.priority}
                onChange={(e) => handleFilterChange("priority", e.target.value)}
                className="h-8 border border-gray-300 rounded-sm px-2 text-xs"
                style={{ color: "#676a6c" }}
              >
                <option value="all">All Priority</option>
                {(Array.isArray(taskPriorities) ? taskPriorities : [])
                  .filter((p) => p && p.active)
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  .map((p) => (
                    <option key={p._id || p.code} value={p.code}>
                      {p.label}
                    </option>
                  ))}
              </select>
              <select
                value={taskFilters.dueDate}
                onChange={(e) => handleFilterChange("dueDate", e.target.value)}
                className="h-8 border border-gray-300 rounded-sm px-2 text-xs"
                style={{ color: "#676a6c" }}
              >
                <option value="all">All Dates</option>
                <option value="today">Due Today</option>
                <option value="overdue">Overdue</option>
                <option value="upcoming">Upcoming</option>
              </select>
            </div>
          )}
        </div>

        {/* MAIN GRID: Task Grid + Calendar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
          {/* Task Grid - left 2/3 - Modern table style */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-gray-200 shadow-sm rounded-sm">
              <div
                className="py-2.5 px-4 border-b border-gray-200 rounded-sm"
                style={{ backgroundColor: "#f9f9f9" }}
              >
                <h5
                  className="text-xs font-semibold uppercase tracking-wider m-0 flex items-center gap-1.5"
                  style={{ color: "#676a6c" }}
                >
                  <ListChecks size={12} className="text-blue-600" />
                  Organization Task Grid
                  <span className="ml-1 text-[10px] font-normal normal-case text-gray-400">
                    (showing {visibleTasks.length} of {filteredTasks.length})
                  </span>
                </h5>
              </div>

              <TooltipProvider>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead style={{ backgroundColor: "#f9f9f9" }}>
                      <tr>
                        <th className="py-2 px-3 w-8">
                          <input type="checkbox" className="rounded" />
                        </th>
                        {[
                          "Task",
                          "Assignee",
                          "Due Date",
                          "Priority",
                          "Status",
                          "Progress",
                        ].map((h) => (
                          <th
                            key={h}
                            className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wide"
                            style={{ color: "#676a6c" }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredTasks.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="px-4 py-8 text-center text-sm" style={{ color: "#9a9a9a" }}>
                            No tasks found.{" "}
                            <button
                              className="text-blue-600 hover:underline"
                              onClick={() => {
                                setShowAllTasks(false);
                                setTaskFilters({
                                  search: "",
                                  status: "all",
                                  priority: "all",
                                  dueDate: "all",
                                });
                              }}
                            >
                              Reset filters
                            </button>
                          </td>
                        </tr>
                      ) : (
                        visibleTasks.map((task) => (
                          <tr
                            key={task.id}
                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => handleTaskClick(task.id)}
                          >
                            <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                              <input type="checkbox" className="rounded" />
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-1.5">
                                {getTaskTypeIcon(task, 13)}
                                {task.isPastDue && (
                                  <span title="Past Due" className="text-red-500 text-xs">⚠️</span>
                                )}
                                {task.isDueToday && (
                                  <span title="Due Today" className="text-orange-500 text-xs">📅</span>
                                )}
                                <span
                                  className="text-sm font-medium truncate max-w-[200px] block"
                                  style={{ color: "#676a6c" }}
                                  title={task.title}
                                >
                                  {task.title}
                                </span>
                              </div>
                              {task.hasSubtasks && (
                                <span className="text-[9px] text-gray-400 mt-0.5 block">
                                  📋 Has subtasks
                                </span>
                              )}
                              {task.tags?.length > 0 && (
                                <div className="flex gap-1 mt-0.5">
                                  {task.tags.slice(0, 2).map((tag) => (
                                    <span
                                      key={tag}
                                      className="text-xs bg-gray-100 py-px px-1.5 rounded-sm"
                                      style={{ color: "#9a9a9a" }}
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td
                              className="py-2 px-3 text-xs whitespace-nowrap"
                              style={{ color: "#9a9a9a" }}
                            >
                              {task.assignee}
                            </td>
                            <td
                              className="py-2 px-3 text-xs whitespace-nowrap"
                              style={{ color: "#9a9a9a" }}
                            >
                              {task.dueDate}
                            </td>
                            <td className="py-2 px-3">
                              {getPriorityBadge(task.priority)}
                            </td>
                            <td className="py-2 px-3">
                              {getStatusBadge(task.status)}
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-2">
                                <div className="w-[45px] bg-gray-200 rounded-sm h-1.5 overflow-hidden">
                                  <div
                                    className={`h-1.5 rounded-sm transition-all duration-500 ${
                                      (task.progress || 0) >= 80
                                        ? "bg-green-500"
                                        : (task.progress || 0) >= 40
                                          ? "bg-blue-500"
                                          : (task.progress || 0) > 0
                                            ? "bg-yellow-500"
                                            : "bg-gray-300"
                                    }`}
                                    style={{
                                      width: `${Math.max(task.progress || 0, 4)}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-xs font-medium text-gray-600 min-w-[32px]">
                                  {task.progress || 0}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </TooltipProvider>

              {/* Show more/show less footer */}
              {filteredTasks.length > TASK_DISPLAY_LIMIT && (
                <div
                  className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between rounded-b-md"
                  style={{ backgroundColor: "#f9f9f9" }}
                >
                  <span className="text-[11px]" style={{ color: "#9a9a9a" }}>
                    {showAllTasks
                      ? `Showing all ${filteredTasks.length} tasks`
                      : `Showing ${TASK_DISPLAY_LIMIT} of ${filteredTasks.length} tasks`}
                  </span>
                  <button
                    className="text-[11px] font-medium text-blue-600 hover:underline"
                    onClick={() => setShowAllTasks((prev) => !prev)}
                  >
                    {showAllTasks ? "Show less" : `Show ${hiddenCount} more`}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Calendar - right 1/3 - Modern style */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-gray-200 shadow-sm rounded-sm sticky top-4">
              <div
                className="py-2.5 px-4 border-b border-gray-200 rounded-sm"
                style={{ backgroundColor: "#f9f9f9" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h5
                    className="text-xs font-semibold uppercase tracking-wider m-0 flex items-center gap-1.5"
                    style={{ color: "#676a6c" }}
                  >
                    <Calendar size={12} className="text-blue-600" /> Calendar
                  </h5>
                  <div className="flex items-center gap-1">
                    <button
                      className="p-1 rounded hover:bg-gray-100 transition-colors"
                      onClick={() => handleDateChange("prev")}
                    >
                      <ChevronLeft size={14} style={{ color: "#676a6c" }} />
                    </button>
                    <button
                      className="p-1 rounded hover:bg-gray-100 transition-colors"
                      onClick={() => handleDateChange("next")}
                    >
                      <ChevronRight size={14} style={{ color: "#676a6c" }} />
                    </button>
                  </div>
                </div>
                <div className="flex gap-1">
                  {["month", "week", "day"].map((view) => (
                    <button
                      key={view}
                      className={`py-0.5 px-2.5 text-xs font-medium transition-colors border rounded-sm ${
                        calendarView === view
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white border-gray-300 hover:bg-gray-50"
                      }`}
                      style={calendarView !== view ? { color: "#676a6c" } : {}}
                      onClick={() => setCalendarView(view)}
                    >
                      {view.charAt(0).toUpperCase() + view.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3">
                <p
                  className="text-xs font-medium mb-3"
                  style={{ color: "#676a6c" }}
                >
                  {calendarView === "month" &&
                    currentDate.toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  {calendarView === "week" &&
                    (() => {
                      const ws = new Date(currentDate);
                      ws.setDate(ws.getDate() - ws.getDay());
                      const we = new Date(ws);
                      we.setDate(we.getDate() + 6);
                      return (
                        ws.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        }) +
                        " - " +
                        we.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      );
                    })()}
                  {calendarView === "day" &&
                    currentDate.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                </p>

                {/* Month View */}
                {calendarView === "month" && (
                  <div className="grid grid-cols-7 gap-0.5">
                    {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                      <div
                        key={i}
                        className="text-center text-[10px] font-semibold py-1"
                        style={{ color: "#9a9a9a" }}
                      >
                        {d}
                      </div>
                    ))}
                    {(() => {
                      const firstDay = new Date(
                        currentDate.getFullYear(),
                        currentDate.getMonth(),
                        1,
                      ).getDay();
                      const daysInMonth = new Date(
                        currentDate.getFullYear(),
                        currentDate.getMonth() + 1,
                        0,
                      ).getDate();
                      const totalCells =
                        Math.ceil((firstDay + daysInMonth) / 7) * 7;
                      return Array.from({ length: totalCells }, (_, i) => {
                        const dayNum = i - firstDay + 1;
                        const isCurrentMonth =
                          dayNum > 0 && dayNum <= daysInMonth;
                        const isToday =
                          isCurrentMonth &&
                          dayNum === new Date().getDate() &&
                          currentDate.getMonth() === new Date().getMonth() &&
                          currentDate.getFullYear() ===
                            new Date().getFullYear();
                        const dateStr = isCurrentMonth
                          ? `${currentDate.getFullYear()}-${String(
                              currentDate.getMonth() + 1,
                            ).padStart(
                              2,
                              "0",
                            )}-${String(dayNum).padStart(2, "0")}`
                          : null;
                        const dayTasks = dateStr
                          ? calendarTasks.filter((t) => t.date === dateStr)
                          : [];
                        return (
                          <div
                            key={i}
                            onClick={() =>
                              isCurrentMonth && handleCalendarDateClick()
                            }
                            className={`aspect-square flex flex-col items-center justify-center text-[10px] rounded cursor-pointer relative ${
                              !isCurrentMonth
                                ? "text-gray-300"
                                : "hover:bg-blue-50"
                            } ${
                              isToday
                                ? "bg-blue-600 text-white font-bold hover:bg-blue-700"
                                : ""
                            }`}
                            style={
                              isCurrentMonth && !isToday
                                ? { color: "#676a6c" }
                                : {}
                            }
                          >
                            {isCurrentMonth ? dayNum : ""}
                            {dayTasks.length > 0 && (
                              <span
                                className={`absolute bottom-0.5 w-1 h-1 rounded-sm ${
                                  isToday ? "bg-white" : "bg-blue-500"
                                }`}
                              />
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}

                {/* Week View */}
                {calendarView === "week" &&
                  (() => {
                    const weekStart = new Date(currentDate);
                    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                    weekStart.setHours(0, 0, 0, 0);
                    const weekDays = Array.from({ length: 7 }, (_, i) => {
                      const d = new Date(weekStart);
                      d.setDate(d.getDate() + i);
                      return d;
                    });
                    return (
                      <div className="space-y-1">
                        {weekDays.map((day, i) => {
                          const dateStr = day.toISOString().split("T")[0];
                          const dayTasks = calendarTasks.filter(
                            (t) => t.date === dateStr,
                          );
                          const isToday =
                            day.toDateString() === new Date().toDateString();
                          return (
                            <div
                              key={i}
                              className={`p-2 rounded border cursor-pointer ${
                                isToday
                                  ? "bg-blue-50 border-blue-300"
                                  : "bg-white border-gray-200 hover:bg-gray-50"
                              }`}
                              onClick={() => handleCalendarDateClick()}
                            >
                              <div className="flex items-center justify-between">
                                <span
                                  className={`text-[10px] font-semibold ${
                                    isToday ? "text-blue-700" : ""
                                  }`}
                                  style={!isToday ? { color: "#676a6c" } : {}}
                                >
                                  {day.toLocaleDateString("en-US", {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                                {dayTasks.length > 0 && (
                                  <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-sm">
                                    {dayTasks.length}
                                  </span>
                                )}
                              </div>
                              {dayTasks.slice(0, 2).map((task) => (
                                <p
                                  key={task.id}
                                  className="text-[10px] truncate mt-0.5 pl-2 border-l-2 border-blue-400"
                                  style={{ color: "#9a9a9a" }}
                                  title={task.title}
                                >
                                  {task.title}
                                </p>
                              ))}
                              {dayTasks.length > 2 && (
                                <p
                                  className="text-[9px] pl-2"
                                  style={{ color: "#9a9a9a" }}
                                >
                                  +{dayTasks.length - 2} more
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                {/* Day View */}
                {calendarView === "day" &&
                  (() => {
                    const dateStr = currentDate.toISOString().split("T")[0];
                    const dayTasks = calendarTasks.filter(
                      (t) => t.date === dateStr,
                    );
                    return (
                      <div className="space-y-1.5">
                        {dayTasks.length === 0 ? (
                          <div className="text-center py-5">
                            <Calendar
                              className="mx-auto mb-3"
                              size={28}
                              style={{ color: "#9a9a9a" }}
                            />
                            <p className="text-xs" style={{ color: "#9a9a9a" }}>
                              No tasks on this day
                            </p>
                          </div>
                        ) : (
                          dayTasks.map((task) => (
                            <div
                              key={task.id}
                              className="p-2 bg-white border border-gray-200 rounded hover:border-blue-300 cursor-pointer"
                            >
                              <p
                                className="text-xs font-medium truncate"
                                style={{ color: "#676a6c" }}
                                title={task.title}
                              >
                                {task.title}
                              </p>
                              <div className="flex items-center gap-3 mt-1">
                                <span
                                  className={`text-[9px] px-1.5 py-0.5 rounded border ${
                                    task.status === "DONE"
                                      ? "bg-green-50 text-green-700 border-green-200"
                                      : task.status === "INPROGRESS"
                                        ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                        : "bg-blue-50 text-blue-700 border-blue-200"
                                  }`}
                                >
                                  {task.status || "OPEN"}
                                </span>
                                <span
                                  className="text-[9px]"
                                  style={{ color: "#9a9a9a" }}
                                >
                                  {task.date}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })()}

                {/* Tasks this period */}
                <div className="mt-2 space-y-1.5">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: "#9a9a9a" }}
                  >
                    Tasks This {calendarView} ({calendarTasks.length})
                  </p>
                  {calendarTasks.length === 0 && (
                    <p
                      className="text-[10px] text-center py-2"
                      style={{ color: "#9a9a9a" }}
                    >
                      No tasks found
                    </p>
                  )}
                  {calendarTasks.slice(0, 8).map((task) => (
                    <div
                      key={task.id}
                      className="p-2 bg-blue-50 border border-blue-200 rounded text-[10px] cursor-pointer hover:bg-blue-100"
                    >
                      <p
                        className="font-medium truncate"
                        style={{ color: "#676a6c" }}
                        title={task.title}
                      >
                        {task.title}
                      </p>
                      <p style={{ color: "#9a9a9a" }}>{task.date}</p>
                    </div>
                  ))}
                  {calendarTasks.length > 8 && (
                    <p
                      className="text-[9px] text-center"
                      style={{ color: "#9a9a9a" }}
                    >
                      +{calendarTasks.length - 8} more
                    </p>
                  )}
                  <button
                    className="w-full mt-2 h-7 flex items-center justify-center gap-1.5 text-xs font-medium text-blue-600 border border-blue-600 rounded hover:bg-blue-50 transition-colors"
                    onClick={() => handleCalendarDateClick()}
                  >
                    <Plus size={12} /> Create Task
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM METRICS ROW - Modern cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* On-Time Completion */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-sm overflow-hidden">
            <div
              className="py-2.5 px-4 border-b border-gray-200"
              style={{ backgroundColor: "#f9f9f9" }}
            >
              <h5
                className="text-xs font-semibold uppercase tracking-wider m-0 flex items-center gap-1.5"
                style={{ color: "#676a6c" }}
              >
                <Target size={12} className="text-green-600" /> On-Time
                Completion
              </h5>
            </div>
            <div className="p-4">
              <div className="flex items-end gap-3 mb-3">
                <p className="text-3xl font-bold m-0" style={{ color: "#1f2937" }}>
                  {orgOnTimeRate}%
                </p>
                <p className="text-xs mb-1" style={{ color: "#9a9a9a" }}>
                  completion rate
                </p>
              </div>
              <div className="w-full bg-gray-100 rounded-sm h-2 mb-3">
                <div
                  className="bg-green-500 h-2 rounded-sm transition-all duration-500"
                  style={{ width: `${orgOnTimeRate}%` }}
                />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-green-600">On-time: {orgCompletion.onTime}</span>
                <span className="text-red-500">Overdue closed: {orgCompletion.overdueClosed}</span>
              </div>
            </div>
          </div>

          {/* Module Usage */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-sm overflow-hidden">
            <div
              className="py-2.5 px-4 border-b border-gray-200"
              style={{ backgroundColor: "#f9f9f9" }}
            >
              <h5
                className="text-xs font-semibold uppercase tracking-wider m-0 flex items-center gap-1.5"
                style={{ color: "#676a6c" }}
              >
                <BarChart3 size={12} className="text-blue-600" /> Module Usage
              </h5>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span style={{ color: "#676a6c" }}>Quick Tasks</span>
                  <span className="font-semibold" style={{ color: "#1f2937" }}>
                    {moduleUsage.quick}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-sm h-2">
                  <div
                    className="h-2 rounded-sm bg-emerald-500 transition-all duration-500"
                    style={{ width: `${quickPct}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span style={{ color: "#676a6c" }}>Full Tasks</span>
                  <span className="font-semibold" style={{ color: "#1f2937" }}>
                    {moduleUsage.full}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-sm h-2">
                  <div
                    className="h-2 rounded-sm bg-blue-500 transition-all duration-500"
                    style={{ width: `${fullPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* System Health */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-sm overflow-hidden">
            <div
              className="py-2.5 px-4 border-b border-gray-200"
              style={{ backgroundColor: "#f9f9f9" }}
            >
              <h5
                className="text-xs font-semibold uppercase tracking-wider m-0 flex items-center gap-1.5"
                style={{ color: "#676a6c" }}
              >
                <Activity size={12} className="text-green-500" /> System Health
              </h5>
            </div>
            <div className="p-4">
              <div className="text-center py-2">
                <div className="w-12 h-12 bg-green-100 rounded-sm flex items-center justify-center mx-auto mb-3">
                  <CheckSquare size={20} className="text-green-600" />
                </div>
                <p className="text-sm text-green-700 font-medium">
                  All systems operational
                </p>
                <p className="text-xs mt-1" style={{ color: "#9a9a9a" }}>
                  Everything is running smoothly
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SCHEDULE MODAL */}
      {scheduleOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-sm p-5 w-full max-w-md shadow-xl border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold" style={{ color: "#676a6c" }}>
                Schedule Report
              </h3>
              <button
                onClick={() => setScheduleOpen(false)}
                className="p-1 rounded hover:bg-gray-100"
              >
                <X size={16} style={{ color: "#9a9a9a" }} />
              </button>
            </div>
            <form onSubmit={handleScheduleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#676a6c" }}>
                  Frequency
                </label>
                <select
                  value={scheduleForm.frequency}
                  onChange={(e) =>
                    setScheduleForm({
                      ...scheduleForm,
                      frequency: e.target.value,
                    })
                  }
                  className="w-full h-9 border border-gray-300 rounded-sm px-3 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  style={{ color: "#676a6c" }}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#676a6c" }}>
                  Email
                </label>
                <input
                  type="email"
                  value={scheduleForm.email}
                  onChange={(e) =>
                    setScheduleForm({ ...scheduleForm, email: e.target.value })
                  }
                  className="w-full h-9 border border-gray-300 rounded-sm px-3 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="your@email.com"
                  style={{ color: "#676a6c" }}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 h-9 bg-blue-600 text-white text-sm font-medium rounded-sm hover:bg-blue-700 transition-colors"
                >
                  Save
                </button>
                <button
                  type="button"
                  className="flex-1 h-9 border border-gray-300 text-sm font-medium rounded-sm hover:bg-gray-50 transition-colors"
                  style={{ color: "#676a6c" }}
                  onClick={() => setScheduleOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizationDashboard;