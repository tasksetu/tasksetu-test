import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Star, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * PlanCard - Plan selection, billing cycle toggle, upgrade/downgrade confirmation modal
 */
export default function PlanCard({
  plan,
  planKey,
  billingCycle,
  isCurrentPlan,
  isPopular = false,
  onSelect,
  loading = false,
  disabled = false,
  className
}) {
  const price = billingCycle === 'yearly' ? plan.price.yearly : plan.price.monthly;
  const monthlyPrice = billingCycle === 'yearly' ? Math.round(plan.price.yearly / 12) : plan.price.monthly;
  const isFree = price === 0;

  const getButtonText = () => {
    if (isCurrentPlan) return 'Current Plan';
    if (isFree) return 'Get Started Free';
    return 'Select Plan';
  };

  const getButtonVariant = () => {
    if (isCurrentPlan) return 'secondary';
    if (isPopular) return 'default';
    return 'outline';
  };

  return (
    <Card className={cn(
      'relative transition-all duration-200 hover:shadow-lg',
      isCurrentPlan && 'ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/20',
      isPopular && !isCurrentPlan && 'ring-2 ring-purple-500 scale-105',
      disabled && 'opacity-50',
      className
    )} data-testid={`plan-card-${planKey}`}>

      {/* Popular badge */}
      {isPopular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <Badge className="bg-purple-600 text-white px-3 py-1 flex items-center space-x-1" data-testid="popular-badge">
            <Star className="h-3 w-3" />
            <span>Most Popular</span>
          </Badge>
        </div>
      )}

      {/* Current plan badge */}
      {isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <Badge className="bg-blue-600 text-white px-3 py-1 flex items-center space-x-1" data-testid="current-plan-badge">
            <Check className="h-3 w-3" />
            <span>Active Plan</span>
          </Badge>
        </div>
      )}

      <CardHeader className="text-center pb-2">
        <CardTitle className="flex items-center justify-center space-x-2">
          <span data-testid={`plan-name-${planKey}`}>{plan.name}</span>
          {planKey === 'enterprise' && <Zap className="h-4 w-4 text-yellow-500" />}
        </CardTitle>

        {/* Pricing */}
        <div className="py-4">
          {isFree ? (
            <div className="text-3xl font-bold text-gray-900 dark:text-white" data-testid={`plan-price-${planKey}`}>
              Free
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-3xl font-bold text-gray-900 dark:text-white" data-testid={`plan-price-${planKey}`}>
                ${price}
                <span className="text-lg font-normal text-gray-500">
                  /{billingCycle === 'yearly' ? 'year' : 'month'}
                </span>
              </div>
              {billingCycle === 'yearly' && (
                <div className="text-sm text-gray-500" data-testid={`monthly-equiv-${planKey}`}>
                  ${monthlyPrice}/month billed annually
                </div>
              )}
            </div>
          )}
        </div>

        <CardDescription className="text-center" data-testid={`plan-description-${planKey}`}>
          Perfect for {planKey === 'explore' ? 'trying out TaskSetu' :
            planKey === 'starter' ? 'small teams' :
              planKey === 'professional' ? 'growing businesses' :
                'large enterprises'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Limits */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300">What's included:</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(plan.limits).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between" data-testid={`limit-${key}-${planKey}`}>
                <span className="capitalize text-gray-600 dark:text-gray-400">{key}:</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Features:</h4>
          <ul className="space-y-1">
            {plan.features.map((feature, index) => (
              <li key={index} className="flex items-start space-x-2 text-sm" data-testid={`feature-${index}-${planKey}`}>
                <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-600 dark:text-gray-400">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>

      <CardFooter>
        <Button
          className="w-full"
          variant={getButtonVariant()}
          onClick={() => onSelect(planKey)}
          disabled={disabled || loading || isCurrentPlan}
          data-testid={`select-plan-${planKey}`}
        >
          {loading ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              <span>Processing...</span>
            </div>
          ) : (
            getButtonText()
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}