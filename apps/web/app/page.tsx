"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileUploadCard } from "@/components/file-upload";
import { MultiFileUploadCard } from "@/components/multi-file-upload";
import { FullscreenCard } from "@/components/full-screen-modal";
import { text } from "stream/consumers";

type Preview = {
  key: string;
  url: string;
  name: string;
  label: string;
};

type Mode = "active" | "sold";

type PriceRange = {
  n: number;
  low: number | null;
  q1: number | null;
  median: number | null;
  q3: number | null;
  high: number | null;
} | null;

type ExampleListing = {
  product_id?: string;
  title?: string;
  link?: string;
  thumbnail?: string;
  condition?: string;
  location?: string;
  image_similarity?: number;
  price?: { raw?: string; extracted?: number };
  shipping?: any;
};

type FrontendPayload = {
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
  example_listings: ExampleListing[];
  summary: string;
  timing_sec?: number;
};

type ApiResponse =
  | FrontendPayload
  | { data: FrontendPayload; debug?: any }; // backend may wrap, we ignore debug here

function fmtMoney(x: number | null | undefined) {
  if (x == null || Number.isNaN(x)) return "—";
  return `$${x.toFixed(2)}`;
}

function PriceSummaryCombined({
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

function StepColumn({
  title,
  steps,
  isLoading,
  isDone,
}: {
  title: string;
  steps: { id: string; label: string }[];
  isLoading: boolean;
  isDone: boolean;
}) {
  return (
    <div className="w-full">
      <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">
        Current step
      </div>

      {isLoading && (
        <ul className="space-y-2 w-full text-left">
          {steps.map((s) => {
            const isActive = s.id.endsWith(":active");

            return (
              <li key={s.id} className="flex items-center gap-2 w-full">
                <span
                  className={[
                    "grid place-items-center h-5 w-5 rounded-full border text-xs shrink-0",
                    isActive
                      ? "border-blue-400/70 text-blue-500 animate-pulse"
                      : "border-emerald-400/70 bg-emerald-500/10 text-emerald-500",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  {isActive ? (<svg
                        width="6"
                        height="6"
                        viewBox="0 0 6 6"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <circle cx="3" cy="3" r="2" fill="currentColor" />
                      </svg> )
                  : (<svg width="10" height="10" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M2 6.5L4.5 9L10 3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  )}
                </span>

                <span
                  className={[
                    "text-xs",
                    isActive
                      ? "text-slate-500 dark:text-slate-400 animate-pulse"
                      : "text-slate-800 dark:text-slate-200",
                  ].join(" ")}
                >
                  {s.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {!isLoading && isDone && (
        <div className="mt-2 inline-flex items-center gap-2">
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400">
            Done
          </span>
        </div>
      )}
    </div>
  );
}


function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200
                     dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
      {children}
    </span>
  );
}

function CheckboxChip({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition",
        "border shadow-sm",
        !checked
          ? [
              "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
              "dark:bg-slate-900/40 dark:text-slate-200 dark:border-slate-800 dark:hover:bg-slate-800/60",
            ].join(" ")
          : [
              "bg-blue-600/10 text-slate-900 border-blue-500/30 hover:bg-blue-600/15",
              "dark:bg-blue-600/20 dark:text-slate-100 dark:border-blue-400/40 dark:hover:bg-blue-600/25",
            ].join(" "),
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60",
        disabled ? "opacity-60 cursor-not-allowed" : "",
      ].join(" ")}
      aria-pressed={checked}
    >
      {/* checkbox box */}
      <span
        className={[
          "grid place-items-center h-5 w-5 rounded-md border transition",
          checked
            ? "bg-blue-500 border-blue-400/60"
            : "bg-transparent border-slate-300 dark:border-white/20",
        ].join(" ")}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 20 20"
          className={[
            "h-3.5 w-3.5 transition",
            checked ? "text-white opacity-100" : "text-white opacity-0",
          ].join(" ")}
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M16.704 5.29a1 1 0 010 1.415l-7.25 7.25a1 1 0 01-1.415 0l-3.25-3.25a1 1 0 011.415-1.415l2.543 2.543 6.543-6.543a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </span>

      <span className="leading-none">{label}</span>
    </button>
  );
}


function ExampleListingsList({
  listings,
  fullscreen,
}: {
  listings: ExampleListing[];
  fullscreen: boolean;
}) {
  const items = listings
    .filter((it) => it.price?.extracted != null)
    .sort((a, b) => a.price!.extracted! - b.price!.extracted!)
    .slice(0, 51);

  if (!items.length) {
    return <div className="text-sm text-slate-600 dark:text-slate-300">No example listings available.</div>;
  }

  return (
    <div
      className={[
        fullscreen ? "h-full" : "max-h-[280px]",
        "overflow-y-auto scrollbar-clean [scrollbar-gutter:stable] pr-3",
      ].join(" ")}
    >
      <div className="grid gap-4 grid-cols-1">
        {items.map((it, idx) => (
          <a
            key={(it.product_id ?? "") + idx}
            href={it.link || "#"}
            target="_blank"
            rel="noreferrer"
            className={[
              "group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-50 transition dark:bg-slate-900",
              fullscreen ? "p-4" : "p-3",
            ].join(" ")}
          >
            <div className="flex gap-4">
              <div
                className={[
                  "rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700",
                  fullscreen ? "h-24 w-24" : "h-16 w-16",
                ].join(" ")}
              >
                {it.thumbnail ? (
                  <img
                    src={it.thumbnail}
                    alt={it.title || "listing"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">
                    no img
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div
                  className={[
                    "font-medium text-slate-900 dark:text-slate-200 line-clamp-2",
                    fullscreen ? "text-base" : "text-sm",
                  ].join(" ")}
                >
                  {it.title || "Untitled listing"}
                </div>

                <div
                  className={[
                    "mt-1 text-slate-600 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-1",
                    fullscreen ? "text-sm" : "text-xs",
                  ].join(" ")}
                >
                  <span className="font-semibold">
                    {it.price?.extracted != null ? fmtMoney(it.price.extracted) : it.price?.raw ?? "—"}
                  </span>
                  {it.condition ? <span className="text-slate-500">{it.condition}</span> : null}
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function truncate(s: string, n: number) {
  const t = s.trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}

export function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-lg ring-1 ring-black/5
                    dark:bg-slate-900 dark:ring-white/10">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      {children}
    </div>
  );
}

type StepStatus = "pending" | "active" | "done";

type StepEvent = {
  type: "step";
  step_id: string;
  label: string;
  status: "start" | "done";
  pct?: number;      // 0..1
  detail?: string;
};

type ResultEvent = {
  type: "result";
  data: FrontendPayload;
};

type ErrorEvent = {
  type: "error";
  error: any;
};

type StreamEvent = StepEvent | ResultEvent | ErrorEvent;

const STREAM_STEPS = [
  { id: "gen_query", label: "Identifying Item" },
  { id: "query_mkt", label: "Querying marketplaces" },
  { id: "proc_imgs", label: "Processing item images" },
  { id: "refine", label: "Refining search query" },
  { id: "requery", label: "Re-querying marketplaces" },
] as const;


function makeInitialStepState(): Record<string, StepStatus> {
  return Object.fromEntries(STREAM_STEPS.map(s => [s.id, "pending"])) as Record<string, StepStatus>;
}

function parseStreamError(err: any): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err.error) return typeof err.error === "string" ? err.error : JSON.stringify(err.error);
  if (err.detail) return typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail);
  return JSON.stringify(err);
}

function ProgressBar({
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


export default function MyNextFastAPIApp() {
  type Theme = "dark" | "light";
  const [theme, setTheme] = useState<Theme>("dark");

  // load saved theme once (default dark)
  useEffect(() => {
    const saved = (localStorage.getItem("tb_theme") as Theme | null) ?? "dark";
    setTheme(saved);
  }, []);

  // apply theme to <html> via Tailwind "dark" class
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("tb_theme", theme);
  }, [theme]);


  // REQUIRED main image
  const [mainImage, setMainImage] = useState<File | null>(null);

  // OPTIONAL extra images (slots)
  const [files, setFiles] = useState<(File | null)[]>([null]);

  const [textInput, setTextInput] = useState<string>("");
  const [itemName, setItemName] = useState<string>("");

  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Structured results per mode
  const [activeData, setActiveData] = useState<FrontendPayload | null>(null);
  const [soldData, setSoldData] = useState<FrontendPayload | null>(null);
  const combinedData = useMemo(() => {
    if (!activeData && !soldData) return null;

    const base = activeData ?? soldData!;

    return {
      ...base,
      mode: "both",

      market_analysis: {
        active: activeData?.market_analysis.active ?? { similar_count: 0, price_range: null },
        sold: soldData?.market_analysis.sold ?? { similar_count: 0, price_range: null },
        sell_velocity:
          activeData?.market_analysis.sell_velocity ??
          soldData?.market_analysis.sell_velocity ??
          "unknown",
        rarity:
          activeData?.market_analysis.rarity ??
          soldData?.market_analysis.rarity ??
          "unknown",
      },

      // optional: pick one or merge
      legit_check_advice: base.legit_check_advice ?? [],
      summary: [activeData?.summary, soldData?.summary].filter(Boolean).join("\n\n"),

      // optional timing
      timing_sec: Math.round(((activeData?.timing_sec ?? 0) + (soldData?.timing_sec ?? 0)) * 1000) / 1000,
    };
  }, [activeData, soldData]);

  const [activeLoading, setActiveLoading] = useState(false);
  const [soldLoading, setSoldLoading] = useState(false);

  const [activeProgress, setActiveProgress] = useState(0);
  const [soldProgress, setSoldProgress] = useState(0);

  const [activeSteps, setActiveSteps] = useState<Record<string, StepStatus>>(makeInitialStepState());
  const [soldSteps, setSoldSteps] = useState<Record<string, StepStatus>>(makeInitialStepState());

  const activeAbortRef = useRef<AbortController | null>(null);
  const soldAbortRef = useRef<AbortController | null>(null);


  const [activeError, setActiveError] = useState<string>("");
  const [soldError, setSoldError] = useState<string>("");

  const activeBusy = activeLoading;
  const soldBusy = soldLoading;
  const anyBusy = activeBusy || soldBusy;

  // lightbox state
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxName, setLightboxName] = useState<string>("");

  const [runActive, setRunActive] = useState(true);
  const [runSold, setRunSold] = useState(false);

  const [collapseForm, setCollapseForm] = useState(false);
  const [hasRunOnce, setHasRunOnce] = useState(false);

  function buildDisplaySteps(stepState: Record<string, string>) {
    // Only show "done" + "active"
    // Represent active steps by adding ":active" suffix
    return STREAM_STEPS.flatMap((s) => {
      const st = stepState?.[s.id];
      if (st === "done") return [{ id: s.id, label: s.label }];
      if (st === "active") return [{ id: s.id + ":active", label: s.label }];
      return [];
    });
  }

  const overallProgress = (() => {
    const vals: number[] = [];
    if (runActive) vals.push(activeProgress ?? 0);
    if (runSold) vals.push(soldProgress ?? 0);
    if (vals.length === 0) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length; // average
  })();

  const showBoth = runActive && runSold;

  function stepIndexFromState(stepState: Record<string, StepStatus>): number {
    // First active step wins
    for (let i = 0; i < STREAM_STEPS.length; i++) {
      const id = STREAM_STEPS[i].id;
      if (stepState[id] === "active") return i;
    }
    // Otherwise: count how many are done in order
    let doneCount = 0;
    for (let i = 0; i < STREAM_STEPS.length; i++) {
      const id = STREAM_STEPS[i].id;
      if (stepState[id] === "done") doneCount++;
      else break;
    }
    return doneCount; // can be STREAM_STEPS.length when fully done
  }

  const combinedSteps = useMemo<Record<string, StepStatus>>(() => {
    if (!showBoth) return runActive ? activeSteps : soldSteps;

    const merged: Record<string, StepStatus> = makeInitialStepState();

    const idxA = stepIndexFromState(activeSteps);
    const idxB = stepIndexFromState(soldSteps);

    // lagging step (the one we should display as active)
    const lagIdx = Math.min(idxA, idxB);

    // Steps strictly before lagIdx are done for BOTH (in a sequential pipeline sense)
    for (let i = 0; i < lagIdx; i++) {
      merged[STREAM_STEPS[i].id] = "done";
    }

    // The lagging step itself is active while either run is still busy.
    // If both finished, everything becomes done.
    if (lagIdx < STREAM_STEPS.length) {
      merged[STREAM_STEPS[lagIdx].id] = (activeLoading || soldLoading) ? "active" : "done";
    }

    // If lagIdx === STREAM_STEPS.length, we mark all done (nothing active).
    if (lagIdx === STREAM_STEPS.length) {
      for (const s of STREAM_STEPS) merged[s.id] = "done";
    }

    return merged;
  }, [showBoth, runActive, activeSteps, soldSteps, activeLoading, soldLoading]);



  function addSlot() {
    setFiles((prev) => [...prev, null]);
  }

  function removeSlot(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function setSlotFile(index: number, file: File | null) {
    setFiles((prev) => {
      const next = prev.map((f, i) => (i === index ? file : f));

      // If user just filled the LAST slot, add a new empty slot
      if (index === prev.length - 1 && file != null) {
        next.push(null);
      }

      // Keep at least one empty slot around
      return next.length ? next : [null];
    });
  }

  const urlByFileRef = useRef<Map<File, string>>(new Map());

  function getObjectUrl(file: File) {
    const map = urlByFileRef.current;
    const existing = map.get(file);
    if (existing) return existing;

    const url = URL.createObjectURL(file);
    map.set(file, url);
    return url;
  }

  function revokeObjectUrl(file: File | null) {
    if (!file) return;
    const map = urlByFileRef.current;
    const url = map.get(file);
    if (url) {
      URL.revokeObjectURL(url);
      map.delete(file);
    }
  }

  useEffect(() => {
    return () => {
      for (const url of urlByFileRef.current.values()) URL.revokeObjectURL(url);
      urlByFileRef.current.clear();
    };
  }, []);


  function removeMainSelected() {
    revokeObjectUrl(mainImage);
    setMainImage(null);
  }

  function removeExtraSelectedBySlotIndex(slotIndex: number) {
    setFiles((prev) => {
      revokeObjectUrl(prev[slotIndex])
      // remove the slot entirely
      const next = prev.filter((_, i) => i !== slotIndex);

      // ensure at least 1 slot always exists
      return next.length ? next : [null];
    });
  }


  const clearAllSlots = () => setFiles([null]);

  const previews: Preview[] = useMemo(() => {
    const list: Preview[] = [];

    if (mainImage) {
      list.push({
        key: "main",
        url: getObjectUrl(mainImage),
        name: mainImage.name,
        label: "Main",
      });
    }

    const extras = files
      .map((f, idx) => ({ f, idx }))
      .filter(({ f }) => f != null) as { f: File; idx: number }[];

    extras.forEach(({ f, idx }, i) => {
      list.push({
        key: `extra-${idx}`,
        url: getObjectUrl(f),
        name: f.name,
        label: `Extra ${i + 1}`,
      });
    });

    return list;
  }, [mainImage, files]);

  const mainPreview = previews.find(p => p.key === "main");

  const extraPreviews = previews
    .filter(p => p.key.startsWith("extra-"))
    .map(p => {
      const slotIndex = Number(p.key.replace("extra-", ""));
      return { ...p, slotIndex };
    });

    function resetModeForNewRun(mode: Mode) {
    if (mode === "active") {
      setActiveError("");
      setActiveData(null);
      setActiveProgress(0);
      setActiveLoading(true); 
      setActiveSteps(makeInitialStepState());
    } else {
      setSoldError("");
      setSoldData(null);
      setSoldProgress(0);
      setSoldLoading(true); 
      setSoldSteps(makeInitialStepState());
    }
  }

  function clearModeCompletely(mode: Mode) {
    // same as reset, but also ensures it won't show "Done" from last time
    resetModeForNewRun(mode);
    if (mode === "active") setActiveLoading(false);
    else setSoldLoading(false);
  }

    
  // Close modal on ESC
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxUrl(null);
    }
    if (lightboxUrl) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxUrl]);

  async function runMode(mode: Mode) {
    if (!mainImage) {
      const msg = "Please upload a Main Image (full item, straight-on) before sending.";
      if (mode === "active") setActiveError(msg);
      else setSoldError(msg);
      return;
    }

    setHasRunOnce(true);
    setCollapseForm(true);
    setSubmitAttempted(true);

    if (mode === "active") setActiveError("");
    else setSoldError("");


    // abort any previous run for this mode
    if (mode === "active") activeAbortRef.current?.abort();
    else soldAbortRef.current?.abort();

    const controller = new AbortController();
    if (mode === "active") activeAbortRef.current = controller;
    else soldAbortRef.current = controller;

    try {
      const form = new FormData();
      form.append("main_image", mainImage);

      const prompt = textInput.trim();
      const item = itemName.trim();
      if (prompt.length > 0) form.append("text", prompt);
      if (item.length > 0) form.append("itemName", item);

      const extras = files.filter(Boolean) as File[];
      for (const f of extras) form.append("files", f);

      form.append("mode", mode);

      const res = await fetch("/api/py/extract-file-stream", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Request failed: ${res.status}${txt ? ` - ${txt}` : ""}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body stream");

      const decoder = new TextDecoder();
      let buffer = "";

      const setProgress = (p: number) => {
        const clamped = Math.max(0, Math.min(1, p));
        if (mode === "active") setActiveProgress(clamped);
        else setSoldProgress(clamped);
      };

      const setStep = (stepId: string, status: StepStatus) => {
        if (mode === "active") {
          setActiveSteps(prev => ({ ...prev, [stepId]: status }));
        } else {
          setSoldSteps(prev => ({ ...prev, [stepId]: status }));
        }
      };

      // helper: when a step starts, mark any other "active" step as done (keeps one current step)
      const normalizeActives = (currentStepId: string) => {
        const setter = mode === "active" ? setActiveSteps : setSoldSteps;
        setter(prev => {
          const next = { ...prev };
          for (const k of Object.keys(next)) {
            if (k !== currentStepId && next[k] === "active") next[k] = "done";
          }
          return next;
        });
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let msg: StreamEvent;
          try {
            msg = JSON.parse(trimmed);
          } catch {
            continue; // ignore malformed chunk
          }

          if (msg.type === "step") {
            if (msg.pct != null) setProgress(msg.pct);

            if (msg.status === "start") {
              normalizeActives(msg.step_id);
              setStep(msg.step_id, "active");
            } else {
              setStep(msg.step_id, "done");
            }
          }

          if (msg.type === "error") {
            throw new Error(parseStreamError(msg.error));
          }

          if (msg.type === "result") {
            const payload = msg.data;

            if (mode === "active") setActiveData(payload);
            else setSoldData(payload);

            setProgress(1);
            // mark any active step as done
            if (mode === "active") {
              setActiveSteps(prev => {
                const next = { ...prev };
                for (const k of Object.keys(next)) if (next[k] === "active") next[k] = "done";
                return next;
              });
            } else {
              setSoldSteps(prev => {
                const next = { ...prev };
                for (const k of Object.keys(next)) if (next[k] === "active") next[k] = "done";
                return next;
              });
            }
          }
        }
      }
    } catch (e: any) {
      const msg = e?.name === "AbortError" ? "Cancelled." : (e?.message ?? "Unknown error");
      if (mode === "active") setActiveError(msg);
      else setSoldError(msg);
    } finally {
      if (mode === "active") setActiveLoading(false);
      else setSoldLoading(false);
    }
  }

  async function runBoth() {
    await Promise.allSettled([runMode("active"), runMode("sold")]);
  }

  function Thumb({
    p,
    onOpen,
    onRemove,
  }: {
    p: { url: string; name: string; label: string };
    onOpen: () => void;
    onRemove: () => void;
  }) {
    return (
      <div
        className="group relative aspect-square overflow-hidden rounded-lg
                  border border-slate-800
                  bg-transparent"
        title="Click to enlarge"
      >
        <button type="button" onClick={onOpen} className="absolute inset-0">
          <img
            src={p.url}
            alt={p.name}
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </button>

        {/* Remove button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-1 right-1 z-10 rounded-md
                    bg-red-500/60 text-white
                    hover:bg-red-600/80 focus:outline-none
                    focus:ring-2 focus:ring-white/50 aspect-square w-[20px]
                    flex items-center justify-center leading-none"
          aria-label={`Remove ${p.label}`}
          title="Remove"
        >
          <svg viewBox="0 0 24 24" className="h-3 w-3">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    );
  }

  function ResultsCards({ data }: { data: FrontendPayload; }) {
    const ma = data.market_analysis;

    return (
      <div className="space-y-4">
        <Card
          title="Query"
          right={
            <div className="flex items-center gap-2">
              {data.timing_sec != null ? <Badge>{data.timing_sec}s</Badge> : null}
            </div>
          }
        >
          <div className="text-sm text-slate-700 dark:text-slate-400 space-y-1">
            <div>
              <span className="font-medium text-slate-900 dark:text-slate-200">Initial:</span>{" "}
              <span className="font-mono text-[13px]">{data.initial_query}</span>
            </div>
            <div>
              <span className="font-medium text-slate-900 dark:text-slate-200">Refined:</span>{" "}
              {data.refined_query ? (
                <span className="font-mono text-[13px]">{data.refined_query}</span>
              ) : (
                <span className="text-slate-500">—</span>
              )}
            </div>
            <div className="pt-2 flex flex-wrap gap-2">
              <Badge>Velocity: {ma.sell_velocity}</Badge>
              <Badge>Rarity: {ma.rarity}</Badge>
              <Badge>
                Matches: active {ma.active.similar_count} · sold {ma.sold.similar_count}
              </Badge>
            </div>
          </div>
        </Card>

        <Card title="Pricing Summary">
          <PriceSummaryCombined
            activeRange={ma.active.price_range}
            soldRange={ma.sold.price_range}
          />
        </Card>

        <Card title="Legit check (starter)">
          {data.legit_check_advice?.length ? (
            <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700 dark:text-slate-400">
              {data.legit_check_advice.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-slate-600">No advice available.</div>
          )}
        </Card>


        <Card title="Summary">
          <div className="text-sm text-slate-700 dark:text-slate-400 leading-relaxed">{data.summary || "—"}</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-10 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6 items-start">
          {/* LEFT */}
          <div className="flex flex-col gap-6">
            <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-black/5 space-y-5 dark:bg-slate-900 dark:ring-white/10">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  <span className="text-blue-700 dark:text-blue-400">Thrift</span>Buddy
                </h1>
                <div className="flex items-center gap-2">
                  {hasRunOnce && (collapseForm ? (
                      <button
                        type="button"
                        onClick={() => setCollapseForm(false)}
                        disabled={anyBusy}
                        className={[
                              "rounded-lg px-3 py-1.5 text-xs font-semibold border transition",
                              "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 dark:border-slate-800",
                          anyBusy ? "opacity-60 cursor-not-allowed" : "",
                        ].join(" ")}
                      >
                        Edit
                      </button>
                ) : (
                    <button 
                      onClick= {() => setCollapseForm(true)}
                      className={[
                              "rounded-lg px-3 py-1.5 text-xs font-semibold border transition",
                              "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 dark:border-slate-800",
                              anyBusy ? "opacity-60 cursor-not-allowed" : "",
                            ].join(" ")}
                      >
                        Collapse Form
                    </button>
                ))}
                  <button
                    type="button"
                    onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                    aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                    className={[
                      "relative inline-flex h-7 w-[64px] items-center rounded-full border shadow-sm transition",
                      "border-slate-300 bg-white hover:bg-slate-50",
                      "dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60",
                    ].join(" ")}
                  >
                    {/* icons */}
                    <span className="absolute left-2 text-xs select-none">🌙</span>
                    <span className="absolute right-2 text-xs select-none">☀️</span>

                    {/* thumb */}
                    <span
                      className={[
                        "absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full shadow transition-transform",
                        "bg-slate-900 dark:bg-white",
                        theme === "dark" ? "translate-x-[4px]" : "translate-x-[36px]",
                      ].join(" ")}
                    />
                  </button>
                </div>
              </div>
              {!collapseForm && (
                <>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4
                    dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Images</div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          Main is required. Extras help with tags, close-ups, flaws, angles.
                        </div>
                    </div>
                  </div>

                  {/* Main Image */}
                  <FileUploadCard
                    id="main-image-upload"
                    label="Main Image"
                    required
                    file={mainImage}
                    onFileChange={setMainImage}
                    accept="image/*"
                    disabled={anyBusy}
                    uploadText="Upload main image"
                    changeText="Change image"
                    hint="Imagine you are putting this item up for sale"
                    showMissingMessage={submitAttempted}
                    missingMessage="Main Image is required to submit."
                  />

                  {/* Extra Images */}
                  <MultiFileUploadCard
                    title="Extra Images (optional)"
                    files={files}
                    onChangeAt={(idx, f) => setSlotFile(idx, f)}
                    onAdd={addSlot}
                    onRemove={removeSlot}
                    onClearAll={clearAllSlots}
                    disabled={anyBusy}
                    idPrefix="extra-image"
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4
                    dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Optional Item Information</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                      Item Name <span className="text-slate-400">(optional)</span>
                    </label>

                    <input
                      type="text"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      placeholder="e.g. Nike Air Jordan 1 Retro High OG"
                      disabled={anyBusy}
                      className={[
                        "w-full rounded-lg border border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900 px-3 py-2 text-sm",
                        "text-slate-800 dark:text-slate-300",
                        "placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                        anyBusy ? "opacity-60 cursor-not-allowed" : "",
                      ].join(" ")}
                    />

                    <p className="text-xs text-slate-500">
                      If provided, we’ll skip AI identification and search marketplaces directly.
                    </p>
                  </div>
                
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                      Additional Details <span className="text-slate-400">(optional)</span>
                    </label>
                    <textarea
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder="e.g. Looks like a Star Wars DVD set, but I’m not sure which movies are included"
                      rows={3}
                      disabled={anyBusy}
                      className={[
                        "w-full rounded-lg border border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-300",
                        "placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                        anyBusy ? "opacity-60 cursor-not-allowed" : "",
                      ].join(" ")}
                    />
                  </div>
                </div>
                </>
              )}

              {collapseForm && (
                <>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2
                    dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="flex justify-between font-semibold text-slate-900 dark:text-slate-100">
                      Search Parameters
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        {/* Main + extras */}
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {mainImage ? `Main: ${mainImage.name}` : "Main: (none)"}
                          <span className="text-slate-500 dark:text-slate-400">
                            {" "}
                            · Extras: {(files.filter(Boolean) as File[]).length}
                          </span>
                        </div>

                        {/* Extra filenames (tiny) */}
                        {(() => {
                          const extras = files.filter(Boolean) as File[];
                          if (!extras.length) return null;
                          const shown = extras.slice(0, 2).map((f) => f.name).join(", ");
                          const more = extras.length > 2 ? ` +${extras.length - 2} more` : "";
                          return (
                            <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                              {shown}
                              {more}
                            </div>
                          );
                        })()}

                        {/* Text summary */}
                        {(itemName.trim() || textInput.trim()) ? (
                          <div className="text-xs text-slate-600 dark:text-slate-400">
                            <div className="font-medium text-slate-800 dark:text-slate-200">
                              {itemName.trim() ? truncate(itemName, 40) : "No item name"}
                            </div>
                            {textInput.trim() && (
                              <div className="text-slate-500 dark:text-slate-400">
                                {textInput}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            No optional text provided.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="flex flex-col gap-3">
                {/* Options */}
                <div className="flex flex-wrap items-center gap-3">
                  <CheckboxChip
                    checked={runActive}
                    onChange={setRunActive}
                    disabled={anyBusy}
                    label="Active listings"
                  />
                  <CheckboxChip
                    checked={runSold}
                    onChange={setRunSold}
                    disabled={anyBusy}
                    label="Sold listings"
                  />
                </div>



                {/* Run */}
                <button
                  type="button"
                  disabled={anyBusy || (!runActive && !runSold)}
                  onClick={async () => {
                      if (!mainImage) {
                        setActiveError(runActive ? "Please upload a Main Image (full item, straight-on) before sending." : "");
                        setSoldError(runSold ? "Please upload a Main Image (full item, straight-on) before sending." : "");
                        setCollapseForm(false); // keep form open
                        return;
                      }
                    setHasRunOnce(true);
                    setCollapseForm(true);
                    setSubmitAttempted(true);

                    // abort anything currently running (optional, but nice)
                    activeAbortRef.current?.abort();
                    soldAbortRef.current?.abort();

                    // Clear stale results for modes NOT selected
                    if (!runActive) clearModeCompletely("active");
                    if (!runSold) clearModeCompletely("sold");

                    // Reset state for modes that WILL run (so progress shows immediately)
                    if (runActive) resetModeForNewRun("active");
                    if (runSold) resetModeForNewRun("sold");

                    // Now actually run
                    if (runActive && runSold) await runBoth();
                    else if (runActive) await runMode("active");
                    else if (runSold) await runMode("sold");
                  }}

                  className={[
                    "w-full rounded-xl px-4 py-2 text-sm font-semibold transition",
                    anyBusy || (!runActive && !runSold)
                      ? "bg-slate-200 text-slate-500 cursor-not-allowed dark:bg-slate-800/50 dark:text-slate-500"
                      : "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600",
                  ].join(" ")}
                >
                  {anyBusy
                    ? "Running…"
                    : "Run"
                  }
                </button>
                {/* show errors (keep them separate, still useful) */}
                  {activeError || soldError ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                     {activeError || soldError}
                    </div>
                  ) : null}
              </div>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-black/5 space-y-5 dark:bg-slate-900 dark:ring-white/10">
              {/* RESULTS */}
                <div className="space-y-4">
                  {/* pick whichever payload exists to populate the combined cards */}
                  {combinedData && !anyBusy ? (
                    <ResultsCards data={combinedData!} />
                  ) : (
                    <>
                      {!anyBusy ? (
                        <div className="text-sm text-slate-600 rounded-xl border bg-white dark:border-slate-800 dark:bg-slate-900 p-4">
                          Run Active and/or Sold to see results.
                        </div>
                      ) : (
                        <div className="rounded-xl border bg-white dark:border-slate-800 dark:bg-slate-900 p-4 space-y-4">
                          {(() => {
                            const showBoth = runActive && runSold;
                            return (
                              <>
                                <div className="w-full">
                                <div className="pb-4">
                                  <ProgressBar value={overallProgress} isBusy={anyBusy} />
                                </div>
                                {showBoth ? (
                                  <StepColumn
                                    title={`Overall (${Math.round(overallProgress * 100)}%)`}
                                    steps={buildDisplaySteps(combinedSteps)}
                                    isLoading={anyBusy}
                                    isDone={!anyBusy && !!activeData && !!soldData && !activeError && !soldError}
                                  />
                                ) : runActive ? (
                                  <StepColumn
                                    title={`Active (${Math.round(activeProgress * 100)}%)`}
                                    steps={buildDisplaySteps(activeSteps)}
                                    isLoading={activeLoading}
                                    isDone={!activeLoading && !!activeData && !activeError}
                                  />
                                ) : (
                                  <StepColumn
                                    title={`Sold (${Math.round(soldProgress * 100)}%)`}
                                    steps={buildDisplaySteps(soldSteps)}
                                    isLoading={soldLoading}
                                    isDone={!soldLoading && !!soldData && !soldError}
                                  />
                                )}
                              </div>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </>
                  )}

                  {/* ONLY section that stays 2-column */}
                  {combinedData && !anyBusy && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <FullscreenCard title="Active listings" maxWidthClass="max-w-7xl">
                        {({ fullscreen }) =>
                          activeData?.example_listings?.length ? (
                            <ExampleListingsList listings={activeData.example_listings} fullscreen={fullscreen} />
                          ) : (
                            <div className="text-sm text-slate-600 dark:text-slate-300">
                              {activeLoading ? "Loading active…" : "Run Active to see examples."}
                            </div>
                          )
                        }
                      </FullscreenCard>

                      <FullscreenCard title="Sold listings" maxWidthClass="max-w-7xl">
                        {({ fullscreen }) =>
                          soldData?.example_listings?.length ? (
                            <ExampleListingsList listings={soldData.example_listings} fullscreen={fullscreen} />
                          ) : (
                            <div className="text-sm text-slate-600 dark:text-slate-300">
                              {soldLoading ? "Loading sold…" : "Run Sold to see examples."}
                            </div>
                          )
                        }
                      </FullscreenCard>
                    </div>
                  )}
                </div>
            </div>
          </div>
          
          {/* RIGHT */}
          <div className="sticky top-10 self-start">
            {!mainPreview && extraPreviews.length === 0 ? (
              <div className="text-sm text-slate-500">No images selected yet.</div>
            ) : (
              <div className="space-y-4">
                {/* Main */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">Main Image</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{mainPreview ? 1 : 0}</div>
                  </div>

                  {mainPreview ? (
                    <Thumb
                      p={mainPreview}
                      onOpen={() => { setLightboxUrl(mainPreview.url); setLightboxName(mainPreview.name); }}
                      onRemove={removeMainSelected}
                    />
                  ) : (
                    <div className="text-xs text-slate-500 dark:text-slate-400">No main image selected.</div>
                  )}
                </div>

                {/* Extras */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">Extra Images</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{extraPreviews.length}</div>
                  </div>

                  {extraPreviews.length ? (
                    <div className="grid grid-cols-3 lg:grid-cols-2 gap-2">
                      {extraPreviews.map((p) => (
                        <Thumb
                          key={p.key}
                          p={p}
                          onOpen={() => { setLightboxUrl(p.url); setLightboxName(p.name); }}
                          onRemove={() => removeExtraSelectedBySlotIndex(p.slotIndex)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 dark:text-slate-400">No extra images selected.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LIGHTBOX MODAL */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setLightboxUrl(null);
          }}
        >
          <div className="w-full max-w-4xl">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-white/90 truncate">{lightboxName}</div>
              <button
                type="button"
                onClick={() => setLightboxUrl(null)}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
              >
                Close
              </button>
            </div>

            <div className="rounded-xl overflow-hidden bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxUrl}
                alt={lightboxName}
                className="w-full max-h-[75vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
