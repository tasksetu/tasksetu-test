/**
 * FeatureLock Component
 *
 * Displays a lock icon and upgrade prompt for locked features
 * Can wrap any feature to show it as locked/disabled
 *
 * Usage:
 * <FeatureLock featureCode="TASK_APPROVAL" showUpgradeButton>
 *   <Button>Create Approval Task</Button>
 * </FeatureLock>
 */

import React from "react";
import { Lock, ArrowUpCircle } from "lucide-react";
import { useLicense } from "../../hooks/useLicense";
import { useNavigate } from "react-router-dom";

export const FeatureLock = ({
  featureCode,
  children,
  showUpgradeButton = true,
  lockMessage = null,
  className = "",
}) => {
  const { checkFeature, license } = useLicense();
  const navigate = useNavigate();
  const isUnlocked = checkFeature(featureCode);

  const handleUpgradeClick = () => {
    navigate("/billing");
  };

  if (isUnlocked) {
    // Feature is accessible, render children normally
    return <>{children}</>;
  }

  // Feature is locked
  return (
    <div className={`relative ${className}`}>
      {/* Render children but make them look disabled */}
      <div className="opacity-50 pointer-events-none blur-[1px]">
        {children}
      </div>

      {/* Overlay with lock icon */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/5 backdrop-blur-[2px] rounded-sm">
        <div className="bg-white p-4 rounded-sm shadow-lg border border-gray-200 text-center max-w-sm">
          <Lock className="w-8 h-8 mx-auto mb-2 text-orange-500" />
          <p className="text-sm font-semibold text-gray-800 mb-1">
            {lockMessage ||
              `This feature requires ${getNextPlan(license?.code)}`}
          </p>
          <p className="text-xs text-gray-600 mb-3">
            Upgrade your plan to unlock{" "}
            {featureCode.replace(/_/g, " ").toLowerCase()}
          </p>
          {showUpgradeButton && (
            <button
              onClick={handleUpgradeClick}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              <ArrowUpCircle className="w-4 h-4" />
              Upgrade Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * FeatureGate Component
 *
 * Conditionally render children based on feature access
 * Optionally show upgrade prompt if locked
 *
 * Usage:
 * <FeatureGate featureCode="TASK_APPROVAL" fallback={<UpgradePrompt />}>
 *   <ApprovalTaskForm />
 * </FeatureGate>
 */
export const FeatureGate = ({
  featureCode,
  children,
  fallback = null,
  showDefault = true,
}) => {
  const { checkFeature, license, isLoading } = useLicense();

  if (isLoading) {
    return <div className="animate-pulse h-10 bg-gray-200 rounded"></div>;
  }

  const isUnlocked = checkFeature(featureCode);

  if (isUnlocked) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showDefault) {
    return null;
  }

  // Default locked message
  return (
    <div className="p-4 bg-gray-50 border border-gray-200 rounded-sm text-center">
      <Lock className="w-6 h-6 mx-auto mb-2 text-gray-400" />
      <p className="text-sm text-gray-600">
        This feature is not available in your {license?.name || "current"} plan
      </p>
    </div>
  );
};

/**
 * UsageBadge Component
 *
 * Shows usage progress for a feature with limit
 *
 * Usage:
 * <UsageBadge featureCode="TASK_BASIC" />
 */
export const UsageBadge = ({ featureCode, showDetails = true }) => {
  const { license, getUsagePercent, isNearLimit } = useLicense();

  if (!license || !license.usage || !license.usage[featureCode]) {
    return null;
  }

  const usage = license.usage[featureCode];

  if (usage.isUnlimited) {
    return (
      <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-md">
        Unlimited
      </span>
    );
  }

  const percent = usage.percentage || 0;
  const isNear = percent >= 80;
  const isOver = percent >= 100;

  const colorClass = isOver
    ? "text-red-700 bg-red-50"
    : isNear
      ? "text-orange-700 bg-orange-50"
      : "text-blue-700 bg-blue-50";

  return (
    <div className="inline-flex items-center gap-2">
      <span
        className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-md ${colorClass}`}
      >
        {usage.used} / {usage.limit}
      </span>
      {showDetails && (
        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              isOver ? "bg-red-500" : isNear ? "bg-orange-500" : "bg-blue-500"
            }`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Helper function to determine next plan based on current
 */
const getNextPlan = (currentPlan) => {
  const planHierarchy = {
    EXPLORE: "Plan",
    PLAN: "Execute",
    EXECUTE: "Optimize",
    OPTIMIZE: "Enterprise",
  };

  return planHierarchy[currentPlan] || "a higher plan";
};

export default { FeatureLock, FeatureGate, UsageBadge };
