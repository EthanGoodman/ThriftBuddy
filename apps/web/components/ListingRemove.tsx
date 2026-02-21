export function ListingRemoveX({
  onClick,
  ariaLabel,
}: {
  onClick: (e: React.MouseEvent) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={[
        "listing-remove-btn absolute top-2 right-2 z-10",
        "inline-flex items-center justify-center gap-0 overflow-hidden",
        "h-8 w-8 rounded-full px-0",
        "bg-[rgba(66,47,33,0.8)] text-[#f8ebd7]",
        "hover:bg-[rgba(122,71,59,0.9)] hover:text-[#fff7ea]",
        "active:scale-[0.98] transition",
        "hover:w-[5.9rem] hover:justify-start hover:gap-1.5 hover:px-2.5",
        "focus-visible:w-[5.9rem] focus-visible:justify-start focus-visible:gap-1.5 focus-visible:px-2.5",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-[#d8c4a5]",
      ].join(" ")}
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
        <path d="M9 3h6l1 2h4v2H4V5h4l1-2Z" fill="currentColor" />
        <path d="M7 7h10l-.8 13.2a1 1 0 0 1-1 .8H8.8a1 1 0 0 1-1-.8L7 7Z" fill="currentColor" opacity="0.92" />
        <path d="M10 10v8M14 10v8" stroke="#f5e8d5" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span className="listing-remove-label w-0 overflow-hidden whitespace-nowrap text-[10px] font-semibold leading-none opacity-0 transition-all duration-150">
        Remove
      </span>
    </button>
  );
}
