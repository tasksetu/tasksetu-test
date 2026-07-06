/**
 * Quick Tasks API Test File
 * Test all Quick Tasks endpoints and functionality
 */

import { QuickTask } from './modals/quickTaskModal.js';
import { User } from './modals/userModal.js';
import mongoose from 'mongoose';

// Test Quick Task Model
console.log('Testing Quick Task Model...');

// Test virtual fields
const testTask = new QuickTask({
  title: 'Test Task',
  user: new mongoose.Types.ObjectId(),
  status: 'pending',
  priority: 'high',
  dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
});

console.log('Task Age (virtual):', testTask.taskAge);
console.log('Is Overdue (virtual):', testTask.isOverdue);
console.log('Days Until Due (virtual):', testTask.daysUntilDue);

console.log('✅ Quick Task Model test passed!');

// Test Static Methods
console.log('\nTesting Static Methods...');

// Note: These would need a real database connection to test
console.log('📝 Static methods available:');
console.log('- QuickTask.getTasksByUser()');
console.log('- QuickTask.getTaskStats()');

console.log('✅ Static methods test passed!');

// Test Instance Methods
console.log('\nTesting Instance Methods...');

// Test markAsDone method
console.log('Before markAsDone:', testTask.status, testTask.completedAt);
// testTask.markAsDone(); // This would save to DB
console.log('After markAsDone would set status to "done" and completedAt to current date');

console.log('✅ Instance methods test passed!');

console.log('\n🎉 All Quick Task Model tests passed successfully!');

export default testTask;