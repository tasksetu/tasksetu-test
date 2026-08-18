/**
 * EmailTaskService — Email Task Engine
 *
 * Extends the existing emailService.js — does NOT duplicate SMTP logic.
 * Handles: variable replacement, form link generation, recipient tracking,
 * re-send, and open/submit tracking.
 */

import crypto from "crypto";
import { Task, EmailRecipientTracking, WorkflowFormToken } from "../models.js";
import { emailService } from "../services/emailService.js"; // Reuse existing SMTP/Resend service
import { RecipientStatus } from "../constants/workflowEnums.js";

class EmailTaskServiceClass {
  /**
   * Send the email for an Email Task.
   * Called automatically when an Email Task transitions to IN_PROGRESS.
   *
   * @param {Object} task - The Email Task document (populated)
   */
  async sendEmailTask(task) {
    if (!task.emailConfig) {
      console.warn(`[EmailTaskService] Task ${task._id} has no emailConfig. Skipping send.`);
      return;
    }

    const { recipients, subject, body, variables, attachedFormId, formLinkEnabled } =
      task.emailConfig;

    if (!recipients || recipients.length === 0) {
      console.warn(`[EmailTaskService] Task ${task._id} has no recipients.`);
      return;
    }

    // Resolve actual recipient list (expand form-mapped recipients)
    const resolvedRecipients = await this._resolveRecipients(task, recipients);

    for (const recipient of resolvedRecipients) {
      await this._sendToRecipient(task, recipient, subject, body, variables, {
        attachedFormId,
        formLinkEnabled,
        sendCycle: (task.emailConfig.sendCount || 0) + 1,
      });
    }

    // Update send count and lastSentAt on the task
    await Task.findByIdAndUpdate(task._id, {
      $set: {
        "emailConfig.sendCount": (task.emailConfig.sendCount || 0) + 1,
        "emailConfig.lastSentAt": new Date(),
      },
    });

    console.log(
      `[EmailTaskService] Sent email task ${task._id} to ${resolvedRecipients.length} recipients`,
    );
  }

  /**
   * Re-send emails for an Email Task.
   *
   * @param {ObjectId} taskId
   * @param {string} mode - "all" | "pending" (pending = not yet submitted or failed)
   * @param {Object} actor
   */
  async reSendEmailTask(taskId, mode = "pending", actor) {
    const task = await Task.findById(taskId);
    if (!task) throw new Error("Email task not found.");

    let trackingFilter = { task: taskId };
    if (mode === "pending") {
      trackingFilter.status = {
        $in: [RecipientStatus.PENDING, RecipientStatus.SENT, RecipientStatus.FAILED],
      };
    }

    const trackingRecords = await EmailRecipientTracking.find(trackingFilter);

    const newSendCycle = (task.emailConfig?.sendCount || 0) + 1;

    for (const record of trackingRecords) {
      const recipient = { name: record.name, email: record.email };
      await this._sendToRecipient(
        task,
        recipient,
        task.emailConfig?.subject,
        task.emailConfig?.body,
        task.emailConfig?.variables,
        {
          attachedFormId: task.emailConfig?.attachedFormId,
          formLinkEnabled: task.emailConfig?.formLinkEnabled,
          sendCycle: newSendCycle,
          existingTrackingId: record._id,
        },
      );
    }

    await Task.findByIdAndUpdate(taskId, {
      $set: {
        "emailConfig.sendCount": newSendCycle,
        "emailConfig.lastSentAt": new Date(),
      },
    });

    console.log(
      `[EmailTaskService] Re-sent email task ${taskId} to ${trackingRecords.length} recipients (mode: ${mode})`,
    );
  }

  /**
   * Get recipient status for an Email Task.
   *
   * @param {ObjectId} taskId
   * @returns {Promise<Array>} - Array of EmailRecipientTracking documents
   */
  async getRecipientStatus(taskId) {
    return await EmailRecipientTracking.find({ task: taskId }).sort({
      createdAt: -1,
    });
  }

  /**
   * Track an email open event via the tracking pixel/link.
   * Called by the public tracking route.
   *
   * @param {string} formToken
   */
  async trackOpen(formToken) {
    const record = await EmailRecipientTracking.findOne({ formToken });
    if (record && record.status === RecipientStatus.SENT) {
      await EmailRecipientTracking.findByIdAndUpdate(record._id, {
        $set: { status: RecipientStatus.OPENED, openedAt: new Date() },
      });
    }
  }

  /**
   * Mark a recipient as submitted after form submission.
   *
   * @param {string} formToken
   * @param {ObjectId} formSubmissionId
   */
  async trackFormSubmit(formToken, formSubmissionId) {
    await EmailRecipientTracking.findOneAndUpdate(
      { formToken },
      {
        $set: {
          status: RecipientStatus.SUBMITTED,
          submittedAt: new Date(),
          formSubmissionId,
        },
      },
    );
    // Also mark the WorkflowFormToken as used
    await WorkflowFormToken.findOneAndUpdate(
      { token: formToken },
      {
        $set: {
          isUsed: true,
          usedAt: new Date(),
          formSubmissionId,
        },
        $inc: { submissionCount: 1 },
      },
    );
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /**
   * Resolve recipients list — expands form-mapped entries into actual name+email.
   * Currently returns manual recipients as-is.
   * TODO: implement form-field resolution in Phase 8.
   */
  async _resolveRecipients(task, recipients) {
    return recipients
      .filter((r) => r && r.email)
      .map((r) => ({
        name: r.name || r.email,
        email: r.email,
        source: r.source,
        variables: r.variables || {},
      }));
  }

  /**
   * Send the email to a single recipient, create/update tracking record.
   */
  async _sendToRecipient(task, recipient, subject, bodyTemplate, variables, options = {}) {
    const { attachedFormId, formLinkEnabled, sendCycle = 1, existingTrackingId } = options;

    // 1. Generate a secure form token for this recipient (if form is attached)
    let formToken = null;
    let formLink = null;
    if (formLinkEnabled && attachedFormId) {
      formToken = await this._generateFormToken(task, recipient, attachedFormId);
      const baseUrl = process.env.CLIENT_URL || "https://tasksetu.app";
      formLink = `${baseUrl}/public/forms/${formToken}`;
    }

    // 2. Replace variables in the body (including recipient name, email & per-recipient variables)
    const resolvedBody = await this._replaceVariables(task, bodyTemplate || "", variables || [], recipient);

    // 3. Append form link to the bottom of the email body (if applicable)
    const finalBody = formLink
      ? `${resolvedBody}\n\n<hr/><p>Please fill out the required form: <a href="${formLink}">${formLink}</a></p>`
      : resolvedBody;

    // 4. Create/update tracking record
    let trackingRecord;
    if (existingTrackingId) {
      trackingRecord = await EmailRecipientTracking.findByIdAndUpdate(
        existingTrackingId,
        {
          $set: {
            status: RecipientStatus.SENT,
            sendCycle,
            sentAt: new Date(),
            formToken,
            failureReason: null,
          },
        },
        { new: true },
      );
    } else {
      trackingRecord = await EmailRecipientTracking.create({
        task: task._id,
        organization: task.organization || null,
        name: recipient.name,
        email: recipient.email,
        status: RecipientStatus.SENT,
        sendCycle,
        sentAt: new Date(),
        formToken,
      });
    }

    // 5. Prepare file attachments (from task attachments or emailConfig attachments)
    let formattedAttachments = [];
    const rawAttachments = [
      ...(task.attachments || []),
      ...(task.emailConfig?.attachments || []),
    ];

    if (rawAttachments.length > 0) {
      try {
        const fs = await import("fs");
        const pathModule = await import("path");
        const r2Storage = await import("../services/r2Storage.js");

        for (const att of rawAttachments) {
          try {
            const fileName = att.originalName || att.name || att.filename || "attachment";
            let fileBuffer = null;

            // Option A: Try Cloudflare R2 first if R2 storage is enabled
            if (r2Storage.isR2Enabled()) {
              try {
                const r2Key =
                  r2Storage.getR2KeyFromPathOrUrl(att.path) ||
                  r2Storage.getR2KeyFromPathOrUrl(att.url) ||
                  (att.filename ? `task-attachments/${att.filename}` : null);

                if (r2Key) {
                  console.log(`📡 [EmailTaskService] Fetching attachment from R2 key: ${r2Key}`);
                  const stream = await r2Storage.downloadFromR2(r2Key);
                  if (stream) {
                    const chunks = [];
                    for await (const chunk of stream) {
                      chunks.push(Buffer.from(chunk));
                    }
                    fileBuffer = Buffer.concat(chunks);
                    console.log(`✅ [EmailTaskService] Downloaded from R2: ${fileName} (${fileBuffer.length} bytes)`);
                  }
                }
              } catch (r2Err) {
                console.warn(`⚠️ [EmailTaskService] Failed to read from R2:`, r2Err.message);
              }
            }

            // Option B: Fallback to local disk file if not found in R2
            if (!fileBuffer) {
              const candidatePaths = [
                att.path,
                att.filename ? pathModule.join(process.cwd(), "uploads", "task-attachments", att.filename) : null,
                att.path ? pathModule.join(process.cwd(), "uploads", att.path) : null,
                att.path ? pathModule.join(process.cwd(), att.path) : null,
                att.url ? pathModule.join(process.cwd(), att.url.replace(/^\//, "")) : null,
              ].filter(Boolean);

              for (const p of candidatePaths) {
                if (fs.existsSync(p)) {
                  fileBuffer = fs.readFileSync(p);
                  console.log(`✅ [EmailTaskService] Read attachment from local disk: ${fileName} (${fileBuffer.length} bytes)`);
                  break;
                }
              }
            }

            // Option C: Fallback to HTTP URL fetch if URL exists
            if (!fileBuffer && att.url) {
              try {
                let fileUrl = att.url;
                if (r2Storage.isR2Enabled()) {
                  const r2Key = r2Storage.getR2KeyFromPathOrUrl(att.url) || att.filename;
                  const signed = await r2Storage.getSignedUrlForGetObject(r2Key);
                  if (signed) fileUrl = signed;
                } else if (!fileUrl.startsWith("http")) {
                  fileUrl = `http://localhost:5000${fileUrl.startsWith("/") ? "" : "/"}${fileUrl}`;
                }

                const fetchRes = await fetch(fileUrl).catch(() => null);
                if (fetchRes && fetchRes.ok) {
                  const arrayBuf = await fetchRes.arrayBuffer();
                  fileBuffer = Buffer.from(arrayBuf);
                  console.log(`✅ [EmailTaskService] Downloaded attachment via URL fetch: ${fileName} (${fileBuffer.length} bytes)`);
                }
              } catch (fetchErr) {
                console.error(`⚠️ [EmailTaskService] Failed to fetch attachment URL:`, fetchErr.message);
              }
            }

            if (fileBuffer) {
              formattedAttachments.push({
                filename: fileName,
                content: fileBuffer.toString("base64"),
              });
            } else {
              console.error(`❌ [EmailTaskService] Could not resolve file buffer for attachment: ${fileName}`);
            }
          } catch (attErr) {
            console.error("[EmailTaskService] Error reading attachment:", attErr.message);
          }
        }
      } catch (importErr) {
        console.error("[EmailTaskService] Failed to import modules:", importErr.message);
      }
    }

    // 6. Send via existing emailService.js (reuse SMTP/Resend logic)
    try {
      await emailService.sendEmail({
        to: recipient.email,
        subject: subject || task.title,
        html: finalBody,
        attachments: formattedAttachments,
      });
    } catch (err) {
      console.error(
        `[EmailTaskService] Failed to send to ${recipient.email}:`,
        err.message,
      );
      await EmailRecipientTracking.findByIdAndUpdate(trackingRecord._id, {
        $set: {
          status: RecipientStatus.FAILED,
          failedAt: new Date(),
          failureReason: err.message,
        },
      });
    }
  }

  /**
   * Replace {variable} placeholders in an email body template.
   * Supports per-recipient variable overrides.
   *
   * @param {Object} task
   * @param {string} body
   * @param {Array} variables
   * @param {Object} recipient - { name, email, variables }
   * @returns {string} - Resolved body
   */
  async _replaceVariables(task, body, variables, recipient = {}) {
    let resolved = body || "";

    const getRecipientVarValue = (key) => {
      if (!recipient || !recipient.variables) return undefined;
      let varsObj = recipient.variables;

      if (varsObj instanceof Map || (typeof varsObj.entries === "function" && typeof varsObj.get === "function")) {
        varsObj = Object.fromEntries(Array.from(varsObj.entries()));
      } else if (typeof varsObj.toObject === "function") {
        const rawObj = varsObj.toObject();
        if (rawObj instanceof Map) {
          varsObj = Object.fromEntries(Array.from(rawObj.entries()));
        } else {
          varsObj = rawObj;
        }
      }

      if (typeof varsObj !== "object" || !varsObj || !key) return undefined;
      if (varsObj[key] !== undefined && varsObj[key] !== null) return varsObj[key];

      const cleanTarget = String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
      for (const [k, val] of Object.entries(varsObj)) {
        const cleanK = String(k).toLowerCase().replace(/[^a-z0-9]/g, "");
        if (cleanK === cleanTarget && val !== undefined && val !== null) {
          return val;
        }
      }
      return undefined;
    };

    // 1. Replace Recipient Name placeholders
    const nameOverride = getRecipientVarValue("name") || getRecipientVarValue("Name");
    const recipientName = nameOverride || recipient.name || recipient.email?.split("@")[0] || "Valued Recipient";
    resolved = resolved
      .replace(/\{name\}/gi, recipientName)
      .replace(/\{recipientName\}/gi, recipientName)
      .replace(/\{recipient_name\}/gi, recipientName)
      .replace(/\{vendorName\}/gi, recipientName)
      .replace(/\{vendor_name\}/gi, recipientName);

    // 2. Replace Recipient Email placeholders
    const emailOverride = getRecipientVarValue("email") || getRecipientVarValue("Email");
    const recipientEmail = emailOverride || recipient.email;
    if (recipientEmail) {
      resolved = resolved
        .replace(/\{email\}/gi, recipientEmail)
        .replace(/\{recipientEmail\}/gi, recipientEmail)
        .replace(/\{recipient_email\}/gi, recipientEmail);
    }

    // Helper to safely escape regex special characters in variable keys
    const escapeRegExp = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Helper to format variable values for inline HTML substitution
    const formatVariableValueForInlineHtml = (val) => {
      if (val === undefined || val === null) return "";
      let strVal = String(val).trim();
      // If variable value contains a single wrapping <p>...</p>, strip outer <p> and </p>
      // so it embeds inline without breaking paragraph layout in email clients
      if (/^<p\b[^>]*>(.*?)<\/p>$/is.test(strVal)) {
        strVal = strVal.replace(/^<p\b[^>]*>(.*?)<\/p>$/is, "$1").trim();
      }
      return strVal;
    };

    // 3. Replace User-Defined Template Variables (case-insensitive placeholder replacement)
    for (const variable of variables || []) {
      if (variable.key) {
        const regex = new RegExp(`\\{${escapeRegExp(variable.key)}\\}`, "gi");
        const perRecipientVal = getRecipientVarValue(variable.key);
        let rawVal = perRecipientVal !== undefined && perRecipientVal !== null
          ? perRecipientVal
          : (variable.staticValue || "");
        let value = formatVariableValueForInlineHtml(rawVal);
        resolved = resolved.replace(regex, value);
      }
    }

    // 4. Fallback replacement for any arbitrary custom variables stored on recipient.variables
    if (recipient.variables) {
      let varsObj = recipient.variables;
      if (typeof recipient.variables.toObject === "function") {
        varsObj = recipient.variables.toObject();
      } else if (recipient.variables instanceof Map) {
        varsObj = Object.fromEntries(recipient.variables.entries());
      }
      if (varsObj && typeof varsObj === "object") {
        for (const [k, v] of Object.entries(varsObj)) {
          if (k && v !== undefined && v !== null) {
            const regex = new RegExp(`\\{${escapeRegExp(k)}\\}`, "gi");
            const formattedV = formatVariableValueForInlineHtml(v);
            resolved = resolved.replace(regex, formattedV);
          }
        }
      }
    }

    return resolved;
  }

  /**
   * Generate a cryptographically secure token and store it in WorkflowFormToken.
   *
   * @param {Object} task
   * @param {Object} recipient
   * @param {ObjectId} formId
   * @returns {Promise<string>} - The generated token string
   */
  async _generateFormToken(task, recipient, formId) {
    const token = crypto.randomUUID();
    console.log("🔑 [EmailTaskService] _generateFormToken called for:", {
      taskId: task._id,
      recipientEmail: recipient.email,
      formId,
    });

    const existing = await WorkflowFormToken.findOne({
      task: task._id,
      recipientEmail: recipient.email,
      isUsed: false,
    });

    if (existing) {
      console.log("🔑 [EmailTaskService] Reusing existing token:", existing.token);
      return existing.token;
    }

    try {
      const newTokenDoc = await WorkflowFormToken.create({
        token,
        task: task._id,
        organization: task.organization || null,
        form: formId,
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        allowMultipleSubmissions: false,
      });
      console.log("✅ [EmailTaskService] Successfully created WorkflowFormToken in DB:", newTokenDoc.token);
      return token;
    } catch (createErr) {
      console.error("❌ [EmailTaskService] Failed to create WorkflowFormToken in DB:", createErr);
      throw createErr;
    }
  }
}

export const EmailTaskService = new EmailTaskServiceClass();
