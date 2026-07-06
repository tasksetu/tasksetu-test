/**
 * List Super Admins Script
 * Usage: node server/list-super-admins.js
 * 
 * This script lists all super admin users in the database
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './modals/userModal.js';

// Load environment variables
dotenv.config();

const listSuperAdmins = async () => {
  try {
    console.log('🔍 Listing Super Admins...\n');

    // Connect to MongoDB
    const mongoUri = process.env.DATABASE_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/tasksetu';
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find all super admins
    const superAdmins = await User.find({
      role: { $in: ['super_admin', 'superadmin', 'admin'] }
    }).select('email firstName lastName role isActive emailVerified createdAt organization_id');

    if (superAdmins.length === 0) {
      console.log('❌ No super admin users found in the database!\n');
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log(`✅ Found ${superAdmins.length} super admin(s):\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    superAdmins.forEach((admin, index) => {
      console.log(`\n${index + 1}. Super Admin Details:`);
      console.log(`   📧 Email:          ${admin.email}`);
      console.log(`   👤 Name:           ${admin.firstName} ${admin.lastName}`);
      console.log(`   🎭 Role:           ${admin.role}`);
      console.log(`   ✅ Active:         ${admin.isActive ? 'Yes' : 'No'}`);
      console.log(`   📬 Email Verified: ${admin.emailVerified ? 'Yes' : 'No'}`);
      console.log(`   🏢 Organization:   ${admin.organization_id || 'None (Platform Admin)'}`);
      console.log(`   📅 Created:        ${new Date(admin.createdAt).toLocaleString()}`);
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 Note: Passwords are encrypted and cannot be displayed for security.');
    console.log('💡 Use the forgot password feature to reset if needed.\n');

    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error listing Super Admins:', error.message);
    console.error(error);
    
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

// Run the script
listSuperAdmins();
