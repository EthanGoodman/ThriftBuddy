import { ExampleListingsList } from "@/components/ExampleListingList";
import { FullscreenCard } from "@/components/full-screen-modal";
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
  function buildDisplaySteps(stepState: Record<string, string>) {
    return STREAM_STEPS.flatMap((s) => {
      const st = stepState?.[s.id];
      if (st === "done") return [{ id: s.id, label: s.label }];
      if (st === "active") return [{ id: s.id + ":active", label: s.label }];
      return [];
    });
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-black/5 space-y-5 dark:bg-slate-900 dark:ring-white/10">
      <div className="space-y-4">
        {combinedData && !anyBusy ? (
          <ResultsCards data={combinedData} />
        ) : (
          <>
            {!anyBusy ? (
              <div className="text-sm text-slate-600 rounded-xl border bg-white dark:border-slate-800 dark:bg-slate-900 p-4">
                Run Active and/or Sold to see results.
              </div>
            ) : (
              <div className="rounded-xl border bg-white dark:border-slate-800 dark:bg-slate-900 p-4 space-y-4">
                {(() => {
                  const showBoth = runActive && runSold;
                  return (
                    <>
                      <div className="w-full">
                        <div className="pb-4">
                          <ProgressBar value={overallProgress} isBusy={anyBusy} />
                        </div>
                        {showBoth ? (
                          <StepColumn
                            title={`Overall (${Math.round(overallProgress * 100)}%)`}
                            steps={buildDisplaySteps(combinedSteps)}
                            isLoading={anyBusy}
                            isDone={!anyBusy && !!activeData && !!soldData && !activeError && !soldError}
                          />
                        ) : runActive ? (
                          <StepColumn
                            title={`Active (${Math.round(activeProgress * 100)}%)`}
                            steps={buildDisplaySteps(activeSteps)}
                            isLoading={activeLoading}
                            isDone={!activeLoading && !!activeData && !activeError}
                          />
                        ) : (
                          <StepColumn
                            title={`Sold (${Math.round(soldProgress * 100)}%)`}
                            steps={buildDisplaySteps(soldSteps)}
                            isLoading={soldLoading}
                            isDone={!soldLoading && !!soldData && !soldError}
                          />
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </>
        )}

        {combinedData && !anyBusy && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FullscreenCard title="Active listings" maxWidthClass="max-w-7xl">
              {({ fullscreen }) =>
                activeData?.active_listings?.length ? (
                  <ExampleListingsList
                    listings={activeData.active_listings}
                    fullscreen={fullscreen}
                    dismissedKeys={dismissedActive}
                    onDismiss={onDismissActive}
                  />
                ) : (
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    {activeLoading ? "Loading active..." : "Run Active to see examples."}
                  </div>
                )
              }
            </FullscreenCard>

            <FullscreenCard title="Sold listings" maxWidthClass="max-w-7xl">
              {({ fullscreen }) =>
                soldData?.sold_listings?.length ? (
                  <ExampleListingsList
                    listings={soldData.sold_listings}
                    fullscreen={fullscreen}
                    dismissedKeys={dismissedSold}
                    onDismiss={onDismissSold}
                  />
                ) : (
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    {soldLoading ? "Loading sold..." : "Run Sold to see examples."}
                  </div>
                )
              }
            </FullscreenCard>
          </div>
        )}
      </div>
    </div>
  );
}
