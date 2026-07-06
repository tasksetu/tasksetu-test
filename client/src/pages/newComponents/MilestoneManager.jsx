import React, { useEffect, useState } from "react";
import axios from "axios";
import { taskService } from "../../services/taskService";
import { createPortal } from "react-dom";
import LinkedTasksSelector from "../../components/LinkedTasksSelector";
import Select from "react-select";
import AssigneeSearchSelect from "../../components/common/AssigneeSearchSelect";
import CustomEditor from "../../components/common/CustomEditor";
import SafeHtml from "../../components/common/SafeHtml";
import { useShowToast } from "@/utils/ToastMessage";
import { useTaskStatuses } from "@/hooks/useTaskStatuses";
import { useTaskPriorities } from "@/hooks/useTaskPriorities";
import { useAssignmentOptions } from "../../features/shared/hooks/useAssignmentOptions";
import { getPriorityOptions } from "@/utils/priorityUtils";
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
  Trash2,
  Share2,
  X,
  MoreVerticalIcon,
  Link as LinkIcon,
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

// Helper functions moved outside component
const getApiBaseUrl = () => {
  if (
    typeof process !== "undefined" &&
    process.env &&
    process.env.REACT_APP_API_URL
  ) {
    return process.env.REACT_APP_API_URL;
  }
  const { protocol, hostname } = window.location;
  const port = hostname === "localhost" ? "5000" : "";
  return `${protocol}//${hostname}${port ? ":" + port : ""}/api`;
};

const API_BASE_URL = getApiBaseUrl();

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
    medium: "bg-blue-100 text-blue-800 border-blue-200",
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

// Calculate progress based on status (same logic as RegularTaskManager)
const calculateProgress = (status) => {
  const statusLower = (status || "").toLowerCase();
  if (statusLower === "completed" || statusLower === "done") return 100;
  if (statusLower === "in_progress" || statusLower === "inprogress") return 50;
  return 0; // not_started, open, or any other status
};

export default function MilestoneManager() {
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { showSuccessToast, showErrorToast } = useShowToast();
  const { canAssignToOthers } = useAssignmentOptions();

  const [showAddForm, setShowAddForm] = useState(false);
  const [viewMode, setViewMode] = useState("list");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { data: taskStatuses = [] } = useTaskStatuses();
  const { data: taskPriorities = [] } = useTaskPriorities();
  const priorityOptions = getPriorityOptions(taskPriorities);
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dueDateFilter, setDueDateFilter] = useState("all");

  // Edit Modal States
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);

  // Delete Confirmation Modal States
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({
    isOpen: false,
    milestoneId: null,
    milestoneName: "",
    isDeleting: false,
  });
  const [deleteError, setDeleteError] = useState(null);

  // Filter milestones
  const filteredMilestones = milestones.filter((milestone) => {
    const matchesSearch =
      !searchTerm ||
      (milestone.taskName &&
        milestone.taskName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (milestone.assignedTo &&
        milestone.assignedTo.toLowerCase().includes(searchTerm.toLowerCase()));

    const statusMatch =
      statusFilter === "all" || milestone.status === statusFilter;
    const priorityMatch =
      priorityFilter === "all" || milestone.priority === priorityFilter;

    const matchesDueDate = (() => {
      if (dueDateFilter === "all") return true;
      if (!milestone.dueDate) return dueDateFilter === "no_due_date";
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(milestone.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      const timeDiff = dueDate.getTime() - today.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
      switch (dueDateFilter) {
        case "overdue":
          return daysDiff < 0;
        case "due_today":
          return daysDiff === 0;
        case "due_tomorrow":
          return daysDiff === 1;
        case "due_this_week":
          return daysDiff >= 0 && daysDiff <= 7;
        case "due_next_week":
          return daysDiff > 7 && daysDiff <= 14;
        case "due_this_month":
          return daysDiff >= 0 && daysDiff <= 30;
        case "no_due_date":
          return false;
        default:
          return true;
      }
    })();

    return matchesSearch && statusMatch && priorityMatch && matchesDueDate;
  });

  const stats = {
    total: milestones.length,
    completed: milestones.filter((m) => {
      const s = (m.status || "").toUpperCase();
      return s === "DONE" || s === "COMPLETED";
    }).length,
    inProgress: milestones.filter((m) => {
      const s = (m.status || "").toUpperCase();
      return s === "INPROGRESS" || s === "IN_PROGRESS";
    }).length,
    notStarted: milestones.filter((m) => {
      const s = (m.status || "").toUpperCase();
      return s === "OPEN" || s === "TODO" || s === "NOT_STARTED";
    }).length,
    overdue: milestones.filter((m) => {
      const s = (m.status || "").toUpperCase();
      const isNotDone = s !== "DONE" && s !== "COMPLETED" && s !== "CANCELLED";
      return isNotDone && m.dueDate && new Date(m.dueDate) < new Date();
    }).length,
  };

  useEffect(() => {
    const fetchMilestones = async () => {
      try {
        setLoading(true);

        const filters = { page: 1, limit: 20 };

        const res = await taskService.getTasksByType("milestone", filters);
        console.log("🔍 Milestone API Response:", res?.data);

        // ✅ Get current user role from localStorage or auth context
        const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
        const userRoles = Array.isArray(currentUser.role)
          ? currentUser.role
          : [currentUser.role];

        console.log("🔍 Current User Roles:", userRoles);

        let allMilestones = [];

        // 🔹 Org Admin: Show ALL milestones (org_admin + manager + employee)
        // Document Module 2.4.2: "Company Admins have visibility of all tasks within their organization"
        if (
          userRoles.includes("org_admin") ||
          userRoles.includes("company_admin")
        ) {
          console.log("✅ ORG ADMIN: Fetching all milestones from all roles");

          const orgAdminMilestones = res?.data?.roles?.org_admin || [];
          const managerMilestones = res?.data?.roles?.manager || [];
          const employeeMilestones = res?.data?.roles?.employee || [];

          allMilestones = [
            ...orgAdminMilestones,
            ...managerMilestones,
            ...employeeMilestones,
          ];

          console.log("✅ Total milestones for Org Admin:", {
            orgAdmin: orgAdminMilestones.length,
            manager: managerMilestones.length,
            employee: employeeMilestones.length,
            total: allMilestones.length,
          });
        }
        // 🔹 Manager: Show only manager milestones
        // Document Module 2.4.3: "Managers can create milestones only for users reporting to them"
        else if (userRoles.includes("manager")) {
          console.log("✅ MANAGER: Fetching only manager milestones");
          allMilestones = res?.data?.roles?.manager || [];
          console.log("✅ Total milestones for Manager:", allMilestones.length);
        }
        // 🔹 Employee: Show only employee milestones (if any)
        else if (userRoles.includes("employee")) {
          console.log("✅ EMPLOYEE: Fetching only employee milestones");
          allMilestones = res?.data?.roles?.employee || [];
          console.log(
            "✅ Total milestones for Employee:",
            allMilestones.length,
          );
        }
        // 🔹 Default: Show only own milestones
        else {
          console.log("✅ INDIVIDUAL: Fetching only individual milestones");
          allMilestones = res?.data?.roles?.individual || [];
        }

        // 🔍 DEBUG: Log raw milestone data to check what backend returns
        console.log(
          "🏔️ [MILESTONE DEBUG] Sample milestone raw data:",
          allMilestones[0],
        );
        console.log(
          "🏔️ [MILESTONE DEBUG] milestoneData:",
          allMilestones[0]?.milestoneData,
        );
        console.log(
          "🏔️ [MILESTONE DEBUG] linkedTasks:",
          allMilestones[0]?.linkedTasks,
        );

        const formattedMilestones = allMilestones.map((m) => ({
          id: m._id,
          taskName: m.title,
          description: m.description,
          assignedTo:
            `${m.assignedTo?.firstName || ""} ${
              m.assignedTo?.lastName || ""
            }`.trim() || "Unassigned",
          assignedToId: m.assignedTo?._id,
          status: m.status || "not_started",
          priority: m.priority || "medium",
          visibility: m.visibility || "public",
          progress: m.progress ?? calculateProgress(m.status), // Calculate progress based on status
          milestoneType: m.milestoneType || "standalone",
          linkedTaskIds: m.linkedTasks || [], // Store raw IDs
          tasks:
            m.milestoneData?.linkedTaskIds?.map((t) => ({
              id: t._id,
              title: t.title,
              status: t.status,
              completed: t.completed,
            })) || [],
          // Backend already maps collaborators with proper structure
          collaborators: Array.isArray(m.collaborators)
            ? m.collaborators.map((c) => ({
                id: c.id || c._id,
                name:
                  c.name ||
                  `${c.firstName || ""} ${c.lastName || ""}`.trim() ||
                  "Unknown",
                firstName: c.firstName,
                initial: c.name
                  ? c.name.charAt(0).toUpperCase()
                  : (c.firstName && c.firstName.charAt(0).toUpperCase()) || "?",
              }))
            : [],
          dueDate: m.dueDate || new Date().toISOString(),
          labels: m.tags || [],
          attachments: m.attachments || [],
        }));

        console.log(
          "🏔️ [MILESTONE DEBUG] Formatted milestone sample:",
          formattedMilestones[0],
        );
        console.log(
          "🏔️ [MILESTONE DEBUG] Formatted tasks array:",
          formattedMilestones[0]?.tasks,
        );

        setMilestones(formattedMilestones);
        setError(null);
      } catch (err) {
        console.error("Error fetching milestones:", err);
        setError("Failed to load milestones");
      } finally {
        setLoading(false);
      }
    };

    fetchMilestones();
  }, []);

  // Fetch team members for assignment dropdown
  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        // Replace with your actual API call to get team members
        const response = await taskService.getTeamMembers?.();
        if (response?.data) {
          setTeamMembers(response.data);
        }
      } catch (err) {
        console.error("Error fetching team members:", err);
      }
    };

    fetchTeamMembers();
  }, []);

  // Delete milestone
  const handleDelete = (id, name) => {
    // Open confirmation modal instead of using window.confirm
    setDeleteError(null);
    setDeleteConfirmModal({
      isOpen: true,
      milestoneId: id,
      milestoneName: name || "this milestone",
      isDeleting: false,
    });
  };

  // Execute milestone deletion after confirmation
  const executeDeleteMilestone = async () => {
    const { milestoneId } = deleteConfirmModal;

    setDeleteConfirmModal((prev) => ({ ...prev, isDeleting: true }));

    try {
      const response = await taskService.deleteTask(milestoneId);

      if (response.success) {
        // Remove milestone from local state
        setMilestones((prev) => prev.filter((m) => m.id !== milestoneId));

        // Show success message
        showSuccessToast("Milestone deleted successfully");
        setDeleteConfirmModal({
          isOpen: false,
          milestoneId: null,
          milestoneName: "",
          isDeleting: false,
        });
        setDeleteError(null);
      } else {
        throw new Error(response.message || "Failed to delete milestone");
      }
    } catch (err) {
      console.error("Error deleting milestone:", err);
      setDeleteError(err.message || "Unable to delete milestone");
      setDeleteConfirmModal((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  // Edit milestone functions
  const handleEdit = async (milestone) => {
    console.log("🔍 Opening edit for milestone:", milestone);
    console.log("🔗 Milestone linkedTaskIds:", milestone.linkedTaskIds);

    const dueDate = milestone.dueDate
      ? new Date(milestone.dueDate).toISOString().split("T")[0]
      : "";

    // Fetch full task details for linked tasks
    let linkedTasksDetails = [];
    if (milestone.linkedTaskIds && milestone.linkedTaskIds.length > 0) {
      try {
        console.log("📥 Fetching task details for:", milestone.linkedTaskIds);
        const taskPromises = milestone.linkedTaskIds.map((taskId) =>
          axios.get(`${API_BASE_URL}/tasks/${taskId}`, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }),
        );
        const responses = await Promise.all(taskPromises);
        linkedTasksDetails = responses
          .filter((res) => res.data.success)
          .map((res) => res.data.data);
        console.log("✅ Fetched linked tasks:", linkedTasksDetails);
      } catch (err) {
        console.error("❌ Error fetching linked task details:", err);
      }
    } else {
      console.log("⚠️ No linkedTaskIds found in milestone");
    }

    setEditForm({
      id: milestone.id,
      taskName: milestone.taskName || "",
      description: milestone.description || "",
      assignedTo: milestone.assignedTo
        ? {
            value: milestone.assignedToId || milestone.assignedTo,
            label:
              typeof milestone.assignedTo === "string"
                ? milestone.assignedTo
                : milestone.assignedTo.name ||
                  milestone.assignedTo.fullName ||
                  "Unknown",
          }
        : null,
      assignedToId: milestone.assignedToId || "",
      priority: {
        value: milestone.priority || "medium",
        label:
          (milestone.priority || "medium").charAt(0).toUpperCase() +
          (milestone.priority || "medium").slice(1),
      },
      dueDate: dueDate,
      visibility: milestone.visibility || "private",
      status: milestone.status || "OPEN",
      labels: milestone.labels || [],
      labelInput: "",
      attachments: milestone.attachments || [],
      milestoneType: milestone.milestoneType || "standalone",
      linkedTasks: linkedTasksDetails, // Pass full task objects to LinkedTasksSelector
      collaborators: (milestone.collaborators || [])
        .filter((c) => c && (c.id || c._id))
        .map((c) => ({
          value: c.id || c._id,
          label:
            c.name ||
            c.fullName ||
            `${c.firstName || ""} ${c.lastName || ""}`.trim() ||
            "Unknown",
        })),
    });

    console.log("📝 Edit form set with linkedTasks:", linkedTasksDetails);
    setEditModalOpen(true);
    setEditError(null);
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditForm(null);
    setEditError(null);
  };

  const handleEditFormChange = (field, value) => {
    if (field === "taskName") {
      const v = value ? value.slice(0, 100) : value;
      setEditForm((prev) => ({
        ...prev,
        [field]: v,
      }));
    } else {
      setEditForm((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  const handleEditLabelsKeyDown = (e) => {
    if (e.key === "Enter" && editForm.labelInput.trim()) {
      e.preventDefault();
      const newLabel = editForm.labelInput.trim();
      if (!editForm.labels.includes(newLabel)) {
        handleEditFormChange("labels", [...editForm.labels, newLabel]);
      }
      handleEditFormChange("labelInput", "");
    }
  };

  const handleEditRemoveLabel = (labelToRemove) => {
    handleEditFormChange(
      "labels",
      editForm.labels.filter((label) => label !== labelToRemove),
    );
  };

  const handleEditFilesSelected = (files) => {
    if (files) {
      handleEditFormChange("attachments", Array.from(files));
    }
  };

  const getValidStatusOptions = () => {
    if (!editForm || !taskStatuses || taskStatuses.length === 0) {
      // Fallback to hardcoded options
      return [
        { value: "OPEN", label: "Open" },
        { value: "INPROGRESS", label: "In Progress" },
        { value: "ONHOLD", label: "On Hold" },
        { value: "DONE", label: "Done" },
        { value: "CANCELLED", label: "Cancelled" },
      ];
    }

    const currentStatusCode = String(editForm.status || "")
      .trim()
      .toUpperCase();
    const currentStatusObj = taskStatuses.find(
      (s) => s.code === currentStatusCode,
    );

    // Always include current status
    const validCodes = new Set([currentStatusCode]);

    // Add allowed transitions
    if (
      currentStatusObj &&
      Array.isArray(currentStatusObj.allowedTransitions)
    ) {
      currentStatusObj.allowedTransitions.forEach((code) =>
        validCodes.add(code),
      );
    } else {
      // Backward compatibility: show all if undefined
      taskStatuses
        .filter((s) => s && s.active)
        .forEach((s) => validCodes.add(s.code));
    }

    // Filter and convert to react-select format
    return taskStatuses
      .filter((s) => s && s.active && validCodes.has(s.code))
      .map((s) => ({
        value: s.code,
        label: s.label,
      }));
  };

  const handleEditSave = async () => {
    try {
      setEditLoading(true);
      setEditError(null);

      const updateData = {
        title: editForm.taskName,
        description: editForm.description,
        status: editForm.status,
        priority: editForm.priority?.value || editForm.priority,
        dueDate: editForm.dueDate
          ? new Date(editForm.dueDate).toISOString()
          : null,
        assignedTo: editForm.assignedTo?.value || editForm.assignedToId || null,
        visibility: editForm.visibility,
        tags: editForm.labels,
        collaborators: (editForm.collaborators || []).map(
          (c) => c.value || c.id || c,
        ),
      };

      const response = await taskService.updateTask(editForm.id, updateData);

      if (response.success) {
        // 🎯 Handle linked tasks changes
        const originalMilestone = milestones.find((m) => m.id === editForm.id);
        // Get original task IDs from linkedTaskIds array
        const originalTaskIds = originalMilestone?.linkedTaskIds || [];
        // Get updated task IDs from linkedTasks array (extract _id from task objects)
        const updatedTaskIds = (editForm.linkedTasks || []).map(
          (t) => t._id || t.id || t,
        );

        console.log("🔍 Original task IDs:", originalTaskIds);
        console.log("🔍 Updated task IDs:", updatedTaskIds);

        // Find tasks to link (new tasks)
        const tasksToLink = updatedTaskIds.filter(
          (id) => !originalTaskIds.includes(id),
        );

        // Find tasks to unlink (removed tasks)
        const tasksToUnlink = originalTaskIds.filter(
          (id) => !updatedTaskIds.includes(id),
        );

        console.log("➕ Tasks to link:", tasksToLink);
        console.log("➖ Tasks to unlink:", tasksToUnlink);

        // Link new tasks
        for (const taskId of tasksToLink) {
          try {
            await axios.post(
              `${API_BASE_URL}/milestones/${editForm.id}/link-task`,
              { taskId },
              {
                headers: {
                  Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
              },
            );
            showSuccessToast(`Task linked`);
          } catch (linkErr) {
            console.error(`Failed to link task ${taskId}:`, linkErr);
            showErrorToast(linkErr.response?.data?.message || linkErr.message);
          }
        }

        // Unlink removed tasks
        for (const taskId of tasksToUnlink) {
          try {
            await axios.delete(
              `${API_BASE_URL}/milestones/${editForm.id}/unlink-task/${taskId}`,
              {
                headers: {
                  Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
              },
            );
            showSuccessToast(`Task unlinked`);
          } catch (unlinkErr) {
            console.error(`Failed to unlink task ${taskId}:`, unlinkErr);
            showErrorToast(
              unlinkErr.response?.data?.message || unlinkErr.message,
            );
          }
        }

        // Update the milestone in the local state
        setMilestones((prev) =>
          prev.map((milestone) =>
            milestone.id === editForm.id
              ? {
                  ...milestone,
                  taskName: editForm.taskName,
                  description: editForm.description,
                  status: editForm.status,
                  priority: editForm.priority?.value || editForm.priority,
                  dueDate: editForm.dueDate
                    ? new Date(editForm.dueDate).toISOString()
                    : milestone.dueDate,
                  assignedTo: editForm.assignedTo?.label || editForm.assignedTo,
                  assignedToId:
                    editForm.assignedTo?.value || editForm.assignedToId,
                  visibility: editForm.visibility,
                  labels: editForm.labels,
                  linkedTaskIds: updatedTaskIds,
                  linkedTasks: editForm.linkedTasks,
                }
              : milestone,
          ),
        );
        showSuccessToast("Milestone updated");
        closeEditModal();
      } else {
        const errMsg = response.message || "Failed to update milestone";
        setEditError(errMsg);
        showErrorToast(errMsg);
      }
    } catch (err) {
      console.error("Error updating milestone:", err);
      const errMsg =
        err.message || "Failed to update milestone. Please try again.";
      setEditError(errMsg);
      showErrorToast(errMsg);
    } finally {
      setEditLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">Loading milestones...</div>
    );
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
            <div className="flex items-center space-x-3">
              <div className="h-12 w-12 rounded-xl bg-green-500 flex items-center justify-center">
                <Target className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Milestones</h1>
                <p className="text-sm text-gray-600">
                  Track and manage project milestones
                </p>
              </div>
            </div>
            <div className="flex justify-center sm:justify-end">
              <Link href="/tasks/create?type=milestone">
                <Button
                  variant="primary"
                  className="h-9 bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Milestone
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-6 py-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
          <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-4">
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
          <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-4">
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
          <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-4">
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
          <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-4">
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
          <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-4">
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
        <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-4 mb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 overflow-x-auto">
              <div className="flex items-center space-x-2 flex-shrink-0">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">
                  Filters:
                </span>
              </div>

              <div className="relative flex-shrink-0">
                <svg
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4"
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
                  placeholder="Search milestones..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-48 pl-9 pr-3 h-9 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-28 sm:w-32 h-9 px-2 sm:px-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent flex-shrink-0"
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
                <option value="OVERDUE">Overdue</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-28 sm:w-32 h-9 px-2 sm:px-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent flex-shrink-0"
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
                onChange={(e) => setDueDateFilter(e.target.value)}
                className="w-32 sm:w-36 h-9 px-2 sm:px-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent flex-shrink-0"
              >
                <option value="all">All Due Dates</option>
                <option value="overdue">Overdue</option>
                <option value="due_today">Due Today</option>
                <option value="due_tomorrow">Due Tomorrow</option>
                <option value="due_this_week">Due This Week</option>
                <option value="due_next_week">Due Next Week</option>
                <option value="due_this_month">Due This Month</option>
                <option value="no_due_date">No Due Date</option>
              </select>
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0">
              <div className="flex items-center bg-gray-100 rounded-sm p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === "grid"
                      ? "bg-white shadow-sm text-green-600"
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
                      ? "bg-white shadow-sm text-green-600"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Active Filters Display */}
        {(searchTerm ||
          statusFilter !== "all" ||
          priorityFilter !== "all" ||
          dueDateFilter !== "all") && (
          <div className="bg-green-50 border border-green-200 rounded-sm p-3 mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-green-800">
                  Active Filters:
                </span>
                <div className="flex flex-wrap gap-2">
                  {searchTerm && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Search: "{searchTerm}"
                      <button
                        onClick={() => setSearchTerm("")}
                        className="ml-1 text-green-600 hover:text-green-800"
                      >
                        &times;
                      </button>
                    </span>
                  )}
                  {statusFilter !== "all" && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Status: {statusFilter}
                      <button
                        onClick={() => setStatusFilter("all")}
                        className="ml-1 text-green-600 hover:text-green-800"
                      >
                        &times;
                      </button>
                    </span>
                  )}
                  {priorityFilter !== "all" && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Priority: {priorityFilter}
                      <button
                        onClick={() => setPriorityFilter("all")}
                        className="ml-1 text-green-600 hover:text-green-800"
                      >
                        &times;
                      </button>
                    </span>
                  )}
                  {dueDateFilter !== "all" && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Due: {dueDateFilter.replace(/_/g, " ")}
                      <button
                        onClick={() => setDueDateFilter("all")}
                        className="ml-1 text-green-600 hover:text-green-800"
                      >
                        &times;
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
                  setDueDateFilter("all");
                }}
                className="text-xs text-green-600 hover:text-green-800 font-medium"
              >
                Clear All
              </button>
            </div>
          </div>
        )}

        {/* Milestones Grid/List */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredMilestones.map((milestone) => (
              <div
                key={milestone.id}
                className="bg-white rounded-sm shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200 flex flex-col justify-between h-full min-h-[400px]"
              >
                {/* Card Header */}
                <div className="flex-shrink-0">
                  <div className="flex items-start justify-between p-4 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 rounded-sm bg-green-100 flex items-center justify-center">
                        <Target className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <h3 className="text-md font-semibold text-gray-900">
                          {milestone.taskName}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {milestone.milestoneType}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="p-1 hover:bg-gray-100 rounded-md"
                        >
                          <MoreVerticalIcon className="h-5 w-5 text-gray-600" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-32 bg-white"
                      >
                        <DropdownMenuItem
                          onClick={() => {
                            const isDone =
                              milestone.status === "completed" ||
                              milestone.status === "DONE";
                            if (!isDone) {
                              handleEdit(milestone);
                            }
                          }}
                          disabled={
                            milestone.status === "completed" ||
                            milestone.status === "DONE"
                          }
                          className={`text-sm py-2 px-3 rounded-none ${
                            milestone.status === "completed" ||
                            milestone.status === "DONE"
                              ? "cursor-not-allowed opacity-50 text-gray-400"
                              : "cursor-pointer hover:bg-gray-50"
                          }`}
                        >
                          <Edit3
                            className={`h-4 w-4 mr-2 ${
                              milestone.status === "completed" ||
                              milestone.status === "DONE"
                                ? "text-gray-400"
                                : "text-gray-600"
                            }`}
                          />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            handleDelete(milestone.id, milestone.taskName);
                          }}
                          className="text-sm py-2 px-3 rounded-none cursor-pointer hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4 mr-2 text-red-600" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Card Content (Middle Section) */}
                <div className="flex-grow">
                  {/* Description */}
                  <div
                    className="text-sm text-gray-600 px-4 py-2 truncate max-w-[180px]"
                    title={milestone.description}
                  >
                    <SafeHtml
                      html={milestone.description || ""}
                      truncate
                      maxLength={150}
                    />
                  </div>

                  {/* Status, Priority & Type */}
                  <div className="flex items-center space-x-2 px-4 mb-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(
                        milestone.status,
                      )}`}
                    >
                      {getStatusIcon(milestone.status)}
                      <span className="ml-1">
                        {milestone.status.replace("_", " ").toUpperCase()}
                      </span>
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(
                        typeof milestone.priority === "object"
                          ? milestone.priority.value
                          : milestone.priority,
                      )}`}
                    >
                      {(typeof milestone.priority === "object"
                        ? milestone.priority.value
                        : milestone.priority
                      ).toUpperCase()}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                      <Target className="h-3 w-3 mr-1" />
                      MILESTONE
                    </span>
                  </div>

                  {/* Progress */}
                  <div className="px-4 mb-2">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>Progress</span>
                      <span>{milestone.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 h-1 rounded-full">
                      <div
                        className="bg-green-600 h-1 rounded-full transition-all duration-300"
                        style={{ width: `${milestone.progress}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Details: Due, Assigned, Visibility, Linked Tasks */}
                  <div className="px-4 py-2 grid grid-cols-2 gap-2 text-xs text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {milestone.dueDate
                          ? new Date(milestone.dueDate)
                              .toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                              .replace(",", "")
                          : "No due date"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Users className="h-3 w-3" />
                      <span>{milestone.assignedTo}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      {milestone.visibility === "public" ? (
                        <Eye className="h-3 w-3" />
                      ) : (
                        <EyeOff className="h-3 w-3" />
                      )}
                      <span className="capitalize">{milestone.visibility}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <LinkIcon className="h-3 w-3" />
                      <span>
                        {(() => {
                          // Use tasks array which contains populated task objects
                          const linkedTasks = milestone.tasks || [];
                          const completedCount = linkedTasks.filter(
                            (t) =>
                              t.status === "DONE" ||
                              t.status === "COMPLETED" ||
                              t.completed,
                          ).length;
                          return `${completedCount}/${linkedTasks.length} Linked`;
                        })()}
                      </span>
                    </div>
                  </div>

                  {/* Collaborators */}
                  <div className="px-4 py-2 flex items-center space-x-1 overflow-x-auto">
                    {milestone.collaborators.map((c, i) => (
                      <div
                        key={c.id || i}
                        className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                        title={c.name}
                      >
                        {c.initial}
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 flex-shrink-0"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Linked Tasks Preview */}
                  {(() => {
                    // Use tasks array which contains populated task objects
                    const linkedTasks = milestone.tasks || [];
                    return linkedTasks.length > 0 ? (
                      <div className="px-4 py-2 space-y-1 text-xs text-gray-500">
                        {linkedTasks.slice(0, 2).map((task) => {
                          const isCompleted =
                            task.status === "DONE" ||
                            task.status === "COMPLETED" ||
                            task.completed;
                          return (
                            <div
                              key={task.id || task._id}
                              className="flex items-center space-x-1"
                            >
                              <CheckCircle2
                                className={`h-3 w-3 ${
                                  isCompleted
                                    ? "text-green-500"
                                    : "text-gray-300"
                                }`}
                              />
                              <span
                                className={`${
                                  isCompleted
                                    ? "line-through text-gray-400"
                                    : "text-gray-700"
                                } truncate max-w-[190px]`}
                                title={
                                  task.title || task.taskName || "Untitled Task"
                                }
                              >
                                {task.title || task.taskName || "Untitled Task"}
                              </span>
                            </div>
                          );
                        })}
                        {linkedTasks.length > 2 && (
                          <span>+{linkedTasks.length - 2} more tasks</span>
                        )}
                      </div>
                    ) : null;
                  })()}
                </div>

                <div className="flex-shrink-0 mt-auto">
                  <div className="px-4 py-2 border-t border-gray-200 flex justify-between items-center">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        const isDone =
                          milestone.status === "completed" ||
                          milestone.status === "DONE";
                        if (!isDone) {
                          handleEdit(milestone);
                        }
                      }}
                      disabled={
                        milestone.status === "completed" ||
                        milestone.status === "DONE"
                      }
                      className={`text-xs h-auto p-1 ${
                        milestone.status === "completed" ||
                        milestone.status === "DONE"
                          ? "cursor-not-allowed text-gray-400 opacity-60"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      <Edit3 className="h-3 w-3 mr-1" /> <span>Edit</span>
                    </Button>
                    <Link href={`/tasks/${milestone.id}`}>
                      <Button
                        variant="primary"
                        className="h-7 text-xs bg-green-600 hover:bg-green-700"
                      >
                        View Details
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // List View
          <div className="bg-white rounded-sm shadow-sm border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-200">
              {filteredMilestones.map((milestone) => (
                <div
                  key={milestone.id}
                  className="p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="h-12 w-12 rounded-sm bg-red-100 flex items-center justify-center">
                        <Target className="h-6 w-6 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {milestone.taskName}
                          </h3>
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                              milestone.status,
                            )}`}
                          >
                            {getStatusIcon(milestone.status)}
                            <span className="ml-1">
                              {milestone.status.replace("_", " ").toUpperCase()}
                            </span>
                          </span>
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getPriorityColor(
                              milestone.priority,
                            )}`}
                          >
                            {milestone.priority.toUpperCase()}
                          </span>
                        </div>
                        <div
                          className="text-sm text-gray-600 mb-2 truncate max-w-[180px]"
                          title={milestone.description}
                        >
                          <SafeHtml
                            html={milestone.description || ""}
                            truncate
                            maxLength={150}
                          />
                        </div>
                        <div className="flex items-center space-x-3 text-sm text-gray-500">
                          <span className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4" />
                            <span>
                              Due:{" "}
                              {milestone.dueDate
                                ? new Date(milestone.dueDate)
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
                            <span>{milestone.assignedTo}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <LinkIcon className="h-4 w-4" />
                            <span>
                              {(() => {
                                const linkedTasks =
                                  milestone.linkedTasks ||
                                  milestone.tasks ||
                                  [];
                                const completedCount = linkedTasks.filter(
                                  (t) =>
                                    t.status === "DONE" ||
                                    t.status === "completed" ||
                                    t.completed,
                                ).length;
                                return `${completedCount}/${linkedTasks.length} Linked Tasks`;
                              })()}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">
                          {milestone.progress}%
                        </div>
                        <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                          <div
                            className="bg-green-600 h-2 rounded-full"
                            style={{ width: `${milestone.progress}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const isDone =
                              milestone.status === "completed" ||
                              milestone.status === "DONE";
                            if (!isDone) {
                              handleEdit(milestone);
                            }
                          }}
                          disabled={
                            milestone.status === "completed" ||
                            milestone.status === "DONE"
                          }
                          className={`p-2 rounded-sm transition-colors ${
                            milestone.status === "completed" ||
                            milestone.status === "DONE"
                              ? "cursor-not-allowed text-gray-400 opacity-60"
                              : "text-gray-500 hover:bg-gray-100"
                          }`}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Link href={`/tasks/${milestone.id}`}>
                          <Button
                            variant="primary"
                            className="h-9 bg-green-600 hover:bg-green-700"
                          >
                            View Details
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {filteredMilestones.length === 0 && (
          <div className="text-center py-12">
            <Target className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No milestones found
            </h3>
            <p className="text-gray-600 mb-3">
              Get started by creating your first milestone.
            </p>
            <Link href="/tasks/create?type=milestone">
              <Button
                variant="primary"
                className="h-9 bg-green-600 hover:bg-green-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Milestone
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Edit Modal - Enhanced */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-blue-100">
              <div className="flex items-center space-x-2">
                <Target className="w-5 h-5 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">
                  Edit Milestone
                </h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-sm transition-colors"
                onClick={closeEditModal}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Modal Body - Scrollable */}
            {editForm && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleEditSave();
                }}
                className="flex-1 overflow-y-auto px-6 py-4 space-y-3"
              >
                {editError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm text-sm flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    {editError}
                  </div>
                )}

                {/* Milestone Type */}
                <div>
                  <label className="form-label mb-2">
                    Milestone Type <span className="text-red-500 ml-1">*</span>
                  </label>
                  <div className="flex space-x-3">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        value="standalone"
                        checked={editForm.milestoneType === "standalone"}
                        onChange={(e) =>
                          handleEditFormChange("milestoneType", e.target.value)
                        }
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-900">
                        Standalone
                      </span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        value="linked"
                        checked={editForm.milestoneType === "linked"}
                        onChange={(e) =>
                          handleEditFormChange("milestoneType", e.target.value)
                        }
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-900">Linked</span>
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Standalone milestones are independent. Linked milestones
                    depend on other tasks.
                  </p>
                </div>

                {/* Milestone Name */}
                <div>
                  <label className="form-label mb-1">
                    Milestone Name <span className="text-red-500 ml-1">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={editForm.taskName}
                      onChange={(e) =>
                        handleEditFormChange("taskName", e.target.value)
                      }
                      className="form-input w-full h-9"
                      placeholder="Enter milestone name..."
                      maxLength={100}
                      required
                    />
                    <div className="absolute right-3 top-2.5 text-xs text-gray-400">
                      {editForm.taskName.length}/100
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="form-label mb-1">Description</label>
                  <div className="border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                    <CustomEditor
                      value={editForm.description}
                      onChange={(value) =>
                        handleEditFormChange("description", value)
                      }
                      placeholder="Describe your milestone..."
                    />
                  </div>
                </div>

                {/* Linked Tasks - Show if milestone type is 'linked' */}
                {editForm.milestoneType === "linked" && (
                  <div>
                    <label className="form-label mb-1">
                      <LinkIcon className="w-4 h-4 inline mr-1" />
                      Link to Tasks/Sub-tasks{" "}
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    <LinkedTasksSelector
                      selectedTasks={editForm.linkedTasks || []}
                      onTasksChange={(tasks) =>
                        handleEditFormChange("linkedTasks", tasks)
                      }
                      excludeTaskIds={editForm.id ? [editForm.id] : []}
                      disabled={editLoading}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Cannot link to other milestones. Due date will default to
                      latest linked task date.
                    </p>
                  </div>
                )}

                {/* Grid for Due Date, Assigned To, Priority, Collaborators */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Due Date */}
                  <div>
                    <label className="form-label mb-1">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Due Date <span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                      type="date"
                      value={editForm.dueDate}
                      onChange={(e) =>
                        handleEditFormChange("dueDate", e.target.value)
                      }
                      min={new Date().toISOString().split("T")[0]}
                      className="form-input w-full h-9"
                      required
                    />
                  </div>

                  {/* Assigned To */}
                  <div>
                    <label className="form-label mb-1">
                      Assigned To <span className="text-red-500 ml-1">*</span>
                    </label>
                    <AssigneeSearchSelect
                      value={editForm.assignedTo}
                      onChange={(selected) =>
                        handleEditFormChange("assignedTo", selected)
                      }
                      placeholder="Search and select assignee..."
                      required
                      skipClearOnRoleChange={true}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Search by name, email, department, or designation
                    </p>
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="form-label mb-1">
                      Priority <span className="text-red-500 ml-1">*</span>
                    </label>
                    <Select
                      value={editForm.priority}
                      menuPlacement="auto"
                      onChange={(selected) =>
                        handleEditFormChange("priority", selected)
                      }
                      options={priorityOptions}
                      className="react-select-container"
                      classNamePrefix="react-select"
                      placeholder="Select priority..."
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label className="form-label mb-1">
                      Status <span className="text-red-500 ml-1">*</span>
                    </label>
                    <Select
                      value={{
                        value: editForm.status,
                        label:
                          editForm.status
                            .replace("_", " ")
                            .charAt(0)
                            .toUpperCase() +
                          editForm.status.slice(1).replace("_", " "),
                      }}
                      menuPlacement="auto"
                      onChange={(selected) =>
                        handleEditFormChange("status", selected.value)
                      }
                      options={getValidStatusOptions()}
                      className="react-select-container"
                      classNamePrefix="react-select"
                      placeholder="Select status..."
                    />
                  </div>
                </div>

                {/* Visibility */}
                <div>
                  <label className="form-label mb-1">
                    Visibility <span className="text-red-500 ml-1">*</span>
                  </label>
                  <Select
                    value={{
                      value: editForm.visibility,
                      label:
                        (editForm.visibility || "private")
                          .charAt(0)
                          .toUpperCase() +
                        (editForm.visibility || "private").slice(1),
                    }}
                    menuPlacement="auto"
                    onChange={(selected) =>
                      handleEditFormChange("visibility", selected.value)
                    }
                    options={
                      canAssignToOthers
                        ? [
                            { value: "private", label: "Private" },
                            { value: "team", label: "Team" },
                          ]
                        : [{ value: "private", label: "Private" }]
                    }
                    className="react-select-container"
                    classNamePrefix="react-select"
                    placeholder="Select visibility..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {canAssignToOthers
                      ? "Private: Only you and assignee can view. Team: All team members can view."
                      : "Private: Only you and assignee can view."}
                  </p>
                </div>

                {/* Labels/Tags */}
                <div>
                  <label className="form-label mb-1">Labels</label>
                  {editForm.labels && editForm.labels.length > 0 && (
                    <div className="flex gap-2 mb-2 flex-wrap">
                      {editForm.labels.map((label, idx) => (
                        <span
                          key={label + idx}
                          className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1"
                        >
                          {label}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 ml-1 text-blue-600 hover:text-blue-800"
                            onClick={() => handleEditRemoveLabel(label)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </span>
                      ))}
                    </div>
                  )}
                  <input
                    type="text"
                    value={editForm.labelInput}
                    onChange={(e) =>
                      handleEditFormChange("labelInput", e.target.value)
                    }
                    onKeyDown={handleEditLabelsKeyDown}
                    className="form-input w-full h-9"
                    placeholder="Type a label and press Enter to add"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Press Enter to add labels
                  </p>
                </div>
              </form>
            )}

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={closeEditModal}
                className="h-9"
                disabled={editLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                onClick={handleEditSave}
                className="h-9"
                disabled={editLoading}
              >
                {editLoading ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmModal.isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-[2000] flex items-center justify-center"
          onClick={(e) => {
            // Close on backdrop click only if not deleting
            if (!deleteConfirmModal.isDeleting) {
              setDeleteConfirmModal({
                isOpen: false,
                milestoneId: null,
                milestoneName: "",
                isDeleting: false,
              });
              setDeleteError(null);
            }
          }}
        >
          <div
            className="bg-white rounded-sm shadow-xl p-4 w-96 max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-red-600"
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
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Delete Milestone
                </h3>
                <p className="text-sm text-gray-500">
                  This action cannot be undone
                </p>
              </div>
            </div>

            {deleteError ? (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-sm">
                <p className="text-red-700 text-sm font-medium">
                  {deleteError}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-700 mb-6">
                Are you sure you want to delete{" "}
                <strong className="text-gray-900">
                  "{deleteConfirmModal.milestoneName}"
                </strong>
                ? This will permanently remove the milestone.
              </p>
            )}

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                className="px-4"
                onClick={() => {
                  setDeleteConfirmModal({
                    isOpen: false,
                    milestoneId: null,
                    milestoneName: "",
                    isDeleting: false,
                  });
                  setDeleteError(null);
                }}
                disabled={deleteConfirmModal.isDeleting}
              >
                Cancel
              </Button>
              {!deleteError && (
                <Button
                  variant="destructive"
                  className="px-4"
                  onClick={executeDeleteMilestone}
                  disabled={deleteConfirmModal.isDeleting}
                >
                  {deleteConfirmModal.isDeleting ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="animate-spin w-4 h-4"
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
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Deleting...
                    </span>
                  ) : (
                    "Delete Milestone"
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
