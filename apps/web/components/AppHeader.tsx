"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AppHeader() {
  const pathname = usePathname();
  const hideHeader = pathname?.startsWith("/app");

  if (hideHeader) return null;

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--panel-border)]/70 bg-[var(--header-bg)]/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4 md:px-8">
        <Link href="/" className="group inline-flex items-center gap-2 rounded-2xl px-3 py-2 transition hover:bg-[var(--panel-quiet)]">
          <span className="text-2xl font-semibold tracking-[0.02em] text-[var(--foreground)] font-display">
            ThriftBuddy
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] opacity-0 transition group-hover:opacity-100">
            vintage beta
          </span>
        </Link>

        <div className="hidden text-[11px] uppercase tracking-[0.16em] text-[var(--muted)] md:block">
          thrift intel for real-world resale
        </div>
      </div>
    </header>
  );
}
