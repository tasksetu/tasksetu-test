import mongoose from 'mongoose';

/**
 * Audit Log Schema
 * Tracks all form-related actions for compliance and security
 * Spec: Section 5.12 - Activity/Audit Logging & Compliance
 * Phase I: No workflow triggers, only action logging
 */

const auditLogSchema = new mongoose.Schema(
  {
    // Action information
    action: {
      type: String,
      required: true,
      enum: [
        // Form template actions
        'FORM_CREATED',
        'FORM_UPDATED',
        'FORM_PUBLISHED',
        'FORM_UNPUBLISHED',
        'FORM_ARCHIVED',
        'FORM_DELETED',
        'FORM_CLONED',

        // Form sharing actions
        'FORM_SHARED',
        'FORM_UNSHARED',

        // Form attachment actions (Phase I)
        'FORM_ATTACHED_TO_SUBTASK',
        'FORM_UNLINKED_FROM_SUBTASK',

        // Form submission actions
        'FORM_SUBMITTED',
        'FORM_SUBMISSION_DELETED',

        // External submission actions
        'EXTERNAL_LINK_GENERATED',
        'EXTERNAL_LINK_EXPIRED',

        // Super Admin License Control actions
        'LICENSE_OVERRIDE',
        'TRIAL_EXTENDED',
        'LICENSE_SUSPENDED',
        'LICENSE_REACTIVATED',
        'LICENSE_PLAN_CREATED',
        'LICENSE_PLAN_UPDATED',
        'LICENSE_PLAN_DELETED',
        'PLAN_FEATURES_UPDATED',
        'FEATURE_FLAG_CHANGED',
        'COMPANY_SUSPENDED',
        'COMPANY_ACTIVATED',
        'SYSTEM_CONFIG_UPDATED',
        'INTEGRATION_UPDATED',
        'NOTIFICATION_CONFIG_UPDATED',

        // User & Security Actions
        'USER_LOGIN',
        'USER_LOGOUT',
        'USER_LOGIN_FAILED',
        'PASSWORD_CHANGED',
        'PASSWORD_RESET_REQUESTED',
        'PASSWORD_RESET_SUCCESS',
        'ROLE_CHANGED',

        // Resource Actions
        'TASK_CREATED',
        'TASK_UPDATED',
        'TASK_DELETED',
        'TASK_ASSIGNED',
        'TASK_STATUS_CHANGED',
        'LICENSE_ASSIGNED',
        'LICENSE_UNASSIGNED',
        'LICENSE_PURCHASED',
        'LICENSE_RENEWED',

        // Invitation actions
        'USER_INVITED',
        'USER_ACTIVATED',
        'USER_DEACTIVATED',
        'USER_DELETED',

        // Organization actions
        'ORG_BRANDING_UPDATED',
        'ORG_PROFILE_UPDATED',

        // Phase II actions (for future - not implemented yet)
        // 'WORKFLOW_TRIGGERED',
        // 'APPROVAL_REQUESTED',
        // 'WEBHOOK_CALLED',
      ],
      index: true,
    },

    // Entity being acted upon
    entity_type: {
      type: String,
      required: true,
      enum: [
        'FORM_TEMPLATE',
        'FORM_VERSION',
        'FORM_SUBMISSION',
        'FORM_USAGE',
        'ORGANIZATION_SUBSCRIPTION',
        'ORGANIZATION',
        'USER',
        'TASK',
        'LICENSE_POOL',
        'SYSTEM',
      ],
      index: true,
    },

    entity_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    entity_name: {
      type: String,
      default: null,
    },

    // Actor (who performed the action)
    actor_type: {
      type: String,
      required: true,
      enum: ['USER', 'SYSTEM', 'EXTERNAL', 'API'],
      default: 'USER',
    },

    actor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // Null for anonymous/external submissions
      index: true,
    },

    actor_email: {
      type: String,
      default: null,
    },

    actor_name: {
      type: String,
      default: null,
    },

    // Request metadata
    source_ip: {
      type: String,
      required: true,
      index: true,
    },

    user_agent: {
      type: String,
      default: null,
    },

    request_id: {
      type: String,
      default: null,
    },

    // Organization context
    organization_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true,
    },

    // Change details
    change_summary: {
      type: String,
      default: null,
    },

    // Detailed change data (before/after)
    changes: {
      type: Object,
      default: null,
    },

    // Additional metadata
    metadata: {
      type: Object,
      default: {},
    },

    // Timestamp
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },

    // Retention management
    retention_until: {
      type: Date,
      default: null,
      index: true,
    },

    is_archived: {
      type: Boolean,
      default: false,
      index: true,
    },

    archived_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ entity_id: 1, timestamp: -1 });
auditLogSchema.index({ actor_id: 1, timestamp: -1 });
auditLogSchema.index({ organization_id: 1, timestamp: -1 });
auditLogSchema.index({ retention_until: 1, is_archived: 1 });

// Static method to create audit log entry
auditLogSchema.statics.log = async function (logData) {
  try {
    const {
      action,
      entity_type,
      entity_id,
      entity_name = null,
      actor_type = 'USER',
      actor_id = null,
      actor_email = null,
      actor_name = null,
      source_ip,
      user_agent = null,
      request_id = null,
      organization_id = null,
      change_summary = null,
      changes = null,
      metadata = {},
      retention_days = null,
    } = logData;

    // Calculate retention date based on org policy or default
    let retention_until = null;
    if (retention_days) {
      retention_until = new Date();
      retention_until.setDate(retention_until.getDate() + retention_days);
    }

    const auditLog = new this({
      action,
      entity_type,
      entity_id,
      entity_name,
      actor_type,
      actor_id,
      actor_email,
      actor_name,
      source_ip,
      user_agent,
      request_id,
      organization_id,
      change_summary,
      changes,
      metadata,
      retention_until,
      timestamp: new Date(),
    });

    await auditLog.save();

    // Log to console for debugging (remove in production)
    console.log(`📋 AUDIT LOG: ${action} by ${actor_email || actor_id || 'ANONYMOUS'} on ${entity_type} ${entity_id}`);

    return auditLog;
  } catch (error) {
    console.error('❌ Error creating audit log:', error);
    // Don't throw - audit logging should never break the main flow
    return null;
  }
};

// Static method to archive old logs
auditLogSchema.statics.archiveExpiredLogs = async function () {
  try {
    const now = new Date();

    const result = await this.updateMany(
      {
        retention_until: { $lte: now },
        is_archived: false,
      },
      {
        $set: {
          is_archived: true,
          archived_at: now,
        },
      }
    );

    console.log(`📦 Archived ${result.modifiedCount} expired audit logs`);
    return result;
  } catch (error) {
    console.error('❌ Error archiving audit logs:', error);
    return null;
  }
};

// Static method to generate audit report
auditLogSchema.statics.generateReport = async function (filters = {}) {
  try {
    const {
      start_date,
      end_date,
      actions = [],
      entity_types = [],
      actor_id,
      organization_id,
      limit = 1000,
    } = filters;

    const query = {};

    // Date range filter
    if (start_date || end_date) {
      query.timestamp = {};
      if (start_date) query.timestamp.$gte = new Date(start_date);
      if (end_date) query.timestamp.$lte = new Date(end_date);
    }

    // Action filter
    if (actions.length > 0) {
      query.action = { $in: actions };
    }

    // Entity type filter
    if (entity_types.length > 0) {
      query.entity_type = { $in: entity_types };
    }

    // Actor filter
    if (actor_id) {
      query.actor_id = actor_id;
    }

    // Organization filter
    if (organization_id) {
      query.organization_id = organization_id;
    }

    // Don't include archived logs by default
    query.is_archived = false;

    const logs = await this.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate('actor_id', 'firstName lastName email')
      .populate('organization_id', 'name')
      .lean();

    // Generate summary statistics
    const summary = await this.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    return {
      logs,
      summary,
      total: logs.length,
      filters,
      generated_at: new Date(),
    };
  } catch (error) {
    console.error('❌ Error generating audit report:', error);
    throw error;
  }
};

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
