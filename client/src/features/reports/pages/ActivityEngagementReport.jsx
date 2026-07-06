import React from "react";
import { MessageSquare, MousePointer2, Zap } from "lucide-react";
import { KPICard } from "../components";
import { useActivityEngagementReport } from "../hooks/useReports";

const ActivityEngagementReport = ({ filters }) => {
  const { data, loading, error } = useActivityEngagementReport(filters);

  if (error) {
    return <div className="p-4 text-red-600">Error: {error}</div>;
  }

  return (
    <div className="p-4 space-y-3">
      <div className="mb-3">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          Activity & Engagement
        </h2>
        <p className="text-sm text-gray-600">
          User interactions and platform engagement
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KPICard
          title="Total Actions"
          value={data?.summary?.totalActions || 0}
          icon={Zap}
          color="indigo"
          description="Total tracked activities"
          loading={loading}
        />
        <KPICard
          title="Comments"
          value={data?.summary?.commentCount || 0}
          icon={MessageSquare}
          color="blue"
          description="Total task discussions"
          loading={loading}
        />
        <KPICard
          title="Active Users"
          value={data?.summary?.activeUsers || 0}
          icon={MousePointer2}
          color="purple"
          description="Users with activity"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Top User Activity
          </h3>
          <div className="space-y-3">
            {(data?.topUsers || []).map((user, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-medium">
                    {user.name[0]}
                  </div>
                  <span className="text-sm text-gray-700">{user.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">
                    {user.actions}
                  </span>
                  <span className="text-xs text-gray-500">actions</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Activity Breakdown
          </h3>
          <div className="space-y-3">
            {Object.entries(data?.breakdown || {}).map(([type, count]) => (
              <div key={type} className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-gray-600 uppercase">{type}</span>
                  <span className="text-gray-900">{count}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-indigo-600 h-2 rounded-full"
                    style={{
                      width: `${(count / (data.summary?.totalActions || 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityEngagementReport;
