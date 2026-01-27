import React, { useEffect, useId, useState } from "react";
import { Card } from "@/app/(protected)/app/page"


const UTILITY_BTN_CLASS =
  "text-xs rounded-lg px-2 py-1 border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 " +
  "dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-700";

export function FullscreenCard({
  title,
  right,
  children,
  maxWidthClass = "max-w-6xl",
  buttonText = "Fullscreen",
}: {
  title: string;
  right?: React.ReactNode;
  children: (ctx: { fullscreen: boolean }) => React.ReactNode;
  maxWidthClass?: string;
  buttonText?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card
        title={title}
        right={
          <div className="flex items-center gap-2">
            {right}
            <button type="button" onClick={() => setOpen(true)} className={UTILITY_BTN_CLASS}>
              {buttonText}
            </button>
          </div>
        }
      >
        {children({ fullscreen: false })}
      </Card>

      {open ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close fullscreen"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60"
          />

          <div className="absolute inset-0 p-4 sm:p-8">
            <div
              className={[
                "mx-auto h-full rounded-2xl bg-white shadow-xl ring-1 ring-black/5 dark:bg-slate-900 dark:ring-white/10 flex flex-col",
                maxWidthClass,
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 dark:border-slate-800/70 px-5 py-4">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
                <button type="button" onClick={() => setOpen(false)} className={UTILITY_BTN_CLASS}>
                  Close
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-auto p-5">
                {children({ fullscreen: true })}
              </div>
            </div>
          </div>

          <EscToClose onClose={() => setOpen(false)} />
        </div>
      ) : null}
    </>
  );
}


function EscToClose({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);
  return null;
}
