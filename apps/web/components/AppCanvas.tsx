"use client";

import { usePathname } from "next/navigation";

export default function AppCanvas() {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  return (
    <div className="pointer-events-none fixed inset-0 vintage-canvas" aria-hidden="true">
      <div className="vintage-canvas__base" />
      <div className={isLanding ? "vintage-canvas__wash is-landing" : "vintage-canvas__wash"} />
      <div className="vintage-canvas__grain" />
      <div className="vintage-canvas__vignette" />
    </div>
  );
}
