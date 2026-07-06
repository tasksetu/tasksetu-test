// utils/passwordUtils.js

// Centralized rules
export const passwordRules = [
  { test: (pwd) => pwd.length >= 8, text: "At least 8 characters" },
  { test: (pwd) => /[0-9]/.test(pwd), text: "Contains a number" },
  { test: (pwd) => /[a-z]/.test(pwd), text: "Contains lowercase letter" },
  { test: (pwd) => /[A-Z]/.test(pwd), text: "Contains uppercase letter" },
  { test: (pwd) => /[!@#$%^&*(),.?\":{}|<>]/.test(pwd), text: "Contains special character" },
];

/**
 * Returns detailed requirement check for UI checklist
 */
export const getPasswordRequirements = (password) => {
  return passwordRules.map((rule, idx) => ({
    id: idx, // helpful for React keys
    text: rule.text,
    ok: rule.test(password), // clearer than "test"
  }));
};

/**
 * Validates password and returns status + failed rules
 */
export const validatePassword = (password) => {
  const failed = passwordRules
    .filter((rule) => !rule.test(password))
    .map((rule) => rule.text);

  return {
    valid: failed.length === 0,
    failed, // empty array if valid
  };
};
