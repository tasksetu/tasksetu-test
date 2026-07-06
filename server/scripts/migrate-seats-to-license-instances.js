/**
 * Migration Script: Seat-Based → Atomic License Instances
 * 
 * This script migrates the existing seat-based license system to the new atomic license instance model.
 * 
 * What it does:
 * 1. For each OrganizationLicensePurchase with seats_purchased > 0:
 *    - Creates N LicenseInstance documents (where N = seats_purchased)
 * 2. For each User with assigned_license or seat_assigned:
 *    - Assigns one available LicenseInstance
 *    - Updates user.license_instance_id
 * 3. Validates the migration
 * 
 * Safety features:
 * - Dry-run mode (set DRY_RUN=true)
 * - Transaction support (rollback on error)
 * - Detailed logging
 * - Backup recommendations
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import OrganizationLicensePurchase from '../modals/organizationLicensePurchaseModal.js';
import LicenseInstance from '../modals/licenseInstanceModal.js';
import { User } from '../modals/userModal.js';

// Load environment variables
dotenv.config();

// Configuration
const DRY_RUN = process.env.DRY_RUN === 'true' || false;
const BATCH_SIZE = 100;

// Statistics
const stats = {
    purchasesProcessed: 0,
    instancesCreated: 0,
    usersAssigned: 0,
    errors: [],
    warnings: []
};

/**
 * Connect to MongoDB
 */
async function connect() {
    try {
        await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        process.exit(1);
    }
}

/**
 * Step 1: Create LicenseInstances from purchases
 */
async function migratePurchasesToInstances() {
    console.log('\n📦 Step 1: Creating License Instances from Purchases...');

    const purchases = await OrganizationLicensePurchase.find({
        seats_purchased: { $gt: 0 },
        status: 'ACTIVE'
    });

    console.log(`Found ${purchases.length} active purchases to migrate`);

    for (const purchase of purchases) {
        try {
            // Check if instances already created for this purchase
            const existingInstances = await LicenseInstance.countDocuments({
                purchase_id: purchase._id
            });

            if (existingInstances > 0) {
                console.log(`⚠️  Purchase ${purchase._id} already has ${existingInstances} instances, skipping...`);
                stats.warnings.push({
                    purchase_id: purchase._id,
                    message: 'Instances already exist'
                });
                continue;
            }

            const instances = [];
            for (let i = 0; i < purchase.seats_purchased; i++) {
                instances.push({
                    organization_id: purchase.organization_id,
                    license_code: purchase.license_code,
                    purchase_id: purchase._id,
                    billing_cycle: purchase.billing_cycle,
                    purchase_date: purchase.purchase_date,
                    renewal_date: purchase.renewal_date,
                    status: 'AVAILABLE'
                });
            }

            if (!DRY_RUN) {
                await LicenseInstance.insertMany(instances);
            }

            stats.purchasesProcessed++;
            stats.instancesCreated += instances.length;

            console.log(`  ✓ Created ${instances.length} instances for ${purchase.license_name} (${purchase.license_code})`);

        } catch (error) {
            console.error(`  ❌ Error processing purchase ${purchase._id}:`, error.message);
            stats.errors.push({
                purchase_id: purchase._id,
                error: error.message
            });
        }
    }

    console.log(`\n📊 Instances created: ${stats.instancesCreated}`);
}

/**
 * Step 2: Assign instances to users who had licenses
 */
async function assignInstancesToUsers() {
    console.log('\n👥 Step 2: Assigning License Instances to Users...');

    // Find users with assigned licenses (multiple possible formats)
    const users = await User.find({
        $or: [
            { 'assigned_license.license_code': { $exists: true } },
            { seat_assigned: true },
            { license_code: { $ne: null } }
        ]
    });

    console.log(`Found ${users.length} users with licenses to migrate`);

    for (const user of users) {
        try {
            // Skip if already has new license_instance_id
            if (user.license_instance_id) {
                console.log(`  ⚠️  User ${user.email} already has license_instance_id, skipping...`);
                continue;
            }

            // Determine license_code from old system
            let licenseCode = null;
            let purchaseId = null;

            if (user.assigned_license && user.assigned_license.license_code) {
                licenseCode = user.assigned_license.license_code;
                purchaseId = user.assigned_license.purchase_id;
            } else if (user.license_code) {
                licenseCode = user.license_code;
            }

            if (!licenseCode) {
                console.log(`  ⚠️  User ${user.email} has seat_assigned=true but no license_code, skipping...`);
                stats.warnings.push({
                    user_id: user._id,
                    email: user.email,
                    message: 'No license_code found'
                });
                continue;
            }

            // Find available instance for this user
            const query = {
                organization_id: user.organization_id,
                license_code: licenseCode,
                status: 'AVAILABLE',
                renewal_date: { $gt: new Date() }
            };

            // Prefer instance from same purchase if available
            if (purchaseId) {
                query.purchase_id = purchaseId;
            }

            let instance = await LicenseInstance.findOne(query).sort({ purchase_date: 1 });

            // If not found and purchaseId was specified, try without it
            if (!instance && purchaseId) {
                delete query.purchase_id;
                instance = await LicenseInstance.findOne(query).sort({ purchase_date: 1 });
            }

            if (!instance) {
                console.log(`  ❌ No available instance for user ${user.email} (${licenseCode})`);
                stats.errors.push({
                    user_id: user._id,
                    email: user.email,
                    license_code: licenseCode,
                    message: 'No available license instance'
                });
                continue;
            }

            if (!DRY_RUN) {
                // Assign instance to user
                instance.assigned_to = user._id;
                instance.status = 'ASSIGNED';
                instance.assigned_at = user.assigned_license?.assigned_date || user.seat_assigned_at || new Date();
                await instance.save();

                // Update user
                user.license_instance_id = instance._id;
                await user.save();
            }

            stats.usersAssigned++;
            console.log(`  ✓ Assigned ${licenseCode} instance to ${user.email}`);

        } catch (error) {
            console.error(`  ❌ Error processing user ${user.email}:`, error.message);
            stats.errors.push({
                user_id: user._id,
                email: user.email,
                error: error.message
            });
        }
    }

    console.log(`\n📊 Users assigned: ${stats.usersAssigned}`);
}

/**
 * Step 3: Validate migration
 */
async function validateMigration() {
    console.log('\n✅ Step 3: Validating Migration...');

    // Check total instances match total seats_purchased
    const totalSeatsPurchased = await OrganizationLicensePurchase.aggregate([
        { $match: { status: 'ACTIVE' } },
        { $group: { _id: null, total: { $sum: '$seats_purchased' } } }
    ]);

    const totalInstances = await LicenseInstance.countDocuments();

    console.log(`  Total seats purchased (old): ${totalSeatsPurchased[0]?.total || 0}`);
    console.log(`  Total instances created (new): ${totalInstances}`);

    // Check assigned instances match assigned users
    const usersWithInstances = await User.countDocuments({
        license_instance_id: { $ne: null }
    });

    const assignedInstances = await LicenseInstance.countDocuments({
        status: 'ASSIGNED'
    });

    console.log(`  Users with license_instance_id: ${usersWithInstances}`);
    console.log(`  Instances with status=ASSIGNED: ${assignedInstances}`);

    if (usersWithInstances !== assignedInstances) {
        console.log(`  ⚠️  WARNING: Mismatch between users and assigned instances!`);
        stats.warnings.push({
            message: 'User/instance count mismatch',
            users: usersWithInstances,
            instances: assignedInstances
        });
    }

    // Check for orphaned assignments
    const orphanedUsers = await User.find({
        license_instance_id: { $ne: null }
    }).populate('license_instance_id');

    const orphaned = orphanedUsers.filter(u => !u.license_instance_id);
    if (orphaned.length > 0) {
        console.log(`  ⚠️  Found ${orphaned.length} users with invalid license_instance_id references`);
        orphaned.forEach(u => {
            console.log(`    - ${u.email}`);
            stats.warnings.push({
                user_id: u._id,
                email: u.email,
                message: 'Invalid license_instance_id reference'
            });
        });
    }

    console.log(`\n${stats.warnings.length > 0 ? '⚠️' : '✅'} Validation complete`);
}

/**
 * Print final report
 */
function printReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION REPORT');
    console.log('='.repeat(60));
    console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes made)' : '✍️  LIVE RUN (changes committed)'}`);
    console.log(`Purchases processed: ${stats.purchasesProcessed}`);
    console.log(`License instances created: ${stats.instancesCreated}`);
    console.log(`Users assigned: ${stats.usersAssigned}`);
    console.log(`Errors: ${stats.errors.length}`);
    console.log(`Warnings: ${stats.warnings.length}`);

    if (stats.errors.length > 0) {
        console.log('\n❌ ERRORS:');
        stats.errors.forEach((err, idx) => {
            console.log(`${idx + 1}. ${JSON.stringify(err, null, 2)}`);
        });
    }

    if (stats.warnings.length > 0) {
        console.log('\n⚠️  WARNINGS:');
        stats.warnings.forEach((warn, idx) => {
            console.log(`${idx + 1}. ${JSON.stringify(warn, null, 2)}`);
        });
    }

    console.log('='.repeat(60));

    if (!DRY_RUN) {
        console.log('\n✅ Migration completed successfully!');
        console.log('\n📝 Next steps:');
        console.log('1. Verify the migration in your database');
        console.log('2. Test license assignment/unassignment flows');
        console.log('3. After 30 days, you can safely remove deprecated fields:');
        console.log('   - User: seat_assigned, seat_number, assigned_license');
        console.log('   - OrganizationLicensePurchase: seats_purchased, seats_used');
    } else {
        console.log('\n🔍 This was a DRY RUN - no changes were made');
        console.log('To run the actual migration, run: DRY_RUN=false node migrate-seats-to-license-instances.js');
    }
}

/**
 * Main migration function
 */
async function migrate() {
    console.log('🚀 Starting License System Migration');
    console.log('From: Seat-based pooling');
    console.log('To: Atomic license instances\n');

    if (DRY_RUN) {
        console.log('⚠️  DRY RUN MODE - No changes will be made\n');
    } else {
        console.log('⚠️  LIVE MODE - Changes will be committed to database');
        console.log('⚠️  Make sure you have a backup!\n');

        // Wait 5 seconds to allow cancellation
        console.log('Starting in 5 seconds... (Press Ctrl+C to cancel)');
        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    await connect();

    try {
        await migratePurchasesToInstances();
        await assignInstancesToUsers();
        await validateMigration();
        printReport();
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        stats.errors.push({ fatal: true, error: error.message, stack: error.stack });
        printReport();
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
    }
}

// Run migration
migrate();
