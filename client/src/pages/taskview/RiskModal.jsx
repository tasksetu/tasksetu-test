import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

function RiskModal({ task, onSubmit, onClose }) {
  const [riskData, setRiskData] = useState({
    note: task.riskNote || "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(riskData);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h4>Mark Task as At Risk: {task?.title}</h4>
          <Button variant="ghost" size="icon" className="close-button" onClick={onClose}>
            ×
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="modal-content">
          <div className="form-group">
            <label>Risk Note:</label>
            <textarea
              value={riskData.note}
              onChange={(e) =>
                setRiskData({ ...riskData, note: e.target.value })
              }
              placeholder="Describe the risks associated with this task"
              className="form-input"
              rows="4"
            />
          </div>

          <div className="modal-actions">
            <Button type="button" variant="outline" className="h-9" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="h-9">
              Mark as At Risk
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RiskModal;