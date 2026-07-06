import express from "express";


import rateLimit from "express-rate-limit";
import { authController } from "../controller/authController.js";
import { authenticateToken } from "../middleware/roleAuth.js";

const router = express.Router();

const registerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many registrations. Please wait a minute." },
  standardHeaders: true,
  legacyHeaders: false,
});
/**
 * @swagger
 * /api/auth/register/individual:
 *   post:
 *     summary: Register an individual user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       201:
 *         description: Registration successful
 *       400:
 *         description: Invalid input
 */
router.post("/register/individual", authController.registerIndividual);

/**
 * @swagger
 * /api/auth/register/organization:
 *   post:
 *     summary: Register an organization and admin user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *               organizationName:
 *                 type: string
 *     responses:
 *       201:
 *         description: Registration successful
 *       400:
 *         description: Invalid input
 */
router.post("/register/organization", authController.registerOrganization);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", authController.login);

/**
 * @swagger
 * /api/auth/check-lockout:
 *   post:
 *     summary: Check if user account is locked out
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Lockout status returned
 */
router.post("/check-lockout", authController.checkLockout);


/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Send password reset email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset link sent
 *       400:
 *         description: Invalid input
 */
router.post("/forgot-password", authController.forgotPassword);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset user password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired token
 */
router.post("/reset-password", authController.resetPassword);

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change current user's password
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *               - confirmPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 description: Must be at least 8 chars and include uppercase, lowercase, number, and special character.
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       400:
 *         description: Validation error or incorrect current password
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/change-password", authenticateToken, authController.changePassword);

/**
 * @swagger
 * /api/auth/accept-invite:
 *   post:
 *     summary: Accept an invitation to join an organization
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Invitation accepted
 *       400:
 *         description: Invalid input
 */
router.post("/accept-invite", authController.acceptInvite);

/**
 * @swagger
 * /api/auth/validate-invite:
 *   get:
 *     summary: Validate an invitation token
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         required: true
 *         description: Invitation token
 *     responses:
 *       200:
 *         description: Invitation is valid
 *       400:
 *         description: Invalid or expired token
 */
router.get("/validate-invite", authController.validateInvite);

/**
 * @swagger
 * /api/auth/validate-invite-token:
 *   post:
 *     summary: Validate an invitation token (POST)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Invitation is valid
 *       400:
 *         description: Invalid or expired token
 */
router.post("/validate-invite-token", authController.validateInviteToken);

/**
 * @swagger
 * /api/auth/resend-invite:
 *   post:
 *     summary: Resend an invitation when the link has expired or is invalid
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 description: The expired/invalid invite token
 *               email:
 *                 type: string
 *                 description: The invited user's email, used if token isn't available
 *     responses:
 *       200:
 *         description: Invitation resent
 *       400:
 *         description: Validation error
 *       404:
 *         description: Invite not found
 */
router.post("/resend-invite", authController.resendInvitePublic);

/**
 * @swagger
 * /api/auth/complete-invitation:
 *   post:
 *     summary: Complete invitation and create user account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Account created
 *       400:
 *         description: Invalid input
 */
router.post("/complete-invitation", authController.completeInvitation);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current authenticated user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user data
 *       401:
 *         description: Unauthorized
 */
router.get("/me", authenticateToken, authController.getCurrentUser);

/**
 * @swagger
 * /api/auth/verify:
 *   get:
 *     summary: Verify authentication token and get current user (alias for /me)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user data
 *       401:
 *         description: Unauthorized
 */
router.get("/verify", authenticateToken, authController.getCurrentUser);

/**
 * @swagger
 * /api/auth/collaborators:
 *   get:
 *     summary: Get list of potential collaborators for approval tasks
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of collaborators
 *       401:
 *         description: Unauthorized
 */
router.get("/collaborators", authenticateToken, authController.getCollaboratorsList);

/**
 * @swagger
 * /api/auth/approvers:
 *   get:
 *     summary: Get list of potential approvers for approval tasks
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of approvers
 *       401:
 *         description: Unauthorized
 */
router.get("/approvers", authenticateToken, authController.getApproversList);

/**
 * @swagger
 * /api/auth/users:
 *   get:
 *     summary: Get list of all active users in the organization
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of organization users
 *       401:
 *         description: Unauthorized
 */
router.get("/users", authenticateToken, authController.getUsersList);

/**
 * @swagger
 * /api/auth/verify-token:
 *   post:
 *     summary: Verify email token and set password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email verified and password set
 *       400:
 *         description: Invalid or expired token
 */
router.post("/verify-token", authController.verifyToken);

/**
 * @swagger
 * /api/auth/validate-reset-token:
 *   post:
 *     summary: Validate a password reset token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token is valid
 *       400:
 *         description: Invalid or expired token
 */
router.post("/validate-reset-token", authController.validateResetToken);
router.post("/resend-verification", authController.resendVerificationLink);

/**
 * @swagger
 * /api/auth/verify-super-admin:
 *   post:
 *     summary: Verify super admin email and activate account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Super admin verified and activated
 *       400:
 *         description: Invalid or expired token
 */
router.post("/verify-super-admin", authController.verifySuperAdmin);

export default router;
