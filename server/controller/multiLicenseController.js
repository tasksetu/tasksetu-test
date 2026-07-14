import OrganizationLicensePurchase from '../modals/organizationLicensePurchaseModal.js';
import LicenseInstance from '../modals/licenseInstanceModal.js';
import { License } from '../modals/licenseModal.js';
import { User } from '../modals/userModal.js';
import { TransactionHistory } from '../modals/transactionHistoryModal.js';
import { Coupon } from '../modals/couponModal.js';
import { Invoice } from '../modals/invoiceModal.js';
import { BillingDetails } from '../modals/billingDetailsModal.js';
import { createRazorpayOrder, verifyRazorpaySignature, fetchPaymentDetails } from '../services/razorpayService.js';
import { emailService } from '../services/emailService.js';
import mongoose from 'mongoose';
import auditLogger from "../utils/auditLogger.js";
import { superAdminNotification } from '../utils/superAdminNotification.js';

/**
 * Create Razorpay order for license purchase
 * POST /api/organization/create-license-order
 * 
 * 🆕 Frontend Pre-calculates GST (18%) and discount before sending to payment gateway
 * Backend validates and uses frontend-calculated final amount
 */
export const createLicenseOrder = async (req, res) => {
  try {
    const {
      purchases,
      coupon_code,
      subtotal: frontendSubtotal,
      discount_amount: frontendDiscountAmount,
      before_gst_amount: frontendBeforeGSTAmount,
      gst_amount: frontendGSTAmount,
      gst_rate: frontendGSTRate,
      final_amount: frontendFinalAmount
    } = req.body;

    const organizationId = req.user.organizationId || req.user.organization_id;
    const userId = req.user?._id || req.user?.userId;

    if (!organizationId && !userId) {
      return res.status(400).json({
        success: false,
        message: 'User identification failed'
      });
    }

    if (!purchases || !Array.isArray(purchases) || purchases.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Purchase details are required'
      });
    }

    // 🚫 Block if user already has a pending downgrade scheduled (like mobile recharge - can't change pending plan)
    const isIndividualCheck = !organizationId;
    if (isIndividualCheck && userId) {
      const existingUser = await User.findById(userId).lean();
      if (existingUser?.pending_license?.license_code) {
        return res.status(400).json({
          success: false,
          message: `You already have a pending plan change to "${existingUser.pending_license.license_code}" scheduled for ${new Date(existingUser.pending_license.scheduled_start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}. The pending plan will activate automatically when your current plan expires.`,
          pending_license: existingUser.pending_license
        });
      }
    }

    // 🔄 BACKEND VALIDATION: Recalculate to verify frontend didn't tamper with amounts
    let backendSubtotal = 0;
    const purchaseDetails = [];
    let discountPercentage = 0;
    let appliedCoupon = null;

    // Validate coupon if provided
    if (coupon_code) {
      appliedCoupon = await Coupon.findOne({
        code: coupon_code.toUpperCase(),
        valid: true,
        expires_at: { $gt: new Date() }
      });

      if (appliedCoupon) {
        if (appliedCoupon.usage_limit === null || appliedCoupon.usage_count < appliedCoupon.usage_limit) {
          discountPercentage = appliedCoupon.discount;
        }
      }
    }

    // Calculate backend subtotal and validate licenses
    for (const purchase of purchases) {
      const { license_code, seats, billing_cycle = 'MONTHLY' } = purchase;

      const licensePlan = await License.findOne({
        license_code: license_code,
        is_active: true
      });

      if (!licensePlan) {
        return res.status(404).json({
          success: false,
          message: `License plan ${license_code} not found`
        });
      }

      // Check if coupon is applicable to this specific plan
      let planDiscount = discountPercentage;
      if (appliedCoupon && appliedCoupon.applicable_plans && appliedCoupon.applicable_plans.length > 0) {
        if (!appliedCoupon.applicable_plans.includes(license_code.toUpperCase())) {
          planDiscount = 0;
        }
      }

      const pricePerSeat = billing_cycle.toUpperCase() === 'MONTHLY'
        ? licensePlan.price_monthly
        : licensePlan.price_yearly;

      const lineTotal = pricePerSeat * seats;
      backendSubtotal += lineTotal;

      purchaseDetails.push({
        license_code,
        license_name: licensePlan.name,
        seats,
        billing_cycle: billing_cycle.toUpperCase(),
        price_per_seat: pricePerSeat,
        line_total: lineTotal,
        discount_percentage: planDiscount
      });
    }

    // Calculate upgrade discount for individual accounts
    let upgradeDiscount = 0;
    const isIndividual = !organizationId;
    let isDowngrade = false;
    let scheduledStartDate = null;
    let scheduledEndDate = null;
    let gracePeriodInfo = null;

    if (isIndividual) {
      const user = await User.findById(userId).populate('license_instance_id');
      if (user) {
        const currentLicenseCode = user.license_instance_id?.license_code || user.license_code;
        if (currentLicenseCode && currentLicenseCode !== 'EXPLORE' && currentLicenseCode !== 'EXPIRED') {
          const currentExpiry = user.license_instance_id?.renewal_date || user.license_expiry || user.subscription_end_date;
          const now = new Date();

          const targetLicenseCode = purchases[0]?.license_code;
          const targetBillingCycle = purchases[0]?.billing_cycle || 'MONTHLY';

          const LICENSE_HIERARCHY = ['EXPLORE', 'PLAN', 'EXECUTE', 'OPTIMIZE'];
          const currentLicenseIndex = LICENSE_HIERARCHY.indexOf(currentLicenseCode.toUpperCase());
          const targetLicenseIndex = LICENSE_HIERARCHY.indexOf(targetLicenseCode?.toUpperCase());

          // Determine if upgrade or downgrade
          let isUpgrade = false;
          if (targetLicenseIndex > currentLicenseIndex) {
            isUpgrade = true;
          } else if (targetLicenseIndex === currentLicenseIndex) {
            if ((user.license_instance_id?.billing_cycle || user.assigned_license?.billing_cycle || 'MONTHLY').toUpperCase() === 'MONTHLY' && targetBillingCycle.toUpperCase() === 'YEARLY') {
              isUpgrade = true;
            }
          } else if (targetLicenseIndex < currentLicenseIndex) {
            isDowngrade = true;
          }

          // Fetch current plan's grace period
          const currentPlan = await License.findOne({ license_code: currentLicenseCode });

          if (currentPlan) {
            const gracePeriodDays = currentPlan.grace_period_days || 0;

            // Grace period logic
            if (currentExpiry) {
              const expiryDate = new Date(currentExpiry);
              const gracePeriodEnd = new Date(expiryDate);
              gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriodDays);
              const isExpired = expiryDate <= now;
              const isInGracePeriod = isExpired && now <= gracePeriodEnd;
              const isAfterGracePeriod = now > gracePeriodEnd;

              gracePeriodInfo = {
                grace_period_days: gracePeriodDays,
                current_expiry: expiryDate,
                grace_period_end: gracePeriodEnd,
                is_expired: isExpired,
                is_in_grace_period: isInGracePeriod,
                is_after_grace_period: isAfterGracePeriod,
              };

              if (isDowngrade) {
                // DOWNGRADE: New plan starts after current plan expires
                // No upgrade discount for downgrades
                if (!isExpired) {
                  // Current plan is still active — schedule for after expiry
                  scheduledStartDate = new Date(expiryDate);
                } else if (isInGracePeriod) {
                  // Expired but in grace period — start from original expiry
                  scheduledStartDate = new Date(expiryDate);
                } else {
                  // After grace period — start immediately
                  scheduledStartDate = new Date(now);
                }
                // Calculate end date
                scheduledEndDate = new Date(scheduledStartDate);
                if (targetBillingCycle.toUpperCase() === 'YEARLY') {
                  scheduledEndDate.setFullYear(scheduledEndDate.getFullYear() + 1);
                } else {
                  scheduledEndDate.setDate(scheduledEndDate.getDate() + 30);
                }
              } else if (isUpgrade && isExpired && isInGracePeriod) {
                // UPGRADE during grace period: start immediately (from purchase date)
                scheduledStartDate = new Date(now);
                scheduledEndDate = new Date(scheduledStartDate);
                if (targetBillingCycle.toUpperCase() === 'YEARLY') {
                  scheduledEndDate.setFullYear(scheduledEndDate.getFullYear() + 1);
                } else {
                  scheduledEndDate.setDate(scheduledEndDate.getDate() + 30);
                }
              } else if (!isDowngrade && isExpired && isInGracePeriod) {
                // SAME PLAN renewal during grace period: start from original expiry date
                scheduledStartDate = new Date(expiryDate);
                scheduledEndDate = new Date(scheduledStartDate);
                if (targetBillingCycle.toUpperCase() === 'YEARLY') {
                  scheduledEndDate.setFullYear(scheduledEndDate.getFullYear() + 1);
                } else {
                  scheduledEndDate.setDate(scheduledEndDate.getDate() + 30);
                }
              }
            }

            // Only apply upgrade discount if it's an upgrade and current plan is active
            if (isUpgrade && currentExpiry && currentExpiry > now) {
              const currentBillingCycle = user.license_instance_id?.billing_cycle || user.assigned_license?.billing_cycle || 'MONTHLY';
              const price = currentBillingCycle.toUpperCase() === 'YEARLY' ? currentPlan.price_yearly : currentPlan.price_monthly;
              const totalDays = currentBillingCycle.toUpperCase() === 'YEARLY' ? 365 : 30;
              const remainingTimeMs = currentExpiry.getTime() - now.getTime();
              const remainingDays = remainingTimeMs / (1000 * 60 * 60 * 24);
              const unusedDays = Math.max(0, Math.min(totalDays, remainingDays));
              const unusedValue = (price / totalDays) * unusedDays;
              upgradeDiscount = Math.round(unusedValue * 100) / 100;
            }
          }
        }
      }
    }

    const adjustedSubtotal = Math.max(0, backendSubtotal - upgradeDiscount);

    // 📊 Backend calculation of discount and GST
    const backendDiscountAmount = Math.round((adjustedSubtotal * discountPercentage / 100) * 100) / 100;
    const backendBeforeGSTAmount = Math.round((adjustedSubtotal - backendDiscountAmount) * 100) / 100;
    const GST_RATE = 0.18;
    const backendGSTAmount = Math.round((backendBeforeGSTAmount * GST_RATE) * 100) / 100;
    const backendFinalAmount = Math.round((backendBeforeGSTAmount + backendGSTAmount) * 100) / 100;

    // ✅ VALIDATE: Backend calculations match frontend (with 1 paise tolerance for rounding)
    const tolerance = 1; // 1 paise tolerance
    if (Math.abs(backendFinalAmount * 100 - frontendFinalAmount * 100) > tolerance) {
      console.warn('⚠️ Amount mismatch detected');
      console.warn('Frontend:', { frontendSubtotal, frontendDiscountAmount, frontendGSTAmount, frontendFinalAmount });
      console.warn('Backend:', { backendSubtotal, adjustedSubtotal, upgradeDiscount, backendDiscountAmount, backendGSTAmount, backendFinalAmount });

      return res.status(400).json({
        success: false,
        message: 'Payment amount validation failed. Please try again.',
        details: {
          frontend: { final_amount: frontendFinalAmount },
          backend: { final_amount: backendFinalAmount }
        }
      });
    }

    // 💳 Use BACKEND-CALCULATED amount (not frontend) for Razorpay to prevent tampering
    const finalAmountForPayment = backendFinalAmount;

    // Create Razorpay order
    const identifier = organizationId || userId;
    const receipt = `LIC_${identifier.toString().slice(-8)}_${Date.now()}`;

    // ⚠️ Send in RUPEES - razorpayService will convert to paise internally
    const razorpayOrder = await createRazorpayOrder(
      finalAmountForPayment, // Send in rupees (not paise)
      receipt,
      {
        organization_id: organizationId ? organizationId.toString() : null,
        user_id: userId ? userId.toString() : null,
        is_individual: !organizationId,
        is_downgrade: isDowngrade,
        purchase_count: purchases.length,
        total_seats: purchases.reduce((sum, p) => sum + p.seats, 0),
        coupon_code: coupon_code || null,
        discount_percentage: discountPercentage,
        subtotal: backendSubtotal,
        upgrade_discount: upgradeDiscount,
        discount_amount: backendDiscountAmount,
        gst_amount: backendGSTAmount,
        final_amount: backendFinalAmount
      }
    );

    return res.status(200).json({
      success: true,
      data: {
        order_id: razorpayOrder.id,
        amount: razorpayOrder.amount, // Amount from Razorpay (already in paise)
        amount_display: finalAmountForPayment, // Amount for display (in rupees)
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt,
        purchase_details: purchaseDetails,
        razorpay_key: process.env.RAZORPAY_KEY_ID,
        is_downgrade: isDowngrade,
        scheduled_start_date: scheduledStartDate,
        scheduled_end_date: scheduledEndDate,
        grace_period_info: gracePeriodInfo,
        // 📊 Return breakdown for frontend to display
        billing_breakdown: {
          subtotal: backendSubtotal,
          upgrade_discount: upgradeDiscount,
          discount_percentage: discountPercentage,
          discount_amount: backendDiscountAmount,
          before_gst_amount: backendBeforeGSTAmount,
          gst_rate: GST_RATE,
          gst_amount: backendGSTAmount,
          final_amount: backendFinalAmount
        }
      }
    });

  } catch (error) {
    console.error('❌ Error creating license order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create payment order',
      error: error.message
    });
  }
};

/**
 * Verify payment and create license purchases
 * POST /api/organization/verify-license-payment
 * 
 * 🆕 NEW BEHAVIOR:
 * - Creates one OrganizationLicensePurchase per license type (billing container)
 * - Creates N LicenseInstance documents (where N = seats purchased)
 * - Each instance is atomic and independently assignable
 */
export const verifyLicensePayment = async (req, res) => {
  // 🔐 Start MongoDB transaction for atomicity
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      purchases,
      coupon_code
    } = req.body;
    const organizationId = req.user.organizationId || req.user.organization_id;
    const userId = req.user?._id || req.user?.userId;

    // Verify signature
    const isValid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed. Invalid signature.'
      });
    }

    // Fetch payment details from Razorpay
    const paymentDetails = await fetchPaymentDetails(razorpay_payment_id);

    if (paymentDetails.status !== 'captured') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Payment not captured yet'
      });
    }

    // 🆕 NEW: Create license purchases AND atomic license instances
    const createdPurchases = [];
    const createdInstances = [];
    const createdTransactions = [];

    // 💰 Get actual amount paid from Razorpay (in paisa, convert to rupees)
    const actualAmountPaid = paymentDetails.amount / 100; // Convert from paisa to rupees

    // Calculate upgrade discount for individual accounts BEFORE modifying anything
    let upgradeDiscount = 0;
    let isDowngradePurchase = false;
    let gracePeriodStartDate = null; // If non-null, start date is backdated (grace period scenario)

    if (!organizationId && userId) {
      const user = await User.findById(userId).populate('license_instance_id').session(session);
      if (user) {
        const currentLicenseCode = user.license_instance_id?.license_code || user.license_code;
        if (currentLicenseCode && currentLicenseCode !== 'EXPLORE' && currentLicenseCode !== 'EXPIRED') {
          const currentExpiry = user.license_instance_id?.renewal_date || user.license_expiry || user.subscription_end_date;
          const now = new Date();

          const targetLicenseCode = purchases[0]?.license_code;
          const targetBillingCycle = purchases[0]?.billing_cycle || 'MONTHLY';

          const LICENSE_HIERARCHY = ['EXPLORE', 'PLAN', 'EXECUTE', 'OPTIMIZE'];
          const currentLicenseIndex = LICENSE_HIERARCHY.indexOf(currentLicenseCode.toUpperCase());
          const targetLicenseIndex = LICENSE_HIERARCHY.indexOf(targetLicenseCode?.toUpperCase());

          // Determine if upgrade or downgrade
          let isUpgrade = false;
          if (targetLicenseIndex > currentLicenseIndex) {
            isUpgrade = true;
          } else if (targetLicenseIndex === currentLicenseIndex) {
            const currentBillingCycle = (user.license_instance_id?.billing_cycle || user.assigned_license?.billing_cycle || 'MONTHLY').toUpperCase();
            if (currentBillingCycle === 'MONTHLY' && targetBillingCycle.toUpperCase() === 'YEARLY') {
              isUpgrade = true;
            }
          } else if (targetLicenseIndex < currentLicenseIndex) {
            isDowngradePurchase = true;
          }

          // Fetch current plan for grace period
          const currentPlan = await License.findOne({ license_code: currentLicenseCode }).session(session);
          if (currentPlan && currentExpiry) {
            const gracePeriodDays = currentPlan.grace_period_days || 0;
            const expiryDate = new Date(currentExpiry);
            const gracePeriodEnd = new Date(expiryDate);
            gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriodDays);
            const isExpired = expiryDate <= now;
            const isInGracePeriod = isExpired && now <= gracePeriodEnd;

            // Grace period start date logic
            if (isDowngradePurchase) {
              // DOWNGRADE: start from current expiry if still active or in grace period
              if (!isExpired || isInGracePeriod) {
                gracePeriodStartDate = new Date(expiryDate);
              }
              // After grace period: gracePeriodStartDate stays null → starts from now
            } else if (!isUpgrade && !isDowngradePurchase && isExpired && isInGracePeriod) {
              // SAME plan renewal during grace period: start from original expiry
              gracePeriodStartDate = new Date(expiryDate);
            }

            // Only apply upgrade discount if it's an upgrade and current plan is ACTIVE (not expired)
            if (isUpgrade && currentExpiry > now) {
              const currentBillingCycle = (user.license_instance_id?.billing_cycle || user.assigned_license?.billing_cycle || 'MONTHLY').toUpperCase();
              const price = currentBillingCycle === 'YEARLY' ? currentPlan.price_yearly : currentPlan.price_monthly;
              const totalDays = currentBillingCycle === 'YEARLY' ? 365 : 30;
              const remainingTimeMs = currentExpiry.getTime() - now.getTime();
              const remainingDays = remainingTimeMs / (1000 * 60 * 60 * 24);
              const unusedDays = Math.max(0, Math.min(totalDays, remainingDays));
              const unusedValue = (price / totalDays) * unusedDays;
              upgradeDiscount = Math.round(unusedValue * 100) / 100;
            }
          }
        }
      }
    }

    // 📊 Collect plan info for SINGLE transaction record (not multiple)
    const allPlanNames = [];
    const allLicenseCodes = [];
    const allRenewalDates = [];
    let totalSeatsAcrossPlans = 0;
    let totalPriceAcrossPlans = 0; // Original total price before discount
    const purchaseItems = []; // ✅ Per-license items for invoice line items
    const purchaseDate = new Date();

    // Verification of coupon again for recording purposes
    let discountPercentage = 0;
    let appliedCoupon = null;

    if (coupon_code) {
      appliedCoupon = await Coupon.findOne({
        code: coupon_code.toUpperCase()
      });

      if (appliedCoupon && appliedCoupon.isValid()) {
        discountPercentage = appliedCoupon.discount;

        // Increment usage count - only increment if verification succeeds
        appliedCoupon.usage_count += 1;
        await appliedCoupon.save({ session });
      }
    }

    for (const purchase of purchases) {
      const { license_code, seats, billing_cycle = 'MONTHLY' } = purchase;

      const licensePlan = await License.findOne({
        license_code: license_code,
        is_active: true
      });

      if (!licensePlan) {
        console.error(`License plan ${license_code} not found during payment verification`);
        continue;
      }

      // ✅ SINGLE SOURCE OF TRUTH: Use license definition from database instead of hardcoded values
      const pricePerSeat = billing_cycle.toUpperCase() === 'MONTHLY'
        ? licensePlan.price_monthly
        : licensePlan.price_yearly;

      const planCode = licensePlan.license_code.toUpperCase();
      console.log(`📋 Payment Verification - ${planCode}:`);
      console.log(`   Billing: ${billing_cycle.toUpperCase()}`);
      console.log(`   Price per seat: ₹${pricePerSeat} (from DB)`);
      console.log(`   Seats: ${seats}`);
      console.log(`   💰 Actual Amount Paid (from Razorpay): ₹${actualAmountPaid}`);
      console.log(`   📌 Is Downgrade: ${isDowngradePurchase}`);
      console.log(`   📌 Grace Period Start Date: ${gracePeriodStartDate}`);

      const totalPrice = pricePerSeat * seats;

      // 📊 Collect info for combined transaction
      allPlanNames.push(licensePlan.name);
      allLicenseCodes.push(licensePlan.license_code);
      totalSeatsAcrossPlans += seats;
      totalPriceAcrossPlans += totalPrice;

      // ✅ Collect per-license item for invoice line items
      purchaseItems.push({
        license_code: licensePlan.license_code,
        license_name: licensePlan.name,
        seats_purchased: seats,
        billing_cycle: billing_cycle.toUpperCase(),
        price_per_seat: pricePerSeat,
        total_price: totalPrice,
      });

      // 🆕 Calculate baseDate considering downgrade and grace period
      let baseDate = new Date(purchaseDate);
      if (!organizationId && userId) {
        const currentUser = await User.findById(userId).session(session);

        if (isDowngradePurchase) {
          // DOWNGRADE: start from gracePeriodStartDate (current expiry) or now
          if (gracePeriodStartDate) {
            baseDate = new Date(gracePeriodStartDate);
          }
          // If no gracePeriodStartDate, baseDate stays as purchaseDate (after grace period)
        } else if (gracePeriodStartDate) {
          // UPGRADE/SAME during grace period: start from original expiry date
          baseDate = new Date(gracePeriodStartDate);
        } else if (
          currentUser &&
          currentUser.license_code === licensePlan.license_code &&
          currentUser.license_expiry &&
          currentUser.license_expiry > purchaseDate
        ) {
          // Same plan extension (active plan, not in grace period)
          baseDate = new Date(currentUser.license_expiry);
        }
      } else if (organizationId) {
        // Find if they are renewing/extending the same license code
        const latestPurchase = await OrganizationLicensePurchase.findOne({
          organization_id: organizationId,
          license_code: licensePlan.license_code,
          status: 'ACTIVE',
        })
        .sort({ renewal_date: -1 })
        .session(session);

        if (latestPurchase) {
          const expiryDate = new Date(latestPurchase.renewal_date);
          const gracePeriodDays = licensePlan.grace_period_days || 0;
          const gracePeriodEnd = new Date(expiryDate);
          gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriodDays);
          const isExpired = expiryDate <= purchaseDate;
          const isInGracePeriod = isExpired && purchaseDate <= gracePeriodEnd;

          if (!isExpired) {
            // Plan is still active (not expired)
            baseDate = new Date(expiryDate);
          } else if (isInGracePeriod) {
            // Same plan renewal during grace period: backdate to original expiry date
            baseDate = new Date(expiryDate);
            console.log(`⏳ Org SAME plan renewal during grace period: backdating start date to original expiry ${expiryDate.toISOString()}`);
          }
          // If expired and grace period is fully over: baseDate stays as purchaseDate
        }
      }

      const renewalDate = new Date(baseDate);
      if (billing_cycle.toUpperCase() === 'MONTHLY') {
        renewalDate.setDate(renewalDate.getDate() + 30); // Use exact 30 days to avoid month length variations
      } else {
        renewalDate.setFullYear(renewalDate.getFullYear() + 1);
      }
      allRenewalDates.push(renewalDate);

      // If individual user, update User model directly
      if (!organizationId && userId) {
        if (isDowngradePurchase && gracePeriodStartDate) {
          // 🆕 DOWNGRADE with active plan: Store as pending license (activates after current plan expires)
          console.log(`📌 Storing pending downgrade: ${licensePlan.license_code} starts ${baseDate.toISOString()}`);
          await User.findByIdAndUpdate(userId, {
            account_type: 'individual',
            pending_license: {
              license_code: licensePlan.license_code,
              billing_cycle: billing_cycle.toUpperCase(),
              scheduled_start_date: baseDate,
              scheduled_end_date: renewalDate,
              payment_id: razorpay_payment_id,
              is_downgrade: true,
              created_at: new Date()
            }
          }, { session });
        } else {
          // UPGRADE, SAME PLAN, or DOWNGRADE after grace period: Apply immediately
          await User.findByIdAndUpdate(userId, {
            license_code: licensePlan.license_code,
            account_type: 'individual',
            license_expiry: renewalDate,
            // Clear any existing pending license
            pending_license: {
              license_code: null,
              billing_cycle: null,
              scheduled_start_date: null,
              scheduled_end_date: null,
              payment_id: null,
              is_downgrade: false,
              created_at: null
            }
          }, { session });
        }
        continue;
      }

      // Create purchase record (billing container only) with transaction
      const [licensePurchase] = await OrganizationLicensePurchase.create([{
        organization_id: organizationId,
        license_id: licensePlan._id,
        license_code: licensePlan.license_code,
        license_name: licensePlan.name,
        seats_purchased: seats, // Keep for backward compatibility
        seats_used: 0, // Keep for backward compatibility
        billing_cycle: billing_cycle.toUpperCase(),
        price_per_seat: pricePerSeat,
        total_price: totalPrice,
        purchase_date: purchaseDate,
        renewal_date: renewalDate,
        status: 'ACTIVE',
        auto_renew: true,
        payment_info: {
          transaction_id: razorpay_payment_id,
          payment_method: paymentDetails.method || 'RAZORPAY',
          payment_status: 'COMPLETED',
          razorpay_order_id: razorpay_order_id,
          razorpay_payment_id: razorpay_payment_id
        }
      }], { session });

      createdPurchases.push(licensePurchase);

      // 🆕 NEW: Create N license instances (one per seat) with transaction
      const instances = await LicenseInstance.createInstancesForPurchase({
        organization_id: organizationId,
        license_code: licensePlan.license_code,
        purchase_id: licensePurchase._id,
        billing_cycle: billing_cycle.toUpperCase(),
        purchase_date: purchaseDate,
        renewal_date: renewalDate,
        quantity: seats,
        session // Pass session for transaction
      });

      createdInstances.push(...instances);
    }

    // 🆕 NEW: Create SINGLE transaction history record for ALL plans combined
    if (allPlanNames.length > 0) {
      const transaction_id = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const combinedPlanNames = allPlanNames.join(', '); // ✅ Plans comma-separated: "Execute, Plan"
      const primaryLicenseCode = allLicenseCodes[0]; // ✅ Use FIRST plan code for enum field
      const combinedLicenseCodesDisplay = allLicenseCodes.join(', '); // For display/logging only
      const firstRenewalDate = allRenewalDates[0] || new Date(); // Use first plan's renewal date
      // upgradeDiscount is calculated above before any database modifications

      const adjustedSubtotal = Math.max(0, totalPriceAcrossPlans - upgradeDiscount);
      // ✅ Calculate GST breakdown: subtotal → discount → before GST → 18% GST → final
      const GST_RATE = 0.18;
      const discount_amount = Math.round((adjustedSubtotal * discountPercentage / 100) * 100) / 100;
      const beforeGSTAmount = Math.round((adjustedSubtotal - discount_amount) * 100) / 100;
      const tax_amount = Math.round((beforeGSTAmount * GST_RATE) * 100) / 100; // 18% GST
      const final_amount = Math.round((beforeGSTAmount + tax_amount) * 100) / 100;
      const amount_paid = actualAmountPaid; // ✅ Actual amount paid from Razorpay

      // 🆕 NEW: Fetch or Create billing details before creating transaction/invoice
      let billingDetails = null;
      try {
        if (req.body.billing_detail_id) {
          billingDetails = await BillingDetails.findById(req.body.billing_detail_id).session(session);
        } else {
          // Fallback to default billing details for org/user
          const billingQuery = organizationId ? { organization_id: organizationId } : { user_id: userId };
          billingDetails = await BillingDetails.findOne({ ...billingQuery, is_default: true, is_active: true }).session(session);
        }

        // AUTO-CREATE Billing Details if none exist
        if (!billingDetails) {
          console.log('ℹ️ No billing details found, auto-creating default profile...');
          const user = await req.user;
          const isIndividual = !organizationId;
          const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Valued Customer';

          const [newDetails] = await BillingDetails.create([{
            organization_id: organizationId || null,
            user_id: userId,
            payment_method: 'OTHER',
            card_holder_name: fullName,
            billing_contact: {
              company_name: isIndividual ? 'Individual Account' : 'Organization',
              contact_name: fullName,
              contact_email: user.email,
              contact_phone: user.phone || ''
            },
            tax_info: {
              billing_address: 'Not Provided',
              city: '',
              state_province: '',
              postal_code: '',
              country: 'India',
              gst_number: null
            },
            is_default: true,
            is_active: true
          }], { session });
          billingDetails = newDetails;
          console.log(`✅ Auto-created billing details: ${billingDetails._id}`);
        }
      } catch (billingErr) {
        console.error('⚠️ [BILLING] Error handling billing details:', billingErr.message);
      }

      // 📝 DEBUG LOGGING
      console.log(`💰 Transaction Creation for Multiple Plans:`);
      console.log(`   Plans: ${combinedPlanNames}`);
      console.log(`   License Codes: ${combinedLicenseCodesDisplay}`);
      console.log(`   Total Seats: ${totalSeatsAcrossPlans}`);
      console.log(`   Total Price (original): ₹${totalPriceAcrossPlans}`);
      console.log(`   Upgrade Discount: ₹${upgradeDiscount}`);
      console.log(`   Coupon Discount: ₹${discount_amount} (${discountPercentage}%)`);
      console.log(`   Total Discount Applied: ₹${discount_amount + upgradeDiscount}`);
      console.log(`   ✅ Amount Actually Paid (from Razorpay): ₹${amount_paid}`);
      console.log(`   Transaction ID: ${transaction_id}`);

      const [transactionRecord] = await TransactionHistory.create([{
        transaction_id,
        organization_id: organizationId,
        user_id: userId,
        license_code: primaryLicenseCode, // ✅ Use FIRST plan code (valid enum)
        license_name: combinedPlanNames, // ✅ All names comma-separated: "Execute, Plan"
        seats_purchased: totalSeatsAcrossPlans,
        billing_cycle: 'MONTHLY', // Use MONTHLY for combined purchases
        price_per_seat: allLicenseCodes.length === 1 ? Math.round((totalPriceAcrossPlans / Math.max(totalSeatsAcrossPlans, 1)) * 100) / 100 : 0,
        total_price: totalPriceAcrossPlans,
        items: purchaseItems, // ✅ Per-license breakdown for invoice PDF
        discount_applied: discountPercentage > 0 || upgradeDiscount > 0,
        discount_amount: discount_amount + upgradeDiscount,
        discount_code: appliedCoupon ? appliedCoupon.code : null, // Record the applied coupon code
        final_amount: beforeGSTAmount,
        tax_amount: tax_amount, // 18% GST on (subtotal - discount)
        tax_percentage: 18,
        amount_paid,
        payment_method: 'RAZORPAY',
        razorpay_payment_id: razorpay_payment_id,
        razorpay_order_id: razorpay_order_id,
        status: 'COMPLETED',
        transaction_date: purchaseDate,
        payment_completed_at: new Date(),
        renewal_date: firstRenewalDate, // ✅ Use first plan's renewal date
        currency: 'INR',
        ip_address: req.ip || req.connection.remoteAddress,
        user_agent: req.headers['user-agent'],
        billing_detail_id: billingDetails?._id || req.body.billing_detail_id || null, // ✅ Store selected/created billing detail
        metadata: {
          all_license_codes: combinedLicenseCodesDisplay, // Store all codes for reference
          all_plans: combinedPlanNames,
          billing_detail_id: billingDetails?._id || null,
          coupon_code: coupon_code || null,
          upgrade_discount: upgradeDiscount,
          original_subtotal: totalPriceAcrossPlans
        }
      }], { session });

      createdTransactions.push(transactionRecord);
      console.log(`✅ Created SINGLE transaction: ${transaction_id} for ${allPlanNames.length} plans`);

      // 🆕 NEW: Create formal Invoice record for Billing History
      try {
        const invoiceData = {
          invoice_number: `INV-${Date.now()}-${Math.floor(1000 + Math.random() * 9000).toString()}`,
          organization_id: organizationId || null,
          user_id: userId,
          account_type: organizationId ? 'company' : 'individual',
          license_code: primaryLicenseCode,
          billing_cycle: 'MONTHLY', // Default to monthly for combined
          billing_period_start: purchaseDate,
          billing_period_end: firstRenewalDate,
          subtotal: totalPriceAcrossPlans,
          discount_amount: discount_amount + upgradeDiscount,
          discount_code: appliedCoupon ? appliedCoupon.code : null,
          discount_percentage: discountPercentage,
          tax_amount: tax_amount, // 18% GST amount
          tax_percentage: 18,
          total_amount: final_amount,
          payment_status: 'paid',
          payment_method: 'RAZORPAY',
          payment_gateway: 'razorpay',
          transaction_id: transaction_id,
          gateway_order_id: razorpay_order_id,
          gateway_payment_id: razorpay_payment_id,
          payment_date: purchaseDate,
          seats_purchased: totalSeatsAcrossPlans,
          price_per_seat: totalSeatsAcrossPlans > 0 ? (totalPriceAcrossPlans / totalSeatsAcrossPlans) : 0,
          billing_name: billingDetails?.card_holder_name || `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || 'Valued Customer',
          billing_email: billingDetails?.billing_contact?.contact_email || req.user.email,
          billing_address: billingDetails?.tax_info?.billing_address || 'Not Provided',
          billing_gstin: billingDetails?.tax_info?.gst_number || null,
          invoice_type: 'subscription'
        };

        await Invoice.create([invoiceData], { session });
        console.log(`📜 Created Invoice for transaction: ${transaction_id}`);
      } catch (invoiceErr) {
        console.error('❌ Failed to create Invoice record:', invoiceErr.message);
        // We don't abort the whole transaction for invoice creation failure
        // as the payment and license assignment are more critical
      }
    }

    console.log(`✅ Created ${createdInstances.length} total license instances`);
    console.log(`✅ Created ${createdPurchases.length} purchase records`);
    for (const inst of createdInstances) {
      console.log(`✅ Created instance for ${inst.license_code}`);
    }

    // 🔐 Commit transaction - all or nothing
    await session.commitTransaction();
    console.log('✅ Transaction committed successfully');

    // 📧 Send invoice email to user (async, don't wait)
    if (createdTransactions.length > 0 && req.user.email) {
      const transactionData = createdTransactions[0].toObject ? createdTransactions[0].toObject() : createdTransactions[0];
      const userData = {
        firstName: req.user.firstName || 'User',
        lastName: req.user.lastName || ''
      };

      // Send email asynchronously (don't block response)
      setImmediate(() => {
        emailService.sendPaymentInvoice(req.user.email, transactionData, userData)
          .catch(err => console.error('📧 Error sending invoice email:', err.message));
      });

      console.log(`📧 Invoice email queued for: ${req.user.email}`);
    }

    return res.status(201).json({
      success: true,
      message: `Successfully purchased ${createdPurchases.length} license plan(s) with ${createdInstances.length} total licenses`,
      data: {
        purchases: createdPurchases,
        license_instances_created: createdInstances.length,
        transactions_created: createdTransactions.length,
        payment_id: razorpay_payment_id,
        order_id: razorpay_order_id
      }
    });

  } catch (error) {
    // 🔐 Rollback transaction on error
    await session.abortTransaction();
    console.error('❌ Transaction aborted due to error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error.message
    });
  } finally {
    // 🔐 End session
    session.endSession();
  }
};

/**
 * Purchase a new license plan (legacy - for backward compatibility)
 * POST /api/organization/purchase-plan
 */
export const purchaseLicensePlan = async (req, res) => {
  try {
    const { license_code, seats, billing_cycle = 'MONTHLY' } = req.body;
    const organizationId = req.user.organizationId || req.user.organization_id;

    console.log('Purchase request - User:', req.user);
    console.log('Purchase request - Organization ID:', organizationId);

    // Validation
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID not found. Please ensure you are part of an organization.'
      });
    }

    if (!license_code || !seats) {
      return res.status(400).json({
        success: false,
        message: 'License code and number of seats are required'
      });
    }

    if (seats < 1) {
      return res.status(400).json({
        success: false,
        message: 'Number of seats must be at least 1'
      });
    }

    if (!['MONTHLY', 'YEARLY'].includes(billing_cycle.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid billing cycle. Must be MONTHLY or YEARLY'
      });
    }

    // Find the license plan
    const licensePlan = await License.findOne({
      license_code: license_code,
      is_active: true
    });

    if (!licensePlan) {
      return res.status(404).json({
        success: false,
        message: 'License plan not found'
      });
    }

    console.log('Found license plan:', {
      id: licensePlan._id,
      code: licensePlan.license_code,
      name: licensePlan.name
    });

    // ✅ SINGLE SOURCE OF TRUTH: Use database values
    const pricing = {
      monthly: licensePlan.price_monthly,
      yearly: licensePlan.price_yearly
    };

    const planCode = licensePlan.license_code.toUpperCase();

    if (!pricing) {
      console.error(`❌ Unknown plan code: ${planCode}`);
      return res.status(400).json({
        success: false,
        message: `Unknown plan code: ${planCode}`
      });
    }

    const pricePerSeat = billing_cycle.toUpperCase() === 'MONTHLY'
      ? pricing.monthly
      : pricing.yearly;

    console.log(`📋 License Purchase - ${planCode}:`);
    console.log(`   Billing: ${billing_cycle.toUpperCase()}`);
    console.log(`   Price per seat: ₹${pricePerSeat}`);
    console.log(`   Seats: ${seats}`);

    const totalPrice = pricePerSeat * seats;

    // Calculate renewal date
    const purchaseDate = new Date();
    let baseDate = new Date(purchaseDate);

    const latestActivePurchase = await OrganizationLicensePurchase.findOne({
      organization_id: organizationId,
      license_code: licensePlan.license_code,
      status: 'ACTIVE',
      renewal_date: { $gt: purchaseDate }
    }).sort({ renewal_date: -1 });

    if (latestActivePurchase) {
      baseDate = new Date(latestActivePurchase.renewal_date);
    }

    const renewalDate = new Date(baseDate);
    if (billing_cycle.toUpperCase() === 'MONTHLY') {
      renewalDate.setDate(renewalDate.getDate() + 30); // Use 30 days logic consistently
    } else {
      renewalDate.setFullYear(renewalDate.getFullYear() + 1);
    }

    console.log('Creating purchase with data:', {
      organization_id: organizationId,
      license_id: licensePlan._id,
      license_code: licensePlan.license_code,
      license_name: licensePlan.name,
      seats_purchased: seats
    });

    // Create the purchase record
    const purchase = await OrganizationLicensePurchase.create({
      organization_id: organizationId,
      license_id: licensePlan._id,
      license_code: licensePlan.license_code,
      license_name: licensePlan.name,
      seats_purchased: seats,
      seats_used: 0,
      billing_cycle: billing_cycle.toUpperCase(),
      price_per_seat: pricePerSeat,
      total_price: totalPrice,
      purchase_date: purchaseDate,
      renewal_date: renewalDate,
      status: 'ACTIVE',
      auto_renew: true,
      payment_info: {
        transaction_id: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        payment_method: 'CARD', // This would come from payment gateway
        payment_status: 'COMPLETED'
      }
    });

    console.log('Purchase created successfully:', purchase._id);

    // 📜 Log Audit Entry
    try {
      await auditLogger.logLicensePurchase(purchase, req.user, req);
    } catch (auditError) {
      console.error('⚠️ [AUDIT] Error logging license purchase:', auditError.message);
    }

    // 🔔 Notify super admins about package purchase
    try {
      const organization = await mongoose.model('Organization').findById(organizationId);
      await superAdminNotification.notifyPackagePurchase({
        organizationName: organization?.name || 'Unknown Organization',
        packageName: purchase.license_name,
        seats: purchase.seats_purchased,
        billingCycle: purchase.billing_cycle,
        amount: purchase.total_price,
        transactionId: purchase.payment_info?.transaction_id || 'N/A'
      });
    } catch (notifyError) {
      console.error('⚠️ Failed to notify super admins about package purchase:', notifyError);
      // Don't fail the purchase if notification fails
    }

    return res.status(201).json({
      success: true,
      message: `Successfully purchased ${seats} seat(s) of ${licensePlan.name}`,
      data: {
        purchase_id: purchase._id,
        license_code: purchase.license_code,
        license_name: purchase.license_name,
        seats_purchased: purchase.seats_purchased,
        billing_cycle: purchase.billing_cycle,
        total_price: purchase.total_price,
        renewal_date: purchase.renewal_date
      }
    });

  } catch (error) {
    console.error('Error purchasing license plan:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to purchase license plan',
      error: error.message
    });
  }
};

/**
 * Get organization's multi-license subscriptions
 * GET /api/organization/multi-subscriptions
 */
export const getMultiSubscriptions = async (req, res) => {
  try {
    const organizationId = req.user.organizationId || req.user.organization_id;
    console.log('🔍 BACKEND API: getMultiSubscriptions called for org:', organizationId);

    // 1. Get all active license instances (AVAILABLE or ASSIGNED) for this organization
    const activeInstances = await LicenseInstance.find({
      organization_id: new mongoose.Types.ObjectId(organizationId),
      status: { $in: ['AVAILABLE', 'ASSIGNED'] }
    });

    if (activeInstances.length === 0) {
      console.log('📦 BACKEND API: No active license instances found.');
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    // 2. Extract unique active purchase IDs
    const activePurchaseIds = [...new Set(activeInstances.map(inst => inst.purchase_id?.toString()).filter(Boolean))];

    // 3. Fetch corresponding active purchases
    const purchases = await OrganizationLicensePurchase.find({
      _id: { $in: activePurchaseIds.map(id => new mongoose.Types.ObjectId(id)) },
      status: 'ACTIVE'
    }).sort({ license_code: 1, purchase_date: 1 });

    console.log('📦 BACKEND API: Found active purchases based on instances:', purchases.map(p => ({
      license_code: p.license_code,
      seats_purchased: p.seats_purchased,
      seats_used: p.seats_used
    })));

    // Group manually based on the fetched purchases and their active instances
    const groupedData = {};
    purchases.forEach(purchase => {
      const code = purchase.license_code;
      
      // Count instances for this specific purchase
      const purchaseInstances = activeInstances.filter(inst => inst.purchase_id?.toString() === purchase._id.toString());
      const seatsPurchased = purchaseInstances.length;
      const seatsUsed = purchaseInstances.filter(inst => inst.status === 'ASSIGNED').length;

      if (seatsPurchased === 0) return; // Skip if no active instances for this purchase

      if (!groupedData[code]) {
        groupedData[code] = {
          license_code: code,
          license_name: purchase.license_name,
          seats_purchased: 0,
          seats_used: 0,
          purchases: []
        };
      }

      groupedData[code].seats_purchased += seatsPurchased;
      groupedData[code].seats_used += seatsUsed;
      groupedData[code].purchases.push({
        purchase_id: purchase._id,
        seats_purchased: seatsPurchased,
        seats_used: seatsUsed,
        billing_cycle: purchase.billing_cycle,
        price_per_seat: purchase.price_per_seat,
        total_price: purchase.total_price,
        purchase_date: purchase.purchase_date,
        renewal_date: purchase.renewal_date,
        auto_renew: purchase.auto_renew
      });
    });

    // Convert to array and add seats_available
    const subscriptions = Object.values(groupedData).map(item => ({
      ...item,
      seats_available: item.seats_purchased - item.seats_used
    })).sort((a, b) => a.license_code.localeCompare(b.license_code));

    console.log('📦 BACKEND API: Final subscriptions data:', JSON.stringify(subscriptions, null, 2));

    return res.status(200).json({
      success: true,
      data: subscriptions
    });

  } catch (error) {
    console.error('Error fetching multi-subscriptions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch subscriptions',
      error: error.message
    });
  }
};

/**
 * Get organization's license pool (available licenses)
 * GET /api/organization/license-pool
 * 
 * 🆕 NEW BEHAVIOR:
 * - Returns REAL inventory from LicenseInstance collection
 * - Shows actual assigned/available counts per license type
 * - No fake data - direct from atomic instances
 */
export const getLicensePool = async (req, res) => {
  try {
    const organizationId = req.user.organizationId || req.user.organization_id;

    console.log('🔍 getLicensePool called for org:', organizationId);

    // 🆕 NEW: Get real license pool from LicenseInstance
    const poolSummary = await LicenseInstance.getPoolSummary(organizationId);
    console.log('📦 Real license pool:', poolSummary);

    // Get all available license plans for display
    const allLicenses = await License.find({ is_active: true }).sort({ license_code: 1 });
    console.log('📋 All available license types:', allLicenses.map(l => l.license_code));

    // Create a map of purchased licenses
    const purchasedMap = {};
    poolSummary.forEach(item => {
      purchasedMap[item.license_code] = item;
    });

    // Build complete pool including non-purchased licenses (show as 0/0/0)
    const completePool = allLicenses.map(license => {
      const purchased = purchasedMap[license.license_code];

      if (purchased) {
        // License has been purchased - show real counts
        return {
          license_code: license.license_code,
          license_name: license.name,
          total: purchased.total,
          assigned: purchased.assigned,
          available: purchased.available,
          expired: purchased.expired || 0,
          total_seats_purchased: purchased.total,
          total_seats_used: purchased.assigned,
          total_seats_available: purchased.available,
          total_seats_expired: purchased.expired || 0,
          // Additional license details
          features_summary: license.features_summary,
          max_users: license.max_users,
          max_tasks: license.max_tasks,
          max_projects: license.max_projects,
          price_monthly: license.price_monthly,
          price_yearly: license.price_yearly
        };
      } else {
        // License not purchased yet - show 0/0/0
        return {
          license_code: license.license_code,
          license_name: license.name,
          total: 0,
          assigned: 0,
          available: 0,
          expired: 0,
          total_seats_purchased: 0,
          total_seats_used: 0,
          total_seats_available: 0,
          total_seats_expired: 0,
          // Additional license details
          features_summary: license.features_summary,
          max_users: license.max_users,
          max_tasks: license.max_tasks,
          max_projects: license.max_projects,
          price_monthly: license.price_monthly,
          price_yearly: license.price_yearly
        };
      }
    });

    console.log('✅ Complete pool response:', completePool.map(p =>
      `${p.license_name}: ${p.assigned}/${p.total} (${p.available} available, ${p.expired} expired)`
    ));

    return res.status(200).json({
      success: true,
      data: completePool
    });

  } catch (error) {
    console.error('Error fetching license pool:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch license pool',
      error: error.message
    });
  }
};

/**
 * Assign a license to a user
 * POST /api/organization/assign-license
 * 
 * 🆕 NEW BEHAVIOR:
 * - Finds first AVAILABLE LicenseInstance of requested type
 * - Atomically assigns it to user
 * - No race conditions possible
 */
export const assignLicenseToUser = async (req, res) => {
  try {
    const { user_id, license_code } = req.body;
    const organizationId = req.user.organizationId || req.user.organization_id;

    // Validation
    if (!user_id || !license_code) {
      return res.status(400).json({
        success: false,
        message: 'User ID and license code are required'
      });
    }

    // Check if user exists and belongs to organization
    const user = await User.findOne({
      _id: user_id,
      organization_id: organizationId
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found in this organization'
      });
    }

    // Check if user already has a license assigned
    if (user.license_instance_id) {
      // Get current license info
      const currentInstance = await LicenseInstance.findById(user.license_instance_id);
      return res.status(400).json({
        success: false,
        message: `User already has a ${currentInstance?.license_code || 'license'} assigned. Please unassign first.`
      });
    }

    // 🆕 NEW: Find first available license instance
    const availableInstance = await LicenseInstance.findAvailableInstance(
      organizationId,
      license_code
    );

    if (!availableInstance) {
      // 🆕 PRIMARY ADMIN SPECIAL HANDLING:
      // Primary admin can assign any license to themselves even if no pool licenses are available
      const isPrimaryAdmin = user.isPrimaryAdmin === true;

      if (isPrimaryAdmin) {
        console.log(`🔑 Primary Admin bypass: Assigning ${license_code} without pool instance`);

        // Update user with the license directly (no pool instance required for primary admin)
        user.assigned_license = {
          license_code: license_code,
          purchase_id: null, // Primary admin privilege - no pool instance
          assigned_date: new Date(),
        };
        user.license_code = license_code;
        user.seat_assigned = true;
        await user.save({ validateBeforeSave: false });

        // Audit log for license assignment (Primary Admin bypass)
        await auditLogger.logLicenseAssignment(user, license_code, req.user, req);

        console.log(`✅ Primary Admin: Assigned ${license_code} directly to user ${user._id}`);

        return res.status(200).json({
          success: true,
          message: `${license_code} license assigned to ${user.firstName} ${user.lastName} successfully (Primary Admin privilege)`,
          data: {
            user_id: user._id,
            user_email: user.email,
            license_code: license_code,
            license_instance_id: null,
            assigned_at: new Date(),
            primary_admin_bypass: true
          }
        });
      }

      return res.status(400).json({
        success: false,
        message: `No available ${license_code} licenses in the pool. Please purchase more licenses.`
      });
    }

    // 🆕 NEW: Atomically assign instance to user
    await availableInstance.assignToUser(user._id);

    // Update user with license_instance_id
    user.license_instance_id = availableInstance._id;
    await user.save({ validateBeforeSave: false });

    // Audit log for license assignment
    await auditLogger.logLicenseAssignment(user, license_code, req.user, req);

    // Get remaining count
    const remainingCount = await LicenseInstance.countAvailable(organizationId, license_code);

    return res.status(200).json({
      success: true,
      message: `${license_code} license assigned to ${user.firstName} ${user.lastName} successfully`,
      data: {
        user_id: user._id,
        user_email: user.email,
        license_code: license_code,
        license_instance_id: availableInstance._id,
        assigned_at: availableInstance.assigned_at,
        renewal_date: availableInstance.renewal_date,
        available_licenses_remaining: remainingCount
      }
    });

  } catch (error) {
    console.error('Error assigning license:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to assign license',
      error: error.message
    });
  }
};

/**
 * Unassign a license from a user
 * POST /api/organization/unassign-license
 * 
 * 🆕 NEW BEHAVIOR:
 * - Finds user's assigned LicenseInstance
 * - Releases it back to AVAILABLE pool
 * - Atomic and clean
 */
export const unassignLicenseFromUser = async (req, res) => {
  try {
    const { user_id } = req.body;
    const organizationId = req.user.organizationId || req.user.organization_id;

    // Find user
    const user = await User.findOne({
      _id: user_id,
      organization_id: organizationId
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found in this organization'
      });
    }

    if (!user.license_instance_id) {
      return res.status(400).json({
        success: false,
        message: 'User does not have a license assigned'
      });
    }

    // 🆕 NEW: Find and release the license instance
    const instance = await LicenseInstance.findById(user.license_instance_id);

    if (!instance) {
      // Orphaned reference - clean it up
      user.license_instance_id = null;
      await user.save({ validateBeforeSave: false });

      return res.status(400).json({
        success: false,
        message: 'License instance not found (orphaned reference cleaned up)'
      });
    }

    const previousLicenseCode = instance.license_code;

    // Release instance back to pool
    await instance.releaseFromUser();

    // Remove reference from user
    user.license_instance_id = null;
    await user.save({ validateBeforeSave: false });

    // 📜 Log Audit Entry
    try {
      await auditLogger.logLicenseUnassignment(user, previousLicenseCode, req.user, req);
    } catch (auditError) {
      console.error('⚠️ [AUDIT] Error logging license unassignment:', auditError.message);
    }

    // Get updated availability
    const availableCount = await LicenseInstance.countAvailable(
      organizationId,
      previousLicenseCode
    );

    return res.status(200).json({
      success: true,
      message: `${previousLicenseCode} license unassigned from ${user.firstName} ${user.lastName} successfully`,
      data: {
        user_id: user._id,
        user_email: user.email,
        previous_license: previousLicenseCode,
        released_at: instance.released_at,
        available_licenses_now: availableCount
      }
    });

  } catch (error) {
    console.error('Error unassigning license:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to unassign license',
      error: error.message
    });
  }
};

/**
 * Get all purchases for the organization
 * GET /api/organization/license-purchases
 */
export const getLicensePurchases = async (req, res) => {
  try {
    const organizationId = req.user.organizationId || req.user.organization_id;

    const purchases = await OrganizationLicensePurchase.find({
      organization_id: organizationId
    })
      .sort({ purchase_date: -1 })
      .select('-payment_info.transaction_id'); // Hide sensitive payment info

    return res.status(200).json({
      success: true,
      data: purchases
    });

  } catch (error) {
    console.error('Error fetching license purchases:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch license purchases',
      error: error.message
    });
  }
};

/**
 * Cancel a specific purchase (mark as cancelled)
 * POST /api/organization/cancel-purchase/:purchaseId
 */
export const cancelPurchase = async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const organizationId = req.user.organizationId || req.user.organization_id;

    const purchase = await OrganizationLicensePurchase.findOne({
      _id: purchaseId,
      organization_id: organizationId
    });

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found'
      });
    }

    if (purchase.seats_used > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel purchase with ${purchase.seats_used} seats in use. Please unassign users first.`
      });
    }

    purchase.status = 'CANCELLED';
    purchase.auto_renew = false;
    await purchase.save();

    return res.status(200).json({
      success: true,
      message: 'Purchase cancelled successfully',
      data: {
        purchase_id: purchase._id,
        license_code: purchase.license_code,
        status: purchase.status
      }
    });

  } catch (error) {
    console.error('Error cancelling purchase:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel purchase',
      error: error.message
    });
  }
};

