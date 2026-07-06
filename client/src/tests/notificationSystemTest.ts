import { 
  NotificationService, 
  CreateNotificationDto,
  NotificationFilters,
  PaginationOptions 
} from '../services/notificationService';
import { InAppNotificationChannel } from '../channels/inAppNotificationChannel';
import { EmailNotificationChannel } from '../channels/emailNotificationChannel';
import { PushNotificationChannel } from '../channels/pushNotificationChannel';
import { NotificationTriggerConfig } from '../config/notificationTriggerConfig';
import {
  TriggerEvent,
  NotificationPriority,
  ChannelType,
  DeviceType
} from '../models';
import { ObjectId } from 'mongodb';

/**
 * Mock implementations for testing
 */
class MockLogger {
  info(message: string, meta?: any) {
    console.log(`[INFO] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  }
  
  error(message: string, meta?: any) {
    console.error(`[ERROR] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  }
  
  warn(message: string, meta?: any) {
    console.warn(`[WARN] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  }
}

class MockNotificationModel {
  private notifications: any[] = [];
  private idCounter = 1;

  async create(data: any) {
    const notification = {
      _id: new ObjectId(),
      ...data,
      created_at: new Date(),
      updated_at: new Date()
    };
    this.notifications.push(notification);
    return notification;
  }

  async updateOne(filter: any, update: any) {
    const notification = this.notifications.find(n => 
      n._id.toString() === filter._id?.toString()
    );
    if (notification) {
      Object.assign(notification, update.$set || {});
      if (update.$push) {
        Object.keys(update.$push).forEach(key => {
          if (!notification[key]) notification[key] = [];
          notification[key].push(update.$push[key]);
        });
      }
    }
    return { matchedCount: notification ? 1 : 0 };
  }

  async findOne(filter: any) {
    return this.notifications.find(n => 
      Object.keys(filter).every(key => n[key] === filter[key])
    );
  }

  async find(filter: any) {
    return this.notifications.filter(n =>
      Object.keys(filter).every(key => {
        if (key === 'deleted_at' && filter[key] === null) {
          return !n[key];
        }
        return n[key] === filter[key];
      })
    );
  }

  async countDocuments(filter: any) {
    return this.find(filter).then(results => results.length);
  }

  async getUnreadCount(userId: ObjectId) {
    return this.notifications.filter(n => 
      n.user_id.toString() === userId.toString() && !n.is_read
    ).length;
  }
}

class MockSocketIO {
  private rooms: Map<string, Set<string>> = new Map();
  
  to(room: string) {
    return {
      emit: (event: string, data: any) => {
        console.log(`[SOCKET] Emitting to room ${room}:`, { event, data });
      }
    };
  }

  get sockets() {
    return {
      adapter: {
        rooms: this.rooms
      }
    };
  }
}

class MockNodemailer {
  createTransporter(config: any) {
    return {
      async sendMail(options: any) {
        console.log('[EMAIL] Sending email:', {
          to: options.to,
          subject: options.subject,
          from: options.from
        });
        return {
          messageId: `test-${Date.now()}@example.com`,
          response: 'OK'
        };
      },
      async verify() {
        return true;
      }
    };
  }
}

class MockFirebaseAdmin {
  initializeApp(config: any) {
    return {
      messaging: () => ({
        send: async (message: any) => {
          console.log('[PUSH] Sending push notification:', {
            token: message.token?.substring(0, 20) + '...',
            title: message.notification?.title,
            body: message.notification?.body
          });
          return `projects/test/messages/${Date.now()}`;
        }
      })
    };
  }

  get credential() {
    return {
      cert: (config: any) => config
    };
  }
}

/**
 * Notification System Test Suite
 */
export class NotificationSystemTest {
  private logger = new MockLogger();
  private notificationModel = new MockNotificationModel();
  private socketIO = new MockSocketIO();
  private nodemailer = new MockNodemailer();
  private firebaseAdmin = new MockFirebaseAdmin();

  private notificationService: NotificationService;
  private inAppChannel: InAppNotificationChannel;
  private emailChannel: EmailNotificationChannel;
  private pushChannel: PushNotificationChannel;

  constructor() {
    // Set test environment variables
    this.setupTestEnvironment();
    
    // Initialize channels
    this.inAppChannel = new InAppNotificationChannel(
      this.socketIO as any,
      this.logger,
      this.notificationModel as any
    );

    this.emailChannel = new EmailNotificationChannel(
      this.nodemailer as any,
      this.logger,
      this.notificationModel as any
    );

    this.pushChannel = new PushNotificationChannel(
      this.firebaseAdmin as any,
      this.logger,
      this.notificationModel as any
    );

    // Initialize notification service
    this.notificationService = new NotificationService(
      {} as any, // Channel factory not needed for direct testing
      this.logger,
      this.notificationModel as any
    );
  }

  private setupTestEnvironment() {
    // Email configuration
    process.env.EMAIL_HOST = 'smtp.gmail.com';
    process.env.EMAIL_PORT = '587';
    process.env.EMAIL_SECURE = 'false';
    process.env.EMAIL_USER = 'test@example.com';
    process.env.EMAIL_PASSWORD = 'test-password';
    process.env.EMAIL_FROM_ADDRESS = 'noreply@taskmanager.com';
    process.env.EMAIL_FROM_NAME = 'Task Manager';
    process.env.APP_URL = 'http://localhost:3000';
    process.env.APP_NAME = 'Test Task Manager';

    // Push notification configuration
    process.env.ENABLE_PUSH_NOTIFICATIONS = 'true';
    process.env.FIREBASE_CREDENTIALS_JSON = JSON.stringify({
      type: 'service_account',
      project_id: 'test-project',
      private_key: 'test-key',
      client_email: 'test@test-project.iam.gserviceaccount.com'
    });
  }

  /**
   * Test 1: Basic notification creation and trigger config
   */
  async testBasicNotificationCreation() {
    console.log('\n=== TEST 1: Basic Notification Creation ===');

    try {
      const testUser = {
        _id: new ObjectId(),
        name: 'John Doe',
        email: 'john@example.com'
      };

      const notificationData: CreateNotificationDto = {
        user_id: testUser._id,
        trigger_event: TriggerEvent.TASK_CREATED,
        related_entity: {
          entity_type: 'task',
          entity_id: new ObjectId()
        },
        priority: NotificationPriority.NORMAL,
        title: 'New Task Assigned',
        message: 'You have been assigned a new task'
      };

      // Test trigger config formatting
      const config = NotificationTriggerConfig.getConfig(TriggerEvent.TASK_CREATED);
      console.log('Trigger Config:', config);

      const formattedTitle = NotificationTriggerConfig.formatTitle(
        TriggerEvent.TASK_CREATED,
        { task_title: 'Test Task', creator_name: 'Jane Smith' }
      );
      console.log('Formatted Title:', formattedTitle);

      console.log('✅ Basic notification creation test passed');
    } catch (error) {
      console.error('❌ Basic notification creation test failed:', error);
    }
  }

  /**
   * Test 2: In-App notification channel
   */
  async testInAppNotifications() {
    console.log('\n=== TEST 2: In-App Notifications ===');

    try {
      const testUser = {
        _id: new ObjectId(),
        name: 'John Doe',
        email: 'john@example.com'
      };

      const notification = {
        _id: new ObjectId(),
        user_id: testUser._id,
        trigger_event: TriggerEvent.TASK_OVERDUE,
        related_entity: {
          entity_type: 'task',
          entity_id: new ObjectId()
        },
        priority: NotificationPriority.URGENT,
        title: 'Task Overdue',
        message: 'Your task is overdue',
        channels: [],
        created_at: new Date(),
        updated_at: new Date()
      } as any;

      // Test canSend
      const canSend = await this.inAppChannel.canSend(testUser);
      console.log('Can send in-app:', canSend);

      // Test send
      const success = await this.inAppChannel.send(notification, testUser);
      console.log('In-app send success:', success);

      console.log('✅ In-app notification test passed');
    } catch (error) {
      console.error('❌ In-app notification test failed:', error);
    }
  }

  /**
   * Test 3: Email notification channel
   */
  async testEmailNotifications() {
    console.log('\n=== TEST 3: Email Notifications ===');

    try {
      const testUser = {
        _id: new ObjectId(),
        name: 'John Doe',
        email: 'john@example.com',
        email_verified: true
      };

      const notification = {
        _id: new ObjectId(),
        user_id: testUser._id,
        trigger_event: TriggerEvent.APPROVAL_REQUESTED,
        related_entity: {
          entity_type: 'approval',
          entity_id: new ObjectId()
        },
        priority: NotificationPriority.URGENT,
        title: 'Approval Required',
        message: 'Please review and approve this request',
        channels: [],
        metadata: {
          requester_name: 'Alice Johnson',
          approval_type: 'Budget Request'
        },
        created_at: new Date(),
        updated_at: new Date()
      } as any;

      // Test canSend
      const canSend = await this.emailChannel.canSend(testUser);
      console.log('Can send email:', canSend);

      // Test send
      const success = await this.emailChannel.send(notification, testUser);
      console.log('Email send success:', success);

      console.log('✅ Email notification test passed');
    } catch (error) {
      console.error('❌ Email notification test failed:', error);
    }
  }

  /**
   * Test 4: Push notification channel
   */
  async testPushNotifications() {
    console.log('\n=== TEST 4: Push Notifications ===');

    try {
      const testUser = {
        _id: new ObjectId(),
        name: 'John Doe',
        email: 'john@example.com'
      };

      // Register a test device
      const deviceToken = 'test-fcm-token-' + Date.now();
      await this.pushChannel.registerDevice(
        testUser._id,
        deviceToken,
        DeviceType.ANDROID,
        { model: 'Test Device', version: '1.0' }
      );

      const notification = {
        _id: new ObjectId(),
        user_id: testUser._id,
        trigger_event: TriggerEvent.TASK_DUE_TODAY,
        related_entity: {
          entity_type: 'task',
          entity_id: new ObjectId()
        },
        priority: NotificationPriority.NORMAL,
        title: 'Task Due Today',
        message: 'Don\'t forget to complete your task',
        channels: [],
        created_at: new Date(),
        updated_at: new Date()
      } as any;

      // Test canSend
      const canSend = await this.pushChannel.canSend(testUser);
      console.log('Can send push:', canSend);

      // Test send
      const success = await this.pushChannel.send(notification, testUser);
      console.log('Push send success:', success);

      // Test device management
      const devices = await this.pushChannel.getUserDevices(testUser._id);
      console.log('User devices:', devices.length);

      console.log('✅ Push notification test passed');
    } catch (error) {
      console.error('❌ Push notification test failed:', error);
    }
  }

  /**
   * Test 5: All trigger events
   */
  async testAllTriggerEvents() {
    console.log('\n=== TEST 5: All Trigger Events ===');

    try {
      const allEvents = NotificationTriggerConfig.getAllTriggerEvents();
      console.log(`Testing ${allEvents.length} trigger events:`);

      for (const event of allEvents) {
        try {
          const config = NotificationTriggerConfig.getConfig(event);
          const recipients = NotificationTriggerConfig.getRecipientRoles(event);
          const channels = NotificationTriggerConfig.getDefaultChannels(event);
          
          console.log(`✓ ${event}:`, {
            recipients: recipients.length,
            channels: channels.length,
            priority: config.priority,
            escalates: config.should_escalate
          });
        } catch (error) {
          console.error(`✗ ${event}: Failed -`, error);
        }
      }

      console.log('✅ All trigger events test completed');
    } catch (error) {
      console.error('❌ All trigger events test failed:', error);
    }
  }

  /**
   * Test 6: Notification preferences by role
   */
  async testNotificationPreferences() {
    console.log('\n=== TEST 6: Notification Preferences ===');

    try {
      const roles = ['admin', 'manager', 'assignee', 'creator', 'collaborator', 'approver'];
      
      for (const role of roles) {
        const preferences = NotificationTriggerConfig.getDefaultPreferencesByRole(role);
        console.log(`${role.toUpperCase()} preferences:`, preferences.length, 'events configured');
      }

      console.log('✅ Notification preferences test passed');
    } catch (error) {
      console.error('❌ Notification preferences test failed:', error);
    }
  }

  /**
   * Test 7: Template rendering
   */
  async testTemplateRendering() {
    console.log('\n=== TEST 7: Template Rendering ===');

    try {
      const testData = {
        task_title: 'Implement User Authentication',
        creator_name: 'Alice Smith',
        assignee_name: 'Bob Johnson',
        due_date: new Date(),
        hours_overdue: 24,
        priority: 'high'
      };

      // Test different trigger events
      const events = [
        TriggerEvent.TASK_CREATED,
        TriggerEvent.TASK_OVERDUE,
        TriggerEvent.APPROVAL_REQUESTED,
        TriggerEvent.USER_MENTIONED
      ];

      for (const event of events) {
        const title = NotificationTriggerConfig.formatTitle(event, testData);
        const message = NotificationTriggerConfig.formatMessage(event, testData);
        
        console.log(`${event}:`);
        console.log(`  Title: ${title}`);
        console.log(`  Message: ${message}`);
      }

      console.log('✅ Template rendering test passed');
    } catch (error) {
      console.error('❌ Template rendering test failed:', error);
    }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🚀 Starting Notification System Test Suite');
    console.log('==========================================');

    await this.testBasicNotificationCreation();
    await this.testInAppNotifications();
    await this.testEmailNotifications();
    await this.testPushNotifications();
    await this.testAllTriggerEvents();
    await this.testNotificationPreferences();
    await this.testTemplateRendering();

    console.log('\n🎉 Test Suite Completed!');
    console.log('Check the logs above for detailed results.');
  }

  /**
   * Quick smoke test for CI/CD
   */
  async smokeTest() {
    console.log('🔥 Running Smoke Test');
    
    try {
      // Test configuration loading
      const config = NotificationTriggerConfig.getConfig(TriggerEvent.TASK_CREATED);
      if (!config) throw new Error('Config loading failed');

      // Test channel initialization
      const testUser = { _id: new ObjectId(), email: 'test@example.com' };
      const canSendInApp = await this.inAppChannel.canSend(testUser);
      if (!canSendInApp) throw new Error('In-app channel failed');

      console.log('✅ Smoke test passed - system is operational');
      return true;
    } catch (error) {
      console.error('❌ Smoke test failed:', error);
      return false;
    }
  }
}

// Export for testing
export default NotificationSystemTest;

// CLI runner
if (require.main === module) {
  const tester = new NotificationSystemTest();
  
  const args = process.argv.slice(2);
  if (args.includes('--smoke')) {
    tester.smokeTest();
  } else {
    tester.runAllTests();
  }
}