"use client";

import { useEffect, useState } from "react";

/**
 * The red rule marking the present moment across the day's tracks.
 *
 * Positioned as a percentage of the plot area, and seeded from the server's
 * `initialT` so the line is in the HTML at the right place before any
 * JavaScript runs — it neither pops in on hydration nor disappears if the
 * script fails. The parent pins this to the grid's trace column, so alignment
 * with the traces and the axis is structural rather than measured.
 */
export function NowLine({ initialT, tz }: { initialT: number; tz: string }) {
  const [t, setT] = useState(initialT);

  useEffect(() => {
    const read = () => {
      const [h, m] = new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      })
        .format(new Date())
        .split(":")
        .map(Number);
      return h + m / 60;
    };

    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setT(read());
      timer = setTimeout(tick, 60_000 - (Date.now() % 60_000));
    };
    timer = setTimeout(tick, 60_000 - (Date.now() % 60_000));
    return () => clearTimeout(timer);
  }, [tz]);

  if (t < 0 || t > 24) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 w-[1.5px] bg-[var(--lg-acc)]"
      style={{ left: `${(t / 24) * 100}%` }}
    />
  );
}
