/**
 * useTokenCleanup Hook
 * 
 * Handles two responsibilities:
 * 1. Browser close/tab close → clear ALL localStorage & sessionStorage data
 * 2. Token expiry check → every 5 minutes, if token expired, auto-logout
 * 
 * NOTE: This does NOT interfere with the 30-min inactivity logout (useInactivityLogout)
 * Both hooks work independently:
 *   - useInactivityLogout: logs out after 30 min of no mouse/keyboard activity
 *   - useTokenCleanup: logs out when 24h token expires OR browser is closed
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { clearAuth } from '../utils/auth';

// Session marker key — used to detect fresh browser session
const SESSION_MARKER_KEY = 'tasksetu_session_active';

export const useTokenCleanup = () => {
    const [, setLocation] = useLocation();
    const tokenCheckInterval = useRef(null);

    useEffect(() => {
        // ============================================
        // 1. Browser Close Detection via sessionStorage marker
        // ============================================
        // sessionStorage is automatically cleared when browser closes.
        // If marker is missing → it's a fresh session → clear old data.

        const sessionMarker = sessionStorage.getItem(SESSION_MARKER_KEY);

        if (!sessionMarker) {
            // No session marker — could be a fresh browser session OR just a new tab.
            // sessionStorage is per-tab, so new tabs won't have the marker.
            // Only clear auth if the token is actually expired to avoid
            // destroying valid sessions when opening links in new tabs.
            const token = localStorage.getItem('token');
            const tokenExpiry = localStorage.getItem('tokenExpiry');
            if (token && tokenExpiry) {
                const isExpired = new Date(tokenExpiry).getTime() <= Date.now();
                if (isExpired) {
                    console.log('🧹 [TokenCleanup] Expired token found on new session — clearing old session data');
                    clearAuth();
                    localStorage.removeItem('tokenExpiry');
                    localStorage.removeItem('rememberMe');
                }
            } else if (token && !tokenExpiry) {
                // Token exists but no expiry recorded (legacy/edge case) — clear it
                console.log('🧹 [TokenCleanup] Token without expiry found — clearing old session data');
                clearAuth();
                localStorage.removeItem('rememberMe');
            }
        }

        // Set the session marker for this tab
        sessionStorage.setItem(SESSION_MARKER_KEY, 'true');

        // ============================================
        // 2. Token Expiry Check (every 5 minutes)
        // ============================================
        const checkTokenExpiry = () => {
            const token = localStorage.getItem('token');
            const tokenExpiry = localStorage.getItem('tokenExpiry');

            // No token or no expiry stored — nothing to check
            if (!token || !tokenExpiry) return;

            const expiryTime = new Date(tokenExpiry).getTime();
            const now = Date.now();

            if (now >= expiryTime) {
                console.log('🔐 [TokenCleanup] Token expired — logging out');
                console.log(`   Expired at: ${new Date(expiryTime).toLocaleString()}`);
                console.log(`   Current:    ${new Date(now).toLocaleString()}`);

                // Clear all auth data
                clearAuth();
                localStorage.removeItem('tokenExpiry');
                sessionStorage.removeItem(SESSION_MARKER_KEY);

                // Redirect to login
                setLocation('/login');
            }
        };

        // Run check immediately on mount
        checkTokenExpiry();

        // Then check every 5 minutes
        tokenCheckInterval.current = setInterval(checkTokenExpiry, 5 * 60 * 1000);

        // ============================================
        // Cleanup
        // ============================================
        return () => {
            if (tokenCheckInterval.current) {
                clearInterval(tokenCheckInterval.current);
                tokenCheckInterval.current = null;
            }
        };
    }, [setLocation]);
};

export default useTokenCleanup;
