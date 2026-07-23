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

import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { clearAuth } from "../utils/auth";
import SESSION_CONFIG from "../config/sessionConfig";

const TIMEOUT_MS = SESSION_CONFIG.INACTIVITY_TIMEOUT_MS;
const TIMEOUT_SECONDS = TIMEOUT_MS / 1000;

export const useInactivityLogout = () => {
  const [, setLocation] = useLocation();
  const timerRef = useRef(null);
  const authCheckRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  const [showWarning] = useState(false); // Always false
  const [remainingTime] = useState(0);

  // Check if user is authenticated
  const isAuthenticated = () => {
    const token = localStorage.getItem("token");
    const user = localStorage.getItem("user");
    return !!(token && user);
  };

  // Silent logout function
  const performLogout = () => {
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

    // Redirect to login (silent - no message)
    setLocation("/login");
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
    // Set new timer
    timerRef.current = setTimeout(() => {
      performLogout();
    }, TIMEOUT_MS);
  };

  // Handle user activity
  const handleActivity = () => {
    // Only reset timer if still authenticated
    if (!isAuthenticated()) {
      return;
    }

    const timeSinceLastActivity = Date.now() - lastActivityRef.current;

    // Only log significant activity (more than 3 seconds apart)
    if (timeSinceLastActivity > 3000) {
      console.log(`\n✋ ACTIVITY DETECTED - Resetting timer`);
    }

    startTimer();
  };

  useEffect(() => {
    // Check initial authentication
    const initialAuth = isAuthenticated();
    console.log(
      `Authentication status: ${initialAuth ? "✅ AUTHENTICATED" : "❌ NOT AUTHENTICATED"}`,
    );

    let wasAuthenticated = initialAuth;
    let timerStarted = false;

    // If already authenticated, start timer immediately
    if (wasAuthenticated) {
      console.log("✅ User already logged in - Starting timer NOW");
      startTimer();
      timerStarted = true;
    }

    authCheckRef.current = setInterval(() => {
      const nowAuthenticated = isAuthenticated();

      // Detect login (transition from not-auth to auth)
      if (!wasAuthenticated && nowAuthenticated) {
        console.log("\n🔐 LOGIN DETECTED! Starting inactivity timer...");
        startTimer();
        timerStarted = true;
        wasAuthenticated = true;
      }
      // Detect logout
      else if (wasAuthenticated && !nowAuthenticated) {
        console.log("\n🚪 LOGOUT DETECTED! Stopping timer...");
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        wasAuthenticated = false;
        timerStarted = false;
      }
      // Still authenticated - make sure timer is running
      else if (nowAuthenticated && !timerStarted) {
        console.log("\n♻️ Auth detected, starting timer...");
        startTimer();
        timerStarted = true;
      }
    }, 1000);

    const activityEvents = ["keydown", "mousedown"];
    let throttleTimer = null;
    const throttledActivity = () => {
      if (!throttleTimer) {
        handleActivity();
        throttleTimer = setTimeout(() => {
          throttleTimer = null;
        }, 3000);
      }
    };

    activityEvents.forEach((event) => {
      window.addEventListener(event, throttledActivity, { passive: true });
    });

    console.log("✅ Setup complete");

    // Cleanup function
    return () => {
      console.log("\n🧹 Cleaning up auto-logout hook...");

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (authCheckRef.current) {
        clearInterval(authCheckRef.current);
      }
      if (throttleTimer) {
        clearTimeout(throttleTimer);
      }

      activityEvents.forEach((event) => {
        window.removeEventListener(event, throttledActivity);
      });

      console.log("✅ Cleanup complete\n");
    };
  }, []); // Empty dependency - runs once on mount

  return {
    showWarning, // Always false
    remainingTime, // Always 0
    formatTime: () => "0:00",
  };
};
