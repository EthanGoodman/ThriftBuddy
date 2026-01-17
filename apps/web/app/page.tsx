"use client";

import { useEffect, useMemo, useState } from "react";

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

function isWrappedResponse(x: any): x is { data: FrontendPayload; debug?: any } {
  return x && typeof x === "object" && "data" in x;
}

function fmtMoney(x: number | null | undefined) {
  if (x == null || Number.isNaN(x)) return "—";
  return `$${x.toFixed(2)}`;
}

function PriceSummary({
  range,
}: {
  range: PriceRange;
}) {
  if (!range || !range.n) {
    return (
      <div className="text-sm text-slate-600 dark:text-slate-300">
        Pricing estimate unavailable (too few comparable listings).
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-slate-700 dark:text-slate-400">
        <span className="font-medium text-slate-900 dark:text-slate-200">Median:</span>{" "}
        <span className="font-semibold">{fmtMoney(range.median)}</span>
      </div>

      <div className="text-sm text-slate-700 dark:text-slate-400">
        <span className="font-medium text-slate-900 dark:text-slate-200">Price Range:</span>{" "}
        {fmtMoney(range.low)} – {fmtMoney(range.high)}
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-500">
        Q1 {fmtMoney(range.q1)} · Q3 {fmtMoney(range.q3)}
      </div>

      <div className="text-sm text-slate-700 dark:text-slate-400">
        <span className="font-medium text-slate-900 dark:text-slate-200">Listings Used:</span>{" "}
        {range.n}
      </div>
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


function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
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

  // Structured results per mode
  const [activeData, setActiveData] = useState<FrontendPayload | null>(null);
  const [soldData, setSoldData] = useState<FrontendPayload | null>(null);

  const [activeLoading, setActiveLoading] = useState(false);
  const [soldLoading, setSoldLoading] = useState(false);

  const [activeError, setActiveError] = useState<string>("");
  const [soldError, setSoldError] = useState<string>("");

  const activeBusy = activeLoading;
  const soldBusy = soldLoading;
  const anyBusy = activeBusy || soldBusy;

  // lightbox state
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxName, setLightboxName] = useState<string>("");

  function addSlot() {
    setFiles((prev) => [...prev, null]);
  }

  function removeSlot(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function setSlotFile(index: number, file: File | null) {
    setFiles((prev) => prev.map((f, i) => (i === index ? file : f)));
  }

  // Build preview URLs for selected files
  const previews: Preview[] = useMemo(() => {
    const list: Preview[] = [];

    if (mainImage) {
      list.push({
        key: "main",
        url: URL.createObjectURL(mainImage),
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
        url: URL.createObjectURL(f),
        name: f.name,
        label: `Extra ${i + 1}`,
      });
    });

    return list;
  }, [mainImage, files]);

  // Cleanup object URLs when previews change/unmount
  useEffect(() => {
    return () => {
      for (const p of previews) URL.revokeObjectURL(p.url);
    };
  }, [previews]);

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

    // per-mode state resets
    if (mode === "active") {
      setActiveLoading(true);
      setActiveError("");
      setActiveData(null);
    } else {
      setSoldLoading(true);
      setSoldError("");
      setSoldData(null);
    }

    const controller = new AbortController();

    try {
      const form = new FormData();
      form.append("main_image", mainImage);

      const prompt = textInput.trim();
      if (prompt.length > 0) form.append("text", prompt);

      const extras = files.filter(Boolean) as File[];
      for (const f of extras) form.append("files", f);

      form.append("mode", mode);

      const res = await fetch("/api/py/extract-file", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Request failed: ${res.status}${txt ? ` - ${txt}` : ""}`);
      }

      const json: ApiResponse = await res.json();
      const payload = isWrappedResponse(json) ? json.data : json;

      if (mode === "active") setActiveData(payload);
      else setSoldData(payload);
    } catch (e: any) {
      const msg = e?.message ?? "Unknown error";
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

  function ResultsCards({ data, mode }: { data: FrontendPayload; mode: Mode }) {
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

        <Card title="Pricing Summary" right={<Badge>Outliers filtered</Badge>}>
          <PriceSummary range={mode === "active" ? ma.active.price_range : ma.sold.price_range} />
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

        <Card title="Example listings">
          {data.example_listings?.length ? (
            <div className="max-h-[280px] overflow-y-auto scrollbar-clean [scrollbar-gutter:stable] pr-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.example_listings
                  .filter(it => it.price?.extracted != null)
                  .sort((a, b) => a.price.extracted - b.price.extracted)
                  .slice(0, 51)
                  .map((it, idx) => (

                  <a
                    key={(it.product_id ?? "") + idx}
                    href={it.link || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-50 p-3 transition dark:bg-slate-900 dark:ring-white/10"
                  >
                    <div className="flex gap-3">
                      <div className="h-16 w-16 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
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
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-400 line-clamp-2">
                          {it.title || "Untitled listing"}
                        </div>
                        <div className="mt-1 text-xs text-slate-600 flex flex-wrap gap-x-2 gap-y-1">
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
          ) : (
            <div className="text-sm text-slate-600">No example listings available.</div>
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
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
          {/* LEFT */}
          <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-black/5 space-y-5 dark:bg-slate-900 dark:ring-white/10">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                <span className="text-blue-700 dark:text-blue-400">Thrift</span>Buddy
              </h1>
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
              <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Main Image <span className="text-red-600">*</span>
                  </label>
                  {mainImage ? (
                    <button
                      type="button"
                      onClick={() => setMainImage(null)}
                      disabled={anyBusy}
                      className={[
                        "text-xs rounded-lg px-2 py-1",
                        "bg-white dark:border-slate-800 dark:bg-slate-800/60 border border-slate-200 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700",
                        anyBusy ? "opacity-60 cursor-not-allowed" : "",
                      ].join(" ")}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setMainImage(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm
                        text-slate-700 dark:text-slate-200
                        file:mr-4 file:rounded-lg file:border-0
                        file:bg-slate-200 file:text-slate-800 hover:file:bg-slate-300
                        dark:file:bg-slate-800/60 dark:file:text-slate-200 dark:hover:file:bg-slate-700
                        file:px-4 file:py-2 file:text-sm file:font-medium"
                  disabled={anyBusy}
                />

                <div className="text-xs text-slate-600">
                  Try: full item, straight-on, fill the frame.
                </div>

                {!mainImage && (
                  <div className="text-xs text-red-700">Main Image is required to submit.</div>
                )}
              </div>

              {/* Extra Images */}
              <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-4 space-y-3">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Extra Images (optional)</div>

                {files.map((file, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row gap-3 sm:items-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setSlotFile(idx, e.target.files?.[0] ?? null)}
                      className="block w-full text-sm
                        text-slate-700 dark:text-slate-200
                        file:mr-4 file:rounded-lg file:border-0
                        file:bg-slate-200 file:text-slate-800 hover:file:bg-slate-300
                        dark:file:bg-slate-800/60 dark:file:text-slate-200 dark:hover:file:bg-slate-700
                        file:px-4 file:py-2 file:text-sm file:font-medium"
                      disabled={anyBusy}
                    />

                    <div className="flex gap-2">
                      {idx === files.length - 1 && (
                        <button
                          type="button"
                          onClick={addSlot}
                          disabled={anyBusy}
                          className={[
                            "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium",
                            "bg-slate-200 text-slate-800 hover:bg-slate-300",
                            "dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-700",
                            anyBusy ? "opacity-60 cursor-not-allowed" : "",
                          ].join(" ")}
                          title="Add another image"
                        >
                          + Add
                        </button>
                      )}

                      {files.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSlot(idx)}
                          disabled={anyBusy}
                          className={[
                            "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium",
                            "bg-slate-200 text-slate-800 hover:bg-slate-300",
                            "dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-700",
                            anyBusy ? "opacity-60 cursor-not-allowed" : "",
                          ].join(" ")}
                          title="Remove this image"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                Optional Text
              </label>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="e.g., 'Star Wars trilogy DVD set' or any details you know"
                rows={3}
                disabled={anyBusy}
                className={[
                  "w-full rounded-lg border border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-300",
                  "placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                  anyBusy ? "opacity-60 cursor-not-allowed" : "",
                ].join(" ")}
              />
            </div>

            {/* Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => runMode("active")}
                disabled={!mainImage || activeBusy || soldBusy}
                className={[
                  "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition",
                  "text-white shadow-sm",
                  (!mainImage || activeBusy || soldBusy)
                    ? "bg-slate-200 cursor-not-allowed opacity-70 dark:bg-slate-800 dark:opacity-60"
                    : [
                        "bg-blue-600 hover:bg-blue-700 active:bg-blue-800",
                        "dark:bg-blue-500/70 dark:hover:bg-blue-500/80 dark:active:bg-blue-500",
                      ].join(" "),
                ].join(" ")}
              >
                {activeLoading ? "Loading Active..." : "Get Active Listings"}
              </button>

              <button
                type="button"
                onClick={() => runMode("sold")}
                disabled={!mainImage || soldBusy || activeBusy}
                className={[
                  "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition",
                  "text-white shadow-sm",
                  (!mainImage || soldBusy || activeBusy)
                    ? "bg-slate-200 cursor-not-allowed opacity-70 dark:bg-slate-800 dark:opacity-60"
                    : [
                        // light mode
                        "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800",
                        // dark mode (muted, calm)
                        "dark:bg-emerald-500/70 dark:hover:bg-emerald-500/80 dark:active:bg-emerald-500",
                      ].join(" "),
                ].join(" ")}
              >
                {soldLoading ? "Loading Sold..." : "Get Sold Listings"}
              </button>

              <button
                type="button"
                onClick={runBoth}
                disabled={!mainImage || anyBusy}
                className={[
                  "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium",
                  "text-slate-900 shadow-sm transition border",
                  "dark:text-slate-100",
                  (!mainImage || anyBusy)
                    ? "bg-slate-200 cursor-not-allowed border-slate-200 opacity-70 dark:bg-slate-800 dark:border-slate-800 dark:opacity-60"
                    : "bg-white hover:bg-slate-50 border-slate-300 dark:bg-slate-900 dark:hover:bg-slate-800 dark:border-slate-700",
                ].join(" ")}

                title="Runs Active and Sold at the same time (heavier)."
              >
                Run Both
              </button>
            </div>

            {/* RESULTS: cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* ACTIVE */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Active Results</h3>
                  <span className="text-xs text-slate-500">{activeLoading ? "running…" : ""}</span>
                </div>

                {activeError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {activeError}
                  </div>
                )}

                {activeData ? (
                  <ResultsCards data={activeData} mode="active" />
                ) : (
                  <div className="text-sm text-slate-600 rounded-xl border bg-white dark:border-slate-800 dark:bg-slate-900 p-4">
                    Click <span className="font-medium">Get Active Listings</span> to run.
                  </div>
                )}
              </div>

              {/* SOLD */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Sold Results</h3>
                  <span className="text-xs text-slate-500">{soldLoading ? "running…" : ""}</span>
                </div>

                {soldError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {soldError}
                  </div>
                )}

                {soldData ? (
                  <ResultsCards data={soldData} mode="sold" />
                ) : (
                  <div className="text-sm text-slate-600 rounded-xl border bg-white dark:border-slate-800 dark:bg-slate-900 p-4">
                    Click <span className="font-medium">Get Sold Listings</span> to run.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="rounded-2xl bg-white p-4 shadow-lg ring-1 ring-black/5
                dark:bg-slate-900 dark:ring-white/10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Selected Images</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">{previews.length}</span>
            </div>


            {previews.length === 0 ? (
              <div className="text-sm text-slate-500">No images selected yet.</div>
            ) : (
              <div className="grid grid-cols-3 lg:grid-cols-2 gap-2">
                {previews.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      setLightboxUrl(p.url);
                      setLightboxName(p.name);
                    }}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-50
                              dark:border-slate-800 dark:bg-slate-950/40"
                    title="Click to enlarge"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt={p.name}
                      className="h-full w-full object-cover group-hover:scale-[1.02] transition"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-black/50 px-1 py-0.5 text-[10px] text-white truncate">
                      {p.label}: {p.name}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Tip: click a thumbnail to enlarge. Press <span className="font-mono">Esc</span> to close.
            </div>
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
