type ThumbProps = {
  p: { url: string; name: string; label: string };
  onOpen: () => void;
  onRemove: () => void;
};

export function Thumb({ p, onOpen, onRemove }: ThumbProps) {
  return (
    <div
      className=" border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 
        group relative aspect-square overflow-hidden rounded-lg bg-transparent"
      title="Click to enlarge"
    >
      <button type="button" onClick={onOpen} className="absolute inset-0">
        <img
          src={p.url}
          alt={p.name}
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-1 right-1 z-10 rounded-md
                    bg-black/60 text-white
                    hover:bg-red-600/80 focus:outline-none
                    focus:ring-2 focus:ring-white/50 aspect-square w-[20px]
                    flex items-center justify-center leading-none"
        aria-label={`Remove ${p.label}`}
        title="Remove"
      >
        <svg viewBox="0 0 24 24" className="h-3 w-3">
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
