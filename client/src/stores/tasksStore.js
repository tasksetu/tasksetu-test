import { create } from "zustand";

const createNotification = (type, taskId, taskTitle, options = {}) => ({
  id: Date.now() + Math.random(),
  type,
  taskId,
  taskTitle,
  message: options.message || `Notification for task "${taskTitle}"`,
  timestamp: new Date().toISOString(),
  read: false,
  ...options,
});

const scheduleReminder = (task, type, daysBefore) => {
  const dueDate = new Date(task.dueDate);
  const reminderDate = new Date(
    dueDate.setDate(dueDate.getDate() - daysBefore),
  );
  const message = `Reminder: Task "${task.title}" due in ${daysBefore} days`;

  return {
    id: Date.now() + Math.random(),
    taskId: task.id,
    type,
    scheduledFor: reminderDate.toISOString(),
    message,
    active: true,
  };
};

const useTasksStore = create((set, get) => ({
  // Notifications and reminders
  notifications: [],
  reminders: [],
  notificationSettings: {
    taskAssignment: true,
    dueDateReminders: true,
    overdueReminders: true,
    commentMentions: true,
    statusChanges: true,
    customReminders: true,
    snoozeWakeup: true,
    reminderDays: [3, 1], // Days before due date
    deliveryMethod: "both", // 'app', 'email', 'both'
    quietHours: { enabled: false, start: "22:00", end: "08:00" },
    doNotDisturb: false,
  },

  quickTasks: [],
  quickTaskSettings: {
    autoArchiveDays: 7, // Configurable archival period
  },
  tasks: [],
  selectedTasks: [],
  snoozedTasks: new Set(),
  riskyTasks: new Set(),
  expandedTasks: new Set(),
  // Auto-archive completed quick tasks after configurable days
  archiveCompletedQuickTasks: () => {
    const state = get();
    const archiveDays = state.quickTaskSettings.autoArchiveDays;
    const archiveThreshold = new Date();
    archiveThreshold.setDate(archiveThreshold.getDate() - archiveDays);

    set((currentState) => ({
      quickTasks: currentState.quickTasks.map((task) => {
        if (
          task.status === "Done" &&
          new Date(task.updatedAt || task.createdAt) < archiveThreshold
        ) {
          return { ...task, status: "Archived" };
        }
        return task;
      }),
    }));
  },

  // Actions
  addTask: (task) => {
    // Default color based on task type
    const getDefaultColor = (type) => {
      switch (type) {
        case "regular":
          return "#3B82F6";
        case "recurring":
          return "#10B981";
        case "milestone":
          return "#8B5CF6";
        case "approval":
          return "#F59E0B";
        default:
          return "#6B7280";
      }
    };

    set((state) => ({
      tasks: [
        ...state.tasks,
        {
          id: task.id || Date.now(),
          ...task,
          createdAt: new Date().toISOString(),
          subtasks: task.subtasks || [],
          // Milestone specific fields
          isMilestone: task.isMilestone || false,
          milestoneType: task.milestoneType || "standalone",
          linkedTasks: task.linkedTasks || [],
          progress: task.progress || 0,
        },
      ],
    }));
  },

  updateTask: (id, updates) => {
    set((state) => {
      const task = state.tasks.find((t) => t.id === id);
      if (!task) return state;

      const notifications = [];

      // Status change notification
      if (
        updates.status &&
        updates.status !== task.status &&
        state.notificationSettings.statusChanges
      ) {
        notifications.push(
          createNotification("status_change", id, task.title, {
            message: `Task "${task.title}" status changed from ${task.status} to ${updates.status}`,
            oldStatus: task.status,
            newStatus: updates.status,
            priority: task.priority || "medium",
          }),
        );
      }

      // Priority change notification
      if (updates.priority && updates.priority !== task.priority) {
        notifications.push(
          createNotification("priority_change", id, task.title, {
            message: `Task "${task.title}" priority changed from ${task.priority} to ${updates.priority}`,
            oldPriority: task.priority,
            newPriority: updates.priority,
            priority: updates.priority,
          }),
        );
      }

      // Assignment change notification
      if (
        updates.assigneeId &&
        updates.assigneeId !== task.assigneeId &&
        state.notificationSettings.taskAssignment
      ) {
        notifications.push(
          createNotification("assignment", id, task.title, {
            message: `Task "${task.title}" has been reassigned to you`,
            assigneeId: updates.assigneeId,
            priority: task.priority || "medium",
          }),
        );
      }

      return {
        tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        notifications: [...state.notifications, ...notifications],
      };
    });
  },

  deleteTask: (taskId) =>
    set((state) => ({
      tasks: state.tasks.filter((task) => task.id !== taskId),
      selectedTasks: state.selectedTasks.filter((id) => id !== taskId),
    })),

  addSubtask: (parentTaskId, subtaskData) => {
    set((state) => {
      const parentTask = state.tasks.find((task) => task.id === parentTaskId);

      // Validate due date against parent task
      if (subtaskData.dueDate && parentTask?.dueDate) {
        if (subtaskData.dueDate > parentTask.dueDate) {
          throw new Error(
            "Subtask due date must be on or before the parent task due date.",
          );
        }
      }

      return {
        tasks: state.tasks.map((task) => {
          if (task.id === parentTaskId) {
            const newSubtask = {
              id: Date.now() + Math.random(),
              createdAt: new Date().toISOString(),
              createdBy: "Current User",
              progress: 0,
              ...subtaskData,
            };

            return {
              ...task,
              subtasks: [...(task.subtasks || []), newSubtask],
              subtaskCount: (task.subtaskCount || 0) + 1,
            };
          }
          return task;
        }),
      };
    });
  },

  updateSubtask: (parentTaskId, subtaskId, updates) => {
    set((state) => {
      const parentTask = state.tasks.find((task) => task.id === parentTaskId);

      // Validate due date if being updated
      if (updates.dueDate && parentTask?.dueDate) {
        if (updates.dueDate > parentTask.dueDate) {
          throw new Error(
            "Subtask due date must be on or before the parent task due date.",
          );
        }
      }

      return {
        tasks: state.tasks.map((task) => {
          if (task.id === parentTaskId && task.subtasks) {
            return {
              ...task,
              subtasks: task.subtasks.map((subtask) =>
                subtask.id === subtaskId
                  ? {
                      ...subtask,
                      ...updates,
                      progress:
                        updates.status === "DONE" ? 100 : subtask.progress,
                    }
                  : subtask,
              ),
            };
          }
          return task;
        }),
      };
    });
  },

  deleteSubtask: (parentTaskId, subtaskId) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === parentTaskId
          ? {
              ...task,
              subtasks: task.subtasks.filter(
                (subtask) => subtask.id !== subtaskId,
              ),
              subtaskCount: Math.max(0, (task.subtaskCount || 0) - 1),
            }
          : task,
      ),
    })),

  // Selection management
  setSelectedTasks: (taskIds) => set({ selectedTasks: taskIds }),

  toggleTaskSelection: (taskId) =>
    set((state) => ({
      selectedTasks: state.selectedTasks.includes(taskId)
        ? state.selectedTasks.filter((id) => id !== taskId)
        : [...state.selectedTasks, taskId],
    })),

  // Bulk operations
  bulkUpdateStatus: (taskIds, newStatus) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        taskIds.includes(task.id)
          ? {
              ...task,
              status: newStatus,
              progress: newStatus === "DONE" ? 100 : task.progress,
            }
          : task,
      ),
    })),

  bulkDeleteTasks: (taskIds) =>
    set((state) => ({
      tasks: state.tasks.filter((task) => !taskIds.includes(task.id)),
      selectedTasks: [],
    })),

  // Task state management
  toggleTaskExpansion: (taskId) =>
    set((state) => {
      const newExpanded = new Set(state.expandedTasks);
      if (newExpanded.has(taskId)) {
        newExpanded.delete(taskId);
      } else {
        newExpanded.add(taskId);
      }
      return { expandedTasks: newExpanded };
    }),

    clearExpandedTasks: () =>
  set({ expandedTasks: new Set() }),

  toggleSnoozeTask: (taskId) =>
    set((state) => {
      const newSnoozed = new Set(state.snoozedTasks);
      if (newSnoozed.has(taskId)) {
        newSnoozed.delete(taskId);
      } else {
        newSnoozed.add(taskId);
      }
      return { snoozedTasks: newSnoozed };
    }),

  toggleRiskyTask: (taskId) =>
    set((state) => {
      const newRisky = new Set(state.riskyTasks);
      if (newRisky.has(taskId)) {
        newRisky.delete(taskId);
      } else {
        newRisky.add(taskId);
      }
      return { riskyTasks: newRisky };
    }),

  // Status management
  updateTaskStatus: (taskId, newStatus) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: newStatus,
              progress: newStatus === "DONE" ? 100 : task.progress,
              lastModified: new Date().toISOString(),
              lastModifiedBy: "Current User",
            }
          : task,
      ),
    })),

  // Notification management
  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
    })),

  markNotificationRead: (notificationId) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n,
      ),
    })),

  markAllNotificationsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),

  deleteNotification: (notificationId) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== notificationId),
    })),

  // Reminder management
  addReminder: (reminder) =>
    set((state) => ({
      reminders: [...state.reminders, reminder],
    })),

  snoozeTask: (taskId, snoozeUntil, note = "") => {
    set((state) => {
      const task = state.tasks.find((t) => t.id === taskId);
      if (!task) return state;

      const notification = createNotification(
        "task_snoozed",
        taskId,
        task.title,
        {
          message: `Task "${task.title}" snoozed until ${new Date(
            snoozeUntil,
          ).toLocaleDateString()}`,
          snoozeUntil,
          note,
          priority: task.priority || "medium",
        },
      );

      // Schedule wake-up reminder
      const wakeupReminder = {
        id: Date.now() + Math.random(),
        taskId,
        type: "snooze_wakeup",
        scheduledFor: snoozeUntil,
        message: `Snoozed task "${task.title}" is now active`,
        active: true,
      };

      return {
        tasks: state.tasks.map((t) =>
          t.id === taskId
            ? { ...t, snoozedUntil: snoozeUntil, snoozeNote: note }
            : t,
        ),
        notifications: [notification, ...state.notifications],
        reminders: [...state.reminders, wakeupReminder],
      };
    });
  },

  addCustomReminder: (taskId, reminderDate, message) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;

    const reminder = {
      id: Date.now() + Math.random(),
      taskId,
      type: "custom",
      scheduledFor: reminderDate,
      message: message || `Reminder for task "${task.title}"`,
      active: true,
    };

    set((state) => ({
      reminders: [...state.reminders, reminder],
    }));
  },

  // Check for due notifications and overdue tasks
  checkReminders: () => {
    const now = new Date();
    const state = get();

    state.reminders.forEach((reminder) => {
      if (reminder.active && new Date(reminder.scheduledFor) <= now) {
        const task = state.tasks.find((t) => t.id === reminder.taskId);
        if (task) {
          let notificationType = reminder.type;
          let message = reminder.message;

          if (reminder.type === "due_date") {
            notificationType = "due_date";
            message = reminder.message;
          } else if (reminder.type === "snooze_wakeup") {
            notificationType = "snooze_wakeup";
          }

          const notification = createNotification(
            notificationType,
            task.id,
            task.title,
            {
              message,
              priority: task.priority || "medium",
            },
          );

          set((prevState) => ({
            notifications: [notification, ...prevState.notifications],
            reminders: prevState.reminders.map((r) =>
              r.id === reminder.id ? { ...r, active: false } : r,
            ),
          }));
        }
      }
    });

    // Check for overdue tasks
    state.tasks.forEach((task) => {
      if (task.dueDate && task.status !== "DONE") {
        const dueDate = new Date(task.dueDate);
        const daysPastDue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));

        if (daysPastDue > 0 && state.notificationSettings.overdueReminders) {
          // Check if we already sent overdue notification today
          const todayOverdueExists = state.notifications.some(
            (n) =>
              n.taskId === task.id &&
              n.type === "overdue" &&
              new Date(n.timestamp).toDateString() === now.toDateString(),
          );

          if (!todayOverdueExists) {
            const notification = createNotification(
              "overdue",
              task.id,
              task.title,
              {
                message: `Task "${task.title}" is ${daysPastDue} ${
                  daysPastDue === 1 ? "day" : "days"
                } overdue`,
                daysPastDue,
                priority: "critical",
              },
            );

            set((prevState) => ({
              notifications: [notification, ...prevState.notifications],
            }));
          }
        }
      }
    });
  },

  updateNotificationSettings: (settings) =>
    set((state) => ({
      notificationSettings: { ...state.notificationSettings, ...settings },
    })),

  updateQuickTaskSettings: (settings) =>
    set((state) => ({
      quickTaskSettings: { ...state.quickTaskSettings, ...settings },
    })),

  // Get task status helpers
  getTaskStatus: (taskId) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return null;

    const now = new Date();
    const isOverdue =
      task.dueDate && new Date(task.dueDate) < now && task.status !== "DONE";
    const isSnoozed = task.snoozedUntil && new Date(task.snoozedUntil) > now;
    const hasReminders = get().reminders.some(
      (r) => r.taskId === taskId && r.active,
    );

    return {
      isOverdue,
      isSnoozed,
      hasReminders,
      task,
    };
  },

  // Getters
  getTaskById: (taskId) => {
    const state = get();
    return state.tasks.find((task) => task.id === taskId);
  },

  getSubtaskById: (parentTaskId, subtaskId) => {
    const state = get();
    const parentTask = state.tasks.find((task) => task.id === parentTaskId);
    return parentTask?.subtasks.find((subtask) => subtask.id === subtaskId);
  },

  // Filters
  getFilteredTasks: (filters) => {
    const state = get();
    return state.tasks.filter((task) => {
      // Apply search filter
      const matchesSearch = filters.searchTerm
        ? task.title.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
          task.assignee.toLowerCase().includes(filters.searchTerm.toLowerCase())
        : true;

      // Apply status filter
      const matchesStatus =
        filters.statusFilter === "all" ||
        (filters.statusFilter === "todo" && task.status === "OPEN") ||
        (filters.statusFilter === "progress" && task.status === "INPROGRESS") ||
        (filters.statusFilter === "review" && task.status === "ONHOLD") ||
        (filters.statusFilter === "completed" && task.status === "DONE");

      // Apply priority filter
      const matchesPriority =
        filters.priorityFilter === "all" ||
        task.priority.toLowerCase() === filters.priorityFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesPriority;
    });
  },
}));

export default useTasksStore;

