type BadgeProps = {
  children: React.ReactNode;
  className?: string;
};

export function Badge({ children, className = "" }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-white/80 ring-1 ring-white/10",
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}
