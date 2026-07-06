/**
 * Form Category Controller
 * Handles CRUD operations for form categories (Spec 5.6)
 */

import { FormCategory, Form } from "../models.js";

/**
 * Get all categories for an organization
 * GET /api/form-categories
 */
export const getCategories = async (req, res) => {
  try {
    const { organization } = req.user;
    const { isActive } = req.query;

    const filter = { organization };
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    const categories = await FormCategory.find(filter)
      .populate("createdBy", "firstName lastName email")
      .sort({ displayOrder: 1, name: 1 })
      .lean();

    // Get form count for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const formCount = await Form.countDocuments({
          organization,
          category: category._id,
          status: { $ne: "ARCHIVED" },
        });
        return {
          ...category,
          formCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: categoriesWithCount,
      count: categoriesWithCount.length,
    });
  } catch (error) {
    console.error("❌ Error fetching form categories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: error.message,
    });
  }
};

/**
 * Get single category by ID
 * GET /api/form-categories/:id
 */
export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const { organization } = req.user;

    const category = await FormCategory.findOne({
      _id: id,
      organization,
    }).populate("createdBy", "firstName lastName email");

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Get form count
    const formCount = await Form.countDocuments({
      organization,
      category: id,
      status: { $ne: "ARCHIVED" },
    });

    res.status(200).json({
      success: true,
      data: {
        ...category.toObject(),
        formCount,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch category",
      error: error.message,
    });
  }
};

/**
 * Create new category
 * POST /api/form-categories
 */
export const createCategory = async (req, res) => {
  try {
    const { name, description, color, icon, displayOrder } = req.body;
    const { organization, id: userId } = req.user;

    // Check if category with same name exists
    const existingCategory = await FormCategory.findOne({
      organization,
      name: name.trim(),
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: "Category with this name already exists",
      });
    }

    const category = new FormCategory({
      name: name.trim(),
      description,
      color: color || "#3B82F6",
      icon,
      displayOrder: displayOrder || 0,
      organization,
      createdBy: userId,
    });

    await category.save();
    await category.populate("createdBy", "firstName lastName email");

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (error) {
    console.error("❌ Error creating category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create category",
      error: error.message,
    });
  }
};

/**
 * Update category
 * PUT /api/form-categories/:id
 */
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color, icon, displayOrder, isActive } = req.body;
    const { organization } = req.user;

    const category = await FormCategory.findOne({
      _id: id,
      organization,
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Check name uniqueness if changing name
    if (name && name.trim() !== category.name) {
      const existingCategory = await FormCategory.findOne({
        organization,
        name: name.trim(),
        _id: { $ne: id },
      });

      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: "Category with this name already exists",
        });
      }
      category.name = name.trim();
    }

    if (description !== undefined) category.description = description;
    if (color) category.color = color;
    if (icon !== undefined) category.icon = icon;
    if (displayOrder !== undefined) category.displayOrder = displayOrder;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();
    await category.populate("createdBy", "firstName lastName email");

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: category,
    });
  } catch (error) {
    console.error("❌ Error updating category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update category",
      error: error.message,
    });
  }
};

/**
 * Delete category
 * DELETE /api/form-categories/:id
 */
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { organization } = req.user;
    const { force } = req.query; // Force delete even with forms

    const category = await FormCategory.findOne({
      _id: id,
      organization,
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Check if forms are using this category
    const formCount = await Form.countDocuments({
      organization,
      category: id,
      status: { $ne: "ARCHIVED" },
    });

    if (formCount > 0 && force !== "true") {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category. ${formCount} form(s) are using this category`,
        formCount,
        canForce: true,
      });
    }

    // If force delete, unlink forms from this category
    if (formCount > 0 && force === "true") {
      await Form.updateMany(
        { category: id },
        { $set: { category: null } }
      );
    }

    await category.deleteOne();

    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
      formsUnlinked: formCount,
    });
  } catch (error) {
    console.error("❌ Error deleting category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete category",
      error: error.message,
    });
  }
};

/**
 * Bulk update category display order
 * PUT /api/form-categories/reorder
 */
export const reorderCategories = async (req, res) => {
  try {
    const { categoryOrders } = req.body; // Array of { id, displayOrder }
    const { organization } = req.user;

    if (!Array.isArray(categoryOrders)) {
      return res.status(400).json({
        success: false,
        message: "categoryOrders must be an array",
      });
    }

    // Update display order for each category
    const updatePromises = categoryOrders.map(({ id, displayOrder }) =>
      FormCategory.updateOne(
        { _id: id, organization },
        { $set: { displayOrder } }
      )
    );

    await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      message: "Categories reordered successfully",
      updated: categoryOrders.length,
    });
  } catch (error) {
    console.error("❌ Error reordering categories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reorder categories",
      error: error.message,
    });
  }
};
