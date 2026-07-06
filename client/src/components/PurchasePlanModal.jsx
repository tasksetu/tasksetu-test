import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ShoppingCart,
  Plus,
  Minus,
  Check,
  AlertCircle,
  Zap,
  CalendarClock,
  ArrowDown,
  Clock,
  Shield,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  PLAN_ORDER_UPPERCASE,
  GRACE_PERIOD_DAYS,
  sortPlansByOrder,
} from "@/utils/licenseConstants";

export function PurchasePlanModal({ isOpen, onClose, isIndividual = false }) {
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [planSeats, setPlanSeats] = useState({}); // { PLAN: 2, EXECUTE: 3, ... }
  const [selectedIndividualPlan, setSelectedIndividualPlan] = useState(null); // For individual mode
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [showDowngradeWarning, setShowDowngradeWarning] = useState(false);
  const [downgradeWarningData, setDowngradeWarningData] = useState(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load Razorpay script
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Fetch available plans
  const { data: plansResponse } = useQuery({
    queryKey: ["/api/license/plans"],
    queryFn: async () => {
      const response = await fetch("/api/license/plans", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch plans");
      return response.json();
    },
    enabled: isOpen,
  });

  // Fetch current organization subscriptions
  const { data: subscriptionsResponse } = useQuery({
    queryKey: ["/api/organization/multi-subscriptions"],
    queryFn: async () => {
      const response = await fetch("/api/organization/multi-subscriptions", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch subscriptions");
      return response.json();
    },
    enabled: isOpen,
  });

  // Fetch current subscription details (for current plan summary)
  const { data: currentSubscriptionResponse } = useQuery({
    queryKey: ["/api/license/organization/subscription"],
    queryFn: async () => {
      const response = await fetch("/api/license/organization/subscription", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch current subscription");
      return response.json();
    },
    enabled: isOpen,
  });

  // Fetch current usage (for downgrade validation)
  const { data: usageResponse } = useQuery({
    queryKey: ["/api/license/organization/features"],
    queryFn: async () => {
      const response = await fetch("/api/license/organization/features", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch usage");
      return response.json();
    },
    enabled: isOpen,
  });

  const plans = plansResponse?.data || [];
  const currentSubscriptions = subscriptionsResponse?.data || [];
  const currentSubscription = currentSubscriptionResponse?.subscription;
  const currentUsage = usageResponse?.usage || {};

  // Filter out EXPLORE/Free Trial plan - it's not purchasable
  // Ensure plans is an array before filtering
  const purchasablePlans = Array.isArray(plans)
    ? plans.filter(
        (plan) =>
          plan.license_code !== "EXPLORE" && plan.license_code !== "EXPIRED",
      )
    : [];

  // Purchase multiple plans mutation
  const purchasePlansMutation = useMutation({
    mutationFn: async (billingData) => {
      // Step 1: Create Razorpay order with billing breakdown
      // billingData includes: purchases, coupon_code, subtotal, discount_amount, before_gst_amount, gst_amount, gst_rate, final_amount
      const orderResponse = await fetch(
        "/api/organization/create-license-order",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify(billingData),
        },
      );

      if (!orderResponse.ok) {
        const error = await orderResponse.json();
        throw new Error(error.message || "Failed to create order");
      }

      const orderData = await orderResponse.json();
      return orderData.data;
    },
    onSuccess: async (orderData) => {
      // Step 2: Open Razorpay payment modal
      const res = await loadRazorpayScript();

      if (!res) {
        toast({
          title: "Payment Gateway Error",
          description: "Failed to load Razorpay. Please try again.",
          variant: "destructive",
        });
        return;
      }

      const options = {
        key: orderData.razorpay_key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "TaskSetu",
        description: `License Purchase - ${orderData.purchase_details.length} plan(s)`,
        order_id: orderData.order_id,
        handler: async function (response) {
          setIsProcessingPayment(true);
          try {
            // Step 3: Verify payment with atomic license creation
            const verifyResponse = await fetch(
              "/api/organization/verify-license-payment",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  coupon_code: appliedCoupon?.code || null,
                  purchases: isIndividual
                    ? [
                        {
                          license_code: selectedIndividualPlan,
                          seats: 1,
                          billing_cycle: billingCycle.toUpperCase(),
                        },
                      ]
                    : Object.entries(planSeats)
                        .filter(([_, seats]) => seats > 0)
                        .map(([license_code, seats]) => ({
                          license_code,
                          seats,
                          billing_cycle: billingCycle.toUpperCase(),
                        })),
                }),
              },
            );

            if (!verifyResponse.ok) {
              throw new Error("Payment verification failed");
            }

            const result = await verifyResponse.json();
            const totalSeats = isIndividual
              ? 1
              : Object.values(planSeats).reduce((sum, seats) => sum + seats, 0);

            // Extract created instances count from response (correct field name)
            const instancesCreated =
              result.data?.license_instances_created || totalSeats;

            toast({
              title: "Payment Successful!",
              description: isIndividual
                ? (isDowngradeSelected()
                  ? "Your downgrade has been scheduled. It will activate when your current plan expires."
                  : "Your individual plan has been updated successfully.")
                : `${instancesCreated} license instance${instancesCreated > 1 ? "s" : ""} created and added to your organization pool.`,
            });

            // Clear the useLicense localStorage cache so stale data is not served
            localStorage.removeItem("tasksetu_license_cache");

            // Force immediate refetch of all license-related queries (type: 'all' forces
            // refetch even if there are no active observers, since this modal is closed before handler fires)
            // PurchasePlanModal internal queries
            queryClient.refetchQueries({
              queryKey: ["/api/organization/multi-subscriptions"],
              type: "all",
            });
            queryClient.refetchQueries({
              queryKey: ["/api/organization/license"],
              type: "all",
            });
            queryClient.refetchQueries({ queryKey: ["users"], type: "all" });
            queryClient.refetchQueries({ queryKey: ["invoices"], type: "all" });

            // LicenseManagementPage queries - force refetch so UI updates without page refresh
            queryClient.refetchQueries({
              queryKey: ["/api/license/current"],
              type: "all",
            });
            queryClient.refetchQueries({
              queryKey: ["/api/license/licenses"],
              type: "all",
            });
            queryClient.refetchQueries({
              queryKey: ["/api/license/plans"],
              type: "all",
            });
            queryClient.refetchQueries({
              queryKey: ["/api/license/organization/subscription"],
              type: "all",
            });
            queryClient.refetchQueries({
              queryKey: ["/api/license/organization/features"],
              type: "all",
            });
            queryClient.refetchQueries({
              queryKey: ["current-license-info"],
              type: "all",
            });
            // For individual users - profile gets updated with new assigned license
            if (isIndividual) {
              queryClient.refetchQueries({
                queryKey: ["/api/profile"],
                type: "all",
              });
            }

            onClose();
            resetForm();
          } catch (error) {
            toast({
              title: "Payment Verification Failed",
              description: error.message,
              variant: "destructive",
            });
          } finally {
            setIsProcessingPayment(false);
          }
        },
        prefill: {
          name: localStorage.getItem("userName") || "",
          email: localStorage.getItem("userEmail") || "",
        },
        theme: {
          color: "#2563eb",
        },
        modal: {
          ondismiss: function () {
            setIsProcessingPayment(false);
          },
        },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();

      // Close the purchase modal so Razorpay modal can be fully active
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Order Creation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setPlanSeats({});
    setSelectedIndividualPlan(null);
    setBillingCycle("monthly");
    setCouponCode("");
    setCouponError("");
    setAppliedCoupon(null);
    setShowDowngradeWarning(false);
    setDowngradeWarningData(null);
  };

  // Validate coupon code
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError("Please enter a coupon code");
      return;
    }

    setIsValidatingCoupon(true);
    setCouponError("");

    try {
      const response = await fetch("/api/license/validate-coupon", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: couponCode }),
      });

      if (!response.ok) {
        const error = await response.json();
        setCouponError(error.message || "Invalid coupon code");
        setAppliedCoupon(null);
        return;
      }

      const data = await response.json();
      setAppliedCoupon(data.coupon);
      toast({
        title: "Coupon Applied!",
        description: `${data.coupon.discount}% discount applied to your purchase.`,
      });
      setCouponError("");
    } catch (error) {
      setCouponError("Failed to validate coupon. Please try again.");
      setAppliedCoupon(null);
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  // Validate downgrade
  const validateDowngrade = (targetPlanCode) => {
    const currentPlanName =
      currentSubscription?.license_details?.name ||
      currentSubscription?.current_license;
    const targetPlan = plans.find((p) => p.license_code === targetPlanCode);

    if (!currentPlanName || !targetPlan) return null;

    const currentIndex = PLAN_ORDER_UPPERCASE.indexOf(
      currentPlanName.toUpperCase(),
    );
    const targetIndex = PLAN_ORDER_UPPERCASE.indexOf(
      targetPlan.license_code.toUpperCase(),
    );

    // Check if it's a downgrade
    if (targetIndex >= currentIndex) {
      return null; // Not a downgrade
    }

    // Check usage against new limits
    const exceedingLimits = [];

    if (targetPlan.features) {
      targetPlan.features.forEach((feature) => {
        const currentUsageValue = currentUsage[feature.feature_code] || 0;
        const newLimit = feature.usage_limit;

        if (newLimit !== -1 && currentUsageValue > newLimit) {
          exceedingLimits.push({
            feature: feature.feature_name || feature.feature_code,
            current: currentUsageValue,
            limit: newLimit,
          });
        }
      });
    }

    return exceedingLimits.length > 0 ? exceedingLimits : null;
  };

  const updateSeats = (planCode, delta) => {
    setPlanSeats((prev) => {
      const currentSeats = prev[planCode] || 0;
      const newSeats = Math.max(0, currentSeats + delta);
      if (newSeats === 0) {
        const { [planCode]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [planCode]: newSeats };
    });
  };

  const setSeats = (planCode, value) => {
    const seats = Math.max(0, parseInt(value) || 0);
    setPlanSeats((prev) => {
      if (seats === 0) {
        const { [planCode]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [planCode]: seats };
    });
  };

  const isDowngradeSelected = () => {
    if (!isIndividual || !selectedIndividualPlan || !currentSubscription)
      return false;
    const currentCode = (
      currentSubscription.license_code ||
      currentSubscription.current_license ||
      ""
    ).toUpperCase();
    if (!currentCode || currentCode === "EXPLORE" || currentCode === "EXPIRED")
      return false;

    const targetCode = selectedIndividualPlan.toUpperCase();
    const currentLicenseIndex = PLAN_ORDER_UPPERCASE.indexOf(currentCode);
    const targetLicenseIndex = PLAN_ORDER_UPPERCASE.indexOf(targetCode);

    return (
      targetLicenseIndex !== -1 &&
      currentLicenseIndex !== -1 &&
      targetLicenseIndex < currentLicenseIndex
    );
  };

  const isSamePlanSelected = () => {
    if (!isIndividual || !selectedIndividualPlan || !currentSubscription)
      return false;

    const currentCode = (
      currentSubscription.license_code ||
      currentSubscription.current_license ||
      ""
    ).toUpperCase();
    const targetCode = selectedIndividualPlan.toUpperCase();

    if (currentCode === "EXPLORE" || currentCode === "EXPIRED") return false;

    return currentCode === targetCode;
  };

  const hasPendingDowngrade = () => {
    if (!isIndividual || !currentSubscription) return false;
    return !!currentSubscription.pending_license?.license_code;
  };

  const handleIndividualSelect = (planCode) => {
    if (hasPendingDowngrade()) return; // Block selection when pending downgrade exists
    setSelectedIndividualPlan(planCode);
  };

  const handlePurchaseAll = () => {
    let purchases = [];

    if (isIndividual) {
      if (!selectedIndividualPlan) {
        toast({
          title: "No Plan Selected",
          description: "Please select a plan to upgrade.",
          variant: "destructive",
        });
        return;
      }
      purchases = [
        {
          license_code: selectedIndividualPlan,
          seats: 1,
          billing_cycle: billingCycle.toUpperCase(),
        },
      ];
    } else {
      // Organization logic
      const selectedPlans = Object.entries(planSeats).filter(
        ([_, seats]) => seats > 0,
      );

      if (selectedPlans.length === 0) {
        toast({
          title: "No Plans Selected",
          description:
            "Please select at least one plan with seats to purchase.",
          variant: "destructive",
        });
        return;
      }

      purchases = selectedPlans.map(([license_code, seats]) => ({
        license_code,
        seats,
        billing_cycle: billingCycle.toUpperCase(),
      }));
    }

    // 📊 Calculate GST and discount BEFORE sending to payment gateway
    const billingSummary = calculateTotal();

    // Send to mutation with all calculated details
    purchasePlansMutation.mutate({
      purchases,
      coupon_code: appliedCoupon?.code || null,
      subtotal: billingSummary.subtotal,
      upgrade_discount: billingSummary.upgradeDiscount,
      discount_amount: billingSummary.discountAmount,
      before_gst_amount: billingSummary.beforeGSTAmount,
      gst_amount: billingSummary.gstAmount,
      gst_rate: 0.18,
      final_amount: billingSummary.finalAmount,
    });
  };

  // 💰 Calculate totals with GST (18%) and discount
  const calculateTotal = () => {
    let subtotal = 0;
    let totalSeats = 0;
    let yearlyDiscount = 0;

    if (isIndividual) {
      if (!selectedIndividualPlan) {
        return {
          subtotal: 0,
          yearlyDiscount: 0,
          upgradeDiscount: 0,
          adjustedSubtotal: 0,
          discountAmount: 0,
          beforeGSTAmount: 0,
          gstAmount: 0,
          finalAmount: 0,
          totalSeats: 0,
        };
      }
      const plan = plans.find((p) => p.license_code === selectedIndividualPlan);
      if (!plan) {
        return {
          subtotal: 0,
          yearlyDiscount: 0,
          upgradeDiscount: 0,
          adjustedSubtotal: 0,
          discountAmount: 0,
          beforeGSTAmount: 0,
          gstAmount: 0,
          finalAmount: 0,
          totalSeats: 0,
        };
      }
      if (billingCycle === "monthly") {
        subtotal = plan.price_monthly;
      } else {
        subtotal = plan.price_monthly * 12;
        yearlyDiscount = subtotal - plan.price_yearly;
      }
      totalSeats = 1;
    } else {
      // Organization logic
      Object.entries(planSeats).forEach(([code, seats]) => {
        const plan = plans.find((p) => p.license_code === code);
        if (plan && seats > 0) {
          if (billingCycle === "monthly") {
            subtotal += plan.price_monthly * seats;
          } else {
            const lineBase = plan.price_monthly * 12 * seats;
            subtotal += lineBase;
            yearlyDiscount += lineBase - plan.price_yearly * seats;
          }
          totalSeats += seats;
        }
      });
    }

    // Upgrade discount calculation (credit)
    let upgradeDiscount = 0;
    if (
      isIndividual &&
      currentSubscription &&
      currentSubscription.license_code
    ) {
      const currentCode = currentSubscription.license_code.toUpperCase();
      if (currentCode !== "EXPLORE" && currentCode !== "EXPIRED") {
        const expiry =
          currentSubscription.expiry_date ||
          currentSubscription.subscription_end_date;
        const currentExpiry = expiry ? new Date(expiry) : null;
        const now = new Date();
        if (currentExpiry && currentExpiry > now) {
          const currentDetails = currentSubscription.license_details;
          if (currentDetails) {
            const currentCycle = (
              currentSubscription.billing_cycle || "monthly"
            ).toLowerCase();
            const currentPrice =
              currentCycle === "yearly"
                ? currentDetails.price_yearly
                : currentDetails.price_monthly;
            if (currentPrice > 0) {
              const totalDays = currentCycle === "yearly" ? 365 : 30;
              const remainingTimeMs = currentExpiry.getTime() - now.getTime();
              const remainingDays = remainingTimeMs / (1000 * 60 * 60 * 24);
              const unusedDays = Math.max(
                0,
                Math.min(totalDays, remainingDays),
              );
              const unusedValue = (currentPrice / totalDays) * unusedDays;

              // Check if it's an upgrade
              const targetCode = selectedIndividualPlan?.toUpperCase();
              const LICENSE_HIERARCHY = [
                "EXPLORE",
                "PLAN",
                "EXECUTE",
                "OPTIMIZE",
              ];
              const currentLicenseIndex =
                LICENSE_HIERARCHY.indexOf(currentCode);
              const targetLicenseIndex = LICENSE_HIERARCHY.indexOf(targetCode);

              let isUpgrade = false;
              if (targetLicenseIndex > currentLicenseIndex) {
                isUpgrade = true;
              } else if (targetLicenseIndex === currentLicenseIndex) {
                if (currentCycle === "monthly" && billingCycle === "yearly") {
                  isUpgrade = true;
                }
              }

              if (isUpgrade) {
                upgradeDiscount = Math.round(unusedValue * 100) / 100;
              }
            }
          }
        }
      }
    }

    const adjustedSubtotal = Math.max(
      0,
      subtotal - yearlyDiscount - upgradeDiscount,
    );

    // 🎟️ Calculate discount amount
    const discountPercentage = appliedCoupon?.discount || 0;
    const discountAmount =
      Math.round(((adjustedSubtotal * discountPercentage) / 100) * 100) / 100;

    // 💸 Amount before GST (adjustedSubtotal - discount)
    const beforeGSTAmount =
      Math.round((adjustedSubtotal - discountAmount) * 100) / 100;

    // 📊 Calculate 18% GST
    const GST_RATE = 0.18;
    const gstAmount = Math.round(beforeGSTAmount * GST_RATE * 100) / 100;

    // 💳 Final amount for payment gateway
    const finalAmount = Math.round((beforeGSTAmount + gstAmount) * 100) / 100;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      yearlyDiscount: Math.round(yearlyDiscount * 100) / 100,
      upgradeDiscount,
      adjustedSubtotal,
      discountAmount,
      beforeGSTAmount,
      gstAmount,
      finalAmount,
      totalSeats,
      originalTotal: Math.round(subtotal * 100) / 100,
    };
  };

  const {
    finalAmount: totalPrice,
    totalSeats,
    gstAmount,
    discountAmount,
    beforeGSTAmount,
    upgradeDiscount,
    yearlyDiscount,
  } = calculateTotal();

  const ownedPlanCodes = currentSubscriptions
    .filter((sub) => sub.seats_purchased > 0)
    .map((sub) => sub.license_code);

  const currentActivePlansList = purchasablePlans.filter((plan) =>
    ownedPlanCodes.includes(plan.license_code)
  );
  const newPlansList = purchasablePlans.filter(
    (plan) => !ownedPlanCodes.includes(plan.license_code)
  );

  const renderPlanRow = (plan) => {
    const price =
      billingCycle === "monthly"
        ? plan.price_monthly
        : plan.price_yearly;

    const isSelected = isIndividual
      ? selectedIndividualPlan === plan.license_code
      : (planSeats[plan.license_code] || 0) > 0;

    const lineTotal = isIndividual
      ? price
      : price * (planSeats[plan.license_code] || 0);

    return (
      <div
        key={plan.license_code}
        onClick={() =>
          isIndividual &&
          !hasPendingDowngrade() &&
          handleIndividualSelect(plan.license_code)
        }
        className={cn(
          "border-2 rounded-lg p-2 transition-all relative",
          isIndividual && !hasPendingDowngrade() ? "cursor-pointer" : "",
          hasPendingDowngrade() && "opacity-60 cursor-not-allowed",
          isSelected
            ? "border-blue-500 bg-blue-50 shadow-md"
            : "border-gray-200 bg-white hover:border-gray-300",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          {isIndividual && (
            <div className="mt-1">
              <div
                className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                  isSelected
                    ? "border-blue-600 bg-blue-600"
                    : "border-gray-300",
                )}
              >
                {isSelected && <Check className="w-3 h-3 text-white" />}
              </div>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-semibold text-base text-gray-900">
                {plan.license_name}
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-1">
              ₹{price.toLocaleString()}/
              {billingCycle === "monthly" ? "month" : "year"} per seat
            </p>

            {plan.features_summary &&
              Array.isArray(plan.features_summary) &&
              plan.features_summary.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {plan.features_summary.slice(0, 3).map((feature, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded"
                    >
                      <Check className="h-3 w-3 mr-1 text-green-500" />
                      {feature}
                    </span>
                  ))}
                  {plan.features_summary.length > 3 && (
                    <span className="inline-flex items-center text-xs text-gray-500 px-2 py-1">
                      +{plan.features_summary.length - 3} more
                    </span>
                  )}
                </div>
              )}
          </div>

          <div className="flex flex-col items-end gap-2">
            {!isIndividual && (
              <div className="flex items-center space-x-2 bg-white rounded-lg border-2 border-gray-200 p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateSeats(plan.license_code, -1);
                  }}
                  className="h-8 w-8"
                  disabled={!planSeats[plan.license_code]}
                >
                  <Minus className="h-4 w-4 text-gray-600" />
                </Button>
                <input
                  type="number"
                  min="0"
                  value={planSeats[plan.license_code] || 0}
                  onChange={(e) => {
                    e.stopPropagation();
                    setSeats(plan.license_code, e.target.value);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="text-center font-semibold no-spinner focus:ring-0 focus:outline-none"
                  style={{
                    width: "40px",
                    height: "32px",
                    border: "none",
                    outline: "none",
                    padding: "0",
                    background: "transparent",
                    textAlign: "center",
                    WebkitAppearance: "none",
                    MozAppearance: "textfield",
                  }}
                  placeholder="0"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateSeats(plan.license_code, 1);
                  }}
                  className="h-8 w-8"
                >
                  <Plus className="h-4 w-4 text-gray-600" />
                </Button>
              </div>
            )}

            {isSelected && (
              <div className="text-right">
                {!isIndividual && (
                  <div className="text-xs text-gray-500">Subtotal</div>
                )}
                <div className="text-lg font-bold text-blue-600">
                  ₹{lineTotal.toLocaleString()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto !rounded-sm [&_input:not([type='checkbox']):not([type='radio'])]:!rounded-sm [&_select]:!rounded-sm [&_textarea]:!rounded-sm [&_.form-input]:!rounded-sm [&_.form-select]:!rounded-sm [&_.form-textarea]:!rounded-sm [&_button:not(.rounded-full)]:!rounded-sm [&_table]:!rounded-sm [&_.bg-white.border]:!rounded-sm [&_.rounded-sm]:!rounded-sm [&_.rounded-md]:!rounded-sm [&_.rounded-lg]:!rounded-sm [&_.rounded-xl]:!rounded-sm [&_.rounded-2xl]:!rounded-sm [&_.rounded]:!rounded-sm [&_.rounded-r-lg]:!rounded-r-sm [&_.rounded-r-md]:!rounded-r-sm [&_input]:h-8 [&_input]:min-h-8 [&_input]:max-h-8 [&_input]:py-0 [&_input]:box-border [&_select]:h-8 [&_select]:min-h-8 [&_select]:max-h-8 [&_select]:py-0 [&_select]:box-border [&_textarea]:min-h-8 [&_.form-input]:h-8 [&_.form-input]:min-h-8 [&_.form-input]:max-h-8 [&_.form-input]:py-0 [&_.form-input]:box-border [&_.form-select]:h-8 [&_.form-select]:min-h-8 [&_.form-select]:max-h-8 [&_.form-select]:py-0 [&_.form-select]:box-border">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-xl font-semibold">
            <ShoppingCart className="h-5 w-5 text-blue-600" />
            <span>
              {isIndividual
                ? "Change Your Plan"
                : "Purchase Licenses - All Plans"}
            </span>
          </DialogTitle>
          <DialogDescription>
            {isIndividual
              ? "Select a plan to upgrade or downgrade your account."
              : "Select seats for each plan you want to purchase. You can buy multiple plans at once."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-0">
          {/* Current Plan Summary - For Individual Users */}
          {isIndividual && currentSubscription && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-2">
              <h3 className="font-semibold text-sm text-blue-900 mb-1.5 flex items-center">
                <span className="h-2 w-2 bg-blue-600 rounded-full mr-2"></span>
                Current Plan
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-gray-600">Plan</p>
                  <p className="text-sm font-medium text-gray-900 leading-tight">
                    {currentSubscription.license_details?.name ||
                      currentSubscription.current_license}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Billing Cycle</p>
                  <p className="text-sm font-medium text-gray-900 capitalize leading-tight">
                    {currentSubscription.billing_cycle}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Expiry Date</p>
                  <p className="text-sm font-medium text-gray-900 leading-tight">
                    {currentSubscription.expiry_date
                      ? new Date(
                          currentSubscription.expiry_date,
                        ).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Grace Period</p>
                  <p className="text-sm font-medium text-gray-900 leading-tight">
                    {(() => {
                      const code = (currentSubscription.license_code || currentSubscription.current_license || "").toUpperCase();
                      const days = GRACE_PERIOD_DAYS[code] || 0;
                      return days > 0 ? `${days} days` : "N/A";
                    })()}
                  </p>
                </div>
              </div>

              {/* Grace Period Warning */}
              {currentSubscription.grace_period_info?.is_in_grace_period && (
                <div className="mt-2 bg-orange-50 border border-orange-200 rounded p-2 flex items-start gap-2">
                  <Clock className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-orange-800">
                    <p className="font-semibold">Grace Period Active</p>
                    <p>Your plan expired. You have {currentSubscription.grace_period_info.days_remaining_in_grace} day(s) left in grace period. Renewing now will start your new plan from the original expiry date.</p>
                  </div>
                </div>
              )}

              {/* Pending Downgrade Info */}
              {currentSubscription.pending_license?.license_code && (
                <div className="mt-2 bg-indigo-50 border border-indigo-200 rounded p-2 flex items-start gap-2">
                  <CalendarClock className="h-4 w-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-indigo-800">
                    <p className="font-semibold">Scheduled Plan Change</p>
                    <p>
                      Your plan will change to <strong>{currentSubscription.pending_license.license_code}</strong> on{" "}
                      {new Date(currentSubscription.pending_license.scheduled_start_date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}.
                      This change cannot be modified. New purchases are blocked until the scheduled plan activates.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Current Subscriptions Summary - Only for Org Admin */}
          {!isIndividual && currentSubscriptions.length > 0 && (
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-4.5 w-4.5 text-blue-600" />
                <h3 className="font-semibold text-sm text-blue-900">
                  Current Licenses
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentSubscriptions.map((sub, idx) => {
                  const usagePercent = sub.seats_purchased > 0
                    ? Math.round((sub.seats_used / sub.seats_purchased) * 100)
                    : 0;

                  return (
                    <div
                      key={idx}
                      className="bg-white border border-blue-100 rounded-lg p-3 shadow-sm flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-bold text-sm text-gray-900">
                          {sub.license_name}
                        </span>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full font-medium",
                          usagePercent >= 100 
                            ? "bg-red-50 text-red-600 border border-red-100" 
                            : usagePercent > 0 
                              ? "bg-amber-50 text-amber-600 border border-amber-100" 
                              : "bg-green-50 text-green-600 border border-green-100"
                        )}>
                          {usagePercent}% used
                        </span>
                      </div>
                      
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>Assigned Seats</span>
                          <span className="font-semibold text-gray-900">
                            {sub.seats_used} / {sub.seats_purchased}
                          </span>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className={cn(
                              "h-1.5 rounded-full transition-all",
                              usagePercent >= 100 ? "bg-red-500" : "bg-blue-500"
                            )}
                            style={{ width: `${Math.min(100, usagePercent)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Billing Cycle Selection */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">
              Billing Cycle
            </Label>
            <div className="flex space-x-2">
              <Button
                variant={billingCycle === "monthly" ? "primary" : "outline"}
                onClick={() => setBillingCycle("monthly")}
                className={cn(
                  "flex-1 h-8",
                  billingCycle === "monthly" && "shadow-md",
                )}
              >
                Monthly Billing
              </Button>
              <Button
                variant={billingCycle === "yearly" ? "primary" : "outline"}
                onClick={() => setBillingCycle("yearly")}
                className={cn(
                  "flex-1 h-8",
                  billingCycle === "yearly" && "shadow-md",
                )}
              >
                <span className="flex items-center justify-center gap-1">
                  Yearly Billing
                  <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full ml-1">
                    Save 10%
                  </span>
                </span>
              </Button>
            </div>
          </div>

          {/* Coupon Code Section */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <Label className="text-sm font-medium text-gray-700 mb-2 block">
              Have a Coupon Code?
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter coupon code"
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value);
                  setCouponError("");
                }}
                disabled={!!appliedCoupon || isValidatingCoupon}
                className="flex-1 h-8"
              />
              {appliedCoupon ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setAppliedCoupon(null);
                    setCouponCode("");
                    setCouponError("");
                  }}
                  className="h-8 border-red-300 text-red-600 hover:bg-red-50"
                >
                  Remove
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleApplyCoupon}
                  disabled={!couponCode.trim() || isValidatingCoupon}
                  className="h-8 bg-green-600 hover:bg-green-700 text-white"
                >
                  {isValidatingCoupon ? "Validating..." : "Apply"}
                </Button>
              )}
            </div>
            {couponError && (
              <p className="text-xs text-red-600 mt-2 flex items-center">
                <span className="mr-1">⚠️</span> {couponError}
              </p>
            )}
            {appliedCoupon && (
              <p className="text-xs text-green-600 mt-2 flex items-center font-medium">
                <span className="mr-1">✓</span> Coupon "{appliedCoupon.code}"
                applied! You save {appliedCoupon.discount}%
              </p>
            )}
          </div>

          {/* All Plans with Seat Selectors or Radio Selection */}
          <div>
            {isIndividual ? (
              <>
                <Label className="text-sm font-medium text-gray-700 mb-3 block">
                  Select Plan
                </Label>
                <div className="grid gap-3">
                  {purchasablePlans.map((plan) => renderPlanRow(plan))}
                </div>
              </>
            ) : (
              <div className="space-y-6">
                {/* Section 1: Add Seats to Current Licenses */}
                {currentActivePlansList.length > 0 && (
                  <div>
                    <div className="flex flex-col mb-3">
                      <Label className="text-sm font-semibold text-blue-900 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                        Add Seats to Current Licenses
                      </Label>
                      <span className="text-xs text-gray-500 mt-0.5 ml-3">
                        Add more capacity to the plans your organization is already using
                      </span>
                    </div>
                    <div className="grid gap-3">
                      {currentActivePlansList.map((plan) => renderPlanRow(plan))}
                    </div>
                  </div>
                )}

                {/* Section 2: Purchase New Licenses */}
                {newPlansList.length > 0 && (
                  <div>
                    <div className="flex flex-col mb-3">
                      <Label className="text-sm font-semibold text-purple-900 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
                        Purchase New License Plans
                      </Label>
                      <span className="text-xs text-gray-500 mt-0.5 ml-3">
                        Subscribe to new plans and features for your team
                      </span>
                    </div>
                    <div className="grid gap-3">
                      {newPlansList.map((plan) => renderPlanRow(plan))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Order Summary */}
          {totalSeats > 0 && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-5">
              <h3 className="font-semibold text-base text-gray-900 mb-3 flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-600" />
                {isIndividual ? "Plan Summary" : "Order Summary"}
              </h3>

              <div className="space-y-3">
                {isIndividual
                  ? // Individual Summary
                    (() => {
                      const plan = plans.find(
                        (p) => p.license_code === selectedIndividualPlan,
                      );
                      if (!plan) return null;
                      const price =
                        billingCycle === "monthly"
                          ? plan.price_monthly
                          : plan.price_monthly * 12;
                      return (
                        <div className="flex justify-between items-center text-sm bg-white/60 rounded px-3 py-2">
                          <div>
                            <span className="font-medium text-gray-900">
                              {plan.license_name}
                            </span>
                            <span className="text-gray-500 ml-2">
                              (Individual License)
                            </span>
                          </div>
                          <span className="font-semibold text-gray-900">
                            ₹{price.toLocaleString()}
                          </span>
                        </div>
                      );
                    })()
                  : // Org Summary
                    Object.entries(planSeats)
                      .filter(([_, seats]) => seats > 0)
                      .map(([code, seats]) => {
                        const plan = plans.find((p) => p.license_code === code);
                        if (!plan) return null;
                        const price =
                          billingCycle === "monthly"
                            ? plan.price_monthly
                            : plan.price_monthly * 12;
                        const lineTotal = price * seats;

                        return (
                          <div
                            key={code}
                            className="flex justify-between items-center text-sm bg-white/60 rounded px-3 py-2"
                          >
                            <div>
                              <span className="font-medium text-gray-900">
                                {plan.license_name}
                              </span>
                              <span className="text-gray-500 ml-2">
                                × {seats} seat{seats > 1 ? "s" : ""}
                              </span>
                            </div>
                            <span className="font-semibold text-gray-900">
                              ₹{lineTotal.toLocaleString()}
                            </span>
                          </div>
                        );
                      })}

                <div className="border-t-2 border-blue-300 pt-3 mt-3 space-y-2">
                  {/* 📋 Pricing Breakdown with GST */}
                  <div className="bg-gradient-to-r from-gray-50 to-white rounded-lg p-3 space-y-1.5">
                    {/* Subtotal */}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="text-gray-900 font-medium">
                        ₹{calculateTotal().subtotal.toLocaleString()}
                      </span>
                    </div>

                    {/* Yearly Discount */}
                    {billingCycle === "yearly" && yearlyDiscount > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-green-600 font-medium">
                          Yearly Discount (Save 10%):
                        </span>
                        <span className="text-green-600 font-medium">
                          -₹{yearlyDiscount.toLocaleString()}
                        </span>
                      </div>
                    )}

                    {/* Upgrade Credit */}
                    {upgradeDiscount > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-green-600 font-medium">
                          Upgrade Credit (Unused Plan Days):
                        </span>
                        <span className="text-green-600 font-medium">
                          -₹{upgradeDiscount.toLocaleString()}
                        </span>
                      </div>
                    )}

                    {/* Discount */}
                    {appliedCoupon && discountAmount > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-green-600 font-medium">
                          Discount ({appliedCoupon.discount}%):
                        </span>
                        <span className="text-green-600 font-medium">
                          -₹{discountAmount.toLocaleString()}
                        </span>
                      </div>
                    )}

                    {/* Before GST Amount */}
                    <div className="border-t border-gray-200 pt-1 flex justify-between items-center text-sm">
                      <span className="text-gray-600">Amount Before GST:</span>
                      <span className="text-gray-900 font-medium">
                        ₹{beforeGSTAmount.toLocaleString()}
                      </span>
                    </div>

                    {/* GST 18% */}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-blue-600 font-medium">
                        GST (18%):
                      </span>
                      <span className="text-blue-600 font-medium">
                        +₹{gstAmount.toLocaleString()}
                      </span>
                    </div>

                    {/* Final Total */}
                    <div className="border-t-2 border-blue-300 pt-1.5 flex justify-between items-center">
                      <div>
                        <div className="text-sm font-bold text-blue-900">
                          Final Amount{" "}
                          {isIndividual
                            ? ""
                            : `(${totalSeats} seat${totalSeats > 1 ? "s" : ""})`}
                        </div>
                        <div className="text-xs text-gray-500">
                          Billed {billingCycle}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600">
                          ₹{totalPrice.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          /{billingCycle === "monthly" ? "month" : "year"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isDowngradeSelected() && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start space-x-2">
              <ArrowDown className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                <p className="font-semibold mb-0.5 text-amber-900">
                  Plan Downgrade
                </p>
                <p>
                  This is a downgrade. Your new plan will start after your current plan expires
                  {currentSubscription?.expiry_date && (
                    <> on{" "}
                      <strong>
                        {new Date(currentSubscription.expiry_date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </strong>
                    </>
                  )}.
                  Your current plan features will remain active until then.
                </p>
                {(() => {
                  const code = (currentSubscription?.license_code || currentSubscription?.current_license || "").toUpperCase();
                  const graceDays = GRACE_PERIOD_DAYS[code] || 0;
                  if (graceDays > 0) {
                    return (
                      <p className="mt-1 text-amber-700">
                        <Clock className="h-3 w-3 inline mr-1" />
                        Grace period: {graceDays} days after expiry
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          )}

          {isSamePlanSelected() && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-800">
                <p className="font-semibold mb-0.5 text-blue-900">
                  Subscription Extension
                </p>
                <p>
                  You already have an active subscription for this plan.
                  Purchasing it again will extend your expiry date.
                </p>
              </div>
            </div>
          )}

          {/* Important Notice */}
          {!(isIndividual && isDowngradeSelected()) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-yellow-800">
                <p className="font-medium mb-1">Important:</p>
                {isIndividual ? (
                  <p>
                    Your selected plan will be applied to your individual account
                    immediately after purchase.
                  </p>
                ) : (
                  <p>
                    All selected licenses will be purchased in a single
                    transaction and added to your organization. You can assign
                    them to specific users from the User Management page.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center mt-6 pt-4 border-t">
          <div className="text-sm text-gray-600">
            {/* Left side text if needed */}
          </div>
          <div className="flex space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={purchasePlansMutation.isPending}
              className="h-8"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handlePurchaseAll}
              disabled={
                totalSeats === 0 ||
                purchasePlansMutation.isPending ||
                isProcessingPayment ||
                hasPendingDowngrade()
              }
              className="h-8 min-w-[140px]"
            >
              {purchasePlansMutation.isPending || isProcessingPayment ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span> Processing...
                </span>
              ) : isDowngradeSelected() ? (
                <span className="whitespace-nowrap text-sm font-semibold flex items-center gap-1">
                  <ArrowDown className="h-3.5 w-3.5" />
                  Schedule Downgrade - ₹{totalPrice.toLocaleString()}
                </span>
              ) : (
                <span className="whitespace-nowrap text-sm font-semibold">
                  Pay ₹{totalPrice.toLocaleString()} (incl. GST)
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Downgrade Warning Modal */}
        <Dialog
          open={showDowngradeWarning}
          onOpenChange={setShowDowngradeWarning}
        >
          <DialogContent className="max-w-md !rounded-sm [&_input:not([type='checkbox']):not([type='radio'])]:!rounded-sm [&_select]:!rounded-sm [&_textarea]:!rounded-sm [&_.form-input]:!rounded-sm [&_.form-select]:!rounded-sm [&_.form-textarea]:!rounded-sm [&_button:not(.rounded-full)]:!rounded-sm [&_table]:!rounded-sm [&_.bg-white.border]:!rounded-sm [&_.rounded-sm]:!rounded-sm [&_.rounded-md]:!rounded-sm [&_.rounded-lg]:!rounded-sm [&_.rounded-xl]:!rounded-sm [&_.rounded-2xl]:!rounded-sm [&_.rounded]:!rounded-sm [&_.rounded-r-lg]:!rounded-r-sm [&_.rounded-r-md]:!rounded-r-sm [&_input]:h-8 [&_input]:min-h-8 [&_input]:max-h-8 [&_input]:py-0 [&_input]:box-border [&_select]:h-8 [&_select]:min-h-8 [&_select]:max-h-8 [&_select]:py-0 [&_select]:box-border [&_.form-input]:h-8 [&_.form-select]:h-8">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-orange-600">
                <span className="text-2xl">⚠️</span>
                Downgrade Warning
              </DialogTitle>
              <DialogDescription>
                You cannot downgrade to{" "}
                <strong>{downgradeWarningData?.plan}</strong> because you are
                currently using more resources than this plan allows.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 mt-4">
              <p className="text-sm text-gray-700 font-medium">
                Current usage exceeds the following limits:
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                {downgradeWarningData?.warnings?.map((warning, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    <span className="text-red-600 mt-0.5">•</span>
                    <div>
                      <span className="font-medium text-gray-900">
                        {warning.feature}:
                      </span>
                      <span className="text-gray-700 ml-1">
                        You have <strong>{warning.current}</strong>{" "}
                        {warning.feature.toLowerCase()}, but the plan allows
                        only <strong>{warning.limit}</strong>.
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-sm text-gray-600 mt-3">
                To downgrade, please reduce your usage below the plan limits or
                choose a higher-tier plan.
              </p>
            </div>

            <div className="flex justify-end mt-6">
              <Button
                variant="primary"
                onClick={() => setShowDowngradeWarning(false)}
                className="h-8"
              >
                Got it
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
