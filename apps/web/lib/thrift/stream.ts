import { FrontendPayload } from "@/app/(protected)/app/page";

export type StepStatus = "pending" | "active" | "done";

export type StepEvent = {
  type: "step";
  step_id: string;
  label: string;
  status: "start" | "done";
  pct?: number;      // 0..1
  detail?: string;
};

export type ResultEvent = {
  type: "result";
  data: FrontendPayload;
};

export type ErrorEvent = {
  type: "error";
  error: any;
};

export type StreamEvent = StepEvent | ResultEvent | ErrorEvent;

export const STREAM_STEPS = [
  { id: "gen_query", label: "Identifying the item" },
  { id: "query_mkt", label: "Searching marketplaces" },
  { id: "proc_imgs", label: "Analyzing marketplace images" },
  { id: "refine", label: "Improving the search" },
  { id: "requery", label: "Finding better matches" },
] as const;

export function makeInitialStepState(): Record<string, StepStatus> {
  return Object.fromEntries(STREAM_STEPS.map(s => [s.id, "pending"])) as Record<string, StepStatus>;
}

export function parseStreamError(err: any): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err.error) return typeof err.error === "string" ? err.error : JSON.stringify(err.error);
  if (err.detail) return typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail);
  return JSON.stringify(err);
}

export function stepIndexFromState(stepState: Record<string, StepStatus>): number {
  // First active step wins
  for (let i = 0; i < STREAM_STEPS.length; i++) {
      const id = STREAM_STEPS[i].id;
      if (stepState[id] === "active") return i;
  }
  // Otherwise: count how many are done in order
  let doneCount = 0;
  for (let i = 0; i < STREAM_STEPS.length; i++) {
      const id = STREAM_STEPS[i].id;
      if (stepState[id] === "done") doneCount++;
      else break;
  }
  return doneCount; // can be STREAM_STEPS.length when fully done
}