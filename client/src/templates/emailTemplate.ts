import { INotification, NotificationPriority, TriggerEvent } from '../models';

/**
 * Email template data interface
 */
export interface EmailTemplateData {
  title: string;
  message: string;
  user: {
    name: string;
    email: string;
  };
  notification: INotification;
  actionUrl?: string;
  unsubscribeUrl: string;
  appName: string;
  appUrl: string;
}

/**
 * Get notification icon based on trigger event
 */
export function getNotificationIcon(triggerEvent: TriggerEvent): string {
  const iconMap: Record<TriggerEvent, string> = {
    [TriggerEvent.TASK_CREATED]: '📋',
    [TriggerEvent.TASK_UPDATED]: '✏️',
    [TriggerEvent.TASK_OVERDUE]: '⚠️',
    [TriggerEvent.TASK_COMPLETED]: '✅',
    [TriggerEvent.TASK_REASSIGNED]: '🔄',
    [TriggerEvent.SUBTASK_ADDED]: '➕',
    [TriggerEvent.SUBTASK_COMPLETED]: '✔️',
    [TriggerEvent.RECURRING_INSTANCE_CREATED]: '<RecurringTaskIcon size={size} className="flex-shrink-0" />',
    [TriggerEvent.QUICK_TASK_COMPLETED]: '⚡',
    [TriggerEvent.QUICK_TASK_CONVERTED]: '🔄',
    [TriggerEvent.APPROVAL_REQUESTED]: '👤',
    [TriggerEvent.APPROVAL_APPROVED]: '✅',
    [TriggerEvent.APPROVAL_DENIED]: '❌',
    [TriggerEvent.TASK_REMINDER]: '⏰',
    [TriggerEvent.TASK_DUE_TODAY]: '📅',
    [TriggerEvent.TASK_DUE_SOON]: '⏳',
    [TriggerEvent.USER_MENTIONED]: '💬',
    [TriggerEvent.COMMENT_ADDED]: '💭',
    [TriggerEvent.FILE_UPLOADED]: '📎',
    [TriggerEvent.FILE_EDITED]: '📝',
    [TriggerEvent.MILESTONE_ACHIEVED]: '🎯',
    [TriggerEvent.MILESTONE_MISSED]: '🚨',
    [TriggerEvent.OVERDUE_ESCALATION]: '🔺',
    [TriggerEvent.CRITICAL_ESCALATION]: '🚨',
    [TriggerEvent.SYSTEM_TEST]: '🧪'
  };

  return iconMap[triggerEvent] || '📢';
}

/**
 * Get priority badge styling
 */
export function getPriorityBadge(priority: NotificationPriority): { text: string; color: string; background: string } {
  switch (priority) {
    case NotificationPriority.URGENT:
      return { text: 'URGENT', color: '#ffffff', background: '#dc3545' };
    case NotificationPriority.NORMAL:
    default:
      return { text: 'Normal', color: '#ffffff', background: '#6c757d' };
  }
}

/**
 * Generate HTML email template
 */
export function generateEmailTemplate(data: EmailTemplateData): string {
  const icon = getNotificationIcon(data.notification.trigger_event);
  const priorityBadge = getPriorityBadge(data.notification.priority);
  const timestamp = new Date(data.notification.created_at).toLocaleString();
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .container {
            background: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e9ecef;
        }
        .notification-icon {
            font-size: 48px;
            margin-bottom: 10px;
            display: block;
        }
        .app-name {
            color: #6c757d;
            font-size: 14px;
            margin: 0;
        }
        .priority-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 20px;
            color: ${priorityBadge.color};
            background-color: ${priorityBadge.background};
        }
        .title {
            color: #212529;
            font-size: 24px;
            font-weight: 600;
            margin: 0 0 20px 0;
            line-height: 1.3;
        }
        .message {
            color: #495057;
            font-size: 16px;
            margin: 0 0 30px 0;
            line-height: 1.5;
        }
        .action-button {
            display: inline-block;
            background-color: #007bff;
            color: white;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: 500;
            margin: 20px 0;
            text-align: center;
        }
        .action-button:hover {
            background-color: #0056b3;
        }
        .metadata {
            background-color: #f8f9fa;
            border-left: 4px solid #007bff;
            padding: 15px;
            margin: 20px 0;
            border-radius: 0 4px 4px 0;
        }
        .metadata-item {
            margin: 5px 0;
            font-size: 14px;
        }
        .metadata-label {
            font-weight: 600;
            color: #495057;
        }
        .metadata-value {
            color: #6c757d;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            text-align: center;
            color: #6c757d;
            font-size: 12px;
        }
        .footer a {
            color: #007bff;
            text-decoration: none;
        }
        .footer a:hover {
            text-decoration: underline;
        }
        .timestamp {
            color: #6c757d;
            font-size: 14px;
            margin-top: 20px;
        }
        @media only screen and (max-width: 600px) {
            body {
                padding: 10px;
            }
            .container {
                padding: 20px;
            }
            .title {
                font-size: 20px;
            }
            .message {
                font-size: 14px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <span class="notification-icon">${icon}</span>
            <p class="app-name">${data.appName}</p>
        </div>

        <div class="priority-badge">${priorityBadge.text}</div>

        <h1 class="title">${data.title}</h1>
        
        <p class="message">${data.message}</p>

        ${data.actionUrl ? `
        <div style="text-align: center;">
            <a href="${data.actionUrl}" class="action-button">View in App</a>
        </div>
        ` : ''}

        ${data.notification.metadata && Object.keys(data.notification.metadata).length > 0 ? `
        <div class="metadata">
            <div class="metadata-item">
                <span class="metadata-label">Additional Information:</span>
            </div>
            ${Object.entries(data.notification.metadata).map(([key, value]) => `
            <div class="metadata-item">
                <span class="metadata-label">${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</span>
                <span class="metadata-value">${value}</span>
            </div>
            `).join('')}
        </div>
        ` : ''}

        <p class="timestamp">
            <strong>Time:</strong> ${timestamp}
        </p>

        <div class="footer">
            <p>
                This notification was sent to ${data.user.email}<br>
                <a href="${data.unsubscribeUrl}">Manage notification preferences</a> | 
                <a href="${data.appUrl}">Open ${data.appName}</a>
            </p>
            <p>
                If you're having trouble with the "View in App" button, copy and paste this URL into your browser:<br>
                <span style="word-break: break-all; color: #6c757d;">${data.actionUrl || data.appUrl}</span>
            </p>
        </div>
    </div>

    <!-- Tracking pixel for open tracking (optional) -->
    <img src="${data.appUrl}/api/notifications/tracking/${data.notification._id}/open" 
         alt="" width="1" height="1" style="display: none;">
</body>
</html>
  `.trim();
}

/**
 * Generate plain text version of email (fallback)
 */
export function generateTextTemplate(data: EmailTemplateData): string {
  const icon = getNotificationIcon(data.notification.trigger_event);
  const priorityBadge = getPriorityBadge(data.notification.priority);
  const timestamp = new Date(data.notification.created_at).toLocaleString();
  
  return `
${icon} ${data.appName} - ${priorityBadge.text}

${data.title}

${data.message}

${data.actionUrl ? `View in app: ${data.actionUrl}` : ''}

${data.notification.metadata && Object.keys(data.notification.metadata).length > 0 ? 
  '\nAdditional Information:\n' + 
  Object.entries(data.notification.metadata)
    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`)
    .join('\n') + '\n'
  : ''}

Time: ${timestamp}

---
This notification was sent to ${data.user.email}
Manage preferences: ${data.unsubscribeUrl}
Open ${data.appName}: ${data.appUrl}
  `.trim();
}

export default generateEmailTemplate;