import sanitizeHtml from 'sanitize-html';

/**
 * Input Sanitization Middleware for XSS Protection
 * Implements spec 5.10 security requirements
 */

// Strict sanitization options - only allow safe text
const strictOptions = {
  allowedTags: [], // No HTML tags allowed
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
};

// Moderate sanitization options - allow basic formatting
const moderateOptions = {
  allowedTags: ['b', 'i', 'em', 'strong', 'u', 'br', 'p'],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
};

// Rich text sanitization - for descriptions
const richTextOptions = {
  allowedTags: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'a', 'ul', 'ol',
    'nl', 'li', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div',
    'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre', 'span'],
  allowedAttributes: {
    a: ['href', 'target'],
    span: ['style'],
    p: ['style'],
    div: ['style'],
  },
  allowedStyles: {
    '*': {
      'color': [/^#(0x)?[0-9a-f]+$/i, /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/],
      'text-align': [/^left$/, /^right$/, /^center$/],
      'font-weight': [/^bold$/, /^normal$/],
      'font-style': [/^italic$/, /^normal$/],
    }
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  disallowedTagsMode: 'discard',
};

/**
 * Sanitize a single string value
 * @param {string} value - The value to sanitize
 * @param {string} mode - Sanitization mode: 'strict', 'moderate', or 'rich'
 * @returns {string} - Sanitized value
 */
export const sanitizeString = (value, mode = 'strict') => {
  if (typeof value !== 'string') return value;
  
  const options = {
    strict: strictOptions,
    moderate: moderateOptions,
    rich: richTextOptions,
  }[mode] || strictOptions;
  
  return sanitizeHtml(value, options);
};

/**
 * Recursively sanitize all string values in an object
 * @param {Object|Array} obj - The object to sanitize
 * @param {string} mode - Sanitization mode
 * @returns {Object|Array} - Sanitized object
 */
export const sanitizeObject = (obj, mode = 'strict') => {
  if (obj === null || obj === undefined) return obj;
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, mode));
  }
  
  // Handle objects
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key], mode);
      }
    }
    return sanitized;
  }
  
  // Handle strings
  if (typeof obj === 'string') {
    return sanitizeString(obj, mode);
  }
  
  // Return primitives as-is
  return obj;
};

/**
 * Sanitize form template data
 * @param {Object} formData - Form template data
 * @returns {Object} - Sanitized form data
 */
export const sanitizeFormTemplate = (formData) => {
  if (!formData) return formData;
  
  // Clone to avoid mutating original
  const sanitized = { ...formData };
  
  // Sanitize top-level fields
  if (sanitized.title) {
    sanitized.title = sanitizeString(sanitized.title, 'moderate');
  }
  if (sanitized.description) {
    sanitized.description = sanitizeString(sanitized.description, 'rich');
  }
  if (sanitized.success_message) {
    sanitized.success_message = sanitizeString(sanitized.success_message, 'rich');
  }
  if (sanitized.terms_and_conditions) {
    sanitized.terms_and_conditions = sanitizeString(sanitized.terms_and_conditions, 'rich');
  }
  
  // Sanitize form fields
  if (sanitized.fields && Array.isArray(sanitized.fields)) {
    sanitized.fields = sanitized.fields.map(field => ({
      ...field,
      label: sanitizeString(field.label, 'moderate'),
      description: field.description ? sanitizeString(field.description, 'moderate') : field.description,
      placeholder: field.placeholder ? sanitizeString(field.placeholder, 'strict') : field.placeholder,
      helpText: field.helpText ? sanitizeString(field.helpText, 'moderate') : field.helpText,
      default_value: field.default_value ? sanitizeString(field.default_value, 'strict') : field.default_value,
      // Sanitize options if present
      options: field.options && Array.isArray(field.options) 
        ? field.options.map(opt => ({
            ...opt,
            label: sanitizeString(opt.label, 'moderate'),
            value: sanitizeString(opt.value, 'strict'),
          }))
        : field.options,
    }));
  }
  
  // Sanitize sections
  if (sanitized.sections && Array.isArray(sanitized.sections)) {
    sanitized.sections = sanitized.sections.map(section => ({
      ...section,
      title: sanitizeString(section.title, 'moderate'),
      description: section.description ? sanitizeString(section.description, 'moderate') : section.description,
    }));
  }
  
  return sanitized;
};

/**
 * Sanitize form submission data
 * @param {Object} submissionData - Form submission responses
 * @returns {Object} - Sanitized submission data
 */
export const sanitizeFormSubmission = (submissionData) => {
  if (!submissionData) return submissionData;
  
  // Recursively sanitize all user-provided values
  return sanitizeObject(submissionData, 'strict');
};

/**
 * Express middleware to sanitize request body
 * @param {string} mode - Sanitization mode
 * @returns {Function} - Express middleware
 */
export const sanitizeRequestBody = (mode = 'strict') => {
  return (req, res, next) => {
    if (req.body) {
      req.body = sanitizeObject(req.body, mode);
    }
    next();
  };
};

/**
 * Express middleware to sanitize query parameters
 * @returns {Function} - Express middleware
 */
export const sanitizeQueryParams = () => {
  return (req, res, next) => {
    if (req.query) {
      req.query = sanitizeObject(req.query, 'strict');
    }
    next();
  };
};

export default {
  sanitizeString,
  sanitizeObject,
  sanitizeFormTemplate,
  sanitizeFormSubmission,
  sanitizeRequestBody,
  sanitizeQueryParams,
};
