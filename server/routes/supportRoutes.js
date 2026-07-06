import express from 'express';
import SupportTicket from '../modals/supportTicketModal.js';
import { authenticateToken, roleAuth } from '../middleware/roleAuth.js';
import * as licenseService from '../services/licenseService.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as r2Storage from '../services/r2Storage.js';
import { wrapMulterMiddleware } from '../utils/upload.js';

const router = express.Router();

// Multer configuration for support ticket file uploads
const supportStorage = r2Storage.isR2Enabled()
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: (req, file, cb) => {
            const uploadDir = path.join(process.cwd(), 'uploads/support-tickets/');
            fs.mkdirSync(uploadDir, { recursive: true });
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname);
            const uniqueName = `support-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
            cb(null, uniqueName);
        },
    });

const supportFileFilter = (req, file, cb) => {
    const allowedTypes = ['jpeg', 'jpg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xlsx', 'xls', 'txt', 'csv', 'zip'];
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (allowedTypes.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('File type not allowed'), false);
    }
};

const supportUpload = wrapMulterMiddleware(multer({
    storage: supportStorage,
    fileFilter: supportFileFilter,
    limits: { fileSize: 10 * 1024 * 1024 },
}).array('attachments', 5));

/**
 * ✅ License Feature: DED_SUPPORT (Dedicated Support)
 * - Basic support (low/normal priority): Available to all
 * - Priority support (high/urgent): Requires DED_SUPPORT feature
 */

/**
 * Helper middleware to check dedicated support access for priority tickets
 */
const checkPrioritySupportAccess = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const priority = req.body?.priority;

        // High/urgent priority requires DED_SUPPORT feature
        const priorityRequiresFeature = ['high', 'urgent'];

        if (priority && priorityRequiresFeature.includes(priority)) {
            console.log('🔐 [DED_SUPPORT CHECK] Checking dedicated support access for priority:', priority);

            const accessCheck = await licenseService.checkFeatureAccess(userId, 'DED_SUPPORT');

            if (!accessCheck.hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: 'High/Urgent priority support requires a plan with Dedicated Support',
                    error: 'FEATURE_NOT_AVAILABLE',
                    feature: 'DED_SUPPORT',
                    upgradeRequired: true,
                    showUpgradeModal: true,
                    allowedPriorities: ['low', 'normal'],
                });
            }
        }

        next();
    } catch (error) {
        console.error('❌ Error checking dedicated support access:', error);
        res.status(500).json({
            success: false,
            error: 'Error checking feature access'
        });
    }
};

/**
 * @swagger
 * /api/support/tickets:
 *   post:
 *     summary: Create a new support ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subject
 *               - message
 *             properties:
 *               subject:
 *                 type: string
 *                 description: Subject of the support ticket
 *               message:
 *                 type: string
 *                 description: Detailed message
 *               priority:
 *                 type: string
 *                 enum: [low, normal, high, urgent]
 *                 default: normal
 *               category:
 *                 type: string
 *                 enum: [technical, billing, feature_request, bug_report, general, account]
 *     responses:
 *       201:
 *         description: Support ticket created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post('/tickets', authenticateToken, (req, res, next) => {
    supportUpload(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ success: false, error: 'File size exceeds 10MB limit' });
            if (err.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ success: false, error: 'Maximum 5 files allowed' });
            return res.status(400).json({ success: false, error: err.message });
        }
        if (err) return res.status(400).json({ success: false, error: 'File upload failed' });
        next();
    });
}, checkPrioritySupportAccess, async (req, res) => {
    try {
        const { subject, message, priority = 'normal', category = 'general' } = req.body;

        // Validate required fields
        if (!subject || !message) {
            return res.status(400).json({
                success: false,
                error: 'Subject and message are required',
            });
        }

        // Get user information from authenticated token
        const userId = req.user.id?.toString() || req.user.id;
        const userEmail = req.user.email;
        const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || userEmail;
        const organizationId = req.user.organizationId?.toString() || req.user.organizationId || null;

        // Create support ticket (organizationId is optional for individual users)
        const ticketData = {
            subject,
            message,
            priority,
            category,
            userId,
            userEmail,
            userName,
        };

        // Only add organizationId if it exists (for company/org users)
        if (organizationId) {
            ticketData.organizationId = organizationId;
        }

        // Process uploaded files
        if (req.files && req.files.length > 0) {
            const attachmentPromises = req.files.map(async (file) => {
                let fileUrl = `/uploads/support-tickets/${file.filename}`;
                
                if (r2Storage.isR2Enabled()) {
                    try {
                        const uniqueName = file.filename || `support-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
                        const key = `support-tickets/${uniqueName}`;
                        const buffer = file.buffer;
                        await r2Storage.uploadToR2(buffer, key, file.mimetype);
                        fileUrl = r2Storage.getPublicUrl(key) || `/uploads/${key}`;
                    } catch (r2Error) {
                        console.error('❌ Failed to upload support attachment to R2:', r2Error.message);
                    }
                }

                return {
                    fileName: file.originalname,
                    fileUrl: fileUrl,
                    fileSize: file.size,
                    mimeType: file.mimetype,
                };
            });

            ticketData.attachments = await Promise.all(attachmentPromises);
        }

        const ticket = new SupportTicket(ticketData);

        await ticket.save();

        // 📊 Track DED_SUPPORT usage for high/urgent priority tickets
        const priorityRequiresTracking = ['high', 'urgent'];
        if (priorityRequiresTracking.includes(priority)) {
            try {
                await licenseService.consumeFeature(userId, 'DED_SUPPORT', 1);
                console.log(`[SupportRoutes] 📊 DED_SUPPORT usage tracked for user ${userId}`);
            } catch (usageError) {
                console.error('[SupportRoutes] ⚠️ Failed to track DED_SUPPORT usage:', usageError.message);
            }
        }

        res.status(201).json({
            success: true,
            message: 'Support ticket created successfully',
            data: ticket,
        });
    } catch (error) {
        console.error('Create support ticket error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create support ticket',
        });
    }
});

/**
 * @swagger
 * /api/support/tickets:
 *   get:
 *     summary: Get all support tickets for the authenticated user
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, in_progress, waiting_response, resolved, closed]
 *         description: Filter by status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, normal, high, urgent]
 *         description: Filter by priority
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of support tickets
 *       401:
 *         description: Unauthorized
 */
router.get('/tickets', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id?.toString() || req.user.id;
        const { status, priority, page = 1, limit = 10 } = req.query;

        const query = { userId };

        // Add filters if provided
        if (status) query.status = status;
        if (priority) query.priority = priority;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [tickets, totalCount] = await Promise.all([
            SupportTicket.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            SupportTicket.countDocuments(query),
        ]);

        res.json({
            success: true,
            data: {
                tickets,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    totalCount,
                    limit: parseInt(limit),
                },
            },
        });
    } catch (error) {
        console.error('Get support tickets error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch support tickets',
        });
    }
});

/**
 * @swagger
 * /api/support/tickets/{id}:
 *   get:
 *     summary: Get a specific support ticket by ID
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket ID
 *     responses:
 *       200:
 *         description: Support ticket details
 *       404:
 *         description: Ticket not found
 *       401:
 *         description: Unauthorized
 */
router.get('/tickets/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id?.toString() || req.user.id;

        const ticket = await SupportTicket.findOne({
            _id: id,
            userId,
        });

        if (!ticket) {
            return res.status(404).json({
                success: false,
                error: 'Support ticket not found',
            });
        }

        res.json({
            success: true,
            data: ticket,
        });
    } catch (error) {
        console.error('Get support ticket error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch support ticket',
        });
    }
});

/**
 * @swagger
 * /api/support/tickets/{id}:
 *   patch:
 *     summary: Update a support ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subject:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, normal, high, urgent]
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Ticket updated successfully
 *       404:
 *         description: Ticket not found
 */
router.patch('/tickets/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id?.toString() || req.user.id;
        const { subject, priority, category } = req.body;

        const updateData = {};
        if (subject) updateData.subject = subject;
        if (priority) updateData.priority = priority;
        if (category) updateData.category = category;

        const ticket = await SupportTicket.findOneAndUpdate(
            { _id: id, userId },
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!ticket) {
            return res.status(404).json({
                success: false,
                error: 'Support ticket not found',
            });
        }

        res.json({
            success: true,
            message: 'Support ticket updated successfully',
            data: ticket,
        });
    } catch (error) {
        console.error('Update support ticket error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update support ticket',
        });
    }
});

/**
 * @swagger
 * /api/support/tickets/{id}/response:
 *   post:
 *     summary: Add a response to a support ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Response added successfully
 *       404:
 *         description: Ticket not found
 */
router.post('/tickets/:id/response', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id?.toString() || req.user.id;
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'Message is required',
            });
        }

        const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;

        const ticket = await SupportTicket.findOne({ _id: id, userId });

        if (!ticket) {
            return res.status(404).json({
                success: false,
                error: 'Support ticket not found',
            });
        }

        ticket.responses.push({
            message,
            respondedBy: userId,
            respondedByName: userName,
            respondedAt: new Date(),
            isInternal: false,
        });

        // Update status to waiting_response if it was open
        if (ticket.status === 'open' || ticket.status === 'in_progress') {
            ticket.status = 'waiting_response';
        }

        await ticket.save();

        res.json({
            success: true,
            message: 'Response added successfully',
            data: ticket,
        });
    } catch (error) {
        console.error('Add response error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to add response',
        });
    }
});

/**
 * @swagger
 * /api/support/tickets/{id}/close:
 *   patch:
 *     summary: Close a support ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               satisfactionRating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               satisfactionFeedback:
 *                 type: string
 *     responses:
 *       200:
 *         description: Ticket closed successfully
 *       404:
 *         description: Ticket not found
 */
router.patch('/tickets/:id/close', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id?.toString() || req.user.id;
        const { satisfactionRating, satisfactionFeedback } = req.body;

        const updateData = {
            status: 'closed',
            closedAt: new Date(),
        };

        if (satisfactionRating) {
            updateData.satisfactionRating = satisfactionRating;
        }
        if (satisfactionFeedback) {
            updateData.satisfactionFeedback = satisfactionFeedback;
        }

        const ticket = await SupportTicket.findOneAndUpdate(
            { _id: id, userId },
            { $set: updateData },
            { new: true }
        );

        if (!ticket) {
            return res.status(404).json({
                success: false,
                error: 'Support ticket not found',
            });
        }

        res.json({
            success: true,
            message: 'Support ticket closed successfully',
            data: ticket,
        });
    } catch (error) {
        console.error('Close support ticket error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to close support ticket',
        });
    }
});

/**
 * @swagger
 * /api/support/tickets/{id}:
 *   delete:
 *     summary: Delete a support ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket ID
 *     responses:
 *       200:
 *         description: Ticket deleted successfully
 *       404:
 *         description: Ticket not found
 */
router.delete('/tickets/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id?.toString() || req.user.id;

        const ticket = await SupportTicket.findOneAndDelete({
            _id: id,
            userId,
        });

        if (!ticket) {
            return res.status(404).json({
                success: false,
                error: 'Support ticket not found',
            });
        }

        res.json({
            success: true,
            message: 'Support ticket deleted successfully',
        });
    } catch (error) {
        console.error('Delete support ticket error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to delete support ticket',
        });
    }
});

// ==================== ADMIN ROUTES ====================

/**
 * @swagger
 * /api/support/admin/tickets:
 *   get:
 *     summary: Get all support tickets (Admin only)
 *     tags: [Support Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *       - in: query
 *         name: organizationId
 *         schema:
 *           type: number
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of all support tickets
 */
router.get('/admin/tickets', authenticateToken, roleAuth(['org_admin', 'super_admin']), async (req, res) => {
    try {
        const { status, priority, organizationId, page = 1, limit = 20 } = req.query;

        const query = {};

        // If not super_admin, filter by organization
        if (req.user.role !== 'super_admin') {
            query.organizationId = req.user.organizationId?.toString() || req.user.organizationId;
        } else if (organizationId) {
            query.organizationId = organizationId;
        }

        if (status) query.status = status;
        if (priority) query.priority = priority;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [tickets, totalCount] = await Promise.all([
            SupportTicket.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            SupportTicket.countDocuments(query),
        ]);

        res.json({
            success: true,
            data: {
                tickets,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    totalCount,
                    limit: parseInt(limit),
                },
            },
        });
    } catch (error) {
        console.error('Get admin support tickets error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch support tickets',
        });
    }
});

/**
 * @swagger
 * /api/support/admin/tickets/{id}/assign:
 *   patch:
 *     summary: Assign a support ticket to an agent (Admin only)
 *     tags: [Support Admin]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/admin/tickets/:id/assign', authenticateToken, roleAuth(['org_admin', 'super_admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { assignedTo, assignedToName } = req.body;

        const ticket = await SupportTicket.findByIdAndUpdate(
            id,
            {
                $set: {
                    assignedTo,
                    assignedToName,
                    status: 'in_progress',
                },
            },
            { new: true }
        );

        if (!ticket) {
            return res.status(404).json({
                success: false,
                error: 'Support ticket not found',
            });
        }

        res.json({
            success: true,
            message: 'Ticket assigned successfully',
            data: ticket,
        });
    } catch (error) {
        console.error('Assign ticket error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to assign ticket',
        });
    }
});

/**
 * @swagger
 * /api/support/admin/tickets/{id}/status:
 *   patch:
 *     summary: Update ticket status (Admin only)
 *     tags: [Support Admin]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/admin/tickets/:id/status', authenticateToken, roleAuth(['org_admin', 'super_admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const ticket = await SupportTicket.findByIdAndUpdate(
            id,
            { $set: { status } },
            { new: true }
        );

        if (!ticket) {
            return res.status(404).json({
                success: false,
                error: 'Support ticket not found',
            });
        }

        res.json({
            success: true,
            message: 'Ticket status updated successfully',
            data: ticket,
        });
    } catch (error) {
        console.error('Update ticket status error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update ticket status',
        });
    }
});

/**
 * @swagger
 * /api/support/admin/tickets/{id}/response:
 *   post:
 *     summary: Add a response to a support ticket (Admin only)
 *     tags: [Support Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post('/admin/tickets/:id/response', authenticateToken, roleAuth(['org_admin', 'super_admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'Message is required',
            });
        }

        const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;
        const userId = req.user.id?.toString() || req.user.id;

        const ticket = await SupportTicket.findById(id);

        if (!ticket) {
            return res.status(404).json({
                success: false,
                error: 'Support ticket not found',
            });
        }

        ticket.responses.push({
            message,
            respondedBy: userId,
            respondedByName: `${userName} (Support)`,
            respondedAt: new Date(),
            isInternal: false,
        });

        // Set status to waiting_response when admin responds
        ticket.status = 'waiting_response';

        await ticket.save();

        res.json({
            success: true,
            message: 'Response added successfully',
            data: ticket,
        });
    } catch (error) {
        console.error('Admin response error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to add response',
        });
    }
});

export default router;
