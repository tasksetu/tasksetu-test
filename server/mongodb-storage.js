import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import mongoose from "mongoose";
import { emailService } from "./services/emailService.js";
import {
  Project,
  TaskStatus,
  Task,
  TaskComment,
  TaskAssignment,
  TaskAuditLog,
  UsageTracking,
  Form,
  ProcessFlow,
  FormResponse,
  ProcessInstance,
} from "./models.js";
import { Organization } from "./modals/organizationModal.js";
import { OrganizationSubscription } from "./modals/organizationSubscriptionModal.js";
import { PendingUser } from "./modals/pendingUserModal.js";
import { User } from "./modals/userModal.js";
import { ActivityHelper } from "./activity-helper.js";
import {
  Notification,
  TriggerEvent,
  EntityType,
  NotificationPriority,
  ChannelType,
  ChannelStatus
} from './modals/notificationModal.js';
export class MongoStorage {
  // Token generation methods
  generateToken(user) {
    const JWT_SECRET = process.env.JWT_SECRET || "your-jwt-secret-key";
    return jwt.sign(
      {
        id: user.id || user._id,
        email: user.email,
        organizationId: user.organization
          ? user.organization.toString()
          : undefined,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "30d" } // Extended to 30 days
    );
  }

  async hashPassword(password) {
    return await bcrypt.hash(password, 12);
  }

  async verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  generatePasswordResetToken() {
    return crypto.randomBytes(32).toString("hex");
  }

  generateEmailVerificationToken() {
    return crypto.randomBytes(32).toString("hex");
  }

  // Organization operations
  async createOrganization(orgData) {
    const organization = new Organization(orgData);
    return await organization.save();
  }

  async getOrganization(id) {
    return await Organization.findById(id);
  }

  // async getOrganizationBySlug(slug) {
  //   return await Organization.findOne({ slug });
  // }
  async getOrganizationByName(name) {
    return await Organization.findOne({ name });
  }
  async updateOrganization(id, orgData) {
    return await Organization.findByIdAndUpdate(id, orgData, { new: true });
  }

  async getOrganizationUsers(orgId) {
    const users = await User.find({ organization_id: orgId })
      .select("-passwordHash")
      .populate({
        path: 'license_id',
        select: 'license_type license_id status assigned_at'
      })
      .sort({ firstName: 1, lastName: 1 });

    // Add license_code field for backward compatibility
    return users.map(user => {
      const userObj = user.toObject();
      if (user.license_id) {
        userObj.license_code = user.license_id.license_type;
      }
      return userObj;
    });
  }
  // User operations
  async getUsers() {
    return await User.find().sort({ createdAt: -1 });
  }

  async getUser(id) {
    return await User.findById(id);
  }

  async getUserByEmail(email) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      console.log("getUserByEmail found user:", {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        hasFirstName: !!user.firstName,
        hasLastName: !!user.lastName,
      });
    }
    return user;
  }

  async createUser(userData) {
    console.log("Creating user with data:", userData);
    // For invited users, set default values for required fields
    if (userData.status === "invited" && !userData.passwordHash) {
      userData.firstName = userData.firstName || "";
      userData.lastName = userData.lastName || "";
      userData.passwordHash =
        userData.passwordHash || "temp_invite_placeholder";
      userData.isActive = false;
      userData.emailVerified = false;
      userData.inviteToken = this.generateEmailVerificationToken();
      userData.inviteTokenExpiry = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ); // 7 days
      userData.invitedAt = new Date();
    }

    // Hash password if provided for non-invited users
    if (
      userData.password &&
      !userData.passwordHash &&
      userData.status !== "invited"
    ) {
      userData.passwordHash = await this.hashPassword(userData.password);
      delete userData.password;
    }

    // 🆕 NEW: Set default license fields for user-level licensing
    // All new users get EXPLORE license with trial_days from License model
    if (!userData.license_code) {
      userData.license_code = 'EXPLORE';
    }
    if (userData.license_code === 'EXPLORE') {
      userData.license_expiry = null;
    }
    console.log("user created....", userData);
    const user = new User(userData);
    const savedUser = await user.save();

    // Create default notification settings for the new user
    try {
      const { NotificationSettings } = await import('./modals/notificationSettingsModal.js');
      await NotificationSettings.createDefaultSettings(savedUser._id);
      console.log('Default notification settings created for user:', savedUser._id);
    } catch (settingsError) {
      console.error('Failed to create notification settings for user:', settingsError);
      // Don't fail user creation if notification settings fail
    }

    // Track user creation/joining
    if (userData.organization) {
      await this.trackActivity({
        activityType: ActivityHelper.ACTIVITY_TYPES.USER_JOINED,
        userId: savedUser._id,
        organizationId: userData.organization,
        relatedId: savedUser._id,
        relatedType: "user",
        data: {
          userName:
            `${userData.firstName} ${userData.lastName}`.trim() ||
            userData.email,
          role: userData.role,
        },
      });
    }

    return savedUser;
  }

  async updateUser(id, userData) {
    const oldUser = await User.findById(id);
    const user = await User.findByIdAndUpdate(id, userData, { new: true });

    if (oldUser && userData.organization) {
      // Track role changes
      if (oldUser.role !== userData.role && userData.role) {
        await this.trackActivity({
          activityType: ActivityHelper.ACTIVITY_TYPES.ROLE_CHANGED,
          userId: id,
          organizationId: userData.organization || oldUser.organization,
          relatedId: id,
          relatedType: "user",
          data: {
            userName: `${user.firstName} ${user.lastName}`.trim() || user.email,
            oldValue: oldUser.role,
            newValue: userData.role,
          },
        });
      }
    }

    return user;
  }

  async deleteUser(id) {
    const user = await User.findById(id);
    if (user && user.organization) {
      await this.trackActivity({
        activityType: ActivityHelper.ACTIVITY_TYPES.USER_LEFT,
        userId: id,
        organizationId: user.organization,
        relatedId: id,
        relatedType: "user",
        data: {
          userName: `${user.firstName} ${user.lastName}`.trim() || user.email,
        },
      });
    }
    return await User.findByIdAndDelete(id);
  }

  // Project operations
  async getProjects() {
    return await Project.find().sort({ createdAt: -1 });
  }

  async getProject(id) {
    return await Project.findById(id);
  }

  async createProject(projectData) {
    const project = new Project(projectData);
    const savedProject = await project.save();

    // Track project creation
    await this.trackActivity({
      activityType: ActivityHelper.ACTIVITY_TYPES.PROJECT_CREATED,
      userId: projectData.owner,
      organizationId: projectData.organization,
      relatedId: savedProject._id,
      relatedType: "project",
      data: {
        projectName: projectData.name,
      },
    });

    return savedProject;
  }

  async updateProject(id, projectData) {
    const oldProject = await Project.findById(id);
    const project = await Project.findByIdAndUpdate(id, projectData, {
      new: true,
    });

    if (oldProject) {
      // Track project update
      await this.trackActivity({
        activityType: ActivityHelper.ACTIVITY_TYPES.PROJECT_UPDATED,
        userId: projectData.owner || oldProject.owner,
        organizationId: project.organization,
        relatedId: project._id,
        relatedType: "project",
        data: {
          projectName: project.name,
          changes: ActivityHelper.createComparisonData(
            oldProject.toObject(),
            projectData,
            ["name", "description", "status"]
          ),
        },
      });

      // Track archiving specifically
      if (
        oldProject.status !== projectData.status &&
        projectData.status === "archived"
      ) {
        await this.trackActivity({
          activityType: ActivityHelper.ACTIVITY_TYPES.PROJECT_ARCHIVED,
          userId: projectData.owner || oldProject.owner,
          organizationId: project.organization,
          relatedId: project._id,
          relatedType: "project",
          data: {
            projectName: project.name,
          },
        });
      }
    }

    return project;
  }

  async deleteProject(id) {
    const project = await Project.findById(id);
    if (project) {
      await this.trackActivity({
        activityType: ActivityHelper.ACTIVITY_TYPES.PROJECT_ARCHIVED, // Using archived for delete
        userId: project.owner,
        organizationId: project.organization,
        relatedId: id,
        relatedType: "project",
        data: {
          projectName: project.name,
        },
      });
    }
    return await Project.findByIdAndDelete(id);
  }

  // Task operations
  async getTasks(filters = {}) {
    let query = {};

    if (filters.status && filters.status !== "all") {
      query.status = filters.status;
    }

    if (filters.priority && filters.priority !== "all") {
      query.priority = filters.priority;
    }

    if (filters.assignee && filters.assignee !== "all") {
      query.assigneeName = filters.assignee;
    }

    if (filters.project && filters.project !== "all") {
      query.projectName = filters.project;
    }

    return await Task.find(query).sort({ createdAt: -1 });
  }

  async getTask(id) {
    return await Task.findById(id);
  }

  async createTask(taskData) {
    const task = new Task(taskData);
    const savedTask = await task.save();

    // Enhanced activity tracking
    // ✅ Only track TASK_CREATED for regular tasks, NOT for subtasks
    // Subtasks are tracked via SUBTASK_ADDED in the parent task
    if (!taskData.isSubtask && !taskData.parentTaskId) {
      await this.trackActivity({
        activityType: ActivityHelper.ACTIVITY_TYPES.TASK_CREATED,
        userId: taskData.createdBy,
        organizationId: taskData.organization,
        relatedId: savedTask._id,
        relatedType: "task",
        data: {
          taskTitle: taskData.title,
          priority: taskData.priority,
          status: taskData.status,
          dueDate: taskData.dueDate,
          assignedTo: taskData.assignedTo,
        },
      });
    }

    // NOTE: Notifications are now handled in the controller layer for better control
    // This allows us to handle collaborators, approvers, and custom logic
    // See createTask controller for notification implementation

    // Create Google Calendar event if user has connected Google Calendar
    if (taskData.assignedTo && taskData.dueDate) {
      await this.createGoogleCalendarEventForTask(savedTask);
    }

    return savedTask;
  }

  // Google Calendar integration methods
  async storeGoogleCalendarTokens(userId, tokens) {
    try {
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          googleCalendarTokens: tokens,
          googleCalendarConnected: true,
          googleCalendarEmail: tokens.email || null,
        },
        { new: true }
      );

      console.log(
        "Google Calendar tokens stored successfully for user:",
        userId
      );
      return updatedUser;
    } catch (error) {
      console.error("Error storing Google Calendar tokens:", error);
      throw error;
    }
  }

  async getGoogleCalendarTokens(userId) {
    try {
      const user = await User.findById(userId).select(
        "googleCalendarTokens googleCalendarConnected"
      );
      return user?.googleCalendarTokens || null;
    } catch (error) {
      console.error("Error retrieving Google Calendar tokens:", error);
      return null;
    }
  }

  async removeGoogleCalendarTokens(userId) {
    try {
      await User.findByIdAndUpdate(userId, {
        $unset: {
          googleCalendarTokens: 1,
          googleCalendarEmail: 1,
        },
        googleCalendarConnected: false,
      });
      console.log("Google Calendar tokens removed for user:", userId);
    } catch (error) {
      console.error("Error removing Google Calendar tokens:", error);
      throw error;
    }
  }

  async createGoogleCalendarEventForTask(task) {
    try {
      if (!task.assignedTo || !task.dueDate) {
        return null;
      }

      // Get assignee's Google Calendar tokens
      const assigneeTokens = await this.getGoogleCalendarTokens(
        task.assignedTo
      );

      if (!assigneeTokens || !assigneeTokens.access_token) {
        console.log(
          "No Google Calendar tokens found for user:",
          task.assignedTo
        );
        return null;
      }

      // Import Google Calendar API
      const { google } = await import("googleapis");

      // Set up OAuth2 client
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID || '798343498792-uq3sq26veej0ptj8r9n949mu107m3qap.apps.googleusercontent.com',
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      oauth2Client.setCredentials(assigneeTokens);

      const calendar = google.calendar({ version: "v3", auth: oauth2Client });

      // Create event object
      const eventStartTime = new Date(task.dueDate);
      const eventEndTime = new Date(eventStartTime.getTime() + 60 * 60 * 1000); // 1 hour duration

      const event = {
        summary: `Task: ${task.title}`,
        description: `${task.description || ""}\n\nTask ID: ${task._id
          }\nPriority: ${task.priority || "Normal"}\nStatus: ${task.status || "Pending"
          }`,
        start: {
          dateTime: eventStartTime.toISOString(),
          timeZone: "UTC",
        },
        end: {
          dateTime: eventEndTime.toISOString(),
          timeZone: "UTC",
        },
        colorId: this.getCalendarColorForPriority(task.priority),
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 }, // 1 day before
            { method: "popup", minutes: 30 }, // 30 minutes before
          ],
        },
      };

      const response = await calendar.events.insert({
        calendarId: "primary",
        resource: event,
      });

      // Store the Google Calendar event ID in the task
      await Task.findByIdAndUpdate(task._id, {
        googleCalendarEventId: response.data.id,
      });

      console.log("Google Calendar event created:", response.data.id);
      return response.data;
    } catch (error) {
      console.error("Error creating Google Calendar event:", error);
      // Don't throw error to prevent task creation from failing
      return null;
    }
  }

  getCalendarColorForPriority(priority) {
    const colorMap = {
      urgent: "11", // Red
      high: "6", // Orange
      medium: "5", // Yellow
      low: "10", // Green
    };
    return colorMap[priority?.toLowerCase()] || "1"; // Default blue
  }

  async updateGoogleCalendarEventForTask(task) {
    try {
      if (!task.assignedTo || !task.googleCalendarEventId) {
        return null;
      }

      // Get assignee's Google Calendar tokens
      const assigneeTokens = await this.getGoogleCalendarTokens(
        task.assignedTo
      );

      if (!assigneeTokens || !assigneeTokens.access_token) {
        return null;
      }

      // Import Google Calendar API
      const { google } = await import("googleapis");

      // Set up OAuth2 client
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      oauth2Client.setCredentials(assigneeTokens);

      const calendar = google.calendar({ version: "v3", auth: oauth2Client });

      // Update event object
      const eventStartTime = new Date(task.dueDate);
      const eventEndTime = new Date(eventStartTime.getTime() + 60 * 60 * 1000);

      const event = {
        summary: `Task: ${task.title}`,
        description: `${task.description || ""}\n\nTask ID: ${task._id
          }\nPriority: ${task.priority || "Normal"}\nStatus: ${task.status || "Pending"
          }`,
        start: {
          dateTime: eventStartTime.toISOString(),
          timeZone: "UTC",
        },
        end: {
          dateTime: eventEndTime.toISOString(),
          timeZone: "UTC",
        },
        colorId: this.getCalendarColorForPriority(task.priority),
      };

      const response = await calendar.events.update({
        calendarId: "primary",
        eventId: task.googleCalendarEventId,
        resource: event,
      });

      console.log("Google Calendar event updated:", response.data.id);
      return response.data;
    } catch (error) {
      console.error("Error updating Google Calendar event:", error);
      return null;
    }
  }

  async deleteGoogleCalendarEventForTask(task) {
    try {
      if (!task.assignedTo || !task.googleCalendarEventId) {
        return null;
      }

      // Get assignee's Google Calendar tokens
      const assigneeTokens = await this.getGoogleCalendarTokens(
        task.assignedTo
      );

      if (!assigneeTokens || !assigneeTokens.access_token) {
        return null;
      }

      // Import Google Calendar API
      const { google } = await import("googleapis");

      // Set up OAuth2 client
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      oauth2Client.setCredentials(assigneeTokens);

      const calendar = google.calendar({ version: "v3", auth: oauth2Client });

      await calendar.events.delete({
        calendarId: "primary",
        eventId: task.googleCalendarEventId,
      });

      console.log("Google Calendar event deleted:", task.googleCalendarEventId);
      return true;
    } catch (error) {
      console.error("Error deleting Google Calendar event:", error);
      return false;
    }
  }

  // Notification helper methods
  async createNotificationForTask(task, triggerEvent, targetUserId = null) {
    try {
      const { NotificationService } = await import('./services/notificationService.js');

      // Determine target user
      const userId = targetUserId || task.assignedTo || task.createdBy;
      if (!userId) return null;

      // Get task creator info for message context
      const creator = await User.findById(task.createdBy).select('firstName lastName');
      const creatorName = creator ? `${creator.firstName} ${creator.lastName}`.trim() : 'Someone';

      // Generate appropriate message based on trigger event
      let title, message, priority = NotificationPriority.NORMAL;
      const channels = [ChannelType.IN_APP];

      switch (triggerEvent) {
        case TriggerEvent.TASK_CREATED:
          title = 'New Task Assigned';
          message = `${creatorName} assigned you a new task: "${task.title}"`;
          if (task.priority === 'urgent' || task.priority === 'high') {
            priority = NotificationPriority.URGENT;
            channels.push(ChannelType.EMAIL);
          }
          break;

        case TriggerEvent.TASK_UPDATED:
          title = 'Task Updated';
          message = `Task "${task.title}" has been updated`;
          break;

        case TriggerEvent.TASK_COMPLETED:
          title = 'Task Completed';
          message = `Task "${task.title}" has been marked as completed`;
          break;

        case TriggerEvent.TASK_OVERDUE:
          title = 'Task Overdue';
          message = `Task "${task.title}" is now overdue`;
          priority = NotificationPriority.URGENT;
          channels.push(ChannelType.EMAIL);
          break;

        case TriggerEvent.TASK_DUE_TODAY:
          title = 'Task Due Today';
          message = `Task "${task.title}" is due today`;
          priority = NotificationPriority.URGENT;
          channels.push(ChannelType.EMAIL);
          break;

        case TriggerEvent.TASK_DUE_SOON:
          title = 'Task Due Soon';
          message = `Task "${task.title}" is due soon`;
          break;

        case TriggerEvent.TASK_REASSIGNED:
          title = 'Task Reassigned';
          message = `You have been assigned to task: "${task.title}"`;
          if (task.priority === 'urgent' || task.priority === 'high') {
            priority = NotificationPriority.URGENT;
            channels.push(ChannelType.EMAIL);
          }
          break;

        default:
          title = 'Task Notification';
          message = `Update on task: "${task.title}"`;
      }

      const notificationData = {
        user_id: userId,
        trigger_event: triggerEvent,
        related_entity: {
          entity_type: EntityType.TASK,
          entity_id: task._id
        },
        title,
        message,
        priority,
        channels,
        metadata: {
          task_id: task._id,
          task_title: task.title,
          task_priority: task.priority,
          task_status: task.status,
          task_due_date: task.dueDate,
          creator_id: task.createdBy,
          creator_name: creatorName
        }
      };

      const notification = await NotificationService.createNotification(notificationData);
      console.log('Notification created for task:', task.title, 'Event:', triggerEvent);
      return notification;

    } catch (error) {
      console.error('Error creating notification for task:', error);
      // Don't throw error to prevent task operations from failing
      return null;
    }
  }

  async createNotificationForUser(userId, triggerEvent, title, message, options = {}) {
    try {
      const { NotificationService } = await import('./services/notificationService.js');

      const {
        priority = NotificationPriority.NORMAL,
        channels = [ChannelType.IN_APP],
        relatedEntity = null,
        metadata = {},
        expiresAt = null
      } = options;

      const notificationData = {
        user_id: userId,
        trigger_event: triggerEvent,
        related_entity: relatedEntity || {
          entity_type: EntityType.TASK,
          entity_id: userId // Fallback to user ID
        },
        title,
        message,
        priority,
        channels,
        metadata,
        expires_at: expiresAt
      };

      const notification = await NotificationService.createNotification(notificationData);
      console.log('General notification created for user:', userId, 'Event:', triggerEvent);
      return notification;

    } catch (error) {
      console.error('Error creating general notification:', error);
      return null;
    }
  }

  async updateTask(id, taskData, userId) {
    console.log('🔄 [STORAGE UPDATE TASK] Step 1: Starting Task Update');
    console.log('📊 [STORAGE UPDATE TASK] Step 2: Update Parameters:', {
      taskId: id,
      userId,
      hasComments: !!taskData.comments,
      commentsCount: taskData.comments?.length,
      updateKeys: Object.keys(taskData)
    });

    try {
      console.log('🔍 [STORAGE UPDATE TASK] Step 3: Fetching Old Task...');
      const oldTask = await Task.findById(id);
      if (!oldTask) {
        console.log('❌ [STORAGE UPDATE TASK] Step 3: Task Not Found');
        throw new Error('Task not found');
      }
      console.log('✅ [STORAGE UPDATE TASK] Step 3: Old Task Retrieved');

      console.log('💾 [STORAGE UPDATE TASK] Step 4: Updating Task...');
      const task = await Task.findByIdAndUpdate(
        id,
        { $set: taskData },
        { new: true, strict: false, runValidators: false }
      );
      console.log('✅ [STORAGE UPDATE TASK] Step 4: Task Updated Successfully');

      if (userId && oldTask) {
        // Check if any meaningful changes were made (ignore updatedAt, __v, etc.)
        const oldObj = oldTask.toObject();

        // Track specific changes that have dedicated activity types
        const statusChanged = oldTask.status !== taskData.status && taskData.status;
        const priorityChanged = oldTask.priority !== taskData.priority && taskData.priority;
        const dueDateChanged = oldTask.dueDate?.getTime() !== taskData.dueDate?.getTime() && taskData.dueDate;

        // Check for other meaningful changes (excluding specific tracked fields)
        const hasOtherChanges = Object.keys(taskData).some(key => {
          // Ignore auto-update fields and specifically tracked fields
          if (['updatedAt', '__v', 'comments', 'status', 'priority', 'dueDate'].includes(key)) return false;

          // Compare values
          const oldValue = oldObj[key];
          const newValue = taskData[key];

          // Handle date comparison
          if (oldValue instanceof Date && newValue instanceof Date) {
            return oldValue.getTime() !== newValue.getTime();
          }

          // Handle object/array comparison
          if (typeof oldValue === 'object' && typeof newValue === 'object') {
            return JSON.stringify(oldValue) !== JSON.stringify(newValue);
          }

          return oldValue !== newValue;
        });

        // Only track generic TASK_UPDATED if there are OTHER changes (not status/priority/dueDate)
        if (hasOtherChanges) {
          await this.trackActivity({
            activityType: ActivityHelper.ACTIVITY_TYPES.TASK_UPDATED,
            userId: userId,
            organizationId: task.organization,
            relatedId: task._id,
            relatedType: "task",
            data: {
              taskTitle: task.title,
              changes: ActivityHelper.createComparisonData(
                oldTask.toObject(),
                taskData,
                ["title", "description", "assignedTo", "collaborators"]
              ),
            },
          });
        }

        // Track specific changes ONLY if they actually changed
        if (statusChanged) {
          await this.trackActivity({
            activityType: ActivityHelper.ACTIVITY_TYPES.TASK_STATUS_CHANGED,
            userId: userId,
            organizationId: task.organization,
            relatedId: task._id,
            relatedType: "task",
            data: {
              taskTitle: task.title,
              oldValue: oldTask.status,
              newValue: taskData.status,
            },
          });

          // Track completion specifically
          if (taskData.status === "DONE") {
            await this.trackActivity({
              activityType: ActivityHelper.ACTIVITY_TYPES.TASK_COMPLETED,
              userId: userId,
              organizationId: task.organization,
              relatedId: task._id,
              relatedType: "task",
              data: {
                taskTitle: task.title,
              },
            });
          }
        }

        if (priorityChanged) {
          await this.trackActivity({
            activityType: ActivityHelper.ACTIVITY_TYPES.TASK_PRIORITY_CHANGED,
            userId: userId,
            organizationId: task.organization,
            relatedId: task._id,
            relatedType: "task",
            data: {
              taskTitle: task.title,
              oldValue: oldTask.priority,
              newValue: taskData.priority,
            },
          });
        }

        if (dueDateChanged) {
          await this.trackActivity({
            activityType: ActivityHelper.ACTIVITY_TYPES.TASK_DUE_DATE_CHANGED,
            userId: userId,
            organizationId: task.organization,
            relatedId: task._id,
            relatedType: "task",
            data: {
              taskTitle: task.title,
              oldValue: oldTask.dueDate,
              newValue: taskData.dueDate,
            },
          });
        }

        // Create notifications for significant changes
        // Only notify if assignedTo actually changed (check if it exists in taskData updates)
        const assigneeChanged = taskData.assignedTo !== undefined &&
          oldTask.assignedTo?.toString() !== taskData.assignedTo?.toString();

        console.log('DEBUG - storage.updateTask notification check:', {
          hasAssignedToInUpdate: taskData.assignedTo !== undefined,
          oldAssignee: oldTask.assignedTo?.toString(),
          newAssignee: taskData.assignedTo?.toString(),
          assigneeChanged,
          updateKeys: Object.keys(taskData)
        });

        if (assigneeChanged && task.assignedTo) {
          console.log('DEBUG - Creating TASK_REASSIGNED notification');
          // Task reassigned
          await this.createNotificationForTask(task, TriggerEvent.TASK_REASSIGNED, task.assignedTo);
        }

        if (oldTask.status !== task.status && task.status === 'completed') {
          // Task completed - notify creator if different from completer
          if (task.createdBy && task.createdBy !== userId) {
            await this.createNotificationForTask(task, TriggerEvent.TASK_COMPLETED, task.createdBy);
          }
        } else if (oldTask.status !== task.status || oldTask.priority !== task.priority) {
          // Task updated - notify assigned user if different from updater
          if (task.assignedTo && task.assignedTo !== userId) {
            await this.createNotificationForTask(task, TriggerEvent.TASK_UPDATED, task.assignedTo);
          }
        }

        // Update Google Calendar event if task details changed
        if (
          task.assignedTo &&
          task.dueDate &&
          (oldTask.title !== task.title ||
            oldTask.description !== task.description ||
            oldTask.priority !== task.priority ||
            oldTask.dueDate !== task.dueDate ||
            oldTask.status !== task.status)
        ) {
          await this.updateGoogleCalendarEventForTask(task);
        }
      }

      console.log('✅ [STORAGE UPDATE TASK] Step 5: Task Update Complete');
      return task;
    } catch (error) {
      console.error('💥 [STORAGE UPDATE TASK] FATAL ERROR:', {
        message: error.message,
        stack: error.stack,
        taskId: id
      });
      throw error;
    }
  }

  async deleteTask(id, userId) {
    const task = await Task.findById(id);
    if (task) {
      await this.trackActivity({
        activityType: ActivityHelper.ACTIVITY_TYPES.TASK_DELETED,
        userId: userId,
        organizationId: task.organization,
        relatedId: id,
        relatedType: "task",
        data: {
          taskTitle: task.title,
        },
      });

      // Delete Google Calendar event if it exists
      if (task.googleCalendarEventId) {
        await this.deleteGoogleCalendarEventForTask(task);
      }
    }
    return await Task.findByIdAndDelete(id);
  }

  // Task Status operations
  async createTaskStatus(statusData) {
    const status = new TaskStatus(statusData);
    return await status.save();
  }

  async getTaskStatuses(organizationId) {
    return await TaskStatus.find({ organizationId }).sort({ order: 1 });
  }

  // Activity operations
  async createActivity(activityData) {
    try {
      console.log('💾 [CREATE ACTIVITY] Saving to database:', JSON.stringify(activityData, null, 2));

      const Activity = mongoose.model("Activity");
      const activity = new Activity(activityData);
      const savedActivity = await activity.save();

      console.log('✅ [CREATE ACTIVITY] Saved successfully with ID:', savedActivity._id);

      return savedActivity;
    } catch (error) {
      console.error('❌ [CREATE ACTIVITY] Database save error:', error);
      console.error('Stack:', error.stack);
      throw error;
    }
  }

  /**
   * Enhanced activity tracking method
   */
  async trackActivity({
    activityType,
    userId,
    organizationId,
    relatedId,
    relatedType,
    data = {},
  }) {
    try {
      console.log('🎯 [TRACK ACTIVITY] Input params:', {
        activityType,
        userId,
        organizationId,
        relatedId,
        relatedType,
        data
      });

      const activityData = ActivityHelper.createActivityData({
        activityType,
        userId,
        organizationId,
        relatedId,
        relatedType,
        data,
      });

      console.log('📋 [TRACK ACTIVITY] Created activity data:', JSON.stringify(activityData, null, 2));

      const result = await this.createActivity(activityData);

      console.log('✅ [TRACK ACTIVITY] Activity saved with ID:', result?._id);

      return result;
    } catch (error) {
      console.error("❌ [TRACK ACTIVITY] Error tracking activity:", error);
      console.error("Stack:", error.stack);
      // Don't throw error to prevent breaking main operations
      return null;
    }
  }

  async getRecentActivities(limit = 10) {
    const Activity = mongoose.model("Activity");
    return await Activity.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("user", "name email avatar")
      .lean();
  }

  async getActivitiesForTask(taskId, limit = 20) {
    const Activity = mongoose.model("Activity");
    const Task = mongoose.model("Task");

    // Get all subtasks of this parent task
    const subtasks = await Task.find({
      parentTaskId: taskId,
      isDeleted: false
    }).select('_id').lean();

    const subtaskIds = subtasks.map(st => st._id);

    // Get activities for main task AND all its subtasks
    return await Activity.find({
      $or: [
        { relatedId: taskId, relatedType: "task" },
        { relatedId: { $in: subtaskIds }, relatedType: "task" }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("user", "firstName lastName email avatar")
      .lean();
  }

  async getActivitiesForOrganization(organizationId, limit = 50) {
    const Activity = mongoose.model("Activity");
    return await Activity.find({
      organization: organizationId,
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("user", "name email avatar")
      .lean();
  }

  // Dashboard stats
  async getDashboardStats() {
    const [totalTasks, completedTasks, totalUsers, totalProjects] =
      await Promise.all([
        Task.countDocuments(),
        Task.countDocuments({ status: "DONE" }),
        User.countDocuments(),
        Project.countDocuments(),
      ]);

    const pendingTasks = totalTasks - completedTasks;

    return {
      totalTasks,
      completedTasks,
      pendingTasks,
      totalUsers,
      totalProjects,
    };
  }

  // Form operations
  async getForms(organizationId) {
    return await Form.find({ organization: organizationId })
      .populate("createdBy", "firstName lastName email")
      .sort({ createdAt: -1 });
  }

  async getForm(id) {
    return await Form.findById(id)
      .populate("createdBy", "firstName lastName email")
      .populate("organization", "name slug");
  }

  async getFormByAccessLink(accessLink) {
    return await Form.findOne({ accessLink, isPublished: true }).populate(
      "organization",
      "name slug"
    );
  }

  async createForm(formData) {
    // Generate unique access link
    const accessLink = `form-${crypto.randomBytes(8).toString("hex")}`;

    const form = new Form({
      ...formData,
      accessLink,
    });
    return await form.save();
  }

  async updateForm(id, formData) {
    return await Form.findByIdAndUpdate(id, formData, { new: true });
  }

  async deleteForm(id) {
    return await Form.findByIdAndDelete(id);
  }

  async publishForm(id) {
    return await Form.findByIdAndUpdate(
      id,
      { isPublished: true },
      { new: true }
    );
  }

  async unpublishForm(id) {
    return await Form.findByIdAndUpdate(
      id,
      { isPublished: false },
      { new: true }
    );
  }

  // Process Flow operations
  async getProcessFlows(organizationId) {
    return await ProcessFlow.find({ organization: organizationId })
      .populate("createdBy", "firstName lastName email")
      .populate("form", "title")
      .sort({ createdAt: -1 });
  }

  async getProcessFlow(id) {
    return await ProcessFlow.findById(id)
      .populate("createdBy", "firstName lastName email")
      .populate("form", "title fields")
      .populate("steps.assignedTo", "firstName lastName email");
  }

  async createProcessFlow(flowData) {
    const processFlow = new ProcessFlow(flowData);
    return await processFlow.save();
  }

  async updateProcessFlow(id, flowData) {
    return await ProcessFlow.findByIdAndUpdate(id, flowData, { new: true });
  }

  async deleteProcessFlow(id) {
    return await ProcessFlow.findByIdAndDelete(id);
  }

  // Form Response operations
  async getFormResponses(filters = {}) {
    let query = {};

    if (filters.formId) {
      query.form = filters.formId;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.organizationId) {
      const forms = await Form.find({
        organization: filters.organizationId,
      }).select("_id");
      const formIds = forms.map((f) => f._id);
      query.form = { $in: formIds };
    }

    return await FormResponse.find(query)
      .populate("form", "title")
      .populate("submittedBy", "firstName lastName email")
      .populate("processFlow", "title")
      .sort({ createdAt: -1 });
  }

  async getFormResponse(id) {
    return await FormResponse.findById(id)
      .populate("form", "title fields")
      .populate("submittedBy", "firstName lastName email")
      .populate("processFlow", "title steps")
      .populate("stepHistory.assignedTo", "firstName lastName email")
      .populate("stepHistory.completedBy", "firstName lastName email");
  }

  async createFormResponse(responseData) {
    const response = new FormResponse(responseData);
    const savedResponse = await response.save();

    // If there's a process flow, create process instance
    if (responseData.processFlow) {
      await this.createProcessInstance({
        processFlow: responseData.processFlow,
        formResponse: savedResponse._id,
        currentSteps: ["start"],
      });
    }

    return savedResponse;
  }

  async updateFormResponse(id, responseData) {
    return await FormResponse.findByIdAndUpdate(id, responseData, {
      new: true,
    });
  }

  async updateResponseStep(responseId, stepData) {
    const response = await FormResponse.findById(responseId);
    if (!response) return null;

    response.stepHistory.push({
      stepId: stepData.stepId,
      stepTitle: stepData.stepTitle,
      status: stepData.status,
      assignedTo: stepData.assignedTo,
      completedBy: stepData.completedBy,
      comments: stepData.comments,
      completedAt: stepData.status === "completed" ? new Date() : undefined,
    });

    response.currentStep = stepData.nextStep || null;

    if (stepData.status === "completed" && !stepData.nextStep) {
      response.status = "completed";
    } else if (stepData.status === "rejected") {
      response.status = "rejected";
    } else {
      response.status = "in_progress";
    }

    return await response.save();
  }

  // Process Instance operations
  async getProcessInstance(responseId) {
    return await ProcessInstance.findOne({ formResponse: responseId })
      .populate("processFlow")
      .populate("formResponse");
  }

  async createProcessInstance(instanceData) {
    const instance = new ProcessInstance(instanceData);
    return await instance.save();
  }

  async updateProcessInstance(id, instanceData) {
    return await ProcessInstance.findByIdAndUpdate(id, instanceData, {
      new: true,
    });
  }

  // Analytics for forms and processes
  async getFormAnalytics(formId, organizationId) {
    const matchStage = formId
      ? { form: formId }
      : { form: { $in: await this.getFormIdsByOrganization(organizationId) } };

    const analytics = await FormResponse.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalSubmissions: { $sum: 1 },
          completedSubmissions: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          inProgressSubmissions: {
            $sum: { $cond: [{ $eq: ["$status", "in_progress"] }, 1, 0] },
          },
          rejectedSubmissions: {
            $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] },
          },
        },
      },
    ]);

    return (
      analytics[0] || {
        totalSubmissions: 0,
        completedSubmissions: 0,
        inProgressSubmissions: 0,
        rejectedSubmissions: 0,
      }
    );
  }

  async getFormIdsByOrganization(organizationId) {
    const forms = await Form.find({ organization: organizationId }).select(
      "_id"
    );
    return forms.map((f) => f._id);
  }

  // Role Management Operations
  async getRoles(organizationId) {
    try {
      // Return predefined roles with metadata
      const predefinedRoles = [
        {
          _id: "admin",
          name: "Administrator",
          description: "Full system access with all permissions",
          permissions: [
            "users.view",
            "users.create",
            "users.edit",
            "users.delete",
            "tasks.view",
            "tasks.create",
            "tasks.edit",
            "tasks.delete",
            "projects.view",
            "projects.create",
            "projects.edit",
            "projects.delete",
            "roles.view",
            "roles.create",
            "roles.edit",
            "roles.delete",
            "organizations.view",
            "organizations.edit",
            "reports.view",
            "reports.create",
          ],
          organizationId,
          isSystem: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: "member",
          name: "Member",
          description: "Standard user with basic permissions",
          permissions: [
            "tasks.view",
            "tasks.create",
            "tasks.edit",
            "projects.view",
            "users.view",
          ],
          organizationId,
          isSystem: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: "viewer",
          name: "Viewer",
          description: "Read-only access to tasks and projects",
          permissions: ["tasks.view", "projects.view", "users.view"],
          organizationId,
          isSystem: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      return predefinedRoles;
    } catch (error) {
      console.error("Get roles error:", error);
      throw error;
    }
  }

  async getRole(roleId) {
    try {
      // Handle predefined system roles
      const predefinedRoles = {
        admin: {
          _id: "admin",
          name: "Administrator",
          description: "Full system access with all permissions",
          permissions: [
            "users.view",
            "users.create",
            "users.edit",
            "users.delete",
            "tasks.view",
            "tasks.create",
            "tasks.edit",
            "tasks.delete",
            "projects.view",
            "projects.create",
            "projects.edit",
            "projects.delete",
            "roles.view",
            "roles.create",
            "roles.edit",
            "roles.delete",
            "organizations.view",
            "organizations.edit",
            "reports.view",
            "reports.create",
          ],
          isSystem: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        member: {
          _id: "member",
          name: "Member",
          description: "Standard user with basic permissions",
          permissions: [
            "tasks.view",
            "tasks.create",
            "tasks.edit",
            "projects.view",
            "users.view",
          ],
          isSystem: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        viewer: {
          _id: "viewer",
          name: "Viewer",
          description: "Read-only access to tasks and projects",
          permissions: ["tasks.view", "projects.view", "users.view"],
          isSystem: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      return predefinedRoles[roleId] || null;
    } catch (error) {
      console.error("Get role error:", error);
      throw error;
    }
  }

  async getRoleByName(name, organizationId) {
    try {
      // Check predefined roles
      const predefinedRoles = ["admin", "member", "viewer"];
      if (predefinedRoles.includes(name.toLowerCase())) {
        return await this.getRole(name.toLowerCase());
      }
      return null;
    } catch (error) {
      console.error("Get role by name error:", error);
      throw error;
    }
  }

  async createRole(roleData) {
    try {
      // For now, return a success response since we're using predefined roles
      // In a full implementation, this would create custom roles in the database
      throw new Error(
        "Creating custom roles is not yet implemented. Please use predefined roles: admin, member, viewer"
      );
    } catch (error) {
      console.error("Create role error:", error);
      throw error;
    }
  }

  async updateRole(roleId, updateData) {
    try {
      // For now, return a success response since we're using predefined roles
      // In a full implementation, this would update custom roles in the database
      throw new Error(
        "Updating system roles is not allowed. Only custom roles can be modified."
      );
    } catch (error) {
      console.error("Update role error:", error);
      throw error;
    }
  }

  async deleteRole(roleId) {
    try {
      // For now, return a success response since we're using predefined roles
      // In a full implementation, this would delete custom roles from the database
      throw new Error(
        "Deleting system roles is not allowed. Only custom roles can be deleted."
      );
    } catch (error) {
      console.error("Delete role error:", error);
      throw error;
    }
  }

  async getUsersByRole(roleId) {
    try {
      const users = await User.find({
        role: roleId,
      }).select("_id firstName lastName email role createdAt");

      return users;
    } catch (error) {
      console.error("Get users by role error:", error);
      throw error;
    }
  }

  // Report Generation Operations
  async generateReportData(filters) {
    try {
      const {
        organizationId,
        dateRange,
        userId,
        projectId,
        status,
        department,
      } = filters;

      // Build task query
      let taskQuery = { organization: organizationId };

      if (dateRange.startDate && dateRange.endDate) {
        taskQuery.createdAt = {
          $gte: dateRange.startDate,
          $lte: dateRange.endDate,
        };
      }

      if (userId) taskQuery.assignedTo = userId;
      if (projectId) taskQuery.project = projectId;
      if (status) taskQuery.status = status;

      // Get tasks with populated data
      const tasks = await Task.find(taskQuery)
        .populate("assignedTo", "firstName lastName email department")
        .populate("project", "name")
        .populate("createdBy", "firstName lastName")
        .sort({ createdAt: -1 });

      // Filter by department if specified
      const filteredTasks = department
        ? tasks.filter((task) => task.assignedTo?.department === department)
        : tasks;

      // Generate summary statistics
      const summary = {
        totalUsers: await User.countDocuments({ organization: organizationId }),
        totalTasks: filteredTasks.length,
        avgCompletion: this.calculateAverageCompletion(filteredTasks),
        overdueTasks: filteredTasks.filter(
          (task) =>
            task.dueDate &&
            new Date(task.dueDate) < new Date() &&
            task.status !== "DONE"
        ).length,
      };

      // Generate user performance data
      const userPerformance = await this.generateUserPerformanceData(
        filteredTasks,
        organizationId
      );

      // Generate user task data for charts
      const userTaskData = await this.generateUserTaskChartData(filteredTasks);

      // Generate status distribution data
      const statusDistribution = this.generateStatusDistribution(filteredTasks);

      // Generate trend data
      const trendData = await this.generateTrendData(organizationId, dateRange);

      // Format task details
      const taskDetails = filteredTasks.map((task) => ({
        _id: task._id,
        title: task.title,
        assignedTo: task.assignedTo,
        project: task.project,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        progress: task.progress || 0,
        createdAt: task.createdAt,
      }));

      return {
        summary,
        userPerformance,
        userTaskData,
        statusDistribution,
        trendData,
        taskDetails,
      };
    } catch (error) {
      console.error("Generate report data error:", error);
      throw error;
    }
  }

  calculateAverageCompletion(tasks) {
    if (tasks.length === 0) return 0;

    const totalProgress = tasks.reduce((sum, task) => {
      if (task.status === "DONE") return sum + 100;
      return sum + (task.progress || 0);
    }, 0);

    return Math.round(totalProgress / tasks.length);
  }

  async generateUserPerformanceData(tasks, organizationId) {
    try {
      // Get all users in the organization
      const users = await User.find({ organization: organizationId }).select(
        "_id firstName lastName email department"
      );

      const userStats = users.map((user) => {
        const userTasks = tasks.filter(
          (task) =>
            task.assignedTo &&
            task.assignedTo._id.toString() === user._id.toString()
        );

        const completedTasks = userTasks.filter(
          (task) => task.status === "DONE"
        ).length;
        const inProgressTasks = userTasks.filter(
          (task) => task.status === "INPROGRESS"
        ).length;
        const overdueTasks = userTasks.filter(
          (task) =>
            task.dueDate &&
            new Date(task.dueDate) < new Date() &&
            task.status !== "DONE"
        ).length;

        const progressPercentage =
          userTasks.length > 0
            ? Math.round((completedTasks / userTasks.length) * 100)
            : 0;

        return {
          userId: user._id,
          userName: `${user.firstName} ${user.lastName}`,
          userEmail: user.email,
          department: user.department,
          totalTasks: userTasks.length,
          completedTasks,
          inProgressTasks,
          overdueTasks,
          progressPercentage,
          hoursLogged: 0, // Placeholder for time tracking feature
        };
      });

      return userStats.sort((a, b) => b.totalTasks - a.totalTasks);
    } catch (error) {
      console.error("Generate user performance data error:", error);
      throw error;
    }
  }

  async generateUserTaskChartData(tasks) {
    try {
      const userTaskMap = new Map();

      tasks.forEach((task) => {
        if (task.assignedTo) {
          const userId = task.assignedTo._id.toString();
          const userName = `${task.assignedTo.firstName} ${task.assignedTo.lastName}`;

          if (!userTaskMap.has(userId)) {
            userTaskMap.set(userId, {
              userName,
              totalTasks: 0,
              completedTasks: 0,
            });
          }

          const userData = userTaskMap.get(userId);
          userData.totalTasks++;

          if (task.status === "DONE") {
            userData.completedTasks++;
          }
        }
      });

      return Array.from(userTaskMap.values())
        .sort((a, b) => b.totalTasks - a.totalTasks)
        .slice(0, 10); // Top 10 users
    } catch (error) {
      console.error("Generate user task chart data error:", error);
      throw error;
    }
  }

  generateStatusDistribution(tasks) {
    const statusMap = new Map();

    tasks.forEach((task) => {
      const status = task.status || "unknown";
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    });

    return Array.from(statusMap.entries()).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1).replace("-", " "),
      value,
    }));
  }

  async generateTrendData(organizationId, dateRange) {
    try {
      // Dummy data removed. Real trend data implementation should query individual models
      return [];
    } catch (error) {
      console.error("Generate trend data error:", error);
      return [];
    }
  }

  async generateCSVReport(reportData) {
    try {
      const headers = [
        "User Name",
        "Email",
        "Department",
        "Total Tasks",
        "Completed Tasks",
        "In Progress Tasks",
        "Overdue Tasks",
        "Progress Percentage",
        "Hours Logged",
      ];

      const rows = reportData.userPerformance.map((user) => [
        user.userName,
        user.userEmail,
        user.department || "N/A",
        user.totalTasks,
        user.completedTasks,
        user.inProgressTasks,
        user.overdueTasks,
        user.progressPercentage + "%",
        user.hoursLogged + "h",
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

      return csvContent;
    } catch (error) {
      console.error("Generate CSV report error:", error);
      throw error;
    }
  }

  // Super Admin Methods
  async getAllCompanies() {
    console.log("Fetching all companies from database...");
    const companies = await Organization.find({}).sort({ createdAt: -1 });

    console.log("Raw companies found:", companies.length);

    // Get stats for each company
    const companiesWithStats = await Promise.all(
      companies.map(async (company) => {
        const userCount = await User.countDocuments({
          $or: [{ organizationId: company._id }, { organization: company._id }],
        });
        const projectCount = await Project.countDocuments({
          $or: [{ organizationId: company._id }, { organization: company._id }],
        });
        const taskCount = await Task.countDocuments({
          $or: [{ organizationId: company._id }, { organization: company._id }],
        });
        const formCount = await Form.countDocuments({
          $or: [{ organizationId: company._id }, { organization: company._id }],
        });

        const companyData = {
          ...company.toObject(),
          userCount,
          projectCount,
          taskCount,
          formCount,
          stats: {
            users: userCount,
            projects: projectCount,
            tasks: taskCount,
            forms: formCount,
          },
        };

        console.log(
          `Company ${company.name}: ${userCount} users, ${projectCount} projects`
        );
        return companyData;
      })
    );

    console.log("Companies with stats prepared:", companiesWithStats.length);
    return companiesWithStats;
  }

  async getCompanyDetails(companyId) {
    const company = await Organization.findById(companyId);

    if (!company) return null;

    // Get company statistics
    const userCount = await User.countDocuments({ organizationId: companyId });
    const projectCount = await Project.countDocuments({
      organizationId: companyId,
    });
    const taskCount = await Task.countDocuments({ organizationId: companyId });
    const formCount = await Form.countDocuments({ organization: companyId });

    return {
      ...company.toObject(),
      stats: {
        users: userCount,
        projects: projectCount,
        tasks: taskCount,
        forms: formCount,
      },
    };
  }

  async getAllUsersAcrossCompanies() {
    console.log("Fetching all users across companies...");

    // Get all users with organization info
    const users = await User.find({})
      .populate("organizationId", "name slug")
      .populate("organization", "name slug")
      .sort({ createdAt: -1 });

    console.log("Raw users found:", users.length);

    // Transform users to include organization name consistently
    const transformedUsers = users.map((user) => {
      const userObj = user.toObject();

      // Get organization name from either field
      let organizationName = "Individual User";
      if (userObj.organizationId?.name) {
        organizationName = userObj.organizationId.name;
      } else if (userObj.organization?.name) {
        organizationName = userObj.organization.name;
      }

      return {
        ...userObj,
        organizationName,
        // Ensure consistent status field
        status: userObj.status || (userObj.isActive ? "active" : "inactive"),
      };
    });

    console.log("Transformed users prepared:", transformedUsers.length);
    return transformedUsers;
  }

  async getPlatformAnalytics() {
    const totalCompanies = await Organization.countDocuments({});
    const totalUsers = await User.countDocuments({});
    const totalProjects = await Project.countDocuments({});
    const totalTasks = await Task.countDocuments({});
    const totalForms = await Form.countDocuments({});

    // Get recent activity across all companies
    const recentUsers = await User.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("organizationId", "name");

    const recentTasks = await Task.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("organizationId", "name")
      .populate("assignedTo", "firstName lastName");

    // Company growth over time
    const companyGrowth = await Organization.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    return {
      overview: {
        totalCompanies,
        totalUsers,
        totalProjects,
        totalTasks,
        totalForms,
      },
      recentActivity: {
        users: recentUsers,
        tasks: recentTasks,
      },
      growth: companyGrowth,
    };
  }

  async updateCompanyStatus(companyId, status) {
    return await Organization.findByIdAndUpdate(
      companyId,
      { isActive: status },
      { new: true }
    );
  }

  async assignCompanyAdmin(companyId, userId) {
    return await User.findByIdAndUpdate(
      userId,
      {
        role: "admin",
        organizationId: companyId,
      },
      { new: true }
    );
  }

  async getSystemLogs(limit = 100) {
    return await TaskAuditLog.find({})
      .populate("userId", "firstName lastName email")
      .populate("taskId", "title")
      .populate("organizationId", "name")
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  async createSuperAdmin(userData) {
    const superAdminData = {
      ...userData,
      role: ["super_admin"], // Role must be an array
      status: "inactive", // Initially inactive until email is verified
      isActive: false,
      emailVerified: false,
    };

    if (userData.password) {
      superAdminData.passwordHash = await this.hashPassword(userData.password);
      delete superAdminData.password; // Remove plain password
    }

    // Keep verification token and expiry if provided
    if (userData.emailVerificationToken) {
      superAdminData.emailVerificationToken = userData.emailVerificationToken;
    }
    if (userData.emailVerificationExpires) {
      superAdminData.emailVerificationExpires = userData.emailVerificationExpires;
    }

    const superAdmin = new User(superAdminData);
    return await superAdmin.save();
  }

  // Authentication Methods for User Management Module

  // Pending User Operations
  async createPendingUser(userData) {
    const pendingUser = new PendingUser(userData);
    return await pendingUser.save();
  }

  async getPendingUserByEmail(email) {
    return await PendingUser.findOne({ email });
  }

  async updatePendingUser(id, updateData) {
    return await PendingUser.findByIdAndUpdate(id, updateData, { new: true });
  }

  async deletePendingUser(id) {
    return await PendingUser.findByIdAndDelete(id);
  }

  // User Authentication Methods
  async getUserByResetToken(token) {
    return await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    });
  }

  async getOrganizationBySlug(slug) {
    return await Organization.findOne({ slug });
  }

  // User Invitation and Management Methods
  async inviteUserToOrganization(inviteData) {
    try {
      console.log("📧 Starting inviteUserToOrganization with data:", {
        email: inviteData.email,
        organizationId: inviteData.organizationId,
        roles: inviteData.roles,
        license_type: inviteData.license_type, // 🆕 NEW
      });

      const {
        email,
        organizationId,
        roles,
        invitedBy,
        invitedByName,
        organizationName,
        name,
        licenseId,
        license_type, // 🆕 NEW: Optional license type to assign during invite
        department,
        designation,
        location,
        phone,
        sendEmail = true,
        accountType = 'company', // Default to company for organization invites
      } = inviteData;

      // ✅ Correct field for organization check
      const existingUser = await User.findOne({
        email: email.toLowerCase(),
        organization_id: organizationId,
      });

      if (existingUser) {
        console.error(`❌ User already exists: ${email}`);
        throw new Error(`${email} is already invited to your organization.`);
      }

      console.log("✅ No existing user found, proceeding with invitation");

      // ✅ Generate token
      const inviteToken = crypto.randomBytes(32).toString("hex");
      const inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // ✅ Split name into firstName & lastName
      const [firstName = "", ...lastParts] = (name || "").trim().split(" ");
      const lastName = lastParts.join(" ");

      console.log("📝 Creating user with:", {
        email,
        firstName,
        lastName,
        role: roles,
        organization_id: organizationId,
        license_type, // 🆕 NEW
      });

      // 🆕 NEW: Handle license assignment during invite
      let assignedLicenseId = null;
      const licenseType = licenseId || license_type; // Support both licenseId and license_type

      if (licenseType) {
        // Try to assign license from pool
        const { CompanyLicense } = await import('./modals/companyLicenseModal.js');
        const availableLicenses = await CompanyLicense.getAvailableLicenses(
          organizationId,
          licenseType.toUpperCase()
        );

        if (availableLicenses.length > 0) {
          const license = availableLicenses[0];
          assignedLicenseId = license._id;
          console.log(`✅ Reserved ${licenseType.toUpperCase()} license: ${license.license_id} for ${email}`);
        } else {
          console.warn(`⚠️ No ${licenseType.toUpperCase()} licenses available, user will be created without license`);
        }
      }

      // ✅ Create invited user
      const invitedUser = new User({
        email,
        role: roles,
        roles: [],
        organization_id: organizationId,
        status: "invited",
        isActive: false,
        emailVerified: false,
        inviteToken,
        inviteTokenExpiry,
        invitedBy,
        invitedAt: new Date(),
        license_id: null, // 🆕 NEW: No license assigned yet (will be assigned on acceptance)
        department: department || null,
        designation: designation || null,
        location: location || null,
        phone: phone || null,
        firstName,
        lastName,
        account_type: accountType,
      });

      console.log("💾 Attempting to save user...");
      const savedUser = await invitedUser.save();
      console.log("✅ User saved successfully:", savedUser._id);

      // 🆕 NEW: If license was reserved, assign it now
      if (assignedLicenseId) {
        const { CompanyLicense } = await import('./modals/companyLicenseModal.js');
        const license = await CompanyLicense.findById(assignedLicenseId);
        if (license) {
          await license.assignToUser(savedUser._id, invitedBy);
          savedUser.license_id = assignedLicenseId;
          await savedUser.save();
          console.log(`✅ License ${license.license_type} (ID: ${license.license_id}) assigned to user ${email}`);
        }
      } else {
        console.log(`ℹ️ User ${email} created without license assignment`);
      }

      // ✅ Send email if allowed (but don't fail if email service is not configured)
      if (sendEmail) {
        try {
          await this.sendInvitationEmail(
            email,
            inviteToken,
            organizationName,
            roles,
            invitedByName,
            name
          );
          console.log(`✅ Invitation email sent to ${email}`);
        } catch (emailError) {
          console.warn(`⚠️ Failed to send invitation email to ${email}:`, emailError.message);
          // Don't throw error - user is still created, just email failed
        }
      }

      return savedUser;
    } catch (error) {
      console.error("❌ Error in inviteUserToOrganization:", error);
      throw error;
    }
  }

  // async inviteUserToOrganization(inviteData) {
  //   const { email, organizationId, roles, invitedBy, invitedByName, organizationName } = inviteData;

  //   // Check if user already exists in this organization (active or invited)
  //   const existingUser = await User.findOne({
  //     email: email.toLowerCase(),
  //     organization: organizationId
  //   });

  //   if (existingUser) {
  //     // Return error for duplicate validation
  //     throw new Error(`${email} is already invited to your organization.`);
  //   }

  //   // Generate invitation token (48 hours expiry as requested)
  //   const inviteToken = crypto.randomBytes(32).toString('hex');
  //   const inviteTokenExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

  //   // Create invited user record with proper status
  //   const invitedUser = new User({
  //     email,
  //     role: roles.includes('admin') || roles.includes('org_admin') ? 'admin' : 'member',
  //     roles: roles, // Store full roles array
  //     organization: organizationId, // Use 'organization' field from schema
  //     status: 'invited', // Use 'invited' status to avoid validation requirements
  //     isActive: false,
  //     emailVerified: false,
  //     inviteToken,
  //     inviteTokenExpiry,
  //     invitedBy,
  //     invitedAt: new Date()
  //     // firstName, lastName, and passwordHash not required for invited status
  //   });

  //   const savedUser = await invitedUser.save();

  //   // Send invitation email
  //   await this.sendInvitationEmail(email, inviteToken, organizationName, roles, invitedByName);

  //   return savedUser;
  // }

  async getInvitedUser(token) {
    return await User.findOne({
      inviteToken: token,
      inviteTokenExpiry: { $gt: new Date() },
      status: "invited",
    });
  }

  async completeUserInvitation(token, userData) {
    try {
      const { firstName, lastName = "", password } = userData;

      const user = await this.getUserByInviteToken(token);
      if (!user) {
        return {
          success: false,
          message: "Invalid or expired invitation token",
        };
      }

      // Hash password
      const passwordHash = await this.hashPassword(password);

      // Update user to active status and invalidate token
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        {
          firstName,
          lastName,
          passwordHash,
          status: "active",
          isActive: true,
          emailVerified: true,
          inviteToken: null,
          inviteTokenExpiry: null,
          completedAt: new Date(),
        },
        { new: true }
      );

      if (!updatedUser) {
        return {
          success: false,
          message: "Failed to complete user registration",
        };
      }

      return {
        success: true,
        user: updatedUser,
        message: "Account created successfully",
      };
    } catch (error) {
      console.error("Complete user invitation error:", error);
      return {
        success: false,
        message: error.message || "Failed to complete invitation",
      };
    }
  }

  // Organization License Management
  async getOrganizationLicenseInfo(organizationId) {
    try {
      console.log('🔍 Getting organization license info for:', organizationId);

      const organization = await Organization.findById(organizationId);
      if (!organization) {
        throw new Error("Organization not found");
      }

      // Get subscription data from our seat management system
      const subscription = await OrganizationSubscription.findOne({
        organization_id: new mongoose.Types.ObjectId(organizationId),
        status: 'ACTIVE'
      });

      if (!subscription) {
        console.log('⚠️ No active subscription found, using default values');
        // Fallback to old method if no subscription exists
        const activeUsers = await User.countDocuments({
          organization: organizationId,
          isActive: true,
        });

        const totalLicenses = organization.maxUsers || 10;
        const usedLicenses = activeUsers;
        const availableSlots = Math.max(0, totalLicenses - usedLicenses);

        return {
          totalLicenses,
          licenseType: organization.subscriptionType || "Monthly",
          usedLicenses,
          availableSlots,
        };
      }

      // Use subscription data for accurate seat information
      const totalLicenses = subscription.seats_purchased || 10;
      const usedLicenses = subscription.seats_used || 0;
      const availableSlots = Math.max(0, totalLicenses - usedLicenses);
      const licenseType = subscription.license_code || 'EXPLORE';

      console.log('✅ License info from subscription:', {
        totalLicenses,
        usedLicenses,
        availableSlots,
        licenseType
      });

      return {
        totalLicenses,
        licenseType,
        usedLicenses,
        availableSlots,
        subscriptionStatus: subscription.status,
        subscriptionStartDate: subscription.subscription_start_date,
        subscriptionEndDate: subscription.subscription_end_date,
        trialStartDate: subscription.trial_start_date,
        trialEndDate: subscription.trial_end_date,
        billingCycle: subscription.billing_cycle,
        autoRenew: subscription.auto_renew,
      };
    } catch (error) {
      console.error('❌ Error getting organization license info:', error);
      throw error;
    }
  }

  // Send user invitation email
  async sendInvitationEmail(
    email,
    inviteToken,
    organizationName,
    roles,
    invitedByName,
    name
  ) {
    return await emailService.sendInvitationEmail(
      email,
      inviteToken,
      organizationName,
      roles,
      invitedByName,
      name
    );
  }

  // Get all pending users
  async getAllPendingUsers() {
    return await PendingUser.find({});
  }

  // Get user by invite token - only return if still pending invitation
  async getUserByInviteToken(token) {
    return await User.findOne({
      inviteToken: token,
      status: "invited", // Must be invited status
      inviteTokenExpiry: { $gt: new Date() }, // Token not expired
      passwordHash: { $exists: false }, // No password set yet
    });
  }

  // Find invited user by token regardless of expiry (for resend flows)
  async getUserByExactInviteToken(token) {
    return await User.findOne({ inviteToken: token, status: "invited" });
  }

  // Find invited user by email (case-insensitive), regardless of expiry
  async getInvitedUserByEmail(email) {
    return await User.findOne({ email: email.toLowerCase(), status: "invited" });
  }

  // Get user by email verification token
  async getUserByVerificationToken(token) {
    return await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() }, // Token not expired
    });
  }

  // Get organization users with detailed info
  async getOrganizationUsersDetailed(organizationId) {
    return await User.find({ organization_id: organizationId })
      .select(
        "firstName lastName email role roles status isActive emailVerified inviteToken inviteTokenExpiry lastLoginAt createdAt invitedBy invitedAt department designation location assignedTasks completedTasks"
      )
      .populate("invitedBy", "firstName lastName email")
      .sort({ createdAt: -1 });
  }

  // Task operations
  // async createTask(taskData) {
  //   const task = new Task(taskData);
  //   return await task.save();
  // }

  async getTaskById(id) {
    console.log("DEBUG - getTaskById called with id:", id);
    const task = await Task.findById(id)
      .populate("assignedTo", "firstName lastName email avatar")
      .populate("createdBy", "firstName lastName email avatar")
      .populate("collaborators", "firstName lastName email avatar")
      .populate("contributors", "firstName lastName email avatar")
      .populate("parentTaskId", "title")
      .populate("project", "name")
      .populate("organization", "name")
      .populate("approvers", "firstName lastName email avatar role roles department designation")
      .populate("approverOrder.approverId", "firstName lastName email avatar role roles department designation")
      .populate("approvalDecisions.approverId", "firstName lastName email avatar role roles department designation")
      .populate({
        path: 'attached_form_version_id',
        model: 'FormVersion',
        select: 'version_number snapshot_data published_at form_id form_template_id'
      })
      .populate({
        path: 'comments.author',
        model: 'User',
        select: 'firstName lastName email'
      })
      .populate({
        path: 'comments.mentions',
        model: 'User',
        select: 'firstName lastName email role department designation'
      })
      .lean(); // ✅ Add lean() to preserve all embedded fields including attachments

    console.log("DEBUG - Found task:", task ? "Yes" : "No");

    if (task) {
      console.log('DEBUG - Looking for subtasks with parentTaskId:', id);
      // Get subtasks for this task with populated comments
      const subtasks = await Task.find({
        parentTaskId: id,
        isDeleted: { $ne: true }
      })
        .populate("assignedTo", "firstName lastName email")
        .populate("createdBy", "firstName lastName email")
        .populate("collaborators", "firstName lastName email avatar")
        .populate("contributors", "firstName lastName email avatar")
        .populate({
          path: 'attached_form_version_id',
          model: 'FormVersion',
          select: 'version_number snapshot_data published_at form_id form_template_id'
        })
        .populate({
          path: 'comments.author',
          model: 'User',
          select: 'firstName lastName email'
        })
        .populate({
          path: 'comments.mentions',
          model: 'User',
          select: 'firstName lastName email role department designation'
        })
        .lean() // ✅ Add lean() for subtasks too
        .sort({ createdAt: 1 });

      console.log('DEBUG - Found subtasks count:', subtasks.length);
      console.log('DEBUG - Subtasks details:', subtasks.map(s => ({ id: s._id, title: s.title, parentTaskId: s.parentTaskId })));

      // Since we're using lean(), task is already a plain object
      const taskObj = task;

      // Format task comments
      if (taskObj.comments && Array.isArray(taskObj.comments)) {
        taskObj.comments = taskObj.comments.map(comment => this.formatCommentMentions(comment));
      }

      // Format subtask comments
      const formattedSubtasks = subtasks.map(subtask => {
        // Since we're using lean(), subtask is already a plain object
        const subtaskObj = subtask;
        if (subtaskObj.comments && Array.isArray(subtaskObj.comments)) {
          subtaskObj.comments = subtaskObj.comments.map(comment => this.formatCommentMentions(comment));
        }
        // Ensure collaborators are returned as objects with id and name
        if (subtaskObj.collaborators && Array.isArray(subtaskObj.collaborators)) {
          subtaskObj.collaborators = subtaskObj.collaborators.map(c => {
            if (!c) return c;
            return {
              id: c._id ? c._id.toString() : (c.id || c),
              firstName: c.firstName || '',
              lastName: c.lastName || '',
              email: c.email || ''
            };
          });
        }
        return subtaskObj;
      });

      taskObj.subtasks = formattedSubtasks;
      // Normalize collaborators on the parent task as well (return id + name/email)
      if (taskObj.collaborators && Array.isArray(taskObj.collaborators)) {
        taskObj.collaborators = taskObj.collaborators.map(c => {
          if (!c) return c;
          return {
            id: c._id ? c._id.toString() : (c.id || c),
            firstName: c.firstName || '',
            lastName: c.lastName || '',
            email: c.email || ''
          };
        });
      }
      // If parentTaskId is populated, include a parentTaskTitle field for convenience
      if (taskObj.parentTaskId && typeof taskObj.parentTaskId === 'object') {
        taskObj.parentTaskTitle = taskObj.parentTaskId.title || null;
      }
      console.log(
        "DEBUG - Final taskObj has subtasks:",
        taskObj.subtasks ? taskObj.subtasks.length : "undefined"
      );
      return taskObj;
    }

    return task;
  }

  // Helper function to format comment mentions
  formatCommentMentions(comment) {
    if (!comment.mentions || !Array.isArray(comment.mentions)) {
      return {
        ...comment,
        mentions: [],
        // ✅ Ensure attachments are always preserved (even if undefined, make it empty array)
        attachments: comment.attachments || []
      };
    }

    const formattedMentions = comment.mentions.map(mention => {
      // Check if mention is already a populated user object
      if (mention && typeof mention === 'object' && mention.firstName) {
        return {
          id: mention._id.toString(),
          name: `${mention.firstName} ${mention.lastName}`.trim(),
          firstName: mention.firstName,
          lastName: mention.lastName,
          email: mention.email || '',
          role: mention.role || [],
          department: mention.department || '',
          designation: mention.designation || ''
        };
      }
      // If it's just an ID string, return it as is
      return mention;
    }).filter(Boolean);

    return {
      ...comment,
      mentions: formattedMentions,
      // ✅ Explicitly preserve attachments field
      attachments: comment.attachments || []
    };
  }

  async getTasksByFilter(filter, options = {}) {
    const { page = 1, limit = 50, sort = { createdAt: -1 } } = options;
    const skip = (page - 1) * limit;

    const tasks = await Task.find(filter)
      .populate("assignedTo", "firstName lastName email status")
      .populate("createdBy", "firstName lastName email")
      .populate("project", "name")
      .populate({
        path: 'attached_form_version_id',
        model: 'FormVersion',
        select: 'version_number snapshot_data published_at form_id form_template_id'
      })
      .populate({
        path: 'comments.author',
        model: 'User',
        select: 'firstName lastName email'
      })
      .populate({
        path: 'comments.mentions',
        model: 'User',
        select: 'firstName lastName email role department designation'
      })
      .sort(sort)
      .skip(skip)
      .limit(limit);

    // Get subtasks for each task
    if (tasks && tasks.length > 0) {
      const tasksWithSubtasks = [];
      for (let task of tasks) {
        const subtasks = await Task.find({
          parentTaskId: task._id,
          isDeleted: { $ne: true },
        })
          .populate("assignedTo", "firstName lastName email")
          .populate("createdBy", "firstName lastName email")
          .populate({
            path: 'attached_form_version_id',
            model: 'FormVersion',
            select: 'version_number snapshot_data published_at form_id form_template_id'
          })
          .populate({
            path: 'comments.author',
            model: 'User',
            select: 'firstName lastName email'
          })
          .populate({
            path: 'comments.mentions',
            model: 'User',
            select: 'firstName lastName email role department designation'
          })
          .sort({ createdAt: 1 });

        // Convert to plain object and add subtasks with formatted comments
        const taskObj = task.toObject();

        // Format task comments
        if (taskObj.comments && Array.isArray(taskObj.comments)) {
          taskObj.comments = taskObj.comments.map(comment => this.formatCommentMentions(comment));
        }

        // Format subtask comments
        const formattedSubtasks = subtasks.map(subtask => {
          const subtaskObj = subtask.toObject();
          if (subtaskObj.comments && Array.isArray(subtaskObj.comments)) {
            subtaskObj.comments = subtaskObj.comments.map(comment => this.formatCommentMentions(comment));
          }
          return subtaskObj;
        });

        taskObj.subtasks = formattedSubtasks;
        tasksWithSubtasks.push(taskObj);
      }
      return tasksWithSubtasks;
    }

    return tasks;
  }

  // Count tasks by filter (for pagination)
  async countTasksByFilter(filter) {
    return await Task.countDocuments(filter);
  }

  // async updateTask(id, updateData) {
  //   return await Task.findByIdAndUpdate(id, updateData, { new: true });
  // }

  // async deleteTask(id) {
  //   return await Task.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
  // }

  // Task approval operations
  async createTaskApproval(approvalData) {
    // For MongoDB, we'll store approvals as part of the task document
    const task = await Task.findById(approvalData.taskId);
    if (!task.approvalRecords) {
      task.approvalRecords = [];
    }

    const approval = {
      approverId: approvalData.approverId,
      status: approvalData.status,
      comment: approvalData.comment || "",
      createdAt: new Date(),
    };

    task.approvalRecords.push(approval);
    await task.save();

    // Track approval activity
    const activityType =
      approvalData.status === "approved"
        ? ActivityHelper.ACTIVITY_TYPES.APPROVAL_APPROVED
        : approvalData.status === "rejected"
          ? ActivityHelper.ACTIVITY_TYPES.APPROVAL_REJECTED
          : ActivityHelper.ACTIVITY_TYPES.APPROVAL_REQUESTED;

    await this.trackActivity({
      activityType,
      userId: approvalData.approverId,
      organizationId: task.organization,
      relatedId: task._id,
      relatedType: "task",
      data: {
        taskTitle: task.title,
        approvalStatus: approvalData.status,
        comment: approvalData.comment,
      }
    });

    return approval;
  }

  async getTaskApprovals(taskId) {
    const task = await Task.findById(taskId);
    return task?.approvalRecords || [];
  }

  async getTaskApprovalByTaskAndUser(taskId, userId) {
    const task = await Task.findById(taskId);
    return task?.approvalRecords?.find(
      (approval) => approval.approverId.toString() === userId.toString()
    );
  }

  async updateTaskApproval(approvalId, updateData) {
    // Since we're storing approvals in the task document for simplicity,
    // we need to handle this differently - this method should update by approval ID
    const task = await Task.findOne({ "approvalRecords._id": approvalId });
    if (task) {
      const approval = task.approvalRecords.id(approvalId);
      if (approval) {
        const oldStatus = approval.status;
        Object.assign(approval, updateData);
        await task.save();

        // Track approval update activity
        if (oldStatus !== updateData.status) {
          const activityType =
            updateData.status === "approved"
              ? ActivityHelper.ACTIVITY_TYPES.APPROVAL_APPROVED
              : updateData.status === "rejected"
                ? ActivityHelper.ACTIVITY_TYPES.APPROVAL_REJECTED
                : ActivityHelper.ACTIVITY_TYPES.APPROVAL_REQUESTED;

          await this.trackActivity({
            activityType,
            userId: approval.approverId,
            organizationId: task.organization,
            relatedId: task._id,
            relatedType: "task",
            data: {
              taskTitle: task.title,
              approvalStatus: updateData.status,
              oldStatus,
              comment: updateData.comment,
            },
          });
        }

        return approval;
      }
    }
    return null;
  }

  // Subtask operations with activity tracking
  async createSubtask(subtaskData) {
    // Subtasks are stored as regular tasks with parentTaskId
    const subtask = new Task({
      ...subtaskData,
      isSubtask: true,
    });
    const savedSubtask = await subtask.save();

    // Get parent task for activity tracking
    const parentTask = await Task.findById(subtaskData.parentTaskId);

    if (parentTask) {
      await this.trackActivity({
        activityType: ActivityHelper.ACTIVITY_TYPES.SUBTASK_CREATED,
        userId: subtaskData.createdBy,
        organizationId: subtaskData.organization,
        relatedId: parentTask._id,
        relatedType: "task",
        data: {
          taskTitle: parentTask.title,
          subtaskTitle: subtaskData.title,
          subtaskId: savedSubtask._id,
        },
      });
    }

    return savedSubtask;
  }

  async updateSubtask(id, subtaskData, userId) {
    const oldSubtask = await Task.findById(id);
    const subtask = await Task.findByIdAndUpdate(id, subtaskData, {
      new: true,
    });

    if (oldSubtask && oldSubtask.parentTaskId) {
      const parentTask = await Task.findById(oldSubtask.parentTaskId);

      if (parentTask) {
        // Track general subtask update
        await this.trackActivity({
          activityType: ActivityHelper.ACTIVITY_TYPES.SUBTASK_UPDATED,
          userId: userId,
          organizationId: subtask.organization,
          relatedId: parentTask._id,
          relatedType: "task",
          data: {
            taskTitle: parentTask.title,
            subtaskTitle: subtask.title,
            subtaskId: subtask._id,
          },
        });

        // Track subtask completion
        if (
          oldSubtask.status !== subtaskData.status &&
          subtaskData.status === "DONE"
        ) {
          await this.trackActivity({
            activityType: ActivityHelper.ACTIVITY_TYPES.SUBTASK_COMPLETED,
            userId: userId,
            organizationId: subtask.organization,
            relatedId: parentTask._id,
            relatedType: "task",
            data: {
              taskTitle: parentTask.title,
              subtaskTitle: subtask.title,
              subtaskId: subtask._id,
            },
          });
        }

        // Track subtask status changes
        if (oldSubtask.status !== subtaskData.status && subtaskData.status) {
          await this.trackActivity({
            activityType: ActivityHelper.ACTIVITY_TYPES.SUBTASK_STATUS_CHANGED,
            userId: userId,
            organizationId: subtask.organization,
            relatedId: parentTask._id,
            relatedType: "task",
            data: {
              taskTitle: parentTask.title,
              subtaskTitle: subtask.title,
              oldValue: oldSubtask.status,
              newValue: subtaskData.status,
              subtaskId: subtask._id,
            },
          });
        }
      }
    }

    return subtask;
  }

  async deleteSubtask(id, userId) {
    const subtask = await Task.findById(id);

    if (subtask && subtask.parentTaskId) {
      const parentTask = await Task.findById(subtask.parentTaskId);

      if (parentTask) {
        await this.trackActivity({
          activityType: ActivityHelper.ACTIVITY_TYPES.SUBTASK_DELETED,
          userId: userId,
          organizationId: subtask.organization,
          relatedId: parentTask._id,
          relatedType: "task",
          data: {
            taskTitle: parentTask.title,
            subtaskTitle: subtask.title,
            subtaskId: subtask._id,
          },
        });
      }
    }

    return await Task.findByIdAndDelete(id);
  }

  // Comment operations with activity tracking
  async addTaskComment(commentData) {
    const comment = new TaskComment(commentData);
    const savedComment = await comment.save();

    // Get task for activity tracking
    const task = await Task.findById(commentData.taskId);

    if (task) {
      await this.trackActivity({
        activityType: ActivityHelper.ACTIVITY_TYPES.COMMENT_ADDED,
        userId: commentData.authorId,
        organizationId: task.organization,
        relatedId: task._id,
        relatedType: "task",
        data: {
          taskTitle: task.title,
          commentId: savedComment._id,
          commentPreview: commentData.content.substring(0, 100),
        },
      });
    }

    return savedComment;
  }

  async updateTaskComment(id, commentData, userId) {
    const comment = await TaskComment.findByIdAndUpdate(id, commentData, {
      new: true,
    });

    if (comment) {
      const task = await Task.findById(comment.taskId);

      if (task) {
        await this.trackActivity({
          activityType: ActivityHelper.ACTIVITY_TYPES.COMMENT_UPDATED,
          userId: userId,
          organizationId: task.organization,
          relatedId: task._id,
          relatedType: "task",
          data: {
            taskTitle: task.title,
            commentId: comment._id,
          },
        });
      }
    }

    return comment;
  }

  async deleteTaskComment(id, userId) {
    const comment = await TaskComment.findById(id);

    if (comment) {
      const task = await Task.findById(comment.taskId);

      if (task) {
        await this.trackActivity({
          activityType: ActivityHelper.ACTIVITY_TYPES.COMMENT_DELETED,
          userId: userId,
          organizationId: task.organization,
          relatedId: task._id,
          relatedType: "task",
          data: {
            taskTitle: task.title,
            commentId: comment._id,
          },
        });
      }
    }

    return await TaskComment.findByIdAndDelete(id);
  }

  // Task assignment operations with activity tracking
  async assignTask(taskId, assignedTo, userId) {
    const task = await Task.findById(taskId);
    const oldAssignedTo = task.assignedTo;

    task.assignedTo = assignedTo;
    await task.save();

    // Get assigned user info
    const assignedUser = await User.findById(assignedTo);
    const assignedUserName = assignedUser
      ? `${assignedUser.firstName} ${assignedUser.lastName}`.trim() ||
      assignedUser.email
      : "Unknown User";

    await this.trackActivity({
      activityType: ActivityHelper.ACTIVITY_TYPES.TASK_ASSIGNED,
      userId: userId,
      organizationId: task.organization,
      relatedId: task._id,
      relatedType: "task",
      data: {
        taskTitle: task.title,
        assignedTo: assignedUserName,
        assignedToId: assignedTo,
      },
    });

    return task;
  }

  async unassignTask(taskId, userId) {
    const task = await Task.findById(taskId);
    const oldAssignedTo = task.assignedTo;

    // Get old assigned user info
    let oldAssignedUserName = "Unknown User";
    if (oldAssignedTo) {
      const oldAssignedUser = await User.findById(oldAssignedTo);
      oldAssignedUserName = oldAssignedUser
        ? `${oldAssignedUser.firstName} ${oldAssignedUser.lastName}`.trim() ||
        oldAssignedUser.email
        : "Unknown User";
    }

    task.assignedTo = null;
    await task.save();

    await this.trackActivity({
      activityType: ActivityHelper.ACTIVITY_TYPES.TASK_UNASSIGNED,
      userId: userId,
      organizationId: task.organization,
      relatedId: task._id,
      relatedType: "task",
      data: {
        taskTitle: task.title,
        assignedTo: oldAssignedUserName,
      },
    });

    return task;
  }

  // File attachment operations with activity tracking
  async attachFileToTask(taskId, fileData, userId) {
    const task = await Task.findById(taskId);

    if (task) {
      if (!task.attachments) {
        task.attachments = [];
      }

      task.attachments.push(fileData);
      await task.save();

      await this.trackActivity({
        activityType: ActivityHelper.ACTIVITY_TYPES.FILE_ATTACHED,
        userId: userId,
        organizationId: task.organization,
        relatedId: task._id,
        relatedType: "task",
        data: {
          taskTitle: task.title,
          fileName: fileData.originalName || fileData.name,
          fileSize: fileData.size,
        },
      });
    }

    return task;
  }

  async removeFileFromTask(taskId, fileId, userId) {
    const task = await Task.findById(taskId);

    if (task && task.attachments) {
      const fileIndex = task.attachments.findIndex(
        (file) => file._id.toString() === fileId
      );

      if (fileIndex > -1) {
        const removedFile = task.attachments[fileIndex];
        task.attachments.splice(fileIndex, 1);
        await task.save();

        await this.trackActivity({
          activityType: ActivityHelper.ACTIVITY_TYPES.FILE_REMOVED,
          userId: userId,
          organizationId: task.organization,
          relatedId: task._id,
          relatedType: "task",
          data: {
            taskTitle: task.title,
            fileName: removedFile.originalName || removedFile.name,
          },
        });
      }
    }

    return task;
  }

  // Project operations
  async getProjectsByOrganization(organizationId) {
    return await Project.find({
      $or: [
        { organization: organizationId },
        { organizationId: organizationId },
      ],
    }).sort({ createdAt: -1 });
  }

  // async getProject(id) {
  //   return await Project.findById(id);
  // }
}

export const storage = new MongoStorage();
