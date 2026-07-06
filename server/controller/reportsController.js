/**
 * Reports Controller
 * Handles analytics and reporting endpoints for task management system
 * Document Reference: Section 6.0 - Reporting & Analytics Module
 */

import mongoose from "mongoose";
import Task from "../modals/taskModal.js";
import { User } from "../modals/userModal.js";
import { QuickTask } from "../modals/quickTaskModal.js";
import { ActivityHelper } from "../activity-helper.js";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import * as licenseService from "../services/licenseService.js";
import { TimezoneHelper } from "../utils/timezoneHelper.js";

const { ObjectId } = mongoose.Types;

/**
 * Build timezone-aware date filter for reports
 * @param {string|null} startDate - Custom start date string
 * @param {string|null} endDate - Custom end date string
 * @param {string|null} dateRange - Days ago (e.g. '30')
 * @param {string} userTimezone - IANA timezone string
 * @param {string} [fieldName='createdAt'] - The DB field to filter on
 * @returns {Object} MongoDB date filter
 */
function buildReportDateFilter(startDate, endDate, dateRange, userTimezone, fieldName = 'createdAt') {
  const dateFilter = {};
  if (startDate && endDate) {
    const { startOfDay: start } = TimezoneHelper.getDayBoundaries(userTimezone, new Date(startDate));
    const { endOfDay: end } = TimezoneHelper.getDayBoundaries(userTimezone, new Date(endDate));
    dateFilter[fieldName] = { $gte: start, $lte: end };
  } else if (dateRange) {
    const daysAgo = parseInt(dateRange);
    const now = new Date();
    const pastDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const { startOfDay: start } = TimezoneHelper.getDayBoundaries(userTimezone, pastDate);
    dateFilter[fieldName] = { $gte: start };
  }
  return dateFilter;
}

/**
 * Get Task Completion & Status Report
 * Path: /api/reports/task-completion-status
 * Role: All users (Employee, Manager, Org Admin, Individual)
 * Returns: KPIs, status distribution
 */
export const getTaskCompletionStatusReport = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const orgId = req.user.organizationId || req.user.organization_id;
    const userRole = req.user.role;
    const { dateRange = '30', startDate, endDate, status, priority, user: filterUserId } = req.query;

    const isAdmin = Array.isArray(userRole)
      ? userRole.some(r => ['org_admin', 'admin', 'super_admin', 'superadmin', 'organization'].includes(r))
      : ['org_admin', 'admin', 'super_admin', 'superadmin', 'organization'].includes(userRole);

    const isManager = Array.isArray(userRole)
      ? userRole.includes('manager')
      : userRole === 'manager';

    // Get user's timezone for accurate date filtering
    const userTimezone = await TimezoneHelper.getUserTimezone(userId);

    // Calculate date filter using user's timezone
    const dateFilter = buildReportDateFilter(startDate, endDate, dateRange, userTimezone);

    let queryFilter = {
      $or: [
        { isDeleted: { $exists: false } },
        { isDeleted: false },
        
        { isDeleted: { $ne: true } }
      ],
      ...dateFilter
    };

    if (status) queryFilter.status = status;
    if (priority) queryFilter.priority = priority;

    // Scoping based on role
    if (isAdmin) {
      // Org Admin sees everything in org
      queryFilter.organization = new ObjectId(orgId);
      if (filterUserId) queryFilter.assignedTo = new ObjectId(filterUserId);
    } else if (isManager) {
      // Manager sees own + employees in organization
      const employees = await User.find({
        organization_id: orgId,
        role: { $in: ['employee', 'individual'] }
      }).select('_id');
      const employeeIds = employees.map(e => e._id);

      // Add manager themselves
      const userIds = [...employeeIds, new ObjectId(userId)];

      queryFilter.assignedTo = { $in: userIds };
      if (filterUserId) queryFilter.assignedTo = new ObjectId(filterUserId);
    } else {
      // employee or individual - only own data
      queryFilter.assignedTo = new ObjectId(userId);
    }

    const tasks = await Task.find(queryFilter)
      .select('status priority dueDate createdAt completedAt assignedTo')
      .lean();

    const totalTasks = tasks.length;
    const completed = tasks.filter(t => t.status === 'DONE').length;
    const inProgress = tasks.filter(t => t.status === 'INPROGRESS').length;
    const open = tasks.filter(t => t.status === 'OPEN').length;
    const onHold = tasks.filter(t => t.status === 'ONHOLD').length;
    const cancelled = tasks.filter(t => t.status === 'CANCELLED').length;
    const now = new Date();
    const overdue = tasks.filter(t =>
      t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE'
    ).length;

    const statusDistribution = [
      { name: 'Open', value: open },
      { name: 'In Progress', value: inProgress },
      { name: 'Completed', value: completed },
      { name: 'Cancelled', value: cancelled },
      { name: 'Overdue', value: overdue }
    ];

    res.json({
      success: true,
      data: {
        kpis: {
          totalTasks,
          open,
          inProgress,
          completed,
          cancelled,
          overdue,
          onHold
        },
        statusDistribution
      }
    });
  } catch (error) {
    console.error('Error fetching Task Completion & Status Report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Task Completion & Status Report',
      error: error.message
    });
  }
};

/**
 * Get My Productivity Report
 * Path: /api/reports/my-productivity
 * Role: All users (viewing own data)
 * Returns: KPIs, completion trend, status distribution, priority load
 */
export const getMyProductivityReport = async (req, res) => {
  try {
    console.log('=== My Productivity Report Debug ===');
    console.log('req.user:', req.user);

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (!req.user.id && !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User ID not found in request'
      });
    }

    const userId = req.user.id || req.user._id;
    const { dateRange = '30', startDate, endDate, status, priority } = req.query;

    console.log('User ID:', userId);
    console.log('User ID Type:', typeof userId);
    console.log('User object:', JSON.stringify(req.user, null, 2));
    console.log('Date Range:', dateRange);
    console.log('Start Date:', startDate);
    console.log('End Date:', endDate);

    // Get user's timezone for accurate date filtering
    const userTimezone = await TimezoneHelper.getUserTimezone(userId);

    // Calculate date filter using user's timezone
    const dateFilter = buildReportDateFilter(startDate, endDate, dateRange, userTimezone);

    // Try without ANY filters first
    const allUserTasks = await Task.find({ assignedTo: userId }).countDocuments();
    console.log('Total tasks for user (no filters):', allUserTasks);

    // Try with string conversion
    const allUserTasksString = await Task.find({ assignedTo: userId.toString() }).countDocuments();
    console.log('Total tasks for user (string ID):', allUserTasksString);

    // Build query filter
    const queryFilter = {
      assignedTo: userId,
      $or: [
        { isDeleted: { $exists: false } },
        { isDeleted: false },
        { isDeleted: { $ne: true } }
      ],
      ...dateFilter
    };

    if (status) queryFilter.status = status;
    if (priority) queryFilter.priority = priority;

    console.log('Query Filter:', JSON.stringify(queryFilter));

    // Fetch all tasks for the user
    const tasks = await Task.find(queryFilter)
      .select('status priority dueDate createdAt completedAt assignedTo isRisk')
      .lean();

    console.log('Tasks found with full filter:', tasks.length);
    if (tasks.length > 0) {
      console.log('First task sample:', {
        status: tasks[0].status,
        priority: tasks[0].priority,
        assignedTo: tasks[0].assignedTo
      });
    }

    // Calculate KPIs
    const totalTasks = tasks.length;
    const completed = tasks.filter(t => t.status === 'DONE').length;
    const onHold = tasks.filter(t => t.status === 'ONHOLD').length;
    const now = new Date();
    const overdue = tasks.filter(t =>
      t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE'
    ).length;

    // Status Distribution
    const statusDistribution = [
      { name: 'Open', value: tasks.filter(t => t.status === 'OPEN').length },
      { name: 'In Progress', value: tasks.filter(t => t.status === 'INPROGRESS').length },
      { name: 'On Hold', value: onHold },
      { name: 'Done', value: completed }
    ];

    // Priority Load
    const priorityLoad = [
      { name: 'Low', tasks: tasks.filter(t => t.priority === 'low').length },
      { name: 'Medium', tasks: tasks.filter(t => t.priority === 'medium').length },
      { name: 'High', tasks: tasks.filter(t => t.priority === 'high').length },
      { name: 'Critical', tasks: tasks.filter(t => t.priority === 'urgent').length }
    ];

    // Completion Trend (weekly breakdown)
    // Use the same time window as the query's createdAt filter (prevents weird years in chart)
    const rangeStart = dateFilter.createdAt?.$gte;
    const rangeEnd = dateFilter.createdAt?.$lte;
    const weeks = generateWeeklyTrend(tasks, parseInt(dateRange), rangeStart, rangeEnd);

    // Upcoming Due Dates (next 7 days)
    const upcomingDueDates = generateUpcomingDueDates(tasks, userTimezone);

    // 📊 License consumption
    try {
      await licenseService.consumeFeature(userId, 'REPORT_TASK_STATUS', 1);
      console.log(`[ReportsController] 📊 REPORT_TASK_STATUS usage tracked for user ${userId}`);
    } catch (usageError) {
      console.error('[ReportsController] ⚠️ Failed to track REPORT_TASK_STATUS usage:', usageError.message);
    }

    res.json({
      success: true,
      data: {
        kpis: {
          totalTasks,
          completed,
          onHold,
          overdue
        },
        completionTrend: weeks,
        statusDistribution,
        priorityLoad,
        upcomingDueDates
      }
    });
  } catch (error) {
    console.error('Error fetching productivity report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch productivity report',
      error: error.message
    });
  }
};

/**
 * Get Team Analytics Report
 * Path: /api/reports/team-analytics
 * Role: Manager (viewing team data)
 * Returns: Team KPIs, productivity trend, workload distribution, overdue by member
 */
export const getTeamAnalyticsReport = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const userRole = req.user.role;
    const orgId = req.user.organizationId || req.user.organization_id;
    const { dateRange = '30', startDate, endDate, status, priority } = req.query;

    // Verify user is manager or admin
    // Support both string and array roles
    const allowedRoles = ['manager', 'org_admin', 'admin', 'super_admin', 'superadmin', 'organization'];
    const hasAccess = Array.isArray(userRole)
      ? userRole.some(role => allowedRoles.includes(role))
      : allowedRoles.includes(userRole);

    if (!hasAccess) {
      console.log('Access denied for role:', userRole);
      return res.status(403).json({
        success: false,
        message: 'Access denied. Manager role required.'
      });
    }

    console.log('=== Team Analytics Report Debug ===');
    console.log('User ID:', userId);
    console.log('User Role:', userRole);
    console.log('Organization ID:', orgId);
    console.log('Date Range:', dateRange);
    console.log('Start Date:', startDate);
    console.log('End Date:', endDate);

    // Fetch team members (users in same organization)
    // Try multiple organization field names
    const teamMembers = await User.find({
      $and: [
        {
          $or: [
            { organizationId: orgId },
            { organization_id: orgId },
            { orgId: orgId }
          ]
        },
        {
          $or: [
            { isDeleted: { $exists: false } },
            { isDeleted: false }
          ]
        }
      ]
    }).select('_id firstName lastName email role organizationId organization_id orgId');

    const teamMemberIds = teamMembers.map(m => m._id);
    console.log('Team Members Found:', teamMembers.length);
    console.log('Team Member IDs:', teamMemberIds);
    if (teamMembers.length > 0) {
      console.log('Sample Team Member:', JSON.stringify(teamMembers[0], null, 2));
    }

    // Get user's timezone
    const userTimezone = await TimezoneHelper.getUserTimezone(userId);

    // Calculate date filter using user's timezone
    const dateFilter = buildReportDateFilter(startDate, endDate, dateRange, userTimezone);

    // Build query filter
    // FIXED: Make isDeleted filter optional
    const queryFilter = {
      assignedTo: { $in: teamMemberIds },
      $or: [
        { isDeleted: { $exists: false } },
        { isDeleted: false },
        { isDeleted: { $ne: true } }
      ],
      ...dateFilter
    };

    if (status) queryFilter.status = status;
    if (priority) queryFilter.priority = priority;

    console.log('Query Filter:', JSON.stringify(queryFilter));

    // Check total tasks for team without filters
    const allTeamTasks = await Task.find({ assignedTo: { $in: teamMemberIds } }).countDocuments();
    console.log('Total tasks for team (no filters):', allTeamTasks);

    // Check with only date filter
    if (Object.keys(dateFilter).length > 0) {
      const tasksWithDateOnly = await Task.find({
        assignedTo: { $in: teamMemberIds },
        ...dateFilter
      }).countDocuments();
      console.log('Tasks with date filter only:', tasksWithDateOnly);
    }

    // Fetch all team tasks
    const tasks = await Task.find(queryFilter)
      .select('status priority dueDate createdAt completedAt assignedTo isRisk')
      .populate('assignedTo', 'name')
      .lean();

    console.log('Tasks found with full filter:', tasks.length);
    if (tasks.length > 0) {
      console.log('Sample Task:', JSON.stringify(tasks[0], null, 2));
    }

    // Calculate Team KPIs
    const totalTeamTasks = tasks.length;
    const completed = tasks.filter(t => t.status === 'DONE').length;
    const now = new Date();
    const overdue = tasks.filter(t =>
      t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE'
    ).length;
    const atRisk = tasks.filter(t => t.isRisk === true).length;

    // Status Distribution
    const statusDistribution = [
      { name: 'Open', value: tasks.filter(t => t.status === 'OPEN').length },
      { name: 'In Progress', value: tasks.filter(t => t.status === 'INPROGRESS').length },
      { name: 'On Hold', value: tasks.filter(t => t.status === 'ONHOLD').length },
      { name: 'Done', value: completed }
    ];

    // Productivity Trend
    const rangeStart = dateFilter.createdAt?.$gte;
    const rangeEnd = dateFilter.createdAt?.$lte;
    const productivityTrend = generateWeeklyTrend(tasks, parseInt(dateRange), rangeStart, rangeEnd);

    // Workload by Member
    const workloadByMember = teamMembers.map(member => {
      const memberTasks = tasks.filter(t =>
        t.assignedTo && t.assignedTo._id.toString() === member._id.toString()
      );
      const memberCompleted = memberTasks.filter(t => t.status === 'DONE').length;

      return {
        name: `${member.firstName} ${member.lastName}`.trim(),
        firstName: member.firstName,
        lastName: member.lastName,
        tasks: memberTasks.length,
        completed: memberCompleted
      };
    }).filter(m => m.tasks > 0);

    // Overdue by Member
    const overdueByMember = teamMembers.map(member => {
      const memberOverdue = tasks.filter(t =>
        t.assignedTo &&
        t.assignedTo._id.toString() === member._id.toString() &&
        t.dueDate &&
        new Date(t.dueDate) < now &&
        t.status !== 'DONE'
      ).length;

      return {
        name: `${member.firstName} ${member.lastName}`.trim(),
        firstName: member.firstName,
        lastName: member.lastName,
        overdue: memberOverdue
      };
    }).filter(m => m.overdue > 0);

    // 📊 License consumption
    try {
      await licenseService.consumeFeature(userId, 'REPORT_ADV', 1);
      console.log(`[ReportsController] 📊 REPORT_ADV usage tracked for user ${userId}`);
    } catch (usageError) {
      console.error('[ReportsController] ⚠️ Failed to track REPORT_ADV usage:', usageError.message);
    }

    res.json({
      success: true,
      data: {
        kpis: {
          totalTeamTasks,
          completed,
          overdue,
          atRisk
        },
        productivityTrend,
        statusDistribution,
        workloadByMember,
        overdueByMember
      }
    });
  } catch (error) {
    console.error('Error fetching team analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch team analytics',
      error: error.message
    });
  }
};

/**
 * Get Organization Analytics Report
 * Path: /api/reports/organization-analytics
 * Role: Org Admin (viewing full organization data)
 * Returns: Org KPIs, completion trend, department comparisons, risk heatmap
 */
export const getOrganizationAnalyticsReport = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const orgId = req.user.organizationId || req.user.organization_id;
    const userRole = req.user.role;
    const { dateRange = '30', startDate, endDate, status, priority } = req.query;

    console.log('=== Organization Analytics Report Debug ===');
    console.log('User ID:', userId);
    console.log('User Role:', userRole);
    console.log('Organization ID:', orgId);
    console.log('Date Range:', dateRange);
    console.log('Start Date:', startDate);
    console.log('End Date:', endDate);

    // Verify user is org admin or super admin
    // Support both string and array roles
    const allowedRoles = ['org_admin', 'admin', 'super_admin', 'superadmin', 'organization'];
    const hasAccess = Array.isArray(userRole)
      ? userRole.some(role => allowedRoles.includes(role))
      : allowedRoles.includes(userRole);

    if (!hasAccess) {
      console.log('Access denied for role:', userRole);
      return res.status(403).json({
        success: false,
        message: 'Access denied. Organization admin role required.'
      });
    }

    // Get user's timezone
    const userTimezone = await TimezoneHelper.getUserTimezone(userId);

    // Calculate date filter using user's timezone
    const dateFilter = buildReportDateFilter(startDate, endDate, dateRange, userTimezone);

    // Build query filter for organization tasks
    // FIXED: Use 'organization' field and orgId variable with ObjectId
    const queryFilter = {
      organization: new ObjectId(orgId),
      $or: [
        { isDeleted: { $exists: false } },
        { isDeleted: false },
        { isDeleted: { $ne: true } }
      ],
      ...dateFilter
    };

    if (status) queryFilter.status = status;
    if (priority) queryFilter.priority = priority;

    console.log('Query Filter:', JSON.stringify(queryFilter));

    // Check total tasks for organization without filters
    const allOrgTasks = await Task.find({ organization: new ObjectId(orgId) }).countDocuments();
    console.log('Total tasks for organization (no filters):', allOrgTasks);

    // Check tasks without isDeleted filter
    const tasksWithoutDeletedFilter = await Task.find({ organization: new ObjectId(orgId), ...dateFilter }).countDocuments();
    console.log('Tasks without isDeleted filter:', tasksWithoutDeletedFilter);

    // Fetch all organization tasks
    const tasks = await Task.find(queryFilter)
      .select('status priority dueDate createdAt completedAt assignedTo isRisk')
      .populate('assignedTo', 'name department')
      .lean();

    console.log('Tasks found with full filter:', tasks.length);

    // Get active teams count
    const activeTeams = await User.distinct('department', {
      organization_id: orgId,
      isActive: true,
      department: { $exists: true, $ne: null }
    });

    // Calculate Organization KPIs
    const totalOrgTasks = tasks.length;
    const completed = tasks.filter(t => t.status === 'DONE').length;
    const now = new Date();
    const riskTasks = tasks.filter(t => t.isRisk === true).length;

    // Completion Trend
    const rangeStart = dateFilter.createdAt?.$gte;
    const rangeEnd = dateFilter.createdAt?.$lte;
    const completionTrend = generateWeeklyTrend(tasks, parseInt(dateRange), rangeStart, rangeEnd);

    // Priority Distribution
    const priorityDistribution = [
      { name: 'Low', value: tasks.filter(t => t.priority === 'low').length },
      { name: 'Medium', value: tasks.filter(t => t.priority === 'medium').length },
      { name: 'High', value: tasks.filter(t => t.priority === 'high').length },
      { name: 'Critical', value: tasks.filter(t => t.priority === 'urgent').length }
    ];

    // Tasks by Department
    const departmentMap = {};

    tasks.forEach(task => {
      const dept = task.assignedTo?.department || 'Unassigned';
      if (!departmentMap[dept]) {
        departmentMap[dept] = {
          total: 0,
          completed: 0,
          open: 0,
          inProgress: 0,
          overdue: 0
        };
      }

      // Skip CANCELLED tasks from all counts (they're terminated)
      if (task.status === 'CANCELLED') {
        return;
      }

      // Count by status
      if (task.status === 'DONE') {
        departmentMap[dept].completed++;
        departmentMap[dept].total++;
      } else if (task.status === 'OPEN') {
        departmentMap[dept].open++;
        departmentMap[dept].total++;
      } else if (task.status === 'INPROGRESS') {
        departmentMap[dept].inProgress++;
        departmentMap[dept].total++;
      } else if (task.status === 'ONHOLD') {
        // Include ONHOLD tasks in "Open" count for reporting purposes
        departmentMap[dept].open++;
        departmentMap[dept].total++;
      }

      // Count overdue tasks (has dueDate, past due, and not completed/cancelled/onhold)
      // Note: Overdue can overlap with Open or In Progress (a task can be both)
      if (task.dueDate &&
        new Date(task.dueDate) < now &&
        task.status !== 'DONE' &&
        task.status !== 'CANCELLED') {
        departmentMap[dept].overdue++;
      }
    });

    const tasksByDepartment = Object.keys(departmentMap).map(dept => {
      const completed = departmentMap[dept].completed;
      const inProgress = departmentMap[dept].inProgress;
      const open = departmentMap[dept].open;
      const overdue = departmentMap[dept].overdue;

      // Calculate total as sum of all status columns to ensure they match
      // This ensures: Total = Completed + In Progress + Open + Overdue
      // Note: Overdue overlaps with Open/In Progress, so this accounts for that overlap
      const calculatedTotal = completed + inProgress + open + overdue;

      return {
        name: dept,
        tasks: calculatedTotal, // Use calculated total to ensure it matches the sum of all columns
        completed: completed,
        open: open,
        inProgress: inProgress,
        overdue: overdue
      };
    });

    // Risk Heatmap by Department
    const riskHeatmap = Object.keys(departmentMap).map(dept => {
      const deptTasks = tasks.filter(t =>
        (t.assignedTo?.department || 'Unassigned') === dept
      );
      const deptRisk = deptTasks.filter(t => t.isRisk === true).length;

      return {
        label: dept,
        value: deptRisk,
        subtitle: deptRisk > 5 ? 'High Risk' : deptRisk > 2 ? 'Medium Risk' : 'Low Risk'
      };
    });

    // Upcoming Due Dates
    const upcomingDueDates = [
      {
        date: 'Today',
        count: tasks.filter(t =>
          t.dueDate &&
          new Date(t.dueDate).toDateString() === now.toDateString()
        ).length
      },
      {
        date: 'Tomorrow',
        count: tasks.filter(t => {
          if (!t.dueDate) return false;
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          return new Date(t.dueDate).toDateString() === tomorrow.toDateString();
        }).length
      },
      {
        date: 'This Week',
        count: tasks.filter(t => {
          if (!t.dueDate) return false;
          const weekEnd = new Date(now);
          weekEnd.setDate(weekEnd.getDate() + 7);
          return new Date(t.dueDate) >= now && new Date(t.dueDate) <= weekEnd;
        }).length
      }
    ];

    // 📊 License consumption
    try {
      await licenseService.consumeFeature(userId, 'REPORT_ADV', 1);
      console.log(`[ReportsController] 📊 REPORT_ADV usage tracked for user ${userId}`);
    } catch (usageError) {
      console.error('[ReportsController] ⚠️ Failed to track REPORT_ADV usage:', usageError.message);
    }

    const responseData = {
      success: true,
      license: await licenseService.getUserLicenseInfo(userId),
      data: {
        kpis: {
          totalOrgTasks,
          completed,
          activeTeams: activeTeams.length,
          riskTasks
        },
        completionTrend,
        priorityDistribution,
        tasksByDepartment,
        riskHeatmap,
        upcomingDueDates
      }
    };

    console.log('📊 Organization Analytics Response Summary:', {
      totalTasks: totalOrgTasks,
      completed,
      activeTeams: activeTeams.length,
      riskTasks,
      completionTrendPoints: completionTrend.length,
      departmentCount: tasksByDepartment.length,
      responseDataSize: JSON.stringify(responseData).length
    });

    res.json(responseData);
  } catch (error) {
    console.error('Error fetching organization analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch organization analytics',
      error: error.message
    });
  }
};

/**
 * Get Milestone Achievement Report
 * Path: /api/reports/milestone-achievement
 * Role: Manager/Admin (team data) | Org Admin (full org data) | User (own data)
 * Returns: Milestones achieved vs. missed, with filters
 * Document Reference: Section 6.0 - Report #5
 */
export const getMilestoneAchievementReport = async (req, res) => {
  try {
    // 🔐 ROLE-BASED ACCESS CONTROL
    const userId = req.user.id || req.user._id;
    const userRole = req.user.role;
    const orgId = req.user.organizationId || req.user.organization_id;

    console.log('=== Milestone Achievement Report Debug ===');
    console.log('User ID:', userId);
    console.log('User Role:', userRole);
    console.log('Organization ID:', orgId);

    // Define role hierarchy and access levels
    const roleHierarchy = {
      individual: ['creator', 'assignee', 'user', 'employee', 'individual'],
      manager: ['manager', 'team_lead', 'mgr'],
      admin: ['org_admin', 'admin', 'super_admin', 'superadmin', 'organization']
    };

    // Determine user access level
    let accessLevel = 'individual';
    const normalizedRole = Array.isArray(userRole) ? userRole : [userRole];

    if (normalizedRole.some(role => roleHierarchy.admin.includes(role))) {
      accessLevel = 'admin';
    } else if (normalizedRole.some(role => roleHierarchy.manager.includes(role))) {
      accessLevel = 'manager';
    }

    console.log('Access Level Determined:', accessLevel);

    const { dateRange = '30', startDate, endDate, team } = req.query;

    console.log('Date Range:', dateRange);

    // Get user's timezone
    const userTimezone = await TimezoneHelper.getUserTimezone(userId);

    // Calculate date filter using user's timezone
    const dateFilter = buildReportDateFilter(startDate, endDate, dateRange, userTimezone);

    // Optional team/department filter (for \"team\" scope)
    let teamMemberIds = null;
    if (team) {
      console.log('Team filter provided:', team);
      const teamMembers = await User.find(
        { organization_id: new ObjectId(orgId), department: team },
        { _id: 1 }
      ).lean();
      teamMemberIds = teamMembers.map((m) => m._id);
      console.log('Team members for department filter:', teamMemberIds.length);
    }

    // Build base query for milestone tasks
    const milestoneQuery = {
      taskType: 'milestone',
      $or: [
        { isDeleted: { $exists: false } },
        { isDeleted: false }
      ],
      ...dateFilter
    };

    // 🔐 Role-based data scoping - Individual users see only their own tasks
    if (accessLevel === 'admin' || accessLevel === 'manager') {
      if (orgId) {
        milestoneQuery.organization = new ObjectId(orgId);
      }
    } else {
      // accessLevel === 'individual'
      milestoneQuery.assignedTo = userId;
    }

    // Apply team filter if present (only for admins/managers)
    if ((accessLevel === 'admin' || accessLevel === 'manager') && team && teamMemberIds && teamMemberIds.length > 0) {
      milestoneQuery.assignedTo = { $in: teamMemberIds };
    }

    // Query milestone tasks from Task collection
    const milestoneTasks = await Task.find(milestoneQuery)
      .populate('assignedTo', 'name email department')
      .populate('createdBy', 'name email')
      .lean();

    console.log('Milestone tasks found:', milestoneTasks.length);

    // Calculate metrics
    const now = new Date();
    const achieved = milestoneTasks.filter(t => t.status === 'DONE').length;
    const missed = milestoneTasks.filter(t =>
      t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE'
    ).length;
    const inProgress = milestoneTasks.filter(t =>
      ['INPROGRESS', 'OPEN'].includes(t.status)
    ).length;
    const onTime = milestoneTasks.filter(t =>
      t.status === 'DONE' && t.completedAt && t.dueDate &&
      new Date(t.completedAt) <= new Date(t.dueDate)
    ).length;

    // Milestone by priority
    const milestoneByPriority = [
      { name: 'Low', achieved: milestoneTasks.filter(t => t.priority === 'low' && t.status === 'DONE').length, total: milestoneTasks.filter(t => t.priority === 'low').length },
      { name: 'Medium', achieved: milestoneTasks.filter(t => t.priority === 'medium' && t.status === 'DONE').length, total: milestoneTasks.filter(t => t.priority === 'medium').length },
      { name: 'High', achieved: milestoneTasks.filter(t => t.priority === 'high' && t.status === 'DONE').length, total: milestoneTasks.filter(t => t.priority === 'high').length },
      { name: 'Critical', achieved: milestoneTasks.filter(t => t.priority === 'urgent' && t.status === 'DONE').length, total: milestoneTasks.filter(t => t.priority === 'urgent').length }
    ];

    // Recent milestones
    const recentMilestones = milestoneTasks
      .sort((a, b) => new Date(b.completedAt || b.updatedAt) - new Date(a.completedAt || a.updatedAt))
      .slice(0, 10)
      .map(m => ({
        id: m._id,
        title: m.title,
        assignee: m.assignedTo?.name || 'Unknown',
        status: m.status,
        dueDate: m.dueDate ? TimezoneHelper.formatInTimezone(new Date(m.dueDate), userTimezone) : 'No due date',
        completedAt: m.completedAt ? TimezoneHelper.formatInTimezone(new Date(m.completedAt), userTimezone) : null,
        priority: m.priority
      }));

    const responseData = {
      summary: {
        totalMilestones: milestoneTasks.length,
        achieved,
        missed,
        inProgress,
        onTime,
        achievementRate: milestoneTasks.length > 0 ? Math.round((achieved / milestoneTasks.length) * 100) : 0,
        onTimeRate: achieved > 0 ? Math.round((onTime / achieved) * 100) : 0
      },
      milestoneByPriority,
      recentMilestones
    };

    console.log('📊 Milestone Report Response:', {
      totalMilestones: milestoneTasks.length,
      achieved,
      missed,
      responseDataSize: JSON.stringify(responseData).length
    });

    // 📊 License consumption
    try {
      await licenseService.consumeFeature(userId, 'REPORT_MILESTONE', 1);
      console.log(`[ReportsController] 📊 REPORT_MILESTONE usage tracked for user ${userId}`);
    } catch (usageError) {
      console.error('[ReportsController] ⚠️ Failed to track REPORT_MILESTONE usage:', usageError.message);
    }

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error fetching milestone achievement report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch milestone achievement report',
      error: error.message
    });
  }
};

/**
 * Get Recurring Task Adherence Report
 * Path: /api/reports/recurring-task-adherence
 * Role: Manager/Admin (team data) | Org Admin (full org data) | User (own data)
 * Returns: % of recurring tasks completed on time, highlights missed
 * Document Reference: Section 6.0 - Report #6
 */
export const getRecurringTaskAdherenceReport = async (req, res) => {
  try {
    // 🔐 ROLE-BASED ACCESS CONTROL
    const userId = req.user.id || req.user._id;
    const userRole = req.user.role;
    const orgId = req.user.organizationId || req.user.organization_id;

    console.log('=== Recurring Task Adherence Report Debug ===');
    console.log('User ID:', userId);
    console.log('User Role:', userRole);
    console.log('Organization ID:', orgId);

    // Define role hierarchy and access levels
    const roleHierarchy = {
      individual: ['creator', 'assignee', 'user', 'employee', 'individual'],
      manager: ['manager', 'team_lead', 'mgr'],
      admin: ['org_admin', 'admin', 'super_admin', 'superadmin', 'organization']
    };

    // Determine user access level
    let accessLevel = 'individual';
    const normalizedRole = Array.isArray(userRole) ? userRole : [userRole];

    if (normalizedRole.some(role => roleHierarchy.admin.includes(role))) {
      accessLevel = 'admin';
    } else if (normalizedRole.some(role => roleHierarchy.manager.includes(role))) {
      accessLevel = 'manager';
    }

    console.log('Access Level Determined:', accessLevel);

    const { dateRange = '30', startDate, endDate, team } = req.query;

    console.log('Date Range:', dateRange);

    // Get user's timezone
    const userTimezone = await TimezoneHelper.getUserTimezone(userId);

    // Calculate date filter using user's timezone
    const dateFilter = buildReportDateFilter(startDate, endDate, dateRange, userTimezone);

    // Optional team/department filter (Org Analytics filter bar)
    let teamMemberIds = null;
    if (team) {
      console.log('Team filter provided:', team);
      const teamMembers = await User.find(
        { organization_id: new ObjectId(orgId), department: team },
        { _id: 1 }
      ).lean();
      teamMemberIds = teamMembers.map((m) => m._id);
      console.log('Team members for department filter:', teamMemberIds.length);
    }

    const recurringQuery = {
      taskType: 'recurring',
      $or: [
        { isDeleted: { $exists: false } },
        { isDeleted: false }
      ],
      ...dateFilter
    };

    // 🔐 Role-based data scoping - Individual users see only their own tasks
    if (accessLevel === 'admin' || accessLevel === 'manager') {
      if (orgId) {
        recurringQuery.organization = new ObjectId(orgId);
      }
    } else {
      // accessLevel === 'individual'
      recurringQuery.assignedTo = userId;
    }

    if ((accessLevel === 'admin' || accessLevel === 'manager') && team && teamMemberIds && teamMemberIds.length > 0) {
      recurringQuery.assignedTo = { $in: teamMemberIds };
    }

    // Query recurring tasks from Task collection
    const recurringTasks = await Task.find(recurringQuery)
      .populate('assignedTo', 'name email department')
      .lean();

    console.log('Recurring tasks found:', recurringTasks.length);

    // Calculate metrics
    const now = new Date();
    const completedTasks = recurringTasks.filter((t) => t.status === 'DONE');
    const completed = completedTasks.length;

    // NOTE: Some tasks may not store completedAt. Fall back to updatedAt for reporting.
    const isDoneOnTime = (t) => {
      if (t.status !== 'DONE' || !t.dueDate) return false;
      const completionTime = t.completedAt ? new Date(t.completedAt) : new Date(t.updatedAt);
      return completionTime <= new Date(t.dueDate);
    };

    const onTime = recurringTasks.filter(isDoneOnTime).length;

    // Missed deadlines split:
    // - missedOpen: overdue and not completed
    // - completedLate: completed after due date
    const missedOpen = recurringTasks.filter((t) =>
      t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE'
    ).length;
    const completedLate = completedTasks.filter((t) =>
      t.dueDate && !isDoneOnTime(t)
    ).length;

    // Backward-compatible fields
    const overdue = missedOpen;
    const missed = missedOpen + completedLate;

    // Adherence by user
    const adherenceByUser = {};
    recurringTasks.forEach(task => {
      const userName = task.assignedTo?.name || 'Unknown';
      if (!adherenceByUser[userName]) {
        adherenceByUser[userName] = { total: 0, onTime: 0, completed: 0 };
      }
      adherenceByUser[userName].total++;
      if (task.status === 'DONE') {
        adherenceByUser[userName].completed++;
        if (isDoneOnTime(task)) {
          adherenceByUser[userName].onTime++;
        }
      }
    });

    const adherenceData = Object.keys(adherenceByUser).map(userName => ({
      userName,
      ...adherenceByUser[userName],
      adherenceRate: adherenceByUser[userName].completed > 0 ?
        Math.round((adherenceByUser[userName].onTime / adherenceByUser[userName].completed) * 100) : 0
    }));

    // Recent recurring tasks
    const recentRecurring = recurringTasks
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 10)
      .map(t => ({
        id: t._id,
        title: t.title,
        assignee: t.assignedTo?.name || 'Unknown',
        status: t.status,
        dueDate: t.dueDate ? TimezoneHelper.formatInTimezone(new Date(t.dueDate), userTimezone) : 'No due date',
        frequency: t.recurringFrequency || 'Unknown',
        lastCompleted: t.completedAt ? TimezoneHelper.formatInTimezone(new Date(t.completedAt), userTimezone) : null
      }));

    // Highlight missed recurring tasks (overdue open + late completed)
    const recentMissedRecurring = recurringTasks
      .filter((t) => {
        if (!t.dueDate) return false;
        if (t.status === 'DONE') return !isDoneOnTime(t); // completed late
        return new Date(t.dueDate) < now; // overdue and not done
      })
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 10)
      .map((t) => {
        const completionTime = t.status === 'DONE'
          ? (t.completedAt ? new Date(t.completedAt) : new Date(t.updatedAt))
          : null;
        const missedType = t.status === 'DONE' ? 'COMPLETED_LATE' : 'OVERDUE_OPEN';

        return {
          id: t._id,
          title: t.title,
          assignee: t.assignedTo?.name || 'Unknown',
          status: t.status,
          missedType,
          dueDate: t.dueDate ? TimezoneHelper.formatInTimezone(new Date(t.dueDate), userTimezone) : 'No due date',
          completedAt: completionTime ? TimezoneHelper.formatInTimezone(completionTime, userTimezone) : null,
          frequency: t.recurringFrequency || 'Unknown'
        };
      });

    const responseData = {
      summary: {
        totalRecurring: recurringTasks.length,
        completed,
        onTime,
        overdue,
        missed,
        missedOpen,
        completedLate,
        adherenceRate: completed > 0 ? Math.round((onTime / completed) * 100) : 0,
        completionRate: recurringTasks.length > 0 ? Math.round((completed / recurringTasks.length) * 100) : 0
      },
      adherenceByUser: adherenceData,
      recentRecurring,
      recentMissedRecurring
    };

    console.log('📊 Recurring Report Response:', {
      totalRecurring: recurringTasks.length,
      completed,
      onTime,
      responseDataSize: JSON.stringify(responseData).length
    });

    // 📊 License consumption
    try {
      await licenseService.consumeFeature(userId, 'REPORT_RECURRING', 1);
      console.log(`[ReportsController] 📊 REPORT_RECURRING usage tracked for user ${userId}`);
    } catch (usageError) {
      console.error('[ReportsController] ⚠️ Failed to track REPORT_RECURRING usage:', usageError.message);
    }

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error fetching recurring task adherence report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recurring task adherence report',
      error: error.message
    });
  }
};

/**
 * Get Quick Task Conversion Report
 * Path: /api/reports/quick-task-conversion
 * Role: Manager/Admin (team data) | Org Admin (full org data) | User (own data)
 * Returns: Tracks how many quick tasks were converted into full tasks
 * Document Reference: Section 6.0 - Report #7
 */
export const getQuickTaskConversionReport = async (req, res) => {
  try {
    // 🔐 ROLE-BASED ACCESS CONTROL
    const userId = req.user.id || req.user._id;
    const userRole = req.user.role;
    const orgId = req.user.organizationId || req.user.organization_id;
    const { dateRange = '30', startDate, endDate, team } = req.query;

    console.log('=== Quick Task Conversion Report Debug ===');
    console.log('User ID:', userId);
    console.log('User Role:', userRole);
    console.log('Organization ID:', orgId);
    console.log('Date Range:', dateRange);

    // Define role hierarchy and access levels
    const roleHierarchy = {
      individual: ['creator', 'assignee', 'user', 'employee', 'individual'],
      manager: ['manager', 'team_lead', 'mgr'],
      admin: ['org_admin', 'admin', 'super_admin', 'superadmin', 'organization']
    };

    // Determine user access level
    let accessLevel = 'individual';
    const normalizedRole = Array.isArray(userRole) ? userRole : [userRole];

    if (normalizedRole.some(role => roleHierarchy.admin.includes(role))) {
      accessLevel = 'admin';
    } else if (normalizedRole.some(role => roleHierarchy.manager.includes(role))) {
      accessLevel = 'manager';
    }

    console.log('Access Level Determined:', accessLevel);

    // Get user's timezone
    const userTimezone = await TimezoneHelper.getUserTimezone(userId);

    // Calculate date filter using user's timezone
    const dateFilter = buildReportDateFilter(startDate, endDate, dateRange, userTimezone);

    // Determine scope userIds (Quick Tasks are personal; org report aggregates by access level)
    let scopedUserIds = [];

    if (accessLevel === 'individual') {
      scopedUserIds = [new ObjectId(userId)];
      console.log('QuickTask scope: individual user');
    } else if (accessLevel === 'manager') {
      // Manager scope: direct reports (plus self)
      const directReports = await User.find(
        { organization_id: new ObjectId(orgId), managerId: new ObjectId(userId) },
        { _id: 1 }
      ).lean();
      scopedUserIds = [new ObjectId(userId), ...directReports.map((u) => u._id)];
      console.log('QuickTask scope: manager direct reports:', directReports.length);
    } else {
      // Admin scope: all users in organization
      const orgUsers = await User.find(
        { organization_id: new ObjectId(orgId) },
        { _id: 1 }
      ).lean();
      scopedUserIds = orgUsers.map((u) => u._id);
      console.log('QuickTask scope: org users:', scopedUserIds.length);
    }

    // Optional team/department filter (narrows scopedUserIds)
    if (team) {
      const teamMembers = await User.find(
        { organization_id: new ObjectId(orgId), department: team },
        { _id: 1 }
      ).lean();
      const teamIds = new Set(teamMembers.map((m) => String(m._id)));
      scopedUserIds = scopedUserIds.filter((id) => teamIds.has(String(id)));
      console.log('QuickTask scope after team filter:', scopedUserIds.length);
    }

    // Query quick tasks created in timeframe (adoption)
    const quickTaskQuery = {
      user: { $in: scopedUserIds },
      ...dateFilter
    };

    const quickTasks = await QuickTask.find(quickTaskQuery)
      .populate('user', 'name email department')
      .lean();

    console.log('Quick tasks found:', quickTasks.length);

    const isConverted = (qt) =>
      qt?.convertedToTask?.isConverted === true ||
      qt?.conversionFlag?.isConverted === true; // legacy field (if present in DB)

    const convertedQuickTasks = quickTasks.filter(isConverted);

    // Recent conversions (only converted quick tasks)
    const recentConversions = convertedQuickTasks
      .sort((a, b) => {
        const aDate = a?.convertedToTask?.convertedAt || a?.conversionFlag?.convertedAt || a.updatedAt;
        const bDate = b?.convertedToTask?.convertedAt || b?.conversionFlag?.convertedAt || b.updatedAt;
        return new Date(bDate) - new Date(aDate);
      })
      .slice(0, 10)
      .map((qt) => {
        const convertedAt = qt?.convertedToTask?.convertedAt || qt?.conversionFlag?.convertedAt || qt.updatedAt;
        return {
          id: qt._id,
          title: qt.title,
          assignee: qt.user?.name || 'Unknown',
          createdBy: qt.user?.name || 'Unknown',
          status: qt.status,
          createdAt: qt.createdAt ? TimezoneHelper.formatInTimezone(new Date(qt.createdAt), userTimezone) : '—',
          lastModified: convertedAt ? TimezoneHelper.formatInTimezone(new Date(convertedAt), userTimezone) : '—',
          convertedToTaskId: qt?.convertedToTask?.taskId || qt?.conversionFlag?.convertedToTaskId || null
        };
      });

    // Conversion trends (last 5 weeks) based on quick task creation and conversion timestamps
    const conversionTrend = [];
    for (let i = 4; i >= 0; i--) {
      const refDate = new Date();
      refDate.setDate(refDate.getDate() - (i * 7));
      const { startOfDay: weekStart } = TimezoneHelper.getDayBoundaries(userTimezone, refDate);
      const weekEndRef = new Date(refDate);
      weekEndRef.setDate(weekEndRef.getDate() + 6);
      const { endOfDay: weekEnd } = TimezoneHelper.getDayBoundaries(userTimezone, weekEndRef);

      const weekCreated = quickTasks.filter((qt) => {
        const createdDate = new Date(qt.createdAt);
        return createdDate >= weekStart && createdDate <= weekEnd;
      }).length;

      const weekConverted = convertedQuickTasks.filter((qt) => {
        const convertedAt = qt?.convertedToTask?.convertedAt || qt?.conversionFlag?.convertedAt;
        if (!convertedAt) return false;
        const d = new Date(convertedAt);
        return d >= weekStart && d <= weekEnd;
      }).length;

      conversionTrend.push({
        week: `Week ${5 - i}`,
        quick: weekCreated,
        converted: weekConverted
      });
    }

    const responseData = {
      summary: {
        totalQuickTasks: quickTasks.length,
        convertedTasks: convertedQuickTasks.length,
        conversionRate: quickTasks.length > 0
          ? Math.round((convertedQuickTasks.length / quickTasks.length) * 100)
          : 0
      },
      conversionTrend,
      recentConversions
    };

    console.log('📊 Quick Task Report Response:', {
      totalQuickTasks: quickTasks.length,
      convertedTasks: convertedQuickTasks.length,
      responseDataSize: JSON.stringify(responseData).length
    });

    // 📊 License consumption
    try {
      await licenseService.consumeFeature(userId, 'REPORT_QUICK_CONVERSION', 1);
      console.log(`[ReportsController] 📊 REPORT_QUICK_CONVERSION usage tracked for user ${userId}`);
    } catch (usageError) {
      console.error('[ReportsController] ⚠️ Failed to track REPORT_QUICK_CONVERSION usage:', usageError.message);
    }

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error fetching quick task conversion report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quick task conversion report',
      error: error.message
    });
  }
};

/**
 * Get Overdue Tasks Report
 * Path: /api/reports/overdue-tasks
 * Role: All users (filtered by access level)
 * Returns: List of all overdue tasks sorted by # of days overdue
 * Document Reference: Section 6.0 - Report #2
 */
export const getOverdueTasksReport = async (req, res) => {
  try {
    // 🔐 ROLE-BASED ACCESS CONTROL
    const userId = req.user.id || req.user._id;
    const userRole = req.user.role;
    const orgId = req.user.organizationId || req.user.organization_id;
    const { user, priority, sortBy = 'overdueDays' } = req.query;

    console.log('=== Overdue Tasks Report Debug ===');
    console.log('User ID:', userId);
    console.log('User Role:', userRole);
    console.log('Organization ID:', orgId);

    // Define role hierarchy and access levels
    const roleHierarchy = {
      individual: ['creator', 'assignee', 'user', 'employee', 'individual'],
      manager: ['manager', 'team_lead', 'mgr'],
      admin: ['org_admin', 'admin', 'super_admin', 'superadmin', 'organization']
    };

    // Determine user access level
    let accessLevel = 'individual';
    const normalizedRole = Array.isArray(userRole) ? userRole : [userRole];

    if (normalizedRole.some(role => roleHierarchy.admin.includes(role))) {
      accessLevel = 'admin';
    } else if (normalizedRole.some(role => roleHierarchy.manager.includes(role))) {
      accessLevel = 'manager';
    }

    console.log('Access Level Determined:', accessLevel);

    // Build base query filter
    const now = new Date();
    let queryFilter = {
      dueDate: { $lt: now },
      status: { $nin: ['DONE', 'CANCELLED'] },
      $or: [
        { isDeleted: { $exists: false } },
        { isDeleted: false },
        { isDeleted: { $ne: true } }
      ]
    };

    // 🎯 APPLY ROLE-BASED DATA FILTERING
    switch (accessLevel) {
      case 'individual':
        // Individual users: Only their own overdue tasks
        queryFilter.assignedTo = new ObjectId(userId);
        console.log('Individual access: filtering by assignedTo =', userId);
        break;

      case 'manager':
        // Managers: Team overdue tasks (users in same organization)
        const teamMembers = await User.find({
          $and: [
            {
              $or: [
                { organizationId: orgId },
                { organization_id: orgId },
                { orgId: orgId }
              ]
            },
            {
              $or: [
                { isDeleted: { $exists: false } },
                { isDeleted: false }
              ]
            }
          ]
        }).select('_id');

        const teamMemberIds = teamMembers.map(m => m._id);
        queryFilter.assignedTo = { $in: teamMemberIds };
        console.log('Manager access: filtering by team members =', teamMemberIds.length, 'users');
        break;

      case 'admin':
        // Admins: Full organization overdue tasks
        queryFilter.organization = new ObjectId(orgId);
        console.log('Admin access: filtering by organization =', orgId);
        break;

      default:
        // Default to individual access
        queryFilter.assignedTo = new ObjectId(userId);
        console.log('Default access: filtering by assignedTo =', userId);
        break;
    }

    // Additional filters
    if (priority) queryFilter.priority = priority;

    console.log('Query Filter:', JSON.stringify(queryFilter));

    // Fetch overdue tasks
    const overdueTasks = await Task.find(queryFilter)
      .select('title status priority dueDate createdAt assignedTo organization')
      .populate('assignedTo', 'firstName lastName email')
      .lean();

    console.log('Overdue tasks found:', overdueTasks.length);

    // Calculate overdue days and sort
    const tasksWithOverdueDays = overdueTasks.map(task => {
      const overdueDays = Math.ceil((now - new Date(task.dueDate)) / (1000 * 60 * 60 * 24));
      return {
        ...task,
        overdueDays,
        userName: task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}`.trim() : 'Unassigned'
      };
    });

    // Sort by overdue days (default) or other criteria
    if (sortBy === 'overdueDays') {
      tasksWithOverdueDays.sort((a, b) => b.overdueDays - a.overdueDays);
    } else if (sortBy === 'priority') {
      const priorityOrder = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 };
      tasksWithOverdueDays.sort((a, b) => (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0));
    }

    // Calculate summary statistics
    const totalOverdue = tasksWithOverdueDays.length;
    const criticalOverdue = tasksWithOverdueDays.filter(t => t.overdueDays > 7).length;
    const highPriorityOverdue = tasksWithOverdueDays.filter(t => t.priority === 'urgent' || t.priority === 'high').length;

    // Group by user for drill-down
    const overdueByUser = {};
    tasksWithOverdueDays.forEach(task => {
      const userKey = task.userName;
      if (!overdueByUser[userKey]) {
        overdueByUser[userKey] = {
          userName: userKey,
          totalOverdue: 0,
          criticalOverdue: 0,
          tasks: []
        };
      }
      overdueByUser[userKey].totalOverdue++;
      if (task.overdueDays > 7) overdueByUser[userKey].criticalOverdue++;
      overdueByUser[userKey].tasks.push(task);
    });

    const overdueByUserArray = Object.values(overdueByUser);

    // 📊 License consumption
    try {
      await licenseService.consumeFeature(userId, 'REPORT_OVERDUE', 1);
      console.log(`[ReportsController] 📊 REPORT_OVERDUE usage tracked for user ${userId}`);
    } catch (usageError) {
      console.error('[ReportsController] ⚠️ Failed to track REPORT_OVERDUE usage:', usageError.message);
    }

    res.json({
      success: true,
      data: {
        summary: {
          totalOverdue,
          criticalOverdue,
          highPriorityOverdue
        },
        overdueTasks: tasksWithOverdueDays,
        overdueByUser: overdueByUserArray
      }
    });
  } catch (error) {
    console.error('Error fetching overdue tasks report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch overdue tasks report',
      error: error.message
    });
  }
};

/**
 * Get Productivity & Efficiency Report
 * Path: /api/reports/productivity-efficiency
 * Role: Manager/Admin (team data) | Org Admin (full org data) | User (own data)
 * Returns: % tasks completed on/before vs after due date, visual charts
 * Document Reference: Section 6.0 - Report #3
 */
export const getProductivityEfficiencyReport = async (req, res) => {
  try {
    // 🔐 ROLE-BASED ACCESS CONTROL
    const userId = req.user.id || req.user._id;
    const userRole = req.user.role;
    const orgId = req.user.organizationId || req.user.organization_id;
    const { dateRange = '30', startDate, endDate, user, department } = req.query;

    console.log('=== Productivity & Efficiency Report Debug ===');
    console.log('User ID:', userId);
    console.log('User Role:', userRole);
    console.log('Organization ID:', orgId);

    // Define role hierarchy and access levels
    const roleHierarchy = {
      individual: ['creator', 'assignee', 'user', 'employee', 'individual'],
      manager: ['manager', 'team_lead', 'mgr'],
      admin: ['org_admin', 'admin', 'super_admin', 'superadmin', 'organization']
    };

    // Determine user access level
    let accessLevel = 'individual';
    const normalizedRole = Array.isArray(userRole) ? userRole : [userRole];

    if (normalizedRole.some(role => roleHierarchy.admin.includes(role))) {
      accessLevel = 'admin';
    } else if (normalizedRole.some(role => roleHierarchy.manager.includes(role))) {
      accessLevel = 'manager';
    }

    console.log('Access Level Determined:', accessLevel);

    // Get user's timezone
    const userTimezone = await TimezoneHelper.getUserTimezone(userId);

    // Calculate date filter - use completedAt OR completedDate for productivity reports
    // Some tasks use completedAt, others use completedDate - we'll filter for both
    const dateFilter = {};
    if (startDate && endDate) {
      const { startOfDay: start } = TimezoneHelper.getDayBoundaries(userTimezone, new Date(startDate));
      const { endOfDay: end } = TimezoneHelper.getDayBoundaries(userTimezone, new Date(endDate));
      // Filter for tasks where either completedAt or completedDate is in range
      dateFilter.$or = [
        { completedAt: { $gte: start, $lte: end } },
        { completedDate: { $gte: start, $lte: end } }
      ];
    } else if (dateRange) {
      const daysAgo = parseInt(dateRange) || 30;
      const pastDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      const { startOfDay: start } = TimezoneHelper.getDayBoundaries(userTimezone, pastDate);
      // Filter for tasks where either completedAt or completedDate is after start
      dateFilter.$or = [
        { completedAt: { $gte: start } },
        { completedDate: { $gte: start } }
      ];
    }

    // Build query filter
    // Combine date filter with isDeleted filter using $and
    let queryFilter = {
      status: 'DONE', // Only completed tasks for efficiency analysis
      $and: [
        {
          $or: [
            { isDeleted: { $exists: false } },
            { isDeleted: false },
            { isDeleted: { $ne: true } }
          ]
        }
      ]
    };

    // 🔐 Role-based data scoping - Individual users see only their own tasks
    if (accessLevel === 'admin' || accessLevel === 'manager') {
      if (orgId) {
        queryFilter.organization = new ObjectId(orgId);
      }
      if (user) queryFilter.assignedTo = user;
    } else {
      // accessLevel === 'individual'
      queryFilter.assignedTo = userId;
    }

    // Add date filter if it exists
    if (Object.keys(dateFilter).length > 0) {
      queryFilter.$and.push(dateFilter);
    }

    console.log('📊 Productivity Query Filter:', JSON.stringify(queryFilter, null, 2));

    // Fetch completed tasks - get all DONE tasks first, then filter for those with dates
    // Note: Some tasks use completedAt, others use completedDate - check both
    const allCompletedTasks = await Task.find(queryFilter)
      .select('title dueDate completedAt completedDate priority assignedTo')
      .populate('assignedTo', 'firstName lastName department')
      .lean();

    console.log('📊 All completed tasks found (before date filter):', allCompletedTasks.length);

    // Filter for tasks that have a completion date (either completedAt or completedDate)
    // For efficiency calculation, we need completion date. Due date is optional.
    const completedTasks = allCompletedTasks
      .map(task => {
        // Normalize completion date - use completedAt if available, otherwise completedDate
        const completionDate = task.completedAt || task.completedDate;
        return {
          ...task,
          completionDate: completionDate ? new Date(completionDate) : null
        };
      })
      .filter(task => task.completionDate !== null); // Must have a completion date

    console.log('📊 Completed tasks with completion date:', completedTasks.length);
    console.log('📊 Tasks with due date:', completedTasks.filter(t => t.dueDate).length);
    console.log('📊 Sample tasks:', completedTasks.slice(0, 3).map(t => ({
      title: t.title,
      completionDate: t.completionDate,
      dueDate: t.dueDate,
      hasDueDate: !!t.dueDate
    })));

    // Analyze completion timing
    // Only tasks with both completion date AND due date can be classified as on-time/late
    const tasksWithDueDate = completedTasks.filter(task => task.dueDate);
    const onTime = tasksWithDueDate.filter(task => {
      if (!task.completionDate || !task.dueDate) return false;
      const completedDate = task.completionDate;
      const dueDate = new Date(task.dueDate);
      return completedDate <= dueDate;
    });
    const late = tasksWithDueDate.filter(task => {
      if (!task.completionDate || !task.dueDate) return false;
      const completedDate = task.completionDate;
      const dueDate = new Date(task.dueDate);
      return completedDate > dueDate;
    });

    const totalCompleted = completedTasks.length;
    const onTimePercentage = totalCompleted > 0 ? Math.round((onTime.length / totalCompleted) * 100) : 0;
    const latePercentage = totalCompleted > 0 ? Math.round((late.length / totalCompleted) * 100) : 0;

    console.log('📊 Productivity Report Summary:', {
      totalCompleted,
      onTime: onTime.length,
      late: late.length,
      onTimePercentage,
      latePercentage
    });

    // Efficiency by priority
    const efficiencyByPriority = ['urgent', 'high', 'medium', 'low'].map(priority => {
      const priorityTasks = completedTasks.filter(t => t.priority === priority);
      const priorityTasksWithDueDate = priorityTasks.filter(t => t.dueDate);
      const priorityOnTime = priorityTasksWithDueDate.filter(t => {
        if (!t.completionDate || !t.dueDate) return false;
        return t.completionDate <= new Date(t.dueDate);
      });
      // Calculate efficiency based on tasks with due dates only
      const efficiency = priorityTasksWithDueDate.length > 0
        ? Math.round((priorityOnTime.length / priorityTasksWithDueDate.length) * 100)
        : 0;

      return {
        priority: priority.charAt(0).toUpperCase() + priority.slice(1),
        total: priorityTasks.length,
        onTime: priorityOnTime.length,
        efficiency
      };
    });

    // Weekly efficiency trend
    // Normalize completedTasks for the trend function (it expects completedAt field)
    const normalizedTasksForTrend = completedTasks.map(task => ({
      ...task,
      completedAt: task.completionDate
    }));
    const weeklyEfficiency = generateWeeklyEfficiencyTrend(normalizedTasksForTrend, parseInt(dateRange), userTimezone);

    // User efficiency rankings
    // Only count tasks with due dates for efficiency calculation
    const userEfficiencyMap = {};
    completedTasks.forEach(task => {
      if (!task.completionDate) return; // Skip tasks without completion date

      const userName = task.assignedTo
        ? `${task.assignedTo.firstName || ''} ${task.assignedTo.lastName || ''}`.trim() || 'Unassigned'
        : 'Unassigned';

      if (!userEfficiencyMap[userName]) {
        userEfficiencyMap[userName] = {
          userName,
          totalTasks: 0,
          onTimeTasks: 0,
          efficiency: 0
        };
      }

      // Only count tasks with due dates for efficiency metrics
      if (task.dueDate) {
        userEfficiencyMap[userName].totalTasks++;
        const completedDate = task.completionDate;
        const dueDate = new Date(task.dueDate);
        if (completedDate <= dueDate) {
          userEfficiencyMap[userName].onTimeTasks++;
        }
      }
    });

    const userEfficiency = Object.values(userEfficiencyMap)
      .filter(user => user.totalTasks >= 3) // Only show users with 3+ completed tasks
      .map(user => ({
        ...user,
        efficiency: Math.round((user.onTimeTasks / user.totalTasks) * 100)
      }))
      .sort((a, b) => b.efficiency - a.efficiency);

    // 📊 License consumption
    try {
      await licenseService.consumeFeature(userId, 'REPORT_PRODUCTIVITY', 1);
      console.log(`[ReportsController] 📊 REPORT_PRODUCTIVITY usage tracked for user ${userId}`);
    } catch (usageError) {
      console.error('[ReportsController] ⚠️ Failed to track REPORT_PRODUCTIVITY usage:', usageError.message);
    }

    // Ensure arrays are never undefined
    const response = {
      success: true,
      data: {
        summary: {
          totalCompleted: totalCompleted || 0,
          onTime: onTime.length || 0,
          late: late.length || 0,
          onTimePercentage: onTimePercentage || 0,
          latePercentage: latePercentage || 0
        },
        efficiencyByPriority: efficiencyByPriority || [],
        weeklyEfficiency: weeklyEfficiency || [],
        userEfficiency: userEfficiency || [],
        completedTasks: completedTasks || []
      }
    };

    console.log('📊 Productivity Report Response:', {
      summary: response.data.summary,
      efficiencyByPriorityCount: response.data.efficiencyByPriority.length,
      weeklyEfficiencyCount: response.data.weeklyEfficiency.length,
      userEfficiencyCount: response.data.userEfficiency.length
    });

    res.json(response);
  } catch (error) {
    console.error('Error fetching productivity efficiency report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch productivity efficiency report',
      error: error.message
    });
  }
};

/**
 * Get Workload Distribution Report
 * Path: /api/reports/workload-distribution
 * Role: Manager/Admin (team data) | Org Admin (full org data) | User (own data)
 * Returns: Tasks assigned per user broken down by priority, visual heatmap/bar chart
 * Document Reference: Section 6.0 - Report #4
 */
export const getWorkloadDistributionReport = async (req, res) => {
  try {
    // 🔐 ROLE-BASED ACCESS CONTROL
    const userId = req.user.id || req.user._id;
    const userRole = req.user.role;
    const orgId = req.user.organizationId || req.user.organization_id;
    const { dateRange = '30', startDate, endDate, status, department } = req.query;

    console.log('=== Workload Distribution Report Debug ===');
    console.log('User ID:', userId);
    console.log('User Role:', userRole);
    console.log('Organization ID:', orgId);

    // Define role hierarchy and access levels
    const roleHierarchy = {
      individual: ['creator', 'assignee', 'user', 'employee', 'individual'],
      manager: ['manager', 'team_lead', 'mgr'],
      admin: ['org_admin', 'admin', 'super_admin', 'superadmin', 'organization']
    };

    // Determine user access level
    let accessLevel = 'individual';
    const normalizedRole = Array.isArray(userRole) ? userRole : [userRole];

    if (normalizedRole.some(role => roleHierarchy.admin.includes(role))) {
      accessLevel = 'admin';
    } else if (normalizedRole.some(role => roleHierarchy.manager.includes(role))) {
      accessLevel = 'manager';
    }

    console.log('Access Level Determined:', accessLevel);

    // Get user's timezone
    const userTimezone = await TimezoneHelper.getUserTimezone(userId);

    // Calculate date filter using user's timezone
    const dateFilter = buildReportDateFilter(startDate, endDate, dateRange, userTimezone);

    // Get scope-specific user list first to filter tasks
    let userQuery = {
      $and: [
        {
          $or: [
            { organizationId: orgId },
            { organization_id: orgId },
            { orgId: orgId }
          ]
        },
        {
          $or: [
            { isDeleted: { $exists: false } },
            { isDeleted: false }
          ]
        }
      ]
    };

    if (accessLevel === 'manager') {
      // Managers see themselves and employees
      userQuery.role = { $in: ['employee', 'manager', 'individual'] };
    } else if (accessLevel === 'individual') {
      // Individuals see only themselves
      userQuery._id = new ObjectId(userId);
    }

    const allUsers = await User.find(userQuery).select('_id firstName lastName department email role').lean();
    const userIds = allUsers.map(u => u._id);

    console.log(`Scoped users found (${accessLevel}):`, allUsers.length);

    // Build query filter
    let queryFilter = {
      organization: new ObjectId(orgId),
      $or: [
        { isDeleted: { $exists: false } },
        { isDeleted: false },
        { isDeleted: { $ne: true } }
      ],
      ...dateFilter
    };

    // Filter tasks by the scoped user list (unless admin)
    if (accessLevel !== 'admin') {
      queryFilter.assignedTo = { $in: userIds };
    }

    if (status) queryFilter.status = status;

    // Fetch scoped tasks
    const tasks = await Task.find(queryFilter)
      .select('title status priority assignedTo createdAt')
      .populate('assignedTo', 'firstName lastName department email')
      .lean();

    console.log('Scoped tasks found for workload analysis:', tasks.length);

    // Calculate workload per user
    const workloadMap = {};

    // Initialize all users with zero workload
    allUsers.forEach(user => {
      const userName = `${user.firstName} ${user.lastName}`.trim();
      workloadMap[userName] = {
        userId: user._id,
        userName,
        email: user.email,
        department: user.department || 'Unassigned',
        role: user.role,
        totalTasks: 0,
        byPriority: {
          low: 0,
          medium: 0,
          high: 0,
          urgent: 0
        },
        byStatus: {
          open: 0,
          inProgress: 0,
          onHold: 0,
          done: 0
        }
      };
    });

    // Populate with actual task data
    tasks.forEach(task => {
      if (task.assignedTo) {
        const userName = `${task.assignedTo.firstName} ${task.assignedTo.lastName}`.trim();
        if (workloadMap[userName]) {
          workloadMap[userName].totalTasks++;

          // Count by priority
          const priority = task.priority || 'medium';
          if (workloadMap[userName].byPriority[priority] !== undefined) {
            workloadMap[userName].byPriority[priority]++;
          }

          // Count by status
          const statusKey = task.status === 'OPEN' ? 'open'
            : task.status === 'INPROGRESS' ? 'inProgress'
              : task.status === 'ONHOLD' ? 'onHold'
                : task.status === 'DONE' ? 'done'
                  : 'open';
          workloadMap[userName].byStatus[statusKey]++;
        }
      }
    });

    const workloadDistribution = Object.values(workloadMap)
      .sort((a, b) => b.totalTasks - a.totalTasks);

    // Department workload summary
    const departmentWorkload = {};
    workloadDistribution.forEach(user => {
      const dept = user.department;
      if (!departmentWorkload[dept]) {
        departmentWorkload[dept] = {
          department: dept,
          totalUsers: 0,
          totalTasks: 0,
          averageTasksPerUser: 0,
          byPriority: { low: 0, medium: 0, high: 0, urgent: 0 }
        };
      }
      departmentWorkload[dept].totalUsers++;
      departmentWorkload[dept].totalTasks += user.totalTasks;

      Object.keys(user.byPriority).forEach(priority => {
        departmentWorkload[dept].byPriority[priority] += user.byPriority[priority];
      });
    });

    // Calculate averages
    Object.values(departmentWorkload).forEach(dept => {
      dept.averageTasksPerUser = dept.totalUsers > 0
        ? Math.round(dept.totalTasks / dept.totalUsers * 10) / 10
        : 0;
    });

    const departmentWorkloadArray = Object.values(departmentWorkload)
      .sort((a, b) => b.totalTasks - a.totalTasks);

    // Workload balance analysis
    const taskCounts = workloadDistribution.map(u => u.totalTasks).filter(count => count > 0);
    const avgTasks = taskCounts.length > 0 ? taskCounts.reduce((a, b) => a + b, 0) / taskCounts.length : 0;
    const maxTasks = Math.max(...taskCounts, 0);
    const minTasks = Math.min(...taskCounts, 0);

    const overloaded = workloadDistribution.filter(u => u.totalTasks > avgTasks * 1.5).length;
    const underloaded = workloadDistribution.filter(u => u.totalTasks < avgTasks * 0.5 && u.totalTasks > 0).length;
    const balanced = workloadDistribution.filter(u => u.totalTasks >= avgTasks * 0.5 && u.totalTasks <= avgTasks * 1.5).length;

    // 📊 License consumption
    try {
      await licenseService.consumeFeature(userId, 'REPORT_WORKLOAD', 1);
      console.log(`[ReportsController] 📊 REPORT_WORKLOAD usage tracked for user ${userId}`);
    } catch (usageError) {
      console.error('[ReportsController] ⚠️ Failed to track REPORT_WORKLOAD usage:', usageError.message);
    }

    res.json({
      success: true,
      data: {
        summary: {
          totalUsers: allUsers.length,
          activeUsers: workloadDistribution.filter(u => u.totalTasks > 0).length,
          totalTasks: tasks.length,
          averageTasksPerUser: Math.round(avgTasks * 10) / 10,
          maxTasks,
          minTasks,
          overloaded,
          underloaded,
          balanced
        },
        workloadDistribution,
        departmentWorkload: departmentWorkloadArray,
        tasks
      }
    });
  } catch (error) {
    console.error('Error fetching workload distribution report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workload distribution report',
      error: error.message
    });
  }
};

/**
 * Get Activity/Engagement Report
 * Path: /api/reports/activity-engagement
 * Role: Manager/Admin (team data) | Org Admin (full org data) | User (own data)
 * Returns: User interaction metrics (comments, updates, logins)
 * Document Reference: Section 6.0 - Report #8
 */
export const getActivityEngagementReport = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const orgId = req.user.organizationId || req.user.organization_id;
    const userRole = req.user.role;
    const { dateRange = '30', startDate, endDate, team } = req.query;

    console.log('=== Activity/Engagement Report Debug ===');
    console.log('User ID:', userId);
    console.log('User Role:', userRole);
    console.log('Organization ID:', orgId);
    console.log('Date Range:', dateRange);

    // 🔐 Determine access level (consistent with other reports)
    const roleHierarchy = {
      individual: ['creator', 'assignee', 'user', 'employee', 'individual'],
      manager: ['manager', 'team_lead', 'mgr'],
      admin: ['org_admin', 'admin', 'super_admin', 'superadmin', 'organization']
    };

    let accessLevel = 'individual';
    const normalizedRole = Array.isArray(userRole) ? userRole : [userRole];
    if (normalizedRole.some(role => roleHierarchy.admin.includes(role))) {
      accessLevel = 'admin';
    } else if (normalizedRole.some(role => roleHierarchy.manager.includes(role))) {
      accessLevel = 'manager';
    }
    console.log('Access Level Determined:', accessLevel);

    // Get user's timezone
    const userTimezone = await TimezoneHelper.getUserTimezone(userId);

    // Calculate date filter using user's timezone
    const dateFilter = {};
    if (startDate && endDate) {
      const { startOfDay: start } = TimezoneHelper.getDayBoundaries(userTimezone, new Date(startDate));
      const { endOfDay: end } = TimezoneHelper.getDayBoundaries(userTimezone, new Date(endDate));
      dateFilter.createdAt = { $gte: start, $lte: end };
      dateFilter.updatedAt = { $gte: start, $lte: end };
    } else if (dateRange) {
      const daysAgo = parseInt(dateRange);
      const pastDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      const { startOfDay: start } = TimezoneHelper.getDayBoundaries(userTimezone, pastDate);
      dateFilter.createdAt = { $gte: start };
      dateFilter.updatedAt = { $gte: start };
    }

    const orgObjectId = new ObjectId(orgId);

    // Build org match defensively (we have multiple org field names in the codebase)
    const orgMatch = {
      $or: [
        { organization_id: orgObjectId },
        { organization_id: orgId }, // sometimes stored as string
        { organizationId: orgObjectId },
        { organizationId: orgId }, // sometimes stored as string
        { orgId: orgObjectId },
        { orgId: orgId },
        // legacy / alternate field name used in older parts of the codebase
        { organization: orgObjectId },
        { organization: orgId }
      ]
    };

    // Build user query with role/team scoping
    let userQuery = {
      $and: [
        orgMatch,
        {
          $or: [
            { isActive: { $exists: false } },
            { isActive: true }
          ]
        }
      ]
    };

    if (accessLevel === 'individual') {
      userQuery = { ...userQuery, _id: new ObjectId(userId) };
    } else if (accessLevel === 'manager') {
      const directReports = await User.find(
        { ...orgMatch, managerId: new ObjectId(userId) },
        { _id: 1 }
      ).lean();
      const scopedIds = [new ObjectId(userId), ...directReports.map(u => u._id)];
      userQuery = { ...userQuery, _id: { $in: scopedIds } };
    }

    if (team) {
      userQuery = { ...userQuery, department: team };
    }

    // Get scoped users (org membership)
    let users = await User.find(userQuery)
      .select('_id firstName lastName email role department lastLoginAt updatedAt')
      .lean();

    // Get tasks with comments and activities in date range
    const tasksQuery = {
      organization: orgObjectId,
      $and: [
        {
          $or: [
            { isDeleted: { $exists: false } },
            { isDeleted: false },
            { is_deleted: { $exists: false } },
            { is_deleted: false }
          ]
        },
        {
          $or: [
            dateFilter.createdAt ? { createdAt: dateFilter.createdAt } : {},
            dateFilter.updatedAt ? { updatedAt: dateFilter.updatedAt } : {}
          ]
        }
      ]
    };

    const tasks = await Task.find(tasksQuery)
      .select('createdBy assignedTo status createdAt updatedAt comments')
      .populate('assignedTo', 'firstName lastName name email department')
      .populate('createdBy', 'firstName lastName name email department')
      .populate('comments.author', 'firstName lastName name email department')
      .lean();

    // If user query returned 0 (org field mismatch), fall back to users referenced by tasks
    if (!users || users.length === 0) {
      const taskUserIds = new Set();
      tasks.forEach((t) => {
        if (t.createdBy?._id) taskUserIds.add(String(t.createdBy._id));
        if (t.assignedTo?._id) taskUserIds.add(String(t.assignedTo._id));
        (t.comments || []).forEach((c) => {
          if (c.author?._id) taskUserIds.add(String(c.author._id));
        });
      });

      const fallbackIds = Array.from(taskUserIds).map((id) => new ObjectId(id));
      if (fallbackIds.length > 0) {
        console.warn('⚠️ Activity report: org user query returned 0, falling back to users referenced by tasks:', fallbackIds.length);
        users = await User.find({ _id: { $in: fallbackIds } })
          .select('_id firstName lastName email role department lastLoginAt updatedAt')
          .lean();
      }
    }

    console.log('Users found for engagement analysis:', users.length);

    // If we have users, narrow tasks to that scope (so summary cards match scoped users)
    const scopeUserIds = (users || []).map(u => u._id);
    const scopedTasks = scopeUserIds.length === 0
      ? tasks
      : tasks.filter((t) => {
        const createdByMatch = t.createdBy?._id && scopeUserIds.some((id) => String(id) === String(t.createdBy._id));
        const assignedToMatch = t.assignedTo?._id && scopeUserIds.some((id) => String(id) === String(t.assignedTo._id));
        const commentMatch = (t.comments || []).some((c) => c.author?._id && scopeUserIds.some((id) => String(id) === String(c.author._id)));
        return createdByMatch || assignedToMatch || commentMatch;
      });

    console.log('Tasks with activity found:', scopedTasks.length);

    // Initialize engagement metrics
    const userEngagement = {};
    users.forEach(user => {
      const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown';
      userEngagement[user._id.toString()] = {
        id: user._id,
        name: displayName,
        email: user.email,
        role: user.role,
        department: user.department,
        tasksCreated: 0,
        tasksAssigned: 0,
        tasksCompleted: 0,
        commentsCount: 0,
        updatesCount: 0,
        loginsCount: 0,
        lastActive: user.lastLoginAt || user.updatedAt,
        engagementScore: 0
      };
    });

    // Approximate logins: lastLoginAt within timeframe counts as 1 login signal
    const loginStart = startDate && endDate
      ? TimezoneHelper.getDayBoundaries(userTimezone, new Date(startDate)).startOfDay
      : (dateRange ? (() => { const d = new Date(); d.setDate(d.getDate() - parseInt(dateRange)); return TimezoneHelper.getDayBoundaries(userTimezone, d).startOfDay; })() : null);
    const loginEnd = startDate && endDate ? TimezoneHelper.getDayBoundaries(userTimezone, new Date(endDate)).endOfDay : null;
    if (loginStart) {
      Object.values(userEngagement).forEach((u) => {
        // find corresponding user record
        const userRecord = users.find(x => String(x._id) === String(u.id));
        const lastLoginAt = userRecord?.lastLoginAt ? new Date(userRecord.lastLoginAt) : null;
        if (!lastLoginAt) return;
        const inRange = loginEnd ? (lastLoginAt >= loginStart && lastLoginAt <= loginEnd) : (lastLoginAt >= loginStart);
        if (inRange) u.loginsCount = 1;
      });
    }

    // Calculate task-based metrics
    scopedTasks.forEach(task => {
      // Tasks created
      if (task.createdBy && userEngagement[task.createdBy._id.toString()]) {
        userEngagement[task.createdBy._id.toString()].tasksCreated++;
      }

      // Tasks assigned
      if (task.assignedTo && userEngagement[task.assignedTo._id.toString()]) {
        userEngagement[task.assignedTo._id.toString()].tasksAssigned++;

        // Tasks completed
        if (task.status === 'DONE') {
          userEngagement[task.assignedTo._id.toString()].tasksCompleted++;
        }
      }

      // Count comments (from task.comments array) - schema uses comments.author
      if (task.comments && task.comments.length > 0) {
        task.comments.forEach(comment => {
          if (comment.author && userEngagement[comment.author._id.toString()]) {
            userEngagement[comment.author._id.toString()].commentsCount++;
          }
        });
      }

      // Count updates (approximate based on updatedAt vs createdAt)
      if (task.updatedAt && task.createdAt) {
        const updateTime = new Date(task.updatedAt) - new Date(task.createdAt);
        if (updateTime > 60000 && task.assignedTo && userEngagement[task.assignedTo._id.toString()]) { // More than 1 minute difference
          userEngagement[task.assignedTo._id.toString()].updatesCount++;
        }
      }
    });

    // Calculate engagement scores
    Object.keys(userEngagement).forEach(userId => {
      const user = userEngagement[userId];
      user.engagementScore = Math.round(
        (user.tasksCreated * 3) +
        (user.tasksCompleted * 5) +
        (user.commentsCount * 2) +
        (user.updatesCount * 1) +
        (user.loginsCount * 1)
      );
    });

    // Convert to array and sort by engagement score
    const engagementData = Object.values(userEngagement)
      .sort((a, b) => b.engagementScore - a.engagementScore);

    // Calculate summary metrics
    const totalComments = engagementData.reduce((sum, user) => sum + user.commentsCount, 0);
    const totalUpdates = engagementData.reduce((sum, user) => sum + user.updatesCount, 0);
    const totalLogins = engagementData.reduce((sum, user) => sum + (user.loginsCount || 0), 0);
    const activeUsers = engagementData.filter(user =>
      user.tasksCreated > 0 || user.tasksCompleted > 0 ||
      user.commentsCount > 0 || user.updatesCount > 0 || (user.loginsCount || 0) > 0
    ).length;

    // Department engagement
    const departmentEngagement = {};
    engagementData.forEach(user => {
      const dept = user.department || 'Unassigned';
      if (!departmentEngagement[dept]) {
        departmentEngagement[dept] = {
          name: dept,
          users: 0,
          totalScore: 0,
          comments: 0,
          tasks: 0
        };
      }
      departmentEngagement[dept].users++;
      departmentEngagement[dept].totalScore += user.engagementScore;
      departmentEngagement[dept].comments += user.commentsCount;
      departmentEngagement[dept].tasks += user.tasksCompleted;
    });

    const departmentEngagementArray = Object.values(departmentEngagement)
      .map(dept => ({
        ...dept,
        avgScore: dept.users > 0 ? Math.round(dept.totalScore / dept.users) : 0
      }))
      .sort((a, b) => b.avgScore - a.avgScore);

    // Generate daily engagement trend (last 7 days)
    const engagementTrend = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const refDate = new Date(now);
      refDate.setDate(refDate.getDate() - i);
      const { startOfDay: date, endOfDay: dayEnd } = TimezoneHelper.getDayBoundaries(userTimezone, refDate);
      const nextDate = new Date(dayEnd.getTime() + 1);

      const dayTasks = tasks.filter(t => {
        const createdDate = new Date(t.createdAt);
        const updatedDate = new Date(t.updatedAt);
        return (createdDate >= date && createdDate < nextDate) ||
          (updatedDate >= date && updatedDate < nextDate);
      });

      const dayComments = dayTasks.reduce((sum, task) => {
        return sum + (task.comments?.filter(c => {
          const commentDate = new Date(c.createdAt || c.timestamp || task.createdAt);
          return commentDate >= date && commentDate < nextDate;
        }).length || 0);
      }, 0);

      engagementTrend.push({
        date: TimezoneHelper.formatInTimezone(date, userTimezone),
        tasks: dayTasks.length,
        comments: dayComments,
        updates: dayTasks.filter(t => t.updatedAt && new Date(t.updatedAt) >= date && new Date(t.updatedAt) < nextDate).length
      });
    }

    const responseData = {
      summary: {
        totalUsers: users.length,
        activeUsers,
        totalComments,
        totalUpdates,
        totalLogins,
        avgEngagementScore: activeUsers > 0 ? Math.round(engagementData.reduce((sum, user) => sum + user.engagementScore, 0) / activeUsers) : 0,
        engagementRate: users.length > 0 ? Math.round((activeUsers / users.length) * 100) : 0
      },
      userEngagement: engagementData.slice(0, 20), // Top 20 users
      departmentEngagement: departmentEngagementArray,
      engagementTrend
    };

    console.log('📊 Activity Report Response:', {
      totalUsers: users.length,
      activeUsers,
      totalComments,
      totalUpdates,
      responseDataSize: JSON.stringify(responseData).length
    });

    // 📊 License consumption
    try {
      await licenseService.consumeFeature(userId, 'REPORT_ACTIVITY', 1);
      console.log(`[ReportsController] 📊 REPORT_ACTIVITY usage tracked for user ${userId}`);
    } catch (usageError) {
      console.error('[ReportsController] ⚠️ Failed to track REPORT_ACTIVITY usage:', usageError.message);
    }

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error fetching activity engagement report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity engagement report',
      error: error.message
    });
  }
};

/**
 * Helper function to generate weekly trend data
 */
function generateWeeklyTrend(tasks, days, rangeStart, rangeEnd) {
  // Use explicit range if provided (from filters). Fallback to "last N days".
  const end = rangeEnd ? new Date(rangeEnd) : new Date();
  const start = rangeStart
    ? new Date(rangeStart)
    : (() => {
      const d = new Date(end);
      const safeDays = Number.isFinite(Number(days)) ? Number(days) : 30;
      d.setDate(d.getDate() - safeDays);
      return d;
    })();

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const msInDay = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime() + 1) / msInDay));
  const weeks = Math.max(1, Math.ceil(totalDays / 7));

  const weekData = [];

  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() + i * 7);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    weekEnd.setHours(0, 0, 0, 0);

    const bucketEnd = weekEnd > end ? new Date(end) : weekEnd;

    const weekTasks = tasks.filter((t) => {
      const createdDate = new Date(t.createdAt);
      return createdDate >= weekStart && createdDate < bucketEnd;
    });

    const weekCompleted = weekTasks.filter((t) => t.status === 'DONE').length;

    // IMPORTANT: send an ISO date so the frontend never parses "Week 1" into year 2001
    weekData.push({
      date: weekStart.toISOString().slice(0, 10), // YYYY-MM-DD
      assigned: weekTasks.length,
      completed: weekCompleted,
    });
  }

  return weekData;
}

/**
 * Generate Upcoming Due Dates data
 * Returns tasks grouped by due date for the next 7 days
 */
function generateUpcomingDueDates(tasks, userTimezone = 'UTC') {
  const result = [];

  // Get next 7 days in user's timezone
  for (let i = 0; i < 7; i++) {
    const refDate = new Date();
    refDate.setDate(refDate.getDate() + i);
    const { startOfDay: targetDate, endOfDay } = TimezoneHelper.getDayBoundaries(userTimezone, refDate);
    const nextDay = new Date(endOfDay.getTime() + 1);

    // Count tasks due on this day
    const tasksOnDay = tasks.filter(t => {
      if (!t.dueDate) return false;
      const dueDate = new Date(t.dueDate);
      return dueDate >= targetDate && dueDate < nextDay && t.status !== 'DONE';
    });

    // Format date as "Mon 11" or similar
    const dateStr = TimezoneHelper.formatInTimezone(targetDate, userTimezone, {
      month: 'short',
      day: 'numeric'
    });

    result.push({
      date: dateStr,
      count: tasksOnDay.length
    });
  }

  return result;
}

/**
 * Export Report Data
 * Path: /api/reports/export
 * Role: Admin (with export permissions)
 * Returns: CSV/Excel/PDF formatted report data
 * Module 6: R-010 - Export Functionality
 */
export const exportReport = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const userRole = req.user.role;
    const orgId = req.user.organizationId || req.user.organization_id;
    const userTimezone = await TimezoneHelper.getUserTimezone(userId);

    const {
      reportType = 'productivity',
      format = 'csv',
      dateRange = '30',
      status,
      priority
    } = req.query;

    console.log('=== Export Report Request ===');
    console.log('User ID:', userId);
    console.log('Report Type:', reportType);
    console.log('Format:', format);
    console.log('Date Range:', dateRange);

    // Determine report scope based on role and reportType
    let reportData;
    let reportTitle;

    switch (reportType) {
      case 'productivity':
      case 'my-productivity':
        reportData = await getProductivityReportData(userId, dateRange, status, priority);
        reportTitle = 'My Productivity Report';
        break;

      case 'team':
      case 'team-analytics':
        // Verify manager access
        const allowedManagerRoles = ['manager', 'org_admin', 'admin', 'super_admin', 'superadmin', 'organization'];
        const hasManagerAccess = Array.isArray(userRole)
          ? userRole.some(role => allowedManagerRoles.includes(role))
          : allowedManagerRoles.includes(userRole);

        if (!hasManagerAccess) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. Manager role required.'
          });
        }

        reportData = await getTeamReportData(orgId, userId, dateRange, status, priority);
        reportTitle = 'Team Analytics Report';
        break;

      case 'organization':
      case 'organization-analytics':
        // Verify org admin access
        const allowedOrgRoles = ['org_admin', 'admin', 'super_admin', 'superadmin', 'organization'];
        const hasOrgAccess = Array.isArray(userRole)
          ? userRole.some(role => allowedOrgRoles.includes(role))
          : allowedOrgRoles.includes(userRole);

        if (!hasOrgAccess) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. Organization admin role required.'
          });
        }

        reportData = await getOrganizationReportData(orgId, dateRange, status, priority);
        reportTitle = 'Organization Analytics Report';
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid report type. Use: productivity, team, or organization'
        });
    }

    // 📊 Track REPORT_ADV usage for export (exports count as report generation)
    try {
      await licenseService.consumeFeature(userId, 'REPORT_ADV', 1);
      console.log(`[ReportsController] 📊 REPORT_ADV usage tracked for export by user ${userId}`);
    } catch (usageError) {
      console.error('[ReportsController] ⚠️ Failed to track REPORT_ADV usage:', usageError.message);
    }

    // Generate export based on format
    switch (format.toLowerCase()) {
      case 'csv':
        await exportToCSV(res, reportData, reportTitle, userTimezone);
        break;

      case 'excel':
      case 'xlsx':
        await exportToExcel(res, reportData, reportTitle, userTimezone);
        break;

      case 'pdf':
        await exportToPDF(res, reportData, reportTitle, userTimezone);
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid format. Use: csv, excel, or pdf'
        });
    }
  } catch (error) {
    console.error('Error exporting report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export report',
      error: error.message
    });
  }
};

/**
 * Get Productivity Report Data for Export
 */
async function getProductivityReportData(userId, dateRange, status, priority) {
  const dateFilter = {};
  if (dateRange) {
    const daysAgo = parseInt(dateRange);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);
    dateFilter.createdAt = { $gte: startDate };
  }

  const queryFilter = {
    assignedTo: userId,
    $or: [
      { isDeleted: { $exists: false } },
      { isDeleted: false },
      { isDeleted: { $ne: true } }
    ],
    ...dateFilter
  };

  if (status) queryFilter.status = status;
  if (priority) queryFilter.priority = priority;

  const tasks = await Task.find(queryFilter)
    .select('title description status priority dueDate createdAt completedDate tags')
    .lean();

  const now = new Date();
  const totalTasks = tasks.length;
  const completed = tasks.filter(t => t.status === 'DONE').length;
  const onHold = tasks.filter(t => t.status === 'ONHOLD').length;
  const overdue = tasks.filter(t =>
    t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE'
  ).length;

  return {
    type: 'productivity',
    kpis: {
      totalTasks,
      completed,
      onHold,
      overdue,
      completionRate: totalTasks > 0 ? ((completed / totalTasks) * 100).toFixed(1) : 0
    },
    tasks,
    statusDistribution: [
      { name: 'Open', value: tasks.filter(t => t.status === 'OPEN').length },
      { name: 'In Progress', value: tasks.filter(t => t.status === 'INPROGRESS').length },
      { name: 'On Hold', value: onHold },
      { name: 'Done', value: completed }
    ],
    priorityLoad: [
      { name: 'Low', tasks: tasks.filter(t => t.priority === 'low').length },
      { name: 'Medium', tasks: tasks.filter(t => t.priority === 'medium').length },
      { name: 'High', tasks: tasks.filter(t => t.priority === 'high').length },
      { name: 'Critical', tasks: tasks.filter(t => t.priority === 'urgent').length }
    ]
  };
}

/**
 * Get Team Report Data for Export
 */
async function getTeamReportData(orgId, userId, dateRange, status, priority) {
  const dateFilter = {};
  if (dateRange) {
    const daysAgo = parseInt(dateRange);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);
    dateFilter.createdAt = { $gte: startDate };
  }

  const teamMembers = await User.find({
    organization_id: orgId,
    role: { $in: ['employee', 'manager'] },
    isActive: true
  }).select('_id firstName lastName email role').lean();

  const teamMemberIds = teamMembers.map(m => m._id);

  const queryFilter = {
    assignedTo: { $in: teamMemberIds },
    $or: [
      { isDeleted: { $exists: false } },
      { isDeleted: false },
      { isDeleted: { $ne: true } }
    ],
    ...dateFilter
  };

  if (status) queryFilter.status = status;
  if (priority) queryFilter.priority = priority;

  const tasks = await Task.find(queryFilter)
    .select('title status priority dueDate createdAt completedDate assignedTo isRisk')
    .populate('assignedTo', 'firstName lastName email')
    .lean();

  const now = new Date();
  const totalTeamTasks = tasks.length;
  const completed = tasks.filter(t => t.status === 'DONE').length;
  const overdue = tasks.filter(t =>
    t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE'
  ).length;
  const atRisk = tasks.filter(t => t.isRisk === true).length;

  const workloadByMember = teamMembers.map(member => {
    const memberTasks = tasks.filter(t =>
      t.assignedTo && t.assignedTo._id.toString() === member._id.toString()
    );
    const memberCompleted = memberTasks.filter(t => t.status === 'DONE').length;

    return {
      name: `${member.firstName} ${member.lastName}`.trim(),
      email: member.email,
      tasks: memberTasks.length,
      completed: memberCompleted,
      completionRate: memberTasks.length > 0 ? ((memberCompleted / memberTasks.length) * 100).toFixed(1) : 0
    };
  });

  return {
    type: 'team',
    kpis: {
      totalTeamTasks,
      completed,
      overdue,
      atRisk,
      teamMembers: teamMembers.length,
      completionRate: totalTeamTasks > 0 ? ((completed / totalTeamTasks) * 100).toFixed(1) : 0
    },
    tasks,
    workloadByMember,
    statusDistribution: [
      { name: 'Open', value: tasks.filter(t => t.status === 'OPEN').length },
      { name: 'In Progress', value: tasks.filter(t => t.status === 'INPROGRESS').length },
      { name: 'On Hold', value: tasks.filter(t => t.status === 'ONHOLD').length },
      { name: 'Done', value: completed }
    ]
  };
}

/**
 * Get Organization Report Data for Export
 */
async function getOrganizationReportData(orgId, dateRange, status, priority) {
  const dateFilter = {};
  if (dateRange) {
    const daysAgo = parseInt(dateRange);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);
    dateFilter.createdAt = { $gte: startDate };
  }

  const queryFilter = {
    organization: new ObjectId(orgId),
    $or: [
      { isDeleted: { $exists: false } },
      { isDeleted: false },
      { isDeleted: { $ne: true } }
    ],
    ...dateFilter
  };

  if (status) queryFilter.status = status;
  if (priority) queryFilter.priority = priority;

  const tasks = await Task.find(queryFilter)
    .select('title status priority dueDate createdAt completedDate assignedTo isRisk')
    .populate('assignedTo', 'firstName lastName department')
    .lean();

  const now = new Date();
  const totalOrgTasks = tasks.length;
  const completed = tasks.filter(t => t.status === 'DONE').length;
  const riskTasks = tasks.filter(t => t.isRisk === true).length;

  const activeTeams = await User.distinct('department', {
    organization_id: orgId,
    isActive: true,
    department: { $exists: true, $ne: null }
  });

  const departmentMap = {};
  tasks.forEach(task => {
    const dept = task.assignedTo?.department || 'Unassigned';
    if (!departmentMap[dept]) {
      departmentMap[dept] = { total: 0, completed: 0 };
    }
    departmentMap[dept].total++;
    if (task.status === 'DONE') {
      departmentMap[dept].completed++;
    }
  });

  const tasksByDepartment = Object.keys(departmentMap).map(dept => ({
    name: dept,
    tasks: departmentMap[dept].total,
    completed: departmentMap[dept].completed,
    completionRate: departmentMap[dept].total > 0
      ? ((departmentMap[dept].completed / departmentMap[dept].total) * 100).toFixed(1)
      : 0
  }));

  return {
    type: 'organization',
    kpis: {
      totalOrgTasks,
      completed,
      activeTeams: activeTeams.length,
      riskTasks,
      completionRate: totalOrgTasks > 0 ? ((completed / totalOrgTasks) * 100).toFixed(1) : 0
    },
    tasks,
    tasksByDepartment,
    priorityDistribution: [
      { name: 'Low', value: tasks.filter(t => t.priority === 'low').length },
      { name: 'Medium', value: tasks.filter(t => t.priority === 'medium').length },
      { name: 'High', value: tasks.filter(t => t.priority === 'high').length },
      { name: 'Critical', value: tasks.filter(t => t.priority === 'urgent').length }
    ]
  };
}

/**
 * Export report to CSV format with proper formatting
 */
async function exportToCSV(res, reportData, reportTitle, userTimezone = 'UTC') {
  const timestamp = new Date().toISOString().split('T')[0];

  // Helper function to escape CSV values
  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // If contains comma, newline, or quote, wrap in quotes and escape internal quotes
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvRows = [];

  // Header Section
  csvRows.push([escapeCSV(reportTitle)]);
  csvRows.push([escapeCSV(`Generated: ${TimezoneHelper.formatDateTimeInTimezone(new Date(), userTimezone)}`)]);
  csvRows.push([escapeCSV(`Date Range: Last ${reportData.dateRange || 30} days`)]);
  csvRows.push([]); // Empty row for spacing

  // ==================== KPIs Section ====================
  csvRows.push(['=== KEY PERFORMANCE INDICATORS ===']);
  csvRows.push(['Metric', 'Value'].map(escapeCSV));

  Object.entries(reportData.kpis).forEach(([key, value]) => {
    const label = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
    csvRows.push([escapeCSV(label), escapeCSV(value)]);
  });
  csvRows.push([]); // Empty row for spacing

  // ==================== Status Distribution ====================
  if (reportData.statusDistribution) {
    csvRows.push(['=== STATUS DISTRIBUTION ===']);
    csvRows.push(['Status', 'Count'].map(escapeCSV));
    reportData.statusDistribution.forEach(item => {
      csvRows.push([escapeCSV(item.name), escapeCSV(item.value)]);
    });
    csvRows.push([]);
  }

  // ==================== Priority Distribution ====================
  if (reportData.priorityLoad) {
    csvRows.push(['=== PRIORITY DISTRIBUTION ===']);
    csvRows.push(['Priority', 'Count'].map(escapeCSV));
    reportData.priorityLoad.forEach(item => {
      csvRows.push([escapeCSV(item.name), escapeCSV(item.tasks)]);
    });
    csvRows.push([]);
  }

  if (reportData.priorityDistribution) {
    csvRows.push(['=== PRIORITY DISTRIBUTION ===']);
    csvRows.push(['Priority', 'Count'].map(escapeCSV));
    reportData.priorityDistribution.forEach(item => {
      csvRows.push([escapeCSV(item.name), escapeCSV(item.value)]);
    });
    csvRows.push([]);
  }

  /**
   * Helper function to generate weekly efficiency trend for productivity report
   */
  function generateWeeklyEfficiencyTrend(completedTasks, days) {
    const weeks = Math.ceil(days / 7);
    const weekData = [];
    const now = new Date();

    for (let i = weeks - 1; i >= 0; i--) {
      const wsRef = new Date(now);
      wsRef.setDate(wsRef.getDate() - (i * 7 + 6));
      const { startOfDay: weekStart } = TimezoneHelper.getDayBoundaries(userTimezone, wsRef);

      const weRef = new Date(now);
      weRef.setDate(weRef.getDate() - (i * 7));
      const { endOfDay: weekEnd } = TimezoneHelper.getDayBoundaries(userTimezone, weRef);

      const weekTasks = completedTasks.filter(task => {
        const completedDate = new Date(task.completedAt);
        return completedDate >= weekStart && completedDate <= weekEnd;
      });

      const onTime = weekTasks.filter(task =>
        new Date(task.completedAt) <= new Date(task.dueDate)
      ).length;

      const efficiency = weekTasks.length > 0 ? Math.round((onTime / weekTasks.length) * 100) : 0;

      weekData.push({
        week: `Week ${weeks - i}`,
        date: TimezoneHelper.formatInTimezone(weekStart, userTimezone),
        total: weekTasks.length,
        onTime,
        efficiency
      });
    }

    return weekData;
  }

  /**
   * Helper function to generate daily engagement trend for activity report
   */
  function generateDailyEngagementTrend(comments, activities, days) {
    const dailyData = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const refDay = new Date(now);
      refDay.setDate(refDay.getDate() - i);
      const { startOfDay: day, endOfDay: dayEnd } = TimezoneHelper.getDayBoundaries(userTimezone, refDay);

      const dayComments = comments.filter(comment => {
        const commentDate = new Date(comment.createdAt);
        return commentDate >= day && commentDate <= dayEnd;
      }).length;

      const dayActivities = Array.isArray(activities) ? activities.filter(activity => {
        const activityDate = new Date(activity.createdAt);
        return activityDate >= day && activityDate <= dayEnd;
      }).length : 0;

      dailyData.push({
        date: TimezoneHelper.formatInTimezone(day, userTimezone),
        comments: dayComments,
        activities: dayActivities,
        total: dayComments + dayActivities
      });
    }

    return dailyData;
  }

  // ==================== Tasks Details ====================
  csvRows.push(['=== TASKS DETAILS ===']);
  csvRows.push(['#', 'Title', 'Status', 'Priority', 'Due Date', 'Created Date', 'Completed Date'].map(escapeCSV));

  reportData.tasks.forEach((task, index) => {
    csvRows.push([
      escapeCSV(index + 1),
      escapeCSV(task.title || 'Untitled'),
      escapeCSV(task.status || 'N/A'),
      escapeCSV(task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : 'N/A'),
      escapeCSV(task.dueDate ? TimezoneHelper.formatInTimezone(new Date(task.dueDate), userTimezone) : 'Not Set'),
      escapeCSV(task.createdAt ? TimezoneHelper.formatInTimezone(new Date(task.createdAt), userTimezone) : 'N/A'),
      escapeCSV(task.completedDate ? TimezoneHelper.formatInTimezone(new Date(task.completedDate), userTimezone) : 'Not Completed')
    ]);
  });
  csvRows.push([]);

  // ==================== Team Workload (for team reports) ====================
  if (reportData.workloadByMember && reportData.workloadByMember.length > 0) {
    csvRows.push(['=== TEAM WORKLOAD ===']);
    csvRows.push(['#', 'Name', 'Email', 'Total Tasks', 'Completed', 'Completion Rate (%)'].map(escapeCSV));

    reportData.workloadByMember.forEach((member, index) => {
      csvRows.push([
        escapeCSV(index + 1),
        escapeCSV(member.name || 'Unknown'),
        escapeCSV(member.email || 'N/A'),
        escapeCSV(member.tasks || 0),
        escapeCSV(member.completed || 0),
        escapeCSV(`${member.completionRate || 0}%`)
      ]);
    });
    csvRows.push([]);
  }

  // ==================== Department Summary (for org reports) ====================
  if (reportData.tasksByDepartment && reportData.tasksByDepartment.length > 0) {
    csvRows.push(['=== DEPARTMENT SUMMARY ===']);
    csvRows.push(['#', 'Department', 'Total Tasks', 'Completed', 'Completion Rate (%)'].map(escapeCSV));

    reportData.tasksByDepartment.forEach((dept, index) => {
      csvRows.push([
        escapeCSV(index + 1),
        escapeCSV(dept.name || 'Unassigned'),
        escapeCSV(dept.tasks || 0),
        escapeCSV(dept.completed || 0),
        escapeCSV(`${dept.completionRate || 0}%`)
      ]);
    });
    csvRows.push([]);
  }

  // Footer
  csvRows.push(['']);
  csvRows.push([escapeCSV(`Report generated by TaskSetu Admin on ${TimezoneHelper.formatDateTimeInTimezone(new Date(), userTimezone)}`)]);

  const csv = csvRows.map(row => row.join(',')).join('\r\n');

  const csvFilename = `${reportTitle.replace(/\s+/g, '_')}_${timestamp}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=${csvFilename}`);
  // Add BOM for Excel to recognize UTF-8
  res.send('\uFEFF' + csv);
}

/**
 * Export report to Excel format with rich formatting and proper tables
 */
async function exportToExcel(res, reportData, reportTitle, userTimezone = 'UTC') {
  const workbook = new ExcelJS.Workbook();
  const timestamp = new Date().toISOString().split('T')[0];

  workbook.creator = 'TaskSetu Admin';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Define styles
  const headerStyle = {
    font: { bold: true, color: { argb: 'FFFFFF' }, size: 12 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '3B82F6' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: {
      top: { style: 'thin', color: { argb: '000000' } },
      left: { style: 'thin', color: { argb: '000000' } },
      bottom: { style: 'thin', color: { argb: '000000' } },
      right: { style: 'thin', color: { argb: '000000' } }
    }
  };

  const cellBorder = {
    top: { style: 'thin', color: { argb: 'CCCCCC' } },
    left: { style: 'thin', color: { argb: 'CCCCCC' } },
    bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
    right: { style: 'thin', color: { argb: 'CCCCCC' } }
  };

  const statusColors = {
    'OPEN': 'FEF3C7',      // Yellow
    'INPROGRESS': 'DBEAFE', // Blue
    'ONHOLD': 'FEE2E2',     // Red
    'DONE': 'D1FAE5'        // Green
  };

  const priorityColors = {
    'low': 'D1FAE5',        // Green
    'medium': 'FEF3C7',     // Yellow
    'high': 'FED7AA',       // Orange
    'urgent': 'FEE2E2'      // Red
  };

  // ==================== SUMMARY SHEET ====================
  const summarySheet = workbook.addWorksheet('Summary', {
    properties: { tabColor: { argb: '3B82F6' } }
  });

  // Title Row
  summarySheet.mergeCells('A1:F1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = reportTitle;
  titleCell.font = { size: 20, bold: true, color: { argb: 'FFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '3B82F6' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  summarySheet.getRow(1).height = 35;

  // Generated date row
  summarySheet.mergeCells('A2:F2');
  const dateCell = summarySheet.getCell('A2');
  dateCell.value = `Generated: ${TimezoneHelper.formatDateTimeInTimezone(new Date(), userTimezone)}`;
  dateCell.font = { size: 11, italic: true, color: { argb: '666666' } };
  dateCell.alignment = { horizontal: 'center' };
  summarySheet.getRow(2).height = 22;

  // KPIs Section
  let currentRow = 4;

  // KPI Header
  summarySheet.mergeCells(`A${currentRow}:B${currentRow}`);
  const kpiHeader = summarySheet.getCell(`A${currentRow}`);
  kpiHeader.value = '📊 KEY PERFORMANCE INDICATORS';
  kpiHeader.font = { size: 14, bold: true, color: { argb: '1E40AF' } };
  currentRow++;

  // KPI Table Headers
  summarySheet.getCell(`A${currentRow}`).value = 'Metric';
  summarySheet.getCell(`B${currentRow}`).value = 'Value';
  ['A', 'B'].forEach(col => {
    const cell = summarySheet.getCell(`${col}${currentRow}`);
    Object.assign(cell, headerStyle);
  });
  summarySheet.getRow(currentRow).height = 25;
  currentRow++;

  // KPI Data
  Object.entries(reportData.kpis).forEach(([key, value]) => {
    const label = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();

    const metricCell = summarySheet.getCell(`A${currentRow}`);
    metricCell.value = label;
    metricCell.border = cellBorder;
    metricCell.font = { size: 11 };

    const valueCell = summarySheet.getCell(`B${currentRow}`);
    valueCell.value = typeof value === 'string' && value.includes('%') ? value : value;
    valueCell.border = cellBorder;
    valueCell.font = { size: 11, bold: true };
    valueCell.alignment = { horizontal: 'center' };

    // Highlight completion rate
    if (key.toLowerCase().includes('rate')) {
      valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1FAE5' } };
    }

    currentRow++;
  });

  currentRow += 2;

  // Status Distribution
  if (reportData.statusDistribution) {
    summarySheet.mergeCells(`A${currentRow}:B${currentRow}`);
    summarySheet.getCell(`A${currentRow}`).value = '📈 STATUS DISTRIBUTION';
    summarySheet.getCell(`A${currentRow}`).font = { size: 14, bold: true, color: { argb: '1E40AF' } };
    currentRow++;

    summarySheet.getCell(`A${currentRow}`).value = 'Status';
    summarySheet.getCell(`B${currentRow}`).value = 'Count';
    ['A', 'B'].forEach(col => {
      Object.assign(summarySheet.getCell(`${col}${currentRow}`), headerStyle);
    });
    currentRow++;

    reportData.statusDistribution.forEach(item => {
      summarySheet.getCell(`A${currentRow}`).value = item.name;
      summarySheet.getCell(`A${currentRow}`).border = cellBorder;
      summarySheet.getCell(`B${currentRow}`).value = item.value;
      summarySheet.getCell(`B${currentRow}`).border = cellBorder;
      summarySheet.getCell(`B${currentRow}`).alignment = { horizontal: 'center' };
      currentRow++;
    });
  }

  // Set column widths for summary sheet
  summarySheet.getColumn('A').width = 35;
  summarySheet.getColumn('B').width = 20;
  summarySheet.getColumn('C').width = 15;
  summarySheet.getColumn('D').width = 15;
  summarySheet.getColumn('E').width = 15;
  summarySheet.getColumn('F').width = 15;

  // ==================== TASKS SHEET ====================
  const tasksSheet = workbook.addWorksheet('Tasks', {
    properties: { tabColor: { argb: '10B981' } }
  });

  // Tasks header
  const taskHeaders = ['#', 'Title', 'Status', 'Priority', 'Due Date', 'Created Date', 'Completed Date'];
  const taskHeaderRow = tasksSheet.addRow(taskHeaders);
  taskHeaderRow.height = 28;

  taskHeaderRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '10B981' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: '000000' } },
      left: { style: 'thin', color: { argb: '000000' } },
      bottom: { style: 'thin', color: { argb: '000000' } },
      right: { style: 'thin', color: { argb: '000000' } }
    };
  });

  // Tasks data
  reportData.tasks.forEach((task, index) => {
    const row = tasksSheet.addRow([
      index + 1,
      task.title || 'Untitled',
      task.status || 'N/A',
      task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : 'N/A',
      task.dueDate ? TimezoneHelper.formatInTimezone(new Date(task.dueDate), userTimezone) : 'Not Set',
      task.createdAt ? TimezoneHelper.formatInTimezone(new Date(task.createdAt), userTimezone) : 'N/A',
      task.completedDate ? TimezoneHelper.formatInTimezone(new Date(task.completedDate), userTimezone) : '-'
    ]);

    row.eachCell((cell, colNumber) => {
      cell.border = cellBorder;
      cell.alignment = { vertical: 'middle', wrapText: colNumber === 2 };

      // Center align numbers and dates
      if (colNumber !== 2) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });

    // Color-code status
    const statusCell = row.getCell(3);
    if (statusColors[task.status]) {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusColors[task.status] } };
    }

    // Color-code priority
    const priorityCell = row.getCell(4);
    if (priorityColors[task.priority]) {
      priorityCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: priorityColors[task.priority] } };
    }

    // Alternate row colors
    if (index % 2 === 1) {
      row.eachCell((cell, colNumber) => {
        if (!cell.fill || cell.fill.type !== 'pattern' || cell.fill.fgColor?.argb === undefined) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F9FAFB' } };
        }
      });
    }
  });

  // Set column widths for tasks sheet
  tasksSheet.getColumn(1).width = 6;   // #
  tasksSheet.getColumn(2).width = 50;  // Title
  tasksSheet.getColumn(3).width = 15;  // Status
  tasksSheet.getColumn(4).width = 12;  // Priority
  tasksSheet.getColumn(5).width = 15;  // Due Date
  tasksSheet.getColumn(6).width = 15;  // Created Date
  tasksSheet.getColumn(7).width = 18;  // Completed Date

  // Freeze header row
  tasksSheet.views = [{ state: 'frozen', ySplit: 1 }];

  // ==================== TEAM WORKLOAD SHEET (for team reports) ====================
  if (reportData.workloadByMember && reportData.workloadByMember.length > 0) {
    const workloadSheet = workbook.addWorksheet('Team Workload', {
      properties: { tabColor: { argb: 'F59E0B' } }
    });

    const workloadHeaders = ['#', 'Team Member', 'Email', 'Total Tasks', 'Completed', 'Pending', 'Completion Rate'];
    const workloadHeaderRow = workloadSheet.addRow(workloadHeaders);
    workloadHeaderRow.height = 28;

    workloadHeaderRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F59E0B' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: '000000' } },
        left: { style: 'thin', color: { argb: '000000' } },
        bottom: { style: 'thin', color: { argb: '000000' } },
        right: { style: 'thin', color: { argb: '000000' } }
      };
    });

    reportData.workloadByMember.forEach((member, index) => {
      const pending = (member.tasks || 0) - (member.completed || 0);
      const row = workloadSheet.addRow([
        index + 1,
        member.name || 'Unknown',
        member.email || 'N/A',
        member.tasks || 0,
        member.completed || 0,
        pending,
        `${member.completionRate || 0}%`
      ]);

      row.eachCell((cell, colNumber) => {
        cell.border = cellBorder;
        cell.alignment = { horizontal: colNumber <= 3 ? 'left' : 'center', vertical: 'middle' };
      });

      // Color code completion rate
      const rateCell = row.getCell(7);
      const rate = parseFloat(member.completionRate) || 0;
      if (rate >= 80) {
        rateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1FAE5' } };
      } else if (rate >= 50) {
        rateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } };
      } else {
        rateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };
      }

      // Alternate row colors
      if (index % 2 === 1) {
        [1, 2, 3, 4, 5, 6].forEach(col => {
          const cell = row.getCell(col);
          if (!cell.fill || cell.fill.type !== 'pattern') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F9FAFB' } };
          }
        });
      }
    });

    workloadSheet.getColumn(1).width = 6;
    workloadSheet.getColumn(2).width = 30;
    workloadSheet.getColumn(3).width = 35;
    workloadSheet.getColumn(4).width = 15;
    workloadSheet.getColumn(5).width = 15;
    workloadSheet.getColumn(6).width = 12;
    workloadSheet.getColumn(7).width = 18;

    workloadSheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  // ==================== DEPARTMENT SHEET (for org reports) ====================
  if (reportData.tasksByDepartment && reportData.tasksByDepartment.length > 0) {
    const deptSheet = workbook.addWorksheet('Departments', {
      properties: { tabColor: { argb: '8B5CF6' } }
    });

    const deptHeaders = ['#', 'Department', 'Total Tasks', 'Completed', 'Pending', 'Completion Rate'];
    const deptHeaderRow = deptSheet.addRow(deptHeaders);
    deptHeaderRow.height = 28;

    deptHeaderRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '8B5CF6' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: '000000' } },
        left: { style: 'thin', color: { argb: '000000' } },
        bottom: { style: 'thin', color: { argb: '000000' } },
        right: { style: 'thin', color: { argb: '000000' } }
      };
    });

    reportData.tasksByDepartment.forEach((dept, index) => {
      const pending = (dept.tasks || 0) - (dept.completed || 0);
      const row = deptSheet.addRow([
        index + 1,
        dept.name || 'Unassigned',
        dept.tasks || 0,
        dept.completed || 0,
        pending,
        `${dept.completionRate || 0}%`
      ]);

      row.eachCell((cell, colNumber) => {
        cell.border = cellBorder;
        cell.alignment = { horizontal: colNumber <= 2 ? 'left' : 'center', vertical: 'middle' };
      });

      // Color code completion rate
      const rateCell = row.getCell(6);
      const rate = parseFloat(dept.completionRate) || 0;
      if (rate >= 80) {
        rateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1FAE5' } };
      } else if (rate >= 50) {
        rateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } };
      } else {
        rateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };
      }
    });

    deptSheet.getColumn(1).width = 6;
    deptSheet.getColumn(2).width = 30;
    deptSheet.getColumn(3).width = 15;
    deptSheet.getColumn(4).width = 15;
    deptSheet.getColumn(5).width = 12;
    deptSheet.getColumn(6).width = 18;

    deptSheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  // Write to response
  const xlsxFilename = `${reportTitle.replace(/\s+/g, '_')}_${timestamp}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${xlsxFilename}`);

  await workbook.xlsx.write(res);
  res.end();
}

/**
 * Export report to PDF format with proper tables and formatting
 */
async function exportToPDF(res, reportData, reportTitle, userTimezone = 'UTC') {
  const doc = new PDFDocument({
    margin: 40,
    size: 'A4',
    bufferPages: true
  });
  const timestamp = new Date().toISOString().split('T')[0];

  const pdfFilename = `${reportTitle.replace(/\s+/g, '_')}_${timestamp}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${pdfFilename}`);

  doc.pipe(res);

  // Colors
  const primaryColor = '#3B82F6';
  const successColor = '#10B981';
  const warningColor = '#F59E0B';
  const dangerColor = '#EF4444';
  const grayColor = '#6B7280';
  const lightGray = '#F3F4F6';

  // Helper function to draw table
  const drawTable = (headers, rows, options = {}) => {
    const {
      startX = 40,
      startY = doc.y,
      columnWidths = [],
      headerColor = primaryColor,
      headerTextColor = '#FFFFFF'
    } = options;

    const rowHeight = 22;
    const cellPadding = 5;
    let y = startY;

    // Calculate total width and default column widths
    const pageWidth = doc.page.width - 80; // margins
    const defaultWidth = pageWidth / headers.length;
    const widths = columnWidths.length ? columnWidths : headers.map(() => defaultWidth);

    // Draw header row
    let x = startX;
    doc.fillColor(headerColor);
    doc.rect(x, y, pageWidth, rowHeight).fill();

    doc.fillColor(headerTextColor).fontSize(10).font('Helvetica-Bold');
    headers.forEach((header, i) => {
      doc.text(header, x + cellPadding, y + 6, {
        width: widths[i] - cellPadding * 2,
        align: 'left'
      });
      x += widths[i];
    });
    y += rowHeight;

    // Draw data rows
    doc.font('Helvetica').fontSize(9).fillColor('#000000');
    rows.forEach((row, rowIndex) => {
      // Check if we need a new page
      if (y > doc.page.height - 80) {
        doc.addPage();
        y = 40;

        // Redraw header on new page
        x = startX;
        doc.fillColor(headerColor);
        doc.rect(x, y, pageWidth, rowHeight).fill();

        doc.fillColor(headerTextColor).fontSize(10).font('Helvetica-Bold');
        headers.forEach((header, i) => {
          doc.text(header, x + cellPadding, y + 6, {
            width: widths[i] - cellPadding * 2,
            align: 'left'
          });
          x += widths[i];
        });
        y += rowHeight;
        doc.font('Helvetica').fontSize(9).fillColor('#000000');
      }

      // Alternate row background
      if (rowIndex % 2 === 1) {
        doc.fillColor(lightGray);
        doc.rect(startX, y, pageWidth, rowHeight).fill();
        doc.fillColor('#000000');
      }

      // Draw border
      doc.strokeColor('#E5E7EB').lineWidth(0.5);
      doc.rect(startX, y, pageWidth, rowHeight).stroke();

      // Draw cell text
      x = startX;
      row.forEach((cell, i) => {
        const cellValue = String(cell || '');
        doc.text(cellValue, x + cellPadding, y + 6, {
          width: widths[i] - cellPadding * 2,
          align: i === 0 ? 'left' : 'left',
          lineBreak: false
        });
        x += widths[i];
      });
      y += rowHeight;
    });

    return y + 10;
  };

  // ==================== HEADER ====================
  doc.fontSize(22).fillColor(primaryColor).font('Helvetica-Bold');
  doc.text(reportTitle, { align: 'center' });
  doc.moveDown(0.3);

  doc.fontSize(10).fillColor(grayColor).font('Helvetica');
  doc.text(`Generated: ${TimezoneHelper.formatDateTimeInTimezone(new Date(), userTimezone)}`, { align: 'center' });
  doc.moveDown(0.3);
  doc.text(`Date Range: Last ${reportData.dateRange || 30} days`, { align: 'center' });

  // Separator line
  doc.moveDown(0.5);
  doc.strokeColor(primaryColor).lineWidth(2);
  doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
  doc.moveDown(1);

  // ==================== KPIs SECTION ====================
  doc.fontSize(14).fillColor(primaryColor).font('Helvetica-Bold');
  doc.text('Key Performance Indicators', 40);
  doc.moveDown(0.5);

  const kpiRows = Object.entries(reportData.kpis).map(([key, value]) => {
    const label = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
    return [label, String(value)];
  });

  doc.y = drawTable(
    ['Metric', 'Value'],
    kpiRows,
    { columnWidths: [300, 215], headerColor: primaryColor }
  );

  // ==================== STATUS DISTRIBUTION ====================
  if (reportData.statusDistribution) {
    doc.moveDown(0.5);
    doc.fontSize(14).fillColor(primaryColor).font('Helvetica-Bold');
    doc.text('Status Distribution', 40);
    doc.moveDown(0.5);

    const statusRows = reportData.statusDistribution.map(item => [item.name, String(item.value)]);
    doc.y = drawTable(
      ['Status', 'Count'],
      statusRows,
      { columnWidths: [300, 215], headerColor: successColor }
    );
  }

  // ==================== PRIORITY DISTRIBUTION ====================
  if (reportData.priorityLoad || reportData.priorityDistribution) {
    const priorityData = reportData.priorityLoad || reportData.priorityDistribution;
    doc.moveDown(0.5);
    doc.fontSize(14).fillColor(primaryColor).font('Helvetica-Bold');
    doc.text('Priority Distribution', 40);
    doc.moveDown(0.5);

    const priorityRows = priorityData.map(item => [
      item.name,
      String(item.tasks !== undefined ? item.tasks : item.value)
    ]);
    doc.y = drawTable(
      ['Priority', 'Count'],
      priorityRows,
      { columnWidths: [300, 215], headerColor: warningColor }
    );
  }

  // ==================== TEAM WORKLOAD (for team reports) ====================
  if (reportData.workloadByMember && reportData.workloadByMember.length > 0) {
    doc.addPage();
    doc.fontSize(16).fillColor(primaryColor).font('Helvetica-Bold');
    doc.text('Team Workload Summary', 40);
    doc.moveDown(0.5);

    const workloadRows = reportData.workloadByMember.map((member, index) => [
      String(index + 1),
      member.name || 'Unknown',
      String(member.tasks || 0),
      String(member.completed || 0),
      `${member.completionRate || 0}%`
    ]);

    doc.y = drawTable(
      ['#', 'Team Member', 'Total Tasks', 'Completed', 'Rate'],
      workloadRows,
      { columnWidths: [30, 200, 100, 100, 85], headerColor: '#F59E0B' }
    );
  }

  // ==================== DEPARTMENT SUMMARY (for org reports) ====================
  if (reportData.tasksByDepartment && reportData.tasksByDepartment.length > 0) {
    if (doc.y > doc.page.height - 200) {
      doc.addPage();
    }
    doc.moveDown(1);
    doc.fontSize(16).fillColor(primaryColor).font('Helvetica-Bold');
    doc.text('Department Summary', 40);
    doc.moveDown(0.5);

    const deptRows = reportData.tasksByDepartment.map((dept, index) => [
      String(index + 1),
      dept.name || 'Unassigned',
      String(dept.tasks || 0),
      String(dept.completed || 0),
      `${dept.completionRate || 0}%`
    ]);

    doc.y = drawTable(
      ['#', 'Department', 'Total Tasks', 'Completed', 'Rate'],
      deptRows,
      { columnWidths: [30, 200, 100, 100, 85], headerColor: '#8B5CF6' }
    );
  }

  // ==================== TASKS LIST ====================
  if (reportData.tasks && reportData.tasks.length > 0) {
    doc.addPage();
    doc.fontSize(16).fillColor(primaryColor).font('Helvetica-Bold');
    doc.text('Tasks List', 40);
    doc.moveDown(0.5);

    // Limit to 50 tasks for PDF readability
    const tasksToShow = reportData.tasks.slice(0, 50);

    const taskRows = tasksToShow.map((task, index) => [
      String(index + 1),
      (task.title || 'Untitled').substring(0, 30) + ((task.title || '').length > 30 ? '...' : ''),
      task.status || 'N/A',
      task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : 'N/A',
      task.dueDate ? TimezoneHelper.formatInTimezone(new Date(task.dueDate), userTimezone) : 'Not Set',
      task.completedDate ? TimezoneHelper.formatInTimezone(new Date(task.completedDate), userTimezone) : '-'
    ]);

    doc.y = drawTable(
      ['#', 'Title', 'Status', 'Priority', 'Due Date', 'Completed'],
      taskRows,
      { columnWidths: [25, 170, 75, 70, 85, 90], headerColor: successColor }
    );

    if (reportData.tasks.length > 50) {
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor(grayColor).font('Helvetica-Oblique');
      doc.text(
        `Showing 50 of ${reportData.tasks.length} tasks. Download Excel or CSV for the complete list.`,
        40,
        doc.y,
        { align: 'center' }
      );
    }
  }

  // ==================== FOOTER on all pages ====================
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);

    // Footer line
    doc.strokeColor('#E5E7EB').lineWidth(1);
    doc.moveTo(40, doc.page.height - 50).lineTo(doc.page.width - 40, doc.page.height - 50).stroke();

    // Footer text
    doc.fontSize(8).fillColor(grayColor).font('Helvetica');
    doc.text(
      `TaskSetu Admin | Page ${i + 1} of ${pages.count} | Generated on ${TimezoneHelper.formatInTimezone(new Date(), userTimezone)}`,
      40,
      doc.page.height - 40,
      { align: 'center', width: doc.page.width - 80 }
    );
  }

  doc.end();
}

/**
 * Helper function to generate weekly efficiency trend for productivity report
 */
function generateWeeklyEfficiencyTrend(completedTasks, days, userTimezone = 'UTC') {
  const weeks = Math.ceil(days / 7);
  const weekData = [];
  const now = new Date();

  for (let i = weeks - 1; i >= 0; i--) {
    const wsRef = new Date(now);
    wsRef.setDate(wsRef.getDate() - (i * 7 + 6));
    const { startOfDay: weekStart } = TimezoneHelper.getDayBoundaries(userTimezone, wsRef);

    const weRef = new Date(now);
    weRef.setDate(weRef.getDate() - (i * 7));
    const { endOfDay: weekEnd } = TimezoneHelper.getDayBoundaries(userTimezone, weRef);

    const weekTasks = completedTasks.filter(task => {
      const completedDate = new Date(task.completedAt);
      return completedDate >= weekStart && completedDate <= weekEnd;
    });

    const onTime = weekTasks.filter(task =>
      new Date(task.completedAt) <= new Date(task.dueDate)
    ).length;

    const efficiency = weekTasks.length > 0 ? Math.round((onTime / weekTasks.length) * 100) : 0;

    weekData.push({
      week: `Week ${weeks - i}`,
      date: TimezoneHelper.formatInTimezone(weekStart, userTimezone),
      total: weekTasks.length,
      onTime,
      efficiency
    });
  }

  return weekData;
}

/**
 * Helper function to generate daily engagement trend for activity report
 */
function generateDailyEngagementTrend(comments, activities, days, userTimezone = 'UTC') {
  const dailyData = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const refDay = new Date(now);
    refDay.setDate(refDay.getDate() - i);
    const { startOfDay: day, endOfDay: dayEnd } = TimezoneHelper.getDayBoundaries(userTimezone, refDay);

    const dayComments = comments.filter(comment => {
      const commentDate = new Date(comment.createdAt);
      return commentDate >= day && commentDate <= dayEnd;
    }).length;

    const dayActivities = Array.isArray(activities) ? activities.filter(activity => {
      const activityDate = new Date(activity.createdAt);
      return activityDate >= day && activityDate <= dayEnd;
    }).length : 0;

    dailyData.push({
      date: TimezoneHelper.formatInTimezone(day, userTimezone),
      comments: dayComments,
      activities: dayActivities,
      total: dayComments + dayActivities
    });
  }

  return dailyData;
}
