import express from 'express';
const router = express.Router();

// Import controllers
import {
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
} from '../controller/milestoneTaskController.js';

// Import middleware
import { authenticateToken } from '../auth.js';
import {
  checkMilestoneAccess,
  validateMilestoneCreation,
  rateLimitMilestoneCreation
} from '../middleware/milestoneTaskMiddleware.js';
import { checkFeatureAccess } from '../middleware/licenseMiddleware.js';

// All routes require authentication
router.use((req, res, next) => {
  console.log('🔍 Milestone Task Route - Before Auth:', {
    path: req.path, 
    method: req.method,
    headers: Object.keys(req.headers),
    hasAuth: !!req.headers.authorization
  });
  next();
});

router.use(authenticateToken);

router.use((req, res, next) => {
  console.log('✅ Milestone Task Route - After Auth:', {
    path: req.path,
    user: req.user ? { id: req.user.id, email: req.user.email, role: req.user.role } : 'NO USER'
  });
  next();
});

/**
 * @swagger
 * /api/milestone-tasks/stats:
 *   get:
 *     summary: Get milestone task statistics for authenticated user
 *     tags: [Milestone Tasks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved milestone statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 stats:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     byStatus:
 *                       type: object
 *                       properties:
 *                         OPEN:
 *                           type: number
 *                         INPROGRESS:
 *                           type: number
 *                         ACHIEVED:
 *                           type: number
 *                         CANCELLED:
 *                           type: number
 *       401:
 *         description: Unauthorized
 */
router.get('/stats', getMilestoneStats);

/**
 * @swagger
 * /api/milestone-tasks:
 *   get:
 *     summary: Get all milestone tasks for authenticated user
 *     tags: [Milestone Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, OPEN, INPROGRESS, ACHIEVED, CANCELLED]
 *         description: Filter by milestone status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [all, low, medium, high, critical]
 *         description: Filter by priority
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in title and description
 *       - in: query
 *         name: overdue
 *         schema:
 *           type: boolean
 *         description: Filter overdue milestones
 *     responses:
 *       200:
 *         description: Successfully retrieved milestone tasks
 *       401:
 *         description: Unauthorized
 */
router.get('/', getMilestoneTasks);

/**
 * @swagger
 * /api/milestone-tasks:
 *   post:
 *     summary: Create a new milestone task
 *     tags: [Milestone Tasks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - assignedTo
 *               - dueDate
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *                 description: Milestone title
 *               description:
 *                 type: string
 *                 maxLength: 2000
 *                 description: Milestone description
 *               assignedTo:
 *                 type: string
 *                 format: objectId
 *                 description: User ID to assign milestone to
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *                 default: medium
 *                 description: Milestone priority
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 description: Due date for milestone
 *               linkedTasks:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     taskId:
 *                       type: string
 *                       format: objectId
 *                     completionPercentage:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 100
 *                 description: Tasks to link to this milestone
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Milestone tags
 *     responses:
 *       201:
 *         description: Milestone task created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions (Manager+ required)
 */
router.post('/', checkFeatureAccess('TASK_MSTONE'), rateLimitMilestoneCreation, validateMilestoneCreation, createMilestoneTask);

/**
 * @swagger
 * /api/milestone-tasks/{id}:
 *   get:
 *     summary: Get single milestone task by ID
 *     tags: [Milestone Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Milestone task ID
 *     responses:
 *       200:
 *         description: Successfully retrieved milestone task
 *       404:
 *         description: Milestone task not found
 *       403:
 *         description: Access denied
 *       401:
 *         description: Unauthorized
 */
router.get('/:id', getMilestoneTask);

/**
 * @swagger
 * /api/milestone-tasks/{id}:
 *   put:
 *     summary: Update a milestone task
 *     tags: [Milestone Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Milestone task ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *                 description: Milestone title
 *               description:
 *                 type: string
 *                 maxLength: 2000
 *                 description: Milestone description
 *               assignedTo:
 *                 type: string
 *                 format: objectId
 *                 description: User ID to assign milestone to
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *                 description: Milestone priority
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 description: Due date for milestone
 *               status:
 *                 type: string
 *                 enum: [OPEN, INPROGRESS, ACHIEVED, CANCELLED]
 *                 description: Milestone status
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Milestone tags
 *     responses:
 *       200:
 *         description: Milestone task updated successfully
 *       404:
 *         description: Milestone task not found
 *       403:
 *         description: Access denied
 *       401:
 *         description: Unauthorized
 */
router.put('/:id', updateMilestoneTask);

/**
 * @swagger
 * /api/milestone-tasks/{id}:
 *   delete:
 *     summary: Delete a milestone task
 *     tags: [Milestone Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Milestone task ID
 *     responses:
 *       200:
 *         description: Milestone task deleted successfully
 *       404:
 *         description: Milestone task not found
 *       403:
 *         description: Access denied (Creator or Admin only)
 *       401:
 *         description: Unauthorized
 */
router.delete('/:id', deleteMilestoneTask);

/**
 * @swagger
 * /api/milestone-tasks/{id}/link-task:
 *   post:
 *     summary: Link a task to milestone
 *     tags: [Milestone Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Milestone task ID
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
 *                 format: objectId
 *                 description: ID of task to link
 *               completionPercentage:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 default: 0
 *                 description: Current completion percentage of task
 *     responses:
 *       200:
 *         description: Task linked to milestone successfully
 *       404:
 *         description: Milestone or task not found
 *       403:
 *         description: Access denied
 *       401:
 *         description: Unauthorized
 */
router.post('/:id/link-task', linkTaskToMilestone);

/**
 * @swagger
 * /api/milestone-tasks/{id}/unlink-task/{taskId}:
 *   delete:
 *     summary: Unlink a task from milestone
 *     tags: [Milestone Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Milestone task ID
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID to unlink
 *     responses:
 *       200:
 *         description: Task unlinked from milestone successfully
 *       404:
 *         description: Milestone or task not found
 *       403:
 *         description: Access denied
 *       401:
 *         description: Unauthorized
 */
router.delete('/:id/unlink-task/:taskId', unlinkTaskFromMilestone);

/**
 * @swagger
 * /api/milestone-tasks/{id}/comments:
 *   post:
 *     summary: Add comment to milestone
 *     tags: [Milestone Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Milestone task ID
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
 *                 minLength: 1
 *                 maxLength: 1000
 *                 description: Comment text
 *     responses:
 *       200:
 *         description: Comment added successfully
 *       404:
 *         description: Milestone task not found
 *       403:
 *         description: Access denied
 *       401:
 *         description: Unauthorized
 */
router.post('/:id/comments', addCommentToMilestone);

/**
 * @swagger
 * /api/milestone-tasks/{id}/achieve:
 *   patch:
 *     summary: Mark milestone as achieved
 *     tags: [Milestone Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Milestone task ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               forced:
 *                 type: boolean
 *                 default: false
 *                 description: Force achieve even if not all linked tasks are complete (Admin only)
 *     responses:
 *       200:
 *         description: Milestone marked as achieved successfully
 *       404:
 *         description: Milestone task not found
 *       403:
 *         description: Access denied
 *       401:
 *         description: Unauthorized
 */
router.patch('/:id/achieve', markMilestoneAsAchieved);

export default router;