import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import { QuickTask } from '../modals/quickTaskModal.js';
import mongoose from 'mongoose';

/**
 * Quick Task Middleware
 * Provides authentication, authorization and validation for Quick Task operations
 */

// Middleware to check if user owns the quick task
const checkQuickTaskOwnership = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const taskId = req.params.id;

    // Validate task ID
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task ID format'
      });
    }

    // Check if task exists and belongs to user
    const quickTask = await QuickTask.findOne({
      _id: taskId,
      user: userId
    });

    if (!quickTask) {
      return res.status(404).json({
        success: false,
        message: 'Quick task not found or you do not have permission to access it'
      });
    }

    // Attach task to request for use in controller
    req.quickTask = quickTask;
    next();

  } catch (error) {
    console.error('Error in checkQuickTaskOwnership middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying task ownership',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Middleware to validate quick task creation data
const validateQuickTaskCreation = (req, res, next) => {
  const { title, priority, status, dueDate, notes, tags } = req.body;

  // Validate title
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Title is required and must be a non-empty string'
    });
  }

  if (title.trim().length > 200) {
    return res.status(400).json({
      success: false,
      message: 'Title cannot be more than 200 characters'
    });
  }

  // Validate priority if provided
  if (priority && !['low', 'medium', 'high'].includes(priority)) {
    return res.status(400).json({
      success: false,
      message: 'Priority must be one of: low, medium, high'
    });
  }

  // Validate status if provided
  if (status && !['open', 'done', 'archived'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Status must be one of: open, done, archived'
    });
  }

  // Validate due date if provided
  if (dueDate) {
    const dueDateObj = new Date(dueDate);
    if (isNaN(dueDateObj.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid due date format'
      });
    }
  }

  // Validate notes length if provided
  if (notes && typeof notes === 'string' && notes.length > 1000) {
    return res.status(400).json({
      success: false,
      message: 'Notes cannot be more than 1000 characters'
    });
  }

  // Validate tags if provided
  if (tags) {
    if (!Array.isArray(tags)) {
      return res.status(400).json({
        success: false,
        message: 'Tags must be an array'
      });
    }

    // Check each tag
    for (const tag of tags) {
      if (typeof tag !== 'string' || tag.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'All tags must be non-empty strings'
        });
      }

      if (tag.trim().length > 50) {
        return res.status(400).json({
          success: false,
          message: 'Each tag cannot be more than 50 characters'
        });
      }
    }

    // Limit number of tags
    if (tags.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'Cannot have more than 10 tags per task'
      });
    }
  }

  // Sanitize data
  req.body.title = title.trim();
  if (notes) req.body.notes = notes.trim();
  if (tags) req.body.tags = tags.map(tag => tag.trim());

  next();
};

// Middleware to validate quick task update data
const validateQuickTaskUpdate = (req, res, next) => {
  const { title, priority, status, dueDate, notes, tags } = req.body;

  // Validate title if provided
  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Title must be a non-empty string'
      });
    }

    if (title.trim().length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Title cannot be more than 200 characters'
      });
    }

    req.body.title = title.trim();
  }

  // Validate priority if provided
  if (priority !== undefined && !['low', 'medium', 'high'].includes(priority)) {
    return res.status(400).json({
      success: false,
      message: 'Priority must be one of: low, medium, high'
    });
  }

  // Validate status if provided
  if (status !== undefined && !['open', 'done', 'archived'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Status must be one of: open, done, archived'
    });
  }

  // Validate due date if provided
  if (dueDate !== undefined && dueDate !== null) {
    const dueDateObj = new Date(dueDate);
    if (isNaN(dueDateObj.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid due date format'
      });
    }
  }

  // Validate notes if provided
  if (notes !== undefined && typeof notes === 'string' && notes.length > 1000) {
    return res.status(400).json({
      success: false,
      message: 'Notes cannot be more than 1000 characters'
    });
  }

  // Validate tags if provided
  if (tags !== undefined) {
    if (!Array.isArray(tags)) {
      return res.status(400).json({
        success: false,
        message: 'Tags must be an array'
      });
    }

    // Check each tag
    for (const tag of tags) {
      if (typeof tag !== 'string' || tag.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'All tags must be non-empty strings'
        });
      }

      if (tag.trim().length > 50) {
        return res.status(400).json({
          success: false,
          message: 'Each tag cannot be more than 50 characters'
        });
      }
    }

    if (tags.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'Cannot have more than 10 tags per task'
      });
    }

    req.body.tags = tags.map(tag => tag.trim());
  }

  // Sanitize notes
  if (notes !== undefined && typeof notes === 'string') {
    req.body.notes = notes.trim();
  }

  next();
};

// Middleware to validate status update
const validateStatusUpdate = (req, res, next) => {
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({
      success: false,
      message: 'Status is required'
    });
  }

  if (!['open', 'done', 'archived'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Status must be one of: open, done, archived'
    });
  }

  next();
};

// Middleware to validate bulk operations
const validateBulkOperation = (req, res, next) => {
  const { taskIds, operation, operationData } = req.body;

  // Validate taskIds
  if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'taskIds must be a non-empty array'
    });
  }

  if (taskIds.length > 100) {
    return res.status(400).json({
      success: false,
      message: 'Cannot process more than 100 tasks at once'
    });
  }

  // Validate each task ID
  const invalidIds = taskIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
  if (invalidIds.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid task ID(s) found',
      invalidIds: invalidIds
    });
  }

  // Validate operation
  if (!operation) {
    return res.status(400).json({
      success: false,
      message: 'Operation is required'
    });
  }

  if (!['updateStatus', 'delete', 'archive'].includes(operation)) {
    return res.status(400).json({
      success: false,
      message: 'Operation must be one of: updateStatus, delete, archive'
    });
  }

  // Validate operation-specific data
  if (operation === 'updateStatus') {
    if (!operationData || !operationData.status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required for updateStatus operation'
      });
    }

    if (!['open', 'done', 'archived'].includes(operationData.status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be one of: open, done, archived'
      });
    }
  }

  next();
};

// Middleware to check if quick task can be converted
const validateTaskConversion = async (req, res, next) => {
  try {
    const { taskType, assignedTo } = req.body;

    // Validate task type
    if (taskType && !['regular', 'recurring', 'milestone', 'approval'].includes(taskType)) {
      return res.status(400).json({
        success: false,
        message: 'Task type must be one of: regular, recurring, milestone, approval'
      });
    }

    // Validate assignedTo if provided
    if (assignedTo && !mongoose.Types.ObjectId.isValid(assignedTo)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid assignedTo user ID'
      });
    }

    // Check if quick task is already converted (this will be checked in controller too)
    const quickTask = req.quickTask;
    if (quickTask && quickTask.conversionFlag.isConverted) {
      return res.status(400).json({
        success: false,
        message: 'Quick task has already been converted to a full task'
      });
    }

    next();

  } catch (error) {
    console.error('Error in validateTaskConversion middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating task conversion',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Middleware to rate limit quick task creation
const rateLimitQuickTaskCreation = (req, res, next) => {
  // Simple rate limiting based on user
  const userId = req.user.id;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 10; // Max 10 quick tasks per minute

  // Initialize rate limit tracking if not exists
  if (!global.quickTaskRateLimit) {
    global.quickTaskRateLimit = new Map();
  }

  const userRequests = global.quickTaskRateLimit.get(userId) || [];
  
  // Remove old requests outside the window
  const recentRequests = userRequests.filter(timestamp => now - timestamp < windowMs);

  if (recentRequests.length >= maxRequests) {
    return res.status(429).json({
      success: false,
      message: 'Rate limit exceeded. Maximum 10 quick tasks per minute allowed.',
      retryAfter: Math.ceil((recentRequests[0] + windowMs - now) / 1000)
    });
  }

  // Add current request
  recentRequests.push(now);
  global.quickTaskRateLimit.set(userId, recentRequests);

  next();
};

// Middleware to log quick task operations
const logQuickTaskOperation = (operation) => {
  return (req, res, next) => {
    const userId = req.user?.id;
    const taskId = req.params?.id;
    const userAgent = req.get('User-Agent');
    const ip = req.ip || req.connection.remoteAddress;

    console.log(`[QUICK_TASK] ${operation} - User: ${userId}, Task: ${taskId}, IP: ${ip}, UA: ${userAgent}`);
    next();
  };
};

export {
  checkQuickTaskOwnership,
  validateQuickTaskCreation,
  validateQuickTaskUpdate,
  validateStatusUpdate,
  validateBulkOperation,
  validateTaskConversion,
  rateLimitQuickTaskCreation,
  logQuickTaskOperation
};