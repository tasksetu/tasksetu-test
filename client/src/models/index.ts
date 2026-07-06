// Import models first
import { UserNotificationPreference } from './userNotificationPreference.model';
import { NotificationSuppressionRule } from './notificationSuppressionRule.model';
import { NotificationDigestQueue } from './notificationDigestQueue.model';
import { EscalationLog } from './escalationLog.model';
import { PushNotificationDevice } from './pushNotificationDevice.model';

// Core Notification Models
export { 
  TriggerEvent, 
  ChannelType, 
  EntityType, 
  NotificationPriority, 
  ChannelStatus,
  INotification,
  IChannel,
  IRelatedEntity
} from './notification.model';

// User Notification Preferences
export { 
  DigestFrequency, 
  UserRole,
  IChannelConfig,
  INotificationPreference,
  IUserNotificationPreference,
  IUserNotificationPreferenceModel,
  UserNotificationPreference,
  getDefaultPreferencesByRole
} from './userNotificationPreference.model';

// Notification Suppression Rules
export {
  INotificationSuppressionRule,
  INotificationSuppressionRuleModel,
  NotificationSuppressionRule
} from './notificationSuppressionRule.model';

// Notification Digest Queue
export {
  DigestStatus,
  INotificationDigestQueue,
  INotificationDigestQueueModel,
  NotificationDigestQueue
} from './notificationDigestQueue.model';

// Escalation Logs
export {
  EscalationLevel,
  EscalationType,
  IEscalationMetadata,
  IEscalationLog,
  IEscalationLogModel,
  EscalationLog
} from './escalationLog.model';

// Push Notification Devices
export {
  DeviceType,
  IDeviceInfo,
  IPushNotificationDevice,
  IPushNotificationDeviceModel,
  PushNotificationDevice
} from './pushNotificationDevice.model';

// Default exports for convenience
export { default as NotificationModel } from './notification.model';
export { default as UserNotificationPreferenceModel } from './userNotificationPreference.model';
export { default as NotificationSuppressionRuleModel } from './notificationSuppressionRule.model';
export { default as NotificationDigestQueueModel } from './notificationDigestQueue.model';
export { default as EscalationLogModel } from './escalationLog.model';
export { default as PushNotificationDeviceModel } from './pushNotificationDevice.model';

/**
 * All Notification System Models
 * 
 * This index file provides centralized access to all notification-related models,
 * interfaces, enums, and types used throughout the notification system.
 * 
 * Usage Examples:
 * 
 * // Import specific models
 * import { UserNotificationPreference, DigestFrequency } from './models';
 * 
 * // Import all enums
 * import { TriggerEvent, ChannelType, UserRole, DeviceType } from './models';
 * 
 * // Import interfaces for type checking
 * import { INotification, IUserNotificationPreference } from './models';
 * 
 * // Import default models
 * import { NotificationModel, UserNotificationPreferenceModel } from './models';
 */

// Type utility for notification system
export type NotificationSystemModels = {
  UserNotificationPreference: typeof UserNotificationPreference;
  NotificationSuppressionRule: typeof NotificationSuppressionRule;
  NotificationDigestQueue: typeof NotificationDigestQueue;
  EscalationLog: typeof EscalationLog;
  PushNotificationDevice: typeof PushNotificationDevice;
};

// Collection names for reference
export const COLLECTION_NAMES = {
  NOTIFICATIONS: 'notifications',
  USER_NOTIFICATION_PREFERENCES: 'usernotificationpreferences',
  NOTIFICATION_SUPPRESSION_RULES: 'notificationsuppressionrules',
  NOTIFICATION_DIGEST_QUEUE: 'notificationdigestqueues',
  ESCALATION_LOGS: 'escalationlogs',
  PUSH_NOTIFICATION_DEVICES: 'pushnotificationdevices'
} as const;

// Model registry for dynamic access
export const MODEL_REGISTRY = {
  Notification: 'notification.model',
  UserNotificationPreference: 'userNotificationPreference.model', 
  NotificationSuppressionRule: 'notificationSuppressionRule.model',
  NotificationDigestQueue: 'notificationDigestQueue.model',
  EscalationLog: 'escalationLog.model',
  PushNotificationDevice: 'pushNotificationDevice.model'
} as const;