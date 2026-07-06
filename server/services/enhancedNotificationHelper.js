/**
 * 🔔 Enhanced Notification Helper
 * Comprehensive notification system for task creation and updates
 * Sends notifications to assignees, contributors, and approvers with detailed logging
 */

import { NotificationService } from './notificationService.js';
import { TriggerEvent, EntityType, NotificationPriority, ChannelType } from '../modals/notificationModal.js';
import NotificationLogger from './notificationLogger.js';
import { User } from '../modals/userModal.js';

export class EnhancedNotificationHelper {
    /**
     * Helper to safely extract ID string from any format:
     * - ObjectId → its hex string
     * - Populated object { _id, firstName, ... } → _id.toString()
     * - Plain string → returned as-is
     * - Object with .id → id.toString()
     */
    static _extractId(value) {
        if (!value) return null;
        if (typeof value === 'string') return value;
        if (value._id) return value._id.toString ? value._id.toString() : String(value._id);
        if (value.id) return value.id.toString ? value.id.toString() : String(value.id);
        if (typeof value.toString === 'function') {
            const str = value.toString();
            // If toString gives '[object Object]', it's a plain object without proper toString
            if (str !== '[object Object]') return str;
        }
        return String(value);
    }

    /**
     * Send notifications for task creation to all relevant users
     * @param {Object} task - Created task object
     * @param {string} taskType - Type of task (regular, recurring, milestone, approval, quick)
     * @param {string} createdBy - Creator user ID
     * @param {Array} collaborators - Array of collaborator IDs
     * @param {Array} approvers - Array of approver IDs (for approval tasks)
     * @returns {Promise<Object>} Summary of sent notifications
     */
    static async notifyTaskCreation(task, { taskType, createdBy, collaborators = [], approvers = [] }) {
        NotificationLogger.logTaskCreation('NOTIFICATION_START', {
            taskId: task._id,
            taskType,
            title: task.title,
            createdBy,
            assignedTo: task.assignedTo,
            collaborators: collaborators.length,
            approvers: approvers.length
        }, 'START');

        const notificationsSent = {
            assignee: [],
            collaborators: [],
            approvers: [],
            errors: []
        };

        try {
            // ============================================
            // STEP 1: Notify Assignee (if different from creator)
            // ============================================
            const taskAssigneeId = EnhancedNotificationHelper._extractId(task.assignedTo);
            if (taskAssigneeId && taskAssigneeId !== createdBy.toString()) {
                try {
                    NotificationLogger.logTaskCreation('NOTIFY_ASSIGNEE_START', {
                        assigneeId: taskAssigneeId,
                        taskId: task._id,
                        taskTitle: task.title
                    }, 'PROGRESS');

                    const assigneeNotification = await NotificationService.createNotification({
                        user_id: taskAssigneeId,
                        trigger_event: TriggerEvent.TASK_CREATED,
                        related_entity: {
                            entity_type: EntityType.TASK,
                            entity_id: task._id,
                            entity_name: task.title
                        },
                        title: `New Task: ${task.title}`,
                        message: `You have been assigned a new ${taskType} task: "${task.title}". Priority: ${task.priority || 'normal'}`,
                        priority: (task.priority === 'urgent' || task.priority === 'high')
                            ? NotificationPriority.URGENT
                            : NotificationPriority.NORMAL,
                        channels: [ChannelType.IN_APP, ChannelType.EMAIL],
                        metadata: {
                            taskType,
                            priority: task.priority,
                            dueDate: task.dueDate
                        }
                    });

                    if (assigneeNotification) {
                        notificationsSent.assignee.push({
                            userId: taskAssigneeId,
                            notificationId: assigneeNotification._id,
                            status: 'sent'
                        });

                        NotificationLogger.logTaskCreation('NOTIFY_ASSIGNEE_SUCCESS', {
                            assigneeId: taskAssigneeId,
                            notificationId: assigneeNotification._id
                        }, 'SUCCESS');
                    }
                } catch (error) {
                    NotificationLogger.logTaskCreation('NOTIFY_ASSIGNEE_ERROR', {
                        assigneeId: taskAssigneeId,
                        error: error.message
                    }, 'ERROR');
                    notificationsSent.errors.push({
                        type: 'assignee_notification',
                        userId: taskAssigneeId,
                        error: error.message
                    });
                }
            } else {
                NotificationLogger.logTaskCreation('NOTIFY_ASSIGNEE_SKIPPED', {
                    reason: 'Creator is assignee',
                    createdBy,
                    assignedTo: task.assignedTo
                }, 'SKIP');
            }

            // ============================================
            // STEP 1.5: Send creation confirmation to Creator
            // ============================================
            try {
                const creatorNotification = await NotificationService.createNotification({
                    user_id: createdBy,
                    trigger_event: TriggerEvent.TASK_CREATED,
                    related_entity: {
                        entity_type: EntityType.TASK,
                        entity_id: task._id,
                        entity_name: task.title
                    },
                    title: `Task Created: ${task.title}`,
                    message: `Your ${taskType} task "${task.title}" has been created successfully.${taskAssigneeId && taskAssigneeId !== createdBy.toString() ? ' Assigned to another user.' : ''}`,
                    priority: NotificationPriority.NORMAL,
                    channels: [ChannelType.IN_APP],
                    metadata: {
                        taskType,
                        priority: task.priority,
                        dueDate: task.dueDate,
                        isCreatorConfirmation: true
                    }
                });

                if (creatorNotification) {
                    NotificationLogger.logTaskCreation('NOTIFY_CREATOR_SUCCESS', {
                        createdBy,
                        notificationId: creatorNotification._id
                    }, 'SUCCESS');
                }
            } catch (error) {
                NotificationLogger.logTaskCreation('NOTIFY_CREATOR_ERROR', {
                    createdBy,
                    error: error.message
                }, 'ERROR');
            }

            // ============================================
            // STEP 2: Notify Collaborators
            // ============================================
            if (collaborators && collaborators.length > 0) {
                NotificationLogger.logTaskCreation('NOTIFY_COLLABORATORS_START', {
                    collaboratorCount: collaborators.length,
                    taskId: task._id
                }, 'PROGRESS');

                for (const collaboratorId of collaborators) {
                    // Skip if collaborator is creator or assignee
                    const collabIdStr = EnhancedNotificationHelper._extractId(collaboratorId) || collaboratorId.toString();
                    if (collabIdStr === createdBy.toString() ||
                        collabIdStr === taskAssigneeId) {
                        continue;
                    }

                    try {
                        const collaboratorNotification = await NotificationService.createNotification({
                            user_id: collaboratorId,
                            trigger_event: TriggerEvent.TASK_CREATED,
                            related_entity: {
                                entity_type: EntityType.TASK,
                                entity_id: task._id,
                                entity_name: task.title
                            },
                            title: `Added as Collaborator: ${task.title}`,
                            message: `You have been added as a collaborator to task: "${task.title}"`,
                            priority: NotificationPriority.NORMAL,
                            channels: [ChannelType.IN_APP, ChannelType.EMAIL],
                            metadata: {
                                taskType,
                                role: 'collaborator',
                                assignedTo: task.assignedTo
                            }
                        });

                        if (collaboratorNotification) {
                            notificationsSent.collaborators.push({
                                userId: collaboratorId,
                                notificationId: collaboratorNotification._id,
                                status: 'sent'
                            });

                            NotificationLogger.logTaskCreation('NOTIFY_COLLABORATOR_SUCCESS', {
                                collaboratorId,
                                notificationId: collaboratorNotification._id
                            }, 'SUCCESS');
                        }
                    } catch (error) {
                        NotificationLogger.logTaskCreation('NOTIFY_COLLABORATOR_ERROR', {
                            collaboratorId,
                            error: error.message
                        }, 'ERROR');
                        notificationsSent.errors.push({
                            type: 'collaborator_notification',
                            userId: collaboratorId,
                            error: error.message
                        });
                    }
                }
            }

            // ============================================
            // STEP 3: Notify Approvers (for approval tasks)
            // ============================================
            if (taskType === 'approval' && approvers && approvers.length > 0) {
                NotificationLogger.logTaskCreation('NOTIFY_APPROVERS_START', {
                    approverCount: approvers.length,
                    taskId: task._id,
                    approvalMode: task.approvalMode || 'any'
                }, 'PROGRESS');

                // For sequential approval, only notify the first approver
                if (task.approvalMode === 'sequential' && task.approverOrder && task.approverOrder.length > 0) {
                    const firstApprover = task.approverOrder[0];
                    const firstApproverId = firstApprover.approverId;

                    try {
                        const approverNotification = await NotificationService.createNotification({
                            user_id: firstApproverId,
                            trigger_event: TriggerEvent.APPROVAL_REQUESTED,
                            related_entity: {
                                entity_type: EntityType.APPROVAL,
                                entity_id: task._id,
                                entity_name: task.title
                            },
                            title: `Sequential Approval Required: ${task.title}`,
                            message: `You are the first approver for task: "${task.title}". Please review and approve or reject.`,
                            priority: NotificationPriority.URGENT,
                            channels: [ChannelType.IN_APP, ChannelType.EMAIL],
                            metadata: {
                                approvalOrder: 1,
                                totalApprovers: task.approverOrder.length,
                                approvalMode: 'sequential'
                            }
                        });

                        if (approverNotification) {
                            notificationsSent.approvers.push({
                                userId: firstApproverId,
                                notificationId: approverNotification._id,
                                order: 1,
                                status: 'sent'
                            });

                            NotificationLogger.logTaskCreation('NOTIFY_FIRST_APPROVER_SUCCESS', {
                                approverId: firstApproverId,
                                order: 1,
                                notificationId: approverNotification._id
                            }, 'SUCCESS');
                        }
                    } catch (error) {
                        NotificationLogger.logTaskCreation('NOTIFY_FIRST_APPROVER_ERROR', {
                            approverId: firstApproverId,
                            error: error.message
                        }, 'ERROR');
                        notificationsSent.errors.push({
                            type: 'approver_notification',
                            userId: firstApproverId,
                            error: error.message
                        });
                    }
                } else {
                    // For any/all mode, notify all approvers
                    for (let index = 0; index < approvers.length; index++) {
                        const approverId = approvers[index];

                        // Skip if approver is creator
                        if (approverId.toString() === createdBy.toString()) {
                            continue;
                        }

                        try {
                            const approverNotification = await NotificationService.createNotification({
                                user_id: approverId,
                                trigger_event: TriggerEvent.APPROVAL_REQUESTED,
                                related_entity: {
                                    entity_type: EntityType.APPROVAL,
                                    entity_id: task._id,
                                    entity_name: task.title
                                },
                                title: `Approval Required: ${task.title}`,
                                message: `Your approval is required for task: "${task.title}". Please review and approve or reject.`,
                                priority: NotificationPriority.URGENT,
                                channels: [ChannelType.IN_APP, ChannelType.EMAIL],
                                metadata: {
                                    approvalMode: task.approvalMode || 'any',
                                    totalApprovers: approvers.length
                                }
                            });

                            if (approverNotification) {
                                notificationsSent.approvers.push({
                                    userId: approverId,
                                    notificationId: approverNotification._id,
                                    index: index + 1,
                                    status: 'sent'
                                });

                                NotificationLogger.logTaskCreation('NOTIFY_APPROVER_SUCCESS', {
                                    approverId,
                                    index: index + 1,
                                    notificationId: approverNotification._id
                                }, 'SUCCESS');
                            }
                        } catch (error) {
                            NotificationLogger.logTaskCreation('NOTIFY_APPROVER_ERROR', {
                                approverId,
                                error: error.message
                            }, 'ERROR');
                            notificationsSent.errors.push({
                                type: 'approver_notification',
                                userId: approverId,
                                error: error.message
                            });
                        }
                    }
                }
            }

            NotificationLogger.logTaskCreation('NOTIFICATION_COMPLETE', {
                taskId: task._id,
                summary: {
                    assigneeNotifications: notificationsSent.assignee.length,
                    collaboratorNotifications: notificationsSent.collaborators.length,
                    approverNotifications: notificationsSent.approvers.length,
                    errors: notificationsSent.errors.length
                }
            }, 'SUCCESS');

            return notificationsSent;
        } catch (error) {
            NotificationLogger.logTaskCreation('NOTIFICATION_FATAL_ERROR', {
                error: error.message,
                stack: error.stack
            }, 'ERROR');
            throw error;
        }
    }

    /**
     * Send notifications for task updates to all relevant members
     * @param {Object} task - Updated task
     * @param {Object} changes - Object describing what changed
     * @param {string} updatedBy - User ID who made the update
     * @returns {Promise<Object>} Summary of sent notifications
     */
    static async notifyTaskUpdate(task, changes, updatedBy) {
        NotificationLogger.logTaskUpdate('NOTIFICATION_START', {
            taskId: task._id,
            taskTitle: task.title,
            updatedBy,
            changedFields: Object.keys(changes)
        }, 'START');

        const notificationsSent = [];

        try {
            // ─── TASK_REASSIGNED: Dedicated reassignment notifications ───
            const prevAssignee = changes._prevAssignee; // old assignee ID passed from taskController
            const newAssigneeId = changes.assignedTo ? EnhancedNotificationHelper._extractId(changes.assignedTo) : null;

            if (prevAssignee && newAssigneeId && prevAssignee !== newAssigneeId) {
                NotificationLogger.logTaskUpdate('TASK_REASSIGNED_DETECTED', {
                    taskId: task._id,
                    prevAssignee,
                    newAssignee: newAssigneeId,
                    updatedBy
                }, 'PROGRESS');

                // 1️⃣ Notify NEW assignee — "Task assigned to you"
                if (newAssigneeId !== updatedBy.toString()) {
                    try {
                        const newAssigneeNotif = await NotificationService.createNotification({
                            user_id: newAssigneeId,
                            trigger_event: TriggerEvent.TASK_REASSIGNED,
                            related_entity: {
                                entity_type: EntityType.TASK,
                                entity_id: task._id,
                                entity_name: task.title
                            },
                            title: `Task Assigned: ${task.title}`,
                            message: `You have been assigned the task "${task.title}"`,
                            priority: NotificationPriority.NORMAL,
                            channels: [ChannelType.IN_APP, ChannelType.EMAIL],
                            metadata: {
                                reassignedFrom: prevAssignee,
                                reassignedTo: newAssigneeId,
                                updatedBy,
                                updatedAt: new Date()
                            }
                        });
                        if (newAssigneeNotif) {
                            notificationsSent.push({ userId: newAssigneeId, notificationId: newAssigneeNotif._id, status: 'sent' });
                            NotificationLogger.logTaskUpdate('REASSIGN_NEW_ASSIGNEE_NOTIFIED', { userId: newAssigneeId }, 'SUCCESS');
                        }
                    } catch (err) {
                        NotificationLogger.logTaskUpdate('REASSIGN_NEW_ASSIGNEE_ERROR', { error: err.message }, 'ERROR');
                    }
                }

                // 2️⃣ Notify OLD assignee — "Task reassigned from you"
                if (prevAssignee !== updatedBy.toString()) {
                    try {
                        const oldAssigneeNotif = await NotificationService.createNotification({
                            user_id: prevAssignee,
                            trigger_event: TriggerEvent.TASK_REASSIGNED,
                            related_entity: {
                                entity_type: EntityType.TASK,
                                entity_id: task._id,
                                entity_name: task.title
                            },
                            title: `Task Reassigned: ${task.title}`,
                            message: `The task "${task.title}" has been reassigned from you to another user`,
                            priority: NotificationPriority.NORMAL,
                            channels: [ChannelType.IN_APP, ChannelType.EMAIL],
                            metadata: {
                                reassignedFrom: prevAssignee,
                                reassignedTo: newAssigneeId,
                                updatedBy,
                                updatedAt: new Date()
                            }
                        });
                        if (oldAssigneeNotif) {
                            notificationsSent.push({ userId: prevAssignee, notificationId: oldAssigneeNotif._id, status: 'sent' });
                            NotificationLogger.logTaskUpdate('REASSIGN_OLD_ASSIGNEE_NOTIFIED', { userId: prevAssignee }, 'SUCCESS');
                        }
                    } catch (err) {
                        NotificationLogger.logTaskUpdate('REASSIGN_OLD_ASSIGNEE_ERROR', { error: err.message }, 'ERROR');
                    }
                }

                // 3️⃣ Notify CREATOR (if different from both old & new assignee and updater)
                const creatorId = EnhancedNotificationHelper._extractId(task.createdBy);
                if (creatorId &&
                    creatorId !== updatedBy.toString() &&
                    creatorId !== newAssigneeId &&
                    creatorId !== prevAssignee) {
                    try {
                        const creatorNotif = await NotificationService.createNotification({
                            user_id: creatorId,
                            trigger_event: TriggerEvent.TASK_REASSIGNED,
                            related_entity: {
                                entity_type: EntityType.TASK,
                                entity_id: task._id,
                                entity_name: task.title
                            },
                            title: `Task Reassigned: ${task.title}`,
                            message: `Your task "${task.title}" has been reassigned to a new user`,
                            priority: NotificationPriority.NORMAL,
                            channels: [ChannelType.IN_APP, ChannelType.EMAIL],
                            metadata: {
                                reassignedFrom: prevAssignee,
                                reassignedTo: newAssigneeId,
                                updatedBy,
                                updatedAt: new Date()
                            }
                        });
                        if (creatorNotif) {
                            notificationsSent.push({ userId: creatorId, notificationId: creatorNotif._id, status: 'sent' });
                            NotificationLogger.logTaskUpdate('REASSIGN_CREATOR_NOTIFIED', { userId: creatorId }, 'SUCCESS');
                        }
                    } catch (err) {
                        NotificationLogger.logTaskUpdate('REASSIGN_CREATOR_ERROR', { error: err.message }, 'ERROR');
                    }
                }

                // 4️⃣ Notify COLLABORATORS (if not already notified above)
                const alreadyNotified = new Set([updatedBy.toString(), newAssigneeId, prevAssignee, creatorId].filter(Boolean));
                if (task.collaborators && Array.isArray(task.collaborators)) {
                    for (const collab of task.collaborators) {
                        const collabId = EnhancedNotificationHelper._extractId(collab);
                        if (collabId && !alreadyNotified.has(collabId)) {
                            try {
                                const collabNotif = await NotificationService.createNotification({
                                    user_id: collabId,
                                    trigger_event: TriggerEvent.TASK_REASSIGNED,
                                    related_entity: {
                                        entity_type: EntityType.TASK,
                                        entity_id: task._id,
                                        entity_name: task.title
                                    },
                                    title: `Task Reassigned: ${task.title}`,
                                    message: `The task "${task.title}" has been reassigned`,
                                    priority: NotificationPriority.NORMAL,
                                    channels: [ChannelType.IN_APP, ChannelType.EMAIL],
                                    metadata: {
                                        reassignedFrom: prevAssignee,
                                        reassignedTo: newAssigneeId,
                                        updatedBy,
                                        updatedAt: new Date()
                                    }
                                });
                                if (collabNotif) {
                                    notificationsSent.push({ userId: collabId, notificationId: collabNotif._id, status: 'sent' });
                                }
                            } catch (err) {
                                // swallow per-collaborator errors
                            }
                            alreadyNotified.add(collabId);
                        }
                    }
                }

                NotificationLogger.logTaskUpdate('TASK_REASSIGNED_COMPLETE', {
                    taskId: task._id,
                    usersNotified: notificationsSent.length
                }, 'SUCCESS');
            }

            // ─── Normal TASK_UPDATED notifications (non-reassignment changes) ───
            // Build non-reassignment change set
            const normalChanges = { ...changes };
            delete normalChanges.assignedTo;
            delete normalChanges._prevAssignee;

            const hasNonReassignChanges = Object.keys(normalChanges).some(k => normalChanges[k] !== undefined);

            if (hasNonReassignChanges) {
                const notifyUsers = new Set();

                // Add current assignee
                const assigneeId = EnhancedNotificationHelper._extractId(task.assignedTo);
                if (assigneeId && assigneeId !== updatedBy.toString()) {
                    notifyUsers.add(assigneeId);
                }

                // Add creator
                if (task.createdBy) {
                    const creatorId = EnhancedNotificationHelper._extractId(task.createdBy);
                    if (creatorId && creatorId !== updatedBy.toString()) {
                        notifyUsers.add(creatorId);
                    }
                }

                // Add collaborators
                if (task.collaborators && Array.isArray(task.collaborators)) {
                    for (const collab of task.collaborators) {
                        const collabId = EnhancedNotificationHelper._extractId(collab);
                        if (collabId && collabId !== updatedBy.toString()) {
                            notifyUsers.add(collabId);
                        }
                    }
                }

                // Determine message
                let changeMessage = 'Task has been updated';
                let priority = NotificationPriority.NORMAL;

                if (normalChanges.status) {
                    changeMessage = `Task status changed to ${normalChanges.status}`;
                } else if (normalChanges.priority) {
                    changeMessage = `Task priority changed to ${normalChanges.priority}`;
                    if (normalChanges.priority === 'urgent' || normalChanges.priority === 'high') {
                        priority = NotificationPriority.URGENT;
                    }
                } else if (normalChanges.dueDate) {
                    changeMessage = `Task due date updated`;
                }

                for (const userId of notifyUsers) {
                    try {
                        const notification = await NotificationService.createNotification({
                            user_id: userId,
                            trigger_event: TriggerEvent.TASK_UPDATED,
                            related_entity: {
                                entity_type: EntityType.TASK,
                                entity_id: task._id,
                                entity_name: task.title
                            },
                            title: `Updated: ${task.title}`,
                            message: changeMessage,
                            priority,
                            channels: [ChannelType.IN_APP, ChannelType.EMAIL],
                            metadata: {
                                changes: normalChanges,
                                updatedBy,
                                updatedAt: new Date()
                            }
                        });

                        if (notification) {
                            notificationsSent.push({ userId, notificationId: notification._id, status: 'sent' });
                            NotificationLogger.logTaskUpdate('NOTIFY_USER_SUCCESS', { userId, notificationId: notification._id }, 'SUCCESS');
                        }
                    } catch (error) {
                        NotificationLogger.logTaskUpdate('NOTIFY_USER_ERROR', { userId, error: error.message }, 'ERROR');
                    }
                }
            }

            NotificationLogger.logTaskUpdate('NOTIFICATION_COMPLETE', {
                taskId: task._id,
                usersNotified: notificationsSent.length
            }, 'SUCCESS');

            return notificationsSent;
        } catch (error) {
            NotificationLogger.logTaskUpdate('NOTIFICATION_FATAL_ERROR', {
                error: error.message
            }, 'ERROR');
            throw error;
        }
    }

    /**
     * Send notifications for subtask changes
     */
    static async notifySubtaskChange(subtask, parentTask, changeType, changedBy) {
        NotificationLogger.logSubtaskChange('NOTIFICATION_START', {
            subtaskId: subtask._id,
            parentTaskId: parentTask._id,
            changeType
        }, 'START');

        const notifyUsers = new Set();

        // Add parent task assignee (handle populated objects from .lean())
        const parentAssigneeId = EnhancedNotificationHelper._extractId(parentTask.assignedTo);
        if (parentAssigneeId) {
            notifyUsers.add(parentAssigneeId);
        }

        // Add parent task collaborators (handle populated objects from .lean())
        if (parentTask.collaborators && Array.isArray(parentTask.collaborators)) {
            for (const collab of parentTask.collaborators) {
                const collabId = EnhancedNotificationHelper._extractId(collab);
                if (collabId) notifyUsers.add(collabId);
            }
        }

        // Add subtask assignee if different from parent
        const subtaskAssigneeId = EnhancedNotificationHelper._extractId(subtask.assignedTo);
        if (subtaskAssigneeId && subtaskAssigneeId !== parentAssigneeId) {
            notifyUsers.add(subtaskAssigneeId);
        }

        // Remove the user who made the change
        notifyUsers.delete(changedBy.toString());

        let triggerEvent = TriggerEvent.SUBTASK_ADDED;
        let messageTemplate = 'A new subtask was added';

        if (changeType === 'status') {
            triggerEvent = TriggerEvent.SUBTASK_COMPLETED;
            messageTemplate = `Subtask "${subtask.title}" has been marked as complete`;
        } else if (changeType === 'updated') {
            triggerEvent = TriggerEvent.TASK_UPDATED;
            messageTemplate = `Subtask "${subtask.title}" has been updated`;
        }

        const notificationsSent = [];

        for (const userId of notifyUsers) {
            try {
                const notification = await NotificationService.createNotification({
                    user_id: userId,
                    trigger_event: triggerEvent,
                    related_entity: {
                        entity_type: EntityType.SUBTASK,
                        entity_id: subtask._id,
                        entity_name: subtask.title,
                        parent_entity_id: parentTask._id
                    },
                    title: `${changeType === 'status' ? 'Subtask Completed' : 'Subtask Updated'}: ${subtask.title}`,
                    message: messageTemplate,
                    priority: NotificationPriority.NORMAL,
                    channels: [ChannelType.IN_APP, ChannelType.EMAIL],
                    metadata: {
                        parentTaskId: parentTask._id,
                        subtaskId: subtask._id,
                        changeType
                    }
                });

                if (notification) {
                    notificationsSent.push({
                        userId,
                        notificationId: notification._id
                    });
                }
            } catch (error) {
                NotificationLogger.logSubtaskChange('NOTIFY_ERROR', {
                    userId,
                    error: error.message
                }, 'ERROR');
            }
        }

        NotificationLogger.logSubtaskChange('NOTIFICATION_COMPLETE', {
            subtaskId: subtask._id,
            usersNotified: notificationsSent.length
        }, 'SUCCESS');

        return notificationsSent;
    }

    /**
     * Send notifications for comments
     */
    static async notifyComment(task, comment, commentedBy) {
        NotificationLogger.logCommentAddition('NOTIFICATION_START', {
            taskId: task._id,
            commentId: comment._id,
            commentedBy
        }, 'START');

        const notifyUsers = new Set();

        // Add assignee (handle populated objects from .lean())
        const assigneeId = EnhancedNotificationHelper._extractId(task.assignedTo);
        if (assigneeId && assigneeId !== commentedBy.toString()) {
            notifyUsers.add(assigneeId);
        }

        // Add collaborators (handle populated objects from .lean())
        if (task.collaborators && Array.isArray(task.collaborators)) {
            for (const collab of task.collaborators) {
                const collabId = EnhancedNotificationHelper._extractId(collab);
                if (collabId && collabId !== commentedBy.toString()) {
                    notifyUsers.add(collabId);
                }
            }
        }

        // Add task creator to notify list
        if (task.createdBy) {
            const creatorId = EnhancedNotificationHelper._extractId(task.createdBy);
            if (creatorId && creatorId !== commentedBy.toString()) {
                notifyUsers.add(creatorId);
            }
        }

        // Process mentions from the comment.mentions array (ObjectIds from frontend)
        const mentionedUserIds = [];
        if (comment.mentions && Array.isArray(comment.mentions) && comment.mentions.length > 0) {
            for (const mentionId of comment.mentions) {
                const mentionUserId = mentionId._id ? mentionId._id.toString() : mentionId.toString();
                if (mentionUserId !== commentedBy.toString()) {
                    mentionedUserIds.push(mentionUserId);
                    // Also add to general notify list for COMMENT_ADDED
                    notifyUsers.add(mentionUserId);
                }
            }
        }

        const notificationsSent = [];

        // Send COMMENT_ADDED notification to all relevant users (assignee, collaborators, creator)
        for (const userId of notifyUsers) {
            try {
                NotificationLogger.logCommentAddition('SENDING_NOTIFICATION', {
                    userId,
                    taskId: task._id
                }, 'PROGRESS');

                const notification = await NotificationService.createNotification({
                    user_id: userId,
                    trigger_event: TriggerEvent.COMMENT_ADDED,
                    related_entity: {
                        entity_type: EntityType.TASK,
                        entity_id: task._id,
                        entity_name: `Comment on ${task.title}`
                    },
                    title: `New Comment: ${task.title}`,
                    message: `${comment.text?.substring(0, 100)}...`,
                    priority: NotificationPriority.NORMAL,
                    channels: [ChannelType.IN_APP, ChannelType.EMAIL],
                    metadata: {
                        taskId: task._id,
                        commentId: comment._id,
                        commentedBy
                    }
                });

                if (notification) {
                    notificationsSent.push({
                        userId,
                        notificationId: notification._id
                    });

                    NotificationLogger.logCommentAddition('NOTIFICATION_SENT', {
                        userId,
                        notificationId: notification._id
                    }, 'SUCCESS');
                }
            } catch (error) {
                NotificationLogger.logCommentAddition('NOTIFICATION_ERROR', {
                    userId,
                    error: error.message
                }, 'ERROR');
            }
        }

        // Send USER_MENTIONED notification separately to mentioned users
        for (const mentionUserId of mentionedUserIds) {
            try {
                const mentionNotification = await NotificationService.createNotification({
                    user_id: mentionUserId,
                    trigger_event: TriggerEvent.USER_MENTIONED,
                    related_entity: {
                        entity_type: EntityType.TASK,
                        entity_id: task._id,
                        entity_name: `Mention in ${task.title}`
                    },
                    title: `You were mentioned: ${task.title}`,
                    message: `You were mentioned in a comment: "${comment.text?.substring(0, 100)}..."`,
                    priority: NotificationPriority.NORMAL,
                    channels: [ChannelType.IN_APP, ChannelType.EMAIL],
                    metadata: {
                        taskId: task._id,
                        commentId: comment._id,
                        commentedBy,
                        mentionType: 'comment'
                    }
                });

                if (mentionNotification) {
                    notificationsSent.push({
                        userId: mentionUserId,
                        notificationId: mentionNotification._id,
                        type: 'mention'
                    });

                    NotificationLogger.logCommentAddition('MENTION_NOTIFICATION_SENT', {
                        userId: mentionUserId,
                        notificationId: mentionNotification._id
                    }, 'SUCCESS');
                }
            } catch (error) {
                NotificationLogger.logCommentAddition('MENTION_NOTIFICATION_ERROR', {
                    userId: mentionUserId,
                    error: error.message
                }, 'ERROR');
            }
        }

        NotificationLogger.logCommentAddition('NOTIFICATION_COMPLETE', {
            taskId: task._id,
            usersNotified: notificationsSent.length
        }, 'SUCCESS');

        return notificationsSent;
    }

    /**
     * Send notifications for status changes
     */
    static async notifyStatusChange(task, oldStatus, newStatus, changedBy) {
        NotificationLogger.logStatusChange('NOTIFICATION_START', {
            taskId: task._id,
            oldStatus,
            newStatus
        }, 'START');

        const notifyUsers = new Set();

        // Add assignee (handle populated objects from .lean())
        const statusAssigneeId = EnhancedNotificationHelper._extractId(task.assignedTo);
        if (statusAssigneeId && statusAssigneeId !== changedBy.toString()) {
            notifyUsers.add(statusAssigneeId);
        }

        // Add task creator
        if (task.createdBy) {
            const creatorId = EnhancedNotificationHelper._extractId(task.createdBy);
            if (creatorId && creatorId !== changedBy.toString()) {
                notifyUsers.add(creatorId);
            }
        }

        // Add collaborators (handle populated objects from .lean())
        if (task.collaborators && Array.isArray(task.collaborators)) {
            for (const collab of task.collaborators) {
                const collabId = EnhancedNotificationHelper._extractId(collab);
                if (collabId && collabId !== changedBy.toString()) {
                    notifyUsers.add(collabId);
                }
            }
        }

        const notificationsSent = [];

        for (const userId of notifyUsers) {
            try {
                const notification = await NotificationService.createNotification({
                    user_id: userId,
                    trigger_event: TriggerEvent.TASK_UPDATED,
                    related_entity: {
                        entity_type: EntityType.TASK,
                        entity_id: task._id,
                        entity_name: task.title
                    },
                    title: `Task Status Changed: ${task.title}`,
                    message: `Task status changed from ${oldStatus} to ${newStatus}`,
                    priority: NotificationPriority.NORMAL,
                    channels: [ChannelType.IN_APP, ChannelType.EMAIL],
                    metadata: {
                        statusChange: {
                            from: oldStatus,
                            to: newStatus
                        },
                        changedBy,
                        changedAt: new Date()
                    }
                });

                if (notification) {
                    notificationsSent.push({
                        userId,
                        notificationId: notification._id
                    });
                }
            } catch (error) {
                NotificationLogger.logStatusChange('NOTIFICATION_ERROR', {
                    userId,
                    error: error.message
                }, 'ERROR');
            }
        }

        NotificationLogger.logStatusChange('NOTIFICATION_COMPLETE', {
            taskId: task._id,
            usersNotified: notificationsSent.length
        }, 'SUCCESS');

        return notificationsSent;
    }
}

export default EnhancedNotificationHelper;
