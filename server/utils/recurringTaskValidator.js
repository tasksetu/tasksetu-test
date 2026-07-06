/**
 * Recurring Task Pattern Validator
 * Validates recurrence patterns according to TaskSetu PRD specifications
 * All date calculations use user's timezone via TimezoneHelper
 */

import { TimezoneHelper } from './timezoneHelper.js';

/**
 * Extract date parts from a Date object in a given timezone
 * Uses UTC-based extraction to avoid server timezone bias
 * @param {Date} date
 * @param {string} [timezone='UTC']
 * @returns {{ year, month (0-based), dayOfMonth, dayOfWeek (0=Sun) }}
 */
function getDatePartsInTZ(date, timezone = 'UTC') {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short'
    });
    const parts = formatter.formatToParts(date);
    const get = (type) => parts.find(p => p.type === type)?.value || '';
    const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return {
      year: parseInt(get('year')),
      month: parseInt(get('month')) - 1, // 0-based like JS Date
      dayOfMonth: parseInt(get('day')),
      dayOfWeek: dayMap[get('weekday')] ?? date.getUTCDay()
    };
  } catch {
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth(),
      dayOfMonth: date.getUTCDate(),
      dayOfWeek: date.getUTCDay()
    };
  }
}

/**
 * Create a Date from year/month/day in a timezone (returns UTC Date)
 * @param {number} year
 * @param {number} month - 0-based
 * @param {number} day
 * @param {string} [timezone='UTC']
 * @returns {Date}
 */
function createDateInTZ(year, month, day, timezone = 'UTC') {
  try {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`;
    return TimezoneHelper.parseInTimezone(dateStr, timezone);
  } catch {
    return new Date(Date.UTC(year, month, day));
  }
}

/**
 * Get last day of month for a given year/month
 */
function getLastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Validate recurring task pattern
 * @param {Object} recurrencePattern - The recurrence pattern object from frontend
 * @param {string} [userTimezone='UTC'] - User's IANA timezone
 * @returns {Object} - { valid: boolean, errors: string[], sanitized: Object }
 */
export const validateRecurrencePattern = (recurrencePattern, userTimezone = 'UTC') => {
  const errors = [];
  const sanitized = { ...recurrencePattern };

  // 1. Check required fields
  if (!recurrencePattern) {
    return {
      valid: false,
      errors: ['Recurrence pattern is required for recurring tasks'],
      sanitized: null
    };
  }

  // 2. Validate patternType
  const validPatterns = ['daily', 'weekly', 'monthly', 'yearly', 'custom'];
  const patternType = recurrencePattern.patternType?.value || recurrencePattern.patternType;

  if (!patternType) {
    errors.push('Pattern type is required');
  } else if (!validPatterns.includes(patternType)) {
    errors.push(`Invalid pattern type: ${patternType}. Must be one of: ${validPatterns.join(', ')}`);
  }

  // Normalize patternType if it's an object
  if (recurrencePattern.patternType?.value) {
    sanitized.patternType = recurrencePattern.patternType.value;
  }

  // 3. Validate repeatEvery
  const repeatEvery = parseInt(recurrencePattern.repeatEvery);
  if (!repeatEvery || repeatEvery < 1) {
    errors.push('Repeat interval must be at least 1');
  } else {
    sanitized.repeatEvery = repeatEvery;
  }

  // 4. Validate startDate
  if (!recurrencePattern.startDate) {
    errors.push('Start date is required');
  } else {
    const startDate = new Date(recurrencePattern.startDate);
    // Use user's timezone to determine "today" boundary
    const { startOfDay: todayStart } = TimezoneHelper.getDayBoundaries(userTimezone);

    if (isNaN(startDate.getTime())) {
      errors.push('Invalid start date format');
    } else if (startDate < todayStart) {
      errors.push('Start date cannot be in the past');
    } else {
      sanitized.startDate = startDate.toISOString();
    }
  }

  // 5. Validate dueTime (optional, replaces startTime)
  const timeField = recurrencePattern.dueTime || recurrencePattern.startTime; // Backward compatibility
  if (timeField) {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(timeField)) {
      errors.push('Invalid time format (expected HH:MM)');
    } else {
      sanitized.dueTime = timeField;
    }
  } else {
    sanitized.dueTime = '17:00'; // Default due time (5 PM)
  }

  // 6. Pattern-specific validations
  switch (patternType) {
    case 'weekly':
      // Weekly requires weekdays selection
      if (!recurrencePattern.weekdays || recurrencePattern.weekdays.length === 0) {
        errors.push('Weekly pattern requires at least one weekday selection');
      } else {
        // Normalize weekdays if they're objects
        sanitized.weekdays = recurrencePattern.weekdays.map(wd =>
          typeof wd === 'object' ? wd.value : wd
        );

        // Validate weekday values
        const validWeekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const invalidWeekdays = sanitized.weekdays.filter(wd => !validWeekdays.includes(wd));
        if (invalidWeekdays.length > 0) {
          errors.push(`Invalid weekdays: ${invalidWeekdays.join(', ')}`);
        }
      }
      break;

    case 'monthly':
      const monthlyMode = recurrencePattern.monthlyMode;

      if (!monthlyMode) {
        errors.push('Monthly pattern requires a mode selection (by_date, by_position, or specific_date)');
      } else if (monthlyMode === 'by_date') {
        // Validate month days
        if (!recurrencePattern.monthDays || recurrencePattern.monthDays.length === 0) {
          errors.push('Monthly by_date mode requires at least one day selection');
        } else {
          sanitized.monthDays = recurrencePattern.monthDays.map(md =>
            typeof md === 'object' ? md.value : md
          );

          // Validate day range (1-31)
          const invalidDays = sanitized.monthDays.filter(day => day < 1 || day > 31);
          if (invalidDays.length > 0) {
            errors.push(`Invalid month days: ${invalidDays.join(', ')} (must be 1-31)`);
          }
        }
      } else if (monthlyMode === 'by_position') {
        // Validate position and weekday
        if (!recurrencePattern.monthPosition) {
          errors.push('Monthly by_position mode requires position selection');
        } else {
          sanitized.monthPosition = typeof recurrencePattern.monthPosition === 'object'
            ? recurrencePattern.monthPosition.value
            : recurrencePattern.monthPosition;
        }

        if (!recurrencePattern.monthWeekday) {
          errors.push('Monthly by_position mode requires weekday selection');
        } else {
          sanitized.monthWeekday = typeof recurrencePattern.monthWeekday === 'object'
            ? recurrencePattern.monthWeekday.value
            : recurrencePattern.monthWeekday;
        }
      } else if (monthlyMode === 'specific_date') {
        // Validate specific date
        const specificDate = parseInt(recurrencePattern.specificDate);
        if (!specificDate || specificDate < 1 || specificDate > 31) {
          errors.push('Specific date must be between 1 and 31');
        } else {
          sanitized.specificDate = specificDate;
        }
      }
      break;

    case 'yearly':
      // Yearly requires single month selection
      if (!recurrencePattern.yearMonths) {
        errors.push('Yearly pattern requires a month selection');
      } else {
        // Extract month value from object or use directly if number
        const monthValue = typeof recurrencePattern.yearMonths === 'object'
          ? recurrencePattern.yearMonths.value
          : recurrencePattern.yearMonths;

        // Validate month range (1-12)
        if (monthValue < 1 || monthValue > 12) {
          errors.push(`Invalid month: ${monthValue} (must be 1-12)`);
        } else {
          sanitized.yearMonths = monthValue;
        }
      }

      // Validate year day
      const yearDay = parseInt(recurrencePattern.yearDay);
      if (yearDay && (yearDay < 1 || yearDay > 31)) {
        errors.push('Year day must be between 1 and 31');
      } else if (yearDay) {
        sanitized.yearDay = yearDay;
      }
      break;

    case 'custom':
      // Custom pattern requires array of custom dates
      if (!recurrencePattern.customDates || !Array.isArray(recurrencePattern.customDates) || recurrencePattern.customDates.length === 0) {
        errors.push('Custom pattern requires at least one custom date');
      } else {
        // Validate each custom date
        const validDates = [];
        const invalidDates = [];

        recurrencePattern.customDates.forEach((dateStr, index) => {
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) {
            invalidDates.push(`Index ${index}: ${dateStr}`);
          } else {
            validDates.push(dateStr);
          }
        });

        if (invalidDates.length > 0) {
          errors.push(`Invalid custom dates: ${invalidDates.join(', ')}`);
        }

        if (validDates.length > 0) {
          // Sort dates in ascending order and remove duplicates
          const uniqueSortedDates = [...new Set(validDates)].sort();
          sanitized.customDates = uniqueSortedDates;
        } else {
          errors.push('No valid custom dates found');
        }
      }
      break;

    default:
      // Daily pattern has no additional requirements
      break;
  }

  // 7. Validate end condition
  const endCondition = recurrencePattern.endCondition?.value || recurrencePattern.endCondition;
  const validEndConditions = ['never', 'after', 'by_date'];

  if (!endCondition) {
    errors.push('End condition is required');
  } else if (!validEndConditions.includes(endCondition)) {
    errors.push(`Invalid end condition: ${endCondition}`);
  } else {
    // Normalize endCondition
    sanitized.endCondition = endCondition;

    if (endCondition === 'after') {
      const occurrences = parseInt(recurrencePattern.occurrences);
      if (!occurrences || occurrences < 1) {
        errors.push('Number of occurrences must be at least 1');
      } else {
        sanitized.occurrences = occurrences;
      }
    } else if (endCondition === 'by_date') {
      if (!recurrencePattern.endDate) {
        errors.push('End date is required when end condition is "by_date"');
      } else {
        const endDate = new Date(recurrencePattern.endDate);
        const startDate = new Date(recurrencePattern.startDate);

        if (isNaN(endDate.getTime())) {
          errors.push('Invalid end date format');
        } else if (endDate <= startDate) {
          errors.push('End date must be after start date');
        } else {
          sanitized.endDate = endDate.toISOString();
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : null
  };
};

/**
 * Generate human-readable summary of recurrence pattern
 * @param {Object} pattern - Sanitized recurrence pattern
 * @param {string} [userTimezone='UTC'] - User's IANA timezone
 * @returns {string} - Human-readable summary
 */
export const generateRecurrenceSummary = (pattern, userTimezone = 'UTC') => {
  if (!pattern || !pattern.patternType) {
    return 'Invalid recurrence pattern';
  }

  const { patternType, repeatEvery, dueTime, startDate, endCondition } = pattern;
  let summary = '';

  // Pattern description
  switch (patternType) {
    case 'daily':
      summary = repeatEvery === 1
        ? 'Daily'
        : `Every ${repeatEvery} days`;
      break;

    case 'weekly':
      const weekdays = pattern.weekdays || [];
      const weekdayNames = weekdays.map(wd =>
        wd.charAt(0).toUpperCase() + wd.slice(1)
      ).join(', ');

      summary = repeatEvery === 1
        ? `Weekly on ${weekdayNames}`
        : `Every ${repeatEvery} weeks on ${weekdayNames}`;
      break;

    case 'monthly':
      if (pattern.monthlyMode === 'by_date' && pattern.monthDays) {
        const days = pattern.monthDays.sort((a, b) => a - b).join(', ');
        summary = repeatEvery === 1
          ? `Monthly on day(s) ${days}`
          : `Every ${repeatEvery} months on day(s) ${days}`;
      } else if (pattern.monthlyMode === 'by_position' && pattern.monthPosition && pattern.monthWeekday) {
        const position = pattern.monthPosition.charAt(0).toUpperCase() + pattern.monthPosition.slice(1);
        const weekday = pattern.monthWeekday.charAt(0).toUpperCase() + pattern.monthWeekday.slice(1);
        summary = repeatEvery === 1
          ? `Monthly on ${position} ${weekday}`
          : `Every ${repeatEvery} months on ${position} ${weekday}`;
      } else if (pattern.monthlyMode === 'specific_date' && pattern.specificDate) {
        summary = repeatEvery === 1
          ? `Monthly on day ${pattern.specificDate}`
          : `Every ${repeatEvery} months on day ${pattern.specificDate}`;
      } else {
        summary = repeatEvery === 1 ? 'Monthly' : `Every ${repeatEvery} months`;
      }
      break;

    case 'yearly':
      const monthValue = pattern.yearMonths;
      const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthLabel = monthValue ? monthNames[monthValue] : '';
      const yearDay = pattern.yearDay || 1;

      summary = repeatEvery === 1
        ? `Yearly on ${monthLabel} ${yearDay}`
        : `Every ${repeatEvery} years on ${monthLabel} ${yearDay}`;
      break;

    case 'custom':
      const customDatesCount = pattern.customDates ? pattern.customDates.length : 0;
      summary = customDatesCount > 0
        ? `Custom schedule (${customDatesCount} date${customDatesCount > 1 ? 's' : ''})`
        : 'Custom schedule';
      break;

    default:
      summary = 'Unknown pattern';
  }

  // Add due time
  if (dueTime) {
    summary += ` due at ${dueTime}`;
  }

  // Add end condition
  if (endCondition === 'after' && pattern.occurrences) {
    summary += `, ends after ${pattern.occurrences} occurrences`;
  } else if (endCondition === 'by_date' && pattern.endDate) {
    const endDateObj = new Date(pattern.endDate);
    summary += `, ends ${endDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: userTimezone })}`;
  } else {
    summary += ', never ends';
  }

  return summary;
};

/**
 * Generate detailed explanation of recurrence pattern (for logging/documentation)
 * @param {Object} pattern - Sanitized recurrence pattern
 * @param {string} [userTimezone='UTC'] - User's IANA timezone
 * @returns {Object} - Detailed explanation object
 */
export const generateDetailedExplanation = (pattern, userTimezone = 'UTC') => {
  if (!pattern || !pattern.patternType) {
    return { error: 'Invalid recurrence pattern' };
  }

  const explanation = {
    patternType: pattern.patternType,
    frequency: pattern.repeatEvery,
    startDate: pattern.startDate,
    dueTime: pattern.dueTime || '17:00',
    summary: generateRecurrenceSummary(pattern, userTimezone),
    details: {}
  };

  // Pattern-specific details
  switch (pattern.patternType) {
    case 'daily':
      explanation.details = {
        description: `Task will repeat every ${pattern.repeatEvery === 1 ? 'day' : `${pattern.repeatEvery} days`}`,
        example: 'If start date is Jan 1, next occurrences: Jan 2, Jan 3, Jan 4...'
      };
      break;

    case 'weekly':
      const weekdays = pattern.weekdays || [];
      explanation.details = {
        description: `Task will repeat on ${weekdays.join(', ')} every ${pattern.repeatEvery === 1 ? 'week' : `${pattern.repeatEvery} weeks`}`,
        selectedDays: weekdays,
        example: weekdays.length > 0
          ? `If start date is Monday Jan 1, and ${weekdays[0]} is selected, next occurrences will be on ${weekdays[0]} only`
          : 'Select weekdays to see example'
      };
      break;

    case 'monthly':
      if (pattern.monthlyMode === 'by_date') {
        const days = pattern.monthDays || [];
        explanation.details = {
          mode: 'by_date',
          description: `Task will repeat on day(s) ${days.join(', ')} of each month`,
          selectedDays: days,
          example: `If days 2 and 15 are selected, task will be created on 2nd and 15th of every month`
        };
      } else if (pattern.monthlyMode === 'by_position') {
        explanation.details = {
          mode: 'by_position',
          description: `Task will repeat on ${pattern.monthPosition} ${pattern.monthWeekday} of each month`,
          position: pattern.monthPosition,
          weekday: pattern.monthWeekday,
          example: `If "Second Monday" is selected, task will be created on 2nd Monday of every month`
        };
      } else if (pattern.monthlyMode === 'specific_date') {
        explanation.details = {
          mode: 'specific_date',
          description: `Task will repeat on day ${pattern.specificDate} of each month`,
          day: pattern.specificDate,
          example: `Task will be created on ${pattern.specificDate}th day of every month`
        };
      }
      break;

    case 'yearly':
      const monthValue = pattern.yearMonths;
      const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const selectedMonth = monthValue ? monthNames[monthValue] : '';

      explanation.details = {
        description: `Task will repeat on day ${pattern.yearDay || 1} of ${selectedMonth}`,
        selectedMonth: selectedMonth,
        day: pattern.yearDay || 1,
        example: `Task will be created on ${selectedMonth} ${pattern.yearDay || 1} every year`
      };
      break;

    case 'custom':
      explanation.details = {
        description: 'Custom explicit dates (Phase II feature)',
        example: 'Select specific upcoming dates manually'
      };
      break;
  }

  // End condition details
  if (pattern.endCondition === 'after') {
    explanation.endCondition = {
      type: 'after_occurrences',
      value: pattern.occurrences,
      description: `Series will stop after ${pattern.occurrences} task instances are created`
    };
  } else if (pattern.endCondition === 'by_date') {
    const endDate = new Date(pattern.endDate);
    explanation.endCondition = {
      type: 'by_date',
      value: pattern.endDate,
      description: `Series will stop on ${endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: userTimezone })}`
    };
  } else {
    explanation.endCondition = {
      type: 'never',
      description: 'Series will continue indefinitely until manually stopped'
    };
  }

  return explanation;
};

/**
 * Calculate next occurrence date based on pattern (ENHANCED VERSION)
 * @param {Date} currentDate - Current occurrence date
 * @param {Object} pattern - Recurrence pattern
 * @param {string} [userTimezone='UTC'] - User's IANA timezone
 * @returns {Date|null} - Next occurrence date or null if series ended
 */
export const calculateNextOccurrence = (currentDate, pattern, userTimezone = 'UTC') => {
  if (!currentDate || !pattern) return null;

  const { patternType, repeatEvery, endCondition, occurrences, endDate, customDates } = pattern;

  // ✅ Custom pattern: Find next date in customDates array
  if (patternType === 'custom' && customDates && customDates.length > 0) {
    const current = new Date(currentDate);
    const sortedDates = [...customDates].sort();

    // Find next date after current date
    for (const dateStr of sortedDates) {
      const date = new Date(dateStr);
      if (date > current) {
        console.log('🗓️ [BACKEND] Custom pattern next occurrence:', {
          currentDate: current.toISOString(),
          nextOccurrence: date.toISOString(),
          totalCustomDates: sortedDates.length
        });
        return date;
      }
    }

    // No more dates in the custom dates list
    console.log('🗓️ [BACKEND] Custom pattern: No more occurrences (all dates completed)');
    return null;
  }

  const nextDate = new Date(currentDate);

  switch (patternType) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + repeatEvery);
      break;

    case 'weekly': {
      // For weekly, find next weekday occurrence
      const weekdays = pattern.weekdays || [];
      if (weekdays.length === 0) {
        nextDate.setDate(nextDate.getDate() + 7 * repeatEvery);
        break;
      }

      const weekdayMap = {
        'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
        'thursday': 4, 'friday': 5, 'saturday': 6
      };
      const selectedDays = weekdays.map(wd => {
        const value = typeof wd === 'string' ? wd : wd.value;
        return weekdayMap[value.toLowerCase()];
      }).sort((a, b) => a - b);

      // Find next weekday
      let found = false;
      let daysToAdd = 1;
      const currentDay = getDatePartsInTZ(currentDate, userTimezone).dayOfWeek;

      // Try to find next day in current week cycle
      for (let i = 0; i < selectedDays.length && !found; i++) {
        if (selectedDays[i] > currentDay) {
          daysToAdd = selectedDays[i] - currentDay;
          found = true;
        }
      }

      // If not found in current week, go to next cycle's first day
      if (!found) {
        daysToAdd = (7 - currentDay) + selectedDays[0];
      }

      nextDate.setDate(nextDate.getDate() + daysToAdd);
      break;
    }

    case 'monthly': {
      const monthlyMode = pattern.monthlyMode;

      if (monthlyMode === 'by_date') {
        const monthDays = pattern.monthDays || [];
        if (monthDays.length === 0) {
          nextDate.setMonth(nextDate.getMonth() + repeatEvery);
          break;
        }

        const days = monthDays.map(md => {
          return typeof md === 'number' ? md : md.value;
        }).sort((a, b) => a - b);

        const currentDay = getDatePartsInTZ(currentDate, userTimezone).dayOfMonth;

        // Find next day in current month
        const nextDayInMonth = days.find(d => d > currentDay);
        if (nextDayInMonth) {
          nextDate.setDate(nextDayInMonth);
        } else {
          // Move to next month's first day
          nextDate.setMonth(nextDate.getMonth() + repeatEvery);
          nextDate.setDate(days[0]);
        }
      } else if (monthlyMode === 'by_position') {
        // Calculate next Nth weekday of month
        const monthPosition = pattern.monthPosition;
        const monthWeekday = pattern.monthWeekday;

        if (monthPosition && monthWeekday) {
          // Move to next month first
          nextDate.setMonth(nextDate.getMonth() + repeatEvery);

          // Calculate Nth weekday of new month
          const getNthWeekdayOfMonth = (year, month, weekday, position) => {
            const weekdayMap = {
              'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
              'thursday': 4, 'friday': 5, 'saturday': 6
            };
            const weekdayValue = typeof weekday === 'string' ? weekday : weekday.value;
            const positionValue = typeof position === 'string' ? position : position.value;
            const targetWeekday = weekdayMap[weekdayValue.toLowerCase()];

            // Use UTC-based calendar math to avoid server timezone issues
            const firstDay = new Date(Date.UTC(year, month, 1));
            const firstWeekday = firstDay.getUTCDay();

            if (positionValue === 'last') {
              const lastDay = new Date(Date.UTC(year, month + 1, 0));
              const lastWeekday = lastDay.getUTCDay();
              let daysToSubtract = (lastWeekday - targetWeekday + 7) % 7;
              return new Date(Date.UTC(year, month, lastDay.getUTCDate() - daysToSubtract));
            } else {
              const positionMap = { 'first': 1, 'second': 2, 'third': 3, 'fourth': 4 };
              const occurrence = positionMap[positionValue];
              let daysUntilTarget = (targetWeekday - firstWeekday + 7) % 7;
              let targetDate = 1 + daysUntilTarget + (occurrence - 1) * 7;
              return new Date(Date.UTC(year, month, targetDate));
            }
          };

          const nextParts = getDatePartsInTZ(nextDate, userTimezone);
          const calculatedDate = getNthWeekdayOfMonth(
            nextParts.year,
            nextParts.month,
            monthWeekday,
            monthPosition
          );

          return calculatedDate;
        } else {
          nextDate.setMonth(nextDate.getMonth() + repeatEvery);
        }
      } else if (monthlyMode === 'specific_date') {
        const specificDate = parseInt(pattern.specificDate);
        if (specificDate) {
          // ✅ Move to next month first
          nextDate.setMonth(nextDate.getMonth() + repeatEvery);

          // ✅ Handle months with fewer days (e.g., Feb 29 should use Feb 28 in non-leap years)
          // Get the last day of the target month using timezone-aware parts
          const targetParts = getDatePartsInTZ(nextDate, userTimezone);
          const targetYear = targetParts.year;
          const targetMonth = targetParts.month;
          const lastDayOfMonth = getLastDayOfMonth(targetYear, targetMonth);

          // Use the minimum of specificDate and lastDayOfMonth
          const actualDay = Math.min(specificDate, lastDayOfMonth);

          nextDate.setDate(actualDay);

          console.log('🗓️ [BACKEND] Specific date calculation:', {
            specificDate,
            targetMonth: targetMonth + 1,
            lastDayOfMonth,
            actualDay,
            resultDate: nextDate.toISOString()
          });
        } else {
          nextDate.setMonth(nextDate.getMonth() + repeatEvery);
        }
      } else {
        nextDate.setMonth(nextDate.getMonth() + repeatEvery);
      }
      break;
    }

    case 'yearly': {
      const monthValue = pattern.yearMonths;
      const currentParts = getDatePartsInTZ(currentDate, userTimezone);
      const yearDay = parseInt(pattern.yearDay) || currentParts.dayOfMonth;

      if (!monthValue) {
        // No specific month, just add repeat years
        nextDate.setFullYear(nextDate.getFullYear() + repeatEvery);
        break;
      }

      // Extract numeric month value
      const targetMonth = typeof monthValue === 'number' ? monthValue : monthValue.value;
      const currentMonth = currentParts.month + 1; // 1-based
      const currentYear = currentParts.year;

      // If target month is later in the current year
      if (targetMonth > currentMonth) {
        nextDate.setFullYear(currentYear);
        nextDate.setMonth(targetMonth - 1);
        nextDate.setDate(yearDay);
      } else {
        // Move to next occurrence (repeatEvery years ahead)
        nextDate.setFullYear(currentYear + repeatEvery);
        nextDate.setMonth(targetMonth - 1);
        nextDate.setDate(yearDay);
      }
      break;
    }

    default:
      // For custom or unknown patterns, just add the repeat interval in days
      nextDate.setDate(nextDate.getDate() + repeatEvery);
  }

  // Check end conditions
  if (endCondition === 'by_date' && endDate) {
    const endDateObj = new Date(endDate);
    if (nextDate > endDateObj) {
      return null; // Series ended
    }
  }

  // Note: For 'after N occurrences', this should be tracked separately
  // in the task's occurrence counter

  return nextDate;
};

/**
 * Calculate first occurrence date for a recurring task
 * Matches frontend logic exactly, especially for monthly specific_date pattern
 * @param {Object} pattern - The recurrence pattern
 * @param {string} [userTimezone='UTC'] - User's IANA timezone
 * @returns {Date} - The first occurrence date
 */
export const calculateFirstOccurrence = (pattern, userTimezone = 'UTC') => {
  if (!pattern) return new Date();

  const { patternType, customDates, startDate, repeatEvery, monthlyMode, specificDate } = pattern;

  // ✅ Custom pattern: Use first custom date
  if (patternType === 'custom' && customDates && customDates.length > 0) {
    const sortedDates = [...customDates].sort();
    const firstDate = new Date(sortedDates[0]);
    console.log('🗓️ [BACKEND] Custom pattern first occurrence:', {
      customDates,
      sortedDates,
      firstOccurrence: firstDate.toISOString()
    });
    return firstDate;
  }

  // For other patterns, startDate is required
  if (!startDate) return new Date();
  const startDateObj = new Date(startDate);

  // For most patterns, first occurrence is the start date
  if (patternType !== 'monthly' || monthlyMode !== 'specific_date') {
    return startDateObj;
  }

  // ✅ Special handling for monthly specific_date pattern
  // Matches frontend RecurrencePanel logic (lines 282-310)
  if (monthlyMode === 'specific_date' && specificDate) {
    const startParts = getDatePartsInTZ(startDateObj, userTimezone);
    const startDay = startParts.dayOfMonth;
    let monthOffset = 0;

    // If specific date is earlier than start date's day, skip to next month
    if (specificDate < startDay) {
      monthOffset = 1;
    }

    const totalMonth = startParts.month + monthOffset * (repeatEvery || 1);
    const targetYear = startParts.year + Math.floor(totalMonth / 12);
    const adjustedMonth = totalMonth % 12;

    // ✅ Handle months with fewer days (e.g., Feb 29 should use Feb 28 in non-leap years)
    const lastDayOfMonth = getLastDayOfMonth(targetYear, adjustedMonth);
    const actualDay = Math.min(specificDate, lastDayOfMonth);

    const firstOccurrence = createDateInTZ(targetYear, adjustedMonth, actualDay, userTimezone);

    console.log('🗓️ [BACKEND] First occurrence calculation:', {
      startDate: startDateObj.toISOString(),
      specificDate,
      monthOffset,
      targetMonth: adjustedMonth + 1,
      lastDayOfMonth,
      actualDay,
      firstOccurrence: firstOccurrence.toISOString()
    });

    return firstOccurrence;
  }

  return startDateObj;
};

export default {
  validateRecurrencePattern,
  generateRecurrenceSummary,
  generateDetailedExplanation,
  calculateNextOccurrence,
  calculateFirstOccurrence
};
