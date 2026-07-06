import React from "react";
import { AlertTriangle, Target, Clock } from "lucide-react";
import { KPICard } from "../components";
import { useMilestoneAchievementReport } from "../hooks/useReports";

const MilestoneAchievementReport = ({ filters }) => {
  const { data, loading, error } = useMilestoneAchievementReport(filters);

  if (error) {
    return (
      <div className="p-4 text-red-600">
        Error loading milestone report: {error}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="mb-3">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          Milestone Achievement Report
        </h2>
        <p className="text-sm text-gray-600">
          Track progress against project milestones
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KPICard
          title="Total Milestones"
          value={data?.summary?.totalMilestones || 0}
          icon={Target}
          color="blue"
          description="All milestones"
          loading={loading}
        />
        <KPICard
          title="Completed"
          value={data?.summary?.achieved || 0}
          icon={Target}
          color="green"
          description="Successfully completed"
          loading={loading}
        />
        <KPICard
          title="In Progress"
          value={data?.summary?.inProgress || 0}
          icon={AlertTriangle}
          color="orange"
          description="Currently active"
          loading={loading}
        />
      </div>

      <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-4">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="py-3 px-4 text-sm font-medium text-gray-600 text-left">
                  Completed
                </th>
                <th className="py-3 px-4 text-sm font-medium text-gray-600 text-left">
                  In Progress
                </th>
                <th className="py-3 px-4 text-sm font-medium text-gray-600 text-left">
                  Total
                </th>
                <th className="py-3 px-4 text-sm font-medium text-gray-600 text-left">
                  Achievement Rate
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 text-sm font-bold text-green-600">
                  {data?.summary?.achieved || 0}
                </td>
                <td className="py-3 px-4 text-sm font-bold text-orange-600">
                  {data?.summary?.inProgress || 0}
                </td>
                <td className="py-3 px-4 text-sm font-bold text-gray-900">
                  {data?.summary?.totalMilestones || 0}
                </td>
                <td className="py-3 px-4 text-sm font-bold text-blue-600">
                  {data?.summary?.achievementRate || 0}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MilestoneAchievementReport;
