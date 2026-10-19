import Task from "../modals/taskModal.js";
import { User } from "../modals/userModal.js";
import { QuickTask } from "../modals/quickTaskModal.js";
import { MilestoneTask } from "../modals/milestoneTaskModal.js";
import { TimezoneHelper } from "../utils/timezoneHelper.js";
import { getManagerSubordinateIds } from "../controller/taskController.js";
import mongoose from "mongoose";

/**
 * High-performance aggregated dashboard service for TaskSetu.
 * Resolves role, organizational scope, and executes optimized MongoDB aggregations
 * with zero N+1 query loops.
 */
export async function getAggregatedDashboardData(user, query = {}) {
  const userId = user.id || user._id;
  const userOrgId = user.organizationId || user.organization_id;
  const userRoles = Array.isArray(user.role) ? user.role : [user.role || "employee"];

  // 1. Resolve effective role securely
  const requestedRole = (query.activeRole || "").toLowerCase();
  let effectiveRole = "employee";

  const isSuperAdmin = userRoles.some(r => ["super_admin", "superadmin"].includes(String(r).toLowerCase()));
  const isOrgAdmin = userRoles.some(r => ["org_admin", "admin", "company_admin", "owner"].includes(String(r).toLowerCase()));
  const isManager = userRoles.some(r => String(r).toLowerCase() === "manager");
  const isIndividual = userRoles.some(r => String(r).toLowerCase() === "individual");

  if (requestedRole) {
    if (requestedRole === "org_admin" && (isOrgAdmin || isSuperAdmin)) {
      effectiveRole = "org_admin";
    } else if (requestedRole === "manager" && (isManager || isOrgAdmin || isSuperAdmin)) {
      effectiveRole = "manager";
    } else if (requestedRole === "individual" && (isIndividual || isOrgAdmin || isSuperAdmin)) {
      effectiveRole = "individual";
    } else if (requestedRole === "employee") {
      effectiveRole = "employee";
    } else if (isOrgAdmin || isSuperAdmin) {
      effectiveRole = "org_admin";
    } else if (isManager) {
      effectiveRole = "manager";
    } else if (isIndividual) {
      effectiveRole = "individual";
    } else {
      effectiveRole = "employee";
    }
  } else {
    if (isSuperAdmin || isOrgAdmin) effectiveRole = "org_admin";
    else if (isManager) effectiveRole = "manager";
    else if (isIndividual) effectiveRole = "individual";
    else effectiveRole = "employee";
  }

  // 2. Timezone & date boundaries
  const userTimezone = await TimezoneHelper.getUserTimezone(userId);
  const { startOfDay: todayStart, endOfDay: todayEnd } = TimezoneHelper.getDayBoundaries(userTimezone);
  const now = new Date();
  const local = TimezoneHelper.getLocalTime(userTimezone);
  const localNowAsUtc = new Date(Date.UTC(
    local.year,
    local.month - 1,
    local.dayOfMonth,
    local.hours,
    local.minutes,
    local.seconds
  ));
  const effectiveNow = localNowAsUtc > now ? localNowAsUtc : now;

  // Selected time range for trends (7d, 30d, thisMonth, all)
  const timeRange = query.timeRange || "7d";
  let rangeDays = 7;
  if (timeRange === "30d") rangeDays = 30;
  else if (timeRange === "90d" || timeRange === "all") rangeDays = 90;

  const rangeStartDate = new Date(todayEnd.getTime());
  rangeStartDate.setDate(rangeStartDate.getDate() - (rangeDays - 1));
  rangeStartDate.setHours(0, 0, 0, 0);

  // Month boundaries for calendar
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // 3. Build role-based scope filter
  const baseScope = {
    isDeleted: { $ne: true },
    is_deleted: { $ne: true },
    isSubtask: { $ne: true },
    $and: [
      {
        $or: [
          { isParentRecurring: { $ne: true } },
          { isParentRecurring: { $exists: false } },
        ],
      },
    ],
  };

  let teamMemberIds = [];

  const getOrgFilter = (orgId) => {
    if (!orgId) return null;
    const orgStr = String(orgId);
    const orgObj = mongoose.Types.ObjectId.isValid(orgStr)
      ? new mongoose.Types.ObjectId(orgStr)
      : null;
    return orgObj ? { $in: [orgObj, orgStr] } : orgStr;
  };

  if (effectiveRole === "org_admin" || effectiveRole === "super_admin") {
    if (userOrgId) {
      baseScope.organization = getOrgFilter(userOrgId);
    }
  } else if (effectiveRole === "manager") {
    if (userOrgId) {
      baseScope.organization = getOrgFilter(userOrgId);
    }
    const subordinateIds = await getManagerSubordinateIds(userId, userOrgId);
    teamMemberIds = [String(userId), ...(subordinateIds || []).map(String)];
    const memberObjIds = teamMemberIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    const allMemberIds = Array.from(new Set([...memberObjIds, ...teamMemberIds]));

    // Manager sees only self and their direct employee tasks
    baseScope.$or = [
      { assignedTo: { $in: allMemberIds } },
      { createdBy: { $in: allMemberIds } },
    ];
  } else if (effectiveRole === "employee") {
    if (userOrgId) {
      baseScope.organization = getOrgFilter(userOrgId);
    }
    const userObjId = mongoose.Types.ObjectId.isValid(String(userId))
      ? new mongoose.Types.ObjectId(String(userId))
      : null;
    const allUserIds = userObjId ? [userObjId, String(userId)] : [String(userId)];
    baseScope.$or = [
      { assignedTo: { $in: allUserIds } },
      { createdBy: { $in: allUserIds } },
    ];
  } else {
    // Individual role
    const userObjId = mongoose.Types.ObjectId.isValid(String(userId))
      ? new mongoose.Types.ObjectId(String(userId))
      : null;
    const allUserIds = userObjId ? [userObjId, String(userId)] : [String(userId)];
    baseScope.$or = [
      { assignedTo: { $in: allUserIds } },
      { createdBy: { $in: allUserIds } },
    ];
  }

  // 4. Primary MongoDB aggregation ($facet) for counts, KPIs, task list & calendar
  const facetResult = await Task.aggregate([
    { $match: baseScope },
    {
      $facet: {
        // Status counts for Donut chart
        statusCounts: [
          {
            $group: {
              _id: { $toUpper: "$status" },
              count: { $sum: 1 },
            },
          },
        ],
        // Priority counts
        priorityCounts: [
          {
            $group: {
              _id: { $toLower: "$priority" },
              count: { $sum: 1 },
            },
          },
        ],
        // Task type counts
        typeCounts: [
          {
            $group: {
              _id: "$taskType",
              count: { $sum: 1 },
            },
          },
        ],
        // Aggregated KPI numbers
        kpis: [
          {
            $group: {
              _id: null,
              totalTasks: { $sum: 1 },
              completedTasks: {
                $sum: {
                  $cond: [
                    { $in: [{ $toUpper: "$status" }, ["DONE", "COMPLETED"]] },
                    1,
                    0,
                  ],
                },
              },
              openTasks: {
                $sum: {
                  $cond: [
                    { $in: [{ $toUpper: "$status" }, ["OPEN", "PENDING", "TODO"]] },
                    1,
                    0,
                  ],
                },
              },
              inProgressTasks: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        { $toUpper: "$status" },
                        ["INPROGRESS", "IN_PROGRESS", "DOING"],
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              completedToday: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $in: [{ $toUpper: "$status" }, ["DONE", "COMPLETED"]] },
                        { $gte: ["$completedDate", todayStart] },
                        { $lte: ["$completedDate", todayEnd] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              dueToday: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gte: ["$dueDate", todayStart] },
                        { $lte: ["$dueDate", todayEnd] },
                        {
                          $not: {
                            $in: [
                              { $toUpper: "$status" },
                              ["DONE", "COMPLETED", "CANCELLED"],
                            ],
                          },
                        },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              beforeDueDate: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gt: ["$dueDate", effectiveNow] },
                        { $gt: ["$dueDate", now] },
                        {
                          $not: {
                            $in: [
                              { $toUpper: "$status" },
                              ["DONE", "COMPLETED", "CANCELLED"],
                            ],
                          },
                        },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              pastDueDate: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ["$dueDate", null] },
                        {
                          $or: [
                            { $lt: ["$dueDate", effectiveNow] },
                            { $lt: ["$dueDate", now] },
                          ],
                        },
                        {
                          $not: {
                            $in: [
                              { $toUpper: "$status" },
                              ["DONE", "COMPLETED", "CANCELLED"],
                            ],
                          },
                        },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              highPriority: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $in: [{ $toLower: "$priority" }, ["high", "urgent"]] },
                        {
                          $not: {
                            $in: [
                              { $toUpper: "$status" },
                              ["DONE", "COMPLETED", "CANCELLED"],
                            ],
                          },
                        },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              approvalTasks: {
                $sum: {
                  $cond: [{ $eq: ["$taskType", "approval"] }, 1, 0],
                },
              },
              milestoneTasks: {
                $sum: {
                  $cond: [{ $eq: ["$taskType", "milestone"] }, 1, 0],
                },
              },
              onTimeCompleted: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $in: [{ $toUpper: "$status" }, ["DONE", "COMPLETED"]] },
                        { $ne: ["$dueDate", null] },
                        { $ne: ["$completedDate", null] },
                        { $lte: ["$completedDate", "$dueDate"] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              overdueClosed: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $in: [{ $toUpper: "$status" }, ["DONE", "COMPLETED"]] },
                        { $ne: ["$dueDate", null] },
                        { $ne: ["$completedDate", null] },
                        { $gt: ["$completedDate", "$dueDate"] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ],
        // Recent tasks for grid
        recentTasks: [
          { $sort: { createdAt: -1 } },
          { $limit: 100 },
          {
            $lookup: {
              from: "users",
              localField: "assignedTo",
              foreignField: "_id",
              as: "assigneeDoc",
            },
          },
          {
            $unwind: {
              path: "$assigneeDoc",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              _id: 1,
              title: 1,
              status: 1,
              priority: 1,
              dueDate: 1,
              createdAt: 1,
              completedDate: 1,
              progress: 1,
              taskType: 1,
              isRisk: 1,
              tags: 1,
              subtasks: 1,
              assigneeId: "$assigneeDoc._id",
              assigneeName: {
                $let: {
                  vars: {
                    fullName: {
                      $trim: {
                        input: {
                          $concat: [
                            { $ifNull: ["$assigneeDoc.firstName", ""] },
                            " ",
                            { $ifNull: ["$assigneeDoc.lastName", ""] },
                          ],
                        },
                      },
                    },
                  },
                  in: {
                    $cond: [
                      { $gt: [{ $strLenCP: "$$fullName" }, 0] },
                      "$$fullName",
                      {
                        $ifNull: [
                          "$assigneeDoc.name",
                          {
                            $ifNull: [
                              "$assigneeDoc.username",
                              { $ifNull: ["$assigneeDoc.email", "Unassigned"] },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                },
              },
              assigneeRole: "$assigneeDoc.role",
            },
          },
        ],
        // Calendar tasks for month
        calendarTasks: [
          {
            $match: {
              $or: [
                { dueDate: { $gte: currentMonthStart, $lte: currentMonthEnd } },
                { createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd } },
              ],
            },
          },
          { $limit: 100 },
          {
            $project: {
              _id: 1,
              title: 1,
              dueDate: 1,
              createdAt: 1,
              status: 1,
              taskType: 1,
            },
          },
        ],
        // Trend dates projection within range
        trendTasks: [
          {
            $match: {
              $or: [
                { createdAt: { $gte: rangeStartDate } },
                { completedDate: { $gte: rangeStartDate } },
                { dueDate: { $gte: rangeStartDate } },
                {
                  status: {
                    $nin: [
                      "DONE", "COMPLETED", "done", "completed",
                      "CANCELLED", "CANCELED", "cancelled", "canceled",
                      "REJECTED", "rejected",
                    ],
                  },
                },
              ],
            },
          },
          { $limit: 2000 },
          {
            $project: {
              _id: 1,
              title: 1,
              createdAt: 1,
              completedDate: 1,
              dueDate: 1,
              status: 1,
              taskType: 1,
              updatedAt: 1,
            },
          },
        ],
      },
    },
  ]);

  const raw = facetResult[0] || {};
  const kpiData = raw.kpis?.[0] || {};

  // 5. Construct Status Donut Chart values
  const statusMap = new Map((raw.statusCounts || []).map((s) => [s._id, s.count]));
  const openCount = (statusMap.get("OPEN") || 0) + (statusMap.get("PENDING") || 0) + (statusMap.get("TODO") || 0);
  const inProgressCount = (statusMap.get("INPROGRESS") || 0) + (statusMap.get("IN_PROGRESS") || 0) + (statusMap.get("DOING") || 0);
  const completedCount = (statusMap.get("DONE") || 0) + (statusMap.get("COMPLETED") || 0);
  const overdueCount = kpiData.pastDueDate || 0;
  const openTasks = kpiData.openTasks ?? openCount;
  const totalTasks = kpiData.totalTasks || (openCount + inProgressCount + completedCount);

  const taskStatusDonut = [
    {
      name: "Open",
      status: "OPEN",
      value: openCount,
      percentage: totalTasks > 0 ? Math.round((openCount / totalTasks) * 100) : 0,
      color: "#3B82F6",
    },
    {
      name: "In Progress",
      status: "INPROGRESS",
      value: inProgressCount,
      percentage: totalTasks > 0 ? Math.round((inProgressCount / totalTasks) * 100) : 0,
      color: "#F59E0B",
    },
    {
      name: "Completed",
      status: "DONE",
      value: completedCount,
      percentage: totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0,
      color: "#10B981",
    },
    {
      name: "Overdue",
      status: "OVERDUE",
      value: overdueCount,
      percentage: totalTasks > 0 ? Math.round((overdueCount / totalTasks) * 100) : 0,
      color: "#EF4444",
    },
  ];

  // 6. Construct Task Overview Trend Chart (Created, Completed, Due, Overdue per day)
  const trendDays = [];
  const trendTasks = raw.trendTasks || [];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const today = new Date();

  for (let i = rangeDays - 1; i >= 0; i--) {
    const curDate = new Date(today);
    curDate.setDate(curDate.getDate() - i);
    const y = curDate.getFullYear();
    const m = curDate.getMonth();
    const dt = curDate.getDate();

    const dStart = new Date(y, m, dt, 0, 0, 0, 0);
    const dEnd = new Date(y, m, dt, 23, 59, 59, 999);
    const dateKey = `${String(dt).padStart(2, "0")} ${monthNames[m]}`;
    const fullDate = `${y}-${String(m + 1).padStart(2, "0")}-${String(dt).padStart(2, "0")}`;

    let created = 0;
    let completed = 0;
    let due = 0;
    let overdue = 0;
    let pending = 0;
    let cancelled = 0;

    for (const t of trendTasks) {
      const s = (t.status || "").toUpperCase();
      const isDone = ["DONE", "COMPLETED"].includes(s);
      const isCancelled = ["CANCELLED", "CANCELED", "REJECTED"].includes(s);

      const cDate = t.createdAt ? new Date(t.createdAt) : null;
      const compDate = t.completedDate ? new Date(t.completedDate) : null;
      const dueDate = t.dueDate ? new Date(t.dueDate) : null;

      // Created on this day
      if (cDate && cDate >= dStart && cDate <= dEnd) {
        created++;
      }

      // Completed on this day
      if (compDate && isDone && compDate >= dStart && compDate <= dEnd) {
        completed++;
      }

      // Due on this day
      if (dueDate && dueDate >= dStart && dueDate <= dEnd) {
        due++;
      }

      // Pending on this day (created on or before dEnd and not done/cancelled on or before dEnd)
      if (cDate && cDate <= dEnd) {
        const wasDoneBeforeOrOn = compDate && isDone && compDate <= dEnd;
        const wasCancelledBeforeOrOn = isCancelled && (t.updatedAt ? new Date(t.updatedAt) : cDate) <= dEnd;
        if (!wasDoneBeforeOrOn && !wasCancelledBeforeOrOn) {
          pending++;
        }
      }

      // Overdue on this day (due on or before dEnd and not done/cancelled on or before dEnd)
      if (dueDate && dueDate < dEnd) {
        const wasDoneBeforeOrOn = compDate && isDone && compDate <= dEnd;
        const wasCancelledBeforeOrOn = isCancelled && (t.updatedAt ? new Date(t.updatedAt) : cDate) <= dEnd;
        if (!wasDoneBeforeOrOn && !wasCancelledBeforeOrOn) {
          overdue++;
        }
      }

      // Cancelled on this day
      if (isCancelled) {
        const cancelDate = t.updatedAt ? new Date(t.updatedAt) : cDate;
        if (cancelDate && cancelDate >= dStart && cancelDate <= dEnd) {
          cancelled++;
        }
      }
    }

    trendDays.push({
      date: dateKey,
      fullDate,
      created,
      completed,
      due,
      overdue,
      pending,
      cancelled,
      Created: created,
      Completed: completed,
      Due: due,
      Overdue: overdue,
      Pending: pending,
      Cancelled: cancelled,
    });
  }

  // 7. Team stats & Workload by Priority for Manager & Org Admin
  let teamMembers = [];
  let workloadByPriority = [];
  let weeklyPerformance = [];

  if ((effectiveRole === "manager" || effectiveRole === "org_admin" || effectiveRole === "super_admin") && userOrgId) {
    const memberQuery = {
      organization_id: userOrgId,
      status: "active",
    };
    if (effectiveRole === "manager" && teamMemberIds.length > 0) {
      memberQuery._id = { $in: teamMemberIds };
    }

    const [allEmployees, memberAgg] = await Promise.all([
      User.find(memberQuery)
        .select("_id firstName lastName email role roles subordinates managerId department designation lastLoginAt isActive avatar profileImage")
        .lean(),
      Task.aggregate([
        {
          $match: {
            organization: new mongoose.Types.ObjectId(String(userOrgId)),
            isDeleted: { $ne: true },
            is_deleted: { $ne: true },
            isSubtask: { $ne: true },
          },
        },
        {
          $group: {
            _id: {
              assignee: "$assignedTo",
              statusUpper: { $toUpper: "$status" },
              priorityLower: { $toLower: "$priority" },
              isOverdue: {
                $and: [
                  { $ne: ["$dueDate", null] },
                  {
                    $or: [
                      { $lt: ["$dueDate", effectiveNow] },
                      { $lt: ["$dueDate", now] },
                    ],
                  },
                  { $not: { $in: [{ $toUpper: "$status" }, ["DONE", "COMPLETED", "CANCELLED"]] } },
                ],
              },
              isOnTime: {
                $and: [
                  { $in: [{ $toUpper: "$status" }, ["DONE", "COMPLETED"]] },
                  { $ne: ["$dueDate", null] },
                  { $ne: ["$completedDate", null] },
                  { $lte: ["$completedDate", "$dueDate"] },
                ],
              },
            },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Map member aggregate counts in O(N)
    const memberStatsMap = new Map();

    for (const row of memberAgg) {
      const assigneeId = row._id.assignee ? String(row._id.assignee) : null;
      if (!assigneeId) continue;

      if (!memberStatsMap.has(assigneeId)) {
        memberStatsMap.set(assigneeId, {
          activeTasks: 0,
          overdueTasks: 0,
          completedTasks: 0,
          onTimeTasks: 0,
          high: 0,
          medium: 0,
          low: 0,
        });
      }

      const stats = memberStatsMap.get(assigneeId);
      const isDone = ["DONE", "COMPLETED"].includes(row._id.statusUpper);

      if (!isDone && row._id.statusUpper !== "CANCELLED") {
        stats.activeTasks += row.count;
        if (row._id.priorityLower === "high" || row._id.priorityLower === "urgent") stats.high += row.count;
        else if (row._id.priorityLower === "medium") stats.medium += row.count;
        else stats.low += row.count;
      }

      if (row._id.isOverdue) stats.overdueTasks += row.count;
      if (isDone) {
        stats.completedTasks += row.count;
        if (row._id.isOnTime) stats.onTimeTasks += row.count;
      }
    }

    teamMembers = allEmployees.map((emp) => {
      const empIdStr = String(emp._id);
      const stats = memberStatsMap.get(empIdStr) || {
        activeTasks: 0,
        overdueTasks: 0,
        completedTasks: 0,
        onTimeTasks: 0,
        high: 0,
        medium: 0,
        low: 0,
      };

      const productivity =
        stats.completedTasks > 0
          ? Math.round((stats.onTimeTasks / stats.completedTasks) * 100)
          : 100;

      return {
        id: empIdStr,
        name: `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || "Member",
        firstName: emp.firstName || "",
        lastName: emp.lastName || "",
        email: emp.email || "",
        role: emp.role?.[0] || emp.role || "employee",
        avatar: (emp.firstName?.[0] || "") + (emp.lastName?.[0] || ""),
        managerId: emp.managerId ? String(emp.managerId) : null,
        subordinates: Array.isArray(emp.subordinates) ? emp.subordinates.map(String) : [],
        department: emp.department || null,
        designation: emp.designation || null,
        activeTasks: stats.activeTasks,
        overdueTasks: stats.overdueTasks,
        completedTasks: stats.completedTasks,
        productivity,
        status: emp.isActive ? "online" : "offline",
      };
    });

    workloadByPriority = allEmployees.map((emp) => {
      const stats = memberStatsMap.get(String(emp._id)) || { high: 0, medium: 0, low: 0, activeTasks: 0 };
      return {
        id: String(emp._id),
        name: `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || "Member",
        high: stats.high,
        medium: stats.medium,
        low: stats.low,
        total: stats.activeTasks,
      };
    });

    // 7-day weekly performance (completed vs assigned)
    weeklyPerformance = trendDays.slice(-7).map((d) => ({
      day: d.date,
      completed: d.completed,
      assigned: d.created,
    }));
  }

  // 8. Milestones & Quick Tasks
  let milestones = [];
  let quickTasksCount = 0;

  try {
    const milestoneScope = userOrgId
      ? { organization: userOrgId }
      : { creator: userId };

    const [milestoneDocs, qtCount] = await Promise.all([
      MilestoneTask.find(milestoneScope)
        .select("title dueDate status progress priority")
        .sort({ dueDate: 1 })
        .limit(10)
        .lean(),
      QuickTask.countDocuments(
        effectiveRole === "individual"
          ? { user: userId, isDeleted: { $ne: true } }
          : { organization: userOrgId, isDeleted: { $ne: true } }
      ),
    ]);

    milestones = milestoneDocs.map((m) => ({
      id: String(m._id),
      title: m.title,
      dueDate: m.dueDate ? new Date(m.dueDate).toISOString().split("T")[0] : null,
      status: m.status || "OPEN",
      progress: m.progress || 0,
      priority: m.priority || "medium",
    }));

    quickTasksCount = qtCount || 0;
  } catch (err) {
    console.warn("⚠️ Failed to load milestones or quick tasks count:", err.message);
  }

  // 9. Format Recent Task List
  const formattedTasks = (raw.recentTasks || []).map((t) => {
    const due = t.dueDate ? new Date(t.dueDate) : null;
    const isPastDue =
      due &&
      (due < effectiveNow || due < now) &&
      !["DONE", "COMPLETED", "CANCELLED"].includes((t.status || "").toUpperCase());
    const isDueToday =
      due &&
      ((due >= todayStart && due <= todayEnd) ||
        (t.dueDate && String(t.dueDate).startsWith(local.dateStr))) &&
      !["DONE", "COMPLETED", "CANCELLED"].includes((t.status || "").toUpperCase());

    const assigneeName =
      t.assigneeName && t.assigneeName.trim().length > 0
        ? t.assigneeName.trim()
        : t.assignee || "Unassigned";

    return {
      id: String(t._id),
      _id: String(t._id),
      title: t.title,
      assignee: assigneeName,
      assigneeName: assigneeName,
      assigneeId: t.assigneeId ? String(t.assigneeId) : null,
      assignedTo: {
        _id: t.assigneeId ? String(t.assigneeId) : null,
        id: t.assigneeId ? String(t.assigneeId) : null,
        firstName: assigneeName,
        lastName: "",
        name: assigneeName,
        username: assigneeName,
      },
      dueDate: due ? due.toISOString().split("T")[0] : "No due date",
      createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : null,
      completedDate: t.completedDate ? new Date(t.completedDate).toISOString() : null,
      completedAt: t.completedDate ? new Date(t.completedDate).toISOString() : null,
      status: (t.status || "OPEN").toUpperCase(),
      priority: (t.priority || "medium").toLowerCase(),
      progress: t.progress || 0,
      taskType: t.taskType || "regular",
      isPastDue,
      isDueToday,
      isRisk: !!t.isRisk,
      hasSubtasks: Array.isArray(t.subtasks) && t.subtasks.length > 0,
      tags: t.tags || [],
    };
  });

  // 10. Format Calendar Events
  const calendarEvents = (raw.calendarTasks || []).map((t) => {
    const d = t.dueDate ? new Date(t.dueDate) : new Date(t.createdAt);
    return {
      id: String(t._id),
      title: t.title,
      date: d.toISOString().split("T")[0],
      status: (t.status || "OPEN").toUpperCase(),
      type: t.taskType || "regular",
    };
  });

  // 11. Focus sections (For Employee & Individual User)
  const continueWorking = formattedTasks.filter((t) =>
    ["INPROGRESS", "IN_PROGRESS"].includes(t.status)
  ).slice(0, 5);

  const atRiskTasks = formattedTasks.filter((t) => t.isRisk).slice(0, 5);
  const recentlyCompleted = formattedTasks.filter((t) =>
    ["DONE", "COMPLETED"].includes(t.status)
  ).slice(0, 5);
  const upcomingDeadlines = formattedTasks.filter((t) =>
    t.dueDate && t.dueDate !== "No due date" && new Date(t.dueDate) > now && !["DONE", "COMPLETED"].includes(t.status)
  ).slice(0, 5);
  const longPendingTasks = formattedTasks.filter((t) =>
    ["OPEN", "PENDING", "TODO"].includes(t.status)
  ).slice(0, 5);

  // 12. Final On-Time & Productivity Rates
  const totalCompleted = kpiData.completedTasks || completedCount;
  const onTimeCompleted = kpiData.onTimeCompleted || 0;
  const overdueClosed = kpiData.overdueClosed || 0;
  const onTimeRate =
    onTimeCompleted + overdueClosed > 0
      ? Math.round((onTimeCompleted / (onTimeCompleted + overdueClosed)) * 100)
      : totalCompleted > 0
      ? 100
      : 0;

  const completionRate =
    totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

  const teamProductivity =
    teamMembers.length > 0
      ? Math.round(
          teamMembers.reduce((acc, m) => acc + (m.productivity || 100), 0) /
            teamMembers.length
        )
      : completionRate;

  return {
    success: true,
    role: effectiveRole,
    timeRange,
    generatedAt: now.toISOString(),
    user: {
      id: String(userId),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: effectiveRole,
      organizationId: userOrgId ? String(userOrgId) : null,
    },
    kpis: {
      totalTasks,
      openTasks,
      inProgressTasks: inProgressCount,
      completedTasks: totalCompleted,
      completedToday: kpiData.completedToday || 0,
      dueToday: kpiData.dueToday || 0,
      beforeDueDate: kpiData.beforeDueDate || 0,
      pastDueDate: overdueCount,
      overdueTasks: overdueCount,
      highPriority: kpiData.highPriority || 0,
      approvalCount: kpiData.approvalTasks || 0,
      milestonesCount: kpiData.milestoneTasks || milestones.length,
      collaboratorCount: 0,
      completionRate,
      onTimeRate,
      onTime: onTimeCompleted,
      overdueClosed,
      // Manager / Team specific
      activeMembers: teamMembers.length,
      teamProductivity,
      // Employee / Individual specific
      thisWeekProgress: completionRate,
      taskStreak: totalCompleted > 0 ? 1 : 0,
    },
    charts: {
      taskOverview: trendDays,
      taskStatus: taskStatusDonut,
      workloadByPriority,
      weeklyPerformance,
    },
    teamMembers,
    milestones,
    taskList: formattedTasks,
    calendarEvents,
    focusSections: {
      continueWorking,
      atRiskTasks,
      quickTasks: [],
      recentlyCompleted,
      upcoming: upcomingDeadlines,
      longPendingTasks,
    },
    moduleUsage: {
      quickTasks: quickTasksCount,
      fullTasks: totalTasks,
    },
    systemHealth: {
      status: "operational",
      message: "All systems operational",
    },
  };
}
