// Cliente Envia.com — hace una request por carrier en paralelo.
// La API requiere shipment.carrier específico, no acepta string vacío ni su omisión.
// Documentación: https://developers.envia.com/

const BASE = process.env.ENVIADOR_API_BASE ?? "https://api.envia.com";

// Carriers disponibles — agregar/quitar según el plan en Envia.com
const CARRIERS = ["andreani", "correo-argentino"] as const;

function getHeaders() {
  const apiKey = process.env.ENVIADOR_API_KEY;
  if (!apiKey) throw new Error("ENVIADOR_API_KEY no configurada");
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

export interface EnvioOption {
  carrier_id:   string;
  carrier_name: string;
  days_label:   string;
  cost:         number;  // ARS, ya con markup aplicado
  service_id:   string;
}

export interface CotizarParams {
  cpDestino:       string;
  cityDestino:     string;
  stateDestino:    string;  // código corto, ej: "SF"
  pesoTotalGramos: number;
  valorDeclarado:  number;
}

interface RateBody {
  origin: {
    city:       string;
    state:      string;
    postalCode: string;
    country:    string;
  };
  destination: {
    city:       string;
    state:      string;
    postalCode: string;
    country:    string;
  };
  packages: Array<{
    weight:          number;
    length:          number;
    width:           number;
    height:          number;
    declared_value?: number;
  }>;
  shipment: {
    carrier: string;
  };
}

async function cotizarCarrier(
  carrier: string,
  body: Omit<RateBody, "shipment">,
  markupPct: number
): Promise<EnvioOption | null> {
  const fullBody: RateBody = { ...body, shipment: { carrier } };

  try {
    const res = await fetch(`${BASE}/ship/rate/`, {
      method:  "POST",
      headers: getHeaders(),
      body:    JSON.stringify(fullBody),
      signal:  AbortSignal.timeout(10_000),
    });

    const json = await res.json();
    console.log(`[enviador:${carrier}]`, JSON.stringify(json).slice(0, 500));

    if (!res.ok) return null;

    // La API puede devolver el resultado directamente o dentro de { data: [...] }
    const results: Record<string, unknown>[] = Array.isArray(json)
      ? json
      : Array.isArray(json?.data)
        ? json.data
        : [json];

    if (results.length === 0) return null;

    const r         = results[0];
    const rawCost   = Number(r.total_price ?? r.price ?? r.cost ?? 0);
    const cost      = markupPct > 0
      ? Math.round(rawCost * (1 + markupPct / 100))
      : rawCost;

    const days      = String(r.estimated_days ?? r.days ?? "");
    const serviceId = String(r.service_id ?? r.id ?? carrier);

    const labelMap: Record<string, string> = {
      andreani:          "Andreani",
      "correo-argentino": "Correo Argentino",
      oca:               "OCA",
    };
    const carrierName = labelMap[carrier] ?? (carrier.charAt(0).toUpperCase() + carrier.slice(1));

    return {
      carrier_id:   carrier,
      carrier_name: carrierName,
      days_label:   days ? `${days} días hábiles` : "A confirmar",
      cost,
      service_id:   serviceId,
    };
  } catch (err) {
    console.error(`[enviador:${carrier}] error:`, err);
    return null;
  }
}

export async function cotizarEnviocom(params: CotizarParams): Promise<EnvioOption[]> {
  const cpOrigen   = process.env.ENVIADOR_ORIGIN_CP   ?? "2000";
  const cityOrigen = process.env.ENVIADOR_ORIGIN_CITY ?? "Rosario";
  const stateOrig  = process.env.ENVIADOR_ORIGIN_STATE ?? "SF";
  const country    = process.env.ENVIADOR_COUNTRY      ?? "AR";
  const markupPct  = parseFloat(process.env.ENVIADOR_MARKUP_PERCENT ?? "0");

  const largo  = parseFloat(process.env.ENVIADOR_BOX_LARGO_CM ?? "40");
  const ancho  = parseFloat(process.env.ENVIADOR_BOX_ANCHO_CM ?? "30");
  const alto   = parseFloat(process.env.ENVIADOR_BOX_ALTO_CM  ?? "5");
  const pesoKg = params.pesoTotalGramos / 1000;

  const sharedBody: Omit<RateBody, "shipment"> = {
    origin: {
      city:       cityOrigen,
      state:      stateOrig,
      postalCode: cpOrigen,
      country,
    },
    destination: {
      city:       params.cityDestino,
      state:      params.stateDestino,
      postalCode: params.cpDestino,
      country,
    },
    packages: [{
      weight:          pesoKg > 0 ? pesoKg : 0.5,
      length:          largo,
      width:           ancho,
      height:          alto,
      declared_value:  params.valorDeclarado,
    }],
  };

  // Request paralela por carrier
  const results = await Promise.all(
    CARRIERS.map((carrier) => cotizarCarrier(carrier, sharedBody, markupPct))
  );

  return results.filter((r): r is EnvioOption => r !== null && r.cost > 0);
}
