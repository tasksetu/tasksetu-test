/**
 * Form Tag Routes
 * Routes for managing form tags (Spec 5.6)
 */

import express from "express";
import {
  getTags,
  getTagById,
  createTag,
  createOrGetTag,
  updateTag,
  deleteTag,
  updateTagUsage,
  bulkCreateTags,
} from "../controller/formTagController.js";
import { authenticateToken } from "../middleware/roleAuth.js";

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/form-tags
 * @desc    Get all tags for organization
 * @access  Private
 * @query   search (optional) - search by name
 * @query   popular (optional) - sort by usage count
 */
router.get("/", getTags);

/**
 * @route   GET /api/form-tags/:id
 * @desc    Get single tag by ID with recent forms
 * @access  Private
 */
router.get("/:id", getTagById);

/**
 * @route   POST /api/form-tags
 * @desc    Create new tag
 * @access  Private
 * @body    { name, color }
 */
router.post("/", createTag);

/**
 * @route   POST /api/form-tags/create-or-get
 * @desc    Create tag or return existing (for auto-creation)
 * @access  Private
 * @body    { name, color }
 */
router.post("/create-or-get", createOrGetTag);

/**
 * @route   POST /api/form-tags/bulk-create
 * @desc    Bulk create tags
 * @access  Private
 * @body    { tags: [string] }
 */
router.post("/bulk-create", bulkCreateTags);

/**
 * @route   PUT /api/form-tags/:id
 * @desc    Update tag
 * @access  Private
 * @body    { name, color }
 */
router.put("/:id", updateTag);

/**
 * @route   PUT /api/form-tags/:id/update-usage
 * @desc    Recalculate tag usage count
 * @access  Private (System/Admin)
 */
router.put("/:id/update-usage", updateTagUsage);

/**
 * @route   DELETE /api/form-tags/:id
 * @desc    Delete tag
 * @access  Private (Company Admin)
 * @query   force (optional) - force delete even if forms use it
 */
router.delete("/:id", deleteTag);

export default router;
