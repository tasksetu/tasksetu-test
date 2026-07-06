// 🔄 Recurring Task Cron Job Setup
// This file sets up automated scheduling for recurring task generation

import cron from 'node-cron';
import { generateScheduledRecurringTasks } from '../controller/taskController.js';

class RecurringTaskScheduler {
  constructor() {
    this.isRunning = false;
    this.lastRun = null;
    this.stats = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      totalTasksGenerated: 0
    };
  }

  // Start the cron job for recurring task generation
  start() {
    console.log('🔄 Starting Recurring Task Scheduler...');

    // Run every day at 6:00 AM
    // Cron expression: "0 6 * * *" = At 06:00 every day
    // For testing, you can use "*/5 * * * *" = Every 5 minutes

    this.cronJob = cron.schedule('0 6 * * *', async () => {
      if (this.isRunning) {
        console.log('⏭️  Recurring task generation already running, skipping...');
        return;
      }

      this.isRunning = true;
      this.lastRun = new Date();
      this.stats.totalRuns++;

      try {
        console.log(`🔄 [${this.lastRun.toISOString()}] Starting scheduled recurring task generation...`);

        const result = await generateScheduledRecurringTasks();

        if (result.success) {
          this.stats.successfulRuns++;
          this.stats.totalTasksGenerated += result.processed;

          console.log(`✅ [${new Date().toISOString()}] Recurring task generation completed:`, {
            processed: result.processed,
            errors: result.errors,
            total: result.total
          });
        } else {
          this.stats.failedRuns++;
          console.error(`❌ [${new Date().toISOString()}] Recurring task generation failed:`, result.error);
        }

      } catch (error) {
        this.stats.failedRuns++;
        console.error(`❌ [${new Date().toISOString()}] Error in recurring task cron job:`, error);
      } finally {
        this.isRunning = false;

        // Log statistics
        console.log('📊 Recurring Task Scheduler Stats:', this.stats);
      }
    }, {
      scheduled: true
      // Removed hardcoded timezone — recurring task generation is timezone-independent
      // Individual task due times use user's timezone via TimezoneHelper
    });

    console.log('✅ Recurring Task Scheduler started successfully');
    console.log('⏰ Schedule: Daily at 6:00 AM (server time) — generates tasks for all timezones');

    return this.cronJob;
  }

  // Stop the cron job
  stop() {
    if (this.cronJob) {
      this.cronJob.destroy();
      console.log('🛑 Recurring Task Scheduler stopped');
    }
  }

  // Get scheduler status
  getStatus() {
    return {
      isActive: this.cronJob ? true : false,
      isCurrentlyRunning: this.isRunning,
      lastRun: this.lastRun,
      stats: this.stats,
      nextRun: this.cronJob ? this.cronJob.getStatus() : null
    };
  }

  // Manual trigger for testing
  async triggerManual() {
    if (this.isRunning) {
      return {
        success: false,
        message: 'Recurring task generation already running'
      };
    }

    console.log('🔧 Manual trigger: Starting recurring task generation...');

    this.isRunning = true;

    try {
      const result = await generateScheduledRecurringTasks();

      if (result.success) {
        console.log('✅ Manual recurring task generation completed:', result);
      }

      return result;

    } catch (error) {
      console.error('❌ Error in manual recurring task generation:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.isRunning = false;
    }
  }
}

// Create and export singleton instance
const recurringTaskScheduler = new RecurringTaskScheduler();

export default recurringTaskScheduler;

// Example usage in server.js:
/*
import recurringTaskScheduler from './utils/recurringTaskScheduler.js';

// Start the scheduler when server starts
recurringTaskScheduler.start();

// Add route to get scheduler status
app.get('/api/admin/recurring-scheduler/status', (req, res) => {
  res.json(recurringTaskScheduler.getStatus());
});

// Add route to manually trigger (for testing)
app.post('/api/admin/recurring-scheduler/trigger', async (req, res) => {
  const result = await recurringTaskScheduler.triggerManual();
  res.json(result);
});
*/