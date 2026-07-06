import mongoose from 'mongoose';

/**
 * System Configuration Schema
 * Stores platform-wide settings for notifications, integrations, and look-and-feel
 */
const systemConfigSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        enum: [
            'SMTP_SETTINGS',
            'PUSH_NOTIFICATION_SETTINGS',
            'OAUTH_GOOGLE_SETTINGS',
            'SSO_SAML_SETTINGS',
            'GLOBAL_APPEARANCE',
            'MAINTENANCE_MODE'
        ]
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    description: String,
    updated_at: {
        type: Date,
        default: Date.now
    },
    updated_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Create index for fast lookup
systemConfigSchema.index({ key: 1 });

export const SystemConfig = mongoose.model('SystemConfig', systemConfigSchema);
