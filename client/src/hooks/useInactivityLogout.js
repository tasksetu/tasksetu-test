/**
 * useInactivityLogout Hook
 * 
 * AUTO-LOGOUT SYSTEM - FINAL FIXED VERSION
 * 
 * ⏰ EXACTLY 1 MINUTE INACTIVITY = AUTO LOGOUT
 * ♻️ ACTIVITY = Mouse clicks, typing, navigation
 * 🔇 SILENT LOGOUT (no warning messages)
 * ✅ WORKS ON ALL LOGINS (Remember Me doesn't matter)
 */

import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { clearAuth } from '../utils/auth';
import SESSION_CONFIG from '../config/sessionConfig';

const TIMEOUT_MS = SESSION_CONFIG.INACTIVITY_TIMEOUT_MS;
const TIMEOUT_SECONDS = TIMEOUT_MS / 1000;

console.log('═══════════════════════════════════════════════════════');
console.log('🚀 AUTO-LOGOUT HOOK LOADED');
console.log(`⏰ Timeout: ${SESSION_CONFIG.INACTIVITY_TIMEOUT_MINUTES} minute(s) = ${TIMEOUT_SECONDS} seconds`);
console.log('═══════════════════════════════════════════════════════');

export const useInactivityLogout = () => {
    const [, setLocation] = useLocation();
    const timerRef = useRef(null);
    const authCheckRef = useRef(null);
    const lastActivityRef = useRef(Date.now());

    const [showWarning] = useState(false); // Always false
    const [remainingTime] = useState(0);

    // Check if user is authenticated
    const isAuthenticated = () => {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        return !!(token && user);
    };

    // Silent logout function
    const performLogout = () => {
        console.log('\n╔═══════════════════════════════════════════════════╗');
        console.log('║  🔒 AUTO-LOGOUT EXECUTING                        ║');
        console.log('╚═══════════════════════════════════════════════════╝');
        console.log(`Time: ${new Date().toLocaleTimeString()}`);
        console.log(`Last activity: ${new Date(lastActivityRef.current).toLocaleTimeString()}`);
        console.log(`Inactivity duration: ${Math.floor((Date.now() - lastActivityRef.current) / 1000)} seconds`);

        // Clear timers
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (authCheckRef.current) {
            clearInterval(authCheckRef.current);
            authCheckRef.current = null;
        }

        // Clear authentication
        clearAuth();

        console.log('✅ Auth cleared, redirecting to /login');
        console.log('╚═══════════════════════════════════════════════════╝\n');

        // Redirect to login (silent - no message)
        setLocation('/login');
    };

    // Start/restart the inactivity timer
    const startTimer = () => {
        // Clear existing timer
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        // Record activity time
        lastActivityRef.current = Date.now();

        const expectedLogoutTime = new Date(Date.now() + TIMEOUT_MS);

        console.log('\n⏰ TIMER STARTED');
        console.log(`Current time: ${new Date().toLocaleTimeString()}`);
        console.log(`Will logout at: ${expectedLogoutTime.toLocaleTimeString()} (in ${TIMEOUT_SECONDS} seconds)`);
        console.log(`⚠️ Any activity (click/keypress) will RESET this timer\n`);

        // Set new timer
        timerRef.current = setTimeout(() => {
            console.log(`\n⚡ ${TIMEOUT_SECONDS} seconds passed - Logging out NOW!`);
            performLogout();
        }, TIMEOUT_MS);
    };

    // Handle user activity
    const handleActivity = () => {
        // Only reset timer if still authenticated
        if (!isAuthenticated()) {
            console.log('❌ Activity detected but user not authenticated - ignoring');
            return;
        }

        const timeSinceLastActivity = Date.now() - lastActivityRef.current;

        // Only log significant activity (more than 3 seconds apart)
        if (timeSinceLastActivity > 3000) {
            console.log(`\n✋ ACTIVITY DETECTED - Resetting timer`);
            console.log(`Time since last activity: ${Math.floor(timeSinceLastActivity / 1000)} seconds`);
        }

        startTimer();
    };

    useEffect(() => {
        console.log('\n╔═══════════════════════════════════════════════════╗');
        console.log('║  🎬 HOOK INITIALIZATION                          ║');
        console.log('╚═══════════════════════════════════════════════════╝');

        // Check initial authentication
        const initialAuth = isAuthenticated();
        console.log(`Authentication status: ${initialAuth ? '✅ AUTHENTICATED' : '❌ NOT AUTHENTICATED'}`);

        if (!initialAuth) {
            console.log('Hook disabled - will start when user logs in');
            console.log('╚═══════════════════════════════════════════════════╝\n');
        }

        // Polling to detect login/logout changes (every 1 second)
        console.log('\n🔄 Starting authentication monitor (checks every 1 second)...');

        let wasAuthenticated = initialAuth;
        let timerStarted = false;

        // If already authenticated, start timer immediately
        if (wasAuthenticated) {
            console.log('✅ User already logged in - Starting timer NOW');
            startTimer();
            timerStarted = true;
        }

        authCheckRef.current = setInterval(() => {
            const nowAuthenticated = isAuthenticated();

            // Detect login (transition from not-auth to auth)
            if (!wasAuthenticated && nowAuthenticated) {
                console.log('\n🔐 LOGIN DETECTED! Starting inactivity timer...');
                startTimer();
                timerStarted = true;
                wasAuthenticated = true;
            }
            // Detect logout
            else if (wasAuthenticated && !nowAuthenticated) {
                console.log('\n🚪 LOGOUT DETECTED! Stopping timer...');
                if (timerRef.current) {
                    clearTimeout(timerRef.current);
                    timerRef.current = null;
                }
                wasAuthenticated = false;
                timerStarted = false;
            }
            // Still authenticated - make sure timer is running
            else if (nowAuthenticated && !timerStarted) {
                console.log('\n♻️ Auth detected, starting timer...');
                startTimer();
                timerStarted = true;
            }
        }, 1000);

        // Activity event listeners - ONLY critical events
        // Using keydown and mousedown (NOT click/keypress to avoid duplicates)
        const activityEvents = ['keydown', 'mousedown'];

        console.log(`📡 Adding activity listeners: ${activityEvents.join(', ')}`);
        console.log(`   These events will RESET the ${TIMEOUT_SECONDS}-second timer`);

        // Throttle to prevent excessive resets (every 3 seconds max)
        let throttleTimer = null;
        const throttledActivity = () => {
            if (!throttleTimer) {
                handleActivity();
                throttleTimer = setTimeout(() => {
                    throttleTimer = null;
                }, 3000); // 3 second throttle
            }
        };

        activityEvents.forEach(event => {
            window.addEventListener(event, throttledActivity, { passive: true });
        });

        console.log('✅ Setup complete');
        console.log('╚═══════════════════════════════════════════════════╝\n');

        // Cleanup function
        return () => {
            console.log('\n🧹 Cleaning up auto-logout hook...');

            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            if (authCheckRef.current) {
                clearInterval(authCheckRef.current);
            }
            if (throttleTimer) {
                clearTimeout(throttleTimer);
            }

            activityEvents.forEach(event => {
                window.removeEventListener(event, throttledActivity);
            });

            console.log('✅ Cleanup complete\n');
        };
    }, []); // Empty dependency - runs once on mount

    return {
        showWarning, // Always false
        remainingTime, // Always 0
        formatTime: () => '0:00'
    };
};
