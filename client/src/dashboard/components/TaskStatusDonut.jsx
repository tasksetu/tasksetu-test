import React, { useState, useMemo } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { PieChart as PieChartIcon, ChevronDown } from "lucide-react";

const TaskStatusDonut = ({
  totalTasks = 0,
  openCount = 0,
  inProgressCount = 0,
  completedCount = 0,
  overdueCount = 0,
}) => {
  const [timeFilter, setTimeFilter] = useState("month");

  const data = useMemo(() => {
    const total = Math.max(totalTasks, openCount + inProgressCount + completedCount + overdueCount, 1);

    const items = [
      {
        name: "Open",
        value: openCount,
        color: "#3b82f6",
        percentage: Math.round((openCount / total) * 100),
      },
      {
        name: "In Progress",
        value: inProgressCount,
        color: "#f59e0b",
        percentage: Math.round((inProgressCount / total) * 100),
      },
      {
        name: "Completed",
        value: completedCount,
        color: "#10b981",
        percentage: Math.round((completedCount / total) * 100),
      },
      {
        name: "Overdue",
        value: overdueCount,
        color: "#ef4444",
        percentage: Math.round((overdueCount / total) * 100),
      },
    ];

    // If total is 0, provide placeholder slice for clean visual
    if (items.every((item) => item.value === 0)) {
      return [{ name: "No Tasks", value: 1, color: "#e2e8f0", percentage: 100 }];
    }

    return items;
  }, [totalTasks, openCount, inProgressCount, completedCount, overdueCount]);

  const activeTotal = totalTasks > 0 ? totalTasks : openCount + inProgressCount + completedCount + overdueCount;

  return (
    <div className="bg-white border border-slate-200/80 rounded-sm p-5 shadow-sm flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-sm bg-blue-50 text-blue-600 flex items-center justify-center">
            <PieChartIcon size={16} />
          </div>
          <h3 className="font-bold text-slate-800 text-base">Task Status</h3>
        </div>

        <div className="relative">
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg px-2.5 py-1.5 pr-7 font-medium outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="month">This Month</option>
            <option value="week">This Week</option>
            <option value="all">All Time</option>
          </select>
          <ChevronDown
            size={12}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
        </div>
      </div>

      {/* Donut and Legend */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-2 flex-1">
        {/* Donut Chart with Centered Text */}
        <div className="relative w-44 h-44 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                formatter={(val, name) => [`${val} tasks`, name]}
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                  fontSize: "12px",
                }}
              />
              <Pie
                data={data}
                innerRadius={52}
                outerRadius={75}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Centered label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold text-slate-900 leading-none">
              {activeTotal}
            </span>
            <span className="text-[11px] font-medium text-slate-400 mt-1">
              Total Tasks
            </span>
          </div>
        </div>

        {/* Legend on the right */}
        <div className="flex-1 w-full sm:w-auto space-y-2.5 pl-2 sm:pl-0">
          {data
            .filter((item) => item.name !== "No Tasks")
            .map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between text-xs gap-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-[3px] inline-block flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-slate-600 font-medium">{item.name}</span>
                </div>
                <div className="flex items-center gap-2 font-semibold">
                  <span className="text-slate-800">{item.value}</span>
                  <span className="text-slate-400 text-[11px] min-w-[28px] text-right">
                    {item.percentage}%
                  </span>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default TaskStatusDonut;
