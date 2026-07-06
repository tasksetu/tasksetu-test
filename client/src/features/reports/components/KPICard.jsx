import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

/**
 * KPI Card Component - Displays key performance indicators
 * Used across all reporting dashboards for summary metrics
 */
const KPICard = ({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  description,
  color = "blue",
  loading = false,
}) => {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    green: "bg-green-50 text-green-600 border-green-200",
    red: "bg-red-50 text-red-600 border-red-200",
    yellow: "bg-yellow-50 text-yellow-600 border-yellow-200",
    purple: "bg-purple-50 text-purple-600 border-purple-200",
    teal: "bg-teal-50 text-teal-600 border-teal-200",
    orange: "bg-orange-50 text-orange-600 border-orange-200",
  };

  if (loading) {
    return (
      <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-2 animate-pulse">
        <div className="flex items-center justify-between mb-2">
          <div className="h-3 bg-gray-200 rounded w-20"></div>
          <div className="h-8 w-8 bg-gray-200 rounded-sm"></div>
        </div>
        <div className="h-6 bg-gray-200 rounded w-16 mb-1"></div>
        <div className="h-3 bg-gray-200 rounded w-32"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-2 hover:shadow-md transition-shadow">
      {/* Header with Title and Icon */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-gray-600">{title}</h3>
        {Icon && (
          <div
            className={`p-1 rounded-sm ${colorClasses[color] || colorClasses.blue}`}
          >
            <Icon size={14} />
          </div>
        )}
      </div>

      {/* Main Value */}
      <div className="mb-0">
        <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
      </div>

      {/* Trend or Description */}
      {trend && trendValue !== undefined && (
        <div className="flex items-center gap-2">
          {trend === "up" ? (
            <TrendingUp size={16} className="text-green-500" />
          ) : (
            <TrendingDown size={16} className="text-red-500" />
          )}
          <span
            className={`text-xs font-medium ${trend === "up" ? "text-green-600" : "text-red-600"}`}
          >
            {trendValue}%
          </span>
          {description && (
            <span className="text-xs text-gray-500">{description}</span>
          )}
        </div>
      )}

      {description && !trend && (
        <p className="text-xs text-gray-500 leading-tight">{description}</p>
      )}
    </div>
  );
};

export default KPICard;
