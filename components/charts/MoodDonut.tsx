// components/charts/MoodDonut.tsx
"use client";
import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

type Props = { data: { name: string; value: number }[] };

const COLORS = [
  "#6BE37E", // joyful/happy
  "#A7E163", // calm
  "#FFD54F", // neutral/tired
  "#FF7A3D", // stressed
  "#FF4D4D", // angry/frustrated
  "#4C6EF5", // sad
  "#9B5DE5", // anxious
  "#94A3B8", // other/default
];

export default function MoodDonut({ data }: Props) {
  if (!data || data.length === 0) return <div className="text-sm text-slate-500">No mood data</div>;

  return (
    <div className="w-full h-48" style={{ minWidth: 0, minHeight: 192 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="80%" paddingAngle={4} labelLine={false}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend verticalAlign="bottom" height={36} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}