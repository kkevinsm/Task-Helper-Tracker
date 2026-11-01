"use client";

import { useEffect, useState } from "react";
import { FileUp, Loader2, Paperclip, Trash2, X } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { Order, OrderStatus } from "@/lib/types";
import { CATEGORIES, STATUS_META } from "@/lib/utils";

const ACCEPT =
  ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.rar,.txt,.png,.jpg,.jpeg";
const MAX_SIZE = 50 * 1024 * 1024;

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120);
}

export function OrderFormModal({
  order,
  onClose,
  onSaved,
}: {
  order: Order | null;
  onClose: () => void;
  onSaved: (order: Order, isNew: boolean) => void;
}) {
  const isNew = !order;
  const [form, setForm] = useState({
    client_name: order?.client_name ?? "",
    client_contact: order?.client_contact ?? "",
    title: order?.title ?? "",
    category: order?.category ?? CATEGORIES[0],
    status: (order?.status ?? "pending") as OrderStatus,
    deadline: order?.deadline ?? "",
    price: order?.price?.toString() ?? "",
    notes: order?.notes ?? "",
    admin_notes: order?.admin_notes ?? "",
    result_link: order?.result_link ?? "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, saving]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const link = form.result_link.trim();
    if (link && !/^https?:\/\//i.test(link)) {
      setError("Link hasil harus diawali http:// atau https://");
      return;
    }
    if (file && file.size > MAX_SIZE) {
      setError("Ukuran file maksimal 50 MB.");
      return;
    }

    setSaving(true);
    const supabase = getSupabaseBrowser();
    const payload = {
      client_name: form.client_name.trim(),
      client_contact: form.client_contact.trim() || null,
      title: form.title.trim(),
      category: form.category,
      status: form.status,
      deadline: form.deadline || null,
      price: form.price ? Number(form.price) : null,
      notes: form.notes.trim() || null,
      admin_notes: form.admin_notes.trim() || null,
      result_link: link || null,
    };

    try {
      let saved: Order;
      if (isNew) {
        const { data, error } = await supabase.from("orders").insert(payload).select().single();
        if (error) throw error;
        saved = data as Order;
      } else {
        const { data, error } = await supabase
          .from("orders")
          .update(payload)
          .eq("id", order.id)
          .select()
          .single();
        if (error) throw error;
        saved = data as Order;
      }

      const oldPath = order?.result_file_path ?? null;

      if (file) {
        const path = `${saved.id}/${Date.now()}-${safeName(file.name)}`;
        const { error: upErr } = await supabase.storage
          .from("results")
          .upload(path, file, { contentType: file.type || undefined, upsert: false });
        if (upErr) throw new Error(`Upload gagal: ${upErr.message}`);
        const { data, error } = await supabase
          .from("orders")
          .update({ result_file_path: path, result_file_name: file.name })
          .eq("id", saved.id)
          .select()
          .single();
        if (error) throw error;
        saved = data as Order;
        if (oldPath) await supabase.storage.from("results").remove([oldPath]);
      } else if (removeFile && oldPath) {
        await supabase.storage.from("results").remove([oldPath]);
        const { data, error } = await supabase
          .from("orders")
          .update({ result_file_path: null, result_file_name: null })
          .eq("id", saved.id)
          .select()
          .single();
        if (error) throw error;
        saved = data as Order;
      }

      onSaved(saved, isNew);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan.");
      setSaving(false);
    }
  }

  const currentFile = !removeFile && !file ? order?.result_file_name : null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-matcha-900/30 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-modal-title"
    >
      <form
        onSubmit={onSubmit}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-cream shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-matcha-100 px-6 py-4">
          <div>
            <h2 id="order-modal-title" className="font-serif text-2xl font-semibold text-matcha-800">
              {isNew ? "Pesanan Baru" : "Edit Pesanan"}
            </h2>
            <p className="text-xs text-matcha-500">
              {isNew ? "Kode antrean dibuat otomatis (ADA-xxx)." : order.tracking_code}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg p-1.5 text-matcha-500 hover:bg-matcha-50" aria-label="Tutup">
            <X className="size-5" />
          </button>
        </div>

        <div className="grid flex-1 gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
          <Field label="Nama Klien" required>
            <input className="input" required value={form.client_name} onChange={(e) => set("client_name", e.target.value)} placeholder="Budi Santoso" />
          </Field>
          <Field label="Kontak Klien (opsional)">
            <input className="input" value={form.client_contact} onChange={(e) => set("client_contact", e.target.value)} placeholder="08xx / @username" />
          </Field>
          <Field label="Judul Tugas" required full>
            <input className="input" required value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Makalah Sosiologi Bab 1–3" />
          </Field>
          <Field label="Kategori">
            <select className="input" value={form.category} onChange={(e) => set("category", e.target.value)}>
              {[...new Set([...CATEGORIES, form.category])].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select className="input" value={form.status} onChange={(e) => set("status", e.target.value as OrderStatus)}>
              {(Object.keys(STATUS_META) as OrderStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_META[s].label}</option>
              ))}
            </select>
          </Field>
          <Field label="Deadline">
            <input type="date" className="input" value={form.deadline} onChange={(e) => set("deadline", e.target.value)} />
          </Field>
          <Field label="Harga (Rp, opsional — hanya admin)">
            <input type="number" min={0} step={1000} className="input" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="50000" />
          </Field>
          <Field label="Catatan untuk Klien (tampil di halaman tracking)" full>
            <textarea className="input min-h-20" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Contoh: Revisi maksimal 2x. Pembayaran DP 50% sudah diterima." />
          </Field>
          <Field label="Catatan Internal (hanya admin)" full>
            <textarea className="input min-h-16" value={form.admin_notes} onChange={(e) => set("admin_notes", e.target.value)} placeholder="Referensi, detail dosen, dsb." />
          </Field>

          <div className="rounded-2xl border border-dashed border-matcha-300 bg-matcha-50/50 p-4 sm:col-span-2">
            <p className="text-sm font-semibold text-matcha-800">Hasil Pengerjaan</p>
            <p className="mt-0.5 text-xs text-matcha-500">
              Hanya bisa diunduh klien saat status <b>Selesai</b>.
            </p>

            <div className="mt-3 space-y-3">
              {currentFile && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-matcha-200">
                  <span className="flex min-w-0 items-center gap-2 text-matcha-800">
                    <Paperclip className="size-4 shrink-0 text-matcha-500" />
                    <span className="truncate">{currentFile}</span>
                  </span>
                  <button type="button" onClick={() => setRemoveFile(true)} className="text-berry-500 hover:text-berry-700" aria-label="Hapus file">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              )}

              <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-white px-3 py-3 text-sm ring-1 ring-matcha-200 transition hover:ring-berry-300">
                <FileUp className="size-5 text-berry-500" />
                <span className="min-w-0 flex-1 truncate text-matcha-700">
                  {file ? file.name : currentFile ? "Ganti file (PDF, Word, PPT, ZIP…)" : "Upload file (PDF, Word, PPT, ZIP…) — maks 50 MB"}
                </span>
                {file && (
                  <button type="button" onClick={(e) => { e.preventDefault(); setFile(null); }} className="text-matcha-400 hover:text-berry-500" aria-label="Batal pilih file">
                    <X className="size-4" />
                  </button>
                )}
                <input
                  type="file"
                  accept={ACCEPT}
                  className="sr-only"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
              </label>

              <input
                type="url"
                className="input"
                value={form.result_link}
                onChange={(e) => set("result_link", e.target.value)}
                placeholder="Atau link Google Drive: https://drive.google.com/…"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-berry-50 px-3 py-2 text-xs text-berry-700 ring-1 ring-berry-100 sm:col-span-2">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-matcha-100 bg-white/60 px-6 py-4">
          <button type="button" onClick={onClose} disabled={saving} className="btn-ghost">
            Batal
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {isNew ? "Buat Pesanan" : "Simpan Perubahan"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  full,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <span className="label">
        {label} {required && <span className="text-berry-500">*</span>}
      </span>
      {children}
    </div>
  );
}

