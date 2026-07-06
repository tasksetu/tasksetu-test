import React from "react";
import { CheckSquare, Activity, TrendingUp } from "lucide-react";
import { KPICard } from "../components";
import { useQuickTaskConversionReport } from "../hooks/useReports";

const QuickTaskConversionReport = ({ filters }) => {
  const { data, loading, error } = useQuickTaskConversionReport(filters);

  if (error) {
    return <div className="p-4 text-red-600">Error: {error}</div>;
  }

  return (
    <div className="p-4 space-y-3">
      <div className="mb-3">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          Quick Task Conversion
        </h2>
        <p className="text-sm text-gray-600">
          Insights into quick task adoption and completion
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KPICard
          title="Quick Tasks"
          value={data?.summary?.totalQuickTasks || 0}
          icon={CheckSquare}
          color="blue"
          description="Total quick tasks"
          loading={loading}
        />
        <KPICard
          title="Completed"
          value={data?.summary?.completedQuick || 0}
          icon={TrendingUp}
          color="green"
          description="Successfully finished"
          loading={loading}
        />
        <KPICard
          title="Conversion Rate"
          value={`${data?.summary?.conversionRate || 0}%`}
          icon={Activity}
          color="teal"
          description="Success rate"
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
                  Total Quick Tasks
                </th>
                <th className="py-3 px-4 text-sm font-medium text-gray-600 text-left">
                  Conversion Rate
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 text-sm font-bold text-green-600">
                  {data?.summary?.completedQuick || 0}
                </td>
                <td className="py-3 px-4 text-sm font-bold text-gray-900">
                  {data?.summary?.totalQuickTasks || 0}
                </td>
                <td className="py-3 px-4 text-sm font-bold text-blue-600">
                  {data?.summary?.conversionRate || 0}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default QuickTaskConversionReport;
