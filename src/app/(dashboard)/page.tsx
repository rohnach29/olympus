import { getCurrentUser } from "@/lib/auth/session";
import { db, sleepSessions } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getYesterdayDateString } from "@/lib/utils/timezone";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  let readiness: number | null = null;

  if (user) {
    try {
      const userSettings = user.settings as { timezone?: string } | null;
      const userTimezone = userSettings?.timezone || "UTC";
      const lastNightDate = getYesterdayDateString(userTimezone);

      const lastNightSleep = await db
        .select()
        .from(sleepSessions)
        .where(
          and(
            eq(sleepSessions.userId, user.id),
            eq(sleepSessions.sleepDate, lastNightDate)
          )
        )
        .limit(1);

      if (lastNightSleep.length > 0) {
        readiness = lastNightSleep[0].sleepScore;
      }
    } catch (error) {
      console.error("Could not fetch dashboard data:", error);
    }
  }

  return (
    <div className="flex flex-col items-center pt-5">
      <div className="text-center">
        <div
          className="font-display text-7xl font-extrabold tracking-tighter text-white leading-none"
          style={{ textShadow: "0 0 50px rgba(16,185,129,0.25)" }}
        >
          {readiness ?? "--"}
        </div>
        <div className="text-[9px] uppercase tracking-[4px] text-primary/45 mt-1">
          Readiness
        </div>
        {readiness !== null && readiness >= 70 && (
          <div className="inline-block mt-2 px-3.5 py-1 rounded-full bg-primary/8 border border-primary/12 text-[11px] font-medium text-primary">
            Ready to train
          </div>
        )}
      </div>
    </div>
  );
}
