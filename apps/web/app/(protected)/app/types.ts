export type Preview = {
  key: string;
  url: string;
  name: string;
  label: string;
};

export type PreviewWithSlot = Preview & { slotIndex: number };

export type Mode = "active" | "sold" | "both";

export type PriceRange = {
  n: number;
  low: number | null;
  q1: number | null;
  median: number | null;
  q3: number | null;
  high: number | null;
} | null;

export type ExampleListing = {
  product_id?: string;
  title?: string;
  link?: string;
  thumbnail?: string;
  image?: string;
  condition?: string;
  location?: string;
  image_similarity?: number;
  price?: { raw?: string; extracted?: number };
  shipping?: any;
};

export type FrontendPayload = {
  mode: string;
  initial_query: string;
  refined_query: string | null;
  market_analysis: {
    active: { similar_count: number; price_range: PriceRange };
    sold: { similar_count: number; price_range: PriceRange };
    sell_velocity: "fast" | "moderate" | "slow" | string;
    rarity: "high" | "medium" | "common" | string;
  };
  legit_check_advice: string[];
  active_listings: ExampleListing[];
  sold_listings: ExampleListing[];
  summary: string;
  timing_sec?: number;
};

export type LensCandidate = {
  id: string;
  title: string;
  image: string;
  link?: string;
  source?: string;
};

export type LensCandidatesResponse = {
  image_url: string;
  total: number;
  candidates: LensCandidate[];
};
