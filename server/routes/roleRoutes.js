import express from "express";
import * as roleController from "../controller/roleController.js";
import { authenticateToken, roleAuth } from "../middleware/roleAuth.js";

const router = express.Router();

/**
 * @swagger
 * /api/organization/roles:
 *   get:
 *     summary: Get all roles for organization
 *     tags:
 *       - Roles
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of roles
 *       500:
 *         description: Server error
 */
router.get(
  "/organization/roles",
  authenticateToken,
  roleAuth(["org_admin"]),
  roleController.getRoles
);

/**
 * @swagger
 * /api/organization/roles:
 *   post:
 *     summary: Create a custom role
 *     tags:
 *       - Roles
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - permissions
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Role created successfully
 *       400:
 *         description: Invalid data
 *       500:
 *         description: Server error
 */
router.post(
  "/organization/roles",
  authenticateToken,
  roleAuth(["org_admin"]),
  roleController.createRole
);

/**
 * @swagger
 * /api/organization/roles/{roleId}:
 *   put:
 *     summary: Update a custom role
 *     tags:
 *       - Roles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
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
 *               description:
 *                 type: string
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Role updated successfully
 *       403:
 *         description: Cannot modify system roles
 *       500:
 *         description: Server error
 */
router.put(
  "/organization/roles/:roleId",
  authenticateToken,
  roleAuth(["org_admin"]),
  roleController.updateRole
);

/**
 * @swagger
 * /api/organization/roles/{roleId}:
 *   delete:
 *     summary: Delete a custom role
 *     tags:
 *       - Roles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role deleted successfully
 *       400:
 *         description: Role is in use
 *       403:
 *         description: Cannot delete system roles
 *       500:
 *         description: Server error
 */
router.delete(
  "/organization/roles/:roleId",
  authenticateToken,
  roleAuth(["org_admin"]),
  roleController.deleteRole
);

/**
 * @swagger
 * /api/organization/users/{userId}/roles:
 *   put:
 *     summary: Assign roles to a user
 *     tags:
 *       - Roles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
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
 *               roles:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Roles assigned successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.put(
  "/organization/users/:userId/roles",
  authenticateToken,
  roleAuth(["org_admin"]),
  roleController.assignRoleToUser
);

export default router;
