import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
    },
    discount: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
    },
    valid: {
        type: Boolean,
        default: true,
    },
    expires_at: {
        type: Date,
        required: true,
    },
    usage_limit: {
        type: Number,
        default: null, // null means unlimited
    },
    usage_count: {
        type: Number,
        default: 0,
    },
    applicable_plans: {
        type: [String],
        default: [], // Empty array means applicable to all plans
    },
    created_at: {
        type: Date,
        default: Date.now,
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    description: {
        type: String,
        default: '',
    },
});

// Index for faster lookup
couponSchema.index({ expires_at: 1 });

// Method to check if coupon is valid
couponSchema.methods.isValid = function () {
    if (!this.valid) return false;
    if (this.expires_at < new Date()) return false;
    if (this.usage_limit !== null && this.usage_count >= this.usage_limit) return false;
    return true;
};

export const Coupon = mongoose.model('Coupon', couponSchema);
