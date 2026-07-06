import express from "express";
import mongoose from "mongoose";
import Task from "../modals/taskModal.js";
import TaskStatusConfig from "../modals/taskStatusConfigModal.js";

const router = express.Router();

function requireStatusManagement(req, res, next) {
  const role = req.user?.role;
  const roles = Array.isArray(role) ? role : [role].filter(Boolean);
  const allowed = ["org_admin", "admin", "manager", "super_admin"];
  if (roles.some((r) => allowed.includes(r))) return next();
  return res.status(403).json({
    success: false,
    message: "Access denied",
  });
}

const DEFAULT_STATUSES = [
  {
    code: "OPEN",
    label: "Open",
    description: "Task is created but not yet started",
    color: "#6c757d",
    order: 1,
    isDefault: true,
    isFinal: false,
    allowedTransitions: ["INPROGRESS", "ONHOLD", "CANCELLED"],
  },
  {
    code: "INPROGRESS",
    label: "In Progress",
    description: "Task is being actively worked on",
    color: "#3498db",
    order: 2,
    isDefault: false,
    isFinal: false,
    allowedTransitions: ["DONE", "ONHOLD", "CANCELLED"],
  },
  {
    code: "ONHOLD",
    label: "On Hold",
    description: "Task is temporarily paused",
    color: "#f39c12",
    order: 3,
    isDefault: false,
    isFinal: false,
    allowedTransitions: ["INPROGRESS"],
  },
  {
    code: "DONE",
    label: "Completed",
    description: "Task has been completed successfully",
    color: "#28a745",
    order: 4,
    isDefault: false,
    isFinal: true,
    allowedTransitions: [],
  },
  {
    code: "CANCELLED",
    label: "Cancelled",
    description: "Task was cancelled and will not be completed",
    color: "#dc3545",
    order: 5,
    isDefault: false,
    isFinal: true,
    allowedTransitions: [],
  },
];

async function ensureDefaultTaskStatuses(organizationId, userId = null) {
  const existingCount = await TaskStatusConfig.countDocuments({ organizationId });

  if (existingCount > 0) {
    // ✅ MIGRATION: Update existing records with correct allowedTransitions if they're wrong
    // This fixes old organizations that were created with empty allowedTransitions
    // Only run this check once - if ANY INPROGRESS status has correct transitions, skip
    const inProgressStatus = await TaskStatusConfig.findOne({
      organizationId,
      code: 'INPROGRESS'
    }).lean();

    const needsMigration = inProgressStatus &&
      (!inProgressStatus.allowedTransitions ||
        inProgressStatus.allowedTransitions.length === 0);

    if (needsMigration) {
      const existingStatuses = await TaskStatusConfig.find({ organizationId }).lean();

      for (const existing of existingStatuses) {
        const defaultStatus = DEFAULT_STATUSES.find(d => d.code === existing.code);
        if (!defaultStatus) continue;

        // Update allowedTransitions to match defaults
        await TaskStatusConfig.updateOne(
          { _id: existing._id },
          {
            $set: {
              allowedTransitions: defaultStatus.allowedTransitions,
              updatedAt: new Date()
            }
          }
        );
      }
    }

    return; // Exit after migration check
  }

  const docs = DEFAULT_STATUSES.map((s) => ({
    ...s,
    organizationId,
    active: true,
    // Use allowedTransitions from DEFAULT_STATUSES instead of overriding
    allowedTransitions: s.allowedTransitions || [],
    createdBy: userId,
    updatedBy: userId,
  }));

  try {
    await TaskStatusConfig.insertMany(docs, { ordered: false });
  } catch (e) {
    // Race-condition safe: if two requests seed at once, ignore duplicate key errors
    if (e?.code !== 11000) {
      throw e;
    }
  }
}

async function getStatusUsageMap(organizationId) {
  const orgObjectId =
    typeof organizationId === "string"
      ? new mongoose.Types.ObjectId(organizationId)
      : organizationId;

  const rows = await Task.aggregate([
    {
      $match: {
        organization: orgObjectId,
        $or: [{ isDeleted: { $ne: true } }, { is_deleted: { $ne: true } }],
      },
    },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const map = {};
  rows.forEach((r) => {
    map[String(r._id)] = r.count;
  });
  return map;
}

// GET /api/task-statuses
router.get("/", async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    // ✅ If user is not linked to any organization (individual account),
    // return default, non-organization-scoped statuses instead of erroring out.
    if (!organizationId) {
      const data = DEFAULT_STATUSES.map((s) => ({
        ...s,
        _id: s.code, // stable id for frontend lists
        organizationId: null,
        active: true,
        allowedTransitions: s.allowedTransitions || [],
        tasksUsing: 0,
      }));
      return res.json({ success: true, data });
    }

    await ensureDefaultTaskStatuses(organizationId, req.user?.id || null);

    const [statuses, usageMap] = await Promise.all([
      TaskStatusConfig.find({ organizationId })
        .sort({ order: 1, createdAt: 1 })
        .lean(),
      getStatusUsageMap(organizationId),
    ]);

    // ✅ AllowedTransitions are now corrected by ensureDefaultTaskStatuses migration
    const data = statuses.map((s) => ({
      ...s,
      tasksUsing: usageMap[s.code] || 0,
    }));

    return res.json({ success: true, data });
  } catch (error) {
    console.error("Get task statuses error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get task statuses",
      error: error.message,
    });
  }
});

// POST /api/task-statuses
router.post("/", requireStatusManagement, async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id || null;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: "Organization required" });
    }

    const { code, label, description = "", color = "#6B7280", isFinal = false, isDefault = false, active = true, systemStatus = "OPEN", allowedTransitions = [] } =
      req.body || {};

    if (!code || typeof code !== "string") {
      return res.status(400).json({ success: false, message: "Status code is required" });
    }
    const normalizedCode = code.trim().toUpperCase();
    if (!/^[A-Z_]+$/.test(normalizedCode)) {
      return res.status(400).json({
        success: false,
        message: "Status code must contain only uppercase letters and underscores",
      });
    }
    if (!label || typeof label !== "string" || !label.trim()) {
      return res.status(400).json({ success: false, message: "Status label is required" });
    }

    // Validate systemStatus
    const validSystemStatuses = ['OPEN', 'INPROGRESS', 'ONHOLD', 'DONE', 'CANCELLED'];
    const normalizedSystemStatus = systemStatus?.trim()?.toUpperCase() || 'OPEN';
    if (!validSystemStatuses.includes(normalizedSystemStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid systemStatus. Must be one of: ${validSystemStatuses.join(', ')}`
      });
    }

    const last = await TaskStatusConfig.findOne({ organizationId }).sort({ order: -1 }).lean();
    const nextOrder = (last?.order || 0) + 1;

    if (isDefault) {
      await TaskStatusConfig.updateMany({ organizationId }, { $set: { isDefault: false } });
    }

    const created = await TaskStatusConfig.create({
      organizationId,
      code: normalizedCode,
      label: label.trim(),
      description: String(description || "").trim(),
      color: String(color || "#6B7280").trim(),
      isFinal: !!isFinal,
      isDefault: !!isDefault,
      active: !!active,
      order: nextOrder,
      systemStatus: normalizedSystemStatus,
      allowedTransitions: Array.isArray(allowedTransitions) ? allowedTransitions : [],
      createdBy: userId,
      updatedBy: userId,
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: "Status code already exists" });
    }
    console.error("Create task status error:", error);
    return res.status(500).json({ success: false, message: "Failed to create status", error: error.message });
  }
});

// PUT /api/task-statuses/:id
router.put("/:id", requireStatusManagement, async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id || null;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid status id" });
    }

    const existing = await TaskStatusConfig.findOne({ _id: id, organizationId });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Status not found" });
    }

    const {
      label,
      description,
      color,
      isFinal,
      isDefault,
      active,
      order,
      systemStatus,
      allowedTransitions,
    } = req.body || {};

    if (label !== undefined) existing.label = String(label).trim();
    if (description !== undefined) existing.description = String(description || "").trim();
    if (color !== undefined) existing.color = String(color).trim();
    if (isFinal !== undefined) existing.isFinal = !!isFinal;
    if (active !== undefined) existing.active = !!active;
    if (order !== undefined && Number.isFinite(Number(order))) existing.order = Number(order);

    // Validate and update systemStatus if provided
    if (systemStatus !== undefined) {
      const validSystemStatuses = ['OPEN', 'INPROGRESS', 'ONHOLD', 'DONE', 'CANCELLED'];
      const normalizedSystemStatus = systemStatus?.trim()?.toUpperCase();
      if (!validSystemStatuses.includes(normalizedSystemStatus)) {
        return res.status(400).json({
          success: false,
          message: `Invalid systemStatus. Must be one of: ${validSystemStatuses.join(', ')}`
        });
      }
      existing.systemStatus = normalizedSystemStatus;
    }

    // Update allowedTransitions if provided
    if (allowedTransitions !== undefined) {
      existing.allowedTransitions = Array.isArray(allowedTransitions) ? allowedTransitions : [];
    }

    if (isDefault === true) {
      await TaskStatusConfig.updateMany({ organizationId }, { $set: { isDefault: false } });
      existing.isDefault = true;
    } else if (isDefault === false) {
      existing.isDefault = false;
    }

    existing.updatedBy = userId;
    await existing.save();

    return res.json({ success: true, data: existing });
  } catch (error) {
    console.error("Update task status error:", error);
    return res.status(500).json({ success: false, message: "Failed to update status", error: error.message });
  }
});

// PATCH /api/task-statuses/reorder
router.patch("/reorder", requireStatusManagement, async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    const { orderedIds } = req.body || {};
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({ success: false, message: "orderedIds array is required" });
    }

    const bulk = orderedIds
      .map((id, idx) => {
        if (!mongoose.Types.ObjectId.isValid(id)) return null;
        return {
          updateOne: {
            filter: { _id: id, organizationId },
            update: { $set: { order: idx + 1 } },
          },
        };
      })
      .filter(Boolean);

    if (bulk.length === 0) {
      return res.status(400).json({ success: false, message: "No valid ids provided" });
    }

    await TaskStatusConfig.bulkWrite(bulk, { ordered: false });
    return res.json({ success: true });
  } catch (error) {
    console.error("Reorder task statuses error:", error);
    return res.status(500).json({ success: false, message: "Failed to reorder statuses", error: error.message });
  }
});

// DELETE /api/task-statuses/:id
router.delete("/:id", requireStatusManagement, async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid status id" });
    }

    const status = await TaskStatusConfig.findOne({ _id: id, organizationId }).lean();
    if (!status) {
      return res.status(404).json({ success: false, message: "Status not found" });
    }

    const tasksUsing = await Task.countDocuments({
      organization: organizationId,
      $or: [{ isDeleted: { $ne: true } }, { is_deleted: { $ne: true } }],
      status: status.code,
    });

    if (tasksUsing > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete: ${tasksUsing} tasks are using this status`,
      });
    }

    await TaskStatusConfig.deleteOne({ _id: id, organizationId });
    return res.json({ success: true });
  } catch (error) {
    console.error("Delete task status error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete status", error: error.message });
  }
});

export default router;

