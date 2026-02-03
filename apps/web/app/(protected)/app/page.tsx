"use client";

import { useEffect, useState } from "react";

import { ImageSidebar } from "./_components/ImageSidebar";
import { LightboxModal } from "./_components/LightboxModal";
import { ResultsPanel } from "./_components/ResultsPanel";
import { SearchFormCard } from "./_components/SearchFormCard";
import { useImageUploads } from "./_hooks/useImageUploads";
import { useThemePreference } from "./_hooks/useThemePreference";
import { useThriftStream } from "./_hooks/useThriftStream";
import type { Mode } from "./types";

export default function MyNextFastAPIApp() {
  useThemePreference();

  const {
    mainImage,
    setMainImage,
    files,
    addSlot,
    removeSlot,
    setSlotFile,
    clearAllSlots,
    removeMainSelected,
    removeExtraSelectedBySlotIndex,
    mainPreview,
    extraPreviews,
  } = useImageUploads();

  const [textInput, setTextInput] = useState<string>("");
  const [itemName, setItemName] = useState<string>("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [runActive, setRunActive] = useState(true);
  const [runSold, setRunSold] = useState(false);
  const [collapseForm, setCollapseForm] = useState(false);
  const [hasRunOnce, setHasRunOnce] = useState(false);

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
    activeError,
    soldError,
    dismissedActive,
    dismissedSold,
    dismissActive,
    dismissSold,
    runMode,
    resetModeForNewRun,
    clearModeCompletely,
    abortAll,
  } = useThriftStream({
    mainImage,
    files,
    textInput,
    itemName,
    runActive,
    runSold,
  });

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxName, setLightboxName] = useState<string>("");

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxUrl(null);
    }
    if (lightboxUrl) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxUrl]);

  async function handleRun() {
    if (!runActive && !runSold) return;

    const mode: Mode = runActive && runSold ? "both" : runActive ? "active" : "sold";

    if (!mainImage) {
      setCollapseForm(false);
      setSubmitAttempted(true);
      await runMode(mode);
      return;
    }

    setHasRunOnce(true);
    setCollapseForm(true);
    setSubmitAttempted(true);

    abortAll();

    if (!runActive) clearModeCompletely("active");
    if (!runSold) clearModeCompletely("sold");

    if (runActive) resetModeForNewRun("active");
    if (runSold) resetModeForNewRun("sold");

    await runMode(mode);
  }

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-10 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6 items-start">
          <div className="flex flex-col gap-6">
            <SearchFormCard
              hasRunOnce={hasRunOnce}
              collapseForm={collapseForm}
              setCollapseForm={setCollapseForm}
              anyBusy={anyBusy}
              submitAttempted={submitAttempted}
              mainImage={mainImage}
              setMainImage={setMainImage}
              files={files}
              addSlot={addSlot}
              removeSlot={removeSlot}
              setSlotFile={setSlotFile}
              clearAllSlots={clearAllSlots}
              itemName={itemName}
              setItemName={setItemName}
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
          </div>

          <ImageSidebar
            mainPreview={mainPreview}
            extraPreviews={extraPreviews}
            onOpen={(url, name) => {
              setLightboxUrl(url);
              setLightboxName(name);
            }}
            onRemoveMain={removeMainSelected}
            onRemoveExtra={removeExtraSelectedBySlotIndex}
          />
        </div>
      </div>

      {lightboxUrl && (
        <LightboxModal url={lightboxUrl} name={lightboxName} onClose={() => setLightboxUrl(null)} />
      )}
    </div>
  );
}
