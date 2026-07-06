/**
 * Migration Script: Migrate Expired Purchases to License Instances
 * 
 * Run: node server/scripts/migrate-expired-purchases.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import OrganizationLicensePurchase from '../modals/organizationLicensePurchaseModal.js';
import LicenseInstance from '../modals/licenseInstanceModal.js';

dotenv.config();

async function run() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;
    if (!mongoUri) {
      console.error('❌ No MongoDB URI found in environment variables');
      process.exit(1);
    }

    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find all expired purchases
    console.log('\n🔍 Finding expired purchases...');
    const expiredPurchases = await OrganizationLicensePurchase.find({
      status: 'EXPIRED'
    });

    console.log(`Found ${expiredPurchases.length} expired purchases in database.`);

    let createdCount = 0;

    for (const purchase of expiredPurchases) {
      // Check if instances already exist for this purchase ID
      const existingCount = await LicenseInstance.countDocuments({
        purchase_id: purchase._id
      });

      if (existingCount > 0) {
        console.log(`  - Purchase ${purchase._id} (${purchase.license_code}) already has ${existingCount} instances. Skipping.`);
        continue;
      }

      // Quantity can be seats_purchased, quantity, or fallback to 1
      const quantity = purchase.seats_purchased || purchase.quantity || 1;
      const instances = [];

      for (let i = 0; i < quantity; i++) {
        instances.push({
          organization_id: purchase.organization_id,
          license_code: purchase.license_code,
          purchase_id: purchase._id,
          billing_cycle: purchase.billing_cycle || 'MONTHLY',
          purchase_date: purchase.purchase_date || new Date(),
          renewal_date: purchase.renewal_date,
          status: 'EXPIRED' // Created as expired
        });
      }

      await LicenseInstance.insertMany(instances);
      createdCount += instances.length;
      console.log(`  ✓ Created ${instances.length} EXPIRED instances for purchase ${purchase._id} (${purchase.license_code})`);
    }

    console.log(`\n🎉 Migration complete! Created ${createdCount} expired license instances.`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

run();
