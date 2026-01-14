"use client";

import { useEffect, useMemo, useState } from "react";

type Preview = {
  key: string;          // unique key for React
  url: string;
  name: string;
  label: string;        // "Main" or "Extra #"
};

export default function MyNextFastAPIApp() {
  // REQUIRED main image
  const [mainImage, setMainImage] = useState<File | null>(null);

  // OPTIONAL extra images (slots)
  const [files, setFiles] = useState<(File | null)[]>([null]);

  const [textInput, setTextInput] = useState<string>("");
  type Mode = "active" | "sold";

  const [activeResult, setActiveResult] = useState<string>("");
  const [soldResult, setSoldResult] = useState<string>("");

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

    // If you want to PREVENT running both at once, uncomment this:
    // if (anyBusy) return;

    // set state per mode
    if (mode === "active") {
      setActiveLoading(true);
      setActiveError("");
      setActiveResult("");
    } else {
      setSoldLoading(true);
      setSoldError("");
      setSoldResult("");
    }

    const controller = new AbortController();

    try {
      const form = new FormData();
      form.append("main_image", mainImage);

      const prompt = textInput.trim();
      if (prompt.length > 0) form.append("text", prompt);

      const extras = files.filter(Boolean) as File[];
      for (const f of extras) form.append("files", f);

      // IMPORTANT: tell backend which mode
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

      const data = await res.json();
      const payload = data.raw_result ?? JSON.stringify(data, null, 2);

      if (mode === "active") setActiveResult(payload);
      else setSoldResult(payload);
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
    // Running both concurrently is heavier (two backend jobs at once).
    // This WILL increase timeouts / CPU load risk.
    await Promise.allSettled([runMode("active"), runMode("sold")]);
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

              {!mainImage && (
                <div className="text-xs text-red-700">
                  Main Image is required to submit.
                </div>
              )}
            </div>

            {/* Optional text input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Optional text (extra context / prompt)
              </label>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="e.g., 'Identify the exact model if possible' or 'This is from the 90s'"
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

            {/* OPTIONAL extra file slots */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-800">
                Extra Images (optional)
                <div className="text-xs text-slate-500 font-normal">
                  Tags, close-ups, flaws, alternate angles.
                </div>
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
                  disabled={!mainImage || activeBusy || soldBusy /* disable if you want to prevent overlap */}
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
                  disabled={!mainImage || soldBusy || activeBusy /* disable if you want to prevent overlap */}
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* ACTIVE */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">Active Listings Output</h3>
                  <span className="text-xs text-slate-500">{activeLoading ? "running…" : ""}</span>
                </div>

                {activeError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {activeError}
                  </div>
                )}

                <div className="rounded-xl bg-slate-950 text-slate-100 p-4 max-w-full overflow-x-auto">
                  {activeResult ? (
                    <pre className="m-0 whitespace-pre-wrap break-words break-all text-xs leading-relaxed">
                      {activeResult}
                    </pre>
                  ) : (
                    <div className="text-sm text-slate-300">
                      Click <span className="font-medium">Get Active Listings</span> to run the active query.
                    </div>
                  )}
                </div>
              </div>

              {/* SOLD */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">Sold Listings Output</h3>
                  <span className="text-xs text-slate-500">{soldLoading ? "running…" : ""}</span>
                </div>

                {soldError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {soldError}
                  </div>
                )}

                <div className="rounded-xl bg-slate-950 text-slate-100 p-4 max-w-full overflow-x-auto">
                  {soldResult ? (
                    <pre className="m-0 whitespace-pre-wrap break-words break-all text-xs leading-relaxed">
                      {soldResult}
                    </pre>
                  ) : (
                    <div className="text-sm text-slate-300">
                      Click <span className="font-medium">Get Sold Listings</span> to run the sold query.
                    </div>
                  )}
                </div>
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
