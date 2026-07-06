import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

function AssigneeSelector({ assignee, assigneeId, onChange, canEdit }) {
  const [isOpen, setIsOpen] = useState(false);

  const teamMembers = []; // Empty for production - fetch from API

  const currentAssignee =
    teamMembers.find((m) => m.id === assigneeId) || teamMembers[0];

  if (!canEdit) {
    return (
      <div className="assignee-display readonly">
        <span className="assignee-avatar">{currentAssignee.avatar}</span>
        <span className="assignee-name">{assignee}</span>
        <span className="readonly-indicator">🔒</span>
      </div>
    );
  }

  return (
    <div className="assignee-selector">
      <Button variant="ghost" className="assignee-button" onClick={() => setIsOpen(!isOpen)}>
        <span className="assignee-avatar">{currentAssignee.avatar}</span>
        <span className="assignee-name">{assignee}</span>
        <span className="dropdown-arrow">▼</span>
      </Button>

      {isOpen && (
        <div className="assignee-options">
          {teamMembers.map((member) => (
            <Button
              key={member.id}
              variant="ghost"
              className={`assignee-option ${member.id === assigneeId ? "selected" : ""
                }`}
              onClick={() => {
                onChange(member);
                setIsOpen(false);
              }}
            >
              <span className="assignee-avatar">{member.avatar}</span>
              <span className="assignee-name">{member.name}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export default AssigneeSelector;