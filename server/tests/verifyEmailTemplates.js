import {
  renderDailyDigestEmail,
  renderCriticalOverdueEmail,
  renderTaskAssignmentEmail,
  renderApprovalRequiredEmail,
  renderTaskChangeRequestEmail,
  renderTaskChangeDecisionEmail,
  renderTasksDueTodayEmail,
  renderGenericNotificationEmail,
  renderNotificationDigestEmail,
  renderMissedTaskEmail,
  renderLicenseExpiryEmail
} from '../services/emailTemplates/index.js';
import fs from 'fs';
import path from 'path';

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  } else {
    passedTests++;
    console.log(`✅ PASSED: ${message}`);
  }
}

function checkHtmlHealth(html, templateName) {
  // Check for common bad outputs
  assert(!html.includes('undefined'), `${templateName} has no "undefined" text`);
  assert(!html.includes('null'), `${templateName} has no "null" text`);
  assert(!html.includes('[object Object]'), `${templateName} has no "[object Object]"`);
  assert(html.includes('TaskSetu'), `${templateName} contains TaskSetu branding`);
  assert(html.includes('<!DOCTYPE'), `${templateName} contains DOCTYPE`);
  assert(html.includes('<html'), `${templateName} contains <html>`);
  assert(html.includes('Manage notification preferences'), `${templateName} contains preferences link`);
}

console.log('='.repeat(70));
console.log('🚀 RUNNING TASKSETU EMAIL TEMPLATES VERIFICATION SUITE');
console.log('='.repeat(70));

const baseUrl = 'https://tasksetu.app';

// ── TEST 1: Daily Digest with Realistic Data ────────────────────────────────
console.log('\n--- 1. Testing Daily Digest Email (Realistic Data) ---');
const sampleDigestUser = { firstName: 'Aichchhik', lastName: 'Das', email: 'aichchhik12@gmail.com' };
const sampleDigestSummary = {
  overdueTasks: [
    { _id: 'task_1', title: 'Complete client documentation', priority: 'high', dueDate: new Date(Date.now() - 3 * 86400000) },
    { _id: 'task_2', title: 'Update project report', priority: 'medium', dueDate: new Date(Date.now() - 2 * 86400000) },
    { _id: 'task_3', title: 'Submit project details', priority: 'low', dueDate: new Date(Date.now() - 1 * 86400000) }
  ],
  dueToday: [
    { _id: 'task_4', title: 'Complete API integration', priority: 'critical', dueDate: new Date() },
    { _id: 'task_5', title: 'Review team progress', priority: 'medium', dueDate: new Date() }
  ],
  dueSoon: [
    { _id: 'task_6', title: 'Database optimization', priority: 'medium', dueDate: new Date(Date.now() + 2 * 86400000) },
    { _id: 'task_7', title: 'UI review', priority: 'low', dueDate: new Date(Date.now() + 3 * 86400000) }
  ],
  pendingApprovals: [
    { _id: 'app_1', title: 'Budget Allocation Q4', createdBy: { firstName: 'Nitesh' }, autoApproveAfter: new Date(Date.now() + 86400000) }
  ],
  totalPending: 9
};

const digestHtml = renderDailyDigestEmail({
  user: sampleDigestUser,
  taskSummary: sampleDigestSummary,
  baseUrl,
  userTimezone: 'Asia/Kolkata'
});

checkHtmlHealth(digestHtml, 'Daily Digest');
assert(digestHtml.includes('Complete client documentation'), 'Daily digest includes overdue task title');
assert(digestHtml.includes('Complete API integration'), 'Daily digest includes today task title');
assert(digestHtml.includes('Database optimization'), 'Daily digest includes upcoming task title');
assert(digestHtml.includes('Budget Allocation Q4'), 'Daily digest includes pending approval');
assert(digestHtml.includes('Open My Dashboard'), 'Daily digest includes primary CTA button');
assert(digestHtml.includes('Your Daily Focus'), 'Daily digest includes focus section');

// ── TEST 2: Daily Digest Empty State (0 tasks) ──────────────────────────────
console.log('\n--- 2. Testing Daily Digest Email (Empty State) ---');
const emptyDigestHtml = renderDailyDigestEmail({
  user: sampleDigestUser,
  taskSummary: { overdueTasks: [], dueToday: [], dueSoon: [], totalPending: 0 },
  baseUrl
});
checkHtmlHealth(emptyDigestHtml, 'Daily Digest Empty State');
assert(emptyDigestHtml.includes('all caught up'), 'Empty daily digest indicates caught up state');

// ── TEST 3: Critical Overdue Task Email ──────────────────────────────────────
console.log('\n--- 3. Testing Critical Overdue Task Email ---');
const overdueTask = {
  _id: 'task_overdue_101',
  title: 'Migrate production database clusters to high-availability mode',
  description: 'Cluster failover testing and primary replica synchronization.',
  priority: 'critical',
  dueDate: new Date(Date.now() - 9 * 86400000),
  status: 'IN_PROGRESS',
  project: { name: 'Core Infrastructure' },
  team: { name: 'DevOps & Reliability' }
};

const overdueHtml = renderCriticalOverdueEmail({
  user: sampleDigestUser,
  task: overdueTask,
  daysOverdue: 9,
  hoursOverdue: 216,
  isEscalation: true,
  escalationLevel: 'manager',
  responsibleEmployeeName: 'Aichchhik Das',
  assignedByName: 'Nitesh Sharma',
  baseUrl
});

checkHtmlHealth(overdueHtml, 'Critical Overdue Email');
assert(overdueHtml.includes('Critical Task Overdue'), 'Header says Critical Task Overdue');
assert(overdueHtml.includes('overdue for <strong>9 days</strong>'), 'Overdue alert highlights days');
assert(overdueHtml.includes('Review Overdue Task'), 'Contains Review Overdue Task button');
assert(overdueHtml.includes('Escalation Notice'), 'Contains escalation notice for manager');
assert(overdueHtml.includes('Core Infrastructure'), 'Contains project name');

// ── TEST 4: New Task Assigned Email ─────────────────────────────────────────
console.log('\n--- 4. Testing New Task Assigned Email ---');
const assignedTask = {
  _id: 'task_assigned_202',
  title: 'Collect Information of Users for Data Analysis',
  description: 'Collect information of users for data and export structured metrics report.',
  taskType: 'regular',
  priority: 'medium',
  dueDate: new Date(Date.now() + 5 * 86400000),
  status: 'OPEN',
  project: { name: 'User Management' },
  team: { name: 'Development' }
};

const assignmentHtml = renderTaskAssignmentEmail({
  user: sampleDigestUser,
  task: assignedTask,
  assignedBy: { firstName: 'Nitesh', lastName: 'Kumar' },
  baseUrl
});

checkHtmlHealth(assignmentHtml, 'New Task Assigned Email');
assert(assignmentHtml.includes('New Task Assigned'), 'Header says New Task Assigned');
assert(assignmentHtml.includes('Nitesh Kumar'), 'Assigned by name shown');
assert(assignmentHtml.includes('Collect Information of Users'), 'Task title shown');
assert(assignmentHtml.includes('User Management'), 'Project name shown');
assert(assignmentHtml.includes('View Task'), 'CTA button is View Task');

// ── TEST 5: New Approval Task Assigned Email ────────────────────────────────
console.log('\n--- 5. Testing Approval Required Email ---');
const approvalTask = {
  _id: 'task_approval_303',
  title: 'Approval for Admin Role Elevation',
  description: 'Approval request for elevating permissions to administrator.',
  taskType: 'approval',
  isApprovalTask: true,
  priority: 'high',
  autoApproveAfter: new Date(Date.now() + 2 * 86400000),
  status: 'PENDING',
  createdAt: new Date()
};

const approvalHtml = renderApprovalRequiredEmail({
  user: sampleDigestUser,
  task: approvalTask,
  requestedBy: { firstName: 'Nitesh', lastName: 'Admin' },
  baseUrl
});

checkHtmlHealth(approvalHtml, 'Approval Required Email');
assert(approvalHtml.includes('Approval Required'), 'Header says Approval Required');
assert(approvalHtml.includes('Approval for Admin Role Elevation'), 'Approval title shown');
assert(approvalHtml.includes('Nitesh Admin'), 'Requester name shown');
assert(approvalHtml.includes('Approve') && approvalHtml.includes('Reject'), 'Contains Approve and Reject buttons');
assert(approvalHtml.includes('action=approve'), 'Approve button links with action=approve');
assert(approvalHtml.includes('action=reject'), 'Reject button links with action=reject');
assert(approvalHtml.includes('Awaiting your decision'), 'Status indicates awaiting decision');

// ── TEST 6: Task Change Request Email (To Approver) ─────────────────────────
console.log('\n--- 6. Testing Task Change Approval Request (Approver) ---');
const changeReqHtml = renderTaskChangeRequestEmail({
  approver: { firstName: 'Nitesh', email: 'nitesh@example.com' },
  requesterName: 'Aichchhik Das',
  task: { _id: 'task_chg_404', title: 'API Integration Testing' },
  requestedChanges: {
    dueDate: { old: '2026-11-18', new: '2026-11-22' },
    priority: { old: 'medium', new: 'urgent' }
  },
  reason: 'Additional development work and end-to-end regression testing required.',
  actionUrl: `${baseUrl}/task-change-action?token=test_token_123`,
  baseUrl
});

checkHtmlHealth(changeReqHtml, 'Task Change Request Email');
assert(changeReqHtml.includes('Task Change Approval Requested'), 'Header says Task Change Approval Requested');
assert(changeReqHtml.includes('Aichchhik Das'), 'Requester employee name shown');
assert(changeReqHtml.includes('Approve Changes') && changeReqHtml.includes('Reject Changes'), 'Contains Approve and Reject Changes buttons');
assert(changeReqHtml.includes('action=approve') && changeReqHtml.includes('action=reject'), 'Action links contain approve and reject query params');
assert(changeReqHtml.includes('Additional development work'), 'Reason shown');
assert(changeReqHtml.includes('2026-11-22'), 'New value shown in diff table');

// ── TEST 7: Task Change Request Decision Email (To Employee) ────────────────
console.log('\n--- 7. Testing Task Change Decision Email (Employee) ---');
const decisionApprovedHtml = renderTaskChangeDecisionEmail({
  employee: sampleDigestUser,
  task: { _id: 'task_chg_404', title: 'API Integration Testing' },
  decision: 'APPROVED',
  approverName: 'Nitesh Manager',
  approverReason: 'Approved as discussed in yesterday standup.',
  requestedChanges: {
    dueDate: { old: '2026-11-18', new: '2026-11-22' }
  },
  baseUrl
});

checkHtmlHealth(decisionApprovedHtml, 'Task Change Decision Email (Approved)');
assert(decisionApprovedHtml.includes('Changes Approved'), 'Shows approved banner');
assert(decisionApprovedHtml.includes('Nitesh Manager'), 'Shows approver name');

const decisionRejectedHtml = renderTaskChangeDecisionEmail({
  employee: sampleDigestUser,
  task: { _id: 'task_chg_404', title: 'API Integration Testing' },
  decision: 'REJECTED',
  approverName: 'Nitesh Manager',
  approverReason: 'Deadline cannot be moved past milestone cutoff.',
  requestedChanges: {
    dueDate: { old: '2026-11-18', new: '2026-11-22' }
  },
  baseUrl
});

checkHtmlHealth(decisionRejectedHtml, 'Task Change Decision Email (Rejected)');
assert(decisionRejectedHtml.includes('Changes Rejected'), 'Shows rejected banner');

// ── TEST 8: Tasks Due Today Email ───────────────────────────────────────────
console.log('\n--- 8. Testing Tasks Due Today Email ---');
const dueTodayHtml = renderTasksDueTodayEmail({
  user: sampleDigestUser,
  tasks: [
    { _id: 't_today_1', title: 'Prepare Client Demo Presentation', priority: 'high', taskType: 'regular' },
    { _id: 't_today_2', title: 'Finalize QA Sign-off', priority: 'critical', taskType: 'milestone' }
  ],
  baseUrl
});

checkHtmlHealth(dueTodayHtml, 'Tasks Due Today Email');
assert(dueTodayHtml.includes('Due Today'), 'Header says Due Today');
assert(dueTodayHtml.includes('Prepare Client Demo Presentation'), 'Task title 1 shown');
assert(dueTodayHtml.includes('Finalize QA Sign-off'), 'Task title 2 shown');

// ── TEST 9: Generic Notification (Task Completed, Comment, Mention) ──────────
console.log('\n--- 9. Testing Generic Notification System ---');
const commentNotif = {
  title: 'New Comment on "Database Optimization"',
  message: 'Nitesh commented: "The indexing query has improved response times by 40%."',
  priority: 'normal',
  trigger_event: 'comment_added',
  related_entity: { entity_id: 'task_comment_505' },
  metadata: { commenter: 'Nitesh', task_name: 'Database Optimization' }
};

const commentHtml = renderGenericNotificationEmail({
  notification: commentNotif,
  user: sampleDigestUser,
  role: 'assignee',
  baseUrl
});

checkHtmlHealth(commentHtml, 'Comment Added Notification Email');
assert(commentHtml.includes('New Comment'), 'Header mentions New Comment');
assert(commentHtml.includes('indexing query has improved response times'), 'Comment text included');
assert(commentHtml.includes('View Conversation'), 'CTA is View Conversation');

const completedNotif = {
  title: 'Task Completed: "Payment Gateway Integration"',
  message: 'Payment Gateway Integration has been marked as completed by Nitesh.',
  priority: 'normal',
  trigger_event: 'task_completed',
  related_entity: { entity_id: 'task_comp_606' },
  metadata: { completed_by: 'Nitesh', task_title: 'Payment Gateway Integration' }
};

const completedHtml = renderGenericNotificationEmail({
  notification: completedNotif,
  user: sampleDigestUser,
  role: 'creator',
  baseUrl
});

checkHtmlHealth(completedHtml, 'Task Completed Notification Email');
assert(completedHtml.includes('Task Completed'), 'Header says Task Completed');
assert(completedHtml.includes('View Completed Task'), 'CTA is View Completed Task');

// ── TEST 10: Final Missed Task Alert ────────────────────────────────────────
console.log('\n--- 10. Testing Final Missed Task Alert ---');
const missedHtml = renderMissedTaskEmail({
  user: sampleDigestUser,
  task: { _id: 'task_missed_707', title: 'Quarterly Security Audit', priority: 'critical', dueDate: new Date(Date.now() - 2 * 86400000) },
  daysOverdue: 2,
  hoursOverdue: 48,
  baseUrl
});

checkHtmlHealth(missedHtml, 'Missed Task Alert');
assert(missedHtml.includes('TASK MISSED'), 'Badge says TASK MISSED');
assert(missedHtml.includes('Complete Task Now'), 'CTA is Complete Task Now');

// ── TEST 11: License Expiry Reminder ────────────────────────────────────────
console.log('\n--- 11. Testing License Expiry Reminder ---');
const licenseHtml = renderLicenseExpiryEmail({
  user: sampleDigestUser,
  licenseInfo: { licenseCode: 'PRO', expiryDate: new Date(Date.now() + 3 * 86400000), organizationName: 'Acme Corp' },
  daysRemaining: 3,
  baseUrl
});

checkHtmlHealth(licenseHtml, 'License Expiry Reminder');
assert(licenseHtml.includes('Expires in 3 Days'), 'Header says Expires in 3 Days');
assert(licenseHtml.includes('Renew My License'), 'CTA is Renew My License');

// Save preview artifacts to disk for user inspection
const outputDir = path.join(process.cwd(), 'scratch', 'email_previews');
fs.mkdirSync(outputDir, { recursive: true });

fs.writeFileSync(path.join(outputDir, '1_daily_digest.html'), digestHtml);
fs.writeFileSync(path.join(outputDir, '2_critical_overdue.html'), overdueHtml);
fs.writeFileSync(path.join(outputDir, '3_new_task_assigned.html'), assignmentHtml);
fs.writeFileSync(path.join(outputDir, '4_approval_required.html'), approvalHtml);
fs.writeFileSync(path.join(outputDir, '5_task_change_request.html'), changeReqHtml);
fs.writeFileSync(path.join(outputDir, '6_task_change_approved.html'), decisionApprovedHtml);
fs.writeFileSync(path.join(outputDir, '7_task_due_today.html'), dueTodayHtml);
fs.writeFileSync(path.join(outputDir, '8_task_comment.html'), commentHtml);

console.log(`\n📁 Saved 8 HTML preview files to: ${outputDir}`);
console.log('='.repeat(70));
console.log(`🎉 ALL ${passedTests} TESTS PASSED OUT OF ${totalTests}!`);
console.log('='.repeat(70));
