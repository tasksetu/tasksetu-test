import React from "react";

/**
 * Reusable dynamic sparkline for KPI cards.
 * Renders either a smooth line/area chart or a mini bar chart
 * dynamically based on actual 7-day data.
 */
const KpiSparkline = ({
  type = "bars", // "bars" | "line" | "wave"
  data = [0, 0, 0, 0, 0, 0, 0],
  color = "#3b82f6",
  gradientId = "spark-grad",
  className = "",
}) => {
  // Ensure we have 7 items
  const points = Array.isArray(data) && data.length > 0 ? data : [0, 0, 0, 0, 0, 0, 0];
  const safeData = points.slice(0, 7);
  while (safeData.length < 7) safeData.unshift(0);

  const maxVal = Math.max(...safeData, 0);
  const isAllZero = maxVal === 0;

  if (type === "bars") {
    return (
      <svg
        viewBox="0 0 110 38"
        width="100%"
        height="38"
        preserveAspectRatio="none"
        className={className}
      >
        {safeData.map((val, i) => {
          const height = isAllZero
            ? 3
            : val > 0
              ? Math.max(5, Math.round((val / maxVal) * 28))
              : 3;
          const y = 36 - height;
          const opacity = isAllZero
            ? 0.18
            : val > 0
              ? 0.35 + (val / maxVal) * 0.65
              : 0.12;

          return (
            <rect
              key={i}
              x={i * 15 + 4}
              y={y}
              width="9"
              height={height}
              rx="2"
              fill={color}
              opacity={opacity}
            />
          );
        })}
      </svg>
    );
  }

  // "line" or "wave"
  if (isAllZero) {
    return (
      <svg
        viewBox="0 0 110 38"
        width="100%"
        height="38"
        preserveAspectRatio="none"
        className={className}
      >
        <line
          x1="2"
          y1="32"
          x2="108"
          y2="32"
          stroke={color}
          strokeWidth="1.6"
          strokeOpacity="0.22"
          strokeDasharray="4 3"
        />
        <circle cx="106" cy="32" r="2.5" fill={color} fillOpacity="0.35" />
      </svg>
    );
  }

  // Calculate coordinates for the 7 points
  const coords = safeData.map((val, i) => {
    const x = i * (100 / 6) + 5;
    const y = 32 - (val / maxVal) * 26;
    return { x, y };
  });

  // Construct smooth cubic Bezier path
  let pathD = `M ${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const cpx1 = prev.x + (curr.x - prev.x) / 2;
    const cpy1 = prev.y;
    const cpx2 = prev.x + (curr.x - prev.x) / 2;
    const cpy2 = curr.y;
    pathD += ` C ${cpx1.toFixed(1)},${cpy1.toFixed(1)} ${cpx2.toFixed(1)},${cpy2.toFixed(1)} ${curr.x.toFixed(1)},${curr.y.toFixed(1)}`;
  }

  const fillD = `${pathD} L ${coords[coords.length - 1].x.toFixed(1)},38 L ${coords[0].x.toFixed(1)},38 Z`;

  return (
    <svg
      viewBox="0 0 110 38"
      width="100%"
      height="38"
      preserveAspectRatio="none"
      className={className}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={fillD} fill={`url(#${gradientId})`} />
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={coords[coords.length - 1].x.toFixed(1)}
        cy={coords[coords.length - 1].y.toFixed(1)}
        r="2.5"
        fill={color}
      />
    </svg>
  );
};

export default KpiSparkline;
