/**
 * Timezone Helper Utility
 * Centralizes all timezone-aware date operations for the project.
 * All user-facing dates/times should use these helpers instead of raw new Date() methods.
 * 
 * Usage:
 *   import { TimezoneHelper } from '../utils/timezoneHelper.js';
 *   
 *   // Get user's timezone from their notification settings
 *   const tz = await TimezoneHelper.getUserTimezone(userId);
 *   
 *   // Get "now" in user's timezone
 *   const { hours, minutes, dayOfWeek } = TimezoneHelper.getLocalTime(tz);
 *   
 *   // Get start/end of "today" in user's timezone (as UTC Date objects for DB queries)
 *   const { startOfDay, endOfDay } = TimezoneHelper.getDayBoundaries(tz);
 */

import { NotificationSettings } from '../modals/notificationSettingsModal.js';

export class TimezoneHelper {

    /**
     * Get user's timezone from notification settings
     * @param {string|ObjectId} userId
     * @returns {Promise<string>} IANA timezone string (e.g. 'Asia/Kolkata')
     */
    static async getUserTimezone(userId) {
        try {
            const settings = await NotificationSettings.findOne({ user_id: userId }).select('timezone').lean();
            return settings?.timezone || 'UTC';
        } catch (error) {
            console.warn(`[TimezoneHelper] Could not fetch timezone for user ${userId}, defaulting to UTC`);
            return 'UTC';
        }
    }

    /**
     * Get current time parts in a specific timezone
     * @param {string} timezone - IANA timezone string
     * @returns {{ hours: number, minutes: number, seconds: number, dayOfWeek: string, dayOfMonth: number, month: number, year: number, timeStr: string, dateStr: string }}
     */
    static getLocalTime(timezone) {
        try {
            const now = new Date();
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
                weekday: 'long',
                day: 'numeric',
                month: 'numeric',
                year: 'numeric'
            });
            const parts = formatter.formatToParts(now);
            const get = (type) => parts.find(p => p.type === type)?.value || '';

            const hours = parseInt(get('hour')) || 0;
            const minutes = parseInt(get('minute')) || 0;
            const seconds = parseInt(get('second')) || 0;
            const dayOfWeek = (get('weekday') || 'monday').toLowerCase();
            const dayOfMonth = parseInt(get('day')) || 1;
            const month = parseInt(get('month')) || 1;
            const year = parseInt(get('year')) || new Date().getFullYear();
            const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;

            return { hours, minutes, seconds, dayOfWeek, dayOfMonth, month, year, timeStr, dateStr };
        } catch (error) {
            // Fallback to UTC
            const now = new Date();
            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            return {
                hours: now.getUTCHours(),
                minutes: now.getUTCMinutes(),
                seconds: now.getUTCSeconds(),
                dayOfWeek: days[now.getUTCDay()],
                dayOfMonth: now.getUTCDate(),
                month: now.getUTCMonth() + 1,
                year: now.getUTCFullYear(),
                timeStr: `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`,
                dateStr: now.toISOString().split('T')[0]
            };
        }
    }

    /**
     * Get start-of-day and end-of-day in user's timezone as UTC Date objects
     * Useful for DB queries like "tasks due today in user's timezone"
     * @param {string} timezone - IANA timezone string
     * @param {Date} [referenceDate] - Date to get boundaries for (default: now)
     * @returns {{ startOfDay: Date, endOfDay: Date }}
     */
    static getDayBoundaries(timezone, referenceDate = null) {
        try {
            const local = this.getLocalTime(timezone);

            // Build a date string in user's local date, then convert to UTC
            const dateStr = referenceDate
                ? this.formatDateInTimezone(referenceDate, timezone, 'yyyy-MM-dd')
                : local.dateStr;

            // Create start of day in user's timezone
            const startStr = `${dateStr}T00:00:00`;
            const endStr = `${dateStr}T23:59:59.999`;

            const startOfDay = this.parseInTimezone(startStr, timezone);
            const endOfDay = this.parseInTimezone(endStr, timezone);

            return { startOfDay, endOfDay };
        } catch (error) {
            // Fallback: server timezone
            const now = referenceDate || new Date();
            const startOfDay = new Date(now);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(now);
            endOfDay.setHours(23, 59, 59, 999);
            return { startOfDay, endOfDay };
        }
    }

    /**
     * Parse a datetime string as if it's in a specific timezone, returning a UTC Date
     * @param {string} dateTimeStr - e.g. '2026-02-28T09:00:00'
     * @param {string} timezone - IANA timezone string
     * @returns {Date} UTC Date object
     */
    static parseInTimezone(dateTimeStr, timezone) {
        try {
            // Use Intl to calculate UTC offset for given timezone
            const date = new Date(dateTimeStr + 'Z'); // Treat as UTC first
            const utcTime = date.getTime();

            // Get the offset for this timezone at this time
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });

            // Format the UTC time in the target timezone to find the offset
            const parts = formatter.formatToParts(date);
            const get = (type) => parseInt(parts.find(p => p.type === type)?.value || '0');

            const tzYear = get('year');
            const tzMonth = get('month');
            const tzDay = get('day');
            const tzHour = get('hour');
            const tzMinute = get('minute');
            const tzSecond = get('second');

            // Reconstruct what the UTC time looks like in the target timezone
            const tzDate = new Date(Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, tzSecond));
            const offset = tzDate.getTime() - utcTime; // ms offset

            // Parse the original string as a local time in the given timezone
            const localDate = new Date(dateTimeStr);
            // We need to invert: if timezone is UTC+5:30, we subtract 5:30 from local to get UTC
            const result = new Date(localDate.getTime() - offset);

            return result;
        } catch (error) {
            return new Date(dateTimeStr);
        }
    }

    /**
     * Format a Date object in a specific timezone for display
     * @param {Date} date - UTC Date object
     * @param {string} timezone - IANA timezone string
     * @param {Object} [options] - Intl.DateTimeFormat options
     * @returns {string} Formatted date string
     */
    static formatInTimezone(date, timezone, options = {}) {
        try {
            const defaultOptions = {
                timeZone: timezone,
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                ...options
            };
            return new Intl.DateTimeFormat('en-IN', defaultOptions).format(date);
        } catch (error) {
            return date.toLocaleDateString('en-IN');
        }
    }

    /**
     * Format a Date as 'yyyy-MM-dd' in a specific timezone
     * @param {Date} date
     * @param {string} timezone
     * @returns {string} 'yyyy-MM-dd'
     */
    static formatDateInTimezone(date, timezone) {
        try {
            const formatter = new Intl.DateTimeFormat('en-CA', {  // en-CA gives yyyy-MM-dd format
                timeZone: timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            return formatter.format(date);
        } catch (error) {
            return date.toISOString().split('T')[0];
        }
    }

    /**
     * Format date + time in timezone for display
     * @param {Date} date
     * @param {string} timezone
     * @returns {string} e.g. "28 Feb 2026, 09:30 AM"
     */
    static formatDateTimeInTimezone(date, timezone) {
        try {
            return new Intl.DateTimeFormat('en-IN', {
                timeZone: timezone,
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }).format(date);
        } catch (error) {
            return date.toLocaleString('en-IN');
        }
    }

    /**
     * Format time only in timezone
     * @param {Date} date
     * @param {string} timezone
     * @returns {string} e.g. "09:30 AM"
     */
    static formatTimeInTimezone(date, timezone) {
        try {
            return new Intl.DateTimeFormat('en-IN', {
                timeZone: timezone,
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }).format(date);
        } catch (error) {
            return date.toLocaleTimeString('en-IN');
        }
    }

    /**
     * Check if two dates are the same "day" in a given timezone
     * @param {Date} date1
     * @param {Date} date2
     * @param {string} timezone
     * @returns {boolean}
     */
    static isSameDay(date1, date2, timezone) {
        return this.formatDateInTimezone(date1, timezone) === this.formatDateInTimezone(date2, timezone);
    }

    /**
     * Get day-of-week (0=Sunday..6=Saturday) for a date in a timezone
     * @param {Date} date
     * @param {string} timezone
     * @returns {number} 0-6
     */
    static getDayOfWeek(date, timezone) {
        try {
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                weekday: 'short'
            });
            const dayStr = formatter.format(date);
            const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
            return dayMap[dayStr] ?? date.getDay();
        } catch (error) {
            return date.getDay();
        }
    }

    /**
     * Create a Date set to a specific hour in user's timezone (returned as UTC Date)
     * E.g., "5 PM in Asia/Kolkata" → correct UTC Date
     * @param {Date} date - Base date
     * @param {number} hour - Hour (0-23)
     * @param {number} [minute=0]
     * @param {string} timezone
     * @returns {Date} UTC Date
     */
    static setHourInTimezone(date, hour, minute = 0, timezone = 'UTC') {
        const dateStr = this.formatDateInTimezone(date, timezone);
        const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
        return this.parseInTimezone(`${dateStr}T${timeStr}`, timezone);
    }

    /**
     * Get "today" date string in user's timezone
     * @param {string} timezone
     * @returns {string} 'yyyy-MM-dd'
     */
    static getTodayInTimezone(timezone) {
        return this.formatDateInTimezone(new Date(), timezone);
    }

    /**
     * Get "tomorrow" date in user's timezone as UTC Date
     * @param {string} timezone
     * @returns {Date}
     */
    static getTomorrowInTimezone(timezone) {
        const today = this.getLocalTime(timezone);
        const tomorrow = new Date(Date.UTC(today.year, today.month - 1, today.dayOfMonth + 1));
        return tomorrow;
    }
}

export default TimezoneHelper;
