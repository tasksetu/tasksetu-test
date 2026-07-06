import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

import { User } from './modals/userModal.js';
import { Organization } from './modals/organizationModal.js';

const MONGODB_URI = process.env.DATABASE_URL || 'mongodb+srv://jeeturadicalloop:Mjvesqnj8gY3t0zP@cluster0.by2xy6x.mongodb.net/TaskSetu';

/**
 * Migration script to add license fields to existing users and organizations
 */
async function migrateLicenseFields() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Migrate Organizations
    console.log('📝 Migrating organizations...');
    const organizations = await Organization.find({});
    
    let orgUpdated = 0;
    for (const org of organizations) {
      let needsUpdate = false;
      
      if (!org.license_code) {
        org.license_code = 'EXPLORE'; // Default to trial
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await org.save();
        orgUpdated++;
        console.log(`   ✅ Updated organization: ${org.name} → license_code: ${org.license_code}`);
      }
    }
    
    console.log(`\n✅ Updated ${orgUpdated} organizations\n`);

    // Migrate Users
    console.log('📝 Migrating users...');
    const users = await User.find({});
    
    let userUpdated = 0;
    for (const user of users) {
      let needsUpdate = false;
      
      // Set default account_type based on role
      if (!user.account_type) {
        if (user.role.includes('individual')) {
          user.account_type = 'individual';
        } else {
          user.account_type = 'company';
        }
        needsUpdate = true;
      }
      
      // For individual accounts without license, set default
      if (user.account_type === 'individual' && !user.license_code) {
        user.license_code = 'EXPLORE';
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await user.save();
        userUpdated++;
        console.log(`   ✅ Updated user: ${user.email} → account_type: ${user.account_type}, license_code: ${user.license_code || 'N/A'}`);
      }
    }
    
    console.log(`\n✅ Updated ${userUpdated} users\n`);

    // Summary
    console.log('📊 Migration Summary:');
    console.log(`   - Organizations migrated: ${orgUpdated}/${organizations.length}`);
    console.log(`   - Users migrated: ${userUpdated}/${users.length}`);
    
    const individualAccounts = await User.countDocuments({ account_type: 'individual' });
    const companyAccounts = await User.countDocuments({ account_type: 'company' });
    
    console.log(`\n📊 Account Type Distribution:`);
    console.log(`   - Individual accounts: ${individualAccounts}`);
    console.log(`   - Company accounts: ${companyAccounts}`);
    
    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

// Run migration
migrateLicenseFields();
