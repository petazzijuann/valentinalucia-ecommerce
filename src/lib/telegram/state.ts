import { prisma } from "@/lib/prisma/client";
import type { ColorVariant } from "@/types";

export type BotState =
  | "idle"
  | "upload_waiting_photo"
  | "upload_waiting_name"
  | "upload_waiting_category"
  // variantes de color
  | "upload_waiting_color_decision"
  | "upload_waiting_color_name"
  | "upload_waiting_color_photos"
  | "upload_waiting_color_stock"
  | "upload_color_asking_more"
  // flujo sin color (o después de resolver colores)
  | "upload_waiting_stock"
  | "upload_waiting_price_sale"
  | "upload_waiting_price_cost"
  | "upload_waiting_description"
  | "upload_waiting_tags"
  | "upload_confirming"
  // ventas
  | "sale_waiting_search"
  | "sale_waiting_size"
  | "sale_waiting_quantity"
  | "sale_waiting_price"
  | "sale_waiting_payment"
  | "sale_confirming"
  // /addcolor
  | "addcolor_waiting_search"
  | "addcolor_waiting_name"
  | "addcolor_waiting_photos"
  | "addcolor_waiting_stock"
  | "addcolor_confirming";

export interface UploadData {
  photo_url?:      string;    // backward compat — primera foto (legacy)
  photo_urls?:     string[];  // todas las fotos iniciales del producto
  name?:           string;
  category?:       string;
  stock?:          Record<string, number>;
  price_sale?:     number;
  price_cost?:     number;
  description?:    string;
  tags?:           string[];
  // campos para variantes de color
  has_colors?:     boolean;
  current_color?:  string;
  current_photos?: string[];
  color_variants?: ColorVariant[];
}

export interface SaleData {
  product_id?:      string;
  product_name?:    string;
  product_cost?:    number;
  suggested_price?: number;
  size?:            string;
  quantity?:        number;
  sale_price?:      number;
  payment_method?:  string;
}

export interface AddColorData {
  product_id?:   string;
  product_name?: string;
  color_name?:   string;
  photos?:       string[];
  stock?:        Record<string, number>;
}

export interface BotSessionData {
  state:          BotState;
  uploadData?:    UploadData;
  saleData?:      SaleData;
  addColorData?:  AddColorData;
}

export async function getSession(chatId: string): Promise<BotSessionData> {
  const row = await prisma.telegramSession.findUnique({ where: { chat_id: chatId } });
  if (!row) return { state: "idle" };
  return { state: row.state as BotState, ...(row.data as object) };
}

export async function setSession(chatId: string, data: BotSessionData): Promise<void> {
  await prisma.telegramSession.upsert({
    where:  { chat_id: chatId },
    update: { state: data.state, data: data as object },
    create: { chat_id: chatId, state: data.state, data: data as object },
  });
}

export async function clearSession(chatId: string): Promise<void> {
  await prisma.telegramSession.upsert({
    where:  { chat_id: chatId },
    update: { state: "idle", data: {} },
    create: { chat_id: chatId, state: "idle", data: {} },
  });
}
