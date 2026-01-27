import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const VISITOR_COOKIE = "tb_vid";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const jar = await cookies();
  const vid = jar.get(VISITOR_COOKIE)?.value;

  if (!vid) redirect("/");

  return <>{children}</>;
}
