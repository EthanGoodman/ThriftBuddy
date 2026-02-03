import {listingKey} from "@/lib/thrift/listing"
import {fmtMoney} from "@/lib/thrift/format"
import {ListingRemoveX} from "@/components/ListingRemove"
import { ExampleListing } from "@/app/(protected)/app/types";

export function ExampleListingsList({
  listings,
  fullscreen,
  dismissedKeys,
  onDismiss,
}: {
  listings: ExampleListing[];
  fullscreen: boolean;
  dismissedKeys: Set<string>;
  onDismiss: (key: string) => void;
}) {
  const items = listings
    .map((it, idx) => ({ it, idx, key: listingKey(it, idx) }))
    .filter(({ it }) => it.price?.extracted != null)
    .filter(({ key }) => !dismissedKeys.has(key))
    .sort((a, b) => a.it.price!.extracted! - b.it.price!.extracted!)
    .slice(0, 51);

  if (!items.length) {
    return (
      <div className="text-sm text-slate-600 dark:text-slate-300">
        No example listings available.
      </div>
    );
  }

  return (
    <div
      className={[
        fullscreen ? "h-full" : "max-h-[280px]",
        "overflow-y-auto scrollbar-clean [scrollbar-gutter:stable] pr-3",
      ].join(" ")}
    >
      <div className="grid gap-4 grid-cols-1">
        {items.map(({ it, key }) => (
          <a
            key={key}
            href={it.link || "#"}
            target="_blank"
            rel="noreferrer"
            className={[
              "group relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-50 transition dark:bg-slate-900",
              fullscreen ? "py-4 pl-4 pr-10" : "py-3 pl-3 pr-9",
            ].join(" ")}
          >
            <ListingRemoveX
              ariaLabel="Remove listing"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDismiss(key);
              }}
            />

            <div className="flex gap-4">
              <div
                className={[
                  "rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700",
                  fullscreen ? "h-24 w-24" : "h-16 w-16",
                ].join(" ")}
              >
                {it.thumbnail ? (
                  <img
                    src={it.thumbnail}
                    alt={it.title || "listing"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">
                    no img
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div
                  className={[
                    "font-medium text-slate-900 dark:text-slate-200 line-clamp-2",
                    fullscreen ? "text-base" : "text-sm",
                  ].join(" ")}
                >
                  {it.title || "Untitled listing"}
                </div>

                <div
                  className={[
                    "mt-1 text-slate-600 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-1",
                    fullscreen ? "text-sm" : "text-xs",
                  ].join(" ")}
                >
                  <span className="font-semibold">
                    {it.price?.extracted != null ? fmtMoney(it.price.extracted) : it.price?.raw ?? "—"}
                  </span>
                  {it.condition ? <span className="text-slate-500">{it.condition}</span> : null}
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
