import React from "react";
import { Timer, Zap, BarChart } from "lucide-react";
import { KPICard } from "../components";
import { useProductivityEfficiencyReport } from "../hooks/useReports";

const ProductivityEfficiencyReport = ({ filters }) => {
  const { data, loading, error } = useProductivityEfficiencyReport(filters);

  if (error) {
    return <div className="p-4 text-red-600">Error: {error}</div>;
  }

  return (
    <div className="p-4 space-y-3">
      <div className="mb-3">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          Productivity & Efficiency
        </h2>
        <p className="text-sm text-gray-600">
          Deep dive into completion speeds and output quality
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KPICard
          title="Avg. Lead Time"
          value={`${data?.summary?.avgLeadTime || 0}h`}
          icon={Timer}
          color="blue"
          description="Creation to completion"
          loading={loading}
        />
        <KPICard
          title="Focus Score"
          value={`${data?.summary?.focusScore || 0}%`}
          icon={Zap}
          color="yellow"
          description="Time spent on high priority"
          loading={loading}
        />
        <KPICard
          title="Output Rate"
          value={`${data?.summary?.outputRate || 0} tasks/day`}
          icon={BarChart}
          color="green"
          description="Tasks per user average"
          loading={loading}
        />
      </div>

      <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Efficiency Trends
        </h3>
        <div className="h-64 flex items-end justify-between px-4 pb-8 border-b border-gray-100">
          {(data?.trends || []).map((point, i) => (
            <div
              key={i}
              className="group relative flex flex-col items-center flex-1"
            >
              <div
                className="w-1/2 bg-blue-100 group-hover:bg-blue-200 rounded-t-lg transition-all border-x border-t border-blue-200"
                style={{ height: `${point.efficiency}%` }}
              >
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                  {point.efficiency}% Efficiency
                </div>
              </div>
              <span className="absolute -bottom-6 text-[10px] text-gray-500 font-medium">
                {point.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProductivityEfficiencyReport;
