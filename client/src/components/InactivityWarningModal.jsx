/**
 * InactivityWarningModal Component
 *
 * Shows a warning modal before auto-logout
 */

import React from "react";
import { AlertCircle, Clock } from "lucide-react";
import SESSION_CONFIG from "../config/sessionConfig";

const InactivityWarningModal = ({ show, remainingTime, formatTime }) => {
  console.log("🎨 InactivityWarningModal - Rendered with props:", {
    show,
    remainingTime,
  });

  if (!show) {
    console.log("🎨 InactivityWarningModal - Not showing (show=false)");
    return null;
  }

  console.log("🎨 InactivityWarningModal - DISPLAYING MODAL NOW!");

  return (
    <>
      {/* Backdrop - Non-dismissible */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9998]" />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-500 to-orange-500 p-4 rounded-t-xl">
            <div className="flex items-center gap-3 text-white">
              <div className="p-3 bg-white/20 rounded-sm">
                <AlertCircle className="h-8 w-8 animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Inactivity Warning</h2>
                <p className="text-sm text-white/90">
                  You will be logged out automatically
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-7">
            <div className="text-center mb-3">
              <p className="text-gray-700 mb-3 text-base">
                Due to{" "}
                <strong>
                  {SESSION_CONFIG.INACTIVITY_TIMEOUT_MINUTES} minutes
                </strong>{" "}
                of inactivity, you will be automatically logged out.
              </p>

              {/* Countdown Timer - Larger and more prominent */}
              <div className="inline-flex items-center gap-4 bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-300 rounded-xl px-8 py-6 mb-3">
                <Clock className="h-10 w-10 text-red-600 animate-pulse" />
                <div>
                  <div className="text-4xl font-bold text-red-600 tabular-nums">
                    {formatTime()}
                  </div>
                  <div className="text-sm text-gray-600 mt-1 font-medium">
                    Auto-logout in
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-500 italic">
                Please save your work. Session will end automatically when timer
                reaches zero.
              </p>
            </div>
          </div>

          {/* Footer Info */}
          <div className="bg-gray-50 px-6 py-4 rounded-b-xl border-t">
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>
                This is a security feature that automatically logs you out after{" "}
                {SESSION_CONFIG.INACTIVITY_TIMEOUT_MINUTES} minutes of
                inactivity.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default InactivityWarningModal;
