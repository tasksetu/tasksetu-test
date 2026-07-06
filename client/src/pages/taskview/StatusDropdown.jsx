import React, { useState, useEffect } from "react";
import getStatusLabel from "./statusUtils";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { useShowToast } from "@/utils/ToastMessage";

function StatusDropdown({ status, onChange, canEdit, task, currentUser }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(null); // Track which specific status is updating
  const [currentStatusCode, setCurrentStatusCode] = useState(status); // Track current status for color updates
  const { showSuccessToast, showErrorToast } = useShowToast();

  const { data: taskStatuses = [] } = useQuery({
    queryKey: ["/api/task-statuses"],
    enabled: !!localStorage.getItem("token"),
  });

  // API integration function
  const executeStatusChange = async (newStatusCode) => {
    const taskId = task?.id || task?._id;

    if (!taskId) {
      console.error("StatusDropdown: Task ID not found for status update");
      showErrorToast("Task ID not found. Cannot update status.");
      return false;
    }

    setIsUpdating(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      console.log(
        `StatusDropdown: Updating task ${taskId} status to ${newStatusCode}`,
        {
          taskTitle: task?.title || "Unknown",
          fromStatus: status,
          toStatus: newStatusCode,
        },
      );

      const response = await axios.patch(
        `/api/tasks/${taskId}/status`,
        { status: newStatusCode },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      console.log("StatusDropdown: Status update successful:", response.data);

      // Call the parent's status change handler for immediate UI update
      if (onChange) {
        onChange(newStatusCode);
      }

      // Force a UI re-render by updating immediately
      const statusEvent = new CustomEvent("taskStatusUpdated", {
        detail: {
          taskId: task?.id || task?._id,
          newStatus: newStatusCode,
          immediate: true,
        },
      });
      window.dispatchEvent(statusEvent);

      // Also emit color update event for immediate color changes
      const colorEvent = new CustomEvent("taskColorUpdated", {
        detail: {
          taskId: task?.id || task?._id,
          newStatus: newStatusCode,
          immediate: true,
        },
      });
      window.dispatchEvent(colorEvent);

      return true;
    } catch (error) {
      console.error("StatusDropdown: Error updating status:", error);

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

      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  // DB-driven statuses (organization-scoped)
  const statuses = (Array.isArray(taskStatuses) ? taskStatuses : [])
    .filter((s) => s && s.active)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((s) => ({
      value: s.code,
      label: s.label,
      color: s.color,
      isFinal: !!s.isFinal,
      description: s.description || "",
      tooltip: s.description || s.label,
    }));

  const currentStatus = statuses.find((s) => s.value === currentStatusCode) ||
    statuses.find((s) => s.value === "OPEN") ||
    statuses[0] || {
      value: currentStatusCode,
      label: getStatusLabel(currentStatusCode),
      color: "#6c757d",
      isFinal: false,
      description: "",
      tooltip: "",
    };

  // Update current status when prop changes
  useEffect(() => {
    setCurrentStatusCode(status);
  }, [status]);

  // Get valid transitions based on business rules
  const getValidTransitions = () => {
    const all = statuses
      .map((s) => s.value)
      .filter(
        (code) => code && code !== currentStatusCode && code !== "CANCELLED",
      ); // ← hide CANCELLED from dropdown

    // Block DONE if subtasks incomplete (if DONE exists)
    return all.filter((code) => {
      if (code !== "DONE") return true;
      if (!task?.subtasks || task.subtasks.length === 0) return true;
      return (
        task.subtasks.filter(
          (subtask) =>
            subtask.status !== "DONE" && subtask.status !== "CANCELLED",
        ).length === 0
      );
    });
  };

  const validTransitions = getValidTransitions();

  const canMarkAsCompleted = () => {
    if (!task?.subtasks || task.subtasks.length === 0) return true;

    const incompleteSubtasks = task.subtasks.filter(
      (subtask) => subtask.status !== "DONE" && subtask.status !== "CANCELLED",
    );

    return incompleteSubtasks.length === 0;
  };

  const handleStatusClick = async (statusOption) => {
    if (isUpdating) return;

    // Validate transition
    if (!validTransitions.includes(statusOption.value)) {
      showErrorToast(
        `Invalid transition from "${currentStatus.label}" to "${statusOption.label}". Please follow the allowed workflow.`,
      );
      return;
    }

    // Check sub-task dependencies for completion
    if (statusOption.value === "DONE" && !canMarkAsCompleted()) {
      const incompleteCount = task.subtasks.filter(
        (s) => s.status !== "DONE" && s.status !== "CANCELLED",
      ).length;
      showErrorToast(
        `Cannot mark task as completed. There are ${incompleteCount} incomplete sub-tasks that must be completed or cancelled first.`,
      );
      return;
    }

    // Show confirmation for final statuses
    if (statusOption.isFinal && statusOption.value !== status) {
      setShowConfirmation({
        newStatus: statusOption.value,
        newLabel: statusOption.label,
        description: statusOption.description,
      });
      setIsOpen(false);
      return;
    }

    // Direct update for non-final statuses with API integration
    const success = await executeStatusChange(statusOption.value);
    setUpdatingStatus(null); // Reset updating status after API call
    if (success) {
      // Update current status for immediate color change
      setCurrentStatusCode(statusOption.value);
      setIsOpen(false);

      // Log activity with enhanced details
      logActivity("status_changed", {
        oldStatus: getStatusLabel(status),
        newStatus: statusOption.label,
        user: currentUser?.name || "Unknown User",
        timestamp: new Date().toISOString(),
        taskId: task.id,
        reason: "Manual status change",
      });
    }
  };

  const confirmStatusChange = async () => {
    if (isUpdating) return;

    const success = await executeStatusChange(showConfirmation.newStatus);
    setUpdatingStatus(null); // Reset updating status after API call
    if (success) {
      // Update current status for immediate color change
      setCurrentStatusCode(showConfirmation.newStatus);

      // Log activity with confirmation
      logActivity("status_changed", {
        oldStatus: getStatusLabel(status),
        newStatus: showConfirmation.newLabel,
        user: currentUser?.name || "Unknown User",
        timestamp: new Date().toISOString(),
        taskId: task.id,
        reason: "Final status confirmed",
        confirmed: true,
      });

      setShowConfirmation(null);
    }
  };

  const logActivity = (type, details) => {
    console.log(`🔄 Status Activity:`, details);
    // In real app, this would be sent to backend for permanent audit trail
  };

  if (!canEdit) {
    return (
      <div className="status-display readonly">
        <span
          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white cursor-help"
          style={{ backgroundColor: currentStatus.color }}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {getStatusLabel(status)}
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
            {currentStatus.tooltip} (Read-only)
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="status-dropdown relative">
        <button
          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white hover:opacity-80 transition-opacity"
          style={{ backgroundColor: currentStatus.color }}
          onClick={() => setIsOpen(!isOpen)}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {getStatusLabel(status)}
          <svg className="ml-1 w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {/* Enhanced tooltip */}
        {showTooltip && !isOpen && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded whitespace-nowrap z-10 max-w-xs">
            {currentStatus.tooltip}
          </div>
        )}

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute top-full left-0 mt-1 w-72 bg-white rounded-sm shadow-lg border border-gray-200 py-1 z-20">
              {/* Current Status */}
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: currentStatus.color }}
                  />
                  <span className="font-medium">
                    Current: {currentStatus.label}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {currentStatus.description}
                </div>
              </div>

              {/* Valid Transitions */}
              {validTransitions.length > 0 ? (
                <div className="py-1">
                  <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Available Actions
                  </div>
                  {validTransitions.map((transitionCode) => {
                    const targetStatus = statuses.find(
                      (s) => s.value === transitionCode,
                    );
                    if (!targetStatus) return null;

                    return (
                      <button
                        key={transitionCode}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={updatingStatus === targetStatus.value}
                        onClick={() => {
                          setUpdatingStatus(targetStatus.value);
                          handleStatusClick(targetStatus);
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
                          <div className="text-xs text-gray-500">
                            {targetStatus.description}
                          </div>
                        </div>
                        {updatingStatus === targetStatus.value && (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                        )}
                        {targetStatus.isFinal &&
                          updatingStatus !== targetStatus.value && (
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
                    No actions available
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {task?.subtasks?.length > 0 &&
                    task.subtasks.some(
                      (s) => s.status !== "DONE" && s.status !== "CANCELLED",
                    )
                      ? "Complete all sub-tasks to proceed"
                      : "This is a final status"}
                  </div>
                </div>
              )}

              {/* Status Workflow Info */}
              <div className="border-t border-gray-200 px-3 py-2">
                <div className="text-xs font-medium text-gray-500 mb-2">
                  Status Workflow
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  {statuses
                    .filter((s) => s.value !== "CANCELLED")
                    .map((s, index, arr) => (
                      <React.Fragment key={s.value}>
                        <span
                          className={`px-2 py-1 rounded ${
                            s.value === status
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100"
                          }`}
                        >
                          {s.label}
                        </span>
                        {index < arr.length - 1 && <span>→</span>}
                      </React.Fragment>
                    ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Enhanced Status Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overlay-animate">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full modal-animate-fade">
            <div className="p-4">
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mr-3">
                  <svg
                    className="w-6 h-6 text-orange-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 15.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Confirm Final Status
                </h3>
              </div>

              <div className="mb-3">
                <p className="text-gray-600 mb-3">
                  Are you sure you want to mark this task as{" "}
                  <span className="font-semibold text-gray-900">
                    {showConfirmation.newLabel}
                  </span>
                  ?
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-sm p-3">
                  <p className="text-sm text-yellow-800">
                    <span className="font-medium">Note:</span>{" "}
                    {showConfirmation.description} This action cannot be undone
                    easily.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmation(null)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmStatusChange}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isUpdating && (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                  )}
                  {isUpdating ? "Updating..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default StatusDropdown;
