export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200
                     dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
      {children}
    </span>
  );
}