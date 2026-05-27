import { NextRequest, NextResponse } from "next/server";
import { cotizarEnviocom } from "@/lib/enviador/client";
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
// Body: { cp_destino, city_destino, state_destino, cart_items: [{ product_id, qty }], subtotal }
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

  const { cp_destino, city_destino, state_destino, cart_items, subtotal } = body as {
    cp_destino:    string;
    city_destino:  string;
    state_destino: string;
    cart_items:    Array<{ product_id: string; qty: number }>;
    subtotal:      number;
  };

  if (!/^\d{4,5}$/.test(cp_destino?.trim() ?? "")) {
    return NextResponse.json(
      { options: [], error: "El código postal debe tener 4 o 5 dígitos." },
      { status: 400 }
    );
  }
  if (!city_destino?.trim() || !state_destino?.trim()) {
    return NextResponse.json(
      { options: [], error: "Ciudad y provincia requeridas." },
      { status: 400 }
    );
  }

  // Obtener peso de cada producto desde la DB
  const productIds = (cart_items ?? []).map((i) => i.product_id);
  const products   = await prisma.product.findMany({
    where:  { id: { in: productIds } },
    select: { id: true, weight_g: true },
  });
  const weightMap = Object.fromEntries(products.map((p) => [p.id, p.weight_g]));

  const defaultWeightKg = parseFloat(process.env.ENVIADOR_DEFAULT_WEIGHT_KG ?? "0.5");
  const pesoTotalGramos = (cart_items ?? []).reduce((sum, item) => {
    const g = weightMap[item.product_id] ?? Math.round(defaultWeightKg * 1000);
    return sum + g * item.qty;
  }, 0);

  try {
    const options = await cotizarEnviocom({
      cpDestino:       cp_destino.trim(),
      cityDestino:     city_destino.trim(),
      stateDestino:    state_destino.trim(),
      pesoTotalGramos: pesoTotalGramos > 0 ? pesoTotalGramos : Math.round(defaultWeightKg * 1000),
      valorDeclarado:  subtotal ?? 0,
    });
    return NextResponse.json({ options });
  } catch (err) {
    console.error("Enviador quote error:", err);
    return NextResponse.json(
      { options: [], error: "Servicio no disponible. Podés continuar sin cotización." },
      { status: 200 }
    );
  }
}
