import express from "express";
import multer from "multer";
import { authenticateToken } from "../middleware/roleAuth.js";
import { upload, commentUpload } from "../utils/upload.js";
import { checkFeatureAccess, trackFeatureUsage, checkDynamicTaskFeature } from "../middleware/licenseMiddleware.js";

// console.log('📦 [MODULE LOAD] taskRoutes.js is being loaded');
// console.log('📦 [MODULE LOAD] checkFeatureAccess middleware imported:', typeof checkFeatureAccess);
// console.log('📦 [MODULE LOAD] checkDynamicTaskFeature middleware imported:', typeof checkDynamicTaskFeature);

import {
  createTask,
  createSubtask,
  getSubtasks,
  updateSubtask,
  deleteSubtask,
  addSubtaskComment,
  getSubtaskComments,
  updateSubtaskComment,
  deleteSubtaskComment,
  replyToSubtaskComment,
  addTaskComment,
  getTaskComments,
  updateTaskComment,
  deleteTaskComment,
  replyToTaskComment,
  getTasks,
  getTaskById,
  updateTask,
  updateTaskStatus,
  deleteTask,
  approveOrRejectTask,
  getTasksByType,
  getMyTasks,
  getTeamTasks, // Phase I RBAC: Manager Team Tasks endpoint
  snoozeTask,
  unsnoozeTask,
  markTaskAsRisk,
  unmarkTaskAsRisk,
  quickMarkAsDone,
  getTaskActivities,
  getOrganizationActivities,
  getRecentActivities,
  getTaskAttachments,
  addTaskAttachments,
  deleteTaskAttachment,
  debugActivities,
  // 🎯 Milestone Linked Tasks APIs
  getAvailableTasksForLinking,
  linkTaskToMilestone,
  unlinkTaskFromMilestone,
  getMilestoneLinkedTasks,
  // 📅 Overdue Tasks APIs
  getOverdueTasks,
  getOverdueTaskStats,
  getTrashedTasks
} from "../controller/taskController.js";

const router = express.Router();

// NOTE: Quick Tasks API is handled by /api/quick-tasks routes (quickTaskRoutes.js)
// Do NOT add a duplicate quick-tasks route here to avoid conflicts

// Recover a soft-deleted (trashed) task
router.post("/tasks/:taskId/recover", authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;
    const Task = (await import("../modals/taskModal.js")).default;
    // Find the task and ensure it is soft-deleted
    const task = await Task.findOne({ _id: taskId, isDeleted: true });
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found or not deleted" });
    }
    // Restore the task
    task.isDeleted = false;
    task.deletedAt = null;
    task.deletedBy = null;
    await task.save();
    res.json({ success: true, message: "Task recovered successfully", data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to recover task", error: error.message });
  }
});
// Get trashed (soft-deleted) tasks for current user
router.get("/tasks/trash", authenticateToken, getTrashedTasks);

// Permanently delete a trashed (soft-deleted) task
router.delete("/tasks/:taskId/delete-forever", authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;
    const Task = (await import("../modals/taskModal.js")).default;
    // Find the task and ensure it is soft-deleted
    const task = await Task.findOne({ _id: taskId, isDeleted: true });
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found or not deleted" });
    }
    // Permanently delete the task
    await Task.deleteOne({ _id: taskId });
    res.json({ success: true, message: "Task permanently deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to permanently delete task", error: error.message });
  }
});

/**
 * @swagger
 * /api/create-task:
 *   post:
 *     summary: Create a new task (regular, recurring, milestone, approval)
 *     description: |
 *       Creates a comprehensive task with support for different task types including regular tasks, recurring tasks, milestone tracking, and approval workflows.
 *       
 *       **Note**: The `createdByRole` field should be provided in the request to specify the role of the user creating the task.
 *     tags:
 *       - Tasks
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 description: Task title
 *                 example: "Complete quarterly report"
 *               description:
 *                 type: string
 *                 description: Detailed task description
 *                 example: "Prepare and submit the Q4 financial report"
 *               taskType:
 *                 type: string
 *                 enum: ["regular", "recurring", "milestone", "approval"]
 *                 description: Type of task
 *                 example: "regular"
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 description: Task due date
 *                 example: "2025-12-31T23:59:59.000Z"
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 description: Task start date
 *                 example: "2025-01-01T09:00:00.000Z"
 *               priority:
 *                 type: string
 *                 enum: ["low", "medium", "high", "urgent"]
 *                 description: Task priority level
 *                 example: "high"
 *               category:
 *                 type: string
 *                 description: Task category
 *                 example: "Finance"
 *               assignedTo:
 *                 type: string
 *                 description: User ID of the assigned person
 *                 example: "507f1f77bcf86cd799439011"
 *               createdByRole:
 *                 type: string
 *                 enum: ["super_admin", "org_admin", "manager", "individual", "employee"]
 *                 description: Role of the user creating the task
 *                 example: "manager"
 *               status:
 *                 type: string
 *                 enum: ["todo", "in-progress", "completed", "on-hold", "cancelled"]
 *                 description: Current task status
 *                 example: "todo"
 *               visibility:
 *                 type: string
 *                 enum: ["private", "public", "team"]
 *                 description: Task visibility level
 *                 example: "team"
 *               tags:
 *                 type: string
 *                 description: JSON array string of task tags
 *                 example: '["urgent", "finance", "quarterly"]'
 *               collaboratorIds:
 *                 type: string
 *                 description: JSON array string of collaborator user IDs
 *                 example: '["507f1f77bcf86cd799439012", "507f1f77bcf86cd799439013"]'
 *               dependsOnTaskIds:
 *                 type: string
 *                 description: JSON array string of task IDs this task depends on
 *                 example: '["507f1f77bcf86cd799439014", "507f1f77bcf86cd799439015"]'
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: File attachments for the task
 *               recurrencePattern:
 *                 type: string
 *                 description: JSON object string for recurring task pattern
 *                 example: '{"frequency": "weekly", "interval": 1, "daysOfWeek": [1, 3, 5]}'
 *               milestoneData:
 *                 type: string
 *                 description: JSON object string for milestone-specific data
 *                 example: '{"deliverables": ["Report", "Presentation"], "stakeholders": ["Manager", "Client"]}'
 *               approvalData:
 *                 type: string
 *                 description: JSON object string for approval-specific data
 *                 example: '{"approvalType": "sequential", "requiredApprovals": 2}'
 *               approverIds:
 *                 type: string
 *                 description: JSON array string of approver user IDs (for approval tasks)
 *                 example: '["507f1f77bcf86cd799439016", "507f1f77bcf86cd799439017"]'
 *               linkedTaskIds:
 *                 type: string
 *                 description: JSON array string of linked task IDs (for milestone tasks)
 *                 example: '["507f1f77bcf86cd799439018", "507f1f77bcf86cd799439019"]'
 *               referenceProcess:
 *                 type: string
 *                 description: Reference to a process or workflow template
 *                 example: "standard-reporting-process"
 *               customForm:
 *                 type: string
 *                 description: Custom form data or template reference
 *                 example: "quarterly-report-form"
 *     responses:
 *       201:
 *         description: Task created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Task created successfully"
 *                 task:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439020"
 *                     title:
 *                       type: string
 *                       example: "Complete quarterly report"
 *                     description:
 *                       type: string
 *                       example: "Prepare and submit the Q4 financial report"
 *                     status:
 *                       type: string
 *                       example: "todo"
 *                     priority:
 *                       type: string
 *                       example: "high"
 *                     createdBy:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439010"
 *                     createdByRole:
 *                       type: string
 *                       enum: ["super_admin", "org_admin", "manager", "individual", "employee"]
 *                       example: "manager"
 *                       description: "Role of the user who created the task"
 *                     taskType:
 *                       type: string
 *                       enum: ["regular", "recurring", "milestone", "approval"]
 *                       example: "regular"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-09-18T10:30:00.000Z"
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Invalid input data"
 *                 error:
 *                   type: string
 *                   example: "Title is required"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Unauthorized access"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Failed to create task"
 *                 error:
 *                   type: string
 *                   example: "Database connection error"
 */
router.post("/create-task",
  (req, res, next) => {
    console.log('🎯 [ROUTE DEBUG] /api/create-task route HIT in taskRoutes.js');
    next();
  },
  authenticateToken,
  upload.array('attachments', 5),  // Parse form-data BEFORE feature check (need taskType)
  checkDynamicTaskFeature(),  // ✅ Dynamic check based on taskType (TASK_BASIC, TASK_RECUR, TASK_APPROVAL, TASK_MSTONE)
  createTask  // Controller creates the task (consumption happens in controller)
);

/**
 * @swagger
 * /api/tasks/{parentTaskId}/create-subtask:
 *   post:
 *     summary: Create a new subtask under a parent task
 *     description: |
 *       Creates a subtask that belongs to a parent task. The subtask inherits the organization from the parent task and maintains a reference to it.
 *       Only users with access to the parent task can create subtasks.
 *     tags:
 *       - Tasks
 *       - Subtasks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: parentTaskId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the parent task
 *         example: "507f1f77bcf86cd799439020"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 description: Subtask title
 *                 example: "Review documentation"
 *               description:
 *                 type: string
 *                 description: Detailed subtask description
 *                 example: "Review and update the project documentation"
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 description: Subtask due date
 *                 example: "2025-12-31T23:59:59.000Z"
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 description: Subtask start date
 *                 example: "2025-01-01T09:00:00.000Z"
 *               priority:
 *                 type: string
 *                 enum: ["low", "medium", "high", "urgent"]
 *                 description: Subtask priority level
 *                 example: "medium"
 *               category:
 *                 type: string
 *                 description: Subtask category
 *                 example: "Documentation"
 *               assignedTo:
 *                 type: string
 *                 description: User ID of the assigned person
 *                 example: "507f1f77bcf86cd799439011"
 *               createdByRole:
 *                 type: string
 *                 enum: ["super_admin", "org_admin", "manager", "individual", "employee"]
 *                 description: Role of the user creating the subtask
 *                 example: "manager"
 *               status:
 *                 type: string
 *                 enum: ["todo", "in-progress", "completed", "on-hold", "cancelled"]
 *                 description: Current subtask status
 *                 example: "todo"
 *               visibility:
 *                 type: string
 *                 enum: ["private", "public", "team"]
 *                 description: Subtask visibility level
 *                 example: "private"
 *               tags:
 *                 type: string
 *                 description: JSON array string of subtask tags
 *                 example: '["review", "documentation"]'
 *               collaboratorIds:
 *                 type: string
 *                 description: JSON array string of collaborator user IDs
 *                 example: '["507f1f77bcf86cd799439012", "507f1f77bcf86cd799439013"]'
 *               dependsOnTaskIds:
 *                 type: string
 *                 description: JSON array string of task IDs this subtask depends on
 *                 example: '["507f1f77bcf86cd799439014"]'
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: File attachments for the subtask
 *               referenceProcess:
 *                 type: string
 *                 description: Reference to a process or workflow template
 *                 example: "review-process"
 *               customForm:
 *                 type: string
 *                 description: Custom form data or template reference
 *                 example: "review-form"
 *     responses:
 *       201:
 *         description: Subtask created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Subtask created successfully"
 *                 subtask:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439021"
 *                     title:
 *                       type: string
 *                       example: "Review documentation"
 *                     description:
 *                       type: string
 *                       example: "Review and update the project documentation"
 *                     status:
 *                       type: string
 *                       example: "todo"
 *                     priority:
 *                       type: string
 *                       example: "medium"
 *                     parentTaskId:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439020"
 *                     taskType:
 *                       type: string
 *                       example: "subtask"
 *                     isSubtask:
 *                       type: boolean
 *                       example: true
 *                     createdBy:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439010"
 *                     createdByRole:
 *                       type: string
 *                       example: "manager"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-09-18T10:30:00.000Z"
 *                 parentTask:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439020"
 *                     title:
 *                       type: string
 *                       example: "Complete quarterly report"
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Invalid input data"
 *                 error:
 *                   type: string
 *                   example: "Title is required"
 *       403:
 *         description: Access denied - User doesn't have permission to create subtask for this parent task
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Access denied"
 *       404:
 *         description: Parent task not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Parent task not found"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Unauthorized access"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Failed to create subtask"
 *                 error:
 *                   type: string
 *                   example: "Database connection error"
 */
router.post("/tasks/:parentTaskId/create-subtask",
  authenticateToken,
  checkFeatureAccess('TASK_SUB'),  // Check license limits for subtask creation
  upload.array('attachments', 5),
  createSubtask  // Controller creates the subtask AND handles consumption internally
);

/**
 * @swagger
 * /api/tasks/{parentTaskId}/subtasks:
 *   get:
 *     summary: Get all subtasks for a parent task
 *     description: Retrieves a paginated list of subtasks that belong to a specific parent task. Access is restricted based on parent task permissions.
 *     tags:
 *       - Tasks
 *       - Subtasks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: parentTaskId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the parent task
 *         example: "507f1f77bcf86cd799439020"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: ["todo", "in-progress", "completed", "on-hold", "cancelled"]
 *         description: Filter subtasks by status
 *         example: "in-progress"
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: ["low", "medium", "high", "urgent"]
 *         description: Filter subtasks by priority level
 *         example: "high"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of subtasks per page
 *         example: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search subtasks by title or description
 *         example: "review"
 *     responses:
 *       200:
 *         description: List of subtasks retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Subtasks retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     parentTask:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439020"
 *                         title:
 *                           type: string
 *                           example: "Complete quarterly report"
 *                         status:
 *                           type: string
 *                           example: "in-progress"
 *                     subtasks:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439021"
 *                           title:
 *                             type: string
 *                             example: "Review documentation"
 *                           description:
 *                             type: string
 *                             example: "Review and update the project documentation"
 *                           status:
 *                             type: string
 *                             example: "todo"
 *                           priority:
 *                             type: string
 *                             example: "medium"
 *                           parentTaskId:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439020"
 *                           taskType:
 *                             type: string
 *                             example: "subtask"
 *                           isSubtask:
 *                             type: boolean
 *                             example: true
 *                           dueDate:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-12-31T23:59:59.000Z"
 *                           assignedTo:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439011"
 *                           createdBy:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439010"
 *                           createdByRole:
 *                             type: string
 *                             example: "manager"
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-09-18T10:30:00.000Z"
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-09-18T15:45:00.000Z"
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                           example: 1
 *                         totalPages:
 *                           type: integer
 *                           example: 3
 *                         totalSubtasks:
 *                           type: integer
 *                           example: 45
 *                         hasNextPage:
 *                           type: boolean
 *                           example: true
 *                         hasPrevPage:
 *                           type: boolean
 *                           example: false
 *                         limit:
 *                           type: integer
 *                           example: 20
 *       403:
 *         description: Access denied - User doesn't have permission to view this parent task
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Access denied"
 *       404:
 *         description: Parent task not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Parent task not found"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Unauthorized access"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Failed to fetch subtasks"
 *                 error:
 *                   type: string
 *                   example: "Database connection error"
 */
router.get("/tasks/:parentTaskId/subtasks", authenticateToken, getSubtasks);

/**
 * @swagger
 * /api/tasks/{parentTaskId}/subtasks/{subtaskId}:
 *   put:
 *     summary: Update a subtask by ID
 *     description: Updates an existing subtask with new information. Only users with appropriate permissions (parent task access) can update subtasks.
 *     tags:
 *       - Tasks
 *       - Subtasks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: parentTaskId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the parent task
 *         example: "507f1f77bcf86cd799439020"
 *       - in: path
 *         name: subtaskId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the subtask to update
 *         example: "507f1f77bcf86cd799439021"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Updated subtask title
 *                 example: "Review documentation (Updated)"
 *               description:
 *                 type: string
 *                 description: Updated subtask description
 *                 example: "Review and update the project documentation with latest changes"
 *               status:
 *                 type: string
 *                 enum: [todo, in-progress, completed, on-hold, cancelled]
 *                 description: Updated subtask status
 *                 example: "in-progress"
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *                 description: Updated subtask priority
 *                 example: "high"
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 description: Updated due date
 *                 example: "2025-12-25T23:59:59.000Z"
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 description: Updated start date
 *                 example: "2025-01-05T09:00:00.000Z"
 *               assignedTo:
 *                 type: string
 *                 description: Updated assignee user ID
 *                 example: "507f1f77bcf86cd799439012"
 *               category:
 *                 type: string
 *                 description: Updated subtask category
 *                 example: "Documentation - Review"
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Updated subtask tags
 *                 example: ["review", "documentation", "updated"]
 *               visibility:
 *                 type: string
 *                 enum: [private, public, team]
 *                 description: Updated subtask visibility
 *                 example: "team"
 *               collaborators:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Updated list of collaborator user IDs
 *                 example: ["507f1f77bcf86cd799439013", "507f1f77bcf86cd799439014"]
 *     responses:
 *       200:
 *         description: Subtask updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Subtask updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     subtask:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439021"
 *                         title:
 *                           type: string
 *                           example: "Review documentation (Updated)"
 *                         description:
 *                           type: string
 *                           example: "Review and update the project documentation with latest changes"
 *                         status:
 *                           type: string
 *                           example: "in-progress"
 *                         priority:
 *                           type: string
 *                           example: "high"
 *                         parentTaskId:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439020"
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *                           example: "2025-09-18T15:45:00.000Z"
 *                     parentTask:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439020"
 *                         title:
 *                           type: string
 *                           example: "Complete quarterly report"
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Invalid input data"
 *                 error:
 *                   type: string
 *                   example: "Invalid status value"
 *       403:
 *         description: Access denied - User doesn't have permission to update this subtask
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Access denied"
 *       404:
 *         description: Parent task or subtask not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Subtask not found or does not belong to this parent task"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Unauthorized access"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Failed to update subtask"
 *                 error:
 *                   type: string
 *                   example: "Database connection error"
 */
router.put("/tasks/:parentTaskId/subtasks/:subtaskId", authenticateToken, upload.array('attachments', 5), updateSubtask);

/**
 * @swagger
 * /api/tasks/{parentTaskId}/subtasks/{subtaskId}:
 *   delete:
 *     summary: Delete a subtask by ID
 *     description: Performs a soft delete on a subtask by marking it as deleted. Only users with appropriate permissions (parent task access) can delete subtasks. This action can be undone by restoring the subtask.
 *     tags:
 *       - Tasks
 *       - Subtasks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: parentTaskId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the parent task
 *         example: "507f1f77bcf86cd799439020"
 *       - in: path
 *         name: subtaskId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the subtask to delete
 *         example: "507f1f77bcf86cd799439021"
 *     responses:
 *       200:
 *         description: Subtask deleted successfully (soft delete)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Subtask deleted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     deletedSubtaskId:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439021"
 *                     parentTask:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439020"
 *                         title:
 *                           type: string
 *                           example: "Complete quarterly report"
 *       403:
 *         description: Access denied - User doesn't have permission to delete this subtask
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Access denied"
 *       404:
 *         description: Parent task or subtask not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Subtask not found or does not belong to this parent task"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Unauthorized access"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Failed to delete subtask"
 *                 error:
 *                   type: string
 *                   example: "Database connection error"
 */
router.delete("/tasks/:parentTaskId/subtasks/:subtaskId", authenticateToken, deleteSubtask);

/**
 * @swagger
 * /api/tasks/{parentTaskId}/subtasks/{subtaskId}/comments:
 *   post:
 *     summary: Add a comment to a subtask
 *     description: Adds a new comment to a specific subtask. Only users with access to the parent task can add comments.
 *     tags:
 *       - Tasks
 *       - Subtasks
 *       - Comments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: parentTaskId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the parent task
 *         example: "507f1f77bcf86cd799439020"
 *       - in: path
 *         name: subtaskId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the subtask
 *         example: "507f1f77bcf86cd799439021"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - comment
 *             properties:
 *               comment:
 *                 type: string
 *                 description: The comment text
 *                 example: "This subtask looks good, please review the documentation part."
 *               mentions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of user IDs mentioned in the comment
 *                 example: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"]
 *     responses:
 *       201:
 *         description: Comment added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Comment added successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     comment:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "1695900000123abc"
 *                         text:
 *                           type: string
 *                           example: "This subtask looks good, please review the documentation part."
 *                         author:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439010"
 *                         authorName:
 *                           type: string
 *                           example: "John Doe"
 *                         authorEmail:
 *                           type: string
 *                           example: "john.doe@example.com"
 *                         mentions:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ["507f1f77bcf86cd799439011"]
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                           example: "2025-09-27T10:30:00.000Z"
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *                           example: "2025-09-27T10:30:00.000Z"
 *                         isEdited:
 *                           type: boolean
 *                           example: false
 *                     subtask:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439021"
 *                         title:
 *                           type: string
 *                           example: "Review documentation"
 *                     parentTask:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439020"
 *                         title:
 *                           type: string
 *                           example: "Complete quarterly report"
 *       400:
 *         description: Invalid input - Comment text is required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Parent task or subtask not found
 *       500:
 *         description: Internal server error
 */

// Task Comment Routes
/**
 * @swagger
 * /api/tasks/{taskId}/comments:
 *   post:
 *     summary: Add a comment to a task
 *     description: Adds a new comment to a specific task. Users need access to the task to add comments.
 *     tags:
 *       - Tasks
 *       - Comments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: The task ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - comment
 *             properties:
 *               comment:
 *                 type: string
 *                 description: The comment text
 *                 example: "This task needs more clarification on requirements"
 *               mentions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of user IDs mentioned in the comment
 *     responses:
 *       201:
 *         description: Comment added successfully
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Access denied
 *       404:
 *         description: Task not found
 *       500:
 *         description: Internal server error
 */
router.post("/tasks/:taskId/comments", authenticateToken, commentUpload.array('attachments', 5), addTaskComment);

/**
 * @swagger
 * /api/tasks/{taskId}/comments:
 *   get:
 *     summary: Get all comments for a task
 *     description: Retrieves all comments for a specific task with pagination support.
 *     tags:
 *       - Tasks
 *       - Comments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: The task ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of comments per page
 *     responses:
 *       200:
 *         description: Comments retrieved successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: Task not found
 *       500:
 *         description: Internal server error
 */
router.get("/tasks/:taskId/comments", authenticateToken, getTaskComments);

/**
 * @swagger
 * /api/tasks/{taskId}/comments/{commentId}:
 *   put:
 *     summary: Update a comment
 *     description: Updates a specific comment. Only the comment author can update it.
 *     tags:
 *       - Tasks
 *       - Comments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: The task ID
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: The comment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - comment
 *             properties:
 *               comment:
 *                 type: string
 *                 description: The updated comment text
 *     responses:
 *       200:
 *         description: Comment updated successfully
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Access denied - can only edit own comments
 *       404:
 *         description: Task or comment not found
 *       500:
 *         description: Internal server error
 */
router.put("/tasks/:taskId/comments/:commentId", authenticateToken, updateTaskComment);

/**
 * @swagger
 * /api/tasks/{taskId}/comments/{commentId}:
 *   delete:
 *     summary: Delete a comment
 *     description: Deletes a specific comment. Only the comment author or admin can delete it.
 *     tags:
 *       - Tasks
 *       - Comments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: The task ID
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: The comment ID
 *     responses:
 *       200:
 *         description: Comment deleted successfully
 *       403:
 *         description: Access denied - can only delete own comments
 *       404:
 *         description: Task or comment not found
 *       500:
 *         description: Internal server error
 */
router.delete("/tasks/:taskId/comments/:commentId", authenticateToken, deleteTaskComment);

/**
 * @swagger
 * /api/tasks/{taskId}/comments/{commentId}/reply:
 *   post:
 *     summary: Reply to a specific comment on a task
 *     description: Adds a reply to an existing comment on a task. The reply will be linked to the parent comment.
 *     tags:
 *       - Tasks
 *       - Comments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: The task ID
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: The parent comment ID to reply to
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: The reply content
 *                 example: "Thanks for the feedback! I'll make those changes."
 *               mentions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of user IDs mentioned in the reply
 *     responses:
 *       201:
 *         description: Reply added successfully
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Access denied
 *       404:
 *         description: Task or parent comment not found
 *       500:
 *         description: Internal server error
 */
router.post("/tasks/:taskId/comments/:commentId/reply", authenticateToken, replyToTaskComment);

router.post("/tasks/:parentTaskId/subtasks/:subtaskId/comments", authenticateToken, commentUpload.array('attachments', 5), addSubtaskComment);

/**
 * @swagger
 * /api/tasks/{parentTaskId}/subtasks/{subtaskId}/comments:
 *   get:
 *     summary: Get all comments for a subtask
 *     description: Retrieves all comments for a specific subtask with pagination support.
 *     tags:
 *       - Tasks
 *       - Subtasks
 *       - Comments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: parentTaskId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the parent task
 *         example: "507f1f77bcf86cd799439020"
 *       - in: path
 *         name: subtaskId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the subtask
 *         example: "507f1f77bcf86cd799439021"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of comments per page
 *         example: 20
 *     responses:
 *       200:
 *         description: Comments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Comments retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     subtask:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439021"
 *                         title:
 *                           type: string
 *                           example: "Review documentation"
 *                     parentTask:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439020"
 *                         title:
 *                           type: string
 *                           example: "Complete quarterly report"
 *                     comments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           text:
 *                             type: string
 *                           author:
 *                             type: string
 *                           authorName:
 *                             type: string
 *                           authorEmail:
 *                             type: string
 *                           mentions:
 *                             type: array
 *                             items:
 *                               type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *                           isEdited:
 *                             type: boolean
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         totalComments:
 *                           type: integer
 *                         hasNextPage:
 *                           type: boolean
 *                         hasPrevPage:
 *                           type: boolean
 *                         limit:
 *                           type: integer
 *       403:
 *         description: Access denied
 *       404:
 *         description: Parent task or subtask not found
 *       500:
 *         description: Internal server error
 */
router.get("/tasks/:parentTaskId/subtasks/:subtaskId/comments", authenticateToken, getSubtaskComments);

/**
 * @swagger
 * /api/tasks/{parentTaskId}/subtasks/{subtaskId}/comments/{commentId}:
 *   put:
 *     summary: Update a comment on a subtask
 *     description: Updates an existing comment on a subtask. Only the comment author can update their own comments.
 *     tags:
 *       - Tasks
 *       - Subtasks
 *       - Comments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: parentTaskId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the parent task
 *         example: "507f1f77bcf86cd799439020"
 *       - in: path
 *         name: subtaskId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the subtask
 *         example: "507f1f77bcf86cd799439021"
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the comment to update
 *         example: "1695900000123abc"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - comment
 *             properties:
 *               comment:
 *                 type: string
 *                 description: The updated comment text
 *                 example: "Updated comment: This subtask looks great after the changes."
 *     responses:
 *       200:
 *         description: Comment updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Comment updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     comment:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         text:
 *                           type: string
 *                         author:
 *                           type: string
 *                         authorName:
 *                           type: string
 *                         authorEmail:
 *                           type: string
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *                         isEdited:
 *                           type: boolean
 *                           example: true
 *       400:
 *         description: Invalid input - Comment text is required
 *       403:
 *         description: Access denied - Can only edit own comments
 *       404:
 *         description: Parent task, subtask, or comment not found
 *       500:
 *         description: Internal server error
 */
router.put("/tasks/:parentTaskId/subtasks/:subtaskId/comments/:commentId", authenticateToken, updateSubtaskComment);

/**
 * @swagger
 * /api/tasks/{parentTaskId}/subtasks/{subtaskId}/comments/{commentId}:
 *   delete:
 *     summary: Delete a comment from a subtask
 *     description: Deletes a comment from a subtask. Only the comment author or organization admin can delete comments.
 *     tags:
 *       - Tasks
 *       - Subtasks
 *       - Comments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: parentTaskId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the parent task
 *         example: "507f1f77bcf86cd799439020"
 *       - in: path
 *         name: subtaskId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the subtask
 *         example: "507f1f77bcf86cd799439021"
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the comment to delete
 *         example: "1695900000123abc"
 *     responses:
 *       200:
 *         description: Comment deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Comment deleted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     deletedCommentId:
 *                       type: string
 *                       example: "1695900000123abc"
 *                     subtask:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         title:
 *                           type: string
 *                     parentTask:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         title:
 *                           type: string
 *       403:
 *         description: Access denied - Can only delete own comments or need admin privileges
 *       404:
 *         description: Parent task, subtask, or comment not found
 *       500:
 *         description: Internal server error
 */
router.delete("/tasks/:parentTaskId/subtasks/:subtaskId/comments/:commentId", authenticateToken, deleteSubtaskComment);

/**
 * @swagger
 * /api/tasks/{parentTaskId}/subtasks/{subtaskId}/comments/{commentId}/reply:
 *   post:
 *     summary: Reply to a subtask comment
 *     description: Creates a reply to an existing subtask comment. The reply will be nested under the parent comment.
 *     tags:
 *       - Subtask Comments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: parentTaskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Parent task ID
 *       - in: path
 *         name: subtaskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Subtask ID
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Parent comment ID to reply to
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Reply content
 *               mentions:
 *                 type: array
 *                 items:
 *                   type: object
 *                 description: Users mentioned in the reply
 *     responses:
 *       201:
 *         description: Reply added successfully
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Access denied
 *       404:
 *         description: Parent task, subtask, or comment not found
 *       500:
 *         description: Internal server error
 */
router.post("/tasks/:parentTaskId/subtasks/:subtaskId/comments/:commentId/reply", authenticateToken, commentUpload.array('attachments', 5), replyToSubtaskComment);

/**
 * @swagger
 * /api/tasks:
 *   get:
 *     summary: Get all tasks for the user's organization or created by the user
 *     description: Retrieves a paginated list of tasks with filtering capabilities. For organization users, returns tasks within their organization. For individual users, returns tasks they created.
 *     tags:
 *       - Tasks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: ["regular", "recurring", "milestone", "approval"]
 *         description: Filter tasks by type
 *         example: "regular"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: ["todo", "in-progress", "completed", "on-hold", "cancelled"]
 *         description: Filter tasks by status
 *         example: "in-progress"
 *       - in: query
 *         name: assignee
 *         schema:
 *           type: string
 *         description: Filter tasks by assignee user ID
 *         example: "507f1f77bcf86cd799439011"
 *       - in: query
 *         name: project
 *         schema:
 *           type: string
 *         description: Filter tasks by project ID
 *         example: "507f1f77bcf86cd799439012"
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: ["low", "medium", "high", "urgent"]
 *         description: Filter tasks by priority level
 *         example: "high"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of tasks per page
 *         example: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search tasks by title or description
 *         example: "quarterly report"
 *     responses:
 *       200:
 *         description: List of tasks retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     tasks:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439020"
 *                           title:
 *                             type: string
 *                             example: "Complete quarterly report"
 *                           description:
 *                             type: string
 *                             example: "Prepare and submit the Q4 financial report"
 *                           status:
 *                             type: string
 *                             example: "in-progress"
 *                           priority:
 *                             type: string
 *                             example: "high"
 *                           dueDate:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-12-31T23:59:59.000Z"
 *                           assignedTo:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439011"
 *                           createdBy:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439010"
 *                           createdByRole:
 *                             type: array
 *                             items:
 *                               type: string
 *                               enum: [super_admin, org_admin, manager, individual, employee]
 *                             example: ["manager"]
 *                             description: "Role of the user who created the task"
 *                           taskType:
 *                             type: string
 *                             enum: [regular, recurring, milestone, approval]
 *                             example: "regular"
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-09-18T10:30:00.000Z"
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                           example: 1
 *                         totalPages:
 *                           type: integer
 *                           example: 5
 *                         totalTasks:
 *                           type: integer
 *                           example: 95
 *                         hasNextPage:
 *                           type: boolean
 *                           example: true
 *                         hasPrevPage:
 *                           type: boolean
 *                           example: false
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Unauthorized access"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Failed to fetch tasks"
 *                 error:
 *                   type: string
 *                   example: "Database connection error"
 */
router.get("/tasks", authenticateToken, getTasks);

/**
 * @swagger
 * /api/tasks/available-for-linking:
 *   get:
 *     summary: Get all tasks available for milestone linking
 *     description: Returns regular and recurring tasks that can be linked to milestones (excludes deleted/inactive)
 *     tags:
 *       - Milestones
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: excludeTaskIds
 *         schema:
 *           type: string
 *         description: Comma-separated task IDs to exclude (already linked tasks)
 *     responses:
 *       200:
 *         description: List of available tasks
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/tasks/available-for-linking", authenticateToken, getAvailableTasksForLinking);

/**
 * @swagger
 * /api/tasks/{id}:
 *   get:
 *     summary: Get a single task by ID
 *     description: Retrieves detailed information about a specific task including approval details if it's an approval task. Access is restricted based on organization membership or task ownership.
 *     tags:
 *       - Tasks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier of the task
 *         example: "507f1f77bcf86cd799439020"
 *     responses:
 *       200:
 *         description: Task details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439020"
 *                     title:
 *                       type: string
 *                       example: "Complete quarterly report"
 *                     description:
 *                       type: string
 *                       example: "Prepare and submit the Q4 financial report"
 *                     status:
 *                       type: string
 *                       example: "in-progress"
 *                     priority:
 *                       type: string
 *                       example: "high"
 *                     taskType:
 *                       type: string
 *                       example: "regular"
 *                     dueDate:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-12-31T23:59:59.000Z"
 *                     assignedTo:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439011"
 *                     createdBy:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439010"
 *                     tags:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["urgent", "finance", "quarterly"]
 *                     attachments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           url:
 *                             type: string
 *                           size:
 *                             type: number
 *                           type:
 *                             type: string
 *                     approvalDetails:
 *                       type: array
 *                       description: Present only for approval tasks
 *                       items:
 *                         type: object
 *                         properties:
 *                           approverId:
 *                             type: string
 *                           status:
 *                             type: string
 *                             enum: [pending, approve, reject]
 *                           comment:
 *                             type: string
 *                           approvedAt:
 *                             type: string
 *                             format: date-time
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-09-18T10:30:00.000Z"
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-09-18T15:45:00.000Z"
 *       403:
 *         description: Access denied - User doesn't have permission to view this task
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Access denied"
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Task not found"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Unauthorized access"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Failed to fetch task"
 *                 error:
 *                   type: string
 *                   example: "Database connection error"
 */

/**
 * @swagger
 * /api/tasks/overdue:
 *   get:
 *     summary: Get overdue tasks for current user
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in title and description
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         description: Filter by priority
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *     responses:
 *       200:
 *         description: List of overdue tasks
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/tasks/overdue", authenticateToken, getOverdueTasks);

/**
 * @swagger
 * /api/tasks/overdue/stats:
 *   get:
 *     summary: Get overdue task statistics
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Overdue task statistics
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/tasks/overdue/stats", authenticateToken, getOverdueTaskStats);

router.get("/tasks/:id", authenticateToken, getTaskById);

/**
 * @swagger
 * /api/tasks/{id}:
 *   put:
 *     summary: Update a task by ID
 *     description: Updates an existing task with new information. Only users with appropriate permissions (task creator, assignee, or organization member) can update tasks.
 *     tags:
 *       - Tasks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier of the task to update
 *         example: "507f1f77bcf86cd799439020"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Updated task title
 *                 example: "Complete quarterly report (Updated)"
 *               description:
 *                 type: string
 *                 description: Updated task description
 *                 example: "Prepare and submit the Q4 financial report with additional analysis"
 *               status:
 *                 type: string
 *                 enum: [todo, in-progress, completed, on-hold, cancelled]
 *                 description: Updated task status
 *                 example: "in-progress"
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *                 description: Updated task priority
 *                 example: "urgent"
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 description: Updated due date
 *                 example: "2025-12-25T23:59:59.000Z"
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 description: Updated start date
 *                 example: "2025-01-05T09:00:00.000Z"
 *               assignedTo:
 *                 type: string
 *                 description: Updated assignee user ID
 *                 example: "507f1f77bcf86cd799439012"
 *               category:
 *                 type: string
 *                 description: Updated task category
 *                 example: "Finance - Reporting"
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Updated task tags
 *                 example: ["urgent", "finance", "quarterly", "updated"]
 *               visibility:
 *                 type: string
 *                 enum: [private, public, team]
 *                 description: Updated task visibility
 *                 example: "public"
 *               collaborators:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Updated list of collaborator user IDs
 *                 example: ["507f1f77bcf86cd799439013", "507f1f77bcf86cd799439014"]
 *     responses:
 *       200:
 *         description: Task updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Task updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439020"
 *                     title:
 *                       type: string
 *                       example: "Complete quarterly report (Updated)"
 *                     description:
 *                       type: string
 *                       example: "Prepare and submit the Q4 financial report with additional analysis"
 *                     status:
 *                       type: string
 *                       example: "in-progress"
 *                     priority:
 *                       type: string
 *                       example: "urgent"
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-09-18T15:45:00.000Z"
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Invalid input data"
 *                 error:
 *                   type: string
 *                   example: "Invalid status value"
 *       403:
 *         description: Access denied - User doesn't have permission to update this task
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Access denied"
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Task not found"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Unauthorized access"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Failed to update task"
 *                 error:
 *                   type: string
 *                   example: "Database connection error"
 */
router.put("/tasks/:id", authenticateToken, upload.array('attachments', 5), updateTask);
router.patch("/tasks/:id", authenticateToken, upload.array('attachments', 5), updateTask);

/**
 * @swagger
 * /api/tasks/{id}/status:
 *   patch:
 *     summary: Update task status by ID
 *     description: Updates only the status of a specific task. This is a lightweight operation compared to full task update. Users with appropriate permissions can update task status.
 *     tags:
 *       - Tasks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier of the task to update status
 *         example: "507f1f77bcf86cd799439020"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [todo, in-progress, completed, on-hold, cancelled]
 *                 description: New status for the task
 *                 example: "completed"
 *               completedDate:
 *                 type: string
 *                 format: date-time
 *                 description: Optional completion date (auto-set when status is 'completed')
 *                 example: "2025-09-18T16:30:00.000Z"
 *               notes:
 *                 type: string
 *                 description: Optional notes about the status change
 *                 example: "Task completed ahead of schedule"
 *     responses:
 *       200:
 *         description: Task status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Task status updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439020"
 *                     title:
 *                       type: string
 *                       example: "Complete quarterly report"
 *                     status:
 *                       type: string
 *                       example: "completed"
 *                     completedDate:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-09-18T16:30:00.000Z"
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-09-18T16:30:00.000Z"
 *                     statusHistory:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           status:
 *                             type: string
 *                             example: "completed"
 *                           changedBy:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439011"
 *                           changedAt:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-09-18T16:30:00.000Z"
 *                           notes:
 *                             type: string
 *                             example: "Task completed ahead of schedule"
 *       400:
 *         description: Invalid status value or missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Invalid status value"
 *                 error:
 *                   type: string
 *                   example: "Status must be one of: todo, in-progress, completed, on-hold, cancelled"
 *       403:
 *         description: Access denied - User doesn't have permission to update this task
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Access denied"
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Task not found"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Unauthorized access"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Failed to update task status"
 *                 error:
 *                   type: string
 *                   example: "Database connection error"
 */
router.patch("/tasks/:id/status", authenticateToken, updateTaskStatus);

/**
 * @swagger
 * /api/tasks/{id}/snooze:
 *   patch:
 *     summary: Snooze a task
 *     description: Snooze a task until a specified date and time
 *     tags:
 *       - Tasks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - snoozeUntil
 *             properties:
 *               snoozeUntil:
 *                 type: string
 *                 format: date-time
 *                 description: Date and time until task is snoozed
 *               reason:
 *                 type: string
 *                 description: Reason for snoozing the task
 *     responses:
 *       200:
 *         description: Task snoozed successfully
 *       400:
 *         description: Bad request
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Task not found
 */
router.patch("/tasks/:taskId/snooze", authenticateToken, snoozeTask);

/**
 * @swagger
 * /api/tasks/{id}/unsnooze:
 *   patch:
 *     summary: Unsnooze a task
 *     description: Remove snooze from a task
 *     tags:
 *       - Tasks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     responses:
 *       200:
 *         description: Task unsnooze successfully
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Task not found
 */
router.patch("/tasks/:taskId/unsnooze", authenticateToken, unsnoozeTask);

/**
 * @swagger
 * /api/tasks/{id}/mark-risk:
 *   patch:
 *     summary: Mark task as risk
 *     description: Mark a task as risky with optional risk level and reason
 *     tags:
 *       - Tasks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               riskLevel:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 description: Risk level
 *               riskReason:
 *                 type: string
 *                 description: Reason for marking as risk
 *     responses:
 *       200:
 *         description: Task marked as risk successfully
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Task not found
 */
router.patch("/tasks/:taskId/mark-risk", authenticateToken, markTaskAsRisk);

/**
 * @swagger
 * /api/tasks/{id}/unmark-risk:
 *   patch:
 *     summary: Unmark task as risk
 *     description: Remove risk marking from a task
 *     tags:
 *       - Tasks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     responses:
 *       200:
 *         description: Task unmarked as risk successfully
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Task not found
 */
router.patch("/tasks/:taskId/unmark-risk", authenticateToken, unmarkTaskAsRisk);

/**
 * @swagger
 * /api/tasks/{id}/quick-done:
 *   patch:
 *     summary: Quick mark task as done
 *     description: Quickly mark a task as completed with optional completion notes
 *     tags:
 *       - Tasks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               completionNotes:
 *                 type: string
 *                 description: Notes about task completion
 *     responses:
 *       200:
 *         description: Task marked as completed successfully
 *       400:
 *         description: Cannot complete task due to incomplete subtasks
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Task not found
 */
router.patch("/tasks/:taskId/quick-done", authenticateToken, quickMarkAsDone);

/**
 * @swagger
 * /api/tasks/delete/{id}:
 *   delete:
 *     summary: Delete a task by ID
 *     description: Performs a soft delete on a task by marking it as deleted. Only users with appropriate permissions (task creator, admin, or organization member) can delete tasks. This action can be undone by restoring the task.
 *     tags:
 *       - Tasks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier of the task to delete
 *         example: "507f1f77bcf86cd799439020"
 *     responses:
 *       200:
 *         description: Task deleted successfully (soft delete)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Task deleted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     deletedTaskId:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439020"
 *                     isDeleted:
 *                       type: boolean
 *                       example: true
 *                     deletedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-09-18T17:00:00.000Z"
 *       403:
 *         description: Access denied - User doesn't have permission to delete this task
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Access denied"
 *                 error:
 *                   type: string
 *                   example: "You don't have permission to delete this task"
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Task not found"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Unauthorized access"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Failed to delete task"
 *                 error:
 *                   type: string
 *                   example: "Database connection error"
 */
router.delete("/tasks/delete/:id", authenticateToken, deleteTask);

/**
 * @swagger
 * /api/tasks/{id}/approve:
 *   post:
 *     summary: Approve or reject an approval task
 *     description: Processes approval or rejection of a task that requires approval. Only designated approvers can perform this action. Supports both 'any' and 'all' approval modes.
 *     tags:
 *       - Tasks
 *       - Tasks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier of the approval task
 *         example: "507f1f77bcf86cd799439020"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *                 description: The approval action to take
 *                 example: "approve"
 *               comment:
 *                 type: string
 *                 description: Optional comment explaining the approval/rejection decision
 *                 example: "Approved - meets all requirements and quality standards"
 *               reviewDate:
 *                 type: string
 *                 format: date-time
 *                 description: Date when the review was conducted (auto-set if not provided)
 *                 example: "2025-09-18T18:00:00.000Z"
 *     responses:
 *       200:
 *         description: Approval action processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Task approved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     taskId:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439020"
 *                     approvalStatus:
 *                       type: string
 *                       enum: [pending, approved, rejected]
 *                       example: "approved"
 *                     taskStatus:
 *                       type: string
 *                       example: "approved"
 *                     approvedBy:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439011"
 *                     approvedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-09-18T18:00:00.000Z"
 *                     comment:
 *                       type: string
 *                       example: "Approved - meets all requirements and quality standards"
 *                     approvalProgress:
 *                       type: object
 *                       properties:
 *                         totalApprovers:
 *                           type: integer
 *                           example: 3
 *                         approvedCount:
 *                           type: integer
 *                           example: 2
 *                         rejectedCount:
 *                           type: integer
 *                           example: 0
 *                         pendingCount:
 *                           type: integer
 *                           example: 1
 *                         approvalMode:
 *                           type: string
 *                           enum: [any, all]
 *                           example: "all"
 *       400:
 *         description: Invalid action or missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Invalid action"
 *                 error:
 *                   type: string
 *                   example: "Action must be either 'approve' or 'reject'"
 *       403:
 *         description: Access denied - User is not authorized to approve this task
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "You are not authorized to approve this task"
 *                 error:
 *                   type: string
 *                   example: "User is not in the list of designated approvers"
 *       404:
 *         description: Approval task not found or approval record not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Approval task not found"
 *                 error:
 *                   type: string
 *                   example: "Task does not exist or is not an approval task"
 *       409:
 *         description: Conflict - Approval already processed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Approval already processed"
 *                 error:
 *                   type: string
 *                   example: "This approver has already provided their decision"
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Unauthorized access"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Failed to process approval"
 *                 error:
 *                   type: string
 *                   example: "Database connection error"
 */
router.post("/tasks/:id/approve", authenticateToken, approveOrRejectTask);

/**
 * @swagger
 * /api/tasks/filter/{type}:
 *   get:
 *     summary: Get tasks filtered by task type
 *     description: Retrieves tasks filtered by specific task type (regular, recurring, milestone, approval) with additional filtering capabilities. Supports pagination and comprehensive search options.
 *     tags:
 *       - Tasks
 *       - Tasks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [regular, recurring, milestone, approval]
 *         description: Type of tasks to filter by
 *         example: "regular"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [todo, in-progress, completed, on-hold, cancelled]
 *         description: Filter by task status
 *         example: "in-progress"
 *       - in: query
 *         name: assignee
 *         schema:
 *           type: string
 *         description: Filter by assignee user ID
 *         example: "507f1f77bcf86cd799439011"
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         description: Filter by task priority
 *         example: "high"
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by task category (case-insensitive partial match)
 *         example: "Finance"
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in task title, description, and tags
 *         example: "quarterly report"
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter tasks with due date on or after this date
 *         example: "2025-01-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter tasks with due date on or before this date
 *         example: "2025-12-31"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of tasks per page
 *         example: 20
 *     responses:
 *       200:
 *         description: Tasks filtered by type retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Regular tasks retrieved successfully"
 *                 taskType:
 *                   type: string
 *                   example: "regular"
 *                 data:
 *                   type: object
 *                   properties:
 *                     tasks:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439020"
 *                           title:
 *                             type: string
 *                             example: "Complete quarterly report"
 *                           description:
 *                             type: string
 *                             example: "Prepare and submit the Q4 financial report"
 *                           taskType:
 *                             type: string
 *                             example: "regular"
 *                           status:
 *                             type: string
 *                             example: "in-progress"
 *                           priority:
 *                             type: string
 *                             example: "high"
 *                           category:
 *                             type: string
 *                             example: "Finance"
 *                           dueDate:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-12-31T23:59:59.000Z"
 *                           assignedTo:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439011"
 *                           createdBy:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439010"
 *                           createdByRole:
 *                             type: array
 *                             items:
 *                               type: string
 *                               enum: [super_admin, org_admin, manager, individual, employee]
 *                             example: ["manager"]
 *                             description: "Role of the user who created the task"
 *                           tags:
 *                             type: array
 *                             items:
 *                               type: string
 *                             example: ["urgent", "finance", "quarterly"]
 *                           isRecurring:
 *                             type: boolean
 *                             description: Present for recurring tasks
 *                             example: false
 *                           isMilestone:
 *                             type: boolean
 *                             description: Present for milestone tasks
 *                             example: false
 *                           isApprovalTask:
 *                             type: boolean
 *                             description: Present for approval tasks
 *                             example: false
 *                           approvalDetails:
 *                             type: array
 *                             description: Present only for approval tasks
 *                             items:
 *                               type: object
 *                               properties:
 *                                 approverId:
 *                                   type: string
 *                                 status:
 *                                   type: string
 *                                 comment:
 *                                   type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-09-18T10:30:00.000Z"
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-09-18T15:45:00.000Z"
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                           example: 1
 *                         totalPages:
 *                           type: integer
 *                           example: 5
 *                         totalTasks:
 *                           type: integer
 *                           example: 95
 *                         hasNextPage:
 *                           type: boolean
 *                           example: true
 *                         hasPrevPage:
 *                           type: boolean
 *                           example: false
 *                         limit:
 *                           type: integer
 *                           example: 20
 *                     summary:
 *                       type: object
 *                       properties:
 *                         taskType:
 *                           type: string
 *                           example: "regular"
 *                         totalCount:
 *                           type: integer
 *                           example: 95
 *                         filters:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: string
 *                               example: "in-progress"
 *                             assignee:
 *                               type: string
 *                               example: "507f1f77bcf86cd799439011"
 *                             priority:
 *                               type: string
 *                               example: "high"
 *                             category:
 *                               type: string
 *                               example: "Finance"
 *                             search:
 *                               type: string
 *                               example: "quarterly report"
 *                             dateRange:
 *                               type: object
 *                               properties:
 *                                 from:
 *                                   type: string
 *                                   example: "2025-01-01"
 *                                 to:
 *                                   type: string
 *                                   example: "2025-12-31"
 *       400:
 *         description: Invalid task type parameter
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Invalid task type. Must be one of: regular, recurring, milestone, approval"
 *                 validTypes:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["regular", "recurring", "milestone", "approval"]
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Unauthorized access"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Failed to fetch tasks by type"
 *                 error:
 *                   type: string
 *                   example: "Database connection error"
 */
router.get("/tasks/filter/:type", authenticateToken, getTasksByType);

/**
 * @swagger
 * /api/mytasks:
 *   get:
 *     summary: Get all tasks created by the user's role
 *     description: Retrieves a list of tasks where the createdByRole matches the user's role. Supports pagination and filtering.
 *     tags:
 *       - Tasks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: ["todo", "in-progress", "completed", "on-hold", "cancelled"]
 *         description: Filter tasks by status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: ["low", "medium", "high", "urgent"]
 *         description: Filter tasks by priority
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of tasks per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search tasks by title or description
 *     responses:
 *       200:
 *         description: List of tasks created by user's role retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     tasks:
 *                       type: array
 *                       items:
 *                         type: object
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         totalTasks:
 *                           type: integer
 *                         hasNextPage:
 *                           type: boolean
 *                         hasPrevPage:
 *                           type: boolean
 *                         limit:
 *                           type: integer
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Unauthorized access"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Failed to fetch tasks"
 *                 error:
 *                   type: string
 *                   example: "Database connection error"
 */
router.get("/mytasks", authenticateToken, getMyTasks);

/**
 * @swagger
 * /api/team-tasks:
 *   get:
 *     summary: Get Team Tasks for Managers
 *     description: |
 *       Phase I RBAC: Returns tasks assigned to subordinates (employees under this manager).
 *       Only accessible to users with manager role.
 *       Filters tasks where assignedTo is in manager's subordinates list.
 *     tags:
 *       - Tasks
 *       - Manager
 *       - Team
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [OPEN, INPROGRESS, DONE, CANCELLED, ONHOLD, REOPENED]
 *         description: Filter by task status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         description: Filter by task priority
 *       - in: query
 *         name: subordinateId
 *         schema:
 *           type: string
 *         description: Filter by specific subordinate user ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of tasks per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in task title and description
 *     responses:
 *       200:
 *         description: Team tasks retrieved successfully
 *       403:
 *         description: Access denied - Only managers can view team tasks
 *       500:
 *         description: Failed to retrieve team tasks
 */
router.get("/team-tasks", authenticateToken, getTeamTasks);

/**
 * @swagger
 * /api/tasks/{taskId}/activities:
 *   get:
 *     summary: Get activity feed for a specific task
 *     description: Retrieves chronological activity feed for a task including all operations performed on the task
 *     tags:
 *       - Tasks
 *       - Activities
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: The task ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Maximum number of activities to return
 *     responses:
 *       200:
 *         description: Task activities retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     activities:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           type:
 *                             type: string
 *                           description:
 *                             type: string
 *                           user:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                               avatar:
 *                                 type: string
 *                           metadata:
 *                             type: object
 *                             properties:
 *                               icon:
 *                                 type: string
 *                               category:
 *                                 type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                     taskTitle:
 *                       type: string
 *                     taskId:
 *                       type: string
 *       404:
 *         description: Task not found
 *       403:
 *         description: Access denied
 */
router.get("/tasks/:taskId/activities", authenticateToken, getTaskActivities);

// Debug endpoint to check activities
router.get("/tasks/:taskId/debug-activities", authenticateToken, debugActivities);

/**
 * @swagger
 * /api/activities/organization:
 *   get:
 *     summary: Get organization-wide activity feed
 *     description: Retrieves recent activities across the organization
 *     tags:
 *       - Activities
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of activities to return
 *     responses:
 *       200:
 *         description: Organization activities retrieved successfully
 *       403:
 *         description: Organization access required
 */
router.get("/activities/organization", authenticateToken, getOrganizationActivities);

/**
 * @swagger
 * /api/activities/recent:
 *   get:
 *     summary: Get recent activities
 *     description: Retrieves recent activities across the system
 *     tags:
 *       - Activities
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of activities to return
 *     responses:
 *       200:
 *         description: Recent activities retrieved successfully
 */
router.get("/activities/recent", authenticateToken, getRecentActivities);

// Import file controller
import {
  upload as fileUpload,
  getTaskFiles,
  uploadFile,
  downloadFile,
  viewFile,
  deleteFile,
  getTaskLinks,
  addLink,
  deleteLink
} from "../controller/fileController.js";

/**
 * @swagger
 * /api/tasks/{taskId}/files:
 *   get:
 *     summary: Get files for a task
 *     description: Retrieves all files attached to a specific task
 *     tags:
 *       - Files
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     responses:
 *       200:
 *         description: Files retrieved successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: Task not found
 */
router.get("/tasks/:taskId/files", authenticateToken, getTaskFiles);

/**
 * @swagger
 * /api/tasks/{taskId}/files:
 *   post:
 *     summary: Upload file to task
 *     description: Uploads a file and attaches it to a specific task
 *     tags:
 *       - Files
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File to upload (max 2MB)
 *     responses:
 *       200:
 *         description: File uploaded successfully
 *       400:
 *         description: Invalid file or no file provided
 *       403:
 *         description: Access denied
 *       404:
 *         description: Task not found
 */
router.post("/tasks/:taskId/files", authenticateToken, fileUpload.single('file'), uploadFile);

/**
 * @swagger
 * /api/tasks/{taskId}/files/{fileId}/download:
 *   get:
 *     summary: Download file from task
 *     description: Downloads a file attached to a task
 *     tags:
 *       - Files
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     responses:
 *       200:
 *         description: File downloaded successfully
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       403:
 *         description: Access denied
 *       404:
 *         description: Task or file not found
 */
router.get("/tasks/:taskId/files/:fileId/download", authenticateToken, downloadFile);

// View/preview file inline (authenticated)
router.get("/tasks/:taskId/files/:fileId/view", authenticateToken, viewFile);

/**
 * @swagger
 * /api/tasks/{taskId}/files/{fileId}:
 *   delete:
 *     summary: Delete file from task
 *     description: Soft deletes a file attached to a task
 *     tags:
 *       - Files
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           type: string
 *         description: File ID
 *     responses:
 *       200:
 *         description: File deleted successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: Task or file not found
 */
router.delete("/tasks/:taskId/files/:fileId", authenticateToken, deleteFile);

/**
 * @swagger
 * /api/tasks/{taskId}/links:
 *   get:
 *     summary: Get links for a task
 *     description: Retrieves all external links attached to a specific task
 *     tags:
 *       - Links
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     responses:
 *       200:
 *         description: Links retrieved successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: Task not found
 */
router.get("/tasks/:taskId/links", authenticateToken, getTaskLinks);

/**
 * @swagger
 * /api/tasks/{taskId}/links:
 *   post:
 *     summary: Add link to task
 *     description: Adds an external link to a specific task
 *     tags:
 *       - Links
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: External URL
 *               title:
 *                 type: string
 *                 description: Link title (optional)
 *               description:
 *                 type: string
 *                 description: Link description (optional)
 *     responses:
 *       200:
 *         description: Link added successfully
 *       400:
 *         description: Invalid URL or missing required fields
 *       403:
 *         description: Access denied
 *       404:
 *         description: Task not found
 */
router.post("/tasks/:taskId/links", authenticateToken, addLink);

/**
 * @swagger
 * /api/tasks/{taskId}/links/{linkId}:
 *   delete:
 *     summary: Delete link from task
 *     description: Soft deletes a link attached to a task
 *     tags:
 *       - Links
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *       - in: path
 *         name: linkId
 *         required: true
 *         schema:
 *           type: string
 *         description: Link ID
 *     responses:
 *       200:
 *         description: Link deleted successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: Task or link not found
 */
router.delete("/tasks/:taskId/links/:linkId", authenticateToken, deleteLink);

/**
 * @swagger
 * /api/tasks/{taskId}/attachments:
 *   get:
 *     summary: Get all attachments of a task
 *     description: |
 *       Retrieves all active (non-deleted) attachments associated with a specific task.
 *       User must have permission to view the task to access its attachments.
 *     tags:
 *       - Task Attachments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID (MongoDB ObjectId)
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Task attachments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Task attachments retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     taskId:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439011"
 *                     taskTitle:
 *                       type: string
 *                       example: "Complete quarterly report"
 *                     attachments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439012"
 *                           originalName:
 *                             type: string
 *                             example: "document.pdf"
 *                           filename:
 *                             type: string
 *                             example: "1634567890123-document.pdf"
 *                           path:
 *                             type: string
 *                             example: "uploads/1634567890123-document.pdf"
 *                           size:
 *                             type: number
 *                             example: 102400
 *                           mimetype:
 *                             type: string
 *                             example: "application/pdf"
 *                           url:
 *                             type: string
 *                             example: "/uploads/1634567890123-document.pdf"
 *                           uploadedBy:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439010"
 *                           uploadedAt:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-10-23T10:30:00.000Z"
 *                           version:
 *                             type: number
 *                             example: 1
 *                           deleted:
 *                             type: boolean
 *                             example: false
 *                     totalCount:
 *                       type: number
 *                       example: 3
 *       403:
 *         description: Permission denied - User doesn't have access to view this task's attachments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "You do not have permission to view attachments of this task"
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Task not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Failed to fetch task attachments"
 *                 error:
 *                   type: string
 *                   example: "Database connection error"
 */
router.get("/tasks/:taskId/attachments", authenticateToken, getTaskAttachments);

/**
 * @swagger
 * /api/tasks/{taskId}/attachments:
 *   post:
 *     summary: Add attachments to a task
 *     description: |
 *       Uploads and adds one or multiple attachments to a specific task.
 *       User must have permission to modify the task to add attachments.
 *       Maximum 5 files can be uploaded at once.
 *     tags:
 *       - Task Attachments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID (MongoDB ObjectId)
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - attachments
 *             properties:
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Files to upload (max 5 files)
 *                 maxItems: 5
 *     responses:
 *       200:
 *         description: Attachments added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "2 attachment(s) added successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     taskId:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439011"
 *                     taskTitle:
 *                       type: string
 *                       example: "Complete quarterly report"
 *                     addedAttachments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           originalName:
 *                             type: string
 *                             example: "document.pdf"
 *                           filename:
 *                             type: string
 *                             example: "1634567890123-document.pdf"
 *                           path:
 *                             type: string
 *                             example: "uploads/1634567890123-document.pdf"
 *                           size:
 *                             type: number
 *                             example: 102400
 *                           mimetype:
 *                             type: string
 *                             example: "application/pdf"
 *                           url:
 *                             type: string
 *                             example: "/uploads/1634567890123-document.pdf"
 *                           uploadedBy:
 *                             type: string
 *                             example: "507f1f77bcf86cd799439010"
 *                           uploadedAt:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-10-23T10:30:00.000Z"
 *                           version:
 *                             type: number
 *                             example: 1
 *                           deleted:
 *                             type: boolean
 *                             example: false
 *                     totalAttachments:
 *                       type: number
 *                       example: 5
 *                       description: Total number of active attachments in the task
 *       400:
 *         description: Bad request - No files provided
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "No files provided. Please upload at least one attachment."
 *       403:
 *         description: Permission denied - User doesn't have access to modify this task
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "You do not have permission to add attachments to this task"
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Task not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Failed to add task attachments"
 *                 error:
 *                   type: string
 *                   example: "File upload error"
 */
router.post("/tasks/:taskId/attachments", authenticateToken, upload.array('attachments', 5), addTaskAttachments);

/**
 * @swagger
 * /api/tasks/{taskId}/attachments/{attachmentId}:
 *   delete:
 *     summary: Delete an attachment from a task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: The task ID
 *       - in: path
 *         name: attachmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: The attachment ID to delete
 *     responses:
 *       200:
 *         description: Attachment deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Attachment deleted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     taskId:
 *                       type: string
 *                     attachmentId:
 *                       type: string
 *                     totalAttachments:
 *                       type: number
 *       404:
 *         description: Task or attachment not found
 *       403:
 *         description: Permission denied
 */
router.delete("/tasks/:taskId/attachments/:attachmentId", authenticateToken, deleteTaskAttachment);

// ✅ Multer Error Handling Middleware
// Handle file upload errors with user-friendly messages
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    // Multer-specific errors
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'فائل اپ لوڈ کی حد سے تجاوز / File upload limit exceeded',
        error: `آپ ایک بار میں صرف 5 فائلیں اپ لوڈ کر سکتے ہیں۔ / You can upload maximum 5 files at a time.`,
        limits: {
          maxFiles: 5,
          maxFileSize: '10MB per file',
          totalMaxSize: '50MB (5 files × 10MB)',
          supportedFormats: 'PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF, TXT, CSV'
        }
      });
    } else if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'فائل کا سائز بہت بڑا ہے / File size too large',
        error: 'ایک یا زیادہ فائلیں 10MB کی حد سے زیادہ ہیں۔ / One or more files exceed the 10MB size limit.',
        limits: {
          maxFiles: 5,
          maxFileSize: '10MB per file',
          totalMaxSize: '50MB (5 files × 10MB)',
          supportedFormats: 'PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF, TXT, CSV'
        }
      });
    } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'تعداد فائلوں کی حد سے تجاوز / File upload limit exceeded',
        error: `آپ ایک بار میں صرف 5 فائلیں اپ لوڈ کر سکتے ہیں۔ براہ کرم فائلوں کی تعداد کم کریں۔ / You can only upload 5 files at a time. Please reduce the number of files.`,
        limits: {
          maxFiles: 5,
          maxFileSize: '10MB per file',
          totalMaxSize: '50MB (5 files × 10MB)',
          supportedFormats: 'PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF, TXT, CSV'
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'فائل اپ لوڈ کی خرابی / File upload error',
        error: error.message,
        limits: {
          maxFiles: 5,
          maxFileSize: '10MB per file',
          totalMaxSize: '50MB (5 files × 10MB)',
          supportedFormats: 'PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF, TXT, CSV'
        }
      });
    }
  } else if (error) {
    // Other errors
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'An error occurred',
      error: error.toString()
    });
  }
  next();
});

// ============================================
// 🎯 MILESTONE LINKED TASKS ROUTES
// ============================================

/**
 * @swagger
 * /api/milestones/{id}/link-task:
 *   post:
 *     summary: Link a task to a milestone
 *     description: Creates bidirectional mapping between milestone and task
 *     tags:
 *       - Milestones
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Milestone ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - taskId
 *             properties:
 *               taskId:
 *                 type: string
 *                 description: ID of the task to link
 *     responses:
 *       200:
 *         description: Task linked successfully
 *       400:
 *         description: Invalid request or validation error
 *       404:
 *         description: Milestone or task not found
 *       500:
 *         description: Server error
 */
router.post("/milestones/:id/link-task", authenticateToken, linkTaskToMilestone);

/**
 * @swagger
 * /api/milestones/{id}/unlink-task/{taskId}:
 *   delete:
 *     summary: Unlink a task from a milestone
 *     description: Removes bidirectional mapping between milestone and task
 *     tags:
 *       - Milestones
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Milestone ID
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID to unlink
 *     responses:
 *       200:
 *         description: Task unlinked successfully
 *       400:
 *         description: Task not linked to milestone
 *       404:
 *         description: Milestone or task not found
 *       500:
 *         description: Server error
 */
router.delete("/milestones/:id/unlink-task/:taskId", authenticateToken, unlinkTaskFromMilestone);

/**
 * @swagger
 * /api/milestones/{id}/linked-tasks:
 *   get:
 *     summary: Get all tasks linked to a milestone
 *     description: Returns detailed information about all linked tasks including completion status
 *     tags:
 *       - Milestones
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Milestone ID
 *     responses:
 *       200:
 *         description: List of linked tasks
 *       404:
 *         description: Milestone not found
 *       500:
 *         description: Server error
 */
router.get("/milestones/:id/linked-tasks", authenticateToken, getMilestoneLinkedTasks);

export default router;
