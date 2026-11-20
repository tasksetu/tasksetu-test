// Brand & semantic color tokens
export const BRAND_COLORS = {
  // Primary brand
  primary: '#2563EB',       // Blue-600
  primaryDark: '#1D4ED8',   // Blue-700
  primaryLight: '#EFF6FF',  // Blue-50
  primaryBorder: '#BFDBFE', // Blue-200

  // Semantic
  success: '#10B981',       // Emerald-500
  successDark: '#047857',   // Emerald-700
  successLight: '#ECFDF5',  // Emerald-50
  successBorder: '#A7F3D0', // Emerald-200

  warning: '#F59E0B',       // Amber-500
  warningDark: '#B45309',   // Amber-700
  warningLight: '#FFFBEB',  // Amber-50
  warningBorder: '#FDE68A', // Amber-200

  critical: '#EF4444',      // Red-500
  criticalDark: '#B91C1C',  // Red-700
  criticalLight: '#FEF2F2', // Red-50
  criticalBorder: '#FECACA',// Red-200

  purple: '#8B5CF6',        // Violet-500
  purpleLight: '#F5F3FF',   // Violet-50
  purpleBorder: '#DDD6FE',  // Violet-200

  // Neutrals
  bg: '#F8FAFC',            // Slate-50 background
  cardBg: '#FFFFFF',        // Pure white card
  cardBorder: '#E2E8F0',    // Slate-200
  divider: '#F1F5F9',       // Slate-100

  // Typography
  textPrimary: '#0F172A',   // Slate-900 (Dark Slate)
  textBody: '#334155',      // Slate-700
  textMuted: '#64748B',     // Slate-500
  textLight: '#94A3B8',     // Slate-400
};

// Badges mapping
export const BADGE_VARIANTS = {
  critical: { bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' },
  high: { bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' },
  urgent: { bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' },
  medium: { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
  warning: { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
  low: { bg: '#DCFCE7', text: '#15803D', border: '#BBF7D0' },
  success: { bg: '#DCFCE7', text: '#15803D', border: '#BBF7D0' },
  info: { bg: '#DBEAFE', text: '#1D4ED8', border: '#BFDBFE' },
  primary: { bg: '#DBEAFE', text: '#1D4ED8', border: '#BFDBFE' },
  neutral: { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' },
  purple: { bg: '#F3E8FF', text: '#7E22CE', border: '#E9D5FF' },
};

/**
 * Escape HTML to prevent broken formatting or injections
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Format date nicely with optional time
 */
export function formatDate(dateVal, timezone = 'Asia/Kolkata', includeTime = false) {
  if (!dateVal) return null;
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return null;

    const options = {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...(includeTime ? { hour: '2-digit', minute: '2-digit', hour12: true } : {})
    };

    return new Intl.DateTimeFormat('en-US', options).format(d);
  } catch (e) {
    return String(dateVal);
  }
}

/**
 * Render standard pill badge
 */
export function renderBadge({ text, variant = 'neutral', customBg, customText }) {
  if (!text) return '';
  const v = BADGE_VARIANTS[variant?.toLowerCase()] || BADGE_VARIANTS.neutral;
  const bg = customBg || v.bg;
  const color = customText || v.text;
  const border = v.border ? `border: 1px solid ${v.border};` : '';

  return `<span style="display:inline-block;padding:3px 9px;border-radius:12px;background-color:${bg};color:${color};font-size:11px;font-weight:700;letter-spacing:0.3px;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;${border}white-space:nowrap;">${escapeHtml(text)}</span>`;
}

/**
 * Priority badge helper
 */
export function renderPriorityBadge(priority = 'medium') {
  const p = (priority || 'medium').toLowerCase();
  const label = p.toUpperCase();
  const variant = ['critical', 'high', 'urgent'].includes(p)
    ? 'critical'
    : p === 'medium'
    ? 'warning'
    : 'low';

  return renderBadge({ text: label, variant });
}

/**
 * Task type badge helper
 */
export function renderTaskTypeBadge(type = 'regular') {
  const t = (type || 'regular').toLowerCase();
  const map = {
    milestone: { label: 'Milestone', variant: 'purple' },
    approval: { label: 'Approval', variant: 'warning' },
    recurring: { label: 'Recurring', variant: 'info' },
    subtask: { label: 'Subtask', variant: 'neutral' },
    regular: { label: 'Task', variant: 'info' },
    email: { label: 'Email Task', variant: 'info' }
  };
  const cfg = map[t] || { label: t.toUpperCase(), variant: 'neutral' };
  return renderBadge({ text: cfg.label, variant: cfg.variant });
}

/**
 * Status badge helper
 */
export function renderStatusBadge(status = 'OPEN') {
  const s = String(status || 'OPEN').toUpperCase();
  let variant = 'neutral';
  if (['DONE', 'COMPLETED', 'APPROVED'].includes(s)) variant = 'success';
  else if (['IN_PROGRESS', 'OPEN', 'PENDING'].includes(s)) variant = 'info';
  else if (['OVERDUE', 'REJECTED', 'CANCELLED'].includes(s)) variant = 'critical';
  else if (['REVIEW', 'AWAITING'].includes(s)) variant = 'warning';

  return renderBadge({ text: s.replace(/_/g, ' '), variant });
}

/**
 * Render bulletproof CTA button
 */
export function renderButton({ text, url, color = BRAND_COLORS.primary, align = 'center', fullWidth = false }) {
  if (!text || !url) return '';
  const escapedUrl = escapeHtml(url);
  const escapedText = escapeHtml(text);
  const widthStyle = fullWidth ? 'width:100%;' : '';

  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:24px 0 16px;${widthStyle}">
      <tr>
        <td align="${align}">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapedUrl}" style="height:44px;v-text-anchor:middle;${fullWidth ? 'width:500px;' : 'width:220px;'}" arcsize="18%" stroke="f" fillcolor="${color}">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;">${escapedText}</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a href="${escapedUrl}" target="_blank" style="display:inline-block;background-color:${color};color:#FFFFFF !important;text-decoration:none !important;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;letter-spacing:0.2px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;box-shadow:0 2px 4px rgba(0,0,0,0.08);${widthStyle}">
            ${escapedText} &rarr;
          </a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>
  `;
}

/**
 * Render side-by-side Approve and Reject action buttons for approval templates
 */
export function renderApprovalActionButtons({
  approveUrl,
  rejectUrl,
  approveText = 'Approve',
  rejectText = 'Reject',
  secondaryUrl,
  secondaryText = 'View full details in TaskSetu'
}) {
  const safeApproveUrl = escapeHtml(approveUrl);
  const safeRejectUrl = escapeHtml(rejectUrl);
  const safeApproveText = escapeHtml(approveText);
  const safeRejectText = escapeHtml(rejectText);

  return `
    <div style="text-align:center;margin:28px 0 16px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr>
          <!-- Approve Button (Green) -->
          <td align="center" style="padding:0 8px 8px 0;">
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeApproveUrl}" style="height:44px;v-text-anchor:middle;width:150px;" arcsize="18%" stroke="f" fillcolor="#059669">
              <w:anchorlock/>
              <center style="color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;font-weight:700;">&#10003; ${safeApproveText}</center>
            </v:roundrect>
            <![endif]-->
            <!--[if !mso]><!-->
            <a href="${safeApproveUrl}" target="_blank" style="display:inline-block;background-color:#059669;color:#FFFFFF !important;text-decoration:none !important;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;letter-spacing:0.3px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;box-shadow:0 2px 4px rgba(5,150,105,0.25);">
              &#10003; ${safeApproveText}
            </a>
            <!--<![endif]-->
          </td>

          <!-- Reject Button (Red) -->
          <td align="center" style="padding:0 0 8px 8px;">
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeRejectUrl}" style="height:44px;v-text-anchor:middle;width:150px;" arcsize="18%" stroke="f" fillcolor="#DC2626">
              <w:anchorlock/>
              <center style="color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;font-weight:700;">&#10005; ${safeRejectText}</center>
            </v:roundrect>
            <![endif]-->
            <!--[if !mso]><!-->
            <a href="${safeRejectUrl}" target="_blank" style="display:inline-block;background-color:#DC2626;color:#FFFFFF !important;text-decoration:none !important;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;letter-spacing:0.3px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;box-shadow:0 2px 4px rgba(220,38,38,0.25);">
              &#10005; ${safeRejectText}
            </a>
            <!--<![endif]-->
          </td>
        </tr>
      </table>

      ${secondaryUrl ? `
      <div style="margin-top:14px;">
        <a href="${escapeHtml(secondaryUrl)}" target="_blank" style="font-size:12px;color:#64748B;text-decoration:none;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          ${escapeHtml(secondaryText)} &rarr;
        </a>
      </div>
      ` : ''}
    </div>
  `;
}

/**
 * Render a single metadata row (only if value exists)
 */
export function renderMetadataRow({ label, value, icon, isHighlighted = false, isStrikeThrough = false }) {
  if (value === null || value === undefined || value === '') return '';
  const escapedLabel = escapeHtml(label);
  const escapedValue = escapeHtml(value);
  const valueStyle = isHighlighted
    ? 'color:#0F172A;font-weight:700;'
    : isStrikeThrough
    ? 'color:#94A3B8;text-decoration:line-through;'
    : 'color:#334155;font-weight:500;';

  return `
    <tr>
      <td style="padding:7px 0;width:38%;vertical-align:top;color:#64748B;font-size:13px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        ${icon ? `<span style="margin-right:6px;">${icon}</span>` : ''}${escapedLabel}
      </td>
      <td style="padding:7px 0;width:62%;vertical-align:top;font-size:13px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;${valueStyle}">
        ${escapedValue}
      </td>
    </tr>
  `;
}

/**
 * Render Task/Approval Details Card
 */
export function renderDetailsCard({
  title,
  badges = [],
  description,
  rows = [],
  accentColor,
  headerActionHtml = ''
}) {
  const validRows = rows.filter(r => r && r.value !== null && r.value !== undefined && r.value !== '');
  const borderLeft = accentColor ? `border-left: 4px solid ${accentColor};` : '';

  return `
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;${borderLeft}margin:20px 0;overflow:hidden;">
      <tr>
        <td style="padding:20px 22px;">
          ${badges.length > 0 ? `
          <div style="margin-bottom:12px;">
            ${badges.join('&nbsp;&nbsp;')}
          </div>
          ` : ''}

          <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="left">
                <h2 style="margin:0 0 8px;font-size:17px;font-weight:700;color:#0F172A;line-height:1.35;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                  ${escapeHtml(title)}
                </h2>
              </td>
              ${headerActionHtml ? `<td align="right" style="vertical-align:top;">${headerActionHtml}</td>` : ''}
            </tr>
          </table>

          ${description ? `
          <p style="margin:4px 0 16px;font-size:13px;line-height:1.55;color:#475569;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            ${escapeHtml(description)}
          </p>
          ` : ''}

          ${validRows.length > 0 ? `
          <div style="border-top:1px solid #E2E8F0;padding-top:12px;margin-top:12px;">
            <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
              ${validRows.map(r => renderMetadataRow(r)).join('')}
            </table>
          </div>
          ` : ''}
        </td>
      </tr>
    </table>
  `;
}

/**
 * Render Callout / Notice Box
 */
export function renderCalloutBox({ title, message, variant = 'info', icon }) {
  if (!message && !title) return '';
  const configs = {
    info: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF', defaultIcon: 'ℹ️' },
    warning: { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', defaultIcon: '⚠️' },
    critical: { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', defaultIcon: '🚨' },
    success: { bg: '#ECFDF5', border: '#A7F3D0', text: '#065F46', defaultIcon: '✅' },
    neutral: { bg: '#F8FAFC', border: '#E2E8F0', text: '#334155', defaultIcon: '📌' },
  };

  const cfg = configs[variant] || configs.info;
  const icn = icon || cfg.defaultIcon;

  return `
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:${cfg.bg};border:1px solid ${cfg.border};border-left:4px solid ${cfg.text};border-radius:8px;margin:18px 0;">
      <tr>
        <td style="padding:14px 18px;">
          <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
            <tr>
              ${icn ? `<td style="vertical-align:top;width:24px;padding-right:10px;font-size:15px;line-height:1.4;">${icn}</td>` : ''}
              <td style="vertical-align:top;">
                ${title ? `<div style="font-size:13px;font-weight:700;color:${cfg.text};margin-bottom:3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${escapeHtml(title)}</div>` : ''}
                <div style="font-size:13px;line-height:1.5;color:${cfg.text};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                  ${message}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Render 4 Metrics Grid for Daily Digest
 */
export function renderMetricsGrid(metrics) {
  // metrics: [ { label: 'Overdue', count: 3, color: '#EF4444', bg: '#FEF2F2' }, ... ]
  return `
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr>
        ${metrics.map(m => `
        <td align="center" style="width:25%;padding:4px;">
          <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;text-align:center;">
            <tr>
              <td style="padding:14px 6px;">
                <div style="font-size:24px;font-weight:800;color:${m.color};line-height:1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                  ${m.count}
                </div>
                <div style="font-size:11px;font-weight:600;color:#64748B;margin-top:6px;text-transform:uppercase;letter-spacing:0.3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                  ${escapeHtml(m.label)}
                </div>
              </td>
            </tr>
          </table>
        </td>
        `).join('')}
      </tr>
    </table>
  `;
}

/**
 * Render compact Task List Item for Digest / Groups
 */
export function renderDigestItem({ title, badgeHtml, metaText, url, isOverdue = false }) {
  const accentBorder = isOverdue ? 'border-left: 3px solid #EF4444;' : 'border-left: 3px solid #CBD5E1;';

  return `
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border:1px solid #E2E8F0;${accentBorder}border-radius:6px;margin-bottom:8px;">
      <tr>
        <td style="padding:10px 14px;vertical-align:middle;">
          <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="left" style="vertical-align:middle;">
                <div style="font-size:13px;font-weight:600;color:#0F172A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                  ${escapeHtml(title)}
                </div>
                ${metaText ? `
                <div style="font-size:12px;color:#64748B;margin-top:3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                  ${metaText}
                </div>` : ''}
              </td>
              <td align="right" style="vertical-align:middle;padding-left:10px;white-space:nowrap;">
                ${badgeHtml ? `<span style="margin-right:8px;">${badgeHtml}</span>` : ''}
                ${url ? `<a href="${escapeHtml(url)}" style="color:#2563EB;text-decoration:none;font-size:12px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">View &rarr;</a>` : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Render Side-by-Side Diff Table for Task Change Requests
 */
export function renderChangesDiffTable(requestedChanges, formatFn = (f, v) => v) {
  const fieldLabels = {
    dueDate: 'Due Date',
    status: 'Status',
    priority: 'Priority',
    assignedTo: 'Assignee',
    title: 'Task Title',
    description: 'Description'
  };

  const rows = Object.entries(requestedChanges || {}).map(([field, change]) => {
    const label = fieldLabels[field] || field;
    const oldVal = formatFn(field, change?.old);
    const newVal = formatFn(field, change?.new);

    return `
      <tr style="border-bottom:1px solid #E2E8F0;">
        <td style="padding:10px 12px;font-weight:600;color:#334155;font-size:13px;width:30%;vertical-align:middle;">
          ${escapeHtml(label)}
        </td>
        <td style="padding:10px 12px;color:#94A3B8;font-size:13px;text-decoration:line-through;width:35%;vertical-align:middle;">
          ${escapeHtml(oldVal || 'None')}
        </td>
        <td style="padding:10px 12px;color:#059669;font-weight:700;font-size:13px;width:35%;vertical-align:middle;">
          ${escapeHtml(newVal || 'None')}
        </td>
      </tr>
    `;
  }).join('');

  return `
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:16px 0;background-color:#FFFFFF;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <thead>
        <tr style="background-color:#F8FAFC;border-bottom:2px solid #E2E8F0;text-align:left;">
          <th style="padding:10px 12px;color:#475569;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Field</th>
          <th style="padding:10px 12px;color:#475569;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Current Value</th>
          <th style="padding:10px 12px;color:#059669;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Requested Value</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

/**
 * 🧱 BaseEmailLayout
 * Wraps every email with responsive scaffolding, TaskSetu brand header, hero banner, content, and compliant SaaS footer.
 */
export function wrapInBaseLayout({
  title,
  previewText,
  accentColor = BRAND_COLORS.primary,
  categoryBadgeText = 'NOTIFICATION',
  categoryBadgeVariant = 'info',
  heroIcon = '📬',
  heroTitle,
  heroSubtitle,
  contentHtml,
  baseUrl = 'https://tasksetu.app'
}) {
  const currentYear = new Date().getFullYear();
  const safeTitle = escapeHtml(title || heroTitle || 'TaskSetu Notification');
  const safePreview = escapeHtml(previewText || heroSubtitle || heroTitle || 'TaskSetu update');
  const safeBaseUrl = baseUrl.replace(/\/+$/, '');
  const prefUrl = `${safeBaseUrl}/settings/notifications`;

  const badgeConfig = BADGE_VARIANTS[categoryBadgeVariant] || BADGE_VARIANTS.info;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${safeTitle}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      background-color: #F8FAFC;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #334155;
    }
    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
      }
      .content-padding {
        padding: 20px 16px !important;
      }
      .header-padding {
        padding: 16px !important;
      }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#F8FAFC;-webkit-font-smoothing:antialiased;">
  <!-- Preview text -->
  <div style="display:none;font-size:1px;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;font-family:sans-serif;">
    ${safePreview}
  </div>

  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color:#F8FAFC;padding:24px 8px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" class="email-container" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#FFFFFF;border-radius:12px;border:1px solid #E2E8F0;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.04), 0 2px 4px -2px rgba(0,0,0,0.04);">
          
          <!-- Colored Accent Bar -->
          <tr>
            <td style="height:4px;background-color:${accentColor};line-height:4px;font-size:4px;">&nbsp;</td>
          </tr>

          <!-- TaskSetu Brand Header -->
          <tr>
            <td class="header-padding" style="padding:20px 28px;border-bottom:1px solid #F1F5F9;background-color:#FFFFFF;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left" style="vertical-align:middle;">
                    <a href="${safeBaseUrl}" style="text-decoration:none;display:inline-block;">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="background-color:#2563EB;border-radius:7px;width:30px;height:30px;text-align:center;vertical-align:middle;color:#FFFFFF;font-weight:800;font-size:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                            T
                          </td>
                          <td style="padding-left:10px;vertical-align:middle;">
                            <span style="font-size:17px;font-weight:700;color:#0F172A;letter-spacing:-0.3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">TaskSetu</span>
                          </td>
                        </tr>
                      </table>
                    </a>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;padding:4px 10px;border-radius:16px;background-color:${badgeConfig.bg};color:${badgeConfig.text};border:1px solid ${badgeConfig.border};font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                      ${escapeHtml(categoryBadgeText)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero Section -->
          ${heroTitle ? `
          <tr>
            <td class="header-padding" style="padding:22px 28px 18px;background-color:#F8FAFC;border-bottom:1px solid #E2E8F0;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;width:42px;padding-right:14px;">
                    <div style="width:38px;height:38px;border-radius:10px;background-color:#FFFFFF;border:1px solid #E2E8F0;text-align:center;line-height:38px;font-size:20px;">
                      ${heroIcon}
                    </div>
                  </td>
                  <td style="vertical-align:middle;">
                    <h1 style="margin:0;font-size:19px;font-weight:700;color:#0F172A;line-height:1.3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                      ${escapeHtml(heroTitle)}
                    </h1>
                    ${heroSubtitle ? `<div style="margin-top:3px;font-size:13px;color:#64748B;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${escapeHtml(heroSubtitle)}</div>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Content Body -->
          <tr>
            <td class="content-padding" style="padding:26px 28px;">
              ${contentHtml}
            </td>
          </tr>

          <!-- Standard SaaS Footer -->
          <tr>
            <td style="padding:22px 28px;background-color:#F8FAFC;border-top:1px solid #E2E8F0;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;color:#64748B;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                This is an automated notification from <strong>TaskSetu</strong>. You're receiving this email because you're involved in this task or have notification settings enabled.
              </p>
              <p style="margin:0 0 10px;font-size:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                <a href="${escapeHtml(prefUrl)}" style="color:#2563EB;text-decoration:none;font-weight:600;">Manage notification preferences</a>
                <span style="color:#CBD5E1;margin:0 8px;">&bull;</span>
                <a href="${escapeHtml(safeBaseUrl)}" style="color:#64748B;text-decoration:none;">Visit TaskSetu</a>
              </p>
              <p style="margin:0;font-size:11px;color:#94A3B8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                &copy; ${currentYear} TaskSetu. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
