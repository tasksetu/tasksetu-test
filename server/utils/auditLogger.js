import { AuditLog } from '../modals/auditLogModal.js';
import mongoose from 'mongoose';

/**
 * Audit Logging Utility
 * Helper functions for consistent audit logging across the application
 * Spec: Section 5.12 - Activity/Audit Logging & Compliance
 * Phase I: Action logging only, no workflow triggers
 */

/**
 * Extract request metadata for audit logging
 * @param {Request} req - Express request object
 * @returns {Object} - Metadata object
 */
export const extractRequestMetadata = (req) => {
  return {
    source_ip: req.ip || req.connection?.remoteAddress || 'unknown',
    user_agent: req.get('user-agent') || null,
    request_id: req.id || null,
  };
};

/**
 * Get organization retention policy (days)
 * @param {String} organizationId - Organization ID
 * @returns {Number} - Retention days
 */
export const getRetentionDays = async (organizationId) => {
  // Default retention: 7 years (as per compliance standards)
  const DEFAULT_RETENTION_DAYS = 365 * 7;

  if (!organizationId) return DEFAULT_RETENTION_DAYS;

  try {
    // Try to get org-specific retention policy
    const { Organization } = await import('../modals/organizationModal.js');
    const org = await Organization.findById(organizationId).select('audit_retention_days');

    return org?.audit_retention_days || DEFAULT_RETENTION_DAYS;
  } catch (error) {
    console.warn('⚠️ Could not fetch org retention policy, using default:', error.message);
    return DEFAULT_RETENTION_DAYS;
  }
};

/**
 * Log form template creation
 */
export const logFormCreated = async (form, user, req) => {
  const metadata = extractRequestMetadata(req);
  const retention_days = await getRetentionDays(user.organizationId);

  return await AuditLog.log({
    action: 'FORM_CREATED',
    entity_type: 'FORM_TEMPLATE',
    entity_id: form._id,
    entity_name: form.title,
    actor_type: 'USER',
    actor_id: user.id,
    actor_email: user.email,
    actor_name: user.name || `${user.firstName} ${user.lastName}`,
    organization_id: user.organizationId,
    change_summary: `Created form template "${form.title}" (${form.status})`,
    metadata: {
      form_id: form.form_id,
      status: form.status,
      field_count: form.fields?.length || 0,
      visibility: form.visibility,
    },
    retention_days,
    ...metadata,
  });
};

/**
 * Log form template update
 */
export const logFormUpdated = async (form, user, req, changes = null) => {
  const metadata = extractRequestMetadata(req);
  const retention_days = await getRetentionDays(user.organizationId);

  return await AuditLog.log({
    action: 'FORM_UPDATED',
    entity_type: 'FORM_TEMPLATE',
    entity_id: form._id,
    entity_name: form.title,
    actor_type: 'USER',
    actor_id: user.id,
    actor_email: user.email,
    actor_name: user.name || `${user.firstName} ${user.lastName}`,
    organization_id: user.organizationId,
    change_summary: `Updated form template "${form.title}"`,
    changes: changes,
    metadata: {
      form_id: form.form_id,
      status: form.status,
    },
    retention_days,
    ...metadata,
  });
};

/**
 * Log form publish action
 */
export const logFormPublished = async (form, version, user, req) => {
  const metadata = extractRequestMetadata(req);
  const retention_days = await getRetentionDays(user.organizationId);

  return await AuditLog.log({
    action: 'FORM_PUBLISHED',
    entity_type: 'FORM_VERSION',
    entity_id: version._id,
    entity_name: form.title,
    actor_type: 'USER',
    actor_id: user.id,
    actor_email: user.email,
    actor_name: user.name || `${user.firstName} ${user.lastName}`,
    organization_id: user.organizationId,
    change_summary: `Published form "${form.title}" as v${version.version_number}`,
    metadata: {
      form_id: form.form_id,
      version_number: version.version_number,
      release_notes: version.release_notes,
      external_submission_enabled: version.external_submission_enabled,
      start_at: version.start_at,
      end_at: version.end_at,
    },
    retention_days,
    ...metadata,
  });
};

/**
 * Log form unpublish action
 */
export const logFormUnpublished = async (form, user, req, reason = null) => {
  const metadata = extractRequestMetadata(req);
  const retention_days = await getRetentionDays(user.organizationId);

  return await AuditLog.log({
    action: 'FORM_UNPUBLISHED',
    entity_type: 'FORM_TEMPLATE',
    entity_id: form._id,
    entity_name: form.title,
    actor_type: 'USER',
    actor_id: user.id,
    actor_email: user.email,
    actor_name: user.name || `${user.firstName} ${user.lastName}`,
    organization_id: user.organizationId,
    change_summary: `Unpublished form "${form.title}"${reason ? `. Reason: ${reason}` : ''}`,
    metadata: {
      form_id: form.form_id,
      reason: reason,
    },
    retention_days,
    ...metadata,
  });
};

/**
 * Log form archive action
 */
export const logFormArchived = async (form, user, req, reason = null) => {
  const metadata = extractRequestMetadata(req);
  const retention_days = await getRetentionDays(user.organizationId);

  return await AuditLog.log({
    action: 'FORM_ARCHIVED',
    entity_type: 'FORM_TEMPLATE',
    entity_id: form._id,
    entity_name: form.title,
    actor_type: 'USER',
    actor_id: user.id,
    actor_email: user.email,
    actor_name: user.name || `${user.firstName} ${user.lastName}`,
    organization_id: user.organizationId,
    change_summary: `Archived form "${form.title}"${reason ? `. Reason: ${reason}` : ''}`,
    metadata: {
      form_id: form.form_id,
      reason: reason,
    },
    retention_days,
    ...metadata,
  });
};

/**
 * Log form deletion action
 */
export const logFormDeleted = async (form, user, req, submissionCount = 0) => {
  const metadata = extractRequestMetadata(req);
  const retention_days = await getRetentionDays(user.organizationId);

  return await AuditLog.log({
    action: 'FORM_DELETED',
    entity_type: 'FORM_TEMPLATE',
    entity_id: form._id,
    entity_name: form.title,
    actor_type: 'USER',
    actor_id: user.id,
    actor_email: user.email,
    actor_name: user.name || `${user.firstName} ${user.lastName}`,
    organization_id: user.organizationId,
    change_summary: `Deleted form "${form.title}". Submissions preserved: ${submissionCount}`,
    metadata: {
      form_id: form.form_id,
      submission_count: submissionCount,
    },
    retention_days,
    ...metadata,
  });
};

/**
 * Log form clone action
 */
export const logFormCloned = async (originalForm, newForm, user, req) => {
  const metadata = extractRequestMetadata(req);
  const retention_days = await getRetentionDays(user.organizationId);

  return await AuditLog.log({
    action: 'FORM_CLONED',
    entity_type: 'FORM_TEMPLATE',
    entity_id: newForm._id,
    entity_name: newForm.title,
    actor_type: 'USER',
    actor_id: user.id,
    actor_email: user.email,
    actor_name: user.name || `${user.firstName} ${user.lastName}`,
    organization_id: user.organizationId,
    change_summary: `Cloned form "${originalForm.title}" to "${newForm.title}"`,
    metadata: {
      original_form_id: originalForm.form_id,
      new_form_id: newForm.form_id,
    },
    retention_days,
    ...metadata,
  });
};

/**
 * Log form attachment to subtask (Phase I)
 */
export const logFormAttached = async (form, version, subtask, user, req) => {
  const metadata = extractRequestMetadata(req);
  const retention_days = await getRetentionDays(user.organizationId);

  return await AuditLog.log({
    action: 'FORM_ATTACHED_TO_SUBTASK',
    entity_type: 'FORM_USAGE',
    entity_id: form._id,
    entity_name: form.title,
    actor_type: 'USER',
    actor_id: user.id,
    actor_email: user.email,
    actor_name: user.name || `${user.firstName} ${user.lastName}`,
    organization_id: user.organizationId,
    change_summary: `Attached form "${form.title}" (v${version.version_number}) to subtask "${subtask.title}"`,
    metadata: {
      form_id: form.form_id,
      version_id: version._id,
      version_number: version.version_number,
      subtask_id: subtask._id,
      subtask_title: subtask.title,
    },
    retention_days,
    ...metadata,
  });
};

/**
 * Log form unlink from subtask (Phase I)
 */
export const logFormUnlinked = async (form, subtask, user, req, hasSubmissions = false) => {
  const metadata = extractRequestMetadata(req);
  const retention_days = await getRetentionDays(user.organizationId);

  return await AuditLog.log({
    action: 'FORM_UNLINKED_FROM_SUBTASK',
    entity_type: 'FORM_USAGE',
    entity_id: form._id,
    entity_name: form.title,
    actor_type: 'USER',
    actor_id: user.id,
    actor_email: user.email,
    actor_name: user.name || `${user.firstName} ${user.lastName}`,
    organization_id: user.organizationId,
    change_summary: `Unlinked form "${form.title}" from subtask "${subtask.title}"${hasSubmissions ? ' (submissions preserved)' : ' (no submissions)'}`,
    metadata: {
      form_id: form.form_id,
      subtask_id: subtask._id,
      subtask_title: subtask.title,
      has_submissions: hasSubmissions,
    },
    retention_days,
    ...metadata,
  });
};

/**
 * Log form submission
 */
export const logFormSubmission = async (form, submission, user, req) => {
  const metadata = extractRequestMetadata(req);
  const retention_days = await getRetentionDays(user?.organizationId);

  return await AuditLog.log({
    action: 'FORM_SUBMITTED',
    entity_type: 'FORM_SUBMISSION',
    entity_id: submission._id,
    entity_name: form.title,
    actor_type: user ? 'USER' : 'EXTERNAL',
    actor_id: user?.id || null,
    actor_email: user?.email || null,
    actor_name: user ? (user.name || `${user.firstName} ${user.lastName}`) : 'Anonymous',
    organization_id: user?.organizationId || null,
    change_summary: `Form "${form.title}" submitted${user ? ` by ${user.email}` : ' anonymously'}`,
    metadata: {
      form_id: form.form_id,
      submission_id: submission._id,
      external_submission: !user,
    },
    retention_days,
    ...metadata,
  });
};

/**
 * Log external link generation
 */
export const logExternalLinkGenerated = async (form, version, user, req) => {
  const metadata = extractRequestMetadata(req);
  const retention_days = await getRetentionDays(user.organizationId);

  return await AuditLog.log({
    action: 'EXTERNAL_LINK_GENERATED',
    entity_type: 'FORM_VERSION',
    entity_id: version._id,
    entity_name: form.title,
    actor_type: 'USER',
    actor_id: user.id,
    actor_email: user.email,
    actor_name: user.name || `${user.firstName} ${user.lastName}`,
    organization_id: user.organizationId,
    change_summary: `Generated external submission link for form "${form.title}"`,
    metadata: {
      form_id: form.form_id,
      version_number: version.version_number,
      has_password: !!version.external_password,
      expires_at: version.end_at,
    },
    retention_days,
    ...metadata,
  });
};

/**
 * Log user login action
 */
export const logUserLogin = async (user, req) => {
  const metadata = extractRequestMetadata(req);
  return await AuditLog.log({
    action: 'USER_LOGIN',
    entity_type: 'USER',
    entity_id: user._id || user.id,
    entity_name: user.email,
    actor_type: 'USER',
    actor_id: user._id || user.id,
    actor_email: user.email,
    actor_name: user.firstName ? `${user.firstName} ${user.lastName || ''}` : user.name,
    organization_id: user.organizationId || user.organization_id,
    change_summary: `User ${user.email} logged in successfully`,
    ...metadata,
  });
};

/**
 * Log failed login attempt
 */
export const logUserLoginFailed = async (email, reason, req) => {
  const metadata = extractRequestMetadata(req);
  return await AuditLog.log({
    action: 'USER_LOGIN_FAILED',
    entity_type: 'USER',
    entity_id: new mongoose.Types.ObjectId(), // Placeholder for failed login
    entity_name: email,
    actor_type: 'USER',
    actor_email: email,
    change_summary: `Failed login attempt: ${reason}`,
    ...metadata,
  });
};

/**
 * Log role change action
 */
export const logRoleChange = async (targetUser, oldRole, newRole, admin, req) => {
  const metadata = extractRequestMetadata(req);
  return await AuditLog.log({
    action: 'ROLE_CHANGED',
    entity_type: 'USER',
    entity_id: targetUser._id || targetUser.id,
    entity_name: targetUser.email,
    actor_type: 'USER',
    actor_id: admin._id || admin.id,
    actor_email: admin.email,
    actor_name: admin.firstName ? `${admin.firstName} ${admin.lastName || ''}` : admin.name,
    organization_id: admin.organizationId || admin.organization_id,
    change_summary: `Changed role for ${targetUser.email} from ${oldRole} to ${newRole}`,
    changes: { from: oldRole, to: newRole },
    ...metadata,
  });
};

/**
 * Log task deletion
 */
export const logTaskDeletion = async (task, user, req) => {
  const metadata = extractRequestMetadata(req);
  return await AuditLog.log({
    action: 'TASK_DELETED',
    entity_type: 'TASK',
    entity_id: task._id || task.id,
    entity_name: task.title,
    actor_type: 'USER',
    actor_id: user._id || user.id,
    actor_email: user.email,
    actor_name: user.firstName ? `${user.firstName} ${user.lastName || ''}` : user.name,
    organization_id: user.organizationId || user.organization_id,
    change_summary: `Deleted task "${task.title}"`,
    ...metadata,
  });
};

/**
 * Log license assignment
 */
export const logLicenseAssignment = async (targetUser, licenseType, admin, req) => {
  const metadata = extractRequestMetadata(req);
  return await AuditLog.log({
    action: 'LICENSE_ASSIGNED',
    entity_type: 'USER',
    entity_id: targetUser._id || targetUser.id,
    entity_name: targetUser.email,
    actor_type: 'USER',
    actor_id: admin._id || admin.id,
    actor_email: admin.email,
    organization_id: admin.organizationId || admin.organization_id,
    change_summary: `Assigned ${licenseType} license to ${targetUser.email}`,
    metadata: { license_type: licenseType },
    ...metadata,
  });
};

/**
 * Log license unassignment
 */
export const logLicenseUnassignment = async (targetUser, licenseType, admin, req) => {
  const metadata = extractRequestMetadata(req);
  return await AuditLog.log({
    action: 'LICENSE_UNASSIGNED',
    entity_type: 'USER',
    entity_id: targetUser._id || targetUser.id,
    entity_name: targetUser.email,
    actor_type: 'USER',
    actor_id: admin?._id || admin?.id,
    actor_email: admin?.email,
    organization_id: admin?.organizationId || admin?.organization_id,
    change_summary: `Unassigned ${licenseType} license from ${targetUser.email}`,
    metadata: { license_type: licenseType },
    ...metadata,
  });
};
/**
 * Log Task Creation
 */
export const logTaskCreated = async (task, user, req) => {
  const metadata = extractRequestMetadata(req);
  return await AuditLog.log({
    action: 'TASK_CREATED',
    entity_type: 'TASK',
    entity_id: task._id,
    entity_name: task.title,
    actor_type: 'USER',
    actor_id: user._id,
    actor_email: user.email,
    actor_name: user.firstName ? `${user.firstName} ${user.lastName || ''}` : user.name,
    organization_id: user.organizationId,
    change_summary: `Created task "${task.title}"`,
    metadata: { status: task.status, priority: task.priority },
    ...metadata,
  });
};

/**
 * Log Task Update
 */
export const logTaskUpdated = async (task, changes, user, req) => {
  const metadata = extractRequestMetadata(req);
  return await AuditLog.log({
    action: 'TASK_UPDATED',
    entity_type: 'TASK',
    entity_id: task._id,
    entity_name: task.title,
    actor_type: 'USER',
    actor_id: user._id,
    actor_email: user.email,
    actor_name: user.firstName ? `${user.firstName} ${user.lastName || ''}` : user.name,
    organization_id: user.organizationId,
    change_summary: `Updated task "${task.title}"`,
    changes: changes,
    ...metadata,
  });
};

/**
 * Log Task Status Change
 */
export const logTaskStatusChanged = async (task, oldStatus, newStatus, user, req) => {
  const metadata = extractRequestMetadata(req);
  return await AuditLog.log({
    action: 'TASK_STATUS_CHANGED',
    entity_type: 'TASK',
    entity_id: task._id,
    entity_name: task.title,
    actor_type: 'USER',
    actor_id: user._id,
    actor_email: user.email,
    actor_name: user.firstName ? `${user.firstName} ${user.lastName || ''}` : user.name,
    organization_id: user.organizationId,
    change_summary: `Changed task status for "${task.title}" from "${oldStatus}" to "${newStatus}"`,
    changes: { from: oldStatus, to: newStatus },
    ...metadata,
  });
};

/**
 * Log User Invitation
 */
export const logUserInvitation = async (email, role, admin, req) => {
  const metadata = extractRequestMetadata(req);
  return await AuditLog.log({
    action: 'USER_INVITED',
    entity_type: 'USER',
    actor_type: 'USER',
    actor_id: admin._id,
    actor_email: admin.email,
    actor_name: admin.firstName ? `${admin.firstName} ${admin.lastName || ''}` : admin.name,
    organization_id: admin.organizationId,
    change_summary: `Invited user ${email} with role ${role}`,
    metadata: { email, role },
    ...metadata,
  });
};

/**
 * Log User Status Change (Activate/Deactivate)
 */
export const logUserStatusChange = async (targetUser, action, admin, req) => {
  const metadata = extractRequestMetadata(req);
  return await AuditLog.log({
    action: action === 'activate' ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
    entity_type: 'USER',
    entity_id: targetUser._id,
    entity_name: targetUser.email,
    actor_type: 'USER',
    actor_id: admin._id,
    actor_email: admin.email,
    actor_name: admin.firstName ? `${admin.firstName} ${admin.lastName || ''}` : admin.name,
    organization_id: admin.organizationId,
    change_summary: `${action === 'activate' ? 'Activated' : 'Deactivated'} user account for ${targetUser.email}`,
    ...metadata,
  });
};

/**
 * Log User Deletion
 */
export const logUserDeletion = async (targetUser, admin, req) => {
  const metadata = extractRequestMetadata(req);
  return await AuditLog.log({
    action: 'USER_DELETED',
    entity_type: 'USER',
    entity_id: targetUser._id,
    entity_name: targetUser.email,
    actor_type: 'USER',
    actor_id: admin._id,
    actor_email: admin.email,
    actor_name: admin.firstName ? `${admin.firstName} ${admin.lastName || ''}` : admin.name,
    organization_id: admin.organizationId,
    change_summary: `Deleted user account for ${targetUser.email}`,
    ...metadata,
  });
};
/**
 * Super Admin Audit Logging Functions
 */

export const logFeatureFlagToggle = async (flagName, enabled, admin, req) => {
  const metadata = extractRequestMetadata(req);
  return await AuditLog.log({
    action: 'FEATURE_FLAG_CHANGED',
    entity_type: 'SYSTEM',
    entity_id: admin._id || admin.id, // System changes use admin as ID context
    entity_name: flagName,
    actor_type: 'USER',
    actor_id: admin._id || admin.id,
    actor_email: admin.email,
    change_summary: `Feature flag "${flagName}" toggled to ${enabled ? 'enabled' : 'disabled'}`,
    changes: { flag_name: flagName, enabled: enabled },
    ...metadata,
  });
};

export const logLicenseChange = async (company, oldLicense, newLicense, admin, req) => {
  const metadata = extractRequestMetadata(req);
  return await AuditLog.log({
    action: 'LICENSE_OVERRIDE',
    entity_type: 'ORGANIZATION',
    entity_id: company._id || company.id,
    entity_name: company.name,
    actor_type: 'USER',
    actor_id: admin._id || admin.id,
    actor_email: admin.email,
    change_summary: `License changed from ${oldLicense} to ${newLicense} for ${company.name}`,
    changes: { from: oldLicense, to: newLicense },
    ...metadata,
  });
};

export const logCompanySuspension = async (company, reason, admin, req) => {
  const metadata = extractRequestMetadata(req);
  return await AuditLog.log({
    action: 'COMPANY_SUSPENDED',
    entity_type: 'ORGANIZATION',
    entity_id: company._id || company.id,
    entity_name: company.name,
    actor_type: 'USER',
    actor_id: admin._id || admin.id,
    actor_email: admin.email,
    change_summary: `Company suspended: ${reason}`,
    changes: { status: 'suspended', reason },
    ...metadata,
  });
};

export const logIntegrationChange = async (integrationName, settings, admin, req) => {
  const metadata = extractRequestMetadata(req);
  return await AuditLog.log({
    action: 'INTEGRATION_UPDATED',
    entity_type: 'SYSTEM',
    entity_id: admin?._id || admin?.id,
    entity_name: integrationName,
    actor_type: 'USER',
    actor_id: admin?._id || admin?.id,
    actor_email: admin?.email,
    change_summary: `Integration "${integrationName}" configuration updated`,
    changes: settings,
    ...metadata,
  });
};

export const logNotificationTriggerUpdate = async (triggerName, config, admin, req) => {
  const metadata = extractRequestMetadata(req);
  return await AuditLog.log({
    action: 'NOTIFICATION_CONFIG_UPDATED',
    entity_type: 'SYSTEM',
    entity_id: admin?._id || admin?.id,
    entity_name: triggerName,
    actor_type: 'USER',
    actor_id: admin?._id || admin?.id,
    actor_email: admin?.email,
    change_summary: `Notification trigger "${triggerName}" updated`,
    changes: config,
    ...metadata,
  });
};

/**
 * Log System Config Update
 */
export const logSystemConfigUpdate = async (key, value, admin, req) => {
  const metadata = extractRequestMetadata(req);
  return await AuditLog.log({
    action: 'SYSTEM_CONFIG_UPDATED',
    entity_type: 'SYSTEM',
    entity_id: admin?._id || admin?.id,
    entity_name: key,
    actor_type: 'USER',
    actor_id: admin?._id || admin?.id,
    actor_email: admin?.email,
    change_summary: `System configuration "${key}" updated`,
    changes: { key, value },
    ...metadata,
  });
};

/**
 * Log License Plan Creation
 */
export const logLicensePlanCreated = async (plan, admin, req) => {
  const metadata = extractRequestMetadata(req);
  return await AuditLog.log({
    action: 'LICENSE_PLAN_CREATED',
    entity_type: 'SYSTEM',
    entity_id: plan._id,
    entity_name: plan.name,
    actor_type: 'USER',
    actor_id: admin?._id || admin?.id,
    actor_email: admin?.email,
    change_summary: `Created license plan "${plan.name}"`,
    metadata: { license_code: plan.license_code },
    ...metadata,
  });
};

/**
 * Log License Plan Update
 */
export const logLicensePlanUpdated = async (plan, changes, admin, req) => {
  const metadata = extractRequestMetadata(req);
  return await AuditLog.log({
    action: 'LICENSE_PLAN_UPDATED',
    entity_type: 'SYSTEM',
    entity_id: plan._id,
    entity_name: plan.name,
    actor_type: 'USER',
    actor_id: admin?._id || admin?.id,
    actor_email: admin?.email,
    change_summary: `Updated license plan "${plan.name}"`,
    changes: changes,
    metadata: { license_code: plan.license_code },
    ...metadata,
  });
};

/**
 * Log License Plan Deletion
 */
export const logLicensePlanDeleted = async (plan, admin, req) => {
  const metadata = extractRequestMetadata(req);
  return await AuditLog.log({
    action: 'LICENSE_PLAN_DELETED',
    entity_type: 'SYSTEM',
    entity_id: plan._id,
    entity_name: plan.name,
    actor_type: 'USER',
    actor_id: admin?._id || admin?.id,
    actor_email: admin?.email,
    change_summary: `Deleted license plan "${plan.name}"`,
    metadata: { license_code: plan.license_code },
    ...metadata,
  });
};

/**
 * Log Plan Features Updated
 */
export const logPlanFeaturesUpdated = async (plan, admin, req) => {
  const metadata = extractRequestMetadata(req);
  return await AuditLog.log({
    action: 'PLAN_FEATURES_UPDATED',
    entity_type: 'SYSTEM',
    entity_id: plan._id,
    entity_name: plan.name,
    actor_type: 'USER',
    actor_id: admin?._id || admin?.id,
    actor_email: admin?.email,
    change_summary: `Updated features for plan "${plan.name}"`,
    metadata: { license_code: plan.license_code },
    ...metadata,
  });
};

/**
 * Log License Override
 */
export const logLicenseOverride = async (org, newPlan, admin, req) => {
  const metadata = extractRequestMetadata(req);
  return await AuditLog.log({
    action: 'LICENSE_OVERRIDE',
    entity_type: 'ORGANIZATION',
    entity_id: org._id,
    entity_name: org.name,
    organization_id: org._id,
    actor_type: 'USER',
    actor_id: admin?._id || admin?.id,
    actor_email: admin?.email,
    change_summary: `Overrode license for "${org.name}" to ${newPlan}`,
    metadata: { license_code: newPlan },
    ...metadata,
  });
};

/**
 * Log Trial Extension
 */
export const logTrialExtension = async (org, days, expiryDate, admin, req) => {
  const metadata = extractRequestMetadata(req);
  return await AuditLog.log({
    action: 'TRIAL_EXTENDED',
    entity_type: 'ORGANIZATION',
    entity_id: org._id,
    entity_name: org.name,
    organization_id: org._id,
    actor_type: 'USER',
    actor_id: admin?._id || admin?.id,
    actor_email: admin?.email,
    change_summary: `Extended trial for "${org.name}" by ${days} days to ${expiryDate}`,
    metadata: { days, expiry_date: expiryDate },
    ...metadata,
  });
};

/**
 * Log License Suspension
 */
export const logLicenseSuspension = async (org, action, admin, req) => {
  const metadata = extractRequestMetadata(req);
  const actionLabel = action === 'suspend' ? 'Suspended' : 'Reactivated';
  return await AuditLog.log({
    action: action === 'suspend' ? 'LICENSE_SUSPENDED' : 'LICENSE_REACTIVATED',
    entity_type: 'ORGANIZATION',
    entity_id: org._id,
    entity_name: org.name,
    organization_id: org._id,
    actor_type: 'USER',
    actor_id: admin?._id || admin?.id,
    actor_email: admin?.email,
    change_summary: `${actionLabel} license for "${org.name}"`,
    ...metadata,
  });
};

/**
 * Log Organization Feature Flag Toggle
 */
export const logOrgFeatureFlagToggle = async (org, featureCode, enabled, admin, req) => {
  const metadata = extractRequestMetadata(req);
  return await AuditLog.log({
    action: 'FEATURE_FLAG_CHANGED',
    entity_type: 'ORGANIZATION',
    entity_id: org._id,
    entity_name: org.name,
    organization_id: org._id,
    actor_type: 'USER',
    actor_id: admin?._id || admin?.id,
    actor_email: admin?.email,
    change_summary: `Feature "${featureCode}" ${enabled ? 'enabled' : 'disabled'} for organization "${org.name}"`,
    metadata: { feature_code: featureCode, enabled },
    ...metadata,
  });
};

/**
 * Log Password Change
 */
export const logPasswordChange = async (user, req) => {
  const metadata = extractRequestMetadata(req);
  return await AuditLog.log({
    action: 'PASSWORD_CHANGED',
    entity_type: 'USER',
    entity_id: user._id,
    entity_name: user.email,
    actor_type: 'USER',
    actor_id: user._id,
    actor_email: user.email,
    change_summary: `Password changed for user ${user.email}`,
    ...metadata,
  });
};

/**
 * Log Password Reset Request
 */
export const logPasswordResetRequested = async (user, req) => {
  const metadata = extractRequestMetadata(req);
  return await AuditLog.log({
    action: 'PASSWORD_RESET_REQUESTED',
    entity_type: 'USER',
    entity_id: user._id,
    entity_name: user.email,
    actor_type: 'USER',
    actor_id: user._id,
    actor_email: user.email,
    change_summary: `Password reset requested for user ${user.email}`,
    ...metadata,
  });
};

/**
 * Log Password Reset Success
 */
export const logPasswordResetSuccess = async (user, req) => {
  const metadata = extractRequestMetadata(req);
  return await AuditLog.log({
    action: 'PASSWORD_RESET_SUCCESS',
    entity_type: 'USER',
    entity_id: user._id,
    entity_name: user.email,
    actor_type: 'USER',
    actor_id: user._id,
    actor_email: user.email,
    change_summary: `Password reset successful for user ${user.email}`,
    ...metadata,
  });
};

/**
 * Log License Purchase
 */
export const logLicensePurchase = async (purchase, admin, req) => {
  const metadata = extractRequestMetadata(req);
  return await AuditLog.log({
    action: 'LICENSE_PURCHASED',
    entity_type: 'ORGANIZATION',
    entity_id: purchase.organization_id,
    organization_id: purchase.organization_id,
    actor_type: 'USER',
    actor_id: admin?._id || admin?.id,
    actor_email: admin?.email,
    change_summary: `Purchased ${purchase.seats_purchased} seats of ${purchase.license_code}`,
    metadata: {
      license_code: purchase.license_code,
      seats: purchase.seats_purchased,
      total_price: purchase.total_price
    },
    ...metadata,
  });
};

/**
 * Get Super Admin Audit Logs
 */
export const getSuperAdminAuditLogs = async (filters = {}) => {
  const { AuditLog } = await import('../modals/auditLogModal.js');

  const query = {};

  // Handle action categories from frontend
  if (filters.action && filters.action !== 'all') {
    switch (filters.action) {
      case 'license_change':
        query.action = { $in: ['LICENSE_OVERRIDE', 'TRIAL_EXTENDED', 'LICENSE_SUSPENDED', 'LICENSE_REACTIVATED', 'LICENSE_PLAN_CREATED', 'LICENSE_PLAN_UPDATED', 'LICENSE_ASSIGNED', 'LICENSE_UNASSIGNED'] };
        break;
      case 'feature_toggle':
        query.action = { $in: ['FEATURE_FLAG_CHANGED', 'PLAN_FEATURES_UPDATED'] };
        break;
      case 'company_suspension':
        query.action = { $in: ['COMPANY_SUSPENDED', 'COMPANY_ACTIVATED'] };
        break;
      case 'admin_action':
        query.action = { $in: ['ROLE_CHANGED', 'USER_INVITED', 'USER_DELETED', 'SYSTEM_CONFIG_UPDATED'] };
        break;
      default:
        query.action = filters.action;
    }
  }

  if (filters.adminId) query.actor_id = filters.adminId;
  if (filters.organizationId) query.organization_id = filters.organizationId;
  if (filters.userId) query.actor_id = filters.userId;

  if (filters.dateRange) {
    const now = new Date();
    let fromDate = new Date();

    switch (filters.dateRange) {
      case '24hours':
        fromDate.setHours(fromDate.getHours() - 24);
        break;
      case '7days':
        fromDate.setDate(fromDate.getDate() - 7);
        break;
      case '30days':
        fromDate.setDate(fromDate.getDate() - 30);
        break;
      case '90days':
        fromDate.setDate(fromDate.getDate() - 90);
        break;
      default:
        // Handle ISO date strings if passed
        if (!isNaN(Date.parse(filters.dateRange))) {
          fromDate = new Date(filters.dateRange);
        }
    }

    query.timestamp = { $gte: fromDate, $lte: now };
  }

  return AuditLog.find(query)
    .populate({ path: 'actor_id', select: 'firstName lastName email', strictPopulate: false })
    .populate({ path: 'organization_id', select: 'name', strictPopulate: false })
    .sort({ timestamp: -1 })
    .limit(filters.limit || 100)
    .lean();
};

/**
 * Log a generic action (helper for one-off logs)
 */
export const logAction = async (action, entityType, entityId, entityName, user, req, summary, changes = null) => {
  const metadata = extractRequestMetadata(req);
  return await AuditLog.log({
    action,
    entity_type: entityType,
    entity_id: entityId,
    entity_name: entityName,
    actor_type: 'USER',
    actor_id: user._id || user.id,
    actor_email: user.email,
    actor_name: user.firstName ? `${user.firstName} ${user.lastName || ''}` : user.name,
    organization_id: user.organizationId || user.organization_id,
    change_summary: summary,
    changes,
    ...metadata,
  });
};

export default {
  extractRequestMetadata,
  getRetentionDays,
  logFormCreated,
  logFormUpdated,
  logFormPublished,
  logFormUnpublished,
  logFormArchived,
  logFormDeleted,
  logFormCloned,
  logFormAttached,
  logFormUnlinked,
  logFormSubmission,
  logExternalLinkGenerated,
  logFeatureFlagToggle,
  logLicenseChange,
  logCompanySuspension,
  logIntegrationChange,
  logNotificationTriggerUpdate,
  getSuperAdminAuditLogs,
  logLicensePlanCreated,
  logLicensePlanUpdated,
  logLicensePlanDeleted,
  logPlanFeaturesUpdated,
  logLicenseOverride,
  logTrialExtension,
  logLicenseSuspension,
  logOrgFeatureFlagToggle,
  logPasswordChange,
  logPasswordResetRequested,
  logPasswordResetSuccess,
  logLicensePurchase,
  logSystemConfigUpdate,
  logUserLogin,
  logUserLoginFailed,
  logRoleChange,
  logTaskDeletion,
  logTaskCreated,
  logTaskUpdated,
  logTaskStatusChanged,
  logUserInvitation,
  logUserStatusChange,
  logUserDeletion,
  logLicenseAssignment,
  logLicenseUnassignment,
  logAction,
};
