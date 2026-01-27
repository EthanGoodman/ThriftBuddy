"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import AuthPanel from "@/components/auth/AuthPanel";
import { notifyAuthChanged } from "@/components/auth/useAuth";

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  rightSlot,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-semibold text-slate-300/90">{label}</div>
      <div className="relative">
        <input
          type={type}
          value={value}
          autoComplete={autoComplete}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={[
            "w-full rounded-2xl px-4 py-3 text-sm outline-none transition",
            "bg-white/[0.03] text-slate-100 placeholder:text-slate-500",
            "ring-1 ring-white/10 focus:ring-2 focus:ring-blue-500/60",
          ].join(" ")}
        />
        {rightSlot ? <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</div> : null}
      </div>
    </label>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" opacity="0.25" strokeWidth="3" />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_BASE_URL;

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = useMemo(() => email.trim().length > 0 && pw.length >= 1 && !loading, [email, pw, loading]);

  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  // optional: clear error when typing
  useEffect(() => {
    if (err) setErr(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, pw]);

  useEffect(() => {
    let alive = true;

    async function checkMe() {
      if (!API) { setIsAuthed(false); return; }
      try {
        const resp = await fetch(`${API}/auth/me`, { credentials: "include" });
        if (!alive) return;
        setIsAuthed(resp.ok);
      } catch {
        if (!alive) return;
        setIsAuthed(false);
      }
    }

    checkMe();
    return () => { alive = false; };
  }, [API]);


  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!API) {
      setErr("Missing NEXT_PUBLIC_API_BASE_URL in .env.local");
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          password: pw,
        }),
      });

      if (resp.status === 401) {
        setErr("Invalid Credentials");
        return;
      }
      if (!resp.ok) {
        const text = await resp.text();
        setErr(`Login failed (${resp.status}). ${text}`);
        return;
      }
      notifyAuthChanged();
      router.push("/app")
    } catch (e: any) {
      setErr("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell subtitle="Secure sign-in · resale research mode">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-14 items-center">
        {/* Left: brand + reassurance */}
        <div className="max-w-xl">
          <h1 className="text-6xl md:text-7xl font-semibold tracking-tight text-slate-100">
            <span className="text-blue-400"> Understand true {" "}</span>
              resale value
          </h1>
          <div className="mt-4 text-lg text-slate-300 leading-relaxed">
            Welcome back. Pick up where you left off — comps, notes, and your latest runs.
          </div>

          <div className="mt-8 text-sm text-slate-400/90">
            <span className="text-slate-300/90 font-semibold">Tip:</span> Use demo anytime if you just want to test the flow.
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => router.push("/app")}
              className="group inline-flex items-center gap-2 text-sm text-slate-300 hover:text-slate-100 transition"
            >
              Open demo
              <span className="text-blue-300 transition-transform group-hover:translate-x-0.5">→</span>
            </button>
          </div>
        </div>

        {/* Right: login panel */}
        <div className="flex md:justify-end">
          {isAuthed ? (
            <AuthPanel variant="login" />
            ) : (
            <div className="w-full max-w-md rounded-3xl px-8 py-8 backdrop-blur-xl bg-white/[0.045] ring-1 ring-white/10 relative overflow-hidden">
              {/* subtle moving glow */}
              <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl animate-[floatGlow_10s_ease-in-out_infinite]" />
              <div className="pointer-events-none absolute -bottom-28 -right-28 h-72 w-72 rounded-full bg-emerald-400/8 blur-3xl animate-[floatGlow2_12s_ease-in-out_infinite]" />

              <div className="relative">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <div className="text-base font-semibold text-slate-100">Sign in</div>
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3 py-1 text-xs text-slate-300 ring-1 ring-white/10">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50 animate-ping" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                    </span>
                    partial access
                  </div>
                </div>

                <form onSubmit={onSubmit} className="space-y-5">
                  <Field
                    label="Email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />

                  <Field
                    label="Password"
                    type={showPw ? "text" : "password"}
                    value={pw}
                    onChange={setPw}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    rightSlot={
                      <button
                        type="button"
                        onClick={() => setShowPw((s) => !s)}
                        className="text-xs text-slate-400 hover:text-slate-200 transition"
                      >
                        {showPw ? "Hide" : "Show"}
                      </button>
                    }
                  />

                  {err ? (
                    <div className="rounded-2xl bg-red-500/10 ring-1 ring-red-500/20 px-4 py-3 text-sm text-red-200">
                      {err}
                    </div>
                  ) : null}

                  <div className="relative">
                    <div className="pointer-events-none absolute inset-0 rounded-2xl bg-blue-500/20 blur-xl opacity-70" />
                    <button
                      type="submit"
                      disabled={!canSubmit}
                      className={[
                        "relative w-full rounded-2xl px-5 py-3 text-sm font-semibold text-white transition",
                        canSubmit ? "bg-blue-500 hover:bg-blue-400" : "bg-blue-500/40 cursor-not-allowed",
                      ].join(" ")}
                    >
                      <span className="inline-flex items-center justify-center gap-2">
                        {loading ? <Spinner /> : null}
                        Continue
                      </span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <Link className="text-slate-400 hover:text-slate-200 transition" href="/register">
                      Don&apos;t have an account? <span className="text-blue-300">Create one</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => router.push("/app")}
                      className="text-slate-400 hover:text-slate-200 transition"
                    >
                      Use demo →
                    </button>
                  </div>
                </form>
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
          )}
        </div>
      </div>
    </AuthShell>
  );
}
