/**
 * Set Super Admin Password
 * Usage: node server/set-superadmin-password.js
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from './modals/userModal.js';

// Load environment variables
dotenv.config();

const setSuperAdminPassword = async () => {
  try {
    console.log('\n🔐 Setting Super Admin Password...\n');

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

    console.log('📋 Current State:');
    console.log(`   Email:         ${superAdmin.email}`);
    console.log(`   Name:          ${superAdmin.firstName} ${superAdmin.lastName}`);
    console.log(`   passwordHash:  ${superAdmin.passwordHash ? 'EXISTS' : 'MISSING ❌'}`);
    console.log(`   password:      ${superAdmin.password ? 'EXISTS' : 'MISSING'}\n`);

    // Hash the password
    const password = 'SuperAdmin@123';
    console.log('🔨 Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('✅ Password hashed successfully\n');

    // Update using direct MongoDB update to avoid validation
    await User.updateOne(
      { _id: superAdmin._id },
      {
        $set: {
          passwordHash: hashedPassword,
          password: hashedPassword, // Some systems use 'password' field
          status: 'active',
          isActive: true,
          emailVerified: true,
          accountLocked: false,
          loginAttempts: 0,
          lockoutUntil: null,
          failedLoginAttempts: 0
        }
      }
    );

    console.log('✅ Super Admin password set successfully!\n');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('🎉 SUPER ADMIN LOGIN CREDENTIALS - READY!');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log(`   📧 Email:    superadmin@tasksetu.com`);
    console.log(`   🔑 Password: SuperAdmin@123`);
    console.log(`   ✅ Status:   ACTIVE & READY`);
    console.log(`   🔐 Password: SET & HASHED`);
    console.log('═══════════════════════════════════════════════════════════════════════\n');
    console.log('📱 LOGIN NOW:');
    console.log('   1. Open: http://localhost:5173/login');
    console.log('   2. Email: superadmin@tasksetu.com');
    console.log('   3. Password: SuperAdmin@123');
    console.log('   4. Click Login → ✅ SUCCESS!\n');

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

setSuperAdminPassword();
