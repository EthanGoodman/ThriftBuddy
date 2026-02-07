import { useEffect, useRef } from "react";

import type { LensCandidate, Preview } from "../types";

type FlowStep = "inputs" | "identifying" | "pick_match" | "ready_to_analyze" | "analyzing" | "done";

type LensGuidedPanelProps = {
  candidates: LensCandidate[];
  page: number;
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
  const titleInputRef = useRef<HTMLTextAreaElement | null>(null);
  const PAGE_SIZE = 2;
  const pageCount = Math.max(1, Math.ceil(candidates.length / PAGE_SIZE));
  const pageIndex = Math.min(page, pageCount - 1);
  const start = pageIndex * PAGE_SIZE;
  const visible = candidates.slice(start, start + PAGE_SIZE);
  const hasSelection = Boolean(selectedId);
  const hasTitle = Boolean(selectedTitle.trim());
  const isAnalyzing = step === "analyzing";
  const isDone = step === "done";
  const statusLabel = isLoading
    ? "Searching with Google Lens..."
    : candidates.length
      ? "Google Lens search complete"
      : "Waiting for search";

  useEffect(() => {
    if (!isEditingTitle) return;
    const el = titleInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [isEditingTitle, selectedTitle]);

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
              <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-slate-950/60 aspect-[3/4]">
                {mainPreview ? (
                  <img
                    src={mainPreview.url}
                    alt={mainPreview.name}
                    className="h-full w-full object-contain bg-slate-950/60"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted">
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
                  <div className="grid gap-3 md:grid-cols-2">
                    {visible.map((item, index) => {
                      const isSelected = selectedId === item.id;

                      return (
                        <div
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => onSelect(item)}
                          onKeyDown={(e) => {
                            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                              e.preventDefault();
                              const direction = e.key === "ArrowUp" ? -1 : 1;
                              const nextIndex = Math.min(
                                visible.length - 1,
                                Math.max(0, index + direction),
                              );
                              const nextItem = visible[nextIndex];
                              if (nextItem) onSelect(nextItem);
                              return;
                            }
                            if (e.key === "ArrowLeft") {
                              e.preventDefault();
                              onPrev();
                              return;
                            }
                            if (e.key === "ArrowRight") {
                              e.preventDefault();
                              onNext();
                              return;
                            }
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onSelect(item);
                            }
                          }}
                          className={[
                            "flex h-full flex-col overflow-hidden rounded-2xl border text-left transition cursor-pointer",
                            isSelected
                              ? "border-blue-400/50 bg-blue-500/10 ring-1 ring-blue-400/40"
                              : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]",
                            "min-h-[clamp(11rem,24vh,15rem)]",
                          ].join(" ")}
                        >
                          <div className="relative w-full overflow-hidden border-b border-white/10 bg-slate-950/60 aspect-[3/4]">
                            <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                          </div>
                          <div className="flex flex-1 flex-col gap-3 p-[clamp(0.75rem,1.5vw,1.1rem)]">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                {isSelected && isEditingTitle ? (
                                  <textarea
                                    ref={titleInputRef}
                                    value={selectedTitle}
                                    onChange={(e) => {
                                      onTitleChange(e.target.value);
                                      const el = e.currentTarget;
                                      el.style.height = "auto";
                                      el.style.height = `${el.scrollHeight}px`;
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
                                    placeholder="Edit title"
                                    rows={2}
                                    className="w-full min-h-[3rem] resize-none overflow-hidden rounded-lg border border-blue-400/40 bg-slate-950/60 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                  />
                                ) : (
                                  <div className="text-sm font-semibold text-white line-clamp-2">
                                    {isSelected ? selectedTitle || item.title : item.title}
                                  </div>
                                )}
                              </div>
                              {isSelected ? (
                                <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-200">
                                  Selected
                                </span>
                              ) : null}
                            </div>
                            {isSelected ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleEdit();
                                }}
                                className="self-start text-[11px] font-semibold text-blue-200 hover:text-white"
                              >
                                {isEditingTitle ? "Done" : "Edit title"}
                              </button>
                            ) : null}
                          </div>
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
                      disabled={pageIndex === 0}
                      className={[
                        "rounded-full px-3 py-1.5 text-xs font-semibold border transition",
                        pageIndex === 0
                          ? "bg-white/5 text-muted cursor-not-allowed border-white/5"
                          : "bg-white/5 text-white border-white/10 hover:bg-white/10",
                      ].join(" ")}
                    >
                      Prev
                    </button>
                    <div className="text-xs text-muted">
                      Page {pageIndex + 1} of {pageCount}
                    </div>
                    <button
                      type="button"
                      onClick={onNext}
                      disabled={pageIndex >= pageCount - 1}
                      className={[
                        "rounded-full px-3 py-1.5 text-xs font-semibold border transition",
                        pageIndex >= pageCount - 1
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
