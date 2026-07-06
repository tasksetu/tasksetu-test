import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  Crown,
  Check,
  AlertTriangle,
  CreditCard,
  Shield,
  Zap,
  Users,
  Database,
  FolderOpen,
  CheckSquare,
  Star,
  Gift,
  Loader2,
} from "lucide-react";
import { PLAN_ORDER, getOrderedPlanEntries } from "@/utils/licenseConstants";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

/**
 * Purchase/Upgrade Page - Upgrade plan with payment integration
 * Connected to actual backend APIs
 */
export default function PurchaseUpgradePage() {
  const [location, setLocation] = useLocation();
  const [selectedPlan, setSelectedPlan] = useState("execute");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPlanLimitDialog, setShowPlanLimitDialog] = useState(false);
  const [showComparisonDialog, setShowComparisonDialog] = useState(false);
  const [pendingPlan, setPendingPlan] = useState(null);
  const [downgradeIssues, setDowngradeIssues] = useState([]);
  const { toast } = useToast();

  // Fetch all available licenses from API
  const { data: licensesData, isLoading: licensesLoading } = useQuery({
    queryKey: ["licenses"],
    queryFn: async () => {
      const response = await fetch("/api/license/licenses");
      if (!response.ok) throw new Error("Failed to fetch licenses");
      const data = await response.json();
      return data.licenses || [];
    },
  });

  // Fetch current subscription from API
  const { data: subscriptionData, isLoading: subscriptionLoading } = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const response = await fetch("/api/license/organization/subscription", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch subscription");
      const data = await response.json();
      return data.subscription;
    },
  });

  // Upgrade mutation
  const upgradeMutation = useMutation({
    mutationFn: async ({ licenseCode, billingCycle: cycle }) => {
      const response = await fetch(
        "/api/license/organization/subscription/upgrade",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            license_code: licenseCode,
            billing_cycle: cycle?.toUpperCase(),
          }),
        },
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to upgrade");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Upgrade Successful!",
        description: `You've been upgraded to ${plans[selectedPlan]?.name}`,
      });
      setLocation(`/admin/upgrade-success?plan=${plans[selectedPlan]?.name}`);
    },
    onError: (error) => {
      toast({
        title: "Upgrade Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsProcessing(false);
    },
  });

  // Validate downgrade mutation
  const validateDowngradeMutation = useMutation({
    mutationFn: async ({ targetLicenseCode }) => {
      const response = await fetch(
        "/api/license/organization/subscription/validate-downgrade",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            target_license_code: targetLicenseCode,
          }),
        },
      );
      if (!response.ok) throw new Error("Failed to validate");
      return response.json();
    },
  });

  // Handle URL parameters for plan pre-selection
  useEffect(() => {
    if (!licensesData) return;
    const urlParams = new URLSearchParams(window.location.search);
    const actionParam = urlParams.get("action");
    const planParam = urlParams.get("plan");

    if (actionParam === "renew") {
      setSelectedPlan("optimize");
    } else if (planParam) {
      const planExists = licensesData.some(l => l.license_code.toLowerCase() === planParam.toLowerCase());
      if (planExists) {
        setSelectedPlan(planParam.toLowerCase());
      }
    }
  }, [location, licensesData]);

  // Transform API licenses to plans format
  const plans = {};
  if (licensesData) {
    licensesData
      .filter(
        (l) => l.license_code !== "EXPLORE" && l.license_code !== "EXPIRED",
      )
      .forEach((license) => {
        const key = license.license_code.toLowerCase();
        plans[key] = {
          name: license.name,
          license_code: license.license_code,
          description: license.description,
          price: {
            monthly: license.price_monthly,
            yearly: license.price_yearly,
          },
          features: license.features_summary || [],
          popular: license.is_popular,
        };
      });
  }

  // Current plan from subscription
  const currentPlan = {
    name: subscriptionData?.license_details?.name || "Explore",
    key: subscriptionData?.license_code?.toLowerCase() || "explore",
    price: {
      monthly: subscriptionData?.license_details?.price_monthly || 0,
      yearly: subscriptionData?.license_details?.price_yearly || 0,
    },
    expiryDate: subscriptionData?.days_remaining
      ? new Date(
          Date.now() + subscriptionData.days_remaining * 24 * 60 * 60 * 1000,
        ).toLocaleDateString()
      : "N/A",
    isOnTrial: subscriptionData?.status === "TRIAL",
    daysLeft: subscriptionData?.days_remaining || 0,
  };

  // Usage limits for comparison (from API or defaults)
  const currentUsage = {
    tasksPerMonth: 0, // Would come from features API
    customForms: 0,
    processes: 0,
    reports: 0,
  };
  const planLimits = {
    plan: {
      tasksPerMonth: 100,
      customForms: 10,
      processes: 5,
      reports: Infinity,
    },
    execute: {
      tasksPerMonth: Infinity,
      customForms: Infinity,
      processes: Infinity,
      reports: Infinity,
    },
    optimize: {
      tasksPerMonth: Infinity,
      customForms: Infinity,
      processes: Infinity,
      reports: Infinity,
    },
  };
  const formatLimit = (val) =>
    val === Infinity ? "Unlimited" : val.toLocaleString();
  const isOver = (usage, limit) => limit !== Infinity && usage > limit;
  const comparisonRows = [
    { key: "tasksPerMonth", label: "Tasks / month" },
    { key: "customForms", label: "Custom forms" },
    { key: "processes", label: "Processes" },
    { key: "reports", label: "Reports" },
  ].map((row) => ({
    ...row,
    usage: currentUsage[row.key],
    executeLimit: planLimits.execute[row.key],
    optimizeLimit: planLimits.optimize[row.key],
    executeOver: isOver(currentUsage[row.key], planLimits.execute[row.key]),
  }));

  const getSavingsPercentage = () => {
    return Math.round(((12 - 10) / 12) * 100); // 17% savings for yearly
  };

  const getSelectedPlanPrice = () => {
    const plan = plans[selectedPlan];
    return plan ? plan.price[billingCycle] : 0;
  };

  const handleCouponApply = () => {
    // Mock coupon validation
    if (couponCode.toLowerCase() === "save20") {
      setCouponError("");
      // Apply discount logic here
    } else if (couponCode) {
      setCouponError("Invalid coupon code");
    } else {
      setCouponError("Please enter a coupon code");
    }
  };

  const handlePlanSelect = async (planKey) => {
    const plan = plans[planKey];
    if (!plan) return;

    const currentIndex = PLAN_ORDER.indexOf(currentPlan.key);
    const targetIndex = PLAN_ORDER.indexOf(planKey);

    // Check if this is a downgrade
    if (targetIndex < currentIndex) {
      try {
        const result = await validateDowngradeMutation.mutateAsync({
          targetLicenseCode: plan.license_code,
        });

        if (!result.canDowngrade) {
          setDowngradeIssues(result.issues || []);
          setPendingPlan(planKey);
          setShowComparisonDialog(true);
          return;
        }
      } catch (error) {
        toast({
          title: "Validation Error",
          description: "Could not validate downgrade. Please try again.",
          variant: "destructive",
        });
        return;
      }
    }

    setSelectedPlan(planKey);
  };

  const handleUpgrade = async () => {
    if (!plans[selectedPlan]) return;

    setIsProcessing(true);

    try {
      await upgradeMutation.mutateAsync({
        licenseCode: plans[selectedPlan].license_code,
        billingCycle: billingCycle,
      });
    } catch (error) {
      // Error handled in mutation onError
      setIsProcessing(false);
    }
  };

  // Loading state
  if (licensesLoading || subscriptionLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-600">Loading pricing information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 space-y-3">
        {/* Header Section */}
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/subscription">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to License
          </Link>
        </Button>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <CreditCard className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Upgrade Your Plan
              </h1>
              <p className="text-gray-600 mt-1">
                Choose the plan that fits your needs and complete your upgrade
              </p>
            </div>
          </div>
        </div>

        {/* Current Plan Summary */}
        <div className="bg-white rounded-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Current Plan
            </h2>
            {currentPlan.isOnTrial && (
              <Badge className="bg-orange-100 text-orange-700">
                {currentPlan.daysLeft} days left in trial
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-center space-x-3">
              <Crown className="h-5 w-5 text-blue-600" />
              <div>
                <div className="font-medium text-gray-900">
                  {currentPlan.name}
                </div>
                <div className="text-sm text-gray-600">Current plan</div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Shield className="h-5 w-5 text-green-600" />
              <div>
                <div className="font-medium text-gray-900">
                  ₹{currentPlan.price[billingCycle]}/
                  {billingCycle === "yearly" ? "year" : "month"}
                </div>
                <div className="text-sm text-gray-600">Current billing</div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <div>
                <div className="font-medium text-gray-900">
                  {currentPlan.expiryDate}
                </div>
                <div className="text-sm text-gray-600">
                  {currentPlan.isOnTrial ? "Trial expires" : "Next billing"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Plan Selection - Left 8 columns */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-sm border border-gray-200">
              {/* Header */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Choose Your Plan
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Select the plan that best fits your needs
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 bg-gray-100 rounded-sm p-1">
                    <Button
                      variant="ghost"
                      onClick={() => setBillingCycle("monthly")}
                      className={cn(
                        "h-9 px-3 py-1 text-sm rounded-md transition-colors",
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
                        "h-9 px-3 py-1 text-sm rounded-md transition-colors",
                        billingCycle === "yearly"
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-600 hover:text-gray-900",
                      )}
                    >
                      Yearly
                      {billingCycle === "yearly" && (
                        <span className="ml-1 text-xs text-green-600 font-medium">
                          Save {getSavingsPercentage()}%
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Plan Cards */}
              <div className="p-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  {getOrderedPlanEntries(plans).map(([planKey, plan]) => (
                    <div
                      key={planKey}
                      onClick={() => handlePlanSelect(planKey)}
                      className={cn(
                        "border rounded-sm p-4 cursor-pointer transition-all hover:shadow-md relative",
                        selectedPlan === planKey
                          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                          : "border-gray-200 hover:border-gray-300",
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

                      <div className="text-center mb-3">
                        <h3 className="text-xl font-bold text-gray-900 mb-1">
                          {plan.name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {plan.description}
                        </p>
                      </div>

                      <div className="text-center mb-3">
                        <div className="text-3xl font-bold text-gray-900 mb-1">
                          ₹{plan.price[billingCycle]}
                        </div>
                        <div className="text-sm text-gray-600">
                          per {billingCycle === "yearly" ? "year" : "month"}
                        </div>
                        {billingCycle === "yearly" && (
                          <div className="text-sm text-green-600 font-medium">
                            Save ₹{plan.price.monthly * 12 - plan.price.yearly}
                            /year
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 mb-3">
                        {plan.features.map((feature, index) => (
                          <div
                            key={index}
                            className="flex items-center space-x-2"
                          >
                            <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                            <span className="text-sm text-gray-600">
                              {feature}
                            </span>
                          </div>
                        ))}
                      </div>

                      {selectedPlan === planKey && (
                        <div className="absolute top-4 right-4">
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Order Summary - Right 4 columns */}
          <div className="lg:col-span-4 space-y-3">
            {/* Order Summary Card */}
            <div className="bg-white rounded-sm border border-gray-200 p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Order Summary
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Plan</span>
                  <span className="font-medium">
                    {plans[selectedPlan]?.name}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Billing</span>
                  <span className="font-medium capitalize">{billingCycle}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Price</span>
                  <span className="font-medium">
                    ₹{getSelectedPlanPrice().toLocaleString("en-IN")}
                  </span>
                </div>

                {billingCycle === "yearly" && (
                  <div className="flex justify-between items-center text-green-600">
                    <span>Yearly Discount</span>
                    <span>
                      -₹
                      {plans[selectedPlan]?.price.monthly * 12 -
                        plans[selectedPlan]?.price.yearly}
                    </span>
                  </div>
                )}

                <hr className="border-gray-200" />

                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total</span>
                  <span>₹{getSelectedPlanPrice()}</span>
                </div>
              </div>
            </div>

            {/* Coupon Code Card */}
            {/* <div className="bg-white rounded-sm border border-gray-200 p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <Gift className="h-5 w-5 mr-2" />
                Promo Code
              </h3>
              
              <div className="space-y-3">
                <Input
                  placeholder="Enter coupon code"
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value);
                    if (couponError) setCouponError('');
                  }}
                  className={cn(
                    couponError ? "border-red-300 focus:border-red-500" : ""
                  )}
                />
                
                {couponError && (
                  <div className="text-sm text-red-600 flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    {couponError}
                  </div>
                )}
                
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={handleCouponApply}
                  disabled={!couponCode}
                >
                  Apply Code
                </Button>
              </div>
            </div> */}

            {/* Upgrade Action Card */}
            <div className="bg-white rounded-sm border border-gray-200 p-4">
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-lg font-semibold"
                onClick={handleUpgrade}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                    Processing...
                  </div>
                ) : (
                  <>
                    <CreditCard className="h-5 w-5 mr-2" />
                    Proceed to Payment
                  </>
                )}
              </Button>

              <div className="mt-4 text-center">
                <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                  <Shield className="h-4 w-4" />
                  <span>Secure payment with 256-bit SSL encryption</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Benefits Section */}
        <div className="bg-white rounded-sm border border-gray-200 p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 text-center">
            Why Upgrade to {plans[selectedPlan]?.name}?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="text-center">
              <div className="p-3 bg-blue-100 rounded-xl w-fit mx-auto mb-3">
                <Zap className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Enhanced Performance
              </h3>
              <p className="text-sm text-gray-600">
                Get faster processing, better reliability, and improved user
                experience.
              </p>
            </div>

            <div className="text-center">
              <div className="p-3 bg-green-100 rounded-xl w-fit mx-auto mb-3">
                <Users className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Team Collaboration
              </h3>
              <p className="text-sm text-gray-600">
                Advanced team features, real-time collaboration, and role-based
                permissions.
              </p>
            </div>

            <div className="text-center">
              <div className="p-3 bg-purple-100 rounded-xl w-fit mx-auto mb-3">
                <Shield className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Priority Support
              </h3>
              <p className="text-sm text-gray-600">
                Get priority customer support, dedicated assistance, and faster
                response times.
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* Plan limit dialog */}
      <Dialog open={showPlanLimitDialog} onOpenChange={setShowPlanLimitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Can’t switch to Plan</DialogTitle>
            <DialogDescription>
              You currently have 500 tasks. Plan allows 100 tasks. Please reduce
              tasks or choose a higher plan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <div className="flex justify-between w-full">
              <Button
                variant="outline"
                onClick={() => setShowPlanLimitDialog(false)}
              >
                Close
              </Button>

              <Button
                variant="secondary"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => {
                  setShowPlanLimitDialog(false);
                }}
              >
                Choose Other
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={showComparisonDialog}
        onOpenChange={setShowComparisonDialog}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-amber-600 mr-2" />
              Cannot Downgrade - Usage Exceeds Target Plan Limits
            </DialogTitle>
            <DialogDescription>
              Your current usage exceeds the limits of the selected plan. Please
              reduce usage before downgrading.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-3">
            {downgradeIssues.length > 0 ? (
              <div className="space-y-3">
                {downgradeIssues.map((issue, index) => (
                  <div
                    key={index}
                    className="flex items-start space-x-3 p-3 bg-red-50 border border-red-200 rounded-md"
                  >
                    <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-red-800">
                        {issue.feature}
                      </div>
                      <div className="text-sm text-red-600">
                        Current usage: {issue.currentUsage} | Target limit:{" "}
                        {issue.targetLimit === -1
                          ? "Not available"
                          : issue.targetLimit}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-xs font-medium text-gray-500">
                  <div>Your usage</div>
                  <div className="text-center">Execute limits</div>
                  <div className="text-center">Optimize limits</div>
                </div>

                {comparisonRows.map((row) => (
                  <div
                    key={row.key}
                    className="grid grid-cols-3 gap-2 items-center"
                  >
                    <div className="text-sm text-gray-800">
                      {row.label}
                      <div className="text-gray-500">
                        {row.usage.toLocaleString()}
                      </div>
                    </div>

                    <div className="text-sm">
                      <div
                        className={cn(
                          "w-full text-center px-2 py-1 rounded-md",
                          row.executeOver
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : "bg-green-50 text-green-700 border border-green-200",
                        )}
                      >
                        {formatLimit(row.executeLimit)}
                      </div>
                      {row.executeOver && (
                        <div className="mt-1 flex items-center justify-center text-xs text-red-600">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Over current usage
                        </div>
                      )}
                    </div>

                    <div className="text-sm">
                      <div className="w-full text-center px-2 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                        {formatLimit(row.optimizeLimit)}
                      </div>
                      <div className="mt-1 flex items-center justify-center text-xs text-purple-600">
                        <Check className="h-3 w-3 mr-1" />
                        Room to grow
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 rounded-md bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
              Tip: Reduce usage of the highlighted features before downgrading,
              or choose a higher tier plan.
            </div>
          </div>

          <DialogFooter>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                setShowComparisonDialog(false);
                setPendingPlan(null);
                setDowngradeIssues([]);
              }}
            >
              Got it, I'll stay on my current plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
