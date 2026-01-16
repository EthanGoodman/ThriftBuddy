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
  | { data: FrontendPayload; debug?: any }; // debug is intentionally "any"

function isWrappedResponse(x: any): x is { data: FrontendPayload; debug?: any } {
  return x && typeof x === "object" && "data" in x;
}

function fmtMoney(x: number | null | undefined) {
  if (x == null || Number.isNaN(x)) return "—";
  return `$${x.toFixed(2)}`;
}

function PriceRangeLine({ label, range }: { label: string; range: PriceRange }) {
  if (!range || !range.n) {
    return (
      <div className="text-sm text-slate-600">
        <span className="font-medium">{label}:</span> Not enough priced matches.
      </div>
    );
  }

  return (
    <div className="text-sm text-slate-700">
      <div>
        <span className="font-medium">{label}:</span>{" "}
        <span className="font-semibold">{fmtMoney(range.median)}</span>{" "}
        <span className="text-slate-500">
          (typical {fmtMoney(range.low)}–{fmtMoney(range.high)}, n={range.n})
        </span>
      </div>
      <div className="text-xs text-slate-500 mt-0.5">
        Q1 {fmtMoney(range.q1)} · Q3 {fmtMoney(range.q3)}
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
      {children}
    </span>
  );
}

function Card({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-lg ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      {children}
    </div>
  );
}

export default function MyNextFastAPIApp() {
  // REQUIRED main image
  const [mainImage, setMainImage] = useState<File | null>(null);

  // OPTIONAL extra images (slots)
  const [files, setFiles] = useState<(File | null)[]>([null]);

  const [textInput, setTextInput] = useState<string>("");

  // Structured results per mode
  const [activeData, setActiveData] = useState<FrontendPayload | null>(null);
  const [soldData, setSoldData] = useState<FrontendPayload | null>(null);

  // Raw/debug storage (for dev)
  const [activeRaw, setActiveRaw] = useState<any>(null);
  const [soldRaw, setSoldRaw] = useState<any>(null);

  const [showRaw, setShowRaw] = useState(false);
  const [includeDebug, setIncludeDebug] = useState(false);

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

  const canSubmit = useMemo(() => {
    return mainImage != null && !anyBusy;
  }, [mainImage, anyBusy]);

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
      setActiveRaw(null);
    } else {
      setSoldLoading(true);
      setSoldError("");
      setSoldData(null);
      setSoldRaw(null);
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

      // Optional debug wrapper from backend
      if (includeDebug) form.append("include_debug", "true");

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
      const raw = json; // keep full for debugging

      if (mode === "active") {
        setActiveData(payload);
        setActiveRaw(raw);
      } else {
        setSoldData(payload);
        setSoldRaw(raw);
      }

      // optional: quick console output
      // console.log(`[${mode}] payload`, payload);
      // console.log(`[${mode}] raw`, raw);
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

  function ResultsCards({ data }: { data: FrontendPayload }) {
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
          <div className="text-sm text-slate-700 space-y-1">
            <div>
              <span className="font-medium text-slate-900">Initial:</span>{" "}
              <span className="font-mono text-[13px]">{data.initial_query}</span>
            </div>
            <div>
              <span className="font-medium text-slate-900">Refined:</span>{" "}
              {data.refined_query ? (
                <span className="font-mono text-[13px]">{data.refined_query}</span>
              ) : (
                <span className="text-slate-500">—</span>
              )}
            </div>
            <div className="pt-2 flex flex-wrap gap-2">
              <Badge>Velocity: {ma.sell_velocity}</Badge>
              <Badge>Rarity: {ma.rarity}</Badge>
              <Badge>Matches: active {ma.active.similar_count} · sold {ma.sold.similar_count}</Badge>
            </div>
          </div>
        </Card>

        <Card title="Pricing (outliers filtered)">
          <div className="space-y-3">
            <PriceRangeLine label="Active listings" range={ma.active.price_range} />
            <PriceRangeLine label="Sold listings" range={ma.sold.price_range} />
          </div>
          <div className="text-xs text-slate-500 mt-3">
            Uses your image-similarity matched set and removes price outliers via IQR.
          </div>
        </Card>

        <Card title="Legit check (starter)">
          {data.legit_check_advice?.length ? (
            <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.example_listings.slice(0, 6).map((it, idx) => (
                <a
                  key={(it.product_id ?? "") + idx}
                  href={it.link || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="group rounded-xl border border-slate-200 bg-white hover:bg-slate-50 p-3 transition"
                >
                  <div className="flex gap-3">
                    <div className="h-16 w-16 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {it.thumbnail ? (
                        <img src={it.thumbnail} alt={it.title || "listing"} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">
                          no img
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 line-clamp-2">
                        {it.title || "Untitled listing"}
                      </div>
                      <div className="mt-1 text-xs text-slate-600 flex flex-wrap gap-x-2 gap-y-1">
                        <span className="font-semibold">
                          {it.price?.extracted != null ? fmtMoney(it.price.extracted) : it.price?.raw ?? "—"}
                        </span>
                        {typeof it.image_similarity === "number" ? (
                          <span className="text-slate-500">
                            sim {(it.image_similarity * 100).toFixed(1)}%
                          </span>
                        ) : null}
                        {it.condition ? <span className="text-slate-500">{it.condition}</span> : null}
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-600">No example listings available.</div>
          )}
        </Card>

        <Card title="Summary">
          <div className="text-sm text-slate-700 leading-relaxed">{data.summary || "—"}</div>
        </Card>
      </div>
    );
  }

  function RawPanel({ raw }: { raw: any }) {
    return (
      <div className="rounded-xl bg-slate-950 text-slate-100 p-4 max-w-full overflow-x-auto">
        <pre className="m-0 whitespace-pre-wrap break-words break-all text-xs leading-relaxed">
          {raw ? JSON.stringify(raw, null, 2) : "No raw payload yet."}
        </pre>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
          {/* LEFT */}
          <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-black/5 space-y-5">
            <div className="space-y-1">
              <h1 className="text-xl font-semibold">🧠 ThriftBuddy Extract (Test)</h1>
              <p className="text-sm text-slate-600">
                Upload a <span className="font-medium">Main Image</span> (full item, straight-on). Extras are optional.
              </p>
            </div>

            {/* REQUIRED main image */}
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-slate-800">
                  Main Image <span className="text-red-600">*</span>
                </label>
                {mainImage ? (
                  <button
                    type="button"
                    onClick={() => setMainImage(null)}
                    disabled={anyBusy}
                    className={[
                      "text-xs rounded-lg px-2 py-1",
                      "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100",
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
                className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700"
                disabled={anyBusy}
              />

              <div className="text-xs text-slate-600">
                Required for photo-matching later. Try: full item, straight-on, fill the frame.
              </div>

              {!mainImage && <div className="text-xs text-red-700">Main Image is required to submit.</div>}
            </div>

            {/* Optional text input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Optional text (extra context / prompt)
              </label>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="e.g., 'Star Wars 2000 piece puzzle Buffalo Games sealed'"
                rows={3}
                disabled={anyBusy}
                className={[
                  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800",
                  "placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                  anyBusy ? "opacity-60 cursor-not-allowed" : "",
                ].join(" ")}
              />
              <div className="text-xs text-slate-500">
                Sent as form field <span className="font-mono">text</span> only if non-empty.
              </div>
            </div>

            {/* Debug toggles */}
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={showRaw}
                  onChange={(e) => setShowRaw(e.target.checked)}
                  disabled={anyBusy}
                />
                Show raw JSON panels
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={includeDebug}
                  onChange={(e) => setIncludeDebug(e.target.checked)}
                  disabled={anyBusy}
                />
                Request backend debug payload
                <span className="text-xs text-slate-500">(heavier)</span>
              </label>
            </div>

            {/* OPTIONAL extra file slots */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-800">
                Extra Images (optional)
                <div className="text-xs text-slate-500 font-normal">Tags, close-ups, flaws, alternate angles.</div>
              </div>

              {files.map((file, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setSlotFile(idx, e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-200 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-800 hover:file:bg-slate-300"
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

              <div className="text-xs text-slate-600">
                Main: {mainImage ? "1" : "0"} / 1 · Extras: {files.filter(Boolean).length} / {files.length}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => runMode("active")}
                  disabled={!mainImage || activeBusy || soldBusy}
                  className={[
                    "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium",
                    "text-white shadow-sm transition",
                    (!mainImage || activeBusy || soldBusy)
                      ? "bg-slate-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800",
                  ].join(" ")}
                >
                  {activeLoading ? "Loading Active..." : "Get Active Listings"}
                </button>

                <button
                  type="button"
                  onClick={() => runMode("sold")}
                  disabled={!mainImage || soldBusy || activeBusy}
                  className={[
                    "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium",
                    "text-white shadow-sm transition",
                    (!mainImage || soldBusy || activeBusy)
                      ? "bg-slate-400 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800",
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
                    (!mainImage || anyBusy)
                      ? "bg-slate-200 cursor-not-allowed border-slate-200"
                      : "bg-white hover:bg-slate-50 border-slate-300",
                  ].join(" ")}
                  title="Runs Active and Sold at the same time (heavier)."
                >
                  Run Both
                </button>
              </div>
            </div>

            {/* RESULTS: cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* ACTIVE */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">Active Results</h3>
                  <span className="text-xs text-slate-500">{activeLoading ? "running…" : ""}</span>
                </div>

                {activeError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {activeError}
                  </div>
                )}

                {activeData ? (
                  <ResultsCards data={activeData} />
                ) : (
                  <div className="text-sm text-slate-600 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    Click <span className="font-medium">Get Active Listings</span> to run.
                  </div>
                )}

                {showRaw ? <RawPanel raw={activeRaw} /> : null}
              </div>

              {/* SOLD */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">Sold Results</h3>
                  <span className="text-xs text-slate-500">{soldLoading ? "running…" : ""}</span>
                </div>

                {soldError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {soldError}
                  </div>
                )}

                {soldData ? (
                  <ResultsCards data={soldData} />
                ) : (
                  <div className="text-sm text-slate-600 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    Click <span className="font-medium">Get Sold Listings</span> to run.
                  </div>
                )}

                {showRaw ? <RawPanel raw={soldRaw} /> : null}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="rounded-2xl bg-white p-4 shadow-lg ring-1 ring-black/5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-800">Selected Images</h2>
              <span className="text-xs text-slate-500">{previews.length}</span>
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
                    className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                    title="Click to enlarge"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.name} className="h-full w-full object-cover group-hover:scale-[1.02] transition" />
                    <div className="absolute inset-x-0 bottom-0 bg-black/50 px-1 py-0.5 text-[10px] text-white truncate">
                      {p.label}: {p.name}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-3 text-xs text-slate-500">
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
              <img src={lightboxUrl} alt={lightboxName} className="w-full max-h-[75vh] object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
