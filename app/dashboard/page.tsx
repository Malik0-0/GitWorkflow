// app/dashboard/page.tsx
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import prisma from "@/lib/prisma";
import { getSessionToken } from "@/lib/auth";
import { computeDashboardStatsForUser } from "@/lib/dashboardStats";
import RawPreviewCard from "@/components/RawPreviewCard";
// import Sparkline from "@/components/charts/Sparkline";
// import MoodLineChart from "@/components/charts/MoodLineChart";
// import MoodDonut from "@/components/charts/MoodDonut";
// import StreakCalendar from "@/components/charts/StreakCalendar";
import { format, parseISO } from "date-fns";

async function getCurrentPrismaUser() {
  const token = await getSessionToken();
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  if (!data?.user) return null;
  return prisma.user.findUnique({ where: { supabaseId: data.user.id } });
}

export default async function DashboardPage() {
  const user = await getCurrentPrismaUser();
  if (!user) return redirect("/login");

  let stats: any = null;
  try {
    const userAgain = await getCurrentPrismaUser();
    if (!userAgain) return redirect("/login");
    stats = await computeDashboardStatsForUser(userAgain.id);
  } catch (err) {
    console.error("fetch stats failed", err);
    stats = null;
  }

  // latest 6 notes (tidied + raw) by **createdAt**, not by display day
  const allEntries = stats?.allEntries ?? [];
  const latest6 = allEntries
    .slice()
    .sort((a: any, b: any) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return tb - ta;
    })
    .slice(0, 9);

  let savedInsightForCurrentWeek: any = null;
  const currentWeekStartISO =
    stats?.weeklyInsightStub?.startWeek ?? format(new Date(), "yyyy-MM-dd");

  try {
    savedInsightForCurrentWeek = await prisma.weeklyInsight.findFirst({
      where: { userId: user.id, weekStart: currentWeekStartISO },
      select: {
        id: true,
        shortSummary: true,
        content: true,
        generatedAt: true,
        weekStart: true,
      },
    });
  } catch (e) {
    console.warn("Could not load saved weekly insight:", (e as Error).message);
  }

  const displayWeekStart =
    savedInsightForCurrentWeek?.weekStart ??
    stats?.weeklyInsightStub?.startWeek ??
    currentWeekStartISO ??
    "—";

  const displayWeekRange = (() => {
    try {
      const start = parseISO(stats?.weeklyInsightStub?.startWeek ?? displayWeekStart);
      const end = parseISO(stats?.weeklyInsightStub?.endWeek ?? displayWeekStart);
      return `${format(start, "dd/MM")} – ${format(end, "dd/MM")}`;
    } catch {
      return displayWeekStart;
    }
  })();

  const displayShortSummary =
    savedInsightForCurrentWeek?.shortSummary ??
    stats?.currentWeek?.shortSummary ??
    "No insight yet";

  function resolveMostMood(): string | null {
    if (stats?.currentWeek?.mostMood) return stats.currentWeek.mostMood;

    try {
      if (savedInsightForCurrentWeek?.content) {
        const parsed = JSON.parse(savedInsightForCurrentWeek.content as any);
        if (parsed?.moodSummary?.mostMood) return parsed.moodSummary.mostMood;
      }
    } catch {
      // ignore
    }

    return stats?.weeklyInsightStub?.mostFrequentMood ?? null;
  }

  function mostMoodEmoji() {
    const mostMood = resolveMostMood();
    if (!mostMood) return "😶";
    const m = mostMood.toString().toLowerCase();
    if (m.includes("happy") || m.includes("joy")) return "😄";
    if (m.includes("sad") || m.includes("down")) return "😢";
    if (m.includes("angry") || m.includes("frustrat")) return "😠";
    if (m.includes("calm") || m.includes("relax") || m.includes("content")) return "😊";
    if (m.includes("tired") || m.includes("exhaust")) return "😴";
    return "🙂";
  }

  return (
    <div className="space-y-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
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
          {/* WEEKLY + STATS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Weekly Stats</h3>
            </div>
            {/* WEEKLY INSIGHT HERO */}
            <div className="card p-5 w-full">
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)] gap-4 items-stretch">
                {/* Left: mood + streak card */}
                <div className="flex flex-col justify-between">
                  <div className="inline-flex items-center p-4 border rounded-xl bg-white shadow-sm w-full">
                    <div className="text-3xl mr-3">{mostMoodEmoji()}</div>
                    <div className="text-sm">
                      <div className="text-xs text-slate-500 mb-1">
                        {displayWeekRange}
                      </div>
                      <div className="text-xs text-slate-500">Streak</div>
                      <div className="font-semibold text-lg">
                        {stats?.streak ?? 0}{" "}
                        <span className="text-xs font-normal text-slate-500">
                          day{(stats?.streak ?? 0) === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Most frequent mood
                      </div>
                      <div className="font-medium text-sm">
                        {resolveMostMood() ?? "—"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: short summary + actions */}
                <div className="flex flex-col justify-between">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">
                      Weekly insight
                    </div>
                    <div className="text-lg font-semibold text-justify">
                      {displayShortSummary}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-3">
                    {savedInsightForCurrentWeek ? (
                      <a
                        href={`/insights?weekStart=${displayWeekStart}`}
                        className="btn-secondary"
                      >
                        View report
                      </a>
                    ) : (
                      <a
                        href={`/insights?weekStart=${displayWeekStart}`}
                        className="btn-primary"
                      >
                        Generate insight
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* LATEST NOTES */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Latest notes</h3>
              <a href="/entries" className="btn-secondary text-sm">
                Show all notes
              </a>
            </div>

            {latest6.length === 0 ? (
              <div className="card p-4">
                No entries yet. Start by creating your first note!
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {latest6.map((e: any) => (
                  <RawPreviewCard
                    key={e.id}
                    entry={{
                      id: e.id,
                      titleTidied: e.titleTidied,
                      titleRaw: e.titleRaw,
                      contentTidied: e.contentTidied,
                      contentRaw: e.contentRaw,
                      moodLabel: e.moodLabel,
                      moodScore: e.moodScore,
                      category: e.category,
                      dayDate: e.day,
                      tidiedAt: e.tidiedAt,
                      createdAt: e.createdAt,
                      tidied: e.tidied,
                    }}
                    huge
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}