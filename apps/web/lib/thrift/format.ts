export function fmtMoney(x: number | null | undefined) {
  if (x == null || Number.isNaN(x)) return "—";
  return `$${x.toFixed(2)}`;
}

export function truncate(s: string, n: number) {
  const t = s.trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}