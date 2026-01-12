// app/entries/page.tsx
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionToken } from "@/lib/auth";
import RawPreviewCard from "@/components/RawPreviewCard";
import { formatISO, startOfDay, endOfDay, parseISO } from "date-fns";
import {
  ALLOWED_MOODS,
  ALLOWED_CATEGORIES,
  normalizeMoodFreeform,
  normalizeCategoryFreeform,
} from "@/lib/validators";
import { Prisma } from "@prisma/client";

async function getCurrentPrismaUser() {
  const token = await getSessionToken();
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  if (!data?.user) return null;
  return prisma.user.findUnique({ where: { supabaseId: data.user.id } });
}

const PAGE_SIZE = 12;

type SearchParams = { [key: string]: string | string[] | undefined };

function getParam(sp: SearchParams, key: string): string {
  const v = sp[key];
  if (!v) return "";
  return Array.isArray(v) ? v[0] ?? "" : v;
}

function labelize(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function EntriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const user = await getCurrentPrismaUser();
  if (!user) redirect("/login");

  const page = Number(getParam(sp, "page") || "1") || 1;
  const q = getParam(sp, "q");
  const mood = getParam(sp, "mood");
  const category = getParam(sp, "category");
  const sort = getParam(sp, "sort") || "dayDate-desc";
  const year = getParam(sp, "year");
  const month = getParam(sp, "month");
  const day = getParam(sp, "day");
  const from = getParam(sp, "from");
  const to = getParam(sp, "to");

  const andConditions: Prisma.EntryWhereInput[] = [];

  // text / q search (title, content, plus optional mood/category/date)
  if (q) {
    const or: Prisma.EntryWhereInput[] = [
      { titleTidied: { contains: q, mode: "insensitive" } },
      { titleRaw: { contains: q, mode: "insensitive" } },
      { contentTidied: { contains: q, mode: "insensitive" } },
      { contentRaw: { contains: q, mode: "insensitive" } },
    ];

    // allow searching mood by free text (use enum equality, no contains)
    const moodFromQ = normalizeMoodFreeform(q);
    if (moodFromQ) {
      or.push({ moodLabel: moodFromQ as any });
    }

    // allow searching category by free text (enum/string equality)
    const categoryFromQ = normalizeCategoryFreeform(q);
    if (categoryFromQ) {
      or.push({ category: categoryFromQ as any });
    }

    // quick date pattern support in q (yyyy-mm-dd or dd/mm/yyyy)
    let dateFrom: Date | null = null;
    let dateTo: Date | null = null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(q)) {
      const d = parseISO(q);
      dateFrom = startOfDay(d);
      dateTo = endOfDay(d);
    } else {
      const m = q.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) {
        const [_, dd, mm, yyyy] = m;
        const d = new Date(
          Number.parseInt(yyyy, 10),
          Number.parseInt(mm, 10) - 1,
          Number.parseInt(dd, 10)
        );
        dateFrom = startOfDay(d);
        dateTo = endOfDay(d);
      }
    }

    if (dateFrom && dateTo) {
      or.push({
        OR: [
          { dayDate: { gte: dateFrom, lte: dateTo } },
          {
            AND: [
              { dayDate: null },
              { createdAt: { gte: dateFrom, lte: dateTo } },
            ],
          },
        ],
      });
    }

    andConditions.push({ OR: or });
  }

  // mood filter from dropdown (normalize + enum equality)
  if (mood) {
    const normalizedMood = normalizeMoodFreeform(mood);
    if (normalizedMood) {
      andConditions.push({
        moodLabel: normalizedMood as any,
      });
    }
  }

  // category filter from dropdown (normalize + equality)
  if (category) {
    const normalizedCategory = normalizeCategoryFreeform(category);
    if (normalizedCategory) {
      andConditions.push({
        category: normalizedCategory as any,
      });
    }
  }

  // date filters (year/month/day) based on dayDate if present, else createdAt
  if (year || month || day) {
    const y = year ? Number.parseInt(year, 10) : undefined;
    const m = month ? Number.parseInt(month, 10) : undefined;
    const d = day ? Number.parseInt(day, 10) : undefined;

    if (y && m && d) {
      const base = new Date(y, m - 1, d);
      const gte = startOfDay(base);
      const lte = endOfDay(base);
      andConditions.push({
        OR: [
          { dayDate: { gte, lte } },
          { AND: [{ dayDate: null }, { createdAt: { gte, lte } }] },
        ],
      });
    } else if (y && m) {
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0); // last day of month
      andConditions.push({
        OR: [
          { dayDate: { gte: start, lte: end } },
          { AND: [{ dayDate: null }, { createdAt: { gte: start, lte: end } }] },
        ],
      });
    } else if (y) {
      const start = new Date(y, 0, 1);
      const end = new Date(y, 11, 31, 23, 59, 59, 999);
      andConditions.push({
        OR: [
          { dayDate: { gte: start, lte: end } },
          { AND: [{ dayDate: null }, { createdAt: { gte: start, lte: end } }] },
        ],
      });
    }
  }

  if (from || to) {
    try {
      const gte = from ? startOfDay(parseISO(from)) : undefined;
      const lte = to ? endOfDay(parseISO(to)) : undefined;
      if (gte || lte) {
        const range: { gte?: Date; lte?: Date } = {};
        if (gte) range.gte = gte;
        if (lte) range.lte = lte;

        andConditions.push({
          OR: [
            { dayDate: range },
            { AND: [{ dayDate: null }, { createdAt: range }] },
          ],
        });
      }
    } catch {
      // ignore parse error
    }
  }

  const where: Prisma.EntryWhereInput = {
    userId: user.id,
    ...(andConditions.length ? { AND: andConditions } : {}),
  };

  // sorting
  let orderBy: Prisma.EntryOrderByWithRelationInput[] = [];
  switch (sort) {
    case "createdAt-asc":
      orderBy = [{ createdAt: "asc" }];
      break;
    case "createdAt-desc":
      orderBy = [{ createdAt: "desc" }];
      break;
    case "dayDate-asc":
      orderBy = [{ dayDate: "asc" }, { createdAt: "asc" }];
      break;
    case "dayDate-desc":
    default:
      orderBy = [{ dayDate: "desc" }, { createdAt: "desc" }];
      break;
  }

  const total = await prisma.entry.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const entries = await prisma.entry.findMany({
    where,
    orderBy,
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const queryString = (extra: Record<string, string | number>) => {
    const params = new URLSearchParams();
    const keys = [
      "q",
      "mood",
      "category",
      "year",
      "month",
      "day",
      "from",
      "to",
      "sort",
    ];
    for (const k of keys) {
      const v = getParam(sp, k);
      if (v) params.set(k, v);
    }
    for (const [k, v] of Object.entries(extra)) {
      params.set(k, String(v));
    }
    const s = params.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div className="py-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">All notes</h1>
        <a href="/entries/new" className="btn-primary">
          New entry
        </a>
      </div>

      {/* Filters */}
      <form className="card p-4 space-y-3" method="GET">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Search
            </label>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search title, content, mood, category, or date (e.g. 2025-12-05)"
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Emotion
              </label>
              <select
                name="mood"
                defaultValue={mood}
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
              >
                <option value="">All emotions</option>
                {ALLOWED_MOODS.map((m) => (
                  <option key={m} value={m}>
                    {labelize(m)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Category
              </label>
              <select
                name="category"
                defaultValue={category}
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
              >
                <option value="">All categories</option>
                {ALLOWED_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {labelize(c)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Sort by
            </label>
            <select
              name="sort"
              defaultValue={sort}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
            >
              <option value="createdAt-desc">Newest</option>
              <option value="createdAt-asc">Oldest</option>
            </select>
          </div>
        </div>

        {/* Date filters row */}
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Year
              </label>
              <input
                type="number"
                name="year"
                defaultValue={year}
                placeholder="2025"
                className="w-full rounded border border-slate-200 px-2 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Month
              </label>
              <input
                type="number"
                min={1}
                max={12}
                name="month"
                defaultValue={month}
                placeholder="12"
                className="w-full rounded border border-slate-200 px-2 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Day
              </label>
              <input
                type="number"
                min={1}
                max={31}
                name="day"
                defaultValue={day}
                placeholder="05"
                className="w-full rounded border border-slate-200 px-2 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                From
              </label>
              <input
                type="date"
                name="from"
                defaultValue={from || ""}
                className="w-full rounded border border-slate-200 px-2 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                To
              </label>
              <input
                type="date"
                name="to"
                defaultValue={to || ""}
                className="w-full rounded border border-slate-200 px-2 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
              />
            </div>
          </div>

          <div className="flex items-end justify-end gap-2">
            <button
              type="submit"
              className="btn-primary px-4 py-2 text-sm"
            >
              Apply
            </button>
            <a href="/entries" className="btn-secondary px-4 py-2 text-sm">
              Reset
            </a>
          </div>
        </div>
      </form>

      {/* Results */}
      {entries.length === 0 ? (
        <div className="card p-4 text-sm text-slate-500">
          No notes found for this filter.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((e) => (
            <RawPreviewCard
              key={e.id}
              entry={{
                id: e.id,
                titleTidied: e.titleTidied ?? undefined,
                titleRaw: e.titleRaw ?? undefined,
                contentTidied: e.contentTidied ?? undefined,
                contentRaw: e.contentRaw ?? undefined,
                moodLabel: e.moodLabel ?? undefined,
                moodScore: e.moodScore ?? undefined,
                category: e.category ?? undefined,
                dayDate: e.dayDate
                  ? formatISO(e.dayDate as Date, { representation: "date" })
                  : undefined,
                tidiedAt: e.tidiedAt ?? undefined,
                createdAt: e.createdAt ?? undefined,
                tidied: !!(e.tidiedAt || e.contentTidied || e.titleTidied),
              }}
              huge
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm mt-2">
          <div className="text-xs text-slate-500">
            Page {page} of {totalPages} ({total} notes)
          </div>
          <div className="flex gap-2">
            <a
              href={page > 1 ? queryString({ page: page - 1 }) : "#"}
              aria-disabled={page <= 1}
              className={`px-3 py-1 rounded border text-xs ${
                page <= 1
                  ? "border-slate-200 text-slate-300 cursor-default"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
              }`}
            >
              Prev
            </a>
            <a
              href={page < totalPages ? queryString({ page: page + 1 }) : "#"}
              aria-disabled={page >= totalPages}
              className={`px-3 py-1 rounded border text-xs ${
                page >= totalPages
                  ? "border-slate-200 text-slate-300 cursor-default"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
              }`}
            >
              Next
            </a>
          </div>
        </div>
      )}
    </div>
  );
}