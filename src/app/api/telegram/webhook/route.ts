import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseService } from "@/lib/supabase/admin";
import type { Order } from "@/lib/types";
import {
  CATEGORIES,
  STATUS_META,
  formatRupiah,
  formatShortDate,
  normalizeCode,
} from "@/lib/utils";
import {
  type TelegramUpdate,
  answerCallbackQuery,
  editMessageText,
  escapeHtml,
  sendMessage,
} from "@/lib/telegram/api";
import {
  ORDER_TEMPLATE_TEXT,
  type OrderDraft,
  formatOrderPreview,
  parseOrderTemplate,
} from "@/lib/telegram/parser";
import {
  CONFIRM_MARKUP,
  type TelegramSession,
  type WizardStep,
  advanceWizardSkip,
  advanceWizardText,
  applyDeadlineOffset,
  promptForStep,
} from "@/lib/telegram/wizard";

function getAdminIds(): number[] {
  const raw = process.env.TELEGRAM_ADMIN_IDS ?? "";
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

function getAppUrl(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return request.nextUrl.origin;
}

async function getSession(chatId: number): Promise<TelegramSession | null> {
  const supabase = getSupabaseService();
  const { data } = await supabase
    .from("telegram_sessions")
    .select("chat_id, step, draft")
    .eq("chat_id", chatId)
    .maybeSingle();
  if (!data) return null;
  return {
    chat_id: Number(data.chat_id),
    step: data.step as WizardStep,
    draft: (data.draft ?? {}) as OrderDraft,
  };
}

async function saveSession(
  chatId: number,
  step: WizardStep,
  draft: OrderDraft,
) {
  const supabase = getSupabaseService();
  const { error } = await supabase.from("telegram_sessions").upsert(
    {
      chat_id: chatId,
      step,
      draft,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "chat_id" },
  );
  if (error) throw error;
}

async function clearSession(chatId: number) {
  const supabase = getSupabaseService();
  await supabase.from("telegram_sessions").delete().eq("chat_id", chatId);
}

async function insertOrderFromDraft(draft: OrderDraft): Promise<Order> {
  const supabase = getSupabaseService();
  const payload = {
    client_name: draft.client_name?.trim() ?? "",
    client_contact: draft.client_contact?.trim() || null,
    title: draft.title?.trim() ?? "",
    category: draft.category || CATEGORIES[0],
    status: draft.status || "pending",
    deadline: draft.deadline || null,
    price: draft.price ?? null,
    notes: draft.notes?.trim() || null,
    admin_notes: draft.admin_notes?.trim() || null,
    result_link: draft.result_link?.trim() || null,
  };

  const { data, error } = await supabase
    .from("orders")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as Order;
}

function helpMessage(): string {
  return [
    "🤖 <b>Bot Admin urtaskhelper</b>",
    "",
    "<b>Perintah Tambah Pesanan:</b>",
    "• /baru — Panduan langkah demi langkah (interaktif)",
    "• /order — Input cepat pakai format template",
    "• /template — Salin template kosong /order",
    "• /batal — Batalkan input yang sedang berjalan",
    "",
    "<b>Perintah Lainnya:</b>",
    "• /list — Lihat 5 pesanan aktif terbaru",
    "• /status <code>ADA-001</code> — Cek detail pesanan",
    "• /id — Cek Telegram User ID Anda",
  ].join("\n");
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret) {
    const provided = request.headers.get("x-telegram-bot-api-secret-token");
    if (provided !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const adminIds = getAdminIds();
  const appUrl = getAppUrl(request);

  try {
    if (update.callback_query) {
      const cq = update.callback_query;
      const userId = cq.from.id;
      const chatId = cq.message?.chat.id;
      const messageId = cq.message?.message_id;

      if (!adminIds.includes(userId)) {
        await answerCallbackQuery(cq.id, "Akses ditolak.");
        return NextResponse.json({ ok: true });
      }
      if (!chatId || !messageId || !cq.data) {
        await answerCallbackQuery(cq.id);
        return NextResponse.json({ ok: true });
      }

      const data = cq.data;

      if (data === "draft:cancel") {
        await clearSession(chatId);
        await answerCallbackQuery(cq.id, "Dibatalkan");
        await editMessageText(chatId, messageId, "❌ Pembuatan pesanan dibatalkan.");
        return NextResponse.json({ ok: true });
      }

      if (data === "draft:save") {
        const session = await getSession(chatId);
        if (!session || !session.draft.client_name || !session.draft.title) {
          await answerCallbackQuery(cq.id, "Draft tidak ditemukan atau kadaluarsa.");
          await editMessageText(
            chatId,
            messageId,
            "⚠️ Draft tidak ditemukan. Silakan mulai ulang dengan /baru atau /order.",
          );
          return NextResponse.json({ ok: true });
        }

        const saved = await insertOrderFromDraft(session.draft);
        await clearSession(chatId);
        await answerCallbackQuery(cq.id, `Tersimpan: ${saved.tracking_code}`);

        const trackUrl = `${appUrl}/?code=${encodeURIComponent(saved.tracking_code)}`;
        await editMessageText(
          chatId,
          messageId,
          [
            "✅ <b>Pesanan berhasil disimpan!</b>",
            "",
            `• <b>Kode Antrean:</b> <code>${escapeHtml(saved.tracking_code)}</code>`,
            `• <b>Klien:</b> ${escapeHtml(saved.client_name)}`,
            `• <b>Judul:</b> ${escapeHtml(saved.title)}`,
            `• <b>Kategori:</b> ${escapeHtml(saved.category)}`,
            `• <b>Deadline:</b> ${saved.deadline ? escapeHtml(formatShortDate(saved.deadline)) : "-"}`,
            `• <b>Harga:</b> ${saved.price != null ? escapeHtml(formatRupiah(saved.price)) : "-"}`,
            "",
            `🔗 Link Tracking:\n${escapeHtml(trackUrl)}`,
          ].join("\n"),
        );
        return NextResponse.json({ ok: true });
      }

      const session = await getSession(chatId);
      if (!session) {
        await answerCallbackQuery(cq.id, "Sesi sudah berakhir.");
        return NextResponse.json({ ok: true });
      }

      if (data.startsWith("wiz:cat:")) {
        const idx = Number(data.slice("wiz:cat:".length));
        const category = CATEGORIES[idx];
        if (!category) {
          await answerCallbackQuery(cq.id, "Kategori tidak valid.");
          return NextResponse.json({ ok: true });
        }
        const nextDraft: OrderDraft = { ...session.draft, category };
        await saveSession(chatId, "deadline", nextDraft);
        await answerCallbackQuery(cq.id, category);
        const prompt = promptForStep("deadline", nextDraft);
        await editMessageText(
          chatId,
          messageId,
          `4/9 · Kategori: <b>${escapeHtml(category)}</b>\n\n${prompt.text}`,
          { reply_markup: prompt.reply_markup },
        );
        return NextResponse.json({ ok: true });
      }

      if (data.startsWith("wiz:dl:")) {
        const offset = Number(data.slice("wiz:dl:".length));
        if (!Number.isInteger(offset)) {
          await answerCallbackQuery(cq.id);
          return NextResponse.json({ ok: true });
        }
        const { nextStep, draft } = applyDeadlineOffset(session, offset);
        await saveSession(chatId, nextStep, draft);
        await answerCallbackQuery(
          cq.id,
          draft.deadline ? formatShortDate(draft.deadline) : undefined,
        );
        const prompt = promptForStep(nextStep, draft);
        await editMessageText(
          chatId,
          messageId,
          `5/9 · Deadline: <b>${escapeHtml(formatShortDate(draft.deadline))}</b>\n\n${prompt.text}`,
          { reply_markup: prompt.reply_markup },
        );
        return NextResponse.json({ ok: true });
      }

      if (data === "wiz:skip") {
        const res = advanceWizardSkip(session);
        if (res.error || !res.nextStep) {
          await answerCallbackQuery(cq.id, res.error ?? "Tidak bisa dilewati.");
          return NextResponse.json({ ok: true });
        }
        await saveSession(chatId, res.nextStep, res.draft);
        await answerCallbackQuery(cq.id, "Dilewati");
        const prompt = promptForStep(res.nextStep, res.draft);
        await editMessageText(chatId, messageId, prompt.text, {
          reply_markup: prompt.reply_markup,
        });
        return NextResponse.json({ ok: true });
      }

      await answerCallbackQuery(cq.id);
      return NextResponse.json({ ok: true });
    }

    const msg = update.message;
    if (!msg?.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    const text = msg.text.trim();
    const command = text.split(/\s+/)[0]?.toLowerCase().split("@")[0] ?? "";

    // Allow /id even before TELEGRAM_ADMIN_IDS is configured so admin can get their ID.
    if (command === "/id") {
      await sendMessage(
        chatId,
        `🆔 Telegram User ID Anda: <code>${userId ?? chatId}</code>`,
      );
      return NextResponse.json({ ok: true });
    }

    if (!userId || !adminIds.includes(userId)) {
      await sendMessage(chatId, "⛔ Akses ditolak. Bot ini hanya untuk admin.");
      return NextResponse.json({ ok: true });
    }

    if (command === "/start" || command === "/help") {
      await sendMessage(chatId, helpMessage());
      return NextResponse.json({ ok: true });
    }

    if (command === "/template") {
      await sendMessage(
        chatId,
        `Salin dan isi template berikut:\n\n<pre>${escapeHtml(ORDER_TEMPLATE_TEXT)}</pre>\n<i>Field selain Nama &amp; Judul boleh dikosongkan atau dihapus barisnya.</i>`,
      );
      return NextResponse.json({ ok: true });
    }

    if (command === "/batal") {
      await clearSession(chatId);
      await sendMessage(chatId, "❌ Sesi input dibatalkan.");
      return NextResponse.json({ ok: true });
    }

    if (command === "/baru") {
      const initialDraft: OrderDraft = {
        category: CATEGORIES[0],
        status: "pending",
      };
      await saveSession(chatId, "client_name", initialDraft);
      const prompt = promptForStep("client_name", initialDraft);
      await sendMessage(chatId, prompt.text, {
        reply_markup: prompt.reply_markup,
      });
      return NextResponse.json({ ok: true });
    }

    if (command === "/order") {
      const bodyOnly = text.replace(/^\/order(?:@\w+)?\s*/i, "").trim();
      if (!bodyOnly) {
        await sendMessage(
          chatId,
          `Kirim <code>/order</code> diikuti detail pesanan. Contoh:\n\n<pre>${escapeHtml(ORDER_TEMPLATE_TEXT)}</pre>`,
        );
        return NextResponse.json({ ok: true });
      }

      const { draft, errors } = parseOrderTemplate(text);
      if (errors.length > 0) {
        await sendMessage(
          chatId,
          `⚠️ <b>Format belum lengkap:</b>\n${errors.join("\n")}\n\nKetik /template untuk melihat contoh format.`,
        );
        return NextResponse.json({ ok: true });
      }

      await saveSession(chatId, "confirm", draft);
      await sendMessage(chatId, formatOrderPreview(draft), {
        reply_markup: CONFIRM_MARKUP,
      });
      return NextResponse.json({ ok: true });
    }

    if (command === "/list") {
      const supabase = getSupabaseService();
      const { data, error } = await supabase
        .from("orders")
        .select("tracking_code, client_name, title, status, deadline")
        .in("status", ["pending", "in_progress", "revision"])
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      if (!data || data.length === 0) {
        await sendMessage(chatId, "✨ Tidak ada pesanan aktif saat ini.");
        return NextResponse.json({ ok: true });
      }

      const rows = data.map((o) => {
        const label = STATUS_META[o.status as keyof typeof STATUS_META]?.label ?? o.status;
        const dl = o.deadline ? ` · DL ${formatShortDate(o.deadline)}` : "";
        return `• <code>${escapeHtml(o.tracking_code)}</code> — <b>${escapeHtml(o.client_name)}</b>\n  ${escapeHtml(o.title)} (<i>${escapeHtml(label)}</i>${escapeHtml(dl)})`;
      });

      await sendMessage(
        chatId,
        `📌 <b>5 Pesanan Aktif Terbaru</b>\n\n${rows.join("\n\n")}`,
      );
      return NextResponse.json({ ok: true });
    }

    if (command === "/status") {
      const arg = text.slice("/status".length).trim();
      if (!arg) {
        await sendMessage(
          chatId,
          "Gunakan: <code>/status ADA-001</code>",
        );
        return NextResponse.json({ ok: true });
      }
      const code = normalizeCode(arg);
      const supabase = getSupabaseService();
      const { data: order, error } = await supabase
        .from("orders")
        .select("*")
        .eq("tracking_code", code)
        .maybeSingle();

      if (error) throw error;
      if (!order) {
        await sendMessage(
          chatId,
          `Pesanan <code>${escapeHtml(code)}</code> tidak ditemukan.`,
        );
        return NextResponse.json({ ok: true });
      }

      const o = order as Order;
      const statusLabel = STATUS_META[o.status].label;
      await sendMessage(
        chatId,
        [
          `🔎 <b>Detail ${escapeHtml(o.tracking_code)}</b>`,
          `• <b>Klien:</b> ${escapeHtml(o.client_name)}${o.client_contact ? ` (${escapeHtml(o.client_contact)})` : ""}`,
          `• <b>Judul:</b> ${escapeHtml(o.title)}`,
          `• <b>Kategori:</b> ${escapeHtml(o.category)}`,
          `• <b>Status:</b> ${escapeHtml(statusLabel)}`,
          `• <b>Deadline:</b> ${o.deadline ? escapeHtml(formatShortDate(o.deadline)) : "-"}`,
          `• <b>Harga:</b> ${o.price != null ? escapeHtml(formatRupiah(o.price)) : "-"}`,
          `• <b>Catatan Klien:</b> ${o.notes ? escapeHtml(o.notes) : "-"}`,
          `• <b>Catatan Internal:</b> ${o.admin_notes ? escapeHtml(o.admin_notes) : "-"}`,
        ].join("\n"),
      );
      return NextResponse.json({ ok: true });
    }

    if (text.startsWith("/")) {
      await sendMessage(
        chatId,
        "Perintah tidak dikenal. Ketik /help untuk daftar perintah.",
      );
      return NextResponse.json({ ok: true });
    }

    // Handle active wizard step for plain text messages
    const session = await getSession(chatId);
    if (!session) {
      await sendMessage(
        chatId,
        "Ketik /baru untuk input pesanan langkah demi langkah, atau /order untuk format template.",
      );
      return NextResponse.json({ ok: true });
    }

    const res = advanceWizardText(session, text);
    if (res.error || !res.nextStep) {
      await sendMessage(chatId, `⚠️ ${res.error ?? "Input tidak valid."}`);
      return NextResponse.json({ ok: true });
    }

    await saveSession(chatId, res.nextStep, res.draft);
    const prompt = promptForStep(res.nextStep, res.draft);
    await sendMessage(chatId, prompt.text, {
      reply_markup: prompt.reply_markup,
    });
  } catch (err) {
    console.error("Telegram webhook error:", err);
  }

  return NextResponse.json({ ok: true });
}
