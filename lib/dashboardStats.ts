// lib/dashboardStats.ts
import prisma from "@/lib/prisma";

/** Return ISO date string (YYYY-MM-DD) for a Date object. */
function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Start of ISO week (Monday) for given date. */
function startOfISOWeek(d: Date) {
  const day = d.getUTCDay(); // 0 (Sun) - 6 (Sat)
  const diff = (day + 6) % 7; // 0 for Monday
  const s = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  s.setUTCDate(s.getUTCDate() - diff);
  s.setUTCHours(0, 0, 0, 0);
  return s;
}

/** Return array of last N months (YYYY-MM) starting at current month and going backwards */
function lastNMonths(n: number) {
  const now = new Date();
  const res: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)
    );
    res.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
    );
  }
  return res;
}

/** Determine if an entry should be considered fully tidied.
 *  Rule: tidiedAt must be present AND the main tidied fields must be present.
 */
function isFullyTidied(e: any) {
  return (
    !!e.tidiedAt &&
    !!(e.titleTidied ?? null) &&
    !!(e.contentTidied ?? null) &&
    !!(e.moodLabel ?? null) &&
    typeof e.moodScore === "number" &&
    !Number.isNaN(e.moodScore) &&
    !!(e.category ?? null)
  );
}

/** Compute dashboard stats for a user id. */
export async function computeDashboardStatsForUser(userId: string) {
  const now = new Date();
  const past90 = new Date(now);
  past90.setDate(now.getDate() - 90);

  const entries = await prisma.entry.findMany({
    where: {
      userId,
      OR: [{ dayDate: { gte: past90 } }, { createdAt: { gte: past90 } }],
    },
    orderBy: { createdAt: "desc" },
  });

  const norm = entries.map((e) => {
    // "day" = context day shown in UI (dayDate or createdAt)
    const contextD = (e.dayDate ?? e.createdAt) as Date;
    const day =
      contextD instanceof Date
        ? toISODate(contextD)
        : toISODate(new Date(contextD as any));

    // "activityDay" = actual writing day, always from createdAt (Duolingo-style streak)
    const created = e.createdAt as Date;
    const activityDay =
      created instanceof Date
        ? toISODate(created)
        : toISODate(new Date(created as any));

    return {
      id: e.id,
      day, // context date for charts/calendar coloring
      activityDay, // REAL writing date for streaks
      moodLabel: e.moodLabel ?? null,
      moodScore: e.moodScore ?? null,
      contentTidied: e.contentTidied ?? null,
      contentRaw: e.contentRaw ?? null,
      titleTidied: e.titleTidied ?? null,
      titleRaw: e.titleRaw ?? null,
      tidiedAt: e.tidiedAt ?? null,
      createdAt: e.createdAt,
      dayDate: e.dayDate ?? null,
      category: e.category ?? null,
    };
  });

  // --- day aggregates (for calendar + last7) --------------------
  const dayAgg: Record<
    string,
    {
      entries: number;
      moodCounts: Record<string, number>;
      scoreSum: number;
      scoreCount: number;
    }
  > = {};

  for (const e of norm) {
    const day = e.day;
    if (!dayAgg[day]) {
      dayAgg[day] = {
        entries: 0,
        moodCounts: {},
        scoreSum: 0,
        scoreCount: 0,
      };
    }
    const a = dayAgg[day];
    a.entries += 1;
    if (e.moodLabel) {
      a.moodCounts[e.moodLabel] = (a.moodCounts[e.moodLabel] ?? 0) + 1;
    }
    if (typeof e.moodScore === "number") {
      a.scoreSum += e.moodScore;
      a.scoreCount += 1;
    }
  }

  // --- monthly counts (last 3 months) ---------------------------
  const months = lastNMonths(3);
  const entriesByMonth: Record<string, number> = {};
  for (const m of months) entriesByMonth[m] = 0;
  for (const e of norm) {
    const ym = e.day.slice(0, 7);
    if (entriesByMonth[ym] !== undefined) entriesByMonth[ym]++;
  }
  const monthly = months.map((m) => ({ month: m, count: entriesByMonth[m] ?? 0 }));

  // --- Duolingo-style streaks based on createdAt (activityDay) ---

  // all unique activity days
  const activityDaySet = new Set(norm.map((e) => e.activityDay));
  const activityDays = Array.from(activityDaySet).sort(); // ascending YYYY-MM-DD

  const todayUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const todayStr = toISODate(todayUTC);

  let currentStreak = 0; // only the chain that ends today
  const allStreakDays = new Set<string>(); // every day that belongs to any streak chain historically

  if (activityDays.length > 0) {
    let runStart = 0;

    for (let i = 1; i <= activityDays.length; i++) {
      const prev = activityDays[i - 1];
      const cur = activityDays[i];

      let isContiguous = false;
      if (cur) {
        const prevDate = new Date(prev + "T00:00:00Z");
        const curDate = new Date(cur + "T00:00:00Z");
        const diffDays =
          (curDate.getTime() - prevDate.getTime()) / 86_400_000; // ms in a day
        isContiguous = diffDays === 1;
      }

      if (!isContiguous) {
        // commit previous run [runStart, i)
        const segment = activityDays.slice(runStart, i);
        if (segment.length > 0) {
          // mark all days in this segment as "streak days" historically
          for (const d of segment) allStreakDays.add(d);

          // if this segment ends today, that's the current streak
          if (segment[segment.length - 1] === todayStr) {
            currentStreak = segment.length;
          }
        }
        runStart = i; // start new run
      }
    }
  }

  // Map streak days (by createdAt) to calendar display days.
  // We only mark fire if the context day == activityDay (no fake streak for backfilled days).
  const streakDisplayDays = new Set<string>();
  for (const e of norm) {
    if (allStreakDays.has(e.activityDay) && e.activityDay === e.day) {
      streakDisplayDays.add(e.day);
    }
  }

  // --- last 7 days mood summary (by context day) ----------------
  const last7Days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    d.setUTCDate(d.getUTCDate() - i);
    last7Days.push(toISODate(d));
  }

  const lastWeekMoodSummary: Record<
    string,
    {
      day: string;
      mostFrequentMood: string | null;
      avgMoodScore: number | null;
      entries: number;
    }
  > = {};

  for (const day of last7Days) {
    const agg = dayAgg[day];
    if (!agg) {
      lastWeekMoodSummary[day] = {
        day,
        mostFrequentMood: null,
        avgMoodScore: null,
        entries: 0,
      };
      continue;
    }

    const moodCounts = agg.moodCounts;
    let most: string | null = null;
    let mostCount = 0;
    for (const k of Object.keys(moodCounts)) {
      if (moodCounts[k] > mostCount) {
        most = k;
        mostCount = moodCounts[k];
      }
    }
    const avg =
      agg.scoreCount > 0
        ? Math.round((agg.scoreSum / agg.scoreCount) * 10) / 10
        : null;

    lastWeekMoodSummary[day] = {
      day,
      mostFrequentMood: most,
      avgMoodScore: avg,
      entries: agg.entries,
    };
  }

  // --- this week's prioritized entries (for insight) ------------
  const startWeek = startOfISOWeek(now);
  const endWeek = new Date(startWeek);
  endWeek.setUTCDate(startWeek.getUTCDate() + 6);
  endWeek.setUTCHours(23, 59, 59, 999);

  const weekEntries = await prisma.entry.findMany({
    where: {
      userId,
      OR: [
        { dayDate: { gte: startWeek, lte: endWeek } },
        { createdAt: { gte: startWeek, lte: endWeek } },
      ],
    },
    orderBy: [{ tidiedAt: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  const mappedWeekEntries = weekEntries.map((e) => ({
    id: e.id,
    titleTidied: e.titleTidied ?? null,
    titleRaw: e.titleRaw ?? null,
    contentTidied: e.contentTidied ?? null,
    contentRaw: e.contentRaw ?? null,
    moodLabel: e.moodLabel ?? null,
    moodScore: e.moodScore ?? null,
    category: e.category ?? null,
    dayDate: e.dayDate
      ? toISODate(e.dayDate as Date)
      : toISODate(e.createdAt as Date),
    tidiedAt: e.tidiedAt ?? null,
    createdAt: e.createdAt,
  }));

  const tidiedEntries = mappedWeekEntries.filter((e) => isFullyTidied(e));
  const rawEntries = mappedWeekEntries.filter((e) => !isFullyTidied(e));

  const prioritizedTidied = tidiedEntries
    .slice()
    .sort((a, b) => {
      const ta = a.tidiedAt ? new Date(a.tidiedAt).getTime() : 0;
      const tb = b.tidiedAt ? new Date(b.tidiedAt).getTime() : 0;
      if (tb !== ta) return tb - ta;
      return (
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
      );
    });

  // --- weekly insight stub --------------------------------------
  const weekMoodCounts: Record<string, number> = {};
  let weekScoreSum = 0;
  let weekScoreCount = 0;
  for (const e of weekEntries) {
    if (e.moodLabel) {
      weekMoodCounts[e.moodLabel] =
        (weekMoodCounts[e.moodLabel] ?? 0) + 1;
    }
    if (typeof e.moodScore === "number") {
      weekScoreSum += e.moodScore;
      weekScoreCount++;
    }
  }
  let weekMost: string | null = null;
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
    avgMoodScore:
      weekScoreCount > 0
        ? Math.round((weekScoreSum / weekScoreCount) * 10) / 10
        : null,
    moodDistribution: weekMoodCounts,
  };

  // --- last7Days array for chart: oldest -> newest --------------
  const last7DaysArray = last7Days
    .map((day) => {
      const s = lastWeekMoodSummary[day];
      return {
        date: day,
        avgMoodScore: s?.avgMoodScore ?? null,
        entries: s?.entries ?? 0,
      };
    })
    .reverse();

  // --- simple weeksSummary mapping ------------------------------
  const weeksSummary = [
    {
      weekIndex: weeklyInsightStub.startWeek,
      weekStart: weeklyInsightStub.startWeek,
      count: weeklyInsightStub.totalEntries,
      insight: {
        summaryText: null,
        encouragingMessage: null,
        moodDistribution: weeklyInsightStub.moodDistribution ?? {},
        mostFrequentMood: weeklyInsightStub.mostFrequentMood,
        avgMoodScore: weeklyInsightStub.avgMoodScore,
      },
      tidiedPreview: prioritizedTidied.length
        ? {
            title: prioritizedTidied[0]?.titleTidied,
            content: prioritizedTidied[0]?.contentTidied,
          }
        : null,
    },
  ];

  const currentWeek = {
    tidiedEntries: prioritizedTidied.map((p) => ({
      id: p.id,
      titleTidied: p.titleTidied,
      contentTidied: p.contentTidied,
      dayDate: p.dayDate,
      moodLabel: p.moodLabel,
      moodScore: p.moodScore,
      category: p.category,
      tidiedAt: p.tidiedAt,
      createdAt: p.createdAt,
    })),
    rawEntries: rawEntries.map((p) => ({
      id: p.id,
      titleRaw: p.titleRaw,
      contentRaw: p.contentRaw,
      dayDate: p.dayDate,
      moodLabel: p.moodLabel,
      moodScore: p.moodScore,
      category: p.category,
      tidiedAt: p.tidiedAt,
      createdAt: p.createdAt,
    })),
  };

  const allEntries = norm.map((e) => ({
    id: e.id,
    day: e.day,
    tidied: !!e.tidiedAt || !!e.contentTidied || !!e.titleTidied,
    titleTidied: e.titleTidied,
    titleRaw: e.titleRaw,
    contentTidied: e.contentTidied,
    contentRaw: e.contentRaw,
    moodLabel: e.moodLabel,
    moodScore: e.moodScore,
    category: e.category,
    tidiedAt: e.tidiedAt,
    createdAt: e.createdAt,
  }));

  // --- calendarDays (last 90 days that have any entries) --------
  const calendarDays = Object.keys(dayAgg)
    .sort() // ascending
    .map((day) => {
      const agg = dayAgg[day];
      let most: string | null = null;
      let mostCount = 0;
      for (const k of Object.keys(agg.moodCounts)) {
        if (agg.moodCounts[k] > mostCount) {
          most = k;
          mostCount = agg.moodCounts[k];
        }
      }
      const avg =
        agg.scoreCount > 0
          ? Math.round((agg.scoreSum / agg.scoreCount) * 10) / 10
          : null;

      const inStreak = streakDisplayDays.has(day);

      // We return a rich object so both old & new StreakCalendar components can use it.
      return {
        // old shape
        day,
        entries: agg.entries,
        mostMood: most,
        avgMoodScore: avg,
        inCurrentStreak: inStreak,

        // new Google-calendar shape
        date: day,
        entriesCount: agg.entries,
        moodLabel: most,
        inStreak,
      };
    });

  return {
    monthly,
    streak: currentStreak, // Duolingo-style current streak
    lastWeekMoodSummary,
    weeklyInsightStub,
    monthlyCounts: monthly,
    last7Days: last7DaysArray,
    weeksSummary,
    currentWeek,
    allEntries,
    calendarDays,
  };
}