import express from 'express';
import { NotificationSettings, NotificationFrequency } from '../modals/notificationSettingsModal.js';
import { authenticateToken } from '../middleware/roleAuth.js';
import * as licenseService from '../services/licenseService.js';

const router = express.Router();

/**
 * ✅ License Feature Mapping for Notifications:
 * - NOTIF_BASIC: in_app notifications
 * - NOTIF_ADV: email, push, sms notifications
 */

/**
 * Helper middleware to check advanced notification feature access
 * Used when enabling email/push/sms channels
 */
const checkAdvancedNotificationAccess = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const channelType = req.params?.channelType;
    const updateData = req.body;

    // 🔓 BYPASS: Super admins have full access to all notification features
    if (userRole && (userRole.includes('super_admin') || userRole === 'super_admin')) {
      console.log('✅ [NOTIF_ADV] Super admin - bypassing license check');
      return next();
    }

    // Check if trying to enable advanced channels
    const advancedChannels = ['email', 'push', 'sms'];
    let needsAdvancedCheck = false;

    // Check from route params (for /channels/:channelType)
    if (channelType && advancedChannels.includes(channelType)) {
      if (updateData.enabled === true) {
        needsAdvancedCheck = true;
      }
    }

    // Check from body (for PUT / update all settings)
    if (updateData.channels) {
      for (const ch of advancedChannels) {
        if (updateData.channels[ch]?.enabled === true) {
          needsAdvancedCheck = true;
          break;
        }
      }
    }

    if (needsAdvancedCheck) {
      console.log('🔐 [NOTIF_ADV CHECK] Checking advanced notification access for user:', userId);
      
      const accessCheck = await licenseService.checkFeatureAccess(userId, 'NOTIF_ADV');
      
      if (!accessCheck.hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Advanced notifications (Email, Push, SMS) require an upgraded plan',
          error: 'FEATURE_NOT_AVAILABLE',
          feature: 'NOTIF_ADV',
          upgradeRequired: true,
          showUpgradeModal: true,
        });
      }
    }

    next();
  } catch (error) {
    console.error('❌ Error checking advanced notification access:', error);
    res.status(500).json({
      success: false,
      error: 'Error checking feature access'
    });
  }
};

/**
 * @swagger
 * components:
 *   schemas:
 *     NotificationSettings:
 *       type: object
 *       properties:
 *         user_id:
 *           type: string
 *           description: User ID
 *         notifications_enabled:
 *           type: boolean
 *           description: Master switch for all notifications
 *         channels:
 *           type: object
 *           properties:
 *             in_app:
 *               $ref: '#/components/schemas/ChannelSettings'
 *             email:
 *               $ref: '#/components/schemas/ChannelSettings'
 *             push:
 *               $ref: '#/components/schemas/ChannelSettings'
 *             sms:
 *               $ref: '#/components/schemas/ChannelSettings'
 *         event_preferences:
 *           $ref: '#/components/schemas/EventPreferences'
 *         digest_settings:
 *           $ref: '#/components/schemas/DigestSettings'
 *         timezone:
 *           type: string
 *           description: User timezone
 *         language:
 *           type: string
 *           description: Language preference
 * 
 *     ChannelSettings:
 *       type: object
 *       properties:
 *         enabled:
 *           type: boolean
 *           description: Whether channel is enabled
 *         frequency:
 *           type: string
 *           enum: [real_time, digest_daily, digest_weekly, off]
 *           description: Notification frequency
 *         quiet_hours:
 *           type: object
 *           properties:
 *             start:
 *               type: string
 *               description: Start time (HH:MM)
 *             end:
 *               type: string
 *               description: End time (HH:MM)
 *             enabled:
 *               type: boolean
 *               description: Whether quiet hours are active
 * 
 *     EventPreferences:
 *       type: object
 *       properties:
 *         task_assigned:
 *           type: boolean
 *         task_due_soon:
 *           type: boolean
 *         task_due_today:
 *           type: boolean
 *         task_overdue:
 *           type: boolean
 *         task_completed:
 *           type: boolean
 *         task_status_changed:
 *           type: boolean
 *         task_reassigned:
 *           type: boolean
 *         task_updated:
 *           type: boolean
 *         task_commented:
 *           type: boolean
 *         task_reminder:
 *           type: boolean
 *         project_assigned:
 *           type: boolean
 *         project_updated:
 *           type: boolean
 *         project_completed:
 *           type: boolean
 *         project_milestone_reached:
 *           type: boolean
 *         team_member_added:
 *           type: boolean
 *         team_member_removed:
 *           type: boolean
 *         team_updated:
 *           type: boolean
 *         system_maintenance:
 *           type: boolean
 *         security_alert:
 *           type: boolean
 *         feature_announcement:
 *           type: boolean
 * 
 *     DigestSettings:
 *       type: object
 *       properties:
 *         daily_digest_time:
 *           type: string
 *           description: Time for daily digest (HH:MM)
 *         weekly_digest_day:
 *           type: string
 *           enum: [monday, tuesday, wednesday, thursday, friday, saturday, sunday]
 *         weekly_digest_time:
 *           type: string
 *           description: Time for weekly digest (HH:MM)
 *         include_completed_tasks:
 *           type: boolean
 *         max_digest_items:
 *           type: number
 *           minimum: 1
 *           maximum: 50
 */

/**
 * @swagger
 * /api/notification-settings:
 *   get:
 *     summary: Get current user's notification settings
 *     tags: [Notification Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification settings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/NotificationSettings'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const settings = await NotificationSettings.getSettingsForUser(req.user.id);

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notification settings'
    });
  }
});

/**
 * @swagger
 * /api/notification-settings:
 *   put:
 *     summary: Update current user's notification settings
 *     tags: [Notification Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notifications_enabled:
 *                 type: boolean
 *               channels:
 *                 type: object
 *               event_preferences:
 *                 type: object
 *               digest_settings:
 *                 type: object
 *               timezone:
 *                 type: string
 *               language:
 *                 type: string
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/NotificationSettings'
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.put('/', authenticateToken, checkAdvancedNotificationAccess, async (req, res) => {
  try {
    const userId = req.user.id;
    const updateData = req.body;

    // Remove user_id from update data if present (security measure)
    delete updateData.user_id;

    // Validate frequency values if channels are being updated
    if (updateData.channels) {
      for (const channelType in updateData.channels) {
        const channel = updateData.channels[channelType];
        if (channel.frequency && !Object.values(NotificationFrequency).includes(channel.frequency)) {
          return res.status(400).json({
            success: false,
            error: `Invalid frequency value: ${channel.frequency}`
          });
        }
      }
    }

    // Validate digest day if present
    if (updateData.digest_settings?.weekly_digest_day) {
      const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      if (!validDays.includes(updateData.digest_settings.weekly_digest_day)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid weekly digest day'
        });
      }
    }

    const updatedSettings = await NotificationSettings.findOneAndUpdate(
      { user_id: userId },
      { $set: updateData },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({
      success: true,
      data: updatedSettings
    });
  } catch (error) {
    console.error('Error updating notification settings:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid settings data',
        details: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update notification settings'
    });
  }
});

/**
 * @swagger
 * /api/notification-settings/channels/{channelType}:
 *   patch:
 *     summary: Update specific channel settings
 *     tags: [Notification Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: channelType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [in_app, email, push, sms]
 *         description: Channel type to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChannelSettings'
 *     responses:
 *       200:
 *         description: Channel settings updated successfully
 *       400:
 *         description: Invalid channel type or settings
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.patch('/channels/:channelType', authenticateToken, checkAdvancedNotificationAccess, async (req, res) => {
  try {
    const { channelType } = req.params;
    const channelSettings = req.body;
    const userId = req.user.id;

    // Validate channel type
    const validChannels = ['in_app', 'email', 'push', 'sms'];
    if (!validChannels.includes(channelType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid channel type'
      });
    }

    // Validate frequency if provided
    if (channelSettings.frequency && !Object.values(NotificationFrequency).includes(channelSettings.frequency)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid frequency value'
      });
    }

    const updatedSettings = await NotificationSettings.updateChannelSettings(
      userId,
      channelType,
      channelSettings
    );

    res.json({
      success: true,
      data: updatedSettings
    });
  } catch (error) {
    console.error('Error updating channel settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update channel settings'
    });
  }
});

/**
 * @swagger
 * /api/notification-settings/events:
 *   patch:
 *     summary: Update event preferences
 *     tags: [Notification Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EventPreferences'
 *     responses:
 *       200:
 *         description: Event preferences updated successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.patch('/events', authenticateToken, async (req, res) => {
  try {
    const eventPreferences = req.body;
    const userId = req.user.id;

    const updatedSettings = await NotificationSettings.updateEventPreferences(
      userId,
      eventPreferences
    );

    res.json({
      success: true,
      data: updatedSettings
    });
  } catch (error) {
    console.error('Error updating event preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update event preferences'
    });
  }
});

/**
 * @swagger
 * /api/notification-settings/toggle:
 *   post:
 *     summary: Toggle all notifications on/off
 *     tags: [Notification Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled:
 *                 type: boolean
 *                 description: Enable or disable all notifications
 *             required:
 *               - enabled
 *     responses:
 *       200:
 *         description: Notification toggle updated successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/toggle', authenticateToken, async (req, res) => {
  try {
    const { enabled } = req.body;
    const userId = req.user.id;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'enabled must be a boolean value'
      });
    }

    const updatedSettings = await NotificationSettings.findOneAndUpdate(
      { user_id: userId },
      { $set: { notifications_enabled: enabled } },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      data: updatedSettings,
      message: `Notifications ${enabled ? 'enabled' : 'disabled'} successfully`
    });
  } catch (error) {
    console.error('Error toggling notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle notifications'
    });
  }
});

/**
 * @swagger
 * /api/notification-settings/reset:
 *   post:
 *     summary: Reset notification settings to defaults
 *     tags: [Notification Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings reset to defaults successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/reset', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Delete existing settings
    await NotificationSettings.findOneAndDelete({ user_id: userId });

    // Create new default settings
    const defaultSettings = await NotificationSettings.createDefaultSettings(userId);

    res.json({
      success: true,
      data: defaultSettings,
      message: 'Notification settings reset to defaults'
    });
  } catch (error) {
    console.error('Error resetting notification settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset notification settings'
    });
  }
});

/**
 * @swagger
 * /api/notification-settings/test:
 *   post:
 *     summary: Send a test notification to verify settings
 *     tags: [Notification Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               channels:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [in_app, email, push, sms]
 *                 description: Channels to test (optional, defaults to all enabled)
 *     responses:
 *       200:
 *         description: Test notification sent successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { channels } = req.body;

    const { NotificationService } = await import('../services/notificationService.js');
    const { TriggerEvent, EntityType, NotificationPriority, ChannelType } = await import('../modals/notificationModal.js');

    // Get user settings to determine which channels to test
    const settings = await NotificationSettings.getSettingsForUser(userId);

    let testChannels = channels;
    if (!testChannels) {
      // Use all enabled channels if none specified
      testChannels = [
        ChannelType.IN_APP,
        ChannelType.EMAIL,
        ChannelType.PUSH,
        ChannelType.SMS
      ].filter(channel => settings.isChannelEnabled(channel));
    }

    const testNotification = await NotificationService.createNotification({
      user_id: userId,
      trigger_event: TriggerEvent.SYSTEM_TEST,
      related_entity: {
        entity_type: EntityType.SYSTEM,
        entity_id: userId
      },
      title: 'Test Notification',
      message: 'This is a test notification to verify your notification settings are working correctly.',
      priority: NotificationPriority.NORMAL,
      channels: testChannels,
      metadata: {
        test: true,
        timestamp: new Date().toISOString()
      }
    });

    res.json({
      success: true,
      data: testNotification,
      message: 'Test notification sent successfully'
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test notification'
    });
  }
});

export default router;