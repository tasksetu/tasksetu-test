import React from "react";
import { createPortal } from "react-dom";
import { Lock, ArrowUpCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function UpgradeRequiredModal({
  isOpen,
  onClose,
  featureName = "this feature",
  message,
}) {
  const [, navigate] = useLocation();

  if (!isOpen) return null;

  const defaultMessage = `Your current plan does not include the ${featureName} feature. Upgrade to a higher plan to unlock it.`;

  const handleUpgradeClick = () => {
    onClose();
    navigate("/admin/subscription");
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white rounded-sm shadow-2xl border border-gray-200 w-full max-w-md mx-4 overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Content */}
        <div className="p-6 text-center">
          {/* Icon */}
          <div className="mx-auto w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-7 h-7 text-orange-500" />
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Upgrade Required
          </h3>

          {/* Message */}
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            {message || defaultMessage}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              className="px-4 py-2 h-9 text-sm"
              onClick={onClose}
            >
              Maybe Later
            </Button>
            <Button
              className="px-5 py-2 h-9 text-sm bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
              onClick={handleUpgradeClick}
            >
              <ArrowUpCircle className="w-4 h-4" />
              Upgrade Plan
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
