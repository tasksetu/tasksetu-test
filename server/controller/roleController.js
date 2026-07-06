import { User } from "../modals/userModal.js";
import mongoose from "mongoose";

// Define a CustomRole schema if it doesn't exist
// For now, we'll use a simple structure stored in the organization settings
// In production, you'd want a separate CustomRole collection

/**
 * Get all roles for an organization
 * GET /api/organization/roles
 */
export const getRoles = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    console.log(`📋 Fetching roles for organization: ${organizationId}`);

    // Default system roles
    const defaultRoles = [
      {
        _id: "org_admin",
        name: "Organization Admin",
        description: "Full access to all organization features and settings",
        permissions: [
          "users.view", "users.create", "users.edit", "users.delete", "users.manage_roles",
          "tasks.view", "tasks.create", "tasks.edit", "tasks.delete", "tasks.assign",
          "projects.view", "projects.create", "projects.edit", "projects.delete",
          "reports.view", "reports.export", "reports.create_custom",
          "settings.view", "settings.edit", "settings.manage_branding"
        ],
        isSystem: true,
        userCount: 0
      },
      {
        _id: "manager",
        name: "Manager",
        description: "Can manage team members and oversee projects",
        permissions: [
          "users.view",
          "tasks.view", "tasks.create", "tasks.edit", "tasks.assign",
          "projects.view", "projects.create", "projects.edit",
          "reports.view", "reports.export"
        ],
        isSystem: true,
        userCount: 0
      },
      {
        _id: "employee",
        name: "Employee",
        description: "Standard user with task execution capabilities",
        permissions: [
          "tasks.view", "tasks.create", "tasks.edit",
          "projects.view",
          "reports.view"
        ],
        isSystem: true,
        userCount: 0
      }
    ];

    // Get user counts for each role
    for (const role of defaultRoles) {
      const count = await User.countDocuments({
        organization_id: organizationId,
        role: role._id
      });
      role.userCount = count;
    }

    // TODO: Fetch custom roles from database when CustomRole collection is implemented
    // const customRoles = await CustomRole.find({ organizationId });

    return res.status(200).json({
      success: true,
      data: defaultRoles,
      total: defaultRoles.length
    });

  } catch (error) {
    console.error("❌ Get roles error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch roles",
      error: error.message
    });
  }
};

/**
 * Create a custom role
 * POST /api/organization/roles
 */
export const createRole = async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    const organizationId = req.user.organizationId;

    console.log(`➕ Creating custom role: ${name}`);

    // Validation
    if (!name || !permissions || !Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        message: "Role name and permissions array are required"
      });
    }

    // Check if role name already exists
    const existingRole = await User.findOne({
      organization_id: organizationId,
      "customRoles.name": name
    });

    if (existingRole) {
      return res.status(400).json({
        success: false,
        message: "A role with this name already exists"
      });
    }

    // TODO: In production, create a CustomRole document
    // For now, we'll return a success response
    // const customRole = new CustomRole({
    //   organizationId,
    //   name,
    //   description,
    //   permissions
    // });
    // await customRole.save();

    const newRole = {
      _id: `custom_${Date.now()}`,
      name,
      description: description || "",
      permissions,
      isSystem: false,
      userCount: 0,
      createdAt: new Date()
    };

    console.log(`✅ Custom role created: ${name}`);

    return res.status(201).json({
      success: true,
      message: "Custom role created successfully",
      data: newRole
    });

  } catch (error) {
    console.error("❌ Create role error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create role",
      error: error.message
    });
  }
};

/**
 * Update a custom role
 * PUT /api/organization/roles/:roleId
 */
export const updateRole = async (req, res) => {
  try {
    const { roleId } = req.params;
    const { name, description, permissions } = req.body;
    const organizationId = req.user.organizationId;

    console.log(`✏️ Updating role: ${roleId}`);

    // Prevent updating system roles
    if (["org_admin", "manager", "employee"].includes(roleId)) {
      return res.status(403).json({
        success: false,
        message: "Cannot modify system roles"
      });
    }

    // Validation
    if (!name || !permissions || !Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        message: "Role name and permissions array are required"
      });
    }

    // TODO: In production, update CustomRole document
    // const role = await CustomRole.findOneAndUpdate(
    //   { _id: roleId, organizationId },
    //   { name, description, permissions },
    //   { new: true }
    // );

    const updatedRole = {
      _id: roleId,
      name,
      description,
      permissions,
      isSystem: false,
      updatedAt: new Date()
    };

    console.log(`✅ Role updated: ${name}`);

    return res.status(200).json({
      success: true,
      message: "Role updated successfully",
      data: updatedRole
    });

  } catch (error) {
    console.error("❌ Update role error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update role",
      error: error.message
    });
  }
};

/**
 * Delete a custom role
 * DELETE /api/organization/roles/:roleId
 */
export const deleteRole = async (req, res) => {
  try {
    const { roleId } = req.params;
    const organizationId = req.user.organizationId;

    console.log(`🗑️ Deleting role: ${roleId}`);

    // Prevent deleting system roles
    if (["org_admin", "manager", "employee"].includes(roleId)) {
      return res.status(403).json({
        success: false,
        message: "Cannot delete system roles"
      });
    }

    // Check if any users are assigned this role
    const usersWithRole = await User.countDocuments({
      organization_id: organizationId,
      role: roleId
    });

    if (usersWithRole > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete role. ${usersWithRole} user(s) are currently assigned this role.`
      });
    }

    // TODO: In production, delete CustomRole document
    // await CustomRole.findOneAndDelete({ _id: roleId, organizationId });

    console.log(`✅ Role deleted: ${roleId}`);

    return res.status(200).json({
      success: true,
      message: "Role deleted successfully"
    });

  } catch (error) {
    console.error("❌ Delete role error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete role",
      error: error.message
    });
  }
};

/**
 * Assign role to user
 * PUT /api/organization/users/:userId/roles
 */
export const assignRoleToUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { roles } = req.body; // Array of role IDs
    const organizationId = req.user.organizationId;

    console.log(`👤 Assigning roles to user: ${userId}`);

    if (!roles || !Array.isArray(roles) || roles.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Roles array is required"
      });
    }

    // Find the user
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Verify user belongs to the same organization
    if (user.organization_id.toString() !== organizationId.toString()) {
      return res.status(403).json({
        success: false,
        message: "User does not belong to your organization"
      });
    }

    // Prevent modifying primary admin role unless self-modify
    if (user.isPrimaryAdmin && user._id.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Cannot modify primary admin roles"
      });
    }

    // Update user roles
    user.role = roles;
    await user.save();

    console.log(`✅ Roles assigned to user: ${user.email}`);

    return res.status(200).json({
      success: true,
      message: "Roles assigned successfully",
      data: {
        userId: user._id,
        email: user.email,
        roles: user.role
      }
    });

  } catch (error) {
    console.error("❌ Assign role error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to assign roles",
      error: error.message
    });
  }
};
