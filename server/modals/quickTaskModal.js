import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     QuickTask:
 *       type: object
 *       required:
 *         - title
 *         - user
 *       properties:
 *         _id:
 *           type: string
 *           format: objectId
 *           description: Unique identifier for the quick task
 *         title:
 *           type: string
 *           minLength: 1
 *           maxLength: 200
 *           description: Title of the quick task
 *         description:
 *           type: string
 *           maxLength: 1000
 *           description: Optional description of the quick task
 *         user:
 *           type: string
 *           format: objectId
 *           description: ID of the user who owns this quick task
 *         status:
 *           type: string
 *           enum: [pending, in-progress, done]
 *           default: pending
 *           description: Current status of the quick task
 *         priority:
 *           type: string
 *           enum: [low, medium, high]
 *           default: medium
 *           description: Priority level of the quick task
 *         dueDate:
 *           type: string
 *           format: date-time
 *           description: Optional due date for the quick task
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
 *           description: Array of attached files
 *         reminder:
 *           type: object
 *           properties:
 *             enabled:
 *               type: boolean
 *               default: false
 *             date:
 *               type: string
 *               format: date-time
 *           description: Reminder settings
 *         convertedToTask:
 *           type: object
 *           properties:
 *             isConverted:
 *               type: boolean
 *               default: false
 *             taskId:
 *               type: string
 *               format: objectId
 *             convertedAt:
 *               type: string
 *               format: date-time
 *           description: Conversion tracking to full task
 *         completedAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when task was completed
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *         taskAge:
 *           type: number
 *           description: Age of task in days (virtual field)
 *         isOverdue:
 *           type: boolean
 *           description: Whether task is overdue (virtual field)
 *         daysUntilDue:
 *           type: number
 *           description: Days until due date (virtual field)
 */

const quickTaskSchema = new mongoose.Schema({
    createdByRole: {
      type: [String],
      default: []
    },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    minlength: [1, 'Title cannot be empty'],
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'in-progress', 'done'],
      message: 'Status must be one of: pending, in-progress, done'
    },
    default: 'pending'
  },
  priority: {
    type: String,
    enum: {
      values: ['low', 'medium', 'high', 'critical', 'urgent'],
      message: 'Priority must be one of: low, medium, high, critical, urgent'
    },
    default: 'medium',
    lowercase: true,
    trim: true
  },
  dueDate: {
    type: Date
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
  reminder: {
    enabled: {
      type: Boolean,
      default: false
    },
    date: {
      type: Date
    }
  },
  convertedToTask: {
    isConverted: {
      type: Boolean,
      default: false
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task'
    },
    convertedAt: {
      type: Date
    }
  },
  completedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
quickTaskSchema.index({ user: 1, status: 1 });
quickTaskSchema.index({ user: 1, createdAt: -1 });
quickTaskSchema.index({ user: 1, dueDate: 1 });
quickTaskSchema.index({ user: 1, priority: 1 });
quickTaskSchema.index({ tags: 1 });

// Virtual for task age in days
quickTaskSchema.virtual('taskAge').get(function() {
  return Math.floor((new Date() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual for overdue status
quickTaskSchema.virtual('isOverdue').get(function() {
  if (!this.dueDate) return false;
  return this.status !== 'done' && new Date() > this.dueDate;
});

// Virtual for days until due
quickTaskSchema.virtual('daysUntilDue').get(function() {
  if (!this.dueDate) return null;
  const diff = this.dueDate - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Pre-save middleware
quickTaskSchema.pre('save', function(next) {
  // Set completedAt when status changes to done
  if (this.isModified('status') && this.status === 'done' && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  // Clear completedAt if status changes from done
  if (this.isModified('status') && this.status !== 'done' && this.completedAt) {
    this.completedAt = undefined;
  }
  
  next();
});

// Static methods
quickTaskSchema.statics.getTasksByUser = function(userId, options = {}) {
  const {
    status,
    priority,
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    search,
    tags,
    overdue
  } = options;

  const query = { user: userId };
  
  // Add filters
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (tags && tags.length > 0) query.tags = { $in: tags };
  
  // Search in title and description
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }
  
  // Filter overdue tasks
  if (overdue === true) {
    query.dueDate = { $lt: new Date() };
    query.status = { $ne: 'done' };
  }

  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  return this.find(query)
    .sort(sort)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate('user', 'name email')
    .exec();
};

quickTaskSchema.statics.getTaskStats = function(userId) {
  return this.aggregate([
    { $match: { user: mongoose.Types.ObjectId(userId) } },
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
quickTaskSchema.methods.markAsDone = function() {
  this.status = 'done';
  this.completedAt = new Date();
  return this.save();
};

quickTaskSchema.methods.convertToTask = function(taskData = {}) {
  // This method would be called when converting to a full task
  // The actual Task creation would be handled in the controller
  this.convertedToTask.isConverted = true;
  this.convertedToTask.convertedAt = new Date();
  return this.save();
};

const QuickTask = mongoose.model('QuickTask', quickTaskSchema);

export { QuickTask };