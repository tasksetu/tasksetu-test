import rateLimit from 'express-rate-limit';

/**
 * Rate Limiting Middleware for API Protection
 * Implements spec 5.10 & 5.11 requirements for abuse prevention
 */

// General API rate limiter - applies to all form API routes
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.',
    error: 'RATE_LIMIT_EXCEEDED',
    retry_after: '15 minutes',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip successful requests to only count errors/failures
  skipSuccessfulRequests: false,
});

// Strict limiter for form submissions (external and authenticated)
export const formSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Only 10 submissions per 15 minutes
  message: {
    success: false,
    message: 'Too many form submissions. Please try again later.',
    error: 'SUBMISSION_RATE_LIMIT',
    retry_after: '15 minutes',
    hint: 'This limit prevents spam and abuse. If you need to submit more frequently, contact support.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Key by IP + form_id to prevent abuse of specific forms
  keyGenerator: (req) => {
    const formId = req.params.form_id || 'unknown';
    const clientIp = req.ip || 'unknown'; // Use standard Express req.ip
    return `${clientIp}:${formId}`;
  },
  // Don't count successful submissions towards the limit (only errors)
  skipSuccessfulRequests: true,
  validate: { keyGeneratorIpFallback: false },
});

// Moderate limiter for form creation/updates
export const formCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 form creations per hour
  message: {
    success: false,
    message: 'Too many forms created. Please try again later.',
    error: 'CREATION_RATE_LIMIT',
    retry_after: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

// Very strict limiter for publish operations
export const formPublishLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Only 20 publishes per hour
  message: {
    success: false,
    message: 'Too many publish operations. Please try again later.',
    error: 'PUBLISH_RATE_LIMIT',
    retry_after: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Key by user ID (if authenticated) or IP
    return req.user?.id || req.ip || 'unknown'; // Fallback to IP if unauthenticated
  },
  validate: { keyGeneratorIpFallback: false },
});

// Moderate limiter for delete operations
export const formDeleteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // 30 deletes per hour
  message: {
    success: false,
    message: 'Too many delete operations. Please try again later.',
    error: 'DELETE_RATE_LIMIT',
    retry_after: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Export all limiters
export default {
  apiLimiter,
  formSubmitLimiter,
  formCreateLimiter,
  formPublishLimiter,
  formDeleteLimiter,
};
