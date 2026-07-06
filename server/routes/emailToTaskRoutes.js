/**
 * Email to Task Routes
 * API endpoints for managing email-to-task functionality
 */

import express from 'express';
import { authenticateToken } from '../middleware/roleAuth.js';
import { emailToTaskService } from '../services/emailToTaskService.js';

const router = express.Router();

/**
 * @swagger
 * /api/email-to-task/status:
 *   get:
 *     summary: Get email-to-task service status
 *     tags: [Email To Task]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Service status returned successfully
 */
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const status = emailToTaskService.getStatus();
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('[EMAIL-TO-TASK] Error getting status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get service status',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/email-to-task/check:
 *   post:
 *     summary: Manually trigger email check
 *     tags: [Email To Task]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Email check completed
 */
router.post('/check', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        const userRole = req.user.role || req.user.roles?.[0];
        if (!['org_admin', 'admin', 'super_admin'].includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: 'Only admins can trigger email checks'
            });
        }

        console.log('[EMAIL-TO-TASK] Manual email check triggered by:', req.user.email);

        const result = await emailToTaskService.triggerCheck();

        res.json({
            success: true,
            message: `Processed ${result.processed} emails, created ${result.tasks?.length || 0} tasks`,
            data: {
                processed: result.processed,
                tasksCreated: result.tasks?.length || 0,
                tasks: result.tasks?.map(t => ({
                    id: t._id,
                    title: t.title,
                    status: t.status
                }))
            }
        });
    } catch (error) {
        console.error('[EMAIL-TO-TASK] Error checking emails:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check emails',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/email-to-task/start:
 *   post:
 *     summary: Start email polling service
 *     tags: [Email To Task]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               intervalMinutes:
 *                 type: number
 *                 default: 5
 *     responses:
 *       200:
 *         description: Service started successfully
 */
router.post('/start', authenticateToken, async (req, res) => {
    try {
        const userRole = req.user.role || req.user.roles?.[0];
        if (!['org_admin', 'admin', 'super_admin'].includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: 'Only admins can control email service'
            });
        }

        const { intervalMinutes = 5 } = req.body;

        await emailToTaskService.start(intervalMinutes);

        res.json({
            success: true,
            message: `Email polling service started (checking every ${intervalMinutes} minutes)`,
            data: emailToTaskService.getStatus()
        });
    } catch (error) {
        console.error('[EMAIL-TO-TASK] Error starting service:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start email service',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/email-to-task/stop:
 *   post:
 *     summary: Stop email polling service
 *     tags: [Email To Task]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Service stopped successfully
 */
router.post('/stop', authenticateToken, async (req, res) => {
    try {
        const userRole = req.user.role || req.user.roles?.[0];
        if (!['org_admin', 'admin', 'super_admin'].includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: 'Only admins can control email service'
            });
        }

        emailToTaskService.stop();

        res.json({
            success: true,
            message: 'Email polling service stopped',
            data: emailToTaskService.getStatus()
        });
    } catch (error) {
        console.error('[EMAIL-TO-TASK] Error stopping service:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to stop email service',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/email-to-task/config:
 *   get:
 *     summary: Get email configuration (masked)
 *     tags: [Email To Task]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuration returned successfully
 */
router.get('/config', authenticateToken, async (req, res) => {
    try {
        const status = emailToTaskService.getStatus();

        // Mask the email for security
        const maskedEmail = status.email
            ? status.email.replace(/(.{3})(.*)(@.*)/, '$1***$3')
            : 'Not configured';

        res.json({
            success: true,
            data: {
                email: maskedEmail,
                imapHost: status.imapHost,
                isRunning: status.isRunning,
                instructions: {
                    howToUse: 'Send an email to the configured email address to create a task',
                    emailFormat: {
                        to: status.email || 'tasksetu@gmail.com',
                        subject: 'Your email subject becomes the task title',
                        body: 'Your email body becomes the task description'
                    },
                    notes: [
                        'Tasks are created with MEDIUM priority',
                        'Due date is set to 7 days from creation',
                        'Task is assigned to the sender (if registered) or admin',
                        'Email must be from a registered user for proper assignment'
                    ]
                }
            }
        });
    } catch (error) {
        console.error('[EMAIL-TO-TASK] Error getting config:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get configuration',
            error: error.message
        });
    }
});

export default router;
