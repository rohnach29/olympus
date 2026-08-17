"use client";

import { useEffect, useState } from "react";

/**
 * The masthead clock.
 *
 * Seeded with the time the server rendered, so the first client render is
 * identical to the HTML and there is no hydration flash. It then re-aligns to
 * the wall minute rather than ticking every 60s from an arbitrary offset, so
 * the displayed minute changes when the minute actually changes.
 */
export function Clock({ tz, initial }: { tz: string; initial: string }) {
  const [now, setNow] = useState(initial);

  useEffect(() => {
    const read = () =>
      new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date());

    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(read());
      timer = setTimeout(tick, msToNextMinute());
    };
    timer = setTimeout(tick, msToNextMinute());
    return () => clearTimeout(timer);
  }, [tz]);

  return <>{now}</>;
}

function msToNextMinute(): number {
  const now = Date.now();
  return 60_000 - (now % 60_000);
}
