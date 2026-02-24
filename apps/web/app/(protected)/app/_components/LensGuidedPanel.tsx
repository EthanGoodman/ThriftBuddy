import { useEffect, useRef, useState } from "react";

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
  mainPreview?: Preview;
  onSelect: (candidate: LensCandidate) => void;
  onDeselect: () => void;
  onTitleChange: (value: string) => void;
  onToggleEdit: () => void;
  onRunAnalysis: () => void;
  onPrev: () => void;
  onNext: () => void;
};

function stripTrailingEllipsis(value: string) {
  return value.replace(/(\u2026|\.{3})\s*$/g, "").trim();
}

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
  mainPreview,
  onSelect,
  onDeselect,
  onTitleChange,
  onToggleEdit,
  onRunAnalysis,
  onPrev,
  onNext,
}: LensGuidedPanelProps) {
  const titleInputRef = useRef<HTMLTextAreaElement | null>(null);
  const selectionModuleRef = useRef<HTMLDivElement | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const PAGE_SIZE = isMobileViewport ? 1 : 3;
  const pageCount = Math.max(1, Math.ceil(candidates.length / PAGE_SIZE));
  const pageIndex = Math.min(page, pageCount - 1);
  const start = pageIndex * PAGE_SIZE;
  const visible = candidates.slice(start, start + PAGE_SIZE);

  const hasSelection = Boolean(selectedId);
  const normalizedTitle = stripTrailingEllipsis(selectedTitle);
  const hasTitle = Boolean(normalizedTitle.trim());
  const isAnalyzing = step === "analyzing";
  const controlsDisabled = isAnalyzing;
  const originalTitle = stripTrailingEllipsis(selectedCandidate?.title ?? "");
  const titleUpdated = hasSelection && Boolean(originalTitle) && normalizedTitle.trim() !== originalTitle;
  const flowStep = !hasSelection ? 1 : !hasTitle ? 2 : 3;

  useEffect(() => {
    if (!hasSelection || controlsDisabled) return;
    const el = titleInputRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [hasSelection, selectedId, controlsDisabled]);

  useEffect(() => {
    if (!hasSelection) return;
    selectionModuleRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [hasSelection, selectedId]);

  useEffect(() => {
    const el = titleInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [normalizedTitle]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 639px)");
    const sync = () => setIsMobileViewport(media.matches);
    sync();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    }
    media.addListener(sync);
    return () => media.removeListener(sync);
  }, []);

  const statusLabel = isLoading
    ? "Searching with Google Lens..."
    : candidates.length
      ? "Google Lens search complete"
      : "Waiting for search";

  return (
    <div className="rounded-[28px] panel-glass p-4 md:p-10 space-y-6 min-w-0">
      <div>
        <div className="text-sm font-semibold text-[var(--foreground)]">Guided AI Analysis</div>
        <div className="text-xs text-[var(--muted)]">{statusLabel}</div>
      </div>

      <div className="grid gap-5 min-w-0 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-2xl panel-strong p-4">
            <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Your image</div>
            <div className="mt-3 mx-auto w-full max-w-[320px] overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--panel-quiet)] aspect-[4/5] max-h-[320px] flex items-center justify-center">
              {mainPreview ? (
                <img src={mainPreview.url} alt={mainPreview.name} className="h-full w-full object-contain object-center bg-[var(--panel-quiet)]" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-[var(--muted)]">Upload a photo to preview</div>
              )}
            </div>
          </div>
        </aside>

        <section className="rounded-2xl panel-strong p-4 md:p-6 min-w-0">
          <div className="mb-4">
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Workflow</div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className={flowStep === 1 ? "font-semibold text-[var(--foreground)]" : "text-[var(--muted)]"}>1. Select a match</span>
              <span className="text-[var(--muted)]">•</span>
              <span className={flowStep === 2 ? "font-semibold text-[var(--foreground)]" : "text-[var(--muted)]"}>2. Refine item name</span>
              <span className="text-[var(--muted)]">•</span>
              <span className={flowStep === 3 ? "font-semibold text-[var(--foreground)]" : "text-[var(--muted)]"}>3. Run analysis</span>
            </div>
            <div className="mt-3 text-2xl font-semibold text-[var(--foreground)]">Select the best match</div>
          </div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Possible matches {candidates.length > 0 ? `(${candidates.length})` : ""}
          </div>

          {isLoading ? (
            <div className="matches-loading" aria-busy="true">
              <div className="matches-loading__aurora" aria-hidden="true" />
              <div className="matches-loading__header">
                <div className="matches-loading__title">
                  <span className="matches-loading__label">Finding matches</span>
                  <span className="alive-orb" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-quiet)]/70 p-3">
                    <div className="matches-skeleton-block aspect-[4/5] rounded-xl bg-[rgba(126,97,73,0.2)]" />
                    <div className="mt-3 space-y-2">
                      <div className="matches-skeleton-block h-3 w-4/5 rounded-full bg-[rgba(126,97,73,0.25)]" />
                      <div className="matches-skeleton-block h-2.5 w-3/5 rounded-full bg-[rgba(126,97,73,0.2)]" />
                      <div className="pt-1">
                        <div className="matches-skeleton-block h-6 w-24 rounded-full bg-[rgba(126,97,73,0.22)]" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-[var(--danger)]/35 bg-[var(--danger)]/12 px-4 py-3 text-sm text-[var(--danger)]">{error}</div>
          ) : candidates.length === 0 ? (
            <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-quiet)] p-4 text-sm text-[var(--muted)]">
              No matches yet. Click Run to fetch Lens results.
            </div>
          ) : (
            <div className="min-w-0">
              <div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {visible.map((item, index) => {
                    const isSelected = selectedId === item.id;
                    return (
                      <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (controlsDisabled) return;
                          if (isSelected) {
                            onDeselect();
                            return;
                          }
                          onSelect(item);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                            e.preventDefault();
                            const direction = e.key === "ArrowUp" ? -1 : 1;
                            const nextIndex = Math.min(visible.length - 1, Math.max(0, index + direction));
                            const nextItem = visible[nextIndex];
                            if (nextItem && !controlsDisabled) onSelect(nextItem);
                            return;
                          }
                          if (e.key === "ArrowLeft") {
                            e.preventDefault();
                            if (!controlsDisabled) onPrev();
                            return;
                          }
                          if (e.key === "ArrowRight") {
                            e.preventDefault();
                            if (!controlsDisabled) onNext();
                            return;
                          }
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            if (controlsDisabled) return;
                            if (isSelected) {
                              onDeselect();
                              return;
                            }
                            onSelect(item);
                          }
                        }}
                        className={[
                          "interactive-step group relative flex min-h-[clamp(12rem,26vh,16rem)] h-full flex-col overflow-hidden rounded-2xl border text-left cursor-pointer",
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(127,98,74,0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(236,219,194,0.98)]",
                          isSelected
                            ? "interactive-step-selected border-[3px] border-[rgba(127,98,74,0.74)] bg-[var(--panel-quiet)]/70 opacity-100"
                            : "border-[var(--panel-border)] bg-[var(--panel-quiet)]/70 opacity-[0.85]",
                          controlsDisabled ? "cursor-not-allowed opacity-70" : "",
                        ].join(" ")}
                        >
                        <div className="relative w-full overflow-hidden border-b border-[var(--panel-border)] bg-[var(--panel-quiet)] aspect-[4/5]">
                          <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                          <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-[rgba(127,98,74,0.5)] bg-[rgba(245,234,214,0.72)]">
                            {isSelected ? <span className="h-2.5 w-2.5 rounded-full bg-[rgba(127,98,74,0.9)]" /> : null}
                          </span>
                          {!isSelected ? (
                            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[rgba(52,35,23,0.16)] opacity-0 transition group-hover:opacity-100">
                              <span className="rounded-full border border-[rgba(244,232,214,0.65)] bg-[rgba(52,35,23,0.5)] px-3 py-1 text-[11px] font-semibold text-[#f5e8d5]">Click to select</span>
                            </div>
                          ) : null}
                          {isSelected ? (
                            <span className="absolute right-2 top-2 rounded-full border border-[rgba(84,128,84,0.62)] bg-[rgba(208,234,206,0.96)] px-2.5 py-1 text-[10px] font-semibold text-[rgba(46,92,46,0.98)] shadow-[0_2px_8px_rgba(70,108,70,0.2)]">
                              Selected ✓
                            </span>
                          ) : null}
                        </div>

                        <div className="space-y-2 p-3 min-w-0">
                          <div className="truncate text-sm font-semibold text-[var(--foreground)]">{stripTrailingEllipsis(item.title) || "Lens result"}</div>
                          <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                            <span
                              className={[
                                "rounded-full px-2.5 py-1 text-[10px] font-semibold shrink-0",
                                isSelected
                                  ? "border border-[rgba(84,128,84,0.62)] bg-[rgba(208,234,206,0.96)] text-[rgba(46,92,46,0.98)]"
                                  : "border border-[rgba(126,99,75,0.4)] bg-[rgba(237,223,201,0.88)] text-[rgba(95,70,52,0.96)]",
                              ].join(" ")}
                            >
                              {isSelected ? "Selected ✓" : "Select this match"}
                            </span>
                            {!isSelected ? <span className="hidden sm:inline text-[10px] text-[var(--muted)]">Tap to select</span> : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-quiet)]/75 px-3 py-2">
                  {pageIndex > 0 ? (
                    <button
                      type="button"
                      onClick={onPrev}
                      disabled={controlsDisabled}
                      className={[
                        "interactive-step rounded-full px-3 py-1.5 text-xs font-semibold border",
                        controlsDisabled
                          ? "bg-[var(--panel-quiet)] text-[var(--muted)] cursor-not-allowed border-[var(--panel-border)]/40"
                          : "bg-[var(--panel-quiet)] text-[var(--foreground)] border-[var(--panel-border)]",
                      ].join(" ")}
                    >
                      Prev
                    </button>
                  ) : (
                    <span />
                  )}
                  <div className="text-xs text-[var(--muted)]">Page {pageIndex + 1} of {pageCount}</div>
                  {pageIndex < pageCount - 1 ? (
                    <button
                      type="button"
                      onClick={onNext}
                      disabled={controlsDisabled}
                      className={[
                        "interactive-step rounded-full px-3 py-1.5 text-xs font-semibold border",
                        controlsDisabled
                          ? "bg-[var(--panel-quiet)] text-[var(--muted)] cursor-not-allowed border-[var(--panel-border)]/40"
                          : "bg-[var(--panel-quiet)] text-[var(--foreground)] border-[var(--panel-border)]",
                      ].join(" ")}
                    >
                      Next
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              </div>

              {!hasSelection ? (
                <div className="mt-4 rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--muted)]">
                  Select a match to continue.
                </div>
              ) : null}

              {hasSelection ? (
                <aside className="mt-4">
                  <div
                    ref={selectionModuleRef}
                    className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-quiet)] px-3 md:px-4 py-3 space-y-3 opacity-100 translate-y-0 transition-all duration-200 ease-out min-w-0"
                  >
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Selected result</div>
                    <div className="mt-1 text-xs text-[var(--muted)]">Refine item name, then run.</div>
                  </div>
                  <div className="flex min-w-0 flex-col items-stretch gap-3 pb-2 border-b border-[rgba(129,101,78,0.34)] sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[var(--panel)]">
                        <img src={selectedCandidate?.image} alt={selectedCandidate?.title || "Selected item"} className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-[var(--foreground)]">{selectedCandidate?.title || "Selected item"}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!hasSelection || !originalTitle || controlsDisabled}
                      onClick={() => onTitleChange(originalTitle)}
                      className="interactive-step w-full shrink-0 rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    >
                      Use original item name
                    </button>
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Step 2: Refine item name</div>
                    <div className="mt-1 text-[11px] text-[var(--muted)]">Tip: include brand + model + material for best results.</div>
                    <textarea
                      ref={titleInputRef}
                      value={normalizedTitle}
                      onFocus={() => {
                        if (!isEditingTitle) onToggleEdit();
                      }}
                      onChange={(e) => onTitleChange(stripTrailingEllipsis(e.target.value))}
                      placeholder="Add brand + model + material for better search quality"
                      rows={3}
                      disabled={controlsDisabled}
                      className={[
                        "mt-2 w-full min-h-[7.25rem] resize-none rounded-xl border px-3 py-2.5 text-base leading-snug",
                        "focus:outline-none focus:ring-4 focus:ring-[rgba(127,98,74,0.38)]",
                        !controlsDisabled
                          ? "border-[rgba(128,101,78,0.44)] bg-[rgba(244,232,213,0.98)] text-[var(--foreground)]"
                          : "border-[rgba(128,101,78,0.32)] bg-[rgba(237,222,199,0.96)] text-[var(--muted)] cursor-not-allowed",
                      ].join(" ")}
                    />
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
                      <span>Used for marketplace search.</span>
                      <span>{normalizedTitle.length} chars</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      disabled={!hasSelection || !hasTitle || controlsDisabled}
                      onClick={onRunAnalysis}
                      className={[
                        "w-full rounded-xl px-4 py-3 text-sm font-semibold transition inline-flex items-center justify-center gap-2",
                        !hasSelection || !hasTitle || controlsDisabled
                          ? "bg-[rgba(210,191,166,0.66)] text-[var(--muted)] cursor-not-allowed"
                          : "bg-[var(--accent)] text-[#f9f1e2] hover:bg-[var(--accent-strong)] shadow-[0_10px_18px_rgba(74,54,39,0.24)]",
                      ].join(" ")}
                    >
                      {isAnalyzing ? (
                        <>
                          <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-[#f9f1e2]/80 border-t-transparent animate-spin" />
                          Running analysis...
                        </>
                      ) : !hasSelection ? (
                        "Select a match to continue"
                      ) : (
                        "Search with this item name"
                      )}
                    </button>

                    {titleUpdated ? <div className="text-[11px] font-semibold text-[var(--success)]">Item name updated ✓</div> : null}
                    <div className="text-[11px] text-[var(--muted)]">Next: we&apos;ll search marketplaces using your refined item name.</div>
                  </div>
                  </div>
                </aside>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
