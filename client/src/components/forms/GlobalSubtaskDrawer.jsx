import React from 'react';
import { useSubtask } from '../../contexts/SubtaskContext';
import SubtaskForm from './SubtaskForm';
import { useActiveRole } from '../RoleSwitcher';
import { canAssignToOthers } from '../../utils/taskPermissions';

const GlobalSubtaskDrawer = () => {
  const { isSubtaskDrawerOpen, parentTask, editData, mode, closeSubtaskDrawer, onUpdateSubtask, refreshCallback } = useSubtask();
  const { activeRole } = useActiveRole();

  // Determine if user can assign subtasks to others based on active role
  const isOrgUser = canAssignToOthers(activeRole || 'individual');

  console.log('🔍 GlobalSubtaskDrawer render:', {
    isSubtaskDrawerOpen,
    hasParentTask: !!parentTask,
    parentTaskType: typeof parentTask,
    parentTaskId: parentTask?.id,
    parentTask_id: parentTask?._id,
    parentTaskDocId: parentTask?._doc?._id,
    mode,
    editData,
    hasUpdateHandler: !!onUpdateSubtask,
    hasRefreshCallback: !!refreshCallback,
    activeRole,
    isOrgUser
  });

  if (!isSubtaskDrawerOpen || !parentTask) {
    return null;
  }

  return (
    <SubtaskForm
      key={editData?._id || editData?.id || 'create'}
      isOpen={isSubtaskDrawerOpen}
      onClose={closeSubtaskDrawer}
      parentTask={parentTask}
      editData={editData}
      mode={mode}
      onUpdateSubmit={onUpdateSubtask}
      refreshTask={refreshCallback}
      isOrgUser={isOrgUser}
    />
  );
};

export default GlobalSubtaskDrawer;