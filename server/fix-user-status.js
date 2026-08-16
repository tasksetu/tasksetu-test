import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from './modals/userModal.js';

dotenv.config();

const fixUserStatus = async () => {
  const targetEmail = 'info.primesurgicals@gmail.com';
  try {
    console.log(`\n🔧 Fixing status for ${targetEmail}...\n`);

    const mongoUri = process.env.DATABASE_URL || process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('❌ MONGO_URI or DATABASE_URL environment variable is missing.');
      process.exit(1);
    }

    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const user = await User.findOne({ email: targetEmail.toLowerCase() });

    if (!user) {
      console.log(`❌ User ${targetEmail} not found in database!\n`);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('📋 Current Values:');
    console.log(`   Email:         ${user.email}`);
    console.log(`   Name:          ${user.firstName} ${user.lastName}`);
    console.log(`   Status:        ${user.status}`);
    console.log(`   isActive:      ${user.isActive}`);
    console.log(`   emailVerified: ${user.emailVerified}`);

    const updatedUser = await User.findOneAndUpdate(
      { _id: user._id },
      { $set: { status: 'active', isActive: true } },
      { new: true }
    );

    console.log('\n✅ Updated Values:');
    console.log(`   Status:        ${updatedUser.status}`);
    console.log(`   isActive:      ${updatedUser.isActive}`);
    console.log('\n🎉 User status fix completed successfully!\n');

  } catch (error) {
    console.error('❌ Error fixing user status:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

fixUserStatus();
