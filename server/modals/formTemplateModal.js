import mongoose from "mongoose";
import TimezoneHelper from "../utils/timezoneHelper.js";


// Sub-schema for field options (used in dropdown/multiselect)
const optionSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    value: { type: String, required: true },
  },
  { _id: false }
);

// Sub-schema for validation rules
const validationRuleSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'required',
        'min',
        'max',
        'minLength',
        'maxLength',
        'regex',
        'email',
        'phone',
        'url',
        'number',
        'integer',
        'decimal',
        'date',
        'custom'
      ]
    },
    value: mongoose.Schema.Types.Mixed,
    message: { type: String }, // Custom error message
  },
  { _id: false }
);

// Sub-schema for conditional logic (visibility/enablement)
const conditionSchema = new mongoose.Schema(
  {
    field_code: { type: String, required: true }, // Field to check
    operator: {
      type: String,
      required: true,
      enum: ['==', '!=', '>', '<', '>=', '<=', 'contains', 'not_contains', 'is_empty', 'is_not_empty', 'in', 'not_in']
    },
    value: mongoose.Schema.Types.Mixed, // Value to compare against
    logic: {
      type: String,
      enum: ['AND', 'OR'],
      default: 'AND'
    }
  },
  { _id: false }
);

// Sub-schema for form fields (COMPLETE - All 23 field types supported)
const fieldSchema = new mongoose.Schema(
  {
    field_id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true,
    },
    field_code: {
      type: String,
      required: true, // Unique identifier for conditional logic
    },
    label: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        // Text inputs
        "text",           // TXT_1 - Single-line text
        "textarea",       // TXT_M - Multi-line text
        "rich_text",      // RICH - Rich text/HTML

        // Numbers
        "number",         // NUM_INT - Integer
        "decimal",        // NUM_DEC - Decimal

        // Selections
        "dropdown",       // DROPS - Single dropdown
        "multiselect",    // DROPM - Multi dropdown
        "radio",          // RADIO - Radio buttons
        "checkbox",       // CHECK - Checkboxes

        // Date/Time
        "date",           // DATE - Date picker
        "datetime",       // DATETIME - Date & time

        // Contact
        "email",          // EMAIL - Email with validation
        "phone",          // PHONE - Phone with country code
        "url",            // URL - URL with validation

        // File & Signature
        "file_upload",    // FILE - File upload
        "signature",      // SIGN - Signature pad

        // Special
        "rating",         // RATING - Star/number rating
        "toggle",         // TOGGLE - Boolean switch
        "location_picker",// LOC - Lat/lon picker
        "lookup",         // LOOKUP - Reference lookup

        // Display only
        "title",          // TITLE - Section title
        "label",          // LABEL - Read-only label
        "qr_code",        // QR - QR/barcode (future)
      ],
    },

    // Basic properties
    placeholder: { type: String },
    help_text: { type: String }, // Help text below field
    tooltip: { type: String }, // Tooltip on hover
    description: { type: String }, // Detailed description

    // Behavior flags
    isRequired: { type: Boolean, default: false },
    read_only: { type: Boolean, default: false },

    // Default values
    default_value: mongoose.Schema.Types.Mixed, // Static default
    dynamic_default: {
      type: String,
      enum: [
        '{{current_user.name}}',
        '{{current_user.email}}',
        '{{current_user.id}}',
        '{{current_date}}',
        '{{current_datetime}}',
        '{{current_time}}',
        '{{company.name}}',
        '{{company.id}}',
        'none'
      ],
      default: 'none'
    },

    // Styling & Layout
    css_class: { type: String }, // Custom CSS classes
    column_span: {
      type: Number,
      default: 1, // 1, 2, or 3 (for grid layout)
      min: 1,
      max: 3
    },
    order: { type: Number, default: 0 }, // Display order

    // Options for select fields
    hasOption: { type: Boolean, default: false },
    options: [optionSchema],

    // Validation rules
    validation: {
      min: { type: Number }, // For numbers, dates
      max: { type: Number },
      minLength: { type: Number }, // For text
      maxLength: { type: Number },
      step: { type: Number }, // For number inputs
      precision: { type: Number }, // For decimal
      regex: { type: String },
      custom_rules: [validationRuleSchema]
    },

    // Conditional logic
    visibility_condition: [conditionSchema], // Show/hide based on other fields
    enable_condition: [conditionSchema], // Enable/disable based on other fields

    // Field-specific metadata
    meta: {
      // File upload
      fileTypes: [String], // e.g. ['jpg','png','pdf']
      maxSizeMB: { type: Number },
      maxFiles: { type: Number, default: 1 },
      allowed_mime_types: [String],

      // Rating
      rating_scale: { type: Number, default: 5 }, // 1-5, 1-10, etc.
      rating_icon: { type: String, default: 'star' }, // star, heart, thumb

      // Phone
      country_code: { type: String, default: '+91' },

      // Datetime
      timezone: { type: String, default: 'UTC' },

      // Rich text
      allow_formatting: { type: Boolean, default: true },

      // Lookup
      lookup_endpoint: { type: String }, // API endpoint for lookup
      lookup_display_field: { type: String }, // Field to display
      lookup_value_field: { type: String }, // Field to store

      // Location
      enable_current_location: { type: Boolean, default: true },
      enable_address_search: { type: Boolean, default: true },

      // Character counter for textarea
      show_character_count: { type: Boolean, default: false },

      // Searchable dropdown
      searchable: { type: Boolean, default: false },
    },
  },
  { _id: false }
);

const formSchema = new mongoose.Schema(
  {
    form_id: {
      type: mongoose.Schema.Types.ObjectId,
      primary: true,
      auto: true,
    },
    form_code: {
      type: String,
      required: true,
      unique: true
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    owner_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    category_id: {
      type: String,
      required: false,
      default: null,
      trim: true,
    },
    tags: [String],
    status: {
      type: String,
      enum: ["DRAFT", "PUBLISHED", "ARCHIVED", "DEPRECATED"],
      default: "DRAFT",
      description: "DRAFT=editable, PUBLISHED=available for use, ARCHIVED=historical only, DEPRECATED=newer version exists"
    },
    current_version_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FormVersion",
    },
    visibility: {
      type: String,
      enum: ["PUBLIC", "PRIVATE", "ORG"],
      default: "PRIVATE",
      description: "PUBLIC=external submissions, PRIVATE=owner only, ORG=company-wide"
    },
    scope: {
      type: String,
      enum: ["INTERNAL", "EXTERNAL"],
      default: "INTERNAL",
    },
    start_at: {
      type: Date,
      description: "Form becomes available at this date"
    },
    end_at: {
      type: Date,
      description: "Form expires after this date"
    },
    // Publisher's IANA timezone (e.g. 'Asia/Kolkata') for date boundary checks
    timezone: {
      type: String,
      default: "UTC",
    },

    // External submission settings (5.8)
    external_submission_enabled: {
      type: Boolean,
      default: false,
      description: "Allow submissions from external users via tokenized URL"
    },
    external_token: {
      type: String,
      unique: true,
      sparse: true,
      description: "Secure token for external submission URL"
    },
    external_password: {
      type: String,
      default: null,
      description: "Optional password for external form access"
    },

    // ✅ ACL - Access Control List
    shared_with: [{
      user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      },
      role: {
        type: String,
        enum: ["EDITOR", "VIEWER"],
        required: true
      },
      granted_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      granted_at: {
        type: Date,
        default: Date.now
      }
    }],

    // Form settings
    settings: {
      allowAnonymous: { type: Boolean, default: false },
      require_captcha: { type: Boolean, default: false },
      submitMessage: { type: String, default: "Thank you for your submission!" },

      // Grid layout (1/2/3 columns)
      layout: {
        type: String,
        enum: ["1-column", "2-columns", "3-columns"],
        default: "1-column"
      },

      // Submission limits
      maxSubmissions: { type: Number },
      maxSubmissionsPerUser: { type: Number },

      // Post-submission
      redirectUrl: { type: String },
      showResponseSummary: { type: Boolean, default: false },

      // Builder settings
      enable_draft_save: { type: Boolean, default: true },
      enable_auto_save: { type: Boolean, default: true },
      auto_save_interval: { type: Number, default: 30 }, // seconds

      // Validation settings
      enable_client_validation: { type: Boolean, default: true },
      enable_server_validation: { type: Boolean, default: true },

      // Preview settings
      enable_preview_mode: { type: Boolean, default: true },
      preview_with_sample_data: { type: Boolean, default: false },
    },

    // Builder configuration
    builder_config: {
      grid_columns: { type: Number, default: 1, min: 1, max: 3 },
      allow_field_grouping: { type: Boolean, default: false },
      allow_repeatable_sections: { type: Boolean, default: false }, // Phase II
      show_field_palette: { type: Boolean, default: true },
      show_properties_panel: { type: Boolean, default: true },
      show_live_preview: { type: Boolean, default: true },
    },

    // Publish governance
    restrictPublishToOwner: {
      type: Boolean,
      default: false,
      description: "If true, only form owner can publish. Editors cannot publish versions."
    },

    // Cross-field validation rules
    cross_field_validation: [{
      rule_id: mongoose.Schema.Types.ObjectId,
      name: { type: String }, // e.g., "End date must be after start date"
      field_codes: [String], // Fields involved in validation
      expression: { type: String }, // e.g., "end_date > start_date"
      error_message: { type: String },
      enabled: { type: Boolean, default: true }
    }],

    // Version metadata
    version_notes: { type: String }, // Change notes for this version
    version_number: { type: String, default: '1.0' },

    // Soft deletion (Section 5.8)
    deleted_at: {
      type: Date,
      default: null,
      description: "Timestamp when form was soft-deleted"
    },
    deleted_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      description: "User who deleted the form"
    },

    // Form fields array
    fields: [fieldSchema],
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

// Indexes for performance
formSchema.index({ form_id: 1 });
formSchema.index({ category_id: 1 });
formSchema.index({ visibility: 1 });
formSchema.index({ scope: 1 });
formSchema.index({ "shared_with.user_id": 1 });

// ✅ Instance Methods for ACL
formSchema.methods.hasAccess = function (userId, requiredPermission = 'VIEW') {
  const userIdStr = userId.toString();

  // Owner has full access
  if (this.owner_user_id.toString() === userIdStr) {
    return true;
  }

  // Check shared_with array
  const sharedEntry = this.shared_with.find(
    entry => entry.user_id.toString() === userIdStr
  );

  if (!sharedEntry) return false;

  // Permission hierarchy: EDITOR > VIEWER
  if (requiredPermission === 'VIEW') {
    return ['EDITOR', 'VIEWER'].includes(sharedEntry.role);
  }

  if (requiredPermission === 'EDIT') {
    return sharedEntry.role === 'EDITOR';
  }

  return false;
};

formSchema.methods.getUserRole = function (userId) {
  const userIdStr = userId.toString();

  // Owner has highest role
  if (this.owner_user_id.toString() === userIdStr) {
    return 'OWNER';
  }

  // Check shared_with array
  const sharedEntry = this.shared_with.find(
    entry => entry.user_id.toString() === userIdStr
  );

  return sharedEntry ? sharedEntry.role : null;
};

formSchema.methods.addSharedUser = function (userId, role, grantedBy) {
  // Remove existing entry if present
  this.shared_with = this.shared_with.filter(
    entry => entry.user_id.toString() !== userId.toString()
  );

  // Add new entry
  this.shared_with.push({
    user_id: userId,
    role: role,
    granted_by: grantedBy,
    granted_at: new Date()
  });

  return this.save();
};

formSchema.methods.removeSharedUser = function (userId) {
  this.shared_with = this.shared_with.filter(
    entry => entry.user_id.toString() !== userId.toString()
  );

  return this.save();
};

// ✅ Resolve dynamic default values
formSchema.methods.resolveDynamicDefaults = function (user, company, userTimezone = 'UTC') {
  const resolvedFields = this.fields.map(field => {
    if (!field.dynamic_default || field.dynamic_default === 'none') {
      return field;
    }

    const fieldCopy = field.toObject();

    switch (field.dynamic_default) {
      case '{{current_user.name}}':
        fieldCopy.default_value = user?.firstName && user?.lastName
          ? `${user.firstName} ${user.lastName}`
          : user?.firstName || '';
        break;
      case '{{current_user.email}}':
        fieldCopy.default_value = user?.email || '';
        break;
      case '{{current_user.id}}':
        fieldCopy.default_value = user?._id?.toString() || '';
        break;
      case '{{current_date}}':
        fieldCopy.default_value = TimezoneHelper.formatDateInTimezone(new Date(), userTimezone);
        break;
      case '{{current_datetime}}':
        fieldCopy.default_value = TimezoneHelper.formatDateTimeInTimezone(new Date(), userTimezone);
        break;
      case '{{current_time}}':
        fieldCopy.default_value = TimezoneHelper.formatTimeInTimezone(new Date(), userTimezone);
        break;
      case '{{company.name}}':
        fieldCopy.default_value = company?.name || '';
        break;
      case '{{company.id}}':
        fieldCopy.default_value = company?._id?.toString() || '';
        break;
      default:
        // Keep static default if any
        break;
    }

    return fieldCopy;
  });

  return resolvedFields;
};

// ✅ Validate field code uniqueness
formSchema.methods.validateFieldCodes = function () {
  const fieldCodes = this.fields.map(f => f.field_code);
  const duplicates = fieldCodes.filter((code, index) => fieldCodes.indexOf(code) !== index);

  if (duplicates.length > 0) {
    return {
      valid: false,
      errors: [`Duplicate field codes found: ${duplicates.join(', ')}`]
    };
  }

  return { valid: true, errors: [] };
};

// ✅ Validate form structure (pre-publish check)
formSchema.methods.validateFormStructure = function () {
  const errors = [];

  // Check for fields without labels
  const unlabeledFields = this.fields.filter(f => !f.label || f.label.trim() === '');
  if (unlabeledFields.length > 0) {
    errors.push(`${unlabeledFields.length} field(s) missing labels`);
  }

  // Check for duplicate field_codes
  const codeValidation = this.validateFieldCodes();
  if (!codeValidation.valid) {
    errors.push(...codeValidation.errors);
  }

  // Check for invalid conditional logic references
  this.fields.forEach(field => {
    if (field.visibility_condition && field.visibility_condition.length > 0) {
      field.visibility_condition.forEach(condition => {
        const referencedField = this.fields.find(f => f.field_code === condition.field_code);
        if (!referencedField) {
          errors.push(`Field "${field.label}" references non-existent field "${condition.field_code}" in visibility condition`);
        }
      });
    }

    if (field.enable_condition && field.enable_condition.length > 0) {
      field.enable_condition.forEach(condition => {
        const referencedField = this.fields.find(f => f.field_code === condition.field_code);
        if (!referencedField) {
          errors.push(`Field "${field.label}" references non-existent field "${condition.field_code}" in enable condition`);
        }
      });
    }
  });

  // Check for lookup fields without endpoints
  const invalidLookups = this.fields.filter(
    f => f.type === 'lookup' && !f.meta?.lookup_endpoint
  );
  if (invalidLookups.length > 0) {
    errors.push(`${invalidLookups.length} lookup field(s) missing endpoint configuration`);
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
};

// ✅ Evaluate conditional logic for a field
formSchema.statics.evaluateConditions = function (conditions, formData) {
  if (!conditions || conditions.length === 0) return true;

  const results = conditions.map(condition => {
    const fieldValue = formData[condition.field_code];

    switch (condition.operator) {
      case '==':
        return fieldValue == condition.value;
      case '!=':
        return fieldValue != condition.value;
      case '>':
        return Number(fieldValue) > Number(condition.value);
      case '<':
        return Number(fieldValue) < Number(condition.value);
      case '>=':
        return Number(fieldValue) >= Number(condition.value);
      case '<=':
        return Number(fieldValue) <= Number(condition.value);
      case 'contains':
        return String(fieldValue || '').includes(String(condition.value));
      case 'not_contains':
        return !String(fieldValue || '').includes(String(condition.value));
      case 'is_empty':
        return !fieldValue || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0);
      case 'is_not_empty':
        return fieldValue && fieldValue !== '' && (!Array.isArray(fieldValue) || fieldValue.length > 0);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
      default:
        return true;
    }
  });

  // Apply logic operator (AND vs OR)
  const logic = conditions[0]?.logic || 'AND';
  return logic === 'AND'
    ? results.every(r => r)
    : results.some(r => r);
};

export const FormTemplate = mongoose.model("FormTemplate", formSchema);
