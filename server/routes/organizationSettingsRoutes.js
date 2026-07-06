import express from "express";
import * as orgSettingsController from "../controller/organizationSettingsController.js";
import { authenticateToken, roleAuth } from "../middleware/roleAuth.js";
import multer from 'multer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * /api/organization/settings:
 *   get:
 *     summary: Get organization settings
 *     tags:
 *       - Organization Settings
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Organization settings
 *       500:
 *         description: Server error
 */
router.get(
  "/organization/settings",
  authenticateToken,
  roleAuth(["org_admin"]),
  orgSettingsController.getSettings
);

/**
 * @swagger
 * /api/organization/branding:
 *   put:
 *     summary: Update branding settings
 *     tags:
 *       - Organization Settings
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               primaryColor:
 *                 type: string
 *               secondaryColor:
 *                 type: string
 *               companyName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Branding updated successfully
 *       500:
 *         description: Server error
 */
router.put(
  "/organization/branding",
  authenticateToken,
  roleAuth(["org_admin"]),
  orgSettingsController.updateBranding
);

/**
 * @swagger
 * /api/organization/branding/logo:
 *   post:
 *     summary: Upload company logo
 *     tags:
 *       - Organization Settings
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Logo uploaded successfully
 *       400:
 *         description: No file uploaded
 *       500:
 *         description: Server error
 */
router.post(
  "/organization/branding/logo",
  authenticateToken,
  roleAuth(["org_admin"]),
  upload.single('file'),
  orgSettingsController.uploadLogo
);

/**
 * @swagger
 * /api/organization/branding/logo:
 *   delete:
 *     summary: Delete company logo
 *     tags:
 *       - Organization Settings
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logo deleted successfully
 *       500:
 *         description: Server error
 */
router.delete(
  "/organization/branding/logo",
  authenticateToken,
  roleAuth(["org_admin"]),
  orgSettingsController.deleteLogo
);

/**
 * @swagger
 * /api/organization/settings/notifications:
 *   put:
 *     summary: Update notification defaults
 *     tags:
 *       - Organization Settings
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emailEnabled:
 *                 type: boolean
 *               inAppEnabled:
 *                 type: boolean
 *               frequency:
 *                 type: string
 *                 enum: [instant, daily, weekly]
 *               defaultPreferences:
 *                 type: object
 *     responses:
 *       200:
 *         description: Notification settings updated
 *       400:
 *         description: Invalid data
 *       500:
 *         description: Server error
 */
router.put(
  "/organization/settings/notifications",
  authenticateToken,
  roleAuth(["org_admin"]),
  orgSettingsController.updateNotificationDefaults
);

/**
 * @swagger
 * /api/organization/settings/timezone:
 *   put:
 *     summary: Update timezone settings
 *     tags:
 *       - Organization Settings
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - timezone
 *             properties:
 *               timezone:
 *                 type: string
 *               dateFormat:
 *                 type: string
 *               timeFormat:
 *                 type: string
 *     responses:
 *       200:
 *         description: Timezone updated
 *       400:
 *         description: Invalid data
 *       500:
 *         description: Server error
 */
router.put(
  "/organization/settings/timezone",
  authenticateToken,
  roleAuth(["org_admin"]),
  orgSettingsController.updateTimezone
);

/**
 * @swagger
 * /api/organization/settings/working-hours:
 *   put:
 *     summary: Update working hours
 *     tags:
 *       - Organization Settings
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - start
 *               - end
 *             properties:
 *               start:
 *                 type: string
 *                 example: "09:00"
 *               end:
 *                 type: string
 *                 example: "17:00"
 *               weekends:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Working hours updated
 *       400:
 *         description: Invalid data
 *       500:
 *         description: Server error
 */
router.put(
  "/organization/settings/working-hours",
  authenticateToken,
  roleAuth(["org_admin"]),
  orgSettingsController.updateWorkingHours
);

/**
 * @swagger
 * /api/organization/templates:
 *   get:
 *     summary: Get all templates
 *     tags:
 *       - Templates
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [task, workflow, email]
 *     responses:
 *       200:
 *         description: List of templates
 *       500:
 *         description: Server error
 */
router.get(
  "/organization/templates",
  authenticateToken,
  roleAuth(["org_admin"]),
  orgSettingsController.getTemplates
);

/**
 * @swagger
 * /api/organization/templates:
 *   post:
 *     summary: Create a template
 *     tags:
 *       - Templates
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - name
 *               - content
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [task, workflow, email]
 *               name:
 *                 type: string
 *               content:
 *                 type: object
 *     responses:
 *       201:
 *         description: Template created
 *       400:
 *         description: Invalid data
 *       500:
 *         description: Server error
 */
router.post(
  "/organization/templates",
  authenticateToken,
  roleAuth(["org_admin"]),
  orgSettingsController.createTemplate
);

/**
 * @swagger
 * /api/organization/templates/{templateId}:
 *   put:
 *     summary: Update a template
 *     tags:
 *       - Templates
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
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
 *               name:
 *                 type: string
 *               content:
 *                 type: object
 *     responses:
 *       200:
 *         description: Template updated
 *       500:
 *         description: Server error
 */
router.put(
  "/organization/templates/:templateId",
  authenticateToken,
  roleAuth(["org_admin"]),
  orgSettingsController.updateTemplate
);

/**
 * @swagger
 * /api/organization/templates/{templateId}:
 *   delete:
 *     summary: Delete a template
 *     tags:
 *       - Templates
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Template deleted
 *       500:
 *         description: Server error
 */
router.delete(
  "/organization/templates/:templateId",
  authenticateToken,
  roleAuth(["org_admin"]),
  orgSettingsController.deleteTemplate
);

export default router;
