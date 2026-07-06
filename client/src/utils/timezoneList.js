/**
 * Dynamic Timezone List Utility
 * Uses Intl API to generate all supported IANA timezones with formatted labels.
 * Both EditProfile and NotificationCenter should use this single source of truth.
 */

// Compute UTC offset string for a timezone (e.g. "UTC+05:30")
const getUtcOffsetLabel = (tz) => {
    try {
        const now = new Date();
        // Format in the target tz to get local hour/minute parts
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
            timeZoneName: 'shortOffset',
        }).formatToParts(now);

        const tzName = parts.find(p => p.type === 'timeZoneName');
        if (tzName) {
            // e.g. "GMT+5:30" → "UTC+05:30"
            return tzName.value.replace('GMT', 'UTC');
        }
        return '';
    } catch {
        return '';
    }
};

// Human-friendly label for known cities
const CITY_LABELS = {
    'Asia/Kolkata': 'India',
    'America/New_York': 'Eastern Time (US)',
    'America/Chicago': 'Central Time (US)',
    'America/Denver': 'Mountain Time (US)',
    'America/Los_Angeles': 'Pacific Time (US)',
    'Europe/London': 'London',
    'Europe/Paris': 'Paris',
    'Europe/Berlin': 'Berlin',
    'Europe/Moscow': 'Moscow',
    'Asia/Dubai': 'Dubai',
    'Asia/Singapore': 'Singapore',
    'Asia/Tokyo': 'Tokyo',
    'Asia/Shanghai': 'Shanghai / Beijing',
    'Asia/Hong_Kong': 'Hong Kong',
    'Asia/Seoul': 'Seoul',
    'Asia/Dhaka': 'Dhaka',
    'Asia/Karachi': 'Karachi',
    'Asia/Jakarta': 'Jakarta',
    'Asia/Bangkok': 'Bangkok',
    'Asia/Riyadh': 'Riyadh',
    'Asia/Tehran': 'Tehran',
    'Australia/Sydney': 'Sydney',
    'Australia/Melbourne': 'Melbourne',
    'Australia/Perth': 'Perth',
    'Pacific/Auckland': 'Auckland (NZ)',
    'Pacific/Fiji': 'Fiji',
    'Pacific/Honolulu': 'Hawaii',
    'America/Anchorage': 'Alaska',
    'America/Toronto': 'Toronto',
    'America/Sao_Paulo': 'Sao Paulo',
    'America/Argentina/Buenos_Aires': 'Buenos Aires',
    'America/Mexico_City': 'Mexico City',
    'America/Bogota': 'Bogotá',
    'America/Lima': 'Lima',
    'Africa/Cairo': 'Cairo',
    'Africa/Lagos': 'Lagos',
    'Africa/Johannesburg': 'Johannesburg',
    'Africa/Nairobi': 'Nairobi',
    'Atlantic/Reykjavik': 'Reykjavik (Iceland)',
    'Etc/UTC': 'UTC',
};

// Curated list of commonly used timezones (covers most users globally)
const COMMON_TIMEZONES = [
    'Etc/UTC',
    'Pacific/Honolulu',        // UTC-10
    'America/Anchorage',       // UTC-09
    'America/Los_Angeles',     // UTC-08
    'America/Denver',          // UTC-07
    'America/Chicago',         // UTC-06
    'America/Mexico_City',     // UTC-06
    'America/New_York',        // UTC-05
    'America/Bogota',          // UTC-05
    'America/Lima',            // UTC-05
    'America/Toronto',         // UTC-05
    'America/Sao_Paulo',       // UTC-03
    'America/Argentina/Buenos_Aires', // UTC-03
    'Atlantic/Reykjavik',      // UTC+00
    'Europe/London',           // UTC+00
    'Europe/Paris',            // UTC+01
    'Europe/Berlin',           // UTC+01
    'Africa/Lagos',            // UTC+01
    'Africa/Cairo',            // UTC+02
    'Africa/Johannesburg',     // UTC+02
    'Europe/Moscow',           // UTC+03
    'Africa/Nairobi',          // UTC+03
    'Asia/Riyadh',             // UTC+03
    'Asia/Tehran',             // UTC+03:30
    'Asia/Dubai',              // UTC+04
    'Asia/Karachi',            // UTC+05
    'Asia/Kolkata',            // UTC+05:30
    'Asia/Dhaka',              // UTC+06
    'Asia/Bangkok',            // UTC+07
    'Asia/Jakarta',            // UTC+07
    'Asia/Singapore',          // UTC+08
    'Asia/Shanghai',           // UTC+08
    'Asia/Hong_Kong',          // UTC+08
    'Asia/Seoul',              // UTC+09
    'Asia/Tokyo',              // UTC+09
    'Australia/Perth',         // UTC+08
    'Australia/Sydney',        // UTC+11
    'Australia/Melbourne',     // UTC+11
    'Pacific/Auckland',        // UTC+12
    'Pacific/Fiji',            // UTC+12
];

/**
 * Get the curated list of timezones with labels and offsets
 * @returns {Array<{ value: string, label: string }>}
 */
export const getTimezoneOptions = () => {
    return COMMON_TIMEZONES.map(tz => {
        const offset = getUtcOffsetLabel(tz);
        const city = CITY_LABELS[tz] || tz.replace(/_/g, ' ').split('/').pop();
        return {
            value: tz,
            label: `${city} (${offset})`,
        };
    });
};

/**
 * Detect user's browser timezone
 * @returns {string} IANA timezone string
 */
export const detectBrowserTimezone = () => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    } catch {
        return 'Asia/Kolkata';
    }
};

export default getTimezoneOptions;
