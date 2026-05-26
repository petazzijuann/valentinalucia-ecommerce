// Endpoint de diagnóstico — no importa NADA del codebase
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    time: new Date().toISOString(),
    node: process.version,
    env: {
      has_db: !!process.env.DATABASE_URL,
      has_supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      has_telegram: !!process.env.TELEGRAM_BOT_TOKEN,
      has_cloudinary: !!process.env.CLOUDINARY_CLOUD_NAME,
    },
  });
}
