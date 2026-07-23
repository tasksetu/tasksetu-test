import React, { useState, useMemo } from "react";
// Exported form model for regular tasks (for RecurringTaskEdit.jsx)
export const regularTaskFormModel = [
  {
    name: "taskName",
    label: "Task Name",
    type: "text",
    required: true,
    placeholder: "Enter task name",
  },
  {
    name: "description",
    label: "Description",
    type: "textarea",
    required: false,
    placeholder: "Enter description",
  },
  {
    name: "assignedTo",
    label: "Assigned To",
    type: "select",
    required: false,
    placeholder: "Select assignee",
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
  },
  {
    name: "dueDate",
    label: "Due Date",
    type: "date",
    required: true,
    placeholder: "",
  },
  {
    name: "visibility",
    label: "Visibility",
    type: "select",
    required: true,
    options: [
      { value: "private", label: "Private" },
      { value: "public", label: "Public" },
    ],
    placeholder: "Select visibility",
  },
  {
    name: "labels",
    label: "Labels",
    type: "text",
    required: false,
    placeholder: "Comma separated labels",
  },
];

import { useActiveRole } from "../../components/RoleSwitcher";
import { useQuery } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import {
  Plus,
  Target,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  EyeOff,
  Filter,
  Grid3X3,
  List,
  MoreHorizontal,
  Edit3,
  Share2,
  X,
  File,
  Tag,
  Paperclip,
  MoreVerticalIcon,
  Play,
  Trash2,
} from "lucide-react";
import { apiClient } from "../../utils/apiClient";
import { RegularTaskIcon } from "../../components/common/TaskIcons";
import SafeHtml, { getTextPreview } from "../../components/common/SafeHtml";
import CustomEditor from "../../components/common/CustomEditor";
import { Link, useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useShowToast } from "../../utils/ToastMessage";
import { useTaskStatuses } from "@/hooks/useTaskStatuses";
import { useTaskPriorities } from "@/hooks/useTaskPriorities";
import { useAssignmentOptions } from "../../features/shared/hooks/useAssignmentOptions";
import AssigneeSearchSelect from "../../components/common/AssigneeSearchSelect";
// THEME: Regular Task uses blue; Milestone uses green; Approval uses amber
const RT = {
  // base
  primary: "blue",
  // color utility classes
  btn: "bg-blue-600 hover:bg-blue-700 text-white",
  chip: {
    primary: "bg-blue-100 text-blue-800 border border-blue-200",
  },
  icon: "text-blue-600",
  panelHeader: "border-b border-gray-200",
  headerBg: "bg-white",
  headerBorder: "border-b border-gray-200",
};

// Exported form model for recurring tasks (for RecurringTaskEdit.jsx)
export const recurringTaskFormModel = [
  {
    name: "title",
    label: "Task Title",
    type: "text",
    required: true,
    placeholder: "Enter task title",
  },
  {
    name: "description",
    label: "Description",
    type: "textarea",
    required: false,
    placeholder: "Enter description",
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
      { value: "quarterly", label: "Quarterly" },
      { value: "yearly", label: "Yearly" },
    ],
    placeholder: "Select frequency",
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
    ],
    placeholder: "Select priority",
  },
  {
    name: "nextDue",
    label: "Next Due Date",
    type: "date",
    required: false,
    placeholder: "",
  },
  {
    name: "estimatedTime",
    label: "Estimated Time (minutes)",
    type: "number",
    required: false,
    placeholder: "Enter estimated time",
  },
  {
    name: "tags",
    label: "Tags",
    type: "text",
    required: false,
    placeholder: "Comma separated tags",
  },
];

// Helpers
const getStatusColor = (status) => {
  const colors = {
    not_started: "bg-gray-100 text-gray-800 border-gray-200",
    in_progress: "bg-blue-100 text-blue-800 border-blue-200",
    completed: "bg-green-100 text-green-800 border-green-200",
    overdue: "bg-red-100 text-red-800 border-red-200",
  };
  return colors[status] || "bg-gray-100 text-gray-800 border-gray-200";
};

const getPriorityColor = (priority) => {
  const colors = {
    low: "bg-green-100 text-green-800 border-green-200",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    high: "bg-orange-100 text-orange-800 border-orange-200",
    critical: "bg-red-100 text-red-800 border-red-200",
  };
  return colors[priority] || "bg-gray-100 text-gray-800 border-gray-200";
};

const getStatusIcon = (status) => {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "in_progress":
      return <Clock className="h-4 w-4 text-blue-600" />;
    case "overdue":
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    default:
      return <Clock className="h-4 w-4 text-gray-600" />;
  }
};

// Auto due date based on priority (can be tweaked/plugged to backend logic)
const dueDateFromPriority = (priority) => {
  const base = new Date();
  const addDays = (d) => {
    const dt = new Date(base);
    dt.setDate(dt.getDate() + d);
    return dt.toISOString().slice(0, 10);
  };
  switch (priority) {
    case "low":
      return addDays(7);
    case "medium":
      return addDays(3);
    case "high":
      return addDays(1);
    case "critical":
      return addDays(0);
    default:
      return addDays(7);
  }
};

export default function RegularTaskManager() {
  // Pagination and filters
  const { showSuccessToast, showErrorToast } = useShowToast();
  const [location, setLocation] = useLocation();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit] = useState(20);
  const [statusFilter, setStatusFilter] = useState("all");
  const { data: taskStatuses = [] } = useTaskStatuses();
  const { data: taskPriorities = [] } = useTaskPriorities();
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [dueDateFilter, setDueDateFilter] = useState("all");
  const [viewMode, setViewMode] = useState("list");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Edit modal state
  const [editingTask, setEditingTask] = useState(null);
  // Initialize editForm with all fields from regularTaskFormModel
  const initialEditForm = Object.fromEntries(
    regularTaskFormModel.map((field) => [field.name, ""]),
  );
  initialEditForm.assignedToId = "";
  const [editForm, setEditForm] = useState(initialEditForm);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState(null);

  // Fetch regular tasks from API
  const {
    data: apiResponse,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      "regular-tasks",
      currentPage,
      pageLimit,
      statusFilter,
      priorityFilter,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageLimit.toString(),
      });
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (priorityFilter !== "all") params.append("priority", priorityFilter);
      const response = await apiClient.get(
        `/api/tasks/filter/regular?${params.toString()}`,
      );
      return response;
    },
    retry: 1,
    staleTime: 0,
  });

  // Fetch team members for assignment dropdown
  const { data: teamMembersResponse } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const response = await apiClient.get("/api/team-members");
      return response;
    },
    retry: 1,
    staleTime: 300000, // 5 minutes
  });

  const teamMembers = teamMembersResponse?.data || [];

  // Get active role from context
  const { activeRole } = useActiveRole();
  const { canAssignToOthers } = useAssignmentOptions();
  // Fallback to first available role if not set
  const currentRole =
    activeRole ||
    Object.keys(apiResponse?.data?.data?.roles || {})[0] ||
    "employee";
  // Calculate progress based on status
  const calculateProgress = (status) => {
    const statusLower = (status || "").toLowerCase();
    if (statusLower === "completed" || statusLower === "done") return 100;
    if (statusLower === "in_progress" || statusLower === "inprogress")
      return 50;
    return 0; // not_started, open, or any other status
  };

  // Transform API data to match component expectations
  const transformApiTask = (apiTask) => {
    console.log("🔄 TRANSFORM API TASK");
    console.log("1️⃣ Raw API Task:", apiTask);
    console.log("   - apiTask.assignedTo:", apiTask.assignedTo);
    console.log("   - Type:", typeof apiTask.assignedTo);

    const transformedAssignedTo =
      typeof apiTask.assignedTo === "object" && apiTask.assignedTo !== null
        ? apiTask.assignedTo.firstName
          ? `${apiTask.assignedTo.firstName} ${
              apiTask.assignedTo.lastName || ""
            }`.trim()
          : apiTask.assignedTo.name ||
            apiTask.assignedTo.username ||
            apiTask.assignedTo.email ||
            "User"
        : apiTask.assignedTo || "Self";

    const transformedAssignedToId =
      typeof apiTask.assignedTo === "object" && apiTask.assignedTo !== null
        ? apiTask.assignedTo._id
        : apiTask.assignedTo;

    console.log("2️⃣ Transformed:");
    console.log("   - assignedTo:", transformedAssignedTo);
    console.log("   - assignedToId:", transformedAssignedToId);

    return {
      id: apiTask._id,
      taskName: apiTask.title,
      description: apiTask.description,
      assignedTo: transformedAssignedTo,
      assignedToId: transformedAssignedToId,
      priority: apiTask.priority,
      dueDate: apiTask.dueDate,
      visibility: apiTask.visibility,
      labels: apiTask.tags || [],
      attachments: apiTask.attachments || [],
      status: apiTask.status,
      taskType: apiTask.taskType || "regular",
      progress: apiTask.progress ?? calculateProgress(apiTask.status),
    };
  };

  // Get tasks for current role from API response
  const tasksArray = apiResponse?.data?.data?.roles?.[currentRole] || [];
  const tasks = tasksArray.map(transformApiTask) || [];
  const pagination = apiResponse?.data?.data?.pagination || {};

  // State for local task management
  const [localTasks, setLocalTasks] = useState(null);
  const currentTasks = localTasks ?? tasks;

  const getDefaultPriority = () => {
    const defaultPriority = taskPriorities.find((p) => p.isDefault);
    return defaultPriority?.code || "low";
  };

  // Form state
  const [form, setForm] = useState({
    taskName: "",
    description: "",
    assignedTo: "Self", // default Self
    priority: getDefaultPriority(), // default from API
    dueDate: dueDateFromPriority(getDefaultPriority()), // auto-filled
    visibility: "private", // default Private
    labels: [],
    labelInput: "",
    attachments: [],
    taskType: "simple", // default Simple
    // Advanced
    referenceProcess: "",
    customForm: "",
    dependencies: [],
  });
  const [attachmentsBytes, setAttachmentsBytes] = useState(0);
  const maxBytes = 5 * 1024 * 1024; // 5MB

  // Edit modal helpers
  const openEditModal = (taskId) => {
    const task = currentTasks.find((t) => t.id === taskId);
    if (!task) return;

    // Show edit confirmation first
    setEditConfirmation({
      isOpen: true,
      task: task,
    });
  };

  const confirmEditModal = (task) => {
    console.log("📝 === EDIT MODAL CONFIRMATION START ===");
    console.log("1️⃣ Task received:", task);
    console.log("   - Task ID:", task.id);
    console.log("   - Task Name:", task.taskName);
    console.log("   - Assigned To (name):", task.assignedTo);
    console.log("   - Assigned To ID:", task.assignedToId);

    setEditingTask(task);

    // Format due date for date input (YYYY-MM-DD)
    const formattedDueDate = task.dueDate
      ? new Date(task.dueDate).toISOString().split("T")[0]
      : "";
    console.log("2️⃣ Formatted Due Date:", formattedDueDate);

    // Format assignedTo for AssigneeSearchSelect (needs {value, label} object)
    const assignedToValue =
      task.assignedToId && task.assignedToId !== ""
        ? { value: task.assignedToId, label: task.assignedTo }
        : null;

    console.log("3️⃣ Assigned To Value object:", assignedToValue);
    console.log("   - Is assignedToId truthy?", !!task.assignedToId);
    console.log(
      "   - Is assignedToId not empty string?",
      task.assignedToId !== "",
    );

    const newEditForm = {
      taskName: task.taskName,
      description: task.description,
      assignedTo: assignedToValue,
      assignedToId: task.assignedToId,
      priority: task.priority,
      dueDate: formattedDueDate,
      visibility: task.visibility,
      labels: task.labels || [],
      labelInput: "",
      attachments: task.attachments || [],
      existingAttachments: task.attachments || [], // Keep track of existing attachments
      deletedAttachments: [], // Track attachments to delete
      newAttachments: [], // Track newly uploaded files
      taskType: task.taskType || "regular",
      referenceProcess: task.referenceProcess || "",
      customForm: task.customForm || "",
      dependencies: task.dependencies || [],
    };

    console.log("4️⃣ Edit Form to be set:", newEditForm);
    console.log("   - assignedTo field:", newEditForm.assignedTo);
    console.log("   - assignedToId field:", newEditForm.assignedToId);

    setEditForm(newEditForm);
    setEditModalOpen(true);
    setEditError(null);

    // Close edit confirmation
    setEditConfirmation({
      isOpen: false,
      task: null,
    });

    console.log("✅ === EDIT MODAL CONFIRMATION END ===");
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditingTask(null);
    setEditForm(null);
    setEditError(null);
  };

  const handleEditFormChange = (field, value) => {
    console.log(`📝 Edit Form Change - Field: ${field}`);
    console.log("   Old Value:", value);

    // Enforce max length for taskName to prevent typing beyond 100 chars
    if (field === "taskName" && typeof value === "string") {
      const truncated = value.length > 100 ? value.substring(0, 100) : value;
      // update a visual length counter if present
      try {
        if (typeof setTaskNameLength === "function")
          setTaskNameLength(truncated.length);
      } catch (e) {}
      value = truncated;
    }

    setEditForm((prev) => {
      const updated = { ...prev, [field]: value };
      console.log(`   ✅ Updated Form - ${field}:`, updated[field]);
      return updated;
    });

    if (field === "priority") {
      const newDueDate = dueDateFromPriority(value);
      console.log(
        "   Priority changed to:",
        value,
        "-> New due date:",
        newDueDate,
      );
      setEditForm((prev) => ({ ...prev, dueDate: newDueDate }));
    }
  };

  const handleEditLabelsKeyDown = (e) => {
    if ((e.key === "Enter" || e.key === ",") && editForm.labelInput.trim()) {
      e.preventDefault();
      const val = editForm.labelInput.trim();
      if (!editForm.labels.includes(val)) {
        setEditForm((f) => ({
          ...f,
          labels: [...f.labels, val],
          labelInput: "",
        }));
      } else {
        setEditForm((f) => ({ ...f, labelInput: "" }));
      }
    }
  };

  const handleEditRemoveLabel = (label) => {
    setEditForm((f) => ({ ...f, labels: f.labels.filter((l) => l !== label) }));
  };

  const handleEditFilesSelected = (files) => {
    const arr = Array.from(files);
    const total = arr.reduce((sum, f) => sum + f.size, 0);
    if (total > maxBytes) {
      showErrorToast("Attachments exceed 5 MB total limit.");
      return;
    }
    setEditForm((f) => ({ ...f, newAttachments: arr }));
  };

  const handleDeleteExistingAttachment = (attachmentId) => {
    setEditForm((f) => ({
      ...f,
      existingAttachments: f.existingAttachments.filter(
        (att) => att._id !== attachmentId,
      ),
      deletedAttachments: [...f.deletedAttachments, attachmentId],
    }));
  };

  const handleRemoveNewAttachment = (index) => {
    setEditForm((f) => ({
      ...f,
      newAttachments: f.newAttachments.filter((_, i) => i !== index),
    }));
  };

  const validateEditForm = () => {
    if (!editForm.taskName.trim()) return "Task Name is required.";
    if (editForm.taskName.length > 100)
      return "Task Name must be <= 100 characters.";
    // No validation needed for assignedTo since it can be empty (self-assigned)
    if (!editForm.priority) return "Priority is required.";
    if (!editForm.dueDate) return "Due Date is required.";
    if (!editForm.taskType) return "Task Type is required.";
    return null;
  };

  const handleEditSave = async () => {
    const err = validateEditForm();
    if (err) {
      setEditError(err);
      return;
    }
    setEditLoading(true);
    setEditError(null);

    try {
      // Create FormData to support file uploads
      const formData = new FormData();

      // Extract assignedTo ID (from AssigneeSearchSelect format {value, label})
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

      // Add basic fields
      formData.append("title", editForm.taskName);
      formData.append("description", editForm.description || "");
      formData.append("assignedTo", assignedToId);
      formData.append("priority", editForm.priority);
      formData.append(
        "dueDate",
        editForm.dueDate ? new Date(editForm.dueDate).toISOString() : "",
      );
      formData.append("visibility", editForm.visibility);
      formData.append("status", editingTask.status || "not_started");

      // Add tags (labels) - append each tag individually for proper array handling
      if (Array.isArray(editForm.labels) && editForm.labels.length > 0) {
        editForm.labels.forEach((tag) => {
          formData.append("tags[]", tag);
        });
      }

      // Add deleted attachments IDs
      if (
        editForm.deletedAttachments &&
        editForm.deletedAttachments.length > 0
      ) {
        formData.append(
          "deletedAttachments",
          JSON.stringify(editForm.deletedAttachments),
        );
      }

      // Add new file attachments
      if (editForm.newAttachments && editForm.newAttachments.length > 0) {
        editForm.newAttachments.forEach((file) => {
          formData.append("attachments", file);
        });
      }

      console.log("Sending update request with FormData");
      console.log("Task ID:", editingTask.id);

      // Make API call using PUT method with FormData
      const response = await fetch(`/api/tasks/${editingTask.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          // Don't set Content-Type - browser will set it automatically with boundary for multipart/form-data
        },
        body: formData,
      });

      const data = await response.json();
      console.log("Update response:", data);

      // Handle successful response
      if (response.ok && data.success) {
        // Update local tasks state immediately for better UX
        const updatedTask = {
          ...editingTask,
          taskName: editForm.taskName,
          description: editForm.description,
          assignedTo:
            editForm.assignedTo?.label || editForm.assignedTo || "Self",
          assignedToId: assignedToId,
          priority: editForm.priority,
          dueDate: editForm.dueDate,
          visibility: editForm.visibility,
          labels: editForm.labels,
          attachments: data.data?.attachments || editingTask.attachments,
        };

        setLocalTasks((prev) => {
          const currentList = prev ?? tasks;
          return currentList.map((task) =>
            task.id === editingTask.id ? updatedTask : task,
          );
        });

        // Show success message
        showSuccessToast(`Task "${editForm.taskName}" updated`);

        // Close modal automatically
        closeEditModal();

        // Refetch data to ensure consistency (after UI update for better UX)
        setTimeout(() => {
          refetch();
        }, 500);
      } else {
        // Handle API error response
        const errorMessage = data?.message || "Failed to update task.";
        setEditError(errorMessage);
        showErrorToast(errorMessage);
      }
    } catch (err) {
      console.error("Error updating task:", err);

      // Handle different error response structures
      let errorMessage = "Error updating task.";
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }

      setEditError(errorMessage);
      showErrorToast(errorMessage);
    }
    setEditLoading(false);
  };

  const resetForm = () => {
    setForm({
      taskName: "",
      description: "",
      assignedTo: "Self",
      priority: getDefaultPriority(),
      dueDate: dueDateFromPriority(getDefaultPriority()),
      visibility: "private",
      labels: [],
      labelInput: "",
      attachments: [],
      taskType: "simple",
      referenceProcess: "",
      customForm: "",
      dependencies: [],
    });
    setAttachmentsBytes(0);
  };

  // Filtering (API already filters, but keep for local fallback)
  const filteredTasks = currentTasks.filter((task) => {
    const matchesSearch =
      !searchTerm ||
      task.taskName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.assignedToName?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "OVERDUE"
        ? task.dueDate && new Date(task.dueDate) < new Date()
        : (task.status || "").toUpperCase() === statusFilter.toUpperCase());

    const matchesPriority =
      priorityFilter === "all" || task.priority === priorityFilter;

    let matchesDueDate = true;
    if (dueDateFilter !== "all" && task.dueDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(task.dueDate);
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
      matchesDueDate = !task.dueDate;
    }

    return matchesSearch && matchesStatus && matchesPriority && matchesDueDate;
  });

  // Stats (calculate from tasks and update when localTasks changes)
  const stats = useMemo(() => {
    const activeTasks = currentTasks;
    const now = new Date();
    return {
      total: activeTasks.length,
      completed: activeTasks.filter((t) => {
        const s = (t.status || "").toUpperCase();
        return s === "DONE" || s === "COMPLETED";
      }).length,
      inProgress: activeTasks.filter((t) => {
        const s = (t.status || "").toUpperCase();
        return s === "INPROGRESS" || s === "IN_PROGRESS";
      }).length,
      notStarted: activeTasks.filter((t) => {
        const s = (t.status || "").toUpperCase();
        return s === "OPEN" || s === "TODO" || s === "NOT_STARTED";
      }).length,
      overdue: activeTasks.filter((t) => {
        const s = (t.status || "").toUpperCase();
        const isNotDone =
          s !== "DONE" && s !== "COMPLETED" && s !== "CANCELLED";
        return isNotDone && t.dueDate && new Date(t.dueDate) < now;
      }).length,
    };
  }, [currentTasks]);

  // Form handlers
  const onPriorityChange = (priority) => {
    setForm((f) => ({
      ...f,
      priority,
      dueDate: dueDateFromPriority(priority), // auto-set; user can edit later
    }));
  };

  const onLabelsKeyDown = (e) => {
    if (e.key === "Enter" && form.labelInput.trim()) {
      e.preventDefault();
      const val = form.labelInput.trim();
      if (!form.labels.includes(val)) {
        setForm((f) => ({ ...f, labels: [...f.labels, val], labelInput: "" }));
      } else {
        setForm((f) => ({ ...f, labelInput: "" }));
      }
    }
  };

  const removeLabel = (label) => {
    setForm((f) => ({ ...f, labels: f.labels.filter((l) => l !== label) }));
  };

  const onFilesSelected = (files) => {
    const arr = Array.from(files);
    const total = arr.reduce((sum, f) => sum + f.size, 0);
    if (total > maxBytes) {
      showErrorToast("Attachments exceed 5 MB total limit.");
      return;
    }
    setForm((f) => ({ ...f, attachments: arr }));
    setAttachmentsBytes(total);
  };

  const validateForm = () => {
    if (!form.taskName.trim()) return "Task Name is required.";
    if (form.taskName.length > 20) return "Task Name must be <= 20 characters.";
    // No validation needed for assignedTo since it can be empty (self-assigned)
    if (!form.priority) return "Priority is required.";
    if (!form.dueDate) return "Due Date is required.";
    if (!form.taskType) return "Task Type is required.";
    if (attachmentsBytes > maxBytes)
      return "Attachments exceed 5 MB total limit.";
    return null;
    // Visibility rules (solo vs org) can be applied here if needed.
  };

  const onSave = () => {
    const err = validateForm();
    if (err) {
      showErrorToast(err);
      return;
    }
    const newTask = {
      id: Date.now(),
      taskName: form.taskName.trim(),
      description: form.description,
      assignedTo: form.assignedTo,
      priority: form.priority,
      dueDate: form.dueDate,
      visibility: form.visibility,
      labels: form.labels,
      attachments: form.attachments.map((f) => ({
        name: f.name,
        size: f.size,
      })),
      status: "not_started",
      taskType: form.taskType,
      progress: 0,
      // Advanced (stored for future use)
      referenceProcess: form.referenceProcess,
      customForm: form.customForm,
      dependencies: form.dependencies,
    };
    setTasks((prev) => [newTask, ...prev]);

    setShowAdvanced(false);
    resetForm();
  };

  // State for local task deletion feedback
  const [deletingTaskId, setDeletingTaskId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  // Update task status locally without refresh
  const updateTaskStatusLocally = (taskId, newStatus) => {
    setLocalTasks((prev) => {
      const currentList = prev ?? tasks;
      return currentList.map((task) =>
        task.id === taskId ? { ...task, status: newStatus } : task,
      );
    });
  };

  // Delete confirmation modal state
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    isOpen: false,
    taskId: null,
    taskTitle: "",
  });

  // Edit confirmation modal state
  const [editConfirmation, setEditConfirmation] = useState({
    isOpen: false,
    task: null,
  });

  // Show delete confirmation
  const showDeleteConfirmation = (taskId) => {
    const task = currentTasks.find((t) => t.id === taskId);
    if (!task) return;

    setDeleteConfirmation({
      isOpen: true,
      taskId: taskId,
      taskTitle: task.taskName,
    });
  };

  // Show edit confirmation
  const showEditConfirmation = (taskId) => {
    const task = currentTasks.find((t) => t.id === taskId);
    if (!task) return;

    setEditConfirmation({
      isOpen: true,
      task: task,
    });
  };

  // Delete task API logic
  const handleDeleteTask = async (taskId) => {
    setDeletingTaskId(taskId);
    setDeleteError(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setDeleteError("Authorization token not found.");
        setDeletingTaskId(null);
        return;
      }
      const res = await fetch(`/api/tasks/delete/${taskId}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.status === 401) {
        setDeleteError("Unauthorized: Please login again.");
        setDeletingTaskId(null);
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        setDeleteError(data.message || "Failed to delete task.");
        setDeletingTaskId(null);
        return;
      }

      // Update local tasks state immediately for better UX
      setLocalTasks((prev) =>
        prev
          ? prev.filter((t) => t.id !== taskId)
          : currentTasks.filter((t) => t.id !== taskId),
      );

      // Also refetch data to ensure consistency
      refetch();

      // Close confirmation modal
      setDeleteConfirmation({
        isOpen: false,
        taskId: null,
        taskTitle: "",
      });

      // Show success message
      showSuccessToast(
        `Task "${deleteConfirmation.taskTitle}" deleted successfully!`,
      );

      setDeletingTaskId(null);
    } catch (err) {
      console.error("Delete task error:", err);
      setDeleteError(err.message || "Error deleting task.");
      showErrorToast(`Error deleting task: ${err.message || "Unknown error"}`);
      setDeletingTaskId(null);
    }
  };

  // Loading state
  if (isLoading && !tasks.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600">Loading regular tasks...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !tasks.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-3">
            Error loading regular tasks: {error.message}
          </p>
          <Button variant="primary" onClick={() => refetch()} className="h-9">
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
                Are you sure you want to delete the task "
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
                  onClick={() => handleDeleteTask(deleteConfirmation.taskId)}
                  disabled={deletingTaskId === deleteConfirmation.taskId}
                >
                  {deletingTaskId === deleteConfirmation.taskId
                    ? "Deleting..."
                    : "Delete"}
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
            <h2 className="text-xl font-bold text-blue-600 mb-3">
              Confirm Edit
            </h2>
            <p className="text-gray-700 mb-3">
              Do you want to edit the task "
              <strong>{editConfirmation.task?.taskName}</strong>"?
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
                className="h-9"
                onClick={() => confirmEditModal(editConfirmation.task)}
              >
                Continue to Edit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div
            className="bg-white rounded-sm shadow-lg w-full sm:max-w-md md:max-w-3xl p-4 relative"
            style={{ maxHeight: "80vh", overflow: "hidden" }}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 p-2 text-gray-500 hover:text-gray-700"
              onClick={closeEditModal}
            >
              <X className="h-5 w-5" />
            </Button>
            <h2 className="text-xl font-bold mb-3">Edit Regular Task</h2>
            {editError && (
              <div className="text-red-600 mb-2 text-sm">{editError}</div>
            )}
            {editForm && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleEditSave();
                }}
                className="space-y-3 overflow-y-auto"
                style={{ maxHeight: "60vh", paddingRight: "8px" }}
              >
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Task Name
                  </label>
                  <input
                    type="text"
                    value={editForm.taskName}
                    onChange={(e) =>
                      handleEditFormChange("taskName", e.target.value)
                    }
                    className="w-full h-9 border rounded-md px-3 text-sm"
                    maxLength={100}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Description
                  </label>
                  <div className="border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                    <CustomEditor
                      value={editForm.description}
                      onChange={(value) =>
                        handleEditFormChange("description", value)
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Assigned To
                  </label>
                  {console.log("📝 RENDERING ASSIGNED TO FIELD")}
                  {console.log("   editForm.assignedTo:", editForm.assignedTo)}
                  {console.log(
                    "   editForm.assignedToId:",
                    editForm.assignedToId,
                  )}
                  {console.log(
                    "   Type of assignedTo:",
                    typeof editForm.assignedTo,
                  )}
                  <AssigneeSearchSelect
                    value={editForm.assignedTo}
                    onChange={(selectedOption) => {
                      console.log("🔄 Assigned To Changed:", selectedOption);
                      // selectedOption is {value: userId, label: userName} or null
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
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Priority
                  </label>
                  <select
                    value={editForm.priority}
                    onChange={(e) =>
                      handleEditFormChange("priority", e.target.value)
                    }
                    className="w-full h-9 border rounded-md px-3 text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={editForm.dueDate}
                    onChange={(e) =>
                      handleEditFormChange("dueDate", e.target.value)
                    }
                    className="w-full h-9 border rounded-md px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Visibility
                  </label>
                  <select
                    value={editForm.visibility}
                    onChange={(e) =>
                      handleEditFormChange("visibility", e.target.value)
                    }
                    className="w-full h-9 border rounded-md px-3 text-sm"
                  >
                    <option value="private">Private</option>
                    {canAssignToOthers && (
                      <option value="public">Public</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Labels / Tags
                  </label>
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type="text"
                        value={editForm.labelInput}
                        onChange={(e) =>
                          handleEditFormChange("labelInput", e.target.value)
                        }
                        onKeyDown={handleEditLabelsKeyDown}
                        placeholder="Type tag and press Enter or comma..."
                        className="w-full h-9 px-3 pr-10 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <Button
                        type="button"
                        onClick={() => {
                          const val = editForm.labelInput.trim();
                          if (val && !editForm.labels.includes(val)) {
                            setEditForm((f) => ({
                              ...f,
                              labels: [...f.labels, val],
                              labelInput: "",
                            }));
                          }
                        }}
                        variant="primary"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
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
                    {editForm.labels.length > 0 && (
                      <div className="flex flex-wrap gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                        {editForm.labels.map((label, idx) => (
                          <span
                            key={label + idx}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                          >
                            {label}
                            <Button
                              type="button"
                              onClick={() => handleEditRemoveLabel(label)}
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 p-0 hover:text-indigo-900"
                            >
                              ×
                            </Button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Attachments
                  </label>

                  {/* Existing Attachments */}
                  {editForm.existingAttachments &&
                    editForm.existingAttachments.length > 0 && (
                      <div className="mb-3 p-3 bg-gray-50 rounded-md border">
                        <div className="text-sm font-medium text-gray-700 mb-2">
                          Existing Attachments:
                        </div>
                        <div className="space-y-2">
                          {editForm.existingAttachments.map((att) => (
                            <div
                              key={att._id}
                              className="flex items-center justify-between bg-white p-2 rounded-md border"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <svg
                                  className="h-4 w-4 text-gray-500 flex-shrink-0"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0010.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                  />
                                </svg>
                                <div className="flex-1 min-w-0">
                                  <a
                                    href={att.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-600 hover:underline truncate block"
                                    title={att.originalName || att.filename}
                                  >
                                    {att.originalName || att.filename}
                                  </a>
                                  {att.size && (
                                    <div className="text-xs text-gray-500">
                                      {(att.size / 1024).toFixed(1)} KB
                                    </div>
                                  )}
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  handleDeleteExistingAttachment(att._id)
                                }
                                className="ml-2 h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                                title="Delete attachment"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* New Attachments */}
                  {editForm.newAttachments &&
                    editForm.newAttachments.length > 0 && (
                      <div className="mb-3 p-3 bg-blue-50 rounded-md border border-blue-200">
                        <div className="text-sm font-medium text-blue-700 mb-2">
                          New Attachments to Upload:
                        </div>
                        <div className="space-y-2">
                          {editForm.newAttachments.map((file, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between bg-white p-2 rounded-md border"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <svg
                                  className="h-4 w-4 text-blue-500 flex-shrink-0"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0010.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                  />
                                </svg>
                                <div className="flex-1 min-w-0">
                                  <div
                                    className="text-sm text-gray-900 truncate"
                                    title={file.name}
                                  >
                                    {file.name}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {(file.size / 1024).toFixed(1)} KB
                                  </div>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveNewAttachment(idx)}
                                className="ml-2 h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                                title="Remove file"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* File Input */}
                  <input
                    type="file"
                    multiple
                    onChange={(e) => handleEditFilesSelected(e.target.files)}
                    className="w-full h-9 border rounded-md px-3 text-sm"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Max 5 MB total. Select files to add new attachments.
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9"
                    onClick={closeEditModal}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    className="h-9"
                    disabled={editLoading}
                  >
                    {editLoading ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className={`${RT.headerBg} ${RT.headerBorder}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between space-y-3">
            <div className="flex items-center space-x-3">
              <div className="h-12 w-12 rounded-sm bg-blue-600 flex items-center justify-center">
                <RegularTaskIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Regular Task
                </h1>
                <p className="text-sm text-gray-600">
                  Track and manage simple tasks
                </p>
              </div>
            </div>
            <div className="flex justify-center sm:justify-end">
              <Link
                href="/tasks/create?type=regular"
                className="w-full sm:w-auto"
              >
                <Button variant="primary" className="h-9 w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Regular Task
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-6 py-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
          <div className="bg-white rounded-md shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.total}
                </p>
              </div>
              <Target className="h-8 w-8 text-gray-400" />
            </div>
          </div>
          <div className="bg-white rounded-md shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.completed}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-400" />
            </div>
          </div>
          <div className="bg-white rounded-md shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats.inProgress}
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-400" />
            </div>
          </div>
          <div className="bg-white rounded-md shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Open</p>
                <p className="text-2xl font-bold text-gray-600">
                  {stats.notStarted}
                </p>
              </div>
              <Clock className="h-8 w-8 text-gray-400" />
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
              <AlertCircle className="h-8 w-8 text-red-400" />
            </div>
          </div>
        </div>

        {/* Filters and View Controls */}
        <div className="bg-white rounded-md shadow-sm border border-gray-200 p-4 mb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:space-x-3">
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">
                  Filters:
                </span>
              </div>

              <div className="relative w-full sm:w-48">
                <svg
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full h-9 pl-9 pr-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9 px-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  {(Array.isArray(taskStatuses) ? taskStatuses : [])
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
                  onChange={(e) => {
                    setPriorityFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9 px-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  value={dueDateFilter}
                  onChange={(e) => {
                    setDueDateFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9 px-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            </div>

            <div className="flex justify-center sm:justify-end">
              <div className="flex items-center bg-gray-100 rounded-md p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === "grid"
                      ? "bg-white shadow-sm text-blue-600"
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
                      ? "bg-white shadow-sm text-blue-600"
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
            dueDateFilter !== "all") && (
            <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
              <span className="text-xs text-gray-500">Active:</span>
              {searchTerm && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  Search: {searchTerm}
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setCurrentPage(1);
                    }}
                    className="ml-0.5 hover:text-blue-900"
                  >
                    ×
                  </button>
                </span>
              )}
              {statusFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  Status: {statusFilter}
                  <button
                    onClick={() => {
                      setStatusFilter("all");
                      setCurrentPage(1);
                    }}
                    className="ml-0.5 hover:text-blue-900"
                  >
                    ×
                  </button>
                </span>
              )}
              {priorityFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  Priority: {priorityFilter}
                  <button
                    onClick={() => {
                      setPriorityFilter("all");
                      setCurrentPage(1);
                    }}
                    className="ml-0.5 hover:text-blue-900"
                  >
                    ×
                  </button>
                </span>
              )}
              {dueDateFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  Due: {dueDateFilter.replace(/_/g, " ")}
                  <button
                    onClick={() => {
                      setDueDateFilter("all");
                      setCurrentPage(1);
                    }}
                    className="ml-0.5 hover:text-blue-900"
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
                  setDueDateFilter("all");
                  setCurrentPage(1);
                }}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium ml-1"
              >
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* Tasks Grid/List */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className="flex flex-col justify-between bg-white rounded-md shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200"
              >
                {/* Card Header */}
                <div className={`p-4 ${RT.panelHeader}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="h-8 w-8 rounded-sm bg-blue-100 flex items-center justify-center">
                        <File className={`h-4 w-4 ${RT.icon}`} />
                      </div>
                      <div>
                        <h3
                          className="text-base font-semibold text-gray-900 truncate max-w-[190px]"
                          title={task.taskName}
                        >
                          {task.taskName}
                        </h3>
                        <p className="text-xs text-gray-600 capitalize">
                          {task.taskType}
                        </p>
                      </div>
                    </div>

                    {/* Actions - now in 3-dot menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="p-2 sm:p-1.5 hover:bg-gray-100 rounded-sm transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                        >
                          <MoreVerticalIcon className="h-4 w-4 text-gray-600" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-24 sm:w-32 min-w-[6rem] sm:min-w-[8rem] bg-white z-50"
                        sideOffset={5}
                        alignOffset={-10}
                      >
                        <DropdownMenuItem
                          onClick={() => {
                            if (task.status !== "DONE") {
                              showEditConfirmation(task.id);
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
                            showDeleteConfirmation(task.id);
                          }}
                          disabled={deletingTaskId === task.id}
                          className={`text-sm py-2 px-3 rounded-none ${
                            deletingTaskId === task.id
                              ? "cursor-not-allowed opacity-50 text-gray-400"
                              : "cursor-pointer hover:bg-red-50"
                          }`}
                        >
                          <Trash2
                            className={`h-3.5 w-3.5 mr-2 ${
                              deletingTaskId === task.id
                                ? "text-gray-400"
                                : "text-red-600"
                            }`}
                          />
                          {deletingTaskId === task.id
                            ? "Deleting..."
                            : "Delete"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

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

                  {/* Status and Priority */}
                  <div className="flex items-center flex-wrap gap-2 mb-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${getStatusColor(
                        task.status,
                      )}`}
                    >
                      {getStatusIcon(task.status)}
                      <span className="ml-1">
                        {task.status.replace("_", " ").toUpperCase()}
                      </span>
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${getPriorityColor(
                        task.priority,
                      )}`}
                    >
                      {task.priority.toUpperCase()}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${RT.chip.primary}`}
                    >
                      <File className="h-3 w-3 mr-1" />
                      REGULAR
                    </span>
                  </div>

                  {/* Progress */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">
                        Progress
                      </span>
                      <span className="text-xs text-gray-500">
                        {task.progress}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center space-x-1.5">
                      <Calendar className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-gray-600">
                        Due:{" "}
                        {task.dueDate
                          ? new Date(task.dueDate)
                              .toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                              .replace(",", "")
                          : "No due date"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Users className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-gray-600">{task.assignedTo}</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      {task.visibility === "public" ? (
                        <Eye className="h-3.5 w-3.5 text-gray-400" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5 text-gray-400" />
                      )}
                      <span className="text-gray-600 capitalize">
                        {task.visibility}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Paperclip className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-gray-600">
                        {task.attachments?.length || 0} Attachment
                        {task.attachments?.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>

                  {/* Labels */}
                  {task.labels?.length ? (
                    <div>
                      <h4 className="text-xs font-medium text-gray-700 mb-1">
                        Labels
                      </h4>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {task.labels.map((label, index) => (
                          <span
                            key={`${label}-${index}`}
                            className="inline-flex items-center px-2 py-0.5 text-[10px] rounded-full bg-gray-100 text-gray-700"
                          >
                            <Tag className="h-3 w-3 mr-1 text-gray-500" />
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Card Footer */}
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
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
                            showEditConfirmation(task.id);
                          }
                        }}
                      >
                        <Edit3 className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                    </div>
                    <Button
                      variant="primary"
                      className="h-7 px-3 text-xs"
                      onClick={() => setLocation(`/tasks/${task.id}`)}
                    >
                      View Details
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
                      <div className="h-12 w-12 rounded-sm bg-blue-100 flex items-center justify-center">
                        <File className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3
                            className="text-lg font-semibold text-gray-900 truncate max-w-[190px]"
                            title={task.taskName}
                          >
                            {task.taskName}
                          </h3>
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                              task.status,
                            )}`}
                          >
                            {getStatusIcon(task.status)}
                            <span className="ml-1">
                              {task.status.replace("_", " ").toUpperCase()}
                            </span>
                          </span>
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getPriorityColor(
                              task.priority,
                            )}`}
                          >
                            {task.priority.toUpperCase()}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                            {task.taskType.toUpperCase()}
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
                        <div className="flex items-center space-x-3 text-sm text-gray-500">
                          <span className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4" />
                            <span>
                              Due:{" "}
                              {task.dueDate
                                ? new Date(task.dueDate)
                                    .toLocaleDateString("en-GB", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    })
                                    .replace(",", "")
                                : "No due date"}
                            </span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <Users className="h-4 w-4" />
                            <span>{task.assignedTo}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            {task.visibility === "public" ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                            <span className="capitalize">
                              {task.visibility}
                            </span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <Paperclip className="h-4 w-4" />
                            <span>{task.attachments?.length || 0} file(s)</span>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">
                          {task.progress}%
                        </div>
                        <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`p-2 rounded-sm ${
                            task.status === "DONE"
                              ? "cursor-not-allowed text-gray-400 opacity-60"
                              : "text-gray-500 hover:bg-gray-100"
                          }`}
                          disabled={task.status === "DONE"}
                          onClick={() => {
                            if (task.status !== "DONE") {
                              showEditConfirmation(task.id);
                            }
                          }}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="primary"
                          className="h-9"
                          onClick={() => setLocation(`/tasks/${task.id}`)}
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {filteredTasks.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <File className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No regular tasks found
            </h3>
            <p className="text-gray-600 mb-3">
              Get started by creating your first regular task.
            </p>
            <Link href="/tasks/create?type=regular">
              <Button variant="primary" className="h-9">
                <Plus className="h-4 w-4 mr-2" />
                Add Regular Task
              </Button>
            </Link>
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
                onClick={() => setCurrentPage(pagination.currentPage - 1)}
                disabled={!pagination.hasPrevPage}
                className="h-9"
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
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-2 text-sm font-medium rounded-md ${
                        pageNum === pagination.currentPage
                          ? "bg-blue-600 text-white"
                          : "text-gray-500 bg-white border border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                },
              )}
              <button
                onClick={() => setCurrentPage(pagination.currentPage + 1)}
                disabled={!pagination.hasNextPage}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
