import mongoose, { Document, Schema, Model, ObjectId } from 'mongoose';

// Escalation Level Enum
export enum EscalationLevel {
  MANAGER = 1,
  SENIOR_MANAGER = 2,
  ADMIN = 3
}

// Escalation Type Enum
export enum EscalationType {
  OVERDUE = 'overdue',
  CRITICAL = 'critical',
  RISK = 'risk'
}

// Escalation Metadata Interface
export interface IEscalationMetadata {
  hours_overdue?: number;
  task_priority?: string;
  previous_escalations?: number;
  [key: string]: any; // Allow additional metadata fields
}

// Escalation Log Interface
export interface IEscalationLog extends Document {
  task_id: ObjectId;
  escalated_from_user_id: ObjectId;
  escalated_to_user_id: ObjectId;
  escalation_level: EscalationLevel;
  escalation_type: EscalationType;
  reason: string;
  metadata: IEscalationMetadata;
  notification_id?: ObjectId;
  created_at: Date;
  // Note: No updated_at as per requirement
}

// Static methods interface
export interface IEscalationLogModel extends Model<IEscalationLog> {
  // Add any static methods here if needed in the future
}

// Mongoose Schema Definition
const escalationMetadataSchema = new Schema<IEscalationMetadata>({
  hours_overdue: {
    type: Number,
    required: false
  },
  task_priority: {
    type: String,
    required: false
  },
  previous_escalations: {
    type: Number,
    required: false,
    default: 0
  }
}, { 
  _id: false,
  strict: false // Allow additional fields
});

const escalationLogSchema = new Schema<IEscalationLog>({
  task_id: {
    type: Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
    index: true
  },
  escalated_from_user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  escalated_to_user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  escalation_level: {
    type: Number,
    enum: Object.values(EscalationLevel),
    required: true
  },
  escalation_type: {
    type: String,
    enum: Object.values(EscalationType),
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  metadata: {
    type: escalationMetadataSchema,
    required: true,
    default: {}
  },
  notification_id: {
    type: Schema.Types.ObjectId,
    ref: 'Notification',
    default: null
  }
}, {
  timestamps: { 
    createdAt: 'created_at',
    updatedAt: false // Disable updatedAt as per requirement
  }
});

// Create indexes
escalationLogSchema.index({ task_id: 1 });
escalationLogSchema.index({ escalated_to_user_id: 1 });

// Compound indexes as specified
escalationLogSchema.index({ 
  task_id: 1, 
  created_at: 1 
});

escalationLogSchema.index({ 
  escalated_to_user_id: 1, 
  created_at: 1 
});

// Handle model recompilation for development
let EscalationLog: IEscalationLogModel;

try {
  EscalationLog = mongoose.model<IEscalationLog, IEscalationLogModel>('EscalationLog');
} catch (error) {
  EscalationLog = mongoose.model<IEscalationLog, IEscalationLogModel>(
    'EscalationLog',
    escalationLogSchema
  );
}

export { EscalationLog };
export default EscalationLog;