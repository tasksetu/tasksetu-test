import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * TrialCountdown - Trial countdown timer for Explore tier
 */
export default function TrialCountdown({
  daysLeft,
  onUpgrade,
  compact = false,
  className,
}) {
  const [timeLeft, setTimeLeft] = useState({
    days: daysLeft,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  // Mock countdown - in real app this would be calculated from actual trial end date
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        } else if (prev.hours > 0) {
          return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        } else if (prev.days > 0) {
          return {
            ...prev,
            days: prev.days - 1,
            hours: 23,
            minutes: 59,
            seconds: 59,
          };
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const isUrgent = timeLeft.days <= 2;
  const isExpired =
    timeLeft.days === 0 &&
    timeLeft.hours === 0 &&
    timeLeft.minutes === 0 &&
    timeLeft.seconds === 0;

  const formatTime = (value) => String(value).padStart(2, "0");

  if (compact) {
    return (
      <Badge
        variant={isUrgent ? "destructive" : "secondary"}
        className={cn("flex items-center space-x-1", className)}
        data-testid="trial-countdown-compact"
      >
        <Clock className="h-3 w-3" />
        <span>
          {timeLeft.days}d {formatTime(timeLeft.hours)}h left
        </span>
      </Badge>
    );
  }

  return (
    <div
      className={cn(
        "p-4 rounded-sm border transition-colors",
        isUrgent
          ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
          : "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800",
        className,
      )}
      data-testid="trial-countdown-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          {isUrgent ? (
            <AlertTriangle
              className="h-5 w-5 text-red-600"
              data-testid="urgent-icon"
            />
          ) : (
            <Clock className="h-5 w-5 text-blue-600" data-testid="clock-icon" />
          )}
          <h3
            className={cn(
              "font-semibold text-sm",
              isUrgent
                ? "text-red-800 dark:text-red-200"
                : "text-blue-800 dark:text-blue-200",
            )}
          >
            {isExpired ? "Trial Expired" : "Trial Ending Soon"}
          </h3>
        </div>

        <Badge
          variant={isUrgent ? "destructive" : "secondary"}
          data-testid="trial-status-badge"
        >
          Explore Plan
        </Badge>
      </div>

      {!isExpired ? (
        <>
          {/* Countdown Display */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { label: "Days", value: timeLeft.days },
              { label: "Hours", value: timeLeft.hours },
              { label: "Minutes", value: timeLeft.minutes },
              { label: "Seconds", value: timeLeft.seconds },
            ].map((unit) => (
              <div
                key={unit.label}
                className="text-center p-2 bg-white dark:bg-gray-800 rounded border"
                data-testid={`countdown-${unit.label.toLowerCase()}`}
              >
                <div
                  className={cn(
                    "text-lg font-bold",
                    isUrgent ? "text-red-600" : "text-blue-600",
                  )}
                >
                  {formatTime(unit.value)}
                </div>
                <div className="text-xs text-gray-500 uppercase">
                  {unit.label}
                </div>
              </div>
            ))}
          </div>

          {/* Message */}
          <p
            className={cn(
              "text-sm mb-3",
              isUrgent
                ? "text-red-700 dark:text-red-300"
                : "text-blue-700 dark:text-blue-300",
            )}
            data-testid="trial-message"
          >
            {isUrgent
              ? "Your trial is expiring soon! Upgrade now to continue using all features."
              : "Your free trial includes access to all features. Upgrade anytime to continue after the trial."}
          </p>
        </>
      ) : (
        <p
          className="text-sm text-red-700 dark:text-red-300 mb-3"
          data-testid="expired-message"
        >
          Your trial has expired. Upgrade now to restore access to all features.
        </p>
      )}

      {/* Action Button */}
      <Button
        onClick={onUpgrade}
        className={cn(
          "w-full",
          isUrgent
            ? "bg-red-600 hover:bg-red-700 text-white"
            : "bg-blue-600 hover:bg-blue-700 text-white",
        )}
        data-testid="upgrade-trial-button"
      >
        {isExpired ? "Upgrade Now" : "Upgrade Before Trial Ends"}
      </Button>
    </div>
  );
}
