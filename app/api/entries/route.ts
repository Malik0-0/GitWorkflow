// app/api/entries/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionToken } from "@/lib/auth";
import { sanitizeMood, sanitizeCategory } from "@/lib/validators";

/** compute ISO week index like YYYYWW (ISO week number padded) */
function computeWeekIndex(d: Date | null) {
  if (!d) return null;
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.floor(((+date - +yearStart) / 86400000 + 1) / 7) + 1;
  return Number(`${date.getUTCFullYear()}${String(weekNo).padStart(2, "0")}`);
}

/** parse incoming dayDate (YYYY-MM-DD) or ISO and return Date | null */
function parseDayDate(v: any): Date | null {
  if (!v) return null;
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

export const runtime = "nodejs";

async function getCurrentPrismaUser() {
  const token = await getSessionToken();
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return await prisma.user.findUnique({ where: { supabaseId: data.user.id } });
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentPrismaUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) || {};

    // required: at least content (raw) must be present
    const rawContent = typeof body.content === "string" && body.content.trim() ? body.content.trim() : null;
    if (!rawContent) {
      return NextResponse.json({ error: "Missing content" }, { status: 400 });
    }

    // Normalize inputs
    const titleProvided = typeof body.title === "string" && body.title.trim() ? body.title.trim() : null;
    const titleTidiedProvided = typeof body.titleTidied === "string" && body.titleTidied.trim() ? body.titleTidied.trim() : null;

    // Tidied fields (optional)
    const contentTidiedProvided = typeof body.contentTidied === "string" && body.contentTidied.trim() ? body.contentTidied.trim() : null;

    // Mood/category input: accept 'mood' or 'moodLabel'
    const rawMoodValue =
      (typeof body.moodLabel === "string" && body.moodLabel.trim())
        ? body.moodLabel.trim()
        : (typeof body.mood === "string" && body.mood.trim() ? body.mood.trim() : null);

    const rawCategoryValue = (typeof body.category === "string" && body.category.trim()) ? body.category.trim() : null;

    // sanitize values to project enums (supports Indonesian synonyms via validators)
    const moodLabelSan = rawMoodValue ? sanitizeMood(rawMoodValue) : null;
    const moodScoreVal = (body.moodScore != null && !Number.isNaN(Number(body.moodScore))) ? Number(body.moodScore) : null;
    const categorySan = rawCategoryValue ? sanitizeCategory(rawCategoryValue) : null;

    // parse dayDate
    const inputDayDate = parseDayDate(body.dayDate ?? null);

    // build manual flags: mark each manual flag true if user provided that field (even if not explicitly sent as titleManual)
    const titleManualFlag = !!titleProvided || !!body.titleManual;
    const moodManualFlag = !!rawMoodValue || !!body.moodManual;
    const categoryManualFlag = !!rawCategoryValue || !!body.categoryManual;
    const dateManualFlag = !!inputDayDate || !!body.dateManual;

    // Determine tidiedAt
    const clientMarkedTidied = !!body.isTidied;
    const userFilledAllVisible = !!titleProvided && !!rawContent && !!moodLabelSan && !!categorySan && !!inputDayDate && (moodScoreVal != null);
    const serverHasTidiedFields = !!contentTidiedProvided || !!titleTidiedProvided;

    const tidiedAt = (clientMarkedTidied || userFilledAllVisible || serverHasTidiedFields) ? new Date() : null;

    // Promote raw->tidied when user filled everything manually (so tidied view shows user's values)
    const finalTitleTidied = titleTidiedProvided ?? (userFilledAllVisible ? titleProvided : null);
    const finalContentTidied = contentTidiedProvided ?? (userFilledAllVisible ? rawContent : null);

    // compute weekIndex from final day date (prefer inputDayDate; if null fallback to createdAt later)
    const createdAt = new Date();
    const finalDayDate = inputDayDate ?? null;
    const computedWeekIndex = computeWeekIndex(finalDayDate ?? createdAt);

    const created = await prisma.entry.create({
      data: {
        userId: user.id,
        contentRaw: rawContent,
        titleRaw: titleProvided,

        // tidied fields (may be null)
        contentTidied: finalContentTidied,
        titleTidied: finalTitleTidied,
        tidiedAt: tidiedAt,

        // mood/category/date
        moodLabel: moodLabelSan,
        moodScore: moodScoreVal,
        category: categorySan,
        dayDate: finalDayDate,

        // week index
        weekIndex: computedWeekIndex,

        // manual flags
        titleManual: titleManualFlag,
        moodManual: moodManualFlag,
        categoryManual: categoryManualFlag,
        dateManual: dateManualFlag,
      },
    });

    // respond with normalized object (ISO date strings)
    const out = {
      id: created.id,
      userId: created.userId,
      createdAt: created.createdAt?.toISOString?.() ?? null,
      updatedAt: created.updatedAt?.toISOString?.() ?? null,
      contentRaw: created.contentRaw,
      contentTidied: created.contentTidied,
      titleRaw: created.titleRaw,
      titleTidied: created.titleTidied,
      tidiedAt: created.tidiedAt?.toISOString?.() ?? null,
      moodLabel: created.moodLabel,
      moodScore: created.moodScore,
      category: created.category,
      dayDate: created.dayDate?.toISOString?.() ?? null,
      weekIndex: created.weekIndex,
      titleManual: created.titleManual,
      moodManual: created.moodManual,
      categoryManual: created.categoryManual,
      dateManual: created.dateManual,
    };

    return NextResponse.json({ entry: out }, { status: 201 });
  } catch (err: any) {
    console.error("create entry error", err);
    return NextResponse.json({ error: err?.message ?? "Create failed" }, { status: 500 });
  }
}