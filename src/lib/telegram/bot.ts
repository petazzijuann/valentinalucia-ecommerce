import { Telegraf } from "telegraf";
import { getSession } from "./state";
import {
  handleNuevo,
  handlePhoto,
  handleText as handleUploadText,
  handleCallback as handleUploadCallback,
} from "./handlers/upload-product";
import { handleVenta, handleSaleText, handleSaleCallback } from "./handlers/sale";
import { handleMetricas, handleStock } from "./handlers/metrics";

const globalForBot = globalThis as unknown as { telegramBot: Telegraf };

// Si TELEGRAM_BOT_TOKEN no está configurado usamos un placeholder para no crashear
// al importar el módulo. El bot fallará en las llamadas a la API de Telegram,
// pero no romperá el resto de la app.
const token = process.env.TELEGRAM_BOT_TOKEN ?? "placeholder-token-not-configured";

export const bot: Telegraf =
  globalForBot.telegramBot ?? new Telegraf(token);

if (process.env.NODE_ENV !== "production") globalForBot.telegramBot = bot;

// ── Auth guard — rechaza cualquier sender que no sea el admin ────────────────
bot.use(async (ctx, next) => {
  if (ctx.from?.id.toString() !== process.env.TELEGRAM_ADMIN_CHAT_ID) {
    await ctx.reply("⛔ No autorizado.");
    return;
  }
  return next();
});

// ── Commands ─────────────────────────────────────────────────────────────────
bot.command("nuevo",    handleNuevo);
bot.command("venta",    handleVenta);
bot.command("metricas", handleMetricas);
bot.command("stock",    handleStock);
bot.command("ayuda", async (ctx) => {
  await ctx.reply(
    "*Comandos disponibles:*\n\n" +
    "/nuevo — Cargar nuevo producto\n" +
    "/venta — Registrar venta offline\n" +
    "/metricas — Ver ventas y márgenes\n" +
    "/stock — Ver stock actual\n" +
    "/ayuda — Este mensaje",
    { parse_mode: "Markdown" }
  );
});

// ── Fotos (solo durante carga de producto) ───────────────────────────────────
bot.on("photo", handlePhoto);

// ── Texto: dispatch por prefijo de estado de sesión ──────────────────────────
bot.on("text", async (ctx) => {
  const chatId  = ctx.from!.id.toString();
  const session = await getSession(chatId);

  if (session.state.startsWith("upload_")) return handleUploadText(ctx);
  if (session.state.startsWith("sale_"))   return handleSaleText(ctx);
});

// ── Callbacks: dispatch por prefijo de data ──────────────────────────────────
bot.on("callback_query", async (ctx) => {
  const data = (ctx.callbackQuery as { data?: string })?.data ?? "";

  if (data.startsWith("cat:") || data.startsWith("upload:")) {
    return handleUploadCallback(ctx);
  }
  if (
    data.startsWith("product:") ||
    data.startsWith("size:")    ||
    data.startsWith("pay:")     ||
    data.startsWith("sale:")
  ) {
    return handleSaleCallback(ctx);
  }

  await ctx.answerCbQuery();
});
