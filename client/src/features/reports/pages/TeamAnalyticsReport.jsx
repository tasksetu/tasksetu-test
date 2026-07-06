import React from "react";
import { Users, Target, BarChart2 } from "lucide-react";
import { KPICard } from "../components";
import { useTeamAnalyticsReport } from "../hooks/useReports";

const TeamAnalyticsReport = ({ filters }) => {
  const { data, loading, error } = useTeamAnalyticsReport(filters);

  if (error) {
    return <div className="p-4 text-red-600">Error: {error}</div>;
  }

  return (
    <div className="p-4 space-y-3">
      <div className="mb-3">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          Team Analytics
        </h2>
        <p className="text-sm text-gray-600">
          Cross-team performance and bottleneck analysis
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KPICard
          title="Total Teams"
          value={data?.summary?.teamCount || 0}
          icon={Users}
          color="blue"
          description="Active project teams"
          loading={loading}
        />
        <KPICard
          title="Completion Rate"
          value={`${data?.summary?.avgCompletionRate || 0}%`}
          icon={Target}
          color="green"
          description="Average across teams"
          loading={loading}
        />
        <KPICard
          title="Pending Assets"
          value={data?.summary?.totalPending || 0}
          icon={BarChart2}
          color="orange"
          description="Tasks in progress"
          loading={loading}
        />
      </div>

      <div className="bg-white rounded-sm shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-100 font-semibold">
          Team Performance Matrix
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-6 py-3">Team Name</th>
                <th className="px-6 py-3">Collaborators</th>
                <th className="px-6 py-3">Efficiency</th>
                <th className="px-6 py-3">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(data?.teams || []).map((team, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {team.name}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {team.memberCount} members
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        team.efficiency > 80
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {team.efficiency}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1">
                      {team.history.map((h, i) => (
                        <div
                          key={i}
                          className="w-4 bg-blue-500 rounded-t-sm"
                          style={{ height: `${h * 0.2}px` }}
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TeamAnalyticsReport;
