import { useMemo, useState } from "react";

import { CheckboxChip } from "@/components/CheckboxChip";
import { truncate } from "@/lib/thrift/format";

import type { Preview, PreviewWithSlot } from "../types";

type IdentifyMode = "off" | "lens" | null;
type FormSectionKey = "upload" | "method" | "run";
type StepStatus = "incomplete" | "complete" | "error";

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

type StepDef = {
  id: FormSectionKey;
  title: string;
  badgeText: string;
  required: boolean;
  accent: string;
  status: StepStatus;
  disabled: boolean;
};

function StepIcon({ step }: { step: FormSectionKey }) {
  if (step === "upload") {
    return (
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="step-tab__icon-svg">
        <path d="M8 10V4M8 4L5.5 6.5M8 4L10.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12.5 10.5V11.25C12.5 12.2165 11.7165 13 10.75 13H5.25C4.2835 13 3.5 12.2165 3.5 11.25V10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (step === "method") {
    return (
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="step-tab__icon-svg">
        <circle cx="8" cy="8" r="4.75" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6.7 8.35L7.6 9.25L9.65 7.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="step-tab__icon-svg">
      <path d="M3.75 3.75H12.25V12.25H3.75V3.75Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 8L7.5 9.5L10.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StepStateIndicator({ status, disabled }: { status: StepStatus; disabled: boolean }) {
  if (disabled) {
    return (
      <span className="step-tab__state step-tab__state--disabled" aria-label="Locked">
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M6.2 7V5.8C6.2 4.81 7.01 4 8 4C8.99 4 9.8 4.81 9.8 5.8V7"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect
            x="4.5"
            y="7"
            width="7"
            height="5"
            rx="1.2"
            stroke="currentColor"
            strokeWidth="1.4"
          />
        </svg>
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="step-tab__state step-tab__state--error" aria-label="Needs attention">
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 5V8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="8" cy="11.1" r="0.7" fill="currentColor" />
          <path d="M7.1 2.9L2.95 10.1C2.53 10.83 3.06 11.75 3.9 11.75H12.1C12.94 11.75 13.47 10.83 13.05 10.1L8.9 2.9C8.48 2.17 7.52 2.17 7.1 2.9Z" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </span>
    );
  }
  if (status === "complete") {
    return (
      <span className="step-tab__state step-tab__state--complete" aria-label="Complete">
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4.2 8.2L6.7 10.7L11.8 5.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  return <span className="step-tab__state step-tab__state--incomplete" aria-label="Incomplete" />;
}

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
  const methodInfo: Record<"lens" | "off", { headline: string; bullets: [string, string]; bestFor: string }> = {
    lens: {
      headline: "Best accuracy - you confirm the match first.",
      bullets: ["Pick the closest visual result", "Refine the title for better marketplace search"],
      bestFor: "Best for brand/model items",
    },
    off: {
      headline: "Lowest effort - search starts from your image.",
      bullets: ["No match-picking step", "Optional text can improve results"],
      bestFor: "Best for common items",
    },
  };
  const [activeStep, setActiveStep] = useState<FormSectionKey>("upload");
  const [useGeneratedTitle, setUseGeneratedTitle] = useState(true);
  const [advancedHelpOpen, setAdvancedHelpOpen] = useState(false);
  const runLabel = anyBusy
    ? "Running..."
    : !identifyMode
      ? "Choose search method"
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
  const steps = useMemo<StepDef[]>(() => {
    const defs: StepDef[] = [
      {
        id: "upload",
        title: "Upload your photo",
        badgeText: "Required",
        required: true,
        accent: "#9b7556",
        status: submitAttempted && !mainImage ? "error" : mainImage ? "complete" : "incomplete",
        disabled: false,
      },
      {
        id: "method",
        title: "Choose a search method",
        badgeText: identifyMode === "lens" ? "Guided AI" : identifyMode === "off" ? "Automatic" : "Choose one",
        required: true,
        accent: "#8c6f58",
        status: submitAttempted && !identifyMode ? "error" : identifyMode ? "complete" : "incomplete",
        disabled: !mainImage,
      },
    ];

    defs.push({
      id: "run",
      title: "Find matches",
      badgeText: runActive || runSold ? "Ready" : "Select type",
      required: true,
      accent: "#7c8c63",
      status: activeError || soldError ? "error" : hasRunOnce ? "complete" : "incomplete",
      disabled: !mainImage || !identifyMode,
    });

    return defs;
  }, [
    submitAttempted,
    mainImage,
    identifyMode,
    runActive,
    runSold,
    activeError,
    soldError,
    hasRunOnce,
  ]);

  const orderedSteps: FormSectionKey[] = steps.map((s) => s.id);
  const activeStepId: FormSectionKey = orderedSteps.includes(activeStep)
    ? activeStep
    : orderedSteps[0] ?? "upload";
  const activeIndex = Math.max(0, orderedSteps.indexOf(activeStepId));
  const progressValue = ((activeIndex + 1) / orderedSteps.length) * 100;
  const activeStepDef = steps.find((step) => step.id === activeStepId) ?? steps[0];

  function selectStep(step: StepDef) {
    if (step.disabled) return;
    setActiveStep(step.id);
  }

  function renderStepBody(stepId: FormSectionKey) {
    if (stepId === "upload") {
      return (
        <div className="upload-panel">
          {!mainPreview ? (
            <label
              htmlFor="main-image-upload"
              className={[
                "upload-drop upload-dropzone text-center transition",
                "hover:outline-[var(--accent)]/45 hover:shadow-[0_0_48px_rgba(111,68,45,0.18)]",
                anyBusy ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
              ].join(" ")}
            >
              <span className="upload-icon-glow upload-icon-shell text-[var(--foreground)]">
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
                </svg>
              </span>
              <div className="text-upload-title font-semibold text-[var(--foreground)]">Upload Product Photo</div>
              <div className="text-subtitle text-[var(--muted)]">Click to select or drag & drop your image here.</div>
              {submitAttempted && !mainImage ? (
                <div className="text-caption text-[var(--danger)]">Main Image is required to submit.</div>
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
                className="absolute right-4 top-4 rounded-full border border-[rgba(118,92,72,0.42)] bg-[rgba(235,217,191,0.92)] px-4 py-1.5 text-caption font-semibold text-[var(--foreground)] shadow-sm transition hover:bg-[rgba(241,227,205,0.96)]"
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
            onChange={(e) => {
              const nextFile = e.target.files?.[0] ?? null;
              setMainImage(nextFile);
              if (nextFile) setActiveStep("method");
            }}
            className="hidden"
            disabled={anyBusy}
          />
        </div>
      );
    }

    if (stepId === "method") {
      return (
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
                onChange={() => {
                  setIdentifyMode("lens");
                  setUseGeneratedTitle(true);
                  setAdvancedHelpOpen(false);
                  setActiveStep("run");
                }}
                disabled={anyBusy}
                className="sr-only"
              />
              <span className="mode-segment-label">Guided AI</span>
              <span
                className="mode-segment-badge"
                title="Recommended for best accuracy and fewer wrong listings."
                aria-label="Recommended for best accuracy and fewer wrong listings."
              >
                Recommended
              </span>
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
                onChange={() => {
                  setIdentifyMode("off");
                  setUseGeneratedTitle(true);
                  setAdvancedHelpOpen(false);
                  setItemName("");
                  setActiveStep("method");
                }}
                disabled={anyBusy}
                className="sr-only"
              />
              <span className="mode-segment-label">Automatic</span>
            </label>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <div className="rounded-xl border border-[rgba(129,101,78,0.42)] bg-[var(--panel-quiet)]/65 px-3 py-2 ring-0 shadow-none">
              <div className="text-[12px] font-semibold text-[var(--foreground)] leading-relaxed">
                {methodInfo.lens.headline}
              </div>
              <ul className="mt-1 space-y-0.5 text-[11px] text-[var(--muted)] leading-relaxed">
                {methodInfo.lens.bullets.map((bullet) => (
                  <li key={bullet}>- {bullet}</li>
                ))}
              </ul>
              <div className="mt-1 text-[11px] text-[var(--muted)]">{methodInfo.lens.bestFor}</div>
            </div>
            <div className="rounded-xl border border-[rgba(129,101,78,0.42)] bg-[var(--panel-quiet)]/65 px-3 py-2 ring-0 shadow-none">
              <div className="text-[12px] font-semibold text-[var(--foreground)] leading-relaxed">
                {methodInfo.off.headline}
              </div>
              <ul className="mt-1 space-y-0.5 text-[11px] text-[var(--muted)] leading-relaxed">
                {methodInfo.off.bullets.map((bullet) => (
                  <li key={bullet}>- {bullet}</li>
                ))}
              </ul>
              <div className="mt-1 text-[11px] text-[var(--muted)]">{methodInfo.off.bestFor}</div>
            </div>
          </div>

          {identifyMode === "off" ? (
            <div className="mt-4 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-quiet)] p-4">
              <div className="text-body font-semibold text-[var(--foreground)]">Automatic search</div>
              <div className="mt-1 text-caption text-[var(--muted)]">
                We&apos;ll generate a search title from your image.
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label
                  className={[
                    "rounded-lg border px-3 py-2 text-body transition",
                    useGeneratedTitle
                      ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--panel-quiet)_72%,white)] text-[var(--foreground)]"
                      : "border-[var(--panel-border)] bg-transparent text-[var(--muted)] hover:text-[var(--foreground)]",
                    anyBusy ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="automatic-title-mode"
                    checked={useGeneratedTitle}
                    onChange={() => {
                      setUseGeneratedTitle(true);
                      setItemName("");
                    }}
                    disabled={anyBusy}
                    className="sr-only"
                  />
                  <span className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2">
                      <span aria-hidden="true">{useGeneratedTitle ? "●" : "○"}</span>
                      <span>Generate title automatically</span>
                    </span>
                    <span className="rounded-full border border-[var(--panel-border)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
                      Default
                    </span>
                  </span>
                </label>

                <label
                  className={[
                    "rounded-lg border px-3 py-2 text-body transition",
                    !useGeneratedTitle
                      ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--panel-quiet)_72%,white)] text-[var(--foreground)]"
                      : "border-[var(--panel-border)] bg-transparent text-[var(--muted)] hover:text-[var(--foreground)]",
                    anyBusy ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="automatic-title-mode"
                    checked={!useGeneratedTitle}
                    onChange={() => setUseGeneratedTitle(false)}
                    disabled={anyBusy}
                    className="sr-only"
                  />
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden="true">{!useGeneratedTitle ? "●" : "○"}</span>
                    <span>Enter title myself</span>
                  </span>
                </label>
              </div>

              {useGeneratedTitle ? (
                <div className="mt-3 text-caption text-[var(--muted)]">
                  We&apos;ll create a search title from your image automatically.
                </div>
              ) : null}

              {!useGeneratedTitle ? (
                <div className="mt-3 space-y-2">
                  <label className="text-body font-semibold text-[var(--foreground)]">Enter your search title</label>
                  <div className="text-caption text-[var(--muted)]">
                    Skips image-based title generation.
                  </div>
                  <input
                    type="text"
                    value={safeItemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="e.g., Coach Edie 36855 Pebble Leather"
                    disabled={anyBusy}
                    className={[
                      "w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel-quiet)] px-4 py-3 text-body text-[var(--foreground)]",
                      "placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/45",
                    ].join(" ")}
                  />
                  <div className="text-caption text-[var(--muted)]"></div>
                </div>
              ) : null}

              <div className="mt-4 rounded-lg border border-[var(--panel-border)] bg-[color-mix(in_srgb,var(--panel-quiet)_84%,white)]">
                <button
                  type="button"
                  onClick={() => setAdvancedHelpOpen((v) => !v)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left"
                  disabled={anyBusy}
                >
                  <span className="text-body font-semibold text-[var(--foreground)]">Advanced help (optional)</span>
                  <span className="text-caption text-[var(--muted)]">{advancedHelpOpen ? "Hide" : "Show"}</span>
                </button>
                {advancedHelpOpen ? (
                  <div className="space-y-4 border-t border-[var(--panel-border)] px-3 py-3">
                    <div className="space-y-2">
                      <div className="text-body font-semibold text-[var(--foreground)]">Add extra photos</div>
                      <div className="text-caption text-[var(--muted)]">
                        Add angles/labels to help identify variants.
                      </div>
                      <div className="flex items-center gap-3">
                        <label
                          htmlFor="extra-image-upload"
                          className={[
                            "inline-flex items-center gap-2 rounded-full border border-[var(--panel-border)] px-3 py-1.5 text-caption font-semibold",
                            "bg-[var(--panel-quiet)] text-[var(--foreground)] transition hover:bg-[color-mix(in_srgb,var(--panel-quiet)_78%,white)]",
                            anyBusy ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
                          ].join(" ")}
                        >
                          + Add photos
                        </label>
                        {extrasSelected ? (
                          <span className="text-caption text-[var(--muted)]">{extraPreviews.length} added</span>
                        ) : (
                          <span className="text-caption text-[var(--muted)]">Angles help with variants.</span>
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
                                className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] text-caption text-[#f9f1e2] group-hover:flex"
                              >
                                x
                              </button>
                            </div>
                          ))}
                          {extraPreviews.length > 2 ? (
                            <button
                              type="button"
                              onClick={clearAllSlots}
                              className="text-caption text-[var(--muted)] underline"
                            >
                              Clear all
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <div className="text-body font-semibold text-[var(--foreground)]">Add details</div>
                      <div className="text-caption text-[var(--muted)]">
                        Mention color, material, size, markings, or damage.
                      </div>
                      <textarea
                        value={safeTextInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        placeholder="e.g., Black pebbled leather, size medium, minor corner wear"
                        rows={3}
                        disabled={anyBusy}
                        className={[
                          "w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel-quiet)] px-4 py-3 text-body text-[var(--foreground)]",
                          "placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/45",
                        ].join(" ")}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {submitAttempted && !identifyMode ? (
            <div className="mt-3 text-caption text-[var(--danger)]">
              Choose Guided AI or Automatic to continue.
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <div className="mode-panel scrollbar-clean">
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
            anyBusy || (!runActive && !runSold) || !identifyMode
              ? "bg-white/10 text-[var(--muted)] cursor-not-allowed"
              : "bg-[var(--accent)] text-[#f9f1e2] hover:bg-[var(--accent-strong)] shadow-lg shadow-[rgba(111,68,45,0.25)]",
          ].join(" ")}
        >
          {runLabel}
        </button>
        {activeError || soldError ? (
          <div className="rounded-lg border border-[var(--danger)]/35 bg-[var(--danger)]/12 px-4 py-3 text-body text-[var(--danger)]">
            {activeError || soldError}
          </div>
        ) : null}
      </div>
    );
  }

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
              "bg-[var(--panel-quiet)] text-[var(--foreground)] border border-[var(--panel-border)] hover:bg-[color-mix(in_srgb,var(--panel-quiet)_78%,white)]",
              anyBusy ? "opacity-60 cursor-not-allowed" : "",
            ].join(" ")}
          >
            {collapseForm ? "Edit inputs" : "Collapse"}
          </button>
        )}
      </div>

      <div className="form-body">
        {collapseForm ? (
          <div className="rounded-2xl panel-strong panel-compact text-[var(--muted)]">
            <div className="font-semibold text-[var(--foreground)] text-body">Current search</div>
            <div className="flex flex-wrap gap-3 text-caption">
              <span>Main: {mainImage ? mainImage.name : "None"}</span>
              <span>Extras: {(files.filter(Boolean) as File[]).length}</span>
            </div>
            {safeItemName.trim() || safeTextInput.trim() ? (
              <div className="text-caption text-[var(--muted)]">
                <div className="font-medium text-[var(--foreground)] text-body">
                  {safeItemName.trim() ? truncate(safeItemName, 40) : "No item name"}
                </div>
                {safeTextInput.trim() && <div className="text-[var(--muted)]">{safeTextInput}</div>}
              </div>
            ) : (
              <div className="text-caption text-[var(--muted)]">No optional text provided.</div>
            )}
          </div>
        ) : (
          <>
            <div className="step-tabs-desktop">
              <aside className="step-tabs__rail">
                <div className="step-tabs__progress">
                  <div className="step-tabs__progress-text">
                    Step {activeIndex + 1} of {orderedSteps.length}
                  </div>
                  <div className="step-tabs__progress-track" aria-hidden="true">
                    <div
                      className="step-tabs__progress-fill"
                      style={
                        {
                          width: `${progressValue}%`,
                          "--step-accent": activeStepDef.accent,
                        } as React.CSSProperties
                      }
                    />
                  </div>
                </div>

                <div className="step-tabs__list">
                  {steps.map((step, index) => {
                    const isActive = step.id === activeStepId;
                    return (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => selectStep(step)}
                        disabled={step.disabled}
                        className={[
                          "step-tab",
                          isActive ? "is-active" : "",
                          step.status === "complete" ? "is-complete" : "",
                          step.status === "error" ? "is-error" : "",
                          step.disabled ? "is-disabled" : "",
                        ].join(" ")}
                        style={{ "--step-accent": step.accent } as React.CSSProperties}
                      >
                        <span className="step-tab__accent" aria-hidden="true" />
                        <span className="step-tab__main">
                          <span className="step-tab__left">
                            <span className="step-tab__index" aria-hidden="true">
                              {index + 1}
                            </span>
                            <span className="step-tab__icon">
                              <StepIcon step={step.id} />
                            </span>
                            <span className="step-tab__text">
                              <span className="step-tab__kicker">Step {index + 1}</span>
                              <span className="step-tab__title">{step.title}</span>
                            </span>
                          </span>
                          <span className="step-tab__right">
                            <span className={["step-tab__badge", isActive ? "is-active" : ""].join(" ")}>
                              {step.badgeText}
                              {step.required && step.status !== "complete" ? (
                                <span className="step-tab__badge-dot" aria-hidden="true" />
                              ) : null}
                            </span>
                            <StepStateIndicator status={step.status} disabled={step.disabled} />
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </aside>

              <section
                className="step-tabs__panel"
                style={{ "--step-accent": activeStepDef.accent } as React.CSSProperties}
              >
                <div className="step-tabs__panel-header">
                  <div className="step-tabs__panel-title-wrap">
                    <span className="step-tabs__panel-icon">
                      <StepIcon step={activeStepDef.id} />
                    </span>
                    <div>
                      <div className="step-tabs__panel-kicker">Focused workspace</div>
                      <div className="step-tabs__panel-title">{activeStepDef.title}</div>
                    </div>
                  </div>
                  <span className="step-tab__badge is-active">
                    {activeStepDef.badgeText}
                    {activeStepDef.required && activeStepDef.status !== "complete" ? (
                      <span className="step-tab__badge-dot" aria-hidden="true" />
                    ) : null}
                  </span>
                </div>
                <div className="step-tabs__panel-body">{renderStepBody(activeStepDef.id)}</div>
              </section>
            </div>

            <div className="step-tabs-mobile">
              <div className="step-tabs__progress">
                <div className="step-tabs__progress-text">
                  Step {activeIndex + 1} of {orderedSteps.length}
                </div>
                <div className="step-tabs__progress-track" aria-hidden="true">
                  <div
                    className="step-tabs__progress-fill"
                    style={
                      {
                        width: `${progressValue}%`,
                        "--step-accent": activeStepDef.accent,
                      } as React.CSSProperties
                    }
                  />
                </div>
              </div>

              {steps.map((step, index) => {
                const isActive = step.id === activeStepId;
                return (
                  <section
                    key={step.id}
                    className={[
                      "step-tabs-mobile__item",
                      isActive ? "is-active" : "",
                      step.status === "error" ? "is-error" : "",
                    ].join(" ")}
                    style={{ "--step-accent": step.accent } as React.CSSProperties}
                  >
                    <button
                      type="button"
                      onClick={() => selectStep(step)}
                      disabled={step.disabled}
                      className={[
                        "step-tabs-mobile__tab",
                        isActive ? "is-active" : "",
                        step.disabled ? "is-disabled" : "",
                      ].join(" ")}
                    >
                      <span className="step-tab__accent" aria-hidden="true" />
                      <span className="step-tab__main">
                        <span className="step-tab__left">
                          <span className="step-tab__index" aria-hidden="true">
                            {index + 1}
                          </span>
                          <span className="step-tab__icon">
                            <StepIcon step={step.id} />
                          </span>
                          <span className="step-tab__text">
                            <span className="step-tab__kicker">Step {index + 1}</span>
                            <span className="step-tab__title">{step.title}</span>
                          </span>
                        </span>
                        <span className="step-tab__right">
                          <span className={["step-tab__badge", isActive ? "is-active" : ""].join(" ")}>
                            {step.badgeText}
                            {step.required && step.status !== "complete" ? (
                              <span className="step-tab__badge-dot" aria-hidden="true" />
                            ) : null}
                          </span>
                          <StepStateIndicator status={step.status} disabled={step.disabled} />
                        </span>
                      </span>
                    </button>

                    {isActive ? <div className="step-tabs-mobile__panel">{renderStepBody(step.id)}</div> : null}
                  </section>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

