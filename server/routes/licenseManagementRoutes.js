import express from 'express';
import { authenticateToken } from '../middleware/roleAuth.js';
import { requireSuperAdmin } from '../middleware/superAdminAuth.js';
import { Organization } from '../modals/organizationModal.js';
import { User } from '../modals/userModal.js';
import { OrganizationSubscription } from '../modals/organizationSubscriptionModal.js';
import { License } from '../modals/licenseModal.js';
import { Invoice } from '../modals/invoiceModal.js';
import { TransactionHistory } from '../modals/transactionHistoryModal.js';
import TimezoneHelper from '../utils/timezoneHelper.js';

// Helper for admin CSV date formatting (super-admin context, use Asia/Kolkata)
const formatAdminDate = (date) => {
  if (!date) return '';
  return TimezoneHelper.formatInTimezone(new Date(date), 'Asia/Kolkata');
};

const router = express.Router();

/**
 * GET /api/super-admin/licenses
 * Fetch all organization licenses with user assignments
 */
router.get('/licenses', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    console.log('📊 [License Management] Fetching all licenses...');

    // Fetch all organizations with their subscriptions
    const organizations = await Organization.find()
      .select('name createdAt status')
      .lean();

    console.log(`📊 [License Management] Found ${organizations.length} organizations`);

    // Enrich organizations with subscription and user data
    const enrichedOrgs = await Promise.all(
      organizations.map(async (org) => {
        // Get subscription for this organization
        const subscription = await OrganizationSubscription.findOne({
          organization_id: org._id
        }).lean();

        console.log(`  Org: ${org.name} - Subscription: ${subscription ? '✅ Found' : '❌ Not Found'}`);

        // Get license plan details if subscription exists
        let licenseDetails = null;
        if (subscription) {
          const licensePlan = await License.findOne({
            license_code: subscription.license_code
          }).lean();

          console.log(`    License Plan (${subscription.license_code}):`, licensePlan ? {
            name: licensePlan.name,
            price_monthly: licensePlan.price_monthly
          } : '❌ Not Found');

          // Calculate end date if not set (1 year from start for active subscriptions)
          let endDate = subscription.subscription_end_date || subscription.trial_end_date;
          if (!endDate && subscription.subscription_start_date) {
            // If no end date, calculate 1 year from start date
            const startDate = new Date(subscription.subscription_start_date);
            endDate = new Date(startDate);
            endDate.setFullYear(endDate.getFullYear() + 1);
          }

          licenseDetails = {
            planName: licensePlan?.name || subscription.license_code || 'No Plan',
            planType: subscription.status === 'TRIAL' ? 'trial' : 'paid',
            status: subscription.status?.toLowerCase() || 'inactive',
            startDate: subscription.subscription_start_date || subscription.trial_start_date,
            endDate: endDate,
            seats: subscription.seats_purchased || subscription.seats_total || 0,
            seatsUsed: subscription.seats_used || subscription.seats_occupied || 0,
            price: licensePlan?.price_monthly || 0,
            billingCycle: subscription.billing_cycle?.toLowerCase() || 'monthly'
          };

          console.log(`    License Details:`, licenseDetails);
        }

        // Get users for this organization
        const users = await User.find({
          organization_id: org._id
        })
          .select('firstName lastName username email role isActive createdAt license_code license_assigned_date')
          .lean();

        const formattedUsers = users.map(user => ({
          _id: user._id,
          name: user.username || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          licenseType: user.license_code || licenseDetails?.planName || 'No License',
          licenseAssignedDate: user.license_assigned_date || user.createdAt
        }));

        return {
          _id: org._id,
          id: org._id,
          name: org.name,
          status: org.status,
          license: licenseDetails,
          users: formattedUsers
        };
      })
    );

    // 👤 Fetch Individual Users (users not belonging to any organization AND having "individual" role)
    console.log('👤 [License Management] Fetching individual users...');
    const individualUsers = await User.find({
      $or: [
        { organization_id: { $exists: false } },
        { organization_id: null }
      ],
      role: 'individual' // Match users with "individual" in their roles array
    })
      .select('firstName lastName username email role isActive createdAt license_code license_assigned_date license_instance_id license_expiry')
      .populate({
        path: 'license_instance_id',
        select: 'license_code status renewal_date billing_cycle'
      })
      .lean();

    console.log(`👤 [License Management] Found ${individualUsers.length} individual users`);

    const formattedIndividualUsers = individualUsers.map(user => {
      const instance = user.license_instance_id;
      return {
        _id: user._id,
        name: user.username || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        license: instance ? {
          planName: instance.license_code,
          status: instance.status.toLowerCase(),
          endDate: instance.renewal_date,
          billingCycle: instance.billing_cycle.toLowerCase()
        } : (user.license_code ? {
          planName: user.license_code,
          status: 'active',
          endDate: user.license_expiry,
          billingCycle: 'unknown'
        } : null)
      };
    });

    // Calculate summary statistics
    const activeOrgSubscriptions = await OrganizationSubscription.find({
      status: { $in: ['ACTIVE', 'TRIAL'] }
    });

    // Count active individual users with valid license instances
    const activeIndividualLicenses = individualUsers.filter(u =>
      u.license_instance_id && u.license_instance_id.status === 'ASSIGNED'
    ).length;

    const totalUsers = enrichedOrgs.reduce((sum, org) => sum + org.users.length, 0) + individualUsers.length;

    // Calculate REAL monthly revenue
    let monthlyRevenue = 0;

    // 1. Revenue from Organizations
    for (const sub of activeOrgSubscriptions) {
      const license = await License.findOne({ license_code: sub.license_code });
      if (!license) continue;

      const seats = sub.seats_purchased || 0;
      if (sub.billing_cycle === 'MONTHLY') {
        monthlyRevenue += (license.price_monthly || 0) * seats;
      } else if (sub.billing_cycle === 'YEARLY') {
        monthlyRevenue += ((license.price_yearly || 0) * seats) / 12;
      }
    }

    // 2. Revenue from Individuals (using their license instances)
    for (const user of individualUsers) {
      if (user.license_instance_id && user.license_instance_id.status === 'ASSIGNED') {
        const license = await License.findOne({ license_code: user.license_instance_id.license_code });
        if (!license) continue;

        if (user.license_instance_id.billing_cycle === 'MONTHLY') {
          monthlyRevenue += license.price_monthly || 0;
        } else if (user.license_instance_id.billing_cycle === 'YEARLY') {
          monthlyRevenue += (license.price_yearly || 0) / 12;
        }
      }
    }

    const summary = {
      totalOrganizations: organizations.length,
      activeLicenses: activeOrgSubscriptions.length + activeIndividualLicenses,
      totalUsers,
      monthlyRevenue: Math.round(monthlyRevenue)
    };

    console.log('📊 [License Management] Summary:', summary);
    console.log('✅ [License Management] Data sent successfully');

    res.json({
      organizations: enrichedOrgs,
      individuals: formattedIndividualUsers,
      summary
    });

  } catch (error) {
    console.error('❌ [License Management] Error fetching licenses:', error);
    res.status(500).json({
      error: 'Failed to fetch license data',
      details: error.message
    });
  }
});

/**
 * GET /api/super-admin/payment-history/:id
 * Fetch payment history for a specific organization or individual user
 */
router.get('/payment-history/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`💳 [Payment History] Fetching for entity: ${id}`);

    // Fetch transactions where organization_id matches OR user_id matches
    const realTransactions = await TransactionHistory.find({
      $or: [
        { organization_id: id },
        { user_id: id }
      ]
    })
      .populate('user_id', 'username email firstName lastName')
      .sort({ transaction_date: -1 })
      .limit(50)
      .lean();

    console.log(`💳 [Payment History] Found ${realTransactions.length} real transactions in TransactionHistory`);

    if (realTransactions && realTransactions.length > 0) {
      // Return real transactions - using exact schema field names
      const payments = realTransactions.map((txn) => {
        // Format payment method for display
        let paymentMethod = 'Razorpay';
        if (txn.payment_method) {
          switch (txn.payment_method.toUpperCase()) {
            case 'RAZORPAY': paymentMethod = 'Razorpay'; break;
            case 'STRIPE': paymentMethod = 'Stripe'; break;
            case 'PAYPAL': paymentMethod = 'PayPal'; break;
            case 'UPI': paymentMethod = 'UPI'; break;
            case 'BANK_TRANSFER': paymentMethod = 'Bank Transfer'; break;
            case 'MANUAL': paymentMethod = 'Manual'; break;
            default: paymentMethod = txn.payment_method.replace(/_/g, ' ');
          }
        }

        return {
          _id: txn._id,
          invoiceId: txn.invoice_number || txn.invoice_id || `TXN-${txn._id.toString().slice(-8).toUpperCase()}`,
          date: txn.transaction_date || txn.created_at,
          plan: txn.license_name || txn.license_code || 'License Payment',
          seats: txn.seats_purchased || 0,
          cycle: txn.billing_cycle?.toLowerCase() || 'monthly',
          amount: txn.final_amount || txn.total_price || 0,
          currency: txn.currency || 'INR',
          paymentMethod: paymentMethod,
          transactionId: txn.razorpay_payment_id || txn.gateway_transaction_id || txn.transaction_id || txn._id.toString().slice(-12).toUpperCase(),
          status: txn.status?.toLowerCase() || 'pending',
          description: `${txn.license_name || txn.license_code} - ${txn.billing_cycle || 'Monthly'} Subscription`,
          items: txn.items && txn.items.length > 0 ? txn.items.map(item => ({
            license_code: item.license_code,
            license_name: item.license_name,
            seats_purchased: item.seats_purchased,
            billing_cycle: item.billing_cycle,
            price_per_seat: item.price_per_seat,
            total_price: item.total_price,
          })) : [],
        };
      });

      console.log(`✅ [Payment History] Returning ${payments.length} real transactions`);

      return res.json({
        id,
        payments,
        source: 'real_transactions'
      });
    }

    // If no real transactions, try invoices
    console.log(`💳 [Payment History] No transactions found, checking invoices...`);

    const realInvoices = await Invoice.find({
      $or: [
        { organization_id: id },
        { user_id: id }
      ]
    })
      .sort({ created_at: -1 })
      .limit(24)
      .lean();

    console.log(`💳 [Payment History] Found ${realInvoices.length} invoices in database`);

    if (realInvoices && realInvoices.length > 0) {
      // Return real invoices
      const payments = realInvoices.map((inv) => ({
        _id: inv._id,
        invoiceId: inv.invoice_number,
        date: inv.payment_date || inv.created_at,
        plan: inv.license_code,
        seats: inv.seats_purchased,
        cycle: inv.billing_cycle?.toLowerCase() || 'monthly',
        amount: inv.total_amount,
        currency: inv.currency || 'INR',
        paymentMethod: inv.payment_method?.replace(/_/g, ' ') || 'Credit Card',
        transactionId: inv.transaction_id || inv.gateway_payment_id || 'N/A',
        status: inv.payment_status || 'paid',
        description: `${inv.license_code} - ${inv.billing_cycle || 'Monthly'} Subscription`,
      }));

      console.log(`✅ [Payment History] Returning ${payments.length} invoices`);

      return res.json({
        id,
        payments,
        source: 'invoices'
      });
    }

    // If no real invoices, generate from subscription (fallback)
    console.log(`⚠️  [Payment History] No transactions or invoices found, generating from subscription...`);

    const subscription = await OrganizationSubscription.findOne({
      organization_id: id
    }).lean();

    if (!subscription) {
      return res.json({
        id,
        payments: [],
        source: 'none'
      });
    }

    // Generate payment history based on subscription
    const payments = [];

    if (subscription.subscription_start_date || subscription.trial_start_date) {
      const startDate = new Date(subscription.subscription_start_date || subscription.trial_start_date);

      // Calculate end date
      let endDate = subscription.subscription_end_date || subscription.trial_end_date;
      if (!endDate) {
        endDate = new Date(startDate);
        endDate.setFullYear(endDate.getFullYear() + 1); // Default 1 year
      } else {
        endDate = new Date(endDate);
      }

      // Get license plan for pricing
      const licensePlan = await License.findOne({
        license_code: subscription.license_code
      }).lean();

      const monthlyPrice = licensePlan?.price_monthly || 0;

      // Generate monthly payments between start and end date
      let currentDate = new Date(startDate);
      let invoiceCounter = 1;

      while (currentDate <= endDate && currentDate <= new Date()) {
        // Generate unique transaction ID
        const transactionId = `TXN${currentDate.getFullYear()}${String(currentDate.getMonth() + 1).padStart(2, '0')}${String(id).slice(-6).toUpperCase()}`;

        payments.push({
          _id: `${id}-${currentDate.getTime()}`,
          invoiceId: `INV-${String(invoiceCounter).padStart(6, '0')}`,
          date: new Date(currentDate),
          plan: licensePlan?.name || subscription.license_code || 'N/A',
          seats: subscription.seats_purchased || 0,
          cycle: subscription.billing_cycle?.toLowerCase() || 'monthly',
          amount: monthlyPrice,
          currency: 'INR',
          paymentMethod: subscription.payment_method?.toLowerCase().replace('_', ' ') || 'Credit Card',
          transactionId: transactionId,
          status: subscription.status === 'ACTIVE' ? 'paid' : subscription.status === 'TRIAL' ? 'pending' : 'failed',
          description: `${licensePlan?.name || subscription.license_code} - Monthly Subscription`,
          planName: licensePlan?.name || subscription.license_code || 'N/A'
        });

        // Move to next month
        currentDate.setMonth(currentDate.getMonth() + 1);
        invoiceCounter++;
      }
    }

    // Sort by date descending (most recent first)
    payments.sort((a, b) => b.date - a.date);

    console.log(`✅ [Payment History] Generated ${payments.length} payments from subscription`);

    res.json({
      id,
      payments: payments.slice(0, 12), // Return last 12 months
      source: 'generated'
    });
  } catch (error) {
    console.error('❌ [Payment History] Error:', error);
    res.status(500).json({
      error: 'Failed to fetch payment history',
      details: error.message
    });
  }
});

/**
 * GET /api/super-admin/licenses/export-csv
 * Export license data as CSV
 */
router.get('/licenses/export-csv', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    // Fetch all organizations
    const organizations = await Organization.find().lean();

    const csvData = [];

    // Process each organization
    for (const org of organizations) {
      // Get subscription
      const subscription = await OrganizationSubscription.findOne({
        organization_id: org._id
      }).lean();

      // Get license plan
      let licensePlan = null;
      if (subscription) {
        licensePlan = await License.findOne({
          license_code: subscription.license_code
        }).lean();
      }

      // Calculate end date if not set
      let endDate = subscription?.subscription_end_date || subscription?.trial_end_date;
      if (!endDate && subscription?.subscription_start_date) {
        const startDate = new Date(subscription.subscription_start_date);
        endDate = new Date(startDate);
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      // Get users for this organization (fix field name: organization_id)
      const users = await User.find({
        organization_id: org._id
      }).lean();

      if (users.length === 0) {
        // Add organization row even if no users
        csvData.push({
          organizationId: org._id.toString(),
          organizationName: org.name,
          orgCreatedDate: org.createdAt ? formatAdminDate(org.createdAt) : '',
          orgStatus: org.status || '',
          planName: licensePlan?.name || subscription?.license_code || '',
          planType: subscription?.status === 'TRIAL' ? 'trial' : 'paid',
          licenseStatus: subscription?.status || '',
          startDate: subscription?.subscription_start_date ? formatAdminDate(subscription.subscription_start_date) : '',
          endDate: endDate ? formatAdminDate(endDate) : '',
          totalSeats: subscription?.seats_purchased || '',
          usedSeats: subscription?.seats_used || subscription?.seats_occupied || '',
          monthlyPrice: licensePlan?.price_monthly || '',
          billingCycle: subscription?.billing_cycle || '',
          userName: '',
          userEmail: '',
          userRole: '',
          userActive: '',
          userLicenseType: '',
          licenseAssignedDate: ''
        });
      } else {
        // Add a row for each user
        for (const user of users) {
          csvData.push({
            organizationId: org._id.toString(),
            organizationName: org.name,
            orgCreatedDate: org.createdAt ? formatAdminDate(org.createdAt) : '',
            orgStatus: org.status || '',
            planName: licensePlan?.name || subscription?.license_code || '',
            planType: subscription?.status === 'TRIAL' ? 'trial' : 'paid',
            licenseStatus: subscription?.status || '',
            startDate: subscription?.subscription_start_date ? formatAdminDate(subscription.subscription_start_date) : '',
            endDate: endDate ? formatAdminDate(endDate) : '',
            totalSeats: subscription?.seats_purchased || '',
            usedSeats: subscription?.seats_used || subscription?.seats_occupied || '',
            monthlyPrice: licensePlan?.price_monthly || '',
            billingCycle: subscription?.billing_cycle || '',
            userName: user.username || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            userEmail: user.email || '',
            userRole: user.role || '',
            userActive: user.isActive ? 'Yes' : 'No',
            userLicenseType: 'Standard',
            licenseAssignedDate: user.createdAt ? formatAdminDate(user.createdAt) : ''
          });
        }
      }
    }

    // 👤 Process Individual Users
    const individualUsers = await User.find({
      $or: [
        { organization_id: { $exists: false } },
        { organization_id: null }
      ],
      role: { $ne: 'super-admin' }
    })
      .populate({
        path: 'license_instance_id',
        select: 'license_code status renewal_date billing_cycle'
      })
      .lean();

    for (const user of individualUsers) {
      const instance = user.license_instance_id;

      csvData.push({
        organizationId: 'N/A',
        organizationName: 'INDIVIDUAL',
        orgCreatedDate: '',
        orgStatus: 'N/A',
        planName: instance?.license_code || user.license_code || 'Free',
        planType: 'individual',
        licenseStatus: instance?.status || 'Active',
        startDate: user.createdAt ? formatAdminDate(user.createdAt) : '',
        endDate: instance?.renewal_date ? formatAdminDate(instance.renewal_date) : 'N/A',
        totalSeats: '1',
        usedSeats: '1',
        monthlyPrice: '', // We could fetch this if needed
        billingCycle: instance?.billing_cycle || 'N/A',
        userName: user.username || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        userEmail: user.email || '',
        userRole: user.role || 'Individual',
        userActive: user.isActive ? 'Yes' : 'No',
        userLicenseType: instance?.license_code || 'Direct',
        licenseAssignedDate: user.createdAt ? formatAdminDate(user.createdAt) : ''
      });
    }

    // Convert to CSV
    const headers = [
      'Organization ID',
      'Organization Name',
      'Organization Created',
      'Organization Status',
      'License Plan',
      'Plan Type',
      'License Status',
      'Start Date',
      'End Date',
      'Total Seats',
      'Used Seats',
      'Monthly Price',
      'Billing Cycle',
      'User Name',
      'User Email',
      'User Role',
      'User Active',
      'User License Type',
      'License Assigned Date'
    ];

    const csvRows = [headers.join(',')];

    csvData.forEach(row => {
      const values = [
        row.organizationId,
        `"${row.organizationName}"`,
        row.orgCreatedDate,
        row.orgStatus,
        `"${row.planName}"`,
        row.planType,
        row.licenseStatus,
        row.startDate,
        row.endDate,
        row.totalSeats,
        row.usedSeats,
        row.monthlyPrice,
        row.billingCycle,
        `"${row.userName}"`,
        row.userEmail,
        row.userRole,
        row.userActive,
        row.userLicenseType,
        row.licenseAssignedDate
      ];
      csvRows.push(values.join(','));
    });

    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=license-report-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({
      error: 'Failed to export CSV',
      details: error.message
    });
  }
});

export default router;
