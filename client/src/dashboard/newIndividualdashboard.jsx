import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
  Download, // added
  ListChecks, // added
} from "lucide-react";
import CreateTask from "../pages/newComponents/CreateTask";
import ReactECharts from "../components/ReactECharts";
import { useActiveRole } from "../components/RoleSwitcher";
import { quickTasksAPI } from "../services/quickTasksAPI";
import {
  QuickTaskIcon,
  RecurringTaskIcon,
  RegularTaskIcon,
} from "../components/common/TaskIcons";
import CommonLoader from "../components/common/CommonLoader";
import { useShowToast } from "@/utils/ToastMessage";

/**
 * Individual User Dashboard - Personal workspace for individual users
 * Displays personal tasks, KPIs, calendar, and quick actions
 */
const IndividualDashboard = ({
  tasks = [],
  quickTasks = [],
  pinnedTasks = [],
  userStats = {},
}) => {
  // Get active role from context
  const { activeRole, setActiveRole } = useActiveRole();
  const { showSuccessToast, showErrorToast } = useShowToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [quickTaskInput, setQuickTaskInput] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateTaskDrawer, setShowCreateTaskDrawer] = useState(false);
  const [recurringDone, setRecurringDone] = useState({});

  // Quick Task creation states
  const [isCreatingQuickTask, setIsCreatingQuickTask] = useState(false);
  const [quickTaskError, setQuickTaskError] = useState(null);
  const [quickTaskSuccess, setQuickTaskSuccess] = useState(null);

  // Get current user data
  const { data: user } = useQuery({
    queryKey: ["/api/auth/verify"],
    retry: false,
  });
  console.log("Current user data:", user);
  // Fetch dashboard stats from API
  const {
    data: dashboardStats,
    error: dashboardError,
    isLoading: dashboardLoading,
  } = useQuery({
    queryKey: ["/api/dashboard/task-counts"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authorization token not found.");
      }
      const res = await fetch(
        `/api/dashboard/task-counts?user_id=${user.id}&user_type=${currentRole}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (res.status === 401) {
        throw new Error("Unauthorized: Please login again.");
      }
      if (!res.ok) {
        throw new Error(`Failed to fetch dashboard stats: ${res.status}`);
      }
      const data = await res.json();
      console.log("Dashboard stats API response:", data);
      return data.data; // Extract the data from the response
    },
    retry: false,
    enabled: !!localStorage.getItem("token"), // Only run if token exists
  });

  // Fetch tasks for current user role from API with Authorization token
  const {
    data: myTasksData,
    error: myTasksError,
    isLoading: myTasksLoading,
  } = useQuery({
    queryKey: ["/api/mytasks", 1, 100],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authorization token not found.");
      }
      const res = await fetch("/api/mytasks?page=1&limit=100", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.status === 401) {
        throw new Error("Unauthorized: Please login again.");
      }
      return res.json();
    },
    retry: false,
  });

  // Navigation hook
  const [, navigate] = useLocation();

  // Initialize active role when user data is loaded
  React.useEffect(() => {
    if (user?.role?.[0] && !activeRole) {
      console.log("🔄 Setting initial active role:", user.role[0]);
      setActiveRole(user.role[0]);
    }
  }, [user, activeRole, setActiveRole]);

  // Determine current role to use
  const currentRole = activeRole || user?.role?.[0] || "employee";

  // Extract tasks for the active role from API response
  const roleTasks = myTasksData?.data?.roles?.[currentRole] || [];

  // Use API data or fallback to passed tasks
  const demoTasks = useMemo(() => generateMockTasks(), []);
  // Local state for tasks to avoid mutating props or query data
  const [localTasks, setLocalTasks] = useState(null);
  const currentTasks =
    localTasks ??
    (roleTasks.length > 0 ? roleTasks : tasks.length > 0 ? tasks : demoTasks);

  // Use API dashboard stats or fallback to userStats (mock)

  // Use API stats -> provided userStats -> compute from currentTasks

  // const computedStats = useMemo(() => computeStatsFromTasks(currentTasks), [currentTasks]);
  const computedStats = useMemo(() => {
    const stats = computeStatsFromTasks(currentTasks);
    console.log("computedStats (calculate hua from tasks):", stats);
    return stats;
  }, [currentTasks]);

  // Map API response to expected format
  const mappedDashboardStats = dashboardStats
    ? {
        completedTasks: dashboardStats.completedToday || 0,
        totalTasks: dashboardStats.beforeDueDate || 0,
        inProgressTasks: dashboardStats.milestones || 0,
        upcomingDeadlines: dashboardStats.collaborator || 0,
        overdueTasks: dashboardStats.pastDue || 0,
        tasksByPriority: {
          urgent: dashboardStats.approvals || 0,
        },
      }
    : null;

  const currentStats =
    mappedDashboardStats ||
    (userStats && Object.keys(userStats).length ? userStats : computedStats);
  // Derived metrics for Task Health and Overdue
  const now = new Date();
  const statusOf = (s) => (s || "").toLowerCase();
  const openCount = currentTasks.filter((t) =>
    ["pending", "todo", "open"].includes(statusOf(t.status)),
  ).length;
  const inProgressCount = currentTasks.filter((t) =>
    ["in_progress", "in-progress", "doing"].includes(statusOf(t.status)),
  ).length;
  const completedCount = currentTasks.filter(
    (t) => statusOf(t.status) === "completed",
  ).length;
  const overdueCount = currentTasks.filter(
    (t) =>
      t.dueDate &&
      new Date(t.dueDate) < now &&
      statusOf(t.status) !== "completed",
  ).length;

  // Recurring adherence (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recurringTasksFull = currentTasks.filter(
    (t) => t.isRecurring || t.recurringInterval,
  );
  const recurringDue = recurringTasksFull.filter(
    (t) =>
      t.dueDate &&
      new Date(t.dueDate) >= sevenDaysAgo &&
      new Date(t.dueDate) <= now,
  );
  const recurringOnTime = recurringDue.filter(
    (t) =>
      statusOf(t.status) === "completed" &&
      t.completedAt &&
      new Date(t.completedAt) <= new Date(t.dueDate),
  ).length;
  const recurringMissed = recurringDue.filter(
    (t) => statusOf(t.status) !== "completed" && new Date(t.dueDate) < now,
  ).length;
  const recurringAdherencePct = recurringDue.length
    ? Math.round((recurringOnTime / recurringDue.length) * 100)
    : 100;

  // Efficiency: On-time vs Late (completed tasks)
  const completedOnTimeCount = currentTasks.filter((t) => {
    if (statusOf(t.status) !== "completed") return false;
    if (!t.dueDate || !t.completedAt) return false;
    return new Date(t.completedAt) <= new Date(t.dueDate);
  }).length;
  const completedLateCount = currentTasks.filter((t) => {
    if (statusOf(t.status) !== "completed") return false;
    if (!t.dueDate || !t.completedAt) return false;
    return new Date(t.completedAt) > new Date(t.dueDate);
  }).length;
  const efficiencyPieOptions = {
    tooltip: { trigger: "item" },
    series: [
      {
        type: "pie",
        radius: ["45%", "70%"],
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        data: [
          {
            value: completedOnTimeCount,
            name: "On-time",
            itemStyle: { color: "#16a34a" },
          },
          {
            value: completedLateCount,
            name: "Late",
            itemStyle: { color: "#ef4444" },
          },
        ],
      },
    ],
  };
  // Completion Trend: last 7 days
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const dayKey = (d) => d.toISOString().slice(0, 10);
  const dayLabel = (d) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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

  const trendLabels = last7.map((d) => dayLabel(d));
  const trendCounts = last7.map((d) => dayMap[dayKey(d)] || 0);

  const completionTrendOptions = {
    color: ["#2563eb"],
    tooltip: { trigger: "axis" },
    grid: { left: 24, right: 12, top: 24, bottom: 24 },
    xAxis: {
      type: "category",
      data: trendLabels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: "#e5e7eb" } },
      axisLabel: { color: "#6b7280" },
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      axisLine: { show: false },
      splitLine: { lineStyle: { color: "#e5e7eb" } },
      axisLabel: { color: "#6b7280" },
    },
    series: [
      {
        type: "line",
        data: trendCounts,
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        areaStyle: { color: "rgba(37,99,235,0.1)" },
      },
    ],
  };

  const samplePinnedTasks =
    pinnedTasks.length > 0
      ? pinnedTasks
      : [
          { id: 1, title: "Weekly planning session", priority: "high" },
          { id: 2, title: "Client feedback review", priority: "medium" },
          { id: 3, title: "Sprint retrospective", priority: "low" },
        ];

  const handleQuickTaskSubmit = async () => {
    if (!quickTaskInput.trim()) return;

    setIsCreatingQuickTask(true);
    setQuickTaskError(null);
    setQuickTaskSuccess(null);

    try {
      console.log("🚀 Creating quick task:", quickTaskInput);

      const taskData = {
        title: quickTaskInput.trim(),
        priority: "medium", // Default priority
        status: "open",
      };

      const result = await quickTasksAPI.createQuickTask(taskData);
      console.log("✅ Quick task created successfully:", result);

      // Clear input and show success
      setQuickTaskInput("");
      setQuickTaskSuccess("Quick task created successfully!");

      // Redirect to Quick Tasks page after 1.5 seconds
      setTimeout(() => {
        navigate("/quick-tasks");
      }, 1500);
    } catch (error) {
      console.error("❌ Error creating quick task:", error);
      setQuickTaskError(error.message || "Failed to create quick task");

      // Clear error message after 5 seconds
      setTimeout(() => {
        setQuickTaskError(null);
      }, 5000);
    } finally {
      setIsCreatingQuickTask(false);
    }
  };

  const handleCreateTask = () => {
    setShowCreateTaskDrawer(true);
  };

  const handleCreateTaskSubmit = (taskData) => {
    console.log("Task created from dashboard:", taskData);
    setShowCreateTaskDrawer(false);
  };

  const handleCloseCreateTask = () => {
    setShowCreateTaskDrawer(false);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "text-red-600 bg-red-50 border-red-200";
      case "medium":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "low":
        return "text-green-600 bg-green-50 border-green-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "text-green-700 bg-green-100";
      case "in_progress":
        return "text-blue-700 bg-blue-100";
      case "pending":
        return "text-gray-700 bg-gray-100";
      case "blocked":
        return "text-red-700 bg-red-100";
      default:
        return "text-gray-700 bg-gray-100";
    }
  };

  // Recurring tasks (fallback if none on tasks) - Empty initial state
  const defaultRecurring = [];
  const recurringTasks =
    currentTasks
      .filter((t) => t.isRecurring || t.recurringInterval)
      .map((t) => ({
        id: t.id,
        title: t.title,
        frequency: t.recurringInterval || "recurring",
      })) || [];
  const recurringItems =
    recurringTasks.length > 0 ? recurringTasks : defaultRecurring;

  const toggleRecurring = (id) =>
    setRecurringDone((s) => ({ ...s, [id]: !s[id] }));

  const handleViewMyTasks = () => {
    document.getElementById("my-tasks")?.scrollIntoView({ behavior: "smooth" });
    setShowFilters(true);
  };

  const exportMyReport = () => {
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
    rows.push(["Task ID", "Title", "Status", "Priority", "Due Date"]);
    currentTasks.forEach((t) =>
      rows.push([
        t.id,
        t.title,
        t.status,
        t.priority,
        t.dueDate ? new Date(t.dueDate).toISOString() : "",
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
    a.download = "my-task-report.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const printMyReport = () => {
    window.print();
  };

  const copyShareLink = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("search", searchTerm);
      url.searchParams.set("filter", selectedFilter);
      url.searchParams.set("priority", priorityFilter);
      if (dueFrom) url.searchParams.set("dueFrom", dueFrom);
      else url.searchParams.delete("dueFrom");
      if (dueTo) url.searchParams.set("dueTo", dueTo);
      else url.searchParams.delete("dueTo");
      navigator.clipboard?.writeText(url.toString());
      showSuccessToast("Share link copied to clipboard");
    } catch (e) {
      console.error("Copy link failed", e);
    }
  };

  // State for local task deletion feedback
  const [deletingTaskId, setDeletingTaskId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  // Show error if unauthorized or other API error
  if (myTasksError) {
    return (
      <div className="p-4 space-y-3 bg-gray-50 min-h-screen">
        <div className="text-center py-10">
          <span className="text-lg text-red-500">{myTasksError.message}</span>
        </div>
      </div>
    );
  }

  // Delete task API logic
  const handleDeleteTask = async (taskId) => {
    setDeletingTaskId(taskId);
    setDeleteError(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setDeleteError("Authorization token not found.");
        setDeletingTaskId(null);
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
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        setDeleteError(data.message || "Failed to delete task.");
        setDeletingTaskId(null);
        return;
      }
      // Remove deleted task from UI (local only, will refetch on next load)
      setLocalTasks((prev) =>
        prev
          ? prev.filter((t) => t._id !== taskId)
          : currentTasks.filter((t) => t._id !== taskId),
      );
      setDeletingTaskId(null);
    } catch (err) {
      setDeleteError(err.message || "Error deleting task.");
      setDeletingTaskId(null);
    }
  };

  const filteredTasks = currentTasks.filter((task) => {
    const matchesSearch =
      !searchTerm ||
      searchTerm === "" ||
      (task.title &&
        task.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (task.description &&
        task.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (task.tags &&
        task.tags.some(
          (tag) => tag && tag.toLowerCase().includes(searchTerm.toLowerCase()),
        ));
    const matchesFilter =
      selectedFilter === "all"
        ? true
        : selectedFilter === "overdue"
          ? task.dueDate &&
            new Date(task.dueDate) < now &&
            statusOf(task.status) !== "completed"
          : statusOf(task.status) === selectedFilter;
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

  // Computes basic stats from a list of tasks
  function computeStatsFromTasks(tasks) {
    const now = new Date();
    const statusOf = (s) => (s || "").toLowerCase();
    const openCount = tasks.filter((t) =>
      ["pending", "todo", "open"].includes(statusOf(t.status)),
    ).length;
    const inProgressCount = tasks.filter((t) =>
      ["in_progress", "in-progress", "doing"].includes(statusOf(t.status)),
    ).length;
    const completedCount = tasks.filter(
      (t) => statusOf(t.status) === "completed",
    ).length;
    const overdueCount = tasks.filter(
      (t) =>
        t.dueDate &&
        new Date(t.dueDate) < now &&
        statusOf(t.status) !== "completed",
    ).length;

    // Return in the same format as expected by UI
    return {
      completedTasks: completedCount, // Map to expected format
      totalTasks: tasks.length,
      inProgressTasks: inProgressCount,
      upcomingDeadlines: tasks.filter(
        (t) =>
          t.dueDate &&
          new Date(t.dueDate) > now &&
          statusOf(t.status) !== "completed",
      ).length,
      overdueTasks: overdueCount,
      tasksByPriority: {
        urgent: tasks.filter((t) => (t.priority || "").toLowerCase() === "high")
          .length,
      },
      // Keep original for backward compatibility
      openCount,
      inProgressCount,
      completedCount,
      overdueCount,
    };
  }
  // Simple mock function to generate demo tasks if API data is unavailable
  function generateMockTasks() {
    return [
      {
        id: 1,
        title: "Demo Task 1",
        description: "This is a demo task.",
        status: "pending",
        dueDate: new Date().toISOString(),
        isRecurring: false,
        priority: "medium",
      },
      {
        id: 2,
        title: "Demo Task 2",
        description: "Another demo task.",
        status: "completed",
        dueDate: new Date(Date.now() - 86400000).toISOString(),
        completedAt: new Date().toISOString(),
        isRecurring: true,
        recurringInterval: "weekly",
        priority: "high",
      },
    ];
  }
  const cards = [
    {
      id: "card-regular-task",
      label: "Regular Task",
      value: dashboardStats?.regularTasksCount ?? 0,
      icon: <RegularTaskIcon className="text-purple-600" size={20} />,
      iconBg: "bg-purple-100",
    },
    {
      id: "card-recurring-task",
      label: "Recurring Task",
      value: dashboardStats?.recurringTasksCount ?? 0,
      icon: <RecurringTaskIcon className="text-yellow-600" size={20} />,
      iconBg: "bg-yellow-100",
    },
    {
      id: "card-quick-task",
      label: "Quick Task",
      value: dashboardStats?.quickTasksCount ?? 0,
      icon: <QuickTaskIcon className="text-orange-600" size={20} />,
      iconBg: "bg-orange-100",
    },
    {
      id: "card-completed-today",
      label: "Completed Today",
      value: dashboardStats?.completedTodayCount ?? 0,
      icon: <CheckSquare className="text-green-600" size={20} />,
      iconBg: "bg-green-100",
    },
    {
      id: "card-completed-before-due",
      label: "Before Due Date",
      value: dashboardStats?.beforeDueDateCount ?? 0,
      icon: <Clock className="text-blue-600" size={20} />,
      iconBg: "bg-blue-100",
    },
    {
      id: "card-past-due",
      label: "Past Due",
      value: dashboardStats?.pastDueDateCount ?? 0,
      icon: <AlertTriangle className="text-red-600" size={20} />,
      iconBg: "bg-red-100",
    },
  ];
  return (
    <div className="p-4 space-y-3 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.firstName || "User"}!
          </h1>
          <p className="text-gray-600 mt-1">
            Here's your personal workspace and task overview
          </p>
        </div>
        <button
          onClick={handleCreateTask}
          className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-md flex items-center gap-2 transition-colors"
          data-testid="button-create-task"
        >
          <Plus size={18} />
          Create Task
        </button>
      </div>

      {/* Quick Actions */}
      {/* <div className="flex items-center gap-3">
        <button
          onClick={handleViewMyTasks}
          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-sm flex items-center gap-2"
        >
          <ListChecks size={16} />
          View My Tasks
        </button>
        <button
          onClick={exportMyReport}
          className="px-3 py-2 bg-white hover:bg-gray-50 border rounded-sm text-gray-800 flex items-center gap-2"
        >
          <Download size={16} />
          Export My Report
        </button>
        <button
          onClick={printMyReport}
          className="px-3 py-2 bg-white hover:bg-gray-50 border rounded-sm text-gray-800"
        >
          Print (PDF)
        </button>
        <button
          onClick={copyShareLink}
          className="px-3 py-2 bg-white hover:bg-gray-50 border rounded-sm text-gray-800"
        >
          Copy Share Link
        </button>
      </div> */}

      {/* Overdue Alert */}
      {/* {overdueCount > 0 && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-red-600" size={18} />
            <span>
              You have {overdueCount} overdue {overdueCount === 1 ? "task" : "tasks"} ⚠️
            </span>
          </div>
          <button
            onClick={() => {
              setShowFilters(true);
              setSelectedFilter("overdue");
              document.getElementById("my-tasks")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="text-red-700 hover:text-red-900 font-medium px-3 py-2 rounded-md border border-red-200 bg-red-100 hover:bg-red-200 transition-colors"
          >
            View Overdue
          </button>
        </div>
      )} */}

      {/* Task Health Cards */}
      {/* <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-sm shadow-sm border">
          <p className="text-sm text-gray-600">Open</p>
          <p className="text-2xl font-semibold text-gray-900">{openCount}</p>
        </div>
        <div className="bg-white p-4 rounded-sm shadow-sm border">
          <p className="text-sm text-gray-600">In Progress</p>
          <p className="text-2xl font-semibold text-gray-900">{inProgressCount}</p>
        </div>
        <div className="bg-white p-4 rounded-sm shadow-sm border">
          <p className="text-sm text-gray-600">Completed</p>
          <p className="text-2xl font-semibold text-gray-900">{completedCount}</p>
        </div>
        <div className="bg-white p-4 rounded-sm shadow-sm border">
          <p className="text-sm text-gray-600">Overdue</p>
          <p className="text-2xl font-semibold text-gray-900">{overdueCount}</p>
        </div>
      </div> */}

      {/* Completion Trend (7 days) */}

      {/* <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-sm shadow-sm border">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-900">Completion Trend (7 days)</h2>
          </div>
          <ReactECharts option={completionTrendOptions} style={{ height: 220 }} />
        </div>
        <div className="bg-white p-4 rounded-sm shadow-sm border">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-900">Efficiency (On-time vs Late)</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
            <ReactECharts option={efficiencyPieOptions} style={{ height: 220 }} />
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">On-time</span>
                <span className="font-medium text-gray-900">{completedOnTimeCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Late</span>
                <span className="font-medium text-gray-900">{completedLateCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div> */}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map(({ id, label, value, icon, iconBg }) => (
          <div
            key={id}
            className="bg-white p-4 rounded-md shadow-sm border"
            data-testid={id}
          >
            <div className="flex items-center gap-3">
              <div className={`${iconBg} p-2 rounded-md flex-shrink-0`}>
                {icon}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm text-gray-600 truncate" title={label}>
                  {label}
                </p>
                <p className="text-xl font-bold text-gray-900">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Overdue Report (sorted by days overdue) */}
      {overdueCount > 0 ? (
        <div className="bg-white rounded-md shadow-sm border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Overdue Report
            </h2>
            <span className="text-sm text-gray-600">{overdueCount} items</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">
                    Task
                  </th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">
                    Due Date
                  </th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">
                    Days Overdue
                  </th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">
                    Priority
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentTasks
                  .filter(
                    (t) =>
                      t.dueDate &&
                      new Date(t.dueDate) < now &&
                      statusOf(t.status) !== "completed",
                  )
                  .map((t) => ({
                    ...t,
                    daysOverdue: Math.max(
                      1,
                      Math.ceil((now - new Date(t.dueDate)) / 86400000),
                    ),
                  }))
                  .sort((a, b) => b.daysOverdue - a.daysOverdue)
                  .slice(0, 20)
                  .map((t) => (
                    <tr key={`overdue-${t.id}`} className="hover:bg-gray-50">
                      <td className="py-3 px-6 text-sm text-gray-900">
                        {t.title}
                      </td>
                      <td className="py-3 px-6 text-sm text-gray-900">
                        {new Date(t.dueDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-6 text-sm font-semibold text-red-600">
                        {t.daysOverdue}
                      </td>
                      <td className="py-3 px-6">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(t.priority)}`}
                        >
                          {t.priority}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-sm">
          <div className="flex items-center gap-2">
            <CheckSquare className="text-green-600" size={18} />
            <span>All caught up ✅ No overdue tasks.</span>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Left Column - Quick Task & Recurring & Pinned Tasks */}
        <div className="space-y-3">
          {/* Frozen Quick Task Tile */}
          <div
            className="bg-white p-4 rounded-md shadow-sm border sticky top-6"
            data-testid="card-quick-task"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Quick Add Task
            </h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="What needs to be done?"
                value={quickTaskInput}
                onChange={(e) => setQuickTaskInput(e.target.value)}
                className="w-full h-9 px-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                data-testid="input-quick-task"
                onKeyPress={(e) =>
                  e.key === "Enter" &&
                  !isCreatingQuickTask &&
                  handleQuickTaskSubmit()
                }
                disabled={isCreatingQuickTask}
              />
              <button
                onClick={handleQuickTaskSubmit}
                disabled={!quickTaskInput.trim() || isCreatingQuickTask}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2 px-4 rounded-md transition-colors"
                data-testid="button-add-quick-task"
              >
                {isCreatingQuickTask ? (
                  <>
                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus size={16} className="inline mr-2" />
                    Add Quick Task
                  </>
                )}
              </button>

              {/* Success Message */}
              {quickTaskSuccess && (
                <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 border border-green-200 rounded-md p-2">
                  <CheckSquare size={16} />
                  {quickTaskSuccess}
                </div>
              )}

              {/* Error Message */}
              {quickTaskError && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-md p-2">
                  <AlertTriangle size={16} />
                  {quickTaskError}
                </div>
              )}
            </div>
          </div>

          {/* Pinned Tasks */}
          <div
            className="bg-white p-4 rounded-md shadow-sm border"
            data-testid="card-pinned-tasks"
          >
            <div className="flex items-center gap-2 mb-3">
              <Star className="text-yellow-500" size={20} />
              <h2 className="text-lg font-semibold text-gray-900">
                Pinned Tasks
              </h2>
            </div>
            <div className="space-y-3">
              {samplePinnedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-md hover:bg-gray-100 cursor-pointer transition-colors"
                  data-testid={`pinned-task-${task.id}`}
                >
                  <span
                    className="text-sm font-medium text-gray-900 truncate"
                    title={task.title}
                  >
                    {task.title}
                  </span>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}
                  >
                    {task.priority}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Middle Column - Tasks Grid */}
        <div className="lg:col-span-2">
          <div
            id="my-tasks"
            className="h-full bg-white rounded-md shadow-sm border"
            data-testid="card-tasks-grid"
          >
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900">
                  My Tasks
                </h2>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="text-gray-600 hover:text-gray-900 p-2 rounded-md hover:bg-gray-100"
                  data-testid="button-toggle-filters"
                >
                  <Filter size={18} />
                </button>
              </div>

              {/* Search and Filters */}
              <div className="space-y-3">
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                    size={18}
                  />
                  <input
                    type="text"
                    placeholder="Search tasks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-9 pl-10 pr-4 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    data-testid="input-search-tasks"
                  />
                </div>

                {showFilters && (
                  <div className="flex gap-2 flex-wrap">
                    {[
                      "all",
                      "pending",
                      "in_progress",
                      "completed",
                      "overdue",
                    ].map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setSelectedFilter(filter)}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                          selectedFilter === filter
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                        data-testid={`filter-${filter}`}
                      >
                        {filter.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Tasks Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Task
                    </th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTasks.map((task) => (
                    <tr
                      key={task._id}
                      className="hover:bg-gray-50"
                      data-testid={`task-row-${task._id}`}
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {task.title}
                              </span>
                              <div className="flex gap-1">
                                {task.isPastDue && (
                                  <Clock
                                    className="text-red-500"
                                    size={14}
                                    title="Past Due"
                                  />
                                )}
                                {task.isDueToday && (
                                  <Calendar
                                    className="text-orange-500"
                                    size={14}
                                    title="Due Today"
                                  />
                                )}
                                {task.hasSubtasks && (
                                  <CheckSquare
                                    className="text-blue-500"
                                    size={14}
                                    title="Has Subtasks"
                                  />
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1 mt-1">
                              {task.tags?.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                                >
                                  {tag}
                                </span>
                              )) || null}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-900">
                        {task.dueDate
                          ? new Date(task.dueDate).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(task.priority)}`}
                        >
                          {task.priority}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}
                        >
                          {task.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <button
                            className="text-gray-600 hover:text-blue-600 p-1 rounded"
                            data-testid={`button-edit-${task._id}`}
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            className={`text-gray-600 hover:text-red-600 p-1 rounded ${deletingTaskId === task._id ? "opacity-50 cursor-not-allowed" : ""}`}
                            data-testid={`button-delete-${task._id}`}
                            disabled={deletingTaskId === task._id}
                            onClick={() => handleDeleteTask(task._id)}
                          >
                            <Trash2 size={14} />
                          </button>
                          <button
                            className="text-gray-600 hover:text-gray-900 p-1 rounded"
                            data-testid={`button-more-${task._id}`}
                          >
                            <MoreHorizontal size={14} />
                          </button>
                        </div>
                        {deleteError && deletingTaskId === task._id && (
                          <div className="text-xs text-red-500 mt-1">
                            {deleteError}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredTasks.length === 0 && (
              <div className="text-center py-8 text-gray-500 ">
                <CheckSquare className="mx-auto mb-2" size={48} />
                <p>No tasks found matching your search criteria</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Calendar Section */}
      <div
        className="bg-white rounded-md shadow-sm border p-4"
        data-testid="card-calendar"
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Task Calendar
        </h2>
        <div className="bg-gray-50 rounded-md p-7 text-center">
          <Calendar className="mx-auto mb-2 text-gray-400" size={48} />
          <p className="text-gray-600">Calendar view coming soon</p>
          <p className="text-sm text-gray-500 mt-1">
            View and manage your tasks by date with drag-and-drop functionality
          </p>
        </div>
      </div>

      {/* Create Task Drawer */}
      {showCreateTaskDrawer && (
        <div className="fixed inset-0 z-[100] overflow-hidden">
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={handleCloseCreateTask}
          />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-3xl bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 bg-gradient-to-r from-green-600 to-teal-600 flex-shrink-0">
              <h2 className="text-lg font-medium text-white">
                Create New Task
              </h2>
              <button
                onClick={handleCloseCreateTask}
                className="text-gray-300 hover:text-white p-2"
                data-testid="button-close-create-task"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <CreateTask
                onSubmit={handleCreateTaskSubmit}
                onClose={handleCloseCreateTask}
                initialTaskType="regular"
                drawer={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IndividualDashboard;
