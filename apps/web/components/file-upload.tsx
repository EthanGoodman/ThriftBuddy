import React from "react";

type FileUploadCardProps = {
  id: string;

  label: string;
  required?: boolean;

  file: File | null;
  onFileChange: (file: File | null) => void;

  accept?: string;
  disabled?: boolean;

  uploadText?: string;
  changeText?: string;

  hint?: React.ReactNode;
  showMissingMessage?: boolean;
  missingMessage?: React.ReactNode;
  containerClassName?: string;
};

const HEADER_ACTION_BTN_CLASS = [
  "text-xs rounded-lg px-2 py-1",
  "bg-[var(--panel)]",
  "border border-[var(--panel-border)]",
  "text-[var(--foreground)]",
  "hover:bg-[color-mix(in_srgb,var(--panel)_78%,white)]",
].join(" ");

export function FileUploadCard({
  id,
  label,
  required = false,
  file,
  onFileChange,
  accept = "*/*",
  disabled = false,
  uploadText = "Upload file",
  changeText = "Change file",
  hint,
  showMissingMessage = false,
  missingMessage = "This file is required to submit.",
  containerClassName = "",
}: FileUploadCardProps) {
  const isMissing = required && !file;

  return (
    <div
      className={[
        "rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 space-y-2",
        containerClassName,
      ].join(" ")}
    >
      {/* Header: label only */}
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="block text-sm font-semibold text-[var(--foreground)]"
        >
          {label} {required && <span className="text-red-600">*</span>}
        </label>
      </div>

      {/* Row: upload + filename */}
      <div className="mt-2 flex items-center gap-3">
        {/* Only show the upload button when there is NO file */}
        {!file ? (
          <>
            <label
              htmlFor={id}
              className={[
                "inline-flex cursor-pointer items-center justify-center",
                "rounded-lg border border-[var(--panel-border)] px-4 py-2 text-sm font-medium",
                "bg-[var(--accent)]/14 text-[var(--foreground)] hover:bg-[var(--accent)]/20",
                
                disabled ? "opacity-60 cursor-not-allowed" : "",
              ].join(" ")}
            >
              {uploadText}
            </label>
          </>
        ) : (
          // When file exists: show ONLY the filename (no change button)
          <span className="min-w-0 flex-1 text-sm text-[var(--muted)]">
            <span className="block truncate">{file.name}</span>
          </span>
        )}

        <input
          id={id}
          type="file"
          accept={accept}
          onClick={(e) => {
            (e.currentTarget as HTMLInputElement).value = "";
          }}
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          className="hidden"
          disabled={disabled}
        />
      </div>


      {hint ? <div className="text-xs text-[var(--muted)]">{hint}</div> : null}

      {showMissingMessage && isMissing ? (
        <div className="text-xs text-red-700">{missingMessage}</div>
      ) : null}
    </div>
  );
}
