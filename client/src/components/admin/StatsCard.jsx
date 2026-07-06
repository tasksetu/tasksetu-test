import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatsCard({
  title,
  value,
  change,
  trend = "neutral",
  icon: Icon,
  iconColor = "text-primary",
  className,
}) {
  const trendColors = {
    up: "text-emerald-600 dark:text-emerald-400",
    down: "text-red-600 dark:text-red-400",
    neutral: "text-muted-foreground",
  };

  return (
    <Card className={cn("admin-card", className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
            {change && (
              <p className={cn("text-sm mt-1", trendColors[trend])}>
                {trend === "up" && "↗"}
                {trend === "down" && "↘"}
                {change}
              </p>
            )}
          </div>
          <div
            className={cn(
              "w-12 h-12 rounded-sm flex items-center justify-center",
              iconColor === "text-primary" && "bg-primary/10",
              iconColor === "text-emerald-600" &&
                "bg-emerald-100 dark:bg-emerald-900/20",
              iconColor === "text-blue-600" &&
                "bg-blue-100 dark:bg-blue-900/20",
              iconColor === "text-purple-600" &&
                "bg-purple-100 dark:bg-purple-900/20",
            )}
          >
            <Icon className={cn("w-6 h-6", iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
