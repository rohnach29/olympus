"use client";

import { Button } from "@/components/ui/button";
import { Plus, Utensils, Dumbbell, Moon, MessageCircle } from "lucide-react";
import Link from "next/link";

const actions = [
  { label: "Log Food", icon: Utensils, href: "/nutrition", color: "text-orange-500" },
  { label: "Log Workout", icon: Dumbbell, href: "/workouts", color: "text-blue-500" },
  { label: "Log Sleep", icon: Moon, href: "/sleep", color: "text-purple-500" },
  { label: "Ask Coach", icon: MessageCircle, href: "/coach", color: "text-green-500" },
];

export function QuickActions() {
  return (
    <div className="flex flex-wrap gap-3">
      {actions.map((action) => (
        <Link key={action.label} href={action.href}>
          <Button variant="outline" className="gap-2">
            <action.icon className={`h-4 w-4 ${action.color}`} />
            {action.label}
          </Button>
        </Link>
      ))}
    </div>
  );
}
