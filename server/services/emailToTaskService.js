/**
 * Email to Task Service - COMPREHENSIVE VERSION
 * 
 * Features:
 * - Phase I: Basic email to task conversion
 *   - Subject → Task Title (max 100 chars)
 *   - Body → Task Description
 *   - Attachments → Task Attachments (with size limit handling)
 *   - Defaults: Assignee = Sender, Priority = Medium, Due Date = None
 * 
 * - Phase II: Smart parsing
 *   - Keywords: due: tomorrow, priority: high, @username → auto-mapped
 * 
 * - Phase III: Reply to notification → Task comment
 * 
 * Error Handling:
 * - Unauthorized sender → rejection email
 * - Empty subject → "(No Subject)"
 * - Attachment size > limit → skip attachment + error message
 * - Ambiguous parsing → apply defaults, notify user
 */

import Imap from 'imap';
import { simpleParser } from 'mailparser';
import mongoose from 'mongoose';
import Task from '../modals/taskModal.js';
import { User } from '../modals/userModal.js';
import { Organization } from '../modals/organizationModal.js';
import { storage } from '../mongodb-storage.js';
import { emailService } from './emailService.js';
import * as licenseService from './licenseService.js';
import { TimezoneHelper } from '../utils/timezoneHelper.js';
import path from 'path';
import fs from 'fs';
import * as r2Storage from './r2Storage.js';

// Configuration constants
const CONFIG = {
    TASK_TITLE_MAX_LENGTH: 100,
    TASK_DESCRIPTION_MAX_LENGTH: 5000,
    ATTACHMENT_MAX_SIZE_MB: 10, // 10MB per file
    ATTACHMENT_MAX_SIZE_BYTES: 10 * 1024 * 1024,
    TOTAL_ATTACHMENTS_MAX_SIZE_MB: 25,
    TOTAL_ATTACHMENTS_MAX_SIZE_BYTES: 25 * 1024 * 1024,
    MAX_ATTACHMENTS_COUNT: 5,
    DEFAULT_DUE_DAYS: 7,
    TASK_ID_PATTERN: /\[Task-([a-f0-9]{24})\]/i, // Pattern to detect task ID in email subject
    REPLY_PREFIX_PATTERN: /^(Re|RE|Fwd|FWD|Fw|FW):\s*/i,
};

// Priority keywords mapping
const PRIORITY_KEYWORDS = {
    'urgent': 'urgent',
    'critical': 'urgent',
    'asap': 'urgent',
    'high': 'high',
    'important': 'high',
    'medium': 'medium',
    'normal': 'medium',
    'low': 'low',
    'minor': 'low'
};

// Due date keywords mapping
const DUE_DATE_KEYWORDS = {
    'today': 0,
    'tomorrow': 1,
    'eod': 0, // End of day
    'eow': null, // End of week - calculated
    'eom': null, // End of month - calculated
    'next week': 7,
    'next month': 30,
    '1 day': 1,
    '2 days': 2,
    '3 days': 3,
    '1 week': 7,
    '2 weeks': 14,
    '1 month': 30
};

class EmailToTaskService {
    constructor() {
        this.isRunning = false;
        this.imap = null;
        this.serviceStartTime = null;
        this.reconnectTimeout = null;
        this.processedEmails = new Set(); // Track processed UIDs
        this.uploadDir = path.join(process.cwd(), 'uploads', 'email-attachments');

        this.config = {
            user: (process.env.EMAIL_TO_TASK_EMAIL || process.env.SMTP_USERNAME || '').trim(),
            password: (process.env.EMAIL_TO_TASK_PASSWORD || process.env.SMTP_PASSWORD || '').replace(/\s+/g, ''),
            host: process.env.EMAIL_TO_TASK_IMAP_HOST || 'imap.gmail.com',
            port: parseInt(process.env.EMAIL_TO_TASK_IMAP_PORT || '993'),
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            keepalive: true,
            authTimeout: 30000, // Increase timeout to 30 seconds
            connTimeout: 30000  // Connection timeout as well
        };

        // Ensure upload directory exists (only if R2 is disabled)
        if (!r2Storage.isR2Enabled()) {
            this.ensureUploadDir();
        }

        // console.log('📧 [EMAIL-TO-TASK] ⚡ Comprehensive service initialized');
        // console.log('📧 [EMAIL-TO-TASK] Email:', this.config.user);
        // console.log('📧 [EMAIL-TO-TASK] IMAP Host:', this.config.host);
        // console.log('📧 [EMAIL-TO-TASK] Features: Phase I (Basic), Phase II (Smart Parsing), Phase III (Reply-to-Comment)');
    }

    /**
     * Ensure upload directory exists
     */
    ensureUploadDir() {
        try {
            if (!fs.existsSync(this.uploadDir)) {
                fs.mkdirSync(this.uploadDir, { recursive: true });
                console.log('📧 [EMAIL-TO-TASK] Created upload directory:', this.uploadDir);
            }
        } catch (error) {
            console.error('📧 [EMAIL-TO-TASK] Failed to create upload directory:', error.message);
        }
    }

    /**
     * Start REAL-TIME email monitoring using IMAP IDLE
     */
    async start() {
        if (process.env.DISABLE_EMAIL_TO_TASK === 'true') {
            console.log('📧 [EMAIL-TO-TASK] Service is DISABLED via environment variable');
            return;
        }

        if (this.isRunning) {
            console.log('📧 [EMAIL-TO-TASK] Service already running');
            return;
        }

        if (!this.config.user || !this.config.password) {
            console.error('📧 [EMAIL-TO-TASK] ❌ Missing email credentials');
            return;
        }

        this.isRunning = true;
        this.serviceStartTime = new Date();

        // console.log('📧 [EMAIL-TO-TASK] 🚀 Starting REAL-TIME email monitoring...');
        // console.log('📧 [EMAIL-TO-TASK] ⏰ Service start time:', this.serviceStartTime.toISOString());
        // console.log('📧 [EMAIL-TO-TASK] ⚡ Using IMAP IDLE - emails appear INSTANTLY!');

        await this.connectAndListen();
    }

    /**
     * Connect to IMAP and listen for new emails in real-time
     */
    async connectAndListen() {
        return new Promise((resolve, reject) => {
            // If already connected, resolve
            if (this.imap && this.imap.state === 'authenticated') {
                return resolve();
            }

            this.imap = new Imap(this.config);

            this.imap.once('ready', () => {
                console.log('📧 [EMAIL-TO-TASK] ✅ IMAP Connected!');

                this.imap.openBox('INBOX', false, (err, box) => {
                    if (err) {
                        console.error('📧 [EMAIL-TO-TASK] ❌ Error opening INBOX:', err);
                        // If we fail here, we still resolve because the connection itself was successful
                        // but there's a problem with the mailbox access. Reconnect will handle it.
                        resolve();
                        this.scheduleReconnect();
                        return;
                    }

                    console.log('📧 [EMAIL-TO-TASK] 📬 Inbox opened. Total:', box.messages.total);
                    console.log('📧 [EMAIL-TO-TASK] 👂 Listening for new emails in REAL-TIME...');
                    console.log('📧 [EMAIL-TO-TASK] 🎯 Tasks will appear INSTANTLY when email arrives!');

                    // Process any existing unread emails
                    this.processUnreadEmails();

                    resolve();
                });
            });

            // 🔔 NEW EMAIL!
            this.imap.on('mail', (numNewMsgs) => {
                console.log(`\n📧 [EMAIL-TO-TASK] 🔔🔔🔔 NEW EMAIL! (${numNewMsgs} new)`);
                console.log('📧 [EMAIL-TO-TASK] ⚡ Processing immediately...');
                this.processUnreadEmails();
            });

            this.imap.once('error', (err) => {
                console.error('📧 [EMAIL-TO-TASK] ❌ IMAP Error:', err.message);

                // CRITICAL: We must resolve/reject so the server initialization can continue
                // We resolve here because we want the main server to start even if IMAP fails
                resolve();

                this.scheduleReconnect();
            });

            this.imap.once('close', () => {
                console.log('📧 [EMAIL-TO-TASK] Connection closed');
                if (this.isRunning) this.scheduleReconnect();
            });

            this.imap.connect();
        });
    }

    /**
     * Reconnect after connection loss
     */
    scheduleReconnect() {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);

        // Increase delay to 30 seconds to avoid flooding the server and being blocked by Gmail
        console.log('📧 [EMAIL-TO-TASK] 🔄 Reconnecting in 30 seconds...');
        this.reconnectTimeout = setTimeout(async () => {
            if (this.isRunning) {
                try {
                    await this.connectAndListen();
                } catch (err) {
                    console.error('📧 [EMAIL-TO-TASK] Reconnect failed:', err.message);
                    this.scheduleReconnect();
                }
            }
        }, 30000);
    }

    /**
     * Process unread emails and create tasks or add comments
     */
    async processUnreadEmails() {
        if (!this.imap || this.imap.state !== 'authenticated') {
            console.log('📧 [EMAIL-TO-TASK] Not connected, skipping...');
            return;
        }

        const sinceDate = this.getImapDateString(this.serviceStartTime || new Date());

        this.imap.search(['UNSEEN', ['SINCE', sinceDate]], async (err, results) => {
            if (err) {
                console.error('📧 [EMAIL-TO-TASK] Search error:', err);
                return;
            }

            if (!results || results.length === 0) {
                console.log('📧 [EMAIL-TO-TASK] No new unread emails');
                return;
            }

            // Filter already processed
            const newEmails = results.filter(uid => !this.processedEmails.has(uid));

            if (newEmails.length === 0) {
                console.log('📧 [EMAIL-TO-TASK] All emails already processed');
                return;
            }

            console.log(`📧 [EMAIL-TO-TASK] ⚡ Processing ${newEmails.length} new email(s)...`);

            const fetch = this.imap.fetch(newEmails, { bodies: '', markSeen: true });

            fetch.on('message', (msg, seqno) => {
                let uid = null;

                msg.on('attributes', (attrs) => { uid = attrs.uid; });

                msg.on('body', async (stream) => {
                    try {
                        const parsed = await simpleParser(stream);
                        console.log('\n📧 [EMAIL-TO-TASK] ========== NEW EMAIL ==========');
                        console.log('   From:', parsed.from?.text);
                        console.log('   Subject:', parsed.subject);
                        console.log('   Attachments:', parsed.attachments?.length || 0);

                        const result = await this.processEmail(parsed);

                        if (result.success) {
                            console.log('📧 [EMAIL-TO-TASK] ✅✅✅', result.type === 'task' ? 'TASK CREATED' : 'COMMENT ADDED');
                            console.log('   🎯', result.type === 'task' ? 'Task ID:' : 'Task ID:', result.taskId);
                            console.log('   📋 Title:', result.title);
                            if (result.warnings?.length > 0) {
                                console.log('   ⚠️ Warnings:', result.warnings.join(', '));
                            }
                            if (uid) this.processedEmails.add(uid);
                        } else {
                            console.log('📧 [EMAIL-TO-TASK] ❌', result.error);
                            if (uid) this.processedEmails.add(uid); // Mark as processed even if failed
                        }
                    } catch (err) {
                        console.error('📧 [EMAIL-TO-TASK] Error:', err.message);
                    }
                });
            });
        });
    }

    /**
     * Process email - determine if it's a new task or a reply (comment)
     * @param {Object} email - Parsed email object
     */
    async processEmail(email) {
        const senderEmail = email.from?.value?.[0]?.address?.toLowerCase();
        const subject = email.subject || '';

        // Check if this is a reply to a task notification (Phase III)
        const taskIdMatch = subject.match(CONFIG.TASK_ID_PATTERN);

        if (taskIdMatch) {
            console.log('📧 [EMAIL-TO-TASK] Detected as REPLY to task notification');
            return await this.processAsComment(email, taskIdMatch[1]);
        } else {
            console.log('📧 [EMAIL-TO-TASK] Processing as NEW TASK');
            return await this.createTaskFromEmail(email);
        }
    }

    /**
     * Phase III: Process email as a comment reply to existing task
     * @param {Object} email - Parsed email object
     * @param {string} taskId - Task ID extracted from subject
     */
    async processAsComment(email, taskId) {
        console.log('\n📧 [EMAIL-TO-TASK] ========== PROCESSING AS COMMENT ==========');

        try {
            const senderEmail = email.from?.value?.[0]?.address?.toLowerCase();
            const body = this.extractReplyContent(email.text || email.html?.replace(/<[^>]*>/g, '') || '');

            // Step 1: Find user
            const user = await User.findOne({ email: senderEmail });
            if (!user) {
                console.log('📧 [EMAIL-TO-TASK] ❌ User not found for comment:', senderEmail);
                await this.sendRejectionEmail(senderEmail, 'unauthorized');
                return { success: false, error: 'User not authorized' };
            }

            // Step 2: Find task
            const task = await Task.findById(taskId);
            if (!task) {
                console.log('📧 [EMAIL-TO-TASK] ❌ Task not found:', taskId);
                await this.sendRejectionEmail(senderEmail, 'task_not_found', { taskId });
                return { success: false, error: 'Task not found' };
            }

            // Step 3: Verify user has access to task
            const hasAccess = await this.userHasTaskAccess(user, task);
            if (!hasAccess) {
                console.log('📧 [EMAIL-TO-TASK] ❌ User does not have access to task');
                await this.sendRejectionEmail(senderEmail, 'no_access', { taskTitle: task.title });
                return { success: false, error: 'User does not have access to task' };
            }

            // Step 4: Add comment to task
            const commentId = new mongoose.Types.ObjectId().toString();
            const comment = {
                _id: commentId,
                text: body.trim() || '(No content)',
                content: body.trim() || '(No content)',
                author: user._id,
                mentions: [],
                attachments: [],
                createdAt: new Date(),
                updatedAt: new Date(),
                isEdited: false
            };

            // Process comment attachments if any
            if (email.attachments?.length > 0) {
                const attachmentResult = await this.processAttachments(email.attachments, user._id);
                comment.attachments = attachmentResult.attachments;
            }

            task.comments.push(comment);
            await task.save();

            console.log('📧 [EMAIL-TO-TASK] ✅ Comment added to task');
            console.log('   Comment ID:', commentId);
            console.log('   Task:', task.title);

            // Track activity
            await this.trackActivity('COMMENT_ADDED', user, task, {
                commentId,
                source: 'email',
                sourceEmail: senderEmail
            });

            // Send confirmation email
            await this.sendConfirmationEmail(senderEmail, 'comment_added', {
                taskTitle: task.title,
                taskId: task._id
            });

            return {
                success: true,
                type: 'comment',
                taskId: task._id,
                commentId,
                title: task.title
            };

        } catch (error) {
            console.error('📧 [EMAIL-TO-TASK] Error processing comment:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Extract reply content from email (remove quoted text)
     * @param {string} text - Full email text
     */
    extractReplyContent(text) {
        if (!text) return '';

        // Split by common reply separators
        const separators = [
            /On .* wrote:/i,
            /From: /i,
            /Sent: /i,
            /-{3,} Original Message -{3,}/i,
            /_{3,}/,
            /> On /i,
            /\n>/
        ];

        let cleanText = text;
        for (const separator of separators) {
            const parts = cleanText.split(separator);
            if (parts.length > 1) {
                cleanText = parts[0];
                break;
            }
        }

        return cleanText.trim();
    }

    /**
     * Check if user has access to task
     */
    async userHasTaskAccess(user, task) {
        // User is creator, assignee, or collaborator
        const userId = user._id.toString();
        return (
            task.createdBy?.toString() === userId ||
            task.assignedTo?.toString() === userId ||
            task.collaborators?.some(c => c.toString() === userId) ||
            task.approvers?.some(a => a.toString() === userId)
        );
    }

    /**
     * Stop the service
     */
    stop() {
        this.isRunning = false;
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.imap) {
            try { this.imap.end(); } catch (e) { }
            this.imap = null;
        }
        console.log('📧 [EMAIL-TO-TASK] Service stopped');
    }

    /**
     * Get IMAP-compatible date string (DD-MMM-YYYY)
     * @param {Date} date 
     */
    getImapDateString(date) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const day = date.getDate();
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    }

    /**
     * Create a task from parsed email (Phase I & II)
     * @param {Object} email - Parsed email object from mailparser
     */
    async createTaskFromEmail(email) {
        console.log('\n📧 [EMAIL-TO-TASK] ========== CREATING TASK FROM EMAIL ==========');

        const warnings = [];
        const parsingNotes = [];

        try {
            // STEP 1: Extract basic email data
            console.log('📧 [STEP 1] Extracting email data...');
            const senderEmail = email.from?.value?.[0]?.address?.toLowerCase();
            const senderName = email.from?.value?.[0]?.name || senderEmail?.split('@')[0];
            const rawSubject = email.subject || '';
            const body = email.text || email.html?.replace(/<[^>]*>/g, '') || '';
            const emailDate = email.date ? new Date(email.date) : new Date();

            console.log('   - Sender Email:', senderEmail);
            console.log('   - Subject:', rawSubject);
            console.log('   - Body length:', body.length, 'chars');
            console.log('   - Attachments:', email.attachments?.length || 0);

            // STEP 2: Check email date
            if (this.serviceStartTime && emailDate < this.serviceStartTime) {
                console.log('📧 [STEP 2] ❌ SKIPPED - Old email (before service start)');
                return { success: false, error: 'Old email - before service start' };
            }

            // STEP 3: Find and validate user
            console.log('\n📧 [STEP 3] Finding user in database...');
            const user = await User.findOne({ email: senderEmail });

            if (!user) {
                console.log('📧 [STEP 3] ❌ User not found - sending rejection email');
                await this.sendRejectionEmail(senderEmail, 'unauthorized');
                return { success: false, error: 'Unauthorized sender' };
            }

            console.log('   - User found:', user.firstName, user.lastName);
            console.log('   - User ID:', user._id);

            // STEP 4: Get organization (optional for individual users)
            console.log('\n📧 [STEP 4] Getting organization...');
            const organizationId = await this.getUserOrganization(user);
            const isIndividualUser = user.role?.includes('individual') || user.accountType === 'individual';

            if (!organizationId && !isIndividualUser) {
                console.log('📧 [STEP 4] ❌ No organization found (and not an individual user)');
                await this.sendRejectionEmail(senderEmail, 'no_organization');
                return { success: false, error: 'User has no organization' };
            }

            if (!organizationId && isIndividualUser) {
                console.log('📧 [STEP 4] ✅ Individual user - organization not required');
            } else {
                console.log('📧 [STEP 4] ✅ Organization found:', organizationId);
            }

            // STEP 4.5: Check TASK_EMAIL license limit before proceeding
            console.log('\n📧 [STEP 4.5] Checking TASK_EMAIL license limit...');
            try {
                const limitCheck = await licenseService.checkFeatureLimit(user._id, 'TASK_EMAIL');

                if (!limitCheck.canConsume) {
                    console.log('📧 [STEP 4.5] ❌ TASK_EMAIL limit exceeded');
                    console.log('   - Reason:', limitCheck.reason);
                    console.log('   - Usage:', JSON.stringify(limitCheck.usage));
                    await this.sendRejectionEmail(senderEmail, 'limit_exceeded', {
                        feature: 'TASK_EMAIL',
                        usage: limitCheck.usage
                    });
                    return { success: false, error: 'Email-to-task limit exceeded' };
                }
                console.log('📧 [STEP 4.5] ✅ TASK_EMAIL limit OK');
                console.log('   - Usage:', JSON.stringify(limitCheck.usage));
            } catch (limitError) {
                console.error('📧 [STEP 4.5] ⚠️ Error checking TASK_EMAIL limit:', limitError.message);
                // Continue anyway - don't block task creation due to license check errors
            }

            // STEP 5: Parse subject and body for smart values (Phase II)
            console.log('\n📧 [STEP 5] Smart parsing (Phase II)...');
            const parsedData = this.parseEmailContent(rawSubject, body, user, organizationId);

            if (parsedData.notes.length > 0) {
                parsingNotes.push(...parsedData.notes);
                console.log('   - Parsing notes:', parsedData.notes.join(', '));
            }

            // Handle empty subject
            let taskTitle = parsedData.title;
            if (!taskTitle || taskTitle.trim() === '') {
                taskTitle = '(No Subject)';
                warnings.push('Empty subject - task created with "(No Subject)"');
                console.log('   ⚠️ Empty subject detected');
            }

            // Truncate title if too long
            if (taskTitle.length > CONFIG.TASK_TITLE_MAX_LENGTH) {
                taskTitle = taskTitle.substring(0, CONFIG.TASK_TITLE_MAX_LENGTH - 3) + '...';
                warnings.push(`Title truncated to ${CONFIG.TASK_TITLE_MAX_LENGTH} characters`);
            }

            // STEP 6: Process attachments
            console.log('\n📧 [STEP 6] Processing attachments...');
            const attachmentResult = await this.processAttachments(email.attachments || [], user._id);

            if (attachmentResult.warnings.length > 0) {
                warnings.push(...attachmentResult.warnings);
            }

            // STEP 7: Prepare task data
            console.log('\n📧 [STEP 7] Preparing task data...');
            const userRole = Array.isArray(user.role) ? user.role : (user.role ? [user.role] : ['employee']);

            const taskData = {
                title: taskTitle,
                description: parsedData.description.substring(0, CONFIG.TASK_DESCRIPTION_MAX_LENGTH),
                taskType: 'regular',
                taskTypeAdvanced: 'simple',
                priority: parsedData.priority,
                status: 'OPEN',
                createdBy: user._id,
                assignedTo: parsedData.assignee || user._id, // Default: Sender
                organization: organizationId,
                dueDate: parsedData.dueDate, // Default: None (null)
                createdByRole: userRole,
                visibility: 'private',
                tags: ['email-task', ...parsedData.tags],
                attachments: attachmentResult.attachments,
                source: 'email',
                sourceEmail: senderEmail,
                sourceSubject: rawSubject
            };

            console.log('   - Title:', taskData.title);
            console.log('   - Priority:', taskData.priority);
            console.log('   - Due Date:', taskData.dueDate || 'None');
            console.log('   - Assignee:', taskData.assignedTo);
            console.log('   - Attachments:', taskData.attachments.length);

            // STEP 8: Create and save task
            console.log('\n📧 [STEP 8] Creating and saving task...');
            const task = new Task(taskData);
            const savedTask = await task.save();

            console.log('📧 [STEP 8] ✅ TASK SAVED SUCCESSFULLY!');
            console.log('   - Task ID:', savedTask._id);

            // STEP 9: Track TASK_EMAIL license usage
            console.log('\n📧 [STEP 9] Tracking TASK_EMAIL license usage...');
            try {
                const usageResult = await licenseService.consumeFeature(user._id, 'TASK_EMAIL', 1);
                if (usageResult.success) {
                    console.log('📧 [STEP 9] ✅ TASK_EMAIL usage tracked successfully');
                    console.log('   - New usage:', usageResult.newUsage);
                } else {
                    console.log('📧 [STEP 9] ⚠️ TASK_EMAIL usage tracking failed:', usageResult.reason);
                    // Don't fail task creation if usage tracking fails
                }
            } catch (usageError) {
                console.error('📧 [STEP 9] ⚠️ Error tracking TASK_EMAIL usage:', usageError.message);
                // Don't fail task creation if usage tracking fails
            }

            // STEP 10: Track activity
            await this.trackActivity('TASK_CREATED', user, savedTask, {
                source: 'email',
                sourceEmail: senderEmail
            });

            // STEP 11: Send confirmation email with any warnings/notes
            await this.sendConfirmationEmail(senderEmail, 'task_created', {
                taskId: savedTask._id,
                taskTitle: savedTask.title,
                priority: savedTask.priority,
                dueDate: savedTask.dueDate,
                warnings,
                parsingNotes
            });

            return {
                success: true,
                type: 'task',
                taskId: savedTask._id,
                title: savedTask.title,
                warnings
            };

        } catch (error) {
            console.error('📧 [EMAIL-TO-TASK] ❌ ERROR:', error.message);
            console.error('   Stack:', error.stack);
            return { success: false, error: error.message };
        }
    }

    /**
     * Phase II: Parse email content for smart values
     * Detects: priority: high, due: tomorrow, @username mentions
     */
    parseEmailContent(subject, body, user, organizationId) {
        const result = {
            title: subject,
            description: body,
            priority: 'medium', // Default: Medium
            dueDate: null, // Default: None
            assignee: null, // Will be set to sender if not found
            tags: [],
            notes: []
        };

        const fullText = `${subject} ${body}`.toLowerCase();

        // Parse priority keywords
        // Format: priority: high, priority:urgent, [urgent], (high priority)
        const priorityPatterns = [
            /priority\s*[:=]\s*(\w+)/i,
            /\[(\w+)\s*priority\]/i,
            /\((\w+)\s*priority\)/i,
            /\b(urgent|critical|asap|high|important|medium|normal|low|minor)\b/i
        ];

        for (const pattern of priorityPatterns) {
            const match = fullText.match(pattern);
            if (match) {
                const keyword = match[1].toLowerCase();
                if (PRIORITY_KEYWORDS[keyword]) {
                    result.priority = PRIORITY_KEYWORDS[keyword];
                    result.notes.push(`Priority auto-set to "${result.priority}" from keyword "${keyword}"`);

                    // Remove priority keyword from title
                    result.title = result.title.replace(pattern, '').trim();
                    break;
                }
            }
        }

        // Parse due date keywords
        // Format: due: tomorrow, due:next week, [due: 2024-12-25]
        const dueDatePatterns = [
            /due\s*[:=]\s*(\d{4}-\d{2}-\d{2})/i, // ISO date
            /due\s*[:=]\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i, // Date formats
            /due\s*[:=]\s*(today|tomorrow|eod|eow|eom|next\s+week|next\s+month|\d+\s*days?|\d+\s*weeks?)/i
        ];

        for (const pattern of dueDatePatterns) {
            const match = fullText.match(pattern);
            if (match) {
                const dueDateValue = match[1].toLowerCase().trim();
                const parsedDate = this.parseDueDate(dueDateValue, user?._id);

                if (parsedDate) {
                    result.dueDate = parsedDate;
                    result.notes.push(`Due date auto-set to "${TimezoneHelper.formatInTimezone(parsedDate, 'UTC')}" from "${dueDateValue}"`);

                    // Remove due date keyword from title
                    result.title = result.title.replace(pattern, '').trim();
                }
                break;
            }
        }

        // Parse @username mentions for assignee
        // Format: @john.doe, @johndoe
        const mentionPattern = /@([a-zA-Z0-9._-]+)/g;
        const mentions = fullText.match(mentionPattern);

        if (mentions && mentions.length > 0) {
            result.tags.push('has-mentions');
            // First mention could be assignee - will be resolved later
            result.mentionedUsernames = mentions.map(m => m.substring(1));
            result.notes.push(`Found @mentions: ${mentions.join(', ')}`);
        }

        // Clean up title - remove common prefixes
        result.title = result.title
            .replace(CONFIG.REPLY_PREFIX_PATTERN, '') // Remove Re:, Fwd: etc
            .replace(/^\s*[-:]\s*/, '') // Remove leading dashes/colons
            .trim();

        // If title is still empty after cleaning
        if (!result.title) {
            result.title = '(No Subject)';
        }

        // Set default due date based on priority if not explicitly provided
        if (!result.dueDate) {
            const now = new Date();
            const defaultDueDate = new Date(now);
            
            let daysToAdd = CONFIG.DEFAULT_DUE_DAYS || 7; // Default for medium
            
            if (result.priority === 'urgent' || result.priority === 'high') {
                daysToAdd = 1;
            } else if (result.priority === 'low') {
                daysToAdd = 14;
            }
            
            defaultDueDate.setDate(defaultDueDate.getDate() + daysToAdd);
            defaultDueDate.setHours(17, 0, 0, 0); // 5 PM
            
            result.dueDate = defaultDueDate;
            result.notes.push(`Due date auto-set to ${daysToAdd} day(s) from now based on "${result.priority}" priority`);
        }

        return result;
    }

    /**
     * Parse due date from keyword
     * @param {string} value - Date keyword (e.g., "tomorrow", "eow", "3 days")
     * @param {string} [userId] - Optional user ID for timezone lookup (falls back to UTC)
     */
    parseDueDate(value, userId) {
        const now = new Date();

        // Check if it's a date string (ISO or common formats)
        const dateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dateMatch) {
            return new Date(value);
        }

        const slashDateMatch = value.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (slashDateMatch) {
            const month = parseInt(slashDateMatch[1]) - 1;
            const day = parseInt(slashDateMatch[2]);
            let year = parseInt(slashDateMatch[3]);
            if (year < 100) year += 2000;
            return new Date(year, month, day, 17, 0, 0); // 5 PM
        }

        // Parse relative dates
        if (DUE_DATE_KEYWORDS[value] !== undefined) {
            const days = DUE_DATE_KEYWORDS[value];

            if (days !== null) {
                const dueDate = new Date(now);
                dueDate.setDate(dueDate.getDate() + days);
                dueDate.setHours(17, 0, 0, 0); // 5 PM
                return dueDate;
            }

            // Special cases
            if (value === 'eow') {
                // End of week (Friday 5 PM)
                const dueDate = new Date(now);
                const dayOfWeek = dueDate.getDay();
                const daysUntilFriday = dayOfWeek <= 5 ? (5 - dayOfWeek) : (7 - dayOfWeek + 5);
                dueDate.setDate(dueDate.getDate() + daysUntilFriday);
                dueDate.setHours(17, 0, 0, 0);
                return dueDate;
            }

            if (value === 'eom') {
                // End of month
                const dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 17, 0, 0);
                return dueDate;
            }
        }

        // Parse "N days" or "N weeks"
        const daysMatch = value.match(/(\d+)\s*days?/i);
        if (daysMatch) {
            const dueDate = new Date(now);
            dueDate.setDate(dueDate.getDate() + parseInt(daysMatch[1]));
            dueDate.setHours(17, 0, 0, 0);
            return dueDate;
        }

        const weeksMatch = value.match(/(\d+)\s*weeks?/i);
        if (weeksMatch) {
            const dueDate = new Date(now);
            dueDate.setDate(dueDate.getDate() + (parseInt(weeksMatch[1]) * 7));
            dueDate.setHours(17, 0, 0, 0);
            return dueDate;
        }

        return null;
    }

    /**
     * Process email attachments with size validation
     */
    async processAttachments(attachments, userId) {
        const result = {
            attachments: [],
            warnings: []
        };

        if (!attachments || attachments.length === 0) {
            return result;
        }

        let totalSize = 0;
        let processedCount = 0;

        for (const attachment of attachments) {
            // Check attachment count limit
            if (processedCount >= CONFIG.MAX_ATTACHMENTS_COUNT) {
                result.warnings.push(`Maximum ${CONFIG.MAX_ATTACHMENTS_COUNT} attachments allowed - remaining attachments skipped`);
                break;
            }

            // Check individual file size
            if (attachment.size > CONFIG.ATTACHMENT_MAX_SIZE_BYTES) {
                result.warnings.push(
                    `Attachment "${attachment.filename}" (${(attachment.size / 1024 / 1024).toFixed(2)}MB) exceeds ${CONFIG.ATTACHMENT_MAX_SIZE_MB}MB limit - skipped`
                );
                continue;
            }

            // Check total size limit
            if (totalSize + attachment.size > CONFIG.TOTAL_ATTACHMENTS_MAX_SIZE_BYTES) {
                result.warnings.push(
                    `Total attachment size limit (${CONFIG.TOTAL_ATTACHMENTS_MAX_SIZE_MB}MB) exceeded - remaining attachments skipped`
                );
                break;
            }

            try {
                // Save attachment to disk
                const savedAttachment = await this.saveAttachment(attachment, userId);
                if (savedAttachment) {
                    result.attachments.push(savedAttachment);
                    totalSize += attachment.size;
                    processedCount++;
                }
            } catch (error) {
                result.warnings.push(`Failed to save attachment "${attachment.filename}": ${error.message}`);
            }
        }

        console.log(`   - Processed ${processedCount}/${attachments.length} attachments`);
        if (result.warnings.length > 0) {
            console.log('   - Attachment warnings:', result.warnings);
        }

        return result;
    }

    /**
     * Save attachment to disk
     */
    async saveAttachment(attachment, userId) {
        const uniqueId = new mongoose.Types.ObjectId();
        const ext = path.extname(attachment.filename) || '';
        const safeFilename = `${uniqueId}${ext}`;

        try {
            if (r2Storage.isR2Enabled()) {
                const key = `email-attachments/${safeFilename}`;
                await r2Storage.uploadToR2(attachment.content, key, attachment.contentType || 'application/octet-stream');
                
                return {
                    _id: uniqueId,
                    originalName: attachment.filename,
                    filename: safeFilename,
                    path: key,
                    size: attachment.size,
                    mimetype: attachment.contentType || 'application/octet-stream',
                    url: r2Storage.getPublicUrl(key) || `/uploads/${key}`,
                    uploadedBy: userId,
                    uploadedAt: new Date(),
                    version: 1,
                    deleted: false
                };
            }

            // Fallback: local storage
            this.ensureUploadDir();
            const filePath = path.join(this.uploadDir, safeFilename);
            fs.writeFileSync(filePath, attachment.content);

            return {
                _id: uniqueId,
                originalName: attachment.filename,
                filename: safeFilename,
                path: filePath,
                size: attachment.size,
                mimetype: attachment.contentType || 'application/octet-stream',
                url: `/uploads/email-attachments/${safeFilename}`,
                uploadedBy: userId,
                uploadedAt: new Date(),
                version: 1,
                deleted: false
            };
        } catch (error) {
            console.error('📧 [EMAIL-TO-TASK] Failed to save attachment:', error.message);
            throw error;
        }
    }

    /**
     * Get user's organization ID
     */
    async getUserOrganization(user) {
        // Check all possible field names
        let organizationId = user.organization_id || user.organization || user.organizationId || user.orgId;

        if (organizationId) {
            return organizationId;
        }

        // Try to find organization from Organization model
        const org = await Organization.findOne({
            $or: [
                { members: user._id },
                { admins: user._id },
                { createdBy: user._id }
            ]
        });

        return org?._id || null;
    }

    /**
     * Track activity
     */
    async trackActivity(activityType, user, task, extraData = {}) {
        try {
            await storage.trackActivity({
                activityType,
                userId: user._id,
                organizationId: task.organization,
                relatedId: task._id,
                relatedType: 'task',
                data: {
                    taskTitle: task.title,
                    priority: task.priority,
                    status: task.status,
                    ...extraData
                }
            });
            console.log('📧 [EMAIL-TO-TASK] Activity tracked:', activityType);
        } catch (error) {
            console.error('📧 [EMAIL-TO-TASK] Failed to track activity:', error.message);
        }
    }

    /**
     * Send rejection email to unauthorized sender
     */
    async sendRejectionEmail(email, reason, data = {}) {
        if (!emailService.isEmailServiceAvailable()) {
            console.log('📧 [EMAIL-TO-TASK] Email service not available - skipping rejection email');
            return;
        }

        try {
            const subjects = {
                unauthorized: '❌ Task Creation Failed - Not Authorized',
                no_organization: '❌ Task Creation Failed - No Organization',
                task_not_found: '❌ Reply Failed - Task Not Found',
                no_access: '❌ Reply Failed - Access Denied',
                limit_exceeded: '❌ Task Creation Failed - Limit Exceeded'
            };

            const messages = {
                unauthorized: `
                    <p>Your email could not be processed because your email address is not registered in TaskSetu.</p>
                    <p>To create tasks via email:</p>
                    <ol>
                        <li>Sign up for TaskSetu at <a href="https://tasksetu.com">tasksetu.com</a></li>
                        <li>Use the same email address when sending emails</li>
                    </ol>
                `,
                no_organization: `
                    <p>Your email could not be processed because you are not associated with any organization in TaskSetu.</p>
                    <p>Please contact your administrator to add you to an organization.</p>
                `,
                task_not_found: `
                    <p>Your reply could not be added because the task (ID: ${data.taskId}) was not found.</p>
                    <p>The task may have been deleted or archived.</p>
                `,
                no_access: `
                    <p>Your reply could not be added to the task "${data.taskTitle}" because you don't have access to it.</p>
                    <p>Please contact the task creator or assignee for access.</p>
                `,
                limit_exceeded: `
                    <p>Your email could not be converted to a task because you have reached your email-to-task limit for this period.</p>
                    <p><strong>Current Usage:</strong> ${data.usage?.used || 0} / ${data.usage?.limit || 0} emails</p>
                    <p>To continue creating tasks via email:</p>
                    <ol>
                        <li>Wait for the limit to reset at the start of the next billing period</li>
                        <li>Or upgrade your plan to get more email-to-task capacity</li>
                    </ol>
                    <p>You can still create tasks directly from the TaskSetu app.</p>
                `
            };

            const mailOptions = {
                to: email,
                from: process.env.SMTP_USERNAME || 'noreply@tasksetu.com',
                subject: subjects[reason] || '❌ Email Processing Failed',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .header { background: #EF4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>Email Processing Failed</h1>
                            </div>
                            <div class="content">
                                ${messages[reason] || '<p>An error occurred while processing your email.</p>'}
                                <p style="margin-top: 20px;">If you believe this is an error, please contact support.</p>
                                <p><strong>— TaskSetu Team</strong></p>
                            </div>
                            <div class="footer">
                                <p>This is an automated message from TaskSetu.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            };

            await emailService.transporter.sendMail(mailOptions);
            console.log('📧 [EMAIL-TO-TASK] Rejection email sent to:', email);
        } catch (error) {
            console.error('📧 [EMAIL-TO-TASK] Failed to send rejection email:', error.message);
        }
    }

    /**
     * Send confirmation email
     */
    async sendConfirmationEmail(email, type, data = {}) {
        if (!emailService.isEmailServiceAvailable()) {
            console.log('📧 [EMAIL-TO-TASK] Email service not available - skipping confirmation email');
            return;
        }

        try {
            let subject, content;

            if (type === 'task_created') {
                subject = `✅ Task Created: ${data.taskTitle}`;

                let warningsHtml = '';
                if (data.warnings?.length > 0) {
                    warningsHtml = `
                        <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 4px;">
                            <h4 style="margin: 0 0 10px 0; color: #92400E;">⚠️ Notes:</h4>
                            <ul style="margin: 0; padding-left: 20px; color: #92400E;">
                                ${data.warnings.map(w => `<li>${w}</li>`).join('')}
                            </ul>
                        </div>
                    `;
                }

                let parsingNotesHtml = '';
                if (data.parsingNotes?.length > 0) {
                    parsingNotesHtml = `
                        <div style="background: #DBEAFE; border-left: 4px solid #3B82F6; padding: 15px; margin: 20px 0; border-radius: 4px;">
                            <h4 style="margin: 0 0 10px 0; color: #1E40AF;">🤖 Smart Parsing Applied:</h4>
                            <ul style="margin: 0; padding-left: 20px; color: #1E40AF;">
                                ${data.parsingNotes.map(n => `<li>${n}</li>`).join('')}
                            </ul>
                        </div>
                    `;
                }

                content = `
                    <div style="background: #D1FAE5; border-left: 4px solid #10B981; padding: 20px; margin: 20px 0; border-radius: 8px;">
                        <h3 style="margin: 0 0 15px 0; color: #065F46;">Your task has been created successfully!</h3>
                        <p style="margin: 5px 0;"><strong>Title:</strong> ${data.taskTitle}</p>
                        <p style="margin: 5px 0;"><strong>Priority:</strong> ${data.priority || 'Medium'}</p>
                        <p style="margin: 5px 0;"><strong>Due Date:</strong> ${data.dueDate ? TimezoneHelper.formatInTimezone(new Date(data.dueDate), 'UTC') : 'Not set'}</p>
                        <p style="margin: 5px 0;"><strong>Task ID:</strong> ${data.taskId}</p>
                    </div>
                    ${warningsHtml}
                    ${parsingNotesHtml}
                    <p>You can view and edit your task in TaskSetu.</p>
                    <p><strong>💡 Tip:</strong> Reply to task notification emails to add comments directly!</p>
                `;
            } else if (type === 'comment_added') {
                subject = `✅ Comment Added to: ${data.taskTitle}`;
                content = `
                    <div style="background: #D1FAE5; border-left: 4px solid #10B981; padding: 20px; margin: 20px 0; border-radius: 8px;">
                        <h3 style="margin: 0 0 15px 0; color: #065F46;">Your comment has been added!</h3>
                        <p style="margin: 5px 0;"><strong>Task:</strong> ${data.taskTitle}</p>
                        <p style="margin: 5px 0;"><strong>Task ID:</strong> ${data.taskId}</p>
                    </div>
                    <p>You can view the comment in TaskSetu.</p>
                `;
            }

            const mailOptions = {
                to: email,
                from: process.env.SMTP_USERNAME || 'noreply@tasksetu.com',
                subject,
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>TaskSetu</h1>
                            </div>
                            <div class="content">
                                ${content}
                                <p><strong>— TaskSetu Team</strong></p>
                            </div>
                            <div class="footer">
                                <p>This is an automated message from TaskSetu.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            };

            await emailService.transporter.sendMail(mailOptions);
            console.log('📧 [EMAIL-TO-TASK] Confirmation email sent to:', email);
        } catch (error) {
            console.error('📧 [EMAIL-TO-TASK] Failed to send confirmation email:', error.message);
        }
    }

    /**
     * Manual check for API endpoint (Check Now button)
     */
    async checkEmails() {
        console.log('\n📧 [EMAIL-TO-TASK] 🔄 Manual check triggered...');

        // If real-time connection is active, just process
        if (this.imap && this.imap.state === 'authenticated') {
            await this.processUnreadEmails();
            return { processed: true, message: 'Check complete' };
        }

        // Otherwise do a one-time check
        console.log('📧 [EMAIL-TO-TASK] Doing one-time check...');

        return new Promise((resolve, reject) => {
            const imap = new Imap(this.config);

            imap.once('ready', () => {
                console.log('📧 [EMAIL-TO-TASK] ✅ IMAP connection established');

                imap.openBox('INBOX', false, async (err, box) => {
                    if (err) {
                        console.error('📧 [EMAIL-TO-TASK] ❌ Error opening INBOX:', err);
                        imap.end();
                        return reject(err);
                    }

                    console.log(`📧 [EMAIL-TO-TASK] Inbox opened. Total messages: ${box.messages.total}`);

                    // Search for UNSEEN emails received TODAY only
                    const sinceDate = this.getImapDateString(this.serviceStartTime || new Date());
                    console.log(`📧 [EMAIL-TO-TASK] 📅 Searching emails SINCE: ${sinceDate}`);

                    imap.search(['UNSEEN', ['SINCE', sinceDate]], async (searchErr, results) => {
                        if (searchErr) {
                            console.error('📧 [EMAIL-TO-TASK] ❌ Error searching emails:', searchErr);
                            imap.end();
                            return reject(searchErr);
                        }

                        console.log(`📧 [EMAIL-TO-TASK] Found ${results.length} unread emails`);

                        if (results.length === 0) {
                            console.log('📧 [EMAIL-TO-TASK] No new emails to process');
                            imap.end();
                            return resolve({ processed: 0, tasks: [], comments: [] });
                        }

                        const createdTasks = [];
                        const addedComments = [];
                        let processed = 0;

                        const fetch = imap.fetch(results, {
                            bodies: '',
                            markSeen: true
                        });

                        fetch.on('message', (msg, seqno) => {
                            console.log(`📧 [EMAIL-TO-TASK] Processing email #${seqno}`);

                            msg.on('body', async (stream) => {
                                try {
                                    const parsed = await simpleParser(stream);
                                    console.log('📧 [EMAIL-TO-TASK] Email parsed:');
                                    console.log('   From:', parsed.from?.text);
                                    console.log('   Subject:', parsed.subject);

                                    const result = await this.processEmail(parsed);

                                    if (result.success) {
                                        if (result.type === 'task') {
                                            createdTasks.push(result);
                                        } else if (result.type === 'comment') {
                                            addedComments.push(result);
                                        }
                                    }
                                    processed++;
                                } catch (parseErr) {
                                    console.error('📧 [EMAIL-TO-TASK] ❌ Error parsing email:', parseErr);
                                    processed++;
                                }
                            });
                        });

                        fetch.once('error', (fetchErr) => {
                            console.error('📧 [EMAIL-TO-TASK] ❌ Fetch error:', fetchErr);
                        });

                        fetch.once('end', () => {
                            console.log(`📧 [EMAIL-TO-TASK] ========== PROCESSING COMPLETE ==========`);
                            console.log(`📧 [EMAIL-TO-TASK] Processed: ${processed} emails`);
                            console.log(`📧 [EMAIL-TO-TASK] Tasks created: ${createdTasks.length}`);
                            console.log(`📧 [EMAIL-TO-TASK] Comments added: ${addedComments.length}`);
                            imap.end();
                            resolve({ processed, tasks: createdTasks, comments: addedComments });
                        });
                    });
                });
            });

            imap.once('error', (err) => {
                console.error('📧 [EMAIL-TO-TASK] ❌ IMAP connection error:', err);
                reject(err);
            });

            imap.once('end', () => {
                console.log('📧 [EMAIL-TO-TASK] IMAP connection closed');
            });

            imap.connect();
        });
    }

    /**
     * Manually trigger email check (for API endpoint)
     */
    async triggerCheck() {
        return await this.checkEmails();
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            connected: this.imap?.state === 'authenticated',
            mode: 'real-time (IMAP IDLE)',
            email: this.config.user,
            imapHost: this.config.host,
            startTime: this.serviceStartTime?.toISOString(),
            processedCount: this.processedEmails?.size || 0,
            lastCheck: new Date().toISOString(),
            features: {
                phaseI: 'Basic email to task (subject, body, attachments)',
                phaseII: 'Smart parsing (priority, due date, @mentions)',
                phaseIII: 'Reply to notification → Comment'
            },
            limits: {
                titleMaxLength: CONFIG.TASK_TITLE_MAX_LENGTH,
                attachmentMaxSizeMB: CONFIG.ATTACHMENT_MAX_SIZE_MB,
                maxAttachments: CONFIG.MAX_ATTACHMENTS_COUNT
            }
        };
    }
}

// Export singleton instance
export const emailToTaskService = new EmailToTaskService();
export default EmailToTaskService;