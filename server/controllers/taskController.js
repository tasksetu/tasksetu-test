// Add this status color mapping at the top of the file

const statusColorMap = {
  // Task Status Colors
  'pending': '#f59e0b',      // amber-500
  'in_progress': '#3b82f6',  // blue-500
  'completed': '#10b981',    // emerald-500
  'cancelled': '#ef4444',    // red-500
  'on_hold': '#6b7280',      // gray-500
  'overdue': '#dc2626',      // red-600
  'review': '#8b5cf6',       // violet-500
  'approved': '#059669',     // emerald-600
  'rejected': '#dc2626',     // red-600
  
  // Priority Colors
  'low': '#22c55e',          // green-500
  'medium': '#f59e0b',       // amber-500
  'high': '#f97316',         // orange-500
  'critical': '#ef4444',     // red-500
  
  // Task Type Colors
  'regular': '#3B82F6',      // Blue
  'recurring': '#8B5CF6',    // Purple
  'milestone': '#10B981',    // Green
  'approval': '#F59E0B',     // Amber/Yellow
  
  // Approval Status Colors
  'pending_approval': '#f59e0b',     // amber-500
  'partially_approved': '#8b5cf6',   // violet-500
  'fully_approved': '#059669',       // emerald-600
  'approval_rejected': '#dc2626',    // red-600
  'auto_approved': '#6366f1',        // indigo-500
};

// Helper function to determine task status
const getTaskStatus = (task) => {
  const now = new Date();
  const dueDate = new Date(task.dueDate);
  
  // Check if task is completed
  if (task.status === 'completed') {
    return 'completed';
  }
  
  // Check if task is cancelled
  if (task.status === 'cancelled') {
    return 'cancelled';
  }
  
  // Check if task is on hold
  if (task.status === 'on_hold') {
    return 'on_hold';
  }
  
  // For approval tasks, check approval status
  if (task.taskType === 'approval' && task.approval) {
    if (task.approval.status === 'rejected') {
      return 'approval_rejected';
    }
    if (task.approval.status === 'approved') {
      return 'fully_approved';
    }
    if (task.approval.status === 'partially_approved') {
      return 'partially_approved';
    }
    if (task.approval.status === 'pending') {
      // Check if overdue
      if (dueDate < now) {
        return 'overdue';
      }
      return 'pending_approval';
    }
  }
  
  // Check if task is overdue
  if (dueDate < now && task.status !== 'completed') {
    return 'overdue';
  }
  
  // Check if task is in progress
  if (task.status === 'in_progress') {
    return 'in_progress';
  }
  
  // Check if task is in review
  if (task.status === 'review') {
    return 'review';
  }
  
  // Default to pending
  return 'pending';
};

// Helper function to get color for any status/priority/type
const getStatusColor = (statusKey) => {
  return statusColorMap[statusKey] || '#6b7280'; // default gray
};

// Enhanced task formatting function
const formatTaskResponse = (task) => {
  const currentStatus = getTaskStatus(task);
  
  return {
    id: task._id,
    title: task.title,
    description: task.description,
    taskType: task.taskType,
    priority: task.priority,
    status: currentStatus,
    assignedTo: task.assignedTo ? {
      id: task.assignedTo._id,
      name: task.assignedTo.name,
      email: task.assignedTo.email,
      avatar: task.assignedTo.avatar
    } : null,
    createdBy: task.createdBy ? {
      id: task.createdBy._id,
      name: task.createdBy.name,
      email: task.createdBy.email
    } : null,
    dueDate: task.dueDate,
    startDate: task.startDate,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    
    // Color information
    statusColor: getStatusColor(currentStatus),
    priorityColor: getStatusColor(task.priority),
    typeColor: getStatusColor(task.taskType),
    
    // Additional task-specific data
    ...(task.taskType === 'approval' && task.approval && {
      approval: {
        ...task.approval,
        statusColor: getStatusColor(task.approval.status || 'pending_approval')
      }
    }),
    
    ...(task.taskType === 'milestone' && task.milestone && {
      milestone: task.milestone
    }),
    
    ...(task.taskType === 'recurring' && task.recurrencePattern && {
      recurrencePattern: task.recurrencePattern
    }),
    
    // Progress and completion info
    progress: task.progress || 0,
    isOverdue: currentStatus === 'overdue',
    isCompleted: currentStatus === 'completed',
    
    // Collaborators and tags
    collaborators: task.collaborators || [],
    tags: task.tags || [],
    attachments: task.attachments || [],
    
    // Visibility and category
    visibility: task.visibility || 'private',
    category: task.category || 'general'
  };
};

// Updated getTasksByType function
export const getTasksByType = async (req, res) => {
  try {
    const { type } = req.params;
    const { page = 1, limit = 20, status, priority, assignedTo, search } = req.query;
    const userId = req.user.id;
    
    // Validate task type
    const validTypes = ['regular', 'recurring', 'milestone', 'approval'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task type'
      });
    }
    
    // Build query
    let query = {
      taskType: type,
      parentTaskId: { $exists: false }, // Exclude subtasks, only parent tasks
      $or: [
        { createdBy: userId },
        { assignedTo: userId },
        { 'collaborators.user': userId },
        { visibility: 'public' }
      ]
    };
    
    // Add filters
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (priority && priority !== 'all') {
      query.priority = priority;
    }
    
    if (assignedTo && assignedTo !== 'all') {
      query.assignedTo = assignedTo;
    }
    
    if (search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ]
      });
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Execute query with population
    const [tasks, totalCount] = await Promise.all([
      Task.find(query)
        .populate('assignedTo', 'name email avatar')
        .populate('createdBy', 'name email')
        .populate('collaborators.user', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Task.countDocuments(query)
    ]);
    
    // Format tasks with status colors and additional info
    const formattedTasks = tasks.map(formatTaskResponse);
    
    // Calculate statistics
    const stats = {
      total: totalCount,
      completed: formattedTasks.filter(t => t.status === 'completed').length,
      pending: formattedTasks.filter(t => t.status === 'pending').length,
      overdue: formattedTasks.filter(t => t.isOverdue).length,
      inProgress: formattedTasks.filter(t => t.status === 'in_progress').length
    };
    
    // Type-specific stats
    if (type === 'approval') {
      stats.pendingApproval = formattedTasks.filter(t => t.status === 'pending_approval').length;
      stats.approved = formattedTasks.filter(t => t.status === 'fully_approved').length;
      stats.rejected = formattedTasks.filter(t => t.status === 'approval_rejected').length;
    }
    
    res.status(200).json({
      success: true,
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} tasks retrieved successfully`,
      data: {
        tasks: formattedTasks,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalItems: totalCount,
          itemsPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < Math.ceil(totalCount / parseInt(limit)),
          hasPrevPage: parseInt(page) > 1
        },
        stats,
        filters: {
          type,
          status: status || 'all',
          priority: priority || 'all',
          assignedTo: assignedTo || 'all',
          search: search || ''
        }
      }
    });
    
  } catch (error) {
    console.error('Error in getTasksByType:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks by type',
      error: error.message
    });
  }
};

// Also add this helper function for getting all task statistics
export const getTaskStatistics = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get all tasks for user
    const userTasks = await Task.find({
      $or: [
        { createdBy: userId },
        { assignedTo: userId },
        { 'collaborators.user': userId }
      ]
    }).lean();
    
    // Calculate comprehensive statistics
    const stats = {
      total: userTasks.length,
      byType: {
        regular: userTasks.filter(t => t.taskType === 'regular').length,
        recurring: userTasks.filter(t => t.taskType === 'recurring').length,
        milestone: userTasks.filter(t => t.taskType === 'milestone').length,
        approval: userTasks.filter(t => t.taskType === 'approval').length
      },
      byStatus: {},
      byPriority: {
        low: userTasks.filter(t => t.priority === 'low').length,
        medium: userTasks.filter(t => t.priority === 'medium').length,
        high: userTasks.filter(t => t.priority === 'high').length,
        critical: userTasks.filter(t => t.priority === 'critical').length
      }
    };
    
    // Calculate status distribution
    const tasksWithStatus = userTasks.map(task => ({
      ...task,
      computedStatus: getTaskStatus(task)
    }));
    
    stats.byStatus = {
      pending: tasksWithStatus.filter(t => t.computedStatus === 'pending').length,
      in_progress: tasksWithStatus.filter(t => t.computedStatus === 'in_progress').length,
      completed: tasksWithStatus.filter(t => t.computedStatus === 'completed').length,
      overdue: tasksWithStatus.filter(t => t.computedStatus === 'overdue').length,
      cancelled: tasksWithStatus.filter(t => t.computedStatus === 'cancelled').length,
      on_hold: tasksWithStatus.filter(t => t.computedStatus === 'on_hold').length
    };
    
    res.status(200).json({
      success: true,
      message: 'Task statistics retrieved successfully',
      data: {
        statistics: stats,
        colorMap: statusColorMap
      }
    });
    
  } catch (error) {
    console.error('Error in getTaskStatistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch task statistics',
      error: error.message
    });
  }
};