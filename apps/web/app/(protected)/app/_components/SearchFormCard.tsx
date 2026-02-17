import { useMemo, useState } from "react";

import { CheckboxChip } from "@/components/CheckboxChip";
import { truncate } from "@/lib/thrift/format";

import type { Preview, PreviewWithSlot } from "../types";

type IdentifyMode = "off" | "lens";
type FormSectionKey = "upload" | "method" | "details" | "run";
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
  if (step === "details") {
    return (
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="step-tab__icon-svg">
        <path d="M4 3.5H12M4 7H12M4 10.5H8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M10.25 10.6L11.6 12L13.5 9.95" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
          <path d="M5.5 7V5.75C5.5 4.50736 6.50736 3.5 7.75 3.5C8.99264 3.5 10 4.50736 10 5.75V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <rect x="4.25" y="7" width="7" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
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
  const [activeStep, setActiveStep] = useState<FormSectionKey>("upload");
  const runLabel = anyBusy
    ? "Running..."
    : identifyMode === "lens"
      ? "Find Matches"
      : "Start Analysis";
  const safeItemName = typeof itemName === "string" ? itemName : "";
  const safeTextInput = typeof textInput === "string" ? textInput : "";
  const emptyExtraSlot = Math.max(0, files.findIndex((file) => file == null));
  const extrasSelected = extraPreviews.length > 0;
  const hasOptionalDetails =
    Boolean(safeItemName.trim()) || Boolean(safeTextInput.trim()) || extraPreviews.length > 0;
  const hasInputs =
    Boolean(mainImage) ||
    files.some(Boolean) ||
    Boolean(safeItemName.trim()) ||
    Boolean(safeTextInput.trim());
  const orderedSteps: FormSectionKey[] = ["upload", "method", "details", "run"];
  const activeIndex = Math.max(0, orderedSteps.indexOf(activeStep));
  const progressValue = ((activeIndex + 1) / orderedSteps.length) * 100;

  const steps = useMemo<StepDef[]>(
    () => [
      {
        id: "upload",
        title: "Upload your photo",
        badgeText: "Required",
        required: true,
        accent: "#37b8ff",
        status: submitAttempted && !mainImage ? "error" : mainImage ? "complete" : "incomplete",
        disabled: false,
      },
      {
        id: "method",
        title: "Choose a search method",
        badgeText: identifyMode === "lens" ? "Guided AI" : "Automatic",
        required: true,
        accent: "#8b7bff",
        status: identifyMode ? "complete" : "incomplete",
        disabled: !mainImage,
      },
      {
        id: "details",
        title: "Describe the item",
        badgeText: "Optional",
        required: false,
        accent: "#ffaf45",
        status: hasOptionalDetails ? "complete" : "incomplete",
        disabled: !mainImage,
      },
      {
        id: "run",
        title: "Find matches",
        badgeText: runActive || runSold ? "Ready" : "Select type",
        required: true,
        accent: "#35d58e",
        status: activeError || soldError ? "error" : hasRunOnce ? "complete" : "incomplete",
        disabled: !mainImage,
      },
    ],
    [
      activeError,
      hasOptionalDetails,
      hasRunOnce,
      identifyMode,
      mainImage,
      runActive,
      runSold,
      soldError,
      submitAttempted,
    ],
  );

  const activeStepDef = steps.find((step) => step.id === activeStep) ?? steps[0];

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
                </svg>
              </span>
              <div className="text-upload-title font-semibold text-white">Upload Product Photo</div>
              <div className="text-subtitle text-muted">Click to select or drag & drop your image here.</div>
              {submitAttempted && !mainImage ? (
                <div className="text-caption text-red-300">Main Image is required to submit.</div>
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
                  setActiveStep("details");
                }}
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
                onChange={() => {
                  setIdentifyMode("off");
                  setActiveStep("details");
                }}
                disabled={anyBusy}
                className="sr-only"
              />
              <span className="mode-segment-label">Automatic</span>
            </label>
          </div>
        </div>
      );
    }

    if (stepId === "details") {
      if (!mainPreview) {
        return (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-caption text-muted">
            Upload a photo first, then add optional product details.
          </div>
        );
      }
      return (
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
              "bg-white/10 text-white border border-white/10 hover:bg-white/20",
              anyBusy ? "opacity-60 cursor-not-allowed" : "",
            ].join(" ")}
          >
            {collapseForm ? "Edit inputs" : "Collapse"}
          </button>
        )}
      </div>

      <div className="form-body">
        {collapseForm ? (
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
                    const isActive = step.id === activeStep;
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
                const isActive = step.id === activeStep;
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
