import { listingKey } from "@/lib/thrift/listing";
import { fmtMoney } from "@/lib/thrift/format";
import { ListingRemoveX } from "@/components/ListingRemove";
import { ExampleListing } from "@/app/(protected)/app/types";

export function ExampleListingsList({
  listings,
  fullscreen,
  dismissedKeys,
  onDismiss,
  variant = "active",
  maxItems,
}: {
  listings: ExampleListing[];
  fullscreen: boolean;
  dismissedKeys: Set<string>;
  onDismiss: (key: string) => void;
  variant?: "active" | "sold";
  maxItems?: number;
}) {
  const items = listings
    .map((it, idx) => ({ it, idx, key: listingKey(it, idx) }))
    .filter(({ it }) => it.price?.extracted != null)
    .filter(({ key }) => !dismissedKeys.has(key))
    .sort((a, b) => a.it.price!.extracted! - b.it.price!.extracted!)
    .slice(0, typeof maxItems === "number" ? maxItems : 24);

  if (!items.length) {
    return (
      <div className="rounded-2xl panel-strong p-4 text-sm text-muted">
        No example listings available.
      </div>
    );
  }

  const badgeStyles =
    variant === "sold"
      ? "bg-[rgba(205,219,191,0.9)] text-[rgba(61,87,55,0.96)] ring-1 ring-[rgba(88,118,78,0.45)] shadow-sm"
      : "bg-[rgba(229,214,193,0.92)] text-[rgba(94,69,50,0.98)] ring-1 ring-[rgba(127,98,74,0.45)] shadow-sm";

  return (
    <div className={fullscreen ? "space-y-4" : "max-h-[360px] overflow-y-auto scrollbar-clean pr-2"}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(({ it, key }) => (
          <a
            key={key}
            href={it.link || "#"}
            target="_blank"
            rel="noreferrer"
            className="group relative overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-quiet)]/72 transition hover:bg-[color-mix(in_srgb,var(--panel-quiet)_76%,white)]"
          >
            <ListingRemoveX
              ariaLabel="Remove listing"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDismiss(key);
              }}
            />

            <div className="relative w-full overflow-hidden aspect-[3/4]">
              {it.image || it.thumbnail ? (
                <img
                  src={it.image || it.thumbnail}
                  alt={it.title || "listing"}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-muted">
                  no image
                </div>
              )}
              <span
                className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.01em] ${badgeStyles}`}
              >
                {variant === "sold" ? "Sold recently" : "Active listing"}
              </span>
            </div>

            <div className="space-y-2 p-4">
              <div className="text-sm font-semibold text-[var(--foreground)] line-clamp-2">
                {it.title || "Untitled listing"}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted">
                <span className="font-semibold text-[var(--accent)]">
                  {it.price?.extracted != null ? fmtMoney(it.price.extracted) : it.price?.raw ?? "-"}
                </span>
                {it.condition ? <span>{it.condition}</span> : null}
                {it.location ? <span>{it.location}</span> : null}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
