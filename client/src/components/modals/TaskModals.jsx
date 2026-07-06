import React, { useState, useEffect } from 'react';
import { X, Trash2, Users, Clock, AlertTriangle, CheckCircle, ChevronDown } from 'lucide-react';
import AssigneeSearchSelect from '../common/AssigneeSearchSelect';
import { Button } from '@/components/ui/button';

const TASK_MODAL_SQUARE_CSS = `
  .task-modals-square .modal-container,
  .task-modals-square .modal-header,
  .task-modals-square .modal-body,
  .task-modals-square .modal-actions,
  .task-modals-square .modal-icon,
  .task-modals-square .warning-section,
  .task-modals-square .success-section,
  .task-modals-square .subtask-item,
  .task-modals-square .form-input,
  .task-modals-square .form-select,
  .task-modals-square .form-textarea,
  .task-modals-square input,
  .task-modals-square select,
  .task-modals-square textarea,
  .task-modals-square button {
    border-radius: 0 !important;
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

  return (
    <div className="modal-overlay task-modals-square">
      <style>{TASK_MODAL_SQUARE_CSS}</style>
      <div className="modal-container">
        <div className="modal-header" style={{ background: '#ef4444' }}>
          <div className="modal-title-section">
            <div className="modal-icon">
              <Trash2 size={16} />
            </div>
            <div>
              <h3>Delete Task</h3>
              <p>Permanently remove this task</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="modal-close" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>

        <div className="p-[2rem]">
          <div className="delete-confirmation">
            {isTaskStatusBlocked ? (
              <>
                <div className="warning-section" style={{ borderColor: '#ef4444', backgroundColor: '#fef2f2' }}>
                  <div className="warning-icon">
                    <AlertTriangle size={16} />
                  </div>
                  <div>
                    <p className="warning-title" style={{ color: '#dc2626' }}>Cannot Delete Task</p>
                    <p>Task <strong>"{task?.title}"</strong> has status <strong>{taskStatus}</strong>.</p>
                    <p className="mt-1">Only tasks with status <strong>OPEN</strong>, <strong>ONHOLD</strong>, or <strong>CANCELLED</strong> can be deleted.</p>
                  </div>
                </div>
              </>
            ) : hasBlockerSubtasks ? (
              <>
                <div className="warning-section" style={{ borderColor: '#ef4444', backgroundColor: '#fef2f2' }}>
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
                            borderRadius: 0,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: st.status === 'INPROGRESS' ? '#dbeafe' : st.status === 'DONE' ? '#dcfce7' : '#f3f4f6',
                            color: st.status === 'INPROGRESS' ? '#1e40af' : st.status === 'DONE' ? '#166534' : '#374151',
                          }}>{st.status}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2">Please change these subtasks to <strong>ONHOLD</strong> or <strong>CANCELLED</strong> status before deleting this task.</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="confirmation-text">
                  Are you sure you want to delete this task?
                </p>
                <p className="task-name">"{task?.title}"</p>

                <div className="warning-section">
                  <div className="warning-icon">
                    <AlertTriangle size={16} />
                  </div>
                  <div>
                    <p className="warning-title">Important Notice:</p>
                    {subtasks.length > 0 && (
                      <p>This task has {subtasks.length} subtask(s). Deleting it will delete all subtasks.</p>
                    )}
                    <p>All linked forms and files will also be deleted.</p>
                    <p className="mt-2 font-semibold text-red-600">⚠️ This action is irreversible.</p>
                  </div>
                </div>
              </>
            )}
          </div>
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
                  <div className="inline-block animate-spin rounded-none h-4 w-4 border-b-2 border-white mr-2"></div>
                  Deleting...
                </>
              ) : (
                'Delete Task'
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
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
        <div className="modal-header" style={{ background: '#4f46e5' }}>
          <div className="modal-title-section">
            <div className="modal-icon">
              <Users size={16} />
            </div>
            <div>
              <h3>Reassign Task</h3>
              <p>Change task assignee</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="modal-close" onClick={onClose}>
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
  const [dateTimeValue, setDateTimeValue] = useState('');
  const [note, setNote] = useState('');

  if (!isOpen) return null;

  // 🕒 Get minimum date-time = current date or task due date (whichever is later)
  const now = new Date();
  const dueDate = task?.dueDate ? new Date(task.dueDate) : null;
  const minDateTime = dueDate && dueDate > now ? dueDate : now;

  // Convert to yyyy-MM-ddThh:mm format for input `min` attr
  const formattedMin = minDateTime.toISOString().slice(0, 16);

  const handleConfirm = () => {
    if (dateTimeValue) {
      // ✅ Convert datetime-local value to ISO string
      const snoozeUntil = new Date(dateTimeValue).toISOString();

      console.log('🕒 SnoozeTaskModal - Confirming snooze:', {
        dateTimeValue,
        snoozeUntil,
        note,
        parsedDate: new Date(dateTimeValue)
      });

      onConfirm({
        snoozeUntil: snoozeUntil, // API expects snoozeUntil field in ISO format
        reason: note || 'Task snoozed' // API expects reason field
      });
      onClose();
    }
  };

  return (
    <div className="modal-overlay task-modals-square">
      <style>{TASK_MODAL_SQUARE_CSS}</style>
      <div className="modal-container">
        {/* Header */}
        <div className="modal-header snooze-header">
          <div className="modal-title-section">
            <Clock size={24} />
            <h4>Snooze Task: {task?.title || 'Database Migration'}</h4>
          </div>
          <Button variant="ghost" size="icon" className="modal-close" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>

        {/* Body */}
        <div className="p-[2rem]">
          <div className="snooze-form">
            <div className="form-group">
              <label className="form-label">Snooze until:</label>
              <input
                type="datetime-local"
                min={formattedMin} // ✅ Minimum allowed date-time
                value={dateTimeValue}
                onChange={(e) => {
                  console.log('📅 DateTime input changed:', {
                    rawValue: e.target.value,
                    parsedDate: new Date(e.target.value),
                    isoString: new Date(e.target.value).toISOString()
                  });
                  setDateTimeValue(e.target.value);
                }}
                className="form-input"
                required
              />
              <small className="text-gray-500 text-xs">
                Minimum date/time: {new Date(formattedMin).toLocaleString()}
              </small>
            </div>

            <div className="form-group mt-3">
              <label className="form-label">Optional note:</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Reason for snoozing (optional)"
                className="form-textarea"
                rows="3"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="modal-actions flex justify-between">
          <Button variant="outline" className="h-8 rounded-none" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            className="h-8"
            onClick={handleConfirm}
            disabled={!dateTimeValue}
          >
            Snooze Task
          </Button>
        </div>
      </div>
    </div>
  );
}

// Mark as Risk Modal
export function MarkRiskModal({ isOpen, onClose, onConfirm, task }) {
  const [riskLevel, setRiskLevel] = useState('medium');
  const [riskReason, setRiskReason] = useState('');

  const riskLevels = [
    { value: 'low', label: 'Low', color: '#22C55E' },
    { value: 'medium', label: 'Medium', color: '#F59E0B' },
    { value: 'high', label: 'High', color: '#EF4444' },
    { value: 'critical', label: 'Critical', color: '#DC2626' }
  ];

  const getRiskLevelColor = (value) => {
    return riskLevels.find(level => level.value === value)?.color || '#F59E0B';
  };

  const handleConfirm = () => {
    if (!riskReason.trim()) {
      alert('Please enter a risk reason');
      return;
    }
    onConfirm({ riskLevel, riskReason });
    // Reset form
    setRiskLevel('medium');
    setRiskReason('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay task-modals-square">
      <style>{TASK_MODAL_SQUARE_CSS}</style>
      <div className="modal-container">
        <div className="modal-header risk-header">
          <div className="modal-title-section">
            <AlertTriangle size={24} />
            <h4>Mark Task as At Risk: {task?.title}</h4>
          </div>
          <Button variant="ghost" size="icon" className="modal-close" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>

        <div className="p-[2rem] overflow-hidden">
          <div className="risk-form space-y-0">
            {/* Risk Level Dropdown with Color Indicator */}
            <div className="form-grou">
              <label className="block text-sm font-medium text-gray-700">Risk Level:</label>
              <div className="flex items-center gap-2">
                <select
                  value={riskLevel}
                  onChange={(e) => setRiskLevel(e.target.value)}
                  className="flex-1 h-9 px-3 border border-gray-300 rounded-none shadow-sm focus:outline-none sm:text-sm"
                >
                  {riskLevels.map(level => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Risk Reason Textarea */}
            <div className="form-group">
              <label className="block text-sm font-medium text-gray-700">Risk Reason:</label>
              <textarea
                value={riskReason}
                onChange={(e) => setRiskReason(e.target.value)}
                placeholder="Describe the risks associated with this task"
                className="w-full px-3 py-2 border border-gray-300 shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm resize-none"
                rows="4"
                required
                style={{ borderRadius: '' }}
              />
            </div>
          </div>
        </div>

        <div className="modal-actions flex justify-between">
          <Button variant="outline" className="h-8" onClick={onClose}>Cancel</Button>
          <Button
            variant="warning"
            className="h-8"
            onClick={handleConfirm}
          >
            Mark as At Risk
          </Button>
        </div>
      </div>
    </div>
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
        <div className="modal-header mitigation-header bg-emerald-50 text-emerald-700 border-b border-emerald-100">
          <div className="modal-title-section flex items-center gap-2">
            <CheckCircle size={24} className="text-emerald-600" />
            <h4 className="text-lg font-semibold">Mark as Mitigated: {task?.title}</h4>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-none shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm resize-none"
                rows="4"
              />
            </div>
            <p className="text-xs text-gray-500 italic">
              * This will remove the "At Risk" flag from the task.
            </p>
          </div>
        </div>

        <div className="modal-actions flex justify-between px-6 py-4 bg-gray-50 border-t border-gray-100">
          <Button variant="outline" className="h-8" onClick={onClose}>Cancel</Button>
          <Button
            className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
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

  return (
    <div className="modal-overlay task-modals-square">
      <style>{TASK_MODAL_SQUARE_CSS}</style>
      <div className="modal-container">
        <div className="modal-header done-header">
          <div className="modal-title-section">
            <CheckCircle size={24} />
            <h4>Mark this task complete</h4>
          </div>
          <Button variant="ghost" size="icon" className="modal-close" onClick={onClose}>
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
                <CheckCircle size={20} className="success-icon" />
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
    </div>
  );
}