import React from 'react';
import { useSubtask } from '../../contexts/SubtaskContext';
import SubtaskForm from './SubtaskForm';
import { useActiveRole } from '../RoleSwitcher';
import { isOrgUserRole } from '../../utils/taskPermissions';

const GlobalSubtaskDrawer = () => {
  const { isSubtaskDrawerOpen, parentTask, editData, mode, closeSubtaskDrawer, onUpdateSubtask, refreshCallback } = useSubtask();
  const { activeRole } = useActiveRole();

  // Determine if user is an organization user based on active role
  const isOrgUser = isOrgUserRole(activeRole || 'individual');

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