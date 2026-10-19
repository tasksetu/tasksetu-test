import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { LineChart as LineChartIcon, ChevronDown } from "lucide-react";
import { format, subDays, startOfMonth, eachDayOfInterval, isSameDay } from "date-fns";

const TaskOverviewChart = ({ tasks = [], overviewData = null }) => {
  const [timeRange, setTimeRange] = useState("7d"); // "7d", "30d", "month"
  const [taskFilter, setTaskFilter] = useState("all");

  const chartData = useMemo(() => {
    const today = new Date();
    let days = [];

    if (timeRange === "7d") {
      days = Array.from({ length: 7 }, (_, i) => subDays(today, 6 - i));
    } else if (timeRange === "30d") {
      days = Array.from({ length: 30 }, (_, i) => subDays(today, 29 - i));
    } else if (timeRange === "month") {
      const monthStart = startOfMonth(today);
      days = eachDayOfInterval({ start: monthStart, end: today });
    }

    const filteredTasks = tasks.filter((t) => {
      if (taskFilter === "all") return true;
      return (t.taskType || "").toLowerCase() === taskFilter.toLowerCase();
    });

    // Map server overview data for O(1) matching if available
    const overviewMap = new Map();
    if (Array.isArray(overviewData)) {
      overviewData.forEach((item) => {
        if (item.date) overviewMap.set(String(item.date).trim(), item);
        if (item.fullDate) overviewMap.set(String(item.fullDate).trim(), item);
      });
    }

    return days.map((day) => {
      const dayLabel = format(day, "dd MMM");
      const dayFull = format(day, "yyyy-MM-dd");

      const serverDay =
        taskFilter === "all" && timeRange === "7d"
          ? overviewMap.get(dayFull) || overviewMap.get(dayLabel)
          : null;

      // Created on this day
      const taskCreated = filteredTasks.filter((t) => {
        if (!t.createdAt) return false;
        const c = new Date(t.createdAt);
        return !isNaN(c.getTime()) && isSameDay(c, day);
      }).length;
      const created = serverDay
        ? Number(serverDay.Created ?? serverDay.created ?? 0)
        : taskCreated;

      // Completed on this day
      const taskCompleted = filteredTasks.filter((t) => {
        const compDate = t.completedAt || t.completedDate;
        if (!compDate) return false;
        const c = new Date(compDate);
        return !isNaN(c.getTime()) && isSameDay(c, day);
      }).length;
      const completed = serverDay
        ? Number(serverDay.Completed ?? serverDay.completed ?? 0)
        : taskCompleted;

      // Due on this day
      const taskDue = filteredTasks.filter((t) => {
        if (!t.dueDate || t.dueDate === "No due date") return false;
        const d = new Date(t.dueDate);
        return !isNaN(d.getTime()) && isSameDay(d, day);
      }).length;
      const due = serverDay
        ? Number(serverDay.Due ?? serverDay.due ?? 0)
        : taskDue;

      // Overdue on this day (due on or before this day and not completed/cancelled)
      const taskOverdue = filteredTasks.filter((t) => {
        if (!t.dueDate || t.dueDate === "No due date") return false;
        const d = new Date(t.dueDate);
        if (isNaN(d.getTime())) return false;
        const s = (t.status || "").toLowerCase();
        const isDone = ["completed", "done", "DONE"].includes(s);
        const isCancelled = ["cancelled", "canceled", "rejected"].includes(s);
        return d <= day && !isDone && !isCancelled;
      }).length;
      const overdue = serverDay
        ? Number(serverDay.Overdue ?? serverDay.overdue ?? 0)
        : taskOverdue;

      // Pending on this day (created on or before this day and not completed or cancelled)
      const taskPending = filteredTasks.filter((t) => {
        const c = t.createdAt ? new Date(t.createdAt) : null;
        if (!c || isNaN(c.getTime())) return false;
        const s = (t.status || "").toLowerCase();
        const isDone = ["completed", "done", "DONE"].includes(s);
        const isCancelled = ["cancelled", "canceled", "rejected"].includes(s);
        return c <= day && !isDone && !isCancelled;
      }).length;
      const pending = serverDay
        ? Number(serverDay.Pending ?? serverDay.pending ?? 0)
        : taskPending;

      // Cancelled on this day
      const taskCancelled = filteredTasks.filter((t) => {
        const s = (t.status || "").toLowerCase();
        const isCancelled = ["cancelled", "canceled", "rejected"].includes(s);
        if (!isCancelled) return false;
        const date = t.updatedAt || t.createdAt;
        if (!date) return false;
        const d = new Date(date);
        return !isNaN(d.getTime()) && isSameDay(d, day);
      }).length;
      const cancelled = serverDay
        ? Number(serverDay.Cancelled ?? serverDay.cancelled ?? 0)
        : taskCancelled;

      return {
        date: dayLabel,
        Created: created,
        Completed: completed,
        Due: due,
        Pending: pending,
        Overdue: overdue,
        Cancelled: cancelled,
      };
    });
  }, [tasks, overviewData, timeRange, taskFilter]);

  // Custom stylish tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-xl p-3 shadow-lg text-xs">
          <div className="font-bold text-slate-800 border-b border-slate-100 pb-1.5 mb-1.5">
            {label}
          </div>
          <div className="space-y-1">
            {payload.map((entry, index) => (
              <div key={`item-${index}`} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 font-medium text-slate-600">
                  <span
                    className="w-2 h-2 rounded-sm inline-block"
                    style={{ backgroundColor: entry.color }}
                  />
                  {entry.name}
                </span>
                <span className="font-bold text-slate-900">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-sm p-5 shadow-sm flex flex-col justify-between h-full">
      {/* Header with Title and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-sm bg-blue-50 text-blue-600 flex items-center justify-center">
            <LineChartIcon size={16} />
          </div>
          <h3 className="font-bold text-slate-800 text-base">Task Overview</h3>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Time range pills */}
          <div className="flex bg-slate-100/80 p-0.5 rounded-sm text-xs">
            <button
              onClick={() => setTimeRange("7d")}
              className={`px-2.5 py-1 rounded-sm font-medium transition-all ${
                timeRange === "7d"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setTimeRange("30d")}
              className={`px-2.5 py-1 rounded-sm font-medium transition-all ${
                timeRange === "30d"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setTimeRange("month")}
              className={`px-2.5 py-1 rounded-sm font-medium transition-all ${
                timeRange === "month"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              This Month
            </button>
          </div>

          {/* Type filter dropdown */}
          <div className="relative">
            <select
              value={taskFilter}
              onChange={(e) => setTaskFilter(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-sm px-2.5 py-1.5 pr-7 font-medium outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Tasks</option>
              <option value="regular">Regular</option>
              <option value="recurring">Recurring</option>
              <option value="milestone">Milestone</option>
              <option value="approval">Approval</option>
              <option value="quick">Quick Tasks</option>
            </select>
            <ChevronDown
              size={12}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>
        </div>
      </div>

      {/* Recharts Area Chart */}
      <div className="w-full h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorDue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorPending" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorOverdue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorCancelled" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#64748b" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#64748b" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey="Created"
              stroke="#3b82f6"
              strokeWidth={2.2}
              fillOpacity={1}
              fill="url(#colorCreated)"
              dot={{ r: 2.5, fill: "#3b82f6", strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="Completed"
              stroke="#10b981"
              strokeWidth={2.2}
              fillOpacity={1}
              fill="url(#colorCompleted)"
              dot={{ r: 2.5, fill: "#10b981", strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="Due"
              stroke="#f59e0b"
              strokeWidth={2.2}
              fillOpacity={1}
              fill="url(#colorDue)"
              dot={{ r: 2.5, fill: "#f59e0b", strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="Pending"
              stroke="#8b5cf6"
              strokeWidth={2.2}
              fillOpacity={1}
              fill="url(#colorPending)"
              dot={{ r: 2.5, fill: "#8b5cf6", strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="Overdue"
              stroke="#ef4444"
              strokeWidth={2.2}
              fillOpacity={1}
              fill="url(#colorOverdue)"
              dot={{ r: 2.5, fill: "#ef4444", strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="Cancelled"
              stroke="#64748b"
              strokeWidth={2.2}
              fillOpacity={1}
              fill="url(#colorCancelled)"
              dot={{ r: 2.5, fill: "#64748b", strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Custom Legend at Bottom */}
      <div className="flex items-center justify-center gap-4 pt-3 mt-1 border-t border-slate-100 text-xs flex-wrap">
        <div className="flex items-center gap-1.5 font-medium text-slate-600">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />
          <span>Created</span>
        </div>
        <div className="flex items-center gap-1.5 font-medium text-slate-600">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-1.5 font-medium text-slate-600">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
          <span>Due</span>
        </div>
        <div className="flex items-center gap-1.5 font-medium text-slate-600">
          <span className="w-2.5 h-2.5 rounded-sm bg-purple-500 inline-block" />
          <span>Pending</span>
        </div>
        <div className="flex items-center gap-1.5 font-medium text-slate-600">
          <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
          <span>Overdue</span>
        </div>
        <div className="flex items-center gap-1.5 font-medium text-slate-600">
          <span className="w-2.5 h-2.5 rounded-sm bg-slate-500 inline-block" />
          <span>Cancelled</span>
        </div>
      </div>
    </div>
  );
};

export default TaskOverviewChart;
