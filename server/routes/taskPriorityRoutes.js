import express from "express";
import mongoose from "mongoose";
import Task from "../modals/taskModal.js";
import TaskPriorityConfig from "../modals/taskPriorityConfigModal.js";

const router = express.Router();

function requirePriorityManagement(req, res, next) {
  const role = req.user?.role;
  const roles = Array.isArray(role) ? role : [role].filter(Boolean);
  const allowed = ["org_admin", "admin", "manager", "super_admin"];
  if (roles.some((r) => allowed.includes(r))) return next();
  return res.status(403).json({
    success: false,
    message: "Access denied",
  });
}

const DEFAULT_PRIORITIES = [
  {
    code: "low",
    label: "Low",
    color: "#22C55E",
    order: 1,
    isDefault: false,
    daysToDue: 30,
  },
  {
    code: "medium",
    label: "Medium",
    color: "#3B82F6",
    order: 2,
    isDefault: true,
    daysToDue: 14,
  },
  {
    code: "high",
    label: "High",
    color: "#F97316",
    order: 3,
    isDefault: false,
    daysToDue: 7,
  },
  {
    code: "critical",
    label: "Critical",
    color: "#EF4444",
    order: 4,
    isDefault: false,
    daysToDue: 2,
  },
  {
    code: "urgent",
    label: "Urgent",
    color: "#DC2626",
    order: 5,
    isDefault: false,
    daysToDue: 1,
  },
];

async function ensureDefaultTaskPriorities(organizationId, userId = null) {
  const existingCount = await TaskPriorityConfig.countDocuments({ organizationId });
  if (existingCount > 0) return;

  const docs = DEFAULT_PRIORITIES.map((p) => ({
    ...p,
    organizationId,
    active: true,
    createdBy: userId,
    updatedBy: userId,
  }));

  try {
    await TaskPriorityConfig.insertMany(docs, { ordered: false });
  } catch (e) {
    if (e?.code !== 11000) throw e;
  }
}

async function getPriorityUsageMap(organizationId) {
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
    { $group: { _id: "$priority", count: { $sum: 1 } } },
  ]);

  const map = {};
  rows.forEach((r) => {
    map[String(r._id)] = r.count;
  });
  return map;
}

// GET /api/task-priorities
router.get("/", async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    // ✅ If user is not linked to any organization (individual account),
    // return default, non-organization-scoped priorities instead of erroring out.
    if (!organizationId) {
      const data = DEFAULT_PRIORITIES.map((p) => ({
        ...p,
        _id: p.code, // stable id for frontend lists
        organizationId: null,
        active: true,
        tasksUsing: 0,
      }));
      return res.json({ success: true, data });
    }

    await ensureDefaultTaskPriorities(organizationId, req.user?.id || null);

    const [priorities, usageMap] = await Promise.all([
      TaskPriorityConfig.find({ organizationId })
        .sort({ order: 1, createdAt: 1 })
        .lean(),
      getPriorityUsageMap(organizationId),
    ]);

    const data = priorities.map((p) => ({
      ...p,
      tasksUsing: usageMap[p.code] || 0,
    }));

    return res.json({ success: true, data });
  } catch (error) {
    console.error("Get task priorities error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get task priorities",
      error: error.message,
    });
  }
});

// POST /api/task-priorities
router.post("/", requirePriorityManagement, async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id || null;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: "Organization required" });
    }

    const {
      code,
      label,
      color = "#6B7280",
      daysToDue = 14,
      isDefault = false,
      active = true,
    } = req.body || {};

    if (!code || typeof code !== "string") {
      return res.status(400).json({ success: false, message: "Priority code is required" });
    }
    const normalizedCode = code.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(normalizedCode)) {
      return res.status(400).json({
        success: false,
        message: "Priority code must contain only lowercase letters, numbers, and hyphens",
      });
    }
    if (!label || typeof label !== "string" || !label.trim()) {
      return res.status(400).json({ success: false, message: "Priority label is required" });
    }

    const last = await TaskPriorityConfig.findOne({ organizationId }).sort({ order: -1 }).lean();
    const nextOrder = (last?.order || 0) + 1;

    if (isDefault) {
      await TaskPriorityConfig.updateMany({ organizationId }, { $set: { isDefault: false } });
    }

    const created = await TaskPriorityConfig.create({
      organizationId,
      code: normalizedCode,
      label: label.trim(),
      color: String(color || "#6B7280").trim(),
      daysToDue: Number.isFinite(Number(daysToDue)) ? Number(daysToDue) : 14,
      isDefault: !!isDefault,
      active: !!active,
      order: nextOrder,
      createdBy: userId,
      updatedBy: userId,
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: "Priority code already exists" });
    }
    console.error("Create task priority error:", error);
    return res.status(500).json({ success: false, message: "Failed to create priority", error: error.message });
  }
});

// PUT /api/task-priorities/:id
router.put("/:id", requirePriorityManagement, async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id || null;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid priority id" });
    }

    const existing = await TaskPriorityConfig.findOne({ _id: id, organizationId });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Priority not found" });
    }

    const { label, color, daysToDue, isDefault, active, order } = req.body || {};

    if (label !== undefined) existing.label = String(label).trim();
    if (color !== undefined) existing.color = String(color).trim();
    if (daysToDue !== undefined && Number.isFinite(Number(daysToDue))) existing.daysToDue = Number(daysToDue);
    if (active !== undefined) existing.active = !!active;
    if (order !== undefined && Number.isFinite(Number(order))) existing.order = Number(order);

    if (isDefault === true) {
      await TaskPriorityConfig.updateMany({ organizationId }, { $set: { isDefault: false } });
      existing.isDefault = true;
    } else if (isDefault === false) {
      existing.isDefault = false;
    }

    existing.updatedBy = userId;
    await existing.save();

    return res.json({ success: true, data: existing });
  } catch (error) {
    console.error("Update task priority error:", error);
    return res.status(500).json({ success: false, message: "Failed to update priority", error: error.message });
  }
});

// PATCH /api/task-priorities/reorder
router.patch("/reorder", requirePriorityManagement, async (req, res) => {
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

    await TaskPriorityConfig.bulkWrite(bulk, { ordered: false });
    return res.json({ success: true });
  } catch (error) {
    console.error("Reorder task priorities error:", error);
    return res.status(500).json({ success: false, message: "Failed to reorder priorities", error: error.message });
  }
});

// DELETE /api/task-priorities/:id
router.delete("/:id", requirePriorityManagement, async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid priority id" });
    }

    const priority = await TaskPriorityConfig.findOne({ _id: id, organizationId }).lean();
    if (!priority) {
      return res.status(404).json({ success: false, message: "Priority not found" });
    }

    const tasksUsing = await Task.countDocuments({
      organization: organizationId,
      $or: [{ isDeleted: { $ne: true } }, { is_deleted: { $ne: true } }],
      priority: priority.code,
    });

    if (tasksUsing > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete: ${tasksUsing} tasks are using this priority`,
      });
    }

    await TaskPriorityConfig.deleteOne({ _id: id, organizationId });
    return res.json({ success: true });
  } catch (error) {
    console.error("Delete task priority error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete priority", error: error.message });
  }
});

export default router;

