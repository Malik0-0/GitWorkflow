// app/api/dashboard/stats/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionToken } from "@/lib/auth";

/**
 * Helper: resolve current Prisma user from session token
 */
async function getCurrentPrismaUser() {
  const token = await getSessionToken();
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return await prisma.user.findUnique({ where: { supabaseId: data.user.id } });
}

/**
 * Return ISO date string (YYYY-MM-DD) for a Date object.
 */
function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * Start of ISO week (Monday) for given date.
 */
function startOfISOWeek(d: Date) {
  const day = d.getUTCDay(); // 0 (Sun) - 6 (Sat)
  // convert to Monday-based: 1 = Monday
  const diff = ((day + 6) % 7); // 0 for Monday, 6 for Sunday
  const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  s.setUTCDate(s.getUTCDate() - diff);
  s.setUTCHours(0, 0, 0, 0);
  return s;
}

/**
 * Return array of last N months (YYYY-MM) starting at current month and going backwards
 */
function lastNMonths(n: number) {
  const now = new Date();
  const res: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    res.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return res;
}

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentPrismaUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userId = user.id;

    // Fetch recent entries (90 days) to compute streaks, last-week, and weekly list
    const now = new Date();
    const past90 = new Date(now);
    past90.setDate(now.getDate() - 90);

    // Query entries for the user in last 90 days (we need dayDate if available, else createdAt)
    const entries = await prisma.entry.findMany({
      where: {
        userId,
        OR: [
          { dayDate: { gte: past90 } },
          { createdAt: { gte: past90 } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    // Normalize each entry to a day string (YYYY-MM-DD) and pick display text
    const norm = entries.map((e) => {
      // dayDate preferred, else createdAt
      const d = (e.dayDate ?? e.createdAt) as Date;
      // If prisma returned string, convert
      const day = (d instanceof Date) ? toISODate(d) : toISODate(new Date(d as any));
      return {
        id: e.id,
        day,
        moodLabel: e.moodLabel ?? null,
        moodScore: e.moodScore ?? null,
        contentTidied: e.contentTidied ?? null,
        contentRaw: e.contentRaw ?? null,
        titleTidied: e.titleTidied ?? null,
        titleRaw: e.titleRaw ?? null,
        tidiedAt: e.tidiedAt ?? null,
      };
    });

    // --- monthly counts (last 6 months)
    const months = lastNMonths(6); // e.g. ["2025-12", "2025-11", ...]
    const entriesByMonth: Record<string, number> = {};
    for (const m of months) entriesByMonth[m] = 0;
    // map entry day -> YYYY-MM
    for (const e of norm) {
      const ym = e.day.slice(0, 7); // YYYY-MM
      if (entriesByMonth[ym] !== undefined) entriesByMonth[ym]++;
    }
    const monthly = months.map((m) => ({ month: m, count: entriesByMonth[m] ?? 0 }));

    // --- current streak: consecutive days ending today with >=1 entry
    // build set of days that have >=1 entry
    const daySet = new Set(norm.map((e) => e.day));
    let streak = 0;
    for (let i = 0; ; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      d.setUTCDate(d.getUTCDate() - i);
      const dayStr = toISODate(d);
      if (daySet.has(dayStr)) streak++;
      else break;
    }

    // --- last 7 days mood summary (mon-sun relative to today, but we'll take last 7 calendar days)
    const last7Days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      d.setUTCDate(d.getUTCDate() - i);
      last7Days.push(toISODate(d));
    }

    // for each day compute:
    // - moodCounts: count of moodLabel occurrences
    // - avgMoodScore (if scores exist)
    const lastWeekMoodSummary: Record<string, { day: string; mostFrequentMood: string | null; avgMoodScore: number | null; entries: number }> = {};
    for (const day of last7Days) {
      const items = norm.filter((e) => e.day === day);
      const moodCounts: Record<string, number> = {};
      let scoreSum = 0;
      let scoreCount = 0;
      for (const it of items) {
        if (it.moodLabel) moodCounts[it.moodLabel] = (moodCounts[it.moodLabel] ?? 0) + 1;
        if (typeof it.moodScore === "number") {
          scoreSum += it.moodScore;
          scoreCount++;
        }
      }
      // most frequent mood
      let most = null;
      let mostCount = 0;
      for (const k of Object.keys(moodCounts)) {
        if (moodCounts[k] > mostCount) {
          most = k;
          mostCount = moodCounts[k];
        }
      }
      lastWeekMoodSummary[day] = {
        day,
        mostFrequentMood: most,
        avgMoodScore: scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 10) / 10 : null,
        entries: items.length,
      };
    }

    // --- this week's prioritized tidied notes (current ISO week)
    const startWeek = startOfISOWeek(now); // Monday start
    const endWeek = new Date(startWeek);
    endWeek.setUTCDate(startWeek.getUTCDate() + 6);
    endWeek.setUTCHours(23, 59, 59, 999);

    // fetch entries for current week (prefer tidied entries first)
    const weekEntries = await prisma.entry.findMany({
      where: {
        userId,
        OR: [
          { dayDate: { gte: startWeek, lte: endWeek } },
          { createdAt: { gte: startWeek, lte: endWeek } },
        ],
      },
      orderBy: [
        // prefer entries with tidiedAt desc (most recently tidied), then createdAt desc
        { tidiedAt: "desc" },
        { createdAt: "desc" },
      ],
      take: 50,
    });

    const prioritized = weekEntries.map((e) => ({
      id: e.id,
      title: e.titleTidied ?? e.titleRaw ?? null,
      snippet: (e.contentTidied ?? e.contentRaw ?? "").slice(0, 200),
      moodLabel: e.moodLabel ?? null,
      moodScore: e.moodScore ?? null,
      dayDate: e.dayDate ? toISODate(e.dayDate as Date) : toISODate(e.createdAt as Date),
      tidied: !!e.tidiedAt,
    }));

    // --- simple weekly insight placeholder (we don't run LLM here; provide aggregated data so client can call LLM if desired)
    // Provide: week index, total entries, most common mood (over week), avg mood score
    const weekMoodCounts: Record<string, number> = {};
    let weekScoreSum = 0;
    let weekScoreCount = 0;
    for (const e of weekEntries) {
      if (e.moodLabel) weekMoodCounts[e.moodLabel] = (weekMoodCounts[e.moodLabel] ?? 0) + 1;
      if (typeof e.moodScore === "number") {
        weekScoreSum += e.moodScore;
        weekScoreCount++;
      }
    }
    let weekMost = null;
    let wc = 0;
    for (const k of Object.keys(weekMoodCounts)) {
      if (weekMoodCounts[k] > wc) {
        weekMost = k;
        wc = weekMoodCounts[k];
      }
    }
    const weeklyInsightStub = {
      startWeek: toISODate(startWeek),
      endWeek: toISODate(endWeek),
      totalEntries: weekEntries.length,
      mostFrequentMood: weekMost,
      avgMoodScore: weekScoreCount > 0 ? Math.round((weekScoreSum / weekScoreCount) * 10) / 10 : null,
      // mood distribution map (label -> count)
      moodDistribution: weekMoodCounts,
    };

    return NextResponse.json({
      monthly, // array [{month: "YYYY-MM", count}]
      streak,
      lastWeekMoodSummary, // map day->summary
      prioritized, // prioritized this-week notes
      weeklyInsightStub,
    });
  } catch (err: any) {
    console.error("dashboard stats error", err);
    return NextResponse.json({ error: err?.message ?? "Failed to compute stats" }, { status: 500 });
  }
}