"use client";

import { useMemo, useState } from "react";

export default function MyNextFastAPIApp() {
  // each slot can hold one image file
  const [files, setFiles] = useState<(File | null)[]>([null]);
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const canSubmit = useMemo(
    () => files.some((f) => f != null) && !loading,
    [files, loading]
  );

  function addSlot() {
    setFiles((prev) => [...prev, null]);
  }

  function removeSlot(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function setSlotFile(index: number, file: File | null) {
    setFiles((prev) => prev.map((f, i) => (i === index ? file : f)));
  }

  async function onSubmit() {
    const selected = files.filter(Boolean) as File[];
    if (selected.length === 0) return;

    setLoading(true);
    setError("");
    setResult("");

    try {
      const form = new FormData();

      // Send all images. FastAPI will read this as a list if you name it `files`.
      for (const f of selected) {
        form.append("files", f); // same key repeated => list on backend
      }

      const res = await fetch("/api/py/extract-file", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Request failed: ${res.status}${text ? ` - ${text}` : ""}`);
      }

      const data = await res.json();
      setResult(data.raw_result ?? JSON.stringify(data, null, 2));
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-10 flex items-center justify-center">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-lg ring-1 ring-black/5 space-y-5">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">🧠 ThriftBuddy Extract (Test)</h1>
          <p className="text-sm text-slate-600">
            Upload one or more images, send them to FastAPI, and view the extracted JSON.
          </p>
        </div>

        <div className="space-y-3">
          {files.map((file, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setSlotFile(idx, e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-200 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-800 hover:file:bg-slate-300"
              />

              <div className="flex gap-2">
                {idx === files.length - 1 && (
                  <button
                    type="button"
                    onClick={addSlot}
                    disabled={loading}
                    className={[
                      "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium",
                      "bg-slate-200 text-slate-800 hover:bg-slate-300",
                      loading ? "opacity-60 cursor-not-allowed" : "",
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
                    disabled={loading}
                    className={[
                      "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium",
                      "bg-slate-200 text-slate-800 hover:bg-slate-300",
                      loading ? "opacity-60 cursor-not-allowed" : "",
                    ].join(" ")}
                    title="Remove this image"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* optional: tiny summary */}
          <div className="text-xs text-slate-600">
            Selected:{" "}
            {files.filter(Boolean).length} / {files.length} image(s)
          </div>

          <button
            onClick={onSubmit}
            disabled={!canSubmit}
            className={[
              "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium",
              "text-white shadow-sm transition w-full sm:w-auto",
              !canSubmit ? "bg-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800",
            ].join(" ")}
          >
            {loading ? "Extracting..." : "Send"}
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="rounded-xl bg-slate-950 text-slate-100 p-4">
          {result ? (
            <pre className="m-0 whitespace-pre-wrap break-words text-xs leading-relaxed">{result}</pre>
          ) : (
            <div className="text-sm text-slate-300">
              No output yet. Upload image(s) and click <span className="font-medium">Send</span>.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
