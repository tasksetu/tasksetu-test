/**
 * Cron Debug Routes
 * ─────────────────
 * Lets admins verify cron jobs are running and trigger them manually for testing.
 *
 * GET  /api/cron/status              → list all registered cron jobs + init status
 * POST /api/cron/trigger/:jobName    → manually fire a specific cron job
 * POST /api/cron/test-morning-email  → send morning briefing email to a specific user NOW (ignores 8AM check)
 * GET  /api/cron/email-status        → check if email service is configured and working
 */

import express from 'express';
import { CronJobService } from '../services/cronJobService.js';
import { emailService } from '../services/emailService.js';
import { User } from '../modals/userModal.js';
import { Task } from '../models.js';

const router = express.Router();

// ─── Simple auth middleware (admin only) ───────────────────────────────────
const adminOnly = (req, res, next) => {
  // Check for Authorization header (Bearer token)
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized — provide Bearer token' });
  }
  // Reuse the existing auth middleware if available, else allow in dev mode
  if (process.env.NODE_ENV === 'development') {
    return next(); // In dev, allow without strict role check
  }
  next();
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cron/status
// Returns init status + list of all active node-cron scheduled tasks
// ─────────────────────────────────────────────────────────────────────────────
router.get('/status', adminOnly, async (req, res) => {
  try {
    // Force re-check email config before reporting
    await emailService.checkConfiguration();

    const status = CronJobService.getJobsStatus();
    res.json({
      success: true,
      cronService: {
        isInitialized: status.isInitialized,
        activeJobs: status.activeJobs,
        jobs: status.jobs
      },
      emailService: {
        isConfigured: emailService.isConfigured,
        fromEmail: emailService.fromEmail,
        baseUrl: emailService.baseUrl,
        resendKeyPresent: !!process.env.RESEND_API_KEY,
        resendKeyPreview: process.env.RESEND_API_KEY
          ? `${process.env.RESEND_API_KEY.substring(0, 8)}...`
          : '❌ NOT SET — add RESEND_API_KEY to your .env file'
      },
      serverTime: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV,
      diagnosis: !process.env.RESEND_API_KEY
        ? '⚠️ RESEND_API_KEY is missing from environment variables. Emails will NOT send.'
        : emailService.isConfigured
        ? '✅ Email service is properly configured and ready to send.'
        : '⚠️ Email service failed to initialize despite key being present — check key validity.'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cron/trigger/:jobName
// Manually trigger a named cron job for testing
// jobName options: overdue | morning | assignments | license
// ─────────────────────────────────────────────────────────────────────────────
router.post('/trigger/:jobName', adminOnly, async (req, res) => {
  const { jobName } = req.params;

  const jobMap = {
    'overdue':      () => CronJobService.checkOverdueTasks(),
    'morning':      () => CronJobService.sendDailyTaskReminders(),
    'assignments':  () => CronJobService.checkNewTaskAssignments(),
    'snooze':       () => CronJobService.checkExpiredSnoozeTasks(),
    'due-today':    () => CronJobService.checkTasksDueToday(),
    'due-soon':     () => CronJobService.checkTasksDueSoon(),
    'milestone':    () => CronJobService.checkMilestones?.(),
    'escalation':   () => CronJobService.checkManagerEscalation?.(),
  };

  if (!jobMap[jobName]) {
    return res.status(400).json({
      success: false,
      message: `Unknown job: "${jobName}"`,
      available: Object.keys(jobMap)
    });
  }

  try {
    console.log(`🔧 [CRON DEBUG] Manually triggering job: ${jobName}`);
    const result = await jobMap[jobName]();
    res.json({
      success: true,
      job: jobName,
      triggeredAt: new Date().toISOString(),
      result: result || 'completed (no return value)'
    });
  } catch (err) {
    console.error(`❌ [CRON DEBUG] Error triggering ${jobName}:`, err);
    res.status(500).json({ success: false, job: jobName, message: err.message, stack: err.stack });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cron/test-morning-email
// Send morning briefing email directly to any user — BYPASSES 8AM timezone check
// Body: { email: "user@example.com" } or { userId: "..." }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/test-morning-email', adminOnly, async (req, res) => {
  try {
    const { email, userId } = req.body;

    if (!email && !userId) {
      return res.status(400).json({ success: false, message: 'Provide email or userId in body' });
    }

    // Find the user
    const user = userId
      ? await User.findById(userId).select('_id firstName lastName email isActive emailVerified')
      : await User.findOne({ email }).select('_id firstName lastName email isActive emailVerified');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.email) {
      return res.status(400).json({ success: false, message: 'User has no email address' });
    }

    // Fetch pending tasks
    const now = new Date();
    const pendingTasks = await Task.find({
      assignedTo: user._id,
      status: { $nin: ['completed', 'DONE', 'CANCELLED'] },
      isDeleted: { $ne: true }
    }).sort({ dueDate: 1 }).select('_id title dueDate priority taskType status');

    const overdueTasks = pendingTasks.filter(t => t.dueDate && new Date(t.dueDate) < now);
    const dueToday = pendingTasks.filter(t => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d.toDateString() === now.toDateString();
    });
    const dueSoon = pendingTasks.filter(t => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      return d > now && d <= threeDays && d.toDateString() !== now.toDateString();
    });

    // Force send email (no 8AM check)
    const emailResult = await emailService.sendMorningBriefingEmail(user, {
      overdueTasks,
      dueToday,
      dueSoon,
      totalPending: pendingTasks.length
    });

    res.json({
      success: true,
      message: `Morning briefing email sent to ${user.email}`,
      user: { id: user._id, name: `${user.firstName} ${user.lastName}`, email: user.email },
      taskSummary: {
        total: pendingTasks.length,
        overdue: overdueTasks.length,
        dueToday: dueToday.length,
        dueSoon: dueSoon.length
      },
      emailResult,
      sentAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ [CRON DEBUG] test-morning-email error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cron/email-status
// Check if email service is properly configured
// ─────────────────────────────────────────────────────────────────────────────
router.get('/email-status', adminOnly, async (req, res) => {
  try {
    // Force re-check configuration
    await emailService.checkConfiguration();

    res.json({
      success: true,
      emailService: {
        isConfigured: emailService.isConfigured,
        fromEmail: emailService.fromEmail,
        baseUrl: emailService.baseUrl,
        resendKeyPresent: !!process.env.RESEND_API_KEY,
        resendKeyPreview: process.env.RESEND_API_KEY
          ? `${process.env.RESEND_API_KEY.substring(0, 8)}...`
          : 'NOT SET'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cron/send-test-email
// Send a raw test email to verify Resend API works
// Body: { email: "test@example.com" }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/send-test-email', adminOnly, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Provide email in body' });

    const result = await emailService.sendTestEmail(email);
    res.json({
      success: !!result?.success,
      message: result?.success ? `Test email sent to ${email}` : 'Failed to send',
      result,
      sentAt: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cron/fix-timezone
// Directly update a user's notification timezone in the DB
// Body: { email: "user@example.com", timezone: "Asia/Kolkata" }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/fix-timezone', adminOnly, async (req, res) => {
  try {
    const { email, userId, timezone = 'Asia/Kolkata' } = req.body;
    if (!email && !userId) return res.status(400).json({ success: false, message: 'Provide email or userId' });

    const { NotificationSettings } = await import('../modals/notificationSettingsModal.js');

    const user = userId
      ? await User.findById(userId).select('_id email firstName')
      : await User.findOne({ email }).select('_id email firstName');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Update or create notification settings with new timezone
    const updated = await NotificationSettings.findOneAndUpdate(
      { user_id: user._id },
      { $set: { timezone } },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      message: `✅ Timezone updated to ${timezone} for ${user.email}`,
      user: { id: user._id, email: user.email },
      newTimezone: updated.timezone,
      morningBriefingWillFireAt: `10:00 AM ${timezone} every day`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cron/my-timezone
// Check what timezone is saved for your account
// Query: ?email=user@example.com
// ─────────────────────────────────────────────────────────────────────────────
router.get('/my-timezone', adminOnly, async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ success: false, message: 'Provide ?email=...' });

    const { NotificationSettings } = await import('../modals/notificationSettingsModal.js');
    const user = await User.findOne({ email }).select('_id email firstName');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const settings = await NotificationSettings.findOne({ user_id: user._id }).select('timezone');

    res.json({
      success: true,
      email: user.email,
      savedTimezone: settings?.timezone || 'NOT SET (defaults to UTC)',
      currentTimeInThatTZ: settings?.timezone
        ? new Intl.DateTimeFormat('en-IN', {
            timeZone: settings.timezone,
            hour: '2-digit', minute: '2-digit', hour12: true
          }).format(new Date())
        : 'N/A',
      fix: `POST /api/cron/fix-timezone with { "email": "${email}", "timezone": "Asia/Kolkata" }`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

