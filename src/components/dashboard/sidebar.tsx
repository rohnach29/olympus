"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Activity,
  Home,
  Utensils,
  Dumbbell,
  Moon,
  Heart,
  FlaskConical,
  Settings,
  LogOut,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Nutrition", href: "/nutrition", icon: Utensils },
  { name: "Workouts", href: "/workouts", icon: Dumbbell },
  { name: "Sleep", href: "/sleep", icon: Moon },
  { name: "Recovery", href: "/recovery", icon: Heart },
  { name: "Blood Work", href: "/blood-work", icon: FlaskConical },
];

const bottomNav = [
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-white/[0.06] bg-card/30 backdrop-blur-2xl">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-white/[0.06] px-6">
          <div className="p-1.5 rounded-lg bg-primary/10 shadow-md shadow-primary/20 animate-pulse-glow text-primary">
            <Activity className="h-6 w-6" />
          </div>
          <span className="text-xl font-bold gradient-text">Olympus</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-gradient-to-r from-primary/20 to-purple-500/15 text-white shadow-sm shadow-primary/10 border border-white/[0.06]"
                    : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Bottom navigation */}
        <div className="border-t border-white/[0.06] px-3 py-4 space-y-1">
          {bottomNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-gradient-to-r from-primary/20 to-purple-500/15 text-white shadow-sm shadow-primary/10 border border-white/[0.06]"
                    : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-white/[0.04] hover:text-foreground transition-all duration-200"
          >
            <LogOut className="h-5 w-5" />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
