import express from 'express';
import { seatManagementService } from '../services/seatManagementService.js';
import { assignLicenseToUser } from '../services/licenseService.js'; // ✅ NEW: Import new license service
import { roleAuth, requireOrgAdminOrAbove } from '../middleware/roleAuth.js';
import { authenticateToken } from '../auth.js';
import { storage } from "../mongodb-storage.js";
import { emailService } from "../services/emailService.js";
import { User } from "../modals/userModal.js";
import { OrganizationSubscription } from "../modals/organizationSubscriptionModal.js";
import OrganizationLicensePurchase from "../modals/organizationLicensePurchaseModal.js";
import LicenseInstance from "../modals/licenseInstanceModal.js"; // ✅ NEW: Import license instance model
import { License } from "../modals/licenseModal.js";
import mongoose from 'mongoose';
const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// FREE USER QUOTA HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Free users multipliers per license tier:
 *   EXPLORE  → base 1 (flat, regardless of seats)
 *   PLAN     → 2 per seat
 *   EXECUTE  → 3 per seat
 *   OPTIMIZE → 4 per seat
 *
 * Formula:
 *   EntitledFreeUsers = 1 + (planSeats × 2) + (executeSeats × 3) + (optimizeSeats × 4)
 */
const FREE_USER_MULTIPLIERS = {
  PLAN: 2,
  EXECUTE: 3,
  OPTIMIZE: 4,
};

/**
 * Calculate how many free (EXPLORE) users this org is entitled to invite,
 * how many they have already used, and how many remain.
 *
 * "Used" counts ALL org members (including the primary admin if they have
 * EXPLORE license) whose effective license is EXPLORE or no license.
 * The org admin is NOT excluded — they count if they are a free user.
 *
 * @param {string} organizationId
 * @returns {{ entitled: number, used: number, remaining: number, breakdown: object }}
 */
async function getOrgFreeUserQuota(organizationId) {
  const orgId = new mongoose.Types.ObjectId(organizationId);

  // Fetch grace periods for licenses to correctly detect expired ones
  const licenseDefs = await License.find({ license_code: { $in: ['PLAN', 'EXECUTE', 'OPTIMIZE'] } })
    .select('license_code grace_period_days');
  const graceMap = {};
  for (const def of licenseDefs) {
    graceMap[def.license_code] = def.grace_period_days || 0;
  }

  // ── 1. Count paid seats by license type (not expired past grace period) ─────────
  const paidInstances = await LicenseInstance.find({
    organization_id: orgId,
    license_code: { $in: ['PLAN', 'EXECUTE', 'OPTIMIZE'] },
    status: { $in: ['AVAILABLE', 'ASSIGNED'] }
  }).select('license_code renewal_date');

  const seatsByCode = { PLAN: 0, EXECUTE: 0, OPTIMIZE: 0 };
  const now = new Date();
  for (const inst of paidInstances) {
    if (inst.renewal_date && inst.renewal_date < now) {
      const graceDays = graceMap[inst.license_code] || 0;
      const graceEnd = new Date(inst.renewal_date);
      graceEnd.setDate(graceEnd.getDate() + graceDays);
      if (now > graceEnd) {
        continue; // Expired past grace period, do not count as active seat
      }
    }
    seatsByCode[inst.license_code]++;
  }

  const planSeats    = seatsByCode.PLAN;
  const executeSeats = seatsByCode.EXECUTE;
  const optimizeSeats = seatsByCode.OPTIMIZE;

  const totalPaidSeats = planSeats + executeSeats + optimizeSeats;
  const base = totalPaidSeats > 0 ? 0 : 1;
  const entitled =
    base +
    planSeats    * FREE_USER_MULTIPLIERS.PLAN +
    executeSeats * FREE_USER_MULTIPLIERS.EXECUTE +
    optimizeSeats * FREE_USER_MULTIPLIERS.OPTIMIZE;

  // ── 2. Count existing free users in the org ────────────────────────────
  const orgUsers = await User.find({
    organization_id: orgId,
    status: { $in: ['active', 'invited', 'pending'] },
  }).populate('license_instance_id').select('license_code license_instance_id role isPrimaryAdmin');

  let used = 0;
  for (const u of orgUsers) {
    let userLicenseCode = u.license_instance_id?.license_code || u.license_code || 'EXPLORE';

    // Check if the assigned license is expired past its grace period
    if (u.license_instance_id) {
      const inst = u.license_instance_id;
      if (inst.renewal_date && inst.renewal_date < now) {
        const graceDays = graceMap[inst.license_code] || 0;
        const graceEnd = new Date(inst.renewal_date);
        graceEnd.setDate(graceEnd.getDate() + graceDays);
        if (now > graceEnd) {
          userLicenseCode = 'EXPIRED'; // Treat as EXPIRED (free) user
        }
      }
    }

    if (userLicenseCode === 'EXPLORE' || userLicenseCode === 'EXPIRED') {
      if (totalPaidSeats === 0) {
        const roles = Array.isArray(u.role) ? u.role : [u.role];
        const isUserOrgAdmin = roles.includes('org_admin') || u.isPrimaryAdmin === true;
        if (isUserOrgAdmin) {
          continue;
        }
      }
      used++;
    }
  }

  return {
    entitled,
    used,
    remaining: Math.max(0, entitled - used),
    breakdown: {
      base,
      plan_seats: planSeats,
      execute_seats: executeSeats,
      optimize_seats: optimizeSeats,
    },
  };
}
/**
 * @swagger
 * /api/organization/check-email-exists:
 *   post:
 *     summary: Check if an email is already a member of your organization
 *     tags: [Organization - User Invitation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: Email check result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Email is required
 *       500:
 *         description: Failed to check email
 */
// Check if email exists
router.post("/check-email-exists", authenticateToken, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const existingUser = await storage.getUserByEmail(email);
    if (existingUser && existingUser.organization?.toString() === req.user.organizationId) {
      return res.json({
        exists: true,
        message: "This email is already a member of your organization"
      });
    }

    res.json({ exists: false });
  } catch (error) {
    console.error("Email check error:", error);
    res.status(500).json({ message: "Failed to check email" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/organization/free-user-quota
// Returns how many free (EXPLORE) users this org can invite in total,
// how many are already used, and how many remain.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/free-user-quota", authenticateToken, requireOrgAdminOrAbove, async (req, res) => {
  try {
    const quota = await getOrgFreeUserQuota(req.user.organizationId);

    console.log(`📊 Free user quota for org ${req.user.organizationId}:`, quota);

    res.json({
      success: true,
      data: quota,
    });
  } catch (error) {
    console.error("❌ Free user quota error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch free user quota" });
  }
});

/**
 * @swagger
 * /api/organization/invite-users:

 *   post:
 *     summary: Invite users to your organization
 *     tags: [Organization - User Invitation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               invites:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["employee"]
 *                     licenseId:
 *                       type: string
 *                     department:
 *                       type: string
 *                     designation:
 *                       type: string
 *                     location:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     sendEmail:
 *                       type: boolean
 *               adminUser:
 *                 type: object
 *                 description: (Usually injected by backend, not required in request)
 *     responses:
 *       200:
 *         description: Invitations processed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 results:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           email:
 *                             type: string
 *                           message:
 *                             type: string
 *                           userId:
 *                             type: string
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           email:
 *                             type: string
 *                           error:
 *                             type: string
 *       400:
 *         description: Invalid invitation data
 *       500:
 *         description: Failed to process invitations
 */
// Send user invitation - requires manager role or above  
router.post(
  "/invite-users",
  authenticateToken,
  requireOrgAdminOrAbove,
  async (req, res) => {
    try {
      const { invites } = req.body;
      const adminUser = req.user; // Get from authenticated user, not body

      if (!invites || !Array.isArray(invites) || invites.length === 0) {
        return res.status(400).json({ message: "Invalid invitation data" });
      }

      console.log("🚀 Processing invitation for:", invites);
      console.log("👤 Admin user:", {
        id: adminUser.userId || adminUser.id,
        email: adminUser.email,
        orgId: adminUser.organizationId
      });

      // ✅ NEW: Check license pool availability using LicenseInstance model
      // Group invites by license type to check availability
      const licenseRequests = {};
      for (const invite of invites) {
        // Skip if no license specified (license is now optional)
        if (invite.licenseId && invite.licenseId !== 'EXPLORE') {
          const licenseCode = invite.licenseId;
          licenseRequests[licenseCode] = (licenseRequests[licenseCode] || 0) + 1;
        }
      }

      console.log('📦 License requests by type:', licenseRequests);

      // Check availability for each license type requested
      for (const [licenseCode, count] of Object.entries(licenseRequests)) {

        const availableCount = await LicenseInstance.countDocuments({
          organization_id: new mongoose.Types.ObjectId(adminUser.organizationId),
          license_code: licenseCode,
          status: 'AVAILABLE',
        });

        console.log(`📊 ${licenseCode}: ${count} requested, ${availableCount} available`);

        if (count > availableCount) {
          return res.status(403).json({
            success: false,
            message: `Not enough ${licenseCode} licenses available. You have ${availableCount} available but trying to assign ${count}.`,
            error: "INSUFFICIENT_LICENSES",
            licenseCode,
            available: availableCount,
            requested: count,
            needsPurchase: true,
            upgradeCTA: {
              title: `Purchase more ${licenseCode} licenses`,
              description: `You need ${count - availableCount} more ${licenseCode} license(s)`,
              action: "BUY_LICENSES"
            }
          });
        }
      }

      // ── FREE USER QUOTA CHECK ────────────────────────────────────────────
      // Count how many EXPLORE (free) users are in this batch
      const freeInvitesInBatch = invites.filter(
        (inv) => !inv.licenseId || inv.licenseId === 'EXPLORE'
      ).length;

      if (freeInvitesInBatch > 0) {
        const quota = await getOrgFreeUserQuota(adminUser.organizationId);

        console.log(`📊 Free user quota check: entitled=${quota.entitled}, used=${quota.used}, batch=${freeInvitesInBatch}`);

        if (quota.used + freeInvitesInBatch > quota.entitled) {
          const remaining = quota.remaining;
          const needed = freeInvitesInBatch;

          // Build helpful plan hints
          const planHints = [];
          if (quota.breakdown.plan_seats === 0)    planHints.push('PLAN (adds 2 free users/seat)');
          if (quota.breakdown.execute_seats === 0)  planHints.push('EXECUTE (adds 3 free users/seat)');
          if (quota.breakdown.optimize_seats === 0) planHints.push('OPTIMIZE (adds 4 free users/seat)');

          return res.status(403).json({
            success: false,
            message: remaining === 0
              ? `You have reached your free user limit (${quota.used}/${quota.entitled}). Please upgrade your subscription to invite more free users.`
              : `You can only invite ${remaining} more free user${remaining !== 1 ? 's' : ''}. You are trying to invite ${needed}. Please upgrade to invite more.`,
            error: "INSUFFICIENT_FREE_QUOTA",
            quota: {
              entitled: quota.entitled,
              used: quota.used,
              remaining: quota.remaining,
              breakdown: quota.breakdown,
            },
            freeInvitesRequested: freeInvitesInBatch,
            upgradeCTA: {
              title: 'Upgrade your plan to invite more free users',
              description: planHints.length > 0
                ? `Consider purchasing: ${planHints.join(', ')}`
                : 'Purchase additional paid seats to increase your free user limit.',
              action: 'BUY_LICENSES',
            },
          });
        }
      }
      // ────────────────────────────────────────────────────────────────────


      const results = {
        success: [],
        errors: [],
        details: [],
      };

      let seatsAssigned = 0;

      for (const invite of invites) {
        try {
          // ✅ Basic validation
          if (!invite.name || !invite.email || !invite.role) {
            results.errors.push({
              email: invite.email || "unknown",
              error: "Required fields: name, email, role must be provided",
            });
            continue;
          }

          // ✅ Email format validation
          const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
          if (!emailRegex.test(invite.email)) {
            results.errors.push({
              email: invite.email,
              error: `Invalid email format: ${invite.email}`,
            });
            continue;
          }

          // ✅ Validate role
          const validRoles = [
            "admin",
            "user",
            "manager",
            "employee",
            "org_admin",
          ];
          if (!invite.role.every((r) => validRoles.includes(r))) {
            results.errors.push({
              email: invite.email,
              error: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
            });
            continue;
          }

          // ✅ Check for existing user (org-specific)
          const existingUser = await User.findOne({
            email: invite.email.toLowerCase(),
            organization_id: adminUser.organizationId,
          });

          if (existingUser) {
            results.errors.push({
              email: invite.email,
              error: "Email is already registered in this organization",
            });
            continue;
          }

          console.log(`📧 Processing invite for ${invite.email}`);

          // ✅ Get organization details
          const organization = await storage.getOrganization(
            adminUser.organizationId
          );
          const organizationName = organization?.name || "TaskSetu";

          // Get admin user details
          const adminUserId = adminUser.userId || adminUser.id || adminUser._id;
          const adminName = adminUser.name || adminUser.email || "Admin";

          console.log(`📦 Preparing invitation data for ${invite.email}`);

          // ✅ Pass full inviteData with company account type
          const invitationResult = await storage.inviteUserToOrganization({
            email: invite.email,
            organizationId: adminUser.organizationId,
            roles: invite.role,
            invitedBy: adminUserId,
            invitedByName: adminName,
            organizationName,
            license_type: invite.license_type || null, // 🆕 NEW: Optional license type
            licenseId: invite.licenseId || null,
            department: invite.department || null,
            designation: invite.designation || null,
            location: invite.location || null,
            phone: invite.phone || null,
            name: invite.name,
            sendEmail: invite.sendEmail !== false, // default true
            accountType: 'company', // Organization users are company accounts
          });

          // ✅ NEW: ASSIGN LICENSE USING NEW LICENSE SERVICE
          try {
            const licenseCode = invite.licenseId || 'EXPLORE';
            const adminUserId = adminUser.userId || adminUser.id || adminUser._id;

            // Use the new user-level license assignment
            const licenseAssignment = await assignLicenseToUser(
              adminUserId,
              invitationResult._id,
              licenseCode
            );

            if (licenseAssignment.success) {
              seatsAssigned++;

              console.log(`✅ Successfully invited ${invite.email}, User ID: ${invitationResult._id}, License: ${licenseCode}`);

              results.success.push({
                email: invite.email,
                message: "Invitation sent successfully",
                userId: invitationResult._id,
                seatAssigned: true,
                licenseCode: licenseCode,
                licenseInstance: licenseAssignment.licenseInstance,
              });
            } else {
              console.warn(`⚠️ License assignment issue for ${invite.email}:`, licenseAssignment.message);
              // Still count as successful invitation if it's EXPLORE (trial)
              if (licenseCode === 'EXPLORE') {
                results.success.push({
                  email: invite.email,
                  message: "Invitation sent with trial license",
                  userId: invitationResult._id,
                  seatAssigned: true,
                  licenseCode: 'EXPLORE',
                });
              } else {
                results.success.push({
                  email: invite.email,
                  message: "Invitation sent but license assignment failed",
                  userId: invitationResult._id,
                  seatAssigned: false,
                  seatError: licenseAssignment.message,
                });
              }
            }
          } catch (licenseError) {
            console.error(`❌ Error assigning license to ${invite.email}:`, licenseError);
            // Still count as successful invitation, but note license assignment failure
            results.success.push({
              email: invite.email,
              message: "Invitation sent but license assignment failed",
              userId: invitationResult._id,
              seatAssigned: false,
              seatError: licenseError.message,
            });
          }
        } catch (error) {
          console.error(`❌ Error inviting ${invite.email}:`, error);
          results.errors.push({
            email: invite.email,
            error: error.message || "Failed to process invitation",
          });
        }
      }

      // ✅ LICENSE ASSIGNMENT COMPLETED
      // Note: License counts are now managed by LicenseInstance model automatically
      console.log(`\n📤 Final results: ${results.success.length} success, ${results.errors.length} errors`);
      console.log(`🔑 Successfully assigned ${seatsAssigned} license(s)`);

      res.json({
        message: "Invitations processed",
        results,
        seatsAssigned
      });
    } catch (error) {
      console.error("❌ Invite users error:", error);
      res
        .status(500)
        .json({ message: "Failed to process invitations", error: error.message });
    }
  }
);


// Export router and registration function
export function registerUserInvitationRoutes(app) {
  console.log('Registering user invitation routes');
  app.use('/api/organization', router);
}
