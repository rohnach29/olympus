import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

/**
 * Authentication gate only.
 *
 * Deliberately carries no styling: the ledger pages are a light sheet and
 * blood work is still the dark UI, so each page paints its own ground rather
 * than inheriting one from here.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <>{children}</>;
}
