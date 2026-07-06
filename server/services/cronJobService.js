import cron from "node-cron";
import { Task } from "../models.js";
import { User } from "../modals/userModal.js";
import {
  TriggerEvent,
  EntityType,
  NotificationPriority,
  ChannelType,
} from "../modals/notificationModal.js";
import { NotificationService } from "./notificationService.js";
import { AdvancedNotificationTriggers } from "./advancedNotificationTriggers.js";
import { TimezoneHelper } from "../utils/timezoneHelper.js";
import { emailService } from "./emailService.js"; // ✅ NEW: for rich HTML emails

/**
 * Cron Job Service for handling scheduled notification tasks
 * Manages overdue tasks, reminders, and cleanup operations
 */
export class CronJobService {
  static isInitialized = false;
  // ✅ Tracks which named jobs have been successfully registered
  static registeredJobs = new Set();

  /** Mark a job as registered (called after each cron.schedule()) */
  static registerJob(name) {
    this.registeredJobs.add(name);
  }

  /**
   * Initialize all cron jobs
   */
  static async initialize() {
    if (this.isInitialized) {
      console.log("Cron jobs already initialized");
      return;
    }

    console.log("Initializing notification cron jobs...");

    // Check for overdue tasks every hour
    this.scheduleOverdueTaskCheck();

    // Check for tasks due today every morning at 9 AM
    this.scheduleDueTodayCheck();

    // Check for tasks due soon (within 24 hours) every 6 hours
    this.scheduleDueSoonCheck();

    // Check for 3-day advance reminders at 9 AM daily (NEW)
    this.schedule3DayAdvanceReminder();

    // Check for manager escalation (48+ hours overdue) every 6 hours (NEW)
    this.scheduleManagerEscalation();

    // Check for admin escalation (7+ days overdue) daily at 10 AM (NEW)
    this.scheduleAdminEscalation();

    // Check for milestone achievements and misses daily at 11 AM (NEW)
    this.scheduleMilestoneCheck();

    // Cleanup expired notifications daily at 2 AM
    this.scheduleCleanupExpiredNotifications();

    // Generate daily task reminders at 8 AM
    this.scheduleDailyTaskReminders();

    // Archive expired audit logs daily at 2:30 AM (Spec 5.12)
    this.scheduleAuditLogArchive();

    // Check for auto-approval tasks daily at 3 AM (Spec 4.5)
    this.scheduleAutoApprovalCheck();

    // Check for expired snooze tasks every 15 minutes (Spec 4.11)
    this.scheduleSnoozeWakeUpCheck();

    // Process daily email digest every hour (checks user timezone for correct delivery time)
    this.scheduleDailyDigestProcessing();

    // Process weekly email digest every hour on all days (checks user's preferred day + timezone)
    this.scheduleWeeklyDigestProcessing();

    // Cleanup old digest queue items daily at 3:30 AM
    this.scheduleDigestQueueCleanup();

    // ✅ NEW: Check task assignments every 5 minutes — sends email + in-app for all task types
    this.scheduleTaskAssignmentEmailCheck();

    this.isInitialized = true;
    console.log("All notification cron jobs initialized successfully");
  }

  /**
   * Check for overdue tasks every 5 minutes
   */
  static scheduleOverdueTaskCheck() {
    cron.schedule("*/5 * * * *", async () => {
      try {
        await this.checkOverdueTasks();
      } catch (error) {
        console.error("Error in overdue tasks check:", error);
      }
    });
    this.registerJob("overdue-task-check");
    console.log("✓ Overdue tasks check scheduled (every 5 minutes)");
  }

  /**
   * Check for tasks due today — runs hourly, sends at 9 AM in user's timezone
   */
  static scheduleDueTodayCheck() {
    cron.schedule("0 * * * *", async () => {
      try {
        await this.checkTasksDueToday();
      } catch (error) {
        console.error("Error in tasks due today check:", error);
      }
    });
    this.registerJob("due-today-check");
    console.log(
      "✓ Tasks due today check scheduled (every hour, timezone-aware)",
    );
  }

  /**
   * Check for tasks due soon every 6 hours
   */
  static scheduleDueSoonCheck() {
    cron.schedule("0 6,12,18,0 * * *", async () => {
      try {
        await this.checkTasksDueSoon();
      } catch (error) {
        console.error("Error in tasks due soon check:", error);
      }
    });
    this.registerJob("due-soon-check");
    console.log("✓ Tasks due soon check scheduled (every 6 hours)");
  }

  /**
   * Cleanup expired notifications daily at 2 AM
   */
  static scheduleCleanupExpiredNotifications() {
    cron.schedule("0 2 * * *", async () => {
      try {
        await this.cleanupExpiredNotifications();
      } catch (error) {
        console.error("Error in cleanup expired notifications:", error);
      }
    });
    this.registerJob("cleanup-expired-notifications");
    console.log("✓ Expired notifications cleanup scheduled (2 AM daily)");
  }

  /**
   * Generate daily task reminders - runs every hour, sends at 8 AM in user's timezone
   */
  static scheduleDailyTaskReminders() {
    // ⏰ Runs at minute 20 of every hour → fires at 10:20 AM IST (9-11 AM window)
    cron.schedule("20 * * * *", async () => {
      try {
        await this.sendDailyTaskReminders();
      } catch (error) {
        console.error("Error in daily task reminders:", error);
      }
    });
    this.registerJob("morning-briefing");
    console.log(
      "✓ Morning briefing scheduled (XX:20 every hour, fires for users in 9–11 AM window)",
    );
  }

  /**
   * Check for overdue tasks and send priority-weighted notifications
   * ✅ UPDATED: runs every 5 min | windows: Critical=4h, High=4h, Medium=3h, Low=2h
   *            + sends ONE final 'MISSED' notification after 24h of being overdue
   */
  static async checkOverdueTasks() {
    try {
      const now = new Date();
      const { Notification } = await import("../modals/notificationModal.js");

      // ── Reminder windows per priority (ms) ──
      const reminderWindows = {
        critical: 4 * 60 * 60 * 1000, // 4 hours
        high: 4 * 60 * 60 * 1000, // 4 hours
        medium: 3 * 60 * 60 * 1000, // 3 hours
        low: 2 * 60 * 60 * 1000, // 2 hours
      };

      // Final 'MISSED' notification fires once after 24h of being overdue
      const MISSED_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

      // Find all overdue tasks (due date passed and not completed)
      const overdueTasks = await Task.find({
        dueDate: { $lt: now },
        status: { $nin: ["completed", "DONE", "CANCELLED"] },
        isDeleted: { $ne: true },
      }).populate("assignedTo", "firstName lastName email");

      for (const task of overdueTasks) {
        if (!task.assignedTo) continue;

        const priority = (task.priority || "medium").toLowerCase();
        const window = reminderWindows[priority] || reminderWindows.medium;
        const windowStart = new Date(now.getTime() - window);
        const daysOverdue = Math.ceil(
          (now - new Date(task.dueDate)) / (1000 * 60 * 60 * 24),
        );
        const msOverdue = now - new Date(task.dueDate);

        const priorityEmoji =
          { critical: "🚨", high: "⚠️", medium: "⏰", low: "📋" }[priority] ||
          "⏰";
        const priorityLevel = ["critical", "high"].includes(priority)
          ? NotificationPriority.URGENT
          : NotificationPriority.NORMAL;

        // ──────────────────────────────────────────────────
        // PHASE 1: Periodic reminder (repeats every window interval)
        // ──────────────────────────────────────────────────
        const recentReminder = await Notification.findOne({
          user_id: task.assignedTo._id,
          trigger_event: TriggerEvent.TASK_OVERDUE,
          "related_entity.entity_id": task._id,
          "metadata.reminder_phase": "periodic",
          created_at: { $gte: windowStart },
        });

        if (!recentReminder) {
          // Send periodic reminder
          await NotificationService.createNotification({
            user_id: task.assignedTo._id,
            trigger_event: TriggerEvent.TASK_OVERDUE,
            related_entity: {
              entity_type: EntityType.TASK,
              entity_id: task._id,
            },
            title: `${priorityEmoji} Task Overdue — ${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority`,
            message: `Your ${priority} priority task “${task.title}” is ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue. Please complete it as soon as possible.`,
            priority: priorityLevel,
            channels: [ChannelType.IN_APP, ChannelType.EMAIL],
            metadata: {
              task_id: task._id,
              task_title: task.title,
              task_priority: priority,
              due_date: task.dueDate,
              days_overdue: daysOverdue,
              reminder_phase: "periodic",
              reminder_window_hours: window / (60 * 60 * 1000),
            },
          });



          console.log(
            `${priorityEmoji} [OVERDUE PERIODIC] "${task.title}" → ${task.assignedTo.email} (${priority}, ${daysOverdue}d overdue)`,
          );
        }

        // ──────────────────────────────────────────────────
        // PHASE 2: Final MISSED notification (fires ONCE after 24h overdue)
        // ──────────────────────────────────────────────────
        if (msOverdue >= MISSED_THRESHOLD_MS) {
          const alreadyMissed = await Notification.findOne({
            user_id: task.assignedTo._id,
            trigger_event: TriggerEvent.TASK_OVERDUE,
            "related_entity.entity_id": task._id,
            "metadata.reminder_phase": "missed",
          });

          if (!alreadyMissed) {
            const hoursOverdue = Math.round(msOverdue / (60 * 60 * 1000));

            // Send FINAL in-app MISSED notification
            await NotificationService.createNotification({
              user_id: task.assignedTo._id,
              trigger_event: TriggerEvent.TASK_OVERDUE,
              related_entity: {
                entity_type: EntityType.TASK,
                entity_id: task._id,
              },
              title: `🚨 MISSED: “${task.title}” — ${hoursOverdue}h overdue`,
              message: `You missed your ${priority} priority task “${task.title}”! It was due ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} ago and is now marked as MISSED. ${["critical", "high"].includes(priority) ? "Your manager has been notified." : "Please complete or reschedule it immediately."}`,
              priority: NotificationPriority.URGENT,
              channels: [ChannelType.IN_APP, ChannelType.EMAIL],
              metadata: {
                task_id: task._id,
                task_title: task.title,
                task_priority: priority,
                due_date: task.dueDate,
                days_overdue: daysOverdue,
                hours_overdue: hoursOverdue,
                reminder_phase: "missed",
              },
            });

            // Send MISSED email with final urgency styling
            if (task.assignedTo.email) {
              // Use sendOverdueReminderEmail — daysOverdue drives the urgency styling
              // Override the email subject to clearly say MISSED
              await emailService.sendMissedTaskEmail(
                task.assignedTo,
                task,
                daysOverdue,
                hoursOverdue,
              );
            }

            console.log(
              `🚨 [OVERDUE MISSED] Final MISSED notification sent: “${task.title}” → ${task.assignedTo.email}`,
            );
          }
        }
      }
    } catch (error) {
      console.error("Error checking overdue tasks:", error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ✅ NEW: Task Assignment Email Check — covers all task types
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Schedule task assignment email check — runs every 5 minutes
   * Sends email + in-app notification when any task type is assigned
   */
  static scheduleTaskAssignmentEmailCheck() {
    cron.schedule("*/5 * * * *", async () => {
      try {
        await this.checkNewTaskAssignments();
      } catch (error) {
        console.error("❌ Error in task assignment email check:", error);
      }
    });
    this.registerJob("task-assignment-check");
    console.log(
      "✓ Task assignment email check scheduled (every 5 minutes, all task types)",
    );
  }

  /**
   * Find tasks assigned in the last 5 minutes and send assignment emails + in-app notifications.
   * Covers all task types: regular, recurring, milestone, approval, subtask.
   */
  static async checkNewTaskAssignments() {
    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const { Notification } = await import("../modals/notificationModal.js");

      // Find tasks that got an assignedTo in the last 5 minutes (newly created or recently assigned)
      const newlyAssignedTasks = await Task.find({
        assignedTo: { $ne: null },
        isDeleted: { $ne: true },
        updatedAt: { $gte: fiveMinutesAgo, $lte: now },
        status: { $nin: ["DONE", "CANCELLED"] },
      })
        .populate("assignedTo", "firstName lastName email")
        .populate("createdBy", "firstName lastName email")
        .select(
          "_id title description taskType priority dueDate assignedTo createdBy updatedAt",
        );

      let sentCount = 0;

      for (const task of newlyAssignedTasks) {
        if (!task.assignedTo?.email) continue;

        // Dedup: skip if we already sent an assignment notification for this task
        const alreadyNotified = await Notification.findOne({
          user_id: task.assignedTo._id,
          trigger_event: TriggerEvent.TASK_ASSIGNED,
          "related_entity.entity_id": task._id,
        });
        if (alreadyNotified) continue;

        const taskTypeLabel =
          {
            milestone: "Milestone",
            approval: "Approval Task",
            recurring: "Recurring Task",
            subtask: "Subtask",
            regular: "Task",
          }[task.taskType] || "Task";

        const typeEmoji =
          {
            milestone: "🎯",
            approval: "✅",
            recurring: "🔄",
            subtask: "📎",
            regular: "📋",
          }[task.taskType] || "📋";

        // ── Send in-app notification ──
        await NotificationService.createNotification({
          user_id: task.assignedTo._id,
          trigger_event: TriggerEvent.TASK_ASSIGNED,
          related_entity: { entity_type: EntityType.TASK, entity_id: task._id },
          title: `${typeEmoji} New ${taskTypeLabel} Assigned`,
          message: `You have been assigned a new ${taskTypeLabel.toLowerCase()}: "${task.title}"${task.dueDate ? ` — due ${new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}.`,
          priority: ["critical", "high"].includes(task.priority?.toLowerCase())
            ? NotificationPriority.URGENT
            : NotificationPriority.NORMAL,
          channels: [ChannelType.IN_APP, ChannelType.EMAIL],
          metadata: {
            task_id: task._id,
            task_title: task.title,
            task_type: task.taskType,
            task_priority: task.priority,
            due_date: task.dueDate,
            assigned_by: task.createdBy
              ? `${task.createdBy.firstName} ${task.createdBy.lastName}`
              : "System",
          },
        });

        // ── Send rich HTML assignment email ──
        await emailService.sendTaskAssignmentEmail(
          task.assignedTo,
          task,
          task.createdBy,
        );

        sentCount++;
        console.log(
          `${typeEmoji} Assignment notification sent: "${task.title}" → ${task.assignedTo.email} (${task.taskType})`,
        );
      }

      if (sentCount > 0)
        console.log(`📬 Task assignment emails sent: ${sentCount}`);
      return { success: true, count: sentCount };
    } catch (error) {
      console.error("❌ Error checking new task assignments:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check for tasks due today and send notifications — timezone-aware (sends at 9 AM user's local)
   */
  static async checkTasksDueToday() {
    try {
      const { NotificationSettings } =
        await import("../modals/notificationSettingsModal.js");

      // Get all active users
      const activeUsers = await User.find({
        isActive: true,
        emailVerified: true,
      }).select("_id firstName lastName email");

      let sentCount = 0;

      for (const user of activeUsers) {
        try {
          // Get user's timezone
          const userTimezone = await TimezoneHelper.getUserTimezone(user._id);

          // Only send at 9 AM in user's timezone
          const userLocal = TimezoneHelper.getLocalTime(userTimezone);
          if (userLocal.hours !== 9) {
            continue; // Not 9 AM for this user yet
          }

          // Get start and end of "today" in user's timezone
          const { startOfDay, endOfDay } =
            TimezoneHelper.getDayBoundaries(userTimezone);

          // Find tasks due today for this user
          const tasksDueToday = await Task.find({
            assignedTo: user._id,
            dueDate: { $gte: startOfDay, $lte: endOfDay },
            status: { $ne: "completed" },
            isDeleted: { $ne: true },
          });

          if (tasksDueToday.length === 0) continue;

          const tasksToNotify = [];

          for (const task of tasksDueToday) {
            // Check if we already sent a due today notification
            const { Notification } =
              await import("../modals/notificationModal.js");
            const existingNotification = await Notification.findOne({
              user_id: user._id,
              trigger_event: TriggerEvent.TASK_DUE_TODAY,
              "related_entity.entity_id": task._id,
              created_at: { $gte: startOfDay },
            });

            if (existingNotification) {
              continue; // Already notified today
            }

            tasksToNotify.push(task);
          }

          if (tasksToNotify.length === 0) continue;

          // 1. Send ONE grouped email for all unnotified tasks
          await emailService.sendTasksDueTodayEmail(user, tasksToNotify);

          // 2. Create individual in-app notifications
          for (const task of tasksToNotify) {
            const notificationData = {
              user_id: user._id,
              trigger_event: TriggerEvent.TASK_DUE_TODAY,
              related_entity: {
                entity_type: EntityType.TASK,
                entity_id: task._id,
              },
              title: "Task Due Today",
              message: `Your task "${task.title}" is due today. Don't forget to complete it!`,
              priority: NotificationPriority.URGENT,
              channels: [ChannelType.IN_APP], // Only IN_APP, email is grouped above
              metadata: {
                task_id: task._id,
                task_title: task.title,
                task_priority: task.priority,
                due_date: task.dueDate,
              },
              expires_at: endOfDay, // Expire at end of user's day
            };

            await NotificationService.createNotification(notificationData);
            sentCount++;
            console.log(
              `Due today in-app notification created for task: ${task.title} (user: ${user.email})`,
            );
          }
        } catch (userError) {
          console.error(
            `Error processing due-today for user ${user._id}:`,
            userError.message,
          );
        }
      }

      if (sentCount > 0) {
        console.log(`📅 Due-today notifications sent: ${sentCount}`);
      }
    } catch (error) {
      console.error("Error checking tasks due today:", error);
    }
  }

  /**
   * Check for tasks due soon (within 24 hours) and send notifications
   */
  static async checkTasksDueSoon() {
    try {
      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const in6Hours = new Date(now.getTime() + 6 * 60 * 60 * 1000);

      // Find tasks due within next 24 hours but not within 6 hours (to avoid spam)
      const tasksDueSoon = await Task.find({
        dueDate: { $gt: in6Hours, $lte: in24Hours },
        status: { $ne: "completed" },
        isDeleted: { $ne: true },
      }).populate("assignedTo", "firstName lastName email");

      console.log(`Found ${tasksDueSoon.length} tasks due soon`);

      for (const task of tasksDueSoon) {
        if (!task.assignedTo) continue;

        // Check if we already sent a due soon notification in the last 6 hours
        const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        const { Notification } = await import("../modals/notificationModal.js");
        const existingNotification = await Notification.findOne({
          user_id: task.assignedTo._id,
          trigger_event: TriggerEvent.TASK_DUE_SOON,
          "related_entity.entity_id": task._id,
          created_at: { $gte: sixHoursAgo },
        });

        if (existingNotification) {
          continue; // Already notified recently
        }

        const hoursUntilDue = Math.ceil(
          (task.dueDate - now) / (1000 * 60 * 60),
        );

        const notificationData = {
          user_id: task.assignedTo._id,
          trigger_event: TriggerEvent.TASK_DUE_SOON,
          related_entity: {
            entity_type: EntityType.TASK,
            entity_id: task._id,
          },
          title: "Task Due Soon",
          message: `Your task "${task.title}" is due in ${hoursUntilDue} hours. Please plan to complete it soon.`,
          priority: NotificationPriority.NORMAL,
          channels: [ChannelType.IN_APP],
          metadata: {
            task_id: task._id,
            task_title: task.title,
            task_priority: task.priority,
            due_date: task.dueDate,
            hours_until_due: hoursUntilDue,
          },
          expires_at: task.dueDate, // Expire when task is due
        };

        await NotificationService.createNotification(notificationData);
        console.log(`Due soon notification sent for task: ${task.title}`);
      }
    } catch (error) {
      console.error("Error checking tasks due soon:", error);
    }
  }

  /**
   * Send daily morning briefing — timezone-aware (sends at 8 AM in user's local time)
   * ✅ FIXED: Full diagnostic logging + relaxed hour window (7-9 AM) + all status filters
   */
  static async sendDailyTaskReminders() {
    try {
      const { NotificationSettings } =
        await import("../modals/notificationSettingsModal.js");
      const { Notification } = await import("../modals/notificationModal.js");

      console.log("\n⏰ ===== MORNING BRIEFING RUN START =====");
      console.log(`⏰ Server UTC time: ${new Date().toISOString()}`);

      // Get all active users (also include emailVerified: false for debugging)
      const activeUsers = await User.find({
        isActive: true,
      }).select("_id firstName lastName email emailVerified");

      console.log(`⏰ Found ${activeUsers.length} active users to check`);

      if (activeUsers.length === 0) {
        console.log(
          "⏰ ⚠️  No active users found — check User.isActive field in DB",
        );
        return;
      }

      let sentCount = 0;
      let skippedNotHour = 0;
      let skippedAlreadySent = 0;
      let skippedNoTasks = 0;
      let skippedNoEmail = 0;

      for (const user of activeUsers) {
        try {
          // ── 1. Get user timezone ──────────────────────────────────
          const settings = await NotificationSettings.getSettingsForUser(
            user._id,
          );
          const userTimezone = settings?.timezone || "Asia/Kolkata"; // default IST

          // ── 2. Check if it's 10 AM IST (window: 9–11) ──
          const userLocal = TimezoneHelper.getLocalTime(userTimezone);
          const isCorrectHour = userLocal.hours >= 9 && userLocal.hours <= 11;

          console.log(
            `⏰ User ${user.email} | TZ: ${userTimezone} | Local: ${userLocal.timeStr} | Hour ok: ${isCorrectHour}`,
          );

          if (!isCorrectHour) {
            skippedNotHour++;
            continue;
          }

          // ── 3. Skip if no email ───────────────────────────────────
          if (!user.email) {
            console.log(`⏰ ⚠️  Skipping ${user._id} — no email address`);
            skippedNoEmail++;
            continue;
          }

          // ── 4. Deduplication: already sent today? ─────────────────
          const { startOfDay } = TimezoneHelper.getDayBoundaries(userTimezone);
          const alreadySent = await Notification.findOne({
            user_id: user._id,
            trigger_event: TriggerEvent.TASK_REMINDER,
            "metadata.reminder_type": "daily_summary",
            created_at: { $gte: startOfDay },
          });

          if (alreadySent) {
            console.log(
              `⏰ ⏭️  Skipping ${user.email} — briefing already sent today`,
            );
            skippedAlreadySent++;
            continue;
          }

          // ── 5. Get ALL pending tasks (wide status filter) ─────────
          const now = new Date();
          const pendingTasks = await Task.find({
            assignedTo: user._id,
            status: {
              $nin: [
                "completed",
                "DONE",
                "CANCELLED",
                "cancelled",
                "Completed",
                "Done",
              ],
            },
            isDeleted: { $ne: true },
          })
            .sort({ dueDate: 1 })
            .select("_id title dueDate priority taskType status");

          console.log(
            `⏰ ${user.email} has ${pendingTasks.length} pending tasks`,
          );

          // ── 6. Categorize tasks ───────────────────────────────────
          const overdueTasks = pendingTasks.filter(
            (t) => t.dueDate && new Date(t.dueDate) < now,
          );
          const dueToday = pendingTasks.filter((t) => {
            if (!t.dueDate) return false;
            return TimezoneHelper.isSameDay(
              new Date(t.dueDate),
              now,
              userTimezone,
            );
          });
          const dueSoon = pendingTasks.filter((t) => {
            if (!t.dueDate) return false;
            const taskDate = new Date(t.dueDate);
            const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
            return (
              taskDate > now &&
              taskDate <= threeDays &&
              !dueToday.some((d) => d._id.toString() === t._id.toString())
            );
          });

          console.log(
            `⏰ ${user.email} — overdue:${overdueTasks.length} today:${dueToday.length} soon:${dueSoon.length}`,
          );

          // ── 7. Always send email (even if 0 tasks — show "all clear") ──
          const primaryTaskId =
            overdueTasks[0]?._id ||
            dueToday[0]?._id ||
            dueSoon[0]?._id ||
            pendingTasks[0]?._id;

          // ── 8. Send email FIRST ───────────────────────────────────
          console.log(`⏰ Sending morning briefing email to ${user.email}...`);
          const emailResult = await emailService.sendMorningBriefingEmail(
            user,
            {
              overdueTasks,
              dueToday,
              dueSoon,
              totalPending: pendingTasks.length,
            },
          );
          console.log(`⏰ Email result for ${user.email}:`, emailResult);

          // ── 9. Send in-app notification ───────────────────────────
          if (primaryTaskId) {
            let message = `Good morning ${user.firstName || ""}! Here's your task summary:\n`;
            if (overdueTasks.length > 0)
              message += `• ${overdueTasks.length} overdue task(s)\n`;
            if (dueToday.length > 0)
              message += `• ${dueToday.length} task(s) due today\n`;
            if (dueSoon.length > 0)
              message += `• ${dueSoon.length} task(s) due within 3 days\n`;
            if (pendingTasks.length === 0)
              message += "• All caught up! No pending tasks.\n";
            message += `\nTotal pending: ${pendingTasks.length} tasks`;

            await NotificationService.createNotification({
              user_id: user._id,
              trigger_event: TriggerEvent.TASK_REMINDER,
              related_entity: {
                entity_type: EntityType.TASK,
                entity_id: primaryTaskId,
              },
              title: "☀️ Daily Task Summary",
              message,
              priority:
                overdueTasks.length > 0
                  ? NotificationPriority.URGENT
                  : NotificationPriority.NORMAL,
              channels: [ChannelType.IN_APP],
              metadata: {
                total_pending: pendingTasks.length,
                overdue_count: overdueTasks.length,
                due_today_count: dueToday.length,
                due_soon_count: dueSoon.length,
                reminder_type: "daily_summary",
              },
              expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000),
            });
          }

          sentCount++;
          console.log(`⏰ ✅ Morning briefing complete for ${user.email}`);
        } catch (userError) {
          console.error(
            `⏰ ❌ Error sending morning briefing to user ${user._id} (${user.email}):`,
            userError.message,
            userError.stack,
          );
        }
      }

      console.log(`\n⏰ ===== MORNING BRIEFING SUMMARY =====`);
      console.log(
        `⏰ Sent: ${sentCount} | Skipped (wrong hour): ${skippedNotHour} | Already sent: ${skippedAlreadySent} | No tasks: ${skippedNoTasks} | No email: ${skippedNoEmail}`,
      );
      console.log("⏰ ====================================\n");
    } catch (error) {
      console.error(
        "❌ FATAL Error in morning briefing:",
        error.message,
        error.stack,
      );
    }
  }

  /**
   * Cleanup expired notifications
   */

  static async cleanupExpiredNotifications() {
    try {
      const result = await NotificationService.cleanupExpiredNotifications();
      console.log(
        `Cleaned up ${result.deletedCount || 0} expired notifications`,
      );
    } catch (error) {
      console.error("Error cleaning up expired notifications:", error);
    }
  }

  /**
   * Check for tasks due in N days and send advance reminders — timezone-aware
   * Spec: "3 days before due date → System checks reminder rules"
   */
  static schedule3DayAdvanceReminder() {
    cron.schedule("0 * * * *", async () => {
      try {
        await this.check3DayAdvanceReminders();
      } catch (error) {
        console.error("❌ Error in advance reminders:", error);
      }
    });
    this.registerJob("3day-advance-reminder");
    console.log(
      "✓ Advance reminder check scheduled (every hour, timezone-aware)",
    );
  }

  /**
   * Check for tasks due in N days and send reminders — timezone-aware
   */
  static async check3DayAdvanceReminders() {
    try {
      const now = new Date();
      const { Notification } = await import("../modals/notificationModal.js");
      const { NotificationSettings } =
        await import("../modals/notificationSettingsModal.js");

      // Collect all unique reminder days configured by users (default [3, 1] if none)
      const allSettings = await NotificationSettings.find({
        "due_date_reminders.enabled": true,
      }).select("user_id due_date_reminders timezone");

      // Build a map: userId → { days_before_due, timezone }
      const userReminderConfig = new Map();
      const allDaysSet = new Set([3, 1]); // always check default days

      for (const s of allSettings) {
        const days = s.due_date_reminders?.days_before_due || [3, 1];
        const tz = s.timezone || "UTC";
        userReminderConfig.set(s.user_id.toString(), { days, timezone: tz });
        days.forEach((d) => allDaysSet.add(d));
      }

      const allDays = [...allDaysSet].sort((a, b) => b - a);
      console.log(
        `📅 Checking advance reminders for day offsets: ${allDays.join(", ")}`,
      );

      // Get all active users with their tasks
      const activeUsers = await User.find({
        isActive: true,
        emailVerified: true,
      }).select("_id");

      let totalSent = 0;

      for (const user of activeUsers) {
        try {
          const userId = user._id.toString();
          const config = userReminderConfig.get(userId) || {
            days: [3, 1],
            timezone: "UTC",
          };
          const userTimezone = config.timezone;

          // Only send at 9 AM in user's timezone
          const userLocal = TimezoneHelper.getLocalTime(userTimezone);
          if (userLocal.hours !== 9) {
            continue; // Not 9 AM for this user yet
          }

          // Get user's "today" boundaries for deduplication
          const { startOfDay: userTodayStart } =
            TimezoneHelper.getDayBoundaries(userTimezone);

          for (const dayOffset of config.days) {
            // Calculate the target date in user's timezone
            const targetDateStr =
              TimezoneHelper.getLocalTime(userTimezone).dateStr;
            const [y, m, d] = targetDateStr.split("-").map(Number);
            const targetUTC = new Date(Date.UTC(y, m - 1, d + dayOffset));
            const { startOfDay: dayStart, endOfDay: dayEnd } =
              TimezoneHelper.getDayBoundaries(userTimezone, targetUTC);

            const tasksDue = await Task.find({
              assignedTo: user._id,
              dueDate: { $gte: dayStart, $lte: dayEnd },
              status: { $nin: ["DONE", "CANCELLED"] },
              isDeleted: { $ne: true },
            });

            for (const task of tasksDue) {
              // Check if we already sent a reminder for this day offset today
              const existingReminder = await Notification.findOne({
                user_id: user._id,
                trigger_event: TriggerEvent.TASK_REMINDER,
                "related_entity.entity_id": task._id,
                "metadata.reminderType": `${dayOffset}_day_advance`,
                created_at: { $gte: userTodayStart },
              });

              if (existingReminder) {
                continue;
              }

              // Send advance reminder with correct dayOffset
              await AdvancedNotificationTriggers.send3DayAdvanceReminder(
                task,
                dayOffset,
              );
              totalSent++;
            }
          }
        } catch (userError) {
          console.error(
            `❌ Error checking advance reminders for user ${user._id}:`,
            userError.message,
          );
        }
      }

      return { success: true, count: totalSent };
    } catch (error) {
      console.error("❌ Error checking advance reminders:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Schedule manager escalation for overdue tasks (NEW)
   * Spec: "If still not acted upon in 48 hrs → Manager notified by email & in-app"
   */
  static scheduleManagerEscalation() {
    // Run every 6 hours
    cron.schedule("0 */6 * * *", async () => {
      try {
        await this.checkManagerEscalation();
      } catch (error) {
        console.error("❌ Error in manager escalation check:", error);
      }
    });
    this.registerJob("manager-escalation");
    console.log("✓ Manager escalation check scheduled (every 6 hours)");
  }

  /**
   * Check for tasks overdue > 48 hours and escalate to manager
   */
  static async checkManagerEscalation() {
    try {
      const now = new Date();
      const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      // Find tasks overdue for more than 48 hours
      const overdueTasksForEscalation = await Task.find({
        dueDate: { $lt: fortyEightHoursAgo },
        status: { $nin: ["DONE", "CANCELLED"] },
        isDeleted: { $ne: true },
      }).populate("assignedTo", "firstName lastName email organizationId");

      console.log(
        `📊 Found ${overdueTasksForEscalation.length} tasks for manager escalation`,
      );

      for (const task of overdueTasksForEscalation) {
        if (!task.assignedTo) continue;

        const hoursOverdue = Math.ceil(
          (now - new Date(task.dueDate)) / (1000 * 60 * 60),
        );

        // Check if we already sent a manager escalation in the last 24 hours
        const { Notification } = await import("../modals/notificationModal.js");
        const twentyFourHoursAgo = new Date(
          now.getTime() - 24 * 60 * 60 * 1000,
        );
        const recentEscalation = await Notification.findOne({
          trigger_event: TriggerEvent.OVERDUE_ESCALATION,
          "related_entity.entity_id": task._id,
          "metadata.escalationLevel": "manager",
          created_at: { $gte: twentyFourHoursAgo },
        });

        if (recentEscalation) {
          continue; // Already escalated recently
        }

        // Escalate to manager
        await AdvancedNotificationTriggers.escalateToManager(
          task,
          hoursOverdue,
        );
      }

      return { success: true, count: overdueTasksForEscalation.length };
    } catch (error) {
      console.error("❌ Error checking manager escalation:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Schedule admin escalation for critically overdue tasks (NEW)
   * Spec: "Admin only notified if overdue > escalation threshold (say 7 days)"
   */
  static scheduleAdminEscalation() {
    // Run at 10:00 AM every day
    cron.schedule("0 10 * * *", async () => {
      try {
        await this.checkAdminEscalation();
      } catch (error) {
        console.error("❌ Error in admin escalation check:", error);
      }
    });
    this.registerJob("admin-escalation");
    console.log("✓ Admin escalation check scheduled (10 AM daily)");
  }

  /**
   * Check for tasks overdue > 7 days and escalate to admin
   */
  static async checkAdminEscalation() {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Find tasks overdue for more than 7 days
      const criticallyOverdueTasks = await Task.find({
        dueDate: { $lt: sevenDaysAgo },
        status: { $nin: ["DONE", "CANCELLED"] },
        isDeleted: { $ne: true },
      }).populate(
        "assignedTo createdBy",
        "firstName lastName email organizationId",
      );

      console.log(
        `📊 Found ${criticallyOverdueTasks.length} tasks for admin escalation`,
      );

      for (const task of criticallyOverdueTasks) {
        const daysOverdue = Math.ceil(
          (now - new Date(task.dueDate)) / (1000 * 60 * 60 * 24),
        );

        // Check if we already sent an admin escalation in the last 3 days
        const { Notification } = await import("../modals/notificationModal.js");
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        const recentEscalation = await Notification.findOne({
          trigger_event: TriggerEvent.CRITICAL_ESCALATION,
          "related_entity.entity_id": task._id,
          "metadata.escalationLevel": "admin",
          created_at: { $gte: threeDaysAgo },
        });

        if (recentEscalation) {
          continue; // Already escalated recently
        }

        // Escalate to admin
        await AdvancedNotificationTriggers.escalateToAdmin(task, daysOverdue);
      }

      return { success: true, count: criticallyOverdueTasks.length };
    } catch (error) {
      console.error("❌ Error checking admin escalation:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check for milestone achievements and misses (NEW)
   * Spec: "Milestone - Milestone achieved or missed → Creator, Manager"
   */
  static scheduleMilestoneCheck() {
    // Run at 11:00 AM every day
    cron.schedule("0 11 * * *", async () => {
      try {
        await this.checkMilestones();
      } catch (error) {
        console.error("❌ Error in milestone check:", error);
      }
    });
    this.registerJob("milestone-check");
    console.log("✓ Milestone check scheduled (11 AM daily)");
  }

  /**
   * Check for milestone achievements and misses
   */
  static async checkMilestones() {
    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Find milestone tasks completed in the last 24 hours (Achieved)
      const achievedMilestones = await Task.find({
        taskType: "milestone",
        status: "DONE",
        completedAt: { $gte: yesterday, $lte: now },
        isDeleted: { $ne: true },
      });

      console.log(`🎉 Found ${achievedMilestones.length} achieved milestones`);

      for (const milestone of achievedMilestones) {
        // Check if we already sent achievement notification
        const { Notification } = await import("../modals/notificationModal.js");
        const existingNotif = await Notification.findOne({
          trigger_event: TriggerEvent.MILESTONE_ACHIEVED,
          "related_entity.entity_id": milestone._id,
          created_at: { $gte: yesterday },
        });

        if (!existingNotif) {
          await AdvancedNotificationTriggers.notifyMilestoneAchieved(milestone);
        }
      }

      // Find milestone tasks that are overdue (Missed)
      const missedMilestones = await Task.find({
        taskType: "milestone",
        dueDate: { $lt: now },
        status: { $nin: ["DONE", "CANCELLED"] },
        isDeleted: { $ne: true },
      });

      console.log(`⚠️  Found ${missedMilestones.length} missed milestones`);

      for (const milestone of missedMilestones) {
        // Check if we already sent missed notification today
        const { Notification } = await import("../modals/notificationModal.js");
        const milestoneUserTz = await TimezoneHelper.getUserTimezone(
          milestone.assignedTo || milestone.creator,
        );
        const { startOfDay } = TimezoneHelper.getDayBoundaries(milestoneUserTz);
        const existingNotif = await Notification.findOne({
          trigger_event: TriggerEvent.MILESTONE_MISSED,
          "related_entity.entity_id": milestone._id,
          created_at: { $gte: startOfDay },
        });

        if (!existingNotif) {
          await AdvancedNotificationTriggers.notifyMilestoneMissed(milestone);
        }
      }

      return {
        success: true,
        achieved: achievedMilestones.length,
        missed: missedMilestones.length,
      };
    } catch (error) {
      console.error("❌ Error checking milestones:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop all cron jobs (useful for testing or graceful shutdown)
   */
  static stopAllJobs() {
    cron.getTasks().forEach((task) => {
      task.stop();
    });
    this.isInitialized = false;
    console.log("All cron jobs stopped");
  }

  /**
   * Archive expired audit logs daily at 2:30 AM (Spec 5.12)
   */
  static scheduleAuditLogArchive() {
    // Run at 2:30 AM every day
    cron.schedule("30 2 * * *", async () => {
      try {
        const { archiveExpiredAuditLogs } =
          await import("../jobs/archiveAuditLogs.js");
        const result = await archiveExpiredAuditLogs();
        if (result.success) {
          console.log(`✅ [CRON] Archived ${result.archived_count} audit logs`);
        } else {
          console.error("❌ [CRON] Audit log archive failed:", result.error);
        }
      } catch (error) {
        console.error("❌ [CRON] Error in audit log archive:", error);
      }
    });
    this.registerJob("audit-log-archive");
    console.log("✓ Audit log archive scheduled (2:30 AM daily)");
  }

  /**
   * Check for auto-approval tasks daily at 3 AM (Spec 4.5)
   */
  static scheduleAutoApprovalCheck() {
    // Run at 3:00 AM every day
    cron.schedule("0 3 * * *", async () => {
      try {
        await this.checkAutoApprovalTasks();
      } catch (error) {
        console.error("❌ [CRON] Error in auto-approval check:", error);
      }
    });
    this.registerJob("auto-approval-check");
    console.log("✓ Auto-approval check scheduled (3 AM daily)");
  }

  /**
   * Check for approval tasks that should be auto-approved
   * Spec 4.5: "Auto-approve after X days if no response"
   */
  static async checkAutoApprovalTasks() {
    try {
      const now = new Date();
      const TaskModel = (await import("../modals/taskModal.js")).default;

      // Find approval tasks with auto-approve enabled and past auto-approve date
      const tasksToAutoApprove = await TaskModel.find({
        isApprovalTask: true,
        autoApproveEnabled: true,
        autoApproveAfter: { $lte: now }, // Auto-approve date has passed
        approvalStatus: "pending", // Still pending
        isDeleted: { $ne: true },
      }).populate(
        "createdBy assignedTo approvers organization",
        "firstName lastName email organizationId",
      );

      console.log(
        `🔍 [AUTO-APPROVAL] Found ${tasksToAutoApprove.length} tasks to auto-approve`,
      );

      for (const task of tasksToAutoApprove) {
        try {
          // ✅ Auto-approve the task
          task.approvalStatus = "auto_approved";
          task.status = "DONE";

          // ✅ Record auto-approval decision
          const daysPassed = Math.ceil(
            (now - task.autoApproveAfter) / (1000 * 60 * 60 * 24),
          );
          task.approvalDecisions = task.approvalDecisions || [];
          task.approvalDecisions.push({
            approverId: null, // System decision
            decision: "auto_approve",
            comment: `Auto-approved after ${daysPassed} day(s) of no response (due date passed: ${task.dueDate?.toISOString() || "N/A"})`,
            decidedAt: now,
            isAutoApproval: true,
          });

          await task.save();

          console.log(
            `✅ [AUTO-APPROVAL] Task auto-approved: ${task.title} (ID: ${task._id})`,
          );

          // ✅ Notify creator
          if (task.createdBy) {
            await NotificationService.createNotification({
              user_id: task.createdBy._id,
              trigger_event: TriggerEvent.TASK_COMPLETED, // Use existing event or create AUTO_APPROVAL
              related_entity: {
                entity_type: EntityType.TASK,
                entity_id: task._id,
              },
              title: "Task Auto-Approved",
              message: `Task "${task.title}" was automatically approved after ${daysPassed} day(s) of no response from approvers.`,
              priority: NotificationPriority.NORMAL,
              channels: [ChannelType.IN_APP, ChannelType.EMAIL],
              metadata: {
                auto_approved_at: now,
                original_due_date: task.dueDate,
                auto_approve_after: task.autoApproveAfter,
                days_waited: daysPassed,
              },
            });
          }

          // ✅ Notify assignee
          if (
            task.assignedTo &&
            task.assignedTo._id.toString() !== task.createdBy?._id?.toString()
          ) {
            await NotificationService.createNotification({
              user_id: task.assignedTo._id,
              trigger_event: TriggerEvent.TASK_COMPLETED,
              related_entity: {
                entity_type: EntityType.TASK,
                entity_id: task._id,
              },
              title: "Task Auto-Approved - Ready to Proceed",
              message: `Task "${task.title}" was auto-approved and is now ready for you to work on.`,
              priority: NotificationPriority.NORMAL,
              channels: [ChannelType.IN_APP],
              metadata: {
                auto_approved: true,
              },
            });
          }

          // ✅ Notify company admins
          if (task.organization) {
            const admins = await User.find({
              organizationId: task.organization,
              role: { $in: ["org_admin", "super_admin"] },
            }).select("_id email");

            for (const admin of admins) {
              await NotificationService.createNotification({
                user_id: admin._id,
                trigger_event: TriggerEvent.TASK_COMPLETED,
                related_entity: {
                  entity_type: EntityType.TASK,
                  entity_id: task._id,
                },
                title: "Approval Task Auto-Approved (No Response)",
                message: `Task "${task.title}" was auto-approved after deadline with no approver response. Created by: ${task.createdBy?.email || "Unknown"}`,
                priority: NotificationPriority.NORMAL,
                channels: [ChannelType.IN_APP],
                metadata: {
                  creator_email: task.createdBy?.email,
                  approvers_count: task.approvers?.length || 0,
                  auto_approved: true,
                },
              });
            }
          }
        } catch (taskError) {
          console.error(
            `❌ [AUTO-APPROVAL] Error processing task ${task._id}:`,
            taskError.message,
          );
          // Continue with next task
        }
      }

      console.log(
        `✅ [AUTO-APPROVAL] Processed ${tasksToAutoApprove.length} auto-approval tasks`,
      );
      return { success: true, count: tasksToAutoApprove.length };
    } catch (error) {
      console.error(
        "❌ [AUTO-APPROVAL] Error checking auto-approval tasks:",
        error,
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Check for expired snooze tasks every minute for responsive wake-up
   */
  static scheduleSnoozeWakeUpCheck() {
    // Run every minute (Better for short snoozes like 2-5 min)
    cron.schedule("* * * * *", async () => {
      try {
        await this.checkExpiredSnoozeTasks();
      } catch (error) {
        console.error("Error in expired snooze tasks check:", error);
      }
    });
    this.registerJob("snooze-wakeup-check");
    console.log("✓ Snooze wake-up check scheduled (every minute)");
  }

  /**
   * Check for tasks with expired snooze time and wake them up
   */
  static async checkExpiredSnoozeTasks() {
    try {
      const now = new Date();

      // Find tasks with expired snooze time
      const expiredSnoozeTasks = await Task.find({
        isSnooze: true,
        snoozeUntil: { $lte: now },
        isDeleted: { $ne: true },
      })
        .populate("assignedTo", "firstName lastName email")
        .populate("createdBy", "firstName lastName email")
        .populate("collaborators", "firstName lastName email")
        .populate("organization", "name");

      console.log(`Found ${expiredSnoozeTasks.length} expired snooze tasks`);

      for (const task of expiredSnoozeTasks) {
        try {
          // Unsnooze the task (wake-up)
          task.isSnooze = false;
          task.snoozeUntil = null;
          task.snoozeReason = null;
          task.snoozedBy = null;
          task.snoozedAt = null;
          task.updatedAt = new Date();
          await task.save();

          console.log(
            `✅ [SNOOZE WAKE-UP] Task ${task._id} unsnoozed automatically`,
          );

          // Log activity
          const { Activity } = await import("../models.js");
          await Activity.create({
            type: "TASK_UNSNOOZED",
            description: "Task unsnoozed automatically (wake-up)",
            user: task.assignedTo?._id || task.snoozedBy,
            relatedId: task._id,
            relatedType: "task",
            metadata: {
              taskId: task._id.toString(),
              snoozeExpiry: now,
              autoWakeup: true,
            },
          });

          // Send notification to assignee
          if (task.assignedTo?.email) {
            await NotificationService.createNotification({
              user_id: task.assignedTo._id,
              trigger_event: TriggerEvent.TASK_UNSNOOZED,
              related_entity: {
                entity_type: EntityType.TASK,
                entity_id: task._id,
              },
              title: "Task Wake-up",
              message: `Task "${task.title}" has been unsnoozed and is now active.`,
              priority: NotificationPriority.NORMAL,
              channels: [ChannelType.IN_APP, ChannelType.EMAIL],
              metadata: {
                task_title: task.title,
                task_id: task._id,
                snooze_expiry: now,
                assignee_name: `${task.assignedTo.firstName} ${task.assignedTo.lastName}`,
              },
            });
          }

          // ✅ ORGANIZATION LOGIC: Notify Creator and Collaborators if it's an organization task
          if (task.organization) {
            const notifiedUserIds = new Set();
            if (task.assignedTo?._id)
              notifiedUserIds.add(task.assignedTo._id.toString());

            // 1. Notify Creator (if different from assignee)
            const creatorId = task.createdBy?._id || task.createdBy;
            if (creatorId && !notifiedUserIds.has(creatorId.toString())) {
              await NotificationService.createNotification({
                user_id: creatorId,
                trigger_event: TriggerEvent.TASK_UNSNOOZED,
                related_entity: {
                  entity_type: EntityType.TASK,
                  entity_id: task._id,
                },
                title: "Task Wake-up",
                message: `Task "${task.title}" (assigned to ${task.assignedTo?.firstName || "User"}) has woken up from snooze.`,
                priority: NotificationPriority.NORMAL,
                channels: [ChannelType.IN_APP],
                metadata: {
                  task_title: task.title,
                  task_id: task._id,
                  autoWakeup: true,
                },
              });
              notifiedUserIds.add(creatorId.toString());
            }

            // 2. Notify Collaborators
            if (task.collaborators && task.collaborators.length > 0) {
              for (const collab of task.collaborators) {
                const collabId = collab._id || collab;
                if (collabId && !notifiedUserIds.has(collabId.toString())) {
                  await NotificationService.createNotification({
                    user_id: collabId,
                    trigger_event: TriggerEvent.TASK_UNSNOOZED,
                    related_entity: {
                      entity_type: EntityType.TASK,
                      entity_id: task._id,
                    },
                    title: "Task Wake-up",
                    message: `Task "${task.title}" you are collaborating on is now active.`,
                    priority: NotificationPriority.NORMAL,
                    channels: [ChannelType.IN_APP],
                    metadata: {
                      task_title: task.title,
                      task_id: task._id,
                    },
                  });
                  notifiedUserIds.add(collabId.toString());
                }
              }
            }
          }
        } catch (taskError) {
          console.error(
            `❌ [SNOOZE WAKE-UP] Error processing task ${task._id}:`,
            taskError.message,
          );
        }
      }

      return { success: true, count: expiredSnoozeTasks.length };
    } catch (error) {
      console.error(
        "❌ [SNOOZE WAKE-UP] Error checking expired snooze tasks:",
        error,
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Get status of all scheduled cron jobs with meaningful names and schedules.
   * Uses a static registry as source of truth — immune to node-cron's random task names.
   */
  static getJobsStatus() {
    const tasks = cron.getTasks();

    // ── Static registry of ALL known cron jobs in this application ──
    const JOB_REGISTRY = [
      {
        name: "morning-briefing",
        schedule: "0 * * * *",
        description:
          "☀️  Morning briefing email — fires at 08:00 in each user's timezone (IST = 08:00)",
      },
      {
        name: "overdue-task-check",
        schedule: "*/5 * * * *",
        description:
          "⚠️  Overdue task check — Critical/High every 4h, Medium every 3h, Low every 2h. MISSED alert after 24h",
      },
      {
        name: "task-assignment-check",
        schedule: "*/5 * * * *",
        description:
          "📬 Task assignment email — every 5 min, covers all task types (regular/milestone/approval/recurring/subtask)",
      },
      {
        name: "snooze-wakeup-check",
        schedule: "* * * * *",
        description:
          "⏰ Snooze wake-up — every 1 minute, restores snoozed tasks",
      },
      {
        name: "due-today-check",
        schedule: "0 * * * *",
        description:
          "📅 Tasks due today — fires at 09:00 in each user's timezone",
      },
      {
        name: "due-soon-check",
        schedule: "0 6,12,18,0 * * *",
        description:
          "🔔 Tasks due within 24h — fires every 6h (06:00, 12:00, 18:00, 00:00 UTC)",
      },
      {
        name: "3day-advance-reminder",
        schedule: "0 * * * *",
        description:
          "📆 3-day advance reminder — fires at 09:00 in each user's timezone",
      },
      {
        name: "manager-escalation",
        schedule: "0 */6 * * *",
        description:
          "🚨 Manager escalation — tasks 48h+ overdue, fires every 6h UTC",
      },
      {
        name: "admin-escalation",
        schedule: "0 10 * * *",
        description:
          "🔴 Admin escalation — tasks 7+ days overdue, fires daily at 10:00 UTC",
      },
      {
        name: "milestone-check",
        schedule: "0 11 * * *",
        description: "🎯 Milestone achievement/miss check — daily at 11:00 UTC",
      },
      {
        name: "cleanup-expired-notifications",
        schedule: "0 2 * * *",
        description: "🧹 Expired notifications cleanup — daily at 02:00 UTC",
      },
      {
        name: "audit-log-archive",
        schedule: "30 2 * * *",
        description: "🗃  Audit log archive — daily at 02:30 UTC",
      },
      {
        name: "auto-approval-check",
        schedule: "0 3 * * *",
        description: "✅ Auto-approval check — daily at 03:00 UTC",
      },
      {
        name: "daily-digest-processing",
        schedule: "0 * * * *",
        description:
          "📩 Daily email digest — fires at user's preferred hour in their timezone",
      },
      {
        name: "weekly-digest-processing",
        schedule: "0 * * * *",
        description:
          "📰 Weekly email digest — fires on user's preferred day+hour in their timezone",
      },
      {
        name: "digest-queue-cleanup",
        schedule: "30 3 * * *",
        description: "🗑  Digest queue cleanup — daily at 03:30 UTC",
      },
    ];

    // Check which jobs are actually running in node-cron's task map
    const activeTaskNames = new Set(tasks.keys());

    // IST diagnostic for morning briefing
    const nowIST = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
    const istHourStr = nowIST.split(":")[0];
    const istHour = parseInt(istHourStr, 10);
    const hoursUntilBriefing = istHour < 8 ? 8 - istHour : 24 - istHour + 8;

    // External/unnamed jobs (registered by other files, e.g. licenseCronJobs.js)
    const knownNames = new Set(JOB_REGISTRY.map((j) => j.name));
    const externalJobs = Array.from(activeTaskNames)
      .filter((n) => !knownNames.has(n))
      .map((n) => ({
        name: n,
        source: "external (licenseCronJobs or other)",
        running: true,
      }));

    return {
      isInitialized: this.isInitialized,
      totalActiveCronJobs: tasks.size,
      knownJobs: JOB_REGISTRY.length,
      externalJobs: externalJobs.length,
      serverUTCTime: new Date().toISOString(),
      istTime: nowIST,
      morningBriefingDiagnostic: {
        currentISTHour: istHour,
        firesAtISTHour: 8,
        hoursUntilNextFire: hoursUntilBriefing,
        status:
          istHour === 8
            ? "🟢 FIRING NOW (8 AM IST)"
            : `⏳ Next fire in ~${hoursUntilBriefing}h at 08:00 IST`,
      },
      jobs: JOB_REGISTRY.map((job) => ({
        name: job.name,
        schedule: job.schedule,
        description: job.description,
        registered: this.registeredJobs.has(job.name), // ✅ use our own Set
      })),
      ...(externalJobs.length > 0 && { externalUnnamedJobs: externalJobs }),
    };
  }

  // ─────────────────────────────────────────────────────────
  // TIMEZONE HELPER
  // ─────────────────────────────────────────────────────────

  /**
   * Get current time in a user's timezone as { hours, minutes, dayOfWeek }
   * @param {string} timezone - IANA timezone string (e.g. 'Asia/Kolkata')
   * @returns {{ hours: number, minutes: number, dayOfWeek: string, timeStr: string }}
   */
  static getUserLocalTime(timezone) {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        weekday: "long",
      });
      const parts = formatter.formatToParts(now);
      const hours = parseInt(
        parts.find((p) => p.type === "hour")?.value || "0",
      );
      const minutes = parseInt(
        parts.find((p) => p.type === "minute")?.value || "0",
      );
      const dayOfWeek = (
        parts.find((p) => p.type === "weekday")?.value || "monday"
      ).toLowerCase();
      const timeStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
      return { hours, minutes, dayOfWeek, timeStr };
    } catch (error) {
      // Fallback to UTC
      const now = new Date();
      return {
        hours: now.getUTCHours(),
        minutes: now.getUTCMinutes(),
        dayOfWeek: [
          "sunday",
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
        ][now.getUTCDay()],
        timeStr: `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`,
      };
    }
  }

  // ─────────────────────────────────────────────────────────
  // DAILY DIGEST PROCESSING
  // ─────────────────────────────────────────────────────────

  /**
   * Schedule daily digest processing - runs every hour to check
   * if it's the right time in each user's timezone
   */
  static scheduleDailyDigestProcessing() {
    // Run at minute 0 of every hour
    cron.schedule("0 * * * *", async () => {
      try {
        await this.processDailyDigests();
      } catch (error) {
        console.error("❌ [DIGEST] Error in daily digest processing:", error);
      }
    });
    this.registerJob("daily-digest-processing");
    console.log("✓ Daily digest processing scheduled (every hour)");
  }

  /**
   * Process daily digests for all users whose daily_digest_time matches current hour
   */
  static async processDailyDigests() {
    try {
      const { EmailDigestQueue } =
        await import("../modals/emailDigestQueueModal.js");
      const { NotificationSettings } =
        await import("../modals/notificationSettingsModal.js");
      const { emailService } = await import("./emailService.js");

      // Get all users with pending daily digest items
      const usersWithPending =
        await EmailDigestQueue.getUsersWithPendingDigest("daily");

      if (usersWithPending.length === 0) {
        return;
      }

      console.log(
        `📬 [DIGEST] Found ${usersWithPending.length} user(s) with pending daily digest`,
      );

      for (const userId of usersWithPending) {
        try {
          // Get user settings to check timezone and preferred digest time
          const settings =
            await NotificationSettings.getSettingsForUser(userId);
          const userTimezone = settings.timezone || "UTC";
          const preferredTime =
            settings.digest_settings?.daily_digest_time || "09:00";
          const preferredHour = parseInt(preferredTime.split(":")[0]);

          // Check if it's the right hour in the user's timezone
          const userLocal = this.getUserLocalTime(userTimezone);

          if (userLocal.hours !== preferredHour) {
            continue; // Not yet time for this user
          }

          console.log(
            `📬 [DIGEST] Processing daily digest for user ${userId} (timezone: ${userTimezone}, local: ${userLocal.timeStr})`,
          );

          // Get all pending digest items for this user
          const pendingItems = await EmailDigestQueue.getPendingForUser(
            userId,
            "daily",
          );

          if (pendingItems.length === 0) continue;

          // Get max items from settings
          const maxItems = settings.digest_settings?.max_digest_items || 10;
          const items = pendingItems.slice(0, maxItems);

          // Get user info
          const user = await User.findById(userId).select(
            "email firstName lastName",
          );
          if (!user?.email) {
            console.log(`📬 [DIGEST] ⚠️ User ${userId} has no email, skipping`);
            await EmailDigestQueue.markUserDigestSent(userId, "daily");
            continue;
          }

          // Build digest email HTML
          const digestHtml = this.buildDigestEmailHtml(
            items,
            user,
            "daily",
            settings,
          );

          // Send digest email
          await emailService.sendEmail({
            to: user.email,
            subject: `📋 Your Daily Notification Digest — ${new Date().toLocaleDateString("en-IN", { timeZone: userTimezone })}`,
            html: digestHtml,
            text: items
              .map((item) => `• ${item.title}: ${item.message}`)
              .join("\n"),
          });

          // Mark all as sent
          await EmailDigestQueue.markUserDigestSent(userId, "daily");
          console.log(
            `📬 [DIGEST] ✅ Daily digest sent to ${user.email} (${items.length} items)`,
          );
        } catch (userError) {
          console.error(
            `📬 [DIGEST] ❌ Error processing daily digest for user ${userId}:`,
            userError.message,
          );
          const { EmailDigestQueue: EQ } =
            await import("../modals/emailDigestQueueModal.js");
          await EQ.markUserDigestFailed(userId, "daily", userError.message);
        }
      }
    } catch (error) {
      console.error("📬 [DIGEST] ❌ Error in daily digest processing:", error);
    }
  }

  // ─────────────────────────────────────────────────────────
  // WEEKLY DIGEST PROCESSING
  // ─────────────────────────────────────────────────────────

  /**
   * Schedule weekly digest processing - runs every hour to check
   * if it's the right day + time in each user's timezone
   */
  static scheduleWeeklyDigestProcessing() {
    // Run at minute 0 of every hour
    cron.schedule("0 * * * *", async () => {
      try {
        await this.processWeeklyDigests();
      } catch (error) {
        console.error("❌ [DIGEST] Error in weekly digest processing:", error);
      }
    });
    this.registerJob("weekly-digest-processing");
    console.log("✓ Weekly digest processing scheduled (every hour)");
  }

  /**
   * Process weekly digests for users whose preferred day + time matches
   */
  static async processWeeklyDigests() {
    try {
      const { EmailDigestQueue } =
        await import("../modals/emailDigestQueueModal.js");
      const { NotificationSettings } =
        await import("../modals/notificationSettingsModal.js");
      const { emailService } = await import("./emailService.js");

      // Get all users with pending weekly digest items
      const usersWithPending =
        await EmailDigestQueue.getUsersWithPendingDigest("weekly");

      if (usersWithPending.length === 0) {
        return;
      }

      console.log(
        `📬 [DIGEST] Found ${usersWithPending.length} user(s) with pending weekly digest`,
      );

      for (const userId of usersWithPending) {
        try {
          const settings =
            await NotificationSettings.getSettingsForUser(userId);
          const userTimezone = settings.timezone || "UTC";
          const preferredDay =
            settings.digest_settings?.weekly_digest_day || "monday";
          const preferredTime =
            settings.digest_settings?.weekly_digest_time || "09:00";
          const preferredHour = parseInt(preferredTime.split(":")[0]);

          // Check if it's the right day AND hour in the user's timezone
          const userLocal = this.getUserLocalTime(userTimezone);

          if (
            userLocal.dayOfWeek !== preferredDay ||
            userLocal.hours !== preferredHour
          ) {
            continue; // Not yet time for this user
          }

          console.log(
            `📬 [DIGEST] Processing weekly digest for user ${userId} (timezone: ${userTimezone}, day: ${userLocal.dayOfWeek}, local: ${userLocal.timeStr})`,
          );

          // Get all pending digest items for this user
          const pendingItems = await EmailDigestQueue.getPendingForUser(
            userId,
            "weekly",
          );

          if (pendingItems.length === 0) continue;

          const maxItems = settings.digest_settings?.max_digest_items || 10;
          const items = pendingItems.slice(0, maxItems);

          const user = await User.findById(userId).select(
            "email firstName lastName",
          );
          if (!user?.email) {
            await EmailDigestQueue.markUserDigestSent(userId, "weekly");
            continue;
          }

          // Build digest email HTML
          const digestHtml = this.buildDigestEmailHtml(
            items,
            user,
            "weekly",
            settings,
          );

          await emailService.sendEmail({
            to: user.email,
            subject: `📋 Your Weekly Notification Digest — Week of ${new Date().toLocaleDateString("en-IN", { timeZone: userTimezone })}`,
            html: digestHtml,
            text: items
              .map((item) => `• ${item.title}: ${item.message}`)
              .join("\n"),
          });

          await EmailDigestQueue.markUserDigestSent(userId, "weekly");
          console.log(
            `📬 [DIGEST] ✅ Weekly digest sent to ${user.email} (${items.length} items)`,
          );
        } catch (userError) {
          console.error(
            `📬 [DIGEST] ❌ Error processing weekly digest for user ${userId}:`,
            userError.message,
          );
          const { EmailDigestQueue: EQ } =
            await import("../modals/emailDigestQueueModal.js");
          await EQ.markUserDigestFailed(userId, "weekly", userError.message);
        }
      }
    } catch (error) {
      console.error("📬 [DIGEST] ❌ Error in weekly digest processing:", error);
    }
  }

  // ─────────────────────────────────────────────────────────
  // DIGEST QUEUE CLEANUP
  // ─────────────────────────────────────────────────────────

  /**
   * Schedule cleanup of old sent/failed digest queue items
   */
  static scheduleDigestQueueCleanup() {
    // Run at 3:30 AM every day
    cron.schedule("30 3 * * *", async () => {
      try {
        const { EmailDigestQueue } =
          await import("../modals/emailDigestQueueModal.js");
        const result = await EmailDigestQueue.cleanupOldItems(7);
        console.log(
          `🧹 [DIGEST] Cleaned up ${result.deletedCount || 0} old digest items`,
        );
      } catch (error) {
        console.error("❌ [DIGEST] Error cleaning up digest queue:", error);
      }
    });
    this.registerJob("digest-queue-cleanup");
    console.log("✓ Digest queue cleanup scheduled (3:30 AM daily)");
  }

  // ─────────────────────────────────────────────────────────
  // DIGEST EMAIL HTML BUILDER
  // ─────────────────────────────────────────────────────────

  /**
   * Build HTML email content for a digest
   */
  static buildDigestEmailHtml(items, user, frequency, settings) {
    const userName = user.firstName || "User";
    const frequencyLabel = frequency === "daily" ? "Daily" : "Weekly";
    const userTimezone = settings.timezone || "UTC";
    const dateStr = new Date().toLocaleDateString("en-IN", {
      timeZone: userTimezone,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Group items by trigger_event type
    const grouped = {};
    for (const item of items) {
      const type = item.trigger_event || "other";
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(item);
    }

    // Build event type label mapping
    const eventLabels = {
      task_created: "📝 Task Created",
      task_updated: "✏️ Task Updated",
      task_overdue: "🚨 Task Overdue",
      task_completed: "✅ Task Completed",
      task_reassigned: "🔄 Task Reassigned",
      task_reminder: "⏰ Task Reminder",
      task_due_today: "📅 Due Today",
      task_due_soon: "⏳ Due Soon",
      comment_added: "💬 New Comment",
      user_mentioned: "👋 Mentioned",
      approval_requested: "📋 Approval Requested",
      approval_approved: "✅ Approved",
      approval_denied: "❌ Denied",
      subtask_added: "➕ Subtask Added",
      subtask_completed: "✅ Subtask Completed",
    };

    let groupedHtml = "";
    for (const [eventType, eventItems] of Object.entries(grouped)) {
      const label = eventLabels[eventType] || eventType;
      groupedHtml += `
        <tr>
          <td style="padding: 12px 0 4px; font-weight: 600; color: #1a1a1a; font-size: 14px; border-bottom: 1px solid #e5e7eb;">
            ${label} (${eventItems.length})
          </td>
        </tr>`;
      for (const item of eventItems) {
        const priorityBadge =
          item.priority === "urgent"
            ? '<span style="background:#ef4444; color:white; padding:2px 6px; border-radius:4px; font-size:11px; margin-left:6px;">URGENT</span>'
            : "";
        groupedHtml += `
        <tr>
          <td style="padding: 8px 0 8px 16px; color: #374151; font-size: 13px;">
            <strong>${item.title}</strong>${priorityBadge}<br/>
            <span style="color: #6b7280;">${item.message}</span>
          </td>
        </tr>`;
      }
    }

    return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <tr>
          <td style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">📋 ${frequencyLabel} Notification Digest</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 13px;">${dateStr} • ${items.length} notification(s)</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 24px;">
            <p style="color: #374151; margin: 0 0 16px;">Hi ${userName},</p>
            <p style="color: #6b7280; margin: 0 0 16px;">Here's your ${frequency} notification summary:</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${groupedHtml}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 16px 24px; background: #f9fafb; border-radius: 0 0 8px 8px; text-align: center;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
              Timezone: ${userTimezone} • 
              <a href="#" style="color: #3b82f6;">Manage notification preferences</a>
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>`;
  }
}
