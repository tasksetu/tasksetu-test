import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     SupportTicket:
 *       type: object
 *       required:
 *         - subject
 *         - message
 *         - userId
 *         - organizationId
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated id of the support ticket
 *         subject:
 *           type: string
 *           description: Subject of the support ticket
 *         message:
 *           type: string
 *           description: Detailed message describing the issue
 *         priority:
 *           type: string
 *           enum: [low, normal, high, urgent]
 *           default: normal
 *           description: Priority level of the ticket
 *         status:
 *           type: string
 *           enum: [open, in_progress, waiting_response, resolved, closed]
 *           default: open
 *           description: Current status of the ticket
 *         category:
 *           type: string
 *           enum: [technical, billing, feature_request, bug_report, general, account]
 *           description: Category of the support request
 *         userId:
 *           type: string
 *           description: ID of the user who created the ticket
 *         organizationId:
 *           type: number
 *           description: ID of the organization
 *         userEmail:
 *           type: string
 *           description: Email of the user (for reference)
 *         userName:
 *           type: string
 *           description: Name of the user (for reference)
 *         assignedTo:
 *           type: string
 *           description: ID of the support agent assigned to this ticket
 *         assignedToName:
 *           type: string
 *           description: Name of the assigned support agent
 *         responses:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *               respondedBy:
 *                 type: string
 *               respondedByName:
 *                 type: string
 *               respondedAt:
 *                 type: string
 *                 format: date-time
 *               isInternal:
 *                 type: boolean
 *         attachments:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               fileName:
 *                 type: string
 *               fileUrl:
 *                 type: string
 *               uploadedAt:
 *                 type: string
 *                 format: date-time
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *         resolvedAt:
 *           type: string
 *           format: date-time
 *         closedAt:
 *           type: string
 *           format: date-time
 *         firstResponseAt:
 *           type: string
 *           format: date-time
 *         averageResponseTime:
 *           type: number
 *           description: Average response time in hours
 *         satisfactionRating:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *         satisfactionFeedback:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const supportTicketSchema = new mongoose.Schema(
    {
        subject: {
            type: String,
            required: [true, 'Subject is required'],
            trim: true,
            maxlength: [200, 'Subject cannot exceed 200 characters'],
        },
        message: {
            type: String,
            required: [true, 'Message is required'],
            trim: true,
            maxlength: [5000, 'Message cannot exceed 5000 characters'],
        },
        priority: {
            type: String,
            enum: ['low', 'normal', 'high', 'urgent'],
            default: 'normal',
            index: true,
            lowercase: true,
            trim: true
        },
        status: {
            type: String,
            enum: ['open', 'in_progress', 'waiting_response', 'resolved', 'closed'],
            default: 'open',
            index: true,
        },
        category: {
            type: String,
            enum: ['technical', 'billing', 'feature_request', 'bug_report', 'general', 'account'],
            default: 'general',
        },
        userId: {
            type: String,
            required: true,
            index: true,
        },
        organizationId: {
            type: String,
            required: false, // Optional for individual users
            index: true,
            default: null,
        },
        userEmail: {
            type: String,
            required: true,
        },
        userName: {
            type: String,
            required: true,
        },
        assignedTo: {
            type: String,
            index: true,
        },
        assignedToName: String,
        responses: [
            {
                message: {
                    type: String,
                    required: true,
                },
                respondedBy: {
                    type: String,
                    required: true,
                },
                respondedByName: String,
                respondedAt: {
                    type: Date,
                    default: Date.now,
                },
                isInternal: {
                    type: Boolean,
                    default: false, // Internal notes visible only to support team
                },
            },
        ],
        attachments: [
            {
                fileName: String,
                fileUrl: String,
                fileSize: Number,
                mimeType: String,
                uploadedAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        tags: [
            {
                type: String,
                trim: true,
            },
        ],
        resolvedAt: Date,
        closedAt: Date,
        firstResponseAt: Date,
        averageResponseTime: Number, // in hours
        satisfactionRating: {
            type: Number,
            min: 1,
            max: 5,
        },
        satisfactionFeedback: String,
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Indexes for better query performance
supportTicketSchema.index({ userId: 1, createdAt: -1 });
supportTicketSchema.index({ organizationId: 1, status: 1 });
supportTicketSchema.index({ status: 1, priority: 1 });
supportTicketSchema.index({ assignedTo: 1, status: 1 });

// Virtual for response count
supportTicketSchema.virtual('responseCount').get(function () {
    return this.responses ? this.responses.length : 0;
});

// Virtual for is resolved
supportTicketSchema.virtual('isResolved').get(function () {
    return this.status === 'resolved' || this.status === 'closed';
});

// Calculate average response time
supportTicketSchema.methods.calculateAverageResponseTime = function () {
    if (!this.responses || this.responses.length === 0) return null;

    let totalTime = 0;
    let count = 0;

    for (let i = 0; i < this.responses.length; i++) {
        const responseTime = this.responses[i].respondedAt;
        const previousTime = i === 0 ? this.createdAt : this.responses[i - 1].respondedAt;
        const diff = (responseTime - previousTime) / (1000 * 60 * 60); // Convert to hours
        totalTime += diff;
        count++;
    }

    return count > 0 ? totalTime / count : null;
};

// Pre-save middleware to update firstResponseAt and averageResponseTime
supportTicketSchema.pre('save', function (next) {
    if (this.responses && this.responses.length > 0 && !this.firstResponseAt) {
        this.firstResponseAt = this.responses[0].respondedAt;
    }

    if (this.isModified('responses')) {
        this.averageResponseTime = this.calculateAverageResponseTime();
    }

    if (this.status === 'resolved' && !this.resolvedAt) {
        this.resolvedAt = new Date();
    }

    if (this.status === 'closed' && !this.closedAt) {
        this.closedAt = new Date();
    }

    next();
});

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);

export default SupportTicket;
