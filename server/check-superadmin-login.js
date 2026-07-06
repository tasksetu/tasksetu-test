/**
 * Check Super Admin Login Credentials
 * Usage: node server/check-superadmin-login.js
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from './modals/userModal.js';

// Load environment variables
dotenv.config();

const checkSuperAdminLogin = async () => {
  try {
    console.log('\n🔍 Checking Super Admin Login Details...\n');

    // Connect to MongoDB
    const mongoUri = process.env.DATABASE_URL || process.env.MONGO_URI;
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find all super admins
    const superAdmins = await User.find({
      $or: [
        { role: 'super_admin' },
        { role: 'superadmin' },
        { isSuperAdmin: true }
      ]
    }).select('email firstName lastName role isSuperAdmin isActive accountLocked loginAttempts');

    if (superAdmins.length === 0) {
      console.log('❌ No super admin users found!\n');
      console.log('💡 You may need to create a super admin account first.\n');
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log(`✅ Found ${superAdmins.length} super admin account(s):\n`);
    console.log('═══════════════════════════════════════════════════════════════════════');

    for (const admin of superAdmins) {
      console.log('\n📋 LOGIN CREDENTIALS:');
      console.log('───────────────────────────────────────────────────────────────────────');
      console.log(`   📧 Email:          ${admin.email}`);
      console.log(`   👤 Name:           ${admin.firstName} ${admin.lastName}`);
      console.log(`   🔑 Role:           ${admin.role}`);
      console.log(`   ✅ Active:         ${admin.isActive ? 'Yes' : 'No'}`);
      console.log(`   🔒 Locked:         ${admin.accountLocked ? 'Yes ⚠️' : 'No'}`);
      console.log(`   🔢 Login Attempts: ${admin.loginAttempts || 0}`);
      console.log('───────────────────────────────────────────────────────────────────────');
      
      if (admin.accountLocked) {
        console.log('\n⚠️  ACCOUNT IS LOCKED! Run: node server/unlock-superadmin.js');
      }
      
      console.log('\n💡 DEFAULT PASSWORD (if not changed): Admin@123');
      console.log('   (Password may have been changed. Check with admin or reset it.)');
    }

    console.log('\n═══════════════════════════════════════════════════════════════════════\n');
    console.log('📝 NOTE: If you cannot login:');
    console.log('   1. Check if account is locked (shown above)');
    console.log('   2. Run: node server/reset-superadmin-password.js');
    console.log('   3. Run: node server/unlock-superadmin.js (if locked)');
    console.log('   4. Try default password: Admin@123\n');

    await mongoose.disconnect();
    console.log('✅ Database connection closed.\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

checkSuperAdminLogin();
