import mongoose from 'mongoose';
import { Coupon } from './modals/couponModal.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb+srv://jeeturadicalloop:Mjvesqnj8gY3t0zP@cluster0.by2xy6x.mongodb.net/TaskSetu';

/**
 * Script to create test coupon codes for the validate-coupon API
 */
async function createTestCoupons() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000,
            family: 4,
        });
        console.log('✅ Connected to MongoDB');

        // Clear existing test coupons (optional)
        await Coupon.deleteMany({ code: { $in: ['WELCOME25', 'SAVE50', 'EXPIRED10'] } });
        console.log('🗑️  Cleared existing test coupons');

        // Create test coupons
        const testCoupons = [
            {
                code: 'WELCOME25',
                discount: 25,
                valid: true,
                expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
                usage_limit: 100,
                usage_count: 0,
                applicable_plans: [], // Applicable to all plans
                description: 'Welcome discount - 25% off',
            },
            {
                code: 'SAVE50',
                discount: 50,
                valid: true,
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
                usage_limit: 50,
                usage_count: 0,
                applicable_plans: ['EXECUTE', 'OPTIMIZE'], // Only for specific plans
                description: 'Limited time offer - 50% off on Execute and Optimize plans',
            },
            {
                code: 'EXPIRED10',
                discount: 10,
                valid: true,
                expires_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago (expired)
                usage_limit: null,
                usage_count: 0,
                applicable_plans: [],
                description: 'Expired coupon for testing',
            },
            {
                code: 'INACTIVE20',
                discount: 20,
                valid: false, // Deactivated
                expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
                usage_limit: null,
                usage_count: 0,
                applicable_plans: [],
                description: 'Inactive coupon for testing',
            },
            {
                code: 'NEWYEAR30',
                discount: 30,
                valid: true,
                expires_at: new Date('2025-12-31'), // End of 2025
                usage_limit: null, // Unlimited
                usage_count: 0,
                applicable_plans: [],
                description: 'New Year Special - 30% off',
            },
        ];

        // Insert coupons
        const result = await Coupon.insertMany(testCoupons);
        console.log(`✅ Successfully created ${result.length} test coupons:`);

        result.forEach((coupon) => {
            const status = coupon.isValid() ? '✅ Valid' : '❌ Invalid';
            console.log(`   ${status} - Code: ${coupon.code} | Discount: ${coupon.discount}% | Expires: ${coupon.expires_at.toLocaleDateString()}`);
        });

        console.log('\n📋 Test Coupon Codes:');
        console.log('   WELCOME25  - 25% off (Valid, expires in 90 days)');
        console.log('   SAVE50     - 50% off (Valid, expires in 30 days, Execute/Optimize only)');
        console.log('   NEWYEAR30  - 30% off (Valid, expires Dec 31, 2025, unlimited usage)');
        console.log('   EXPIRED10  - 10% off (Expired 7 days ago)');
        console.log('   INACTIVE20 - 20% off (Deactivated)');

        console.log('\n✅ Test coupons created successfully!');
        console.log('\n📝 Test the API with:');
        console.log('   POST /api/license/validate-coupon');
        console.log('   Body: { "code": "WELCOME25" }');

    } catch (error) {
        console.error('❌ Error creating test coupons:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

// Run the script
createTestCoupons();
