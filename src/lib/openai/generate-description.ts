import { getOpenAI } from "./client";

interface GeneratedContent {
  description: string;
  tags: string[];
}

export async function generateProductContent(
  name: string,
  category: string
): Promise<GeneratedContent> {
  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Sos copywriter de Valentina Lucia, una marca de indumentaria femenina argentina. " +
          "Escribis descripciones de productos concisas, atractivas y en español rioplatense. " +
          "Responde siempre en JSON con los campos: description (max 120 chars) y tags (array de 3-5 strings en minuscula).",
      },
      {
        role: "user",
        content: `Producto: "${name}", categoria: "${category}". Genera description y tags.`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 200,
  });

  const raw = completion.choices[0].message.content ?? "{}";
  const parsed = JSON.parse(raw) as Partial<GeneratedContent>;

  return {
    description: parsed.description ?? `${name} — indumentaria femenina Valentina Lucia.`,
    tags:        parsed.tags ?? [category, "valentinalucia", "moda"],
  };
}