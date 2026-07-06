import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle,
  User,
  Filter,
  Star,
  RotateCcw,
  FileText,
} from "lucide-react";
import SafeHtml, { getTextPreview } from "../components/common/SafeHtml";

export default function Deadlines() {
  const [filter, setFilter] = useState("all"); // all, overdue, today, upcoming, completed

  // Mock data for deadlines - in real app this would come from API
  const { data: deadlines = [], isLoading } = useQuery({
    queryKey: ["/api/tasks/deadlines"],
    enabled: true,
  });

  const filteredDeadlines = (deadlines || []).filter((task) => {
    if (filter === "all") return true;
    return task.status === filter;
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case "overdue":
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case "today":
        return <Clock className="w-4 h-4 text-amber-500" />;
      case "upcoming":
        return <Calendar className="w-4 h-4 text-blue-500" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status) => {
    const baseClasses = "px-2 py-1 text-xs font-medium rounded-full";
    switch (status) {
      case "overdue":
        return `${baseClasses} bg-red-100 text-red-800`;
      case "today":
        return `${baseClasses} bg-amber-100 text-amber-800`;
      case "upcoming":
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case "completed":
        return `${baseClasses} bg-green-100 text-green-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const getPriorityBadge = (priority) => {
    const baseClasses = "px-2 py-1 text-xs font-medium rounded";
    switch (priority) {
      case "critical":
        return `${baseClasses} bg-red-500 text-white`;
      case "high":
        return `${baseClasses} bg-orange-500 text-white`;
      case "medium":
        return `${baseClasses} bg-yellow-500 text-white`;
      case "low":
        return `${baseClasses} bg-green-500 text-white`;
      default:
        return `${baseClasses} bg-gray-500 text-white`;
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "milestone":
        return <Star size={16} className="text-yellow-500" />;
      case "approval":
        return <CheckCircle size={16} className="text-green-500" />;
      case "recurring":
        return <RotateCcw size={16} className="text-purple-500" />;
      default:
        return <FileText size={16} className="text-gray-500" />;
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = date - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";
    if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
    if (diffDays > 0) return `In ${diffDays} days`;

    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white min-h-screen">
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Clock className="w-6 h-6 mr-2" />
              Deadlines
            </h1>
            <p className="text-gray-600 mt-1">
              Track and manage upcoming task deadlines
            </p>
          </div>

          {/* Filter Buttons */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <div className="flex space-x-1">
              {[
                { key: "all", label: "All", count: sampleDeadlines.length },
                {
                  key: "overdue",
                  label: "Overdue",
                  count: sampleDeadlines.filter((t) => t.status === "overdue")
                    .length,
                },
                {
                  key: "today",
                  label: "Today",
                  count: sampleDeadlines.filter((t) => t.status === "today")
                    .length,
                },
                {
                  key: "upcoming",
                  label: "Upcoming",
                  count: sampleDeadlines.filter((t) => t.status === "upcoming")
                    .length,
                },
                {
                  key: "completed",
                  label: "Completed",
                  count: sampleDeadlines.filter((t) => t.status === "completed")
                    .length,
                },
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-3 py-2 text-sm font-medium rounded-sm transition-colors ${
                    filter === key
                      ? "bg-blue-100 text-blue-700 border border-blue-200"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                  data-testid={`filter-${key}`}
                >
                  {label} ({count})
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Deadlines List */}
      <div className="space-y-3">
        {filteredDeadlines.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No deadlines found
            </h3>
            <p className="text-gray-600">
              {filter === "all"
                ? "No tasks with deadlines at the moment."
                : `No ${filter} deadlines found.`}
            </p>
          </div>
        ) : (
          filteredDeadlines.map((task) => (
            <div
              key={task.id}
              className={`bg-white border rounded-sm p-4 shadow-sm hover:shadow-md transition-shadow ${
                task.status === "overdue"
                  ? "border-l-4 border-l-red-500"
                  : task.status === "today"
                    ? "border-l-4 border-l-amber-500"
                    : task.status === "completed"
                      ? "border-l-4 border-l-green-500"
                      : "border-l-4 border-l-blue-500"
              }`}
              data-testid={`deadline-task-${task.id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-lg">{getTypeIcon(task.type)}</span>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {task.title}
                    </h3>
                    <span className={getPriorityBadge(task.priority)}>
                      {task.priority.charAt(0).toUpperCase() +
                        task.priority.slice(1)}
                    </span>
                  </div>

                  <p className="text-gray-600 mb-3">
                    <SafeHtml
                      html={task.description}
                      truncate={true}
                      maxLength={200}
                      as="span"
                    />
                  </p>

                  <div className="flex items-center space-x-3 text-sm text-gray-500">
                    <div className="flex items-center space-x-1">
                      <User className="w-4 h-4" />
                      <span>{task.assignee}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end space-y-2">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(task.status)}
                    <span className={getStatusBadge(task.status)}>
                      {task.status.charAt(0).toUpperCase() +
                        task.status.slice(1)}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-gray-700">
                    {formatDate(task.dueDate)}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
