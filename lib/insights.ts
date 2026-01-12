// lib/insights.ts
import prisma from "./prisma";
import { startOfWeek, endOfWeek, parseISO, format } from "date-fns";

type EntryRow = {
  id: string;
  titleTidied?: string | null;
  contentTidied?: string | null;
  contentRaw?: string | null;
  moodLabel?: string | null;
  moodScore?: number | null;
  createdAt: Date;
  tidiedAt?: Date | null;
};

/**
 * Returns entries for the week containing the provided ISO date (YYYY-MM-DD).
 * Uses createdAt DateTime range (Monday-Sunday).
 */
export async function getEntriesForWeekByCreatedAt(userId: string, anyDateInWeekISO: string) {
  const weekStart = startOfWeek(parseISO(anyDateInWeekISO), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  const entries = await prisma.entry.findMany({
    where: {
      userId,
      createdAt: {
        gte: weekStart,
        lte: weekEnd,
      },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      titleTidied: true,
      contentTidied: true,
      contentRaw: true,
      moodLabel: true,
      moodScore: true,
      createdAt: true,
      tidiedAt: true,
    },
  });

  return {
    entries: entries as EntryRow[],
    startISO: format(weekStart, "yyyy-MM-dd"),
    endISO: format(weekEnd, "yyyy-MM-dd"),
  };
}

/**
 * Compute mood counts and average mood per day.
 * - moodCounts: counts of moodLabel occurrences
 * - dayScores: map date->averageScore (null if no score)
 * - avgScore: average across all scores in week
 * - mostMood: most frequent moodLabel
 */
export function computeWeekMoodStats(entries: EntryRow[]) {
  const moodCounts: Record<string, number> = {};
  const daySum: Record<string, number> = {};
  const dayCount: Record<string, number> = {};
  let totalScore = 0;
  let scoreCount = 0;

  for (const e of entries) {
    if (e.moodLabel) {
      moodCounts[e.moodLabel] = (moodCounts[e.moodLabel] || 0) + 1;
    }

    const dayKey = format(e.createdAt, "yyyy-MM-dd");
    if (typeof e.moodScore === "number") {
      daySum[dayKey] = (daySum[dayKey] || 0) + e.moodScore;
      dayCount[dayKey] = (dayCount[dayKey] || 0) + 1;

      totalScore += e.moodScore;
      scoreCount++;
    } else {
      // ensure day entry exists (so later we return null vs undefined)
      daySum[dayKey] = daySum[dayKey] ?? 0;
      dayCount[dayKey] = dayCount[dayKey] ?? 0;
    }
  }

  // compute average per day
  const dayScores: Record<string, number | null> = {};
  for (const d of Object.keys(daySum)) {
    const c = dayCount[d] ?? 0;
    dayScores[d] = c > 0 ? daySum[d] / c : null;
  }

  const mostMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const avgScore = scoreCount ? totalScore / scoreCount : null;

  return { moodCounts, mostMood, avgScore, dayScores };
}

export function buildTextBundleForAI(entries: EntryRow[]) {
  const lines: string[] = [];
  for (const e of entries) {
    const day = format(e.createdAt, "yyyy-MM-dd");
    const title = e.titleTidied ?? "(untitled)";
    const content = e.contentTidied ?? e.contentRaw ?? "(no content)";
    const mood = e.moodLabel ?? "unknown";
    lines.push(`${day} — ${title} — mood: ${mood}\n${content}`);
  }
  return lines.join("\n\n");
}