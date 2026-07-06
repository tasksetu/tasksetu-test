import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import useTasksStore from "../../stores/tasksStore";
import TasksCalendarView from "./TasksCalendarView";
import { useActiveRole } from "../../components/RoleSwitcher";
import { useShowToast } from "../../utils/ToastMessage";
import { useTaskStatuses } from "../../hooks/useTaskStatuses";
import { useTaskPriorities } from "../../hooks/useTaskPriorities";
import { useSubtask } from "../../contexts/SubtaskContext";

import TaskFilters from "./TaskFilters";
import TaskTable from "./TaskTable";
import TaskModals from "./TaskModals";

import { useTaskOperations } from "../../hooks/useTaskOperations";
import {
  getTaskType,
  getTaskColorCode,
  getStatusLabel,
  canEditTaskStatus,
  canMarkAsCompleted,
  canDeleteTask,
  applyFiltering,
} from "../../utils/taskHelpers";
import { Loader } from "lucide-react";

// ─── Helper Components ────────────────────────────────────────────────────────

const FilterChip = ({ label, onRemove }) => (
  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
    {label}
    <button
      onClick={onRemove}
      className="ml-1 text-blue-600 hover:text-blue-800"
    >
      ×
    </button>
  </span>
);

const EmptyState = ({ onTaskCreate }) => (
  <div className="card p-0">
    <div className="text-center py-12">
      <svg
        className="mx-auto h-12 w-12 text-gray-400 mb-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
        />
      </svg>
      <h3 className="text-lg font-medium mb-2">No tasks found</h3>
      <p className="text-sm text-gray-500 mb-3">
        You don't have any tasks assigned yet.
      </p>
      <button
        onClick={onTaskCreate}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-sm text-white bg-blue-600 hover:bg-blue-700"
      >
        <svg
          className="w-4 h-4 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        Create your first task
      </button>
    </div>
  </div>
);

const recalculateMilestonesInList = (tasks) => {
  const milestones = tasks.filter((t) => t.isMilestone || t.taskType === "milestone");
  if (milestones.length === 0) return tasks;

  return tasks.map((task) => {
    if (task.isMilestone || task.taskType === "milestone") {
      const milestoneId = task.id || task._id;
      const linkedTasks = tasks.filter(
        (t) =>
          (t.linkedToMilestone === milestoneId ||
            t.linkedToMilestone?._id === milestoneId ||
            (task.linkedTasks && task.linkedTasks.includes(t.id || t._id))) &&
          t.id !== milestoneId &&
          t._id !== milestoneId
      );

      if (linkedTasks.length > 0) {
        const completedCount = linkedTasks.filter(
          (t) => t.status === "DONE" || t.status === "COMPLETED"
        ).length;
        const totalCount = linkedTasks.length;
        const newProgress = Math.round((completedCount / totalCount) * 100);

        let nextStatus = task.status;
        if (newProgress === 100) {
          nextStatus = "DONE";
        } else if (newProgress > 0 && newProgress < 100 && task.status === "OPEN") {
          nextStatus = "INPROGRESS";
        } else if (newProgress === 0 && task.status !== "OPEN") {
          nextStatus = "OPEN";
        }

        return {
          ...task,
          progress: newProgress,
          status: nextStatus,
        };
      }
    }
    return task;
  });
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AllTasks({ onCreateTask, initialDueDateFilter }) {
  const { showSuccessToast, showErrorToast } = useShowToast();
  const [location, navigate] = useLocation();
  const { activeRole } = useActiveRole();
  const { openSubtaskDrawer } = useSubtask();
  const queryClient = useQueryClient();

  // ── Filter & pagination state ──────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [taskTypeFilter, setTaskTypeFilter] = useState("all");
  const [dueDateFilter, setDueDateFilter] = useState("all");
  const [showSnooze, setShowSnooze] = useState(false);
  const [showCalendarView, setShowCalendarView] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [statusSort, setStatusSort] = useState("none");

  // ── Inline editing state ───────────────────────────────────────────────────
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingSubtaskId, setEditingSubtaskId] = useState(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("");

  // ── Modal state ────────────────────────────────────────────────────────────
  const [showApprovalTaskModal, setShowApprovalTaskModal] = useState(false);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [showTaskDetails, setShowTaskDetails] = useState(false);
  const [showSmartParser, setShowSmartParser] = useState(false);
  const [showThreadModal, setShowThreadModal] = useState(false);
  const [showStatusConfirmation, setShowStatusConfirmation] = useState(null);
  const [selectedDateForTask, setSelectedDateForTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedTaskForThread, setSelectedTaskForThread] = useState(null);

  // ── Zustand store ──────────────────────────────────────────────────────────
  const {
  selectedTasks,
  setSelectedTasks,
  toggleTaskExpansion,
  expandedTasks,
  clearExpandedTasks,
  snoozedTasks,
  getTaskStatus,
} = useTasksStore();
  const prevLocationRef = useRef(location);

  useEffect(() => {
  return () => {
    clearExpandedTasks();
  };
}, [location]);

  // ── Server data ────────────────────────────────────────────────────────────
  const { data: currentUserData } = useQuery({
    queryKey: ["/api/auth/verify"],
    enabled: !!localStorage.getItem("token"),
    staleTime: 5 * 60 * 1000,
  });

  const tasksQueryKey = [
    "allTasks",
    activeRole,
    currentPage,
    searchTerm,
    statusFilter,
    priorityFilter,
    taskTypeFilter,
    dueDateFilter,
    showSnooze,
  ];

  const currentUser = currentUserData || {
    id: "anonymous",
    name: "User",
    role: "employee",
  };
  const { data: companyStatuses = [] } = useTaskStatuses();
  const { data: taskPriorities = [] } = useTaskPriorities();

  // ── Permission helpers ─────────────────────────────────────────────────────
  const canEditTaskStatusFn = (task) => canEditTaskStatus(task, currentUser);
  const canMarkAsCompletedFn = (task) => canMarkAsCompleted(task);

  // ── Fetch tasks function for TanStack Query ────────────────────────────────
  const fetchTasksFn = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("Authorization token not found.");

    const queryParams = new URLSearchParams();
    // Always fetch all tasks first (we'll handle pagination on grouped data)
    queryParams.set("page", "1");
    queryParams.set("limit", "1000"); // Fetch more to handle grouping

    if (searchTerm) queryParams.set("search", searchTerm);
    if (statusFilter !== "all") queryParams.set("status", statusFilter);
    if (priorityFilter !== "all") queryParams.set("priority", priorityFilter);
    if (taskTypeFilter !== "all") queryParams.set("taskType", taskTypeFilter);
    if (dueDateFilter !== "all") queryParams.set("dueDate", dueDateFilter);
    if (showSnooze) queryParams.set("showSnooze", "true");
    if (activeRole) queryParams.append("activeRole", activeRole);

    const response = await axios.get(`/api/mytasks?${queryParams.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.data?.success) {
      throw new Error(response.data?.message || "Failed to fetch tasks.");
    }

    const tasksArr = response.data.data?.tasks || [];
    const pagination = response.data.data?.pagination || {};

    const mappedTasks = tasksArr.map((task) => {
      const taskData = task._doc || task;
      const taskId = taskData._id;

      return {
        id: taskId,
        _id: taskId,
        ...taskData,

        assignee: taskData.assignedTo
          ? `${taskData.assignedTo.firstName} ${taskData.assignedTo.lastName}`
          : "Unassigned",

        assigneeId: taskData.assignedTo?._id,

        status:
          taskData.approvalStatus === "approved"
            ? "APPROVED"
            : taskData.approvalStatus === "rejected"
              ? "REJECTED"
              : taskData.status?.toUpperCase() === "CANCELLED"
                ? "CANCELLED"
                : taskData.isApprovalTask || taskData.taskType === "approval"
                  ? "PENDING"
                  : taskData.status || "OPEN",

        priority: taskData.priority
          ? taskData.priority.charAt(0).toUpperCase() +
            taskData.priority.slice(1)
          : "Medium",

        dueDate: taskData.dueDate || "",

        progress:
          taskData.approvalStatus === "approved" ||
          taskData.approvalStatus === "rejected"
            ? 100
            : taskData.progress !== undefined && taskData.progress !== null
              ? taskData.progress
              : taskData.status === "DONE"
                ? 100
                : taskData.status === "INPROGRESS"
                  ? 50
                  : 0,

        subtasks: (task.subtasks || []).map((subtask) => ({
          ...subtask,
          id: subtask._id,
          _id: subtask._id,
          status: subtask.status || "OPEN",
          assignee: subtask.assignedTo
            ? `${subtask.assignedTo.firstName} ${subtask.assignedTo.lastName}`
            : "Unassigned",
          assigneeId: subtask.assignedTo?._id,
          creatorId: subtask.createdBy?._id || subtask.createdBy,
        })),
      };
    });

    return {
      tasks: mappedTasks,
      totalTasks: pagination.totalTasks || tasksArr.length,
    };
  }, [
    activeRole,
    searchTerm,
    statusFilter,
    priorityFilter,
    taskTypeFilter,
    dueDateFilter,
    showSnooze,
  ]);

  // ── TanStack Query for tasks ───────────────────────────────────────────────
  const {
    data: tasksData,
    isLoading: apiLoading,
    error: apiError,
    refetch: refetchTasks,
  } = useQuery({
    queryKey: [
      "allTasks",
      activeRole,
      searchTerm,
      statusFilter,
      priorityFilter,
      taskTypeFilter,
      dueDateFilter,
      showSnooze,
    ],
    queryFn: fetchTasksFn,
    enabled: !!localStorage.getItem("token") || !!activeRole,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });

  const apiTasks = tasksData?.tasks || [];
  const totalRawTasks = tasksData?.totalTasks || 0;

  // ── Optimistic status update mutation ──────────────────────────────────────
  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, newStatusCode, reason }) => {
      const task = apiTasks.find((t) => t.id === taskId || t._id === taskId);
      if (!task) throw new Error("Task not found");

      const statusMapping = {
        OPEN: "OPEN",
        INPROGRESS: "INPROGRESS",
        "IN-PROGRESS": "INPROGRESS",
        DONE: "DONE",
        COMPLETED: "DONE",
        ONHOLD: "ONHOLD",
        CANCELLED: "CANCELLED",
      };
      const backendStatus =
        statusMapping[newStatusCode] || newStatusCode?.toString().toUpperCase();
      const payload = { status: backendStatus, notes: reason || undefined };
      if (newStatusCode === "DONE")
        payload.completedDate = new Date().toISOString();

      const response = await axios.patch(
        `/api/tasks/${taskId}/status`,
        payload,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );

      if (!response.data?.success)
        throw new Error(response.data?.message || "Failed to update status");
      return { taskId, newStatusCode, taskTitle: task.title };
    },
    onMutate: async ({ taskId, newStatusCode }) => {
      await queryClient.cancelQueries({
        queryKey: [
          "allTasks",
          activeRole,
          searchTerm,
          statusFilter,
          priorityFilter,
          taskTypeFilter,
          dueDateFilter,
          showSnooze,
        ],
      });
      const previousTasks = queryClient.getQueryData([
        "allTasks",
        activeRole,
        searchTerm,
        statusFilter,
        priorityFilter,
        taskTypeFilter,
        dueDateFilter,
        showSnooze,
      ]);

      queryClient.setQueryData(
        [
          "allTasks",
          activeRole,
          searchTerm,
          statusFilter,
          priorityFilter,
          taskTypeFilter,
          dueDateFilter,
          showSnooze,
        ],
        (old) => {
          if (!old) return old;
          const statusObj = companyStatuses.find(
            (s) => s.code === newStatusCode,
          );
          const mappedTasks = old.tasks.map((t) =>
            t.id === taskId || t._id === taskId
              ? {
                  ...t,
                  status: newStatusCode,
                  statusColor: statusObj?.color,
                  progress: newStatusCode === "DONE" ? 100 : t.progress,
                }
              : t,
          );
          return {
            ...old,
            tasks: recalculateMilestonesInList(mappedTasks),
          };
        },
      );

      return { previousTasks };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(
        [
          "allTasks",
          activeRole,
          searchTerm,
          statusFilter,
          priorityFilter,
          taskTypeFilter,
          dueDateFilter,
          showSnooze,
        ],
        context?.previousTasks,
      );
      showErrorToast?.(err.response?.data?.message || err.message || "Failed to update status");
    },
    onSuccess: (data) => {
      const newStatus = companyStatuses.find(
        (s) => s.code === data.newStatusCode,
      );
      showSuccessToast?.(
        `Task "${data.taskTitle}" status updated to "${newStatus?.label || data.newStatusCode}"`,
      );
      queryClient.invalidateQueries({ queryKey: ["allTasks"] });
    },
  });

  const applyTaskStatusUpdateFromDropdown = (taskId, newStatusCode, reason) => {
    updateTaskStatusMutation.mutate({ taskId, newStatusCode, reason });
  };

  // ── Task operations hook ───────────────────────────────────────────────────
  const {
    confirmModal,
    setConfirmModal,
    executeStatusChange,
    handleDeleteTask,
    handleBulkDeleteTasks,
    handleSnoozeTask,
    handleMarkAsRisk,
    handleQuickMarkAsDone,
    exportTasksCSV,
    exportTasksExcel,
  } = useTaskOperations({
    apiTasks,
    setApiTasks: (updater) => {
      queryClient.setQueryData(
        [
          "allTasks",
          activeRole,
          searchTerm,
          statusFilter,
          priorityFilter,
          taskTypeFilter,
          dueDateFilter,
          showSnooze,
        ],
        (old) => {
          if (!old) return old;
          const newTasks =
            typeof updater === "function" ? updater(old.tasks) : updater;
          return { ...old, tasks: recalculateMilestonesInList(newTasks) };
        },
      );
    },
    refetchTasks,
    showSuccessToast,
    showErrorToast,
    companyStatuses,
  });

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlStatus = params.get("statusFilter");
    const urlDueDate = params.get("dueDateFilter");
    const urlTaskType = params.get("taskTypeFilter");
    if (urlStatus) setStatusFilter(urlStatus);
    if (urlDueDate) setDueDateFilter(urlDueDate);
    if (urlTaskType) setTaskTypeFilter(urlTaskType);
    if (urlStatus || urlDueDate || urlTaskType) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (initialDueDateFilter && initialDueDateFilter !== "all") {
      setDueDateFilter(initialDueDateFilter);
    }
  }, [initialDueDateFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    statusFilter,
    priorityFilter,
    taskTypeFilter,
    dueDateFilter,
    showSnooze,
    statusSort,
  ]);

  // ── IMPORTANT: Group recurring tasks and handle pagination properly ─────────
  const { groupedTasksForDisplay, totalDisplayableTasks } = useMemo(() => {
    // Separate recurring pattern tasks and regular tasks
    const recurringMap = new Map(); // Map by title to group recurring tasks
    const regularTasks = [];

    apiTasks.forEach((task) => {
      // Identify recurring pattern task (based on your backend structure)
      if (task.isRecurring === true && task.taskType === "recurring") {
        const title = task.title;
        if (!recurringMap.has(title)) {
          recurringMap.set(title, []);
        }
        recurringMap.get(title).push(task);
      } else {
        regularTasks.push(task);
      }
    });

    // Process each recurring group to create parent with instances
    const recurringGroups = [];
    recurringMap.forEach((tasks, title) => {
      // Sort by due date (oldest first)
      const sortedTasks = [...tasks].sort((a, b) => {
        return new Date(a.dueDate) - new Date(b.dueDate);
      });

      if (sortedTasks.length > 1) {
        // The LATEST task becomes the parent pattern (shown in main list)
        const patternTask = sortedTasks[sortedTasks.length - 1];
        // All OTHER tasks become instances (shown when expanded)
        const instances = sortedTasks.slice(0, -1);

        recurringGroups.push({
          ...patternTask,
          isRecurringPattern: true,
          recurringInstances: instances,
          hasRecurringInstances: instances.length > 0,
          // Store all instance IDs for reference
          instanceIds: instances.map((inst) => inst.id || inst._id),
        });
      } else if (sortedTasks.length === 1) {
        // Single recurring task - treat as regular task
        regularTasks.push(sortedTasks[0]);
      }
    });

    // Combine: first regular tasks, then recurring groups
    const allDisplayableTasks = [...regularTasks, ...recurringGroups];

    // Total count for pagination = regular tasks + recurring groups (parent tasks only)
    const totalCount = allDisplayableTasks.length;

    return {
      groupedTasksForDisplay: allDisplayableTasks,
      totalDisplayableTasks: totalCount,
    };
  }, [apiTasks]);

  // Apply filters to grouped tasks
  const filteredTasks = useMemo(
    () =>
      applyFiltering(groupedTasksForDisplay, {
        searchTerm,
        statusFilter,
        priorityFilter,
        taskTypeFilter,
        dueDateFilter,
        windowCalendarSpecificDate: window.calendarSpecificDate,
      }),
    [
      groupedTasksForDisplay,
      searchTerm,
      statusFilter,
      priorityFilter,
      taskTypeFilter,
      dueDateFilter,
    ],
  );

  // Custom sorting for status column
  const getStatusWeight = (status) => {
    const s = String(status || "").toUpperCase();
    if (s === "OPEN" || s === "TODO") return 1;
    if (s === "INPROGRESS" || s === "IN-PROGRESS") return 2;
    if (s === "PENDING" || s === "ONHOLD") return 3;
    if (s === "DONE" || s === "COMPLETED" || s === "APPROVED") return 4;
    if (s === "CANCELLED" || s === "REJECTED") return 5;
    return 6;
  };

  const sortedAndFilteredTasks = useMemo(() => {
    if (statusSort === "none") return filteredTasks;
    return [...filteredTasks].sort((a, b) => {
      const weightA = getStatusWeight(a.status);
      const weightB = getStatusWeight(b.status);
      if (statusSort === "asc") {
        return weightA - weightB;
      } else {
        return weightB - weightA;
      }
    });
  }, [filteredTasks, statusSort]);

  // Pagination on filtered/sorted tasks (only counting parent tasks)
  const isFiltering = Boolean(
    searchTerm ||
    statusFilter !== "all" ||
    priorityFilter !== "all" ||
    taskTypeFilter !== "all" ||
    dueDateFilter !== "all" ||
    showSnooze ||
    statusSort !== "none"
  );

  const effectiveTotal = isFiltering
    ? sortedAndFilteredTasks.length
    : totalDisplayableTasks;
  const effectiveTotalPages = Math.max(
    1,
    Math.ceil(effectiveTotal / itemsPerPage),
  );

  const paginatedTasksList = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const tasksToPaginate = isFiltering
      ? sortedAndFilteredTasks
      : groupedTasksForDisplay;
    return tasksToPaginate.slice(start, end);
  }, [
    sortedAndFilteredTasks,
    groupedTasksForDisplay,
    isFiltering,
    currentPage,
    itemsPerPage,
  ]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleBulkStatusUpdate = (newStatusCode) => {
    const selectedTaskObjects = apiTasks.filter((t) =>
      selectedTasks.includes(t.id),
    );
    selectedTaskObjects.forEach((task) => {
      if (!canEditTaskStatusFn(task))
        showErrorToast?.(`No permission: ${task.title}`);
    });
    setSelectedTasks([]);
  };

  const handleBulkDelete = () => {
    const selectedTaskObjects = apiTasks.filter((t) =>
      selectedTasks.includes(t.id),
    );
    handleBulkDeleteTasks(selectedTasks, selectedTaskObjects);
  };

  const handleTaskCreated = async () => {
    setSelectedDateForTask(null);
    refetchTasks();
  };

  const handleTaskUpdated = async () => {
    setShowEditTaskModal(false);
    setEditingTask(null);
    refetchTasks();
  };

  const handleCreateApprovalTask = async () => {
    setShowApprovalTaskModal(false);
    refetchTasks();
  };

  const handleCreateMilestone = async () => {
    setShowMilestoneModal(false);
    refetchTasks();
  };

  const handleSmartTaskCreated = () => {
    setShowSmartParser(false);
    refetchTasks();
  };

  const handleNavigateToTask = (taskId) => navigate(`/tasks/${taskId}`);
  const handleToggleTaskExpansion = (taskId) => toggleTaskExpansion(taskId);

  // Inline title editing
  const handleTaskTitleClick = (task) => {
    setEditingTaskId(task.id);
    setEditingTitle(task.title);
  };

  const handleTitleSave = async (taskId) => {
    const original = apiTasks.find((t) => t.id === taskId);
    if (editingTitle.trim() && editingTitle.trim() !== original?.title) {
      try {
        await axios.put(
          `/api/tasks/${taskId}`,
          { title: editingTitle.trim() },
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          },
        );

        queryClient.setQueryData(
          [
            "allTasks",
            activeRole,
            searchTerm,
            statusFilter,
            priorityFilter,
            taskTypeFilter,
            dueDateFilter,
            showSnooze,
          ],
          (old) => {
            if (!old) return old;
            return {
              ...old,
              tasks: old.tasks.map((t) =>
                t.id === taskId ? { ...t, title: editingTitle.trim() } : t,
              ),
            };
          },
        );

        showSuccessToast?.("Task title updated");
      } catch (error) {
        showErrorToast?.(
          error.response?.data?.message || "Failed to update task title",
        );
      }
    }
    setEditingTaskId(null);
    setEditingTitle("");
  };

  const handleTitleKeyDown = (e, taskId) => {
    if (e.key === "Enter") handleTitleSave(taskId);
    else if (e.key === "Escape") {
      setEditingTaskId(null);
      setEditingTitle("");
    }
  };

  // Inline subtask title editing
  const handleSubtaskTitleClick = (subtask, parentTaskId) => {
    setEditingSubtaskId(subtask._id || subtask.id);
    setEditingSubtaskTitle(subtask.title);
  };

  const handleSubtaskTitleSave = async (subtaskId, parentTaskId) => {
    const parentTask = apiTasks.find((t) => (t._id || t.id) === parentTaskId);
    const currentSubtask = parentTask?.subtasks?.find(
      (s) => (s._id || s.id) === subtaskId,
    );
    if (
      editingSubtaskTitle.trim() &&
      editingSubtaskTitle.trim() !== currentSubtask?.title
    ) {
      try {
        await axios.put(
          `/api/tasks/${parentTaskId}/subtasks/${subtaskId}`,
          { title: editingSubtaskTitle.trim() },
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          },
        );

        queryClient.setQueryData(
          [
            "allTasks",
            activeRole,
            searchTerm,
            statusFilter,
            priorityFilter,
            taskTypeFilter,
            dueDateFilter,
            showSnooze,
          ],
          (old) => {
            if (!old) return old;
            return {
              ...old,
              tasks: old.tasks.map((t) =>
                (t._id || t.id) === parentTaskId
                  ? {
                      ...t,
                      subtasks: t.subtasks?.map((s) =>
                        (s._id || s.id) === subtaskId
                          ? { ...s, title: editingSubtaskTitle.trim() }
                          : s,
                      ),
                    }
                  : t,
              ),
            };
          },
        );

        showSuccessToast?.("Subtask title updated");
      } catch (error) {
        showErrorToast?.(
          error.response?.data?.message || "Failed to update subtask title",
        );
      }
    }
    setEditingSubtaskId(null);
    setEditingSubtaskTitle("");
  };

  const handleSubtaskTitleKeyDown = (e, subtaskId, parentTaskId) => {
    if (e.key === "Enter") handleSubtaskTitleSave(subtaskId, parentTaskId);
    else if (e.key === "Escape") {
      setEditingSubtaskId(null);
      setEditingSubtaskTitle("");
    }
  };

  const handleSubtaskStatusChange = async (
    parentTaskId,
    subtaskId,
    newStatus,
  ) => {
    const parentTask = apiTasks.find(
      (t) => t.id === parentTaskId || t._id === parentTaskId,
    );
    const subtask = parentTask?.subtasks?.find(
      (s) => s.id === subtaskId || s._id === subtaskId,
    );
    if (!subtask) {
      showErrorToast?.("Subtask not found");
      return;
    }

    try {
      const updatePayload = {
        title: subtask.title,
        description: subtask.description || "",
        status: newStatus,
        priority:
          subtask.priority
            ?.toLowerCase()
            .replace(" priority", "")
            .replace(" ", "-") || "low",
        dueDate: subtask.dueDate || null,
        visibility: subtask.visibility?.toLowerCase() || "internal",
        tags: subtask.tags || [],
      };
      const apiParentTaskId = parentTask._id || parentTask.id;
      const apiSubtaskId = subtask._id || subtask.id;

      await axios.put(
        `/api/tasks/${apiParentTaskId}/subtasks/${apiSubtaskId}`,
        updatePayload,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );

      queryClient.setQueryData(
        [
          "allTasks",
          activeRole,
          searchTerm,
          statusFilter,
          priorityFilter,
          taskTypeFilter,
          dueDateFilter,
          showSnooze,
        ],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            tasks: old.tasks.map((t) =>
              t.id === parentTaskId || t._id === parentTaskId
                ? {
                    ...t,
                    subtasks: t.subtasks?.map((s) =>
                      s.id === subtaskId || s._id === subtaskId
                        ? { ...s, status: newStatus }
                        : s,
                    ),
                  }
                : t,
            ),
          };
        },
      );

      showSuccessToast?.("Subtask status updated");
    } catch (error) {
      showErrorToast?.(
        error.response?.data?.message || "Failed to update subtask status",
      );
    }
  };

  const handleEditSubtask = (subtask) => {
    const task = apiTasks.find((t) =>
      t.subtasks?.some((s) => s.id === subtask.id || s._id === subtask._id),
    );
    if (task) openSubtaskDrawer(task, subtask, "edit");
    else showErrorToast?.("Parent task not found");
  };

  const handleDeleteSubtask = async (parentTaskId, subtaskId) => {
    try {
      const parentTask = apiTasks.find(
        (t) => t.id === parentTaskId || t._id === parentTaskId,
      );
      const subtask = parentTask?.subtasks?.find(
        (s) => s.id === subtaskId || s._id === subtaskId,
      );
      if (!parentTask || !subtask) {
        showErrorToast?.("Subtask not found");
        return;
      }

      const apiParentTaskId = parentTask._id || parentTask.id;
      const apiSubtaskId = subtask._id || subtask.id;

      await axios.delete(
        `/api/tasks/${apiParentTaskId}/subtasks/${apiSubtaskId}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );

      queryClient.setQueryData(
        [
          "allTasks",
          activeRole,
          searchTerm,
          statusFilter,
          priorityFilter,
          taskTypeFilter,
          dueDateFilter,
          showSnooze,
        ],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            tasks: old.tasks.map((t) =>
              t.id === parentTaskId || t._id === parentTaskId
                ? {
                    ...t,
                    subtasks: t.subtasks?.filter(
                      (s) => s.id !== subtaskId && s._id !== subtaskId,
                    ),
                  }
                : t,
            ),
          };
        },
      );

      showSuccessToast?.("Subtask deleted");
    } catch (error) {
      showErrorToast?.(
        error.response?.data?.message || "Failed to delete subtask",
      );
    }
  };

  const handleCalendarDateSelect = (selectedDate) => {
    setSelectedDateForTask(selectedDate);
    setShowCalendarModal(false);
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setTaskTypeFilter("all");
    setDueDateFilter("all");
    window.calendarSpecificDate = null;
  };

  // ── Render ──
  return (
    <div className="py-3 px-6 h-[calc(100vh-64px)] flex flex-col overflow-x-hidden bg-gray-50 [&_.card]:!rounded-sm [&_input:not([type='checkbox']):not([type='radio'])]:!rounded-sm [&_select]:!rounded-sm [&_textarea]:!rounded-sm [&_.form-input]:!rounded-sm [&_.form-select]:!rounded-sm [&_.form-textarea]:!rounded-sm [&_button:not(.rounded-full)]:!rounded-sm [&_table]:!rounded-sm [&_.bg-white.border]:!rounded-sm [&_.rounded-sm]:!rounded-sm [&_.rounded-md]:!rounded-sm [&_.rounded-lg]:!rounded-sm [&_.rounded-xl]:!rounded-sm [&_.rounded-2xl]:!rounded-sm [&_.rounded]:!rounded-sm [&_.rounded-r-lg]:!rounded-r-sm [&_.rounded-r-md]:!rounded-r-sm">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4">
        <div>
          <h1 className="text-2xl font-normal m-0"
                style={{ color: "#676a6c" }}>All Tasks</h1>
          <p className="mt-0 text-sm text-blue-600">
            Manage and track all your tasks
          </p>
        </div>

        <div className="mt-3 lg:mt-0 flex items-center gap-2">
          <button
            onClick={() => setShowSnooze(!showSnooze)}
            className={`h-8 inline-flex items-center px-3 py-2 text-sm font-medium rounded-sm transition-colors ${
              showSnooze
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300"
            }`}
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            {showSnooze ? "Hide Snoozed" : "Show Snoozed"}
          </button>
        </div>
      </div>

      <TaskFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        priorityFilter={priorityFilter}
        setPriorityFilter={setPriorityFilter}
        taskTypeFilter={taskTypeFilter}
        setTaskTypeFilter={setTaskTypeFilter}
        dueDateFilter={dueDateFilter}
        setDueDateFilter={setDueDateFilter}
        selectedTasks={selectedTasks}
        setSelectedTasks={setSelectedTasks}
        handleBulkStatusUpdate={handleBulkStatusUpdate}
        handleBulkDeleteTasks={handleBulkDelete}
        exportTasksCSV={exportTasksCSV}
        exportTasksExcel={exportTasksExcel}
        filteredTasks={filteredTasks}
        currentPage={currentPage}
        companyStatuses={companyStatuses}
        taskPriorities={taskPriorities}
        activeRole={activeRole}
        windowCalendarSpecificDate={window.calendarSpecificDate}
      />

      {/* Active Filters Display */}
      {!showCalendarView &&
        (statusFilter !== "all" ||
          priorityFilter !== "all" ||
          taskTypeFilter !== "all" ||
          dueDateFilter !== "all" ||
          searchTerm) && (
          <div className=" bg-blue-50 border-blue-200 mb-3">
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-blue-800">
                  Active Filters:
                </span>
                {searchTerm && (
                  <FilterChip
                    label={`Search: "${searchTerm}"`}
                    onRemove={() => setSearchTerm("")}
                  />
                )}
                {statusFilter !== "all" && (
                  <FilterChip
                    label={`Status: ${statusFilter}`}
                    onRemove={() => setStatusFilter("all")}
                  />
                )}
                {priorityFilter !== "all" && (
                  <FilterChip
                    label={`Priority: ${priorityFilter}`}
                    onRemove={() => setPriorityFilter("all")}
                  />
                )}
                {taskTypeFilter !== "all" && (
                  <FilterChip
                    label={`Type: ${taskTypeFilter}`}
                    onRemove={() => setTaskTypeFilter("all")}
                  />
                )}
                {dueDateFilter !== "all" && (
                  <FilterChip
                    label={`Due: ${
                      dueDateFilter === "specific_date" &&
                      window.calendarSpecificDate
                        ? `Date: ${new Date(window.calendarSpecificDate).toLocaleDateString()}`
                        : dueDateFilter.replace(/_/g, " ")
                    }`}
                    onRemove={() => {
                      setDueDateFilter("all");
                      window.calendarSpecificDate = null;
                    }}
                  />
                )}
              </div>
              <button
                onClick={clearAllFilters}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        )}

      {/* Calendar View */}
      {showCalendarView && (
        <div className="card mb-3">
          <TasksCalendarView
            tasks={filteredTasks}
            onTaskClick={(task) => navigate(`/tasks/${task.id || task._id}`)}
            onClose={() => setShowCalendarView(false)}
            onDateSelect={handleCalendarDateSelect}
            onDueDateFilter={(filterType, specificDate) => {
              setShowCalendarView(false);
              if (filterType === "specific_date" && specificDate) {
                setDueDateFilter("specific_date");
                window.calendarSpecificDate = specificDate;
              } else {
                setDueDateFilter(filterType);
              }
            }}
          />
        </div>
      )}

      {/* Tasks Table */}
      {!showCalendarView &&
        (apiLoading ? (
          <div className="flex-1 overflow-y-auto min-h-0 task-view-container task-detail-page px-3 sm:px-4">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="flex flex-col items-center gap-3">
                <Loader className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-lg text-gray-600">Loading task details...</p>
              </div>
            </div>
          </div>
        ) : apiError ? (
          <div className="flex-1 overflow-y-auto min-h-0 flex justify-center py-10">
            <span className="text-lg text-red-500">
              {apiError?.message || "Failed to load tasks"}
            </span>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 gap-4">
            <TaskTable
              paginatedTasks={paginatedTasksList}
              statusSort={statusSort}
              onStatusSortToggle={() => {
                setStatusSort((prev) => {
                  if (prev === "none") return "asc";
                  if (prev === "asc") return "desc";
                  return "none";
                });
              }}
              expandedTasks={expandedTasks}
              editingTaskId={editingTaskId}
              editingTitle={editingTitle}
              setEditingTitle={setEditingTitle}
              handleTaskTitleClick={handleTaskTitleClick}
              handleTitleSave={handleTitleSave}
              handleTitleCancel={() => {
                setEditingTaskId(null);
                setEditingTitle("");
              }}
              handleTitleKeyDown={handleTitleKeyDown}
              editingSubtaskId={editingSubtaskId}
              editingSubtaskTitle={editingSubtaskTitle}
              setEditingSubtaskTitle={setEditingSubtaskTitle}
              handleSubtaskTitleClick={handleSubtaskTitleClick}
              handleSubtaskTitleSave={handleSubtaskTitleSave}
              handleSubtaskTitleCancel={() => {
                setEditingSubtaskId(null);
                setEditingSubtaskTitle("");
              }}
              handleSubtaskTitleKeyDown={handleSubtaskTitleKeyDown}
              handleToggleTaskExpansion={handleToggleTaskExpansion}
              handleNavigateToTask={handleNavigateToTask}
              handleSubtaskStatusChange={handleSubtaskStatusChange}
              handleSnoozeTask={handleSnoozeTask}
              handleMarkAsRisk={handleMarkAsRisk}
              handleQuickMarkAsDone={handleQuickMarkAsDone}
              handleDeleteTask={handleDeleteTask}
              handleEditSubtask={handleEditSubtask}
              handleDeleteSubtask={handleDeleteSubtask}
              selectedTasks={selectedTasks}
              companyStatuses={companyStatuses}
              taskPriorities={taskPriorities}
              currentUser={currentUser}
              snoozedTasks={snoozedTasks}
              getTaskStatus={getTaskStatus}
              canEditTaskStatusFn={canEditTaskStatusFn}
              canMarkAsCompletedFn={canMarkAsCompletedFn}
              applyTaskStatusUpdateFromDropdown={
                applyTaskStatusUpdateFromDropdown
              }
            />

            {/* Pagination - Now showing correct count (only parent tasks) */}
            {effectiveTotal > 0 && effectiveTotalPages > 1 && (
              <div className="bg-white border p-5 rounded-sm shadow-md mb-4 flex-shrink-0">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-sm text-gray-700">
                    Showing{" "}
                    <span className="font-medium">
                      {(currentPage - 1) * itemsPerPage + 1}
                    </span>{" "}
                    to{" "}
                    <span className="font-medium">
                      {Math.min(currentPage * itemsPerPage, effectiveTotal)}
                    </span>{" "}
                    of <span className="font-medium">{effectiveTotal}</span>{" "}
                    tasks
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-2 rounded-sm text-sm font-medium bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                    </button>

                    {(() => {
                      const pages = [];
                      const maxVisible = 5;
                      let start = Math.max(
                        1,
                        currentPage - Math.floor(maxVisible / 2),
                      );
                      let end = Math.min(
                        effectiveTotalPages,
                        start + maxVisible - 1,
                      );
                      if (end - start < maxVisible - 1)
                        start = Math.max(1, end - maxVisible + 1);
                      for (let i = start; i <= end; i++) {
                        pages.push(
                          <button
                            key={i}
                            onClick={() => setCurrentPage(i)}
                            className={`px-3 py-2 rounded-sm text-sm font-medium transition-colors ${
                              currentPage === i
                                ? "bg-blue-600 text-white"
                                : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-300"
                            }`}
                          >
                            {i}
                          </button>,
                        );
                      }
                      return pages;
                    })()}

                    <button
                      onClick={() =>
                        setCurrentPage((p) =>
                          Math.min(effectiveTotalPages, p + 1),
                        )
                      }
                      disabled={currentPage === effectiveTotalPages}
                      className="px-3 py-2 rounded-sm text-sm font-medium bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

      {/* Modals */}
      <TaskModals
        selectedDateForTask={selectedDateForTask}
        handleTaskCreated={handleTaskCreated}
        showApprovalTaskModal={showApprovalTaskModal}
        setShowApprovalTaskModal={setShowApprovalTaskModal}
        handleCreateApprovalTask={handleCreateApprovalTask}
        showMilestoneModal={showMilestoneModal}
        setShowMilestoneModal={setShowMilestoneModal}
        handleCreateMilestone={handleCreateMilestone}
        showCalendarModal={showCalendarModal}
        setShowCalendarModal={setShowCalendarModal}
        handleCalendarDateSelect={handleCalendarDateSelect}
        showEditTaskModal={showEditTaskModal}
        setShowEditTaskModal={setShowEditTaskModal}
        editingTask={editingTask}
        handleTaskUpdated={handleTaskUpdated}
        showStatusConfirmation={showStatusConfirmation}
        setShowStatusConfirmation={setShowStatusConfirmation}
        executeStatusChange={executeStatusChange}
        apiTasks={apiTasks}
        confirmModal={confirmModal}
        setConfirmModal={setConfirmModal}
        showSmartParser={showSmartParser}
        setShowSmartParser={setShowSmartParser}
        showThreadModal={showThreadModal}
        setShowThreadModal={setShowThreadModal}
        selectedTaskForThread={selectedTaskForThread}
        setSelectedTaskForThread={setSelectedTaskForThread}
        handleSmartTaskCreated={handleSmartTaskCreated}
        showTaskDetails={showTaskDetails}
        setShowTaskDetails={setShowTaskDetails}
        selectedTask={selectedTask}
      />
    </div>
  );
}