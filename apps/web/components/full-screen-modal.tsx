import React, { useEffect, useId, useState } from "react";
import { Card } from "@/components/Card"
import { createPortal } from "react-dom";


const UTILITY_BTN_CLASS =
  "text-xs rounded-lg px-2 py-1 border border-[var(--panel-border)] bg-[var(--panel)] text-[var(--foreground)] hover:bg-[color-mix(in_srgb,var(--panel)_78%,white)]";

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

      {open && typeof window !== "undefined"
  ? createPortal(
      <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
        <button
          type="button"
          aria-label="Close fullscreen"
          onClick={() => setOpen(false)}
          className="absolute inset-0 bg-[rgba(44,29,19,0.48)]"
        />

        <div className="absolute inset-0 p-4 sm:p-8">
          <div
            className={[
              "mx-auto h-full rounded-2xl bg-[var(--panel)] shadow-xl ring-1 ring-[var(--panel-border)] flex flex-col",
              maxWidthClass,
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--panel-border)]/75 px-5 py-4">
              <h3 className="text-base font-semibold text-[var(--foreground)]">{title}</h3>
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
      </div>,
      document.body
    )
  : null}

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
