// app/insights/page.tsx
"use client";

import { JSX } from "react";
import { startOfWeek, format } from "date-fns";
import { useSearchParams } from "next/navigation";
import WeeklyInsightReport from "@/components/WeeklyInsightReport";

export default function InsightsPage(): JSX.Element {
  const now = new Date();
  const monday = startOfWeek(now, { weekStartsOn: 1 });
  const weekStartISO = format(monday, "yyyy-MM-dd");

  const searchParams = useSearchParams();
  const qsWeekStart = searchParams?.get("weekStart") ?? weekStartISO;

  return (
    <div className="py-6 space-y-6">
      <h1 className="text-2xl font-bold">Weekly Insights</h1>
      <WeeklyInsightReport weekStart={qsWeekStart} />
    </div>
  );
}