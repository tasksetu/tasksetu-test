import React, { useState, useMemo, useRef } from "react";
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
  RefreshCw,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/features/shared/hooks/useAuth";
import {
  RegularTaskIcon,
  RecurringTaskIcon,
  QuickTaskIcon,
  MilestoneTaskIcon,
  ApprovalTaskIcon,
} from "../components/common/TaskIcons";
import TaskOverviewChart from "./components/TaskOverviewChart";
import TaskStatusDonut from "./components/TaskStatusDonut";
import KpiSparkline from "./components/KpiSparkline";
import OrganizationHierarchySection from "./components/OrganizationHierarchySection";
import { useAggregatedDashboard } from "./hooks/useAggregatedDashboard";
import { getTaskType, checkTaskMatchesDueDateFilter } from "../utils/taskHelpers";
import { useProcessInstances } from "@/hooks/useProcessBuilder";
import { useLicense } from "@/hooks/useLicense";

const TASK_DISPLAY_LIMIT = 15;

const OrganizationDashboard = () => {
  const [location, setLocation] = useLocation();
  const { activeRole } = useActiveRole();
  const { showSuccessToast } = useShowToast();
  const { data: processInstances = [] } = useProcessInstances();
  const { license: licenseInfo } = useLicense();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    frequency: "weekly",
    day: "Monday",
    time: "09:00",
    email: "",
  });

  const handleScheduleSave = (e) => {
    e?.preventDefault?.();
    showSuccessToast(`Report scheduled (${scheduleForm.frequency}) to ${scheduleForm.email || user?.email || "team"}`);
    setScheduleOpen(false);
  };
  const hierarchyRef = useRef(null);
  const scrollToHierarchy = () => {
    hierarchyRef.current?.scrollIntoView({ behavior: "smooth" });
  };
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
  const [activeTaskTab, setActiveTaskTab] = useState("today"); // "today" (Created Today) | "all" | "due_today" | "overdue"
  const { data: taskStatuses = [] } = useTaskStatuses();
  const { data: taskPriorities = [] } = useTaskPriorities();
  const { user } = useAuth();

  // Fetch consolidated dashboard data in 1 request
  const {
    dashboardData,
    kpis,
    charts,
    taskList: aggregatedTasks,
    calendarEvents: aggregatedCalendarEvents,
    teamMembers: aggregatedTeamMembers,
    moduleUsage: aggregatedModuleUsage,
    systemHealth: aggregatedSystemHealth,
    isLoading: isLoadingAggregated,
    error: aggregatedError,
    invalidateDashboard,
  } = useAggregatedDashboard({
    activeRole: "org_admin",
    timeRange: "7d",
    filters: taskFilters,
  });

  const isLoadingStats = isLoadingAggregated;
  const isLoadingTasks = isLoadingAggregated;
  const tasksError = aggregatedError;

  const pct = (a, b) => (b === 0 ? 0 : Math.round((a / b) * 100));

  const extractVal = (val, fallback = 0) => {
    if (val === null || val === undefined) return fallback;
    if (React.isValidElement(val)) return val;
    if (typeof val === "object") {
      const v = val.value !== undefined ? val.value : fallback;
      if (typeof v === "object" && v !== null && !React.isValidElement(v)) {
        return extractVal(v, fallback);
      }
      return v;
    }
    return val;
  };

  const allTasks = useMemo(() => {
    return aggregatedTasks || [];
  }, [aggregatedTasks]);

  const getDisplayNow = () => {
    const now = new Date();
    return new Date(
      Date.UTC(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        now.getMinutes(),
        now.getSeconds()
      )
    );
  };

  const isTaskOverdue = (task) => {
    if (!task?.dueDate || task.dueDate === "No due date") return false;
    const s = (task.status || "").toUpperCase();
    if (["DONE", "COMPLETED", "CANCELLED"].includes(s)) return false;
    const d = new Date(task.dueDate);
    if (isNaN(d.getTime())) return false;
    const displayNow = getDisplayNow();
    const now = new Date();
    return d < displayNow || d < now;
  };

  const calculatedOverdueCount = useMemo(() => {
    return allTasks.filter((t) => t.isPastDue || isTaskOverdue(t)).length;
  }, [allTasks]);

  const currentStats = {
    completedTasks: extractVal(kpis?.completedToday),
    beforeDueDate: extractVal(kpis?.beforeDueDate),
    milestoneCount: extractVal(kpis?.milestonesCount),
    collaboratorCount: extractVal(kpis?.collaboratorCount),
    overdueTasks: Math.max(
      calculatedOverdueCount,
      extractVal(kpis?.pastDueDate ?? kpis?.overdueTasks, 0),
    ),
    approvalCount: extractVal(kpis?.approvalCount),
    teamActivity: extractVal(kpis?.completionRate),
  };

  const taskGridData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return allTasks.map((task) => {
      const dueDate = task.dueDate ? new Date(task.dueDate) : null;
      const resolvedAssignee =
        task.assignee ||
        task.assigneeName ||
        (task.assignedTo && typeof task.assignedTo === "object"
          ? (task.assignedTo.firstName
              ? `${task.assignedTo.firstName} ${task.assignedTo.lastName || ""}`.trim()
              : task.assignedTo.name || task.assignedTo.username || task.assignedTo.email)
          : (typeof task.assignedTo === "string" ? task.assignedTo : null)) ||
        "Unassigned";

      return {
        id: task._id || task.id,
        title: task.title,
        assignee: resolvedAssignee,
        assignedTo: task.assignedTo || {
          firstName: resolvedAssignee,
          name: resolvedAssignee,
        },
        dueDate: dueDate ? dueDate.toISOString().split("T")[0] : "No due date",
        createdAt: task.createdAt,
        completedDate: task.completedDate,
        completedAt: task.completedAt || task.completedDate,
        status: task.status,
        priority: task.priority || "medium",
        hasSubtasks: task.subtasks && task.subtasks.length > 0,
        isPastDue: task.isPastDue !== undefined ? task.isPastDue : isTaskOverdue(task),
        isDueToday: task.isDueToday !== undefined ? task.isDueToday : Boolean(
          dueDate && (
            dueDate.toDateString() === today.toDateString() ||
            (task.dueDate && String(task.dueDate).startsWith(new Date().toISOString().split("T")[0]))
          )
        ),
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
    if (aggregatedCalendarEvents && aggregatedCalendarEvents.length > 0) {
      return aggregatedCalendarEvents;
    }
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
  }, [allTasks, currentDate, calendarView, aggregatedCalendarEvents]);

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

  const orgOnTimeRate = extractVal(
    kpis?.onTimeRate,
    pct(orgCompletion.onTime, orgCompletion.onTime + orgCompletion.overdueClosed)
  );

  const openTasks = extractVal(
    kpis?.openTasks,
    allTasks.filter((t) => {
      const s = (t.status || "").toUpperCase();
      return ["OPEN", "PENDING", "TODO"].includes(s);
    }).length
  );

  const dueTodayTasks = extractVal(
    kpis?.dueToday,
    allTasks.filter((t) => {
      const d = t.dueDate ? new Date(t.dueDate) : null;
      const today = new Date();
      return (
        d && d.toDateString() === today.toDateString() && t.status !== "DONE"
      );
    }).length
  );

  const totalCompletedCount = extractVal(
    kpis?.completedTasks,
    allTasks.filter((t) => t.status === "DONE").length
  );
  const completionRate = extractVal(
    kpis?.completionRate,
    pct(totalCompletedCount, allTasks.length)
  );

  const highPriorityOpen = extractVal(
    kpis?.highPriority,
    allTasks.filter(
      (t) =>
        (t.priority === "high" ||
          t.priority === "urgent" ||
          t.priority === "critical") &&
        t.status !== "DONE",
    ).length
  );

  const taskStatusBreakdown = useMemo(() => {
    let completed = 0;
    let inProgress = 0;
    let open = 0;
    let overdue = 0;

    allTasks.forEach((t) => {
      const s = (t.status || "").toUpperCase();
      const isDone = ["COMPLETED", "DONE"].includes(s);
      const isCancelled = ["CANCELLED", "CANCELED"].includes(s);
      const isInProg = ["IN_PROGRESS", "INPROGRESS", "DOING"].includes(s);
      const isPastDue = t.isPastDue || isTaskOverdue(t);

      if (isDone) {
        completed++;
      } else if (isInProg) {
        inProgress++;
      } else if (!isCancelled) {
        open++;
      }

      if (isPastDue) {
        overdue++;
      }
    });

    const serverOverdue = extractVal(kpis?.pastDueDate ?? kpis?.overdueTasks, 0);
    const finalOverdue = Math.max(overdue, serverOverdue);

    const totalCalculated = allTasks.length;
    const serverTotal = extractVal(kpis?.totalTasks, 0);
    const finalTotal = totalCalculated > 0 ? totalCalculated : serverTotal;

    const serverOpen = extractVal(kpis?.openTasks, 0);
    const finalOpen = totalCalculated > 0 ? open : serverOpen;

    const serverInProgress = extractVal(kpis?.inProgressTasks, 0);
    const finalInProgress = totalCalculated > 0 ? inProgress : serverInProgress;

    const serverCompleted = extractVal(kpis?.completedTasks, 0);
    const finalCompleted = totalCalculated > 0 ? completed : serverCompleted;

    return {
      open: finalOpen,
      inProgress: finalInProgress,
      completed: finalCompleted,
      overdue: finalOverdue,
      total: finalTotal,
    };
  }, [allTasks, kpis]);

  const moduleUsage = useMemo(() => {
    const quick = aggregatedModuleUsage?.quickTasks || 0;
    const full = Math.max(0, (aggregatedModuleUsage?.fullTasks || 0) - quick);
    return { quick, full };
  }, [aggregatedModuleUsage]);

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

  const isCreatedToday = (task) => {
    if (!task?.createdAt) return false;
    const created = new Date(task.createdAt);
    if (isNaN(created.getTime())) return false;
    const now = new Date();

    const isSameDay =
      created.getFullYear() === now.getFullYear() &&
      created.getMonth() === now.getMonth() &&
      created.getDate() === now.getDate();

    const localNowIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const taskCreatedAtStr = String(task.createdAt);
    const isSameIso =
      taskCreatedAtStr.startsWith(localNowIso) ||
      taskCreatedAtStr.startsWith(now.toISOString().split("T")[0]);

    return isSameDay || isSameIso;
  };

  const todayCreatedCount = useMemo(() => {
    return taskGridData.filter((t) => isCreatedToday(t)).length;
  }, [taskGridData]);

  const dueTodayCount = useMemo(() => {
    return taskGridData.filter((t) => t.isDueToday).length;
  }, [taskGridData]);

  const overdueTasksCount = useMemo(() => {
    return taskGridData.filter((t) => t.isPastDue || isTaskOverdue(t)).length;
  }, [taskGridData]);

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

      // Filter by active tab (Created Today by default)
      if (activeTaskTab === "today") {
        if (!isCreatedToday(task)) return false;
      } else if (activeTaskTab === "due_today") {
        if (!task.isDueToday) return false;
      } else if (activeTaskTab === "overdue") {
        if (!task.isPastDue && !isTaskOverdue(task)) return false;
      }

      // Filter by dropdown dueDate when viewing "all"
      if (activeTaskTab === "all" && taskFilters.dueDate !== "all") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const taskDueDate =
          task.dueDate !== "No due date" ? new Date(task.dueDate) : null;
        if (taskFilters.dueDate === "created_today") {
          if (!isCreatedToday(task)) return false;
        } else if (taskFilters.dueDate === "today") {
          if (!task.isDueToday) return false;
        } else if (taskFilters.dueDate === "overdue") {
          if (!task.isPastDue && !isTaskOverdue(task)) return false;
        } else if (taskFilters.dueDate === "upcoming") {
          const nextWeek = new Date(today);
          nextWeek.setDate(nextWeek.getDate() + 7);
          if (!taskDueDate || taskDueDate < today || taskDueDate > nextWeek)
            return false;
        }
      }
      return true;
    });
  }, [taskGridData, taskFilters, activeTaskTab]);

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

  // Helper to compute 7-day trend arrays for dynamic KPI sparklines
  const kpiTrends = useMemo(() => {
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      return d;
    });

    const isSameDate = (d1, d2) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    // 1. Regular Tasks
    const regularTrend = days.map(
      (day) =>
        allTasks.filter((t) => {
          if (getTaskType(t) !== "Regular Task") return false;
          const cr = t.createdAt ? new Date(t.createdAt) : null;
          return cr ? cr <= day : true;
        }).length,
    );

    // 2. Milestone Tasks
    const milestonesTrend = days.map(
      (day) =>
        allTasks.filter((t) => {
          if (getTaskType(t) !== "Milestone Task") return false;
          const cr = t.createdAt ? new Date(t.createdAt) : null;
          return cr ? cr <= day : true;
        }).length,
    );

    // 3. Recurring Tasks
    const recurringTrend = days.map(
      (day) =>
        allTasks.filter((t) => {
          if (getTaskType(t) !== "Recurring Task") return false;
          const cr = t.createdAt ? new Date(t.createdAt) : null;
          return cr ? cr <= day : true;
        }).length,
    );

    // 4. Approval Tasks
    const approvalsTrend = days.map(
      (day) =>
        allTasks.filter((t) => {
          if (getTaskType(t) !== "Approval Task") return false;
          const cr = t.createdAt ? new Date(t.createdAt) : null;
          return cr ? cr <= day : true;
        }).length,
    );

    // 5. In Progress Tasks
    const inProgressTrend = days.map(
      (day) =>
        allTasks.filter((t) => {
          const s = (t.status || "").toUpperCase();
          if (!["INPROGRESS", "IN_PROGRESS", "DOING"].includes(s)) return false;
          const cr = t.createdAt ? new Date(t.createdAt) : null;
          return cr ? cr <= day : true;
        }).length,
    );

    // 6. Due Today / due dates across 7 days
    const dueTodayTrend = days.map(
      (day) =>
        allTasks.filter((t) => {
          if (!t.dueDate) return false;
          return isSameDate(new Date(t.dueDate), day);
        }).length,
    );

    // 7. High Priority
    const highPriorityTrend = days.map(
      (day) =>
        allTasks.filter((t) => {
          const p = (t.priority || "").toLowerCase();
          const isHigh = p === "high" || p === "urgent" || p === "critical";
          if (!isHigh) return false;
          const cr = t.createdAt ? new Date(t.createdAt) : null;
          return cr ? cr <= day : true;
        }).length,
    );

    // 8. Completed Today / completed over last 7 days
    const completedTrend = days.map(
      (day) =>
        allTasks.filter((t) => {
          const cd = t.completedDate || t.completedAt;
          return cd && isSameDate(new Date(cd), day);
        }).length,
    );

    // 9. Cancelled Tasks
    const cancelledTrend = days.map(
      (day) =>
        allTasks.filter((t) => {
          const s = (t.status || "").toUpperCase();
          if (!["CANCELLED", "CANCELED"].includes(s)) return false;
          const cr = t.createdAt ? new Date(t.createdAt) : null;
          return cr ? cr <= day : true;
        }).length,
    );

    // 10 & 11. Process Builder Instances & Launches
    const pbTrend = days.map(
      (day) =>
        allTasks.filter((t) => {
          const isPB =
            t.isProcessBuilderTask === true ||
            t.source === "process-builder" ||
            Boolean(t.processTemplateId);
          if (!isPB) return false;
          const cr = t.createdAt ? new Date(t.createdAt) : null;
          return cr ? cr <= day : true;
        }).length,
    );

    // 12. Total Tasks
    const totalTrend = days.map(
      (day) =>
        allTasks.filter((t) => {
          const cr = t.createdAt ? new Date(t.createdAt) : null;
          return cr ? cr <= day : true;
        }).length,
    );

    return {
      regular: regularTrend,
      milestones: milestonesTrend,
      recurring: recurringTrend,
      approvals: approvalsTrend,
      inProgress: inProgressTrend,
      due: dueTodayTrend,
      highPriority: highPriorityTrend,
      completed: completedTrend,
      cancelled: cancelledTrend,
      processInstances: pbTrend,
      total: totalTrend,
    };
  }, [allTasks]);

  // Counts calculated directly for the 12 requested metric cards
  const taskCounts = useMemo(() => {
    let regular = 0;
    let milestone = 0;
    let recurring = 0;
    let approval = 0;
    let inProgress = 0;
    let cancelled = 0;
    let highPriority = 0;
    let dueToday = 0;
    let completedToday = 0;

    const today = new Date();
    const isSameDate = (d1, d2) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    allTasks.forEach((t) => {
      const type = getTaskType(t);
      if (type === "Regular Task") regular++;
      else if (type === "Milestone Task") milestone++;
      else if (type === "Recurring Task") recurring++;
      else if (type === "Approval Task") approval++;

      const s = (t.status || "").toUpperCase();
      if (["INPROGRESS", "IN_PROGRESS", "DOING"].includes(s)) {
        inProgress++;
      } else if (["CANCELLED", "CANCELED"].includes(s)) {
        cancelled++;
      }

      const p = (t.priority || "").toLowerCase();
      if (p === "high" || p === "urgent" || p === "critical") {
        highPriority++;
      }

      if (checkTaskMatchesDueDateFilter(t, "due_today")) {
        dueToday++;
      }

      if (["DONE", "COMPLETED"].includes(s)) {
        const cd = t.completedDate || t.completedAt;
        if (cd && isSameDate(new Date(cd), today)) {
          completedToday++;
        }
      }
    });

    const pbTasks = allTasks.filter(
      (t) =>
        t.isProcessBuilderTask === true ||
        t.source === "process-builder" ||
        Boolean(t.processTemplateId)
    );
    const pbInstancesCount =
      Array.isArray(processInstances) && processInstances.length > 0
        ? processInstances.length
        : pbTasks.length;

    const pbLaunchCount =
      licenseInfo?.usage?.PROC_LAUNCH?.used ??
      (pbInstancesCount > 0 ? pbInstancesCount : 0);

    return {
      regular,
      milestone,
      recurring,
      approval,
      inProgress,
      cancelled,
      highPriority,
      dueToday,
      total: allTasks.length,
      completedToday,
      processInstances: pbInstancesCount,
      processLaunches: pbLaunchCount,
    };
  }, [allTasks, processInstances, licenseInfo]);

  // KPI Cards - 12 cards displayed in 3 rows of 4
  const kpiCards = [
    // Row 1: 4 Core Task Types
    {
      label: "Regular Tasks",
      value: taskCounts.regular,
      linkLabel: "Show regular tasks",
      icon: CheckSquare,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50",
      testId: "card-regular-tasks",
      onClick: () => setLocation("/tasks?taskTypeFilter=Regular+Task"),
      sparklineType: "line",
      sparklineColor: "#3b82f6",
      sparklineData: kpiTrends.regular,
    },
    {
      label: "Milestone Tasks",
      value: taskCounts.milestone,
      linkLabel: "Show milestone tasks",
      icon: Target,
      iconColor: "text-purple-600",
      iconBg: "bg-purple-50",
      testId: "card-milestones",
      onClick: () => setLocation("/tasks?taskTypeFilter=Milestone+Task"),
      sparklineType: "bars",
      sparklineColor: "#a855f7",
      sparklineData: kpiTrends.milestones,
    },
    {
      label: "Recurring Tasks",
      value: taskCounts.recurring,
      linkLabel: "Show recurring tasks",
      icon: RefreshCw,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
      testId: "card-recurring-tasks",
      onClick: () => setLocation("/tasks?taskTypeFilter=Recurring+Task"),
      sparklineType: "line",
      sparklineColor: "#10b981",
      sparklineData: kpiTrends.recurring,
    },
    {
      label: "Approval Tasks",
      value: taskCounts.approval,
      linkLabel: "Show approval tasks",
      icon: ShieldCheck,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-50",
      testId: "card-approvals",
      onClick: () => setLocation("/tasks?taskTypeFilter=Approval+Task"),
      sparklineType: "bars",
      sparklineColor: "#f59e0b",
      sparklineData: kpiTrends.approvals,
    },
    // Row 2: Status & Due Focus
    {
      label: "In Progress Tasks",
      value: taskCounts.inProgress,
      linkLabel: "Show in progress tasks",
      icon: Clock,
      iconColor: "text-cyan-600",
      iconBg: "bg-cyan-50",
      testId: "card-inprogress-tasks",
      onClick: () => setLocation("/tasks?statusFilter=INPROGRESS"),
      sparklineType: "bars",
      sparklineColor: "#06b6d4",
      sparklineData: kpiTrends.inProgress,
    },
    {
      label: "Due Today",
      value: taskCounts.dueToday,
      linkLabel: "Show due today",
      icon: Flame,
      iconColor: "text-orange-500",
      iconBg: "bg-orange-50",
      testId: "card-due-today",
      onClick: () => setLocation("/tasks?dueDateFilter=due_today"),
      sparklineType: "bars",
      sparklineColor: "#f97316",
      sparklineData: kpiTrends.due,
    },
    {
      label: "High Priority",
      value: taskCounts.highPriority,
      linkLabel: "Show high priority",
      icon: AlertTriangle,
      iconColor: "text-rose-600",
      iconBg: "bg-rose-50",
      testId: "card-high-priority",
      onClick: () => setLocation("/tasks?priorityFilter=high"),
      sparklineType: "bars",
      sparklineColor: "#f43f5e",
      sparklineData: kpiTrends.highPriority,
    },
    {
      label: "Completed Today",
      value: taskCounts.completedToday,
      linkLabel: "Show completed today",
      icon: Trophy,
      iconColor: "text-teal-600",
      iconBg: "bg-teal-50",
      testId: "card-completed-today",
      onClick: () => setLocation("/tasks?statusFilter=DONE&completedToday=true"),
      sparklineType: "line",
      sparklineColor: "#14b8a6",
      sparklineData: kpiTrends.completed,
    },
    // Row 3: Cancellations, Process Builder & Overview
    {
      label: "Cancelled Tasks",
      value: taskCounts.cancelled,
      linkLabel: "Show cancelled tasks",
      icon: X,
      iconColor: "text-slate-600",
      iconBg: "bg-slate-100",
      testId: "card-cancelled-tasks",
      onClick: () => setLocation("/tasks?statusFilter=CANCELLED"),
      sparklineType: "bars",
      sparklineColor: "#64748b",
      sparklineData: kpiTrends.cancelled,
    },
    {
      label: "Process Builder Instances",
      value: taskCounts.processInstances,
      linkLabel: "View process instances",
      icon: FolderTree,
      iconColor: "text-violet-600",
      iconBg: "bg-violet-50",
      testId: "card-process-instances",
      onClick: () => setLocation("/process-builder"),
      sparklineType: "line",
      sparklineColor: "#8b5cf6",
      sparklineData: kpiTrends.processInstances,
    },
    {
      label: "Process Builder Launches",
      value: taskCounts.processLaunches,
      linkLabel: "View process builder",
      icon: Zap,
      iconColor: "text-fuchsia-600",
      iconBg: "bg-fuchsia-50",
      testId: "card-process-launches",
      onClick: () => setLocation("/process-builder"),
      sparklineType: "bars",
      sparklineColor: "#d946ef",
      sparklineData: kpiTrends.processInstances,
    },
    {
      label: "Total Tasks",
      value: taskCounts.total,
      linkLabel: "Show all tasks",
      icon: Layers,
      iconColor: "text-indigo-600",
      iconBg: "bg-indigo-50",
      testId: "card-total-tasks",
      onClick: () => setLocation("/tasks"),
      sparklineType: "line",
      sparklineColor: "#6366f1",
      sparklineData: kpiTrends.total,
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
              Dashboard{" "}
              <span className="text-blue-600">Organization Workspace</span>
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

        {/* KPI CARDS: 8 cards displayed 4 per row */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-2.5 mb-3">
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
              sparklineType,
              sparklineColor,
              sparklineData,
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
                      {extractVal(value)}
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
                    <div className="h-[38px] flex flex-col justify-center gap-1.5 w-full">
                      <div className="w-full bg-[#e0e7ff] h-[7px] rounded-full overflow-hidden">
                        <div
                          className="bg-[#4f46e5] h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(Math.max(percentage || 0, 0), 100)}%`,
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] leading-none">
                        <span className="text-gray-500 font-medium">
                          Org completion
                        </span>
                        <span className="text-[#4f46e5] font-bold">
                          {percentage || 0}%
                        </span>
                      </div>
                    </div>
                  ) : (
                    <KpiSparkline
                      type={sparklineType || "bars"}
                      data={sparklineData || [0, 0, 0, 0, 0, 0, 0]}
                      color={sparklineColor || "#3b82f6"}
                      gradientId={`grad-org-${testId}`}
                    />
                  )}
                </div>
                <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-gray-200 to-transparent opacity-60" />
              </div>
            ),
          )}
        </div>

        {/* Organization Hierarchy Section */}
        <div ref={hierarchyRef} id="organization-hierarchy-section">
          <OrganizationHierarchySection
            tasks={allTasks}
            teamMembers={aggregatedTeamMembers}
            currentUser={user}
            activeRole="org_admin"
          />
        </div>

        {/* Task Overview and Task Status Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mb-3">
          <div className="lg:col-span-7 h-[350px]">
            <TaskOverviewChart tasks={allTasks} overviewData={charts?.taskOverview} />
          </div>
          <div className="lg:col-span-5 h-[350px]">
            <TaskStatusDonut
              tasks={allTasks}
              totalTasks={taskStatusBreakdown.total}
              openCount={taskStatusBreakdown.open}
              inProgressCount={taskStatusBreakdown.inProgress}
              completedCount={taskStatusBreakdown.completed}
              overdueCount={taskStatusBreakdown.overdue}
            />
          </div>
        </div>

        {/* Filters Bar - Modern style */}
        <div className="bg-white border border-gray-200 rounded-sm p-3 mb-3">
          <div
            className={`flex items-center justify-between ${
              showFilters ? "mb-3" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`h-8 w-8 flex items-center justify-center transition-colors border rounded-sm ${
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
                className="h-8 rounded-sm text-xs bg-blue-50/50 border-blue-200 text-blue-700 hover:bg-blue-100/60"
                onClick={scrollToHierarchy}
              >
                <FolderTree size={14} className="mr-1 text-blue-600" />
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
                <option value="created_today">Created Today</option>
                <option value="today">Due Today</option>
                <option value="overdue">Overdue</option>
                <option value="upcoming">Upcoming</option>
              </select>
            </div>
          )}
        </div>

        {/* MAIN GRID: Task Grid + Calendar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3 items-stretch">
          {/* Task Grid - left 2/3 - Modern table style */}
          <div className="lg:col-span-2 flex flex-col h-[480px]">
            <div className="bg-white border border-gray-200 shadow-sm rounded-sm flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div
                className="py-2.5 px-4 border-b border-gray-200 flex-shrink-0 rounded-t-sm flex flex-wrap items-center justify-between gap-2"
                style={{ backgroundColor: "#f9f9f9" }}
              >
                <div className="flex items-center gap-2">
                  <h5
                    className="text-xs font-semibold uppercase tracking-wider m-0 flex items-center gap-1.5"
                    style={{ color: "#676a6c" }}
                  >
                    <ListChecks size={13} className="text-blue-600" />
                    Organization Task Grid
                  </h5>
                  <span className="text-[10px] font-normal normal-case text-gray-400">
                    {activeTaskTab === "today"
                      ? `(${filteredTasks.length} created today)`
                      : activeTaskTab === "due_today"
                        ? `(${filteredTasks.length} due today)`
                        : activeTaskTab === "overdue"
                          ? `(${filteredTasks.length} overdue)`
                          : `(showing ${filteredTasks.length} of ${allTasks.length})`}
                  </span>
                </div>

                {/* Filter Tabs */}
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    onClick={() => setActiveTaskTab("today")}
                    className={`px-2.5 py-0.5 text-xs font-medium border rounded-sm transition-colors flex items-center gap-1.5 ${
                      activeTaskTab === "today"
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "border-gray-300 bg-white hover:bg-gray-50 text-gray-600"
                    }`}
                  >
                    <span>Created Today</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                        activeTaskTab === "today"
                          ? "bg-blue-700 text-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {todayCreatedCount}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTaskTab("all")}
                    className={`px-2.5 py-0.5 text-xs font-medium border rounded-sm transition-colors flex items-center gap-1.5 ${
                      activeTaskTab === "all"
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "border-gray-300 bg-white hover:bg-gray-50 text-gray-600"
                    }`}
                  >
                    <span>All Tasks</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                        activeTaskTab === "all"
                          ? "bg-blue-700 text-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {taskGridData.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTaskTab("due_today")}
                    className={`px-2.5 py-0.5 text-xs font-medium border rounded-sm transition-colors flex items-center gap-1.5 ${
                      activeTaskTab === "due_today"
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "border-gray-300 bg-white hover:bg-gray-50 text-gray-600"
                    }`}
                  >
                    <span>Due Today</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                        activeTaskTab === "due_today"
                          ? "bg-blue-700 text-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {dueTodayCount}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTaskTab("overdue")}
                    className={`px-2.5 py-0.5 text-xs font-medium border rounded-sm transition-colors flex items-center gap-1.5 ${
                      activeTaskTab === "overdue"
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "border-gray-300 bg-white hover:bg-gray-50 text-gray-600"
                    }`}
                  >
                    <span>Overdue</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                        activeTaskTab === "overdue"
                          ? "bg-blue-700 text-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {overdueTasksCount}
                    </span>
                  </button>

                  {(taskFilters.status !== "all" ||
                    taskFilters.priority !== "all" ||
                    taskFilters.dueDate !== "all" ||
                    Boolean(taskFilters.search)) && (
                    <button
                      onClick={() => {
                        setShowAllTasks(false);
                        setTaskFilters({
                          search: "",
                          status: "all",
                          priority: "all",
                          dueDate: "all",
                        });
                        setActiveTaskTab("today");
                      }}
                      className="ml-1 text-[10px] text-blue-600 hover:underline font-medium"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable Table Area */}
              <TooltipProvider>
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto custom-scrollbar">
                  <table className="w-full">
                    <thead
                      className="sticky top-0 z-10 border-b border-gray-200 shadow-sm"
                      style={{ backgroundColor: "#f9f9f9" }}
                    >
                      <tr>
                        <th className="py-2.5 px-3 w-8">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            checked={
                              filteredTasks.length > 0 &&
                              selectedTasks.length === filteredTasks.length
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTasks(filteredTasks.map((t) => t.id));
                              } else {
                                setSelectedTasks([]);
                              }
                            }}
                          />
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
                            className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wide"
                            style={{ color: "#676a6c" }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {filteredTasks.length === 0 ? (
                        <tr>
                          <td
                            colSpan="7"
                            className="px-4 py-16 text-center text-sm"
                            style={{ color: "#9a9a9a" }}
                          >
                            <div className="flex flex-col items-center justify-center gap-2">
                              <ListChecks size={28} className="text-gray-300" />
                              <p className="text-sm font-medium text-gray-600">
                                {activeTaskTab === "today"
                                  ? `No tasks created today (${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })})`
                                  : activeTaskTab === "due_today"
                                    ? "No tasks due today"
                                    : activeTaskTab === "overdue"
                                      ? "No overdue tasks"
                                      : "No tasks found matching filters."}
                              </p>
                              {activeTaskTab !== "all" && allTasks.length > 0 && (
                                <button
                                  className="text-xs text-blue-600 hover:underline font-medium"
                                  onClick={() => setActiveTaskTab("all")}
                                >
                                  View all organization tasks ({allTasks.length})
                                </button>
                              )}
                              {(taskFilters.status !== "all" ||
                                taskFilters.priority !== "all" ||
                                taskFilters.dueDate !== "all" ||
                                taskFilters.search) && (
                                <button
                                  className="text-xs text-blue-600 hover:underline font-medium"
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
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredTasks.map((task) => (
                          <tr
                            key={task.id}
                            className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                              selectedTasks.includes(task.id) ? "bg-blue-50/30" : ""
                            }`}
                            onClick={() => handleTaskClick(task.id)}
                          >
                            <td
                              className="py-2.5 px-3"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                checked={selectedTasks.includes(task.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedTasks((prev) => [...prev, task.id]);
                                  } else {
                                    setSelectedTasks((prev) =>
                                      prev.filter((id) => id !== task.id),
                                    );
                                  }
                                }}
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5">
                                {getTaskTypeIcon(task, 13)}
                                {task.isPastDue && (
                                  <span
                                    title="Past Due"
                                    className="text-red-500 text-xs flex-shrink-0"
                                  >
                                    ⚠️
                                  </span>
                                )}
                                {task.isDueToday && (
                                  <span
                                    title="Due Today"
                                    className="text-orange-500 text-xs flex-shrink-0"
                                  >
                                    📅
                                  </span>
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
                              className="py-2.5 px-3 text-xs whitespace-nowrap"
                              style={{ color: "#9a9a9a" }}
                            >
                              {task.assignee}
                            </td>
                            <td
                              className="py-2.5 px-3 text-xs whitespace-nowrap"
                              style={{ color: "#9a9a9a" }}
                            >
                              {task.dueDate}
                            </td>
                            <td className="py-2.5 px-3">
                              {getPriorityBadge(task.priority)}
                            </td>
                            <td className="py-2.5 px-3">
                              {getStatusBadge(task.status)}
                            </td>
                            <td className="py-2.5 px-3">
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

              {/* Task Grid Footer */}
              <div
                className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between flex-shrink-0 rounded-b-sm"
                style={{ backgroundColor: "#f9f9f9" }}
              >
                <span className="text-[11px]" style={{ color: "#9a9a9a" }}>
                  Showing {filteredTasks.length} task{filteredTasks.length === 1 ? "" : "s"}
                </span>
                {filteredTasks.length > 5 ? (
                  <span className="text-[11px] font-medium text-blue-600 flex items-center gap-1">
                    <span>Scroll to view all</span>
                    <span className="text-xs">↕</span>
                  </span>
                ) : (
                  <span className="text-[11px]" style={{ color: "#9a9a9a" }}>
                    {filteredTasks.length > 0 ? "All tasks shown" : ""}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Calendar - right 1/3 - Modern style */}
          <div className="lg:col-span-1 flex flex-col h-[480px]">
            <div className="bg-white border border-gray-200 shadow-sm rounded-sm flex flex-col h-full overflow-hidden">
              <div
                className="py-2.5 px-4 border-b border-gray-200 rounded-t-sm flex-shrink-0"
                style={{ backgroundColor: "#f9f9f9" }}
              >
                <div className="flex items-center justify-between mb-2.5">
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

              <div className="p-3 flex-1 min-h-0 overflow-y-auto flex flex-col custom-scrollbar">
                <p
                  className="text-xs font-medium mb-2 flex-shrink-0"
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
                            className={`h-7 sm:h-7.5 flex flex-col items-center justify-center text-[10px] rounded cursor-pointer relative ${
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
                                className={`absolute bottom-0.5 w-1 h-1 rounded-full ${
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
                              className={`p-1.5 px-2 rounded border cursor-pointer ${
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
                                  <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded-sm font-medium">
                                    {dayTasks.length}
                                  </span>
                                )}
                              </div>
                              {dayTasks.slice(0, 2).map((task) => (
                                <p
                                  key={task.id}
                                  className="text-[10px] truncate mt-0.5 pl-1.5 border-l-2 border-blue-400"
                                  style={{ color: "#9a9a9a" }}
                                  title={task.title}
                                >
                                  {task.title}
                                </p>
                              ))}
                              {dayTasks.length > 2 && (
                                <p
                                  className="text-[9px] pl-1.5"
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
                          <div className="text-center py-6">
                            <Calendar
                              className="mx-auto mb-2 text-gray-300"
                              size={28}
                            />
                            <p className="text-xs text-gray-400">
                              No tasks on this day
                            </p>
                          </div>
                        ) : (
                          dayTasks.map((task) => (
                            <div
                              key={task.id}
                              className="p-2 bg-white border border-gray-200 rounded hover:border-blue-300 cursor-pointer transition-colors"
                              onClick={() => handleTaskClick(task.id)}
                            >
                              <p
                                className="text-xs font-medium truncate text-gray-700"
                                title={task.title}
                              >
                                {task.title}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
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
                                <span className="text-[9px] text-gray-400">
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
                <div className="mt-3 pt-2.5 border-t border-gray-100 space-y-1.5">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wide text-gray-400"
                  >
                    Tasks This {calendarView} ({calendarTasks.length})
                  </p>
                  {calendarTasks.length === 0 ? (
                    <p className="text-[10px] text-center py-2 text-gray-400">
                      No tasks found
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-[110px] overflow-y-auto pr-0.5 custom-scrollbar">
                      {calendarTasks.map((task) => (
                        <div
                          key={task.id}
                          className="p-1.5 px-2 bg-blue-50/60 hover:bg-blue-100/70 border border-blue-100 rounded text-[10px] cursor-pointer transition-colors"
                          onClick={() => handleTaskClick(task.id)}
                        >
                          <p
                            className="font-medium truncate text-gray-700"
                            title={task.title}
                          >
                            {task.title}
                          </p>
                          <div className="flex items-center justify-between text-[9px] text-gray-400 mt-0.5">
                            <span>{task.date}</span>
                            <span className="uppercase text-[8px] font-semibold text-blue-600">
                              {task.status || "OPEN"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Create Task Button Footer */}
              <div className="p-3 pt-2 border-t border-gray-100 flex-shrink-0 bg-white rounded-b-sm">
                <button
                  className="w-full h-8 flex items-center justify-center gap-1.5 text-xs font-medium text-blue-600 border border-blue-600 rounded hover:bg-blue-50 transition-colors"
                  onClick={() => handleCalendarDateClick()}
                >
                  <Plus size={12} /> Create Task
                </button>
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
                <p
                  className="text-3xl font-bold m-0"
                  style={{ color: "#1f2937" }}
                >
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
                <span className="text-green-600">
                  On-time: {orgCompletion.onTime}
                </span>
                <span className="text-red-500">
                  Overdue closed: {orgCompletion.overdueClosed}
                </span>
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
              <h3
                className="text-base font-semibold"
                style={{ color: "#676a6c" }}
              >
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
                <label
                  className="block text-xs font-medium mb-1"
                  style={{ color: "#676a6c" }}
                >
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
                <label
                  className="block text-xs font-medium mb-1"
                  style={{ color: "#676a6c" }}
                >
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
