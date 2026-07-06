const mongoose = require('mongoose');

const quickTaskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Quick task title is required'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Quick task must belong to a user']
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

  status: {
    type: String,
    enum: {
      values: ['open', 'done', 'archived'],
      message: 'Status must be either open, done, or archived'
    },
    default: 'open'
  },

  dueDate: {
    type: Date,
    default: null
  },

  completedAt: {
    type: Date,
    default: null
  },

  archivedAt: {
    type: Date,
    default: null
  },

  // Conversion tracking
  conversionFlag: {
    isConverted: {
      type: Boolean,
      default: false
    },
    convertedToTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null
    },
    convertedToTaskType: {
      type: String,
      enum: ['regular', 'recurring', 'milestone', 'approval'],
      default: null
    },
    convertedAt: {
      type: Date,
      default: null
    }
  },

  // Reminder settings (optional)
  reminder: {
    enabled: {
      type: Boolean,
      default: false
    },
    reminderDate: {
      type: Date,
      default: null
    },
    reminderType: {
      type: String,
      enum: ['same_day', 'one_day_before'],
      default: 'same_day'
    }
  },

  // Optional attachments for personal reference
  attachments: [{
    filename: String,
    originalName: String,
    path: String,
    size: Number,
    mimetype: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Metadata
  isPrivate: {
    type: Boolean,
    default: true // Quick tasks are always private
  },

  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],

  notes: {
    type: String,
    maxlength: 1000,
    default: ''
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
quickTaskSchema.index({ createdBy: 1, status: 1 });
quickTaskSchema.index({ createdBy: 1, dueDate: 1 });
quickTaskSchema.index({ createdBy: 1, priority: 1 });
quickTaskSchema.index({ createdBy: 1, createdAt: -1 });

// Virtual for task age
quickTaskSchema.virtual('taskAge').get(function () {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24)); // days
});

// Virtual for overdue status
quickTaskSchema.virtual('isOverdue').get(function () {
  if (!this.dueDate || this.status === 'done') return false;
  return new Date() > this.dueDate;
});

// Virtual for days until due
quickTaskSchema.virtual('daysUntilDue').get(function () {
  if (!this.dueDate) return null;
  const diffTime = this.dueDate - Date.now();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware
quickTaskSchema.pre('save', function (next) {
  // Set completedAt when status changes to done
  if (this.isModified('status')) {
    if (this.status === 'done' && !this.completedAt) {
      this.completedAt = new Date();
    } else if (this.status !== 'done') {
      this.completedAt = null;
    }

    // Set archivedAt when status changes to archived
    if (this.status === 'archived' && !this.archivedAt) {
      this.archivedAt = new Date();
    } else if (this.status !== 'archived') {
      this.archivedAt = null;
    }
  }

  next();
});

// Static methods
quickTaskSchema.statics.getTasksByUser = async function (userId, filters = {}) {
  const query = { createdBy: userId };

  // Apply filters
  if (filters.status && filters.status !== 'all') {
    query.status = filters.status;
  }

  if (filters.priority && filters.priority !== 'all') {
    query.priority = filters.priority;
  }

  if (filters.dueDate) {
    const { default: TimezoneHelper } = await import('../utils/timezoneHelper.js');
    const userTimezone = await TimezoneHelper.getUserTimezone(userId);
    const { startOfDay: today, endOfDay: todayEnd } = TimezoneHelper.getDayBoundaries(userTimezone);

    switch (filters.dueDate) {
      case 'today':
        query.dueDate = {
          $gte: today,
          $lte: todayEnd
        };
        break;
      case 'overdue':
        query.dueDate = { $lt: today };
        query.status = { $ne: 'done' };
        break;
      case 'this_week':
        const weekEndRef = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        const { endOfDay: weekEnd } = TimezoneHelper.getDayBoundaries(userTimezone, weekEndRef);
        query.dueDate = {
          $gte: today,
          $lte: weekEnd
        };
        break;
    }
  }

  return this.find(query).sort({ createdAt: -1 });
};

quickTaskSchema.statics.getTaskStats = function (userId) {
  return this.aggregate([
    { $match: { createdBy: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] }
        },
        pending: {
          $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
        },
        archived: {
          $sum: { $cond: [{ $eq: ['$status', 'archived'] }, 1, 0] }
        },
        highPriority: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$priority', 'high'] },
                  { $ne: ['$status', 'done'] }
                ]
              },
              1,
              0
            ]
          }
        },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$status', 'done'] },
                  { $ne: ['$dueDate', null] },
                  { $lt: ['$dueDate', new Date()] }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    }
  ]);
};

// Instance methods
quickTaskSchema.methods.markAsDone = function () {
  this.status = 'done';
  this.completedAt = new Date();
  return this.save();
};

quickTaskSchema.methods.markAsOpen = function () {
  this.status = 'open';
  this.completedAt = null;
  return this.save();
};

quickTaskSchema.methods.archive = function () {
  this.status = 'archived';
  this.archivedAt = new Date();
  return this.save();
};

quickTaskSchema.methods.convertToTask = function (taskData) {
  this.conversionFlag.isConverted = true;
  this.conversionFlag.convertedToTaskId = taskData.taskId;
  this.conversionFlag.convertedToTaskType = taskData.taskType;
  this.conversionFlag.convertedAt = new Date();
  return this.save();
};

const QuickTask = mongoose.model('QuickTask', quickTaskSchema);

module.exports = QuickTask;