import mongoose from "mongoose";
import ProcessTemplate from "./processTemplateModal.js";
import Task from "../modals/taskModal.js";
import { User } from "../modals/userModal.js";
import { FormTemplate } from "../modals/formTemplateModal.js";

/**
 * Get organization users for Process Builder select dropdowns
 */
export const getOrgUsers = async (req, res) => {
  try {
    const user = req.user;
    const orgId = user?.organizationId || user?.organization_id;

    let query = {};
    if (orgId) {
      query = { organization_id: orgId };
    }

    const users = await User.find(query)
      .select("_id firstName lastName email role profileImageUrl")
      .lean();

    const formattedUsers = users.map((u) => {
      const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
      return {
        id: u._id.toString(),
        name,
        email: u.email,
        role: Array.isArray(u.role) ? u.role.join(", ") : u.role || "Member",
        avatar: u.profileImageUrl || "",
      };
    });

    return res.json({ success: true, data: formattedUsers });
  } catch (error) {
    console.error("Error fetching org users for process builder:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get organization forms for Process Builder select dropdowns
 */
export const getOrgForms = async (req, res) => {
  try {
    const user = req.user;
    const orgId = user?.organizationId || user?.organization_id || user?.organization;
    const userId = user?.id || user?._id;

    let query = {
      is_deleted: { $ne: true },
      isDeleted: { $ne: true },
    };

    const conditions = [];
    if (userId) {
      conditions.push({ owner_user_id: userId });
      conditions.push({ createdBy: userId });
    }
    if (orgId) {
      conditions.push({ organization_id: orgId });
      conditions.push({ organization: orgId });
      conditions.push({ company_id: orgId });
    }

    if (conditions.length > 0) {
      query.$or = conditions;
    }

    const forms = await FormTemplate.find(query)
      .select("_id form_id title category fields status form_code owner_user_id")
      .lean();

    const formattedForms = forms.map((f) => ({
      _id: f._id.toString(),
      id: f._id.toString(),
      form_id: f.form_id || f._id.toString(),
      title: f.title || "Untitled Form",
      category: f.category || "General",
      form_code: f.form_code || "",
      fieldsCount: f.fields?.length || 0,
    }));

    return res.json({ success: true, data: formattedForms });
  } catch (error) {
    console.error("Error fetching org forms for process builder:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get all process templates
 */
export const getProcessTemplates = async (req, res) => {
  try {
    const orgId = req.user?.organizationId || req.user?.organization_id;

    let query = { isDeleted: false };
    if (orgId) {
      query.organizationId = orgId;
    }

    const processes = await ProcessTemplate.find(query)
      .sort({ createdAt: -1 })
      .lean();

    const formattedProcesses = processes.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      description: p.description,
      status: p.status,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      steps: p.steps || [],
    }));

    return res.json({ success: true, data: formattedProcesses });
  } catch (error) {
    console.error("Error fetching process templates:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get single process template by ID
 */
export const getProcessTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const process = await ProcessTemplate.findOne({ _id: id, isDeleted: false }).lean();

    if (!process) {
      return res.status(404).json({ success: false, message: "Process template not found" });
    }

    return res.json({
      success: true,
      data: {
        id: process._id.toString(),
        name: process.name,
        description: process.description,
        status: process.status,
        createdAt: process.createdAt,
        updatedAt: process.updatedAt,
        steps: process.steps || [],
      },
    });
  } catch (error) {
    console.error("Error fetching process template by id:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const normalizePriority = (val) => {
  if (!val) return "Medium";
  const str = (typeof val === "object" ? val.value : String(val)).trim().toLowerCase();
  if (str === "critical" || str === "urgent") return "Urgent";
  if (str === "high") return "High";
  if (str === "low") return "Low";
  return "Medium";
};

const normalizeVisibility = (val) => {
  if (!val) return "Private";
  const str = (typeof val === "object" ? val.value : String(val)).trim().toLowerCase();
  if (str === "public") return "Public";
  return "Private";
};

/**
 * Create a new process template
 */
export const createProcessTemplate = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const orgId = req.user?.organizationId || req.user?.organization_id;
    const { name, description, status, steps } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Process name is required" });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ success: false, message: "Process description is required" });
    }

    const formattedSteps = (steps || []).map((step, idx) => {
      const uRaw = typeof step.assignedUserId === "object"
        ? step.assignedUserId?.value || step.assignedUserId?.id || step.assignedUserId?._id
        : (typeof step.assignedTo === "object" ? step.assignedTo?.value || step.assignedTo?.id || step.assignedTo?._id : (step.assignedUserId || step.assignedTo));

      const tType = step.taskType || "Regular";
      const sType = step.subtaskType || tType.toLowerCase();
      const isAppr = Boolean(step.isApprovalTask || step.approvalRequired || tType.toLowerCase() === "approval");
      const isMs = Boolean(step.isMilestone || tType.toLowerCase() === "milestone");

      const rawApprovers = Array.isArray(step.approvers) && step.approvers.length > 0
        ? step.approvers
        : (Array.isArray(step.approverIds) ? step.approverIds : []);

      const cleanApprovers = rawApprovers
        .map((a) => (typeof a === "object" ? a.value || a.id || a._id : a))
        .filter(Boolean);

      const rawLinked = Array.isArray(step.linkedTasks) && step.linkedTasks.length > 0
        ? step.linkedTasks
        : (step.milestoneData?.linkedTaskIds || []);

      const cleanLinkedTasks = rawLinked
        .map((t) => (typeof t === "object" ? t.value || t.id || t._id : t))
        .filter(Boolean);

      const mType = step.milestoneType || (cleanLinkedTasks.length > 0 ? "linked" : "standalone");

      return {
        ...step,
        id: step.id || `step_${Date.now()}_${idx}`,
        name: step.name || step.title || step.taskName || `Step #${idx + 1}`,
        title: step.title || step.name || step.taskName || `Step #${idx + 1}`,
        taskType: tType,
        subtaskType: sType,
        mainTaskType: "regular",
        assignedUserId: uRaw || userId,
        assignedTo: uRaw || userId,
        dueDays: Number(step.dueDays) || 3,
        priority: normalizePriority(step.priority),
        status: step.status || "OPEN",
        visibility: normalizeVisibility(step.visibility),
        tags: Array.isArray(step.tags) ? step.tags : [],
        description: step.description || "",
        formId: step.formId || null,
        linkedTaskId: step.linkedTaskId || null,
        linkedToMilestone: step.linkedToMilestone || step.linkedTaskId || null,
        configuration: step.configuration || { autoInitiate: false },
        emailConfig: step.emailConfig || null,
        emailSubject: step.emailSubject || step.emailConfig?.subject || "",
        emailBody: step.emailBody || step.emailConfig?.body || "",
        emailAutoComplete: Boolean(step.emailAutoComplete || step.emailConfig?.autoComplete),
        approvalRequired: isAppr,
        isApprovalTask: isAppr,
        approvalMode: step.approvalMode || "any",
        approvers: cleanApprovers,
        approverIds: cleanApprovers,
        approvalInstructions: step.approvalInstructions || step.approvalContext || step.context || "",
        isMilestone: isMs,
        milestoneType: mType,
        milestoneData: step.milestoneData || {
          type: mType,
          linkedTaskIds: cleanLinkedTasks,
          completionCriteria: [],
          deliverables: [],
          stakeholders: [],
        },
        linkedTasks: cleanLinkedTasks,
        milestoneNotes: step.milestoneNotes || "",
      };
    });

    const newProcess = new ProcessTemplate({
      name: name.trim(),
      description: description.trim(),
      status: status || "Active",
      createdBy: userId,
      organizationId: orgId || null,
      steps: formattedSteps,
    });

    await newProcess.save();

    return res.status(201).json({
      success: true,
      data: {
        id: newProcess._id.toString(),
        name: newProcess.name,
        description: newProcess.description,
        status: newProcess.status,
        createdAt: newProcess.createdAt,
        updatedAt: newProcess.updatedAt,
        steps: newProcess.steps,
      },
    });
  } catch (error) {
    console.error("Error creating process template:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update an existing process template
 */
export const updateProcessTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status, steps } = req.body;

    const process = await ProcessTemplate.findOne({ _id: id, isDeleted: false });
    if (!process) {
      return res.status(404).json({ success: false, message: "Process template not found" });
    }

    if (name) process.name = name.trim();
    if (description) process.description = description.trim();
    if (status) process.status = status;
    if (steps) {
      process.steps = steps.map((step, idx) => {
        const uRaw = typeof step.assignedUserId === "object"
          ? step.assignedUserId?.value || step.assignedUserId?.id || step.assignedUserId?._id
          : (typeof step.assignedTo === "object" ? step.assignedTo?.value || step.assignedTo?.id || step.assignedTo?._id : (step.assignedUserId || step.assignedTo));

        const tType = step.taskType || "Regular";
        const sType = step.subtaskType || tType.toLowerCase();
        const isAppr = Boolean(step.isApprovalTask || step.approvalRequired || tType.toLowerCase() === "approval");
        const isMs = Boolean(step.isMilestone || tType.toLowerCase() === "milestone");

        const rawApprovers = Array.isArray(step.approvers) && step.approvers.length > 0
          ? step.approvers
          : (Array.isArray(step.approverIds) ? step.approverIds : []);

        const cleanApprovers = rawApprovers
          .map((a) => (typeof a === "object" ? a.value || a.id || a._id : a))
          .filter(Boolean);

        const rawLinked = Array.isArray(step.linkedTasks) && step.linkedTasks.length > 0
          ? step.linkedTasks
          : (step.milestoneData?.linkedTaskIds || []);

        const cleanLinkedTasks = rawLinked
          .map((t) => (typeof t === "object" ? t.value || t.id || t._id : t))
          .filter(Boolean);

        const mType = step.milestoneType || (cleanLinkedTasks.length > 0 ? "linked" : "standalone");

        return {
          ...step,
          id: step.id || `step_${Date.now()}_${idx}`,
          name: step.name || step.title || step.taskName || `Step #${idx + 1}`,
          title: step.title || step.name || step.taskName || `Step #${idx + 1}`,
          taskType: tType,
          subtaskType: sType,
          mainTaskType: "regular",
          assignedUserId: uRaw || req.user.id,
          assignedTo: uRaw || req.user.id,
          dueDays: Number(step.dueDays) || 3,
          priority: normalizePriority(step.priority),
          status: step.status || "OPEN",
          visibility: normalizeVisibility(step.visibility),
          tags: Array.isArray(step.tags) ? step.tags : [],
          description: step.description || "",
          formId: step.formId || null,
          linkedTaskId: step.linkedTaskId || null,
          linkedToMilestone: step.linkedToMilestone || step.linkedTaskId || null,
          configuration: step.configuration || { autoInitiate: false },
          emailConfig: step.emailConfig || null,
          emailSubject: step.emailSubject || step.emailConfig?.subject || "",
          emailBody: step.emailBody || step.emailConfig?.body || "",
          emailAutoComplete: Boolean(step.emailAutoComplete || step.emailConfig?.autoComplete),
          approvalRequired: isAppr,
          isApprovalTask: isAppr,
          approvalMode: step.approvalMode || "any",
          approvers: cleanApprovers,
          approverIds: cleanApprovers,
          approvalInstructions: step.approvalInstructions || step.approvalContext || step.context || "",
          isMilestone: isMs,
          milestoneType: mType,
          milestoneData: step.milestoneData || {
            type: mType,
            linkedTaskIds: cleanLinkedTasks,
            completionCriteria: [],
            deliverables: [],
            stakeholders: [],
          },
          linkedTasks: cleanLinkedTasks,
          milestoneNotes: step.milestoneNotes || "",
        };
      });
    }

    await process.save();

    return res.json({
      success: true,
      data: {
        id: process._id.toString(),
        name: process.name,
        description: process.description,
        status: process.status,
        createdAt: process.createdAt,
        updatedAt: process.updatedAt,
        steps: process.steps,
      },
    });
  } catch (error) {
    console.error("Error updating process template:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Soft delete a process template
 */
export const deleteProcessTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const process = await ProcessTemplate.findOne({ _id: id, isDeleted: false });

    if (!process) {
      return res.status(404).json({ success: false, message: "Process template not found" });
    }

    process.isDeleted = true;
    await process.save();

    return res.json({ success: true, message: "Process template deleted successfully", id });
  } catch (error) {
    console.error("Error deleting process template:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Launch / Start a Process Instance
 * Creates a Main Parent Task and Subtasks for each process step in the Task table.
 */
export const startProcessInstance = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const userRole = Array.isArray(req.user?.role) ? req.user.role : [req.user?.role || "employee"];
    const orgId = typeof req.user?.organization === "object"
      ? (req.user?.organization?._id || req.user?.organization?.id)
      : (req.user?.organizationId || req.user?.organization_id || req.user?.organization);
    const { processId, customName, notes, steps } = req.body;

    if (!processId) {
      return res.status(400).json({ success: false, message: "Process template ID is required" });
    }

    const template = await ProcessTemplate.findOne({ _id: processId, isDeleted: false }).lean();
    if (!template) {
      return res.status(404).json({ success: false, message: "Process template not found" });
    }

    const stepsToExecute = (Array.isArray(steps) && steps.length > 0) ? steps : (template.steps || []);

    const mainTaskTitle = (customName && customName.trim()) ? customName.trim() : template.name;
    const mainTaskDesc = notes && notes.trim()
      ? `${template.description}\n\n[Launch Notes]: ${notes.trim()}`
      : template.description;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const date = now.getDate();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    const stepOffsetDays = stepsToExecute.map((s) => (s.dueDays !== undefined && !isNaN(Number(s.dueDays))) ? Number(s.dueDays) : 3);
    const maxDueDays = stepOffsetDays.length > 0 ? Math.max(...stepOffsetDays) : 3;

    // Project convention: Store local time directly in UTC fields so TaskTable formatDateTime renders exact local launch time
    const parentDueDate = new Date(Date.UTC(year, month, date + maxDueDays, hours, minutes, seconds));

    // 1. Create Main Parent Task in Task collection
    const mainTask = new Task({
      title: mainTaskTitle,
      description: mainTaskDesc,
      taskType: "regular",
      mainTaskType: "regular",
      createdByRole: userRole,
      createdBy: userId,
      assignedTo: userId,
      organization: orgId || null,
      status: "OPEN",
      priority: "medium",
      dueDate: parentDueDate,
      source: "process-builder",
      isProcessBuilderTask: true,
      processTemplateId: template._id,
    });

    const savedMainTask = await mainTask.save();
    console.log("🚀 [startProcessInstance] Created mainTask with ID:", savedMainTask._id, "isPB:", savedMainTask.isProcessBuilderTask, "source:", savedMainTask.source, "templateId:", savedMainTask.processTemplateId);

    // 2. Create Subtask in Task collection for each step in process template
    const createdSubtasks = [];
    const stepIdToCreatedTaskIdMap = {};

    for (let idx = 0; idx < stepsToExecute.length; idx++) {
      const step = stepsToExecute[idx];

      // Calculate step due date offset preserving exact local launch time (e.g. 12:20 PM)
      const dueDays = (step.dueDays !== undefined && !isNaN(Number(step.dueDays))) ? Number(step.dueDays) : 3;
      const stepDueDate = new Date(Date.UTC(year, month, date + dueDays, hours, minutes, seconds));

      // Map step taskType string ("Regular", "Milestone", "Approval", "Email") to lowercase Task schema enum
      let stepTaskType = "regular";
      if (step.taskType) {
        const lower = step.taskType.toLowerCase();
        if (["regular", "milestone", "approval", "email"].includes(lower)) {
          stepTaskType = lower;
        }
      }

      // Map priority to lowercase Task schema format
      const stepPriority = (step.priority || "medium").toLowerCase();

      // Determine step assignee
      let assignedToUser = userId;
      if (step.assignedUserId) {
        assignedToUser = typeof step.assignedUserId === "object"
          ? step.assignedUserId.value || step.assignedUserId.id || step.assignedUserId._id || userId
          : step.assignedUserId;
      }

      const subtaskDesc = step.description || `Process Step #${idx + 1}: ${step.name} (Template: ${template.name})`;

      const validLinkedId = (step.linkedTaskId && mongoose.Types.ObjectId.isValid(step.linkedTaskId))
        ? new mongoose.Types.ObjectId(step.linkedTaskId)
        : null;
      const validLinkedToMilestone = (step.linkedToMilestone && mongoose.Types.ObjectId.isValid(step.linkedToMilestone))
        ? new mongoose.Types.ObjectId(step.linkedToMilestone)
        : validLinkedId;

      const subtaskData = {
        title: step.title || step.name,
        description: subtaskDesc,
        taskType: stepTaskType,
        subtaskType: step.subtaskType || stepTaskType,
        mainTaskType: "regular",
        parentTaskId: savedMainTask._id,
        parentTask: savedMainTask._id,
        isSubtask: true,
        createdByRole: userRole,
        createdBy: userId,
        assignedTo: assignedToUser,
        organization: orgId || null,
        status: (step.status || "OPEN").toUpperCase(),
        priority: stepPriority,
        visibility: step.visibility || "Private",
        tags: Array.isArray(step.tags) && step.tags.length > 0 ? step.tags : ["regular"],
        dueDate: stepDueDate,
        source: "process-builder",
        isProcessBuilderTask: true,
        processTemplateId: template._id,
        processStepId: step.id || `step_${idx}`,
        linkedTaskId: validLinkedId,
        linkedToMilestone: validLinkedToMilestone,
        linkedTasks: [],
        configuration: step.configuration || {
          autoInitiate: Boolean(step.linkedTaskId && step.autoInitiate),
          autoComplete: false,
          autoCompleteAfterDays: null,
          parentCancellationMode: "ignore_rejection",
        },
      };

      if (step.formId) {
        subtaskData.formId = step.formId;
      }
      if (stepTaskType === "email" || step.emailSubject || step.emailBody || step.emailConfig) {
        subtaskData.taskType = "email";
        subtaskData.subtaskType = "email";
        subtaskData.emailConfig = step.emailConfig || {
          recipients: [],
          subject: step.emailSubject || "",
          body: step.emailBody || "",
          variables: [],
          attachedFormId: step.formId || null,
          formLinkEnabled: true,
          autoComplete: Boolean(step.emailAutoComplete),
          autoCompleteAfterDays: 1,
          sendCount: 0,
          lastSentAt: null,
        };
      }
      if (stepTaskType === "approval" || step.approvalRequired || step.isApprovalTask) {
        subtaskData.taskType = "approval";
        subtaskData.subtaskType = "approval";
        subtaskData.isApprovalTask = true;
        subtaskData.approvalMode = step.approvalMode || "any";
        subtaskData.approvalStatus = "pending";

        const rawApprovers = Array.isArray(step.approvers) && step.approvers.length > 0
          ? step.approvers
          : (Array.isArray(step.approverIds) ? step.approverIds : []);

        const normalizedApprovers = rawApprovers
          .map((app) => {
            const val = typeof app === "object" ? app?.value || app?.id || app?._id : app;
            if (val === "self") return new mongoose.Types.ObjectId(userId);
            if (val && mongoose.Types.ObjectId.isValid(val)) {
              return new mongoose.Types.ObjectId(val);
            }
            return null;
          })
          .filter(Boolean);

        subtaskData.approvers = normalizedApprovers;
        subtaskData.approverIds = normalizedApprovers;
        subtaskData.approvalContext = step.approvalInstructions || step.description || "";
      }
      if (stepTaskType === "milestone" || step.isMilestone) {
        subtaskData.taskType = "milestone";
        subtaskData.subtaskType = "milestone";
        subtaskData.isMilestone = true;
        const mType = step.milestoneType || (step.linkedTasks?.length > 0 ? "linked" : "standalone");
        subtaskData.milestoneType = mType;
        subtaskData.linkedTasks = [];
        subtaskData.milestoneData = {
          type: mType,
          linkedTaskIds: [],
          completionCriteria: [],
          deliverables: [],
          stakeholders: [],
        };
      }

      const subtask = new Task(subtaskData);
      const savedSubtask = await subtask.save();
      createdSubtasks.push(savedSubtask);
      if (step.id) {
        stepIdToCreatedTaskIdMap[step.id] = savedSubtask._id.toString();
      }
    }

    // 3. Resolve template step IDs to actual created MongoDB ObjectIds & trigger Email / Notification services
    for (let idx = 0; idx < createdSubtasks.length; idx++) {
      const subtask = createdSubtasks[idx];
      const step = stepsToExecute[idx];

      let needsUpdate = false;
      const updateFields = {};

      // Resolve linkedTaskId / linkedToMilestone
      if (step.linkedTaskId || step.linkedToMilestone) {
        const rawLinkedId = (step.linkedTaskId || step.linkedToMilestone)?.toString();
        const resolvedId = stepIdToCreatedTaskIdMap[rawLinkedId] || rawLinkedId;
        if (resolvedId && mongoose.Types.ObjectId.isValid(resolvedId)) {
          const resolvedObjId = new mongoose.Types.ObjectId(resolvedId);
          updateFields.linkedTaskId = resolvedObjId;
          updateFields.linkedToMilestone = resolvedObjId;
          subtask.linkedTaskId = resolvedObjId;
          subtask.linkedToMilestone = resolvedObjId;
          needsUpdate = true;
        }
      }

      // Resolve linkedTasks for Linked Milestone subtasks
      if (subtask.isMilestone) {
        let rawTaskIds = [];
        if (Array.isArray(step.linkedTasks) && step.linkedTasks.length > 0) {
          rawTaskIds = step.linkedTasks.map((t) => (typeof t === "object" ? t.value || t.id || t._id : t));
        } else if (step.milestoneData && Array.isArray(step.milestoneData.linkedTaskIds)) {
          rawTaskIds = step.milestoneData.linkedTaskIds.map((t) => (typeof t === "object" ? t.value || t.id || t._id : t));
        }

        const resolvedObjectIds = rawTaskIds
          .map((id) => stepIdToCreatedTaskIdMap[id] || id)
          .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
          .map((id) => new mongoose.Types.ObjectId(id));

        if (resolvedObjectIds.length > 0) {
          updateFields.linkedTasks = resolvedObjectIds;
          updateFields.milestoneData = {
            type: subtask.milestoneType || "linked",
            linkedTaskIds: resolvedObjectIds,
            completionCriteria: [],
            deliverables: [],
            stakeholders: [],
          };
          subtask.linkedTasks = resolvedObjectIds;
          subtask.milestoneData = updateFields.milestoneData;
          needsUpdate = true;

          // Bidirectional link: update prerequisite tasks to point back to this milestone
          await Task.updateMany(
            { _id: { $in: resolvedObjectIds } },
            { $set: { linkedToMilestone: subtask._id } }
          );
        }
      }

      if (needsUpdate) {
        await Task.findByIdAndUpdate(subtask._id, { $set: updateFields });
      }

      // 📧 Trigger email send if this is an Email Subtask with recipients
      if (subtask.taskType === "email" && subtask.emailConfig?.recipients?.length > 0) {
        try {
          const { EmailTaskService } = await import("../workflow/EmailTaskService.js");
          EmailTaskService.sendEmailTask(subtask).catch((err) =>
            console.error("❌ [startProcessInstance] Email subtask send failed:", err)
          );
        } catch (emailErr) {
          console.error("❌ [startProcessInstance] Failed to load EmailTaskService:", emailErr);
        }
      }

      // 🔔 Trigger notifications for Approval Subtasks & Assignees
      try {
        const EnhancedNotificationHelper = (await import("../services/enhancedNotificationHelper.js")).default;
        await EnhancedNotificationHelper.notifyTaskCreation(subtask, {
          taskType: subtask.taskType,
          createdBy: userId,
          collaborators: subtask.collaborators || [],
          approvers: subtask.approvers || [],
        });
      } catch (notifErr) {
        console.error("❌ [startProcessInstance] Failed to send task notification:", notifErr);
      }
    }

    // Response structure matching frontend expectations
    const instancePayload = {
      id: savedMainTask._id.toString(),
      processId: template._id.toString(),
      processName: savedMainTask.title,
      templateName: template.name,
      notes: notes || "",
      startedAt: savedMainTask.createdAt,
      dueDate: savedMainTask.dueDate,
      status: "In Progress",
      currentStepIndex: 0,
      totalSteps: createdSubtasks.length,
      steps: createdSubtasks.map((st, idx) => ({
        id: st._id.toString(),
        stepId: st.processStepId,
        name: st.title,
        taskType: st.taskType,
        assignedUserId: st.assignedTo ? st.assignedTo.toString() : userId,
        dueDays: template.steps[idx]?.dueDays ?? 3,
        dueDate: st.dueDate,
        status: st.status === "COMPLETED" ? "Completed" : "In Progress",
        startedAt: st.createdAt,
        taskId: st._id.toString(),
      })),
    };

    return res.status(201).json({
      success: true,
      message: `Process "${savedMainTask.title}" launched successfully with ${createdSubtasks.length} step subtasks!`,
      data: instancePayload,
    });
  } catch (error) {
    console.error("Error launching process instance:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get active running process instances created via Process Builder
 */
export const getProcessInstances = async (req, res) => {
  try {
    // 1. Fetch all non-deleted tasks from DB
    const allTasksInDb = await Task.find({ is_deleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .lean();

    // Set of parent task IDs that have subtasks linked to them
    const parentTaskIdsWithSubtasks = new Set(
      allTasksInDb
        .map((t) => (t.parentTaskId || t.parentTask)?.toString())
        .filter(Boolean)
    );

    // 2. Filter main parent process tasks (tasks without parentTaskId/parentTask)
    const mainTasks = allTasksInDb.filter((t) => {
      const hasParent = t.parentTaskId || t.parentTask;
      const isSub = t.isSubtask === true;
      if (hasParent || isSub) return false;

      const isMarkedPB = t.isProcessBuilderTask === true || t.source === "process-builder" || Boolean(t.processTemplateId);
      const hasChildSubtasks = parentTaskIdsWithSubtasks.has(t._id.toString());

      return isMarkedPB || hasChildSubtasks;
    });

    console.log(`🔍 [getProcessInstances] Total DB tasks: ${allTasksInDb.length}, Process instances found: ${mainTasks.length}`);

    const instances = [];

    for (const mainTask of mainTasks) {
      // Find subtasks created under this process parent task
      const subtasks = allTasksInDb.filter((st) => {
        const pId = (st.parentTaskId || st.parentTask)?.toString();
        return pId === mainTask._id.toString();
      });

      const completedCount = subtasks.filter(
        (st) => (st.status || "").toUpperCase() === "COMPLETED" || (st.status || "").toUpperCase() === "DONE"
      ).length;

      const instanceStatus =
        subtasks.length > 0 && completedCount === subtasks.length
          ? "Completed"
          : "In Progress";

      instances.push({
        id: mainTask._id.toString(),
        processId: mainTask.processTemplateId ? mainTask.processTemplateId.toString() : null,
        processName: mainTask.title,
        templateName: mainTask.title,
        notes: mainTask.description || "",
        startedAt: mainTask.createdAt,
        dueDate: mainTask.dueDate || null,
        status: instanceStatus,
        currentStepIndex: Math.min(completedCount, subtasks.length > 0 ? subtasks.length - 1 : 0),
        totalSteps: subtasks.length,
        steps: subtasks.map((st) => ({
          id: st._id.toString(),
          name: st.title,
          taskType: st.taskType,
          assignedUserId: st.assignedTo ? st.assignedTo.toString() : "",
          dueDays: st.dueDays ?? 3,
          dueDate: st.dueDate || null,
          status: (st.status || "").toUpperCase() === "COMPLETED" ? "Completed" : "In Progress",
          startedAt: st.createdAt,
          taskId: st._id.toString(),
        })),
      });
    }

    console.log(`✅ [getProcessInstances] Returning ${instances.length} process instances to client`);
    return res.json({ success: true, data: instances });
  } catch (error) {
    console.error("Error fetching process instances:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
