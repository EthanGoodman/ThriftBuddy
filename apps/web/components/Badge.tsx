type BadgeProps = {
  children: React.ReactNode;
  className?: string;
};

export function Badge({ children, className = "" }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full bg-[var(--panel-quiet)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)] ring-1 ring-[var(--panel-border)]",
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}
