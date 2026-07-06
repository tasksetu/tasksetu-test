import { Document, ObjectId } from 'mongoose';

// Trigger Events Enum
export enum TriggerEvent {
  TASK_CREATED = 'task_created',
  TASK_UPDATED = 'task_updated',
  TASK_OVERDUE = 'task_overdue',
  TASK_COMPLETED = 'task_completed',
  TASK_REASSIGNED = 'task_reassigned',
  SUBTASK_ADDED = 'subtask_added',
  SUBTASK_COMPLETED = 'subtask_completed',
  RECURRING_INSTANCE_CREATED = 'recurring_instance_created',
  QUICK_TASK_COMPLETED = 'quick_task_completed',
  QUICK_TASK_CONVERTED = 'quick_task_converted',
  APPROVAL_REQUESTED = 'approval_requested',
  APPROVAL_APPROVED = 'approval_approved',
  APPROVAL_DENIED = 'approval_denied',
  TASK_REMINDER = 'task_reminder',
  TASK_DUE_TODAY = 'task_due_today',
  TASK_DUE_SOON = 'task_due_soon',
  USER_MENTIONED = 'user_mentioned',
  COMMENT_ADDED = 'comment_added',
  FILE_UPLOADED = 'file_uploaded',
  FILE_EDITED = 'file_edited',
  MILESTONE_ACHIEVED = 'milestone_achieved',
  MILESTONE_MISSED = 'milestone_missed',
  OVERDUE_ESCALATION = 'overdue_escalation',
  CRITICAL_ESCALATION = 'critical_escalation',
  SYSTEM_TEST = 'system_test'
}

// Channel Types Enum
export enum ChannelType {
  IN_APP = 'in_app',
  EMAIL = 'email',
  PUSH = 'push',
  SMS = 'sms'
}

// Entity Types Enum
export enum EntityType {
  TASK = 'task',
  SUBTASK = 'subtask',
  APPROVAL = 'approval',
  COMMENT = 'comment',
  ATTACHMENT = 'attachment',
  MILESTONE = 'milestone',
  SYSTEM = 'system'
}

// Notification Priority Enum
export enum NotificationPriority {
  URGENT = 'urgent',
  NORMAL = 'normal'
}

// Channel Status Enum
export enum ChannelStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  SUPPRESSED = 'suppressed'
}

// Channel Interface
export interface IChannel {
  channel_type: ChannelType;
  status: ChannelStatus;
  sent_at?: Date;
  error_message?: string;
  retry_count: number;
}

// Related Entity Interface
export interface IRelatedEntity {
  entity_type: EntityType;
  entity_id: ObjectId;
}

// Notification Interface
export interface INotification extends Document {
  user_id: ObjectId;
  trigger_event: TriggerEvent;
  related_entity: IRelatedEntity;
  priority: NotificationPriority;
  title: string;
  message: string;
  channels: IChannel[];
  metadata?: Record<string, any>;
  is_read: boolean;
  read_at?: Date;
  expires_at?: Date;
  deleted_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export default {
  TriggerEvent,
  ChannelType,
  EntityType,
  NotificationPriority,
  ChannelStatus
};