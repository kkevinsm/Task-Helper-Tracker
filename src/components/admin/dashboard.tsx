"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileCheck2,
  Hourglass,
  Link2,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Tag,
  Trash2,
  User,
  Wrench,
} from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { Order, OrderStatus } from "@/lib/types";
import { Logo } from "@/components/logo";
import { STATUS_META, cn, formatRupiah, formatShortDate } from "@/lib/utils";
import { OrderFormModal } from "./order-form-modal";

type Filter = "all" | OrderStatus;

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "Semua" },
  { key: "pending", label: "Di Antrean" },
  { key: "in_progress", label: "Dikerjakan" },
  { key: "completed", label: "Selesai" },
  { key: "revision", label: "Sedang Revisi" },
  { key: "revision_completed", label: "Selesai Revisi" },
  { key: "cancelled", label: "Dibatalkan" },
];

export function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notAdmin, setNotAdmin] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<{ order: Order | null } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [today, setToday] = useState("");

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowser();
      const [{ data: userData }, { data: admin, error: adminErr }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.rpc("is_admin"),
      ]);
      setEmail(userData.user?.email ?? null);
      if (adminErr) throw adminErr;
      if (!admin) {
        setNotAdmin(true);
        setOrders([]);
        return;
      }
      setNotAdmin(false);
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setOrders((data ?? []) as Order[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setToday(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date()));
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const count = (s: OrderStatus) => orders.filter((o) => o.status === s).length;
    return {
      total: orders.length,
      pending: count("pending"),
      in_progress: count("in_progress"),
      completed: count("completed"),
      revision: count("revision"),
    };
  }, [orders]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter !== "all" && o.status !== filter) return false;
      if (!q) return true;
      return [o.tracking_code, o.title, o.client_name, o.category, o.client_contact ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [orders, filter, query]);

  async function updateStatus(order: Order, status: OrderStatus) {
    const supabase = getSupabaseBrowser();
    const { data, error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", order.id)
      .select()
      .single();
    if (error) return notify(`Gagal: ${error.message}`);
    setOrders((prev) => prev.map((o) => (o.id === order.id ? (data as Order) : o)));
    notify(`${order.tracking_code} → ${STATUS_META[status].label}`);
  }

  async function remove(order: Order) {
    if (!window.confirm(`Hapus pesanan ${order.tracking_code} — "${order.title}"?`)) return;
    const supabase = getSupabaseBrowser();
    if (order.result_file_path) {
      await supabase.storage.from("results").remove([order.result_file_path]);
    }
    const { error } = await supabase.from("orders").delete().eq("id", order.id);
    if (error) return notify(`Gagal menghapus: ${error.message}`);
    setOrders((prev) => prev.filter((o) => o.id !== order.id));
    notify(`${order.tracking_code} dihapus`);
  }

  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    notify(`${label} disalin`);
  }

  async function logout() {
    await getSupabaseBrowser().auth.signOut();
    window.location.assign("/admin/login");
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/70 bg-cream/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3.5">
          <Logo href="/admin" />
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-matcha-500 sm:inline">{email}</span>
            <button onClick={logout} className="btn-ghost px-3 py-2 text-xs">
              <LogOut className="size-3.5" /> Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl font-semibold text-matcha-800">
              Dashboard <span className="text-berry-500 italic">Antrean</span>
            </h1>
            <p className="mt-1 text-sm text-matcha-600">
              Kelola semua pesanan joki tugas dalam satu tempat.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void load()} className="btn-ghost" aria-label="Muat ulang">
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            </button>
            <button onClick={() => setModal({ order: null })} className="btn-primary" disabled={notAdmin}>
              <Plus className="size-4" /> Pesanan Baru
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat icon={ClipboardList} label="Total Pesanan" value={stats.total} tone="bg-white text-matcha-700" iconTone="bg-matcha-100 text-matcha-600" />
          <Stat icon={Hourglass} label="Di Antrean" value={stats.pending} tone="bg-amber-50/80 text-amber-800" iconTone="bg-amber-100 text-amber-600" />
          <Stat icon={Wrench} label="Dikerjakan" value={stats.in_progress} tone="bg-berry-50/80 text-berry-800" iconTone="bg-berry-100 text-berry-600" />
          <Stat icon={CheckCircle2} label="Selesai" value={stats.completed} tone="bg-matcha-50/80 text-matcha-800" iconTone="bg-matcha-200 text-matcha-700" />
          <Stat icon={RotateCcw} label="Sedang Revisi" value={stats.revision} tone="bg-rose-50/80 text-rose-800" iconTone="bg-rose-100 text-rose-600" />
        </div>

        {/* Toolbar */}
        <div className="card mt-6 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative lg:w-80">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-matcha-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari kode, judul, atau nama klien…"
                className="input pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-medium transition",
                    filter === f.key
                      ? "bg-berry-500 text-white shadow-sm shadow-berry-200"
                      : "bg-matcha-50 text-matcha-700 hover:bg-matcha-100",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* List */}
        <div className="mt-4 space-y-3">
          {loading && orders.length === 0 ? (
            <div className="card flex items-center justify-center gap-2 py-16 text-sm text-matcha-500">
              <Loader2 className="size-4 animate-spin" /> Memuat pesanan…
            </div>
          ) : error ? (
            <div className="card px-6 py-10 text-center text-sm text-berry-700">{error}</div>
          ) : notAdmin ? (
            <div className="card flex flex-col items-center px-6 py-12 text-center">
              <AlertTriangle className="size-8 text-amber-500" />
              <p className="mt-3 font-semibold text-matcha-800">Akun ini belum terdaftar sebagai admin</p>
              <p className="mt-1 max-w-md text-sm text-matcha-600">
                Tambahkan email <span className="font-mono">{email}</span> ke tabel{" "}
                <span className="font-mono">public.admins</span> di Supabase SQL Editor.
              </p>
            </div>
          ) : visible.length === 0 ? (
            <div className="card px-6 py-14 text-center text-sm text-matcha-500">
              {orders.length === 0 ? "Belum ada pesanan. Klik “Pesanan Baru” untuk mulai." : "Tidak ada pesanan yang cocok."}
            </div>
          ) : (
            <>
              <p className="px-1 text-xs text-matcha-500">
                Menampilkan {visible.length} dari {orders.length} pesanan
              </p>
              {visible.map((o) => {
                const meta = STATUS_META[o.status];
                const overdue =
                  o.deadline && o.deadline < today && (o.status === "pending" || o.status === "in_progress");
                return (
                  <article key={o.id} className="card p-4 sm:p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => void copy(o.tracking_code, "Kode")}
                            className="inline-flex items-center gap-1 rounded-md bg-matcha-50 px-2 py-0.5 font-mono text-xs font-semibold text-matcha-700 ring-1 ring-matcha-200 hover:bg-matcha-100"
                            title="Salin kode"
                          >
                            {o.tracking_code} <Copy className="size-3" />
                          </button>
                          <span className="rounded-md bg-berry-50 px-2 py-0.5 text-[11px] font-medium text-berry-700 ring-1 ring-berry-100">
                            {o.category}
                          </span>
                          {(o.result_file_path || o.result_link) && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-matcha-100 px-2 py-0.5 text-[11px] font-medium text-matcha-700">
                              <FileCheck2 className="size-3" /> Hasil tersedia
                            </span>
                          )}
                        </div>
                        <h3 className="mt-2 truncate font-semibold text-matcha-900">{o.title}</h3>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-matcha-600">
                          <span className="inline-flex items-center gap-1">
                            <User className="size-3.5" /> {o.client_name}
                            {o.client_contact ? ` · ${o.client_contact}` : ""}
                          </span>
                          <span className={cn("inline-flex items-center gap-1", overdue && "font-semibold text-berry-600")}>
                            <CalendarClock className="size-3.5" /> {o.deadline ? formatShortDate(o.deadline) : "Tanpa deadline"}
                            {overdue && " · lewat deadline!"}
                          </span>
                          {o.price != null && (
                            <span className="inline-flex items-center gap-1">
                              <Tag className="size-3.5" /> {formatRupiah(o.price)}
                            </span>
                          )}
                        </div>
                        {o.admin_notes && (
                          <p className="mt-2 line-clamp-2 rounded-lg bg-amber-50/70 px-2.5 py-1.5 text-xs text-amber-800">
                            📝 {o.admin_notes}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {/* Tombol aksi cepat revisi */}
                        {o.status === "revision" ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void updateStatus(o, "revision_completed")}
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-xs shadow-emerald-200 transition hover:bg-emerald-700"
                              title="Tandai revisi selesai dikerjakan"
                            >
                              <CheckCircle2 className="size-3" /> Selesai Revisi
                            </button>
                            <button
                              type="button"
                              onClick={() => void updateStatus(o, "completed")}
                              className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2 py-1.5 text-xs text-stone-600 transition hover:bg-stone-50"
                              title="Batalkan status revisi kembali ke selesai"
                            >
                              Batal
                            </button>
                          </div>
                        ) : o.status === "revision_completed" ? (
                          <button
                            type="button"
                            onClick={() => void updateStatus(o, "revision")}
                            className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                            title="Ajukan revisi kembali"
                          >
                            <RotateCcw className="size-3" /> Revisi Lagi
                          </button>
                        ) : o.status !== "cancelled" ? (
                          <button
                            type="button"
                            onClick={() => void updateStatus(o, "revision")}
                            className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                            title="Aktifkan tahap revisi untuk pesanan ini (memunculkan poin 4 & 5 di halaman publik)"
                          >
                            <RotateCcw className="size-3" /> Ada Revisi
                          </button>
                        ) : null}

                        <div className="relative">
                          <span className={cn("pointer-events-none absolute top-1/2 left-2.5 size-1.5 -translate-y-1/2 rounded-full", meta.dot)} />
                          <select
                            value={o.status}
                            onChange={(e) => void updateStatus(o, e.target.value as OrderStatus)}
                            className={cn(
                              "cursor-pointer appearance-none rounded-full py-1.5 pr-3 pl-6 text-xs font-medium ring-1 outline-none",
                              meta.badge,
                            )}
                            aria-label="Ubah status"
                          >
                            {(Object.keys(STATUS_META) as OrderStatus[]).map((s) => (
                              <option key={s} value={s}>
                                {STATUS_META[s].label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <IconBtn label="Salin link tracking" onClick={() => void copy(`${window.location.origin}/?code=${o.tracking_code}`, "Link tracking")}>
                          <Link2 className="size-4" />
                        </IconBtn>
                        <IconBtn label="Edit" onClick={() => setModal({ order: o })}>
                          <Pencil className="size-4" />
                        </IconBtn>
                        <IconBtn label="Hapus" onClick={() => void remove(o)} danger>
                          <Trash2 className="size-4" />
                        </IconBtn>
                      </div>
                    </div>
                  </article>
                );
              })}
            </>
          )}
        </div>
      </main>

      {modal && (
        <OrderFormModal
          order={modal.order}
          onClose={() => setModal(null)}
          onSaved={(saved, isNew) => {
            setOrders((prev) =>
              isNew ? [saved, ...prev] : prev.map((o) => (o.id === saved.id ? saved : o)),
            );
            setModal(null);
            notify(isNew ? `Pesanan ${saved.tracking_code} dibuat` : `${saved.tracking_code} diperbarui`);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-matcha-800 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
  iconTone,
}: {
  icon: typeof ClipboardList;
  label: string;
  value: number;
  tone: string;
  iconTone: string;
}) {
  return (
    <div className={cn("rounded-3xl border border-white p-4 shadow-[0_10px_30px_-18px_rgb(87_119_62/0.35)]", tone)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium opacity-80">{label}</span>
        <span className={cn("grid size-8 place-items-center rounded-xl", iconTone)}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2 font-serif text-4xl font-semibold">{value}</p>
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "grid size-8 place-items-center rounded-lg border transition",
        danger
          ? "border-berry-100 text-berry-500 hover:bg-berry-50"
          : "border-matcha-100 text-matcha-600 hover:bg-matcha-50",
      )}
    >
      {children}
    </button>
  );
}
