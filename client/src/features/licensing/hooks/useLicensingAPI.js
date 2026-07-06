import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../shared/hooks/useAuth.js';
import { PLAN_ORDER } from '@/utils/licenseConstants';

// API base URL
const API_BASE = '/api/license';

/**
 * Custom hook for licensing operations
 * Connects to actual backend APIs for license management
 */
export default function useLicensing() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [billingCycle, setBillingCycle] = useState('monthly');

  // Fetch all available licenses/plans
  const {
    data: licensesData,
    isLoading: licensesLoading,
    error: licensesError,
  } = useQuery({
    queryKey: ['licenses'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/licenses`);
      if (!response.ok) throw new Error('Failed to fetch licenses');
      const data = await response.json();
      return data.licenses || [];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch current subscription
  const {
    data: subscriptionData,
    isLoading: subscriptionLoading,
    error: subscriptionError,
    refetch: refetchSubscription,
  } = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/organization/subscription`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) {
        if (response.status === 401) throw new Error('Unauthorized');
        throw new Error('Failed to fetch subscription');
      }
      const data = await response.json();
      return data.subscription;
    },
    enabled: !!user,
  });

  // Fetch features with usage stats
  const {
    data: featuresData,
    isLoading: featuresLoading,
    error: featuresError,
    refetch: refetchFeatures,
  } = useQuery({
    queryKey: ['features'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/organization/features`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch features');
      const data = await response.json();
      return data.features;
    },
    enabled: !!user,
  });

  // Fetch invoices (billing history)
  const {
    data: invoicesData,
    isLoading: invoicesLoading,
    error: invoicesError,
    refetch: refetchInvoices,
  } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/organization/invoices`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch invoices');
      const data = await response.json();
      return data.invoices || [];
    },
    enabled: !!user,
  });

  // Upgrade subscription mutation
  const upgradeMutation = useMutation({
    mutationFn: async ({ licenseCode, billingCycle: cycle, seats }) => {
      const response = await fetch(`${API_BASE}/organization/subscription/upgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          license_code: licenseCode,
          billing_cycle: cycle?.toUpperCase(),
          seats: seats || 1,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upgrade');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['features'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  // Downgrade subscription mutation
  const downgradeMutation = useMutation({
    mutationFn: async ({ licenseCode }) => {
      const response = await fetch(`${API_BASE}/organization/subscription/downgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          license_code: licenseCode,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to downgrade');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['features'] });
    },
  });

  // Validate downgrade mutation
  const validateDowngradeMutation = useMutation({
    mutationFn: async ({ targetLicenseCode }) => {
      const response = await fetch(`${API_BASE}/organization/subscription/validate-downgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          target_license_code: targetLicenseCode,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to validate downgrade');
      }
      return response.json();
    },
  });

  // Purchase additional seats mutation
  const purchaseSeatsMutation = useMutation({
    mutationFn: async ({ seats }) => {
      const response = await fetch(`${API_BASE}/organization/subscription/purchase-seats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          additional_seats: seats,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to purchase seats');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  // Transform licenses to plans format with correct order: Explore → Plan → Execute → Optimize
  const plans = {};
  if (licensesData) {
    // First, create a temporary object with all plan data
    const tempPlans = {};
    licensesData.forEach(license => {
      const key = license.license_code.toLowerCase();
      tempPlans[key] = {
        name: license.name,
        license_code: license.license_code,
        description: license.description,
        price: {
          monthly: license.price_monthly,
          yearly: license.price_yearly,
        },
        limits: {
          users: license.max_users === -1 ? 'Unlimited' : license.max_users,
        },
        features: license.features_summary || [],
        popular: license.is_popular,
        is_active: license.is_active,
      };
    });

    // Add plans in correct order: Explore → Plan → Execute → Optimize
    PLAN_ORDER.forEach(key => {
      if (tempPlans[key]) {
        plans[key] = tempPlans[key];
      }
    });

    // Add any remaining plans not in PLAN_ORDER
    Object.keys(tempPlans).forEach(key => {
      if (!plans[key]) {
        plans[key] = tempPlans[key];
      }
    });
  }

  // Get current plan key
  const currentPlanKey = subscriptionData?.license_code?.toLowerCase() || 'explore';

  // Get current plan object
  const getCurrentPlan = useCallback(() => {
    return plans[currentPlanKey] || {
      name: 'Explore',
      license_code: 'EXPLORE',
      price: { monthly: 0, yearly: 0 },
      limits: {},
      features: [],
    };
  }, [plans, currentPlanKey]);

  // Calculate trial days left
  const trialDaysLeft = subscriptionData?.days_remaining || 0;

  // Get usage for a specific feature
  const getFeatureUsage = useCallback((featureCode) => {
    if (!featuresData) return null;

    // Search through all categories
    for (const category of Object.values(featuresData)) {
      const feature = category.find(f => f.feature_code === featureCode);
      if (feature) {
        return {
          current: feature.usage_count || 0,
          limit: feature.usage_limit === -1 ? 'Unlimited' : feature.usage_limit,
          remaining: feature.remaining ?? (feature.usage_limit === -1 ? -1 : feature.usage_limit - (feature.usage_count || 0)),
          percentage: feature.percentage || 0,
          isUnlimited: feature.is_unlimited || feature.usage_limit === -1,
        };
      }
    }
    return null;
  }, [featuresData]);

  // Calculate usage percentage for a feature
  const getUsagePercentage = useCallback((featureCode) => {
    const usage = getFeatureUsage(featureCode);
    if (!usage || usage.isUnlimited) return 0;
    return Math.min(100, usage.percentage);
  }, [getFeatureUsage]);

  // Check if over limit
  const isOverLimit = useCallback((featureCode) => {
    const usage = getFeatureUsage(featureCode);
    if (!usage || usage.isUnlimited) return false;
    return usage.current >= usage.limit;
  }, [getFeatureUsage]);

  // Get usage status object
  const getUsageStatus = useCallback((featureCode) => {
    const usage = getFeatureUsage(featureCode);
    if (!usage) {
      return {
        current: 0,
        limit: -1,
        percentage: 0,
        isOverLimit: false,
        isNearLimit: false,
      };
    }
    return {
      current: usage.current,
      limit: usage.isUnlimited ? -1 : usage.limit,
      percentage: usage.percentage,
      isOverLimit: !usage.isUnlimited && usage.current >= usage.limit,
      isNearLimit: !usage.isUnlimited && usage.percentage >= 80 && usage.percentage < 100,
    };
  }, [getFeatureUsage]);

  // Check if can upgrade
  const canUpgrade = useCallback(() => {
    const currentIndex = PLAN_ORDER.indexOf(currentPlanKey);
    return currentIndex < PLAN_ORDER.length - 1;
  }, [currentPlanKey]);

  // Check if can downgrade
  const canDowngrade = useCallback(() => {
    const currentIndex = PLAN_ORDER.indexOf(currentPlanKey);
    return currentIndex > 0;
  }, [currentPlanKey]);

  // Upgrade plan
  const upgradePlan = useCallback(async (planKey, cycle = billingCycle, seats = 1) => {
    return upgradeMutation.mutateAsync({
      licenseCode: planKey.toUpperCase(),
      billingCycle: cycle,
      seats,
    });
  }, [billingCycle, upgradeMutation]);

  // Downgrade plan
  const downgradePlan = useCallback(async (planKey) => {
    return downgradeMutation.mutateAsync({
      licenseCode: planKey.toUpperCase(),
    });
  }, [downgradeMutation]);

  // Validate downgrade
  const validateDowngrade = useCallback(async (targetPlanKey) => {
    return validateDowngradeMutation.mutateAsync({
      targetLicenseCode: targetPlanKey.toUpperCase(),
    });
  }, [validateDowngradeMutation]);

  // Purchase additional seats
  const purchaseSeats = useCallback(async (seats) => {
    return purchaseSeatsMutation.mutateAsync({ seats });
  }, [purchaseSeatsMutation]);

  // Get savings percentage for yearly billing
  const getSavingsPercentage = useCallback(() => {
    const plan = getCurrentPlan();
    if (!plan.price.monthly || !plan.price.yearly) return 0;
    const monthlyCost = plan.price.monthly * 12;
    const yearlyCost = plan.price.yearly;
    return Math.round(((monthlyCost - yearlyCost) / monthlyCost) * 100);
  }, [getCurrentPlan]);

  // Role-based access control
  const hasAccess = useCallback((feature) => {
    if (user?.role?.includes('org_admin')) return true;
    if (user?.role?.includes('super_admin')) return true;
    if (user?.role?.includes('individual')) return true;
    // Regular users and managers have read-only access to licensing
    return false;
  }, [user]);

  // Combined loading state
  const isLoading = licensesLoading || subscriptionLoading || featuresLoading;

  // Combined error state
  const error = licensesError || subscriptionError || featuresError;

  return {
    // State
    currentPlan: currentPlanKey,
    billingCycle,
    trialDaysLeft,
    invoices: invoicesData || [],
    isLoading,
    error,

    // Subscription data
    subscription: subscriptionData,
    features: featuresData,

    // Plan data
    plans,
    getCurrentPlan,

    // Usage calculations
    getFeatureUsage,
    getUsagePercentage,
    isOverLimit,
    getUsageStatus,

    // Plan management
    canUpgrade,
    canDowngrade,
    upgradePlan,
    downgradePlan,
    validateDowngrade,
    purchaseSeats,

    // Mutation states
    isUpgrading: upgradeMutation.isPending,
    isDowngrading: downgradeMutation.isPending,
    isPurchasingSeats: purchaseSeatsMutation.isPending,
    upgradeError: upgradeMutation.error,
    downgradeError: downgradeMutation.error,

    // Billing
    setBillingCycle,
    getSavingsPercentage,

    // Access control
    hasAccess,

    // Refetch functions
    refetchSubscription,
    refetchFeatures,
    refetchInvoices,
  };
}
