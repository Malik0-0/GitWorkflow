// components/charts/StreakCalendar.tsx
"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
} from "date-fns";
import { useRouter } from "next/navigation";
import { moodBadgeColor } from "@/lib/moodColor";

type DayStat = {
  date: string; // "YYYY-MM-DD"
  moodLabel?: string | null;
  inStreak?: boolean;
  entriesCount?: number;
};

type Props = {
  stats: DayStat[];
};

const weekdayLabels = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export default function StreakCalendar({ stats }: Props) {
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const router = useRouter();

  const statsByDate = useMemo(() => {
    const map = new Map<string, DayStat>();
    for (const s of stats ?? []) {
      // support both {date} and {day}
      const key = (s as any).day ?? s.date;
      if (key) map.set(key, s);
    }
    return map;
  }, [stats]);

  const firstDayOfMonth = startOfMonth(month);
  const lastDayOfMonth = endOfMonth(month);

  const calendarDays = eachDayOfInterval({
    start: startOfWeek(firstDayOfMonth, { weekStartsOn: 1 }), // Monday
    end: endOfWeek(lastDayOfMonth, { weekStartsOn: 1 }),
  });

  const handlePrev = () => setMonth((m) => subMonths(m, 1));
  const handleNext = () => setMonth((m) => addMonths(m, 1));

  // when user clicks a day, jump to /entries filtered by that date
  function handleDayClick(iso: string) {
    // entries page already understands from/to, so use that
    router.push(`/entries?from=${iso}&to=${iso}`);
  }

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Activity calendar</h2>
          <p className="text-xs text-slate-500">
            Days are colored by most frequent mood.{" "}
            <span className="inline-flex items-center gap-1">
              <span>🔥</span>
              <span className="hidden sm:inline">
                shows your current streak.
              </span>
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={handlePrev}
            className="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
          >
            Prev
          </button>
          <div className="text-sm font-medium min-w-[140px] text-center">
            {format(month, "MMMM yyyy")}
          </div>
          <button
            type="button"
            onClick={handleNext}
            className="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
          >
            Next
          </button>
        </div>
      </div>

      {/* Weekday row */}
      <div className="grid grid-cols-7 text-[11px] font-medium text-slate-400 px-1">
        {weekdayLabels.map((d) => (
          <div key={d} className="text-center uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-7 gap-1 text-xs">
        {calendarDays.map((day) => {
          const iso = format(day, "yyyy-MM-dd");
          const stat = statsByDate.get(iso);
          const inCurrentMonth = isSameMonth(day, month);
          const isTodayFlag = isToday(day);

          const moodHex = stat?.moodLabel ? moodBadgeColor(stat.moodLabel) : null;

          const opacityClasses = inCurrentMonth ? "" : "opacity-40";
          const streakRing =
            stat?.inStreak && inCurrentMonth
              ? "ring-2 ring-orange-300 ring-offset-1"
              : "";

          return (
            <button
              key={iso}
              type="button"
              onClick={() => handleDayClick(iso)}
              className={[
                "relative aspect-[4/3] rounded-xl border text-left p-1.5 transition-colors",
                "bg-white dark:bg-slate-900", // neutral base
                opacityClasses,
                streakRing,
                "hover:border-slate-400 dark:hover:border-slate-400",
                stat?.entriesCount
                  ? "cursor-pointer"
                  : "cursor-pointer", // still allow click even if 0, just shows empty list
              ].join(" ")}
              style={
                moodHex
                  ? {
                    // strong but still readable: background 20% alpha, border 50% alpha
                    backgroundColor: `${moodHex}33`, // #RRGGBB33 (alpha)
                    borderColor: `${moodHex}80`,
                  }
                  : undefined
              }
            >
              {/* top row: date + badges */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold">
                  {format(day, "d")}
                </span>

                <div className="flex items-center gap-1">
                  {stat?.inStreak && (
                    <span className="text-[10px]" aria-label="streak">
                      🔥
                    </span>
                  )}
                  {isTodayFlag && (
                    <span className="text-[9px] px-1 py-0.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                      Today
                    </span>
                  )}
                </div>
              </div>

              {/* entries count */}
              {stat?.entriesCount ? (
                <div className="mt-3 text-[10px] text-slate-600 dark:text-slate-300">
                  {stat.entriesCount} note
                  {stat.entriesCount > 1 ? "s" : ""}
                </div>
              ) : null}

              {/* mood label at bottom */}
              {stat?.moodLabel && (
                <div className="absolute bottom-1 left-1 right-1">
                  <div className="inline-flex max-w-full items-center rounded-full bg-white/70 px-2 py-0.5 text-[10px] text-slate-600 backdrop-blur-sm dark:bg-slate-900/70 dark:text-slate-100">
                    <span className="truncate">{stat.moodLabel}</span>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
