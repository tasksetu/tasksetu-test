import { Task } from '../models.js';
import { User } from '../modals/userModal.js';
import { TriggerEvent, EntityType, NotificationPriority, ChannelType } from '../modals/notificationModal.js';
import { NotificationService } from './notificationService.js';
import TimezoneHelper from '../utils/timezoneHelper.js';

/**
 * Advanced Notification Triggers Service
 * Handles specialized notification scenarios including:
 * - Milestone notifications
 * - Escalation to managers and admins
 * - 3-day advance reminders
 * - Recurring task instance notifications
 * - Approval workflow notifications
 */
export class AdvancedNotificationTriggers {

    /**
     * Notify about recurring task instance creation
     * Spec: "Recurring Task - New instance created → Assigned user"
     * 
     * @param {Object} recurringInstance - The new recurring task instance
     * @param {Object} parentPattern - The parent recurring pattern
     */
    static async notifyRecurringInstanceCreated(recurringInstance, parentPattern) {
        try {
            if (!recurringInstance.assignedTo) {
                console.log('No assignee for recurring instance, skipping notification');
                return;
            }

            const notificationData = {
                user_id: recurringInstance.assignedTo,
                trigger_event: TriggerEvent.RECURRING_INSTANCE_CREATED,
                related_entity: {
                    entity_type: EntityType.TASK,
                    entity_id: recurringInstance._id
                },
                title: 'New Recurring Task Instance Created',
                message: `A new instance of recurring task "${recurringInstance.title}" has been created and assigned to you.`,
                priority: NotificationPriority.NORMAL,
                channels: [ChannelType.IN_APP, ChannelType.EMAIL],
                metadata: {
                    taskId: recurringInstance._id,
                    taskTitle: recurringInstance.title,
                    dueDate: recurringInstance.dueDate,
                    recurrencePattern: parentPattern?.recurrencePattern || 'Unknown',
                    parentTaskId: recurringInstance.parentTaskId,
                    isRecurringInstance: true
                }
            };

            const notification = await NotificationService.createNotification(notificationData);
            console.log(`✅ Recurring instance notification sent for task: ${recurringInstance.title}`);
            return notification;

        } catch (error) {
            console.error('Error sending recurring instance notification:', error);
        }
    }

    /**
     * Notify when milestone is achieved
     * Spec: "Milestone achieved → Creator, Manager"
     * 
     * @param {Object} milestoneTask - The milestone task that was achieved
     */
    static async notifyMilestoneAchieved(milestoneTask) {
        try {
            const task = await Task.findById(milestoneTask._id)
                .populate('createdBy assignedTo', 'firstName lastName email role organizationId');

            if (!task) return;

            // Notify Creator
            if (task.createdBy) {
                await NotificationService.createNotification({
                    user_id: task.createdBy._id,
                    trigger_event: TriggerEvent.MILESTONE_ACHIEVED,
                    related_entity: {
                        entity_type: EntityType.MILESTONE,
                        entity_id: task._id
                    },
                    title: '🎉 Milestone Achieved!',
                    message: `Milestone "${task.title}" has been successfully achieved!`,
                    priority: NotificationPriority.URGENT,
                    channels: [ChannelType.IN_APP, ChannelType.EMAIL],
                    metadata: {
                        milestoneId: task._id,
                        milestoneTitle: task.title,
                        completedBy: task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : 'Unknown',
                        completedAt: task.completedAt || new Date()
                    }
                });
            }

            // Notify Manager(s) in the organization
            if (task.createdBy?.organizationId) {
                const managers = await User.find({
                    organizationId: task.createdBy.organizationId,
                    role: { $in: ['manager', 'org_admin'] },
                    isActive: true
                }).select('_id firstName lastName email');

                for (const manager of managers) {
                    // Don't notify if manager is the creator
                    if (manager._id.toString() === task.createdBy._id.toString()) continue;

                    await NotificationService.createNotification({
                        user_id: manager._id,
                        trigger_event: TriggerEvent.MILESTONE_ACHIEVED,
                        related_entity: {
                            entity_type: EntityType.MILESTONE,
                            entity_id: task._id
                        },
                        title: '🎯 Team Milestone Achieved',
                        message: `Team milestone "${task.title}" has been achieved by ${task.assignedTo?.firstName || 'team member'}.`,
                        priority: NotificationPriority.NORMAL,
                        channels: [ChannelType.IN_APP, ChannelType.EMAIL],
                        metadata: {
                            milestoneId: task._id,
                            milestoneTitle: task.title,
                            completedBy: task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : 'Unknown'
                        }
                    });
                }
            }

            console.log(`✅ Milestone achieved notifications sent for: ${task.title}`);

        } catch (error) {
            console.error('Error sending milestone achieved notification:', error);
        }
    }

    /**
     * Notify when milestone is missed (past due date and not completed)
     * Spec: "Milestone missed → Creator, Manager"
     * 
     * @param {Object} milestoneTask - The milestone task that was missed
     */
    static async notifyMilestoneMissed(milestoneTask) {
        try {
            const task = await Task.findById(milestoneTask._id)
                .populate('createdBy assignedTo', 'firstName lastName email role organizationId');

            if (!task) return;

            const daysOverdue = Math.ceil((new Date() - new Date(task.dueDate)) / (1000 * 60 * 60 * 24));

            // Notify Creator
            if (task.createdBy) {
                await NotificationService.createNotification({
                    user_id: task.createdBy._id,
                    trigger_event: TriggerEvent.MILESTONE_MISSED,
                    related_entity: {
                        entity_type: EntityType.MILESTONE,
                        entity_id: task._id
                    },
                    title: '⚠️ Milestone Missed',
                    message: `Milestone "${task.title}" has passed its due date and is now ${daysOverdue} day(s) overdue.`,
                    priority: NotificationPriority.URGENT,
                    channels: [ChannelType.IN_APP, ChannelType.EMAIL],
                    metadata: {
                        milestoneId: task._id,
                        milestoneTitle: task.title,
                        dueDate: task.dueDate,
                        daysOverdue: daysOverdue,
                        assignee: task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : 'Unassigned'
                    }
                });
            }

            // Notify Manager(s)
            if (task.createdBy?.organizationId) {
                const managers = await User.find({
                    organizationId: task.createdBy.organizationId,
                    role: { $in: ['manager', 'org_admin'] },
                    isActive: true
                }).select('_id firstName lastName email');

                for (const manager of managers) {
                    if (manager._id.toString() === task.createdBy._id.toString()) continue;

                    await NotificationService.createNotification({
                        user_id: manager._id,
                        trigger_event: TriggerEvent.MILESTONE_MISSED,
                        related_entity: {
                            entity_type: EntityType.MILESTONE,
                            entity_id: task._id
                        },
                        title: '🚨 Team Milestone Missed',
                        message: `Critical milestone "${task.title}" has been missed. It is now ${daysOverdue} day(s) overdue.`,
                        priority: NotificationPriority.URGENT,
                        channels: [ChannelType.IN_APP, ChannelType.EMAIL],
                        metadata: {
                            milestoneId: task._id,
                            milestoneTitle: task.title,
                            daysOverdue: daysOverdue,
                            assignee: task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : 'Unassigned'
                        }
                    });
                }
            }

            console.log(`✅ Milestone missed notifications sent for: ${task.title}`);

        } catch (error) {
            console.error('Error sending milestone missed notification:', error);
        }
    }

    /**
     * Send 3-day advance reminder for upcoming tasks
     * Spec: "3 days before due date → System checks reminder rules"
     * 
     * @param {Object} task - The task with upcoming due date
     */
    static async send3DayAdvanceReminder(task, dayOffset = 3) {
        try {
            if (!task.assignedTo) return;

            const daysUntilDue = Math.ceil((new Date(task.dueDate) - new Date()) / (1000 * 60 * 60 * 24));

            const notificationData = {
                user_id: task.assignedTo,
                trigger_event: TriggerEvent.TASK_REMINDER,
                related_entity: {
                    entity_type: EntityType.TASK,
                    entity_id: task._id
                },
                title: `📅 Task Due in ${dayOffset} Day${dayOffset !== 1 ? 's' : ''}`,
                message: `Reminder: Task "${task.title}" is due in ${daysUntilDue} days (${TimezoneHelper.formatInTimezone(new Date(task.dueDate), await TimezoneHelper.getUserTimezone(task.assignedTo))}).`,
                priority: dayOffset <= 1 ? NotificationPriority.URGENT : NotificationPriority.NORMAL,
                channels: [ChannelType.IN_APP, ChannelType.EMAIL],
                metadata: {
                    taskId: task._id,
                    taskTitle: task.title,
                    dueDate: task.dueDate,
                    daysUntilDue: daysUntilDue,
                    reminderType: `${dayOffset}_day_advance`
                }
            };

            const notification = await NotificationService.createNotification(notificationData);
            console.log(`✅ ${dayOffset}-day advance reminder sent for task: ${task.title}`);
            return notification;

        } catch (error) {
            console.error('Error sending 3-day advance reminder:', error);
        }
    }

    /**
     * Escalate overdue task to manager
     * Spec: "If no interaction → Manager notified if overdue > 48 hrs"
     * 
     * @param {Object} task - The overdue task
     * @param {number} hoursOverdue - Hours the task has been overdue
     */
    static async escalateToManager(task, hoursOverdue) {
        try {
            const taskDoc = await Task.findById(task._id)
                .populate('assignedTo createdBy', 'firstName lastName email organizationId');

            if (!taskDoc || !taskDoc.assignedTo?.organizationId) return;

            // Find managers in the same organization
            const managers = await User.find({
                organizationId: taskDoc.assignedTo.organizationId,
                role: { $in: ['manager', 'org_admin'] },
                isActive: true
            }).select('_id firstName lastName email');

            if (managers.length === 0) {
                console.log('No managers found for escalation, falling back to super admins');
                // G3 FIX: Fallback to super admins when no managers/org_admins found
                const superAdmins = await User.find({
                    role: { $in: ['super_admin'] },
                    isActive: true
                }).select('_id firstName lastName email');
                if (superAdmins.length === 0) {
                    console.log('No super admins found either, escalation skipped');
                    return;
                }
                console.log(`Escalation fallback: notifying ${superAdmins.length} super admin(s)`);
                const daysOverdue = Math.ceil(hoursOverdue / 24);
                for (const admin of superAdmins) {
                    await NotificationService.createNotification({
                        user_id: admin._id,
                        trigger_event: TriggerEvent.OVERDUE_ESCALATION,
                        related_entity: {
                            entity_type: EntityType.TASK,
                            entity_id: taskDoc._id
                        },
                        title: '⚠️ Task Overdue - Admin Fallback Escalation',
                        message: `Task "${taskDoc.title}" assigned to ${taskDoc.assignedTo.firstName} ${taskDoc.assignedTo.lastName} is ${daysOverdue} day(s) overdue. No managers available — escalated to you as fallback.`,
                        priority: NotificationPriority.URGENT,
                        channels: [ChannelType.IN_APP, ChannelType.EMAIL],
                        metadata: {
                            taskId: taskDoc._id,
                            taskTitle: taskDoc.title,
                            assignee: `${taskDoc.assignedTo.firstName} ${taskDoc.assignedTo.lastName}`,
                            assigneeEmail: taskDoc.assignedTo.email,
                            daysOverdue: daysOverdue,
                            escalationLevel: 'admin_fallback',
                            dueDate: taskDoc.dueDate
                        }
                    });
                }
                return;
            }

            const daysOverdue = Math.ceil(hoursOverdue / 24);

            for (const manager of managers) {
                await NotificationService.createNotification({
                    user_id: manager._id,
                    trigger_event: TriggerEvent.OVERDUE_ESCALATION,
                    related_entity: {
                        entity_type: EntityType.TASK,
                        entity_id: taskDoc._id
                    },
                    title: '⚠️ Task Overdue - Manager Escalation',
                    message: `Task "${taskDoc.title}" assigned to ${taskDoc.assignedTo.firstName} ${taskDoc.assignedTo.lastName} is ${daysOverdue} day(s) overdue. Please follow up.`,
                    priority: NotificationPriority.URGENT,
                    channels: [ChannelType.IN_APP, ChannelType.EMAIL],
                    metadata: {
                        taskId: taskDoc._id,
                        taskTitle: taskDoc.title,
                        assignee: `${taskDoc.assignedTo.firstName} ${taskDoc.assignedTo.lastName}`,
                        assigneeEmail: taskDoc.assignedTo.email,
                        daysOverdue: daysOverdue,
                        escalationLevel: 'manager',
                        dueDate: taskDoc.dueDate
                    }
                });
            }

            console.log(`✅ Manager escalation sent for task: ${taskDoc.title}`);

            // Also notify the assignee that their task has been escalated
            if (taskDoc.assignedTo?._id) {
                try {
                    await NotificationService.createNotification({
                        user_id: taskDoc.assignedTo._id,
                        trigger_event: TriggerEvent.OVERDUE_ESCALATION,
                        related_entity: {
                            entity_type: EntityType.TASK,
                            entity_id: taskDoc._id
                        },
                        title: '⚠️ Your Overdue Task Has Been Escalated',
                        message: `Your task "${taskDoc.title}" is ${daysOverdue} day(s) overdue and has been escalated to management. Please take immediate action.`,
                        priority: NotificationPriority.URGENT,
                        channels: [ChannelType.IN_APP, ChannelType.EMAIL],
                        metadata: {
                            taskId: taskDoc._id,
                            taskTitle: taskDoc.title,
                            daysOverdue: daysOverdue,
                            escalationLevel: 'manager',
                            dueDate: taskDoc.dueDate,
                            escalatedToAssignee: true
                        }
                    });
                    console.log(`✅ Assignee escalation notification sent for task: ${taskDoc.title}`);
                } catch (assigneeError) {
                    console.error('Error notifying assignee about escalation:', assigneeError.message);
                }
            }

        } catch (error) {
            console.error('Error escalating to manager:', error);
        }
    }

    /**
     * Escalate critically overdue task to admin
     * Spec: "Admin notified if overdue > escalation threshold (7 days)"
     * 
     * @param {Object} task - The critically overdue task
     * @param {number} daysOverdue - Days the task has been overdue
     */
    static async escalateToAdmin(task, daysOverdue) {
        try {
            const taskDoc = await Task.findById(task._id)
                .populate('assignedTo createdBy', 'firstName lastName email organizationId');

            if (!taskDoc) return;

            // Find organization admins
            const admins = await User.find({
                $or: [
                    { role: 'super_admin' },
                    { role: 'org_admin', organizationId: taskDoc.assignedTo?.organizationId }
                ],
                isActive: true
            }).select('_id firstName lastName email');

            if (admins.length === 0) {
                // G3 FIX: Log warning but don't silently fail — try super_admin as last resort
                console.log('No admins found for critical escalation, attempting super_admin fallback');
                const fallbackAdmins = await User.find({
                    role: 'super_admin',
                    isActive: true
                }).select('_id firstName lastName email');
                if (fallbackAdmins.length === 0) {
                    console.error('CRITICAL: No admins or super_admins found for critical escalation — escalation path misconfigured!');
                    return;
                }
                // Use fallback admins
                for (const admin of fallbackAdmins) {
                    await NotificationService.createNotification({
                        user_id: admin._id,
                        trigger_event: TriggerEvent.CRITICAL_ESCALATION,
                        related_entity: {
                            entity_type: EntityType.TASK,
                            entity_id: taskDoc._id
                        },
                        title: '🚨 CRITICAL: Task Severely Overdue (Fallback Alert)',
                        message: `CRITICAL ALERT: Task "${taskDoc.title}" is ${daysOverdue} days overdue. No org admins found — escalated to you as system fallback.`,
                        priority: NotificationPriority.URGENT,
                        channels: [ChannelType.IN_APP, ChannelType.EMAIL],
                        metadata: {
                            taskId: taskDoc._id,
                            taskTitle: taskDoc.title,
                            assignee: taskDoc.assignedTo ? `${taskDoc.assignedTo.firstName} ${taskDoc.assignedTo.lastName}` : 'Unassigned',
                            assigneeEmail: taskDoc.assignedTo?.email || 'N/A',
                            daysOverdue: daysOverdue,
                            escalationLevel: 'admin_fallback',
                            dueDate: taskDoc.dueDate,
                            priority: taskDoc.priority
                        }
                    });
                }
                return;
            }

            for (const admin of admins) {
                await NotificationService.createNotification({
                    user_id: admin._id,
                    trigger_event: TriggerEvent.CRITICAL_ESCALATION,
                    related_entity: {
                        entity_type: EntityType.TASK,
                        entity_id: taskDoc._id
                    },
                    title: '🚨 CRITICAL: Task Severely Overdue',
                    message: `CRITICAL ALERT: Task "${taskDoc.title}" is ${daysOverdue} days overdue. Immediate action required.`,
                    priority: NotificationPriority.URGENT,
                    channels: [ChannelType.IN_APP, ChannelType.EMAIL],
                    metadata: {
                        taskId: taskDoc._id,
                        taskTitle: taskDoc.title,
                        assignee: taskDoc.assignedTo ? `${taskDoc.assignedTo.firstName} ${taskDoc.assignedTo.lastName}` : 'Unassigned',
                        assigneeEmail: taskDoc.assignedTo?.email || 'N/A',
                        daysOverdue: daysOverdue,
                        escalationLevel: 'admin',
                        dueDate: taskDoc.dueDate,
                        priority: taskDoc.priority
                    }
                });
            }

            console.log(`✅ Admin escalation sent for task: ${taskDoc.title}`);

        } catch (error) {
            console.error('Error escalating to admin:', error);
        }
    }

    /**
     * Notify when approval is requested
     * Spec: "Approval request raised → Approver"
     * 
     * @param {Object} task - The task requiring approval
     * @param {Array} approvers - Array of approver user IDs
     */
    static async notifyApprovalRequested(task, approvers) {
        try {
            if (!approvers || approvers.length === 0) return;

            const taskDoc = await Task.findById(task._id)
                .populate('createdBy', 'firstName lastName email');

            for (const approverId of approvers) {
                await NotificationService.createNotification({
                    user_id: approverId,
                    trigger_event: TriggerEvent.APPROVAL_REQUESTED,
                    related_entity: {
                        entity_type: EntityType.APPROVAL,
                        entity_id: taskDoc._id
                    },
                    title: '✋ Approval Required',
                    message: `${taskDoc.createdBy?.firstName || 'Someone'} has requested your approval for task "${taskDoc.title}".`,
                    priority: NotificationPriority.URGENT,
                    channels: [ChannelType.IN_APP, ChannelType.EMAIL],
                    metadata: {
                        taskId: taskDoc._id,
                        taskTitle: taskDoc.title,
                        requester: taskDoc.createdBy ? `${taskDoc.createdBy.firstName} ${taskDoc.createdBy.lastName}` : 'Unknown',
                        requesterEmail: taskDoc.createdBy?.email || 'N/A',
                        dueDate: taskDoc.dueDate,
                        isApprovalTask: true
                    }
                });
            }

            console.log(`✅ Approval request notifications sent for task: ${taskDoc.title}`);

        } catch (error) {
            console.error('Error sending approval request notification:', error);
        }
    }

    /**
     * Notify when approval is granted
     * Spec: "Approval granted → Requester"
     * 
     * @param {Object} task - The approved task
     * @param {Object} approver - The user who approved
     */
    static async notifyApprovalGranted(task, approver) {
        try {
            const taskDoc = await Task.findById(task._id)
                .populate('createdBy', 'firstName lastName email');

            if (!taskDoc || !taskDoc.createdBy) return;

            await NotificationService.createNotification({
                user_id: taskDoc.createdBy._id,
                trigger_event: TriggerEvent.APPROVAL_APPROVED,
                related_entity: {
                    entity_type: EntityType.APPROVAL,
                    entity_id: taskDoc._id
                },
                title: '✅ Approval Granted',
                message: `Your approval request for task "${taskDoc.title}" has been approved by ${approver.firstName} ${approver.lastName}.`,
                priority: NotificationPriority.NORMAL,
                channels: [ChannelType.IN_APP, ChannelType.EMAIL],
                metadata: {
                    taskId: taskDoc._id,
                    taskTitle: taskDoc.title,
                    approver: `${approver.firstName} ${approver.lastName}`,
                    approverEmail: approver.email,
                    approvedAt: new Date()
                }
            });

            console.log(`✅ Approval granted notification sent for task: ${taskDoc.title}`);

        } catch (error) {
            console.error('Error sending approval granted notification:', error);
        }
    }

    /**
     * Notify when approval is denied
     * Spec: "Approval denied → Requester"
     * 
     * @param {Object} task - The denied task
     * @param {Object} approver - The user who denied
     * @param {string} reason - Reason for denial
     */
    static async notifyApprovalDenied(task, approver, reason = '') {
        try {
            const taskDoc = await Task.findById(task._id)
                .populate('createdBy', 'firstName lastName email');

            if (!taskDoc || !taskDoc.createdBy) return;

            let message = `Your approval request for task "${taskDoc.title}" has been denied by ${approver.firstName} ${approver.lastName}.`;
            if (reason) {
                message += ` Reason: ${reason}`;
            }

            await NotificationService.createNotification({
                user_id: taskDoc.createdBy._id,
                trigger_event: TriggerEvent.APPROVAL_DENIED,
                related_entity: {
                    entity_type: EntityType.APPROVAL,
                    entity_id: taskDoc._id
                },
                title: '❌ Approval Denied',
                message,
                priority: NotificationPriority.URGENT,
                channels: [ChannelType.IN_APP, ChannelType.EMAIL],
                metadata: {
                    taskId: taskDoc._id,
                    taskTitle: taskDoc.title,
                    approver: `${approver.firstName} ${approver.lastName}`,
                    approverEmail: approver.email,
                    deniedAt: new Date(),
                    denialReason: reason
                }
            });

            console.log(`✅ Approval denied notification sent for task: ${taskDoc.title}`);

        } catch (error) {
            console.error('Error sending approval denied notification:', error);
        }
    }

    /**
     * Notify when file is edited
     * Spec: "File edited → Task collaborators"
     * 
     * @param {Object} task - The task with edited file
     * @param {string} fileName - Name of the edited file
     * @param {string} editorId - ID of user who edited the file
     */
    static async notifyFileEdited(task, fileName, editorId) {
        try {
            const taskDoc = await Task.findById(task._id)
                .populate('assignedTo createdBy collaborators', 'firstName lastName email');

            if (!taskDoc) return;

            // Helper to create notification
            const createFileEditNotification = async (targetUserId) => {
                if (!targetUserId || targetUserId.toString() === editorId) return;

                await NotificationService.createNotification({
                    user_id: targetUserId,
                    trigger_event: TriggerEvent.FILE_EDITED,
                    related_entity: {
                        entity_type: EntityType.ATTACHMENT,
                        entity_id: taskDoc._id
                    },
                    title: '📝 File Edited',
                    message: `File "${fileName}" was edited in task "${taskDoc.title}".`,
                    priority: NotificationPriority.NORMAL,
                    channels: [ChannelType.IN_APP, ChannelType.EMAIL],
                    metadata: {
                        taskId: taskDoc._id,
                        taskTitle: taskDoc.title,
                        fileName: fileName,
                        editedBy: editorId
                    }
                });
            };

            // Notify assignee
            if (taskDoc.assignedTo) {
                await createFileEditNotification(taskDoc.assignedTo._id);
            }

            // Notify creator
            if (taskDoc.createdBy && taskDoc.createdBy._id.toString() !== taskDoc.assignedTo?._id?.toString()) {
                await createFileEditNotification(taskDoc.createdBy._id);
            }

            // Notify collaborators
            if (taskDoc.collaborators && taskDoc.collaborators.length > 0) {
                for (const collaborator of taskDoc.collaborators) {
                    await createFileEditNotification(collaborator._id);
                }
            }

            console.log(`✅ File edited notifications sent for: ${fileName}`);

        } catch (error) {
            console.error('Error sending file edited notification:', error);
        }
    }
}

export default AdvancedNotificationTriggers;
