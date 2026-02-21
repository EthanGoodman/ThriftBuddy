import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/Badge";
import { ExampleListingsList } from "@/components/ExampleListingList";
import { listingKey } from "@/lib/thrift/listing";
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

function useAnimatedNumber(target: number | null, durationMs = 180) {
  const [display, setDisplay] = useState<number | null>(target);
  const displayRef = useRef<number | null>(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const commitDisplay = (value: number | null) => {
      displayRef.current = value;
      setDisplay(value);
    };

    if (target == null) {
      rafRef.current = requestAnimationFrame(() => commitDisplay(target));
      return;
    }

    const startValue = displayRef.current ?? target;
    if (startValue === target) {
      rafRef.current = requestAnimationFrame(() => commitDisplay(target));
      return;
    }

    const startTime = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      const next = startValue + (target - startValue) * t;
      commitDisplay(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [target, durationMs]);

  return display;
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
  const headerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [isCondensed, setIsCondensed] = useState(false);
  const condensedRef = useRef(false);
  const lastToggleRef = useRef(0);
  const ma = data.market_analysis;
  const rawSoldListings = soldData?.sold_listings ?? data.sold_listings;
  const rawActiveListings = activeData?.active_listings ?? data.active_listings;
  const filteredSoldListings = rawSoldListings.filter(
    (it, idx) => !dismissedSold.has(listingKey(it, idx)),
  );
  const filteredActiveListings = rawActiveListings.filter(
    (it, idx) => !dismissedActive.has(listingKey(it, idx)),
  );
  const medianSold = medianPrice(filteredSoldListings);
  const medianActive = medianPrice(filteredActiveListings);
  const soldRange = ma.sold.price_range;
  const activeRange = ma.active.price_range;
  const soldRangeDisplay = formatRange(soldRange);
  const activeRangeDisplay = formatRange(activeRange);
  const soldCount = ma.sold.similar_count ?? 0;
  const activeCount = ma.active.similar_count ?? 0;
  const soldMedianDisplay = soldRange?.median ?? medianSold;
  const activeMedianDisplay = activeRange?.median ?? medianActive;
  const soldMedianAnimated = useAnimatedNumber(soldMedianDisplay);
  const activeMedianAnimated = useAnimatedNumber(activeMedianDisplay);
  const soldLowAnimated = useAnimatedNumber(soldRange?.low ?? null);
  const soldHighAnimated = useAnimatedNumber(soldRange?.high ?? null);
  const activeLowAnimated = useAnimatedNumber(activeRange?.low ?? null);
  const activeHighAnimated = useAnimatedNumber(activeRange?.high ?? null);
  const soldLowHigh =
    soldLowAnimated != null && soldHighAnimated != null
      ? `${fmtMoney(soldLowAnimated)} - ${fmtMoney(soldHighAnimated)}`
      : soldRangeDisplay.lowHigh;
  const activeLowHigh =
    activeLowAnimated != null && activeHighAnimated != null
      ? `${fmtMoney(activeLowAnimated)} - ${fmtMoney(activeHighAnimated)}`
      : activeRangeDisplay.lowHigh;

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const next = !entry.isIntersecting;
        const now = performance.now();
        if (next !== condensedRef.current && now - lastToggleRef.current > 120) {
          condensedRef.current = next;
          lastToggleRef.current = now;
          setIsCondensed(next);
        }
      },
      {
        root: null,
        threshold: 0,
        // Make the threshold less sensitive so it doesn't flap.
        rootMargin: "-24px 0px 0px 0px",
      },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="space-y-8">
      <div ref={sentinelRef} className="h-px w-full" />
      <div
        ref={headerRef}
        className={[
          "sticky top-0 z-30 transition-all duration-300",
          isCondensed
            ? "rounded-none bg-transparent p-3 shadow-none"
            : "bg-transparent",
        ].join(" ")}
      >
        <div
          className={[
            "grid grid-cols-2 lg:grid-cols-4 transition-all duration-300",
            isCondensed ? "gap-2" : "gap-3 lg:gap-4",
          ].join(" ")}
        >
            <div
              className={[
                "min-w-0 rounded-2xl panel-strong transition-all",
                isCondensed ? "p-2.5 lg:p-3" : "p-3 lg:p-5",
              ].join(" ")}
            >
              <div
                className={[
                  "uppercase tracking-[0.3em] text-muted transition-all truncate whitespace-nowrap",
                  isCondensed ? "text-[9px] leading-none" : "text-[10px] lg:text-xs",
                ].join(" ")}
              >
                <span className="inline lg:hidden">Sold</span>
                <span className="hidden lg:inline">Sold pricing</span>
              </div>
              {isCondensed ? (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="text-base font-semibold text-[var(--success)]">
                    {soldMedianAnimated != null ? fmtMoney(soldMedianAnimated) : "No data"}
                  </div>
                  <div className="text-[10px] font-semibold text-[var(--muted)] truncate">{soldLowHigh}</div>
                </div>
              ) : (
                <>
                  <div className="mt-2 text-lg lg:text-2xl font-semibold text-[var(--success)]">
                    {soldMedianAnimated != null ? fmtMoney(soldMedianAnimated) : "No data"}
                  </div>
                  <div className="mt-0.5 text-[10px] lg:text-xs text-muted">
                    <div className="text-[11px] lg:text-sm font-semibold text-[var(--muted)] truncate">
                      {soldLowHigh}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div
              className={[
                "min-w-0 rounded-2xl panel-strong transition-all",
                isCondensed ? "p-2.5 lg:p-3" : "p-3 lg:p-5",
              ].join(" ")}
            >
              <div
                className={[
                  "uppercase tracking-[0.3em] text-muted transition-all truncate whitespace-nowrap",
                  isCondensed ? "text-[9px] leading-none" : "text-[10px] lg:text-xs",
                ].join(" ")}
              >
                <span className="inline lg:hidden">Active</span>
                <span className="hidden lg:inline">Active pricing</span>
              </div>
              {isCondensed ? (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="text-base font-semibold text-[var(--accent)]">
                    {activeMedianAnimated != null ? fmtMoney(activeMedianAnimated) : "No data"}
                  </div>
                  <div className="text-[10px] font-semibold text-[var(--muted)] truncate">{activeLowHigh}</div>
                </div>
              ) : (
                <>
                  <div className="mt-2 text-lg lg:text-2xl font-semibold text-[var(--accent)]">
                    {activeMedianAnimated != null ? fmtMoney(activeMedianAnimated) : "No data"}
                  </div>
                  <div className="mt-0.5 text-[10px] lg:text-xs text-muted">
                    <div className="text-[11px] lg:text-sm font-semibold text-[var(--muted)] truncate">
                      {activeLowHigh}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div
              className={[
                "min-w-0 rounded-2xl panel-strong transition-all",
                isCondensed ? "p-2.5 lg:p-3" : "p-3 lg:p-5",
              ].join(" ")}
            >
              <div
                className={[
                  "uppercase tracking-[0.3em] text-muted transition-all truncate whitespace-nowrap",
                  isCondensed ? "text-[9px] leading-none" : "text-[10px] lg:text-xs",
                ].join(" ")}
              >
                <span className="inline lg:hidden">Recent</span>
                <span className="hidden lg:inline">Recently sold</span>
              </div>
              <div
                className={[
                  "mt-1.5 font-semibold text-[var(--foreground)] transition-all",
                  isCondensed ? "text-base" : "text-lg lg:text-2xl",
                ].join(" ")}
              >
                {soldCount} items
              </div>
            </div>
            <div
              className={[
                "min-w-0 rounded-2xl panel-strong transition-all",
                isCondensed ? "p-2.5 lg:p-3" : "p-3 lg:p-5",
              ].join(" ")}
            >
              <div
                className={[
                  "uppercase tracking-[0.3em] text-muted transition-all truncate whitespace-nowrap",
                  isCondensed ? "text-[9px] leading-none" : "text-[10px] lg:text-xs",
                ].join(" ")}
              >
                <span className="inline lg:hidden">Listed</span>
                <span className="hidden lg:inline">Active listings</span>
              </div>
              <div
                className={[
                  "mt-1.5 font-semibold text-[var(--foreground)] transition-all",
                  isCondensed ? "text-base" : "text-lg lg:text-2xl",
                ].join(" ")}
              >
                {activeCount} items
              </div>
            </div>
          </div>

        {!isCondensed && (
          <div className="mt-4 flex flex-wrap gap-3 transition-all">
            <Badge>Velocity: {ma.sell_velocity}</Badge>
            <Badge>Rarity: {ma.rarity}</Badge>
            <Badge>Matches: active {ma.active.similar_count} - sold {ma.sold.similar_count}</Badge>
          </div>
        )}
      </div>

      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-[var(--foreground)]">Recently Sold</div>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--success)]">
            {soldCount} items
          </span>
          </div>
        </div>
        {soldData?.sold_listings?.length ? (
          <ExampleListingsList
            listings={soldData.sold_listings}
            fullscreen
            dismissedKeys={dismissedSold}
            onDismiss={onDismissSold}
            variant="sold"
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
          <div className="text-sm font-semibold text-[var(--foreground)]">Active Listings</div>
          <span className="rounded-full bg-[var(--accent)]/16 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
            {activeCount} items
          </span>
          </div>
        </div>
        {activeData?.active_listings?.length ? (
          <ExampleListingsList
            listings={activeData.active_listings}
            fullscreen
            dismissedKeys={dismissedActive}
            onDismiss={onDismissActive}
            variant="active"
          />
        ) : (
          <div className="rounded-2xl panel-strong p-4 text-sm text-muted">
            {activeLoading ? "Loading active listings..." : "Run Active to see examples."}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl panel-strong p-5">
          <div className="text-sm font-semibold text-[var(--foreground)]">Summary</div>
          <div className="mt-2 text-sm text-muted leading-relaxed">{data.summary || "-"}</div>
        </div>
        <div className="rounded-2xl panel-strong p-5">
          <div className="text-sm font-semibold text-[var(--foreground)]">Legit check (starter)</div>
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
