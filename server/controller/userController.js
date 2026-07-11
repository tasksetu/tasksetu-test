import { User } from "../modals/userModal.js";
import mongoose from "mongoose";
import { storage } from "../mongodb-storage.js";
import { emailService } from "../services/emailService.js";
import auditLogger from "../utils/auditLogger.js";
import Task from "../modals/taskModal.js";
import { FormTemplate } from "../modals/formTemplateModal.js";
import { seatManagementService } from "../services/seatManagementService.js";
import LicenseInstance from "../modals/licenseInstanceModal.js";

// temporary assignee user data

export const getEmployeesByOrganization = async (req, res) => {
  try {
    const { organizationId } = req.user;

    // Validate ObjectId if your organization_id is stored as ObjectId
    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
      return res.status(400).json({ message: "Invalid organization ID" });
    }
    console.log("?????odaata", organizationId);
    const data = await User.aggregate([
      {
        $match: {
          organization_id: organizationId,
        },
      },
      {
        $group: {
          _id: "$organization_id",
          employees: {
            $push: {
              _id: "$_id",
              firstName: "$firstName",
              lastName: "$lastName",
              designation: "$designation",
              department: "$department",
              phone: "$phone",
              email: "$email",
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          organization_id: "$_id",
          employees: 1,
        },
      },
    ]);

    // If no records found
    if (!data.length) {
      return res
        .status(404)
        .json({ message: "No employees found for this organization" });
    }

    const organizationObject = data[0];
    const employeesWithStats = await Promise.all(
      organizationObject.employees.map(async (emp) => {
        const userId = emp._id;
        const [formsCreated, activeProcesses] = await Promise.all([
          FormTemplate.countDocuments({ owner_user_id: userId }),
          Task.countDocuments({
            createdBy: userId,
            isMilestone: true,
            "linkedTasks.0": { $exists: true },
            isDeleted: { $ne: true },
          }),
        ]);
        return {
          ...emp,
          formsCreated,
          activeProcesses,
        };
      }),
    );

    res.status(200).json({
      ...organizationObject,
      employees: employeesWithStats,
    });
  } catch (error) {
    console.error("Aggregation error:", error);
    res.status(500).json({ message: "Server Error", error });
  }
};

/**
 * Remove/Delete user
 * Only org_admin can remove user (enforced in route middleware)
 */
export const removeUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        status: 401,
        message: "Unauthorized - user not authenticated",
      });
    }

    // Find the user first to check if exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: 404,
        message: "User not found",
      });
    }

    // Check if user belongs to the same organization as the admin
    if (
      user.organization_id.toString() !== req.user.organizationId.toString()
    ) {
      return res.status(403).json({
        status: 403,
        message: "Cannot remove user from different organization",
      });
    }

    // Prevent removing primary admin
    if (user.isPrimaryAdmin) {
      return res.status(400).json({
        status: 400,
        message: "Cannot remove primary admin",
      });
    }

    // ✅ Release license instance if user has one assigned
    try {
      let licenseInstance = null;

      // Method 1: Find by user's license_instance_id field
      if (user.license_instance_id) {
        console.log(
          `🔑 Finding license instance by user.license_instance_id: ${user.license_instance_id}`,
        );
        licenseInstance = await LicenseInstance.findById(
          user.license_instance_id,
        );
      }

      // Method 2: Fallback - find by assigned_to field in LicenseInstance
      if (!licenseInstance) {
        console.log(
          `🔍 Searching for license instance assigned to user ${user._id}`,
        );
        licenseInstance = await LicenseInstance.findOne({
          assigned_to: user._id,
          status: "ASSIGNED",
        });
      }

      if (licenseInstance) {
        console.log(
          `🔑 Releasing license instance ${licenseInstance._id} (${licenseInstance.license_code}) from user ${user.email}`,
        );
        licenseInstance.assigned_to = null;
        licenseInstance.status = "AVAILABLE";
        licenseInstance.released_at = new Date();
        await licenseInstance.save();
        console.log(`✅ License instance released back to pool`);
      } else {
        console.log("ℹ️ User has no license instance assigned");
      }
    } catch (licenseError) {
      console.error(
        "❌ Error releasing license instance:",
        licenseError.message,
      );
      // Continue with user deletion even if license release fails
    }

    // Release seat if user has one assigned (legacy support)
    if (user.seat_assigned === true) {
      console.log(
        `🎫 Releasing seat #${user.seat_number} from user ${user.email}`,
      );

      try {
        await seatManagementService.releaseSeatFromUser(
          user.organization_id.toString(),
          userId,
          req.user.id,
          "User removed from organization",
        );
        console.log(`✅ Seat released successfully`);
      } catch (seatError) {
        console.error("❌ Error releasing seat:", seatError.message);
        // Continue with user deletion even if seat release fails
      }
    }

    // Delete the user
    await User.findByIdAndDelete(userId);

    // 📜 Log Audit Entry
    try {
      await auditLogger.logUserDeletion(user, req.user, req);
    } catch (auditError) {
      console.error(
        "⚠️ [AUDIT] Error logging user deletion:",
        auditError.message,
      );
    }

    return res.status(200).json({
      status: 200,
      message: "User removed successfully",
    });
  } catch (err) {
    return res.status(500).json({
      status: 500,
      message: "Failed to remove user",
      error: err.message,
    });
  }
};

/**
 * Get organization statistics
 * Returns user stats by status
 */
export const getOrgStats = async (req, res) => {
  try {
    const { orgId } = req.params;

    // Validate orgId to prevent undefined errors
    if (!orgId || orgId === "undefined" || orgId === "null") {
      console.error("❌ Invalid orgId for stats:", orgId);
      return res.status(400).json({
        message: "Invalid organization ID",
        error: "Organization ID is required",
      });
    }

    // Fetch all users for the organization
    const allUsers = await User.find({
      organization_id: orgId,
    })
      .select("status")
      .lean();

    const user_stats = {
      total:
        allUsers.length - allUsers.filter((u) => u.status === "invited").length,
      active: allUsers.filter((u) => u.status === "active").length,
      pending: allUsers.filter((u) => u.status === "invited").length,
      inactive: allUsers.filter((u) => u.status === "inactive").length,
    };

    res.json({
      user_stats,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * Get users by organization

 */
export const getUsersByOrg = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { page = 1, search = "" } = req.query;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Validate orgId to prevent undefined errors
    if (!orgId || orgId === "undefined" || orgId === "null") {
      console.error("❌ Invalid orgId:", orgId);
      return res.status(400).json({
        message: "Invalid organization ID",
        error: "Organization ID is required",
      });
    }

    // Common base query
    const baseQuery = {
      organization_id: orgId,
    };
    console.log("Base Query:", baseQuery);
    // If searching, extend with OR conditions
    const searchQuery = search
      ? {
          ...baseQuery,
          $or: [
            { firstName: { $regex: search, $options: "i" } },
            { lastName: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { department: { $regex: search, $options: "i" } },
            { designation: { $regex: search, $options: "i" } },
          ],
        }
      : baseQuery;

    // Count total users for pagination
    const total = await User.countDocuments(searchQuery);

    // Fetch paginated users - include license fields
    const users = await User.find(searchQuery)
      .select(
        "firstName lastName role department designation location assignedTasks completedTasks status lastLoginAt isPrimaryAdmin email createdAt license_code assigned_license",
      )
      .skip(skip)
      .limit(limit)
      .lean();

    // Compute assigned/completed counts for each user on this page
    const counts = await Promise.all(
      users.map(async (u) => {
        const userId = u._id;
        const [
          assignedCount,
          completedCount,
          formsCreatedCount,
          activeProcessesCount,
        ] = await Promise.all([
          Task.countDocuments({ assignedTo: userId, isDeleted: { $ne: true } }),
          Task.countDocuments({
            assignedTo: userId,
            status: "DONE", // Updated to match taskModal enum
            isDeleted: { $ne: true },
          }),
          FormTemplate.countDocuments({ owner_user_id: userId }),
          Task.countDocuments({
            createdBy: userId,
            isMilestone: true,
            "linkedTasks.0": { $exists: true },
            isDeleted: { $ne: true },
          }),
        ]);
        return {
          id: userId.toString(),
          assignedTasks: assignedCount,
          completedTasks: completedCount,
          formsCreated: formsCreatedCount,
          activeProcesses: activeProcessesCount,
        };
      }),
    );
    const countsMap = counts.reduce((acc, c) => {
      acc[c.id] = c;
      return acc;
    }, {});

    const formattedUsers = users.map((u) => ({
      ...u,
      firstName: u.firstName || "",
      lastName: u.lastName || "",
      lastLoginAt: u.lastLoginAt || null,
      // Fix: Get license from assigned_license or license_code field
      license_code: u.assigned_license?.license_code || u.license_code || null,
      licenseId:
        u.assigned_license?.license_code || u.license_code || "No license",
      // override with live counts computed from tasks
      assignedTasks: countsMap[u._id.toString()]?.assignedTasks ?? 0,
      completedTasks: countsMap[u._id.toString()]?.completedTasks ?? 0,
      formsCreated: countsMap[u._id.toString()]?.formsCreated ?? 0,
      activeProcesses: countsMap[u._id.toString()]?.activeProcesses ?? 0,
    }));

    res.json({
      users: formattedUsers,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
/**
 * Update user details
 * Only org_admin can update user (enforced in route middleware)
 * Fields that can be updated: firstName, lastName, role, designation, department, location
 */
export const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      firstName,
      lastName,
      role,
      designation,
      department,
      location,
      license_code,
    } = req.body;

    console.log(`📝 updateUser called for userId: ${userId}`);
    console.log(`📦 Request body:`, {
      firstName,
      lastName,
      role,
      designation,
      department,
      location,
      license_code,
    });

    // Find user first to check current license
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: 404,
        message: "User not found",
      });
    }

    console.log(
      `👤 Found user: ${user.email}, isPrimaryAdmin: ${user.isPrimaryAdmin}`,
    );
    console.log(`📋 User license info:`, {
      assigned_license: user.assigned_license,
      license_code: user.license_code,
      license_instance_id: user.license_instance_id,
    });

    const organizationId = user.organizationId || user.organization_id;
    const currentLicenseCode = user.license_code;
    const isPrimaryAdmin = user.isPrimaryAdmin === true;

    console.log(
      `🔐 isPrimaryAdmin check: user.isPrimaryAdmin = ${user.isPrimaryAdmin}, evaluated as: ${isPrimaryAdmin}`,
    );
    console.log(
      `📊 License comparison: requested "${license_code}" vs current "${currentLicenseCode}", same? ${license_code === currentLicenseCode}`,
    );

    // Handle license change if provided and different (license_code is optional)
    if (license_code !== undefined && license_code !== currentLicenseCode) {
      console.log(
        `🔄 License change requested: ${currentLicenseCode} -> ${license_code}`,
      );
      console.log(`👤 User isPrimaryAdmin: ${isPrimaryAdmin}`);

      const { default: LicenseInstance } =
        await import("../modals/licenseInstanceModal.js");
      const { default: OrganizationLicensePurchase } =
        await import("../modals/organizationLicensePurchaseModal.js");

      // Step 1: Release current license if user has one (release from the pool)
      if (
        user.license_instance_id ||
        (user.assigned_license && user.assigned_license.purchase_id)
      ) {
        let currentInstance = null;
        if (user.license_instance_id) {
          currentInstance = await LicenseInstance.findById(
            user.license_instance_id,
          );
        } else if (user.assigned_license && user.assigned_license.purchase_id) {
          currentInstance = await LicenseInstance.findOne({
            purchase_id: user.assigned_license.purchase_id,
            assigned_to: userId,
            status: "ASSIGNED",
          });
        }

        if (currentInstance) {
          currentInstance.status = "AVAILABLE";
          currentInstance.assigned_to = null;
          currentInstance.assigned_at = null;
          await currentInstance.save();

          // Also decrement seats_used in the purchase record
          if (currentInstance.purchase_id) {
            await OrganizationLicensePurchase.findByIdAndUpdate(
              currentInstance.purchase_id,
              { $inc: { seats_used: -1 } },
            );
          }

          console.log(
            `✅ Released ${currentLicenseCode} instance and decremented seats_used`,
          );
        }
      }

      // Step 2: Assign new license if provided and not EXPLORE (which is the default)
      if (license_code && license_code !== "EXPLORE") {
        const availableInstance = await LicenseInstance.findOne({
          organization_id: organizationId,
          license_code: license_code,
          status: "AVAILABLE",
        }).sort({ created_at: 1 });

        if (!availableInstance) {
          // 🆕 PRIMARY ADMIN SPECIAL HANDLING:
          // Primary admin can assign any license to themselves even if no pool licenses are available
          if (isPrimaryAdmin) {
            console.log(
              `🔑 Primary Admin bypass: Assigning ${license_code} without pool instance`,
            );

            // Update user with the license directly
            user.assigned_license = {
              license_code: license_code,
              purchase_id: null,
              assigned_date: new Date(),
            };
            user.license_code = license_code;
            user.license_instance_id = null;
            user.seat_assigned = true;
            user.seat_number = null;

            console.log(
              `✅ Primary Admin: Assigned ${license_code} directly to user ${userId}`,
            );
          } else {
            return res.status(400).json({
              status: 400,
              message: `No available ${license_code} licenses in the pool`,
            });
          }
        } else {
          // Assign the instance from pool
          availableInstance.status = "ASSIGNED";
          availableInstance.assigned_to = userId;
          availableInstance.assigned_at = new Date();
          await availableInstance.save();

          // Increment seats_used in the purchase record
          if (availableInstance.purchase_id) {
            await OrganizationLicensePurchase.findByIdAndUpdate(
              availableInstance.purchase_id,
              { $inc: { seats_used: 1 } },
            );
          }

          // Update user with new assigned license
          user.assigned_license = {
            license_code: license_code,
            purchase_id: availableInstance.purchase_id,
            assigned_date: new Date(),
          };
          user.license_code = license_code;
          user.license_instance_id = availableInstance._id;
          user.seat_assigned = true;
          user.seat_number = availableInstance.seat_number;

          console.log(`✅ Assigned ${license_code} instance to user ${userId}`);
        }
      } else {
        // Clear assignment - back to EXPLORE or no license
        console.log(
          `🔄 Clearing license assignment for user (Setting to ${license_code || "EXPLORE"})`,
        );
        user.assigned_license = null;
        user.license_instance_id = null;
        user.license_code = license_code || "EXPLORE";
        user.seat_assigned = false;
        user.seat_number = null;
      }
    }

    // Update other fields
    const oldRole = user.role;
    user.firstName = firstName || user.firstName;
    user.lastName = lastName || user.lastName;
    user.role = role || user.role;
    user.designation = designation || user.designation;
    user.department = department || user.department;
    user.location = location || user.location;

    const updated = await user.save();

    // Audit log for role change
    if (role && role !== oldRole) {
      await auditLogger.logRoleChange(user, oldRole, role, req.user, req);
    }

    // Audit log for license change (already handled above in logic, but let's log it specifically if needed)
    if (license_code && license_code !== currentLicenseCode) {
      await auditLogger.logLicenseAssignment(user, license_code, req.user, req);
    }

    return res.status(200).json({
      status: 200,
      message: "Successfully updated",
      data: updated,
    });
  } catch (err) {
    console.error("❌ Error updating user:", err);
    return res.status(400).json({
      status: 400,
      message: "Update failed",
      error: err.message,
    });
  }
};

/**
 * Update user status (active/inactive)
 * If activating and last login > 90 days, send invitation email
 */
export const updateUserStatus = async (req, res) => {
  try {
    const { userId, status } = req.body;
    if (!userId || !["active", "inactive"].includes(status)) {
      return res.status(400).json({ message: "Invalid userId or status" });
    }

    // Use storage utility to get user
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if status is changing
    if (user.status === status) {
      return res
        .status(200)
        .json({ message: "Status already set", data: user });
    }

    // Release seat if user is being deactivated and has a seat assigned
    if (status === "inactive" && user.seat_assigned === true) {
      console.log(
        `🎫 Releasing seat #${user.seat_number} from deactivated user ${user.email}`,
      );

      try {
        await seatManagementService.releaseSeatFromUser(
          user.organization_id.toString(),
          userId,
          req.user.id,
          "User deactivated",
        );
        console.log(`✅ Seat released successfully`);
      } catch (seatError) {
        console.error("❌ Error releasing seat:", seatError.message);
        // Continue with status update even if seat release fails
      }
    }

    // Update status
    await storage.updateUser(userId, { status });

    // 📜 Log Audit Entry
    try {
      const action = status === "active" ? "activate" : "deactivate";
      await auditLogger.logUserStatusChange(user, action, req.user, req);
    } catch (auditError) {
      console.error(
        "⚠️ [AUDIT] Error logging user status change:",
        auditError.message,
      );
    }

    let invitationSent = false;

    // If activating and last login > 90 days, send reset email
    if (
      status === "active" &&
      (!user.lastLoginAt ||
        (new Date() - new Date(user.lastLoginAt)) / (1000 * 60 * 60 * 24) > 90)
    ) {
      // Generate reset token and expiry
      const resetToken = storage.generatePasswordResetToken();
      const resetExpiry = new Date(Date.now() + 3600000); // 1 hour

      // Save token to user
      await storage.updateUser(userId, {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpiry,
      });

      // Send reset email
      await emailService.sendPasswordResetEmail(
        user.email,
        resetToken,
        user.firstName || user.lastName || "User",
      );
      invitationSent = true;
    }

    // Get updated user for response
    const updatedUser = await storage.getUser(userId);

    return res.status(200).json({
      message: "Status updated successfully",
      invitationSent,
      data: updatedUser,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

/**
 * Send invitation to user
 * Generates a password reset token and sends invite email
 */
export const sendInvite = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!req.user) {
      return res.status(401).json({
        status: 401,
        message: "Unauthorized - user not authenticated",
      });
    }
    if (!userId) {
      return res.status(400).json({
        status: 400,
        message: "userId is required",
      });
    }

    const user = await User.findById(userId).select(
      "email firstName lastName organization_id status role invitedBy",
    );
    if (!user) {
      return res.status(404).json({
        status: 404,
        message: "User not found",
      });
    }

    if (
      user.organization_id.toString() !== req.user.organizationId.toString()
    ) {
      return res.status(403).json({
        status: 403,
        message: "Cannot invite user from different organization",
      });
    }

    // Generate invitation token (24 hours expiry)
    // Note: store in inviteToken/inviteTokenExpiry so validation works
    const token = storage.generatePasswordResetToken();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Mark as invited if not active
    const nextStatus = user.status === "active" ? "active" : "invited";

    // Resolve inviter info
    const inviterUserId = req.user.userId || req.user.id || req.user._id;
    let inviterName = req.user.email || "Admin";
    let inviterIdToSave = inviterUserId;
    if (inviterUserId) {
      const inviter = await User.findById(inviterUserId).select(
        "firstName lastName email",
      );
      if (inviter) {
        inviterName =
          `${inviter.firstName || ""} ${inviter.lastName || ""}`.trim() ||
          inviter.email ||
          inviterName;
      }
    }

    // Resolve organization name from organization_id (fallback to id if model not available)
    let organizationName = String(user.organization_id);
    try {
      const { Organization } = await import("../modals/organizationModal.js");
      if (Organization) {
        const org = await Organization.findById(user.organization_id).select(
          "name",
        );
        if (org?.name) organizationName = org.name;
      }
    } catch {
      // Fallback already set to organization_id string
    }

    // Roles
    const roles = Array.isArray(user.role)
      ? user.role
      : user.role
        ? [user.role]
        : [];

    // Recipient display name
    const displayName =
      `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
      user.email ||
      "User";

    // Persist invite token/expiry/status and invitedBy
    await User.findByIdAndUpdate(userId, {
      inviteToken: token,
      inviteTokenExpiry: expires,
      status: nextStatus,
      invitedBy: inviterIdToSave || user.invitedBy || null,
      invitedAt: new Date(),
    });

    // 📜 Log Audit Entry
    try {
      await auditLogger.logUserInvitation(
        user.email,
        user.role?.[0] || "User",
        req.user,
        req,
      );
    } catch (auditError) {
      console.error(
        "⚠️ [AUDIT] Error logging user invitation:",
        auditError.message,
      );
    }

    // Send invite email with extended parameters
    console.log(`📧 [INVITE] Attempting to send email to ${user.email}`);

    let emailResult = { success: false, reason: "Unknown failure" };
    try {
      const result = await emailService.sendInvitationEmail(
        user.email,
        token, // inviteToken
        organizationName, // organizationName
        roles, // roles
        inviterName, // invitedByName
        displayName, // name
      );

      if (result.success) {
        emailResult = { success: true };
      } else {
        // Use the specific error from emailService
        emailResult = {
          success: false,
          reason: result.error || "Email delivery failed",
        };
      }
    } catch (e) {
      console.error("📧 [INVITE] Exception during email send:", e);
      emailResult = {
        success: false,
        reason: "Email service error: " + e.message,
      };
    }

    // Return success even if email fails (user is still marked as invited)
    if (!emailResult.success) {
      console.warn(`📧 [INVITE] ${emailResult.reason} for user ${user.email}`);
      return res.status(200).json({
        status: 200,
        message: `User invitation created successfully (${emailResult.reason})`,
        emailSent: false,
        debug: {
          isConfigured: emailService.isConfigured,
          reason: emailResult.reason,
        },
      });
    }

    return res.status(200).json({
      status: 200,
      message: "Invitation sent successfully",
      emailSent: true,
    });
  } catch (err) {
    console.error("Send invite error:", err);
    return res.status(500).json({
      status: 500,
      message: "Failed to send invitation",
      error: err.message,
    });
  }
};

/**
 * Search users for task assignment
 * Returns users that can be assigned to tasks with search functionality
 * Accessible by authenticated org users
 *
 * Assignment Rules (based on Document 4.3 & 4.7):
 * - Org Admin: Can assign to anyone (Employee, Manager, Admin)
 * - Manager: Can assign to Employees in reporting hierarchy
 * - Manager → Manager: Only if ACL allows cross-department collaboration
 * - Manager → Org Admin: Blocked (requires Admin override)
 * - Employee: Can assign to self and peers (if allowed)
 */
export const searchAssignableUsers = async (req, res) => {
  try {
    const { search = "", limit = 10, activeRole } = req.query;
    const currentUser = req.user;

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - user not authenticated",
      });
    }

    console.log("🔍 Search Assignable Users - Current User:", {
      id: currentUser.id,
      role: currentUser.role,
      activeRole: activeRole,
      organizationId: currentUser.organizationId,
    });

    // Build base query
    let query = {
      status: "active",
      _id: { $ne: currentUser.id }, // Exclude current user initially (we'll add them back as "Self")
    };

    // For org users, only search within their organization
    if (currentUser.organizationId) {
      query.organization_id = currentUser.organizationId;
    }

    // Add search filter if provided
    if (search && search.trim()) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { department: { $regex: search, $options: "i" } },
        { designation: { $regex: search, $options: "i" } },
      ];
    }

    // Fetch users
    const users = await User.find(query)
      .select(
        "firstName lastName email department designation role reportingManager",
      )
      .limit(parseInt(limit) * 2)
      .lean();

    console.log("📋 users details fetched before filtering:", users);

    // Get hierarchy relationships where current user is manager
    const { OrganizationHierarchy } = await import("../models.js");
    console.log("📊 Current User OrganizationId:", currentUser.organizationId);
    const hierarchyRelations = await OrganizationHierarchy.find({
      organization_id: currentUser.organizationId,
      status: "active",
    })
      .select("manager reporty organization_id")
      .lean();

    console.log("📊 Hierarchy Relations:", hierarchyRelations);

    // Build a map: managerId -> Set of employeeIds who report to them
    const managerToEmployees = new Map();
    hierarchyRelations.forEach((rel) => {
      const managerId = String(rel.manager);
      const reportyId = String(rel.reporty);
      if (!managerToEmployees.has(managerId)) {
        managerToEmployees.set(managerId, new Set());
      }
      managerToEmployees.get(managerId).add(reportyId);
    });

    const currentUserId = String(currentUser.id);
    console.log(
      "📊 Manager to Employees Map:",
      JSON.stringify(
        Array.from(managerToEmployees.entries()).map(([k, v]) => ({
          manager: k,
          employees: Array.from(v),
        })),
      ),
    );
    console.log("📊 Current User ID (string):", currentUserId);

    // Get current user's roles (could be array)
    const userRoles = Array.isArray(currentUser.role)
      ? currentUser.role
      : [currentUser.role];

    // Determine the effective role to apply restrictions
    // Priority: activeRole from query > highest role from user's roles
    let effectiveRole =
      activeRole && userRoles.includes(activeRole)
        ? activeRole
        : getHighestRole(userRoles);

    console.log("👤 Current User Roles Analysis:", {
      allRoles: userRoles,
      activeRoleFromQuery: activeRole,
      effectiveRole: effectiveRole,
      roleSource:
        activeRole && userRoles.includes(activeRole)
          ? "Active Role (from RoleSwitcher)"
          : "Highest Role (auto-detected)",
    });

    // Check effective role type for filtering
    const isOrgAdminRole =
      effectiveRole === "org_admin" ||
      effectiveRole === "admin" ||
      effectiveRole === "super_admin";
    const isManagerRole = effectiveRole === "manager";
    const isEmployeeRole =
      effectiveRole === "employee" || effectiveRole === "individual";

    console.log("🎯 Effective Role Type:", {
      isOrgAdminRole,
      isManagerRole,
      isEmployeeRole,
    });

    // Filter users based on assignment rules
    let filteredUsers = users;

    // ROLE-BASED FILTERING based on EFFECTIVE ROLE (Active Role from RoleSwitcher)
    // This respects the currently active role selected by the user

    if (isOrgAdminRole) {
      // ORG ADMIN / ADMIN / SUPERADMIN RULES:
      // Can assign to anyone - no restrictions
      console.log("✅ Acting as Org Admin - No assignment restrictions");
      filteredUsers = users;
    } else if (isManagerRole) {
      // MANAGER RULES:
      // 1. Can assign to employees in their reporting hierarchy (from OrganizationHierarchy)
      // 2. Can assign to managers that this manager reports to (their own manager)
      // 3. CANNOT assign to org_admin or admin (blocked by default)

      console.log("🔍 Acting as Manager - Applying assignment restrictions...");

      const currentUserId = String(currentUser.id);
      const employeesUnderManager =
        managerToEmployees.get(currentUserId) || new Set();

      // Get the manager(s) this current manager reports to
      const myManagers = new Set();
      hierarchyRelations.forEach((rel) => {
        const reportyId = String(rel.reporty);
        if (reportyId === currentUserId) {
          myManagers.add(String(rel.manager));
        }
      });

      console.log(
        `📊 Employees under current manager (${currentUserId}):`,
        Array.from(employeesUnderManager),
      );
      console.log(
        `📊 Managers of current manager (${currentUserId}):`,
        Array.from(myManagers),
      );

      filteredUsers = users.filter((user) => {
        const userId = String(user._id);
        const targetRoles = Array.isArray(user.role) ? user.role : [user.role];
        const targetHasOrgAdmin =
          targetRoles.includes("org_admin") ||
          targetRoles.includes("admin") ||
          targetRoles.includes("super_admin");

        console.log(`   Checking user: ${user.email}`, {
          userId: userId,
          roles: targetRoles,
          isInEmployees: employeesUnderManager.has(userId),
          isMyManager: myManagers.has(userId),
        });

        // Block assignment to users with org_admin/admin role
        if (targetHasOrgAdmin) {
          console.log(
            `   ❌ Manager cannot assign to: ${user.email} (has Org Admin role)`,
          );
          return false;
        }

        // Allow employees who report to this manager
        if (employeesUnderManager.has(userId)) {
          console.log(
            `   ✅ Manager can assign to: ${user.email} (reports to this manager)`,
          );
          return true;
        }

        // Allow managers that this manager reports to
        if (myManagers.has(userId)) {
          console.log(
            `   ✅ Manager can assign to: ${user.email} (this user's manager)`,
          );
          return true;
        }

        console.log(
          `   ❌ Manager cannot assign to: ${user.email} (not in hierarchy)`,
        );
        return false;
      });
    } else if (isEmployeeRole) {
      // Check if current user's effective role is specifically 'individual'
      const isIndividualRole = effectiveRole === "individual";

      if (isIndividualRole) {
        // INDIVIDUAL RULES: Can only assign to self
        console.log("🔍 Acting as Individual - Can ONLY assign to self");
        filteredUsers = []; // No other users can be assigned to
      } else {
        // EMPLOYEE RULES: Can only assign to self and peer employees in same reporting hierarchy
        console.log(
          "🔍 Acting as Employee - Applying assignment restrictions...",
        );

        // Get employees who share the same manager (based on hierarchy)
        const currentUserId = currentUser.id;
        const employeesUnderSameManager = new Set();

        // Find all hierarchy entries where current user is the reporty (employee under a manager)
        hierarchyRelations.forEach((rel) => {
          const reportyId = rel.reporty.toString();
          const managerId = rel.manager.toString();
          if (reportyId === currentUserId) {
            // This user reports to a manager, find all employees under same manager
            const managerEmployees = managerToEmployees.get(managerId);
            if (managerEmployees) {
              managerEmployees.forEach((empId) =>
                employeesUnderSameManager.add(empId),
              );
            }
          }
        });

        console.log(
          `📊 Employees under same manager as current user:`,
          Array.from(employeesUnderSameManager),
        );

        filteredUsers = users.filter((user) => {
          const userId = user._id.toString();
          const targetRoles = Array.isArray(user.role)
            ? user.role
            : [user.role];
          const targetHasEmployee =
            targetRoles.includes("employee") ||
            targetRoles.includes("individual");
          const targetHasManagerOrAbove =
            targetRoles.includes("manager") ||
            targetRoles.includes("org_admin") ||
            targetRoles.includes("admin") ||
            targetRoles.includes("super_admin");

          // Only allow pure employees/individuals (no manager or admin roles)
          if (targetHasEmployee && !targetHasManagerOrAbove) {
            // Check if this employee shares the same manager
            const sharesSameManager = employeesUnderSameManager.has(userId);
            if (sharesSameManager) {
              console.log(
                `   ✅ Employee can assign to: ${user.email} (Peer employee - same manager)`,
              );
              return true;
            } else {
              console.log(
                `   ❌ Employee cannot assign to: ${user.email} (Different manager hierarchy)`,
              );
              return false;
            }
          }

          console.log(
            `   ❌ Employee cannot assign to: ${user.email} (Has manager/admin role)`,
          );
          return false;
        });
      }
    }

    console.log("✅ Filtered users count:", filteredUsers.length);

    // Limit results
    filteredUsers = filteredUsers.slice(0, parseInt(limit));

    // Format users for react-select
    const formattedUsers = filteredUsers.map((user) => ({
      value: user._id.toString(),
      label:
        `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
      email: user.email,
      department: user.department,
      designation: user.designation,
      role: user.role,
    }));

    // Add "Self" option at the beginning
    const selfOption = {
      value: currentUser.id,
      label: "Self",
      email: currentUser.email,
      isSelf: true,
    };

    const allOptions = [selfOption, ...formattedUsers];

    return res.status(200).json({
      success: true,
      data: allOptions,
      total: allOptions.length,
      message: `Found ${allOptions.length} assignable users`,
    });
  } catch (err) {
    console.error("❌ Search assignable users error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to search users",
      error: err.message,
    });
  }
};

/**
 * Helper function to get the highest role from an array of roles
 * Role hierarchy: super_admin > org_admin > admin > manager > employee > individual
 */
function getHighestRole(roles) {
  const roleHierarchy = {
    super_admin: 6,
    org_admin: 5,
    admin: 4,
    manager: 3,
    employee: 2,
    individual: 1,
  };

  if (!Array.isArray(roles)) {
    roles = [roles];
  }

  let highestRole = "individual";
  let highestLevel = 0;

  roles.forEach((role) => {
    const level = roleHierarchy[role] || 0;
    if (level > highestLevel) {
      highestLevel = level;
      highestRole = role;
    }
  });

  return highestRole;
}
//  * Bulk Upload Users
//  * POST /api/organization/users/bulk-upload
//  */
export const bulkUploadUsers = async (req, res) => {
  try {
    console.log("📤 Bulk upload request received");

    // Check if file is uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded. Please upload a CSV or Excel file.",
      });
    }

    const file = req.file;
    const organizationId = req.user.organizationId;

    console.log("📄 File received:", file.originalname, file.mimetype);

    // Parse CSV/Excel file
    let users = [];

    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      // Parse CSV
      const csvText = file.buffer.toString("utf-8");
      const lines = csvText.split("\n").filter((line) => line.trim());

      if (lines.length < 2) {
        return res.status(400).json({
          success: false,
          message: "CSV file is empty or invalid",
        });
      }

      // Parse header
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

      // Validate required headers
      const requiredHeaders = ["firstname", "lastname", "email"];
      const missingHeaders = requiredHeaders.filter(
        (h) => !headers.includes(h),
      );

      if (missingHeaders.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Missing required columns: ${missingHeaders.join(", ")}`,
        });
      }

      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim());
        const userData = {};

        headers.forEach((header, index) => {
          userData[header] = values[index] || "";
        });

        if (userData.email) {
          users.push(userData);
        }
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "Unsupported file format. Please upload a CSV file.",
      });
    }

    console.log(`📊 Parsed ${users.length} users from file`);

    // Process and insert users
    const results = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    for (const userData of users) {
      try {
        // Validate email
        if (!userData.email || !userData.email.includes("@")) {
          results.failed++;
          results.errors.push(`Invalid email: ${userData.email || "missing"}`);
          continue;
        }

        // Check if user already exists
        const existingUser = await User.findOne({
          email: userData.email.toLowerCase(),
        });

        if (existingUser) {
          results.failed++;
          results.errors.push(`User already exists: ${userData.email}`);
          continue;
        }

        // Generate invite token
        const inviteToken = storage.generatePasswordResetToken();
        const inviteTokenExpiry = new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ); // 7 days

        // Create new user
        const newUser = new User({
          firstName: userData.firstname || "",
          lastName: userData.lastname || "",
          email: userData.email.toLowerCase(),
          organization_id: organizationId,
          role: userData.role ? [userData.role.toLowerCase()] : ["employee"],
          department: userData.department || "",
          designation: userData.designation || "",
          licenseId: userData.licenseid || "Plan",
          status: "invited",
          inviteToken,
          inviteTokenExpiry,
          invitedBy: req.user.id || req.user._id,
          invitedAt: new Date(),
          password: Math.random().toString(36).slice(-10), // Temporary password
        });

        await newUser.save();
        results.successful++;

        // Send invitation email with correct parameters
        try {
          // Get organization info if possible
          let organizationName = "Your Organization";
          try {
            const { Organization } =
              await import("../modals/organizationModal.js");
            const org =
              await Organization.findById(organizationId).select("name");
            if (org?.name) organizationName = org.name;
          } catch (e) {}

          const inviterName = req.user.email || "Admin";
          const displayName =
            `${newUser.firstName} ${newUser.lastName}`.trim() || newUser.email;

          const emailResult = await emailService.sendInvitationEmail(
            newUser.email,
            inviteToken,
            organizationName,
            newUser.role,
            inviterName,
            displayName,
          );

          if (!emailResult.success) {
            console.warn(
              `[Bulk] Email failed for ${newUser.email}: ${emailResult.error}`,
            );
            results.errors.push(
              `${newUser.email}: Invitation email failed but user created. (${emailResult.error})`,
            );
          }
        } catch (emailError) {
          console.error("Failed to send invitation email:", emailError);
          results.errors.push(
            `${newUser.email}: Invitation email error. (${emailError.message})`,
          );
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`${userData.email}: ${error.message}`);
        console.error(`Failed to create user ${userData.email}:`, error);
      }
    }

    console.log(
      `✅ Bulk upload completed: ${results.successful} successful, ${results.failed} failed`,
    );

    return res.status(200).json({
      success: true,
      message: `Bulk upload completed: ${results.successful} users added, ${results.failed} failed`,
      ...results,
    });
  } catch (error) {
    console.error("❌ Bulk upload error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process bulk upload",
      error: error.message,
    });
  }
};

/**
 * Reset User Password
 * PUT /api/organization/users/:userId/reset-password
 */
export const resetUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;
    const adminUser = req.user;

    console.log(`🔑 Password reset request for user: ${userId}`);

    // Validate inputs
    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password is required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    // Find the user
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if admin has permission (same organization)
    if (
      user.organization_id.toString() !== adminUser.organizationId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to reset this user's password",
      });
    }

    // Prevent resetting primary admin password unless it's self-reset
    if (
      user.isPrimaryAdmin &&
      user._id.toString() !== adminUser.id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Cannot reset primary admin password",
      });
    }

    // Hash the password (assuming User model has pre-save hook for hashing)
    user.password = newPassword;
    user.passwordResetRequired = true; // Flag to force password change on next login
    await user.save();

    console.log(`✅ Password reset successful for ${user.email}`);

    // Send email notification
    try {
      await emailService.sendPasswordResetNotification({
        to: user.email,
        userName: `${user.firstName} ${user.lastName}`,
        resetBy: `${adminUser.firstName} ${adminUser.lastName}`,
      });
    } catch (emailError) {
      console.error("Failed to send password reset email:", emailError);
    }

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. User has been notified via email.",
    });
  } catch (error) {
    console.error("❌ Password reset error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reset password",
      error: error.message,
    });
  }
};

/**
 * Simple user search for form sharing
 * GET /api/users/search?email=xxx
 */
export const searchUserByEmail = async (req, res) => {
  try {
    const { email } = req.query;
    const currentUser = req.user;

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email parameter is required",
      });
    }

    // Search for user by exact email match
    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      status: "active",
    }).select("firstName lastName email organization_id role");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Optional: Check if user is in same organization (for better security)
    if (currentUser.organizationId && user.organization_id) {
      if (
        currentUser.organizationId.toString() !==
        user.organization_id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Cannot share with users outside your organization",
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        user_id: user._id,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("❌ Error searching user:", error);
    res.status(500).json({
      success: false,
      message: "Error searching for user",
      error: error.message,
    });
  }
};

/**
 * Generates and sends a 5-digit WhatsApp OTP verification code.
 */
export const sendWhatsAppOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    const userId = req.user.id;

    if (!phone) {
      return res.status(400).json({ success: false, error: "Phone number is required" });
    }

    // Generate 5-digit random OTP
    const otp = Math.floor(10000 + Math.random() * 90000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update user in database and get updated record
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        phone: phone.trim(),
        phoneVerificationOtp: otp,
        phoneVerificationOtpExpires: expiry,
        phoneVerified: false,
      },
      { new: true }
    );

    const userName = updatedUser?.firstName || "User";

    const { sendWhatsApp } = await import("../services/whatsappService.js");

    // Send using utility verification template
    await sendWhatsApp(
      phone,
      "verifyphone",
      "en_US",
      [
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: otp,
            },
            {
              type: "text",
              text: "TS Verification",
            },
          ],
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [
            {
              type: "text",
              text: otp,
            },
          ],
        },
      ]
    );

    res.json({ success: true, message: "Verification OTP sent successfully via WhatsApp" });
  } catch (error) {
    console.error("Send WhatsApp OTP error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Verifies a 5-digit WhatsApp OTP verification code.
 */
export const verifyWhatsAppOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const userId = req.user.id;

    if (!otp) {
      return res.status(400).json({ success: false, error: "OTP is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    if (!user.phoneVerificationOtp || user.phoneVerificationOtp !== otp.trim()) {
      return res.status(400).json({ success: false, error: "You entered a wrong OTP. Please try again." });
    }

    if (new Date() > user.phoneVerificationOtpExpires) {
      return res.status(400).json({ success: false, error: "OTP has expired. Please request a new one." });
    }

    user.phoneVerified = true;
    user.phoneVerificationOtp = null;
    user.phoneVerificationOtpExpires = null;
    await user.save();

    res.json({ success: true, message: "Phone number verified successfully!" });
  } catch (error) {
    console.error("Verify WhatsApp OTP error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

