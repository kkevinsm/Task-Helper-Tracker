"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, SearchX } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { PublicOrder } from "@/lib/types";
import { normalizeCode } from "@/lib/utils";
import { OrderResult } from "./order-result";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "found"; order: PublicOrder }
  | { kind: "not_found"; code: string }
  | { kind: "error"; message: string };

export function TrackForm() {
  const [code, setCode] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const didInit = useRef(false);

  async function lookup(raw: string) {
    const normalized = normalizeCode(raw);
    if (!normalized) return;
    setCode(normalized);
    setState({ kind: "loading" });

    const url = new URL(window.location.href);
    url.searchParams.set("code", normalized);
    window.history.replaceState(null, "", url);

    try {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase.rpc("get_public_order", {
        code: normalized,
      });
      if (error) throw error;
      const order = (data as PublicOrder[] | null)?.[0];
      setState(order ? { kind: "found", order } : { kind: "not_found", code: normalized });
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : "Terjadi kesalahan. Coba lagi.",
      });
    }
  }

  // Support shareable links: /?code=ADA-001
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const initial = new URLSearchParams(window.location.search).get("code");
    if (initial) void lookup(initial);
  }, []);

  return (
    <div className="mt-8 w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void lookup(code);
        }}
        className="flex items-center gap-2 rounded-2xl border border-white bg-white/90 p-1.5 pl-4 shadow-[0_10px_40px_-12px_rgb(238_72_112/0.35)] focus-within:ring-4 focus-within:ring-berry-100"
      >
        <Search className="size-4 shrink-0 text-matcha-400" />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Masukkan kode antrean..."
          aria-label="Kode antrean"
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent py-2 text-sm text-matcha-900 uppercase placeholder:text-matcha-400/80 placeholder:normal-case outline-none"
        />
        <button type="submit" className="btn-primary px-5" disabled={state.kind === "loading" || !code.trim()}>
          {state.kind === "loading" ? <Loader2 className="size-4 animate-spin" /> : null}
          Cek Status
        </button>
      </form>
      <p className="mt-3 text-center text-xs text-matcha-500">
        Contoh kode: <code className="font-mono font-semibold text-berry-600">ADA-001</code>
      </p>

      <div className="mt-8" aria-live="polite">
        {state.kind === "found" && <OrderResult order={state.order} />}
        {state.kind === "not_found" && (
          <div className="card flex flex-col items-center px-6 py-10 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-berry-50">
              <SearchX className="size-6 text-berry-500" />
            </div>
            <p className="mt-4 font-serif text-2xl font-semibold text-matcha-800">
              Kode tidak ditemukan
            </p>
            <p className="mt-1 text-sm text-matcha-600">
              Pastikan kode <span className="font-mono font-semibold">{state.code}</span>{" "}
              sudah benar, ya.
            </p>
          </div>
        )}
        {state.kind === "error" && (
          <div className="card px-6 py-5 text-center text-sm text-berry-700">{state.message}</div>
        )}
      </div>
    </div>
  );
}

