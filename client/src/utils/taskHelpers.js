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

export const checkTaskMatchesDueDateFilter = (
  task,
  dueDateFilter,
  windowCalendarSpecificDate = null
) => {
  if (!dueDateFilter || dueDateFilter === "all") return true;

  const rawDueDate = task?.dueDate;
  if (!rawDueDate || rawDueDate === "No due date" || rawDueDate === "Not set") {
    return false;
  }

  let d;
  if (rawDueDate instanceof Date) {
    d = rawDueDate;
  } else {
    const str = String(rawDueDate).trim();
    const hasTimezone =
      /[Zz]$|(T\d{2}:\d{2}(:\d{2})?(\.[0-9]+)?[+-]\d{2}:?\d{2})$/.test(str);
    d = new Date(hasTimezone ? str : str + "Z");
  }
  if (isNaN(d.getTime())) return false;

  // The backend stores the user's local date/time directly as UTC (e.g. 2026-10-18T12:08:00.000Z for 18 Oct 12:08 PM).
  // TaskTable formats using d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate().
  const dueYear = d.getUTCFullYear();
  const dueMonth = d.getUTCMonth();
  const dueDateNum = d.getUTCDate();

  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const startOfDue = new Date(dueYear, dueMonth, dueDateNum);

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysDiff = Math.round(
    (startOfDue.getTime() - startOfToday.getTime()) / msPerDay
  );

  switch (dueDateFilter) {
    case "overdue": {
      const s = (task.status || "").toLowerCase().replace(/[^a-z]/g, "");
      if (
        [
          "done",
          "completed",
          "cancelled",
          "canceled",
          "approved",
          "rejected",
          "terminated",
        ].includes(s)
      ) {
        return false;
      }
      const displayNow = new Date(
        Date.UTC(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          today.getHours(),
          today.getMinutes(),
          today.getSeconds()
        )
      );
      return d < displayNow || d < today || daysDiff < 0;
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
      return (
        daysDiff >= 0 &&
        ((startOfDue.getFullYear() === startOfToday.getFullYear() &&
          startOfDue.getMonth() === startOfToday.getMonth()) ||
          daysDiff <= 30)
      );
    case "specific_date": {
      if (!windowCalendarSpecificDate) return true;
      const target = new Date(windowCalendarSpecificDate);
      if (isNaN(target.getTime())) return false;
      return (
        dueYear === target.getFullYear() &&
        dueMonth === target.getMonth() &&
        dueDateNum === target.getDate()
      );
    }
    case "no_due_date":
      return false;
    default:
      return true;
  }
};

export const applyFiltering = (tasks, filters) => {
  const {
    searchTerm,
    statusFilter,
    priorityFilter,
    taskTypeFilter,
    dueDateFilter,
    windowCalendarSpecificDate,
    assigneeFilter,
    assigneeFilterName,
    completedTodayFilter,
  } = filters;

  return tasks.filter((task) => {
    // Filter by specific assignee if filter is active
    if (assigneeFilter && assigneeFilter !== "all") {
      const targetId = String(assigneeFilter);
      const directAssigneeId = String(
        task.assigneeId ||
        task.assignedTo?._id ||
        task.assignedTo?.id ||
        task.assignedTo ||
        ""
      );
      const matchesDirect = directAssigneeId === targetId;

      const matchesDirectName =
        assigneeFilterName &&
        typeof task.assignee === "string" &&
        task.assignee.toLowerCase().includes(assigneeFilterName.toLowerCase());

      const matchesSubtasks =
        Array.isArray(task.subtasks) &&
        task.subtasks.some((st) => {
          const subAssigneeId = String(
            st.assigneeId ||
            st.assignedTo?._id ||
            st.assignedTo?.id ||
            st.assignedTo ||
            ""
          );
          if (subAssigneeId === targetId) return true;
          if (assigneeFilterName && typeof st.assignee === "string") {
            return st.assignee.toLowerCase().includes(assigneeFilterName.toLowerCase());
          }
          return false;
        });

      if (!matchesDirect && !matchesDirectName && !matchesSubtasks) {
        return false;
      }
    }

    const matchesSearch =
      !searchTerm ||
      task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.assignee?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = (() => {
      if (!statusFilter || statusFilter === "all") return true;
      const sTask = String(task.status || "").trim().toUpperCase();
      const sFilter = String(statusFilter || "").trim().toUpperCase();
      if (sTask === sFilter) return true;
      if (["DONE", "COMPLETED"].includes(sFilter) && ["DONE", "COMPLETED"].includes(sTask)) return true;
      if (["INPROGRESS", "IN_PROGRESS", "DOING"].includes(sFilter) && ["INPROGRESS", "IN_PROGRESS", "DOING"].includes(sTask)) return true;
      if (["CANCELLED", "CANCELED"].includes(sFilter) && ["CANCELLED", "CANCELED"].includes(sTask)) return true;
      return false;
    })();

    const matchesPriority =
      priorityFilter === "all" ||
      task.priority?.toLowerCase() === priorityFilter.toLowerCase();
    const matchesTaskType =
      taskTypeFilter === "all" || getTaskType(task) === taskTypeFilter;

    const matchesDueDate = checkTaskMatchesDueDateFilter(
      task,
      dueDateFilter,
      windowCalendarSpecificDate
    );

    const matchesCompletedToday = (() => {
      if (!completedTodayFilter) return true;
      const s = (task.status || "").toUpperCase();
      if (!["DONE", "COMPLETED"].includes(s)) return false;
      const cd = task.completedDate || task.completedAt;
      if (!cd) return false;
      const d = new Date(cd);
      const now = new Date();
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    })();

    return (
      matchesSearch &&
      matchesStatus &&
      matchesPriority &&
      matchesTaskType &&
      matchesDueDate &&
      matchesCompletedToday
    );
  });
};

export const getCreatorRole = (task) => {
  if (!task) return "employee";

  const allRoles = [];

  const addRoles = (val) => {
    if (!val) return;
    if (Array.isArray(val)) {
      val.forEach((r) => {
        if (typeof r === "string" && r.trim()) allRoles.push(r.toLowerCase().trim());
      });
    } else if (typeof val === "string" && val.trim()) {
      allRoles.push(val.toLowerCase().trim());
    }
  };

  // 1. Populated createdBy user object roles
  if (task.createdBy && typeof task.createdBy === "object") {
    addRoles(task.createdBy.role);
    addRoles(task.createdBy.roles);
    addRoles(task.createdBy.activeRole);
  }

  // 2. Direct createdByRole and creatorRole fields on task
  addRoles(task.createdByRole);
  addRoles(task.creatorRole);

  // 3. Resolve role by hierarchy
  if (allRoles.length > 0) {
    if (allRoles.some((r) => ["super_admin", "super-admin", "tasksetu-admin"].includes(r))) return "super_admin";
    if (allRoles.some((r) => ["org_admin", "org-admin", "admin", "company-admin"].includes(r))) return "org_admin";
    if (allRoles.includes("manager")) return "manager";
    if (allRoles.includes("employee")) return "employee";
    if (allRoles.includes("individual")) return "individual";
    return allRoles[0];
  }

  return "employee";
};

export const getCreatorDisplayName = (task) => {
  if (!task) return "";
  if (task.createdBy && typeof task.createdBy === "object") {
    const first = task.createdBy.firstName || "";
    const last = task.createdBy.lastName || "";
    const full = `${first} ${last}`.trim();
    if (full) return full;
    if (task.createdBy.name) return task.createdBy.name;
    if (task.createdBy.email) return task.createdBy.email;
  }
  if (typeof task.createdBy === "string" && task.createdBy.length > 0 && !/^[0-9a-fA-F]{24}$/.test(task.createdBy)) {
    return task.createdBy;
  }
  if (task.creatorName) return task.creatorName;
  return "";
};

export const getCreatorRoleInfo = (task) => {
  const role = getCreatorRole(task);
  const creatorName = getCreatorDisplayName(task);

  const roleMeta = {
    super_admin: {
      role: "super_admin",
      label: "Super Admin",
      shortLabel: "Super Admin",
      colorClass: "bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200",
      badgeClass: "bg-rose-50 text-rose-700 border-rose-300",
    },
    org_admin: {
      role: "org_admin",
      label: "Org Admin",
      shortLabel: "Org Admin",
      colorClass: "bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200",
      badgeClass: "bg-purple-50 text-purple-700 border-purple-300",
    },
    manager: {
      role: "manager",
      label: "Manager",
      shortLabel: "Manager",
      colorClass: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200",
      badgeClass: "bg-blue-50 text-blue-700 border-blue-300",
    },
    employee: {
      role: "employee",
      label: "Employee",
      shortLabel: "Employee",
      colorClass: "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-300",
    },
    individual: {
      role: "individual",
      label: "Individual",
      shortLabel: "Individual",
      colorClass: "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200",
      badgeClass: "bg-amber-50 text-amber-700 border-amber-300",
    },
  };

  const meta = roleMeta[role] || roleMeta.employee;

  const tooltip = creatorName
    ? `Created by ${creatorName} (${meta.label})`
    : `Created by ${meta.label}`;

  return {
    ...meta,
    creatorName,
    tooltip,
  };
};