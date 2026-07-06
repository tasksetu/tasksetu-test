// Export shared UI components that can be used across different features

// Re-export existing UI components
export { default as UserAvatar } from '../../components/profile/UserAvatar';
export { default as TaskCard } from '../../components/tasks/TaskCard';

// Layout components
export { default as Sidebar } from '../../layout/sidebar/Sidebar';
export { default as SidebarItem } from '../../layout/sidebar/SidebarItem';
export { default as UserContextSidebar } from '../../layout/sidebar/UserContextSidebar';

// Auth components
export { default as ProtectedRoute } from '../../components/ProtectedRoute';
export { default as AuthWrapper } from '../../components/AuthWrapper';
export { default as RoleBasedRedirect } from '../../components/RoleBasedRedirect';

// Modals and dialogs
export { default as InviteUsersModal } from '../../components/InviteUsersModal';
export { default as TaskCreationModal } from '../../components/TaskCreationModal';
export { default as LockoutModal } from '../../components/LockoutModal';