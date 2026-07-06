import React from "react";
import { Clock, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import { KPICard } from "../components";
import { useRecurringTaskAdherenceReport } from "../hooks/useReports";

const RecurringTaskAdherenceReport = ({ filters }) => {
  const { data, loading, error } = useRecurringTaskAdherenceReport(filters);

  if (error) {
    return <div className="p-4 text-red-600">Error: {error}</div>;
  }

  return (
    <div className="p-4 space-y-3">
      <div className="mb-3">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          Recurring Task Adherence
        </h2>
        <p className="text-sm text-gray-600">
          Ensure repetitive tasks are completed on schedule
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <KPICard
          title="Total Recurring"
          value={data?.summary?.totalRecurring || 0}
          icon={Clock}
          color="blue"
          description="All recurring tasks"
          loading={loading}
        />
        <KPICard
          title="Completed"
          value={data?.summary?.completed || 0}
          icon={CheckCircle}
          color="green"
          description="Successfully completed"
          loading={loading}
        />
        <KPICard
          title="On Time"
          value={data?.summary?.onTime || 0}
          icon={AlertTriangle}
          color="orange"
          description="On time completion"
          loading={loading}
        />
        <KPICard
          title="Adherence Rate"
          value={`${data?.summary?.adherenceRate || 0}%`}
          icon={TrendingUp}
          color="teal"
          description="Completion rate"
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
                  On Time
                </th>
                <th className="py-3 px-4 text-sm font-medium text-gray-600 text-left">
                  Adherence Rate
                </th>
                <th className="py-3 px-4 text-sm font-medium text-gray-600 text-left">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 text-sm font-bold text-green-600">
                  {data?.summary?.completed || 0}
                </td>
                <td className="py-3 px-4 text-sm font-bold text-orange-600">
                  {data?.summary?.onTime || 0}
                </td>
                <td className="py-3 px-4 text-sm font-bold text-blue-600">
                  {data?.summary?.adherenceRate || 0}%
                </td>
                <td className="py-3 px-4 text-sm font-bold text-gray-900">
                  {data?.summary?.totalRecurring || 0}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RecurringTaskAdherenceReport;
