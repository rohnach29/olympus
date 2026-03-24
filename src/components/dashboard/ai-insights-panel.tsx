interface Insight {
  category: string;
  color: string;
  text: string;
  timestamp: string;
}

interface AIInsightsPanelProps {
  insights: Insight[];
}

export function AIInsightsPanel({ insights }: AIInsightsPanelProps) {
  return (
    <div className="flex flex-col gap-3 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(16,185,129,0.6)] animate-pulse" />
        <span className="text-[10px] uppercase tracking-[2.5px] text-primary/50 font-semibold">
          AI Insights — Live
        </span>
      </div>

      {/* Insight cards */}
      {insights.map((insight, i) => (
        <div
          key={i}
          className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] cursor-pointer transition-all hover:bg-white/[0.04] hover:border-white/[0.08]"
        >
          <div
            className="flex items-center gap-1.5 text-[9px] uppercase tracking-[1.5px] font-semibold mb-2"
            style={{ color: insight.color }}
          >
            <span
              className="w-1 h-1 rounded-full"
              style={{ background: insight.color }}
            />
            {insight.category}
          </div>
          <p className="text-xs text-white/[0.6] leading-relaxed">
            {insight.text}
          </p>
          <div className="text-[10px] text-white/[0.15] font-mono mt-2.5">
            {insight.timestamp}
          </div>
        </div>
      ))}
    </div>
  );
}
