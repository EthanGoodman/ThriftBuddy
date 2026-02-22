"use client";

import { useEffect, useRef, useState } from "react";

import { ResultsPanel } from "./_components/ResultsPanel";
import { LensGuidedPanel } from "./_components/LensGuidedPanel";
import { SearchFormCard } from "./_components/SearchFormCard";
import { useImageUploads } from "./_hooks/useImageUploads";
import { useThemePreference } from "./_hooks/useThemePreference";
import { useThriftStream } from "./_hooks/useThriftStream";
import type { LensCandidate, LensCandidatesResponse, Mode } from "./types";

type FlowStep = "inputs" | "identifying" | "pick_match" | "ready_to_analyze" | "analyzing" | "done";
type IdentifyMode = "off" | "lens" | null;
type AppScreen = "inputs" | "guided" | "results";

export default function MyNextFastAPIApp() {
  useThemePreference();

  const {
    mainImage,
    setMainImage,
    files,
    removeSlot,
    setSlotFile,
    clearAllSlots,
    mainPreview,
    extraPreviews,
  } = useImageUploads();

  const [textInput, setTextInput] = useState<string>("");
  const [itemName, setItemName] = useState<string>("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [identifyMode, setIdentifyMode] = useState<IdentifyMode>(null);
  const [step, setStep] = useState<FlowStep>("inputs");
  const [runActive, setRunActive] = useState(true);
  const [runSold, setRunSold] = useState(true);
  const [lensCandidates, setLensCandidates] = useState<LensCandidate[]>([]);
  const [lensLoading, setLensLoading] = useState(false);
  const [lensError, setLensError] = useState("");
  const [lensPage, setLensPage] = useState(0);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [lensTitleDraft, setLensTitleDraft] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [screen, setScreen] = useState<AppScreen>("inputs");

  const safeTitleDraft = typeof titleDraft === "string" ? titleDraft : "";
  const safeLensTitleDraft = typeof lensTitleDraft === "string" ? lensTitleDraft : "";
  const effectiveItemName = identifyMode === "lens" ? safeTitleDraft : itemName;

  const {
    activeData,
    soldData,
    combinedData,
    activeLoading,
    soldLoading,
    anyBusy,
    activeProgress,
    soldProgress,
    overallProgress,
    activeSteps,
    soldSteps,
    combinedSteps,
    activeStepMeta,
    soldStepMeta,
    activeError,
    soldError,
    dismissedActive,
    dismissedSold,
    dismissActive,
    dismissSold,
    runMode,
    resetModeForNewRun,
    clearModeCompletely,
    clearErrors,
    abortAll,
  } = useThriftStream({
    mainImage,
    files,
    textInput,
    itemName: effectiveItemName,
    runActive,
    runSold,
  });

  const abortAllRef = useRef(abortAll);
  const clearModeCompletelyRef = useRef(clearModeCompletely);
  const clearErrorsRef = useRef(clearErrors);

  useEffect(() => {
    abortAllRef.current = abortAll;
    clearModeCompletelyRef.current = clearModeCompletely;
    clearErrorsRef.current = clearErrors;
  }, [abortAll, clearModeCompletely, clearErrors]);

  useEffect(() => {
    if (identifyMode !== "lens") {
      setLensCandidates([]);
      setLensLoading(false);
      setLensError("");
      setLensPage(0);
      setSelectedCandidateId(null);
      setTitleDraft("");
      setLensTitleDraft("");
      setIsEditingTitle(false);
      setStep("inputs");
      setScreen("inputs");
    }
  }, [identifyMode]);

  useEffect(() => {
    setLensPage(0);
  }, [lensCandidates]);

  useEffect(() => {
    abortAllRef.current();
    clearModeCompletelyRef.current("active");
    clearModeCompletelyRef.current("sold");

    setLensCandidates([]);
    setLensLoading(false);
    setLensError("");
    setLensPage(0);
    setSelectedCandidateId(null);
    setTitleDraft("");
    setLensTitleDraft("");
    setIsEditingTitle(false);
    setIdentifyMode(null);
    setItemName("");
    setTextInput("");
    setSubmitAttempted(false);
    setStep("inputs");
    setScreen("inputs");
    clearErrorsRef.current("both");
  }, [mainImage]);

  useEffect(() => {
    if (identifyMode !== "lens") return;
    if (step === "analyzing") return;

    if (lensLoading) {
      setStep("identifying");
      return;
    }

    if (!lensCandidates.length) {
      setStep("inputs");
      return;
    }

    if (!selectedCandidateId) {
      setStep("pick_match");
      return;
    }

    setStep(safeTitleDraft.trim() ? "ready_to_analyze" : "pick_match");
  }, [
    identifyMode,
    lensLoading,
    lensCandidates.length,
    selectedCandidateId,
    safeTitleDraft,
    step,
  ]);

  async function fetchLensCandidates() {
    if (!mainImage || lensLoading) return;

    try {
      setLensLoading(true);
      setLensError("");
      setStep("identifying");
      setScreen("guided");

      const form = new FormData();
      form.append("main_image", mainImage);
      if (textInput.trim()) form.append("text", textInput.trim());

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/extract-file-stream-lens`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Lens request failed: ${res.status}${txt ? ` - ${txt}` : ""}`);
      }

      const payload = (await res.json()) as LensCandidatesResponse;
      const candidates = payload.candidates ?? [];

      setLensCandidates(candidates);
      setLensPage(0);
      setSelectedCandidateId(null);
      setTitleDraft("");
      setLensTitleDraft("");
      setIsEditingTitle(false);
      setStep(candidates.length ? "pick_match" : "inputs");
      setScreen(candidates.length ? "guided" : "inputs");
    } catch (e: unknown) {
      setLensError(e instanceof Error ? e.message : "Failed to load Google Lens results.");
    } finally {
      setLensLoading(false);
    }
  }

  function selectLensCandidate(candidate: LensCandidate) {
    setSelectedCandidateId(candidate.id);
    const nextTitle = typeof candidate.title === "string" ? candidate.title : "";
    setLensTitleDraft(nextTitle);
    setTitleDraft(nextTitle);
    setIsEditingTitle(false);
  }

  function updateLensTitle(value: string) {
    const nextTitle = typeof value === "string" ? value : "";
    setLensTitleDraft(nextTitle);
    setTitleDraft(nextTitle);
  }

  function resetLensState() {
    setLensCandidates([]);
    setLensLoading(false);
    setLensError("");
    setLensPage(0);
    setSelectedCandidateId(null);
    setTitleDraft("");
    setLensTitleDraft("");
    setIsEditingTitle(false);
    setStep("inputs");
  }

  function resetLensSelection() {
    setSelectedCandidateId(null);
    setTitleDraft("");
    setLensTitleDraft("");
    setIsEditingTitle(false);
    setLensError("");
    setStep(lensCandidates.length ? "pick_match" : "inputs");
  }

  function handleEditInputs() {
    setScreen("inputs");
  }

  function handleNewSearch() {
    abortAll();
    clearModeCompletely("active");
    clearModeCompletely("sold");
    clearErrors("both");

    setMainImage(null);
    clearAllSlots();
    setTextInput("");
    setItemName("");
    setSubmitAttempted(false);
    setRunActive(true);
    setRunSold(true);
    setIdentifyMode(null);
    resetLensState();
    setScreen("inputs");
  }

  function handleItemNameChange(value: string) {
    if (identifyMode === "lens") {
      setTitleDraft(typeof value === "string" ? value : "");
      setIsEditingTitle(true);
      return;
    }
    setItemName(value);
  }

  async function runAnalysis(mode: Mode) {
    setScreen("results");

    abortAll();

    if (!runActive) clearModeCompletely("active");
    if (!runSold) clearModeCompletely("sold");

    if (runActive) resetModeForNewRun("active");
    if (runSold) resetModeForNewRun("sold");

    await runMode(mode);
  }




  async function handleRun(overrideTitle?: string) {
    if (!runActive && !runSold) return;

    const mode: Mode = runActive && runSold ? "both" : runActive ? "active" : "sold";
    const baseTitle = identifyMode === "lens" ? safeLensTitleDraft : safeTitleDraft;
    const effectiveTitle =
      typeof overrideTitle === "string"
        ? overrideTitle
        : typeof baseTitle === "string"
          ? baseTitle
          : "";

    if (!identifyMode) {
      setSubmitAttempted(true);
      setScreen("inputs");
      return;
    }

    if (identifyMode === "lens" && !lensCandidates.length && !lensLoading) {
      setLensError("");
      if (!mainImage) {
        setSubmitAttempted(true);
        setLensError("Upload a main image to generate name suggestions.");
        setStep("inputs");
        setScreen("inputs");
        return;
      }
      setScreen("guided");
      await fetchLensCandidates();
      return;
    }

    if (!mainImage) {
      setSubmitAttempted(true);
      setScreen("results");
      await runMode(mode);
      return;
    }

    setSubmitAttempted(true);

    if (identifyMode === "lens") {
      if (!selectedCandidateId && lensCandidates.length) {
        setLensError("");
        setStep("pick_match");
        setScreen("guided");
        return;
      }
      if (!effectiveTitle.trim()) {
        setLensError("Select a match or edit the title before running.");
        setStep("pick_match");
        setScreen("guided");
        return;
      }
      if (overrideTitle != null) setTitleDraft(overrideTitle);
      setLensError("");
      setStep("analyzing");
    }

    await runAnalysis(mode);

    if (identifyMode === "lens") {
      setStep("done");
    }
  }

  function handleLensRunAnalysis() {
    if (!selectedCandidateId) return;
    const chosenTitle = safeLensTitleDraft.trim();
    if (!chosenTitle) return;
    setIsEditingTitle(false);
    setScreen("results");
    handleRun(chosenTitle);
  }

  const uiBusy = anyBusy || lensLoading;
  const showResultsPanel = screen === "results";
  return (
    <div className="bg-animated app-shell">
      <div className="app-container">

        {screen !== "inputs" ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
            <div className="flex flex-wrap items-center gap-3">
              {screen === "results" && identifyMode === "lens" ? (
                <button
                  type="button"
                  onClick={() => setScreen("guided")}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--panel-border)] bg-[var(--panel-quiet)] px-3 py-1.5 text-[11px] font-semibold text-[var(--foreground)] transition hover:bg-[color-mix(in_srgb,var(--panel-quiet)_78%,white)]"
                >
                  <svg
                    aria-hidden="true"
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M10 3L5 8L10 13"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Back to matches
                </button>
              ) : null}
              <div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-muted">Workflow</div>
                <div className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                  {screen === "guided" ? "Guided match selection" : "Market listings"}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleNewSearch}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--panel-border)] bg-[var(--accent)] px-3 py-1.5 text-[11px] font-semibold text-[#f9f1e2] transition hover:bg-[var(--accent-strong)]"
              >
                New search
              </button>
              <button
                type="button"
                onClick={handleEditInputs}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--panel-border)] bg-[var(--panel-quiet)] px-3 py-1.5 text-[11px] font-semibold text-[var(--foreground)] transition hover:bg-[color-mix(in_srgb,var(--panel-quiet)_78%,white)]"
              >
                Edit inputs
              </button>
            </div>
          </div>
        ) : null}

        {screen === "inputs" && (
          <SearchFormCard
            anyBusy={uiBusy}
            submitAttempted={submitAttempted}
            identifyMode={identifyMode}
            setIdentifyMode={setIdentifyMode}
            mainImage={mainImage}
            setMainImage={setMainImage}
            mainPreview={mainPreview}
            files={files}
            removeSlot={removeSlot}
            setSlotFile={setSlotFile}
            clearAllSlots={clearAllSlots}
            extraPreviews={extraPreviews}
            itemName={identifyMode === "lens" ? titleDraft : itemName}
            setItemName={handleItemNameChange}
            textInput={textInput}
            setTextInput={setTextInput}
            runActive={runActive}
            setRunActive={setRunActive}
            runSold={runSold}
            setRunSold={setRunSold}
            onRun={handleRun}
            activeError={activeError}
            soldError={soldError}
          />
        )}

        {identifyMode === "lens" && screen === "guided" && (
          <LensGuidedPanel
            candidates={lensCandidates}
            page={lensPage}
            selectedId={selectedCandidateId}
            selectedTitle={lensTitleDraft}
            selectedCandidate={
              lensCandidates.find((candidate) => candidate.id === selectedCandidateId) ?? null
            }
            isLoading={lensLoading}
            error={lensError}
            step={step}
            isEditingTitle={isEditingTitle}
            mainPreview={mainPreview}
            onSelect={selectLensCandidate}
            onDeselect={resetLensSelection}
            onTitleChange={updateLensTitle}
            onToggleEdit={() => setIsEditingTitle((prev) => !prev)}
            onRunAnalysis={handleLensRunAnalysis}
            onPrev={() => setLensPage((p) => Math.max(0, p - 1))}
            onNext={() =>
              setLensPage((p) => {
                const totalPages = Math.max(1, Math.ceil(lensCandidates.length / 2));
                return Math.min(totalPages - 1, p + 1);
              })
            }
          />
        )}

        {showResultsPanel && (
          <ResultsPanel
            combinedData={combinedData}
            anyBusy={anyBusy}
            runActive={runActive}
            runSold={runSold}
            overallProgress={overallProgress}
            activeProgress={activeProgress}
            soldProgress={soldProgress}
            combinedSteps={combinedSteps}
            activeSteps={activeSteps}
            soldSteps={soldSteps}
            activeStepMeta={activeStepMeta}
            soldStepMeta={soldStepMeta}
            activeLoading={activeLoading}
            soldLoading={soldLoading}
            activeData={activeData}
            soldData={soldData}
            activeError={activeError}
            soldError={soldError}
            dismissedActive={dismissedActive}
            dismissedSold={dismissedSold}
            onDismissActive={dismissActive}
            onDismissSold={dismissSold}
          />
        )}
      </div>

    </div>
  );
}
