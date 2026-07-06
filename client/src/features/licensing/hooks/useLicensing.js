import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../shared/hooks/useAuth.js';
import { PLAN_ORDER } from '@/utils/licenseConstants';

// API base URL
const API_BASE = '/api/license';

// Fallback plans data (used when API is not available)
const FALLBACK_PLANS = {
  explore: {
    name: 'Explore',
    price: { monthly: 0, yearly: 0 },
    limits: {
      users: 3,
      tasks: 20,
      subtasks: 10,
      recurring_tasks: 1,
      forms: 1,
      processes: 30,
      reports: 1
    },
    features: ['Basic task management', 'Email support', '7-day trial']
  },
  plan: {
    name: 'Plan',
    price: { monthly: 19, yearly: 190 },
    limits: {
      users: 10,
      tasks: 100,
      subtasks: 50,
      recurring_tasks: 10,
      task_approvals: 20,
      milestones: 5,
      forms: 10,
      processes: 100,
      reports: 10
    },
    features: ['Task approvals', 'Milestones', 'Priority support']
  },
  execute: {
    name: 'Execute',
    price: { monthly: 49, yearly: 490 },
    limits: {
      users: 'Unlimited',
      tasks: 'Unlimited',
      subtasks: 'Unlimited',
      recurring_tasks: 'Unlimited',
      task_approvals: 'Unlimited',
      milestones: 'Unlimited',
      dependencies: 'Unlimited',
      forms: 'Unlimited',
      processes: 'Unlimited',
      reports: 'Unlimited'
    },
    features: ['All Plan features', 'Task dependencies', 'Advanced analytics', 'API access']
  },
  optimize: {
    name: 'Optimize',
    price: { monthly: 99, yearly: 990 },
    limits: {
      users: 'Unlimited',
      tasks: 'Unlimited',
      subtasks: 'Unlimited',
      recurring_tasks: 'Unlimited',
      task_approvals: 'Unlimited',
      milestones: 'Unlimited',
      dependencies: 'Unlimited',
      forms: 'Unlimited',
      processes: 'Unlimited',
      reports: 'Unlimited'
    },
    features: ['All Execute features', 'SSO integration', 'Dedicated support', 'White-label options']
  }
};

export default function useLicensing() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [billingCycle, setBillingCycle] = useState('monthly');

  // Fetch all available licenses/plans from API
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
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  // Fetch current subscription from API
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

  // Fetch features with usage stats from API
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
      // Features come as an object grouped by category: { CORE: [...], ADVANCED: [...] }
      // Flatten to an array for easier processing
      const featuresObj = data.features || {};
      const flattenedFeatures = Object.values(featuresObj).flat();
      return flattenedFeatures;
    },
    enabled: !!user,
  });

  // Fetch invoices from API
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

  // Transform API licenses into plans object with correct order: Explore → Plan → Execute → Optimize
  const plans = useMemo(() => {
    if (!licensesData || licensesData.length === 0) {
      return FALLBACK_PLANS;
    }

    // First, create a temporary object with all plan data
    const tempPlansObj = {};
    licensesData.forEach(license => {
      const key = license.license_code.toLowerCase();
      tempPlansObj[key] = {
        name: license.name,
        license_code: license.license_code,
        description: license.description,
        price: {
          monthly: license.price_monthly || 0,
          yearly: license.price_yearly || 0,
        },
        limits: license.limits || {},
        features: license.features_summary || [],
        is_popular: license.is_popular,
        max_users: license.max_users,
        trial_days: license.trial_days,
      };
    });

    // Create ordered plans object following PLAN_ORDER sequence
    const orderedPlans = {};
    PLAN_ORDER.forEach(key => {
      if (tempPlansObj[key]) {
        orderedPlans[key] = tempPlansObj[key];
      }
    });

    // Add any remaining plans that might not be in PLAN_ORDER
    Object.keys(tempPlansObj).forEach(key => {
      if (!orderedPlans[key]) {
        orderedPlans[key] = tempPlansObj[key];
      }
    });

    return Object.keys(orderedPlans).length > 0 ? orderedPlans : FALLBACK_PLANS;
  }, [licensesData]);

  // Current plan from subscription or fallback
  const currentPlan = useMemo(() => {
    if (subscriptionData?.license_code) {
      return subscriptionData.license_code.toLowerCase();
    }
    return 'explore';
  }, [subscriptionData]);

  // Trial days left
  const trialDaysLeft = useMemo(() => {
    if (subscriptionData?.status === 'TRIAL' && subscriptionData?.days_remaining) {
      return subscriptionData.days_remaining;
    }
    return 0;
  }, [subscriptionData]);

  // Usage data from features
  const usage = useMemo(() => {
    if (!featuresData || !Array.isArray(featuresData)) return {};

    const usageObj = {};
    featuresData.forEach(feature => {
      if (feature.usage) {
        usageObj[feature.feature_code?.toLowerCase()] = feature.usage.current || 0;
      }
    });
    return usageObj;
  }, [featuresData]);

  // Invoices from API
  const invoices = useMemo(() => {
    return invoicesData || [];
  }, [invoicesData]);

  // Get current plan object
  const getCurrentPlan = useCallback(() => {
    return plans[currentPlan] || plans.explore || FALLBACK_PLANS.explore;
  }, [plans, currentPlan]);

  // Get usage percentage for a feature type
  const getUsagePercentage = useCallback((type) => {
    if (!Array.isArray(featuresData)) return 0;
    const feature = featuresData.find(f =>
      f.feature_code?.toLowerCase() === type.toLowerCase()
    );
    if (!feature || !feature.usage) return 0;

    const current = feature.usage.current || 0;
    const limit = feature.usage.limit;

    if (limit === -1 || limit === 'Unlimited' || limit == null) return 0;
    if (limit <= 0) return 0;

    return (current / limit) * 100;
  }, [featuresData]);

  // Check if over limit
  const isOverLimit = useCallback((type) => {
    return getUsagePercentage(type) > 100;
  }, [getUsagePercentage]);

  // Get full usage status
  const getUsageStatus = useCallback((type) => {
    if (!Array.isArray(featuresData)) {
      return {
        current: 0,
        limit: -1,
        percentage: 0,
        isOverLimit: false,
        isNearLimit: false
      };
    }
    const feature = featuresData.find(f =>
      f.feature_code?.toLowerCase() === type.toLowerCase()
    );

    if (!feature || !feature.usage) {
      return {
        current: 0,
        limit: -1,
        percentage: 0,
        isOverLimit: false,
        isNearLimit: false
      };
    }

    const current = feature.usage.current || 0;
    const limit = feature.usage.limit;
    const unlimited = limit === -1 || limit === 'Unlimited';
    const numericLimit = unlimited ? -1 : Number(limit);
    const percentage = numericLimit > 0 ? (current / numericLimit) * 100 : 0;
    const isOver = numericLimit > 0 && current > numericLimit;
    const isNear = !isOver && numericLimit > 0 && percentage >= 80;

    return {
      current,
      limit: numericLimit,
      percentage: Number.isFinite(percentage) ? percentage : 0,
      isOverLimit: isOver,
      isNearLimit: isNear
    };
  }, [featuresData]);

  // Can upgrade check
  const canUpgrade = useCallback(() => {
    const currentIndex = PLAN_ORDER.indexOf(currentPlan);
    return currentIndex < PLAN_ORDER.length - 1;
  }, [currentPlan]);

  // Can downgrade check
  const canDowngrade = useCallback(() => {
    const currentIndex = PLAN_ORDER.indexOf(currentPlan);
    return currentIndex > 0;
  }, [currentPlan]);

  // Upgrade plan mutation
  const upgradePlanMutation = useMutation({
    mutationFn: async (planKey) => {
      const response = await fetch(`${API_BASE}/organization/subscription/upgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          license_code: planKey.toUpperCase(),
          billing_cycle: billingCycle.toUpperCase(),
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
      queryClient.invalidateQueries({ queryKey: ['current-license-info'] });
    },
  });

  // Downgrade plan mutation
  const downgradePlanMutation = useMutation({
    mutationFn: async (planKey) => {
      const response = await fetch(`${API_BASE}/organization/subscription/downgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          license_code: planKey.toUpperCase(),
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
      queryClient.invalidateQueries({ queryKey: ['current-license-info'] });
    },
  });

  // Upgrade plan wrapper
  const upgradePlan = useCallback(async (planKey) => {
    return upgradePlanMutation.mutateAsync(planKey);
  }, [upgradePlanMutation]);

  // Downgrade plan wrapper
  const downgradePlan = useCallback(async (planKey) => {
    return downgradePlanMutation.mutateAsync(planKey);
  }, [downgradePlanMutation]);

  // Get savings percentage for yearly billing
  const getSavingsPercentage = useCallback(() => {
    const plan = getCurrentPlan();
    const monthlyCost = (plan.price?.monthly || 0) * 12;
    const yearlyCost = plan.price?.yearly || 0;
    if (monthlyCost === 0) return 0;
    return Math.round(((monthlyCost - yearlyCost) / monthlyCost) * 100);
  }, [getCurrentPlan]);

  // Role-based access control
  const hasAccess = useCallback((feature) => {
    if (user?.role?.includes('org_admin')) return true;
    if (user?.role?.includes('super_admin')) return true;
    if (user?.role?.includes('individual')) return true;
    return false;
  }, [user]);

  // Loading state
  const isLoading = licensesLoading || subscriptionLoading || featuresLoading;

  return {
    // State
    currentPlan,
    billingCycle,
    usage,
    trialDaysLeft,
    invoices,
    isLoading,

    // API data
    subscriptionData,
    featuresData,

    // Plan data
    plans,
    getCurrentPlan,

    // Usage calculations
    getUsagePercentage,
    isOverLimit,
    getUsageStatus,

    // Plan management
    canUpgrade,
    canDowngrade,
    upgradePlan,
    downgradePlan,

    // Billing
    setBillingCycle,
    getSavingsPercentage,

    // Access control
    hasAccess,

    // Refetch functions
    refetchSubscription,
    refetchFeatures,
    refetchInvoices,

    // Errors
    licensesError,
    subscriptionError,
    featuresError,
    invoicesError,
  };
}