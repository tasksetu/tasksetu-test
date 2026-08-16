import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import {
  Eye,
  Plus,
  Pause,
  AlertTriangle,
  CheckCircle,
  Trash2,
  Clock,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubtask } from "../../contexts/SubtaskContext";
import { useView } from "../../contexts/ViewContext";
import { useLocation } from "wouter";
import { useActiveRole } from "../../components/RoleSwitcher";
import axios from "axios";
import { useShowToast } from "../../utils/ToastMessage";
import { isApprovalTask } from "../../utils/taskHelpers";
import useLicense from "../../hooks/useLicense";
import {
  DeleteTaskModal,
  ReassignTaskModal,
  SnoozeTaskModal,
  MarkRiskModal,
  MitigationModal,
  MarkDoneModal,
} from "../../components/modals/TaskModals";
import UpgradeRequiredModal from "../../components/modals/UpgradeRequiredModal";

export default function TaskActionsDropdown({
  task,
  currentUser,
  onSnooze,
  onMarkAsRisk,
  onMarkAsDone,
  onQuickMarkAsDone,
  onDelete,
  onCancelApproval,
  // CHANGE 2: New prop — when true, hides "Create Sub-task" and "View Sub-task" options
  hideSubtaskOptions = false,
}) {
  const { openSubtaskDrawer } = useSubtask();
  const { openViewModal } = useView();
  const { activeRole } = useActiveRole();
  const { showSuccessToast, showErrorToast } = useShowToast();
  const { checkFeature } = useLicense();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [, navigate] = useLocation();

  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;
  const userId = user?.id || user?._id;

  const isAdmin = [
    "org_admin",
    "company-admin",
    "admin",
    "super-admin",
    "tasksetu-admin",
  ].includes(activeRole);
  const isOrgAdmin = ["org_admin", "org-admin"].includes(activeRole);
  const isManager = activeRole === "manager";

  const getId = (id) => {
    if (!id) return null;
    return typeof id === "object" ? id._id || id.id : id;
  };

  const isAssignee = getId(task?.assignedTo) === userId;
  const isCreator = getId(task?.createdBy) === userId;
  const isCollaborator =
    (task?.collaborators || task?.collaboratorIds)?.some(
      (id) => getId(id) === userId,
    ) || false;

  const canMarkRisk =
    isAdmin ||
    isOrgAdmin ||
    isManager ||
    isAssignee ||
    isCreator ||
    isCollaborator;

  const [showSnoozeModal, setShowSnoozeModal] = useState(false);
  const [showMarkRiskModal, setShowMarkRiskModal] = useState(false);
  const [showMitigationModal, setShowMitigationModal] = useState(false);
  const [showMarkDoneModal, setShowMarkDoneModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const snoozedUntil =
    task?.snoozedUntil || task?.snoozeUntil
      ? new Date(task?.snoozedUntil || task?.snoozeUntil)
      : null;
  const now = new Date();
  const isSnoozed = snoozedUntil && snoozedUntil > now;

  const computePosition = (rect) => {
    const gap = 6;
    const menuWidth = 224;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = rect.right - menuWidth;
    left = Math.max(8, Math.min(left, viewportWidth - menuWidth - 8));
    let top = rect.bottom + gap;
    const estimatedMenuHeight = 260;
    if (top + estimatedMenuHeight > viewportHeight - 8) {
      top = Math.max(8, rect.top - gap - estimatedMenuHeight);
    }
    return { top, left };
  };

  const updateMenuPosition = () => {
    const btn = triggerRef.current;
    if (!btn) {
      setMenuPos({ top: 100, left: 16 });
      return;
    }
    setMenuPos(computePosition(btn.getBoundingClientRect()));
  };

  useLayoutEffect(() => {
    const handleClickOutside = (event) => {
      const t = triggerRef.current;
      const m = menuRef.current;
      if (
        isOpen &&
        t &&
        m &&
        !t.contains(event.target) &&
        !m.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleResizeOrScroll = () => {
      if (isOpen) updateMenuPosition();
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside, true);
      window.addEventListener("resize", handleResizeOrScroll);
      window.addEventListener("scroll", handleResizeOrScroll, true);
      updateMenuPosition();
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      window.removeEventListener("resize", handleResizeOrScroll);
      window.removeEventListener("scroll", handleResizeOrScroll, true);
    };
  }, [isOpen]);

  const handleAction = (action) => {
    setIsOpen(false);
    action();
  };

  const handleUnsnoozeTask = async () => {
    try {
      const token = localStorage.getItem("token");
      const taskIdToUnsnooze = task?._id || task?.id;
      const response = await axios.patch(
        `/api/tasks/${taskIdToUnsnooze}/unsnooze`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      if (response.data.success) {
        showSuccessToast("Task woken up");
        if (onSnooze) {
          onSnooze({ action: "unsnooze" });
        }
      }
    } catch (error) {
      showErrorToast(error.response?.data?.message || error.message);
    }
  };

  const handleUnmarkRisk = async (reason) => {
    try {
      const token = localStorage.getItem("token");
      const taskId = task?._id || task?.id;

      const response = await axios.patch(
        `/api/tasks/${taskId}/unmark-risk`,
        { mitigationReason: reason },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (response.data.success) {
        showSuccessToast("Task marked as mitigated");
        if (onMarkAsRisk) {
          onMarkAsRisk({ action: "unmark", reason });
        }
      }
    } catch (error) {
      showErrorToast(error.response?.data?.message || error.message);
    }
  };

  // CHANGE 2: Updated canShowSubtaskOptions — now also checks hideSubtaskOptions prop
  // and blocks recurring instances (tasks that are part of a recurring group but not the pattern)
  const canShowSubtaskOptions = (task, userRole) => {
    // If parent explicitly hides subtask options (e.g. for recurring instances)
    if (hideSubtaskOptions) return false;

    if (["approval", "quick"].includes(task.taskType)) return false;

    if (task.taskType === "milestone") return false;

    // Hide for recurring pattern tasks
    if (task.taskType === "recurring" && task.isRecurringPattern) return false;

    // CHANGE 2: Also hide for recurring instance tasks
    // (instances are recurring tasks that are NOT the pattern — they're the expanded children)
    if (
      task.taskType === "recurring" &&
      task.isRecurring === true &&
      !task.isRecurringPattern
    )
      return false;

    if (userRole === "employee" && task.status === "ONHOLD") {
      return false;
    }

    if (!["regular", "recurring"].includes(task.taskType)) {
      return false;
    }

    return true;
  };

  const hasIncompleteSubtasks = (task) => {
    if (!task.subtasks || task.subtasks.length === 0) {
      return false;
    }
    return task.subtasks.some(
      (subtask) => subtask.status !== "DONE" && subtask.status !== "CANCELLED",
    );
  };

  const hasIncomplete = hasIncompleteSubtasks(task);

  const isMilestoneTask = task?.taskType === "milestone";
  const incompleteLinkedTasks = isMilestoneTask
    ? (task?.linkedTasks || []).filter(
        (lt) => lt.status !== "DONE" && lt.status !== "CANCELLED",
      )
    : [];
  const hasIncompleteLinkedTasks = incompleteLinkedTasks.length > 0;

  const canMarkAsDone = isMilestoneTask
    ? !hasIncompleteLinkedTasks
    : !hasIncomplete || isAdmin;
  const incompleteSubtasksCount =
    task.subtasks?.filter(
      (st) => st.status !== "DONE" && st.status !== "CANCELLED",
    ).length || 0;

  const isTaskDone = task?.status === "DONE";

  const isApproval = isApprovalTask(task);
  const isApprovalCreator =
    isApproval &&
    (getId(task?.createdBy || task?.creatorId) === userId ||
      getId(task?.createdBy?._id) === userId);
  const isApprovalApprover =
    isApproval &&
    (getId(task?.assignedTo || task?.assigneeId) === userId ||
      getId(task?.assignedTo?._id) === userId);

  return (
    <div className="relative z-10">
      <Button
        variant="ghost"
        size="icon"
        className="text-gray-400 cursor-pointer hover:text-gray-600 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        title="More actions"
        ref={triggerRef}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </Button>

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[99999] w-56 bg-white rounded-none shadow-xl border border-gray-200 py-2"
            style={{ top: menuPos.top, left: menuPos.left }}
            role="menu"
          >
            <button
              className="w-full text-left cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/tasks/${task.id}`);
              }}
            >
              <Eye size={16} className="text-gray-600" />
              <span className="font-medium">View</span>
            </button>

            {task?.status !== "CANCELLED" &&
            task?.status !== "REJECTED" &&
            task?.status !== "APPROVED" ? (
              isApproval ? (
                <>
                  {isApprovalCreator && (
                    <Button
                      variant="ghost"
                      className={`w-full text-left px-4 py-2 text-sm flex items-center gap-3 transition-colors justify-start h-auto rounded-none ${
                        isTaskDone
                          ? "cursor-not-allowed text-gray-400 bg-gray-50 opacity-60"
                          : task?.isRisk
                            ? "cursor-pointer text-emerald-600 hover:bg-emerald-50"
                            : "cursor-pointer text-gray-700 hover:bg-gray-50"
                      }`}
                      onClick={(e) => {
                        if (!isTaskDone) {
                          e.stopPropagation();
                          setIsOpen(false);
                          if (task?.isRisk) {
                            setShowMitigationModal(true);
                          } else {
                            setShowMarkRiskModal(true);
                          }
                        }
                      }}
                      disabled={isTaskDone}
                    >
                      {task?.isRisk ? (
                        <CheckCircle
                          size={16}
                          className={
                            isTaskDone ? "text-gray-400" : "text-emerald-600"
                          }
                        />
                      ) : (
                        <AlertTriangle
                          size={16}
                          className={
                            isTaskDone ? "text-gray-400" : "text-gray-600"
                          }
                        />
                      )}
                      <span className="font-medium">
                        {task?.isRisk ? "Mark as Mitigate" : "Mark as Risk"}
                      </span>
                    </Button>
                  )}
                  {isApprovalApprover && (
                    <Button
                      variant="ghost"
                      className={`w-full text-left px-4 py-2 text-sm flex items-center gap-3 transition-colors justify-start h-auto rounded-none ${
                        isTaskDone
                          ? "cursor-not-allowed text-gray-400 bg-gray-50 opacity-60"
                          : "cursor-pointer text-red-600 hover:bg-red-50"
                      }`}
                      onClick={(e) => {
                        if (!isTaskDone) {
                          e.stopPropagation();
                          setIsOpen(false);
                          setCancelReason("");
                          setShowCancelModal(true);
                        }
                      }}
                      disabled={isTaskDone}
                    >
                      <XCircle
                        size={16}
                        className={
                          isTaskDone ? "text-gray-400" : "text-red-600"
                        }
                      />
                      <span className="font-medium">Cancel</span>
                    </Button>
                  )}
                </>
              ) : (
                <>
                  {canShowSubtaskOptions(task, activeRole) && (
                    <>
                      <Button
                        variant="ghost"
                        className={`w-full text-left px-4 py-2 text-sm flex items-center gap-3 transition-colors justify-start h-auto rounded-none ${
                          isTaskDone
                            ? "cursor-not-allowed text-gray-400 bg-gray-50 opacity-60"
                            : "cursor-pointer text-gray-700 hover:bg-gray-50"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (task?.status === "DONE") {
                            showErrorToast(
                              "Cannot create subtask: Task is already completed.",
                            );
                            return;
                          }
                          if (task?.isSubtask === true || task?.parentTaskId) {
                            showErrorToast(
                              "Nested subtasks are not allowed. Only 1 level of hierarchy is supported.",
                            );
                            return;
                          }
                          if (
                            task?.taskType === "approval" ||
                            task?.isApprovalTask === true
                          ) {
                            showErrorToast(
                              "Subtasks are not allowed for Approval tasks.",
                            );
                            return;
                          }
                          if (
                            task?.taskType === "quick" ||
                            task?.isQuickTask === true
                          ) {
                            showErrorToast(
                              "Subtasks are not allowed for Quick tasks.",
                            );
                            return;
                          }
                          if (!checkFeature("TASK_SUB")) {
                            setIsOpen(false);
                            setShowUpgradeModal(true);
                            return;
                          }
                          setIsOpen(false);
                          openSubtaskDrawer(task);
                        }}
                        disabled={isTaskDone}
                      >
                        <Plus
                          size={16}
                          className={
                            isTaskDone ? "text-gray-400" : "text-gray-600"
                          }
                        />
                        <span className="font-medium">Create Sub-task</span>
                      </Button>

                      <Button
                        variant="ghost"
                        className="w-full text-left cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors justify-start h-auto rounded-none"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsOpen(false);
                          if (!checkFeature("TASK_SUB")) {
                            setIsOpen(false);
                            setShowUpgradeModal(true);
                            return;
                          }
                          navigate(`/tasks/${task.id}?tab=subtasks`);
                        }}
                      >
                        <Eye size={16} className="text-gray-600" />
                        <span className="font-medium">View Sub-task</span>
                      </Button>
                    </>
                  )}

                  {!isSnoozed && !isTaskDone && (
                    <Button
                      variant="ghost"
                      className="w-full text-left cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors justify-start h-auto rounded-none"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(false);
                        setShowSnoozeModal(true);
                      }}
                    >
                      <Clock size={16} className="text-gray-600" />
                      <span className="font-medium">Snooze</span>
                    </Button>
                  )}

                  {isSnoozed && (
                    <Button
                      variant="ghost"
                      className="w-full text-left cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors justify-start h-auto rounded-none"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(false);
                        handleUnsnoozeTask();
                      }}
                    >
                      <Clock size={16} className="text-gray-600" />
                      <span className="font-medium">Unsnooze</span>
                    </Button>
                  )}

                  {canMarkRisk && !isTaskDone && (
                    <Button
                      variant="ghost"
                      className={`w-full text-left cursor-pointer px-4 py-2 text-sm flex items-center gap-3 transition-colors justify-start h-auto rounded-none ${task?.isRisk ? "text-emerald-600 hover:bg-emerald-50" : "text-gray-700 hover:bg-gray-50"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(false);
                        if (task?.isRisk) {
                          setShowMitigationModal(true);
                        } else {
                          setShowMarkRiskModal(true);
                        }
                      }}
                    >
                      {task?.isRisk ? (
                        <CheckCircle size={16} className="text-emerald-600" />
                      ) : (
                        <AlertTriangle size={16} className="text-gray-600" />
                      )}
                      <span className="font-medium">
                        {task?.isRisk ? "Mark as Mitigate" : "Mark as Risk"}
                      </span>
                    </Button>
                  )}

                  {!isTaskDone && (
                    <Button
                      variant="ghost"
                      className="w-full text-left cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors justify-start h-auto rounded-none"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(false);
                        setShowMarkDoneModal(true);
                      }}
                    >
                      <CheckCircle size={16} className="text-green-600" />
                      <span className="font-medium text-green-600">
                        Mark as Done
                      </span>
                    </Button>
                  )}

                  {!isTaskDone && (
                    <Button
                      variant="ghost"
                      className="w-full text-left cursor-pointer px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors justify-start h-auto rounded-none"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(false);
                        setCancelReason("");
                        setShowCancelModal(true);
                      }}
                    >
                      <XCircle size={16} className="text-red-600" />
                      <span className="font-medium">Cancel</span>
                    </Button>
                  )}
                </>
              )
            ) : null}
          </div>,
          document.body,
        )}

      {(showSnoozeModal ||
        showMarkRiskModal ||
        showMitigationModal ||
        showMarkDoneModal ||
        showDeleteModal ||
        showCancelModal) &&
        createPortal(
          <>
            <SnoozeTaskModal
              isOpen={showSnoozeModal}
              onClose={() => setShowSnoozeModal(false)}
              onConfirm={(snoozeData) => {
                onSnooze && onSnooze(snoozeData);
                setShowSnoozeModal(false);
              }}
              task={task}
            />

            <MarkRiskModal
              isOpen={showMarkRiskModal}
              onClose={() => setShowMarkRiskModal(false)}
              onConfirm={(riskData) => {
                onMarkAsRisk && onMarkAsRisk(riskData);
                setShowMarkRiskModal(false);
              }}
              task={task}
            />

            <MitigationModal
              isOpen={showMitigationModal}
              onClose={() => setShowMitigationModal(false)}
              onConfirm={(reason) => {
                handleUnmarkRisk(reason);
                setShowMitigationModal(false);
              }}
              task={task}
            />

            <MarkDoneModal
              isOpen={showMarkDoneModal}
              onClose={() => setShowMarkDoneModal(false)}
              onConfirm={(doneData) => {
                onMarkAsDone && onMarkAsDone(doneData);
                setShowMarkDoneModal(false);
              }}
              task={task}
            />

            <DeleteTaskModal
              isOpen={showDeleteModal}
              onClose={() => setShowDeleteModal(false)}
              onConfirm={() => {
                onDelete && onDelete();
                setShowDeleteModal(false);
              }}
              task={task}
            />

            {showCancelModal && (
              <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white rounded-sm shadow-xl overflow-hidden max-w-md w-full border border-gray-200 animate-in fade-in zoom-in-95 duration-200 flex flex-col font-sans">
                  {/* Header */}
                  <div className="px-6 pt-3.5 pb-2.5 border-b border-gray-200 bg-gray-50/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                      <span
                        className="text-xl font-normal"
                        style={{ color: "#676a6c" }}
                      >
                        Cancel Task
                      </span>
                    </div>
                    <button
                      type="button"
                      className="text-gray-400 hover:text-gray-600 transition-colors w-6 h-6 flex items-center justify-center text-base"
                      onClick={() => setShowCancelModal(false)}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Body */}
                  <div className="p-6 space-y-3.5 bg-white">
                    <p className="text-xs text-gray-500 font-normal">
                      Are you sure you want to cancel this task? Please provide
                      a reason below.
                    </p>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                        Reason for cancellation{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Provide cancellation reason..."
                        className="w-full p-2.5 border border-gray-300 rounded-sm text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[90px] resize-none bg-white text-gray-900 placeholder:text-gray-400"
                      />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowCancelModal(false);
                        setCancelReason("");
                      }}
                      className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium h-8 px-4 rounded-sm !h-8"
                      style={{ height: "32px", minHeight: "32px" }}
                    >
                      Go Back
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        onCancelApproval?.(cancelReason);
                        setShowCancelModal(false);
                        setCancelReason("");
                      }}
                      disabled={!cancelReason.trim()}
                      className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium h-8 px-4 rounded-sm shadow-sm disabled:opacity-50 !h-8"
                      style={{ height: "32px", minHeight: "32px" }}
                    >
                      Confirm Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>,
          document.body,
        )}

      <UpgradeRequiredModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        featureName="Subtask"
      />
    </div>
  );
}
