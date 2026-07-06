/**
 * Create Super Admin Script
 * Usage: node server/create-super-admin.js
 * 
 * This script creates a super admin user in the database
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User } from './modals/userModal.js';

// Load environment variables
dotenv.config();

const createSuperAdmin = async () => {
  try {
    console.log('🚀 Starting Super Admin Creation Process...\n');

    // Connect to MongoDB
    const mongoUri = process.env.DATABASE_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/tasksetu';
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Super Admin Details
    const superAdminData = {
      email: 'tasksetuindia@gmail.com',
      password: 'taskSetu@218',
      firstName: 'Super',
      lastName: 'Admin',
      role: 'super_admin',
      emailVerified: true,
      isActive: true,
      phone: '+91-9818311226'
    };

    console.log('📋 Super Admin Details:');
    console.log(`   Email: ${superAdminData.email}`);
    console.log(`   Password: ${superAdminData.password}`);
    console.log(`   Name: ${superAdminData.firstName} ${superAdminData.lastName}`);
    console.log(`   Role: ${superAdminData.role}\n`);

    // Check if super admin already exists
    const existingAdmin = await User.findOne({ email: superAdminData.email });

    if (existingAdmin) {
      console.log('⚠️  Super Admin already exists with this email! Ensuring it is active...');
      
      // Fix status fields using update to avoid validation/save issues
      await User.findByIdAndUpdate(existingAdmin._id, {
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

      console.log('✅ Super Admin status updated to active in the database!\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔐 SUPER ADMIN');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📧 Email:    ${existingAdmin.email}`);
      console.log(`👤 Name:     ${existingAdmin.firstName} ${existingAdmin.lastName}`);
      console.log(`🎭 Role:     ${existingAdmin.role}`);
      console.log(`✅ status:   active`);
      console.log(`✅ isActive: true`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      await mongoose.disconnect();
      console.log('👋 Disconnected from MongoDB');
      process.exit(0);
    } else {
      // Create new super admin
      console.log('🔨 Creating new Super Admin...');

      // Hash password
      const hashedPassword = await bcrypt.hash(superAdminData.password, 10);

      const superAdmin = new User({
        email: superAdminData.email,
        passwordHash: hashedPassword, // Use passwordHash field for authentication
        firstName: superAdminData.firstName,
        lastName: superAdminData.lastName,
        role: superAdminData.role,
        emailVerified: superAdminData.emailVerified,
        isActive: superAdminData.isActive,
        status: 'active', // Ensure status is active
        phone: superAdminData.phone,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await superAdmin.save();

      console.log('\n✅ Super Admin created successfully!\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔐 LOGIN CREDENTIALS');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📧 Email:    ${superAdminData.email}`);
      console.log(`🔑 Password: ${superAdminData.password}`);
      console.log(`✅ status:   active`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('⚠️  IMPORTANT: Please save these credentials safely!');
      console.log('💡 TIP: Change the password after first login.\n');

      await mongoose.disconnect();
      console.log('👋 Disconnected from MongoDB');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ Error creating Super Admin:', error.message);
    console.error(error);

    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

// Run the script
createSuperAdmin();
