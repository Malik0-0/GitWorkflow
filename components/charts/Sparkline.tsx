// components/charts/Sparkline.tsx
"use client";
import { ResponsiveContainer, AreaChart, Area } from "recharts";

type Props = { data: { month: string; count: number }[] };

export default function Sparkline({ data }: Props) {
  const sorted = [...data].reverse();

  return (
    <div className="w-full h-16">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={sorted}>
          <defs>
            <linearGradient id="spark_grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} fill="url(#spark_grad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}