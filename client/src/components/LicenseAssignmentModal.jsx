/**
 * 🎫 License Assignment Modal
 *
 * Modal component for assigning/changing user licenses.
 * Used by org admins to manage license allocation within their organization.
 *
 * Features:
 * - Display current user's license
 * - Show available licenses from pool
 * - Assign new license
 * - Unassign current license (release back to pool)
 * - Show user's current usage/limits
 */

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  Crown,
  Zap,
  Star,
  AlertTriangle,
  Check,
  X,
  RefreshCw,
  User,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserLicenseManagement } from "@/features/licensing/hooks/useUserLicenseManagement";

/**
 * License tier configurations with icons and colors
 */
const LICENSE_TIERS = {
  EXPLORE: {
    name: "Explore",
    icon: User,
    color: "text-gray-600",
    bgColor: "bg-gray-100",
    borderColor: "border-gray-200",
    description: "Free trial with basic features",
  },
  PLAN: {
    name: "Plan",
    icon: Shield,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    borderColor: "border-blue-200",
    description: "Standard features for small teams",
  },
  EXECUTE: {
    name: "Execute",
    icon: Zap,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
    borderColor: "border-purple-200",
    description: "Advanced features for growing teams",
  },
  OPTIMIZE: {
    name: "Optimize",
    icon: Crown,
    color: "text-amber-600",
    bgColor: "bg-amber-100",
    borderColor: "border-amber-200",
    description: "Full access with premium support",
  },
};

/**
 * LicenseAssignmentModal Component
 *
 * @param {boolean} isOpen - Modal open state
 * @param {function} onClose - Close callback
 * @param {Object} user - Target user object
 * @param {function} onSuccess - Success callback (optional)
 * @param {boolean} isSecondaryAdmin - Whether current user is secondary admin (not primary)
 */
export function LicenseAssignmentModal({
  isOpen,
  onClose,
  user,
  onSuccess,
  isSecondaryAdmin = false,
}) {
  const { toast } = useToast();
  const [selectedLicense, setSelectedLicense] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);

  const {
    licensePool,
    isPoolLoading,
    assignLicense,
    unassignLicense,
    isAssigning,
    isUnassigning,
    refreshAll,
  } = useUserLicenseManagement();

  // Current user's license
  const currentLicense =
    (user?.license_code && user?.license_code !== "No license" ? user?.license_code : null) ||
    (typeof user?.assigned_license === "string" && user?.assigned_license !== "No license"
      ? user?.assigned_license
      : user?.assigned_license?.license_code && user?.assigned_license?.license_code !== "No license"
      ? user?.assigned_license?.license_code
      : null) ||
    "EXPLORE";
  const currentTier = LICENSE_TIERS[currentLicense] || LICENSE_TIERS.EXPLORE;

  // Reset selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedLicense(null);
      setValidationResult(null);
    }
  }, [isOpen]);

  /**
   * Check if user is primary admin (cannot be modified by secondary admin)
   */
  const isTargetPrimaryAdmin = user?.isPrimaryAdmin === true;

  /**
   * ✅ NEW: Validate license change before assignment
   * Checks if upgrade/downgrade is allowed based on current usage
   */
  const validateLicenseChange = async (targetLicenseCode) => {
    if (!user?._id || !targetLicenseCode) return null;

    try {
      setIsValidating(true);
      const token = localStorage.getItem("token");
      const response = await fetch("/api/license/validate-change", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetUserId: user._id,
          targetLicenseCode: targetLicenseCode,
        }),
      });

      const data = await response.json();
      console.log("📋 License validation result:", data);

      setValidationResult(data);
      return data;
    } catch (error) {
      console.error("❌ License validation failed:", error);
      return null;
    } finally {
      setIsValidating(false);
    }
  };

  /**
   * Handle license selection with validation
   */
  const handleLicenseSelect = async (licenseCode) => {
    if (!canAssignLicense(licenseCode)) return;

    setSelectedLicense(licenseCode);
    setValidationResult(null);

    // Validate the license change
    await validateLicenseChange(licenseCode);
  };

  /**
   * Handle license assignment
   */
  const handleAssign = async () => {
    if (!selectedLicense || !user?._id) return;

    // ✅ NEW: Check validation result before proceeding
    if (
      validationResult &&
      !validationResult.allowed &&
      validationResult.isDowngrade
    ) {
      toast({
        title: "Downgrade Not Allowed",
        description:
          "Current usage exceeds target license limits. Please review the violations below.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      await assignLicense(user._id, selectedLicense);

      const isUpgrade = validationResult?.isUpgrade;
      toast({
        title: isUpgrade ? "License Upgraded" : "License Changed",
        description: `${user.firstName || user.email} now has ${LICENSE_TIERS[selectedLicense]?.name || selectedLicense} license.${isUpgrade ? " Usage carried forward." : ""}`,
        variant: "default",
      });

      onSuccess?.();
      onClose();
    } catch (error) {
      toast({
        title: "Assignment Failed",
        description: error.message || "Failed to assign license",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Handle license unassignment (release back to pool)
   */
  const handleUnassign = async () => {
    if (!user?._id || currentLicense === "EXPLORE") return;

    setIsProcessing(true);
    try {
      await unassignLicense(user._id);

      toast({
        title: "License Released",
        description: `${user.firstName || user.email}'s license has been released back to the pool.`,
        variant: "default",
      });

      onSuccess?.();
      onClose();
    } catch (error) {
      toast({
        title: "Release Failed",
        description: error.message || "Failed to release license",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Get pool availability for a license tier
   */
  const getPoolInfo = (licenseCode) => {
    const poolItem = licensePool.find((p) => p.license_code === licenseCode);
    return poolItem || { available: 0, total: 0, used: 0 };
  };

  /**
   * Check if can assign a specific license
   */
  const canAssignLicense = (licenseCode) => {
    if (licenseCode === currentLicense) return false; // Already has this license
    if (licenseCode === "EXPLORE") return false; // EXPLORE is free, use unassign instead
    if (isTargetPrimaryAdmin) return true; // Primary Admin bypass - can select any
    const pool = getPoolInfo(licenseCode);
    return pool.available > 0;
  };

  const isBusy = isProcessing || isAssigning || isUnassigning;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Manage License
          </DialogTitle>
          <DialogDescription>
            Assign or change license for{" "}
            <span className="font-medium text-gray-900">
              {user?.firstName} {user?.lastName}
            </span>
            {user?.email && (
              <span className="text-gray-500"> ({user.email})</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Primary Admin Warning */}
        {isSecondaryAdmin && isTargetPrimaryAdmin && (
          <div className="flex items-center gap-2 p-3 rounded-sm bg-yellow-50 border border-yellow-200">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
            <p className="text-sm text-yellow-800">
              You cannot modify the Primary Admin's license.
            </p>
          </div>
        )}

        {/* Current License */}
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Current License
            </h4>
            <div
              className={cn(
                "flex items-center gap-3 p-4 rounded-sm border-2",
                currentTier.bgColor,
                currentTier.borderColor,
              )}
            >
              <currentTier.icon className={cn("h-8 w-8", currentTier.color)} />
              <div>
                <div className={cn("font-semibold", currentTier.color)}>
                  {currentTier.name}
                </div>
                <div className="text-sm text-gray-600">
                  {currentTier.description}
                </div>
              </div>
            </div>
          </div>

          {/* Available Licenses */}
          {!(isSecondaryAdmin && isTargetPrimaryAdmin) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700">
                  Available Licenses
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refreshAll}
                  disabled={isPoolLoading}
                  className="h-7 px-2"
                >
                  <RefreshCw
                    className={cn(
                      "h-3.5 w-3.5",
                      isPoolLoading && "animate-spin",
                    )}
                  />
                </Button>
              </div>

              {isPoolLoading ? (
                <div className="text-center py-4 text-gray-500">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Loading licenses...
                </div>
              ) : (
                <div className="space-y-2">
                  {["PLAN", "EXECUTE", "OPTIMIZE"].map((code) => {
                    const tier = LICENSE_TIERS[code];
                    const pool = getPoolInfo(code);
                    const isSelected = selectedLicense === code;
                    const isCurrent = currentLicense === code;
                    const canSelect = canAssignLicense(code);

                    return (
                      <Button
                        variant="outline"
                        key={code}
                        onClick={() => handleLicenseSelect(code)}
                        disabled={!canSelect || isBusy || isValidating}
                        className={cn(
                          "w-full h-auto flex items-center gap-3 p-3 rounded-sm border-2 transition-all text-left justify-start",
                          isSelected
                            ? `${tier.borderColor} ${tier.bgColor} ring-2 ring-offset-1 ring-blue-500`
                            : "border-gray-200 hover:border-gray-300 bg-white",
                          isCurrent && "opacity-50 cursor-not-allowed",
                          !canSelect && "opacity-50 cursor-not-allowed",
                        )}
                      >
                        <tier.icon className={cn("h-6 w-6", tier.color)} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={cn("font-medium", tier.color)}>
                              {tier.name}
                            </span>
                            {isCurrent && (
                              <Badge variant="outline" className="text-xs">
                                Current
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {pool.available} of {pool.total} available
                          </div>
                        </div>
                        {isSelected && isValidating && (
                          <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
                        )}
                        {isSelected && !isValidating && (
                          <Check className="h-5 w-5 text-blue-600" />
                        )}
                        {pool.available === 0 && !isCurrent && (
                          <Badge
                            variant="outline"
                            className="text-xs text-red-600 border-red-200"
                          >
                            No seats
                          </Badge>
                        )}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Release License Option */}
          {currentLicense !== "EXPLORE" && !(isSecondaryAdmin && isTargetPrimaryAdmin) && (
            <div className="pt-2 border-t">
              <Button
                variant="outline"
                onClick={handleUnassign}
                disabled={isBusy}
                className={cn(
                  "w-full h-auto flex items-center gap-3 p-3 rounded-sm border-2 transition-all justify-start",
                  "border-red-200 bg-red-50 hover:border-red-300 text-left",
                  isBusy && "opacity-50 cursor-not-allowed",
                )}
              >
                <X className="h-6 w-6 text-red-600" />
                <div className="flex-1">
                  <div className="font-medium text-red-700">
                    Release License
                  </div>
                  <div className="text-xs text-red-600">
                    User will revert to Explore (free trial)
                  </div>
                </div>
                {isUnassigning && (
                  <RefreshCw className="h-5 w-5 text-red-600 animate-spin" />
                )}
              </Button>
            </div>
          )}

          {/* ✅ NEW: Validation Result Display */}
          {selectedLicense && validationResult && (
            <div className="pt-2 border-t space-y-2">
              {/* Upgrade Message */}
              {validationResult.isUpgrade && validationResult.allowed && (
                <div className="flex items-start gap-2 p-3 rounded-sm bg-green-50 border border-green-200">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-800">
                      Upgrade Ready
                    </p>
                    <p className="text-xs text-green-700">
                      Usage will be carried forward. No data will be lost.
                    </p>
                  </div>
                </div>
              )}

              {/* Downgrade Allowed Message */}
              {validationResult.isDowngrade && validationResult.allowed && (
                <div className="flex items-start gap-2 p-3 rounded-sm bg-blue-50 border border-blue-200">
                  <Check className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">
                      Downgrade Allowed
                    </p>
                    <p className="text-xs text-blue-700">
                      Current usage fits within the target license limits.
                    </p>
                  </div>
                </div>
              )}

              {/* Downgrade Blocked - Violations */}
              {validationResult.isDowngrade &&
                !validationResult.allowed &&
                validationResult.violations && (
                  <div className="flex items-start gap-2 p-3 rounded-sm bg-red-50 border border-red-200">
                    <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-800">
                        Downgrade Not Allowed
                      </p>
                      <p className="text-xs text-red-700 mb-2">
                        Current usage exceeds target license limits:
                      </p>
                      <ul className="text-xs text-red-700 space-y-1">
                        {validationResult.violations.map((v, idx) => (
                          <li key={idx} className="flex items-center gap-1">
                            <span className="font-mono">{v.feature_code}:</span>
                            <span>
                              Used {v.used} / Allowed {v.allowed}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-xs text-red-600 border-red-300 ml-1"
                            >
                              +{v.excess} over
                            </Badge>
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-red-600 mt-2">
                        User must reduce usage or wait for the period to reset.
                      </p>
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isBusy}
            className="h-9"
          >
            Cancel
          </Button>
          {!(isSecondaryAdmin && isTargetPrimaryAdmin) && selectedLicense && (
            <Button
              variant="primary"
              onClick={handleAssign}
              disabled={
                isBusy ||
                isValidating ||
                !selectedLicense ||
                (validationResult?.isDowngrade && !validationResult?.allowed)
              }
              className={cn(
                "h-9",
                validationResult?.isDowngrade &&
                  !validationResult?.allowed &&
                  "opacity-50 cursor-not-allowed",
              )}
            >
              {isBusy ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : isValidating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <ChevronRight className="h-4 w-4 mr-2" />
                  {validationResult?.isUpgrade
                    ? "Upgrade to"
                    : validationResult?.isDowngrade
                      ? "Downgrade to"
                      : "Assign"}{" "}
                  {LICENSE_TIERS[selectedLicense]?.name}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LicenseAssignmentModal;
