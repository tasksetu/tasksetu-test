import React from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * BillingToggle - Monthly/Yearly billing toggle with savings percentage label
 */
export default function BillingToggle({
  billingCycle,
  onToggle,
  savingsPercentage,
  disabled = false,
  className,
}) {
  const isYearly = billingCycle === "yearly";

  return (
    <div
      className={cn(
        "flex items-center justify-center space-x-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-sm",
        className,
      )}
    >
      {/* Monthly Label */}
      <span
        className={cn(
          "text-sm font-medium transition-colors",
          !isYearly
            ? "text-blue-600 dark:text-blue-400"
            : "text-gray-500 dark:text-gray-400",
        )}
        data-testid="billing-monthly-label"
      >
        Monthly
      </span>

      {/* Toggle Switch */}
      <div className="relative">
        <Switch
          checked={isYearly}
          onCheckedChange={() => onToggle(isYearly ? "monthly" : "yearly")}
          disabled={disabled}
          className="data-[state=checked]:bg-blue-600"
          data-testid="billing-toggle-switch"
        />
      </div>

      {/* Yearly Label with Savings Badge */}
      <div className="flex items-center space-x-2">
        <span
          className={cn(
            "text-sm font-medium transition-colors",
            isYearly
              ? "text-blue-600 dark:text-blue-400"
              : "text-gray-500 dark:text-gray-400",
          )}
          data-testid="billing-yearly-label"
        >
          Yearly
        </span>

        {savingsPercentage > 0 && (
          <Badge
            variant="secondary"
            className="bg-green-100 text-green-800 text-xs px-2 py-1"
            data-testid="savings-badge"
          >
            Save {savingsPercentage}%
          </Badge>
        )}
      </div>

      {/* Additional info text */}
      <div className="text-xs text-gray-500 dark:text-gray-400 ml-4">
        {isYearly ? (
          <span data-testid="yearly-info">Billed annually</span>
        ) : (
          <span data-testid="monthly-info">Billed monthly</span>
        )}
      </div>
    </div>
  );
}
