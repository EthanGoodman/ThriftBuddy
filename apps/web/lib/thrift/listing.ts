import { ExampleListing, PriceRange } from "@/app/(protected)/app/types";

export function listingKey(it: ExampleListing, idx: number) {
  // Prefer stable unique fields if present
  return (
    it.product_id ??
    it.link ??
    `${it.title ?? "untitled"}|${it.price?.extracted ?? it.price?.raw ?? "noprice"}|${idx}`
  );
}

export function getVisiblePricedListings(
  listings: ExampleListing[] | undefined,
  dismissed: Set<string>
) {
  if (!listings?.length) return [];

  return listings
    .map((it, idx) => ({ it, idx, key: listingKey(it, idx) }))
    .filter(({ it }) => it.price?.extracted != null)
    .filter(({ key }) => !dismissed.has(key));
}

export function medianOfSorted(nums: number[]) {
  const n = nums.length;
  if (!n) return null;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return nums[mid];
  return (nums[mid - 1] + nums[mid]) / 2;
}

export function computePriceRangeFromListings(
  listings: ExampleListing[] | undefined,
  dismissed: Set<string>
): PriceRange {
  const visible = getVisiblePricedListings(listings, dismissed);
  const prices = visible
    .map(({ it }) => it.price!.extracted!)
    .filter((x) => x != null && !Number.isNaN(x))
    .sort((a, b) => a - b);

  const n = prices.length;
  if (!n) return null;

  const low = prices[0];
  const high = prices[n - 1];
  const median = medianOfSorted(prices);

  // Quartiles: median of lower half / upper half (excluding median when odd)
  let q1: number | null = null;
  let q3: number | null = null;

  if (n >= 4) {
    const mid = Math.floor(n / 2);
    const lower = prices.slice(0, mid);
    const upper = prices.slice(n % 2 === 0 ? mid : mid + 1);
    q1 = medianOfSorted(lower);
    q3 = medianOfSorted(upper);
  }

  return {
    n,
    low,
    q1,
    median,
    q3,
    high,
  };
}