import { prisma } from "@/lib/prisma/client";

/** Devuelve el singleton de settings, creándolo si no existe. */
export async function getProdeSettings() {
  return prisma.prodeSettings.upsert({
    where: { id: "main" },
    update: {},
    create: { id: "main" },
  });
}
