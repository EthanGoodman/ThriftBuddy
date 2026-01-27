"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Theme = "dark" | "light";

const DEMO_STEPS = [
  "Identifying the item",
  "Searching marketplaces",
  "Analyzing marketplace images",
  "Improving the search",
  "Finding better matches",
] as const;

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M2 6.5L4.5 9L10 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

function ThemeToggle({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={[
        "relative inline-flex h-7 w-[64px] items-center rounded-full border shadow-sm transition",
        "border-slate-300 bg-white hover:bg-slate-50",
        "dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60",
      ].join(" ")}
    >
      <span className="absolute left-2 text-xs select-none">🌙</span>
      <span className="absolute right-2 text-xs select-none">☀️</span>
      <span
        className={[
          "absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full shadow transition-transform",
          "bg-slate-900 dark:bg-white",
          theme === "dark" ? "translate-x-[4px]" : "translate-x-[36px]",
        ].join(" ")}
      />
    </button>
  );
}

const TAGLINES = [
  "Identify items from a photo.",
  "Find comps from sold listings.",
  "Refine matches with extra angles.",
  "Price with confidence — fast.",
] as const;

function useTypewriter(
  phrases: readonly string[],
  opts?: { typeMs?: number; deleteMs?: number; holdMs?: number; pauseBetweenMs?: number }
) {
  const typeMs = opts?.typeMs ?? 35;
  const deleteMs = opts?.deleteMs ?? 22;
  const holdMs = opts?.holdMs ?? 900;
  const pauseBetweenMs = opts?.pauseBetweenMs ?? 220;

  const [idx, setIdx] = useState(0);
  const [sub, setSub] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const phrase = phrases[idx] ?? "";
    let t: any;

    if (!deleting) {
      if (sub < phrase.length) {
        t = setTimeout(() => setSub((s) => s + 1), typeMs);
      } else {
        t = setTimeout(() => setDeleting(true), holdMs);
      }
    } else {
      if (sub > 0) {
        t = setTimeout(() => setSub((s) => s - 1), deleteMs);
      } else {
        t = setTimeout(() => {
          setDeleting(false);
          setIdx((i) => (i + 1) % phrases.length);
        }, pauseBetweenMs);
      }
    }

    return () => clearTimeout(t);
  }, [phrases, idx, sub, deleting, typeMs, deleteMs, holdMs, pauseBetweenMs]);

  const text = (phrases[idx] ?? "").slice(0, sub);
  return { text, idx };
}

function TypeLine() {
  const { text } = useTypewriter(TAGLINES, {
    typeMs: 55,
    deleteMs: 32,
    holdMs: 1400,
    pauseBetweenMs: 400,
  });

  return (
    <div className="mt-4 flex items-center gap-2 text-lg text-slate-300 leading-relaxed">
      <span className="text-blue-300/90">›</span>
      <span className="min-h-[28px]">
        {text}
        <span className="inline-block w-[10px] translate-y-[2px] animate-[caretBlink_1s_steps(2)_infinite] text-slate-200">
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
    const t = setInterval(() => {
      setActiveIdx((i) => (i + 1) % DEMO_STEPS.length);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const done = useMemo(() => {
    return new Set<number>(Array.from({ length: activeIdx }, (_, i) => i));
  }, [activeIdx]);

  return (
    <div className="mt-7">
      <div className="text-xs font-semibold text-slate-300/90 mb-3">Live pipeline preview</div>

      <ul className="space-y-2.5">
        {DEMO_STEPS.map((label, idx) => {
          const isActive = idx === activeIdx;
          const isDone = done.has(idx);

          return (
            <li key={label} className="flex items-center gap-2.5">
              <span
                className={[
                  "grid place-items-center h-5 w-5 rounded-full border text-xs shrink-0",
                  "bg-white/[0.02]",
                  isActive
                    ? "border-blue-400/70 text-blue-400 animate-[softPulse_1.8s_ease-in-out_infinite]"
                    : isDone
                    ? "border-emerald-400/70 text-emerald-400"
                    : "border-white/10 text-slate-500",
                ].join(" ")}
                aria-hidden="true"
              >
                {isActive ? <DotIcon /> : isDone ? <CheckIcon /> : null}
              </span>

              <span
                className={[
                  "text-sm",
                  isActive
                    ? "text-slate-200 animate-[softPulseText_1.8s_ease-in-out_infinite]"
                    : isDone
                    ? "text-slate-200/90"
                    : "text-slate-400/80",
                ].join(" ")}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ul>

      <style jsx>{`
        @keyframes softPulse {
          0% {
            transform: scale(1);
            opacity: 0.85;
          }
          50% {
            transform: scale(1.05);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 0.85;
          }
        }
        @keyframes softPulseText {
          0% {
            opacity: 0.75;
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0.75;
          }
        }
      `}</style>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_BASE_URL!;

  const [theme, setTheme] = useState<Theme>("dark");
  const [entering, setEntering] = useState(false);

  // load saved theme once (default dark)
  useEffect(() => {
    const saved = (localStorage.getItem("tb_theme") as Theme | null) ?? "dark";
    setTheme(saved);
  }, []);

  // apply theme to <html> via Tailwind "dark" class
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("tb_theme", theme);
  }, [theme]);

  async function enterApp() {
    if (entering) return;
    setEntering(true);
    try {
      // Track unique visitor (sets tb_vid cookie + inserts into DB)
      await fetch(`${API}/track`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // If tracking fails, still let them in
    } finally {
      router.push("/app");
      // no need to setEntering(false) since we navigate away
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      {/* Full-page background effects */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900" />
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-blue-600/12 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0.35)_70%,rgba(0,0,0,0.62)_100%)]" />
      </div>

      {/* Content wrapper */}
      <div className="relative mx-auto w-full max-w-7xl px-8">
        {/* Hero section: vertically centered */}
        <div className="min-h-[calc(100vh-120px)] grid items-center">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-14 items-center">
            {/* LEFT */}
            <div className="max-w-xl">
              <h1 className="text-6xl md:text-7xl font-semibold tracking-tight text-slate-100">
                <span className="text-blue-400"> Understand true{" "}</span>
                resale value
              </h1>

              <TypeLine />

              <DemoSteps />

              <div className="mt-7 text-sm text-slate-400/90">Photo → match → comps</div>
            </div>

            {/* RIGHT */}
            <div className="flex md:justify-end">
              <div className="w-full max-w-md rounded-3xl px-8 py-8 backdrop-blur-xl bg-white/[0.045] ring-1 ring-white/10 relative overflow-hidden">
                {/* subtle moving glow */}
                <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl animate-[floatGlow_10s_ease-in-out_infinite]" />
                <div className="pointer-events-none absolute -bottom-28 -right-28 h-72 w-72 rounded-full bg-emerald-400/8 blur-3xl animate-[floatGlow2_12s_ease-in-out_infinite]" />

                <div className="relative">
                  {/* Header + chip */}
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                      <div className="text-base font-semibold text-slate-100">Welcome</div>
                      <div className="text-sm text-slate-400">Jump into the app — no account needed.</div>
                    </div>

                    <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3 py-1 text-xs text-slate-300 ring-1 ring-white/10">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50 animate-ping" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                      </span>
                      open access
                    </div>
                  </div>

                  {/* Primary action with glow */}
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-0 rounded-2xl bg-blue-500/20 blur-xl opacity-70" />
                    <button
                      type="button"
                      onClick={enterApp}
                      disabled={entering}
                      className={[
                        "relative w-full rounded-2xl px-5 py-3 text-sm font-semibold text-white transition",
                        entering ? "bg-blue-500/70 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-400",
                      ].join(" ")}
                    >
                      {entering ? "Entering..." : "Enter the app"}
                    </button>
                  </div>

                  {/* Secondary (optional) */}
                  <div className="mt-4 text-xs text-slate-400">
                    We use a single anonymous cookie to count unique visitors.
                  </div>
                </div>

                <style jsx>{`
                  @keyframes floatGlow {
                    0% {
                      transform: translate(0px, 0px);
                      opacity: 0.65;
                    }
                    50% {
                      transform: translate(22px, 12px);
                      opacity: 0.85;
                    }
                    100% {
                      transform: translate(0px, 0px);
                      opacity: 0.65;
                    }
                  }
                  @keyframes floatGlow2 {
                    0% {
                      transform: translate(0px, 0px);
                      opacity: 0.55;
                    }
                    50% {
                      transform: translate(-18px, -10px);
                      opacity: 0.75;
                    }
                    100% {
                      transform: translate(0px, 0px);
                      opacity: 0.55;
                    }
                  }
                `}</style>
              </div>
            </div>
          </div>
        </div>

        <div className="h-10" />
      </div>
    </div>
  );
}
