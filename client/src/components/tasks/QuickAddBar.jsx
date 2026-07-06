import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Zap,
  Check,
  X,
  ArrowUpRight,
  Calendar,
  Clock,
  Archive,
  Trash2,
  CheckSquare,
  Filter,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { quickTasksAPI } from "../../services/quickTasksAPI";
import eventEmitter from "../../utils/eventEmitter";
import { useShowToast } from "@/utils/ToastMessage";
import SuccessToast from "../../pages/newComponents/SuccessToast";

// Quick Tasks Manager Component - Complete Quick Tasks functionality
export function QuickTasksManager() {
  const { showSuccessToast, showErrorToast } = useShowToast();
  const [quickTasks, setQuickTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [filter, setFilter] = useState("all"); // all, open, completed, archived
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [taskPriority, setTaskPriority] = useState("Low");

  // Fetch quick tasks from API
  useEffect(() => {
    const fetchQuickTasks = async () => {
      try {
        console.log("🔄 Fetching Quick Tasks from API...");
        const response = await quickTasksAPI.fetchQuickTasks();

        if (response && response.success) {
          const tasks = response.quickTasks || response.data || [];
          console.log("✅ Quick Tasks fetched:", tasks);

          // Transform API data to match component format
          const transformedTasks = tasks.map((task) => ({
            id: task.id,
            title: task.title,
            priority:
              task.priority?.charAt(0).toUpperCase() +
                task.priority?.slice(1) || "Low",
            dueDate: task.dueDate
              ? new Date(task.dueDate)
              : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            status:
              task.status === "done" ? "completed" : task.status || "open",
            createdAt: new Date(task.createdAt),
            createdBy: task.createdBy || "current-user",
            completedAt: task.completedAt ? new Date(task.completedAt) : null,
          }));

          setQuickTasks(transformedTasks);
        } else {
          console.error("❌ Failed to fetch quick tasks:", response);
        }
      } catch (error) {
        console.error("❌ Error fetching quick tasks:", error);
        // Fallback to demo data if API fails
        const demoTasks = [
          {
            id: 1,
            title: "Follow up with SAP for service requests",
            priority: "Medium",
            dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            status: "open",
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            createdBy: "current-user",
          },
          {
            id: 2,
            title: "Book invoices from Deloitte & KPMG",
            priority: "High",
            dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
            status: "open",
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            createdBy: "current-user",
          },
          {
            id: 3,
            title: "Update presentation deck for client meeting",
            priority: "Low",
            dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            status: "completed",
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            createdBy: "current-user",
          },
        ];
        setQuickTasks(demoTasks);
      }
    };

    fetchQuickTasks();
  }, []);

  // Create new quick task
  const handleCreateQuickTask = async () => {
    if (!newTaskTitle.trim()) return;

    try {
      // Create quick task data
      const taskData = {
        title: newTaskTitle.trim(),
        priority: taskPriority.toLowerCase(),
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // Default +3 days
      };

      console.log("🚀 Creating Quick Task via API:", taskData);

      // Call the API to create the quick task
      const response = await quickTasksAPI.createQuickTask(taskData);

      if (response && response.success) {
        console.log("✅ Quick task created successfully:", response);

        // Add the new task to the local state
        const newTask = {
          id:
            response.quickTask?.id ||
            response.data?.id ||
            Date.now().toString(),
          title: newTaskTitle.trim(),
          priority: taskPriority,
          dueDate: new Date(taskData.dueDate),
          status: "open",
          createdAt: new Date(),
          createdBy: "current-user",
        };

        setQuickTasks((prev) => [newTask, ...prev]);
        setNewTaskTitle("");
        setTaskPriority("Low");
        setShowCreateForm(false);

        // Emit event to notify other components
        eventEmitter.emit(
          "quickTaskCreated",
          response.quickTask || response.data,
        );

        console.log("Quick task created successfully!");
      } else {
        throw new Error(response.message || "Failed to create quick task");
      }
    } catch (error) {
      console.error("❌ Error creating quick task:", error);
      console.error("Failed to create quick task:", error.message);
    }
  };

  // Toggle task completion
  const toggleTaskCompletion = (id) => {
    setQuickTasks((prev) =>
      prev.map((task) => {
        if (task.id === id) {
          return {
            ...task,
            status: task.status === "completed" ? "open" : "completed",
            completedAt: task.status === "open" ? new Date() : null,
          };
        }
        return task;
      }),
    );
  };

  // Delete task
  const deleteTask = (id) => {
    setQuickTasks((prev) => prev.filter((task) => task.id !== id));
  };

  // Archive task
  const archiveTask = (id) => {
    setQuickTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, status: "archived" } : task,
      ),
    );
  };

  // Convert to full task
  const convertToFullTask = (id) => {
    const task = quickTasks.find((t) => t.id === id);
    if (task) {
      // Mark as moved to task
      setQuickTasks((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, status: "moved", movedToTask: `TASK-${Date.now()}` }
            : t,
        ),
      );

      // In real app, this would open the full task creation form with pre-filled data
      console.log("Converting to full task:", task);
      showSuccessToast(`Quick task "${task.title}" converted to full task`);
    }
  };

  // Get priority color
  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return "text-red-600 bg-red-50 border-red-200";
      case "medium":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "low":
        return "text-green-600 bg-green-50 border-green-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  // Get status badge
  const getStatusBadge = (task) => {
    switch (task.status) {
      case "completed":
        return (
          <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
            ✓ Done
          </span>
        );
      case "archived":
        return (
          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
            📁 Archived
          </span>
        );
      case "moved":
        return (
          <span className="px-2 py-1 text-nowrap whitespace-nowrap text-xs bg-blue-100 text-blue-800 rounded-full">
            → Moved to Task
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
            ● Open
          </span>
        );
    }
  };

  // Filter tasks
  const filteredTasks = quickTasks.filter((task) => {
    const matchesFilter =
      filter === "all"
        ? true
        : filter === "open"
          ? task.status === "open"
          : filter === "completed"
            ? task.status === "completed"
            : filter === "archived"
              ? task.status === "archived"
              : true;

    const matchesSearch = task.title
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  // Get relative time
  const getRelativeTime = (date) => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return `${Math.abs(days)} days ago`;
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    return `in ${days} days`;
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Zap className="h-6 w-6 text-blue-600" />
            Quick Tasks
          </h1>
          <p className="text-gray-600 mt-1">
            Personal to-do list for quick capture and tracking
          </p>
        </div>
        <Button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Quick Task
        </Button>
      </div>

      {/* Quick Create Form */}
      {showCreateForm && (
        <div className="bg-white border border-gray-200 rounded-sm p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-sm">Create Quick Task</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <Input
                placeholder="What needs to be done?"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleCreateQuickTask()}
                className="w-full h-9"
                autoFocus
              />
            </div>
            <div>
              <select
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value)}
                className="w-full px-3 h-9 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Low">Low Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="High">High Priority</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCreateQuickTask}
                disabled={!newTaskTitle.trim()}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                Add
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2">
          {["all", "open", "completed", "archived"].map((filterOption) => (
            <Button
              key={filterOption}
              variant={filter === filterOption ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(filterOption)}
              className={cn(
                "rounded-full h-9",
                filter === filterOption
                  ? "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200"
                  : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200",
              )}
            >
              {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
              <span className="ml-1 text-xs">
                (
                {
                  quickTasks.filter((t) =>
                    filterOption === "all" ? true : t.status === filterOption,
                  ).length
                }
                )
              </span>
            </Button>
          ))}
        </div>
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-64 h-9"
          />
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-sm border shadow-sm">
          <div className="text-2xl font-bold text-gray-900">
            {quickTasks.filter((t) => t.status === "open").length}
          </div>
          <div className="text-sm text-gray-600">Open Tasks</div>
        </div>
        <div className="bg-white p-4 rounded-sm border shadow-sm">
          <div className="text-2xl font-bold text-green-600">
            {quickTasks.filter((t) => t.status === "completed").length}
          </div>
          <div className="text-sm text-gray-600">Completed</div>
        </div>
        <div className="bg-white p-4 rounded-sm border shadow-sm">
          <div className="text-2xl font-bold text-blue-600">
            {quickTasks.filter((t) => t.status === "moved").length}
          </div>
          <div className="text-sm text-gray-600">Converted to Tasks</div>
        </div>
        <div className="bg-white p-4 rounded-sm border shadow-sm">
          <div className="text-2xl font-bold text-gray-600">
            {quickTasks.filter((t) => t.status === "archived").length}
          </div>
          <div className="text-sm text-gray-600">Archived</div>
        </div>
      </div>

      {/* Quick Tasks Table */}
      <div className="bg-white rounded-sm shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-900">
                  Task
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">
                  Priority
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">
                  Due Date
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">
                  Status
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">
                  Created
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTasks.map((task) => (
                <tr
                  key={task.id}
                  className={cn(
                    "hover:bg-gray-50 transition-colors",
                    task.status === "completed" && "opacity-75",
                  )}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleTaskCompletion(task.id)}
                        className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors p-0",
                          task.status === "completed"
                            ? "bg-green-100 border-green-500 text-green-700"
                            : "border-gray-300 hover:border-green-500",
                        )}
                        disabled={
                          task.status === "archived" || task.status === "moved"
                        }
                      >
                        {task.status === "completed" && (
                          <Check className="h-3 w-3" />
                        )}
                      </Button>
                      <div>
                        <div
                          className={cn(
                            "font-medium",
                            task.status === "completed" &&
                              "line-through text-gray-500",
                          )}
                        >
                          {task.title}
                        </div>
                        {task.status === "moved" && (
                          <div className="text-xs text-blue-600 mt-1">
                            → Moved to Task: {task.movedToTask}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={cn(
                        "px-2 py-1 text-xs rounded-full border",
                        getPriorityColor(task.priority),
                      )}
                    >
                      {task.priority}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Calendar className="h-3 w-3" />
                      <span>{task.dueDate.toLocaleDateString()}</span>
                      <span className="text-xs text-gray-500">
                        ({getRelativeTime(task.dueDate)})
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">{getStatusBadge(task)}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Clock className="h-3 w-3" />
                      <span>{task.createdAt.toLocaleDateString()}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1">
                      {task.status === "open" && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => convertToFullTask(task.id)}
                            className="p-1 text-blue-600 hover:bg-blue-50 h-8 w-8"
                            title="Convert to Full Task"
                          >
                            <ArrowUpRight className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => archiveTask(task.id)}
                            className="p-1 text-gray-600 hover:bg-gray-50 h-8 w-8"
                            title="Archive Task"
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {task.status !== "moved" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteTask(task.id)}
                          className="p-1 text-red-600 hover:bg-red-50 h-8 w-8"
                          title="Delete Task"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredTasks.length === 0 && (
            <div className="text-center py-12">
              <CheckSquare className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No quick tasks found
              </h3>
              <p className="text-gray-500 mb-3">
                {filter === "all"
                  ? "Create your first quick task to get started"
                  : `No ${filter} tasks found. Try adjusting your filters.`}
              </p>
              {filter === "all" && (
                <Button
                  onClick={() => setShowCreateForm(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Quick Task
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Quick Add Bar Component - for global access (floating button)
export default function QuickAddBar() {
  const { showSuccessToast, showErrorToast } = useShowToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [quickText, setQuickText] = useState("");

  const handleQuickAdd = async () => {
    if (!quickText.trim()) return;

    try {
      // Create quick task data
      const taskData = {
        title: quickText.trim(),
        priority: "low",
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // +3 days
      };

      console.log("🚀 Creating Quick Task via API:", taskData);

      // Call the API to create the quick task
      const response = await quickTasksAPI.createQuickTask(taskData);

      if (response && response.success) {
        console.log("✅ Quick task created successfully:", response);

        // Clear form and close
        setQuickText("");
        setIsExpanded(false);

        // Emit event to notify other components
        eventEmitter.emit(
          "quickTaskCreated",
          response.quickTask || response.data,
        );
        showSuccessToast("Quick task created");
        // Show success message (you can add a toast notification here)
        console.log("Quick task created successfully!");
      } else {
        throw new Error(response.message || "Failed to create quick task");
      }
    } catch (error) {
      console.error("❌ Error creating quick task:", error);
      showErrorToast(error.message || "Failed to create quick task");
      console.error("Failed to create quick task:", error.message);
    }
  };

  return (
    <div className="fixed bottom-20 right-0 z-50">
      {isExpanded ? (
        <div className="mr-4 sm:mr-6 bg-white border border-gray-200 rounded-none shadow-lg p-4 w-80">
          <div className="flex items-center space-x-2 mb-3">
            <Zap className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-sm">Quick Task</span>
          </div>
          <div className="flex space-x-3 mb-3">
            <Textarea
              placeholder="What needs to be done?"
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-none"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              className="h-8 rounded-none"
              onClick={() => setIsExpanded(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="h-8 rounded-none bg-blue-600 hover:bg-blue-700"
              onClick={handleQuickAdd}
            >
              Add
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="flex h-10 max-h-16 w-0 items-center justify-end overflow-visible"
          title="Quick task"
        >
          <Button
            type="button"
            onClick={() => setIsExpanded(true)}
            className={cn(
              "shrink-0 bg-blue-600 hover:bg-blue-700 text-white shadow-lg rounded-full",
              "h-14 w-14 sm:h-12 sm:w-12",
              /* Keep half hidden on md+ and reveal only when hovering the visible button. */
              "translate-x-0 md:translate-x-1/2 md:hover:translate-x-0 md:focus-visible:translate-x-0",
              "transition-transform duration-200 ease-out motion-reduce:transition-none motion-reduce:md:translate-x-0",
            )}
            size="icon"
          >
            <Plus className="h-7 w-7 sm:h-6 sm:w-6" />
          </Button>
        </div>
      )}
    </div>
  );
}
