import React, { useState, useMemo, useCallback } from "react";
import { quickTasksAPI } from "../api/quickTasksAPI";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import CustomConfirmationModal from "@/pages/newComponents/CustomConfirmationModal";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Search,
  Filter,
  Calendar,
  CheckSquare,
  Clock,
  AlertTriangle,
  Star,
  Users,
  Target,
  Bell,
  ChevronDown,
  MoreHorizontal,
  Edit,
  Trash2,
  X,
  Download,
  ListChecks,
  FileText,
  FileSpreadsheet,
  TrendingUp,
  Zap,
  RefreshCw,
  Activity,
  Crown,
  ArrowUpRight,
  Loader,
  Flame,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CreateTask from "../pages/newComponents/CreateTask";
import TasksCalendarView from "../pages/newComponents/TasksCalendarView";
import ReactECharts from "../components/ReactECharts";
import { useActiveRole } from "../components/RoleSwitcher";
import { useAuth } from "@/features/shared/hooks/useAuth";
import {
  RegularTaskIcon,
  RecurringTaskIcon,
  QuickTaskIcon,
  MilestoneTaskIcon,
  ApprovalTaskIcon,
} from "../components/common/TaskIcons";
import { useShowToast } from "../utils/ToastMessage";
import { useCalendar } from "../contexts/CalendarContext";

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

function getPriorityBadge(priority) {
  const p = (priority || "").toLowerCase();
  if (p === "high")
    return (
      <span className="px-2 py-0.5 text-xs font-medium border rounded-sm text-red-600 bg-red-50 border-red-200">
        High
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

/* ─── PLAN CONFIG ─────────────────────────────────────────────────────────── */
const PLAN_TIERS = ["free", "basic", "pro", "enterprise"];
const PLAN_LABELS = {
  free: "Free",
  basic: "Basic",
  pro: "Pro",
  enterprise: "Enterprise",
};
const PLAN_COLORS = {
  free: "text-gray-500 bg-gray-100",
  basic: "text-blue-600 bg-blue-100",
  pro: "text-purple-600 bg-purple-100",
  enterprise: "text-yellow-700 bg-yellow-100",
};

/* ─── COMPONENT ───────────────────────────────────────────────────────────── */
const IndividualDashboard = ({
  tasks = [],
  quickTasks = [],
  pinnedTasks = [],
  userStats = {},
}) => {
  const [, navigate] = useLocation();
  const { activeRole, setActiveRole } = useActiveRole();
  const { showSuccessToast, showErrorToast } = useShowToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ✅ Use calendar from context
  const { showCalendar: showCalendarView } = useCalendar();

  // Derive current plan from user object; default to "free"
  const currentPlan = (
    user?.plan ||
    user?.subscription?.plan ||
    "free"
  ).toLowerCase();
  const isTopTier = currentPlan === "enterprise";
  const nextPlan =
    PLAN_TIERS[
      Math.min(PLAN_TIERS.indexOf(currentPlan) + 1, PLAN_TIERS.length - 1)
    ];

  // ✅ FIX: activeRole ko useEffect ka wait mat karo — seedha derive karo
  const effectiveRole = activeRole || user?.role?.[0] || "employee";
  const token = localStorage.getItem("token");

  // ✅ FIX: useEffect sirf sync ke liye
  React.useEffect(() => {
    if (user?.role?.[0] && !activeRole) setActiveRole(user.role[0]);
  }, [user, activeRole, setActiveRole]);

  // ─── ALL API CALLS ──────────────────────────────────────────────
  const {
    data: tasksResponse,
    isLoading: isLoadingTasks,
    error: tasksError,
  } = useQuery({
    queryKey: ["/api/mytasks", effectiveRole],
    queryFn: async () => {
      const url = `/api/mytasks?page=1&limit=100&activeRole=${effectiveRole}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
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
      const data = await response.json();
      return data.success ? data.data : data;
    },
    enabled: !!token,
    retry: 2,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const {
    data: quickTasksData,
    isLoading: isLoadingQuickTasks,
    error: quickTasksError,
  } = useQuery({
    queryKey: ["/api/quick-tasks", effectiveRole],
    queryFn: async () => {
      if (!token) throw new Error("Authorization token not found.");
      const response = await fetch("/api/quick-tasks", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch quick tasks: ${response.status}`);
      }
      const data = await response.json();
      return data;
    },
    enabled: !!token,
    retry: 1,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const {
    data: dashboardStats,
    error: dashboardError,
    isLoading: dashboardLoading,
  } = useQuery({
    queryKey: ["/api/dashboard-stats", effectiveRole, user?.id],
    queryFn: async () => {
      if (!token) throw new Error("Authorization token not found.");
      const res = await fetch("/api/dashboard-stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401)
        throw new Error("Unauthorized: Please login again.");
      if (!res.ok)
        throw new Error(`Failed to fetch dashboard stats: ${res.status}`);
      const data = await res.json();
      return data.data;
    },
    retry: false,
    enabled: !!token,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const currentRole = effectiveRole;
  const allTasks =
    tasksResponse?.tasks || tasksResponse?.data || tasksResponse || [];
  const [localTasks, setLocalTasks] = useState(null);
  const currentTasks = localTasks ?? (allTasks.length > 0 ? allTasks : tasks);

  const [quickTaskInput, setQuickTaskInput] = useState("");
  const [isCreatingQuickTask, setIsCreatingQuickTask] = useState(false);
  const [quickTaskSuccess, setQuickTaskSuccess] = useState(null);
  const [quickTaskError, setQuickTaskError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [showCreateTaskDrawer, setShowCreateTaskDrawer] = useState(false);
  const [selectedDateForTask, setSelectedDateForTask] = useState(null);
  const [deletingTaskId, setDeletingTaskId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [deleteConfirmTaskId, setDeleteConfirmTaskId] = useState(null);
  const [focusTab, setFocusTab] = useState("today");

  const computedStats = useMemo(
    () => computeStatsFromTasks(currentTasks),
    [currentTasks],
  );

  const allQuickTasks = useMemo(() => {
    if (!quickTasksData?.success || !quickTasksData?.quickTasks) return [];
    return [...quickTasksData.quickTasks].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );
  }, [quickTasksData]);

  const topQuickTasks = useMemo(
    () => allQuickTasks.slice(0, 3),
    [allQuickTasks],
  );

  const atRiskTasks = useMemo(
    () => currentTasks.filter((t) => t.isRisk === true),
    [currentTasks],
  );

  const mappedDashboardStats = dashboardStats
    ? {
        completedTasks: dashboardStats.completedTodayCount || 0,
        totalTasks:
          (dashboardStats.regularTasksCount || 0) +
          (dashboardStats.recurringTasksCount || 0) +
          (dashboardStats.milestoneTasksCount || 0) +
          (dashboardStats.approvalTasksCount || 0),
        beforeDueDate: dashboardStats.beforeDueDateCount || 0,
        milestoneCount: dashboardStats.milestoneTasksCount || 0,
        collaboratorCount: dashboardStats.collaboratorTasksCount || 0,
        approvalCount: dashboardStats.approvalTasksCount || 0,
        inProgressTasks: dashboardStats.beforeDueDateCount || 0,
        upcomingDeadlines: dashboardStats.beforeDueDateCount || 0,
        overdueTasks: dashboardStats.pastDueDateCount || 0,
        tasksByPriority: { urgent: dashboardStats.approvalTasksCount || 0 },
      }
    : null;

  const currentStats =
    mappedDashboardStats ||
    (userStats && Object.keys(userStats).length ? userStats : computedStats);

  const now = new Date();
  const statusOf = (s) => (s || "").toLowerCase();
  const openCount = currentTasks.filter((t) =>
    ["pending", "todo", "open"].includes(statusOf(t.status)),
  ).length;
  const inProgressCount = currentTasks.filter((t) =>
    ["in_progress", "in-progress", "doing", "inprogress"].includes(
      statusOf(t.status),
    ),
  ).length;
  const completedCount = currentTasks.filter((t) =>
    ["completed", "done"].includes(statusOf(t.status)),
  ).length;
  const overdueCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return currentTasks.filter((task) => {
      if (!task.dueDate) return false;

      const dueDate = new Date(task.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      const status = (task.status || "").toUpperCase();

      // Skip completed/cancelled tasks
      if (
        status === "DONE" ||
        status === "COMPLETED" ||
        status === "CANCELLED"
      ) {
        return false;
      }

      // Task is overdue if due date is before today
      return dueDate < today;
    }).length;
  }, [currentTasks]);

  const last7 = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - (6 - i));
        return d;
      }),
    [],
  );

  const dayKey = useCallback((d) => d.toISOString().slice(0, 10), []);
  const dayLabel = useCallback(
    (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    [],
  );

  const { trendLabels, trendCounts } = useMemo(() => {
    const dayMap = Object.fromEntries(last7.map((d) => [dayKey(d), 0]));
    currentTasks.forEach((t) => {
      if (statusOf(t.status) === "completed") {
        const date = t.completedAt || t.updatedAt || t.dueDate || t.createdAt;
        if (date) {
          const k = dayKey(new Date(date));
          if (k in dayMap) dayMap[k] += 1;
        }
      }
    });
    return {
      trendLabels: last7.map((d) => dayLabel(d)),
      trendCounts: last7.map((d) => dayMap[dayKey(d)] || 0),
    };
  }, [last7, currentTasks, dayKey, dayLabel]);

  const isOverdue = useCallback((dueDate, status) => {
    if (!dueDate) return false;

    // Reset time to 00:00:00 for proper date comparison
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const statusUpper = (status || "").toUpperCase();

    // Only consider if not completed and due date is before today
    return (
      due < today &&
      statusUpper !== "DONE" &&
      statusUpper !== "COMPLETED" &&
      !["completed", "done"].includes((status || "").toLowerCase())
    );
  }, []);

  const overdueTasksForReport = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return currentTasks.filter((task) => {
      if (!task.dueDate) return false;

      const dueDate = new Date(task.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      const status = (task.status || "").toUpperCase();

      // Skip completed/cancelled tasks
      if (
        status === "DONE" ||
        status === "COMPLETED" ||
        status === "CANCELLED"
      ) {
        return false;
      }

      // Task is overdue if due date is before today
      return dueDate < today;
    });
  }, [currentTasks]);

  const recurringTasks = useMemo(
    () => currentTasks.filter((t) => t.isRecurring),
    [currentTasks],
  );

  const milestoneTasks = useMemo(
    () => currentTasks.filter((t) => t.taskType === "milestone"),
    [currentTasks],
  );

  const todayStr = now.toISOString().split("T")[0];
  const todayTasks = useMemo(
    () =>
      currentTasks.filter(
        (t) => t.dueDate && t.dueDate.slice(0, 10) === todayStr,
      ),
    [currentTasks, todayStr],
  );

  const focusTabTasks = useMemo(() => {
    if (focusTab === "today") return todayTasks;
    if (focusTab === "overdue") return overdueTasksForReport;
    return currentTasks.filter((t) => t.taskType === "approval");
  }, [focusTab, todayTasks, overdueTasksForReport, currentTasks]);

  const upcomingTasks = useMemo(
    () =>
      currentTasks
        .filter((t) => {
          if (!t.dueDate) return false;
          const d = new Date(t.dueDate);
          const diff = (d - now) / 86400000;
          return (
            diff >= 0 &&
            diff <= 7 &&
            !["completed", "done"].includes(statusOf(t.status))
          );
        })
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
        .slice(0, 4),
    [currentTasks, now],
  );

  const getRelativeTime = useCallback(
    (dateStr) => {
      if (!dateStr) return "";
      const diff = (now - new Date(dateStr)) / 60000;
      if (diff < 60) return `${Math.round(diff)}m ago`;
      if (diff < 1440) return `${Math.round(diff / 60)}h ago`;
      return `${Math.round(diff / 1440)}d ago`;
    },
    [now],
  );

  const latestFilteredTasks = useMemo(() => {
    const filtered = currentTasks.filter((task) => {
      const matchesSearch =
        !searchTerm ||
        (task.title &&
          task.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (task.description &&
          task.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (task.tags &&
          task.tags.some(
            (tag) =>
              tag && tag.toLowerCase().includes(searchTerm.toLowerCase()),
          ));
      // Replace the matchesFilter block inside latestFilteredTasks:
      let matchesFilter = true;
      if (selectedFilter !== "all") {
        if (selectedFilter === "overdue")
          matchesFilter = isOverdue(task.dueDate, task.status);
        else if (selectedFilter === "upcoming") {
          const d = task.dueDate ? new Date(task.dueDate) : null;
          const diff = d ? (d - now) / 86400000 : -1;
          matchesFilter =
            diff >= 0 &&
            diff <= 7 &&
            !["completed", "done"].includes(statusOf(task.status));
        } else if (selectedFilter === "overdue") {
          const dueDate = task.dueDate ? new Date(task.dueDate) : null;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const status = (task.status || "").toUpperCase();
          matchesFilter =
            dueDate &&
            dueDate.setHours(0, 0, 0) < today &&
            status !== "DONE" &&
            status !== "COMPLETED" &&
            status !== "CANCELLED";
        } else if (selectedFilter === "today") {
          const dueDate = task.dueDate ? new Date(task.dueDate) : null;
          const today = new Date();
          const status = (task.status || "").toUpperCase();
          matchesFilter =
            dueDate &&
            dueDate.getDate() === today.getDate() &&
            dueDate.getMonth() === today.getMonth() &&
            dueDate.getFullYear() === today.getFullYear() &&
            status !== "DONE" &&
            status !== "COMPLETED" &&
            status !== "CANCELLED";
        } else {
          matchesFilter = task.status === selectedFilter;
        }
      }
      const matchesPriority =
        priorityFilter === "all"
          ? true
          : (task.priority || "").toLowerCase() === priorityFilter;
      const matchesDueFrom = dueFrom
        ? task.dueDate && new Date(task.dueDate) >= new Date(dueFrom)
        : true;
      const matchesDueTo = dueTo
        ? task.dueDate && new Date(task.dueDate) <= new Date(dueTo)
        : true;
      return (
        matchesSearch &&
        matchesFilter &&
        matchesPriority &&
        matchesDueFrom &&
        matchesDueTo
      );
    });

    return [...filtered]
    .sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return dateB - dateA;
    })
    .slice(0, 5); // ← CHANGE 4 to 5
}, [
  currentTasks,
  searchTerm,
  selectedFilter,
  priorityFilter,
  dueFrom,
  dueTo,
  isOverdue,
]);

  // ─── ALL HANDLERS ───────────────────────────────────────────────
  const handleQuickTaskSubmit = async () => {
    if (!quickTaskInput.trim()) return;
    setIsCreatingQuickTask(true);
    setQuickTaskError(null);
    setQuickTaskSuccess(null);
    try {
      const taskData = { title: quickTaskInput.trim(), priority: "low" };
      await quickTasksAPI.createQuickTask(taskData);
      setQuickTaskInput("");
      setQuickTaskSuccess("Quick task created successfully!");
      setTimeout(() => setQuickTaskSuccess(null), 3000);
      queryClient.invalidateQueries({ queryKey: ["/api/quick-tasks"] });
    } catch (error) {
      if (error.response && error.response.status === 409)
        setQuickTaskError("A similar quick task exists. Continue?");
      else if (error.response && error.response.status === 400)
        setQuickTaskError("Quick Task cannot be empty.");
      else setQuickTaskError(error.message || "Failed to create quick task");
      setTimeout(() => setQuickTaskError(null), 5000);
    } finally {
      setIsCreatingQuickTask(false);
    }
  };

  const handleCreateTask = useCallback(() => {
    setSelectedDateForTask(null);
    setShowCreateTaskDrawer(true);
  }, []);

  const handleCreateTaskSubmit = useCallback(() => {
    setShowCreateTaskDrawer(false);
    setLocalTasks(null);
    queryClient.invalidateQueries({ queryKey: ["/api/mytasks"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
  }, [queryClient]);

  const handleCloseCreateTask = useCallback(() => {
    setShowCreateTaskDrawer(false);
    setSelectedDateForTask(null);
  }, []);

  const handleDeleteTask = useCallback(
    async (taskId) => {
      setDeletingTaskId(taskId);
      setDeleteError(null);
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setDeleteError("Authorization token not found.");
          setDeletingTaskId(null);
          showErrorToast("Authorization token not found.");
          return;
        }
        const res = await fetch(`/api/tasks/delete/${taskId}`, {
          method: "DELETE",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.status === 401) {
          setDeleteError("Unauthorized: Please login again.");
          setDeletingTaskId(null);
          showErrorToast("Unauthorized. Log in again.");
          return;
        }
        if (!res.ok) {
          const data = await res.json();
          setDeleteError(data.message || "Failed to delete task.");
          setDeletingTaskId(null);
          showErrorToast(data.message || "Unable to delete task");
          return;
        }
        setLocalTasks((prev) =>
          prev
            ? prev.filter((t) => t._id !== taskId)
            : currentTasks.filter((t) => t._id !== taskId),
        );
        setDeletingTaskId(null);
        showSuccessToast("Task deleted");
        queryClient.invalidateQueries({ queryKey: ["/api/mytasks"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
      } catch (err) {
        setDeleteError(err.message || "Error deleting task.");
        setDeletingTaskId(null);
        showErrorToast(err.message || "Error deleting task.");
      }
    },
    [currentTasks, queryClient, showErrorToast, showSuccessToast],
  );

  const handleViewAllRecurringTasks = useCallback(
    () => navigate("/recurring"),
    [navigate],
  );

  const handleViewAllQuickTasks = useCallback(() => {
    try {
      navigate("/quick-tasks");
    } catch (error) {
      console.error("Navigation failed:", error);
      window.location.href = "/quick-tasks";
    }
  }, [navigate]);

  const navigateToTasksWithFilter = useCallback(
    (filterParams = {}) => {
      const params = new URLSearchParams();
      if (filterParams.statusFilter)
        params.set("statusFilter", filterParams.statusFilter);
      if (filterParams.dueDateFilter)
        params.set("dueDateFilter", filterParams.dueDateFilter);
      if (filterParams.taskTypeFilter)
        params.set("taskTypeFilter", filterParams.taskTypeFilter);
      if (filterParams.riskFilter)
        params.set("riskFilter", filterParams.riskFilter);
      const query = params.toString();
      navigate(`/tasks${query ? `?${query}` : ""}`);
    },
    [navigate],
  );

  const getDashboardRows = useCallback(() => {
    const rows = [];
    rows.push(["Metric", "Value"]);
    rows.push(["Open", openCount]);
    rows.push(["In Progress", inProgressCount]);
    rows.push(["Completed", completedCount]);
    rows.push(["Overdue", overdueCount]);
    rows.push([]);
    rows.push(["Last 7 days", ...trendLabels]);
    rows.push(["Completed", ...trendCounts]);
    rows.push([]);
    rows.push([
      "Task ID",
      "Title",
      "Status",
      "Priority",
      "Due Date",
      "Completed Date",
    ]);
    currentTasks.forEach((t) =>
      rows.push([
        t.id || t._id,
        t.title,
        t.status,
        t.priority,
        t.dueDate ? new Date(t.dueDate).toISOString().split("T")[0] : "",
        t.completedDate
          ? new Date(t.completedDate).toISOString().split("T")[0]
          : "",
      ]),
    );
    return rows;
  }, [
    openCount,
    inProgressCount,
    completedCount,
    overdueCount,
    trendLabels,
    trendCounts,
    currentTasks,
  ]);

  const exportAsCSV = useCallback(() => {
    const rows = getDashboardRows();
    const csv = rows
      .map((r) =>
        r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","),
      )
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `my-dashboard-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [getDashboardRows]);

  const exportAsExcel = useCallback(() => {
    try {
      const rows = getDashboardRows();
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Dashboard Report");
      XLSX.writeFile(
        wb,
        `my-dashboard-report-${new Date().toISOString().split("T")[0]}.xlsx`,
      );
    } catch {
      showErrorToast("Failed to export Excel");
    }
  }, [getDashboardRows, showErrorToast]);

  const exportAsPDF = useCallback(() => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const dateStr = new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      doc.setFontSize(18);
      doc.setFont(undefined, "bold");
      doc.text("My Dashboard Report", pageWidth / 2, 20, { align: "center" });
      doc.setFontSize(10);
      doc.setFont(undefined, "normal");
      doc.text(`Generated on ${dateStr}`, pageWidth / 2, 28, {
        align: "center",
      });
      let y = 38;
      doc.setFontSize(12);
      doc.setFont(undefined, "bold");
      doc.text("Summary", 14, y);
      y += 8;
      doc.setFontSize(10);
      doc.setFont(undefined, "normal");
      doc.text(
        `Open: ${openCount}    In Progress: ${inProgressCount}    Completed: ${completedCount}    Overdue: ${overdueCount}`,
        14,
        y,
      );
      y += 10;
      doc.setFontSize(12);
      doc.setFont(undefined, "bold");
      doc.text(`Tasks (${currentTasks.length})`, 14, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [
          ["#", "Title", "Status", "Priority", "Due Date", "Completed Date"],
        ],
        body: currentTasks.map((t, i) => [
          i + 1,
          t.title || "",
          t.status || "",
          t.priority || "",
          t.dueDate
            ? new Date(t.dueDate).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
            : "-",
          t.completedDate
            ? new Date(t.completedDate).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
            : "-",
        ]),
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [30, 64, 175], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [249, 250, 251] },
      });
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175);
        doc.text(
          "TaskSetu - Dashboard Export",
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: "center" },
        );
      }
      doc.save(
        `my-dashboard-report-${new Date().toISOString().split("T")[0]}.pdf`,
      );
    } catch {
      showErrorToast("Failed to export PDF");
    }
  }, [
    openCount,
    inProgressCount,
    completedCount,
    overdueCount,
    currentTasks,
    showErrorToast,
  ]);

  // Task Streak Calculation
  const taskStreak = useMemo(() => {
    const completedTasks = currentTasks.filter((t) =>
      ["completed", "done", "DONE"].includes((t.status || "").toUpperCase()),
    );

    if (completedTasks.length === 0) {
      return {
        streak: 0,
        todayDone: 0,
      };
    }

    const completedDates = [
      ...new Set(
        completedTasks.map((t) => {
          const date = t.completedAt || t.updatedAt || t.createdAt;

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
      const date = t.completedAt || t.updatedAt || t.createdAt;

      return new Date(date).toISOString().split("T")[0] === todayStr;
    }).length;

    return {
      streak,
      todayDone,
    };
  }, [currentTasks, todayStr]);

  // Weekly Progress Calculation
  const weeklyProgress = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const weekTasks = currentTasks.filter((t) => {
      const taskDate = t.dueDate || t.createdAt;
      if (!taskDate) return false;
      const date = new Date(taskDate);
      return date >= startOfWeek && date <= endOfWeek;
    });

    const weekCompletedTasks = weekTasks.filter((t) =>
      ["completed", "done", "DONE"].includes((t.status || "").toUpperCase()),
    );

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
  }, [currentTasks]);

  // ─── KPI CARDS CONFIG ─────────────────────────────────────────────────────
  const kpiCards = useMemo(
    () => [
      {
        label: "Total Tasks",
        value: currentTasks.length,
        linkLabel: "Show all tasks",
        icon: ListChecks,
        iconColor: "text-blue-600",
        iconBg: "bg-blue-50",
        testId: "card-total-tasks",
        onClick: () => navigateToTasksWithFilter({}),
      },
      {
        label: "Completed",
        value: completedCount,
        linkLabel: "Show all completed",
        icon: CheckSquare,
        iconColor: "text-green-600",
        iconBg: "bg-green-50",
        testId: "card-completed",
        onClick: () => navigateToTasksWithFilter({ statusFilter: "DONE" }),
      },
      {
        label: "In Progress",
        value: inProgressCount,
        linkLabel: "Show all in progress",
        icon: Clock,
        iconColor: "text-yellow-600",
        iconBg: "bg-yellow-50",
        testId: "card-pending",
        onClick: () =>
          navigateToTasksWithFilter({ statusFilter: "INPROGRESS" }),
      },
      {
        label: "Overdue",
        value: overdueCount,
        subtitle:
          overdueCount > 0 ? `${overdueCount} high priority` : "All on track",
        subtitleColor: overdueCount > 0 ? "#dc2626" : "#16a34a",
        linkLabel: "Show all overdue",
        icon: AlertTriangle,
        iconColor: "text-red-600",
        iconBg: "bg-red-50",
        testId: "card-overdue",
        onClick: () => navigateToTasksWithFilter({ dueDateFilter: "overdue" }),
      },

      {
        label: "This Week Progress",
        value:
          weeklyProgress.total === 0
            ? "0%"
            : `${Math.round(weeklyProgress.percentage)}%`,
        linkLabel: "View weekly report",
        icon: TrendingUp,
        iconColor: "text-indigo-600",
        iconBg: "bg-indigo-50",
        testId: "card-weekly-progress",
        onClick: () => navigateToTasksWithFilter({ dueDateFilter: "thisWeek" }),
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

        subtitle:
          taskStreak.streak > 0
            ? `${taskStreak.todayDone} completed today`
            : "Complete tasks daily",

        icon: Flame,
        iconColor: "text-orange-600",
        iconBg: "bg-orange-50",
        testId: "card-task-streak",
        onClick: () =>
          navigateToTasksWithFilter({
            statusFilter: "completed",
          }),

        isStreakCard: true,
        streak: taskStreak.streak,
      },
    ],
    [
      currentTasks.length,
      completedCount,
      inProgressCount,
      overdueCount,
      currentStats.milestoneCount,
      navigateToTasksWithFilter,
      weeklyProgress,
    ],
  );

  return (
    <div
      className="min-h-screen font-['Open_Sans','Helvetica_Neue',Helvetica,Arial,sans-serif] [&_*]:box-border"
      style={{ backgroundColor: "#f3f3f4" }}
    >
      {/* ── No Token: session expired ── */}
      {!token && (
        <div className="flex flex-col items-center justify-center h-[260px] gap-3">
          <div className="w-[52px] h-[52px] bg-yellow-100 rounded-sm flex items-center justify-center">
            <AlertTriangle className="text-yellow-600" size={24} />
          </div>
          <p className="font-semibold text-gray-900 m-0">Session expired</p>
          <p className="text-sm m-0" style={{ color: "#676a6c" }}>
            Please login again to continue.
          </p>
          <Button
            onClick={() => {
              window.location.href = "/login";
            }}
            className="mt-2 h-9 text-sm rounded-sm"
          >
            Go to Login
          </Button>
        </div>
      )}

      {/* ── Loading ── */}
      {!!token && isLoadingTasks && (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <Loader className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-lg text-gray-600">Loading your workspace...</p>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {!!token && tasksError && (
        <div className="flex flex-col items-center justify-center h-[260px] gap-3">
          <div className="w-[52px] h-[52px] bg-red-100 rounded-sm flex items-center justify-center">
            <AlertTriangle className="text-red-600" size={24} />
          </div>
          <p className="font-semibold text-gray-900 m-0">
            Failed to load tasks
          </p>
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
      )}

      {!!token && !isLoadingTasks && !tasksError && (
        <div className="p-4">
          {/* ══ PAGE HEADER ══ */}
          <div className="bg-white border border-gray-200 rounded-sm px-5 py-4 shadow-sm mb-3 flex items-center justify-between flex-wrap gap-4">
            {/* LEFT SECTION */}
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
                        {user?.firstName || "User"}
                      </span>
                    </>
                  );
                })()}
              </h2>

              <p className="text-sm mt-2 m-0" style={{ color: "#9a9a9a" }}>
                You have{" "}
                <span className="font-semibold text-gray-700">
                  {
                    currentTasks.filter(
                      (t) =>
                        !["completed", "done"].includes(
                          (t.status || "").toLowerCase(),
                        ),
                    ).length
                  }
                </span>{" "}
                tasks to focus on today.
              </p>
            </div>

            {/* RIGHT SECTION */}
            {(() => {
              const progressPercentage = Math.round(
                (completedCount / Math.max(currentTasks.length, 1)) * 100,
              );

              const progressText =
                progressPercentage <= 20
                  ? "Let's get started 🚀"
                  : progressPercentage <= 50
                    ? "Small progress every day ✨"
                    : progressPercentage <= 80
                      ? "You're doing great 🔥"
                      : "Outstanding productivity 🏆";

              return (
                <div className="flex items-center gap-5">
                  {/* Progress Box */}
                  <div className="flex items-center gap-3 border-r border-gray-200 pr-5">
                    <div className="relative w-14 h-14">
                      <svg viewBox="0 0 44 44" className="w-14 h-14 -rotate-90">
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
                        Day progress
                      </p>

                      <p className="text-sm font-semibold text-gray-700">
                        {progressPercentage >= 80
                          ? "Excellent"
                          : progressPercentage >= 50
                            ? "On Track"
                            : "Keep Going"}
                      </p>
                    </div>
                  </div>

                  {/* Motivation */}
                  <div className="max-w-[180px]">
                    <p className="text-sm font-medium text-gray-700 leading-[18px]">
                      {progressText}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ══ CALENDAR VIEW ══ - Using context value */}

          {!showCalendarView && (
            <>
              {/* ══ TODAY FOCUS ══ */}
              <div className="bg-white border border-gray-200 shadow-sm rounded-sm mb-3">
                <div
                  className="py-2.5 px-4 border-b border-gray-200 flex items-center justify-between rounded-sm"
                  style={{ backgroundColor: "#f9f9f9" }}
                >
                  <h5
                    className="text-xs font-semibold uppercase tracking-wider m-0 flex items-center gap-1.5"
                    style={{ color: "#676a6c" }}
                  >
                    <Star size={12} className="text-yellow-500" /> Today Focus
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
                    {/* Left Scroll Button - appears only when scrollable */}
                    <button
                      className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/80 hover:bg-white rounded-r-md shadow-md p-1 transition-all duration-200 opacity-0 hover:opacity-100 focus:opacity-100 group-hover:opacity-100"
                      style={{ display: "none" }}
                      id="scroll-left-btn"
                      onClick={() => {
                        const container = document.getElementById(
                          "focus-scroll-container",
                        );
                        if (container) container.scrollLeft -= 280;
                      }}
                    >
                      <ChevronDown className="rotate-90 w-4 h-4 text-gray-600" />
                    </button>

                    {/* Scrollable Container */}
                    <div
                      id="focus-scroll-container"
                      className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
                      style={{
                        scrollbarWidth: "thin",
                        scrollbarColor: "#cbd5e1 #f1f5f9",
                      }}
                    >
                      <div
                        className="flex gap-2.5 p-3"
                        style={{ minWidth: "max-content" }}
                      >
                        {focusTabTasks.slice(0, 10).map((task) => (
                          <div
                            className="relative bg-white border border-gray-200 rounded-sm p-4 hover:shadow-md transition-all duration-300"
                            key={task._id || task.id}
                            style={{ width: "260px", flexShrink: 0 }}
                          >
                            {/* Left Priority Border */}
                            <div
                              className={`absolute left-0 top-0 h-full w-1 rounded-sm ${
                                task.priority === "high"
                                  ? "bg-red-500"
                                  : task.priority === "medium"
                                    ? "bg-yellow-500"
                                    : task.priority === "tomorrow"
                                      ? "bg-blue-500"
                                      : "bg-green-500"
                              }`}
                            />

                            {/* Top */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2 min-w-0">
                                {getTaskTypeIcon(task, 14)}

                                <div className="min-w-0">
                                  <h4 className="text-sm font-semibold text-gray-800 truncate">
                                    {task.title}
                                  </h4>

                                  <p className="text-xs text-gray-400 mt-0.5">
                                    {task.category || "General"}
                                  </p>
                                </div>
                              </div>

                              {/* Avatar */}
                              <div className="w-8 h-8 rounded-sm bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-700 flex-shrink-0">
                                {task.assignee?.name?.[0] || "A"}
                              </div>
                            </div>

                            {/* Due Time */}
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
                                          (new Date(task.dueDate) -
                                            new Date()) /
                                            60000,
                                        );
                                        if (diff > 0 && diff < 1440) {
                                          return `Due in ${Math.floor(diff / 60)}h ${diff % 60}m`;
                                        }
                                        return `Due ${new Date(
                                          task.dueDate,
                                        ).toLocaleDateString("en-GB", {
                                          day: "2-digit",
                                          month: "short",
                                        })}`;
                                      })()
                                    : "No due date"}
                                </p>
                              </div>

                              {/* Priority */}
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

                            {/* Progress */}
                            <div className="mt-4">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-gray-400">
                                  Progress
                                </span>
                                <span className="text-xs font-semibold text-gray-700">
                                  {task.progress || 0}%
                                </span>
                              </div>

                              <div className="w-full h-1.5 bg-gray-100 rounded-sm overflow-hidden">
                                <div
                                  className={`h-full rounded-sm ${
                                    task.priority === "high"
                                      ? "bg-red-500"
                                      : task.priority === "medium"
                                        ? "bg-yellow-500"
                                        : "bg-blue-500"
                                  }`}
                                  style={{
                                    width: `${task.progress || 0}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right Scroll Button - appears only when scrollable */}
                    <button
                      className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/80 hover:bg-white rounded-l-md shadow-md p-1 transition-all duration-200 opacity-0 hover:opacity-100 focus:opacity-100"
                      style={{ display: "none" }}
                      id="scroll-right-btn"
                      onClick={() => {
                        const container = document.getElementById(
                          "focus-scroll-container",
                        );
                        if (container) container.scrollLeft += 280;
                      }}
                    >
                      <ChevronDown className="-rotate-90 w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                ) : (
                  <div className="p-3">
                    <div className="bg-green-50 border border-green-200 text-green-700 py-2 px-3 text-sm flex items-center gap-2 rounded-sm">
                      <CheckSquare size={14} /> All clear! No tasks for this
                      view.aichchchik
                    </div>
                  </div>
                )}
              </div>

              {/* ══ KPI CARDS ══ */}
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
                        {label === "This Week Progress" || isProgressCard ? (
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
                              {weeklyCompleted}/{weeklyTotal} done
                            </text>
                            <text
                              x="82"
                              y="33"
                              fontSize="8"
                              fill="#4f46e5"
                              fontFamily="sans-serif"
                              fontWeight="700"
                            >
                              {Math.round(percentage || 0)}%
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

              {/* ══ 3-COLUMN GRID FOR ALL SECTIONS ══ */}
              <div className="grid grid-cols-3 gap-3 mb-3 max-md:grid-cols-1">
                {/* CHANGE 4: Continue Working section (Row 1, Col 1) */}
                <div className="bg-white border border-gray-200 shadow-sm rounded-sm">
                  <div
                    className="py-2.5 px-4 border-b border-gray-200 flex items-center justify-between rounded-sm"
                    style={{ backgroundColor: "#f9f9f9" }}
                  >
                    <h5
                      className="text-xs font-semibold uppercase tracking-wider m-0 flex items-center gap-1.5"
                      style={{ color: "#676a6c" }}
                    >
                      <Activity size={12} className="text-blue-600" /> Continue
                      Working
                    </h5>
                    <button
                      onClick={() =>
                        navigateToTasksWithFilter({
                          statusFilter: "INPROGRESS",
                        })
                      }
                      className="text-xs text-blue-600 font-semibold hover:underline"
                    >
                      View all
                    </button>
                  </div>

                  {currentTasks
                    .filter((t) =>
                      ["in_progress", "in-progress", "inprogress"].includes(
                        (t.status || "").toLowerCase(),
                      ),
                    )
                    .slice(0, 3)
                    .map((t) => {
                      const dueDate = t.dueDate ? new Date(t.dueDate) : null;
                      const isOverdue = dueDate && dueDate < new Date();
                      const isDueToday =
                        dueDate &&
                        dueDate.toDateString() === new Date().toDateString();

                      return (
                        <div
                          key={t._id}
                          className="py-2.5 px-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer"
                          onClick={() => navigate(`/tasks/${t._id}`)}
                        >
                          {/* Task Title Row */}
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              {getTaskTypeIcon(t, 12)}
                              <span
                                className="text-sm font-medium truncate"
                                style={{ color: "#676a6c" }}
                              >
                                {t.title}
                              </span>
                            </div>

                            {/* Progress - Small */}
                            <div className="flex items-center gap-1.5">
                              <div className="w-[50px] bg-gray-100 rounded-sm h-1 overflow-hidden">
                                <div
                                  className={`h-full rounded-sm ${
                                    (t.progress || 0) >= 80
                                      ? "bg-green-500"
                                      : (t.progress || 0) >= 40
                                        ? "bg-blue-500"
                                        : "bg-yellow-500"
                                  }`}
                                  style={{
                                    width: `${Math.max(t.progress || 0, 2)}%`,
                                  }}
                                />
                              </div>
                              <span className="text-[10px] font-medium text-gray-600">
                                {t.progress || 0}%
                              </span>
                            </div>
                          </div>

                          {/* Status and Due Date Row */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] px-1.5 py-0.5 rounded-sm text-blue-700 font-medium bg-blue-50">
                                In Progress
                              </span>

                              {/* Due Date with Time */}
                              {dueDate && (
                                <div className="flex items-center gap-1">
                                  <Clock
                                    size={10}
                                    className={
                                      isOverdue
                                        ? "text-red-500"
                                        : isDueToday
                                          ? "text-orange-500"
                                          : "text-gray-400"
                                    }
                                  />
                                  <span
                                    className={`text-[10px] ${isOverdue ? "text-red-500 font-medium" : isDueToday ? "text-orange-500" : "text-gray-500"}`}
                                  >
                                    {dueDate.toLocaleDateString("en-GB", {
                                      day: "2-digit",
                                      month: "short",
                                    })}{" "}
                                    {dueDate.toLocaleTimeString("en-GB", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Last updated */}
                            {t.updatedAt && (
                              <span className="text-[9px] text-gray-400">
                                {getRelativeTime(t.updatedAt)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                  {currentTasks.filter((t) =>
                    ["in_progress", "in-progress", "inprogress"].includes(
                      (t.status || "").toLowerCase(),
                    ),
                  ).length === 0 && (
                    <div
                      className="py-4 px-4 text-sm italic text-center"
                      style={{ color: "#9a9a9a" }}
                    >
                      No tasks in progress
                    </div>
                  )}
                </div>

                {/* At Risk Tasks */}
                <div className="bg-white border border-gray-200 shadow-sm rounded-sm">
                  <div
                    className="py-2.5 px-4 border-b border-gray-200 flex items-center justify-between rounded-sm"
                    style={{ backgroundColor: "#f9f9f9" }}
                  >
                    <h5
                      className="text-xs font-semibold uppercase tracking-wider m-0 flex items-center gap-1.5"
                      style={{ color: "#676a6c" }}
                    >
                      <AlertTriangle size={12} className="text-red-500" /> At
                      Risk Tasks
                    </h5>
                    <button
                      onClick={() =>
                        navigateToTasksWithFilter({ riskFilter: "true" })
                      }
                      className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
                    >
                      View All
                    </button>
                  </div>

                  <div>
                    {(() => {
                      const riskTasks = currentTasks
                        .filter((t) => t.isRisk === true)
                        .sort((a, b) => {
                          const riskOrder = { high: 3, medium: 2, low: 1 };
                          return (
                            (riskOrder[b.riskLevel] || 0) -
                            (riskOrder[a.riskLevel] || 0)
                          );
                        })
                        .slice(0, 3);

                      if (riskTasks.length === 0) {
                        return (
                          <div className="py-6 px-4 text-center">
                            <div className="w-10 h-10 bg-green-100 rounded-sm flex items-center justify-center mx-auto mb-2">
                              <CheckSquare
                                size={18}
                                className="text-green-600"
                              />
                            </div>
                            <p className="text-sm text-green-700 font-medium">
                              All tasks on track! ✓
                            </p>
                            <p
                              className="text-xs mt-0.5"
                              style={{ color: "#9a9a9a" }}
                            >
                              No tasks are currently at risk
                            </p>
                          </div>
                        );
                      }

                      return riskTasks.map((t) => {
                        const dueDate = new Date(t.dueDate);
                        const isOverdue = dueDate < new Date();

                        const riskColors = {
                          high: "bg-red-100 text-red-700",
                          medium: "bg-orange-100 text-orange-700",
                          low: "bg-yellow-100 text-yellow-700",
                        };

                        return (
                          <div
                            className="py-2.5 px-4 border-b border-gray-100 hover:bg-gray-50 transition-colors last:border-b-0 cursor-pointer"
                            key={t._id}
                            onClick={() => navigate(`/tasks/${t._id}`)}
                          >
                            {/* Line 1: Title + Risk Level */}
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {getTaskTypeIcon(t, 12)}
                                <span
                                  className="text-sm font-medium truncate"
                                  style={{ color: "#676a6c" }}
                                >
                                  {t.title}
                                </span>
                                <span
                                  className={`text-xs px-1.5 py-0.5 rounded-sm flex-shrink-0 ${riskColors[t.riskLevel]}`}
                                >
                                  {t.riskLevel?.toUpperCase()}
                                </span>
                              </div>
                              <span className="text-xs px-2 py-0.5 rounded-sm bg-gray-100 text-gray-600 flex-shrink-0">
                                {t.status}
                              </span>
                            </div>

                            {/* Line 2: Marked On + Due Date */}
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Clock size={10} />
                                Marked{" "}
                                {new Date(t.riskMarkedAt).toLocaleString(
                                  "en-GB",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </span>
                              <span
                                className={`text-xs flex items-center gap-1 ${isOverdue ? "text-red-500 font-medium" : "text-gray-400"}`}
                              >
                                <Calendar size={10} />
                                Due{" "}
                                {dueDate.toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                })}
                              </span>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Quick Tasks */}
                <div className="bg-white border border-gray-200 shadow-sm rounded-sm">
                  <div
                    className="py-2.5 px-4 border-b border-gray-200 flex items-center justify-between rounded-sm"
                    style={{ backgroundColor: "#f9f9f9" }}
                  >
                    <h5
                      className="text-xs font-semibold uppercase tracking-wider m-0 flex items-center gap-1.5"
                      style={{ color: "#676a6c" }}
                    >
                      <QuickTaskIcon size={12} className="text-blue-500" />
                      Quick Tasks
                    </h5>
                    {allQuickTasks.length > 0 && (
                      <button
                        onClick={handleViewAllQuickTasks}
                        className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
                      >
                        View All
                      </button>
                    )}
                  </div>
                  <div className="p-3">
                    {isLoadingQuickTasks ? (
                      <div className="flex justify-center py-4">
                        <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-600 rounded-sm animate-spin" />
                      </div>
                    ) : quickTasksError ? (
                      <div className="text-red-500 text-xs text-center py-4">
                        Failed to load quick tasks
                      </div>
                    ) : topQuickTasks.length > 0 ? (
                      topQuickTasks.slice(0, 4).map((t, i) => {
                        // Use completedAt if status is done, otherwise use createdAt
                        const displayDate =
                          t.status === "done" && t.completedAt
                            ? new Date(t.completedAt)
                            : new Date(t.createdAt);

                        const now = new Date();
                        const isToday =
                          displayDate.toDateString() === now.toDateString();
                        const isYesterday =
                          new Date(
                            now.setDate(now.getDate() - 1),
                          ).toDateString() === displayDate.toDateString();

                        let dateLabel = "";
                        if (isToday) {
                          dateLabel = "Today";
                        } else if (isYesterday) {
                          dateLabel = "Yesterday";
                        } else {
                          dateLabel = displayDate.toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                          });
                        }

                        const timeString = displayDate.toLocaleTimeString(
                          "en-GB",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        );

                        return (
                          <div
                            className="py-1.5 px-0 border-b border-gray-100 flex items-center justify-between last:border-b-0"
                            key={t._id || i}
                            // NO onClick navigation - removed!
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <QuickTaskIcon
                                size={12}
                                className={
                                  t.status === "done"
                                    ? "text-green-500"
                                    : t.status === "in-progress" ||
                                        t.status === "in_progress"
                                      ? "text-yellow-500"
                                      : "text-blue-500"
                                }
                              />
                              <div className="flex-1 min-w-0">
                                <span
                                  className={`text-sm truncate block ${
                                    t.status === "done" ? "line-through" : ""
                                  }`}
                                  style={{
                                    color:
                                      t.status === "done"
                                        ? "#9a9a9a"
                                        : "#676a6c",
                                  }}
                                >
                                  {t.title}
                                </span>
                                <span className="text-xs text-gray-400 mt-0.5 block">
                                  {t.status === "done"
                                    ? "✓ Completed"
                                    : " Created"}{" "}
                                  {dateLabel} at {timeString}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                              {t.priority && t.priority !== "low" && (
                                <span
                                  className={`text-xs px-1.5 py-0.5 rounded-sm ${
                                    t.priority === "high"
                                      ? "bg-red-100 text-red-600"
                                      : t.priority === "medium"
                                        ? "bg-yellow-100 text-yellow-600"
                                        : "bg-green-100 text-green-600"
                                  }`}
                                >
                                  {t.priority}
                                </span>
                              )}
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded-sm font-medium ${
                                  t.status === "done"
                                    ? "bg-green-100 text-green-700"
                                    : t.status === "in-progress" ||
                                        t.status === "in_progress"
                                      ? "bg-yellow-100 text-yellow-700"
                                      : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {t.status === "done"
                                  ? "Completed"
                                  : t.status === "in-progress" ||
                                      t.status === "in_progress"
                                    ? "In Progress"
                                    : "Pending"}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div
                        className="text-sm italic text-center py-4"
                        style={{ color: "#9a9a9a" }}
                      >
                        No quick tasks available
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* ══ SECOND ROW - 3 COLUMNS ══ */}
              <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
                {/* Recently Completed - Using updatedAt */}
                <div className="bg-white border border-gray-200 shadow-sm rounded-sm">
                  <div
                    className="py-2.5 px-4 border-b border-gray-200 flex items-center justify-between rounded-sm"
                    style={{ backgroundColor: "#f9f9f9" }}
                  >
                    <h5
                      className="text-xs font-semibold uppercase tracking-wider m-0 flex items-center gap-1.5"
                      style={{ color: "#676a6c" }}
                    >
                      <CheckSquare size={12} className="text-green-500" />
                      Recently Completed
                    </h5>
                    {currentTasks.filter((t) =>
                      ["completed", "done", "DONE"].includes(
                        (t.status || "").toUpperCase(),
                      ),
                    ).length > 0 && (
                      <button
                        onClick={() =>
                          navigateToTasksWithFilter({
                            statusFilter: "DONE",
                          })
                        }
                        className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
                      >
                        View All
                      </button>
                    )}
                  </div>

                  <div>
                    {(() => {
                      const completedTasks = currentTasks
                        .filter((t) =>
                          ["completed", "done", "DONE"].includes(
                            (t.status || "").toUpperCase(),
                          ),
                        )
                        .sort((a, b) => {
                          // Sort by updatedAt descending (most recent first)
                          const dateA = a.updatedAt
                            ? new Date(a.updatedAt)
                            : new Date(0);
                          const dateB = b.updatedAt
                            ? new Date(b.updatedAt)
                            : new Date(0);
                          return dateB - dateA;
                        });

                      if (completedTasks.length === 0) {
                        return (
                          <div className="py-6 px-4 text-center">
                            <CheckSquare
                              size={24}
                              className="text-gray-300 mx-auto mb-2"
                            />
                            <p className="text-sm text-gray-400">
                              No completed tasks
                            </p>
                          </div>
                        );
                      }

                      return completedTasks.slice(0, 5).map((task) => {
                        const completedDate = task.updatedAt
                          ? new Date(task.updatedAt)
                          : new Date();
                        const now = new Date();
                        const isToday =
                          completedDate.toDateString() === now.toDateString();

                        return (
                          <div
                            key={task._id}
                            className="group py-2 px-4 border-b border-gray-100 last:border-b-0 cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() =>
                              navigate(`/tasks/${task._id || task.id}`)
                            }
                          >
                            <div className="flex items-center gap-2">
                              <CheckSquare
                                size={14}
                                className="text-green-500 flex-shrink-0"
                              />
                              <span className="text-sm text-gray-700 truncate flex-1">
                                {task.title}
                              </span>
                              <span className="text-xs text-gray-400 flex-shrink-0">
                                {isToday
                                  ? completedDate.toLocaleTimeString("en-GB", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : completedDate.toLocaleString("en-GB", {
                                      day: "2-digit",
                                      month: "short",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                              </span>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Upcoming Tasks */}
                <div className="bg-white border border-gray-200 shadow-sm rounded-sm">
                  <div
                    className="py-2.5 px-4 border-b border-gray-200 flex items-center justify-between rounded-sm"
                    style={{ backgroundColor: "#f9f9f9" }}
                  >
                    <h5
                      className="text-xs font-semibold uppercase tracking-wider m-0 flex items-center gap-1.5"
                      style={{ color: "#676a6c" }}
                    >
                      <Calendar size={12} className="text-blue-600" /> Upcoming
                    </h5>

                    <button
                      onClick={() =>
                        navigateToTasksWithFilter({ dueDateFilter: "overdue" })
                      }
                      className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
                    >
                      View All
                    </button>
                  </div>

                  <div>
                    {(() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);

                      const futureTasks = currentTasks
                        .filter((t) => {
                          const status = (t.status || "").toUpperCase();

                          if (status === "DONE" || status === "CANCELLED")
                            return false;

                          if (!t.dueDate) return false;

                          const dueDate = new Date(t.dueDate);
                          dueDate.setHours(0, 0, 0, 0);

                          return dueDate >= today;
                        })
                        .sort(
                          (a, b) => new Date(a.dueDate) - new Date(b.dueDate),
                        )
                        .slice(0, 3);

                      if (futureTasks.length === 0) {
                        return (
                          <div className="py-6 px-4 text-center">
                            <Calendar
                              size={24}
                              className="text-gray-300 mx-auto mb-2"
                            />

                            <p className="text-sm text-gray-400">
                              No upcoming tasks
                            </p>
                          </div>
                        );
                      }

                      return futureTasks.map((t) => {
                        const dueDate = new Date(t.dueDate);

                        const diffDays = Math.ceil(
                          (dueDate - today) / (1000 * 60 * 60 * 24),
                        );

                        let dateLabel =
                          diffDays === 0
                            ? "Today"
                            : diffDays === 1
                              ? "Tomorrow"
                              : `${dueDate.getDate()} ${dueDate.toLocaleString(
                                  "en-GB",
                                  { month: "short" },
                                )}`;

                        const timeString = dueDate.toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        });

                        return (
                          <div
                            className="py-2.5 px-4 border-b border-gray-100 last:border-b-0 cursor-pointer hover:bg-gray-50 transition-colors"
                            key={t._id}
                            onClick={() => navigate(`/tasks/${t._id}`)}
                          >
                            {/* TOP ROW */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {getTaskTypeIcon(t, 12)}

                                <span
                                  className="text-sm font-medium truncate"
                                  style={{ color: "#676a6c" }}
                                >
                                  {t.title}
                                </span>
                              </div>

                              {t.priority && t.priority !== "low" && (
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded-sm font-medium ${
                                    t.priority === "high"
                                      ? "bg-red-100 text-red-600"
                                      : "bg-yellow-100 text-yellow-600"
                                  }`}
                                >
                                  {t.priority}
                                </span>
                              )}
                            </div>

                            {/* SECOND ROW */}
                            <div className="flex items-center gap-1.5 mt-1 ml-5">
                              <span className="text-xs text-gray-500">
                                {`${dateLabel} at ${timeString}`}
                              </span>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* CHANGE 5: Long Pending Tasks (instead of Waiting For) */}
                <div className="bg-white border border-gray-200 shadow-sm rounded-sm">
                  <div
                    className="py-2.5 px-4 border-b border-gray-200 flex items-center justify-between rounded-sm"
                    style={{ backgroundColor: "#f9f9f9" }}
                  >
                    <h5
                      className="text-xs font-semibold uppercase tracking-wider m-0 flex items-center gap-1.5"
                      style={{ color: "#676a6c" }}
                    >
                      <Clock size={12} className="text-orange-500" /> Long
                      Pending Tasks
                    </h5>
                    <button
                      onClick={() =>
                        navigateToTasksWithFilter({ dueDateFilter: "overdue" })
                      }
                      className="text-xs text-blue-600 font-semibold hover:underline"
                    >
                      View All
                    </button>
                  </div>
                  {overdueTasksForReport.slice(0, 3).map((t) => {
                    const days = Math.ceil(
                      (new Date() - new Date(t.dueDate)) / 86400000,
                    );
                    return (
                      <div
                        key={t._id}
                        className="py-2.5 px-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer flex items-center justify-between gap-2"
                        onClick={() => navigate(`/tasks/${t._id}`)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {getTaskTypeIcon(t, 12)}
                            <span
                              className="text-sm truncate"
                              style={{ color: "#676a6c" }}
                            >
                              {t.title}
                            </span>
                          </div>
                          <p className="text-xs mt-0.5 m-0 text-red-500">
                            Overdue by {days} days
                          </p>
                        </div>
                        {getPriorityBadge(t.priority)}
                      </div>
                    );
                  })}
                  {overdueTasksForReport.length === 0 && (
                    <div className="py-6 px-4 text-center">
                      <CheckSquare
                        size={22}
                        className="text-green-400 mx-auto mb-1"
                      />
                      <p className="text-sm text-green-600 font-medium">
                        No long pending tasks!
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* ══ TASK LIST ══ - CHANGE 6: Tabs + Checkbox + Progress column */}
              <div
                className="bg-white border border-gray-200 shadow-sm rounded-sm mt-3 mb-3"
                id="my-tasks"
                data-testid="card-tasks-grid"
              >
                {/* Header */}
                <div
                  className="py-2.5 px-4 border-b border-gray-200 rounded-sm"
                  style={{ backgroundColor: "#f9f9f9" }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h5
                      className="text-xs font-semibold uppercase tracking-wider m-0"
                      style={{ color: "#676a6c" }}
                    >
                      My Task List
                    </h5>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-1.5 transition-colors border rounded-sm ${
                          showFilters
                            ? "bg-blue-50 text-blue-600 border-blue-300"
                            : "border-gray-300 hover:bg-gray-100"
                        }`}
                        style={!showFilters ? { color: "#9a9a9a" } : {}}
                        data-testid="button-toggle-filters"
                      >
                        <Filter size={13} />
                      </button>
                      <button
                        onClick={() => navigate("/tasks")}
                        className="px-3 py-1 text-xs font-medium text-blue-600 border border-blue-600 hover:bg-blue-50 transition-colors rounded-sm"
                        data-testid="button-view-all-tasks"
                      >
                        View All
                      </button>
                    </div>
                  </div>

                  {/* Search */}
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      size={13}
                    />
                    <input
                      type="text"
                      className="w-full h-7 pl-8 pr-3 text-sm border border-gray-300 rounded-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="Search tasks…"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{ color: "#676a6c" }}
                      data-testid="input-search-tasks"
                    />
                  </div>

                  {/* Status tabs */}
                  <div className="flex gap-1 mt-2">
                    {[
                      { key: "all", label: "All", count: currentTasks.length },
                      {
                        key: "today",
                        label: "Today",
                        count: todayTasks.length,
                      },
                      { key: "overdue", label: "Overdue", count: overdueCount },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setSelectedFilter(tab.key)}
                        className={`px-2.5 py-0.5 text-xs font-medium border rounded-sm transition-colors ${selectedFilter === tab.key ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 bg-white hover:bg-gray-50"}`}
                        style={
                          selectedFilter !== tab.key ? { color: "#676a6c" } : {}
                        }
                      >
                        {tab.label}{" "}
                        <span
                          className={`ml-0.5 ${selectedFilter === tab.key ? "text-blue-200" : "text-gray-400"}`}
                        >
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Filters */}
                  {showFilters && (
                    <div className="flex gap-1 flex-wrap mt-2">
                      {[
                        "all",
                        "OPEN",
                        "INPROGRESS",
                        "DONE",
                        "ONHOLD",
                        "CANCELLED",
                        "overdue",
                      ].map((f) => (
                        <button
                          key={f}
                          className={`px-2 py-0.5 text-xs font-medium transition-colors border rounded-sm ${
                            selectedFilter === f
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-gray-100 border-gray-300 hover:bg-gray-200"
                          }`}
                          style={
                            selectedFilter !== f ? { color: "#676a6c" } : {}
                          }
                          onClick={() => setSelectedFilter(f)}
                          data-testid={`filter-${f}`}
                        >
                          {f === "all" || f === "overdue"
                            ? f.charAt(0).toUpperCase() + f.slice(1)
                            : f.charAt(0) + f.slice(1).toLowerCase()}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead style={{ backgroundColor: "#f9f9f9" }}>
                      <tr>
                        <th className="py-2 px-3 w-8">
                          <input type="checkbox" className="rounded" />
                        </th>
                        {[
                          "Task",
                          "Due Date",
                          "Priority",
                          "Status",
                          "Progress",
                          "Actions",
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
                      {latestFilteredTasks.map((task) => (
                        <tr
                          key={task._id}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                          data-testid={`task-row-${task._id}`}
                          onClick={() => navigate(`/tasks/${task._id}`)}
                        >
                          <td
                            className="py-1.5 px-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input type="checkbox" className="rounded" />
                          </td>
                          <td className="py-1.5 px-3">
                            <div className="flex items-center gap-1.5">
                              {getTaskTypeIcon(task, 13)}
                              {task.isRisk && (
                                <span
                                  title="At Risk"
                                  className="text-red-500 text-xs"
                                >
                                  ⚠️
                                </span>
                              )}
                              <span
                                className="text-sm font-medium truncate max-w-[180px] block"
                                style={{ color: "#676a6c" }}
                                title={task.title}
                              >
                                {task.title}
                              </span>
                              {task.isPastDue && (
                                <Clock
                                  size={10}
                                  className="text-red-400 shrink-0"
                                  title="Past Due"
                                />
                              )}
                              {task.isDueToday && (
                                <Calendar
                                  size={10}
                                  className="text-orange-400 shrink-0"
                                  title="Due Today"
                                />
                              )}
                            </div>
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
                            className="py-1.5 px-3 text-xs whitespace-nowrap"
                            style={{ color: "#9a9a9a" }}
                          >
                            {task.dueDate
                              ? new Date(task.dueDate).toLocaleDateString(
                                  "en-GB",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  },
                                )
                              : "—"}
                          </td>

                          <td className="py-1.5 px-3">
                            {getPriorityBadge(task.priority)}
                          </td>

                          <td className="py-1.5 px-3">
                            {getStatusBadge(task.status)}
                          </td>

                          {/* Progress column */}
                          <td className="py-1.5 px-3">
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

                          <td
                            className="py-1.5 px-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-1">
                              <button
                                className="p-1 hover:text-blue-500 transition-colors rounded-sm"
                                style={{ color: "#9a9a9a" }}
                                title="Start"
                              >
                                <ArrowUpRight size={12} />
                              </button>
                              <button
                                className="p-1 hover:text-orange-500 transition-colors rounded-sm"
                                style={{ color: "#9a9a9a" }}
                                title="Snooze"
                              >
                                <Clock size={12} />
                              </button>
                              <button
                                className={`p-1 hover:text-red-500 transition-colors rounded-sm ${
                                  deletingTaskId === task._id
                                    ? "opacity-40 cursor-not-allowed"
                                    : ""
                                }`}
                                style={{ color: "#9a9a9a" }}
                                data-testid={`button-delete-${task._id}`}
                                disabled={deletingTaskId === task._id}
                                onClick={() => setDeleteConfirmTaskId(task._id)}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {latestFilteredTasks.length === 0 && (
                    <div className="text-center py-6">
                      <div className="w-10 h-10 bg-gray-100 rounded-sm flex items-center justify-center mx-auto mb-2">
                        <CheckSquare className="text-gray-300" size={18} />
                      </div>
                      <p className="text-sm" style={{ color: "#9a9a9a" }}>
                        No tasks match your search
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ══ CREATE TASK DRAWER ══ */}
          {showCreateTaskDrawer && (
            <div className="fixed inset-0 z-[100] overflow-hidden">
              <div
                className="absolute inset-0 bg-black/40"
                onClick={handleCloseCreateTask}
              />
              <div className="absolute right-0 top-0 bottom-0 w-full max-w-3xl bg-white shadow-2xl flex flex-col">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 flex-shrink-0">
                  <h1 className="text-base font-semibold text-white">
                    Create New Task
                  </h1>
                  <button
                    onClick={handleCloseCreateTask}
                    className="text-blue-200 hover:text-white p-1.5 rounded-sm"
                    data-testid="button-close-create-task"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto create-task-square-ui">
                  <style>{`
                    .create-task-square-ui * {
                      border-radius: 6px !important;
                    }
                  `}</style>
                  <CreateTask
                    onSubmit={handleCreateTaskSubmit}
                    onClose={handleCloseCreateTask}
                    initialTaskType="regular"
                    preFilledDate={selectedDateForTask}
                    drawer={false}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ DELETE CONFIRM ══ */}
      <CustomConfirmationModal
        isOpen={!!deleteConfirmTaskId}
        onClose={() => setDeleteConfirmTaskId(null)}
        onConfirm={() => {
          handleDeleteTask(deleteConfirmTaskId);
          setDeleteConfirmTaskId(null);
        }}
        type="danger"
        title="Delete Task"
        message="Are you sure you want to delete this task? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
};

export default IndividualDashboard;
