import Link from "next/link";
import type { DayLedger } from "@/lib/ledger/types";

/**
 * The week as one thin line above the footer.
 *
 * A day with no data is a dashed rule rather than a zero-height bar — the
 * archive is honest about its gaps instead of implying you stood still.
 */
export function WeekStrip({ week }: { week: DayLedger["week"] }) {
  return (
    <section className="mt-[26px] flex items-center gap-[18px] border-t border-[var(--lg-ink)] pt-[13px]">
      <span className="ledger-k">The week</span>

      <div className="flex h-[22px] items-end gap-[5px]">
        {week.days.map((d) => {
          const height = d.recovery !== null ? 6 + (d.recovery / 100) * 16 : 0;
          const bar =
            d.recovery !== null ? (
              <span
                className="block w-[22px] rounded-[1px]"
                style={{
                  height,
                  background: d.isViewed ? "var(--lg-acc)" : "var(--lg-g3)",
                }}
              />
            ) : (
              <span className="block w-[22px] border-t-2 border-dashed border-[var(--lg-g3)]" />
            );

          return d.printed ? (
            <Link
              key={d.date}
              href={d.isToday ? "/" : `/day/${d.date}`}
              title={`${d.date}${d.steps ? ` · ${d.steps.toLocaleString()} steps` : ""}`}
              className="flex flex-col items-center justify-end"
              style={{ height: 22 }}
            >
              {bar}
            </Link>
          ) : (
            <span
              key={d.date}
              className="flex flex-col items-center justify-end"
              style={{ height: 22 }}
            >
              {bar}
            </span>
          );
        })}
      </div>

      <span className="font-[family-name:var(--lg-mono)] text-[9px] tracking-[.28em] text-[var(--lg-mut)]">
        {week.days.map((d) => d.label).join(" ")}
      </span>

      <span className="ml-auto text-[12px]">
        {week.best ? (
          <>
            Best this week <span className="font-semibold">{week.best.score}</span> —{" "}
            {week.best.date.slice(5).replace("-", ".")}
          </>
        ) : (
          <span className="text-[var(--lg-mut)]">No verdict printed this week yet</span>
        )}
        <Link
          href="/history"
          className="ml-3 font-[family-name:var(--lg-mono)] text-[9px] tracking-[.14em] text-[var(--lg-mut)] hover:text-[var(--lg-ink)]"
        >
          FULL WALL → ALMANAC
        </Link>
      </span>
    </section>
  );
}
