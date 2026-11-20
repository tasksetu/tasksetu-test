import {
  BRAND_COLORS,
  escapeHtml,
  formatDate,
  renderBadge,
  renderPriorityBadge,
  renderTaskTypeBadge,
  renderStatusBadge,
  renderButton,
  renderApprovalActionButtons,
  renderDetailsCard,
  renderCalloutBox,
  renderMetricsGrid,
  renderDigestItem,
  renderChangesDiffTable,
  wrapInBaseLayout
} from './emailDesignSystem.js';

/**
 * 1. ☀️ Daily Digest / Good Morning Email
 * Exact match to TaskSetu Good Morning visual specification (Purple #6559C9 header card, 4 metrics, clean bullet lists)
 */
export function renderDailyDigestEmail({ user, taskSummary = {}, baseUrl = 'https://tasksetu.app', userTimezone = 'Asia/Kolkata' }) {
  const {
    overdueTasks = [],
    dueToday = [],
    dueSoon = [],
    pendingApprovals = [],
    otherPendingTasks = [],
    pendingTasks = [],
    completedYesterday = [],
    totalPending = 0
  } = taskSummary;

  const firstName = escapeHtml(user?.firstName || 'there');
  const safeBaseUrl = baseUrl.replace(/\/+$/, '');

  // Time of day greeting
  let greetingTime = 'Good Morning';
  try {
    const now = new Date();
    const hourStr = new Intl.DateTimeFormat('en-US', { timeZone: userTimezone, hour: 'numeric', hour12: false }).format(now);
    const hour = parseInt(hourStr, 10);
    if (!isNaN(hour)) {
      if (hour >= 12 && hour < 17) greetingTime = 'Good Afternoon';
      else if (hour >= 17 || hour < 4) greetingTime = 'Good Evening';
    }
  } catch (e) {
    // fallback
  }

  // Today formatted date
  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    timeZone: userTimezone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date());

  const overdueCount = overdueTasks.length;
  const dueTodayCount = dueToday.length;
  const upcomingCount = dueSoon.length;
  const pendingCount = totalPending || (overdueCount + dueTodayCount + upcomingCount + pendingApprovals.length);

  // Daily focus advice matching specification
  let focusMessage = '';
  if (overdueCount > 0 && dueTodayCount > 0) {
    focusMessage = `You have ${dueTodayCount} task${dueTodayCount !== 1 ? 's' : ''} to complete today. Prioritize your overdue tasks first.`;
  } else if (overdueCount > 0) {
    focusMessage = `You have ${overdueCount} overdue task${overdueCount !== 1 ? 's' : ''}. Prioritize resolving them to stay on schedule.`;
  } else if (dueTodayCount > 0) {
    focusMessage = `You have ${dueTodayCount} task${dueTodayCount !== 1 ? 's' : ''} due today. Focus on getting them completed today.`;
  } else if (upcomingCount > 0) {
    focusMessage = `No urgent tasks today! You have ${upcomingCount} upcoming task${upcomingCount !== 1 ? 's' : ''} later this week.`;
  } else {
    focusMessage = `You're all caught up! No urgent or overdue tasks on your plate today. Great work staying ahead of schedule.`;
  }

  // Overdue section
  const renderOverdueSection = () => {
    if (overdueTasks.length === 0) return '';
    return `
      <div style="margin-bottom:18px;">
        <div style="font-size:13px;font-weight:700;color:#1F2937;margin-bottom:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          ⚠️ Overdue Tasks
        </div>
        <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.8;color:#374151;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          ${overdueTasks.slice(0, 5).map(t => {
            const taskUrl = `${safeBaseUrl}/tasks/${t._id || t.id}`;
            let diffDays = 1;
            if (t.dueDate) {
              diffDays = Math.max(1, Math.ceil((new Date() - new Date(t.dueDate)) / (1000 * 60 * 60 * 24)));
            }
            return `<li style="margin-bottom:2px;"><a href="${taskUrl}" style="color:#1F2937;text-decoration:none;font-weight:500;">${escapeHtml(t.title)}</a> <span style="color:#4B5563;">&mdash; ${diffDays} day${diffDays !== 1 ? 's' : ''} overdue</span></li>`;
          }).join('')}
        </ul>
        <div style="border-top:1px solid #F3F4F6;margin-top:18px;"></div>
      </div>
    `;
  };

  // Today's tasks section
  const renderTodaySection = () => {
    if (dueToday.length === 0) return '';
    return `
      <div style="margin-bottom:18px;">
        <div style="font-size:13px;font-weight:700;color:#1F2937;margin-bottom:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          🗓️ Today's Tasks
        </div>
        <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.8;color:#374151;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          ${dueToday.slice(0, 5).map(t => {
            const taskUrl = `${safeBaseUrl}/tasks/${t._id || t.id}`;
            return `<li style="margin-bottom:2px;"><a href="${taskUrl}" style="color:#1F2937;text-decoration:none;font-weight:500;">${escapeHtml(t.title)}</a></li>`;
          }).join('')}
        </ul>
        <div style="border-top:1px solid #F3F4F6;margin-top:18px;"></div>
      </div>
    `;
  };

  // Upcoming tasks section
  const renderUpcomingSection = () => {
    if (dueSoon.length === 0) return '';
    return `
      <div style="margin-bottom:18px;">
        <div style="font-size:13px;font-weight:700;color:#1F2937;margin-bottom:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          🔜 Upcoming Tasks
        </div>
        <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.8;color:#374151;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          ${dueSoon.slice(0, 5).map(t => {
            const taskUrl = `${safeBaseUrl}/tasks/${t._id || t.id}`;
            let dateStr = '';
            if (t.dueDate) {
              dateStr = new Intl.DateTimeFormat('en-US', { timeZone: userTimezone, month: 'short', day: 'numeric' }).format(new Date(t.dueDate));
            }
            return `<li style="margin-bottom:2px;"><a href="${taskUrl}" style="color:#1F2937;text-decoration:none;font-weight:500;">${escapeHtml(t.title)}</a>${dateStr ? ` <span style="color:#4B5563;">&mdash; ${dateStr}</span>` : ''}</li>`;
          }).join('')}
        </ul>
        <div style="border-top:1px solid #F3F4F6;margin-top:18px;"></div>
      </div>
    `;
  };

  // Pending Approvals section
  const renderApprovalsSection = () => {
    if (!pendingApprovals || pendingApprovals.length === 0) return '';
    return `
      <div style="margin-bottom:18px;">
        <div style="font-size:13px;font-weight:700;color:#1F2937;margin-bottom:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          ⚡ Pending Approvals
        </div>
        <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.8;color:#374151;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          ${pendingApprovals.slice(0, 5).map(a => {
            const appUrl = `${safeBaseUrl}/tasks/${a._id || a.id}`;
            const reqBy = a.createdBy?.firstName
              ? `Requested by ${a.createdBy.firstName} ${a.createdBy.lastName || ''}`.trim()
              : a.assignedBy?.firstName
              ? `Requested by ${a.assignedBy.firstName}`
              : '';
            let deadlineStr = '';
            if (a.autoApproveAfter || a.dueDate) {
              const d = new Date(a.autoApproveAfter || a.dueDate);
              if (!isNaN(d.getTime())) {
                deadlineStr = `Deadline: ${new Intl.DateTimeFormat('en-US', { timeZone: userTimezone, month: 'short', day: 'numeric' }).format(d)}`;
              }
            }
            const metaInfo = [reqBy, deadlineStr].filter(Boolean).join(' • ');
            return `<li style="margin-bottom:2px;"><a href="${appUrl}" style="color:#1F2937;text-decoration:none;font-weight:500;">${escapeHtml(a.title)}</a>${metaInfo ? ` <span style="color:#4B5563;">&mdash; ${escapeHtml(metaInfo)}</span>` : ''}</li>`;
          }).join('')}
        </ul>
        <div style="border-top:1px solid #F3F4F6;margin-top:18px;"></div>
      </div>
    `;
  };

  // Other Pending Tasks section (for general pending tasks not in overdue/today/upcoming/approvals)
  const renderOtherPendingSection = () => {
    const existingIds = new Set([
      ...overdueTasks.map(t => String(t._id || t.id)),
      ...dueToday.map(t => String(t._id || t.id)),
      ...dueSoon.map(t => String(t._id || t.id)),
      ...pendingApprovals.map(t => String(t._id || t.id))
    ]);

    const remainingTasks = (otherPendingTasks.length > 0 ? otherPendingTasks : pendingTasks).filter(
      t => t && !existingIds.has(String(t._id || t.id))
    );

    if (remainingTasks.length === 0) return '';

    return `
      <div style="margin-bottom:18px;">
        <div style="font-size:13px;font-weight:700;color:#1F2937;margin-bottom:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          📋 Other Pending Tasks
        </div>
        <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.8;color:#374151;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          ${remainingTasks.slice(0, 5).map(t => {
            const taskUrl = `${safeBaseUrl}/tasks/${t._id || t.id}`;
            let metaStr = '';
            if (t.dueDate) {
              metaStr = new Intl.DateTimeFormat('en-US', { timeZone: userTimezone, month: 'short', day: 'numeric' }).format(new Date(t.dueDate));
            } else if (t.status) {
              metaStr = String(t.status).replace('_', ' ');
            }
            return `<li style="margin-bottom:2px;"><a href="${taskUrl}" style="color:#1F2937;text-decoration:none;font-weight:500;">${escapeHtml(t.title)}</a>${metaStr ? ` <span style="color:#4B5563;">&mdash; ${escapeHtml(metaStr)}</span>` : ''}</li>`;
          }).join('')}
        </ul>
        <div style="border-top:1px solid #F3F4F6;margin-top:18px;"></div>
      </div>
    `;
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Good Morning! — TaskSetu</title>
</head>
<body style="margin:0;padding:24px 10px;background-color:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
          <tr>
            <td style="padding:20px 26px 26px 26px;">

              <!-- Top Purple Banner (#6559C9) -->
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#6559C9;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td align="center" style="padding:24px 20px 20px 20px;text-align:center;">
                    <div style="font-size:24px;line-height:1;margin-bottom:6px;">☀️</div>
                    <div style="color:#FFFFFF;font-size:21px;font-weight:700;line-height:1.2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                      ${greetingTime}!
                    </div>
                    <div style="color:#FFFFFF;font-size:16px;font-weight:600;margin-top:5px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                      ${firstName}
                    </div>
                    <div style="color:rgba(255,255,255,0.85);font-size:11px;margin-top:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                      Your daily work summary
                    </div>
                    <div style="color:rgba(255,255,255,0.75);font-size:11px;margin-top:2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                      ${todayFormatted}
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Metrics Row (4 columns) -->
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom:24px;text-align:center;">
                <tr>
                  <td width="25%" align="center" style="text-align:center;padding:0 4px;">
                    <div style="font-size:24px;font-weight:700;color:#EF4444;line-height:1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                      ${overdueCount}
                    </div>
                    <div style="font-size:12px;color:#6B7280;margin-top:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                      Overdue
                    </div>
                  </td>
                  <td width="25%" align="center" style="text-align:center;padding:0 4px;">
                    <div style="font-size:24px;font-weight:700;color:#F59E0B;line-height:1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                      ${dueTodayCount}
                    </div>
                    <div style="font-size:12px;color:#6B7280;margin-top:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                      Due Today
                    </div>
                  </td>
                  <td width="25%" align="center" style="text-align:center;padding:0 4px;">
                    <div style="font-size:24px;font-weight:700;color:#3B82F6;line-height:1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                      ${upcomingCount}
                    </div>
                    <div style="font-size:12px;color:#6B7280;margin-top:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                      Upcoming
                    </div>
                  </td>
                  <td width="25%" align="center" style="text-align:center;padding:0 4px;">
                    <div style="font-size:24px;font-weight:700;color:#1F2937;line-height:1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                      ${pendingCount}
                    </div>
                    <div style="font-size:12px;color:#6B7280;margin-top:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                      Pending
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Sections -->
              ${renderOverdueSection()}
              ${renderTodaySection()}
              ${renderUpcomingSection()}
              ${renderApprovalsSection()}
              ${renderOtherPendingSection()}

              <!-- Your Daily Focus -->
              <div style="margin-bottom:24px;">
                <div style="font-size:13px;font-weight:700;color:#1F2937;margin-bottom:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                  🎯 Your Daily Focus
                </div>
                <div style="font-size:13px;color:#374151;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                  ${focusMessage}
                </div>
              </div>

              <!-- Full Width CTA Button in #6559C9 -->
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:20px 0 14px 0;">
                <tr>
                  <td align="center">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeBaseUrl}/tasks" style="height:44px;v-text-anchor:middle;width:540px;" arcsize="18%" stroke="f" fillcolor="#6559C9">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;font-weight:600;">Open My Dashboard &rarr;</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${safeBaseUrl}/tasks" target="_blank" style="display:block;width:100%;background-color:#6559C9;color:#FFFFFF !important;text-decoration:none !important;padding:12px 0;border-radius:8px;font-weight:600;font-size:14px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;box-sizing:border-box;">
                      Open My Dashboard &rarr;
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <!-- Footer -->
              <div style="font-size:11px;color:#9CA3AF;text-align:center;margin-top:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                Your personalized daily work summary from TaskSetu.
              </div>

              <!-- Unsubscribe / Preferences link -->
              <div style="font-size:10px;color:#CBD5E1;text-align:center;margin-top:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                <a href="${safeBaseUrl}/notification-settings" target="_blank" style="color:#94A3B8;text-decoration:underline;">Manage notification preferences</a>
              </div>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * 2. 🚨 Critical / Overdue Task Email
 */
export function renderCriticalOverdueEmail({
  user,
  task = {},
  daysOverdue = 1,
  hoursOverdue,
  isEscalation = false,
  escalationLevel = 'assignee', // 'assignee' | 'manager' | 'admin'
  responsibleEmployeeName,
  assignedByName,
  baseUrl = 'https://tasksetu.app',
  userTimezone = 'Asia/Kolkata'
}) {
  const firstName = escapeHtml(user?.firstName || 'there');
  const safeBaseUrl = baseUrl.replace(/\/+$/, '');
  const taskUrl = `${safeBaseUrl}/tasks/${task._id || task.id}`;
  const priority = (task.priority || 'medium').toLowerCase();
  const isCriticalPriority = ['critical', 'high', 'urgent'].includes(priority);
  const dayWord = daysOverdue === 1 ? 'day' : 'days';

  const rows = [
    { label: 'Assigned To', value: responsibleEmployeeName || (task.assignedTo?.firstName ? `${task.assignedTo.firstName} ${task.assignedTo.lastName || ''}`.trim() : null), icon: '👤' },
    { label: 'Assigned By', value: assignedByName || (task.createdBy?.firstName ? `${task.createdBy.firstName} ${task.createdBy.lastName || ''}`.trim() : null), icon: '👤' },
    { label: 'Due Date', value: formatDate(task.dueDate, userTimezone), icon: '📅' },
    { label: 'Time Overdue', value: `${daysOverdue} ${dayWord}${hoursOverdue ? ` (${hoursOverdue} hrs)` : ''}`, icon: '⏱️', isHighlighted: true },
    { label: 'Priority', value: priority.toUpperCase(), icon: '⚡' },
    { label: 'Current Status', value: (task.status || 'OPEN').toUpperCase(), icon: '📌' },
    { label: 'Project', value: task.project?.name || task.projectName, icon: '📁' },
    { label: 'Team', value: task.team?.name || task.teamName, icon: '👥' },
  ];

  const badges = [
    renderPriorityBadge(task.priority || 'critical'),
    renderBadge({ text: `${daysOverdue} ${dayWord.toUpperCase()} OVERDUE`, variant: 'critical' }),
    renderTaskTypeBadge(task.taskType || 'regular')
  ];

  let escalationNotice = '';
  if (isEscalation || escalationLevel === 'manager' || escalationLevel === 'admin') {
    const targetLabel = escalationLevel === 'admin' ? 'Organization Admin' : 'Manager';
    escalationNotice = renderCalloutBox({
      title: '🚨 Escalation Notice',
      message: `Because this task has been overdue for ${daysOverdue} days with <strong>${priority.toUpperCase()}</strong> priority, this alert has been escalated to the <strong>${targetLabel}</strong>.`,
      variant: 'critical',
      icon: '🔴'
    });
  }

  const alertMessage = `This task was due on <strong>${formatDate(task.dueDate, userTimezone) || 'an earlier date'}</strong> and has been overdue for <strong>${daysOverdue} ${dayWord}</strong>. Please review its progress and take the necessary action immediately.`;

  const contentHtml = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      Hi <strong>${firstName}</strong>,
    </p>

    ${renderCalloutBox({
      title: '⚠️ Action Required: Task Overdue',
      message: alertMessage,
      variant: 'critical'
    })}

    ${escalationNotice}

    ${renderDetailsCard({
      title: task.title || 'Untitled Overdue Task',
      badges,
      description: task.description,
      rows,
      accentColor: '#EF4444'
    })}

    <div style="text-align:center;margin-top:24px;">
      ${renderButton({
        text: 'Review Overdue Task',
        url: taskUrl,
        color: '#DC2626'
      })}
    </div>
  `;

  return wrapInBaseLayout({
    title: `Action Required: Task Overdue — ${task.title || 'Task'}`,
    previewText: `This task is ${daysOverdue} ${dayWord} overdue. Review and take immediate action.`,
    accentColor: BRAND_COLORS.critical,
    categoryBadgeText: isEscalation ? 'ESCALATION' : 'OVERDUE',
    categoryBadgeVariant: 'critical',
    heroIcon: '🚨',
    heroTitle: 'Critical Task Overdue',
    heroSubtitle: `${daysOverdue} ${dayWord} past due date &bull; ${priority.toUpperCase()} priority`,
    contentHtml,
    baseUrl: safeBaseUrl
  });
}

/**
 * 3. 📋 New Task Assigned Email
 */
export function renderTaskAssignmentEmail({
  user,
  task = {},
  assignedBy,
  baseUrl = 'https://tasksetu.app',
  userTimezone = 'Asia/Kolkata'
}) {
  const firstName = escapeHtml(user?.firstName || 'there');
  const safeBaseUrl = baseUrl.replace(/\/+$/, '');
  const taskUrl = `${safeBaseUrl}/tasks/${task._id || task.id}`;

  const assignerName = assignedBy
    ? `${assignedBy.firstName || ''} ${assignedBy.lastName || ''}`.trim() || 'Your Team Lead'
    : 'TaskSetu';

  const rows = [
    { label: 'Assigned By', value: assignerName, icon: '👤' },
    { label: 'Due Date', value: formatDate(task.dueDate, userTimezone) || 'No due date set', icon: '📅' },
    { label: 'Task Type', value: (task.taskType || 'regular').toUpperCase(), icon: '📋' },
    { label: 'Priority', value: (task.priority || 'medium').toUpperCase(), icon: '⚡' },
    { label: 'Status', value: (task.status || 'NEW').toUpperCase(), icon: '📌' },
    { label: 'Project', value: task.project?.name || task.projectName, icon: '📁' },
    { label: 'Team', value: task.team?.name || task.teamName, icon: '👥' },
  ];

  const badges = [
    renderTaskTypeBadge(task.taskType || 'regular'),
    renderPriorityBadge(task.priority || 'medium'),
    renderStatusBadge(task.status || 'NEW')
  ];

  const contentHtml = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      Hi <strong>${firstName}</strong>, you have been assigned a new task by <strong>${escapeHtml(assignerName)}</strong>.
    </p>

    ${renderDetailsCard({
      title: task.title || 'Untitled Task',
      badges,
      description: task.description,
      rows,
      accentColor: BRAND_COLORS.primary
    })}

    <div style="text-align:center;margin-top:24px;">
      ${renderButton({
        text: 'View Task',
        url: taskUrl,
        color: BRAND_COLORS.primary
      })}
    </div>
  `;

  return wrapInBaseLayout({
    title: `New Task Assigned: ${task.title || 'Task'}`,
    previewText: `${assignerName} assigned you a new task: "${task.title || ''}"`,
    accentColor: BRAND_COLORS.primary,
    categoryBadgeText: 'NEW TASK',
    categoryBadgeVariant: 'info',
    heroIcon: '📋',
    heroTitle: 'New Task Assigned',
    heroSubtitle: `From ${escapeHtml(assignerName)}`,
    contentHtml,
    baseUrl: safeBaseUrl
  });
}

/**
 * 4. ⚡ New Approval Task Assigned Email
 */
export function renderApprovalRequiredEmail({
  user,
  task = {},
  requestedBy,
  baseUrl = 'https://tasksetu.app',
  userTimezone = 'Asia/Kolkata'
}) {
  const firstName = escapeHtml(user?.firstName || 'there');
  const safeBaseUrl = baseUrl.replace(/\/+$/, '');
  const taskUrl = `${safeBaseUrl}/tasks/${task._id || task.id}`;

  const requesterName = requestedBy
    ? `${requestedBy.firstName || ''} ${requestedBy.lastName || ''}`.trim() || 'Team Member'
    : task.createdBy?.firstName
    ? `${task.createdBy.firstName} ${task.createdBy.lastName || ''}`.trim()
    : 'TaskSetu Requester';

  const deadline = task.autoApproveAfter || task.approvalDeadline || task.dueDate;

  const rows = [
    { label: 'Requested By', value: requesterName, icon: '👤' },
    { label: 'Submitted Date', value: formatDate(task.createdAt || new Date(), userTimezone), icon: '📅' },
    { label: 'Approval Deadline', value: formatDate(deadline, userTimezone) || 'No hard deadline set', icon: '⏱️', isHighlighted: !!deadline },
    { label: 'Priority', value: (task.priority || 'medium').toUpperCase(), icon: '⚡' },
    { label: 'Approval Status', value: 'Awaiting your decision', icon: '✍️', isHighlighted: true },
    { label: 'Project', value: task.project?.name || task.projectName, icon: '📁' },
  ];

  const badges = [
    renderBadge({ text: 'APPROVAL TASK', variant: 'warning' }),
    renderPriorityBadge(task.priority || 'medium'),
    renderBadge({ text: 'PENDING DECISION', variant: 'warning' })
  ];

  const contentHtml = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      Hi <strong>${firstName}</strong>, you have a new approval request that requires your attention.
    </p>

    ${renderCalloutBox({
      title: 'Action Required: Review & Decide',
      message: 'You can directly <strong>Approve</strong> or <strong>Reject</strong> this task using the buttons below, or view the full task in TaskSetu.',
      variant: 'warning'
    })}

    ${renderDetailsCard({
      title: task.title || 'Untitled Approval Request',
      badges,
      description: task.description,
      rows,
      accentColor: BRAND_COLORS.warning
    })}

    <p style="font-size:13px;color:#64748B;text-align:center;margin:16px 0 6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      Choose an action directly from your email:
    </p>

    ${renderApprovalActionButtons({
      approveUrl: `${taskUrl}?action=approve`,
      rejectUrl: `${taskUrl}?action=reject`,
      approveText: 'Approve',
      rejectText: 'Reject',
      secondaryUrl: taskUrl,
      secondaryText: 'View full task details in TaskSetu'
    })}
  `;

  return wrapInBaseLayout({
    title: `Approval Required: ${task.title || 'Request'}`,
    previewText: `Review the approval request assigned to you by ${requesterName}.`,
    accentColor: BRAND_COLORS.warning,
    categoryBadgeText: 'APPROVAL REQUIRED',
    categoryBadgeVariant: 'warning',
    heroIcon: '✍️',
    heroTitle: 'Approval Required',
    heroSubtitle: `Requested by ${escapeHtml(requesterName)}`,
    contentHtml,
    baseUrl: safeBaseUrl
  });
}

/**
 * 5A. 🔄 Task Change Approval Request Email (To Manager/Approver)
 */
export function renderTaskChangeRequestEmail({
  approver,
  requesterName = 'An employee',
  task = {},
  requestedChanges = {},
  reason = '',
  actionUrl,
  baseUrl = 'https://tasksetu.app'
}) {
  const approverName = escapeHtml(approver?.firstName || 'Manager');
  const safeBaseUrl = baseUrl.replace(/\/+$/, '');

  const contentHtml = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      Hello <strong>${approverName}</strong>,
    </p>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#475569;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <strong>${escapeHtml(requesterName)}</strong> has requested modifications to a protected task:
    </p>

    <!-- Task Box -->
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-left:4px solid #2563EB;border-radius:8px;margin-bottom:18px;">
      <tr>
        <td style="padding:14px 18px;">
          <div style="font-size:11px;font-weight:700;color:#2563EB;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Target Task</div>
          <div style="font-size:16px;font-weight:700;color:#0F172A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${escapeHtml(task.title || 'Task')}</div>
        </td>
      </tr>
    </table>

    <div style="margin:16px 0 8px;">
      <strong style="font-size:13px;color:#0F172A;text-transform:uppercase;letter-spacing:0.3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        Proposed Changes:
      </strong>
    </div>

    ${renderChangesDiffTable(requestedChanges)}

    ${renderCalloutBox({
      title: "Employee's Stated Reason",
      message: `<em>&ldquo;${escapeHtml(reason || 'No specific reason provided.')}&rdquo;</em>`,
      variant: 'info',
      icon: '💬'
    })}

    ${renderApprovalActionButtons({
      approveUrl: `${actionUrl}&action=approve`,
      rejectUrl: `${actionUrl}&action=reject`,
      approveText: 'Approve Changes',
      rejectText: 'Reject Changes',
      secondaryUrl: actionUrl,
      secondaryText: 'Review complete change history in TaskSetu'
    })}

    <p style="font-size:12px;color:#94A3B8;text-align:center;margin:16px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      ⏱️ This link is single-use and will expire in 24 hours. A valid reason is required to approve or reject.
    </p>
  `;

  return wrapInBaseLayout({
    title: `Task Change Approval Requested: ${task.title || 'Task'}`,
    previewText: `${requesterName} requested changes to "${task.title || ''}". Reason: ${reason || 'Review requested'}`,
    accentColor: BRAND_COLORS.primary,
    categoryBadgeText: 'CHANGE REQUEST',
    categoryBadgeVariant: 'info',
    heroIcon: '🔄',
    heroTitle: 'Task Change Approval Requested',
    heroSubtitle: `Modification request from ${escapeHtml(requesterName)}`,
    contentHtml,
    baseUrl: safeBaseUrl
  });
}

/**
 * 5B. 📣 Task Change Request Decision Email (To Requester Employee)
 */
export function renderTaskChangeDecisionEmail({
  employee,
  task = {},
  decision = 'APPROVED', // 'APPROVED' | 'REJECTED'
  approverName = 'Your Manager',
  approverReason = '',
  requestedChanges = {},
  baseUrl = 'https://tasksetu.app'
}) {
  const empName = escapeHtml(employee?.firstName || 'Team Member');
  const isApproved = String(decision).toUpperCase() === 'APPROVED';
  const safeBaseUrl = baseUrl.replace(/\/+$/, '');
  const taskUrl = `${safeBaseUrl}/tasks/${task._id || task.id}`;

  const accentColor = isApproved ? BRAND_COLORS.success : BRAND_COLORS.critical;
  const badgeVariant = isApproved ? 'success' : 'critical';

  const contentHtml = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      Hello <strong>${empName}</strong>,
    </p>

    ${renderCalloutBox({
      title: isApproved ? '✅ Changes Approved' : '❌ Changes Rejected',
      message: `Your requested changes to <strong>&ldquo;${escapeHtml(task.title || 'Task')}&rdquo;</strong> have been <strong>${decision.toLowerCase()}</strong> by <strong>${escapeHtml(approverName)}</strong>.`,
      variant: isApproved ? 'success' : 'critical'
    })}

    ${approverReason ? renderCalloutBox({
      title: 'Approver Feedback',
      message: `<em>&ldquo;${escapeHtml(approverReason)}&rdquo;</em>`,
      variant: 'neutral',
      icon: '💬'
    }) : ''}

    <div style="margin:16px 0 8px;">
      <strong style="font-size:13px;color:#0F172A;text-transform:uppercase;letter-spacing:0.3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        Summary of Requested Changes:
      </strong>
    </div>

    ${renderChangesDiffTable(requestedChanges)}

    <div style="text-align:center;margin-top:24px;">
      ${renderButton({
        text: 'View Updated Task',
        url: taskUrl,
        color: isApproved ? '#059669' : BRAND_COLORS.primary
      })}
    </div>
  `;

  return wrapInBaseLayout({
    title: `Task Change Request ${decision}: ${task.title || 'Task'}`,
    previewText: `Your task change request for "${task.title || ''}" was ${decision.toLowerCase()} by ${approverName}.`,
    accentColor,
    categoryBadgeText: `CHANGE ${decision.toUpperCase()}`,
    categoryBadgeVariant: badgeVariant,
    heroIcon: isApproved ? '✅' : '❌',
    heroTitle: `Task Change Request ${decision}`,
    heroSubtitle: `Decision by ${escapeHtml(approverName)}`,
    contentHtml,
    baseUrl: safeBaseUrl
  });
}

/**
 * 6. 📅 Tasks Due Today Grouped Email
 */
export function renderTasksDueTodayEmail({
  user,
  tasks = [],
  todayDate,
  baseUrl = 'https://tasksetu.app',
  userTimezone = 'Asia/Kolkata'
}) {
  const firstName = escapeHtml(user?.firstName || 'there');
  const safeBaseUrl = baseUrl.replace(/\/+$/, '');
  const count = tasks.length;
  const countWord = count === 1 ? 'task' : 'tasks';

  const dateStr = todayDate || new Intl.DateTimeFormat('en-US', {
    timeZone: userTimezone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date());

  const contentHtml = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      Hi <strong>${firstName}</strong>, you have <strong>${count} ${countWord} due today</strong> (${dateStr}).
    </p>

    <div style="margin:20px 0;">
      ${tasks.map(t => {
        const taskUrl = `${safeBaseUrl}/tasks/${t._id || t.id}`;
        const badgeHtml = renderPriorityBadge(t.priority);
        return renderDigestItem({
          title: t.title,
          badgeHtml,
          metaText: t.taskType ? `Type: ${t.taskType.toUpperCase()}` : null,
          url: taskUrl
        });
      }).join('')}
    </div>

    <div style="text-align:center;margin-top:24px;">
      ${renderButton({
        text: 'View Your Tasks',
        url: `${safeBaseUrl}/tasks`,
        color: BRAND_COLORS.warning
      })}
    </div>
  `;

  return wrapInBaseLayout({
    title: `📅 ${count} ${countWord} Due Today — ${dateStr}`,
    previewText: `You have ${count} ${countWord} due today on TaskSetu.`,
    accentColor: BRAND_COLORS.warning,
    categoryBadgeText: 'DUE TODAY',
    categoryBadgeVariant: 'warning',
    heroIcon: '📅',
    heroTitle: `${count} ${countWord} Due Today`,
    heroSubtitle: dateStr,
    contentHtml,
    baseUrl: safeBaseUrl
  });
}

/**
 * 7. 📬 Generic Notification / Event Email (for NotificationService)
 */
export function renderGenericNotificationEmail({
  notification,
  user,
  role = 'user',
  baseUrl = 'https://tasksetu.app',
  userTimezone = 'Asia/Kolkata'
}) {
  const firstName = escapeHtml(user?.firstName || 'User');
  const safeBaseUrl = baseUrl.replace(/\/+$/, '');
  const isUrgent = notification.priority === 'urgent';
  const roleLabel = role ? role.replace(/_/g, ' ').toUpperCase() : null;

  // Determine specific event branding & CTA
  let heroIcon = '📬';
  let categoryBadgeText = 'NOTIFICATION';
  let categoryBadgeVariant = isUrgent ? 'critical' : 'info';
  let accentColor = isUrgent ? BRAND_COLORS.critical : BRAND_COLORS.primary;
  let ctaText = 'View in TaskSetu';
  let ctaUrl = `${safeBaseUrl}/tasks`;

  const event = notification.trigger_event || '';

  if (event.includes('overdue')) {
    heroIcon = '🚨';
    categoryBadgeText = 'OVERDUE';
    categoryBadgeVariant = 'critical';
    accentColor = BRAND_COLORS.critical;
    ctaText = 'Review Overdue Task';
  } else if (event.includes('approval_approved')) {
    heroIcon = '✅';
    categoryBadgeText = 'APPROVED';
    categoryBadgeVariant = 'success';
    accentColor = BRAND_COLORS.success;
    ctaText = 'View Details';
  } else if (event.includes('approval_denied') || event.includes('approval_rejected')) {
    heroIcon = '❌';
    categoryBadgeText = 'DENIED';
    categoryBadgeVariant = 'critical';
    accentColor = BRAND_COLORS.critical;
    ctaText = 'Review Request';
  } else if (event.includes('approval')) {
    heroIcon = '✍️';
    categoryBadgeText = 'APPROVAL';
    categoryBadgeVariant = 'warning';
    accentColor = BRAND_COLORS.warning;
    ctaText = 'Review Approval';
  } else if (event.includes('completed')) {
    heroIcon = '🎉';
    categoryBadgeText = 'COMPLETED';
    categoryBadgeVariant = 'success';
    accentColor = BRAND_COLORS.success;
    ctaText = 'View Completed Task';
  } else if (event.includes('comment')) {
    heroIcon = '💬';
    categoryBadgeText = 'COMMENT';
    categoryBadgeVariant = 'info';
    ctaText = 'View Conversation';
  } else if (event.includes('mention')) {
    heroIcon = '👋';
    categoryBadgeText = 'MENTION';
    categoryBadgeVariant = 'info';
    ctaText = 'View Mention';
  } else if (event.includes('updated')) {
    heroIcon = '✏️';
    categoryBadgeText = 'TASK UPDATED';
    categoryBadgeVariant = 'info';
    ctaText = 'View Updated Task';
  }

  // Construct CTA URL if entity ID exists
  if (notification.related_entity?.entity_id) {
    ctaUrl = `${safeBaseUrl}/tasks/${notification.related_entity.entity_id}`;
  }

  // Build metadata rows if available
  const metaRows = [];
  if (notification.metadata && typeof notification.metadata === 'object') {
    for (const [key, val] of Object.entries(notification.metadata)) {
      if (['suppressed', 'auto_digest', 'user_id', 'reminder_phase'].includes(key)) continue;
      if (val !== null && val !== undefined && typeof val !== 'object') {
        const prettyKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        metaRows.push({ label: prettyKey, value: String(val) });
      }
    }
  }

  const contentHtml = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      Hi <strong>${firstName}</strong>,
    </p>

    ${roleLabel ? `
    <div style="margin-bottom:14px;">
      <span style="font-size:12px;color:#64748B;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        You are receiving this notification as: <strong>${escapeHtml(roleLabel)}</strong>
      </span>
    </div>
    ` : ''}

    <!-- Notification Message Card -->
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-left:4px solid ${accentColor};border-radius:8px;margin:16px 0;">
      <tr>
        <td style="padding:18px 20px;">
          <h2 style="margin:0 0 8px;font-size:16px;font-weight:700;color:#0F172A;line-height:1.4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            ${escapeHtml(notification.title)}
          </h2>
          <div style="font-size:14px;line-height:1.6;color:#334155;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            ${escapeHtml(notification.message).replace(/\n/g, '<br/>')}
          </div>
        </td>
      </tr>
    </table>

    ${metaRows.length > 0 ? `
    <div style="margin:20px 0;background-color:#FFFFFF;border:1px solid #E2E8F0;border-radius:8px;padding:14px 18px;">
      <div style="font-size:12px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Details</div>
      <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
        ${metaRows.map(r => `
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#64748B;width:40%;">${escapeHtml(r.label)}:</td>
            <td style="padding:4px 0;font-size:13px;color:#0F172A;font-weight:600;width:60%;">${escapeHtml(r.value)}</td>
          </tr>
        `).join('')}
      </table>
    </div>
    ` : ''}

    ${event.includes('approval') && !event.includes('approval_approved') && !event.includes('approval_denied') ? `
    <div style="margin-top:24px;">
      ${renderApprovalActionButtons({
        approveUrl: `${ctaUrl}?action=approve`,
        rejectUrl: `${ctaUrl}?action=reject`,
        approveText: 'Approve',
        rejectText: 'Reject',
        secondaryUrl: ctaUrl,
        secondaryText: 'View full details in TaskSetu'
      })}
    </div>
    ` : `
    <div style="text-align:center;margin-top:24px;">
      ${renderButton({
        text: ctaText,
        url: ctaUrl,
        color: accentColor
      })}
    </div>
    `}
  `;

  return wrapInBaseLayout({
    title: notification.title,
    previewText: notification.message?.slice(0, 120),
    accentColor,
    categoryBadgeText,
    categoryBadgeVariant,
    heroIcon,
    heroTitle: notification.title,
    heroSubtitle: `Sent via TaskSetu &bull; ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    contentHtml,
    baseUrl: safeBaseUrl
  });
}

/**
 * 8. 📋 Grouped Notification Digest (Daily / Weekly queue in cronJobService)
 */
export function renderNotificationDigestEmail({
  user,
  items = [],
  frequency = 'daily',
  userTimezone = 'Asia/Kolkata',
  baseUrl = 'https://tasksetu.app'
}) {
  const userName = escapeHtml(user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'there');
  const frequencyLabel = frequency === 'daily' ? 'Daily' : 'Weekly';
  const safeBaseUrl = baseUrl.replace(/\/+$/, '');

  const dateStr = new Intl.DateTimeFormat('en-US', {
    timeZone: userTimezone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date());

  // Group items by trigger event
  const grouped = {};
  for (const item of items) {
    const type = item.trigger_event || 'other';
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(item);
  }

  const eventLabels = {
    task_created: '📝 Tasks Created',
    task_updated: '✏️ Tasks Updated',
    task_overdue: '🚨 Tasks Overdue',
    task_completed: '✅ Tasks Completed',
    task_reassigned: '🔄 Tasks Reassigned',
    task_reminder: '⏰ Task Reminders',
    task_due_today: '📅 Due Today',
    task_due_soon: '⏳ Due Soon',
    comment_added: '💬 New Comments',
    user_mentioned: '👋 Mentions',
    approval_requested: '📋 Approvals Requested',
    approval_approved: '✅ Approvals Granted',
    approval_denied: '❌ Approvals Denied',
  };

  let groupedHtml = '';
  for (const [eventType, eventItems] of Object.entries(grouped)) {
    const label = eventLabels[eventType] || eventType.replace(/_/g, ' ').toUpperCase();
    groupedHtml += `
      <div style="margin:20px 0 12px;">
        <div style="font-size:13px;font-weight:700;color:#0F172A;padding-bottom:6px;border-bottom:1px solid #E2E8F0;margin-bottom:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          ${escapeHtml(label)} (${eventItems.length})
        </div>
        ${eventItems.map(item => `
          <div style="padding:8px 12px;background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;margin-bottom:6px;">
            <div style="font-size:13px;font-weight:600;color:#0F172A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              ${escapeHtml(item.title)}
              ${item.priority === 'urgent' ? '&nbsp;' + renderBadge({ text: 'URGENT', variant: 'critical' }) : ''}
            </div>
            ${item.message ? `<div style="font-size:12px;color:#64748B;margin-top:2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${escapeHtml(item.message)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  const contentHtml = `
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      Hi <strong>${userName}</strong>,
    </p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#64748B;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      Here is your <strong>${frequencyLabel.toLowerCase()}</strong> digest of <strong>${items.length} notification${items.length !== 1 ? 's' : ''}</strong> from TaskSetu.
    </p>

    ${groupedHtml}

    <div style="text-align:center;margin-top:26px;">
      ${renderButton({
        text: 'Open TaskSetu',
        url: `${safeBaseUrl}/tasks`,
        color: BRAND_COLORS.primary
      })}
    </div>
  `;

  return wrapInBaseLayout({
    title: `📋 Your ${frequencyLabel} Notification Digest — ${dateStr}`,
    previewText: `Your ${frequency} summary with ${items.length} notification(s).`,
    accentColor: BRAND_COLORS.primary,
    categoryBadgeText: `${frequencyLabel.toUpperCase()} DIGEST`,
    categoryBadgeVariant: 'info',
    heroIcon: '📋',
    heroTitle: `${frequencyLabel} Notification Digest`,
    heroSubtitle: `${dateStr} &bull; ${items.length} notification(s)`,
    contentHtml,
    baseUrl: safeBaseUrl
  });
}

/**
 * 9. ⛔ Final Missed Task Alert Email
 */
export function renderMissedTaskEmail({
  user,
  task = {},
  daysOverdue = 1,
  hoursOverdue = 24,
  baseUrl = 'https://tasksetu.app',
  userTimezone = 'Asia/Kolkata'
}) {
  const firstName = escapeHtml(user?.firstName || 'there');
  const safeBaseUrl = baseUrl.replace(/\/+$/, '');
  const taskUrl = `${safeBaseUrl}/tasks/${task._id || task.id}`;
  const priority = (task.priority || 'medium').toLowerCase();
  const isCriticalHigh = ['critical', 'high', 'urgent'].includes(priority);
  const dayWord = daysOverdue === 1 ? 'day' : 'days';

  const rows = [
    { label: 'Was Due On', value: formatDate(task.dueDate, userTimezone) || 'Past Due Date', icon: '📅' },
    { label: 'Missed By', value: `${hoursOverdue} hours (${daysOverdue} ${dayWord})`, icon: '⏱️', isHighlighted: true },
    { label: 'Priority', value: priority.toUpperCase(), icon: '⚡' },
    { label: 'Task Type', value: (task.taskType || 'regular').toUpperCase(), icon: '📋' }
  ];

  const badges = [
    renderBadge({ text: 'TASK MISSED', variant: 'critical' }),
    renderPriorityBadge(priority)
  ];

  const contentHtml = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      Hi <strong>${firstName}</strong>, this is your final reminder &mdash; your task has been marked as <strong>MISSED</strong> because it was not completed within the expected time frame.
    </p>

    ${renderCalloutBox({
      title: '⛔ Final Notice: Task Missed',
      message: `This deadline was missed by <strong>${hoursOverdue} hours (${daysOverdue} ${dayWord})</strong>. Please complete or reschedule this task immediately.`,
      variant: 'critical',
      icon: '⛔'
    })}

    ${isCriticalHigh ? renderCalloutBox({
      title: '🔴 Manager Escalation Alert',
      message: `Because this is a <strong>${priority.toUpperCase()}</strong> priority task, your manager has been automatically informed about this missed deadline.`,
      variant: 'critical',
      icon: '👤'
    }) : ''}

    ${renderDetailsCard({
      title: task.title || 'Untitled Task',
      badges,
      description: task.description,
      rows,
      accentColor: '#DC2626'
    })}

    <div style="text-align:center;margin-top:24px;">
      ${renderButton({
        text: 'Complete Task Now',
        url: taskUrl,
        color: '#B91C1C'
      })}
    </div>
  `;

  return wrapInBaseLayout({
    title: `⛔ MISSED: "${task.title || 'Task'}" — ${daysOverdue} ${dayWord} overdue`,
    previewText: `Final notice: you missed your ${priority} task "${task.title || ''}".`,
    accentColor: '#DC2626',
    categoryBadgeText: 'TASK MISSED',
    categoryBadgeVariant: 'critical',
    heroIcon: '⛔',
    heroTitle: 'You Missed Your Task',
    heroSubtitle: `${hoursOverdue} hours overdue &bull; ${daysOverdue} ${dayWord} past deadline`,
    contentHtml,
    baseUrl: safeBaseUrl
  });
}

/**
 * 10. ⏳ License Expiry Reminder Email
 */
export function renderLicenseExpiryEmail({
  user,
  licenseInfo = {},
  daysRemaining = 7,
  baseUrl = 'https://tasksetu.app',
  userTimezone = 'Asia/Kolkata'
}) {
  const firstName = escapeHtml(user?.firstName || 'there');
  const safeBaseUrl = baseUrl.replace(/\/+$/, '');
  const renewUrl = `${safeBaseUrl}/billing`;
  const expiryDate = formatDate(licenseInfo.expiryDate, userTimezone) || 'Soon';
  const licenseCode = (licenseInfo.licenseCode || 'Your Plan').toUpperCase();

  const isUrgent = daysRemaining <= 3;
  const accentColor = daysRemaining <= 1 ? BRAND_COLORS.critical : daysRemaining <= 3 ? '#DC2626' : BRAND_COLORS.warning;
  const badgeVariant = daysRemaining <= 3 ? 'critical' : 'warning';

  const rows = [
    { label: 'License Plan', value: `${licenseCode} PLAN`, icon: '💎' },
    { label: 'Expiry Date', value: expiryDate, icon: '📅' },
    { label: 'Days Remaining', value: `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`, icon: '⏳', isHighlighted: true },
    { label: 'Organization', value: licenseInfo.organizationName, icon: '🏢' },
  ];

  const contentHtml = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      Hi <strong>${firstName}</strong>, your TaskSetu license will expire in <strong>${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}</strong> (${expiryDate}).
    </p>

    ${renderCalloutBox({
      title: isUrgent ? '🚨 Immediate Action Required' : '⏰ Plan Your Renewal',
      message: daysRemaining <= 1
        ? 'Your license expires TOMORROW. Renew immediately to prevent feature restriction and service interruption.'
        : `Your ${licenseCode} plan expires on ${expiryDate}. Renew in advance to keep your team collaborating without disruption.`,
      variant: isUrgent ? 'critical' : 'warning'
    })}

    ${renderDetailsCard({
      title: `${licenseCode} Subscription Details`,
      badges: [renderBadge({ text: `${daysRemaining} DAYS REMAINING`, variant: badgeVariant })],
      rows,
      accentColor
    })}

    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:16px 20px;margin:18px 0;">
      <tr>
        <td>
          <div style="font-size:13px;font-weight:700;color:#0F172A;margin-bottom:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            What happens when your license expires:
          </div>
          <ul style="margin:0;padding-left:18px;font-size:12px;color:#64748B;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            <li>Account is transitioned to standard explore features</li>
            <li>Advanced notification channels and limits become restricted</li>
            <li>All your existing data remains safely preserved</li>
            <li>Instant restoration upon renewing</li>
          </ul>
        </td>
      </tr>
    </table>

    <div style="text-align:center;margin-top:24px;">
      ${renderButton({
        text: 'Renew My License',
        url: renewUrl,
        color: accentColor
      })}
    </div>
  `;

  return wrapInBaseLayout({
    title: `⏰ License Expires in ${daysRemaining} Days — TaskSetu`,
    previewText: `Your ${licenseCode} license expires on ${expiryDate}. Renew now to prevent interruption.`,
    accentColor,
    categoryBadgeText: isUrgent ? 'LICENSE EXPIRING' : 'RENEWAL REMINDER',
    categoryBadgeVariant: badgeVariant,
    heroIcon: isUrgent ? '🚨' : '⏰',
    heroTitle: `License Expires in ${daysRemaining} Days`,
    heroSubtitle: `Expires on ${expiryDate} &bull; ${licenseCode} Plan`,
    contentHtml,
    baseUrl: safeBaseUrl
  });
}
