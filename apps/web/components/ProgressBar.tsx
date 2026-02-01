export function ProgressBar({
  value,
  isBusy,
}: {
  value: number;   // 0..1
  isBusy: boolean;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Overall progress
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          {pct}%
        </div>
      </div>

      <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        {/* filled portion */}
        <div
          className="h-full rounded-full bg-blue-600 dark:bg-blue-500 transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />

        {/* shimmer/pulse overlay */}
        {isBusy && (
          <div className="absolute inset-0 animate-pulse bg-white/10 pointer-events-none" />
        )}

        {/* moving sheen (extra satisfying) */}
        {isBusy && (
          <div
            className="absolute inset-y-0 -left-1/3 w-1/3 bg-white/20 blur-sm pointer-events-none"
            style={{
              animation: "sheen 1.2s ease-in-out infinite",
            }}
          />
        )}
      </div>

      {/* local keyframes */}
      <style jsx>{`
        @keyframes sheen {
          0% {
            transform: translateX(0);
            opacity: 0.0;
          }
          20% {
            opacity: 0.35;
          }
          50% {
            opacity: 0.35;
          }
          100% {
            transform: translateX(400%);
            opacity: 0.0;
          }
        }
      `}</style>
    </div>
  );
}