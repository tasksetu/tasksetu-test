import Task from "../modals/taskModal.js";
import { User } from "../modals/userModal.js";
import { MilestoneTask } from "../modals/milestoneTaskModal.js";
import * as licenseService from "../services/licenseService.js";
import TimezoneHelper from "../utils/timezoneHelper.js";

// Get Dashboard Stats
export const getDashboardStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const userOrganizationId = req.user.organizationId;
        const userRole = Array.isArray(req.user.role) ? req.user.role : [req.user.role];

        console.log('📊 [DASHBOARD STATS] User Info:', {
            userId,
            userOrganizationId,
            userRole,
            email: req.user.email
        });

        const userTimezone = await TimezoneHelper.getUserTimezone(userId);
        const { startOfDay: todayStart, endOfDay: todayEnd } = TimezoneHelper.getDayBoundaries(userTimezone);
        const localParts = TimezoneHelper.getLocalTime(userTimezone);
        const firstDayOfMonth = TimezoneHelper.parseInTimezone(
            `${localParts.year}-${String(localParts.month).padStart(2, '0')}-01T00:00:00`, userTimezone
        );

        // 🔐 Role-based query filter
        const isOrgAdmin = userRole.includes('org_admin') || userRole.includes('super_admin') || userRole.includes('admin') || userRole.includes('company_admin');
        const isManager = userRole.includes('manager');

        // Define scope for general counts (Manager sees organization-wide tasks, Employee sees own)
        let scopeFilter = { organization: userOrganizationId, is_deleted: { $ne: true } };
        let milestoneScopeFilter = { organization: userOrganizationId };

        if (!isOrgAdmin) {
            if (isManager) {
                // Now Manager sees all organization tasks as per requirement
                console.log('ℹ️ [DASHBOARD STATS] Manager viewing organization scope');
            } else {
                // Individual/Employee see only their own
                scopeFilter.$or = [
                    { assignedTo: userId },
                    { createdBy: userId },
                    { collaborators: userId }
                ];
                milestoneScopeFilter.$or = [
                    { creator: userId },
                    { assignedTo: userId }
                ];
            }
        }

        // 1. Basic Counts for cards
        const [
            regularTasksCount,
            recurringTasksCount,
            quickTasksCount,
            taskMilestonesCount,
            dedicatedMilestonesCount,
            approvalTasksCount,
            completedTodayCount,
            completedThisMonthCount,
            totalTasksCount,
            totalCompletedTasksCount,
            beforeDueDateCount,
            pastDueDateCount,
            collaboratorTasksCount
        ] = await Promise.all([
            Task.countDocuments({ ...scopeFilter, taskType: "regular" }),
            Task.countDocuments({ ...scopeFilter, taskType: "recurring" }),
            Task.countDocuments({ ...scopeFilter, taskType: "regular", taskTypeAdvanced: "simple" }),
            Task.countDocuments({ ...scopeFilter, taskType: "milestone" }),
            MilestoneTask.countDocuments(milestoneScopeFilter),
            Task.countDocuments({ ...scopeFilter, taskType: "approval" }),
            Task.countDocuments({ ...scopeFilter, status: { $in: ["DONE", "completed"] }, completedDate: { $gte: todayStart, $lte: todayEnd } }),
            Task.countDocuments({ ...scopeFilter, status: { $in: ["DONE", "completed"] }, completedDate: { $gte: firstDayOfMonth } }),
            Task.countDocuments(scopeFilter),
            Task.countDocuments({ ...scopeFilter, status: { $in: ["DONE", "completed"] } }),
            Task.countDocuments({ ...scopeFilter, dueDate: { $gt: new Date() }, status: { $nin: ["DONE", "completed", "CANCELLED"] } }),
            Task.countDocuments({ ...scopeFilter, dueDate: { $lt: new Date() }, status: { $nin: ["DONE", "completed", "CANCELLED"] } }),
            Task.countDocuments({ ...scopeFilter, collaborators: userId })
        ]);

        // Add overdue and upcoming dedicated milestones to counts
        const [overdueMilestones, upcomingMilestones] = await Promise.all([
            MilestoneTask.countDocuments({ ...milestoneScopeFilter, dueDate: { $lt: new Date() }, status: { $nin: ["ACHIEVED", "CANCELLED"] } }),
            MilestoneTask.countDocuments({ ...milestoneScopeFilter, dueDate: { $gt: new Date() }, status: { $nin: ["ACHIEVED", "CANCELLED"] } })
        ]);

        const beforeDueDateCountTotal = beforeDueDateCount + upcomingMilestones;
        const pastDueDateCountTotal = pastDueDateCount + overdueMilestones;

        const milestoneTasksCount = taskMilestonesCount + dedicatedMilestonesCount;
        const totalCombinedTasks = totalTasksCount + dedicatedMilestonesCount;

        // 2. Efficiency: On-time vs Late
        // ... (existing find calls)
        const [completedTasks, achievedMilestones] = await Promise.all([
            Task.find({
                ...scopeFilter,
                status: { $in: ["DONE", "completed"] },
                dueDate: { $ne: null },
                completedDate: { $ne: null }
            }).select('dueDate completedDate createdAt').lean(),
            MilestoneTask.find({
                ...milestoneScopeFilter,
                status: "ACHIEVED",
                dueDate: { $ne: null },
                achievedAt: { $ne: null }
            }).select('dueDate achievedAt createdAt').lean()
        ]);

        let onTime = 0;
        let late = 0;
        let totalCompletionTimeMs = 0;
        let totalCount = 0;

        // Process Tasks
        completedTasks.forEach(t => {
            totalCount++;
            const compDate = new Date(t.completedDate);
            const dueDate = t.dueDate ? new Date(t.dueDate) : null;

            if (!dueDate || compDate <= dueDate) onTime++;
            else late++;

            if (t.createdAt) {
                totalCompletionTimeMs += (compDate - new Date(t.createdAt));
            }
        });

        // Process Milestones
        achievedMilestones.forEach(m => {
            totalCount++;
            const achievedAt = new Date(m.achievedAt);
            const dueDate = m.dueDate ? new Date(m.dueDate) : null;

            if (!dueDate || achievedAt <= dueDate) onTime++;
            else late++;

            if (m.createdAt) {
                totalCompletionTimeMs += (achievedAt - new Date(m.createdAt));
            }
        });

        const avgTaskCompletionTime = totalCount > 0
            ? (totalCompletionTimeMs / totalCount / (1000 * 60 * 60 * 24)).toFixed(1) + " days"
            : "N/A";

        // 3. Team-Specific Data (All employees in Org for Heatmap/Members list)
        let teamData = null;
        if (isManager || isOrgAdmin) {
            // Get all employees in the organization (Requested by user for Heatmap/Overdue by Member/Team Members)
            const allEmployees = await User.find({
                organization_id: userOrganizationId,
                status: 'active'
            }).select('firstName lastName role lastLoginAt subordinates isActive').lean();

            const employeeStats = await Promise.all(allEmployees.map(async (emp) => {
                const [
                    activeTasks,
                    overdueTasks,
                    completedTasks,
                    onTimeTasks,
                    activeMilestones,
                    overdueMilestones,
                    completedMilestones,
                    onTimeMilestones
                ] = await Promise.all([
                    Task.countDocuments({ organization: userOrganizationId, assignedTo: emp._id, status: { $nin: ["DONE", "completed", "CANCELLED"] }, is_deleted: { $ne: true } }),
                    Task.countDocuments({ organization: userOrganizationId, assignedTo: emp._id, status: { $nin: ["DONE", "completed", "CANCELLED"] }, dueDate: { $lt: new Date() }, is_deleted: { $ne: true } }),
                    Task.countDocuments({ organization: userOrganizationId, assignedTo: emp._id, status: { $in: ["DONE", "completed"] }, is_deleted: { $ne: true } }),
                    Task.countDocuments({
                        organization: userOrganizationId,
                        assignedTo: emp._id,
                        status: { $in: ["DONE", "completed"] },
                        dueDate: { $ne: null },
                        completedDate: { $ne: null },
                        $expr: { $lte: ["$completedDate", "$dueDate"] },
                        is_deleted: { $ne: true }
                    }),
                    MilestoneTask.countDocuments({ organization: userOrganizationId, assignedTo: emp._id, status: { $nin: ["ACHIEVED", "CANCELLED"] } }),
                    MilestoneTask.countDocuments({ organization: userOrganizationId, assignedTo: emp._id, status: { $nin: ["ACHIEVED", "CANCELLED"] }, dueDate: { $lt: new Date() } }),
                    MilestoneTask.countDocuments({ organization: userOrganizationId, assignedTo: emp._id, status: "ACHIEVED" }),
                    MilestoneTask.countDocuments({
                        organization: userOrganizationId,
                        assignedTo: emp._id,
                        status: "ACHIEVED",
                        dueDate: { $ne: null },
                        achievedAt: { $ne: null },
                        $expr: { $lte: ["$achievedAt", "$dueDate"] }
                    })
                ]);

                const totalCompleted = completedTasks + completedMilestones;
                const totalOnTime = onTimeTasks + onTimeMilestones;

                return {
                    id: emp._id,
                    name: `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
                    role: emp.role || "Member",
                    avatar: (emp.firstName?.[0] || "") + (emp.lastName?.[0] || ""),
                    activeTasks: activeTasks + activeMilestones,
                    overdueTasks: overdueTasks + overdueMilestones,
                    productivity: totalCompleted > 0 ? Math.round((totalOnTime / totalCompleted) * 100) : 100,
                    lastActivity: emp.lastLoginAt ? TimezoneHelper.formatInTimezone(new Date(emp.lastLoginAt), userTimezone) : "Never",
                    status: emp.isActive ? "online" : "offline",
                    capacity: 10
                };
            }));

            // 4. Weekly Performance (Last 7 days, Manager scope)
            const days = [];
            for (let i = 6; i >= 0; i--) {
                const refDate = new Date();
                refDate.setDate(refDate.getDate() - i);
                const { startOfDay: dayStart } = TimezoneHelper.getDayBoundaries(userTimezone, refDate);
                days.push(dayStart);
            }

            const weeklyPerformance = await Promise.all(days.map(async (day) => {
                const refForEnd = new Date(day.getTime() + 1000); // slight offset to ensure same day
                const { endOfDay: dayEnd } = TimezoneHelper.getDayBoundaries(userTimezone, refForEnd);

                const [dayCompletedTasks, dayCompletedMilestones, dayAssignedTasks, dayAssignedMilestones] = await Promise.all([
                    Task.countDocuments({
                        ...scopeFilter,
                        status: { $in: ["DONE", "completed"] },
                        completedDate: { $gte: day, $lte: dayEnd }
                    }),
                    MilestoneTask.countDocuments({
                        ...milestoneScopeFilter,
                        status: "ACHIEVED",
                        achievedAt: { $gte: day, $lte: dayEnd }
                    }),
                    Task.countDocuments({
                        ...scopeFilter,
                        createdAt: { $gte: day, $lte: dayEnd }
                    }),
                    MilestoneTask.countDocuments({
                        ...milestoneScopeFilter,
                        createdAt: { $gte: day, $lte: dayEnd }
                    })
                ]);

                return {
                    day: TimezoneHelper.formatInTimezone(day, userTimezone, { weekday: 'short' }),
                    completed: dayCompletedTasks + dayCompletedMilestones,
                    assigned: (dayAssignedTasks + dayAssignedMilestones) || 0
                };
            }));

            teamData = {
                employeeStats,
                weeklyPerformance,
                totalEmployees: allEmployees.length
            };
        }

        // Calculate overall productivity for scope (Team or Individual)
        // Productivity = Total Completed / Total Tasks (Overall progress)
        // Efficiency = On-time Rate (Percentage)
        const totalCompleted = totalCompletedTasksCount + achievedMilestones.length;
        const productivity = totalCombinedTasks > 0 ? Math.round((totalCompleted / totalCombinedTasks) * 100) : 0;

        // Use productivity score for tile, but efficiency rate for pie is onTime/late
        const actualProductivity = productivity;

        // 4. License Status (Requested by user to show in dashboard)
        let licenseInfo = null;
        try {
            licenseInfo = await licenseService.getUserLicenseInfo(userId);
        } catch (err) {
            console.error('⚠️ [DASHBOARD STATS] License fetch error:', err);
        }

        const stats = {
            regularTasksCount,
            recurringTasksCount,
            quickTasksCount,
            milestoneTasksCount,
            approvalTasksCount,
            completedTodayCount,
            completedThisMonthCount,
            beforeDueDateCount: beforeDueDateCountTotal,
            pastDueDateCount: pastDueDateCountTotal,
            collaboratorTasksCount,
            efficiency: { onTime, late, avgTaskCompletionTime },
            productivity, // Added global productivity score for the scope
            teamData,
            license: {
                status: licenseInfo?.status || 'UNKNOWN',
                isExpired: licenseInfo?.is_expired || false,
                licenseCode: licenseInfo?.license_code || 'NONE'
            }
        };

        console.log('📊 [DASHBOARD STATS] Results for Role:', userRole);

        res.status(200).json({
            success: true,
            message: "Dashboard stats retrieved successfully",
            data: stats,
            accessLevel: isOrgAdmin ? 'organization' : (isManager ? 'team' : 'user')
        });

    } catch (error) {
        console.error("❌ [DASHBOARD STATS] Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch dashboard stats",
            error: error.message
        });
    }
};

