/**
 * Fix Super Admin Status
 * Usage: node server/fix-superadmin-status.js
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from './modals/userModal.js';

// Load environment variables
dotenv.config();

const fixSuperAdminStatus = async () => {
  try {
    console.log('\n🔧 Fixing Super Admin Status...\n');

    // Connect to MongoDB
    const mongoUri = process.env.DATABASE_URL || process.env.MONGO_URI;
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find super admin
    const superAdmin = await User.findOne({
      email: 'superadmin@tasksetu.com'
    });

    if (!superAdmin) {
      console.log('❌ Super admin not found!\n');
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('📋 Current Values:');
    console.log(`   Email:          ${superAdmin.email}`);
    console.log(`   Name:           ${superAdmin.firstName} ${superAdmin.lastName}`);
    console.log(`   Role:           ${superAdmin.role}`);
    console.log(`   status:         ${superAdmin.status || 'undefined'}`);
    console.log(`   isActive:       ${superAdmin.isActive}`);
    console.log(`   emailVerified:  ${superAdmin.emailVerified}`);
    console.log(`   accountLocked:  ${superAdmin.accountLocked || false}`);
    console.log(`   loginAttempts:  ${superAdmin.loginAttempts || 0}\n`);

    // Fix all status fields using update to avoid validation issues
    await User.findByIdAndUpdate(superAdmin._id, {
      $set: {
        status: 'active',
        isActive: true,
        emailVerified: true,
        accountLocked: false,
        loginAttempts: 0,
        lockoutUntil: null,
        failedLoginAttempts: 0
      }
    });

    console.log('✅ Super Admin status fixed successfully!\n');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('🎉 SUPER ADMIN LOGIN CREDENTIALS - READY TO USE!');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log(`   📧 Email:    superadmin@tasksetu.com`);
    console.log(`   🔑 Password: SuperAdmin@123`);
    console.log(`   ✅ status:   active`);
    console.log(`   ✅ isActive: true`);
    console.log(`   ✅ Verified: true`);
    console.log(`   🔓 Locked:   false`);
    console.log('═══════════════════════════════════════════════════════════════════════\n');
    console.log('📱 LOGIN NOW:');
    console.log('   1. Open: http://localhost:5173/login');
    console.log('   2. Email: superadmin@tasksetu.com');
    console.log('   3. Password: SuperAdmin@123');
    console.log('   4. Click Login → SUCCESS! ✅\n');

    await mongoose.disconnect();
    console.log('✅ Database connection closed.\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

fixSuperAdminStatus();
