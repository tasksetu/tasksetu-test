import React, { useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  RefreshCw,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  Settings,
  Users,
  Target,
  Timer,
  Flame,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TaskAnalytics() {
  const [selectedPeriod, setSelectedPeriod] = useState("month");

  const analyticsData = {
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    pendingTasks: 0,
    overdueTasks: 0,
  };

  const completionRate =
    analyticsData.totalTasks > 0
      ? Math.round(
          (analyticsData.completedTasks / analyticsData.totalTasks) * 100,
        )
      : 0;

  const teamMembers = [];

  const priorityData = [];

  const timeframes = [
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "quarter", label: "This Quarter" },
    { value: "year", label: "This Year" },
  ];

  const getTrendIcon = (trend) => {
    if (trend.startsWith("+")) {
      return <TrendingUp className="h-3.5 w-3.5" />;
    } else if (trend.startsWith("-")) {
      return <TrendingDown className="h-3.5 w-3.5" />;
    }
    return <Minus className="h-3.5 w-3.5" />;
  };

  const getTrendStyle = (trend) => {
    if (trend.startsWith("+")) {
      return "text-green-700 bg-green-50";
    } else if (trend.startsWith("-")) {
      return "text-red-700 bg-red-50";
    }
    return "text-gray-700 bg-gray-50";
  };

  return (
    <div className="p-4 space-y-3 bg-gray-50 min-h-screen">
      {/* Header Section */}
      <div className="bg-white border border-gray-200 rounded-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-sm">
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Task Analytics
              </h1>
              <p className="text-sm text-gray-500">
                Comprehensive insights and performance metrics
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                className="appearance-none h-9 px-4 pr-8 text-sm border border-gray-300 rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
              >
                {timeframes.map((tf) => (
                  <option key={tf.value} value={tf.value}>
                    {tf.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
            <Button variant="outline" className="h-9 flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export Report
            </Button>
          </div>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Total Tasks */}
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-50 rounded-sm">
              <BarChart3 className="h-5 w-5 text-blue-600" />
            </div>
            <span
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${getTrendStyle("+12%")}`}
            >
              {getTrendIcon("+12%")}
              +12%
            </span>
          </div>
          <p className="text-sm text-gray-500">Total Tasks</p>
          <p className="text-2xl font-semibold text-gray-900">
            {analyticsData.totalTasks}
          </p>
          <p className="text-xs text-gray-400 mt-1">vs last {selectedPeriod}</p>
        </div>

        {/* Completed */}
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-green-50 rounded-sm">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <span
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${getTrendStyle("+8%")}`}
            >
              {getTrendIcon("+8%")}
              +8%
            </span>
          </div>
          <p className="text-sm text-gray-500">Completed</p>
          <p className="text-2xl font-semibold text-gray-900">
            {analyticsData.completedTasks}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {completionRate}% completion rate
          </p>
        </div>

        {/* In Progress */}
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-purple-50 rounded-sm">
              <RefreshCw className="h-5 w-5 text-purple-600" />
            </div>
            <span
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${getTrendStyle("-2%")}`}
            >
              {getTrendIcon("-2%")}
              -2%
            </span>
          </div>
          <p className="text-sm text-gray-500">In Progress</p>
          <p className="text-2xl font-semibold text-gray-900">
            {analyticsData.inProgressTasks}
          </p>
          <p className="text-xs text-gray-400 mt-1">28% of total tasks</p>
        </div>

        {/* Pending */}
        <div className="bg-white border border-gray-200 rounded-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-amber-50 rounded-sm">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <span
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${getTrendStyle("+5%")}`}
            >
              {getTrendIcon("+5%")}
              +5%
            </span>
          </div>
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-2xl font-semibold text-gray-900">
            {analyticsData.pendingTasks}
          </p>
          <p className="text-xs text-gray-400 mt-1">14% of total tasks</p>
        </div>

        {/* Overdue */}
        <div className="bg-white border border-red-200 rounded-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-red-50 rounded-sm">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <span
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${getTrendStyle("+3")}`}
            >
              {getTrendIcon("+3")}
              +3
            </span>
          </div>
          <p className="text-sm text-gray-500">Overdue</p>
          <p className="text-2xl font-semibold text-red-600">
            {analyticsData.overdueTasks}
          </p>
          <p className="text-xs text-red-400 mt-1">Needs attention</p>
        </div>
      </div>

      {/* Completion Rate Card */}
      <div className="bg-white border border-gray-200 rounded-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-5 w-5 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-900">
            Overall Progress
          </h3>
        </div>
        <div className="flex items-center gap-8">
          <div className="relative">
            <svg className="w-32 h-32" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="50"
                stroke="#f3f4f6"
                strokeWidth="10"
                fill="none"
              />
              <circle
                cx="60"
                cy="60"
                r="50"
                stroke="#10b981"
                strokeWidth="10"
                fill="none"
                strokeDasharray={`${completionRate * 3.14} 314`}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-gray-900">
                {completionRate}%
              </span>
              <span className="text-xs text-gray-500">Complete</span>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-3 gap-3">
            <div className="text-center p-3 border border-gray-100 rounded-sm">
              <p className="text-lg font-semibold text-green-600">
                {analyticsData.completedTasks}
              </p>
              <p className="text-xs text-gray-500">Completed</p>
            </div>
            <div className="text-center p-3 border border-gray-100 rounded-sm">
              <p className="text-lg font-semibold text-purple-600">
                {analyticsData.inProgressTasks}
              </p>
              <p className="text-xs text-gray-500">In Progress</p>
            </div>
            <div className="text-center p-3 border border-gray-100 rounded-sm">
              <p className="text-lg font-semibold text-amber-600">
                {analyticsData.pendingTasks}
              </p>
              <p className="text-xs text-gray-500">Pending</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Priority Distribution */}
        <div className="bg-white border border-gray-200 rounded-sm">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-gray-500" />
              <h3 className="text-sm font-medium text-gray-900">
                Task Distribution by Priority
              </h3>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings className="h-4 w-4 text-gray-400" />
            </Button>
          </div>
          <div className="p-4 space-y-3">
            {priorityData.map((item, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-gray-700">{item.priority}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {item.count} tasks
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {item.percentage}%
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${item.color}`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Team Performance */}
        <div className="bg-white border border-gray-200 rounded-sm">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500" />
              <h3 className="text-sm font-medium text-gray-900">
                Team Performance
              </h3>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <BarChart3 className="h-4 w-4 text-gray-400" />
            </Button>
          </div>
          <div className="divide-y divide-gray-100">
            {teamMembers.map((member, index) => (
              <div key={index} className="px-4 py-3 flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full ${member.color} flex items-center justify-center text-xs font-medium text-white`}
                >
                  {member.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {member.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {member.completed} tasks completed
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${member.rate}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700 w-10 text-right">
                    {member.rate}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Additional Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-sm p-4 flex items-start gap-3">
          <div className="p-2 bg-blue-50 rounded-sm">
            <Target className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-900">
              Peak Productivity
            </h4>
            <p className="text-xs text-gray-500 mt-1">
              Your team completes 40% more tasks on Tuesday-Thursday
            </p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-sm p-4 flex items-start gap-3">
          <div className="p-2 bg-green-50 rounded-sm">
            <Timer className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-900">
              Average Completion Time
            </h4>
            <p className="text-xs text-gray-500 mt-1">
              Tasks are completed 2.3 days faster than last month
            </p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-sm p-4 flex items-start gap-3">
          <div className="p-2 bg-amber-50 rounded-sm">
            <Flame className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-900">
              Hottest Category
            </h4>
            <p className="text-xs text-gray-500 mt-1">
              Development tasks show highest completion rates
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
