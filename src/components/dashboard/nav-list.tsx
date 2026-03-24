"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  Utensils,
  Dumbbell,
  Moon,
  Heart,
  FlaskConical,
  Sparkles,
  MessageCircle,
  Settings,
  LogOut,
} from "lucide-react";

const navItems = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Nutrition", href: "/nutrition", icon: Utensils },
  { name: "Workouts", href: "/workouts", icon: Dumbbell },
  { name: "Sleep", href: "/sleep", icon: Moon },
  { name: "Recovery", href: "/recovery", icon: Heart },
  { name: "Blood Work", href: "/blood-work", icon: FlaskConical },
  { name: "Longevity", href: "/longevity", icon: Sparkles },
  { name: "AI Coach", href: "/coach", icon: MessageCircle },
];

export function NavList() {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="border-t border-white/[0.04] pt-3 mt-auto space-y-0.5">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all",
              isActive
                ? "bg-primary/8 text-primary"
                : "text-muted-foreground hover:bg-white/[0.03] hover:text-foreground"
            )}
          >
            <item.icon className={cn("h-4 w-4", isActive ? "opacity-100" : "opacity-50")} />
            {item.name}
          </Link>
        );
      })}
      <div className="pt-2 space-y-0.5">
        <Link
          href="/settings"
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-white/[0.03] hover:text-foreground transition-all"
        >
          <Settings className="h-4 w-4 opacity-50" />
          Settings
        </Link>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-white/[0.03] hover:text-foreground transition-all"
        >
          <LogOut className="h-4 w-4 opacity-50" />
          Sign out
        </button>
      </div>
    </div>
  );
}
