import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/features/shared/hooks/useAuth";
import {
  Monitor,
  Server,
  Database,
  Activity,
  Building2,
  Users,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Globe,
  Settings,
  Download,
  RefreshCw,
  Package,
  DollarSign,
  BarChart3,
  LineChart,
  PieChart,
  Calendar,
} from "lucide-react";
import {
  LineChart as RechartsLineChart,
  Line,
  BarChart as RechartsBarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

/**
 * Super Admin Dashboard - Platform-wide administrative interface
 * Displays system metrics, organization management, and platform analytics
 */
const SuperAdminDashboard = () => {
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [analyticsPeriod, setAnalyticsPeriod] = useState("30d");
  const [exportFormat, setExportFormat] = useState("json");

  // Get current user data using useAuth hook
  const { user } = useAuth();

  // Fetch dashboard data
  const {
    data: dashboardData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/super-admin/dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/super-admin/dashboard", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      return await res.json();
    },
    refetchInterval: 60000, // Refetch every minute
  });

  // Fetch analytics data
  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ["/api/super-admin/analytics", analyticsPeriod],
    queryFn: async () => {
      const res = await fetch(
        `/api/super-admin/analytics?period=${analyticsPeriod}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return await res.json();
    },
  });

  // Fetch audit logs for recent activity
  const { data: auditLogsData, isLoading: auditLogsLoading } = useQuery({
    queryKey: ["/api/super-admin/audit-logs"],
    queryFn: async () => {
      const res = await fetch(
        "/api/super-admin/audit-logs?action=all&dateRange=7days",
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return await res.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  });

  const platformStats = dashboardData?.platformStats || {};
  const organizationMetrics = dashboardData?.organizationMetrics || [];
  const systemHealth = dashboardData?.systemHealth || [];
  const recentActivities = dashboardData?.recentActivities || [];

  const getStatusColor = (status) => {
    switch (status) {
      case "healthy":
        return "text-green-600 bg-green-50";
      case "warning":
        return "text-yellow-600 bg-yellow-50";
      case "error":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "healthy":
        return <CheckCircle size={16} className="text-green-600" />;
      case "warning":
        return <AlertTriangle size={16} className="text-yellow-600" />;
      case "error":
        return <AlertTriangle size={16} className="text-red-600" />;
      default:
        return <Clock size={16} className="text-gray-600" />;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case "success":
        return "border-l-green-500";
      case "warning":
        return "border-l-yellow-500";
      case "error":
        return "border-l-red-500";
      default:
        return "border-l-blue-500";
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setTimeout(() => setRefreshing(false), 1000);
    toast({
      title: "Refreshed",
      description: "Dashboard data has been updated",
    });
  };

  const handleExportAnalytics = async () => {
    try {
      toast({
        title: "Exporting...",
        description: "Preparing analytics export",
      });

      const res = await fetch(
        `/api/super-admin/export-analytics?format=${exportFormat}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `platform-analytics-${Date.now()}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "Analytics exported successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export analytics",
        variant: "destructive",
      });
    }
  };

  // Colors for charts
  const COLORS = [
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#EC4899",
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-2 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Super Admin Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            Platform-wide system monitoring and organization management
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value)}
            className="h-9 px-3 border rounded-sm text-sm"
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
          <Button
            variant="outline"
            className="h-9 flex items-center gap-2"
            onClick={handleRefresh}
            disabled={refreshing}
            data-testid="button-refresh"
          >
            <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </Button>
          <Button
            variant="default"
            className="h-9 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handleExportAnalytics}
            data-testid="button-export-analytics"
          >
            <Download size={18} />
            Export Analytics
          </Button>
        </div>
      </div>

      {/* Platform Overview Cards */}
      {platformStats && Object.keys(platformStats).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div
            className="bg-white p-4 rounded-sm shadow-sm border"
            data-testid="card-total-organizations"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Organizations</p>
                <p className="text-2xl font-bold text-gray-900">
                  {platformStats.totalOrganizations}
                </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-sm">
                <Building2 className="text-blue-600" size={24} />
              </div>
            </div>
          </div>
          <div
            className="bg-white p-4 rounded-sm shadow-sm border"
            data-testid="card-total-users"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">
                  {platformStats.totalUsers}
                </p>
                <p className="text-xs text-green-600 mt-1">
                  {platformStats.activeUsers} active
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-sm">
                <Users className="text-green-600" size={24} />
              </div>
            </div>
          </div>
          <div
            className="bg-white p-4 rounded-sm shadow-sm border"
            data-testid="card-system-uptime"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">System Uptime</p>
                <p className="text-2xl font-bold text-gray-900">
                  {platformStats.systemUptime}%
                </p>
              </div>
              <div className="bg-purple-100 p-3 rounded-sm">
                <Monitor className="text-purple-600" size={24} />
              </div>
            </div>
          </div>
          <div
            className="bg-white p-4 rounded-sm shadow-sm border"
            data-testid="card-platform-tasks"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Platform Tasks</p>
                <p className="text-2xl font-bold text-gray-900">
                  {platformStats.totalTasks}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  {platformStats.completedTasks} completed
                </p>
              </div>
              <div className="bg-indigo-100 p-3 rounded-sm">
                <Activity className="text-indigo-600" size={24} />
              </div>
            </div>
          </div>
          <div
            className="bg-white p-4 rounded-sm shadow-sm border"
            data-testid="card-licenses"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Licenses Assigned</p>
                <p className="text-2xl font-bold text-gray-900">
                  {platformStats.licensesAssigned || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {platformStats.licensesAvailable || 0} available
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-sm">
                <Package className="text-green-600" size={24} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Recent Activity */}
        <div className="bg-white border border-gray-200 rounded-sm">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-medium text-gray-900">
              Recent Activity
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {auditLogsLoading ? (
              <div className="px-4 py-8 text-center">
                <RefreshCw className="h-5 w-5 mx-auto animate-spin text-gray-400" />
                <p className="text-xs text-gray-500 mt-2">
                  Loading activities...
                </p>
              </div>
            ) : auditLogsData?.data?.length > 0 ? (
              auditLogsData.data.slice(0, 5).map((activity, index) => {
                const userName =
                  activity.userId?.firstName && activity.userId?.lastName
                    ? `${activity.userId.firstName} ${activity.userId.lastName}`
                    : activity.userId?.email || "System";
                const actionText = activity.action
                  ?.replace(/_/g, " ")
                  .toLowerCase()
                  .replace(/\b\w/g, (c) => c.toUpperCase());
                const severity =
                  activity.action?.includes("DELETE") ||
                  activity.action?.includes("SUSPENDED")
                    ? "error"
                    : activity.action?.includes("CREATED") ||
                        activity.action?.includes("ACTIVATED")
                      ? "success"
                      : "info";
                const severityColor =
                  severity === "success"
                    ? "bg-green-100"
                    : severity === "error"
                      ? "bg-red-100"
                      : "bg-blue-100";
                const severityIconColor =
                  severity === "success"
                    ? "text-green-600"
                    : severity === "error"
                      ? "text-red-600"
                      : "text-blue-600";

                // Format details - show change_summary (contains full details) or fallback to details
                const displayDetails =
                  activity.change_summary ||
                  activity.details ||
                  "No details recorded";

                return (
                  <div
                    key={activity._id || index}
                    className="px-4 py-3 flex items-center gap-3"
                  >
                    <div className={`p-1.5 rounded-sm ${severityColor}`}>
                      {severity === "success" ? (
                        <CheckCircle size={16} className={severityIconColor} />
                      ) : severity === "error" ? (
                        <AlertTriangle
                          size={16}
                          className={severityIconColor}
                        />
                      ) : (
                        <Clock size={16} className={severityIconColor} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        {userName} - {actionText}
                      </p>
                      <p className="text-xs text-gray-500">{displayDetails}</p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {activity.createdAt
                        ? new Date(activity.createdAt).toLocaleTimeString()
                        : "Recently"}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-8 text-center text-gray-500">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No recent activity</p>
              </div>
            )}
          </div>
        </div>

        {/* Top Companies by Usage */}
        <div className="bg-white border border-gray-200 rounded-sm">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-medium text-gray-900">
              Top Organizations by Usage
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {organizationMetrics.length > 0 ? (
              organizationMetrics.slice(0, 5).map((org, index) => (
                <div
                  key={org._id || org.id || index}
                  className="px-4 py-3 flex items-center gap-3"
                >
                  <div className="w-8 h-8 bg-gray-100 rounded-sm flex items-center justify-center text-sm font-medium text-gray-600">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {org.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {org.users || 0} users •{" "}
                      {(org.tasks || 0).toLocaleString()} tasks
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-sm bg-green-50 text-green-700">
                    {Math.round(org.productivity || 0)}%
                  </span>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-gray-500">
                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No organizations found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Organization Management */}
      {/* <div className="bg-white rounded-sm border" data-testid="card-organization-management">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Organization Management</h2>
            <Button variant="ghost" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              View All Organizations
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Organization
                </th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Users
                </th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tasks
                </th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Productivity
                </th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {organizationMetrics.map((org) => (
                <tr key={org.id || org._id} className="hover:bg-gray-50" data-testid={`org-row-${org.id || org._id}`}>
                  <td className="py-4 px-6">
                    <span className="font-medium text-gray-900">{org.name}</span>
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-700">
                    {org.users}
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-700">
                    {org.tasks}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{org.productivity}%</span>
                      <div className="w-12 bg-gray-200 rounded-sm h-1.5">
                        <div
                          className="bg-blue-600 h-1.5 rounded-sm"
                          style={{ width: `${org.productivity}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-2 py-1 rounded-sm text-xs font-medium ${org.status === 'active'
                      ? 'text-green-700 bg-green-100'
                      : 'text-yellow-700 bg-yellow-100'
                      }`}>
                      {org.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div> */}

      {/* Recent Activities */}
      {recentActivities && recentActivities.length > 0 && (
        <div
          className="bg-white rounded-sm border"
          data-testid="card-recent-activities"
        >
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Platform Activities
            </h2>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {recentActivities.slice(0, 10).map((activity) => {
                const timestamp = activity.time
                  ? new Date(activity.time).toLocaleString()
                  : "Recently";
                return (
                  <div
                    key={activity.id || activity._id}
                    className={`flex items-start gap-3 p-4 bg-gray-50 rounded-sm border-l-4 ${getSeverityColor(activity.severity)}`}
                    data-testid={`activity-${activity.id || activity._id}`}
                  >
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">
                        {activity.message}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{timestamp}</p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-sm text-xs font-medium whitespace-nowrap ${
                        activity.severity === "success"
                          ? "text-green-700 bg-green-100"
                          : activity.severity === "warning"
                            ? "text-yellow-700 bg-yellow-100"
                            : activity.severity === "error"
                              ? "text-red-700 bg-red-100"
                              : "text-blue-700 bg-blue-100"
                      }`}
                    >
                      {activity.severity}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* User Growth Chart */}
        <div
          className="bg-white rounded-sm border p-4"
          data-testid="card-user-growth"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              User Growth
            </h2>
            <select
              value={analyticsPeriod}
              onChange={(e) => setAnalyticsPeriod(e.target.value)}
              className="text-sm border rounded-sm px-2 py-1"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="1y">Last Year</option>
            </select>
          </div>
          {analyticsLoading ? (
            <div className="bg-gray-50 rounded-sm p-7 text-center">
              <RefreshCw
                className="mx-auto mb-2 text-gray-400 animate-spin"
                size={32}
              />
              <p className="text-gray-600 text-sm">Loading analytics...</p>
            </div>
          ) : analyticsData?.userGrowth?.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <RechartsLineChart data={analyticsData.userGrowth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="_id" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  name="New Users"
                />
              </RechartsLineChart>
            </ResponsiveContainer>
          ) : (
            <div className="bg-gray-50 rounded-sm p-7 text-center">
              <TrendingUp className="mx-auto mb-2 text-gray-400" size={48} />
              <p className="text-gray-600">No user growth data available</p>
            </div>
          )}
        </div>

        {/* Task Trends Chart */}
        <div
          className="bg-white rounded-sm border p-4"
          data-testid="card-task-trends"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-600" />
            Task Trends
          </h2>
          {analyticsLoading ? (
            <div className="bg-gray-50 rounded-sm p-7 text-center">
              <RefreshCw
                className="mx-auto mb-2 text-gray-400 animate-spin"
                size={32}
              />
              <p className="text-gray-600 text-sm">Loading analytics...</p>
            </div>
          ) : analyticsData?.taskTrends?.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <RechartsBarChart data={analyticsData.taskTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="_id" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="created" fill="#3B82F6" name="Created" />
                <Bar dataKey="completed" fill="#10B981" name="Completed" />
              </RechartsBarChart>
            </ResponsiveContainer>
          ) : (
            <div className="bg-gray-50 rounded-sm p-7 text-center">
              <BarChart3 className="mx-auto mb-2 text-gray-400" size={48} />
              <p className="text-gray-600">No task trend data available</p>
            </div>
          )}
        </div>

        {/* Tasks by Status */}
        <div
          className="bg-white rounded-sm border p-4"
          data-testid="card-tasks-by-status"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-purple-600" />
            Tasks by Status
          </h2>
          {analyticsLoading ? (
            <div className="bg-gray-50 rounded-sm p-7 text-center">
              <RefreshCw
                className="mx-auto mb-2 text-gray-400 animate-spin"
                size={32}
              />
              <p className="text-gray-600 text-sm">Loading analytics...</p>
            </div>
          ) : analyticsData?.tasksByStatus?.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <RechartsPieChart>
                <Pie
                  data={analyticsData.tasksByStatus}
                  dataKey="count"
                  nameKey="_id"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry) => `${entry._id}: ${entry.count}`}
                >
                  {analyticsData.tasksByStatus.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
          ) : (
            <div className="bg-gray-50 rounded-sm p-7 text-center">
              <PieChart className="mx-auto mb-2 text-gray-400" size={48} />
              <p className="text-gray-600">No task status data available</p>
            </div>
          )}
        </div>

        {/* Active Users Timeline */}
        <div
          className="bg-white rounded-sm border p-4"
          data-testid="card-active-users"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-600" />
            Active Users Timeline
          </h2>
          {analyticsLoading ? (
            <div className="bg-gray-50 rounded-sm p-7 text-center">
              <RefreshCw
                className="mx-auto mb-2 text-gray-400 animate-spin"
                size={32}
              />
              <p className="text-gray-600 text-sm">Loading analytics...</p>
            </div>
          ) : analyticsData?.activeUsersTimeline?.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <RechartsLineChart data={analyticsData.activeUsersTimeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="_id" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="activeUsers"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  name="Active Users"
                />
              </RechartsLineChart>
            </ResponsiveContainer>
          ) : (
            <div className="bg-gray-50 rounded-sm p-7 text-center">
              <LineChart className="mx-auto mb-2 text-gray-400" size={48} />
              <p className="text-gray-600">No active user data available</p>
            </div>
          )}
        </div>

        {/* Top Organizations Performance */}
        <div
          className="bg-white rounded-sm border p-4"
          data-testid="card-org-performance"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-indigo-600" />
            Top Organizations Performance
          </h2>
          {analyticsLoading ? (
            <div className="bg-gray-50 rounded-sm p-7 text-center">
              <RefreshCw
                className="mx-auto mb-2 text-gray-400 animate-spin"
                size={32}
              />
              <p className="text-gray-600 text-sm">Loading analytics...</p>
            </div>
          ) : analyticsData?.orgPerformance?.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <RechartsBarChart
                data={analyticsData.orgPerformance.slice(0, 5)}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={100}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="completionRate"
                  fill="#8B5CF6"
                  name="Completion Rate %"
                />
              </RechartsBarChart>
            </ResponsiveContainer>
          ) : (
            <div className="bg-gray-50 rounded-sm p-7 text-center">
              <BarChart3 className="mx-auto mb-2 text-gray-400" size={48} />
              <p className="text-gray-600">No organization data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
