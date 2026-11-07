import type { OrderStatus } from "./types";

export const BRAND = "urtaskhelper";
export const CODE_PREFIX = "ADA-";

export const CATEGORIES = [
  "Makalah",
  "Essay",
  "Jurnal / Artikel",
  "Laporan",
  "Skripsi / Proposal",
  "PPT / Presentasi",
  "Coding / Program",
  "Soal / Tugas Harian",
  "Lainnya",
];

export const STATUS_META: Record<
  OrderStatus,
  { label: string; badge: string; dot: string }
> = {
  pending: {
    label: "Di Antrean",
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
    dot: "bg-amber-400",
  },
  in_progress: {
    label: "Dikerjakan",
    badge: "bg-berry-50 text-berry-700 ring-berry-200",
    dot: "bg-berry-400",
  },
  completed: {
    label: "Selesai",
    badge: "bg-matcha-50 text-matcha-700 ring-matcha-200",
    dot: "bg-matcha-500",
  },
  revision: {
    label: "Sedang Revisi",
    badge: "bg-rose-50 text-rose-700 ring-rose-200",
    dot: "bg-rose-500",
  },
  revision_completed: {
    label: "Selesai Revisi",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    dot: "bg-emerald-500",
  },
  cancelled: {
    label: "Dibatalkan",
    badge: "bg-stone-100 text-stone-600 ring-stone-200",
    dot: "bg-stone-400",
  },
};

const TZ = "Asia/Jakarta";

export function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  // `date` columns come as YYYY-MM-DD — treat as local calendar date.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00+07:00`)
    : new Date(value);
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  }).format(d);
}

export function formatShortDate(value: string | null | undefined) {
  if (!value) return "-";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00+07:00`)
    : new Date(value);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  }).format(d);
}

export function formatRupiah(value: number | null | undefined) {
  if (value == null) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Normalize WhatsApp number to international format without "+" (e.g. 6281234…). */
function normalizeWa(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

export function whatsappLink(message: string) {
  const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  if (!number) return null;
  return `https://wa.me/${normalizeWa(number)}?text=${encodeURIComponent(message)}`;
}

export function normalizeCode(raw: string) {
  const v = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (/^\d+$/.test(v)) return `${CODE_PREFIX}${v.padStart(3, "0")}`;
  if (/^ADA\d+$/.test(v)) return `${CODE_PREFIX}${v.slice(3).padStart(3, "0")}`;
  return v;
}

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

