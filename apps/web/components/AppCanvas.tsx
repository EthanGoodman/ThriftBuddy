"use client";

import { usePathname } from "next/navigation";

export default function AppCanvas() {
  const pathname = usePathname();

  // Adjust this if your landing route is not "/"
  const isLanding = pathname === "/";

  return (
    <div className="pointer-events-none fixed inset-0">
      {/* Base */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900" />

      {/* Glow blobs (stronger on landing, weaker in app) */}
      <div
        className={[
          "absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-blue-600 blur-3xl",
          isLanding ? "opacity-12" : "opacity-5",
        ].join(" ")}
      />
      <div
        className={[
          "absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-emerald-500 blur-3xl",
          isLanding ? "opacity-10" : "opacity-4",
        ].join(" ")}
      />

      {/* Vignette (keep fairly consistent; slightly lighter on landing if you want) */}
      <div
        className={[
          "absolute inset-0",
          "bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0.35)_70%,rgba(0,0,0,0.62)_100%)]",
          isLanding ? "opacity-100" : "opacity-100",
        ].join(" ")}
      />
    </div>
  );
}
