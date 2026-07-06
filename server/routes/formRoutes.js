import express from 'express';
import {
  cloneFormTemplate,
  createForm,
  deleteFormById,
  deleteFormTemplate,
  getAllForms,
  getFormCategories,
  getFormById,
  saveOrUpdateDraftForm,
  publishFormVersion,
  unpublishForm,
  archiveForm,
  getFormVersions,
  getFormVersionById,
  submitFormResponse,
  submitPublicForm,
  getFormResponses,
  attachFormToSubtask,
  unlinkFormFromSubtask,
  shareForm,
  unshareForm,
  getSharedUsers,
  previewFormValidation,
  searchFormLibrary,
  createFormSubmission,
  updateFormSubmission,
  getFormSubmissionById,
  getMySubmissionForTask,
  getMySubmissionsForTask,
  getPublicFormByToken,
  viewFormSubmissionFile,
  downloadFormSubmissionFile,
  getCaptchaChallenge,
  verifyCaptchaAnswer,
} from '../controller/formController.js';
import { authenticateToken } from "../middleware/roleAuth.js";
import {
  checkFormPermission,
  checkOrgFormAccess,
  checkFormSubmitPermission
} from "../middleware/formACL.js";
import { checkFeatureAccess } from "../middleware/licenseMiddleware.js";
import {
  formSubmitLimiter,
  formCreateLimiter,
  formPublishLimiter,
  formDeleteLimiter
} from '../middleware/rateLimitMiddleware.js';
import { sanitizeRequestBody } from '../middleware/sanitizationMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/forms/add-form/{status}:
 *   post:
 *     tags:
 *       - Forms
 *     summary: Create a new form template
 *     description: Create a new form template with specified status. Authentication required.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: status
 *         required: true
 *         description: Status of the form (draft or publish)
 *         schema:
 *           type: string
 *           enum: [draft, publish]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: "My Survey"
 *               description:
 *                 type: string
 *                 example: "Short description of the form"
 *               fields:
 *                 type: array
 *                 description: Array of field definitions
 *                 items:
 *                   type: object
 *                   properties:
 *                     label:
 *                       type: string
 *                     type:
 *                       type: string
 *                       enum: [text, textarea, email, phone, number, date, dropdown, multiselect, signature, file_upload, location_picker]
 *                     placeholder:
 *                       type: string
 *                     description:
 *                       type: string
 *                     hasOption:
 *                       type: boolean
 *                     options:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           label:
 *                             type: string
 *                           value:
 *                             type: string
 *                     isRequired:
 *                       type: boolean
 *                     order:
 *                       type: integer
 *                     validation:
 *                       type: object
 *                       properties:
 *                         min:
 *                           type: number
 *                         max:
 *                           type: number
 *                         regex:
 *                           type: string
 *                     meta:
 *                       type: object
 *                       properties:
 *                         fileTypes:
 *                           type: array
 *                           items:
 *                             type: string
 *                         maxSizeMB:
 *                           type: number
 *               category_id:
 *                 type: string
 *                 description: Optional category id
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               visibility:
 *                 type: string
 *                 enum: [PUBLIC, PRIVATE, ORG]
 *               scope:
 *                 type: string
 *                 enum: [INTERNAL, EXTERNAL]
 *               settings:
 *                 type: object
 *                 properties:
 *                   allowAnonymous:
 *                     type: boolean
 *                     default: false
 *                     description: Whether to allow anonymous submissions
 *                   submitMessage:
 *                     type: string
 *                     default: "Thank you for your submission!"
 *                     description: Message shown after form submission
 *                   layout:
 *                     type: string
 *                     enum: [1-column, 2-columns, 3-columns]
 *                     default: 1-column
 *                     description: Form layout configuration
 *                   maxSubmissions:
 *                     type: number
 *                     nullable: true
 *                     description: Maximum number of submissions allowed (optional)
 *                   redirectUrl:
 *                     type: string
 *                     nullable: true
 *                     description: URL to redirect after submission (optional)
 *     responses:
 *       201:
 *         description: Form template created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Form template created successfully"
 *                 data:
 *                   type: object
 *                   description: Created form object
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/add-form/:status', formCreateLimiter, sanitizeRequestBody('moderate'), authenticateToken, checkFeatureAccess('FORM_CREATE'), createForm);
/**
 * @swagger
 * /api/forms:
 *   get:
 *     tags:
 *       - Forms
 *     summary: Get all forms with pagination and search
 *     description: Retrieve all forms owned by the current user with pagination and a single unified search parameter. The search term matches form title, description, category name, tags, or status.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           example: finance
 *         description: Search across title, description, category name, tags, or status (case-insensitive)
 *     responses:
 *       200:
 *         description: Forms retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     forms:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Form'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                           example: 21
 *                         page:
 *                           type: number
 *                           example: 1
 *                         limit:
 *                           type: number
 *                           example: 10
 *                         pages:
 *                           type: number
 *                           example: 3
 *                         hasMore:
 *                           type: boolean
 *                           example: true
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       500:
 *         description: Server error - Error fetching forms
 */
router.get('/', authenticateToken, getAllForms);

/**
 * @swagger
 * /api/forms/categories:
 *   get:
 *     tags:
 *       - Form Categories
 *     summary: Get all form categories
 *     description: Retrieve list of all form categories for filtering
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/categories', authenticateToken, getFormCategories);

/**
 * @swagger
 * /api/public/forms/{token}:
 *   get:
 *     tags:
 *       - Public Forms
 *     summary: Get public form by external token (no auth required)
 *     description: Fetch a published form using its external_token for anonymous submissions
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: External submission token
 *     responses:
 *       200:
 *         description: Form retrieved successfully
 *       403:
 *         description: External submissions not enabled or form expired
 *       404:
 *         description: Form not found or not published
 */
// ✅ When mounted at /api/public -> /api/public/forms/:token
router.get('/forms/:token', getPublicFormByToken);

// ✅ CAPTCHA endpoints for public forms (no auth required)
router.get('/forms/:token/captcha', getCaptchaChallenge);
router.post('/forms/:token/verify-captcha', verifyCaptchaAnswer);

/**
 * @swagger
 * /api/public/forms/{token}/submit:
 *   post:
 *     tags:
 *       - Public Forms
 *     summary: Submit a public form (no auth required)
 *     description: Submit form data anonymously using external_token. Anyone with the link can submit.
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: External submission token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               responses:
 *                 type: object
 *                 description: Field responses keyed by field_code
 *               submitted_by:
 *                 type: string
 *                 nullable: true
 *                 description: Optional submitter identifier (email/name for anonymous)
 *     responses:
 *       201:
 *         description: Form submitted successfully
 *       422:
 *         description: Validation error
 *       403:
 *         description: Form expired or submissions disabled
 *       404:
 *         description: Invalid token
 */
// ✅ When mounted at /api/public -> /api/public/forms/:token/submit
// ✅ When mounted at /api/forms -> /api/forms/public/forms/:token/submit (also works)
router.post('/forms/:token/submit', submitPublicForm);

/**
 * @swagger
 * /api/forms/library/search:
 *   get:
 *     tags:
 *       - Form Library
 *     summary: Search published forms for attachment (P1)
 *     description: Search form library for PUBLISHED forms only (Phase I requirement). Used by attachment picker.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query (title, description, tags)
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Category ID filter
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: List of published forms user can view
 *       401:
 *         description: Unauthorized
 */
router.get("/library/search", authenticateToken, searchFormLibrary);

router.get('/', authenticateToken, getAllForms);

router.get('/', authenticateToken, getAllForms);

/**
 * @swagger
 * /api/forms/{form_id}:
 *   get:
 *     tags:
 *       - Forms
 *     summary: Get form details by ID
 *     description: Get detailed information about a specific form
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: form_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Form ID
 *     responses:
 *       200:
 *         description: Form details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Form'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Form not found or unauthorized
 *       500:
 *         description: Server error
 */
// Get single form by ID - VIEW permission required
router.get('/:form_id', authenticateToken, checkFormPermission('VIEW'), getFormById);

/**
 * @swagger
 * /api/forms/draft:
 *   post:
 *     summary: Create or update a draft form
 *     description: >
 *       Creates a new form draft if no `form_id` is provided.  
 *       Updates an existing draft if `form_id` is present.  
 *       Visibility, scope, and version info will remain `null` for drafts.
 *     tags:
 *       - Forms
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               form_id:
 *                 type: string
 *                 description: Optional. Pass form_id to update an existing draft.
 *               title:
 *                 type: string
 *                 example: "Employee Feedback Form"
 *               description:
 *                 type: string
 *                 example: "A short feedback form for employees"
 *               fields:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     label:
 *                       type: string
 *                       example: "Employee Name"
 *                     type:
 *                       type: string
 *                       enum: [text, textarea, email, phone, number, date, dropdown, multiselect, signature, file_upload, location_picker]
 *                       example: "text"
 *                     placeholder:
 *                       type: string
 *                       example: "Enter your name"
 *                     isRequired:
 *                       type: boolean
 *                       example: true
 *                     order:
 *                       type: integer
 *                       example: 0
 *                     options:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           label:
 *                             type: string
 *                             example: "Option 1"
 *                           value:
 *                             type: string
 *                             example: "option_1"
 *               category_id:
 *                 type: string
 *                 nullable: true
 *                 example: "6716f2b8cd2a45f7bfa12e3c"
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["HR", "Feedback"]
 *               settings:
 *                 type: object
 *                 properties:
 *                   allowAnonymous:
 *                     type: boolean
 *                     example: false
 *                   submitMessage:
 *                     type: string
 *                     example: "Thank you for your submission!"
 *                   layout:
 *                     type: string
 *                     enum: ["1-column", "2-columns", "3-columns"]
 *                     example: "1-column"
 *                   maxSubmissions:
 *                     type: integer
 *                     nullable: true
 *                   redirectUrl:
 *                     type: string
 *                     nullable: true
 *                     example: null
 *     responses:
 *       201:
 *         description: New form draft created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "New form draft created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/FormTemplate'
 *       200:
 *         description: Form draft updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Form draft updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/FormTemplate'
 *       404:
 *         description: Form not found or unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/draft', authenticateToken, checkFeatureAccess('FORM_CREATE'), formCreateLimiter, sanitizeRequestBody('moderate'), saveOrUpdateDraftForm);

/**
 * @swagger
 * /api/forms/clone/{form_id}:
 *   post:
 *     summary: Clone an existing form template
 *     description: >
 *       Creates a new form template by cloning an existing one.
 *       The new form will have a unique form_code, and the title will automatically append "(Copy 1)", "(Copy 2)", etc.
 *     tags:
 *       - Form Templates
 *     security:
 *       - bearerAuth: []   # requires JWT or any bearer auth setup in Swagger config
 *     parameters:
 *       - in: path
 *         name: form_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The form_id of the template to clone.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newTitle:
 *                 type: string
 *                 example: "Feedback Form Copy"
 *     responses:
 *       201:
 *         description: Form cloned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Form cloned successfully
 *                 clonedForm:
 *                   $ref: '#/components/schemas/FormTemplate'
 *       404:
 *         description: Form not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Form not found
 *       500:
 *         description: Failed to clone form
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Failed to clone form
 *                 error:
 *                   type: string
 *                   example: Something went wrong
 */
// Clone form - VIEW permission required (can clone forms you can view)
router.post("/clone/:form_id", authenticateToken, checkFormPermission('VIEW'), cloneFormTemplate);

/**
 * @swagger
 * /api/forms/{form_id}/versions:
 *   post:
 *     summary: Publish a new version of the form
 *     description: >
 *       Creates a version snapshot and publishes the form.
 *       Collects release notes, start/end dates, visibility, and external submission settings.
 *     tags:
 *       - Form Versions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: form_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The form ID to publish
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               release_notes:
 *                 type: string
 *                 example: "Added new email validation field"
 *               start_at:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-11-15T00:00:00Z"
 *               end_at:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-11-15T00:00:00Z"
 *               visibility:
 *                 type: string
 *                 enum: [PUBLIC, PRIVATE, ORG]
 *                 example: "ORG"
 *               scope:
 *                 type: string
 *                 enum: [INTERNAL, EXTERNAL]
 *                 example: "INTERNAL"
 *               external_submission_enabled:
 *                 type: boolean
 *                 example: false
 *               require_captcha:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       201:
 *         description: Form published successfully
 *       400:
 *         description: Validation error (e.g., form has no fields)
 *       404:
 *         description: Form not found
 */
// Publish form version - PUBLISH permission required (respects restrictPublishToOwner)
router.post("/:form_id/versions", formPublishLimiter, sanitizeRequestBody('moderate'), authenticateToken, checkFormPermission('PUBLISH'), publishFormVersion);

/**
 * @swagger
 * /api/forms/{form_id}/unpublish:
 *   post:
 *     summary: Unpublish form (PUBLISHED → DRAFT)
 *     description: Transition form back to DRAFT status. Rare operation, audit logged.
 *     tags:
 *       - Form Lifecycle
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: form_id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Form unpublished successfully
 */
router.post("/:form_id/unpublish", authenticateToken, checkFormPermission('OWNER'), unpublishForm);

/**
 * @swagger
 * /api/forms/{form_id}/archive:
 *   post:
 *     summary: Archive form
 *     description: Prevents new attachments and submissions. Historical data preserved.
 *     tags:
 *       - Form Lifecycle
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: form_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Form archived successfully
 */
router.post("/:form_id/archive", authenticateToken, checkFormPermission('OWNER'), archiveForm);

/**
 * @swagger
 * /api/forms/{form_id}:
 *   delete:
 *     summary: Delete form template
 *     description: >
 *       Soft delete form. Blocked if active form_usage exists.
 *       Shows dependency list if blocking. Only Owner or Platform Admin can delete.
 *     tags:
 *       - Form Management
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: form_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Form deleted successfully
 *       403:
 *         description: Insufficient permissions
 *       409:
 *         description: Cannot delete - active dependencies exist
 */
router.delete("/:form_id/delete", formDeleteLimiter, authenticateToken, checkFormPermission('OWNER'), deleteFormTemplate);

/**
 * @swagger
 * /api/forms/{form_id}/versions:
 *   get:
 *     summary: Get all versions of a form
 *     description: Retrieve version history for a specific form
 *     tags:
 *       - Form Versions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: form_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The form ID
 *     responses:
 *       200:
 *         description: Versions retrieved successfully
 *       404:
 *         description: Form not found
 */
// Get form versions - VIEW permission required
router.get("/:form_id/versions", authenticateToken, checkFormPermission('VIEW'), getFormVersions);

/**
 * @swagger
 * /api/forms/versions/{version_id}:
 *   get:
 *     summary: Get a specific form version by ID
 *     tags:
 *       - Form Versions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: version_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The form version ID
 *     responses:
 *       200:
 *         description: Version retrieved successfully
 *       404:
 *         description: Version not found
 */
router.get("/versions/:version_id", authenticateToken, getFormVersionById);

/**
 * @swagger
 * /api/forms/{form_id}/submit:
 *   post:
 *     summary: Submit a form response
 *     description: >
 *       Submit form data with validation. Supports both internal (authenticated) 
 *       and external (via token) submissions.
 *     tags:
 *       - Form Submissions
 *     parameters:
 *       - in: path
 *         name: form_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The form ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               submission_data:
 *                 type: object
 *                 description: Key-value pairs of field_id and values
 *                 example:
 *                   field_123: "John Doe"
 *                   field_456: "john@example.com"
 *               source:
 *                 type: string
 *                 enum: [DIRECT, TASK, SUBTASK, EXTERNAL]
 *                 example: "DIRECT"
 *               source_task_id:
 *                 type: string
 *                 example: null
 *               source_subtask_id:
 *                 type: string
 *                 example: null
 *               external_token:
 *                 type: string
 *                 example: null
 *     responses:
 *       201:
 *         description: Form submitted successfully
 *       422:
 *         description: Validation failed (field-level errors returned)
 *       401:
 *         description: Invalid or expired external token
 *       404:
 *         description: Form not found
 */
// Submit form response - uses custom submit permission check (allows anonymous if configured)
router.post("/:form_id/submit", formSubmitLimiter, sanitizeRequestBody('strict'), checkFormSubmitPermission, submitFormResponse);

/**
 * @swagger
 * /api/forms/{form_id}/responses:
 *   get:
 *     summary: Get form submissions/responses
 *     description: >
 *       Retrieve all submissions for a form with pagination and filtering.
 *       Supports CSV export.
 *     tags:
 *       - Form Submissions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: form_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The form ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *         description: Response format (json or csv for export)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED, COMPLETED]
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: submitted_by
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Responses retrieved successfully (or CSV file)
 *       404:
 *         description: Form not found
 */
// Get form responses - VIEW permission required
router.get("/:form_id/responses", authenticateToken, checkFormPermission('VIEW'), getFormResponses);

/**
 * @swagger
 * /api/forms/{form_id}/attach-to-subtask:
 *   post:
 *     summary: Attach form to a subtask
 *     description: >
 *       Attach a PUBLISHED form to a subtask. Creates usage audit trail.
 *       Validates form is published before allowing attachment.
 *     tags:
 *       - Form Attachments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: form_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The form ID to attach
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subtask_id
 *             properties:
 *               subtask_id:
 *                 type: string
 *                 description: The subtask ID to attach form to
 *               task_id:
 *                 type: string
 *                 description: Optional parent task ID
 *               version_id:
 *                 type: string
 *                 description: Optional specific version (uses latest if not provided)
 *               config:
 *                 type: object
 *                 properties:
 *                   auto_complete_task:
 *                     type: boolean
 *                     example: false
 *                   auto_change_status:
 *                     type: string
 *                     example: ""
 *                   notify_on_submit:
 *                     type: boolean
 *                     example: true
 *                   required_for_completion:
 *                     type: boolean
 *                     example: false
 *     responses:
 *       201:
 *         description: Form attached successfully
 *       400:
 *         description: Cannot attach DRAFT form or subtask already has form
 *       404:
 *         description: Form not found
 */
// Attach form to subtask - EDIT permission required
router.post("/:form_id/attach-to-subtask", authenticateToken, checkFormPermission('EDIT'), attachFormToSubtask);

/**
 * @swagger
 * /api/forms/{form_id}/unlink-from-subtask:
 *   post:
 *     summary: Unlink form from a subtask
 *     description: >
 *       Unlink a form from a subtask. Blocks if form has submissions unless force=true.
 *       Preserves historical submissions as read-only.
 *     tags:
 *       - Form Attachments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: form_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The form ID to unlink
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subtask_id
 *             properties:
 *               subtask_id:
 *                 type: string
 *                 description: The subtask ID to unlink form from
 *               force:
 *                 type: boolean
 *                 default: false
 *                 description: Force unlink even if submissions exist (Admin only)
 *               reason:
 *                 type: string
 *                 description: Reason for unlinking (optional)
 *     responses:
 *       200:
 *         description: Form unlinked successfully
 *       403:
 *         description: Cannot unlink - form has submissions
 *       404:
 *         description: No active form attachment found
 */
// Unlink form from subtask - EDIT permission required
router.post("/:form_id/unlink-from-subtask", authenticateToken, checkFormPermission('EDIT'), unlinkFormFromSubtask);

// ✅ Alternative DELETE routes with task/subtask ID in URL (for frontend compatibility)
router.delete("/:form_id/unlink-from-task/:task_id", authenticateToken, checkFormPermission('EDIT'), async (req, res) => {
  try {
    const { form_id, task_id } = req.params;

    // For main task, call unlinkFormFromSubtask with task_id as subtask_id
    // (the controller handles both tasks and subtasks)
    req.body = { subtask_id: task_id };
    return unlinkFormFromSubtask(req, res);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/:form_id/unlink-from-subtask/:subtask_id", authenticateToken, checkFormPermission('EDIT'), async (req, res) => {
  try {
    const { form_id, subtask_id } = req.params;

    // Call unlinkFormFromSubtask with subtask_id from URL
    req.body = { subtask_id };
    return unlinkFormFromSubtask(req, res);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/forms/{form_id}:
 *   delete:
 *     summary: Delete a form by form_id
 *     description: >
 *       Deletes a form template owned by the authenticated user.
 *       CRITICAL: Checks for active usage before deletion to prevent data loss.
 *     tags:
 *       - Forms
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: form_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the form to delete.
 *     responses:
 *       200:
 *         description: Form deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Form deleted successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     form_id:
 *                       type: string
 *                       example: 670f1a2b4a1f123abc456789
 *                     title:
 *                       type: string
 *                       example: Customer Feedback Form
 *       400:
 *         description: Cannot delete - form has active usage
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Cannot delete form. It is currently attached to 3 active task(s)/subtask(s).
 *                 data:
 *                   type: object
 *                   properties:
 *                     active_usage_count:
 *                       type: integer
 *                       example: 3
 *                     dependencies:
 *                       type: array
 *                       items:
 *                         type: object
 *       404:
 *         description: Form not found or unauthorized
 *       500:
 *         description: Internal server error
 */
// Delete form - OWNER permission required (only owner can delete)
router.delete("/:form_id", authenticateToken, checkFormPermission('OWNER'), deleteFormById);

/**
 * @swagger
 * /api/forms/{form_id}/share:
 *   post:
 *     summary: Share form with another user
 *     description: Grant EDITOR or VIEWER permissions to another user. Only form owner can share.
 *     tags:
 *       - Form Permissions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: form_id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - role
 *             properties:
 *               user_id:
 *                 type: string
 *                 description: ID of user to grant access to
 *               role:
 *                 type: string
 *                 enum: [EDITOR, VIEWER]
 *                 description: Permission level to grant
 *     responses:
 *       200:
 *         description: Form shared successfully
 *       400:
 *         description: Invalid request
 *       403:
 *         description: Only owner can share forms
 *       404:
 *         description: Form or user not found
 */
router.post("/:form_id/share", authenticateToken, checkFormPermission('OWNER'), shareForm);

/**
 * @swagger
 * /api/forms/{form_id}/share/{user_id}:
 *   delete:
 *     summary: Remove user's access to form
 *     description: Revoke a user's permissions. Only form owner can unshare.
 *     tags:
 *       - Form Permissions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: form_id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Access removed successfully
 *       403:
 *         description: Only owner can unshare forms
 *       404:
 *         description: Form or user not found
 */
router.delete("/:form_id/share/:user_id", authenticateToken, checkFormPermission('OWNER'), unshareForm);

/**
 * @swagger
 * /api/forms/{form_id}/shared-users:
 *   get:
 *     summary: Get list of users with form access
 *     description: Retrieve owner and all users who have been granted access to the form
 *     tags:
 *       - Form Permissions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: form_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of users with access
 *       403:
 *         description: Permission denied
 *       404:
 *         description: Form not found
 */
router.get("/:form_id/shared-users", authenticateToken, checkFormPermission('VIEW'), getSharedUsers);

/**
 * @swagger
 * /api/forms/{form_id}/preview:
 *   post:
 *     tags:
 *       - Forms
 *     summary: Preview form validation without saving (P1)
 *     description: Validates form responses against schema without creating a submission. Phase I - no workflow triggers.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: form_id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               responses:
 *                 type: object
 *                 description: Form field responses to validate
 *               form_version_id:
 *                 type: string
 *                 description: Optional - specific version to validate against
 *     responses:
 *       200:
 *         description: Validation results (valid=true or errors array)
 *       404:
 *         description: Form not found
 */
router.post("/:form_id/preview", sanitizeRequestBody('strict'), authenticateToken, previewFormValidation);

/**
 * @route POST /api/forms/submissions
 * @desc Create a new form submission (for task/subtask forms)
 * @access Private
 */
router.post('/submissions', formSubmitLimiter, sanitizeRequestBody('strict'), authenticateToken, createFormSubmission);

/**
 * @route PUT /api/forms/submissions/:submission_id
 * @desc Update an existing form submission
 * @access Private
 */
router.put('/submissions/:submission_id', formSubmitLimiter, sanitizeRequestBody('strict'), authenticateToken, updateFormSubmission);

/**
 * @route GET /api/forms/submissions/my-submission
 * @desc Get current user's submission for a specific task/form (single - returns first/most recent)
 * @deprecated Use /my-submissions for multi-submission support
 * @access Private
 */
router.get('/submissions/my-submission', authenticateToken, getMySubmissionForTask);

/**
 * @route GET /api/forms/submissions/my-submissions
 * @desc Get all current user's submissions for a task/form (multi-submission support)
 * @access Private
 */
router.get('/submissions/my-submissions', authenticateToken, getMySubmissionsForTask);

/**
 * @route GET /api/forms/submissions/:submission_id
 * @desc Get a form submission by ID
 * @access Private
 */
router.get('/submissions/:submission_id', authenticateToken, getFormSubmissionById);

/**
 * @swagger
 * /api/public/forms/{token}:
 *   get:
 *     tags:
 *       - Public Forms
 *     summary: Get public form by external token
 *     description: Retrieve a published form using its external access token (no authentication required)
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         description: External access token for the form
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Form retrieved successfully
 *       404:
 *         description: Form not found or unpublished
 *       403:
 *         description: Form not available or expired
 */
router.get('/public/:token', getPublicFormByToken);

// Authenticated form submission file access
router.get('/submissions/:submissionId/files/:attachmentId/view', authenticateToken, viewFormSubmissionFile);
router.get('/submissions/:submissionId/files/:attachmentId/download', authenticateToken, downloadFormSubmissionFile);

export default router;


