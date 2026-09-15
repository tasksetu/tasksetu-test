import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useShowToast } from "@/utils/ToastMessage";
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function TaskStatusDropdown({
  task,
  currentStatus,
  statuses,
  onStatusChange,
  canEdit,
  canMarkCompleted,
}) {
  // Notes:
  // - The dropdown menu is rendered into document.body via createPortal and positioned using
  //   fixed coordinates derived from the trigger's getBoundingClientRect(). This avoids clipping
  //   inside table cells or overflow-hidden containers.
  // - Position updates on scroll and resize to keep the menu aligned with the trigger.
  // - Keep tooltip rendering inline (not portaled) as it's small and anchored to the trigger.
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [validTransitions, setValidTransitions] = useState([]);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ top: 100, left: 16, width: 176 });
  const [isUpdating, setIsUpdating] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(null); // Track which specific status is updating
  const { showSuccessToast, showErrorToast } = useShowToast();

  // API integration function
  const executeStatusChange = async (newStatusCode) => {
    const taskId = task?.id || task?._id;

    if (!taskId) {
      console.error('TaskStatusDropdown: Task ID not found for status update');
      return false;
    }

    // If a parent handler is provided, let it handle the API call and logic
    if (onStatusChange) {
      console.log(`TaskStatusDropdown: Forwarding status change to parent handler for task ${taskId}`);
      setIsUpdating(true);
      try {
        await onStatusChange(newStatusCode);
        return true;
      } catch (err) {
        console.error("TaskStatusDropdown parent status change error:", err);
        return false;
      } finally {
        setIsUpdating(false);
      }
    }

    setIsUpdating(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      console.log(`TaskStatusDropdown: Updating task ${taskId} status to ${newStatusCode}`, {
        taskTitle: task?.title || 'Unknown',
        fromStatus: currentStatus,
        toStatus: newStatusCode
      });

      const response = await axios.patch(
        `/api/tasks/${taskId}/status`,
        { status: newStatusCode },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('TaskStatusDropdown: Status update successful:', response.data);

      showSuccessToast("Status updated");

      // Call the parent's status change handler for immediate UI update
      if (onStatusChange) {
        onStatusChange(newStatusCode);
      }

      // Force a UI re-render by updating the current status immediately
      // This ensures the badge color changes instantly
      const statusEvent = new CustomEvent('taskStatusUpdated', {
        detail: {
          taskId: task?.id || task?._id,
          newStatus: newStatusCode,
          immediate: true // Flag for immediate color update
        }
      });
      window.dispatchEvent(statusEvent);

      // Also trigger a color update event
      const colorEvent = new CustomEvent('taskColorUpdated', {
        detail: {
          taskId: task?.id || task?._id,
          newStatus: newStatusCode
        }
      });
      window.dispatchEvent(colorEvent);

      return true;

    } catch (error) {
      console.error('TaskStatusDropdown: Error updating status:', error);

      let errorMessage = 'Failed to update task status';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 401) {
        errorMessage = 'Authentication failed. Please login again.';
      } else if (error.response?.status === 403) {
        errorMessage = 'You do not have permission to update this task.';
      } else if (error.response?.status === 404) {
        errorMessage = 'Task not found.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      // You can add a toast notification or alert here
      showErrorToast(errorMessage);

      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  // Enhanced status matching with fallbacks
  const normStatus = (str) =>
    String(str || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  // Enhanced status matching with fallbacks
  let currentStatusObj = statuses.find(
    (s) => s.code === currentStatus && s.active !== false,
  );

  // Fallback 1: Normalized code matching (handles IN_PROGRESS vs in_progress vs inprogress)
  if (!currentStatusObj && currentStatus) {
    currentStatusObj = statuses.find(
      (s) => normStatus(s.code) === normStatus(currentStatus) && s.active !== false,
    );
  }

  // Fallback 2: Normalized label matching (handles "In Progress" vs "IN_PROGRESS")
  if (!currentStatusObj && currentStatus) {
    currentStatusObj = statuses.find(
      (s) => normStatus(s.label) === normStatus(currentStatus) && s.active !== false,
    );
  }

  const isNormInProgress = normStatus(currentStatus) === "inprogress";
  const isNormDone = normStatus(currentStatus) === "done" || normStatus(currentStatus) === "completed";
  const isNormOpen = normStatus(currentStatus) === "open";

  const displayLabel = currentStatusObj?.label || (
    isNormInProgress
      ? "In Progress"
      : isNormDone
        ? "Completed"
        : isNormOpen
          ? "Open"
          : currentStatus
  );

  const displayColor = currentStatusObj?.color || (
    isNormInProgress
      ? "#3b82f6"
      : isNormDone
        ? "#16a34a"
        : isNormOpen
          ? "#6c757d"
          : "#6c757d"
  );

  // Comprehensive debug logging
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('TaskStatusDropdown Debug Info:', {
        currentStatus,
        currentStatusType: typeof currentStatus,
        taskTitle: task?.title || 'Unknown',
        availableStatuses: statuses.map(s => ({
          code: s.code,
          label: s.label,
          color: s.color,
          active: s.active
        })),
        foundStatusObj: currentStatusObj ? {
          code: currentStatusObj.code,
          label: currentStatusObj.label,
          color: currentStatusObj.color
        } : null,
        isMatched: !!currentStatusObj
      });
    }
  }, [currentStatus, statuses, currentStatusObj, task?.title]);

  const badgeStyle = {
    backgroundColor: displayColor,
    color: "white",
    border: `2px solid ${displayColor}`,
    boxShadow: `0 0 0 1px ${displayColor}20`
  };

  // Calculate valid transitions when dropdown opens
  useEffect(() => {
    if (isOpen && currentStatusObj) {
      // ✅ Fixed: Use allowedTransitions if it's an array (even if empty)
      // Empty array [] means no transitions allowed (e.g., DONE, CANCELLED)
      // undefined/null means use all statuses (backward compatibility)
      const candidateCodes =
        Array.isArray(currentStatusObj.allowedTransitions)
          ? currentStatusObj.allowedTransitions
          : statuses
            .filter((s) => s.active)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((s) => s.code)
            .filter((code) => code && code !== currentStatusObj.code);

      const transitions = candidateCodes.filter((transitionCode) => {
        const targetStatus = statuses.find((s) => s.code === transitionCode && s.active);

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
      });

      setValidTransitions(transitions);
    }
  }, [isOpen, currentStatusObj, task.subtasks, statuses]);

  // Check if DONE status is blocked due to incomplete subtasks
  const isDoneBlockedBySubtasks = (statusCode) => {
    if (statusCode !== 'DONE') return false;
    if (!task.subtasks || task.subtasks.length === 0) return false;

    return task.subtasks.some(subtask =>
      subtask.status !== 'DONE' && subtask.status !== 'CANCELLED'
    );
  };

  // Get incomplete subtasks count
  const getIncompleteSubtasksCount = () => {
    if (!task.subtasks || task.subtasks.length === 0) return 0;
    return task.subtasks.filter(st =>
      st.status !== 'DONE' && st.status !== 'CANCELLED'
    ).length;
  };

  // Update floating menu position when open, on scroll/resize
  useLayoutEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) {
        setPos({ top: 100, left: 16, width: 176 });
        return;
      }

const baseWidth = 176;
      const minWidth = Math.max(baseWidth, rect.width);
      const vw = window.innerWidth;
      const left = Math.min(Math.max(8, rect.left), vw - minWidth - 8);
      const GAP = 4;
      const spaceBelow = window.innerHeight - rect.bottom;
      const menuEl = menuRef.current;
      const actualHeight = menuEl ? menuEl.offsetHeight : 200;
      const top = spaceBelow >= actualHeight + GAP
        ? rect.bottom + GAP
        : Math.max(GAP, rect.top - actualHeight - GAP);
      setPos({ top, left, width: minWidth });
    };

    updatePosition();
    const onScroll = () => updatePosition();
    const onResize = () => updatePosition();
    const onMouseDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && buttonRef.current && !buttonRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [isOpen]);

  if (!canEdit) {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium cursor-not-allowed border border-white/25 select-none"
              style={{
                backgroundColor: currentStatusObj?.color || "#6c757d",
                color: "white",
              }}
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
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            sideOffset={6}
            className="bg-gray-800 text-white text-xs px-3 py-1.5 rounded-md shadow-xl border border-gray-700 z-[99999] max-w-xs select-none"
          >
            {currentStatusObj?.tooltip || "No permission to edit"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="relative inline-flex items-center">
      <Button
        ref={buttonRef}
        variant="ghost"
        disabled={isUpdating}
        className="inline-flex h-6 items-center px-2.5 py-0 text-xs font-medium hover:opacity-80 transition-opacity rounded-md disabled:opacity-90 disabled:cursor-wait"
        style={badgeStyle}
        onClick={() => !isUpdating && setIsOpen(!isOpen)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {isUpdating ? (
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <svg
              className="animate-spin h-3 w-3 text-white"
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
            <span>Updating...</span>
          </span>
        ) : (
          <>
            {currentStatusObj?.label || currentStatus}
            <svg className="ml-1 w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </>
        )}
      </Button>

      {/* Status tooltip */}
      {showTooltip && !isOpen && currentStatusObj?.tooltip && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-md whitespace-nowrap z-[9999] max-w-xs shadow-md">
          {currentStatusObj.tooltip}
        </div>
      )}

      {isOpen &&
        createPortal(
          <>
            {/* Floating menu rendered in portal */}
            <div
              ref={menuRef}
              className="fixed z-[99999] bg-white rounded-md shadow-xl border border-gray-200 py-1"
              style={{ top: pos.top, left: pos.left, minWidth: pos.width }}
              role="menu"
              aria-orientation="vertical"
            >
              {/* Valid Transitions */}
              {validTransitions.length > 0 ? (
                <div>
                  {validTransitions.map((transitionCode) => {
                    const targetStatus = statuses.find(
                      (s) => s.code === transitionCode && s.active,
                    );
                    if (!targetStatus) return null;

                    return (
                      <Button
                        key={transitionCode}
                        variant="ghost"
                        className="w-full text-left px-2 py-1 text-sm flex items-center gap-2 transition-all duration-200 group relative overflow-hidden hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed justify-start h-auto rounded-md"
                        disabled={updatingStatus === transitionCode}
                        onClick={async () => {
                          setUpdatingStatus(transitionCode);
                          const success = await executeStatusChange(transitionCode);
                          setUpdatingStatus(null);
                          if (success) {
                            setIsOpen(false);
                          }
                        }}
                        style={{
                          background: `linear-gradient(90deg, ${targetStatus.color}15 0%, ${targetStatus.color}08 100%)`,
                          borderLeft: `3px solid ${targetStatus.color}`
                        }}
                        onMouseEnter={(e) => {
                          if (!isUpdating) {
                            e.currentTarget.style.background = `linear-gradient(90deg, ${targetStatus.color}25 0%, ${targetStatus.color}15 100%)`;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isUpdating) {
                            e.currentTarget.style.background = `linear-gradient(90deg, ${targetStatus.color}15 0%, ${targetStatus.color}08 100%)`;
                          }
                        }}
                      >
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0 border border-black/10"
                          style={{ backgroundColor: targetStatus.color }}
                        />
                        <span className="font-medium text-gray-900 flex-1">
                          {targetStatus.label}
                        </span>
                        {updatingStatus === transitionCode && (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-900"></div>
                        )}
                        {targetStatus.isFinal && updatingStatus !== transitionCode && (
                          <span className="text-xs bg-orange-100 text-orange-800 px-1 py-0.5 rounded-md border border-orange-200">
                            Final
                          </span>
                        )}
                      </Button>
                    );
                  })}

                  {/* Show message if DONE is blocked by incomplete subtasks */}
                  {isDoneBlockedBySubtasks('DONE') && !validTransitions.includes('DONE') && (
                    <div className="px-3 py-2 border-t border-gray-200 mt-1">
                      <div className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-gray-900">Cannot mark as Done</p>
                          <p className="text-xs text-gray-600 mt-0.5">
                            Please complete all {getIncompleteSubtasksCount()} pending subtask(s) first
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
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
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
