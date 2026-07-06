/**
 * Form Category Routes
 * Routes for managing form categories (Spec 5.6)
 */

import express from "express";
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from "../controller/formCategoryController.js";
import { authenticateToken } from "../middleware/roleAuth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/form-categories
 * @desc    Get all categories for organization
 * @access  Private
 * @query   isActive (optional) - filter by active status
 */
router.get("/", getCategories);

/**
 * @route   GET /api/form-categories/:id
 * @desc    Get single category by ID
 * @access  Private
 */
router.get("/:id", getCategoryById);

/**
 * @route   POST /api/form-categories
 * @desc    Create new category
 * @access  Private (Form Owner, Company Admin)
 * @body    { name, description, color, icon, displayOrder }
 */
router.post("/", createCategory);

/**
 * @route   PUT /api/form-categories/:id
 * @desc    Update category
 * @access  Private (Form Owner, Company Admin)
 * @body    { name, description, color, icon, displayOrder, isActive }
 */
router.put("/:id", updateCategory);

/**
 * @route   PUT /api/form-categories/reorder
 * @desc    Bulk update display order
 * @access  Private (Company Admin)
 * @body    { categoryOrders: [{ id, displayOrder }] }
 */
router.put("/bulk/reorder", reorderCategories);

/**
 * @route   DELETE /api/form-categories/:id
 * @desc    Delete category
 * @access  Private (Form Owner, Company Admin)
 * @query   force (optional) - force delete even if forms exist
 */
router.delete("/:id", deleteCategory);

export default router;
