import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import { MilestoneTask } from '../modals/milestoneTaskModal.js';
import { User } from '../modals/userModal.js';
import mongoose from 'mongoose';

/**
 * Milestone Task Middleware
 * Provides authentication, authorization and validation for Milestone Task operations
 */

// Helper function to check if user can create milestones
const canCreateMilestone = (userRole) => {
  // ✅ All users can now create milestones
  return true;
};

// Helper function to check if user can access milestone
const canAccessMilestone = (milestone, userId, userRole) => {
  const allowedRoles = ['org_admin', 'super_admin'];
  
  // Handle both string and array roles
  const hasMultipleRoles = Array.isArray(userRole);
  
  // Admins and Org Admins can access all milestones
  if (hasMultipleRoles ? userRole.some(role => allowedRoles.includes(role)) : allowedRoles.includes(userRole)) {
    return true;
  }
  
  // All users (including Managers) can access milestones they created or are assigned to
  return (milestone.creator && milestone.creator.toString() === userId.toString()) || 
         (milestone.assignedTo && milestone.assignedTo.toString() === userId.toString());
};

// Middleware to check if user has access to the milestone task
const checkMilestoneAccess = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const milestoneId = req.params.id;

    // Validate milestone ID
    if (!mongoose.Types.ObjectId.isValid(milestoneId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid milestone ID format'
      });
    }

    // Check if milestone exists
    const milestone = await MilestoneTask.findById(milestoneId);

    if (!milestone) {
      return res.status(404).json({
        success: false,
        message: 'Milestone task not found'
      });
    }

    // Check access permissions
    if (!canAccessMilestone(milestone, userId, userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access milestones you created or are assigned to.'
      });
    }

    // Attach milestone to request for use in controller
    req.milestone = milestone;
    next();

  } catch (error) {
    console.error('Error in checkMilestoneAccess middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying milestone access',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Middleware to validate milestone task creation data
const validateMilestoneCreation = async (req, res, next) => {
  try {
    const { title, description, assignedTo, priority, dueDate, linkedTasks, tags } = req.body;
    const userRole = req.user.role;

    // All users can now create milestones

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

    // Validate description if provided
    if (description && typeof description === 'string' && description.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Description cannot be more than 2000 characters'
      });
    }

    // Validate assignedTo
    if (!assignedTo) {
      return res.status(400).json({
        success: false,
        message: 'Assigned user is required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid assigned user ID format'
      });
    }

    // Check if assigned user exists
    const assignedUser = await User.findById(assignedTo);
    if (!assignedUser) {
      return res.status(400).json({
        success: false,
        message: 'Assigned user not found'
      });
    }

    // Validate priority if provided
    if (priority && !['low', 'medium', 'high', 'critical'].includes(priority)) {
      return res.status(400).json({
        success: false,
        message: 'Priority must be one of: low, medium, high, critical'
      });
    }

    // Validate due date
    if (!dueDate) {
      return res.status(400).json({
        success: false,
        message: 'Due date is required for milestone tasks'
      });
    }

    const dueDateObj = new Date(dueDate);
    if (isNaN(dueDateObj.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid due date format'
      });
    }

    // Check if due date is in the future
    if (dueDateObj <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Due date must be in the future'
      });
    }

    // Validate linked tasks if provided
    if (linkedTasks) {
      if (!Array.isArray(linkedTasks)) {
        return res.status(400).json({
          success: false,
          message: 'Linked tasks must be an array'
        });
      }

      // Limit number of linked tasks
      if (linkedTasks.length > 50) {
        return res.status(400).json({
          success: false,
          message: 'Cannot link more than 50 tasks to a milestone'
        });
      }

      // Validate each linked task
      for (const linkedTask of linkedTasks) {
        if (!linkedTask.taskId || !mongoose.Types.ObjectId.isValid(linkedTask.taskId)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid task ID in linked tasks'
          });
        }

        if (linkedTask.completionPercentage !== undefined) {
          const percentage = Number(linkedTask.completionPercentage);
          if (isNaN(percentage) || percentage < 0 || percentage > 100) {
            return res.status(400).json({
              success: false,
              message: 'Completion percentage must be between 0 and 100'
            });
          }
        }
      }
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
      if (tags.length > 20) {
        return res.status(400).json({
          success: false,
          message: 'Cannot have more than 20 tags per milestone'
        });
      }
    }

    // Sanitize data
    req.body.title = title.trim();
    if (description) req.body.description = description.trim();
    if (tags) req.body.tags = tags.map(tag => tag.trim());

    next();

  } catch (error) {
    console.error('Error in validateMilestoneCreation middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating milestone creation',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Middleware to validate milestone task update data
const validateMilestoneUpdate = async (req, res, next) => {
  try {
    const { title, description, assignedTo, priority, dueDate, status, tags } = req.body;

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

    // Validate description if provided
    if (description !== undefined && typeof description === 'string' && description.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Description cannot be more than 2000 characters'
      });
    }

    // Validate assignedTo if provided
    if (assignedTo !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid assigned user ID format'
        });
      }

      // Check if assigned user exists
      const assignedUser = await User.findById(assignedTo);
      if (!assignedUser) {
        return res.status(400).json({
          success: false,
          message: 'Assigned user not found'
        });
      }
    }

    // Validate priority if provided
    if (priority !== undefined && !['low', 'medium', 'high', 'critical'].includes(priority)) {
      return res.status(400).json({
        success: false,
        message: 'Priority must be one of: low, medium, high, critical'
      });
    }

    // Validate status if provided
    if (status !== undefined && !['OPEN', 'INPROGRESS', 'ACHIEVED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be one of: OPEN, INPROGRESS, ACHIEVED, CANCELLED'
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

      if (tags.length > 20) {
        return res.status(400).json({
          success: false,
          message: 'Cannot have more than 20 tags per milestone'
        });
      }

      req.body.tags = tags.map(tag => tag.trim());
    }

    // Sanitize description
    if (description !== undefined && typeof description === 'string') {
      req.body.description = description.trim();
    }

    next();

  } catch (error) {
    console.error('Error in validateMilestoneUpdate middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating milestone update',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Middleware to validate task linking
const validateTaskLinking = (req, res, next) => {
  const { taskId, completionPercentage } = req.body;

  // Validate taskId
  if (!taskId) {
    return res.status(400).json({
      success: false,
      message: 'Task ID is required'
    });
  }

  if (!mongoose.Types.ObjectId.isValid(taskId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid task ID format'
    });
  }

  // Validate completion percentage if provided
  if (completionPercentage !== undefined) {
    const percentage = Number(completionPercentage);
    if (isNaN(percentage) || percentage < 0 || percentage > 100) {
      return res.status(400).json({
        success: false,
        message: 'Completion percentage must be between 0 and 100'
      });
    }
  }

  next();
};

// Middleware to validate comment addition
const validateCommentAddition = (req, res, next) => {
  const { comment } = req.body;

  // Validate comment
  if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Comment is required and must be a non-empty string'
    });
  }

  if (comment.trim().length > 1000) {
    return res.status(400).json({
      success: false,
      message: 'Comment cannot be more than 1000 characters'
    });
  }

  // Sanitize comment
  req.body.comment = comment.trim();

  next();
};

// Middleware to validate bulk operations
const validateBulkMilestoneOperation = (req, res, next) => {
  const { milestoneIds, operation, operationData } = req.body;

  // Validate milestoneIds
  if (!milestoneIds || !Array.isArray(milestoneIds) || milestoneIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'milestoneIds must be a non-empty array'
    });
  }

  if (milestoneIds.length > 50) {
    return res.status(400).json({
      success: false,
      message: 'Cannot process more than 50 milestones at once'
    });
  }

  // Validate each milestone ID
  const invalidIds = milestoneIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
  if (invalidIds.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid milestone ID(s) found',
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

  if (!['updateStatus', 'delete', 'achieve', 'cancel'].includes(operation)) {
    return res.status(400).json({
      success: false,
      message: 'Operation must be one of: updateStatus, delete, achieve, cancel'
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

    if (!['OPEN', 'INPROGRESS', 'ACHIEVED', 'CANCELLED'].includes(operationData.status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be one of: OPEN, INPROGRESS, ACHIEVED, CANCELLED'
      });
    }
  }

  next();
};

// Middleware to rate limit milestone task creation
const rateLimitMilestoneCreation = (req, res, next) => {
  // Simple rate limiting based on user
  const userId = req.user.id;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 5; // Max 5 milestones per minute (more restrictive than quick tasks)

  // Initialize rate limit tracking if not exists
  if (!global.milestoneRateLimit) {
    global.milestoneRateLimit = new Map();
  }

  const userRequests = global.milestoneRateLimit.get(userId) || [];
  
  // Remove old requests outside the window
  const recentRequests = userRequests.filter(timestamp => now - timestamp < windowMs);

  if (recentRequests.length >= maxRequests) {
    return res.status(429).json({
      success: false,
      message: 'Rate limit exceeded. Maximum 5 milestone tasks per minute allowed.',
      retryAfter: Math.ceil((recentRequests[0] + windowMs - now) / 1000)
    });
  }

  // Add current request
  recentRequests.push(now);
  global.milestoneRateLimit.set(userId, recentRequests);

  next();
};

// Middleware to log milestone task operations
const logMilestoneOperation = (operation) => {
  return (req, res, next) => {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const milestoneId = req.params?.id;
    const userAgent = req.get('User-Agent');
    const ip = req.ip || req.connection.remoteAddress;

    console.log(`[MILESTONE_TASK] ${operation} - User: ${userId} (${userRole}), Milestone: ${milestoneId}, IP: ${ip}, UA: ${userAgent}`);
    next();
  };
};

// Middleware to check role permissions for specific operations
const requireManagerOrAbove = (req, res, next) => {
  const userRole = req.user.role;
  
  if (!canCreateMilestone(userRole)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Manager or Admin role required for this operation.',
      error: 'INSUFFICIENT_PERMISSIONS'
    });
  }
  
  next();
};

export {
  checkMilestoneAccess,
  validateMilestoneCreation,
  validateMilestoneUpdate,
  validateTaskLinking,
  validateCommentAddition,
  validateBulkMilestoneOperation,
  rateLimitMilestoneCreation,
  logMilestoneOperation,
  requireManagerOrAbove,
  canCreateMilestone,
  canAccessMilestone
};