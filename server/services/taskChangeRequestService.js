import mongoose from "mongoose";
import Task from "../modals/taskModal.js";
import { User } from "../modals/userModal.js";
import { TaskChangeRequest, ChangeRequestStatus, ActionSource } from "../modals/taskChangeRequestModal.js";
import { ApprovalActionToken } from "../modals/approvalActionTokenModal.js";
import { NotificationService } from "./notificationService.js";
import { TriggerEvent, EntityType, NotificationPriority, ChannelType } from "../modals/notificationModal.js";
import { emailService } from "./emailService.js";
import { storage } from "../mongodb-storage.js";
import { ActivityHelper } from "../activity-helper.js";
import { AuditLog } from "../modals/auditLogModal.js";
import { getHighestPriorityRole } from "../utils/taskPermissions.js";

import { Organization } from "../modals/organizationModal.js";

/**
 * List of task fields that require manager/creator approval when modified by employees.
 * Extensible for future fields (e.g. title, description, estimatedTime, startDate).
 */
export const PROTECTED_TASK_FIELDS = [
  "dueDate",
  "status",
  "priority",
  "assignedTo",
];

export class TaskChangeRequestService {
  /**
   * Check if a field name is protected
   */
  static isProtectedField(fieldName) {
    return PROTECTED_TASK_FIELDS.includes(fieldName);
  }

  /**
   * Get the 4 independent task edit approval settings for the organization.
   * Section 2-4: Centralized configuration, all 4 default to false.
   */
  static async getOrganizationApprovalSettings(organizationId) {
    const defaultSettings = {
      dueDateApprovalEnabled: false,
      statusApprovalEnabled: false,
      priorityApprovalEnabled: false,
      assigneeApprovalEnabled: false,
      taskEditApprovalEnabled: false,
    };
    if (!organizationId) return defaultSettings;
    try {
      const org = await Organization.findById(organizationId).lean();
      if (!org) return defaultSettings;

      const dueDateApprovalEnabled = Boolean(
        org.dueDateApprovalEnabled ?? org.settings?.dueDateApprovalEnabled ?? false
      );
      const statusApprovalEnabled = Boolean(
        org.statusApprovalEnabled ?? org.settings?.statusApprovalEnabled ?? false
      );
      const priorityApprovalEnabled = Boolean(
        org.priorityApprovalEnabled ?? org.settings?.priorityApprovalEnabled ?? false
      );
      const assigneeApprovalEnabled = Boolean(
        org.assigneeApprovalEnabled ?? org.settings?.assigneeApprovalEnabled ?? false
      );

      const legacyEnabled = Boolean(
        org.taskEditApprovalEnabled ?? org.settings?.taskEditApprovalEnabled ?? false
      );

      const anyEnabled =
        dueDateApprovalEnabled ||
        statusApprovalEnabled ||
        priorityApprovalEnabled ||
        assigneeApprovalEnabled ||
        legacyEnabled;

      return {
        dueDateApprovalEnabled,
        statusApprovalEnabled,
        priorityApprovalEnabled,
        assigneeApprovalEnabled,
        taskEditApprovalEnabled: anyEnabled,
      };
    } catch (err) {
      console.error("⚠️ Error fetching organization task edit approval settings:", err);
      return defaultSettings;
    }
  }

  /**
   * Check whether any Task Edit Approval rule is enabled for the organization.
   */
  static async isOrganizationApprovalEnabled(organizationId) {
    const settings = await this.getOrganizationApprovalSettings(organizationId);
    return settings.taskEditApprovalEnabled;
  }

  /**
   * Check if a specific protected field requires approval under given organization settings
   */
  static isFieldApprovalRequired(field, orgSettings) {
    if (!orgSettings) return false;
    switch (field) {
      case "dueDate":
        return Boolean(orgSettings.dueDateApprovalEnabled);
      case "status":
        return Boolean(orgSettings.statusApprovalEnabled);
      case "priority":
        return Boolean(orgSettings.priorityApprovalEnabled);
      case "assignedTo":
        return Boolean(orgSettings.assigneeApprovalEnabled);
      default:
        return false;
    }
  }

  /**
   * Evaluate whether updates on a task require creator approval under organization settings.
   * Section 8 & 40: If ANY changed field requires approval, the entire edit requires approval.
   */
  static evaluateApprovalRequirement(task, updates, orgSettings) {
    const requestedChanges = {};
    let requiresApproval = false;
    let hasProtectedChanges = false;

    for (const field of PROTECTED_TASK_FIELDS) {
      if (updates[field] !== undefined) {
        const currentValue = task[field];
        const newValue = updates[field];

        if (!this.areValuesEqual(field, currentValue, newValue)) {
          hasProtectedChanges = true;
          requestedChanges[field] = {
            old: currentValue,
            new: newValue,
          };

          if (this.isFieldApprovalRequired(field, orgSettings)) {
            requiresApproval = true;
          }
        }
      }
    }

    return {
      hasProtectedChanges,
      requiresApproval,
      requestedChanges,
    };
  }

  /**
   * Update organization task edit approval settings (with permission check and audit logging).
   * Supports 4 independent toggles: dueDate, status, priority, assignee.
   * Section 5-6, 30: Only org_admin / admin / super_admin can change.
   */
  static async updateOrganizationApprovalSettings({ organizationId, settings = {}, enabled, user }) {
    if (!organizationId) throw new Error("organizationId is required");
    if (!user) throw new Error("User context is required");

    const userRole = getHighestPriorityRole(user.role);
    const adminRoles = [
      "super_admin",
      "super-admin",
      "tasksetu-admin",
      "org_admin",
      "company-admin",
      "admin",
    ];

    if (!adminRoles.includes(userRole)) {
      const err = new Error("You do not have permission to modify organization settings.");
      err.status = 403;
      throw err;
    }

    const org = await Organization.findById(organizationId);
    if (!org) {
      const err = new Error("Organization not found.");
      err.status = 404;
      throw err;
    }

    if (!org.settings) org.settings = {};

    const oldSettings = {
      dueDateApprovalEnabled: Boolean(
        org.dueDateApprovalEnabled ?? org.settings?.dueDateApprovalEnabled ?? false
      ),
      statusApprovalEnabled: Boolean(
        org.statusApprovalEnabled ?? org.settings?.statusApprovalEnabled ?? false
      ),
      priorityApprovalEnabled: Boolean(
        org.priorityApprovalEnabled ?? org.settings?.priorityApprovalEnabled ?? false
      ),
      assigneeApprovalEnabled: Boolean(
        org.assigneeApprovalEnabled ?? org.settings?.assigneeApprovalEnabled ?? false
      ),
    };

    const newSettings = { ...oldSettings };
    const changedFields = {};

    // Allow updating all toggles collectively or individually
    const fieldsToUpdate = [
      "dueDateApprovalEnabled",
      "statusApprovalEnabled",
      "priorityApprovalEnabled",
      "assigneeApprovalEnabled",
    ];

    // If legacy single `enabled` boolean is supplied, toggle all 4 toggles together
    if (enabled !== undefined) {
      const boolVal = Boolean(enabled);
      fieldsToUpdate.forEach((field) => {
        newSettings[field] = boolVal;
      });
    }

    // Merge individual toggles if provided in settings or root arguments
    fieldsToUpdate.forEach((field) => {
      const val = settings[field] !== undefined ? settings[field] : (settings.settings?.[field]);
      if (val !== undefined) {
        newSettings[field] = Boolean(val);
      }
    });

    fieldsToUpdate.forEach((field) => {
      if (oldSettings[field] !== newSettings[field]) {
        changedFields[field] = {
          old: oldSettings[field],
          new: newSettings[field],
        };
      }
      org[field] = newSettings[field];
      org.settings[field] = newSettings[field];
    });

    const anyEnabled =
      newSettings.dueDateApprovalEnabled ||
      newSettings.statusApprovalEnabled ||
      newSettings.priorityApprovalEnabled ||
      newSettings.assigneeApprovalEnabled;

    org.taskEditApprovalEnabled = anyEnabled;
    org.settings.taskEditApprovalEnabled = anyEnabled;
    org.markModified("settings");
    await org.save();

    // Audit log setting changes (Section 30)
    if (Object.keys(changedFields).length > 0) {
      try {
        const changesSummary = Object.entries(changedFields)
          .map(([k, v]) => `${k.replace("ApprovalEnabled", "")}: ${v.old ? "ON" : "OFF"} → ${v.new ? "ON" : "OFF"}`)
          .join(", ");

        await AuditLog.create({
          action: "ORGANIZATION_SETTING_UPDATED",
          entity_type: "ORGANIZATION",
          entity_id: org._id,
          entity_name: org.name,
          actor_id: user._id || user.id,
          actor_email: user.email,
          actor_name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
          source_ip: "127.0.0.1",
          organization_id: org._id,
          change_summary: `Task Edit Approval Settings Changed: ${changesSummary}`,
          changes: changedFields,
          metadata: {
            changedBy: user._id || user.id,
            setting: "taskEditApprovalSettings",
            taskEditApprovalEnabled: anyEnabled,
            oldValue: Boolean(oldSettings.dueDateApprovalEnabled || oldSettings.statusApprovalEnabled || oldSettings.priorityApprovalEnabled || oldSettings.assigneeApprovalEnabled),
            newValue: Boolean(anyEnabled),
            oldSettings,
            newSettings,
            timestamp: new Date(),
          },
        });
      } catch (auditErr) {
        console.error("⚠️ Failed to log organization setting audit:", auditErr);
      }
    }

    return {
      success: true,
      settings: newSettings,
      dueDateApprovalEnabled: newSettings.dueDateApprovalEnabled,
      statusApprovalEnabled: newSettings.statusApprovalEnabled,
      priorityApprovalEnabled: newSettings.priorityApprovalEnabled,
      assigneeApprovalEnabled: newSettings.assigneeApprovalEnabled,
      taskEditApprovalEnabled: anyEnabled,
      message: `Task Edit Approval settings have been updated for organization "${org.name}".`,
    };
  }

  /**
   * Backward-compatible alias for updateOrganizationApprovalSetting
   */
  static async updateOrganizationApprovalSetting(params) {
    return this.updateOrganizationApprovalSettings(params);
  }

  /**
   * Helper to format values for display
   */
  static formatValueForDisplay(field, val) {
    if (val === null || val === undefined || val === "") return "Not set";
    if (field === "dueDate" || field === "startDate") {
      try {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        }
      } catch (e) {}
    }
    return String(val);
  }

  /**
   * Normalizes values for comparison
   */
  static areValuesEqual(field, val1, val2) {
    if (val1 === val2) return true;
    if ((val1 === null || val1 === undefined || val1 === "") &&
        (val2 === null || val2 === undefined || val2 === "")) {
      return true;
    }

    if (field === "dueDate" || field === "startDate") {
      if (!val1 && !val2) return true;
      if (!val1 || !val2) return false;
      const t1 = new Date(val1).getTime();
      const t2 = new Date(val2).getTime();
      if (!isNaN(t1) && !isNaN(t2)) {
        if (t1 === t2 || Math.abs(t1 - t2) < 60000) return true;
        const iso1 = new Date(t1).toISOString().slice(0, 16);
        const iso2 = new Date(t2).toISOString().slice(0, 16);
        if (iso1 === iso2) return true;
      }
      return false;
    }

    if (field === "status" || field === "priority") {
      return String(val1 || "").trim().toUpperCase() === String(val2 || "").trim().toUpperCase();
    }

    if (field === "assignedTo") {
      const id1 = val1?._id?.toString() || val1?.toString() || "";
      const id2 = val2?._id?.toString() || val2?.toString() || "";
      return id1 === id2;
    }

    return String(val1 || "").trim() === String(val2 || "").trim();
  }

  /**
   * Detect changes in protected fields
   * @param {Object} task - Existing task document
   * @param {Object} updates - Update payload
   * @returns {{ hasProtectedChanges: boolean, requestedChanges: Object }}
   */
  static detectProtectedFieldChanges(task, updates) {
    const requestedChanges = {};
    let hasProtectedChanges = false;

    for (const field of PROTECTED_TASK_FIELDS) {
      if (updates[field] !== undefined) {
        const currentValue = task[field];
        const newValue = updates[field];

        if (!this.areValuesEqual(field, currentValue, newValue)) {
          hasProtectedChanges = true;
          requestedChanges[field] = {
            old: currentValue,
            new: newValue,
          };
        }
      }
    }

    return {
      hasProtectedChanges,
      requestedChanges,
    };
  }

  /**
   * Determine whether the user has direct modification authority over protected fields
   * Admins, Super Admins, Org Admins, and the Task Creator can modify directly.
   * Employees modifying tasks created by managers/others require approval.
   */
  static userHasDirectModificationPermission(user, task) {
    if (!user) return false;

    const userRole = getHighestPriorityRole(user.role);
    const adminRoles = [
      "super_admin",
      "super-admin",
      "tasksetu-admin",
      "org_admin",
      "company-admin",
      "admin",
    ];

    // Platform and Organization administrators can always update directly
    if (adminRoles.includes(userRole)) {
      return true;
    }

    const userId = (user.id || user._id)?.toString();
    const taskCreatedBy =
      task.createdBy?._id?.toString() || task.createdBy?.toString();

    // If the user created the task, they have direct control over it
    if (taskCreatedBy && userId && taskCreatedBy === userId) {
      return true;
    }

    // Otherwise (e.g. employee assigned to task, manager updating another manager's task without admin rights)
    return false;
  }

  /**
   * Create a Task Change Request and trigger both In-App and Email notifications
   */
  static async createChangeRequest({
    taskId,
    requestedChanges,
    reason = "",
    userId,
    userRole,
    requestedBy,
    orgId = null,
  }) {
    if (!taskId) throw new Error("taskId is required");
    if (!requestedChanges || Object.keys(requestedChanges).length === 0) {
      throw new Error("No protected field changes were requested");
    }

    const task = await Task.findById(taskId).populate("createdBy", "firstName lastName email").populate("assignedTo", "firstName lastName email");
    if (!task) {
      throw new Error("Task not found");
    }

    if (task.status === "DONE" || task.status === "COMPLETED") {
      throw new Error("Cannot request changes for a completed task");
    }

    const effectiveUserId = userId || requestedBy?._id || requestedBy?.id || requestedBy;
    let requester = null;
    if (requestedBy && typeof requestedBy === "object" && requestedBy.email) {
      requester = requestedBy;
    } else {
      requester = await User.findById(effectiveUserId);
    }

    if (!requester) {
      throw new Error("Requester user not found");
    }

    const requesterName = `${requester.firstName || ""} ${requester.lastName || ""}`.trim() || requester.email;

    // Determine approver (task creator or org admin)
    let approverId = task.createdBy?._id || task.createdBy;
    if (!approverId) {
      // Fallback: Find an org admin
      const adminUser = await User.findOne({
        organization_id: task.organization || orgId,
        role: { $in: ["org_admin", "company-admin", "admin"] },
      });
      approverId = adminUser?._id;
    }

    if (!approverId) {
      throw new Error("Unable to identify an authorized approver for this task");
    }

    const approver = await User.findById(approverId);
    if (!approver) {
      throw new Error("Approver user not found");
    }

    // Normalize requestedChanges to { [field]: { old, new } }
    const normalizedChanges = {};
    for (const [field, val] of Object.entries(requestedChanges)) {
      if (val && typeof val === "object" && ("new" in val || "old" in val)) {
        normalizedChanges[field] = {
          old: val.old !== undefined ? val.old : task[field],
          new: val.new,
        };
      } else {
        normalizedChanges[field] = {
          old: task[field],
          new: val,
        };
      }
    }

    // Check for existing pending request (Section 36: Prevent duplicate pending requests)
    let changeRequest = await TaskChangeRequest.findOne({
      taskId: task._id,
      requestedBy: requester._id,
      status: ChangeRequestStatus.PENDING,
    });

    if (changeRequest) {
      // Merge/update the existing pending request
      changeRequest.requestedChanges = {
        ...changeRequest.requestedChanges,
        ...normalizedChanges,
      };
      if (reason && reason.trim()) {
        changeRequest.reason = reason.trim();
      }
      changeRequest.approverId = approver._id;
      await changeRequest.save();
    } else {
      // Create new change request
      changeRequest = await TaskChangeRequest.create({
        taskId: task._id,
        requestedBy: requester._id,
        approverId: approver._id,
        organizationId: task.organization || orgId || requester.organization_id,
        status: ChangeRequestStatus.PENDING,
        requestedChanges: normalizedChanges,
        reason: (reason || "").trim(),
      });
    }

    // Generate secure one-time action token (24 hours expiry)
    const { rawToken, expiresAt } = await ApprovalActionToken.createToken(
      changeRequest._id,
      24
    );

    // 1. Channel 1: In-App Notification to approver
    try {
      const changesSummary = Object.keys(requestedChanges).join(", ");
      await NotificationService.createNotification({
        user_id: approver._id,
        trigger_event: TriggerEvent.TASK_CHANGE_REQUESTED,
        related_entity: {
          entity_type: EntityType.TASK_CHANGE_REQUEST,
          entity_id: changeRequest._id,
          entity_name: task.title,
        },
        title: `Task Change Request: ${task.title}`,
        message: `${requesterName} requested changes (${changesSummary}) for "${task.title}". Reason: ${reason || "No reason specified."}`,
        priority: NotificationPriority.URGENT,
        channels: [ChannelType.IN_APP],
        metadata: {
          changeRequestId: changeRequest._id,
          taskId: task._id,
          taskTitle: task.title,
          requestedBy: requester._id,
          requestedByName: requesterName,
          requestedChanges,
          employeeReason: reason,
        },
      });
    } catch (notifErr) {
      console.error("⚠️ Failed to create in-app notification for change request:", notifErr);
    }

    // 2. Channel 2: Email Notification to approver with secure one-time token link
    try {
      await this.sendChangeRequestEmail({
        approver,
        requesterName,
        task,
        requestedChanges,
        reason,
        rawToken,
        expiresAt,
      });
    } catch (emailErr) {
      console.error("⚠️ Failed to send change request email:", emailErr);
    }

    // Log Activity
    try {
      await ActivityHelper.logActivity({
        type: ActivityHelper.ACTIVITY_TYPES.CHANGE_REQUEST_CREATED.type,
        activityType: ActivityHelper.ACTIVITY_TYPES.CHANGE_REQUEST_CREATED,
        user: requester._id,
        organization: task.organization || orgId,
        taskId: task._id,
        relatedType: "task",
        data: {
          taskTitle: task.title,
          userName: requesterName,
          changes: requestedChanges,
          reason,
          changeRequestId: changeRequest._id,
        },
      });
    } catch (actErr) {
      console.error("⚠️ Failed to log change request activity:", actErr);
    }

    // Log Audit
    try {
      await AuditLog.create({
        action: "CHANGE_REQUEST_CREATED",
        entity_type: "TASK_CHANGE_REQUEST",
        entity_id: changeRequest._id,
        entity_name: task.title,
        actor_id: requester._id,
        actor_email: requester.email,
        actor_name: requesterName,
        source_ip: "127.0.0.1",
        organization_id: task.organization || orgId,
        change_summary: `Change request created for task "${task.title}"`,
        changes: requestedChanges,
        metadata: {
          taskId: task._id,
          reason,
          approverId: approver._id,
        },
      });
    } catch (auditErr) {
      console.error("⚠️ Failed to log change request audit:", auditErr);
    }

    return {
      success: true,
      requiresApproval: true,
      changeRequest,
      token: rawToken,
      data: {
        changeRequestId: changeRequest._id,
        actionToken: rawToken,
      },
    };
  }

  /**
   * Helper to format changes table for email and UI
   */
  static renderChangesHtml(requestedChanges) {
    const fieldLabels = {
      dueDate: "Due Date",
      status: "Status",
      priority: "Priority",
      assignedTo: "Assignee",
    };

    let rowsHtml = "";
    for (const [field, change] of Object.entries(requestedChanges)) {
      const label = fieldLabels[field] || field;
      const oldVal = this.formatValueForDisplay(field, change.old);
      const newVal = this.formatValueForDisplay(field, change.new);

      rowsHtml += `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 12px; font-weight: 600; color: #374151;">${label}</td>
          <td style="padding: 10px 12px; color: #6b7280; text-decoration: line-through;">${oldVal}</td>
          <td style="padding: 10px 12px; color: #059669; font-weight: 600;">${newVal}</td>
        </tr>
      `;
    }

    return `
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; font-size: 14px;">
        <thead>
          <tr style="background-color: #f9fafb; border-bottom: 2px solid #e5e7eb; text-align: left;">
            <th style="padding: 10px 12px; color: #4b5563;">Field</th>
            <th style="padding: 10px 12px; color: #4b5563;">Current Value</th>
            <th style="padding: 10px 12px; color: #4b5563;">Requested Value</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;
  }

  /**
   * Send Task Change Request email to approver
   */
  static async sendChangeRequestEmail({
    approver,
    requesterName,
    task,
    requestedChanges,
    reason,
    rawToken,
    expiresAt,
  }) {
    const isLocal = process.env.NODE_ENV === "development";
    const baseUrl = isLocal
      ? process.env.LOCAL_BASE_URL || "http://localhost:5000"
      : process.env.PRODUCTION_BASE_URL || "http://localhost:5000";

    const actionUrl = `${baseUrl}/task-change-action?token=${rawToken}`;
    const changesTable = this.renderChangesHtml(requestedChanges);

    const subject = `Task Change Request: ${task.title}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Task Change Request</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6; }
          .container { max-width: 600px; margin: 24px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
          .header { background: #1e3a8a; color: white; padding: 24px; text-align: center; }
          .content { padding: 24px 30px; }
          .button { background-color: #2563eb; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 15px; letter-spacing: 0.5px; }
          .reason-box { background-color: #f9fafb; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0; border-radius: 4px; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; padding: 16px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 22px;">TaskSetu</h1>
            <p style="margin: 4px 0 0 0; opacity: 0.9; font-size: 14px;">Task Change Approval Request</p>
          </div>
          <div class="content">
            <h2 style="margin-top: 0; font-size: 18px; color: #111827;">Hello ${approver.firstName || "Manager"},</h2>
            <p><strong>${requesterName}</strong> has requested modifications to a protected task:</p>
            
            <div style="background-color: #eff6ff; padding: 12px 16px; border-radius: 6px; margin-bottom: 16px;">
              <span style="font-size: 12px; text-transform: uppercase; color: #1e40af; font-weight: 700;">Task</span>
              <div style="font-size: 16px; font-weight: 600; color: #1e3a8a;">${task.title}</div>
            </div>

            <h3 style="font-size: 15px; margin-bottom: 8px; color: #374151;">Requested Changes:</h3>
            ${changesTable}

            <div class="reason-box">
              <strong style="color: #1f2937;">Employee's Reason:</strong>
              <p style="margin: 4px 0 0 0; color: #4b5563; font-style: italic;">
                "${reason ? reason : "No reason provided."}"
              </p>
            </div>

            <p style="margin: 20px 0 10px 0; color: #4b5563;">
              Review the requested changes and decide whether to approve or reject them:
            </p>

            <div style="text-align: center; margin: 28px 0;">
              <a href="${actionUrl}" class="button">
                TAKE ACTION
              </a>
            </div>

            <p style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 20px;">
              ⏱️ This link is single-use and will expire in 24 hours. A mandatory reason is required to approve or reject.
            </p>
          </div>
          <div class="footer">
            <p style="margin: 0;">TaskSetu Task Management &bull; Automated Notification</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return emailService.sendEmail({
      to: approver.email,
      subject,
      html,
      text: `${requesterName} requested changes for task "${task.title}". Reason: ${reason}. Review and take action at: ${actionUrl}`,
    });
  }

  /**
   * Check for conflicts between requested changes and current task state
   * Section 29: Stale request / conflict detection
   */
  static checkConflict(changeRequest, currentTask) {
    const conflictingFields = [];

    for (const [field, change] of Object.entries(changeRequest.requestedChanges || {})) {
      const currentTaskVal = currentTask[field];
      const expectedOldVal = change.old;

      // 1. If the current task already matches the requested new value, there is no conflict
      if (this.areValuesEqual(field, change.new, currentTaskVal)) {
        continue;
      }

      // 2. If the current task value differs from the expected old value
      // (and does not match the requested new value), that is a conflict
      if (!this.areValuesEqual(field, expectedOldVal, currentTaskVal)) {
        conflictingFields.push({
          field,
          requestedOld: expectedOldVal,
          requestedNew: change.new,
          currentTaskValue: currentTaskVal,
        });
      }
    }

    return {
      hasConflict: conflictingFields.length > 0,
      conflictingFields,
    };
  }

  /**
   * Verify secure email action token and fetch associated request
   */
  static async verifyActionToken(rawToken) {
    if (!rawToken || !rawToken.trim()) {
      return {
        valid: false,
        state: "INVALID_TOKEN",
        message: "This approval link is invalid.",
      };
    }

    const tokenHash = ApprovalActionToken.hashToken(rawToken);
    const tokenDoc = await ApprovalActionToken.findOne({ tokenHash });

    if (!tokenDoc) {
      return {
        valid: false,
        state: "INVALID_TOKEN",
        message: "This approval link is invalid.",
      };
    }

    if (tokenDoc.usedAt) {
      return {
        valid: false,
        state: "USED_TOKEN",
        message: "This approval link has already been used.",
      };
    }

    if (tokenDoc.expiresAt < new Date()) {
      return {
        valid: false,
        state: "EXPIRED_TOKEN",
        message: "This approval link has expired. Please open TaskSetu to review the request.",
      };
    }

    const changeRequest = await TaskChangeRequest.findById(tokenDoc.requestId)
      .populate("taskId")
      .populate("requestedBy", "firstName lastName email")
      .populate("approverId", "firstName lastName email");

    if (!changeRequest) {
      return {
        valid: false,
        state: "INVALID_TOKEN",
        message: "Task change request not found.",
      };
    }

    if (changeRequest.status === ChangeRequestStatus.APPROVED) {
      return {
        valid: false,
        state: "ALREADY_APPROVED",
        message: "This task change request has already been approved.",
        changeRequest,
      };
    }

    if (changeRequest.status === ChangeRequestStatus.REJECTED) {
      return {
        valid: false,
        state: "ALREADY_REJECTED",
        message: "This task change request has already been rejected.",
        changeRequest,
      };
    }

    // Check conflict against current task values
    const task = await Task.findById(changeRequest.taskId._id || changeRequest.taskId);
    if (!task) {
      return {
        valid: false,
        state: "INVALID_TOKEN",
        message: "Associated task no longer exists.",
      };
    }

    const { hasConflict, conflictingFields } = this.checkConflict(changeRequest, task);
    if (hasConflict) {
      return {
        valid: true,
        hasConflict: true,
        state: "CONFLICT",
        message: "This task has changed since the request was submitted. Please review the task before taking action.",
        conflictingFields,
        changeRequest,
        task,
      };
    }

    return {
      valid: true,
      hasConflict: false,
      state: "PENDING",
      changeRequest,
      request: changeRequest,
      task,
      tokenDoc,
    };
  }

  /**
   * Common Approval Logic
   * Used by both Email and In-App channels. Single source of truth.
   */
  static async approveChangeRequest({
    requestId,
    approverId,
    approverReason,
    actionSource = ActionSource.IN_APP,
    rawToken = null,
    confirmConflict = false,
  }) {
    // 1. Mandatory Reason Validation (Backend enforcement)
    const cleanedReason = (approverReason || "").trim();
    if (!cleanedReason) {
      const error = new Error("Approval reason is required.");
      error.status = 400;
      throw error;
    }

    // 2. Fetch Request
    const changeRequest = await TaskChangeRequest.findById(requestId)
      .populate("requestedBy", "firstName lastName email")
      .populate("approverId", "firstName lastName email");

    if (!changeRequest) {
      const error = new Error("Task change request not found.");
      error.status = 404;
      throw error;
    }

    // 3. State Check
    if (changeRequest.status === ChangeRequestStatus.APPROVED) {
      const error = new Error("This task change request has already been approved.");
      error.status = 400;
      throw error;
    }

    if (changeRequest.status === ChangeRequestStatus.REJECTED) {
      const error = new Error("This task change request has already been rejected.");
      error.status = 400;
      throw error;
    }

    // 4. Token validation if via Email
    let tokenDoc = null;
    if (rawToken) {
      const tokenHash = ApprovalActionToken.hashToken(rawToken);
      tokenDoc = await ApprovalActionToken.findOne({
        requestId: changeRequest._id,
        tokenHash,
      });

      if (!tokenDoc) {
        const error = new Error("This approval link is invalid.");
        error.status = 400;
        throw error;
      }

      if (tokenDoc.usedAt) {
        const error = new Error("This approval link has already been used.");
        error.status = 400;
        throw error;
      }

      if (tokenDoc.expiresAt < new Date()) {
        const error = new Error("This approval link has expired.");
        error.status = 400;
        throw error;
      }

      // If approverId was not passed explicitly (email guest action), use request approver
      if (!approverId) {
        approverId = changeRequest.approverId._id || changeRequest.approverId;
      }
    }

    // 5. Fetch Fresh Task & Check Conflict
    const task = await Task.findById(changeRequest.taskId);
    if (!task) {
      const error = new Error("Associated task not found.");
      error.status = 404;
      throw error;
    }

    // Verify authority to approve (requester cannot approve own request; only creator, approver, or admin)
    if (actionSource === ActionSource.IN_APP && approverId) {
      const requesterId = String(changeRequest.requestedBy?._id || changeRequest.requestedBy || "");
      if (requesterId && requesterId === String(approverId)) {
        const error = new Error("Requesters are not permitted to approve their own change request.");
        error.status = 403;
        throw error;
      }

      const taskCreatorId = String(task.createdBy?._id || task.createdBy || "");
      const assignedApproverId = String(changeRequest.approverId?._id || changeRequest.approverId || "");
      const currentApproverIdStr = String(approverId);

      const isCreatorOrDesignatedApprover =
        (currentApproverIdStr && assignedApproverId && currentApproverIdStr === assignedApproverId) ||
        (currentApproverIdStr && taskCreatorId && currentApproverIdStr === taskCreatorId);

      if (!isCreatorOrDesignatedApprover) {
        const approverUser = await User.findById(approverId).lean();
        const adminRoles = ["super_admin", "super-admin", "tasksetu-admin", "org_admin", "company-admin", "admin"];
        const approverRole = approverUser ? getHighestPriorityRole(approverUser.role) : "";
        if (!adminRoles.includes(approverRole)) {
          const error = new Error("Only the task creator or an organization administrator can approve this request.");
          error.status = 403;
          throw error;
        }
      }
    }

    const { hasConflict, conflictingFields } = this.checkConflict(changeRequest, task);
    if (hasConflict && !confirmConflict) {
      changeRequest.status = ChangeRequestStatus.CONFLICT;
      changeRequest.conflictDetails = conflictingFields;
      await changeRequest.save();

      // Log conflict audit
      try {
        await AuditLog.create({
          action: "CHANGE_REQUEST_CONFLICT",
          entity_type: "TASK_CHANGE_REQUEST",
          entity_id: changeRequest._id,
          entity_name: task.title,
          actor_id: approverId,
          source_ip: "127.0.0.1",
          organization_id: changeRequest.organizationId,
          change_summary: `Conflict detected while approving change request for "${task.title}"`,
          changes: conflictingFields,
        });
      } catch (e) {}

      const error = new Error(
        "This task has changed since the request was submitted. Please review the current task before taking action."
      );
      error.status = 409;
      error.conflictDetails = conflictingFields;
      throw error;
    }

    // 6. Apply Changes to Task
    const updatesToApply = {};
    for (const [field, change] of Object.entries(changeRequest.requestedChanges || {})) {
      if ((field === "dueDate" || field === "startDate") && change.new) {
        const d = new Date(change.new);
        updatesToApply[field] = !isNaN(d.getTime()) ? d : change.new;
      } else {
        updatesToApply[field] = change.new;
      }
    }

    const updatedTask = await storage.updateTask(task._id, updatesToApply, approverId);

    // 7. Update TaskChangeRequest state
    changeRequest.status = ChangeRequestStatus.APPROVED;
    changeRequest.approverReason = cleanedReason;
    changeRequest.reviewedBy = approverId;
    changeRequest.reviewedAt = new Date();
    changeRequest.actionSource = actionSource;
    await changeRequest.save();

    // 8. Consume Token
    if (tokenDoc) {
      tokenDoc.usedAt = new Date();
      await tokenDoc.save();
    } else {
      // If approved in-app, mark any open action tokens for this request as used
      await ApprovalActionToken.updateMany(
        { requestId: changeRequest._id, usedAt: null },
        { usedAt: new Date() }
      );
    }

    // 9. Mark Approver's In-App Notification as Read
    try {
      await mongoose.model("Notification").updateMany(
        {
          user_id: approverId,
          "related_entity.entity_id": changeRequest._id,
          is_read: false,
        },
        { is_read: true, read_at: new Date() }
      );
    } catch (e) {}

    // 10. Audit Logging
    const approverUser = await User.findById(approverId);
    const approverName = approverUser
      ? `${approverUser.firstName || ""} ${approverUser.lastName || ""}`.trim() || approverUser.email
      : "Manager";

    try {
      await ActivityHelper.logActivity({
        type: ActivityHelper.ACTIVITY_TYPES.CHANGE_REQUEST_APPROVED.type,
        activityType: ActivityHelper.ACTIVITY_TYPES.CHANGE_REQUEST_APPROVED,
        user: approverId,
        organization: changeRequest.organizationId,
        taskId: task._id,
        relatedType: "task",
        data: {
          taskTitle: task.title,
          userName: approverName,
          approverReason: cleanedReason,
          actionSource,
          changes: changeRequest.requestedChanges,
          changeRequestId: changeRequest._id,
        },
      });

      await AuditLog.create({
        action: "CHANGE_REQUEST_APPROVED",
        entity_type: "TASK_CHANGE_REQUEST",
        entity_id: changeRequest._id,
        entity_name: task.title,
        actor_id: approverId,
        actor_name: approverName,
        source_ip: "127.0.0.1",
        organization_id: changeRequest.organizationId,
        change_summary: `Change request approved for task "${task.title}"`,
        changes: changeRequest.requestedChanges,
        metadata: {
          approverReason: cleanedReason,
          actionSource,
          taskId: task._id,
        },
      });
    } catch (e) {
      console.error("⚠️ Failed to log approval audit:", e);
    }

    // 11. Notify Employee (Section 26)
    try {
      await this.notifyEmployeeOfDecision({
        decision: "APPROVED",
        changeRequest,
        task: updatedTask || task,
        approverName,
        approverReason: cleanedReason,
      });
    } catch (notifErr) {
      console.error("⚠️ Failed to notify employee of approval:", notifErr);
    }

    return {
      success: true,
      message: "Task changes have been approved and applied successfully.",
      changeRequest,
      task: updatedTask,
    };
  }

  /**
   * Common Rejection Logic
   * Used by both Email and In-App channels. Single source of truth.
   */
  static async rejectChangeRequest({
    requestId,
    approverId,
    approverReason,
    actionSource = ActionSource.IN_APP,
    rawToken = null,
  }) {
    // 1. Mandatory Reason Validation (Backend enforcement)
    const cleanedReason = (approverReason || "").trim();
    if (!cleanedReason) {
      const error = new Error("Rejection reason is required.");
      error.status = 400;
      throw error;
    }

    // 2. Fetch Request
    const changeRequest = await TaskChangeRequest.findById(requestId)
      .populate("requestedBy", "firstName lastName email")
      .populate("approverId", "firstName lastName email");

    if (!changeRequest) {
      const error = new Error("Task change request not found.");
      error.status = 404;
      throw error;
    }

    // 3. State Check
    if (changeRequest.status === ChangeRequestStatus.APPROVED) {
      const error = new Error("This task change request has already been approved.");
      error.status = 400;
      throw error;
    }

    if (changeRequest.status === ChangeRequestStatus.REJECTED) {
      const error = new Error("This task change request has already been rejected.");
      error.status = 400;
      throw error;
    }

    // 4. Token validation if via Email
    let tokenDoc = null;
    if (rawToken) {
      const tokenHash = ApprovalActionToken.hashToken(rawToken);
      tokenDoc = await ApprovalActionToken.findOne({
        requestId: changeRequest._id,
        tokenHash,
      });

      if (!tokenDoc) {
        const error = new Error("This approval link is invalid.");
        error.status = 400;
        throw error;
      }

      if (tokenDoc.usedAt) {
        const error = new Error("This approval link has already been used.");
        error.status = 400;
        throw error;
      }

      if (tokenDoc.expiresAt < new Date()) {
        const error = new Error("This approval link has expired.");
        error.status = 400;
        throw error;
      }

      if (!approverId) {
        approverId = changeRequest.approverId._id || changeRequest.approverId;
      }
    }

    const task = await Task.findById(changeRequest.taskId);
    if (!task) {
      const error = new Error("Associated task not found.");
      error.status = 404;
      throw error;
    }

    // Verify authority to reject (requester cannot reject own request; only creator, approver, or admin)
    if (actionSource === ActionSource.IN_APP && approverId) {
      const requesterId = String(changeRequest.requestedBy?._id || changeRequest.requestedBy || "");
      if (requesterId && requesterId === String(approverId)) {
        const error = new Error("Requesters are not permitted to reject their own change request.");
        error.status = 403;
        throw error;
      }

      const taskCreatorId = String(task.createdBy?._id || task.createdBy || "");
      const assignedApproverId = String(changeRequest.approverId?._id || changeRequest.approverId || "");
      const currentApproverIdStr = String(approverId);

      const isCreatorOrDesignatedApprover =
        (currentApproverIdStr && assignedApproverId && currentApproverIdStr === assignedApproverId) ||
        (currentApproverIdStr && taskCreatorId && currentApproverIdStr === taskCreatorId);

      if (!isCreatorOrDesignatedApprover) {
        const approverUser = await User.findById(approverId).lean();
        const adminRoles = ["super_admin", "super-admin", "tasksetu-admin", "org_admin", "company-admin", "admin"];
        const approverRole = approverUser ? getHighestPriorityRole(approverUser.role) : "";
        if (!adminRoles.includes(approverRole)) {
          const error = new Error("Only the task creator or an organization administrator can reject this request.");
          error.status = 403;
          throw error;
        }
      }
    }

    // 5. Update TaskChangeRequest state - Task is NOT modified
    changeRequest.status = ChangeRequestStatus.REJECTED;
    changeRequest.approverReason = cleanedReason;
    changeRequest.reviewedBy = approverId;
    changeRequest.reviewedAt = new Date();
    changeRequest.actionSource = actionSource;
    await changeRequest.save();

    // 6. Consume Token
    if (tokenDoc) {
      tokenDoc.usedAt = new Date();
      await tokenDoc.save();
    } else {
      await ApprovalActionToken.updateMany(
        { requestId: changeRequest._id, usedAt: null },
        { usedAt: new Date() }
      );
    }

    // 7. Mark Approver's In-App Notification as Read
    try {
      await mongoose.model("Notification").updateMany(
        {
          user_id: approverId,
          "related_entity.entity_id": changeRequest._id,
          is_read: false,
        },
        { is_read: true, read_at: new Date() }
      );
    } catch (e) {}

    // 8. Audit Logging
    const approverUser = await User.findById(approverId);
    const approverName = approverUser
      ? `${approverUser.firstName || ""} ${approverUser.lastName || ""}`.trim() || approverUser.email
      : "Manager";

    try {
      await ActivityHelper.logActivity({
        type: ActivityHelper.ACTIVITY_TYPES.CHANGE_REQUEST_REJECTED.type,
        activityType: ActivityHelper.ACTIVITY_TYPES.CHANGE_REQUEST_REJECTED,
        user: approverId,
        organization: changeRequest.organizationId,
        taskId: task?._id || changeRequest.taskId,
        relatedType: "task",
        data: {
          taskTitle: task?.title || "Task",
          userName: approverName,
          approverReason: cleanedReason,
          actionSource,
          changeRequestId: changeRequest._id,
        },
      });

      await AuditLog.create({
        action: "CHANGE_REQUEST_REJECTED",
        entity_type: "TASK_CHANGE_REQUEST",
        entity_id: changeRequest._id,
        entity_name: task?.title || "Task",
        actor_id: approverId,
        actor_name: approverName,
        source_ip: "127.0.0.1",
        organization_id: changeRequest.organizationId,
        change_summary: `Change request rejected for task "${task?.title || "Task"}"`,
        metadata: {
          approverReason: cleanedReason,
          actionSource,
          taskId: task?._id || changeRequest.taskId,
        },
      });
    } catch (e) {
      console.error("⚠️ Failed to log rejection audit:", e);
    }

    // 9. Notify Employee (Section 26)
    try {
      await this.notifyEmployeeOfDecision({
        decision: "REJECTED",
        changeRequest,
        task: task || { title: "Task" },
        approverName,
        approverReason: cleanedReason,
      });
    } catch (notifErr) {
      console.error("⚠️ Failed to notify employee of rejection:", notifErr);
    }

    return {
      success: true,
      message: "Task change request rejected.",
      changeRequest,
    };
  }

  /**
   * Notify employee after decision has been made
   * Section 26: In-App and Email notifications
   */
  static async notifyEmployeeOfDecision({
    decision,
    changeRequest,
    task,
    approverName,
    approverReason,
  }) {
    const employeeId = changeRequest.requestedBy._id || changeRequest.requestedBy;
    const employee = await User.findById(employeeId);
    if (!employee) return;

    const isApproved = decision === "APPROVED";
    const title = isApproved
      ? `Task Change Request Approved: ${task.title}`
      : `Task Change Request Rejected: ${task.title}`;

    const message = isApproved
      ? `Your requested changes for "${task.title}" have been approved by ${approverName}. Reason: "${approverReason}"`
      : `Your requested changes for "${task.title}" have been rejected by ${approverName}. Reason: "${approverReason}"`;

    // In-App Notification
    try {
      await NotificationService.createNotification({
        user_id: employee._id,
        trigger_event: isApproved
          ? TriggerEvent.TASK_CHANGE_APPROVED
          : TriggerEvent.TASK_CHANGE_REJECTED,
        related_entity: {
          entity_type: EntityType.TASK,
          entity_id: task._id || changeRequest.taskId,
          entity_name: task.title,
        },
        title,
        message,
        priority: NotificationPriority.NORMAL,
        channels: [ChannelType.IN_APP],
        metadata: {
          changeRequestId: changeRequest._id,
          decision,
          approverReason,
          approverName,
          taskId: task._id || changeRequest.taskId,
        },
      });
    } catch (e) {
      console.error("⚠️ Failed to send in-app notification to employee:", e);
    }

    // Email Notification
    try {
      const changesTable = this.renderChangesHtml(changeRequest.requestedChanges);
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; background: #f3f4f6; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 24px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
            .header { background: ${isApproved ? "#059669" : "#dc2626"}; color: white; padding: 24px; text-align: center; }
            .content { padding: 24px 30px; }
            .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-weight: 700; font-size: 13px; text-transform: uppercase; background: ${isApproved ? "#d1fae5" : "#fee2e2"}; color: ${isApproved ? "#065f46" : "#991b1b"}; }
            .box { background-color: #f9fafb; border-left: 4px solid ${isApproved ? "#10b981" : "#ef4444"}; padding: 12px 16px; margin: 16px 0; border-radius: 4px; }
            .footer { text-align: center; color: #6b7280; font-size: 12px; padding: 16px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 20px;">TaskSetu</h1>
              <p style="margin: 4px 0 0 0; opacity: 0.9; font-size: 14px;">Task Change Request Update</p>
            </div>
            <div class="content">
              <div style="margin-bottom: 16px;">
                <span class="badge">${decision}</span>
              </div>
              <h2 style="margin-top: 0; font-size: 18px; color: #111827;">Hello ${employee.firstName || "Team Member"},</h2>
              <p>Your requested changes to <strong>"${task.title}"</strong> have been <strong>${decision.toLowerCase()}</strong> by ${approverName}.</p>

              <div class="box">
                <strong>Approver Reason:</strong>
                <p style="margin: 4px 0 0 0; color: #4b5563; font-style: italic;">
                  "${approverReason}"
                </p>
              </div>

              <h3 style="font-size: 15px; margin-bottom: 8px; color: #374151;">Requested Changes:</h3>
              ${changesTable}
            </div>
            <div class="footer">
              <p style="margin: 0;">TaskSetu Task Management &bull; Automated Notification</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await emailService.sendEmail({
        to: employee.email,
        subject: title,
        html: emailHtml,
        text: message,
      });
    } catch (emailErr) {
      console.error("⚠️ Failed to send decision email to employee:", emailErr);
    }
  }

  /**
   * Get pending change request for a specific task
   */
  static async getPendingRequestForTask(taskId) {
    if (!taskId) return null;
    return TaskChangeRequest.findOne({
      taskId,
      status: ChangeRequestStatus.PENDING,
    })
      .populate("requestedBy", "firstName lastName email")
      .populate("approverId", "firstName lastName email");
  }

  /**
   * Get change request by ID with populated references
   */
  static async getChangeRequestById(requestId) {
    if (!requestId) return null;
    const request = await TaskChangeRequest.findById(requestId)
      .populate("taskId")
      .populate("requestedBy", "firstName lastName email")
      .populate("approverId", "firstName lastName email")
      .populate("reviewedBy", "firstName lastName email");

    if (!request) return null;

    // Dynamically check conflict if still pending or marked in conflict
    let hasConflict = false;
    let conflictingFields = [];

    if (
      (request.status === ChangeRequestStatus.PENDING ||
       request.status === ChangeRequestStatus.CONFLICT) &&
      request.taskId
    ) {
      const conflictCheck = this.checkConflict(request, request.taskId);
      hasConflict = conflictCheck.hasConflict;
      conflictingFields = conflictCheck.conflictingFields;

      // If a request previously marked CONFLICT no longer has conflict, reset status to PENDING
      if (!hasConflict && request.status === ChangeRequestStatus.CONFLICT) {
        request.status = ChangeRequestStatus.PENDING;
        request.conflictDetails = [];
        await TaskChangeRequest.findByIdAndUpdate(request._id, {
          status: ChangeRequestStatus.PENDING,
          conflictDetails: [],
        });
      }
    }

    return {
      request,
      hasConflict,
      conflictingFields,
    };
  }
}

export default TaskChangeRequestService;
