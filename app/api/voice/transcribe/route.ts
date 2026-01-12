// app/api/voice/transcribe/route.ts
import { NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/hftranscribe";

export const runtime = "nodejs";

// TEMP GET to verify
export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/voice/transcribe" });
}

export async function POST(req: Request) {
  try {
    console.log("POST /api/voice/transcribe hit");

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const tidyFlag = String(form.get("tidy") ?? "").toLowerCase() === "true";

    if (!file) {
      return NextResponse.json({ error: "No audio file uploaded" }, { status: 400 });
    }

    // Server env name: HF_TOKEN (set this in Vercel / .env.local)
    const hfToken = process.env.HF_TOKEN;
    if (!hfToken) {
      return NextResponse.json({ error: "Missing HF_TOKEN env var" }, { status: 500 });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Prefer to tell HF the client's content-type if provided
    const preferContentType = file.type || "";

    // Call helper to try transcribing
    let transcript: string | null = null;
    try {
      transcript = await transcribeAudio(buffer, hfToken, preferContentType);
    } catch (err: any) {
      console.error("transcribeAudio failed:", err);
      return NextResponse.json({ error: err?.message ?? "Transcription failed" }, { status: 500 });
    }

    if (!transcript || String(transcript).trim().length === 0) {
      // return something explicit
      return NextResponse.json({ transcript: "" });
    }

    if (!tidyFlag) {
      return NextResponse.json({ transcript });
    }

    // local tidy logic (kept from your original file)
    const tidy = heuristicTidy(transcript);
    return NextResponse.json({ transcript, tidy });
  } catch (err: any) {
    console.error("POST error", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}

function heuristicTidy(text: string) {
  const today = new Date().toISOString().slice(0, 10);

  const firstSentence = (text.split(/[.!?\n]/).find(Boolean) || "").trim();
  const title = firstSentence.split(/\s+/).slice(0, 8).join(" ") || "Untitled Entry";

  const lowered = text.toLowerCase();
  const moodMap: Record<string, string> = {
    happy: "happy",
    joy: "happy",
    excited: "excited",
    sad: "sad",
    anxious: "anxious",
    stressed: "anxious",
    angry: "frustrated",
    frustrated: "frustrated",
    calm: "calm",
    relaxed: "calm",
  };

  let mood = "neutral";
  for (const k in moodMap) {
    if (lowered.includes(k)) {
      mood = moodMap[k];
      break;
    }
  }

  const categoryMap: Record<string, string[]> = {
    personal: ["family", "home", "relationship", "partner", "friend"],
    work: ["work", "project", "deadline", "meeting", "boss", "client"],
    finance: ["money", "salary", "budget", "invoice", "expense"],
  };

  let category = "other";
  for (const cat in categoryMap) {
    if (categoryMap[cat].some((kw) => lowered.includes(kw))) {
      category = cat;
      break;
    }
  }

  const date = text.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || today;
  const summary = text.split(/\s+/).slice(0, 40).join(" ");

  return { title, mood, category, date, summary };
}