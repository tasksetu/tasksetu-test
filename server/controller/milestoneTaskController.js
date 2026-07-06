import { MilestoneTask } from '../modals/milestoneTaskModal.js';
import { User } from '../modals/userModal.js';
import { Task } from '../models.js';
import mongoose from 'mongoose';
import { FeatureUsageTracking } from '../modals/featureUsageTrackingModal.js';
import * as licenseService from '../services/licenseService.js';

/**
 * Milestone Task Controller
 * Handles all Milestone Task related operations
 * Milestone Tasks are major checkpoints that can be created by Manager+ roles only
 */

// Helper function to check if user can create milestones
const canCreateMilestone = (userRole) => {
  // ✅ All users can now create milestones
  return true;
};

// Helper function to check if user can view/edit milestone
const canAccessMilestone = (milestone, userId, userRole, organizationId) => {
  const allowedRoles = ['org_admin', 'super_admin', 'admin', 'company_admin'];

  // Handle both string and array roles
  const roles = Array.isArray(userRole) ? userRole : [userRole];

  // Admins and Org Admins can access all milestones in their organization
  if (roles.some(role => allowedRoles.includes(role))) {
    return !milestone.organization || milestone.organization.toString() === organizationId?.toString();
  }

  // Managers can access all milestones in their organization
  if (roles.includes('manager')) {
    return !milestone.organization || milestone.organization.toString() === organizationId?.toString();
  }

  // All users can access milestones they created or are assigned to
  return (milestone.creator && milestone.creator.toString() === userId.toString()) ||
    (milestone.assignedTo && milestone.assignedTo.toString() === userId.toString());
};

// @desc    Create a milestone task
// @route   POST /api/milestone-tasks
// @access  Private (Manager+ only)
const createMilestoneTask = async (req, res) => {
  try {
    console.log('🚀 CREATE MILESTONE TASK - START');
    console.log('📋 req.user:', JSON.stringify(req.user, null, 2));
    console.log('📋 req.body:', JSON.stringify(req.body, null, 2));

    const userId = req.user?.id || req.user?._id;
    const userRole = req.user?.role;
    const organizationId = req.user?.organizationId || req.user?.orgId;

    console.log('👤 Extracted userId:', userId, 'userRole:', userRole, 'orgId:', organizationId);

    // All users can now create milestones

    const {
      title,
      description,
      assignedTo,
      priority,
      dueDate,
      linkedTasks = [],
      tags = []
    } = req.body;

    // Validation
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: ['User is required']
      });
    }

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: ['Organization is required']
      });
    }

    if (!title || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: ['Title is required']
      });
    }

    if (!assignedTo) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: ['Assigned user is required']
      });
    }

    if (!dueDate) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: ['Due date is required for milestone tasks']
      });
    }

    // Verify assigned user exists
    const assignedUser = await User.findById(assignedTo);
    if (!assignedUser) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: ['Assigned user not found']
      });
    }

    // Create milestone task
    const milestoneData = {
      title: title.trim(),
      description: description?.trim() || '',
      organization: organizationId,
      creator: userId,
      assignedTo,
      priority: priority || 'medium',
      dueDate: new Date(dueDate),
      tags: tags || [],
      linkedTasks: []
    };

    // Process linked tasks if provided
    if (linkedTasks && linkedTasks.length > 0) {
      for (const linkedTask of linkedTasks) {
        // Verify linked task exists
        const task = await Task.findById(linkedTask.taskId);
        if (task) {
          milestoneData.linkedTasks.push({
            taskId: linkedTask.taskId,
            taskTitle: task.title,
            taskType: task.taskType || 'regular',
            status: task.status || 'OPEN',
            completionPercentage: linkedTask.completionPercentage || 0
          });
        }
      }
    }

    console.log('📝 Milestone Data to create:', JSON.stringify(milestoneData, null, 2));

    const newMilestone = new MilestoneTask(milestoneData);

    // Add initial activity log
    newMilestone.activityFeed.push({
      action: 'created',
      user: userId,
      details: `Milestone "${title}" created and assigned to ${assignedUser.name}`,
      timestamp: new Date()
    });

    const savedMilestone = await newMilestone.save();
    console.log('✅ Milestone saved successfully:', savedMilestone._id);

    // 📊 Track TASK_MSTONE usage
    // ✅ FIXED: Use user_id instead of entity (updated for user-level licensing)
    const trackingUserId = req.featureUsage?.user_id || req.user?.id || req.user?._id;
    if (trackingUserId) {
      try {
        console.log('📊 [USAGE TRACKING] Tracking TASK_MSTONE usage');
        console.log('📊 [USAGE TRACKING] User ID:', trackingUserId);

        const consumeResult = await licenseService.consumeFeature(
          trackingUserId,
          'TASK_MSTONE',
          1
        );

        if (consumeResult.success) {
          console.log('📊 [USAGE TRACKING] ✅ TASK_MSTONE usage tracked successfully. New usage:', consumeResult.usage);
        } else {
          console.warn('📊 [USAGE TRACKING] ⚠️ Failed to track TASK_MSTONE usage:', consumeResult.message);
        }
      } catch (trackingError) {
        console.error('📊 [USAGE TRACKING] ⚠️ Failed to track TASK_MSTONE usage:', trackingError.message);
        // Don't fail milestone creation if tracking fails
      }
    }

    // Populate user details for response
    await savedMilestone.populate([
      { path: 'creator', select: 'firstName lastName email role' },
      { path: 'assignedTo', select: 'firstName lastName email role' },
      { path: 'linkedTasks.taskId', select: 'title status priority dueDate' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Milestone task created successfully',
      milestone: savedMilestone
    });

  } catch (error) {
    console.error('❌ ERROR in createMilestoneTask:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating milestone task',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get all milestone tasks for the authenticated user
// @route   GET /api/milestone-tasks
// @access  Private
const getMilestoneTasks = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const organizationId = req.user.organizationId || req.user.orgId;
    const {
      status = 'all',
      priority = 'all',
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      tags,
      overdue
    } = req.query;

    console.log('📋 GET MILESTONES - userId:', userId, 'userRole:', userRole, 'orgId:', organizationId);

    const options = {
      status: status !== 'all' ? status : undefined,
      priority: priority !== 'all' ? priority : undefined,
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder,
      search,
      tags: tags ? tags.split(',') : undefined,
      overdue: overdue === 'true',
      organizationId: organizationId
    };

    const milestones = await MilestoneTask.getMilestonesByUser(userId, userRole, options);

    // Calculate total count respecting user's role and search/filter options
    const roles = Array.isArray(userRole) ? userRole : [userRole];
    const isPrivileged = roles.some(r => ['manager', 'org_admin', 'super_admin', 'admin'].includes(r));

    let totalQuery = {};
    if (isPrivileged) {
      totalQuery.$or = [{ creator: userId }, { assignedTo: userId }];
    } else {
      totalQuery.assignedTo = userId;
    }

    if (status !== 'all') totalQuery.status = status;
    if (priority !== 'all') totalQuery.priority = priority;
    if (search) {
      totalQuery.$and = totalQuery.$and || [];
      totalQuery.$and.push({
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ]
      });
    }

    const total = await MilestoneTask.countDocuments(totalQuery);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    console.log('✅ Found', milestones.length, 'milestones out of', total, 'total');

    res.json({
      success: true,
      milestones,
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
    console.error('❌ ERROR in getMilestoneTasks:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching milestone tasks',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get single milestone task by ID
// @route   GET /api/milestone-tasks/:id
// @access  Private
const getMilestoneTask = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid milestone task ID'
      });
    }

    const milestone = await MilestoneTask.findById(id)
      .populate('creator', 'firstName lastName email role')
      .populate('assignedTo', 'firstName lastName email role')
      .populate('linkedTasks.taskId', 'title status priority dueDate taskType')
      .populate('comments.user', 'firstName lastName email')
      .populate('activityFeed.user', 'firstName lastName');

    if (!milestone) {
      return res.status(404).json({
        success: false,
        message: 'Milestone task not found'
      });
    }

    const organizationId = req.user.organizationId || req.user.orgId;
    // Check access permissions
    if (!canAccessMilestone(milestone, userId, userRole, organizationId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to view this milestone.'
      });
    }

    res.json({
      success: true,
      milestone
    });

  } catch (error) {
    console.error('❌ ERROR in getMilestoneTask:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching milestone task',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Update milestone task
// @route   PUT /api/milestone-tasks/:id
// @access  Private
const updateMilestoneTask = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid milestone task ID'
      });
    }

    const milestone = await MilestoneTask.findById(id);
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
        message: 'Access denied. You can only edit milestones you created or are assigned to.'
      });
    }

    // Remove fields that shouldn't be updated directly
    delete updates.creator;
    delete updates.createdAt;
    delete updates._id;
    delete updates.linkedTasks; // Use separate endpoints for task linking
    delete updates.progressPercentage; // Auto-calculated
    delete updates.activityFeed; // Managed by system

    // Validate title if being updated
    if (updates.title && updates.title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Title cannot be empty'
      });
    }

    // Process dates
    if (updates.dueDate) {
      updates.dueDate = new Date(updates.dueDate);
    }

    // Track status change for activity log
    const oldStatus = milestone.status;
    const updatedMilestone = await MilestoneTask.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).populate([
      { path: 'creator', select: 'name email role' },
      { path: 'assignedTo', select: 'name email role' },
      { path: 'linkedTasks.taskId', select: 'title status priority dueDate' }
    ]);

    // Add activity log if status changed
    if (updates.status && updates.status !== oldStatus) {
      updatedMilestone.activityFeed.push({
        action: 'status_changed',
        user: userId,
        details: `Status changed from ${oldStatus} to ${updates.status}`,
        timestamp: new Date()
      });
      await updatedMilestone.save();
    }

    res.json({
      success: true,
      message: 'Milestone task updated successfully',
      milestone: updatedMilestone
    });

  } catch (error) {
    console.error('❌ ERROR in updateMilestoneTask:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating milestone task',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Delete milestone task
// @route   DELETE /api/milestone-tasks/:id
// @access  Private (Creator only)
const deleteMilestoneTask = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid milestone task ID'
      });
    }

    const milestone = await MilestoneTask.findById(id);

    if (!milestone) {
      return res.status(404).json({
        success: false,
        message: 'Milestone task not found'
      });
    }

    // Check access permissions - allow deletion if user is admin, creator or assigned to milestone
    if (!canAccessMilestone(milestone, userId, userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete milestones you created or are assigned to.'
      });
    }

    await MilestoneTask.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Milestone task deleted successfully'
    });

  } catch (error) {
    console.error('❌ ERROR in deleteMilestoneTask:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting milestone task',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Link task to milestone
// @route   POST /api/milestone-tasks/:id/link-task
// @access  Private
const linkTaskToMilestone = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const { taskId, completionPercentage = 0 } = req.body;

    console.log('🔗 Link Task to Milestone attempt:', {
      milestoneId: id,
      taskId,
      userId,
      userRole
    });

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid milestone or task ID'
      });
    }

    const milestone = await MilestoneTask.findById(id);
    if (!milestone) {
      return res.status(404).json({
        success: false,
        message: 'Milestone task not found'
      });
    }

    // 🏔️ MILESTONE LINK TASK VALIDATION (Doc Ref: 4.3.2)
    // "Only managers and organizational admins can establish milestone dependencies or subtasks."
    // Employee and Individual users CANNOT link tasks to milestones
    const userRoles = Array.isArray(userRole) ? userRole : [userRole];
    const isTasksetuAdmin = userRoles.includes('tasksetu-admin') || userRoles.includes('super-admin');
    const isOrgAdmin = userRoles.includes('org_admin') || userRoles.includes('company-admin') || userRoles.includes('admin');
    const isManager = userRoles.includes('manager');
    const isEmployee = userRoles.includes('employee') || userRoles.includes('user') || userRoles.includes('normal-user');
    const isIndividual = userRoles.includes('individual');

    if (!isManager && !isOrgAdmin && !isTasksetuAdmin) {
      console.error('❌ Permission denied: Only Manager/Org Admin can link tasks to milestones');
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only Manager or Org Admin can link tasks to milestones. Employees can view linked tasks but cannot modify them.'
      });
    }

    console.log('✅ Link task permission granted for Manager/Admin');

    // Check access permissions (for viewing milestone)
    if (!canAccessMilestone(milestone, userId, userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have access to this milestone'
      });
    }

    // Get task details
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // 🏔️ TASK TYPE VALIDATION FOR LINKING (Doc Ref: Section 2)
    // Quick and Approval tasks CANNOT be linked to milestones
    if (task.taskType === 'quick' || task.isQuickTask === true) {
      console.error('❌ Cannot link Quick task to milestone');
      return res.status(400).json({
        success: false,
        message: 'Quick tasks cannot be linked to milestones. Quick tasks are single-step actions.'
      });
    }

    if (task.taskType === 'approval' || task.isApprovalTask === true) {
      console.error('❌ Cannot link Approval task to milestone');
      return res.status(400).json({
        success: false,
        message: 'Approval tasks cannot be linked to milestones. Approval tasks are atomic by design.'
      });
    }

    // 🏔️ RECURRING PATTERN VALIDATION (Doc Ref: Section 2)
    // Recurring pattern itself cannot be linked, only instances can be linked
    if (task.isRecurring === true && task.taskType === 'recurring' && !task.recurringInstanceOf) {
      console.error('❌ Cannot link recurring pattern to milestone');
      return res.status(400).json({
        success: false,
        message: 'Recurring pattern cannot be linked to milestones. Only specific recurring instances can be linked.'
      });
    }

    console.log('✅ Task type validation passed for linking:', {
      taskType: task.taskType,
      isQuick: task.isQuickTask,
      isApproval: task.isApprovalTask,
      isRecurring: task.isRecurring,
      isRecurringInstance: !!task.recurringInstanceOf
    });

    // Link the task
    await milestone.linkTask({
      taskId,
      taskTitle: task.title,
      taskType: task.taskType || 'regular',
      status: task.status || 'OPEN',
      completionPercentage,
      linkedBy: userId
    });

    // Populate and return updated milestone
    await milestone.populate([
      { path: 'creator', select: 'name email role' },
      { path: 'assignedTo', select: 'name email role' },
      { path: 'linkedTasks.taskId', select: 'title status priority dueDate' }
    ]);

    res.json({
      success: true,
      message: 'Task linked to milestone successfully',
      milestone
    });

  } catch (error) {
    console.error('❌ ERROR in linkTaskToMilestone:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error linking task to milestone',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Unlink task from milestone
// @route   DELETE /api/milestone-tasks/:id/unlink-task/:taskId
// @access  Private (Manager+ only)
const unlinkTaskFromMilestone = async (req, res) => {
  try {
    const { id, taskId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log('🔓 Unlink Task from Milestone attempt:', {
      milestoneId: id,
      taskId,
      userId,
      userRole
    });

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid milestone or task ID'
      });
    }

    const milestone = await MilestoneTask.findById(id);
    if (!milestone) {
      return res.status(404).json({
        success: false,
        message: 'Milestone task not found'
      });
    }

    // 🏔️ MILESTONE UNLINK TASK VALIDATION (Doc Ref: 4.3.2)
    // "Only managers and organizational admins can establish milestone dependencies or subtasks."
    // Employee and Individual users CANNOT unlink tasks from milestones
    const userRoles = Array.isArray(userRole) ? userRole : [userRole];
    const isTasksetuAdmin = userRoles.includes('tasksetu-admin') || userRoles.includes('super-admin');
    const isOrgAdmin = userRoles.includes('org_admin') || userRoles.includes('company-admin') || userRoles.includes('admin');
    const isManager = userRoles.includes('manager');

    if (!isManager && !isOrgAdmin && !isTasksetuAdmin) {
      console.error('❌ Permission denied: Only Manager/Org Admin can unlink tasks from milestones');
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only Manager or Org Admin can unlink tasks from milestones. Employees can view linked tasks but cannot modify them.'
      });
    }

    console.log('✅ Unlink task permission granted for Manager/Admin');

    // Check access permissions (for viewing milestone)
    if (!canAccessMilestone(milestone, userId, userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have access to this milestone'
      });
    }

    // Unlink the task
    await milestone.unlinkTask(taskId, userId);

    // Populate and return updated milestone
    await milestone.populate([
      { path: 'creator', select: 'name email role' },
      { path: 'assignedTo', select: 'name email role' },
      { path: 'linkedTasks.taskId', select: 'title status priority dueDate' }
    ]);

    res.json({
      success: true,
      message: 'Task unlinked from milestone successfully',
      milestone
    });

  } catch (error) {
    console.error('❌ ERROR in unlinkTaskFromMilestone:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error unlinking task from milestone',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Add comment to milestone
// @route   POST /api/milestone-tasks/:id/comments
// @access  Private
const addCommentToMilestone = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const { comment } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid milestone task ID'
      });
    }

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment is required'
      });
    }

    const milestone = await MilestoneTask.findById(id);
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
        message: 'Access denied'
      });
    }

    // Add comment
    await milestone.addComment(userId, comment.trim());

    // Populate and return updated milestone
    await milestone.populate([
      { path: 'comments.user', select: 'name email' },
      { path: 'activityFeed.user', select: 'name email' }
    ]);

    res.json({
      success: true,
      message: 'Comment added successfully',
      milestone
    });

  } catch (error) {
    console.error('❌ ERROR in addCommentToMilestone:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding comment to milestone',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Mark milestone as achieved
// @route   PATCH /api/milestone-tasks/:id/achieve
// @access  Private
const markMilestoneAsAchieved = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const { forced = false } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid milestone task ID'
      });
    }

    const milestone = await MilestoneTask.findById(id);
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
        message: 'Access denied'
      });
    }

    // Mark as achieved
    await milestone.markAsAchieved(userId, forced);

    // Populate and return updated milestone
    await milestone.populate([
      { path: 'creator', select: 'name email role' },
      { path: 'assignedTo', select: 'name email role' },
      { path: 'linkedTasks.taskId', select: 'title status priority dueDate' }
    ]);

    res.json({
      success: true,
      message: 'Milestone marked as achieved successfully',
      milestone
    });

  } catch (error) {
    console.error('❌ ERROR in markMilestoneAsAchieved:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error marking milestone as achieved',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// @desc    Get milestone statistics
// @route   GET /api/milestone-tasks/stats
// @access  Private
const getMilestoneStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
    const organizationId = req.user.organizationId || req.user.orgId;

    const stats = await MilestoneTask.getMilestoneStats(userId, userRole, organizationId);

    const formattedStats = {
      total: stats[0]?.total || 0,
      byStatus: {
        OPEN: 0,
        INPROGRESS: 0,
        ACHIEVED: 0,
        CANCELLED: 0
      }
    };

    if (stats[0]?.stats) {
      stats[0].stats.forEach(stat => {
        formattedStats.byStatus[stat.status] = stat.count;
      });
    }

    res.json({
      success: true,
      stats: formattedStats
    });

  } catch (error) {
    console.error('❌ ERROR in getMilestoneStats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching milestone statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

export {
  createMilestoneTask,
  getMilestoneTasks,
  getMilestoneTask,
  updateMilestoneTask,
  deleteMilestoneTask,
  linkTaskToMilestone,
  unlinkTaskFromMilestone,
  addCommentToMilestone,
  markMilestoneAsAchieved,
  getMilestoneStats
};