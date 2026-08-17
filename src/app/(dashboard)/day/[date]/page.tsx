import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getDayLedger } from "@/lib/ledger/assemble";
import { localDateStr, localHHMM } from "@/lib/ledger/time";
import { getUserTimezone } from "@/lib/utils/timezone";
import { LedgerSheet } from "@/components/ledger/ledger-sheet";

export const dynamic = "force-dynamic";

const DateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
  .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)), "not a real date");

/**
 * A finished day, typeset exactly like the front page.
 *
 * Note the auth and validation happen before any rendering, and neither
 * `redirect` nor `notFound` is wrapped in a try/catch — both work by throwing,
 * so catching broadly here would swallow the navigation.
 */
export default async function DayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date: raw } = await params;
  const parsed = DateParam.safeParse(raw);
  if (!parsed.success) notFound();
  const date = parsed.data;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const tz = getUserTimezone(user.settings);
  const today = localDateStr(new Date(), tz);

  // Today is the front page, and tomorrow hasn't happened.
  if (date >= today) redirect("/");

  const ledger = await getDayLedger(user, date);

  return (
    <div className="ledger">
      <LedgerSheet
        ledger={ledger}
        room="closed"
        clockInitial={localHHMM(new Date(), tz)}
      />
    </div>
  );
}
