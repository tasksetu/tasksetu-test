/**
 * Unlock and Reset Super Admin Script
 * Usage: node server/unlock-superadmin.js
 * 
 * This script unlocks super admin account and resets password
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User } from './modals/userModal.js';
import { storage } from './mongodb-storage.js';

// Load environment variables
dotenv.config();

const unlockSuperAdmin = async () => {
  try {
    console.log('🔓 Unlocking Super Admin Account...\n');

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
    
    console.log('🔨 Resetting password and unlocking account...');
    
    // Hash password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password and status
    superAdmin.password = hashedPassword;
    superAdmin.emailVerified = true;
    superAdmin.isActive = true;
    superAdmin.status = 'active';
    superAdmin.updatedAt = new Date();
    
    await superAdmin.save();
    
    // Clear Redis lockout data if exists
    try {
      const redisKey = `lockout:${superAdmin.email}`;
      const attemptsKey = `login_attempts:${superAdmin.email}`;
      
      // Try to clear from storage if method exists
      if (storage.redisClient) {
        await storage.redisClient.del(redisKey);
        await storage.redisClient.del(attemptsKey);
        console.log('✅ Cleared lockout data from Redis');
      }
    } catch (err) {
      console.log('ℹ️  No Redis lockout data to clear (or Redis not available)');
    }
    
    console.log('✅ Account unlocked successfully!');
    console.log('✅ Password reset successfully!\n');
    
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('🎉 SUPER ADMIN LOGIN CREDENTIALS (UNLOCKED)');
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
    console.log('✅ ACCOUNT STATUS:');
    console.log('   🔓 Account: UNLOCKED');
    console.log('   🔐 Password: RESET');
    console.log('   ✅ Email Verified: YES');
    console.log('   ✅ Active: YES');
    console.log('   🚫 Failed Login Attempts: CLEARED');
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
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Run the script
unlockSuperAdmin();
