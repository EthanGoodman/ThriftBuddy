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
        <div className="text-xs font-semibold text-[var(--foreground)]">Overall progress</div>
        <div className="text-xs font-semibold text-[var(--muted)] tabular-nums">{pct}%</div>
      </div>

      <div className="relative h-3 w-full overflow-hidden rounded-full border border-[rgba(122,95,73,0.28)] bg-[rgba(235,218,194,0.72)]">
        {/* filled portion */}
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{
            width: `${pct}%`,
            background:
              "linear-gradient(90deg, rgba(143,92,58,0.95) 0%, rgba(166,112,72,0.95) 52%, rgba(188,132,88,0.92) 100%)",
            boxShadow: "0 0 0 1px rgba(109,74,48,0.22) inset, 0 4px 10px rgba(109,74,48,0.22)",
          }}
        />

        {/* subtle depth */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        >
          <div className="h-full w-full rounded-full bg-gradient-to-b from-white/20 to-transparent" />
        </div>

        {/* shimmer/pulse overlay */}
        {isBusy && (
          <div className="absolute inset-0 animate-pulse bg-[rgba(166,112,72,0.14)] pointer-events-none" />
        )}

        {/* moving sheen (extra satisfying) */}
        {isBusy && (
          <div
            className="absolute inset-y-0 -left-1/3 w-1/3 pointer-events-none"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(255,242,220,0.58), transparent)",
              animation: "sheen 1.2s ease-in-out infinite",
              filter: "blur(1px)",
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
