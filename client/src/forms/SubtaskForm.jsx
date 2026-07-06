import React, { useState, useEffect } from 'react';
import { X, Calendar, User, Tag, AlertCircle, Paperclip, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CustomEditor from '../common/CustomEditor';

function SubtaskForm({
  isOpen,
  onClose,
  onSubmit,
  parentTask,
  editData = null,
  mode = 'create' // 'create' or 'edit'
}) {
  const [formData, setFormData] = useState({
    title: '',
    assignee: '',
    dueDate: '',
    priority: 'Low Priority',
    status: 'To Do',
    visibility: 'Private',
    description: ''
  });

  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [attachmentSize, setAttachmentSize] = useState(0);

  // Populate form when editing
  useEffect(() => {
    if (editData && mode === 'edit') {
      setFormData({
        title: editData.title || '',
        assignee: editData.assignee || '',
        dueDate: editData.dueDate || '',
        priority: editData.priority || 'Low Priority',
        status: editData.status || 'To Do',
        visibility: editData.visibility || 'Private',
        description: editData.description || ''
      });
    }
  }, [editData, mode]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.title.trim()) {
      onSubmit(formData);
      handleCancel();
    }
  };

  const handleCancel = () => {
    setFormData({
      title: '',
      assignee: '',
      dueDate: '',
      priority: 'Low Priority',
      status: 'To Do',
      visibility: 'Private',
      description: ''
    });
    setUploadedFiles([]);
    setAttachmentSize(0);
    onClose();
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    
    files.forEach(file => {
      // Check file size (5MB total limit)
      if (attachmentSize + file.size > 5 * 1024 * 1024) {
        alert('File too large! Max 5MB total');
        return;
      }

      const fileObj = {
        id: `file-${Date.now()}-${Math.random()}`,
        name: file.name,
        size: file.size,
        file: file
      };

      setUploadedFiles(prev => [...prev, fileObj]);
      setAttachmentSize(prev => prev + file.size);
    });

    // Reset input
    e.target.value = '';
  };

  const removeFile = (fileId) => {
    const file = uploadedFiles.find(f => f.id === fileId);
    if (file) {
      setAttachmentSize(prev => prev - file.size);
      setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="drawer-overlay">
      <div className="drawer-container">
        <div className="drawer-content">
          {/* Header */}
          <div className="drawer-header">
            <div className="drawer-title-section">
              <div className="modal-icon">
                <Plus size={20} />
              </div>
              <div>
                <h3>{mode === 'edit' ? 'Edit Sub-task' : 'Add Sub-task'}</h3>
                <p>+ Parent: #{parentTask?.id || 'Unknown'}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="close-btn" onClick={onClose}>
              <X size={20} />
            </Button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="drawer-form">
            {/* Task Title */}
            <div className="form-group">
              <label className="form-label">
                <Tag size={16} />
                Task Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Sub-task title (required)"
                className="form-input"
                required
                autoFocus
              />
            </div>

            {/* Row 1: Assignee & Priority */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">
                  <User size={16} />
                  Assignee
                </label>
                <select
                  value={formData.assignee}
                  onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                  className="form-select"
                >
                  <option value="">Self</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">
                  <AlertCircle size={16} />
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="form-select"
                >
                  <option value="Low Priority">Low Priority</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            </div>

            {/* Row 2: Due Date & Status */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">
                  <Calendar size={16} />
                  Due Date
                </label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="form-select"
                >
                  <option value="To Do">To Do</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>

            {/* Visibility */}
            <div className="form-group">
              <label className="form-label">Visibility</label>
              <select
                value={formData.visibility}
                onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
                className="form-select"
              >
                <option value="Private">Private</option>
                <option value="Public">Public</option>
              </select>
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label">Description</label>
              <CustomEditor
                value={formData.description}
                onChange={(value) => setFormData({ ...formData, description: value })}
                placeholder="Add notes or description..."
              />
              <div className="form-hint">
                Use Tab to navigate fields, Enter to submit form
              </div>
            </div>

            {/* Attachments */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-900 mb-1">
                Attachments
                <span className="text-xs text-gray-500 ml-2">(Max 5MB total)</span>
              </label>
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
                onChange={handleFileUpload}
                className="h-9 w-full border rounded-md px-3 py-1 text-sm text-gray-700 file:h-6.5 file:px-3 hover:file:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                data-testid="input-attachments"
              />

              {/* File List */}
              {uploadedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {uploadedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between bg-gray-50 px-2 rounded">
                      <div className="flex items-center space-x-2">
                        <svg
                          className="w-4 h-4 text-gray-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <span className="text-sm text-gray-700">{file.name}</span>
                        <span className="text-xs text-gray-500">
                          ({formatFileSize(file.size)})
                        </span>
                      </div>
                      <Button
                        type="button"
                        onClick={() => removeFile(file.id)}
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700"
                        data-testid={`remove-file-${file.id}`}>
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </Button>
                    </div>
                  ))}
                  <div className="text-xs text-gray-500">
                    Total size: {formatFileSize(attachmentSize)} / 5MB
                  </div>
                </div>
              )}
            </div>

            {/* Inheritance Rules Info */}
            <div className="info-section">
              <h4>
                <AlertCircle size={16} />
                Inheritance Rules
              </h4>
              <div className="inheritance-info">
                <p>Visibility: Inherits "Private" (can override)</p>
                <p>Priority Impact: Changes due date automatically</p>
                <p>Suggested Due: 2024-01-25</p>
                <p>Max Length: Title 60 chars</p>
              </div>
            </div>

            {/* Actions */}
            <div className="form-actions flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" variant="gradient">
                {mode === 'edit' ? 'Update Sub-task' : 'Create Sub-task'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SubtaskForm;