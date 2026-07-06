import dotenv from "dotenv";
dotenv.config();
import { TimezoneHelper } from "../utils/timezoneHelper.js";

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
  async sendEmail({ to, subject, html, text, from }) {
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

  /**
   * Send morning briefing email with today's task summary
   * @param {Object} user - User object { firstName, lastName, email }
   * @param {Object} taskSummary - { overdueTasks, dueToday, dueSoon, totalPending }
   */
  async sendMorningBriefingEmail(user, taskSummary) {
    if (!this.isConfigured) await this.checkConfiguration();
    if (!this.isConfigured) return false;

    try {
      const {
        overdueTasks = [],
        dueToday = [],
        dueSoon = [],
        totalPending = 0,
      } = taskSummary;
      const firstName = user.firstName || "there";
      const today = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const priorityBadge = (priority = "medium") => {
        const colors = {
          critical: "#DC2626",
          high: "#EF4444",
          medium: "#F59E0B",
          low: "#10B981",
          urgent: "#DC2626",
        };
        const color = colors[priority.toLowerCase()] || "#6B7280";
        return `<span style="background:${color};color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;text-transform:uppercase;">${priority}</span>`;
      };

      const taskTypeIcon = (type = "regular") => {
        const icons = {
          milestone: "🎯",
          approval: "✅",
          recurring: "🔄",
          subtask: "📎",
          regular: "📋",
        };
        return icons[type] || "📋";
      };

      const buildTaskRows = (tasks, emptyMsg) => {
        if (!tasks.length)
          return `<p style="color:#9CA3AF;font-style:italic;margin:8px 0;">${emptyMsg}</p>`;
        return (
          tasks
            .slice(0, 5)
            .map(
              (t) => `
          <div style="background:#fff;border:1px solid #E5E7EB;border-radius:8px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:10px;">
            <span style="font-size:18px;">${taskTypeIcon(t.taskType)}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.title}</div>
              <div style="font-size:12px;color:#6B7280;margin-top:2px;">
                ${t.dueDate ? `Due: ${new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "No due date"}
                &nbsp;·&nbsp;${priorityBadge(t.priority)}
              </div>
            </div>
          </div>`,
            )
            .join("") +
          (tasks.length > 5
            ? `<p style="color:#6B7280;font-size:13px;margin-top:4px;">+${tasks.length - 5} more tasks…</p>`
            : "")
        );
      };

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Good Morning — TaskSetu Daily Briefing</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:620px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:36px 32px;text-align:center;">
      <div style="font-size:40px;margin-bottom:8px;">☀️</div>
      <h1 style="margin:0;color:#fff;font-size:26px;font-weight:700;">Good Morning, ${firstName}!</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">${today}</p>
    </div>

    <!-- Stats Bar -->
    <div style="display:flex;background:#F9FAFB;border-bottom:1px solid #E5E7EB;">
      <div style="flex:1;text-align:center;padding:16px 8px;border-right:1px solid #E5E7EB;">
        <div style="font-size:28px;font-weight:700;color:#DC2626;">${overdueTasks.length}</div>
        <div style="font-size:12px;color:#6B7280;margin-top:2px;">Overdue</div>
      </div>
      <div style="flex:1;text-align:center;padding:16px 8px;border-right:1px solid #E5E7EB;">
        <div style="font-size:28px;font-weight:700;color:#F59E0B;">${dueToday.length}</div>
        <div style="font-size:12px;color:#6B7280;margin-top:2px;">Due Today</div>
      </div>
      <div style="flex:1;text-align:center;padding:16px 8px;border-right:1px solid #E5E7EB;">
        <div style="font-size:28px;font-weight:700;color:#3B82F6;">${dueSoon.length}</div>
        <div style="font-size:12px;color:#6B7280;margin-top:2px;">Due Soon</div>
      </div>
      <div style="flex:1;text-align:center;padding:16px 8px;">
        <div style="font-size:28px;font-weight:700;color:#6B7280;">${totalPending}</div>
        <div style="font-size:12px;color:#6B7280;margin-top:2px;">Total Pending</div>
      </div>
    </div>

    <div style="padding:28px 32px;">
      ${
        overdueTasks.length > 0
          ? `
      <!-- Overdue Section -->
      <div style="margin-bottom:24px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <div style="width:4px;height:20px;background:#DC2626;border-radius:2px;"></div>
          <h2 style="margin:0;font-size:16px;color:#DC2626;font-weight:700;">⚠️ Overdue Tasks (${overdueTasks.length})</h2>
        </div>
        ${buildTaskRows(overdueTasks, "No overdue tasks")}
      </div>`
          : ""
      }

      ${
        dueToday.length > 0
          ? `
      <!-- Due Today Section -->
      <div style="margin-bottom:24px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <div style="width:4px;height:20px;background:#F59E0B;border-radius:2px;"></div>
          <h2 style="margin:0;font-size:16px;color:#D97706;font-weight:700;">📅 Due Today (${dueToday.length})</h2>
        </div>
        ${buildTaskRows(dueToday, "Nothing due today")}
      </div>`
          : ""
      }

      ${
        dueSoon.length > 0
          ? `
      <!-- Due Soon Section -->
      <div style="margin-bottom:24px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <div style="width:4px;height:20px;background:#3B82F6;border-radius:2px;"></div>
          <h2 style="margin:0;font-size:16px;color:#2563EB;font-weight:700;">🔜 Coming Up (${dueSoon.length})</h2>
        </div>
        ${buildTaskRows(dueSoon, "Nothing coming up")}
      </div>`
          : ""
      }

      ${
        overdueTasks.length === 0 &&
        dueToday.length === 0 &&
        dueSoon.length === 0
          ? `
      <div style="text-align:center;padding:32px;color:#10B981;">
        <div style="font-size:48px;margin-bottom:12px;">🎉</div>
        <h2 style="margin:0;color:#059669;font-size:18px;">You're all caught up!</h2>
        <p style="color:#6B7280;margin:8px 0 0;">No urgent tasks for today. Great work!</p>
      </div>`
          : ""
      }

      <!-- CTA Button -->
      <div style="text-align:center;margin-top:24px;">
        <a href="${this.baseUrl}/tasks" style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;">Open My Tasks →</a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#F9FAFB;border-top:1px solid #E5E7EB;padding:18px 32px;text-align:center;">
      <p style="margin:0;color:#9CA3AF;font-size:12px;">You're receiving this because you have an active TaskSetu account.<br>© ${new Date().getFullYear()} TaskSetu. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

      return await this.sendEmail({
        to: user.email,
        subject: `☀️ Good Morning ${firstName} — Your Daily Task Briefing`,
        html,
        text: `Good Morning ${firstName}! Today: ${overdueTasks.length} overdue, ${dueToday.length} due today, ${dueSoon.length} coming soon. Total pending: ${totalPending}. Open TaskSetu: ${this.baseUrl}/tasks`,
      });
    } catch (error) {
      console.error(
        "[Email] ❌ Error sending morning briefing email:",
        error.message,
      );
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ✅ NEW: Tasks Due Today Grouped Email
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Send grouped email with tasks due today
   * @param {Object} user - User object { firstName, lastName, email }
   * @param {Array} tasks - Array of task objects due today
   */
  async sendTasksDueTodayEmail(user, tasks) {
    if (!this.isConfigured) await this.checkConfiguration();
    if (!this.isConfigured) return false;

    if (!tasks || tasks.length === 0) return true;

    try {
      const firstName = user.firstName || "there";
      const today = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const priorityBadge = (priority = "medium") => {
        const colors = {
          critical: "#DC2626",
          high: "#EF4444",
          medium: "#F59E0B",
          low: "#10B981",
          urgent: "#DC2626",
        };
        const color = colors[priority.toLowerCase()] || "#6B7280";
        return `<span style="background:${color};color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;text-transform:uppercase;">${priority}</span>`;
      };

      const taskTypeIcon = (type = "regular") => {
        const icons = {
          milestone: "🎯",
          approval: "✅",
          recurring: "🔄",
          subtask: "📎",
          regular: "📋",
        };
        return icons[type] || "📋";
      };

      const taskRows = tasks.map((t) => `
        <div style="background:#fff;border:1px solid #E5E7EB;border-left:4px solid #F59E0B;border-radius:8px;padding:14px;margin-bottom:12px;display:flex;align-items:center;gap:12px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <span style="font-size:22px;">${taskTypeIcon(t.taskType)}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;color:#111827;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.title}</div>
            <div style="font-size:13px;color:#6B7280;margin-top:4px;">
              ${priorityBadge(t.priority)}
            </div>
          </div>
        </div>`).join("");

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tasks Due Today</title>
</head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.05);">
    <div style="background:linear-gradient(135deg, #F59E0B 0%, #D97706 100%);padding:32px;text-align:center;">
      <div style="font-size:42px;margin-bottom:12px;">📅</div>
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">Tasks Due Today</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:15px;">${today}</p>
    </div>
    
    <div style="padding:32px;">
      <p style="margin:0 0 24px;font-size:16px;color:#374151;">Hi <strong>${firstName}</strong>, you have <strong>${tasks.length}</strong> task${tasks.length !== 1 ? 's' : ''} due today. Let's get things done!</p>
      
      <div style="margin-bottom:32px;">
        ${taskRows}
      </div>
      
      <div style="text-align:center;">
        <a href="${this.baseUrl}/tasks" style="display:inline-block;background:#F59E0B;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;box-shadow:0 4px 6px -1px rgba(245, 158, 11, 0.3), 0 2px 4px -1px rgba(245, 158, 11, 0.06);">View Your Tasks →</a>
      </div>
    </div>
    
    <div style="background:#F3F4F6;padding:24px;text-align:center;border-top:1px solid #E5E7EB;">
      <p style="margin:0;color:#9CA3AF;font-size:13px;">© ${new Date().getFullYear()} TaskSetu. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

      return await this.sendEmail({
        to: user.email,
        subject: `📅 ${tasks.length} Task${tasks.length !== 1 ? 's' : ''} Due Today — ${today}`,
        html,
        text: `Hi ${firstName}, you have ${tasks.length} task(s) due today. Open TaskSetu to view them: ${this.baseUrl}/tasks`,
      });
    } catch (error) {
      console.error(
        "[Email] ❌ Error sending tasks due today email:",
        error.message,
      );
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ✅ NEW: Task Assignment Email (all task types)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Send email when any task type is assigned to a user
   * @param {Object} user - Assignee { firstName, lastName, email }
   * @param {Object} task - Task object { title, description, taskType, priority, dueDate, _id }
   * @param {Object} assignedBy - Assigner { firstName, lastName, email }
   */
  async sendTaskAssignmentEmail(user, task, assignedBy) {
    if (!this.isConfigured) await this.checkConfiguration();
    if (!this.isConfigured) return false;

    try {
      const firstName = user.firstName || "there";
      const assigner = assignedBy
        ? `${assignedBy.firstName} ${assignedBy.lastName}`
        : "TaskSetu";

      const taskTypeConfig = {
        milestone: { label: "Milestone", color: "#8B5CF6", icon: "🎯" },
        approval: { label: "Approval Task", color: "#F59E0B", icon: "✅" },
        recurring: { label: "Recurring Task", color: "#3B82F6", icon: "🔄" },
        subtask: { label: "Subtask", color: "#6B7280", icon: "📎" },
        regular: { label: "Task", color: "#10B981", icon: "📋" },
      };
      const typeConfig =
        taskTypeConfig[task.taskType] || taskTypeConfig.regular;

      const priorityConfig = {
        critical: { color: "#DC2626", label: "Critical" },
        high: { color: "#EF4444", label: "High" },
        medium: { color: "#F59E0B", label: "Medium" },
        low: { color: "#10B981", label: "Low" },
      };
      const pConfig =
        priorityConfig[task.priority?.toLowerCase()] || priorityConfig.medium;
      const dueText = task.dueDate
        ? new Date(task.dueDate).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "No due date set";
      const taskUrl = `${this.baseUrl}/tasks/${task._id}`;

      const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>New Task Assigned</title></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,${typeConfig.color} 0%,${typeConfig.color}cc 100%);padding:32px;text-align:center;">
      <div style="font-size:40px;margin-bottom:8px;">${typeConfig.icon}</div>
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">New ${typeConfig.label} Assigned</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">From ${assigner}</p>
    </div>

    <div style="padding:28px 32px;">
      <p style="margin:0 0 20px;color:#374151;font-size:15px;">Hi <strong>${firstName}</strong>, you've been assigned a new ${typeConfig.label.toLowerCase()}:</p>

      <!-- Task Card -->
      <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-left:4px solid ${typeConfig.color};border-radius:10px;padding:20px;margin-bottom:24px;">
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px;">
          <span style="background:${typeConfig.color};color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:12px;white-space:nowrap;">${typeConfig.label.toUpperCase()}</span>
          <span style="background:${pConfig.color};color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:12px;white-space:nowrap;">${pConfig.label.toUpperCase()}</span>
        </div>
        <h2 style="margin:0 0 12px;font-size:18px;color:#111827;font-weight:700;">${task.title}</h2>
        ${task.description ? `<p style="margin:0 0 14px;color:#6B7280;font-size:14px;line-height:1.6;">${task.description.slice(0, 200)}${task.description.length > 200 ? "…" : ""}</p>` : ""}
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <div style="background:#fff;border:1px solid #E5E7EB;border-radius:6px;padding:8px 12px;font-size:13px;color:#374151;">
            📅 <strong>Due:</strong> ${dueText}
          </div>
          <div style="background:#fff;border:1px solid #E5E7EB;border-radius:6px;padding:8px 12px;font-size:13px;color:#374151;">
            👤 <strong>Assigned by:</strong> ${assigner}
          </div>
        </div>
      </div>

      <!-- CTA -->
      <div style="text-align:center;">
        <a href="${taskUrl}" style="display:inline-block;background:${typeConfig.color};color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;">View ${typeConfig.label} →</a>
      </div>
    </div>

    <div style="background:#F9FAFB;border-top:1px solid #E5E7EB;padding:16px 32px;text-align:center;">
      <p style="margin:0;color:#9CA3AF;font-size:12px;">© ${new Date().getFullYear()} TaskSetu. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

      return await this.sendEmail({
        to: user.email,
        subject: `${typeConfig.icon} New ${typeConfig.label} Assigned: "${task.title}"`,
        html,
        text: `Hi ${firstName}, you've been assigned: "${task.title}" (${typeConfig.label}, ${pConfig.label} priority). Due: ${dueText}. View it here: ${taskUrl}`,
      });
    } catch (error) {
      console.error(
        "[Email] ❌ Error sending task assignment email:",
        error.message,
      );
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────


  // ─────────────────────────────────────────────────────────────────────────────
  // ✅ NEW: License Expiry Reminder Email
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Send license expiry reminder email
   * @param {Object} user - User { firstName, lastName, email }
   * @param {Object} licenseInfo - { licenseCode, expiryDate, organizationName }
   * @param {number} daysRemaining - Days until license expires
   */
  async sendLicenseExpiryReminderEmail(user, licenseInfo, daysRemaining) {
    if (!this.isConfigured) await this.checkConfiguration();
    if (!this.isConfigured) return false;

    try {
      const firstName = user.firstName || "there";
      const expiryDate = licenseInfo.expiryDate
        ? new Date(licenseInfo.expiryDate).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "Soon";
      const licenseCode = licenseInfo.licenseCode || "Your Plan";
      const renewUrl = `${this.baseUrl}/billing`;

      const urgencyConfig =
        daysRemaining <= 1
          ? {
              gradient: "linear-gradient(135deg,#7F1D1D 0%,#DC2626 100%)",
              accent: "#DC2626",
              badge: "#FEE2E2",
              badgeText: "#991B1B",
              emoji: "🚨",
              title: "URGENT: License Expires Tomorrow!",
              alertMsg:
                "Your license expires TOMORROW. Renew immediately to avoid losing access to all features.",
            }
          : daysRemaining <= 3
            ? {
                gradient: "linear-gradient(135deg,#DC2626 0%,#EF4444 100%)",
                accent: "#EF4444",
                badge: "#FEE2E2",
                badgeText: "#DC2626",
                emoji: "⚠️",
                title: `License Expires in ${daysRemaining} Days!`,
                alertMsg: "Act now to avoid service interruption.",
              }
            : daysRemaining <= 7
              ? {
                  gradient: "linear-gradient(135deg,#D97706 0%,#F59E0B 100%)",
                  accent: "#F59E0B",
                  badge: "#FEF3C7",
                  badgeText: "#92400E",
                  emoji: "⏰",
                  title: `License Expires in ${daysRemaining} Days`,
                  alertMsg:
                    "Renew soon to continue enjoying uninterrupted access.",
                }
              : {
                  gradient: "linear-gradient(135deg,#1D4ED8 0%,#3B82F6 100%)",
                  accent: "#3B82F6",
                  badge: "#DBEAFE",
                  badgeText: "#1E40AF",
                  emoji: "📅",
                  title: `License Renewal Reminder — ${daysRemaining} Days Remaining`,
                  alertMsg:
                    "Your license will expire soon. Plan your renewal in advance.",
                };

      const uc = urgencyConfig;

      const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>License Expiry Reminder</title></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:${uc.gradient};padding:32px;text-align:center;">
      <div style="font-size:40px;margin-bottom:8px;">${uc.emoji}</div>
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${uc.title}</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">Expires on: ${expiryDate}</p>
    </div>

    <div style="padding:28px 32px;">
      <p style="margin:0 0 20px;color:#374151;font-size:15px;">Hi <strong>${firstName}</strong>, ${uc.alertMsg}</p>

      <!-- License Card -->
      <div style="background:${uc.badge};border:1px solid ${uc.accent}40;border-left:4px solid ${uc.accent};border-radius:10px;padding:20px;margin-bottom:24px;">
        <div style="margin-bottom:12px;">
          <span style="background:${uc.accent};color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:12px;">${licenseCode.toUpperCase()} PLAN</span>
        </div>
        <div style="display:grid;gap:8px;font-size:14px;color:#374151;">
          <div>🗓 <strong>Expiry Date:</strong> ${expiryDate}</div>
          <div>⏳ <strong>Days Remaining:</strong> <span style="color:${uc.accent};font-weight:700;">${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}</span></div>
          ${licenseInfo.organizationName ? `<div>🏢 <strong>Organization:</strong> ${licenseInfo.organizationName}</div>` : ""}
        </div>
      </div>

      <!-- What happens if expired -->
      <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:16px;margin-bottom:24px;">
        <h3 style="margin:0 0 10px;font-size:14px;color:#374151;font-weight:700;">⚠️ If your license expires:</h3>
        <ul style="margin:0;padding-left:18px;color:#6B7280;font-size:13px;line-height:1.8;">
          <li>You'll be automatically downgraded to the EXPLORE plan</li>
          <li>Advanced features and task limits will be restricted</li>
          <li>Your data will be safely preserved</li>
          <li>You can renew at any time to restore full access</li>
        </ul>
      </div>

      <!-- CTA -->
      <div style="text-align:center;">
        <a href="${renewUrl}" style="display:inline-block;background:${uc.accent};color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;">Renew My License →</a>
        <p style="margin:12px 0 0;color:#9CA3AF;font-size:12px;">Or visit <a href="${this.baseUrl}/billing" style="color:${uc.accent};">${this.baseUrl}/billing</a></p>
      </div>
    </div>

    <div style="background:#F9FAFB;border-top:1px solid #E5E7EB;padding:16px 32px;text-align:center;">
      <p style="margin:0;color:#9CA3AF;font-size:12px;">This is an automated license reminder from TaskSetu.<br>© ${new Date().getFullYear()} TaskSetu. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

      return await this.sendEmail({
        to: user.email,
        subject: `${uc.emoji} ${uc.title} — TaskSetu`,
        html,
        text: `Hi ${firstName}, your ${licenseCode} license expires on ${expiryDate} (${daysRemaining} days remaining). ${uc.alertMsg} Renew here: ${renewUrl}`,
      });
    } catch (error) {
      console.error(
        "[Email] ❌ Error sending license expiry email:",
        error.message,
      );
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ✅ NEW: Final MISSED Task Email (fires once after 24h overdue)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Send the final "You MISSED your task" email — fires once after 24h of being overdue.
   * Distinct from regular overdue reminders: darker styling, stronger language, sent only once.
   * @param {Object} user - Assignee { firstName, lastName, email }
   * @param {Object} task - Task object { title, priority, dueDate, _id, taskType }
   * @param {number} daysOverdue - Full days overdue
   * @param {number} hoursOverdue - Total hours overdue
   */
  async sendMissedTaskEmail(user, task, daysOverdue, hoursOverdue) {
    if (!this.isConfigured) await this.checkConfiguration();
    if (!this.isConfigured) return false;

    try {
      const firstName = user.firstName || "there";
      const priority = task.priority?.toLowerCase() || "medium";
      const isCriticalHigh = ["critical", "high"].includes(priority);

      const priorityColor =
        {
          critical: "#7F1D1D",
          high: "#991B1B",
          medium: "#92400E",
          low: "#1E3A5F",
        }[priority] || "#991B1B";
      const priorityAccent =
        {
          critical: "#DC2626",
          high: "#EF4444",
          medium: "#F59E0B",
          low: "#3B82F6",
        }[priority] || "#DC2626";
      const dueText = task.dueDate
        ? new Date(task.dueDate).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : "Unknown";
      const taskUrl = `${this.baseUrl}/tasks/${task._id}`;
      const dayWord = daysOverdue === 1 ? "day" : "days";

      const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>MISSED Task Alert</title></head>
<body style="margin:0;padding:0;background:#1A1A1A;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.4);">

    <!-- Header: Dark red gradient with MISSED badge -->
    <div style="background:linear-gradient(135deg,#1A0000 0%,${priorityColor} 50%,#DC2626 100%);padding:36px 32px;text-align:center;">
      <div style="display:inline-block;background:rgba(255,255,255,0.15);border:2px solid rgba(255,255,255,0.3);border-radius:50px;padding:6px 20px;margin-bottom:16px;">
        <span style="color:#fff;font-size:12px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">⛔ TASK MISSED</span>
      </div>
      <h1 style="margin:0 0 8px;color:#fff;font-size:26px;font-weight:800;line-height:1.2;">You Missed Your Task</h1>
      <p style="margin:0;color:rgba(255,255,255,0.8);font-size:14px;">${hoursOverdue} hours overdue · ${daysOverdue} ${dayWord} past due date</p>
    </div>

    <!-- Time bar -->
    <div style="background:#FEE2E2;padding:12px 32px;display:flex;align-items:center;justify-content:center;gap:24px;border-bottom:3px solid #DC2626;">
      <div style="text-align:center;">
        <div style="font-size:28px;font-weight:800;color:#DC2626;">${hoursOverdue}h</div>
        <div style="font-size:11px;color:#991B1B;font-weight:600;text-transform:uppercase;">Hours Overdue</div>
      </div>
      <div style="width:1px;height:40px;background:#FCA5A5;"></div>
      <div style="text-align:center;">
        <div style="font-size:28px;font-weight:800;color:#DC2626;">${daysOverdue}</div>
        <div style="font-size:11px;color:#991B1B;font-weight:600;text-transform:uppercase;">Days Overdue</div>
      </div>
      <div style="width:1px;height:40px;background:#FCA5A5;"></div>
      <div style="text-align:center;">
        <div style="font-size:28px;font-weight:800;color:#DC2626;">${priority.toUpperCase()}</div>
        <div style="font-size:11px;color:#991B1B;font-weight:600;text-transform:uppercase;">Priority</div>
      </div>
    </div>

    <div style="padding:28px 32px;">
      <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
        Hi <strong>${firstName}</strong>, this is your final reminder — your task has been <strong>MISSED</strong>.
        You have not completed it within the expected time frame.
      </p>

      <!-- Missed Task Card -->
      <div style="background:#FEF2F2;border:2px solid #DC2626;border-radius:12px;padding:20px;margin-bottom:20px;position:relative;">
        <div style="position:absolute;top:-1px;right:16px;background:#DC2626;color:#fff;font-size:11px;font-weight:800;padding:4px 12px;border-radius:0 0 8px 8px;letter-spacing:1px;">MISSED</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
          <span style="background:#DC2626;color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:12px;">${priority.toUpperCase()} PRIORITY</span>
          ${task.taskType && task.taskType !== "regular" ? `<span style="background:#6B7280;color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:12px;">${task.taskType.toUpperCase()}</span>` : ""}
        </div>
        <h2 style="margin:0 0 12px;font-size:18px;color:#111827;font-weight:700;text-decoration:line-through;text-decoration-color:#DC2626;text-decoration-thickness:2px;">${task.title}</h2>
        <div style="font-size:13px;color:#6B7280;line-height:1.8;">
          <div>📅 <strong>Was due:</strong> ${dueText}</div>
          <div>⏱ <strong>Missed by:</strong> ${hoursOverdue} hours (${daysOverdue} ${dayWord})</div>
        </div>
      </div>

      ${
        isCriticalHigh
          ? `
      <!-- Escalation Alert -->
      <div style="background:#1A0000;border-radius:10px;padding:18px 20px;margin-bottom:20px;">
        <p style="margin:0;color:#FCA5A5;font-size:14px;font-weight:600;line-height:1.6;">
          🔴 <strong style="color:#FEE2E2;">Manager Escalation:</strong> Because this is a <strong>${priority}</strong> priority task, your direct manager has been automatically notified about this missed deadline.
        </p>
      </div>`
          : `
      <!-- Reschedule Prompt -->
      <div style="background:#FFF7ED;border:1px solid #F59E0B;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
        <p style="margin:0;color:#92400E;font-size:14px;line-height:1.6;">
          📋 Please either <strong>complete this task immediately</strong> or <strong>update the due date</strong> with a valid reason so your team stays informed.
        </p>
      </div>`
      }

      <!-- CTA -->
      <div style="text-align:center;margin-top:8px;">
        <a href="${taskUrl}" style="display:inline-block;background:linear-gradient(135deg,#991B1B,#DC2626);color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:800;font-size:15px;letter-spacing:0.5px;">Complete Task Now →</a>
        <p style="margin:12px 0 0;color:#9CA3AF;font-size:12px;">This is your final automated reminder for this task.</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#1F2937;padding:18px 32px;text-align:center;">
      <p style="margin:0;color:#6B7280;font-size:12px;">© ${new Date().getFullYear()} TaskSetu — Automated MISSED task alert. Do not reply.</p>
    </div>
  </div>
</body>
</html>`;

      return await this.sendEmail({
        to: user.email,
        subject: `⛔ MISSED: "${task.title}" — ${daysOverdue} ${dayWord} overdue`,
        html,
        text: `Hi ${firstName}, FINAL NOTICE: You missed your ${priority} priority task "${task.title}". It was due ${dueText} and is now ${daysOverdue} ${dayWord} (${hoursOverdue} hours) overdue. ${isCriticalHigh ? "Your manager has been notified." : "Please complete or reschedule it."} View task: ${taskUrl}`,
      });
    } catch (error) {
      console.error(
        "[Email] ❌ Error sending missed task email:",
        error.message,
      );
      return false;
    }
  }
}

export const emailService = new EmailService();
