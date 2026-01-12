// app/calendar/page.tsx
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import prisma from "@/lib/prisma";
import { getSessionToken } from "@/lib/auth";
import { computeDashboardStatsForUser } from "@/lib/dashboardStats";
import StreakCalendar from "@/components/charts/StreakCalendar";
import MoodDonut from "@/components/charts/MoodDonut";
import MoodLineChart from "@/components/charts/MoodLineChart";

async function getCurrentPrismaUser() {
  const token = await getSessionToken();
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  if (!data?.user) return null;
  return prisma.user.findUnique({ where: { supabaseId: data.user.id } });
}

export default async function CalendarPage() {
  const user = await getCurrentPrismaUser();
  if (!user) return redirect("/login");

  let stats: any = null;
  try {
    stats = await computeDashboardStatsForUser(user.id);
  } catch (err) {
    console.error("fetch stats failed (calendar)", err);
    stats = null;
  }

  // same logic as dashboard for the donut
  const moodDistribution = (() => {
    const entriesThisWeek: any[] = [
      ...(stats?.currentWeek?.tidiedEntries ?? []),
      ...(stats?.currentWeek?.rawEntries ?? []),
    ];
    if (!entriesThisWeek || entriesThisWeek.length === 0) return [];
    const freq: Record<string, number> = {};
    for (const e of entriesThisWeek) {
      if (e.moodLabel) freq[e.moodLabel] = (freq[e.moodLabel] || 0) + 1;
    }
    return Object.entries(freq).map(([name, value]) => ({ name, value }));
  })();

  return (
    <div className="space-y-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Activity & stats</h1>
        <div>
          <a href="/entries/new" className="btn-primary">
            New entry
          </a>
        </div>
      </div>

      {!stats ? (
        <div className="card p-6">Failed to load stats.</div>
      ) : (
        <>
          {/* 3 bottom stat cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Entries (sparkline-ish summary) */}
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-500">
                    Entries (last 3 months)
                  </div>
                  <div className="mt-2 text-2xl font-semibold">
                    {stats.monthlyCounts.reduce(
                      (s: number, m: any) => s + m.count,
                      0,
                    )}
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-500 mt-3 space-y-1">
                {stats.monthlyCounts.map((m: any) => (
                  <div
                    key={m.month}
                    className="flex items-center justify-between"
                  >
                    <div>{m.month}</div>
                    <div>{m.count}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Week mood donut */}
            <div className="card p-4">
              <div className="text-sm text-slate-500">
                This week mood mix
              </div>
              <div className="mt-3 h-40">
                <MoodDonut data={moodDistribution} />
              </div>
            </div>

            {/* Last 7 days line chart */}
            <div className="card p-4">
              <div className="text-sm text-slate-500">
                Mood score (last 7 days)
              </div>
              <div className="mt-3 h-40">
                <MoodLineChart data={stats.last7Days} />
              </div>
            </div>
          </div>
          
          {/* Calendar */}
          <div className="card p-4">
            <StreakCalendar stats={stats.calendarDays ?? []} />
          </div>
        </>
      )}
    </div>
  );
}
