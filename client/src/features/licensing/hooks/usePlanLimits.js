import { useMemo } from 'react';
import useLicensing from './useLicensing';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook to check plan limits and trigger upgrade prompts
 */

const FEATURE_DISPLAY_NAMES = {
  TASK_BASIC: 'Tasks',
  TASK_RECUR: 'Recurring Tasks',
  TASK_APPROVAL: 'Approval Tasks',
  TASK_MSTONE: 'Milestone Tasks',
  TASK_SUB: 'Sub Tasks',
  PROC_CREATE: 'Processes',
  FORM_CREATE: 'Forms',
};

const getFeatureDisplayName = (featureCode) => {
  return FEATURE_DISPLAY_NAMES[featureCode] || featureCode;
};

export default function usePlanLimits() {
  const { getCurrentPlan, usage, getUsagePercentage, isOverLimit, hasAccess } = useLicensing();
  const { toast } = useToast();

  const checkLimit = (featureType, action = 'use') => {
    if (isOverLimit(featureType)) {
      const limit = getCurrentPlan().limits[featureType];
      const current = usage[featureType];
      const displayName = getFeatureDisplayName(featureType);

      toast({
        title: "Plan Limit Reached",
        description: `You've reached your ${displayName} limit (${current}/${limit}). Upgrade to continue.`,
        variant: "destructive",
        action: {
          label: "Upgrade Now",
          onClick: () => {
            // Trigger upgrade modal - this would be handled by parent component
            window.dispatchEvent(new CustomEvent('showUpgradeModal', { detail: { reason: featureType } }));
          }
        }
      });
      return false;
    }
    return true;
  };

  const getFeatureStatus = (featureType) => {
    const percentage = getUsagePercentage(featureType);
    const current = usage[featureType];
    const limit = getCurrentPlan().limits[featureType];

    return {
      current,
      limit,
      percentage,
      isOverLimit: percentage > 100,
      isNearLimit: percentage > 80,
      canUse: percentage <= 100
    };
  };

  const getLimitWarnings = useMemo(() => {
    const warnings = [];
    const features = ['users', 'projects', 'storage', 'tasks'];

    features.forEach(feature => {
      const status = getFeatureStatus(feature);
      if (status.isOverLimit) {
        warnings.push({
          type: 'error',
          feature,
          message: `${feature} limit exceeded (${status.current}/${status.limit})`
        });
      } else if (status.isNearLimit) {
        warnings.push({
          type: 'warning',
          feature,
          message: `${feature} usage is high (${Math.round(status.percentage)}% used)`
        });
      }
    });

    return warnings;
  }, [usage]);

  return {
    checkLimit,
    getFeatureStatus,
    getLimitWarnings,
    hasAccess
  };
}