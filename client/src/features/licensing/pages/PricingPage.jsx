import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Zap, Star, ArrowRight, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import useLicensing from '../hooks/useLicensing';
import BillingToggle from '../components/BillingToggle';
import PlanCard from '../components/PlanCard';
import { PLAN_ORDER, getOrderedPlanEntries, getOrderedPlanKeys } from '@/utils/licenseConstants';

/**
 * Pricing & Plans Page - Public marketing site view with plan comparison
 */
export default function PricingPage() {
  const {
    billingCycle,
    plans,
    setBillingCycle,
    getSavingsPercentage,
    currentPlan: currentPlanKey
  } = useLicensing();

  const [selectedPlan, setSelectedPlan] = useState(null);

  const handleSelectPlan = (planKey) => {
    setSelectedPlan(planKey);
    // In a real app, this would redirect to signup/payment flow
    console.log(`Selected plan: ${planKey}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900" data-testid="pricing-page">
      <div className="container mx-auto px-6 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="flex justify-center mb-3">
            <Badge className="bg-blue-100 text-blue-800 px-4 py-2" data-testid="pricing-hero-badge">
              <Zap className="h-4 w-4 mr-2" />
              Flexible Pricing
            </Badge>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-3" data-testid="pricing-hero-title">
            Choose the Perfect Plan
            <br />
            for Your <span className="text-blue-600">Team</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto" data-testid="pricing-hero-description">
            Start with our free plan and scale as you grow. All plans include our core task management features
            with advanced capabilities for larger teams.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-12">
          <BillingToggle
            billingCycle={billingCycle}
            onToggle={setBillingCycle}
            savingsPercentage={getSavingsPercentage()}
            className="max-w-md"
            data-testid="pricing-billing-toggle"
          />
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {getOrderedPlanEntries(plans).map(([planKey, plan]) => (
            <PlanCard
              key={planKey}
              plan={plan}
              planKey={planKey}
              billingCycle={billingCycle}
              isCurrentPlan={planKey === currentPlanKey}
              isPopular={planKey === 'professional'}
              onSelect={handleSelectPlan}
              className={cn(
                'h-full transition-all duration-200',
                planKey === 'professional' && 'md:scale-105 md:shadow-xl'
              )}
              data-testid={`pricing-plan-${planKey}`}
            />
          ))}
        </div>

        {/* Feature Comparison Table */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-7 mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3" data-testid="comparison-title">
              Feature Comparison
            </h2>
            <p className="text-gray-600 dark:text-gray-400" data-testid="comparison-description">
              See what's included in each plan
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-4 px-6 font-semibold text-gray-900 dark:text-white">Features</th>
                  {getOrderedPlanEntries(plans).map(([planKey, plan]) => (
                    <th key={planKey} className="text-center py-4 px-6">
                      <div className="font-semibold text-gray-900 dark:text-white" data-testid={`comparison-plan-${planKey}`}>
                        {plan.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        ${plan.price[billingCycle]}{billingCycle === 'yearly' ? '/yr' : '/mo'}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Limits */}
                {Object.keys(plans.starter.limits).map((limitKey) => (
                  <tr key={limitKey} className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-4 px-6 font-medium text-gray-900 dark:text-white capitalize" data-testid={`comparison-feature-${limitKey}`}>
                      {limitKey}
                    </td>
                    {getOrderedPlanEntries(plans).map(([planKey, plan]) => (
                      <td key={planKey} className="text-center py-4 px-6" data-testid={`comparison-${planKey}-${limitKey}`}>
                        <span className="font-medium">{plan.limits[limitKey]}</span>
                      </td>
                    ))}
                  </tr>
                ))}

                {/* Sample Features */}
                {[
                  'Task Management',
                  'Team Collaboration',
                  'File Attachments',
                  'Email Support',
                  'Priority Support',
                  'Advanced Analytics',
                  'API Access',
                  'Custom Integrations',
                  'SSO Integration',
                  'Dedicated Support'
                ].map((feature, index) => {
                  const getFeatureAvailability = (planKey) => {
                    switch (feature) {
                      case 'Task Management':
                      case 'File Attachments':
                        return true;
                      case 'Team Collaboration':
                        return planKey !== 'explore';
                      case 'Email Support':
                        return true;
                      case 'Priority Support':
                        return ['starter', 'professional', 'enterprise'].includes(planKey);
                      case 'Advanced Analytics':
                        return ['professional', 'enterprise'].includes(planKey);
                      case 'API Access':
                      case 'Custom Integrations':
                        return ['professional', 'enterprise'].includes(planKey);
                      case 'SSO Integration':
                      case 'Dedicated Support':
                        return planKey === 'enterprise';
                      default:
                        return false;
                    }
                  };

                  return (
                    <tr key={feature} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="py-4 px-6 font-medium text-gray-900 dark:text-white" data-testid={`comparison-feature-${feature.toLowerCase().replace(' ', '-')}`}>
                        {feature}
                      </td>
                      {getOrderedPlanKeys(plans).map((planKey) => (
                        <td key={planKey} className="text-center py-4 px-6" data-testid={`comparison-${planKey}-${feature.toLowerCase().replace(' ', '-')}`}>
                          {getFeatureAvailability(planKey) ? (
                            <Check className="h-5 w-5 text-green-500 mx-auto" />
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8" data-testid="faq-title">
            Frequently Asked Questions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[
              {
                question: "Can I change plans anytime?",
                answer: "Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately."
              },
              {
                question: "What happens to my data if I downgrade?",
                answer: "Your data is always safe. If you exceed limits after downgrading, you'll need to reduce usage to continue."
              },
              {
                question: "Do you offer discounts for nonprofits?",
                answer: "Yes, we offer special pricing for qualified nonprofits and educational institutions. Contact us for details."
              },
              {
                question: "Is there a setup fee?",
                answer: "No setup fees, ever. You only pay the monthly or annual subscription fee."
              }
            ].map((faq, index) => (
              <Card key={index} className="text-left" data-testid={`faq-${index}`}>
                <CardHeader>
                  <CardTitle className="text-lg text-gray-900 dark:text-white">
                    {faq.question}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 dark:text-gray-400">
                    {faq.answer}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <Card className="max-w-2xl mx-auto bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0" data-testid="cta-section">
            <CardHeader>
              <CardTitle className="text-3xl font-bold mb-3">
                Ready to Get Started?
              </CardTitle>
              <CardDescription className="text-blue-100 text-lg">
                Join thousands of teams already using TaskSetu to boost their productivity
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  size="lg"
                  className="bg-white text-blue-600 hover:bg-blue-50 font-semibold px-8"
                  onClick={() => handleSelectPlan('explore')}
                  data-testid="cta-free-trial-button"
                >
                  Start Free Trial
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white text-white hover:bg-white hover:text-blue-600 px-8"
                  data-testid="cta-contact-sales-button"
                >
                  Contact Sales
                </Button>
              </div>

              <div className="flex items-center justify-center space-x-3 text-blue-100 text-sm">
                <div className="flex items-center space-x-2">
                  <Check className="h-4 w-4" />
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Shield className="h-4 w-4" />
                  <span>Cancel anytime</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}