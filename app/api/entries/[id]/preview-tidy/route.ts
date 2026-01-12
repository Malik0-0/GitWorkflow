// app/api/entries/[id]/preview-tidy/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
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

export async function POST(req: Request, context: { params: any }) {
  try {
    const params = await Promise.resolve(context.params);
    const id = params?.id;
    if (!id) return NextResponse.json({ error: "Missing entry id" }, { status: 400 });

    const user = await getCurrentPrismaUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const entry = await prisma.entry.findUnique({ where: { id } });
    if (!entry || entry.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) || {};
    const raw = String(body.raw ?? entry.contentRaw ?? "").trim();
    if (!raw) return NextResponse.json({ error: "Empty text" }, { status: 400 });

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
      entry,
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
      date: result.dateCandidate ? result.dateCandidate.toISOString().slice(0, 10) : todayISO,
      rawAI: result.rawAI ?? null,
      parsed: result.parsed ?? null,
    };

    return NextResponse.json({ preview });
  } catch (err: any) {
    console.error("entry preview tidy error", err);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed. Use POST." }, { status: 405 });
}