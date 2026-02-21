export function ListingRemoveX({
  onClick,
  ariaLabel,
  title = "Remove",
}: {
  onClick: (e: React.MouseEvent) => void;
  ariaLabel: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      className={[
        "absolute top-2 right-2 z-10",
        "inline-flex items-center justify-center",
        "h-6 w-6 rounded-md", // click target
        "bg-[rgba(54,38,27,0.58)]",
        "text-[#f8ebd7] hover:text-[#fff7ea]",
        "hover:bg-red-500/75",
        "active:scale-95 transition",
        // important: only show ring for keyboard focus
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-[#c8a57d]",
      ].join(" ")}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path
          d="M6 6l12 12M18 6L6 18"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
