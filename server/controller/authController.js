import { storage } from "../mongodb-storage.js";
import { authService } from "../services/authService.js";
import { emailService } from "../services/emailService.js";
import auditLogger from "../utils/auditLogger.js";
import { superAdminNotification } from "../utils/superAdminNotification.js";

export const authController = {
  async login(req, res) {
    try {
      const { email, password } = req.body;
      const ipAddress =
        req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
      const userAgent = req.get("User-Agent");
      const result = await authService.login(
        email,
        password,
        ipAddress,
        userAgent
      );

      // Log successful login
      if (result.user) {
        await auditLogger.logUserLogin(result.user, req);
      }

      res.json(result);
    } catch (error) {
      // Log failed login
      const { email } = req.body;
      await auditLogger.logUserLoginFailed(email, error.message, req);

      if (error.isLockout) {
        return res.status(423).json({
          success: false,
          message: error.message,
          isLockout: true,
          timeLeft: error.timeLeft,
          minutes: error.minutes,
        });
      }
      if (error.remainingAttempts !== undefined) {
        return res.status(401).json({
          success: false,
          message: error.message,
          remainingAttempts: error.remainingAttempts,
        });
      }
      res.status(401).json({
        success: false,
        message: error.message || "Authentication failed",
      });
    }
  },

  async register(req, res) {
    try {
      const {
        firstName,
        lastName,
        email,
        password,
        confirmPassword,
        userType,
      } = req.body;

      if (!firstName || !email || !password || !confirmPassword) {
        return res.status(400).json({
          success: false,
          message: "All fields are required",
        });
      }
      if (password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: "Passwords do not match",
        });
      }
      if (userType === "individual") {
        const result = await authService.registerIndividual({
          firstName,
          lastName,
          email,
          password,
        });
        res.json({ success: true, ...result });
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid user type",
        });
      }
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message || "Registration failed",
      });
    }
  },

  async checkLockout(req, res) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
        });
      }
      const lockoutStatus = await authService.isUserLockedOut(email);
      res.json({
        success: true,
        locked: lockoutStatus.locked,
        timeLeft: lockoutStatus.timeLeft || 0,
        minutes: lockoutStatus.minutes || 0,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error checking lockout status",
      });
    }
  },
  async changePassword(req, res) {
    try {
      const userId = req.user?._id || req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const { currentPassword, newPassword, confirmPassword } = req.body || {};
      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ success: false, message: "All fields are required" });
      }
      if (newPassword !== confirmPassword) {
        return res.status(400).json({ success: false, message: "New and confirm password do not match" });
      }

      // Strength check: 8+ chars, number, lower, upper, special
      const strong =
        newPassword.length >= 8 &&
        /[0-9]/.test(newPassword) &&
        /[a-z]/.test(newPassword) &&
        /[A-Z]/.test(newPassword) &&
        /[^A-Za-z0-9]/.test(newPassword);
      if (!strong) {
        return res.status(400).json({
          success: false,
          message:
            "Password must be at least 8 characters and include uppercase, lowercase, number, and special character",
        });
      }

      // Fetch user and verify current password
      const user = await storage.getUser(userId);
      if (!user || !user.passwordHash) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      const bcrypt = (await import("bcryptjs")).default;
      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: "Current password is incorrect" });
      }

      // Prevent reuse of the same password
      const sameAsOld = await bcrypt.compare(newPassword, user.passwordHash);
      if (sameAsOld) {
        return res.status(400).json({
          success: false,
          message: "New password must be different from current password",
        });
      }

      // Hash and save
      const passwordHash = await storage.hashPassword(newPassword);
      await storage.updateUser(user._id, {
        passwordHash,
        passwordChangedAt: new Date(),
        tokenVersion: (user.tokenVersion || 0) + 1, // optional: invalidate existing tokens if you check this in auth
        passwordResetToken: null,
        passwordResetExpires: null,
        updatedAt: new Date(),
      });

      // 📜 Log Audit Entry
      await auditLogger.logPasswordChange(user, req);

      return res.json({ success: true, message: "Password updated successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      return res.status(500).json({ success: false, message: "Failed to update password" });
    }
  },
  async verify(req, res) {
    try {
      res.json(req.user);
    } catch (error) {
      res.status(401).json({ message: "Invalid token" });
    }
  },

  async generateToken(req, res) {
    try {
      const { id, email, role, organizationId } = req.body;
      const jwt = await import("jsonwebtoken");
      const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
      const token = jwt.default.sign(
        { id, email, role, organizationId },
        JWT_SECRET,
        { expiresIn: "7d" }
      );
      res.json({ token });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate token" });
    }
  },

  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(400).json({
          message: "No account found with this email.",
        });
      }
      // Block password reset for unverified users
      if (!user.emailVerified) {
        return res.status(400).json({
          message:
            "Please verify your email before resetting your password. Check your inbox for the verification link.",
        });
      }
      const resetToken = storage.generatePasswordResetToken();
      const resetExpiry = new Date(Date.now() + 60000); //1 min
      await storage.updateUser(user._id, {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpiry,
      });
      await emailService.sendPasswordResetEmail(
        email,
        resetToken,
        user.firstName || user.lastName || "User"
      );

      // 📜 Log Audit Entry
      await auditLogger.logPasswordResetRequested(user, req);

      res.json({
        message: "Password reset link has been sent to your email.",
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to process password reset request" });
    }
  },

  async validateResetToken(req, res) {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ message: "Reset token is required" });
      }
      const user = await storage.getUserByResetToken(token);
      if (!user || user.passwordResetExpires < new Date()) {
        return res
          .status(400)
          .json({ message: "Invalid or expired reset token" });
      }
      res.json({ message: "Token is valid", userId: user._id });
    } catch (error) {
      res.status(500).json({ message: "Failed to validate reset token" });
    }
  },

  async resetPassword(req, res) {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res
          .status(400)
          .json({ message: "Token and password are required" });
      }
      const user = await storage.getUserByResetToken(token);
      if (!user || user.passwordResetExpires < new Date()) {
        return res
          .status(400)
          .json({ message: "Invalid or expired reset token" });
      }
      const passwordHash = await storage.hashPassword(password);
      await storage.updateUser(user._id, {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      });

      // 📜 Log Audit Entry
      await auditLogger.logPasswordResetSuccess(user, req);

      res.json({ message: "Password has been reset successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to reset password" });
    }
  },

  async verifyToken(req, res) {
    try {
      const { token, password } = req.body;

      // Token is always required
      if (!token) {
        return res.status(400).json({ message: "Token is required", valid: false });
      }

      const user = await storage.getUserByVerificationToken(token);
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired verification token", valid: false });
      }

      // Check if token is expired
      if (
        user.emailVerificationExpires &&
        new Date() > user.emailVerificationExpires
      ) {
        return res.status(400).json({ message: "Verification token has expired", valid: false, expired: true });
      }

      // If password is not provided, this is just a token validation request
      if (!password) {
        return res.json({
          message: "Token is valid",
          valid: true,
          token: true,  // For backward compatibility with frontend
          email: user.email,
          name: user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : null
        });
      }

      // Password provided - complete the verification
      const hashedPassword = await storage.hashPassword(password);
      await storage.updateUser(user._id, {
        passwordHash: hashedPassword,
        status: "active",
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      });

      res.json({
        message: "Email verified and password set successfully",
        success: true,
      });
    } catch (error) {
      console.error("verifyToken error:", error);
      res
        .status(500)
        .json({ message: "Verification failed. Please try again." });
    }
  }
  ,


  // ...existing code...

  async acceptInvite(req, res) {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({
          message: "Token and password are required",
        });
      }
      const result = await storage.completeUserInvitation(token, {

        password,
      });
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
      const authToken = storage.generateToken(result.user);
      res.json({
        message: "Account created successfully",
        token: authToken,
        user: {
          id: result.user._id,
          email: result.user.email,
          role: result.user.role,
          isPrimaryAdmin: result.user.isPrimaryAdmin || false,
        },
      });
    } catch (error) {
      console.error("Accept invite error:", error);
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  },

  async validateInvite(req, res) {
    try {
      const { token } = req.query;
      if (!token) {
        return res.status(400).json({ message: "Invitation token is required" });
      }
      const pendingUser = await storage.getUserByInviteToken(token);
      if (!pendingUser) {
        return res.status(404).json({ message: "Invalid or expired invitation token" });
      }
      if (
        pendingUser.inviteExpires &&
        new Date() > new Date(pendingUser.inviteExpires)
      ) {
        return res.status(400).json({ message: "Invitation token has expired" });
      }
      const orgId = pendingUser.organization_id || null;
      let organization = null;
      if (orgId) {
        try {
          organization = await storage.getOrganization(orgId);
        } catch (_) { }
        if (!organization) {
          try {
            const { Organization } = await import("../modals/organizationModal.js");
            organization = await Organization.findById(orgId).lean();
          } catch (_) { }
        }
      }
      res.json({
        email: pendingUser.email,
        role: pendingUser.role,
        organization: {
          id: orgId || null,
          name: organization?.name || "Unknown Organization",
          slug: organization?.slug || null,
        },
        organizationName: organization?.name || "Unknown Organization",
        invitedBy: pendingUser.invitedBy || null,
      });
    } catch (error) {
      console.error("Validate invite error:", error);
      res.status(500).json({ message: "Failed to validate invitation" });
    }
  },

  async validateInviteToken(req, res) {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ message: "Invitation token is required" });
      }
      const pendingUser = await storage.getUserByInviteToken(token);
      if (!pendingUser) {
        return res.status(404).json({ message: "Invalid or expired invitation token" });
      }
      if (
        pendingUser.inviteExpires &&
        new Date() > new Date(pendingUser.inviteExpires)
      ) {
        return res.status(400).json({ message: "Invitation token has expired" });
      }
      const orgId = pendingUser.organization_id || null;
      let organization = null;
      if (orgId) {
        try {
          organization = await storage.getOrganization(orgId);
        } catch (_) { }
        if (!organization) {
          try {
            const { Organization } = await import("../modals/organizationModal.js");
            organization = await Organization.findById(orgId).lean();
          } catch (_) { }
        }
      }
      res.json({
        email: pendingUser.email,
        roles: Array.isArray(pendingUser.roles)
          ? pendingUser.roles
          : pendingUser.role
            ? [pendingUser.role]
            : [],
        organization: {
          id: orgId || null,
          name: organization?.name || "Unknown Organization",
          slug: organization?.slug || null,
        },
        organizationName: organization?.name || "Unknown Organization",
        invitedBy: pendingUser.invitedBy || null,
      });
    } catch (error) {
      console.error("Validate invite token error:", error);
      res.status(500).json({ message: "Failed to validate invitation token" });
    }
  },

  // Resend invite without requiring admin login (for expired links)
  async resendInvitePublic(req, res) {
    try {
      const { token, email } = req.body || {};

      if (!token && !email) {
        return res.status(400).json({ message: "Provide token or email" });
      }

      // 🔍 Find invited user by token or email
      let invitedUser = token
        ? await storage.getUserByExactInviteToken(token)
        : null;

      if (!invitedUser && email) {
        invitedUser = await storage.getInvitedUserByEmail(email);
      }

      if (!invitedUser) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      if (invitedUser.status !== "invited") {
        return res.status(400).json({ message: "User is not in invited status" });
      }

      // 🔐 Generate new invite token (24 hours expiry)
      const newInviteToken = storage.generateEmailVerificationToken();
      const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await storage.updateUser(invitedUser._id, {
        inviteToken: newInviteToken,
        inviteTokenExpiry: newExpiry,
        invitedAt: new Date(),
      });

      // 📩 Get inviter info (the admin who sent the invite)
      const inviter = invitedUser.invitedBy
        ? await storage.getUser(invitedUser.invitedBy)
        : null;

      // 🏢 Get organization info (if any)
      const orgId = invitedUser.organization || invitedUser.organization_id;
      let organization = null;
      if (orgId) {
        try {
          organization = await storage.getOrganization(orgId);
        } catch (err) {
          console.warn("Organization fetch failed:", err.message);
        }
      }

      // 👤 Resolve invite display names
      const rolesToSend = Array.isArray(invitedUser.roles) && invitedUser.roles.length > 0
        ? invitedUser.roles
        : [invitedUser.role || "employee"];

      const nameToSend =
        invitedUser.firstName?.trim() ||
        invitedUser.name?.trim() ||
        invitedUser.fullName?.trim() ||
        (typeof invitedUser.email === "string" ? invitedUser.email.split("@")[0] : "");



      // ✉️ Send email
      try {
        await storage.sendInvitationEmail(
          invitedUser.email,
          newInviteToken,
          organization?.name || "Organization",
          rolesToSend,
          inviter?.email ||
          "Admin",
          nameToSend
        );
      } catch (err) {
        console.warn("Resend invite: email send failed:", err.message);
      }

      // ✅ Final response
      return res.json({
        message: "Invitation resent successfully",
        email: invitedUser.email,
        invitedByEmail: inviter?.email || null, // optional: useful for debugging
      });
    } catch (error) {
      console.error("Resend invite public error:", error);
      return res.status(500).json({ message: "Failed to resend invitation" });
    }
  }
  ,

  async completeInvitation(req, res) {
    try {
      const { token, firstName, password } = req.body;
      if (!token || !firstName || !password) {
        return res.status(400).json({
          message: "Token, first name and password are required",
        });
      }
      const result = await storage.completeUserInvitation(token, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password,
      });
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
      const authToken = storage.generateToken(result.user);
      res.json({
        message: "Account created successfully",
        token: authToken,
        user: {
          id: result.user._id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          role: result.user.role,
          organizationId: result.user.organizationId,
          isPrimaryAdmin: result.user.isPrimaryAdmin || false,
        },
      });
    } catch (error) {
      console.error("Complete invitation error:", error);
      res.status(500).json({ message: "Failed to complete invitation" });
    }
  },

  // ...existing code...

  async registerIndividual(req, res) {
    try {
      const { firstName, lastName, email, timezone } = req.body;

      if (!firstName || !email) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        if (
          existingUser.status === "pending" ||
          existingUser.status === "invited" ||
          !existingUser.emailVerified
        ) {
          const verificationToken = storage.generateEmailVerificationToken();
          await storage.updateUser(existingUser._id, {
            emailVerificationToken: verificationToken,
            emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          });
          await emailService.sendVerificationEmail(
            email,
            verificationToken,
            firstName,
            null
          );
          return res.status(200).json({
            message: "We've re-sent your verification link.",
            resent: true,
          });
        }
        return res.status(400).json({
          message: "This email is already registered. Please Login or Reset Password.",
        });
      }

      const userData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase().trim(),
        role: "individual",
        status: "pending",
        accountType: "individual",
        timezone: timezone || 'Asia/Kolkata',
      };

      const user = await storage.createUser(userData);

      const verificationToken = storage.generateEmailVerificationToken();
      await storage.updateUser(user._id, {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });

      await emailService.sendVerificationEmail(
        email,
        verificationToken,
        firstName,
        null
      );

      res.status(201).json({
        message: "Registration successful. Please check your email for verification.",
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });
    } catch (error) {
      console.error("Individual registration error:", error);
      res.status(500).json({ message: "Registration failed. Please try again." });
    }
  },

  async registerOrganization(req, res) {
    try {
      const { firstName, lastName, email, organizationName, numberOfEmployees, isPrimaryAdmin, timezone } = req.body;

      if (!firstName || !email || !organizationName) {
        return res.status(400).json({ message: "All fields are required" });
      }

      if (
        organizationName.trim().length < 2 ||
        organizationName.trim().length > 100
      ) {
        return res
          .status(400)
          .json({ message: "Organization name must be 2-100 characters" });
      }

      // Validate numberOfEmployees if provided
      if (numberOfEmployees !== undefined && numberOfEmployees !== null && numberOfEmployees !== '') {
        const empCount = parseInt(numberOfEmployees);
        if (isNaN(empCount) || empCount < 1) {
          return res.status(400).json({ message: "Number of employees must be a positive integer" });
        }
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        if (
          existingUser.status === "pending" ||
          existingUser.status === "invited" ||
          !existingUser.emailVerified
        ) {
          const verificationToken = storage.generateEmailVerificationToken();
          await storage.updateUser(existingUser._id, {
            emailVerificationToken: verificationToken,
            emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          });
          await emailService.sendVerificationEmail(
            email,
            verificationToken,
            firstName,
            organizationName
          );
          return res.status(200).json({
            message: "We've re-sent your verification link.",
            resent: true,
          });
        }
        return res.status(400).json({
          message: "This email is already registered. Please Login or Reset Password.",
        });
      }

      // Generate base slug from org name
      const baseSlug = organizationName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim() || "org";

      // Ensure slug uniqueness by appending an incrementing suffix
      let uniqueSlug = baseSlug;
      let counter = 1;
      // Note: first duplicate will become baseSlug-2
      while (await storage.getOrganizationBySlug(uniqueSlug)) {
        counter += 1;
        uniqueSlug = `${baseSlug}-${counter}`;
      }

      const orgData = {
        name: organizationName.trim(),
        slug: uniqueSlug,
        licenseCount: 10,
        isActive: true,
      };

      // Add numberOfEmployees if provided
      if (numberOfEmployees !== undefined && numberOfEmployees !== null && numberOfEmployees !== '') {
        orgData.numberOfEmployees = parseInt(numberOfEmployees);
      }

      const organization = await storage.createOrganization(orgData);

      const userData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase().trim(),
        role: ["org_admin"],
        status: "pending",
        organization_id: organization._id,
        accountType: "organization",
        isPrimaryAdmin: isPrimaryAdmin === true,
        timezone: timezone || 'Asia/Kolkata',
        // 🆕 Primary Admin gets EXPLORE (trial) license by default
        ...(isPrimaryAdmin === true && {
          license_code: 'EXPLORE',
          assigned_license: {
            license_code: 'EXPLORE',
            purchase_id: null, // Primary admin trial - no pool instance required
            assigned_date: new Date(),
          },
          seat_assigned: true,
        }),
      };

      const user = await storage.createUser(userData);
      console.log(`✅ Created user ${user.email} with isPrimaryAdmin: ${user.isPrimaryAdmin}, license: ${user.license_code || 'none'}`);

      const verificationToken = storage.generateEmailVerificationToken();
      await storage.updateUser(user._id, {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });

      await emailService.sendVerificationEmail(
        email,
        verificationToken,
        firstName,
        organizationName
      );

      // 🔔 Notify super admins about new organization registration
      try {
        await superAdminNotification.notifyNewOrganization({
          name: organization.name,
          adminName: `${firstName.trim()} ${lastName.trim()}`,
          adminEmail: email.toLowerCase().trim()
        });
      } catch (notifError) {
        console.error('⚠️ Failed to notify super admins about organization registration:', notifError);
        // Don't fail the registration if notification fails
      }

      res.status(201).json({
        message: "Organization registration successful. Please check your email for verification.",
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          organization: organization._id,
          organizationName: organization.name,
          isPrimaryAdmin: user.isPrimaryAdmin || false,
        },
      });
    } catch (error) {
      console.error("Organization registration error:", error);
      res.status(500).json({ message: "Registration failed. Please try again." });
    }
  },
  /**
   * Resend Email Verification Link
   * Endpoint: POST /api/auth/resend-verification
   */
  async resendVerificationLink(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email.toLowerCase().trim());
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.emailVerified) {
        return res.status(400).json({
          message: "This email is already verified. Please log in instead.",
        });
      }

      if (
        user.lastVerificationSent &&
        new Date() - new Date(user.lastVerificationSent) < 60 * 1000
      ) {
        return res.status(429).json({
          message: "Please wait a minute before requesting another link.",
        });
      }

      const verificationToken = storage.generateEmailVerificationToken();

      await storage.updateUser(user._id, {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        lastVerificationSent: new Date(),
      });

      // Derive org name on the server (do not trust client input)
      let organizationName = null;
      const orgId = user.organization_id || user.organizationId;
      if (orgId) {
        try {
          const org = await storage.getOrganization(orgId);
          organizationName = org?.name || null;
        } catch (_) { }
      }

      await emailService.sendVerificationEmail(
        user.email,
        verificationToken,
        user.firstName || "User",
        organizationName
      );

      return res.status(200).json({
        message: "A new verification link has been sent to your email.",
        resent: true,
      });
    } catch (error) {
      console.error("Resend verification link error:", error);
      return res.status(500).json({
        message: "Failed to resend verification link. Please try again.",
      });
    }
  }
  ,
  async getCurrentUser(req, res) {
    try {
      // The user data is already attached to req by the authenticateToken middleware
      const user = req.user;

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      // Return user data
      res.json({
        success: true,
        data: {
          _id: user._id,
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          phone: user.phone || "",
          phoneVerified: user.phoneVerified || false,
          role: user.role,
          organizationId: user.organizationId,
          isPrimaryAdmin: user.isPrimaryAdmin || false,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      });
    } catch (error) {
      console.error("Get current user error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get current user"
      });
    }
  },

  /**
 * Get list of potential collaborators for approval tasks
 * Collaborators are users who can view and comment but cannot approve/reject
 */
  async getCollaboratorsList(req, res) {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized - user not authenticated"
        });
      }

      let collaborators = [];

      // For individual users - no collaborators available
      if (user.role.includes('individual')) {
        return res.json({
          success: true,
          data: [],
          message: "Individual users cannot add collaborators"
        });
      }

      // For organization users - get users from same organization
      if (user.organizationId) {
        const { User } = await import("../modals/userModal.js");

        collaborators = await User.find({
          organization_id: user.organizationId,
          status: "active",
          _id: { $ne: user.id } // Exclude current user
        })
          .select('_id firstName lastName email role department designation')
          .lean();

        // Format collaborators data
        collaborators = collaborators.map(collab => ({
          id: collab._id,
          name: `${collab.firstName} ${collab.lastName}`.trim(),
          email: collab.email,
          role: Array.isArray(collab.role) ? collab.role : [collab.role],
          department: collab.department || '',
          designation: collab.designation || '',
          avatar: null // Add avatar logic if needed
        }));
      }

      res.json({
        success: true,
        data: collaborators,
        count: collaborators.length
      });

    } catch (error) {
      console.error("Get collaborators list error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get collaborators list"
      });
    }
  },

  /**
   * Get list of potential approvers for approval tasks
   * Approvers are users who can make approve/reject decisions
   * Based on role hierarchy and organization structure
   */
  async getApproversList(req, res) {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized - user not authenticated"
        });
      }

      let approvers = [];

      // For individual users - no approvers available
      if (user.role.includes('individual')) {
        return res.json({
          success: true,
          data: [],
          message: "Individual users cannot create approval tasks"
        });
      }

      // For organization users - get eligible approvers
      if (user.organizationId) {
        const { User } = await import("../modals/userModal.js");

        // Get users from same organization with specific roles
        const eligibleUsers = await User.find({
          organization_id: user.organizationId,
          status: "active",
          _id: { $ne: user.id }, // Exclude current user by default
          role: {
            $in: ['org_admin', 'manager', 'employee'] // Eligible approver roles
          }
        })
          .select('_id firstName lastName email role department designation isPrimaryAdmin')
          .lean();

        // Filter and format approvers based on business logic
        approvers = eligibleUsers
          .filter(approver => {
            const approverRoles = Array.isArray(approver.role) ? approver.role : [approver.role];

            // Include org_admin, managers, and employees
            if (
              approverRoles.includes('org_admin') ||
              approverRoles.includes('manager') ||
              approverRoles.includes('employee')
            ) {
              return true;
            }

            return false;
          })
          .map(approver => ({
            id: approver._id,
            name: `${approver.firstName} ${approver.lastName}`.trim(),
            email: approver.email,
            role: Array.isArray(approver.role) ? approver.role : [approver.role],
            department: approver.department || '',
            designation: approver.designation || '',
            isPrimaryAdmin: approver.isPrimaryAdmin || false,
            canApprove: true,
            avatar: null // Add avatar logic if needed
          }));

        // Option to include self as approver (if creator wants to be in approval chain)
        const selfApprover = {
          id: user.id,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'You',
          email: user.email,
          role: user.role,
          department: '',
          designation: '',
          isPrimaryAdmin: false,
          canApprove: true,
          isSelf: true,
          avatar: null
        };

        approvers.unshift(selfApprover); // Add self at beginning
      }

      // Sort approvers by role hierarchy (org_admin first, then manager, then employee)
      approvers.sort((a, b) => {
        const getRolePriority = (roles) => {
          if (roles.includes('org_admin')) return 3;
          if (roles.includes('manager')) return 2;
          if (roles.includes('employee')) return 1;
          return 0;
        };

        return getRolePriority(b.role) - getRolePriority(a.role);
      });

      res.json({
        success: true,
        data: approvers,
        count: approvers.length,
        hierarchy: {
          org_admin: approvers.filter(a => a.role.includes('org_admin')).length,
          manager: approvers.filter(a => a.role.includes('manager')).length,
          employee: approvers.filter(a => a.role.includes('employee')).length
        }
      });

    } catch (error) {
      console.error("Get approvers list error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get approvers list"
      });
    }
  },

  /**
   * Get list of all active users in the organization
   * Accessible by all authenticated organization users
   */
  async getUsersList(req, res) {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized - user not authenticated"
        });
      }

      // For individual users - no organization users available
      if (user.role.includes('individual')) {
        return res.json({
          success: true,
          data: [],
          count: 0,
          message: "Individual users do not have organization users"
        });
      }

      let usersList = [];

      if (user.organizationId) {
        const { User } = await import("../modals/userModal.js");

        const orgUsers = await User.find({
          organization_id: user.organizationId,
          status: "active"
        })
          .select('_id firstName lastName email role department designation isPrimaryAdmin avatar')
          .lean();

        usersList = orgUsers.map(u => ({
          id: u._id,
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
          email: u.email,
          role: Array.isArray(u.role) ? u.role : [u.role],
          department: u.department || '',
          designation: u.designation || '',
          isPrimaryAdmin: u.isPrimaryAdmin || false,
          avatar: u.avatar || null,
          isSelf: u._id.toString() === user.id.toString()
        }));

        // Sort users by role priority (org_admin first, then manager, then employee) and then alphabetically by name
        usersList.sort((a, b) => {
          const getRolePriority = (roles) => {
            if (roles.includes('org_admin')) return 3;
            if (roles.includes('manager')) return 2;
            if (roles.includes('employee')) return 1;
            return 0;
          };

          const roleDiff = getRolePriority(b.role) - getRolePriority(a.role);
          if (roleDiff !== 0) return roleDiff;
          return a.name.localeCompare(b.name);
        });
      }

      res.json({
        success: true,
        data: usersList,
        count: usersList.length,
        hierarchy: {
          org_admin: usersList.filter(u => u.role.includes('org_admin')).length,
          manager: usersList.filter(u => u.role.includes('manager')).length,
          employee: usersList.filter(u => u.role.includes('employee')).length
        }
      });
    } catch (error) {
      console.error("Get users list error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get users list"
      });
    }
  },

  async verifySuperAdmin(req, res) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ 
          message: "Verification token is required",
          valid: false 
        });
      }

      // Find user by verification token
      const user = await storage.getUserByVerificationToken(token);
      
      if (!user) {
        return res.status(400).json({ 
          message: "Invalid or expired verification token",
          valid: false 
        });
      }

      // Check if user is a super admin (role is an array)
      const isSuperAdmin = Array.isArray(user.role) 
        ? user.role.includes("super_admin") 
        : user.role === "super_admin";
      
      if (!isSuperAdmin) {
        return res.status(403).json({ 
          message: "This verification link is only for super admin accounts",
          valid: false 
        });
      }

      // Check if token is expired
      if (user.emailVerificationExpires && new Date() > user.emailVerificationExpires) {
        return res.status(400).json({ 
          message: "Verification token has expired. Please request a new verification link.",
          valid: false,
          expired: true 
        });
      }

      // Verify and activate the super admin account
      await storage.updateUser(user._id, {
        status: "active",
        isActive: true,
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      });

      console.log(`✅ Super admin verified and activated: ${user.email}`);

      res.json({
        message: "Super admin account verified and activated successfully",
        success: true,
        user: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          status: "active"
        }
      });
    } catch (error) {
      console.error("❌ Super admin verification error:", error);
      res.status(500).json({ 
        message: "Verification failed. Please try again.",
        error: error.message 
      });
    }
  },

  // ...existing code...
};