import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

const useQuickTasksStore = create(
  devtools(
    (set, get) => ({
      // State
      quickTasks: [],
      loading: false,
      error: null,
      selectedTasks: [],
      filters: {
        search: '',
        status: 'all',
        priority: 'all',
        sortBy: 'createdAt'
      },

      // Actions
      setQuickTasks: (tasks) =>
        set(
          { quickTasks: tasks },
          false,
          'setQuickTasks'
        ),

      setLoading: (loading) =>
        set(
          { loading },
          false,
          'setLoading'
        ),

      setError: (error) =>
        set(
          { error },
          false,
          'setError'
        ),

      addQuickTask: (task) =>
        set(
          (state) => ({
            quickTasks: [task, ...state.quickTasks]
          }),
          false,
          'addQuickTask'
        ),

      updateQuickTask: (taskId, updates) =>
        set(
          (state) => ({
            quickTasks: state.quickTasks.map(task =>
              task.id === taskId
                ? { ...task, ...updates, updatedAt: new Date().toISOString() }
                : task
            )
          }),
          false,
          'updateQuickTask'
        ),

      deleteQuickTask: (taskId) =>
        set(
          (state) => ({
            quickTasks: state.quickTasks.filter(task => task.id !== taskId),
            selectedTasks: state.selectedTasks.filter(id => id !== taskId)
          }),
          false,
          'deleteQuickTask'
        ),

      toggleTaskStatus: (taskId) =>
        set(
          (state) => ({
            quickTasks: state.quickTasks.map(task =>
              task.id === taskId
                ? {
                    ...task,
                    status: task.status === 'done' ? 'open' : 'done',
                    completedAt: task.status === 'open' ? new Date().toISOString() : null,
                    updatedAt: new Date().toISOString()
                  }
                : task
            )
          }),
          false,
          'toggleTaskStatus'
        ),

      setSelectedTasks: (taskIds) =>
        set(
          { selectedTasks: taskIds },
          false,
          'setSelectedTasks'
        ),

      toggleTaskSelection: (taskId) =>
        set(
          (state) => ({
            selectedTasks: state.selectedTasks.includes(taskId)
              ? state.selectedTasks.filter(id => id !== taskId)
              : [...state.selectedTasks, taskId]
          }),
          false,
          'toggleTaskSelection'
        ),

      clearSelection: () =>
        set(
          { selectedTasks: [] },
          false,
          'clearSelection'
        ),

      setFilters: (filters) =>
        set(
          (state) => ({
            filters: { ...state.filters, ...filters }
          }),
          false,
          'setFilters'
        ),

      clearFilters: () =>
        set(
          {
            filters: {
              search: '',
              status: 'all',
              priority: 'all',
              sortBy: 'createdAt'
            }
          },
          false,
          'clearFilters'
        ),

      // Bulk operations
      bulkUpdateStatus: (taskIds, status) =>
        set(
          (state) => ({
            quickTasks: state.quickTasks.map(task =>
              taskIds.includes(task.id)
                ? {
                    ...task,
                    status,
                    completedAt: status === 'done' ? new Date().toISOString() : null,
                    updatedAt: new Date().toISOString()
                  }
                : task
            )
          }),
          false,
          'bulkUpdateStatus'
        ),

      bulkDelete: (taskIds) =>
        set(
          (state) => ({
            quickTasks: state.quickTasks.filter(task => !taskIds.includes(task.id)),
            selectedTasks: state.selectedTasks.filter(id => !taskIds.includes(id))
          }),
          false,
          'bulkDelete'
        ),

      // Computed getters
      getFilteredTasks: () => {
        const { quickTasks, filters } = get();
        
        return quickTasks.filter(task => {
          const matchesSearch = !filters.search ||
            task.title.toLowerCase().includes(filters.search.toLowerCase());

          const matchesStatus = filters.status === 'all' || task.status === filters.status;

          const matchesPriority = filters.priority === 'all' || task.priority === filters.priority;

          return matchesSearch && matchesStatus && matchesPriority;
        }).sort((a, b) => {
          switch (filters.sortBy) {
            case 'createdAt':
              return new Date(b.createdAt) - new Date(a.createdAt);
            case 'title':
              return a.title.localeCompare(b.title);
            case 'priority':
              const priorityOrder = { high: 3, medium: 2, low: 1 };
              return priorityOrder[b.priority] - priorityOrder[a.priority];
            case 'dueDate':
              if (!a.dueDate && !b.dueDate) return 0;
              if (!a.dueDate) return 1;
              if (!b.dueDate) return -1;
              return new Date(a.dueDate) - new Date(b.dueDate);
            default:
              return 0;
          }
        });
      },

      getTaskStats: () => {
        const { quickTasks } = get();
        
        return {
          total: quickTasks.length,
          completed: quickTasks.filter(t => t.status === 'done').length,
          pending: quickTasks.filter(t => t.status === 'open').length,
          archived: quickTasks.filter(t => t.status === 'archived').length,
          highPriority: quickTasks.filter(t => t.priority === 'high' && t.status !== 'done').length,
          overdue: quickTasks.filter(t => {
            if (!t.dueDate || t.status === 'done') return false;
            return new Date(t.dueDate) < new Date();
          }).length
        };
      },

      // Reset store
      reset: () =>
        set(
          {
            quickTasks: [],
            loading: false,
            error: null,
            selectedTasks: [],
            filters: {
              search: '',
              status: 'all',
              priority: 'all',
              sortBy: 'createdAt'
            }
          },
          false,
          'reset'
        )
    }),
    {
      name: 'quick-tasks-store',
      enabled: process.env.NODE_ENV === 'development'
    }
  )
);

export default useQuickTasksStore;