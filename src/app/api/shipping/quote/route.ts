import { NextRequest, NextResponse } from "next/server";
import { cotizarEnvio } from "@/lib/envia/client";
import { prisma } from "@/lib/prisma/client";

// Rate limiting básico: 10 requests por minuto por IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now   = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

// POST /api/shipping/quote
// Body: { cp: string, items: Array<{ product_id: string, qty: number }>, total_amount: number }
// Response: { options: EnviaCarrierOption[] }
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { options: [], error: "Demasiadas solicitudes. Intentá en un minuto." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ options: [], error: "Body inválido." }, { status: 400 });
  }

  const { cp, items, total_amount } = body as {
    cp: string;
    items: Array<{ product_id: string; qty: number }>;
    total_amount: number;
  };

  if (!/^\d{4,5}$/.test(cp?.trim() ?? "")) {
    return NextResponse.json(
      { options: [], error: "El código postal debe tener 4 o 5 dígitos." },
      { status: 400 }
    );
  }

  // Obtener peso de cada producto desde la DB
  const productIds = (items ?? []).map((i) => i.product_id);
  const products   = await prisma.product.findMany({
    where:  { id: { in: productIds } },
    select: { id: true, weight_g: true },
  });

  const weightMap = Object.fromEntries(products.map((p) => [p.id, p.weight_g]));

  const pesoTotalGramos = (items ?? []).reduce((sum, item) => {
    const w = weightMap[item.product_id] ?? 200; // fallback 200g
    return sum + w * item.qty;
  }, 0);

  try {
    const options = await cotizarEnvio({
      cpDestino:       cp.trim(),
      pesoTotalGramos: pesoTotalGramos > 0 ? pesoTotalGramos : 200,
      valorDeclarado:  total_amount ?? 0,
    });
    return NextResponse.json({ options });
  } catch (err) {
    console.error("Envia.com quote error:", err);
    return NextResponse.json(
      { options: [], error: "Servicio no disponible" },
      { status: 200 }
    );
  }
}
