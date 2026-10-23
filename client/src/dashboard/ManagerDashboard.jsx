import React, { useMemo, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  MoreHorizontal,
  Edit,
  XCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import TaskOverviewChart from "./components/TaskOverviewChart";
import TaskStatusDonut from "./components/TaskStatusDonut";
import KpiSparkline from "./components/KpiSparkline";
import OrganizationHierarchySection from "./components/OrganizationHierarchySection";
import { useAggregatedDashboard } from "./hooks/useAggregatedDashboard";

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

  const getDisplayNow = () => {
    const d = new Date();
    return new Date(
      Date.UTC(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        d.getHours(),
        d.getMinutes(),
        d.getSeconds()
      )
    );
  };

  const isTaskOverdue = (task) => {
    if (!task?.dueDate || task.dueDate === "No due date") return false;
    const s = statusOf(task.status);
    if (["completed", "done", "cancelled"].includes(s)) return false;
    const d = new Date(task.dueDate);
    if (isNaN(d.getTime())) return false;
    return d < getDisplayNow() || d < now;
  };

  const completedCount = tasks.filter((t) =>
    ["completed", "done"].includes(statusOf(t.status)),
  ).length;
  const overdueCount = tasks.filter((t) => t.isPastDue || isTaskOverdue(t)).length;
  const inProgressCount = tasks.filter((t) =>
    ["in_progress", "in-progress", "doing", "inprogress"].includes(
      statusOf(t.status),
    ) && !t.isPastDue && !isTaskOverdue(t),
  ).length;
  const openCount = Math.max(
    0,
    tasks.filter((t) =>
      !["completed", "done", "in_progress", "in-progress", "doing", "inprogress"].includes(statusOf(t.status)) &&
      !t.isPastDue &&
      !isTaskOverdue(t),
    ).length
  );
  return {
    completedTasks: completedCount,
    totalTasks: tasks.length,
    inProgressTasks: inProgressCount,
    upcomingDeadlines: tasks.filter(
      (t) =>
        t.dueDate &&
        !t.isPastDue &&
        !isTaskOverdue(t) &&
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
  const queryClient = useQueryClient();
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
  const [focusScope, setFocusScope] = useState("all"); // "all" | "my" | "team"
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTaskId, setCancelTaskId] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [taskListFilter, setTaskListFilter] = useState("all");

  const { user } = useAuth();
  const token = localStorage.getItem("token");

  // Single consolidated aggregated dashboard query
  const {
    dashboardData,
    kpis,
    charts,
    taskList: aggregatedTasks,
    teamMembers: aggregatedMembers,
    milestones: aggregatedMilestones,
    isLoading: isAggregatedLoading,
    invalidateDashboard,
  } = useAggregatedDashboard({
    activeRole: "manager",
    timeRange: selectedTimeRange === "all" ? "7d" : selectedTimeRange,
    filters: {
      priority: priorityFilter,
      search: searchQuery,
    },
  });

  const tasksLoading = isAggregatedLoading;
  const membersLoading = isAggregatedLoading;
  const milestonesLoading = isAggregatedLoading;
  const statsLoading = isAggregatedLoading;

  const dashboardCounts = kpis || {};
  const teamData = {
    employeeStats: aggregatedMembers || [],
    totalEmployees: (aggregatedMembers || []).length,
  };

  const teamTasksData = useMemo(() => {
    return aggregatedTasks || [];
  }, [aggregatedTasks]);

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

    if (teamData?.employeeStats && Array.isArray(teamData.employeeStats)) {
      members = teamData.employeeStats
        .filter((m) => !isOrgAdmin(m.role)) // ONLY remove org_admin
        .map((m) => ({
          ...m,
          id: m.id || m._id,
          status: m.status || "online",
        }));
    }

    console.log(
      "Team members (org_admin filtered out, employees kept):",
      members.length,
    );
    return Array.isArray(members) ? members : [];
  }, [teamData]);

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

  const normalizeStatus = useCallback((status) => (status || "OPEN").toUpperCase(), []);

  const isTaskOverdue = useCallback((t) => {
    if (t?.isPastDue !== undefined) return Boolean(t.isPastDue);
    if (!t?.dueDate || t.dueDate === "No due date") return false;
    const s = normalizeStatus(t.status);
    if (["DONE", "COMPLETED", "CANCELLED", "REJECTED", "ONHOLD", "ON_HOLD", "HOLD"].includes(s)) return false;
    const d = new Date(t.dueDate);
    if (isNaN(d.getTime())) return false;
    return d < new Date();
  }, [normalizeStatus]);

  const teamStatsForHeader = useMemo(() => {
    let open = 0;
    let inProgress = 0;
    let completed = 0;
    let overdue = 0;

    teamTasksData.forEach((t) => {
      const s = (t.status || "").toUpperCase();
      const isDone = ["COMPLETED", "DONE"].includes(s);
      const isCancelled = ["CANCELLED", "CANCELED"].includes(s);
      const isInProg = ["IN_PROGRESS", "INPROGRESS", "DOING"].includes(s);
      const isPastDue = t.isPastDue || isTaskOverdue(t);

      if (isDone) completed++;
      else if (isInProg) inProgress++;
      else if (!isCancelled) open++;

      if (isPastDue) overdue++;
    });

    const serverOverdue = extractVal(kpis?.pastDueDate ?? kpis?.overdueTasks, 0);

    return {
      totalTasks: teamTasksData.length > 0 ? teamTasksData.length : extractVal(kpis?.totalTasks, 0),
      completedTasks: teamTasksData.length > 0 ? completed : extractVal(kpis?.completedTasks, 0),
      inProgressTasks: teamTasksData.length > 0 ? inProgress : extractVal(kpis?.inProgressTasks, 0),
      overdueTasks: Math.max(overdue, serverOverdue),
      openTasks: teamTasksData.length > 0 ? open : extractVal(kpis?.openTasks, 0),
      completionPercentage: extractVal(kpis?.completionRate, 0),
    };
  }, [kpis, teamTasksData]);

  const teamStats = useMemo(() => {
    return {
      totalTeamMembers: teamMembers.length,
      activeTasks: kpis?.beforeDueDate ?? (kpis?.openTasks || 0) + (kpis?.inProgressTasks || 0),
      completedTasksThisMonth: kpis?.completedTasks ?? 0,
      overdueItems: kpis?.pastDueDate ?? kpis?.overdueTasks ?? 0,
      teamProductivity: kpis?.teamProductivity ?? 100,
      avgTaskCompletionTime: "N/A",
      upcomingDeadlines: kpis?.beforeDueDate ?? 0,
      teamSatisfaction: 5.0,
      isExpired: false,
    };
  }, [kpis, teamMembers]);

  // Helper functions for Today Focus section

  const isTaskDueToday = useCallback((t) => {
    if (t.isDueToday !== undefined && t.isDueToday) return true;
    if (!t.dueDate || t.dueDate === "No due date") return false;
    const d = new Date(t.dueDate);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  }, []);

  const getTaskAssigneeInfo = useCallback((t) => {
    const currentUserId = String(user?.id || user?._id || "");
    const aId = String(
      t.assignedTo?._id ||
      t.assignedTo?.id ||
      (typeof t.assignedTo === "string" ? t.assignedTo : "") ||
      t.assigneeId ||
      ""
    );
    const uId = String(t.userId || t.createdBy?._id || t.createdBy || "");
    const isMyTask = (aId && aId === currentUserId) || (!aId && uId === currentUserId);
    const assigneeName =
      t.assignedTo?.fullName ||
      (t.assignedTo?.firstName
        ? `${t.assignedTo.firstName} ${t.assignedTo.lastName || ""}`.trim()
        : null) ||
      t.assigneeName ||
      t.assignee ||
      (isMyTask ? "You" : "Team Member");

    return { isMyTask, assigneeName, aId, uId };
  }, [user]);

  // Categorize ALL tasks in teamTasksData into Today Focus buckets
  const allCategorizedFocusTasks = useMemo(() => {
    const todayList = [];
    const overdueList = [];
    const upcomingList = [];
    const waitingList = [];

    const now = new Date();

    teamTasksData.forEach((t) => {
      const s = normalizeStatus(t.status);
      const isDone = ["DONE", "COMPLETED", "CANCELLED", "REJECTED"].includes(s);
      const isOnHold =
        ["ONHOLD", "ON_HOLD", "HOLD", "WAITING", "PENDING", "APPROVAL", "UNDER_REVIEW"].includes(s) ||
        t.taskType === "approval" ||
        t.isApprovalTask;
      const overdue = isTaskOverdue(t);
      const dueToday = isTaskDueToday(t);

      // Waiting: Tasks that are On Hold, Pending, or Waiting for approval/action
      if (!isDone && isOnHold) {
        waitingList.push(t);
      }

      // Overdue: Only active tasks (not done, not on hold)
      if (overdue && !isDone && !isOnHold) {
        overdueList.push(t);
      }

      // Today Focus: Strictly active tasks due today (not done, not on hold)
      if (!isDone && !isOnHold && dueToday) {
        todayList.push(t);
      }

      // Upcoming: Future due date and active (not done, not on hold)
      if (!isDone && !isOnHold && !overdue && !dueToday && t.dueDate && t.dueDate !== "No due date") {
        const d = new Date(t.dueDate);
        if (!isNaN(d.getTime()) && d > now) {
          upcomingList.push(t);
        }
      }
    });

    return { todayList, overdueList, upcomingList, waitingList };
  }, [teamTasksData, isTaskOverdue, isTaskDueToday, normalizeStatus]);

  // Tasks belonging to the currently active focus tab across all scopes (to determine scope counts)
  const activeTabAllTasks = useMemo(() => {
    switch (focusTab) {
      case "overdue":
        return allCategorizedFocusTasks.overdueList;
      case "upcoming":
        return allCategorizedFocusTasks.upcomingList;
      case "waiting":
        return allCategorizedFocusTasks.waitingList;
      case "today":
      default:
        return allCategorizedFocusTasks.todayList;
    }
  }, [focusTab, allCategorizedFocusTasks]);

  // Scope counts (All, My Tasks, Team Tasks) for the active focus category
  const focusScopeCounts = useMemo(() => {
    let my = 0;
    let team = 0;
    activeTabAllTasks.forEach((t) => {
      if (getTaskAssigneeInfo(t).isMyTask) {
        my++;
      } else {
        team++;
      }
    });
    return {
      all: activeTabAllTasks.length,
      my,
      team,
    };
  }, [activeTabAllTasks, getTaskAssigneeInfo]);

  // Dynamic Today Focus lists filtered by the active scope (All / My / Team)
  const todayFocusLists = useMemo(() => {
    const filterByScope = (list) => {
      if (focusScope === "my") {
        return list.filter((t) => getTaskAssigneeInfo(t).isMyTask);
      }
      if (focusScope === "team") {
        return list.filter((t) => !getTaskAssigneeInfo(t).isMyTask);
      }
      return list;
    };

    return {
      todayList: filterByScope(allCategorizedFocusTasks.todayList),
      overdueList: filterByScope(allCategorizedFocusTasks.overdueList),
      upcomingList: filterByScope(allCategorizedFocusTasks.upcomingList),
      waitingList: filterByScope(allCategorizedFocusTasks.waitingList),
    };
  }, [allCategorizedFocusTasks, focusScope, getTaskAssigneeInfo]);

  const activeFocusTasks = useMemo(() => {
    switch (focusTab) {
      case "overdue":
        return todayFocusLists.overdueList;
      case "upcoming":
        return todayFocusLists.upcomingList;
      case "waiting":
        return todayFocusLists.waitingList;
      case "today":
      default:
        return todayFocusLists.todayList;
    }
  }, [focusTab, todayFocusLists]);

  const handleToggleTaskStatus = async (task) => {
    const taskId = task._id || task.id;
    const isDone = ["DONE", "COMPLETED"].includes(normalizeStatus(task.status));

    if (isDone) {
      showErrorToast("Completed tasks cannot be reopened.");
      return;
    }

    setUpdatingTaskId(taskId);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "DONE" }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        showSuccessToast(
          data.requiresApproval
            ? "Status change submitted for approval"
            : "Task marked as completed! 🎉"
        );
        invalidateDashboard();
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
        queryClient.invalidateQueries({ queryKey: ["/api/mytasks"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/aggregated"] });
      } else {
        showErrorToast(data.message || "Failed to update task status");
      }
    } catch (err) {
      showErrorToast(err.message || "Network error updating task status");
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleStartTask = async (task) => {
    const taskId = task._id || task.id;
    setUpdatingTaskId(taskId);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "INPROGRESS" }),
      });
      if (res.ok) {
        showSuccessToast("Task started!");
        invalidateDashboard();
        setLocation(`/tasks/${taskId}?activeRole=${activeRole}`);
      } else {
        setLocation(`/tasks/${taskId}?activeRole=${activeRole}`);
      }
    } catch {
      setLocation(`/tasks/${taskId}?activeRole=${activeRole}`);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleConfirmCancelTask = async () => {
    if (!cancelTaskId || !cancelReason.trim()) return;
    setIsCancelling(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/tasks/${cancelTaskId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: "CANCELLED",
          reason: cancelReason.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        showSuccessToast("Task cancelled successfully");
        setShowCancelModal(false);
        setCancelReason("");
        setCancelTaskId(null);
        invalidateDashboard();
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
        queryClient.invalidateQueries({ queryKey: ["/api/mytasks"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/aggregated"] });
      } else {
        showErrorToast(data.message || "Failed to cancel task");
      }
    } catch (err) {
      showErrorToast(err.message || "Network error cancelling task");
    } finally {
      setIsCancelling(false);
    }
  };

  const renderPriorityBadge = (priority) => {
    const p = String(priority || "low").toLowerCase();
    if (p === "urgent" || p === "critical") {
      return (
        <span className="inline-flex items-center text-rose-600 bg-rose-50 border border-rose-200 text-[11px] font-semibold px-2 py-0.5 rounded-sm">
          Urgent
        </span>
      );
    }
    if (p === "high") {
      return (
        <span className="inline-flex items-center text-red-600 bg-red-50 border border-red-200 text-[11px] font-semibold px-2 py-0.5 rounded-sm">
          High
        </span>
      );
    }
    if (p === "medium") {
      return (
        <span className="inline-flex items-center text-amber-600 bg-amber-50 border border-amber-200 text-[11px] font-semibold px-2 py-0.5 rounded-sm">
          Medium
        </span>
      );
    }
    return (
      <span className="inline-flex items-center text-blue-600 bg-blue-50 border border-blue-200 text-[11px] font-semibold px-2 py-0.5 rounded-sm">
        Low
      </span>
    );
  };

  const renderStatusBadge = (status) => {
    const raw = status || "OPEN";
    const s = normalizeStatus(raw);

    if (["DONE", "COMPLETED"].includes(s)) {
      return (
        <span className="inline-flex items-center bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold px-2.5 py-0.5 rounded-sm uppercase tracking-wider">
          {s === "DONE" ? "Done" : "Completed"}
        </span>
      );
    }
    if (["INPROGRESS", "IN_PROGRESS"].includes(s)) {
      return (
        <span className="inline-flex items-center bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-semibold px-2.5 py-0.5 rounded-sm uppercase tracking-wider">
          In Progress
        </span>
      );
    }
    if (["ONHOLD", "ON_HOLD", "HOLD"].includes(s)) {
      return (
        <span className="inline-flex items-center bg-orange-50 text-orange-700 border border-orange-200 text-[11px] font-semibold px-2.5 py-0.5 rounded-sm uppercase tracking-wider">
          On Hold
        </span>
      );
    }
    if (["CANCELLED", "CANCELED", "REJECTED"].includes(s)) {
      return (
        <span className="inline-flex items-center bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-semibold px-2.5 py-0.5 rounded-sm uppercase tracking-wider">
          {s === "REJECTED" ? "Rejected" : "Cancelled"}
        </span>
      );
    }
    if (["PENDING", "WAITING", "APPROVAL", "UNDER_REVIEW"].includes(s)) {
      return (
        <span className="inline-flex items-center bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-semibold px-2.5 py-0.5 rounded-sm uppercase tracking-wider">
          {s === "WAITING" ? "Waiting" : s === "APPROVAL" ? "Approval" : "Pending"}
        </span>
      );
    }
    if (s === "OPEN") {
      return (
        <span className="inline-flex items-center bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold px-2.5 py-0.5 rounded-sm uppercase tracking-wider">
          Open
        </span>
      );
    }

    const displayLabel = String(raw).replace(/_/g, " ");
    return (
      <span className="inline-flex items-center bg-gray-100 text-gray-700 border border-gray-200 text-[11px] font-semibold px-2.5 py-0.5 rounded-sm uppercase tracking-wider">
        {displayLabel}
      </span>
    );
  };

  const formatDueDateTime = (dateString) => {
    if (!dateString || dateString === "No due date") return "No due date";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "No due date";
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Helper to compute 7-day trend array for dynamic KPI sparklines
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

    // 1. Total Team Tasks created trend
    const totalTrend = days.map(
      (day) =>
        teamTasksData.filter(
          (t) => t.createdAt && isSameDate(new Date(t.createdAt), day),
        ).length,
    );

    // 2. Completed tasks trend
    const completedTrend = days.map(
      (day) =>
        teamTasksData.filter((t) => {
          const cd = t.completedDate || t.completedAt;
          return cd && isSameDate(new Date(cd), day);
        }).length,
    );

    // 3. In Progress trend
    const inProgressTrend = days.map((day) => {
      return teamTasksData.filter((t) => {
        const s = (t.status || "").toLowerCase();
        if (!["in_progress", "in-progress", "inprogress", "doing"].includes(s))
          return false;
        const cr = t.createdAt ? new Date(t.createdAt) : null;
        return cr ? cr <= day : true;
      }).length;
    });

    // 4. Overdue trend
    const overdueTrend = days.map(
      (day) =>
        teamTasksData.filter((t) => {
          if (!t.dueDate) return false;
          const dd = new Date(t.dueDate);
          const isDone =
            ["completed", "done", "DONE"].includes(t.status) ||
            (t.status || "").toLowerCase() === "completed";
          return dd <= day && !isDone;
        }).length,
    );

    // 5. Active members workload distribution (up to 7)
    const membersTrend = teamMembers.map((m) => m.activeTasks || 0).slice(0, 7);
    while (membersTrend.length < 7) membersTrend.push(0);

    return {
      total: totalTrend,
      completed: completedTrend,
      inProgress: inProgressTrend,
      overdue: overdueTrend,
      members: membersTrend,
    };
  }, [teamTasksData, teamMembers]);

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
        sparklineType: "bars",
        sparklineColor: "#3b82f6",
        sparklineData: kpiTrends.total,
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
        sparklineType: "line",
        sparklineColor: "#10b981",
        sparklineData: kpiTrends.completed,
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
        sparklineType: "line",
        sparklineColor: "#f59e0b",
        sparklineData: kpiTrends.inProgress,
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
        sparklineType: "bars",
        sparklineColor: "#ef4444",
        sparklineData: kpiTrends.overdue,
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
        sparklineType: "bars",
        sparklineColor: "#8b5cf6",
        sparklineData: kpiTrends.members,
      },
    ],
    [
      teamStatsForHeader,
      teamStats.teamProductivity,
      teamMembers,
      kpiTrends,
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
        const today = new Date();
        const localNowIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        tasks = tasks.filter((t) => {
          const isCreated =
            (t.createdAt && new Date(t.createdAt).toDateString() === today.toDateString()) ||
            String(t.createdAt || "").startsWith(localNowIso) ||
            String(t.createdAt || "").startsWith(today.toISOString().split("T")[0]);
          const isDue =
            (t.dueDate && new Date(t.dueDate).toDateString() === today.toDateString()) ||
            String(t.dueDate || "").startsWith(localNowIso) ||
            String(t.dueDate || "").startsWith(today.toISOString().split("T")[0]);
          return isCreated || isDue;
        });
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
    const milestones = aggregatedMilestones || [];
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
  }, [aggregatedMilestones, teamTasksData]);

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
        <div className="bg-white rounded-sm border border-gray-200/80 shadow-sm p-4 md:p-5 mb-4">
          {/* Header row with Scope Filter & Tab Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100">
            {/* Left: Star + Title + Count + Scope Switcher */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Star size={16} className="text-amber-500 fill-amber-400 flex-shrink-0" />
                <h2 className="text-xs md:text-sm font-bold uppercase tracking-wider text-gray-800 m-0">
                  TODAY FOCUS
                </h2>
                <span className="text-xs font-medium text-gray-400">
                  ({activeFocusTasks.length} {activeFocusTasks.length === 1 ? "task" : "tasks"})
                </span>
              </div>

              {/* Scope Switcher: All | My Tasks | Team Tasks */}
              <div className="inline-flex items-center bg-gray-100 p-0.5 rounded-sm border border-gray-200">
                <button
                  type="button"
                  onClick={() => setFocusScope("all")}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-sm transition-colors cursor-pointer ${
                    focusScope === "all"
                      ? "bg-white text-gray-900 shadow-xs"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                  title={`Show all ${focusTab} tasks (${focusScopeCounts.all})`}
                >
                  All ({focusScopeCounts.all})
                </button>
                <button
                  type="button"
                  onClick={() => setFocusScope("my")}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-sm transition-colors cursor-pointer ${
                    focusScope === "my"
                      ? "bg-white text-blue-600 shadow-xs"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                  title={`Show only your ${focusTab} tasks (${focusScopeCounts.my})`}
                >
                  My Tasks ({focusScopeCounts.my})
                </button>
                <button
                  type="button"
                  onClick={() => setFocusScope("team")}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-sm transition-colors cursor-pointer ${
                    focusScope === "team"
                      ? "bg-white text-purple-600 shadow-xs"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                  title={`Show team member ${focusTab} tasks (${focusScopeCounts.team})`}
                >
                  Team Tasks ({focusScopeCounts.team})
                </button>
              </div>
            </div>

            {/* Right: Filter tabs (Today, Overdue, Upcoming, Waiting) */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setFocusTab("today")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-sm border transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                  focusTab === "today"
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                Today ({todayFocusLists.todayList.length})
              </button>
              <button
                type="button"
                onClick={() => setFocusTab("overdue")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-sm border transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                  focusTab === "overdue"
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                Overdue ({todayFocusLists.overdueList.length})
              </button>
              <button
                type="button"
                onClick={() => setFocusTab("upcoming")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-sm border transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                  focusTab === "upcoming"
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                Upcoming ({todayFocusLists.upcomingList.length})
              </button>
              <button
                type="button"
                onClick={() => setFocusTab("waiting")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-sm border transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                  focusTab === "waiting"
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                Waiting ({todayFocusLists.waitingList.length})
              </button>
            </div>
          </div>

          {/* Task Rows List */}
          {activeFocusTasks.length > 0 ? (
            <div className="divide-y divide-gray-100 mt-1">
              {activeFocusTasks.slice(0, 8).map((task) => {
                const taskId = task._id || task.id;
                const isDone = ["DONE", "COMPLETED"].includes(normalizeStatus(task.status));
                const isCancelled = ["CANCELLED", "REJECTED"].includes(normalizeStatus(task.status));
                const isFinalStatus = isDone || isCancelled;
                const isInProg = ["INPROGRESS", "IN_PROGRESS"].includes(normalizeStatus(task.status));
                const isOverdue = isTaskOverdue(task);
                const tag =
                  task.tags?.[0] || task.category || task.taskType || "task";
                const { isMyTask, assigneeName } = getTaskAssigneeInfo(task);

                return (
                  <div
                    key={taskId}
                    className="py-3 px-2 hover:bg-slate-50/70 rounded-sm transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm group"
                  >
                    {/* Left: Checkbox, Priority, Title, Assignee, Tag */}
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={isDone}
                        disabled={isDone || updatingTaskId === taskId}
                        onChange={() => !isDone && handleToggleTaskStatus(task)}
                        className={`w-4 h-4 rounded-sm border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0 ${
                          isDone ? "cursor-not-allowed opacity-80" : "cursor-pointer"
                        }`}
                      />

                      {/* Priority badge */}
                      <div className="flex-shrink-0">
                        {renderPriorityBadge(task.priority)}
                      </div>

                      {/* Title */}
                      <span
                        onClick={() => setLocation(`/tasks/${taskId}?activeRole=${activeRole}`)}
                        className={`font-semibold text-gray-800 text-sm hover:text-blue-600 cursor-pointer truncate ${
                          isDone ? "line-through text-gray-400" : ""
                        }`}
                        title={task.title}
                      >
                        {task.title}
                      </span>

                      {/* Assignee Pill */}
                      <span
                        className={`hidden sm:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-sm whitespace-nowrap flex-shrink-0 border ${
                          isMyTask
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-purple-50 text-purple-700 border-purple-200"
                        }`}
                        title={isMyTask ? "Assigned to You" : `Assigned to: ${assigneeName}`}
                      >
                        <Users size={11} /> {isMyTask ? "You" : assigneeName}
                      </span>

                      {/* Tag badge */}
                      {tag && (
                        <span className="hidden md:inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-sm font-normal whitespace-nowrap flex-shrink-0">
                          {tag}
                        </span>
                      )}
                    </div>

                    {/* Middle: Due Time, Status Badge, Progress */}
                    <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0 justify-between sm:justify-start">
                      {/* Due Time */}
                      <span
                        className={`flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${
                          isOverdue || isTaskDueToday(task)
                            ? "text-rose-500"
                            : "text-gray-500"
                        }`}
                      >
                        <Clock size={13} /> {formatDueDateTime(task.dueDate)}
                      </span>

                      {/* Status badge */}
                      <div className="flex-shrink-0">
                        {renderStatusBadge(task.status)}
                      </div>

                      {/* Progress bar */}
                      <div className="hidden lg:flex items-center gap-2 w-24 flex-shrink-0">
                        <div className="w-full bg-gray-100 rounded-sm h-1.5 overflow-hidden">
                          <div
                            className="bg-blue-600 h-1.5 rounded-sm transition-all duration-300"
                            style={{ width: `${Math.min(task.progress || 0, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-500 w-8 text-right">
                          {task.progress || 0}%
                        </span>
                      </div>

                      {/* Contextual Action Button */}
                      <div className="flex items-center gap-1.5">
                        {isInProg ? (
                          <button
                            type="button"
                            onClick={() => setLocation(`/tasks/${taskId}?activeRole=${activeRole}`)}
                            className="border border-blue-600 text-blue-600 hover:bg-blue-50 text-xs font-semibold px-3 py-1 rounded-sm transition-colors cursor-pointer"
                          >
                            Continue
                          </button>
                        ) : normalizeStatus(task.status) === "PENDING" ? (
                          <button
                            type="button"
                            onClick={() => setLocation(`/tasks/${taskId}?activeRole=${activeRole}`)}
                            className="border border-blue-600 text-blue-600 hover:bg-blue-50 text-xs font-semibold px-3 py-1 rounded-sm transition-colors cursor-pointer"
                          >
                            Update
                          </button>
                        ) : !isDone ? (
                          <button
                            type="button"
                            onClick={() => handleStartTask(task)}
                            className="border border-blue-600 text-blue-600 hover:bg-blue-50 text-xs font-semibold px-3 py-1 rounded-sm transition-colors cursor-pointer"
                          >
                            Start
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setLocation(`/tasks/${taskId}?activeRole=${activeRole}`)}
                            className="border border-gray-300 text-gray-600 hover:bg-gray-50 text-xs font-semibold px-3 py-1 rounded-sm transition-colors cursor-pointer"
                          >
                            View
                          </button>
                        )}

                        {/* Dropdown Menu */}
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="p-1 rounded-sm hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer"
                            >
                              <MoreHorizontal size={16} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40 bg-white rounded-sm shadow-md border border-gray-100">
                            <DropdownMenuItem
                              onClick={() => setLocation(`/tasks/${taskId}?activeRole=${activeRole}`)}
                              className="cursor-pointer text-xs"
                            >
                              <ArrowUpRight size={14} className="mr-2" /> View Details
                            </DropdownMenuItem>
                            {!isFinalStatus && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleToggleTaskStatus(task)}
                                  className="cursor-pointer text-xs"
                                >
                                  <CheckSquare size={14} className="mr-2" /> Mark Complete
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setLocation(`/tasks/${taskId}?activeRole=${activeRole}`)}
                                  className="cursor-pointer text-xs"
                                >
                                  <Edit size={14} className="mr-2" /> Edit Task
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setCancelTaskId(taskId);
                                    setCancelReason("");
                                    setShowCancelModal(true);
                                  }}
                                  className="cursor-pointer text-xs text-rose-600 focus:text-rose-600"
                                >
                                  <XCircle size={14} className="mr-2" /> Cancel Task
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center">
              <div className="w-10 h-10 rounded-sm bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 size={20} />
              </div>
              <p className="text-sm font-semibold text-gray-700">
                All clear! No tasks for this view.
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Great job! You can create a new task or review upcoming deadlines.
              </p>
            </div>
          )}

          {/* Footer Link */}
          <div className="pt-2 border-t border-gray-100 mt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("manager-team-tasks-table");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
            >
              + View all team tasks
            </button>
            <span className="text-xs text-gray-400">
              Showing priority tasks
            </span>
          </div>
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
                          Team productivity
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
                      gradientId={`grad-${testId}`}
                    />
                  )}
                </div>
                <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-gray-200 to-transparent opacity-60" />
              </div>
            ),
          )}
        </div>

        {/* Team Hierarchy Section */}
        <div id="manager-team-hierarchy-section" className="mb-3">
          <OrganizationHierarchySection
            tasks={teamTasksData}
            teamMembers={teamMembers}
            currentUser={user}
            activeRole="manager"
          />
        </div>

        {/* Task Overview and Task Status Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mb-3">
          <div className="lg:col-span-7 h-[350px]">
            <TaskOverviewChart tasks={teamTasksData} overviewData={charts?.taskOverview} />
          </div>
          <div className="lg:col-span-5 h-[350px]">
            <TaskStatusDonut
              tasks={teamTasksData}
              totalTasks={teamStatsForHeader.totalTasks}
              openCount={teamStatsForHeader.openTasks}
              inProgressCount={teamStatsForHeader.inProgressTasks}
              completedCount={teamStatsForHeader.completedTasks}
              overdueCount={teamStatsForHeader.overdueTasks}
            />
          </div>
        </div>

        {/* MODERN GRAPHS SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
          <div className="bg-white rounded-sm shadow-sm border border-gray-100 flex flex-col h-[360px] overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
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
            <div className="p-4 flex-1 min-h-0 flex items-center justify-center">
              <ReactECharts option={efficiencyPie} style={{ height: "100%", width: "100%" }} />
            </div>
          </div>

          <div className="bg-white rounded-sm shadow-sm border border-gray-100 flex flex-col h-[360px] overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
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
            <div className="p-4 flex-1 min-h-0 flex items-center justify-center">
              <ReactECharts option={workloadStacked} style={{ height: "100%", width: "100%" }} />
            </div>
          </div>
        </div>

        {/* MILESTONES & PERFORMANCE GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
          <div className="bg-white rounded-sm shadow-sm border border-gray-100 flex flex-col h-[320px] overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center">
                <CheckSquare className="w-4 h-4 mr-2 text-emerald-500" />
                Milestones Progress
              </h2>
              {projectStats.length > 0 && (
                <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-sm">
                  {projectStats.length}
                </span>
              )}
            </div>
            <div className="p-4 flex-1 overflow-y-auto min-h-0 space-y-3 pr-2 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent]">
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
                <div className="text-center py-6 flex flex-col items-center justify-center h-full">
                  <Target className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No milestones yet</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-sm shadow-sm border border-gray-100 flex flex-col h-[320px] overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center">
                <BarChart3 className="w-4 h-4 mr-2 text-emerald-500" />
                Weekly Performance
              </h3>
            </div>
            <div className="p-4 flex-1 overflow-y-auto min-h-0 pr-2 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent]">
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
                    count: teamTasks.filter((t) => {
                      const today = new Date();
                      const localNowIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
                      const isCreated =
                        (t.createdAt && new Date(t.createdAt).toDateString() === today.toDateString()) ||
                        String(t.createdAt || "").startsWith(localNowIso) ||
                        String(t.createdAt || "").startsWith(today.toISOString().split("T")[0]);
                      const isDue =
                        (t.dueDate && new Date(t.dueDate).toDateString() === today.toDateString()) ||
                        String(t.dueDate || "").startsWith(localNowIso) ||
                        String(t.dueDate || "").startsWith(today.toISOString().split("T")[0]);
                      return isCreated || isDue;
                    }).length,
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
          <div id="manager-team-tasks-table" className="overflow-x-auto">
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
      {/* Cancel Task Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-sm shadow-xl overflow-hidden max-w-md w-full border border-gray-200 animate-in fade-in zoom-in-95 duration-200 flex flex-col font-sans">
            {/* Header */}
            <div className="px-6 pt-3.5 pb-2.5 border-b border-gray-200 bg-gray-50/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                <span
                  className="text-xl font-normal"
                  style={{ color: "#676a6c" }}
                >
                  Cancel Task
                </span>
              </div>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 transition-colors w-6 h-6 flex items-center justify-center text-base cursor-pointer"
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason("");
                  setCancelTaskId(null);
                }}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-3.5 bg-white">
              <p className="text-xs text-gray-500 font-normal">
                Are you sure you want to cancel this task? Please provide a
                reason below.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                  Reason for cancellation{" "}
                  <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Provide cancellation reason..."
                  className="w-full p-2.5 border border-gray-300 rounded-sm text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[90px] resize-none bg-white text-gray-900 placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason("");
                  setCancelTaskId(null);
                }}
                className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium h-8 px-4 rounded-sm !h-8 cursor-pointer"
                style={{ height: "32px", minHeight: "32px" }}
              >
                Go Back
              </Button>
              <Button
                type="button"
                onClick={handleConfirmCancelTask}
                disabled={!cancelReason.trim() || isCancelling}
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium h-8 px-4 rounded-sm shadow-sm disabled:opacity-50 !h-8 cursor-pointer"
                style={{ height: "32px", minHeight: "32px" }}
              >
                {isCancelling ? "Cancelling..." : "Confirm Cancel"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerDashboard;
