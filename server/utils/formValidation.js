/**
 * Form Field Validation Utilities
 * Server-side validation for form submissions
 */
import TimezoneHelper from './timezoneHelper.js';

/**
 * Validate unique field_code values in form fields (Spec 5.11 - Edge Case)
 * @param {Array} fields - Array of form field objects
 * @returns {Object} - { valid: boolean, duplicates?: Array }
 */
export const validateUniqueFieldCodes = (fields) => {
  if (!fields || !Array.isArray(fields)) {
    return { valid: true };
  }

  const codes = fields
    .map(f => f.field_code)
    .filter(code => code); // Filter out null/undefined

  const duplicates = codes.filter((code, index) => codes.indexOf(code) !== index);

  if (duplicates.length > 0) {
    return {
      valid: false,
      duplicates: [...new Set(duplicates)] // Remove duplicate entries in the duplicates array
    };
  }

  return { valid: true };
};

/**
 * Validate a single field value against its validation rules
 * @param {Object} field - Field schema
 * @param {*} value - Submitted value
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
export const validateField = (field, value) => {
  const errors = [];

  // Required check
  if (field.isRequired) {
    if (value === undefined || value === null || value === '') {
      errors.push(`${field.label} is required`);
      return { valid: false, errors };
    }

    // For arrays (multiselect, checkbox)
    if (Array.isArray(value) && value.length === 0) {
      errors.push(`${field.label} is required`);
      return { valid: false, errors };
    }
  }

  // Skip further validation if empty and not required
  if (!field.isRequired && (value === undefined || value === null || value === '')) {
    return { valid: true, errors: [] };
  }

  // Type-specific validation
  switch (field.type) {
    case 'email':
      if (!validateEmail(value)) {
        errors.push(`${field.label} must be a valid email address`);
      }
      break;

    case 'phone':
      if (!validatePhone(value)) {
        errors.push(`${field.label} must be a valid phone number`);
      }
      break;

    case 'url':
      if (!validateURL(value)) {
        errors.push(`${field.label} must be a valid URL`);
      }
      break;

    case 'number':
    case 'decimal':
      if (isNaN(Number(value))) {
        errors.push(`${field.label} must be a valid number`);
      } else {
        // Min/Max validation - only if min/max is a valid number (not null, not undefined)
        if (field.validation?.min != null && !isNaN(field.validation.min) && Number(value) < field.validation.min) {
          errors.push(`${field.label} must be at least ${field.validation.min}`);
        }
        if (field.validation?.max != null && !isNaN(field.validation.max) && Number(value) > field.validation.max) {
          errors.push(`${field.label} must be at most ${field.validation.max}`);
        }
      }
      break;

    case 'text':
    case 'textarea':
    case 'rich_text':
      const strValue = String(value);

      // Length validation
      if (field.validation?.minLength && strValue.length < field.validation.minLength) {
        errors.push(`${field.label} must be at least ${field.validation.minLength} characters`);
      }
      if (field.validation?.maxLength && strValue.length > field.validation.maxLength) {
        errors.push(`${field.label} must be at most ${field.validation.maxLength} characters`);
      }

      // Regex validation
      if (field.validation?.regex) {
        const regex = new RegExp(field.validation.regex);
        if (!regex.test(strValue)) {
          errors.push(`${field.label} format is invalid`);
        }
      }
      break;

    case 'date':
    case 'datetime':
      const dateValue = new Date(value);
      if (isNaN(dateValue.getTime())) {
        errors.push(`${field.label} must be a valid date`);
      } else {
        // Min/Max date validation
        if (field.validation?.min) {
          const minDate = new Date(field.validation.min);
          if (dateValue < minDate) {
            errors.push(`${field.label} must be on or after ${TimezoneHelper.formatInTimezone(minDate, 'UTC')}`);
          }
        }
        if (field.validation?.max) {
          const maxDate = new Date(field.validation.max);
          if (dateValue > maxDate) {
            errors.push(`${field.label} must be on or before ${TimezoneHelper.formatInTimezone(maxDate, 'UTC')}`);
          }
        }
      }
      break;

    case 'file_upload':
      if (Array.isArray(value)) {
        // Validate file count
        if (field.meta?.maxFiles && value.length > field.meta.maxFiles) {
          errors.push(`${field.label} can have at most ${field.meta.maxFiles} file(s)`);
        }

        // Validate each file
        value.forEach((file, index) => {
          // File size validation
          if (field.meta?.maxSizeMB && file.size > field.meta.maxSizeMB * 1024 * 1024) {
            errors.push(`File ${index + 1} in ${field.label} exceeds maximum size of ${field.meta.maxSizeMB}MB`);
          }

          // File type validation
          if (field.meta?.allowed_mime_types && field.meta.allowed_mime_types.length > 0) {
            if (!field.meta.allowed_mime_types.includes(file.mimetype)) {
              errors.push(`File ${index + 1} in ${field.label} has invalid type. Allowed: ${field.meta.allowed_mime_types.join(', ')}`);
            }
          }
        });
      }
      break;

    case 'rating':
      const ratingValue = Number(value);
      const scale = field.meta?.rating_scale || 5;
      if (isNaN(ratingValue) || ratingValue < 1 || ratingValue > scale) {
        errors.push(`${field.label} must be between 1 and ${scale}`);
      }
      break;

    case 'dropdown':
      // Validate value is in options
      if (field.hasOption && field.options && field.options.length > 0) {
        const validValues = field.options.map(opt => opt.value);
        if (!validValues.includes(value)) {
          errors.push(`${field.label} has an invalid selection`);
        }
      }
      break;

    case 'multiselect':
    case 'checkbox':
      // Validate all values are in options
      if (field.hasOption && field.options && field.options.length > 0) {
        const validValues = field.options.map(opt => opt.value);
        const invalidValues = value.filter(v => !validValues.includes(v));
        if (invalidValues.length > 0) {
          errors.push(`${field.label} has invalid selection(s): ${invalidValues.join(', ')}`);
        }
      }
      break;
  }

  // Custom validation rules
  if (field.validation?.custom_rules && field.validation.custom_rules.length > 0) {
    field.validation.custom_rules.forEach(rule => {
      const ruleError = validateCustomRule(rule, value, field.label);
      if (ruleError) {
        errors.push(ruleError);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
};

/**
 * Validate custom rule
 */
const validateCustomRule = (rule, value, fieldLabel) => {
  switch (rule.type) {
    case 'required':
      if (!value || value === '') {
        return rule.message || `${fieldLabel} is required`;
      }
      break;
    case 'min':
      if (Number(value) < rule.value) {
        return rule.message || `${fieldLabel} must be at least ${rule.value}`;
      }
      break;
    case 'max':
      if (Number(value) > rule.value) {
        return rule.message || `${fieldLabel} must be at most ${rule.value}`;
      }
      break;
    case 'minLength':
      if (String(value).length < rule.value) {
        return rule.message || `${fieldLabel} must be at least ${rule.value} characters`;
      }
      break;
    case 'maxLength':
      if (String(value).length > rule.value) {
        return rule.message || `${fieldLabel} must be at most ${rule.value} characters`;
      }
      break;
    case 'regex':
      const regex = new RegExp(rule.value);
      if (!regex.test(String(value))) {
        return rule.message || `${fieldLabel} format is invalid`;
      }
      break;
  }
  return null;
};

/**
 * Email validation
 */
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Phone validation (basic)
 */
const validatePhone = (phone) => {
  // Remove all non-digit characters
  const cleaned = String(phone).replace(/\D/g, '');
  // Phone should be 10-15 digits
  return cleaned.length >= 10 && cleaned.length <= 15;
};

/**
 * URL validation
 */
const validateURL = (url) => {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Validate entire form submission
 * @param {Object} form - Form template
 * @param {Object} submission - User submission data
 * @param {Object} user - Current user (for dynamic defaults)
 * @returns {Object} - { valid: boolean, errors: Object }
 */
export const validateFormSubmission = (form, submission, user = null) => {
  const errors = {};
  let hasErrors = false;

  // Validate each field
  form.fields.forEach(field => {
    // Skip display-only fields
    if (['title', 'label', 'qr_code'].includes(field.type)) {
      return;
    }

    // Skip read-only fields
    if (field.read_only) {
      return;
    }

    // Check visibility condition
    if (field.visibility_condition && field.visibility_condition.length > 0) {
      const isVisible = form.constructor.evaluateConditions(field.visibility_condition, submission);
      if (!isVisible) {
        return; // Skip validation for hidden fields
      }
    }

    // Check enable condition
    if (field.enable_condition && field.enable_condition.length > 0) {
      const isEnabled = form.constructor.evaluateConditions(field.enable_condition, submission);
      if (!isEnabled) {
        return; // Skip validation for disabled fields
      }
    }

    const value = submission[field.field_code];
    const validation = validateField(field, value);

    if (!validation.valid) {
      errors[field.field_code] = validation.errors;
      hasErrors = true;
    }
  });

  // Cross-field validation
  if (form.cross_field_validation && form.cross_field_validation.length > 0) {
    form.cross_field_validation.forEach(rule => {
      if (!rule.enabled) return;

      const crossFieldError = evaluateCrossFieldRule(rule, submission);
      if (crossFieldError) {
        errors['_cross_field'] = errors['_cross_field'] || [];
        errors['_cross_field'].push(crossFieldError);
        hasErrors = true;
      }
    });
  }

  return {
    valid: !hasErrors,
    errors: errors
  };
};

/**
 * Evaluate cross-field validation rule
 * Simple expression evaluation (e.g., "end_date > start_date")
 */
const evaluateCrossFieldRule = (rule, submission) => {
  try {
    const { expression, field_codes, error_message } = rule;

    // Extract field values
    const values = {};
    field_codes.forEach(code => {
      values[code] = submission[code];
    });

    // Simple expression evaluation
    // Support: >, <, >=, <=, ==, !=
    const operators = ['>=', '<=', '==', '!=', '>', '<'];
    let operator = null;
    let parts = [];

    for (const op of operators) {
      if (expression.includes(op)) {
        operator = op;
        parts = expression.split(op).map(p => p.trim());
        break;
      }
    }

    if (!operator || parts.length !== 2) {
      return null; // Invalid expression
    }

    const leftValue = values[parts[0]] || submission[parts[0]];
    const rightValue = values[parts[1]] || submission[parts[1]];

    if (leftValue === undefined || rightValue === undefined) {
      return null; // Cannot evaluate
    }

    let result = false;

    switch (operator) {
      case '>':
        result = leftValue > rightValue;
        break;
      case '<':
        result = leftValue < rightValue;
        break;
      case '>=':
        result = leftValue >= rightValue;
        break;
      case '<=':
        result = leftValue <= rightValue;
        break;
      case '==':
        result = leftValue == rightValue;
        break;
      case '!=':
        result = leftValue != rightValue;
        break;
    }

    return result ? null : (error_message || `Validation failed: ${expression}`);

  } catch (error) {
    console.error('Cross-field validation error:', error);
    return null;
  }
};

export default {
  validateField,
  validateFormSubmission,
  validateUniqueFieldCodes,
  validateEmail,
  validatePhone,
  validateURL
};
