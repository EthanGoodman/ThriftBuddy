export function CheckboxChip({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition",
        "border shadow-sm",
        !checked
          ? [
              "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
              "dark:bg-slate-900/40 dark:text-slate-200 dark:border-slate-800 dark:hover:bg-slate-800/60",
            ].join(" ")
          : [
              "bg-blue-600/10 text-slate-900 border-blue-500/30 hover:bg-blue-600/15",
              "dark:bg-blue-600/20 dark:text-slate-100 dark:border-blue-400/40 dark:hover:bg-blue-600/25",
            ].join(" "),
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60",
        disabled ? "opacity-60 cursor-not-allowed" : "",
      ].join(" ")}
      aria-pressed={checked}
    >
      {/* checkbox box */}
      <span
        className={[
          "grid place-items-center h-5 w-5 rounded-md border transition",
          checked
            ? "bg-blue-500 border-blue-400/60"
            : "bg-transparent border-slate-300 dark:border-white/20",
        ].join(" ")}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 20 20"
          className={[
            "h-3.5 w-3.5 transition",
            checked ? "text-white opacity-100" : "text-white opacity-0",
          ].join(" ")}
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M16.704 5.29a1 1 0 010 1.415l-7.25 7.25a1 1 0 01-1.415 0l-3.25-3.25a1 1 0 011.415-1.415l2.543 2.543 6.543-6.543a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </span>

      <span className="leading-none">{label}</span>
    </button>
  );
}