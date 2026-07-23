import React, { useMemo, useState } from "react";
import AssigneeSearchSelect from "../../components/common/AssigneeSearchSelect";

// Exported form model for recurring tasks (for RecurringTaskEdit.jsx)
export const recurringTaskFormModel = [
  {
    name: "title",
    label: "Task Title",
    type: "text",
    required: true,
    placeholder: "Enter task title",
    section: "info",
  },
  {
    name: "description",
    label: "Description",
    type: "textarea",
    required: false,
    placeholder: "Enter description",
    section: "info",
  },
  {
    name: "assignedTo",
    label: "Assigned To",
    type: "assignee-select",
    required: false,
    placeholder: "Search and select assignee...",
    section: "assignment",
  },
  {
    name: "priority",
    label: "Priority",
    type: "select",
    required: true,
    options: [
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
      { value: "critical", label: "Critical" },
    ],
    placeholder: "Select priority",
    section: "settings",
  },
  {
    name: "visibility",
    label: "Visibility",
    type: "select",
    required: false,
    options: [
      { value: "private", label: "Private" },
      { value: "public", label: "Public" },
    ],
    placeholder: "Select visibility",
    section: "settings",
  },
  {
    name: "frequency",
    label: "Frequency",
    type: "select",
    required: true,
    options: [
      { value: "daily", label: "Daily" },
      { value: "weekly", label: "Weekly" },
      { value: "monthly", label: "Monthly" },
      { value: "yearly", label: "Yearly" },
      { value: "custom", label: "Custom" },
    ],
    placeholder: "Select frequency",
    section: "settings",
  },
  {
    name: "startDate",
    label: "Start Date",
    type: "date",
    required: false,
    placeholder: "",
    section: "schedule",
  },
  {
    name: "dueTime",
    label: "Due Time",
    type: "time",
    required: false,
    placeholder: "17:00",
    section: "schedule",
  },
  {
    name: "tags",
    label: "Tags",
    type: "text",
    required: false,
    placeholder: "Comma separated tags",
    section: "tags",
  },
];
import { useActiveRole } from "../../components/RoleSwitcher";
import { useQuery } from "@tanstack/react-query";
import { useAssignmentOptions } from "../../features/shared/hooks/useAssignmentOptions";
import {
  Plus,
  Filter,
  Grid3X3,
  List,
  Pause,
  Play,
  Edit3,
  Trash2,
  Calendar,
  Clock,
  Tag,
  MoreVertical,
  MoreVerticalIcon,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { RecurringTaskIcon } from "../../components/common/TaskIcons";
import { apiClient } from "../../utils/apiClient";
import SafeHtml, { getTextPreview } from "../../components/common/SafeHtml";
import CustomEditor from "../../components/common/CustomEditor";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useShowToast } from "../../utils/ToastMessage";
const RecurringTaskManager = () => {
  const { showSuccessToast, showErrorToast } = useShowToast();
  const { canAssignToOthers } = useAssignmentOptions();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | paused
  const [priorityFilter, setPriorityFilter] = useState("all"); // all | low | medium | high
  const [frequencyFilter, setFrequencyFilter] = useState("all"); // all | daily | weekly | monthly | yearly | custom
  const [dueDateFilter, setDueDateFilter] = useState("all");
  const [viewMode, setViewMode] = useState("list"); // grid | list
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit] = useState(20);

  // Local tasks state for immediate UI updates
  const [localTasks, setLocalTasks] = useState(null);

  // Edit modal state
  const [editingTask, setEditingTask] = useState(null);
  // Initialize editForm with all fields from recurringTaskFormModel
  const initialEditForm = {
    ...Object.fromEntries(
      recurringTaskFormModel.map((field) => [field.name, ""]),
    ),
    tags: [], // Tags as array for chip display
    tagInput: "", // Input field for adding new tags
  };
  const [editForm, setEditForm] = useState(initialEditForm);
  const [editLoading, setEditLoading] = useState(false);

  // Delete confirmation modal state
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    isOpen: false,
    taskId: null,
    taskTitle: "",
  });
  const [deleteError, setDeleteError] = useState(null);

  // Edit confirmation modal state
  const [editConfirmation, setEditConfirmation] = useState({
    isOpen: false,
    task: null,
  });

  // ✅ Helper: Get pattern-specific fields based on frequency type
  const getPatternSpecificFields = (frequency) => {
    const baseFields = [
      "title",
      "description",
      "assignedTo",
      "priority",
      "visibility",
      "dueTime",
      "endCondition",
    ];

    console.log("🔍 [PATTERN FIELDS] Getting fields for frequency:", frequency);

    switch (frequency?.toLowerCase()) {
      case "daily":
        return [...baseFields];
      case "weekly":
        return [...baseFields]; // Day of Week, Position, Weekday are disabled/display only
      case "monthly":
        return [...baseFields]; // Monthly Mode, Weekday, Specific Date are disabled/display only
      case "yearly":
        return [...baseFields]; // Month, Day of Month are disabled/display only
      case "custom":
        return [...baseFields]; // Custom Dates are disabled/display only
      default:
        return baseFields;
    }
  };

  // ✅ Helper: Get disabled fields for each pattern type
  const getDisabledFieldsForPattern = (frequency) => {
    const disabledFields = ["frequency", "startDate"]; // Always disabled

    switch (frequency?.toLowerCase()) {
      case "daily":
        return disabledFields;
      case "weekly":
        return [...disabledFields, "weekday", "position"]; // Day of week controls disabled
      case "monthly":
        return [...disabledFields, "monthlyMode", "weekday", "specificDate"]; // Monthly controls disabled
      case "yearly":
        return [...disabledFields, "month", "dayOfMonth"]; // Yearly controls disabled
      case "custom":
        return [...disabledFields]; // Custom dates display only (can add, not delete)
      default:
        return disabledFields;
    }
  };

  // Fetch recurring tasks from API
  const {
    data: apiResponse,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      "recurring-tasks",
      currentPage,
      pageLimit,
      statusFilter,
      priorityFilter,
      searchTerm,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageLimit.toString(),
      });

      // Add filters if they're not 'all'
      if (statusFilter !== "all") {
        // ✅ Map status filter to API status using EXACT uppercase values
        // Backend expects: OPEN, INPROGRESS, ONHOLD, DONE, CANCELLED
        const statusMap = {
          active: "OPEN", // Active recurring tasks are in OPEN status
          paused: "ONHOLD", // Paused recurring tasks are in ONHOLD status
        };
        if (statusMap[statusFilter]) {
          params.append("status", statusMap[statusFilter]);
        }
      }

      if (priorityFilter !== "all") {
        params.append("priority", priorityFilter);
      }

      if (searchTerm.trim()) {
        params.append("search", searchTerm.trim());
      }

      const response = await apiClient.get(
        `/api/tasks/filter/recurring?${params.toString()}`,
      );
      console.log("Full API Response:", response);
      console.log("Response data structure:", {
        hasSuccess: !!response.success,
        hasData: !!response.data,
        hasTasks: !!response.data?.tasks,
        tasksLength: response.data?.tasks?.length,
        fullData: response.data,
      });
      return response;
    },
    retry: 1,
    staleTime: 0,
  });

  // Transform API data to match component expectations
  const transformApiTask = (apiTask) => {
    console.log("Transforming API task:", apiTask);
    const transformed = {
      id: apiTask._id,
      title: apiTask.title,
      description: apiTask.description,
      frequency: apiTask.recurrencePattern?.frequency || "daily", // Map from API recurrence pattern
      nextDue: apiTask.dueDate || apiTask.nextDueDate,
      // ✅ Map status to isActive using EXACT uppercase values
      // Backend stores: OPEN, INPROGRESS, ONHOLD, DONE, CANCELLED
      // isActive = true when status is NOT ONHOLD or CANCELLED
      isActive: apiTask.status !== "ONHOLD" && apiTask.status !== "CANCELLED",
      priority: apiTask.priority,
      timeEstimate:
        apiTask.timeEstimate || apiTask.customFields?.estimatedTime || null,
      estimatedTime:
        apiTask.timeEstimate || apiTask.customFields?.estimatedTime || null,
      tags: apiTask.tags || [],
      createdBy: apiTask.createdBy
        ? `${apiTask.createdBy.firstName} ${apiTask.createdBy.lastName}`
        : "Unknown",
      createdByRole: apiTask.createdByRole || ["employee"], // User role who created the task
      lastGenerated: apiTask.updatedAt,
      status: apiTask.status,
      category: apiTask.category,
      visibility: apiTask.visibility,
      attachments: apiTask.attachments || [],
      // Additional API fields that might be useful
      _id: apiTask._id,
      organization: apiTask.organization,
      assignedTo: apiTask.assignedTo,
      createdAt: apiTask.createdAt,
      updatedAt: apiTask.updatedAt,
      isRecurring: apiTask.isRecurring,
      recurrencePattern: apiTask.recurrencePattern,
    };
    console.log("Transformed task:", transformed);
    return transformed;
  };

  // Get tasks from API or fallback to mock data
  console.log("apiResponse:", apiResponse);
  console.log("Checking data paths:", {
    "apiResponse?.data": !!apiResponse?.data,
    "apiResponse?.data?.tasks": !!apiResponse?.data?.tasks,
    "apiResponse?.data?.data": !!apiResponse?.data?.data,
    "apiResponse?.data?.data?.tasks": !!apiResponse?.data?.data?.tasks,
    tasksFromDirectPath: apiResponse?.data?.tasks,
    tasksFromNestedPath: apiResponse?.data?.data?.tasks,
  });

  // Get active role from context
  const { activeRole } = useActiveRole();
  // Fallback to first available role if not set
  const currentRole =
    activeRole ||
    Object.keys(apiResponse?.data?.data?.roles || {})[0] ||
    "employee";

  // Get tasks for current role from API response
  const tasksArray = apiResponse?.data?.data?.roles?.[currentRole] || [];
  console.log("Final tasks array:", tasksArray);

  const recurringTasks = tasksArray.map(transformApiTask) || [];
  const pagination = apiResponse?.data?.data?.pagination || {};
  const summary = apiResponse?.data?.data?.summary || {};

  const currentTasks =
    localTasks ??
    (recurringTasks && recurringTasks.length > 0 ? recurringTasks : []);

  const getFrequencyLabel = (frequency) => {
    const labels = {
      daily: "Daily",
      weekly: "Weekly",
      monthly: "Monthly",
      yearly: "Yearly",
      custom: "Custom",
    };
    return labels[frequency] || frequency || "Not Set";
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: "bg-green-100 text-green-800 border-green-200",
      medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
      high: "bg-orange-100 text-orange-800 border-orange-200",
    };
    return colors[priority] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  const getStatusPill = (isActive) => {
    return isActive
      ? "bg-green-100 text-green-800 border-green-200"
      : "bg-gray-100 text-gray-800 border-gray-200";
  };

  const now = new Date();
  const inDays = (dateStr) => {
    const d = new Date(dateStr);
    return Math.ceil((d - now) / (1000 * 60 * 60 * 24));
  };

  const stats = useMemo(() => {
    console.log("Stats calculation - currentTasks:", currentTasks);
    console.log("Stats calculation - apiResponse:", apiResponse);

    // Use currentTasks which includes local updates
    const activeTasks = currentTasks;

    // Use real data from API if available, otherwise calculate from current tasks
    if (apiResponse?.data?.data?.summary && !localTasks) {
      const apiSummary = apiResponse.data.data.summary;
      const total = apiSummary.totalCount || activeTasks.length;
      const active = activeTasks.filter((t) => t.isActive).length;
      const paused = activeTasks.filter((t) => !t.isActive).length;
      const overdue = activeTasks.filter(
        (t) => t.nextDue && new Date(t.nextDue) < now,
      ).length;
      const dueSoon = activeTasks.filter(
        (t) => t.nextDue && inDays(t.nextDue) >= 0 && inDays(t.nextDue) <= 7,
      ).length;
      return { total, active, paused, overdue, dueSoon };
    } else {
      // Fallback to calculating from current tasks (includes local updates)
      const total = activeTasks.length;
      const active = activeTasks.filter((t) => t.isActive).length;
      const paused = activeTasks.filter((t) => !t.isActive).length;
      const overdue = activeTasks.filter(
        (t) => t.nextDue && new Date(t.nextDue) < now,
      ).length;
      const dueSoon = activeTasks.filter(
        (t) => t.nextDue && inDays(t.nextDue) >= 0 && inDays(t.nextDue) <= 7,
      ).length;
      return { total, active, paused, overdue, dueSoon };
    }
  }, [currentTasks, apiResponse, localTasks]);

  const filteredTasks = currentTasks.filter((task) => {
    const matchesSearch =
      !searchTerm ||
      task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && task.isActive) ||
      (statusFilter === "paused" && !task.isActive);

    const matchesPriority =
      priorityFilter === "all" || task.priority === priorityFilter;

    const matchesFrequency =
      frequencyFilter === "all" || task.frequency === frequencyFilter;

    let matchesDueDate = true;
    if (dueDateFilter !== "all" && task.nextDue) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(task.nextDue);
      dueDate.setHours(0, 0, 0, 0);
      const timeDiff = dueDate.getTime() - today.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
      switch (dueDateFilter) {
        case "overdue":
          matchesDueDate = daysDiff < 0;
          break;
        case "due_today":
          matchesDueDate = daysDiff === 0;
          break;
        case "due_tomorrow":
          matchesDueDate = daysDiff === 1;
          break;
        case "due_this_week":
          matchesDueDate = daysDiff >= 0 && daysDiff <= 7;
          break;
        case "due_next_week":
          matchesDueDate = daysDiff > 7 && daysDiff <= 14;
          break;
        case "due_this_month":
          matchesDueDate = daysDiff >= 0 && daysDiff <= 30;
          break;
        case "no_due_date":
          matchesDueDate = false;
          break;
        default:
          matchesDueDate = true;
      }
    } else if (dueDateFilter === "no_due_date") {
      matchesDueDate = !task.nextDue;
    }

    return (
      matchesSearch &&
      matchesStatus &&
      matchesPriority &&
      matchesFrequency &&
      matchesDueDate
    );
  });

  const handleToggleActive = async (id) => {
    try {
      const task = currentTasks.find((t) => t.id === id || t._id === id);
      if (!task) return;

      // ✅ Use EXACT uppercase status values as expected by backend
      // Backend expects: OPEN, INPROGRESS, ONHOLD, DONE, CANCELLED
      const newStatus = task.isActive ? "ONHOLD" : "OPEN";

      // Update local state immediately for better UX
      setLocalTasks((prev) => {
        const currentList = prev ?? currentTasks;
        return currentList.map((t) =>
          t.id === id || t._id === id
            ? { ...t, isActive: !t.isActive, status: newStatus }
            : t,
        );
      });

      await apiClient.patch(`/api/tasks/${task._id || id}/status`, {
        status: newStatus,
      });

      // Show success message
      showSuccessToast(
        `Task "${task.title}" ${
          newStatus === "ONHOLD" ? "paused" : "activated"
        } successfully!`,
      );

      // Background sync to ensure consistency
      refetch();
    } catch (error) {
      console.error("Error toggling task status:", error);
      showErrorToast(error.message || "Unable to update task status");
      // Revert local changes on error
      setLocalTasks((prev) => {
        const currentList = prev ?? currentTasks;
        return currentList.map((t) =>
          t.id === id || t._id === id ? { ...t, isActive: !t.isActive } : t,
        );
      });
    }
  };

  const handleEdit = (id) => {
    const task = currentTasks.find((t) => t.id === id || t._id === id);
    if (!task) return;

    // Show edit confirmation first
    setEditConfirmation({
      isOpen: true,
      task: task,
    });
  };

  const confirmEditModal = (task) => {
    setEditingTask(task);
    // Populate editForm with all fields from recurringTaskFormModel
    const newForm = {};
    recurringTaskFormModel.forEach((field) => {
      if (field.name === "tags") {
        newForm.tags = Array.isArray(task.tags) ? task.tags : [];
        newForm.tagInput = ""; // Initialize tag input field
      } else if (field.name === "estimatedTime") {
        newForm.estimatedTime = task.estimatedTime || "";
      } else if (field.name === "nextDue") {
        newForm.nextDue = task.nextDue
          ? new Date(task.nextDue).toISOString().slice(0, 10)
          : "";
      } else if (field.name === "assignedTo") {
        // Format assignedTo for AssigneeSearchSelect (needs {value, label} object)
        const assignedToValue =
          task.assignedTo && (task.assignedTo._id || task.assignedTo.value)
            ? {
                value:
                  task.assignedTo._id ||
                  task.assignedTo.value ||
                  task.assignedTo,
                label:
                  task.assignedTo.label ||
                  (task.assignedTo.firstName && task.assignedTo.lastName
                    ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}`
                    : "Assigned User"),
              }
            : null;
        newForm.assignedTo = assignedToValue;
        newForm.assignedToId =
          task.assignedTo?._id ||
          task.assignedTo?.value ||
          task.assignedTo ||
          "";
      } else if (field.name === "visibility") {
        newForm.visibility = (task.visibility || "private").toLowerCase();
      } else if (field.name === "frequency") {
        newForm.frequency = (
          task.frequency ||
          task.recurrencePattern?.frequency ||
          "daily"
        ).toLowerCase();
      } else if (field.name === "priority") {
        newForm.priority = (task.priority || "medium").toLowerCase();
      } else if (field.name === "startDate") {
        newForm.startDate = task.createdAt
          ? new Date(task.createdAt).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10);
      } else if (field.name === "dueTime") {
        newForm.dueTime = "17:00";
      } else {
        newForm[field.name] = task[field.name] || "";
      }
    });
    setEditForm(newForm);

    // Close edit confirmation
    setEditConfirmation({
      isOpen: false,
      task: null,
    });
  };

  const handleEditFormChange = (nameOrEvent, valueOrUndefined) => {
    // Support both event objects and direct name/value calls
    if (typeof nameOrEvent === "object" && nameOrEvent.target) {
      // Event object from input/select/textarea
      const { name, value, type } = nameOrEvent.target;
      let v = type === "number" ? Number(value) : value;
      if (name === "title" && typeof v === "string") v = v.slice(0, 100);
      setEditForm((prev) => ({
        ...prev,
        [name]: v,
      }));
    } else {
      // Direct name/value call (for AssigneeSearchSelect)
      const name = nameOrEvent;
      let value = valueOrUndefined;
      if (name === "title" && typeof value === "string")
        value = value.slice(0, 100);
      setEditForm((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // Tag management handlers
  const handleEditAddTag = (tagValue) => {
    const trimmedTag = tagValue.trim();
    if (trimmedTag && !editForm.tags.includes(trimmedTag)) {
      setEditForm((prev) => ({
        ...prev,
        tags: [...prev.tags, trimmedTag],
        tagInput: "",
      }));
    }
  };

  const handleEditRemoveTag = (tagToRemove) => {
    setEditForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const handleEditTagsKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleEditAddTag(editForm.tagInput);
    }
  };

  const handleEditFormSubmit = async (e) => {
    e.preventDefault();
    if (!editingTask) return;
    setEditLoading(true);
    try {
      // Prepare payload from editForm using the correct API format
      const payload = {};

      // Extract assignedTo ID from object format
      let assignedToId = "";
      if (editForm.assignedTo && typeof editForm.assignedTo === "object") {
        assignedToId =
          editForm.assignedTo.value ||
          editForm.assignedTo._id ||
          editForm.assignedTo.id ||
          "";
      } else if (editForm.assignedToId) {
        assignedToId = editForm.assignedToId;
      }

      recurringTaskFormModel.forEach((field) => {
        if (field.name === "tags") {
          payload.tags = Array.isArray(editForm.tags) ? editForm.tags : [];
        } else if (field.name === "assignedTo") {
          payload.assignedTo = assignedToId;
        } else if (field.name === "frequency") {
          payload.recurrencePattern = {
            frequency: editForm.frequency || "daily",
            interval: 1,
          };
        } else if (field.name === "visibility") {
          payload.visibility = editForm.visibility || "private";
        } else if (field.name === "title") {
          payload.title = editForm[field.name];
        } else if (field.name === "startDate") {
          // Start date is part of recurrence pattern
          payload.recurrencePattern = payload.recurrencePattern || {};
          payload.recurrencePattern.startDate = editForm.startDate;
          // Also update dueDate to match the new start date for recurring tasks
          payload.dueDate = editForm.startDate;
        } else if (field.name === "dueTime") {
          // Due time for recurring tasks
          payload.dueTime = editForm.dueTime || "17:00";
        } else if (field.name !== "assignedToId") {
          payload[field.name] = editForm[field.name];
        }
      });

      // Use PUT method with correct endpoint
      console.log("Sending update request with payload:", payload);
      const response = await apiClient.put(
        `/api/tasks/${editingTask._id || editingTask.id}`,
        payload,
      );
      console.log("Update response:", response);

      // Check if response is successful (axios returns status 200-299 as success)
      if (response.status >= 200 && response.status < 300) {
        // Check if response has explicit success field or assume success based on status
        const isSuccess = response.data.success !== false; // Consider success unless explicitly false

        if (isSuccess) {
          // Update local tasks state immediately for better UX
          const updatedTask = {
            ...editingTask,
            title: editForm.title,
            description: editForm.description,
            priority: editForm.priority,
            frequency: editForm.frequency,
            nextDue: editForm.nextDue,
            estimatedTime: editForm.estimatedTime,
            tags: Array.isArray(editForm.tags) ? editForm.tags : [],
          };

          setLocalTasks((prev) => {
            const currentList = prev ?? currentTasks;
            return currentList.map((task) =>
              task.id === editingTask.id || task._id === editingTask._id
                ? updatedTask
                : task,
            );
          });

          // Show success message
          showSuccessToast(`Task "${editForm.title}" updated`);

          // Close modal automatically
          setEditingTask(null);

          // Background sync to ensure consistency (after UI update for better UX)
          setTimeout(() => {
            refetch();
          }, 500);
        } else {
          const errorMessage =
            response.data?.message || "Failed to update task.";
          showErrorToast(errorMessage);
        }
      }
    } catch (error) {
      console.error("Error updating recurring task:", error);

      // Handle different error response structures
      let errorMessage = "Error updating recurring task.";
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }

      showErrorToast(errorMessage);
    }
    setEditLoading(false);
  };

  const handleEditModalClose = () => {
    setEditingTask(null);
  };

  const handleDelete = async (id) => {
    const task = currentTasks.find((t) => t.id === id || t._id === id);
    if (!task) return;

    // Show delete confirmation
    setDeleteConfirmation({
      isOpen: true,
      taskId: id,
      taskTitle: task.title,
    });
  };

  const confirmDelete = async (taskId) => {
    try {
      const task = currentTasks.find(
        (t) => t.id === taskId || t._id === taskId,
      );
      const actualTaskId = task?._id || taskId;

      console.log("Deleting task with ID:", actualTaskId);
      console.log("Delete API URL:", `/api/tasks/delete/${actualTaskId}`);

      const response = await apiClient.delete(
        `/api/tasks/delete/${actualTaskId}`,
      );
      console.log("Delete response:", response);

      // Update local state after successful deletion
      setLocalTasks((prev) => {
        const currentList = prev ?? currentTasks;
        return currentList.filter((t) => t.id !== taskId && t._id !== taskId);
      });

      // Close confirmation modal
      setDeleteConfirmation({
        isOpen: false,
        taskId: null,
        taskTitle: "",
      });
      setDeleteError(null);

      // Show success message
      showSuccessToast(
        `Task "${deleteConfirmation.taskTitle}" deleted successfully!`,
      );

      // Background sync to ensure consistency
      refetch();
      console.log("Task deleted successfully, refetching data...");
    } catch (error) {
      console.error("Error deleting task:", error);
      console.error("Error details:", error.response?.data || error.message);
      const errorMsg = error.response?.data?.message || error.message;
      setDeleteError(errorMsg);

      // Revert local changes on error - refetch to get current state
      refetch();
    }
  };

  const handleCreateNew = () => {
    window.location.href = "/tasks/create?type=recurring";
  };

  // Handle search with debounced API calls
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page when searching
  };

  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handlePriorityFilterChange = (e) => {
    setPriorityFilter(e.target.value);
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  // Show loading state
  if (isLoading && !currentTasks.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-3"></div>
          <p className="text-gray-600">Loading recurring tasks...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !currentTasks.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-3">
            Error loading recurring tasks: {error.message}
          </p>
          <Button
            variant="primary"
            onClick={() => refetch()}
            className="h-9 bg-purple-600 hover:bg-purple-700"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Delete Confirmation Modal */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-sm shadow-lg w-full max-w-md p-4">
            <h2 className="text-xl font-bold text-red-600 mb-3">
              Confirm Delete
            </h2>
            {deleteError ? (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-sm">
                <p className="text-red-700 text-sm font-medium">
                  {deleteError}
                </p>
              </div>
            ) : (
              <p className="text-gray-700 mb-3">
                Are you sure you want to delete the recurring task "
                <strong>{deleteConfirmation.taskTitle}</strong>"? This action
                cannot be undone.
              </p>
            )}
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                className="h-9"
                onClick={() => {
                  setDeleteConfirmation({
                    isOpen: false,
                    taskId: null,
                    taskTitle: "",
                  });
                  setDeleteError(null);
                }}
              >
                Cancel
              </Button>
              {!deleteError && (
                <Button
                  variant="destructive"
                  className="h-9"
                  onClick={() => confirmDelete(deleteConfirmation.taskId)}
                >
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Confirmation Modal */}
      {editConfirmation.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-sm shadow-lg w-full max-w-md p-4">
            <h2 className="text-xl font-bold text-purple-600 mb-3">
              Confirm Edit
            </h2>
            <p className="text-gray-700 mb-3">
              Do you want to edit the recurring task "
              <strong>{editConfirmation.task?.title}</strong>"?
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                className="h-9"
                onClick={() =>
                  setEditConfirmation({ isOpen: false, task: null })
                }
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="h-9 bg-purple-600 hover:bg-purple-700"
                onClick={() => confirmEditModal(editConfirmation.task)}
              >
                Continue to Edit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 p-4">
          <div
            className="bg-white rounded-sm shadow-lg w-full max-w-3xl relative flex flex-col"
            style={{ maxHeight: "90vh" }}
          >
            {/* Modal Header */}
            <div className="px-6 pt-6 pb-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-sm bg-purple-100 flex items-center justify-center">
                    <RecurringTaskIcon className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Edit Recurring Task
                    </h2>
                    <p className="text-sm text-gray-500">
                      Update task details and settings
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="p-2 hover:bg-gray-100 rounded-sm transition-colors"
                  onClick={handleEditModalClose}
                  aria-label="Close"
                  type="button"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </Button>
              </div>
            </div>

            {/* Modal Body */}
            <form
              onSubmit={handleEditFormSubmit}
              className="flex-1 overflow-y-auto px-6 py-4"
            >
              <div className="space-y-3">
                {/* Task Information Section */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                    Task Information
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    {recurringTaskFormModel
                      .filter((f) => f.section === "info")
                      .map((field) => (
                        <div key={field.name}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {field.label}
                            {field.required && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </label>
                          {field.type === "textarea" ? (
                            <CustomEditor
                              value={editForm[field.name] || ""}
                              onChange={(value) => {
                                handleEditFormChange({
                                  target: { name: field.name, value },
                                });
                              }}
                              placeholder={field.placeholder}
                              className="w-full"
                            />
                          ) : (
                            <input
                              type={field.type}
                              name={field.name}
                              value={editForm[field.name] || ""}
                              onChange={handleEditFormChange}
                              maxLength={
                                field.name === "title" ? 100 : undefined
                              }
                              className="w-full border border-gray-300 rounded-md h-9 px-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              required={field.required}
                              placeholder={field.placeholder}
                            />
                          )}
                        </div>
                      ))}
                  </div>
                </div>

                {/* Assignment Section */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                    Assignment
                  </h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Assigned To
                    </label>
                    <AssigneeSearchSelect
                      value={editForm.assignedTo}
                      onChange={(selectedOption) => {
                        handleEditFormChange("assignedTo", selectedOption);
                        handleEditFormChange(
                          "assignedToId",
                          selectedOption?.value || "",
                        );
                      }}
                      placeholder="Search and select assignee..."
                      isClearable={true}
                      skipClearOnRoleChange={true}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Search by name, email, department, or designation
                    </p>
                  </div>
                </div>

                {/* Task Settings Section */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                    Task Settings
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    {recurringTaskFormModel
                      .filter((f) => f.section === "settings")
                      .map((field) => {
                        // ✅ Disable Frequency field (show as display-only)
                        const isFrequencyField = field.name === "frequency";
                        const isDisabled = isFrequencyField;

                        return (
                          <div key={field.name}>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {field.label}
                              {field.required && (
                                <span className="text-red-500 ml-1">*</span>
                              )}
                              {isFrequencyField && (
                                <span className="text-xs text-gray-500 ml-2">
                                  (Cannot be changed)
                                </span>
                              )}
                            </label>
                            <select
                              name={field.name}
                              value={editForm[field.name] || ""}
                              onChange={handleEditFormChange}
                              disabled={isDisabled}
                              className={`w-full border border-gray-300 rounded-md h-9 px-3 transition-colors ${
                                isDisabled
                                  ? "bg-gray-100 cursor-not-allowed opacity-60"
                                  : "focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              }`}
                              required={field.required}
                            >
                              <option value="">{field.placeholder}</option>
                              {field.options?.map((opt) => {
                                // Show only Private for individual users, both options for org users
                                if (
                                  field.name === "visibility" &&
                                  !canAssignToOthers &&
                                  opt.value === "public"
                                ) {
                                  return null;
                                }
                                return (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                );
                              })}
                            </select>
                            {isFrequencyField && (
                              <p className="text-xs text-gray-500 mt-1">
                                Pattern Type:{" "}
                                <strong>
                                  {editForm.frequency || "Not set"}
                                </strong>{" "}
                                (Selected at creation)
                              </p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                  <p className="text-xs text-gray-500">
                    Configure priority (Low, Medium, High, Critical) and
                    visibility (Private{canAssignToOthers ? ", Public" : ""}).
                    Pattern frequency cannot be changed after creation.
                  </p>
                </div>

                {/* Pattern Details Section - Show pattern-specific fields based on frequency */}
                {editForm.frequency && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                      Pattern Details (
                      {editForm.frequency.charAt(0).toUpperCase() +
                        editForm.frequency.slice(1)}
                      )
                    </h3>
                    {"weekly".includes(editForm.frequency?.toLowerCase()) && (
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Days of Week
                            <span className="text-xs text-gray-500 ml-2">
                              (Fixed from creation)
                            </span>
                          </label>
                          <div className="w-full border border-gray-300 rounded-md p-2 bg-gray-100 cursor-not-allowed opacity-60">
                            <p className="text-sm text-gray-600">
                              {editForm.weekdays && editForm.weekdays.length > 0
                                ? editForm.weekdays.join(", ")
                                : "Not specified"}
                            </p>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Position
                            <span className="text-xs text-gray-500 ml-2">
                              (Fixed from creation)
                            </span>
                          </label>
                          <input
                            type="text"
                            disabled={true}
                            value={editForm.position || ""}
                            className="w-full border border-gray-300 rounded-md h-9 px-3 bg-gray-100 cursor-not-allowed opacity-60"
                            placeholder="Not specified"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Weekday
                            <span className="text-xs text-gray-500 ml-2">
                              (Fixed from creation)
                            </span>
                          </label>
                          <input
                            type="text"
                            disabled={true}
                            value={editForm.monthWeekday || ""}
                            className="w-full border border-gray-300 rounded-md h-9 px-3 bg-gray-100 cursor-not-allowed opacity-60"
                            placeholder="Not specified"
                          />
                        </div>
                      </div>
                    )}

                    {"monthly".includes(editForm.frequency?.toLowerCase()) && (
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Monthly Mode
                            <span className="text-xs text-gray-500 ml-2">
                              (Fixed from creation)
                            </span>
                          </label>
                          <input
                            type="text"
                            disabled={true}
                            value={editForm.monthlyMode || "specific_date"}
                            className="w-full border border-gray-300 rounded-md h-9 px-3 bg-gray-100 cursor-not-allowed opacity-60"
                            placeholder="specific_date or by_position"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Weekday
                            <span className="text-xs text-gray-500 ml-2">
                              (Fixed from creation)
                            </span>
                          </label>
                          <input
                            type="text"
                            disabled={true}
                            value={editForm.monthWeekday || ""}
                            className="w-full border border-gray-300 rounded-md h-9 px-3 bg-gray-100 cursor-not-allowed opacity-60"
                            placeholder="Not specified"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Specific Date (Day)
                            <span className="text-xs text-gray-500 ml-2">
                              (Fixed from creation)
                            </span>
                          </label>
                          <input
                            type="text"
                            disabled={true}
                            value={editForm.specificDate || ""}
                            className="w-full border border-gray-300 rounded-md h-9 px-3 bg-gray-100 cursor-not-allowed opacity-60"
                            placeholder="Day of month"
                          />
                        </div>
                      </div>
                    )}

                    {"yearly".includes(editForm.frequency?.toLowerCase()) && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Month
                            <span className="text-xs text-gray-500 ml-2">
                              (Fixed from creation)
                            </span>
                          </label>
                          <input
                            type="text"
                            disabled={true}
                            value={editForm.month || ""}
                            className="w-full border border-gray-300 rounded-md h-9 px-3 bg-gray-100 cursor-not-allowed opacity-60"
                            placeholder="Month name or number"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Day of Month
                            <span className="text-xs text-gray-500 ml-2">
                              (Fixed from creation)
                            </span>
                          </label>
                          <input
                            type="text"
                            disabled={true}
                            value={editForm.dayOfMonth || ""}
                            className="w-full border border-gray-300 rounded-md h-9 px-3 bg-gray-100 cursor-not-allowed opacity-60"
                            placeholder="Day of month"
                          />
                        </div>
                      </div>
                    )}

                    {"custom".includes(editForm.frequency?.toLowerCase()) && (
                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Custom Dates
                          <span className="text-xs text-gray-500 ml-2">
                            (View only - Cannot delete existing dates)
                          </span>
                        </label>
                        <div className="w-full border border-gray-300 rounded-md p-3 bg-gray-50 min-h-12">
                          {editForm.customDates &&
                          editForm.customDates.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {editForm.customDates.map((date, idx) => (
                                <span
                                  key={date + idx}
                                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 border border-blue-300"
                                >
                                  {new Date(date).toLocaleDateString()}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">
                              No custom dates specified
                            </p>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          Custom dates were set at creation and cannot be
                          modified in edit mode
                        </p>
                      </div>
                    )}

                    {!["weekly", "monthly", "yearly", "custom"].includes(
                      editForm.frequency?.toLowerCase(),
                    ) && (
                      <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded border border-blue-200">
                        {editForm.frequency.charAt(0).toUpperCase() +
                          editForm.frequency.slice(1)}{" "}
                        pattern uses standard recurrence settings with no
                        additional controls needed.
                      </p>
                    )}
                  </div>
                )}

                {/* Schedule Section - Only Due Time (remove Start Date) */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                    Time & End Condition
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {recurringTaskFormModel
                      .filter(
                        (f) =>
                          f.section === "schedule" && f.name !== "startDate",
                      )
                      .map((field) => (
                        <div key={field.name}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {field.label}
                            {field.required && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </label>
                          <input
                            type={field.type}
                            name={field.name}
                            value={
                              editForm[field.name] ||
                              (field.name === "dueTime" ? "17:00" : "")
                            }
                            onChange={handleEditFormChange}
                            className="w-full border border-gray-300 rounded-md h-9 px-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            required={field.required}
                            placeholder={field.placeholder}
                            {...(field.name === "startDate" && {
                              min: new Date().toISOString().split("T")[0],
                            })}
                          />
                          {field.name === "startDate" && (
                            <p className="text-xs text-gray-500 mt-1">
                              When the recurring task pattern starts
                            </p>
                          )}
                          {field.name === "dueTime" && (
                            <p className="text-xs text-gray-500 mt-1">
                              Time when task instances are due (default: 5 PM)
                            </p>
                          )}
                        </div>
                      ))}
                  </div>
                </div>

                {/* Tags Section */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                    Tags
                  </h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Labels / Tags
                    </label>
                    <div className="space-y-2">
                      <div className="relative">
                        <input
                          type="text"
                          value={editForm.tagInput || ""}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              tagInput: e.target.value,
                            }))
                          }
                          onKeyDown={handleEditTagsKeyDown}
                          placeholder="Type tag and press Enter or comma..."
                          className="w-full h-9 px-3 pr-10 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                        <Button
                          type="button"
                          onClick={() => handleEditAddTag(editForm.tagInput)}
                          variant="primary"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 bg-purple-600 hover:bg-purple-700"
                          title="Add tag"
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
                        </Button>
                      </div>
                      {editForm.tags && editForm.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                          {editForm.tags.map((tag, idx) => (
                            <span
                              key={tag + idx}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                            >
                              {tag}
                              <Button
                                type="button"
                                onClick={() => handleEditRemoveTag(tag)}
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 p-0 hover:text-purple-900"
                              >
                                ×
                              </Button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleEditModalClose}
                  className="h-9"
                  disabled={editLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  onClick={handleEditFormSubmit}
                  className="h-9 bg-purple-600 hover:bg-purple-700"
                  disabled={editLoading}
                >
                  {editLoading ? (
                    <span className="flex items-center">
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="h-12 w-12 rounded-sm bg-purple-500 flex items-center justify-center">
                <RecurringTaskIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Recurring Tasks
                </h1>
                <p className="text-sm text-gray-600">
                  Manage recurring task templates and schedules
                </p>
              </div>
            </div>
            <div className="w-full sm:w-auto flex justify-center sm:justify-start">
              <Button
                variant="primary"
                className="h-9 w-full sm:w-auto bg-purple-600 hover:bg-purple-700"
                onClick={handleCreateNew}
                data-testid="button-create-recurring-task"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Recurring Task
              </Button>
            </div>
          </div>

          {/* Loading indicator and refresh button */}
          <div className="flex items-center justify-between">
            {isLoading && (
              <div className="flex items-center text-sm text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600 mr-2"></div>
                Loading recurring tasks...
              </div>
            )}

            {error && (
              <div className="flex items-center text-sm text-red-600">
                <span className="mr-2">Error loading tasks</span>
                <Button
                  variant="ghost"
                  className="h-7 text-purple-600 hover:text-purple-700 underline"
                  onClick={() => refetch()}
                >
                  Retry
                </Button>
              </div>
            )}

            {/* {!isLoading && !error && (
              <button
                onClick={() => refetch()}
                className="text-sm text-gray-600 hover:text-gray-800"
                title="Refresh tasks"
              >
                🔄 Refresh
              </button>
            )} */}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-3 px-6 overflow-x-hidden">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
          <div className="bg-white rounded-md shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.total}
                </p>
              </div>
              <RecurringTaskIcon className="h-8 w-8 text-gray-400" />
            </div>
          </div>
          <div className="bg-white rounded-md shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.active}
                </p>
              </div>
              <Play className="h-8 w-8 text-green-400" />
            </div>
          </div>
          <div className="bg-white rounded-md shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Paused</p>
                <p className="text-2xl font-bold text-gray-600">
                  {stats.paused}
                </p>
              </div>
              <Pause className="h-8 w-8 text-gray-400" />
            </div>
          </div>
          <div className="bg-white rounded-md shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Due Soon</p>
                <p className="text-2xl font-bold text-purple-600">
                  {stats.dueSoon}
                </p>
              </div>
              <Clock className="h-8 w-8 text-purple-400" />
            </div>
          </div>
          <div className="bg-white rounded-md shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Overdue</p>
                <p className="text-2xl font-bold text-red-600">
                  {stats.overdue}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-red-400" />
            </div>
          </div>
        </div>

        {/* Filters and View Controls */}
        <div className="bg-white rounded-md shadow-sm border border-gray-200 p-4 mb-3 overflow-x-hidden">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">
                  Filters:
                </span>
              </div>

              <input
                type="text"
                placeholder="Search recurring tasks..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full sm:flex-1 sm:max-w-xs h-9 px-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                data-testid="input-search-recurring-tasks"
              />

              <select
                value={statusFilter}
                onChange={handleStatusFilterChange}
                className="w-32 h-9 px-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                data-testid="filter-status"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>

              <select
                value={priorityFilter}
                onChange={handlePriorityFilterChange}
                className="w-32 h-9 px-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                data-testid="filter-priority"
              >
                <option value="all">All Priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>

              <select
                value={frequencyFilter}
                onChange={(e) => setFrequencyFilter(e.target.value)}
                className="w-32 h-9 px-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                data-testid="filter-frequency"
              >
                <option value="all">All Frequency</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom</option>
              </select>

              <select
                value={dueDateFilter}
                onChange={(e) => {
                  setDueDateFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-32 h-9 px-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                data-testid="filter-duedate"
              >
                <option value="all">All Dates</option>
                <option value="overdue">Overdue</option>
                <option value="due_today">Due Today</option>
                <option value="due_tomorrow">Due Tomorrow</option>
                <option value="due_this_week">Due This Week</option>
                <option value="due_next_week">Due Next Week</option>
                <option value="due_this_month">Due This Month</option>
                <option value="no_due_date">No Due Date</option>
              </select>
            </div>

            <div className="flex items-center space-x-2 mt-2 sm:mt-0 sm:ml-auto flex-shrink-0">
              <div className="flex items-center bg-gray-100 rounded-md p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === "grid"
                      ? "bg-white shadow-sm text-purple-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === "list"
                      ? "bg-white shadow-sm text-purple-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Active Filter Badges */}
          {(searchTerm ||
            statusFilter !== "all" ||
            priorityFilter !== "all" ||
            frequencyFilter !== "all" ||
            dueDateFilter !== "all") && (
            <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
              <span className="text-xs text-gray-500">Active:</span>
              {searchTerm && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                  Search: {searchTerm}
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setCurrentPage(1);
                    }}
                    className="ml-0.5 hover:text-purple-900"
                  >
                    ×
                  </button>
                </span>
              )}
              {statusFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                  Status: {statusFilter}
                  <button
                    onClick={() => {
                      setStatusFilter("all");
                      setCurrentPage(1);
                    }}
                    className="ml-0.5 hover:text-purple-900"
                  >
                    ×
                  </button>
                </span>
              )}
              {priorityFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                  Priority: {priorityFilter}
                  <button
                    onClick={() => {
                      setPriorityFilter("all");
                      setCurrentPage(1);
                    }}
                    className="ml-0.5 hover:text-purple-900"
                  >
                    ×
                  </button>
                </span>
              )}
              {frequencyFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                  Frequency: {frequencyFilter}
                  <button
                    onClick={() => setFrequencyFilter("all")}
                    className="ml-0.5 hover:text-purple-900"
                  >
                    ×
                  </button>
                </span>
              )}
              {dueDateFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                  Due: {dueDateFilter.replace(/_/g, " ")}
                  <button
                    onClick={() => {
                      setDueDateFilter("all");
                      setCurrentPage(1);
                    }}
                    className="ml-0.5 hover:text-purple-900"
                  >
                    ×
                  </button>
                </span>
              )}
              <button
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setPriorityFilter("all");
                  setFrequencyFilter("all");
                  setDueDateFilter("all");
                  setCurrentPage(1);
                }}
                className="text-xs text-purple-600 hover:text-purple-800 font-medium ml-1"
              >
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* Grid/List */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className="flex flex-col justify-between bg-white rounded-md shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200"
                data-testid={`recurring-task-card-${task.id}`}
              >
                {/* Card Header */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-start justify-between mb-2">
                    {/* Left section */}
                    <div className="flex items-center space-x-2">
                      <div className="h-8 w-8 rounded-sm bg-purple-100 flex items-center justify-center">
                        <RecurringTaskIcon className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <h3
                          className="text-base font-semibold text-gray-900 truncate max-w-[190px]"
                          title={task.title}
                        >
                          {task.title}
                        </h3>
                        <p className="text-xs text-gray-600">
                          {getFrequencyLabel(task.frequency)}
                        </p>
                      </div>
                    </div>

                    {/* Actions - 3-dot menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="p-1.5 hover:bg-gray-100 rounded-sm"
                        >
                          <MoreVerticalIcon className="h-4 w-4 text-gray-600" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-36 bg-white"
                      >
                        <DropdownMenuItem
                          onClick={() => handleToggleActive(task.id)}
                        >
                          {task.isActive ? (
                            <>
                              <Pause className="h-3.5 w-3.5 mr-2 text-gray-600" />{" "}
                              Pause
                            </>
                          ) : (
                            <>
                              <Play className="h-3.5 w-3.5 mr-2 text-green-600" />{" "}
                              Resume
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            if (task.status !== "DONE") {
                              handleEdit(task.id);
                            }
                          }}
                          disabled={task.status === "DONE"}
                          className={`text-sm py-2 px-3 rounded-none ${
                            task.status === "DONE"
                              ? "cursor-not-allowed opacity-50 text-gray-400"
                              : "cursor-pointer hover:bg-gray-50"
                          }`}
                        >
                          <Edit3
                            className={`h-3.5 w-3.5 mr-2 ${
                              task.status === "DONE"
                                ? "text-gray-400"
                                : "text-gray-600"
                            }`}
                          />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            handleDelete(task.id);
                          }}
                          className="text-sm py-2 px-3 rounded-none cursor-pointer hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2 text-red-600" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Description */}
                  <p
                    className="text-xs text-gray-600 mb-2 truncate max-w-[180px]"
                    title={getTextPreview(task.description, 200)}
                  >
                    <SafeHtml
                      html={task.description}
                      truncate={true}
                      maxLength={80}
                      as="span"
                    />
                  </p>

                  {/* Status + Priority */}
                  <div className="flex items-center flex-wrap gap-1.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${getStatusPill(
                        task.isActive,
                      )}`}
                    >
                      {task.isActive ? "ACTIVE" : "PAUSED"}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${getPriorityColor(
                        task.priority,
                      )}`}
                    >
                      {task.priority?.toUpperCase() || "N/A"}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-800 border border-purple-200">
                      <Tag className="h-3 w-3 mr-1" />
                      {getFrequencyLabel(task.frequency)}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center space-x-1.5">
                      <Calendar className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-gray-600">
                        Next Due:{" "}
                        {task.nextDue
                          ? new Date(task.nextDue)
                              .toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                              .replace(",", "")
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Clock className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-gray-600">
                        Est. Time: {task.timeEstimate || "—"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Tag className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-gray-600">
                        Created By: {task.createdBy || "—"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Clock className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-gray-600">
                        Last Gen:{" "}
                        {task.lastGenerated
                          ? new Date(task.lastGenerated)
                              .toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                              .replace(",", "")
                          : "—"}
                      </span>
                    </div>
                  </div>

                  {task.tags && task.tags.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-gray-700 mb-1">
                        Tags
                      </h4>
                      <div className="flex items-center flex-wrap gap-1.5">
                        {task.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 rounded-b-md">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      variant="ghost"
                      className="h-7 px-2.5 text-xs text-gray-600 hover:text-gray-900"
                      onClick={() => handleToggleActive(task.id)}
                    >
                      {task.isActive ? (
                        <Pause className="h-3.5 w-3.5 mr-1" />
                      ) : (
                        <Play className="h-3.5 w-3.5 mr-1" />
                      )}
                      {task.isActive ? "Pause" : "Resume"}
                    </Button>
                    <Button
                      variant="ghost"
                      className={`h-7 px-2.5 text-xs ${
                        task.status === "DONE"
                          ? "cursor-not-allowed text-gray-400 opacity-60"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                      disabled={task.status === "DONE"}
                      onClick={() => {
                        if (task.status !== "DONE") {
                          handleEdit(task.id);
                        }
                      }}
                    >
                      <Edit3 className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-7 px-2.5 text-xs text-red-600 hover:text-red-800"
                      onClick={() => {
                        handleDelete(task.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // List View
          <div className="bg-white rounded-sm shadow-sm border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-200">
              {filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="h-12 w-12 rounded-sm bg-purple-100 flex items-center justify-center">
                        <RecurringTaskIcon className="h-6 w-6 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3
                            className="text-lg font-semibold text-gray-900 truncate max-w-[190px]"
                            title={task.title}
                          >
                            {task.title}
                          </h3>
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusPill(
                              task.isActive,
                            )}`}
                          >
                            {task.isActive ? "ACTIVE" : "PAUSED"}
                          </span>
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getPriorityColor(
                              task.priority,
                            )}`}
                          >
                            {task.priority?.toUpperCase() || "N/A"}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                            {getFrequencyLabel(task.frequency)}
                          </span>
                        </div>
                        <p
                          className="text-sm text-gray-600 mb-2 truncate max-w-[180px]"
                          title={getTextPreview(task.description, 200)}
                        >
                          <SafeHtml
                            html={task.description}
                            truncate={true}
                            maxLength={100}
                            as="span"
                          />
                        </p>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>
                              Next Due:{" "}
                              {task.nextDue
                                ? new Date(task.nextDue)
                                    .toLocaleDateString("en-GB", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    })
                                    .replace(",", "")
                                : "—"}
                            </span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>Est. Time: {task.estimatedTime || "—"}</span>
                          </span>
                          {task.tags?.length ? (
                            <span className="flex items-center gap-1">
                              <Tag className="h-4 w-4" />
                              <span>
                                {task.tags.slice(0, 2).join(", ")}
                                {task.tags.length > 2
                                  ? ` +${task.tags.length - 2}`
                                  : ""}
                              </span>
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleActive(task.id)}
                        className="p-2 hover:bg-gray-100 rounded-sm"
                        title={task.isActive ? "Pause" : "Resume"}
                      >
                        {task.isActive ? (
                          <Pause className="h-4 w-4 text-gray-600" />
                        ) : (
                          <Play className="h-4 w-4 text-green-600" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (task.status !== "DONE") {
                            handleEdit(task.id);
                          }
                        }}
                        disabled={task.status === "DONE"}
                        className={`p-2 rounded-sm ${
                          task.status === "DONE"
                            ? "cursor-not-allowed text-gray-400 opacity-60"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                        title="Edit"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          handleDelete(task.id);
                        }}
                        className="p-2 rounded-sm text-red-600 hover:bg-gray-100"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredTasks.length === 0 && !isLoading && (
                <div className="text-center py-12">
                  <Clock className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No recurring tasks found
                  </h3>
                  <p className="text-gray-600 mb-3">
                    Try adjusting your search or filters.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {filteredTasks.length === 0 && viewMode === "grid" && !isLoading && (
          <div className="text-center py-12">
            <Clock className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No recurring tasks found
            </h3>
            <p className="text-gray-600 mb-3">
              Get started by creating your first recurring task template.
            </p>
            <button
              onClick={handleCreateNew}
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white font-medium rounded-sm hover:bg-purple-700 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Recurring Task
            </button>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between bg-white px-4 py-3 border border-gray-200 rounded-sm">
            <div className="flex items-center text-sm text-gray-700">
              <span>
                Showing page {pagination.currentPage} of {pagination.totalPages}
                ({pagination.totalTasks} total tasks)
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                className="h-9"
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={!pagination.hasPrevPage}
              >
                Previous
              </Button>

              {/* Page numbers */}
              {Array.from(
                { length: Math.min(5, pagination.totalPages) },
                (_, i) => {
                  const pageNum = Math.max(1, pagination.currentPage - 2) + i;
                  if (pageNum > pagination.totalPages) return null;

                  return (
                    <Button
                      key={pageNum}
                      variant={
                        pageNum === pagination.currentPage
                          ? "primary"
                          : "outline"
                      }
                      className={`h-9 ${
                        pageNum === pagination.currentPage
                          ? "bg-purple-600 text-white"
                          : ""
                      }`}
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                },
              )}

              <Button
                variant="outline"
                className="h-9"
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={!pagination.hasNextPage}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecurringTaskManager;
