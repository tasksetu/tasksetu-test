import React, { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Calendar,
  CheckSquare,
  Clock,
  AlertTriangle,
  Star,
  MoreHorizontal,
  Edit,
  Trash2,
  Activity,
  Zap,
  TrendingUp,
  Flame,
  ArrowUpRight,
  Sliders,
  RefreshCw,
  FileText,
  Sun,
  CheckCircle2,
  XCircle,
  X,
  ListChecks,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/shared/hooks/useAuth";
import { useShowToast } from "../utils/ToastMessage";
import { useAggregatedDashboard } from "./hooks/useAggregatedDashboard";
import TaskOverviewChart from "./components/TaskOverviewChart";
import TaskStatusDonut from "./components/TaskStatusDonut";
import KpiSparkline from "./components/KpiSparkline";
import CreateTask from "../pages/newComponents/CreateTask";
import CustomConfirmationModal from "@/pages/newComponents/CustomConfirmationModal";

/**
 * Format relative time (e.g. "2 hours ago", "Yesterday")
 */
function formatRelativeTime(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffHour < 1) return `${Math.max(diffMin, 1)}m ago`;
  if (diffHour < 24) return `${diffHour} hours ago`;
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay} days ago`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/**
 * Format due date & time cleanly
 */
function formatDueDateTime(dateString) {
  if (!dateString || dateString === "No due date") return "No deadline";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  const now = new Date();
  const isSameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    d.getDate() === tomorrow.getDate() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getFullYear() === tomorrow.getFullYear();

  const timeStr = d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  if (isSameDay) return `Today, ${timeStr}`;
  if (isTomorrow) return `Tomorrow, ${timeStr}`;

  return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}${
    d.getHours() !== 0 || d.getMinutes() !== 0 ? `, ${timeStr}` : ""
  }`;
}

/**
 * Employee Dashboard Redesign
 * Configured with rounded-sm on all cards to maintain the crisp, modern TaskSetu design system.
 */
export default function EmployeeDashboard({ activeRole: propActiveRole, forcedRole } = {}) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { showSuccessToast, showErrorToast } = useShowToast();

  const effectiveRole =
    propActiveRole ||
    forcedRole ||
    (user?.role === "individual" ? "individual" : "employee");

  // 1. Data Fetching via Aggregated Service Hook
  const {
    isLoading,
    error,
    refetch,
    kpis,
    charts,
    taskList: rawTaskList = [],
    focusSections,
    invalidateDashboard,
  } = useAggregatedDashboard({ activeRole: effectiveRole, timeRange: "7d" });

  // 2. Local State
  const [focusTab, setFocusTab] = useState("today");
  const [taskListStatusFilter, setTaskListStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTaskType, setCreateTaskType] = useState("regular");
  const [deleteTaskId, setDeleteTaskId] = useState(null);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTaskId, setCancelTaskId] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  // Normalization helper for statuses
  const normalizeStatus = (status) => (status || "OPEN").toUpperCase();

  // Helper to determine if a task is overdue
  const isTaskOverdue = useCallback((t) => {
    if (t.isPastDue !== undefined) return Boolean(t.isPastDue);
    if (!t.dueDate || t.dueDate === "No due date") return false;
    const s = normalizeStatus(t.status);
    if (["DONE", "COMPLETED", "CANCELLED", "REJECTED", "ONHOLD", "ON_HOLD", "HOLD"].includes(s)) return false;
    const d = new Date(t.dueDate);
    if (isNaN(d.getTime())) return false;
    return d < new Date();
  }, []);

  // Helper to determine if a task is due today
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

  // Current tasks list
  const tasks = useMemo(() => {
    return Array.isArray(rawTaskList) ? rawTaskList : [];
  }, [rawTaskList]);

  // Dynamic Today Focus lists
  const todayFocusLists = useMemo(() => {
    const todayList = [];
    const overdueList = [];
    const upcomingList = [];
    const waitingList = [];

    const now = new Date();

    tasks.forEach((t) => {
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
  }, [tasks, isTaskOverdue, isTaskDueToday]);

  // Filter tasks based on the active Today Focus tab
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

  // Overall counts for KPI Cards
  const calculatedStats = useMemo(() => {
    const total = kpis?.totalTasks ?? tasks.length;
    let completed = 0;
    let inProgress = 0;
    let overdue = 0;

    tasks.forEach((t) => {
      const s = normalizeStatus(t.status);
      if (["DONE", "COMPLETED"].includes(s)) completed++;
      else if (["INPROGRESS", "IN_PROGRESS"].includes(s)) inProgress++;
      if (isTaskOverdue(t)) overdue++;
    });

    const finalCompleted = kpis?.completedTasks ?? completed;
    const finalInProgress = kpis?.inProgressTasks ?? inProgress;
    const finalOverdue = kpis?.overdueTasks ?? overdue;
    const progressPercent =
      kpis?.thisWeekProgress ??
      (total > 0 ? Math.round((finalCompleted / total) * 100) : 0);
    const weeklyCompleted = kpis?.weeklyCompleted ?? finalCompleted;
    const weeklyTotal = kpis?.weeklyTotal ?? total;
    const streakDays = kpis?.taskStreak ?? (finalCompleted > 0 ? 4 : 0);

    return {
      total,
      completed: finalCompleted,
      inProgress: finalInProgress,
      overdue: finalOverdue,
      progressPercent,
      weeklyCompleted,
      weeklyTotal,
      streakDays,
    };
  }, [kpis, tasks, isTaskOverdue]);

  // Filtered tasks for Section G: My Task List
  const filteredMainTasks = useMemo(() => {
    return tasks.filter((t) => {
      const s = normalizeStatus(t.status);
      const isDone = ["DONE", "COMPLETED"].includes(s);
      const isOverdue = isTaskOverdue(t);
      const isDueToday = isTaskDueToday(t);

      // Status filter pill
      if (taskListStatusFilter === "today" && (!isDueToday || isDone)) return false;
      if (taskListStatusFilter === "overdue" && !isOverdue) return false;
      if (
        taskListStatusFilter === "inprogress" &&
        !["INPROGRESS", "IN_PROGRESS"].includes(s)
      )
        return false;
      if (taskListStatusFilter === "completed" && !isDone) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (t.title || "").toLowerCase().includes(q);
        const tagMatch = Array.isArray(t.tags)
          ? t.tags.some((tag) => String(tag).toLowerCase().includes(q))
          : false;
        const typeMatch = (t.taskType || "").toLowerCase().includes(q);
        if (!titleMatch && !tagMatch && !typeMatch) return false;
      }

      return true;
    });
  }, [tasks, taskListStatusFilter, searchQuery, isTaskOverdue, isTaskDueToday]);

  // Main task list counts
  const mainListCounts = useMemo(() => {
    let all = tasks.length;
    let today = 0;
    let overdue = 0;
    let inProgress = 0;
    let completed = 0;

    tasks.forEach((t) => {
      const s = normalizeStatus(t.status);
      const isDone = ["DONE", "COMPLETED"].includes(s);
      if (isTaskDueToday(t) && !isDone) today++;
      if (isTaskOverdue(t)) overdue++;
      if (["INPROGRESS", "IN_PROGRESS"].includes(s)) inProgress++;
      if (isDone) completed++;
    });

    return { all, today, overdue, inProgress, completed };
  }, [tasks, isTaskDueToday, isTaskOverdue]);

  // Secondary sections
  const continueWorkingTasks = useMemo(() => {
    if (focusSections?.continueWorking && focusSections.continueWorking.length > 0) {
      return focusSections.continueWorking.slice(0, 3);
    }
    return tasks
      .filter((t) => ["INPROGRESS", "IN_PROGRESS"].includes(normalizeStatus(t.status)))
      .slice(0, 3);
  }, [focusSections, tasks]);

  const atRiskTasks = useMemo(() => {
    if (focusSections?.atRiskTasks && focusSections.atRiskTasks.length > 0) {
      return focusSections.atRiskTasks.slice(0, 3);
    }
    return tasks.filter((t) => isTaskOverdue(t) || t.isRisk).slice(0, 3);
  }, [focusSections, tasks, isTaskOverdue]);

  const recentlyCompletedTasks = useMemo(() => {
    if (focusSections?.recentlyCompleted && focusSections.recentlyCompleted.length > 0) {
      return focusSections.recentlyCompleted.slice(0, 3);
    }
    return tasks
      .filter((t) => ["DONE", "COMPLETED"].includes(normalizeStatus(t.status)))
      .slice(0, 3);
  }, [focusSections, tasks]);

  const upcomingTasks = useMemo(() => {
    if (focusSections?.upcoming && focusSections.upcoming.length > 0) {
      return focusSections.upcoming.slice(0, 3);
    }
    return todayFocusLists.upcomingList.slice(0, 3);
  }, [focusSections, todayFocusLists]);

  const longPendingTasks = useMemo(() => {
    if (focusSections?.longPendingTasks && focusSections.longPendingTasks.length > 0) {
      return focusSections.longPendingTasks.slice(0, 3);
    }
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    return tasks
      .filter((t) => {
        const s = normalizeStatus(t.status);
        const isOpen = ["OPEN", "PENDING", "TODO"].includes(s);
        const created = t.createdAt ? new Date(t.createdAt) : null;
        return isOpen && (!created || created < twoDaysAgo);
      })
      .slice(0, 3);
  }, [focusSections, tasks]);

  // Handlers for task actions
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
        navigate(`/tasks/${taskId}`);
      } else {
        navigate(`/tasks/${taskId}`);
      }
    } catch {
      navigate(`/tasks/${taskId}`);
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
          notes: cancelReason.trim(),
          reason: cancelReason.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        showSuccessToast(
          data.requiresApproval
            ? "Cancellation request submitted for approval"
            : "Task cancelled successfully"
        );
        setShowCancelModal(false);
        setCancelReason("");
        setCancelTaskId(null);
        invalidateDashboard();
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

  const handleDeleteTask = async (taskId) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/tasks/delete/${taskId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        showSuccessToast("Task deleted successfully");
        invalidateDashboard();
        queryClient.invalidateQueries({ queryKey: ["/api/mytasks"] });
      } else {
        showErrorToast("Failed to delete task");
      }
    } catch (err) {
      showErrorToast(err.message || "Error deleting task");
    }
  };

  // Greeting helper
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  // Priority badge styling
  const renderPriorityBadge = (priority) => {
    const p = (priority || "medium").toLowerCase();
    if (p === "high" || p === "urgent") {
      return (
        <span className="inline-flex items-center text-rose-600 bg-rose-50 border border-rose-200 text-[11px] font-semibold px-2 py-0.5 rounded-sm">
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

  // Status badge styling - displays the actual task status with dedicated styles
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

    // Fallback: format and display the actual status label
    const displayLabel = String(raw).replace(/_/g, " ");
    return (
      <span className="inline-flex items-center bg-gray-100 text-gray-700 border border-gray-200 text-[11px] font-semibold px-2.5 py-0.5 rounded-sm uppercase tracking-wider">
        {displayLabel}
      </span>
    );
  };

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Dynamic Task Streak Calculation
  const taskStreak = useMemo(() => {
    const completedTasks = tasks.filter((t) => {
      const s = normalizeStatus(t.status);
      return ["COMPLETED", "DONE"].includes(s);
    });

    if (completedTasks.length === 0) {
      return {
        streak: 0,
        todayDone: 0,
      };
    }

    const completedDates = [
      ...new Set(
        completedTasks.map((t) => {
          const date = t.completedAt || t.completedDate || t.updatedAt || t.createdAt;
          return new Date(date).toISOString().split("T")[0];
        }),
      ),
    ].sort((a, b) => new Date(b) - new Date(a));

    let streak = 0;
    const currentDate = new Date();

    while (true) {
      const checkDate = new Date(currentDate);
      checkDate.setDate(currentDate.getDate() - streak);
      const formatted = checkDate.toISOString().split("T")[0];

      if (completedDates.includes(formatted)) {
        streak++;
      } else {
        break;
      }
    }

    const todayDone = completedTasks.filter((t) => {
      const date = t.completedAt || t.completedDate || t.updatedAt || t.createdAt;
      return new Date(date).toISOString().split("T")[0] === todayStr;
    }).length;

    return {
      streak,
      todayDone,
    };
  }, [tasks, todayStr]);

  // Dynamic Weekly Progress Calculation
  const weeklyProgress = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const weekTasks = tasks.filter((t) => {
      const taskDate = t.dueDate || t.createdAt;
      if (!taskDate) return false;
      const date = new Date(taskDate);
      return date >= startOfWeek && date <= endOfWeek;
    });

    const weekCompletedTasks = weekTasks.filter((t) => {
      const s = normalizeStatus(t.status);
      return ["COMPLETED", "DONE"].includes(s);
    });

    return {
      total: weekTasks.length,
      completed: weekCompletedTasks.length,
      percentage:
        weekTasks.length === 0
          ? 0
          : (weekCompletedTasks.length / weekTasks.length) * 100,
      startOfWeek,
      endOfWeek,
    };
  }, [tasks]);

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

    const totalTrend = days.map(
      (day) =>
        tasks.filter(
          (t) => t.createdAt && isSameDate(new Date(t.createdAt), day),
        ).length,
    );

    const completedTrend = days.map(
      (day) =>
        tasks.filter((t) => {
          const cd =
            t.completedDate ||
            t.completedAt ||
            (["DONE", "COMPLETED"].includes(normalizeStatus(t.status))
              ? t.updatedAt
              : null);
          return cd && isSameDate(new Date(cd), day);
        }).length,
    );

    const inProgressTrend = days.map((day) => {
      return tasks.filter((t) => {
        const s = (t.status || "").toLowerCase();
        if (!["in_progress", "in-progress", "inprogress", "doing"].includes(s))
          return false;
        const cr = t.createdAt ? new Date(t.createdAt) : null;
        return cr ? cr <= day : true;
      }).length;
    });

    const overdueTrend = days.map(
      (day) =>
        tasks.filter((t) => {
          if (!t.dueDate) return false;
          const dd = new Date(t.dueDate);
          const isDone = ["DONE", "COMPLETED"].includes(normalizeStatus(t.status));
          return dd <= day && !isDone;
        }).length,
    );

    return {
      total: totalTrend,
      completed: completedTrend,
      inProgress: inProgressTrend,
      overdue: overdueTrend,
    };
  }, [tasks]);

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

  // ─── KPI CARDS CONFIG ─────────────────────────────────────────────────────
  const kpiCards = useMemo(
    () => [
      {
        label: "Total Tasks",
        value: calculatedStats.total,
        icon: ListChecks,
        iconColor: "text-blue-600",
        iconBg: "bg-blue-50",
        testId: "card-total-tasks",
        onClick: () => {
          setTaskListStatusFilter("all");
          const el = document.getElementById("my-task-list-section");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        },
        sparklineType: "bars",
        sparklineColor: "#3b82f6",
        sparklineData: kpiTrends.total,
      },
      {
        label: "Completed",
        value: calculatedStats.completed,
        icon: CheckSquare,
        iconColor: "text-green-600",
        iconBg: "bg-green-50",
        testId: "card-completed",
        onClick: () => {
          setTaskListStatusFilter("completed");
          const el = document.getElementById("my-task-list-section");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        },
        sparklineType: "line",
        sparklineColor: "#10b981",
        gradientId: "spark-grad-completed",
        sparklineData: kpiTrends.completed,
      },
      {
        label: "In Progress",
        value: calculatedStats.inProgress,
        icon: Clock,
        iconColor: "text-yellow-600",
        iconBg: "bg-yellow-50",
        testId: "card-pending",
        onClick: () => {
          setTaskListStatusFilter("inprogress");
          const el = document.getElementById("my-task-list-section");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        },
        sparklineType: "line",
        sparklineColor: "#f59e0b",
        gradientId: "spark-grad-inprogress",
        sparklineData: kpiTrends.inProgress,
      },
      {
        label: "Overdue",
        value: calculatedStats.overdue,
        icon: AlertTriangle,
        iconColor: "text-red-600",
        iconBg: "bg-red-50",
        testId: "card-overdue",
        onClick: () => {
          setTaskListStatusFilter("overdue");
          const el = document.getElementById("my-task-list-section");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        },
        sparklineType: "bars",
        sparklineColor: "#ef4444",
        sparklineData: kpiTrends.overdue,
      },
      {
        label: "This Week Progress",
        value:
          weeklyProgress.total === 0
            ? "0%"
            : `${Math.round(weeklyProgress.percentage)}%`,
        icon: TrendingUp,
        iconColor: "text-indigo-600",
        iconBg: "bg-indigo-50",
        testId: "card-weekly-progress",
        onClick: () => {
          const el = document.getElementById("my-task-list-section");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        },
        isProgressCard: true,
        weeklyTotal: weeklyProgress.total,
        weeklyCompleted: weeklyProgress.completed,
        percentage: weeklyProgress.percentage,
      },
      {
        label: "Task Streak",
        value: (
          <div className="flex items-end gap-1">
            <span className="text-[30px] font-bold leading-none">
              {taskStreak.streak}
            </span>
            <span className="text-[13px] font-semibold mb-[3px]">days</span>
          </div>
        ),
        icon: Flame,
        iconColor: "text-orange-600",
        iconBg: "bg-orange-50",
        testId: "card-task-streak",
        onClick: () => {
          setTaskListStatusFilter("completed");
          const el = document.getElementById("my-task-list-section");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        },
        isStreakCard: true,
        streak: taskStreak.streak,
      },
    ],
    [calculatedStats, kpiTrends, weeklyProgress, taskStreak],
  );

  // Loading skeleton state
  if (isLoading && !tasks.length) {
    return (
      <div className="p-6 space-y-5 animate-pulse max-w-[1700px] mx-auto">
        <div className="h-24 bg-white rounded-sm border border-gray-200/80 shadow-sm" />
        <div className="h-64 bg-white rounded-sm border border-gray-200/80 shadow-sm" />
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-sm border border-gray-200/80 shadow-sm" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 h-80 bg-white rounded-sm border border-gray-200/80 shadow-sm" />
          <div className="lg:col-span-5 h-80 bg-white rounded-sm border border-gray-200/80 shadow-sm" />
        </div>
      </div>
    );
  }

  // Error state with retry
  if (error && !tasks.length) {
    return (
      <div className="p-8 max-w-lg mx-auto mt-12 bg-white rounded-sm border border-rose-200 shadow-sm text-center">
        <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-sm flex items-center justify-center mx-auto mb-3">
          <AlertTriangle size={24} />
        </div>
        <h3 className="text-lg font-bold text-gray-800">Failed to load dashboard</h3>
        <p className="text-sm text-gray-500 mt-1 mb-4">{error.message || "Unknown error occurred"}</p>
        <Button onClick={() => refetch()} className="bg-blue-600 hover:bg-blue-700 text-white rounded-sm">
          <RefreshCw size={14} className="mr-1.5" /> Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5 max-w-[1700px] mx-auto text-[#1f2937] transition-all">
      {/* ══════════════════════════════════════════════════════════════
          SECTION A: WELCOME HEADER
      ══════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-sm border border-gray-200/80 shadow-sm p-3.5 sm:p-4 md:p-5 flex items-center justify-between gap-3 sm:gap-4 md:gap-6">
        {/* Left: Greeting & Workload */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-sm bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0 shadow-xs">
            <Sun size={20} className="text-amber-500 fill-amber-400 sm:w-[22px] sm:h-[22px]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 tracking-tight leading-tight truncate">
              {greeting},{" "}
              <span className="text-blue-600">
                {user?.firstName || user?.name || (effectiveRole === "individual" ? "User" : "Employee")}
              </span>
            </h1>
            <p className="text-xs md:text-sm text-gray-500 mt-0.5 leading-tight truncate">
              {todayFocusLists.todayList.length > 0 ? (
                <>
                  You have{" "}
                  <span className="font-semibold text-gray-800">
                    {todayFocusLists.todayList.length}
                  </span>{" "}
                  tasks to focus on today.
                </>
              ) : (
                "You're all caught up for today. Check your upcoming tasks."
              )}
            </p>
          </div>
        </div>

        {/* Right: Day progress & Motivation */}
        <div className="flex items-center gap-3 sm:gap-4 md:gap-5 flex-shrink-0">
          {/* Progress Box */}
          <div className="flex items-center gap-2.5 sm:gap-3 border-r border-gray-200 pr-3 sm:pr-4 md:pr-5">
            <div className="relative w-11 h-11 sm:w-13 sm:h-13 md:w-14 md:h-14 flex-shrink-0">
              <svg viewBox="0 0 44 44" className="w-11 h-11 sm:w-13 sm:h-13 md:w-14 md:h-14 -rotate-90">
                {/* Background */}
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="4"
                />

                {/* Progress */}
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  fill="none"
                  stroke="#14b8a6"
                  strokeWidth="4"
                  strokeDasharray={`${
                    (calculatedStats.progressPercent / 100) * 113
                  } 113`}
                  strokeLinecap="round"
                />
              </svg>

              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs sm:text-sm font-bold text-gray-800">
                  {calculatedStats.progressPercent}%
                </span>
              </div>
            </div>

            <div>
              <p className="text-[11px] sm:text-xs text-gray-400 font-medium leading-none">
                Day progress
              </p>

              <p className="text-xs sm:text-sm font-semibold text-gray-700 mt-1 leading-none whitespace-nowrap">
                {calculatedStats.progressPercent >= 80
                  ? "Excellent"
                  : calculatedStats.progressPercent >= 50
                    ? "On Track"
                    : "Keep Going"}
              </p>
            </div>
          </div>

          {/* Motivation */}
          <div className="max-w-[130px] sm:max-w-[160px] md:max-w-[180px]">
            <p className="text-xs sm:text-sm font-medium text-gray-700 leading-tight">
              {calculatedStats.progressPercent <= 20
                ? "Let's get started 🚀"
                : calculatedStats.progressPercent <= 50
                  ? "Small progress every day ✨"
                  : calculatedStats.progressPercent <= 80
                    ? "You're doing great 🔥"
                    : "Outstanding productivity 🏆"}
            </p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION B: TODAY FOCUS — HIGHEST PRIORITY
      ══════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-sm border border-gray-200/80 shadow-sm p-4 md:p-5">
        {/* Header row with Tab Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Star size={16} className="text-amber-500 fill-amber-400 flex-shrink-0" />
            <h2 className="text-xs md:text-sm font-bold uppercase tracking-wider text-gray-800">
              TODAY FOCUS
            </h2>
            <span className="text-xs font-medium text-gray-400">
              ({activeFocusTasks.length} tasks)
            </span>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
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
                task.tags?.[0] || task.category || task.taskType || "employee_task";

              return (
                <div
                  key={taskId}
                  className="py-3 px-2 hover:bg-slate-50/70 rounded-sm transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm group"
                >
                  {/* Left: Checkbox, Priority, Title, Tag */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
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
                      onClick={() => navigate(`/tasks/${taskId}`)}
                      className={`font-semibold text-gray-800 text-sm hover:text-blue-600 cursor-pointer truncate ${
                        isDone ? "line-through text-gray-400" : ""
                      }`}
                      title={task.title}
                    >
                      {task.title}
                    </span>

                    {/* Tag badge */}
                    <span className="hidden sm:inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-sm font-normal whitespace-nowrap flex-shrink-0">
                      {tag}
                    </span>
                  </div>

                  {/* Middle: Due Time, Status Badge, Progress */}
                  <div className="flex items-center gap-4 flex-shrink-0 justify-between sm:justify-start">
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
                    <div className="hidden lg:flex items-center gap-2 w-28 flex-shrink-0">
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
                          onClick={() => navigate(`/tasks/${taskId}`)}
                          className="border border-blue-600 text-blue-600 hover:bg-blue-50 text-xs font-semibold px-3 py-1 rounded-sm transition-colors cursor-pointer"
                        >
                          Continue
                        </button>
                      ) : normalizeStatus(task.status) === "PENDING" ? (
                        <button
                          onClick={() => navigate(`/tasks/${taskId}`)}
                          className="border border-blue-600 text-blue-600 hover:bg-blue-50 text-xs font-semibold px-3 py-1 rounded-sm transition-colors cursor-pointer"
                        >
                          Update
                        </button>
                      ) : !isDone ? (
                        <button
                          onClick={() => handleStartTask(task)}
                          className="border border-blue-600 text-blue-600 hover:bg-blue-50 text-xs font-semibold px-3 py-1 rounded-sm transition-colors cursor-pointer"
                        >
                          Start
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate(`/tasks/${taskId}`)}
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
                            onClick={() => navigate(`/tasks/${taskId}`)}
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
                                onClick={() => navigate(`/tasks/${taskId}`)}
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
        <div className="pt-2 border-t border-gray-100 mt-2">
          <button
            onClick={() => {
              setTaskListStatusFilter("today");
              const el = document.getElementById("my-task-list-section");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
          >
            + View all today&apos;s tasks
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION C: EMPLOYEE KPI CARDS (6 COMPACT CARDS)
      ══════════════════════════════════════════════════════════════ */}
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
            weeklyCompleted,
            weeklyTotal,
            sparklineType,
            sparklineColor,
            sparklineData,
            gradientId,
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
                  <div className="text-[30px] font-bold text-[#1f2937] tracking-tight leading-none mt-2">
                    {extractVal(value)}
                  </div>
                </div>
                <div
                  className={`w-10 h-10 flex items-center justify-center flex-shrink-0 shadow-sm border border-white/50 rounded-sm ${iconBg}`}
                >
                  <Icon className={iconColor} size={15} />
                </div>
              </div>
              <div className="mt-auto pt-1 w-full opacity-95">
                {label === "This Week Progress" || isProgressCard ? (
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
                        {weeklyCompleted}/{weeklyTotal} done
                      </span>
                      <span className="text-[#4f46e5] font-bold">
                        {Math.round(percentage || 0)}%
                      </span>
                    </div>
                  </div>
                ) : label === "Task Streak" ? (
                  <svg
                    viewBox="0 0 110 45"
                    width="100%"
                    height="45"
                    preserveAspectRatio="none"
                  >
                    {/* Flame Bars */}
                    {[12, 18, 26, 20, 32, 24, 30].map((h, i) => (
                      <rect
                        key={i}
                        x={i * 15 + 2}
                        y={38 - h}
                        width="10"
                        height={h}
                        rx="3"
                        fill={i % 2 === 0 ? "#fb923c" : "#f97316"}
                        opacity={i <= taskStreak.streak ? 1 : 0.25}
                      />
                    ))}
                  </svg>
                ) : (
                  <KpiSparkline
                    type={sparklineType || "bars"}
                    color={sparklineColor || "#3b82f6"}
                    gradientId={gradientId || "spark-grad"}
                    data={sparklineData || [0, 0, 0, 0, 0, 0, 0]}
                    height={38}
                  />
                )}
              </div>
              <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-gray-200 to-transparent opacity-60" />
            </div>
          ),
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION D: TASK OVERVIEW & TASK STATUS CHARTS
      ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Task Overview Chart */}
        <div className="lg:col-span-7 h-[370px]">
          <TaskOverviewChart tasks={tasks} overviewData={charts?.taskOverview} />
        </div>

        {/* Right: Task Status Donut */}
        <div className="lg:col-span-5 h-[370px]">
          <TaskStatusDonut
            tasks={tasks}
            totalTasks={calculatedStats.total}
            openCount={calculatedStats.total - calculatedStats.completed - calculatedStats.inProgress}
            inProgressCount={calculatedStats.inProgress}
            completedCount={calculatedStats.completed}
            overdueCount={calculatedStats.overdue}
          />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION E: CONTINUE WORKING, AT RISK TASKS, QUICK TASKS
      ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Continue Working */}
        <div className="bg-white rounded-sm border border-gray-200/80 shadow-sm p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                <Activity size={14} className="text-blue-600" /> CONTINUE WORKING
              </h3>
              <button
                onClick={() => setTaskListStatusFilter("inprogress")}
                className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                View all
              </button>
            </div>

            {continueWorkingTasks.length > 0 ? (
              <div className="space-y-3">
                {continueWorkingTasks.map((t) => (
                  <div
                    key={t._id || t.id}
                    onClick={() => navigate(`/tasks/${t._id || t.id}`)}
                    className="p-2.5 rounded-sm hover:bg-slate-50 transition-colors cursor-pointer border border-transparent hover:border-gray-100"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-800 truncate flex-1">
                        {t.title}
                      </p>
                      <span className="text-xs font-bold text-gray-700">
                        {t.progress || 0}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-blue-600 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600" /> In Progress
                      </span>
                      <span className="text-xs text-gray-400">
                        {t.tags?.[0] || t.category || "Development"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-gray-400">
                No active tasks to continue
              </div>
            )}
          </div>
        </div>

        {/* 2. At Risk Tasks */}
        <div className="bg-white rounded-sm border border-gray-200/80 shadow-sm p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-rose-500" /> AT RISK TASKS
              </h3>
              <button
                onClick={() => setTaskListStatusFilter("overdue")}
                className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                View all
              </button>
            </div>

            {atRiskTasks.length > 0 ? (
              <div className="space-y-3">
                {atRiskTasks.map((t) => {
                  const overdue = isTaskOverdue(t);
                  return (
                    <div
                      key={t._id || t.id}
                      onClick={() => navigate(`/tasks/${t._id || t.id}`)}
                      className="p-2.5 rounded-sm hover:bg-slate-50 transition-colors cursor-pointer border border-transparent hover:border-gray-100"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-800 truncate flex-1">
                          {t.title}
                        </p>
                        {renderPriorityBadge(t.priority)}
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs">
                        <span className="text-gray-400">
                          {t.tags?.[0] || t.category || "Design"}
                        </span>
                        <span
                          className={`font-semibold ${
                            overdue ? "text-rose-600" : "text-amber-600"
                          }`}
                        >
                          {overdue ? "Overdue" : "Due soon"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center">
                <div className="w-8 h-8 rounded-sm bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 size={16} />
                </div>
                <p className="text-xs font-bold text-emerald-700">
                  All tasks on track! ✓
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  No tasks are currently at risk
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 3. Quick Tasks - 2x2 Action Tiles */}
        <div className="bg-white rounded-sm border border-gray-200/80 shadow-sm p-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
              <Zap size={14} className="text-purple-600" /> QUICK TASKS
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Tile 1: New Task */}
            <div
              onClick={() => {
                setCreateTaskType("regular");
                setShowCreateModal(true);
              }}
              className="p-3.5 rounded-sm border border-gray-100 bg-slate-50/60 hover:bg-blue-50/40 hover:border-blue-200 transition-all cursor-pointer flex flex-col items-center justify-center text-center group"
            >
              <div className="w-9 h-9 rounded-sm bg-blue-100 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Plus size={18} />
              </div>
              <span className="text-xs font-bold text-gray-800">New Task</span>
            </div>

            {/* Tile 2: Quick Task */}
            <div
              onClick={() => navigate("/quick-tasks")}
              className="p-3.5 rounded-sm border border-gray-100 bg-slate-50/60 hover:bg-purple-50/40 hover:border-purple-200 transition-all cursor-pointer flex flex-col items-center justify-center text-center group"
            >
              <div className="w-9 h-9 rounded-sm bg-purple-100 text-purple-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Zap size={18} />
              </div>
              <span className="text-xs font-bold text-gray-800">Quick Task</span>
            </div>

            {/* Tile 3: Recurring Task */}
            <div
              onClick={() => navigate("/recurring")}
              className="p-3.5 rounded-sm border border-gray-100 bg-slate-50/60 hover:bg-emerald-50/40 hover:border-emerald-200 transition-all cursor-pointer flex flex-col items-center justify-center text-center group"
            >
              <div className="w-9 h-9 rounded-sm bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <RefreshCw size={18} />
              </div>
              <span className="text-xs font-bold text-gray-800">Recurring Task</span>
            </div>

            {/* Tile 4: From Template */}
            <div
              onClick={() => navigate("/form-library")}
              className="p-3.5 rounded-sm border border-gray-100 bg-slate-50/60 hover:bg-indigo-50/40 hover:border-indigo-200 transition-all cursor-pointer flex flex-col items-center justify-center text-center group"
            >
              <div className="w-9 h-9 rounded-sm bg-indigo-100 text-indigo-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <FileText size={18} />
              </div>
              <span className="text-xs font-bold text-gray-800">From Template</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION F: RECENTLY COMPLETED, UPCOMING, LONG PENDING TASKS
      ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Recently Completed */}
        <div className="bg-white rounded-sm border border-gray-200/80 shadow-sm p-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
              <CheckSquare size={14} className="text-emerald-600" /> RECENTLY COMPLETED
            </h3>
            <button
              onClick={() => setTaskListStatusFilter("completed")}
              className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              View all
            </button>
          </div>

          {recentlyCompletedTasks.length > 0 ? (
            <div className="space-y-3">
              {recentlyCompletedTasks.map((t) => (
                <div
                  key={t._id || t.id}
                  onClick={() => navigate(`/tasks/${t._id || t.id}`)}
                  className="p-2.5 rounded-sm hover:bg-slate-50 transition-colors cursor-pointer border border-transparent hover:border-gray-100"
                >
                  <p className="text-sm font-semibold text-gray-800 truncate mb-1">
                    {t.title}
                  </p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" /> Completed
                    </span>
                    <span className="text-gray-400">
                      {formatRelativeTime(t.completedDate || t.completedAt || t.updatedAt) || "Recently"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-gray-400">
              No completed tasks yet
            </div>
          )}
        </div>

        {/* 2. Upcoming */}
        <div className="bg-white rounded-sm border border-gray-200/80 shadow-sm p-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
              <Calendar size={14} className="text-blue-600" /> UPCOMING
            </h3>
            <button
              onClick={() => {
                setFocusTab("upcoming");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              View all
            </button>
          </div>

          {upcomingTasks.length > 0 ? (
            <div className="space-y-3">
              {upcomingTasks.map((t) => (
                <div
                  key={t._id || t.id}
                  onClick={() => navigate(`/tasks/${t._id || t.id}`)}
                  className="p-2.5 rounded-sm hover:bg-slate-50 transition-colors cursor-pointer border border-transparent hover:border-gray-100"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-800 truncate flex-1">
                      {t.title}
                    </p>
                    {renderPriorityBadge(t.priority)}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">
                      {t.tags?.[0] || t.category || "Design"}
                    </span>
                    <span className="text-rose-500 font-medium">
                      {formatDueDateTime(t.dueDate)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-gray-400">
              No upcoming deadlines
            </div>
          )}
        </div>

        {/* 3. Long Pending Tasks */}
        <div className="bg-white rounded-sm border border-gray-200/80 shadow-sm p-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
              <Clock size={14} className="text-amber-500" /> LONG PENDING TASKS
            </h3>
            <button
              onClick={() => setTaskListStatusFilter("all")}
              className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              View all
            </button>
          </div>

          {longPendingTasks.length > 0 ? (
            <div className="space-y-3">
              {longPendingTasks.map((t) => {
                const ageDays = t.createdAt
                  ? Math.max(
                      1,
                      Math.floor(
                        (Date.now() - new Date(t.createdAt).getTime()) /
                          (1000 * 60 * 60 * 24)
                      )
                    )
                  : 3;
                return (
                  <div
                    key={t._id || t.id}
                    onClick={() => navigate(`/tasks/${t._id || t.id}`)}
                    className="p-2.5 rounded-sm hover:bg-slate-50 transition-colors cursor-pointer border border-transparent hover:border-gray-100"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold text-gray-800 truncate flex-1">
                        {t.title}
                      </p>
                      {renderPriorityBadge(t.priority)}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">
                        {t.tags?.[0] || t.category || "General"}
                      </span>
                      <span className="text-rose-500 font-semibold">
                        {ageDays} days
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-emerald-700 font-semibold">
              ✓ No long pending tasks!
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION G: MY TASK LIST (DETAILED WORK-MANAGEMENT TABLE)
      ══════════════════════════════════════════════════════════════ */}
      <div
        id="my-task-list-section"
        className="bg-white rounded-sm border border-gray-200/80 shadow-sm p-4 md:p-5"
      >
        {/* Table Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 gap-3">
          <h2 className="text-sm md:text-base font-bold text-gray-900 uppercase tracking-tight">
            MY TASK LIST ({filteredMainTasks.length})
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/tasks")}
              className="border border-blue-600 text-blue-600 hover:bg-blue-50 text-xs font-semibold px-3 py-1.5 rounded-sm transition-colors cursor-pointer"
            >
              View All
            </button>
          </div>
        </div>

        {/* Search & Status Filter Pills */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mt-3.5 mb-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs md:text-sm border border-gray-200 rounded-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setTaskListStatusFilter("all")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-sm border transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                taskListStatusFilter === "all"
                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                  : "bg-gray-100 text-gray-700 border-transparent hover:bg-gray-200"
              }`}
            >
              All {mainListCounts.all}
            </button>
            <button
              onClick={() => setTaskListStatusFilter("today")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-sm border transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                taskListStatusFilter === "today"
                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                  : "bg-gray-100 text-gray-700 border-transparent hover:bg-gray-200"
              }`}
            >
              Today {mainListCounts.today}
            </button>
            <button
              onClick={() => setTaskListStatusFilter("overdue")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-sm border transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                taskListStatusFilter === "overdue"
                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                  : "bg-gray-100 text-gray-700 border-transparent hover:bg-gray-200"
              }`}
            >
              Overdue {mainListCounts.overdue}
            </button>
            <button
              onClick={() => setTaskListStatusFilter("inprogress")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-sm border transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                taskListStatusFilter === "inprogress"
                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                  : "bg-gray-100 text-gray-700 border-transparent hover:bg-gray-200"
              }`}
            >
              In Progress {mainListCounts.inProgress}
            </button>
            <button
              onClick={() => setTaskListStatusFilter("completed")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-sm border transition-colors duration-150 cursor-pointer whitespace-nowrap ${
                taskListStatusFilter === "completed"
                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                  : "bg-gray-100 text-gray-700 border-transparent hover:bg-gray-200"
              }`}
            >
              Completed {mainListCounts.completed}
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto rounded-sm border border-gray-100 mt-2">
          <table className="w-full text-left border-collapse text-xs md:text-sm">
            <thead>
              <tr className="bg-slate-50/80 text-gray-400 font-semibold text-[11px] uppercase tracking-wider border-b border-gray-100">
                <th className="py-2.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 rounded-sm border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="py-2.5 px-3">TASK</th>
                <th className="py-2.5 px-3">DUE DATE</th>
                <th className="py-2.5 px-3">PRIORITY</th>
                <th className="py-2.5 px-3">STATUS</th>
                <th className="py-2.5 px-3">PROGRESS</th>
                <th className="py-2.5 px-3 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredMainTasks.length > 0 ? (
                filteredMainTasks.slice(0, 15).map((task) => {
                  const taskId = task._id || task.id;
                  const isDone = ["DONE", "COMPLETED"].includes(
                    normalizeStatus(task.status)
                  );
                  const isCancelled = ["CANCELLED", "REJECTED"].includes(
                    normalizeStatus(task.status)
                  );
                  const isFinalStatus = isDone || isCancelled;
                  const isOverdue = isTaskOverdue(task);
                  const tag =
                    task.tags?.[0] || task.category || task.taskType || "task";

                  return (
                    <tr
                      key={taskId}
                      className="hover:bg-slate-50/60 transition-colors group"
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isDone}
                          disabled={isDone || updatingTaskId === taskId}
                          onChange={() => !isDone && handleToggleTaskStatus(task)}
                          className={`w-4 h-4 rounded-sm border-gray-300 text-blue-600 focus:ring-blue-500 ${
                            isDone ? "cursor-not-allowed opacity-80" : "cursor-pointer"
                          }`}
                        />
                      </td>

                      {/* Task Title & Tag */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2 max-w-sm">
                          <span
                            onClick={() => navigate(`/tasks/${taskId}`)}
                            className={`font-semibold text-gray-800 hover:text-blue-600 cursor-pointer truncate ${
                              isDone ? "line-through text-gray-400" : ""
                            }`}
                            title={task.title}
                          >
                            {task.title}
                          </span>
                          <span className="hidden sm:inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-sm font-normal whitespace-nowrap">
                            {tag}
                          </span>
                        </div>
                      </td>

                      {/* Due Date */}
                      <td className="py-3 px-3 whitespace-nowrap text-xs">
                        <span
                          className={
                            isOverdue
                              ? "text-rose-600 font-semibold"
                              : isTaskDueToday(task)
                              ? "text-amber-600 font-semibold"
                              : "text-gray-600"
                          }
                        >
                          {formatDueDateTime(task.dueDate)}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {renderPriorityBadge(task.priority)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {renderStatusBadge(task.status)}
                      </td>

                      {/* Progress */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2 w-24">
                          <div className="w-full bg-gray-100 rounded-sm h-1.5 overflow-hidden">
                            <div
                              className="bg-blue-600 h-1.5 rounded-sm"
                              style={{
                                width: `${Math.min(task.progress || 0, 100)}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">
                            {task.progress || 0}%
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 text-gray-400">
                          <button
                            onClick={() => navigate(`/tasks/${taskId}`)}
                            title="View Task Details"
                            className="p-1 hover:text-blue-600 rounded-sm transition-colors cursor-pointer"
                          >
                            <ArrowUpRight size={15} />
                          </button>
                          {!isFinalStatus && (
                            <>
                              <button
                                onClick={() => navigate(`/tasks/${taskId}`)}
                                title="Edit Task"
                                className="p-1 hover:text-blue-600 rounded-sm transition-colors cursor-pointer"
                              >
                                <Edit size={15} />
                              </button>
                              <button
                                onClick={() => {
                                  setCancelTaskId(taskId);
                                  setCancelReason("");
                                  setShowCancelModal(true);
                                }}
                                title="Cancel Task"
                                className="p-1 hover:text-rose-600 rounded-sm transition-colors cursor-pointer text-gray-400 hover:text-rose-600"
                              >
                                <XCircle size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-gray-400">
                    No tasks found matching your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MODALS & DRAWERS
      ══════════════════════════════════════════════════════════════ */}
      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-sm shadow-xl flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 bg-blue-600 text-white flex items-center justify-between">
              <h3 className="text-base font-bold">Create New Task</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-sm transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <CreateTask
                initialTaskType={createTaskType}
                drawer={false}
                onClose={() => setShowCreateModal(false)}
                onSubmit={() => {
                  setShowCreateModal(false);
                  showSuccessToast("Task created successfully!");
                  invalidateDashboard();
                  queryClient.invalidateQueries({ queryKey: ["/api/mytasks"] });
                }}
              />
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

      {/* Delete Confirmation Modal */}
      <CustomConfirmationModal
        isOpen={Boolean(deleteTaskId)}
        onClose={() => setDeleteTaskId(null)}
        onConfirm={() => {
          if (deleteTaskId) {
            handleDeleteTask(deleteTaskId);
            setDeleteTaskId(null);
          }
        }}
        type="danger"
        title="Delete Task"
        message="Are you sure you want to delete this task? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}
