import { User } from "../modals/userModal.js";
import Task from "../modals/taskModal.js";
import LicenseInstance from "../modals/licenseInstanceModal.js";
import { FormTemplate } from "../modals/formTemplateModal.js";
import mongoose from "mongoose";

export const enrichCompany = async (org) => {
    const orgId = org._id;

    // Fetch users with license info
    const users = await User.find({ organization_id: orgId });
    const userCount = users.length;

    // Fetch primary admin
    const primaryAdmin = await User.findOne({
        organization_id: orgId,
        isPrimaryAdmin: true
    }).lean();

    // Get license stats
    const licenseStats = await LicenseInstance.aggregate([
        { $match: { organization_id: orgId } },
        {
            $group: {
                _id: "$license_code",
                total: { $sum: 1 },
                assigned: {
                    $sum: { $cond: [{ $eq: ["$status", "ASSIGNED"] }, 1, 0] },
                },
                available: {
                    $sum: { $cond: [{ $eq: ["$status", "AVAILABLE"] }, 1, 0] },
                },
                expired: {
                    $sum: { $cond: [{ $eq: ["$status", "EXPIRED"] }, 1, 0] },
                },
            },
        },
    ]);

    // Get task statistics by status and type
    const taskStats = await Task.aggregate([
        { $match: { organization: orgId } },
        {
            $group: {
                _id: {
                    status: "$status",
                    taskType: "$taskType",
                },
                count: { $sum: 1 },
            },
        },
    ]);

    // Format task stats
    const taskStatsByStatus = {
        OPEN: 0,
        INPROGRESS: 0,
        DONE: 0,
        ONHOLD: 0,
        CANCELLED: 0,
    };
    const taskStatsByType = {
        regular: 0,
        recurring: 0,
        milestone: 0,
        approval: 0,
    };

    taskStats.forEach((stat) => {
        if (taskStatsByStatus.hasOwnProperty(stat._id.status)) {
            taskStatsByStatus[stat._id.status] += stat.count;
        }
        if (taskStatsByType.hasOwnProperty(stat._id.taskType)) {
            taskStatsByType[stat._id.taskType] += stat.count;
        }
    });

    const totalTasks = taskStats.reduce((sum, stat) => sum + stat.count, 0);

    // License summary
    const licenseMap = {};
    licenseStats.forEach((stat) => {
        licenseMap[stat._id] = {
            total: stat.total,
            assigned: stat.assigned,
            available: stat.available,
            expired: stat.expired,
        };
    });

    // User roles breakdown
    const usersByRole = {};
    users.forEach((user) => {
        user.role.forEach((r) => {
            usersByRole[r] = (usersByRole[r] || 0) + 1;
        });
    });

    // Get form count for the organization
    // Forms are linked to organizations through owner_user_id who belongs to the organization
    const formCount = await FormTemplate.countDocuments({
        owner_user_id: { $in: users.map(u => u._id) },
        deleted_at: null // Exclude soft-deleted forms
    });

    return {
        ...org.toObject(),
        userCount,
        projectCount: 0,
        formCount,
        taskCount: totalTasks,
        primaryAdmin: primaryAdmin || null,
        stats: {
            users: userCount,
            usersTotal: userCount,
            usersByRole,
            projects: 0,
            tasks: totalTasks,
            tasksByStatus: taskStatsByStatus,
            tasksByType: taskStatsByType,
            forms: formCount,
        },
        licenses: licenseMap,
        totalLicenses: licenseStats.reduce((sum, stat) => sum + stat.total, 0),
        assignedLicenses: licenseStats.reduce(
            (sum, stat) => sum + stat.assigned,
            0
        ),
        availableLicenses: licenseStats.reduce(
            (sum, stat) => sum + stat.available,
            0
        ),
    };
};
