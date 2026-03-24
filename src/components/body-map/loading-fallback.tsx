export function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="relative">
        <svg width="200" height="400" viewBox="0 0 200 400" fill="none" className="opacity-20">
          <circle cx="100" cy="30" r="15" stroke="#10b981" strokeWidth="0.5" />
          <line x1="100" y1="45" x2="100" y2="250" stroke="#10b981" strokeWidth="0.5" />
          <line x1="60" y1="80" x2="140" y2="80" stroke="#10b981" strokeWidth="0.5" />
          <line x1="60" y1="80" x2="30" y2="180" stroke="#10b981" strokeWidth="0.5" />
          <line x1="140" y1="80" x2="170" y2="180" stroke="#10b981" strokeWidth="0.5" />
          <line x1="100" y1="250" x2="70" y2="380" stroke="#10b981" strokeWidth="0.5" />
          <line x1="100" y1="250" x2="130" y2="380" stroke="#10b981" strokeWidth="0.5" />
          {[
            [100, 30], [100, 80], [60, 80], [140, 80],
            [30, 180], [170, 180], [100, 160], [100, 250],
            [70, 380], [130, 380],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="3" fill="#10b981" opacity="0.5" />
          ))}
        </svg>
        <p className="text-center text-xs text-muted-foreground mt-4">Loading body map...</p>
      </div>
    </div>
  );
}
