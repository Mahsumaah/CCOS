"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { splitTextForTranscriptSegments } from "@/lib/live-transcript-chunks";
import {
  createSpeechRecognition,
  getSpeechRecognitionLang,
  isBrowserSpeechRecognitionSupported,
  type SpeechRecognitionLike,
} from "@/lib/live-web-speech";

const FLUSH_MS = 12_000;

type UseLiveSpeechCaptionsParams = {
  meetingId: string;
  liveSessionId: string | null;
  locale: "ar" | "en";
  speakerUserId: string;
  speakerName: string;
  captionsActive: boolean;
  /** When false, hook does not start recognition (e.g. missing permission server-side). */
  canPostTranscript: boolean;
  onPosted?: () => void;
  onErrorKey?: (key: string) => void;
};

export function useLiveSpeechCaptions({
  meetingId,
  liveSessionId,
  locale,
  speakerUserId,
  speakerName,
  captionsActive,
  canPostTranscript,
  onPosted,
  onErrorKey,
}: UseLiveSpeechCaptionsParams) {
  const [listening, setListening] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const bufferRef = useRef<string[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setUnsupported(!isBrowserSpeechRecognitionSupported());
  }, []);

  const flush = useCallback(async () => {
    const parts = bufferRef.current;
    if (parts.length === 0) return;
    const combined = parts.join(" ").trim();
    bufferRef.current = [];
    if (!combined) return;

    const segments = splitTextForTranscriptSegments(combined).map((text) => ({
      text,
      speakerName,
      speakerUserId,
      language: locale,
    }));

    try {
      const res = await fetch(`/api/meetings/${meetingId}/live/transcript`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          liveSessionId,
          segments,
        }),
      });
      if (!res.ok) {
        onErrorKey?.("postFailed");
        return;
      }
      onPosted?.();
    } catch {
      onErrorKey?.("postFailed");
    }
  }, [liveSessionId, locale, meetingId, onErrorKey, onPosted, speakerName, speakerUserId]);

  const stopInternal = useCallback(() => {
    if (flushTimerRef.current) {
      clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    const r = recRef.current;
    recRef.current = null;
    if (r) {
      try {
        r.stop();
      } catch {
        try {
          r.abort();
        } catch {
          /* ignore */
        }
      }
    }
    void flush();
    setListening(false);
  }, [flush]);

  const start = useCallback(() => {
    if (!canPostTranscript) return;
    if (!isBrowserSpeechRecognitionSupported()) {
      setUnsupported(true);
      return;
    }
    setUnsupported(false);
    const rec = createSpeechRecognition();
    if (!rec) {
      setUnsupported(true);
      return;
    }

    stopInternal();

    rec.lang = getSpeechRecognitionLang(locale);
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
        const res = ev.results.item(i);
        if (!res.isFinal) continue;
        const t = res[0]?.transcript?.trim();
        if (t) bufferRef.current.push(t);
      }
    };

    rec.onerror = (ev) => {
      if (ev.error === "aborted" || ev.error === "no-speech") return;
      onErrorKey?.(ev.error || "unknown");
    };

    rec.onend = () => {
      if (recRef.current === rec) {
        try {
          rec.start();
        } catch {
          /* may throw if not allowed */
        }
      }
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch {
      onErrorKey?.("startFailed");
      recRef.current = null;
      return;
    }

    setListening(true);
    flushTimerRef.current = setInterval(() => {
      void flush();
    }, FLUSH_MS);
  }, [canPostTranscript, flush, locale, onErrorKey, stopInternal]);

  const stop = useCallback(() => {
    stopInternal();
  }, [stopInternal]);

  useEffect(() => {
    if (!captionsActive) {
      stopInternal();
    }
  }, [captionsActive, stopInternal]);

  useEffect(() => {
    return () => {
      stopInternal();
    };
  }, [meetingId, stopInternal]);

  return { listening, unsupported, start, stop, flushNow: flush };
}
