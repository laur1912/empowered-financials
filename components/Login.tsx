"use client";

import { useState } from "react";

export default function Login({ configured }: { configured: boolean }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) window.location.reload();
    else {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Sign-in failed. Try again.");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Empowered Therapy</h1>
        <p className="mt-1 text-muted">Financial planner</p>
        {!configured ? (
          <p className="mt-8 text-loss">
            This site has no password yet. Add an APP_PASSWORD environment variable in Vercel, then redeploy.
          </p>
        ) : (
          <>
            <label htmlFor="pw" className="mt-8 block text-sm font-medium">
              Password
            </label>
            <input
              id="pw"
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-md border border-rule bg-paper px-3 py-2"
            />
            {error && <p className="mt-2 text-sm text-loss">{error}</p>}
            <button
              disabled={busy || !password}
              className="mt-4 w-full rounded-md bg-sea px-4 py-2 font-medium text-white disabled:opacity-50"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </>
        )}
      </form>
    </main>
  );
}
