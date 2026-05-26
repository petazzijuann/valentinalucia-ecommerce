/**
 * Script de migración ONE-TIME: convierte productos sin color_variants
 * a un único color llamado "Único" usando sus imágenes y stock actuales.
 *
 * Correr UNA SOLA VEZ con:
 *   npx ts-node --project tsconfig.json src/scripts/migrate-color-variants.ts
 *
 * El script verifica si el producto ya fue migrado antes de tocar nada.
 */

import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { ColorVariant } from "../types";

const connectionString =
  process.env.DATABASE_URL ?? "";

if (!connectionString) {
  console.error("❌ DATABASE_URL no está configurado.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma  = new PrismaClient({ adapter });

async function main() {
  console.log("🔄 Iniciando migración de color_variants...\n");

  const products = await prisma.product.findMany();
  let migrated = 0;
  let skipped  = 0;

  for (const p of products) {
    const existing = (p.color_variants as ColorVariant[] | null) ?? [];

    if (existing.length > 0) {
      console.log(`⏩ Skipping "${p.name}" — ya tiene ${existing.length} variante(s)`);
      skipped++;
      continue;
    }

    const variant: ColorVariant = {
      name:   "Único",
      images: p.images,
      stock:  p.stock as Record<string, number>,
    };

    await prisma.product.update({
      where: { id: p.id },
      data:  { color_variants: JSON.parse(JSON.stringify([variant])) },
    });

    console.log(`✅ "${p.name}" migrado a color "Único"`);
    migrated++;
  }

  console.log(`\n✔ Migración completa: ${migrated} migrado(s), ${skipped} omitido(s).`);
}

main()
  .catch((err) => {
    console.error("❌ Error en migración:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
