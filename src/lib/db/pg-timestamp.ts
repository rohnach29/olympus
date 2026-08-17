/**
 * Correct decoding for `timestamp without time zone` columns.
 *
 * Postgres returns those columns as text like "2026-08-15 09:06:07". postgres.js
 * eagerly turns that into a Date with `new Date(text)`, and V8 reads a
 * space-separated datetime as LOCAL time. Our values are UTC wall clocks —
 * drizzle writes `toISOString()` and Postgres drops the trailing Z — so on a
 * machine running in IST every timestamp came back 5h30m early, while on Vercel
 * (TZ=UTC) it was accidentally correct. That combination is the dangerous one:
 * a developer "fixes" the visible offset locally and ships a 5½-hour error.
 *
 * Rather than re-parse after the fact, we stop the driver from parsing at all.
 * Drizzle's own PgTimestamp.mapFromDriverValue already does the right thing when
 * it receives a string (it appends "+0000"); handing it the raw text lets that
 * correct path run instead of passing a pre-made Date straight through.
 *
 * Only oid 1114 is overridden. 1082 (date) and 1184 (timestamptz) keep
 * postgres.js's defaults: a date has no time to misplace, and timestamptz text
 * carries its own offset, so both are already unambiguous.
 */

/** oid of `timestamp without time zone` */
export const PG_TIMESTAMP_OID = 1114;

/**
 * Read Postgres timestamp text as the UTC instant it represents.
 * Exported for tests and for raw-SQL callers that need a Date.
 */
export function parsePgTimestamp(text: string): Date {
  return new Date(`${text.replace(" ", "T")}Z`);
}

/**
 * postgres.js `types` option. `parse` is deliberately the identity function —
 * the raw text is what drizzle wants.
 *
 * `serialize` reproduces what already happens on writes today (drizzle calls
 * toISOString(); Postgres parses it and drops the zone for a `timestamp`
 * column), so the write path is unchanged. It is only consulted for parameters
 * explicitly typed as oid 1114, which drizzle never produces — it is here
 * because postgres.js's PostgresType requires the field.
 */
export const pgTimestampTypes = {
  timestampNoTz: {
    to: PG_TIMESTAMP_OID,
    from: [PG_TIMESTAMP_OID],
    parse: (text: string) => text,
    serialize: (value: Date | string) =>
      value instanceof Date ? value.toISOString() : value,
  },
};
