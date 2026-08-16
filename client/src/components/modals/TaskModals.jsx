import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, Users, Clock, AlertTriangle, CheckCircle, ChevronDown } from 'lucide-react';
import AssigneeSearchSelect from '../common/AssigneeSearchSelect';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TASK_MODAL_SQUARE_CSS = `
  .task-modals-square .modal-container,
  .task-modals-square .modal-header,
  .task-modals-square .modal-body,
  .task-modals-square .modal-actions,
  .task-modals-square .modal-icon,
  .task-modals-square .warning-section,
  .task-modals-square .success-section,
  .task-modals-square .subtasks-list,
  .task-modals-square .subtask-item,
  .task-modals-square .subtask-status,
  .task-modals-square .form-input,
  .task-modals-square .form-select,
  .task-modals-square .form-textarea,
  .task-modals-square input,
  .task-modals-square select,
  .task-modals-square textarea,
  .task-modals-square button {
    border-radius: 0.125rem !important;
  }
  .task-modals-square .modal-header,
  .task-modals-square .done-header,
  .task-modals-square .delete-header,
  .task-modals-square .reassign-header,
  .task-modals-square .mitigation-header {
    background: transparent !important;
    background-color: transparent !important;
    color: #1f2937 !important;
    border-bottom: 1px solid #e5e7eb !important;
  }
  .task-modals-square .modal-actions {
    border-top: 1px solid #e5e7eb !important;
  }
  .task-modals-square .modal-header h3,
  .task-modals-square .modal-header h4,
  .task-modals-square .modal-header p {
    color: #1f2937 !important;
  }
  .task-modals-square .modal-header .modal-close {
    color: #6b7280 !important;
    background: transparent !important;
  }
  .task-modals-square .modal-header .modal-close:hover {
    background: #f3f4f6 !important;
    color: #111827 !important;
  }
`;

// Delete Modal
export function DeleteTaskModal({ isOpen, onClose, onConfirm, task }) {
  const [isDeleting, setIsDeleting] = useState(false);

  // Check if task has subtasks that block deletion
  const DELETABLE_STATUSES = ['OPEN', 'ONHOLD', 'CANCELLED'];
  const taskStatus = task?.status || '';
  const isTaskStatusBlocked = taskStatus && !DELETABLE_STATUSES.includes(taskStatus);

  const subtasks = task?.subtasks || [];
  const blockerSubtasks = subtasks.filter(
    (st) => !st.isDeleted && !['ONHOLD', 'CANCELLED'].includes(st.status)
  );
  const hasBlockerSubtasks = blockerSubtasks.length > 0;
  const canDelete = !isTaskStatusBlocked && !hasBlockerSubtasks;

  const handleConfirm = async () => {
    if (!isDeleting && canDelete) {
      setIsDeleting(true);
      try {
        await onConfirm();
        onClose();
      } catch (error) {
        console.error('Error in delete confirmation:', error);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay task-modals-square" style={{ zIndex: 999999 }}>
      <style>{TASK_MODAL_SQUARE_CSS}</style>
      <div className="modal-container">
        <div className="modal-header border-b border-gray-200 bg-transparent text-gray-800">
          <div className="modal-title-section">
            <div className="modal-icon text-red-600 bg-red-50">
              <Trash2 size={16} />
            </div>
            <div>
              <h3 className="text-gray-900 font-medium">Delete Task</h3>
              <p className="text-gray-500 text-xs">Permanently remove this task</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="modal-close text-gray-400 hover:text-gray-600" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>

        <div className="p-6">
          {cannotDelete ? (
            <div className="subtask-warning-box" style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '0.375rem',
              padding: '1rem',
            }}>
              <div className="flex items-start gap-3">
                <div className="warning-icon">
                  <AlertTriangle size={16} />
                </div>
                <div>
                  <p className="warning-title" style={{ color: '#dc2626' }}>Cannot Delete Task</p>
                  <p className="mb-2">The following subtask(s) are preventing deletion because their status is not ONHOLD or CANCELLED:</p>
                  <ul style={{ listStyle: 'disc', paddingLeft: '1.2rem', margin: '0.5rem 0' }}>
                    {blockerSubtasks.map((st, idx) => (
                      <li key={st._id || st.id || idx} style={{ color: '#991b1b', fontSize: '0.875rem' }}>
                        <strong>{st.title}</strong> — <span style={{
                          display: 'inline-block',
                          padding: '1px 8px',
                          borderRadius: '0.125rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: st.status === 'INPROGRESS' ? '#dbeafe' : st.status === 'DONE' ? '#dcfce7' : '#f3f4f6',
                          color: st.status === 'INPROGRESS' ? '#1e40af' : st.status === 'DONE' ? '#166534' : '#374151',
                        }}>{st.status}</span>
                      </li>
                    ))}
                  </ul>
                  <p style={{ color: '#b91c1c', fontSize: '0.8125rem', marginTop: '0.5rem', fontStyle: 'italic' }}>
                    Only open subtasks can be deleted. Please put these subtasks ON HOLD or CANCEL them first.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-gray-700">Are you sure you want to delete <strong className="text-gray-900">{task?.title}</strong>?</p>
              <div className="bg-red-50 border border-red-200 rounded-md p-3 text-xs text-red-700 space-y-1">
                {subtasksCount > 0 && (
                  <p>• {subtasksCount} subtask(s) will be deleted</p>
                )}
                <p>All linked forms and files will also be deleted.</p>
                <p className="mt-2 font-semibold text-red-600">⚠️ This action is irreversible.</p>
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions flex justify-between">
          <Button variant="outline" className="h-8" onClick={onClose}>Cancel</Button>
          {canDelete && (
            <Button
              variant="destructive"
              className="h-8"
              onClick={handleConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <span className="animate-spin mr-1">⏳</span>
                  Deleting...
                </>
              ) : (
                'Delete Task'
              )}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// Reassign Modal
export function ReassignTaskModal({ isOpen, onClose, onConfirm, task }) {
  const [selectedAssignee, setSelectedAssignee] = useState(null);

  useEffect(() => {
    // Prefill with current assignee if available
    if (task?.assigneeId) {
      setSelectedAssignee({ value: task.assigneeId, label: task.assignee });
    } else {
      setSelectedAssignee(null);
    }
  }, [task?.assigneeId, task?.assignee]);

  const handleConfirm = () => {
    if (selectedAssignee) {
      const assigneeObj = {
        assigneeId: selectedAssignee.value || selectedAssignee._id || selectedAssignee.id,
        assigneeName: selectedAssignee.label || selectedAssignee.name || `${selectedAssignee.firstName || ''} ${selectedAssignee.lastName || ''}`.trim()
      };
      onConfirm(assigneeObj);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay task-modals-square">
      <style>{TASK_MODAL_SQUARE_CSS}</style>
      <div className="modal-container">
        <div className="modal-header border-b border-gray-200 bg-transparent text-gray-800">
          <div className="modal-title-section">
            <div className="modal-icon text-indigo-600 bg-indigo-50">
              <Users size={16} />
            </div>
            <div>
              <h3 className="text-gray-900 font-medium">Reassign Task</h3>
              <p className="text-gray-500 text-xs">Change task assignee</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="modal-close text-gray-400 hover:text-gray-600" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>

        <div className="p-[2rem]">
          <div className="reassign-form">
            <label className="form-label">Select new assignee:</label>
            <div style={{ minWidth: 280 }}>
              <AssigneeSearchSelect
                value={selectedAssignee}
                onChange={(val) => setSelectedAssignee(val)}
                placeholder="Search assignees..."
                isClearable={true}
              />
            </div>
          </div>
        </div>

        <div className="modal-actions flex justify-between">
          <Button variant="outline" className="h-8" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            className="h-8"
            onClick={handleConfirm}
            disabled={!selectedAssignee}
          >
            Reassign Task
          </Button>
        </div>
      </div>
    </div>
  );
}

// Snooze Modal
export function SnoozeTaskModal({ isOpen, onClose, onConfirm, task }) {
  const [dateTimeValue, setDateTimeValue] = useState("");
  const [note, setNote] = useState("");

  if (!isOpen) return null;

  // 🕒 Get minimum date-time = current date or task due date (whichever is later)
  const now = new Date();
  const dueDate = task?.dueDate ? new Date(task.dueDate) : null;
  const minDateTime = dueDate && dueDate > now ? dueDate : now;

  const pad = (n) => String(n).padStart(2, "0");
  const formattedMin = `${minDateTime.getFullYear()}-${pad(minDateTime.getMonth() + 1)}-${pad(minDateTime.getDate())}T${pad(minDateTime.getHours())}:${pad(minDateTime.getMinutes())}`;

  const handleConfirm = () => {
    if (dateTimeValue) {
      // ✅ Convert datetime-local value to ISO string preserving exact input time
      let snoozeUntil;
      if (typeof dateTimeValue === "string" && dateTimeValue.includes("T")) {
        const [d, t] = dateTimeValue.split("T");
        const timeFull = t.length === 5 ? `${t}:00` : t;
        snoozeUntil = `${d}T${timeFull}.000Z`;
      } else {
        snoozeUntil = new Date(dateTimeValue).toISOString();
      }

      console.log("🕒 SnoozeTaskModal - Confirming snooze:", {
        dateTimeValue,
        snoozeUntil,
        note,
      });

      onConfirm({
        snoozeUntil: snoozeUntil, // API expects snoozeUntil field in ISO format
        reason: note || "Task snoozed", // API expects reason field
      });
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl w-full sm:max-w-xl p-0 overflow-hidden bg-white border border-gray-200 shadow-xl rounded-sm font-sans text-gray-800 flex flex-col gap-0">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-gray-100 bg-white space-y-1.5">
          <DialogTitle
            className="text-xl font-normal flex items-center gap-2.5"
            style={{ color: "#676a6c" }}
          >
            <Clock size={22} className="text-indigo-600 shrink-0" />
            <span>Snooze Task: {task?.title || "Database Migration"}</span>
          </DialogTitle>
          <p className="text-xs text-gray-500 font-normal">
            Temporarily hide this task from your list until the specified time.
          </p>
        </DialogHeader>

        {/* Body */}
        <div className="p-6 space-y-5 min-h-[280px] max-h-[80vh] overflow-y-auto">
          {/* Snooze Until */}
          <div className="space-y-2">
            <Label
              htmlFor="snoozeUntil"
              className="text-xs font-semibold text-gray-700 uppercase tracking-wider"
            >
              Snooze Until <span className="text-red-500">*</span>
            </Label>
            <Input
              id="snoozeUntil"
              type="datetime-local"
              min={formattedMin}
              value={dateTimeValue}
              onChange={(e) => setDateTimeValue(e.target.value)}
              className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 text-sm h-8"
              required
            />
            {formattedMin && (
              <p className="text-[11px] text-gray-500 mt-1">
                Minimum date/time: {formattedMin.replace("T", " ")}
              </p>
            )}
          </div>

          {/* Optional Note */}
          <div className="space-y-2">
            <Label
              htmlFor="snoozeNote"
              className="text-xs font-semibold text-gray-700 uppercase tracking-wider"
            >
              Optional Note
            </Label>
            <Textarea
              id="snoozeNote"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason for snoozing (optional)..."
              className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 text-sm resize-none"
              rows={4}
            />
          </div>
        </div>

        {/* Actions / Footer */}
        <DialogFooter className="p-4 px-6 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="bg-white border-gray-300 hover:bg-gray-50 text-gray-700 text-sm h-8 px-4 font-normal rounded-sm flex items-center justify-center text-center leading-none py-0"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!dateTimeValue}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm h-8 px-4 font-medium rounded-sm shadow-sm disabled:opacity-50 flex items-center justify-center text-center leading-none py-0"
          >
            Snooze Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Mark as Risk Modal
export function MarkRiskModal({ isOpen, onClose, onConfirm, task }) {
  const [riskLevel, setRiskLevel] = useState("medium");
  const [riskReason, setRiskReason] = useState("");
  const [error, setError] = useState("");

  const riskLevels = [
    { value: "low", label: "Low", color: "#22C55E" },
    { value: "medium", label: "Medium", color: "#F59E0B" },
    { value: "high", label: "High", color: "#EF4444" },
    { value: "critical", label: "Critical", color: "#DC2626" },
  ];

  const handleConfirm = () => {
    if (!riskReason.trim()) {
      setError("Please enter a risk reason");
      return;
    }
    setError("");
    onConfirm({ riskLevel, riskReason });
    setRiskLevel("medium");
    setRiskReason("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl w-full sm:max-w-xl p-0 overflow-hidden bg-white border border-gray-200 shadow-xl rounded-sm font-sans text-gray-800 flex flex-col gap-0">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-gray-100 bg-white space-y-1.5">
          <DialogTitle
            className="text-xl font-normal flex items-center gap-2.5"
            style={{ color: "#676a6c" }}
          >
            <AlertTriangle size={22} className="text-amber-500 shrink-0" />
            <span>Mark Task as At Risk: {task?.title}</span>
          </DialogTitle>
          <p className="text-xs text-gray-500 font-normal">
            Flag this task as at-risk and describe potential blockers or concerns.
          </p>
        </DialogHeader>

        {/* Body */}
        <div className="p-6 space-y-5 min-h-[280px] max-h-[80vh] overflow-y-auto">
          {/* Risk Level Dropdown */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Risk Level <span className="text-red-500">*</span>
            </Label>
            <Select value={riskLevel} onValueChange={(val) => setRiskLevel(val)}>
              <SelectTrigger className="w-full bg-white border-gray-300 text-gray-900 focus:border-amber-500 focus:ring-amber-500 text-sm h-8">
                <SelectValue placeholder="Select risk level" />
              </SelectTrigger>
              <SelectContent>
                {riskLevels.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: level.color }}
                      />
                      <span>{level.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Risk Reason Textarea */}
          <div className="space-y-2">
            <Label
              htmlFor="riskReason"
              className="text-xs font-semibold text-gray-700 uppercase tracking-wider"
            >
              Risk Reason <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="riskReason"
              value={riskReason}
              onChange={(e) => {
                setRiskReason(e.target.value);
                if (e.target.value.trim()) setError("");
              }}
              placeholder="Describe the risks associated with this task..."
              className={`bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:ring-amber-500 text-sm resize-none ${
                error ? "border-red-500 focus:border-red-500" : ""
              }`}
              rows={4}
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
        </div>

        {/* Actions / Footer */}
        <DialogFooter className="p-4 px-6 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="bg-white border-gray-300 hover:bg-gray-50 text-gray-700 text-sm h-8 px-4 font-normal rounded-sm flex items-center justify-center text-center leading-none py-0"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            className="bg-amber-500 hover:bg-amber-600 text-white text-sm h-8 px-4 font-medium rounded-sm shadow-sm disabled:opacity-50 flex items-center justify-center text-center leading-none py-0"
          >
            Mark as At Risk
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Mitigation Modal (Mark as Mitigated)
export function MitigationModal({ isOpen, onClose, onConfirm, task }) {
  const [mitigationReason, setMitigationReason] = useState('');

  const handleConfirm = () => {
    if (!mitigationReason.trim()) {
      alert('Please enter a mitigation reason');
      return;
    }
    onConfirm(mitigationReason);
    setMitigationReason('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay task-modals-square">
      <style>{TASK_MODAL_SQUARE_CSS}</style>
      <div className="modal-container">
        <div className="modal-header mitigation-header border-b border-gray-200 bg-transparent text-gray-800">
          <div className="modal-title-section flex items-center gap-2">
            <CheckCircle size={24} className="text-emerald-600 shrink-0" />
            <h4 className="text-lg font-medium text-gray-900">Mark as Mitigated: {task?.title}</h4>
          </div>
          <Button variant="ghost" size="icon" className="modal-close text-gray-400 hover:text-gray-600" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>

        <div className="p-[2rem] overflow-hidden">
          <div className="mitigation-form space-y-3">
            <div className="form-group">
              <label className="block text-sm font-medium text-gray-700 mb-2">Mitigation Reason / Resolution Note:</label>
              <textarea
                value={mitigationReason}
                onChange={(e) => setMitigationReason(e.target.value)}
                placeholder="How was this risk resolved or mitigated?"
                className="w-full px-3 py-2 border border-gray-300 rounded-sm shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm resize-none"
                rows="4"
              />
            </div>
            <p className="text-xs text-gray-500 italic">
              * This will remove the "At Risk" flag from the task.
            </p>
          </div>
        </div>

        <div className="modal-actions flex flex-col gap-2.5 p-5 bg-gray-50/50 border-t border-gray-100">
          <Button variant="outline" className="w-full h-10 bg-white border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-md" onClick={onClose}>Cancel</Button>
          <Button
            className="w-full h-10 bg-[#68d391] hover:bg-emerald-600 text-white font-medium rounded-md disabled:opacity-50"
            onClick={handleConfirm}
            disabled={!mitigationReason.trim()}
          >
            Mark as Mitigated
          </Button>
        </div>
      </div>
    </div>
  );
}

// Mark Done Modal
export function MarkDoneModal({ isOpen, onClose, onConfirm, task }) {
  // Get subtasks from task object (from backend API)
  const allSubtasks = task?.subtasks || [];

  // Filter incomplete and completed subtasks
  const incompleteSubtasks = allSubtasks.filter(st =>
    st.status && !['completed', 'done'].includes(st.status.toLowerCase())
  );
  const completedSubtasks = allSubtasks.filter(st =>
    st.status && ['completed', 'done'].includes(st.status.toLowerCase())
  );

  const hasIncompleteSubtasks = incompleteSubtasks.length > 0;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay task-modals-square" style={{ zIndex: 999999 }}>
      <style>{TASK_MODAL_SQUARE_CSS}</style>
      <div className="modal-container">
        <div className="modal-header done-header border-b border-gray-200 bg-transparent text-gray-800">
          <div className="modal-title-section flex items-center gap-2">
            <CheckCircle size={24} className="text-emerald-600 shrink-0" />
            <h4 className="text-lg font-medium text-gray-900">Mark this task complete</h4>
          </div>
          <Button variant="ghost" size="icon" className="modal-close text-gray-400 hover:text-gray-600" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>

        <div className="p-[2rem]">
          {hasIncompleteSubtasks ? (
            <div className="incomplete-subtasks">
              <div className="warning-section">
                <AlertTriangle size={20} className="warning-icon" />
                <p>This task has {incompleteSubtasks.length} incomplete subtask(s):</p>
              </div>

              <div className="subtasks-list">
                {incompleteSubtasks.map(subtask => (
                  <div key={subtask._id || subtask.id} className="subtask-item incomplete">
                    <span className="subtask-status">{subtask.status}</span>
                    <span className="subtask-title">{subtask.title}</span>
                  </div>
                ))}
              </div>

              <p className="completion-note text-red-600 font-medium">
                You must complete all subtasks before you can mark this task as done.
              </p>
            </div>
          ) : (
            <div className="all-subtasks-complete">
              <div className="success-section">
                <CheckCircle size={20} className="success-icon text-emerald-600 shrink-0" />
                <p>{completedSubtasks.length > 0 ? 'All subtasks have been completed:' : 'No subtasks for this task.'}</p>
              </div>

              {completedSubtasks.length > 0 && (
                <div className="subtasks-list">
                  {completedSubtasks.map(subtask => (
                    <div key={subtask._id || subtask.id} className="subtask-item completed">
                      <CheckCircle size={16} className="check-icon" />
                      <span className="subtask-title">{subtask.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-actions flex justify-between">
          <Button variant="outline" className="h-8" onClick={onClose}>Cancel</Button>
          <Button
            variant="success"
            className="h-8"
            onClick={handleConfirm}
            disabled={hasIncompleteSubtasks}
            style={{ opacity: hasIncompleteSubtasks ? 0.5 : 1, cursor: hasIncompleteSubtasks ? 'not-allowed' : 'pointer' }}
          >
            Complete
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}