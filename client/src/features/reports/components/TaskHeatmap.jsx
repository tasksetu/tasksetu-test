import React from "react";

/**
 * Heatmap Component - Shows density or intensity of tasks
 * Used for: Risk distribution, due date density, department performance
 */
const TaskHeatmap = ({
  data = [],
  title,
  loading = false,
  colorScale = {
    low: "#dcfce7",
    medium: "#fef3c7",
    high: "#fee2e2",
    critical: "#fecaca",
  },
}) => {
  if (loading) {
    return (
      <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-4">
        {title && (
          <h3 className="text-lg font-semibold text-gray-800 mb-3">{title}</h3>
        )}
        <div className="animate-pulse">
          <div className="grid grid-cols-5 gap-2">
            {[...Array(15)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-4">
        {title && (
          <h3 className="text-lg font-semibold text-gray-800 mb-3">{title}</h3>
        )}
        <div className="flex items-center justify-center h-64 text-gray-400">
          <p>No data available</p>
        </div>
      </div>
    );
  }

  const getColorByIntensity = (value, max) => {
    const percentage = (value / max) * 100;
    if (percentage === 0) return "#f9fafb";
    if (percentage < 25) return colorScale.low;
    if (percentage < 50) return colorScale.medium;
    if (percentage < 75) return colorScale.high;
    return colorScale.critical;
  };

  const maxValue = Math.max(...data.map((item) => item.value || 0));

  return (
    <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-4">
      {title && (
        <h3 className="text-lg font-semibold text-gray-800 mb-3">{title}</h3>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {data.map((item, index) => (
          <div
            key={index}
            className="relative p-4 rounded-sm border-2 transition-all hover:shadow-md cursor-pointer"
            style={{
              backgroundColor: getColorByIntensity(item.value, maxValue),
              borderColor: item.value > maxValue * 0.75 ? "#ef4444" : "#e5e7eb",
            }}
          >
            <div
              className="text-sm font-medium text-gray-700 mb-1 truncate"
              title={item.label}
            >
              {item.label}
            </div>
            <div className="text-2xl font-bold text-gray-900">{item.value}</div>
            {item.subtitle && (
              <div className="text-xs text-gray-500 mt-1">{item.subtitle}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaskHeatmap;
