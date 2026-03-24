import { cn } from "@/lib/utils";

interface Vital {
  name: string;
  value: string | number | null;
  unit?: string;
  color: string;
  trend?: { direction: "up" | "down"; label: string };
}

interface VitalsPanelProps {
  groups: {
    label: string;
    vitals: Vital[];
  }[];
}

export function VitalsPanel({ groups }: VitalsPanelProps) {
  return (
    <div className="flex-1 overflow-y-auto space-y-1">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="px-3 py-2 text-[9px] uppercase tracking-[2.5px] text-white/[0.18] font-semibold">
            {group.label}
          </div>
          {group.vitals.map((vital) => (
            <div
              key={vital.name}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all border border-transparent hover:bg-white/[0.03] hover:border-white/[0.05]"
            >
              <div
                className="w-2.5 h-2.5 rounded-full relative animate-pulse-dot"
                style={{ background: vital.color, color: vital.color }}
              />
              <div className="flex-1">
                <div className="text-[11px] text-white/[0.4]">{vital.name}</div>
              </div>
              <div className="text-right">
                <span className="font-mono text-lg font-semibold text-white">
                  {vital.value ?? "--"}
                </span>
                {vital.unit && (
                  <span className="text-[10px] text-white/[0.2] ml-0.5">{vital.unit}</span>
                )}
                {vital.trend && (
                  <div
                    className={cn(
                      "text-[9px] font-semibold px-1.5 py-0.5 rounded mt-0.5 inline-flex items-center gap-0.5",
                      vital.trend.direction === "up"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-red-500/10 text-red-400"
                    )}
                  >
                    {vital.trend.label}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
