// utils/helperfunction.js
import TimezoneHelper from './timezoneHelper.js';

// Utility function to extract organization ID from task
function getTaskOrganizationId(taskOrganization) {
    if (!taskOrganization) return null;
    // Handle populated organization object
    if (taskOrganization._id) {
        return taskOrganization._id.toString();
    }
    // Handle direct ObjectId
    return taskOrganization.toString();
}

function calculateNextDueDate(recurrencePattern, currentDueDate) {
    if (!recurrencePattern || !currentDueDate) return null;

    const date = new Date(currentDueDate);

    switch (recurrencePattern.frequency) {
        case 'daily':
            date.setDate(date.getDate() + (recurrencePattern.interval || 1));
            break;
        case 'weekly':
            date.setDate(date.getDate() + (7 * (recurrencePattern.interval || 1)));
            break;
        case 'monthly':
            date.setMonth(date.getMonth() + (recurrencePattern.interval || 1));
            break;
        case 'yearly':
            date.setFullYear(date.getFullYear() + (recurrencePattern.interval || 1));
            break;
    }

    return date;
}

// ✅ Import enhanced calculators
import { calculateNextOccurrence, calculateFirstOccurrence } from './recurringTaskValidator.js';

function createNextRecurringOccurrence(parentTask, completionDate = null, userTimezone = 'UTC') {
    if (!parentTask.isRecurring || !parentTask.recurrencePattern) {
        return null;
    }

    const pattern = parentTask.recurrencePattern;
    const currentDueDate = parentTask.dueDate ? new Date(parentTask.dueDate) : new Date();

    // ✅ Use enhanced calculator
    const nextDueDate = calculateNextOccurrence(currentDueDate, pattern, userTimezone);

    if (!nextDueDate) {
        console.log('🏁 Recurring task series ended - no more occurrences');
        return null; // Recurrence has ended
    }

    // ✅ Check occurrence limit (Section 4.3 - Recurring Task Logic)
    // Use instanceNumber if it's an instance, otherwise use occurrenceCount for parent
    const currentInstanceNum = parentTask.instanceNumber || parentTask.occurrenceCount || 1;

    if (pattern.endCondition === 'after' && pattern.occurrences) {
        if (currentInstanceNum >= parseInt(pattern.occurrences)) {
            console.log('🏁 Recurring task series ended - reached occurrence limit:', pattern.occurrences);
            return null;
        }
    }

    // ✅ Get parent task ID (Section 4.3 - Parent/Instance Relationship)
    // If current task is already an instance, use its parent; otherwise, it's the parent
    const parentTaskId = parentTask.parentRecurringTaskId || parentTask._id;

    // ✅ Create new task occurrence (child instance) with same structure
    // Section 4.3: "Each recurrence instance is created as an independent task entry"
    const newOccurrence = {
        ...parentTask,
        _id: undefined, // Will get new ID
        dueDate: nextDueDate,
        status: 'OPEN', // ✅ Section 4.3: "New instance always starts as OPEN"
        completedDate: null,
        completedBy: null,
        comments: [], // Fresh comment/feed for each occurrence
        createdAt: new Date(),
        updatedAt: new Date(),

        // ✅ Parent/Instance tracking (Section 4.3)
        isParentRecurring: false, // This is NOT the parent, it's a child instance
        parentRecurringTaskId: parentTaskId, // Link to parent template
        instanceNumber: currentInstanceNum + 1, // Track instance sequence
        occurrenceCount: undefined, // Only parent tracks total occurrences
        isStatusSystemManaged: false, // ✅ Instances can be manually updated (Section 4.3)

        // ✅ 🔄 Inherit contributors from parent (Section 4.3 - Recurring Task Contributors)
        // Contributors: Multiple non-assigning users with visibility + notifications
        contributors: parentTask.contributors && parentTask.contributors.length > 0
            ? [...parentTask.contributors]
            : [],

        // Maintain recurrence pattern for future occurrences
        nextDueDate: calculateNextOccurrence(nextDueDate, pattern, userTimezone)
    };

    console.log('✅ [RECURRING] Next instance created:', {
        parentTaskId,
        instanceNumber: newOccurrence.instanceNumber,
        currentDueDate,
        nextDueDate,
        pattern: pattern.patternType,
        status: newOccurrence.status
    });

    return newOccurrence;
}

function getTaskTypeLabel(taskType) {
    const labels = {
        regular: 'Regular task',
        recurring: 'Recurring task',
        milestone: 'Milestone',
        approval: 'Approval task'
    };
    return labels[taskType] || 'Task';
}

/**
 * Update parent recurring task status based on its instances
 * Section 4.3 & 4.6: Parent status is system-managed and reflects aggregate status
 * 
 * Status Rules:
 * - All past instances DONE + next scheduled → INPROGRESS
 * - Current active instance INPROGRESS → INPROGRESS
 * - All instances completed and no upcoming → DONE
 * - First instance not started → OPEN
 * 
 * @param {Object} parentTask - The parent recurring task
 * @param {Array} instances - Array of child instances
 * @returns {string} - The calculated parent status
 */
async function updateParentRecurringStatus(parentTask, instances = [], userTimezone = 'UTC') {
    if (!parentTask || !parentTask.isParentRecurring) {
        return null;
    }

    console.log('📊 [PARENT STATUS] Calculating aggregate status for parent:', parentTask._id);
    console.log('📊 [PARENT STATUS] Total instances:', instances.length);

    // If no instances yet, parent remains OPEN
    if (instances.length === 0) {
        console.log('📊 [PARENT STATUS] No instances yet → OPEN');
        return 'OPEN';
    }

    const now = new Date();
    let newStatus = 'OPEN';

    // Categorize instances
    const pastInstances = instances.filter(inst => new Date(inst.dueDate) < now);
    const { startOfDay: dayStart, endOfDay: dayEnd } = TimezoneHelper.getDayBoundaries(userTimezone);
    const currentInstance = instances.find(inst => {
        const dueDate = new Date(inst.dueDate);
        return dueDate >= dayStart && dueDate <= dayEnd;
    });
    const futureInstances = instances.filter(inst => new Date(inst.dueDate) > now);

    // Check if recurrence has ended
    const pattern = parentTask.recurrencePattern;
    let hasMoreOccurrences = true;

    if (pattern.endCondition === 'after' && pattern.occurrences) {
        hasMoreOccurrences = instances.length < parseInt(pattern.occurrences);
    } else if (pattern.endCondition === 'by_date' && pattern.endDate) {
        hasMoreOccurrences = new Date(pattern.endDate) > now;
    }

    console.log('📊 [PARENT STATUS] Instance breakdown:', {
        past: pastInstances.length,
        current: currentInstance ? 1 : 0,
        future: futureInstances.length,
        hasMoreOccurrences
    });

    // Apply status rules (Section 4.6)

    // Rule 1: Current active instance INPROGRESS → Parent INPROGRESS
    if (currentInstance && currentInstance.status === 'INPROGRESS') {
        newStatus = 'INPROGRESS';
        console.log('📊 [PARENT STATUS] Current instance is INPROGRESS → INPROGRESS');
    }
    // Rule 2: All instances completed and no upcoming → Parent DONE
    else if (instances.every(inst => inst.status === 'DONE') && !hasMoreOccurrences) {
        newStatus = 'DONE';
        console.log('📊 [PARENT STATUS] All instances DONE, no more occurrences → DONE');
    }
    // Rule 3: All past instances DONE + next scheduled → Parent INPROGRESS
    else if (pastInstances.every(inst => inst.status === 'DONE') &&
        (futureInstances.length > 0 || hasMoreOccurrences)) {
        newStatus = 'INPROGRESS';
        console.log('📊 [PARENT STATUS] Past instances done, future scheduled → INPROGRESS');
    }
    // Rule 4: First instance not started → Parent OPEN
    else if (instances[0] && instances[0].status === 'OPEN') {
        newStatus = 'OPEN';
        console.log('📊 [PARENT STATUS] First instance not started → OPEN');
    }
    // Default: if any instance is INPROGRESS
    else if (instances.some(inst => inst.status === 'INPROGRESS')) {
        newStatus = 'INPROGRESS';
        console.log('📊 [PARENT STATUS] Some instances INPROGRESS → INPROGRESS');
    }

    console.log('📊 [PARENT STATUS] Final calculated status:', newStatus);
    return newStatus;
}

export {
    calculateNextDueDate,
    getTaskTypeLabel,
    getTaskOrganizationId,
    createNextRecurringOccurrence,
    calculateFirstOccurrence,
    updateParentRecurringStatus
};
