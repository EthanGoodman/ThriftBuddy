"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

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

export default function AuthShell({
  children,
  subtitle = "Minimal · calm · built for resale research",
}: {
  children: React.ReactNode;
  subtitle?: string;
}) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved = (localStorage.getItem("tb_theme") as Theme | null) ?? "dark";
    setTheme(saved);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("tb_theme", theme);
  }, [theme]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      {/* Full-page background effects (same vibe as landing) */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900" />
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-blue-600/12 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0.35)_70%,rgba(0,0,0,0.62)_100%)]" />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-8">
        {/* top row */}
        <div className="pt-6 flex items-center justify-between">
          <div className="text-sm text-slate-300/70">{subtitle}</div>
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>

        {/* center stage */}
        <div className="min-h-[calc(100vh-96px)] grid items-center">{children}</div>

        <div className="h-10" />
      </div>
    </div>
  );
}
