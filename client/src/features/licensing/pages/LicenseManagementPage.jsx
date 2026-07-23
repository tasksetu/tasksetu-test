import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Link, useLocation, useSearch } from "wouter";
import {
  Zap,
  Users,
  Database,
  FolderOpen,
  AlertCircle,
  Activity,
  Flag,
  Repeat,
  Crown,
  TrendingUp,
  Check,
  Star,
  Gift,
  CreditCard,
  Shield,
  Clock,
  CheckSquare,
  FileText,
  Workflow,
  BarChart3,
  RefreshCcw,
  Info,
  ShoppingCart,
  CheckCircle2,
  Building2,
  Award,
  Loader, // ✅ NEW: License icon
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "../../../utils/auth";
import { useToast } from "@/hooks/use-toast";
import { PurchasePlanModal } from "@/components/PurchasePlanModal";
import { useUserLicenseManagement } from "../hooks/useUserLicenseManagement"; // ✅ NEW
import { PLAN_ORDER, getOrderedPlanEntries } from "@/utils/licenseConstants";

/**
 * License Differences Section - Shows detailed feature differences between plans
 */
function LicenseDifferencesSection({
  plans,
  currentPlanCode,
  featuresData,
  onUpgrade,
}) {
  const orderedPlans = PLAN_ORDER.filter((key) => plans[key]).map((key) => ({
    key,
    ...plans[key],
  }));

  const { data: allFeaturesResponse, isLoading: featuresLoading } = useQuery({
    queryKey: ["/api/license/features"],
    queryFn: async () => {
      const response = await fetch("/api/license/features");
      if (!response.ok) throw new Error("Failed to fetch features list");
      return response.json();
    },
  });

  // Define feature categories with their limits per plan
  const featureCategories = useMemo(() => {
    if (!allFeaturesResponse?.features) {
      return [];
    }

    const allFeaturesGrouped = allFeaturesResponse.features || {};
    const allMappings = allFeaturesResponse.mappings || [];

    const mappingMap = {};
    allMappings.forEach((m) => {
      if (!mappingMap[m.feature_code]) {
        mappingMap[m.feature_code] = {};
      }
      mappingMap[m.feature_code][m.license_code.toUpperCase()] = m;
    });

    const getDisplayLimit = (featureCode, planCode) => {
      const mapping = mappingMap[featureCode]?.[planCode.toUpperCase()];
      if (!mapping || !mapping.is_enabled) return false;
      
      if (mapping.usage_limit > 0) {
        return mapping.usage_limit;
      }
      
      if (mapping.usage_limit === -1) {
        const limitCodes = ["TASK_BASIC", "FORM_CREATE", "PROC_CREATE", "REPORT_BASIC"];
        if (limitCodes.includes(featureCode)) {
          return "Unlimited";
        }
        return true;
      }
      
      return true;
    };

    const limitCodes = ["TASK_BASIC", "FORM_CREATE", "PROC_CREATE", "REPORT_BASIC"];
    const usageLimitsGroup = {
      category: "Usage Limits",
      icon: "📊",
      features: [],
    };

    const allFeaturesList = Object.values(allFeaturesGrouped).flat();
    
    limitCodes.forEach((code) => {
      const feat = allFeaturesList.find((f) => f.feature_code === code);
      if (feat) {
        usageLimitsGroup.features.push({
          name: feat.name,
          code: code,
          limits: {
            explore: getDisplayLimit(code, "explore"),
            plan: getDisplayLimit(code, "plan"),
            execute: getDisplayLimit(code, "execute"),
            optimize: getDisplayLimit(code, "optimize"),
          },
        });
      }
    });

    const categoryLabels = {
      "CORE": "Core Features",
      "ADVANCED": "Advanced Features",
      "PREMIUM": "Premium Features",
      "ENTERPRISE": "Enterprise Features",
      "REPORTING": "Reporting & Insights",
      "SUPPORT": "Support & Security",
    };
    const categoryIcons = {
      "CORE": "⚡",
      "ADVANCED": "🚀",
      "PREMIUM": "👑",
      "ENTERPRISE": "🏢",
      "REPORTING": "📊",
      "SUPPORT": "🔒",
    };

    const dynamicCategories = [usageLimitsGroup];

    Object.keys(allFeaturesGrouped).forEach((catKey) => {
      const rawFeats = allFeaturesGrouped[catKey];
      const mappedFeats = rawFeats
        .filter((f) => !limitCodes.includes(f.feature_code))
        .map((f) => {
          let valExplore = getDisplayLimit(f.feature_code, "explore");
          let valPlan = getDisplayLimit(f.feature_code, "plan");
          let valExecute = getDisplayLimit(f.feature_code, "execute");
          let valOptimize = getDisplayLimit(f.feature_code, "optimize");

          if (f.feature_code === "API_ACCESS") {
            valExecute = valExecute ? "Limited" : false;
            valOptimize = valOptimize ? "Full" : false;
          }

          return {
            name: f.name,
            code: f.feature_code,
            limits: {
              explore: valExplore,
              plan: valPlan,
              execute: valExecute,
              optimize: valOptimize,
            },
          };
        });

      if (mappedFeats.length > 0) {
        dynamicCategories.push({
          category: categoryLabels[catKey] || catKey,
          icon: categoryIcons[catKey] || "⚡",
          features: mappedFeats,
        });
      }
    });

    return dynamicCategories;
  }, [allFeaturesResponse]);

  const renderValue = (value, planKey) => {
    if (value === -1 || value === "Unlimited") {
      return <span className="text-green-600 font-semibold">Unlimited</span>;
    }
    if (value === true) {
      return <Check className="h-5 w-5 text-green-500 mx-auto" />;
    }
    if (value === false) {
      return <X className="h-5 w-5 text-gray-300 mx-auto" />;
    }
    if (typeof value === "number") {
      return <span className="font-medium text-gray-900">{value}</span>;
    }
    return <span className="text-gray-700 text-sm">{value}</span>;
  };

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-200 mt-3 overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <BarChart3 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">
              License Differences
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
              Detailed comparison of features and limits across all plans
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {/* Sticky Header */}
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="text-left p-4 font-semibold text-gray-700 min-w-[200px] border-b border-gray-200">
                Feature
              </th>
              {orderedPlans.map((plan) => (
                <th
                  key={plan.key}
                  className={cn(
                    "text-center p-4 font-semibold min-w-[120px] border-b border-gray-200",
                    currentPlanCode?.toLowerCase() === plan.key
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700",
                  )}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span>{plan.name}</span>
                    {currentPlanCode?.toLowerCase() === plan.key && (
                      <Badge className="bg-blue-100 text-blue-700 text-[10px] px-2">
                        Current
                      </Badge>
                    )}
                    <span className="text-xs font-normal text-gray-500">
                      ₹{plan.price?.monthly || 0}/mo
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {featuresLoading ? (
            <tbody>
              <tr>
                <td colSpan={orderedPlans.length + 1} className="p-8 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader className="h-7 w-7 text-blue-600 animate-spin" />
                    <span className="text-gray-500 text-sm font-medium">Loading plan features...</span>
                  </div>
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {featureCategories.map((category, catIdx) => (
                <React.Fragment key={category.category}>
                  {/* Category Header Row */}
                  <tr className="bg-gray-100">
                    <td
                      colSpan={orderedPlans.length + 1}
                      className="p-3 font-semibold text-gray-800"
                    >
                      <div className="flex items-center gap-2">
                        <span>{category.icon}</span>
                        <span>{category.category}</span>
                      </div>
                    </td>
                  </tr>

                  {/* Feature Rows */}
                  {category.features.map((feature, idx) => (
                    <tr
                      key={feature.name}
                      className={cn(
                        "border-b border-gray-100 hover:bg-gray-50 transition-colors",
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50/50",
                      )}
                    >
                      <td className="p-3 sm:p-4 text-gray-700 font-medium">
                        {feature.name}
                      </td>
                      {orderedPlans.map((plan) => (
                        <td
                          key={plan.key}
                          className={cn(
                            "p-3 sm:p-4 text-center",
                            currentPlanCode?.toLowerCase() === plan.key &&
                              "bg-blue-50/50",
                          )}
                        >
                          {renderValue(feature.limits[plan.key], plan.key)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          )}
        </table>
      </div>

      {/* Footer with upgrade prompt */}
      <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Info className="h-4 w-4 text-blue-500" />
            <span>
              Upgrade anytime to unlock more features and higher limits
            </span>
          </div>
          <Button
            className={cn(
              "text-sm",
              onUpgrade
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-gray-100 text-gray-500 cursor-not-allowed",
            )}
            onClick={onUpgrade}
            disabled={!onUpgrade}
          >
            {onUpgrade ? (
              <>
                <TrendingUp className="h-4 w-4 mr-2" />
                Upgrade Plan
              </>
            ) : (
              <span>Contact Admin for Upgrades</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * License Management Page - In-app summary with usage meters, trial countdown, plan comparison cards
 */
function ComparisonTable({ plans, currentPlanCode }) {
  const [expanded, setExpanded] = useState(false);

  // Get plan entries with stable keys (excluding expired) in correct order: Explore → Plan → Execute → Optimize
  const planEntries = getOrderedPlanEntries(plans).filter(
    ([key]) => key !== "expired",
  );

  // Get all feature names from all plans
  const allFeatures = Object.values(plans).reduce((acc, plan) => {
    if (plan.features && Array.isArray(plan.features)) {
      plan.features.forEach((feature) => {
        if (!acc.includes(feature)) {
          acc.push(feature);
        }
      });
    }
    return acc;
  }, []);

  // Show first 5 features only in collapsed mode
  const visibleFeatures = expanded ? allFeatures : allFeatures.slice(0, 5);

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-200 mt-4 sm:mt-8 overflow-hidden">
      {/* Heading */}
      <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
        <h2 className="text-base sm:text-xl font-bold text-gray-900">
          Compare Our Plans
        </h2>
        <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">
          Compare features across all available plans
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm text-left border-collapse">
          {/* Header Row */}
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 sm:p-4 text-left font-semibold text-gray-700 border-b border-gray-200 min-w-[180px]">
                Features
              </th>
              {planEntries.map(([planKey, plan]) => (
                <th
                  key={`header-${planKey}`}
                  className="p-3 sm:p-4 text-center align-top border-l border-b border-gray-200"
                >
                  <div className="text-sm sm:text-lg font-semibold text-gray-900">
                    {plan.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    ₹{plan.price.monthly}/mo
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* Feature Rows */}
            {visibleFeatures.map((feature, featureIdx) => (
              <tr
                key={`feature-row-${featureIdx}`}
                className={cn(
                  "border-b border-gray-100",
                  featureIdx % 2 === 0 ? "bg-white" : "bg-gray-50/50",
                )}
              >
                <td className="p-3 sm:p-4 text-gray-700 font-medium">
                  {feature}
                </td>
                {planEntries.map(([planKey, plan]) => {
                  const hasFeature =
                    plan.features && plan.features.includes(feature);
                  return (
                    <td
                      key={`feature-${planKey}-${featureIdx}`}
                      className="p-3 sm:p-4 text-center border-l border-gray-200"
                    >
                      {hasFeature ? (
                        <Check className="h-5 w-5 text-green-500 mx-auto" />
                      ) : (
                        <X className="h-5 w-5 text-gray-300 mx-auto" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Expand/Collapse Toggle Row */}
            {allFeatures.length > 5 && (
              <tr className="border-t border-gray-100 bg-gray-50">
                <td colSpan={planEntries.length + 1} className="p-2 sm:p-4">
                  <Button
                    variant="primary"
                    onClick={() => setExpanded(!expanded)}
                    className="w-full h-9 py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm font-medium flex items-center justify-center gap-2"
                  >
                    {expanded ? (
                      <>
                        <ChevronUp className="h-4 w-4" /> Hide Detailed Features
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" /> Show All{" "}
                        {allFeatures.length} Features
                      </>
                    )}
                  </Button>
                </td>
              </tr>
            )}

            {/* Price Row */}
            <tr className="border-t border-gray-300 bg-gray-100">
              <td className="p-3 sm:p-4 font-semibold text-gray-700">Price</td>
              {planEntries.map(([planKey, plan]) => (
                <td
                  key={`price-${planKey}`}
                  className="p-3 sm:p-4 text-center border-l border-gray-200"
                >
                  <div className="text-lg sm:text-xl font-bold text-gray-900">
                    ₹{plan.price.monthly}
                  </div>
                  <div className="text-xs text-gray-600">per month</div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function LicenseManagementPage() {
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [selectedPlan, setSelectedPlan] = useState("optimize");
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showExpiryBanner, setShowExpiryBanner] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showExpiredOverlay, setShowExpiredOverlay] = useState(true);
  const [location, setLocation] = useLocation();

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isAdmin } = useUserRole();

  // Define role-based access with isPrimaryAdmin check
  // Check multiple locations for isPrimaryAdmin field (handles different API response structures)
  const isPrimaryAdmin =
    user?.isPrimaryAdmin === true || user?.user?.isPrimaryAdmin === true;
  const userRoles = Array.isArray(user?.role)
    ? user?.role
    : user?.role
      ? [user.role]
      : [];
  const activeRole = user?.activeRole || userRoles[0] || "";

  const isOrgAdmin =
    userRoles.includes("org_admin") || activeRole === "org_admin";
  const isManager = userRoles.includes("manager") || activeRole === "manager";
  const isEmployee =
    userRoles.includes("employee") || activeRole === "employee";
  const isIndividual =
    userRoles.includes("individual") || activeRole === "individual";

  // Check URL params to auto-open purchase modal
  useEffect(() => {
    if (!user) return; // Wait for user data to load
    const urlParams = new URLSearchParams(window.location.search);
    if (
      urlParams.get("openPurchaseModal") === "true" &&
      (isPrimaryAdmin || isIndividual)
    ) {
      setShowPurchaseModal(true);
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [user, isPrimaryAdmin, isIndividual]);

  // Role-based permissions
  const canViewFullDashboard = isPrimaryAdmin;
  const canViewUsageOnly = isOrgAdmin && !isPrimaryAdmin;
  const canViewLimitedInfo = isManager || isEmployee;
  const isSecondaryOrgAdmin = isOrgAdmin && !isPrimaryAdmin; // ✅ NEW: Secondary org_admin flag

  // Define role-based access
  const isEmployeeOrManager = isManager || isEmployee;

  // ✅ NEW: Get license pool data for secondary org_admin
  const {
    licensePool,
    isPoolLoading,
    orgUsers,
    isOrgUsersLoading,
    refetchPool,
    refetchOrgUsers,
  } = useUserLicenseManagement();

  // Debug role information
  console.log("License Page - User Data:", user);
  console.log("License Page - Role Detection:", {
    isPrimaryAdmin,
    isPrimaryAdminDirect: user?.isPrimaryAdmin,
    isPrimaryAdminNested: user?.user?.isPrimaryAdmin,
    isOrgAdmin,
    isSecondaryOrgAdmin,
    isManager,
    isEmployee,
    activeRole,
    userRoles,
    canViewFullDashboard,
    canViewUsageOnly,
    canViewLimitedInfo,
  });

  // Fetch current license and usage for the user (NEW - Rule Engine API)
  const {
    data: currentLicenseResponse,
    isLoading: currentLicenseLoading,
    error: currentLicenseError,
  } = useQuery({
    queryKey: ["/api/license/current"],
    queryFn: async () => {
      const response = await fetch("/api/license/current", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch current license");
      return response.json();
    },
  });

  // Fetch dynamic license plans
  const { data: plansResponse, isLoading: plansLoading } = useQuery({
    queryKey: ["/api/license/licenses"],
    queryFn: async () => {
      const response = await fetch("/api/license/licenses", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch plans");
      return response.json();
    },
  });

  // Fetch current subscription data
  const {
    data: subscriptionResponse,
    isLoading: subscriptionLoading,
    error: subscriptionError,
  } = useQuery({
    queryKey: ["/api/license/organization/subscription"],
    queryFn: async () => {
      const response = await fetch("/api/license/organization/subscription", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch subscription");
      return response.json();
    },
  });

  // Fetch organization license info for real-time data
  const { data: licenseInfoResponse } = useQuery({
    queryKey: ["/api/license/organization/features"],
    queryFn: async () => {
      const response = await fetch("/api/license/organization/features", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch license info");
      return response.json();
    },
  });

  // Features are already fetched from /api/license/organization/features
  // This provides usage-aware feature data specific to the user/org

  // Fetch current user's profile for assigned license (for non-admin users)
  const { data: userProfileResponse, isLoading: userProfileLoading } = useQuery(
    {
      queryKey: ["/api/profile"],
      queryFn: async () => {
        const response = await fetch("/api/profile", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        if (!response.ok) throw new Error("Failed to fetch user profile");
        return response.json();
      },
      enabled: !isOrgAdmin, // Only fetch for non-admin users
    },
  );

  const plansData = plansResponse?.licenses || plansResponse?.data || [];
  const subscriptionData =
    subscriptionResponse?.subscription || subscriptionResponse?.data;
  const orgFeatures = licenseInfoResponse?.features || {};
  const featuresData = Array.isArray(orgFeatures)
    ? orgFeatures
    : orgFeatures && typeof orgFeatures === "object"
      ? Object.values(orgFeatures).flat()
      : [];

  const licenseInfo = licenseInfoResponse?.features || licenseInfoResponse;
  const userProfile = userProfileResponse?.user || userProfileResponse;

  // NEW: Extract current license data from Rule Engine API
  const currentLicenseData =
    currentLicenseResponse?.data || currentLicenseResponse;
  const licenseUsage = currentLicenseData?.usage || {};

  // For all users, use /api/license/current as single source of truth
  let assignedLicense = null;
  let activeLicenseCode = null;
  let userFeatures = {};
  let userLimits = {};

  if (!isOrgAdmin && !isEmployeeOrManager) {
    // Individual users - use /api/license/current
    assignedLicense = {
      license_code: currentLicenseData?.license,
      license_name: currentLicenseData?.licenseName,
      renewal_date: currentLicenseData?.licenseDetails?.renewal_date,
      billing_cycle: currentLicenseData?.licenseDetails?.billing_cycle,
      ...currentLicenseData?.licenseDetails,
    };
    activeLicenseCode =
      currentLicenseData?.license ||
      subscriptionData?.license_code ||
      "EXPLORE";
    userFeatures = currentLicenseData?.features || {};
    userLimits = currentLicenseData?.licenseDetails || {};
  } else if (isEmployeeOrManager) {
    // Managers/Employees - use /api/license/current for assigned license
    assignedLicense = {
      license_code: currentLicenseData?.license,
      license_name: currentLicenseData?.licenseName,
      renewal_date: currentLicenseData?.licenseDetails?.renewal_date,
      billing_cycle: currentLicenseData?.licenseDetails?.billing_cycle,
      ...currentLicenseData?.licenseDetails,
    };
    activeLicenseCode = currentLicenseData?.license || "EXPLORE";
    userFeatures = currentLicenseData?.features || {};
    userLimits = currentLicenseData?.licenseDetails || {};

  } else {
    // Org Admin - use organization license
    assignedLicense = {
      license_code: currentLicenseData?.license,
      license_name: currentLicenseData?.licenseName,
      renewal_date: currentLicenseData?.licenseDetails?.renewal_date,
      billing_cycle: currentLicenseData?.licenseDetails?.billing_cycle,
      ...currentLicenseData?.licenseDetails,
    };
    activeLicenseCode =
      currentLicenseData?.license ||
      subscriptionData?.license_code ||
      subscriptionData?.current_license ||
      licenseInfo?.licenseType ||
      "EXECUTE";
    userFeatures = currentLicenseData?.features || {};
    userLimits = currentLicenseData?.licenseDetails || {};
  }

  // Find current plan based on the active license
  const currentPlan = plansData.find(
    (plan) => plan.license_code === activeLicenseCode,
  );

  // If no plan found, create a fallback based on current license
  const effectivePlan = currentPlan || {
    license_code: activeLicenseCode || "EXPLORE",
    license_name:
      assignedLicense?.license_name ||
      activeLicenseCode ||
      "Explore",
    description: "Free Plan",
    price_monthly: 0,
    price_yearly: 0,
    features_summary: [],
  };

  // Get real-time license type
  const currentLicenseType = activeLicenseCode || "No Plane";

  // Stable fallback limits (used while data loads or for missing definitions)
  const fallbackLimits = useMemo(
    () => ({
      TASK_BASIC: 10,
      FORM_CREATE: 2,
      PROC_CREATE: 1,
      REPORT_BASIC: 5,
    }),
    [],
  );

  // Memo map of feature_code -> normalized limit for active plan
  const featureLimitMap = useMemo(() => {
    if (!effectivePlan || !featuresData || featuresData.length === 0)
      return fallbackLimits;
    const map = { ...fallbackLimits };
    for (const feature of featuresData) {
      if (!Array.isArray(feature.license_features)) continue;
      const planFeature = feature.license_features.find(
        (lf) => lf.license_code === effectivePlan.license_code,
      );
      if (!planFeature) continue;
      const raw = planFeature.usage_limit;
      if (raw === -1) {
        map[feature.feature_code] = -1; // Unlimited
      } else if (raw === null || raw === undefined) {
        // leave fallback
      } else {
        map[feature.feature_code] = raw;
      }
    }
    return map;
  }, [effectivePlan?.license_code, featuresData, fallbackLimits]);

  const getFeatureLimit = (featureCode) => featureLimitMap[featureCode] ?? 0;

  const getUsage = (featureCode) => {
    // Use currentLicenseData.usage from /api/license/current as primary source
    const usageData = currentLicenseData?.usage?.[featureCode];
    if (usageData) {
      return usageData.used || 0;
    }
    // Fallback to subscriptionData
    return subscriptionData?.usage?.[featureCode] || 0;
  };

  const getUsagePercentage = (used, limit) => {
    if (limit === null || limit === -1) return 0;
    if (!limit || limit === 0) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageStatus = (featureCode) => {
    // Use currentLicenseData.usage from /api/license/current as primary source
    const usageFromApi = currentLicenseData?.usage?.[featureCode];

    // If we have usage data from /api/license/current, use it directly
    if (usageFromApi) {
      const apiLimit = usageFromApi.limit;
      const apiUsed = usageFromApi.used || 0;
      const apiIsUnlimited = usageFromApi.isUnlimited || apiLimit === -1;
      const apiRemaining = apiIsUnlimited
        ? Infinity
        : Math.max(0, apiLimit - apiUsed);
      const apiPercentage = apiIsUnlimited
        ? 0
        : apiLimit > 0
          ? Math.min((apiUsed / apiLimit) * 100, 100)
          : 0;

      return {
        rawCurrent: apiUsed,
        current: apiUsed,
        limit: apiLimit,
        remaining: apiRemaining,
        percentage: apiPercentage,
        isOverLimit: !apiIsUnlimited && apiLimit > 0 && apiUsed > apiLimit,
        isNearLimit: !apiIsUnlimited && apiLimit > 0 && apiPercentage > 80,
        isUnlimited: apiIsUnlimited,
      };
    }

    // Fallback to old logic
    const rawCurrent = getUsage(featureCode);
    const limit = getFeatureLimit(featureCode);
    // Clamp display current so UI number never exceeds limit (unless unlimited)
    const displayCurrent = limit > 0 && rawCurrent > limit ? limit : rawCurrent;
    const percentage = getUsagePercentage(rawCurrent, limit);

    // Handle cases where limit might be 0, null, undefined, or -1
    let remaining;
    let isUnlimited;

    if (limit === -1) {
      remaining = Infinity;
      isUnlimited = true;
    } else if (
      limit === 0 ||
      limit === null ||
      limit === undefined ||
      isNaN(limit)
    ) {
      remaining = 0;
      isUnlimited = false;
    } else {
      remaining = Math.max(0, limit - rawCurrent);
      isUnlimited = false;
    }

    return {
      rawCurrent: rawCurrent || 0,
      current: displayCurrent || 0,
      // Preserve -1 so UI can detect unlimited instead of converting to 0
      limit: limit === -1 ? -1 : limit || 0,
      remaining,
      percentage: isNaN(percentage) ? 0 : percentage,
      isOverLimit: !isUnlimited && limit > 0 && rawCurrent > limit,
      isNearLimit: !isUnlimited && limit > 0 && percentage > 80,
      isUnlimited,
    };
  };

  // ✅ NEW: Get all usage stats for display (derived from active features)
  const usageStats = useMemo(() => {
    // 1. Core feature codes that always have tracking
    const coreCodes = [
      "TASK_BASIC",
      "FORM_CREATE",
      "PROC_CREATE",
      "REPORT_BASIC",
    ];

    // 2. Add any other codes present in the actual usage data from API
    // This dynamically handles new features like REPORT_TASK_AUDIT etc.
    const apiUsageCodes = Object.keys(currentLicenseData?.usage || {});
    const allCodes = Array.from(new Set([...coreCodes, ...apiUsageCodes]));

    // 3. Map to display info
    return allCodes
      .map((code) => {
        const status = getUsageStatus(code);
        const feature = featuresData.find((f) => f.feature_code === code);

        // Skip features with no limits and no usage (not relevant for this view)
        if (status.limit === 0 && status.current === 0 && !feature) return null;

        // Define default info for core features
        const defaults = {
          TASK_BASIC: {
            label: "Basic Tasks",
            icon: CheckSquare,
            desc: "Tasks created",
          },
          FORM_CREATE: {
            label: "Create Forms",
            icon: FileText,
            desc: "Custom forms",
          },
          PROC_CREATE: {
            label: "Create Processes",
            icon: Workflow,
            desc: "Flows",
          },
          // "REPORT_BASIC": { label: "Reports", icon: BarChart3, desc: "Total reports" },
          REPORT_ACTIVITY: {
            label: "Activity",
            icon: Activity,
            desc: "Engagement",
          },
          REPORT_MILESTONE: {
            label: "Milestones",
            icon: Flag,
            desc: "Progress",
          },
          REPORT_RECURRING: {
            label: "Recurring",
            icon: Repeat,
            desc: "Adherence",
          },
          REPORT_OVERDUE: {
            label: "Overdue",
            icon: AlertCircle,
            desc: "Overdue",
          },
          REPORT_PRODUCTIVITY: {
            label: "Productivity",
            icon: Zap,
            desc: "Efficiency",
          },
          REPORT_WORKLOAD: {
            label: "Workload",
            icon: Users,
            desc: "Distribution",
          },
        };

        return {
          key: code,
          label:
            feature?.feature_name ||
            defaults[code]?.label ||
            code.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
          description:
            feature?.description ||
            defaults[code]?.desc ||
            "Resource usage tracking",
          icon:
            defaults[code]?.icon ||
            (code.startsWith("REPORT") ? BarChart3 : Zap),
          status,
        };
      })
      .filter(Boolean);
  }, [
    currentLicenseData?.usage,
    featuresData,
    featureLimitMap,
    subscriptionData,
  ]);

  // Debug logging
  console.log("API Responses:", {
    plansResponse,
    subscriptionResponse,
    licenseInfoResponse,
    subscriptionError,
  });

  // Additional debug for features data structure
  console.log("Features Data Structure:", featuresData);
  console.log("Current/Effective Plan:", { currentPlan, effectivePlan });
  if (featuresData && featuresData.length > 0) {
    console.log("Sample feature:", featuresData[0]);
    if (featuresData[0]?.license_features) {
      console.log("Sample license_features:", featuresData[0].license_features);
    }
  }

  // Debug feature limits for current plan
  console.log("Feature Limits Debug:", {
    TASK_BASIC: getFeatureLimit("TASK_BASIC"),
    FORM_CREATE: getFeatureLimit("FORM_CREATE"),
    PROC_CREATE: getFeatureLimit("PROC_CREATE"),
    REPORT_BASIC: getFeatureLimit("REPORT_BASIC"),
  });

  // Calculate days until expiry - Use /api/license/current as primary source
  const calculateDaysUntilExpiry = () => {
    console.log("\n📅 === EXPIRY DATE CALCULATION DEBUG ===");
    console.log("Current License Data:", currentLicenseData);
    console.log("Current License Code:", activeLicenseCode);

    // Find the license definition from plansData
    const licenseDef = plansData.find(
      (plan) => plan.license_code === activeLicenseCode,
    );
    console.log("License Definition:", licenseDef);
    console.log("Trial Days from License Def:", licenseDef?.trial_days);

    const getDaysDifference = (targetDate) => {
      if (!targetDate) return 0;
      const target = new Date(targetDate);
      const current = new Date();
      
      // Strip time components to calculate pure calendar days
      const targetDateOnly = new Date(target.getFullYear(), target.getMonth(), target.getDate());
      const currentDateOnly = new Date(current.getFullYear(), current.getMonth(), current.getDate());
      
      const diffTime = targetDateOnly.getTime() - currentDateOnly.getTime();
      return Math.round(diffTime / (1000 * 60 * 60 * 24));
    };

    // PRIORITY 1: Use currentLicenseData.expiry from /api/license/current
    if (currentLicenseData?.expiry) {
      const calculatedDays = getDaysDifference(currentLicenseData.expiry);

      console.log("📍 Using expiry from /api/license/current:");
      console.log("  - Expiry from API:", currentLicenseData.expiry);
      console.log("  - Calculated Days:", calculatedDays);
      console.log(
        "  - Expected Days (from trial_days):",
        licenseDef?.trial_days,
      );

      // ⚠️ Warning if days remaining exceed total trial days defined in DB
      if (licenseDef?.trial_days && currentLicenseData?.status === "TRIAL") {
        const daysFromAPI = calculatedDays;
        const expectedTotalDays = licenseDef.trial_days;

        if (daysFromAPI > expectedTotalDays) {
          console.warn("⚠️ WARNING: Expiry date mismatch detected!");
          console.warn(`  - API shows ${daysFromAPI} days remaining`);
          console.warn(
            `  - System definition only allows ${expectedTotalDays} trial days`,
          );
          console.warn(
            "  - This confirms the backend used a default 15/30 day value instead of DB value!",
          );
        }
      }

      return calculatedDays;
    }

    // Fallback: Check licenseInfo for trial/expiry dates
    if (licenseInfo?.trialEndDate) {
      return getDaysDifference(licenseInfo.trialEndDate);
    }

    if (licenseInfo?.subscriptionEndDate) {
      return getDaysDifference(licenseInfo.subscriptionEndDate);
    }

    // Fallback to subscription data
    if (
      subscriptionData?.subscription_status === "trial" &&
      subscriptionData?.trial_end
    ) {
      return getDaysDifference(subscriptionData.trial_end);
    }

    if (subscriptionData?.subscription_end_date) {
      const calculatedDays = getDaysDifference(subscriptionData.subscription_end_date);

      // Fix for incorrect dates: If the calculated days is around 4-5 but seems wrong
      if (
        subscriptionData.subscription_status === "active" &&
        calculatedDays < 10 &&
        calculatedDays > 0
      ) {
        if (
          subscriptionData.billing_cycle === "YEARLY" &&
          subscriptionData.subscription_start_date
        ) {
          const startDate = new Date(subscriptionData.subscription_start_date);
          const correctExpiry = new Date(
            startDate.getTime() + 365 * 24 * 60 * 60 * 1000,
          );
          const correctDays = getDaysDifference(correctExpiry);

          if (correctDays > 300 && correctDays <= 365) {
            return correctDays;
          }
        }
      }

      return calculatedDays;
    }
    return 0;
  };
  const daysUntilExpiry = calculateDaysUntilExpiry();

  // Calculate corrected expiration date for display if needed
  const getDisplayExpirationDate = () => {
    console.log(
      "\n� ========== STEP 3: DISPLAY EXPIRY DATE CALCULATION ==========",
    );
    console.log("📆 Checking expiry date sources...");

    // PRIORITY 1: Use currentLicenseData.expiry from /api/license/current
    if (currentLicenseData?.expiry) {
      const expiryDate = new Date(currentLicenseData.expiry);
      console.log("  ✅ Using expiry from currentLicenseData.expiry");
      console.log("  📅 Raw Value:", currentLicenseData.expiry);
      console.log("  📅 Parsed Date Object:", expiryDate);
      console.log("  📅 Formatted Date:", expiryDate.toLocaleDateString());
      console.log("  📅 ISO String:", expiryDate.toISOString());
      return expiryDate.toLocaleDateString();
    }

    // Fallback: Check licenseInfo for accurate dates
    if (licenseInfo?.trialEndDate) {
      return new Date(licenseInfo.trialEndDate).toLocaleDateString();
    }

    if (licenseInfo?.subscriptionEndDate) {
      return new Date(licenseInfo.subscriptionEndDate).toLocaleDateString();
    }

    // Fallback to subscription data
    if (
      subscriptionData?.subscription_status === "trial" &&
      subscriptionData?.trial_end
    ) {
      return new Date(subscriptionData.trial_end).toLocaleDateString();
    }

    if (subscriptionData?.subscription_end_date) {
      const storedExpiry = new Date(subscriptionData.subscription_end_date);
      const now = new Date();
      const storedDays = Math.ceil(
        (storedExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      // If we detect a yearly subscription with incorrect date, show corrected date
      if (
        subscriptionData.subscription_status === "active" &&
        storedDays < 10 &&
        storedDays > 0 &&
        subscriptionData.billing_cycle === "YEARLY" &&
        subscriptionData.subscription_start_date
      ) {
        const startDate = new Date(subscriptionData.subscription_start_date);
        const correctExpiry = new Date(
          startDate.getTime() + 365 * 24 * 60 * 60 * 1000,
        );
        const correctDays = Math.ceil(
          (correctExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (correctDays > 300 && correctDays <= 365) {
          return correctExpiry.toLocaleDateString();
        }
      }

      return storedExpiry.toLocaleDateString();
    }

    return "Never";
  };

  // 📊 Final Debug Summary
  console.log("\n� ========== STEP 4: FINAL EXPIRY SUMMARY ==========");
  console.log("📅 Days Until Expiry:", daysUntilExpiry);
  console.log("📅 Display Expiry Date:", getDisplayExpirationDate());
  console.log("📊 Current License Status:", currentLicenseData?.status);
  console.log("❌ Is Expired:", currentLicenseData?.isExpired);
  console.log("🔵 Trial Expired:", currentLicenseData?.trialExpired);
  console.log("📅 Current Date:", new Date().toLocaleDateString());
  console.log("📅 Expiry Date from API:", currentLicenseData?.expiry);

  if (daysUntilExpiry < 0) {
    console.log("⚠️ WARNING: Days until expiry is NEGATIVE!");
    console.log("⚠️ This means the license has expired");
    console.log("⚠️ Days overdue:", Math.abs(daysUntilExpiry));
  } else if (daysUntilExpiry === 0) {
    console.log("⚠️ WARNING: License expires TODAY!");
  } else if (daysUntilExpiry <= 5) {
    console.log(
      "⚠️ WARNING: License expiring soon (",
      daysUntilExpiry,
      "days)",
    );
  } else {
    console.log("✅ License is active with", daysUntilExpiry, "days remaining");
  }
  console.log("🔍 =============================================\n");

  // 🔍 Calculate what the correct expiry date SHOULD be based on trial_days
  const getExpectedExpiryInfo = () => {
    const licenseDef = plansData.find(
      (plan) => plan.license_code === activeLicenseCode,
    );
    if (
      !licenseDef ||
      !licenseDef.trial_days ||
      currentLicenseData?.status !== "TRIAL"
    ) {
      return null;
    }

    // Calculate expected expiry from trial_days
    // We need to know when the trial started, but we can estimate from current expiry
    const currentExpiry = currentLicenseData?.expiry
      ? new Date(currentLicenseData.expiry)
      : null;
    if (!currentExpiry) return null;

    const now = new Date();
    const daysFromAPI = Math.ceil(
      (currentExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    const expectedTotalDays = licenseDef.trial_days;

    // ✅ Robust Mismatch Logic:
    // A mismatch is detected if the remaining days from API is GREATER than the total trial days allowed
    // (since remaining days should always be <= total days)
    const mismatch = daysFromAPI > expectedTotalDays;

    return {
      expectedDays: expectedTotalDays,
      actualDays: daysFromAPI,
      mismatch,
      message: mismatch
        ? `⚠️ Backend shows ${daysFromAPI} days remaining, but the license only allows ${expectedTotalDays} total trial days.`
        : `✅ Expiry date is valid (Remaining: ${daysFromAPI} days, Limit: ${expectedTotalDays} days)`,
    };
  };

  const expiryInfo = getExpectedExpiryInfo();
  if (expiryInfo) {
    console.log("🔍 Expiry Date Validation:", expiryInfo.message);
  }

  const isOnTrial =
    currentLicenseType !== "EXPLORE" &&
    currentLicenseData?.license !== "EXPLORE" &&
    (licenseInfo?.isTrial || subscriptionData?.subscription_status === "trial" || false);
  // PRIORITY: Use currentLicenseData.isExpired from /api/license/current
  // 🧪 FOR TEST MODE: In development, allow access even if license shows expired
  const isDevelopmentMode =
    process.env.NODE_ENV === "development" ||
    localStorage.getItem("DEV_MODE") === "true";

  const gracePeriodInfo = subscriptionData?.grace_period_info;
  const isInGracePeriod = gracePeriodInfo?.is_in_grace_period;

  // Raw expiration status based on dates
  const isDateExpired =
    currentLicenseData?.isExpired === true ||
    (currentLicenseData?.isExpired !== false &&
      (licenseInfo?.isExpired || daysUntilExpiry <= 0));

  // Actual functional expiration (locked out)
  const isExpired = isDevelopmentMode
    ? false
    : isDateExpired && !isInGracePeriod;

  const isExpiringSoon =
    !isExpired &&
    !isInGracePeriod &&
    daysUntilExpiry <= 5 &&
    daysUntilExpiry > 0;

  // Upgrade mutation
  const upgradeSubscription = useMutation({
    mutationFn: async ({ newLicenseCode, billingCycle }) => {
      const response = await fetch(
        "/api/license/organization/subscription/upgrade",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            license_code: newLicenseCode,
            billing_cycle: billingCycle?.toUpperCase(),
          }),
        },
      );

      if (!response.ok) throw new Error("Failed to upgrade subscription");
      return response.json();
    },
    onSuccess: (data) => {
      console.log("\n🔍 ========== UPGRADE SUCCESS ==========");
      console.log("✅ Upgrade Response:", JSON.stringify(data, null, 2));
      console.log("🔄 Invalidating queries...");

      toast({
        title: "Subscription Upgraded!",
        description: "Your new plan is now active.",
      });

      // Invalidate all license-related queries to refresh data
      queryClient.invalidateQueries({
        queryKey: ["/api/license/organization/subscription"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/license/current"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/license/organization/features"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/license/licenses"],
      });

      console.log("✅ All queries invalidated - data will refresh");
      console.log("🔍 =======================================\n");

      // Force a page refresh after 1 second to ensure all data is updated
      setTimeout(() => {
        console.log("🔄 Forcing page refresh to show updated plan...");
        window.location.reload();
      }, 1000);
    },
    onError: (error) => {
      toast({
        title: "Upgrade Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Convert backend data to frontend format for display
  const convertPlansForDisplay = () => {
    if (!plansData || plansData.length === 0) {
      return {};
    }

    return plansData
      .filter((plan) => plan.license_code !== "EXPIRED") // Exclude EXPIRED plan
      .reduce((acc, plan) => {
        const planKey = plan.license_code.toLowerCase();

        acc[planKey] = {
          name: plan.license_name,
          description: plan.description || `${plan.license_name} plan`,
          price: {
            monthly: plan.price_monthly || 0,
            yearly: plan.price_yearly || 0,
          },
          features: plan.features_summary || [],
          table_data: (plan.features_summary || []).reduce(
            (data, feature, index) => {
              data[`Feature ${index + 1}`] = feature;
              return data;
            },
            {},
          ),
          popular: plan.is_popular || false,
          is_current: plan.is_current || false,
          max_users: plan.max_users,
          trial_days: plan.trial_days,
        };

        return acc;
      }, {});
  };

  const plans = convertPlansForDisplay();


  const getSelectedPlanPrice = () => {
    const plan = plans[selectedPlan];
    return plan ? plan.price[billingCycle] : 0;
  };

  const handleCouponApply = () => {
    if (couponCode.toLowerCase() === "save20") {
      setCouponError("");
      // Apply discount logic if needed
    } else if (couponCode) {
      setCouponError("Invalid coupon code");
    } else {
      setCouponError("Please enter a coupon code");
    }
  };

  const handleUpgrade = (planKey) => {
    setShowPurchaseModal(true);
  };

  return (
    <div className="bg-gray-50 [&_.card]:!rounded-sm [&_input:not([type='checkbox']):not([type='radio'])]:!rounded-sm [&_select]:!rounded-sm [&_textarea]:!rounded-sm [&_.form-input]:!rounded-sm [&_.form-select]:!rounded-sm [&_.form-textarea]:!rounded-sm [&_button:not(.rounded-full)]:!rounded-sm [&_table]:!rounded-sm [&_.bg-white.border]:!rounded-sm [&_.rounded-sm]:!rounded-sm [&_.rounded-md]:!rounded-sm [&_.rounded-lg]:!rounded-sm [&_.rounded-xl]:!rounded-sm [&_.rounded-2xl]:!rounded-sm [&_.rounded]:!rounded-sm [&_.rounded-r-lg]:!rounded-r-sm [&_.rounded-r-md]:!rounded-r-sm [&_input]:h-8 [&_input]:min-h-8 [&_input]:max-h-8 [&_input]:py-0 [&_input]:box-border [&_select]:h-8 [&_select]:min-h-8 [&_select]:max-h-8 [&_select]:py-0 [&_select]:box-border [&_textarea]:min-h-8 [&_.form-input]:h-8 [&_.form-input]:min-h-8 [&_.form-input]:max-h-8 [&_.form-input]:py-0 [&_.form-input]:box-border [&_.form-select]:h-8 [&_.form-select]:min-h-8 [&_.form-select]:max-h-8 [&_.form-select]:py-0 [&_.form-select]:box-border">
      <div
        className="max-w-7xl mx-auto p-3 sm:p-4 pb-6"
        data-testid="license-management-page"
      >
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center space-x-2 sm:space-x-3">
            {" "}
            {showExpiryBanner && isExpiringSoon && (
              <div className="fixed top-0 left-0 right-0 z-50">
                <div className="mx-auto max-w-7xl">
                  <div className="m-2 rounded-md border border-amber-200 bg-amber-50 text-amber-900 px-4 py-2 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <span className="text-sm">
                        Your {isOnTrial ? "trial" : "license"} will expire in{" "}
                        <span className="font-semibold">{trialDaysLeft}</span>{" "}
                        {trialDaysLeft === 1 ? "day" : "days"}.{" "}
                        {isPrimaryAdmin || isIndividual
                          ? "Please renew."
                          : "Please contact your admin."}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {(isPrimaryAdmin || isIndividual) && (
                        <Button
                          size="sm"
                          className="h-7 px-3 bg-amber-600 hover:bg-amber-700 text-white"
                          onClick={() => setShowPurchaseModal(true)}
                        >
                          Renew now
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Dismiss"
                        onClick={() => setShowExpiryBanner(false)}
                        className="p-1 rounded hover:bg-amber-100"
                      >
                        <X className="h-4 w-4 text-amber-700" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="p-2 sm:p-3 bg-blue-100 rounded-xl">
              <Zap className="w-5 h-5 sm:w-7 sm:h-7 text-blue-600" />
            </div>
            <div>
              <h1
                className="text-2xl font-normal m-0"
                style={{ color: "#676a6c" }}
              >
                License Management
              </h1>
              <p className="mt-0 text-sm text-blue-600">
                Manage your plans, subscriptions, and usages
              </p>
            </div>
          </div>

          {/* Purchase Button - Primary Admin / Individual -> Purchase; Others -> Contact Admin */}
          {isPrimaryAdmin || isIndividual ? (
            <Button
              onClick={() => setShowPurchaseModal(true)}
              className="h-8 w-full sm:w-auto bg-blue-600 hover:bg-blue-700 flex items-center justify-center space-x-2 text-sm sm:text-base py-2 sm:py-2"
            >
              <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Purchase Licenses</span>
            </Button>
          ) : (
            <Button
              disabled
              variant="outline"
              className="w-full sm:w-auto flex items-center justify-center space-x-2 text-sm sm:text-base py-2 sm:py-2 bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200"
            >
              <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Contact your admin for upgrades</span>
            </Button>
          )}
        </div>

        {/* Lock Screen Overlay for Expired Trial */}
        {isExpired &&
          (canViewFullDashboard || isIndividual) &&
          showExpiredOverlay &&
          !currentLicenseLoading &&
          currentLicenseData && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-7 max-w-lg w-full text-center shadow-2xl animate-in fade-in duration-300">
                <div className="mb-3">
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <AlertCircle className="w-10 h-10 text-red-600" />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-3">
                    License Expired
                  </h2>
                  <p className="text-gray-600 text-lg">
                    Your {isOnTrial ? "trial" : "subscription"} has ended.
                    {isIndividual
                      ? " Upgrade now to continue using all features."
                      : " Contact your admin or upgrade to continue."}
                  </p>
                </div>

                <div className="space-y-3">
                  {(isPrimaryAdmin || isIndividual) && (
                    <Button
                      className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-3"
                      onClick={() => setShowPurchaseModal(true)}
                    >
                      <Crown className="w-5 h-5 mr-2" />
                      Upgrade to Continue
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => setShowExpiredOverlay(false)}
                    className="text-gray-500 hover:text-gray-700 text-sm w-full h-9 py-2"
                  >
                    Remind me later
                  </Button>
                </div>
              </div>
            </div>
          )}

        {/* Payment Failed UI */}
        {subscriptionData?.payment_status === "failed" && (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-3">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
                <CreditCard className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-900 mb-2">
                  Payment Failed - Read-Only Mode
                </h3>
                <p className="text-red-700 text-sm mb-3">
                  Your last payment failed
                  {subscriptionData.last_payment_attempt
                    ? ` on ${new Date(subscriptionData.last_payment_attempt).toLocaleDateString()}`
                    : ""}
                  . Your account is now in read-only mode with limited
                  functionality.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link to="/admin/billing?action=retry">
                    <Button className="bg-red-600 hover:bg-red-700">
                      <RefreshCcw className="w-4 h-4 mr-2" />
                      Retry Payment
                    </Button>
                  </Link>
                  <Link to="/admin/billing">
                    <Button
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50"
                    >
                      Update Payment Method
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* /* Usage Limit Warnings - Only for Primary Admin */}
        {isPrimaryAdmin &&
          (() => {
            const nearLimitFeatures = [
              { key: "TASK_BASIC", label: "tasks" },
              { key: "FORM_CREATE", label: "forms" },
              { key: "PROC_CREATE", label: "processes" },
              { key: "REPORT_BASIC", label: "reports" },
            ].filter(({ key }) => {
              const status = getUsageStatus(key);
              return (
                !status.isUnlimited &&
                (status.isOverLimit || (status.remaining <= 3 && status.current > 0))
              );
            });

            if (nearLimitFeatures.length === 0) return null;

            return (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 my-3">
                <div className="flex items-center space-x-2 text-orange-800 mb-2 sm:mb-3">
                  <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-sm sm:text-base font-medium">
                    Usage Alert
                  </span>
                </div>
                <div className="text-xs sm:text-sm text-orange-700">
                  <span className="font-medium">
                    You're approaching limits for:{" "}
                    {nearLimitFeatures.map((f) => f.label).join(", ")}
                  </span>
                  <div className="mt-2">
                    <Button
                      variant="primary"
                      className="text-xs sm:text-sm h-9 px-3 py-1.5 sm:py-1 bg-orange-600 hover:bg-orange-700 w-full sm:w-auto"
                      onClick={() => setShowPurchaseModal(true)}
                    >
                      Upgrade Plan
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}

        {/* License Dashboard - Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-3">
          {/* Left Column - Current Plan */}
          <div className={isOrgAdmin ? "lg:col-span-8" : "lg:col-span-12"}>
            {plansLoading ||
            subscriptionLoading ||
            currentLicenseLoading ||
            userProfileLoading ? (
              <div className="flex items-center justify-center min-h-[150px]">
                <div className="flex flex-col items-center gap-3">
                  <Loader className="w-8 h-8 animate-spin text-blue-600" />
                  <p className="text-lg text-gray-600">
                    Loading license data...
                  </p>
                </div>
              </div>
            ) : currentLicenseError ? (
              <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 bg-gradient-to-r from-red-50 to-red-100 border-b border-red-200">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-red-100 rounded-xl">
                      <AlertCircle className="h-7 w-7 text-red-600" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                        Unable to Load License Data
                      </h2>
                      <p className="text-sm text-gray-600 mt-0.5">
                        There was an error fetching your license information
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-3">
                    <p className="text-sm text-red-700">
                      <strong>Error:</strong>{" "}
                      {currentLicenseError?.message ||
                        "Failed to load license data from server"}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={() => window.location.reload()}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Retry Loading
                    </Button>
                    {isPrimaryAdmin && (
                      <Link to="/admin/settings">
                        <Button variant="outline" className="w-full sm:w-auto">
                          <Shield className="h-4 w-4 mr-2" />
                          Check Settings
                        </Button>
                      </Link>
                    )}
                  </div>
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600">
                      <strong>Note:</strong> If this issue persists, please
                      contact support or check your server logs for more
                      details.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-3">
                {/* License Status Alert - Conditional based on license state */}
                {isExpired && (
                  <div className="bg-red-50 border-l-4 border-red-500 rounded-r-lg p-4 flex items-start gap-3">
                    <div className="p-2 bg-red-100 rounded-full">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-red-800">
                        License Expired
                      </h4>
                      <p className="text-sm text-red-700 mt-1">
                        Your {isOnTrial ? "trial" : "subscription"} expired{" "}
                        {Math.abs(daysUntilExpiry)} days ago. Please renew to
                        restore full access to all features.
                      </p>
                      {isPrimaryAdmin || isIndividual ? (
                        <Button
                          size="sm"
                          className="mt-3 bg-red-600 hover:bg-red-700 h-8"
                          onClick={() => setShowPurchaseModal(true)}
                        >
                          Renew Now
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled
                          className="mt-3 border-red-200 text-red-700 hover:bg-red-50 cursor-not-allowed"
                        >
                          Contact Admin to Renew
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {isExpiringSoon && !isExpired && (
                  <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-lg p-4 flex items-start gap-3">
                    <div className="p-2 bg-amber-100 rounded-full">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-amber-800">
                        License Expiring Soon
                      </h4>
                      <p className="text-sm text-amber-700 mt-1">
                        Your {isOnTrial ? "trial" : "subscription"} will expire
                        in <strong>{daysUntilExpiry} days</strong>. Renew now to
                        ensure uninterrupted access.
                      </p>
                      {isPrimaryAdmin || isIndividual ? (
                        <Button
                          size="sm"
                          className="mt-3 bg-amber-600 hover:bg-amber-700 h-8"
                          onClick={() => setShowPurchaseModal(true)}
                        >
                          Renew Now
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled
                          className="mt-3 border-amber-200 text-amber-700 hover:bg-amber-50 cursor-not-allowed h-8"
                        >
                          Contact Admin to Renew
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {isInGracePeriod && (
                  <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-lg p-4 flex items-start gap-3">
                    <div className="p-2 bg-amber-100 rounded-full">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-amber-800">
                        Grace Period Active
                      </h4>
                      <p className="text-sm text-amber-700 mt-1">
                        Your {isOnTrial ? "trial" : "subscription"} expired on{" "}
                        <strong>{getDisplayExpirationDate()}</strong>. You are
                        currently in a grace period for{" "}
                        <strong>
                          {gracePeriodInfo.days_remaining_in_grace} more day(s)
                        </strong>
                        . Renew now to restore full access to all features.
                      </p>
                    </div>
                  </div>
                )}

                {/* Current Plan Card - Hero Section */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Plan Header with Gradient */}
                  <div
                    className={cn(
                      "px-4 py-2 border-b",
                      isExpired
                        ? "bg-gradient-to-r from-red-50 to-red-100 border-red-200"
                        : isOnTrial
                          ? "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200"
                          : "bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200",
                    )}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "p-2 rounded-xl",
                            isExpired
                              ? "bg-red-100"
                              : isOnTrial
                                ? "bg-blue-100"
                                : "bg-emerald-100",
                          )}
                        >
                          <Crown
                            className={cn(
                              "h-5 w-5",
                              isExpired
                                ? "text-red-600"
                                : isOnTrial
                                  ? "text-blue-600"
                                  : "text-emerald-600",
                            )}
                          />
                        </div>
                        <div>
                          <h2 className="text-sm font-bold text-gray-900 leading-tight">
                            {assignedLicense?.license_name ||
                              effectivePlan?.license_name ||
                              currentLicenseType ||
                              "No Plan"}
                          </h2>
                          <p className="text-xs text-gray-600 leading-tight">
                            {currentLicenseType === "EXPLORE" ? "Free Plan" : (isOnTrial ? "Trial Plan" : "Active Subscription")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          className={cn(
                            "h-8 px-2 py-0 text-xs font-medium",
                            isExpired
                              ? "bg-red-100 text-red-700 border border-red-200"
                              : currentLicenseType === "EXPLORE"
                                ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                : isOnTrial
                                  ? "bg-blue-100 text-blue-700 border border-blue-200"
                                  : "bg-emerald-100 text-emerald-700 border border-emerald-200",
                          )}
                        >
                          {isExpired
                            ? "⚠️ Expired"
                            : isInGracePeriod
                              ? "⏳ Grace Period"
                              : currentLicenseType === "EXPLORE"
                                ? "🟢 Free"
                                : isOnTrial
                                  ? "🔵 Trial"
                                  : "🟢 Active"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Plan Details Grid */}
                  <div
                    className={cn(
                      "p-4",
                      Object.keys(userFeatures || {}).length === 0 && "pb-3",
                    )}
                  >
                    {/* ⚠️ Date Mismatch Warning Banner */}
                    {expiryInfo?.mismatch && (
                      <div className="mb-3 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-amber-900">
                            Expiry Date Mismatch Detected
                          </h4>
                          <p className="text-xs text-amber-700 mt-1">
                            {expiryInfo.message}
                          </p>
                          <p className="text-xs text-amber-600 mt-1">
                            This is a <strong>backend issue</strong> - the trial
                            expiry was calculated incorrectly when the license
                            was assigned.
                          </p>
                        </div>
                      </div>
                    )}

                    <div
                      className={cn(
                        "grid grid-cols-2 sm:grid-cols-4 gap-3",
                        Object.keys(userFeatures || {}).length > 0
                          ? "mb-3"
                          : "mb-0",
                      )}
                    >
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">
                          License Code
                        </p>
                        <p className="text-sm font-semibold text-gray-900 mt-1">
                          {assignedLicense?.license_code ||
                            activeLicenseCode ||
                            "N/A"}
                        </p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">
                          Billing Cycle
                        </p>
                        <p className="text-sm font-semibold text-gray-900 mt-1">
                          {assignedLicense?.billing_cycle ||
                            billingCycle?.toUpperCase() ||
                            "N/A"}
                        </p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">
                          {isExpired ? "Expired On" : "Valid Until"}
                        </p>
                        <p
                          className={cn(
                            "text-sm font-semibold mt-1",
                            isExpired ? "text-red-600" : "text-gray-900",
                          )}
                        >
                          {getDisplayExpirationDate()}
                        </p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">
                          {isExpired
                            ? "Status"
                            : isInGracePeriod
                              ? "Grace Period"
                              : daysUntilExpiry < 0
                                ? "Status"
                                : "Days Remaining"}
                        </p>
                        <p
                          className={cn(
                            "text-sm font-semibold mt-1",
                            isExpired ||
                              (!isInGracePeriod && daysUntilExpiry < 0)
                              ? "text-red-600"
                              : isInGracePeriod || daysUntilExpiry <= 5
                                ? "text-amber-600"
                                : "text-emerald-600",
                          )}
                        >
                          {isExpired ||
                          (!isInGracePeriod && daysUntilExpiry < 0)
                            ? `${Math.abs(daysUntilExpiry)} days overdue`
                            : isInGracePeriod
                              ? `${gracePeriodInfo.days_remaining_in_grace} days left`
                              : `${daysUntilExpiry} days`}
                        </p>
                      </div>
                    </div>

                    {/* Feature Access Badges */}
                    {Object.keys(userFeatures).length > 0 && (
                      <div className="mb-3">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <Zap className="h-4 w-4 text-blue-600" />
                          Feature Access
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(userFeatures).map(
                            ([feature, hasAccess]) => (
                              <div
                                key={feature}
                                className={cn(
                                  "text-xs px-3 py-1.5 rounded-full font-medium flex items-center gap-1",
                                  hasAccess
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-gray-100 text-gray-500 border border-gray-200",
                                )}
                              >
                                {hasAccess ? (
                                  <CheckSquare className="h-3 w-3" />
                                ) : (
                                  <X className="h-3 w-3" />
                                )}
                                {feature.replace(/_/g, " ")}
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Quick Stats (Only for Org Admin) */}
          {isOrgAdmin && (
            <div className="lg:col-span-4 space-y-3">
              {plansLoading ||
              subscriptionLoading ||
              currentLicenseLoading ||
              userProfileLoading ? (
                <div className="space-y-3 animate-pulse">
                  {/* Skeleton Card 1 - Days Remaining */}
                  <div className="bg-gray-50 rounded-xl p-5 border-2 border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="h-4 bg-gray-300 rounded w-20"></div>
                      <div className="h-5 w-5 bg-gray-300 rounded"></div>
                    </div>
                    <div className="h-8 bg-gray-300 rounded w-24 mb-1"></div>
                    <div className="h-4 bg-gray-200 rounded w-32"></div>
                  </div>

                  {/* Skeleton Card 2 - Current Plan */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="h-4 bg-gray-200 rounded w-24"></div>
                      <div className="h-5 w-5 bg-gray-300 rounded"></div>
                    </div>
                    <div className="h-6 bg-gray-300 rounded w-32 mb-2"></div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-5 bg-gray-300 rounded w-16"></div>
                      <div className="h-4 bg-gray-200 rounded w-12"></div>
                    </div>
                    <div className="pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="h-4 bg-gray-200 rounded w-16"></div>
                        <div className="h-4 bg-gray-300 rounded w-12"></div>
                      </div>
                    </div>
                  </div>

                  {/* Skeleton Card 3 - Subscription Started */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="h-4 bg-gray-200 rounded w-28"></div>
                      <div className="h-5 w-5 bg-gray-300 rounded"></div>
                    </div>
                    <div className="h-5 bg-gray-300 rounded w-24"></div>
                  </div>

                  {/* Skeleton Card 4 - Plan Limits */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="h-4 bg-gray-300 rounded w-20"></div>
                      <div className="h-5 w-5 bg-gray-300 rounded"></div>
                    </div>
                    <div className="space-y-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <div className="h-4 w-4 bg-gray-200 rounded"></div>
                            <div className="h-4 bg-gray-200 rounded w-16"></div>
                          </div>
                          <div className="h-4 bg-gray-300 rounded w-12"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <React.Fragment>
                  {/* License Status Card */}
                  <div
                    className={cn(
                      "rounded-xl p-5 border-2",
                      isExpired
                        ? "bg-red-50 border-red-300"
                        : isExpiringSoon
                          ? "bg-amber-50 border-amber-300"
                          : "bg-emerald-50 border-emerald-300",
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={cn(
                          "text-sm font-semibold",
                          isExpired
                            ? "text-red-700"
                            : isExpiringSoon
                              ? "text-amber-700"
                              : "text-emerald-700",
                        )}
                      >
                        {isExpired
                          ? "⚠️ Expired"
                          : isInGracePeriod
                            ? "⏳ Grace Period"
                            : isExpiringSoon
                              ? "⏰ Expiring Soon"
                              : "✓ Active"}
                      </span>
                      <Clock
                        className={cn(
                          "h-5 w-5",
                          isExpired
                            ? "text-red-600"
                            : isInGracePeriod || isExpiringSoon
                              ? "text-amber-600"
                              : "text-emerald-600",
                        )}
                      />
                    </div>
                    <div className="text-2xl font-bold text-gray-900 mb-1">
                      {isInGracePeriod
                        ? gracePeriodInfo.days_remaining_in_grace
                        : Math.abs(daysUntilExpiry)}{" "}
                      {(isInGracePeriod
                        ? gracePeriodInfo.days_remaining_in_grace
                        : Math.abs(daysUntilExpiry)) === 1
                        ? "Day"
                        : "Days"}
                    </div>
                    <p
                      className={cn(
                        "text-sm",
                        isExpired
                          ? "text-red-600"
                          : isInGracePeriod
                            ? "text-amber-600"
                            : "text-gray-600",
                      )}
                    >
                      {isExpired
                        ? "Since expiration"
                        : isInGracePeriod
                          ? "Left in grace period"
                          : "Until renewal"}
                    </p>
                    {isExpired || isExpiringSoon || isInGracePeriod ? (
                      <div className="mt-4">
                        {isPrimaryAdmin || isIndividual ? (
                          <Button
                            size="sm"
                            className={cn(
                              "w-full",
                              isExpired
                                ? "bg-red-600 hover:bg-red-700"
                                : "bg-amber-600 hover:bg-amber-700",
                            )}
                            onClick={() => setShowPurchaseModal(true)}
                          >
                            {isExpired ? "Renew Now" : "Renew Early"}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            disabled
                            className={cn(
                              "w-full cursor-not-allowed",
                              isExpired
                                ? "bg-red-100 text-red-700 border border-red-200"
                                : "bg-amber-100 text-amber-700 border border-amber-200",
                            )}
                          >
                            Contact Admin
                          </Button>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {/* Current Plan Summary */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-500">
                        Current Plan
                      </span>
                      <Crown className="h-5 w-5 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                      {effectivePlan?.license_name ||
                        currentLicenseType ||
                        "No Plan"}
                    </h3>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg font-semibold text-blue-600">
                        ₹{effectivePlan?.price_monthly || 0}
                      </span>
                      <span className="text-sm text-gray-500">
                        /{billingCycle === "yearly" ? "year" : "month"}
                      </span>
                    </div>
                    {licenseInfo?.totalLicenses && (
                      <div className="pt-3 border-t border-gray-100">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Seats Used</span>
                          <span className="font-semibold text-gray-900">
                            {licenseInfo.usedLicenses || 0} /{" "}
                            {licenseInfo.totalLicenses}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Subscription Info */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-500">
                        {currentLicenseType === "EXPLORE" ? "Plan Activated" : (isOnTrial ? "Trial Started" : "Subscription Started")}
                      </span>
                      <RefreshCcw className="h-5 w-5 text-blue-600" />
                    </div>
                    <p className="text-lg font-semibold text-gray-900">
                      {(() => {
                        // 🔍 DEBUG: Log all available data sources
                        console.log(
                          "════════ SUBSCRIPTION START DATE DEBUG ════════",
                        );
                        console.log("📊 licenseInfo:", licenseInfo);
                        console.log("📊 subscriptionData:", subscriptionData);
                        console.log(
                          "📊 subscriptionData.license_details:",
                          subscriptionData?.license_details,
                        );
                        console.log(
                          "📊 currentLicenseData:",
                          currentLicenseData,
                        );
                        console.log(
                          "📊 currentLicenseData.licenseDetails:",
                          currentLicenseData?.licenseDetails,
                        );
                        console.log("📊 assignedLicense:", assignedLicense);
                        console.log(
                          "════════════════════════════════════════════════",
                        );

                        // Priority 1: licenseInfo.subscriptionStartDate
                        console.log(
                          "✅ Check 1: licenseInfo?.subscriptionStartDate =",
                          licenseInfo?.subscriptionStartDate,
                        );
                        if (licenseInfo?.subscriptionStartDate) {
                          console.log(
                            "✓ FOUND: Using licenseInfo.subscriptionStartDate",
                          );
                          return new Date(
                            licenseInfo.subscriptionStartDate,
                          ).toLocaleDateString();
                        }

                        // Priority 2: subscriptionData dates (direct)
                        console.log(
                          "✅ Check 2: subscriptionData?.subscription_start_date =",
                          subscriptionData?.subscription_start_date,
                        );
                        if (subscriptionData?.subscription_start_date) {
                          console.log(
                            "✓ FOUND: Using subscriptionData.subscription_start_date",
                          );
                          return new Date(
                            subscriptionData.subscription_start_date,
                          ).toLocaleDateString();
                        }

                        console.log(
                          "✅ Check 3: subscriptionData?.trial_start_date =",
                          subscriptionData?.trial_start_date,
                        );
                        if (subscriptionData?.trial_start_date) {
                          console.log(
                            "✓ FOUND: Using subscriptionData.trial_start_date",
                          );
                          return new Date(
                            subscriptionData.trial_start_date,
                          ).toLocaleDateString();
                        }

                        // Priority 2.5: subscriptionData.license_details nested dates
                        console.log(
                          "✅ Check 3.1: subscriptionData?.license_details?.created_at =",
                          subscriptionData?.license_details?.created_at,
                        );
                        if (subscriptionData?.license_details?.created_at) {
                          console.log(
                            "✓ FOUND: Using subscriptionData.license_details.created_at",
                          );
                          return new Date(
                            subscriptionData.license_details.created_at,
                          ).toLocaleDateString();
                        }

                        console.log(
                          "✅ Check 3.2: subscriptionData?.license_details?.createdAt =",
                          subscriptionData?.license_details?.createdAt,
                        );
                        if (subscriptionData?.license_details?.createdAt) {
                          console.log(
                            "✓ FOUND: Using subscriptionData.license_details.createdAt",
                          );
                          return new Date(
                            subscriptionData.license_details.createdAt,
                          ).toLocaleDateString();
                        }

                        console.log(
                          "✅ Check 3.3: subscriptionData?.license_details?.subscription_start_date =",
                          subscriptionData?.license_details
                            ?.subscription_start_date,
                        );
                        if (
                          subscriptionData?.license_details
                            ?.subscription_start_date
                        ) {
                          console.log(
                            "✓ FOUND: Using subscriptionData.license_details.subscription_start_date",
                          );
                          return new Date(
                            subscriptionData.license_details
                              .subscription_start_date,
                          ).toLocaleDateString();
                        }

                        // Priority 3: currentLicenseData dates
                        console.log(
                          "✅ Check 4: currentLicenseData?.licenseDetails?.created_at =",
                          currentLicenseData?.licenseDetails?.created_at,
                        );
                        if (currentLicenseData?.licenseDetails?.created_at) {
                          console.log(
                            "✓ FOUND: Using currentLicenseData.licenseDetails.created_at",
                          );
                          return new Date(
                            currentLicenseData.licenseDetails.created_at,
                          ).toLocaleDateString();
                        }

                        console.log(
                          "✅ Check 5: currentLicenseData?.createdAt =",
                          currentLicenseData?.createdAt,
                        );
                        if (currentLicenseData?.createdAt) {
                          console.log(
                            "✓ FOUND: Using currentLicenseData.createdAt",
                          );
                          return new Date(
                            currentLicenseData.createdAt,
                          ).toLocaleDateString();
                        }

                        console.log(
                          "✅ Check 6: currentLicenseData?.created_at =",
                          currentLicenseData?.created_at,
                        );
                        if (currentLicenseData?.created_at) {
                          console.log(
                            "✓ FOUND: Using currentLicenseData.created_at",
                          );
                          return new Date(
                            currentLicenseData.created_at,
                          ).toLocaleDateString();
                        }

                        // Priority 4: assignedLicense dates
                        console.log(
                          "✅ Check 7: assignedLicense?.created_at =",
                          assignedLicense?.created_at,
                        );
                        if (assignedLicense?.created_at) {
                          console.log(
                            "✓ FOUND: Using assignedLicense.created_at",
                          );
                          return new Date(
                            assignedLicense.created_at,
                          ).toLocaleDateString();
                        }

                        console.log(
                          "✅ Check 8: assignedLicense?.createdAt =",
                          assignedLicense?.createdAt,
                        );
                        if (assignedLicense?.createdAt) {
                          console.log(
                            "✓ FOUND: Using assignedLicense.createdAt",
                          );
                          return new Date(
                            assignedLicense.createdAt,
                          ).toLocaleDateString();
                        }

                        console.log(
                          "✅ Check 9: assignedLicense?.license_start_date =",
                          assignedLicense?.license_start_date,
                        );
                        if (assignedLicense?.license_start_date) {
                          console.log(
                            "✓ FOUND: Using assignedLicense.license_start_date",
                          );
                          return new Date(
                            assignedLicense.license_start_date,
                          ).toLocaleDateString();
                        }

                        // Priority 5: subscriptionData created_at
                        console.log(
                          "✅ Check 10: subscriptionData?.created_at =",
                          subscriptionData?.created_at,
                        );
                        if (subscriptionData?.created_at) {
                          console.log(
                            "✓ FOUND: Using subscriptionData.created_at",
                          );
                          return new Date(
                            subscriptionData.created_at,
                          ).toLocaleDateString();
                        }

                        console.log(
                          "✅ Check 11: subscriptionData?.createdAt =",
                          subscriptionData?.createdAt,
                        );
                        if (subscriptionData?.createdAt) {
                          console.log(
                            "✓ FOUND: Using subscriptionData.createdAt",
                          );
                          return new Date(
                            subscriptionData.createdAt,
                          ).toLocaleDateString();
                        }

                        console.log("❌ NO DATE FOUND - Returning N/A");
                        console.log(
                          "════════════════════════════════════════════════\n",
                        );
                        return "N/A";
                      })()}
                    </p>
                    {!isOnTrial &&
                      !isExpired &&
                      getDisplayExpirationDate() !== "Never" && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Next Renewal</span>
                            <span className="font-medium text-gray-900">
                              {getDisplayExpirationDate()}
                            </span>
                          </div>
                        </div>
                      )}
                  </div>

                  {/* Quick Limits Overview */}
                  {/* <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-gray-900">
                        Plan Limits
                      </span>
                      <Info className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="space-y-3">
                      {[
                        { key: "TASK_BASIC", label: "Tasks", icon: "📋" },
                        { key: "FORM_CREATE", label: "Forms", icon: "📝" },
                        { key: "PROC_CREATE", label: "Processes", icon: "⚙️" },
                        { key: "REPORT_BASIC", label: "Reports", icon: "📊" },
                      ].map(({ key, label, icon }) => {
                        const status = getUsageStatus(key);
                        return (
                          <div
                            key={key}
                            className="flex items-center justify-between"
                          >
                            <span className="text-sm text-gray-600 flex items-center gap-2">
                              <span>{icon}</span>
                              {label}
                            </span>
                            <span
                              className={cn(
                                "text-sm font-semibold",
                                status.isUnlimited || status.limit === -1
                                  ? "text-emerald-600"
                                  : status.remaining <= 0
                                    ? "text-red-600"
                                    : status.remaining <= 5
                                      ? "text-amber-600"
                                      : "text-gray-900",
                              )}
                            >
                              {status.current}/
                              {status.isUnlimited || status.limit === -1
                                ? "∞"
                                : status.limit}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div> */}
                </React.Fragment>
              )}
            </div>
          )}

          {/* Usage Overview Card - Full Width (Complete Page) */}
          <div className="lg:col-span-12">
            {plansLoading ||
            subscriptionLoading ||
            currentLicenseLoading ||
            userProfileLoading ? null : currentLicenseError ? (
              null
            ) : (
              <div className="space-y-3 sm:space-y-3">
                {/* Usage Overview Card */}
                <div className="bg-white rounded-sm border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-blue-600" />
                        Usage Overview
                      </h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        Monitor your current resource usage across all features
                      </p>
                    </div>
                    {/* Usage Summary Badge */}
                    {(() => {
                      const allStatuses = usageStats.map((u) => u.status);
                      const hasOverLimit = allStatuses.some(
                        (s) => s.isOverLimit,
                      );
                      const hasNearLimit = allStatuses.some(
                        (s) => s.isNearLimit && !s.isOverLimit,
                      );

                      return (
                        <Badge
                          className={cn(
                            "px-2.5 py-1 text-xs",
                            hasOverLimit
                              ? "bg-red-100 text-red-700"
                              : hasNearLimit
                                ? "bg-amber-100 text-amber-700"
                                : "bg-emerald-100 text-emerald-700",
                          )}
                        >
                          {hasOverLimit
                            ? "⚠️ Over Limit"
                            : hasNearLimit
                              ? "⚡ Near Limit"
                              : "✓ Good"}
                        </Badge>
                      );
                    })()}
                  </div>

                  <div className="p-4 sm:p-4 bg-gray-50/30">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {usageStats.map(
                        ({ key, label, icon: Icon, description, status }) => (
                          <div
                            key={key}
                            className={cn(
                              "p-2 rounded-lg border-2 transition-all group hover:shadow-md h-full",
                              status.isOverLimit
                                ? "bg-red-50 border-red-200"
                                : status.isNearLimit
                                  ? "bg-amber-50 border-amber-200"
                                  : "bg-white border-gray-100",
                            )}
                            data-testid={`usage-meter-${key}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className={cn(
                                    "p-1.5 rounded-lg shrink-0",
                                    status.isOverLimit
                                      ? "bg-red-100"
                                      : status.isNearLimit
                                        ? "bg-amber-100"
                                        : "bg-blue-50",
                                  )}
                                >
                                  <Icon
                                    className={cn(
                                      "h-3.5 w-3.5",
                                      status.isOverLimit
                                        ? "text-red-600"
                                        : status.isNearLimit
                                          ? "text-amber-600"
                                          : "text-blue-600",
                                    )}
                                  />
                                </div>
                                <div className="min-w-0">
                                  <h4
                                    className="font-bold text-xs text-gray-900 truncate"
                                    title={label}
                                  >
                                    {label}
                                  </h4>
                                  <p
                                    className="text-[10px] text-gray-500 truncate"
                                    title={description}
                                  >
                                    {description}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right shrink-0 ml-1">
                                <span
                                  className={cn(
                                    "text-xs font-bold",
                                    status.isOverLimit
                                      ? "text-red-600"
                                      : status.isNearLimit
                                        ? "text-amber-600"
                                        : "text-gray-900",
                                  )}
                                >
                                  {status.current}
                                  <span className="text-[10px] font-normal text-gray-400">
                                    /{status.isUnlimited ? "∞" : status.limit}
                                  </span>
                                </span>
                              </div>
                            </div>

                            {/* Compact Progress Bar */}
                            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1.5">
                              <div
                                className={cn(
                                  "h-1.5 rounded-full transition-all duration-500",
                                  status.isOverLimit
                                    ? "bg-red-500"
                                    : status.isNearLimit
                                      ? "bg-amber-500"
                                      : "bg-emerald-500",
                                )}
                                style={{ width: `${status.percentage}%` }}
                              />
                            </div>

                            <div className="flex justify-between items-center text-[10px]">
                              <span
                                className={cn(
                                  "font-medium",
                                  status.percentage > 90
                                    ? "text-red-500"
                                    : "text-gray-400",
                                )}
                              >
                                {Math.round(status.percentage)}% used
                              </span>
                              <span
                                className={cn(
                                  "font-semibold",
                                  status.isUnlimited
                                    ? "text-emerald-600"
                                    : status.remaining <= 0
                                      ? "text-red-500"
                                      : status.remaining <= 5
                                        ? "text-amber-600"
                                        : "text-gray-500",
                                )}
                              >
                                {status.isUnlimited
                                  ? "Unlimited"
                                  : status.remaining <= 0
                                    ? "Full"
                                    : `${status.remaining} left`}
                              </span>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                </div>

                {/* Upgrade CTA for Non-Admin Users */}
                {!isPrimaryAdmin && !isIndividual && (
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-4 text-white">
                    <div className="flex items-start gap-3">
                      <div className="p-3 bg-white/20 rounded-xl">
                        <Shield className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-2">
                          Need More Resources?
                        </h3>
                        <p className="text-blue-100 text-sm mb-3">
                          Contact your organization administrator to request a
                          plan upgrade or additional features.
                        </p>
                        <div className="flex items-center gap-2 text-sm font-medium bg-white/10 rounded-lg px-3 py-2 w-fit">
                          <Building2 className="h-4 w-4" />
                          <span>Contact your admin for upgrades</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Upgrade CTA for Individual Users - They can upgrade themselves */}
                {isIndividual &&
                  activeLicenseCode?.toUpperCase() !== "OPTIMIZE" && (
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-4 text-white">
                      <div className="flex items-start gap-3">
                        <div className="p-3 bg-white/20 rounded-xl">
                          <Crown className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold mb-2">
                            Unlock More Features
                          </h3>
                          <p className="text-blue-100 text-sm mb-3">
                            Upgrade to access premium features and increase your
                            resource limits.
                          </p>
                          <Button
                            className="bg-white text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                            onClick={() => setShowPurchaseModal(true)}
                          >
                            <TrendingUp className="h-4 w-4" />
                            <span>Upgrade Your Plan</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            )}
          </div>

          {/* ✅ NEW: License Pool Section for Secondary Org Admin */}
          {isSecondaryOrgAdmin && (
            <div className="lg:col-span-12 bg-white rounded-lg border border-gray-200 shadow-sm mt-6">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Award className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        Organization License Pool
                      </h2>
                      <p className="text-sm text-gray-600 mt-0.5">
                        View available licenses in your organization
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      refetchPool();
                      refetchOrgUsers();
                    }}
                    disabled={isPoolLoading}
                    className="flex items-center gap-2"
                  >
                    <RefreshCcw
                      className={cn("h-4 w-4", isPoolLoading && "animate-spin")}
                    />
                    Refresh
                  </Button>
                </div>
              </div>

              <div className="p-4 sm:p-4">
                {isPoolLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCcw className="h-6 w-6 animate-spin text-gray-400" />
                    <span className="ml-2 text-gray-500">
                      Loading license pool...
                    </span>
                  </div>
                ) : licensePool.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Shield className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>No license data available</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {licensePool.map((license) => {
                      const usagePercent =
                        license.total > 0
                          ? (license.used / license.total) * 100
                          : 0;
                      const tierStyles = {
                        EXPLORE: {
                          bg: "bg-gray-50",
                          border: "border-gray-200",
                          text: "text-gray-700",
                        },
                        PLAN: {
                          bg: "bg-blue-50",
                          border: "border-blue-200",
                          text: "text-blue-700",
                        },
                        EXECUTE: {
                          bg: "bg-purple-50",
                          border: "border-purple-200",
                          text: "text-purple-700",
                        },
                        OPTIMIZE: {
                          bg: "bg-amber-50",
                          border: "border-amber-200",
                          text: "text-amber-700",
                        },
                      };
                      const style =
                        tierStyles[license.license_code] || tierStyles.EXPLORE;

                      return (
                        <div
                          key={license.license_code}
                          className={cn(
                            "flex flex-col p-4 rounded-lg border-2 transition-all",
                            style.bg,
                            style.border,
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className={cn("font-semibold", style.text)}>
                              {license.license_name || license.license_code}
                            </div>
                            <Badge
                              variant="outline"
                              className={cn("text-xs", style.text)}
                            >
                              {license.available} available
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-600 mb-2">
                            {license.used} used / {license.total} total
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className={cn(
                                "h-1.5 rounded-full transition-all",
                                usagePercent >= 90
                                  ? "bg-red-500"
                                  : usagePercent >= 70
                                    ? "bg-yellow-500"
                                    : "bg-green-500",
                              )}
                              style={{
                                width: `${Math.min(usagePercent, 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* User Licenses Overview */}
                {!isOrgUsersLoading && orgUsers.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-900">
                        Team License Assignments ({orgUsers.length} users)
                      </h3>
                      <Link href="/admin/users">
                        <Button variant="outline" size="sm" className="text-xs">
                          <Users className="h-3 w-3 mr-1" />
                          Manage Users
                        </Button>
                      </Link>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {PLAN_ORDER.map((tierLower) => {
                        const tier = tierLower.toUpperCase();
                        const count = orgUsers.filter(
                          (u) =>
                            (u.license_code ||
                              u.licenseInfo?.license_code ||
                              "EXPLORE") === tier,
                        ).length;
                        return (
                          <div
                            key={tier}
                            className="text-center p-3 bg-gray-50 rounded-lg"
                          >
                            <div className="text-2xl font-bold text-gray-900">
                              {count}
                            </div>
                            <div className="text-xs text-gray-600">{tier}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Note for Secondary Admin */}
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-blue-900 mb-1">
                        License Management
                      </h4>
                      <p className="text-xs text-blue-800">
                        As a secondary admin, you can assign and unassign
                        licenses to team members (except the Primary Admin). Go
                        to{" "}
                        <Link
                          href="/admin/users"
                          className="underline font-medium"
                        >
                          User Management
                        </Link>{" "}
                        to manage license assignments.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {isOrgAdmin && (
          <>
            {/* Added: Plan Selection + Order Summary (top) */}
            <div className="grid grid-cols-1 mt-3">
              {/* Plan Selection - Left 8 columns */}

              <div className="bg-white rounded-lg border border-gray-200">
                {/* Header */}
                <div className="p-3 sm:p-4 border-b border-gray-200">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                    <div>
                      <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                        Choose Your Plan
                      </h2>
                      <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">
                        Select the plan that best fits your needs
                      </p>
                    </div>
                    <div className="flex items-center space-x-1 sm:space-x-2 bg-gray-100 rounded-lg p-1 w-full sm:w-auto">
                      <Button
                        variant="ghost"
                        onClick={() => setBillingCycle("monthly")}
                        className={cn(
                          "flex-1 sm:flex-none h-9 px-3 py-1.5 sm:py-1 text-xs sm:text-sm rounded-md transition-colors",
                          billingCycle === "monthly"
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-600 hover:text-gray-900",
                        )}
                      >
                        Monthly
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setBillingCycle("yearly")}
                        className={cn(
                          "flex-1 sm:flex-none h-9 px-3 py-1.5 sm:py-1 text-xs sm:text-sm rounded-md transition-colors",
                          billingCycle === "yearly"
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-600 hover:text-gray-900",
                        )}
                      >
                        Yearly
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Plan Cards */}
                <div className="p-3 sm:p-4">
                  {/* Ensure cards stretch to equal height */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3 items-stretch">
                    {getOrderedPlanEntries(plans)
                      .filter(([planKey]) => planKey !== "expired") // Exclude expired plan
                      .map(([planKey, plan]) => {
                        const isCurrent =
                          plan.is_current ||
                          currentPlan?.license_code?.toLowerCase() === planKey;

                        return (
                          <div
                            key={planKey}
                            className={cn(
                              // Make each card a full-height flex column
                              "border rounded-lg p-4 sm:p-4 transition-all relative h-full flex flex-col",
                              isCurrent && "bg-blue-50 border-blue-300",
                              !isCurrent &&
                                "border-gray-200 hover:shadow-md hover:border-gray-300",
                            )}
                          >
                            {plan.popular && (
                              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                                <Badge className="bg-purple-100 text-purple-700 text-xs px-3 py-1">
                                  <Star className="h-3 w-3 mr-1" />
                                  Most Popular
                                </Badge>
                              </div>
                            )}

                            {isCurrent && (
                              <div className="absolute -top-3 right-4">
                                <Badge className="bg-blue-600 text-white text-xs px-3 py-1">
                                  <Crown className="h-3 w-3 mr-1" />
                                  Current Plan
                                </Badge>
                              </div>
                            )}

                            <div className="text-center mb-2 sm:mb-2">
                              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
                                {plan.name}
                              </h3>
                              <p className="text-xs sm:text-sm text-gray-600">
                                {plan.description}
                              </p>
                            </div>

                            <div className="text-center mb-3 sm:mb-3">
                              <div className="text-2xl sm:text-3xl font-bold text-gray-900">
                                ₹{plan.price[billingCycle]}
                              </div>
                              <div className="text-xs sm:text-sm text-gray-600">
                                per{" "}
                                {billingCycle === "yearly" ? "year" : "month"}
                              </div>
                              {billingCycle === "yearly" &&
                                plan.price.monthly > 0 && (
                                  <div className="text-sm text-green-600 font-medium">
                                    Save ₹
                                    {plan.price.monthly * 12 -
                                      plan.price.yearly}
                                    /year
                                  </div>
                                )}
                            </div>

                            {/* Features List */}
                            {plan.features && plan.features.length > 0 && (
                              <div className="flex-grow">
                                <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                                  {plan.features
                                    .slice(0, 5)
                                    .map((feature, idx) => (
                                      <li
                                        key={idx}
                                        className="flex items-start"
                                      >
                                        <Check className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 mr-1.5 sm:mr-2 flex-shrink-0 mt-0.5" />
                                        <span className="text-gray-700">
                                          {feature}
                                        </span>
                                      </li>
                                    ))}
                                  {plan.features.length > 5 && (
                                    <li className="text-gray-500 text-xs">
                                      +{plan.features.length - 5} more features
                                    </li>
                                  )}
                                </ul>
                              </div>
                            )}

                            {/* Current Plan indicator at bottom */}
                            {isCurrent && (
                              <div className="mt-auto pt-4">
                                <div className="w-full py-1.5 sm:py-2 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-medium bg-blue-100 text-blue-700 text-center">
                                  ✓ Active Plan
                                </div>
                              </div>
                            )}

                            {!isCurrent && plan.price?.monthly > 0 && (
                              <div className="mt-auto pt-4">
                                {isPrimaryAdmin || isIndividual ? (
                                  <Button
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                    onClick={() => handleUpgrade(planKey)}
                                  >
                                    Upgrade
                                  </Button>
                                ) : (
                                  <Button
                                    className="w-full bg-gray-100 text-gray-600 cursor-not-allowed"
                                    disabled
                                  >
                                    Contact Admin
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>

            {/* Collapsible comparison table → expands to show detailed feature breakdown.
             */}
            {/* <ComparisonTable
              plans={plans}
              currentPlanCode={currentPlan?.license_code}
            /> */}

            {/* License Differences Section - Detailed feature comparison */}
            <LicenseDifferencesSection
              plans={plans}
              currentPlanCode={currentPlan?.license_code}
              featuresData={featuresData}
              onUpgrade={
                isPrimaryAdmin || isIndividual
                  ? () => setShowPurchaseModal(true)
                  : null
              }
            />
          </>
        )}
      </div>

      {/* Purchase Plan Modal */}
      <PurchasePlanModal
        isOpen={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        isIndividual={!isOrgAdmin && !isEmployeeOrManager}
      />
    </div>
  );
}
