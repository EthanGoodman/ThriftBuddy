export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-white/80 ring-1 ring-white/10">
      {children}
    </span>
  );
}
