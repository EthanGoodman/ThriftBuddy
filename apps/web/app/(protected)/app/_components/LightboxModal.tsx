type LightboxModalProps = {
  url: string;
  name: string;
  onClose: () => void;
};

export function LightboxModal({ url, name, onClose }: LightboxModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-white/90 truncate">{name}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
          >
            Close
          </button>
        </div>

        <div className="rounded-xl overflow-hidden bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={name} className="w-full max-h-[75vh] object-contain" />
        </div>
      </div>
    </div>
  );
}
