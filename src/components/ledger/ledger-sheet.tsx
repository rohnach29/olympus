import { Masthead } from "./masthead";
import { VerdictBand } from "./verdict-band";
import { TrackRow, TracksGrid, TimeAxis } from "./tracks-grid";
import { HeartTrace, SleepTrace, FuelTrace, StepsTrace } from "./traces";
import { WeekStrip } from "./week-strip";
import type { DayLedger } from "@/lib/ledger/types";

function hhmm(min: number): string {
  return `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, "0")}`;
}

function Strong({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-[var(--lg-ink)]">{children}</span>;
}

/**
 * A whole day, typeset.
 *
 * Today and any closed day are the same sheet — the only differences are the
 * now-line, whether the step bars stop at the current hour, and the footnotes
 * a finished day carries. Keeping them in one component means a fix to the
 * layout is a fix in both places.
 */
export function LedgerSheet({
  ledger,
  room,
  clockInitial,
}: {
  ledger: DayLedger;
  room: "today" | "closed";
  clockInitial: string;
}) {
  const { tracks, isToday, nowT } = ledger;
  const uptoHour = isToday && nowT !== null ? Math.floor(nowT) : 23;

  // Only call dinner missing once the evening is actually over.
  const dinnerUnlogged =
    tracks.fuel !== null &&
    isToday &&
    nowT !== null &&
    nowT > 21 &&
    (tracks.fuel.lastMealT ?? 0) < 18;

  return (
    <main>
      {/* A closed day highlights nothing in the nav: you are looking at an
          issue from the archive, not at any of the three standing rooms. */}
      <Masthead
        ledger={ledger}
        room={room === "today" ? "today" : "none"}
        clockInitial={clockInitial}
      />

      <VerdictBand verdict={ledger.verdict} />

      <div className="flex items-baseline justify-between pb-2.5 pt-[22px]">
        <span className="text-[10px] font-semibold uppercase tracking-[.3em]">
          The day, left to right
        </span>
        <span
          className={`font-[family-name:var(--lg-mono)] text-[11px] tracking-[.14em] ${
            room === "today" ? "text-[var(--lg-acc)]" : "text-[var(--lg-mut)]"
          }`}
        >
          {room === "today" ? "DAY IN PROGRESS" : "DAY CLOSED 24:00"}
        </span>
      </div>

      <TracksGrid nowT={room === "today" ? nowT : null} tz={ledger.tz}>
        <TrackRow
          label={
            <>
              Heart
              <br />
              BPM
            </>
          }
          unprinted="UNPRINTED — NO HEART-RATE SAMPLES"
          figure={
            tracks.heart && (
              <>
                {tracks.heart.rest ?? tracks.heart.low}{" "}
                <span className="text-[13px] font-normal text-[var(--lg-mut)]">
                  {tracks.heart.rest !== null ? "rest" : "low"}
                </span>
              </>
            )
          }
          detail={
            tracks.heart && (
              <>
                peak <Strong>{tracks.heart.peak}</Strong> · strain{" "}
                <Strong>{ledger.verdict.chips.strain.value.toFixed(1)}</Strong>
              </>
            )
          }
        >
          {tracks.heart && <HeartTrace track={tracks.heart} />}
        </TrackRow>

        <TrackRow
          label="Sleep"
          unprinted="UNPRINTED — NO SLEEP RECORDED"
          figure={tracks.sleep && hhmm(tracks.sleep.totalMin)}
          detail={
            // All three stages are shown because they add up to the headline
            // figure. Printing only deep and REM left most of the night
            // unaccounted for, so the row could not be checked.
            tracks.sleep && (
              <>
                deep <Strong>{hhmm(tracks.sleep.deepMin)}</Strong> · core{" "}
                <Strong>{hhmm(tracks.sleep.coreMin)}</Strong> · rem{" "}
                <Strong>{hhmm(tracks.sleep.remMin)}</Strong>
              </>
            )
          }
        >
          {tracks.sleep && <SleepTrace track={tracks.sleep} />}
        </TrackRow>

        <TrackRow
          label="Fuel"
          unprinted="UNPRINTED — NOTHING LOGGED"
          figure={
            tracks.fuel && (
              <>
                {tracks.fuel.kcal.toLocaleString()}{" "}
                <span className="text-[13px] font-normal text-[var(--lg-mut)]">kcal</span>
              </>
            )
          }
          detail={
            tracks.fuel && (
              <>
                protein <Strong>{tracks.fuel.proteinG} g</Strong> · fibre{" "}
                <Strong>{tracks.fuel.fibreG} g</Strong>
              </>
            )
          }
        >
          {tracks.fuel && (
            <FuelTrace
              track={tracks.fuel}
              unloggedNote={dinnerUnlogged ? "dinner — unlogged" : null}
            />
          )}
        </TrackRow>

        <TrackRow
          label={
            <>
              Steps
              <br />
              per hr
            </>
          }
          unprinted="UNPRINTED — NO MOVEMENT DATA"
          figure={tracks.steps && tracks.steps.total.toLocaleString()}
          detail={
            tracks.steps &&
            (tracks.steps.peakHour !== null ? (
              <>
                busiest hour{" "}
                <Strong>{String(tracks.steps.peakHour).padStart(2, "0")}:00</Strong>
              </>
            ) : null)
          }
        >
          {tracks.steps && <StepsTrace track={tracks.steps} uptoHour={uptoHour} />}
        </TrackRow>
      </TracksGrid>

      <TimeAxis />

      {room === "closed" && ledger.footnotes.length > 0 && (
        <p className="m-0 pt-2.5 font-[family-name:var(--lg-mono)] text-[9px] leading-[1.8] tracking-[.1em] text-[var(--lg-mut)]">
          FOOTNOTES —{" "}
          {ledger.footnotes.map((f, i) => (
            <span key={f}>
              {i > 0 && " · "}
              <sup>{i + 1}</sup> {f}
            </span>
          ))}
        </p>
      )}

      <WeekStrip week={ledger.week} />

      {/* Settings moved up into the masthead nav, so the colophon is left with
          just the issue line it always was. */}
      <footer className="mt-[18px] border-t border-[var(--lg-ink)] pt-[11px] text-[9px] uppercase tracking-[.26em] text-[var(--lg-mut)]">
        Report No. {ledger.reportNo} ·{" "}
        {room === "today" ? "Printed continuously" : "Day closed"}
      </footer>
    </main>
  );
}
