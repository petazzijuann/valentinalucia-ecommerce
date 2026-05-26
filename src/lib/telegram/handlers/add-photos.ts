import type { Context } from "telegraf";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma/client";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import { getSession, setSession, clearSession } from "../state";
import type { ColorVariant } from "@/types";

// ── /addphotos ────────────────────────────────────────────────
export async function handleAddPhotos(ctx: Context) {
  const chatId = ctx.from!.id.toString();
  await clearSession(chatId);
  await setSession(chatId, { state: "addphotos_waiting_search" });
  await ctx.reply(
    "🖼 *Agregar fotos a un producto*\n\n¿A qué producto querés agregar fotos?\nEscribí el nombre (o parte):",
    { parse_mode: "Markdown" }
  );
}

// ── Texto para estados addphotos_ ─────────────────────────────
export async function handleAddPhotosText(ctx: Context) {
  const chatId  = ctx.from!.id.toString();
  const session = await getSession(chatId);
  const text    = (ctx.message as { text?: string })?.text?.trim() ?? "";

  switch (session.state) {

    case "addphotos_waiting_search": {
      const matches = await prisma.product.findMany({
        where:  { name: { contains: text, mode: "insensitive" } },
        select: { id: true, name: true, slug: true, color_variants: true, images: true },
        take:   8,
      });

      if (matches.length === 0) {
        await ctx.reply("❌ No encontré productos con ese nombre. Intentá de nuevo:");
        break;
      }

      await ctx.reply("Elegí el producto:", {
        reply_markup: {
          inline_keyboard: matches.map((p) => [{
            text:          p.name,
            callback_data: `addphotos:product:${p.id}`,
          }]),
        },
      });
      break;
    }

    case "addphotos_waiting_photos": {
      if (text.toUpperCase() !== "LISTO") {
        await ctx.reply("Enviá fotos o escribí *LISTO* cuando termines.", { parse_mode: "Markdown" });
        break;
      }
      const photos = session.addPhotosData?.photos ?? [];
      if (photos.length === 0) {
        await ctx.reply("❌ Necesitás enviar al menos una foto antes de LISTO.");
        break;
      }

      const ap          = session.addPhotosData!;
      const colorLabel  = ap.color_index === -1
        ? "producto (sin color)"
        : `color *${ap.color_name?.toUpperCase()}*`;

      await setSession(chatId, { ...session, state: "addphotos_confirming" });
      await ctx.reply(
        `*Vista previa:*\n\n` +
        `Agregar *${photos.length} foto${photos.length === 1 ? "" : "s"}* al ${colorLabel} de "${ap.product_name}"`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[
              { text: "✅ Confirmar", callback_data: "addphotos:confirm" },
              { text: "❌ Cancelar", callback_data: "addphotos:cancel" },
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

// ── Foto recibida en /addphotos ───────────────────────────────
export async function handleAddPhotosPhoto(ctx: Context) {
  const chatId  = ctx.from!.id.toString();
  const session = await getSession(chatId);

  if (session.state !== "addphotos_waiting_photos") return;

  const msg    = ctx.message as { photo?: Array<{ file_id: string }> };
  if (!msg?.photo?.length) return;

  const fileId  = msg.photo[msg.photo.length - 1].file_id;
  const waiting = await ctx.reply("⏳ Subiendo foto...");

  try {
    const fileLink      = await ctx.telegram.getFileLink(fileId);
    const cloudinaryUrl = await uploadToCloudinary(fileLink.toString());

    const current = session.addPhotosData?.photos ?? [];
    const updated = [...current, cloudinaryUrl];

    await setSession(chatId, {
      ...session,
      addPhotosData: { ...session.addPhotosData, photos: updated },
    });

    await ctx.telegram.deleteMessage(ctx.chat!.id, waiting.message_id);
    await ctx.reply(
      `📷 Foto ${updated.length} recibida. Seguí enviando o escribí *LISTO*.`,
      { parse_mode: "Markdown" }
    );
  } catch {
    await ctx.telegram.deleteMessage(ctx.chat!.id, waiting.message_id);
    await ctx.reply("❌ Error subiendo la foto. Intentá de nuevo.");
  }
}

// ── Callbacks addphotos_ ──────────────────────────────────────
export async function handleAddPhotosCallback(ctx: Context) {
  const chatId  = ctx.from!.id.toString();
  const session = await getSession(chatId);
  const data    = (ctx as { callbackQuery?: { data?: string } }).callbackQuery?.data ?? "";

  await ctx.answerCbQuery();

  // ── Producto seleccionado ─────────────────────────────────────
  if (data.startsWith("addphotos:product:")) {
    const productId = data.replace("addphotos:product:", "");
    const product   = await prisma.product.findUnique({
      where:  { id: productId },
      select: { id: true, name: true, slug: true, images: true, color_variants: true },
    });
    if (!product) { await ctx.reply("❌ Producto no encontrado."); return; }

    const variants = (product.color_variants as ColorVariant[] | null) ?? [];
    const hasRealColors = variants.length > 1 ||
      (variants.length === 1 && variants[0].name !== "Único");

    if (!hasRealColors) {
      // Sin variantes de color reales → agregar directo a product.images
      const existing = variants.length === 1 ? variants[0].images : product.images;
      await setSession(chatId, {
        ...session,
        state: "addphotos_waiting_photos",
        addPhotosData: {
          product_id:   product.id,
          product_name: product.name,
          product_slug: product.slug,
          color_index:  -1,
          color_name:   undefined,
          photos:       [],
        },
      });
      await ctx.reply(
        `📦 Producto: *${product.name}*\n` +
        `Fotos actuales: ${existing.length}\n\n` +
        `Enviá las nuevas fotos. Escribí *LISTO* cuando termines.`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    // Con variantes de color → mostrar botones por color
    await setSession(chatId, {
      ...session,
      state: "addphotos_waiting_color",
      addPhotosData: {
        product_id:   product.id,
        product_name: product.name,
        product_slug: product.slug,
        photos:       [],
      },
    });
    await ctx.reply(
      `🎨 *${product.name}* tiene varios colores.\n¿A cuál querés agregar fotos?`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: variants.map((cv, idx) => [{
            text:          `${cv.name.toUpperCase()} (${cv.images.length} foto${cv.images.length === 1 ? "" : "s"})`,
            callback_data: `addphotos:color:${idx}`,
          }]),
        },
      }
    );
    return;
  }

  // ── Color seleccionado ────────────────────────────────────────
  if (data.startsWith("addphotos:color:")) {
    if (session.state !== "addphotos_waiting_color") return;
    const colorIdx = parseInt(data.replace("addphotos:color:", ""));

    const product = await prisma.product.findUnique({
      where:  { id: session.addPhotosData?.product_id! },
      select: { color_variants: true },
    });
    const variants   = (product?.color_variants as ColorVariant[] | null) ?? [];
    const chosenColor = variants[colorIdx];
    if (!chosenColor) { await ctx.reply("❌ Color no encontrado."); return; }

    await setSession(chatId, {
      ...session,
      state: "addphotos_waiting_photos",
      addPhotosData: {
        ...session.addPhotosData,
        color_index: colorIdx,
        color_name:  chosenColor.name,
        photos:      [],
      },
    });
    await ctx.reply(
      `🎨 Color: *${chosenColor.name.toUpperCase()}*\n` +
      `Fotos actuales: ${chosenColor.images.length}\n\n` +
      `Enviá las nuevas fotos. Escribí *LISTO* cuando termines.`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  // ── Confirmar ─────────────────────────────────────────────────
  if (data === "addphotos:confirm") {
    if (session.state !== "addphotos_confirming") return;
    const ap       = session.addPhotosData!;
    const newPhotos = ap.photos ?? [];

    const product = await prisma.product.findUnique({
      where:  { id: ap.product_id! },
      select: { images: true, color_variants: true, slug: true },
    });
    if (!product) { await ctx.reply("❌ Producto no encontrado."); return; }

    const variants = (product.color_variants as ColorVariant[] | null) ?? [];

    if (ap.color_index === -1) {
      // Sin variantes de color → actualizar images y color_variants[0].images si existe
      const updatedImages = [...product.images, ...newPhotos];
      const updatedVariants = variants.length > 0
        ? variants.map((cv, i) => i === 0 ? { ...cv, images: [...cv.images, ...newPhotos] } : cv)
        : variants;

      await prisma.product.update({
        where: { id: ap.product_id! },
        data:  {
          images:         updatedImages,
          ...(updatedVariants.length > 0 && {
            color_variants: JSON.parse(JSON.stringify(updatedVariants)),
          }),
        },
      });
    } else {
      // Con variantes de color → actualizar el color elegido
      const updatedVariants = variants.map((cv, i) =>
        i === ap.color_index
          ? { ...cv, images: [...cv.images, ...newPhotos] }
          : cv
      );
      // También actualizar images (legacy) si es el primer color
      const updatedImages = ap.color_index === 0
        ? [...product.images, ...newPhotos]
        : product.images;

      await prisma.product.update({
        where: { id: ap.product_id! },
        data:  {
          color_variants: JSON.parse(JSON.stringify(updatedVariants)),
          ...(ap.color_index === 0 && { images: updatedImages }),
        },
      });
    }

    revalidatePath(`/producto/${product.slug}`);
    revalidatePath("/tienda");

    await clearSession(chatId);
    await ctx.reply(
      `✅ *${newPhotos.length} foto${newPhotos.length === 1 ? "" : "s"} agregada${newPhotos.length === 1 ? "" : "s"}* a "${ap.product_name}"` +
      (ap.color_index !== -1 ? ` (color ${ap.color_name?.toUpperCase()})` : "") +
      `.\n\nLos cambios ya están disponibles en la tienda.`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  // ── Cancelar ──────────────────────────────────────────────────
  if (data === "addphotos:cancel") {
    await clearSession(chatId);
    await ctx.reply("❌ Cancelado.");
    return;
  }
}
