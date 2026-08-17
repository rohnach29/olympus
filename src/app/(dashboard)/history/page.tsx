import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getMonthLedger } from "@/lib/ledger/assemble";
import { localDateStr, localHHMM } from "@/lib/ledger/time";
import { getUserTimezone } from "@/lib/utils/timezone";
import { Masthead } from "@/components/ledger/masthead";
import type { AlmanacCell } from "@/lib/ledger/types";

export const dynamic = "force-dynamic";

function hhmm(min: number): string {
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
}

/** One day's print on the wall. */
function Cell({ cell }: { cell: AlmanacCell }) {
  // A day that hasn't happened gets no frame at all — not even a transparent
  // one, since the page-wide border reset would still paint it.
  if (cell.isFuture) {
    return <div className="min-h-[76px]" />;
  }

  if (!cell.printed) {
    return (
      <div className="min-h-[76px] rounded border border-dashed border-[var(--lg-rule)] px-2 py-1.5">
        <div className="font-[family-name:var(--lg-mono)] text-[8px] text-[var(--lg-mut)]">
          {cell.day}
        </div>
        <div className="mt-2 text-[12px] text-[var(--lg-g3)]">— no data</div>
      </div>
    );
  }

  return (
    <Link
      href={cell.isToday ? "/" : `/day/${cell.date}`}
      className={`block min-h-[76px] rounded border bg-[var(--lg-chipbg)] px-2 py-1.5 transition-colors hover:border-[var(--lg-ink)] ${
        cell.isToday ? "border-[var(--lg-acc)]" : "border-[var(--lg-rule)]"
      }`}
    >
      <div className="font-[family-name:var(--lg-mono)] text-[8px] text-[var(--lg-mut)]">
        {cell.day}
      </div>
      <div className="mt-0.5 text-[25px] font-extralight leading-[1.05]">
        {cell.recovery ?? <span className="text-[var(--lg-g3)]">·</span>}
      </div>
      {cell.steps !== null && (
        <div className="font-[family-name:var(--lg-mono)] text-[8px] text-[var(--lg-mut)]">
          {cell.steps.toLocaleString()}
        </div>
      )}
    </Link>
  );
}

const MonthParam = /^\d{4}-\d{2}$/;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const tz = getUserTimezone(user.settings);
  const today = localDateStr(new Date(), tz);

  const { month: requested } = await searchParams;
  const monthStr =
    requested && MonthParam.test(requested) ? requested : today.slice(0, 7);
  const month = await getMonthLedger(user, monthStr);

  const records = [
    month.records.bestRecovery && {
      label: "Best sleep score",
      value: String(month.records.bestRecovery.value),
      date: month.records.bestRecovery.date,
    },
    month.records.mostSteps && {
      label: "Most steps",
      value: month.records.mostSteps.value.toLocaleString(),
      date: month.records.mostSteps.date,
    },
    month.records.longestSleep && {
      label: "Longest sleep",
      value: hhmm(month.records.longestSleep.value),
      date: month.records.longestSleep.date,
    },
  ].filter((r): r is NonNullable<typeof r> => Boolean(r));

  return (
    <div className="ledger">
      <main>
        {/* The Almanac keeps the ledger's masthead proportions but navigates by
            month, so it carries its own header rather than the day sheet's. */}
        <header>
          <div className="flex items-baseline justify-between border-b-2 border-[var(--lg-ink)] pb-4">
            <div className="text-[74px] font-extralight leading-none">
              {month.label}{" "}
              <span className="text-[var(--lg-g3)]">{month.year}</span>
            </div>
            <div className="text-center">
              <div className="text-[13px] font-semibold uppercase tracking-[.44em]">
                Olympus · The Almanac
              </div>
              <div className="ledger-k mt-1.5">
                {month.printedCount} of {month.dayCount} days printed
              </div>
            </div>
            <div className="text-right font-[family-name:var(--lg-mono)] text-[11px] tracking-[.1em] text-[var(--lg-mut)]">
              {localHHMM(new Date(), tz)}
            </div>
          </div>

          <nav className="flex justify-between pb-6 pt-2 font-[family-name:var(--lg-mono)] text-[10px] tracking-[.14em]">
            <Link
              href={`/history?month=${month.prevMonth}`}
              className="text-[var(--lg-mut)] hover:text-[var(--lg-ink)]"
            >
              ← {month.prevMonth}
            </Link>
            <span className="flex gap-2">
              <Link href="/" className="text-[var(--lg-mut)] hover:text-[var(--lg-ink)]">
                TODAY
              </Link>
              <span className="text-[var(--lg-g3)]">·</span>
              <span className="font-bold text-[var(--lg-acc)]">ALMANAC</span>
              <span className="text-[var(--lg-g3)]">·</span>
              <Link
                href="/blood-work"
                className="text-[var(--lg-mut)] hover:text-[var(--lg-ink)]"
              >
                BLOOD WORK
              </Link>
            </span>
            {month.nextMonth ? (
              <Link
                href={`/history?month=${month.nextMonth}`}
                className="text-[var(--lg-mut)] hover:text-[var(--lg-ink)]"
              >
                {month.nextMonth} →
              </Link>
            ) : (
              <span className="text-[var(--lg-g3)]">next month →</span>
            )}
          </nav>
        </header>

        <div className="mb-2 grid grid-cols-7 gap-2 font-[family-name:var(--lg-mono)] text-[8px] tracking-[.2em] text-[var(--lg-mut)]">
          {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: month.leadingBlanks }, (_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {month.cells.map((cell) => (
            <Cell key={cell.date} cell={cell} />
          ))}
        </div>

        {records.length > 0 && (
          <div className="mt-5 flex gap-9 border-t border-[var(--lg-ink)] pt-3 text-[11.5px]">
            {records.map((r) => (
              <div key={r.label}>
                <span className="ledger-k block">{r.label}</span>
                <span className="font-semibold">{r.value}</span> —{" "}
                {r.date.slice(5).replace("-", ".")}
              </div>
            ))}
          </div>
        )}

        <footer className="mt-[18px] flex justify-between border-t border-[var(--lg-ink)] pt-[11px] text-[9px] uppercase tracking-[.26em] text-[var(--lg-mut)]">
          <span>Missed days stay blank — the archive keeps its gaps</span>
          <Link href="/settings" className="hover:text-[var(--lg-ink)]">
            Settings
          </Link>
        </footer>
      </main>
    </div>
  );
}
