import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";

const COOKIE_NAME = "access_token";

async function verifyAccessToken(token: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");

  const key = new TextEncoder().encode(secret);

  // Your FastAPI uses HS256, so this matches.
  const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });

  // Optional: ensure a subject exists (user id)
  if (!payload.sub) throw new Error("Missing sub claim");

  return payload;
}

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;

  console.log(token)

  if (!token) redirect("/login");

  try {
    await verifyAccessToken(token);
    return <>{children}</>;
  } catch (e) {
    console.log("the error:", e)
    // expired / invalid / wrong secret
    redirect("/login");
  }
}
