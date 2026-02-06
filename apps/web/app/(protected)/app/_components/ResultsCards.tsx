import { useState } from "react";

import { Badge } from "@/components/Badge";
import { ExampleListingsList } from "@/components/ExampleListingList";
import { fmtMoney } from "@/lib/thrift/format";

import type { FrontendPayload, PriceRange } from "../types";

type ResultsCardsProps = {
  data: FrontendPayload;
  activeData: FrontendPayload | null;
  soldData: FrontendPayload | null;
  activeLoading: boolean;
  soldLoading: boolean;
  dismissedActive: Set<string>;
  dismissedSold: Set<string>;
  onDismissActive: (key: string) => void;
  onDismissSold: (key: string) => void;
};

function medianPrice(listings: FrontendPayload["sold_listings"]) {
  const vals = listings
    .map((item) => item.price?.extracted)
    .filter((val): val is number => typeof val === "number")
    .sort((a, b) => a - b);
  if (!vals.length) return null;
  const mid = Math.floor(vals.length / 2);
  if (vals.length % 2 === 1) return vals[mid];
  return (vals[mid - 1] + vals[mid]) / 2;
}

function formatRange(range: PriceRange) {
  if (!range) {
    return {
      lowHigh: "No data",
      iqr: "No data",
    };
  }

  const lowHigh =
    range.low != null && range.high != null
      ? `${fmtMoney(range.low)} - ${fmtMoney(range.high)}`
      : "No data";
  const iqr =
    range.q1 != null && range.q3 != null
      ? `${fmtMoney(range.q1)} - ${fmtMoney(range.q3)}`
      : "No data";

  return { lowHigh, iqr };
}

export function ResultsCards({
  data,
  activeData,
  soldData,
  activeLoading,
  soldLoading,
  dismissedActive,
  dismissedSold,
  onDismissActive,
  onDismissSold,
}: ResultsCardsProps) {
  const [soldExpanded, setSoldExpanded] = useState(false);
  const [activeExpanded, setActiveExpanded] = useState(false);
  const ma = data.market_analysis;
  const medianSold = medianPrice(soldData?.sold_listings ?? data.sold_listings);
  const medianActive = medianPrice(activeData?.active_listings ?? data.active_listings);
  const soldRange = ma.sold.price_range;
  const activeRange = ma.active.price_range;
  const soldRangeDisplay = formatRange(soldRange);
  const activeRangeDisplay = formatRange(activeRange);
  const soldCount = ma.sold.similar_count ?? 0;
  const activeCount = ma.active.similar_count ?? 0;
  const soldMedianDisplay = soldRange?.median ?? medianSold;
  const activeMedianDisplay = activeRange?.median ?? medianActive;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-2xl panel-strong p-5">
          <div className="text-xs uppercase tracking-[0.3em] text-muted">Sold pricing</div>
          <div className="mt-3 text-2xl font-semibold text-emerald-200">
            {soldMedianDisplay != null ? fmtMoney(soldMedianDisplay) : "No data"}
          </div>
          <div className="mt-1 space-y-1 text-xs text-muted">
            <div className="text-sm font-semibold text-white">{soldRangeDisplay.lowHigh}</div>
          </div>
        </div>
        <div className="rounded-2xl panel-strong p-5">
          <div className="text-xs uppercase tracking-[0.3em] text-muted">Active pricing</div>
          <div className="mt-3 text-2xl font-semibold text-blue-200">
            {activeMedianDisplay != null ? fmtMoney(activeMedianDisplay) : "No data"}
          </div>
          <div className="mt-1 space-y-1 text-xs text-muted">
            <div className="text-sm font-semibold text-white">{activeRangeDisplay.lowHigh}</div>
          </div>
        </div>
        <div className="rounded-2xl panel-strong p-5">
          <div className="text-xs uppercase tracking-[0.3em] text-muted">Recently sold</div>
          <div className="mt-3 text-2xl font-semibold text-white">
            {soldCount} items
          </div>
        </div>
        <div className="rounded-2xl panel-strong p-5">
          <div className="text-xs uppercase tracking-[0.3em] text-muted">Active listings</div>
          <div className="mt-3 text-2xl font-semibold text-white">
            {activeCount} items
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Badge>Velocity: {ma.sell_velocity}</Badge>
        <Badge>Rarity: {ma.rarity}</Badge>
        <Badge>Matches: active {ma.active.similar_count} - sold {ma.sold.similar_count}</Badge>
      </div>

      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-white">Recently Sold</div>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
            {soldCount} items
          </span>
          </div>
          <button
            type="button"
            onClick={() => setSoldExpanded((prev) => !prev)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-white/10"
          >
            {soldExpanded ? "Collapse" : "Expand"}
          </button>
        </div>
        {soldData?.sold_listings?.length ? (
          <ExampleListingsList
            listings={soldData.sold_listings}
            fullscreen
            dismissedKeys={dismissedSold}
            onDismiss={onDismissSold}
            variant="sold"
            maxItems={soldExpanded ? undefined : 3}
          />
        ) : (
          <div className="rounded-2xl panel-strong p-4 text-sm text-muted">
            {soldLoading ? "Loading sold listings..." : "Run Sold to see examples."}
          </div>
        )}
      </div>

      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-white">Active Listings</div>
          <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-200">
            {activeCount} items
          </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveExpanded((prev) => !prev)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-white/10"
          >
            {activeExpanded ? "Collapse" : "Expand"}
          </button>
        </div>
        {activeData?.active_listings?.length ? (
          <ExampleListingsList
            listings={activeData.active_listings}
            fullscreen
            dismissedKeys={dismissedActive}
            onDismiss={onDismissActive}
            variant="active"
            maxItems={activeExpanded ? undefined : 3}
          />
        ) : (
          <div className="rounded-2xl panel-strong p-4 text-sm text-muted">
            {activeLoading ? "Loading active listings..." : "Run Active to see examples."}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl panel-strong p-5">
          <div className="text-sm font-semibold text-white">Summary</div>
          <div className="mt-2 text-sm text-muted leading-relaxed">{data.summary || "-"}</div>
        </div>
        <div className="rounded-2xl panel-strong p-5">
          <div className="text-sm font-semibold text-white">Legit check (starter)</div>
          {data.legit_check_advice?.length ? (
            <ul className="mt-2 space-y-1 text-sm text-muted">
              {data.legit_check_advice.map((x, i) => (
                <li key={i}>- {x}</li>
              ))}
            </ul>
          ) : (
            <div className="mt-2 text-sm text-muted">No advice available.</div>
          )}
        </div>
      </div>
    </div>
  );
}
