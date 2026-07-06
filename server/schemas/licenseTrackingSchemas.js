import mongoose from 'mongoose';

// Enhanced User License Tracking Schema
const userLicenseTrackingSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organization_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  license_code: { type: String, required: true, enum: ['EXPLORE', 'PLAN', 'EXECUTE', 'OPTIMIZE'] },
  seat_assigned: { type: Boolean, default: false },
  seat_assigned_at: { type: Date },
  seat_released_at: { type: Date },
  license_limits: {
    max_projects: { type: Number, default: 0 },
    max_tasks: { type: Number, default: 0 },
    max_storage_mb: { type: Number, default: 0 },
    max_collaborators: { type: Number, default: 0 },
    features_enabled: [String]
  },
  usage_stats: {
    projects_created: { type: Number, default: 0 },
    tasks_created: { type: Number, default: 0 },
    storage_used_mb: { type: Number, default: 0 },
    last_activity: { type: Date }
  },
  status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
  assigned_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// Enhanced Organization Subscription Schema  
const organizationSubscriptionSchema = new mongoose.Schema({
  organization_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  license_code: { type: String, required: true, enum: ['EXPLORE', 'PLAN', 'EXECUTE', 'OPTIMIZE'] },
  seats_purchased: { type: Number, required: true, default: 1 },
  seats_occupied: { type: Number, default: 0 }, // Currently assigned seats
  seats_available: { type: Number, default: 1 }, // Available for assignment
  seat_history: [{
    action: { type: String, enum: ['assigned', 'released', 'transferred'], required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    from_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // For transfers
    to_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // For transfers
    performed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    timestamp: { type: Date, default: Date.now },
    reason: { type: String },
    seat_number: { type: Number } // Track specific seat number
  }],
  license_limits: {
    max_projects_per_user: { type: Number, default: 10 },
    max_tasks_per_user: { type: Number, default: 100 },
    max_storage_per_user_mb: { type: Number, default: 1000 },
    max_collaborators_per_user: { type: Number, default: 5 },
    features_enabled: [String]
  },
  billing_info: {
    price_per_seat: { type: Number, default: 0 },
    billing_cycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    next_billing_date: { type: Date },
    auto_renewal: { type: Boolean, default: true }
  },
  status: { type: String, enum: ['active', 'suspended', 'expired'], default: 'active' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

export { userLicenseTrackingSchema, organizationSubscriptionSchema };