// Migration Script: Add Parent/Instance Fields to Existing Recurring Tasks
// Run this once to update all existing recurring tasks with new architecture fields

import mongoose from 'mongoose';
import Task from '../models/Task.js';
import dotenv from 'dotenv';

dotenv.config();

const migrateRecurringTasks = async () => {
  try {
    console.log('🔄 Starting Recurring Task Migration...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all recurring tasks WITHOUT the new architecture fields
    const recurringTasksToMigrate = await Task.find({
      isRecurring: true,
      isParentRecurring: { $exists: false }
    });

    console.log(`📊 Found ${recurringTasksToMigrate.length} recurring tasks to migrate\n`);

    if (recurringTasksToMigrate.length === 0) {
      console.log('✅ No tasks need migration. All recurring tasks already have new architecture fields.');
      process.exit(0);
    }

    let migratedCount = 0;
    let errorCount = 0;

    for (const task of recurringTasksToMigrate) {
      try {
        console.log(`\n📝 Migrating Task: ${task.title} (${task._id})`);

        // Decision logic: Is this a parent template or an instance?
        // If it has occurrenceCount and nextDueDate, it's likely a parent template
        // If it was created from another task (has recurringFromTaskId), it's an instance
        
        let isParentTemplate = false;
        let instanceNumber = null;
        let parentRecurringTaskId = null;

        if (task.recurringFromTaskId) {
          // This is a child instance (old architecture)
          console.log(`  → Detected as INSTANCE (has recurringFromTaskId: ${task.recurringFromTaskId})`);
          isParentTemplate = false;
          parentRecurringTaskId = task.recurringFromTaskId;
          // Try to determine instance number (if possible)
          // For now, we'll leave it null and let future occurrences set it
          instanceNumber = null;
        } else if (task.occurrenceCount !== undefined || task.nextDueDate) {
          // Has tracking fields - likely a parent template
          console.log(`  → Detected as PARENT TEMPLATE (has occurrenceCount: ${task.occurrenceCount})`);
          isParentTemplate = true;
          instanceNumber = null;
          parentRecurringTaskId = null;
        } else {
          // Ambiguous case - default to parent template
          console.log(`  → Ambiguous case, defaulting to PARENT TEMPLATE`);
          isParentTemplate = true;
          instanceNumber = null;
          parentRecurringTaskId = null;
        }

        // Update the task with new fields
        const updateData = {
          isParentRecurring: isParentTemplate,
          instanceNumber: instanceNumber,
          parentRecurringTaskId: parentRecurringTaskId,
          isStatusSystemManaged: isParentTemplate // Parents are system-managed, instances are manual
        };

        // Ensure occurrenceCount is set for parent templates
        if (isParentTemplate && task.occurrenceCount === undefined) {
          updateData.occurrenceCount = 0;
        }

        await Task.findByIdAndUpdate(task._id, updateData);

        console.log(`  ✅ Migrated successfully:`, {
          isParentRecurring: updateData.isParentRecurring,
          instanceNumber: updateData.instanceNumber,
          parentRecurringTaskId: updateData.parentRecurringTaskId,
          isStatusSystemManaged: updateData.isStatusSystemManaged
        });

        migratedCount++;
      } catch (error) {
        console.error(`  ❌ Error migrating task ${task._id}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully migrated: ${migratedCount} tasks`);
    console.log(`❌ Errors: ${errorCount} tasks`);
    console.log(`📋 Total processed: ${recurringTasksToMigrate.length} tasks`);
    console.log('='.repeat(60) + '\n');

    // Show statistics
    const parentTemplates = await Task.countDocuments({ isParentRecurring: true });
    const instances = await Task.countDocuments({ isRecurring: true, isParentRecurring: false });
    
    console.log('📈 RECURRING TASKS STATISTICS:');
    console.log(`  Parent Templates: ${parentTemplates}`);
    console.log(`  Instances: ${instances}`);
    console.log(`  Total Recurring: ${parentTemplates + instances}\n`);

    console.log('✅ Migration completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

// Run migration
migrateRecurringTasks();
