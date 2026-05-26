import type { Context } from "telegraf";
import { prisma } from "@/lib/prisma/client";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import { getSession, setSession, clearSession } from "../state";
import { parseStock } from "./upload-product";
import type { ColorVariant } from "@/types";

function stockSummary(stock: Record<string, number>): string {
  return Object.entries(stock).map(([s, q]) => `${s}:${q}`).join(" ");
}

// ── /addcolor ────────────────────────────────────────────────
export async function handleAddColor(ctx: Context) {
  const chatId = ctx.from!.id.toString();
  await clearSession(chatId);
  await setSession(chatId, { state: "addcolor_waiting_search" });
  await ctx.reply(
    "🔎 ¿A qué producto querés agregar un color?\nEscribí el nombre (o parte):"
  );
}

// ── Texto para estados addcolor_ ─────────────────────────────
export async function handleAddColorText(ctx: Context) {
  const chatId  = ctx.from!.id.toString();
  const session = await getSession(chatId);
  const text    = (ctx.message as { text?: string })?.text?.trim() ?? "";

  switch (session.state) {

    case "addcolor_waiting_search": {
      const matches = await prisma.product.findMany({
        where: { name: { contains: text, mode: "insensitive" } },
        select: { id: true, name: true },
        take: 8,
      });

      if (matches.length === 0) {
        await ctx.reply("❌ No encontré productos con ese nombre. Intentá de nuevo:");
        break;
      }

      await ctx.reply("Elegí el producto:", {
        reply_markup: {
          inline_keyboard: matches.map((p) => [{
            text:          p.name,
            callback_data: `addcolor:product:${p.id}`,
          }]),
        },
      });
      break;
    }

    case "addcolor_waiting_name": {
      const colorName = text.toLowerCase().trim();
      await setSession(chatId, {
        ...session,
        state: "addcolor_waiting_photos",
        addColorData: { ...session.addColorData, color_name: colorName, photos: [] },
      });
      await ctx.reply(
        `🎨 Color: *${colorName.toUpperCase()}*\n\nEnviá las fotos. Cuando termines escribí *LISTO*.`,
        { parse_mode: "Markdown" }
      );
      break;
    }

    case "addcolor_waiting_photos": {
      if (text.toUpperCase() !== "LISTO") {
        await ctx.reply("Enviá fotos o escribí *LISTO* cuando termines.", { parse_mode: "Markdown" });
        break;
      }
      const photos = session.addColorData?.photos ?? [];
      if (photos.length === 0) {
        await ctx.reply("❌ Necesitás enviar al menos una foto antes de LISTO.");
        break;
      }
      await setSession(chatId, { ...session, state: "addcolor_waiting_stock" });
      await ctx.reply(
        `✅ ${photos.length} foto${photos.length === 1 ? "" : "s"} guardada${photos.length === 1 ? "" : "s"}.\n\n📦 Stock para *${session.addColorData?.color_name?.toUpperCase()}*:\n_Ej: S:2 M:3 L:5_`,
        { parse_mode: "Markdown" }
      );
      break;
    }

    case "addcolor_waiting_stock": {
      const stock = parseStock(text);
      if (!stock) {
        await ctx.reply("❌ Formato incorrecto. Usá:\n`S:2 M:3 L:5`", { parse_mode: "Markdown" });
        break;
      }

      const ad = session.addColorData!;
      await setSession(chatId, {
        ...session,
        state: "addcolor_confirming",
        addColorData: { ...ad, stock },
      });

      await ctx.reply(
        `*Vista previa:*\n\n` +
        `Agregar color *${ad.color_name?.toUpperCase()}* a "${ad.product_name}"\n` +
        `📷 ${ad.photos?.length ?? 0} foto${(ad.photos?.length ?? 0) === 1 ? "" : "s"}\n` +
        `📦 Stock: ${stockSummary(stock)}`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[
              { text: "✅ Confirmar", callback_data: "addcolor:confirm" },
              { text: "❌ Cancelar", callback_data: "addcolor:cancel" },
            ]],
          },
        }
      );
      break;
    }

    default:
      break;
  }
}

// ── Callbacks addcolor_ ───────────────────────────────────────
export async function handleAddColorCallback(ctx: Context) {
  const chatId  = ctx.from!.id.toString();
  const session = await getSession(chatId);
  const data    = (ctx as { callbackQuery?: { data?: string } }).callbackQuery?.data ?? "";

  await ctx.answerCbQuery();

  // Selección de producto
  if (data.startsWith("addcolor:product:")) {
    const productId = data.replace("addcolor:product:", "");
    const product   = await prisma.product.findUnique({
      where:  { id: productId },
      select: { id: true, name: true },
    });
    if (!product) {
      await ctx.reply("❌ Producto no encontrado.");
      return;
    }

    await setSession(chatId, {
      ...session,
      state: "addcolor_waiting_name",
      addColorData: { product_id: product.id, product_name: product.name },
    });
    await ctx.reply(
      `Producto: *${product.name}*\n\n¿Cómo se llama el nuevo color?`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  // Confirmar
  if (data === "addcolor:confirm") {
    if (session.state !== "addcolor_confirming") return;
    const ad = session.addColorData!;

    const existing = await prisma.product.findUnique({
      where:  { id: ad.product_id! },
      select: { color_variants: true },
    });
    if (!existing) {
      await ctx.reply("❌ Producto no encontrado.");
      return;
    }

    const newVariant: ColorVariant = {
      name:   ad.color_name!,
      images: ad.photos ?? [],
      stock:  ad.stock!,
    };

    const existingVariants = (existing.color_variants as ColorVariant[] | null) ?? [];
    const updatedVariants  = [...existingVariants, newVariant];

    await prisma.product.update({
      where: { id: ad.product_id! },
      data:  { color_variants: JSON.parse(JSON.stringify(updatedVariants)) },
    });

    await clearSession(chatId);
    await ctx.reply(
      `✅ Color *${newVariant.name.toUpperCase()}* agregado a "${ad.product_name}".\n\n` +
      `El producto ahora tiene ${updatedVariants.length} color${updatedVariants.length === 1 ? "" : "es"}.`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  // Cancelar
  if (data === "addcolor:cancel") {
    await clearSession(chatId);
    await ctx.reply("❌ Cancelado.");
    return;
  }
}

// ── Fotos para /addcolor — se maneja en handlePhoto de bot.ts ─
// El handler de fotos en upload-product.ts ya cubre addcolor_waiting_photos
// porque bot.ts despacha bot.on("photo", handlePhoto) globalmente.
// handlePhoto en upload-product.ts verifica session.state === "addcolor_waiting_photos"
// Aquí solo necesitamos el upload via Cloudinary que ya está en handlePhoto.
// Exportamos un helper para que bot.ts lo use si necesita redirigir.
export async function handleAddColorPhoto(ctx: Context) {
  const chatId  = ctx.from!.id.toString();
  const session = await getSession(chatId);

  if (session.state !== "addcolor_waiting_photos") return;

  const msg    = ctx.message as { photo?: Array<{ file_id: string }> };
  if (!msg?.photo?.length) return;

  const fileId = msg.photo[msg.photo.length - 1].file_id;
  const waiting = await ctx.reply("⏳ Subiendo foto...");

  try {
    const fileLink      = await ctx.telegram.getFileLink(fileId);
    const cloudinaryUrl = await uploadToCloudinary(fileLink.toString());

    const currentPhotos = session.addColorData?.photos ?? [];
    const updatedPhotos = [...currentPhotos, cloudinaryUrl];

    await setSession(chatId, {
      ...session,
      addColorData: { ...session.addColorData, photos: updatedPhotos },
    });

    await ctx.telegram.deleteMessage(ctx.chat!.id, waiting.message_id);
    await ctx.reply(
      `📷 Foto ${updatedPhotos.length} recibida. Seguí enviando o escribí *LISTO*.`,
      { parse_mode: "Markdown" }
    );
  } catch {
    await ctx.telegram.deleteMessage(ctx.chat!.id, waiting.message_id);
    await ctx.reply("❌ Error subiendo la foto. Intentá de nuevo.");
  }
}
