/**
 * Workflow Engine Routes — Phases 3-13
 *
 * All new workflow engine endpoints.
 * Mounted at /api/workflow in index.ts.
 *
 * Existing task/subtask creation continues to work via existing routes.
 * These routes ADD new workflow-specific capabilities.
 */

import express from "express";
import { authenticateToken } from "../auth.js";
import { Task } from "../models.js";
import { WorkflowService } from "../workflow/WorkflowService.js";
import { LinkedTaskService } from "../workflow/LinkedTaskService.js";
import { VisibilityService } from "../workflow/VisibilityService.js";
import { ApprovalService } from "../workflow/ApprovalService.js";
import { EmailTaskService } from "../workflow/EmailTaskService.js";
import { WorkflowFormToken, EmailRecipientTracking } from "../models.js";

const router = express.Router();

// ─── Phase 8: Public Form Token (No Auth Required) ─────────────────────────────

/**
 * GET /api/workflow/public/forms/:token
 * Load a form for a recipient using a secure token.
 * No authentication required.
 */
router.get("/public/forms/:token", async (req, res) => {
  try {
    const { token } = req.params;
    console.log("🔍 [PublicFormRoute] Received token lookup request:", token);
    const tokenDoc = await WorkflowFormToken.findOne({ token })
      .populate("task", "title emailConfig organization");

    console.log("🔍 [PublicFormRoute] tokenDoc result:", tokenDoc ? tokenDoc._id : "NULL");

    if (!tokenDoc) {
      const totalTokens = await WorkflowFormToken.countDocuments();
      console.log(`⚠️ [PublicFormRoute] Token "${token}" NOT found. Total tokens in DB: ${totalTokens}`);
      return res.status(404).json({ success: false, message: "Form link not found or expired." });
    }

    if (tokenDoc.expiresAt && new Date() > tokenDoc.expiresAt) {
      return res.status(410).json({ success: false, message: "This form link has expired." });
    }

    if (tokenDoc.isUsed && !tokenDoc.allowMultipleSubmissions) {
      return res.status(409).json({
        success: false,
        message: "This form has already been submitted.",
      });
    }

    // Load full form schema from FormTemplate model (or Form model fallback)
    const { FormTemplate } = await import("../modals/formTemplateModal.js");
    const { Form } = await import("../models.js");
    let formObj = null;
    if (tokenDoc.form) {
      formObj =
        (await FormTemplate.findById(tokenDoc.form).lean()) ||
        (await Form.findById(tokenDoc.form).lean());
    }

    // Track open event
    await EmailTaskService.trackOpen(token).catch(() => null);

    res.json({
      success: true,
      data: {
        form: formObj || tokenDoc.form,
        taskTitle: tokenDoc.task?.title,
        recipientName: tokenDoc.recipientName,
        recipientEmail: tokenDoc.recipientEmail,
        token,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/workflow/public/forms/:token/submit
 * Submit a form response via a public token. No auth required.
 * Body: form field responses
 */
router.post("/public/forms/:token/submit", async (req, res) => {
  try {
    const { token } = req.params;
    const tokenDoc = await WorkflowFormToken.findOne({ token });

    if (!tokenDoc) {
      return res.status(404).json({ success: false, message: "Form link not found." });
    }

    if (tokenDoc.expiresAt && new Date() > tokenDoc.expiresAt) {
      return res.status(410).json({ success: false, message: "This form link has expired." });
    }

    if (tokenDoc.isUsed && !tokenDoc.allowMultipleSubmissions) {
      return res.status(409).json({ success: false, message: "Already submitted." });
    }

    // Store the form submission using the existing FormSubmission model
    const { FormSubmission } = await import("../modals/formVersionModal.js").catch(() => ({
      FormSubmission: null,
    }));

    let submissionId = null;
    if (FormSubmission) {
      const submission = await FormSubmission.create({
        form: tokenDoc.form,
        task: tokenDoc.task,
        organization: tokenDoc.organization,
        submittedBy: null, // External recipient, no account
        submitterEmail: tokenDoc.recipientEmail,
        submitterName: tokenDoc.recipientName,
        responses: req.body.responses || [],
        metadata: { token, source: "email_task_form_link" },
      }).catch(() => null);
      submissionId = submission?._id;
    }

    // Mark token as used and track submission
    await EmailTaskService.trackFormSubmit(token, submissionId);

    res.json({ success: true, message: "Form submitted successfully. Thank you!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Protected Internal Workflow Routes (JWT Required) ─────────────────────────
router.use(authenticateToken);

/**
 * GET /api/workflow/forms/:formId/submissions-recipients
 * Fetches all respondents from form submissions and tokens for a given form ID.
 * Returns deduplicated list of [{ id, name, email, submittedAt, source }]
 */
router.get("/forms/:formId/submissions-recipients", async (req, res) => {
  try {
    const { formId } = req.params;
    const mongoose = (await import("mongoose")).default;

    let FormSubmission = null;
    try {
      const mod = await import("../modals/formSubmissionModal.js");
      FormSubmission = mod.FormSubmission || mod.default;
    } catch (e) {
      console.warn("Could not import FormSubmission model:", e.message);
    }

    const recipientMap = new Map();

    // 0. Build Field ID/Code -> Field Label Map from FormTemplate
    const fieldMap = new Map();
    try {
      const { FormTemplate } = await import("../modals/formTemplateModal.js");
      let formDoc = null;
      if (mongoose.Types.ObjectId.isValid(formId)) {
        formDoc = await FormTemplate.findById(formId).lean();
      }
      if (!formDoc) {
        formDoc = await FormTemplate.findOne({ form_id: formId }).lean();
      }
      if (formDoc && Array.isArray(formDoc.fields)) {
        for (const f of formDoc.fields) {
          const label = f.label || f.name || f.title || f.field_label || "";
          if (label) {
            if (f.field_code) fieldMap.set(String(f.field_code), label);
            if (f.field_id) fieldMap.set(String(f.field_id), label);
            if (f._id) fieldMap.set(String(f._id), label);
          }
        }
      }
    } catch (e) {
      console.warn("Could not load FormTemplate fields map:", e.message);
    }

    // 1. Fetch from FormSubmission collection
    const formObjectId = mongoose.Types.ObjectId.isValid(formId) ? new mongoose.Types.ObjectId(formId) : formId;

    if (FormSubmission) {
      const submissions = await FormSubmission.find({
        $or: [
          { form: formId },
          { form: formObjectId },
          { form_id: formId },
          { form_id: formObjectId },
          { form_template_id: formId },
          { form_template_id: formObjectId },
        ],
      })
        .sort({ createdAt: -1, created_at: -1, submitted_at: -1 })
        .lean();

      for (const sub of submissions) {
        let email = sub.submitterEmail || sub.submitted_by?.email;
        let name = sub.submitterName || sub.submitted_by?.name || sub.submitted_by?.username;
        const fieldVars = {};

        // 1. Extract from submission_data_json (Object mapping)
        const rawJsonData = sub.submission_data_json || sub.submissionData || sub.data || sub.formData;
        if (rawJsonData && typeof rawJsonData === "object") {
          for (const [key, val] of Object.entries(rawJsonData)) {
            if (key && val != null) {
              const strVal = typeof val === "string" ? val.trim() : String(val);
              if (strVal) {
                const mappedLabel = fieldMap.get(key) || fieldMap.get(String(key)) || key;
                const displayKey = String(mappedLabel).trim();
                
                if (displayKey) fieldVars[displayKey] = strVal;

                if (!email && (displayKey.toLowerCase().includes("email") || strVal.includes("@"))) {
                  email = strVal;
                }
                if (!name && (displayKey.toLowerCase().includes("name") || displayKey.toLowerCase().includes("full name"))) {
                  name = strVal;
                }
              }
            }
          }
        }

        // 2. Extract from responses (Array mapping)
        const responsesArr = sub.responses || sub.response_data;
        if (Array.isArray(responsesArr)) {
          for (const resp of responsesArr) {
            const rawLabel = resp.field_label || resp.label || resp.fieldId || resp.fieldName || "";
            const mappedLabel = fieldMap.get(rawLabel) || fieldMap.get(String(rawLabel)) || rawLabel;
            const val = typeof resp.value === "string" ? resp.value.trim() : (resp.value != null ? String(resp.value) : "");
            
            if (mappedLabel && val) {
              const displayKey = String(mappedLabel).trim();
              if (displayKey) fieldVars[displayKey] = val;
            }

            if (!email && (String(mappedLabel).toLowerCase().includes("email") || val.includes("@"))) {
              email = val;
            }
            if (!name && (String(mappedLabel).toLowerCase().includes("name") || String(mappedLabel).toLowerCase().includes("full name"))) {
              name = val;
            }
          }
        }

        if (email && email.includes("@")) {
          const cleanEmail = email.trim().toLowerCase();
          const existing = recipientMap.get(cleanEmail);
          if (!existing || (Object.keys(fieldVars).length > 0 && Object.keys(existing.variables || {}).length === 0)) {
            recipientMap.set(cleanEmail, {
              id: sub._id.toString(),
              name: name ? name.trim() : cleanEmail.split("@")[0],
              email: cleanEmail,
              submittedAt: sub.createdAt || sub.created_at || sub.submitted_at || new Date(),
              source: "Form Submissions",
              variables: fieldVars,
            });
          }
        }
      }
    }

    // 2. Fetch from WorkflowFormToken collection
    const tokens = await WorkflowFormToken.find({
      $or: [
        { form: formId },
        { form: formObjectId },
      ],
    })
      .select("recipientName recipientEmail createdAt isUsed formSubmissionId")
      .sort({ createdAt: -1 })
      .lean();

    for (const t of tokens) {
      if (t.recipientEmail && t.recipientEmail.includes("@")) {
        const cleanEmail = t.recipientEmail.trim().toLowerCase();
        if (!recipientMap.has(cleanEmail)) {
          let tokenVars = {};
          if (t.formSubmissionId && FormSubmission) {
            try {
              const subDoc = await FormSubmission.findById(t.formSubmissionId).lean();
              if (subDoc && subDoc.submission_data_json) {
                for (const [key, val] of Object.entries(subDoc.submission_data_json)) {
                  if (key && val != null) {
                    const mappedLabel = fieldMap.get(key) || fieldMap.get(String(key)) || key;
                    const cleanKey = String(mappedLabel).trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
                    const strVal = String(val).trim();
                    if (cleanKey) tokenVars[cleanKey] = strVal;
                    tokenVars[String(mappedLabel).trim()] = strVal;
                    tokenVars[String(mappedLabel).trim().toLowerCase()] = strVal;
                  }
                }
              }
            } catch (e) {
              console.warn("Could not load formSubmissionId for token:", e.message);
            }
          }

          recipientMap.set(cleanEmail, {
            id: t._id.toString(),
            name: t.recipientName ? t.recipientName.trim() : cleanEmail.split("@")[0],
            email: cleanEmail,
            submittedAt: t.createdAt,
            source: "Workflow Token",
            variables: tokenVars,
          });
        }
      }
    }

    const recipients = Array.from(recipientMap.values());

    res.json({
      success: true,
      count: recipients.length,
      data: recipients,
    });
  } catch (err) {
    console.error("❌ Error fetching submission recipients:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Phase 3: Parent Cancellation Config ──────────────────────────────────────

/**
 * PATCH /api/workflow/tasks/:id/configuration
 * Update a task's workflow configuration (parentCancellationMode, autoInitiate, etc.)
 */
router.patch("/tasks/:id/configuration", async (req, res) => {
  try {
    const { id } = req.params;
    const { parentCancellationMode, autoInitiate, autoComplete, autoCompleteAfterDays } = req.body;

    const updateFields = {};
    if (parentCancellationMode !== undefined)
      updateFields["configuration.parentCancellationMode"] = parentCancellationMode;
    if (autoInitiate !== undefined)
      updateFields["configuration.autoInitiate"] = autoInitiate;
    if (autoComplete !== undefined)
      updateFields["configuration.autoComplete"] = autoComplete;
    if (autoCompleteAfterDays !== undefined)
      updateFields["configuration.autoCompleteAfterDays"] = autoCompleteAfterDays;

    const task = await Task.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true },
    );

    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    res.json({ success: true, data: task });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Phase 4: Linked Task Engine ───────────────────────────────────────────────

/**
 * GET /api/workflow/tasks/:parentId/eligible-linked-tasks?sequence=N&excludeId=X
 * Returns tasks eligible to be a dependency for a task at the given sequence.
 * Rules: same parent, lower sequence, not already linked by someone else.
 */
router.get("/tasks/:parentId/eligible-linked-tasks", async (req, res) => {
  try {
    const { parentId } = req.params;
    const { sequence = 1, excludeId } = req.query;

    const eligible = await LinkedTaskService.getEligibleLinkedTasks(
      parentId,
      Number(sequence),
      excludeId || null,
    );

    res.json({ success: true, data: eligible });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/workflow/tasks/:id/linked-task
 * Set the linkedTaskId for a task (dependency).
 */
router.patch("/tasks/:id/linked-task", async (req, res) => {
  try {
    const { id } = req.params;
    const { linkedTaskId } = req.body;

    const task = await Task.findByIdAndUpdate(
      id,
      { $set: { linkedTaskId: linkedTaskId || null } },
      { new: true },
    );

    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    res.json({ success: true, data: task });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Phase 5: Visibility Engine ────────────────────────────────────────────────

/**
 * GET /api/workflow/tasks/:id/visibility
 * Get all visible users for a task.
 */
router.get("/tasks/:id/visibility", async (req, res) => {
  try {
    const visibleUsers = await VisibilityService.getVisibleUsers(req.params.id);
    res.json({ success: true, data: visibleUsers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/workflow/tasks/:id/visibility
 * Add a user to the visible users list.
 * Body: { userId, permissions: { canComment, canViewAttachments, canViewFormData } }
 */
router.post("/tasks/:id/visibility", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, permissions } = req.body;
    const actor = req.user;

    const task = await Task.findById(id).select("organization");
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    const record = await VisibilityService.addVisibleUser({
      taskId: id,
      userId,
      addedBy: actor.id,
      organizationId: task.organization,
      permissions,
    });

    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/workflow/tasks/:id/visibility/:userId
 * Remove a user from the visible users list.
 */
router.delete("/tasks/:id/visibility/:userId", async (req, res) => {
  try {
    await VisibilityService.removeVisibleUser(req.params.id, req.params.userId);
    res.json({ success: true, message: "Visibility removed" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/workflow/my-visible-tasks
 * Get all tasks visible to the current user (read-only access).
 */
router.get("/my-visible-tasks", async (req, res) => {
  try {
    const actor = req.user;
    const orgId = actor.organizationId || actor.organization;
    const visibleTasks = await VisibilityService.getVisibleTasksForUser(actor.id, orgId);
    res.json({ success: true, data: visibleTasks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Phase 10: Approval Actions ────────────────────────────────────────────────

/**
 * POST /api/workflow/tasks/:id/approve
 * Submit an approval decision.
 * Body: { comment }
 */
router.post("/tasks/:id/approve", async (req, res) => {
  try {
    const { comment } = req.body;
    const updatedTask = await ApprovalService.submitDecision({
      taskId: req.params.id,
      actor: req.user,
      decision: "approve",
      comment,
    });
    res.json({ success: true, data: updatedTask });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/workflow/tasks/:id/reject
 * Submit a rejection decision.
 * Body: { reason, rejectionAction: "terminate"|"reinitiate" }
 */
router.post("/tasks/:id/reject", async (req, res) => {
  try {
    const { reason, rejectionAction } = req.body;
    const updatedTask = await ApprovalService.submitDecision({
      taskId: req.params.id,
      actor: req.user,
      decision: "reject",
      rejectionReason: reason,
      rejectionAction,
    });
    res.json({ success: true, data: updatedTask });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/workflow/tasks/:id/approval-history
 * Get immutable approval history for a task, grouped by cycle.
 */
router.get("/tasks/:id/approval-history", async (req, res) => {
  try {
    const history = await ApprovalService.getApprovalHistory(req.params.id);
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/workflow/tasks/:id/reinitiate
 * Manually re-initiate an approval task (new cycle).
 * Body: { contextTaskId }
 */
router.post("/tasks/:id/reinitiate", async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    const contextTaskId = req.body.contextTaskId || task.contextTaskId;
    if (!contextTaskId) {
      return res.status(400).json({ success: false, message: "No context task configured." });
    }

    const lastHistory = await import("../models.js").then((m) =>
      m.ApprovalHistory.findOne({ task: req.params.id }).sort({ cycle: -1 }).select("cycle"),
    );
    const cycle = lastHistory?.cycle || 1;
    await ApprovalService.reInitiateContextTask(contextTaskId, req.params.id, cycle);

    res.json({ success: true, message: "Context task re-initiated." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Phase 7: Email Task ────────────────────────────────────────────────────────

/**
 * POST /api/workflow/tasks/:id/send-email
 * Manually trigger email sending for an email task.
 */
router.post("/tasks/:id/send-email", async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });
    if (task.taskType !== "email") {
      return res.status(400).json({ success: false, message: "This is not an email task." });
    }

    await EmailTaskService.sendEmailTask(task);
    res.json({ success: true, message: "Email sent successfully." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/workflow/tasks/:id/resend-email
 * Re-send emails. Body: { mode: "all"|"pending" }
 */
router.post("/tasks/:id/resend-email", async (req, res) => {
  try {
    const { mode = "pending" } = req.body;
    await EmailTaskService.reSendEmailTask(req.params.id, mode, req.user);
    res.json({ success: true, message: `Emails re-sent (mode: ${mode}).` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/workflow/tasks/:id/recipient-status
 * Get per-recipient tracking status for an email task.
 */
router.get("/tasks/:id/recipient-status", async (req, res) => {
  try {
    const status = await EmailTaskService.getRecipientStatus(req.params.id);
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/workflow/tasks/:id/email-config
 * Update the email configuration for an email task.
 */
router.patch("/tasks/:id/email-config", async (req, res) => {
  try {
    const { emailConfig } = req.body;
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: { emailConfig } },
      { new: true },
    );
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });
    res.json({ success: true, data: task });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});



// ─── Phase 13: Workflow Metadata ───────────────────────────────────────────────

/**
 * GET /api/workflow/types
 * Returns all available workflow types for the type selector.
 */
router.get("/types", async (_req, res) => {
  try {
    const { WorkflowTypeLabel, TaskTypeLabel } = await import(
      "../constants/workflowEnums.js"
    );
    res.json({
      success: true,
      data: {
        workflowTypes: Object.entries(WorkflowTypeLabel).map(([value, label]) => ({
          value,
          label,
        })),
        taskTypes: Object.entries(TaskTypeLabel).map(([value, label]) => ({
          value,
          label,
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/workflow/tasks/:parentId/subtasks
 * Get all subtasks of a parent, ordered by sequence.
 * Includes linkedTaskId resolution and completion status.
 */
router.get("/tasks/:parentId/subtasks", async (req, res) => {
  try {
    const { parentId } = req.params;
    const subtasks = await Task.find({
      $or: [{ parentTask: parentId }, { parentTaskId: parentId }],
      isDeleted: { $ne: true },
    })
      .sort({ sequence: 1, createdAt: 1 })
      .populate("assignedTo", "name email avatar")
      .populate("linkedTaskId", "title status sequence")
      .populate("contextTaskId", "title status");

    res.json({ success: true, data: subtasks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/workflow/tasks/:id/sequence
 * Update the sequence (order) of a subtask within its parent.
 * Body: { sequence: number }
 */
router.patch("/tasks/:id/sequence", async (req, res) => {
  try {
    const { sequence } = req.body;
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: { sequence } },
      { new: true },
    );
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });
    res.json({ success: true, data: task });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Phase 9: Scheduler Manual Trigger (admin only) ────────────────────────────

/**
 * POST /api/workflow/scheduler/run-auto-complete
 * Manually trigger the auto-complete job (for testing/admin).
 */
router.post("/scheduler/run-auto-complete", async (req, res) => {
  try {
    const { SchedulerService } = await import("../workflow/SchedulerService.js");
    const count = await SchedulerService.runAutoCompleteJob();
    res.json({ success: true, message: `Auto-complete job ran. Completed: ${count} tasks.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/workflow/scheduler/run-auto-approval
 * Manually trigger the auto-approval job (for testing/admin).
 */
router.post("/scheduler/run-auto-approval", async (req, res) => {
  try {
    const { SchedulerService } = await import("../workflow/SchedulerService.js");
    const count = await SchedulerService.runAutoApprovalJob();
    res.json({ success: true, message: `Auto-approval job ran. Approved: ${count} tasks.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
