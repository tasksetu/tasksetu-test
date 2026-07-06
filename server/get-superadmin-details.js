/**
 * Get Super Admin Complete Details Script
 * Usage: node server/get-superadmin-details.js
 * 
 * This script shows complete details of super admin users
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './modals/userModal.js';
import { Organization } from './modals/organizationModal.js';

// Load environment variables
dotenv.config();

const getSuperAdminDetails = async () => {
  try {
    console.log('🔍 Fetching Complete Super Admin Details...\n');

    // Connect to MongoDB
    const mongoUri = process.env.DATABASE_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/tasksetu';
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find all super admins with complete details
    const superAdmins = await User.find({
      role: { $in: ['super_admin', 'superadmin', 'admin'] }
    });

    if (superAdmins.length === 0) {
      console.log('❌ No super admin users found in the database!\n');
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log(`✅ Found ${superAdmins.length} super admin(s):\n`);
    console.log('═══════════════════════════════════════════════════════════════════════════════');

    for (let i = 0; i < superAdmins.length; i++) {
      const admin = superAdmins[i];
      
      console.log(`\n🔷 SUPER ADMIN ${i + 1}`);
      console.log('═══════════════════════════════════════════════════════════════════════════════');
      
      // Basic Information
      console.log('\n📋 BASIC INFORMATION:');
      console.log('───────────────────────────────────────────────────────────────────────────────');
      console.log(`   📧 Email:              ${admin.email}`);
      console.log(`   👤 First Name:         ${admin.firstName}`);
      console.log(`   👤 Last Name:          ${admin.lastName}`);
      console.log(`   📱 Phone:              ${admin.phone || 'Not provided'}`);
      console.log(`   🆔 User ID:            ${admin._id}`);
      
      // Account Status
      console.log('\n🔐 ACCOUNT STATUS:');
      console.log('───────────────────────────────────────────────────────────────────────────────');
      console.log(`   🎭 Role:               ${admin.role}`);
      console.log(`   ✅ Active:             ${admin.isActive ? '✓ Yes' : '✗ No'}`);
      console.log(`   📬 Email Verified:     ${admin.emailVerified ? '✓ Yes' : '✗ No'}`);
      console.log(`   🔒 Password Set:       ${admin.password ? '✓ Yes (Encrypted)' : '✗ No'}`);
      
      // Organization Details
      console.log('\n🏢 ORGANIZATION:');
      console.log('───────────────────────────────────────────────────────────────────────────────');
      if (admin.organization_id) {
        try {
          const org = await Organization.findById(admin.organization_id);
          if (org) {
            console.log(`   🏢 Organization Name:  ${org.name}`);
            console.log(`   🆔 Organization ID:    ${org._id}`);
            console.log(`   📧 Organization Email: ${org.email || 'Not provided'}`);
            console.log(`   📱 Organization Phone: ${org.phone || 'Not provided'}`);
            console.log(`   👥 Employee Count:     ${org.employeeCount || 0}`);
          } else {
            console.log(`   🏢 Organization:       ${admin.organization_id} (Not found)`);
          }
        } catch (err) {
          console.log(`   🏢 Organization ID:    ${admin.organization_id}`);
        }
      } else {
        console.log(`   🏢 Organization:       None (Platform Super Admin)`);
      }
      
      // Timestamps
      console.log('\n📅 TIMESTAMPS:');
      console.log('───────────────────────────────────────────────────────────────────────────────');
      console.log(`   📅 Created At:         ${new Date(admin.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
      console.log(`   📅 Updated At:         ${admin.updatedAt ? new Date(admin.updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Not updated yet'}`);
      console.log(`   📅 Last Login:         ${admin.lastLogin ? new Date(admin.lastLogin).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Never logged in'}`);
      
      // Additional Fields
      console.log('\n🔧 ADDITIONAL DETAILS:');
      console.log('───────────────────────────────────────────────────────────────────────────────');
      console.log(`   🖼️  Profile Picture:    ${admin.profilePicture || 'Not set'}`);
      console.log(`   🏙️  Address:            ${admin.address || 'Not provided'}`);
      console.log(`   🌐 Country:            ${admin.country || 'Not provided'}`);
      console.log(`   🎂 Date of Birth:      ${admin.dateOfBirth ? new Date(admin.dateOfBirth).toLocaleDateString('en-IN') : 'Not provided'}`);
      console.log(`   👔 Department:         ${admin.department || 'Not assigned'}`);
      console.log(`   💼 Designation:        ${admin.designation || 'Not set'}`);
      
      // Permissions & Settings
      console.log('\n⚙️  PERMISSIONS & SETTINGS:');
      console.log('───────────────────────────────────────────────────────────────────────────────');
      console.log(`   🔔 Notifications:      ${admin.notificationPreferences ? 'Configured' : 'Default'}`);
      console.log(`   🔑 Two Factor Auth:    ${admin.twoFactorEnabled ? '✓ Enabled' : '✗ Disabled'}`);
      console.log(`   📊 Dashboard Access:   ✓ Full Access`);
      console.log(`   👥 User Management:    ✓ Full Access`);
      console.log(`   🏢 Org Management:     ✓ Full Access`);
      console.log(`   📋 Task Management:    ✓ Full Access`);
      console.log(`   📝 Form Management:    ✓ Full Access`);
      console.log(`   📊 Reports Access:     ✓ Full Access`);
      console.log(`   ⚙️  System Settings:    ✓ Full Access`);
      
      // Raw Data (for debugging)
      console.log('\n🔍 RAW DATA (for debugging):');
      console.log('───────────────────────────────────────────────────────────────────────────────');
      console.log(JSON.stringify({
        _id: admin._id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: admin.role,
        isActive: admin.isActive,
        emailVerified: admin.emailVerified,
        organization_id: admin.organization_id,
        phone: admin.phone,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt
      }, null, 2));
      
      console.log('\n═══════════════════════════════════════════════════════════════════════════════');
    }

    // System Statistics
    console.log('\n\n📊 SYSTEM STATISTICS:');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const verifiedUsers = await User.countDocuments({ emailVerified: true });
    const totalOrgs = await Organization.countDocuments();
    
    console.log(`   👥 Total Users:        ${totalUsers}`);
    console.log(`   ✅ Active Users:       ${activeUsers}`);
    console.log(`   📬 Verified Users:     ${verifiedUsers}`);
    console.log(`   🏢 Total Organizations: ${totalOrgs}`);
    console.log(`   🔷 Super Admins:       ${superAdmins.length}`);
    console.log('═══════════════════════════════════════════════════════════════════════════════');

    console.log('\n\n💡 IMPORTANT NOTES:');
    console.log('───────────────────────────────────────────────────────────────────────────────');
    console.log('   🔒 Password is encrypted using bcrypt (cannot be displayed)');
    console.log('   🔐 Use "Forgot Password" feature to reset password');
    console.log('   ⚠️  Super Admin has full access to all system features');
    console.log('   📧 Login URL: http://localhost:5173/login or your production URL');
    console.log('───────────────────────────────────────────────────────────────────────────────\n');

    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error fetching Super Admin details:', error.message);
    console.error(error);
    
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

// Run the script
getSuperAdminDetails();
