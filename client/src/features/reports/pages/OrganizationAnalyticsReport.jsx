import React from "react";
import { Building2, TrendingUp, Users, Target } from "lucide-react";
import { KPICard } from "../components";
import { useOrganizationAnalytics } from "../hooks/useReports";

const OrganizationAnalyticsReport = ({ filters }) => {
  const { data, loading, error } = useOrganizationAnalytics(filters);

  if (error) {
    return <div className="p-4 text-red-600">Error: {error}</div>;
  }

  return (
    <div className="p-4 space-y-3">
      <div className="mb-3">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          Organization Insights
        </h2>
        <p className="text-sm text-gray-600">
          Global overview of your enterprise performance
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <KPICard
          title="Total Projects"
          value={data?.summary?.projectCount || 0}
          icon={Building2}
          color="indigo"
          description="Across all departments"
          loading={loading}
        />
        <KPICard
          title="Active Users"
          value={data?.summary?.activeUsers || 0}
          icon={Users}
          color="blue"
          description="Current month"
          loading={loading}
        />
        <KPICard
          title="Avg. Efficiency"
          value={`${data?.summary?.avgEfficiency || 0}%`}
          icon={TrendingUp}
          color="green"
          description="Org-wide average"
          loading={loading}
        />
        <KPICard
          title="Goals Met"
          value={`${data?.summary?.goalsMet || 0}%`}
          icon={Target}
          color="purple"
          description="Quarterly targets"
          loading={loading}
        />
      </div>

      <div className="bg-white rounded-sm shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-100 font-semibold">
          Departmental Performance
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {(data?.departments || []).map((dept, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-gray-900">{dept.name}</span>
                  <span className="text-gray-500">
                    {dept.completionRate}% completion
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden flex">
                  <div
                    className="bg-indigo-500 h-full"
                    style={{ width: `${dept.completionRate}%` }}
                  />
                </div>
                <div className="flex gap-3 text-[10px] text-gray-400 font-medium">
                  <span>{dept.tasksCount} Tasks</span>
                  <span>{dept.memberCount} Members</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizationAnalyticsReport;
