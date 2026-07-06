import mongoose from 'mongoose';
import { PendingUser } from './modals/pendingUserModal.js';

async function checkPendingUsers() {
  try {
    await mongoose.connect('mongodb+srv://jeeturadicalloop:Mjvesqnj8gY3t0zP@cluster0.by2xy6x.mongodb.net/TaskSetu', {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      family: 4,
    });
    
    const pendingUsers = await PendingUser.find({}).sort({ createdAt: -1 }).limit(10);
    
    console.log('Recent pending users and their verification codes:');
    console.log('================================================');
    
    if (pendingUsers.length === 0) {
      console.log('No pending users found.');
    } else {
      pendingUsers.forEach((user, index) => {
        console.log(`${index + 1}. Email: ${user.email}`);
        console.log(`   Verification Code: ${user.verificationCode}`);
        console.log(`   Expires: ${user.verificationExpires}`);
        console.log(`   Verified: ${user.isVerified}`);
        console.log(`   Type: ${user.type}`);
        console.log(`   Created: ${user.createdAt}`);
        console.log('---');
      });
    }
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkPendingUsers();