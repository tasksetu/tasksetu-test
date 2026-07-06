// Export shared hooks that can be used across different features

// Re-export existing hooks
export { default as useToast } from '../../hooks/use-toast';
export { default as useMobile } from '../../hooks/use-mobile';
export { default as useTasks } from '../../hooks/useTasks';
export { default as useUsers } from '../../hooks/useUsers';
export { default as useProjects } from '../../hooks/useProjects';

// New shared hooks for feature architecture
export { useAuth } from './useAuth';
export { useRole } from './useRole';
export { useFeaturePermissions } from './useFeaturePermissions';