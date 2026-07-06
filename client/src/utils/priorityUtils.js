/**
 * Priority Utilities
 * Centralized utilities for handling dynamic task priorities across the application
 */

/**
 * Get priority options dynamically from task priorities configuration
 * Falls back to default priorities if custom ones aren't loaded yet
 * 
 * @param {Array} taskPriorities - Array of task priority objects from backend
 * @param {boolean} includeAll - Whether to include "All Priority" option for filters
 * @returns {Array} Array of priority options {value, label, color}
 */
export const getPriorityOptions = (taskPriorities = [], includeAll = false) => {
  // Filter and sort active priorities
  const activePriorities = (Array.isArray(taskPriorities) ? taskPriorities : [])
    .filter((p) => p && p.active)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // If we have custom priorities, use them
  if (activePriorities.length > 0) {
    const options = activePriorities.map((p) => ({
      value: p.code,
      label: p.label,
      color: p.color,
      daysToDue: p.daysToDue,
    }));

    if (includeAll) {
      return [{ value: "all", label: "All Priority" }, ...options];
    }
    return options;
  }

  // Fallback to default priorities
  const defaultOptions = [
    { value: "low", label: "Low", color: "#10B981", daysToDue: 30 },
    { value: "medium", label: "Medium", color: "#F59E0B", daysToDue: 14 },
    { value: "high", label: "High", color: "#EF4444", daysToDue: 7 },
    { value: "critical", label: "Critical", color: "#DC2626", daysToDue: 2 },
  ];

  if (includeAll) {
    return [{ value: "all", label: "All Priority" }, ...defaultOptions];
  }
  return defaultOptions;
};

/**
 * Get the default priority code (usually the first active priority or "medium")
 * 
 * @param {Array} taskPriorities - Array of task priority objects from backend
 * @returns {string} Default priority code
 */
export const getDefaultPriorityCode = (taskPriorities = []) => {
  const options = getPriorityOptions(taskPriorities);
  return options.length > 0 ? options[0].value : "medium";
};

/**
 * Get priority color by code
 * 
 * @param {string} priorityCode - Priority code (e.g., "low", "medium", "high")
 * @param {Array} taskPriorities - Array of task priority objects from backend
 * @returns {string} Color hex code
 */
export const getPriorityColor = (priorityCode, taskPriorities = []) => {
  const code = String(priorityCode || "").toLowerCase();
  const options = getPriorityOptions(taskPriorities);
  const priority = options.find((p) => p.value === code);
  
  if (priority?.color) return priority.color;
  
  // Fallback colors
  const fallbackColors = {
    low: "#10B981",    // Green
    medium: "#F59E0B", // Yellow
    high: "#EF4444",   // Red
    critical: "#DC2626", // Dark Red
    urgent: "#B91C1C", // Darker Red
  };
  return fallbackColors[code] || fallbackColors.medium;
};

/**
 * Get priority label by code
 * 
 * @param {string} priorityCode - Priority code (e.g., "low", "medium", "high")
 * @param {Array} taskPriorities - Array of task priority objects from backend
 * @returns {string} Priority label
 */
export const getPriorityLabel = (priorityCode, taskPriorities = []) => {
  const code = String(priorityCode || "").toLowerCase();
  const options = getPriorityOptions(taskPriorities);
  const priority = options.find((p) => p.value === code);
  
  if (priority?.label) return priority.label;
  
  // Fallback to capitalized code
  return code.charAt(0).toUpperCase() + code.slice(1);
};

/**
 * Get priority badge CSS classes
 * 
 * @param {string} priorityCode - Priority code (e.g., "low", "medium", "high")
 * @returns {string} CSS classes for badge styling
 */
export const getPriorityBadgeClasses = (priorityCode) => {
  const code = String(priorityCode || "").toLowerCase();
  const styles = {
    low: "bg-green-100 text-green-800 border-green-200",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    high: "bg-red-100 text-red-800 border-red-200",
    critical: "bg-red-100 text-red-900 border-red-300",
    urgent: "bg-red-100 text-red-900 border-red-300",
  };
  return `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[code] || styles.medium}`;
};

/**
 * Calculate due date based on priority daysToDue configuration
 * 
 * @param {string} priorityCode - Priority code (e.g., "low", "medium", "high")
 * @param {Array} taskPriorities - Array of task priority objects from backend
 * @param {Date} fromDate - Starting date (defaults to today)
 * @returns {string} Due date in YYYY-MM-DD format
 */
export const calculateDueDateFromPriority = (priorityCode, taskPriorities = [], fromDate = new Date()) => {
  const code = String(priorityCode || "").toLowerCase();
  const options = getPriorityOptions(taskPriorities);
  const priority = options.find((p) => p.value === code);
  
  let daysToAdd = 14; // default
  if (priority && Number.isFinite(priority.daysToDue)) {
    daysToAdd = priority.daysToDue;
  } else {
    // Fallback defaults
    const defaults = { critical: 2, urgent: 1, high: 7, medium: 14, low: 30 };
    daysToAdd = defaults[code] || 14;
  }
  
  const dueDate = new Date(fromDate);
  dueDate.setDate(dueDate.getDate() + daysToAdd);
  return dueDate.toISOString().split("T")[0];
};
