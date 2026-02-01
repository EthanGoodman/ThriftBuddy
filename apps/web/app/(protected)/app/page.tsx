"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileUploadCard } from "@/components/file-upload";
import { MultiFileUploadCard } from "@/components/multi-file-upload";
import { FullscreenCard } from "@/components/full-screen-modal";
import {truncate} from "@/lib/thrift/format"
import {getVisiblePricedListings, computePriceRangeFromListings} from "@/lib/thrift/listing"
import {makeInitialStepState, parseStreamError, stepIndexFromState, StepStatus, STREAM_STEPS, StreamEvent} from "@/lib/thrift/stream"
import {Badge} from "@/components/Badge"
import {Card} from "@/components/Card"
import {CheckboxChip} from "@/components/CheckboxChip"
import {ProgressBar} from "@/components/ProgressBar"
import {StepColumn} from "@/components/StepColumn"
import {PriceSummaryCombined} from "@/components/PriceSummaryCombined"
import {ExampleListingsList} from "@/components/ExampleListingList"

export type Preview = {
  key: string;
  url: string;
  name: string;
  label: string;
};

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

  const [dismissedActive, setDismissedActive] = useState<Set<string>>(() => new Set());
  const [dismissedSold, setDismissedSold] = useState<Set<string>>(() => new Set());

  const dismissActive = (key: string) =>
    setDismissedActive((prev) => new Set(prev).add(key));

  const dismissSold = (key: string) =>
    setDismissedSold((prev) => new Set(prev).add(key));

  // Structured results per mode
  const [activeData, setActiveData] = useState<FrontendPayload | null>(null);
  const [soldData, setSoldData] = useState<FrontendPayload | null>(null);
  const derivedActiveRange = useMemo(
    () => computePriceRangeFromListings(activeData?.active_listings, dismissedActive),
    [activeData?.active_listings, dismissedActive]
  );

  const derivedSoldRange = useMemo(
    () => computePriceRangeFromListings(soldData?.sold_listings, dismissedSold),
    [soldData?.sold_listings, dismissedSold]
  );

  const derivedActiveCount = useMemo(() => {
    return getVisiblePricedListings(activeData?.active_listings, dismissedActive).length;
  }, [activeData?.active_listings, dismissedActive]);

  const derivedSoldCount = useMemo(() => {
    return getVisiblePricedListings(soldData?.sold_listings, dismissedSold).length;
  }, [soldData?.sold_listings, dismissedSold]);
  const combinedData = useMemo(() => {
    if (!activeData && !soldData) return null;

    const base = activeData ?? soldData!;
    const baseMA = base.market_analysis;

    // build combined market_analysis, but override price_range + similar_count
    const mergedMA = {
      active: {
        similar_count: derivedActiveCount,
        price_range: derivedActiveRange,
      },
      sold: {
        similar_count: derivedSoldCount,
        price_range: derivedSoldRange,
      },
      sell_velocity:
        activeData?.market_analysis.sell_velocity ??
        soldData?.market_analysis.sell_velocity ??
        baseMA.sell_velocity ??
        "unknown",
      rarity:
        activeData?.market_analysis.rarity ??
        soldData?.market_analysis.rarity ??
        baseMA.rarity ??
        "unknown",
    };

    return {
      ...base,
      mode: "both",
      market_analysis: mergedMA,
      legit_check_advice: base.legit_check_advice ?? [],
      summary: [activeData?.summary, soldData?.summary].filter(Boolean).join("\n\n"),
      timing_sec:
        activeData && soldData
          ? Math.round(((activeData?.timing_sec ?? 0)) * 1000) / 1000
          : Math.round(((activeData?.timing_sec ?? 0) + (soldData?.timing_sec ?? 0)) * 1000) / 1000,
    };
  }, [
    activeData,
    soldData,
    derivedActiveRange,
    derivedSoldRange,
    derivedActiveCount,
    derivedSoldCount,
  ]);


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
        setDismissedActive(new Set());
        setActiveError("");
        setActiveData(null);
        setActiveProgress(0);
        setActiveLoading(true); 
        setActiveSteps(makeInitialStepState());
      } else {
        setDismissedSold(new Set());
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
      else if (mode === "sold") setSoldError(msg);
      else { // both
        setActiveError(msg);
        setSoldError(msg);
      }
      return;
    }

    setHasRunOnce(true);
    setCollapseForm(true);
    setSubmitAttempted(true);

    // clear errors
    if (mode === "active") setActiveError("");
    else if (mode === "sold") setSoldError("");
    else {
      setActiveError("");
      setSoldError("");
    }

    // abort any previous run for this mode
    if (mode === "active") activeAbortRef.current?.abort();
    else if (mode === "sold") soldAbortRef.current?.abort();
    else {
      activeAbortRef.current?.abort();
      soldAbortRef.current?.abort();
    }

    const controller = new AbortController();
    if (mode === "active") activeAbortRef.current = controller;
    else if (mode === "sold") soldAbortRef.current = controller;
    else {
      activeAbortRef.current = controller;
      soldAbortRef.current = controller;
    }

    try {
      // IMPORTANT: make sure loading is set true somewhere before fetch
      if (mode === "active") setActiveLoading(true);
      else if (mode === "sold") setSoldLoading(true);
      else {
        setActiveLoading(true);
        setSoldLoading(true);
      }

      const form = new FormData();
      form.append("main_image", mainImage);

      const prompt = textInput.trim();
      const item = itemName.trim();
      if (prompt.length > 0) form.append("text", prompt);
      if (item.length > 0) form.append("itemName", item);

      const extras = files.filter(Boolean) as File[];
      for (const f of extras) form.append("files", f);

      form.append("mode", mode);

      if (mode === "both") {
        setDismissedActive(new Set());
        setDismissedSold(new Set());
      }
      
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
        else if (mode === "sold") setSoldProgress(clamped);
        else {
          setActiveProgress(clamped);
          setSoldProgress(clamped);
        }
      };

      const setStep = (stepId: string, status: StepStatus) => {
        if (mode === "active") setActiveSteps(prev => ({ ...prev, [stepId]: status }));
        else if (mode === "sold") setSoldSteps(prev => ({ ...prev, [stepId]: status }));
        else {
          setActiveSteps(prev => ({ ...prev, [stepId]: status }));
          setSoldSteps(prev => ({ ...prev, [stepId]: status }));
        }
      };

      const normalizeActives = (currentStepId: string) => {
        const normalize = (setter: any) => {
          setter((prev: any) => {
            const next = { ...prev };
            for (const k of Object.keys(next)) {
              if (k !== currentStepId && next[k] === "active") next[k] = "done";
            }
            return next;
          });
        };

        if (mode === "active") normalize(setActiveSteps);
        else if (mode === "sold") normalize(setSoldSteps);
        else {
          normalize(setActiveSteps);
          normalize(setSoldSteps);
        }
      };

      const handleLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        let msg: StreamEvent;
        try {
          msg = JSON.parse(trimmed);
        } catch {
          return; // ignore malformed chunk
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
          else if (mode === "sold") setSoldData(payload);
          else {
            // payload contains both in one response
            setActiveData(payload);
            setSoldData(payload);
          }

          setProgress(1);

          const markDone = (setter: any) => {
            setter((prev: any) => {
              const next = { ...prev };
              for (const k of Object.keys(next)) if (next[k] === "active") next[k] = "done";
              return next;
            });
          };

          if (mode === "active") markDone(setActiveSteps);
          else if (mode === "sold") markDone(setSoldSteps);
          else {
            markDone(setActiveSteps);
            markDone(setSoldSteps);
          }
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) handleLine(line);
      }

      const tail = buffer.trim();
      if (tail) handleLine(tail);

    } catch (e: any) {
      const msg = e?.name === "AbortError" ? "Cancelled." : (e?.message ?? "Unknown error");
      if (mode === "active") setActiveError(msg);
      else if (mode === "sold") setSoldError(msg);
      else {
        setActiveError(msg);
        setSoldError(msg);
      }
    } finally {
      if (mode === "active") setActiveLoading(false);
      else if (mode === "sold") setSoldLoading(false);
      else {
        setActiveLoading(false);
        setSoldLoading(false);
      }
    }
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
        className=" border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 
        group relative aspect-square overflow-hidden rounded-lg bg-transparent"
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
                    if (runActive && runSold) await runMode("both");
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
                          activeData?.active_listings?.length ? (
                            <ExampleListingsList
                              listings={activeData.active_listings}
                              fullscreen={fullscreen}
                              dismissedKeys={dismissedActive}
                              onDismiss={dismissActive}
                            />

                          ) : (
                            <div className="text-sm text-slate-600 dark:text-slate-300">
                              {activeLoading ? "Loading active…" : "Run Active to see examples."}
                            </div>
                          )
                        }
                      </FullscreenCard>

                      <FullscreenCard title="Sold listings" maxWidthClass="max-w-7xl">
                        {({ fullscreen }) =>
                          soldData?.sold_listings?.length ? (
                            <ExampleListingsList
                              listings={soldData.sold_listings}
                              fullscreen={fullscreen}
                              dismissedKeys={dismissedSold}
                              onDismiss={dismissSold}
                            />
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
          <div className="sticky top-24 self-start">
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
