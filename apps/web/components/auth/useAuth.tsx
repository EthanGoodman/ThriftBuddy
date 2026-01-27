"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const AUTH_EVENT = "tb-auth-changed";

export function notifyAuthChanged() {
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function useAuth(apiBase?: string) {
  const router = useRouter();
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  const refreshAuth = useCallback(async () => {
    if (!apiBase) {
      setIsAuthed(false);
      return false;
    }

    try {
      const resp = await fetch(`${apiBase}/auth/me`, { credentials: "include" });
      setIsAuthed(resp.ok);
      return resp.ok;
    } catch {
      setIsAuthed(false);
      return false;
    }
  }, [apiBase]);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!alive) return;
      await refreshAuth();
    }

    run();

    function onAuthChanged() {
      refreshAuth();
    }

    window.addEventListener(AUTH_EVENT, onAuthChanged);
    return () => {
      alive = false;
      window.removeEventListener(AUTH_EVENT, onAuthChanged);
    };
  }, [refreshAuth]);

  const logout = useCallback(async () => {
    try {
      if (apiBase) {
        await fetch(`${apiBase}/auth/logout`, {
          method: "POST",
          credentials: "include",
        });
      }
    } finally {
      setIsAuthed(false);
      notifyAuthChanged();
      router.push("/");
      router.refresh();
    }
  }, [apiBase, router]);

  return { isAuthed, refreshAuth, logout };
}

