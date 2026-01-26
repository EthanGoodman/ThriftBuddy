"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-semibold text-slate-300/90">{label}</div>
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

export default function RegisterPage() {
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_BASE_URL;

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const pwMatch = pw.length > 0 && pw === pw2;

  const canSubmit = useMemo(() => {
    return (
      email.trim().length > 0 &&
      pw.length >= 8 &&
      pwMatch &&
      !loading &&
      Boolean(API)
    );
  }, [email, pw, pwMatch, loading, API]);

  useEffect(() => {
    setErr(null);
    setOk(null);
  }, [email, pw, pw2, displayName]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);

    if (!API) {
      setErr("Missing NEXT_PUBLIC_API_BASE_URL in .env.local");
      return;
    }
    if (pw !== pw2) {
      setErr("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password: pw,
          display_name: displayName.trim() || null,
        }),
      });

      if (resp.status === 409) {
        setErr("That email is already registered.");
        return;
      }
      if (!resp.ok) {
        const text = await resp.text();
        setErr(`Registration failed (${resp.status}). ${text}`);
        return;
      }

      setOk("Account created. Redirecting to login…");
      setTimeout(() => router.push("/login"), 650);
    } catch (e: any) {
      setErr("Network error. Is the FastAPI server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell subtitle="Create account · save runs · keep comps organized">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-14 items-center">
        {/* Left */}
        <div className="max-w-xl">
          <h1 className="text-6xl md:text-6xl font-semibold tracking-tight text-slate-100">
            <span className="text-blue-400">Thrift</span>Buddy
          </h1>

          <div className="mt-4 text-lg text-slate-300 leading-relaxed">
            Create your account to save comps, notes, and previous runs.
          </div>

          <div className="mt-8 text-sm text-slate-400/90">
            You can still try demo mode anytime — no account required.
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

        {/* Right: register panel */}
        <div className="flex md:justify-end">
          <div className="w-full max-w-md rounded-3xl px-8 py-8 backdrop-blur-xl bg-white/[0.045] ring-1 ring-white/10 relative overflow-hidden">
            <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl animate-[floatGlow_10s_ease-in-out_infinite]" />
            <div className="pointer-events-none absolute -bottom-28 -right-28 h-72 w-72 rounded-full bg-emerald-400/8 blur-3xl animate-[floatGlow2_12s_ease-in-out_infinite]" />

            <div className="relative">
              <div className="mb-6">
                <div className="text-base font-semibold text-slate-100">Create account</div>
                <div className="text-sm text-slate-400">Email + password for now. OAuth next.</div>
              </div>

              <form onSubmit={onSubmit} className="space-y-5">
                <Field
                  label="Display name (optional)"
                  type="text"
                  value={displayName}
                  onChange={setDisplayName}
                  placeholder="Ethan"
                  autoComplete="name"
                />

                <Field
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@example.com"
                  autoComplete="email"
                />

                <Field
                  label="Password (min 8 chars)"
                  type="password"
                  value={pw}
                  onChange={setPw}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />

                <Field
                  label="Confirm password"
                  type="password"
                  value={pw2}
                  onChange={setPw2}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />

                {pw.length > 0 && pw2.length > 0 && !pwMatch ? (
                  <div className="text-sm text-amber-200/90">Passwords don’t match yet.</div>
                ) : null}

                {err ? (
                  <div className="rounded-2xl bg-red-500/10 ring-1 ring-red-500/20 px-4 py-3 text-sm text-red-200">
                    {err}
                  </div>
                ) : null}

                {ok ? (
                  <div className="rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20 px-4 py-3 text-sm text-emerald-200">
                    {ok}
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
                      Create account
                    </span>
                  </button>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <Link className="text-slate-400 hover:text-slate-200 transition" href="/login">
                    Already have an account? <span className="text-blue-300">Sign in</span>
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
        </div>
      </div>
    </AuthShell>
  );
}
