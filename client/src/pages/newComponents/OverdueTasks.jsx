import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SafeHtml, { getTextPreview } from "../../components/common/SafeHtml";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Clock,
  AlertTriangle,
  Filter,
  Search,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { getOverdueTasks } from "@/services/overdueTasksService";
import { useLocation } from "wouter";

/**
 * Overdue Tasks Page - Shows tasks that have passed their due dates
 */
export default function OverdueTasks() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Fetch overdue tasks from API
  const {
    data: apiResponse,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      "overdue-tasks",
      {
        search: searchTerm,
        priority: priorityFilter,
        category: categoryFilter,
      },
    ],
    queryFn: () =>
      getOverdueTasks({
        search: searchTerm,
        priority: priorityFilter,
        category: categoryFilter,
      }),
    retry: 1,
    staleTime: 30000, // 30 seconds
  });

  // Extract tasks from API response
  const tasks = apiResponse?.data?.tasks || apiResponse?.tasks || [];

  // Client-side filtering as fallback (if server doesn't filter)
  const filteredTasks = tasks;

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getCategoryColor = (category) => {
    const colors = {
      "Website Development": "bg-blue-100 text-blue-800",
      "Security Review": "bg-purple-100 text-purple-800",
      "UX Research": "bg-pink-100 text-pink-800",
      "Backend Infrastructure": "bg-indigo-100 text-indigo-800",
      "Mobile Development": "bg-teal-100 text-teal-800",
      "Quality Assurance": "bg-orange-100 text-orange-800",
    };
    return colors[category] || "bg-gray-100 text-gray-800";
  };

  const getDaysOverdue = (dueDate) => {
    const now = new Date();
    const due = new Date(dueDate);
    return differenceInDays(now, due);
  };

  if (isLoading) {
    return (
      <div
        className="container mx-auto p-3 sm:p-4"
        data-testid="overdue-tasks-loading">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-red-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="container mx-auto p-3 sm:p-4"
        data-testid="overdue-tasks-error">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 sm:p-4">
            <div className="flex items-center space-x-2 text-red-600">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-xs sm:text-sm">
                Error loading overdue tasks
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="container mx-auto pb-6 sm:pb-8 space-y-3 p-3 sm:p-4 md:p-4"
      data-testid="overdue-tasks-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 sm:mb-3 space-y-3 sm:space-y-0">
        <div>
          <h1
            className="text-xl sm:text-2xl font-semibold text-gray-900 mb-1"
            data-testid="page-title">
            Overdue Tasks
          </h1>
          <p
            className="text-xs sm:text-sm text-gray-600"
            data-testid="page-description">
            Tasks that have passed their due dates
          </p>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-center sm:justify-end">
          <Badge
            variant="secondary"
            className="px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm bg-red-50 text-red-700 border-red-200"
            data-testid="overdue-count-badge">
            {filteredTasks.length} overdue{" "}
            {filteredTasks.length === 1 ? "task" : "tasks"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center space-x-1 text-xs sm:text-sm px-2 sm:px-3">
            <RefreshCw
              className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isLoading ? "animate-spin" : ""
                }`}
            />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 sm:pl-10 h-9 text-xs sm:text-sm"
              />
            </div>

            {/* Priority Filter */}
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-9 text-xs sm:text-sm">
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            {/* Category Filter */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 text-xs sm:text-sm">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Website Development">
                  Website Development
                </SelectItem>
                <SelectItem value="Security Review">Security Review</SelectItem>
                <SelectItem value="UX Research">UX Research</SelectItem>
                <SelectItem value="Backend Infrastructure">
                  Backend Infrastructure
                </SelectItem>
                <SelectItem value="Mobile Development">
                  Mobile Development
                </SelectItem>
                <SelectItem value="Quality Assurance">
                  Quality Assurance
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <Card data-testid="no-overdue-tasks">
          <CardContent className="p-4 sm:p-12 text-center">
            <div className="flex flex-col items-center space-y-2 sm:space-y-3">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center">
                <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {searchTerm ||
                    priorityFilter !== "all" ||
                    categoryFilter !== "all"
                    ? "No matching overdue tasks"
                    : "No overdue tasks"}
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  {searchTerm ||
                    priorityFilter !== "all" ||
                    categoryFilter !== "all"
                    ? "Try adjusting your filters to see more results."
                    : "Great work! All your tasks are on track."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div
          className="space-y-1.5 sm:space-y-2"
          data-testid="overdue-tasks-list">
          {filteredTasks.map((task) => {
            const daysOverdue = getDaysOverdue(task.dueDate);

            return (
              <Card
                key={task._id || task.id}
                className="border border-gray-200 bg-white hover:border-red-300 hover:shadow-sm transition-all duration-150 cursor-pointer"
                onClick={() => setLocation(`/tasks/${task._id || task.id}`)}>
                <CardContent className="p-2 sm:p-2.5">
                  {/* ✅ LINE 1 — Title, Priority, Description, Due Date */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                      <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-500 flex-shrink-0" />
                      <h3
                        className="text-xs sm:text-sm font-semibold text-gray-900 truncate max-w-[120px] sm:max-w-[160px]"
                        data-testid="task-title"
                        title={task.title}>
                        {task.title}
                      </h3>

                      {task.priority && (
                        <Badge
                          className={`${getPriorityColor(
                            task.priority
                          )} text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5`}
                          data-testid="task-priority">
                          {task.priority}
                        </Badge>
                      )}
                    </div>

                    {/* Due Date */}
                    {task.dueDate && (
                      <div className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs text-red-600 font-medium">
                        <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        <span>
                          {format(parseISO(task.dueDate), "dd MMM yyyy")}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* ✅ LINE 2 — Description & Metadata */}
                  <div className="flex items-center justify-between gap-2 text-[10px] sm:text-[11px] text-gray-600 mt-1">
                    {/* Left: Description */}
                    <div className="flex-1 min-w-0 max-w-[50%]">
                      {task.description && (
                        <p className="text-[10px] sm:text-[11px] text-gray-600 truncate ml-4 sm:ml-6" title={getTextPreview(task.description, 200)}>
                          <SafeHtml html={task.description} truncate={true} maxLength={80} as="span" />
                        </p>
                      )}
                    </div>

                    {/* Right: Category, Overdue, Status, Tags, Assignee */}
                    <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-2 flex-1">
                      {/* Category */}
                      {task.category && (
                        <div className="flex items-center gap-0.5 sm:gap-1">
                          <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-blue-500"></div>
                          <span
                            className="text-[9px] sm:text-[10px]"
                            data-testid="task-category">
                            {task.category}
                          </span>
                        </div>
                      )}

                      {/* Overdue */}
                      {task.dueDate && (
                        <Badge
                          variant="destructive"
                          className="text-[9px] sm:text-[10px] px-0.5 sm:px-1 py-0">
                          {daysOverdue}d overdue
                        </Badge>
                      )}

                      {/* Status */}
                      {task.status && (
                        <Badge
                          variant="outline"
                          className="text-[9px] sm:text-[10px] px-0.5 sm:px-1 py-0 capitalize">
                          {task.status}
                        </Badge>
                      )}

                      {/* Tags */}
                      {task.tags && task.tags.length > 0 && (
                        <div className="flex flex-wrap gap-0.5">
                          {task.tags.slice(0, 2).map((tag, i) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className="text-[9px] sm:text-[10px] bg-blue-50 text-blue-700 border-blue-200 px-0.5 sm:px-1 py-0">
                              {tag}
                            </Badge>
                          ))}
                          {task.tags.length > 2 && (
                            <span className="text-[9px] sm:text-[10px]">
                              +{task.tags.length - 2}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Assignee */}
                      {(task.assignee || task.assignedTo) && (
                        <span
                          className="truncate max-w-[80px] sm:max-w-[120px] text-[9px] sm:text-[10px] text-gray-500"
                          data-testid="task-assignee"
                          title={typeof (task.assignee || task.assignedTo) === "object"
                            ? `${task.assignee?.firstName || task.assignedTo?.firstName} ${task.assignee?.lastName || task.assignedTo?.lastName}`
                            : task.assignee || task.assignedTo}>
                          {typeof (task.assignee || task.assignedTo) ===
                            "object"
                            ? `${task.assignee?.firstName ||
                            task.assignedTo?.firstName
                            } ${task.assignee?.lastName ||
                            task.assignedTo?.lastName
                            }`
                            : task.assignee || task.assignedTo}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
