import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { User } from '../server/modals/userModal.js';
import { Task } from '../server/models.js';

async function checkUser() {
  const dbUrl = process.env.DATABASE_URL || process.env.MONGODB_URI;
  await mongoose.connect(dbUrl);
  console.log('✅ Connected to MongoDB');
  const user = await User.findOne({ email: 'aichchhikyadav@gmail.com' });
  console.log('User:', user ? { _id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email } : 'Not found');
  if (user) {
    const tasks = await Task.find({ assignedTo: user._id, isDeleted: { $ne: true } }).lean();
    console.log('Total tasks assigned to user:', tasks.length);
    tasks.forEach(t => {
      console.log(`- [${t.status}] ${t.title} (dueDate: ${t.dueDate}, priority: ${t.priority}, type: ${t.taskType})`);
    });
  }
  await mongoose.disconnect();
}

checkUser().catch(console.error);
