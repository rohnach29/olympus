"use client";

import { Button } from "@/components/ui/button";
import { Utensils, Dumbbell, Moon } from "lucide-react";
import Link from "next/link";

const actions = [
  { label: "Log Food", icon: Utensils, href: "/nutrition", color: "text-orange-400", hoverGlow: "hover:shadow-orange-500/20" },
  { label: "Log Workout", icon: Dumbbell, href: "/workouts", color: "text-blue-400", hoverGlow: "hover:shadow-blue-500/20" },
  { label: "Log Sleep", icon: Moon, href: "/sleep", color: "text-purple-400", hoverGlow: "hover:shadow-purple-500/20" },
];

export function QuickActions() {
  return (
    <div className="flex flex-wrap gap-3">
      {actions.map((action) => (
        <Link key={action.label} href={action.href}>
          <Button
            variant="outline"
            className={`gap-2 rounded-full px-5 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg ${action.hoverGlow}`}
          >
            <action.icon className={`h-4 w-4 ${action.color}`} />
            {action.label}
          </Button>
        </Link>
      ))}
    </div>
  );
}
