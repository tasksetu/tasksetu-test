import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Import models
import { License } from './modals/licenseModal.js';
import { Feature } from './modals/featureModal.js';
import { LicenseFeatureMapping } from './modals/licenseFeatureMappingModal.js';

const MONGODB_URI = process.env.DATABASE_URL;

// License data
const licenses = [
  {
    license_code: 'EXPLORE',
    name: 'Explore',
    description: '6-day free trial to explore all features',
    billing_cycle: 'TRIAL',
    price_monthly: 0,
    price_yearly: 0,
    max_users: 10,
    trial_days: 6,
    features_summary: ['All features with usage limits', 'Perfect for testing TaskSetu'],
    is_popular: false,
    grace_period_days:0,
    display_order: 1,
  },
  {
    license_code: 'PLAN',
    name: 'Plan',
    description: 'Essential task management for small teams',
    billing_cycle: 'MONTHLY',
    price_monthly: 199,
    price_yearly: 2150,
    max_users: 2,
    trial_days: 0,
    features_summary: ['Core task management', 'Basic notifications', 'Up to 50 users'],
    is_popular: false,
    grace_period_days:5,
    display_order: 2,
  },
  {
    license_code: 'EXECUTE',
    name: 'Execute',
    description: 'Advanced features for growing teams',
    billing_cycle: 'MONTHLY',
    price_monthly: 399,
    price_yearly: 4310,
    max_users: 3,
    trial_days: 0,
    features_summary: ['All Plan features', 'Advanced workflows', 'Up to 200 users'],
    is_popular: true,
    grace_period_days:5,
    display_order: 3,
  },
  {
    license_code: 'OPTIMIZE',
    name: 'Optimize',
    description: 'Unlimited power for enterprise teams',
    billing_cycle: 'MONTHLY',
    price_monthly: 599,
    price_yearly: 6470,
    max_users: 4,
    trial_days: 0,
    features_summary: ['All Execute features', 'Unlimited users', 'Dedicated support'],
    is_popular: false,
    grace_period_days:5,
    display_order: 4,
  },
  {
    license_code: 'EXPIRED',
    name: 'Expired',
    description: 'Trial expired - please upgrade',
    billing_cycle: 'NONE',
    price_monthly: 0,
    price_yearly: 0,
    max_users: 0,
    trial_days: 0,
    features_summary: ['No access to features'],
    is_popular: false,
    grace_period_days:0,
    display_order: 5,
  },
];

// Feature data
const features = [
  {
    feature_code: 'TASK_BASIC',
    name: 'Basic Task Management',
    description: 'Create, assign, and track basic tasks',
    category: 'CORE',
    icon: 'CheckSquare',
    display_order: 1,
  },
  {
    feature_code: 'TASK_SUB',
    name: 'Subtasks',
    description: 'Break down tasks into subtasks',
    category: 'CORE',
    icon: 'List',
    display_order: 2,
  },
  {
    feature_code: 'TASK_QUICK',
    name: 'Quick Tasks',
    description: 'Create tasks quickly without forms',
    category: 'CORE',
    icon: 'Zap',
    display_order: 3,
  },
  {
    feature_code: 'NOTIF_BASIC',
    name: 'Basic Notifications',
    description: 'Get notified about task updates',
    category: 'CORE',
    icon: 'Bell',
    display_order: 4,
  },
  {
    feature_code: 'REPORT_BASIC',
    name: 'Basic Reports',
    description: 'View basic task reports and analytics',
    category: 'CORE',
    icon: 'BarChart',
    display_order: 5,
  },
  {
    feature_code: 'TASK_RECUR',
    name: 'Recurring Tasks',
    description: 'Set up tasks that repeat automatically',
    category: 'ADVANCED',
    icon: 'Repeat',
    display_order: 6,
  },
  {
    feature_code: 'TASK_APPROVAL',
    name: 'Task Approval Workflow',
    description: 'Multi-level approval for tasks',
    category: 'ADVANCED',
    icon: 'CheckCircle',
    display_order: 7,
  },
  {
    feature_code: 'TASK_MSTONE',
    name: 'Milestones',
    description: 'Track project milestones and deadlines',
    category: 'ADVANCED',
    icon: 'Flag',
    display_order: 8,
  },
  {
    feature_code: 'TASK_CAL',
    name: 'Calendar View',
    description: 'View tasks in calendar format',
    category: 'ADVANCED',
    icon: 'Calendar',
    display_order: 9,
  },
  {
    feature_code: 'TASK_EMAIL',
    name: 'Email Integration',
    description: 'Create tasks from emails',
    category: 'ADVANCED',
    icon: 'Mail',
    display_order: 10,
  },
  {
    feature_code: 'FORM_CREATE',
    name: 'Custom Forms',
    description: 'Create custom task forms',
    category: 'ADVANCED',
    icon: 'FileText',
    display_order: 11,
  },
  {
    feature_code: 'NOTIF_ADV',
    name: 'Advanced Notifications',
    description: 'Custom notification rules and channels',
    category: 'ADVANCED',
    icon: 'BellRing',
    display_order: 12,
  },
  {
    feature_code: 'PROC_CREATE',
    name: 'Process Builder',
    description: 'Build custom workflows and automations',
    category: 'PREMIUM',
    icon: 'GitBranch',
    display_order: 13,
  },
  {
    feature_code: 'API_ACCESS',
    name: 'API Access',
    description: 'Full REST API access for integrations',
    category: 'PREMIUM',
    icon: 'Code',
    display_order: 14,
  },
  {
    feature_code: 'REPORT_ADV',
    name: 'Advanced Reports',
    description: 'Custom reports and data exports',
    category: 'PREMIUM',
    icon: 'TrendingUp',
    display_order: 15,
  },
  {
    feature_code: 'SSO_LOGIN',
    name: 'SSO Login',
    description: 'Single Sign-On with Google/Microsoft',
    category: 'ENTERPRISE',
    icon: 'Shield',
    display_order: 16,
  },
  {
    feature_code: 'DED_SUPPORT',
    name: 'Dedicated Support',
    description: '24/7 priority support with dedicated account manager',
    category: 'ENTERPRISE',
    icon: 'Headphones',
    display_order: 17,
  },
  {
    feature_code: 'REPORT_TASK_STATUS',
    name: 'Task Completion & Status Report',
    description: 'Detailed breakdown of tasks by status (Open, In Progress, Completed, Overdue)',
    category: 'CORE',
    icon: 'PieChart',
    display_order: 18,
  },
  {
    feature_code: 'REPORT_OVERDUE',
    name: 'Overdue Tasks Report',
    description: 'Track and analyze overdue tasks across individuals and teams',
    category: 'CORE',
    icon: 'AlertCircle',
    display_order: 19,
  },
  {
    feature_code: 'REPORT_PRODUCTIVITY',
    name: 'Productivity & Efficiency Report',
    description: 'Measure reliability by tracking on-time vs late task completions',
    category: 'CORE',
    icon: 'Zap',
    display_order: 20,
  },
  {
    feature_code: 'REPORT_WORKLOAD',
    name: 'Workload Distribution Report',
    description: 'Analyze task distribution across team members to prevent overload',
    category: 'CORE',
    icon: 'Users',
    display_order: 21,
  },
  {
    feature_code: 'REPORT_MILESTONE',
    name: 'Milestone Achievement Report',
    description: 'High-level indicator tracking achieved vs missed project milestones',
    category: 'CORE',
    icon: 'Flag',
    display_order: 22,
  },
  {
    feature_code: 'REPORT_RECURRING',
    name: 'Recurring Task Adherence Report',
    description: 'Ensure repetitive operational work is completed timely',
    category: 'CORE',
    icon: 'Repeat',
    display_order: 23,
  },
  {
    feature_code: 'REPORT_QUICK_CONVERSION',
    name: 'Quick Task Conversion Report',
    description: 'Insights into quick task adoption and workflow discipline',
    category: 'CORE',
    icon: 'ArrowRightCircle',
    display_order: 24,
  },
  {
    feature_code: 'REPORT_ACTIVITY',
    name: 'Activity/Engagement Report',
    description: 'Measure adoption and health through user interaction metrics',
    category: 'CORE',
    icon: 'Activity',
    display_order: 25,
  },
];
const mappings = [
  { license_code: 'EXPLORE', feature_code: 'TASK_BASIC', usage_limit: 20, is_enabled: true, limit_type: 'MONTHLY' },      // Max 20 tasks
  { license_code: 'EXPLORE', feature_code: 'TASK_SUB', usage_limit: 10, is_enabled: true, limit_type: 'MONTHLY' },        // Max 10 sub-tasks
  { license_code: 'EXPLORE', feature_code: 'TASK_QUICK', usage_limit: 50, is_enabled: true, limit_type: 'MONTHLY' },      // Up to 50
  { license_code: 'EXPLORE', feature_code: 'NOTIF_BASIC', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },        // Included
  { license_code: 'EXPLORE', feature_code: 'REPORT_BASIC', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },       // Standard only
  { license_code: 'EXPLORE', feature_code: 'TASK_RECUR', usage_limit: 1, is_enabled: true, limit_type: 'TOTAL' },         // 1 recurring task
  { license_code: 'EXPLORE', feature_code: 'TASK_APPROVAL', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },      // ❌ Not available
  { license_code: 'EXPLORE', feature_code: 'TASK_MSTONE', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },        // ❌ Not available
  { license_code: 'EXPLORE', feature_code: 'TASK_CAL', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },           // Basic calendar view
  { license_code: 'EXPLORE', feature_code: 'TASK_EMAIL', usage_limit: 10, is_enabled: true, limit_type: 'MONTHLY' },      // Max 10 emails
  { license_code: 'EXPLORE', feature_code: 'FORM_CREATE', usage_limit: 2, is_enabled: true, limit_type: 'TOTAL' },        // 2 forms
  { license_code: 'EXPLORE', feature_code: 'NOTIF_ADV', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },          // ❌ Not available
  { license_code: 'EXPLORE', feature_code: 'PROC_CREATE', usage_limit: 1, is_enabled: true, limit_type: 'TOTAL' },        // 1 process
  { license_code: 'EXPLORE', feature_code: 'API_ACCESS', usage_limit: 5, is_enabled: true, limit_type: 'DAILY' },         // 5 API calls/day
  { license_code: 'EXPLORE', feature_code: 'REPORT_ADV', usage_limit: 3, is_enabled: true, limit_type: 'MONTHLY' },       // 3 reports
  { license_code: 'EXPLORE', feature_code: 'SSO_LOGIN', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },          // ❌ Not available
  { license_code: 'EXPLORE', feature_code: 'DED_SUPPORT', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },        // ❌ Not available
  // 📊 New Reports Features
  { license_code: 'EXPLORE', feature_code: 'REPORT_TASK_STATUS', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },
  { license_code: 'EXPLORE', feature_code: 'REPORT_OVERDUE', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },
  { license_code: 'EXPLORE', feature_code: 'REPORT_PRODUCTIVITY', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },
  { license_code: 'EXPLORE', feature_code: 'REPORT_WORKLOAD', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },
  { license_code: 'EXPLORE', feature_code: 'REPORT_MILESTONE', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },
  { license_code: 'EXPLORE', feature_code: 'REPORT_RECURRING', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },
  { license_code: 'EXPLORE', feature_code: 'REPORT_QUICK_CONVERSION', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },
  { license_code: 'EXPLORE', feature_code: 'REPORT_ACTIVITY', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },

  // PLAN license mappings (Individuals / small teams - higher caps per spec)
  { license_code: 'PLAN', feature_code: 'TASK_BASIC', usage_limit: 100, is_enabled: true, limit_type: 'MONTHLY' },        // 100 tasks/month
  { license_code: 'PLAN', feature_code: 'TASK_SUB', usage_limit: 50, is_enabled: true, limit_type: 'MONTHLY' },           // 50/month
  { license_code: 'PLAN', feature_code: 'TASK_QUICK', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },            // Unlimited
  { license_code: 'PLAN', feature_code: 'NOTIF_BASIC', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },           // Included
  { license_code: 'PLAN', feature_code: 'REPORT_BASIC', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },          // Included
  { license_code: 'PLAN', feature_code: 'TASK_RECUR', usage_limit: 10, is_enabled: true, limit_type: 'TOTAL' },           // 10 recurring
  { license_code: 'PLAN', feature_code: 'TASK_APPROVAL', usage_limit: 20, is_enabled: true, limit_type: 'MONTHLY' },      // Up to 20/month
  { license_code: 'PLAN', feature_code: 'TASK_MSTONE', usage_limit: 5, is_enabled: true, limit_type: 'TOTAL' },           // 5 milestones
  { license_code: 'PLAN', feature_code: 'TASK_CAL', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },              // Full calendar, create tasks
  { license_code: 'PLAN', feature_code: 'TASK_EMAIL', usage_limit: 100, is_enabled: true, limit_type: 'MONTHLY' },        // 100/month
  { license_code: 'PLAN', feature_code: 'FORM_CREATE', usage_limit: 10, is_enabled: true, limit_type: 'TOTAL' },          // 10 forms
  { license_code: 'PLAN', feature_code: 'NOTIF_ADV', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },             // Included
  { license_code: 'PLAN', feature_code: 'PROC_CREATE', usage_limit: 5, is_enabled: true, limit_type: 'TOTAL' },           // 5 processes
  { license_code: 'PLAN', feature_code: 'API_ACCESS', usage_limit: 500, is_enabled: true, limit_type: 'DAILY' },          // 500/day
  { license_code: 'PLAN', feature_code: 'REPORT_ADV', usage_limit: 10, is_enabled: true, limit_type: 'MONTHLY' },         // 10 reports
  { license_code: 'PLAN', feature_code: 'SSO_LOGIN', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },             // ❌ Not available
  { license_code: 'PLAN', feature_code: 'DED_SUPPORT', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },           // ❌ Not available
  // 📊 New Reports Features
  { license_code: 'PLAN', feature_code: 'REPORT_TASK_STATUS', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },
  { license_code: 'PLAN', feature_code: 'REPORT_OVERDUE', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },
  { license_code: 'PLAN', feature_code: 'REPORT_PRODUCTIVITY', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },
  { license_code: 'PLAN', feature_code: 'REPORT_WORKLOAD', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },
  { license_code: 'PLAN', feature_code: 'REPORT_MILESTONE', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },
  { license_code: 'PLAN', feature_code: 'REPORT_RECURRING', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },
  { license_code: 'PLAN', feature_code: 'REPORT_QUICK_CONVERSION', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },
  { license_code: 'PLAN', feature_code: 'REPORT_ACTIVITY', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },

  // EXECUTE license mappings (Growing teams - unlimited on core features per spec)
  { license_code: 'EXECUTE', feature_code: 'TASK_BASIC', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },         // Unlimited
  { license_code: 'EXECUTE', feature_code: 'TASK_SUB', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },           // Unlimited
  { license_code: 'EXECUTE', feature_code: 'TASK_QUICK', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },         // Unlimited
  { license_code: 'EXECUTE', feature_code: 'NOTIF_BASIC', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },        // Included
  { license_code: 'EXECUTE', feature_code: 'REPORT_BASIC', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },       // Included
  { license_code: 'EXECUTE', feature_code: 'TASK_RECUR', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },         // Unlimited
  { license_code: 'EXECUTE', feature_code: 'TASK_APPROVAL', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },      // Unlimited
  { license_code: 'EXECUTE', feature_code: 'TASK_MSTONE', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },        // Unlimited
  { license_code: 'EXECUTE', feature_code: 'TASK_CAL', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },           // Unlimited with reminders
  { license_code: 'EXECUTE', feature_code: 'TASK_EMAIL', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },         // Unlimited
  { license_code: 'EXECUTE', feature_code: 'FORM_CREATE', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },        // Unlimited
  { license_code: 'EXECUTE', feature_code: 'NOTIF_ADV', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },          // Included
  { license_code: 'EXECUTE', feature_code: 'PROC_CREATE', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },        // Unlimited
  { license_code: 'EXECUTE', feature_code: 'API_ACCESS', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },         // Unlimited
  { license_code: 'EXECUTE', feature_code: 'REPORT_ADV', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },         // Unlimited
  { license_code: 'EXECUTE', feature_code: 'SSO_LOGIN', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },          // ❌ Not available
  { license_code: 'EXECUTE', feature_code: 'DED_SUPPORT', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },        // ❌ Not available
  // 📊 New Reports Features
  { license_code: 'EXECUTE', feature_code: 'REPORT_TASK_STATUS', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },
  { license_code: 'EXECUTE', feature_code: 'REPORT_OVERDUE', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },
  { license_code: 'EXECUTE', feature_code: 'REPORT_PRODUCTIVITY', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },
  { license_code: 'EXECUTE', feature_code: 'REPORT_WORKLOAD', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },
  { license_code: 'EXECUTE', feature_code: 'REPORT_MILESTONE', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },
  { license_code: 'EXECUTE', feature_code: 'REPORT_RECURRING', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },
  { license_code: 'EXECUTE', feature_code: 'REPORT_QUICK_CONVERSION', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },
  { license_code: 'EXECUTE', feature_code: 'REPORT_ACTIVITY', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },

  // OPTIMIZE license mappings (Large organizations - unlimited everything per spec)
  { license_code: 'OPTIMIZE', feature_code: 'TASK_BASIC', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },        // Unlimited
  { license_code: 'OPTIMIZE', feature_code: 'TASK_SUB', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },          // Unlimited
  { license_code: 'OPTIMIZE', feature_code: 'TASK_QUICK', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },        // Unlimited
  { license_code: 'OPTIMIZE', feature_code: 'NOTIF_BASIC', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },       // Included
  { license_code: 'OPTIMIZE', feature_code: 'REPORT_BASIC', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },      // Included
  { license_code: 'OPTIMIZE', feature_code: 'TASK_RECUR', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },        // Unlimited
  { license_code: 'OPTIMIZE', feature_code: 'TASK_APPROVAL', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },     // Unlimited
  { license_code: 'OPTIMIZE', feature_code: 'TASK_MSTONE', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },       // Unlimited
  { license_code: 'OPTIMIZE', feature_code: 'TASK_CAL', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },          // Unlimited + analytics overlay
  { license_code: 'OPTIMIZE', feature_code: 'TASK_EMAIL', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },        // Unlimited
  { license_code: 'OPTIMIZE', feature_code: 'FORM_CREATE', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },       // Unlimited
  { license_code: 'OPTIMIZE', feature_code: 'NOTIF_ADV', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },         // Included with SLA alerts
  { license_code: 'OPTIMIZE', feature_code: 'PROC_CREATE', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },       // Unlimited
  { license_code: 'OPTIMIZE', feature_code: 'API_ACCESS', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },        // Unlimited + priority
  { license_code: 'OPTIMIZE', feature_code: 'REPORT_ADV', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },        // Unlimited + export to PDF/Excel
  { license_code: 'OPTIMIZE', feature_code: 'SSO_LOGIN', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },         // ✅ Available (OPTIMIZE only)
  { license_code: 'OPTIMIZE', feature_code: 'DED_SUPPORT', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },       // ✅ Available (OPTIMIZE only)
  // 📊 New Reports Features
  { license_code: 'OPTIMIZE', feature_code: 'REPORT_TASK_STATUS', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },
  { license_code: 'OPTIMIZE', feature_code: 'REPORT_OVERDUE', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },
  { license_code: 'OPTIMIZE', feature_code: 'REPORT_PRODUCTIVITY', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },
  { license_code: 'OPTIMIZE', feature_code: 'REPORT_WORKLOAD', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },
  { license_code: 'OPTIMIZE', feature_code: 'REPORT_MILESTONE', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },
  { license_code: 'OPTIMIZE', feature_code: 'REPORT_RECURRING', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },
  { license_code: 'OPTIMIZE', feature_code: 'REPORT_QUICK_CONVERSION', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },
  { license_code: 'OPTIMIZE', feature_code: 'REPORT_ACTIVITY', usage_limit: -1, is_enabled: true, limit_type: 'NONE' },

  // EXPIRED license mappings (no access)
  { license_code: 'EXPIRED', feature_code: 'TASK_BASIC', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },
  { license_code: 'EXPIRED', feature_code: 'TASK_SUB', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },
  { license_code: 'EXPIRED', feature_code: 'TASK_QUICK', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },
  { license_code: 'EXPIRED', feature_code: 'NOTIF_BASIC', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },
  { license_code: 'EXPIRED', feature_code: 'REPORT_BASIC', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },
  { license_code: 'EXPIRED', feature_code: 'TASK_RECUR', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },
  { license_code: 'EXPIRED', feature_code: 'TASK_APPROVAL', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },
  { license_code: 'EXPIRED', feature_code: 'TASK_MSTONE', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },
  { license_code: 'EXPIRED', feature_code: 'TASK_CAL', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },
  { license_code: 'EXPIRED', feature_code: 'TASK_EMAIL', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },
  { license_code: 'EXPIRED', feature_code: 'FORM_CREATE', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },
  { license_code: 'EXPIRED', feature_code: 'NOTIF_ADV', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },
  { license_code: 'EXPIRED', feature_code: 'PROC_CREATE', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },
  { license_code: 'EXPIRED', feature_code: 'API_ACCESS', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },
  { license_code: 'EXPIRED', feature_code: 'REPORT_ADV', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },
  { license_code: 'EXPIRED', feature_code: 'SSO_LOGIN', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },
  { license_code: 'EXPIRED', feature_code: 'DED_SUPPORT', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },
  // 📊 New Reports Features
  { license_code: 'EXPIRED', feature_code: 'REPORT_TASK_STATUS', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },
  { license_code: 'EXPIRED', feature_code: 'REPORT_OVERDUE', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },
  { license_code: 'EXPIRED', feature_code: 'REPORT_PRODUCTIVITY', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },
  { license_code: 'EXPIRED', feature_code: 'REPORT_WORKLOAD', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },
  { license_code: 'EXPIRED', feature_code: 'REPORT_MILESTONE', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },
  { license_code: 'EXPIRED', feature_code: 'REPORT_RECURRING', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },
  { license_code: 'EXPIRED', feature_code: 'REPORT_QUICK_CONVERSION', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },
  { license_code: 'EXPIRED', feature_code: 'REPORT_ACTIVITY', usage_limit: 0, is_enabled: false, limit_type: 'NONE' },
];

async function seedLicenseData() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await License.deleteMany({});
    await Feature.deleteMany({});
    await LicenseFeatureMapping.deleteMany({});
    console.log('✅ Cleared existing data\n');

    // Insert licenses
    console.log('📝 Inserting licenses...');
    const insertedLicenses = await License.insertMany(licenses);
    console.log(`✅ Inserted ${insertedLicenses.length} licenses`);
    insertedLicenses.forEach((license) => {
      console.log(`   - ${license.license_code}: ${license.name} (₹${license.price_monthly}/mo)`);
    });
    console.log('');

    // Insert features
    console.log('📝 Inserting features...');
    const insertedFeatures = await Feature.insertMany(features);
    console.log(`✅ Inserted ${insertedFeatures.length} features`);

    const featuresByCategory = {};
    insertedFeatures.forEach((feature) => {
      if (!featuresByCategory[feature.category]) {
        featuresByCategory[feature.category] = [];
      }
      featuresByCategory[feature.category].push(feature.name);
    });

    Object.keys(featuresByCategory).forEach((category) => {
      console.log(`   ${category}:`);
      featuresByCategory[category].forEach((name) => {
        console.log(`      - ${name}`);
      });
    });
    console.log('');

    // Insert license-feature mappings
    console.log('📝 Inserting license-feature mappings...');
    const insertedMappings = await LicenseFeatureMapping.insertMany(mappings);
    console.log(`✅ Inserted ${insertedMappings.length} mappings\n`);

    // Summary by license
    const mappingsByLicense = {};
    insertedMappings.forEach((mapping) => {
      if (!mappingsByLicense[mapping.license_code]) {
        mappingsByLicense[mapping.license_code] = {
          enabled: 0,
          disabled: 0,
          unlimited: 0,
          limited: 0,
        };
      }
      if (mapping.is_enabled) {
        mappingsByLicense[mapping.license_code].enabled++;
        if (mapping.usage_limit === -1) {
          mappingsByLicense[mapping.license_code].unlimited++;
        } else {
          mappingsByLicense[mapping.license_code].limited++;
        }
      } else {
        mappingsByLicense[mapping.license_code].disabled++;
      }
    });

    console.log('📊 License Feature Summary:');
    Object.keys(mappingsByLicense).forEach((licenseCode) => {
      const stats = mappingsByLicense[licenseCode];
      console.log(`   ${licenseCode}:`);
      console.log(`      - Enabled: ${stats.enabled} (${stats.unlimited} unlimited, ${stats.limited} limited)`);
      console.log(`      - Disabled: ${stats.disabled}`);
    });
    console.log('');

    console.log('✅ Seed data inserted successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Licenses: ${insertedLicenses.length}`);
    console.log(`   - Features: ${insertedFeatures.length}`);
    console.log(`   - Mappings: ${insertedMappings.length}`);

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

// Run the seed function
seedLicenseData();
