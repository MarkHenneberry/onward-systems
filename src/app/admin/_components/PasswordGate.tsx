"use client";

import { useState } from "react";

export default function PasswordGate() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = password.trim();
    if (!value || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: value }),
      });
      if (res.ok) {
        window.location.href = "/admin";
      } else if (res.status === 401) {
        setError("Incorrect password.");
        setLoading(false);
      } else {
        setError("Login failed. Try again.");
        setLoading(false);
      }
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  const canSubmit = password.trim().length > 0 && !loading;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "#f8f7f4", fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-8 w-full max-w-sm">
        <div className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-1">
            Onward Systems
          </p>
          <h1 className="text-xl font-bold text-[#0f1c40]">Admin access</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-[#0f1c40] hover:bg-[#162444] text-white font-semibold text-sm py-2.5 rounded-xl transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Entering…" : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}
