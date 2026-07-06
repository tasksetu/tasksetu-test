import express from 'express';
import { seatManagementService } from '../services/seatManagementService.js';
import { roleAuth } from '../middleware/roleAuth.js';
import { User } from '../modals/userModal.js';
import { Organization } from '../modals/organizationModal.js';

const router = express.Router();

/**
 * @swagger
 * /api/organization/users/{userId}/remove:
 *   delete:
 *     summary: Remove user from organization and release their seat
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of user to remove
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for removal
 *               transferSeatsTo:
 *                 type: string
 *                 description: User ID to transfer seats to (optional)
 *     responses:
 *       200:
 *         description: User removed successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.delete(
  '/users/:userId/remove',
  roleAuth(['org_admin']),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { reason = 'User removed by admin', transferSeatsTo } = req.body;
      const adminUserId = req.user.id;
      const organizationId = req.user.orgId;

      console.log(`🗑️ Removing user ${userId} from organization ${organizationId}`);

      // Check if user exists and belongs to organization
      const user = await User.findOne({
        _id: userId,
        organization_id: organizationId
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found in this organization'
        });
      }

      // Prevent admin from removing themselves
      if (userId === adminUserId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot remove yourself'
        });
      }

      let seatReleaseResult = null;
      let transferResult = null;

      // Release seat if user has one assigned
      if (user.seat_assigned) {
        seatReleaseResult = await seatManagementService.releaseSeatFromUser(
          organizationId,
          userId,
          adminUserId,
          reason
        );

        // If transfer is requested and seat was released
        if (transferSeatsTo && seatReleaseResult.success) {
          try {
            transferResult = await seatManagementService.assignSeatToUser(
              organizationId,
              transferSeatsTo,
              adminUserId,
              `Seat transferred from removed user ${user.email}`
            );
          } catch (transferError) {
            console.warn(`⚠️ Failed to transfer seat to ${transferSeatsTo}:`, transferError.message);
          }
        }
      }

      // Update user status to removed
      await User.findByIdAndUpdate(userId, {
        status: 'removed',
        isActive: false,
        removed_at: new Date(),
        removed_by: adminUserId,
        removal_reason: reason,
        updated_at: new Date()
      });

      console.log(`✅ User ${user.email} removed from organization`);

      const response = {
        success: true,
        message: 'User removed successfully',
        user: {
          id: userId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        },
        seatReleased: !!seatReleaseResult,
        releasedSeatNumber: seatReleaseResult?.releasedSeatNumber,
        seatsAvailable: seatReleaseResult?.seatsAvailable,
        seatTransferred: !!transferResult,
        transferDetails: transferResult ? {
          toUserId: transferSeatsTo,
          newSeatNumber: transferResult.seatNumber
        } : null
      };

      res.json(response);

    } catch (error) {
      console.error('❌ Error removing user:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove user',
        error: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/organization/users/{userId}/transfer-seat:
 *   post:
 *     summary: Transfer seat from one user to another
 *     tags: [Seat Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of user to transfer seat from
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - toUserId
 *             properties:
 *               toUserId:
 *                 type: string
 *                 description: ID of user to transfer seat to
 *               reason:
 *                 type: string
 *                 description: Reason for transfer
 *     responses:
 *       200:
 *         description: Seat transferred successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post(
  '/users/:userId/transfer-seat',
  roleAuth(['org_admin']),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { toUserId, reason = 'Admin seat transfer' } = req.body;
      const adminUserId = req.user.id;
      const organizationId = req.user.orgId;

      if (!toUserId) {
        return res.status(400).json({
          success: false,
          message: 'Target user ID is required'
        });
      }

      console.log(`🔄 Transferring seat from ${userId} to ${toUserId}`);

      const transferResult = await seatManagementService.transferSeat(
        organizationId,
        userId,
        toUserId,
        adminUserId,
        reason
      );

      res.json({
        success: true,
        message: transferResult.message,
        transfer: {
          fromUser: {
            id: transferResult.fromUser._id,
            email: transferResult.fromUser.email
          },
          toUser: {
            id: transferResult.toUser._id,
            email: transferResult.toUser.email
          },
          seatNumber: transferResult.seatNumber
        }
      });

    } catch (error) {
      console.error('❌ Error transferring seat:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to transfer seat',
        error: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/organization/seat-allocation:
 *   get:
 *     summary: Get current seat allocation for organization
 *     tags: [Seat Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Seat allocation retrieved successfully
 *       500:
 *         description: Server error
 */
router.get(
  '/seat-allocation',
  roleAuth(['org_admin', 'manager']),
  async (req, res) => {
    try {
      const organizationId = req.user.orgId;

      console.log(`📊 Getting seat allocation for organization ${organizationId}`);

      const allocation = await seatManagementService.getSeatAllocation(organizationId);

      res.json({
        success: true,
        allocation
      });

    } catch (error) {
      console.error('❌ Error getting seat allocation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get seat allocation',
        error: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/organization/users/{userId}/assign-seat:
 *   post:
 *     summary: Manually assign seat to a user
 *     tags: [Seat Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of user to assign seat to
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for seat assignment
 *     responses:
 *       200:
 *         description: Seat assigned successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post(
  '/users/:userId/assign-seat',
  roleAuth(['org_admin']),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { reason = 'Manual seat assignment' } = req.body;
      const adminUserId = req.user.id;
      const organizationId = req.user.orgId;

      console.log(`🎯 Manually assigning seat to user ${userId}`);

      const assignmentResult = await seatManagementService.assignSeatToUser(
        organizationId,
        userId,
        adminUserId,
        reason
      );

      res.json({
        success: true,
        message: assignmentResult.message,
        assignment: {
          userId: assignmentResult.user._id,
          userEmail: assignmentResult.user.email,
          seatNumber: assignmentResult.seatNumber,
          seatsRemaining: assignmentResult.seatsRemaining
        }
      });

    } catch (error) {
      console.error('❌ Error assigning seat:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to assign seat',
        error: error.message
      });
    }
  }
);

export { router as seatManagementRoutes };