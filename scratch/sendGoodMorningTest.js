import dotenv from 'dotenv';
dotenv.config();
import { emailService } from '../server/services/emailService.js';

async function sendExactGoodMorningWithApprovals() {
  console.log('--- Initializing email service ---');
  await emailService.checkConfiguration();
  console.log('Is Configured:', emailService.isConfigured);
  console.log('From Email:', emailService.fromEmail);

  const recipientUser = {
    firstName: 'Aichchhik',
    lastName: '',
    email: 'aichchhikyadav@gmail.com'
  };

  const now = new Date();

  // 1. Overdue Tasks (3)
  const overdueTasks = [
    {
      _id: 'task_ovd_1',
      title: 'Complete client documentation',
      dueDate: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000), // 4 days overdue
      priority: 'urgent'
    },
    {
      _id: 'task_ovd_2',
      title: 'Update project report',
      dueDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days overdue
      priority: 'high'
    },
    {
      _id: 'task_ovd_3',
      title: 'Submit project details',
      dueDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days overdue
      priority: 'medium'
    }
  ];

  // 2. Today's Tasks (2)
  const dueToday = [
    {
      _id: 'task_today_1',
      title: 'Complete API integration',
      dueDate: now,
      priority: 'high'
    },
    {
      _id: 'task_today_2',
      title: 'Review team progress',
      dueDate: now,
      priority: 'medium'
    }
  ];

  // 3. Upcoming Tasks (2)
  const upcomingDate1 = new Date();
  upcomingDate1.setDate(upcomingDate1.getDate() + 2);
  const upcomingDate2 = new Date();
  upcomingDate2.setDate(upcomingDate2.getDate() + 3);

  const dueSoon = [
    {
      _id: 'task_upc_1',
      title: 'Database optimization',
      dueDate: upcomingDate1,
      priority: 'high'
    },
    {
      _id: 'task_upc_2',
      title: 'UI review',
      dueDate: upcomingDate2,
      priority: 'low'
    }
  ];

  // 4. Pending Approvals (2)
  const pendingApprovals = [
    {
      _id: 'task_appr_1',
      title: 'Approval for Admin Role Elevation',
      createdBy: { firstName: 'Nitesh', lastName: 'Admin' },
      autoApproveAfter: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      priority: 'urgent',
      taskType: 'approval'
    },
    {
      _id: 'task_appr_2',
      title: 'Budget Allocation for Infrastructure Scaling',
      createdBy: { firstName: 'Finance', lastName: 'Dept' },
      autoApproveAfter: new Date(now.getTime() + 48 * 60 * 60 * 1000),
      priority: 'medium',
      taskType: 'approval'
    }
  ];

  // Total = 3 + 2 + 2 + 2 = 9 pending tasks!
  const taskSummary = {
    overdueTasks,
    dueToday,
    dueSoon,
    pendingApprovals,
    totalPending: overdueTasks.length + dueToday.length + dueSoon.length + pendingApprovals.length
  };

  console.log(`\n📧 Sending Good Morning Daily Briefing (with Pending Approvals section) to: ${recipientUser.email}...`);
  const result = await emailService.sendMorningBriefingEmail(
    recipientUser,
    taskSummary,
    'Asia/Kolkata'
  );

  console.log('\n=== RESULT ===');
  console.log(JSON.stringify(result, null, 2));
}

sendExactGoodMorningWithApprovals().catch(err => {
  console.error('Fatal error:', err);
});
