import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useLocation } from 'wouter';
import {
    Crown,
    Check,
    AlertCircle,
    TrendingUp,
    CreditCard,
    Gift,
    X,
    Loader2,
    ShieldCheck,
    Zap,
    Users,
    Database,
    CheckSquare,
    FileText,
    Workflow,
    BarChart3,
    ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserRole } from '../../../utils/auth';
import { useToast } from '@/hooks/use-toast';
import { PLAN_ORDER } from '@/utils/licenseConstants';

/**
 * Upgrade/Purchase Page - Allows admins to upgrade their plan
 * Implements Module 2.1.x specification
 */
export default function UpgradePage() {
    const [billingCycle, setBillingCycle] = useState('monthly');
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [couponCode, setCouponCode] = useState('');
    const [couponError, setCouponError] = useState('');
    const [couponSuccess, setCouponSuccess] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [downgradeWarning, setDowngradeWarning] = useState(null);
    const [, setLocation] = useLocation();

    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { user, isAdmin } = useUserRole();

    // Role-based access
    const isPrimaryAdmin = user?.isPrimaryAdmin === true || user?.user?.isPrimaryAdmin === true;
    const userRoles = Array.isArray(user?.role) ? user?.role : user?.role ? [user.role] : [];
    const isOrgAdmin = userRoles.includes('org_admin');
    const isIndividualAdmin = userRoles.includes('individual');

    // Check access - only Company Admin, Individual Admin, or Tasksetu Admin
    const hasUpgradeAccess = isPrimaryAdmin || isIndividualAdmin;

    // Fetch current subscription
    const { data: subscriptionResponse, isLoading: subscriptionLoading } = useQuery({
        queryKey: ['/api/license/organization/subscription'],
        queryFn: async () => {
            const response = await fetch('/api/license/organization/subscription', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
            });
            if (!response.ok) throw new Error('Failed to fetch subscription');
            return response.json();
        },
    });

    // Fetch current usage for downgrade validation
    const { data: usageResponse } = useQuery({
        queryKey: ['/api/license/organization/features'],
        queryFn: async () => {
            const response = await fetch('/api/license/organization/features', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
            });
            if (!response.ok) throw new Error('Failed to fetch usage');
            return response.json();
        },
    });

    // Fetch available plans
    const { data: plansResponse, isLoading: plansLoading } = useQuery({
        queryKey: ['/api/license/licenses'],
        queryFn: async () => {
            const response = await fetch('/api/license/licenses', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
            });
            if (!response.ok) throw new Error('Failed to fetch plans');
            return response.json();
        },
    });

    const subscriptionData = subscriptionResponse?.subscription;
    const currentPlanName = subscriptionData?.license_details?.name || subscriptionData?.current_license || 'Explore';
    const currentBillingCycle = subscriptionData?.billing_cycle?.toLowerCase() || 'monthly';
    const usageData = usageResponse?.usage || {};

    // Transform plans data
    const plans = useMemo(() => {
        if (!plansResponse?.licenses) return [];
        return plansResponse.licenses
            .filter(plan => plan && (plan.license_name || plan.license_code)) // Filter out invalid plans
            .map(plan => ({
                key: (plan.license_code?.toLowerCase() || plan.license_name?.toLowerCase() || 'unknown'),
                name: plan.license_name || plan.license_code || 'Unknown Plan',
                code: plan.license_code || plan.license_name,
                price: {
                    monthly: plan.price_monthly || 0,
                    yearly: plan.price_yearly || plan.price_monthly * 10 || 0,
                },
                features: plan.features || [],
                limits: {
                    tasks: plan.features?.find(f => f.feature_code === 'TASK_BASIC')?.usage_limit || 0,
                    forms: plan.features?.find(f => f.feature_code === 'FORM_CREATE')?.usage_limit || 0,
                    processes: plan.features?.find(f => f.feature_code === 'PROC_CREATE')?.usage_limit || 0,
                    reports: plan.features?.find(f => f.feature_code === 'REPORT_BASIC')?.usage_limit || 0,
                },
            }));
    }, [plansResponse]);

    // Get feature highlights for each plan
    const getFeatureHighlights = (planKey) => {
        const highlights = {
            explore: [
                'Perfect for trying out TaskSetu',
                'Basic task management (10 tasks)',
                '2 custom forms',
                '1 process workflow',
                '5 reports per month',
            ],
            plan: [
                'For growing teams',
                'Up to 100 tasks',
                '10 custom forms',
                '5 process workflows',
                '25 reports per month',
                'Email support',
            ],
            execute: [
                'For established teams',
                'Up to 500 tasks',
                '50 custom forms',
                '25 process workflows',
                '100 reports per month',
                'Priority support',
                'Advanced analytics',
            ],
            optimize: [
                'For large enterprises',
                'Unlimited tasks',
                'Unlimited forms',
                'Unlimited processes',
                'Unlimited reports',
                'Dedicated support',
                'Custom integrations',
                'SLA guarantee',
            ],
        };
        return highlights[planKey] || [];
    };

    // Calculate savings for yearly billing
    const calculateSavings = (plan) => {
        const monthlyTotal = plan.price.monthly * 12;
        const yearlyPrice = plan.price.yearly;
        const savings = monthlyTotal - yearlyPrice;
        const percentage = Math.round((savings / monthlyTotal) * 100);
        return { savings, percentage };
    };

    // Apply coupon code
    const handleApplyCoupon = async () => {
        if (!couponCode.trim()) {
            setCouponError('Please enter a coupon code');
            return;
        }

        setCouponError('');
        setCouponSuccess('');

        try {
            const response = await fetch('/api/license/validate-coupon', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code: couponCode }),
            });

            if (!response.ok) {
                const error = await response.json();
                setCouponError(error.message || 'Invalid coupon code');
                setAppliedCoupon(null);
                return;
            }

            const data = await response.json();
            setAppliedCoupon(data.coupon);
            setCouponSuccess(`Coupon applied! ${data.coupon.discount}% off`);
            setCouponError('');
        } catch (error) {
            setCouponError('Failed to validate coupon. Please try again.');
            setAppliedCoupon(null);
        }
    };

    // Validate downgrade
    const validateDowngrade = (targetPlan) => {
        const currentPlanIndex = PLAN_ORDER.indexOf(
            currentPlanName.toLowerCase()
        );
        const targetPlanIndex = PLAN_ORDER.indexOf(
            targetPlan.key
        );

        // Check if it's a downgrade
        if (targetPlanIndex >= currentPlanIndex) {
            return null; // Not a downgrade or same plan
        }

        // Check usage against new limits
        const currentUsage = {
            tasks: usageData.TASK_BASIC || 0,
            forms: usageData.FORM_CREATE || 0,
            processes: usageData.PROC_CREATE || 0,
            reports: usageData.REPORT_BASIC || 0,
        };

        const exceedingLimits = [];
        Object.keys(currentUsage).forEach(key => {
            if (targetPlan.limits[key] !== -1 && currentUsage[key] > targetPlan.limits[key]) {
                exceedingLimits.push({
                    feature: key,
                    current: currentUsage[key],
                    limit: targetPlan.limits[key],
                });
            }
        });

        if (exceedingLimits.length > 0) {
            return exceedingLimits;
        }

        return null;
    };

    // Handle plan selection
    const handleSelectPlan = (plan) => {
        const warnings = validateDowngrade(plan);

        if (warnings) {
            setDowngradeWarning({
                plan: plan.name,
                warnings,
            });
            return;
        }

        setSelectedPlan(plan);
        setDowngradeWarning(null);
    };

    // Proceed to payment
    const handleProceedToPayment = async () => {
        if (!selectedPlan) {
            toast({
                title: 'No Plan Selected',
                description: 'Please select a plan to continue',
                variant: 'destructive',
            });
            return;
        }

        setIsProcessing(true);

        try {
            const response = await fetch('/api/license/create-payment-session', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    plan: selectedPlan.code,
                    billingCycle,
                    couponCode: appliedCoupon?.code || null,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create payment session');
            }

            const { sessionId, paymentUrl } = await response.json();

            // Redirect to payment gateway
            window.location.href = paymentUrl;
        } catch (error) {
            toast({
                title: 'Payment Error',
                description: error.message || 'Failed to initiate payment. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsProcessing(false);
        }
    };

    // Access control
    if (!hasUpgradeAccess) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="pt-6 text-center">
                        <div className="p-3 bg-red-100 rounded-xl w-fit mx-auto mb-3">
                            <AlertCircle className="h-12 w-12 text-red-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            Access Restricted
                        </h2>
                        <p className="text-gray-600 mb-3">
                            Only Company Admins and Individual Admins can upgrade plans.
                        </p>
                        <Button onClick={() => setLocation('/dashboard')} variant="outline">
                            Return to Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Loading state
    if (plansLoading || subscriptionLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-3" />
                    <p className="text-gray-600">Loading plans...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto p-4 space-y-3">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center mb-3">
                        <div className="p-3 bg-blue-100 rounded-xl">
                            <Crown className="h-10 w-10 text-blue-600" />
                        </div>
                    </div>
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">
                        Upgrade Your Plan
                    </h1>
                    <p className="text-xl text-gray-600">
                        Choose a plan that scales with your needs
                    </p>
                </div>

                {/* Current Plan Summary */}
                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-blue-700 mb-1">Current Plan</p>
                                <h3 className="text-2xl font-bold text-blue-900">{currentPlanName}</h3>
                                <p className="text-sm text-blue-700 mt-1">
                                    Billed {currentBillingCycle === 'yearly' ? 'annually' : 'monthly'}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-blue-700 mb-1">Current Price</p>
                                <div className="text-3xl font-bold text-blue-900">
                                    ₹{subscriptionData?.license_details?.price_monthly || 0}
                                </div>
                                <p className="text-sm text-blue-700">
                                    per {currentBillingCycle === 'yearly' ? 'year' : 'month'}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Billing Cycle Toggle */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-center space-x-3">
                            <span className={cn(
                                'text-lg font-medium transition-colors',
                                billingCycle === 'monthly' ? 'text-blue-600' : 'text-gray-500'
                            )}>
                                Monthly
                            </span>
                            <Switch
                                checked={billingCycle === 'yearly'}
                                onCheckedChange={(checked) => setBillingCycle(checked ? 'yearly' : 'monthly')}
                                className="data-[state=checked]:bg-blue-600"
                            />
                            <span className={cn(
                                'text-lg font-medium transition-colors',
                                billingCycle === 'yearly' ? 'text-blue-600' : 'text-gray-500'
                            )}>
                                Yearly
                            </span>
                            {billingCycle === 'yearly' && (
                                <Badge className="bg-green-100 text-green-700 border-green-300 ml-2">
                                    <Gift className="w-3 h-3 mr-1" />
                                    Save up to 20%
                                </Badge>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Downgrade Warning Modal */}
                {downgradeWarning && (
                    <Alert className="border-orange-300 bg-orange-50">
                        <AlertCircle className="h-5 w-5 text-orange-600" />
                        <AlertDescription>
                            <div className="space-y-2">
                                <p className="font-semibold text-orange-900">
                                    Cannot downgrade to {downgradeWarning.plan}
                                </p>
                                <p className="text-orange-800">
                                    Your current usage exceeds the limits of this plan:
                                </p>
                                <ul className="list-disc list-inside text-orange-800 space-y-1">
                                    {downgradeWarning.warnings.map((warning, idx) => (
                                        <li key={idx}>
                                            You have <strong>{warning.current}</strong> {warning.feature}, but {downgradeWarning.plan} allows only <strong>{warning.limit}</strong>.
                                        </li>
                                    ))}
                                </ul>
                                <p className="text-orange-800 mt-2">
                                    Please reduce your usage or choose a higher plan.
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-3"
                                    onClick={() => setDowngradeWarning(null)}
                                >
                                    <X className="w-4 h-4 mr-2" />
                                    Close
                                </Button>
                            </div>
                        </AlertDescription>
                    </Alert>
                )}

                {/* Plan Selection Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {plans.filter(plan => plan.key !== 'explore').map((plan) => {
                        const isCurrentPlan = plan?.name?.toLowerCase() === currentPlanName?.toLowerCase();
                        const isSelected = selectedPlan?.key === plan.key;
                        const price = billingCycle === 'yearly' ? plan.price.yearly : plan.price.monthly;
                        const savings = billingCycle === 'yearly' ? calculateSavings(plan) : null;

                        return (
                            <Card
                                key={plan.key}
                                className={cn(
                                    'relative transition-all hover:shadow-xl',
                                    isSelected && 'ring-2 ring-blue-500 shadow-xl',
                                    isCurrentPlan && 'border-blue-300 bg-blue-50'
                                )}
                            >
                                {plan.key === 'execute' && (
                                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-0">
                                        <Crown className="w-3 h-3 mr-1" />
                                        Most Popular
                                    </Badge>
                                )}

                                <CardHeader>
                                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                                    <CardDescription>
                                        <div className="mt-4">
                                            <div className="flex items-baseline">
                                                <span className="text-4xl font-bold text-gray-900">
                                                    ₹{price}
                                                </span>
                                                <span className="text-gray-600 ml-2">
                                                    /{billingCycle === 'yearly' ? 'year' : 'month'}
                                                </span>
                                            </div>
                                            {savings && (
                                                <div className="mt-2 text-sm text-green-600 font-medium">
                                                    Save ₹{savings.savings}/year ({savings.percentage}% off)
                                                </div>
                                            )}
                                        </div>
                                    </CardDescription>
                                </CardHeader>

                                <CardContent className="space-y-3">
                                    <ul className="space-y-3">
                                        {getFeatureHighlights(plan.key).map((feature, idx) => (
                                            <li key={idx} className="flex items-start text-sm">
                                                <Check className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    <Button
                                        className={cn(
                                            'w-full',
                                            isCurrentPlan && 'bg-gray-400 cursor-not-allowed',
                                            isSelected && 'bg-blue-700',
                                            !isCurrentPlan && !isSelected && 'bg-blue-600 hover:bg-blue-700'
                                        )}
                                        onClick={() => !isCurrentPlan && handleSelectPlan(plan)}
                                        disabled={isCurrentPlan}
                                    >
                                        {isCurrentPlan ? (
                                            <>
                                                <Check className="w-4 h-4 mr-2" />
                                                Current Plan
                                            </>
                                        ) : isSelected ? (
                                            <>
                                                <CheckSquare className="w-4 h-4 mr-2" />
                                                Selected
                                            </>
                                        ) : (
                                            <>
                                                <TrendingUp className="w-4 h-4 mr-2" />
                                                Select Plan
                                            </>
                                        )}
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* Coupon Code Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <Gift className="w-5 h-5 mr-2 text-blue-600" />
                            Have a Coupon Code?
                        </CardTitle>
                        <CardDescription>
                            Enter your promo code to get a discount
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex space-x-2 max-w-md">
                            <div className="flex-1">
                                <Input
                                    placeholder="Enter coupon code"
                                    value={couponCode}
                                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                    disabled={!!appliedCoupon}
                                />
                            </div>
                            <Button
                                variant="outline"
                                onClick={handleApplyCoupon}
                                disabled={!!appliedCoupon || !couponCode.trim()}
                            >
                                {appliedCoupon ? 'Applied' : 'Apply'}
                            </Button>
                            {appliedCoupon && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                        setAppliedCoupon(null);
                                        setCouponCode('');
                                        setCouponSuccess('');
                                    }}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                        {couponError && (
                            <p className="text-sm text-red-600 mt-2 flex items-center">
                                <AlertCircle className="w-4 h-4 mr-1" />
                                {couponError}
                            </p>
                        )}
                        {couponSuccess && (
                            <p className="text-sm text-green-600 mt-2 flex items-center">
                                <Check className="w-4 h-4 mr-1" />
                                {couponSuccess}
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Proceed to Payment Button */}
                <Card className="sticky bottom-6 shadow-2xl">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 mb-1">Selected Plan</p>
                                <p className="text-xl font-bold text-gray-900">
                                    {selectedPlan ? selectedPlan.name : 'None selected'}
                                </p>
                                {selectedPlan && (
                                    <p className="text-sm text-gray-600 mt-1">
                                        ₹{billingCycle === 'yearly' ? selectedPlan.price.yearly : selectedPlan.price.monthly}
                                        {appliedCoupon && ` - ${appliedCoupon.discount}% off`}
                                    </p>
                                )}
                            </div>
                            <Button
                                size="lg"
                                className="bg-blue-600 hover:bg-blue-700 text-white px-8"
                                onClick={handleProceedToPayment}
                                disabled={!selectedPlan || isProcessing}
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        Proceed to Payment
                                        <ChevronRight className="w-5 h-5 ml-2" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Security Badge */}
                <div className="text-center py-6">
                    <div className="flex items-center justify-center space-x-2 text-gray-600">
                        <ShieldCheck className="w-5 h-5" />
                        <span className="text-sm">
                            Secure payment powered by Stripe • All transactions are encrypted
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
