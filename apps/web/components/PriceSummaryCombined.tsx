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
      <div className="text-sm text-slate-700 dark:text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-slate-900 dark:text-slate-200 text-right">
        {value}
      </div>
    </div>
  );

  const val = (r?: PriceRange, kind?: "median" | "range" | "q" | "n") => {
    if (!r || !r.n) return <span className="text-slate-500">—</span>;
    if (kind === "median") return fmtMoney(r.median);
    if (kind === "range") return `${fmtMoney(r.low)} – ${fmtMoney(r.high)}`;
    if (kind === "q") return `Q1 ${fmtMoney(r.q1)} · Q3 ${fmtMoney(r.q3)}`;
    if (kind === "n") return r.n;
    return <span className="text-slate-500">—</span>;
  };

  // If neither has enough data, show your friendly message
  const activeOk = !!activeRange?.n;
  const soldOk = !!soldRange?.n;
  if (!activeOk && !soldOk) {
    return (
      <div className="text-sm text-slate-600 dark:text-slate-300">
        Pricing estimate unavailable (too few comparable listings).
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Active */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            Active listings
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 ring-1 ring-slate-200
                          dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
            {activeRange?.n ? `${activeRange.n} active listings` : "no listings"}
          </span>
        </div>

        <Row label="Median Price:" value={val(activeRange, "median")} />
        <Row label="Price Range:" value={val(activeRange, "range")} />
      </div>

      <div className="h-px bg-slate-200/70 dark:bg-slate-800/70" />

      {/* Sold */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            Sold listings
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 ring-1 ring-slate-200
                          dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
            {soldRange?.n ? `${soldRange.n} sold listings` : "no listings"}
          </span>
        </div>

        <Row label="Median Price:" value={val(soldRange, "median")} />
        <Row label="Price Range:" value={val(soldRange, "range")} />
      </div>
    </div>
  );
}
