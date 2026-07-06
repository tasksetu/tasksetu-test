import React from "react";
import { AlertCircle, Clock, Calendar } from "lucide-react";
import { KPICard } from "../components";
import { useOverdueTasksReport } from "../hooks/useReports";

const OverdueTasksReport = ({ filters }) => {
  const { data, loading, error } = useOverdueTasksReport(filters);

  if (error) {
    return <div className="p-4 text-red-600">Error: {error}</div>;
  }

  return (
    <div className="p-4 space-y-3">
      <div className="mb-3">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Overdue Tasks</h2>
        <p className="text-sm text-gray-600">
          Analysis of tasks past their due dates
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KPICard
          title="Total Overdue"
          value={data?.summary?.totalOverdue || 0}
          icon={AlertCircle}
          color="red"
          description="Tasks currently overdue"
          loading={loading}
        />
        <KPICard
          title="Average Delay"
          value={`${data?.summary?.avgDelayDays || 0}d`}
          icon={Clock}
          color="orange"
          description="Avg. days past due"
          loading={loading}
        />
        <KPICard
          title="Critical Tasks"
          value={data?.summary?.highPriorityOverdue || 0}
          icon={Calendar}
          color="pink"
          description="High priority overdue"
          loading={loading}
        />
      </div>

      <div className="bg-white rounded-sm shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-gray-900">
            Overdue Task Distribution
          </h3>
        </div>
        <div className="p-4">
          <div className="h-[300px] flex items-end gap-2">
            {(data?.distribution || []).map((item, index) => (
              <div
                key={index}
                className="flex-1 bg-red-100 relative group flex flex-col items-center"
              >
                <div
                  className="w-full bg-red-500 rounded-t-sm transition-all group-hover:bg-red-600"
                  style={{
                    height: `${(item.count / (data.summary?.maxInBatch || 1)) * 100}%`,
                  }}
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
                    {item.count} tasks
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-600 rotate-45 origin-left">
                  {item.range}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverdueTasksReport;
