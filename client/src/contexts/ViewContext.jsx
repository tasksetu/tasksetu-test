import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';

const ViewContext = createContext();

export const useView = () => {
  const context = useContext(ViewContext);
  if (!context) {
    throw new Error('useView must be used within a ViewProvider');
  }
  return context;
};

export const ViewProvider = ({ children }) => {
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewTask, setViewTask] = useState(null);

  const openViewModal = useCallback((task) => {
    setViewTask(task);
    setIsViewModalOpen(true);
  }, []);

  const closeViewModal = useCallback(() => {
    setIsViewModalOpen(false);
    setViewTask(null);
  }, []);

  // Close modal on inactivity logout
  useEffect(() => {
    const handleAuthCleared = () => {
      closeViewModal();
    };
    window.addEventListener('auth-cleared', handleAuthCleared);
    return () => window.removeEventListener('auth-cleared', handleAuthCleared);
  }, [closeViewModal]);

  const value = useMemo(
    () => ({
      isViewModalOpen,
      viewTask,
      openViewModal,
      closeViewModal,
    }),
    [isViewModalOpen, viewTask, openViewModal, closeViewModal]
  );

  return (
    <ViewContext.Provider value={value}>
      {children}
    </ViewContext.Provider>
  );
};