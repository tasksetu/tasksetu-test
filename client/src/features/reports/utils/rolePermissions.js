/**
 * Role-Based Permissions for Reports
 * Implements the permissions matrix from Section 6.0 - Reporting & Analytics Module
 */

/**
 * Permission Matrix as defined in documentation:
 * 
 * Role        View Own Reports  View Team Reports  View Org Reports  Export
 * Creator     ✅               ❌                ❌               ✅ (own)
 * Assignee    ✅               ❌                ❌               ✅ (own)
 * Manager     ✅               ✅ (team only)    ❌               ✅
 * Admin       ✅               ✅                ✅               ✅
 */

// Define role hierarchy
export const ROLE_HIERARCHY = {
    individual: ['creator', 'assignee', 'user', 'employee'],
    manager: ['manager', 'team_lead', 'team_leader'],
    admin: ['org_admin', 'admin', 'super_admin', 'superadmin', 'organization']
};

/**
 * Get user's access level based on their role
 * @param {string|array} userRole - User's role(s)
 * @returns {string} - 'individual', 'manager', or 'admin'
 */
export const getUserAccessLevel = (userRole) => {
    const normalizedRoles = Array.isArray(userRole) ? userRole : [userRole];

    // Check for admin roles first (highest priority)
    if (normalizedRoles.some(role => ROLE_HIERARCHY.admin.includes(role))) {
        return 'admin';
    }

    // Check for manager roles
    if (normalizedRoles.some(role => ROLE_HIERARCHY.manager.includes(role))) {
        return 'manager';
    }

    // Default to individual access
    return 'individual';
};

/**
 * Report access permissions based on role and report type
 */
export const REPORT_PERMISSIONS = {
    // Individual Reports - All users can access
    'my-productivity': {
        individual: true,
        manager: true,
        admin: true,
        scope: 'own',
        featureCode: 'REPORT_TASK_STATUS'
    },
    'overdue-tasks': {
        individual: true,
        manager: true,
        admin: true,
        scope: 'tiered',
        featureCode: 'REPORT_OVERDUE'
    },
    'productivity-efficiency': {
        individual: true,
        manager: true,
        admin: true,
        scope: 'tiered',
        featureCode: 'REPORT_PRODUCTIVITY'
    },
    'workload-distribution': {
        individual: true,
        manager: true,
        admin: true,
        scope: 'tiered',
        featureCode: 'REPORT_WORKLOAD'
    },
    'milestone-achievement': {
        individual: true,
        manager: true,
        admin: true,
        scope: 'tiered',
        featureCode: 'REPORT_MILESTONE'
    },
    'recurring-task-adherence': {
        individual: true,
        manager: true,
        admin: true,
        scope: 'tiered',
        featureCode: 'REPORT_RECURRING'
    },
    'quick-task-conversion': {
        individual: true,
        manager: true,
        admin: true,
        scope: 'tiered',
        featureCode: 'REPORT_QUICK_CONVERSION'
    },
    'activity-engagement': {
        individual: true,
        manager: true,
        admin: true,
        scope: 'tiered',
        featureCode: 'REPORT_ACTIVITY'
    },
    'task-completion-status': {
        individual: true,
        manager: true,
        admin: true,
        scope: 'tiered',
        featureCode: 'REPORT_TASK_STATUS'
    },
    'team-analytics': {
        individual: false,
        manager: true,
        admin: true,
        scope: 'team',
        featureCode: 'REPORT_ADV'
    },
    'organization-analytics': {
        individual: false,
        manager: false,
        admin: true,
        scope: 'organization',
        featureCode: 'REPORT_ADV'
    }
};

/**
 * Check if user can access a specific report
 * @param {string} reportType - The report identifier
 * @param {string|array} userRole - User's role(s)
 * @param {object} features - Feature access mapping from license
 * @returns {boolean}
 */
export const canAccessReport = (reportType, userRole, features = null) => {
    const accessLevel = getUserAccessLevel(userRole);
    const reportConfig = REPORT_PERMISSIONS[reportType];

    if (!reportConfig) {
        console.warn(`Unknown report type: ${reportType}`);
        return false;
    }

    // Role check
    const hasRoleAccess = reportConfig[accessLevel] || false;
    if (!hasRoleAccess) return false;

    // Feature check (if features mapping provided)
    if (features && reportConfig.featureCode) {
        // If the specific feature is explicitly disabled in license, deny access
        if (features[reportConfig.featureCode] === false) {
            return false;
        }
    }

    return true;
};

/**
 * Get export permissions for user
 * @param {string|array} userRole - User's role(s)
 * @returns {object}
 */
export const getExportPermissions = (userRole) => {
    const accessLevel = getUserAccessLevel(userRole);

    return {
        canExportOwnReports: true, // All users can export their own reports
        canExportTeamReports: ['manager', 'admin'].includes(accessLevel),
        canExportOrgReports: accessLevel === 'admin'
    };
};

/**
 * Get available reports for user based on their role and features
 * @param {string|array} userRole - User's role(s)
 * @param {object} features - Feature access mapping from license
 * @returns {array} - Array of available report configurations
 */
export const getAvailableReports = (userRole, features = null) => {
    const accessLevel = getUserAccessLevel(userRole);

    const reportConfigs = [
        {
            id: 'my-productivity',
            title: 'My Productivity',
            description: 'Personal task completion trends and status overview',
            icon: 'BarChart3',
            category: 'individual',
            available: canAccessReport('my-productivity', userRole, features)
        },
        {
            id: 'overdue-tasks',
            title: 'Overdue Tasks',
            description: 'Tasks past their due date sorted by urgency',
            icon: 'AlertTriangle',
            category: 'operational',
            available: canAccessReport('overdue-tasks', userRole, features)
        },
        {
            id: 'milestone-achievement',
            title: 'Milestone Achievement',
            description: 'Progress tracking for project milestones',
            icon: 'Target',
            category: 'strategic',
            available: canAccessReport('milestone-achievement', userRole, features)
        },
        {
            id: 'recurring-task-adherence',
            title: 'Recurring Task Adherence',
            description: 'Compliance with recurring task schedules',
            icon: 'Clock',
            category: 'operational',
            available: canAccessReport('recurring-task-adherence', userRole, features)
        },
        {
            id: 'quick-task-conversion',
            title: 'Quick Task Conversion',
            description: 'Quick task completion and conversion rates',
            icon: 'CheckSquare',
            category: 'efficiency',
            available: canAccessReport('quick-task-conversion', userRole, features)
        },
        {
            id: 'activity-engagement',
            title: 'Activity & Engagement',
            description: 'User interaction and engagement metrics',
            icon: 'UserCheck',
            category: 'engagement',
            available: canAccessReport('activity-engagement', userRole, features)
        },
        {
            id: 'team-analytics',
            title: 'Team Analytics',
            description: 'Team performance and workload overview',
            icon: 'Users',
            category: 'team',
            available: canAccessReport('team-analytics', userRole, features)
        },
        {
            id: 'productivity-efficiency',
            title: 'Productivity & Efficiency',
            description: 'Task completion timing and efficiency analysis',
            icon: 'TrendingUp',
            category: 'efficiency',
            available: canAccessReport('productivity-efficiency', userRole, features)
        },
        {
            id: 'workload-distribution',
            title: 'Workload Distribution',
            description: 'Task distribution across team members',
            icon: 'BarChart4',
            category: 'team',
            available: canAccessReport('workload-distribution', userRole, features)
        },
        {
            id: 'organization-analytics',
            title: 'Organization Analytics',
            description: 'Global insights and department comparisons',
            icon: 'Building2',
            category: 'strategic',
            available: canAccessReport('organization-analytics', userRole, features)
        }
    ];

    return reportConfigs.filter(report => report.available);
};

/**
 * Get report scope message for user interface
 * @param {string} reportType - The report identifier
 * @param {string|array} userRole - User's role(s)
 * @returns {string}
 */
export const getReportScopeMessage = (reportType, userRole) => {
    const accessLevel = getUserAccessLevel(userRole);
    const reportConfig = REPORT_PERMISSIONS[reportType];

    if (!reportConfig || !reportConfig[accessLevel]) {
        return 'Access denied';
    }

    switch (reportConfig.scope) {
        case 'own':
            return 'Showing your personal data';
        case 'team':
            return accessLevel === 'admin' ? 'Showing organization data' : 'Showing team data';
        case 'organization':
            return 'Showing organization data';
        case 'tiered':
            switch (accessLevel) {
                case 'individual':
                    return 'Showing your personal data';
                case 'manager':
                    return 'Showing team data';
                case 'admin':
                    return 'Showing organization data';
                default:
                    return 'Showing your personal data';
            }
        default:
            return 'Showing available data';
    }
};

/**
 * Validate report access and return appropriate error message
 * @param {string} reportType - The report identifier
 * @param {string|array} userRole - User's role(s)
 * @param {object} features - Feature access mapping from license
 * @returns {object} - { hasAccess: boolean, message: string }
 */
export const validateReportAccess = (reportType, userRole, features = null) => {
    const hasAccess = canAccessReport(reportType, userRole, features);

    if (hasAccess) {
        return {
            hasAccess: true,
            message: getReportScopeMessage(reportType, userRole)
        };
    }

    // Check if it was a license restriction
    const reportConfig = REPORT_PERMISSIONS[reportType];
    if (features && reportConfig?.featureCode && features[reportConfig.featureCode] === false) {
        return {
            hasAccess: false,
            message: `This report is not included in your current license plan. Please upgrade to access ${reportConfig.featureCode.replace('REPORT_', '').replace('_', ' ')} analytics.`,
            upgradeRequired: true
        };
    }

    const accessLevel = getUserAccessLevel(userRole);
    let message = 'Access denied.';

    if (accessLevel === 'individual') {
        message = 'This report requires Manager or Admin privileges.';
    } else if (accessLevel === 'manager') {
        message = 'This report requires Admin privileges.';
    }

    return {
        hasAccess: false,
        message
    };
};

export default {
    getUserAccessLevel,
    canAccessReport,
    getExportPermissions,
    getAvailableReports,
    getReportScopeMessage,
    validateReportAccess,
    ROLE_HIERARCHY,
    REPORT_PERMISSIONS
};