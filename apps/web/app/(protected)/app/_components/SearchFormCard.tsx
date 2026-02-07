import { CheckboxChip } from "@/components/CheckboxChip";
import { truncate } from "@/lib/thrift/format";

import type { Preview, PreviewWithSlot } from "../types";

type IdentifyMode = "off" | "lens";

type SearchFormCardProps = {
  hasRunOnce: boolean;
  collapseForm: boolean;
  setCollapseForm: (value: boolean) => void;
  anyBusy: boolean;
  submitAttempted: boolean;
  identifyMode: IdentifyMode;
  setIdentifyMode: (value: IdentifyMode) => void;
  mainImage: File | null;
  setMainImage: (file: File | null) => void;
  mainPreview?: Preview;
  files: (File | null)[];
  removeSlot: (index: number) => void;
  setSlotFile: (index: number, file: File | null) => void;
  clearAllSlots: () => void;
  extraPreviews: PreviewWithSlot[];
  itemName: string;
  setItemName: (value: string) => void;
  textInput: string;
  setTextInput: (value: string) => void;
  runActive: boolean;
  setRunActive: (value: boolean) => void;
  runSold: boolean;
  setRunSold: (value: boolean) => void;
  onRun: () => void | Promise<void>;
  activeError: string;
  soldError: string;
};

export function SearchFormCard({
  hasRunOnce,
  collapseForm,
  setCollapseForm,
  anyBusy,
  submitAttempted,
  identifyMode,
  setIdentifyMode,
  mainImage,
  setMainImage,
  mainPreview,
  files,
  removeSlot,
  setSlotFile,
  clearAllSlots,
  extraPreviews,
  itemName,
  setItemName,
  textInput,
  setTextInput,
  runActive,
  setRunActive,
  runSold,
  setRunSold,
  onRun,
  activeError,
  soldError,
}: SearchFormCardProps) {
  const runLabel = anyBusy
    ? "Running..."
    : identifyMode === "lens"
      ? "Find Matches"
      : "Start Analysis";
  const safeItemName = typeof itemName === "string" ? itemName : "";
  const safeTextInput = typeof textInput === "string" ? textInput : "";
  const emptyExtraSlot = Math.max(0, files.findIndex((file) => file == null));
  const extrasSelected = extraPreviews.length > 0;
  const hasInputs =
    Boolean(mainImage) ||
    files.some(Boolean) ||
    Boolean(safeItemName.trim()) ||
    Boolean(safeTextInput.trim());

  return (
    <div className="rounded-[28px] glass-surface search-form-card">
      <div className="form-header">
        <div />
        {(hasRunOnce || (identifyMode === "lens" && hasInputs)) && (
          <button
            type="button"
            onClick={() => setCollapseForm(!collapseForm)}
            disabled={anyBusy}
            className={[
              "rounded-full px-4 py-1.5 text-caption font-semibold transition",
              "bg-white/10 text-white border border-white/10 hover:bg-white/20",
              anyBusy ? "opacity-60 cursor-not-allowed" : "",
            ].join(" ")}
          >
            {collapseForm ? "Edit inputs" : "Collapse"}
          </button>
        )}
      </div>

      <div className="form-body">
        {collapseForm && (
          <div className="rounded-2xl panel-strong panel-compact text-muted">
            <div className="font-semibold text-white text-body">Current search</div>
            <div className="flex flex-wrap gap-3 text-caption">
              <span>Main: {mainImage ? mainImage.name : "None"}</span>
              <span>Extras: {(files.filter(Boolean) as File[]).length}</span>
            </div>
            {safeItemName.trim() || safeTextInput.trim() ? (
              <div className="text-caption text-muted">
                <div className="font-medium text-white text-body">
                  {safeItemName.trim() ? truncate(safeItemName, 40) : "No item name"}
                </div>
                {safeTextInput.trim() && <div className="text-muted">{safeTextInput}</div>}
              </div>
            ) : (
              <div className="text-caption text-muted">No optional text provided.</div>
            )}
          </div>
        )}

        {!collapseForm && (
          <div className="form-stack">
            <div className="upload-panel">
              {!mainPreview ? (
                <label
                  htmlFor="main-image-upload"
                  className={[
                    "upload-drop upload-dropzone text-center transition",
                    "hover:outline-blue-300/50 hover:shadow-[0_0_60px_rgba(99,102,241,0.2)]",
                    anyBusy ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                >
                  <span className="upload-icon-glow upload-icon-shell text-blue-100">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                      className="upload-icon opacity-85 drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]"
                    >
                      <path
                        d="M12 16V8M12 8L8 12M12 8L16 12"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M20 16.5C20 18.9853 17.9853 21 15.5 21H8.5C6.01472 21 4 18.9853 4 16.5V7.5C4 5.01472 6.01472 3 8.5 3H15.5C17.9853 3 20 5.01472 20 7.5V16.5Z"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        opacity="0.4"
                      />
                    </svg>
                  </span>
                  <div className="text-upload-title font-semibold text-white">
                    Upload Product Photo
                  </div>
                  <div className="text-subtitle text-muted">
                    Click to select or drag & drop your image here.
                  </div>
                  {submitAttempted && !mainImage ? (
                    <div className="text-caption text-red-300">
                      Main Image is required to submit.
                    </div>
                  ) : null}
                </label>
              ) : (
                <div className="upload-preview">
                  <img
                    src={mainPreview.url}
                    alt={mainPreview.name}
                    className="upload-preview-image object-contain"
                    style={{ objectFit: "contain" }}
                  />
                  <label
                    htmlFor="main-image-upload"
                    className="absolute right-4 top-4 rounded-full bg-slate-900/80 px-4 py-1.5 text-caption font-semibold text-white shadow-sm transition hover:bg-slate-900"
                  >
                    Change Photo
                  </label>
                </div>
              )}

              <input
                id="main-image-upload"
                type="file"
                accept="image/*"
                onClick={(e) => {
                  (e.currentTarget as HTMLInputElement).value = "";
                }}
                onChange={(e) => setMainImage(e.target.files?.[0] ?? null)}
                className="hidden"
                disabled={anyBusy}
              />
            </div>

            <div className="mode-segmented-panel">
              <div className="mode-segmented">
                <label
                  className={[
                    "mode-segment transition",
                    identifyMode === "lens" ? "mode-segment-active" : "mode-segment-inactive",
                    anyBusy ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="analysis-mode"
                    value="guided"
                    checked={identifyMode === "lens"}
                    onChange={() => setIdentifyMode("lens")}
                    disabled={anyBusy}
                    className="sr-only"
                  />
                  <span className="mode-segment-label">Guided AI</span>
                  <span className="mode-segment-badge">Recommended</span>
                </label>

                <label
                  className={[
                    "mode-segment transition",
                    identifyMode === "off" ? "mode-segment-active" : "mode-segment-inactive",
                    anyBusy ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="analysis-mode"
                    value="automatic"
                    checked={identifyMode === "off"}
                    onChange={() => setIdentifyMode("off")}
                    disabled={anyBusy}
                    className="sr-only"
                  />
                  <span className="mode-segment-label">Automatic</span>
                </label>
              </div>
            </div>

            {mainPreview ? (
              <div className="form-stack">
                <div className="section-label text-muted">Optional details</div>

                <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                  <div className="space-y-3">
                    <label className="text-body font-semibold text-white">
                      Product name <span className="text-muted">(optional, improves accuracy)</span>
                    </label>
                    <input
                      type="text"
                      value={safeItemName}
                      onChange={(e) => setItemName(e.target.value)}
                      placeholder="e.g., Nike Air Jordan 1 Retro High"
                      disabled={anyBusy}
                      className={[
                        "w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-body text-white",
                        "placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                      ].join(" ")}
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-body font-semibold text-white">
                      Extra photos <span className="text-muted">(optional)</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <label
                        htmlFor="extra-image-upload"
                        className={[
                          "inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-caption font-semibold",
                          "bg-white/5 text-white transition hover:bg-white/10",
                          anyBusy ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
                        ].join(" ")}
                      >
                        + Add photos
                      </label>
                      {extrasSelected ? (
                        <span className="text-caption text-muted">{extraPreviews.length} added</span>
                      ) : (
                        <span className="text-caption text-muted">Angles help with variants.</span>
                      )}
                      <input
                        id="extra-image-upload"
                        type="file"
                        accept="image/*"
                        onClick={(e) => {
                          (e.currentTarget as HTMLInputElement).value = "";
                        }}
                        onChange={(e) => setSlotFile(emptyExtraSlot, e.target.files?.[0] ?? null)}
                        className="hidden"
                        disabled={anyBusy}
                      />
                    </div>
                    {extrasSelected ? (
                      <div className="flex flex-wrap gap-2">
                        {extraPreviews.map((p) => (
                          <div
                            key={p.key}
                            className="group relative h-12 w-12 overflow-hidden rounded-lg border border-white/10"
                          >
                            <img src={p.url} alt={p.name} className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removeSlot(p.slotIndex)}
                              className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-slate-900/80 text-caption text-white group-hover:flex"
                            >
                              x
                            </button>
                          </div>
                        ))}
                        {extraPreviews.length > 2 ? (
                          <button
                            type="button"
                            onClick={clearAllSlots}
                            className="text-caption text-muted underline"
                          >
                            Clear all
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-body font-semibold text-white">
                    Details <span className="text-muted">(optional)</span>
                  </label>
                  <textarea
                    value={safeTextInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder={
                      identifyMode === "lens"
                        ? "e.g., brand, model, or distinctive marks"
                        : "e.g., Star Wars DVD set with four discs"
                    }
                    rows={3}
                    disabled={anyBusy}
                    className={[
                      "w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-body text-white",
                      "placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                    ].join(" ")}
                  />
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="mode-panel scrollbar-clean mt-6">
        <div className="flex flex-wrap items-center gap-3">
          <CheckboxChip checked={runActive} onChange={setRunActive} disabled={anyBusy} label="Active listings" />
          <CheckboxChip checked={runSold} onChange={setRunSold} disabled={anyBusy} label="Sold listings" />
        </div>

        <div className="mode-divider" />

        <button
          type="button"
          disabled={anyBusy || (!runActive && !runSold)}
          onClick={onRun}
          className={[
            "w-full rounded-xl px-4 py-3 text-body font-semibold transition",
            anyBusy || (!runActive && !runSold)
              ? "bg-white/10 text-muted cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20",
          ].join(" ")}
        >
          {runLabel}
        </button>
        {activeError || soldError ? (
          <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-body text-red-200">
            {activeError || soldError}
          </div>
        ) : null}
      </div>
    </div>
  );
}
