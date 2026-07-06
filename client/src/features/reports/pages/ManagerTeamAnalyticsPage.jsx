import React from "react";
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  Activity,
  CheckCircle,
} from "lucide-react";
import {
  KPICard,
  TaskLineChart,
  TaskDonutChart,
  TaskBarChart,
  ReportsFilterBar,
} from "../components";
import { useTeamAnalytics } from "../hooks/useReports";
import { exportReport } from "../utils/exportUtils";

/**
 * Manager Team Analytics Page
 * Shows team performance, workload distribution, and productivity metrics
 * Path: /reports/team
 * Role: Manager (viewing team data)
 */
const ManagerTeamAnalyticsPage = () => {
  const { data, loading, error, filters, updateFilters } = useTeamAnalytics();

  const handleFilterChange = (newFilters) => {
    updateFilters(newFilters);
  };

  const handleExport = (format) => {
    if (!data) return;

    const completionRate =
      data.kpis.totalTeamTasks > 0
        ? ((data.kpis.completed / data.kpis.totalTeamTasks) * 100).toFixed(1)
        : 0;

    const title = "Team Analytics Report";
    const summary = {
      "Total Team Tasks": data.kpis.totalTeamTasks,
      Completed: data.kpis.completed,
      Overdue: data.kpis.overdue,
      "At Risk": data.kpis.atRisk,
      "Completion Rate": `${completionRate}%`,
    };

    const columns = [
      { header: "Team Member", key: "member" },
      { header: "Total Tasks", key: "total" },
      { header: "Completed", key: "completed" },
      { header: "In Progress", key: "inProgress" },
      { header: "Overdue", key: "overdue" },
    ];

    // Prepare workload data for export
    const exportData = (data.workloadByMember || []).map((member) => ({
      member: member.name,
      total: member.total || 0,
      completed: member.completed || 0,
      inProgress: member.inProgress || 0,
      overdue: member.overdue || 0,
    }));

    exportReport(format, title, exportData, columns, summary);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Error loading team analytics: {error}
        </div>
      </div>
    );
  }

  const completionRate =
    data && data.kpis.totalTeamTasks > 0
      ? ((data.kpis.completed / data.kpis.totalTeamTasks) * 100).toFixed(1)
      : 0;

  // Merge overdue and completed data for chart
  const overdueWithCompleted = (data?.overdueByMember || []).map((member) => {
    const workloadData = (data?.workloadByMember || []).find(
      (w) => w.name === member.name,
    );
    return {
      ...member,
      completed: workloadData?.completed || 0,
    };
  });

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-4">
      {/* Header */}
      <div className="mb-3">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Team Analytics
        </h1>
        <p className="text-gray-600">
          Monitor team performance and workload distribution
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <KPICard
          title="Total Team Tasks"
          value={data?.kpis.totalTeamTasks || 0}
          icon={CheckSquare}
          color="blue"
          description="All team assignments"
          loading={loading}
        />
        <KPICard
          title="Completed"
          value={data?.kpis.completed || 0}
          icon={CheckCircle}
          color="green"
          trend="up"
          trendValue={completionRate}
          description="Team completion rate"
          loading={loading}
        />
        <KPICard
          title="Overdue Tasks"
          value={data?.kpis.overdue || 0}
          icon={Clock}
          color="orange"
          description="Past due date"
          loading={loading}
        />
        <KPICard
          title="At Risk"
          value={data?.kpis.atRisk || 0}
          icon={AlertTriangle}
          color="red"
          description="Flagged as risk"
          loading={loading}
        />
      </div>

      {/* Charts Row 1 - Team Productivity Trend */}
      <div className="mb-3">
        <TaskLineChart
          data={data?.productivityTrend || []}
          xKey="date"
          lines={[
            { key: "completed", color: "#10b981", name: "Completed" },
            { key: "assigned", color: "#3b82f6", name: "Assigned" },
          ]}
          title="Team Productivity Trend"
          height={300}
          loading={loading}
        />
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 my-3">
        <TaskDonutChart
          data={data?.statusDistribution || []}
          title="Team Task Status Distribution"
          colors={["#3b82f6", "#f59e0b", "#ef4444", "#10b981"]}
          height={300}
          loading={loading}
        />
        <TaskBarChart
          data={overdueWithCompleted}
          xKey="name"
          bars={[
            { key: "overdue", color: "#ef4444", name: "Overdue Tasks" },
            { key: "completed", color: "#10b981", name: "Completed Tasks" },
          ]}
          title="Overdue Tasks by Team Member"
          height={300}
          loading={loading}
        />
      </div>

      {/* Charts Row 3 - Workload Distribution */}
      <div className="mb-3">
        <TaskBarChart
          data={data?.workloadByMember || []}
          xKey="name"
          bars={[
            { key: "tasks", color: "#3b82f6", name: "Total Tasks" },
            { key: "completed", color: "#10b981", name: "Completed" },
          ]}
          title="Workload Distribution by Team Member"
          height={320}
          loading={loading}
        />
      </div>

      {/* Team Performance Table */}
      <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          Members Performance
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                  Team Member
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  Total Tasks
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  Completed
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  In Progress
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  Overdue
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">
                  Completion %
                </th>
              </tr>
            </thead>
            <tbody>
              {(data?.workloadByMember || []).map((member, index) => {
                const overdueData = data?.overdueByMember?.find(
                  (d) => d.firstName === member.firstName,
                );
                const inProgress =
                  member.tasks - member.completed - (overdueData?.overdue || 0);
                const completionPercent = (
                  (member.completed / member.tasks) *
                  100
                ).toFixed(1);

                return (
                  <tr
                    key={index}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">
                      {member.firstName}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 text-right">
                      {member.tasks}
                    </td>
                    <td className="py-3 px-4 text-sm text-green-600 text-right font-medium">
                      {member.completed}
                    </td>
                    <td className="py-3 px-4 text-sm text-blue-600 text-right">
                      {inProgress}
                    </td>
                    <td className="py-3 px-4 text-sm text-red-600 text-right font-medium">
                      {overdueData?.overdue || 0}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 text-right font-semibold">
                      {completionPercent}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ManagerTeamAnalyticsPage;
