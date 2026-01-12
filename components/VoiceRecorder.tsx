"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

type Props = {
  onTranscript: (text: string, isFinal?: boolean) => void;
  maxSeconds?: number; // auto-stop after N seconds (default 60)
  append?: boolean; // whether parent will append (true) or replace (false) when transcript comes
};

export default function VoiceRecorder({
  onTranscript,
  maxSeconds = 60,
  append = true,
}: Props) {
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false); // uploading/transcribing
  const [supported, setSupported] = useState(true);
  const [durationSec, setDurationSec] = useState(0);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTsRef = useRef<number | null>(null);
  const cancelRef = useRef<boolean>(false); // true when user cancels (discard audio, no upload)

  // cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        mediaRef.current?.stop();
      } catch { }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  // update duration when recording
  useEffect(() => {
    if (recording) {
      startTsRef.current = Date.now();
      timerRef.current = window.setInterval(() => {
        if (!startTsRef.current) return;
        setDurationSec(Math.floor((Date.now() - startTsRef.current) / 1000));
      }, 250);
    } else {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setDurationSec(0);
      startTsRef.current = null;
    }
  }, [recording]);

  async function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setSupported(false);
      toast.error("Microphone not available in this browser.");
      return;
    }

    try {
      cancelRef.current = false;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // choose mime that works widely
      const preferred = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
      ];
      let mimeType = preferred.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";

      // fallback to empty string (browser chooses default)
      const options = mimeType ? { mimeType } : undefined;

      const mr = new MediaRecorder(stream as MediaStream, options as any);
      chunksRef.current = [];

      mr.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      mr.onstop = async () => {
        const cancelled = cancelRef.current;
        const hasChunks = chunksRef.current.length > 0;

        // assemble blob (if any)
        let audioBlob: Blob | null = null;
        if (hasChunks) {
          const blobType =
            mimeType ||
            (chunksRef.current[0] instanceof Blob
              ? (chunksRef.current[0] as Blob).type
              : "audio/webm");
          audioBlob = new Blob(chunksRef.current, {
            type: blobType || "audio/webm",
          });
        }

        // reset chunk buffer
        chunksRef.current = [];

        if (cancelled) {
          // fully discard audio, no upload
          cancelRef.current = false;
          try {
            streamRef.current?.getTracks().forEach((t) => t.stop());
          } catch { }
          streamRef.current = null;
          setLoading(false);
          toast("Recording canceled");
          return;
        }

        // no audio? bail
        if (!audioBlob || audioBlob.size === 0) {
          toast.error("No audio recorded.");
          setLoading(false);
          try {
            streamRef.current?.getTracks().forEach((t) => t.stop());
          } catch { }
          streamRef.current = null;
          return;
        }

        // upload and transcribe
        await uploadAndTranscribe(audioBlob);
      };

      mr.onerror = (e: any) => {
        console.error("MediaRecorder error", e);
        toast.error("Recording error");
        setRecording(false);
        setLoading(false);
      };

      mr.start();
      mediaRef.current = mr;
      setRecording(true);
      setLoading(false);
      toast("Recording…", { icon: "🎙️" });

      // auto-stop after maxSeconds
      if (maxSeconds && maxSeconds > 0) {
        window.setTimeout(() => {
          if (mediaRef.current && mediaRef.current.state === "recording") {
            stopRecording();
          }
        }, maxSeconds * 1000);
      }
    } catch (err: any) {
      console.error("mic permission / device error", err);
      toast.error("Could not access microphone. Check permissions.");
      setSupported(false);
      setRecording(false);
      setLoading(false);
    }
  }

  function stopRecording() {
    try {
      // mark as normal stop (not cancel)
      cancelRef.current = false;

      if (mediaRef.current && mediaRef.current.state === "recording") {
        mediaRef.current.stop(); // triggers onstop -> upload
      }
      setRecording(false);
      setLoading(true); // now will upload/transcribe
      toast("Processing audio…", { icon: "⏳" });
    } catch (err: any) {
      console.error("stop error", err);
      toast.error("Failed to stop recording");
      setRecording(false);
      setLoading(false);
    }
  }

  async function cancelRecording() {
    try {
      if (!recording) return;

      // mark as cancel so onstop discards audio
      cancelRef.current = true;

      if (mediaRef.current && mediaRef.current.state === "recording") {
        try {
          mediaRef.current.stop();
        } catch { }
      }

      setRecording(false);
      // do NOT set loading true here; cancel should not upload
    } catch (err) {
      console.warn("cancel cleanup error", err);
      cancelRef.current = false;
      setRecording(false);
      setLoading(false);
    }
  }

  async function uploadAndTranscribe(blob: Blob) {
    try {
      // guard size (~15MB)
      const mb = blob.size / 1024 / 1024;
      if (mb > 15) {
        toast.error("Audio too large (max ~15MB). Try a shorter recording.");
        setLoading(false);
        try {
          streamRef.current?.getTracks().forEach((t) => t.stop());
        } catch { }
        streamRef.current = null;
        return;
      }

      const fd = new FormData();
      const f = new File([blob], "voice.webm", {
        type: blob.type || "audio/webm",
      });
      fd.append("file", f);
      fd.append("tidy", "true");

      const res = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: fd,
      });

      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      if (!res.ok) {
        console.error("transcribe error body:", text);
        toast.error(data?.error ?? "Transcription failed");
        setLoading(false);
        try {
          streamRef.current?.getTracks().forEach((t) => t.stop());
        } catch { }
        streamRef.current = null;
        return;
      }

      const transcript =
        data?.transcript ??
        data?.text ??
        (typeof data === "string" ? data : "");

      if (!transcript || String(transcript).trim().length === 0) {
        toast("No speech detected", { icon: "🤔" });
      } else {
        onTranscript(transcript, true);
        toast.success("Transcript ready");
      }
    } catch (err: any) {
      console.error("upload transcribe error", err);
      toast.error("Transcription failed. Try again.");
    } finally {
      setLoading(false);
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      } catch { }
      streamRef.current = null;
      mediaRef.current = null;
    }
  }

  if (!supported) {
    return (
      <div className="text-xs text-slate-600 dark:text-slate-400">
        Microphone not supported or permission denied.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {recording && (
        <button
          type="button"
          onClick={cancelRecording}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 dark:border-slate-500 text-[11px] text-slate-600 dark:text-slate-300"
          title="Cancel recording"
        >
          ✕
        </button>
      )}

      <button
        type="button"
        onClick={() => (recording ? stopRecording() : startRecording())}
        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm shadow ${recording
            ? "bg-red-600 text-white"
            : "bg-amber-500 text-white"
          }`}
        aria-label={recording ? "Stop recording" : "Start voice recording"}
      >
        {recording ? "■" : "🎤"}
      </button>

      {loading && !recording && (
        <span className="ml-2 text-[11px] text-slate-500 dark:text-slate-300">
          Transcribing…
        </span>
      )}
    </div>
  );  
}
