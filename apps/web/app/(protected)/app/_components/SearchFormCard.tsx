import { FileUploadCard } from "@/components/file-upload";
import { MultiFileUploadCard } from "@/components/multi-file-upload";
import { CheckboxChip } from "@/components/CheckboxChip";
import { truncate } from "@/lib/thrift/format";

type SearchFormCardProps = {
  hasRunOnce: boolean;
  collapseForm: boolean;
  setCollapseForm: (value: boolean) => void;
  anyBusy: boolean;
  submitAttempted: boolean;
  mainImage: File | null;
  setMainImage: (file: File | null) => void;
  files: (File | null)[];
  addSlot: () => void;
  removeSlot: (index: number) => void;
  setSlotFile: (index: number, file: File | null) => void;
  clearAllSlots: () => void;
  itemName: string;
  setItemName: (value: string) => void;
  textInput: string;
  setTextInput: (value: string) => void;
  runActive: boolean;
  setRunActive: (value: boolean) => void;
  runSold: boolean;
  setRunSold: (value: boolean) => void;
  onRun: () => void | Promise<void>;
  activeError: string;
  soldError: string;
};

export function SearchFormCard({
  hasRunOnce,
  collapseForm,
  setCollapseForm,
  anyBusy,
  submitAttempted,
  mainImage,
  setMainImage,
  files,
  addSlot,
  removeSlot,
  setSlotFile,
  clearAllSlots,
  itemName,
  setItemName,
  textInput,
  setTextInput,
  runActive,
  setRunActive,
  runSold,
  setRunSold,
  onRun,
  activeError,
  soldError,
}: SearchFormCardProps) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-black/5 space-y-5 dark:bg-slate-900 dark:ring-white/10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          <span className="text-blue-700 dark:text-blue-400">Thrift</span>Buddy
        </h1>
        <div className="flex items-center gap-2">
          {hasRunOnce &&
            (collapseForm ? (
              <button
                type="button"
                onClick={() => setCollapseForm(false)}
                disabled={anyBusy}
                className={[
                  "rounded-lg px-3 py-1.5 text-xs font-semibold border transition",
                  "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 dark:border-slate-800",
                  anyBusy ? "opacity-60 cursor-not-allowed" : "",
                ].join(" ")}
              >
                Edit
              </button>
            ) : (
              <button
                onClick={() => setCollapseForm(true)}
                className={[
                  "rounded-lg px-3 py-1.5 text-xs font-semibold border transition",
                  "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 dark:border-slate-800",
                  anyBusy ? "opacity-60 cursor-not-allowed" : "",
                ].join(" ")}
              >
                Collapse Form
              </button>
            ))}
        </div>
      </div>

      {!collapseForm && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Images</div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  Main is required. Extras help with tags, close-ups, flaws, angles.
                </div>
              </div>
            </div>

            <FileUploadCard
              id="main-image-upload"
              label="Main Image"
              required
              file={mainImage}
              onFileChange={setMainImage}
              accept="image/*"
              disabled={anyBusy}
              uploadText="Upload main image"
              changeText="Change image"
              hint="Imagine you are putting this item up for sale"
              showMissingMessage={submitAttempted}
              missingMessage="Main Image is required to submit."
            />

            <MultiFileUploadCard
              title="Extra Images (optional)"
              files={files}
              onChangeAt={(idx, f) => setSlotFile(idx, f)}
              onAdd={addSlot}
              onRemove={removeSlot}
              onClearAll={clearAllSlots}
              disabled={anyBusy}
              idPrefix="extra-image"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Optional Item Information
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                Item Name <span className="text-slate-400">(optional)</span>
              </label>

              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g. Nike Air Jordan 1 Retro High OG"
                disabled={anyBusy}
                className={[
                  "w-full rounded-lg border border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900 px-3 py-2 text-sm",
                  "text-slate-800 dark:text-slate-300",
                  "placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                  anyBusy ? "opacity-60 cursor-not-allowed" : "",
                ].join(" ")}
              />

              <p className="text-xs text-slate-500">
                If provided, we'll skip AI identification and search marketplaces directly.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                Additional Details <span className="text-slate-400">(optional)</span>
              </label>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="e.g. Looks like a Star Wars DVD set, but I'm not sure which movies are included"
                rows={3}
                disabled={anyBusy}
                className={[
                  "w-full rounded-lg border border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-300",
                  "placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                  anyBusy ? "opacity-60 cursor-not-allowed" : "",
                ].join(" ")}
              />
            </div>
          </div>
        </>
      )}

      {collapseForm && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex justify-between font-semibold text-slate-900 dark:text-slate-100">
            Search Parameters
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {mainImage ? `Main: ${mainImage.name}` : "Main: (none)"}
                <span className="text-slate-500 dark:text-slate-400">
                  {" "}
                  · Extras: {(files.filter(Boolean) as File[]).length}
                </span>
              </div>

              {(() => {
                const extras = files.filter(Boolean) as File[];
                if (!extras.length) return null;
                const shown = extras.slice(0, 2).map((f) => f.name).join(", ");
                const more = extras.length > 2 ? ` +${extras.length - 2} more` : "";
                return (
                  <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                    {shown}
                    {more}
                  </div>
                );
              })()}

              {itemName.trim() || textInput.trim() ? (
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  <div className="font-medium text-slate-800 dark:text-slate-200">
                    {itemName.trim() ? truncate(itemName, 40) : "No item name"}
                  </div>
                  {textInput.trim() && (
                    <div className="text-slate-500 dark:text-slate-400">{textInput}</div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  No optional text provided.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <CheckboxChip checked={runActive} onChange={setRunActive} disabled={anyBusy} label="Active listings" />
          <CheckboxChip checked={runSold} onChange={setRunSold} disabled={anyBusy} label="Sold listings" />
        </div>

        <button
          type="button"
          disabled={anyBusy || (!runActive && !runSold)}
          onClick={onRun}
          className={[
            "w-full rounded-xl px-4 py-2 text-sm font-semibold transition",
            anyBusy || (!runActive && !runSold)
              ? "bg-slate-200 text-slate-500 cursor-not-allowed dark:bg-slate-800/50 dark:text-slate-500"
              : "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600",
          ].join(" ")}
        >
          {anyBusy ? "Running..." : "Run"}
        </button>
        {activeError || soldError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {activeError || soldError}
          </div>
        ) : null}
      </div>
    </div>
  );
}
