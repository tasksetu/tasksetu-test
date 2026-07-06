import React from 'react';
import { useView } from '../../contexts/ViewContext';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import SafeHtml from '../common/SafeHtml';

const GlobalViewModal = () => {
  const { isViewModalOpen, viewTask, closeViewModal } = useView();
  const [, setLocation] = useLocation();

  if (!isViewModalOpen || !viewTask) {
    return null;
  }

  const handleViewFullTask = () => {
    closeViewModal();
    setLocation(`/tasks/${viewTask.id}`);
  };

  return (
    <div className="view-modal-overlay" onClick={closeViewModal}>
      <div className="view-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="view-modal-header">
          <div className="view-modal-title-section">
            <div className="view-modal-icon">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <div>
              <h3>Task Preview</h3>
              <p>Quick view of task details</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="view-modal-close-btn" onClick={closeViewModal}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        {/* Modal Content */}
        <div className="view-modal-content">
          <div className="task-preview-card">
            <div className="task-preview-header">
              <h2 className="task-preview-title">{viewTask.title}</h2>
              <div className="task-preview-meta">
                <span className={`task-status ${viewTask.status?.toLowerCase()}`}>
                  {viewTask.status}
                </span>
                <span className={`task-priority priority-${viewTask.priority?.toLowerCase()}`}>
                  {viewTask.priority}
                </span>
              </div>
            </div>

            <div className="task-preview-details">
              <div className="detail-row">
                <span className="detail-label">Assignee:</span>
                <span className="detail-value">{viewTask.assignee || 'Unassigned'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Due Date:</span>
                <span className="detail-value">{viewTask.dueDate || 'No due date'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Created By:</span>
                <span className="detail-value">{viewTask.createdBy || 'Unknown'}</span>
              </div>
              {viewTask.description && (
                <div className="detail-row description">
                  <span className="detail-label">Description:</span>
                  <SafeHtml html={viewTask.description} className="detail-description" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="view-modal-footer">
          <Button variant="outline" className="h-9" onClick={closeViewModal}>
            Close
          </Button>
          <Button variant="primary" className="h-9" onClick={handleViewFullTask}>
            View Full Details
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GlobalViewModal;