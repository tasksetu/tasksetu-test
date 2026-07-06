import "./env.ts"; // Ensure environment variables are loaded
import { createServer } from "http";
import cors from "cors";
import express from "express";
import path from "path";
import fs from "fs";
import { storage } from "./mongodb-storage.js";
import { User } from "./modals/userModal.js";
import Task from "./modals/taskModal.js";
import { FormTemplate } from "./modals/formTemplateModal.js";
import LicenseInstance from "./modals/licenseInstanceModal.js";
import { License } from "./modals/licenseModal.js";
import { seatManagementService } from "./services/seatManagementService.js";
import { authenticateToken, requireRole } from "./middleware/roleAuth.js";
import { requireSuperAdmin } from "./middleware/superAdminAuth.js";
import { authService } from "./services/authService.js";
import {
  uploadProfileImage,
  processProfileImage,
  deleteOldProfileImage,
} from "./middleware/upload.js";
import userRoutes from "./routes/userRoutes.js";
import superAdminRoutes from "./routes/superAdminRoutes.js";
import superAdminDashboardRoutes from "./routes/superAdminDashboardRoutes.js";
import superAdminLicenseRoutes from "./routes/superAdminLicenseRoutes.js";
import superAdminOrganizationRoutes from "./routes/superAdminOrganizationRoutes.js";
import licenseRoutes from "./routes/licenseRoutes.js";
import licenseApiRoutes from "./routes/licenseApiRoutes.js"; // 🆕 New license API endpoints
import { emailService } from "./services/emailService.js";
import { registerLoginCustomizationRoutes } from "./routes/loginCustomization.js";
import taskRoutes from "./routes/taskRoutes.js";
import taskfeedRoutes from "./routes/taskfeedRoutes.js";
import taskStatusRoutes from "./routes/taskStatusRoutes.js";
import taskPriorityRoutes from "./routes/taskPriorityRoutes.js";
import { registerUserInvitationRoutes } from "./routes/userInvitation.js";
import authRoutes from "./routes/authRoutes.js";
import formRoutes from "./routes/formRoutes.js";
import formCategoryRoutes from "./routes/formCategoryRoutes.js";
import formTagRoutes from "./routes/formTagRoutes.js";
import auditRoutes from "./routes/auditRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import { googleCalendarRoutes } from "./routes/googleCalendar.js";
import { de } from "zod/v4/locales";
import { testGoogleCalendarRoutes } from "./routes/testGoogleCalendar.js";
import { notificationRoutes } from "./routes/notificationRoutes.js";
import notificationSettingsRoutes from "./routes/notificationSettingsRoutes.js";
import roleRoutes from "./routes/roleRoutes.js";
import organizationSettingsRoutes from "./routes/organizationSettingsRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js"; // 🆕 Transaction history routes
import billingDetailsRoutes from "./routes/billingDetailsRoutes.js"; // 🆕 Billing details routes
import organizationHierarchyRoutes from "./routes/organizationHierarchyRoutes.js"; // 🆕 Organization hierarchy routes
import { createDueDateNotifications } from "./controller/taskController.js";
import rateLimit from "express-rate-limit";
import {
  purchaseLicensePlan,
  getMultiSubscriptions,
  getLicensePool,
  assignLicenseToUser,
  unassignLicenseFromUser,
  getLicensePurchases,
  cancelPurchase,
  createLicenseOrder,
  verifyLicensePayment,
} from "./controller/multiLicenseController.js";

export async function registerRoutes(app) {
  // 🔥 FIRST MIDDLEWARE - Log ALL PATCH requests to /tasks
  app.use((req, res, next) => {
    if (req.method === "PATCH" && req.path.includes("/tasks/")) {
      console.log("🔥🔥🔥 PATCH REQUEST TO TASKS DETECTED 🔥🔥🔥");
      console.log("🔥 Path:", req.path);
      console.log("🔥 Original URL:", req.originalUrl);
      console.log("🔥 Method:", req.method);
      console.log("🔥 Body:", JSON.stringify(req.body));
    }
    next();
  });

  // Configure CORS
  app.use(
    cors({
      origin: true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
      ],
    }),
  );

  // Body parser with size limits and error handling (Spec 5.10 & 5.11)
  app.use(
    express.json({
      limit: "10mb",
      verify: (req, res, buf, encoding) => {
        // Check if payload exceeds limit
        if (buf.length > 10 * 1024 * 1024) {
          const error = new Error("PAYLOAD_TOO_LARGE");
          error.status = 413;
          throw error;
        }
      },
    }),
  );
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // 413 Payload Too Large error handler (Spec 5.11 - Edge Case)
  app.use((err, req, res, next) => {
    if (
      err.status === 413 ||
      err.message === "PAYLOAD_TOO_LARGE" ||
      err.type === "entity.too.large"
    ) {
      return res.status(413).json({
        success: false,
        message:
          "Request payload too large. Please reduce file attachment sizes or form data.",
        error: "PAYLOAD_TOO_LARGE",
        max_size: "10MB",
        hint: "Consider compressing images, reducing file sizes, or splitting submissions into multiple parts.",
      });
    }
    next(err);
  });

  // Request logger for debugging
  app.use((req, res, next) => {
    if (
      req.path.includes("/tasks/") &&
      (req.method === "PUT" || req.method === "PATCH")
    ) {
      console.log("🌐 [REQUEST LOGGER] =================================");
      console.log("🌐 [REQUEST LOGGER] Incoming Request:", {
        method: req.method,
        path: req.path,
        originalUrl: req.originalUrl,
        body: req.body,
        params: req.params,
        headers: {
          authorization: req.headers.authorization ? "Bearer ***" : "None",
          contentType: req.headers["content-type"],
        },
      });
      console.log("🌐 [REQUEST LOGGER] =================================");
    }
    next();
  });

  // Serve static files for uploaded images (except task-attachments and form-submissions which require auth)
  // Block direct access to task-attachments - must use authenticated API routes
  app.use("/uploads/task-attachments", (_req, res) => {
    res.status(403).json({
      success: false,
      message:
        "Access denied. Use authenticated API to access task attachments.",
    });
  });
  // Block direct access to form-submissions - must use authenticated API routes
  app.use("/uploads/form-submissions", (_req, res) => {
    res.status(403).json({
      success: false,
      message:
        "Access denied. Use authenticated API to access form submission files.",
    });
  });


  // ✅ PUBLIC routes (no auth) - Register BEFORE other routes to avoid middleware conflicts
  // Login customization routes - must be early for public access
  registerLoginCustomizationRoutes(app);

  // This handles /api/public/forms/:token (GET) and /api/public/forms/:token/submit (POST)
  app.use("/api/public", formRoutes);

  app.use("/api", userRoutes);
  app.use("/api/super-admin", superAdminRoutes);
  app.use("/api/super-admin", superAdminDashboardRoutes); // Super admin dashboard analytics
  app.use("/api/super-admin", superAdminLicenseRoutes); // Super admin license management
  app.use("/api/super-admin", superAdminOrganizationRoutes); // Super admin organization management
  app.use("/api/license", licenseRoutes); // License management routes (OLD)
  app.use("/api/license", licenseApiRoutes); // 🆕 New license API endpoints (current, features, upgrade)
  app.use("/api", licenseApiRoutes); // 🆕 Billing routes (/api/billing/*)
  app.use("/api/transaction-history", transactionRoutes); // 🆕 Transaction history routes
  app.use("/api/billing-details", authenticateToken, billingDetailsRoutes); // 🆕 Billing details CRUD routes
  app.use("/api/auth", authRoutes);

  app.use("/api/forms", formRoutes);
  app.use("/api/form-categories", formCategoryRoutes); // Spec 5.6 - Form categories
  app.use("/api/form-tags", formTagRoutes); // Spec 5.6 - Form tags
  app.use("/api/audit-logs", auditRoutes); // Spec 5.12 - Audit logging API
  app.use("/api/dashboard", dashboardRoutes);
  app.use(
    "/api/organization/hierarchy",
    authenticateToken,
    organizationHierarchyRoutes,
  );

  // Multi-license system routes with Razorpay
  app.post(
    "/api/organization/create-license-order",
    authenticateToken,
    requireRole(["org_admin", "super_admin", "individual"]),
    createLicenseOrder,
  );
  app.post(
    "/api/organization/verify-license-payment",
    authenticateToken,
    requireRole(["org_admin", "super_admin", "individual"]),
    verifyLicensePayment,
  );
  app.post(
    "/api/organization/purchase-plan",
    authenticateToken,
    requireRole(["org_admin", "super_admin"]),
    purchaseLicensePlan,
  );
  app.get(
    "/api/organization/multi-subscriptions",
    authenticateToken,
    getMultiSubscriptions,
  );
  app.get("/api/organization/license-pool", authenticateToken, getLicensePool);
  app.post(
    "/api/organization/assign-license",
    authenticateToken,
    requireRole(["org_admin", "super_admin"]),
    assignLicenseToUser,
  );
  app.post(
    "/api/organization/unassign-license",
    authenticateToken,
    requireRole(["org_admin", "super_admin"]),
    unassignLicenseFromUser,
  );
  app.get(
    "/api/organization/license-purchases",
    authenticateToken,
    requireRole(["org_admin", "super_admin"]),
    getLicensePurchases,
  );
  app.post(
    "/api/organization/cancel-purchase/:purchaseId",
    authenticateToken,
    requireRole(["org_admin", "super_admin"]),
    cancelPurchase,
  );

  // Register user invitation routes
  try {
    registerUserInvitationRoutes(app);
    console.log("User invitation routes registered successfully");
  } catch (error) {
    console.error("Error registering user invitation routes:", error);
  }

  app.get("/api/organization/details", authenticateToken, async (req, res) => {
    try {
      if (!req.user.organizationId) {
        return res
          .status(400)
          .json({ message: "User not associated with any organization" });
      }

      const organization = await storage.getOrganization(
        req.user.organizationId,
      );

      if (!organization) {
        return res.status(404).json({ message: "Organization not found" });
      }

      // Return complete organization object
      res.json(organization);
    } catch (error) {
      console.error("Get organization details error:", error);
      res.status(500).json({ message: "Failed to fetch organization details" });
    }
  });

  // Get team members for current user's organization
  app.get("/api/team-members", authenticateToken, async (req, res) => {
    try {
      const user = req.user;
      console.log("Team members API - User from token:", {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      });

      if (!user.organizationId) {
        console.log("No organizationId for user");
        return res
          .status(400)
          .json({ message: "User not associated with any organization" });
      }

      // Get all users in the same organization
      console.log("Fetching team members for org:", user.organizationId);
      const teamMembers = await storage.getOrganizationUsersDetailed(
        user.organizationId,
      );
      console.log("Team members found:", teamMembers.length);

      // Fetch stats for all team members
      const membersWithStats = await Promise.all(
        teamMembers.map(async (member) => {
          const [formsCreated, activeProcesses] = await Promise.all([
            FormTemplate.countDocuments({ owner_user_id: member._id }),
            Task.countDocuments({
              createdBy: member._id,
              isMilestone: true,
              "linkedTasks.0": { $exists: true },
              isDeleted: { $ne: true },
            }),
          ]);
          return {
            ...(member.toObject ? member.toObject() : member),
            formsCreated,
            activeProcesses,
          };
        }),
      );

      // Format the response to include only necessary fields
      const formattedMembers = membersWithStats.map((member) => ({
        id: member._id,
        firstName: member.firstName,
        lastName: member.lastName,
        fullName: `${member.firstName || ""} ${member.lastName || ""}`.trim(),
        email: member.email,
        role: member.role,
        status: member.status,
        profileImageUrl: member.profileImageUrl,
        isActive: member.isActive,
        emailVerified: member.emailVerified,
        lastLoginAt: member.lastLoginAt,
        createdAt: member.createdAt,
        invitedBy: member.invitedBy
          ? {
              id: member.invitedBy._id,
              name: `${member.invitedBy.firstName || ""} ${
                member.invitedBy.lastName || ""
              }`.trim(),
            }
          : null,
        invitedAt: member.invitedAt,
        formsCreated: member.formsCreated,
        activeProcesses: member.activeProcesses,
      }));

      res.json(formattedMembers);
    } catch (error) {
      console.error("Error fetching team members:", error);
      res.status(500).json({ message: "Failed to fetch team members" });
    }
  });

  // User routes
  app.get("/api/users", authenticateToken, async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // IMPORTANT: Specific routes must come BEFORE parameterized routes
  // This search route must be defined before /api/users/:id
  // Otherwise, "search" will be treated as an ID parameter

  // Get individual user by ID (no auth required for internal use)
  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Fetch additional stats (Forms Created and Active Processes)
      const [formsCreated, activeProcesses] = await Promise.all([
        FormTemplate.countDocuments({ owner_user_id: user._id }),
        Task.countDocuments({
          createdBy: user._id,
          isMilestone: true,
          "linkedTasks.0": { $exists: true },
          isDeleted: { $ne: true },
        }),
      ]);

      // Return clean user data without sensitive fields
      const userProfile = {
        _id: user._id,

        email: user.email,
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        profileImageUrl: user.profileImageUrl || null,
        role: user.role,
        organizationId: user.organization_id,
        status: user.status,
        department: user.department || null,
        designation: user.designation || null,
        location: user.location || null,
        isPrimaryAdmin: user.isPrimaryAdmin || false,
        formsCreated,
        activeProcesses,
        lastLoginAt: user.lastLoginAt || null,
        phone: user.phone || null,
        // Include license information
        assigned_license: user.assigned_license || null,
        seat_assigned: user.seat_assigned || false,
        seat_number: user.seat_number || null,
        license_code: user.license_code || null,
        account_type: user.account_type || "company",
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      res.json(userProfile);
    } catch (error) {
      console.error("Get user by ID error:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Update user profile by ID
  app.put(
    "/api/users/:id/profile",
    uploadProfileImage,
    processProfileImage,
    async (req, res) => {
      try {
        const userId = req.params.id;
        const { firstName, lastName, phone, organizationName } = req.body;

        // Fetch current user once to access org id and existing image
        const currentUser = await storage.getUser(userId);

        console.log("Profil>>>>>>>>>>>>", {
          organizationName,
        });

        // Validate required fields
        if (!firstName || !firstName.trim()) {
          return res.status(400).json({ message: "First name is required" });
        }

        // Build update object
        const updateData = {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone ? phone.trim() : null,
        };

        // Handle profile image upload
        if (req.file) {
          // Delete old profile image if exists
          if (currentUser?.profileImageUrl) {
            deleteOldProfileImage(currentUser.profileImageUrl);
          }

          // Set new profile image path
          updateData.profileImageUrl = `/uploads/profile-pics/${req.file.filename}`;
        }

        // Update organization name if provided and user belongs to an organization
        if (organizationName?.trim() && currentUser) {
          const orgId =
            currentUser.organization_id ||
            currentUser.organizationId ||
            currentUser.organization;

          if (orgId) {
            try {
              // Check if the name already exists for a different organization
              if (typeof storage.getOrganizationByName === "function") {
                const existingOrg = await storage.getOrganizationByName(
                  organizationName.trim(),
                );
              }
              if (typeof storage.updateOrganizationName === "function") {
                await storage.updateOrganizationName(
                  orgId,
                  organizationName.trim(),
                );
              } else if (typeof storage.updateOrganization === "function") {
                await storage.updateOrganization(orgId, {
                  name: organizationName.trim(),
                });
              } else if (typeof storage.updateCompany === "function") {
                await storage.updateCompany(orgId, {
                  name: organizationName.trim(),
                });
              } else {
                console.warn(
                  "No storage method available to update organization name",
                );
              }
            } catch (e) {
              console.error("Update organization name error:", e);
              // Do not fail the entire profile update if org rename fails
            }
          }
        }

        console.log("Profile Update - Update data:", updateData);

        const updatedUser = await storage.updateUser(userId, updateData);

        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }

        // Return clean user profile data
        const userProfile = {
          _id: updatedUser._id,
          id: updatedUser._id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          phone: updatedUser.phone,
          profileImageUrl: updatedUser.profileImageUrl,
          role: updatedUser.role,
          organizationId: updatedUser.organizationId,
          status: updatedUser.status,
          updatedAt: updatedUser.updatedAt,
        };

        console.log("Profile Update - Success:", userProfile);
        res.json({
          message: "Profile updated successfully",
          user: userProfile,
        });
      } catch (error) {
        console.error("Update user profile error:", error);

        // Delete uploaded file on error
        if (req.file && req.file.path) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (unlinkError) {
            console.error("Error deleting uploaded file:", unlinkError);
          }
        }

        res.status(500).json({ message: "Failed to update profile" });
      }
    },
  );

  // Get current user profile
  app.get("/api/profile", authenticateToken, async (req, res) => {
    try {
      console.log("Profile API called - User ID:", req.user.id);
      const user = await storage.getUser(req.user.id);
      if (!user) {
        console.log("Profile API - User not found for ID:", req.user.id);
        return res.status(404).json({ message: "User not found" });
      }

      console.log("Profile API - Raw user data:", user);

      // Remove sensitive data and return clean profile
      const userProfile = {
        _id: user._id,
        id: user._id,
        email: user.email,
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        phone: user.phone || "",
        profileImageUrl: user.profileImageUrl || null,
        role: user.role,
        organizationId: user.organizationId || user.organization,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
        department: user.department || "",
        designation: user.designation || "",
        isPrimaryAdmin: user.isPrimaryAdmin || false,
      };

      console.log("Profile API - Sending response:", userProfile);
      res.json(userProfile);
    } catch (error) {
      console.error("Get profile error:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  // Update user profile
  app.put(
    "/api/profile",
    authenticateToken,
    uploadProfileImage,
    processProfileImage,
    async (req, res) => {
      try {
        const userId = req.user.id;
        const { firstName, lastName, phone } = req.body;

        console.log("Profile Update - Request data:", {
          userId,
          firstName,
          lastName,
          hasFile: !!req.file,
        });

        // Validate required fields
        if (!firstName || !firstName.trim()) {
          return res.status(400).json({ message: "First name is required" });
        }

        // Build update object with only allowed fields
        const updateData = {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone ? phone.trim() : null,
        };

        // Handle profile image upload
        if (req.file) {
          const currentUser = await storage.getUser(userId);

          // Delete old profile image if exists
          if (currentUser.profileImageUrl) {
            deleteOldProfileImage(currentUser.profileImageUrl);
          }

          // Set new profile image path
          updateData.profileImageUrl = `/uploads/profile-pics/${req.file.filename}`;
        }

        const updatedUser = await storage.updateUser(userId, updateData);

        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }

        // Return clean user profile data
        const userProfile = {
          _id: updatedUser._id,
          id: updatedUser._id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          profileImageUrl: updatedUser.profileImageUrl,
          role: updatedUser.role,
          organizationId:
            updatedUser.organizationId || updatedUser.organization,
          status: updatedUser.status,
          createdAt: updatedUser.createdAt,
          updatedAt: updatedUser.updatedAt,
        };

        res.json({
          message: "Profile updated successfully",
          user: userProfile,
        });
      } catch (error) {
        console.error("Update profile error:", error);

        // Delete uploaded file on error
        if (req.file && req.file.path) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (unlinkError) {
            console.error("Error deleting uploaded file:", unlinkError);
          }
        }

        res.status(500).json({ message: "Failed to update profile" });
      }
    },
  );

  // Organization routes
  app.get("/api/organization/users", authenticateToken, async (req, res) => {
    try {
      const users = await storage.getOrganizationUsers(req.user.organizationId);
      res.json(users);
    } catch (error) {
      console.error("Get organization users error:", error);
      res.status(500).json({ message: "Failed to fetch organization users" });
    }
  });

  app.get(
    "/api/organization/users-detailed",
    authenticateToken,
    async (req, res) => {
      try {
        const users = await storage.getOrganizationUsersDetailed(
          req.user.organizationId,
        );
        res.json(users);
      } catch (error) {
        console.error("Get organization users detailed error:", error);
        res.status(500).json({ message: "Failed to fetch organization users" });
      }
    },
  );

  // 🆕 NEW: Organization license summary endpoint
  // Returns aggregate summary, NOT a "current license"
  app.get("/api/organization/license", authenticateToken, async (req, res) => {
    try {
      // Handle individual users (no organizationId)
      if (!req.user.organizationId) {
        const user = await User.findById(
          req.user.userId || req.user._id,
        ).populate("license_instance_id");

        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        // Get license from new system or fallback to old
        const licenseCode =
          user.license_instance_id?.license_code ||
          user.license_code ||
          "EXPLORE";

        const licenseInfo = {
          totalLicenses: 1,
          licenseType: licenseCode,
          assignedLicenses: 1,
          availableLicenses: 0,
          accountType: "individual",
        };
        return res.json(licenseInfo);
      }

      // 🆕 NEW: Get aggregate license summary from LicenseInstance
      const poolSummary = await LicenseInstance.getPoolSummary(
        req.user.organizationId,
      );

      // Calculate totals across all license types
      const totalLicenses = poolSummary.reduce(
        (sum, item) => sum + item.total,
        0,
      );
      const assignedLicenses = poolSummary.reduce(
        (sum, item) => sum + item.assigned,
        0,
      );
      const availableLicenses = poolSummary.reduce(
        (sum, item) => sum + item.available,
        0,
      );

      const licenseInfo = {
        totalLicenses,
        assignedLicenses,
        availableLicenses,
        accountType: "organization",
        // 🆕 NEW: Breakdown by license type
        licenseBreakdown: poolSummary,
        // DEPRECATED: No longer has single "licenseType"
        // Frontend should use licenseBreakdown instead
        licenseType: null,
      };

      res.json(licenseInfo);
    } catch (error) {
      console.error("Get organization license error:", error);
      res.status(500).json({ message: "Failed to fetch license information" });
    }
  });

  // License pool endpoint for User Management page
  // 🆕 NEW: Returns real inventory from LicenseInstance collection
  app.get(
    "/api/license/organization/license-pool",
    authenticateToken,
    async (req, res) => {
      try {
        const organizationId = req.user.organizationId;
        const { PLAN_ORDER_UPPERCASE } =
          await import("./utils/licenseConstants.js");

        // Handle individual users (legacy support)
        if (!organizationId) {
          const user = await User.findById(
            req.user.userId || req.user._id,
          ).populate("license_instance_id");

          const userLicense =
            user?.license_instance_id?.license_code ||
            user?.license_code ||
            "EXPLORE";

          const licensePool = PLAN_ORDER_UPPERCASE.map((licenseType) => ({
            license_code: licenseType,
            display_name:
              licenseType.charAt(0) + licenseType.slice(1).toLowerCase(),
            is_current: licenseType === userLicense,
            total: licenseType === userLicense ? 1 : 0,
            assigned: licenseType === userLicense ? 1 : 0,
            available: 0,
          }));
          return res.json(licensePool);
        }

        // 🆕 NEW: Get real license pool from LicenseInstance model
        const poolSummary =
          await LicenseInstance.getPoolSummary(organizationId);

        // Get all available license types
        const allLicenses = await License.find({ is_active: true }).sort({
          license_code: 1,
        });

        // Create map
        const purchasedMap = {};
        poolSummary.forEach((item) => {
          purchasedMap[item.license_code] = item;
        });

        // Build complete response
        const licensePool = allLicenses.map((license) => {
          const purchased = purchasedMap[license.license_code];
          return {
            license_code: license.license_code,
            display_name: license.name,
            total: purchased?.total || 0,
            assigned: purchased?.assigned || 0,
            available: purchased?.available || 0,
            is_current: false, // Deprecated - orgs don't have "current" license anymore
          };
        });

        res.json(licensePool);
      } catch (error) {
        console.error("Get license pool error:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch license pool information" });
      }
    },
  );

  // Get all available license plans
  app.get("/api/license/plans", authenticateToken, async (req, res) => {
    try {
      const { License } = await import("./modals/licenseModal.js");

      // Fetch all active license plans, sorted by display order
      const plans = await License.find({
        is_active: true,
        license_code: { $ne: "EXPIRED" }, // Exclude EXPIRED plan
      })
        .sort({ display_order: 1 })
        .lean();

      // Get current license for comparison
      let currentLicenseCode = "EXPLORE"; // Default

      if (req.user.organizationId) {
        // Organization user
        const licenseInfo = await storage.getOrganizationLicenseInfo(
          req.user.organizationId,
        );
        currentLicenseCode = licenseInfo.licenseType;
      } else {
        // Individual user
        const user = await User.findById(req.user.userId || req.user._id);
        if (user) {
          currentLicenseCode = user.license_code || "EXPLORE";
        }
      }

      // Transform plans for frontend consumption
      const transformedPlans = plans.map((plan) => ({
        license_code: plan.license_code,
        license_name: plan.name,
        description: plan.description,
        price_monthly: plan.price_monthly,
        price_yearly: plan.price_yearly,
        max_users: plan.max_users,
        trial_days: plan.trial_days,
        features_summary: plan.features_summary || [],
        is_popular: plan.is_popular || false,
        is_current: plan.license_code === currentLicenseCode,
        display_order: plan.display_order,
      }));

      res.json({
        success: true,
        data: transformedPlans,
        current_license: currentLicenseCode,
      });
    } catch (error) {
      console.error("Get license plans error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch license plans",
      });
    }
  });

  app.post("/api/organization/invite-users", async (req, res) => {
    try {
      const { invites } = req.body;
      console.log("sdProcessing invitation for:", invites);
      if (!invites || !Array.isArray(invites) || invites.length === 0) {
        return res.status(400).json({ message: "Invalid invitation data" });
      }
      console.log(
        `\n📨 Starting invitation process for ${invites.length} user(s)`,
      );
      const results = {
        success: [], // Array of successful invitations
        errors: [], // Array of failed invitations
        successCount: 0,
        details: [],
      };

      // Get the first organization for testing (temporary fix)
      const organizations = await storage.getAllCompanies();
      const defaultOrgId =
        organizations.length > 0 ? organizations[0]._id : null;

      if (!defaultOrgId) {
        return res
          .status(400)
          .json({ message: "No organization found for invitations" });
      }

      for (const invite of invites) {
        try {
          console.log(`\n🚀 Processing invitation for: ${invite.email}`);

          const inviteData = {
            email: invite.email,
            organizationId: defaultOrgId,
            roles: invite.role,
            invitedBy: defaultOrgId, // Use org ID as placeholder
            invitedByName: "TaskSetu Admin",
            organizationName: "TaskSetu Organization",
            name: invite.name || "",
            licenseId: invite.licenseId || null,
            department: invite.department || null,
            designation: invite.designation || null,
            location: invite.location || null,
            phone: invite.phone || null,
            sendEmail: invite.sendEmail !== false, // default true
          };

          console.log("📦 Invite data prepared:", inviteData);

          const result = await storage.inviteUserToOrganization(inviteData);
          console.log(
            `✅ Successfully invited user: ${invite.email}, ID: ${result._id}`,
          );

          results.successCount++;
          results.success.push({ email: invite.email, userId: result._id });
          results.details.push({ email: invite.email, status: "success" });
        } catch (error) {
          console.error(
            `❌ Invitation error for ${invite.email}:`,
            error.message,
          );
          console.error("Full error:", error);
          results.errors.push({ email: invite.email, error: error.message });
          results.details.push({
            email: invite.email,
            status: "error",
            error: error.message,
          });
        }
      }

      const statusCode = results.successCount > 0 ? 200 : 400;
      const message =
        results.successCount === invites.length
          ? "All invitations sent successfully"
          : results.successCount > 0
            ? "Some invitations sent successfully"
            : "Failed to send invitations";

      const response = {
        message,
        results: {
          success: results.success,
          errors: results.errors,
        },
        successCount: results.successCount,
        errorCount: results.errors.length,
      };

      console.log("\n📤 Final response:", {
        statusCode,
        successCount: results.successCount,
        errorCount: results.errors.length,
        message,
      });

      res.status(statusCode).json(response);
    } catch (error) {
      console.error("❌ Invite users error:", error);
      res.status(500).json({
        message: "Failed to process invitations",
        error: error.message,
        results: {
          success: [],
          errors: [{ error: error.message }],
        },
      });
    }
  });

  // Check if email has already been invited (temporarily without auth for testing)
  app.post("/api/organization/check-invitation", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      console.log("Checking invitation for email:", email);

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      console.log("Existing user found:", existingUser ? "Yes" : "No");

      if (existingUser) {
        console.log("User is already a member of an organization");
        return res.json({
          exists: true,
          type: "existing_user",
          message: "This email is already a member of an organization",
        });
      }

      // Check if invitation already sent
      const existingInvite = await storage.getPendingUserByEmail(email);
      console.log("Existing invite found:", existingInvite ? "Yes" : "No");

      if (existingInvite) {
        console.log("Invitation already sent to this email");
        return res.json({
          exists: true,
          type: "pending_invitation",
          message:
            "This email has already received an invitation. Try another email.",
        });
      }

      res.json({ exists: false });
    } catch (error) {
      console.error("Check invitation error:", error);
      res.status(500).json({
        message: "Failed to check invitation status",
        error: error.message,
      });
    }
  });

  // Add new user (Company Admin only)
  app.post("/api/organization/users", authenticateToken, async (req, res) => {
    try {
      const {
        firstName,
        lastName,
        email,
        role,
        department,
        designation,
        location,
      } = req.body;
      const adminUser = req.user;

      // Check if user has admin privileges
      if (!adminUser || !["admin", "org_admin"].includes(adminUser.role)) {
        return res
          .status(403)
          .json({ message: "Insufficient privileges for user management" });
      }

      // Validate required fields
      if (!firstName || !lastName || !email || !role) {
        return res
          .status(400)
          .json({ message: "Name, email, and role are required" });
      }

      // Check license availability
      const licenseInfo = await storage.getOrganizationLicenseInfo(
        adminUser.organizationId,
      );
      if (licenseInfo.availableSlots <= 0) {
        return res.status(400).json({
          message: "No available licenses. Please upgrade your plan.",
        });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res
          .status(400)
          .json({ message: "User with this email already exists" });
      }

      // Generate invitation token
      const inviteToken = storage.generateEmailVerificationToken();
      const inviteExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

      // Create user with invitation
      const userData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase().trim(),
        role: role,
        department: department?.trim() || "",
        designation: designation?.trim() || "",
        location: location?.trim() || "",
        organization: adminUser.organizationId,
        status: "invited",
        inviteToken: inviteToken,
        inviteTokenExpiry: inviteExpiry,
        invitedBy: adminUser.id,
        invitedAt: new Date(),
      };

      const newUser = await storage.createUser(userData);

      // Send invitation email (placeholder - implement as needed)
      console.log(`Invitation sent to ${email} with token: ${inviteToken}`);

      res.json({
        message: "User invited successfully",
        user: {
          id: newUser._id,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          email: newUser.email,
          role: newUser.role,
          status: newUser.status,
        },
      });
    } catch (error) {
      console.error("Add user error:", error);
      res.status(500).json({ message: "Failed to add user" });
    }
  });

  // Update user details (Company Admin only)
  app.patch(
    "/api/organization/users/:userId",
    authenticateToken,
    async (req, res) => {
      try {
        const { userId } = req.params;
        const { firstName, lastName, department, designation, location } =
          req.body;
        const adminUser = req.user;

        // Check admin privileges - role can be an array
        const userRoles = Array.isArray(adminUser.role)
          ? adminUser.role
          : [adminUser.role];
        const hasAdminPrivileges = userRoles.some((role) =>
          ["admin", "org_admin"].includes(role),
        );

        if (!adminUser || !hasAdminPrivileges) {
          return res
            .status(403)
            .json({ message: "Insufficient privileges for user management" });
        }

        // Validate user exists and belongs to same organization
        const targetUser = await storage.getUser(userId);
        if (
          !targetUser ||
          targetUser.organization.toString() !== adminUser.organizationId
        ) {
          return res.status(404).json({ message: "User not found" });
        }

        // Update user data
        const updateData = {};
        if (firstName) updateData.firstName = firstName.trim();
        if (lastName) updateData.lastName = lastName.trim();
        if (department !== undefined) updateData.department = department.trim();
        if (designation !== undefined)
          updateData.designation = designation.trim();
        if (location !== undefined) updateData.location = location.trim();

        const updatedUser = await storage.updateUser(userId, updateData);

        res.json({
          message: "User updated successfully",
          user: {
            id: updatedUser._id,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            email: updatedUser.email,
            department: updatedUser.department,
            designation: updatedUser.designation,
            location: updatedUser.location,
          },
        });
      } catch (error) {
        console.error("Update user error:", error);
        res.status(500).json({ message: "Failed to update user" });
      }
    },
  );

  // Delete/Remove user (Company Admin only)
  app.delete(
    "/api/organization/users/:userId",
    authenticateToken,
    async (req, res) => {
      try {
        console.log("🗑️ DELETE user request received:", req.params.userId);
        const { userId } = req.params;
        const adminUser = req.user;

        console.log("👤 Admin user:", {
          id: adminUser.id,
          role: adminUser.role,
          orgId: adminUser.organizationId,
        });

        // Check admin privileges - role can be an array
        const userRoles = Array.isArray(adminUser.role)
          ? adminUser.role
          : [adminUser.role];
        const hasAdminPrivileges = userRoles.some((role) =>
          ["admin", "org_admin"].includes(role),
        );

        console.log(
          "🔐 Has admin privileges:",
          hasAdminPrivileges,
          "Roles:",
          userRoles,
        );

        if (!adminUser || !hasAdminPrivileges) {
          console.log("❌ Insufficient privileges");
          return res.status(403).json({
            status: 403,
            message: "Insufficient privileges for user management",
          });
        }

        // Get user to check if exists and belongs to same organization
        console.log("🔍 Finding user:", userId);
        const user = await User.findById(userId);

        if (!user) {
          console.log("❌ User not found");
          return res.status(404).json({
            status: 404,
            message: "User not found",
          });
        }

        console.log("✅ User found:", {
          email: user.email,
          orgId: user.organization_id,
        });

        // Check if user belongs to the same organization
        if (
          user.organization_id.toString() !==
          adminUser.organizationId.toString()
        ) {
          console.log("❌ Organization mismatch");
          return res.status(403).json({
            status: 403,
            message: "Cannot remove user from different organization",
          });
        }

        // Prevent removing primary admin
        if (user.isPrimaryAdmin) {
          console.log("❌ Cannot remove primary admin");
          return res.status(400).json({
            status: 400,
            message: "Cannot remove primary admin",
          });
        }

        // ✅ NEW: Release license instance if user has one assigned
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

          // Method 2: Fallback - find by assigned_to field in LicenseInstance (using ObjectId)
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
          console.error("❌ License error stack:", licenseError.stack);
          // Continue with user deletion even if license release fails
        }

        // Release seat if user has one assigned (legacy support)
        if (user.seat_assigned === true) {
          console.log(
            `🎫 Releasing seat #${user.seat_number} from user ${user.email}`,
          );

          try {
            const releaseResult =
              await seatManagementService.releaseSeatFromUser(
                user.organization_id.toString(),
                userId,
                adminUser.id,
                "User removed from organization",
              );
            console.log(`✅ Seat released successfully:`, releaseResult);
          } catch (seatError) {
            console.error("❌ Error releasing seat:", seatError.message);
            console.error("❌ Seat error stack:", seatError.stack);
            // Continue with user deletion even if seat release fails
          }
        } else {
          console.log("ℹ️ User has no seat assigned, skipping seat release");
        }

        // Delete the user
        console.log("🗑️ Deleting user from database...");
        const deleteResult = await User.findByIdAndDelete(userId);
        console.log(
          "✅ User deleted successfully:",
          deleteResult ? "User found and deleted" : "User not found",
        );

        return res.status(200).json({
          status: 200,
          message: "User removed successfully",
        });
      } catch (error) {
        console.error("❌ Remove user error:", error);
        console.error("Error stack:", error.stack);
        return res.status(500).json({
          status: 500,
          message: "Failed to remove user",
          error: error.message,
        });
      }
    },
  );

  // Change user role (Company Admin only)
  app.patch(
    "/api/organization/users/:userId/role",
    authenticateToken,
    async (req, res) => {
      try {
        const { userId } = req.params;
        const { role } = req.body;
        const adminUser = req.user;

        // Check admin privileges - role can be an array
        const userRoles = Array.isArray(adminUser.role)
          ? adminUser.role
          : [adminUser.role];
        const hasAdminPrivileges = userRoles.some((role) =>
          ["admin", "org_admin"].includes(role),
        );

        if (!adminUser || !hasAdminPrivileges) {
          return res
            .status(403)
            .json({ message: "Insufficient privileges for user management" });
        }

        // Validate role
        const validRoles = ["admin", "manager", "employee"];
        if (!validRoles.includes(role)) {
          return res.status(400).json({ message: "Invalid role specified" });
        }

        // Validate user exists and belongs to same organization
        const targetUser = await storage.getUser(userId);
        if (
          !targetUser ||
          targetUser.organization.toString() !== adminUser.organizationId
        ) {
          return res.status(404).json({ message: "User not found" });
        }

        // Update user role
        const updatedUser = await storage.updateUser(userId, { role: role });

        res.json({
          message: "User role updated successfully",
          user: {
            id: updatedUser._id,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            email: updatedUser.email,
            role: updatedUser.role,
          },
        });
      } catch (error) {
        console.error("Role change error:", error);
        res.status(500).json({ message: "Failed to change user role" });
      }
    },
  );

  // Deactivate user (Company Admin only)
  app.patch(
    "/api/organization/users/:userId/deactivate",
    authenticateToken,
    async (req, res) => {
      try {
        const { userId } = req.params;
        const adminUser = req.user;

        // Check admin privileges
        if (!adminUser || !["admin", "org_admin"].includes(adminUser.role)) {
          return res
            .status(403)
            .json({ message: "Insufficient privileges for user management" });
        }

        // Validate user exists and belongs to same organization
        const targetUser = await storage.getUser(userId);
        if (
          !targetUser ||
          targetUser.organization.toString() !== adminUser.organizationId
        ) {
          return res.status(404).json({ message: "User not found" });
        }

        // Cannot deactivate self
        if (targetUser._id.toString() === adminUser.id) {
          return res
            .status(400)
            .json({ message: "Cannot deactivate your own account" });
        }

        // Update user status
        const updatedUser = await storage.updateUser(userId, {
          status: "inactive",
          isActive: false,
        });

        res.json({
          message: "User deactivated successfully",
          user: {
            id: updatedUser._id,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            email: updatedUser.email,
            status: updatedUser.status,
          },
        });
      } catch (error) {
        console.error("Deactivate user error:", error);
        res.status(500).json({ message: "Failed to deactivate user" });
      }
    },
  );

  // Reactivate user (Company Admin only)
  app.patch(
    "/api/organization/users/:userId/reactivate",
    authenticateToken,
    async (req, res) => {
      try {
        const { userId } = req.params;
        const adminUser = req.user;

        // Check admin privileges
        if (!adminUser || !["admin", "org_admin"].includes(adminUser.role)) {
          return res
            .status(403)
            .json({ message: "Insufficient privileges for user management" });
        }

        // Validate user exists and belongs to same organization
        const targetUser = await storage.getUser(userId);
        if (
          !targetUser ||
          targetUser.organization.toString() !== adminUser.organizationId
        ) {
          return res.status(404).json({ message: "User not found" });
        }

        // Update user status
        const updatedUser = await storage.updateUser(userId, {
          status: "active",
          isActive: true,
        });

        res.json({
          message: "User reactivated successfully",
          user: {
            id: updatedUser._id,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            email: updatedUser.email,
            status: updatedUser.status,
          },
        });
      } catch (error) {
        console.error("Reactivate user error:", error);
        res.status(500).json({ message: "Failed to reactivate user" });
      }
    },
  );

  // Remove user permanently (Company Admin only)

  // Resend invitation (Company Admin only)
  app.post(
    "/api/organization/users/:userId/resend-invite",
    authenticateToken,
    async (req, res) => {
      try {
        const { userId } = req.params;
        const adminUser = req.user;

        // Check admin privileges
        if (!adminUser || !["admin", "org_admin"].includes(adminUser.role)) {
          return res
            .status(403)
            .json({ message: "Insufficient privileges for user management" });
        }

        // Validate user exists and belongs to same organization
        const targetUser = await storage.getUser(userId);
        if (
          !targetUser ||
          targetUser.organization.toString() !== adminUser.organizationId
        ) {
          return res.status(404).json({ message: "User not found" });
        }

        // Only resend for invited users
        if (targetUser.status !== "invited") {
          return res
            .status(400)
            .json({ message: "User is not in invited status" });
        }

        // Generate new invitation token
        const newInviteToken = storage.generateEmailVerificationToken();
        const newExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

        // Update user with new token
        await storage.updateUser(userId, {
          inviteToken: newInviteToken,
          inviteTokenExpiry: newExpiry,
          invitedAt: new Date(),
        });

        // Send new invitation email (placeholder)
        console.log(
          `New invitation sent to ${targetUser.email} with token: ${newInviteToken}`,
        );

        res.json({
          message: "Invitation resent successfully",
        });
      } catch (error) {
        console.error("Resend invite error:", error);
        res.status(500).json({ message: "Failed to resend invitation" });
      }
    },
  );

  // Get user activities (placeholder for user activity tracking)
  app.get(
    "/api/users/activities/:userId",
    authenticateToken,
    async (req, res) => {
      try {
        const { userId } = req.params;
        const adminUser = req.user;

        // Check admin privileges or same user
        if (
          !adminUser ||
          (!["admin", "org_admin"].includes(adminUser.role) &&
            adminUser.id !== userId)
        ) {
          return res.status(403).json({ message: "Insufficient privileges" });
        }

        // Placeholder for user activities - implement actual activity tracking as needed
        const activities = [
          {
            description: "Logged in to the system",
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
            type: "login",
          },
          {
            description: "Completed task: Update user documentation",
            timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
            type: "task_completion",
          },
          {
            description: "Created new task: Review quarterly reports",
            timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
            type: "task_creation",
          },
        ];

        res.json(activities);
      } catch (error) {
        console.error("Get user activities error:", error);
        res.status(500).json({ message: "Failed to fetch user activities" });
      }
    },
  );

  // Task status configs (dynamic, organization-scoped)
  app.use("/api/task-statuses", authenticateToken, taskStatusRoutes);
  // Task priority configs (dynamic, organization-scoped)
  app.use("/api/task-priorities", authenticateToken, taskPriorityRoutes);

  // Task routes
  app.use("/api", taskRoutes);

  // Task feed and dashboard routes
  app.use("/api", taskfeedRoutes);

  // Google Calendar routes
  // Temporary public config route for debugging
  app.get("/api/google-calendar-debug", (req, res) => {
    res.json({
      hasClientId:
        !!process.env.GOOGLE_CLIENT_ID ||
        "798343498792-uq3sq26veej0ptj8r9n949mu107m3qap.apps.googleusercontent.com",
      hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      clientIdLength: process.env.GOOGLE_CLIENT_ID?.length || 0,
      clientSecretLength: process.env.GOOGLE_CLIENT_SECRET?.length || 0,
      redirectUri: `${
        process.env.CLIENT_URL || "https://tasksetu.shrawantravels.com"
      }/google-calendar-callback`,
      clientIdPreview: process.env.GOOGLE_CLIENT_ID?.substring(0, 20) + "...",
      clientSecretPreview:
        process.env.GOOGLE_CLIENT_SECRET?.substring(0, 10) + "...",
    });
  });

  app.use("/api/google-calendar", authenticateToken, googleCalendarRoutes);

  // // Test Google Calendar routes (for development)
  // app.use("/api/test-google-calendar", authenticateToken, testGoogleCalendarRoutes);

  // Test Google Calendar routes (for development)
  app.use(
    "/api/test-google-calendar",
    authenticateToken,
    testGoogleCalendarRoutes,
  );

  // Public notification endpoints (no auth required)
  app.get("/api/notifications/enums", async (req, res) => {
    try {
      const { TriggerEvent, EntityType, NotificationPriority, ChannelType } =
        await import("./modals/notificationModal.js");
      res.json({
        success: true,
        data: {
          TriggerEvent,
          EntityType,
          NotificationPriority,
          ChannelType,
        },
      });
    } catch (error) {
      console.error("Error getting notification enums:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get notification enums",
      });
    }
  });

  // Notification routes (auth required)
  app.use("/api/notifications", authenticateToken, notificationRoutes);
  app.use("/api/notification-settings", notificationSettingsRoutes);
  app.use("/api", roleRoutes);
  app.use("/api", organizationSettingsRoutes);

  // Test endpoint to trigger due date notifications (for testing purposes)
  app.post(
    "/api/notifications/trigger-due-dates",
    authenticateToken,
    async (req, res) => {
      try {
        // Only allow admins or super admins to trigger this
        if (
          !req.user.role ||
          !["admin", "super_admin", "org_admin"].some((role) =>
            Array.isArray(req.user.role)
              ? req.user.role.includes(role)
              : req.user.role === role,
          )
        ) {
          return res.status(403).json({
            success: false,
            message: "Insufficient permissions",
          });
        }

        const result = await createDueDateNotifications();
        res.json({
          success: true,
          message: "Due date notifications triggered successfully",
          data: result,
        });
      } catch (error) {
        console.error("Error triggering due date notifications:", error);
        res.status(500).json({
          success: false,
          message: "Failed to trigger due date notifications",
          error: error.message,
        });
      }
    },
  );

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Create HTTP server
  const httpServer = createServer(app);
  return httpServer;
}
