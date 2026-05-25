import { getOpenAI } from "./client";
import { formatARS } from "@/lib/utils";

interface CaptionInput {
  name:        string;
  category:    string;
  description: string;
  tags:        string[];
  price_sale:  number;
}

export async function generateInstagramCaption(product: CaptionInput): Promise<string> {
  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Sos el community manager de Valentina Lucia, marca de indumentaria femenina argentina. " +
          "Escribis captions de Instagram que combinan estetica editorial con copy de ventas efectivo. " +
          "Tono: seguro, aspiracional y directo. Español rioplatense sin emojis excesivos. " +
          "Formato obligatorio (respeta exactamente el orden):\n" +
          "1. Hook de 1-2 lineas (max. 80 chars)\n" +
          "2. Linea vacia\n" +
          "3. Descripcion de 1-2 oraciones\n" +
          "4. Linea vacia\n" +
          "5. Precio y CTA (usa exactamente: 💰 [precio] | 🔗 Link en bio)\n" +
          "NO incluyas hashtags — se agregan por separado.\n" +
          "Responde SOLO con el texto, sin comillas.",
      },
      {
        role: "user",
        content:
          `Producto: "${product.name}"\n` +
          `Categoria: ${product.category}\n` +
          `Descripcion: ${product.description}\n` +
          `Precio: ${formatARS(product.price_sale)}\n` +
          `Tags: ${product.tags.join(", ")}`,
      },
    ],
    max_tokens: 250,
    temperature: 0.8,
  });

  const body = (completion.choices[0].message.content ?? "").trim();

  const hashtags = [
    "#valentinalucia",
    "#valentinalucia_arg",
    `#${product.category}`,
    ...product.tags.map((t) => `#${t.replace(/\s+/g, "").toLowerCase()}`),
    "#modaargentina",
    "#streetstyle",
    "#ootd",
    "#indumentaria",
  ]
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(" ");

  return `${body}\n\n${hashtags}`;
}