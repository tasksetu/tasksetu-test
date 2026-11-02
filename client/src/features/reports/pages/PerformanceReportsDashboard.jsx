import React, { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Users,
  User,
  Clock,
  CheckCircle,
  FileText,
  Award,
  Download,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  History,
  RotateCcw,
  ShieldAlert,
  ChevronRight,
  Search,
  ExternalLink,
  HelpCircle,
  Loader2,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import { useAuth } from "@/features/shared/hooks/useAuth";
import {
  usePerformanceOverview,
  useTeamPerformance,
  useEmployeePerformance,
  useOverdueTaskAnalysis,
  usePerformanceReviews,
} from "../hooks/usePerformanceReports";
import {
  TaskAuditDrawer,
  PerformanceReviewModal,
  EmployeeAcknowledgeModal,
} from "../components";

const COLORS = {
  emerald: "#10b981",
  teal: "#14b8a6",
  amber: "#f59e0b",
  rose: "#f43f5e",
  blue: "#3b82f6",
  indigo: "#6366f1",
  purple: "#8b5cf6",
  slate: "#64748b",
};

export const PerformanceReportsDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview"); // overview, team, employee, overdue, reviews

  // Filter States
  const [periodType, setPeriodType] = useState("30"); // 7, 30, 90, custom
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [department, setDepartment] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [orgEmployees, setOrgEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Overdue interactive filter
  const [selectedOverdueBucket, setSelectedOverdueBucket] = useState("ALL");

  // Modals & Drawers state
  const [auditTaskId, setAuditTaskId] = useState(null);
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [acknowledgeReview, setAcknowledgeReview] = useState(null);
  const [isAcknowledgeModalOpen, setIsAcknowledgeModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Active Pipeline interactive filter & task drilldown modal
  const [selectedPipelineStatus, setSelectedPipelineStatus] = useState(null);
  const [pipelineTaskSearch, setPipelineTaskSearch] = useState("");

  // Employee task pagination & filter
  const [employeeTaskStatusFilter, setEmployeeTaskStatusFilter] = useState("ALL");
  const [employeeTaskSearch, setEmployeeTaskSearch] = useState("");

  // Role checks
  const isOrgAdmin =
    user?.role === "org_admin" ||
    (Array.isArray(user?.role) && user.role.includes("org_admin"));
  const isManager =
    user?.role === "manager" ||
    (Array.isArray(user?.role) && user.role.includes("manager"));
  const canCreateReviews = isOrgAdmin || isManager;

  // Fetch Organization Employees for filters and selectors
  useEffect(() => {
    let cancelled = false;
    const fetchEmployees = async () => {
      setLoadingEmployees(true);
      try {
        const token =
          localStorage.getItem("token") ||
          sessionStorage.getItem("token") ||
          localStorage.getItem("authToken");
        const res = await fetch("/api/reports/performance/accessible-employees", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const payload = await res.json();
          const emps = payload?.data || payload?.employees || [];
          if (!cancelled) {
            setOrgEmployees(emps);
            // Default selected employee if none chosen
            if (!selectedEmployeeId && emps.length > 0) {
              // If employee role, select self
              if (!isOrgAdmin && !isManager) {
                const self = emps.find(
                  (e) => (e._id || e.id) === (user?._id || user?.id)
                );
                if (self) setSelectedEmployeeId(self._id || self.id);
                else setSelectedEmployeeId(emps[0]._id || emps[0].id);
              } else {
                setSelectedEmployeeId(emps[0]._id || emps[0].id);
              }
            }
          }
        }
      } catch (err) {
        console.warn("Could not fetch accessible employees:", err);
      } finally {
        if (!cancelled) setLoadingEmployees(false);
      }
    };
    fetchEmployees();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Handle Period Presets
  const handlePeriodPresetChange = (preset) => {
    setPeriodType(preset);
    if (preset !== "custom") {
      const days = parseInt(preset, 10);
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - days);
      setStartDate(start.toISOString().split("T")[0]);
      setEndDate(end.toISOString().split("T")[0]);
    }
  };

  // Queries
  const queryFilters = {
    startDate,
    endDate,
    department: department || undefined,
  };

  const overviewQuery = usePerformanceOverview(queryFilters, {
    enabled: activeTab === "overview",
  });

  const teamQuery = useTeamPerformance(queryFilters, {
    enabled: activeTab === "team",
  });

  const employeeQuery = useEmployeePerformance(
    selectedEmployeeId,
    queryFilters,
    {
      enabled: activeTab === "employee" && !!selectedEmployeeId,
    }
  );

  const overdueQuery = useOverdueTaskAnalysis(queryFilters, {
    enabled: activeTab === "overdue",
  });

  const reviewsQuery = usePerformanceReviews(
    {
      ...queryFilters,
      employeeId: selectedEmployeeId || undefined,
    },
    {
      enabled: activeTab === "reviews",
    }
  );

  // Drilldown to specific employee
  const handleDrilldownEmployee = (empId) => {
    setSelectedEmployeeId(empId);
    setActiveTab("employee");
  };

  // Open audit drawer
  const handleOpenAudit = (taskId) => {
    setAuditTaskId(taskId);
    setIsAuditDrawerOpen(true);
  };

  // Export Report
  const handleExport = async (format) => {
    setIsExporting(true);
    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");
      const params = new URLSearchParams({
        format,
        startDate,
        endDate,
        ...(department ? { department } : {}),
      });

      const res = await fetch(`/api/reports/performance/export?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        throw new Error("Failed to export report");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `TaskSetu_Performance_Report_${startDate}_${endDate}.${
        format === "csv" ? "csv" : "xlsx"
      }`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || "Export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  // Extract overview data safely
  const overview = overviewQuery.data?.data || overviewQuery.data || {};
  const kpis = overview.kpis || {};
  const prior = overview.priorPeriodDelta || overview.comparison || {};
  const trends = overview.trends || overview.trend || [];
  const workload = overview.workload || overview.priorityLoad || {};
  const overviewTasks = overview.tasks || [];

  // Helper to categorize task status into core pipeline stages
  const getStatusCategory = (t) => {
    const rawStatus = String(t?.status || "").trim().toUpperCase();
    const cleanStatus = rawStatus.replace(/[\s_-]+/g, "");
    if (["DONE", "COMPLETED", "ACHIEVED", "RESOLVED", "CLOSED"].includes(cleanStatus)) return "completed";
    if (["CANCELLED", "CANCELED", "REJECTED"].includes(cleanStatus)) return "cancelled";
    if (["ONHOLD", "HOLD", "WAITING", "BLOCKED"].includes(cleanStatus)) return "on_hold";
    if (["INPROGRESS", "DOING"].includes(cleanStatus)) return "in_progress";
    if (["OPEN", "TODO", "PENDING", "REOPENED"].includes(cleanStatus)) return "open";
    if (t?.systemStatus) {
      const sys = String(t.systemStatus).trim().toUpperCase().replace(/[\s_-]+/g, "");
      if (["DONE", "COMPLETED", "ACHIEVED"].includes(sys)) return "completed";
      if (["CANCELLED", "CANCELED", "REJECTED"].includes(sys)) return "cancelled";
      if (["ONHOLD", "HOLD", "WAITING", "BLOCKED"].includes(sys)) return "on_hold";
      if (["INPROGRESS", "DOING"].includes(sys)) return "in_progress";
    }
    return "open";
  };

  // Pipeline counts for all 5 operational statuses
  const pipelineCounts = {
    open: kpis.openTasks ?? kpis.openCount ?? overviewTasks.filter((t) => getStatusCategory(t) === "open").length,
    in_progress: kpis.inProgressTasks ?? kpis.inProgressCount ?? overviewTasks.filter((t) => getStatusCategory(t) === "in_progress").length,
    completed: kpis.completedTasks ?? kpis.completedCount ?? kpis.totalCompletedInPeriod ?? kpis.totalCompleted ?? overviewTasks.filter((t) => getStatusCategory(t) === "completed").length,
    cancelled: kpis.cancelledTasks ?? kpis.cancelledCount ?? overviewTasks.filter((t) => getStatusCategory(t) === "cancelled").length,
    on_hold: kpis.onHoldTasks ?? kpis.onHoldCount ?? kpis.blockedTasks ?? overviewTasks.filter((t) => getStatusCategory(t) === "on_hold").length,
  };

  const PIPELINE_STATUS_CONFIG = {
    open: {
      key: "open",
      label: "Open",
      count: pipelineCounts.open,
      colorClass: "bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/40 text-blue-600 dark:text-blue-400",
      badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
      description: "Tasks awaiting pickup or pending execution",
    },
    in_progress: {
      key: "in_progress",
      label: "In Progress",
      count: pipelineCounts.in_progress,
      colorClass: "bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/40 text-amber-600 dark:text-amber-400",
      badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
      description: "Tasks actively in progress and being worked on",
    },
    completed: {
      key: "completed",
      label: "Completed",
      count: pipelineCounts.completed,
      colorClass: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400",
      badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
      description: "Tasks successfully delivered and completed in this period",
    },
    cancelled: {
      key: "cancelled",
      label: "Cancelled",
      count: pipelineCounts.cancelled,
      colorClass: "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400",
      badgeClass: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
      description: "Tasks cancelled, aborted, or rejected",
    },
    on_hold: {
      key: "on_hold",
      label: "On Hold",
      count: pipelineCounts.on_hold,
      colorClass: "bg-purple-50 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900/40 text-purple-600 dark:text-purple-400",
      badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
      description: "Tasks paused, on hold, waiting, or blocked",
    },
  };

  // Filter overview tasks by selected pipeline status for drilldown modal
  const filteredPipelineTasks = overviewTasks.filter((t) => {
    if (!selectedPipelineStatus) return false;
    if (getStatusCategory(t) !== selectedPipelineStatus) return false;
    if (pipelineTaskSearch.trim()) {
      const q = pipelineTaskSearch.toLowerCase();
      const title = t.title?.toLowerCase() || "";
      const desc = t.description?.toLowerCase() || "";
      const assigneeName = (
        t.assignedTo?.name ||
        `${t.assignedTo?.firstName || ""} ${t.assignedTo?.lastName || ""}` ||
        t.assignedTo?.email ||
        ""
      ).toLowerCase();
      return title.includes(q) || desc.includes(q) || assigneeName.includes(q);
    }
    return true;
  });

  // Extract team data safely
  const teamData = teamQuery.data?.data || teamQuery.data || {};
  const teamMembers = teamData.members || [];
  const departmentBreakdown = teamData.departmentBreakdown || teamData.departmentSummary || [];

  // Extract employee data safely
  const employeeData = employeeQuery.data?.data || employeeQuery.data || {};
  const empProfile = employeeData.employee || {};
  const empKpis = employeeData.kpis || {};
  const empTasks = employeeData.tasks || [];

  // Filter employee tasks
  const filteredEmpTasks = empTasks.filter((t) => {
    if (employeeTaskStatusFilter !== "ALL") {
      const compStatus = (t.completionStatus || "").toUpperCase();
      const normStatus = (t.status || "").toLowerCase().replace(/[\s_-]+/g, "");
      if (
        employeeTaskStatusFilter === "OVERDUE" &&
        compStatus !== "OVERDUE"
      )
        return false;
      if (
        employeeTaskStatusFilter === "LATE" &&
        compStatus !== "LATE"
      )
        return false;
      if (
        employeeTaskStatusFilter === "ON_TIME" &&
        compStatus !== "ON_TIME" &&
        compStatus !== "EARLY"
      )
        return false;
      if (
        employeeTaskStatusFilter === "open" &&
        !["open", "todo", "pending", "reopened"].includes(normStatus)
      )
        return false;
      if (
        employeeTaskStatusFilter === "in_progress" &&
        !["inprogress", "doing"].includes(normStatus)
      )
        return false;
      if (
        employeeTaskStatusFilter === "completed" &&
        !["completed", "done", "achieved", "resolved", "closed"].includes(normStatus)
      )
        return false;
      if (
        (employeeTaskStatusFilter === "blocked" || employeeTaskStatusFilter === "on_hold") &&
        !["blocked", "onhold", "hold", "waiting"].includes(normStatus)
      )
        return false;
      if (
        employeeTaskStatusFilter === "cancelled" &&
        !["cancelled", "canceled", "rejected"].includes(normStatus)
      )
        return false;
    }
    if (employeeTaskSearch.trim()) {
      const q = employeeTaskSearch.toLowerCase();
      return (
        t.title?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Extract overdue data safely
  const overdueData = overdueQuery.data?.data || overdueQuery.data || {};
  const overdueBuckets = Array.isArray(overdueData.buckets) ? overdueData.buckets : [];
  const overdueTasks = overdueData.tasks || [];

  const filteredOverdueTasks = overdueTasks.filter((t) => {
    if (selectedOverdueBucket === "ALL") return true;
    return t.bucketKey === selectedOverdueBucket;
  });

  // Extract reviews data safely
  const reviewsList = Array.isArray(reviewsQuery.data?.data)
    ? reviewsQuery.data.data
    : Array.isArray(reviewsQuery.data?.reviews)
    ? reviewsQuery.data.reviews
    : Array.isArray(reviewsQuery.data)
    ? reviewsQuery.data
    : [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 md:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div>
              <h1
                className="text-2xl md:text-2xl font-normal m-0"
                style={{ color: "#676a6c" }}
              >
                Employee Performance & Task Reporting
              </h1>
              <p className="mt-0 text-sm text-blue-600">
                Auditable, historical performance evaluation, deadline compliance, and workload analytics
              </p>
            </div>
          </div>
        </div>

        {/* Global Export & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-md p-1 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => handleExport("xlsx")}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
              title="Download Excel Report"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Excel</span>
            </button>
            <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-600 mx-1" />
            <button
              onClick={() => handleExport("csv")}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
              title="Download CSV Report"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>CSV</span>
            </button>
          </div>

          {/* {canCreateReviews && (
            <button
              onClick={() => setIsReviewModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors"
            >
              <Award className="w-4 h-4" />
              <span>New Review / Reward / Notice</span>
            </button>
          )} */}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Period Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-md text-xs">
            {["7", "30", "90"].map((p) => (
              <button
                key={p}
                onClick={() => handlePeriodPresetChange(p)}
                className={`px-3 py-1.5 rounded font-medium transition-all ${
                  periodType === p
                    ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Last {p} Days
              </button>
            ))}
            <button
              onClick={() => setPeriodType("custom")}
              className={`px-3 py-1.5 rounded font-medium transition-all ${
                periodType === "custom"
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Custom
            </button>
          </div>

          {/* Custom Date Inputs */}
          {periodType === "custom" && (
            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Department Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              Dept:
            </span>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Departments</option>
              {Array.from(
                new Set(
                  orgEmployees.map((e) => e.department).filter(Boolean)
                )
              ).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Timezone & Cutoff Notice */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>
            Period: <strong className="text-slate-700 dark:text-slate-300">{startDate}</strong> to{" "}
            <strong className="text-slate-700 dark:text-slate-300">{endDate}</strong> (Cutoff: 23:59:59)
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-2 overflow-x-auto pb-1">
        {[
          { id: "overview", label: "Organization Overview", icon: BarChart3 },
          { id: "team", label: "Team Performance & Ranking", icon: Users },
          { id: "employee", label: "Employee Deep-Dive", icon: User },
          { id: "overdue", label: "Overdue Task Analysis", icon: AlertTriangle },
          // { id: "reviews", label: "Reviews, Rewards & Notices", icon: Award },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap ${
                isActive
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 shadow-xs"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ORGANIZATION OVERVIEW                                              */}
      {/* ========================================================================= */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* KPI 1: Assigned in Period */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm relative group">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                <span className="font-medium">Assigned in Period</span>
                <span title="Total tasks created & assigned during the selected timeframe">
                  <Info className="w-3.5 h-3.5 cursor-pointer text-slate-400 hover:text-slate-600" />
                </span>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {kpis.totalAssignedInPeriod ?? 0}
              </div>
              <div className="flex items-center gap-1 mt-2 text-xs">
                {prior.assignedDiff >= 0 ? (
                  <span className="flex items-center text-emerald-600 font-semibold">
                    <ArrowUpRight className="w-3.5 h-3.5" />+{prior.assignedDiff}%
                  </span>
                ) : (
                  <span className="flex items-center text-rose-600 font-semibold">
                    <ArrowDownRight className="w-3.5 h-3.5" />{prior.assignedDiff}%
                  </span>
                )}
                <span className="text-slate-400 text-[11px]">vs prior period</span>
              </div>
            </div>

            {/* KPI 2: On-Time Completion Rate */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm relative group">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                <span className="font-medium">On-Time Completion Rate</span>
                <span title="Formula: (Eligible tasks completed on/before deadline / completed tasks with valid deadline) * 100">
                  <Info className="w-3.5 h-3.5 cursor-pointer text-slate-400 hover:text-slate-600" />
                </span>
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {kpis.onTimeCompletionRate ?? 0}%
              </div>
              <div className="flex items-center gap-1 mt-2 text-xs">
                {prior.onTimeRateDiff >= 0 ? (
                  <span className="flex items-center text-emerald-600 font-semibold">
                    <ArrowUpRight className="w-3.5 h-3.5" />+{prior.onTimeRateDiff}%
                  </span>
                ) : (
                  <span className="flex items-center text-rose-600 font-semibold">
                    <ArrowDownRight className="w-3.5 h-3.5" />{prior.onTimeRateDiff}%
                  </span>
                )}
                <span className="text-slate-400 text-[11px]">
                  ({kpis.completedOnTime ?? 0} on-time / {kpis.totalCompletedInPeriod ?? 0} completed)
                </span>
              </div>
            </div>

            {/* KPI 3: Due-Work Completion Rate */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm relative group">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                <span className="font-medium">Due-Work Completion</span>
                <span title="Formula: (Tasks with deadlines in period that were completed / Total tasks due in period) * 100">
                  <Info className="w-3.5 h-3.5 cursor-pointer text-slate-400 hover:text-slate-600" />
                </span>
              </div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {kpis.dueWorkCompletionRate ?? 0}%
              </div>
              <div className="flex items-center gap-1 mt-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                  {kpis.totalDueInPeriod ?? 0} tasks were due in this period
                </span>
              </div>
            </div>

            {/* KPI 4: Currently Overdue Backlog */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm relative group">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                <span className="font-medium">Overdue Backlog</span>
                <span title="Incomplete tasks whose deadline has already passed">
                  <Info className="w-3.5 h-3.5 cursor-pointer text-slate-400 hover:text-slate-600" />
                </span>
              </div>
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                {kpis.currentlyOverdue ?? 0}
              </div>
              <div className="flex items-center gap-1 mt-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Avg Overdue Age: <strong>{kpis.avgOverdueDays ?? 0} days</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Secondary KPIs Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Completed Early</div>
              <div className="text-lg font-bold text-emerald-600">{kpis.completedEarly ?? 0}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Completed Late</div>
              <div className="text-lg font-bold text-amber-600">{kpis.completedLate ?? 0}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Avg Completion Time</div>
              <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                {kpis.avgCompletionHours ?? 0}h
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Median Completion</div>
              <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
                {kpis.medianCompletionHours ?? 0}h
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Deadline Extensions</div>
              <div className="text-lg font-bold text-indigo-600">{kpis.deadlineExtensionsCount ?? 0}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Rework Events</div>
              <div className="text-lg font-bold text-rose-500">{kpis.reworkCount ?? 0}</div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Completion Trend Over Time */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Performance & Completion Trends
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Daily completion volume and on-time performance
                  </p>
                </div>
              </div>
              <div className="h-64">
                {trends.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <RechartsTooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line
                        type="monotone"
                        dataKey="completed"
                        name="Completed"
                        stroke={COLORS.blue}
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="onTime"
                        name="On-Time"
                        stroke={COLORS.emerald}
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="late"
                        name="Late"
                        stroke={COLORS.amber}
                        strokeWidth={1.5}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    No trend data for this period
                  </div>
                )}
              </div>
            </div>

            {/* Completion Breakdown Donut */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                  Delivery Compliance Breakdown
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Distribution of completed tasks by timeliness
                </p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Early", value: kpis.completedEarly || 0 },
                          {
                            name: "On-Time",
                            value:
                              (kpis.completedOnTime || 0) -
                              (kpis.completedEarly || 0),
                          },
                          { name: "Late", value: kpis.completedLate || 0 },
                        ]}
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        <Cell fill={COLORS.teal} />
                        <Cell fill={COLORS.emerald} />
                        <Cell fill={COLORS.rose} />
                      </Pie>
                      <RechartsTooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <div className="text-slate-400">Early</div>
                  <div className="font-bold text-teal-600">{kpis.completedEarly ?? 0}</div>
                </div>
                <div>
                  <div className="text-slate-400">On-Time</div>
                  <div className="font-bold text-emerald-600">{kpis.completedOnTime ?? 0}</div>
                </div>
                <div>
                  <div className="text-slate-400">Late</div>
                  <div className="font-bold text-rose-600">{kpis.completedLate ?? 0}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Workload by Priority & Status Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Workload by Priority */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                Workload by Priority
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Assigned task volume categorized by urgency
              </p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { priority: "Urgent", count: workload.urgent ?? 0 },
                      { priority: "High", count: workload.high ?? 0 },
                      { priority: "Medium", count: workload.medium ?? 0 },
                      { priority: "Low", count: workload.low ?? 0 },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="priority" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RechartsTooltip />
                    <Bar dataKey="count" fill={COLORS.indigo} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Active Task Pipeline Statuses */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Active Task Pipeline
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Current operational states of tasks in selected period
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2.5 pt-1">
                {/* 1. Open */}
                <div
                  onClick={() => {
                    setSelectedPipelineStatus("open");
                    setPipelineTaskSearch("");
                  }}
                  className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-center cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all group"
                  title="Click to view Open tasks"
                >
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-1 group-hover:underline">
                    Open
                  </div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">
                    {pipelineCounts.open}
                  </div>
                </div>

                {/* 2. In Progress */}
                <div
                  onClick={() => {
                    setSelectedPipelineStatus("in_progress");
                    setPipelineTaskSearch("");
                  }}
                  className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 text-center cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all group"
                  title="Click to view In Progress tasks"
                >
                  <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold mb-1 group-hover:underline">
                    In Progress
                  </div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">
                    {pipelineCounts.in_progress}
                  </div>
                </div>

                {/* 3. Completed */}
                <div
                  onClick={() => {
                    setSelectedPipelineStatus("completed");
                    setPipelineTaskSearch("");
                  }}
                  className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-center cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all group"
                  title="Click to view Completed tasks"
                >
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-1 group-hover:underline">
                    Completed
                  </div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">
                    {pipelineCounts.completed}
                  </div>
                </div>

                {/* 4. Cancelled */}
                <div
                  onClick={() => {
                    setSelectedPipelineStatus("cancelled");
                    setPipelineTaskSearch("");
                  }}
                  className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all group"
                  title="Click to view Cancelled tasks"
                >
                  <div className="text-xs text-slate-600 dark:text-slate-400 font-semibold mb-1 group-hover:underline">
                    Cancelled
                  </div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">
                    {pipelineCounts.cancelled}
                  </div>
                </div>

                {/* 5. On Hold */}
                <div
                  onClick={() => {
                    setSelectedPipelineStatus("on_hold");
                    setPipelineTaskSearch("");
                  }}
                  className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 text-center cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all group"
                  title="Click to view On Hold tasks"
                >
                  <div className="text-xs text-purple-600 dark:text-purple-400 font-semibold mb-1 group-hover:underline">
                    On Hold
                  </div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">
                    {pipelineCounts.on_hold}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TEAM PERFORMANCE & RANKING                                         */}
      {/* ========================================================================= */}
      {activeTab === "team" && (
        <div className="space-y-6">
          {/* Department Breakdown Cards */}
          {departmentBreakdown.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                Department Performance Summary
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {departmentBreakdown.map((dept, i) => (
                  <div
                    key={i}
                    className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm"
                  >
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {dept.department || "Unassigned"}
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xl font-bold text-slate-900 dark:text-white">
                        {dept.onTimeRate}%
                      </span>
                      <span className="text-xs text-slate-500">on-time rate</span>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex justify-between border-t border-slate-100 dark:border-slate-800 pt-2">
                      <span>{dept.totalTasks} total tasks</span>
                      <span className="text-rose-500 font-semibold">
                        {dept.overdueCount} overdue
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Member Leaderboard Table */}
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Employee Performance Leaderboard
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Fair, auditable metrics: score is transparent decision support (50% on-time + 30% due-work - 20% overdue)
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-3">Department</th>
                    <th className="py-3 px-3 text-center">Assigned</th>
                    <th className="py-3 px-3 text-center">Completed</th>
                    <th className="py-3 px-3 text-center">On-Time %</th>
                    <th className="py-3 px-3 text-center">Due-Work %</th>
                    <th className="py-3 px-3 text-center">Overdue</th>
                    <th className="py-3 px-3 text-center">Rework</th>
                    <th className="py-3 px-3 text-center">Score</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {teamMembers.length > 0 ? (
                    teamMembers.map((member, idx) => (
                      <tr
                        key={member.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {member.name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {member.email}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                          {member.department && member.department !== "Unassigned" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {member.department}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-medium">
                          {member.assigned}
                        </td>
                        <td className="py-3 px-3 text-center font-medium text-blue-600">
                          {member.completed}
                        </td>
                        <td className="py-3 px-3 text-center font-semibold text-emerald-600">
                          {member.onTimeRate}%
                        </td>
                        <td className="py-3 px-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                          {member.dueWorkRate}%
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-rose-500">
                          {member.overdue}
                        </td>
                        <td className="py-3 px-3 text-center text-slate-600 dark:text-slate-400">
                          {member.reworkCount ?? 0}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                              member.performanceScore >= 80
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : member.performanceScore >= 60
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                            }`}
                          >
                            {member.performanceScore}/100
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDrilldownEmployee(member.id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:underline"
                          >
                            <span>Deep Dive</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        No team data found for this period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: INDIVIDUAL EMPLOYEE DEEP-DIVE                                      */}
      {/* ========================================================================= */}
      {activeTab === "employee" && (
        <div className="space-y-6">
          {/* Employee Selector Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Select Employee:
              </span>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-[220px]"
              >
                {orgEmployees.map((emp) => (
                  <option key={emp._id || emp.id} value={emp._id || emp.id}>
                    {emp.name || `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.email}{" "}
                    ({emp.department || "No Dept"})
                  </option>
                ))}
              </select>
            </div>

            {empProfile && (
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-500">
                  Role: <strong className="text-slate-700 dark:text-slate-300">{empProfile.role || "Employee"}</strong>
                </span>
                <span className="text-slate-400">|</span>
                <span className="text-slate-500">
                  Manager: <strong className="text-slate-700 dark:text-slate-300">{empProfile.managerName || "Direct"}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Employee Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                Total Assigned
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {empKpis.totalAssigned ?? 0}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {empKpis.totalCompleted ?? 0} completed
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                On-Time Rate
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {empKpis.onTimeRate ?? 0}%
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {empKpis.completedOnTime ?? 0} on-time deliveries
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                Late Deliveries
              </div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {empKpis.completedLate ?? 0}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Avg delay: {empKpis.avgDelayHours ? `${Math.round(empKpis.avgDelayHours)}h` : "0h"}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                Overdue Backlog
              </div>
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                {empKpis.currentlyOverdue ?? 0}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {empKpis.deadlineExtensionsCount ?? 0} deadline extensions
              </div>
            </div>
          </div>

          {/* Historical Task Table for this Employee */}
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Task Delivery Record & Audit Trail
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Inspect task deadlines, original vs approved dates, rework, and chronological history
                </p>
              </div>

              {/* Sub-filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search task title..."
                    value={employeeTaskSearch}
                    onChange={(e) => setEmployeeTaskSearch(e.target.value)}
                    className="pl-8 pr-3 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <select
                  value={employeeTaskStatusFilter}
                  onChange={(e) => setEmployeeTaskStatusFilter(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="ALL">All Statuses / Outcomes</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="on_hold">On Hold</option>
                  <option value="ON_TIME">On-Time / Early</option>
                  <option value="LATE">Completed Late</option>
                  <option value="OVERDUE">Currently Overdue</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Task</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Priority</th>
                    <th className="py-3 px-3">Original Due</th>
                    <th className="py-3 px-3">Current / Approved</th>
                    <th className="py-3 px-3">Outcome</th>
                    <th className="py-3 px-3 text-center">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredEmpTasks.length > 0 ? (
                    filteredEmpTasks.map((task) => {
                      const taskId = task._id || task.id;
                      return (
                        <tr
                          key={taskId}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4 font-medium text-slate-900 dark:text-white max-w-xs truncate">
                            {task.title}
                            {task.extensionsCount > 0 && (
                              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-semibold">
                                {task.extensionsCount}x ext
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 capitalize text-slate-700 dark:text-slate-300">
                            {(task.status || "").toLowerCase().replace("_", " ")}
                          </td>
                          <td className="py-3 px-3 capitalize">
                            <span
                              className={`font-semibold ${
                                task.priority === "urgent"
                                  ? "text-rose-600"
                                  : task.priority === "high"
                                  ? "text-amber-600"
                                  : "text-slate-600 dark:text-slate-400"
                              }`}
                            >
                              {task.priority || "Normal"}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-500">
                            {task.originalDueDate
                              ? new Date(task.originalDueDate).toLocaleDateString()
                              : "—"}
                          </td>
                          <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                            {task.dueDate
                              ? new Date(task.dueDate).toLocaleDateString()
                              : "—"}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                task.completionStatus === "EARLY"
                                  ? "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300"
                                  : task.completionStatus === "ON_TIME"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : task.completionStatus === "LATE"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                  : task.completionStatus === "OVERDUE"
                                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              }`}
                            >
                              {task.completionStatus || "PENDING"}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => handleOpenAudit(taskId)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors"
                              title="View chronological audit timeline"
                            >
                              <History className="w-3.5 h-3.5" />
                              <span>Audit</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No tasks found matching filter criteria
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: OVERDUE TASK ANALYSIS                                              */}
      {/* ========================================================================= */}
      {activeTab === "overdue" && (
        <div className="space-y-6">
          {/* Overdue Age Buckets Cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Overdue Task Age Classification
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Click any bucket card or bar to filter the task table below
                </p>
              </div>
              {selectedOverdueBucket !== "ALL" && (
                <button
                  onClick={() => setSelectedOverdueBucket("ALL")}
                  className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear Bucket Filter</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {overdueBuckets.map((b) => {
                const isSelected = selectedOverdueBucket === b.key;
                return (
                  <div
                    key={b.key}
                    onClick={() => setSelectedOverdueBucket(isSelected ? "ALL" : b.key)}
                    className={`cursor-pointer p-4 rounded-lg border transition-all text-center ${
                      isSelected
                        ? "border-rose-500 bg-rose-50/70 dark:bg-rose-950/40 ring-2 ring-rose-500"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      {b.label}
                    </div>
                    <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                      {b.count}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {b.percentage}% of overdue
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Bar Chart for Overdue Buckets */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
              Overdue Distribution
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Breakdown of overdue workload by severity of delay
            </p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overdueBuckets}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip />
                  <Bar
                    dataKey="count"
                    fill={COLORS.rose}
                    radius={[4, 4, 0, 0]}
                    onClick={(data) => {
                      if (data?.key) {
                        setSelectedOverdueBucket(data.key);
                      }
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Overdue Task List */}
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Overdue Tasks ({filteredOverdueTasks.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedOverdueBucket === "ALL"
                    ? "Showing all overdue tasks across buckets"
                    : `Filtered to bucket: ${selectedOverdueBucket}`}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Task</th>
                    <th className="py-3 px-3">Assignee</th>
                    <th className="py-3 px-3">Due Date</th>
                    <th className="py-3 px-3 text-center">Overdue Age</th>
                    <th className="py-3 px-3">Priority</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredOverdueTasks.length > 0 ? (
                    filteredOverdueTasks.map((t) => {
                      const taskId = t._id || t.id;
                      return (
                        <tr
                          key={taskId}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white max-w-sm truncate">
                            {t.title}
                          </td>
                          <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                            {t.assignee?.name || t.assignee?.email || "Unassigned"}
                          </td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                            {new Date(t.dueDate).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                              {t.overdueDays} days
                            </span>
                          </td>
                          <td className="py-3 px-3 capitalize font-semibold">
                            <span
                              className={
                                t.priority === "urgent"
                                  ? "text-rose-600"
                                  : "text-amber-600"
                              }
                            >
                              {t.priority}
                            </span>
                          </td>
                          <td className="py-3 px-3 capitalize text-slate-600 dark:text-slate-400">
                            {(t.status || "").toLowerCase().replace("_", " ")}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleOpenAudit(taskId)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                            >
                              <History className="w-3.5 h-3.5" />
                              <span>Timeline</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No overdue tasks in this bucket!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: REVIEWS, REWARDS & NOTICES (Temporarily Commented Out)             */}
      {/* ========================================================================= */}
      {/* {activeTab === "reviews" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Documented Performance Records
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Auditable reviews, star performer recognitions, and formal improvement notices
              </p>
            </div>
            {canCreateReviews && (
              <button
                onClick={() => setIsReviewModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors"
              >
                <Award className="w-4 h-4" />
                <span>Issue Review / Award / Notice</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reviewsList.length > 0 ? (
              reviewsList.map((rev) => {
                const isRecognition = rev.reviewType === "RECOGNITION";
                const isNotice = rev.reviewType === "NOTICE";
                const isMyReview =
                  rev.employee?._id === user?._id || rev.employee?.id === user?._id;

                return (
                  <div
                    key={rev._id}
                    className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold ${
                            isRecognition
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                              : isNotice
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                          }`}
                        >
                          {isRecognition ? (
                            <Award className="w-3.5 h-3.5" />
                          ) : isNotice ? (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          ) : (
                            <FileText className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {isRecognition
                              ? "Recognition Award"
                              : isNotice
                              ? "Performance Notice"
                              : "Performance Review"}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {new Date(rev.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="mt-3">
                        <div className="text-xs text-slate-400">Employee</div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {rev.employee?.name || rev.employee?.email}
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-500 mt-1">
                        Period: {new Date(rev.period?.startDate).toLocaleDateString()} –{" "}
                        {new Date(rev.period?.endDate).toLocaleDateString()}
                      </div>

                      {rev.positiveAchievements && (
                        <div className="mt-3 text-xs bg-emerald-50/60 dark:bg-emerald-950/20 p-2.5 rounded border border-emerald-100 dark:border-emerald-900/30 text-slate-700 dark:text-slate-300">
                          <strong className="text-emerald-700 dark:text-emerald-300">
                            Achievements:
                          </strong>{" "}
                          {rev.positiveAchievements}
                        </div>
                      )}

                      {isNotice && rev.noticeDetails && (
                        <div className="mt-3 text-xs bg-rose-50/60 dark:bg-rose-950/20 p-2.5 rounded border border-rose-100 dark:border-rose-900/30 text-rose-800 dark:text-rose-300">
                          <strong>Violation:</strong> {rev.noticeDetails.violationType}
                          {rev.noticeDetails.correctiveActionPlan && (
                            <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                              Plan: {rev.noticeDetails.correctiveActionPlan}
                            </div>
                          )}
                        </div>
                      )}

                      {isRecognition && rev.recognitionDetails && (
                        <div className="mt-3 text-xs bg-amber-50/60 dark:bg-amber-950/20 p-2.5 rounded border border-amber-100 dark:border-amber-900/30 text-amber-800 dark:text-amber-300">
                          <strong>{rev.recognitionDetails.badge}:</strong>{" "}
                          {rev.recognitionDetails.citation}
                        </div>
                      )}

                      {rev.managerComments && (
                        <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 italic">
                          "{rev.managerComments}"
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      {rev.employeeAcknowledged ? (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Acknowledged</span>
                        </div>
                      ) : (
                        <div className="text-xs text-amber-600 font-semibold">
                          Pending Acknowledgement
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setAcknowledgeReview(rev);
                          setIsAcknowledgeModalOpen(true);
                        }}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        {isMyReview && !rev.employeeAcknowledged
                          ? "Respond / Acknowledge"
                          : "View Full Record"}
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full py-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                No performance reviews or notices documented yet.
              </div>
            )}
          </div>
        </div>
      )} */}

      {/* Task Audit Timeline Drawer */}
      <TaskAuditDrawer
        taskId={auditTaskId}
        isOpen={isAuditDrawerOpen}
        onClose={() => {
          setIsAuditDrawerOpen(false);
          setAuditTaskId(null);
        }}
      />

      {/* Performance Review / Notice / Reward Creation Modal */}
      <PerformanceReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        employees={orgEmployees}
      />

      {/* Employee Acknowledgement Modal */}
      <EmployeeAcknowledgeModal
        isOpen={isAcknowledgeModalOpen}
        onClose={() => {
          setIsAcknowledgeModalOpen(false);
          setAcknowledgeReview(null);
        }}
        review={acknowledgeReview}
      />

      {/* Pipeline Status Task Drilldown Modal */}
      {selectedPipelineStatus && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => {
            setSelectedPipelineStatus(null);
            setPipelineTaskSearch("");
          }}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 md:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-3">
                <span
                  className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                    PIPELINE_STATUS_CONFIG[selectedPipelineStatus]?.badgeClass
                  }`}
                >
                  {PIPELINE_STATUS_CONFIG[selectedPipelineStatus]?.label}
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white m-0">
                    {PIPELINE_STATUS_CONFIG[selectedPipelineStatus]?.label} Tasks
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 m-0">
                    {PIPELINE_STATUS_CONFIG[selectedPipelineStatus]?.description} •{" "}
                    {filteredPipelineTasks.length}{" "}
                    {filteredPipelineTasks.length === 1 ? "task" : "tasks"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search tasks..."
                    value={pipelineTaskSearch}
                    onChange={(e) => setPipelineTaskSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 w-40 sm:w-56"
                  />
                </div>
                <button
                  onClick={() => {
                    setSelectedPipelineStatus(null);
                    setPipelineTaskSearch("");
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body / Table */}
            <div className="overflow-y-auto flex-1 p-4">
              {filteredPipelineTasks.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Task Title</th>
                        <th className="py-2.5 px-3">Priority</th>
                        <th className="py-2.5 px-3">Assignee</th>
                        <th className="py-2.5 px-3">Due Date</th>
                        <th className="py-2.5 px-3 text-center">Audit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {filteredPipelineTasks.map((task) => {
                        const taskId = task._id || task.id;
                        const assignee = task.assignedTo;
                        const assigneeName = assignee
                          ? `${assignee.firstName || ""} ${assignee.lastName || ""}`.trim() ||
                            assignee.name ||
                            assignee.email
                          : "Unassigned";

                        const priorityLower = (task.priority || "medium").toLowerCase();
                        const priorityColor =
                          priorityLower === "urgent"
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                            : priorityLower === "high"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                            : priorityLower === "medium"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

                        return (
                          <tr
                            key={taskId}
                            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="py-3 px-3">
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {task.title}
                              </div>
                              {task.description && (
                                <div className="text-[11px] text-slate-500 line-clamp-1 max-w-md">
                                  {task.description}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${priorityColor}`}
                              >
                                {task.priority || "Medium"}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                              {assigneeName}
                            </td>
                            <td className="py-3 px-3 text-slate-500">
                              {task.dueDate
                                ? new Date(task.dueDate).toLocaleDateString()
                                : "—"}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => handleOpenAudit(taskId)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                              >
                                <History className="w-3.5 h-3.5" />
                                <span>Audit</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-medium">No tasks found in this status</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {pipelineTaskSearch.trim()
                      ? "Try adjusting your search terms"
                      : "There are currently no tasks matching this operational state for the selected period"}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 px-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
              <button
                onClick={() => {
                  setSelectedPipelineStatus(null);
                  setPipelineTaskSearch("");
                }}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceReportsDashboard;
