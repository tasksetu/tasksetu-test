import React, { useState, useEffect } from "react";
import { useSubtask } from "../../contexts/SubtaskContext";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useTaskStatuses } from "../../hooks/useTaskStatuses";

import { useShowToast } from "../../utils/ToastMessage";
import useLicense from "../../hooks/useLicense";
import UpgradeRequiredModal from "../../components/modals/UpgradeRequiredModal";

// Helper function to transform subtask data for edit mode
const transformSubtaskForEdit = (subtask) => {
  console.log("🎯 [SUBTASKS PANEL] transformSubtaskForEdit called");
  console.log("📥 Original subtask data:", JSON.stringify(subtask, null, 2));

  // Transform subtask data to ensure proper ID and name separation
  let assigneeId = null;
  let assigneeName = null;

  console.log("🔍 Assignee Analysis:", {
    "subtask.assignee": subtask.assignee,
    "subtask.assignedTo": subtask.assignedTo,
    "subtask.assignedTo?._id": subtask.assignedTo?._id,
    "subtask.assignedTo?.firstName": subtask.assignedTo?.firstName,
    "subtask.assignedTo?.lastName": subtask.assignedTo?.lastName,
  });

  // Extract assignee ID and Name
  if (subtask.assignedTo?._id) {
    // assignedTo is populated with user object
    assigneeId = subtask.assignedTo._id;
    assigneeName =
      `${subtask.assignedTo.firstName || ""} ${subtask.assignedTo.lastName || ""}`.trim() ||
      subtask.assignedTo.email ||
      "Assigned User";
    console.log(
      "✅ Case 1: Using assignedTo._id:",
      assigneeId,
      "with name:",
      assigneeName,
    );
  } else if (
    subtask.assigneeId &&
    typeof subtask.assigneeId === "string" &&
    /^[0-9a-fA-F]{24}$/.test(subtask.assigneeId)
  ) {
    // assigneeId is a valid MongoDB ObjectId (from TaskDetail mapping)
    assigneeId = subtask.assigneeId;
    assigneeName =
      typeof subtask.assignee === "string" &&
      !/^[0-9a-fA-F]{24}$/.test(subtask.assignee)
        ? subtask.assignee
        : subtask.assigneeName || "Assigned User";
    console.log(
      "✅ Case 1b: Using assigneeId field:",
      assigneeId,
      "with name:",
      assigneeName,
    );
  } else if (
    typeof subtask.assignedTo === "string" &&
    /^[0-9a-fA-F]{24}$/.test(subtask.assignedTo)
  ) {
    // assignedTo is a string ID
    assigneeId = subtask.assignedTo;
    // Check if subtask.assignee is a name (not an ID)
    if (
      typeof subtask.assignee === "string" &&
      !/^[0-9a-fA-F]{24}$/.test(subtask.assignee)
    ) {
      assigneeName = subtask.assignee; // It's a name string
    } else {
      assigneeName = "Assigned User"; // Fallback
    }
    console.log(
      "✅ Case 2: Using assignedTo string ID:",
      assigneeId,
      "with name:",
      assigneeName,
    );
  } else if (
    typeof subtask.assignee === "string" &&
    /^[0-9a-fA-F]{24}$/.test(subtask.assignee)
  ) {
    // assignee is a string ID
    assigneeId = subtask.assignee;
    assigneeName = "Assigned User";
    console.log(
      "✅ Case 3: Using assignee string ID:",
      assigneeId,
      "(no name available)",
    );
  } else if (typeof subtask.assignee === "object" && subtask.assignee?._id) {
    // assignee is a populated user object
    assigneeId = subtask.assignee._id;
    assigneeName =
      `${subtask.assignee.firstName || ""} ${subtask.assignee.lastName || ""}`.trim() ||
      subtask.assignee.email ||
      "Assigned User";
    console.log(
      "✅ Case 4: Using assignee._id:",
      assigneeId,
      "with name:",
      assigneeName,
    );
  } else if (
    typeof subtask.assignee === "string" &&
    !/^[0-9a-fA-F]{24}$/.test(subtask.assignee)
  ) {
    // assignee is a display name string (not an ID)
    assigneeName = subtask.assignee;
    assigneeId = subtask.assigneeId || subtask.assignedTo || "self";
    console.log(
      "✅ Case 5: Using assignee name:",
      assigneeName,
      "with fallback ID:",
      assigneeId,
    );
  } else {
    // No assignee data found
    assigneeId = "self";
    assigneeName = "Self";
    console.log("⚠️ Case 6: No assignee found, using Self");
  }

  const transformedSubtask = {
    ...subtask,
    assigneeId: assigneeId, // The actual user ID
    assigneeName: assigneeName, // The display name
    assignee: assigneeId, // For backward compatibility
    dueDate: subtask.dueDate || subtask.due_date || "", // Ensure due date is passed
  };

  console.log(
    "🔄 Transformed subtask data:",
    JSON.stringify(
      {
        id: transformedSubtask._id || transformedSubtask.id,
        title: transformedSubtask.title,
        assigneeId: transformedSubtask.assigneeId,
        assigneeName: transformedSubtask.assigneeName,
        dueDate: transformedSubtask.dueDate,
        priority: transformedSubtask.priority,
        status: transformedSubtask.status,
      },
      null,
      2,
    ),
  );
  console.log("🚀 Returning transformed subtask...");

  return transformedSubtask;
};

// Subtasks Panel component
function SubtasksPanel({ subtasks, parentTask, currentUser, refreshTask }) {
  const { openSubtaskDrawer } = useSubtask();
  const { showErrorToast, showSuccessToast } = useShowToast();
  const { checkFeature } = useLicense();
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [subtaskList, setSubtaskList] = useState(subtasks);
  const queryClient = useQueryClient();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const [isCollapsed, setIsCollapsed] = useState(false); // Default open
  const [expandedSubtasks, setExpandedSubtasks] = useState(() =>
    subtasks.map((st) => st.id || st._id),
  );

  // Delete confirmation modal state
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({
    isOpen: false,
    subtaskId: null,
    subtaskTitle: "",
    isDeleting: false,
  });

  // Sync subtaskList when subtasks prop changes (e.g., after parent task refresh)
  useEffect(() => {
    setSubtaskList(subtasks);
  }, [subtasks]);

  // When new subtasks are added, auto-expand them too
  useEffect(() => {
    setExpandedSubtasks((prev) => {
      const newIds = subtaskList
        .map((st) => st.id || st._id)
        .filter((id) => !prev.includes(id));
      return newIds.length > 0 ? [...prev, ...newIds] : prev;
    });
  }, [subtaskList]);

  const { data: taskStatuses = [] } = useTaskStatuses();

  // Helper functions to identify completed and cancelled statuses dynamically
  const getCompleteStatusCodes = () => {
    // Statuses that represent completion (typically "DONE" or similar)
    return (Array.isArray(taskStatuses) ? taskStatuses : [])
      .filter(
        (s) =>
          s &&
          s.active &&
          s.code &&
          (s.code.toUpperCase() === "DONE" ||
            s.code.toUpperCase() === "COMPLETED" ||
            s.code === "completed" ||
            s.label?.toLowerCase().includes("completed") ||
            s.label?.toLowerCase().includes("done")),
      )
      .map((s) => s.code);
  };

  const getCancelledStatusCodes = () => {
    // Statuses that represent cancellation
    return (Array.isArray(taskStatuses) ? taskStatuses : [])
      .filter(
        (s) =>
          s &&
          s.code &&
          (s.code.toUpperCase() === "CANCELLED" ||
            s.code.toUpperCase() === "CANCELED" ||
            s.code === "cancelled" ||
            s.code === "canceled" ||
            s.label?.toLowerCase().includes("cancel")),
      )
      .map((s) => s.code);
  };

  const isCompletedStatus = (status) => {
    const completedCodes = getCompleteStatusCodes();
    const normalizedStatus = String(status || "").trim();
    return completedCodes.some(
      (code) => normalizedStatus.toUpperCase() === code.toUpperCase(),
    );
  };

  const isCancelledStatus = (status) => {
    const cancelledCodes = getCancelledStatusCodes();
    const normalizedStatus = String(status || "").trim();
    return cancelledCodes.some(
      (code) => normalizedStatus.toUpperCase() === code.toUpperCase(),
    );
  };

  const filteredSubtasks = subtaskList.filter((subtask) => {
    // Search filter based on title
    const matchesSearch =
      searchTerm === "" ||
      subtask.title.toLowerCase().includes(searchTerm.toLowerCase());

    const normalizeStatus = (val) => {
      const v = String(val || "").trim();
      const upper = v.toUpperCase();
      if (upper === "PENDING" || v === "to-do") return "OPEN";
      if (v === "in-progress") return "INPROGRESS";
      if (upper === "COMPLETED") return "DONE";
      return upper || v;
    };

    const matchesStatus =
      filter === "all" || normalizeStatus(subtask.status) === filter;

    return matchesSearch && matchesStatus;
  });

  const handleCreateSubtask = (subtaskData) => {
    const newSubtask = {
      id: Date.now(),
      ...subtaskData,
      parentTaskId: parentTask.id,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.name,
    };
    setSubtaskList([...subtaskList, newSubtask]);
    setShowInlineAdd(false);
  };

  const handleUpdateSubtask = (updatedSubtask) => {
    setSubtaskList(
      subtaskList.map((st) =>
        st.id === updatedSubtask.id ? updatedSubtask : st,
      ),
    );
  };

  const handleDeleteSubtask = (subtaskId, subtaskTitle) => {
    // Show confirmation modal instead of deleting immediately
    setDeleteConfirmModal({
      isOpen: true,
      subtaskId,
      subtaskTitle: subtaskTitle || "this subtask",
      isDeleting: false,
    });
  };

  const executeDeleteSubtask = async () => {
    const { subtaskId } = deleteConfirmModal;
    const parentTaskId = parentTask?._id || parentTask?.id;

    setDeleteConfirmModal((prev) => ({ ...prev, isDeleting: true }));

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `/api/tasks/${parentTaskId}/subtasks/${subtaskId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to delete subtask");
      }

      // Update local state — handle both id and _id
      setSubtaskList((prev) =>
        prev.filter(
          (st) => (st.id || st._id)?.toString() !== subtaskId?.toString(),
        ),
      );

      // Dispatch event to notify AllTasks list to update its state too
      window.dispatchEvent(
        new CustomEvent("subtaskUpdate", {
          detail: { parentTaskId, subtaskId, action: "deleted" },
        }),
      );

      // Invalidate tasks query to update UI instantly
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });

      showSuccessToast("Subtask deleted successfully");

      // Refresh parent task to sync tab count and all data
      if (refreshTask) {
        await refreshTask();
      }
    } catch (error) {
      console.error("Error deleting subtask:", error);
      showErrorToast(error.message || "Failed to delete subtask");
    } finally {
      setDeleteConfirmModal({
        isOpen: false,
        subtaskId: null,
        subtaskTitle: "",
        isDeleting: false,
      });
    }
  };

  // Helper to get ID from various formats
  const getIdString = (value) => {
    if (!value) return null;
    if (typeof value === "string") return value;
    if (value._id) return value._id.toString();
    if (value.id) return value.id.toString();
    return value.toString();
  };

  const canEditSubtask = (subtask) => {
    const currentUserId =
      getIdString(currentUser?.id) || getIdString(currentUser?._id);
    const subtaskCreatorId =
      getIdString(subtask?.createdBy) || getIdString(subtask?.creatorId);
    const subtaskAssigneeId =
      getIdString(subtask?.assignedTo) || getIdString(subtask?.assigneeId);
    const parentCreatorId =
      getIdString(parentTask?.creatorId) || getIdString(parentTask?.createdBy);
    const parentAssigneeId =
      getIdString(parentTask?.assigneeId) ||
      getIdString(parentTask?.assignedTo);

    const userRole = currentUser?.role?.toLowerCase() || "";
    const isAdmin =
      userRole === "admin" ||
      userRole === "org_admin" ||
      userRole === "tasksetu-admin" ||
      userRole === "super-admin";
    const isManager = userRole === "manager";
    const isIndividual = userRole === "individual";

    // Check by ID first, then by name as fallback
    const isSubtaskCreator =
      currentUserId === subtaskCreatorId ||
      subtask.createdBy === currentUser?.name;
    const isSubtaskAssignee =
      currentUserId === subtaskAssigneeId ||
      subtask.assignee === currentUser?.name;
    const isParentOwner = currentUserId === parentCreatorId;
    const isParentAssignee = currentUserId === parentAssigneeId;

    console.log("DEBUG - canEditSubtask:", {
      currentUserId,
      subtaskCreatorId,
      subtaskAssigneeId,
      parentCreatorId,
      isSubtaskCreator,
      isSubtaskAssignee,
      isParentOwner,
      isIndividual,
      userRole,
    });

    // Admins and managers can edit all subtasks
    if (isAdmin || isManager) return true;

    // Individual users can edit subtasks they created, are assigned to, or if they own the parent task
    if (isIndividual) {
      return (
        isSubtaskCreator ||
        isSubtaskAssignee ||
        isParentOwner ||
        isParentAssignee
      );
    }

    // Regular employees can edit subtasks they created or are assigned to
    return isSubtaskCreator || isSubtaskAssignee;
  };

  const canDeleteSubtask = (subtask) => {
    const currentUserId =
      getIdString(currentUser?.id) || getIdString(currentUser?._id);
    const subtaskCreatorId =
      getIdString(subtask?.createdBy) || getIdString(subtask?.creatorId);
    const parentCreatorId =
      getIdString(parentTask?.creatorId) || getIdString(parentTask?.createdBy);

    const userRole = currentUser?.role?.toLowerCase() || "";
    const isAdmin =
      userRole === "admin" ||
      userRole === "org_admin" ||
      userRole === "tasksetu-admin" ||
      userRole === "super-admin";
    const isIndividual = userRole === "individual";

    // Check by ID first, then by name as fallback
    const isSubtaskCreator =
      currentUserId === subtaskCreatorId ||
      subtask.createdBy === currentUser?.name;
    const isParentOwner = currentUserId === parentCreatorId;

    // Admins can delete any subtask
    if (isAdmin) return true;

    // Individual users can delete subtasks they created or if they own the parent task
    if (isIndividual) {
      return isSubtaskCreator || isParentOwner;
    }

    // Regular users can only delete subtasks they created
    return isSubtaskCreator;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "completed":
      case "DONE":
        return "\u2705";
      case "in-progress":
      case "INPROGRESS":
        return "\uD83D\uDD35";
      case "to-do":
      case "OPEN":
        return "\u26AA";
      case "PENDING":
      case "pending":
        return "\uD83D\uDD50";
      case "ONHOLD":
      case "onhold":
        return "\uD83D\uDD50";
      case "CANCELLED":
      case "CANCELED":
      case "cancelled":
      case "canceled":
        return "\u274C";
      default:
        return "";
    }
  };

  const getStatusLabel = (status) => {
    if (!status) return "";

    // First try to find the status in taskStatuses
    const statusObj = (Array.isArray(taskStatuses) ? taskStatuses : []).find(
      (s) =>
        s && s.code && s.code.toUpperCase() === String(status).toUpperCase(),
    );

    if (statusObj && statusObj.label) {
      return statusObj.label;
    }

    // Fallback to hardcoded mapping for compatibility
    const normalizedStatus = String(status).toUpperCase();
    const mapping = {
      OPEN: "Open",
      "TO-DO": "Open",
      PENDING: "Open",
      INPROGRESS: "In Progress",
      "IN-PROGRESS": "In Progress",
      DONE: "Completed",
      COMPLETED: "Completed",
      ONHOLD: "On Hold",
      "ON-HOLD": "On Hold",
      REVIEW: "On Hold",
      CANCELLED: "Cancelled",
      CANCELED: "Cancelled",
    };

    return mapping[normalizedStatus] || status;
  };

  // Per-status progress weight
  const getStatusWeight = (status) => {
    const s = String(status || "").toUpperCase();
    if (s === "DONE" || s === "COMPLETED") return 100;
    if (s === "INPROGRESS" || s === "IN-PROGRESS") return 50;
    return 0; // OPEN, TO-DO, PENDING, ONHOLD, CANCELLED, etc.
  };

  // Exclude cancelled subtasks from progress calculation
  const activeSubtasks = subtaskList.filter(
    (st) => !isCancelledStatus(st.status),
  );
  const progressPercentage =
    activeSubtasks.length > 0
      ? Math.round(
          activeSubtasks.reduce(
            (sum, st) => sum + getStatusWeight(st.status),
            0,
          ) / activeSubtasks.length,
        )
      : 0;

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-md">
        {/* Compact Header */}
        <div
          className="flex items-center justify-between px-3 py-3 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-500 hover:text-gray-700 text-xs h-6 w-6"
            >
              {isCollapsed ? "▶" : "▼"}
            </Button>
            <h3 className="text-sm font-medium text-gray-900">
              Sub-tasks ({filteredSubtasks.length}/{subtaskList.length})
            </h3>
            {subtaskList.length > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-12 bg-gray-200 rounded-full h-1">
                  <div
                    className="bg-green-500 h-1 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <span className="text-xs text-gray-600">
                  {progressPercentage}%
                </span>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search subtasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-sm border border-gray-300 rounded px-3 py-1 w-40 focus:w-56 transition-all duration-200"
                onClick={(e) => e.stopPropagation()}
              />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="text-sm border border-gray-300 rounded px-3 py-1"
                onClick={(e) => e.stopPropagation()}
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
              <Button
                variant="primary"
                className="h-9 text-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  if (parentTask?.status === "DONE") {
                    showErrorToast(
                      "Cannot create subtask: Task is already completed.",
                    );
                    return;
                  }
                  if (
                    parentTask?.isSubtask === true ||
                    parentTask?.parentTaskId
                  ) {
                    showErrorToast(
                      "Nested subtasks are not allowed. Only 1 level of hierarchy is supported.",
                    );
                    return;
                  }
                  if (
                    parentTask?.taskType === "approval" ||
                    parentTask?.isApprovalTask === true
                  ) {
                    showErrorToast(
                      "Subtasks are not allowed for Approval tasks.",
                    );
                    return;
                  }
                  if (
                    parentTask?.taskType === "quick" ||
                    parentTask?.isQuickTask === true
                  ) {
                    showErrorToast("Subtasks are not allowed for Quick tasks.");
                    return;
                  }
                  if (!checkFeature("TASK_SUB")) {
                    setShowUpgradeModal(true);
                    return;
                  }

                  openSubtaskDrawer(parentTask, null, refreshTask);
                }}
              >
                + Add Sub-task
              </Button>
            </div>
          )}
        </div>

        {/* Compact Content */}
        {!isCollapsed && (
          <div>
            <div>
              {filteredSubtasks.map((subtask, index) => (
                <div key={subtask.id}>
                  {/* Sub-task Row */}
                  <div
                    className={`border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${
                      expandedSubtasks.includes(subtask.id)
                        ? "bg-blue-50 border-l-2 border-l-blue-500"
                        : ""
                    }`}
                    onClick={() => {
                      setExpandedSubtasks((prev) =>
                        prev.includes(subtask.id)
                          ? prev.filter((id) => id !== subtask.id)
                          : [...prev, subtask.id],
                      );
                    }}
                  >
                    <div className="flex items-center justify-between px-3 py-3">
                      {/* Left side - Name */}
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-sm font-medium truncate text-gray-900`}
                          title={subtask.title}
                        >
                          {subtask.title}
                        </div>
                      </div>

                      {/* Center - Due Date */}
                      <div className="flex-shrink-0 mx-4">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            new Date(subtask.dueDate) < new Date() &&
                            subtask.status !== "completed" &&
                            subtask.status !== "DONE"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {subtask.dueDate}
                          {new Date(subtask.dueDate) < new Date() &&
                            subtask.status !== "completed" &&
                            subtask.status !== "DONE" && (
                              <span className="ml-1">🔴</span>
                            )}
                        </span>
                      </div>

                      {/* Right side - Status & Assignee */}
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {getStatusIcon(subtask.status)}
                        </span>
                        <span
                          className="text-xs text-gray-600 truncate max-w-20"
                          title={subtask.assignee}
                        >
                          {subtask.assignee}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Sub-task Details */}
                  {expandedSubtasks.includes(subtask.id) && (
                    <div className="border-b border-gray-100 bg-gray-50 px-6 py-4">
                      <div className="grid grid-cols-3 gap-6">
                        {/* Left column - Basic details */}
                        <div className="space-y-3 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">
                              Status:
                            </span>
                            <span className="ml-2">
                              {getStatusLabel(subtask.status)}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">
                              Assignee:
                            </span>
                            <span className="ml-2">{subtask.assignee}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">
                              Due Date:
                            </span>
                            <span className="ml-2">{subtask.dueDate}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">
                              Priority:
                            </span>
                            <span className="ml-2">
                              {subtask.priority || "Medium"}
                            </span>
                          </div>
                        </div>

                        {/* Right column - Description */}
                        <div className="col-span-2">
                          <div className="font-medium text-gray-700 mb-2">
                            Description:
                          </div>

                          <div className="text-sm text-gray-700 leading-relaxed max-h-20 overflow-y-auto pr-2">
                            {subtask.description ? (
                              <div
                                dangerouslySetInnerHTML={{
                                  __html: subtask.description,
                                }}
                              />
                            ) : (
                              <span className="text-gray-400 italic">
                                No description provided
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 mt-3">
                        {canEditSubtask(subtask) &&
                          parentTask?.status !== "DONE" && (
                            <Button
                              variant="primary"
                              className="h-9 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log(
                                  "Edit subtask clicked:",
                                  subtask.id,
                                  subtask,
                                );
                                const transformedSubtask =
                                  transformSubtaskForEdit(subtask);
                                openSubtaskDrawer(
                                  parentTask,
                                  transformedSubtask,
                                  refreshTask,
                                );
                              }}
                            >
                              Edit
                            </Button>
                          )}
                        {(() => {
                          const canDeleteByPermission =
                            canDeleteSubtask(subtask);
                          const DELETABLE_STATUSES = [
                            "OPEN",
                            "ONHOLD",
                            "CANCELLED",
                          ];
                          const canDeleteByStatus = DELETABLE_STATUSES.includes(
                            subtask?.status,
                          );
                          const canDelete =
                            canDeleteByPermission && canDeleteByStatus;

                          const getDeleteTooltip = () => {
                            if (!canDeleteByPermission)
                              return "You do not have permission to delete this subtask";
                            if (!canDeleteByStatus)
                              return `Cannot delete subtask with status ${subtask?.status}. Only OPEN, ONHOLD or CANCELLED subtasks can be deleted.`;
                            return "";
                          };

                          return (
                            <Button
                              variant="destructive"
                              className="h-9 text-xs"
                              disabled={!canDelete}
                              title={getDeleteTooltip()}
                              style={
                                !canDelete
                                  ? { opacity: 0.5, cursor: "not-allowed" }
                                  : {}
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSubtask(
                                  subtask.id || subtask._id,
                                  subtask.title,
                                );
                              }}
                            >
                              Delete
                            </Button>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {filteredSubtasks.length === 0 && (
              <div className="px-3 py-6 text-center text-gray-500 text-sm">
                {subtaskList.length === 0
                  ? "No sub-tasks yet. Click 'Add Sub-task' to create one."
                  : "No sub-tasks match the current filter."}
              </div>
            )}
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
                  subtaskId: null,
                  subtaskTitle: "",
                  isDeleting: false,
                });
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
                    Delete Subtask
                  </h3>
                  <p className="text-sm text-gray-500">
                    This action cannot be undone
                  </p>
                </div>
              </div>

              <p className="text-sm text-gray-700 mb-6">
                Are you sure you want to delete{" "}
                <strong className="text-gray-900">
                  "{deleteConfirmModal.subtaskTitle}"
                </strong>
                ? This will permanently remove the subtask.
              </p>

              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  className="px-4"
                  onClick={() =>
                    setDeleteConfirmModal({
                      isOpen: false,
                      subtaskId: null,
                      subtaskTitle: "",
                      isDeleting: false,
                    })
                  }
                  disabled={deleteConfirmModal.isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="px-4"
                  onClick={executeDeleteSubtask}
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
                    "Delete Subtask"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <UpgradeRequiredModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        featureName="Subtask"
      />
    </>
  );
}

export default SubtasksPanel;
