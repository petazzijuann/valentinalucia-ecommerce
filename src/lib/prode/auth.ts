import {
  scryptSync,
  randomBytes,
  timingSafeEqual,
  createHmac,
} from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma/client";

const COOKIE_NAME = "prode_session";

function getSecret(): string {
  const secret = process.env.PRODE_SESSION_SECRET;
  if (secret) return secret;
  // En producción, un secreto conocido permitiría falsificar cookies de sesión.
  if (process.env.NODE_ENV === "production") {
    throw new Error("PRODE_SESSION_SECRET no está configurado");
  }
  return "dev-insecure-prode-secret";
}

// ── Password hashing (scrypt, formato "salt:hash") ──────────────

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuf = Buffer.from(hash, "hex");
  const testBuf = scryptSync(password, salt, 64);
  return hashBuf.length === testBuf.length && timingSafeEqual(hashBuf, testBuf);
}

// ── Firma de la cookie (HMAC) ───────────────────────────────────

function sign(playerId: string): string {
  return createHmac("sha256", getSecret()).update(playerId).digest("hex");
}

function verifyToken(token: string | undefined): string | null {
  if (!token) return null;
  const idx = token.lastIndexOf(".");
  if (idx <= 0) return null;
  const playerId = token.slice(0, idx);
  const signature = token.slice(idx + 1);
  const expected = sign(playerId);
  const sigBuf = Buffer.from(signature, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  return playerId;
}

// ── Sesión ──────────────────────────────────────────────────────

export async function createSession(playerId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, `${playerId}.${sign(playerId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 60, // 60 días
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Lee la cookie, valida la firma y devuelve el player (o null). */
export async function getSessionPlayer() {
  const store = await cookies();
  const playerId = verifyToken(store.get(COOKIE_NAME)?.value);
  if (!playerId) return null;
  try {
    return await prisma.prodePlayer.findUnique({ where: { id: playerId } });
  } catch {
    return null;
  }
}
