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
} from "../components";
import { useProductivityReport } from "../hooks/useReports";

/**
 * My Productivity Report Component
 */
const MyProductivityReport = ({ filters }) => {
  const { data, loading, error } = useProductivityReport(filters);

  // Show error state
  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
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
    <div className="p-4">
      <div className="mb-3">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          My Productivity
        </h2>
        <p className="text-sm text-gray-600">
          Track your task performance and productivity metrics
        </p>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <KPICard
          title="Total Tasks"
          value={data?.kpis.totalTasks || 0}
          icon={CheckSquare}
          color="blue"
          description="Total assigned tasks"
          loading={loading}
        />
        <KPICard
          title="Completed"
          value={data?.kpis.completed || 0}
          icon={CheckCircle}
          color="green"
          description="Tasks finished"
          loading={loading}
        />
        <KPICard
          title="Completion Rate"
          value={`${completionRate}%`}
          icon={Target}
          color="teal"
          description="Efficiency score"
          loading={loading}
        />
        <KPICard
          title="Overdue"
          value={data?.kpis.overdue || 0}
          icon={AlertTriangle}
          color="red"
          description="Tasks past deadline"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        <TaskDonutChart
          data={data?.statusDistribution || []}
          title="Task Status Distribution"
          colors={["#3b82f6", "#10b981", "#f59e0b", "#ef4444"]}
          height={300}
          loading={loading}
        />

        <TaskLineChart
          data={data?.completionTrend || []}
          xKey="date"
          lines={[{ key: "completed", color: "#10b981", name: "Completed" }]}
          title="Completion Trend"
          height={300}
          loading={loading}
        />
      </div>

      <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          Priority Workload
        </h3>
        <TaskBarChart
          data={data?.priorityLoad || []}
          xKey="name"
          yKey="tasks"
          title="Tasks by Priority"
          color="#3b82f6"
          height={300}
          loading={loading}
        />
      </div>
    </div>
  );
};

export default MyProductivityReport;
