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
      <div className="text-xs font-semibold text-muted mb-2">
        Current step
      </div>

      {isLoading && (
        <ul className="space-y-2 w-full text-left">
          {steps.map((s) => {
            const isActive = s.id.endsWith(":active");

            return (
              <li key={s.id} className="flex items-center gap-2 w-full">
                <span
                  className={[
                    "grid place-items-center h-5 w-5 rounded-full border text-xs shrink-0",
                    isActive
                      ? "border-blue-400/70 text-blue-300 animate-pulse"
                      : "border-emerald-400/70 bg-emerald-500/10 text-emerald-300",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  {isActive ? (<svg
                        width="6"
                        height="6"
                        viewBox="0 0 6 6"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <circle cx="3" cy="3" r="2" fill="currentColor" />
                      </svg> )
                  : (<svg width="10" height="10" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
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
                    isActive ? "text-muted animate-pulse" : "text-white",
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
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400">
            Done
          </span>
        </div>
      )}
    </div>
  );
}
