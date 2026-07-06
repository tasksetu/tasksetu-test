import React, { useState, useEffect } from 'react';
import { useTaskPriorities } from '@/hooks/useTaskPriorities';
import { Button } from '@/components/ui/button';
import CustomEditor from '@/components/common/CustomEditor';

function SubtaskModal({ isOpen, onClose, onSubmit, parentTask }) {
  const { data: taskPriorities = [] } = useTaskPriorities();

  const getDefaultPriority = () => {
    const defaultPriority = taskPriorities.find(p => p.isDefault);
    return defaultPriority?.code || 'low';
  };

  const [formData, setFormData] = useState({
    title: '',
    assignee: '',
    dueDate: '',
    priority: getDefaultPriority(),
    status: 'To Do',
    visibility: 'Private',
    description: ''
  });

  // Update default priority when it changes from API
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      priority: getDefaultPriority()
    }));
  }, [taskPriorities]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.title.trim()) {
      onSubmit(formData);
      // Reset form
      setFormData({
        title: '',
        assignee: '',
        dueDate: '',
        priority: getDefaultPriority(),
        status: 'To Do',
        visibility: 'Private',
        description: ''
      });
    }
  };

  const handleCancel = () => {
    setFormData({
      title: '',
      assignee: '',
      dueDate: '',
      priority: getDefaultPriority(),
      status: 'To Do',
      visibility: 'Private',
      description: ''
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content subtask-modal">
        <div className="modal-header">
          <div className="modal-title-section">
            <div className="modal-icon">📝</div>
            <div>
              <h3>Sub-task Details</h3>
              <p>+ Parent: #{parentTask?.id || 'Unknown'}</p>
            </div>
          </div>
          <div className="modal-actions">
            <Button variant="ghost" className="modal-action-btn h-9" onClick={handleCancel}>✖ Cancel</Button>
            <Button variant="ghost" size="icon" className="modal-action-btn" onClick={onClose}>✖</Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="subtask-form">
          <div className="form-row">
            <div className="form-group">
              <label>📝 Task Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Sub-task title (required)"
                required
                autoFocus
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group half">
              <label>🎯 Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="To Do">To Do</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div className="form-group half">
              <label>⚡ Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              >
                <option value="Low">Low Priority</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group half">
              <label>👤 Assignee</label>
              <select
                value={formData.assignee}
                onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
              >
                <option value="">Self</option>
              </select>
            </div>
            <div className="form-group half">
              <label>📅 Due Date</label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group half">
              <label>🔒 Visibility</label>
              <select
                value={formData.visibility}
                onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
              >
                <option value="Private">Private</option>
                <option value="Public">Public</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>📝 Description</label>
              <CustomEditor
                value={formData.description}
                onChange={(value) => setFormData({ ...formData, description: value })}
                placeholder="Add notes or description..."
              />
              <div className="form-hint">
                Use Tab to navigate fields, Enter to submit form
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>📎 Attachments (Optional)</label>
              <div className="attachment-area">
                <p>Drag & drop files here or <Button type="button" variant="ghost" className="browse-link p-0 h-auto">browse files</Button></p>
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <div className="task-info-section">
                <h4>📋 Task Information</h4>
                <div className="info-grid">
                  <div className="info-row">
                    <label>Inheritance Rules</label>
                    <div className="inheritance-info">
                      <p>Visibility: Inherits "Private" (can override)</p>
                      <p>Priority Impact: Changes due date automatically</p>
                      <p>Suggested Due: 2024-01-25</p>
                      <p>Max Length: Title 60 chars</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <Button type="button" variant="outline" className="h-9" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="h-9">
              💾 Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SubtaskModal;