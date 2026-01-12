// lib/dateUtils.ts
export function getISOWeek(date: Date): number {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil((((tmp as any) - (yearStart as any)) / 86400000 + 1) / 7);
}

export function computeWeekIndex(date: Date | string): number {
  const d = typeof date === "string" ? new Date(date) : date;
  const week = getISOWeek(d);
  return d.getFullYear() * 100 + week;
}