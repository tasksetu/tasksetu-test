import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

/**
 * Bar Chart Component - Shows comparative data
 * Used for: Workload distribution, team comparison, user task counts
 */
const TaskBarChart = ({
  data = [],
  xKey = "name",
  bars = [],
  title,
  height = 300,
  loading = false,
  horizontal = false,
}) => {
  const defaultBars = [{ key: "tasks", color: "#3b82f6", name: "Tasks" }];

  const barsToRender = bars.length > 0 ? bars : defaultBars;

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

  return (
    <div className="bg-white rounded-sm shadow-sm border border-gray-200 p-4">
      {title && (
        <h3 className="text-lg font-semibold text-gray-800 mb-3">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          {horizontal ? (
            <>
              <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis
                dataKey={xKey}
                type="category"
                tick={{ fontSize: 12 }}
                stroke="#9ca3af"
                width={100}
              />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
            </>
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            }}
          />
          <Legend wrapperStyle={{ paddingTop: "20px" }} iconType="rect" />
          {barsToRender.map((bar, index) => (
            <Bar
              key={bar.key || index}
              dataKey={bar.key}
              fill={bar.color}
              name={bar.name}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TaskBarChart;
