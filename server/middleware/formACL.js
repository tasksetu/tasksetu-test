import { FormTemplate } from "../modals/formTemplateModal.js";
import { TimezoneHelper } from "../utils/timezoneHelper.js";

/**
 * Form Access Control List (ACL) Middleware
 * 
 * Checks if the authenticated user has the required permission to access a form.
 * 
 * Permission Levels:
 * - OWNER: Full access (can delete, share, edit, view)
 * - EDITOR: Can edit form fields, settings, publish (cannot delete or share)
 * - VIEWER: Can only view form and responses (read-only)
 * - ORG_ADMIN (Company Admin): Can override any form in their organization
 * - SUPER_ADMIN (Tasksetu Admin): Platform-wide emergency access to all forms
 * 
 * @param {string} requiredPermission - 'VIEW' | 'EDIT' | 'OWNER'
 * @returns {Function} Express middleware
 */
export const checkFormPermission = (requiredPermission = 'VIEW') => {
  return async (req, res, next) => {
    try {
      const { form_id, id } = req.params;
      const formId = form_id || id;
      const userId = req.user?.id;
      const userRoles = req.user?.role || [];

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!formId) {
        return res.status(400).json({
          success: false,
          message: 'Form ID required'
        });
      }

      // Check for platform admin (super_admin) - has emergency access to ALL forms
      const isTasksetuAdmin = userRoles.includes('super_admin');

      if (isTasksetuAdmin) {
        // Platform admin bypass - log for audit trail
        console.log(`⚠️  PLATFORM ADMIN OVERRIDE: ${req.user.email || userId} accessed form ${formId} (${requiredPermission})`);

        // Still fetch the form for controller use - try _id first (URL param), then form_id field
        let form = await FormTemplate.findById(formId);
        if (!form) {
          form = await FormTemplate.findOne({ form_id: formId });
        }

        if (!form) {
          return res.status(404).json({
            success: false,
            message: 'Form not found'
          });
        }

        req.form = form;
        req.userRole = 'SUPER_ADMIN';
        req.adminOverride = true;
        req.overrideReason = 'Platform Admin Emergency Access';

        return next();
      }

      // Find the form - try _id first (matches URL param), then form_id field
      let form = await FormTemplate.findById(formId).populate('owner_user_id', 'organizationId organization_id');
      if (!form) {
        console.log(`🔍 Form not found by _id (${formId}), trying form_id field...`);
        form = await FormTemplate.findOne({ form_id: formId }).populate('owner_user_id', 'organizationId organization_id');
      }

      if (!form) {
        return res.status(404).json({
          success: false,
          message: 'Form not found'
        });
      }

      const userIdStr = userId.toString();
      // ✅ Handle both populated (object) and non-populated (ObjectId) cases
      const ownerIdStr = form.owner_user_id?._id?.toString() || form.owner_user_id?.toString();
      const isOwner = ownerIdStr === userIdStr;

      // Check for company admin (org_admin) - they can access all forms in their organization
      const isCompanyAdmin = userRoles.includes('org_admin');
      const userOrgId = req.user?.organizationId || req.user?.organization_id;
      const formOwnerOrgId = form.owner_user_id?.organizationId || form.owner_user_id?.organization_id;

      // ✅ Company admin has access if form owner is in same organization
      const isCompanyAdminWithOrgAccess = isCompanyAdmin && userOrgId && formOwnerOrgId &&
        userOrgId.toString() === formOwnerOrgId.toString();

      // Check permissions based on required level
      switch (requiredPermission) {
        case 'OWNER':
          // Owner OR Company Admin (same org) can perform owner-level actions (delete, share)
          if (!isOwner && !isCompanyAdminWithOrgAccess) {
            const userRole = form.getUserRole(userId);
            return res.status(403).json({
              success: false,
              message: 'Only the form owner or Company Admin can perform this action',
              currentRole: userRole || 'NONE',
              allowedRoles: ['OWNER', 'ORG_ADMIN', 'SUPER_ADMIN'],
              note: 'Delete and share operations require owner permissions'
            });
          }

          // Log if Company Admin is overriding
          if (isCompanyAdminWithOrgAccess && !isOwner) {
            console.log(`⚠️  COMPANY ADMIN OVERRIDE: ${req.user.email || userId} modified form ${formId} (${requiredPermission})`);
            req.adminOverride = true;
            req.overrideReason = 'Company Admin Override';
          }
          break;

        case 'EDIT':
          // Owner, Company Admin (same org), or EDITOR role can edit
          if (!isOwner && !isCompanyAdminWithOrgAccess) {
            const userRole = form.getUserRole(userId);
            if (userRole !== 'EDITOR') {
              return res.status(403).json({
                success: false,
                message: 'Only the form owner, editors, or Company Admin can edit this form',
                currentRole: userRole || 'NONE',
                allowedRoles: ['OWNER', 'EDITOR', 'ORG_ADMIN', 'SUPER_ADMIN']
              });
            }
          }

          // Log if Company Admin is overriding
          if (isCompanyAdminWithOrgAccess && !isOwner) {
            console.log(`⚠️  COMPANY ADMIN OVERRIDE: ${req.user.email || userId} editing form ${formId}`);
            req.adminOverride = true;
            req.overrideReason = 'Company Admin Override';
          }
          break;

        case 'PUBLISH':
          // Owner, ORG_ADMIN, SUPER_ADMIN can always publish.
          // Editors can publish UNLESS restrictPublishToOwner is enabled on the form.
          if (!isOwner && !isCompanyAdminWithOrgAccess && !isTasksetuAdmin) {
            const userRole = form.getUserRole(userId);
            if (userRole === 'EDITOR') {
              // Only block editors when the form has restrictPublishToOwner enabled
              if (form.restrictPublishToOwner) {
                return res.status(403).json({
                  success: false,
                  message: 'Publishing is restricted to the form owner only. This form has "Restrict Publishing to Owner Only" enabled.',
                  currentRole: userRole,
                  allowedRoles: ['OWNER', 'ORG_ADMIN', 'SUPER_ADMIN'],
                  note: 'Publishing is restricted for editors by governance.'
                });
              }
              // Editor is allowed to publish when restrictPublishToOwner is off — let through
              break;
            }
            return res.status(403).json({
              success: false,
              message: 'You do not have permission to publish this form',
              currentRole: userRole || 'NONE',
              allowedRoles: ['OWNER', 'ORG_ADMIN', 'SUPER_ADMIN'],
              note: 'Only form owner or admins can publish forms'
            });
          }
          // Log if Company Admin is publishing
          if (isCompanyAdminWithOrgAccess && !isOwner) {
            console.log(`⚠️  COMPANY ADMIN OVERRIDE: ${req.user.email || userId} publishing form ${formId}`);
            req.adminOverride = true;
            req.overrideReason = 'Company Admin Override';
          }
          break;

        case 'VIEW':
          // Owner, Company Admin (same org), EDITOR, VIEWER, or ORG visibility users can view
          const isSameOrg = userOrgId && formOwnerOrgId && userOrgId.toString() === formOwnerOrgId.toString();
          const hasOrgAccess = form.visibility === 'ORG' && isSameOrg;

          // ✅ PUBLIC forms can be viewed by anyone
          const isPublicForm = form.visibility === 'PUBLIC';

          if (!isOwner && !isCompanyAdminWithOrgAccess && !form.hasAccess(userId, 'VIEW') && !hasOrgAccess && !isPublicForm) {
            return res.status(403).json({
              success: false,
              message: 'You do not have permission to view this form'
            });
          }

          // Log if Company Admin is viewing
          if (isCompanyAdminWithOrgAccess && !isOwner && !form.hasAccess(userId, 'VIEW')) {
            console.log(`ℹ️  COMPANY ADMIN ACCESS: ${req.user.email || userId} viewing form ${formId}`);
          }

          // Log if ORG visibility is granting access
          if (hasOrgAccess && !isOwner && !isCompanyAdminWithOrgAccess) {
            console.log(`ℹ️  ORG VISIBILITY ACCESS: ${req.user.email || userId} viewing org-wide form ${formId}`);
          }
          break;

        default:
          return res.status(500).json({
            success: false,
            message: 'Invalid permission level specified'
          });
      }

      // Attach form and user role to request object for use in controller
      req.form = form;
      req.userRole = isOwner ? 'OWNER' :
        isCompanyAdmin ? 'ORG_ADMIN' :
          form.getUserRole(userId);

      next();
    } catch (error) {
      console.error('Form ACL Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error checking form permissions',
        error: error.message
      });
    }
  };
};

/**
 * Check if user has access to forms based on organization
 * For org-wide forms with visibility: 'ORG'
 * Company Admin and Platform Admin have full access
 */
export const checkOrgFormAccess = async (req, res, next) => {
  try {
    const { form_id, id } = req.params;
    const formId = form_id || id;
    const userId = req.user?.id;
    const userRoles = req.user?.role || [];

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const form = await FormTemplate.findOne({ form_id: formId });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Form not found'
      });
    }

    // Platform Admin has access to all forms
    const isTasksetuAdmin = userRoles.includes('super_admin');
    if (isTasksetuAdmin) {
      console.log(`⚠️  PLATFORM ADMIN: ${req.user.email || userId} accessing org form ${formId}`);
      req.form = form;
      req.userRole = 'SUPER_ADMIN';
      req.adminOverride = true;
      return next();
    }

    // Company Admin has access to all org forms
    const isCompanyAdmin = userRoles.includes('org_admin');
    if (isCompanyAdmin) {
      console.log(`ℹ️  COMPANY ADMIN: ${req.user.email || userId} accessing org form ${formId}`);
      req.form = form;
      req.userRole = 'ORG_ADMIN';
      return next();
    }

    // If form is PUBLIC, allow everyone
    if (form.visibility === 'PUBLIC') {
      req.form = form;
      req.userRole = 'PUBLIC';
      return next();
    }

    // If form is ORG-level, check if user is in same org
    if (form.visibility === 'ORG') {
      // Get user's organization
      const User = (await import('../modals/userModal.js')).default;
      const user = await User.findById(userId);
      const owner = await User.findById(form.owner_user_id);

      if (user && owner && user.organizationId?.toString() === owner.organizationId?.toString()) {
        req.form = form;
        req.userRole = 'ORG_MEMBER';
        return next();
      }
    }

    // Fall back to standard ACL check
    return checkFormPermission('VIEW')(req, res, next);
  } catch (error) {
    console.error('Org Form ACL Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking organization form access',
      error: error.message
    });
  }
};

/**
 * Middleware to check if user can submit a form
 * Allows anonymous submissions if form settings allow it
 * Admins can submit to any form regardless of status
 */
export const checkFormSubmitPermission = async (req, res, next) => {
  try {
    const { form_id, id } = req.params;
    const formId = form_id || id;
    const userId = req.user?.id;
    const userRoles = req.user?.role || [];

    const form = await FormTemplate.findOne({ form_id: formId });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Form not found'
      });
    }

    // Platform Admin and Company Admin can submit to any form (for testing)
    const isTasksetuAdmin = userRoles.includes('super_admin');
    const isCompanyAdmin = userRoles.includes('org_admin');

    if (isTasksetuAdmin || isCompanyAdmin) {
      console.log(`ℹ️  ADMIN SUBMIT: ${req.user.email || userId} submitting to form ${formId}`);
      req.form = form;
      req.userRole = isTasksetuAdmin ? 'SUPER_ADMIN' : 'ORG_ADMIN';
      req.adminOverride = true;
      return next();
    }

    // Check if form is published
    if (form.status !== 'PUBLISHED') {
      return res.status(400).json({
        success: false,
        message: 'This form is not currently accepting submissions'
      });
    }

    // Check if form is expired (timezone-aware)
    if (form.end_at) {
      const tz = form.timezone || 'UTC';
      const { endOfDay } = TimezoneHelper.getDayBoundaries(tz, form.end_at);
      if (new Date() > endOfDay) {
        return res.status(400).json({
          success: false,
          message: 'This form has expired'
        });
      }
    }

    // Check if form hasn't started yet (timezone-aware)
    if (form.start_at) {
      const tz = form.timezone || 'UTC';
      const { startOfDay } = TimezoneHelper.getDayBoundaries(tz, form.start_at);
      if (new Date() < startOfDay) {
        return res.status(400).json({
          success: false,
          message: 'This form is not yet accepting submissions'
        });
      }
    }

    // If anonymous submissions are allowed, proceed
    if (form.settings?.allowAnonymous) {
      req.form = form;
      req.userRole = 'ANONYMOUS';
      return next();
    }

    // If anonymous not allowed, require authentication
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to submit this form'
      });
    }

    req.form = form;
    req.userRole = 'AUTHENTICATED';
    next();
  } catch (error) {
    console.error('Form Submit Permission Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking form submit permissions',
      error: error.message
    });
  }
};

export default {
  checkFormPermission,
  checkOrgFormAccess,
  checkFormSubmitPermission
};
