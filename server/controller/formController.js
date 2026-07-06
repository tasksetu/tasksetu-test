import mongoose from 'mongoose';
import { FormTemplate } from '../modals/formTemplateModal.js';
import { FormVersion } from '../modals/formVersionModal.js';
import { FormUsage } from '../modals/formUsageModal.js';
import { FormSubmission } from '../modals/formSubmissionModal.js';
// Import FormCategory and FormTag from centralized models.js (avoids duplicate model compilation)
import { Task, FormCategory, FormTag } from '../models.js';
import { generateUniqueCode } from '../utils/codeGenerator.js';
import crypto from 'crypto';
import * as auditLogger from '../utils/auditLogger.js';
import { FeatureUsageTracking } from '../modals/featureUsageTrackingModal.js';
import * as licenseService from '../services/licenseService.js';
import fs from 'fs';
import * as r2Storage from '../services/r2Storage.js';
import path from 'path';
import { generateCaptcha, verifyCaptcha, isCaptchaTokenValid, consumeCaptchaToken } from '../utils/captchaGenerator.js';
import { TimezoneHelper } from '../utils/timezoneHelper.js';

/**
 * Helper: Save base64 file data to disk and return the URL path.
 * Converts { name, type, size, data: "data:mime;base64,..." } to a disk file.
 * Returns the URL path (e.g., "/uploads/form-submissions/filename.ext") or null.
 */
const saveBase64FileToDisk = async (fileObj) => {
  try {
    if (!fileObj || typeof fileObj !== 'object' || !fileObj.data) return null;
    const dataStr = fileObj.data;
    if (typeof dataStr !== 'string' || !dataStr.startsWith('data:')) return null;

    // Parse the base64 string
    const matches = dataStr.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) return null;

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate unique filename preserving original extension
    const originalName = fileObj.name || fileObj.filename || 'file';
    const ext = path.extname(originalName) || mimeExtension(mimeType);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const storedFilename = `form-${uniqueSuffix}${ext}`;

    // Upload to Cloudflare R2 if enabled
    if (r2Storage.isR2Enabled()) {
      try {
        const key = `form-submissions/${storedFilename}`;
        await r2Storage.uploadToR2(buffer, key, mimeType);
        return `/uploads/form-submissions/${storedFilename}`;
      } catch (r2Error) {
        console.error('[saveBase64FileToDisk] Failed to upload to R2, falling back to disk:', r2Error.message);
      }
    }

    // Create upload directory
    const uploadDir = path.resolve(process.cwd(), 'uploads', 'form-submissions');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, storedFilename);

    // Write file to disk
    fs.writeFileSync(filePath, buffer);

    // Return the URL path (served by express.static)
    return `/uploads/form-submissions/${storedFilename}`;
  } catch (err) {
    console.error('Error saving base64 file:', err.message);
    return null;
  }
};

/** Map common MIME types to file extensions */
const mimeExtension = (mime) => {
  const map = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
    'image/bmp': '.bmp', 'image/svg+xml': '.svg', 'image/tiff': '.tiff',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'text/plain': '.txt', 'text/csv': '.csv', 'text/html': '.html',
    'application/zip': '.zip', 'application/x-rar-compressed': '.rar', 'application/x-7z-compressed': '.7z',
    'application/json': '.json', 'application/xml': '.xml',
    'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/ogg': '.ogg',
    'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov',
  };
  return map[mime] || '';
};

/**
 * Process file upload fields in form data:
 * - Saves base64 data to disk or R2
 * - Replaces base64 in submission_data with URL path
 * - Returns attachments array
 */
const processFileUploadsForSubmission = async (formData, formFields) => {
  const attachments = [];
  const fileUploadFields = formFields.filter(f => f.type === 'file_upload');

  for (const field of fileUploadFields) {
    const fieldKey = formData[field.field_id] !== undefined ? field.field_id
      : formData[field.field_code] !== undefined ? field.field_code : null;
    if (!fieldKey) continue;

    const fieldValue = formData[fieldKey];
    if (!fieldValue) continue;

    const attachmentFieldId = field.field_code || field.field_id;

    const processSingleFile = async (file) => {
      if (!file) return null;

      // Case 1: Already a URL string (no base64 processing needed)
      if (typeof file === 'string') {
        if (file.startsWith('data:')) {
          // Shouldn't happen for bare strings, but handle it
          return null;
        }
        return {
          field_id: attachmentFieldId,
          filename: file.split('/').pop() || 'file',
          file_path: file,
          file_size: 0,
          mime_type: 'application/octet-stream',
          uploaded_at: new Date(),
        };
      }

      // Case 2: Object with base64 data
      if (typeof file === 'object' && file !== null) {
        let filePath = file.file_path || file.url || file.path || null;

        // If has base64 data, save
        if (file.data && typeof file.data === 'string' && file.data.startsWith('data:')) {
          const savedPath = await saveBase64FileToDisk(file);
          if (savedPath) {
            filePath = savedPath;
          }
        }

        return {
          field_id: attachmentFieldId,
          filename: file.filename || file.name || 'file',
          file_path: filePath,
          file_size: file.file_size || file.size || 0,
          mime_type: file.mime_type || file.type || 'application/octet-stream',
          uploaded_at: new Date(),
        };
      }

      return null;
    };

    if (Array.isArray(fieldValue)) {
      const processedFiles = [];
      for (const file of fieldValue) {
        const attachment = await processSingleFile(file);
        if (attachment) {
          attachments.push(attachment);
          // Replace base64 data with clean object (URL + metadata only)
          processedFiles.push({
            name: attachment.filename,
            type: attachment.mime_type,
            size: attachment.file_size,
            file_path: attachment.file_path,
          });
        }
      }
      // Replace the field value in formData with clean data (no base64)
      formData[fieldKey] = processedFiles;
    } else {
      const attachment = await processSingleFile(fieldValue);
      if (attachment) {
        attachments.push(attachment);
        // Replace the field value in formData with clean data (no base64)
        formData[fieldKey] = {
          name: attachment.filename,
          type: attachment.mime_type,
          size: attachment.file_size,
          file_path: attachment.file_path,
        };
      }
    }
  }

  return attachments;
};

/**
 * Get all form categories
 */
export const getFormCategories = async (req, res) => {
  try {
    const categories = await FormCategory.find().sort({ name: 1 });
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error.message
    });
  }
};

/**
 * Get all forms for the logged-in user
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
/**
 * Get all forms with pagination
 * Returns forms based on visibility rules:
 * - Platform Admin: sees ALL forms (cross-org)
 * - Company Admin: sees all org forms (owned by anyone in org)
 * - Regular User: sees owned forms + shared forms + ORG visibility forms from same org
 */
export const getAllForms = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search?.trim() || "";
    const statusFilter = req.query.status?.trim();
    const categoryFilter = req.query.category?.trim();
    const tagsFilter = req.query.tags?.trim();
    const ownerFilter = req.query.owner?.trim();
    const sortBy = req.query.sortBy || 'created_at';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const user_id = req.user.id;
    const userRoles = req.user.role || [];

    console.log('📋 GET /api/forms query params:', { page, limit, search, statusFilter, categoryFilter, tagsFilter, ownerFilter, sortBy, sortOrder, user: req.user.email });

    // Check if user is admin
    const isTasksetuAdmin = userRoles.includes('super_admin');
    const isCompanyAdmin = userRoles.includes('org_admin');

    // Get user's organization
    const { User } = await import('../modals/userModal.js');
    const currentUser = await User.findById(user_id);
    // Use organization_id (the actual schema field, not the virtual)
    const userOrgId = currentUser?.organization_id || currentUser?.organizationId;

    console.log('👤 User info:', {
      user_id,
      email: req.user.email,
      isTasksetuAdmin,
      isCompanyAdmin,
      userOrgId: userOrgId?.toString(),
      rawOrgId: currentUser?.organization_id,
      rawOrgIdVirtual: currentUser?.organizationId
    });

    let query;

    // Platform Admin sees ALL forms (cross-org)
    if (isTasksetuAdmin) {
      query = {}; // No restrictions
      console.log(`ℹ️  PLATFORM ADMIN: ${req.user.email} viewing all forms`);
    }
    // Company Admin sees all organization forms
    else if (isCompanyAdmin && userOrgId) {
      // Find all users in same organization (use organization_id field)
      console.log(`🔍 Looking for org users with organization_id:`, userOrgId.toString());
      const orgUsers = await User.find({ organization_id: userOrgId }).select('_id email organization_id');
      const orgUserIds = orgUsers.map(u => u._id);

      console.log(`ℹ️  COMPANY ADMIN: ${req.user.email} - Found ${orgUserIds.length} org users:`, orgUsers.map(u => ({ email: u.email, id: u._id.toString(), org: u.organization_id?.toString() })));

      // Company Admin sees all forms owned by anyone in the organization
      query = {
        owner_user_id: { $in: orgUserIds }
      };
    }
    // Regular users see owned + shared + ORG visibility forms
    else {
      // Convert user_id to ObjectId for proper comparison
      const userObjectId = mongoose.Types.ObjectId.isValid(user_id)
        ? new mongoose.Types.ObjectId(user_id)
        : user_id;

      // Build query for regular users
      const orConditions = [
        { owner_user_id: userObjectId }, // Forms I own
        { "shared_with.user_id": userObjectId } // Forms shared with me
      ];

      // If user belongs to an organization, also show ORG visibility forms from same org
      if (userOrgId) {
        // Use organization_id field for query
        const orgUsers = await User.find({ organization_id: userOrgId }).select('_id');
        const orgUserIds = orgUsers.map(u => u._id);

        // Show ORG visibility PUBLISHED forms from org members (excluding own forms which are already included)
        orConditions.push({
          owner_user_id: { $in: orgUserIds, $ne: userObjectId },
          visibility: "ORG",
          status: "PUBLISHED"
        });

        console.log(`ℹ️  REGULAR USER with org: Adding ORG visibility condition for ${orgUserIds.length} org users`);
      }

      query = { $or: orConditions };
      console.log(`ℹ️  REGULAR USER: ${req.user.email} viewing owned + shared + ORG forms. User ID:`, userObjectId.toString());
    }

    // ✅ Apply status filter if provided
    if (statusFilter) {
      query.status = statusFilter;
      console.log('🔍 Applying status filter:', statusFilter);
    }

    // ✅ Apply category filter
    if (categoryFilter) {
      query.category_id = categoryFilter;
      console.log('🔍 Applying category filter:', categoryFilter);
    }

    // ✅ Apply tags filter (supports comma-separated tags, case-insensitive)
    if (tagsFilter) {
      const tagsArray = tagsFilter.split(',').map(t => t.trim()).filter(Boolean);
      if (tagsArray.length > 0) {
        // Use regex for case-insensitive tag matching
        const tagRegexes = tagsArray.map(tag => new RegExp(`^${tag}$`, 'i'));
        query.tags = { $in: tagRegexes };
        console.log('🔍 Applying tags filter:', tagsArray);
      }
    }

    // Store owner filter for later (can't apply directly due to $or ACL clause)
    let ownerFilterUserId = null;
    if (ownerFilter) {
      // Try to find user by email or ID
      const { User } = await import('../modals/userModal.js');
      const ownerUsers = await User.find({
        $or: [
          { email: { $regex: ownerFilter, $options: 'i' } },
          { firstName: { $regex: ownerFilter, $options: 'i' } },
          { lastName: { $regex: ownerFilter, $options: 'i' } }
        ]
      }).select('_id email');

      if (ownerUsers.length > 0) {
        // If multiple users match, use all their IDs
        ownerFilterUserId = ownerUsers.length === 1 ? ownerUsers[0]._id : { $in: ownerUsers.map(u => u._id) };
        console.log('🔍 Found owner(s) matching filter:', ownerUsers.map(u => u.email));
      }
    }

    // If search exists → apply across multiple fields
    if (search) {
      const searchConditions = [
        { title: { $regex: search, $options: "i" } }, // title match
        { description: { $regex: search, $options: "i" } }, // optional
        { tags: { $in: [new RegExp(search, "i")] } }, // match tag
        { status: { $regex: `^${search}$`, $options: "i" } }, // match status (draft, published, etc.)
        { category_id: { $regex: search, $options: "i" } }, // match category name (stored as string)
      ];

      // Combine with access control
      if (query.$or) {
        query.$and = [
          { $or: query.$or }, // Keep ownership/sharing filter
          { $or: searchConditions } // Add search filter
        ];
        delete query.$or;
      } else {
        // For admin queries, wrap existing query
        const existingQuery = { ...query };
        query = {
          $and: [
            existingQuery,
            { $or: searchConditions }
          ]
        };
      }
    }

    // ✅ Apply owner filter (must be done after search to handle $or/$and properly)
    if (ownerFilterUserId) {
      if (query.$and) {
        // Add owner filter to existing $and
        query.$and.push({ owner_user_id: ownerFilterUserId });
      } else if (query.$or) {
        // Convert $or to $and with owner filter
        query.$and = [
          { $or: query.$or },
          { owner_user_id: ownerFilterUserId }
        ];
        delete query.$or;
      } else {
        // Simple case - just add to query
        query.owner_user_id = ownerFilterUserId;
      }
      console.log('🔍 Applied owner filter to query');
    }

    // Count total
    const total = await FormTemplate.countDocuments(query);

    console.log('📊 Forms query result:', { total, query: JSON.stringify(query) });

    // Build sort object
    const sortOptions = {};
    const validSortFields = ['created_at', 'updated_at', 'title', 'status', 'lastUsed'];
    if (validSortFields.includes(sortBy)) {
      sortOptions[sortBy] = sortOrder;
    } else {
      sortOptions.created_at = -1; // Default
    }

    // Fetch paginated data
    const forms = await FormTemplate.find(query)
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(limit)
      .select("-__v")
      .populate("current_version_id")
      .populate("owner_user_id", "firstName lastName email");

    // Add user's role to each form in response
    const formsWithRole = forms.map(form => {
      const formObj = form.toObject();

      // Determine user role for this form
      if (isTasksetuAdmin) {
        formObj.user_role = 'SUPER_ADMIN';
      } else if (isCompanyAdmin) {
        const isOwner = form.owner_user_id._id.toString() === user_id.toString();
        formObj.user_role = isOwner ? 'OWNER' : 'ORG_ADMIN';
      } else {
        // Individual user: ensure OWNER for own forms
        const isOwner = form.owner_user_id._id?.toString() === user_id.toString() || form.owner_user_id.toString() === user_id.toString();
        formObj.user_role = isOwner ? 'OWNER' : form.getUserRole(user_id) || 'VIEWER';
      }

      return formObj;
    });

    // Prevent caching to ensure fresh data
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.status(200).json({
      success: true,
      data: {
        forms: formsWithRole,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
          hasMore: page * limit < total,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching forms:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching forms",
      error: error.message,
    });
  }
};



/**
 * Get form details by ID
 * NOTE: Permission check is handled by checkFormPermission('VIEW') middleware
 * The middleware attaches req.form if user has access
 */
export const getFormById = async (req, res) => {
  try {
    const { form_id } = req.params;
    const user_id = req.user.id;
    const userRoles = req.user.role || [];

    console.log('🔍 getFormById called with form_id:', form_id, 'user:', req.user.email);

    // ✅ If middleware already attached form (permission already checked), use it
    if (req.form) {
      console.log('✅ Using form from middleware (permission pre-validated):', req.form.title);

      // Populate additional fields if needed
      await req.form.populate('current_version_id');
      await req.form.populate('owner_user_id', 'firstName lastName email');

      return res.status(200).json({
        success: true,
        data: req.form
      });
    }

    // Fallback: Find form if middleware didn't attach it
    let form;
    if (mongoose.Types.ObjectId.isValid(form_id)) {
      console.log('📝 Valid ObjectId detected, searching by _id');
      form = await FormTemplate.findById(form_id)
        .populate('current_version_id')
        .populate('owner_user_id', 'firstName lastName email organizationId organization_id');
    }

    if (!form) {
      console.log('📝 Not found by _id, trying form_id field');
      form = await FormTemplate.findOne({ form_id: form_id })
        .populate('current_version_id')
        .populate('owner_user_id', 'firstName lastName email organizationId organization_id');
    }

    if (!form) {
      console.log('❌ Form not found:', form_id);
      return res.status(404).json({
        success: false,
        message: 'Form not found or unauthorized'
      });
    }

    // Check access permissions (including org_admin)
    const userObjectId = mongoose.Types.ObjectId.isValid(user_id)
      ? new mongoose.Types.ObjectId(user_id)
      : user_id;

    const isOwner = form.owner_user_id?._id?.equals(userObjectId) ||
      form.owner_user_id?.equals(userObjectId);

    const isSharedUser = form.shared_with?.some(share => {
      const shareUserId = share.user_id || share.user;
      return shareUserId && (
        shareUserId.equals?.(userObjectId) ||
        shareUserId.toString() === userObjectId.toString()
      );
    });

    // ✅ Check for org_admin access (same organization)
    const isCompanyAdmin = userRoles.includes('org_admin');
    const userOrgId = req.user?.organizationId || req.user?.organization_id;
    const formOwnerOrgId = form.owner_user_id?.organizationId || form.owner_user_id?.organization_id;
    const isCompanyAdminWithOrgAccess = isCompanyAdmin && userOrgId && formOwnerOrgId &&
      userOrgId.toString() === formOwnerOrgId.toString();

    // ✅ Check for super_admin access
    const isSuperAdmin = userRoles.includes('super_admin');

    console.log('🔐 Access check:', {
      isOwner,
      isSharedUser,
      isCompanyAdminWithOrgAccess,
      isSuperAdmin,
      user: req.user.email,
      shared_with_count: form.shared_with?.length || 0
    });

    if (!isOwner && !isSharedUser && !isCompanyAdminWithOrgAccess && !isSuperAdmin) {
      console.log('❌ User not authorized to access form:', req.user.email);
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this form'
      });
    }

    // Log org_admin access
    if (isCompanyAdminWithOrgAccess && !isOwner) {
      console.log('ℹ️  ORG ADMIN accessing form:', req.user.email);
    }

    console.log('✅ Form found and user authorized:', form.title);
    res.status(200).json({
      success: true,
      data: form
    });

  } catch (error) {
    console.error('❌ Error fetching form details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching form details',
      error: error.message
    });
  }
};

/**
 * Create a new form template
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
export const createForm = async (req, res) => {
  try {
    const {
      title,
      description,
      fields = [],
      category_id = null,
      tags = [],
      visibility = "PRIVATE",
      scope = "INTERNAL",
      restrictPublishToOwner = false,
      settings = {
        allowAnonymous: false,
        submitMessage: "Thank you for your submission!",
        layout: "1-column",
        maxSubmissions: null,
        redirectUrl: null
      }
    } = req.body;

    const rawStatus = (req.params.status || '').toString().toLowerCase();

    // Map URL-friendly statuses to stored enum values
    let statusMap = {
      'draft': 'DRAFT',
      'publish': 'PUBLISHED',
      'published': 'PUBLISHED',
      'archive': 'ARCHIVED',
      'archived': 'ARCHIVED'
    };

    const normalizedStatus = statusMap[rawStatus] || 'DRAFT';

    // Validate status
    if (!["DRAFT", "ARCHIVED", "PUBLISHED"].includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be draft or publish (or archive).'
      });
    }

    // Sanitize category_id - store as trimmed string or null
    const validCategoryId = category_id && typeof category_id === 'string' && category_id.trim()
      ? category_id.trim()
      : null;

    // Validate unique field_code values (Spec 5.11 - Edge Case)
    const { validateUniqueFieldCodes } = await import('../utils/formValidation.js');
    const fieldValidation = validateUniqueFieldCodes(fields);
    if (!fieldValidation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate field codes detected in form fields',
        error: 'DUPLICATE_FIELD_CODES',
        duplicates: fieldValidation.duplicates,
        hint: 'Each field must have a unique field_code. Please rename the duplicate fields before saving.'
      });
    }

    // Generate unique form code
    const form_code = await generateUniqueCode('FORM');

    // Create new form template
    const newForm = new FormTemplate({
      form_code,
      title,
      description,
      fields: fields.map((field, index) => ({
        ...field,
        order: index,
        // Display-only fields (Section Title, Read-only Label) cannot be required
        ...((['title', 'label'].includes(field.type)) ? { isRequired: false, required: false } : {})
      })),
      owner_user_id: req.user.id,
      category_id: validCategoryId,
      tags,
      visibility,
      scope,
      settings,
      status: normalizedStatus
    });

    // Save the form
    await newForm.save();

    // 📊 Track FORM_CREATE usage
    const userId = req.featureUsage?.user_id || req.user?.id || req.user?._id;
    if (userId) {
      try {
        console.log('📊 [USAGE TRACKING] Tracking FORM_CREATE usage for createForm');
        console.log('📊 [USAGE TRACKING] User ID:', userId);

        const consumeResult = await licenseService.consumeFeature(
          userId,
          'FORM_CREATE',
          1
        );

        if (consumeResult.success) {
          console.log('📊 [USAGE TRACKING] ✅ FORM_CREATE usage tracked successfully. New usage:', consumeResult.usage);
        } else {
          console.warn('📊 [USAGE TRACKING] ⚠️ Failed to track FORM_CREATE usage:', consumeResult.message);
        }
      } catch (trackingError) {
        console.error('📊 [USAGE TRACKING] ⚠️ Failed to track FORM_CREATE usage:', trackingError.message);
        // Don't fail form creation if tracking fails
      }
    }

    // ✅ Audit Log: Form Created (Spec 5.12)
    await auditLogger.logFormCreated(newForm, req.user, req);

    res.status(201).json({
      success: true,
      message: 'Form template created successfully',
      data: newForm
    });

  } catch (error) {
    console.error('Error creating form template:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating form template',
      error: error.message
    });
  }
};


/**
 * Create or update a draft form
 */

export const saveOrUpdateDraftForm = async (req, res) => {
  try {
    const {
      form_id, // optional — if present, update; else create
      title,
      description,
      fields = [],
      category_id = null,
      tags = [],
      restrictPublishToOwner,
      settings = {
        allowAnonymous: false,
        submitMessage: "Thank you for your submission!",
        layout: "1-column",
        maxSubmissions: null,
        redirectUrl: null
      }
    } = req.body;

    const owner_user_id = req.user.id;

    // Sanitize category_id - store as trimmed string or null
    const validCategoryId = category_id && typeof category_id === 'string' && category_id.trim()
      ? category_id.trim()
      : null;

    // Validate unique field_code values (Spec 5.11 - Edge Case)
    const { validateUniqueFieldCodes } = await import('../utils/formValidation.js');
    const fieldValidation = validateUniqueFieldCodes(fields);
    if (!fieldValidation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate field codes detected in form fields',
        error: 'DUPLICATE_FIELD_CODES',
        duplicates: fieldValidation.duplicates,
        hint: 'Each field must have a unique field_code. Please rename the duplicate fields before saving.'
      });
    }

    // If form_id provided => Update existing draft
    if (form_id) {
      // Find form by form_id (not just owner check)
      const existingForm = await FormTemplate.findOne({ form_id: form_id })
        .populate('owner_user_id', 'organizationId organization_id');

      if (!existingForm) {
        return res.status(404).json({
          success: false,
          message: "Form not found",
        });
      }

      // Check if user is owner OR has EDITOR access OR is org_admin from same org
      const userObjectId = mongoose.Types.ObjectId.isValid(owner_user_id)
        ? new mongoose.Types.ObjectId(owner_user_id)
        : owner_user_id;

      const isOwner = existingForm.owner_user_id?._id?.equals(userObjectId) ||
        existingForm.owner_user_id?.equals(userObjectId);

      const editorAccess = existingForm.shared_with?.find(share => {
        const shareUserId = share.user_id || share.user;
        return shareUserId && (
          shareUserId.equals?.(userObjectId) ||
          shareUserId.toString() === userObjectId.toString()
        ) && share.role === 'EDITOR';
      });

      // ✅ Check for org_admin access (same organization)
      const userRoles = req.user.role || [];
      const isCompanyAdmin = userRoles.includes('org_admin');
      const isSuperAdmin = userRoles.includes('super_admin');
      const userOrgId = req.user?.organizationId || req.user?.organization_id;
      const formOwnerOrgId = existingForm.owner_user_id?.organizationId || existingForm.owner_user_id?.organization_id;
      const isCompanyAdminWithOrgAccess = isCompanyAdmin && userOrgId && formOwnerOrgId &&
        userOrgId.toString() === formOwnerOrgId.toString();

      if (!isOwner && !editorAccess && !isCompanyAdminWithOrgAccess && !isSuperAdmin) {
        console.log('❌ User not authorized to edit form:', req.user.email, '| isOwner:', isOwner, '| editorAccess:', !!editorAccess, '| isCompanyAdminWithOrgAccess:', isCompanyAdminWithOrgAccess);
        return res.status(403).json({
          success: false,
          message: "You do not have permission to edit this form",
        });
      }

      console.log('✅ User authorized to edit form:', req.user.email, '| isOwner:', isOwner, '| editorAccess:', !!editorAccess, '| isCompanyAdminWithOrgAccess:', isCompanyAdminWithOrgAccess);

      existingForm.title = title ?? existingForm.title;
      existingForm.description = description ?? existingForm.description;
      existingForm.fields = fields.map((field, index) => ({
        ...field,
        order: index,
        // Display-only fields (Section Title, Read-only Label) cannot be required
        ...((['title', 'label'].includes(field.type)) ? { isRequired: false, required: false } : {})
      }));
      existingForm.category_id = category_id !== undefined ? validCategoryId : existingForm.category_id;
      existingForm.tags = tags ?? existingForm.tags;
      existingForm.settings = settings ?? existingForm.settings;
      if (restrictPublishToOwner !== undefined) {
        existingForm.restrictPublishToOwner = !!restrictPublishToOwner;
      }

      // Always keep draft status for this controller
      existingForm.status = "DRAFT";
      existingForm.current_version_id = null;
      existingForm.visibility = null;
      existingForm.scope = null;

      await existingForm.save();

      // ✅ Audit Log: Form Updated (Spec 5.12)
      await auditLogger.logFormUpdated(existingForm, req.user, req);

      return res.status(200).json({
        success: true,
        message: "Form draft updated successfully",
        data: existingForm,
      });
    }

    // Else create new draft
    const form_code = await generateUniqueCode("FORM");

    const newForm = new FormTemplate({
      form_code,
      title,
      description,
      fields: fields.map((field, index) => ({
        ...field,
        order: index,
        // Display-only fields (Section Title, Read-only Label) cannot be required
        ...((['title', 'label'].includes(field.type)) ? { isRequired: false, required: false } : {})
      })),
      owner_user_id,
      category_id: validCategoryId,
      tags,
      settings,
      restrictPublishToOwner: !!restrictPublishToOwner,
      status: "DRAFT",
      current_version_id: null,
      visibility: null,
      scope: null,
    });

    await newForm.save();

    // 📊 Track FORM_CREATE usage
    // ✅ FIXED: Use user_id instead of entity (updated for user-level licensing)
    const userId1 = req.featureUsage?.user_id || req.user?.id || req.user?._id;
    if (userId1) {
      try {
        console.log('📊 [USAGE TRACKING] Tracking FORM_CREATE usage');
        console.log('📊 [USAGE TRACKING] User ID:', userId1);

        const consumeResult = await licenseService.consumeFeature(
          userId1,
          'FORM_CREATE',
          1
        );

        if (consumeResult.success) {
          console.log('📊 [USAGE TRACKING] ✅ FORM_CREATE usage tracked successfully. New usage:', consumeResult.usage);
        } else {
          console.warn('📊 [USAGE TRACKING] ⚠️ Failed to track FORM_CREATE usage:', consumeResult.message);
        }
      } catch (trackingError) {
        console.error('📊 [USAGE TRACKING] ⚠️ Failed to track FORM_CREATE usage:', trackingError.message);
        // Don't fail form creation if tracking fails
      }
    }

    // ✅ Audit Log: Form Created (Spec 5.12)
    await auditLogger.logFormCreated(newForm, req.user, req);

    return res.status(201).json({
      success: true,
      message: "New form draft created successfully",
      data: newForm,
    });
  } catch (error) {
    console.error("Error saving/updating draft form:", error);
    res.status(500).json({
      success: false,
      message: "Error saving/updating draft form",
      error: error.message,
    });
  }
};




/**
 * @desc Delete a form by form_id (owner, org_admin, or super_admin can delete)
 * @route DELETE /api/forms/:form_id
 * @access Private (Authenticated users only)
 * 
 * CRITICAL FIX: Added dependency check to prevent deletion of forms
 * that are actively attached to tasks/subtasks (per spec requirement)
 */
export const deleteFormById = async (req, res) => {
  try {
    const { form_id } = req.params;
    const userId = req.user.id;
    const userRoles = req.user.role || [];

    // ✅ Validate form_id format
    if (!mongoose.Types.ObjectId.isValid(form_id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid form_id format",
      });
    }

    // ✅ Find the form first
    const form = await FormTemplate.findOne({ form_id: form_id })
      .populate('owner_user_id', 'organizationId organization_id');

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    // ✅ Check permissions (owner, org_admin from same org, or super_admin)
    const userObjectId = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;

    const isOwner = form.owner_user_id?._id?.equals(userObjectId) ||
      form.owner_user_id?.equals(userObjectId);
    const isSuperAdmin = userRoles.includes('super_admin');
    const isCompanyAdmin = userRoles.includes('org_admin');
    const userOrgId = req.user?.organizationId || req.user?.organization_id;
    const formOwnerOrgId = form.owner_user_id?.organizationId || form.owner_user_id?.organization_id;
    const isCompanyAdminWithOrgAccess = isCompanyAdmin && userOrgId && formOwnerOrgId &&
      userOrgId.toString() === formOwnerOrgId.toString();

    if (!isOwner && !isSuperAdmin && !isCompanyAdminWithOrgAccess) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to delete this form",
      });
    }

    // Log org_admin delete
    if (isCompanyAdminWithOrgAccess && !isOwner) {
      console.log(`⚠️  ORG ADMIN DELETE: ${req.user.email} deleting form ${form_id}`);
    }

    // ✅ CRITICAL: Check for active usage (dependencies)
    // Spec requirement: "Deletion blocked if template is used by active processes/tasks — must unlink first"
    const activeUsages = await FormUsage.getActiveUsagesForForm(form_id);

    if (activeUsages && activeUsages.length > 0) {
      // Build detailed dependency list
      const dependencies = activeUsages.map(usage => ({
        type: usage.attached_to_type,
        id: usage.attached_to_id,
        task_code: usage.task_id?.task_code || null,
        task_title: usage.task_id?.title || usage.subtask_id?.title || "Unknown",
        attached_at: usage.attached_at,
        attached_by: `${usage.attached_by?.firstName || ''} ${usage.attached_by?.lastName || ''}`.trim()
      }));

      return res.status(400).json({
        success: false,
        message: `Cannot delete form. It is currently attached to ${activeUsages.length} active task(s)/subtask(s). Please unlink the form from all tasks before deletion.`,
        data: {
          active_usage_count: activeUsages.length,
          dependencies: dependencies,
          action_required: "Unlink form from all listed tasks/subtasks before deleting"
        }
      });
    }

    // ✅ No active usage - safe to delete
    const deletedForm = await FormTemplate.findOneAndDelete({
      form_id: form_id,
    });

    // ✅ Also delete all versions for this form (cleanup)
    await FormVersion.deleteMany({ form_id: form_id });

    console.log(`🗑️  FORM DELETED: ${req.user.email} deleted form ${form.title} (${form_id})`);

    res.status(200).json({
      success: true,
      message: "Form deleted successfully",
      data: {
        form_id: deletedForm._id,
        title: deletedForm.title,
        deleted_versions: await FormVersion.countDocuments({ form_id: form_id })
      },
    });
  } catch (error) {
    console.error("❌ Error deleting form:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting form",
      error: error.message,
    });
  }
};


/**
 * @desc Clone an existing form template
 * @route POST /api/forms/clone/:form_id
 * @access Private
 */
export const cloneFormTemplate = async (req, res) => {
  try {
    const { form_id } = req.params;
    const userId = req.user.id;

    // 1️⃣ Find existing form owned by the user
    const existingForm = await FormTemplate.findOne({
      form_id: form_id,
      owner_user_id: userId,
    });

    if (!existingForm) {
      return res.status(404).json({ message: "Form not found" });
    }

    // 2️⃣ Convert to plain object
    const formData = existingForm.toObject();

    // 3️⃣ Clean unnecessary fields
    delete formData._id;
    delete formData.form_id;
    delete formData.form_code;
    delete formData.created_at;
    delete formData.updated_at;
    delete formData.current_version_id;

    // Clean external submission fields (clone should not copy external tokens)
    delete formData.external_token;
    delete formData.external_password;
    delete formData.external_submission_enabled;

    // 4️⃣ Ensure all fields have field_code
    if (formData.fields && formData.fields.length > 0) {
      formData.fields = formData.fields.map((field, index) => {
        if (!field.field_code) {
          // Generate field_code from label or use index
          const baseCode = field.label
            ? field.label.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20)
            : `field_${index + 1}`;
          field.field_code = `${baseCode}_${Date.now()}_${index}`;
          console.log(`⚠️ Generated field_code for cloned field: ${field.field_code}`);
        }
        // Display-only fields (Section Title, Read-only Label) cannot be required
        if (['title', 'label'].includes(field.type)) {
          field.isRequired = false;
          field.required = false;
        }
        return field;
      });
    }

    // 5️⃣ Generate new form_code
    const newFormCode = await generateUniqueCode("FORM");

    // 6️⃣ Find how many copies already exist
    const baseTitle = existingForm.title.replace(/\s*\(Copy.*\)$/i, ""); // remove old "(Copy n)" suffix if any

    const existingCopiesCount = await FormTemplate.countDocuments({
      owner_user_id: userId,
      title: new RegExp(`^${baseTitle}\\s*\\(Copy`, "i"),
    });

    const copyNumber = existingCopiesCount + 1;
    const newTitle = `${baseTitle} (Copy ${copyNumber})`;

    // 7️⃣ Create new form
    const clonedForm = new FormTemplate({
      ...formData,
      form_code: newFormCode,
      title: newTitle,
      status: "DRAFT",
      external_submission_enabled: false, // Reset external submission for clones
      external_token: null,
      external_password: null,
    });

    await clonedForm.save();

    // ✅ Audit Log: Form Cloned (Spec 5.12)
    await auditLogger.logFormCloned(existingForm, clonedForm, req.user, req);

    res.status(201).json({
      message: "Form cloned successfully",
      clonedForm,
    });
  } catch (error) {
    console.error("Error cloning form:", error);
    res.status(500).json({
      message: "Failed to clone form",
      error: error.message,
    });
  }
};


/**
 * @desc Publish a new version of a form
 * @route POST /api/forms/:form_id/versions
 * @access Private (Owner or Admin only)
 * 
 * CRITICAL FEATURE: Implements proper versioning system
 * Spec: "publish creates a version; publishing collects release_notes, start/end date, visibility"
 */
/**
 * @desc Publish Form Version (Section 5.8)
 * @route POST /api/forms/:form_id/versions
 * @access Private (Owner, Company Admin)
 * 
 * Publishing rules:
 * - Collects release_notes, start_date, end_date, visibility, external_submission_enabled
 * - Creates form_versions entry, increments version number
 * - Generates secure tokenized URL if external enabled
 * - Optional password protection
 * - Notifies owners & admins
 */
export const publishFormVersion = async (req, res) => {
  try {
    // ✅ Extract params and user ID FIRST before using them
    const { form_id } = req.params;
    const userId = req.user.id;

    // Permission check: Only Owner, Org Admin, or Super Admin can publish
    // Editors cannot publish (per requirements)
    const userRoles = req.user.role || [];

    // Find the form to check owner
    let form = await FormTemplate.findById(form_id);
    if (!form) {
      console.log(`🔍 Form not found by _id (${form_id}), trying form_id field...`);
      form = await FormTemplate.findOne({ form_id: form_id });
    }
    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    const isOwner = form.owner_user_id?.toString() === userId.toString();
    const isOrgAdmin = userRoles.includes('org_admin');
    const isSuperAdmin = userRoles.includes('super_admin');
    // Check if user is only an editor (shared_with role)
    let isEditor = false;
    if (!isOwner && !isOrgAdmin && !isSuperAdmin) {
      if (form.shared_with && Array.isArray(form.shared_with)) {
        isEditor = form.shared_with.some(sw => sw.user_id?.toString() === userId.toString() && sw.role === 'EDITOR');
      }
    }
    // Enforce restrictPublishToOwner governance (Spec 5.2 / 5.8)
    // When enabled, only owner/admin/superadmin can publish. When disabled, editors can also publish.
    if (isEditor && form.restrictPublishToOwner) {
      return res.status(403).json({
        success: false,
        message: "Publishing is restricted to the form owner only. This form has 'Restrict Publishing to Owner Only' enabled.",
      });
    }
    // If user is neither owner, admin, superadmin, nor editor — block
    if (!isOwner && !isOrgAdmin && !isSuperAdmin && !isEditor) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to publish this form.",
      });
    }
    const {
      release_notes = "",
      start_at = null,
      end_at = null,
      visibility = "PRIVATE",
      scope = "INTERNAL",
      external_submission_enabled = false,
      external_password = null,
      require_captcha = false,
      timezone = "UTC",
    } = req.body;

    // ✅ Validate release notes (required)
    if (!release_notes || release_notes.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Release notes are required for publishing",
      });
    }

    // ✅ Validate form has fields
    if (!form.fields || form.fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot publish form without fields. Add at least one field.",
      });
    }

    // ✅ Get next version number
    // Log require_captcha value for debugging
    console.log('🔍 [Publish] require_captcha:', require_captcha);
    const version_number = await FormVersion.getNextVersionNumber(form_id);

    // ✅ Create snapshot of current form
    const snapshot_data = {
      title: form.title,
      description: form.description,
      fields: form.fields,
      settings: form.settings,
      category_id: form.category_id,
      tags: form.tags,
      visibility: visibility,
      scope: scope,
    };

    // ✅ Generate external token if needed (Section 5.8)
    let external_token = undefined; // Use undefined instead of null
    let external_url = undefined;
    let hashed_password = undefined;


    if (external_submission_enabled) {
      external_token = crypto.randomBytes(32).toString("hex");
      external_url = `${process.env.PRODUCTION_BASE_URL}/forms/public/${external_token}`;
      // external_url = `${'https://tasksetu.shrawantravels.com' || 'https://tasksetu.shrawantravels.com'}/forms/public/${external_token}`;

      console.log('🔑 External submission enabled - Generated token:', external_token);

      // Hash password if provided
      if (external_password) {
        const bcrypt = await import('bcrypt');
        hashed_password = await bcrypt.hash(external_password, 10);
        console.log('🔒 External password hashed');
      }
    } else {
      console.log('📝 Creating version without external_token (internal form)');
    }

    // ✅ Create new version - only include external fields if enabled
    const versionData = {
      form_id: form_id,
      form_template_id: form._id,
      version_number,
      snapshot_data,
      release_notes,
      published_by: userId,
      published_at: new Date(),
      start_at,
      end_at,
      external_submission_enabled,
      require_captcha,
      timezone,
      status: "ACTIVE",
    };

    // Only add external fields if they exist
    if (external_submission_enabled && external_token) {
      versionData.external_token = external_token;
      versionData.external_url = external_url;
      if (hashed_password) {
        versionData.external_password = hashed_password;
      }
    }

    console.log('📦 Creating FormVersion:', {
      version_number,
      external_submission_enabled,
      has_external_token: !!external_token,
      form_id: form_id
    });

    const newVersion = new FormVersion(versionData);

    try {
      await newVersion.save();
      console.log('✅ FormVersion saved successfully:', newVersion._id);
    } catch (saveError) {
      console.error('❌ Error saving FormVersion:', saveError.message);
      if (saveError.code === 11000) {
        console.error('💥 Duplicate key error on:', saveError.keyValue);
        console.error('🔍 This usually means:');
        console.error('   - Multiple versions with external_token: null (non-sparse index issue)');
        console.error('   - Run: node fix-external-token-index.js to fix the index');
      }
      throw saveError;
    }

    // ✅ Update form template (Section 5.8 - Status transition to PUBLISHED)
    // Ensure all fields have field_code (fix for legacy forms)
    if (form.fields && form.fields.length > 0) {
      form.fields = form.fields.map((field, index) => {
        if (!field.field_code) {
          // Generate field_code from label or use index
          const baseCode = field.label
            ? field.label.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20)
            : `field_${index + 1}`;
          field.field_code = `${baseCode}_${Date.now()}_${index}`;
          console.log(`⚠️ Generated missing field_code: ${field.field_code} for field: ${field.label}`);
        }
        return field;
      });
    }

    form.status = "PUBLISHED";
    form.current_version_id = newVersion._id;
    form.visibility = visibility;
    form.scope = scope;
    form.start_at = start_at;
    form.end_at = end_at;
    form.external_submission_enabled = external_submission_enabled;
    form.external_token = external_token;
    form.external_password = hashed_password;
    form.require_captcha = require_captcha;
    form.timezone = timezone;

    try {
      await form.save();
      console.log('✅ Form template updated successfully');
    } catch (saveError) {
      console.error('❌ Error saving form template:', saveError.message);
      console.error('Form fields:', JSON.stringify(form.fields, null, 2));
      throw new Error(`Failed to update form template: ${saveError.message}`);
    }

    // ✅ Send notifications to owners & admins (Section 5.8)
    try {
      const { User } = await import('../modals/userModal.js');
      const { NotificationService } = await import('../services/notificationService.js');

      // Get form owner
      const owner = await User.findById(form.owner_user_id);

      // Get company admins
      const companyAdmins = await User.find({
        organizationId: owner?.organizationId,
        role: { $in: ['org_admin'] }
      });

      const relatedEntity = {
        entity_type: 'form',
        entity_id: form._id
      };

      // Notify owner
      if (owner && owner._id.toString() !== userId.toString()) {
        await NotificationService.createNotification({
          user_id: owner._id,
          trigger_event: 'form_published',
          related_entity: relatedEntity,
          title: 'Form Published',
          message: `${form.title} has been published as version ${version_number}`,
          metadata: {
            form_id: form.form_id,
            version_number,
            external_url: external_url || null,
          }
        });
      }

      // Notify admins
      for (const admin of companyAdmins) {
        if (admin._id.toString() !== userId.toString()) {
          await NotificationService.createNotification({
            user_id: admin._id,
            trigger_event: 'form_published',
            related_entity: relatedEntity,
            title: 'Form Published',
            message: `${req.user.email} published ${form.title} (v${version_number})`,
            metadata: {
              form_id: form.form_id,
              version_number,
            }
          });
        }
      }
    } catch (notifError) {
      console.warn('⚠️ Failed to send publish notifications:', notifError.message);
      // Don't fail the publish operation if notifications fail
    }

    // ✅ Audit log (Spec 5.12)
    console.log(`📢 FORM PUBLISHED: ${req.user.email} published form ${form.title} as v${version_number}${external_url ? ' with external URL' : ''}`);
    await auditLogger.logFormPublished(form, newVersion, req.user, req);

    // Log external link generation if enabled
    if (external_submission_enabled) {
      await auditLogger.logExternalLinkGenerated(form, newVersion, req.user, req);
    }

    // ✅ Populate response
    await newVersion.populate("published_by", "firstName lastName email");

    res.status(201).json({
      success: true,
      message: `Form published successfully as version ${version_number}`,
      data: {
        version_id: newVersion._id,
        version_number,
        form_id: form.form_id,
        form_title: form.title,
        published_at: newVersion.published_at,
        external_url: external_url,
        password_protected: !!hashed_password,
      },
    });
  } catch (error) {
    console.error("❌ Error publishing form version:", error);
    res.status(500).json({
      success: false,
      message: "Error publishing form",
      error: error.message,
    });
  }
};


/**
 * @desc Unpublish Form (Section 5.8)
 * @route POST /api/forms/:form_id/unpublish
 * @access Private (Owner, Company Admin only)
 * 
 * Unpublish: transition PUBLISHED → DRAFT
 * - Rare operation, audit logged and potentially blocked
 * - Blocked if form has active usage (attached to tasks/subtasks)
 * - Only OWNER, ORG_ADMIN, SUPER_ADMIN can unpublish
 * - Requires reason for audit trail
 * 
 * Blocking Rules:
 * 1. Cannot unpublish if form is attached to active tasks/subtasks
 * 2. Cannot unpublish if form has pending/in-progress submissions
 * 3. Can force unpublish with force=true (OWNER/ADMIN only, heavily logged)
 */
export const unpublishForm = async (req, res) => {
  try {
    const { form_id } = req.params;
    const { reason = "", force = false } = req.body;
    const userId = req.user.id;
    const userRoles = req.user.role || [];

    // Validate reason is provided (required for audit)
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Reason is required for unpublishing a form (for audit trail)",
      });
    }

    // ✅ Find form (try _id first, then form_id field)
    let form = await FormTemplate.findById(form_id);
    if (!form) {
      form = await FormTemplate.findOne({ form_id: form_id });
    }

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    // ✅ Check if already DRAFT
    if (form.status === "DRAFT") {
      return res.status(400).json({
        success: false,
        message: "Form is already in DRAFT status",
        currentStatus: form.status,
      });
    }

    // ✅ Check if form is ARCHIVED (cannot unpublish archived forms)
    if (form.status === "ARCHIVED") {
      return res.status(400).json({
        success: false,
        message: "Cannot unpublish an archived form. Archive status is final.",
        currentStatus: form.status,
        hint: "Archived forms are preserved for historical purposes and cannot be modified.",
      });
    }

    // ✅ Check active usage - forms attached to tasks/subtasks
    const activeUsage = await FormUsage.countDocuments({
      form_id: form_id,
      status: "ACTIVE",
    });

    // ✅ Check for pending/in-progress submissions
    const pendingSubmissions = await FormSubmission.countDocuments({
      form_id: form_id,
      status: { $in: ["PENDING", "IN_PROGRESS"] },
    });

    // ✅ Collect dependency information for detailed response
    let dependencies = [];
    if (activeUsage > 0) {
      const usageRecords = await FormUsage.find({
        form_id: form_id,
        status: "ACTIVE",
      })
        .populate("task_id", "title status")
        .populate("subtask_id", "title status")
        .limit(10);

      dependencies = usageRecords.map(usage => ({
        type: usage.attached_to_type,
        task_id: usage.task_id?._id,
        task_title: usage.task_id?.title,
        task_status: usage.task_id?.status,
        subtask_id: usage.subtask_id?._id,
        subtask_title: usage.subtask_id?.title,
        subtask_status: usage.subtask_id?.status,
        attached_at: usage.attached_at,
        attached_by: usage.attached_by,
      }));
    }

    // ✅ BLOCKING LOGIC: Prevent unpublish if active dependencies exist
    if ((activeUsage > 0 || pendingSubmissions > 0) && !force) {
      console.warn(`⚠️  UNPUBLISH BLOCKED: Form ${form_id} has ${activeUsage} active usage(s) and ${pendingSubmissions} pending submission(s)`);

      return res.status(409).json({
        success: false,
        message: "Cannot unpublish form due to active dependencies",
        blockingReasons: {
          activeUsage: activeUsage > 0,
          pendingSubmissions: pendingSubmissions > 0,
        },
        details: {
          active_usage_count: activeUsage,
          pending_submissions_count: pendingSubmissions,
          dependencies: dependencies,
        },
        hint: "Unlink the form from all tasks/subtasks before unpublishing, or use force=true (requires Owner/Admin)",
        actions: [
          "Unlink form from tasks/subtasks",
          "Wait for pending submissions to complete",
          "Use force=true to override (requires Owner/Admin, heavily audited)",
        ],
      });
    }

    // ✅ FORCE UNPUBLISH: Only OWNER, ORG_ADMIN, SUPER_ADMIN can force
    if (force) {
      const isOwner = form.owner_user_id.toString() === userId.toString();
      const isCompanyAdmin = userRoles.includes('org_admin');
      const isTasksetuAdmin = userRoles.includes('super_admin');

      if (!isOwner && !isCompanyAdmin && !isTasksetuAdmin) {
        return res.status(403).json({
          success: false,
          message: "Force unpublish requires Owner, Company Admin, or Platform Admin permissions",
          userRole: req.userRole || 'UNKNOWN',
        });
      }

      console.warn(`🚨 FORCE UNPUBLISH: ${req.user.email} force-unpublishing form ${form.title} with ${activeUsage} active usage(s)`);
    }

    // ✅ Update status to DRAFT
    const previousStatus = form.status;
    form.status = "DRAFT";

    // Clear external submission settings when unpublishing
    if (form.external_submission_enabled) {
      form.external_submission_enabled = false;
      // Note: We keep external_token for historical reference but disable it
      console.log(`🔒 Disabled external submissions for unpublished form ${form_id}`);
    }

    await form.save();

    // ✅ Audit log (Spec 5.12) - Enhanced logging for force unpublish
    const auditMessage = force
      ? `🚨 FORCE UNPUBLISH: ${req.user.email} force-unpublished form ${form.title} (${previousStatus} → DRAFT). Active usage: ${activeUsage}, Pending submissions: ${pendingSubmissions}. Reason: ${reason}`
      : `🔄 FORM UNPUBLISHED: ${req.user.email} unpublished form ${form.title} (${previousStatus} → DRAFT). Reason: ${reason}`;

    console.log(auditMessage);
    await auditLogger.logFormUnpublished(form, req.user, req, reason, {
      force,
      previousStatus,
      activeUsage,
      pendingSubmissions,
      dependencies: dependencies.length,
    });

    res.status(200).json({
      success: true,
      message: force
        ? "Form force-unpublished successfully. Status changed to DRAFT. Active dependencies remain but form is now unpublished."
        : "Form unpublished successfully. Status changed to DRAFT.",
      data: {
        form_id: form.form_id,
        form_title: form.title,
        previous_status: previousStatus,
        current_status: form.status,
        active_usage_count: activeUsage,
        pending_submissions_count: pendingSubmissions,
        forced: force,
        external_submissions_disabled: form.external_submission_enabled === false,
      },
      warnings: force ? [
        `Form has ${activeUsage} active attachments that will remain linked`,
        `Form has ${pendingSubmissions} pending submissions`,
        "Users may experience issues with linked tasks/subtasks",
      ] : [],
    });
  } catch (error) {
    console.error("❌ Error unpublishing form:", error);
    res.status(500).json({
      success: false,
      message: "Error unpublishing form",
      error: error.message,
    });
  }
};


/**
 * @desc Archive Form (Section 5.8)
 * @route POST /api/forms/:form_id/archive
 * @access Private (Owner, Company Admin)
 * 
 * Archive: prevents new attachments/submissions
 * - Historical submissions remain accessible
 * - Cannot be attached to new tasks
 */
export const archiveForm = async (req, res) => {
  try {
    const { form_id } = req.params;
    const { reason = "" } = req.body;
    const userId = req.user.id;

    // ✅ Find form (try _id first, then form_id field)
    let form = await FormTemplate.findById(form_id);
    if (!form) {
      form = await FormTemplate.findOne({ form_id: form_id });
    }

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    // ✅ Check if already ARCHIVED
    if (form.status === "ARCHIVED") {
      return res.status(400).json({
        success: false,
        message: "Form is already archived",
      });
    }

    // ✅ Update status
    const previousStatus = form.status;
    form.status = "ARCHIVED";
    await form.save();

    // ✅ Audit log (Spec 5.12)
    console.log(`📦 FORM ARCHIVED: ${req.user.email} archived form ${form.title} (${previousStatus} → ARCHIVED). Reason: ${reason || 'Not provided'}`);
    await auditLogger.logFormArchived(form, req.user, req, reason);

    res.status(200).json({
      success: true,
      message: "Form archived successfully. New attachments and submissions are now blocked.",
      data: {
        form_id: form.form_id,
        previous_status: previousStatus,
        current_status: form.status,
      },
    });
  } catch (error) {
    console.error("❌ Error archiving form:", error);
    res.status(500).json({
      success: false,
      message: "Error archiving form",
      error: error.message,
    });
  }
};


/**
 * @desc Delete Form Template (Section 5.8)
 * @route DELETE /api/forms/:form_id
 * @access Private (Owner, Platform Admin only)
 * 
 * Deletion rules:
 * - Only Owner or Platform Admin can delete
 * - Blocked if active form_usage exists (linked to incomplete tasks)
 * - Shows dependency list, requires unlinking first
 */
export const deleteFormTemplate = async (req, res) => {
  try {
    const { form_id } = req.params;
    const userId = req.user.id;
    const userRoles = req.user.role || [];

    // ✅ Find form (try _id first, then form_id field)
    let form = await FormTemplate.findById(form_id);
    if (!form) {
      form = await FormTemplate.findOne({ form_id: form_id });
    }

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    // ✅ Check permissions (Owner, Org Admin from same org, or Platform Admin)
    const isOwner = form.owner_user_id.toString() === userId.toString();
    const isPlatformAdmin = userRoles.includes('super_admin');
    const isCompanyAdmin = userRoles.includes('org_admin');

    // Get user's organization for org_admin check
    const { User } = await import('../modals/userModal.js');
    const currentUser = await User.findById(userId).populate('organization_id');
    const userOrgId = currentUser?.organization_id || currentUser?.organizationId;

    // Populate form owner to check organization
    await form.populate('owner_user_id', 'organizationId organization_id');
    const formOwnerOrgId = form.owner_user_id?.organizationId || form.owner_user_id?.organization_id;

    // Check if org_admin is from same organization
    const isCompanyAdminWithOrgAccess = isCompanyAdmin && userOrgId && formOwnerOrgId &&
      userOrgId.toString() === formOwnerOrgId.toString();

    if (!isOwner && !isPlatformAdmin && !isCompanyAdminWithOrgAccess) {
      return res.status(403).json({
        success: false,
        message: "Only form owner, company admin, or platform admin can delete this form",
        permission_required: "OWNER, ORG_ADMIN (same org), or PLATFORM_ADMIN",
      });
    }

    // Log if org_admin is deleting
    if (isCompanyAdminWithOrgAccess && !isOwner) {
      console.log(`⚠️  COMPANY ADMIN DELETE: ${req.user.email} deleting form ${form_id}`);
    }

    // ✅ Check for active usage (Section 5.8 - Block deletion if active linked processes)
    const activeUsages = await FormUsage.find({
      form_id: form_id,
      status: "ACTIVE",
    }).populate('subtask_id', 'title status');

    if (activeUsages.length > 0) {
      // Get dependency details
      const dependencies = activeUsages.map(usage => ({
        subtask_id: usage.subtask_id?._id,
        subtask_title: usage.subtask_id?.title || 'Unknown',
        subtask_status: usage.subtask_id?.status || 'Unknown',
        attached_at: usage.attached_at,
        form_version: usage.metadata?.form_version_number,
      }));

      return res.status(409).json({
        success: false,
        message: "Cannot delete form - it is actively linked to tasks. Please unlink from all tasks first.",
        reason: "ACTIVE_DEPENDENCIES",
        dependency_count: activeUsages.length,
        dependencies: dependencies,
        hint: "Unlink the form from all listed tasks before attempting deletion.",
      });
    }

    // ✅ Check for any submissions (warn but don't block)
    const submissionCount = await FormSubmission.countDocuments({
      form_id: form_id,
    });

    if (submissionCount > 0) {
      console.warn(`⚠️  DELETE WARNING: Form ${form_id} has ${submissionCount} submissions that will be preserved`);
    }

    // ✅ Soft delete approach: Update status instead of hard delete
    // This preserves historical data and submissions
    form.status = "ARCHIVED";
    form.deleted_at = new Date();
    form.deleted_by = userId;
    await form.save();

    // ✅ Audit log (Spec 5.12)
    console.log(`🗑️  FORM DELETED: ${req.user.email} deleted form ${form.title} (${form_id}). Submissions preserved: ${submissionCount}`);
    await auditLogger.logFormDeleted(form, req.user, req, submissionCount);

    res.status(200).json({
      success: true,
      message: "Form deleted successfully. Historical submissions are preserved.",
      data: {
        form_id: form.form_id,
        form_title: form.title,
        submission_count: submissionCount,
        preservation_note: "Submissions remain accessible for audit purposes",
      },
    });
  } catch (error) {
    console.error("❌ Error deleting form:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting form",
      error: error.message,
    });
  }
};


/**
 * @desc Get all versions of a form
 * @route GET /api/forms/:form_id/versions
 * @access Private (Owner or Admin)
 */
export const getFormVersions = async (req, res) => {
  try {
    const { form_id } = req.params;
    const userId = req.user.id;

    console.log('📋 GET /api/forms/:form_id/versions called:', { form_id, userId });

    // ✅ Find form by _id first (matches URL param), then form_id field
    let form = await FormTemplate.findById(form_id);

    if (!form) {
      console.log('🔍 Form not found by _id, trying form_id field...');
      form = await FormTemplate.findOne({ form_id: form_id });
    }

    console.log('🔍 Form lookup result:', form ? `Found: ${form.title}` : 'Not found');

    if (!form) {
      console.log('❌ Form not found with ID:', form_id);
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    // Check if user has access (owner or admin)
    const userRoles = req.user.role || [];
    const isAdmin = userRoles.includes('super_admin') || userRoles.includes('org_admin');
    const isOwner = form.owner_user_id.toString() === userId.toString();

    if (!isOwner && !isAdmin) {
      console.log('🔒 Restricted form list for user (not owner/admin):', req.user.email);
      // Return a 200 with a restricted flag so frontend can render a placeholder
      return res.status(200).json({
        success: true,
        data: {
          total: 0,
          versions: [],
          restricted: true,
          form: {
            _id: form._id,
            form_id: form.form_id,
            title: form.title
          },
          message: "Restricted - you don't have access to view versions of this form"
        }
      });
    }

    // ✅ Fetch all versions - try both _id and form_id
    let versions = await FormVersion.find({ form_id: form_id })
      .sort({ version_number: -1 })
      .populate("published_by", "firstName lastName email")
      .select("-snapshot_data"); // Exclude large snapshot data from list

    // If no versions found with form_id, try with form_template_id
    if (versions.length === 0) {
      console.log('🔍 No versions found with form_id, trying form_template_id...');
      versions = await FormVersion.find({ form_template_id: form._id })
        .sort({ version_number: -1 })
        .populate("published_by", "firstName lastName email")
        .select("-snapshot_data");
    }

    console.log('✅ Found', versions.length, 'versions for form:', form.title);

    res.status(200).json({
      success: true,
      data: {
        total: versions.length,
        versions: versions,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching versions:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching versions",
      error: error.message,
    });
  }
};

/**
 * Get a specific form version by version ID
 * Used for form submissions to load schema
 */
export const getFormVersionById = async (req, res) => {
  try {
    const { version_id } = req.params;
    const userId = req.user.id;

    console.log('📋 GET /api/forms/versions/:version_id called:', { version_id, userId });

    // Find version by _id
    const version = await FormVersion.findById(version_id)
      .populate("published_by", "firstName lastName email");

    if (!version) {
      console.log('❌ Form version not found with ID:', version_id);
      return res.status(404).json({
        success: false,
        message: "Form version not found",
      });
    }

    // Find the form template to check permissions
    const form = await FormTemplate.findOne({
      $or: [
        { _id: version.form_template_id },
        { form_id: version.form_id }
      ]
    });

    if (!form) {
      console.log('❌ Form template not found for version');
      return res.status(404).json({
        success: false,
        message: "Form template not found",
      });
    }

    // Check if user has access
    const userRoles = req.user.role || [];
    const isAdmin = userRoles.includes('super_admin') || userRoles.includes('org_admin');
    const isOwner = form.owner_user_id.toString() === userId.toString();
    const isSharedUser = form.shared_with?.some(
      share => share.user_id.toString() === userId.toString()
    );

    // Check if user is assignee or contributor of a task that has this form attached
    const Task = (await import('../modals/taskModal.js')).default;
    const tasksWithForm = await Task.find({
      attached_form_version_id: version._id,
      organization_id: req.user.organization_id,
      isDeleted: { $ne: true }
    }).populate('assignedTo collaborators', '_id');

    console.log('📝 Tasks with form attached:', {
      formVersionId: version._id.toString(),
      tasksFound: tasksWithForm.length,
      taskDetails: tasksWithForm.map(t => ({
        taskId: t._id.toString(),
        assignedToId: t.assignedTo?._id?.toString(),
        collaborators: t.collaborators?.map(c => c._id.toString())
      })),
      currentUserId: userId.toString()
    });

    const isTaskAssignee = tasksWithForm.some(task =>
      task.assignedTo && task.assignedTo._id.toString() === userId.toString()
    );

    const isTaskContributor = tasksWithForm.some(task =>
      task.collaborators && task.collaborators.some(collab =>
        collab._id.toString() === userId.toString()
      )
    );

    console.log('🔐 Form access check:', {
      isOwner,
      isAdmin,
      isSharedUser,
      isTaskAssignee,
      isTaskContributor,
      tasksWithFormCount: tasksWithForm.length
    });

    if (!isOwner && !isAdmin && !isSharedUser && !isTaskAssignee && !isTaskContributor) {
      console.log('🔒 Restricted form version access for user:', req.user.email);
      // Return 200 + restricted flag so frontend can show a friendly placeholder
      return res.status(200).json({
        success: true,
        data: {
          restricted: true,
          form: {
            _id: form._id,
            form_id: form.form_id,
            title: form.title
          },
          message: "Restricted - You don't have access to this form version"
        }
      });
    }

    console.log('✅ Form version found:', version.version_number);

    res.status(200).json({
      success: true,
      data: {
        version: version,
        snapshot_data: version.snapshot_data,
        form_status: form.status, // ✅ Include form template status to check if ARCHIVED
        form_title: form.title,
        form_template_id: form._id // ✅ Template ObjectId for API calls (attach/unlink)
      },
    });
  } catch (error) {
    console.error("❌ Error fetching form version:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching form version",
      error: error.message,
    });
  }
};


/**
 * @desc Preview form validation without saving (P1 - Spec 5.10)
 * @route POST /api/forms/:form_id/preview
 * @access Private (Authenticated users only)
 * 
 * Validates form responses against the form schema without creating a submission.
 * Used for client-side preview and validation feedback before final submission.
 * PHASE I: Only validates fields, no auto-complete or workflow triggers.
 */
export const previewFormValidation = async (req, res) => {
  try {
    const { form_id } = req.params;
    const { responses, form_version_id } = req.body;

    if (!responses || typeof responses !== 'object') {
      return res.status(400).json({
        success: false,
        message: "Invalid request. 'responses' object is required.",
      });
    }

    // ✅ Find form
    const form = await FormTemplate.findOne({ form_id });
    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    // ✅ Get form version (specific version or latest published)
    let formVersion;
    if (form_version_id) {
      formVersion = await FormVersion.findById(form_version_id);
      if (!formVersion || formVersion.form_id.toString() !== form._id.toString()) {
        return res.status(404).json({
          success: false,
          message: "Form version not found",
        });
      }
    } else {
      // Get latest published version
      formVersion = await FormVersion.getLatestVersion(form_id);
      if (!formVersion) {
        // If no published version, use form's current fields (draft preview)
        formVersion = {
          snapshot_data: {
            fields: form.fields || []
          }
        };
      }
    }

    // ✅ Validate submission data (Phase I - no workflow triggers)
    const { validateFormSubmission } = await import('../utils/formValidation.js');

    const formForValidation = {
      fields: formVersion.snapshot_data?.fields || form.fields || []
    };

    const validation = validateFormSubmission(formForValidation, responses, req.user);

    // ✅ Return validation results
    if (!validation.valid) {
      // Convert errors to array format
      const errorArray = [];
      for (const [field_code, messages] of Object.entries(validation.errors)) {
        const field = formForValidation.fields.find(f => f.field_code === field_code);
        errorArray.push({
          field_code: field_code,
          field_label: field?.label || field_code,
          message: Array.isArray(messages) ? messages.join(', ') : messages,
          error_type: 'VALIDATION_ERROR'
        });
      }

      return res.status(200).json({
        success: true,
        valid: false,
        message: "Validation failed",
        errors: errorArray,
      });
    }

    // ✅ All validations passed
    return res.status(200).json({
      success: true,
      valid: true,
      message: "All validations passed. Form is ready to submit.",
      errors: [],
    });

  } catch (error) {
    console.error("❌ Error in form preview validation:", error);
    res.status(500).json({
      success: false,
      message: "Error validating form preview",
      error: error.message,
    });
  }
};


/**
 * @desc Submit a form response
 * @route POST /api/forms/:form_id/submit
 * @access Public (for external) or Private (for internal)
 * 
 * CRITICAL FEATURE: Handles form submissions with validation
 * Spec: "Server enforces conditional logic & validation, returns field-level errors"
 */
export const submitFormResponse = async (req, res) => {
  try {
    const { form_id } = req.params;
    const {
      submission_data,
      source = "DIRECT",
      source_task_id = null,
      source_subtask_id = null,
      external_token = null,
    } = req.body;

    const submittedBy = req.user?.id || null; // null for anonymous
    const sourceIp = req.ip || req.connection.remoteAddress;

    let form, formVersion;

    // ✅ Check if external submission
    if (external_token) {
      formVersion = await FormVersion.getByExternalToken(external_token);
      if (!formVersion) {
        return res.status(401).json({
          success: false,
          message: "Invalid or expired external token",
          error: "INVALID_TOKEN"
        });
      }

      // ✅ Token Expiry Enforcement (Spec 5.11 - P1 requirement)
      if (formVersion.isExternalTokenExpired()) {
        return res.status(410).json({
          success: false,
          message: "This form has expired and is no longer accepting submissions",
          error: "EXTERNAL_FORM_EXPIRED",
          expired_at: formVersion.end_at,
          hint: "Please contact the form owner for access to an updated version."
        });
      }

      form = formVersion.form_id;
    } else {
      // Internal submission - check form exists (try _id first, then form_id field)
      form = await FormTemplate.findById(form_id);
      if (!form) {
        form = await FormTemplate.findOne({ form_id: form_id });
      }
      if (!form) {
        return res.status(404).json({
          success: false,
          message: "Form not found",
        });
      }
      // Get latest version
      formVersion = await FormVersion.getLatestVersion(form_id);
      if (!formVersion) {
        return res.status(404).json({
          success: false,
          message: "No published version found for this form",
        });
      }
    }

    // ✅ Validate submission data against form schema (Spec 5.11 - Server-side validation with 422 errors)
    const { validateFormSubmission } = await import('../utils/formValidation.js');

    // Create a form-like object for validation
    const formForValidation = {
      fields: formVersion.snapshot_data.fields || []
    };

    const validation = validateFormSubmission(formForValidation, submission_data, req.user);

    // ✅ Return validation errors with field-level details (Spec 5.11)
    if (!validation.valid) {
      // Convert errors object to array format for consistent response
      const errorArray = [];
      for (const [field_code, messages] of Object.entries(validation.errors)) {
        const field = formForValidation.fields.find(f => f.field_code === field_code);
        errorArray.push({
          field_code: field_code,
          field_label: field?.label || field_code,
          message: Array.isArray(messages) ? messages.join(', ') : messages,
          error_type: 'VALIDATION_ERROR'
        });
      }

      return res.status(422).json({
        success: false,
        message: "Form validation failed. Please check the errors and try again.",
        errors: errorArray,
        hint: "Fix the highlighted fields and resubmit the form."
      });
    }

    // ✅ maxSubmissions enforcement (Spec - reject if limit reached)
    const maxSubmissions = formVersion.snapshot_data?.settings?.maxSubmissions;
    if (maxSubmissions && maxSubmissions > 0) {
      const currentCount = await FormSubmission.countDocuments({ form_id: form_id });
      if (currentCount >= maxSubmissions) {
        return res.status(403).json({
          success: false,
          message: `This form has reached its maximum submission limit (${maxSubmissions}).`,
          error: "MAX_SUBMISSIONS_REACHED"
        });
      }
    }

    // ✅ Process file uploads: save base64 to disk, replace with URL paths
    const formFields = formForValidation.fields;
    const fileAttachments = await processFileUploadsForSubmission(submission_data, formFields);

    // ✅ Create submission (base64 data already replaced with URL paths in submission_data)
    const submission = new FormSubmission({
      form_id: form_id,
      form_version_id: formVersion._id,
      submitted_by: submittedBy,
      submission_data_json: submission_data,
      source,
      source_task_id,
      source_subtask_id,
      external_token,
      source_ip: sourceIp,
      submitted_at: new Date(),
      status: "COMPLETED",
      attachments: fileAttachments,
    });

    await submission.save();

    // ✅ Audit Log: Form Submission (Spec 5.12)
    await auditLogger.logFormSubmission(form, submission, req.user || null, req);

    // ✅ Record submission in version
    await formVersion.recordSubmission();

    // ✅ If attached to task/subtask - trigger configured actions
    if (source_task_id || source_subtask_id) {
      const usage = await FormUsage.findOne({
        form_version_id: formVersion._id,
        $or: [
          { task_id: source_task_id },
          { subtask_id: source_subtask_id }
        ],
        status: "ACTIVE",
      });

      if (usage) {
        await usage.recordSubmission(submittedBy);

        // ✅ Update task/subtask submission status and ID
        const taskUpdateData = {
          form_submission_id: submission._id,
          form_submission_status: "SUBMITTED"
        };

        // Auto-complete task if configured
        if (usage.config?.auto_complete_task) {
          taskUpdateData.status = "COMPLETED";
        }

        // Auto-change status if configured
        if (usage.config?.auto_change_status && usage.config.auto_change_status !== "") {
          taskUpdateData.status = usage.config.auto_change_status;
        }

        // Update the task/subtask
        const taskId = source_subtask_id || source_task_id;
        await Task.updateOne(
          { _id: taskId },
          { $set: taskUpdateData }
        );

        // ✅ Send notification on form submission (Spec 5.8)
        try {
          const { NotificationService } = await import('../services/notificationService.js');
          const submitterName = req.user?.email || 'A user';

          // Notify form owner
          if (form.owner_user_id && form.owner_user_id.toString() !== submittedBy?.toString()) {
            await NotificationService.createNotification({
              user_id: form.owner_user_id,
              trigger_event: 'form_submitted',
              related_entity: { entity_type: 'form', entity_id: form._id },
              title: 'Form Submitted',
              message: `${submitterName} submitted a response to "${form.title}"`,
              metadata: {
                form_id: form.form_id || form._id,
                submission_id: submission._id,
                task_id: source_task_id || null,
                subtask_id: source_subtask_id || null,
              }
            });
          }
        } catch (notifError) {
          console.warn('⚠️ Failed to send submission notifications:', notifError.message);
        }
      }
    }

    res.status(201).json({
      success: true,
      message: "Form submitted successfully",
      data: {
        submission_id: submission._id,
        submitted_at: submission.submitted_at,
      },
    });
  } catch (error) {
    console.error("❌ Error submitting form:", error);
    res.status(500).json({
      success: false,
      message: "Error submitting form",
      error: error.message,
    });
  }
};


/**
 * @desc Submit public form (anonymous submission via external token)
 * @route POST /api/public/forms/:token/submit
 * @access Public (No authentication required)
 * 
 * Allows anyone with the external token link to submit form responses
 * Used for external/public form submissions
 */
export const submitPublicForm = async (req, res) => {
  try {
    const { token } = req.params;
    const { responses, submitted_by, captchaToken } = req.body;

    console.log('📝 Public form submission:', {
      token: token.substring(0, 20) + '...',
      responseFields: Object.keys(responses || {}),
      submitted_by
    });

    // Validate token and get form version
    const formVersion = await FormVersion.getByExternalToken(token);
    if (!formVersion) {
      return res.status(404).json({
        success: false,
        message: "Invalid form link. This form may have been deleted or the link has expired.",
        error: "INVALID_TOKEN"
      });
    }

    // Verify CAPTCHA if required
    if (formVersion.require_captcha) {
      if (!captchaToken || !isCaptchaTokenValid(captchaToken, token)) {
        return res.status(403).json({
          success: false,
          message: "CAPTCHA verification required. Please solve the CAPTCHA before submitting.",
          error: "CAPTCHA_REQUIRED"
        });
      }
      // Consume the token so it can't be reused
      consumeCaptchaToken(captchaToken);
    }

    console.log('🔍 FormVersion details:', {
      _id: formVersion._id,
      form_id: formVersion.form_id,
      form_template_id: formVersion.form_template_id,
      form_id_type: typeof formVersion.form_id,
      form_template_id_type: typeof formVersion.form_template_id,
      version_number: formVersion.version_number
    });

    // Check if external submissions are enabled
    if (!formVersion.external_submission_enabled) {
      return res.status(403).json({
        success: false,
        message: "This form is not accepting external submissions",
        error: "EXTERNAL_SUBMISSIONS_DISABLED"
      });
    }

    // Check if form is expired
    if (formVersion.isExternalTokenExpired()) {
      return res.status(410).json({
        success: false,
        message: "This form has expired and is no longer accepting submissions",
        error: "FORM_EXPIRED",
        expired_at: formVersion.end_at
      });
    }

    // Validate submission data
    const { validateFormSubmission } = await import('../utils/formValidation.js');

    const formForValidation = {
      fields: formVersion.snapshot_data.fields || []
    };

    const validation = validateFormSubmission(formForValidation, responses, null);

    if (!validation.valid) {
      const errorArray = [];
      for (const [field_code, messages] of Object.entries(validation.errors)) {
        const field = formForValidation.fields.find(f => f.field_code === field_code);
        errorArray.push({
          field_code: field_code,
          field_label: field?.label || field_code,
          message: Array.isArray(messages) ? messages.join(', ') : messages,
          error_type: 'VALIDATION_ERROR'
        });
      }

      return res.status(422).json({
        success: false,
        message: "Form validation failed. Please check the errors and try again.",
        errors: errorArray
      });
    }

    // ✅ allowAnonymous enforcement - reject if form doesn't allow anonymous submissions
    const allowAnonymous = formVersion.snapshot_data?.settings?.allowAnonymous;
    if (allowAnonymous === false) {
      return res.status(403).json({
        success: false,
        message: "This form does not allow anonymous submissions. Please log in to submit.",
        error: "ANONYMOUS_NOT_ALLOWED"
      });
    }

    // Create submission
    const sourceIp = req.ip || req.connection.remoteAddress;

    // Extract form_id - try form_template_id first (newer field), then form_id (legacy)
    // Might be populated object or ObjectId
    const formId = formVersion.form_template_id?._id || formVersion.form_template_id ||
      formVersion.form_id?._id || formVersion.form_id;

    if (!formId) {
      return res.status(500).json({
        success: false,
        message: "Internal error: Form reference missing",
        error: "MISSING_FORM_REFERENCE"
      });
    }

    // ✅ maxSubmissions enforcement (Spec - reject if limit reached)
    const maxSubmissions = formVersion.snapshot_data?.settings?.maxSubmissions;
    if (maxSubmissions && maxSubmissions > 0) {
      const currentCount = await FormSubmission.countDocuments({ form_id: formId });
      if (currentCount >= maxSubmissions) {
        return res.status(403).json({
          success: false,
          message: `This form has reached its maximum submission limit (${maxSubmissions}).`,
          error: "MAX_SUBMISSIONS_REACHED"
        });
      }
    }

    // ✅ Process file uploads: save base64 to disk, replace with URL paths
    const formFields = formForValidation.fields;
    const fileAttachments = await processFileUploadsForSubmission(responses, formFields);

    const submission = new FormSubmission({
      form_id: formId,
      form_version_id: formVersion._id,
      submitted_by: null, // Anonymous
      submission_data_json: responses,
      source: 'EXTERNAL',
      external_token: token,
      source_ip: sourceIp,
      submitted_at: new Date(),
      status: "COMPLETED",
      attachments: fileAttachments,
    });

    await submission.save();

    // Record submission in version
    await formVersion.recordSubmission();

    // Audit log
    const formTitle = formVersion.snapshot_data?.title ||
      formVersion.form_id?.title ||
      formVersion.form_template_id?.title ||
      'Untitled Form';
    console.log(`✅ Public form submitted: ${formTitle} (version ${formVersion.version_number})`);

    await auditLogger.logFormSubmission(
      { _id: formId, title: formTitle },
      submission,
      null, // Anonymous user
      req
    );

    // ✅ Send notification to form owner on public submission (Spec 5.8)
    try {
      const { NotificationService } = await import('../services/notificationService.js');
      const formTemplate = await FormTemplate.findById(formId);
      if (formTemplate?.owner_user_id) {
        await NotificationService.createNotification({
          user_id: formTemplate.owner_user_id,
          trigger_event: 'form_submitted',
          related_entity: { entity_type: 'form', entity_id: formId },
          title: 'Public Form Submitted',
          message: `An anonymous user submitted a response to "${formTitle}"`,
          metadata: {
            form_id: formTemplate.form_id || formId,
            submission_id: submission._id,
            source: 'EXTERNAL',
          }
        });
      }
    } catch (notifError) {
      console.warn('⚠️ Failed to send public submission notification:', notifError.message);
    }

    res.status(201).json({
      success: true,
      message: "Form submitted successfully",
      data: {
        submission_id: submission._id,
        submitted_at: submission.submitted_at,
      },
    });
  } catch (error) {
    console.error("❌ Error submitting public form:", error);
    res.status(500).json({
      success: false,
      message: "Error submitting form. Please try again.",
      error: error.message,
    });
  }
};


/**
 * @desc Get form responses/submissions
 * @route GET /api/forms/:form_id/responses
 * @access Private (Owner or Admin)
 * 
 * Supports pagination, filtering, and CSV export
 */
export const getFormResponses = async (req, res) => {
  try {
    const { form_id } = req.params;
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const format = req.query.format || "json"; // json or csv

    console.log('📊 getFormResponses called:', {
      form_id,
      userId,
      page,
      limit,
      format
    });

    // Filters
    const status = req.query.status;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    const submittedBy = req.query.submitted_by;

    // ✅ Check ownership - try both _id and form_id field (remove ownership check for now)
    let form = await FormTemplate.findById(form_id);

    console.log('🔍 FormTemplate lookup by _id result:', {
      searchId: form_id,
      found: !!form,
      formId: form?._id?.toString(),
      formFormId: form?.form_id?.toString()
    });

    // Fallback: try form_id field if not found by _id
    if (!form) {
      form = await FormTemplate.findOne({ form_id: form_id });
      console.log('🔍 FormTemplate lookup by form_id result:', {
        searchId: form_id,
        found: !!form,
        formId: form?._id?.toString(),
        formFormId: form?.form_id?.toString()
      });
    }

    // Maybe the ID passed is a FormVersion ID, try that
    if (!form) {
      const FormVersion = (await import('../modals/formVersionModal.js')).FormVersion;
      const formVersion = await FormVersion.findById(form_id);
      if (formVersion) {
        form = await FormTemplate.findById(formVersion.form_id);
        console.log('🔍 Found via FormVersion:', {
          versionId: form_id,
          formId: form?._id?.toString()
        });
      }
    }

    console.log('🔍 Form lookup result:', {
      formFound: !!form,
      formId: form?._id?.toString(),
      formFormId: form?.form_id?.toString(),
      formTitle: form?.title
    });

    if (!form) {
      console.log('❌ Form not found for ID:', form_id);
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    // ✅ Build query - try multiple scenarios
    // First, try with form._id (MongoDB _id)
    let query = { form_id: form._id };
    let total = await FormSubmission.countDocuments(query);

    console.log('📊 Query attempt 1 (form._id):', {
      query: JSON.stringify(query),
      total
    });

    // If no results, try with form.form_id (custom field)
    if (total === 0 && form.form_id) {
      query = { form_id: form.form_id };
      total = await FormSubmission.countDocuments(query);
      console.log('📊 Query attempt 2 (form.form_id):', {
        query: JSON.stringify(query),
        total
      });
    }

    // Add filters
    if (status) query.status = status;
    if (submittedBy) query.submitted_by = submittedBy;
    if (startDate || endDate) {
      query.submitted_at = {};
      if (startDate) query.submitted_at.$gte = new Date(startDate);
      if (endDate) query.submitted_at.$lte = new Date(endDate);
    }

    console.log('📊 Final query for form responses:', JSON.stringify(query, null, 2));

    // ✅ Get total count with final query
    total = await FormSubmission.countDocuments(query);

    console.log('📈 Total submissions found:', total);

    // ✅ Fetch submissions
    const submissions = await FormSubmission.find(query)
      .sort({ submitted_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("submitted_by", "firstName lastName email")
      .populate("form_version_id", "version_number snapshot_data");

    console.log(`📄 Found ${submissions.length} submissions for form ${form._id}`);

    // Get form fields for transformation
    let formFields = [];
    if (submissions.length > 0 && submissions[0].form_version_id?.snapshot_data?.fields) {
      formFields = submissions[0].form_version_id.snapshot_data.fields;
      console.log(`📋 Using ${formFields.length} fields for transformation`);
    }

    // Transform submissions to use labels instead of field_ids
    const transformedSubmissions = submissions.map(sub => {
      const subObj = sub.toObject();

      console.log('🔍 [ATTACHMENTS DEBUG] Submission:', {
        id: subObj._id,
        hasAttachments: !!subObj.attachments,
        attachmentsCount: subObj.attachments?.length || 0,
        attachments: subObj.attachments
      });

      if (formFields.length > 0) {
        const originalData = { ...subObj.submission_data_json };
        subObj.submission_data_json = transformFormDataToLabels(
          originalData,
          formFields
        );
        console.log('🔄 Transformed submission:', {
          submissionId: subObj._id,
          before: Object.keys(originalData).slice(0, 3),
          after: Object.keys(subObj.submission_data_json).slice(0, 3),
          attachmentsPreserved: subObj.attachments?.length || 0
        });
      }

      // ✅ Add file upload data to submission_data_json for display
      if (subObj.attachments && subObj.attachments.length > 0) {
        console.log('📎 [ATTACHMENTS DEBUG] Processing attachments for display');

        // Group attachments by field_id
        const attachmentsByField = {};
        subObj.attachments.forEach(att => {
          if (!attachmentsByField[att.field_id]) {
            attachmentsByField[att.field_id] = [];
          }
          attachmentsByField[att.field_id].push({
            filename: att.filename,
            file_path: att.file_path,
            file_size: att.file_size,
            mime_type: att.mime_type,
            uploaded_at: att.uploaded_at
          });
        });

        // Add to submission_data_json with field labels
        for (const [fieldId, files] of Object.entries(attachmentsByField)) {
          const field = formFields.find(f => f.field_code === fieldId);
          const fieldLabel = field ? field.label : fieldId;

          console.log(`  ✅ Adding ${files.length} file(s) to field "${fieldLabel}"`);

          // Store both by field_code and field_label for compatibility
          subObj.submission_data_json[fieldId] = files;
          if (field) {
            subObj.submission_data_json[fieldLabel] = files;
          }
        }

        console.log('✅ [ATTACHMENTS DEBUG] Final submission_data_json keys:', Object.keys(subObj.submission_data_json));
      }

      return subObj;
    });

    // ✅ CSV Export
    if (format === "csv") {
      // Flatten submission data for CSV
      const csvRows = [];
      const headers = ["Submission ID", "Submitted By", "Submitted At", "Status", "Version"];

      // Add dynamic field headers from first submission (now using labels)
      if (transformedSubmissions.length > 0) {
        const firstData = transformedSubmissions[0].submission_data_json;
        Object.keys(firstData).forEach(key => {
          headers.push(key);
        });
      }

      csvRows.push(headers.join(","));

      transformedSubmissions.forEach(sub => {
        const row = [
          sub._id,
          sub.submitted_by ? `${sub.submitted_by.firstName} ${sub.submitted_by.lastName}` : "Anonymous",
          sub.submitted_at.toISOString(),
          sub.status,
          sub.form_version_id?.version_number || "N/A",
        ];

        // Add field values
        if (headers.length > 5) {
          for (let i = 5; i < headers.length; i++) {
            const fieldKey = headers[i];
            const value = sub.submission_data_json[fieldKey];
            // Handle complex values (objects/arrays)
            const csvValue = typeof value === 'object' ? JSON.stringify(value) : (value || "");
            row.push(`"${csvValue}"`); // Quote values to handle commas
          }
        }

        csvRows.push(row.join(","));
      });

      const csvContent = csvRows.join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="form_responses_${form_id}_${Date.now()}.csv"`
      );
      return res.send(csvContent);
    }

    // ✅ JSON response
    res.status(200).json({
      success: true,
      data: {
        submissions: transformedSubmissions,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
          hasMore: page * limit < total,
        },
      },
    });
  } catch (error) {
    console.error("❌ Error fetching responses:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching responses",
      error: error.message,
    });
  }
};


/**
 * @desc Attach form to subtask
 * @route POST /api/forms/:form_id/attach-to-subtask
 * @access Private
 * 
 * CRITICAL FEATURE: Implements form attachment to tasks/subtasks
 * Spec: "system validates (must be PUBLISHED) → attach stores attached_form_version_id"
 */
/**
 * @desc Attach form to subtask (Phase I)
 * @route POST /api/forms/:form_id/attach-to-subtask
 * @access Private - Owner, Company Admin, Platform Admin only
 * 
 * Phase I Rules:
 * 1. One form per subtask (enforced)
 * 2. Only published forms (enforced)
 * 3. Version locking (form_version_id locked to subtask)
 * 4. Permissions: Owner, Company Admin can attach (checked by formACL middleware)
 * 5. Audit logging in FormUsage
 */
export const attachFormToSubtask = async (req, res) => {
  try {
    const { form_id } = req.params;
    const {
      subtask_id = null,
      task_id = null,
      form_version_id: requestedVersionId = null, // Specific version to attach
    } = req.body;
    let form_version_id = requestedVersionId; // Allow reassignment for latest version
    const userId = req.user.id;
    const userRoles = req.user.role || [];

    // ✅ Validate: Must have either subtask_id OR task_id
    if (!subtask_id && !task_id) {
      return res.status(400).json({
        success: false,
        message: "Either subtask_id or task_id is required",
      });
    }

    // Determine attachment type and target ID
    const isSubtaskAttachment = !!subtask_id;
    const attachmentType = isSubtaskAttachment ? "SUBTASK" : "TASK";
    const targetId = isSubtaskAttachment ? subtask_id : task_id;

    console.log(`📎 Attaching form to ${attachmentType}:`, { targetId, form_version_id });

    // ✅ Find form (try _id first, then form_id field)
    let form = await FormTemplate.findById(form_id);
    if (!form) {
      form = await FormTemplate.findOne({ form_id: form_id });
    }
    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    // ✅ If form_version_id is not provided, fetch the latest published version
    if (!form_version_id) {
      console.log(`📌 form_version_id is null, fetching latest version for form ${form._id}`);
      const latestVersion = await FormVersion.findOne({ form_id: form._id })
        .sort({ version_number: -1 });

      if (!latestVersion) {
        return res.status(404).json({
          success: false,
          message: "No published versions found for this form",
          hint: "Please ensure the form has at least one published version",
        });
      }

      form_version_id = latestVersion._id;
      console.log(`✅ Using latest version: ${latestVersion.version_number} (${form_version_id})`);
    }

    // ✅ CRITICAL: Check form is PUBLISHED (Phase I Rule #2)
    if (form.status !== "PUBLISHED") {
      return res.status(400).json({
        success: false,
        message: "Cannot attach DRAFT or ARCHIVED form. Only PUBLISHED forms can be attached.",
        hint: "Please publish the form first, then try attaching it.",
      });
    }

    // ✅ Get the specific version to attach (Phase I Rule #3 - Version Locking)
    // Try matching with both form_id param and form._id to handle both cases
    let formVersion = await FormVersion.findOne({
      _id: form_version_id,
      form_id: form_id,
    });

    // Fallback: try with form's actual _id if not found
    if (!formVersion) {
      formVersion = await FormVersion.findOne({
        _id: form_version_id,
        form_id: form._id,
      });
    }

    // Also try form_template_id field as additional fallback
    if (!formVersion) {
      formVersion = await FormVersion.findOne({
        _id: form_version_id,
        form_template_id: form._id,
      });
    }

    if (!formVersion) {
      console.error('❌ Form version not found:', {
        form_version_id,
        form_id_param: form_id,
        form_actual_id: form._id,
        form_form_id: form.form_id
      });
      return res.status(404).json({
        success: false,
        message: "Form version not found",
        debug: {
          requested_version_id: form_version_id,
          form_id_tried: [form_id, form._id.toString()],
          hint: "Make sure the version belongs to this form"
        }
      });
    }

    // Note: Removed expiration check - forms can be attached regardless of end_at date
    // Expiration only affects new form submissions, not attachments to tasks/subtasks

    // ✅ Check if task/subtask already has an active form (Phase I Rule #1 - One Form Per Task/Subtask)
    const existingUsage = await FormUsage.findOne({
      attached_to_type: attachmentType,
      attached_to_id: targetId,
      status: "ACTIVE",
    });

    if (existingUsage) {
      return res.status(400).json({
        success: false,
        message: `${attachmentType === 'TASK' ? 'Task' : 'Subtask'} already has an active form attached. Please unlink it first before attaching a new form.`,
        existing_form: {
          form_id: existingUsage.form_id,
          version_id: existingUsage.form_version_id,
          attached_at: existingUsage.attached_at,
        },
      });
    }

    // ✅ Verify task/subtask exists
    const targetTask = await Task.findById(targetId);
    if (!targetTask) {
      return res.status(404).json({
        success: false,
        message: `${attachmentType === 'TASK' ? 'Task' : 'Subtask'} not found`,
      });
    }

    // ✅ Create usage record (Phase I Rule #6 - Audit Logging)
    const usage = new FormUsage({
      form_id: form_id,
      form_version_id: formVersion._id,
      attached_to_type: attachmentType,
      attached_to_id: targetId,
      task_id: isSubtaskAttachment ? task_id : targetId, // Main task ID
      subtask_id: isSubtaskAttachment ? subtask_id : null,
      attached_by: userId,
      attached_at: new Date(),
      status: "ACTIVE",
      metadata: {
        form_title: form.title,
        form_version_number: formVersion.version_number,
        attached_by_email: req.user.email,
        attached_by_roles: userRoles,
        attachment_type: attachmentType,
      },
    });

    await usage.save();

    // ✅ Record usage in version
    await formVersion.recordUsage();

    // ✅ Update task/subtask with locked form version (Phase I Rule #3 - Version Locking)
    const updateResult = await Task.updateOne(
      { _id: targetId },
      {
        attached_form_version_id: formVersion._id,
        form_submission_status: "NOT_STARTED"
      }
    );

    if (updateResult.matchedCount === 0) {
      console.warn(`⚠️ ${attachmentType} ${targetId} not found in Task collection, but usage recorded`);
    }

    // ✅ Audit log (Spec 5.12)
    console.log(`📎 FORM ATTACHED: User ${req.user.email} attached form ${form.title} (v${formVersion.version_number}) to ${attachmentType.toLowerCase()} ${targetId}`);
    await auditLogger.logFormAttached(form, formVersion, { _id: targetId }, req.user, req);

    res.status(201).json({
      success: true,
      message: `Form attached to ${attachmentType.toLowerCase()} successfully`,
      data: {
        usage_id: usage._id,
        form_id: form.form_id,
        form_title: form.title,
        attachment_type: attachmentType,
        version_id: formVersion._id,
        version_number: formVersion.version_number,
        attached_at: usage.attached_at,
        locked: true, // Version is now locked to this subtask instance
        subtask_updated: updateResult.matchedCount > 0,
      },
    });
  } catch (error) {
    console.error("❌ Error attaching form:", error);
    res.status(500).json({
      success: false,
      message: "Error attaching form to subtask",
      error: error.message,
    });
  }
};


/**
 * @desc Unlink form from subtask (Phase I)
 * @route POST /api/forms/:form_id/unlink-from-subtask
 * @access Private - Owner, Company Admin, Platform Admin only
 * 
 * Phase I Rules:
 * 5. Unlinking: allowed only if form not yet submitted
 * 6. Unlinking keeps historical form_submissions read-only
 * 7. Audit logging
 */
export const unlinkFormFromSubtask = async (req, res) => {
  try {
    const { form_id } = req.params;
    const { subtask_id, reason = null } = req.body;
    const userId = req.user.id;
    const userRoles = req.user.role || [];

    // ✅ Validate required fields
    if (!subtask_id) {
      return res.status(400).json({
        success: false,
        message: "subtask_id is required",
      });
    }

    // ✅ Find active usage
    const usage = await FormUsage.findOne({
      form_id: form_id,
      attached_to_type: "SUBTASK",
      attached_to_id: subtask_id,
      status: "ACTIVE",
    });

    if (!usage) {
      return res.status(404).json({
        success: false,
        message: "No active form attachment found for this subtask",
      });
    }

    // ✅ Check if task/subtask process has started (Spec: "Unlinking blocked if process instance started")
    const subtask = await Task.findById(subtask_id);
    if (subtask) {
      const statusLower = (subtask.status || '').toLowerCase();
      // Block if task is not in initial state (anything other than OPEN)
      if (statusLower !== 'open') {
        return res.status(403).json({
          success: false,
          message: "Cannot unlink form - the task/process has already started. Unlinking is only allowed when the task is still in OPEN status.",
          rule: "PROCESS_INSTANCE_STARTED",
          data: {
            task_status: subtask.status,
            form_title: usage.metadata?.form_title,
          },
        });
      }
      // Block if form filling is in progress
      if (subtask.form_submission_status === 'IN_PROGRESS') {
        return res.status(403).json({
          success: false,
          message: "Cannot unlink form - form filling is already in progress.",
          rule: "FORM_IN_PROGRESS",
          data: {
            form_submission_status: subtask.form_submission_status,
            form_title: usage.metadata?.form_title,
          },
        });
      }
    }

    // ✅ Check if subtask has form submissions (Phase I Rule #5)
    const submissionCount = await FormSubmission.countDocuments({
      form_version_id: usage.form_version_id,
      subtask_id: subtask_id,
    });

    if (submissionCount > 0) {
      // Phase I: Block unlinking if form has been submitted
      // Submissions remain read-only in history
      return res.status(403).json({
        success: false,
        message: "Cannot unlink form - it has already been submitted. Submissions are kept as read-only history.",
        rule: "PHASE_I_UNLINK_RESTRICTION",
        data: {
          submission_count: submissionCount,
          form_title: usage.metadata?.form_title,
          version_number: usage.metadata?.form_version_number,
        },
      });
    }

    // ✅ Unlink the usage (Phase I Rule #6 - Keep audit trail)
    usage.status = "UNLINKED";
    usage.unlinked_at = new Date();
    usage.unlinked_by = userId;
    usage.unlink_reason = reason || "Form unlinked before submission";

    await usage.save();

    // ✅ Clear subtask form fields
    await Task.updateOne(
      { _id: subtask_id },
      {
        $unset: {
          attached_form_version_id: "",
        },
        $set: {
          form_submission_status: "NOT_STARTED",
        }
      }
    );

    // ✅ Audit log (Spec 5.12 - Phase I Rule #7)
    console.log(`🔓 FORM UNLINKED: User ${req.user.email} unlinked form ${usage.metadata?.form_title} from subtask ${subtask_id} (no submissions)`);

    // Create form object for audit logger
    const formForAudit = {
      _id: usage.form_id,
      title: usage.metadata?.form_title || 'Unknown Form',
      form_id: usage.form_id
    };
    const subtaskForAudit = { _id: subtask_id };

    await auditLogger.logFormUnlinked(formForAudit, subtaskForAudit, req.user, req, submissionCount > 0);

    res.status(200).json({
      success: true,
      message: "Form unlinked from subtask successfully",
      data: {
        unlinked_at: usage.unlinked_at,
        reason: usage.unlink_reason,
        submission_count: 0,
      },
    });
  } catch (error) {
    console.error("❌ Error unlinking form:", error);
    res.status(500).json({
      success: false,
      message: "Error unlinking form from subtask",
      error: error.message,
    });
  }
};

/**
 * Share form with another user (Grant permissions)
 * POST /api/forms/:form_id/share
 * Only OWNER can share forms
 */
export const shareForm = async (req, res) => {
  try {
    const { form_id } = req.params;
    const { user_id, role } = req.body; // role: EDITOR | VIEWER
    const owner_id = req.user.id;

    console.log('🔄 SHARE FORM REQUEST:', { form_id, user_id, role, owner_id: owner_id.toString() });

    // Validate role
    if (!['EDITOR', 'VIEWER'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be EDITOR or VIEWER'
      });
    }

    // Validate user_id
    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'user_id is required'
      });
    }

    // Check if user exists
    const { User } = await import('../modals/userModal.js');
    const targetUser = await User.findById(user_id);

    if (!targetUser) {
      console.error('❌ Target user not found:', user_id);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('✅ Target user found:', { _id: targetUser._id, email: targetUser.email });

    // Get form (already attached to req by ACL middleware)
    const form = req.form;

    console.log('📋 Form before share:', {
      form_id: form.form_id,
      title: form.title,
      owner: form.owner_user_id.toString(),
      shared_with_count: form.shared_with?.length || 0,
      shared_with: form.shared_with?.map(s => ({ user: s.user_id.toString(), role: s.role }))
    });

    // Prevent sharing with self
    if (form.owner_user_id.toString() === user_id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot share form with yourself (you are the owner)'
      });
    }

    // Add or update shared user
    const updatedForm = await form.addSharedUser(user_id, role, owner_id);

    console.log('✅ Form after share:', {
      form_id: updatedForm.form_id,
      shared_with_count: updatedForm.shared_with?.length || 0,
      shared_with: updatedForm.shared_with?.map(s => ({ user: s.user_id.toString(), role: s.role }))
    });

    // 📧 Send email notification to the user
    try {
      console.log('📧 Starting email notification process...');
      console.log('📧 Importing email service...');
      const { emailService } = await import('../services/emailService.js');
      console.log('✅ Email service imported successfully');

      // Get external token for VIEWER role (public link)
      let externalToken = null;
      if (role === 'VIEWER' && form.current_version_id) {
        console.log('🔍 Fetching external token for VIEWER role...');
        const { FormVersion } = await import('../modals/formVersionModal.js');
        const currentVersion = await FormVersion.findById(form.current_version_id);
        externalToken = currentVersion?.external_token || null;
        console.log('🔑 External token for VIEWER:', externalToken ? 'Found' : 'Not found');
      }

      // Re-import User model to ensure it's in scope for this block
      console.log('🔍 Fetching owner user details...');
      const { User: UserModel } = await import('../modals/userModal.js');
      const ownerUser = await UserModel.findById(owner_id);
      console.log('✅ Owner user fetched:', ownerUser ? ownerUser.email : 'Not found');

      console.log('📧 Preparing email parameters:', {
        recipientEmail: targetUser.email,
        recipientName: targetUser.firstName || targetUser.email,
        formTitle: form.title,
        formId: form.form_id,
        role: role,
        externalToken: externalToken
      });

      console.log('📧 Calling emailService.sendFormShareNotification...');
      const emailSent = await emailService.sendFormShareNotification({
        recipientEmail: targetUser.email,
        recipientName: targetUser.firstName || targetUser.email,
        formTitle: form.title,
        formId: form.form_id,
        role: role,
        sharedByName: ownerUser ? `${ownerUser.firstName || ''} ${ownerUser.lastName || ''}`.trim() || ownerUser.email : req.user.email,
        sharedByEmail: ownerUser?.email || req.user.email,
        externalToken: externalToken
      });
      console.log('📧 Email service returned:', emailSent);

      if (emailSent) {
        console.log(`📧 Email notification sent to ${targetUser.email}`);
      } else {
        console.warn(`⚠️  Failed to send email notification to ${targetUser.email}`);
      }
    } catch (emailError) {
      console.error('❌ Error sending email notification:', emailError);
      // Don't fail the request if email fails - form is already shared
    }

    res.status(200).json({
      success: true,
      message: `Form shared with ${targetUser.firstName || targetUser.email} as ${role}`,
      data: {
        form_id: form.form_id,
        shared_with_user: {
          user_id: targetUser._id,
          name: `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim(),
          email: targetUser.email,
          role: role
        }
      }
    });
  } catch (error) {
    console.error('❌ Error sharing form:', error);
    res.status(500).json({
      success: false,
      message: 'Error sharing form',
      error: error.message
    });
  }
};

/**
 * Unshare form (Remove user permissions)
 * DELETE /api/forms/:form_id/share/:user_id
 * Only OWNER can unshare
 */
export const unshareForm = async (req, res) => {
  try {
    const { form_id, user_id } = req.params;

    // Get form (already attached to req by ACL middleware)
    const form = req.form;

    // Check if user actually has access
    const hasAccess = form.shared_with.some(
      entry => entry.user_id.toString() === user_id.toString()
    );

    if (!hasAccess) {
      return res.status(404).json({
        success: false,
        message: 'User does not have access to this form'
      });
    }

    // Remove shared user
    await form.removeSharedUser(user_id);

    res.status(200).json({
      success: true,
      message: 'Form access removed successfully',
      data: {
        form_id: form.form_id,
        removed_user_id: user_id
      }
    });
  } catch (error) {
    console.error('❌ Error unsharing form:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing form access',
      error: error.message
    });
  }
};

/**
 * Get list of users who have access to the form
 * GET /api/forms/:form_id/shared-users
 * Owner can view who has access
 */
export const getSharedUsers = async (req, res) => {
  try {
    const { form_id } = req.params;

    // Get form (already attached to req by ACL middleware)
    const form = await FormTemplate.findOne({ form_id })
      .populate('owner_user_id', 'firstName lastName email')
      .populate('shared_with.user_id', 'firstName lastName email')
      .populate('shared_with.granted_by', 'firstName lastName email');

    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Form not found'
      });
    }

    // Format response
    const sharedUsers = form.shared_with.map(entry => ({
      user_id: entry.user_id._id,
      name: `${entry.user_id.firstName || ''} ${entry.user_id.lastName || ''}`.trim() || 'Unnamed User',
      firstName: entry.user_id.firstName,
      lastName: entry.user_id.lastName,
      email: entry.user_id.email,
      role: entry.role,
      granted_by: entry.granted_by ? {
        user_id: entry.granted_by._id,
        name: `${entry.granted_by.firstName || ''} ${entry.granted_by.lastName || ''}`.trim() || 'Unnamed User'
      } : null,
      granted_at: entry.granted_at
    }));

    res.status(200).json({
      success: true,
      data: {
        owner: {
          user_id: form.owner_user_id._id,
          name: `${form.owner_user_id.firstName || ''} ${form.owner_user_id.lastName || ''}`.trim() || 'Unnamed User',
          firstName: form.owner_user_id.firstName,
          lastName: form.owner_user_id.lastName,
          email: form.owner_user_id.email,
          role: 'OWNER'
        },
        shared_with: sharedUsers,
        total_shared: sharedUsers.length
      }
    });
  } catch (error) {
    console.error('❌ Error getting shared users:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving shared users',
      error: error.message
    });
  }
};


/**
 * @desc Search form library for published forms (P1 - Spec 5.10)
 * @route GET /api/form-library/search
 * @access Private (Authenticated users only)
 * 
 * Used by attachment picker to search published forms that can be attached to subtasks.
 * PHASE I: Only searches PUBLISHED forms (spec requirement - attach published-only).
 * ACL: Returns forms user has VIEW permission on (owned, shared, or org-wide).
 */
export const searchFormLibrary = async (req, res) => {
  try {
    const { q, category, page = 1, limit = 50 } = req.query;
    const userId = req.user.id;
    const userRoles = req.user.role || [];

    // Get user's organization for org-wide forms
    const { User } = await import('../modals/userModal.js');
    const currentUser = await User.findById(userId);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // ✅ PHASE I: Only PUBLISHED forms can be attached to subtasks
    const query = {
      status: 'PUBLISHED', // Phase I requirement - only published forms
    };

    // ✅ ACL Filtering - user can only see forms they have access to
    const isTasksetuAdmin = userRoles.includes('super_admin');
    const isCompanyAdmin = userRoles.includes('org_admin');

    if (!isTasksetuAdmin) {
      // Company admins see all org forms
      if (isCompanyAdmin && currentUser.organizationId) {
        const orgUsers = await User.find({
          organizationId: currentUser.organizationId
        }).select('_id');
        const orgUserIds = orgUsers.map(u => u._id);

        query.$or = [
          { owner_user_id: userId }, // Forms user owns
          { 'shared_with.user_id': userId }, // Forms shared with user
          { visibility: 'ORG', owner_user_id: { $in: orgUserIds } }, // Org-wide forms
        ];
      } else {
        // Regular users only see owned or shared forms
        query.$or = [
          { owner_user_id: userId },
          { 'shared_with.user_id': userId },
          { visibility: 'PUBLIC' }, // Public forms visible to all
        ];
      }
    }
    // Platform admins see all forms (no additional filters)

    // ✅ Text search (if query provided)
    if (q && q.trim()) {
      const searchRegex = new RegExp(q.trim(), 'i');
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { title: searchRegex },
          { description: searchRegex },
          { tags: searchRegex },
        ]
      });
    }

    // ✅ Category filter (string match)
    if (category && category.trim()) {
      query.category_id = { $regex: category.trim(), $options: 'i' };
    }

    // ✅ Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // ✅ Execute query
    const forms = await FormTemplate.find(query)
      .select('form_id title description category_id tags current_version_id visibility created_at')
      .populate('current_version_id', 'version_number published_at')
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await FormTemplate.countDocuments(query);

    // ✅ Format response for attachment picker
    const formattedForms = forms.map(form => ({
      form_id: form.form_id,
      title: form.title,
      description: form.description,
      category: form.category_id || null,
      tags: form.tags || [],
      current_version: form.current_version_id ? {
        version_id: form.current_version_id._id,
        version_number: form.current_version_id.version_number,
        published_at: form.current_version_id.published_at,
      } : null,
      visibility: form.visibility,
      created_at: form.created_at,
    }));

    res.status(200).json({
      success: true,
      data: {
        forms: formattedForms,
        total: total,
        page: parseInt(page),
        limit: parseInt(limit),
        total_pages: Math.ceil(total / parseInt(limit)),
      },
      hint: "Phase I: Only PUBLISHED forms are shown (spec requirement for subtask attachment)"
    });

  } catch (error) {
    console.error('❌ Error searching form library:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching form library',
      error: error.message,
    });
  }
};

/**
 * Helper: Transform form data from field_id keys to label keys
 */
const transformFormDataToLabels = (formData, fields) => {
  if (!formData || !fields) return formData;

  const transformed = {};
  for (const [fieldId, value] of Object.entries(formData)) {
    const field = fields.find(f => f.field_id === fieldId);
    const key = field?.label || fieldId; // Use label if found, otherwise keep field_id
    transformed[key] = value;
  }
  return transformed;
};

/**
 * Helper: Transform form data from label keys to field_id keys
 */
const transformFormDataToFieldIds = (formData, fields) => {
  if (!formData || !fields) return formData;

  const transformed = {};
  for (const [key, value] of Object.entries(formData)) {
    // Check if key is already a field_id
    const fieldById = fields.find(f => f.field_id === key);
    if (fieldById) {
      transformed[key] = value;
      continue;
    }

    // Try to find field by label
    const fieldByLabel = fields.find(f => f.label === key);
    if (fieldByLabel) {
      transformed[fieldByLabel.field_id] = value;
    } else {
      // Keep original key if no match found
      transformed[key] = value;
    }
  }
  return transformed;
};

/**
 * Create Form Submission (via form_version_id)
 * POST /api/forms/submissions
 * Allows creating submissions by providing form_version_id instead of form_id
 */
export const createFormSubmission = async (req, res) => {
  try {
    const {
      form_version_id,
      form_data,
      task_id,
      subtask_id,
      status = 'IN_PROGRESS'
    } = req.body;

    if (!form_version_id || !form_data) {
      return res.status(400).json({
        success: false,
        message: 'form_version_id and form_data are required'
      });
    }

    // Get form version to find form_id
    const formVersion = await FormVersion.findById(form_version_id);
    if (!formVersion) {
      return res.status(404).json({
        success: false,
        message: 'Form version not found'
      });
    }

    const formFields = formVersion.snapshot_data?.fields || [];

    // Transform incoming data from labels to field_ids (if needed)
    const normalizedFormData = transformFormDataToFieldIds(form_data, formFields);

    // ✅ MULTI-SUBMISSION SUPPORT: Removed unique constraint check
    // Users can now submit the same form multiple times with different data
    // Each submission is treated as a separate entry

    // Determine source
    let source = 'DIRECT';
    if (task_id) source = 'TASK';
    if (subtask_id) source = 'SUBTASK';

    // Get source IP
    const sourceIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      req.ip ||
      'unknown';

    // ✅ Process file uploads: save base64 to disk, replace with URL paths
    const fileAttachments = await processFileUploadsForSubmission(normalizedFormData, formFields);

    // Create submission (store with field_id keys internally, base64 replaced with URL paths)
    const submission = new FormSubmission({
      form_id: formVersion.form_id,
      form_version_id: form_version_id,
      submitted_by: req.user.id, // ✅ Fixed: use req.user.id (set by authenticateToken middleware)
      submission_data_json: normalizedFormData,
      source,
      source_task_id: task_id || null,
      source_subtask_id: subtask_id || null,
      source_ip: sourceIp,
      submitted_at: status === 'COMPLETED' ? new Date() : null,
      status: status,
      attachments: fileAttachments
    });

    await submission.save();

    // Update version submission count if completed
    if (status === 'COMPLETED') {
      await formVersion.recordSubmission();
    }

    // Update task/subtask if applicable
    if (task_id || subtask_id) {
      const Task = (await import('../modals/taskModal.js')).default;
      const targetId = subtask_id || task_id;

      await Task.findByIdAndUpdate(targetId, {
        form_submission_id: submission._id,
        form_submission_status: status === 'COMPLETED' ? 'SUBMITTED' : 'IN_PROGRESS'
      });
    }

    // Keep field_ids for form population (don't transform to labels)
    const responseData = submission.toObject();
    // Don't transform - frontend needs field_id keys
    // responseData.submission_data_json already has field_id keys from database

    res.status(201).json({
      success: true,
      message: `Form ${status === 'COMPLETED' ? 'submitted' : 'draft saved'} successfully`,
      data: responseData
    });

  } catch (error) {
    console.error('❌ Error creating form submission:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating form submission',
      error: error.message
    });
  }
};

/**
 * Update Form Submission
 * PUT /api/forms/submissions/:submission_id
 */
export const updateFormSubmission = async (req, res) => {
  try {
    const { submission_id } = req.params;
    const { form_data, status } = req.body;

    const submission = await FormSubmission.findById(submission_id)
      .populate('form_version_id')
      .populate('submitted_by', 'email firstName lastName');

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    // Normalize IDs for comparison
    const submittedById = submission.submitted_by?._id?.toString() || submission.submitted_by?.toString();
    const currentUserId = req.user.id?.toString?.() || req.user.id;

    // Check if user is org_admin
    const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
    const isOrgAdmin = userRoles.some(role =>
      ['org_admin', 'SUPER_ADMIN', 'tasksetu-admin'].includes(role)
    );

    // Permission check: Submitter can edit their own submission OR org_admin can edit any submission
    const isSubmitter = submittedById === currentUserId;
    const hasPermission = isSubmitter || isOrgAdmin;

    console.log('🔍 Update submission permission check:', {
      submissionId: submission_id,
      submittedBy: submittedById,
      currentUser: currentUserId,
      userRoles,
      isSubmitter,
      isOrgAdmin,
      hasPermission
    });

    if (!hasPermission) {
      console.log('❌ Permission denied - user can only edit their own submission');
      return res.status(403).json({
        success: false,
        message: 'You can only update your own submission'
      });
    }

    // Get form fields for transformation
    const formFields = submission.form_version_id?.snapshot_data?.fields || [];

    // Update fields
    if (form_data) {
      // Transform incoming data from labels to field_ids (if needed)
      const normalizedFormData = transformFormDataToFieldIds(form_data, formFields);
      submission.submission_data_json = normalizedFormData;
    }

    if (status) {
      submission.status = status;
      if (status === 'COMPLETED' && !submission.submitted_at) {
        submission.submitted_at = new Date();
      }
    }

    await submission.save();

    // Update task/subtask status
    if (submission.source_task_id || submission.source_subtask_id) {
      const Task = (await import('../modals/taskModal.js')).default;
      const targetId = submission.source_subtask_id || submission.source_task_id;

      await Task.findByIdAndUpdate(targetId, {
        form_submission_status: status === 'COMPLETED' ? 'SUBMITTED' : 'IN_PROGRESS'
      });
    }

    // Keep field_ids for form population (don't transform to labels)
    const responseData = submission.toObject();
    // Don't transform - frontend needs field_id keys
    // responseData.submission_data_json already has field_id keys from database

    res.json({
      success: true,
      message: `Form ${status === 'COMPLETED' ? 'submitted' : 'updated'} successfully`,
      data: responseData
    });

  } catch (error) {
    console.error('❌ Error updating form submission:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating form submission',
      error: error.message
    });
  }
};

/**
 * Get Form Submission by ID
 * GET /api/forms/submissions/:submission_id
 */
export const getFormSubmissionById = async (req, res) => {
  try {
    const { submission_id } = req.params;

    const submission = await FormSubmission.findById(submission_id)
      .populate('form_id', 'title')
      .populate('form_version_id', 'version_number snapshot_data')
      .populate('submitted_by', 'firstName lastName email');

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    // Check permission: Enhanced permission model
    // 1. Submitter can view their own submission
    // 2. Form creator can view all submissions
    // 3. org_admin/admin can view all submissions
    // 4. Task assignee can view all submissions for that task
    // 5. Task contributors can view their own submissions

    const form = await FormTemplate.findById(submission.form_id);

    // Handle both populated and non-populated submitted_by
    const submittedById = submission.submitted_by?._id?.toString() || submission.submitted_by?.toString();
    const currentUserId = req.user.id?.toString?.() || req.user.id;

    const isSubmitter = submittedById === currentUserId;
    const isFormOwner = form?.created_by?.toString() === currentUserId;

    // Handle both array and string role formats
    const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
    const isAdmin = userRoles.some(role =>
      ['SUPER_ADMIN', 'org_admin', 'admin', 'tasksetu-admin'].includes(role)
    );

    // Check if user is task assignee or contributor
    let isTaskAssignee = false;
    let isTaskContributor = false;

    if (submission.source_task_id || submission.source_subtask_id) {
      const Task = (await import('../modals/taskModal.js')).default;
      const taskId = submission.source_subtask_id || submission.source_task_id;
      const task = await Task.findById(taskId)
        .populate('assignedTo', '_id')
        .populate('collaborators', '_id');

      if (task) {
        // Check if user is the assignee
        isTaskAssignee = task.assignedTo?._id?.toString() === req.user.id;

        // Check if user is a collaborator/contributor
        isTaskContributor = task.collaborators?.some(
          collab => collab._id?.toString() === req.user.id
        );
      }
    }

    // Permission logic:
    // - Form creator can see ALL submissions
    // - org_admin/admin can see ALL submissions  
    // - Task assignee can see ALL submissions for their task
    // - Submitter can see their OWN submission
    // - Task contributor can see their OWN submission
    const hasPermission =
      isFormOwner ||
      isAdmin ||
      (isTaskAssignee) || // Task assignee sees all submissions
      (isSubmitter); // Submitter sees their own

    console.log('🔐 Submission access check:', {
      submissionId: submission_id,
      submittedBy: submission.submitted_by?._id?.toString(),
      submittedByDirect: submission.submitted_by?.toString?.(), // In case it's already ObjectId
      currentUserId: req.user.id?.toString?.() || req.user.id,
      formOwnerId: form?.created_by?.toString(),
      userRole: req.user.role,
      userRolesArray: userRoles,
      taskId: submission.source_task_id || submission.source_subtask_id,
      isSubmitter,
      isFormOwner,
      isAdmin,
      isTaskAssignee,
      isTaskContributor,
      hasPermission
    });

    if (!hasPermission) {
      console.log('❌ Permission denied for submission:', {
        reasons: {
          notSubmitter: !isSubmitter,
          notFormOwner: !isFormOwner,
          notAdmin: !isAdmin,
          notTaskAssignee: !isTaskAssignee
        }
      });
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this submission'
      });
    }

    // Keep field_ids for form population (don't transform to labels)
    const responseData = submission.toObject();
    // Don't transform - frontend needs field_id keys to populate form correctly
    // responseData.submission_data_json already has field_id keys from database

    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('❌ Error fetching submission:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching submission',
      error: error.message
    });
  }
};

/**
 * Get Current User's Submission for a Task/Form (DEPRECATED - returns only first submission)
 * GET /api/forms/submissions/my-submission?form_version_id=xxx&task_id=xxx
 * @deprecated Use getMySubmissionsForTask for multi-submission support
 */
export const getMySubmissionForTask = async (req, res) => {
  try {
    const { form_version_id, task_id, subtask_id } = req.query;

    if (!form_version_id) {
      return res.status(400).json({
        success: false,
        message: 'form_version_id is required'
      });
    }

    // Find submission for current user (returns first one only)
    const submission = await FormSubmission.findOne({
      form_version_id,
      submitted_by: req.user.id, // ✅ Fixed: use req.user.id
      ...(task_id && { source_task_id: task_id }),
      ...(subtask_id && { source_subtask_id: subtask_id })
    })
      .populate('form_id', 'title')
      .populate('form_version_id', 'version_number snapshot_data')
      .populate('submitted_by', 'firstName lastName email')
      .sort({ submitted_at: -1 }); // Get most recent

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'No submission found'
      });
    }

    // Transform response to use labels
    const responseData = submission.toObject();
    const formFields = submission.form_version_id?.snapshot_data?.fields || [];
    responseData.submission_data_json = transformFormDataToLabels(
      responseData.submission_data_json,
      formFields
    );

    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('❌ Error fetching my submission:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching submission',
      error: error.message
    });
  }
};

/**
 * Get All Current User's Submissions for a Task/Form (Multi-Submission Support)
 * GET /api/forms/submissions/my-submissions?form_version_id=xxx&task_id=xxx
 */
export const getMySubmissionsForTask = async (req, res) => {
  try {
    const { form_version_id, task_id, subtask_id } = req.query;

    if (!form_version_id) {
      return res.status(400).json({
        success: false,
        message: 'form_version_id is required'
      });
    }

    // Find all submissions for current user
    const submissions = await FormSubmission.find({
      form_version_id,
      submitted_by: req.user.id, // ✅ Fixed: use req.user.id
      ...(task_id && { source_task_id: task_id }),
      ...(subtask_id && { source_subtask_id: subtask_id })
    })
      .populate('form_id', 'title')
      .populate('form_version_id', 'version_number snapshot_data')
      .populate('submitted_by', 'firstName lastName email')
      .sort({ submitted_at: -1 }); // Most recent first

    // Keep field_ids (don't transform to labels)
    const transformedSubmissions = submissions.map(submission => submission.toObject());

    res.json({
      success: true,
      data: {
        submissions: transformedSubmissions,
        count: transformedSubmissions.length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching my submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching submissions',
      error: error.message
    });
  }
};

/**
 * Get Public Form by External Token (No Authentication Required)
 * GET /api/public/forms/:token
 */
export const getPublicFormByToken = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }

    console.log('🔍 Searching for published form with external_token:', token);

    // Find the active form version with this token
    const formVersion = await FormVersion.findOne({
      external_token: token,
      status: 'ACTIVE'
    })
      .populate('form_template_id', 'title description category_id tags visibility scope status')
      .populate('form_id', 'title description');

    if (!formVersion) {
      console.log('❌ No active form version found with token:', token);
      return res.status(404).json({
        success: false,
        message: 'Form not found or has been unpublished'
      });
    }

    // Check if external submission is enabled
    if (!formVersion.external_submission_enabled) {
      return res.status(403).json({
        success: false,
        message: 'External submissions are not enabled for this form'
      });
    }

    // Check if form is within valid date range (timezone-aware)
    const now = new Date();
    const tz = formVersion.timezone || 'UTC';

    if (formVersion.start_at) {
      const { startOfDay } = TimezoneHelper.getDayBoundaries(tz, formVersion.start_at);
      if (now < startOfDay) {
        return res.status(403).json({
          success: false,
          message: 'This form is not yet available'
        });
      }
    }

    if (formVersion.end_at) {
      const { endOfDay } = TimezoneHelper.getDayBoundaries(tz, formVersion.end_at);
      if (now > endOfDay) {
        return res.status(403).json({
          success: false,
          message: 'This form has expired'
        });
      }
    }

    // Build response from snapshot_data
    const formData = {
      form_id: formVersion.form_id,
      form_template_id: formVersion.form_template_id?._id,
      version_id: formVersion._id,
      version_number: formVersion.version_number,
      title: formVersion.snapshot_data?.title || formVersion.form_id?.title || 'Untitled Form',
      description: formVersion.snapshot_data?.description || formVersion.form_id?.description || '',
      fields: formVersion.snapshot_data?.fields || [],
      settings: formVersion.snapshot_data?.settings || {},
      external_token: formVersion.external_token,
      require_captcha: formVersion.require_captcha || false,
      start_at: formVersion.start_at,
      end_at: formVersion.end_at,
      timezone: formVersion.timezone || 'UTC',
    };

    console.log('✅ Public form found:', {
      title: formData.title,
      version: formData.version_number,
      fields: formData.fields.length
    });

    res.json({
      success: true,
      data: formData
    });

  } catch (error) {
    console.error('❌ Error fetching public form:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching form',
      error: error.message
    });
  }
};

/**
 * Generate CAPTCHA challenge for a public form
 * GET /api/public/forms/:token/captcha
 */
export const getCaptchaChallenge = async (req, res) => {
  try {
    const { token } = req.params;

    // Verify the form exists and has captcha enabled
    const formVersion = await FormVersion.findOne({
      external_token: token,
      status: 'ACTIVE',
    });

    if (!formVersion) {
      return res.status(404).json({ success: false, message: 'Form not found' });
    }

    if (!formVersion.require_captcha) {
      return res.status(400).json({ success: false, message: 'CAPTCHA not required for this form' });
    }

    const { challengeId, svgImage } = generateCaptcha(token);

    res.json({
      success: true,
      data: { challengeId, svgImage }
    });
  } catch (error) {
    console.error('Error generating CAPTCHA:', error);
    res.status(500).json({ success: false, message: 'Error generating CAPTCHA' });
  }
};

/**
 * Verify CAPTCHA answer for a public form
 * POST /api/public/forms/:token/verify-captcha
 */
export const verifyCaptchaAnswer = async (req, res) => {
  try {
    const { token } = req.params;
    const { challengeId, answer } = req.body;

    if (!challengeId || answer === undefined || answer === null || answer === '') {
      return res.status(400).json({ success: false, message: 'Challenge ID and answer are required' });
    }

    const result = verifyCaptcha(challengeId, answer, token);

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }

    res.json({
      success: true,
      data: { captchaToken: result.captchaToken }
    });
  } catch (error) {
    console.error('Error verifying CAPTCHA:', error);
    res.status(500).json({ success: false, message: 'Error verifying CAPTCHA' });
  }
};

// Helper: resolve form submission file path across environments
const resolveFormFilePath = (filePath, filename) => {
  console.log('🔍 [resolveFormFilePath] Trying to resolve:', { filePath, filename, cwd: process.cwd() });

  // 1. Try the stored path directly (relative to cwd)
  if (filePath) {
    const directPath = path.resolve(process.cwd(), filePath.replace(/^\//, ''));
    console.log('  → Try 1 (cwd + relative):', directPath);
    if (fs.existsSync(directPath)) {
      console.log('  ✅ Found at direct path');
      return directPath;
    }

    // Try as absolute path
    const absPath = path.resolve(filePath);
    console.log('  → Try 2 (absolute):', absPath);
    if (fs.existsSync(absPath)) {
      console.log('  ✅ Found at absolute path');
      return absPath;
    }

    // Extract relative portion from stored path
    const uploadsIdx = filePath.replace(/\\/g, '/').indexOf('uploads/');
    if (uploadsIdx !== -1) {
      const relativePart = filePath.replace(/\\/g, '/').substring(uploadsIdx);
      const reconstructed = path.join(process.cwd(), relativePart);
      console.log('  → Try 3 (extract uploads/):', reconstructed);
      if (fs.existsSync(reconstructed)) {
        console.log('  ✅ Found at reconstructed path');
        return reconstructed;
      }
    }

    // Extract the stored filename from file_path (last segment)
    const storedFilename = filePath.split('/').pop();
    if (storedFilename) {
      const storedPath = path.join(process.cwd(), 'uploads', 'form-submissions', storedFilename);
      console.log('  → Try 4 (stored filename from path):', storedPath);
      if (fs.existsSync(storedPath)) {
        console.log('  ✅ Found using stored filename');
        return storedPath;
      }
    }
  }

  // 2. Try uploads/form-submissions/<original filename>
  if (filename) {
    const formSubPath = path.join(process.cwd(), 'uploads', 'form-submissions', filename);
    console.log('  → Try 5 (original filename):', formSubPath);
    if (fs.existsSync(formSubPath)) {
      console.log('  ✅ Found at original filename path');
      return formSubPath;
    }
  }

  console.log('  ❌ File not found at any path');
  return null;
};

/**
 * View form submission file (inline preview)
 * GET /api/forms/submissions/:submissionId/files/:attachmentId/view
 */
export const viewFormSubmissionFile = async (req, res) => {
  try {
    const { submissionId, attachmentId } = req.params;
    console.log('📂 [viewFormSubmissionFile] Request:', { submissionId, attachmentId });

    const submission = await FormSubmission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    // Find attachment by _id
    const attachment = submission.attachments?.find(a => a._id.toString() === attachmentId);
    if (!attachment) {
      console.log('❌ Attachment not found. Available attachments:', submission.attachments?.map(a => ({ _id: a._id, field_id: a.field_id, filename: a.filename })));
      return res.status(404).json({ success: false, message: 'File not found in submission' });
    }

    console.log('📎 Found attachment:', { filename: attachment.filename, file_path: attachment.file_path, mime_type: attachment.mime_type });

    const filePath = resolveFormFilePath(attachment.file_path, attachment.filename);
    if (!filePath) {
      if (r2Storage.isR2Enabled()) {
        try {
          const key = r2Storage.getR2KeyFromPathOrUrl(attachment.file_path) || `form-submissions/${attachment.filename}`;
          const signedUrl = await r2Storage.getSignedUrlForGetObject(key, {
            responseContentDisposition: `inline; filename="${encodeURIComponent(attachment.filename)}"`,
            responseContentType: attachment.mime_type || 'application/octet-stream',
            expiresIn: 3600 // 1 hour
          });
          if (signedUrl) {
            return res.redirect(signedUrl);
          }
        } catch (r2Error) {
          console.error('[viewFormSubmissionFile] Failed to generate signed URL from R2:', r2Error.message);
        }
      }
      return res.status(404).json({
        success: false,
        message: 'File not available on disk or R2 - it may have been uploaded on a different server',
        details: { stored_path: attachment.file_path, filename: attachment.filename }
      });
    }

    const stat = fs.statSync(filePath);
    const contentType = attachment.mime_type || 'application/octet-stream';
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.filename)}"`);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stat.size);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    fileStream.on('error', (error) => {
      console.error('Error streaming form file:', error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Error viewing file' });
      }
    });
  } catch (error) {
    console.error('Error viewing form submission file:', error);
    res.status(500).json({ success: false, message: 'Failed to view file' });
  }
};

/**
 * Download form submission file
 * GET /api/forms/submissions/:submissionId/files/:attachmentId/download
 */
export const downloadFormSubmissionFile = async (req, res) => {
  try {
    const { submissionId, attachmentId } = req.params;
    console.log('📂 [downloadFormSubmissionFile] Request:', { submissionId, attachmentId });

    const submission = await FormSubmission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    const attachment = submission.attachments?.find(a => a._id.toString() === attachmentId);
    if (!attachment) {
      console.log('❌ Attachment not found. Available attachments:', submission.attachments?.map(a => ({ _id: a._id, field_id: a.field_id, filename: a.filename })));
      return res.status(404).json({ success: false, message: 'File not found in submission' });
    }

    console.log('📎 Found attachment:', { filename: attachment.filename, file_path: attachment.file_path, mime_type: attachment.mime_type });

    const filePath = resolveFormFilePath(attachment.file_path, attachment.filename);
    if (!filePath) {
      if (r2Storage.isR2Enabled()) {
        try {
          const key = r2Storage.getR2KeyFromPathOrUrl(attachment.file_path) || `form-submissions/${attachment.filename}`;
          const signedUrl = await r2Storage.getSignedUrlForGetObject(key, {
            responseContentDisposition: `attachment; filename="${encodeURIComponent(attachment.filename)}"`,
            responseContentType: attachment.mime_type || 'application/octet-stream',
            expiresIn: 900 // 15 minutes
          });
          if (signedUrl) {
            return res.redirect(signedUrl);
          }
        } catch (r2Error) {
          console.error('[downloadFormSubmissionFile] Failed to generate signed URL from R2:', r2Error.message);
        }
      }
      return res.status(404).json({
        success: false,
        message: 'File not available on disk or R2 - it may have been uploaded on a different server',
        details: { stored_path: attachment.file_path, filename: attachment.filename }
      });
    }

    const stat = fs.statSync(filePath);
    const contentType = attachment.mime_type || 'application/octet-stream';
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.filename)}"`);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stat.size);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    fileStream.on('error', (error) => {
      console.error('Error streaming form file:', error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Error downloading file' });
      }
    });
  } catch (error) {
    console.error('Error downloading form submission file:', error);
    res.status(500).json({ success: false, message: 'Failed to download file' });
  }
};

// Trigger restart
