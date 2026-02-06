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
        "border border-white/10",
        !checked
          ? [
              "bg-white/5 text-white/80 hover:bg-white/10",
            ].join(" ")
          : [
              "bg-blue-500/20 text-white border-blue-400/40 hover:bg-blue-500/30",
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
            : "bg-transparent border-white/20",
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
