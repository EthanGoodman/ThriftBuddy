export function StepColumn({
  title,
  steps,
  isLoading,
  isDone,
}: {
  title: string;
  steps: { id: string; label: string }[];
  isLoading: boolean;
  isDone: boolean;
}) {
  return (
    <div className="w-full">
      <div className="mb-1 text-[11px] font-semibold text-[var(--muted)]">{title}</div>
      <div className="mb-2 text-xs font-semibold text-[var(--foreground)]">Current step</div>

      {isLoading && (
        <ul className="w-full space-y-2 text-left">
          {steps.map((s) => {
            const isActive = s.id.endsWith(":active");

            return (
              <li
                key={s.id}
                className={[
                  "flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 transition",
                  isActive
                    ? "border-[rgba(132,98,72,0.44)] bg-[rgba(233,216,191,0.92)] shadow-[0_6px_14px_rgba(94,67,48,0.12)]"
                    : "border-[rgba(132,98,72,0.26)] bg-[rgba(235,219,195,0.72)]",
                ].join(" ")}
              >
                <span
                  className={[
                    "grid place-items-center h-5 w-5 rounded-full border text-xs shrink-0",
                    isActive
                      ? "border-[rgba(128,94,69,0.62)] bg-[rgba(160,112,76,0.2)] text-[rgba(126,87,57,0.98)] animate-pulse"
                      : "border-[rgba(103,129,92,0.58)] bg-[rgba(103,129,92,0.14)] text-[rgba(87,112,78,0.98)]",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  {isActive ? (
                    <svg
                        width="6"
                        height="6"
                        viewBox="0 0 6 6"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <circle cx="3" cy="3" r="2" fill="currentColor" />
                    </svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M2 6.5L4.5 9L10 3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>

                <span
                  className={[
                    "text-xs",
                    isActive ? "text-[var(--foreground)] animate-pulse" : "text-[var(--foreground)]",
                  ].join(" ")}
                >
                  {s.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {!isLoading && isDone && (
        <div className="mt-2 inline-flex items-center gap-2">
          <span className="rounded-full bg-[rgba(103,129,92,0.14)] px-2 py-0.5 text-[11px] text-[rgba(87,112,78,0.98)] ring-1 ring-[rgba(103,129,92,0.28)]">
            Done
          </span>
        </div>
      )}
    </div>
  );
}
