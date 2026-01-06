import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // If user is already logged in, redirect to dashboard
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  return <>{children}</>;
}
