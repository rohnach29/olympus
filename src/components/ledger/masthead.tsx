import Link from "next/link";
import { Clock } from "./clock";
import type { DayLedger } from "@/lib/ledger/types";

type Room = "today" | "station" | "almanac" | "blood" | "none";

function shortDate(dateStr: string): string {
  return dateStr.slice(5).replace("-", ".");
}

/**
 * The top of the sheet: the date at broadsheet size, the title, and the day's
 * standing. Navigation lives here rather than in a sidebar — you move through
 * the ledger the way you turn pages, by date.
 */
export function Masthead({
  ledger,
  room,
  clockInitial,
}: {
  ledger: Pick<
    DayLedger,
    "date" | "tz" | "weekday" | "city" | "reportNo" | "watch" | "prevDate" | "nextDate" | "isToday"
  >;
  room: Room;
  clockInitial: string;
}) {
  const sync = ledger.watch.lastSyncedLabel
    ? `⌚ synced ${ledger.watch.lastSyncedLabel}`
    : "⌚ no sync yet";

  const navLink = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      className={
        active
          ? "font-bold text-[var(--lg-acc)]"
          : "text-[var(--lg-mut)] hover:text-[var(--lg-ink)]"
      }
    >
      {label}
    </Link>
  );

  return (
    <header>
      <div className="flex items-baseline justify-between border-b-2 border-[var(--lg-ink)] pb-4">
        <div className="text-[74px] font-extralight leading-none tracking-[.01em]">
          {shortDate(ledger.date)}
        </div>

        <div className="text-center">
          <div className="text-[13px] font-semibold uppercase tracking-[.44em]">
            Olympus · Daily Ledger
          </div>
          <div className="ledger-k mt-1.5">
            {ledger.weekday} — {ledger.city} — Report № {ledger.reportNo}
          </div>
        </div>

        <div className="text-right font-[family-name:var(--lg-mono)] text-[11px] leading-[1.9] tracking-[.1em] text-[var(--lg-mut)]">
          {ledger.isToday ? <Clock tz={ledger.tz} initial={clockInitial} /> : "—"}
          <br />
          <span className="font-semibold text-[var(--lg-ink)]">{sync}</span>
        </div>
      </div>

      <nav className="flex justify-between pt-2 font-[family-name:var(--lg-mono)] text-[10px] tracking-[.14em]">
        <Link
          href={`/day/${ledger.prevDate}`}
          className="text-[var(--lg-mut)] hover:text-[var(--lg-ink)]"
        >
          ← {shortDate(ledger.prevDate)}
        </Link>

        <span className="flex gap-2">
          {navLink("/", "TODAY", room === "today")}
          <span className="text-[var(--lg-g3)]">·</span>
          {navLink("/station", "STATION", room === "station")}
          <span className="text-[var(--lg-g3)]">·</span>
          {navLink("/history", "ALMANAC", room === "almanac")}
          <span className="text-[var(--lg-g3)]">·</span>
          {navLink("/blood-work", "BLOOD WORK", room === "blood")}
        </span>

        {ledger.nextDate ? (
          // A next date that turns out to be today is redirected to "/" by the
          // day page, so this link is correct either way.
          <Link
            href={`/day/${ledger.nextDate}`}
            className="text-[var(--lg-mut)] hover:text-[var(--lg-ink)]"
          >
            {shortDate(ledger.nextDate)} →
          </Link>
        ) : (
          <span className="text-[var(--lg-g3)]">tomorrow →</span>
        )}
      </nav>
    </header>
  );
}
