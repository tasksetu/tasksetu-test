import dotenv from "dotenv";
dotenv.config();
import { TimezoneHelper } from "../utils/timezoneHelper.js";
import {
  renderDailyDigestEmail,
  renderCriticalOverdueEmail,
  renderTaskAssignmentEmail,
  renderApprovalRequiredEmail,
  renderTaskChangeRequestEmail,
  renderTaskChangeDecisionEmail,
  renderTasksDueTodayEmail,
  renderGenericNotificationEmail,
  renderNotificationDigestEmail,
  renderMissedTaskEmail,
  renderLicenseExpiryEmail
} from "./emailTemplates/index.js";

class EmailService {
  constructor() {
    this.resendApiKey = null;
    this.fromEmail = "Tasksetu <notifications@tasksetu.app>";
    const isLocal =
      typeof window !== "undefined"
        ? window.location.hostname === "localhost"
        : process.env.NODE_ENV === "development";

    this.baseUrl = isLocal
      ? process.env.LOCAL_BASE_URL || "http://localhost:5000"
      : process.env.PRODUCTION_BASE_URL || "http://localhost:5000";

    // ✅ FIX: Eagerly initialize from env on startup (no more lazy isConfigured=false)
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey && apiKey.trim()) {
      this.resendApiKey = apiKey.trim();
      this.isConfigured = true;
      console.log(`📡 [EmailService] Resend API configured at startup ✅`);
    } else {
      this.isConfigured = false;
      console.warn(`📡 [EmailService] RESEND_API_KEY not found in env at startup — emails will not send`);
    }
  }

  /**
   * ✅ Check and initialize Resend API configuration
   * Re-reads env in case RESEND_API_KEY was set after module load
   */
  async checkConfiguration() {
    // Re-read env every time in case it changed
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey || !apiKey.trim()) {
      console.warn(
        "📡 [EmailService] RESEND_API_KEY missing in process.env. Check your .env file.",
      );
      this.isConfigured = false;
      this.resendApiKey = null;
      return false;
    }

    try {
      this.resendApiKey = apiKey.trim();
      this.isConfigured = true;
      return true;
    } catch (error) {
      console.error(
        "📡 [EmailService] Resend API Configuration Failed:",
        error.message,
      );
      this.isConfigured = false;
      this.resendApiKey = null;
      return false;
    }
  }

  /**
   * Generic email sending function for custom emails using Resend API
   */
  async sendEmail({ to, subject, html, text, from, attachments }) {
    await this.checkConfiguration();

    if (!this.isConfigured) {
      console.error(
        "[Email] Cannot send email - service not configured correctly",
      );
      return false;
    }

    try {
      if (!to || !subject) {
        console.error("[Email] Missing required fields: to, subject");
        return false;
      }

      const emailData = {
        from: from || this.fromEmail,
        to: Array.isArray(to) ? to : [to],
        subject,
        html: html || text,
        text: text || "Email notification from TaskSetu",
      };

      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        emailData.attachments = attachments;
      }

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailData),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error(`[Email] ❌ Resend API error:`, result);
        return {
          success: false,
          error: result.message || "Failed to send email",
        };
      }

      console.log(`[Email] ✅ Email sent successfully to ${to}`, {
        messageId: result.id,
        subject: subject,
      });
      return { success: true, messageId: result.id };
    } catch (error) {
      console.error(`[Email] ❌ Error sending email to ${to}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async sendVerificationEmail(
    email,
    verificationCode,
    firstName,
    organizationName = null,
  ) {
    if (!this.isConfigured) {
      await this.checkConfiguration();
    }

    if (!this.isConfigured) {
      console.error(
        "[Email] Email service not configured - RESEND_API_KEY missing",
      );
      return false;
    }

    try {
      // Determine if this is organization registration
      const isOrganization =
        organizationName !== null && organizationName !== undefined;
      const url = isOrganization
        ? `${this.baseUrl}/verify?token=${verificationCode}&name=${firstName}&email=${email}&org=${encodeURIComponent(organizationName)}`
        : `${this.baseUrl}/verify?token=${verificationCode}&name=${firstName}&email=${email}`;

      const subject = isOrganization
        ? "✅ Verify Your Organization's Account on Tasksetu"
        : "✅ Complete Your Tasksetu Registration";

      const html = isOrganization
        ? `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Organization Account Verification</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { background: #10B981; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; }
              .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to TaskSetu!</h1>
              </div>
              <div class="content">
                <h2>Hi ${firstName},</h2>
                <p>Thank you for registering your organization, <strong>${organizationName}</strong>, with Tasksetu.</p>
                <p>To complete the setup and define your password, click below:</p>
                
                <div style="text-align: center; margin: 30px 0;color:white">
                  <a
                    style="color:#ffffff !important; text-decoration:none !important;"
                    href="${url}"
                    class="button"
                  >
                    Verify & Set Password
                  </a>
                </div>
                
                <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10B981;">
                  <p style="margin: 0; color: #166534; font-size: 14px;"><strong>Can't click the button?</strong> Copy and paste this URL into your browser:</p>
                  <p style="margin: 5px 0 0 0; color: #166534; font-size: 14px; word-break: break-all;">${url}</p>
                </div>
                
                <p>Once verified, you can invite your team, configure access levels, and start collaborating.</p>
                <p><strong>Let's make teamwork easier!</strong></p>
                
                <p><strong>— Tasksetu Team</strong><br>
                <a href="https://www.Tasksetu.com" style="color: inherit;">www.Tasksetu.com</a></p>
              </div>
              <div class="footer">
                <p>This is an automated message. Please do not reply to this email.</p>
              </div>
            </div>
          </body>
          </html>
        `
        : `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email Verification</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #3B82F6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { background: #3B82F6; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; }
              .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to TaskSetu!</h1>
              </div>
              <div class="content">
                <h2>Hi ${firstName},</h2>
                <p>Thanks for signing up with Tasksetu!</p>
                <p>To activate your account and set your password, please click the link below:</p>
                
                <div style="text-align: center; margin: 30px 0;color:#fff">
                  <a
                    style="color:#ffffff !important; text-decoration:none !important;"
                    href="${url}"
                    class="button"
                  >
                    👉 Verify Email & Set My Password
                  </a>
                </div>
                
                <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3B82F6;">
                  <p style="margin: 0; color: #4a5568; font-size: 14px;"><strong>Can't click the button?</strong> Copy and paste this URL into your browser:</p>
                  <p style="margin: 5px 0 0 0; color: #4a5568; font-size: 14px; word-break: break-all;">${url}</p>
                </div>
                
                <p>This link is <strong style="color: #e53e3e;">valid for 24 hours</strong>.</p>
                <p>Once verified, you'll be able to start managing your tasks and deadlines with ease.</p>
                <p>See you enrolled in!</p>
                
                <p><strong>— The Tasksetu Team</strong><br>
                <a href="https://www.tasksetu.com" style="color: inherit;">www.Tasksetu.com</a></p>
              </div>
              <div class="footer">
                <p>This is an automated message. Please do not reply to this email.</p>
              </div>
            </div>
          </body>
          </html>
        `;

      const text = `Hi ${firstName},

Thanks for signing up with Tasksetu!

To activate your account and set your password, please click the link below:
👉 Verify Email & Set My Password: ${url}

(or copy and paste this URL into your browser: ${url})

This link is valid for 24 hours.

Once verified, you'll be able to start managing your tasks and deadlines with ease.

See you enrolled in!

— The Tasksetu Team
www.Tasksetu.com`;

      const emailData = {
        from: this.fromEmail,
        to: [email],
        subject,
        html,
        text,
      };

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailData),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error(`[Email] ❌ Resend API error:`, result);
        return {
          success: false,
          error: result.message || "Failed to send email",
        };
      }

      console.log("Verification email sent successfully to:", email);
      return { success: true, messageId: result.id };
    } catch (error) {
      console.error("Email sending error:", error);
      return { success: false, error: error.message };
    }
  }

  async sendPasswordResetEmail(email, resetToken, firstName) {
    console.log("Email template using firstName:", firstName);
    if (!this.isConfigured) {
      await this.checkConfiguration();
    }

    if (!this.isConfigured) {
      console.error(
        "[Email] Email service not configured - RESEND_API_KEY missing",
      );
      return false;
    }

    try {
      const resetUrl = `${this.baseUrl}/reset-password?token=${resetToken}`;

      const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Reset</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #EF4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #EF4444; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Password Reset Request</h1>
              </div>
              <div class="content">
                <h2>Hi ${firstName}!</h2>
                <p>We received a request to reset your password for your TaskSetu account.</p>
                
                <p>Click the button below to reset your password:</p>
                <a href="${resetUrl}" class="button" style="color:#ffffff !important; text-decoration:none !important;">Reset Password</a>
                
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #666;">${resetUrl}</p>
                
                <p>This link will expire in 24 hours for security reasons.</p>
                
                <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
                
                <p>Best regards,<br>The TaskSetu Team</p>
              </div>
              <div class="footer">
                <p>This is an automated message. Please do not reply to this email.</p>
              </div>
            </div>
          </body>
          </html>
        `;

      const text = `Hi ${firstName}!\n\nWe received a request to reset your password for your TaskSetu account.\n\nClick this link to reset your password: ${resetUrl}\n\nThis link will expire in 24 hours for security reasons.\n\nIf you didn't request a password reset, please ignore this email.\n\nBest regards,\nThe TaskSetu Team`;

      const emailData = {
        from: this.fromEmail,
        to: [email],
        subject: "Reset Your Password - TaskSetu",
        html,
        text,
      };

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailData),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error(`[Email] ❌ Resend API error:`, result);
        return {
          success: false,
          error: result.message || "Failed to send email",
        };
      }

      console.log("Password reset email sent successfully to:", email);
      return { success: true, messageId: result.id };
    } catch (error) {
      console.error("Email sending error:", error.message);
      return { success: false, error: error.message };
    }
  }

  async sendSuperAdminVerificationEmail(email, verificationToken, firstName) {
    if (!this.isConfigured) {
      await this.checkConfiguration();
    }

    if (!this.isConfigured) {
      console.error("Email service not configured - RESEND_API_KEY missing");
      return false;
    }

    try {
      const verifyUrl = `${this.baseUrl}/verify-super-admin?token=${verificationToken}&email=${encodeURIComponent(email)}`;

      const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Super Admin Verification</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { background: #DC2626; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; }
              .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
              .badge { background: #FEE2E2; color: #991B1B; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; font-size: 28px;">🔐 Super Admin Access</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">TaskSetu Platform Administration</p>
              </div>
              <div class="content">
                <h2>Hi ${firstName},</h2>
                <p>You have been granted <span class="badge">SUPER ADMIN</span> access to the TaskSetu platform.</p>
                
                <p>This role provides you with complete platform-wide access and administrative capabilities across all organizations.</p>
                
                <p><strong>Please verify your email address to activate your account:</strong></p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a
                    style="color:#ffffff !important; text-decoration:none !important;"
                    href="${verifyUrl}"
                    class="button"
                  >
                    ✅ Verify Email & Activate Account
                  </a>
                </div>
                
                <div style="background: #FEF3C7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #F59E0B;">
                  <p style="margin: 0; color: #92400E; font-size: 14px;"><strong>⚠️ Can't click the button?</strong> Copy and paste this URL into your browser:</p>
                  <p style="margin: 5px 0 0 0; color: #92400E; font-size: 14px; word-break: break-all;">${verifyUrl}</p>
                </div>
                
                <div style="background: #FEE2E2; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0; color: #991B1B; font-size: 13px;">
                    <strong>🔒 Security Notice:</strong> This verification link expires in 24 hours. 
                    Super admin access should only be granted to trusted personnel.
                  </p>
                </div>
                
                <p>Once verified, your account status will change to <strong>Active</strong> and you'll have full platform access.</p>
                
                <p><strong>— The TaskSetu Team</strong><br>
                <a href="https://www.tasksetu.com" style="color: inherit;">www.tasksetu.com</a></p>
              </div>
              <div class="footer">
                <p>This is an automated message. Please do not reply to this email.</p>
                <p>If you didn't request super admin access, please contact support immediately.</p>
              </div>
            </div>
          </body>
          </html>
        `;

      const text = `Hi ${firstName},

You have been granted SUPER ADMIN access to the TaskSetu platform.

This role provides you with complete platform-wide access and administrative capabilities across all organizations.

Please verify your email address to activate your account:
${verifyUrl}

⚠️ Security Notice: This verification link expires in 24 hours. Super admin access should only be granted to trusted personnel.

Once verified, your account status will change to Active and you'll have full platform access.

— The TaskSetu Team
www.tasksetu.com

If you didn't request super admin access, please contact support immediately.`;

      const emailData = {
        from: this.fromEmail,
        to: [email],
        subject: "🔐 Verify Your Super Admin Account - TaskSetu",
        html,
        text,
      };

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailData),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error(`[Email] ❌ Resend API error:`, result);
        return {
          success: false,
          error: result.message || "Failed to send email",
        };
      }

      console.log(
        "✅ Super admin verification email sent successfully to:",
        email,
      );
      return { success: true, messageId: result.id };
    } catch (error) {
      console.error(
        "❌ Error sending super admin verification email:",
        error.message,
      );
      return { success: false, error: error.message };
    }
  }

  async sendInvitationEmail(
    email,
    inviteToken,
    organizationName,
    roles,
    invitedByName,
    name = "",
  ) {
    if (!this.isConfigured) {
      await this.checkConfiguration();
    }

    if (!this.isConfigured) {
      console.error(
        "[Email] Email service not configured - SMTP credentials missing",
      );
      return false;
    }

    try {
      const inviteUrl = `${this.baseUrl}/accept-invite?token=${inviteToken}`;

      // Compute a friendly roles display string
      const rolesDisplay = (() => {
        const list = Array.isArray(roles) ? roles : roles ? [roles] : [];
        const roleMap = {
          org_admin: "Organization Admin",
          admin: "Company Admin",
          employee: "Employee",
          manager: "Manager",
          individual: "Individual",
          member: "Member",
        };
        const pretty = list
          .map(
            (r) =>
              roleMap[r] ||
              String(r)
                .replace(/_/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase()),
          )
          .filter(Boolean);
        return pretty.length ? pretty.join(", ") : "Member";
      })();

      const recipientName =
        name || (typeof email === "string" ? email.split("@")[0] : "there");

      const subject = `You're invited to join ${organizationName} - TaskSetu`;
      const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Team Invitation</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #10B981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Team Invitation</h1>
              </div>
              <div class="content">
                <h2>You're invited to join ${organizationName}!</h2>
                <p>Hi ${recipientName},</p>
                <p><strong>${invitedByName}</strong> has invited you to join their team on TaskSetu.</p>
                
              <p>You'll be joining as: <strong>${rolesDisplay}</strong></p>
                <p>Click the button below to accept the invitation and create your account:</p>
                <a href="${inviteUrl}" class="button" style="color:#ffffff !important; text-decoration:none !important;">Accept Invitation</a>
                
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #666;">${inviteUrl}</p>
                
                <p>This invitation will expire in 7 days.</p>
                
                <p>If you don't want to join this team, you can safely ignore this email.</p>
                
                <p>Welcome to TaskSetu!<br>The TaskSetu Team</p>
              </div>
              <div class="footer">
                <p>This is an automated message. Please do not reply to this email.</p>
              </div>
            </div>
          </body>
          </html>
        `;

      const text = `You're invited to join ${organizationName}!\n\nHi ${recipientName},\n\n${invitedByName} has invited you to join their team on TaskSetu.\n\nYou'll be joining as: ${rolesDisplay}\n\nClick this link to accept the invitation: ${inviteUrl}\n\nThis invitation will expire in 7 days.\n\nWelcome to TaskSetu!\nThe TaskSetu Team`;

      const emailData = {
        from: this.fromEmail,
        to: [email],
        subject,
        html,
        text,
      };

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailData),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error(`[Email] ❌ Resend API error:`, result);
        return {
          success: false,
          error: result.message || "Failed to send email",
        };
      }

      console.log(`[Email] ✅ Invitation email sent successfully to ${email}`);
      return { success: true, messageId: result.id };
    } catch (error) {
      console.error("Email sending error:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send form share notification email
   * @param {Object} params - Email parameters
   * @param {string} params.recipientEmail - Email of user receiving access
   * @param {string} params.recipientName - Name of user receiving access
   * @param {string} params.formTitle - Title of the shared form
   * @param {string} params.formId - ID of the shared form
   * @param {string} params.role - Role assigned (VIEWER/EDITOR)
   * @param {string} params.sharedByName - Name of person sharing the form
   * @param {string} params.sharedByEmail - Email of person sharing the form
   */
  async sendFormShareNotification({
    recipientEmail,
    recipientName,
    formTitle,
    formId,
    role,
    sharedByName,
    sharedByEmail,
    externalToken,
  }) {
    if (!this.isConfigured) {
      await this.checkConfiguration();
    }

    if (!this.isConfigured) {
      console.error(
        "[Email] Email service not configured - RESEND_API_KEY missing",
      );
      return false;
    }

    try {
      console.log("📧 Preparing form share email with params:", {
        recipientEmail,
        recipientName,
        formTitle,
        formId,
        role,
        sharedByName,
        sharedByEmail,
        externalToken,
      });

      // VIEWER gets public link, EDITOR gets form-builder edit link
      const formUrl =
        role === "VIEWER" && externalToken
          ? `${this.baseUrl}/forms/public/${externalToken}`
          : `${this.baseUrl}/form-builder?edit=${formId}`;
      console.log("🔗 Form URL:", formUrl);
      console.log(
        "🔗 Role:",
        role,
        "| Using public link:",
        role === "VIEWER" && externalToken,
      );

      const roleText =
        role === "EDITOR" ? "Editor (Can Edit)" : "Viewer (Read Only)";
      const roleColor = role === "EDITOR" ? "#3B82F6" : "#10B981";
      const buttonText =
        role === "EDITOR" ? "Edit Form in TaskSetu" : "View Form";
      const permissions =
        role === "EDITOR"
          ? `
          <li>✅ View the form</li>
          <li>✅ Edit form fields and settings</li>
          <li>✅ View submissions</li>
          <li>❌ Cannot publish or delete the form</li>
        `
          : `
          <li>✅ View the form</li>
          <li>✅ View submissions (in TaskSetu)</li>
          <li>✅ Submit form responses</li>
          <li>❌ Cannot edit or modify the form</li>
        `;

      const subject =
        role === "EDITOR"
          ? `✏️ ${sharedByName} invited you to EDIT "${formTitle}" on TaskSetu`
          : `👁️ ${sharedByName} shared "${formTitle}" with you on TaskSetu`;
      const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Form Shared With You</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 0 auto; background: white; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
              .header h1 { margin: 0; font-size: 24px; }
              .content { padding: 30px; }
              .form-card { background: #f9fafb; border-left: 4px solid ${roleColor}; padding: 20px; margin: 20px 0; border-radius: 8px; }
              .form-title { font-size: 20px; font-weight: bold; color: #1f2937; margin-bottom: 10px; }
              .role-badge { display: inline-block; background: ${roleColor}; color: white; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-top: 10px; }
              .permissions { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb; }
              .permissions h3 { margin-top: 0; color: #1f2937; }
              .permissions ul { list-style: none; padding-left: 0; margin: 0; }
              .permissions li { padding: 8px 0; }
              .button { background: ${roleColor}; color: white !important; padding: 14px 28px; text-decoration: none !important; border-radius: 8px; display: inline-block; font-weight: 600; margin: 20px 0; }
              .button:hover { opacity: 0.9; }
              .shared-by { color: #6b7280; font-size: 14px; margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb; }
              .footer { text-align: center; color: #6b7280; font-size: 12px; padding: 20px; background: #f9fafb; }
              .footer a { color: #667eea; text-decoration: none; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📋 Form Shared With You</h1>
              </div>
              
              <div class="content">
                <p>Hi ${recipientName},</p>
                <p><strong>${sharedByName}</strong> has shared a form with you on TaskSetu.</p>
                
                <div class="form-card">
                  <div class="form-title">${formTitle}</div>
                  <span class="role-badge">Your Role: ${roleText}</span>
                  <div class="shared-by">
                    Shared by: ${sharedByName} (${sharedByEmail})
                  </div>
                </div>

                <div class="permissions">
                  <h3>What you can do:</h3>
                  <ul>
                    ${permissions}
                  </ul>
                </div>

                <div style="text-align: center;">
                  <a href="${formUrl}" class="button" style="color: white !important; text-decoration: none !important;">
                    ${buttonText}
                  </a>
                </div>

                <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                  💡 <strong>Tip:</strong> ${
                    role === "EDITOR"
                      ? "Log in to your TaskSetu account to access this form and start editing it."
                      : "You can view and submit this form directly using the link above, or log in to TaskSetu to see all submissions."
                  }
                </p>
              </div>

              <div class="footer">
                <p>This is an automated notification from TaskSetu.</p>
                <p>
                  <a href="${this.baseUrl}">Visit TaskSetu</a> | 
                  <a href="${this.baseUrl}/help">Help Center</a>
                </p>
                <p style="margin-top: 15px; color: #9ca3af;">
                  © ${new Date().getFullYear()} TaskSetu. All rights reserved.
                </p>
              </div>
            </div>
          </body>
          </html>
        `;

      const text = `
Hi ${recipientName},

${sharedByName} has shared a form with you on TaskSetu.

Form: ${formTitle}
Your Role: ${roleText}
Shared by: ${sharedByName} (${sharedByEmail})

View the form here: ${formUrl}

Tip: Log in to your TaskSetu account to access this form and start using it.

© ${new Date().getFullYear()} TaskSetu. All rights reserved.
        `;

      const emailData = {
        from: this.fromEmail,
        to: [recipientEmail],
        subject,
        html,
        text,
      };

      console.log("📧 Sending email to:", recipientEmail);
      console.log("📧 Email subject:", subject);

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailData),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error(`[Email] ❌ Resend API error:`, result);
        return {
          success: false,
          error: result.message || "Failed to send email",
        };
      }

      console.log(
        `✅ Form share notification sent to ${recipientEmail}:`,
        result.id,
      );
      return { success: true, messageId: result.id };
    } catch (error) {
      console.error("❌ Error sending form share notification:", error);
      return { success: false, error: error.message };
    }
  }

  isEmailServiceAvailable() {
    if (!this.isConfigured) {
      this.checkConfiguration();
    }
    return this.isConfigured;
  }

  // Test email function for debugging
  async sendTestEmail(recipientEmail) {
    if (!this.isConfigured) {
      await this.checkConfiguration();
    }

    if (!this.isConfigured) {
      console.error("Email service not configured - RESEND_API_KEY missing");
      return false;
    }

    try {
      const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: white;">
            <h1 style="color: #667eea;">Test Email</h1>
            <p>This is a test email from TaskSetu.</p>
            <p>If you can see this, HTML emails are working!</p>
            <p style="color: #666; font-size: 12px;">Sent at: ${new Date().toISOString()}</p>
          </div>
        `;
      const text = `This is a test email from TaskSetu. Sent at: ${new Date().toISOString()}`;

      const emailData = {
        from: this.fromEmail,
        to: [recipientEmail],
        subject: "Test Email from TaskSetu",
        html,
        text,
      };

      console.log("📧 Sending test email to:", recipientEmail);
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailData),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error(`[Email] ❌ Resend API error:`, result);
        return {
          success: false,
          error: result.message || "Failed to send email",
        };
      }

      console.log("✅ Test email sent:", result.id);
      return { success: true, messageId: result.id };
    } catch (error) {
      console.error("❌ Error sending test email:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send payment invoice email to user
   * @param {string} userEmail - User's email address
   * @param {Object} transactionData - Transaction details
   * @param {Object} userData - User details
   */
  async sendPaymentInvoice(userEmail, transactionData, userData) {
    try {
      if (!this.isConfigured) {
        await this.checkConfiguration();
      }

      if (!this.isConfigured) {
        console.warn(
          "⚠️ [Email] Email service not configured - RESEND_API_KEY missing, skipping invoice email",
        );
        return false;
      }

      console.log(`\n📧 Sending payment invoice to: ${userEmail}`);

      // Get user's timezone for date formatting
      const invoiceTimezone = await TimezoneHelper.getUserTimezone(
        userData?._id || userData?.id,
      );

      // Format currency
      const formatCurrency = (amount) =>
        `₹${Math.round(amount).toLocaleString("en-IN")}`;

      // Generate invoice HTML
      const invoiceHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.6; }
              .container { max-width: 700px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; text-align: center; }
              .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
              .header p { margin: 8px 0 0 0; font-size: 14px; opacity: 0.9; }
              .status-badge { display: inline-block; background-color: #28a745; color: white; padding: 8px 16px; border-radius: 4px; margin-top: 10px; font-weight: 600; }
              .invoice-details { background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 25px; }
              .detail-row { display: flex; justify-content: space-between; margin-bottom: 15px; }
              .detail-label { font-weight: 600; color: #555; }
              .detail-value { color: #333; text-align: right; }
              .transaction-id { background-color: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ffc107; }
              .transaction-id strong { color: #856404; }
              .bill-to { margin: 25px 0; }
              .bill-to h3 { margin-top: 0; color: #333; font-size: 16px; font-weight: 600; }
              .bill-to p { margin: 8px 0; color: #666; }
              table { width: 100%; border-collapse: collapse; margin: 25px 0; }
              thead { background-color: #667eea; color: white; }
              th { padding: 15px; text-align: left; font-weight: 600; }
              td { padding: 12px 15px; border-bottom: 1px solid #e0e0e0; }
              tbody tr:hover { background-color: #f8f9fa; }
              .total-row { background-color: #f0f2f5; font-weight: 600; font-size: 16px; }
              .total-row td { padding: 15px; border-top: 2px solid #667eea; border-bottom: 2px solid #667eea; }
              .payment-info { background-color: #e8f4f8; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #0284c7; }
              .payment-info h3 { margin-top: 0; color: #0284c7; font-size: 16px; font-weight: 600; }
              .payment-info p { margin: 8px 0; color: #333; }
              .footer { text-align: center; color: #888; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; }
              .footer p { margin: 5px 0; }
              .amount-highlight { color: #667eea; font-weight: 700; font-size: 18px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>✅ Payment Successful</h1>
                <p>Thank you for your purchase!</p>
                <div class="status-badge">PAYMENT COMPLETED</div>
              </div>

              <div class="invoice-details">
                <div class="detail-row">
                  <span class="detail-label">Invoice Number:</span>
                  <span class="detail-value"><strong>#${transactionData.transaction_id}</strong></span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Invoice Date:</span>
                  <span class="detail-value">${TimezoneHelper.formatInTimezone(new Date(transactionData.transaction_date), invoiceTimezone, { year: "numeric", month: "long", day: "numeric" })}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Payment Method:</span>
                  <span class="detail-value">${transactionData.payment_method || "Razorpay"}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Payment ID:</span>
                  <span class="detail-value">${transactionData.razorpay_payment_id || "N/A"}</span>
                </div>
              </div>

              <div class="transaction-id">
                <strong>📋 Transaction Reference:</strong> ${transactionData.transaction_id}
              </div>

              <div class="bill-to">
                <h3>Bill To:</h3>
                <p>
                  <strong>${userData.firstName} ${userData.lastName}</strong><br>
                  📧 ${userEmail}<br>
                  🏢 ${transactionData.organization_name || "Your Organization"}
                </p>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th style="text-align: center;">Seats</th>
                    <th style="text-align: center;">Cycle</th>
                    <th style="text-align: right;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>${transactionData.license_name}</strong></td>
                    <td style="text-align: center;">${transactionData.seats_purchased}</td>
                    <td style="text-align: center;">${transactionData.billing_cycle}</td>
                    <td style="text-align: right;">${formatCurrency(transactionData.price_per_seat * transactionData.seats_purchased)}</td>
                  </tr>
                  <tr class="total-row">
                    <td colspan="3" style="text-align: right;">💰 Total Amount Paid:</td>
                    <td style="text-align: right; color: #667eea;"><span class="amount-highlight">${formatCurrency(transactionData.amount_paid)}</span></td>
                  </tr>
                </tbody>
              </table>

              <div class="payment-info">
                <h3>📅 Renewal Information</h3>
                <p><strong>Renewal Date:</strong> ${TimezoneHelper.formatInTimezone(new Date(transactionData.renewal_date), invoiceTimezone, { year: "numeric", month: "long", day: "numeric" })}</p>
                <p><strong>Auto-Renewal:</strong> Enabled - Your subscription will automatically renew on the renewal date</p>
              </div>

              <div class="footer">
                <p><strong>🎉 Thank you for choosing TaskSetu!</strong></p>
                <p>Your licenses are now active and ready to use.</p>
                <p style="color: #aaa;">This is an automated email. Please do not reply to this email.</p>
                <p>For support or queries, contact: <a href="mailto:support@tasksetu.com" style="color: #667eea; text-decoration: none;">support@tasksetu.com</a></p>
              </div>
            </div>
          </body>
        </html>
      `;

      const emailData = {
        from: this.fromEmail,
        to: [userEmail],
        subject: `Invoice #${transactionData.transaction_id} - ${transactionData.license_name} Purchase`,
        html: invoiceHTML,
        replyTo: "support@tasksetu.com",
      };

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailData),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error(`[Email] ❌ Resend API error:`, result);
        return {
          success: false,
          error: result.message || "Failed to send email",
        };
      }

      console.log(`✅ Invoice email sent successfully to ${userEmail}`);
      return { success: true, messageId: result.id };
    } catch (error) {
      console.error(
        `❌ Failed to send invoice email to ${userEmail}:`,
        error.message,
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notification to super admin for new organization registration
   */
  async sendSuperAdminOrgRegistrationEmail(superAdminEmail, organizationData) {
    if (!this.isConfigured) {
      await this.checkConfiguration();
    }

    if (!this.isConfigured) {
      console.error("Email service not configured - RESEND_API_KEY missing");
      return false;
    }

    try {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 5px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏢 New Organization Registered</h1>
            </div>
            <div class="content">
              <p>Hi Super Admin,</p>
              <p>A new organization has been registered on the platform:</p>
              
              <div class="info-box">
                <h3>Organization Details:</h3>
                <p><strong>Organization Name:</strong> ${organizationData.name}</p>
                <p><strong>Admin Name:</strong> ${organizationData.adminName}</p>
                <p><strong>Admin Email:</strong> ${organizationData.adminEmail}</p>
                <p><strong>Registration Date:</strong> ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
              </div>

              <p>This organization is now active on the platform.</p>
            </div>
            <div class="footer">
              <p>TaskSetu Platform - Super Admin Notification</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await this.sendEmail({
        to: superAdminEmail,
        subject: `🏢 New Organization Registration - ${organizationData.name}`,
        html,
      });

      console.log(
        `✅ Super admin notified about new organization: ${organizationData.name}`,
      );
      return true;
    } catch (error) {
      console.error(
        "❌ Error sending super admin org registration email:",
        error,
      );
      return false;
    }
  }

  /**
   * Send notification to super admin for new user registration
   */
  async sendSuperAdminUserRegistrationEmail(superAdminEmail, userData) {
    if (!this.isConfigured) {
      await this.checkConfiguration();
    }

    if (!this.isConfigured) {
      console.error("Email service not configured - RESEND_API_KEY missing");
      return false;
    }

    try {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 20px; border-left: 4px solid #10b981; margin: 20px 0; border-radius: 5px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>👤 New User Registered</h1>
            </div>
            <div class="content">
              <p>Hi Super Admin,</p>
              <p>A new individual user has been registered on the platform:</p>
              
              <div class="info-box">
                <h3>User Details:</h3>
                <p><strong>Name:</strong> ${userData.firstName} ${userData.lastName}</p>
                <p><strong>Email:</strong> ${userData.email}</p>
                <p><strong>Phone:</strong> ${userData.phone || "Not provided"}</p>
                <p><strong>Registration Date:</strong> ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
              </div>

              <p>This user account is now active on the platform.</p>
            </div>
            <div class="footer">
              <p>TaskSetu Platform - Super Admin Notification</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await this.sendEmail({
        to: superAdminEmail,
        subject: `👤 New User Registration - ${userData.firstName} ${userData.lastName}`,
        html,
      });

      console.log(`✅ Super admin notified about new user: ${userData.email}`);
      return true;
    } catch (error) {
      console.error(
        "❌ Error sending super admin user registration email:",
        error,
      );
      return false;
    }
  }

  /**
   * Send notification to super admin for package plan purchase
   */
  async sendSuperAdminPackagePurchaseEmail(superAdminEmail, purchaseData) {
    if (!this.isConfigured) {
      await this.checkConfiguration();
    }

    if (!this.isConfigured) {
      console.error("Email service not configured - RESEND_API_KEY missing");
      return false;
    }

    try {
      const formatCurrency = (amount) => {
        return new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "INR",
        }).format(amount);
      };

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 20px; border-left: 4px solid #f59e0b; margin: 20px 0; border-radius: 5px; }
            .amount { font-size: 24px; color: #f59e0b; font-weight: bold; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>💳 New Package Purchase</h1>
            </div>
            <div class="content">
              <p>Hi Super Admin,</p>
              <p>A new package/plan has been purchased on the platform:</p>
              
              <div class="info-box">
                <h3>Purchase Details:</h3>
                <p><strong>Organization:</strong> ${purchaseData.organizationName}</p>
                <p><strong>Package:</strong> ${purchaseData.packageName}</p>
                <p><strong>Seats Purchased:</strong> ${purchaseData.seats}</p>
                <p><strong>Billing Cycle:</strong> ${purchaseData.billingCycle}</p>
                <p><strong>Amount:</strong> <span class="amount">${formatCurrency(purchaseData.amount)}</span></p>
                <p><strong>Purchase Date:</strong> ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                <p><strong>Transaction ID:</strong> ${purchaseData.transactionId}</p>
              </div>

              <p>Revenue has been added to the platform.</p>
            </div>
            <div class="footer">
              <p>TaskSetu Platform - Super Admin Notification</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await this.sendEmail({
        to: superAdminEmail,
        subject: `💳 New Package Purchase - ${purchaseData.packageName} by ${purchaseData.organizationName}`,
        html,
      });

      console.log(
        `✅ Super admin notified about package purchase: ${purchaseData.packageName}`,
      );
      return true;
    } catch (error) {
      console.error(
        "❌ Error sending super admin package purchase email:",
        error,
      );
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ✅ NEW: Morning Briefing Email
    // ─────────────────────────────────────────────────────────────────────────────
  // 🎨 REDESIGNED TASKSETU EMAIL NOTIFICATION SUITE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * 1. Send Daily Digest / Morning Briefing Email
   * @param {Object} user - User object { firstName, lastName, email }
   * @param {Object} taskSummary - { overdueTasks, dueToday, dueSoon, pendingApprovals, completedYesterday, totalPending }
   * @param {string} userTimezone - Recipient's local timezone (e.g. 'Asia/Kolkata')
   */
  async sendMorningBriefingEmail(user, taskSummary = {}, userTimezone = 'Asia/Kolkata') {
    if (!this.isConfigured) await this.checkConfiguration();
    if (!this.isConfigured) return false;

    try {
      const firstName = user.firstName || 'there';
      const todayFormatted = new Intl.DateTimeFormat('en-US', {
        timeZone: userTimezone,
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      }).format(new Date());

      const html = renderDailyDigestEmail({
        user,
        taskSummary,
        baseUrl: this.baseUrl,
        userTimezone
      });

      const { overdueTasks = [], dueToday = [], dueSoon = [], totalPending = 0 } = taskSummary;
      const text = `Good Morning ${firstName}! Here is your TaskSetu daily work summary for ${todayFormatted}:\n` +
        `• Overdue: ${overdueTasks.length} task(s)\n` +
        `• Due Today: ${dueToday.length} task(s)\n` +
        `• Upcoming: ${dueSoon.length} task(s)\n` +
        `• Total Pending: ${totalPending} task(s)\n\n` +
        `Open your dashboard: ${this.baseUrl}/tasks`;

      const subject = `☀️ Your TaskSetu Daily Work Summary — ${todayFormatted}`;

      return await this.sendEmail({
        to: user.email,
        subject,
        html,
        text
      });
    } catch (error) {
      console.error('[Email] ❌ Error sending morning briefing email:', error.message);
      return false;
    }
  }

  /**
   * 2. Send Critical / Overdue Task Email
   */
  async sendCriticalOverdueEmail({
    user,
    task,
    daysOverdue = 1,
    hoursOverdue,
    isEscalation = false,
    escalationLevel = 'assignee',
    responsibleEmployeeName,
    assignedByName,
    userTimezone = 'Asia/Kolkata'
  }) {
    if (!this.isConfigured) await this.checkConfiguration();
    if (!this.isConfigured) return false;

    try {
      const html = renderCriticalOverdueEmail({
        user,
        task,
        daysOverdue,
        hoursOverdue,
        isEscalation,
        escalationLevel,
        responsibleEmployeeName,
        assignedByName,
        baseUrl: this.baseUrl,
        userTimezone
      });

      const dayWord = daysOverdue === 1 ? 'day' : 'days';
      const subject = `🚨 Action Required: Task Overdue — "${task.title || 'Task'}"`;
      const text = `Action Required: Task "${task.title}" is ${daysOverdue} ${dayWord} overdue. Review it at: ${this.baseUrl}/tasks/${task._id || task.id}`;

      return await this.sendEmail({
        to: user.email,
        subject,
        html,
        text
      });
    } catch (error) {
      console.error('[Email] ❌ Error sending critical overdue email:', error.message);
      return false;
    }
  }

  /**
   * 3. Send Task Assignment Email (routes to approval template if task is approval type)
   */
  async sendTaskAssignmentEmail(user, task, assignedBy, userTimezone = 'Asia/Kolkata') {
    if (!this.isConfigured) await this.checkConfiguration();
    if (!this.isConfigured) return false;

    try {
      const isApproval = task.taskType === 'approval' || task.isApprovalTask;
      if (isApproval) {
        return await this.sendApprovalRequiredEmail({
          user,
          task,
          requestedBy: assignedBy,
          userTimezone
        });
      }

      const html = renderTaskAssignmentEmail({
        user,
        task,
        assignedBy,
        baseUrl: this.baseUrl,
        userTimezone
      });

      const assignerName = assignedBy
        ? `${assignedBy.firstName || ''} ${assignedBy.lastName || ''}`.trim()
        : 'TaskSetu';

      const subject = `📋 New Task Assigned: "${task.title || 'Task'}"`;
      const text = `Hi ${user.firstName || 'there'}, you've been assigned a new task "${task.title}" by ${assignerName}. View it here: ${this.baseUrl}/tasks/${task._id || task.id}`;

      return await this.sendEmail({
        to: user.email,
        subject,
        html,
        text
      });
    } catch (error) {
      console.error('[Email] ❌ Error sending task assignment email:', error.message);
      return false;
    }
  }

  /**
   * 4. Send Approval Required Email
   */
  async sendApprovalRequiredEmail({ user, task, requestedBy, userTimezone = 'Asia/Kolkata' }) {
    if (!this.isConfigured) await this.checkConfiguration();
    if (!this.isConfigured) return false;

    try {
      const html = renderApprovalRequiredEmail({
        user,
        task,
        requestedBy,
        baseUrl: this.baseUrl,
        userTimezone
      });

      const requesterName = requestedBy
        ? `${requestedBy.firstName || ''} ${requestedBy.lastName || ''}`.trim()
        : 'Team Member';

      const subject = `⚡ Approval Required: "${task.title || 'Approval Request'}"`;
      const text = `Hi ${user.firstName || 'there'}, you have a new approval request "${task.title}" from ${requesterName} that requires your attention. Review and take action: ${this.baseUrl}/tasks/${task._id || task.id}`;

      return await this.sendEmail({
        to: user.email,
        subject,
        html,
        text
      });
    } catch (error) {
      console.error('[Email] ❌ Error sending approval required email:', error.message);
      return false;
    }
  }

  /**
   * 5. Send Tasks Due Today Grouped Email
   */
  async sendTasksDueTodayEmail(user, tasks = [], todayDate) {
    if (!this.isConfigured) await this.checkConfiguration();
    if (!this.isConfigured) return false;
    if (!tasks || tasks.length === 0) return true;

    try {
      const html = renderTasksDueTodayEmail({
        user,
        tasks,
        todayDate,
        baseUrl: this.baseUrl
      });

      const count = tasks.length;
      const countWord = count === 1 ? 'task' : 'tasks';
      const subject = `📅 ${count} ${countWord} Due Today — TaskSetu`;
      const text = `Hi ${user.firstName || 'there'}, you have ${count} ${countWord} due today. View your tasks: ${this.baseUrl}/tasks`;

      return await this.sendEmail({
        to: user.email,
        subject,
        html,
        text
      });
    } catch (error) {
      console.error('[Email] ❌ Error sending tasks due today email:', error.message);
      return false;
    }
  }

  /**
   * 6. Send License Expiry Reminder Email
   */
  async sendLicenseExpiryReminderEmail(user, licenseInfo = {}, daysRemaining = 7, userTimezone = 'Asia/Kolkata') {
    if (!this.isConfigured) await this.checkConfiguration();
    if (!this.isConfigured) return false;

    try {
      const html = renderLicenseExpiryEmail({
        user,
        licenseInfo,
        daysRemaining,
        baseUrl: this.baseUrl,
        userTimezone
      });

      const licenseCode = (licenseInfo.licenseCode || 'TaskSetu').toUpperCase();
      const isUrgent = daysRemaining <= 3;
      const subject = `${isUrgent ? '🚨 URGENT: ' : '⏰ '}License Expires in ${daysRemaining} Days — TaskSetu`;
      const text = `Hi ${user.firstName || 'there'}, your ${licenseCode} license expires in ${daysRemaining} days. Renew your license at: ${this.baseUrl}/billing`;

      return await this.sendEmail({
        to: user.email,
        subject,
        html,
        text
      });
    } catch (error) {
      console.error('[Email] ❌ Error sending license expiry email:', error.message);
      return false;
    }
  }

  /**
   * 7. Send Final MISSED Task Email
   */
  async sendMissedTaskEmail(user, task, daysOverdue, hoursOverdue, userTimezone = 'Asia/Kolkata') {
    if (!this.isConfigured) await this.checkConfiguration();
    if (!this.isConfigured) return false;

    try {
      const html = renderMissedTaskEmail({
        user,
        task,
        daysOverdue,
        hoursOverdue,
        baseUrl: this.baseUrl,
        userTimezone
      });

      const dayWord = daysOverdue === 1 ? 'day' : 'days';
      const subject = `⛔ MISSED: "${task.title || 'Task'}" — ${daysOverdue} ${dayWord} overdue`;
      const text = `Hi ${user.firstName || 'there'}, FINAL NOTICE: You missed your task "${task.title}". It is now ${daysOverdue} ${dayWord} (${hoursOverdue} hours) overdue. Complete it at: ${this.baseUrl}/tasks/${task._id || task.id}`;

      return await this.sendEmail({
        to: user.email,
        subject,
        html,
        text
      });
    } catch (error) {
      console.error('[Email] ❌ Error sending missed task email:', error.message);
      return false;
    }
  }
}

export const emailService = new EmailService();
