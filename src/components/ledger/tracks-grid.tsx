import { NowLine } from "./now-line";

/**
 * One ledger line: label, the day's trace, and that domain's figures.
 *
 * Emits three grid cells directly into the parent grid rather than nesting a
 * grid of its own, so every row shares one set of column edges — which is why
 * the traces, the axis and the now-line line up without any measurement.
 */
export function TrackRow({
  label,
  figure,
  detail,
  children,
  unprinted,
}: {
  label: React.ReactNode;
  figure: React.ReactNode | null;
  detail: React.ReactNode | null;
  children: React.ReactNode | null;
  unprinted: string;
}) {
  return (
    <>
      <div className="self-center border-t border-[var(--lg-rule)] py-2.5 text-[8.5px] uppercase leading-[1.7] tracking-[.22em] text-[var(--lg-mut)]">
        {label}
      </div>

      <div className="self-center border-t border-[var(--lg-rule)] py-2.5">
        {children ?? (
          <div className="py-3 font-[family-name:var(--lg-mono)] text-[10px] tracking-[.14em] text-[var(--lg-g3)]">
            {unprinted}
          </div>
        )}
      </div>

      <div className="self-center border-t border-[var(--lg-rule)] py-2.5">
        <div className="border-l border-[var(--lg-rule)] pl-[26px]">
          {figure !== null ? (
            <>
              <div className="text-[25px] font-extralight leading-[1.1]">{figure}</div>
              <div className="mt-1 font-[family-name:var(--lg-mono)] text-[9.5px] tracking-[.04em] text-[var(--lg-mut)]">
                {detail}
              </div>
            </>
          ) : (
            <div className="font-[family-name:var(--lg-mono)] text-[10px] text-[var(--lg-g3)]">
              —
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * The four rows plus the now-line, all on one grid.
 *
 * The now-line is a grid item pinned to the trace column across every row, so
 * it spans exactly the plot area by construction — no hard-coded offsets to
 * drift out of sync when the label or figures column changes width.
 */
export function TracksGrid({
  nowT,
  tz,
  children,
}: {
  nowT: number | null;
  tz: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative grid"
      style={{ gridTemplateColumns: "var(--lg-cols)" }}
    >
      {children}

      {nowT !== null && (
        // Absolutely positioned so it is out of flow: as an in-flow grid item
        // spanning column 2, auto-placement would route every row's cells
        // around it and shift the whole sheet one column to the right. Out of
        // flow it still resolves to that grid area, so the line covers exactly
        // the trace column across all four rows.
        <div
          className="pointer-events-none absolute inset-0"
          style={{ gridColumn: 2, gridRow: "1 / -1" }}
        >
          <NowLine initialT={nowT} tz={tz} />
        </div>
      )}
    </div>
  );
}

/** The 00–24 scale under the traces, sharing the same column geometry. */
export function TimeAxis() {
  return (
    <div className="grid" style={{ gridTemplateColumns: "var(--lg-cols)" }}>
      <span />
      <div className="flex justify-between border-t-2 border-[var(--lg-ink)] pt-2 font-[family-name:var(--lg-mono)] text-[9.5px] text-[var(--lg-mut)]">
        {["00", "03", "06", "09", "12", "15", "18", "21", "24"].map((h) => (
          <span key={h}>{h}</span>
        ))}
      </div>
      <span />
    </div>
  );
}
