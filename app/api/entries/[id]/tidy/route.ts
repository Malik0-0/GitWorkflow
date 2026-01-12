// app/api/entries/[id]/tidy/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionToken } from "@/lib/auth";
import { computeWeekIndex } from "@/lib/dateUtils";
import { runTidyModel } from "@/lib/tidy";
import { sanitizeMood, sanitizeCategory } from "@/lib/validators";

export const runtime = "nodejs";

async function getCurrentPrismaUser() {
  const token = await getSessionToken();
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return await prisma.user.findUnique({ where: { supabaseId: data.user.id } });
}

function formatISODate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null;
}

export async function POST(req: Request, context: { params: any }) {
  try {
    const params = await Promise.resolve(context.params);
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: "Missing entry id in params" }, { status: 400 });
    }

    const user = await getCurrentPrismaUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const entry = await prisma.entry.findUnique({ where: { id } });
    if (!entry || entry.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) || {};
    const raw = String(body.raw ?? body.content ?? entry.contentRaw ?? "").trim();
    if (!raw) {
      return NextResponse.json({ error: "Empty text" }, { status: 400 });
    }

    if (!process.env.GEMINI_TOKEN) {
      console.error("GEMINI_TOKEN not set");
      return NextResponse.json({ error: "Server missing GEMINI_TOKEN" }, { status: 500 });
    }

    const userOverrides = {
      title: entry.titleManual ? (entry.titleRaw ?? "") : null,
      moodLabel: entry.moodManual ? entry.moodLabel : null,
      moodScore: entry.moodManual ? entry.moodScore : null,
      category: entry.categoryManual ? entry.category : null,
      date: entry.dateManual ? formatISODate(entry.dayDate) : null,
    };

    const clientProvided = {
      title: body.title ?? null,
      moodLabel: body.moodLabel ?? null,
      moodScore: body.moodScore ?? null,
      category: body.category ?? null,
      date: body.date ?? null,
    };

    for (const k of Object.keys(clientProvided)) {
      if (clientProvided[k as keyof typeof clientProvided] != null) {
        userOverrides[k as keyof typeof userOverrides] = clientProvided[k as keyof typeof clientProvided];
      }
    }

    const tidyResult = await runTidyModel({
      text: raw,
      entry,
      userOverrides,
      hfToken: process.env.GEMINI_TOKEN,
    });

    // Decide final dayDate: if tidyResult provided a dateCandidate use it, otherwise use today's date.
    const finalDayDate = (() => {
      if (tidyResult.dateCandidate) {
        // trust tidyResult dateCandidate (tidyModel is now instructed not to invent dates)
        return tidyResult.dateCandidate;
      }

      // if entry had a valid dayDate previously, keep it
      if (entry.dayDate) {
        const ed = entry.dayDate instanceof Date ? entry.dayDate : new Date(entry.dayDate as any);
        if (!isNaN(ed.getTime()) && ed.getUTCFullYear() >= 2000) return ed;
      }

      // DEFAULT: today's date
      return new Date();
    })();

    const finalWeekIndex = computeWeekIndex(finalDayDate);

    // compute final merged fields (respect manual flags)
    const finalTitle = entry.titleManual ? (entry.titleTidied ?? entry.titleRaw ?? "") : (tidyResult.title ?? "");
    const finalContentTidied = tidyResult.contentTidied ?? raw;

    const finalMoodLabel = entry.moodManual
      ? (sanitizeMood(entry.moodLabel) ?? null)
      : (sanitizeMood(tidyResult.moodLabel) ?? null);

    const finalMoodScore = entry.moodManual ? entry.moodScore ?? null : tidyResult.moodScore ?? null;

    const finalCategory = entry.categoryManual
      ? (sanitizeCategory(entry.category) ?? null)
      : (sanitizeCategory(tidyResult.category) ?? null);

    const updated = await prisma.entry.update({
      where: { id },
      data: {
        titleTidied: finalTitle,
        contentTidied: finalContentTidied,
        tidiedAt: new Date(),

        moodLabel: finalMoodLabel,
        moodScore: finalMoodScore,
        category: finalCategory,

        dayDate: finalDayDate,
        weekIndex: finalWeekIndex,
      },
    });

    return NextResponse.json({
      tidy: updated,
      rawAI: tidyResult.rawAI ?? null,
      parsed: tidyResult.parsed ?? null,
    });
  } catch (err: any) {
    console.error("tidy error", err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}