import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getDayLedger } from "@/lib/ledger/assemble";
import { localDateStr, localHHMM } from "@/lib/ledger/time";
import { getUserTimezone } from "@/lib/utils/timezone";
import { LedgerSheet } from "@/components/ledger/ledger-sheet";

// The page reports live sync state, so it is never cached.
export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const tz = getUserTimezone(user.settings);
  const today = localDateStr(new Date(), tz);
  const ledger = await getDayLedger(user, today);

  return (
    <div className="ledger">
      <LedgerSheet
        ledger={ledger}
        room="today"
        clockInitial={localHHMM(new Date(), tz)}
      />
    </div>
  );
}
