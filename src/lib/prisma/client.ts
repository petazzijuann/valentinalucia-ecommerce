import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient(): PrismaClient {
  // Fallback placeholder so PrismaPg/PrismaClient can be instantiated at module
  // level even when DATABASE_URL is absent (e.g. during Vercel build).
  // Actual queries will fail at runtime if the URL is wrong, which is caught by
  // try/catch in each page/API route.
  const connectionString =
    process.env.DATABASE_URL ??
    "postgresql://placeholder:placeholder@localhost:5432/placeholder";

  // Limitar el pool a 3 conexiones para no superar el límite de Supabase (15 sesiones).
  const pool    = new pg.Pool({ connectionString, max: 3 });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;