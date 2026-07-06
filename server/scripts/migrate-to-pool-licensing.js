/**
 * 🔄 LICENSE MODEL MIGRATION SCRIPT
 * 
 * Migrates from old single-license model to new pool-based model:
 * - Creates CompanyLicense instances for each organization
 * - Assigns licenses to users based on their current settings
 * - Preserves existing data structure for backward compatibility
 * 
 * Run with: node server/scripts/migrate-to-pool-licensing.js
 */

import mongoose from 'mongoose';
import { User } from '../modals/userModal.js';
import { Organization } from '../modals/organizationModal.js';
import { CompanyLicense } from '../modals/companyLicenseModal.js';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://jeeturadicalloop:Mjvesqnj8gY3t0zP@cluster0.by2xy6x.mongodb.net/TaskSetu';

async function migrateToPoolLicensing() {
  try {
    console.log('🚀 Starting license model migration...\n');

    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all organizations
    const organizations = await Organization.find({});
    console.log(`📊 Found ${organizations.length} organizations\n`);

    let totalLicensesCreated = 0;
    let totalUsersUpdated = 0;

    for (const org of organizations) {
      console.log(`\n🏢 Processing: ${org.name} (${org._id})`);
      console.log(`   Current license: ${org.license_code || 'NONE'}`);

      // Get all users in this organization
      const users = await User.find({ organization_id: org._id });
      console.log(`   Users: ${users.length}`);

      if (users.length === 0) {
        console.log('   ⚠️ No users found, skipping...');
        continue;
      }

      // Determine license types needed
      // For migration, we'll create licenses for all users based on org license
      const orgLicense = org.license_code || 'EXPLORE';
      const licensesToCreate = users.length;

      console.log(`   Creating ${licensesToCreate} × ${orgLicense} licenses...`);

      // Create license instances
      const createdLicenses = [];
      for (let i = 0; i < licensesToCreate; i++) {
        const licenseId = `L-${org._id.toString().substring(0, 8)}-${orgLicense}-${String(i + 1).padStart(4, '0')}`;
        
        const license = new CompanyLicense({
          license_id: licenseId,
          company_id: org._id,
          license_type: orgLicense.toUpperCase(),
          status: 'AVAILABLE',
          purchased_at: new Date(),
          notes: 'Migrated from old licensing system',
        });

        await license.save();
        createdLicenses.push(license);
      }

      totalLicensesCreated += createdLicenses.length;
      console.log(`   ✅ Created ${createdLicenses.length} licenses`);

      // Assign licenses to users
      console.log(`   Assigning licenses to users...`);
      let assignedCount = 0;

      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const license = createdLicenses[i];

        if (!license) {
          console.log(`   ⚠️ No license available for user ${user.email}`);
          continue;
        }

        // Assign license to user
        await license.assignToUser(user._id, org._id);

        // Update user record
        user.license_id = license._id;
        await user.save();

        assignedCount++;
      }

      totalUsersUpdated += assignedCount;
      console.log(`   ✅ Assigned licenses to ${assignedCount} users`);
    }

    console.log('\n\n📊 MIGRATION SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Organizations processed: ${organizations.length}`);
    console.log(`✅ Total licenses created: ${totalLicensesCreated}`);
    console.log(`✅ Total users updated: ${totalUsersUpdated}`);
    console.log('═══════════════════════════════════════\n');

    // Verify migration
    console.log('🔍 Verifying migration...\n');

    const allLicenses = await CompanyLicense.find({});
    const assignedLicenses = await CompanyLicense.find({ status: 'ASSIGNED' });
    const availableLicenses = await CompanyLicense.find({ status: 'AVAILABLE' });

    console.log(`Total licenses in pool: ${allLicenses.length}`);
    console.log(`Assigned licenses: ${assignedLicenses.length}`);
    console.log(`Available licenses: ${availableLicenses.length}`);

    const usersWithLicense = await User.countDocuments({ license_id: { $ne: null } });
    console.log(`Users with license_id: ${usersWithLicense}`);

    console.log('\n✅ Migration completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run migration
migrateToPoolLicensing()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
