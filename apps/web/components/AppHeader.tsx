"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Theme = "dark" | "light";

function ThemeToggle({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={[
        "relative inline-flex h-7 w-[64px] items-center rounded-full border shadow-sm transition",
        "border-slate-200 bg-white hover:bg-slate-50",
        "dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60",
      ].join(" ")}
    >
      <span className="absolute left-2 text-xs select-none">moon</span>
      <span className="absolute right-2 text-xs select-none">sun</span>
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

export default function AppHeader() {
  const pathname = usePathname();

  const isLanding = pathname === "/" || pathname === "/login" || pathname === "/register";
  const hideHeader = pathname?.startsWith("/app");

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

  useEffect(() => {
    if (pathname === "/") setTheme("dark");
  }, [pathname]);

  if (hideHeader) return null;

  return (
    <header className="sticky top-0 z-30">
      <div className="relative">
        <div
          className="pointer-events-none absolute inset-x-0 -top-24 h-48
          bg-[radial-gradient(60%_40%_at_20%_0%,rgba(59,130,246,0.18),transparent)]"
        />

        <div
          className={[
            "backdrop-blur-md transition-colors",
            isLanding
              ? theme === "dark"
                ? "bg-transparent"
                : "bg-white/70"
              : theme === "dark"
                ? "bg-slate-950/70"
                : "bg-slate-100",
          ].join(" ")}
        >
          <div className="mx-auto w-full max-w-7xl px-8">
            <div className="flex items-center justify-between py-5">
              <Link
                href="/"
                className="group -ml-2 inline-flex items-center gap-2 rounded-2xl px-3 py-2 transition hover:bg-white/[0.04]"
              >
                <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  <span className="text-blue-600 dark:text-blue-400">Thrift</span>Buddy
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 opacity-0 transition group-hover:opacity-100">
                  beta
                </span>
              </Link>

              <div className="flex items-center gap-3">
                <div className="hidden md:block text-xs text-slate-500/80 dark:text-slate-400/70">
                  minimal - calm - built for resale research
                </div>
                {!isLanding && <ThemeToggle theme={theme} setTheme={setTheme} />}
              </div>
            </div>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-black/10 to-transparent dark:via-white/10" />
      </div>
    </header>
  );
}
