import React, { useMemo, useState, useEffect, useLayoutEffect, useRef } from "react";
import { useActiveRole } from "../../components/RoleSwitcher";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { quickTasksAPI } from "../../services/quickTasksAPI";
import SearchableSelect from "../SearchableSelect";
import { useShowToast } from "@/utils/ToastMessage";
import { Button } from "@/components/ui/button";
import { useTaskStatuses } from "../../hooks/useTaskStatuses";
import { useTaskPriorities } from "../../hooks/useTaskPriorities";
import {
  getPriorityOptions,
  getDefaultPriorityCode,
  getPriorityColor,
  getPriorityBadgeClasses,
} from "../../utils/priorityUtils";

import CustomConfirmationModal from "../newComponents/CustomConfirmationModal";
import eventEmitter from "../../utils/eventEmitter";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../../components/ui/table";
import {
  Plus,
  CheckCircle,
  Circle,
  Trash2,
  Edit3,
  ArrowRight,
  Calendar,
  Clock,
  Filter,
  Search,
  RotateCw,
  AlertTriangle,
  Loader,
} from "lucide-react";
import CommonLoader from "@/components/common/CommonLoader";

/** Scroll so `element` is centered inside `container` only — does not scroll the page. */
function scrollElementWithinContainer(container, element, { behavior = "smooth" } = {}) {
  const cRect = container.getBoundingClientRect();
  const eRect = element.getBoundingClientRect();
  const relativeTop = container.scrollTop + (eRect.top - cRect.top);
  const elHeight = element.offsetHeight;
  const targetTop = relativeTop - container.clientHeight / 2 + elHeight / 2;
  const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
  const nextTop = Math.max(0, Math.min(targetTop, maxTop));
  container.scrollTo({ top: nextTop, behavior });
}

export default function QuickTasks() {
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [selectedTasks, setSelectedTasks] = useState([]);

  // Edit Modal States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editModalTask, setEditModalTask] = useState(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskPriority, setEditTaskPriority] = useState("");
  const [editTaskDueDate, setEditTaskDueDate] = useState("");

  // Quick Task Form States
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [showInlineForm, setShowInlineForm] = useState(false);

  // API States
  const [quickTasks, setQuickTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Toast hook
  const { showSuccessToast, showErrorToast, showInfoToast } = useShowToast();

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: "",
    title: "",
    message: "",
    onConfirm: null,
    data: null,
  });

  const taskListScrollRef = useRef(null);
  const scrollToTaskIdRef = useRef(null);

  const { activeRole } = useActiveRole();
  const queryClient = useQueryClient();

  // Get user data
  const { data: user } = useQuery({
    queryKey: ["/api/auth/verify"],
    enabled: !!localStorage.getItem("token"),
  });

  const { data: taskStatuses = [] } = useTaskStatuses();
  const { data: taskPriorities = [] } = useTaskPriorities();

  const activePriorities = useMemo(() => {
    return getPriorityOptions(taskPriorities);
  }, [taskPriorities]);

  // Set default priority when taskPriorities load
  useEffect(() => {
    if (taskPriorities.length > 0 && !newTaskPriority) {
      const defaultCode = getDefaultPriorityCode(taskPriorities);
      setNewTaskPriority(defaultCode);
    }
  }, [taskPriorities, newTaskPriority]);

  // Quick Tasks backend expects: pending | in-progress | done
  // Use TaskStatusConfig labels for OPEN/INPROGRESS/DONE so admin changes reflect here too.
  const quickTaskStatusOptions = useMemo(() => {
    const list = Array.isArray(taskStatuses) ? taskStatuses : [];
    const openLabel = list.find((s) => s?.code === "OPEN")?.label || "Pending";
    const inProgressLabel =
      list.find((s) => s?.code === "INPROGRESS")?.label || "In Progress";
    const doneLabel = list.find((s) => s?.code === "DONE")?.label || "Done";

    return [
      { value: "all", label: "All Status" },
      { value: "pending", label: openLabel },
      { value: "in-progress", label: inProgressLabel },
      { value: "done", label: doneLabel },
    ];
  }, [taskStatuses]);

  const quickTaskPriorityOptions = useMemo(() => {
    return getPriorityOptions(taskPriorities, true); // true = include "All" option
  }, [taskPriorities]);

  // Auth guard: redirect to login if no token
  useEffect(() => {
    const token = localStorage.getItem("token");
    console.log("🔐 QuickTasks - Auth check:", {
      hasToken: !!token,
      tokenPreview: token ? `${token.substring(0, 10)}...` : "null",
      localStorageKeys: Object.keys(localStorage),
      user: user,
    });
    if (!token) {
      console.warn("🚫 No auth token found. Redirecting to login...");
      navigate("/login");
    }
  }, [navigate, user]);

  // Fetch Quick Tasks
  const fetchQuickTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("🔄 Fetching Quick Tasks...");

      const params = {
        status: statusFilter,
        priority: priorityFilter,
        search: searchTerm,
      };

      const response = await quickTasksAPI.fetchQuickTasks(params);
      console.log("📥 fetchQuickTasks response:", response);

      if (response && response.success) {
        // Handle different possible response structures
        const tasks = response.quickTasks || response.data || [];
        console.log("✅ Setting tasks:", tasks);
        setQuickTasks(tasks);
      } else {
        console.error("❌ API Error:", response);
        setError(response.message || "Failed to fetch quick tasks.");
      }
    } catch (error) {
      console.error("❌ Fetch Error:", error);
      setError(
        error.message || "An error occurred while fetching quick tasks.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuickTasks();
  }, [statusFilter, priorityFilter, searchTerm]);

  // Listen for quick task creation events from other components
  useEffect(() => {
    const handleQuickTaskCreated = (newTask) => {
      console.log("🔄 Received quickTaskCreated event:", newTask);
      // Refresh the tasks list when a new task is created elsewhere
      fetchQuickTasks();
    };

    // Subscribe to the event
    eventEmitter.on("quickTaskCreated", handleQuickTaskCreated);

    // Cleanup: unsubscribe when component unmounts
    return () => {
      eventEmitter.off("quickTaskCreated", handleQuickTaskCreated);
    };
  }, []);

  // Priority color and badge utilities are now imported from priorityUtils

  const getStatusIcon = (status) => {
    switch (status) {
      case "done":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "in-progress":
        return <Circle className="w-5 h-5 text-amber-600" />;
      default:
        return <Circle className="w-5 h-5 text-blue-600" />;
    }
  };

  // Handle quick task creation
  const handleCreateQuickTask = async () => {
    if (!newTaskTitle.trim()) {
      showErrorToast("Task title is required");
      return;
    }

    try {
      console.log("🚀 Creating Quick Task...");
      const taskData = {
        title: newTaskTitle.trim(),
        priority: newTaskPriority,
        dueDate: newTaskDueDate || null,
      };
      console.log("📤 Task data:", taskData);

      const response = await quickTasksAPI.createQuickTask(taskData);
      console.log("📥 Create response:", response);

      if (response && response.success) {
        showSuccessToast("Quick task created");

        const qt = response.quickTask;
        const createdId =
          qt && (qt._id != null || qt.id != null)
            ? String(qt._id ?? qt.id)
            : null;

        // Clear form
        setNewTaskTitle("");
        setNewTaskPriority(getDefaultPriorityCode(taskPriorities));
        setNewTaskDueDate("");
        setShowCreateModal(false);

        // Force refresh the tasks list
        console.log("🔄 Refreshing tasks after creation...");
        await fetchQuickTasks();
        if (createdId) {
          scrollToTaskIdRef.current = createdId;
        }
      } else {
        throw new Error(response.message || "Failed to create quick task");
      }
    } catch (error) {
      console.error("❌ Error creating quick task:", error);
      // If token missing or unauthorized, prompt re-login
      if (error?.status === 401 || error?.message === "NO_AUTH_TOKEN") {
        showErrorToast("Session expired. Log in again.");
        try {
          localStorage.removeItem("token");
        } catch (e) {}
        navigate("/login");
        return;
      }

      showErrorToast(error.message || "Failed to create quick task");
    }
  };

  // Handle marking task as done (one-way, cannot toggle back)
  const handleMarkAsDone = async (taskId) => {
    try {
      const response = await quickTasksAPI.updateTaskStatus(taskId, "done");

      if (response && response.success) {
        // Update local state
        setQuickTasks((prev) =>
          prev.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  status: "done",
                  completedAt: new Date().toISOString(),
                }
              : task,
          ),
        );

        // 🔔 Invalidate notifications cache to show new notification immediately
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });

        showSuccessToast("Task marked as completed");
      }
    } catch (error) {
      console.error("Error marking task as done:", error);
      showErrorToast("Failed to mark task as done");
    }
  };

  // Handle task deletion
  const handleDeleteTask = (taskId) => {
    const task = quickTasks.find((t) => t.id === taskId);
    if (!task) return;

    setConfirmModal({
      isOpen: true,
      type: "danger",
      title: "Delete Quick Task",
      message: `Are you sure you want to delete "${task.title}"? This action cannot be undone.`,
      onConfirm: () => executeDeleteTask(taskId),
      data: { taskId },
    });
  };

  const executeDeleteTask = async (taskId) => {
    try {
      const response = await quickTasksAPI.deleteQuickTask(taskId);

      if (response && response.success) {
        setQuickTasks((prev) => prev.filter((task) => task.id !== taskId));
        setConfirmModal({
          isOpen: false,
          type: "",
          title: "",
          message: "",
          onConfirm: null,
          data: null,
        });
        showSuccessToast("Task deleted");
      }
    } catch (error) {
      console.error("Error deleting quick task:", error);
      showErrorToast("Failed to delete task");
      setConfirmModal({
        isOpen: false,
        type: "",
        title: "",
        message: "",
        onConfirm: null,
        data: null,
      });
    }
  };

  // Handle edit modal
  const handleEditModal = (task) => {
    setEditModalTask(task);
    setEditTaskTitle(task.title);
    setEditTaskPriority(task.priority ? task.priority.toLowerCase() : "");
    const formatted = task.dueDate
      ? new Date(task.dueDate).toISOString().split("T")[0]
      : "";
    setEditTaskDueDate(formatted);
    setShowEditModal(true);
  };

  const handleEditModalSave = async () => {
    if (!editTaskTitle.trim()) {
      showErrorToast("Task title is required");
      return;
    }

    try {
      const response = await quickTasksAPI.updateQuickTask(editModalTask.id, {
        title: editTaskTitle.trim(),
        priority: editTaskPriority,
        dueDate: editTaskDueDate || null,
      });

      if (response && response.success) {
        setQuickTasks((prev) =>
          prev.map((task) =>
            task.id === editModalTask.id
              ? {
                  ...task,
                  title: editTaskTitle.trim(),
                  priority: editTaskPriority,
                  dueDate: editTaskDueDate || null,
                }
              : task,
          ),
        );
        showSuccessToast("Task updated");
        setShowEditModal(false);
        setEditModalTask(null);
      }
    } catch (error) {
      console.error("Error updating quick task:", error);
      showErrorToast("Failed to update task");
    }
  };

  // Handle title editing (inline)
  const handleTitleEdit = (task) => {
    setEditingTaskId(task.id);
    setEditingTitle(task.title);
  };

  const handleTitleSave = async (taskId) => {
    if (!editingTitle.trim()) {
      setEditingTaskId(null);
      setEditingTitle("");
      return;
    }

    try {
      const response = await quickTasksAPI.updateQuickTask(taskId, {
        title: editingTitle.trim(),
      });

      if (response && response.success) {
        setQuickTasks((prev) =>
          prev.map((task) =>
            task.id === taskId ? { ...task, title: editingTitle.trim() } : task,
          ),
        );
        showSuccessToast("Title updated");
      }
    } catch (error) {
      console.error("Error updating task title:", error);
      showErrorToast("Failed to update title");
    }

    setEditingTaskId(null);
    setEditingTitle("");
  };

  const handleTitleCancel = () => {
    setEditingTaskId(null);
    setEditingTitle("");
  }; 

  // Handle conversion to full task
  const handleConvertToTask = (quickTask) => {
    setConfirmModal({
      isOpen: true,
      type: "info",
      title: "Convert to Full Task",
      message: `Do you want to convert "${quickTask.title}" to a full task? This will create a new task with all features available and mark this quick task as converted.`,
      onConfirm: () => executeConvertToTask(quickTask),
      data: { quickTask },
    });
  };

  const executeConvertToTask = async (quickTask) => {
    try {
      setConfirmModal({
        isOpen: false,
        type: "",
        title: "",
        message: "",
        onConfirm: null,
        data: null,
      });

      // Store Quick Task data in sessionStorage for form prefilling
      sessionStorage.setItem(
        "convertingQuickTask",
        JSON.stringify({
          id: quickTask._id,
          title: quickTask.title,
          priority: quickTask.priority,
          dueDate: quickTask.dueDate,
          notes: quickTask.description || "",
          tags: quickTask.tags || [],
        }),
      );

      // Navigate to create task page
      navigate(`/tasks/create?type=regular&from_quick_task=${quickTask._id}`);

      showInfoToast("Redirecting to create full task...");
    } catch (error) {
      console.error("Error converting task:", error);
      showErrorToast("Failed to convert task");
    }
  };

  // Function to mark quick task as converted (called from CreateTask page after successful creation)
  const markQuickTaskAsConverted = async (
    quickTaskId,
    regularTaskId,
    taskType = "regular",
  ) => {
    try {
      console.log("🔄 Marking Quick Task as converted:", {
        quickTaskId,
        regularTaskId,
        taskType,
      });

      const response = await quickTasksAPI.convertToRegular(quickTaskId, {
        regularTaskId,
        taskType,
      });

      if (response.success) {
        console.log("✅ Quick Task marked as converted successfully");
        // Refresh the quick tasks list
        await fetchQuickTasks();
        return true;
      } else {
        console.error("❌ Failed to mark quick task as converted:", response);
        return false;
      }
    } catch (error) {
      console.error("❌ Error marking quick task as converted:", error);
      return false;
    }
  };

  // Expose the function globally for CreateTask page to call
  useEffect(() => {
    window.markQuickTaskAsConverted = markQuickTaskAsConverted;
    return () => {
      delete window.markQuickTaskAsConverted;
    };
  }, []);

  // Filter tasks
  const filteredTasks = quickTasks.filter((task) => {
    const matchesSearch =
      !searchTerm ||
      task.title.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || task.status === statusFilter;

    const matchesPriority =
      priorityFilter === "all" || task.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Sort tasks
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    switch (sortBy) {
      case "createdAt":
        return new Date(b.createdAt) - new Date(a.createdAt);
      case "title":
        return a.title.localeCompare(b.title);
      case "priority":
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      case "dueDate":
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      default:
        return 0;
    }
  });

  useLayoutEffect(() => {
    const id = scrollToTaskIdRef.current;
    if (!id || loading) return;
    const container = taskListScrollRef.current;
    scrollToTaskIdRef.current = null;
    if (!container) return;
    const el = Array.from(
      container.querySelectorAll("[data-quick-task-id]"),
    ).find((node) => node.getAttribute("data-quick-task-id") === id);
    if (el) {
      scrollElementWithinContainer(container, el, { behavior: "smooth" });
    }
  }, [quickTasks, loading, sortedTasks.length]);

  return (
    <div className="quicktasks-square px-6 py-3 flex flex-1 flex-col min-h-0 bg-gray-50">
      <style>{`
        .quicktasks-square .modal-container,
        .quicktasks-square .modal-header,
        .quicktasks-square .modal-body,
        .quicktasks-square .form-card,
        .quicktasks-square .modal-icon,
        .quicktasks-square .form-input,
        .quicktasks-square .form-select,
        .quicktasks-square .card,
        .quicktasks-square .bg-white.border,
        .quicktasks-square input,
        .quicktasks-square select,
        .quicktasks-square button:not(.rounded-full):not([class*="rounded-full"]) {
          border-radius: 0.25rem !important;
        }
        .quicktasks-square [data-loader-ring] {
          border-radius: 9999px !important;
        }
        .quicktasks-square .card,
        .quicktasks-square .card:hover,
        .quicktasks-square .card:focus-within {
          transform: none !important;
        }
      `}</style>
      {/* Header */}
      <div className="shrink-0 flex flex-col lg:flex-row lg:items-center lg:justify-between mb-2">
        <div>
          <h1 className="text-2xl font-normal m-0" style={{ color: "#676a6c" }}>Quick Tasks</h1>
          <p className="mt-0 text-sm text-blue-600">
            Manage your personal quick tasks and to-dos
          </p>
        </div>
        <div className="mt-1 lg:mt-0 flex flex-col sm:flex-row gap-2 flex-wrap">
          <Button
            variant="primary"
            className="h-8 whitespace-nowrap rounded-sm"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Quick Task
          </Button>
          <Button
            variant="outline"
            className="h-8 whitespace-nowrap rounded-sm"
            onClick={() => fetchQuickTasks()}
            disabled={loading}
          >
            <RotateCw
              className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Create Quick Task Modal */}
      {showCreateModal && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowCreateModal(false);
            setNewTaskTitle("");
            setNewTaskPriority("medium");
            setNewTaskDueDate("");
          }}
        >
          <div
            className="modal-container max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="modal-header" style={{ background: "#4f46e5" }}>
              <div className="modal-title-section">
                <div className="modal-icon">
                  <Plus size={20} />
                </div>
                <div>
                  <h3>Add Quick Task</h3>
                  <p>Create a personal quick task</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-sm text-white hover:bg-white/10 hover:text-black"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewTaskTitle("");
                  setNewTaskPriority("medium");
                  setNewTaskDueDate("");
                }}
              >
                <Plus size={20} style={{ transform: "rotate(45deg)" }} />
              </Button>
            </div>

            {/* Form */}
            <div className="modal-body">
              <div className="form-card">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleCreateQuickTask();
                  }}
                  className="space-y-3"
                >
                  {/* Task Title */}
                  <div className="form-group">
                    <label className="form-label flex justify-between">
                      <div className="flex">
                        <Plus size={16} /> <span>Task Title</span>
                      </div>
                      <span className="text-gray-500">
                        {newTaskTitle.length}/200
                      </span>
                    </label>
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="What needs to be done?"
                      className="form-input h-8 min-h-8 max-h-8 box-border py-0 rounded-sm leading-none"
                      maxLength={200}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          // Form onSubmit will handle the API call
                        }
                      }}
                      autoFocus
                    />
                  </div>

                  {/* Row: Priority & Due Date */}
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">
                        <AlertTriangle size={16} />
                        Priority
                      </label>
                      <select
                        value={newTaskPriority}
                        onChange={(e) => setNewTaskPriority(e.target.value)}
                        className="form-select h-8 min-h-8 max-h-8 box-border py-0 rounded-sm leading-none"
                      >
                        {(activePriorities.length
                          ? activePriorities
                          : [
                              { value: "low", label: "Low" },
                              { value: "medium", label: "Medium" },
                              { value: "high", label: "High" },
                            ]
                        ).map((p) => (
                          <option
                            key={p._id || p.value || p.code}
                            value={p.value || p.code}
                          >
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Calendar size={16} />
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={newTaskDueDate}
                        onChange={(e) => setNewTaskDueDate(e.target.value)}
                        className="form-input h-8 min-h-8 max-h-8 box-border py-0 rounded-sm leading-none"
                        min={new Date().toISOString().split("T")[0]}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="form-actions flex justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 rounded-sm"
                      onClick={() => {
                        setShowCreateModal(false);
                        setNewTaskTitle("");
                        setNewTaskPriority(
                          getDefaultPriorityCode(taskPriorities),
                        );
                        setNewTaskDueDate("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      className="h-8 rounded-sm"
                      disabled={!newTaskTitle.trim()}
                    >
                      Create Quick Task
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Quick Task Modal */}
      {showEditModal && editModalTask && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowEditModal(false);
            setEditModalTask(null);
            setEditTaskTitle("");
            setEditTaskPriority(getDefaultPriorityCode(taskPriorities));
            setEditTaskDueDate("");
          }}
        >
          <div
            className="modal-container max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="modal-header" style={{ background: "#4f46d6" }}>
              <div className="modal-title-section">
                <div className="modal-icon">
                  <Edit3 size={20} />
                </div>
                <div>
                  <h3>Edit Quick Task</h3>
                  <p>Update your quick task details</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowEditModal(false);
                  setEditModalTask(null);
                  setEditTaskTitle("");
                  setEditTaskPriority(getDefaultPriorityCode(taskPriorities));
                  setEditTaskDueDate("");
                }}
              >
                <Plus size={20} style={{ transform: "rotate(45deg)" }} />
              </Button>
            </div>

            {/* Form */}
            <div className="modal-body">
              <div className="form-card">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleEditModalSave();
                  }}
                  className="space-y-3"
                >
                  {/* Task Title */}
                  <div className="form-group">
                    <label className="form-label flex justify-between">
                      <div className="flex ">
                        <Edit3 size={16} />
                        Task Title
                      </div>
                      <span className="text-gray-500">
                        {editTaskTitle.length}/200
                      </span>
                    </label>
                    <input
                      type="text"
                      value={editTaskTitle}
                      onChange={(e) => setEditTaskTitle(e.target.value)}
                      placeholder="What needs to be done?"
                      className="form-input h-8 min-h-8 max-h-8 box-border py-0 rounded-sm leading-none"
                      maxLength={200}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          // Form onSubmit will handle the API call
                        }
                      }}
                      autoFocus
                    />
                  </div>

                  {/* Row: Priority & Due Date */}
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">
                        <AlertTriangle size={16} />
                        Priority
                      </label>
                      <select
                        value={editTaskPriority}
                        onChange={(e) => setEditTaskPriority(e.target.value)}
                        className="form-select h-8 min-h-8 max-h-8 box-border py-0 rounded-sm leading-none"
                      >
                        {(activePriorities.length
                          ? activePriorities
                          : [
                              { value: "low", label: "Low" },
                              { value: "medium", label: "Medium" },
                              { value: "high", label: "High" },
                            ]
                        ).map((p) => (
                          <option
                            key={p._id || p.value || p.code}
                            value={p.value || p.code}
                          >
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Calendar size={16} />
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={editTaskDueDate}
                        onChange={(e) => setEditTaskDueDate(e.target.value)}
                        className="form-input h-8 min-h-8 max-h-8 box-border py-0 rounded-sm leading-none"
                        min={new Date().toISOString().split("T")[0]}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="form-actions flex justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 rounded-sm"
                      onClick={() => {
                        setShowEditModal(false);
                        setEditModalTask(null);
                        setEditTaskTitle("");
                        setEditTaskPriority(
                          getDefaultPriorityCode(taskPriorities),
                        );
                        setEditTaskDueDate("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      className="h-8 rounded-sm"
                      disabled={!editTaskTitle.trim()}
                    >
                      Save Changes
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="shrink-0 flex flex-wrap bg-white rounded-sm shadow-sm border border-gray-200 p-1.5 mb-3 gap-2">
        {/* Search Bar */}
        <div className="relative h-8 w-full sm:w-auto sm:min-w-[200px] sm:max-w-md flex-1 sm:flex-initial">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search quick tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-full min-h-8 max-h-8 box-border pl-10 pr-3 py-0 text-sm leading-none border border-gray-300 rounded-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <SearchableSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.value)}
            options={quickTaskStatusOptions}
            placeholder="Filter by Status"
            className="flex-1 sm:flex-initial min-w-[130px]"
            size="small"
            squareCorners
          />

          <SearchableSelect
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.value)}
            options={quickTaskPriorityOptions}
            placeholder="Filter by Priority"
            className="flex-1 sm:flex-initial min-w-[130px]"
            size="small"
            squareCorners
          />

          <SearchableSelect
            value={sortBy}
            onChange={(e) => setSortBy(e.value)}
            options={[
              { value: "createdAt", label: "Created Date" },
              { value: "title", label: "Title" },
              { value: "priority", label: "Priority" },
              { value: "dueDate", label: "Due Date" },
            ]}
            placeholder="Sort by"
            className="flex-1 sm:flex-initial min-w-[130px]"
            size="small"
            squareCorners
          />
        </div>
      </div>

      {/* Active Filters Display */}
      {(statusFilter !== "all" || priorityFilter !== "all" || searchTerm) && (
        <div className="shrink-0 card bg-blue-50 border-blue-200 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-blue-800">
                Active Filters:
              </span>
              <div className="flex flex-wrap gap-2">
                {searchTerm && (
                  <span className="inline-flex items-center h-8 px-2 py-0 rounded-sm text-xs font-medium bg-blue-100 text-blue-800">
                    Search: "{searchTerm}"
                    <button
                      onClick={() => setSearchTerm("")}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                )}
                {statusFilter !== "all" && (
                  <span className="inline-flex items-center h-8 px-2 py-0 rounded-sm text-xs font-medium bg-blue-100 text-blue-800">
                    Status: {statusFilter}
                    <button
                      onClick={() => setStatusFilter("all")}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                )}
                {priorityFilter !== "all" && (
                  <span className="inline-flex items-center h-8 px-2 py-0 rounded-sm text-xs font-medium bg-blue-100 text-blue-800">
                    Priority: {priorityFilter}
                    <button
                      onClick={() => setPriorityFilter("all")}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("all");
                setPriorityFilter("all");
              }}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear All Filters
            </button>
          </div>
        </div>
      )}

      {/* Scrollable list (header + filters stay fixed above) */}
      <div
        ref={taskListScrollRef}
        className="flex-1 min-h-0 overflow-y-auto"
      >
        {loading ? (
           <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <Loader className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-lg text-gray-600">Loading quick tasks...</p>
          </div>
        </div>

        ) : error ? (
          <div className="flex min-h-[240px] items-center justify-center py-10">
            <div className="text-center">
              <div className="text-red-500 text-lg mb-2">
                Error loading quick tasks
              </div>
              <div className="text-gray-500">{error}</div>
              <Button
                variant="primary"
                className="h-8 mt-3 rounded-sm"
                onClick={fetchQuickTasks}
              >
                Try Again
              </Button>
            </div>
          </div>
        ) : (
          <div className="card p-0 rounded-sm overflow-hidden">
            <div className="w-full overflow-x-auto">
              <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="px-6 py-2 h-10 text-left text-xs font-medium leading-none text-gray-500 uppercase tracking-wider w-12">
                    Status
                  </TableHead>
                  <TableHead className="px-6 py-2 h-10 text-left text-xs font-medium leading-none text-gray-500 uppercase tracking-wider">
                    Task Title
                  </TableHead>
                  <TableHead className="px-6 py-2 h-10 text-left text-xs font-medium leading-none text-gray-500 uppercase tracking-wider">
                    Priority
                  </TableHead>
                  <TableHead className="px-6 py-2 h-10 text-left text-xs font-medium leading-none text-gray-500 uppercase tracking-wider">
                    Due Date
                  </TableHead>
                  <TableHead className="px-6 py-2 h-10 text-left text-xs font-medium leading-none text-gray-500 uppercase tracking-wider">
                    Created
                  </TableHead>
                  <TableHead className="px-6 py-2 h-10 text-left text-xs font-medium leading-none text-gray-500 uppercase tracking-wider">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {sortedTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="px-6 py-6 text-center">
                      <div className="text-gray-500">
                        <div className="text-6xl mb-3">📝</div>
                        <h3 className="text-lg font-medium mb-2">
                          No quick tasks found
                        </h3>
                        <p className="text-sm mb-3">
                          {quickTasks.length === 0
                            ? "You don't have any quick tasks yet."
                            : "No tasks match your current filters."}
                        </p>
                        {quickTasks.length === 0 && (
                          <Button
                            variant="primary"
                            className="h-8 rounded-sm"
                            onClick={() => setShowCreateModal(true)}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Create your first quick task
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedTasks.map((task) => (
                    <TableRow
                      key={task.id ?? task._id}
                      data-quick-task-id={String(task.id ?? task._id ?? "")}
                      className={`${
                        task.status === "done" ? "opacity-75" : ""
                      } border-b`}
                    >
                      <TableCell className="px-6 py-2">
                        <button
                          onClick={() => handleMarkAsDone(task.id)}
                          disabled={task.status === "done"}
                          className={`${
                            task.status === "done"
                              ? "opacity-50 cursor-not-allowed"
                              : ""
                          }`}
                          title={
                            task.status === "done"
                              ? "Task completed"
                              : "Mark as done"
                          }
                        >
                          {getStatusIcon(task.status)}
                        </button>
                      </TableCell>

                      <TableCell className="px-6 py-2">
                        <div className="flex items-center gap-2">
                          {editingTaskId === task.id ? (
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onBlur={() => handleTitleSave(task.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleTitleSave(task.id);
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  handleTitleCancel();
                                }
                              }}
                              className="w-full h-8 px-2 py-0 border border-blue-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                            />
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`font-medium truncate max-w-[200px] ${
                                  task.status === "done"
                                    ? "text-gray-500 cursor-not-allowed"
                                    : "text-gray-900 cursor-pointer"
                                } h-8 px-2 py-0 rounded-sm`}
                                onClick={() =>
                                  task.status !== "done" &&
                                  handleTitleEdit(task)
                                }
                                title={
                                  task.status === "done"
                                    ? "Cannot edit completed tasks"
                                    : task.title
                                }
                              >
                                {task.title}
                              </span>
                              {task.convertedToTask?.isConverted && (
                                <span
                                  className="inline-flex items-center h-8 gap-1 px-2 py-0 text-xs font-medium bg-green-100 text-green-800 border border-green-300 rounded-sm"
                                  title={`Converted to task on ${new Date(
                                    task.convertedToTask.convertedAt,
                                  )
                                    .toLocaleDateString("en-GB", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    })
                                    .replace(",", "")}`}
                                >
                                  <svg
                                    className="w-3 h-3"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                  Converted
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="px-6 py-2">
                        <span
                          className={getPriorityBadgeClasses(task.priority)}
                        >
                          {task.priority.charAt(0).toUpperCase() +
                            task.priority.slice(1)}
                        </span>
                      </TableCell>

                      <TableCell className="px-6 py-2 text-sm text-gray-900">
                        {task.dueDate ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {new Date(task.dueDate)
                              .toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                              .replace(",", "")}
                          </div>
                        ) : (
                          <span className="text-gray-400">No due date</span>
                        )}
                      </TableCell>

                      <TableCell className="px-6 py-2 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {new Date(task.createdAt)
                            .toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                            .replace(",", "")}
                        </div>
                      </TableCell>

                      <TableCell className="px-6 py-2">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditModal(task)}
                            disabled={task.status === "done"}
                            className={`${
                              task.status === "done"
                                ? "text-gray-400 cursor-not-allowed opacity-50"
                                : "text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                            }`}
                            title={
                              task.status === "done"
                                ? "Cannot edit completed tasks"
                                : "Edit task"
                            }
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>

                          {!task.convertedToTask?.isConverted && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleConvertToTask(task)}
                              className="text-green-500 hover:text-green-700 hover:bg-green-50"
                              title="Convert to full task"
                            >
                              <ArrowRight className="w-4 h-4" />
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteTask(task.id)}
                            disabled={task.status === "done"}
                            className={`${
                              task.status === "done"
                                ? "text-gray-400 cursor-not-allowed opacity-50"
                                : "text-red-500 hover:text-red-700 hover:bg-red-50"
                            }`}
                            title={
                              task.status === "done"
                                ? "Cannot delete completed tasks"
                                : "Delete task"
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <CustomConfirmationModal
          isOpen={confirmModal.isOpen}
          type={confirmModal.type}
          title={confirmModal.title}
          message={confirmModal.message}
          squareCorners
          onConfirm={confirmModal.onConfirm}
          onClose={() =>
            setConfirmModal({
              isOpen: false,
              type: "",
              title: "",
              message: "",
              onConfirm: null,
              data: null,
            })
          }
          onCancel={() =>
            setConfirmModal({
              isOpen: false,
              type: "",
              title: "",
              message: "",
              onConfirm: null,
              data: null,
            })
          }
        />
      )}
    </div>
  );
}
