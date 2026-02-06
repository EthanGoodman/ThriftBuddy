import { ProgressBar } from "@/components/ProgressBar";
import { StepColumn } from "@/components/StepColumn";
import { STREAM_STEPS, StepStatus } from "@/lib/thrift/stream";

import type { FrontendPayload } from "../types";

import { ResultsCards } from "./ResultsCards";

type ResultsPanelProps = {
  combinedData: FrontendPayload | null;
  anyBusy: boolean;
  runActive: boolean;
  runSold: boolean;
  overallProgress: number;
  activeProgress: number;
  soldProgress: number;
  combinedSteps: Record<string, StepStatus>;
  activeSteps: Record<string, StepStatus>;
  soldSteps: Record<string, StepStatus>;
  activeStepMeta: Record<string, { label: string; detail?: string }>;
  soldStepMeta: Record<string, { label: string; detail?: string }>;
  activeLoading: boolean;
  soldLoading: boolean;
  activeData: FrontendPayload | null;
  soldData: FrontendPayload | null;
  activeError: string;
  soldError: string;
  dismissedActive: Set<string>;
  dismissedSold: Set<string>;
  onDismissActive: (key: string) => void;
  onDismissSold: (key: string) => void;
};

export function ResultsPanel({
  combinedData,
  anyBusy,
  runActive,
  runSold,
  overallProgress,
  activeProgress,
  soldProgress,
  combinedSteps,
  activeSteps,
  soldSteps,
  activeStepMeta,
  soldStepMeta,
  activeLoading,
  soldLoading,
  activeData,
  soldData,
  activeError,
  soldError,
  dismissedActive,
  dismissedSold,
  onDismissActive,
  onDismissSold,
}: ResultsPanelProps) {
  function buildDisplaySteps(
    stepState: Record<string, string>,
    stepMeta: Record<string, { label: string; detail?: string }>
  ) {
    return STREAM_STEPS.flatMap((s) => {
      const st = stepState?.[s.id];
      if (st !== "done" && st !== "active") return [];

      const meta = stepMeta?.[s.id];
      const baseLabel = meta?.label ?? s.label;
      const detail = meta?.detail?.trim();
      const label = detail ? `${baseLabel} - ${detail}` : baseLabel;

      if (st === "done") return [{ id: s.id, label }];
      return [{ id: s.id + ":active", label }];
    });
  }

  return (
    <div className="space-y-4">
      {combinedData && !anyBusy ? (
        <ResultsCards
          data={combinedData}
          activeData={activeData}
          soldData={soldData}
          activeLoading={activeLoading}
          soldLoading={soldLoading}
          dismissedActive={dismissedActive}
          dismissedSold={dismissedSold}
          onDismissActive={onDismissActive}
          onDismissSold={onDismissSold}
        />
      ) : (
        <>
          {!anyBusy ? (
            <div className="rounded-2xl panel-glass p-4 text-sm text-muted">
              Run Active and/or Sold to see results.
            </div>
          ) : (
            <div className="rounded-2xl panel-glass p-6 space-y-4">
              {(() => {
                const showBoth = runActive && runSold;
                return (
                  <div className="w-full">
                    <div className="pb-4">
                      <ProgressBar value={overallProgress} isBusy={anyBusy} />
                    </div>
                    {showBoth ? (
                      <StepColumn
                        title={`Overall (${Math.round(overallProgress * 100)}%)`}
                        steps={buildDisplaySteps(combinedSteps, { ...soldStepMeta, ...activeStepMeta })}
                        isLoading={anyBusy}
                        isDone={!anyBusy && !!activeData && !!soldData && !activeError && !soldError}
                      />
                    ) : runActive ? (
                      <StepColumn
                        title={`Active (${Math.round(activeProgress * 100)}%)`}
                        steps={buildDisplaySteps(activeSteps, activeStepMeta)}
                        isLoading={activeLoading}
                        isDone={!activeLoading && !!activeData && !activeError}
                      />
                    ) : (
                      <StepColumn
                        title={`Sold (${Math.round(soldProgress * 100)}%)`}
                        steps={buildDisplaySteps(soldSteps, soldStepMeta)}
                        isLoading={soldLoading}
                        isDone={!soldLoading && !!soldData && !soldError}
                      />
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
