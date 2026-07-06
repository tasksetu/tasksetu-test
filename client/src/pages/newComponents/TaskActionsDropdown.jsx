import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Eye, Plus, Pause, AlertTriangle, CheckCircle, Trash2, Clock, XCircle } from "lucide-react";
import { Button } from '@/components/ui/button';
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
  MarkDoneModal
} from '../../components/modals/TaskModals';
import UpgradeRequiredModal from '../../components/modals/UpgradeRequiredModal';


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

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const userId = user?.id || user?._id;

  const isAdmin = ['org_admin', 'company-admin', 'admin', 'super-admin', 'tasksetu-admin'].includes(activeRole);
  const isOrgAdmin = ['org_admin', 'org-admin'].includes(activeRole);
  const isManager = activeRole === 'manager';

  const getId = (id) => {
    if (!id) return null;
    return typeof id === 'object' ? (id._id || id.id) : id;
  };

  const isAssignee = getId(task?.assignedTo) === userId;
  const isCreator = getId(task?.createdBy) === userId;
  const isCollaborator = (task?.collaborators || task?.collaboratorIds)?.some(id => getId(id) === userId) || false;

  const canMarkRisk = isAdmin || isOrgAdmin || isManager || isAssignee || isCreator || isCollaborator;

  const [showSnoozeModal, setShowSnoozeModal] = useState(false);
  const [showMarkRiskModal, setShowMarkRiskModal] = useState(false);
  const [showMitigationModal, setShowMitigationModal] = useState(false);
  const [showMarkDoneModal, setShowMarkDoneModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const snoozedUntil = task?.snoozedUntil || task?.snoozeUntil ? new Date(task?.snoozedUntil || task?.snoozeUntil) : null;
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
        t && m &&
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
      const token = localStorage.getItem('token');
      const taskIdToUnsnooze = task?._id || task?.id;
      const response = await axios.patch(
        `/api/tasks/${taskIdToUnsnooze}/unsnooze`,
        {},
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      if (response.data.success) {
        showSuccessToast('Task woken up');
        if (onSnooze) {
          onSnooze({ action: 'unsnooze' });
        }
      }
    } catch (error) {
      showErrorToast(error.response?.data?.message || error.message);
    }
  };

  const handleUnmarkRisk = async (reason) => {
    try {
      const token = localStorage.getItem('token');
      const taskId = task?._id || task?.id;

      const response = await axios.patch(
        `/api/tasks/${taskId}/unmark-risk`,
        { mitigationReason: reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        showSuccessToast('Task marked as mitigated');
        if (onMarkAsRisk) {
          onMarkAsRisk({ action: 'unmark', reason });
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

    if (['approval', 'quick'].includes(task.taskType)) return false;

    if (task.taskType === 'milestone') return false;

    // Hide for recurring pattern tasks
    if (task.taskType === 'recurring' && task.isRecurringPattern) return false;

    // CHANGE 2: Also hide for recurring instance tasks
    // (instances are recurring tasks that are NOT the pattern — they're the expanded children)
    if (task.taskType === 'recurring' && task.isRecurring === true && !task.isRecurringPattern) return false;

    if (userRole === 'employee' && task.status === 'ONHOLD') {
      return false;
    }

    if (!['regular', 'recurring'].includes(task.taskType)) {
      return false;
    }

    return true;
  };

  const hasIncompleteSubtasks = (task) => {
    if (!task.subtasks || task.subtasks.length === 0) {
      return false;
    }
    return task.subtasks.some(subtask =>
      subtask.status !== 'DONE' && subtask.status !== 'CANCELLED'
    );
  };

  const hasIncomplete = hasIncompleteSubtasks(task);

  const isMilestoneTask = task?.taskType === 'milestone';
  const incompleteLinkedTasks = isMilestoneTask
    ? (task?.linkedTasks || []).filter(lt => lt.status !== 'DONE' && lt.status !== 'CANCELLED')
    : [];
  const hasIncompleteLinkedTasks = incompleteLinkedTasks.length > 0;

  const canMarkAsDone = isMilestoneTask
    ? !hasIncompleteLinkedTasks
    : (!hasIncomplete || isAdmin);
  const incompleteSubtasksCount = task.subtasks?.filter(st =>
    st.status !== 'DONE' && st.status !== 'CANCELLED'
  ).length || 0;

  const isTaskDone = task?.status === 'DONE';

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

            {(task?.status !== "CANCELLED" && task?.status !== "REJECTED" && task?.status !== "APPROVED")
              ? (isApproval ? (
                <>
                  {isApprovalCreator && (
                    <Button
                      variant="ghost"
                      className={`w-full text-left px-4 py-2 text-sm flex items-center gap-3 transition-colors justify-start h-auto rounded-none ${isTaskDone
                        ? 'cursor-not-allowed text-gray-400 bg-gray-50 opacity-60'
                        : task?.isRisk ? 'cursor-pointer text-emerald-600 hover:bg-emerald-50' : 'cursor-pointer text-gray-700 hover:bg-gray-50'
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
                        <CheckCircle size={16} className={isTaskDone ? 'text-gray-400' : 'text-emerald-600'} />
                      ) : (
                        <AlertTriangle size={16} className={isTaskDone ? 'text-gray-400' : 'text-gray-600'} />
                      )}
                      <span className="font-medium">{task?.isRisk ? 'Mark as Mitigate' : 'Mark as Risk'}</span>
                    </Button>
                  )}
                  {isApprovalApprover && (
                    <Button
                      variant="ghost"
                      className={`w-full text-left px-4 py-2 text-sm flex items-center gap-3 transition-colors justify-start h-auto rounded-none ${
                        isTaskDone
                          ? 'cursor-not-allowed text-gray-400 bg-gray-50 opacity-60'
                          : 'cursor-pointer text-red-600 hover:bg-red-50'
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
                      <XCircle size={16} className={isTaskDone ? 'text-gray-400' : 'text-red-600'} />
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
                        className={`w-full text-left px-4 py-2 text-sm flex items-center gap-3 transition-colors justify-start h-auto rounded-none ${isTaskDone
                          ? 'cursor-not-allowed text-gray-400 bg-gray-50 opacity-60'
                          : 'cursor-pointer text-gray-700 hover:bg-gray-50'
                          }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (task?.status === 'DONE') {
                            showErrorToast('Cannot create subtask: Task is already completed.');
                            return;
                          }
                          if (task?.isSubtask === true || task?.parentTaskId) {
                            showErrorToast('Nested subtasks are not allowed. Only 1 level of hierarchy is supported.');
                            return;
                          }
                          if (task?.taskType === 'approval' || task?.isApprovalTask === true) {
                            showErrorToast('Subtasks are not allowed for Approval tasks.');
                            return;
                          }
                          if (task?.taskType === 'quick' || task?.isQuickTask === true) {
                            showErrorToast('Subtasks are not allowed for Quick tasks.');
                            return;
                          }
                          if (!checkFeature('TASK_SUB')) {
                            setIsOpen(false);
                            setShowUpgradeModal(true);
                            return;
                          }
                          setIsOpen(false);
                          openSubtaskDrawer(task);
                        }}
                        disabled={isTaskDone}
                      >
                        <Plus size={16} className={isTaskDone ? 'text-gray-400' : 'text-gray-600'} />
                        <span className="font-medium">Create Sub-task</span>
                      </Button>

                      <Button
                        variant="ghost"
                        className="w-full text-left cursor-pointer px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors justify-start h-auto rounded-none"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsOpen(false);
                          if (!checkFeature('TASK_SUB')) {
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
                      className={`w-full text-left cursor-pointer px-4 py-2 text-sm flex items-center gap-3 transition-colors justify-start h-auto rounded-none ${task?.isRisk ? 'text-emerald-600 hover:bg-emerald-50' : 'text-gray-700 hover:bg-gray-50'}`}
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
                      <span className="font-medium">{task?.isRisk ? 'Mark as Mitigate' : 'Mark as Risk'}</span>
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
                      <span className="font-medium text-green-600">Mark as Done</span>
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
              ))
              : null}
          </div>,
          document.body
        )}

      {(showSnoozeModal || showMarkRiskModal || showMitigationModal || showMarkDoneModal || showDeleteModal || showCancelModal) &&
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
              <div className="modal-overlay task-modals-square">
                <style>{`
                  .modal-overlay {
                    position: fixed; inset: 0; z-index: 999999;
                    background: rgba(0,0,0,0.5);
                    display: flex; align-items: center; justify-content: center;
                  }
                  .modal-container {
                    background: white; border-radius: 8px;
                    width: 90%; max-width: 420px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                  }
                  .modal-header {
                    padding: 1.25rem 1.5rem; border-bottom: 1px solid #e5e7eb;
                    display: flex; align-items: center; justify-content: space-between;
                  }
                  .modal-header h4 { margin: 0; font-size: 1rem; font-weight: 600; }
                `}</style>
                <div className="modal-container">
                  <div className="modal-header">
                    <div className="flex items-center gap-2">
                      <XCircle size={20} className="text-red-500" />
                      <h4>Cancel Task</h4>
                    </div>
                    <button
                      className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100"
                      onClick={() => setShowCancelModal(false)}
                    >
                      <span className="text-lg text-white hover:text-blue-800">✕</span>
                    </button>
                  </div>
                  <div className="p-6">
                    <p className="text-sm text-gray-600 mb-4">
                      Are you sure you want to cancel this task? Please provide a reason.
                    </p>
                    <textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:border-transparent resize-none"
                      rows={3}
                      placeholder="Reason for cancellation..."
                    />
                    <div className="flex gap-3 mt-6">
                      <button
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!cancelReason.trim()}
                        onClick={() => {
                          onCancelApproval?.(cancelReason);
                          setShowCancelModal(false);
                          setCancelReason("");
                        }}
                      >
                        Confirm Cancel
                      </button>
                      <button
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
                        onClick={() => {
                          setShowCancelModal(false);
                          setCancelReason("");
                        }}
                      >
                        Go Back
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>,
          document.body
        )
      }

      <UpgradeRequiredModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        featureName="Subtask"
      />
    </div>
  );
}
