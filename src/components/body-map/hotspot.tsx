"use client";

import { Html } from "@react-three/drei";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface HotspotProps {
  position: [number, number, number];
  color: string;
  label: string;
  value: string | number | null;
  href: string;
  icon: LucideIcon;
  heartbeat?: boolean;
}

export function Hotspot({
  position,
  color,
  label,
  value,
  href,
  icon: Icon,
  heartbeat = false,
}: HotspotProps) {
  const router = useRouter();

  return (
    <group position={position}>
      <Html center distanceFactor={5} zIndexRange={[10, 0]}>
        <button
          onClick={() => router.push(href)}
          className="flex items-center gap-2 cursor-pointer group"
        >
          {/* Pulsing dot */}
          <div className="relative">
            <div
              className={cn(
                "w-3 h-3 rounded-full",
                heartbeat && "animate-heartbeat"
              )}
              style={{
                background: color,
                boxShadow: `0 0 12px ${color}80`,
              }}
            />
            <div
              className="absolute inset-[-6px] rounded-full pulse-ring"
              style={{ borderColor: color, color }}
            />
          </div>

          {/* Connector line */}
          <div
            className="w-10 h-px"
            style={{
              background: `linear-gradient(90deg, ${color}60, transparent)`,
            }}
          />

          {/* Label tag */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/70 border border-white/[0.08] backdrop-blur-xl text-[11px] font-medium text-white/70 whitespace-nowrap group-hover:bg-black/90 group-hover:border-white/[0.15] transition-all">
            <Icon className="w-3 h-3" style={{ color }} />
            <span>{label}</span>
            <span className="font-mono font-semibold text-xs" style={{ color }}>
              {value ?? "--"}
            </span>
          </div>
        </button>
      </Html>
    </group>
  );
}
