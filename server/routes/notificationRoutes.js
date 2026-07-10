import express from 'express';
import {
  getNotifications,
  getUnreadCount,
  getNotificationStats,
  markAsRead,
  markAsUnread,
  markAllAsRead,
  deleteNotification,
  createNotification,
  retryNotification,
  getNotificationEnums,
  createSyncErrorNotification,
  testWhatsAppNotification
} from '../controller/notificationController.js';

const router = express.Router();

// GET /api/notifications - Get user notifications with pagination and filtering
router.get('/', getNotifications);

// GET /api/notifications/unread-count - Get unread notification count
router.get('/unread-count', getUnreadCount);

// GET /api/notifications/stats - Get notification statistics
router.get('/stats', getNotificationStats);

// GET /api/notifications/enums - Get notification enums for frontend
router.get('/enums', getNotificationEnums);

// PUT /api/notifications/mark-all-read - Mark all notifications as read
router.put('/mark-all-read', markAllAsRead);

// PUT /api/notifications/:id/read - Mark notification as read
router.put('/:id/read', markAsRead);

// PUT /api/notifications/:id/unread - Mark notification as unread
router.put('/:id/unread', markAsUnread);

// DELETE /api/notifications/:id - Delete (soft delete) a notification
router.delete('/:id', deleteNotification);

// POST /api/notifications - Create a new notification (admin only)
router.post('/', createNotification);

// POST /api/notifications/:id/retry - Retry failed notification channels (admin only)
router.post('/:id/retry', retryNotification);

// POST /api/notifications/sync-error - Create sync error notification
router.post('/sync-error', createSyncErrorNotification);

// POST /api/notifications/test-whatsapp - Test WhatsApp notification
router.post('/test-whatsapp', testWhatsAppNotification);

export { router as notificationRoutes };