import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Building2,
  Users,
  Package,
  TrendingUp,
  TrendingDown,
  Activity,
  CheckCircle2,
  Clock,
  AlertCircle,
  BarChart3,
  LineChart,
  PieChart,
  Download,
  RefreshCw,
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

export default function PlatformDashboard() {
  const [analyticsPeriod, setAnalyticsPeriod] = useState("30d");
  const [refreshing, setRefreshing] = useState(false);

  // Fetch platform dashboard data
  const {
    data: dashboardData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["platform-dashboard"],
    queryFn: async () => {
      const response = await fetch("/api/super-admin/dashboard", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch dashboard data");
      return response.json();
    },
    refetchInterval: 60000,
  });

  // Fetch analytics data
  const {
    data: analyticsData,
    isLoading: analyticsLoading,
    refetch: refetchAnalytics,
  } = useQuery({
    queryKey: ["super-admin-analytics", analyticsPeriod],
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
    enabled: !!analyticsPeriod, // Only fetch when period is set
  });

  // Extract and prepare stats from API response
  const platformStats = dashboardData?.platformStats || {};
  const organizationMetrics = dashboardData?.organizationMetrics || [];
  const kpiTiles = dashboardData?.kpiTiles || {};

  const stats = {
    totalCompanies: platformStats.totalOrganizations || 0,
    activeCompanies:
      organizationMetrics.filter((org) => org.status === "active").length || 0,
    totalUsers: platformStats.totalUsers || 0,
    activeUsers: platformStats.activeUsers || 0,
    licensesAssigned: platformStats.licensesAssigned || 0,
    licensesAvailable: platformStats.licensesAvailable || 0,
    growthRate: 8,
    retentionRate: 2.1,
  };

  // Recent Activity - convert tasks to activity format
  const recentActivity = (dashboardData?.taskGrid || [])
    .slice(0, 5)
    .map((task) => ({
      action: `Task created: ${task.title}`,
      company: task.organization || "System",
      time: "Recently",
      type: "success",
    }));

  // Top Companies - from organization metrics
  const topCompanies = organizationMetrics.slice(0, 5);

  // Chart colors
  const COLORS = [
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#EC4899",
  ];

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchAnalytics()]);
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Debug: Log when period or analytics data changes
  useEffect(() => {
    console.log("📊 Analytics Period Changed:", analyticsPeriod);
    console.log("📈 Analytics Data:", analyticsData);
  }, [analyticsPeriod, analyticsData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-red-700 font-medium">Error loading dashboard</p>
          <p className="text-red-600 text-sm mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-sm">
            <LayoutDashboard className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Platform Dashboard
            </h1>
            <p className="text-sm text-gray-500">
              Overview of platform metrics and activity
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={analyticsPeriod}
            onChange={(e) => setAnalyticsPeriod(e.target.value)}
            className="h-9 px-3 border rounded-md text-sm bg-white"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last Year</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-9 px-4 border rounded-md text-sm bg-white hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Companies */}
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-blue-50 rounded-sm">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
              <TrendingUp className="h-3 w-3" />
              +8%
            </span>
          </div>
          <div className="mt-3">
            <p className="text-sm text-gray-500">Total Companies</p>
            <p className="text-2xl font-semibold text-gray-900">
              {stats.totalCompanies}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {stats.activeCompanies} active
            </p>
          </div>
        </div>

        {/* Total Users */}
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-purple-50 rounded-sm">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
              <TrendingUp className="h-3 w-3" />+{stats.growthRate}%
            </span>
          </div>
          <div className="mt-3">
            <p className="text-sm text-gray-500">Total Users</p>
            <p className="text-2xl font-semibold text-gray-900">
              {stats.totalUsers.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {stats.activeUsers.toLocaleString()} active
            </p>
          </div>
        </div>

        {/* Licenses */}
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-green-50 rounded-sm">
              <Package className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              {stats.licensesAssigned + stats.licensesAvailable > 0
                ? `${Math.round((stats.licensesAssigned / (stats.licensesAssigned + stats.licensesAvailable)) * 100)}% used`
                : "0% used"}
            </span>
          </div>
          <div className="mt-3">
            <p className="text-sm text-gray-500">Licenses Assigned</p>
            <p className="text-2xl font-semibold text-gray-900">
              {stats.licensesAssigned}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {stats.licensesAvailable} available
            </p>
          </div>
        </div>

        {/* Retention Rate */}
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-amber-50 rounded-sm">
              <Activity className="h-5 w-5 text-amber-600" />
            </div>
            <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
              <TrendingUp className="h-3 w-3" />
              +2.1%
            </span>
          </div>
          <div className="mt-3">
            <p className="text-sm text-gray-500">Retention Rate</p>
            <p className="text-2xl font-semibold text-gray-900">
              {stats.retentionRate}%
            </p>
            <p className="text-xs text-gray-400 mt-1">Last 30 days</p>
          </div>
        </div>
      </div>

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
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, index) => (
                <div key={index} className="px-4 py-3 flex items-center gap-3">
                  <div
                    className={`p-1.5 rounded-full ${
                      activity.type === "success"
                        ? "bg-green-100"
                        : activity.type === "warning"
                          ? "bg-amber-100"
                          : "bg-blue-100"
                    }`}
                  >
                    {activity.type === "success" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : activity.type === "warning" ? (
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                    ) : (
                      <Activity className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{activity.action}</p>
                    <p className="text-xs text-gray-500">{activity.company}</p>
                  </div>
                  <span className="text-xs text-gray-400">{activity.time}</span>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-gray-500">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No recent activity</p>
              </div>
            )}
          </div>
        </div>

        {/* Top Companies */}
        <div className="bg-white border border-gray-200 rounded-sm">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-medium text-gray-900">
              Top Companies by Usage
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {topCompanies.length > 0 ? (
              topCompanies.map((company, index) => (
                <div
                  key={company.id || index}
                  className="px-4 py-3 flex items-center gap-3"
                >
                  <div className="w-8 h-8 bg-gray-100 rounded-sm flex items-center justify-center text-sm font-medium text-gray-600">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {company.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {company.users} users •{" "}
                      {(company.tasks || 0).toLocaleString()} tasks
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      company.status === "active"
                        ? "bg-green-50 text-green-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {company.status}
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

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* User Growth Chart */}
        <div className="bg-white rounded-sm border p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            User Growth Trend
          </h2>
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

        {/* Task Creation Trends */}
        <div className="bg-white rounded-sm border p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-600" />
            Task Creation Trends
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
        <div className="bg-white rounded-sm border p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-purple-600" />
            Tasks by Status Distribution
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

        {/* Organization Performance */}
        <div className="bg-white rounded-sm border p-4">
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

      {/* Quick Stats Row */}
      {/* <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-sm p-4 text-center">
          <p className="text-2xl font-semibold text-gray-900">98.7%</p>
          <p className="text-xs text-gray-500 mt-1">Uptime (30 days)</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-sm p-4 text-center">
          <p className="text-2xl font-semibold text-gray-900">45ms</p>
          <p className="text-xs text-gray-500 mt-1">Avg Response Time</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-sm p-4 text-center">
          <p className="text-2xl font-semibold text-gray-900">12.4K</p>
          <p className="text-xs text-gray-500 mt-1">Tasks Created Today</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-sm p-4 text-center">
          <p className="text-2xl font-semibold text-gray-900">4.8/5</p>
          <p className="text-xs text-gray-500 mt-1">User Satisfaction</p>
        </div>
      </div> */}
    </div>
  );
}
