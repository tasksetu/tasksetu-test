import { NotificationService } from '../services/notificationService.js';
import { Notification, TriggerEvent, EntityType, NotificationPriority, ChannelType } from '../modals/notificationModal.js';

/**
 * GET /api/notifications
 * Get user notifications with pagination and filtering
 */
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const {
      page = 1,
      limit = 20,
      priority,
      isRead,
      triggerEvent,
      includeExpired = false
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 100),
      priority: priority && Object.values(NotificationPriority).includes(priority) ? priority : null,
      isRead: isRead !== undefined ? isRead === 'true' : null,
      triggerEvent: triggerEvent && Object.values(TriggerEvent).includes(triggerEvent) ? triggerEvent : null,
      includeExpired: includeExpired === 'true'
    };

    const result = await NotificationService.getUserNotifications(userId, options);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/notifications/unread-count
 * Get unread notification count for user
 */
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const unreadCount = await Notification.getUnreadCount(userId);

    res.json({
      success: true,
      data: { unreadCount }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/notifications/stats
 * Get notification statistics for user
 */
export const getNotificationStats = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const stats = await NotificationService.getUserNotificationStats(userId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get notification stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * PUT /api/notifications/:id/read
 * Mark notification as read
 */
export const markAsRead = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const { id } = req.params;
    const notification = await NotificationService.markAsRead(id, userId);

    res.json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * PUT /api/notifications/:id/unread
 * Mark notification as unread
 */
export const markAsUnread = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const { id } = req.params;
    const notification = await Notification.findOne({
      _id: id,
      user_id: userId,
      deleted_at: null
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    const updatedNotification = await notification.markAsUnread();

    res.json({
      success: true,
      data: updatedNotification
    });
  } catch (error) {
    console.error('Mark notification as unread error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * PUT /api/notifications/mark-all-read
 * Mark all notifications as read for user
 */
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const result = await NotificationService.markAllAsRead(userId);

    res.json({
      success: true,
      data: result,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * DELETE /api/notifications/:id
 * Delete (soft delete) a notification
 */
export const deleteNotification = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const { id } = req.params;
    const notification = await NotificationService.deleteNotification(id, userId);

    res.json({
      success: true,
      data: notification,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/notifications
 * Create a new notification (admin only)
 */
export const createNotification = async (req, res) => {
  try {
    const userRole = req.user?.role;

    // Only allow admins and system to create notifications
    if (!['admin', 'super_admin'].some(role => userRole?.includes(role))) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    const notificationData = req.body;

    // Validate required fields
    const requiredFields = ['user_id', 'trigger_event', 'related_entity', 'title', 'message'];
    const missingFields = requiredFields.filter(field => !notificationData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    const notification = await NotificationService.createNotification(notificationData);

    res.status(201).json({
      success: true,
      data: notification,
      message: 'Notification created successfully'
    });
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/notifications/:id/retry
 * Retry failed notification channels (admin only)
 */
export const retryNotification = async (req, res) => {
  try {
    const userRole = req.user?.role;

    // Only allow admins to retry notifications
    if (!['admin', 'super_admin'].some(role => userRole?.includes(role))) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    const { id } = req.params;
    const { maxRetries = 3 } = req.body;

    const notification = await NotificationService.retryFailedChannels(id, maxRetries);

    res.json({
      success: true,
      data: notification,
      message: 'Notification channels retry initiated'
    });
  } catch (error) {
    console.error('Retry notification channels error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/notifications/enums
 * Get notification enums for frontend
 */
export const getNotificationEnums = (req, res) => {
  res.json({
    success: true,
    data: {
      TriggerEvent,
      EntityType,
      NotificationPriority,
      ChannelType
    }
  });
};

/**
 * POST /api/notifications/sync-error
 * Create sync error notification (used by calendar sync errors)
 */
export const createSyncErrorNotification = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const { error, timestamp, service } = req.body;

    const notificationData = {
      user_id: userId,
      trigger_event: TriggerEvent.CRITICAL_ESCALATION,
      related_entity: {
        entity_type: EntityType.TASK,
        entity_id: userId
      },
      title: `${service} Sync Error`,
      message: `There was an error syncing your tasks with ${service}: ${error}`,
      priority: NotificationPriority.URGENT,
      channels: [ChannelType.IN_APP, ChannelType.EMAIL],
      metadata: {
        error,
        timestamp,
        service,
        errorType: 'sync_error'
      }
    };

    const notification = await NotificationService.createNotification(notificationData);

    res.json({
      success: true,
      data: notification,
      message: 'Sync error notification created'
    });
  } catch (error) {
    console.error('Create sync error notification error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/notifications/test-whatsapp
 * Test sending a WhatsApp notification directly using raw parameters.
 */
export const testWhatsAppNotification = async (req, res) => {
  try {
    const { phone, template, language, components, message, type } = req.body;
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: "Phone number is required"
      });
    }

    const { sendWhatsApp, sendWhatsAppText } = await import('../services/whatsappService.js');
    
    let result;
    if (type === "text" || message) {
      // Sends a raw text message (Note: user must have messaged the bot in the last 24 hours)
      result = await sendWhatsAppText(phone, message);
    } else {
      // Sends a pre-approved template message
      result = await sendWhatsApp(phone, template, language, components);
    }

    res.json({
      success: true,
      message: "WhatsApp test message sent successfully",
      data: result
    });
  } catch (error) {
    console.error('Test WhatsApp notification error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

