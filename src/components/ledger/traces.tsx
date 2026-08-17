/**
 * The four day traces.
 *
 * Each trace is two stacked layers inside its cell: an SVG that carries only
 * geometry, and HTML for any text. The SVG uses `preserveAspectRatio="none"`
 * so a horizontal fraction maps exactly onto a fraction of the container —
 * which is what keeps the traces, the time axis and the now-line in agreement
 * at any window width without measuring anything. `vector-effect` then keeps
 * hairlines hairline-thin under that stretch. Labels stay in HTML because
 * text inside a non-uniformly scaled SVG would be squashed with it.
 */

import type { FuelTrack, HeartTrack, SleepTrack, StepsTrack } from "@/lib/ledger/types";

/** Fraction of the 24-hour axis, clamped to the visible day. */
function pct(t: number): number {
  return (Math.min(Math.max(t, 0), 24) / 24) * 100;
}

const STAGE_FILL: Record<SleepTrack["segments"][number]["stage"], string> = {
  deep: "var(--lg-ink)",
  core: "var(--lg-g3)",
  rem: "var(--lg-g2)",
  awake: "var(--lg-acc)",
};

export function HeartTrace({ track }: { track: HeartTrack }) {
  const H = 84;
  const span = track.ceil - track.floor;
  const y = (v: number) => H - 6 - ((v - track.floor) / span) * (H - 16);

  return (
    <div className="relative" style={{ height: H }}>
      <svg
        viewBox={`0 0 1000 ${H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        {track.runs.map((run, i) =>
          run.length === 1 ? (
            <circle
              key={i}
              cx={(run[0].t / 24) * 1000}
              cy={y(run[0].v)}
              r={1.5}
              fill="var(--lg-ink)"
            />
          ) : (
            <polyline
              key={i}
              points={run.map((p) => `${(p.t / 24) * 1000},${y(p.v)}`).join(" ")}
              fill="none"
              stroke="var(--lg-ink)"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          )
        )}
      </svg>

      {track.peak !== null && track.peakAt !== null && (
        <span
          className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap font-[family-name:var(--lg-mono)] text-[10px] text-[var(--lg-mut)]"
          style={{ left: `${pct(track.peakAt)}%`, top: 0 }}
        >
          {track.peak} peak
        </span>
      )}
    </div>
  );
}

export function SleepTrace({ track }: { track: SleepTrack }) {
  const H = 40;
  const last = track.segments[track.segments.length - 1];

  return (
    <div className="relative" style={{ height: H }}>
      {track.segments.map((s, i) => {
        const left = pct(s.from);
        const right = pct(s.to);
        if (right <= left) return null;
        return (
          <div
            key={i}
            className="absolute rounded-[2px]"
            style={{
              left: `${left}%`,
              width: `calc(${right - left}% - 1.5px)`,
              top: 7,
              height: 26,
              background: STAGE_FILL[s.stage],
            }}
          />
        );
      })}

      {track.carriesOver && (
        <span
          className="absolute font-[family-name:var(--lg-mono)] text-[10px] text-[var(--lg-g2)]"
          style={{ left: 0, top: 12 }}
          title="This night began before midnight"
        >
          ◀
        </span>
      )}

      <span
        className="absolute whitespace-nowrap font-[family-name:var(--lg-mono)] text-[10px] text-[var(--lg-mut)]"
        style={{ left: `calc(${pct(last?.to ?? 8)}% + 10px)`, top: 12 }}
      >
        {track.bedtime} — {track.wake}
        {track.score !== null ? ` · score ${track.score}` : ""}
      </span>
    </div>
  );
}

export function FuelTrace({
  track,
  unloggedNote,
}: {
  track: FuelTrack;
  unloggedNote: string | null;
}) {
  const H = 50;
  const maxKcal = Math.max(...track.meals.map((m) => m.kcal), 1);

  return (
    <div className="relative" style={{ height: H }}>
      {track.meals.map((m, i) => {
        const r = 4 + (m.kcal / maxKcal) * 8;
        return (
          <div key={i} className="absolute" style={{ left: `${pct(m.t)}%`, top: 18 }}>
            <div
              className="-translate-x-1/2 -translate-y-1/2 rounded-full border-[1.8px] border-[var(--lg-ink)]"
              style={{
                width: r * 2,
                height: r * 2,
                // A meal whose time we had to guess is drawn dashed, so the
                // circle never implies a precision the log cannot support.
                borderStyle: m.approximate ? "dashed" : "solid",
              }}
            />
            <span className="absolute left-0 top-[16px] -translate-x-1/2 whitespace-nowrap font-[family-name:var(--lg-mono)] text-[9.5px] text-[var(--lg-mut)]">
              {m.label}
            </span>
          </div>
        );
      })}

      {unloggedNote && (
        <span
          className="absolute font-[family-name:var(--lg-mono)] text-[10px] text-[var(--lg-g3)]"
          style={{ left: "86%", top: 14 }}
        >
          {unloggedNote}
        </span>
      )}
    </div>
  );
}

export function StepsTrace({
  track,
  uptoHour,
}: {
  track: StepsTrack;
  uptoHour: number;
}) {
  const H = 54;
  const max = Math.max(...track.hourly, 1);

  return (
    <div className="relative flex items-end gap-[2px]" style={{ height: H }}>
      {track.hourly.map((v, h) => {
        const future = h > uptoHour;
        const height = future ? 0 : Math.max((v / max) * (H - 12), v > 0 ? 1.5 : 0);
        return (
          <div key={h} className="flex-1" style={{ height: H - 8 }}>
            <div
              className="w-full rounded-[1.5px]"
              style={{
                height,
                marginTop: H - 8 - height,
                background:
                  h === track.peakHour ? "var(--lg-acc)" : "var(--lg-g3)",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
