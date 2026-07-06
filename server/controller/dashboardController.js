import Task from "../modals/taskModal.js";
import { User } from "../modals/userModal.js";
import TimezoneHelper from "../utils/timezoneHelper.js";

export const getTaskCounts = async (req, res) => {
    try {
        const { user_id, user_type } = req.query;

        if (!user_id || !user_type) {
            return res.status(400).json({
                success: false,
                message: "User ID and User Type are required"
            });
        }

        const dashboardTimezone = await TimezoneHelper.getUserTimezone(user_id);
        const { startOfDay: today, endOfDay: todayEnd } = TimezoneHelper.getDayBoundaries(dashboardTimezone);

        const tomorrow = new Date(todayEnd.getTime() + 1);

        // Base query conditions
        const baseQuery = {
            isDeleted: false
        };

        // Add user-specific conditions based on user type
        switch (user_type) {
            case "org_admin":
                // Org admin can see all tasks in their organization
                // No additional filter needed
                break;
            case "manager":
                // Get subordinates to include their tasks in count
                const managerUser = await User.findById(user_id).select('subordinates').lean();
                const subordinates = managerUser?.subordinates || [];

                baseQuery.$or = [
                    { assignedTo: user_id },
                    { createdBy: user_id },
                    { 'collaborators': user_id },
                    { assignedTo: { $in: subordinates } }
                ];
                break;
            case "individual":
            case "employee":
                // Both individual and employee can only see tasks assigned to them or where they are collaborators
                baseQuery.$or = [
                    { assignedTo: user_id },
                    { 'collaborators': user_id }
                ];
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: "Invalid user type"
                });
        }

        // Regular tasks count
        const regularTasksCount = await Task.countDocuments({
            ...baseQuery,
            taskType: "regular"
        });

        // Recurring tasks count
        const recurringTasksCount = await Task.countDocuments({
            ...baseQuery,
            taskType: "recurring"
        });

        // Quick tasks count
        const quickTasksCount = await Task.countDocuments({
            ...baseQuery,
            taskType: "regular",
            taskTypeAdvanced: "simple"
        });

        // Milestone tasks count
        const milestoneTasksCount = await Task.countDocuments({
            ...baseQuery,
            taskType: "milestone"
        });

        // Approval tasks count
        const approvalTasksCount = await Task.countDocuments({
            ...baseQuery,
            taskType: "approval"
        });

        // Tasks completed today
        const completedTodayCount = await Task.countDocuments({
            ...baseQuery,
            completedDate: {
                $gte: today,
                $lt: tomorrow
            },
            status: "completed"
        });

        // Tasks due in future
        const beforeDueDateCount = await Task.countDocuments({
            ...baseQuery,
            dueDate: { $gt: today },
            status: { $ne: "completed" }
        });

        // Past due date tasks
        const pastDueDateCount = await Task.countDocuments({
            ...baseQuery,
            dueDate: { $lt: today },
            status: { $ne: "completed" }
        });

        res.status(200).json({
            success: true,
            data: {
                regularTasksCount,
                recurringTasksCount,
                quickTasksCount,
                milestoneTasksCount,
                approvalTasksCount,
                completedTodayCount,
                beforeDueDateCount,
                pastDueDateCount,
                userDetails: {
                    userId: user_id,
                    userType: user_type,
                    accessLevel: user_type === "org_admin" ? "full" : "limited"
                }
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching task counts",
            error: error.message
        });
    }
};

export const getOverdueTasks = async (req, res) => {
    try {
        const { user_id, user_type, page = 1 } = req.query;

        if (!user_id || !user_type) {
            return res.status(400).json({
                success: false,
                message: "User ID and User Type are required"
            });
        }

        const pageSize = 5;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);

        const overdueTimezone = await TimezoneHelper.getUserTimezone(user_id);
        const { startOfDay: today } = TimezoneHelper.getDayBoundaries(overdueTimezone);

        // Standard completed statuses - used throughout the project
        const COMPLETED_STATUSES = { $in: ["DONE", "completed"] };
        const ACTIVE_STATUSES = { $nin: ["DONE", "completed", "CANCELLED"] };

        // Base query conditions
        const baseQuery = {
            isDeleted: false,
            dueDate: { $lt: today },
            status: ACTIVE_STATUSES
        };

        // Add user-specific conditions based on user type
        switch (user_type) {
            case "org_admin":
                // Org admin can see all tasks in their organization
                break;
            case "manager":
                // Get subordinates to include their tasks
                const overdueManagerUser = await User.findById(user_id).select('subordinates').lean();
                const overdueSubordinates = overdueManagerUser?.subordinates || [];

                baseQuery.$or = [
                    { assignedTo: user_id },
                    { createdBy: user_id },
                    { collaborators: user_id },
                    { assignedTo: { $in: overdueSubordinates } }
                ];
                break;
            case "individual":
            case "employee":
                baseQuery.$or = [
                    { assignedTo: user_id },
                    { collaborators: user_id }
                ];
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: "Invalid user type"
                });
        }

        // Count total matching docs for pagination
        const total = await Task.countDocuments(baseQuery);

        const tasks = await Task.find(baseQuery)
            .select("title dueDate priority")
            .sort({ dueDate: 1 })
            .skip((pageNum - 1) * pageSize)
            .limit(pageSize)
            .lean();

        // Map results to required shape and compute days overdue
        const results = tasks.map(t => {
            const due = t.dueDate ? new Date(t.dueDate) : null;
            const daysOverdue = due ? Math.ceil((today - due) / (1000 * 60 * 60 * 24)) : null;
            return {
                Task: t.title,
                DueDate: due ? due.toISOString() : null,
                DaysOverdue: daysOverdue,
                Priority: t.priority || null
            };
        });

        res.status(200).json({
            success: true,
            data: {
                page: pageNum,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
                tasks: results
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching overdue tasks",
            error: error.message
        });
    }
};
