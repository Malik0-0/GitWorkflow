// components/charts/MoodLineChart.tsx
"use client";

import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type Point = {
  date: string;
  avgMoodScore: number | null;
  entries?: number;
};

type Props = {
  data: Point[];
};

/**
 * Custom tick renderer that displays weekday short on top, and DD/MM below.
 * Recharts will pass {x, y, payload} props.
 */
function CustomXAxisTick(props: any) {
  const { x, y, payload } = props;
  // payload.value is expected to be the date string
  let weekday = "";
  let dayMonth = "";
  try {
    const d = new Date(payload.value);
    if (!isNaN(d.getTime())) {
      // weekday short in user's locale (e.g. "Wed")
      weekday = d.toLocaleDateString(undefined, { weekday: "short" });
      // dd/mm format
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      dayMonth = `${dd}/${mm}`;
    } else {
      weekday = payload.value;
    }
  } catch {
    weekday = payload.value;
  }

  // position the two texts stacked, centered on the tick (text-anchor middle)
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={16} textAnchor="middle" fill="#94a3b8" style={{ fontSize: 12 }}>
        {weekday}
      </text>
      <text x={0} y={32} textAnchor="middle" fill="#94a3b8" style={{ fontSize: 12 }}>
        {dayMonth}
      </text>
    </g>
  );
}

export default function MoodLineChart({ data }: Props) {
  // defensive: copy & sort by date ascending
  const sorted = React.useMemo(() => {
    return [...(data || [])].sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      return da - db;
    });
  }, [data]);

  // Recharts works best with numeric y values; map null -> undefined
  const chartData = sorted.map((p) => ({
    date: p.date,
    avgMoodScore: p.avgMoodScore == null ? undefined : p.avgMoodScore,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.05)" />
        <XAxis
          dataKey="date"
          tick={<CustomXAxisTick />}
          interval="preserveStartEnd"
          height={48}
        />
        <YAxis domain={[1, 10]} allowDecimals={true} tickCount={7}/>
        <Tooltip
          formatter={(value: any) => (value == null ? "-" : String(value))}
          labelFormatter={(label: any) => {
            try {
              const d = new Date(label);
              return d.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
            } catch {
              return label;
            }
          }}
        />
        <Line
          type="monotone"
          dataKey="avgMoodScore"
          stroke="#F59E0B" /* amber-500 */
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
          strokeWidth={2}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}