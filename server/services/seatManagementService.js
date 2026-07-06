import mongoose from 'mongoose';
import { User } from '../modals/userModal.js';
import { Organization } from '../modals/organizationModal.js';
import { OrganizationSubscription } from '../modals/organizationSubscriptionModal.js';
import { OrganizationLicensePurchase } from '../modals/organizationLicensePurchaseModal.js';

class SeatManagementService {
  /**
   * ✅ SINGLE SOURCE OF TRUTH: Fetch license limits from database
   * @param {string} licenseCode 
   * @returns {Promise<Object>} Limits object
   */
  async getLicenseLimitsFromDB(licenseCode) {
    try {
      const { LicenseFeatureMapping } = await import('../modals/licenseFeatureMappingModal.js');
      const mappings = await LicenseFeatureMapping.find({ 
        license_code: licenseCode.toUpperCase(),
        is_enabled: true 
      });

      const limits = {
        max_projects_per_user: -1,
        max_tasks_per_user: -1,
        max_storage_per_user_mb: -1,
        max_collaborators_per_user: -1,
        features_enabled: []
      };

      mappings.forEach(m => {
        limits.features_enabled.push(m.feature_code);
        
        // Map feature codes to specific limit fields if necessary
        if (m.feature_code === 'TASK_BASIC') limits.max_tasks_per_user = m.usage_limit;
        if (m.feature_code === 'PROC_CREATE') limits.max_projects_per_user = m.usage_limit;
        if (m.feature_code === 'TASK_EMAIL') limits.max_collaborators_per_user = m.usage_limit; // Example mapping
      });

      console.log(`📊 [SEAT SERVICE] Fetched limits for ${licenseCode} from DB`);
      return limits;
    } catch (error) {
      console.error(`❌ Error fetching limits for ${licenseCode}:`, error);
      return {}; // Fallback
    }
  }

  // Assign a seat to a user
  async assignSeatToUser(organizationId, userId, assignedBy, reason = 'User invitation', requestedLicenseCode = null) {
    try {
      console.log(`🎯 Assigning seat to user ${userId} in org ${organizationId} with license ${requestedLicenseCode || 'auto'}`);

      // Convert to ObjectId if needed
      const orgObjectId = new mongoose.Types.ObjectId(organizationId);
      const userObjectId = new mongoose.Types.ObjectId(userId);

      // Get organization
      const organization = await Organization.findById(orgObjectId);

      // Try to get multi-license purchases first (new system)
      const OrganizationLicensePurchase = mongoose.model('OrganizationLicensePurchase');
      const licensePurchases = await OrganizationLicensePurchase.find({
        organization_id: orgObjectId,
        status: 'ACTIVE'
      });

      let subscription = null;
      let usingMultiLicenseSystem = false;

      if (licensePurchases && licensePurchases.length > 0) {
        // Using new multi-license system
        usingMultiLicenseSystem = true;
        console.log(`📦 Using multi-license system with ${licensePurchases.length} active purchase(s)`);

        // Create a virtual subscription object for compatibility
        const totalSeatsPurchased = licensePurchases.reduce((sum, p) => sum + (p.seats_purchased || 0), 0);
        const totalSeatsUsed = licensePurchases.reduce((sum, p) => sum + (p.seats_used || 0), 0);

        subscription = {
          seats_purchased: totalSeatsPurchased,
          seats_used: totalSeatsUsed,
          license_code: licensePurchases[0].license_code,
          _id: licensePurchases[0]._id
        };
        console.log(`💺 Multi-license total: ${totalSeatsUsed}/${totalSeatsPurchased} seats used`);
      } else {
        // Fallback to old single subscription system
        subscription = await OrganizationSubscription.findOne({
          organization_id: orgObjectId,
          status: 'ACTIVE'
        });

        if (!subscription) {
          throw new Error('No active subscription found for organization');
        }
        console.log(`📦 Using single subscription system`);
      }

      // Check if user exists and belongs to organization
      const targetUser = await User.findOne({
        _id: userObjectId,
        organization_id: orgObjectId
      });

      if (!targetUser) {
        throw new Error('User not found or does not belong to this organization');
      }

      // Check if user already has a seat
      if (targetUser.seat_assigned === true) {
        console.log(`⚠️ User ${targetUser.email} already has seat ${targetUser.seat_number} assigned`);
        return {
          success: true,
          message: 'User already has a seat assigned',
          user: targetUser,
          seatNumber: targetUser.seat_number,
          seatsRemaining: subscription.seats_purchased - subscription.seats_used
        };
      }

      // Determine which license to assign
      let licenseCode;
      let availablePurchase = null;

      if (requestedLicenseCode) {
        // Multi-license system: Find available purchase for requested license
        const OrganizationLicensePurchase = mongoose.model('OrganizationLicensePurchase');
        availablePurchase = await OrganizationLicensePurchase.findOne({
          organization_id: orgObjectId,
          license_code: requestedLicenseCode.toUpperCase(),
          status: 'ACTIVE',
          $expr: { $lt: ['$seats_used', '$seats_purchased'] }
        }).sort({ purchase_date: 1 });

        if (!availablePurchase) {
          throw new Error(`No available seats for license ${requestedLicenseCode}. Please purchase more seats.`);
        }

        licenseCode = requestedLicenseCode.toUpperCase();
        console.log(`📦 Found available purchase for ${licenseCode}: ${availablePurchase._id}`);
      } else {
        // Fallback to organization's main license
        licenseCode = subscription.license_code || organization?.license_code || 'PLAN';
        console.log(`📦 Using organization's main license: ${licenseCode}`);
      }

      // Check if seats are available in main subscription
      const currentSeatsUsed = subscription.seats_used || 0;
      if (currentSeatsUsed >= subscription.seats_purchased) {
        throw new Error(`No seats available. ${currentSeatsUsed}/${subscription.seats_purchased} seats used`);
      }

      // Find the next available seat number
      const occupiedSeats = await User.find({
        organization_id: orgObjectId,
        seat_assigned: true,
        $or: [
          { status: 'active' },
          { status: 'invited' },
          { isActive: true }
        ]
      }).select('seat_number').sort({ seat_number: 1 });

      let seatNumber = 1;
      const occupiedNumbers = occupiedSeats.map(seat => seat.seat_number).filter(num => num != null);

      // Find the lowest available seat number
      for (let i = 1; i <= subscription.seats_purchased; i++) {
        if (!occupiedNumbers.includes(i)) {
          seatNumber = i;
          break;
        }
      }

      // Get license limits
      const licenseLimits = await this.getLicenseLimitsFromDB(licenseCode);

      // Prepare assigned_license object
      const assignedLicenseData = availablePurchase ? {
        license_code: licenseCode,
        purchase_id: availablePurchase._id,
        assigned_date: new Date()
      } : null;

      // Update user with seat assignment
      console.log(`💾 ASSIGN STEP 1: Updating user with license code: ${licenseCode}`);
      const updatedUser = await User.findByIdAndUpdate(userObjectId, {
        license_code: licenseCode,
        licenseId: licenseCode,
        assigned_license_code: licenseCode,  // ✅ THIS IS CRITICAL FOR DELETE!
        assigned_license: assignedLicenseData,
        seat_assigned: true,
        seat_number: seatNumber,
        seat_assigned_at: new Date(),
        license_limits: licenseLimits,
        isActive: true, // Ensure user is active when assigned a seat
        status: targetUser.status === 'invited' ? 'invited' : 'active', // Keep invited status if applicable
        updated_at: new Date()
      }, { new: true });

      console.log(`💾 ASSIGN STEP 2: User updated with assigned_license_code:`, updatedUser.assigned_license_code);

      // Update subscription seat counts
      const newSeatsUsed = currentSeatsUsed + 1;

      if (usingMultiLicenseSystem) {
        // Update the specific license purchase (already done above in availablePurchase update)
        console.log(`📊 Multi-license system: seat count updated via purchase record`);
      } else {
        // Update old single subscription system
        await OrganizationSubscription.findByIdAndUpdate(subscription._id, {
          $inc: { seats_used: 1 },
          $push: {
            seat_history: {
              action: 'assigned',
              user_id: userId,
              performed_by: assignedBy,
              timestamp: new Date(),
              reason: reason,
              seat_number: seatNumber,
              license_code: licenseCode
            }
          },
          updated_at: new Date()
        });
      }

      // If using license pool, update purchase seat count
      if (availablePurchase) {
        console.log(`📊 ASSIGN STEP 3: Updating license purchase - BEFORE:`, {
          license: licenseCode,
          purchase_id: availablePurchase._id,
          seats_used: availablePurchase.seats_used,
          seats_purchased: availablePurchase.seats_purchased
        });

        await availablePurchase.updateOne({
          $inc: { seats_used: 1 }
        });

        console.log(`📊 ASSIGN STEP 4: License pool update initiated for: ${licenseCode}`);

        // Verify the update
        const verifyPurchase = await availablePurchase.constructor.findById(availablePurchase._id);
        console.log(`📊 ASSIGN STEP 5: ✅ License purchase updated - AFTER:`, {
          license: licenseCode,
          seats_used: verifyPurchase.seats_used,
          seats_purchased: verifyPurchase.seats_purchased,
          seats_available: verifyPurchase.seats_purchased - verifyPurchase.seats_used
        });
        console.log(`✅ BACKEND VERIFY: License ${licenseCode} now has seats_used=${verifyPurchase.seats_used}, seats_purchased=${verifyPurchase.seats_purchased}, available=${verifyPurchase.seats_purchased - verifyPurchase.seats_used}`);
      }

      console.log(`✅ Seat ${seatNumber} assigned to user ${updatedUser.email}`);
      console.log(`📊 Seat count: ${newSeatsUsed}/${subscription.seats_purchased}`);

      return {
        success: true,
        message: `Seat ${seatNumber} assigned successfully`,
        user: updatedUser,
        seatNumber: seatNumber,
        seatsRemaining: subscription.seats_purchased - newSeatsUsed
      };

    } catch (error) {
      console.error('❌ Error assigning seat:', error);
      throw error;
    }
  }

  // Release a seat from a user
  async releaseSeatFromUser(organizationId, userId, releasedBy, reason = 'User removal') {
    try {
      console.log(`🗑️ STEP 1: Releasing seat from user ${userId} in org ${organizationId}`);

      // Convert to ObjectId if needed
      const orgObjectId = new mongoose.Types.ObjectId(organizationId);
      const userObjectId = new mongoose.Types.ObjectId(userId);

      // Get user with seat
      const user = await User.findOne({
        _id: userObjectId,
        organization_id: orgObjectId
      });

      console.log('🗑️ STEP 2: User found:', {
        email: user?.email,
        seat_assigned: user?.seat_assigned,
        seat_number: user?.seat_number,
        assigned_license_code: user?.assigned_license_code
      });

      if (!user) {
        throw new Error('User not found or does not belong to this organization');
      }

      if (!user.seat_assigned) {
        console.log(`⚠️ User ${user.email} does not have a seat assigned`);
        return {
          success: true,
          message: 'User does not have an assigned seat',
          user: user
        };
      }

      const seatNumber = user.seat_number;
      const licenseCode = user.assigned_license_code;

      console.log('🗑️ STEP 3: Attempting to release seat:', {
        seatNumber,
        licenseCode
      });

      // Check for multi-license system first
      const multiLicenses = await OrganizationLicensePurchase.find({
        organization_id: orgObjectId,
        status: 'ACTIVE'
      });

      console.log('🗑️ STEP 4: Multi-license purchases found:', multiLicenses.length);

      let licenseUpdated = false;

      if (multiLicenses.length > 0 && licenseCode) {
        // Multi-license system: Find and update the specific license
        console.log(`🗑️ STEP 5: Finding multi-license for code: ${licenseCode}`);

        const licensePurchase = await OrganizationLicensePurchase.findOne({
          organization_id: orgObjectId,
          license_code: licenseCode,
          status: 'ACTIVE'
        });

        if (licensePurchase) {
          const beforeUsed = licensePurchase.seats_used;
          const beforeAvailable = licensePurchase.seats_available;

          console.log('🗑️ STEP 6: License purchase found, current state:', {
            license: licenseCode,
            seats_purchased: licensePurchase.seats_purchased,
            seats_used: beforeUsed,
            seats_available: beforeAvailable
          });

          // Decrement seats_used and increment seats_available
          await OrganizationLicensePurchase.findByIdAndUpdate(licensePurchase._id, {
            $inc: {
              seats_used: -1,
              seats_available: 1
            },
            $push: {
              seat_history: {
                action: 'released',
                user_id: userId,
                performed_by: releasedBy,
                timestamp: new Date(),
                reason: reason,
                seat_number: seatNumber
              }
            }
          });

          // Verify the update
          const verifyLicense = await OrganizationLicensePurchase.findById(licensePurchase._id);
          console.log('🗑️ STEP 7: ✅ License updated successfully:', {
            license: licenseCode,
            before_used: beforeUsed,
            after_used: verifyLicense.seats_used,
            before_available: beforeAvailable,
            after_available: verifyLicense.seats_available
          });

          licenseUpdated = true;
        } else {
          console.log('🗑️ STEP 6: ⚠️ No matching license purchase found for code:', licenseCode);
        }
      }

      // Fallback to old subscription system if no multi-license found
      if (!licenseUpdated) {
        console.log('🗑️ STEP 8: Checking old subscription system...');
        const subscription = await OrganizationSubscription.findOne({
          organization_id: orgObjectId,
          status: 'ACTIVE'
        });

        if (subscription) {
          console.log('🗑️ STEP 9: Old subscription found, updating...');
          const beforeSeatsUsed = subscription.seats_used;
          await OrganizationSubscription.findByIdAndUpdate(subscription._id, {
            $inc: { seats_used: -1 },
            $push: {
              seat_history: {
                action: 'released',
                user_id: userId,
                performed_by: releasedBy,
                timestamp: new Date(),
                reason: reason,
                seat_number: seatNumber
              }
            },
            updated_at: new Date()
          });
          console.log('🗑️ STEP 10: ✅ Old subscription updated, seats_used:', beforeSeatsUsed, '→', beforeSeatsUsed - 1);
        } else {
          console.log('🗑️ STEP 10: ⚠️ No active subscription found');
        }
      }

      // Update user to release seat
      console.log('🗑️ STEP 11: Updating user to release seat...');
      const updatedUser = await User.findByIdAndUpdate(userObjectId, {
        seat_assigned: false,
        seat_number: null,
        seat_released_at: new Date(),
        assigned_license_code: null, // Clear license code
        license_limits: null, // Clear license limits
        status: 'inactive', // Mark as inactive
        isActive: false,
        updated_at: new Date()
      }, { new: true });

      console.log('🗑️ STEP 12: ✅ User updated:', {
        email: updatedUser.email,
        seat_assigned: updatedUser.seat_assigned,
        assigned_license_code: updatedUser.assigned_license_code
      });

      console.log('🎉 STEP 13: Seat released successfully for user:', user.email, 'seat #', seatNumber, 'license:', licenseCode);

      return {
        success: true,
        message: 'Seat released successfully',
        user: updatedUser,
        seat_number: seatNumber,
        license_code: licenseCode
      };

    } catch (error) {
      console.error('❌ Error releasing seat:', error);
      throw error;
    }
  }

  // Transfer seat from one user to another
  async transferSeat(organizationId, fromUserId, toUserId, transferredBy, reason = 'Seat transfer') {
    try {
      console.log(`🔄 Transferring seat from ${fromUserId} to ${toUserId}`);

      // Release seat from first user
      const releaseResult = await this.releaseSeatFromUser(organizationId, fromUserId, transferredBy, `Transfer to user ${toUserId}`);

      // Assign seat to new user
      const assignResult = await this.assignSeatToUser(organizationId, toUserId, transferredBy, `Transferred from user ${fromUserId}`);

      // Log transfer in subscription history
      const subscription = await OrganizationSubscription.findOne({
        organization_id: organizationId,
        status: 'ACTIVE'
      });

      await OrganizationSubscription.findByIdAndUpdate(subscription._id, {
        $push: {
          seat_history: {
            action: 'transferred',
            from_user_id: fromUserId,
            to_user_id: toUserId,
            performed_by: transferredBy,
            timestamp: new Date(),
            reason: reason,
            seat_number: assignResult.seatNumber
          }
        }
      });

      console.log(`✅ Seat transferred successfully`);

      return {
        success: true,
        message: 'Seat transferred successfully',
        fromUser: releaseResult.user,
        toUser: assignResult.user,
        seatNumber: assignResult.seatNumber
      };

    } catch (error) {
      console.error('❌ Error transferring seat:', error);
      throw error;
    }
  }

  // Get current seat allocation for organization
  async getSeatAllocation(organizationId) {
    try {
      // Convert to ObjectId if needed
      const orgObjectId = new mongoose.Types.ObjectId(organizationId);

      const subscription = await OrganizationSubscription.findOne({
        organization_id: orgObjectId,
        status: 'ACTIVE'
      });

      if (!subscription) {
        throw new Error('No active subscription found');
      }

      // Get all users with assigned seats (include both active and invited)
      const usersWithSeats = await User.find({
        organization_id: orgObjectId,
        seat_assigned: true,
        $or: [
          { status: 'active' },
          { status: 'invited' },
          { isActive: true }
        ]
      }).select('email firstName lastName seat_number license_code license_limits seat_assigned_at').sort({ seat_number: 1 });

      // Get recent seat history
      const recentHistory = subscription.seat_history ? subscription.seat_history.slice(-10).reverse() : [];

      return {
        subscription: {
          license_code: subscription.license_code,
          seats_purchased: subscription.seats_purchased,
          seats_used: subscription.seats_used, // Use correct field name
          seats_available: subscription.seats_purchased - (subscription.seats_used || 0)
        },
        users_with_seats: usersWithSeats,
        seat_history: recentHistory,
        available_seat_numbers: this.getAvailableSeatNumbers(subscription.seats_purchased, usersWithSeats)
      };

    } catch (error) {
      console.error('❌ Error getting seat allocation:', error);
      throw error;
    }
  }

  // Get available seat numbers
  getAvailableSeatNumbers(totalSeats, usersWithSeats) {
    const occupiedNumbers = usersWithSeats.map(user => user.seat_number);
    const available = [];

    for (let i = 1; i <= totalSeats; i++) {
      if (!occupiedNumbers.includes(i)) {
        available.push(i);
      }
    }

    return available;
  }

  // Auto-reassign seats when license is upgraded
  async autoReassignSeatsOnUpgrade(organizationId, newLicenseCode, upgradedBy) {
    try {
      console.log(`🔄 Auto-reassigning seats for license upgrade to ${newLicenseCode}`);

      const newLicenseLimits = await this.getLicenseLimitsFromDB(newLicenseCode);

      // Get all active users in organization
      const users = await User.find({
        organization_id: organizationId,
        status: 'active',
        isActive: true
      });

      let reassignedCount = 0;

      for (const user of users) {
        // Update user license and limits
        await User.findByIdAndUpdate(user._id, {
          license_code: newLicenseCode,
          licenseId: newLicenseCode === 'PLAN' ? 'Plan' : newLicenseCode,
          license_limits: newLicenseLimits,
          updated_at: new Date()
        });

        reassignedCount++;
      }

      console.log(`✅ Reassigned ${reassignedCount} users to ${newLicenseCode} license`);

      return {
        success: true,
        message: `${reassignedCount} users upgraded to ${newLicenseCode} license`,
        reassignedUsers: reassignedCount
      };

    } catch (error) {
      console.error('❌ Error auto-reassigning seats:', error);
      throw error;
    }
  }
}

export const seatManagementService = new SeatManagementService();