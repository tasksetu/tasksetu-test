import React, { useState, useEffect } from "react";
import CreateTask from "../../pages/newComponents/CreateTask";
import ApprovalTaskCreator from "../../pages/newComponents/ApprovalTaskCreator";
import { useShowToast } from "@/utils/ToastMessage";
import ConfirmDialog from "../common/ConfirmDialog";
import CustomEditor from "../common/CustomEditor";
import SafeHtml from "../common/SafeHtml";
import { useTaskPriorities } from "../../hooks/useTaskPriorities";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Redirect, useLocation } from "wouter";
import axios from "axios";
import { useTaskStatuses } from "../../hooks/useTaskStatuses";

export default function AllTasks({
  onCreateTask,
  onNavigateToTask,
  isTeamView = false,
}) {
  const { showSuccessToast, showErrorToast } = useShowToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [taskTypeFilter, setTaskTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("dueDate");
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [showSnooze, setShowSnooze] = useState(false);
  const [showCreateTaskDrawer, setShowCreateTaskDrawer] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [currentUser] = useState({
    id: 1,
    name: "Current User",
    role: "admin",
  });
  const [showStatusConfirmation, setShowStatusConfirmation] = useState(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(null);
  const [showDeleteSubtaskConfirmation, setShowDeleteSubtaskConfirmation] =
    useState(null);
  const [showTaskTypeDropdown, setShowTaskTypeDropdown] = useState(false);
  const [selectedTaskType, setSelectedTaskType] = useState("regular");
  const [showApprovalTaskModal, setShowApprovalTaskModal] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState(new Set());
  const [showSubtaskCreator, setShowSubtaskCreator] = useState(null);
  const [selectedSubtask, setSelectedSubtask] = useState(null);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [selectedDateForTask, setSelectedDateForTask] = useState(null);
  // const [showApprovalTaskModal, setShowApprovalTaskModal] = useState(false);
  const [selectedApprovalTask, setSelectedApprovalTask] = useState(null);

  // TODO: Replace mock data with API integration
  // When isTeamView=true, fetch from '/api/team-tasks' endpoint
  // When isTeamView=false, fetch from '/api/mytasks' endpoint
  // Example implementation:
  /*
  useEffect(() => {
    const endpoint = isTeamView ? '/api/team-tasks' : '/api/mytasks';
    axios.get(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
      params: { page, limit, status, priority }
    })
    .then(response => {
      setTasks(response.data.tasks);
      setTotalPages(response.data.totalPages);
    })
    .catch(error => {
      console.error('Failed to fetch tasks:', error);
    });
  }, [isTeamView, page, limit, status, priority]);
  */

  const [tasks, setTasks] = useState([]); // Empty for production

  const { data: companyStatuses = [] } = useTaskStatuses();
  const { data: taskPriorities = [] } = useTaskPriorities();

  // Status change history for activity tracking
  const [statusHistory, setStatusHistory] = useState([]);

  // Legacy status mapping for retroactive handling
  const [statusMappings] = useState([
    // Example: { oldStatusCode: 'OLD_STATUS', newStatusCode: 'OPEN', mappedAt: '2024-01-15T00:00:00Z' }
  ]);

  // Task type detection function
  const getTaskType = (task) => {
    if (task.isApprovalTask) return "Approval Task";
    if (task.isRecurring || task.recurringFromTaskId) return "Recurring Task";
    if (task.category === "Milestone" || task.type === "milestone")
      return "Milestone";
    return "Simple Task";
  };

  const getStatusLabel = (statusCode) => {
    const status = companyStatuses.find((s) => s.code === statusCode);
    return status ? status.label : statusCode;
  };

  const getStatusColor = (statusCode) => {
    const status = companyStatuses.find((s) => s.code === statusCode);
    return status ? status.color : "#6c757d";
  };

  const getStatusBadge = (statusCode) => {
    const status = companyStatuses.find((s) => s.code === statusCode);
    const baseClass =
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";

    if (!status) return `${baseClass} bg-gray-100 text-gray-800`;

    // Convert hex to RGB for background opacity
    const hex = status.color.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    return {
      className: `${baseClass} text-white`,
      style: { backgroundColor: status.color },
    };
  };
  const [, navigate] = useLocation();
  // Permission check function
  const canEditTaskStatus = (task) => {
    return (
      task.assigneeId === currentUser.id ||
      task.collaborators?.includes(currentUser.id) ||
      currentUser.role === "admin" ||
      task.creatorId === currentUser.id
    );
  };

  // Check if task can be marked as completed
  const canMarkAsCompleted = (task) => {
    if (!task.subtasks || task.subtasks.length === 0) return true;

    const incompleteSubtasks = task.subtasks.filter(
      (subtask) =>
        subtask.status !== "completed" && subtask.status !== "cancelled",
    );

    return incompleteSubtasks.length === 0;
  };

  // Get valid status transitions based on business rules
  const getValidStatusTransitions = (currentStatusCode, task = null) => {
    const currentStatus = companyStatuses.find(
      (s) => s.code === currentStatusCode && s.active,
    );
    if (!currentStatus) return [];

    let validTransitions = currentStatus.allowedTransitions.filter(
      (transitionCode) => {
        const targetStatus = companyStatuses.find(
          (s) => s.code === transitionCode && s.active,
        );
        return targetStatus !== null;
      },
    );

    // Apply sub-task completion logic for parent tasks
    if (task && task.subtasks && task.subtasks.length > 0) {
      const hasIncompleteSubtasks = task.subtasks.some(
        (subtask) =>
          subtask.status !== "DONE" && subtask.status !== "CANCELLED",
      );

      // Block completion if sub-tasks are incomplete
      if (hasIncompleteSubtasks) {
        validTransitions = validTransitions.filter(
          (transition) => transition !== "DONE",
        );
      }
    }

    return validTransitions;
  };

  // Log status change for activity tracking and audit trail
  const logStatusChange = (
    taskId,
    oldStatusCode,
    newStatusCode,
    userId,
    reason = null,
  ) => {
    const historyEntry = {
      id: Date.now(),
      taskId,
      oldStatusCode,
      newStatusCode,
      changedBy: userId,
      changedAt: new Date().toISOString(),
      reason,
      oldStatusLabel: getStatusLabel(oldStatusCode),
      newStatusLabel: getStatusLabel(newStatusCode),
    };

    setStatusHistory((prev) => [...prev, historyEntry]);

    // In real app, this would be sent to backend for permanent storage
    console.log("Status Change Logged:", historyEntry);
  };

  // Apply legacy status mapping for retroactive compatibility
  const applyStatusMapping = (statusCode) => {
    const mapping = statusMappings.find((m) => m.oldStatusCode === statusCode);
    return mapping ? mapping.newStatusCode : statusCode;
  };

  // Handle status change with comprehensive validation
  const handleStatusChange = (
    taskId,
    newStatusCode,
    requiresConfirmation = false,
    reason = null,
  ) => {
    const task = tasks.find((t) => t.id === taskId);
    const newStatus = companyStatuses.find(
      (s) => s.code === newStatusCode && s.active,
    );

    if (!task || !newStatus) {
      console.error("Invalid task or status code provided");
      return;
    }

    // Check edit permissions
    if (!canEditTaskStatus(task)) {
      showErrorToast("You do not have permission to edit this task status.");
      return;
    }

    // Validate status transition
    const validTransitions = getValidStatusTransitions(task.status, task);
    if (!validTransitions.includes(newStatusCode)) {
      const currentStatusObj = companyStatuses.find(
        (s) => s.code === task.status,
      );
      showErrorToast(
        `Invalid status transition from "${
          currentStatusObj?.label || task.status
        }" to "${newStatus.label}". Please follow the allowed workflow.`,
      );
      return;
    }

    // Check sub-task completion logic
    if (newStatusCode === "DONE" && !canMarkAsCompleted(task)) {
      const incompleteCount = task.subtasks.filter(
        (s) => s.status !== "completed" && s.status !== "cancelled",
      ).length;
      showErrorToast(
        `Cannot mark task as completed. There are ${incompleteCount} incomplete sub-tasks that must be completed or cancelled first.`,
      );
      return;
    }

    // Show confirmation for final statuses
    if (newStatus.isFinal && requiresConfirmation) {
      setShowStatusConfirmation({
        taskId,
        newStatusCode,
        taskTitle: task.title,
        statusLabel: newStatus.label,
        reason,
      });
      return;
    }

    // Execute status change
    executeStatusChange(taskId, newStatusCode, reason);
  };

  // Execute the actual status change with API integration
  const executeStatusChange = async (taskId, newStatusCode, reason = null) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) {
      console.error("TaskTableView: Task not found for status update");
      return;
    }

    const oldStatusCode = task.status;

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      console.log(
        `TaskTableView: Updating task ${taskId} status to ${newStatusCode}`,
        {
          taskTitle: task?.title || "Unknown",
          fromStatus: oldStatusCode,
          toStatus: newStatusCode,
          reason,
        },
      );

      const response = await axios.patch(
        `${baseUrl}/api/tasks/${taskId}/status`,
        { status: newStatusCode },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      console.log("TaskTableView: Status update successful:", response.data);

      // Update task status with autosave after successful API call
      setTasks((prevTasks) =>
        prevTasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: newStatusCode,
                progress: newStatusCode === "DONE" ? 100 : t.progress,
                lastModified: new Date().toISOString(),
                lastModifiedBy: currentUser.name,
              }
            : t,
        ),
      );

      // Emit event for real-time UI updates
      const statusEvent = new CustomEvent("taskStatusUpdated", {
        detail: {
          taskId,
          newStatus: newStatusCode,
          immediate: true,
        },
      });
      window.dispatchEvent(statusEvent);

      // Also emit color update event
      const colorEvent = new CustomEvent("taskColorUpdated", {
        detail: {
          taskId,
          newStatus: newStatusCode,
        },
      });
      window.dispatchEvent(colorEvent);

      // Log the status change for audit trail
      logStatusChange(
        taskId,
        oldStatusCode,
        newStatusCode,
        currentUser.id,
        reason,
      );

      // Show success notification
      const oldStatus = companyStatuses.find((s) => s.code === oldStatusCode);
      const newStatus = companyStatuses.find((s) => s.code === newStatusCode);
      console.log(
        `✅ Status updated: "${task.title}" changed from "${
          oldStatus?.label || oldStatusCode
        }" to "${newStatus.label}"`,
      );
    } catch (error) {
      console.error("TaskTableView: Error updating status:", error);

      let errorMessage = "Failed to update task status";
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 401) {
        errorMessage = "Authentication failed. Please login again.";
      } else if (error.response?.status === 403) {
        errorMessage = "You do not have permission to update this task.";
      } else if (error.response?.status === 404) {
        errorMessage = "Task not found.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      showErrorToast(errorMessage);
    }
  };

  // Permission check for task deletion
  const canDeleteTask = (task) => {
    return (
      task.creatorId === currentUser.id ||
      task.assigneeId === currentUser.id ||
      currentUser.role === "admin"
    );
  };

  // Handle task deletion with integrity checks
  const handleDeleteTask = (taskId, options = {}) => {
    const task = tasks.find((t) => t.id === taskId);

    if (!task) {
      console.error("Task not found");
      return;
    }

    // Check permissions
    if (!canDeleteTask(task)) {
      showErrorToast("You do not have permission to delete this task.");
      return;
    }

    // Show confirmation modal with task details
    setShowDeleteConfirmation({
      task,
      options: {
        deleteSubtasks: false,
        deleteAttachments: false,
        deleteLinkedItems: false,
        ...options,
      },
    });
  };

  // Execute task deletion
  const executeTaskDeletion = (taskId, options) => {
    const task = tasks.find((t) => t.id === taskId);

    // Remove task from list
    setTasks((prevTasks) => prevTasks.filter((t) => t.id !== taskId));

    // Handle subtasks deletion
    if (options.deleteSubtasks && task.subtasks && task.subtasks.length > 0) {
      console.log(
        `Deleted ${task.subtasks.length} subtasks for task: ${task.title}`,
      );
    }

    // Handle attachments/linked items
    if (
      options.deleteAttachments &&
      task.linkedItems &&
      task.linkedItems.length > 0
    ) {
      console.log(
        `Deleted ${task.linkedItems.length} linked items for task: ${task.title}`,
      );
    }

    // Log activity for audit trail
    logActivity("task_deleted", {
      taskId: task.id,
      taskTitle: task.title,
      deletedBy: currentUser.name,
      timestamp: new Date().toISOString(),
      options: options,
    });

    // Show success toast notification
    showSuccessToast(`Task "${task.title}" deleted`);

    // Close confirmation modal
    setShowDeleteConfirmation(null);
  };

  // Handle bulk task deletion
  const handleBulkDeleteTasks = () => {
    const selectedTaskObjects = tasks.filter((t) =>
      selectedTasks.includes(t.id),
    );
    const errors = [];

    selectedTaskObjects.forEach((task) => {
      if (!canDeleteTask(task)) {
        errors.push(`No permission to delete: ${task.title}`);
      }
    });

    if (errors.length > 0) {
      showErrorToast(`Cannot delete some tasks:\n${errors.join("\n")}`);
      return;
    }

    setShowBulkDeleteConfirm(true);
  };

  const logActivity = (type, details) => {
    console.log(`🔄 Activity Log:`, details);
    // In real app, this would be sent to backend for permanent audit trail
  };

  // Handle bulk status update
  const handleBulkStatusUpdate = (newStatusCode) => {
    const selectedTaskObjects = tasks.filter((t) =>
      selectedTasks.includes(t.id),
    );
    const errors = [];

    selectedTaskObjects.forEach((task) => {
      if (!canEditTaskStatus(task)) {
        errors.push(`No permission to edit: ${task.title}`);
        return;
      }

      if (newStatusCode === "DONE" && !canMarkAsCompleted(task)) {
        const incompleteCount = task.subtasks.filter(
          (s) => s.status !== "completed" && s.status !== "cancelled",
        ).length;
        errors.push(
          `"${task.title}" has ${incompleteCount} incomplete sub-tasks`,
        );
        return;
      }
    });

    if (errors.length > 0) {
      showErrorToast(`Cannot update some tasks:\n${errors.join("\n")}`);
      return;
    }

    // Update all selected tasks
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        selectedTasks.includes(task.id)
          ? {
              ...task,
              status: newStatusCode,
              progress: newStatusCode === "DONE" ? 100 : task.progress,
            }
          : task,
      ),
    );

    // Clear selection
    setSelectedTasks([]);
    setShowBulkActions(false);

    const newStatus = companyStatuses.find((s) => s.code === newStatusCode);
    console.log(
      `Bulk updated ${selectedTasks.length} tasks to ${newStatus.label} by ${currentUser.name}`,
    );
  };

  // Handle task selection
  const handleTaskSelection = (taskId, isSelected) => {
    if (isSelected) {
      setSelectedTasks((prev) => [...prev, taskId]);
    } else {
      setSelectedTasks((prev) => prev.filter((id) => id !== taskId));
    }
  };

  // Handle select all
  const handleSelectAll = (isSelected) => {
    if (isSelected) {
      setSelectedTasks(tasks.map((t) => t.id));
    } else {
      setSelectedTasks([]);
    }
  };

  const getPriorityBadge = (priority) => {
    const priorityClasses = {
      Low: "status-badge priority-low",
      Medium: "status-badge priority-medium",
      High: "status-badge priority-high",
      Urgent: "status-badge priority-urgent",
    };
    return priorityClasses[priority] || "status-badge priority-low";
  };

  const handleTaskTitleClick = (task) => {
    setEditingTaskId(task.id);
    setEditingTitle(task.title);
  };

  const handleTitleSave = (taskId) => {
    if (
      editingTitle.trim() &&
      editingTitle !== tasks.find((t) => t.id === taskId)?.title
    ) {
      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === taskId ? { ...task, title: editingTitle.trim() } : task,
        ),
      );
    }
    setEditingTaskId(null);
    setEditingTitle("");
  };

  const handleTitleCancel = () => {
    setEditingTaskId(null);
    setEditingTitle("");
  };

  const handleTitleKeyDown = (e, taskId) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleTitleSave(taskId);
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleTitleCancel();
    }
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setShowEditModal(true);
  };

  const handleSaveEditedTask = (updatedTask) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === updatedTask.id ? updatedTask : task,
      ),
    );
    setShowEditModal(false);
    setEditingTask(null);
  };

  const handleViewTask = (taskId) => {
    const task = tasks.find((t) => t.id === taskId);

    // If it's an approval task, show the approval modal
    if (task && task.isApprovalTask) {
      setSelectedApprovalTask(task);
      setShowApprovalTaskModal(true);
      return;
    }

    // Navigate to task detail page for regular tasks

    navigate("/task/view");
  };

  // Toggle task expansion
  const handleToggleTaskExpansion = (taskId) => {
    setExpandedTasks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  // Create new subtask
  const handleCreateSubtask = (parentTaskId, subtaskData) => {
    const newSubtask = {
      id: Date.now(),
      title: subtaskData.title,
      assignee: subtaskData.assignee || currentUser.name,
      assigneeId: subtaskData.assigneeId || currentUser.id,
      status: subtaskData.status || "OPEN",
      priority: subtaskData.priority || "Medium",
      dueDate: subtaskData.dueDate,
      progress: 0,
      parentTaskId: parentTaskId,
      createdBy: currentUser.name,
      createdAt: new Date().toISOString(),
      description: subtaskData.description || "",
    };

    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === parentTaskId
          ? {
              ...task,
              subtasks: [...(task.subtasks || []), newSubtask],
              subtaskCount: (task.subtaskCount || 0) + 1,
            }
          : task,
      ),
    );

    setShowSubtaskCreator(null);

    // Auto-expand parent task to show new subtask
    setExpandedTasks((prev) => new Set([...prev, parentTaskId]));
  };

  // Update subtask
  const handleUpdateSubtask = (parentTaskId, updatedSubtask) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === parentTaskId
          ? {
              ...task,
              subtasks: task.subtasks.map((subtask) =>
                subtask.id === updatedSubtask.id ? updatedSubtask : subtask,
              ),
            }
          : task,
      ),
    );
    setSelectedSubtask(null);
  };

  // Delete subtask
  const handleDeleteSubtask = (parentTaskId, subtaskId) => {
    const parentTask = tasks.find((t) => t.id === parentTaskId);
    const subtask = parentTask?.subtasks.find((s) => s.id === subtaskId);

    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === parentTaskId
          ? {
              ...task,
              subtasks: task.subtasks.filter(
                (subtask) => subtask.id !== subtaskId,
              ),
              subtaskCount: Math.max(0, (task.subtaskCount || 0) - 1),
            }
          : task,
      ),
    );

    // Show success toast notification
    if (subtask) {
      showSuccessToast(`Sub-task "${subtask.title}" deleted`);
    }

    setSelectedSubtask(null);
    setShowDeleteSubtaskConfirmation(null);
  };

  // Handle subtask status change
  const handleSubtaskStatusChange = (parentTaskId, subtaskId, newStatus) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === parentTaskId
          ? {
              ...task,
              subtasks: task.subtasks.map((subtask) =>
                subtask.id === subtaskId
                  ? {
                      ...subtask,
                      status: newStatus,
                      progress: newStatus === "DONE" ? 100 : subtask.progress,
                    }
                  : subtask,
              ),
            }
          : task,
      ),
    );
  };

  const handleAddSubtask = (taskId) => {
    setShowSubtaskCreator(taskId);
  };

  const handleToggleSubtasks = (taskId) => {
    handleToggleTaskExpansion(taskId);
  };

  // Handle calendar date selection
  const handleCalendarDateSelect = (selectedDate) => {
    setSelectedDateForTask(selectedDate);
    setShowCalendarModal(false);

    // Open appropriate task creation modal based on selected type
    if (selectedTaskType === "approval") {
      setShowApprovalTaskModal(true);
    } else {
      setShowCreateTaskDrawer(true);
    }
  };

  // Handle task type selection from dropdown
  const handleTaskTypeSelect = (taskType) => {
    setSelectedTaskType(taskType);
    setShowTaskTypeDropdown(false);

    // Always show calendar first for all task types
    setShowCalendarModal(true);
  };

  const handleCreateApprovalTask = (approvalTaskData) => {
    // Add the approval task to the tasks list
    const newTask = {
      id: Date.now(),
      title: approvalTaskData.title,
      assignee: "Current User",
      assigneeId: 1,
      status: "OPEN",
      priority: approvalTaskData.priority || "Medium",
      dueDate: approvalTaskData.dueDate,
      category: "Approval",
      progress: 0,
      subtaskCount: 0,
      collaborators: [],
      createdBy: "Current User",
      creatorId: 1,
      isApprovalTask: true,
      approvers: approvalTaskData.approvers || [],
      approvalMode: approvalTaskData.approvalMode || "any",
      description: approvalTaskData.description || "",
      subtasks: [],
    };

    setTasks((prevTasks) => [...prevTasks, newTask]);
    setShowApprovalTaskModal(false);
    setSelectedDateForTask(null);
    console.log("Approval task created:", newTask);
  };

  return (
    <div className="space-y-3">
      {/* Modern Filters Section */}
      <div className="bg-gray-200 rounded-2xl shadow-sm border border-white/20 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex-1">
            <div className="relative">
              <svg
                className="absolute  left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all duration-200"
              />
            </div>
          </div>

          {selectedTasks.length > 0 && (
            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
              <span className="text-sm font-semibold text-blue-800">
                {selectedTasks.length} selected
              </span>
              <select
                className="h-9 px-3 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all duration-200 text-sm"
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkStatusUpdate(e.target.value);
                    e.target.value = "";
                  }
                }}
                defaultValue=""
              >
                <option value="">Bulk Update Status</option>
                {companyStatuses.map((status) => (
                  <option key={status.code} value={status.code}>
                    {status.label}
                  </option>
                ))}
              </select>
              <Button
                variant="destructive"
                className="h-9"
                onClick={handleBulkDeleteTasks}
                title="Delete selected tasks"
              >
                🗑️ Delete
              </Button>
              <Button
                variant="outline"
                className="h-9"
                onClick={() => setSelectedTasks([])}
              >
                Clear Selection
              </Button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 bg-white/80 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent  transition-all duration-200"
            >
              <option value="all">All Status</option>
              {(Array.isArray(companyStatuses) ? companyStatuses : [])
                .filter((s) => s && s.active)
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((s) => (
                  <option key={s._id || s.code} value={s.code}>
                    {s.label}
                  </option>
                ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-9 px-3 bg-white/80  border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            >
              <option value="all">All Priority</option>
              {(Array.isArray(taskPriorities) ? taskPriorities : [])
                .filter((p) => p && p.active)
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((p) => (
                  <option key={p._id || p.code} value={p.code}>
                    {p.label}
                  </option>
                ))}
            </select>

            <select
              value={taskTypeFilter}
              onChange={(e) => setTaskTypeFilter(e.target.value)}
              className="h-9 px-3 bg-white/80  border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            >
              <option value="all">All Task Types</option>
              <option value="Simple Task">Simple Task</option>
              <option value="Recurring Task">Recurring Task</option>
              <option value="Milestone">Milestone</option>
              <option value="Approval Task">Approval Task</option>
            </select>

            <select className="h-9 px-3 bg-white/80  border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200">
              <option>All Categories</option>
              <option>Development</option>
              <option>Design</option>
              <option>Research</option>
              <option>Marketing</option>
            </select>
          </div>
        </div>
      </div>

      {/* Export Options */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" className="h-9">
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Export as CSV
        </Button>
        <Button variant="outline" className="h-9">
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Export as Excel
        </Button>
      </div>

      {/* Modern Tasks Table */}
      <div className="bg-white/80 rounded-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto ">
          <Table className="w-full">
            <TableHeader className="bg-gradient-to-r from-gray-100 to-gray-200 border-b border-gray-200 ">
              <TableRow className="hover:bg-gray-50/50 transition-colors">
                <TableHead className="px-6 bg-gray-200 py-4 text-left text-xs font-semibold text-gray-600 uppercase w-12 ">
                  <input
                    type="checkbox"
                    checked={
                      selectedTasks.length === tasks.length && tasks.length > 0
                    }
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-colors"
                  />
                </TableHead>
                <TableHead className="px-6 bg-gray-200 py-4 text-left text-xs font-semibold text-gray-600 uppercase ">
                  Task
                </TableHead>
                <TableHead className="px-6 bg-gray-200 py-4 text-left text-xs font-semibold text-gray-600 uppercase">
                  Assignee
                </TableHead>
                <TableHead className="px-6 bg-gray-200 py-4 text-left text-xs font-semibold text-gray-600 uppercase ">
                  Status
                </TableHead>
                <TableHead className="px-6 bg-gray-200 py-4 text-left text-xs font-semibold text-gray-600 uppercase ">
                  Priority
                </TableHead>
                <TableHead className="px-6 py-4 bg-gray-200 0 text-left text-xs font-semibold text-gray-600 uppercase ">
                  Due Date
                </TableHead>
                <TableHead className="px-6 py-4 bg-gray-200 text-left text-xs font-semibold text-gray-600 uppercase ">
                  Progress
                </TableHead>
                <TableHead className="px-6 py-4 bg-gray-200 text-left text-xs font-semibold text-gray-600 uppercase ">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white/50 divide-y divide-gray-100">
              {tasks
                .filter((task) => {
                  // Apply search filter
                  const matchesSearch =
                    task.title
                      .toLowerCase()
                      .includes(searchTerm.toLowerCase()) ||
                    task.assignee
                      .toLowerCase()
                      .includes(searchTerm.toLowerCase());

                  // Apply status filter
                  const matchesStatus =
                    statusFilter === "all" ||
                    (task.status && task.status === statusFilter);

                  // Apply priority filter
                  const matchesPriority =
                    priorityFilter === "all" ||
                    task.priority.toLowerCase() ===
                      priorityFilter.toLowerCase();

                  // Apply task type filter
                  const taskType = getTaskType(task);
                  const matchesTaskType =
                    taskTypeFilter === "all" || taskType === taskTypeFilter;

                  return (
                    matchesSearch &&
                    matchesStatus &&
                    matchesPriority &&
                    matchesTaskType
                  );
                })
                .map((task, index) => (
                  <React.Fragment key={task.id}>
                    <TableRow
                      className={`${
                        index % 2 === 0 ? "bg-white/80" : "bg-gray-50/50"
                      } hover:bg-blue-50/50 transition-all duration-200 border-b border-gray-100 ${
                        selectedTasks.includes(task.id) ? "bg-blue-100/70" : ""
                      }`}
                    >
                      <TableCell className="px-6 py-4 text-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedTasks.includes(task.id)}
                          onChange={(e) =>
                            handleTaskSelection(task.id, e.target.checked)
                          }
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </TableCell>
                      <TableCell className="px-6 py-4 text-nowrap">
                        <div>
                          <div className="font-medium text-gray-900">
                            <div className="flex items-center gap-2">
                              {/* Expansion control for tasks with subtasks */}
                              {task.subtasks && task.subtasks.length > 0 && (
                                <button
                                  onClick={() =>
                                    handleToggleTaskExpansion(task.id)
                                  }
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 cursor-pointer hover:bg-blue-200 transition-colors hover:text-gray-600 transition-colors"
                                  title={
                                    expandedTasks.has(task.id)
                                      ? "Collapse subtasks"
                                      : "Expand subtasks"
                                  }
                                >
                                  {/* {expandedTasks.has(task.id) ? "▼" : "▶"} */}
                                  <svg
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <circle
                                      cx="5"
                                      cy="5"
                                      r="2"
                                      fill="currentColor"
                                    />
                                    <circle
                                      cx="5"
                                      cy="12"
                                      r="2"
                                      fill="currentColor"
                                    />
                                    <circle
                                      cx="5"
                                      cy="19"
                                      r="2"
                                      fill="currentColor"
                                    />

                                    <path
                                      d="M5 7V10"
                                      stroke="currentColor"
                                      stroke-width="2"
                                    />
                                    <path
                                      d="M5 14V17"
                                      stroke="currentColor"
                                      stroke-width="2"
                                    />

                                    <path
                                      d="M7 12H14"
                                      stroke="currentColor"
                                      stroke-width="2"
                                    />
                                    <path
                                      d="M7 19H14"
                                      stroke="currentColor"
                                      stroke-width="2"
                                    />
                                  </svg>

                                  {task.subtasks.length}
                                </button>
                              )}

                              {editingTaskId === task.id ? (
                                <input
                                  type="text"
                                  value={editingTitle}
                                  onChange={(e) =>
                                    setEditingTitle(e.target.value)
                                  }
                                  onBlur={() => handleTitleSave(task.id)}
                                  onKeyDown={(e) =>
                                    handleTitleKeyDown(e, task.id)
                                  }
                                  className="w-full px-2 py-1 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-all duration-200"
                                  autoFocus
                                  maxLength={100}
                                />
                              ) : (
                                <>
                                  {task.isRecurring && (
                                    <span
                                      className="text-green-600 cursor-help"
                                      title="Recurring Task – generated from a pattern"
                                    >
                                      <RecurringTaskIcon
                                        size={size}
                                        className="flex-shrink-0"
                                      />
                                    </span>
                                  )}
                                  {task.isApprovalTask && (
                                    <span
                                      className="text-orange-600 cursor-help"
                                      title="Approval Task – requires approval workflow"
                                    >
                                      ✅
                                    </span>
                                  )}
                                  {(task.category === "Milestone" ||
                                    task.type === "milestone") && (
                                    <span
                                      className="text-purple-600 cursor-help"
                                      title="Milestone – project checkpoint"
                                    >
                                      🎯
                                    </span>
                                  )}
                                  <span
                                    className="cursor-pointer hover:bg-gray-50 px-2 py-1 rounded transition-all duration-200 inline-block flex-1 editable-task-title"
                                    onClick={() => handleTaskTitleClick(task)}
                                    title="Click to edit"
                                  >
                                    {task.title}
                                  </span>

                                  {task.recurringFromTaskId && (
                                    <span
                                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 cursor-pointer hover:bg-green-200 transition-colors"
                                      title={`Recurring from Task #${task.recurringFromTaskId}`}
                                      onClick={() =>
                                        console.log(
                                          `View master task ${task.recurringFromTaskId}`,
                                        )
                                      }
                                    >
                                      📋 #{task.recurringFromTaskId}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-sm text-gray-500">
                            {task.category}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                            <span className="text-xs font-medium text-gray-600">
                              {task.assignee
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </span>
                          </div>
                          <span className="text-sm text-gray-900">
                            {task.assignee}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-nowrap">
                        <TaskStatusDropdown
                          task={task}
                          currentStatus={task.status}
                          statuses={companyStatuses}
                          onStatusChange={(newStatus) =>
                            handleStatusChange(task.id, newStatus, true)
                          }
                          canEdit={canEditTaskStatus(task)}
                          canMarkCompleted={canMarkAsCompleted(task)}
                        />
                      </TableCell>
                      <TableCell className="px-6 py-4 text-nowrap">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium shadow-sm ${
                            task.priority === "High"
                              ? "bg-gradient-to-r from-red-100 to-red-200 text-red-800"
                              : task.priority === "Medium"
                                ? "bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800"
                                : task.priority === "Low"
                                  ? "bg-gradient-to-r from-green-100 to-green-200 text-green-800"
                                  : task.priority === "Urgent"
                                    ? "bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800"
                                    : "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800"
                          }`}
                        >
                          {task.priority}
                        </span>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-gray-900 text-nowrap font-medium">
                        {task.dueDate}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-nowrap">
                        <div className="flex items-center">
                          <div className="w-full bg-gray-200 rounded-full h-2.5 mr-3 shadow-inner">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-blue-600 h-2.5 rounded-full shadow-sm transition-all duration-300"
                              style={{ width: `${task.progress}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-600 min-w-[3rem] font-medium">
                            {task.progress}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-nowrap">
                        <div className="flex items-center space-x-2">
                          <button
                            className="text-gray-400 cursor-pointer hover:text-blue-600 transition-all duration-200 p-2 rounded-sm hover:bg-blue-50 shadow-sm"
                            onClick={() => handleViewTask(task.id)}
                            title="View task details"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          </button>

                          <button
                            className="text-gray-400 cursor-pointer hover:text-red-600 transition-all duration-200 p-2 rounded-sm hover:bg-red-50 shadow-sm"
                            onClick={() => handleDeleteTask(task.id)}
                            title="Delete Task"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Subtask Rows */}
                    {expandedTasks.has(task.id) &&
                      task.subtasks &&
                      task.subtasks.map((subtask, subtaskIndex) => (
                        <TableRow
                          key={`subtask-${subtask.id}`}
                          className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 hover:from-blue-100/50 hover:to-indigo-100/50 transition-all duration-200 border-l-4 border-l-blue-400 shadow-sm"
                        >
                          <TableCell className="px-6 py-3"></TableCell>
                          <TableCell className="px-6 py-3">
                            <div className="pl-8">
                              <div className="flex items-center gap-2">
                                {/* <span className="text-blue-500 text-lg">↳</span> */}

                                <svg
                                  width="24"
                                  height="24"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <circle
                                    cx="6"
                                    cy="4"
                                    r="2"
                                    fill="currentColor"
                                  />
                                  <path
                                    d="M6 6v2a2 2 0 002 2h4"
                                    stroke="currentColor"
                                    stroke-width="2"
                                  />
                                  <circle
                                    cx="16"
                                    cy="10"
                                    r="2"
                                    fill="currentColor"
                                  />
                                </svg>

                                <span
                                  className="font-semibold text-gray-800 cursor-pointer hover:text-blue-600 transition-colors"
                                  onClick={() =>
                                    setSelectedSubtask({
                                      ...subtask,
                                      parentTaskId: task.id,
                                    })
                                  }
                                  title="Click to view/edit subtask"
                                >
                                  {subtask.title}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 pl-7 font-medium">
                                Sub-task of "{task.title}"
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-6 py-3">
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mr-3 shadow-sm">
                                <span className="text-xs font-bold text-blue-700">
                                  {subtask.assignee
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")}
                                </span>
                              </div>
                              <span className="text-sm text-gray-700 font-medium">
                                {subtask.assignee}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="px-6 py-3">
                            <TaskStatusDropdown
                              task={subtask}
                              currentStatus={subtask.status}
                              statuses={companyStatuses}
                              onStatusChange={(newStatus) =>
                                handleSubtaskStatusChange(
                                  task.id,
                                  subtask.id,
                                  newStatus,
                                )
                              }
                              canEdit={canEditTaskStatus(subtask)}
                              canMarkCompleted={true}
                            />
                          </TableCell>
                          <TableCell className="px-6 py-3">
                            <span
                              className={getPriorityBadge(subtask.priority)}
                            >
                              {subtask.priority}
                            </span>
                          </TableCell>
                          <TableCell className="px-6 py-3 text-sm text-gray-700">
                            {subtask.dueDate}
                          </TableCell>
                          <TableCell className="px-6 py-3">
                            <div className="flex items-center">
                              <div className="w-full bg-gray-200 rounded-full h-1.5 mr-2">
                                <div
                                  className="bg-primary-600 h-1.5 rounded-full"
                                  style={{ width: `${subtask.progress}%` }}
                                ></div>
                              </div>
                              <span className="text-xs text-gray-600 min-w-[3rem]">
                                {subtask.progress}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="px-6 py-3">
                            <div className="flex items-center space-x-2">
                              <button
                                className="text-gray-400 cursor-pointer hover:text-blue-600 transition-colors p-1"
                                onClick={() =>
                                  setSelectedSubtask({
                                    ...subtask,
                                    parentTaskId: task.id,
                                  })
                                }
                                title="View/Edit subtask"
                              >
                                <svg
                                  className="w-3 h-3"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                              </button>
                              <button
                                disabled={
                                  task?.status === "DONE" ||
                                  subtask?.status !== "OPEN"
                                }
                                className={`cursor-pointer transition-colors p-1 ${
                                  task?.status === "DONE" ||
                                  subtask?.status !== "OPEN"
                                    ? "text-gray-300 opacity-50 cursor-not-allowed"
                                    : "text-gray-400 hover:text-red-600"
                                }`}
                                onClick={() => {
                                  if (
                                    task?.status !== "DONE" &&
                                    subtask?.status === "OPEN"
                                  ) {
                                    setShowDeleteSubtaskConfirmation({
                                      taskId: task.id,
                                      subtaskId: subtask.id,
                                      subtaskTitle: subtask.title,
                                    });
                                  }
                                }}
                                title={
                                  task?.status === "DONE"
                                    ? "Cannot delete: Parent task is completed"
                                    : subtask?.status !== "OPEN"
                                      ? "Can only delete subtasks with OPEN status"
                                      : "Delete Sub-task"
                                }
                              >
                                <svg
                                  className="w-3 h-3"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </React.Fragment>
                ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex bg-white rounded-md shadow-md p-3 items-center justify-between">
        <div className="text-sm  text-gray-700">
          Showing <span className="font-medium">1</span> to{" "}
          <span className="font-medium">4</span> of{" "}
          <span className="font-medium">97</span> results
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            Previous
          </Button>
          <Button variant="primary" size="sm">
            1
          </Button>
          <Button variant="outline" size="sm">
            2
          </Button>
          <Button variant="outline" size="sm">
            3
          </Button>
          <Button variant="outline" size="sm">
            Next
          </Button>
        </div>
      </div>

      {/* Slide-in Drawer */}
      {showCreateTaskDrawer && (
        <div className="fixed inset-0 z-50 overflow-hidden overlay-animate mt-0">
          <div
            className="drawer-overlay absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowCreateTaskDrawer(false)}
          ></div>
          <div
            className="absolute right-0 top-0 h-full bg-white/95 backdrop-blur-sm flex flex-col modal-animate-slide-right"
            style={{
              width: "min(90vw, 900px)",
              boxShadow: "-10px 0 50px rgba(0,0,0,0.2)",
              borderLeft: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            <div className="drawer-header">
              <h2 className="text-2xl font-bold text-white">
                Create New Task
                {selectedDateForTask &&
                  ` for ${new Date(selectedDateForTask).toLocaleDateString(
                    "en-US",
                    {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    },
                  )}`}
              </h2>
              <button
                onClick={() => setShowCreateTaskDrawer(false)}
                className="close-btn"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="drawer-body">
              <CreateTask
                onClose={() => {
                  setShowCreateTaskDrawer(false);
                  setSelectedDateForTask(null);
                }}
                initialTaskType={selectedTaskType}
                preFilledDate={selectedDateForTask}
                drawer={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* Task Edit Modal */}
      {showEditModal && editingTask && (
        <TaskEditModal
          task={editingTask}
          onSave={handleSaveEditedTask}
          onClose={() => {
            setShowEditModal(false);
            setEditingTask(null);
          }}
        />
      )}

      {/* Status Confirmation Modal */}
      {showStatusConfirmation && (
        <StatusConfirmationModal
          taskTitle={showStatusConfirmation.taskTitle}
          statusLabel={showStatusConfirmation.statusLabel}
          onConfirm={() => {
            handleStatusChange(
              showStatusConfirmation.taskId,
              showStatusConfirmation.newStatusCode,
              false,
            );
            setShowStatusConfirmation(null);
          }}
          onCancel={() => setShowStatusConfirmation(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && (
        <TaskDeleteConfirmationModal
          task={showDeleteConfirmation.task}
          options={showDeleteConfirmation.options}
          onConfirm={(finalOptions) =>
            executeTaskDeletion(showDeleteConfirmation.task.id, finalOptions)
          }
          onCancel={() => setShowDeleteConfirmation(null)}
          currentUser={currentUser}
        />
      )}

      {/* Calendar Modal */}
      {showCalendarModal && (
        <CalendarDatePicker
          onClose={() => {
            setShowCalendarModal(false);
            setSelectedTaskType("regular");
          }}
          onDateSelect={handleCalendarDateSelect}
          taskType={selectedTaskType}
        />
      )}

      {/* Approval Task Creator Modal */}
      {showApprovalTaskModal && !selectedApprovalTask && (
        <div className="fixed inset-0 z-50 overflow-hidden overlay-animate mt-0">
          <div
            className="drawer-overlay absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowApprovalTaskModal(false)}
          ></div>
          <div
            className="absolute right-0 top-0 h-full bg-white/95 backdrop-blur-sm flex flex-col modal-animate-slide-right"
            style={{
              width: "min(90vw, 900px)",
              boxShadow: "-10px 0 50px rgba(0,0,0,0.2)",
              borderLeft: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            <div className="drawer-header">
              <h2 className="text-2xl font-bold text-white">
                Create Approval Task
                {selectedDateForTask &&
                  ` for ${new Date(selectedDateForTask).toLocaleDateString(
                    "en-US",
                    {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    },
                  )}`}
              </h2>
              <button
                onClick={() => setShowApprovalTaskModal(false)}
                className="close-btn"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="drawer-body">
              <ApprovalTaskCreator
                onClose={() => {
                  setShowApprovalTaskModal(false);
                  setSelectedDateForTask(null);
                }}
                onSubmit={handleCreateApprovalTask}
                preFilledDate={selectedDateForTask}
                selectedDate={selectedDateForTask}
              />
            </div>
          </div>
        </div>
      )}

      {/* Subtask Creator Modal */}
      {showSubtaskCreator && (
        <SubtaskCreator
          parentTask={tasks.find((t) => t.id === showSubtaskCreator)}
          onClose={() => setShowSubtaskCreator(null)}
          onSubmit={(subtaskData) =>
            handleCreateSubtask(showSubtaskCreator, subtaskData)
          }
          currentUser={currentUser}
        />
      )}

      {/* Subtask Detail Panel */}
      {selectedSubtask && (
        <SubtaskDetailPanel
          subtask={selectedSubtask}
          parentTask={tasks.find((t) => t.id === selectedSubtask.parentTaskId)}
          onClose={() => setSelectedSubtask(null)}
          onUpdate={(updatedSubtask) =>
            handleUpdateSubtask(selectedSubtask.parentTaskId, updatedSubtask)
          }
          onDelete={() =>
            handleDeleteSubtask(
              selectedSubtask.parentTaskId,
              selectedSubtask.id,
            )
          }
          currentUser={currentUser}
        />
      )}

      {/* Approval Task Detail Modal */}
      {showApprovalTaskModal && selectedApprovalTask && (
        <ApprovalTaskDetailModal
          task={selectedApprovalTask}
          onClose={() => {
            setShowApprovalTaskModal(false);
            setSelectedApprovalTask(null);
          }}
          currentUser={currentUser}
          onApproval={(taskId, approverId, action, comment) => {
            // Handle approval action
            setTasks((prevTasks) =>
              prevTasks.map((task) => {
                if (task.id !== taskId) return task;

                const updatedApprovers = task.approvers.map((approver) => {
                  if (approver.id === approverId) {
                    return {
                      ...approver,
                      status: action,
                      comment: comment || null,
                      approvedAt: new Date().toISOString(),
                    };
                  }
                  return approver;
                });

                // Determine overall task status based on approval mode
                let newStatus = task.status;
                if (action === "approved") {
                  if (task.approvalMode === "any") {
                    newStatus = "DONE";
                  } else if (task.approvalMode === "all") {
                    const allApproved = updatedApprovers.every(
                      (a) => a.status === "approved",
                    );
                    if (allApproved) newStatus = "DONE";
                  }
                } else if (action === "rejected") {
                  newStatus = "CANCELLED";
                }

                return {
                  ...task,
                  approvers: updatedApprovers,
                  status: newStatus,
                };
              }),
            );

            // Close modal after action
            setShowApprovalTaskModal(false);
            setSelectedApprovalTask(null);
          }}
        />
      )}

      {/* Sub-task Delete Confirmation Modal */}
      {showDeleteSubtaskConfirmation && (
        <SubtaskDeleteConfirmationModal
          subtaskTitle={showDeleteSubtaskConfirmation.subtaskTitle}
          onConfirm={() =>
            handleDeleteSubtask(
              showDeleteSubtaskConfirmation.taskId,
              showDeleteSubtaskConfirmation.subtaskId,
            )
          }
          onCancel={() => setShowDeleteSubtaskConfirmation(null)}
        />
      )}
    </div>
  );
}

// Task Status Dropdown Component with Enhanced Logic
function TaskStatusDropdown({
  task,
  currentStatus,
  statuses,
  onStatusChange,
  canEdit,
  canMarkCompleted,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [validTransitions, setValidTransitions] = useState([]);

  const currentStatusObj = statuses.find(
    (s) => s.code === currentStatus && s.active,
  );
  const badgeStyle = currentStatusObj
    ? {
        backgroundColor: currentStatusObj.color,
        color: "white",
      }
    : {};

  // Calculate valid transitions when dropdown opens
  React.useEffect(() => {
    if (isOpen && currentStatusObj) {
      const transitions = currentStatusObj.allowedTransitions.filter(
        (transitionCode) => {
          const targetStatus = statuses.find(
            (s) => s.code === transitionCode && s.active,
          );

          // Check if target status exists and is active
          if (!targetStatus) return false;

          // Check sub-task completion logic for DONE status
          if (
            transitionCode === "DONE" &&
            task.subtasks &&
            task.subtasks.length > 0
          ) {
            const hasIncompleteSubtasks = task.subtasks.some(
              (subtask) =>
                subtask.status !== "DONE" && subtask.status !== "CANCELLED",
            );
            return !hasIncompleteSubtasks;
          }

          return true;
        },
      );

      setValidTransitions(transitions);
    }
  }, [isOpen, currentStatusObj, task.subtasks, statuses]);

  if (!canEdit) {
    return (
      <div className="relative">
        <span
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-help"
          style={badgeStyle}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {currentStatusObj?.label || currentStatus}
          <svg
            className="ml-1 w-3 h-3 opacity-50"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clipRule="evenodd"
            />
          </svg>
        </span>
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded whitespace-nowrap z-10 max-w-xs">
            {currentStatusObj?.tooltip || "No permission to edit"}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium hover:opacity-80 transition-opacity"
        style={badgeStyle}
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {currentStatusObj?.label || currentStatus}
        <svg className="ml-1 w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Status tooltip */}
      {showTooltip && !isOpen && currentStatusObj?.tooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded whitespace-nowrap z-10 max-w-xs">
          {currentStatusObj.tooltip}
        </div>
      )}

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-sm shadow-lg border border-gray-200 py-1 z-20">
            {/* Current Status */}
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: currentStatusObj?.color }}
                />
                <span className="font-medium">
                  Current: {currentStatusObj?.label}
                </span>
              </div>
            </div>

            {/* Valid Transitions */}
            {validTransitions.length > 0 ? (
              <div className="py-1">
                <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Available Transitions
                </div>
                {validTransitions.map((transitionCode) => {
                  const targetStatus = statuses.find(
                    (s) => s.code === transitionCode && s.active,
                  );
                  if (!targetStatus) return null;

                  return (
                    <button
                      key={transitionCode}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 transition-colors group"
                      onClick={() => {
                        onStatusChange(transitionCode);
                        setIsOpen(false);
                      }}
                    >
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: targetStatus.color }}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {targetStatus.label}
                        </div>
                        {targetStatus.description && (
                          <div className="text-xs text-gray-500">
                            {targetStatus.description}
                          </div>
                        )}
                      </div>
                      {targetStatus.isFinal && (
                        <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                          Final
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-3 py-4 text-center">
                <div className="text-sm text-gray-500">
                  No valid transitions available
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {task.subtasks?.length > 0 &&
                  task.subtasks.some(
                    (s) => s.status !== "DONE" && s.status !== "CANCELLED",
                  )
                    ? "Complete all sub-tasks first"
                    : "This status cannot be changed further"}
                </div>
              </div>
            )}

            {/* All Statuses (for reference) */}
            <div className="border-t border-gray-200 py-1">
              <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                All Available Statuses
              </div>
              {statuses
                .filter((s) => s.active)
                .map((status) => (
                  <div
                    key={status.code}
                    className={`px-3 py-2 text-sm flex items-center gap-2 ${
                      status.code === currentStatus
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-600"
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: status.color }}
                    />
                    <span className="font-medium">{status.label}</span>
                    {status.code === currentStatus && (
                      <svg
                        className="ml-auto w-4 h-4 text-blue-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                    {status.isFinal && status.code !== currentStatus && (
                      <span className="ml-auto text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        Final
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Simple Task Delete Confirmation Modal Component
function TaskDeleteConfirmationModal({
  task,
  options,
  onConfirm,
  onCancel,
  currentUser,
}) {
  const [deleteSubtasks, setDeleteSubtasks] = useState(false);

  const hasSubtasks = task?.subtasks && task.subtasks.length > 0;

  const handleConfirm = () => {
    onConfirm({ deleteSubtasks, deleteAttachments: deleteSubtasks });
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm bg-opacity-50 mt-0 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Are you sure you want to delete this task?
          </h3>

          {hasSubtasks && (
            <div className="mb-3">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={deleteSubtasks}
                  onChange={(e) => setDeleteSubtasks(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">
                  Also delete all subtasks and attached forms
                </span>
              </label>
            </div>
          )}

          <p className="text-gray-600 mb-3">This action is irreversible.</p>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" className="h-9" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="h-9"
              onClick={handleConfirm}
            >
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Status Confirmation Modal Component
function StatusConfirmationModal({
  taskTitle,
  statusLabel,
  onConfirm,
  onCancel,
}) {
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm bg-opacity-50 flex items-center justify-center z-50 p-4 mt-0">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="p-4">
          <div className="flex items-center mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Confirm Status Change
            </h3>
          </div>

          <p className="text-gray-600 mb-3">
            Are you sure you want to mark "<strong>{taskTitle}</strong>" as{" "}
            <strong>{statusLabel}</strong>?
          </p>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" className="h-9" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="primary" className="h-9" onClick={onConfirm}>
              Confirm
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskContextMenu({ taskId, onDelete, canDelete }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleAddSubtask = () => {
    console.log(`Add sub-task to task ${taskId}`);
    setIsOpen(false);
  };

  const handleViewSubtasks = () => {
    console.log(`View sub-tasks for task ${taskId}`);
    setIsOpen(false);
  };

  const handleDeleteTask = () => {
    onDelete();
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        className="text-gray-400 hover:text-gray-600 transition-colors p-1"
        onClick={() => setIsOpen(!isOpen)}
        title="More options"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-8 z-20 w-48 bg-white rounded-sm shadow-lg border border-gray-200 py-1">
            <button
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              onClick={handleAddSubtask}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add Sub-task
            </button>
            <button
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              onClick={handleViewSubtasks}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
              View Sub-tasks
            </button>
            {canDelete && (
              <>
                <div className="border-t border-gray-200 my-1"></div>
                <button
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  onClick={handleDeleteTask}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Delete Task
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function TaskEditModal({ task, onSave, onClose }) {
  const [formData, setFormData] = useState({
    title: task.title,
    assignee: task.assignee,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    category: task.category,
  });

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...task,
      ...formData,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/30 mt-[-24px] backdrop-blur-sm bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Edit Task</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl font-bold w-8 h-8 flex items-center justify-center transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Task Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange("title", e.target.value)}
              className="form-input w-full"
              placeholder="Enter task title..."
              required
              maxLength={100}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Assignee */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assignee
              </label>
              <select
                value={formData.assignee}
                onChange={(e) => handleChange("assignee", e.target.value)}
                className="form-select w-full"
              >
                <option value="">Select Assignee</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleChange("status", e.target.value)}
                className="form-select w-full"
              >
                <option value="To Do">To Do</option>
                <option value="In Progress">In Progress</option>
                <option value="In Review">In Review</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => handleChange("priority", e.target.value)}
                className="form-select w-full"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => handleChange("dueDate", e.target.value)}
                className="form-input w-full"
              />
            </div>

            {/* Category */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => handleChange("category", e.target.value)}
                className="form-select w-full"
              >
                <option value="Development">Development</option>
                <option value="Design">Design</option>
                <option value="Research">Research</option>
                <option value="Marketing">Marketing</option>
                <option value="Support">Support</option>
              </select>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end pt-4 border-t border-gray-200">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="h-9"
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="h-9">
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Subtask Creator Component
function SubtaskCreator({ parentTask, onClose, onSubmit, currentUser }) {
  const [formData, setFormData] = useState({
    title: "",
    assignee: currentUser.name,
    assigneeId: currentUser.id,
    priority: "Medium",
    dueDate: parentTask.dueDate,
    description: "",
  });

  const teamMembers = [];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.title.trim()) {
      onSubmit(formData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overlay-animate">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full modal-animate-slide-up">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Create Sub-task
              </h3>
              <p className="text-sm text-gray-600">
                Parent: {parentTask.title}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sub-task Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              className="form-input w-full"
              placeholder="Enter sub-task title..."
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assignee
              </label>
              <select
                value={formData.assigneeId}
                onChange={(e) => {
                  const member = teamMembers.find(
                    (m) => m.id === parseInt(e.target.value),
                  );
                  setFormData((prev) => ({
                    ...prev,
                    assigneeId: member.id,
                    assignee: member.name,
                  }));
                }}
                className="form-select w-full"
              >
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, priority: e.target.value }))
                }
                className="form-select w-full"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Due Date
            </label>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, dueDate: e.target.value }))
              }
              className="form-input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              className="form-textarea w-full"
              rows="3"
              placeholder="Add sub-task description..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="h-9 flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="h-9 flex-1"
              disabled={!formData.title.trim()}
            >
              Create Sub-task
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Calendar Date Picker Component
function CalendarDatePicker({ onClose, onDateSelect, taskType }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const handleDateClick = (date) => {
    if (date && date >= new Date().setHours(0, 0, 0, 0)) {
      setSelectedDate(date);
    }
  };

  const handleConfirmDate = () => {
    if (selectedDate) {
      const dateStr = selectedDate.toISOString()[0];
      onDateSelect(dateStr);
    }
  };

  const getTaskTypeInfo = (type) => {
    const types = {
      regular: { icon: "📋", label: "Simple Task", color: "blue" },
      recurring: { icon: "🔄", label: "Recurring Task", color: "purple" },
      milestone: { icon: "🎯", label: "Milestone", color: "red" },
      approval: { icon: "✅", label: "Approval Task", color: "green" },
    };
    return types[type] || types.regular;
  };

  const typeInfo = getTaskTypeInfo(taskType);
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overlay-animate">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full modal-animate-slide-up">
        {/* Header */}
        <div
          className={`p-4 border-b border-gray-200 bg-gradient-to-r from-${typeInfo.color}-500 to-${typeInfo.color}-600 text-white rounded-t-2xl`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{typeInfo.icon}</span>
              <div>
                <h3 className="text-lg font-semibold">Select Date</h3>
                <p className="text-sm opacity-90">
                  Choose a date for your {typeInfo.label.toLowerCase()}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Calendar */}
        <div className="p-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-2 hover:bg-gray-100 rounded-sm transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            <h4 className="text-lg font-semibold text-gray-900">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h4>

            <button
              onClick={() => navigateMonth(1)}
              className="p-2 hover:bg-gray-100 rounded-sm transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-gray-500 py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1 mb-3">
            {getDaysInMonth(currentDate).map((date, index) => {
              const isToday =
                date && date.toDateString() === new Date().toDateString();
              const isSelected =
                selectedDate &&
                date &&
                date.toDateString() === selectedDate.toDateString();
              const isPast = date && date < new Date().setHours(0, 0, 0, 0);
              const isSelectable = date && !isPast;

              return (
                <button
                  key={index}
                  onClick={() => handleDateClick(date)}
                  disabled={!isSelectable}
                  className={`
                    h-10 text-sm rounded-sm transition-all duration-200
                    ${!date ? "invisible" : ""}
                    ${isPast ? "text-gray-300 cursor-not-allowed" : ""}
                    ${
                      isSelectable && !isSelected && !isToday
                        ? "text-gray-900 hover:bg-gray-100"
                        : ""
                    }
                    ${
                      isToday && !isSelected
                        ? "bg-blue-100 text-blue-800 font-medium"
                        : ""
                    }
                    ${
                      isSelected
                        ? `bg-${typeInfo.color}-500 text-white font-medium shadow-lg`
                        : ""
                    }
                    ${isSelectable ? "cursor-pointer" : ""}
                  `}
                >
                  {date && date.getDate()}
                </button>
              );
            })}
          </div>

          {selectedDate && (
            <div className="mb-3 p-3 bg-gray-50 rounded-sm">
              <div className="text-sm text-gray-600">Selected Date:</div>
              <div className="font-medium text-gray-900">
                {selectedDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button onClick={onClose} variant="outline" className="h-9 flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDate}
              disabled={!selectedDate}
              variant={selectedDate ? "primary" : "outline"}
              className="h-9 flex-1"
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Subtask Detail Panel Component
function SubtaskDetailPanel({
  subtask,
  parentTask,
  onClose,
  onUpdate,
  onDelete,
  currentUser,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    title: subtask.title,
    assignee: subtask.assignee,
    assigneeId: subtask.assigneeId,
    status: subtask.status,
    priority: subtask.priority,
    dueDate: subtask.dueDate,
    description: subtask.description || "",
  });

  const teamMembers = [];

  const handleSave = () => {
    const updatedSubtask = {
      ...subtask,
      ...formData,
    };
    onUpdate(updatedSubtask);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      title: subtask.title,
      assignee: subtask.assignee,
      assigneeId: subtask.assigneeId,
      status: subtask.status,
      priority: subtask.priority,
      dueDate: subtask.dueDate,
      description: subtask.description || "",
    });
    setIsEditing(false);
  };

  const getStatusColor = (status) => {
    const colors = {
      OPEN: "bg-gray-100 text-gray-800",
      INPROGRESS: "bg-blue-100 text-blue-800",
      DONE: "bg-green-100 text-green-800",
      ONHOLD: "bg-yellow-100 text-yellow-800",
      CANCELLED: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getPriorityColor = (priority) => {
    const colors = {
      Low: "bg-green-100 text-green-800",
      Medium: "bg-yellow-100 text-yellow-800",
      High: "bg-orange-100 text-orange-800",
      Urgent: "bg-red-100 text-red-800",
    };
    return colors[priority] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overlay-animate">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto modal-animate-slide-right">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Sub-task Details
              </h3>
              <p className="text-sm text-gray-600">
                Parent: {parentTask.title}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setIsEditing(!isEditing)}
                variant="outline"
                size="sm"
              >
                {isEditing ? "Cancel" : "Edit"}
              </Button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            {isEditing ? (
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
                className="form-input w-full"
              />
            ) : (
              <p className="text-gray-900 bg-gray-50 p-3 rounded-sm">
                {subtask.title}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Assignee */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assignee
              </label>
              {isEditing ? (
                <select
                  value={formData.assigneeId}
                  onChange={(e) => {
                    const member = teamMembers.find(
                      (m) => m.id === parseInt(e.target.value),
                    );
                    setFormData((prev) => ({
                      ...prev,
                      assigneeId: member.id,
                      assignee: member.name,
                    }));
                  }}
                  className="form-select w-full"
                >
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-gray-900 bg-gray-50 p-3 rounded-sm">
                  {subtask.assignee}
                </p>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              {isEditing ? (
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, status: e.target.value }))
                  }
                  className="form-select w-full"
                >
                  {(Array.isArray(companyStatuses) ? companyStatuses : [])
                    .filter((s) => s && s.active)
                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                    .map((s) => (
                      <option key={s._id || s.code} value={s.code}>
                        {s.label}
                      </option>
                    ))}
                </select>
              ) : (
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                    subtask.status,
                  )}`}
                >
                  {subtask.status}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              {isEditing ? (
                <select
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      priority: e.target.value,
                    }))
                  }
                  className="form-select w-full"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              ) : (
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPriorityColor(
                    subtask.priority,
                  )}`}
                >
                  {subtask.priority}
                </span>
              )}
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date
              </label>
              {isEditing ? (
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      dueDate: e.target.value,
                    }))
                  }
                  className="form-input w-full"
                />
              ) : (
                <p className="text-gray-900 bg-gray-50 p-3 rounded-sm">
                  {subtask.dueDate}
                </p>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            {isEditing ? (
              <CustomEditor
                value={formData.description}
                onChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: value,
                  }))
                }
                placeholder="Add description..."
                className="w-full"
              />
            ) : (
              <div className="text-gray-900 bg-gray-50 p-3 rounded-sm min-h-[100px]">
                {subtask.description ? (
                  <SafeHtml html={subtask.description} className="text-sm" />
                ) : (
                  <p className="text-gray-500 italic">
                    No description provided
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="bg-gray-50 p-4 rounded-sm">
            <h4 className="text-sm font-medium text-gray-700 mb-1">Metadata</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Created by:</span>
                <p className="text-gray-900">{subtask.createdBy}</p>
              </div>
              <div>
                <span className="text-gray-500">Created at:</span>
                <p className="text-gray-900">
                  {new Date(subtask.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            {isEditing ? (
              <>
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="h-9 flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  variant="primary"
                  className="h-9 flex-1"
                >
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={onDelete}
                  variant="destructive"
                  className="h-9"
                >
                  Delete Sub-task
                </Button>
                <Button
                  onClick={() => setIsEditing(true)}
                  variant="primary"
                  className="h-9 flex-1"
                >
                  Edit Sub-task
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Subtask Delete Confirmation Modal Component
function SubtaskDeleteConfirmationModal({ subtaskTitle, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm bg-opacity-50 flex items-center justify-center z-50 p-4 mt-0">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="p-4">
          <div className="flex items-center mb-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Delete Sub-task
            </h3>
          </div>

          <p className="text-gray-600 mb-3">
            Are you sure you want to delete this sub-task: "
            <strong>{subtaskTitle}</strong>"?
          </p>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" className="h-9" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="destructive" className="h-9" onClick={onConfirm}>
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Approval Task Detail Modal Component
function ApprovalTaskDetailModal({ task, onClose, currentUser, onApproval }) {
  const [comment, setComment] = useState("");
  const [showApprovalConfirm, setShowApprovalConfirm] = useState(null);

  const userApprover = task.approvers?.find((a) => a.id === currentUser.id);
  const canUserApprove = userApprover && userApprover.status === "pending";

  const getApprovalModeDescription = (mode) => {
    switch (mode) {
      case "any":
        return "Any single approver can approve/reject";
      case "all":
        return "All approvers must approve";
      case "sequential":
        return "Approvers must act in order";
      default:
        return "";
    }
  };

  const getOverallStatus = () => {
    if (!task.approvers) return "pending";

    const hasRejected = task.approvers.some((a) => a.status === "rejected");
    if (hasRejected) return "rejected";

    const allApproved = task.approvers.every((a) => a.status === "approved");
    if (allApproved) return "approved";

    const hasApproved = task.approvers.some((a) => a.status === "approved");
    if (hasApproved && task.approvalMode === "any") return "approved";

    return "pending";
  };

  const handleApprovalAction = (action) => {
    if (!comment.trim() && action === "rejected") {
      showErrorToast("Please provide a comment when rejecting");
      return;
    }

    setShowApprovalConfirm({ action, comment });
  };

  const confirmApproval = () => {
    if (showApprovalConfirm) {
      onApproval(
        task.id,
        currentUser.id,
        showApprovalConfirm.action,
        showApprovalConfirm.comment,
      );
      setShowApprovalConfirm(null);
      setComment("");
    }
  };

  const overallStatus = getOverallStatus();

  return (
    <div className="fixed inset-0 z-40 overflow-hidden">
      {/* Backdrop */}
      {/* <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      ></div> */}

      {/* Sliding Panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-4xl bg-white shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white p-4 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">✅</span>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold mb-2 break-words">
                  {task.title}
                </h2>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span
                    className={`px-3 py-1 rounded-full font-medium ${
                      overallStatus === "approved"
                        ? "bg-green-500/20 text-green-100"
                        : overallStatus === "rejected"
                          ? "bg-red-500/20 text-red-100"
                          : "bg-yellow-500/20 text-yellow-100"
                    }`}
                  >
                    {overallStatus.charAt(0).toUpperCase() +
                      overallStatus.slice(1)}
                  </span>
                  <span className="text-blue-100">Approval Task</span>
                  <span className="text-blue-200">Due: {task.dueDate}</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white p-2 rounded-sm hover:bg-white/10 transition-colors flex-shrink-0"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Task Details Section */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
              <svg
                className="w-5 h-5 mr-2 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Task Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Created By
                </label>
                <p className="text-gray-900">{task.createdBy || "Unknown"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Created Date
                </label>
                <p className="text-gray-900">
                  {task.createdAt
                    ? new Date(task.createdAt).toLocaleDateString()
                    : "Unknown"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    task.priority === "critical"
                      ? "bg-red-100 text-red-800"
                      : task.priority === "high"
                        ? "bg-orange-100 text-orange-800"
                        : task.priority === "medium"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-green-100 text-green-800"
                  }`}
                >
                  {task.priority?.charAt(0).toUpperCase() +
                    task.priority?.slice(1) || "Medium"}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Visibility
                </label>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    task.visibility === "public"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {task.visibility?.charAt(0).toUpperCase() +
                    task.visibility?.slice(1) || "Private"}
                </span>
              </div>
            </div>

            {task.description && (
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <div className="bg-white p-4 rounded-sm border border-gray-200">
                  <SafeHtml html={task.description} className="text-gray-900" />
                </div>
              </div>
            )}
          </div>

          {/* Approval Workflow Section */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
              <svg
                className="w-5 h-5 mr-2 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Approval Workflow
            </h3>

            <div className="mb-3 p-4 bg-blue-50 rounded-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-blue-900">Approval Mode</h4>
                  <p className="text-sm text-blue-700">
                    {getApprovalModeDescription(task.approvalMode)}
                  </p>
                </div>
                <span className="px-3 py-1 bg-blue-200 text-blue-800 rounded-full text-sm font-medium">
                  {task.approvalMode?.toUpperCase() || "ANY"}
                </span>
              </div>
            </div>

            {/* Approvers List */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">
                Approvers ({task.approvers?.length || 0})
              </h4>
              {task.approvers?.map((approver, index) => (
                <div
                  key={approver.id}
                  className={`p-4 rounded-sm border-2 transition-all ${
                    approver.status === "approved"
                      ? "border-green-200 bg-green-50"
                      : approver.status === "rejected"
                        ? "border-red-200 bg-red-50"
                        : approver.status === "pending"
                          ? "border-blue-200 bg-blue-50"
                          : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <span className="text-2xl">
                          {approver.avatar ||
                            (approver.status === "approved"
                              ? "✅"
                              : approver.status === "rejected"
                                ? "❌"
                                : approver.status === "pending"
                                  ? "⏳"
                                  : "⏸️")}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h5 className="font-medium text-gray-900">
                            {approver.name}
                          </h5>
                          <span className="text-sm text-gray-500">
                            ({approver.role})
                          </span>
                          {approver.id === currentUser.id && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                              You
                            </span>
                          )}
                        </div>
                        <div className="mt-1">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              approver.status === "approved"
                                ? "bg-green-100 text-green-800"
                                : approver.status === "rejected"
                                  ? "bg-red-100 text-red-800"
                                  : approver.status === "pending"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {approver.status?.charAt(0).toUpperCase() +
                              approver.status?.slice(1) || "Waiting"}
                          </span>
                          {approver.approvedAt && (
                            <span className="ml-2 text-xs text-gray-500">
                              on{" "}
                              {new Date(
                                approver.approvedAt,
                              ).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {approver.comment && (
                          <div className="mt-2 p-2 bg-white rounded border">
                            <p className="text-sm text-gray-700">
                              "{approver.comment}"
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )) || (
                <div className="text-center py-8 text-gray-500">
                  <p>No approvers assigned</p>
                </div>
              )}
            </div>
          </div>

          {/* Attachments Section */}
          {task.attachments && task.attachments.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <svg
                  className="w-5 h-5 mr-2 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                  />
                </svg>
                Attachments ({task.attachments.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {task.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center p-3 bg-gray-50 rounded-sm border"
                  >
                    <span className="text-lg mr-3">📄</span>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium text-gray-900 truncate"
                        title={attachment.name}
                      >
                        {attachment.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(attachment.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Section */}
          {canUserApprove && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <svg
                  className="w-5 h-5 mr-2 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Your Review
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Comment (required for rejection)
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows="4"
                    placeholder="Add your comments or feedback..."
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => handleApprovalAction("approved")}
                    className="flex-1 bg-green-600 text-white px-6 py-3 rounded-sm hover:bg-green-700 transition-colors font-medium flex items-center justify-center"
                  >
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Approve
                  </button>
                  <button
                    onClick={() => handleApprovalAction("rejected")}
                    className="flex-1 bg-red-600 text-white px-6 py-3 rounded-sm hover:bg-red-700 transition-colors font-medium flex items-center justify-center"
                  >
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                    Reject
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showApprovalConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-4">
              <div className="flex items-center mb-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                    showApprovalConfirm.action === "approved"
                      ? "bg-green-100"
                      : "bg-red-100"
                  }`}
                >
                  {showApprovalConfirm.action === "approved" ? (
                    <svg
                      className="w-6 h-6 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-6 h-6 text-red-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Confirm{" "}
                  {showApprovalConfirm.action === "approved"
                    ? "Approval"
                    : "Rejection"}
                </h3>
              </div>

              <p className="text-gray-600 mb-3">
                Are you sure you want to{" "}
                {showApprovalConfirm.action === "approved"
                  ? "approve"
                  : "reject"}{" "}
                this task?
                {showApprovalConfirm.comment && (
                  <span className="block mt-2 font-medium">
                    Comment: "{showApprovalConfirm.comment}"
                  </span>
                )}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowApprovalConfirm(null)}
                  className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-sm hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmApproval}
                  className={`flex-1 px-4 py-2 text-white rounded-sm transition-colors ${
                    showApprovalConfirm.action === "approved"
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  Confirm{" "}
                  {showApprovalConfirm.action === "approved"
                    ? "Approval"
                    : "Rejection"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showBulkDeleteConfirm}
        title="Delete Selected Tasks?"
        description={`Are you sure you want to delete ${selectedTasks.length} selected tasks? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="destructive"
        onCancel={() => setShowBulkDeleteConfirm(false)}
        onConfirm={() => {
          const count = selectedTasks.length;
          setTasks((prevTasks) =>
            prevTasks.filter((task) => !selectedTasks.includes(task.id)),
          );
          setSelectedTasks([]);
          setShowBulkActions(false);
          setShowBulkDeleteConfirm(false);
          showSuccessToast(`${count} tasks deleted successfully`);
        }}
      />
    </div>
  );
}
