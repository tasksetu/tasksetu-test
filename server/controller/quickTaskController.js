import { QuickTask } from '../modals/quickTaskModal.js';
import { User } from '../modals/userModal.js';
import { Task } from '../models.js';
import mongoose from 'mongoose';
import { FeatureUsageTracking } from '../modals/featureUsageTrackingModal.js';
import * as licenseService from '../services/licenseService.js';

/**
 * Quick Task Controller
 * Handles all Quick Task related operations
 * Quick Tasks are personal, lightweight tasks for individual users
 */

// @desc    Create a quick task
// @route   POST /api/quick-tasks
// @access  Private
const createQuickTask = async (req, res) => {
  try {

    const userId = req.user?.id || req.user?._id;

    const { title, priority, dueDate, notes, tags, reminder } = req.body;

    // Validation
    if (!userId) {
      console.error('❌ VALIDATION ERROR - No userId found');
      console.error('❌ req.user object:', JSON.stringify(req.user, null, 2));
      console.error('❌ typeof req.user:', typeof req.user);
      console.error('❌ req.user?.id:', req.user?.id);
      console.error('❌ req.user?._id:', req.user?._id);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: ['User is required']
      });
    }



    if (!title || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Quick Task cannot be empty.'
      });
    }

    // Duplicate check (case-insensitive, not done, not converted)
    const duplicate = await QuickTask.findOne({
      user: userId,
      title: { $regex: `^${title.trim()}$`, $options: 'i' },
      status: { $ne: 'done' },
      'convertedToTask.isConverted': { $ne: true }
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'A similar quick task exists. Continue?'
      });
    }

    // Create quick task
    // Smart defaults
    const quickTaskData = {
      title: title.trim(),
      user: userId,
      priority: priority || 'low',
      description: notes || '',
      tags: tags || [],
      createdByRole: Array.isArray(req.user.role) ? req.user.role : [req.user.role]
    };


    // Add optional fields

    // Default due date: today + 3 days
    if (dueDate) {
      quickTaskData.dueDate = new Date(dueDate);
    } else {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      quickTaskData.dueDate = d;
    }

    if (reminder) {
      quickTaskData.reminder = new Date(reminder);
    }

    const newQuickTask = new QuickTask(quickTaskData);
    const savedTask = await newQuickTask.save();

    // 📊 Track TASK_QUICK usage
    // ✅ FIXED: Use user_id instead of entity (updated for user-level licensing)
    const trackingUserId = req.featureUsage?.user_id || req.user?.id || req.user?._id;
    if (trackingUserId) {
      try {

        const consumeResult = await licenseService.consumeFeature(
          trackingUserId,
          'TASK_QUICK',
          1
        );

        if (consumeResult.success) {
        } else {
          console.warn('📊 [USAGE TRACKING] ⚠️ Failed to track TASK_QUICK usage:', consumeResult.message);
        }
      } catch (trackingError) {
        console.error('📊 [USAGE TRACKING] ⚠️ Failed to track TASK_QUICK usage:', trackingError.message);
        // Don't fail quick task creation if tracking fails
      }
    }

    // Populate user details for response
    await savedTask.populate('user', 'name email');

    res.status(201).json({
      success: true,
      message: 'Quick task created successfully',
      quickTask: savedTask
    });

  } catch (error) {
    console.error('❌ ERROR in createQuickTask:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error creating quick task',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get all quick tasks for the authenticated user
// @route   GET /api/quick-tasks
// @access  Private
const getQuickTasks = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      status = 'all',
      priority = 'all',
      dueDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      limit = 50,
      page = 1,
      search
    } = req.query;

    // Build query
    let query = { user: userId };

    // Quick Tasks are strictly personal: only filter by user

    // Apply filters
    if (status && status !== 'all') {
      query.status = status;
    }

    if (priority && priority !== 'all') {
      query.priority = priority;
    }

    if (dueDate) {
      const date = new Date(dueDate);
      const nextDay = new Date(date);
      nextDay.setDate(date.getDate() + 1);
      query.dueDate = {
        $gte: date,
        $lt: nextDay
      };
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    // Build sort object
    let sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [quickTasks, total] = await Promise.all([
      QuickTask.find(query)
        .populate('user', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      QuickTask.countDocuments(query)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      success: true,
      quickTasks,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage,
        hasPrevPage
      }
    });

  } catch (error) {
    console.error('Error in getQuickTasks:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching quick tasks',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Toggle quick task status (todo/completed)
// @route   PATCH /api/quick-tasks/:id/status
// @access  Private
const toggleQuickTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid quick task ID'
      });
    }

    const quickTask = await QuickTask.findOne({
      _id: id,
      user: userId
    });

    if (!quickTask) {
      return res.status(404).json({
        success: false,
        message: 'Quick task not found'
      });
    }

    // Prevent toggling back from done status (one-way transition)
    if (quickTask.status === 'done') {
      return res.status(400).json({
        success: false,
        message: 'Completed tasks cannot be reverted. Task is already marked as done.'
      });
    }

    // Mark task as done (one-way, cannot toggle back)
    const previousStatus = quickTask.status;
    const quickTaskUserId = quickTask.user; // Store user ID before any operations

    quickTask.status = 'done';
    quickTask.completedAt = quickTask.status === 'done' ? new Date() : null;
    quickTask.updatedAt = new Date();

    await quickTask.save();

    // 🔔 Create notification for quick task completion
    try {

      if (quickTask.status === 'done' && previousStatus !== 'done') {
        const { TriggerEvent, NotificationPriority, ChannelType, EntityType } = await import('../modals/notificationModal.js');
        const { NotificationService } = await import('../services/notificationService.js');


        const notificationData = {
          user_id: quickTaskUserId,
          trigger_event: TriggerEvent.QUICK_TASK_COMPLETED,
          related_entity: {
            entity_type: EntityType.QUICK_TASK,
            entity_id: quickTask._id
          },
          title: 'Quick Task Completed',
          message: `Your quick task "${quickTask.title}" has been marked as completed`,
          priority: NotificationPriority.NORMAL,
          channels: [ChannelType.IN_APP],
          metadata: {
            quickTaskId: quickTask._id,
            quickTaskTitle: quickTask.title
          }
        };


        const notification = await NotificationService.createNotification(notificationData);

        if (notification) {
        } else {
        }
      } else {
      }
    } catch (notificationError) {
      console.error('❌ Error creating quick task completion notification:', notificationError);
      console.error('Error details:', notificationError.message);
      console.error('Stack:', notificationError.stack);
      // Don't fail status toggle if notification fails
    }

    await quickTask.populate('user', 'name email');

    res.json({
      success: true,
      message: `Quick task marked as ${quickTask.status}`,
      quickTask
    });

  } catch (error) {
    console.error('Error in toggleQuickTaskStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating quick task status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Delete a quick task
// @route   DELETE /api/quick-tasks/:id
// @access  Private
const deleteQuickTask = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid quick task ID'
      });
    }

    const quickTask = await QuickTask.findOneAndDelete({
      _id: id,
      user: userId
    });

    if (!quickTask) {
      return res.status(404).json({
        success: false,
        message: 'Quick task not found'
      });
    }

    res.json({
      success: true,
      message: 'Quick task deleted successfully'
    });

  } catch (error) {
    console.error('Error in deleteQuickTask:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting quick task',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Update a quick task
// @route   PUT /api/quick-tasks/:id
// @access  Private
const updateQuickTask = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid quick task ID'
      });
    }

    // Get the current task to check if status is changing
    const currentTask = await QuickTask.findOne({ _id: id, user: userId });

    if (!currentTask) {
      return res.status(404).json({
        success: false,
        message: 'Quick task not found'
      });
    }

    const previousStatus = currentTask.status;

    // Remove fields that shouldn't be updated directly
    delete updates.user;
    delete updates.createdAt;
    delete updates._id;

    // Validate title if being updated
    if (updates.title && updates.title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Title cannot be empty'
      });
    }

    // Normalize status values: keep "done" as is (schema expects: pending, in-progress, done)
    // If frontend sends "open", convert to "pending"
    if (updates.status) {
      if (updates.status === 'open') {
        updates.status = 'pending';
        updates.completedAt = null;
      } else if (updates.status === 'done') {
        updates.completedAt = new Date();
      }
    }

    // Process dates
    if (updates.dueDate) {
      updates.dueDate = new Date(updates.dueDate);
    }
    if (updates.reminder) {
      updates.reminder = new Date(updates.reminder);
    }

    const quickTask = await QuickTask.findOneAndUpdate(
      { _id: id, user: userId },
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).populate('user', 'name email');

    if (!quickTask) {
      return res.status(404).json({
        success: false,
        message: 'Quick task not found'
      });
    }

    // 🔔 Create notification if status changed to done
    if (updates.status && quickTask.status === 'done' && previousStatus !== 'done') {
      try {

        const { TriggerEvent, NotificationPriority, ChannelType, EntityType } = await import('../modals/notificationModal.js');
        const { NotificationService } = await import('../services/notificationService.js');


        const notificationData = {
          user_id: userId,
          trigger_event: TriggerEvent.QUICK_TASK_COMPLETED,
          related_entity: {
            entity_type: EntityType.QUICK_TASK,
            entity_id: quickTask._id
          },
          title: 'Quick Task Completed',
          message: `Your quick task "${quickTask.title}" has been marked as completed`,
          priority: NotificationPriority.NORMAL,
          channels: [ChannelType.IN_APP],
          metadata: {
            quickTaskId: quickTask._id,
            quickTaskTitle: quickTask.title
          }
        };


        const notification = await NotificationService.createNotification(notificationData);

        if (notification) {
        } else {
        }
      } catch (notificationError) {
        console.error('❌ Error creating quick task completion notification:', notificationError);
        console.error('Error details:', notificationError.message);
        console.error('Stack:', notificationError.stack);
        // Don't fail update if notification fails
      }
    }

    res.json({
      success: true,
      message: 'Quick task updated successfully',
      quickTask
    });

  } catch (error) {
    console.error('Error in updateQuickTask:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating quick task',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Convert Quick Task to Regular Task
// @route   POST /api/quick-tasks/:id/convert
// @access  Private
const convertQuickTaskToRegular = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;
    const { regularTaskId, taskType } = req.body;


    // Validate required fields
    if (!regularTaskId) {
      return res.status(400).json({
        success: false,
        message: 'Regular task ID is required'
      });
    }

    // Find the quick task
    const quickTask = await QuickTask.findOne({ _id: id, user: userId });

    if (!quickTask) {
      return res.status(404).json({
        success: false,
        message: 'Quick task not found'
      });
    }

    // Check if already converted (support both current schema + legacy field name)
    const alreadyConverted = quickTask.convertedToTask?.isConverted || quickTask.conversionFlag?.isConverted;
    if (alreadyConverted) {
      return res.status(400).json({
        success: false,
        message: 'Quick task has already been converted',
        data: {
          convertedToTaskId: quickTask.convertedToTask?.taskId || quickTask.conversionFlag?.convertedToTaskId,
          convertedAt: quickTask.convertedToTask?.convertedAt || quickTask.conversionFlag?.convertedAt
        }
      });
    }

    // Verify the regular task exists
    const regularTask = await Task.findById(regularTaskId);
    if (!regularTask) {
      return res.status(404).json({
        success: false,
        message: 'Regular task not found'
      });
    }

    // Update quick task with conversion tracking (schema field)
    quickTask.convertedToTask = {
      isConverted: true,
      taskId: regularTaskId,
      convertedAt: new Date()
    };

    // Also set legacy field name if it exists in DB (harmless if not persisted by schema)
    quickTask.conversionFlag = {
      isConverted: true,
      convertedToTaskId: regularTaskId,
      convertedToTaskType: taskType || 'regular',
      convertedAt: quickTask.convertedToTask.convertedAt
    };

    // Mark as done/archived
    quickTask.status = 'done';
    quickTask.completedAt = new Date();

    await quickTask.save();

    // 🔔 Send QUICK_TASK_CONVERTED notification to the user
    try {
      const { NotificationService } = await import('../services/notificationService.js');
      const { TriggerEvent, EntityType, NotificationPriority, ChannelType } = await import('../modals/notificationModal.js');

      await NotificationService.createNotification({
        user_id: userId,
        trigger_event: TriggerEvent.QUICK_TASK_CONVERTED,
        related_entity: {
          entity_type: EntityType.QUICK_TASK,
          entity_id: quickTask._id,
          entity_name: quickTask.title
        },
        title: `Quick Task Converted: ${quickTask.title}`,
        message: `Your quick task "${quickTask.title}" has been converted to a ${taskType || 'regular'} task successfully.`,
        priority: NotificationPriority.NORMAL,
        channels: [ChannelType.IN_APP],
        metadata: {
          quickTaskId: quickTask._id,
          regularTaskId,
          taskType: taskType || 'regular',
          convertedAt: quickTask.convertedToTask.convertedAt
        }
      });
    } catch (notifError) {
      console.error('⚠ Failed to send quick task conversion notification:', notifError.message);
    }


    res.json({
      success: true,
      message: 'Quick task converted to regular task successfully',
      data: {
        quickTask,
        convertedToTaskId: regularTaskId,
        taskType: taskType || 'regular'
      }
    });

  } catch (error) {
    console.error('❌ Error in convertQuickTaskToRegular:', error);
    res.status(500).json({
      success: false,
      message: 'Error converting quick task',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Auto-archive quick tasks that are completed and older than the configured archive period
// This function can be called periodically (e.g., daily) by a background job
const autoArchiveQuickTasks = async () => {
  const archiveDate = new Date();
  archiveDate.setDate(archiveDate.getDate() - QUICK_TASK_ARCHIVE_DAYS);

  // Find completed quick tasks not yet archived, completed before archiveDate
  const tasksToArchive = await QuickTask.find({
    status: 'done',
    isArchived: { $ne: true },
    completedAt: { $lte: archiveDate }
  });

  for (const task of tasksToArchive) {
    task.isArchived = true;
    task.archivedAt = new Date();
    await task.save();
  }
  return tasksToArchive.length;
};

export {
  createQuickTask,
  getQuickTasks,
  updateQuickTask,
  toggleQuickTaskStatus,
  deleteQuickTask,
  convertQuickTaskToRegular,
  autoArchiveQuickTasks
};