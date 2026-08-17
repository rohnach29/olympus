"use client";

/**
 * The transport for a morning's broadcast.
 *
 * The only client component in the room: everything else about an episode is
 * server-rendered, and this exists because playback is inherently live state.
 * The waveform is drawn from peaks computed at press time, so the page can
 * show the shape of the show without downloading and decoding the audio.
 *
 * Kept deliberately in the ledger's idiom — hairlines, mono figures, vermilion
 * only for the moving part.
 */

import { useEffect, useRef, useState } from "react";
import type { TranscriptLine } from "@/lib/station/episodes";

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function StationPlayer({
  audioUrl,
  durationS,
  waveform,
  transcript,
  segmentStarts,
}: {
  audioUrl: string | null;
  durationS: number | null;
  waveform: number[];
  transcript: TranscriptLine[];
  segmentStarts: number[];
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  // The element's own duration once known; the stored figure until then, so
  // the total reads correctly before the file has loaded.
  const [total, setTotal] = useState(durationS ?? 0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setAt(audio.currentTime);
    const onMeta = () => {
      if (Number.isFinite(audio.duration)) setTotal(audio.duration);
    };
    const onEnd = () => {
      setPlaying(false);
      setAt(0);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  };

  const seekTo = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(seconds)) return;
    audio.currentTime = Math.max(0, seconds);
    setAt(audio.currentTime);
  };

  const seekFromClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!total) return;
    const box = event.currentTarget.getBoundingClientRect();
    seekTo(((event.clientX - box.left) / box.width) * total);
  };

  const progress = total > 0 ? Math.min(at / total, 1) : 0;

  // Which segment is speaking now: the last one that has started.
  const activeSegment = segmentStarts.reduce(
    (found, start, index) => (at + 0.15 >= start ? index : found),
    -1
  );

  return (
    <section>
      {audioUrl && (
        <>
          {/* The transcript below is the caption, and it is always rendered. */}
          <audio ref={audioRef} src={audioUrl} preload="metadata" />

          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={toggle}
              aria-label={playing ? "Pause the broadcast" : "Play the broadcast"}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--lg-ink)] text-[var(--lg-ink)] transition-colors hover:bg-[var(--lg-ink)] hover:text-[var(--lg-paper)]"
            >
              {playing ? (
                <svg viewBox="0 0 12 14" className="h-[13px] w-[13px]" aria-hidden>
                  <rect x="0" y="0" width="4" height="14" fill="currentColor" />
                  <rect x="8" y="0" width="4" height="14" fill="currentColor" />
                </svg>
              ) : (
                <svg viewBox="0 0 12 14" className="ml-[2px] h-[13px] w-[13px]" aria-hidden>
                  <polygon points="0,0 12,7 0,14" fill="currentColor" />
                </svg>
              )}
            </button>

            {/* The waveform doubles as the scrubber: the shape is the control. */}
            <div
              className="relative grow cursor-pointer"
              style={{ height: 46 }}
              onClick={seekFromClick}
            >
              <svg
                viewBox="0 0 1000 46"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full"
                aria-hidden
              >
                {waveform.map((peak, i) => {
                  const x = (i / Math.max(waveform.length - 1, 1)) * 1000;
                  const half = Math.max((peak / 100) * 20, 0.6);
                  const played = i / Math.max(waveform.length - 1, 1) <= progress;
                  return (
                    <line
                      key={i}
                      x1={x}
                      x2={x}
                      y1={23 - half}
                      y2={23 + half}
                      stroke={played ? "var(--lg-ink)" : "var(--lg-g3)"}
                      strokeWidth={1}
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
              </svg>

              <div
                className="pointer-events-none absolute top-0 h-full w-px bg-[var(--lg-acc)]"
                style={{ left: `${progress * 100}%` }}
              />
            </div>

            <div className="shrink-0 font-[family-name:var(--lg-mono)] text-[11px] tabular-nums tracking-[.08em] text-[var(--lg-mut)]">
              {clock(at)} <span className="text-[var(--lg-g3)]">/</span> {clock(total)}
            </div>
          </div>
        </>
      )}

      <div className="mt-7 space-y-[13px]">
        {transcript.map((line, i) => {
          const start = segmentStarts[i];
          const seekable = audioUrl !== null && start !== undefined;
          const active = seekable && i === activeSegment;

          return (
            <p
              key={i}
              onClick={seekable ? () => seekTo(start) : undefined}
              className={[
                "max-w-[74ch] text-[15px] leading-[1.72] transition-colors",
                seekable ? "cursor-pointer" : "",
                active ? "text-[var(--lg-ink)]" : "text-[var(--lg-g2)]",
              ].join(" ")}
            >
              {seekable && (
                <span
                  className="mr-3 select-none font-[family-name:var(--lg-mono)] text-[10px] tabular-nums"
                  style={{ color: active ? "var(--lg-acc)" : "var(--lg-g3)" }}
                >
                  {clock(start)}
                </span>
              )}
              {line.text}
            </p>
          );
        })}
      </div>
    </section>
  );
}
