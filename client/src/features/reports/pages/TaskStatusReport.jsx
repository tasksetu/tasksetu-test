import React from "react";
import { CheckCircle2, Circle, Clock, Loader2 } from "lucide-react";
import { KPICard } from "../components";
import { useTaskStatusReport } from "../hooks/useReports";

const TaskStatusReport = ({ filters }) => {
  const { data, loading, error } = useTaskStatusReport(filters);

  if (error) {
    return <div className="p-4 text-red-600">Error: {error}</div>;
  }

  return (
    <div className="p-4 space-y-3">
      <div className="mb-3">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          Task Status Report
        </h2>
        <p className="text-sm text-gray-600">
          Overall visibility into task lifecycle and current states
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <KPICard
          title="Total Tasks"
          value={data?.summary?.totalTasks || 0}
          icon={Circle}
          color="gray"
          description="Tasks in period"
          loading={loading}
        />
        <KPICard
          title="Done"
          value={data?.summary?.completedTasks || 0}
          icon={CheckCircle2}
          color="green"
          description="Success"
          loading={loading}
        />
        <KPICard
          title="In Progress"
          value={data?.summary?.inProgressTasks || 0}
          icon={Loader2}
          color="blue"
          description="Active"
          loading={loading}
        />
        <KPICard
          title="To Do"
          value={data?.summary?.todoTasks || 0}
          icon={Clock}
          color="yellow"
          description="Pending"
          loading={loading}
        />
      </div>

      <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Completion Trend
        </h3>
        <div className="w-full flex items-center justify-between gap-1 h-32">
          {(data?.trend || []).map((day, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2">
              <div
                className="w-full bg-green-100 rounded-t-sm relative group"
                style={{
                  height: `${(day.count / (data.summary?.maxDayCount || 1)) * 100}%`,
                }}
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
                  {day.count} completed
                </div>
              </div>
              <span className="text-[10px] text-gray-400 font-medium rotate-45">
                {day.date}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TaskStatusReport;
