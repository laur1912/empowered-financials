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
    <main className="grid min-h-screen place-items-center bg-sand px-6">
      <form onSubmit={submit} className="card w-full max-w-sm p-8">
        <p className="eyebrow">Financial planner</p>
        <h1 className="mt-3 text-4xl">Empowered Therapy</h1>
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
              className="mt-2 w-full rounded-[7px] border border-rule bg-paper px-3 py-2.5"
            />
            {error && <p className="mt-2 text-sm text-loss">{error}</p>}
            <button
              disabled={busy || !password}
              className="btn mt-5 w-full"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </>
        )}
      </form>
    </main>
  );
}
