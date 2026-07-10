import express from "express";
import * as userController from "../controller/userController.js";
import { authenticateToken, roleAuth } from "../middleware/roleAuth.js";

const router = express.Router();

/**
 * @swagger
 * /api/organization-employees:
 *   get:
 *     summary: Get all employees in an organization
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of employees in the organization
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get("/organization-employees",authenticateToken,  roleAuth(["org_admin"]), userController.getEmployeesByOrganization);
// Get basic organization stats
router.get("/organization/:orgId/stats", authenticateToken,  roleAuth(["org_admin"]), userController.getOrgStats);

/**
 * @swagger
 * /api/users/search:
 *   get:
 *     summary: Search user by email
 *     description: Find a user by exact email match for form sharing
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: User email address
 *     responses:
 *       200:
 *         description: User found
 *       404:
 *         description: User not found
 *       400:
 *         description: Invalid request
 */
router.get("/users/search", authenticateToken, userController.searchUserByEmail);

/**
 * @swagger
 * /api/organization/users/{userId}:
 *   delete:
 *     summary: Remove/Delete a user
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User removed successfully
 *       400:
 *         description: Cannot remove primary admin
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.delete(
  "/organization/users/:userId",
  authenticateToken,
  roleAuth(["org_admin"]),
  userController.removeUser
);
/**
 * @swagger
 * /api/organization/users/update-status:
 *   put:
 *     summary: Update a user's status (active/inactive)
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.put(
  "/organization/users/update-status",
  authenticateToken,
  roleAuth(["org_admin"]),
  userController.updateUserStatus
);
/**
 * @swagger
 * /api/organization/{orgId}/users:
 *   get:
 *     summary: Get all users in an organization
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/organization/:orgId/users",
  authenticateToken, // <-- authentication middleware (should set req.user)
  roleAuth(["org_admin"]),
  userController.getUsersByOrg
);
// Only org_admin can update user
/**
 * @swagger
 * /api/organization/users/{userId}:
 *   put:
 *     summary: Update a user's details
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserUpdate'
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.put(
  "/organization/users/:userId",
  authenticateToken,
  roleAuth(["org_admin"]),
  userController.updateUser
);
/**
 * @swagger
 * /api/organization/users/send-invite:
 *   post:
 *     summary: Send an invitation email to a user (resend invite)
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Invitation sent successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post(
  "/organization/users/send-invite",
  authenticateToken,
  roleAuth(["org_admin"]),
  userController.sendInvite
);

/**
 * @swagger
 * /api/users/search-assignable:
 *   get:
 *     summary: Search users for task assignment
 *     description: Returns active users that can be assigned to tasks with search functionality
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term to filter users by name, email, department, or designation
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of users to return
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       value:
 *                         type: string
 *                       label:
 *                         type: string
 *                       email:
 *                         type: string
 *                       department:
 *                         type: string
 *                       designation:
 *                         type: string
 *                       role:
 *                         type: string
 *                 total:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get(
  "/users/search-assignable",
  authenticateToken,
  userController.searchAssignableUsers
);

/**
 * @swagger
 * /api/organization/users/bulk-upload:
 *   post:
 *     summary: Bulk upload users via CSV/Excel
 *     tags:
 *       - Users
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
 *         description: Bulk upload completed
 *       400:
 *         description: Invalid file or data
 *       500:
 *         description: Server error
 */
// Import multer for file upload
import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/organization/users/bulk-upload",
  authenticateToken,
  roleAuth(["org_admin"]),
  upload.single('file'),
  userController.bulkUploadUsers
);

/**
 * @swagger
 * /api/organization/users/{userId}/reset-password:
 *   put:
 *     summary: Reset user password (Admin only)
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid password
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.put(
  "/organization/users/:userId/reset-password",
  authenticateToken,
  roleAuth(["org_admin"]),
  userController.resetUserPassword
);

router.post("/users/whatsapp/send-otp", authenticateToken, userController.sendWhatsAppOtp);
router.post("/users/whatsapp/verify-otp", authenticateToken, userController.verifyWhatsAppOtp);

export default router;
