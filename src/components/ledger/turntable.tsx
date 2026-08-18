"use client";

/**
 * The 45.
 *
 * Each episode is a single pressed overnight: the record spins while it
 * plays, the tonearm tracks inward with progress, the transcript is the
 * B-side, and the archive is a crate of sleeves. The only client component
 * in the room — playback is inherently live state; everything around it is
 * server-rendered paper.
 *
 * A morning without audio is an "unpressed" sleeve: the cover exists, the
 * record doesn't, and the B-side still reads.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { TranscriptLine } from "@/lib/station/episodes";

export interface CrateSleeve {
  airDate: string;
  hasAudio: boolean;
  durationS: number | null;
}

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function shortDate(dateStr: string): string {
  return dateStr.slice(5).replace("-", ".");
}

/** The vinyl surface: fine concentric grooves under a soft light sheen. */
const GROOVES =
  "repeating-radial-gradient(circle, #17171a 0 1.6px, #202024 1.6px 3.2px)";
const SHEEN =
  "conic-gradient(from 40deg, transparent 0 30deg, rgba(255,255,255,.10) 40deg 55deg, transparent 65deg 200deg, rgba(255,255,255,.07) 215deg 225deg, transparent 235deg)";

export function Turntable({
  audioUrl,
  durationS,
  status,
  airDate,
  weekday,
  voice,
  aSide,
  bw,
  transcript,
  segmentStarts,
  shelf,
}: {
  audioUrl: string | null;
  durationS: number | null;
  status: string;
  airDate: string;
  weekday: string;
  voice: string;
  aSide: string;
  bw: string | null;
  transcript: TranscriptLine[];
  segmentStarts: number[];
  shelf: CrateSleeve[];
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  // The element's own duration once known; the stored figure until then.
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

  const progress = total > 0 ? Math.min(at / total, 1) : 0;
  // The stylus starts on the outer groove and finishes at the run-out; the
  // arm hangs from a pivot above the platter, so a larger angle swings the
  // headshell further inward. 15° puts it on the lead-in, 37° at the label.
  const armAngle = 15 + progress * 22;

  // Which segment is speaking now: the last one that has started. Before the
  // needle has dropped at all, nothing is "now".
  const started = playing || at > 0;
  const activeSegment = started
    ? segmentStarts.reduce(
        (found, start, index) => (at + 0.15 >= start ? index : found),
        -1
      )
    : -1;

  const runtime = total > 0 ? clock(total) : null;

  return (
    <section>
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="metadata" />}

      <div className="mt-9 grid items-center gap-11 lg:grid-cols-[520px_1fr] lg:gap-16">
        {/* ---- the platter (or the empty sleeve) ---- */}
        {audioUrl ? (
          <div className="relative mx-auto h-[470px] w-[470px] max-w-full">
            <div
              className="lg-spin absolute inset-0 cursor-pointer rounded-full"
              style={{
                backgroundImage: GROOVES,
                boxShadow: "0 24px 56px rgba(19,19,18,.4)",
                animationPlayState: playing ? "running" : "paused",
              }}
              onClick={toggle}
              aria-hidden
            >
              <div
                className="absolute inset-0 rounded-full"
                style={{ backgroundImage: SHEEN }}
              />
            </div>

            {/* The label sits above the platter and does not spin — a spinning
                title is a party trick you can't read. */}
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 flex h-[172px] w-[172px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full text-center font-[family-name:var(--lg-mono)] text-[var(--lg-paper)]"
              style={{ background: "var(--lg-acc)" }}
            >
              <span className="text-[9.5px] uppercase tracking-[.3em]" style={{ textIndent: ".3em" }}>
                Station Olympus
              </span>
              <span className="mt-[5px] text-[17px] font-bold tracking-[.14em]">
                87.4
              </span>
              {/* The spindle hole sits in the stack, so the text never has to
                  dodge it. */}
              <span className="my-[6px] h-[10px] w-[10px] rounded-full bg-[var(--lg-paper)]" />
              <span className="text-[9px] leading-[1.6] tracking-[.12em] opacity-85">
                MORNING REPORT
                <br />
                {weekday.slice(0, 3).toUpperCase()} {shortDate(airDate)}
                {runtime ? ` · ${runtime}` : ""}
              </span>
              <span className="mt-[9px] text-[8.5px] tracking-[.18em] opacity-85">
                45 RPM · {voice} · SIDE A
              </span>
            </div>

            {/* The tonearm: pivot top-right, stylus tracking inward. */}
            <div className="pointer-events-none absolute right-[4px] top-[-18px] h-[260px] w-[220px]" aria-hidden>
              <span
                className="absolute right-[17px] top-[17px] block h-[232px] w-[4px] rounded-[2px]"
                style={{
                  background: "linear-gradient(#d9d7d0, #a8a6a0)",
                  transformOrigin: "top center",
                  transform: `rotate(${armAngle}deg)`,
                  transition: "transform .3s ease-out",
                }}
              >
                <span
                  className="absolute bottom-[-4px] left-[-7px] block h-[25px] w-[17px] rounded-[3px] bg-[var(--lg-ink)]"
                  style={{ transform: "rotate(-14deg)" }}
                />
              </span>
              <span
                className="absolute right-0 top-0 block h-[38px] w-[38px] rounded-full"
                style={{
                  background: "radial-gradient(circle at 35% 30%, #f2f0ea, #b8b6ae)",
                  boxShadow: "0 4px 10px rgba(19,19,18,.3)",
                }}
              />
            </div>
          </div>
        ) : (
          /* No record was pressed for this morning — the sleeve is empty. */
          <div className="relative mx-auto flex h-[420px] w-[420px] max-w-full flex-col items-center justify-center overflow-hidden border border-[var(--lg-rule)] bg-[#efe9db] text-center">
            <span
              className="absolute right-[-105px] top-1/2 h-[210px] w-[210px] -translate-y-1/2 rounded-full border-[1.5px] border-dashed border-[var(--lg-mut)] opacity-50"
              aria-hidden
            />
            <span className="font-[family-name:var(--lg-mono)] text-[13px] font-bold tracking-[.14em]">
              {weekday.slice(0, 3).toUpperCase()} {shortDate(airDate)}
            </span>
            <span className="mt-3 font-[family-name:var(--lg-mono)] text-[10px] tracking-[.28em] text-[var(--lg-acc)]" style={{ textIndent: ".28em" }}>
              {status === "expired" ? "AUDIO EXPIRED" : "UNPRESSED"}
            </span>
            <span className="mt-2 max-w-[26ch] text-[13px] italic leading-[1.6] text-[var(--lg-g2)]">
              the B-side survives — read it below
            </span>
          </div>
        )}

        {/* ---- the label side ---- */}
        <div>
          <div className="font-[family-name:var(--lg-mono)] text-[11px] uppercase tracking-[.22em]">
            {audioUrl ? (
              <>
                Now spinning — <b className="text-[var(--lg-acc)]">Side A</b>
              </>
            ) : (
              <>This morning — written, not pressed</>
            )}
          </div>
          <div className="mt-3 max-w-[18ch] text-[34px] font-extralight leading-[1.25]">
            &ldquo;{aSide}&rdquo;
          </div>
          <div className="mt-3.5 font-[family-name:var(--lg-mono)] text-[10.5px] uppercase leading-[2.1] tracking-[.12em] text-[var(--lg-mut)]">
            {bw && (
              <>
                b/w &ldquo;{bw}&rdquo;
                <br />
              </>
            )}
            Pressed 11:00 · One take · {voice}
            <br />
            Every number checked before pressing
          </div>

          {audioUrl && (
            <div className="mt-5 flex items-center gap-4">
              <button
                type="button"
                onClick={toggle}
                aria-label={playing ? "Pause the record" : "Play the record"}
                className="grid h-[62px] w-[62px] shrink-0 place-items-center rounded-full border-[1.5px] border-[var(--lg-ink)] text-[var(--lg-ink)] transition-colors hover:bg-[var(--lg-ink)] hover:text-[var(--lg-paper)]"
              >
                {playing ? (
                  <svg viewBox="0 0 12 14" className="h-[19px] w-[16px]" aria-hidden>
                    <rect x="0" y="0" width="4" height="14" fill="currentColor" />
                    <rect x="8" y="0" width="4" height="14" fill="currentColor" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 12 14" className="ml-[3px] h-[19px] w-[16px]" aria-hidden>
                    <polygon points="0,0 12,7 0,14" fill="currentColor" />
                  </svg>
                )}
              </button>
              <span className="font-[family-name:var(--lg-mono)] text-[11.5px] tabular-nums tracking-[.14em] text-[var(--lg-g2)]">
                <b className="font-semibold text-[var(--lg-ink)]">{clock(at)}</b> / {clock(total)}
                {playing ? " · needle in the groove" : at > 0 ? " · needle lifted" : ""}
              </span>
            </div>
          )}

          {/* ---- the crate ---- */}
          <div className="mt-6 border-t border-[var(--lg-ink)] pt-3">
            <span className="ledger-k font-semibold text-[var(--lg-ink)]">The crate</span>
            <div className="mt-3 flex flex-wrap gap-3">
              {shelf.map((sleeve) => {
                const current = sleeve.airDate === airDate;
                return (
                  <Link
                    key={sleeve.airDate}
                    href={`/station?date=${sleeve.airDate}`}
                    className={`relative h-[118px] w-[118px] overflow-hidden border bg-[#efe9db] p-[10px] ${
                      current ? "border-[var(--lg-acc)]" : "border-[var(--lg-rule)]"
                    }`}
                  >
                    <span
                      className={`font-[family-name:var(--lg-mono)] text-[10px] font-bold tracking-[.12em] ${
                        current ? "text-[var(--lg-acc)]" : "text-[var(--lg-ink)]"
                      }`}
                    >
                      {shortDate(sleeve.airDate)}
                    </span>
                    <span className="mt-1 block font-[family-name:var(--lg-mono)] text-[9px] tabular-nums text-[var(--lg-mut)]">
                      {sleeve.hasAudio && sleeve.durationS
                        ? clock(sleeve.durationS)
                        : "unpressed"}
                    </span>
                    {/* The record peeking out — only if one was pressed. */}
                    {sleeve.hasAudio && (
                      <span
                        className="absolute right-[-30px] top-1/2 h-[60px] w-[60px] -translate-y-1/2 rounded-full"
                        style={{ backgroundImage: GROOVES }}
                        aria-hidden
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ---- the B-side ---- */}
      <div className="mt-8 flex items-baseline justify-between border-t border-[var(--lg-ink)] pt-3">
        <span className="ledger-k font-semibold text-[var(--lg-ink)]">
          The B-side — the transcript
        </span>
        {audioUrl && segmentStarts.length > 0 && (
          <span className="ledger-k">Click a timestamp to drop the needle</span>
        )}
      </div>
      <div className="mt-4 columns-1 lg:columns-3 lg:[column-gap:44px] lg:[column-rule:1px_solid_var(--lg-rule)]">
        {transcript.map((line, i) => {
          const start = segmentStarts[i];
          const seekable = audioUrl !== null && start !== undefined;
          const active = seekable && i === activeSegment;

          return (
            <div
              key={i}
              onClick={seekable ? () => seekTo(start) : undefined}
              className={`mb-5 [break-inside:avoid] ${seekable ? "cursor-pointer" : ""}`}
            >
              <span
                className={`mb-[5px] block font-[family-name:var(--lg-mono)] text-[10px] tabular-nums tracking-[.14em] ${
                  active ? "text-[var(--lg-acc)]" : "text-[var(--lg-g3)]"
                }`}
              >
                {seekable || start !== undefined ? clock(start ?? 0) : `№ ${i + 1}`}
                {active ? " — NOW" : ""}
              </span>
              <p
                className={`m-0 text-[14.5px] italic leading-[1.66] ${
                  active
                    ? "border-l-2 border-[var(--lg-acc)] pl-3.5 text-[var(--lg-ink)]"
                    : "text-[var(--lg-g2)]"
                }`}
              >
                &ldquo;{line.text}&rdquo;
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
