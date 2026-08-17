import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserTimezone } from "@/lib/utils/timezone";
import { localDateStr, localHHMM, weekdayName } from "@/lib/ledger/time";
import {
  getEpisodeOnOrBefore,
  listEpisodes,
  segmentStartsOf,
  transcriptOf,
  waveformOf,
} from "@/lib/station/episodes";
import { StationPlayer } from "@/components/ledger/station-player";

// The room reports whether this morning's press run has landed yet, so it is
// never cached.
export const dynamic = "force-dynamic";

function shortDate(dateStr: string): string {
  return dateStr.slice(5).replace("-", ".");
}

function runtime(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  return `${m}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
}

/**
 * What the show was written from, frozen at press time.
 *
 * The ledger is live — a late sync can revise last night hours after the
 * broadcast — so this is the snapshot the writer actually saw. It is also the
 * proof of the whole arrangement: the anchor cannot say a number that was not
 * in this column.
 */
function WrittenFrom({ facts }: { facts: unknown }) {
  if (!facts || typeof facts !== "object") return null;
  const f = facts as Record<string, Record<string, unknown> | undefined>;

  const num = (v: unknown) => (typeof v === "number" ? v : null);
  const rows: { label: string; value: string }[] = [];

  const recovery = num(f.verdict?.recovery);
  if (recovery !== null) {
    rows.push({ label: "Recovery", value: `${recovery} · ${f.verdict?.band ?? ""}` });
  }
  if (f.night) {
    const n = f.night as Record<string, unknown>;
    if (typeof n.asleep === "string") rows.push({ label: "Asleep", value: n.asleep });
    if (num(n.score) !== null) rows.push({ label: "Sleep score", value: String(n.score) });
    if (num(n.deep_min) !== null) rows.push({ label: "Deep", value: `${n.deep_min} min` });
  }
  if (f.yesterday) {
    const y = f.yesterday as Record<string, unknown>;
    if (num(y.steps) !== null) rows.push({ label: "Steps", value: Number(y.steps).toLocaleString() });
    if (num(y.protein_g) !== null) rows.push({ label: "Protein", value: `${y.protein_g} g` });
  }

  if (rows.length === 0) return null;

  return (
    <aside className="border-t border-[var(--lg-ink)] pt-3">
      <span className="ledger-k">Written from</span>
      <dl className="mt-2.5 space-y-[7px]">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3">
            <dt className="font-[family-name:var(--lg-mono)] text-[9.5px] uppercase tracking-[.16em] text-[var(--lg-mut)]">
              {r.label}
            </dt>
            <dd className="text-[13px] tabular-nums">{r.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[10px] leading-[1.5] text-[var(--lg-g3)]">
        The snapshot the writer saw at press time.
      </p>
    </aside>
  );
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

  return (
    <div className="ledger">
      <main>
        {/* The station keeps the ledger's masthead proportions but is filed by
            broadcast rather than by day, so it carries its own header. */}
        <header>
          <div className="flex items-baseline justify-between border-b-2 border-[var(--lg-ink)] pb-4">
            <div className="text-[74px] font-extralight leading-none tracking-[.01em]">
              {airDate ? shortDate(airDate) : "—"}
            </div>

            <div className="text-center">
              <div className="text-[13px] font-semibold uppercase tracking-[.44em]">
                Station Olympus · 87.4
              </div>
              <div className="ledger-k mt-1.5">
                {episode
                  ? `${weekdayName(episode.airDate)}'s broadcast — ${
                      episode.audioDurationS
                        ? runtime(episode.audioDurationS)
                        : `${transcript.length} segments`
                    }`
                  : "Off air"}
              </div>
            </div>

            <div className="text-right font-[family-name:var(--lg-mono)] text-[11px] tracking-[.1em] text-[var(--lg-mut)]">
              {localHHMM(new Date(), tz)}
            </div>
          </div>

          <nav className="flex justify-between pb-7 pt-2 font-[family-name:var(--lg-mono)] text-[10px] tracking-[.14em]">
            <span className="text-[var(--lg-g3)]">
              {airDate && airDate !== today ? `broadcast ${shortDate(airDate)}` : ""}
            </span>
            <span className="flex gap-2">
              <Link href="/" className="text-[var(--lg-mut)] hover:text-[var(--lg-ink)]">
                TODAY
              </Link>
              <span className="text-[var(--lg-g3)]">·</span>
              <span className="font-bold text-[var(--lg-acc)]">STATION</span>
              <span className="text-[var(--lg-g3)]">·</span>
              <Link href="/history" className="text-[var(--lg-mut)] hover:text-[var(--lg-ink)]">
                ALMANAC
              </Link>
              <span className="text-[var(--lg-g3)]">·</span>
              <Link href="/blood-work" className="text-[var(--lg-mut)] hover:text-[var(--lg-ink)]">
                BLOOD WORK
              </Link>
            </span>
            <span />
          </nav>
        </header>

        {episode ? (
          <>
            <div className="mb-5 flex items-baseline justify-between">
              <span className="ledger-k">
                {airDate === today ? "This morning's broadcast" : "From the shelf"}
              </span>
              {episode.status === "no_audio" && (
                <span className="font-[family-name:var(--lg-mono)] text-[10px] tracking-[.1em] text-[var(--lg-mut)]">
                  written, not voiced
                </span>
              )}
              {episode.status === "expired" && (
                <span className="font-[family-name:var(--lg-mono)] text-[10px] tracking-[.1em] text-[var(--lg-mut)]">
                  audio expired — transcript kept
                </span>
              )}
            </div>

            {/* Transcript left, the facts it was written from right — the same
                reading-column-plus-figures geometry the day sheet uses. */}
            <div className="grid items-start gap-10" style={{ gridTemplateColumns: "1fr 250px" }}>
              <StationPlayer
                audioUrl={episode.audioUrl}
                durationS={episode.audioDurationS}
                waveform={waveformOf(episode)}
                transcript={transcript}
                segmentStarts={segmentStartsOf(episode)}
              />
              <WrittenFrom facts={episode.factsUsed} />
            </div>
          </>
        ) : (
          <p className="text-[15px] leading-[1.7] text-[var(--lg-g2)]">
            Nothing has been broadcast yet. The press run assembles a show each
            morning from the ledger — when one lands, it plays here.
          </p>
        )}

        {shelf.length > 1 && (
          <section className="mt-9">
            <span className="ledger-k">The shelf</span>
            <div className="mt-3 divide-y divide-[var(--lg-rule)] border-t border-[var(--lg-rule)]">
              {shelf.map((stub) => {
                const current = stub.airDate === airDate;
                return (
                  <Link
                    key={stub.airDate}
                    href={`/station?date=${stub.airDate}`}
                    className="flex items-baseline justify-between py-[7px] text-[12.5px] hover:bg-[var(--lg-chipbg)]"
                  >
                    <span
                      className={
                        current
                          ? "font-semibold text-[var(--lg-acc)]"
                          : "text-[var(--lg-ink)]"
                      }
                    >
                      {weekdayName(stub.airDate)} {shortDate(stub.airDate)}
                    </span>
                    <span className="font-[family-name:var(--lg-mono)] text-[10px] tabular-nums tracking-[.1em] text-[var(--lg-mut)]">
                      {stub.hasAudio ? runtime(stub.durationS) : "transcript only"}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <footer className="mt-[18px] flex justify-between border-t border-[var(--lg-ink)] pt-[11px] text-[9px] uppercase tracking-[.26em] text-[var(--lg-mut)]">
          <span>Every number spoken is checked against the ledger before air</span>
          <Link href="/settings" className="hover:text-[var(--lg-ink)]">
            Settings
          </Link>
        </footer>
      </main>
    </div>
  );
}
