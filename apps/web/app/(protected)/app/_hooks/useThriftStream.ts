import { useMemo, useRef, useState } from "react";

import { computePriceRangeFromListings, getVisiblePricedListings } from "@/lib/thrift/listing";
import {
  makeInitialStepState,
  parseStreamError,
  stepIndexFromState,
  StepStatus,
  STREAM_STEPS,
  StreamEvent,
} from "@/lib/thrift/stream";

import type { FrontendPayload, Mode } from "../types";

type UseThriftStreamParams = {
  mainImage: File | null;
  files: (File | null)[];
  textInput: string;
  itemName: string;
  runActive: boolean;
  runSold: boolean;
};

export function useThriftStream({
  mainImage,
  files,
  textInput,
  itemName,
  runActive,
  runSold,
}: UseThriftStreamParams) {
  const [dismissedActive, setDismissedActive] = useState<Set<string>>(() => new Set());
  const [dismissedSold, setDismissedSold] = useState<Set<string>>(() => new Set());

  const dismissActive = (key: string) =>
    setDismissedActive((prev) => new Set(prev).add(key));

  const dismissSold = (key: string) =>
    setDismissedSold((prev) => new Set(prev).add(key));

  const [activeData, setActiveData] = useState<FrontendPayload | null>(null);
  const [soldData, setSoldData] = useState<FrontendPayload | null>(null);

  const derivedActiveRange = useMemo(
    () => computePriceRangeFromListings(activeData?.active_listings, dismissedActive),
    [activeData?.active_listings, dismissedActive]
  );

  const derivedSoldRange = useMemo(
    () => computePriceRangeFromListings(soldData?.sold_listings, dismissedSold),
    [soldData?.sold_listings, dismissedSold]
  );

  const derivedActiveCount = useMemo(() => {
    return getVisiblePricedListings(activeData?.active_listings, dismissedActive).length;
  }, [activeData?.active_listings, dismissedActive]);

  const derivedSoldCount = useMemo(() => {
    return getVisiblePricedListings(soldData?.sold_listings, dismissedSold).length;
  }, [soldData?.sold_listings, dismissedSold]);

  const combinedData = useMemo(() => {
    if (!activeData && !soldData) return null;

    const base = activeData ?? soldData!;
    const baseMA = base.market_analysis;

    const mergedMA = {
      active: {
        similar_count: derivedActiveCount,
        price_range: derivedActiveRange,
      },
      sold: {
        similar_count: derivedSoldCount,
        price_range: derivedSoldRange,
      },
      sell_velocity:
        activeData?.market_analysis.sell_velocity ??
        soldData?.market_analysis.sell_velocity ??
        baseMA.sell_velocity ??
        "unknown",
      rarity:
        activeData?.market_analysis.rarity ??
        soldData?.market_analysis.rarity ??
        baseMA.rarity ??
        "unknown",
    };

    return {
      ...base,
      mode: "both",
      market_analysis: mergedMA,
      legit_check_advice: base.legit_check_advice ?? [],
      summary: [activeData?.summary].filter(Boolean).join("\n\n"),
      timing_sec:
        activeData && soldData
          ? Math.round((activeData?.timing_sec ?? 0) * 1000) / 1000
          : Math.round(((activeData?.timing_sec ?? 0) + (soldData?.timing_sec ?? 0)) * 1000) /
            1000,
    };
  }, [
    activeData,
    soldData,
    derivedActiveRange,
    derivedSoldRange,
    derivedActiveCount,
    derivedSoldCount,
  ]);

  const [activeLoading, setActiveLoading] = useState(false);
  const [soldLoading, setSoldLoading] = useState(false);

  const [activeProgress, setActiveProgress] = useState(0);
  const [soldProgress, setSoldProgress] = useState(0);

  const [activeSteps, setActiveSteps] = useState<Record<string, StepStatus>>(makeInitialStepState());
  const [soldSteps, setSoldSteps] = useState<Record<string, StepStatus>>(makeInitialStepState());

  const activeAbortRef = useRef<AbortController | null>(null);
  const soldAbortRef = useRef<AbortController | null>(null);

  const [activeError, setActiveError] = useState<string>("");
  const [soldError, setSoldError] = useState<string>("");

  const activeBusy = activeLoading;
  const soldBusy = soldLoading;
  const anyBusy = activeBusy || soldBusy;

  const overallProgress = useMemo(() => {
    const vals: number[] = [];
    if (runActive) vals.push(activeProgress ?? 0);
    if (runSold) vals.push(soldProgress ?? 0);
    if (vals.length === 0) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [runActive, runSold, activeProgress, soldProgress]);

  const showBoth = runActive && runSold;

  const combinedSteps = useMemo<Record<string, StepStatus>>(() => {
    if (!showBoth) return runActive ? activeSteps : soldSteps;

    const merged: Record<string, StepStatus> = makeInitialStepState();

    const idxA = stepIndexFromState(activeSteps);
    const idxB = stepIndexFromState(soldSteps);
    const lagIdx = Math.min(idxA, idxB);

    for (let i = 0; i < lagIdx; i++) {
      merged[STREAM_STEPS[i].id] = "done";
    }

    if (lagIdx < STREAM_STEPS.length) {
      merged[STREAM_STEPS[lagIdx].id] = activeLoading || soldLoading ? "active" : "done";
    }

    if (lagIdx === STREAM_STEPS.length) {
      for (const s of STREAM_STEPS) merged[s.id] = "done";
    }

    return merged;
  }, [showBoth, runActive, activeSteps, soldSteps, activeLoading, soldLoading]);

  function resetModeForNewRun(mode: Mode) {
    if (mode === "active") {
      setDismissedActive(new Set());
      setActiveError("");
      setActiveData(null);
      setActiveProgress(0);
      setActiveLoading(true);
      setActiveSteps(makeInitialStepState());
    } else {
      setDismissedSold(new Set());
      setSoldError("");
      setSoldData(null);
      setSoldProgress(0);
      setSoldLoading(true);
      setSoldSteps(makeInitialStepState());
    }
  }

  function clearModeCompletely(mode: Mode) {
    resetModeForNewRun(mode);
    if (mode === "active") setActiveLoading(false);
    else setSoldLoading(false);
  }

  function abortAll() {
    activeAbortRef.current?.abort();
    soldAbortRef.current?.abort();
  }

  async function runMode(mode: Mode) {
    if (!mainImage) {
      const msg = "Please upload a Main Image (full item, straight-on) before sending.";
      if (mode === "active") setActiveError(msg);
      else if (mode === "sold") setSoldError(msg);
      else {
        setActiveError(msg);
        setSoldError(msg);
      }
      return;
    }

    if (mode === "active") setActiveError("");
    else if (mode === "sold") setSoldError("");
    else {
      setActiveError("");
      setSoldError("");
    }

    if (mode === "active") activeAbortRef.current?.abort();
    else if (mode === "sold") soldAbortRef.current?.abort();
    else {
      activeAbortRef.current?.abort();
      soldAbortRef.current?.abort();
    }

    const controller = new AbortController();
    if (mode === "active") activeAbortRef.current = controller;
    else if (mode === "sold") soldAbortRef.current = controller;
    else {
      activeAbortRef.current = controller;
      soldAbortRef.current = controller;
    }

    try {
      if (mode === "active") setActiveLoading(true);
      else if (mode === "sold") setSoldLoading(true);
      else {
        setActiveLoading(true);
        setSoldLoading(true);
      }

      const form = new FormData();
      form.append("main_image", mainImage);

      const prompt = textInput.trim();
      const item = itemName.trim();
      if (prompt.length > 0) form.append("text", prompt);
      if (item.length > 0) form.append("itemName", item);

      const extras = files.filter(Boolean) as File[];
      for (const f of extras) form.append("files", f);

      form.append("mode", mode);

      if (mode === "both") {
        setDismissedActive(new Set());
        setDismissedSold(new Set());
      }

      const res = await fetch("/api/py/extract-file-stream", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Request failed: ${res.status}${txt ? ` - ${txt}` : ""}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body stream");

      const decoder = new TextDecoder();
      let buffer = "";

      const setProgress = (p: number) => {
        const clamped = Math.max(0, Math.min(1, p));
        if (mode === "active") setActiveProgress(clamped);
        else if (mode === "sold") setSoldProgress(clamped);
        else {
          setActiveProgress(clamped);
          setSoldProgress(clamped);
        }
      };

      const setStep = (stepId: string, status: StepStatus) => {
        if (mode === "active") setActiveSteps((prev) => ({ ...prev, [stepId]: status }));
        else if (mode === "sold") setSoldSteps((prev) => ({ ...prev, [stepId]: status }));
        else {
          setActiveSteps((prev) => ({ ...prev, [stepId]: status }));
          setSoldSteps((prev) => ({ ...prev, [stepId]: status }));
        }
      };

      const normalizeActives = (currentStepId: string) => {
        const normalize = (setter: any) => {
          setter((prev: any) => {
            const next = { ...prev };
            for (const k of Object.keys(next)) {
              if (k !== currentStepId && next[k] === "active") next[k] = "done";
            }
            return next;
          });
        };

        if (mode === "active") normalize(setActiveSteps);
        else if (mode === "sold") normalize(setSoldSteps);
        else {
          normalize(setActiveSteps);
          normalize(setSoldSteps);
        }
      };

      const handleLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        let msg: StreamEvent;
        try {
          msg = JSON.parse(trimmed);
        } catch {
          return;
        }

        if (msg.type === "step") {
          if (msg.pct != null) setProgress(msg.pct);

          if (msg.status === "start") {
            normalizeActives(msg.step_id);
            setStep(msg.step_id, "active");
          } else {
            setStep(msg.step_id, "done");
          }
        }

        if (msg.type === "error") {
          throw new Error(parseStreamError(msg.error));
        }

        if (msg.type === "result") {
          const payload = msg.data;

          if (mode === "active") setActiveData(payload);
          else if (mode === "sold") setSoldData(payload);
          else {
            setActiveData(payload);
            setSoldData(payload);
          }

          setProgress(1);

          const markDone = (setter: any) => {
            setter((prev: any) => {
              const next = { ...prev };
              for (const k of Object.keys(next)) if (next[k] === "active") next[k] = "done";
              return next;
            });
          };

          if (mode === "active") markDone(setActiveSteps);
          else if (mode === "sold") markDone(setSoldSteps);
          else {
            markDone(setActiveSteps);
            markDone(setSoldSteps);
          }
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) handleLine(line);
      }

      const tail = buffer.trim();
      if (tail) handleLine(tail);
    } catch (e: any) {
      const msg = e?.name === "AbortError" ? "Cancelled." : e?.message ?? "Unknown error";
      if (mode === "active") setActiveError(msg);
      else if (mode === "sold") setSoldError(msg);
      else {
        setActiveError(msg);
        setSoldError(msg);
      }
    } finally {
      if (mode === "active") setActiveLoading(false);
      else if (mode === "sold") setSoldLoading(false);
      else {
        setActiveLoading(false);
        setSoldLoading(false);
      }
    }
  }

  return {
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
  };
}
