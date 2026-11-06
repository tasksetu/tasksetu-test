import mongoose from "mongoose";
import Task from "../modals/taskModal.js";
import { User } from "../modals/userModal.js";
import { PerformanceReview, ReviewType, ReviewStatus } from "../modals/performanceReviewModal.js";
import { TaskChangeRequest } from "../modals/taskChangeRequestModal.js";
import { Activity } from "../models.js";
import { OrganizationHierarchy } from "../models.js";
import { TimezoneHelper } from "../utils/timezoneHelper.js";
import { NotificationService } from "../services/notificationService.js";
import { TriggerEvent, EntityType, NotificationPriority, ChannelType } from "../modals/notificationModal.js";
import ExcelJS from "exceljs";

const toObjectId = (id) => {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  return new mongoose.Types.ObjectId(String(id));
};

// Scope & Permissions Helper ────────────────────────────────────

/**
 * 👥 Recursively resolves all direct and indirect reportees under a manager.
 * Supports:
 * 1. User.managerId reference
 * 2. User.subordinates array on manager document
 * 3. OrganizationHierarchy active manager -> reporty mappings
 * Traversing recursively ensures multi-level hierarchy (Manager -> Sub-Manager -> Employee)
 * without circular loops.
 */
export async function getManagerSubordinateIdsRecursive(managerUserId, orgId) {
  if (!managerUserId) return [];
  const visited = new Set([String(managerUserId)]);
  const queue = [String(managerUserId)];
  const subordinateIds = new Set();

  const orgCondition = orgId
    ? {
        $or: [
          { organizationId: toObjectId(orgId) },
          { organization_id: toObjectId(orgId) },
          { organization: toObjectId(orgId) },
          { orgId: toObjectId(orgId) },
        ],
      }
    : null;

  const notDeletedCondition = {
    $or: [
      { isDeleted: { $exists: false } },
      { isDeleted: false },
      { is_deleted: { $exists: false } },
      { is_deleted: false },
    ],
  };

  while (queue.length > 0) {
    const currentId = queue.shift();

    // 1. Direct reports whose managerId is currentId
    const directReports = await User.find({
      $and: [
        ...(orgCondition ? [orgCondition] : []),
        notDeletedCondition,
        { managerId: toObjectId(currentId) },
      ],
    })
      .select("_id")
      .lean();

    // 2. Subordinates explicitly stored on currentId's User document
    const currentManagerDoc = await User.findById(currentId)
      .select("subordinates")
      .lean();
    const docSubordinates = (currentManagerDoc?.subordinates || []).map(String);

    // 3. OrganizationHierarchy active reporties for currentId
    const hierarchyFilter = {
      manager: toObjectId(currentId),
      status: "active",
      ...(orgId
        ? {
            $or: [
              { organization_id: toObjectId(orgId) },
              { organizationId: toObjectId(orgId) },
            ],
          }
        : {}),
    };

    let hierarchyReportyIds = [];
    try {
      const hierarchies = await OrganizationHierarchy.find(hierarchyFilter)
        .select("reporty")
        .lean();
      hierarchyReportyIds = hierarchies.map((h) => String(h.reporty)).filter(Boolean);
    } catch (hErr) {
      console.warn("⚠️ [Hierarchy] Query error:", hErr.message);
    }

    const currentLevelDirectIds = new Set([
      ...directReports.map((u) => String(u._id)),
      ...docSubordinates,
      ...hierarchyReportyIds,
    ]);

    for (const reportyId of currentLevelDirectIds) {
      if (!visited.has(reportyId)) {
        visited.add(reportyId);
        subordinateIds.add(reportyId);
        queue.push(reportyId); // Enqueue to traverse deeper reportees
      }
    }
  }

  return Array.from(subordinateIds).map((id) => toObjectId(id));
}

export async function getCallerScope(req) {
  const userId = req.user.id || req.user._id;
  const orgId = req.user.organizationId || req.user.organization_id || req.user.organization || req.user.orgId;
  const userRole = req.user.role;
  const activeRoleHeader = req.headers?.["x-active-role"] || req.query?.activeRole;

  const roles = Array.isArray(userRole) ? userRole : [userRole];

  // If activeRole is explicitly specified and valid for this user, prioritize it
  let effectiveRole = null;
  if (activeRoleHeader && roles.includes(activeRoleHeader)) {
    effectiveRole = activeRoleHeader;
  }

  const isAdmin = effectiveRole
    ? ["org_admin", "admin", "super_admin", "superadmin", "organization"].includes(effectiveRole)
    : roles.some((r) =>
        ["org_admin", "admin", "super_admin", "superadmin", "organization"].includes(r)
      );

  const isManager = effectiveRole
    ? effectiveRole === "manager"
    : (!isAdmin && roles.includes("manager"));

  const isIndividualOrEmployee = !isAdmin && !isManager;

  let accessibleUserIds = [];

  if (isAdmin) {
    // All active users in the organization
    const orgUsers = await User.find({
      $and: [
        {
          $or: [
            { organizationId: orgId },
            { organization_id: orgId },
            { organization: orgId },
            { orgId: orgId },
          ],
        },
        {
          $or: [
            { isDeleted: { $exists: false } },
            { isDeleted: false },
            { is_deleted: { $exists: false } },
            { is_deleted: false },
          ],
        },
      ],
    }).select("_id").lean();
    accessibleUserIds = orgUsers.map((u) => u._id);
  } else if (isManager) {
    // Manager: Manager themselves + full recursive subordinate team
    const teamSubordinateIds = await getManagerSubordinateIdsRecursive(userId, orgId);
    const uniqueIds = Array.from(
      new Set([String(userId), ...teamSubordinateIds.map(String)])
    ).map((id) => toObjectId(id));
    accessibleUserIds = uniqueIds;
  } else {
    // Employee / Individual: Only self
    accessibleUserIds = [toObjectId(userId)];
  }

  return {
    userId: toObjectId(userId),
    orgId: toObjectId(orgId),
    isAdmin,
    isManager,
    isIndividualOrEmployee,
    accessibleUserIds,
  };
}
 
export const getAccessibleEmployees = async (req, res) => {
  try {
    const scope = await getCallerScope(req);
    const employees = await User.find({
      _id: { $in: scope.accessibleUserIds },
      $or: [
        { isDeleted: { $exists: false } },
        { isDeleted: false },
        { is_deleted: { $exists: false } },
        { is_deleted: false },
      ],
    })
      .select("_id firstName lastName name email department designation role")
      .lean();

    const formatted = employees.map((u) => ({
      _id: u._id,
      id: u._id,
      name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.name || u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      department: u.department?.trim() || "Unassigned",
      designation: u.designation || "Employee",
      role: u.role,
    }));

    res.json({
      success: true,
      data: formatted,
      employees: formatted,
    });
  } catch (error) {
    console.error("❌ Error fetching accessible employees:", error);
    res.status(500).json({ success: false, message: "Failed to fetch accessible employees", error: error.message });
  }
};

/**
 * Parse date filter boundaries for given reporting period.
 */
export function getPeriodBoundaries(dateRange = "30", startDate = null, endDate = null, timezone = "UTC") {
  let periodStart;
  let periodEnd;

  if (startDate && endDate) {
    periodStart = new Date(startDate);
    periodEnd = new Date(endDate);
    if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
      periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      periodEnd = new Date();
    }
  } else {
    const days = parseInt(dateRange, 10) || 30;
    periodEnd = new Date();
    periodStart = new Date(periodEnd.getTime() - days * 24 * 60 * 60 * 1000);
  }

  const { startOfDay: alignedStart } = TimezoneHelper.getDayBoundaries(timezone, periodStart);
  const { endOfDay: alignedEnd } = TimezoneHelper.getDayBoundaries(timezone, periodEnd);

  const durationMs = alignedEnd.getTime() - alignedStart.getTime();
  const priorStart = new Date(alignedStart.getTime() - durationMs);
  const priorEnd = new Date(alignedStart.getTime() - 1);

  return {
    current: { start: alignedStart, end: alignedEnd },
    prior: { start: priorStart, end: priorEnd },
    durationDays: Math.max(1, Math.round(durationMs / (1000 * 60 * 60 * 24))),
  };
}

/**
 * Classify a task into one of the 6 standardized overdue buckets:
 * 1. Not Overdue
 * 2. 1-2 days
 * 3. 3-7 days
 * 4. 8-20 days
 * 5. 21-30 days
 * 6. > 30 days
 */
export function classifyOverdueBucket(overdueDays) {
  if (overdueDays <= 0) return "Not Overdue";
  if (overdueDays <= 2) return "1-2 days";
  if (overdueDays <= 7) return "3-7 days";
  if (overdueDays <= 20) return "8-20 days";
  if (overdueDays <= 30) return "21-30 days";
  return "> 30 days";
}

/**
 * Compute performance KPIs for a set of tasks in a specified period.
 */
export function calculatePerformanceKPIs(tasks, cutoffDate = new Date()) {
  const now = new Date(cutoffDate);

  let assignedCount = tasks.length;
  let completedCount = 0;
  let openCount = 0;
  let inProgressCount = 0;
  let onHoldCount = 0;
  let cancelledCount = 0;

  let completedWithDeadline = 0;
  let onTimeCompleted = 0;
  let earlyCompleted = 0;
  let lateCompleted = 0;

  let dueInPeriod = 0;
  let dueAndCompletedInPeriod = 0;

  let currentlyOverdue = 0;
  let overdueBacklogDaysTotal = 0;

  let totalDelayDays = 0;
  let totalCompletionDurationDays = 0;
  const completionDurations = [];

  const overdueBuckets = {
    "Not Overdue": 0,
    "1-2 days": 0,
    "3-7 days": 0,
    "8-20 days": 0,
    "21-30 days": 0,
    "> 30 days": 0,
  };

  tasks.forEach((t) => {
    const rawStatus = String(t.status || "").trim().toUpperCase();
    const cleanStatus = rawStatus.replace(/[\s_-]+/g, "");

    let isCompleted = ["DONE", "COMPLETED", "ACHIEVED", "RESOLVED", "CLOSED"].includes(cleanStatus);
    let isCancelled = ["CANCELLED", "CANCELED", "REJECTED"].includes(cleanStatus);
    let isOnHold = ["ONHOLD", "HOLD", "WAITING", "BLOCKED"].includes(cleanStatus);
    let isInProgress = ["INPROGRESS", "DOING"].includes(cleanStatus);
    let isOpen = ["OPEN", "TODO", "PENDING", "REOPENED"].includes(cleanStatus);

    if (!isCompleted && !isCancelled && !isOnHold && !isInProgress && !isOpen && t.systemStatus) {
      const sys = String(t.systemStatus).trim().toUpperCase().replace(/[\s_-]+/g, "");
      if (["DONE", "COMPLETED", "ACHIEVED"].includes(sys)) isCompleted = true;
      else if (["CANCELLED", "CANCELED", "REJECTED"].includes(sys)) isCancelled = true;
      else if (["ONHOLD", "HOLD", "WAITING", "BLOCKED"].includes(sys)) isOnHold = true;
      else if (["INPROGRESS", "DOING"].includes(sys)) isInProgress = true;
      else isOpen = true;
    }

    if (isCompleted) completedCount++;
    else if (isCancelled) cancelledCount++;
    else if (isOnHold) onHoldCount++;
    else if (isInProgress) inProgressCount++;
    else {
      isOpen = true;
      openCount++;
    }

    const dueDate = t.dueDate ? new Date(t.dueDate) : null;
    const hasValidDeadline = dueDate && !isNaN(dueDate.getTime());
    const completedDate = t.completedDate || t.completedAt ? new Date(t.completedDate || t.completedAt) : null;

    // Completed tasks analysis
    if (isCompleted) {
      if (completedDate && !isNaN(completedDate.getTime())) {
        const createdDate = t.createdAt ? new Date(t.createdAt) : null;
        if (createdDate && !isNaN(createdDate.getTime())) {
          const durationDays = Math.max(0, (completedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
          totalCompletionDurationDays += durationDays;
          completionDurations.push(durationDays);
        }

        if (hasValidDeadline) {
          completedWithDeadline++;
          const dueDateEOD = new Date(dueDate);
          dueDateEOD.setHours(23, 59, 59, 999);

          if (completedDate <= dueDateEOD) {
            onTimeCompleted++;
            if (dueDateEOD.getTime() - completedDate.getTime() >= 24 * 60 * 60 * 1000) {
              earlyCompleted++;
            }
          } else {
            lateCompleted++;
            const delayDays = Math.max(1, Math.ceil((completedDate.getTime() - dueDateEOD.getTime()) / (1000 * 60 * 60 * 24)));
            totalDelayDays += delayDays;
          }
        }
      } else {
        // Completed without recorded date
        if (hasValidDeadline) {
          completedWithDeadline++;
          onTimeCompleted++;
        }
      }
    }

    // Incomplete & Overdue Backlog analysis
    if (!isCompleted && !isCancelled && hasValidDeadline) {
      dueInPeriod++;
      if (dueDate < now) {
        currentlyOverdue++;
        const overdueDays = Math.max(1, Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
        overdueBacklogDaysTotal += overdueDays;
        const bucket = classifyOverdueBucket(overdueDays);
        overdueBuckets[bucket] = (overdueBuckets[bucket] || 0) + 1;
      } else {
        overdueBuckets["Not Overdue"] = (overdueBuckets["Not Overdue"] || 0) + 1;
      }
    } else if (hasValidDeadline && isCompleted) {
      dueInPeriod++;
      dueAndCompletedInPeriod++;
    }
  });

  // Median completion duration
  completionDurations.sort((a, b) => a - b);
  let medianCompletionDays = 0;
  if (completionDurations.length > 0) {
    const mid = Math.floor(completionDurations.length / 2);
    medianCompletionDays = completionDurations.length % 2 !== 0
      ? completionDurations[mid]
      : (completionDurations[mid - 1] + completionDurations[mid]) / 2;
  }

  // Calculated rates
  const onTimeCompletionRate = completedWithDeadline > 0
    ? Math.round((onTimeCompleted / completedWithDeadline) * 1000) / 10
    : 0;

  const lateCompletionRate = completedWithDeadline > 0
    ? Math.round((lateCompleted / completedWithDeadline) * 1000) / 10
    : 0;

  const dueWorkCompletionRate = dueInPeriod > 0
    ? Math.round((dueAndCompletedInPeriod / dueInPeriod) * 1000) / 10
    : 0;

  const avgDelayDays = lateCompleted > 0
    ? Math.round((totalDelayDays / lateCompleted) * 10) / 10
    : 0;

  const avgCompletionDurationDays = completedCount > 0
    ? Math.round((totalCompletionDurationDays / completedCount) * 10) / 10
    : 0;

  const avgOverdueDurationDays = currentlyOverdue > 0
    ? Math.round((overdueBacklogDaysTotal / currentlyOverdue) * 10) / 10
    : 0;

  return {
    totalAssigned: assignedCount,
    totalAssignedInPeriod: assignedCount,
    completedCount,
    totalCompleted: completedCount,
    totalCompletedInPeriod: completedCount,
    completedTasks: completedCount,
    openTasks: openCount,
    openCount,
    inProgressTasks: inProgressCount,
    inProgressCount,
    onHoldTasks: onHoldCount,
    onHoldCount,
    blockedTasks: onHoldCount,
    cancelledTasks: cancelledCount,
    cancelledCount,
    completedWithDeadline,
    completedOnTime: onTimeCompleted,
    onTimeCompleted,
    completedEarly: earlyCompleted,
    earlyCompleted,
    completedLate: lateCompleted,
    lateCompleted,
    currentlyOverdue,
    dueInPeriod,
    totalDueInPeriod: dueInPeriod,
    dueAndCompletedInPeriod,
    onTimeCompletionRate,
    onTimeRate: onTimeCompletionRate,
    lateCompletionRate,
    dueWorkCompletionRate,
    avgDelayDays,
    avgDelayHours: Math.round(avgDelayDays * 24 * 10) / 10,
    avgCompletionDurationDays,
    avgCompletionHours: Math.round(avgCompletionDurationDays * 24 * 10) / 10,
    medianCompletionDays: Math.round(medianCompletionDays * 10) / 10,
    medianCompletionHours: Math.round(medianCompletionDays * 24 * 10) / 10,
    avgOverdueDurationDays,
    avgOverdueDays: avgOverdueDurationDays,
    deadlineExtensionsCount: tasks.reduce((acc, t) => acc + ((t.dueDateHistory || []).filter((h) => h.isApprovedExtension).length || 0), 0),
    reworkCount: tasks.reduce((acc, t) => acc + ((t.reworkHistory || []).length || 0), 0),
    overdueBuckets,
  };
}

// ─── 1. ORGANIZATION & OVERVIEW PERFORMANCE ────────────────────────────────

/**
 * GET /api/reports/performance/overview
 * Organization / Team overview with period comparisons, KPIs, and breakdowns.
 */
export const getPerformanceOverview = async (req, res) => {
  try {
    const scope = await getCallerScope(req);
    const { dateRange = "30", startDate, endDate, department, employeeId } = req.query;

    const userTimezone = await TimezoneHelper.getUserTimezone(scope.userId);
    const boundaries = getPeriodBoundaries(dateRange, startDate, endDate, userTimezone);

    // Build base query scoped by tenant and permissions
    const andConditions = [
      {
        $or: [
          { isDeleted: { $exists: false } },
          { isDeleted: false },
          { is_deleted: { $exists: false } },
          { is_deleted: false },
        ],
      },
    ];

    if (scope.orgId) {
      andConditions.push({
        $or: [
          { organization: scope.orgId },
          { organizationId: scope.orgId },
          { organization_id: scope.orgId },
        ],
      });
    }

    if (!scope.isAdmin) {
      andConditions.push({ assignedTo: { $in: scope.accessibleUserIds } });
    }

    if (employeeId && mongoose.isValidObjectId(employeeId)) {
      if (!scope.isAdmin && !scope.accessibleUserIds.some((id) => String(id) === String(employeeId))) {
        return res.status(403).json({ success: false, message: "Access denied to employee data." });
      }
      andConditions.push({ assignedTo: toObjectId(employeeId) });
    }

    if (department && department !== "all") {
      const deptUsers = await User.find({
        $or: [{ organizationId: scope.orgId }, { organization_id: scope.orgId }, { organization: scope.orgId }],
        department,
      }).select("_id").lean();
      const deptUserIds = deptUsers.map((u) => u._id);
      andConditions.push({
        assignedTo: {
          $in: deptUserIds.filter((id) => scope.isAdmin || scope.accessibleUserIds.some((accId) => String(accId) === String(id))),
        },
      });
    }

    // Active or in-period filter
    const activeOrInPeriodCurrent = [
      { createdAt: { $gte: boundaries.current.start, $lte: boundaries.current.end } },
      { dueDate: { $gte: boundaries.current.start, $lte: boundaries.current.end } },
      { completedDate: { $gte: boundaries.current.start, $lte: boundaries.current.end } },
      { completedAt: { $gte: boundaries.current.start, $lte: boundaries.current.end } },
      { updatedAt: { $gte: boundaries.current.start, $lte: boundaries.current.end } },
      {
        status: {
          $in: [
            "OPEN", "open", "Open", "TODO", "todo", "PENDING", "pending", "REOPENED", "reopened",
            "INPROGRESS", "inprogress", "IN_PROGRESS", "in_progress", "In Progress", "DOING", "doing",
            "ONHOLD", "onhold", "ON_HOLD", "on_hold", "On Hold", "HOLD", "hold", "WAITING", "waiting", "BLOCKED", "blocked",
          ],
        },
      },
    ];

    const currentQuery = {
      $and: [...andConditions, { $or: activeOrInPeriodCurrent }],
    };

    const priorQuery = {
      $and: [
        ...andConditions,
        {
          $or: [
            { createdAt: { $gte: boundaries.prior.start, $lte: boundaries.prior.end } },
            { dueDate: { $gte: boundaries.prior.start, $lte: boundaries.prior.end } },
            { completedDate: { $gte: boundaries.prior.start, $lte: boundaries.prior.end } },
            { completedAt: { $gte: boundaries.prior.start, $lte: boundaries.prior.end } },
            { updatedAt: { $gte: boundaries.prior.start, $lte: boundaries.prior.end } },
          ],
        },
      ],
    };

    const [currentTasks, priorTasks] = await Promise.all([
      Task.find(currentQuery)
        .select("title status priority dueDate originalDueDate createdAt completedDate completedAt assignedTo isRisk dueDateHistory reworkHistory")
        .populate("assignedTo", "firstName lastName name email department")
        .lean(),
      Task.find(priorQuery)
        .select("title status priority dueDate originalDueDate createdAt completedDate completedAt assignedTo isRisk dueDateHistory reworkHistory")
        .lean(),
    ]);

    const currentKPIs = calculatePerformanceKPIs(currentTasks, boundaries.current.end);
    const priorKPIs = calculatePerformanceKPIs(priorTasks, boundaries.prior.end);

    const calculateDelta = (current, prior) => {
      const diff = current - prior;
      const pct = prior > 0 ? Math.round((diff / prior) * 1000) / 10 : (current > 0 ? 100 : 0);
      return { diff: Math.round(diff * 10) / 10, percentage: pct };
    };

    const comparison = {
      totalAssigned: calculateDelta(currentKPIs.totalAssigned, priorKPIs.totalAssigned),
      completedCount: calculateDelta(currentKPIs.completedCount, priorKPIs.completedCount),
      onTimeCompletionRate: calculateDelta(currentKPIs.onTimeCompletionRate, priorKPIs.onTimeCompletionRate),
      currentlyOverdue: calculateDelta(currentKPIs.currentlyOverdue, priorKPIs.currentlyOverdue),
      avgDelayDays: calculateDelta(currentKPIs.avgDelayDays, priorKPIs.avgDelayDays),
      dueWorkCompletionRate: calculateDelta(currentKPIs.dueWorkCompletionRate, priorKPIs.dueWorkCompletionRate),
    };

    const priorPeriodDelta = {
      assignedDiff: comparison.totalAssigned.diff,
      assignedPercentage: comparison.totalAssigned.percentage,
      onTimeRateDiff: comparison.onTimeCompletionRate.diff,
      completedDiff: comparison.completedCount.diff,
      overdueDiff: comparison.currentlyOverdue.diff,
      ...comparison,
    };

    // Completion and on-time adherence trend for current period
    const trendBuckets = [];
    const intervalDays = boundaries.durationDays > 60 ? 14 : boundaries.durationDays > 14 ? 7 : 1;
    let cursor = new Date(boundaries.current.start);

    while (cursor <= boundaries.current.end) {
      const next = new Date(cursor.getTime() + intervalDays * 24 * 60 * 60 * 1000);
      const segmentTasks = currentTasks.filter((t) => {
        const d = t.completedDate || t.completedAt || t.createdAt;
        if (!d) return false;
        const time = new Date(d).getTime();
        return time >= cursor.getTime() && time < next.getTime();
      });

      const completed = segmentTasks.filter((t) => ["DONE", "COMPLETED"].includes(String(t.status).toUpperCase())).length;
      const onTime = segmentTasks.filter((t) => {
        if (!["DONE", "COMPLETED"].includes(String(t.status).toUpperCase()) || !t.dueDate) return false;
        const comp = new Date(t.completedDate || t.completedAt || t.updatedAt);
        const due = new Date(t.dueDate);
        due.setHours(23, 59, 59, 999);
        return comp <= due;
      }).length;

      trendBuckets.push({
        date: cursor.toISOString().split("T")[0],
        label: cursor.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        total: segmentTasks.length,
        completed,
        onTime,
        late: Math.max(0, completed - onTime),
        onTimeRate: completed > 0 ? Math.round((onTime / completed) * 100) : 0,
      });

      cursor = next;
    }

    // Workload breakdown by priority
    const priorityLoad = [
      { priority: "urgent", label: "Urgent / Critical", count: currentTasks.filter((t) => (t.priority || "").toLowerCase() === "urgent").length },
      { priority: "high", label: "High", count: currentTasks.filter((t) => (t.priority || "").toLowerCase() === "high").length },
      { priority: "medium", label: "Medium", count: currentTasks.filter((t) => (t.priority || "medium").toLowerCase() === "medium").length },
      { priority: "low", label: "Low", count: currentTasks.filter((t) => (t.priority || "").toLowerCase() === "low").length },
    ];

    const workload = {
      urgent: priorityLoad[0].count,
      high: priorityLoad[1].count,
      medium: priorityLoad[2].count,
      low: priorityLoad[3].count,
    };

    res.json({
      success: true,
      data: {
        period: {
          current: {
            start: boundaries.current.start,
            end: boundaries.current.end,
            days: boundaries.durationDays,
          },
          prior: {
            start: boundaries.prior.start,
            end: boundaries.prior.end,
          },
        },
        kpis: currentKPIs,
        priorKpis: priorKPIs,
        comparison,
        priorPeriodDelta,
        trends: trendBuckets,
        trend: trendBuckets,
        workload,
        priorityLoad,
        overdueBuckets: currentKPIs.overdueBuckets,
        tasks: currentTasks,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching performance overview:", error);
    res.status(500).json({ success: false, message: "Failed to fetch performance overview", error: error.message });
  }
};

// ─── 2. TEAM PERFORMANCE & MEMBER COMPARISON ───────────────────────────────

/**
 * GET /api/reports/performance/team
 * Team performance breakdown by department and team member.
 */
export const getTeamPerformance = async (req, res) => {
  try {
    const scope = await getCallerScope(req);
    if (scope.isIndividualOrEmployee) {
      return res.status(403).json({ success: false, message: "Manager or Admin access required." });
    }

    const { dateRange = "30", startDate, endDate, department } = req.query;
    const userTimezone = await TimezoneHelper.getUserTimezone(scope.userId);
    const boundaries = getPeriodBoundaries(dateRange, startDate, endDate, userTimezone);

    const userFilter = {
      _id: { $in: scope.accessibleUserIds },
      $or: [
        { isDeleted: { $exists: false } },
        { isDeleted: false },
        { is_deleted: { $exists: false } },
        { is_deleted: false },
      ],
    };

    if (department && department !== "all") {
      userFilter.department = department;
    }

    const teamUsers = await User.find(userFilter)
      .select("_id firstName lastName name email department designation role")
      .lean();

    const userIds = teamUsers.map((u) => u._id);

    const tasks = await Task.find({
      assignedTo: { $in: userIds },
      $and: [
        {
          $or: [
            { isDeleted: { $exists: false } },
            { isDeleted: false },
            { is_deleted: { $exists: false } },
            { is_deleted: false },
          ],
        },
        ...(scope.orgId
          ? [
              {
                $or: [
                  { organization: scope.orgId },
                  { organizationId: scope.orgId },
                  { organization_id: scope.orgId },
                ],
              },
            ]
          : []),
        {
          $or: [
            { createdAt: { $gte: boundaries.current.start, $lte: boundaries.current.end } },
            { dueDate: { $gte: boundaries.current.start, $lte: boundaries.current.end } },
            { completedDate: { $gte: boundaries.current.start, $lte: boundaries.current.end } },
            { completedAt: { $gte: boundaries.current.start, $lte: boundaries.current.end } },
            { updatedAt: { $gte: boundaries.current.start, $lte: boundaries.current.end } },
            {
              status: {
                $in: [
                  "OPEN", "open", "Open", "TODO", "todo", "PENDING", "pending", "REOPENED", "reopened",
                  "INPROGRESS", "inprogress", "IN_PROGRESS", "in_progress", "In Progress", "DOING", "doing",
                  "ONHOLD", "onhold", "ON_HOLD", "on_hold", "On Hold", "HOLD", "hold", "WAITING", "waiting", "BLOCKED", "blocked",
                ],
              },
            },
          ],
        },
      ],
    })
      .select("title status priority dueDate originalDueDate createdAt completedDate completedAt assignedTo dueDateHistory reworkHistory")
      .lean();

    const userMetrics = teamUsers.map((u) => {
      const uTasks = tasks.filter((t) => String(t.assignedTo) === String(u._id));
      const kpis = calculatePerformanceKPIs(uTasks, boundaries.current.end);
      const name = `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.name || u.email;

      const onTimeWeight = (kpis.onTimeCompletionRate || 0) * 0.5;
      const dueWorkWeight = (kpis.dueWorkCompletionRate || 0) * 0.3;
      const overduePenalty = Math.min(20, (kpis.currentlyOverdue || 0) * 4);
      const score = Math.max(0, Math.min(100, Math.round(onTimeWeight + dueWorkWeight + (20 - overduePenalty))));

      return {
        id: u._id,
        _id: u._id,
        name,
        email: u.email,
        department: u.department?.trim() || "Unassigned",
        designation: u.designation || "Team Member",
        role: u.role,
        score,
        performanceScore: score,
        assigned: kpis.totalAssigned,
        completed: kpis.completedCount,
        onTimeRate: kpis.onTimeCompletionRate,
        dueWorkRate: kpis.dueWorkCompletionRate,
        overdue: kpis.currentlyOverdue,
        reworkCount: kpis.reworkCount,
        metrics: kpis,
      };
    });

    userMetrics.sort((a, b) => b.score - a.score);

    const departmentMap = {};
    userMetrics.forEach((um) => {
      const dept = um.department;
      if (!departmentMap[dept]) {
        departmentMap[dept] = {
          department: dept,
          memberCount: 0,
          totalTasks: 0,
          totalAssigned: 0,
          completedCount: 0,
          overdueCount: 0,
          currentlyOverdue: 0,
          onTimeRate: 0,
          avgOnTimeRate: 0,
          rates: [],
        };
      }
      departmentMap[dept].memberCount++;
      departmentMap[dept].totalTasks += um.metrics.totalAssigned;
      departmentMap[dept].totalAssigned += um.metrics.totalAssigned;
      departmentMap[dept].completedCount += um.metrics.completedCount;
      departmentMap[dept].overdueCount += um.metrics.currentlyOverdue;
      departmentMap[dept].currentlyOverdue += um.metrics.currentlyOverdue;
      if (um.metrics.completedWithDeadline > 0) {
        departmentMap[dept].rates.push(um.metrics.onTimeCompletionRate);
      }
    });

    const departmentSummary = Object.values(departmentMap).map((d) => ({
      department: d.department,
      memberCount: d.memberCount,
      totalTasks: d.totalTasks,
      totalAssigned: d.totalAssigned,
      completedCount: d.completedCount,
      overdueCount: d.overdueCount,
      currentlyOverdue: d.currentlyOverdue,
      onTimeRate: d.rates.length > 0 ? Math.round((d.rates.reduce((a, b) => a + b, 0) / d.rates.length) * 10) / 10 : 0,
      avgOnTimeRate: d.rates.length > 0 ? Math.round((d.rates.reduce((a, b) => a + b, 0) / d.rates.length) * 10) / 10 : 0,
    }));

    res.json({
      success: true,
      data: {
        totalTeamMembers: teamUsers.length,
        departmentSummary,
        departmentBreakdown: departmentSummary,
        members: userMetrics,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching team performance:", error);
    res.status(500).json({ success: false, message: "Failed to fetch team performance", error: error.message });
  }
};

// ─── 3. INDIVIDUAL EMPLOYEE PERFORMANCE DETAIL ─────────────────────────────

/**
 * GET /api/reports/performance/employee/:employeeId
 * Dedicated employee performance detail view with historical accuracy,
 * deadline extensions, task table, and performance reviews.
 */
export const getEmployeePerformanceDetail = async (req, res) => {
  try {
    const scope = await getCallerScope(req);
    const { employeeId } = req.params;
    const { dateRange = "30", startDate, endDate, status, priority } = req.query;

    if (!mongoose.isValidObjectId(employeeId)) {
      return res.status(400).json({ success: false, message: "Invalid employee ID." });
    }

    const isSelf = String(scope.userId) === String(employeeId);
    const hasAccess = scope.isAdmin || isSelf || scope.accessibleUserIds.some((id) => String(id) === String(employeeId));

    if (!hasAccess) {
      return res.status(403).json({ success: false, message: "Access denied to this employee's performance report." });
    }

    const employee = await User.findById(employeeId)
      .select("firstName lastName name email department designation role status managerId profileImageUrl createdAt")
      .populate("managerId", "firstName lastName email")
      .lean();

    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found." });
    }

    const userTimezone = await TimezoneHelper.getUserTimezone(employeeId);
    const boundaries = getPeriodBoundaries(dateRange, startDate, endDate, userTimezone);

    const activeOrInPeriodEmp = [
      { createdAt: { $gte: boundaries.current.start, $lte: boundaries.current.end } },
      { dueDate: { $gte: boundaries.current.start, $lte: boundaries.current.end } },
      { completedDate: { $gte: boundaries.current.start, $lte: boundaries.current.end } },
      { completedAt: { $gte: boundaries.current.start, $lte: boundaries.current.end } },
      { updatedAt: { $gte: boundaries.current.start, $lte: boundaries.current.end } },
      {
        status: {
          $in: [
            "OPEN", "open", "Open", "TODO", "todo", "PENDING", "pending", "REOPENED", "reopened",
            "INPROGRESS", "inprogress", "IN_PROGRESS", "in_progress", "In Progress", "DOING", "doing",
            "ONHOLD", "onhold", "ON_HOLD", "on_hold", "On Hold", "HOLD", "hold", "WAITING", "waiting", "BLOCKED", "blocked",
          ],
        },
      },
    ];

    const taskQuery = {
      $and: [
        { assignedTo: toObjectId(employeeId) },
        {
          $or: [
            { isDeleted: { $exists: false } },
            { isDeleted: false },
            { is_deleted: { $exists: false } },
            { is_deleted: false },
          ],
        },
        { $or: activeOrInPeriodEmp },
      ],
    };

    if (status && status !== "all") {
      taskQuery.$and.push({ status: status });
    }
    if (priority && priority !== "all") {
      taskQuery.$and.push({ priority: priority });
    }

    const tasks = await Task.find(taskQuery)
      .select(
        "title description status priority dueDate originalDueDate createdAt completedDate completedAt dueDateHistory statusHistory assignmentHistory reworkHistory blockedPeriods"
      )
      .sort({ createdAt: -1 })
      .lean();

    const kpis = calculatePerformanceKPIs(tasks, boundaries.current.end);

    let tasksWithExtensions = 0;
    let totalExtensionsCount = 0;
    tasks.forEach((t) => {
      const extCount = (t.dueDateHistory || []).filter((h) => h.isApprovedExtension).length;
      if (extCount > 0) {
        tasksWithExtensions++;
        totalExtensionsCount += extCount;
      }
    });

    const reviews = await PerformanceReview.find({
      employeeId: toObjectId(employeeId),
      organizationId: scope.orgId || employee.organization_id,
    })
      .populate("reviewerId", "firstName lastName email")
      .sort({ createdAt: -1 })
      .lean();

    const taskRows = tasks.map((t) => {
      const isDone = ["DONE", "COMPLETED"].includes(String(t.status).toUpperCase());
      const dueDate = t.dueDate ? new Date(t.dueDate) : null;
      const completedDate = t.completedDate || t.completedAt ? new Date(t.completedDate || t.completedAt) : null;
      const now = new Date();

      let delayDays = 0;
      let isOnTime = null;
      let isOverdue = false;
      let completionStatus = "PENDING";

      if (isDone) {
        if (completedDate && dueDate) {
          const dueDateEOD = new Date(dueDate);
          dueDateEOD.setHours(23, 59, 59, 999);
          isOnTime = completedDate <= dueDateEOD;
          if (isOnTime) {
            completionStatus = (dueDateEOD.getTime() - completedDate.getTime() >= 24 * 60 * 60 * 1000)
              ? "EARLY"
              : "ON_TIME";
          } else {
            completionStatus = "LATE";
            delayDays = Math.max(1, Math.ceil((completedDate.getTime() - dueDateEOD.getTime()) / (1000 * 60 * 60 * 24)));
          }
        } else {
          completionStatus = "ON_TIME";
        }
      } else if (dueDate && dueDate < now) {
        isOverdue = true;
        completionStatus = "OVERDUE";
        delayDays = Math.max(1, Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      } else {
        completionStatus = String(t.status || "open").toUpperCase();
      }

      return {
        _id: t._id,
        id: t._id,
        title: t.title,
        description: t.description || "",
        status: t.status,
        priority: t.priority || "medium",
        createdAt: t.createdAt,
        dueDate: t.dueDate,
        originalDueDate: t.originalDueDate || t.dueDate,
        completedDate,
        isOnTime,
        isOverdue,
        delayDays,
        completionStatus,
        overdueBucket: isOverdue ? classifyOverdueBucket(delayDays) : "Not Overdue",
        extensionsCount: (t.dueDateHistory || []).filter((h) => h.isApprovedExtension).length,
        hasRework: (t.reworkHistory || []).length > 0,
        hasBlockedPeriods: (t.blockedPeriods || []).length > 0,
      };
    });

    res.json({
      success: true,
      data: {
        employee: {
          id: employee._id,
          _id: employee._id,
          name: `${employee.firstName || ""} ${employee.lastName || ""}`.trim() || employee.name || employee.email,
          email: employee.email,
          department: employee.department || "Unassigned",
          designation: employee.designation || "Employee",
          role: employee.role,
          manager: employee.managerId
            ? {
                id: employee.managerId._id,
                _id: employee.managerId._id,
                name: `${employee.managerId.firstName || ""} ${employee.managerId.lastName || ""}`.trim() || employee.managerId.email,
                email: employee.managerId.email,
              }
            : null,
          managerName: employee.managerId
            ? `${employee.managerId.firstName || ""} ${employee.managerId.lastName || ""}`.trim() || employee.managerId.email
            : "Direct",
          joinedAt: employee.createdAt,
        },
        kpis: {
          ...kpis,
          totalAssigned: kpis.totalAssigned,
          totalCompleted: kpis.completedCount,
          onTimeRate: kpis.onTimeCompletionRate,
          completedOnTime: kpis.onTimeCompleted,
          completedLate: kpis.lateCompleted,
          currentlyOverdue: kpis.currentlyOverdue,
          deadlineExtensionsCount: totalExtensionsCount,
          tasksWithExtensions,
        },
        tasks: taskRows,
        reviews,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching employee performance detail:", error);
    res.status(500).json({ success: false, message: "Failed to fetch employee performance detail", error: error.message });
  }
};

// ─── 4. OVERDUE TASK ANALYSIS ──────────────────────────────────────────────

/**
 * GET /api/reports/performance/overdue
 * Overdue distribution across 6 age buckets with drill-down task records.
 */
export const getOverdueTaskAnalysis = async (req, res) => {
  try {
    const scope = await getCallerScope(req);
    const { bucket, priority, department, employeeId } = req.query;

    const now = new Date();

    const andConditions = [
      {
        $or: [
          { isDeleted: { $exists: false } },
          { isDeleted: false },
          { is_deleted: { $exists: false } },
          { is_deleted: false },
        ],
      },
      {
        status: {
          $nin: ["DONE", "COMPLETED", "CANCELLED", "REJECTED", "done", "completed", "cancelled", "rejected"],
        },
      },
      {
        dueDate: { $lt: now, $ne: null },
      },
    ];

    if (scope.orgId) {
      andConditions.push({
        $or: [
          { organization: scope.orgId },
          { organizationId: scope.orgId },
          { organization_id: scope.orgId },
        ],
      });
    }

    if (!scope.isAdmin) {
      andConditions.push({ assignedTo: { $in: scope.accessibleUserIds } });
    }

    if (employeeId && mongoose.isValidObjectId(employeeId)) {
      andConditions.push({ assignedTo: toObjectId(employeeId) });
    }

    if (priority && priority !== "all") {
      andConditions.push({ priority: priority.toLowerCase() });
    }

    if (department && department !== "all") {
      const deptUsers = await User.find({
        $or: [{ organizationId: scope.orgId }, { organization_id: scope.orgId }, { organization: scope.orgId }],
        department,
      }).select("_id").lean();
      const deptUserIds = deptUsers.map((u) => u._id);
      andConditions.push({ assignedTo: { $in: deptUserIds } });
    }

    const tasks = await Task.find({ $and: andConditions })
      .select("title status priority dueDate originalDueDate createdAt assignedTo createdBy dueDateHistory")
      .populate("assignedTo", "firstName lastName name email department")
      .populate("createdBy", "firstName lastName name email")
      .lean();

    const bucketCounts = {
      "Not Overdue": 0,
      "1-2 days": 0,
      "3-7 days": 0,
      "8-20 days": 0,
      "21-30 days": 0,
      "> 30 days": 0,
    };

    const mappedTasks = tasks.map((t) => {
      const overdueDays = Math.max(1, Math.ceil((now.getTime() - new Date(t.dueDate).getTime()) / (1000 * 60 * 60 * 24)));
      const assignedName = t.assignedTo
        ? `${t.assignedTo.firstName || ""} ${t.assignedTo.lastName || ""}`.trim() || t.assignedTo.name || t.assignedTo.email
        : "Unassigned";

      const taskBucket = classifyOverdueBucket(overdueDays);
      bucketCounts[taskBucket] = (bucketCounts[taskBucket] || 0) + 1;

      return {
        _id: t._id,
        id: t._id,
        title: t.title,
        status: t.status,
        priority: t.priority || "medium",
        dueDate: t.dueDate,
        originalDueDate: t.originalDueDate || t.dueDate,
        createdAt: t.createdAt,
        overdueDays,
        bucketKey: taskBucket,
        bucket: taskBucket,
        assignee: {
          id: t.assignedTo?._id,
          name: assignedName,
          email: t.assignedTo?.email,
          department: t.assignedTo?.department?.trim() || "Unassigned",
        },
        createdBy: {
          id: t.createdBy?._id,
          name: `${t.createdBy?.firstName || ""} ${t.createdBy?.lastName || ""}`.trim() || t.createdBy?.name || t.createdBy?.email,
        },
      };
    });

    const totalOverdueCount = mappedTasks.length;
    const bucketArray = [
      { key: "1-2 days", label: "1-2 days", count: bucketCounts["1-2 days"] || 0, percentage: totalOverdueCount > 0 ? Math.round(((bucketCounts["1-2 days"] || 0) / totalOverdueCount) * 100) : 0 },
      { key: "3-7 days", label: "3-7 days", count: bucketCounts["3-7 days"] || 0, percentage: totalOverdueCount > 0 ? Math.round(((bucketCounts["3-7 days"] || 0) / totalOverdueCount) * 100) : 0 },
      { key: "8-20 days", label: "8-20 days", count: bucketCounts["8-20 days"] || 0, percentage: totalOverdueCount > 0 ? Math.round(((bucketCounts["8-20 days"] || 0) / totalOverdueCount) * 100) : 0 },
      { key: "21-30 days", label: "21-30 days", count: bucketCounts["21-30 days"] || 0, percentage: totalOverdueCount > 0 ? Math.round(((bucketCounts["21-30 days"] || 0) / totalOverdueCount) * 100) : 0 },
      { key: "> 30 days", label: "> 30 days", count: bucketCounts["> 30 days"] || 0, percentage: totalOverdueCount > 0 ? Math.round(((bucketCounts["> 30 days"] || 0) / totalOverdueCount) * 100) : 0 },
    ];

    let filteredTasks = mappedTasks;
    if (bucket && bucket !== "ALL" && bucket !== "all") {
      filteredTasks = mappedTasks.filter((t) => t.bucketKey === bucket || t.bucket === bucket);
    }

    filteredTasks.sort((a, b) => b.overdueDays - a.overdueDays);

    res.json({
      success: true,
      data: {
        totalOverdue: mappedTasks.length,
        buckets: bucketArray,
        bucketCounts,
        tasks: filteredTasks,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching overdue task analysis:", error);
    res.status(500).json({ success: false, message: "Failed to fetch overdue task analysis", error: error.message });
  }
};

// ─── 5. TASK AUDIT TIMELINE ────────────────────────────────────────────────

/**
 * GET /api/reports/performance/task-audit/:taskId
 * Returns complete unified audit timeline for a task.
 */
export const getTaskAuditTimeline = async (req, res) => {
  try {
    const { taskId } = req.params;
    if (!mongoose.isValidObjectId(taskId)) {
      return res.status(400).json({ success: false, message: "Invalid task ID." });
    }

    const task = await Task.findById(taskId)
      .populate({ path: "assignedTo", select: "firstName lastName name email department", strictPopulate: false })
      .populate({ path: "createdBy", select: "firstName lastName name email", strictPopulate: false })
      .populate({ path: "dueDateHistory.changedBy", select: "firstName lastName name email", strictPopulate: false })
      .populate({ path: "statusHistory.changedBy", select: "firstName lastName name email", strictPopulate: false })
      .populate({ path: "assignmentHistory.changedBy", select: "firstName lastName name email", strictPopulate: false })
      .populate({ path: "assignmentHistory.oldAssignee", select: "firstName lastName name email", strictPopulate: false })
      .populate({ path: "assignmentHistory.newAssignee", select: "firstName lastName name email", strictPopulate: false })
      .populate({ path: "priorityHistory.changedBy", select: "firstName lastName name email", strictPopulate: false })
      .populate({ path: "reworkHistory.returnedBy", select: "firstName lastName name email", strictPopulate: false })
      .populate({ path: "blockedPeriods.markedBy", select: "firstName lastName name email", strictPopulate: false })
      .lean();

    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found." });
    }

    // Verify caller permissions: Org admins see all org tasks; Managers see own + team tasks
    const scope = await getCallerScope(req);
    if (!scope.isAdmin) {
      const assignedToId = task.assignedTo?._id || task.assignedTo;
      const createdById = task.createdBy?._id || task.createdBy;
      const isAccessible =
        scope.accessibleUserIds.some((id) => String(id) === String(assignedToId)) ||
        String(scope.userId) === String(createdById);

      if (!isAccessible) {
        return res.status(403).json({
          success: false,
          message: "Access denied to this task's audit timeline.",
        });
      }
    }

    const timeline = [];
    const seenEventKeys = new Set();

    const addEvent = (event) => {
      const timeMs = event.timestamp ? new Date(event.timestamp).getTime() : 0;
      const key = `${event.type}_${timeMs}_${event.title}`;
      if (!seenEventKeys.has(key)) {
        seenEventKeys.add(key);
        timeline.push(event);
      }
    };

    // 1. Creation event
    addEvent({
      type: "TASK_CREATED",
      title: "Task Created",
      timestamp: task.createdAt,
      actor: task.createdBy
        ? `${task.createdBy.firstName || ""} ${task.createdBy.lastName || ""}`.trim() ||
          task.createdBy.name ||
          task.createdBy.email
        : "System",
      details: {
        initialStatus: task.status,
        initialPriority: task.priority,
        initialDueDate: task.originalDueDate || task.dueDate,
        assignedTo: task.assignedTo
          ? `${task.assignedTo.firstName || ""} ${task.assignedTo.lastName || ""}`.trim() ||
            task.assignedTo.name ||
            task.assignedTo.email
          : "Unassigned",
      },
    });

    // 2. Deadline changes
    (task.dueDateHistory || []).forEach((h) => {
      const actorName = h.changedBy
        ? `${h.changedBy.firstName || ""} ${h.changedBy.lastName || ""}`.trim() ||
          h.changedBy.name ||
          h.changedBy.email
        : "Manager";
      addEvent({
        type: h.isApprovedExtension ? "DEADLINE_EXTENDED" : "DEADLINE_CHANGED",
        title: h.isApprovedExtension ? "Deadline Extension Approved" : "Deadline Changed",
        timestamp: h.changedAt,
        actor: actorName,
        details: {
          oldDueDate: h.oldDueDate,
          newDueDate: h.newDueDate,
          reason: h.reason,
          isApproved: h.isApprovedExtension,
        },
      });
    });

    // 3. Status transitions
    (task.statusHistory || []).forEach((s) => {
      const actorName = s.changedBy
        ? `${s.changedBy.firstName || ""} ${s.changedBy.lastName || ""}`.trim() ||
          s.changedBy.name ||
          s.changedBy.email
        : "User";
      addEvent({
        type: "STATUS_CHANGED",
        title: `Status Changed to ${s.newStatus}`,
        timestamp: s.changedAt,
        actor: actorName,
        details: {
          oldStatus: s.oldStatus,
          newStatus: s.newStatus,
          reason: s.reason,
        },
      });
    });

    // 4. Reassignments
    (task.assignmentHistory || []).forEach((a) => {
      const actorName = a.changedBy
        ? `${a.changedBy.firstName || ""} ${a.changedBy.lastName || ""}`.trim() ||
          a.changedBy.name ||
          a.changedBy.email
        : "Manager";
      const oldName = a.oldAssignee
        ? `${a.oldAssignee.firstName || ""} ${a.oldAssignee.lastName || ""}`.trim() ||
          a.oldAssignee.name ||
          a.oldAssignee.email
        : "Previous Assignee";
      const newName = a.newAssignee
        ? `${a.newAssignee.firstName || ""} ${a.newAssignee.lastName || ""}`.trim() ||
          a.newAssignee.name ||
          a.newAssignee.email
        : "New Assignee";
      addEvent({
        type: "REASSIGNED",
        title: `Task Reassigned to ${newName}`,
        timestamp: a.changedAt,
        actor: actorName,
        details: {
          oldAssignee: oldName,
          newAssignee: newName,
          reason: a.reason,
        },
      });
    });

    // 5. Priority changes
    (task.priorityHistory || []).forEach((p) => {
      const actorName = p.changedBy
        ? `${p.changedBy.firstName || ""} ${p.changedBy.lastName || ""}`.trim() ||
          p.changedBy.name ||
          p.changedBy.email
        : "Manager";
      addEvent({
        type: "PRIORITY_CHANGED",
        title: `Priority Changed to ${p.newPriority}`,
        timestamp: p.changedAt,
        actor: actorName,
        details: {
          oldPriority: p.oldPriority,
          newPriority: p.newPriority,
          reason: p.reason,
        },
      });
    });

    // 6. Rework & Quality returns
    (task.reworkHistory || []).forEach((r) => {
      const actorName = r.returnedBy
        ? `${r.returnedBy.firstName || ""} ${r.returnedBy.lastName || ""}`.trim() ||
          r.returnedBy.name ||
          r.returnedBy.email
        : "Reviewer";
      addEvent({
        type: "REWORK_RETURNED",
        title: "Task Returned for Rework",
        timestamp: r.returnedAt,
        actor: actorName,
        details: {
          previousStatus: r.previousStatus,
          reason: r.reason,
          defects: r.defectsFound,
        },
      });
    });

    // 7. Blocked periods
    (task.blockedPeriods || []).forEach((b) => {
      const actorName = b.markedBy
        ? `${b.markedBy.firstName || ""} ${b.markedBy.lastName || ""}`.trim() ||
          b.markedBy.name ||
          b.markedBy.email
        : "User";
      addEvent({
        type: "TASK_BLOCKED",
        title: "Task Marked Blocked / On-Hold",
        timestamp: b.blockedAt,
        actor: actorName,
        details: {
          reason: b.reason,
          unblockedAt: b.unblockedAt,
          durationHours: b.unblockedAt
            ? Math.round(
                (new Date(b.unblockedAt).getTime() - new Date(b.blockedAt).getTime()) /
                  (1000 * 60 * 60)
              )
            : "Ongoing",
        },
      });
    });

    // 8. Fetch Activities for this task and include in timeline
    try {
      const activities = await Activity.find({ relatedId: task._id })
        .populate({ path: "user", select: "firstName lastName name email", strictPopulate: false })
        .sort({ createdAt: 1 })
        .lean();

      for (const act of activities) {
        const actor = act.user
          ? `${act.user.firstName || ""} ${act.user.lastName || ""}`.trim() ||
            act.user.name ||
            act.user.email
          : "User";
        const desc = act.description || "";
        const metaData = act.metadata?.data || {};

        if (desc.includes("created")) {
          // Task creation already registered
          continue;
        } else if (desc.includes("status changed")) {
          addEvent({
            type: "STATUS_CHANGED",
            title: desc,
            timestamp: act.createdAt,
            actor,
            details: {
              oldStatus: metaData.oldValue,
              newStatus: metaData.newValue,
            },
          });
        } else if (desc.includes("assignedTo") || desc.includes("reassigned")) {
          addEvent({
            type: "REASSIGNED",
            title: desc,
            timestamp: act.createdAt,
            actor,
            details: {
              changes: metaData.changes,
            },
          });
        } else if (desc.includes("due date") || desc.includes("deadline")) {
          addEvent({
            type: "DEADLINE_CHANGED",
            title: desc,
            timestamp: act.createdAt,
            actor,
            details: {
              oldDueDate: metaData.oldDueDate || metaData.oldValue,
              newDueDate: metaData.newDueDate || metaData.newValue,
            },
          });
        } else {
          addEvent({
            type: "ACTIVITY_LOGGED",
            title: desc || "Task Activity Updated",
            timestamp: act.createdAt,
            actor,
            details: metaData,
          });
        }
      }
    } catch (actErr) {
      console.warn("Could not fetch activities for task audit:", actErr);
    }

    // Sort timeline chronologically (latest first or earliest first - earliest first is best for story)
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    res.json({
      success: true,
      data: {
        task: {
          id: task._id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          currentDueDate: task.dueDate,
          originalDueDate: task.originalDueDate || task.dueDate,
          completedDate: task.completedDate || task.completedAt,
        },
        timeline,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching task audit timeline:", error);
    res.status(500).json({ success: false, message: "Failed to fetch task audit timeline", error: error.message });
  }
};

// ─── 6. PERFORMANCE REVIEWS, REWARDS & NOTICES ─────────────────────────────

/**
 * GET /api/reports/performance/reviews
 * List performance reviews scoped by permissions.
 */
export const getPerformanceReviews = async (req, res) => {
  try {
    const scope = await getCallerScope(req);
    const { employeeId, reviewType, status } = req.query;

    const query = { organizationId: scope.orgId };

    if (scope.isIndividualOrEmployee) {
      query.employeeId = scope.userId;
    } else if (!scope.isAdmin) {
      query.$or = [{ employeeId: { $in: scope.accessibleUserIds } }, { reviewerId: scope.userId }];
    }

    if (employeeId && mongoose.isValidObjectId(employeeId)) {
      query.employeeId = toObjectId(employeeId);
    }
    if (reviewType && reviewType !== "all") {
      query.reviewType = reviewType;
    }
    if (status && status !== "all") {
      query.status = status;
    }

    const reviews = await PerformanceReview.find(query)
      .populate("employeeId", "firstName lastName name email department designation")
      .populate("reviewerId", "firstName lastName name email")
      .sort({ createdAt: -1 })
      .lean();

    const mapped = reviews.map((r) => {
      const empName = r.employeeId ? `${r.employeeId.firstName || ""} ${r.employeeId.lastName || ""}`.trim() || r.employeeId.name || r.employeeId.email : "Employee";
      const revName = r.reviewerId ? `${r.reviewerId.firstName || ""} ${r.reviewerId.lastName || ""}`.trim() || r.reviewerId.name || r.reviewerId.email : "Manager";

      return {
        ...r,
        employee: {
          _id: r.employeeId?._id,
          id: r.employeeId?._id,
          name: empName,
          email: r.employeeId?.email,
          department: r.employeeId?.department,
        },
        reviewer: {
          _id: r.reviewerId?._id,
          id: r.reviewerId?._id,
          name: revName,
          email: r.reviewerId?.email,
        },
        employeeAcknowledged: Boolean(r.employeeResponse?.acknowledged),
        employeeAcknowledgedAt: r.employeeResponse?.acknowledgedAt,
        employeeResponse: r.employeeResponse?.response || "",
      };
    });

    res.json({
      success: true,
      data: mapped,
      reviews: mapped,
    });
  } catch (error) {
    console.error("❌ Error fetching performance reviews:", error);
    res.status(500).json({ success: false, message: "Failed to fetch performance reviews", error: error.message });
  }
};

/**
 * POST /api/reports/performance/reviews
 * Create a new documented Performance Review, Recognition, or Notice.
 */
export const createPerformanceReview = async (req, res) => {
  try {
    const scope = await getCallerScope(req);
    if (scope.isIndividualOrEmployee) {
      return res.status(403).json({ success: false, message: "Only managers or admins can issue performance reviews." });
    }

    const {
      reviewType = ReviewType.REVIEW,
      employeeId,
      period,
      positiveAchievements,
      missedCommitments = [],
      workloadAndBlockerContext,
      improvementObjectives = [],
      managerComments,
      privateManagerNotes,
      recognitionDetails,
      noticeDetails,
      followUpDate,
    } = req.body;

    if (!employeeId || !mongoose.isValidObjectId(employeeId)) {
      return res.status(400).json({ success: false, message: "Valid employee ID is required." });
    }

    if (!period || !period.startDate || !period.endDate) {
      return res.status(400).json({ success: false, message: "Evaluation period with start and end dates is required." });
    }

    const employee = await User.findById(employeeId).lean();
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found." });
    }

    const review = new PerformanceReview({
      reviewType,
      employeeId,
      reviewerId: scope.userId,
      organizationId: scope.orgId || employee.organization_id,
      period: {
        startDate: new Date(period.startDate),
        endDate: new Date(period.endDate),
        periodType: period.periodType || "monthly",
      },
      positiveAchievements: positiveAchievements || "",
      missedCommitments,
      workloadAndBlockerContext: workloadAndBlockerContext || "",
      improvementObjectives,
      managerComments: managerComments || "",
      privateManagerNotes: privateManagerNotes || "",
      recognitionDetails: recognitionDetails || {},
      noticeDetails: noticeDetails || {},
      followUpDate: followUpDate ? new Date(followUpDate) : null,
      status: ReviewStatus.SUBMITTED,
      auditHistory: [
        {
          action: "CREATED",
          performedBy: scope.userId,
          performedAt: new Date(),
          notes: `Created ${reviewType} for ${employee.firstName} ${employee.lastName}`,
        },
      ],
    });

    await review.save();

    // Trigger Notification for the employee
    try {
      const typeLabel = reviewType === ReviewType.RECOGNITION
        ? "Performance Recognition"
        : reviewType === ReviewType.NOTICE
          ? "Performance Notice"
          : "Performance Review";

      await NotificationService.createNotification({
        user_id: employee._id,
        trigger_event: TriggerEvent.TASK_UPDATED,
        related_entity: {
          entity_type: EntityType.SYSTEM,
          entity_id: review._id,
          entity_name: typeLabel,
        },
        title: `New ${typeLabel} Documented`,
        message: `Your manager has documented a ${typeLabel.toLowerCase()} for the period ${new Date(period.startDate).toLocaleDateString()} - ${new Date(period.endDate).toLocaleDateString()}. Please review and acknowledge.`,
        priority: reviewType === ReviewType.NOTICE ? NotificationPriority.URGENT : NotificationPriority.NORMAL,
        channels: [ChannelType.IN_APP],
        metadata: {
          reviewId: review._id,
          reviewType,
        },
      });
    } catch (notifErr) {
      console.error("⚠️ Failed to dispatch review notification:", notifErr);
    }

    res.status(201).json({ success: true, data: review, message: "Performance document created successfully." });
  } catch (error) {
    console.error("❌ Error creating performance review:", error);
    res.status(500).json({ success: false, message: "Failed to create performance review", error: error.message });
  }
};

/**
 * PATCH /api/reports/performance/reviews/:id/acknowledge
 * Employee formal acknowledgement or response to a review/notice.
 */
export const acknowledgePerformanceReview = async (req, res) => {
  try {
    const scope = await getCallerScope(req);
    const { id } = req.params;
    const { response = "" } = req.body;

    const review = await PerformanceReview.findById(id);
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found." });
    }

    // Only the target employee can acknowledge
    if (String(review.employeeId) !== String(scope.userId)) {
      return res.status(403).json({ success: false, message: "Only the evaluated employee can acknowledge this review." });
    }

    review.employeeResponse = {
      response: response.trim(),
      acknowledged: true,
      acknowledgedAt: new Date(),
    };
    review.status = ReviewStatus.ACKNOWLEDGED;

    review.auditHistory.push({
      action: "ACKNOWLEDGED",
      performedBy: scope.userId,
      performedAt: new Date(),
      notes: "Employee submitted formal response and acknowledged review",
    });

    await review.save();

    // Notify reviewer
    try {
      const employee = await User.findById(scope.userId).select("firstName lastName").lean();
      const empName = employee ? `${employee.firstName} ${employee.lastName}`.trim() : "Employee";

      await NotificationService.createNotification({
        user_id: review.reviewerId,
        trigger_event: TriggerEvent.TASK_UPDATED,
        related_entity: {
          entity_type: EntityType.SYSTEM,
          entity_id: review._id,
          entity_name: "Performance Review",
        },
        title: `Performance Review Acknowledged`,
        message: `${empName} has formally acknowledged the performance review.`,
        priority: NotificationPriority.NORMAL,
        channels: [ChannelType.IN_APP],
        metadata: {
          reviewId: review._id,
        },
      });
    } catch (notifErr) {
      console.error("⚠️ Failed to dispatch review acknowledgement notification:", notifErr);
    }

    res.json({ success: true, data: review, message: "Review acknowledged successfully." });
  } catch (error) {
    console.error("❌ Error acknowledging performance review:", error);
    res.status(500).json({ success: false, message: "Failed to acknowledge review", error: error.message });
  }
};

// ─── 7. EXPORT PERFORMANCE REPORT (CSV / EXCEL) ────────────────────────────

/**
 * GET /api/reports/performance/export
 * Exports performance report data to XLSX or CSV format.
 */
export const exportPerformanceReport = async (req, res) => {
  try {
    const scope = await getCallerScope(req);
    const { format = "xlsx", dateRange = "30", startDate, endDate, department } = req.query;

    const userTimezone = await TimezoneHelper.getUserTimezone(scope.userId);
    const boundaries = getPeriodBoundaries(dateRange, startDate, endDate, userTimezone);

    const andConditions = [
      {
        $or: [
          { isDeleted: { $exists: false } },
          { isDeleted: false },
          { is_deleted: { $exists: false } },
          { is_deleted: false },
        ],
      },
    ];

    if (scope.orgId) {
      andConditions.push({
        $or: [
          { organization: scope.orgId },
          { organizationId: scope.orgId },
          { organization_id: scope.orgId },
        ],
      });
    }

    if (!scope.isAdmin) {
      andConditions.push({ assignedTo: { $in: scope.accessibleUserIds } });
    }

    if (department && department !== "all") {
      const deptUsers = await User.find({
        $or: [{ organizationId: scope.orgId }, { organization_id: scope.orgId }, { organization: scope.orgId }],
        department,
      }).select("_id").lean();
      andConditions.push({ assignedTo: { $in: deptUsers.map((u) => u._id) } });
    }

    const tasks = await Task.find({ $and: andConditions })
      .select("title status priority dueDate originalDueDate createdAt completedDate completedAt assignedTo dueDateHistory reworkHistory")
      .populate("assignedTo", "firstName lastName name email department")
      .lean();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "TaskSetu Reporting";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Performance Report");

    worksheet.columns = [
      { header: "Task Title", key: "title", width: 35 },
      { header: "Assignee", key: "assignee", width: 25 },
      { header: "Department", key: "department", width: 20 },
      { header: "Status", key: "status", width: 15 },
      { header: "Priority", key: "priority", width: 12 },
      { header: "Created Date", key: "createdAt", width: 15 },
      { header: "Original Due Date", key: "originalDueDate", width: 18 },
      { header: "Final Due Date", key: "dueDate", width: 18 },
      { header: "Completed Date", key: "completedDate", width: 18 },
      { header: "Timeliness", key: "timeliness", width: 15 },
      { header: "Overdue Days", key: "overdueDays", width: 15 },
      { header: "Extensions Count", key: "extensionsCount", width: 16 },
    ];

    const now = new Date();

    tasks.forEach((t) => {
      const isDone = ["DONE", "COMPLETED"].includes(String(t.status).toUpperCase());
      const dueDate = t.dueDate ? new Date(t.dueDate) : null;
      const completedDate = t.completedDate || t.completedAt ? new Date(t.completedDate || t.completedAt) : null;

      let timeliness = "Pending";
      let overdueDays = 0;

      if (isDone) {
        if (completedDate && dueDate) {
          const dueDateEOD = new Date(dueDate);
          dueDateEOD.setHours(23, 59, 59, 999);
          timeliness = completedDate <= dueDateEOD ? "On-Time" : "Late";
        } else {
          timeliness = "Completed";
        }
      } else if (dueDate && dueDate < now) {
        timeliness = "Overdue";
        overdueDays = Math.max(1, Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      }

      worksheet.addRow({
        title: t.title,
        assignee: t.assignedTo ? `${t.assignedTo.firstName || ""} ${t.assignedTo.lastName || ""}`.trim() || t.assignedTo.name || t.assignedTo.email : "Unassigned",
        department: t.assignedTo?.department?.trim() || "Unassigned",
        status: t.status,
        priority: t.priority || "Medium",
        createdAt: t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "—",
        originalDueDate: t.originalDueDate ? new Date(t.originalDueDate).toLocaleDateString() : "—",
        dueDate: t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—",
        completedDate: completedDate ? completedDate.toLocaleDateString() : "—",
        timeliness,
        overdueDays: overdueDays > 0 ? overdueDays : "—",
        extensionsCount: (t.dueDateHistory || []).filter((h) => h.isApprovedExtension).length,
      });
    });

    const isCsv = format.toLowerCase() === "csv";
    const filename = `TaskSetu_Performance_Report_${boundaries.current.start.toISOString().split("T")[0]}_${boundaries.current.end.toISOString().split("T")[0]}.${isCsv ? "csv" : "xlsx"}`;

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    if (isCsv) {
      res.setHeader("Content-Type", "text/csv");
      await workbook.csv.write(res);
    } else {
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      await workbook.xlsx.write(res);
    }

    res.end();
  } catch (error) {
    console.error("❌ Error exporting performance report:", error);
    res.status(500).json({ success: false, message: "Failed to export report", error: error.message });
  }
};
