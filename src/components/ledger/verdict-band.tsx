import type { DayVerdict } from "@/lib/ledger/types";

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[var(--lg-rule)] bg-[var(--lg-chipbg)] px-[15px] py-1.5 font-[family-name:var(--lg-mono)] text-[11.5px] tracking-[.06em] text-[var(--lg-chiptx)]">
      {children}
    </span>
  );
}

function Value({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-[var(--lg-ink)]">{children}</span>;
}

/**
 * A movement against baseline. `goodWhenLower` inverts the colouring for
 * resting heart rate, where a fall is the good direction.
 */
function Delta({ d, goodWhenLower = false }: { d: number | null; goodWhenLower?: boolean }) {
  if (d === null || d === 0) return null;
  const good = goodWhenLower ? d < 0 : d > 0;
  return (
    <span className={good ? "text-[var(--lg-up)]" : "text-[var(--lg-acc)]"}>
      {" "}
      {d > 0 ? `▲ +${d}` : `▼ ${d}`}
    </span>
  );
}

/**
 * The day's headline: one number, one instruction, and the readings behind
 * them. When the number could not be printed it is an em-dash rather than a
 * zero — an absent verdict is not a bad one.
 */
export function VerdictBand({ verdict }: { verdict: DayVerdict }) {
  const { recovery, headline, sentence, chips } = verdict;
  const unprinted = recovery === null;

  return (
    <section className="flex items-center gap-11 border-b border-[var(--lg-rule)] py-6">
      <span
        className={`text-[128px] font-extralight leading-[.92] tracking-[-.02em] ${
          unprinted ? "text-[var(--lg-g3)]" : ""
        }`}
      >
        {unprinted ? "—" : recovery}
      </span>

      <div className="max-w-[470px] border-l-2 border-[var(--lg-acc)] pl-[22px]">
        <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[.26em] text-[var(--lg-acc)]">
          {headline}
        </div>
        <p className="m-0 text-[16px] leading-[1.55]">{sentence}</p>
      </div>

      <div className="ml-auto flex flex-col items-end gap-[9px]">
        <Chip>
          HRV <Value>{chips.hrv.value !== null ? `${chips.hrv.value} ms` : "—"}</Value>
          <Delta d={chips.hrv.delta} />
          {" · "}
          RHR <Value>{chips.rhr.value ?? "—"}</Value>
          <Delta d={chips.rhr.delta} goodWhenLower />
        </Chip>

        <Chip>
          SLEEP <Value>{chips.sleepScore ?? "—"}</Value>
          {" · "}
          STRAIN <Value>{chips.strain.value.toFixed(1)}</Value>
          {chips.strain.level === "high" && (
            <span className="font-bold text-[var(--lg-acc)]"> HIGH</span>
          )}
        </Chip>
      </div>
    </section>
  );
}
