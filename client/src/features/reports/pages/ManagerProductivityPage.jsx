import React from "react";
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  Target,
  CheckCircle,
} from "lucide-react";
import {
  KPICard,
  TaskLineChart,
  TaskDonutChart,
  TaskBarChart,
  ReportsFilterBar,
} from "../components";
import { useProductivityReport } from "../hooks/useReports";
import { exportReport } from "../utils/exportUtils";

/**
 * Manager Productivity Report Page
 * Shows individual manager's task performance and productivity metrics
 * Path: /reports/productivity
 * Role: Manager (viewing own data)
 */
const ManagerProductivityPage = () => {
  const { data, loading, error, filters, updateFilters } =
    useProductivityReport();

  const handleFilterChange = (newFilters) => {
    updateFilters(newFilters);
  };

  const handleExport = (format) => {
    if (!data) return;

    const title = "My Productivity Report";
    const summary = {
      "Total Tasks": data.kpis.totalTasks,
      Completed: data.kpis.completed,
      "On Hold": data.kpis.onHold,
      Overdue: data.kpis.overdue,
      "Completion Rate": `${completionRate}%`,
    };

    // Define columns for export
    const columns = [
      { header: "Metric", key: "metric" },
      { header: "Value", key: "value" },
    ];

    // Prepare data for export
    const exportData = [
      { metric: "Total Tasks", value: data.kpis.totalTasks },
      { metric: "Completed", value: data.kpis.completed },
      { metric: "In Progress", value: data.kpis.inProgress || 0 },
      { metric: "On Hold", value: data.kpis.onHold },
      { metric: "Overdue", value: data.kpis.overdue },
      { metric: "Completion Rate", value: `${completionRate}%` },
    ];

    // Add priority distribution if available
    if (data.priorityLoad) {
      exportData.push({ metric: "", value: "" }); // Empty row
      exportData.push({ metric: "Priority Distribution", value: "" });
      data.priorityLoad.forEach((item) => {
        exportData.push({ metric: item.name, value: item.tasks });
      });
    }

    exportReport(format, title, exportData, columns, summary);
  };

  // Show error state
  if (error) {
    return (
      <div className="bg-gray-50 p-3 sm:p-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded text-xs sm:text-sm">
          Error loading productivity report: {error}
        </div>
      </div>
    );
  }

  const completionRate =
    data && data.kpis.totalTasks > 0
      ? ((data.kpis.completed / data.kpis.totalTasks) * 100).toFixed(1)
      : 0;

  return (
    <div className="bg-gray-50 pb-6 sm:pb-8 p-3 sm:p-4 md:p-4">
      {/* Header */}
      <div className="mb-3 sm:mb-3">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">
          My Productivity
        </h1>
        <p className="text-xs sm:text-sm text-gray-600">
          Track your task performance and productivity metrics
        </p>
      </div>

      {/* Filters */}
      <ReportsFilterBar
        onFilterChange={handleFilterChange}
        showTeamFilter={false}
        showExport={true}
        onExport={handleExport}
        loading={loading}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-3">
        <KPICard
          title="Total Tasks"
          value={data?.kpis.totalTasks || 0}
          icon={CheckSquare}
          color="blue"
          description="All assigned tasks"
          loading={loading}
        />
        <KPICard
          title="Completed"
          value={data?.kpis.completed || 0}
          icon={CheckCircle}
          color="green"
          trend="up"
          trendValue={completionRate}
          description="Completion rate"
          loading={loading}
        />
        <KPICard
          title="On Hold"
          value={data?.kpis.onHold || 0}
          icon={Clock}
          color="orange"
          description="Paused tasks"
          loading={loading}
        />
        <KPICard
          title="Overdue"
          value={data?.kpis.overdue || 0}
          icon={AlertTriangle}
          color="red"
          description="Past due date"
          loading={loading}
        />
      </div>

      {/* Charts Row 1 */}

      <TaskLineChart
        data={data?.completionTrend || []}
        xKey="date"
        lines={[
          { key: "completed", color: "#10b981", name: "Completed" },
          { key: "assigned", color: "#3b82f6", name: "Assigned" },
        ]}
        title="Task Completion Trend"
        height={300}
        loading={loading}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3 my-2 sm:my-3">
        <TaskBarChart
          data={data?.priorityLoad || []}
          xKey="name"
          bars={[{ key: "tasks", color: "#6366f1", name: "Tasks" }]}
          title="Task Load by Priority"
          height={300}
          loading={loading}
        />
        <TaskDonutChart
          data={data?.statusDistribution || []}
          title="Task Status Distribution"
          colors={["#3b82f6", "#f59e0b", "#ef4444", "#10b981"]}
          height={300}
          loading={loading}
        />
      </div>

      {/* Charts Row 2 - Upcoming Due Dates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3 my-2 sm:my-3">
        <TaskBarChart
          data={data?.upcomingDueDates || []}
          xKey="date"
          bars={[{ key: "count", color: "#6366f1", name: "Tasks Due" }]}
          title="Upcoming Due Dates"
          height={300}
          loading={loading}
        />

        {/* Summary Table */}
        <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-3 sm:p-4">
          <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-3">
            Task Summary
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-medium text-gray-600">
                    Metric
                  </th>
                  <th className="text-right py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-medium text-gray-600">
                    Count
                  </th>
                  <th className="text-right py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-medium text-gray-600">
                    Percentage
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-700">
                    Total Tasks
                  </td>
                  <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-900 text-right font-medium">
                    {data?.kpis.totalTasks || 0}
                  </td>
                  <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-900 text-right">
                    100%
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-700">
                    Completed
                  </td>
                  <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-green-600 text-right font-medium">
                    {data?.kpis.completed || 0}
                  </td>
                  <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-green-600 text-right">
                    {completionRate}%
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-700">
                    In Progress
                  </td>
                  <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-blue-600 text-right font-medium">
                    {data?.kpis.totalTasks
                      ? data.kpis.totalTasks -
                        (data.kpis.completed || 0) -
                        (data.kpis.onHold || 0) -
                        (data.kpis.overdue || 0)
                      : 0}
                  </td>
                  <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-blue-600 text-right">
                    {data?.kpis.totalTasks
                      ? (
                          ((data.kpis.totalTasks -
                            (data.kpis.completed || 0) -
                            (data.kpis.onHold || 0) -
                            (data.kpis.overdue || 0)) /
                            data.kpis.totalTasks) *
                          100
                        ).toFixed(1)
                      : 0}
                    %
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-700">
                    On Hold
                  </td>
                  <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-orange-600 text-right font-medium">
                    {data?.kpis.onHold || 0}
                  </td>
                  <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-orange-600 text-right">
                    {data?.kpis.totalTasks
                      ? (
                          (data.kpis.onHold / data.kpis.totalTasks) *
                          100
                        ).toFixed(1)
                      : 0}
                    %
                  </td>
                </tr>
                <tr>
                  <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-700">
                    Overdue
                  </td>
                  <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-red-600 text-right font-medium">
                    {data?.kpis.overdue || 0}
                  </td>
                  <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-red-600 text-right">
                    {data?.kpis.totalTasks
                      ? (
                          (data.kpis.overdue / data.kpis.totalTasks) *
                          100
                        ).toFixed(1)
                      : 0}
                    %
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerProductivityPage;
