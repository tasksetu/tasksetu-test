import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Filter,
  Grid3X3,
  List,
  Eye,
  User,
  Calendar,
  FileText,
  MoreHorizontal,
  MessageSquare,
  Users,
  Workflow,
  X,
  MoreVerticalIcon,
  Edit3,
  Trash2,
  Loader,
} from "lucide-react";
import CreateTask from "./CreateTask";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { apiClient } from "../../utils/apiClient";
import { getAuthUser } from "../../utils/auth";
import { useActiveRole } from "../../components/RoleSwitcher";
import { useTaskPriorities } from "@/hooks/useTaskPriorities";
import { getPriorityOptions } from "@/utils/priorityUtils";
import CustomConfirmationModal from "./CustomConfirmationModal";
import SafeHtml, { getTextPreview } from "../../components/common/SafeHtml";
import CustomEditor from "../../components/common/CustomEditor";

export default function ApprovalManager() {
  const queryClient = useQueryClient();

  // Get current user from authentication
  const authUser = getAuthUser();

  // Get active role from context (similar to RegularTaskManager)
  const { activeRole } = useActiveRole();

  // Get dynamic priority options
  const { data: taskPriorities = [] } = useTaskPriorities();
  const priorityOptions = getPriorityOptions(taskPriorities);

  const [currentUser] = useState({
    id: authUser?.id || authUser?._id || 1,
    name: authUser
      ? `${authUser.firstName || ""} ${authUser.lastName || ""}`.trim()
      : "Current User",
    role: activeRole || "manager", // Use activeRole instead of the roles array
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewMode, setViewMode] = useState("list");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [dueDateFilter, setDueDateFilter] = useState("all");
  const [approvalTasks, setApprovalTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editFormData, setEditFormData] = useState({
    taskName: "",
    description: "",
    dueDate: "",
    priority: "medium",
    visibility: "private",
    mode: "any",
  });
  const [editLoading, setEditLoading] = useState(false);
  const [taskNameLength, setTaskNameLength] = useState(0);

  // Delete confirmation modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Toast notification state for approval actions
  const [notification, setNotification] = useState({
    show: false,
    message: "",
    type: "success", // 'success' or 'error'
  });

  // Show notification function
  const showNotification = (message, type = "success") => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: "", type: "success" });
    }, 3000);
  };

  // Fetch approval tasks from API
  const fetchApprovalTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get(
        "/api/tasks/filter/approval?page=1&limit=20",
      );

      console.log("API Response:", response.data);
      console.log("Active Role:", activeRole);
      console.log("Current User Role:", currentUser.role);

      if (response.data.success) {
        // Use activeRole from context, similar to RegularTaskManager
        const currentRole =
          activeRole ||
          Object.keys(response.data.data?.roles || {})[0] ||
          "manager";
        console.log("Using Role for API:", currentRole);

        // Extract tasks based on current role from the nested response structure
        const roleBasedTasks = response.data.data?.roles?.[currentRole] || [];

        console.log("Role Based Tasks:", roleBasedTasks);

        // Transform API data to match the component's expected format
        const transformedTasks = roleBasedTasks.map((task) => ({
          id: task._id,
          title: task.title,
          description: task.description,
          mode: task.approvalMode || "any", // 'any', 'all', 'sequential'
          status: task.approvalStatus || "pending",
          approvers: task.approvers || task.approvalDetails || [],
          creator: task.createdBy
            ? `${task.createdBy.firstName} ${task.createdBy.lastName}`
            : "Unknown",
          createdAt: new Date(task.createdAt)
            .toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
            .replace(",", ""),
          dueDate: task.dueDate
            ? new Date(task.dueDate)
                .toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
                .replace(",", "")
            : "",
          autoApprove: task.autoApproveEnabled || false,
          priority: task.priority || "medium",
        }));

        console.log("Transformed Tasks:", transformedTasks);
        setApprovalTasks(transformedTasks);
      } else {
        setError("Failed to fetch approval tasks");
      }
    } catch (err) {
      console.error("Error fetching approval tasks:", err);
      setError("Failed to fetch approval tasks");
      // Fallback to empty array if API fails
      setApprovalTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovalTasks();
  }, [activeRole]); // Refetch when activeRole changes

  // Handle edit and delete actions
  const handleEdit = (taskId) => {
    const task = approvalTasks.find((t) => t.id === taskId);
    if (!task) return;

    // Prefill form data with task information
    const dueDateFormatted = task.dueDate
      ? new Date(task.dueDate.split("-").reverse().join("-"))
          .toISOString()
          .split("T")[0]
      : "";

    setEditFormData({
      taskName: task.title || "",
      description: task.description || "",
      dueDate: dueDateFormatted,
      priority: task.priority || "medium",
      visibility: "private",
      mode: task.mode || "any",
    });
    setTaskNameLength(task.title?.length || 0);

    setEditingTask(task);
    setEditModalOpen(true);
  };

  const handleDelete = (taskId) => {
    const task = approvalTasks.find((t) => t.id === taskId);
    if (!task) return;

    setDeleteError(null);
    setTaskToDelete(task);
    setDeleteModalOpen(true);
  };

  // Confirm delete task
  const confirmDelete = async () => {
    if (!taskToDelete) return;

    setDeleteLoading(true);
    try {
      const response = await apiClient.delete(
        `/api/tasks/delete/${taskToDelete.id}`,
      );
      console.log("Delete response:", response.data);

      // Remove task from local state
      setApprovalTasks((prevTasks) =>
        prevTasks.filter((task) => task.id !== taskToDelete.id),
      );

      // Show success notification
      showNotification("Task deleted successfully!", "success");

      // Close modal and reset state
      setDeleteModalOpen(false);
      setTaskToDelete(null);
      setDeleteError(null);
    } catch (error) {
      console.error("Error deleting task:", error);
      const errorMsg = error.response?.data?.message || "Failed to delete task";
      setDeleteError(errorMsg);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Cancel delete operation
  const cancelDelete = () => {
    setDeleteModalOpen(false);
    setTaskToDelete(null);
    setDeleteError(null);
  };

  // Handle edit form submission
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editFormData.taskName.trim() || !editingTask) return;

    setEditLoading(true);
    try {
      // Transform data to match backend API expectations
      const updatePayload = {
        taskName: editFormData.taskName,
        description: editFormData.description,
        priority: editFormData.priority,
        dueDate: editFormData.dueDate,
        visibility: editFormData.visibility,
        approvalMode: editFormData.mode,
      };

      console.log("📝 [EDIT] Updating approval task:", updatePayload);

      // Make API call to update the task
      const response = await apiClient.put(
        `/api/tasks/${editingTask.id}`,
        updatePayload,
      );

      console.log("📝 [EDIT] Update response:", response.data);

      if (response.data && response.data.success) {
        // Show success notification
        showNotification("Task updated successfully!", "success");

        // Close modal and reset form
        setEditModalOpen(false);
        setEditingTask(null);
        setEditFormData({
          taskName: "",
          description: "",
          dueDate: "",
          priority: "medium",
          visibility: "private",
          mode: "any",
        });
        setTaskNameLength(0);

        // Refresh data from API
        setTimeout(() => {
          fetchApprovalTasks();
        }, 500);
      } else {
        showNotification("Failed to update task", "error");
      }
    } catch (error) {
      console.error("❌ [EDIT] Error updating task:", error);
      showNotification(
        error.response?.data?.message || "Error updating task",
        "error",
      );
    } finally {
      setEditLoading(false);
    }
  };

  // Handle edit form cancel
  const handleEditCancel = () => {
    setEditFormData({
      taskName: "",
      description: "",
      dueDate: "",
      priority: "medium",
      visibility: "private",
      mode: "any",
    });
    setTaskNameLength(0);
    setEditModalOpen(false);
    setEditingTask(null);
  };

  // Get today's date for validation
  const getTodayDate = () => {
    return new Date().toISOString().split("T")[0];
  };

  const getApprovalStatus = (task) => {
    const { approvers, mode } = task;
    const approved = approvers.filter((a) => a.status === "approved");
    const rejected = approvers.filter((a) => a.status === "rejected");
    const pending = approvers.filter((a) => a.status === "pending");

    if (rejected.length > 0 && mode !== "any") return "rejected";

    switch (mode) {
      case "any":
        return approved.length > 0
          ? "approved"
          : pending.length > 0
            ? "pending"
            : "waiting";
      case "all":
        return approved.length === approvers.length
          ? "approved"
          : rejected.length > 0
            ? "rejected"
            : "pending";
      case "sequential":
        const currentIndex = approved.length;
        if (currentIndex === approvers.length) return "approved";
        if (rejected.length > 0) return "rejected";
        return "pending";
      default:
        return "pending";
    }
  };

  const canUserApprove = (task, approver) => {
    if (approver.status !== "pending") return false;
    if (task.mode === "sequential") {
      const approverIndex = task.approvers.findIndex(
        (a) => a.id === approver.id,
      );
      const previousApproved = task.approvers
        .slice(0, approverIndex)
        .every((a) => a.status === "approved");
      return previousApproved;
    }
    return true;
  };

  const handleApproval = async (taskId, approverId, action, comment) => {
    try {
      // Make API call to update the task
      const response = await apiClient.put(`/api/tasks/${taskId}`, {
        approvalStatus: action,
        approvalComment: comment,
        approverId: approverId,
      });

      if (response.data && response.data.success) {
        // Update local state immediately for better UX
        setApprovalTasks((tasks) =>
          tasks.map((task) => {
            if (task.id !== taskId) return task;

            const updatedApprovers = task.approvers.map((approver) => {
              if (approver.id === approverId) {
                return {
                  ...approver,
                  status: action,
                  comment: comment || null,
                  approvedAt: new Date().toISOString().split("T")[0],
                };
              }
              return approver;
            });

            return {
              ...task,
              approvers: updatedApprovers,
              status: getApprovalStatus({
                ...task,
                approvers: updatedApprovers,
              }),
            };
          }),
        );

        // 🔔 Invalidate notifications cache to show approval notification immediately
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });

        // Show success notification
        showNotification(`Task ${action} successfully!`, "success");

        // Refresh data from API to ensure consistency
        setTimeout(() => {
          fetchApprovalTasks();
        }, 500);
      } else {
        showNotification("Failed to update approval task", "error");
      }
    } catch (error) {
      console.error("Error updating approval task:", error);
      showNotification("Error updating approval task", "error");
    }
  };

  const handleCreateApprovalTask = (taskData) => {
    setApprovalTasks([...approvalTasks, taskData]);
    setShowCreateModal(false);
    // Optionally refresh the data from API
    fetchApprovalTasks();
  };

  // Filter tasks
  const filteredTasks = approvalTasks.filter((task) => {
    const overallStatus = getApprovalStatus(task);
    const statusMatch =
      statusFilter === "all" || overallStatus === statusFilter;
    const modeMatch = modeFilter === "all" || task.mode === modeFilter;

    const matchesSearch =
      !searchTerm ||
      task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.creator?.toLowerCase().includes(searchTerm.toLowerCase());

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

    return statusMatch && modeMatch && matchesSearch && matchesDueDate;
  });

  // Calculate stats
  const stats = {
    total: approvalTasks.length,
    pending: approvalTasks.filter(
      (task) => getApprovalStatus(task) === "pending",
    ).length,
    approved: approvalTasks.filter(
      (task) => getApprovalStatus(task) === "approved",
    ).length,
    rejected: approvalTasks.filter(
      (task) => getApprovalStatus(task) === "rejected",
    ).length,
    waiting: approvalTasks.filter(
      (task) => getApprovalStatus(task) === "waiting",
    ).length,
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-4 w-4 text-amber-600" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "approved":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "rejected":
        return "bg-red-100 text-red-800 border-red-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-200";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-amber-100 text-amber-800 border-amber-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="approval-square py-3 px-6 flex flex-1 flex-col min-h-0 bg-gray-50">
      <style>{`
        .approval-square [class*="rounded"]:not(.rounded-full):not([class*="avatar"]):not([class*="indicator"]) {
          border-radius: 4px !important;
        }
        .approval-square [data-loader-ring] {
          border-radius: 9999px !important;
        }
        .approval-square input:not([type="checkbox"]):not([type="radio"]),
        .approval-square select,
        .approval-square textarea,
        .approval-square button:not(.rounded-full) {
          border-radius: 4px !important;
        }
        [role="dialog"] [class*="rounded"]:not(.rounded-full):not([class*="avatar"]):not([class*="indicator"]),
        [role="dialog"] input:not([type="checkbox"]):not([type="radio"]),
        [role="dialog"] select,
        [role="dialog"] textarea,
        [role="dialog"] button:not(.rounded-full),
        [role="menu"] [class*="rounded"]:not(.rounded-full):not([class*="avatar"]):not([class*="indicator"]),
        [role="listbox"] [class*="rounded"]:not(.rounded-full):not([class*="avatar"]):not([class*="indicator"]),
        [data-radix-popper-content-wrapper] [class*="rounded"]:not(.rounded-full):not([class*="avatar"]):not([class*="indicator"]) {
          border-radius: 4px !important;
        }
      `}</style>
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-normal m-0" style={{ color: "#676a6c" }}>
            Approvals
          </h1>
          <p className="mt-0 text-sm text-blue-600">
            Manage approval workflows and tasks
          </p>
        </div>
        <div className="mt-1 lg:mt-0 w-full sm:w-auto flex justify-center sm:justify-end">
          <Link href="/tasks/create?type=approval">
            <Button
              variant="primary"
              className="h-8 bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Add Approval Task
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-3">
          <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Total</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">
                  {stats.total}
                </p>
              </div>
              <Workflow className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400" />
            </div>
          </div>
          <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Pending</p>
                <p className="text-xl sm:text-2xl font-bold text-yellow-600">
                  {stats.pending}
                </p>
              </div>
              <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-400" />
            </div>
          </div>
          <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Approved</p>
                <p className="text-xl sm:text-2xl font-bold text-amber-600">
                  {stats.approved}
                </p>
              </div>
              <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-400" />
            </div>
          </div>
          <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Rejected</p>
                <p className="text-xl sm:text-2xl font-bold text-red-600">
                  {stats.rejected}
                </p>
              </div>
              <XCircle className="h-6 w-6 sm:h-8 sm:w-8 text-red-400" />
            </div>
          </div>
          {/* <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-3 sm:p-4 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Waiting</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-600">
                  {stats.waiting}
                </p>
              </div>
              <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400" />
            </div>
          </div> */}
        </div>

        {/* Filters and View Controls */}
        <div className="bg-white rounded-sm shadow-sm border border-gray-200 px-3 sm:px-4 py-2 sm:py-3 mb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-1.5 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
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
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-8 pl-9 pr-3 border border-gray-300 rounded-md text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>

              <div className="flex space-x-3 w-full sm:w-auto ml-1">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="flex-1 sm:flex-none h-8 px-2 sm:px-3 border border-gray-300 rounded-md text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="waiting">Waiting</option>
                </select>

                <select
                  value={modeFilter}
                  onChange={(e) => setModeFilter(e.target.value)}
                  className="flex-1 sm:flex-none h-8 px-2 sm:px-3 border border-gray-300 rounded-md text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                >
                  <option value="all">All Modes</option>
                  <option value="any">Any Approver</option>
                  <option value="all">All Approvers</option>
                  <option value="sequential">Sequential</option>
                </select>

                <select
                  value={dueDateFilter}
                  onChange={(e) => setDueDateFilter(e.target.value)}
                  className="flex-1 sm:flex-none h-8 px-2 sm:px-3 border border-gray-300 rounded-md text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
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

            <div className="flex items-center space-x-2 ml-2">
              <div className="flex items-cente rounded-sm p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 sm:p-2 rounded-md transition-colors ${
                    viewMode === "grid"
                      ? "bg-white shadow-sm text-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Grid3X3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 sm:p-2 rounded-md transition-colors ${
                    viewMode === "list"
                      ? "bg-white shadow-sm text-blue-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <List className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Active Filter Badges */}
          {(searchTerm ||
            statusFilter !== "all" ||
            modeFilter !== "all" ||
            dueDateFilter !== "all") && (
            <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
              <span className="text-xs text-gray-500">Active:</span>
              {searchTerm && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  Search: {searchTerm}
                  <button
                    onClick={() => setSearchTerm("")}
                    className="ml-0.5 hover:text-amber-900"
                  >
                    ×
                  </button>
                </span>
              )}
              {statusFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  Status: {statusFilter}
                  <button
                    onClick={() => setStatusFilter("all")}
                    className="ml-0.5 hover:text-amber-900"
                  >
                    ×
                  </button>
                </span>
              )}
              {modeFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  Mode: {modeFilter}
                  <button
                    onClick={() => setModeFilter("all")}
                    className="ml-0.5 hover:text-amber-900"
                  >
                    ×
                  </button>
                </span>
              )}
              {dueDateFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  Due: {dueDateFilter.replace(/_/g, " ")}
                  <button
                    onClick={() => setDueDateFilter("all")}
                    className="ml-0.5 hover:text-amber-900"
                  >
                    ×
                  </button>
                </span>
              )}
              <button
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setModeFilter("all");
                  setDueDateFilter("all");
                }}
                className="text-xs text-amber-600 hover:text-amber-800 font-medium ml-1"
              >
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* Tasks Grid/List */}
        {loading ? (
          <div className="task-view-container task-detail-page min-h-screen overflow-x-hidden px-3 sm:px-4">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="flex flex-col items-center gap-3">
                <Loader className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-lg text-gray-600">
                  Loading approval tasks...
                </p>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-8 sm:py-12">
            <AlertCircle className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-red-400 mb-3" />
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
              Error loading tasks
            </h3>
            <p className="text-sm sm:text-base text-gray-600 mb-3">{error}</p>
            <Button
              variant="primary"
              onClick={fetchApprovalTasks}
              className="h-9 bg-amber-600 hover:bg-amber-700"
            >
              Try Again
            </Button>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredTasks.map((task) => (
              <ApprovalTaskCard
                key={task.id}
                task={task}
                currentUser={currentUser}
                onApproval={handleApproval}
                onEdit={handleEdit}
                onDelete={handleDelete}
                getApprovalStatus={getApprovalStatus}
                canUserApprove={canUserApprove}
                getStatusIcon={getStatusIcon}
                getStatusColor={getStatusColor}
                getPriorityColor={getPriorityColor}
              />
            ))}
          </div>
        ) : (
          // List View
          <div className="bg-white rounded-sm shadow-sm border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-200">
              {filteredTasks.map((task) => (
                <ApprovalTaskListItem
                  key={task.id}
                  task={task}
                  currentUser={currentUser}
                  onApproval={handleApproval}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  getApprovalStatus={getApprovalStatus}
                  canUserApprove={canUserApprove}
                  getStatusIcon={getStatusIcon}
                  getStatusColor={getStatusColor}
                  getPriorityColor={getPriorityColor}
                />
              ))}
            </div>
          </div>
        )}

        {!loading && !error && filteredTasks.length === 0 && (
          <div className="text-center py-8 sm:py-12">
            <CheckCircle className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mb-3" />
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-1">
              No approval tasks found
            </h3>
            <p className="text-sm sm:text-base text-gray-600 mb-3">
              Get started by creating your first approval task.
            </p>
            {/* <div className="flex justify-center">
              <Link href="/tasks/create?type=approval">
                <Button
                  variant="primary"
                  className="h-8 bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2" />
                  Create Approval Task
                </Button>
              </Link>
            </div> */}
          </div>
        )}
      </div>

      {/* Edit Task Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-sm max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-4">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-3 sm:mb-3">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-sm bg-amber-100 flex items-center justify-center">
                    <Edit3 className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                      Edit Approval Task
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600">
                      Task #{editingTask?.id || "Unknown"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-md"
                  onClick={handleEditCancel}
                >
                  <X className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
                </Button>
              </div>
            </div>

            {/* Modal Body */}
            <form
              onSubmit={handleEditSubmit}
              className="flex-1 overflow-y-auto px-6 py-4"
            >
              {/* <div className="space-y-3"> */}
              <div className="space-y-3">
                {/* Task Information Section */}
                <div className="grid grid-cols-1 gap-3">
                  {/* Task Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Task Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={editFormData.taskName}
                        onChange={(e) => {
                          const v = (e.target.value || "").slice(0, 100);
                          setEditFormData({ ...editFormData, taskName: v });
                          setTaskNameLength(v.length);
                        }}
                        placeholder="Enter task name..."
                        className="w-full border border-gray-300 rounded-md h-9 px-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        maxLength={100}
                        required
                        autoFocus
                      />
                      <div className="absolute right-3 top-2.5 text-xs font-medium text-gray-500 bg-white px-2 rounded">
                        {taskNameLength}/100
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <CustomEditor
                      value={editFormData.description}
                      onChange={(value) =>
                        setEditFormData({ ...editFormData, description: value })
                      }
                      placeholder="Add task description or notes..."
                    />
                  </div>
                </div>

                {/* Task Settings Section */}
                <div className="grid grid-cols-3 gap-3">
                  {/* Due Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Due Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={editFormData.dueDate}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          dueDate: e.target.value,
                        })
                      }
                      min={getTodayDate()}
                      className="w-full border border-gray-300 rounded-md h-9 px-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority
                    </label>
                    <select
                      value={editFormData.priority}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          priority: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 rounded-md h-9 px-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {priorityOptions.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Approval Mode */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Approval Mode
                    </label>
                    <select
                      value={editFormData.mode}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          mode: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 rounded-md h-9 px-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="any">Any One</option>
                      <option value="all">All Must Approve</option>
                      <option value="sequential">Sequential</option>
                    </select>
                  </div>
                </div>

                {/* Visibility Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Task Visibility <span className="text-red-500">*</span>
                  </label>
                  <div className="flex space-x-3">
                    <label className="flex items-center px-4 py-2.5 cursor-pointer transition-all ">
                      <input
                        type="radio"
                        value="private"
                        checked={editFormData.visibility === "private"}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            visibility: e.target.value,
                          })
                        }
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-900">
                        Private
                      </span>
                    </label>
                    <label className="flex items-center px-4 py-2.5 cursor-pointer transition-all ">
                      <input
                        type="radio"
                        value="public"
                        checked={editFormData.visibility === "public"}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            visibility: e.target.value,
                          })
                        }
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-900">
                        Public
                      </span>
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Choose whether this task is visible to all or only assigned
                    members
                  </p>
                </div>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleEditCancel}
                  className="h-9"
                  disabled={editLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  onClick={handleEditSubmit}
                  className="h-9"
                  disabled={editLoading || !editFormData.taskName.trim()}
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

      {/* Success/Error Notification Toast */}
      {notification.show && (
        <div className="fixed top-2 right-2 sm:top-4 sm:right-4 z-50 max-w-[90vw] sm:max-w-md">
          <div
            className={`px-4 sm:px-6 py-3 sm:py-4 rounded-sm shadow-lg flex items-center space-x-2 sm:space-x-3 ${
              notification.type === "success"
                ? "bg-amber-500 text-white"
                : "bg-red-500 text-white"
            }`}
          >
            <div className="flex-shrink-0">
              {notification.type === "success" ? (
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-xs sm:text-sm font-medium">
                {notification.message}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                setNotification({ show: false, message: "", type: "success" })
              }
              className="flex-shrink-0 ml-2 sm:ml-4 text-white hover:text-gray-200"
            >
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen &&
        (deleteError ? (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-[2000] flex items-center justify-center">
            <div className="bg-white rounded-sm shadow-xl p-4 w-96 max-w-[90vw]">
              <h3 className="text-lg font-semibold text-red-600 mb-3">
                Cannot Delete Task
              </h3>
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-sm">
                <p className="text-red-700 text-sm font-medium">
                  {deleteError}
                </p>
              </div>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  className="h-9"
                  onClick={cancelDelete}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <CustomConfirmationModal
            isOpen={deleteModalOpen}
            onClose={cancelDelete}
            onConfirm={confirmDelete}
            title="Delete Task"
            message={`Are you sure you want to delete "${taskToDelete?.title}"? This action cannot be undone.`}
            type="danger"
            confirmText="Delete"
            cancelText="Cancel"
            isLoading={deleteLoading}
          />
        ))}
    </div>
  );
}

function ApprovalTaskCard({
  task,
  currentUser,
  onApproval,
  onEdit,
  onDelete,
  getApprovalStatus,
  canUserApprove,
  getStatusIcon,
  getStatusColor,
  getPriorityColor,
}) {
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedApprover, setSelectedApprover] = useState(null);

  const overallStatus = getApprovalStatus(task);
  const userApprover = task.approvers.find((a) => a.id === currentUser.id);
  const canApprove = userApprover && canUserApprove(task, userApprover);

  const handleApproveClick = (approver) => {
    setSelectedApprover(approver);
    setShowApprovalModal(true);
  };

  const getModeIcon = (mode) => {
    switch (mode) {
      case "any":
        return <User className="h-4 w-4" />;
      case "all":
        return <Users className="h-4 w-4" />;
      case "sequential":
        return <Workflow className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  return (
    <>
      <div className="flex flex-col justify-between bg-white rounded-sm shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200">
        {/* Header */}
        <div className="p-3 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-sm bg-amber-100 flex items-center justify-center">
                <CheckCircle className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <h3
                  className="text-sm font-semibold text-gray-900 leading-tight truncate max-w-[190px]"
                  title={task.title}
                >
                  {task.title}
                </h3>
                <p className="text-xs text-gray-500">{task.creator}</p>
              </div>
            </div>

            {/* Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="p-1 hover:bg-gray-100 rounded-md"
                >
                  <MoreVerticalIcon className="h-4 w-4 text-gray-600" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36 bg-white">
                <DropdownMenuItem
                  onClick={() => {
                    if (task.status === "pending") {
                      onEdit(task.id);
                    }
                  }}
                  disabled={task.status !== "pending"}
                  className={`text-sm py-2 px-3 rounded-none ${
                    task.status !== "pending"
                      ? "cursor-not-allowed opacity-50 text-gray-400"
                      : "cursor-pointer hover:bg-gray-50"
                  }`}
                >
                  <Edit3
                    className={`h-3.5 w-3.5 mr-2 ${
                      task.status !== "pending"
                        ? "text-gray-400"
                        : "text-gray-600"
                    }`}
                  />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    onDelete(task.id);
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
            className="text-xs text-gray-600 mt-2 line-clamp-2 truncate max-w-[180px]"
            title={getTextPreview(task.description, 200)}
          >
            <SafeHtml
              html={task.description}
              truncate={true}
              maxLength={80}
              as="span"
            />
          </p>

          {/* Status & Priority */}
          <div className="flex items-center space-x-1 mt-2 flex-wrap">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${getStatusColor(
                overallStatus,
              )}`}
            >
              {getStatusIcon(overallStatus)}
              <span className="ml-1 capitalize">{overallStatus}</span>
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${getPriorityColor(
                task.priority,
              )}`}
            >
              {task.priority.toUpperCase()}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
              {getModeIcon(task.mode)}
              <span className="ml-1 capitalize">{task.mode}</span>
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="p-3 space-y-2 text-xs">
          {/* Details */}
          <div className="grid grid-cols-2 gap-1">
            <div className="flex items-center space-x-1 text-gray-600">
              <Calendar className="h-3.5 w-3.5" />
              <span>{task.dueDate || "No due date"}</span>
            </div>
            <div className="flex items-center space-x-1 text-gray-600 justify-end">
              <Users className="h-3.5 w-3.5" />
              <span>{task.approvers.length} Approvers</span>
            </div>
          </div>

          {/* Approval Chain */}
          <div>
            <h4 className="text-xs font-semibold text-gray-700 mb-1">
              Approval Chain
            </h4>
            <div className="space-y-1.5">
              {task.approvers.map((approver) => (
                <div
                  key={approver.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                >
                  <div className="flex items-center space-x-2">
                    <div
                      className={`h-6 w-6 rounded-full flex items-center justify-center ${
                        approver.status === "approved"
                          ? "bg-green-100"
                          : approver.status === "rejected"
                            ? "bg-red-100"
                            : approver.status === "pending"
                              ? "bg-yellow-100"
                              : "bg-gray-100"
                      }`}
                    >
                      {approver.status === "approved" ? (
                        <CheckCircle className="h-3 w-3 text-amber-600" />
                      ) : approver.status === "rejected" ? (
                        <XCircle className="h-3 w-3 text-red-600" />
                      ) : approver.status === "pending" ? (
                        <Clock className="h-3 w-3 text-yellow-600" />
                      ) : (
                        <User className="h-3 w-3 text-gray-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-900">
                        {approver.name}
                      </p>
                      <p className="text-[10px] text-gray-500 capitalize">
                        {approver.role}
                      </p>
                    </div>
                  </div>

                  {approver.status === "pending" &&
                    canUserApprove(task, approver) &&
                    approver.id === currentUser.id && (
                      <Button
                        variant="primary"
                        className="h-6 px-2 py-0.5 text-[10px] bg-amber-600 hover:bg-amber-700"
                        onClick={() => handleApproveClick(approver)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Review
                      </Button>
                    )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-[11px] rounded-b-lg">
          <span className="text-gray-500">Created: {task.createdAt}</span>
          <Link href={`/tasks/${task.id}`}>
            <Button
              variant="ghost"
              className="h-7 text-xs text-amber-600 hover:text-amber-700 font-medium"
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              View
            </Button>
          </Link>
        </div>
      </div>

      {showApprovalModal && (
        <ApprovalModal
          task={task}
          approver={selectedApprover}
          onApproval={onApproval}
          onClose={() => {
            setShowApprovalModal(false);
            setSelectedApprover(null);
          }}
        />
      )}
    </>
  );
}

function ApprovalTaskListItem({
  task,
  currentUser,
  onApproval,
  onEdit,
  onDelete,
  getApprovalStatus,
  canUserApprove,
  getStatusIcon,
  getStatusColor,
  getPriorityColor,
}) {
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedApprover, setSelectedApprover] = useState(null);

  const overallStatus = getApprovalStatus(task);
  const userApprover = task.approvers.find((a) => a.id === currentUser.id);
  const canApprove = userApprover && canUserApprove(task, userApprover);

  const handleApproveClick = (approver) => {
    setSelectedApprover(approver);
    setShowApprovalModal(true);
  };

  return (
    <>
      <div className="p-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1">
            <div className="h-12 w-12 rounded-sm bg-amber-100 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-amber-600" />
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
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                    overallStatus,
                  )}`}
                >
                  {getStatusIcon(overallStatus)}
                  <span className="ml-1 capitalize">{overallStatus}</span>
                </span>
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getPriorityColor(
                    task.priority,
                  )}`}
                >
                  {task.priority.toUpperCase()}
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
                  <span>Due: {task.dueDate || "No due date"}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <User className="h-4 w-4" />
                  <span>{task.creator}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <Users className="h-4 w-4" />
                  <span>{task.approvers.length} approvers</span>
                </span>
                <span className="capitalize">{task.mode} mode</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">
                {task.approvers.filter((a) => a.status === "approved").length}/
                {task.approvers.length} Approved
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {canApprove && (
                <Button
                  variant="primary"
                  className="h-8 bg-amber-600 hover:bg-amber-700"
                  onClick={() => handleApproveClick(userApprover)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Review
                </Button>
              )}
              <Link href={`/tasks/${task.id}`}>
                <Button
                  variant="ghost"
                  className="h-8 text-sm text-amber-600 hover:text-amber-700 font-medium"
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Details
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {showApprovalModal && (
        <ApprovalModal
          task={task}
          approver={selectedApprover}
          onApproval={onApproval}
          onClose={() => {
            setShowApprovalModal(false);
            setSelectedApprover(null);
          }}
        />
      )}
    </>
  );
}

function ApprovalModal({ task, approver, onApproval, onClose }) {
  const [action, setAction] = useState("");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (action && !isSubmitting) {
      setIsSubmitting(true);
      try {
        await onApproval(task.id, approver.id, action, comment);
        // Close modal after successful submissions
        onClose();
      } catch (error) {
        console.error("Error submitting approval:", error);
        // Keep modal open on error so user can retry
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-sm max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-4">
          <div className="flex items-center justify-between mb-3 sm:mb-3">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">
              Review Approval
            </h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-md"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
            </Button>
          </div>

          <div className="mb-3 sm:mb-3">
            <h4
              className="text-sm sm:text-base font-medium text-gray-900 mb-2 truncate max-w-[190px]"
              title={task.title}
            >
              {task.title}
            </h4>
            <p
              className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-3 truncate max-w-[180px]"
              title={getTextPreview(task.description, 200)}
            >
              <SafeHtml
                html={task.description}
                truncate={true}
                maxLength={100}
                as="span"
              />
            </p>

            <div className="bg-gray-50 p-2 sm:p-3 rounded-md">
              <p className="text-xs sm:text-sm">
                <span className="font-medium">Approver:</span> {approver.name}
              </p>
              <p className="text-xs sm:text-sm">
                <span className="font-medium">Role:</span> {approver.role}
              </p>
            </div>
          </div>

          <div className="mb-3 sm:mb-3">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              Your Decision
            </label>
            <div className="flex space-x-2 sm:space-x-3">
              <Button
                variant={action === "approved" ? "primary" : "outline"}
                onClick={() => setAction("approved")}
                className={`flex-1 sm:flex-none h-9 text-xs sm:text-sm ${
                  action === "approved"
                    ? "bg-green-100 text-green-800 border border-green-200 hover:bg-green-200"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                Approve
              </Button>
              <Button
                variant={action === "rejected" ? "destructive" : "outline"}
                onClick={() => setAction("rejected")}
                className={`flex-1 sm:flex-none h-9 text-xs sm:text-sm ${
                  action === "rejected"
                    ? "bg-red-100 text-red-800 border border-red-200 hover:bg-red-200"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                Reject
              </Button>
            </div>
          </div>

          <div className="mb-3 sm:mb-3">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              Comment (Optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add your comment..."
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              rows={3}
            />
          </div>

          <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
            <Button
              variant="outline"
              className="h-9 w-full sm:w-auto"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="h-9 w-full sm:w-auto bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              onClick={handleSubmit}
              disabled={!action || isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit Review"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
