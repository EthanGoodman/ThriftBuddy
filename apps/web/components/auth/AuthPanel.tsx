"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import  { notifyAuthChanged } from "@/components/auth/useAuth";

type Variant = "landing" | "login" | "register";

const API = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function AuthPanel({ variant = "landing" }: { variant?: Variant }) {
  const router = useRouter();
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;

    async function checkMe() {
      if (!API) {
        // If API base isn't set, just assume not authed.
        setIsAuthed(false);
        return;
      }

      try {
        const resp = await fetch(`${API}/auth/me`, {
          method: "GET",
          credentials: "include",
        });
        if (!alive) return;
        setIsAuthed(resp.ok);
      } catch {
        if (!alive) return;
        setIsAuthed(false);
      }
    }

    checkMe();
    return () => {
      alive = false;
    };
  }, []);

  async function logout() {
    try {
      await fetch(`${API}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      notifyAuthChanged()
      router.push("/");
      router.refresh(); // re-runs server components/layout checks
    }
  }


  const heading =
    isAuthed
      ? "You’re already signed in"
      : variant === "register"
        ? "Create your account"
        : "Welcome back";

  const sub =
    isAuthed
      ? "Pick up where you left off."
      : variant === "register"
        ? "One minute to get started."
        : "Login, or jump straight into demo mode.";

  return (
    <div className="w-full max-w-md rounded-3xl px-8 py-8 backdrop-blur-xl bg-white/[0.045] ring-1 ring-white/10 relative overflow-hidden">
      {/* subtle moving glow */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl animate-[floatGlow_10s_ease-in-out_infinite]" />
      <div className="pointer-events-none absolute -bottom-28 -right-28 h-72 w-72 rounded-full bg-emerald-400/8 blur-3xl animate-[floatGlow2_12s_ease-in-out_infinite]" />

      <div className="relative">
        {/* Header + chip */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="text-base font-semibold text-slate-100">{heading}</div>
            <div className="text-sm text-slate-400">{sub}</div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3 py-1 text-xs text-slate-300 ring-1 ring-white/10">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            {isAuthed ? "signed in" : "demo enabled"}
          </div>
        </div>

        {isAuthed ? (
          <>
            {/* Return to app */}
            <div className="relative">
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-blue-500/20 blur-xl opacity-70" />
              <button
                type="button"
                onClick={() => router.push("/app")}
                className="relative w-full rounded-2xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-400 transition"
              >
                Return to app
              </button>
            </div>

            {/* Logout */}
            <div className="mt-4">
              <button
                type="button"
                onClick={logout}
                className="w-full rounded-2xl bg-white/[0.02] px-5 py-3 text-sm font-semibold text-slate-200 ring-1 ring-white/10 hover:bg-white/[0.05] transition"
              >
                Logout
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Primary */}
            <div className="relative">
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-blue-500/20 blur-xl opacity-70" />
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="relative w-full rounded-2xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-400 transition"
              >
                Login
              </button>
            </div>

            {/* Secondary */}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => router.push("/register")}
                className="w-full rounded-2xl bg-white/[0.02] px-5 py-3 text-sm font-semibold text-slate-200 ring-1 ring-white/10 hover:bg-white/[0.05] transition"
              >
                Create account <span className="text-blue-300">Get started</span>
              </button>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes floatGlow {
          0% { transform: translate(0px, 0px); opacity: 0.65; }
          50% { transform: translate(22px, 12px); opacity: 0.85; }
          100% { transform: translate(0px, 0px); opacity: 0.65; }
        }
        @keyframes floatGlow2 {
          0% { transform: translate(0px, 0px); opacity: 0.55; }
          50% { transform: translate(-18px, -10px); opacity: 0.75; }
          100% { transform: translate(0px, 0px); opacity: 0.55; }
        }
      `}</style>
    </div>
  );
}
