/**
 * @file archiveAuditLogs.js
 * @desc Scheduled job to archive expired audit logs (Spec 5.12)
 * @author TaskSetu Development Team
 * @version 1.0.0
 * 
 * Job Schedule: Daily at 2:00 AM
 * Purpose: Mark audit logs as archived once they exceed retention period
 * 
 * Usage:
 * - Automatically registered in server startup (routes.js or app.js)
 * - Can be manually triggered via API: POST /api/audit-logs/archive
 */

import { AuditLog } from '../modals/auditLogModal.js';

/**
 * Archive expired audit logs
 * 
 * Process:
 * 1. Find all logs where retention_until < now AND is_archived = false
 * 2. Update is_archived = true, set archived_at timestamp
 * 3. Log results to console
 * 
 * @returns {Object} Archive job result with count
 */
export const archiveExpiredAuditLogs = async () => {
  try {
    console.log('🕒 [AUDIT JOB] Starting audit log archive job...');
    const startTime = Date.now();

    // ✅ Call static method from AuditLog model
    const result = await AuditLog.archiveExpiredLogs();

    const duration = Date.now() - startTime;
    const archivedCount = result?.modifiedCount || 0;

    console.log(`✅ [AUDIT JOB] Archived ${archivedCount} audit logs in ${duration}ms`);

    // ✅ Return result for API calls
    return {
      success: true,
      archived_count: archivedCount,
      duration_ms: duration,
      executed_at: new Date()
    };

  } catch (error) {
    console.error('❌ [AUDIT JOB] Error archiving audit logs:', error);
    
    // ✅ Return error result (don't throw - job failures should be logged, not crash)
    return {
      success: false,
      error: error.message,
      executed_at: new Date()
    };
  }
};

/**
 * Manual trigger for testing or emergency cleanup
 * Use via: node -e "require('./server/jobs/archiveAuditLogs.js').runManual()"
 */
export const runManual = async () => {
  console.log('🔧 [MANUAL] Running audit archive job manually...');
  const result = await archiveExpiredAuditLogs();
  console.log('📊 [MANUAL] Result:', result);
  process.exit(result.success ? 0 : 1);
};
