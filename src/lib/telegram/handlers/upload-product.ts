import type { Context } from "telegraf";
import slugify from "slugify";
import { prisma } from "@/lib/prisma/client";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import { getSession, setSession, clearSession } from "../state";
import { formatARS } from "@/lib/utils";
import type { ColorVariant } from "@/types";

const CATEGORIES = ["remeras", "pantalones", "buzos", "accesorios", "calzado"];

const CATEGORY_KEYBOARD = {
  inline_keyboard: [
    [
      { text: "👕 Remeras",    callback_data: "cat:remeras" },
      { text: "👖 Pantalones", callback_data: "cat:pantalones" },
    ],
    [
      { text: "🧥 Buzos",      callback_data: "cat:buzos" },
      { text: "👜 Accesorios", callback_data: "cat:accesorios" },
    ],
    [{ text: "👟 Calzado", callback_data: "cat:calzado" }],
  ],
};

const COLOR_DECISION_KEYBOARD = {
  inline_keyboard: [[
    { text: "🎨 Un solo color",    callback_data: "upload:single_color" },
    { text: "🌈 Varios colores",   callback_data: "upload:multi_color" },
  ]],
};

const MORE_COLOR_KEYBOARD = {
  inline_keyboard: [[
    { text: "✅ Sí, agregar otro", callback_data: "upload:add_another_color" },
    { text: "🏁 No, listo",        callback_data: "upload:colors_done" },
  ]],
};

// Emoji aproximado por nombre de color
function colorEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("negro") || n.includes("black"))  return "⚫";
  if (n.includes("blanco") || n.includes("white")) return "⚪";
  if (n.includes("rojo") || n.includes("red"))     return "🔴";
  if (n.includes("verde") || n.includes("green"))  return "🟢";
  if (n.includes("azul") || n.includes("blue"))    return "🔵";
  if (n.includes("amarillo") || n.includes("yellow")) return "🟡";
  if (n.includes("naranja") || n.includes("orange"))  return "🟠";
  if (n.includes("único") || n.includes("unico"))  return "🏷";
  return "🎨";
}

export function parseStock(text: string): Record<string, number> | null {
  const stock: Record<string, number> = {};

  // Normalizar: quitar tildes (Ú→U), pasar a mayúsculas, luego capturar pares TALLE:CANTIDAD
  // Acepta talles con letras (S, M, XL), numéricos (36, 38) y ÚNICO / U
  const normalized = text
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // elimina diacríticos (Ú→U, É→E, etc.)

  // Regex ampliado: acepta letras, letras+números y números puros (ej: 36, 38)
  const pairs = normalized.match(/([A-Z][A-Z0-9]*|[0-9]+)\s*[:]\s*(\d+)/g);
  if (!pairs || pairs.length === 0) return null;

  for (const pair of pairs) {
    const [rawSize, rawQty] = pair.split(":").map((s) => s.trim());
    const qty = parseInt(rawQty);
    // Normalizar alias de talle único
    const size = (rawSize === "U" || rawSize === "UNICO") ? "ÚNICO" : rawSize;
    if (!isNaN(qty) && qty >= 0) stock[size] = qty;
  }

  return Object.keys(stock).length > 0 ? stock : null;
}

// Prompt de stock según categoría
function stockHelpText(category?: string): string {
  if (category === "pantalones") {
    return "📦 Stock por talle (numérico):\n`36:2 38:3 40:5 42:2 44:1 46:0`\nPara talle único: `U:5`";
  }
  return "📦 Stock por talle:\n`S:2 M:3 L:5 XL:2`\nPara talle único: `U:5`";
}

function stockSummary(stock: Record<string, number>): string {
  return Object.entries(stock)
    .map(([size, qty]) => `${size}:${qty}`)
    .join(" ");
}

// ── Comando /nuevo ───────────────────────────────────────────
export async function handleNuevo(ctx: Context) {
  const chatId = ctx.from!.id.toString();
  await clearSession(chatId);
  await setSession(chatId, { state: "upload_waiting_photo" });
  await ctx.reply(
    "📸 *Nuevo producto*\n\nEnviá las fotos del producto (podés mandar varias).\nCuando termines, escribí el *nombre del producto*.",
    { parse_mode: "Markdown" }
  );
}

// ── Foto recibida ────────────────────────────────────────────
export async function handlePhoto(ctx: Context) {
  const chatId  = ctx.from!.id.toString();
  const session = await getSession(chatId);

  const msg    = ctx.message as { photo?: Array<{ file_id: string }> };
  if (!msg?.photo?.length) return;

  const fileId = msg.photo[msg.photo.length - 1].file_id;

  // Estado: fotos iniciales del producto (acumula varias, sigue en este estado)
  if (session.state === "upload_waiting_photo") {
    const waiting = await ctx.reply("⏳ Subiendo foto...");
    try {
      const fileLink      = await ctx.telegram.getFileLink(fileId);
      const cloudinaryUrl = await uploadToCloudinary(fileLink.toString());

      const currentUrls  = session.uploadData?.photo_urls ?? [];
      const updatedUrls  = [...currentUrls, cloudinaryUrl];

      await setSession(chatId, {
        ...session,
        state: "upload_waiting_photo", // sigue esperando más fotos o el nombre
        uploadData: {
          ...session.uploadData,
          photo_url:  updatedUrls[0],  // compat legacy
          photo_urls: updatedUrls,
        },
      });

      await ctx.telegram.deleteMessage(ctx.chat!.id, waiting.message_id);

      if (updatedUrls.length === 1) {
        await ctx.reply(
          `📷 *Foto 1 cargada.*\nPodés enviar más fotos o escribí el *nombre del producto* para continuar.`,
          { parse_mode: "Markdown" }
        );
      } else {
        await ctx.reply(`📷 Foto ${updatedUrls.length} cargada.`);
      }
    } catch {
      await ctx.telegram.deleteMessage(ctx.chat!.id, waiting.message_id);
      await ctx.reply("❌ Error subiendo la foto. Intentá de nuevo.");
    }
    return;
  }

  // Estado: acumulando fotos para un color
  if (session.state === "upload_waiting_color_photos") {
    const waiting = await ctx.reply("⏳ Subiendo foto...");
    try {
      const fileLink      = await ctx.telegram.getFileLink(fileId);
      const cloudinaryUrl = await uploadToCloudinary(fileLink.toString());

      const currentPhotos = session.uploadData?.current_photos ?? [];
      const updatedPhotos = [...currentPhotos, cloudinaryUrl];

      await setSession(chatId, {
        ...session,
        uploadData: { ...session.uploadData, current_photos: updatedPhotos },
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
    return;
  }

  // Estado: acumulando fotos para /addcolor
  if (session.state === "addcolor_waiting_photos") {
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
    return;
  }
}

// ── Texto: ruteado por estado ────────────────────────────────
export async function handleText(ctx: Context) {
  const chatId  = ctx.from!.id.toString();
  const session = await getSession(chatId);
  const text    = (ctx.message as { text?: string })?.text?.trim() ?? "";

  switch (session.state) {

    // Nombre del producto mientras se están mandando fotos (estado inicial)
    case "upload_waiting_photo": {
      if (!(session.uploadData?.photo_urls?.length)) {
        await ctx.reply("📸 Primero enviá al menos una foto del producto.");
        break;
      }
      await setSession(chatId, {
        ...session,
        state: "upload_waiting_category",
        uploadData: { ...session.uploadData, name: text },
      });
      await ctx.reply(`📌 Nombre: *${text}*\n\n¿Categoría?`, {
        parse_mode: "Markdown",
        reply_markup: CATEGORY_KEYBOARD,
      });
      break;
    }

    case "upload_waiting_name": {
      await setSession(chatId, {
        ...session,
        state: "upload_waiting_category",
        uploadData: { ...session.uploadData, name: text },
      });
      await ctx.reply("¿Categoría?", { reply_markup: CATEGORY_KEYBOARD });
      break;
    }

    // ── Nombre del color ────────────────────────────────────
    case "upload_waiting_color_name": {
      const colorName     = text.toLowerCase().trim();
      // Mantener current_photos existentes (para primer color con foto inicial pre-cargada)
      const existingPhotos = session.uploadData?.current_photos ?? [];
      await setSession(chatId, {
        ...session,
        state: "upload_waiting_color_photos",
        uploadData: {
          ...session.uploadData,
          current_color: colorName,
          // NO resetear current_photos: el primer color ya puede tener la foto inicial
        },
      });
      if (existingPhotos.length > 0) {
        await ctx.reply(
          `🎨 Color: *${colorName.toUpperCase()}*\n\n` +
          `Ya tengo ${existingPhotos.length} foto${existingPhotos.length === 1 ? "" : "s"} cargada${existingPhotos.length === 1 ? "" : "s"} para este color. ` +
          `Podés enviar más o escribir *LISTO* para continuar.`,
          { parse_mode: "Markdown" }
        );
      } else {
        await ctx.reply(
          `🎨 Color: *${colorName.toUpperCase()}*\n\nEnviá las fotos para este color. Cuando termines escribí *LISTO*.`,
          { parse_mode: "Markdown" }
        );
      }
      break;
    }

    // ── Acumulando fotos para un color → texto "LISTO" ──────
    case "upload_waiting_color_photos": {
      if (text.toUpperCase() !== "LISTO") {
        await ctx.reply("Enviá fotos o escribí *LISTO* cuando termines.", { parse_mode: "Markdown" });
        break;
      }
      const photos = session.uploadData?.current_photos ?? [];
      if (photos.length === 0) {
        await ctx.reply("❌ Necesitás enviar al menos una foto antes de escribir LISTO.");
        break;
      }
      await setSession(chatId, {
        ...session,
        state: "upload_waiting_color_stock",
      });
      await ctx.reply(
        `✅ ${photos.length} foto${photos.length === 1 ? "" : "s"} para *${session.uploadData?.current_color?.toUpperCase()}* guardada${photos.length === 1 ? "" : "s"}.\n\n` +
        stockHelpText(session.uploadData?.category),
        { parse_mode: "Markdown" }
      );
      break;
    }

    // ── Stock del color actual ───────────────────────────────
    case "upload_waiting_color_stock": {
      const stock = parseStock(text);
      if (!stock) {
        await ctx.reply(
          `❌ Formato incorrecto.\n${stockHelpText(session.uploadData?.category)}`,
          { parse_mode: "Markdown" }
        );
        break;
      }

      const newVariant: ColorVariant = {
        name:   session.uploadData?.current_color ?? "Color",
        images: session.uploadData?.current_photos ?? [],
        stock,
      };

      const existing = session.uploadData?.color_variants ?? [];
      const updated  = [...existing, newVariant];

      await setSession(chatId, {
        ...session,
        state: "upload_color_asking_more",
        uploadData: {
          ...session.uploadData,
          color_variants:  updated,
          current_color:   undefined,
          current_photos:  undefined,
        },
      });

      await ctx.reply(
        `Stock guardado: ${stockSummary(stock)}\n\n¿Agregar otro color?`,
        { reply_markup: MORE_COLOR_KEYBOARD }
      );
      break;
    }

    // ── Stock (flujo sin color) ──────────────────────────────
    case "upload_waiting_stock": {
      const stock = parseStock(text);
      if (!stock) {
        await ctx.reply(
          `❌ Formato incorrecto.\n${stockHelpText(session.uploadData?.category)}`,
          { parse_mode: "Markdown" }
        );
        break;
      }
      await setSession(chatId, {
        ...session,
        state: "upload_waiting_price_sale",
        uploadData: { ...session.uploadData, stock },
      });
      await ctx.reply(`Stock guardado: ${stockSummary(stock)}\n\n💰 ¿Precio de venta? (ej: 25000)`);
      break;
    }

    case "upload_waiting_price_sale": {
      const price = parseFloat(text.replace(/[^\d.]/g, ""));
      if (isNaN(price) || price <= 0) {
        await ctx.reply("❌ Precio inválido. Enviá un número, ej: 25000");
        break;
      }
      await setSession(chatId, {
        ...session,
        state: "upload_waiting_price_cost",
        uploadData: { ...session.uploadData, price_sale: price },
      });
      await ctx.reply("🔒 ¿Precio de costo? (solo vos lo ves)");
      break;
    }

    case "upload_waiting_price_cost": {
      const cost = parseFloat(text.replace(/[^\d.]/g, ""));
      if (isNaN(cost) || cost <= 0) {
        await ctx.reply("❌ Precio inválido. Enviá un número, ej: 12000");
        break;
      }
      await setSession(chatId, {
        ...session,
        state: "upload_waiting_description",
        uploadData: { ...session.uploadData, price_cost: cost },
      });
      await ctx.reply(
        "📝 ¿Descripción del producto?\n_(Ej: Remera oversize de algodón premium, corte relajado.)_",
        { parse_mode: "Markdown" }
      );
      break;
    }

    case "upload_waiting_description": {
      await setSession(chatId, {
        ...session,
        state: "upload_waiting_tags",
        uploadData: { ...session.uploadData, description: text },
      });
      await ctx.reply(
        "🔖 ¿Tags? Escribilos separados por coma.\n_(Ej: oversize, algodón, básico, verano)_",
        { parse_mode: "Markdown" }
      );
      break;
    }

    case "upload_waiting_tags": {
      const tags = text.split(",").map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0);

      if (tags.length === 0) {
        await ctx.reply("❌ Escribí al menos un tag, ej: básico, verano");
        break;
      }

      const updatedData = { ...session.uploadData, tags };
      await setSession(chatId, { state: "upload_confirming", uploadData: updatedData });

      const d      = updatedData;
      const margin = d.price_sale && d.price_cost
        ? Math.round(((d.price_sale - d.price_cost) / d.price_sale) * 100)
        : 0;

      const colorVariants = d.color_variants ?? [];
      const hasColors     = colorVariants.length > 1 ||
        (colorVariants.length === 1 && colorVariants[0].name !== "Único");

      let preview = `*Vista previa del producto:*\n\n📌 *${d.name}*\n🏷 Categoría: ${d.category}\n`;

      if (hasColors) {
        preview += `🎨 Colores:\n`;
        for (const cv of colorVariants) {
          preview += `  ${colorEmoji(cv.name)} ${cv.name} — ${stockSummary(cv.stock)}\n`;
        }
      } else {
        preview += `📦 Stock: ${stockSummary(d.stock ?? {})}\n`;
      }

      preview +=
        `💰 Venta: ${formatARS(d.price_sale!)}\n` +
        `🔒 Costo: ${formatARS(d.price_cost!)} _(margen ${margin}%)_\n\n` +
        `📝 _${d.description}_\n` +
        `🔖 ${tags.join(", ")}`;

      await ctx.reply(preview, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Confirmar", callback_data: "upload:confirm" },
            { text: "❌ Cancelar", callback_data: "upload:cancel" },
          ]],
        },
      });
      break;
    }

    default:
      break;
  }
}

// ── Callback: categoría, decisión de color, confirmación ─────
export async function handleCallback(ctx: Context) {
  const chatId  = ctx.from!.id.toString();
  const session = await getSession(chatId);
  const data    = (ctx as { callbackQuery?: { data?: string } }).callbackQuery?.data ?? "";

  await ctx.answerCbQuery();

  // ── Selección de categoría → preguntar por colores ─────────
  if (data.startsWith("cat:")) {
    if (session.state !== "upload_waiting_category") return;
    const category = data.replace("cat:", "");
    if (!CATEGORIES.includes(category)) return;

    await setSession(chatId, {
      ...session,
      state: "upload_waiting_color_decision",
      uploadData: { ...session.uploadData, category },
    });
    await ctx.reply(
      `Categoría: *${category}*\n\n¿El producto tiene variantes de color?`,
      { parse_mode: "Markdown", reply_markup: COLOR_DECISION_KEYBOARD }
    );
    return;
  }

  // ── Decisión: un solo color ─────────────────────────────────
  if (data === "upload:single_color") {
    if (session.state !== "upload_waiting_color_decision") return;
    await setSession(chatId, {
      ...session,
      state: "upload_waiting_stock",
      uploadData: { ...session.uploadData, has_colors: false },
    });
    await ctx.reply(
      stockHelpText(session.uploadData?.category),
      { parse_mode: "Markdown" }
    );
    return;
  }

  // ── Decisión: varios colores ────────────────────────────────
  if (data === "upload:multi_color") {
    if (session.state !== "upload_waiting_color_decision") return;
    // Todas las fotos iniciales pasan al primer color
    const initialPhotos = session.uploadData?.photo_urls?.length
      ? session.uploadData.photo_urls
      : session.uploadData?.photo_url
        ? [session.uploadData.photo_url]
        : [];
    await setSession(chatId, {
      ...session,
      state: "upload_waiting_color_name",
      uploadData: {
        ...session.uploadData,
        has_colors:     true,
        color_variants: [],
        current_photos: initialPhotos,
      },
    });
    await ctx.reply("🎨 ¿Cómo se llama el primer color? (ej: negro, rojo, verde)");
    return;
  }

  // ── Agregar otro color ──────────────────────────────────────
  if (data === "upload:add_another_color") {
    if (session.state !== "upload_color_asking_more") return;
    await setSession(chatId, {
      ...session,
      state: "upload_waiting_color_name",
      uploadData: { ...session.uploadData, current_color: undefined, current_photos: [] },
    });
    await ctx.reply("🎨 ¿Cómo se llama el siguiente color?");
    return;
  }

  // ── Colores listos → pasar a precio ────────────────────────
  if (data === "upload:colors_done") {
    if (session.state !== "upload_color_asking_more") return;
    await setSession(chatId, {
      ...session,
      state: "upload_waiting_price_sale",
    });
    await ctx.reply("💰 ¿Precio de venta? (ej: 25000)");
    return;
  }

  // ── Confirmar producto ──────────────────────────────────────
  if (data === "upload:confirm") {
    if (session.state !== "upload_confirming") return;
    const d = session.uploadData!;

    const baseSlug = slugify(d.name!, { lower: true, strict: true });
    let slug = baseSlug;
    let suffix = 2;
    while (await prisma.product.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${suffix}`;
      suffix++;
    }

    const colorVariants = d.color_variants ?? [];
    const hasColors     = colorVariants.length > 1 ||
      (colorVariants.length === 1 && colorVariants[0].name !== "Único");

    // Imágenes: del primer color (multi-color) o todas las fotos iniciales (un solo color)
    const singleColorImages = d.photo_urls?.length ? d.photo_urls : (d.photo_url ? [d.photo_url] : []);
    const legacyImages = hasColors ? (colorVariants[0]?.images ?? singleColorImages) : singleColorImages;
    const legacyStock  = hasColors ? (colorVariants[0]?.stock  ?? d.stock ?? {}) : (d.stock ?? {});

    const product = await prisma.product.create({
      data: {
        name:           d.name!,
        slug,
        description:    d.description!,
        category:       d.category!,
        images:         legacyImages,
        tags:           d.tags!,
        price_sale:     d.price_sale!,
        price_cost:     d.price_cost!,
        stock:          legacyStock,
        color_variants: JSON.parse(JSON.stringify(colorVariants)),
        is_published:   false,
      },
    });

    await clearSession(chatId);
    await ctx.reply(
      `✅ *Producto creado*\n\n` +
      `ID: \`${product.id.slice(0, 8)}\`\n` +
      `Slug: \`${product.slug}\`\n\n` +
      `El producto está guardado como *borrador*. Publicalo desde el panel admin.`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  // ── Cancelar ────────────────────────────────────────────────
  if (data === "upload:cancel") {
    await clearSession(chatId);
    await ctx.reply("❌ Carga cancelada.");
    return;
  }
}
