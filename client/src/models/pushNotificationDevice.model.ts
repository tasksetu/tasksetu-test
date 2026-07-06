import mongoose, { Document, Schema, Model, ObjectId } from 'mongoose';

// Device Type Enum
export enum DeviceType {
  IOS = 'ios',
  ANDROID = 'android',
  WEB = 'web'
}

// Device Info Interface
export interface IDeviceInfo {
  browser?: string;
  os_version?: string;
  app_version?: string;
  [key: string]: any; // Allow additional device info fields
}

// Push Notification Device Interface
export interface IPushNotificationDevice extends Document {
  user_id: ObjectId;
  device_token: string;
  device_type: DeviceType;
  device_info: IDeviceInfo;
  is_active: boolean;
  last_used_at: Date;
  created_at: Date;
  updated_at: Date;

  // Instance methods
  updateLastUsed(): Promise<IPushNotificationDevice>;
  deactivate(): Promise<IPushNotificationDevice>;
}

// Static methods interface
export interface IPushNotificationDeviceModel extends Model<IPushNotificationDevice> {
  cleanupInactive(daysInactive?: number): Promise<number>;
}

// Mongoose Schema Definition
const deviceInfoSchema = new Schema<IDeviceInfo>({
  browser: {
    type: String,
    required: false
  },
  os_version: {
    type: String,
    required: false
  },
  app_version: {
    type: String,
    required: false
  }
}, { 
  _id: false,
  strict: false // Allow additional fields
});

const pushNotificationDeviceSchema = new Schema<IPushNotificationDevice>({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  device_token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  device_type: {
    type: String,
    enum: Object.values(DeviceType),
    required: true
  },
  device_info: {
    type: deviceInfoSchema,
    required: true,
    default: {}
  },
  is_active: {
    type: Boolean,
    default: true,
    index: true
  },
  last_used_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Instance Methods
pushNotificationDeviceSchema.methods.updateLastUsed = async function(): Promise<IPushNotificationDevice> {
  this.last_used_at = new Date();
  this.is_active = true; // Reactivate if it was inactive
  return await this.save();
};

pushNotificationDeviceSchema.methods.deactivate = async function(): Promise<IPushNotificationDevice> {
  this.is_active = false;
  return await this.save();
};

// Static Methods
pushNotificationDeviceSchema.statics.cleanupInactive = async function(
  daysInactive: number = 90
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

  const result = await this.updateMany(
    {
      last_used_at: { $lt: cutoffDate },
      is_active: true
    },
    {
      $set: { is_active: false }
    }
  );

  return result.modifiedCount || 0;
};

// Create indexes
pushNotificationDeviceSchema.index({ user_id: 1 });
pushNotificationDeviceSchema.index({ device_token: 1 }, { unique: true });
pushNotificationDeviceSchema.index({ is_active: 1 });
pushNotificationDeviceSchema.index({ last_used_at: 1 });

// Compound index as specified
pushNotificationDeviceSchema.index({ 
  user_id: 1, 
  is_active: 1 
});

// Handle model recompilation for development
let PushNotificationDevice: IPushNotificationDeviceModel;

try {
  PushNotificationDevice = mongoose.model<IPushNotificationDevice, IPushNotificationDeviceModel>('PushNotificationDevice');
} catch (error) {
  PushNotificationDevice = mongoose.model<IPushNotificationDevice, IPushNotificationDeviceModel>(
    'PushNotificationDevice',
    pushNotificationDeviceSchema
  );
}

export { PushNotificationDevice };
export default PushNotificationDevice;