/**
 * Form Tag Controller
 * Handles CRUD operations for form tags (Spec 5.6)
 */

import { FormTag, Form } from "../models.js";

/**
 * Get all tags for an organization
 * GET /api/form-tags
 */
export const getTags = async (req, res) => {
  try {
    const { organization } = req.user;
    const { search, popular } = req.query;

    const filter = { organization };

    // Search by name
    if (search) {
      filter.name = { $regex: search.trim(), $options: "i" };
    }

    const query = FormTag.find(filter).populate(
      "createdBy",
      "firstName lastName email"
    );

    // Sort by popularity if requested
    if (popular === "true") {
      query.sort({ usageCount: -1, name: 1 });
    } else {
      query.sort({ name: 1 });
    }

    const tags = await query.lean();

    res.status(200).json({
      success: true,
      data: tags,
      count: tags.length,
    });
  } catch (error) {
    console.error("❌ Error fetching form tags:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch tags",
      error: error.message,
    });
  }
};

/**
 * Get single tag by ID
 * GET /api/form-tags/:id
 */
export const getTagById = async (req, res) => {
  try {
    const { id } = req.params;
    const { organization } = req.user;

    const tag = await FormTag.findOne({
      _id: id,
      organization,
    }).populate("createdBy", "firstName lastName email");

    if (!tag) {
      return res.status(404).json({
        success: false,
        message: "Tag not found",
      });
    }

    // Get forms using this tag
    const forms = await Form.find({
      organization,
      tags: id,
      status: { $ne: "ARCHIVED" },
    })
      .select("form_code title status")
      .limit(10)
      .lean();

    res.status(200).json({
      success: true,
      data: {
        ...tag.toObject(),
        recentForms: forms,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching tag:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch tag",
      error: error.message,
    });
  }
};

/**
 * Create new tag
 * POST /api/form-tags
 */
export const createTag = async (req, res) => {
  try {
    const { name, color } = req.body;
    const { organization, id: userId } = req.user;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Tag name is required",
      });
    }

    const normalizedName = name.trim().toLowerCase();

    // Check if tag with same name exists
    const existingTag = await FormTag.findOne({
      organization,
      name: normalizedName,
    });

    if (existingTag) {
      return res.status(400).json({
        success: false,
        message: "Tag with this name already exists",
        data: existingTag,
      });
    }

    const tag = new FormTag({
      name: normalizedName,
      color: color || "#6B7280",
      organization,
      createdBy: userId,
      usageCount: 0,
    });

    await tag.save();
    await tag.populate("createdBy", "firstName lastName email");

    res.status(201).json({
      success: true,
      message: "Tag created successfully",
      data: tag,
    });
  } catch (error) {
    console.error("❌ Error creating tag:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create tag",
      error: error.message,
    });
  }
};

/**
 * Create or get existing tag (for auto-creation on form save)
 * POST /api/form-tags/create-or-get
 */
export const createOrGetTag = async (req, res) => {
  try {
    const { name, color } = req.body;
    const { organization, id: userId } = req.user;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Tag name is required",
      });
    }

    const normalizedName = name.trim().toLowerCase();

    // Try to find existing tag
    let tag = await FormTag.findOne({
      organization,
      name: normalizedName,
    });

    if (tag) {
      return res.status(200).json({
        success: true,
        message: "Tag already exists",
        data: tag,
        created: false,
      });
    }

    // Create new tag
    tag = new FormTag({
      name: normalizedName,
      color: color || "#6B7280",
      organization,
      createdBy: userId,
      usageCount: 0,
    });

    await tag.save();
    await tag.populate("createdBy", "firstName lastName email");

    res.status(201).json({
      success: true,
      message: "Tag created successfully",
      data: tag,
      created: true,
    });
  } catch (error) {
    console.error("❌ Error creating/getting tag:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create/get tag",
      error: error.message,
    });
  }
};

/**
 * Update tag
 * PUT /api/form-tags/:id
 */
export const updateTag = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    const { organization } = req.user;

    const tag = await FormTag.findOne({
      _id: id,
      organization,
    });

    if (!tag) {
      return res.status(404).json({
        success: false,
        message: "Tag not found",
      });
    }

    // Check name uniqueness if changing name
    if (name && name.trim().toLowerCase() !== tag.name) {
      const normalizedName = name.trim().toLowerCase();
      const existingTag = await FormTag.findOne({
        organization,
        name: normalizedName,
        _id: { $ne: id },
      });

      if (existingTag) {
        return res.status(400).json({
          success: false,
          message: "Tag with this name already exists",
        });
      }
      tag.name = normalizedName;
    }

    if (color) tag.color = color;

    await tag.save();
    await tag.populate("createdBy", "firstName lastName email");

    res.status(200).json({
      success: true,
      message: "Tag updated successfully",
      data: tag,
    });
  } catch (error) {
    console.error("❌ Error updating tag:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update tag",
      error: error.message,
    });
  }
};

/**
 * Delete tag
 * DELETE /api/form-tags/:id
 */
export const deleteTag = async (req, res) => {
  try {
    const { id } = req.params;
    const { organization } = req.user;
    const { force } = req.query;

    const tag = await FormTag.findOne({
      _id: id,
      organization,
    });

    if (!tag) {
      return res.status(404).json({
        success: false,
        message: "Tag not found",
      });
    }

    // Check if forms are using this tag
    const formCount = await Form.countDocuments({
      organization,
      tags: id,
      status: { $ne: "ARCHIVED" },
    });

    if (formCount > 0 && force !== "true") {
      return res.status(400).json({
        success: false,
        message: `Cannot delete tag. ${formCount} form(s) are using this tag`,
        formCount,
        canForce: true,
      });
    }

    // If force delete, remove tag from all forms
    if (formCount > 0 && force === "true") {
      await Form.updateMany(
        { tags: id },
        { $pull: { tags: id } }
      );
    }

    await tag.deleteOne();

    res.status(200).json({
      success: true,
      message: "Tag deleted successfully",
      formsUnlinked: formCount,
    });
  } catch (error) {
    console.error("❌ Error deleting tag:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete tag",
      error: error.message,
    });
  }
};

/**
 * Update tag usage count (called when forms add/remove tags)
 * PUT /api/form-tags/:id/update-usage
 */
export const updateTagUsage = async (req, res) => {
  try {
    const { id } = req.params;
    const { organization } = req.user;

    const tag = await FormTag.findOne({
      _id: id,
      organization,
    });

    if (!tag) {
      return res.status(404).json({
        success: false,
        message: "Tag not found",
      });
    }

    // Count actual usage
    const actualCount = await Form.countDocuments({
      organization,
      tags: id,
      status: { $ne: "ARCHIVED" },
    });

    tag.usageCount = actualCount;
    await tag.save();

    res.status(200).json({
      success: true,
      message: "Tag usage updated",
      usageCount: actualCount,
    });
  } catch (error) {
    console.error("❌ Error updating tag usage:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update tag usage",
      error: error.message,
    });
  }
};

/**
 * Bulk create tags
 * POST /api/form-tags/bulk-create
 */
export const bulkCreateTags = async (req, res) => {
  try {
    const { tags } = req.body; // Array of tag names
    const { organization, id: userId } = req.user;

    if (!Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Tags array is required",
      });
    }

    const createdTags = [];
    const existingTags = [];

    for (const tagName of tags) {
      const normalizedName = tagName.trim().toLowerCase();
      if (!normalizedName) continue;

      // Check if exists
      let tag = await FormTag.findOne({
        organization,
        name: normalizedName,
      });

      if (tag) {
        existingTags.push(tag);
      } else {
        // Create new
        tag = new FormTag({
          name: normalizedName,
          color: "#6B7280",
          organization,
          createdBy: userId,
          usageCount: 0,
        });
        await tag.save();
        createdTags.push(tag);
      }
    }

    res.status(201).json({
      success: true,
      message: `Created ${createdTags.length} new tags, found ${existingTags.length} existing`,
      data: {
        created: createdTags,
        existing: existingTags,
        all: [...createdTags, ...existingTags],
      },
    });
  } catch (error) {
    console.error("❌ Error bulk creating tags:", error);
    res.status(500).json({
      success: false,
      message: "Failed to bulk create tags",
      error: error.message,
    });
  }
};
