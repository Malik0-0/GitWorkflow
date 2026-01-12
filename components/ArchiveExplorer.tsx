"use client";

import React, { useMemo, useState } from "react";
import RawPreviewCard, { formatDateForDisplay } from "./RawPreviewCard";
import ClientDate from "@/components/ClientDate";

type Entry = {
  id: string;
  day: string; // YYYY-MM-DD
  tidied?: boolean;
  titleTidied?: string | null;
  titleRaw?: string | null;
  contentTidied?: string | null;
  contentRaw?: string | null;
  moodLabel?: string | null;
  moodScore?: number | null;
  category?: string | null;
  tidiedAt?: string | null;
  createdAt?: string | null;
};

// helper: iso week start (Monday) string YYYY-MM-DD
function startOfISOWeekStr(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay(); // 0=Sun
  const diff = (day + 6) % 7; // 0=Mon
  const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  s.setUTCDate(s.getUTCDate() - diff);
  return s.toISOString().slice(0, 10);
}

function monthOf(dateStr: string) {
  return dateStr.slice(0, 7); // YYYY-MM
}

// deterministic short weekday label from a YYYY-MM-DD string (UTC weekday)
function weekdayShortUTC(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00Z");
  // Map 1=Mon ... 0=Sun -> labels
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return labels[d.getUTCDay()];
}

export default function ArchiveExplorer({
  entries,
  showTidiedCards = true,
  compactRawList = true,
}: {
  entries: Entry[]; // recent entries to archive (will be grouped)
  showTidiedCards?: boolean; // if true, tidied entries inside archive render as EntryPreviewCard
  compactRawList?: boolean; // if true, raw entries render as list items
}) {
  // group into months -> weeks -> days
  const tree = useMemo(() => {
    const months: Record<string, any> = {};
    for (const e of entries) {
      const m = monthOf(e.day);
      const ws = startOfISOWeekStr(e.day);
      const day = e.day;

      months[m] = months[m] || {};
      months[m][ws] = months[m][ws] || {};
      months[m][ws][day] = months[m][ws][day] || [];
      months[m][ws][day].push(e);
    }

    // convert to arrays sorted descending (most recent first) and compute week numbers within month
    const monthsArr = Object.keys(months)
      .sort((a, b) => (a > b ? -1 : 1))
      .map((m) => {
        const weekStarts = Object.keys(months[m]).sort(); // ascending within month
        // we'll map weekStarts to weekNumber 1..N based on their index
        const weeks = weekStarts.map((ws, idx) => {
          const weekNumber = idx + 1;
          const daysArr = Object.keys(months[m][ws]).sort();
          const firstShort = weekdayShortUTC(daysArr[0]);
          const lastShort = weekdayShortUTC(daysArr[daysArr.length - 1]);
          // keep day grouping
          return {
            weekStart: ws,
            weekNumber,
            weekLabelRange: `${firstShort} – ${lastShort}`,
            days: daysArr.map((day) => ({
              day,
              entries: months[m][ws][day].sort((a: Entry, b: Entry) => (a.createdAt! < b.createdAt! ? 1 : -1)),
            })),
          };
        });

        return {
          month: m,
          weeks: weeks.sort((a: any, b: any) => (a.weekStart > b.weekStart ? -1 : 1)), // newest first
        };
      });

    return monthsArr;
  }, [entries]);

  // expand state
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({});
  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({});
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-4">
      {tree.map((m) => {
        const monthKey = m.month;
        const monthLabel = new Date(m.month + "-01T00:00:00Z").toLocaleString(undefined, { month: "long", year: "numeric" });

        return (
          <div key={monthKey} className="border rounded bg-white dark:bg-[var(--card)] text-slate-900 dark:text-[var(--text)] border-slate-300 dark:border-[rgba(255,255,255,0.06)]">
            <button
              onClick={() => setOpenMonths((s) => ({ ...s, [monthKey]: !s[monthKey] }))}
              className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 dark:bg-[rgba(255,255,255,0.02)] dark:hover:bg-[rgba(255,255,255,0.04)] flex items-center justify-between text-slate-900 dark:text-[var(--text)]"
            >
              <div className="font-medium">{monthLabel}</div>
              <div className="text-sm text-slate-600 dark:text-[var(--muted)]">{openMonths[monthKey] ? "−" : "+"}</div>
            </button>

            {openMonths[monthKey] && (
              <div className="p-4 space-y-3">
                {m.weeks.map((w: any) => {
                  const weekKey = `${monthKey}:${w.weekStart}`;
                  return (
                    <div key={weekKey}>
                      <button
                        onClick={() => setOpenWeeks((s) => ({ ...s, [weekKey]: !s[weekKey] }))}
                        className="w-full text-left px-3 py-2 bg-white/40 hover:bg-white/60 dark:bg-[rgba(255,255,255,0.02)] dark:hover:bg-[rgba(255,255,255,0.04)] rounded flex items-center justify-between text-slate-800 dark:text-[var(--text)]"
                      >
                        <div className="text-sm font-medium">
                          Week {w.weekNumber}
                        </div>
                        <div className="text-sm">{openWeeks[weekKey] ? "−" : "+"}</div>
                      </button>

                      {openWeeks[weekKey] && (
                        <div className="mt-2 space-y-2 pl-4">
                          {w.days.map((d: any) => {
                            const dayKey = `${weekKey}:${d.day}`;
                            return (
                              <div key={dayKey}>
                                <button
                                  onClick={() => setOpenDays((s) => ({ ...s, [dayKey]: !s[dayKey] }))}
                                  className="w-full text-left py-1 flex items-center justify-between text-sm text-slate-600 dark:text-[var(--muted)]"
                                >
                                  <div>{weekdayShortUTC(d.day)}</div>
                                  <div className="text-xs">{openDays[dayKey] ? "−" : "+"}</div>
                                </button>

                                {openDays[dayKey] && (
                                  <div className="mt-2 space-y-2">
                                    {d.entries.map((ee: Entry) => {
                                      if (ee.tidied && showTidiedCards) {
                                        // render card
                                        return (
                                          <div key={ee.id}>
                                            <RawPreviewCard
                                              entry={{
                                                id: ee.id,
                                                titleTidied: ee.titleTidied,
                                                contentTidied: ee.contentTidied,
                                                moodLabel: ee.moodLabel,
                                                moodScore: ee.moodScore,
                                                category: ee.category,
                                                dayDate: ee.day,
                                                tidiedAt: ee.tidiedAt,
                                                createdAt: ee.createdAt,
                                                tidied: true,
                                              }}
                                              huge
                                            />
                                          </div>
                                        );
                                      } else {
                                        // raw entry -> compact list item
                                        return (
                                          <div key={ee.id} className="p-2 rounded hover:bg-slate-50 dark:hover:bg-[rgba(255,255,255,0.02)] flex items-start justify-between">
                                            <div className="text-sm">
                                              <a href={`/entries/${ee.id}`} className="font-medium text-slate-800 dark:text-[var(--text)]">
                                                {ee.titleRaw ?? (ee.contentRaw ? (ee.contentRaw.slice(0, 80) + (ee.contentRaw.length > 80 ? "…" : "")) : "No content")}
                                              </a>
                                              <div className="text-xs text-slate-500 dark:text-[var(--muted)] mt-1">{ee.moodLabel ?? "-"} • {ee.category ?? "-"}</div>
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-[var(--muted)]">{formatDateForDisplay(ee.day)}</div>
                                          </div>
                                        );
                                      }
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}