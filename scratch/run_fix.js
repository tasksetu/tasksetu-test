import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
dotenv.config({ path: './.env' });

async function fixExisting() {
  const connStr = process.env.DATABASE_URL || process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb+srv://jeeturadicalloop:Mjvesqnj8gY3t0zP@cluster0.by2xy6x.mongodb.net/TaskSetu';
  console.log('Connecting to MongoDB...');
  await mongoose.connect(connStr);
  console.log('Connected to MongoDB.');

  const { Task } = await import('../server/models.js');
  const { LinkedTaskService } = await import('../server/workflow/LinkedTaskService.js');

  const completedTasks = await Task.find({
    status: { $in: ['DONE', 'COMPLETED', 'Done', 'Completed'] },
    isDeleted: { $ne: true }
  }).select('_id title status');

  console.log(`Found ${completedTasks.length} completed task(s). Triggering auto-initiate check...`);

  for (const t of completedTasks) {
    await LinkedTaskService.onTaskCompleted(t._id);
  }

  console.log('Finished auto-initiate check successfully.');
  await mongoose.disconnect();
}

fixExisting().catch((err) => {
  console.error('Error running fix:', err);
  process.exit(1);
});
