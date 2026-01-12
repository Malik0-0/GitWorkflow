// app/api/entries/preview-tidy/route.ts
import { NextResponse } from "next/server";
import { runTidyModel } from "@/lib/tidy";
import { sanitizeMood, sanitizeCategory } from "@/lib/validators";

export const runtime = "nodejs";

export async function OPTIONS() {
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) || {};
    const raw = String(body.raw ?? "").trim();
    if (!raw) {
      return NextResponse.json({ error: "Empty text" }, { status: 400 });
    }

    const userProvided = {
      title: body.title ?? null,
      moodLabel: body.moodLabel ?? null,
      moodScore: body.moodScore ?? null,
      category: body.category ?? null,
      date: body.date ?? null,
    };

    if (!process.env.GEMINI_TOKEN) {
      console.error("GEMINI_TOKEN not set");
      return NextResponse.json({ error: "Server missing GEMINI_TOKEN" }, { status: 500 });
    }

    const result = await runTidyModel({
      text: raw,
      userOverrides: userProvided,
      hfToken: process.env.GEMINI_TOKEN,
    });

    const moodLabel = sanitizeMood(result.moodLabel) ?? null;
    const category = sanitizeCategory(result.category) ?? null;
    const moodScore = result.moodScore != null && Number.isFinite(Number(result.moodScore))
      ? Number(result.moodScore)
      : null;

    const todayISO = new Date().toISOString().slice(0, 10);

    const preview = {
      title: result.title ?? "",
      contentTidied: result.contentTidied,
      moodLabel,
      moodScore,
      category,
      // If model returned dateCandidate -> use it; otherwise use today's date
      date: result.dateCandidate ? result.dateCandidate.toISOString().slice(0, 10) : todayISO,
      rawAI: result.rawAI ?? null,
      parsed: result.parsed ?? null,
    };

    return NextResponse.json({ preview });
  } catch (err: any) {
    console.error("preview tidy error", err);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed. Use POST." }, { status: 405 });
}