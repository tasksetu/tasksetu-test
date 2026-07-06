/**
 * @file auditController.js
 * @desc Controller for audit log management and reporting (Spec 5.12)
 * @author TaskSetu Development Team
 * @version 1.0.0
 * 
 * Compliance & Audit Features:
 * - Generate audit reports with filtering
 * - Archive expired audit logs
 * - Export audit trails for compliance
 * - Organization-scoped access control
 */

import { AuditLog } from '../modals/auditLogModal.js';
import { User } from '../modals/userModal.js';

/**
 * @desc Generate audit report (Spec 5.12)
 * @route GET /api/audit-logs/report
 * @access Private (Org Admin, Super Admin)
 * 
 * Query Parameters:
 * - start_date: ISO 8601 date (filter from)
 * - end_date: ISO 8601 date (filter to)
 * - actions: Comma-separated action types
 * - entity_types: Comma-separated entity types
 * - actor_id: Filter by specific actor
 * - limit: Max records (default 1000, max 5000)
 * - page: Page number for pagination (default 1)
 * 
 * Returns:
 * - summary: Aggregate statistics
 * - logs: Filtered audit log entries
 * - pagination: Page info
 */
export const getAuditReport = async (req, res) => {
  try {
    const {
      start_date,
      end_date,
      actions,
      entity_types,
      actor_id,
      limit = 1000,
      page = 1
    } = req.query;

    // ✅ Get user's organization
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // ✅ Build filters
    const filters = {
      organization_id: user.organizationId, // Organization-scoped access
      limit: Math.min(parseInt(limit), 5000), // Cap at 5000 records
      page: parseInt(page)
    };

    // Optional filters
    if (start_date) filters.start_date = new Date(start_date);
    if (end_date) filters.end_date = new Date(end_date);
    if (actions) filters.actions = actions.split(',').map(a => a.trim());
    if (entity_types) filters.entity_types = entity_types.split(',').map(e => e.trim());
    if (actor_id) filters.actor_id = actor_id;

    // ✅ Generate report using static method
    const report = await AuditLog.generateReport(filters);

    res.status(200).json({
      success: true,
      message: 'Audit report generated successfully',
      data: report
    });

  } catch (error) {
    console.error('❌ Error generating audit report:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating audit report',
      error: error.message
    });
  }
};

/**
 * @desc Get audit log details by ID (Spec 5.12)
 * @route GET /api/audit-logs/:log_id
 * @access Private (Org Admin, Super Admin)
 */
export const getAuditLogById = async (req, res) => {
  try {
    const { log_id } = req.params;

    // ✅ Get user's organization
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // ✅ Find log (organization-scoped)
    const log = await AuditLog.findOne({
      _id: log_id,
      organization_id: user.organizationId
    });

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Audit log not found'
      });
    }

    res.status(200).json({
      success: true,
      data: log
    });

  } catch (error) {
    console.error('❌ Error fetching audit log:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching audit log',
      error: error.message
    });
  }
};

/**
 * @desc Manually trigger archive of expired logs (Spec 5.12)
 * @route POST /api/audit-logs/archive
 * @access Private (Super Admin only)
 * 
 * Note: Normally runs via scheduled job (daily 2 AM)
 * This endpoint allows manual triggering for testing or emergency cleanup
 */
export const archiveExpiredLogs = async (req, res) => {
  try {
    // ✅ Only super admins can manually trigger archive
    if (!req.user.role.includes('super_admin')) {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can manually archive audit logs'
      });
    }

    // ✅ Run archive job
    const result = await AuditLog.archiveExpiredLogs();

    res.status(200).json({
      success: true,
      message: `Successfully archived ${result?.modifiedCount || 0} expired audit logs`,
      data: {
        archived_count: result?.modifiedCount || 0,
        executed_at: new Date()
      }
    });

  } catch (error) {
    console.error('❌ Error archiving audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Error archiving audit logs',
      error: error.message
    });
  }
};

/**
 * @desc Export audit logs to CSV (Spec 5.12 - compliance requirement)
 * @route GET /api/audit-logs/export
 * @access Private (Org Admin, Super Admin)
 * 
 * Query Parameters: Same as getAuditReport
 * Returns: CSV file download
 */
export const exportAuditLogs = async (req, res) => {
  try {
    const {
      start_date,
      end_date,
      actions,
      entity_types,
      actor_id,
      limit = 5000
    } = req.query;

    // ✅ Get user's organization
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // ✅ Build filters
    const filters = {
      organization_id: user.organizationId,
      limit: Math.min(parseInt(limit), 5000)
    };

    if (start_date) filters.start_date = new Date(start_date);
    if (end_date) filters.end_date = new Date(end_date);
    if (actions) filters.actions = actions.split(',').map(a => a.trim());
    if (entity_types) filters.entity_types = entity_types.split(',').map(e => e.trim());
    if (actor_id) filters.actor_id = actor_id;

    // ✅ Get logs
    const report = await AuditLog.generateReport(filters);

    // ✅ Convert to CSV
    const csvRows = [];
    
    // CSV header
    csvRows.push([
      'Timestamp',
      'Action',
      'Entity Type',
      'Entity Name',
      'Actor Type',
      'Actor Email',
      'Actor Name',
      'Source IP',
      'Change Summary',
      'Request ID'
    ].join(','));

    // CSV data rows
    report.logs.forEach(log => {
      csvRows.push([
        log.timestamp.toISOString(),
        log.action,
        log.entity_type,
        `"${log.entity_name || ''}"`, // Quoted for CSV safety
        log.actor_type,
        log.actor_email || '',
        `"${log.actor_name || ''}"`,
        log.source_ip || '',
        `"${log.change_summary || ''}"`,
        log.request_id || ''
      ].join(','));
    });

    const csv = csvRows.join('\n');

    // ✅ Set CSV headers
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);

    res.status(200).send(csv);

  } catch (error) {
    console.error('❌ Error exporting audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting audit logs',
      error: error.message
    });
  }
};
