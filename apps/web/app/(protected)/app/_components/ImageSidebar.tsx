import type { Preview, PreviewWithSlot } from "../types";

import { Thumb } from "./Thumb";

type ImageSidebarProps = {
  mainPreview?: Preview;
  extraPreviews: PreviewWithSlot[];
  showExtras?: boolean;
  onOpen: (url: string, name: string) => void;
  onRemoveMain: () => void;
  onRemoveExtra: (slotIndex: number) => void;
};

export function ImageSidebar({
  mainPreview,
  extraPreviews,
  showExtras = true,
  onOpen,
  onRemoveMain,
  onRemoveExtra,
}: ImageSidebarProps) {
  return (
    <div className="sticky top-24 self-start">
      {!mainPreview && extraPreviews.length === 0 ? (
        <div className="text-sm text-[var(--muted)]">No images selected yet.</div>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-[var(--foreground)]">Main Image</div>
              <div className="text-xs text-[var(--muted)]">{mainPreview ? 1 : 0}</div>
            </div>

            {mainPreview ? (
              <Thumb
                p={mainPreview}
                onOpen={() => onOpen(mainPreview.url, mainPreview.name)}
                onRemove={onRemoveMain}
              />
            ) : (
              <div className="text-xs text-[var(--muted)]">No main image selected.</div>
            )}
          </div>

          {showExtras && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-[var(--foreground)]">Extra Images</div>
                <div className="text-xs text-[var(--muted)]">{extraPreviews.length}</div>
              </div>

              {extraPreviews.length ? (
                <div className="grid grid-cols-3 lg:grid-cols-2 gap-2">
                  {extraPreviews.map((p) => (
                    <Thumb
                      key={p.key}
                      p={p}
                      onOpen={() => onOpen(p.url, p.name)}
                      onRemove={() => onRemoveExtra(p.slotIndex)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[var(--muted)]">No extra images selected.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
