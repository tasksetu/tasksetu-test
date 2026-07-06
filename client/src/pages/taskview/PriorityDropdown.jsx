import React, { useState } from 'react';
import { useTaskPriorities } from "@/hooks/useTaskPriorities";
import { getPriorityOptions, getPriorityColor } from "@/utils/priorityUtils";

function PriorityDropdown({ priority, onChange, canEdit }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const { data: taskPriorities = [] } = useTaskPriorities();
  const priorityOptions = getPriorityOptions(taskPriorities);
  
  // Map to include colors for each priority
  const priorities = priorityOptions.map(p => ({
    ...p,
    color: getPriorityColor(p.value, taskPriorities)
  }));

  if (!canEdit) {
    return (
      <div className="priority-display readonly">
        <span className={`priority-badge ${priority}`}>{priority}</span>
        <span className="readonly-indicator">🔒</span>
      </div>
    );
  }

  return (
    <div className="priority-dropdown">
      <button
        className={`priority-button ${priority}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {priority}
        <span className="dropdown-arrow">▼</span>
      </button>

      {isOpen && (
        <div className="priority-options">
          {priorities.map((priorityOption) => (
            <button
              key={priorityOption.value}
              className={`priority-option ${
                priorityOption.value === priority ? "selected" : ""
              }`}
              onClick={() => {
                onChange(priorityOption.value);
                setIsOpen(false);
              }}
            >
              {priorityOption.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default PriorityDropdown;