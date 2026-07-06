import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * DowngradeWarningModal - Warning modal when downgrading with usage warnings
 */
export default function DowngradeWarningModal({
  open,
  onOpenChange,
  currentPlan,
  targetPlan,
  usageWarnings = [],
  onConfirm,
  loading = false,
}) {
  if (!targetPlan) return null;

  const hasWarnings = usageWarnings.length > 0;
  const hasBlockingIssues = usageWarnings.some((w) => w.type === "error");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="downgrade-modal">
        <DialogHeader>
          <div className="flex items-center space-x-3">
            <div
              className={cn(
                "p-2 rounded-full",
                hasBlockingIssues
                  ? "bg-red-100 dark:bg-red-900/20"
                  : "bg-yellow-100 dark:bg-yellow-900/20",
              )}
            >
              <AlertTriangle
                className={cn(
                  "h-6 w-6",
                  hasBlockingIssues ? "text-red-600" : "text-yellow-600",
                )}
              />
            </div>
            <div>
              <DialogTitle
                className="text-xl"
                data-testid="downgrade-modal-title"
              >
                {hasBlockingIssues ? "Cannot Downgrade" : "Confirm Downgrade"}
              </DialogTitle>
              <DialogDescription data-testid="downgrade-description">
                {hasBlockingIssues
                  ? "Your current usage exceeds the limits of the target plan"
                  : `Downgrade from ${currentPlan.name} to ${targetPlan.name}`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {/* Plan Comparison */}
          <div className="bg-gradient-to-r from-gray-50 to-red-50 dark:from-gray-800 dark:to-red-900/20 p-4 rounded-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="text-center">
                <Badge
                  variant="outline"
                  className="mb-2"
                  data-testid="current-plan-badge"
                >
                  Current
                </Badge>
                <div className="font-semibold text-gray-700 dark:text-gray-300">
                  {currentPlan.name}
                </div>
                <div className="text-sm text-gray-500">
                  ${currentPlan.price.monthly}/month
                </div>
              </div>

              <ArrowDown className="h-8 w-8 text-red-500 mx-4" />

              <div className="text-center">
                <Badge
                  className={cn(
                    "mb-2",
                    hasBlockingIssues
                      ? "bg-red-600 text-white"
                      : "bg-gray-600 text-white",
                  )}
                  data-testid="target-plan-badge"
                >
                  {hasBlockingIssues ? "Blocked" : "Target"}
                </Badge>
                <div className="font-semibold text-gray-900 dark:text-white">
                  {targetPlan.name}
                </div>
                <div className="text-sm text-gray-600">
                  ${targetPlan.price.monthly}/month
                </div>
              </div>
            </div>
          </div>

          {/* Warnings */}
          {hasWarnings && (
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                <AlertTriangle
                  className={cn(
                    "h-4 w-4",
                    hasBlockingIssues ? "text-red-600" : "text-yellow-600",
                  )}
                />
                <span>Usage Warnings</span>
              </h4>
              <ul className="space-y-2">
                {usageWarnings.map((warning, index) => (
                  <li
                    key={index}
                    className={cn(
                      "flex items-start space-x-3 p-3 rounded border",
                      warning.type === "error"
                        ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                        : "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800",
                    )}
                    data-testid={`warning-${index}`}
                  >
                    {warning.type === "error" ? (
                      <X className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div
                        className={cn(
                          "font-medium text-sm",
                          warning.type === "error"
                            ? "text-red-800 dark:text-red-200"
                            : "text-yellow-800 dark:text-yellow-200",
                        )}
                      >
                        {warning.feature.charAt(0).toUpperCase() +
                          warning.feature.slice(1)}{" "}
                        Issue
                      </div>
                      <div
                        className={cn(
                          "text-xs",
                          warning.type === "error"
                            ? "text-red-600 dark:text-red-300"
                            : "text-yellow-600 dark:text-yellow-300",
                        )}
                      >
                        {warning.message}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action required for blocking issues */}
          {hasBlockingIssues && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-sm">
              <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                Action Required
              </h4>
              <p className="text-sm text-red-600 dark:text-red-300">
                To downgrade to {targetPlan.name}, please:
              </p>
              <ul className="mt-2 text-sm text-red-600 dark:text-red-300 list-disc list-inside space-y-1">
                {usageWarnings
                  .filter((w) => w.type === "error")
                  .map((warning, index) => (
                    <li key={index} data-testid={`action-required-${index}`}>
                      Reduce your {warning.feature} usage below{" "}
                      {targetPlan.limits[warning.feature]}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Savings display for successful downgrade */}
          {!hasBlockingIssues && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 rounded-sm">
              <div
                className="text-sm text-green-800 dark:text-green-200"
                data-testid="savings-info"
              >
                <strong>Monthly Savings:</strong> $
                {currentPlan.price.monthly - targetPlan.price.monthly}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="space-x-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            data-testid="downgrade-cancel-button"
          >
            Cancel
          </Button>
          {hasBlockingIssues ? (
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="understand-button"
            >
              I Understand
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={loading}
              data-testid="downgrade-confirm-button"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                  <span>Processing...</span>
                </div>
              ) : (
                <>Confirm Downgrade</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
