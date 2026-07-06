import mongoose, { Document, Schema, Model, ObjectId } from 'mongoose';
import { TriggerEvent, ChannelType } from './notification.model';

// Digest Frequency Enum
export enum DigestFrequency {
  IMMEDIATE = 'immediate',
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly'
}

// User Role Enum
export enum UserRole {
  CREATOR = 'creator',
  ASSIGNEE = 'assignee',
  COLLABORATOR = 'collaborator',
  MANAGER = 'manager',
  ADMIN = 'admin'
}

// Channel Configuration Interface
export interface IChannelConfig {
  in_app: boolean;
  email: boolean;
  push: boolean;
  sms: boolean;
}

// Notification Preference Interface
export interface INotificationPreference {
  trigger_event: TriggerEvent;
  channels: IChannelConfig;
  digest_frequency: DigestFrequency;
}

// User Notification Preference Interface
export interface IUserNotificationPreference extends Document {
  user_id: ObjectId;
  preferences: INotificationPreference[];
  role: UserRole;
  created_at: Date;
  updated_at: Date;

  // Instance methods
  isChannelEnabled(triggerEvent: TriggerEvent, channelType: ChannelType): boolean;
  updatePreference(
    triggerEvent: TriggerEvent, 
    channels: Partial<IChannelConfig>, 
    digestFrequency?: DigestFrequency
  ): Promise<IUserNotificationPreference>;
}

// Static methods interface
export interface IUserNotificationPreferenceModel extends Model<IUserNotificationPreference> {
  findOrCreateForUser(userId: ObjectId, role: UserRole): Promise<IUserNotificationPreference>;
}

// Helper function to get default preferences by role
export function getDefaultPreferencesByRole(role: UserRole): INotificationPreference[] {
  const allTriggerEvents = Object.values(TriggerEvent);
  const defaultPreferences: INotificationPreference[] = [];

  // Define urgent/escalation events that should get immediate notifications
  const urgentEvents = [
    TriggerEvent.TASK_OVERDUE,
    TriggerEvent.OVERDUE_ESCALATION,
    TriggerEvent.CRITICAL_ESCALATION,
    TriggerEvent.APPROVAL_REQUESTED,
    TriggerEvent.MILESTONE_MISSED,
    TriggerEvent.TASK_DUE_TODAY,
    TriggerEvent.TASK_DUE_SOON
  ];

  // Define high-priority events for managers/admins
  const managerEvents = [
    TriggerEvent.TASK_CREATED,
    TriggerEvent.TASK_REASSIGNED,
    TriggerEvent.APPROVAL_REQUESTED,
    TriggerEvent.APPROVAL_DENIED,
    TriggerEvent.MILESTONE_MISSED,
    TriggerEvent.OVERDUE_ESCALATION,
    TriggerEvent.CRITICAL_ESCALATION
  ];

  for (const triggerEvent of allTriggerEvents) {
    const isUrgent = urgentEvents.includes(triggerEvent);
    const isManagerEvent = managerEvents.includes(triggerEvent);
    const isManagerOrAdmin = role === UserRole.MANAGER || role === UserRole.ADMIN;

    const preference: INotificationPreference = {
      trigger_event: triggerEvent,
      channels: {
        in_app: true, // Always enabled for all events
        email: true,  // Email enabled for all by default
        push: isManagerOrAdmin && (isUrgent || isManagerEvent), // Push for managers/admins on important events
        sms: false    // SMS disabled by default
      },
      digest_frequency: isUrgent ? DigestFrequency.IMMEDIATE : DigestFrequency.DAILY
    };

    defaultPreferences.push(preference);
  }

  return defaultPreferences;
}

// Mongoose Schema Definition
const channelConfigSchema = new Schema<IChannelConfig>({
  in_app: { type: Boolean, default: true },
  email: { type: Boolean, default: true },
  push: { type: Boolean, default: false },
  sms: { type: Boolean, default: false }
}, { _id: false });

const notificationPreferenceSchema = new Schema<INotificationPreference>({
  trigger_event: {
    type: String,
    enum: Object.values(TriggerEvent),
    required: true
  },
  channels: {
    type: channelConfigSchema,
    required: true
  },
  digest_frequency: {
    type: String,
    enum: Object.values(DigestFrequency),
    default: DigestFrequency.IMMEDIATE
  }
}, { _id: false });

const userNotificationPreferenceSchema = new Schema<IUserNotificationPreference>({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  preferences: [notificationPreferenceSchema],
  role: {
    type: String,
    enum: Object.values(UserRole),
    required: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Instance Methods
userNotificationPreferenceSchema.methods.isChannelEnabled = function(
  triggerEvent: TriggerEvent, 
  channelType: ChannelType
): boolean {
  const preference = this.preferences.find(
    (pref: INotificationPreference) => pref.trigger_event === triggerEvent
  );
  
  // If no specific preference found, return true (default enabled)
  if (!preference) {
    return true;
  }
  
  return preference.channels[channelType] || false;
};

userNotificationPreferenceSchema.methods.updatePreference = async function(
  triggerEvent: TriggerEvent,
  channels: Partial<IChannelConfig>,
  digestFrequency?: DigestFrequency
): Promise<IUserNotificationPreference> {
  const existingPreferenceIndex = this.preferences.findIndex(
    (pref: INotificationPreference) => pref.trigger_event === triggerEvent
  );

  const updatedChannels: IChannelConfig = {
    in_app: true, // Always ensure in_app is true
    email: channels.email !== undefined ? channels.email : true,
    push: channels.push !== undefined ? channels.push : false,
    sms: channels.sms !== undefined ? channels.sms : false
  };

  const updatedPreference: INotificationPreference = {
    trigger_event: triggerEvent,
    channels: updatedChannels,
    digest_frequency: digestFrequency || DigestFrequency.IMMEDIATE
  };

  if (existingPreferenceIndex >= 0) {
    // Update existing preference
    this.preferences[existingPreferenceIndex] = updatedPreference;
  } else {
    // Add new preference
    this.preferences.push(updatedPreference);
  }

  return await this.save();
};

// Static Methods
userNotificationPreferenceSchema.statics.findOrCreateForUser = async function(
  userId: ObjectId,
  role: UserRole
): Promise<IUserNotificationPreference> {
  let userPreference = await this.findOne({ user_id: userId });

  if (!userPreference) {
    // Create new user preference with default settings
    const defaultPreferences = getDefaultPreferencesByRole(role);
    
    userPreference = new this({
      user_id: userId,
      preferences: defaultPreferences,
      role: role
    });

    await userPreference.save();
  }

  return userPreference;
};

// Create indexes
userNotificationPreferenceSchema.index({ user_id: 1 }, { unique: true });
userNotificationPreferenceSchema.index({ role: 1 });
userNotificationPreferenceSchema.index({ 'preferences.trigger_event': 1 });

// Handle model recompilation for development
let UserNotificationPreference: IUserNotificationPreferenceModel;

try {
  UserNotificationPreference = mongoose.model<IUserNotificationPreference, IUserNotificationPreferenceModel>('UserNotificationPreference');
} catch (error) {
  UserNotificationPreference = mongoose.model<IUserNotificationPreference, IUserNotificationPreferenceModel>(
    'UserNotificationPreference',
    userNotificationPreferenceSchema
  );
}

export { UserNotificationPreference };
export default UserNotificationPreference;