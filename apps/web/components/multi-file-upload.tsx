import React from "react";

type MultiFileUploadCardProps = {
  title: string;
  files: (File | null)[];
  onChangeAt: (index: number, file: File | null) => void;

  onAdd: () => void;
  onRemove: (index: number) => void;

  onClearAll: () => void;

  accept?: string;
  disabled?: boolean;

  addText?: string;
  removeText?: string;

  hint?: React.ReactNode;
  idPrefix?: string;

  hideClearAllWhenEmpty?: boolean;
};

const HEADER_ACTION_BTN_CLASS = [
  "text-xs rounded-lg px-2 py-1",
  "bg-[var(--panel)]",
  "border border-[var(--panel-border)]",
  "text-[var(--foreground)]",
  "hover:bg-[color-mix(in_srgb,var(--panel)_78%,white)]",
].join(" ");


export function MultiFileUploadCard({
  title,
  files,
  onChangeAt,
  onAdd,
  accept = "image/*",
  disabled = false,
  addText = "+ Add",
  hint,
  idPrefix = "file-slot",
  hideClearAllWhenEmpty = true,
}: MultiFileUploadCardProps) {
  const anySelected = files.some((f) => !!f);

  return (
    <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-[var(--foreground)]">
          {title}
        </div>
      </div>
      {/* Rows */}
        {(() => {
          const emptyIdx = files.findIndex((f) => f == null); // should exist due to setSlotFile
          const selected = files
            .map((f, idx) => ({ f, idx }))
            .filter((x): x is { f: File; idx: number } => x.f != null);

          const emptyId = `${idPrefix}-${emptyIdx}`;

          return (
            <div className="space-y-2">
              {/* The ONE "Add image" button row */}
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="flex items-center gap-3 min-w-0">
                  <label
                    htmlFor={emptyId}
                    className={[
                      "inline-flex cursor-pointer items-center justify-center",
                      "rounded-lg border border-[var(--panel-border)] px-4 py-2 text-sm font-medium",
                      "bg-[var(--accent)]/14 text-[var(--foreground)] hover:bg-[var(--accent)]/20",
                      
                      disabled ? "opacity-60 cursor-not-allowed" : "",
                    ].join(" ")}
                  >
                    Add image
                  </label>

                  <input
                    id={emptyId}
                    type="file"
                    accept={accept}
                    onClick={(e) => {
                      (e.currentTarget as HTMLInputElement).value = "";
                    }}
                    onChange={(e) => onChangeAt(emptyIdx, e.target.files?.[0] ?? null)}
                    className="hidden"
                    disabled={disabled}
                  />
                </div>
              </div>

              {/* Filenames listed BELOW the Add button */}
              {selected.length ? (
                <div className="space-y-2">
                  <div className="text-xs text-[var(--muted)]">
                    Added Images
                  </div>
                  {selected.map(({ f, idx }, i) => (
                    <div
                      key={`${idPrefix}-file-${idx}`}
                      className="flex items-center justify-between gap-3 rounded-lg"
                    >
                      <div className="min-w-0">
                        <div className="text-sm text-[var(--foreground)] truncate">
                          {f.name}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })()}
      {hint ? <div className="text-xs text-[var(--muted)]">{hint}</div> : null}
    </div>
  );
}
