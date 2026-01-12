// lib/hftranscribe.js
export const MODEL = "openai/whisper-large-v3";
export const ROUTER_URL = `https://router.huggingface.co/hf-inference/models/${MODEL}`;

const CONTENT_TYPES = [
  "audio/m4a",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/flac",
  "audio/ogg",
  "audio/webm",
  "application/octet-stream",
];

async function tryContentType(buffer, hfToken, ct) {
  const res = await fetch(ROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${hfToken}`,
      "Content-Type": ct,
      Accept: "application/json",
    },
    body: buffer,
  });

  const text = await res.text();

  // If response is non-JSON (HTML error page), return failure.
  const trimmed = (text || "").trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return { ok: false, status: res.status, text };
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { ok: false, status: res.status, text };
  }

  if (json?.error) {
    return { ok: false, status: res.status, json };
  }

  // Best-effort text extraction
  const maybeText =
    json?.text ??
    json?.transcription ??
    (Array.isArray(json?.results) ? json.results.map((r) => r.text || r.transcript).join(" ") : null);

  return { ok: true, status: res.status, json, text: maybeText ?? null };
}

/**
 * Transcribe a raw audio buffer using Hugging Face router.
 * - buffer: Buffer | Uint8Array | ArrayBuffer
 * - hfToken: string (server-side token)
 * - preferContentType: optional MIME type (e.g. file.type from client)
 */
export async function transcribeAudio(buffer, hfToken, preferContentType = "") {
  if (!hfToken) throw new Error("Missing HF token (HF_TOKEN)");

  // Normalize to Buffer if necessary
  let buf = buffer;
  if (buffer instanceof ArrayBuffer) buf = Buffer.from(buffer);
  if (ArrayBuffer.isView(buffer)) buf = Buffer.from(buffer.buffer);

  // If the client provided a contentType, try it first
  const tryList = [];
  if (preferContentType) tryList.push(preferContentType);
  for (const ct of CONTENT_TYPES) {
    if (!tryList.includes(ct)) tryList.push(ct);
  }

  let lastErr = null;
  for (const ct of tryList) {
    try {
      const r = await tryContentType(buf, hfToken, ct);
      if (r.ok) {
        return r.text; // transcript or null
      } else {
        // Keep last error for debugging
        lastErr = r;
      }
    } catch (err) {
      lastErr = err;
    }
  }

  // If all tries fail, throw with some info
  throw new Error(
    `All content-types failed. Last error: ${typeof lastErr === "string" ? lastErr : JSON.stringify(lastErr?.json ?? lastErr?.text ?? String(lastErr)).slice(0, 1000)}`
  );
}