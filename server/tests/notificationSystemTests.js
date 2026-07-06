/**
 * 🧪 Notification System Test Suite
 * Comprehensive tests for all notification flows
 * Run these tests to verify notification system is working correctly
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';

const API_URL = process.env.API_URL || 'http://localhost:5000';
const TEST_USERS = {
    creator: null,
    assignee: null,
    collaborator1: null,
    collaborator2: null,
    approver1: null,
    approver2: null
};

const LOG_DIR = './logs';

/**
 * Utility to get logs since a timestamp
 */
async function getRecentLogs(eventType, since) {
    try {
        const logFile = path.join(LOG_DIR, `${eventType}_${new Date().toISOString().split('T')[0]}.log`);

        if (!fs.existsSync(logFile)) {
            console.warn(`⚠️  Log file not found: ${logFile}`);
            return [];
        }

        const content = fs.readFileSync(logFile, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim());

        return lines
            .map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    return null;
                }
            })
            .filter(entry => entry && new Date(entry.timestamp) > since)
            .reverse(); // Most recent first
    } catch (error) {
        console.error(`Error reading logs: ${error.message}`);
        return [];
    }
}

/**
 * Utility to check logs for specific step
 */
function checkLogsForStep(logs, step, status) {
    return logs.find(log => log.step === step && log.status === status);
}

/**
 * Test 1: Regular Task Creation Notification
 */
export async function testRegularTaskCreation() {
    console.log('\n\n🧪 TEST 1: Regular Task Creation Notification');
    console.log('='.repeat(60));

    const startTime = new Date();

    try {
        // Create task
        console.log('📝 Creating regular task...');
        const createResponse = await axios.post(`${API_URL}/api/create-task`, {
            title: 'Test Task - Regular',
            description: 'Test notification system',
            taskType: 'regular',
            assignedTo: TEST_USERS.assignee,
            priority: 'high'
        }, {
            headers: { Authorization: `Bearer ${TEST_USERS.creatorToken}` }
        });

        const taskId = createResponse.data.data._id;
        console.log(`✅ Task created: ${taskId}`);

        // Wait for notifications to be processed
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check logs
        const logs = await getRecentLogs('task_creation', startTime);
        console.log(`\n📊 Found ${logs.length} log entries`);

        // Verify log entries
        const startLog = checkLogsForStep(logs, 'USING_ENHANCED_HELPER', 'START');
        const assigneeNotifyStart = checkLogsForStep(logs, 'NOTIFY_ASSIGNEE_START', 'PROGRESS');
        const assigneeNotifySuccess = checkLogsForStep(logs, 'NOTIFY_ASSIGNEE_SUCCESS', 'SUCCESS');
        const notifyComplete = checkLogsForStep(logs, 'NOTIFICATION_COMPLETE', 'SUCCESS');

        console.log(`\n✅ Verification Results:`);
        console.log(`  - USING_ENHANCED_HELPER: ${startLog ? '✅' : '❌'}`);
        console.log(`  - NOTIFY_ASSIGNEE_START: ${assigneeNotifyStart ? '✅' : '❌'}`);
        console.log(`  - NOTIFY_ASSIGNEE_SUCCESS: ${assigneeNotifySuccess ? '✅' : '❌'}`);
        console.log(`  - NOTIFICATION_COMPLETE: ${notifyComplete ? '✅' : '❌'}`);

        if (startLog && assigneeNotifyStart && assigneeNotifySuccess && notifyComplete) {
            console.log('\n🎉 TEST PASSED: All notification logs found!\n');
            return { success: true, taskId };
        } else {
            console.log('\n❌ TEST FAILED: Missing some notification logs\n');
            console.log('Log entries:');
            logs.forEach(log => {
                console.log(`  [${log.step}] ${log.status}`);
            });
            return { success: false, taskId, logs };
        }
    } catch (error) {
        console.error(`\n❌ TEST FAILED: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Test 2: Task Creation with Collaborators
 */
export async function testTaskWithCollaborators() {
    console.log('\n\n🧪 TEST 2: Task Creation with Collaborators');
    console.log('='.repeat(60));

    const startTime = new Date();

    try {
        console.log('📝 Creating task with collaborators...');
        const createResponse = await axios.post(`${API_URL}/api/create-task`, {
            title: 'Team Project Task',
            taskType: 'regular',
            assignedTo: TEST_USERS.assignee,
            collaboratorIds: [TEST_USERS.collaborator1, TEST_USERS.collaborator2],
            priority: 'medium'
        }, {
            headers: { Authorization: `Bearer ${TEST_USERS.creatorToken}` }
        });

        const taskId = createResponse.data.data._id;
        console.log(`✅ Task created: ${taskId}`);

        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check logs
        const logs = await getRecentLogs('task_creation', startTime);

        // Count notifications
        const assigneeNotifications = logs.filter(l => l.step === 'NOTIFY_ASSIGNEE_SUCCESS').length;
        const collaboratorNotifications = logs.filter(l => l.step === 'NOTIFY_COLLABORATOR_SUCCESS').length;

        console.log(`\n✅ Verification Results:`);
        console.log(`  - Assignee notified: ${assigneeNotifications > 0 ? '✅' : '❌'}`);
        console.log(`  - Collaborators notified: ${collaboratorNotifications >= 2 ? '✅' : '❌'} (${collaboratorNotifications}/2)`);

        if (assigneeNotifications > 0 && collaboratorNotifications >= 2) {
            console.log('\n🎉 TEST PASSED: All users notified!\n');
            return { success: true, taskId };
        } else {
            console.log('\n⚠️  TEST PARTIAL: Some users may not be notified\n');
            return { success: false, taskId, logs };
        }
    } catch (error) {
        console.error(`\n❌ TEST FAILED: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Test 3: Task Update Notification
 */
export async function testTaskUpdateNotification(taskId) {
    console.log('\n\n🧪 TEST 3: Task Update Notification');
    console.log('='.repeat(60));

    const startTime = new Date();

    try {
        if (!taskId) {
            console.error('❌ No task ID provided');
            return { success: false, error: 'Task ID required' };
        }

        console.log(`📝 Updating task: ${taskId}`);
        await axios.put(`${API_URL}/api/tasks/${taskId}`, {
            status: 'INPROGRESS',
            priority: 'urgent'
        }, {
            headers: { Authorization: `Bearer ${TEST_USERS.creatorToken}` }
        });

        console.log(`✅ Task updated`);

        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check logs
        const logs = await getRecentLogs('task_update', startTime);
        console.log(`\n📊 Found ${logs.length} log entries`);

        const updateStart = checkLogsForStep(logs, 'USING_ENHANCED_HELPER', 'START');
        const updateSuccess = checkLogsForStep(logs, 'ENHANCED_NOTIFICATIONS_SENT', 'SUCCESS');

        console.log(`\n✅ Verification Results:`);
        console.log(`  - Update started: ${updateStart ? '✅' : '❌'}`);
        console.log(`  - Notifications sent: ${updateSuccess ? '✅' : '❌'}`);

        if (updateStart && updateSuccess) {
            console.log('\n🎉 TEST PASSED: Update notifications sent!\n');
            return { success: true };
        } else {
            console.log('\n❌ TEST FAILED: Update notifications not sent properly\n');
            return { success: false, logs };
        }
    } catch (error) {
        console.error(`\n❌ TEST FAILED: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Test 4: Approval Task Notifications
 */
export async function testApprovalTaskNotification() {
    console.log('\n\n🧪 TEST 4: Approval Task Notifications');
    console.log('='.repeat(60));

    const startTime = new Date();

    try {
        console.log('📝 Creating approval task...');
        const createResponse = await axios.post(`${API_URL}/api/create-task`, {
            title: 'Approval Request',
            taskType: 'approval',
            assignedTo: TEST_USERS.assignee,
            approverIds: [TEST_USERS.approver1, TEST_USERS.approver2],
            approvalMode: 'sequential'
        }, {
            headers: { Authorization: `Bearer ${TEST_USERS.creatorToken}` }
        });

        const taskId = createResponse.data.data._id;
        console.log(`✅ Task created: ${taskId}`);

        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check logs
        const logs = await getRecentLogs('task_creation', startTime);

        const firstApproverNotified = logs.find(l =>
            l.step === 'NOTIFY_FIRST_APPROVER_SUCCESS' && l.status === 'SUCCESS'
        );

        console.log(`\n✅ Verification Results:`);
        console.log(`  - First approver notified: ${firstApproverNotified ? '✅' : '❌'}`);

        if (firstApproverNotified) {
            console.log('\n🎉 TEST PASSED: Sequential approval notification sent!\n');
            return { success: true, taskId };
        } else {
            console.log('\n❌ TEST FAILED: Approval notification not sent\n');
            return { success: false, taskId, logs };
        }
    } catch (error) {
        console.error(`\n❌ TEST FAILED: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Test 5: Comment Notification
 */
export async function testCommentNotification(taskId) {
    console.log('\n\n🧪 TEST 5: Comment Notification');
    console.log('='.repeat(60));

    const startTime = new Date();

    try {
        if (!taskId) {
            console.error('❌ No task ID provided');
            return { success: false, error: 'Task ID required' };
        }

        console.log(`📝 Adding comment to task: ${taskId}`);
        await axios.post(`${API_URL}/api/tasks/${taskId}/comments`, {
            content: 'Great progress! @collaborator1 please review.',
            mentions: [TEST_USERS.collaborator1]
        }, {
            headers: { Authorization: `Bearer ${TEST_USERS.creatorToken}` }
        });

        console.log(`✅ Comment added`);

        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check logs
        const logs = await getRecentLogs('comment_addition', startTime);
        console.log(`\n📊 Found ${logs.length} log entries`);

        const notificationStart = checkLogsForStep(logs, 'NOTIFICATION_START', 'START');
        const notificationSuccess = checkLogsForStep(logs, 'NOTIFICATION_SUCCESS', 'SUCCESS');

        console.log(`\n✅ Verification Results:`);
        console.log(`  - Notification started: ${notificationStart ? '✅' : '❌'}`);
        console.log(`  - Notification successful: ${notificationSuccess ? '✅' : '❌'}`);

        if (notificationStart && notificationSuccess) {
            console.log('\n🎉 TEST PASSED: Comment notifications sent!\n');
            return { success: true };
        } else {
            console.log('\n❌ TEST FAILED: Comment notifications not sent\n');
            return { success: false, logs };
        }
    } catch (error) {
        console.error(`\n❌ TEST FAILED: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Test 6: Recurring Task Notification
 */
export async function testRecurringTaskNotification() {
    console.log('\n\n🧪 TEST 6: Recurring Task Notification');
    console.log('='.repeat(60));

    const startTime = new Date();

    try {
        console.log('📝 Creating recurring task...');
        const createResponse = await axios.post(`${API_URL}/api/create-task`, {
            title: 'Weekly Meeting',
            taskType: 'recurring',
            assignedTo: TEST_USERS.assignee,
            priority: 'normal',
            recurrencePattern: {
                patternType: 'weekly',
                daysOfWeek: [1, 3, 5],
                startDate: new Date().toISOString()
            }
        }, {
            headers: { Authorization: `Bearer ${TEST_USERS.creatorToken}` }
        });

        const taskId = createResponse.data.data._id;
        console.log(`✅ Task created: ${taskId}`);

        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check logs
        const logs = await getRecentLogs('task_creation', startTime);

        const notifyComplete = checkLogsForStep(logs, 'NOTIFICATION_COMPLETE', 'SUCCESS');

        console.log(`\n✅ Verification Results:`);
        console.log(`  - Notifications completed: ${notifyComplete ? '✅' : '❌'}`);

        if (notifyComplete) {
            console.log('\n🎉 TEST PASSED: Recurring task notifications sent!\n');
            return { success: true, taskId };
        } else {
            console.log('\n❌ TEST FAILED: Recurring task notifications not sent\n');
            return { success: false, taskId, logs };
        }
    } catch (error) {
        console.error(`\n❌ TEST FAILED: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Run all tests
 */
export async function runAllTests() {
    console.log('\n\n');
    console.log('█'.repeat(60));
    console.log('🧪 NOTIFICATION SYSTEM TEST SUITE');
    console.log('█'.repeat(60));
    console.log(`Started at: ${new Date().toISOString()}`);

    const results = {
        test1: await testRegularTaskCreation(),
        test2: await testTaskWithCollaborators(),
        test4: await testApprovalTaskNotification(),
        test6: await testRecurringTaskNotification()
    };

    // Use task from test 1 for update and comment tests
    if (results.test1.success && results.test1.taskId) {
        results.test3 = await testTaskUpdateNotification(results.test1.taskId);
        results.test5 = await testCommentNotification(results.test1.taskId);
    }

    // Summary
    console.log('\n\n');
    console.log('█'.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('█'.repeat(60));

    let passed = 0;
    let failed = 0;

    Object.entries(results).forEach(([testName, result]) => {
        const status = result.success ? '✅ PASSED' : '❌ FAILED';
        console.log(`${testName}: ${status}`);
        if (result.success) passed++;
        else failed++;
    });

    console.log('\n' + '─'.repeat(60));
    console.log(`Total: ${passed} passed, ${failed} failed`);
    console.log(`Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
    console.log(`Ended at: ${new Date().toISOString()}`);
    console.log('█'.repeat(60));

    return { results, passed, failed };
}

// Export for use as module
export default {
    testRegularTaskCreation,
    testTaskWithCollaborators,
    testTaskUpdateNotification,
    testApprovalTaskNotification,
    testCommentNotification,
    testRecurringTaskNotification,
    runAllTests
};
