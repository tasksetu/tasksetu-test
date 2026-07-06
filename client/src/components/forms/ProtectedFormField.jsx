import React from 'react';
import { usePermissions } from '@/features/shared/hooks/usePermissions';
import { PERMISSIONS } from '@/features/shared/services/rbacService';

/**
 * Protected Form Field Component
 * Automatically handles visibility and assignment fields based on user permissions
 */
export const ProtectedFormField = ({ 
  children, 
  permission,
  roleLevel,
  hideOnNoAccess = false,
  disableOnNoAccess = true,
  fallbackComponent = null 
}) => {
  const { hasPermission, hasRoleLevel } = usePermissions();
  
  let hasAccess = true;
  
  if (permission) {
    hasAccess = hasPermission(permission);
  }
  
  if (roleLevel && hasAccess) {
    hasAccess = hasRoleLevel(roleLevel);
  }
  
  // Hide field completely if no access and hideOnNoAccess is true
  if (!hasAccess && hideOnNoAccess) {
    return fallbackComponent;
  }
  
  // Return disabled version if no access
  if (!hasAccess && disableOnNoAccess) {
    return React.cloneElement(children, { 
      disabled: true,
      className: `${children.props.className || ''} opacity-50 cursor-not-allowed pointer-events-none`.trim(),
      title: "You don't have permission to modify this field"
    });
  }
  
  return children;
};

/**
 * Assignment Field Guard
 * Controls access to assignment/assignedTo fields
 */
export const AssignmentFieldGuard = ({ children, assignmentOptions = [] }) => {
  const { fields } = usePermissions();
  
  // If user can't assign to others, filter options to only include self
  const filteredOptions = fields.canAssignToOthers 
    ? assignmentOptions 
    : assignmentOptions.filter(option => option.value === 'self');
  
  // Clone children and pass filtered options
  return React.cloneElement(children, {
    options: filteredOptions,
    disabled: !fields.canAssignToOthers && filteredOptions.length === 0
  });
};

/**
 * Visibility Field Guard  
 * Controls access to visibility/privacy settings
 */
export const VisibilityFieldGuard = ({ children, defaultValue = 'private' }) => {
  const { fields } = usePermissions();
  
  if (!fields.canManageVisibility) {
    // If user can't manage visibility, hide the field and use default
    return (
      <input type="hidden" name="visibility" value={defaultValue} />
    );
  }
  
  return children;
};

/**
 * Priority Field Guard
 * Restricts critical priority based on role
 */
export const PriorityFieldGuard = ({ children, priorityOptions = [] }) => {
  const { fields } = usePermissions();
  
  // Filter out critical priority if user doesn't have permission
  const filteredOptions = fields.canSetCriticalPriority 
    ? priorityOptions 
    : priorityOptions.filter(option => option.value !== 'Critical' && option.value !== 'critical');
  
  return React.cloneElement(children, {
    options: filteredOptions
  });
};

/**
 * Advanced Features Guard
 * Controls access to advanced task features like milestones, approvals
 */
export const AdvancedFeaturesGuard = ({ children, feature }) => {
  const { fields } = usePermissions();
  
  let hasAccess = true;
  
  switch (feature) {
    case 'milestones':
      hasAccess = fields.canCreateMilestones;
      break;
    case 'approvals':
      hasAccess = fields.canCreateApprovals;
      break;
    default:
      hasAccess = true;
  }
  
  if (!hasAccess) {
    return null;
  }
  
  return children;
};

/**
 * Team Management Guard
 * Controls access to team-related features
 */
export const TeamManagementGuard = ({ children }) => {
  const { task } = usePermissions();
  
  if (!task.canManageTeamTasks) {
    return null;
  }
  
  return children;
};

export default ProtectedFormField;