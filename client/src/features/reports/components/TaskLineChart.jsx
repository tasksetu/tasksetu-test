import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

/**
 * Calculate the difference in days between two dates
 */
const getDaysDifference = (startDate, endDate) => {
  const diffTime = Math.abs(endDate - startDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Format date based on range
 * - Within 7 days: Show day names (Mon, Tue, etc.)
 * - 8-30 days: Show dates (Jan 1, Jan 8, etc.)
 * - 31-90 days: Show week ranges (Week 1, Week 2, etc.)
 * - 90+ days: Show months (Jan, Feb, etc.)
 */
const formatXAxisByRange = (dateStr, dataLength, dateRange) => {
  if (!dateStr) return "";

  const date = new Date(dateStr);

  // Within a week - show day names
  if (dateRange <= 7) {
    return date.toLocaleDateString("en-US", { weekday: "short" }); // Mon, Tue, Wed
  }

  // 8-30 days - show dates
  if (dateRange <= 30) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }); // Jan 1, Jan 8
  }

  // 31-90 days - show week numbers or abbreviated dates
  if (dateRange <= 90) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }); // Jan 1, Feb 1
  }

  // 90+ days - show months
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" }); // Jan '24
};

/**
 * Calculate tick interval based on data length and range
 */
const getTickInterval = (dataLength, dateRange) => {
  // Within a week - show all days
  if (dateRange <= 7) return 0;

  // 8-30 days - show every 3-5 days
  if (dateRange <= 30) return Math.floor(dataLength / 6);

  // 31-90 days - show every week
  if (dateRange <= 90) return Math.floor(dataLength / 8);

  // 90+ days - show every 2-3 weeks
  return Math.floor(dataLength / 6);
};

/**
 * Line Chart Component - Shows trends over time
 * Used for: Task completion trends, productivity metrics
 * Auto-adjusts x-axis based on date range
 */
const TaskLineChart = ({
  data = [],
  xKey = "date",
  lines = [],
  title,
  height = 300,
  loading = false,
}) => {
  const defaultLines = [
    { key: "completed", color: "#10b981", name: "Completed" },
  ];

  const linesToRender = lines.length > 0 ? lines : defaultLines;

  // Calculate date range from data
  let dateRange = 0;
  if (data && data.length > 1) {
    const dates = data.map((d) => new Date(d[xKey])).filter((d) => !isNaN(d));
    if (dates.length > 1) {
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));
      dateRange = getDaysDifference(minDate, maxDate);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-4">
        {title && (
          <h3 className="text-lg font-semibold text-gray-800 mb-3">{title}</h3>
        )}
        <div className="animate-pulse">
          <div className="h-64 bg-gray-200 rounded"></div>
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

  const tickInterval = getTickInterval(data.length, dateRange);

  return (
    <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-4">
      {title && (
        <h3 className="text-lg font-semibold text-gray-800 mb-3">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 12 }}
            stroke="#9ca3af"
            interval={tickInterval}
            tickFormatter={(value) =>
              formatXAxisByRange(value, data.length, dateRange)
            }
          />
          <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            }}
            labelFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString("en-US", {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
              });
            }}
          />
          <Legend wrapperStyle={{ paddingTop: "20px" }} iconType="line" />
          {linesToRender.map((line, index) => (
            <Line
              key={line.key || index}
              type="monotone"
              dataKey={line.key}
              stroke={line.color}
              strokeWidth={2}
              name={line.name}
              dot={{ fill: line.color, r: 4 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TaskLineChart;
