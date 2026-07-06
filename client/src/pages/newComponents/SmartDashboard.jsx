import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Users,
  TrendingUp,
  Filter,
  Plus,
  MessageCircle,
  Bell,
  Eye,
  MoreVertical,
  ArrowUpRight,
  Target,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  format,
  isToday,
  isTomorrow,
  isYesterday,
  isPast,
  addDays,
} from "date-fns";
import axios from "axios";
import TaskThreadModal from "./TaskThreadModal";
import SmartTaskParser from "./SmartTaskParser";

const SmartDashboard = ({ currentUser }) => {
  const [dashboardData, setDashboardData] = useState({
    dueToday: [],
    overdue: [],
    upcoming: [],
    createdByMe: [],
    recentActivity: [],
    stats: {
      totalTasks: 0,
      completedTasks: 0,
      overdueCount: 0,
      todayCount: 0,
    },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showThreadModal, setShowThreadModal] = useState(false);
  const [showSmartParser, setShowSmartParser] = useState(false);
  const [filter, setFilter] = useState("all"); // all, high-priority, assigned-to-me
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    fetchDashboardData();
    fetchNotifications();

    // Set up real-time updates
    const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [filter]);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/dashboard/smart-data?filter=${filter}`,
      );
      setDashboardData(response.data);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/notifications/recent`,
      );
      setNotifications(response.data.slice(0, 5)); // Show only recent 5
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setShowThreadModal(true);
  };

  const handleTaskCreated = (newTask) => {
    fetchDashboardData(); // Refresh dashboard
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case "urgent":
        return "bg-red-100 text-red-700 border-red-200";
      case "high":
        return "bg-orange-100 text-orange-700 border-orange-200";
      case "medium":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "low":
        return "bg-green-100 text-green-700 border-green-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "text-green-600";
      case "in_progress":
        return "text-blue-600";
      case "todo":
        return "text-gray-600";
      case "blocked":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const formatRelativeDate = (date) => {
    const taskDate = new Date(date);
    if (isToday(taskDate)) return "Today";
    if (isTomorrow(taskDate)) return "Tomorrow";
    if (isYesterday(taskDate)) return "Yesterday";
    if (isPast(taskDate)) return `${format(taskDate, "MMM dd")} (Overdue)`;
    return format(taskDate, "MMM dd");
  };

  const DashboardCard = ({
    title,
    count,
    icon: Icon,
    color,
    children,
    action,
  }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-200">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-sm ${color}`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{title}</h3>
              <p className="text-2xl font-bold text-gray-900 mt-1">{count}</p>
            </div>
          </div>
          {action && (
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-gray-600"
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          )}
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">{children}</div>
      </div>
    </div>
  );

  const TaskItem = ({ task, showAssignee = false, compact = false }) => (
    <div
      onClick={() => handleTaskClick(task)}
      className={`p-3 bg-gray-50 rounded-sm hover:bg-gray-100 cursor-pointer transition-colors border-l-4 ${
        task.priority === "urgent"
          ? "border-red-500"
          : task.priority === "high"
            ? "border-orange-500"
            : task.priority === "medium"
              ? "border-blue-500"
              : "border-green-500"
      } ${compact ? "p-2" : "p-3"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4
            className={`font-medium text-gray-900 truncate ${compact ? "text-sm" : ""}`}
            title={task.title}
          >
            {task.title}
          </h4>
          <div className="flex items-center gap-2 mt-1">
            {task.dueDate && (
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  isPast(new Date(task.dueDate)) && task.status !== "completed"
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                <Clock className="h-3 w-3 inline mr-1" />
                {formatRelativeDate(task.dueDate)}
              </span>
            )}
            <span
              className={`text-xs px-2 py-1 rounded-full border ${getPriorityColor(task.priority)}`}
            >
              {task.priority}
            </span>
          </div>
          {showAssignee && task.assignee && (
            <div className="flex items-center gap-1 mt-1">
              <img
                src={
                  task.assignee.avatar ||
                  `https://ui-avatars.com/api/?name=${task.assignee.name}&background=random`
                }
                alt={task.assignee.name}
                className="h-4 w-4 rounded-full"
              />
              <span className="text-xs text-gray-600">
                {task.assignee.name}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {task.commentsCount > 0 && (
            <span className="flex items-center text-xs text-gray-500">
              <MessageCircle className="h-3 w-3 mr-1" />
              {task.commentsCount}
            </span>
          )}
          <div
            className={`h-2 w-2 rounded-full ${getStatusColor(task.status)}`}
          />
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Good{" "}
                {new Date().getHours() < 12
                  ? "Morning"
                  : new Date().getHours() < 17
                    ? "Afternoon"
                    : "Evening"}
                , {currentUser?.name || "User"}!
              </h1>
              <p className="text-gray-600 mt-1">
                Here's what's happening with your tasks today
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="h-9 px-3 border border-gray-300 rounded-sm text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Tasks</option>
                <option value="high-priority">High Priority</option>
                <option value="assigned-to-me">Assigned to Me</option>
              </select>
              <Button
                variant="primary"
                className="h-9 inline-flex items-center"
                onClick={() => setShowSmartParser(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Smart Create
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-sm">
                <Target className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Tasks</p>
                <p className="text-2xl font-bold text-gray-900">
                  {dashboardData.stats.totalTasks}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-sm">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {dashboardData.stats.completedTasks}
                </p>
                <p className="text-xs text-green-600">
                  {Math.round(
                    (dashboardData.stats.completedTasks /
                      dashboardData.stats.totalTasks) *
                      100 || 0,
                  )}
                  % completion rate
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-sm">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Due Today</p>
                <p className="text-2xl font-bold text-gray-900">
                  {dashboardData.stats.todayCount}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-sm">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Overdue</p>
                <p className="text-2xl font-bold text-gray-900">
                  {dashboardData.stats.overdueCount}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Due Today */}
          <DashboardCard
            title="Due Today"
            count={dashboardData.dueToday.length}
            icon={Calendar}
            color="bg-blue-600"
            action={true}
          >
            {dashboardData.dueToday.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">All caught up for today!</p>
              </div>
            ) : (
              dashboardData.dueToday.map((task) => (
                <TaskItem key={task.id} task={task} showAssignee={true} />
              ))
            )}
          </DashboardCard>

          {/* Overdue Tasks */}
          <DashboardCard
            title="Overdue"
            count={dashboardData.overdue.length}
            icon={AlertTriangle}
            color="bg-red-600"
            action={true}
          >
            {dashboardData.overdue.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No overdue tasks!</p>
              </div>
            ) : (
              dashboardData.overdue.map((task) => (
                <TaskItem key={task.id} task={task} showAssignee={true} />
              ))
            )}
          </DashboardCard>

          {/* Upcoming Tasks */}
          <DashboardCard
            title="Upcoming"
            count={dashboardData.upcoming.length}
            icon={TrendingUp}
            color="bg-green-600"
            action={true}
          >
            {dashboardData.upcoming.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No upcoming tasks scheduled</p>
              </div>
            ) : (
              dashboardData.upcoming
                .slice(0, 5)
                .map((task) => (
                  <TaskItem key={task.id} task={task} compact={true} />
                ))
            )}
          </DashboardCard>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-8">
          {/* Created by Me */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Created by Me</h3>
                <span className="text-sm text-gray-500">
                  {dashboardData.createdByMe.length} tasks
                </span>
              </div>
            </div>
            <div className="p-4">
              {dashboardData.createdByMe.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Plus className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No tasks created yet</p>
                  <Button
                    variant="ghost"
                    className="text-blue-600 hover:text-blue-700 text-sm mt-1 h-auto p-0"
                    onClick={() => setShowSmartParser(true)}
                  >
                    Create your first task
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {dashboardData.createdByMe.slice(0, 5).map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      compact={true}
                      showAssignee={true}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity & Notifications */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Recent Activity</h3>
                <Bell className="h-5 w-5 text-gray-400" />
              </div>
            </div>
            <div className="p-4">
              {notifications.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No recent activity</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {notifications.map((notification, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-sm"
                    >
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-xs">
                          {notification.type === "task_created"
                            ? "📝"
                            : notification.type === "task_completed"
                              ? "✅"
                              : notification.type === "comment"
                                ? "💬"
                                : notification.type === "mention"
                                  ? "👤"
                                  : "📋"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatRelativeDate(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Daily Summary */}
        <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Daily Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {dashboardData.stats.todayCount}
              </p>
              <p className="text-sm text-gray-600">Tasks due today</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {dashboardData.stats.completedTasks}
              </p>
              <p className="text-sm text-gray-600">Completed this week</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">
                {Math.round(
                  ((dashboardData.stats.completedTasks || 0) /
                    (dashboardData.stats.totalTasks || 1)) *
                    100,
                )}
                %
              </p>
              <p className="text-sm text-gray-600">Productivity score</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showThreadModal && selectedTask && (
        <TaskThreadModal
          isOpen={showThreadModal}
          onClose={() => {
            setShowThreadModal(false);
            setSelectedTask(null);
          }}
          taskId={selectedTask.id}
          taskTitle={selectedTask.title}
          currentUser={currentUser}
          onTaskUpdate={fetchDashboardData}
        />
      )}

      {showSmartParser && (
        <SmartTaskParser
          isOpen={showSmartParser}
          onClose={() => setShowSmartParser(false)}
          currentUser={currentUser}
          onTaskCreated={handleTaskCreated}
        />
      )}
    </div>
  );
};

export default SmartDashboard;
