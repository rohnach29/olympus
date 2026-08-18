import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserTimezone } from "@/lib/utils/timezone";
import { localDateStr, localHHMM, weekdayName } from "@/lib/ledger/time";
import {
  aSideTitle,
  bwTitle,
  getEpisodeOnOrBefore,
  listEpisodes,
  segmentStartsOf,
  transcriptOf,
} from "@/lib/station/episodes";
import { Clock } from "@/components/ledger/clock";
import { Turntable } from "@/components/ledger/turntable";

// The room reports whether this morning's pressing has landed yet, so it is
// never cached.
export const dynamic = "force-dynamic";

function shortDate(dateStr: string): string {
  return dateStr.slice(5).replace("-", ".");
}

function listeningTotal(seconds: number): string {
  if (seconds <= 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

/** "gemini-3.1-flash-tts-preview" → the credit that fits on a record label. */
function voiceCredit(ttsModel: string | null): string {
  if (ttsModel?.includes("3.1")) return "CHARON 3.1";
  if (ttsModel?.includes("2.5")) return "CHARON 2.5";
  return "CHARON";
}

export default async function StationPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const tz = getUserTimezone(user.settings);
  const today = localDateStr(new Date(), tz);

  const { date: requested } = await searchParams;
  const wanted =
    requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : today;

  const [episode, shelf] = await Promise.all([
    getEpisodeOnOrBefore(user.id, wanted),
    listEpisodes(user.id),
  ]);

  const airDate = episode?.airDate ?? null;
  const transcript = episode ? transcriptOf(episode) : [];

  // Flipping through the crate: the shelf is newest-first, so the previous
  // pressing sits after the viewed one and the next before it.
  const shelfIndex = airDate ? shelf.findIndex((s) => s.airDate === airDate) : -1;
  const older = shelfIndex >= 0 ? shelf[shelfIndex + 1] : undefined;
  const newer = shelfIndex > 0 ? shelf[shelfIndex - 1] : undefined;

  const onAir = airDate === today && episode?.audioUrl !== null;
  const pressed = shelf.filter((s) => s.hasAudio);
  const totalListening = pressed.reduce((sum, s) => sum + (s.durationS ?? 0), 0);

  return (
    <div className="ledger">
      {/* The other rooms stretch to fill any desk, but a record sleeve has a
          natural size — past ~1480px the stage starts leaving acres of empty
          paper on the right, so the whole room centers itself instead. */}
      <main className="mx-auto max-w-[1480px]">
        {/* The station is filed by broadcast rather than by day, so it keeps
            the ledger's nav but carries its own centered masthead. */}
        <nav className="flex items-baseline justify-between pb-6 font-[family-name:var(--lg-mono)] text-[10px] tracking-[.14em] text-[var(--lg-mut)]">
          {older ? (
            <Link
              href={`/station?date=${older.airDate}`}
              className="hover:text-[var(--lg-ink)]"
            >
              ← {shortDate(older.airDate)}
            </Link>
          ) : (
            <span className="text-[var(--lg-g3)]">← earlier</span>
          )}

          <span className="flex gap-2">
            <Link href="/" className="hover:text-[var(--lg-ink)]">
              TODAY
            </Link>
            <span className="text-[var(--lg-g3)]">·</span>
            <span className="font-bold text-[var(--lg-acc)]">STATION</span>
            <span className="text-[var(--lg-g3)]">·</span>
            <Link href="/history" className="hover:text-[var(--lg-ink)]">
              ALMANAC
            </Link>
            <span className="text-[var(--lg-g3)]">·</span>
            <Link href="/blood-work" className="hover:text-[var(--lg-ink)]">
              BLOOD WORK
            </Link>
          </span>

          {newer ? (
            <Link
              href={`/station?date=${newer.airDate}`}
              className="hover:text-[var(--lg-ink)]"
            >
              {shortDate(newer.airDate)} →
            </Link>
          ) : (
            <span className="text-[var(--lg-g3)]">tomorrow →</span>
          )}
        </nav>

        <header className="relative text-center">
          <div className="absolute left-0 top-1.5 text-left font-[family-name:var(--lg-mono)] text-[11px] leading-[1.9] tracking-[.1em] text-[var(--lg-mut)]">
            <Clock tz={tz} initial={localHHMM(new Date(), tz)} />
            <br />
            <b className="font-semibold text-[var(--lg-ink)]">
              {airDate
                ? `${weekdayName(airDate).slice(0, 3).toUpperCase()} ${shortDate(airDate)}`
                : "OFF AIR"}
            </b>
          </div>

          <div
            className="font-[family-name:var(--lg-mono)] text-[10px] uppercase tracking-[.5em] text-[var(--lg-mut)]"
            style={{ textIndent: ".5em" }}
          >
            Broadcasting to an audience of one
          </div>
          <h1
            className="mt-3 text-[42px] font-semibold uppercase tracking-[.3em]"
            style={{ textIndent: ".3em" }}
          >
            Station Olympus · <span className="text-[var(--lg-acc)]">87.4</span>
          </h1>
          <p className="mt-2.5 text-[14px] italic text-[var(--lg-g2)]">
            Pressed at 11:00, one take, every number checked before it reaches
            the lathe.
          </p>

          <span
            className={`absolute right-0 top-1.5 border px-3 pb-1.5 pt-[7px] font-[family-name:var(--lg-mono)] text-[10px] tracking-[.28em] ${
              onAir
                ? "border-[var(--lg-acc)] text-[var(--lg-acc)]"
                : "border-[var(--lg-g3)] text-[var(--lg-mut)]"
            }`}
            style={{ textIndent: ".28em" }}
          >
            {onAir ? "ON AIR" : "OFF AIR"}
          </span>
        </header>

        {episode ? (
          <Turntable
            audioUrl={episode.audioUrl}
            durationS={episode.audioDurationS}
            status={episode.status}
            airDate={episode.airDate}
            weekday={weekdayName(episode.airDate)}
            voice={voiceCredit(episode.ttsModel)}
            aSide={aSideTitle(transcript)}
            bw={bwTitle(transcript)}
            transcript={transcript}
            segmentStarts={segmentStartsOf(episode)}
            shelf={shelf.slice(0, 8).map((s) => ({
              airDate: s.airDate,
              hasAudio: s.hasAudio,
              durationS: s.durationS,
            }))}
          />
        ) : (
          <p className="mx-auto mt-12 max-w-[52ch] text-center text-[15px] leading-[1.7] text-[var(--lg-g2)]">
            Nothing has been pressed yet. The press run cuts one single each
            morning from the ledger — when the first record lands, it plays
            here.
          </p>
        )}

        <footer className="mt-8 flex justify-between border-t border-[var(--lg-ink)] pt-[11px] text-[9px] uppercase tracking-[.26em] text-[var(--lg-mut)]">
          <span>Every number spoken is checked against the ledger before air</span>
          <span>
            {pressed.length} single{pressed.length === 1 ? "" : "s"} in the
            crate · {listeningTotal(totalListening)} total listening
          </span>
          <span>Tomorrow&rsquo;s pressing — 11:00</span>
        </footer>
      </main>
    </div>
  );
}
