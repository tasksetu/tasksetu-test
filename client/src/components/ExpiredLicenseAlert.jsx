import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, Users, X } from "lucide-react";

const STORAGE_KEY = "expiredLicenseWarning";

/**
 * Reads the warning stored by Login.jsx after a successful org-admin login.
 * Shows a modal if present. The modal has two actions:
 *   • OK           → dismiss (clears from sessionStorage)
 *   • Manage Users → navigate to /admin/users + dismiss
 */
export default function ExpiredLicenseAlert() {
  const [warning, setWarning] = useState(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setWarning(JSON.parse(raw));
      } catch (_) {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const dismiss = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setWarning(null);
  };

  const handleManageUsers = () => {
    dismiss();
    navigate("/admin/users");
  };

  if (!warning) return null;

  const licenseNames = warning.expiredLicenses?.map((l) => l.name).join(", ") || warning.message || "your license";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md bg-white rounded-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header strip */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5 bg-white/20 rounded-sm p-2">
            <AlertTriangle className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-white font-semibold text-base leading-tight">
              Licence Expired
            </h2>
            <p className="text-amber-100 text-sm mt-0.5">
              Action required — free users are blocked
            </p>
          </div>
          <button
            onClick={dismiss}
            className="flex-shrink-0 text-white/70 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-gray-700 text-sm leading-relaxed">
            Your organisation&apos;s{" "}
            <span className="font-semibold text-gray-900">&ldquo;{licenseNames}&rdquo;</span>{" "}
            licence has expired and the grace period has ended.
          </p>
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-sm px-4 py-3 text-sm text-red-800">
            <Users className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
            <span>
              All free (Explore) users in your organisation have been{" "}
              <strong>blocked from logging in</strong>. Renew your subscription
              or reassign paid licences to restore their access.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex gap-3 justify-end">
          <button
            onClick={dismiss}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-sm transition-colors"
          >
            OK
          </button>
          <button
            onClick={handleManageUsers}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-sm transition-colors flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            Manage Users
          </button>
        </div>
      </div>
    </div>
  );
}
