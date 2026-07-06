/**
 * Session Configuration
 * 
 * Configure inactivity timeout and other session-related settings
 * 
 * IMPORTANT: Auto-logout applies to ALL users regardless of "Remember Me" checkbox
 * This is a security feature that cannot be bypassed
 */

export const SESSION_CONFIG = {
    // Inactivity timeout in minutes (30 minutes = 1800000 ms)
    INACTIVITY_TIMEOUT_MINUTES: 30,  // 30 minutes

    // Warning before logout in minutes (0 = no warning, direct logout)
    WARNING_BEFORE_LOGOUT_MINUTES: 0,  // No warning

    // Convert to milliseconds
    get INACTIVITY_TIMEOUT_MS() {
        return this.INACTIVITY_TIMEOUT_MINUTES * 60 * 1000;
    },

    get WARNING_TIMEOUT_MS() {
        return (this.INACTIVITY_TIMEOUT_MINUTES - this.WARNING_BEFORE_LOGOUT_MINUTES) * 60 * 1000;
    },

    get WARNING_COUNTDOWN_SECONDS() {
        return this.WARNING_BEFORE_LOGOUT_MINUTES * 60;
    },

    // Throttle time for activity detection (in milliseconds)
    ACTIVITY_THROTTLE_MS: 2000,

    // Events to track for user activity (mousemove removed for less sensitivity)
    ACTIVITY_EVENTS: [
        'mousedown',
        'keypress',
        'click',
        'keydown'
    ]
};

export default SESSION_CONFIG;
