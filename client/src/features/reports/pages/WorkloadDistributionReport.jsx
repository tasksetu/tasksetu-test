import React from "react";
import { PieChart, List, Users } from "lucide-react";
import { KPICard } from "../components";
import { useWorkloadDistributionReport } from "../hooks/useReports";

const WorkloadDistributionReport = ({ filters }) => {
  const { data, loading, error } = useWorkloadDistributionReport(filters);

  if (error) {
    return <div className="p-4 text-red-600">Error: {error}</div>;
  }

  return (
    <div className="p-4 space-y-3">
      <div className="mb-3">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          Workload Distribution
        </h2>
        <p className="text-sm text-gray-600">
          Analyze how tasks are spread across your team
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KPICard
          title="Avg. Load"
          value={`${data?.summary?.avgTasksPerUser || 0}`}
          icon={Users}
          color="blue"
          description="Tasks per active user"
          loading={loading}
        />
        <KPICard
          title="Total Active"
          value={data?.summary?.activeTasksCount || 0}
          icon={List}
          color="indigo"
          description="Total non-completed tasks"
          loading={loading}
        />
        <KPICard
          title="Utilization"
          value={`${data?.summary?.utilizationRate || 0}%`}
          icon={PieChart}
          color="purple"
          description="Team bandwidth usage"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            By Priority
          </h3>
          <div className="space-y-3">
            {Object.entries(data?.byPriority || {}).map(([priority, count]) => (
              <div key={priority} className="flex items-center gap-3">
                <span className="text-xs font-bold w-16 uppercase text-gray-500">
                  {priority}
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      priority === "high"
                        ? "bg-red-500"
                        : priority === "medium"
                          ? "bg-yellow-500"
                          : "bg-blue-500"
                    }`}
                    style={{
                      width: `${(count / (data.summary?.activeTasksCount || 1)) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-xs font-bold text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            By Assignee
          </h3>
          <div className="space-y-3">
            {(data?.byUser || []).map((user, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center text-sm"
              >
                <span className="text-gray-700">{user.name}</span>
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${user.taskCount > 10 ? "bg-red-500" : "bg-green-500"}`}
                  />
                  <span className="font-medium text-gray-900">
                    {user.taskCount} tasks
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkloadDistributionReport;
