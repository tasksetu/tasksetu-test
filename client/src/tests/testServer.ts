import express from 'express';
import { ObjectId } from 'mongodb';
import { 
  NotificationService,
  CreateNotificationDto 
} from '../services/notificationService';
import { NotificationTriggerConfig } from '../config/notificationTriggerConfig';
import { 
  TriggerEvent, 
  NotificationPriority, 
  ChannelType,
  DeviceType 
} from '../models';

/**
 * Simple Express API for testing notifications
 * Run with: npm run test-notifications
 */

const app = express();
app.use(express.json());

// Mock data for testing
const mockUsers = [
  {
    _id: new ObjectId('507f1f77bcf86cd799439011'),
    name: 'John Doe',
    email: 'john.doe@example.com',
    role: 'assignee',
    email_verified: true
  },
  {
    _id: new ObjectId('507f1f77bcf86cd799439012'),
    name: 'Jane Smith', 
    email: 'jane.smith@example.com',
    role: 'manager',
    email_verified: true
  },
  {
    _id: new ObjectId('507f1f77bcf86cd799439013'),
    name: 'Bob Johnson',
    email: 'bob.johnson@example.com', 
    role: 'admin',
    email_verified: true
  }
];

const mockTasks = [
  {
    _id: new ObjectId('507f1f77bcf86cd799439021'),
    title: 'Implement User Authentication',
    description: 'Add JWT-based authentication system',
    created_by: mockUsers[1]._id,
    assigned_to: mockUsers[0]._id,
    manager_id: mockUsers[1]._id,
    priority: 'high',
    status: 'in_progress',
    due_date: new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
  },
  {
    _id: new ObjectId('507f1f77bcf86cd799439022'),
    title: 'Design Database Schema',
    description: 'Create MongoDB schema for user management',
    created_by: mockUsers[1]._id,
    assigned_to: mockUsers[0]._id,
    manager_id: mockUsers[1]._id,
    priority: 'medium',
    status: 'pending',
    due_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // Overdue
  }
];

// Initialize notification system (you'll need to inject real dependencies)
let notificationService: NotificationService | null = null;

/**
 * Test endpoints
 */

// Get all available trigger events and their configurations
app.get('/api/test/trigger-events', (req, res) => {
  try {
    const events = NotificationTriggerConfig.getAllTriggerEvents();
    const configurations = events.map(event => ({
      event,
      config: NotificationTriggerConfig.getConfig(event),
      recipients: NotificationTriggerConfig.getRecipientRoles(event),
      channels: NotificationTriggerConfig.getDefaultChannels(event)
    }));

    res.json({
      success: true,
      total_events: events.length,
      configurations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test notification creation for specific trigger event
app.post('/api/test/notifications/:triggerEvent', async (req, res) => {
  try {
    const { triggerEvent } = req.params;
    const { userId, taskId, metadata = {} } = req.body;

    // Find user and task
    const user = mockUsers.find(u => u._id.toString() === userId);
    const task = mockTasks.find(t => t._id.toString() === (taskId || mockTasks[0]._id.toString()));

    if (!user) {
      return res.status(400).json({ success: false, error: 'User not found' });
    }

    if (!task) {
      return res.status(400).json({ success: false, error: 'Task not found' });
    }

    // Get trigger configuration
    const config = NotificationTriggerConfig.getConfig(triggerEvent as TriggerEvent);
    
    // Prepare template data
    const templateData = {
      task_title: task.title,
      creator_name: mockUsers.find(u => u._id.toString() === task.created_by.toString())?.name || 'Unknown',
      assignee_name: mockUsers.find(u => u._id.toString() === task.assigned_to.toString())?.name || 'Unknown',
      manager_name: mockUsers.find(u => u._id.toString() === task.manager_id?.toString())?.name || 'Unknown',
      task_priority: task.priority,
      task_status: task.status,
      due_date: task.due_date,
      ...metadata
    };

    // Format title and message
    const title = NotificationTriggerConfig.formatTitle(triggerEvent as TriggerEvent, templateData);
    const message = NotificationTriggerConfig.formatMessage(triggerEvent as TriggerEvent, templateData);

    // Create notification data
    const notificationData: CreateNotificationDto = {
      user_id: user._id,
      trigger_event: triggerEvent as TriggerEvent,
      related_entity: {
        entity_type: 'task',
        entity_id: task._id
      },
      priority: config.priority,
      title,
      message,
      metadata: templateData
    };

    // Log what would be created (since we don't have real NotificationService here)
    console.log('📧 Would create notification:', {
      user: user.name,
      email: user.email,
      trigger: triggerEvent,
      title,
      message,
      priority: config.priority,
      channels: config.default_channels
    });

    res.json({
      success: true,
      notification: notificationData,
      template_data: templateData,
      config: config,
      preview: {
        user: user.name,
        email: user.email,
        title,
        message,
        channels: config.default_channels,
        priority: config.priority
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get mock users for testing
app.get('/api/test/users', (req, res) => {
  res.json({
    success: true,
    users: mockUsers.map(user => ({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    }))
  });
});

// Get mock tasks for testing
app.get('/api/test/tasks', (req, res) => {
  res.json({
    success: true,
    tasks: mockTasks.map(task => ({
      id: task._id,
      title: task.title,
      description: task.description,
      created_by: mockUsers.find(u => u._id.toString() === task.created_by.toString())?.name,
      assigned_to: mockUsers.find(u => u._id.toString() === task.assigned_to.toString())?.name,
      manager: mockUsers.find(u => u._id.toString() === task.manager_id?.toString())?.name,
      priority: task.priority,
      status: task.status,
      due_date: task.due_date,
      is_overdue: task.due_date < new Date()
    }))
  });
});

// Test template rendering with custom data
app.post('/api/test/template/:triggerEvent', (req, res) => {
  try {
    const { triggerEvent } = req.params;
    const templateData = req.body;

    const title = NotificationTriggerConfig.formatTitle(triggerEvent as TriggerEvent, templateData);
    const message = NotificationTriggerConfig.formatMessage(triggerEvent as TriggerEvent, templateData);
    const config = NotificationTriggerConfig.getConfig(triggerEvent as TriggerEvent);

    res.json({
      success: true,
      trigger_event: triggerEvent,
      template_data: templateData,
      rendered: {
        title,
        message
      },
      config: {
        priority: config.priority,
        channels: config.default_channels,
        recipients: config.default_recipient_roles,
        escalation: config.should_escalate ? {
          hours: config.escalation_hours,
          enabled: true
        } : { enabled: false }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test preferences by role
app.get('/api/test/preferences/:role', (req, res) => {
  try {
    const { role } = req.params;
    const preferences = NotificationTriggerConfig.getDefaultPreferencesByRole(role);

    res.json({
      success: true,
      role,
      total_preferences: preferences.length,
      preferences: preferences.map(pref => ({
        trigger_event: pref.trigger_event,
        channels: pref.channels,
        priority: pref.priority
      }))
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Simulate common notification scenarios
app.post('/api/test/scenarios/:scenario', async (req, res) => {
  try {
    const { scenario } = req.params;
    const scenarios: Record<string, any> = {
      'task-created': {
        trigger: TriggerEvent.TASK_CREATED,
        user: mockUsers[0], // assignee
        task: mockTasks[0],
        description: 'User gets assigned a new task'
      },
      'task-overdue': {
        trigger: TriggerEvent.TASK_OVERDUE,
        user: mockUsers[0], // assignee
        task: mockTasks[1], // overdue task
        description: 'Task becomes overdue'
      },
      'approval-requested': {
        trigger: TriggerEvent.APPROVAL_REQUESTED,
        user: mockUsers[1], // manager (approver)
        task: mockTasks[0],
        description: 'Manager receives approval request'
      },
      'critical-escalation': {
        trigger: TriggerEvent.CRITICAL_ESCALATION,
        user: mockUsers[2], // admin
        task: mockTasks[1], // overdue task
        description: 'Overdue task escalated to admin'
      }
    };

    const scenarioData = scenarios[scenario];
    if (!scenarioData) {
      return res.status(400).json({
        success: false,
        error: 'Invalid scenario',
        available_scenarios: Object.keys(scenarios)
      });
    }

    const config = NotificationTriggerConfig.getConfig(scenarioData.trigger);
    const templateData = {
      task_title: scenarioData.task.title,
      creator_name: mockUsers.find(u => u._id.toString() === scenarioData.task.created_by.toString())?.name,
      assignee_name: mockUsers.find(u => u._id.toString() === scenarioData.task.assigned_to.toString())?.name,
      hours_overdue: scenario === 'task-overdue' ? 48 : undefined,
      requester_name: scenario === 'approval-requested' ? 'John Doe' : undefined,
    };

    const title = NotificationTriggerConfig.formatTitle(scenarioData.trigger, templateData);
    const message = NotificationTriggerConfig.formatMessage(scenarioData.trigger, templateData);

    res.json({
      success: true,
      scenario,
      description: scenarioData.description,
      notification: {
        user: {
          name: scenarioData.user.name,
          email: scenarioData.user.email,
          role: scenarioData.user.role
        },
        trigger_event: scenarioData.trigger,
        title,
        message,
        priority: config.priority,
        channels: config.default_channels,
        escalation: config.should_escalate
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Start server
const PORT = process.env.TEST_PORT || 3001;
app.listen(PORT, () => {
  console.log('🧪 Notification Testing Server Started');
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log('\n📝 Available test endpoints:');
  console.log(`GET  /api/test/trigger-events - List all trigger events`);
  console.log(`GET  /api/test/users - Get mock users`);
  console.log(`GET  /api/test/tasks - Get mock tasks`);
  console.log(`POST /api/test/notifications/:triggerEvent - Test notification creation`);
  console.log(`POST /api/test/template/:triggerEvent - Test template rendering`);
  console.log(`GET  /api/test/preferences/:role - Test role preferences`);
  console.log(`POST /api/test/scenarios/:scenario - Test common scenarios`);
  console.log('\n🚀 Example usage:');
  console.log(`curl http://localhost:${PORT}/api/test/trigger-events`);
  console.log(`curl -X POST http://localhost:${PORT}/api/test/scenarios/task-created`);
});

export default app;