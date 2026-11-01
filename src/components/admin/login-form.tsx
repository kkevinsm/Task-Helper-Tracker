"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Full navigation so the proxy sees the fresh session cookie.
      window.location.assign("/admin");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal masuk.";
      setError(msg === "Invalid login credentials" ? "Email atau password salah." : msg);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card mt-7 w-full max-w-sm space-y-4 p-6">
      <div>
        <label htmlFor="email" className="label">
          Email <span className="text-berry-500">*</span>
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-matcha-400" />
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            className="input pl-9"
          />
        </div>
      </div>
      <div>
        <label htmlFor="password" className="label">
          Password <span className="text-berry-500">*</span>
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-matcha-400" />
          <input
            id="password"
            type={show ? "text" : "password"}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="input px-9"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-matcha-400 hover:text-berry-500"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-berry-50 px-3 py-2 text-xs text-berry-700 ring-1 ring-berry-100">
          {error}
        </p>
      )}

      <button type="submit" disabled={loading} className="btn-primary w-full py-3">
        {loading && <Loader2 className="size-4 animate-spin" />}
        Masuk ke Admin Panel
      </button>
    </form>
  );
}

