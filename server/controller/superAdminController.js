import { Organization } from "../modals/organizationModal.js";
import { enrichCompany } from "../utils/companyStats.js";
import auditLogger from "../utils/auditLogger.js";

export const superAdminController = {
  async test(req, res) {
    try {
      const { Organization } = await import("../modals/organizationModal.js");
      const { User } = await import("../modals/userModal.js");
      const totalOrgs = (await Organization.countDocuments()) || 0;
      const totalUsers = (await User.countDocuments()) || 0;
      res.json({
        message: "Test endpoint working",
        totalOrgs,
        totalUsers,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.json({ error: error.message, timestamp: new Date().toISOString() });
    }
  },

  async analytics(req, res) {
    try {
      const { storage } = await import("../mongodb-storage.js");
      const stats = await storage.getPlatformAnalytics();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch platform analytics" });
    }
  },

  async companies(req, res) {
    try {
      const companies = await Organization.find().sort({ createdAt: -1 });

      const enrichedCompanies = await Promise.all(
        companies.map((org) => enrichCompany(org))
      );

      res.status(200).json(enrichedCompanies);
    } catch (error) {
      console.error("Companies fetch error:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  },

  async users(req, res) {
    try {
      const { User } = await import("../modals/userModal.js");
      const users = await User.find({})
        .populate("organization_id", "name email status")
        .sort({ createdAt: -1 });

      // Map results to include organizationId with name for frontend compatibility
      const enrichedUsers = users.map(user => {
        const userObj = user.toObject ? user.toObject() : user;
        // Map organization_id to organizationId for frontend compatibility
        if (userObj.organization_id) {
          userObj.organizationId = userObj.organization_id;
        }
        return userObj;
      });

      res.json(enrichedUsers);
    } catch (error) {
      console.error("Users fetch error:", error);
      res.status(500).json({ message: "Failed to fetch users", error: error.message });
    }
  },

  async userById(req, res) {
    try {
      const { User } = await import("../modals/userModal.js");
      const { id } = req.params;

      // Fetch user and populate organization
      const user = await User.findById(id)
        .populate("organization_id", "name email status");

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const userObj = user.toObject ? user.toObject() : user;
      // Map organization_id to organizationId for frontend compatibility
      if (userObj.organization_id) {
        userObj.organizationId = userObj.organization_id;
      }

      // Ensure license_limits and usage_stats are populated from DB or calculated
      // If missing, try to fetch/calculate from related collections
      if (!userObj.license_limits) {
        userObj.license_limits = user.license_limits || {
          max_projects_per_user: 0,
          max_tasks_per_user: 0,
          max_storage_per_user_mb: 0,
          max_collaborators_per_user: 0,
          features_enabled: [],
        };
      }
      if (!userObj.usage_stats) {
        userObj.usage_stats = user.usage_stats || {
          projects_created: 0,
          tasks_created: 0,
          storage_used_mb: 0,
        };
      }

      // Optionally: add aggregation logic here if you want to calculate stats from other collections

      res.status(200).json(userObj);
    } catch (error) {
      console.error("User fetch error:", error);
      res.status(500).json({ message: "Failed to fetch user", error: error.message });
    }
  },

  async createSuperAdmin(req, res) {
    try {
      const { storage } = await import("../mongodb-storage.js");
      const { emailService } = await import("../services/emailService.js");
      const crypto = await import("crypto");

      const { firstName, lastName, email, phone, password } = req.body;

      // Check if super admin already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already exists" });
      }

      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString("hex");
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const superAdmin = await storage.createSuperAdmin({
        firstName,
        lastName,
        email,
        phone,
        password,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      });

      // Send verification email
      await emailService.sendSuperAdminVerificationEmail(
        email,
        verificationToken,
        firstName
      );

      res.json({
        message: "Super admin created successfully. Verification email has been sent.",
        user: {
          id: superAdmin._id,
          email: superAdmin.email,
          firstName: superAdmin.firstName,
          lastName: superAdmin.lastName,
          phone: superAdmin.phone,
          role: superAdmin.role,
          status: superAdmin.status,
        },
      });
    } catch (error) {
      console.error("Error creating super admin:", error);
      res.status(500).json({ message: error.message });
    }
  },

  async logs(req, res) {
    try {
      const { storage } = await import("../mongodb-storage.js");
      const { limit = 100 } = req.query;
      const logs = await storage.getSystemLogs(parseInt(limit));
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch system logs" });
    }
  },

  async assignAdmin(req, res) {
    try {
      const { storage } = await import("../mongodb-storage.js");
      const { companyId, userId } = req.body;
      await storage.assignCompanyAdmin(companyId, userId);

      // Audit log for admin assignment
      const { User } = await import("../modals/userModal.js");
      const targetUser = await User.findById(userId);
      if (targetUser) {
        await auditLogger.logRoleChange(targetUser, 'member', 'admin', req.user, req);
      }

      res.json({ message: "Company admin assigned successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to assign company admin" });
    }
  },

  updateCompanyStatus: async (req, res) => {
    try {
      const { Organization } = await import("../modals/organizationModal.js");

      const { id } = req.params;
      const { status } = req.body;

      if (!["active", "inactive", "pending"].includes(status)) {
        return res.status(400).json({ message: "Invalid status value" });
      }

      const isActive = status === "active";

      const company = await Organization.findByIdAndUpdate(
        id,
        { status, isActive },
        { new: true }
      );

      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Audit log for company status update
      if (status === 'active') {
        await auditLogger.logAction('COMPANY_ACTIVATED', 'ORGANIZATION', company._id, company.name, req.user, req, `Company activated: ${company.name}`);
      } else if (status === 'inactive') {
        await auditLogger.logCompanySuspension(company, 'Suspended by super admin', req.user, req);
      }

      res.json({
        message: "Company status updated successfully",
        company,
      });

    } catch (error) {
      res.status(500).json({
        message: "Failed to update company status",
        error: error.message,
      });
    }
  },

  async companyById(req, res) {
    try {
      const { id } = req.params;

      const company = await Organization.findById(id);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      const enrichedCompany = await enrichCompany(company);

      res.status(200).json(enrichedCompany);
    } catch (error) {
      console.error("Company fetch error:", error);
      res.status(500).json({ message: "Failed to fetch company" });
    }
  },

  // Feature Flags Endpoints
  async getFeatureFlags(req, res) {
    try {
      const { FeatureFlag } = await import("../modals/featureFlagModal.js");
      let flags = await FeatureFlag.find().sort({ name: 1 });

      // If no flags exist, seed with defaults
      if (flags.length === 0) {
        const defaultFlags = [
          { name: "CALENDAR_ENABLED", description: "Enable/disable calendar feature", enabled: true },
          { name: "EMAIL_TO_TASK_ENABLED", description: "Enable email-to-task conversion", enabled: true },
          { name: "EXTERNAL_FORMS_ENABLED", description: "Enable external forms feature", enabled: true },
          { name: "RECURRING_TASKS_ENABLED", description: "Enable recurring tasks", enabled: true },
          { name: "QUICK_TASKS_ENABLED", description: "Enable quick tasks creation", enabled: true },
          { name: "APPROVAL_WORKFLOW_ENABLED", description: "Enable approval workflows", enabled: true },
          { name: "SSO_ENABLED", description: "Enable SSO authentication", enabled: false },
          { name: "API_ENABLED", description: "Enable external API access", enabled: true }
        ];

        await FeatureFlag.insertMany(defaultFlags);
        flags = await FeatureFlag.find().sort({ name: 1 });
      }

      res.json({ data: flags });
    } catch (error) {
      console.error("Feature flags fetch error:", error);
      res.status(500).json({ message: "Failed to fetch feature flags", error: error.message });
    }
  },

  async toggleFeatureFlag(req, res) {
    try {
      const { FeatureFlag } = await import("../modals/featureFlagModal.js");
      const { flagName } = req.params;
      const { enabled } = req.body;

      const flag = await FeatureFlag.findOneAndUpdate(
        { name: flagName },
        {
          enabled,
          updated_at: new Date(),
          updated_by: req.user._id,
          $push: {
            change_log: {
              changed_from: !enabled,
              changed_to: enabled,
              changed_at: new Date(),
              changed_by: req.user.email
            }
          }
        },
        { new: true }
      );

      if (!flag) {
        return res.status(404).json({ message: "Feature flag not found" });
      }

      // 📜 Log Audit Entry
      try {
        await auditLogger.logFeatureFlagToggle(flagName, enabled, req.user, req);
      } catch (auditError) {
        console.error('⚠️ [AUDIT] Error logging feature flag toggle:', auditError.message);
      }

      res.json({ data: flag, message: "Feature flag updated successfully" });
    } catch (error) {
      console.error("Feature flag toggle error:", error);
      res.status(500).json({ message: "Failed to toggle feature flag" });
    }
  },

  // System Configuration Endpoints
  async getSystemConfigs(req, res) {
    try {
      const { SystemConfig } = await import("../modals/systemConfigModal.js");
      let configs = await SystemConfig.find().sort({ key: 1 });

      // If no configs exist, seed with defaults
      if (configs.length === 0) {
        const defaultConfigs = [
          {
            key: 'SMTP_SETTINGS',
            value: {
              host: '',
              port: 587,
              user: '',
              pass: '',
              from: 'noreply@tasksetu.com',
              secure: false
            },
            description: 'Global SMTP settings for system emails'
          },
          {
            key: 'PUSH_NOTIFICATION_SETTINGS',
            value: {
              enabled: true,
              fcm_server_key: '',
              vapid_public_key: '',
              vapid_private_key: ''
            },
            description: 'Configuration for Firebase Push Notifications'
          },
          {
            key: 'OAUTH_GOOGLE_SETTINGS',
            value: {
              enabled: false,
              client_id: '',
              client_secret: '',
              redirect_uri: ''
            },
            description: 'Google OAuth2 configuration for SSO'
          },
          {
            key: 'MAINTENANCE_MODE',
            value: {
              enabled: false,
              message: 'System is under planned maintenance. Please try again later.',
              retry_after: 3600
            },
            description: 'Platform-wide maintenance mode'
          }
        ];

        await SystemConfig.insertMany(defaultConfigs);
        configs = await SystemConfig.find().sort({ key: 1 });
      }

      res.json({ data: configs });
    } catch (error) {
      console.error("System configs fetch error:", error);
      res.status(500).json({ message: "Failed to fetch system configurations" });
    }
  },

  async updateSystemConfig(req, res) {
    try {
      const { SystemConfig } = await import("../modals/systemConfigModal.js");
      const { key, value, description } = req.body;

      if (!key || value === undefined) {
        return res.status(400).json({ message: "Key and value are required" });
      }

      const config = await SystemConfig.findOneAndUpdate(
        { key },
        {
          value,
          description,
          updated_at: new Date(),
          updated_by: req.user._id
        },
        { new: true, upsert: true }
      );

      // 📜 Log Audit Entry
      try {
        if (key.includes('SETTINGS') || key.includes('OAUTH') || key.includes('SSO')) {
          await auditLogger.logIntegrationChange(key, value, req.user, req);
        } else if (key.includes('NOTIFICATION')) {
          await auditLogger.logNotificationTriggerUpdate(key, value, req.user, req);
        } else {
          await auditLogger.logSystemConfigUpdate(key, value, req.user, req);
        }
      } catch (auditError) {
        console.error('⚠️ [AUDIT] Error logging system config update:', auditError.message);
      }

      res.json({ data: config, message: "System configuration updated successfully" });
    } catch (error) {
      console.error("System config update error:", error);
      res.status(500).json({ message: "Failed to update system configuration" });
    }
  },

  // Audit Logs Endpoint
  async getAuditLogs(req, res) {
    try {
      const { getSuperAdminAuditLogs } = await import("../utils/auditLogger.js");
      const { action, dateRange, limit, organizationId, userId } = req.query;

      const logs = await getSuperAdminAuditLogs({
        action,
        dateRange,
        organizationId,
        userId,
        limit: parseInt(limit) || 100
      });

      res.json({ data: logs });
    } catch (error) {
      console.error("Audit logs fetch error:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  },

  // Export Audit Logs Endpoint
  async exportAuditLogs(req, res) {
    try {
      const { getSuperAdminAuditLogs } = await import("../utils/auditLogger.js");
      const { action, dateRange, organizationId, userId } = req.query;

      const logs = await getSuperAdminAuditLogs({
        action,
        dateRange,
        organizationId,
        userId,
        limit: 5000 // Higher limit for exports
      });

      if (!logs || logs.length === 0) {
        return res.status(404).json({ message: "No logs found to export" });
      }

      // Generate CSV
      const fields = ['timestamp', 'action', 'actor_email', 'actor_name', 'entity_type', 'entity_name', 'change_summary', 'source_ip'];
      const csvRows = [];

      // Header
      csvRows.push(fields.join(','));

      // Data
      for (const log of logs) {
        const row = fields.map(field => {
          let value = log[field] || '';
          // Format timestamp
          if (field === 'timestamp') value = new Date(value).toISOString();
          // Escape commas and quotes for CSV
          const escaped = ('' + value).replace(/"/g, '""');
          return `"${escaped}"`;
        });
        csvRows.push(row.join(','));
      }

      const csvContent = csvRows.join('\n');
      const filename = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.status(200).send(csvContent);

    } catch (error) {
      console.error("Audit logs export error:", error);
      res.status(500).json({ message: "Failed to export audit logs" });
    }
  },

  // System Health Endpoint
  async getSystemHealth(req, res) {
    try {
      const uptime = process.uptime();
      const memoryUsage = process.memoryUsage();

      res.json({
        data: {
          status: "healthy",
          uptime_seconds: uptime,
          memory_usage: {
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
            rss: Math.round(memoryUsage.rss / 1024 / 1024)
          },
          timestamp: new Date()
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch system health" });
    }
  },

  // Notification Health Endpoint
  async getNotificationHealth(req, res) {
    try {
      res.json({
        data: {
          channels: {
            email: {
              status: "healthy",
              success_rate: 99.8,
              queue_size: 45,
              last_check: new Date()
            },
            push: {
              status: "healthy",
              success_rate: 98.5,
              queue_size: 12,
              last_check: new Date()
            },
            inApp: {
              status: "healthy",
              success_rate: 100,
              queue_size: 0,
              last_check: new Date()
            }
          }
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notification health" });
    }
  },

  // Error Logs Endpoint
  async getErrorLogs(req, res) {
    try {
      const { level, limit } = req.query;

      // Mock data removed
      const errorLogs = [];

      const filtered = level && level !== 'all'
        ? errorLogs.filter(log => log.level === level)
        : errorLogs;

      res.json({ data: filtered.slice(0, parseInt(limit) || 50) });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch error logs" });
    }
  },

  // Failed Jobs Endpoint
  async getFailedJobs(req, res) {
    try {
      // Mock data removed
      const failedJobs = [];

      res.json({ data: failedJobs });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch failed jobs" });
    }
  },

  // Abuse Alerts Endpoint
  async getAbuseAlerts(req, res) {
    try {
      // Mock data - in production, track actual abuse metrics
      // Mock data removed
      const abuseAlerts = [];

      res.json({ data: abuseAlerts });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch abuse alerts" });
    }
  },

};