// Documentación oficial: https://developers.envia.com/
// Confirmar endpoints, estructura de body y respuesta con las credenciales reales.

const BASE = process.env.ENVIA_API_BASE ?? "https://api.envia.com";

function getHeaders() {
  const apiKey = process.env.ENVIA_API_KEY;
  if (!apiKey) throw new Error("ENVIA_API_KEY no configurada");
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

export interface EnviaQuoteInput {
  cpDestino:       string;
  pesoTotalGramos: number;  // suma de (weight_g * qty) de todos los items
  valorDeclarado:  number;  // total del carrito en ARS
}

export interface EnviaCarrierOption {
  type:       string;
  label:      string;
  days_label: string;
  cost:       number;
  carrier_id: string;
}

export async function cotizarEnvio(input: EnviaQuoteInput): Promise<EnviaCarrierOption[]> {
  const cpOrigen    = process.env.ENVIA_ORIGIN_CP;
  const widthCm     = parseFloat(process.env.ENVIA_PACKAGE_WIDTH_CM  ?? "20");
  const heightCm    = parseFloat(process.env.ENVIA_PACKAGE_HEIGHT_CM ?? "5");
  const lengthCm    = parseFloat(process.env.ENVIA_PACKAGE_LENGTH_CM ?? "30");
  const markupPct   = parseFloat(process.env.ENVIA_MARKUP_PERCENT    ?? "0");
  const pesoKg      = input.pesoTotalGramos / 1000;

  const res = await fetch(`${BASE}/ship/rate/`, {
    method:  "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      origin:      { cp: cpOrigen },
      destination: { cp: input.cpDestino },
      package: {
        weight:         pesoKg,
        width:          widthCm,
        height:         heightCm,
        length:         lengthCm,
        declared_value: input.valorDeclarado,
        content:        "Indumentaria",
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error(`Envia.com cotizar: HTTP ${res.status}`);

  const data = await res.json();
  return mapQuoteResponse(data, markupPct);
}

function applyMarkup(baseCost: number, markupPct: number): number {
  if (!markupPct || markupPct <= 0) return baseCost;
  // Redondear al entero más cercano para no mostrar decimales en ARS
  return Math.round(baseCost * (1 + markupPct / 100));
}

function mapQuoteResponse(data: unknown, markupPct: number): EnviaCarrierOption[] {
  // Estructura esperada según la doc de Envia.com — ajustar al response real.
  const carriers = Array.isArray(data)
    ? data
    : (data as { data?: unknown[] }).data ?? [];

  return (carriers as Record<string, unknown>[]).map((c) => {
    const carrierName = String(c.carrier ?? c.name ?? "").toLowerCase();
    const days        = String(c.estimated_days ?? c.days ?? "");
    const rawCost     = Number(c.total_price ?? c.price ?? c.cost ?? 0);
    const cost        = applyMarkup(rawCost, markupPct);

    const labelMap: Record<string, string> = {
      andreani:           "Andreani",
      oca:                "OCA",
      correo_argentino:   "Correo Argentino",
      "correo argentino": "Correo Argentino",
    };
    const label =
      labelMap[carrierName] ??
      (carrierName.charAt(0).toUpperCase() + carrierName.slice(1));

    return {
      type:       carrierName,
      label,
      days_label: days ? `${days} días hábiles` : "A confirmar",
      cost,
      carrier_id: String(c.carrier_id ?? c.id ?? carrierName),
    };
  });
}
