import { useRole } from './useRole';

/**
 * Custom hook for getting role-based assignment options during task creation
 * Provides available assignment targets based on user role and permissions
 */
export const useAssignmentOptions = () => {
  const { role, roleLevel, hasOrganization, isAdmin, isManager } = useRole();

  // Get available assignment options based on role
  const getAssignmentOptions = () => {
    const options = [];

    // All roles can assign to themselves
    options.push({
      value: 'self',
      label: 'Assign to Myself',
      disabled: false,
      description: 'Create a personal task'
    });

    // Manager and Admin roles can assign to team members
    if (isManager || isAdmin) {
      options.push({
        value: 'team_member',
        label: 'Assign to Team Member',
        disabled: false,
        description: 'Assign task to a specific team member'
      });
    }

    // Admin roles can assign to any user in the organization
    if (isAdmin) {
      options.push({
        value: 'any_user',
        label: 'Assign to Any User',
        disabled: false,
        description: 'Assign task to any user in your organization'
      });

      options.push({
        value: 'multiple_users',
        label: 'Assign to Multiple Users',
        disabled: false,
        description: 'Create a task for multiple team members'
      });
    }

    return options;
  };

  // Get available task types based on role
  const getAvailableTaskTypes = () => {
    const taskTypes = [
      {
        id: 'regular',
        label: 'Regular Task',
        description: 'Standard one-time task',
        disabled: false,
        icon: 'FileText'
      }
    ];

    // Only Manager and Admin can create milestone and approval tasks
    if (isManager || isAdmin) {
      taskTypes.push({
        id: 'milestone',
        label: 'Milestone',
        description: 'Project checkpoint',
        disabled: false,
        icon: 'Target'
      });

      taskTypes.push({
        id: 'approval',
        label: 'Approval Task',
        description: 'Requires approval workflow',
        disabled: false,
        icon: 'ClipboardCheck'
      });
    }

    // All roles can create recurring tasks (personal productivity)
    taskTypes.push({
      id: 'recurring',
      label: 'Recurring Task',
      description: 'Repeats on schedule',
      disabled: false,
      icon: 'Clock'
    });

    return taskTypes;
  };

  // Get priority levels available to the role
  const getAvailablePriorities = () => {
    const priorities = [
      { value: 'low', label: 'Low', color: 'green' },
      { value: 'medium', label: 'Medium', color: 'yellow' },
      { value: 'high', label: 'High', color: 'orange' }
    ];

    // Manager and Admin can set critical priority
    if (isManager || isAdmin) {
      priorities.push({ value: 'critical', label: 'Critical', color: 'red' });
    }

    return priorities;
  };

  // Check if user can assign tasks to others
  const canAssignToOthers = () => {
    return isManager || isAdmin;
  };

  // Check if user can create specific task types
  const canCreateTaskType = (taskType) => {
    const restrictions = {
      regular: true, // All roles
      recurring: true, // All roles
      milestone: isManager || isAdmin, // Manager+ only
      approval: isManager || isAdmin, // Manager+ only
    };

    return restrictions[taskType] || false;
  };

  // Get role-specific task creation restrictions
  const getTaskCreationRestrictions = () => {
    return {
      // Employee restrictions
      employee: {
        canAssignToOthers: false,
        canCreateMilestones: false,
        canCreateApprovals: false,
        canSetCriticalPriority: false,
        maxTasksPerDay: null // No limit
      },
      
      // Manager restrictions
      manager: {
        canAssignToOthers: true,
        canCreateMilestones: true,
        canCreateApprovals: true,
        canSetCriticalPriority: true,
        maxTasksPerDay: null // No limit
      },
      
      // Admin restrictions (least restrictive)
      admin: {
        canAssignToOthers: true,
        canCreateMilestones: true,
        canCreateApprovals: true,
        canSetCriticalPriority: true,
        maxTasksPerDay: null // No limit
      }
    };
  };

  const currentRestrictions = getTaskCreationRestrictions()[role] || getTaskCreationRestrictions()['employee'];

  return {
    assignmentOptions: getAssignmentOptions(),
    availableTaskTypes: getAvailableTaskTypes(),
    availablePriorities: getAvailablePriorities(),
    canAssignToOthers: canAssignToOthers(),
    canCreateTaskType,
    restrictions: currentRestrictions,
    
    // Helper methods
    isTaskTypeAllowed: canCreateTaskType,
    getPriorityOptions: getAvailablePriorities,
    getAssigneeOptions: getAssignmentOptions
  };
};