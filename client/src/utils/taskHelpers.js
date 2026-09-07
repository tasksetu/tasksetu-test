import { getTaskTypeInfo } from "../pages/TaskTypeUtils";

export const getTaskType = (task) => {
  if (!task) return "Regular Task";
  if (task.taskType === "email") return "Email Task";
  if (task.isApprovalTask || task.taskType === "approval") return "Approval Task";
  if (task.isRecurring || task.recurringFromTaskId || task.taskType === "recurring") return "Recurring Task";
  if (task.isMilestone || task.taskType === "milestone" || task.mainTaskType === "milestone") return "Milestone Task";
  return "Regular Task";
};

export const isApprovalTask = (task) =>
  task?.isApprovalTask === true || task?.taskType === "approval";

export const getStatusColor = (statusCode, companyStatuses = []) => {
  const statusObj = companyStatuses.find((s) => s.code === statusCode);
  if (statusObj?.color) return statusObj.color;

  const statusColorMap = {
    OPEN: "#3B82F6",
    INPROGRESS: "#F59E0B",
    DONE: "#10B981",
    COMPLETED: "#10B981",
    ONHOLD: "#6B7280",
    CANCELLED: "#EF4444",
    PENDING: "#F97316",
    APPROVED: "#059669",
    REJECTED: "#DC2626",
    REVIEW: "#8B5CF6",
  };
  return statusColorMap[statusCode] || "#6B7280";
};

export const getTaskColorCode = (task, companyStatuses = []) => {
  if (task.taskType) {
    const taskTypeInfo = getTaskTypeInfo(task.taskType);
    if (taskTypeInfo?.color) return taskTypeInfo.color;
  }
  if (task.status) {
    return getStatusColor(task.status, companyStatuses);
  }
  return task.colorCode || "#6B7280";
};

export const getStatusLabel = (statusCode, companyStatuses = []) => {
  const status = companyStatuses.find((s) => s.code === statusCode);
  return status ? status.label : statusCode;
};

export const getPriorityBadge = (priority) => {
  const priorityClasses = {
    Low: "status-badge priority-low",
    Medium: "status-badge priority-medium",
    High: "status-badge priority-high",
    Urgent: "status-badge priority-urgent",
  };
  return priorityClasses[priority] || "status-badge priority-low";
};

export const canEditTaskStatus = (task, currentUser) => {
  const isContributor =
    task.isRecurring &&
    task.contributors?.some(
      (contributor) =>
        String(contributor?.id || contributor?._id) === String(currentUser?.id)
    );
  const isCreatorOrAssignee =
    task.assigneeId === currentUser?.id || task.creatorId === currentUser?.id;
  if (isContributor && !isCreatorOrAssignee) return false;
  return (
    task.assigneeId === currentUser?.id ||
    task.collaborators?.includes(currentUser?.id) ||
    currentUser?.role === "admin" ||
    task.creatorId === currentUser?.id
  );
};

export const canMarkAsCompleted = (task) => {
  if (!task.subtasks?.length) return true;
  return (
    task.subtasks.filter((s) => s.status !== "DONE" && s.status !== "CANCELLED").length === 0
  );
};

export const canDeleteTask = (task, currentUser) => {
  return (
    task.creatorId === currentUser?.id ||
    task.assigneeId === currentUser?.id ||
    currentUser?.role === "admin"
  );
};

export const canEditTaskTitle = (task, currentUser) => {
  if (!task) return false;

  // 1. Lock check: If status is CANCELLED, REJECTED, TERMINATED, DONE, or COMPLETED, NO ONE can edit title
  const rawStatus = String(task.status || "").toUpperCase().replace(/[^A-Z]/g, "");
  const rawAppStatus = String(task.approvalStatus || "").toUpperCase().replace(/[^A-Z]/g, "");

  const lockedStatuses = [
    "CANCELLED",
    "CANCELED",
    "REJECTED",
    "TERMINATED",
    "DONE",
    "COMPLETED",
  ];

  if (lockedStatuses.includes(rawStatus) || lockedStatuses.includes(rawAppStatus)) {
    return false;
  }

  let user = currentUser;
  if (!user || (!user.id && !user._id && !user.email)) {
    try {
      user = JSON.parse(localStorage.getItem("user") || "{}");
    } catch (e) {
      user = null;
    }
  }

  if (!user) return false;

  // 2. Admin / Super Admin override (if not locked by status)
  const userRoles = Array.isArray(user.role)
    ? user.role
    : Array.isArray(user.roles)
    ? user.roles
    : [user.role || user.roles || "employee"];

  const isAdmin = userRoles.some((r) =>
    ["super_admin", "super-admin", "org_admin", "admin", "company-admin", "tasksetu-admin"].includes(
      String(r).toLowerCase()
    )
  );

  if (isAdmin) return true;

  // 3. Assignee Check: User must be the assignee of the task/subtask
  const currentUserId = String(user.id || user._id || "");
  const currentUserEmail = String(user.email || "").toLowerCase();
  const currentUserName = `${user.firstName || ""} ${user.lastName || ""}`
    .trim()
    .toLowerCase() || String(user.name || "").toLowerCase();

  const assignedToId = String(
    task.assignedTo?._id || task.assignedTo?.id || task.assignedTo || task.assigneeId || ""
  );
  const assignedToEmail = String(task.assignedTo?.email || "").toLowerCase();
  const assigneeName = (
    typeof task.assignee === "string" ? task.assignee : task.assignee?.name || ""
  ).toLowerCase();

  const isAssignee =
    (currentUserId && assignedToId && currentUserId === assignedToId) ||
    (currentUserEmail && assignedToEmail && currentUserEmail === assignedToEmail) ||
    (currentUserName && assigneeName && (assigneeName.includes(currentUserName) || currentUserName.includes(assigneeName)));

  return Boolean(isAssignee);
};

export const applyFiltering = (tasks, filters) => {
  const {
    searchTerm,
    statusFilter,
    priorityFilter,
    taskTypeFilter,
    dueDateFilter,
    windowCalendarSpecificDate,
  } = filters;

  return tasks.filter((task) => {
    const matchesSearch =
      !searchTerm ||
      task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.assignee?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    const matchesPriority =
      priorityFilter === "all" ||
      task.priority?.toLowerCase() === priorityFilter.toLowerCase();
    const matchesTaskType =
      taskTypeFilter === "all" || getTaskType(task) === taskTypeFilter;

    const matchesDueDate = (() => {
      if (dueDateFilter === "all") return true;
      if (!task.dueDate) return dueDateFilter === "no_due_date";

      const today = new Date();
      const dueDate = new Date(task.dueDate);
      const daysDiff = Math.ceil((dueDate - today) / (1000 * 3600 * 24));

      switch (dueDateFilter) {
        case "overdue": {
  if (daysDiff >= 0) return false;
  const s = (task.status || "").toLowerCase().replace(/[^a-z]/g, "");
  return !["done", "completed", "cancelled", "canceled"].includes(s);
}
        case "due_today":
          return daysDiff === 0;
        case "due_tomorrow":
          return daysDiff === 1;
        case "due_this_week":
          return daysDiff >= 0 && daysDiff <= 7;
        case "due_next_week":
          return daysDiff > 7 && daysDiff <= 14;
        case "due_this_month":
          return daysDiff >= 0 && daysDiff <= 30;
        case "no_due_date":
          return false;
        case "specific_date":
          return windowCalendarSpecificDate && task.dueDate === windowCalendarSpecificDate;
        default:
          return true;
      }
    })();

    return matchesSearch && matchesStatus && matchesPriority && matchesTaskType && matchesDueDate;
  });
};