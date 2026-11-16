import type { OrderStatus } from "@/lib/types";
import { CATEGORIES, STATUS_META, formatRupiah, formatShortDate } from "@/lib/utils";
import { escapeHtml } from "./api";

export type OrderDraft = {
  client_name?: string;
  client_contact?: string | null;
  title?: string;
  category?: string;
  status?: OrderStatus;
  deadline?: string | null;
  price?: number | null;
  notes?: string | null;
  admin_notes?: string | null;
  result_link?: string | null;
};

type DraftField = keyof OrderDraft;

const KEY_ALIASES: Record<string, DraftField> = {
  nama: "client_name",
  "nama klien": "client_name",
  klien: "client_name",
  client: "client_name",

  kontak: "client_contact",
  "kontak klien": "client_contact",
  wa: "client_contact",
  whatsapp: "client_contact",
  hp: "client_contact",

  judul: "title",
  "judul tugas": "title",
  tugas: "title",
  title: "title",

  kategori: "category",
  category: "category",

  status: "status",

  deadline: "deadline",
  dl: "deadline",
  batas: "deadline",

  harga: "price",
  biaya: "price",
  tarif: "price",
  price: "price",

  catatan: "notes",
  "catatan klien": "notes",
  "catatan untuk klien": "notes",
  notes: "notes",

  internal: "admin_notes",
  "catatan internal": "admin_notes",
  "catatan admin": "admin_notes",
  admin_notes: "admin_notes",

  link: "result_link",
  "link hasil": "result_link",
  gdrive: "result_link",
  drive: "result_link",
};

const EMPTY_VALUES: Record<string, true> = {
  "": true,
  "-": true,
  kosong: true,
  "tidak ada": true,
  none: true,
  null: true,
};

export function isEmptyValue(raw: string): boolean {
  return raw.trim().toLowerCase() in EMPTY_VALUES;
}

/** Returns current YYYY-MM-DD in Asia/Jakarta, plus optional offset in days. */
export function jakartaDateISO(offsetDays = 0): string {
  const now = new Date();
  const shifted = new Date(now.getTime() + offsetDays * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(shifted);

  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function normalizeCategory(raw: string): string | null {
  const val = raw.trim();
  if (!val) return null;

  const num = Number(val);
  if (Number.isInteger(num) && num >= 1 && num <= CATEGORIES.length) {
    return CATEGORIES[num - 1];
  }

  const lower = val.toLowerCase();
  const exact = CATEGORIES.find((c) => c.toLowerCase() === lower);
  if (exact) return exact;

  const partial = CATEGORIES.find((c) =>
    c.toLowerCase().includes(lower) ||
    c.toLowerCase().split(/[\s/]+/).some((part) => part === lower),
  );
  return partial ?? null;
}

export function normalizeStatus(raw: string): OrderStatus | null {
  const val = raw.trim().toLowerCase();
  if (!val) return null;

  if (val in STATUS_META) return val as OrderStatus;

  const entries = Object.entries(STATUS_META) as Array<
    [OrderStatus, { label: string }]
  >;
  const byLabel = entries.find(([, meta]) => meta.label.toLowerCase() === val);
  return byLabel ? byLabel[0] : null;
}

export function parseDeadline(raw: string): { value: string | null; error?: string } {
  const trimmed = raw.trim();
  if (isEmptyValue(trimmed)) return { value: null };

  const lower = trimmed.toLowerCase();
  if (lower === "hari ini" || lower === "today") {
    return { value: jakartaDateISO(0) };
  }
  if (lower === "besok" || lower === "tomorrow") {
    return { value: jakartaDateISO(1) };
  }
  if (lower === "lusa") {
    return { value: jakartaDateISO(2) };
  }

  // YYYY-MM-DD
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return validateCalendarDate(Number(y), Number(m), Number(d));
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(trimmed);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return validateCalendarDate(Number(y), Number(m), Number(d));
  }

  return {
    value: null,
    error:
      "Format deadline tidak valid. Gunakan YYYY-MM-DD (misal 2026-11-20), DD/MM/YYYY, atau kata: hari ini / besok / lusa.",
  };
}

function validateCalendarDate(
  year: number,
  month: number,
  day: number,
): { value: string | null; error?: string } {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { value: null, error: "Tanggal deadline tidak valid." };
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return { value: null, error: "Tanggal deadline tidak ada di kalender." };
  }
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return { value: `${year}-${mm}-${dd}` };
}

export function parsePrice(raw: string): { value: number | null; error?: string } {
  const trimmed = raw.trim();
  if (isEmptyValue(trimmed)) return { value: null };

  let cleaned = trimmed.toLowerCase().replace(/^rp\.?\s*/i, "");
  let multiplier = 1;

  if (/(rb|ribu|k)$/.test(cleaned)) {
    multiplier = 1000;
    cleaned = cleaned.replace(/(rb|ribu|k)$/, "").trim();
  } else if (/(jt|juta)$/.test(cleaned)) {
    multiplier = 1_000_000;
    cleaned = cleaned.replace(/(jt|juta)$/, "").trim();
  }

  // Strip thousand separators (50.000 or 50,000) when multiplying by 1
  if (multiplier === 1) {
    cleaned = cleaned.replace(/[.,\s]/g, "");
  } else {
    cleaned = cleaned.replace(",", ".").replace(/\s/g, "");
  }

  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0) {
    return {
      value: null,
      error: "Format harga tidak valid. Contoh: 50000, 50.000, atau 50rb.",
    };
  }

  return { value: Math.round(num * multiplier) };
}

export function parseResultLink(raw: string): { value: string | null; error?: string } {
  const trimmed = raw.trim();
  if (isEmptyValue(trimmed)) return { value: null };

  if (!/^https?:\/\//i.test(trimmed)) {
    return {
      value: null,
      error: "Link hasil harus diawali http:// atau https://",
    };
  }
  return { value: trimmed };
}

export function parseOrderTemplate(text: string): {
  draft: OrderDraft;
  errors: string[];
} {
  // Strip leading /order or /order@botname command
  const body = text.replace(/^\/order(?:@\w+)?\s*/i, "").trim();
  const lines = body.split(/\r?\n/);

  const rawFields: Partial<Record<DraftField, string>> = {};
  let currentField: DraftField | null = null;
  const errors: string[] = [];

  for (const line of lines) {
    const match = /^([^:]+):\s*(.*)$/.exec(line);
    if (match) {
      const key = match[1].trim().toLowerCase();
      const mapped = KEY_ALIASES[key];
      if (mapped) {
        currentField = mapped;
        rawFields[mapped] = match[2].trim();
        continue;
      }
    }

    if (currentField) {
      const prev = rawFields[currentField] ?? "";
      rawFields[currentField] = prev ? `${prev}\n${line}` : line;
    }
  }

  const draft: OrderDraft = {
    category: CATEGORIES[0],
    status: "pending",
  };

  if (rawFields.client_name && !isEmptyValue(rawFields.client_name)) {
    draft.client_name = rawFields.client_name.trim();
  } else {
    errors.push("• <b>Nama</b> wajib diisi.");
  }

  if (rawFields.client_contact && !isEmptyValue(rawFields.client_contact)) {
    draft.client_contact = rawFields.client_contact.trim();
  } else {
    draft.client_contact = null;
  }

  if (rawFields.title && !isEmptyValue(rawFields.title)) {
    draft.title = rawFields.title.trim();
  } else {
    errors.push("• <b>Judul</b> wajib diisi.");
  }

  if (rawFields.category && !isEmptyValue(rawFields.category)) {
    const cat = normalizeCategory(rawFields.category);
    if (!cat) {
      errors.push(
        `• <b>Kategori</b> "${escapeHtml(rawFields.category)}" tidak dikenali. Pilihan: ${CATEGORIES.join(", ")}.`,
      );
    } else {
      draft.category = cat;
    }
  }

  if (rawFields.status && !isEmptyValue(rawFields.status)) {
    const st = normalizeStatus(rawFields.status);
    if (!st) {
      errors.push(
        `• <b>Status</b> "${escapeHtml(rawFields.status)}" tidak valid.`,
      );
    } else {
      draft.status = st;
    }
  }

  if (rawFields.deadline !== undefined) {
    const parsed = parseDeadline(rawFields.deadline);
    if (parsed.error) errors.push(`• ${parsed.error}`);
    else draft.deadline = parsed.value;
  } else {
    draft.deadline = null;
  }

  if (rawFields.price !== undefined) {
    const parsed = parsePrice(rawFields.price);
    if (parsed.error) errors.push(`• ${parsed.error}`);
    else draft.price = parsed.value;
  } else {
    draft.price = null;
  }

  if (rawFields.notes && !isEmptyValue(rawFields.notes)) {
    draft.notes = rawFields.notes.trim();
  } else {
    draft.notes = null;
  }

  if (rawFields.admin_notes && !isEmptyValue(rawFields.admin_notes)) {
    draft.admin_notes = rawFields.admin_notes.trim();
  } else {
    draft.admin_notes = null;
  }

  if (rawFields.result_link !== undefined) {
    const parsed = parseResultLink(rawFields.result_link);
    if (parsed.error) errors.push(`• ${parsed.error}`);
    else draft.result_link = parsed.value;
  } else {
    draft.result_link = null;
  }

  return { draft, errors };
}

export function formatOrderPreview(draft: OrderDraft): string {
  const statusLabel = STATUS_META[draft.status ?? "pending"].label;
  const lines = [
    "📋 <b>Konfirmasi Pesanan Baru</b>",
    "",
    `• <b>Nama Klien:</b> ${escapeHtml(draft.client_name ?? "-")}`,
    `• <b>Kontak:</b> ${draft.client_contact ? escapeHtml(draft.client_contact) : "<i>-</i>"}`,
    `• <b>Judul Tugas:</b> ${escapeHtml(draft.title ?? "-")}`,
    `• <b>Kategori:</b> ${escapeHtml(draft.category ?? CATEGORIES[0])}`,
    `• <b>Status:</b> ${escapeHtml(statusLabel)}`,
    `• <b>Deadline:</b> ${draft.deadline ? escapeHtml(formatShortDate(draft.deadline)) : "<i>-</i>"}`,
    `• <b>Harga:</b> ${draft.price != null ? escapeHtml(formatRupiah(draft.price)) : "<i>-</i>"}`,
    `• <b>Catatan Klien:</b> ${draft.notes ? escapeHtml(draft.notes) : "<i>-</i>"}`,
    `• <b>Catatan Internal:</b> ${draft.admin_notes ? escapeHtml(draft.admin_notes) : "<i>-</i>"}`,
    `• <b>Link Hasil:</b> ${draft.result_link ? escapeHtml(draft.result_link) : "<i>-</i>"}`,
  ];
  return lines.join("\n");
}

export const ORDER_TEMPLATE_TEXT = [
  "/order",
  "Nama: ",
  "Kontak: ",
  "Judul: ",
  "Kategori: Makalah",
  "Deadline: ",
  "Harga: ",
  "Catatan: ",
  "Internal: ",
  "Link: ",
].join("\n");
