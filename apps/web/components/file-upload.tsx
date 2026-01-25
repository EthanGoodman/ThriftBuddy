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
  "bg-white dark:border-slate-800 dark:bg-slate-800/60",
  "border border-slate-200",
  "text-slate-700 dark:text-slate-200",
  "hover:bg-slate-100 dark:hover:bg-slate-700",
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
        "rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-4 space-y-2",
        containerClassName,
      ].join(" ")}
    >
      {/* Header: label only */}
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
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
                "rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium",
                "bg-slate-200 text-slate-800 hover:bg-slate-300",
                "dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-700",
                disabled ? "opacity-60 cursor-not-allowed" : "",
              ].join(" ")}
            >
              {uploadText}
            </label>
          </>
        ) : (
          // When file exists: show ONLY the filename (no change button)
          <span className="min-w-0 flex-1 text-sm text-slate-600 dark:text-slate-300">
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


      {hint ? <div className="text-xs text-slate-600">{hint}</div> : null}

      {showMissingMessage && isMissing ? (
        <div className="text-xs text-red-700">{missingMessage}</div>
      ) : null}
    </div>
  );
}
