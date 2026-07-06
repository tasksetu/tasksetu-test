/**
 * Activate Super Admin Account
 * Usage: node server/activate-superadmin.js
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from './modals/userModal.js';

// Load environment variables
dotenv.config();

const activateSuperAdmin = async () => {
  try {
    console.log('\n🔓 Activating Super Admin Account...\n');

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

    console.log('📋 Current Status:');
    console.log(`   Email: ${superAdmin.email}`);
    console.log(`   Name: ${superAdmin.firstName} ${superAdmin.lastName}`);
    console.log(`   Active: ${superAdmin.isActive}`);
    console.log(`   Verified: ${superAdmin.emailVerified}`);
    console.log(`   Locked: ${superAdmin.accountLocked || false}`);
    console.log(`   Login Attempts: ${superAdmin.loginAttempts || 0}\n`);

    // Update account to active and unlock
    superAdmin.isActive = true;
    superAdmin.emailVerified = true;
    superAdmin.accountLocked = false;
    superAdmin.loginAttempts = 0;
    superAdmin.lockoutUntil = null;

    await superAdmin.save();

    console.log('✅ Super Admin account activated successfully!\n');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('🎉 SUPER ADMIN LOGIN CREDENTIALS');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log(`   📧 Email:    superadmin@tasksetu.com`);
    console.log(`   🔑 Password: SuperAdmin@123`);
    console.log(`   ✅ Status:   ACTIVE`);
    console.log(`   🔓 Locked:   NO`);
    console.log('═══════════════════════════════════════════════════════════════════════\n');
    console.log('📱 LOGIN STEPS:');
    console.log('   1. Open browser: http://localhost:5173/login');
    console.log('   2. Email: superadmin@tasksetu.com');
    console.log('   3. Password: SuperAdmin@123');
    console.log('   4. Click Login\n');

    await mongoose.disconnect();
    console.log('✅ Database connection closed.\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

activateSuperAdmin();
