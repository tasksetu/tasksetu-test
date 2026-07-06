import React, { createContext, useContext, useState, useRef, useCallback, useMemo, useEffect } from 'react';

const SubtaskContext = createContext();

export const useSubtask = () => {
  const context = useContext(SubtaskContext);
  if (!context) {
    throw new Error('useSubtask must be used within a SubtaskProvider');
  }
  return context;
};

export const SubtaskProvider = ({ children, onUpdateSubtask }) => {
  const [isSubtaskDrawerOpen, setIsSubtaskDrawerOpen] = useState(false);
  const [parentTask, setParentTask] = useState(null);
  const [editData, setEditData] = useState(null);
  const [mode, setMode] = useState('create'); // 'create' or 'edit'
  
  // Use ref to store callback without causing re-renders
  const refreshCallbackRef = useRef(null);

  const openSubtaskDrawer = useCallback((task, editSubtask = null, refreshFn = null) => {
    console.log('🚀 SubtaskContext: Opening subtask drawer with task:', {
      task,
      taskType: typeof task,
      taskId: task?.id,
      task_id: task?._id,
      editSubtask,
      hasRefreshFn: !!refreshFn
    });

    setParentTask(task);
    setEditData(editSubtask);
    setMode(editSubtask ? 'edit' : 'create');
    refreshCallbackRef.current = refreshFn; // Store in ref instead of state
    setIsSubtaskDrawerOpen(true);
  }, []);

  const closeSubtaskDrawer = useCallback(() => {
    setIsSubtaskDrawerOpen(false);
    setParentTask(null);
    setEditData(null);
    setMode('create');
    refreshCallbackRef.current = null;
  }, []);

  const handleSubtaskSubmit = useCallback((subtaskData) => {
    // This will be handled by individual components
    console.log('Subtask submitted:', subtaskData);
    closeSubtaskDrawer();
  }, [closeSubtaskDrawer]);

  // Close drawer on inactivity logout
  useEffect(() => {
    const handleAuthCleared = () => {
      closeSubtaskDrawer();
    };
    window.addEventListener('auth-cleared', handleAuthCleared);
    return () => window.removeEventListener('auth-cleared', handleAuthCleared);
  }, [closeSubtaskDrawer]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    isSubtaskDrawerOpen,
    parentTask,
    editData,
    mode,
    refreshCallback: refreshCallbackRef.current,
    openSubtaskDrawer,
    closeSubtaskDrawer,
    handleSubtaskSubmit,
    onUpdateSubtask,
  }), [
    isSubtaskDrawerOpen,
    parentTask,
    editData,
    mode,
    openSubtaskDrawer,
    closeSubtaskDrawer,
    handleSubtaskSubmit,
    onUpdateSubtask,
  ]);

  return (
    <SubtaskContext.Provider value={contextValue}>
      {children}
    </SubtaskContext.Provider>
  );
};