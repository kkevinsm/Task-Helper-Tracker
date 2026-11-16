import { CATEGORIES } from "@/lib/utils";
import type { InlineKeyboardMarkup } from "./api";
import {
  type OrderDraft,
  formatOrderPreview,
  isEmptyValue,
  jakartaDateISO,
  normalizeCategory,
  parseDeadline,
  parsePrice,
  parseResultLink,
} from "./parser";

export type WizardStep =
  | "client_name"
  | "client_contact"
  | "title"
  | "category"
  | "deadline"
  | "price"
  | "notes"
  | "admin_notes"
  | "result_link"
  | "confirm";

export type TelegramSession = {
  chat_id: number;
  step: WizardStep;
  draft: OrderDraft;
};

export type StepPrompt = {
  text: string;
  reply_markup?: InlineKeyboardMarkup;
};

const SKIP_MARKUP: InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      { text: "⏭️ Lewati", callback_data: "wiz:skip" },
      { text: "❌ Batal", callback_data: "draft:cancel" },
    ],
  ],
};

export const CONFIRM_MARKUP: InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      { text: "✅ Simpan Pesanan", callback_data: "draft:save" },
      { text: "❌ Batal", callback_data: "draft:cancel" },
    ],
  ],
};

function categoryKeyboard(): InlineKeyboardMarkup {
  const rows: InlineKeyboardMarkup["inline_keyboard"] = [];
  for (let i = 0; i < CATEGORIES.length; i += 2) {
    const pair = CATEGORIES.slice(i, i + 2).map((cat, offset) => ({
      text: cat,
      callback_data: `wiz:cat:${i + offset}`,
    }));
    rows.push(pair);
  }
  rows.push([{ text: "❌ Batal", callback_data: "draft:cancel" }]);
  return { inline_keyboard: rows };
}

function deadlineKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "Hari Ini", callback_data: "wiz:dl:0" },
        { text: "Besok", callback_data: "wiz:dl:1" },
        { text: "Lusa", callback_data: "wiz:dl:2" },
      ],
      [
        { text: "⏭️ Lewati", callback_data: "wiz:skip" },
        { text: "❌ Batal", callback_data: "draft:cancel" },
      ],
    ],
  };
}

export function promptForStep(step: WizardStep, draft: OrderDraft): StepPrompt {
  switch (step) {
    case "client_name":
      return {
        text: "1/9 · Masukkan <b>Nama Klien</b> (wajib):\n<i>Contoh: Budi Santoso</i>",
        reply_markup: {
          inline_keyboard: [[{ text: "❌ Batal", callback_data: "draft:cancel" }]],
        },
      };
    case "client_contact":
      return {
        text: "2/9 · Masukkan <b>Kontak Klien</b> (opsional):\n<i>Contoh: 08123456789 atau @username</i>",
        reply_markup: SKIP_MARKUP,
      };
    case "title":
      return {
        text: "3/9 · Masukkan <b>Judul Tugas</b> (wajib):\n<i>Contoh: Makalah Sosiologi Bab 1–3</i>",
        reply_markup: {
          inline_keyboard: [[{ text: "❌ Batal", callback_data: "draft:cancel" }]],
        },
      };
    case "category":
      return {
        text: "4/9 · Pilih <b>Kategori</b>:",
        reply_markup: categoryKeyboard(),
      };
    case "deadline":
      return {
        text: "5/9 · Pilih atau ketik <b>Deadline</b> (opsional):\n<i>Format: YYYY-MM-DD atau DD/MM/YYYY</i>",
        reply_markup: deadlineKeyboard(),
      };
    case "price":
      return {
        text: "6/9 · Masukkan <b>Harga (Rp)</b> (opsional, hanya admin):\n<i>Contoh: 50000, 50.000, atau 50rb</i>",
        reply_markup: SKIP_MARKUP,
      };
    case "notes":
      return {
        text: "7/9 · Masukkan <b>Catatan untuk Klien</b> (opsional, tampil di halaman tracking):\n<i>Contoh: Revisi maksimal 2x. DP 50% diterima.</i>",
        reply_markup: SKIP_MARKUP,
      };
    case "admin_notes":
      return {
        text: "8/9 · Masukkan <b>Catatan Internal</b> (opsional, hanya admin):\n<i>Contoh: Referensi, detail dosen, dsb.</i>",
        reply_markup: SKIP_MARKUP,
      };
    case "result_link":
      return {
        text: "9/9 · Masukkan <b>Link Hasil / Google Drive</b> (opsional):\n<i>Harus diawali http:// atau https://</i>",
        reply_markup: SKIP_MARKUP,
      };
    case "confirm":
      return {
        text: formatOrderPreview(draft),
        reply_markup: CONFIRM_MARKUP,
      };
  }
}

export function advanceWizardText(
  session: TelegramSession,
  text: string,
): {
  nextStep?: WizardStep;
  draft: OrderDraft;
  error?: string;
} {
  const draft: OrderDraft = { ...session.draft };
  const trimmed = text.trim();

  switch (session.step) {
    case "client_name": {
      if (!trimmed || isEmptyValue(trimmed)) {
        return { draft, error: "Nama Klien wajib diisi." };
      }
      draft.client_name = trimmed;
      return { nextStep: "client_contact", draft };
    }
    case "client_contact": {
      draft.client_contact = isEmptyValue(trimmed) ? null : trimmed;
      return { nextStep: "title", draft };
    }
    case "title": {
      if (!trimmed || isEmptyValue(trimmed)) {
        return { draft, error: "Judul Tugas wajib diisi." };
      }
      draft.title = trimmed;
      return { nextStep: "category", draft };
    }
    case "category": {
      const cat = normalizeCategory(trimmed);
      if (!cat) {
        return {
          draft,
          error: `Kategori tidak dikenali. Pilih tombol di atas atau ketik salah satu: ${CATEGORIES.join(", ")}.`,
        };
      }
      draft.category = cat;
      return { nextStep: "deadline", draft };
    }
    case "deadline": {
      const parsed = parseDeadline(trimmed);
      if (parsed.error) return { draft, error: parsed.error };
      draft.deadline = parsed.value;
      return { nextStep: "price", draft };
    }
    case "price": {
      const parsed = parsePrice(trimmed);
      if (parsed.error) return { draft, error: parsed.error };
      draft.price = parsed.value;
      return { nextStep: "notes", draft };
    }
    case "notes": {
      draft.notes = isEmptyValue(trimmed) ? null : trimmed;
      return { nextStep: "admin_notes", draft };
    }
    case "admin_notes": {
      draft.admin_notes = isEmptyValue(trimmed) ? null : trimmed;
      return { nextStep: "result_link", draft };
    }
    case "result_link": {
      const parsed = parseResultLink(trimmed);
      if (parsed.error) return { draft, error: parsed.error };
      draft.result_link = parsed.value;
      return { nextStep: "confirm", draft };
    }
    case "confirm": {
      return {
        draft,
        error: "Tekan tombol <b>✅ Simpan Pesanan</b> atau <b>❌ Batal</b> di atas.",
      };
    }
  }
}

export function advanceWizardSkip(session: TelegramSession): {
  nextStep?: WizardStep;
  draft: OrderDraft;
  error?: string;
} {
  const draft: OrderDraft = { ...session.draft };
  switch (session.step) {
    case "client_contact":
      draft.client_contact = null;
      return { nextStep: "title", draft };
    case "deadline":
      draft.deadline = null;
      return { nextStep: "price", draft };
    case "price":
      draft.price = null;
      return { nextStep: "notes", draft };
    case "notes":
      draft.notes = null;
      return { nextStep: "admin_notes", draft };
    case "admin_notes":
      draft.admin_notes = null;
      return { nextStep: "result_link", draft };
    case "result_link":
      draft.result_link = null;
      return { nextStep: "confirm", draft };
    default:
      return { draft, error: "Langkah ini tidak bisa dilewati." };
  }
}

export function applyDeadlineOffset(
  session: TelegramSession,
  offsetDays: number,
): { nextStep: WizardStep; draft: OrderDraft } {
  const draft: OrderDraft = {
    ...session.draft,
    deadline: jakartaDateISO(offsetDays),
  };
  return { nextStep: "price", draft };
}
