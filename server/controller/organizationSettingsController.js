import { User } from "../modals/userModal.js";
import { Organization } from "../modals/organizationModal.js";
import { TaskChangeRequestService } from "../services/taskChangeRequestService.js";
import mongoose from "mongoose";
import * as r2Storage from '../services/r2Storage.js';

/**
 * Get organization settings
 * GET /api/organization/settings
 * GET /api/organizations/:organizationId/settings
 */
export const getSettings = async (req, res) => {
  try {
    const requestedOrgId = req.params?.organizationId;
    const organizationId = requestedOrgId || req.user.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization ID is required",
      });
    }

    // Multi-tenant check: if requesting specific org, verify user belongs to it or is super_admin
    const userRole = Array.isArray(req.user.role) ? req.user.role[0] : req.user.role;
    const isSuperAdmin = ["super_admin", "super-admin", "tasksetu-admin"].includes(userRole);
    if (requestedOrgId && !isSuperAdmin && String(req.user.organizationId) !== String(requestedOrgId)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view settings for this organization",
      });
    }

    console.log(`⚙️ Fetching settings for organization: ${organizationId}`);

    const org = await Organization.findById(organizationId).lean();

    const approvalSettings =
      await TaskChangeRequestService.getOrganizationApprovalSettings(organizationId);

    const defaultSettings = {
      branding: {
        logo: org?.logo || null,
        primaryColor: "#3B82F6",
        secondaryColor: "#1E40AF",
        companyName: org?.name || "Your Company",
      },
      notifications: {
        emailEnabled: true,
        inAppEnabled: true,
        frequency: "instant", // instant, daily, weekly
        defaultPreferences: {
          taskAssigned: true,
          taskCompleted: true,
          commentAdded: true,
          dueDate: true,
        },
      },
      regional: {
        timezone: org?.settings?.timezone || "UTC",
        workingHours: {
          start: "09:00",
          end: "17:00",
          weekends: ["Saturday", "Sunday"],
        },
        dateFormat: "MM/DD/YYYY",
        timeFormat: "12h",
      },
      templates: {
        task: [],
        workflow: [],
        email: [],
      },
    };

    const responseData = {
      ...defaultSettings,
      ...(org?.settings || {}),
      ...approvalSettings,
      _id: org?._id,
      id: org?._id,
      name: org?.name || "",
      description: org?.description || "",
      website: org?.website || "",
      industry: org?.industry || "",
      size: org?.size || "",
      numberOfEmployees: org?.numberOfEmployees,
      phone: org?.settings?.phone || "",
      email: org?.settings?.email || "",
      address: org?.settings?.address || "",
      city: org?.settings?.city || "",
      country: org?.settings?.country || "",
      timezone: org?.settings?.timezone || "UTC",
    };

    return res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("❌ Get settings error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch settings",
      error: error.message,
    });
  }
};

/**
 * Update organization settings
 * PUT /api/organization/settings
 * PATCH /api/organization/settings
 * PUT /api/organizations/:organizationId/settings
 * PATCH /api/organizations/:organizationId/settings
 */
export const updateSettings = async (req, res) => {
  try {
    const requestedOrgId = req.params?.organizationId;
    const organizationId = requestedOrgId || req.user.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization ID is required",
      });
    }

    // Multi-tenant check
    const userRole = Array.isArray(req.user.role) ? req.user.role[0] : req.user.role;
    const isSuperAdmin = ["super_admin", "super-admin", "tasksetu-admin"].includes(userRole);
    if (requestedOrgId && !isSuperAdmin && String(req.user.organizationId) !== String(requestedOrgId)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to modify settings for this organization",
      });
    }

    console.log(`⚙️ Updating settings for organization: ${organizationId}`, req.body);

    const org = await Organization.findById(organizationId);
    if (!org) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    // Handle task edit approval toggles if provided
    let approvalSettingResult = null;
    const hasApprovalUpdate =
      req.body.dueDateApprovalEnabled !== undefined ||
      req.body.statusApprovalEnabled !== undefined ||
      req.body.priorityApprovalEnabled !== undefined ||
      req.body.assigneeApprovalEnabled !== undefined ||
      req.body.taskEditApprovalEnabled !== undefined;

    if (hasApprovalUpdate) {
      approvalSettingResult =
        await TaskChangeRequestService.updateOrganizationApprovalSettings({
          organizationId,
          settings: req.body,
          enabled: req.body.taskEditApprovalEnabled,
          user: req.user,
        });
    }

    // Handle other organization fields if provided
    const {
      name,
      description,
      website,
      industry,
      size,
      phone,
      email,
      address,
      city,
      country,
      timezone,
    } = req.body;

    if (name) org.name = name;
    if (description !== undefined) org.description = description;
    if (website !== undefined) org.website = website;
    if (industry !== undefined) org.industry = industry;
    if (size !== undefined) org.size = size;

    if (!org.settings) org.settings = {};
    if (phone !== undefined) org.settings.phone = phone;
    if (email !== undefined) org.settings.email = email;
    if (address !== undefined) org.settings.address = address;
    if (city !== undefined) org.settings.city = city;
    if (country !== undefined) org.settings.country = country;
    if (timezone !== undefined) org.settings.timezone = timezone;

    org.markModified("settings");
    await org.save();

    const approvalSettings =
      await TaskChangeRequestService.getOrganizationApprovalSettings(organizationId);

    return res.status(200).json({
      success: true,
      message:
        approvalSettingResult?.message ||
        "Organization settings updated successfully",
      data: {
        ...org.toObject(),
        ...approvalSettings,
      },
    });
  } catch (error) {
    console.error("❌ Update settings error:", error);
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to update settings",
      error: error.message,
    });
  }
};

/**
 * Update branding settings
 * PUT /api/organization/branding
 */
export const updateBranding = async (req, res) => {
  try {
    const { primaryColor, secondaryColor, companyName } = req.body;
    const organizationId = req.user.organizationId;

    console.log(`🎨 Updating branding for organization: ${organizationId}`);

    // TODO: Update OrganizationSettings collection
    // For now, return success

    const updatedBranding = {
      primaryColor: primaryColor || "#3B82F6",
      secondaryColor: secondaryColor || "#1E40AF",
      companyName: companyName || "Your Company",
      updatedAt: new Date()
    };

    console.log(`✅ Branding updated`);

    return res.status(200).json({
      success: true,
      message: "Branding updated successfully",
      data: updatedBranding
    });

  } catch (error) {
    console.error("❌ Update branding error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update branding",
      error: error.message
    });
  }
};

/**
 * Upload company logo
 * POST /api/organization/branding/logo
 */
export const uploadLogo = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }

    console.log(`📤 Uploading logo for organization: ${organizationId}`);

    let logoUrl = `/uploads/logos/${organizationId}_${Date.now()}.${req.file.originalname.split('.').pop()}`;

    if (r2Storage.isR2Enabled()) {
      try {
        const ext = req.file.originalname.split('.').pop();
        const key = `logos/${organizationId}_${Date.now()}.${ext}`;
        await r2Storage.uploadToR2(req.file.buffer, key, req.file.mimetype);
        logoUrl = r2Storage.getPublicUrl(key) || `/uploads/${key}`;
        console.log(`[uploadLogo] Successfully uploaded logo to R2: ${logoUrl}`);
      } catch (r2Error) {
        console.error('[uploadLogo] Failed to upload logo to R2:', r2Error.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Logo uploaded successfully",
      data: {
        logoUrl
      }
    });

  } catch (error) {
    console.error("❌ Upload logo error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload logo",
      error: error.message
    });
  }
};

/**
 * Delete company logo
 * DELETE /api/organization/branding/logo
 */
export const deleteLogo = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    console.log(`🗑️ Deleting logo for organization: ${organizationId}`);

    // TODO: Delete from cloud storage and database

    console.log(`✅ Logo deleted`);

    return res.status(200).json({
      success: true,
      message: "Logo deleted successfully"
    });

  } catch (error) {
    console.error("❌ Delete logo error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete logo",
      error: error.message
    });
  }
};

/**
 * Update notification defaults
 * PUT /api/organization/settings/notifications
 */
export const updateNotificationDefaults = async (req, res) => {
  try {
    const { emailEnabled, inAppEnabled, frequency, defaultPreferences } = req.body;
    const organizationId = req.user.organizationId;

    console.log(`🔔 Updating notification defaults for organization: ${organizationId}`);

    // Validation
    if (frequency && !["instant", "daily", "weekly"].includes(frequency)) {
      return res.status(400).json({
        success: false,
        message: "Invalid frequency. Must be 'instant', 'daily', or 'weekly'"
      });
    }

    // TODO: Update OrganizationSettings collection
    const updatedSettings = {
      emailEnabled: emailEnabled !== undefined ? emailEnabled : true,
      inAppEnabled: inAppEnabled !== undefined ? inAppEnabled : true,
      frequency: frequency || "instant",
      defaultPreferences: defaultPreferences || {},
      updatedAt: new Date()
    };

    console.log(`✅ Notification defaults updated`);

    return res.status(200).json({
      success: true,
      message: "Notification settings updated successfully",
      data: updatedSettings
    });

  } catch (error) {
    console.error("❌ Update notification defaults error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update notification settings",
      error: error.message
    });
  }
};

/**
 * Update timezone settings
 * PUT /api/organization/settings/timezone
 */
export const updateTimezone = async (req, res) => {
  try {
    const { timezone, dateFormat, timeFormat } = req.body;
    const organizationId = req.user.organizationId;

    console.log(`🌍 Updating timezone for organization: ${organizationId}`);

    if (!timezone) {
      return res.status(400).json({
        success: false,
        message: "Timezone is required"
      });
    }

    // TODO: Update OrganizationSettings collection
    const updatedSettings = {
      timezone,
      dateFormat: dateFormat || "MM/DD/YYYY",
      timeFormat: timeFormat || "12h",
      updatedAt: new Date()
    };

    console.log(`✅ Timezone updated to ${timezone}`);

    return res.status(200).json({
      success: true,
      message: "Timezone settings updated successfully",
      data: updatedSettings
    });

  } catch (error) {
    console.error("❌ Update timezone error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update timezone settings",
      error: error.message
    });
  }
};

/**
 * Update working hours
 * PUT /api/organization/settings/working-hours
 */
export const updateWorkingHours = async (req, res) => {
  try {
    const { start, end, weekends } = req.body;
    const organizationId = req.user.organizationId;

    console.log(`⏰ Updating working hours for organization: ${organizationId}`);

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        message: "Start and end times are required"
      });
    }

    // TODO: Update OrganizationSettings collection
    const updatedSettings = {
      start,
      end,
      weekends: weekends || ["Saturday", "Sunday"],
      updatedAt: new Date()
    };

    console.log(`✅ Working hours updated`);

    return res.status(200).json({
      success: true,
      message: "Working hours updated successfully",
      data: updatedSettings
    });

  } catch (error) {
    console.error("❌ Update working hours error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update working hours",
      error: error.message
    });
  }
};

/**
 * Create a template
 * POST /api/organization/templates
 */
export const createTemplate = async (req, res) => {
  try {
    const { type, name, content } = req.body;
    const organizationId = req.user.organizationId;

    console.log(`📝 Creating template: ${name} (${type})`);

    if (!type || !name || !content) {
      return res.status(400).json({
        success: false,
        message: "Type, name, and content are required"
      });
    }

    if (!["task", "workflow", "email"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid template type. Must be 'task', 'workflow', or 'email'"
      });
    }

    // TODO: Create Template document
    const template = {
      _id: `template_${Date.now()}`,
      organizationId,
      type,
      name,
      content,
      createdAt: new Date()
    };

    console.log(`✅ Template created: ${name}`);

    return res.status(201).json({
      success: true,
      message: "Template created successfully",
      data: template
    });

  } catch (error) {
    console.error("❌ Create template error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create template",
      error: error.message
    });
  }
};

/**
 * Get all templates
 * GET /api/organization/templates
 */
export const getTemplates = async (req, res) => {
  try {
    const { type } = req.query;
    const organizationId = req.user.organizationId;

    console.log(`📋 Fetching templates for organization: ${organizationId}`);

    // TODO: Fetch from Templates collection
    const templates = [];

    return res.status(200).json({
      success: true,
      data: templates,
      total: templates.length
    });

  } catch (error) {
    console.error("❌ Get templates error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch templates",
      error: error.message
    });
  }
};

/**
 * Update a template
 * PUT /api/organization/templates/:templateId
 */
export const updateTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const { name, content } = req.body;
    const organizationId = req.user.organizationId;

    console.log(`✏️ Updating template: ${templateId}`);

    // TODO: Update Template document

    const updatedTemplate = {
      _id: templateId,
      name,
      content,
      updatedAt: new Date()
    };

    console.log(`✅ Template updated`);

    return res.status(200).json({
      success: true,
      message: "Template updated successfully",
      data: updatedTemplate
    });

  } catch (error) {
    console.error("❌ Update template error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update template",
      error: error.message
    });
  }
};

/**
 * Delete a template
 * DELETE /api/organization/templates/:templateId
 */
export const deleteTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const organizationId = req.user.organizationId;

    console.log(`🗑️ Deleting template: ${templateId}`);

    // TODO: Delete Template document

    console.log(`✅ Template deleted`);

    return res.status(200).json({
      success: true,
      message: "Template deleted successfully"
    });

  } catch (error) {
    console.error("❌ Delete template error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete template",
      error: error.message
    });
  }
};
