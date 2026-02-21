import { PriceRange } from "@/app/(protected)/app/types";
import {fmtMoney} from "@/lib/thrift/format"

export function PriceSummaryCombined({
  activeRange,
  soldRange,
}: {
  activeRange?: PriceRange;
  soldRange?: PriceRange;
}) {
  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="text-sm text-[var(--muted)]">{label}</div>
      <div className="text-sm font-semibold text-[var(--foreground)] text-right">
        {value}
      </div>
    </div>
  );

  const val = (r?: PriceRange, kind?: "median" | "range" | "q" | "n") => {
    if (!r || !r.n) return <span className="text-[var(--muted)]">—</span>;
    if (kind === "median") return fmtMoney(r.median);
    if (kind === "range") return `${fmtMoney(r.low)} – ${fmtMoney(r.high)}`;
    if (kind === "q") return `Q1 ${fmtMoney(r.q1)} · Q3 ${fmtMoney(r.q3)}`;
    if (kind === "n") return r.n;
    return <span className="text-[var(--muted)]">—</span>;
  };

  // If neither has enough data, show your friendly message
  const activeOk = !!activeRange?.n;
  const soldOk = !!soldRange?.n;
  if (!activeOk && !soldOk) {
    return (
      <div className="text-sm text-[var(--muted)]">
        Pricing estimate unavailable (too few comparable listings).
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Active */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Active listings
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--panel-quiet)] text-[var(--foreground)] ring-1 ring-[var(--panel-border)]">
            {activeRange?.n ? `${activeRange.n} active listings` : "no listings"}
          </span>
        </div>

        <Row label="Median Price:" value={val(activeRange, "median")} />
        <Row label="Price Range:" value={val(activeRange, "range")} />
      </div>

      <div className="h-px bg-[var(--panel-border)]/60" />

      {/* Sold */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Sold listings
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--panel-quiet)] text-[var(--foreground)] ring-1 ring-[var(--panel-border)]">
            {soldRange?.n ? `${soldRange.n} sold listings` : "no listings"}
          </span>
        </div>

        <Row label="Median Price:" value={val(soldRange, "median")} />
        <Row label="Price Range:" value={val(soldRange, "range")} />
      </div>
    </div>
  );
}
