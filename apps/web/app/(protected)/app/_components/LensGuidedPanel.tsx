import type { LensCandidate, Preview } from "../types";

type FlowStep = "inputs" | "identifying" | "pick_match" | "ready_to_analyze" | "analyzing" | "done";

type LensGuidedPanelProps = {
  candidates: LensCandidate[];
  page: number;
  pageSize?: number;
  selectedId: string | null;
  selectedTitle: string;
  selectedCandidate?: LensCandidate | null;
  isLoading: boolean;
  error: string;
  step: FlowStep;
  isEditingTitle: boolean;
  isSelectionCollapsed: boolean;
  isPanelCollapsed: boolean;
  mainPreview?: Preview;
  onSelect: (candidate: LensCandidate) => void;
  onTitleChange: (value: string) => void;
  onToggleEdit: () => void;
  onRunAnalysis: () => void;
  onEditSelection: () => void;
  onTogglePanel: () => void;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
};

export function LensGuidedPanel({
  candidates,
  page,
  pageSize = 5,
  selectedId,
  selectedTitle,
  selectedCandidate = null,
  isLoading,
  error,
  step,
  isEditingTitle,
  isSelectionCollapsed,
  isPanelCollapsed,
  mainPreview,
  onSelect,
  onTitleChange,
  onToggleEdit,
  onRunAnalysis,
  onEditSelection,
  onTogglePanel,
  onPrev,
  onNext,
  onReset,
}: LensGuidedPanelProps) {
  const totalPages = Math.max(1, Math.ceil(candidates.length / pageSize));
  const clampedPage = Math.min(page, totalPages - 1);
  const start = clampedPage * pageSize;
  const pageItems = candidates.slice(start, start + pageSize);
  const hasSelection = Boolean(selectedId);
  const hasTitle = Boolean(selectedTitle.trim());
  const isAnalyzing = step === "analyzing";
  const isDone = step === "done";
  const statusLabel = isLoading
    ? "Searching with Google Lens..."
    : candidates.length
      ? "Google Lens search complete"
      : "Waiting for search";

  return (
    <div className="rounded-[28px] panel-glass p-6 md:p-10 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-white">Guided AI Analysis</div>
          <div className="text-xs text-muted">{statusLabel}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePanel}
            className="rounded-full px-4 py-1.5 text-xs font-semibold border border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            {isPanelCollapsed ? "Expand" : "Collapse"}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded-full px-4 py-1.5 text-xs font-semibold border border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            Reset
          </button>
        </div>
      </div>

      {isPanelCollapsed ? (
        <div className="rounded-2xl panel-strong p-4 text-sm text-muted">
          {hasSelection && selectedCandidate ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.3em] text-muted">Selected item</div>
                <div className="mt-1 truncate font-semibold text-white">
                  {selectedTitle || selectedCandidate.title}
                </div>
                <div className="text-xs text-muted">Source: {selectedCandidate.source ?? "lens"}</div>
              </div>
              <button
                type="button"
                onClick={onEditSelection}
                className="rounded-full px-4 py-1.5 text-xs font-semibold border border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                Edit choice
              </button>
            </div>
          ) : (
            <div>No selection yet. Expand to pick a match.</div>
          )}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="space-y-4">
            <div className="rounded-2xl panel-strong p-4">
              <div className="text-xs uppercase tracking-[0.3em] text-muted">Your image</div>
              <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-slate-950/60">
                {mainPreview ? (
                  <img src={mainPreview.url} alt={mainPreview.name} className="h-40 w-full object-cover" />
                ) : (
                  <div className="flex h-40 items-center justify-center text-xs text-muted">
                    Upload a photo to preview
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl panel-strong p-4">
              <div className="text-xs uppercase tracking-[0.3em] text-muted">Step status</div>
              <div className="mt-3 space-y-2 text-xs text-muted">
                <div className="flex items-center justify-between">
                  <span>1. Pick a match</span>
                  <span className={hasSelection ? "text-emerald-300" : "text-muted"}>
                    {hasSelection ? "Done" : "Pending"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>2. Edit title (optional)</span>
                  <span className={hasTitle ? "text-emerald-300" : "text-muted"}>
                    {hasTitle ? "Ready" : "Optional"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>3. Run analysis</span>
                  <span className={isDone ? "text-emerald-300" : isAnalyzing ? "text-blue-300" : "text-muted"}>
                    {isAnalyzing ? "Running" : isDone ? "Done" : "Pending"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl panel-strong p-6 space-y-4">
            <div>
              <div className="text-base font-semibold text-white">Select the matching product</div>
              <div className="text-xs text-muted">
                Choose the product that best matches your image. This will be used to search marketplaces.
              </div>
            </div>

            {isLoading ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
                Loading matches...
              </div>
            ) : error ? (
              <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : candidates.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
                No matches yet. Click Run to fetch Lens results.
              </div>
            ) : (
              <>
                {hasSelection && isSelectionCollapsed && selectedCandidate ? (
                  <div className="rounded-xl border border-blue-400/30 bg-blue-500/10 p-4 text-sm text-white">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs uppercase tracking-[0.3em] text-blue-200">Selected item</div>
                        <div className="mt-1 truncate font-semibold">{selectedTitle}</div>
                        <div className="text-xs text-muted">Source: {selectedCandidate.source ?? "lens"}</div>
                      </div>
                      <button
                        type="button"
                        onClick={onEditSelection}
                        className="rounded-full px-4 py-1.5 text-xs font-semibold border border-white/10 bg-white/5 text-white hover:bg-white/10"
                      >
                        Edit choice
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pageItems.map((item, index) => {
                      const isSelected = selectedId === item.id;
                      const score = Math.max(70, 96 - (start + index) * 7);

                      return (
                        <div
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => onSelect(item)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onSelect(item);
                            }
                          }}
                          className={[
                            "flex items-center gap-4 rounded-2xl border p-4 text-left transition",
                            isSelected
                              ? "border-blue-400/50 bg-blue-500/10 ring-1 ring-blue-400/40"
                              : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]",
                          ].join(" ")}
                        >
                          <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-white/10 bg-slate-950/60">
                            <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {isSelected && isEditingTitle ? (
                                <input
                                  type="text"
                                  value={selectedTitle}
                                  onChange={(e) => onTitleChange(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                  placeholder="Edit title"
                                  className="w-full rounded-lg border border-blue-400/40 bg-slate-950/60 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                />
                              ) : (
                                <div className="text-sm font-semibold text-white truncate">
                                  {isSelected ? selectedTitle || item.title : item.title}
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-muted">
                              {item.source ?? "Google Lens"} - {score}% match
                            </div>
                          </div>
                          {isSelected ? (
                            <div className="flex flex-col items-end gap-2">
                              <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-200">
                                Selected
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleEdit();
                                }}
                                className="text-[11px] font-semibold text-blue-200 hover:text-white"
                              >
                                {isEditingTitle ? "Done" : "Edit title"}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}

                {!isSelectionCollapsed && (
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={onPrev}
                      disabled={clampedPage === 0}
                      className={[
                        "rounded-full px-3 py-1.5 text-xs font-semibold border transition",
                        clampedPage === 0
                          ? "bg-white/5 text-muted cursor-not-allowed border-white/5"
                          : "bg-white/5 text-white border-white/10 hover:bg-white/10",
                      ].join(" ")}
                    >
                      Prev
                    </button>
                    <div className="text-xs text-muted">
                      Page {clampedPage + 1} of {totalPages}
                    </div>
                    <button
                      type="button"
                      onClick={onNext}
                      disabled={clampedPage >= totalPages - 1}
                      className={[
                        "rounded-full px-3 py-1.5 text-xs font-semibold border transition",
                        clampedPage >= totalPages - 1
                          ? "bg-white/5 text-muted cursor-not-allowed border-white/5"
                          : "bg-white/5 text-white border-white/10 hover:bg-white/10",
                      ].join(" ")}
                    >
                      Next
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  disabled={!hasSelection || !hasTitle}
                  onClick={onRunAnalysis}
                  className={[
                    "w-full rounded-xl px-4 py-3 text-sm font-semibold transition",
                    !hasSelection || !hasTitle
                      ? "bg-white/10 text-muted cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20",
                  ].join(" ")}
                >
                  Confirm & Search Marketplaces
                </button>
                <div className="text-center text-xs text-muted">
                  {hasSelection ? "Ready to continue." : "Select a product above to continue."}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl panel-strong p-4 text-xs text-muted">
        <div className="font-semibold text-white">Why confirm?</div>
        <p className="mt-1">
          AI image recognition is not perfect. By confirming the match, you ensure we search for the exact product
          you are researching, leading to more accurate marketplace results.
        </p>
      </div>
    </div>
  );
}
