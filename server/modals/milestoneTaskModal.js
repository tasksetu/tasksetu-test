import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     MilestoneTask:
 *       type: object
 *       required:
 *         - title
 *         - creator
 *         - assignedTo
 *       properties:
 *         _id:
 *           type: string
 *           format: objectId
 *           description: Unique identifier for the milestone task
 *         title:
 *           type: string
 *           minLength: 1
 *           maxLength: 200
 *           description: Title of the milestone task
 *         description:
 *           type: string
 *           maxLength: 2000
 *           description: Detailed description of the milestone
 *         creator:
 *           type: string
 *           format: objectId
 *           description: ID of the user who created this milestone (Manager/Admin)
 *         assignedTo:
 *           type: string
 *           format: objectId
 *           description: ID of the user assigned to this milestone
 *         status:
 *           type: string
 *           enum: [OPEN, INPROGRESS, ACHIEVED, CANCELLED]
 *           default: OPEN
 *           description: Current status of the milestone
 *         priority:
 *           type: string
 *           enum: [low, medium, high, critical]
 *           default: medium
 *           description: Priority level of the milestone
 *         dueDate:
 *           type: string
 *           format: date-time
 *           description: Due date for the milestone
 *         linkedTasks:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               taskId:
 *                 type: string
 *                 format: objectId
 *               taskTitle:
 *                 type: string
 *               taskType:
 *                 type: string
 *                 enum: [regular, recurring, approval]
 *               status:
 *                 type: string
 *               completionPercentage:
 *                 type: number
 *                 min: 0
 *                 max: 100
 *               linkedAt:
 *                 type: string
 *                 format: date-time
 *           description: Array of tasks linked to this milestone
 *         progressPercentage:
 *           type: number
 *           min: 0
 *           max: 100
 *           default: 0
 *           description: Auto-calculated progress based on linked tasks
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of tags for categorization
 *         attachments:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               filename:
 *                 type: string
 *               path:
 *                 type: string
 *               size:
 *                 type: number
 *               mimetype:
 *                 type: string
 *               uploadedAt:
 *                 type: string
 *                 format: date-time
 *           description: Array of attached files
 *         comments:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               user:
 *                 type: string
 *                 format: objectId
 *               comment:
 *                 type: string
 *               commentedAt:
 *                 type: string
 *                 format: date-time
 *           description: Array of comments on the milestone
 *         activityFeed:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *               user:
 *                 type: string
 *                 format: objectId
 *               details:
 *                 type: string
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *           description: Activity log for the milestone
 *         achievedAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when milestone was achieved
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *         isOverdue:
 *           type: boolean
 *           description: Whether milestone is overdue (virtual field)
 *         daysUntilDue:
 *           type: number
 *           description: Days until due date (virtual field)
 */

const milestoneTaskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Milestone title is required'],
    trim: true,
    minlength: [1, 'Title cannot be empty'],
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: [true, 'Organization is required'],
    index: true
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required'],
    index: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Assigned user is required'],
    index: true
  },
  status: {
    type: String,
    enum: {
      values: ['OPEN', 'INPROGRESS', 'ACHIEVED', 'CANCELLED'],
      message: 'Status must be one of: OPEN, INPROGRESS, ACHIEVED, CANCELLED'
    },
    default: 'OPEN',
    index: true
  },
  priority: {
    type: String,
    enum: {
      values: ['low', 'medium', 'high', 'critical', 'urgent'],
      message: 'Priority must be one of: low, medium, high, critical, urgent'
    },
    default: 'medium',
    index: true,
    lowercase: true,
    trim: true
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required for milestone'],
    index: true
  },
  linkedTasks: [{
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: true
    },
    taskTitle: {
      type: String,
      required: true
    },
    taskType: {
      type: String,
      enum: ['regular', 'recurring', 'approval'],
      required: true
    },
    status: {
      type: String,
      default: 'OPEN'
    },
    completionPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    linkedAt: {
      type: Date,
      default: Date.now
    }
  }],
  progressPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
    index: true
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag cannot exceed 50 characters']
  }],
  attachments: [{
    filename: {
      type: String,
      required: true
    },
    path: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    mimetype: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    comment: {
      type: String,
      required: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters']
    },
    commentedAt: {
      type: Date,
      default: Date.now
    }
  }],
  activityFeed: [{
    action: {
      type: String,
      required: true,
      enum: ['created', 'task_linked', 'task_unlinked', 'task_completed', 'status_changed', 'comment_added', 'achieved', 'cancelled']
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    details: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  achievedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
milestoneTaskSchema.index({ creator: 1, status: 1 });
milestoneTaskSchema.index({ assignedTo: 1, status: 1 });
milestoneTaskSchema.index({ creator: 1, createdAt: -1 });
milestoneTaskSchema.index({ assignedTo: 1, dueDate: 1 });
milestoneTaskSchema.index({ status: 1, dueDate: 1 });
milestoneTaskSchema.index({ tags: 1 });
milestoneTaskSchema.index({ 'linkedTasks.taskId': 1 });

// Virtual for overdue status
milestoneTaskSchema.virtual('isOverdue').get(function () {
  if (!this.dueDate) return false;
  return this.status !== 'ACHIEVED' && this.status !== 'CANCELLED' && new Date() > this.dueDate;
});

// Virtual for days until due
milestoneTaskSchema.virtual('daysUntilDue').get(function () {
  if (!this.dueDate) return null;
  const diff = this.dueDate - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to calculate progress
milestoneTaskSchema.pre('save', function (next) {
  // Calculate progress percentage based on linked tasks
  if (this.linkedTasks && this.linkedTasks.length > 0) {
    const totalCompletion = this.linkedTasks.reduce((sum, task) => sum + task.completionPercentage, 0);
    this.progressPercentage = Math.round(totalCompletion / this.linkedTasks.length);
  } else {
    this.progressPercentage = 0;
  }

  // Auto-achieve milestone if all linked tasks are completed
  if (this.progressPercentage === 100 && this.status !== 'ACHIEVED' && this.status !== 'CANCELLED') {
    this.status = 'ACHIEVED';
    this.achievedAt = new Date();

    // Add activity log
    this.activityFeed.push({
      action: 'achieved',
      user: this.assignedTo,
      details: 'Milestone automatically achieved - all linked tasks completed',
      timestamp: new Date()
    });
  }

  // Set achievedAt when status changes to ACHIEVED
  if (this.isModified('status') && this.status === 'ACHIEVED' && !this.achievedAt) {
    this.achievedAt = new Date();
  }

  // Clear achievedAt if status changes from ACHIEVED
  if (this.isModified('status') && this.status !== 'ACHIEVED' && this.achievedAt) {
    this.achievedAt = undefined;
  }

  next();
});

// Static methods
milestoneTaskSchema.statics.getMilestonesByUser = function (userId, role, options = {}) {
  const {
    status,
    priority,
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    search,
    tags,
    overdue,
    organizationId
  } = options;

  let query = {};

  // Normalize role to array for consistent checking
  const roles = Array.isArray(role) ? role : [role];
  const isPrivileged = roles.some(r => ['manager', 'org_admin', 'super_admin', 'admin'].includes(r));

  // Role-based access control
  if (isPrivileged && organizationId) {
    // Managers and Admins can see all milestones in their organization
    query.organization = organizationId;
  } else if (isPrivileged) {
    // Fallback for older milestones without organization field
    query.$or = [
      { creator: userId },
      { assignedTo: userId }
    ];
  } else {
    // Other users can only see milestones assigned to them
    query.assignedTo = userId;
  }

  // Add filters
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (tags && tags.length > 0) query.tags = { $in: tags };

  // Search in title and description
  if (search) {
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ]
    });
  }

  // Filter overdue milestones
  if (overdue === true) {
    query.dueDate = { $lt: new Date() };
    query.status = { $nin: ['ACHIEVED', 'CANCELLED'] };
  }

  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  return this.find(query)
    .sort(sort)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate('creator', 'firstName lastName email role')
    .populate('assignedTo', 'firstName lastName email role')
    .populate('linkedTasks.taskId', 'title status priority dueDate')
    .exec();
};

milestoneTaskSchema.statics.getMilestoneStats = function (userId, role, organizationId) {
  let matchQuery = {};

  // Normalize role to array for consistent checking
  const roles = Array.isArray(role) ? role : [role];
  const isPrivileged = roles.some(r => ['manager', 'org_admin', 'super_admin', 'admin'].includes(r));

  // Role-based access control
  if (isPrivileged && organizationId) {
    // Managers and Admins can see all milestones in their organization
    matchQuery.organization = new mongoose.Types.ObjectId(organizationId);
  } else if (isPrivileged) {
    // Fallback for older milestones without organization field
    matchQuery.$or = [
      { creator: new mongoose.Types.ObjectId(userId) },
      { assignedTo: new mongoose.Types.ObjectId(userId) }
    ];
  } else {
    matchQuery.assignedTo = new mongoose.Types.ObjectId(userId);
  }

  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$count' },
        stats: {
          $push: {
            status: '$_id',
            count: '$count'
          }
        }
      }
    }
  ]);
};

// Instance methods
milestoneTaskSchema.methods.linkTask = function (taskData) {
  // Check if task is already linked
  const existingLink = this.linkedTasks.find(link =>
    link.taskId.toString() === taskData.taskId.toString()
  );

  if (existingLink) {
    throw new Error('Task is already linked to this milestone');
  }

  this.linkedTasks.push({
    taskId: taskData.taskId,
    taskTitle: taskData.taskTitle,
    taskType: taskData.taskType,
    status: taskData.status || 'OPEN',
    completionPercentage: taskData.completionPercentage || 0
  });

  // Add activity log
  this.activityFeed.push({
    action: 'task_linked',
    user: taskData.linkedBy || this.creator,
    details: `Task "${taskData.taskTitle}" linked to milestone`,
    timestamp: new Date()
  });

  return this.save();
};

milestoneTaskSchema.methods.unlinkTask = function (taskId, unlinkedBy) {
  const taskIndex = this.linkedTasks.findIndex(link =>
    link.taskId.toString() === taskId.toString()
  );

  if (taskIndex === -1) {
    throw new Error('Task is not linked to this milestone');
  }

  const taskTitle = this.linkedTasks[taskIndex].taskTitle;
  this.linkedTasks.splice(taskIndex, 1);

  // Add activity log
  this.activityFeed.push({
    action: 'task_unlinked',
    user: unlinkedBy || this.creator,
    details: `Task "${taskTitle}" unlinked from milestone`,
    timestamp: new Date()
  });

  return this.save();
};

milestoneTaskSchema.methods.updateLinkedTaskStatus = function (taskId, status, completionPercentage) {
  const linkedTask = this.linkedTasks.find(link =>
    link.taskId.toString() === taskId.toString()
  );

  if (!linkedTask) {
    throw new Error('Task is not linked to this milestone');
  }

  linkedTask.status = status;
  linkedTask.completionPercentage = completionPercentage;

  // Add activity log if task is completed
  if (status === 'DONE' || completionPercentage === 100) {
    this.activityFeed.push({
      action: 'task_completed',
      user: this.assignedTo,
      details: `Linked task "${linkedTask.taskTitle}" completed`,
      timestamp: new Date()
    });
  }

  return this.save();
};

milestoneTaskSchema.methods.addComment = function (userId, comment) {
  this.comments.push({
    user: userId,
    comment: comment,
    commentedAt: new Date()
  });

  // Add activity log
  this.activityFeed.push({
    action: 'comment_added',
    user: userId,
    details: `Comment added: "${comment.substring(0, 50)}${comment.length > 50 ? '...' : ''}"`,
    timestamp: new Date()
  });

  return this.save();
};

milestoneTaskSchema.methods.markAsAchieved = function (userId, forced = false) {
  if (!forced && this.progressPercentage < 100) {
    throw new Error('Cannot mark milestone as achieved - not all linked tasks are complete');
  }

  this.status = 'ACHIEVED';
  this.achievedAt = new Date();

  // Add activity log
  this.activityFeed.push({
    action: 'achieved',
    user: userId,
    details: forced ? 'Milestone manually marked as achieved' : 'Milestone achieved - all linked tasks completed',
    timestamp: new Date()
  });

  return this.save();
};

const MilestoneTask = mongoose.model('MilestoneTask', milestoneTaskSchema);

export { MilestoneTask };