import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Shield,
  Calendar,
  Users,
  FileText,
  BarChart3,
  Workflow,
  AlertTriangle,
  Crown,
  Check,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const LicenseManagement = () => {
  const [billingPeriod, setBillingPeriod] = useState('yearly');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current user and role
  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/me']
  });

  // Get license information
  const { data: licenseData, isLoading } = useQuery({
    queryKey: ['/api/organization/license'],
    refetchInterval: 60000 // Refresh every minute
  });

  // Get usage statistics
  const { data: usageData } = useQuery({
    queryKey: ['/api/organization/usage'],
    refetchInterval: 60000
  });

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'company_admin';

  const plans = [
    {
      id: 'explore',
      name: 'Explore (Free)',
      description: 'Perfect for trying out Tasksetu',
      monthlyPrice: 0,
      yearlyPrice: 0,
      features: [
        '5 Tasks per month',
        '2 Forms',
        '1 Process',
        '5 Reports',
        'Basic Support'
      ],
      limits: {
        tasks: 5,
        forms: 2,
        processes: 1,
        reports: 5
      },
      recommended: false,
      trial: true,
      trialDays: null // ✅ Matches database EXPLORE trial duration
    },
    {
      id: 'plan',
      name: 'Plan',
      description: 'For small teams getting organized',
      monthlyPrice: 19,
      yearlyPrice: 190,
      features: [
        '100 Tasks per month',
        '10 Forms',
        '5 Processes',
        '25 Reports',
        'Email Support',
        'Basic Analytics'
      ],
      limits: {
        tasks: 100,
        forms: 10,
        processes: 5,
        reports: 25
      },
      recommended: false
    },
    {
      id: 'execute',
      name: 'Execute',
      description: 'For growing teams that need more power',
      monthlyPrice: 49,
      yearlyPrice: 490,
      features: [
        '500 Tasks per month',
        '50 Forms',
        '25 Processes',
        '100 Reports',
        'Priority Support',
        'Advanced Analytics',
        'Custom Workflows'
      ],
      limits: {
        tasks: 500,
        forms: 50,
        processes: 25,
        reports: 100
      },
      recommended: true
    },
    {
      id: 'optimize',
      name: 'Optimize',
      description: 'For large organizations with complex needs',
      monthlyPrice: 99,
      yearlyPrice: 990,
      features: [
        'Unlimited Tasks',
        'Unlimited Forms',
        'Unlimited Processes',
        'Unlimited Reports',
        '24/7 Support',
        'Custom Integration',
        'Dedicated Account Manager'
      ],
      limits: {
        tasks: -1, // -1 means unlimited
        forms: -1,
        processes: -1,
        reports: -1
      },
      recommended: false
    }
  ];

  const currentPlan = plans.find(plan => plan.id === licenseData?.planId) || plans[0];

  const calculateDaysUntilExpiry = () => {
    if (!licenseData?.expiryDate) return 0;
    const expiry = new Date(licenseData.expiryDate);
    const now = new Date();
    const timeDiff = expiry.getTime() - now.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  };

  const daysUntilExpiry = calculateDaysUntilExpiry();
  const isExpired = daysUntilExpiry <= 0;
  const isExpiringSoon = daysUntilExpiry <= 7 && daysUntilExpiry > 0;

  const getUsagePercentage = (used, limit) => {
    if (limit === -1) return 0; // Unlimited
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const upgradeMutation = useMutation({
    mutationFn: async ({ planId, billingPeriod }) => {
      const response = await fetch('/api/organization/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ planId, billingPeriod })
      });

      if (!response.ok) {
        throw new Error('Failed to upgrade plan');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Plan Upgraded Successfully!',
        description: 'Your new plan is now active.',
        variant: 'default'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/organization/license'] });
    },
    onError: (error) => {
      toast({
        title: 'Upgrade Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const renewMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/organization/renew', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to renew license');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'License Renewed Successfully!',
        description: 'Your license has been extended.',
        variant: 'default'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/organization/license'] });
    },
    onError: (error) => {
      toast({
        title: 'Renewal Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleUpgrade = (planId) => {
    if (!isAdmin) return;
    upgradeMutation.mutate({ planId, billingPeriod });
  };

  const handleRenew = () => {
    if (!isAdmin) return;
    renewMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">License Management</h1>
          <p className="text-gray-600 mt-1">Manage your subscription and monitor usage</p>
        </div>
        <Badge variant={isExpired ? 'destructive' : isExpiringSoon ? 'secondary' : 'default'}>
          <Shield className="w-4 h-4 mr-1" />
          {currentPlan.name}
        </Badge>
      </div>

      {/* Expiry Warning Banner */}
      {(isExpired || isExpiringSoon) && (
        <Alert variant={isExpired ? 'destructive' : 'default'} className="border-l-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {isExpired ? (
              <span>
                Your license has expired! Upgrade now to continue using all features.
                {isAdmin && (
                  <Button
                    variant="link"
                    className="ml-2 p-0 h-auto text-red-600"
                    onClick={handleRenew}
                  >
                    Renew Now
                  </Button>
                )}
              </span>
            ) : (
              <span>
                Your license expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}!
                {isAdmin && (
                  <Button
                    variant="link"
                    className="ml-2 p-0 h-auto"
                    onClick={handleRenew}
                  >
                    Renew Now
                  </Button>
                )}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Current License Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            Current License Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <div className="text-sm text-gray-500">Current Plan</div>
              <div className="text-xl font-semibold">{currentPlan.name}</div>
              {currentPlan.trial && (
                <Badge variant="secondary" className="mt-1">Trial</Badge>
              )}
            </div>
            <div>
              <div className="text-sm text-gray-500">Expiry Date</div>
              <div className="text-xl font-semibold flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                {licenseData?.expiryDate ?
                  new Date(licenseData.expiryDate).toLocaleDateString() :
                  'N/A'
                }
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Next Renewal</div>
              <div className="text-xl font-semibold">
                {licenseData?.renewalDate ?
                  new Date(licenseData.renewalDate).toLocaleDateString() :
                  'Manual'
                }
              </div>
            </div>
          </div>

          {/* Usage Meters */}
          <div>
            <h3 className="text-lg font-medium mb-3">Usage Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Tasks Usage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FileText className="w-4 h-4 mr-2" />
                    <span className="text-sm font-medium">Tasks Created</span>
                    <Info className="w-3 h-3 ml-1 text-gray-400" />
                  </div>
                  <span className="text-sm text-gray-600">
                    {usageData?.tasks || 0}
                    {currentPlan.limits.tasks === -1 ? '' : ` / ${currentPlan.limits.tasks}`}
                  </span>
                </div>
                <Progress
                  value={getUsagePercentage(usageData?.tasks || 0, currentPlan.limits.tasks)}
                  className="h-2"
                />
                <div className="text-xs text-gray-500">
                  {currentPlan.limits.tasks === -1 ? 'Unlimited' :
                    `${getUsagePercentage(usageData?.tasks || 0, currentPlan.limits.tasks).toFixed(1)}% used`
                  }
                </div>
              </div>

              {/* Forms Usage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Users className="w-4 h-4 mr-2" />
                    <span className="text-sm font-medium">Forms Created</span>
                    <Info className="w-3 h-3 ml-1 text-gray-400" />
                  </div>
                  <span className="text-sm text-gray-600">
                    {usageData?.forms || 0}
                    {currentPlan.limits.forms === -1 ? '' : ` / ${currentPlan.limits.forms}`}
                  </span>
                </div>
                <Progress
                  value={getUsagePercentage(usageData?.forms || 0, currentPlan.limits.forms)}
                  className="h-2"
                />
                <div className="text-xs text-gray-500">
                  {currentPlan.limits.forms === -1 ? 'Unlimited' :
                    `${getUsagePercentage(usageData?.forms || 0, currentPlan.limits.forms).toFixed(1)}% used`
                  }
                </div>
              </div>

              {/* Processes Usage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Workflow className="w-4 h-4 mr-2" />
                    <span className="text-sm font-medium">Processes Created</span>
                    <Info className="w-3 h-3 ml-1 text-gray-400" />
                  </div>
                  <span className="text-sm text-gray-600">
                    {usageData?.processes || 0}
                    {currentPlan.limits.processes === -1 ? '' : ` / ${currentPlan.limits.processes}`}
                  </span>
                </div>
                <Progress
                  value={getUsagePercentage(usageData?.processes || 0, currentPlan.limits.processes)}
                  className="h-2"
                />
                <div className="text-xs text-gray-500">
                  {currentPlan.limits.processes === -1 ? 'Unlimited' :
                    `${getUsagePercentage(usageData?.processes || 0, currentPlan.limits.processes).toFixed(1)}% used`
                  }
                </div>
              </div>

              {/* Reports Usage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    <span className="text-sm font-medium">Reports Generated</span>
                    <Info className="w-3 h-3 ml-1 text-gray-400" />
                  </div>
                  <span className="text-sm text-gray-600">
                    {usageData?.reports || 0}
                    {currentPlan.limits.reports === -1 ? '' : ` / ${currentPlan.limits.reports}`}
                  </span>
                </div>
                <Progress
                  value={getUsagePercentage(usageData?.reports || 0, currentPlan.limits.reports)}
                  className="h-2"
                />
                <div className="text-xs text-gray-500">
                  {currentPlan.limits.reports === -1 ? 'Unlimited' :
                    `${getUsagePercentage(usageData?.reports || 0, currentPlan.limits.reports).toFixed(1)}% used`
                  }
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan Selection */}
      {isAdmin && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Available Plans</h2>
            <div className="flex items-center space-x-2">
              <span className={`text-sm ${billingPeriod === 'monthly' ? 'font-semibold' : ''}`}>
                Monthly
              </span>
              <button
                className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${billingPeriod === 'yearly' ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
              </button>
              <span className={`text-sm ${billingPeriod === 'yearly' ? 'font-semibold' : ''}`}>
                Yearly
              </span>
              {billingPeriod === 'yearly' && (
                <Badge variant="secondary" className="ml-2">Save 16%</Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`relative ${plan.recommended ? 'ring-2 ring-blue-500' : ''} ${currentPlan.id === plan.id ? 'bg-blue-50 border-blue-200' : ''
                  }`}
              >
                {plan.recommended && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-blue-600 text-white">
                      <Crown className="w-3 h-3 mr-1" />
                      Most Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-3xl font-bold">
                      ${billingPeriod === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice}
                    </span>
                    <span className="text-gray-500">
                      /{billingPeriod === 'yearly' ? 'year' : 'month'}
                    </span>
                  </div>
                  {billingPeriod === 'yearly' && plan.monthlyPrice > 0 && (
                    <div className="text-sm text-gray-500">
                      ${(plan.yearlyPrice / 12).toFixed(2)}/month billed annually
                    </div>
                  )}
                </CardHeader>

                <CardContent className="space-y-3">
                  <ul className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center text-sm">
                        <Check className="w-4 h-4 mr-2 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={currentPlan.id === plan.id ? 'secondary' : 'default'}
                    disabled={currentPlan.id === plan.id || upgradeMutation.isPending}
                    onClick={() => handleUpgrade(plan.id)}
                  >
                    {currentPlan.id === plan.id ? 'Your Current Plan' : 'Select Plan'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Read-only info for non-admins */}
      {!isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Plan Information</CardTitle>
            <CardDescription>
              Contact your administrator to upgrade or modify your organization's plan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>You don't have permission to manage licenses.</p>
              <p>Contact your administrator for plan changes.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LicenseManagement;