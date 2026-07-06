/**
 * Reset Super Admin Password Script
 * Usage: node server/reset-superadmin-password.js
 * 
 * This script sets/resets password for super admin
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User } from './modals/userModal.js';

// Load environment variables
dotenv.config();

const resetSuperAdminPassword = async () => {
  try {
    console.log('🔐 Resetting Super Admin Password...\n');

    // Connect to MongoDB
    const mongoUri = process.env.DATABASE_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/tasksetu';
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find super admin
    const superAdmin = await User.findOne({ email: 'superadmin@tasksetu.com' });
    
    if (!superAdmin) {
      console.log('❌ Super Admin not found with email: superadmin@tasksetu.com\n');
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('✅ Found Super Admin:');
    console.log(`   Email: ${superAdmin.email}`);
    console.log(`   Name: ${superAdmin.firstName} ${superAdmin.lastName}\n`);

    // New password
    const newPassword = 'SuperAdmin@123';
    
    console.log('🔨 Setting new password...');
    
    // Hash password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    superAdmin.password = hashedPassword;
    superAdmin.emailVerified = true;
    superAdmin.isActive = true;
    superAdmin.updatedAt = new Date();
    
    await superAdmin.save();
    
    console.log('✅ Password updated successfully!\n');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('🎉 SUPER ADMIN LOGIN CREDENTIALS');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('   📧 Email:    superadmin@tasksetu.com');
    console.log('   🔑 Password: SuperAdmin@123');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('📱 LOGIN STEPS:');
    console.log('───────────────────────────────────────────────────────────────────────────────');
    console.log('   1. Open your browser');
    console.log('   2. Navigate to: http://localhost:5173/login');
    console.log('   3. Enter Email: superadmin@tasksetu.com');
    console.log('   4. Enter Password: SuperAdmin@123');
    console.log('   5. Click Login button');
    console.log('───────────────────────────────────────────────────────────────────────────────');
    console.log('');
    console.log('⚠️  IMPORTANT SECURITY NOTES:');
    console.log('───────────────────────────────────────────────────────────────────────────────');
    console.log('   🔒 Please change this password after first login');
    console.log('   🔐 Go to Settings > Change Password after login');
    console.log('   ✅ Use a strong password with uppercase, lowercase, numbers & symbols');
    console.log('   📝 Save these credentials in a secure location');
    console.log('───────────────────────────────────────────────────────────────────────────────');
    console.log('');

    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error resetting password:', error.message);
    console.error(error);
    
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

// Run the script
resetSuperAdminPassword();
