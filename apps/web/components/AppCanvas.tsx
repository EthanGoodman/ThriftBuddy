"use client";

import { usePathname } from "next/navigation";

export default function AppCanvas() {
  const pathname = usePathname();

  // Adjust this if your landing route is not "/"
  const isLanding = pathname === "/";

  return (
    <div className="pointer-events-none fixed inset-0">
      {/* Base */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(30,41,89,0.65),_rgba(6,10,26,1)_50%,_rgba(4,7,18,1)_100%)]" />

      {/* Subtle starfield */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(rgba(148,163,184,0.18) 1px, transparent 1px)",
          backgroundSize: "120px 120px",
        }}
      />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(rgba(99,102,241,0.2) 1px, transparent 1px)",
          backgroundSize: "260px 260px",
        }}
      />

      {/* Glow blobs (stronger on landing, weaker in app) */}
      <div
        className={[
          "absolute -top-48 -left-48 h-[560px] w-[560px] rounded-full bg-blue-500 blur-[140px]",
          isLanding ? "opacity-25" : "opacity-12",
        ].join(" ")}
      />
      <div
        className={[
          "absolute -bottom-56 -right-52 h-[620px] w-[620px] rounded-full bg-cyan-500 blur-[160px]",
          isLanding ? "opacity-18" : "opacity-10",
        ].join(" ")}
      />

      {/* Vignette (keep fairly consistent; slightly lighter on landing if you want) */}
      <div
        className={[
          "absolute inset-0",
          "bg-[radial-gradient(ellipse_at_center,rgba(8,12,24,0)_0%,rgba(5,8,20,0.4)_70%,rgba(3,5,12,0.75)_100%)]",
          isLanding ? "opacity-100" : "opacity-100",
        ].join(" ")}
      />
    </div>
  );
}
