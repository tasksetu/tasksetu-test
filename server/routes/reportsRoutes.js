/**
 * Reports Routes with Role-Based Access Control
 * Implements Section 6.0 - Reporting & Analytics Module
 * Document Reference: 8 Key Reports with Permission Matrix
 * 
 * ✅ Permission Matrix Implementation:
 * Role        View Own Reports  View Team Reports  View Org Reports  Export
 * Creator     ✅               ❌                ❌               ✅ (own)
 * Assignee    ✅               ❌                ❌               ✅ (own)
 * Manager     ✅               ✅ (team only)    ❌               ✅
 * Admin       ✅               ✅                ✅               ✅
 */

import express from "express";
import { authenticateToken, roleAuth } from "../middleware/roleAuth.js";
import { checkFeatureAccess } from "../middleware/licenseMiddleware.js";
import * as licenseService from "../services/licenseService.js";
import {
  getMyProductivityReport,
  getTeamAnalyticsReport,
  getOrganizationAnalyticsReport,
  exportReport,
  getMilestoneAchievementReport,
  getRecurringTaskAdherenceReport,
  getQuickTaskConversionReport,
  getOverdueTasksReport,
  getProductivityEfficiencyReport,
  getWorkloadDistributionReport,
  getActivityEngagementReport,
  getTaskCompletionStatusReport
} from "../controller/reportsController.js";

const router = express.Router();

// =============================================================================
// 📊 INDIVIDUAL REPORTS - All users can access (own data)
// =============================================================================

/**
 * Task Completion & Status Report
 * Access: All users (filtered by role)
 * Scope: Tasks by status, priority, user
 */
router.get(
  '/task-completion-status',
  authenticateToken,
  roleAuth(["individual", "employee", "manager", "org_admin", "admin", "super_admin"]),
  checkFeatureAccess("REPORT_TASK_STATUS"),
  getTaskCompletionStatusReport
);

/**
 * My Productivity Report
 * Access: All users (own data only)
 * License: REPORT_BASIC
 * Scope: Personal tasks, completion trends, status distribution
 */
router.get(
  '/my-productivity',
  authenticateToken,
  roleAuth(["individual", "employee", "manager", "org_admin", "admin", "super_admin"]),
  checkFeatureAccess("REPORT_BASIC"),
  getMyProductivityReport
);

/**
 * Milestone Achievement Report
 */
router.get(
  '/milestone-achievement',
  authenticateToken,
  roleAuth(["individual", "employee", "manager", "org_admin", "admin", "super_admin"]),
  checkFeatureAccess("REPORT_MILESTONE"),
  getMilestoneAchievementReport
);

/**
 * Recurring Task Adherence Report  
 */
router.get(
  '/recurring-task-adherence',
  authenticateToken,
  roleAuth(["individual", "employee", "manager", "org_admin", "admin", "super_admin"]),
  checkFeatureAccess("REPORT_RECURRING"),
  getRecurringTaskAdherenceReport
);

/**
 * Quick Task Conversion Report
 */
router.get(
  '/quick-task-conversion',
  authenticateToken,
  roleAuth(["individual", "employee", "manager", "org_admin", "admin", "super_admin"]),
  checkFeatureAccess("REPORT_QUICK_CONVERSION"),
  getQuickTaskConversionReport
);

/**
 * Overdue Tasks Report
 */
router.get(
  '/overdue-tasks',
  authenticateToken,
  roleAuth(["individual", "employee", "manager", "org_admin", "admin", "super_admin"]),
  checkFeatureAccess("REPORT_OVERDUE"),
  getOverdueTasksReport
);

/**
 * Productivity & Efficiency Report
 */
router.get(
  '/productivity-efficiency',
  authenticateToken,
  roleAuth(["individual", "employee", "manager", "org_admin", "admin", "super_admin"]),
  checkFeatureAccess("REPORT_PRODUCTIVITY"),
  getProductivityEfficiencyReport
);

/**
 * Activity/Engagement Report
 */
router.get(
  '/activity-engagement',
  authenticateToken,
  roleAuth(["individual", "employee", "manager", "org_admin", "admin", "super_admin"]),
  checkFeatureAccess("REPORT_ACTIVITY"),
  getActivityEngagementReport
);

/**
 * Team Analytics Report
 */
router.get(
  '/team-analytics',
  authenticateToken,
  roleAuth(["manager", "org_admin", "admin", "super_admin"]), // Manager+ only
  checkFeatureAccess("REPORT_ADV"),
  getTeamAnalyticsReport
);

/**
 * Workload Distribution Report
 */
router.get(
  '/workload-distribution',
  authenticateToken,
  roleAuth(["individual", "employee", "manager", "org_admin", "admin", "super_admin"]), // Open to all roles
  checkFeatureAccess("REPORT_WORKLOAD"),
  getWorkloadDistributionReport
);

/**
 * Organization Analytics Report
 */
router.get(
  '/organization-analytics',
  authenticateToken,
  roleAuth(["org_admin", "admin", "super_admin"]), // Admin only
  checkFeatureAccess("REPORT_ADV"),
  getOrganizationAnalyticsReport
);

// =============================================================================
// 📤 EXPORT FUNCTIONALITY - Role-based export permissions
// =============================================================================

/**
 * Export Reports
 * Access: All users (own data) | Manager+ (team data) | Admin (org data)
 * Supports: CSV, Excel, PDF formats
 */
router.get(
  '/export',
  authenticateToken,
  roleAuth(["individual", "employee", "manager", "org_admin", "admin", "super_admin"]),
  checkFeatureAccess("REPORT_ADV"),
  exportReport
);

// =============================================================================
// 📋 REPORT METADATA AND PERMISSIONS
// =============================================================================

/**
 * Get Available Reports for User
 * Returns list of reports the current user can access based on their role and license
 */
router.get('/available', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const userRole = req.user.role;
    const accessLevel = Array.isArray(userRole)
      ? (userRole.includes('org_admin') || userRole.includes('admin') || userRole.includes('super_admin') ? 'admin'
        : userRole.includes('manager') ? 'manager' : 'individual')
      : (userRole === 'org_admin' || userRole === 'admin' || userRole === 'super_admin' ? 'admin'
        : userRole === 'manager' ? 'manager' : 'individual');

    const reportsMetadata = [
      {
        id: 'task-completion-status',
        name: 'Task Completion & Status',
        description: 'Comprehensive overview of task statuses and distribution',
        accessLevel: 'individual',
        feature: 'REPORT_TASK_STATUS'
      },
      {
        id: 'my-productivity',
        name: 'My Productivity',
        description: 'Personal task completion trends and status overview',
        accessLevel: 'individual',
        feature: 'REPORT_BASIC'
      },
      {
        id: 'overdue-tasks',
        name: 'Overdue Tasks',
        description: 'Tasks past their due date sorted by urgency',
        accessLevel: 'individual',
        feature: 'REPORT_OVERDUE'
      },
      {
        id: 'milestone-achievement',
        name: 'Milestone Achievement',
        description: 'Progress tracking for project milestones',
        accessLevel: 'individual',
        feature: 'REPORT_MILESTONE'
      },
      {
        id: 'recurring-task-adherence',
        name: 'Recurring Task Adherence',
        description: 'Compliance with recurring task schedules',
        accessLevel: 'individual',
        feature: 'REPORT_RECURRING'
      },
      {
        id: 'quick-task-conversion',
        name: 'Quick Task Conversion',
        description: 'Quick task completion and conversion rates',
        accessLevel: 'individual',
        feature: 'REPORT_QUICK_CONVERSION'
      },
      {
        id: 'activity-engagement',
        name: 'Activity & Engagement',
        description: 'User interaction and engagement metrics',
        accessLevel: 'individual',
        feature: 'REPORT_ACTIVITY'
      },
      {
        id: 'productivity-efficiency',
        name: 'Productivity & Efficiency',
        description: 'Task completion timing and efficiency analysis',
        accessLevel: 'individual',
        feature: 'REPORT_PRODUCTIVITY'
      },
      {
        id: 'team-analytics',
        name: 'Team Analytics',
        description: 'Team performance and workload overview',
        accessLevel: 'manager',
        feature: 'REPORT_ADV'
      },
      {
        id: 'workload-distribution',
        name: 'Workload Distribution',
        description: 'Task distribution across team members',
        accessLevel: 'manager',
        feature: 'REPORT_WORKLOAD'
      },
      {
        id: 'organization-analytics',
        name: 'Organization Analytics',
        description: 'Organization-wide performance dashboard',
        accessLevel: 'admin',
        feature: 'REPORT_ADV'
      }
    ];

    const availableReports = [];

    for (const report of reportsMetadata) {
      // Check Role
      let hasRoleAccess = false;
      if (report.accessLevel === 'individual') {
        hasRoleAccess = true;
      } else if (report.accessLevel === 'manager') {
        hasRoleAccess = ['manager', 'admin'].includes(accessLevel);
      } else if (report.accessLevel === 'admin') {
        hasRoleAccess = accessLevel === 'admin';
      }

      if (hasRoleAccess) {
        // Check License Feature
        const featureCheck = await licenseService.checkFeatureAccess(userId, report.feature);
        if (featureCheck.hasAccess) {
          availableReports.push({
            ...report,
            available: true
          });
        }
      }
    }

    res.json({
      success: true,
      data: {
        userAccessLevel: accessLevel,
        availableReports,
        totalAvailable: availableReports.length
      }
    });
  } catch (error) {
    console.error('Error getting available reports:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get available reports',
      error: error.message
    });
  }
});

/**
 * Get User Permissions
 * Returns detailed permission information for the current user
 */
router.get('/permissions', authenticateToken, (req, res) => {
  try {
    const userRole = req.user.role;
    const accessLevel = Array.isArray(userRole)
      ? (userRole.includes('org_admin') || userRole.includes('admin') || userRole.includes('super_admin') ? 'admin'
        : userRole.includes('manager') ? 'manager' : 'individual')
      : (userRole === 'org_admin' || userRole === 'admin' || userRole === 'super_admin' ? 'admin'
        : userRole === 'manager' ? 'manager' : 'individual');

    const permissions = {
      accessLevel,
      canViewOwnReports: true,
      canViewTeamReports: ['manager', 'admin'].includes(accessLevel),
      canViewOrgReports: accessLevel === 'admin',
      canExportOwnReports: true,
      canExportTeamReports: ['manager', 'admin'].includes(accessLevel),
      canExportOrgReports: accessLevel === 'admin',
      dataScope: {
        individual: 'Your personal tasks and activities',
        manager: accessLevel === 'manager' ? 'Your team\'s tasks and activities' : null,
        admin: accessLevel === 'admin' ? 'Organization-wide tasks and activities' : null
      }
    };

    res.json({
      success: true,
      data: permissions
    });
  } catch (error) {
    console.error('Error getting user permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user permissions',
      error: error.message
    });
  }
});

// =============================================================================
// 🛠️ UTILITY ROUTES
// =============================================================================

/**
 * Health Check for Reports Module
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Reports module is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

export default router;