export type InlineKeyboardButton = {
  text: string;
  callback_data?: string;
  url?: string;
};

export type InlineKeyboardMarkup = {
  inline_keyboard: InlineKeyboardButton[][];
};

export type TelegramUser = {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  username?: string;
};

export type TelegramMessage = {
  message_id: number;
  from?: TelegramUser;
  chat: {
    id: number;
    type: string;
  };
  text?: string;
};

export type TelegramCallbackQuery = {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN belum dikonfigurasi.");
  }
  return token;
}

async function callTelegram(method: string, body: Record<string, unknown>) {
  const token = getBotToken();
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`Telegram API ${method} failed (${res.status}):`, errText);
  }
}

export async function sendMessage(
  chatId: number,
  text: string,
  options?: {
    reply_markup?: InlineKeyboardMarkup;
    disable_web_page_preview?: boolean;
  },
) {
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: options?.disable_web_page_preview ?? true,
    ...(options?.reply_markup ? { reply_markup: options.reply_markup } : {}),
  });
}

export async function editMessageText(
  chatId: number,
  messageId: number,
  text: string,
  options?: {
    reply_markup?: InlineKeyboardMarkup;
    disable_web_page_preview?: boolean;
  },
) {
  await callTelegram("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: options?.disable_web_page_preview ?? true,
    ...(options?.reply_markup ? { reply_markup: options.reply_markup } : {}),
  });
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
) {
  await callTelegram("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  });
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
