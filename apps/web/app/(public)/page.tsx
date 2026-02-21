"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const DEMO_STEPS = [
  "Identify item details",
  "Scan marketplace comps",
  "Compare condition and photos",
  "Refine to best matches",
  "Estimate resale range",
] as const;

const TAGLINES = [
  "Snap it. Name it. Price it.",
  "Built for thrift finds and flips.",
  "Warm, practical resale research.",
  "From dusty rack to clear value.",
] as const;

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M2 6.5L4.5 9L10 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DotIcon() {
  return (
    <svg width="6" height="6" viewBox="0 0 6 6" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="3" cy="3" r="2" fill="currentColor" />
    </svg>
  );
}

function useTypewriter(
  phrases: readonly string[],
  opts?: { typeMs?: number; deleteMs?: number; holdMs?: number; pauseBetweenMs?: number },
) {
  const typeMs = opts?.typeMs ?? 46;
  const deleteMs = opts?.deleteMs ?? 26;
  const holdMs = opts?.holdMs ?? 1050;
  const pauseBetweenMs = opts?.pauseBetweenMs ?? 240;

  const [idx, setIdx] = useState(0);
  const [sub, setSub] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const phrase = phrases[idx] ?? "";
    let t: ReturnType<typeof setTimeout>;

    if (!deleting) {
      if (sub < phrase.length) t = setTimeout(() => setSub((s) => s + 1), typeMs);
      else t = setTimeout(() => setDeleting(true), holdMs);
    } else {
      if (sub > 0) t = setTimeout(() => setSub((s) => s - 1), deleteMs);
      else {
        t = setTimeout(() => {
          setDeleting(false);
          setIdx((i) => (i + 1) % phrases.length);
        }, pauseBetweenMs);
      }
    }

    return () => clearTimeout(t);
  }, [phrases, idx, sub, deleting, typeMs, deleteMs, holdMs, pauseBetweenMs]);

  return (phrases[idx] ?? "").slice(0, sub);
}

function TypeLine() {
  const text = useTypewriter(TAGLINES);

  return (
    <div className="mt-4 flex items-center gap-2 text-lg leading-relaxed text-[var(--foreground)]/90">
      <span className="text-[var(--accent)]">{">"}</span>
      <span className="min-h-[28px]">
        {text}
        <span className="inline-block w-[10px] translate-y-[2px] animate-[caretBlink_1s_steps(2)_infinite] text-[var(--foreground)]">
          |
        </span>
      </span>

      <style jsx>{`
        @keyframes caretBlink {
          0%,
          49% {
            opacity: 1;
          }
          50%,
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

function DemoSteps() {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActiveIdx((i) => (i + 1) % DEMO_STEPS.length), 3600);
    return () => clearInterval(t);
  }, []);

  const done = useMemo(() => new Set<number>(Array.from({ length: activeIdx }, (_, i) => i)), [activeIdx]);

  return (
    <div className="mt-7">
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Live thrift workflow</div>
      <ul className="space-y-2.5">
        {DEMO_STEPS.map((label, idx) => {
          const isActive = idx === activeIdx;
          const isDone = done.has(idx);
          return (
            <li key={label} className="flex items-center gap-2.5">
              <span
                className={[
                  "grid h-5 w-5 shrink-0 place-items-center rounded-full border text-xs",
                  isActive
                    ? "border-[var(--accent)] text-[var(--accent)] animate-[softPulse_1.8s_ease-in-out_infinite]"
                    : isDone
                      ? "border-[var(--success)] text-[var(--success)]"
                      : "border-[var(--panel-border)] text-[var(--muted)]",
                ].join(" ")}
                aria-hidden="true"
              >
                {isActive ? <DotIcon /> : isDone ? <CheckIcon /> : null}
              </span>
              <span className={isActive || isDone ? "text-sm text-[var(--foreground)]" : "text-sm text-[var(--muted)]"}>{label}</span>
            </li>
          );
        })}
      </ul>
      <style jsx>{`
        @keyframes softPulse {
          0% { transform: scale(1); opacity: 0.82; }
          50% { transform: scale(1.06); opacity: 1; }
          100% { transform: scale(1); opacity: 0.82; }
        }
      `}</style>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_BASE_URL!;
  const [entering, setEntering] = useState(false);

  async function enterApp() {
    if (entering) return;
    setEntering(true);
    try {
      await fetch(`${API}/auth/track`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Continue to app even if tracking fails.
    } finally {
      router.push("/app");
    }
  }

  return (
    <div className="min-h-screen vintage-landing">
      <div className="relative mx-auto w-full max-w-7xl px-6 md:px-8">
        <div className="grid min-h-[calc(100vh-120px)] items-center">
          <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2">
            <div className="max-w-xl">
              <h1 className="font-display text-5xl font-semibold tracking-tight text-[var(--foreground)] md:text-7xl">
                Find true value in every thrifted piece
              </h1>

              <TypeLine />
              <DemoSteps />

              <div className="mt-7 text-sm uppercase tracking-[0.18em] text-[var(--muted)]">photo {">"} match {">"} comps</div>
            </div>

            <div className="flex md:justify-end">
              <div className="vintage-panel w-full max-w-md rounded-3xl px-8 py-8">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <div className="text-base font-semibold text-[var(--foreground)]">Welcome</div>
                    <div className="text-sm text-[var(--muted)]">Jump into the app with no signup friction.</div>
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-full border border-[var(--panel-border)] bg-[var(--panel-quiet)] px-3 py-1 text-xs text-[var(--muted)]">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-50 animate-ping" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--success)]" />
                    </span>
                    open access
                  </div>
                </div>

                <button
                  type="button"
                  onClick={enterApp}
                  disabled={entering}
                  className={[
                    "w-full rounded-2xl px-5 py-3 text-sm font-semibold transition",
                    entering
                      ? "cursor-not-allowed bg-[var(--accent)]/70 text-[#f9f1e2]"
                      : "bg-[var(--accent)] text-[#f9f1e2] hover:bg-[var(--accent-strong)]",
                  ].join(" ")}
                >
                  {entering ? "Entering..." : "Enter the app"}
                </button>

                <div className="mt-4 text-xs text-[var(--muted)]">
                  We only use one anonymous cookie to count unique visitors.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="h-10" />
      </div>
    </div>
  );
}
