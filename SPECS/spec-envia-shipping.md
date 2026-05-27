# Spec: Reemplazar Andreani por Envia.com — VALENTINA LUCIA

## Contexto

Actualmente el envío a domicilio funciona con la API directa de Andreani (un solo transportista). El usuario eligió reemplazarlo por **Envia.com**, que es un agregador de transporte argentino que conecta con Andreani, OCA, Correo Argentino y otros en una sola llamada. El cliente elige el transportista desde la tienda.

El flujo de opciones fijas (Envío en Rosario / Retiro en local) se mantiene sin cambios.

### Estado actual
- `src/lib/andreani/client.ts` — llama directamente a la API de Andreani
- `src/app/api/shipping/quote/route.ts` — GET con `?cp=`, usa peso fijo del env
- `ShippingOption.type` — valores `andreani_standard | andreani_express`
- El peso del paquete es un solo valor global en `.env` (`ANDREANI_PACKAGE_WEIGHT_KG`)
- Los productos no tienen peso individual en la BD

---

## Orden de implementación

### 1 · Prisma Schema — `prisma/schema.prisma`

Agregar campo de peso al producto:

```prisma
model Product {
  // ... campos existentes ...
  weight_g   Int  @default(200)   // peso en gramos por unidad
}
```

Migración: `pnpm prisma:migrate` con nombre `add_product_weight`.

También renombrar los campos Andreani en Order a nombres genéricos:

```prisma
model Order {
  // ... campos existentes ...

  // Envío — campos genéricos (antes eran andreani_*)
  carrier_tracking_id  String?   // antes andreani_tracking_id
  carrier_order_id     String?   // antes andreani_order_id
}
```

> **Nota**: Si hay datos en producción en `andreani_tracking_id`/`andreani_order_id`, hacer la migración con `RENAME COLUMN` en lugar de DROP+ADD para no perder datos.

---

### 2 · Variables de entorno — `.env.local` / Vercel

Agregar y quitar:

```env
# ── Envia.com ─────────────────────────────────────────────────
ENVIA_API_KEY="[API_KEY_DE_ENVIA_COM]"
ENVIA_API_BASE="https://api.envia.com"   # confirmar con la documentación oficial
ENVIA_ORIGIN_CP="2000"                   # CP del local/depósito
ENVIA_PACKAGE_WIDTH_CM="20"
ENVIA_PACKAGE_HEIGHT_CM="5"
ENVIA_PACKAGE_LENGTH_CM="30"

# Eliminar o dejar comentadas:
# ANDREANI_USERNAME
# ANDREANI_PASSWORD
# ANDREANI_CONTRACT
# ANDREANI_ORIGIN_CP
# ANDREANI_PACKAGE_WEIGHT_KG
# ANDREANI_API_BASE
```

---

### 3 · Tipos — `src/types/index.ts`

Actualizar `ShippingOption` para soportar múltiples transportistas de Envia.com:

```ts
export interface ShippingOption {
  type:       string;    // id devuelto por Envia.com, ej: "andreani", "oca", "correo_argentino"
  label:      string;    // "Andreani", "OCA", "Correo Argentino"
  days_label: string;    // "3-5 días hábiles"
  cost:       number;    // en ARS, ya con el markup de Envia.com
  carrier_id?: string;   // id interno de Envia.com (para crear la orden luego)
}
```

> Antes el type era un enum fijo. Ahora es `string` libre porque Envia.com puede devolver cualquier transportista activo en su panel.

Actualizar `CartItem` — agregar peso (para calcular el total a enviar):

```ts
export interface CartItem {
  // ... campos existentes ...
  weight_g: number;   // peso en gramos de una unidad
}
```

---

### 4 · Nuevo cliente — `src/lib/envia/client.ts`

Reemplaza `src/lib/andreani/client.ts`.

```ts
// Documentación oficial: https://developers.envia.com/
// Verificar endpoints, estructura de body y respuesta con las credenciales reales.

const BASE = process.env.ENVIA_API_BASE ?? "https://api.envia.com";

function getHeaders() {
  const apiKey = process.env.ENVIA_API_KEY;
  if (!apiKey) throw new Error("ENVIA_API_KEY no configurada");
  return {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type":  "application/json",
  };
}

export interface EnviaQuoteInput {
  cpDestino:      string;
  pesoTotalGramos: number;   // suma de (weight_g * qty) de todos los items
  valorDeclarado: number;    // total del carrito en ARS
}

export interface EnviaCarrierOption {
  type:       string;
  label:      string;
  days_label: string;
  cost:       number;
  carrier_id: string;
}

export async function cotizarEnvio(input: EnviaQuoteInput): Promise<EnviaCarrierOption[]> {
  const cpOrigen = process.env.ENVIA_ORIGIN_CP;
  const widthCm  = parseFloat(process.env.ENVIA_PACKAGE_WIDTH_CM  ?? "20");
  const heightCm = parseFloat(process.env.ENVIA_PACKAGE_HEIGHT_CM ?? "5");
  const lengthCm = parseFloat(process.env.ENVIA_PACKAGE_LENGTH_CM ?? "30");
  const pesoKg   = input.pesoTotalGramos / 1000;

  const res = await fetch(`${BASE}/ship/rate/`, {   // confirmar endpoint con la doc
    method:  "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      origin: { cp: cpOrigen },
      destination: { cp: input.cpDestino },
      package: {
        weight:     pesoKg,
        width:      widthCm,
        height:     heightCm,
        length:     lengthCm,
        declared_value: input.valorDeclarado,
        content: "Indumentaria",
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error(`Envia.com cotizar: HTTP ${res.status}`);

  const data = await res.json();
  return mapQuoteResponse(data);
}

function mapQuoteResponse(data: unknown): EnviaCarrierOption[] {
  // Estructura esperada según doc Envia.com — ajustar al response real.
  // Ejemplo hipotético: { data: [{ carrier: "andreani", service: "standard", total_price: 4200, estimated_days: "3-5" }] }
  const carriers = Array.isArray(data)
    ? data
    : (data as { data?: unknown[] }).data ?? [];

  return (carriers as Record<string, unknown>[]).map((c) => {
    const carrierName = String(c.carrier ?? c.name ?? "").toLowerCase();
    const days        = String(c.estimated_days ?? c.days ?? "");
    const cost        = Number(c.total_price ?? c.price ?? c.cost ?? 0);

    // Normalizar nombre para mostrar
    const labelMap: Record<string, string> = {
      andreani:          "Andreani",
      oca:               "OCA",
      correo_argentino:  "Correo Argentino",
      "correo argentino": "Correo Argentino",
    };
    const label = labelMap[carrierName] ?? carrierName.charAt(0).toUpperCase() + carrierName.slice(1);

    return {
      type:       carrierName,
      label,
      days_label: days ? `${days} días hábiles` : "A confirmar",
      cost,
      carrier_id: String(c.carrier_id ?? c.id ?? carrierName),
    };
  });
}
```

> **⚠️ Confirmar con la documentación real de Envia.com**: el endpoint exacto, el formato del body, los nombres de los campos en la respuesta, y cómo se autentican. Estos datos son aproximados basados en la descripción del usuario.

---

### 5 · Quote API route — `src/app/api/shipping/quote/route.ts`

Cambiar de `GET` a `POST` para recibir los items del carrito y calcular el peso total consultando la DB.

```ts
// POST /api/shipping/quote
// Body: { cp: string, items: Array<{ product_id: string, qty: number }>, total_amount: number }
// Response: { options: EnviaCarrierOption[] }

export async function POST(req: NextRequest) {
  // Rate limiting (mantener igual que ahora)
  // ...

  const body  = await req.json();
  const { cp, items, total_amount } = body;

  // Validar CP
  if (!/^\d{4,5}$/.test(cp?.trim() ?? "")) { ... }

  // Obtener peso de cada producto desde la DB
  const productIds = items.map((i) => i.product_id);
  const products   = await prisma.product.findMany({
    where:  { id: { in: productIds } },
    select: { id: true, weight_g: true },
  });

  const weightMap = Object.fromEntries(products.map((p) => [p.id, p.weight_g]));

  const pesoTotalGramos = items.reduce((sum, item) => {
    const w = weightMap[item.product_id] ?? 200;  // fallback 200g
    return sum + w * item.qty;
  }, 0);

  const options = await cotizarEnvio({
    cpDestino:       cp.trim(),
    pesoTotalGramos,
    valorDeclarado:  total_amount ?? 0,
  });

  return NextResponse.json({ options });
}
```

---

### 6 · Cart Store — `src/store/cart.ts`

Agregar `weight_g` a `CartItem` (ya actualizado en tipos). Cuando se hace `addItem`, incluir el `weight_g` del producto.

Agregar helper en el store para calcular el peso total del carrito:

```ts
weightTotal: () => get().items.reduce(
  (sum, item) => sum + (item.weight_g ?? 200) * item.quantity, 0
),
```

---

### 7 · Carrito UI — `src/app/(public)/carrito/page.tsx`

- Reemplazar `type ShippingType = "rosario" | "retiro_local" | "andreani"` por `"rosario" | "retiro_local" | "nacional"`.
- Cambiar label de "Envío Andreani" a **"Envío a todo el país"** en `SHIPPING_TYPES`.
- Cambiar la llamada al API de `GET /api/shipping/quote?cp=...` a `POST /api/shipping/quote` con body `{ cp, items, total_amount }`.
- Quitar `ANDREANI_*` del env del frontend (ya no necesario).
- Las opciones devueltas se muestran igual que ahora (botones por cada transportista).

---

### 8 · Checkout UI — `src/app/(public)/checkout/page.tsx`

Mismos cambios que el carrito: POST en lugar de GET, recibir `{ cp, items, total_amount }`.

---

### 9 · Página de producto — Selector de talles/stock

Sin cambios. No hay shipping en la página de producto.

---

### 10 · `AddToCartSection` — `src/components/public/AddToCartSection.tsx`

Al llamar a `addItem`, incluir `weight_g`:

```ts
addItem({
  ...
  weight_g: product.weight_g ?? 200,
});
```

Requiere que `ProductPublic` incluya `weight_g`.

---

### 11 · `ProductPublic` en tipos y queries

En `src/types/index.ts`:

```ts
export interface ProductPublic {
  // ... campos existentes ...
  weight_g: number;
}
```

Agregar `weight_g: true` en todos los `select` de Prisma donde se consulta `ProductPublic`:
- `src/app/(public)/producto/[slug]/page.tsx`
- `src/app/(public)/tienda/page.tsx`

---

### 12 · Admin — `src/components/admin/EditProductSheet.tsx`

Agregar campo de peso en el formulario (junto a los precios):

```tsx
<div>
  <label className="label-tag text-[10px] text-muted-foreground block mb-1">
    PESO (gramos) *
  </label>
  <input
    type="number"
    min="0"
    value={form.weight_g}
    onChange={(e) => setField("weight_g", e.target.value)}
    className="..."
    placeholder="200"
  />
</div>
```

Agregar `weight_g` a `FormState`, `toForm()`, `handleSave()` y al PUT de la API.

---

### 13 · API Admin PUT — `src/app/api/admin/products/[id]/route.ts`

Agregar `weight_g: z.number().min(0).default(200)` al `putSchema` y al `prisma.product.update`.

---

### 14 · Bot — `src/lib/telegram/handlers/upload-product.ts`

Agregar pregunta de peso en el flujo de carga:

```
→ Después de pedir el precio de costo, antes de la descripción:
  "⚖️ ¿Cuánto pesa el producto? (en gramos, ej: 200)"
```

Nuevo estado: `upload_waiting_weight`.

Guardar en `uploadData.weight_g` y pasarlo en `prisma.product.create`.

---

### 15 · Orden de envío (futuro) — `src/lib/envia/client.ts`

Cuando el pago se confirma, llamar a Envia.com para crear la orden de envío. Esto es análogo a `crearOrdenEnvio` en el cliente de Andreani. Guardar el resultado en los nuevos campos `carrier_tracking_id` y `carrier_order_id` del modelo Order.

> Este paso puede implementarse en una iteración posterior.

---

## Archivos a crear
- `src/lib/envia/client.ts`

## Archivos a modificar
- `prisma/schema.prisma` — agregar `weight_g`, renombrar campos Andreani en Order
- `src/types/index.ts` — actualizar `ShippingOption`, agregar `weight_g` a `ProductPublic` y `CartItem`
- `src/store/cart.ts` — agregar `weight_g` y `weightTotal()`
- `src/app/api/shipping/quote/route.ts` — reemplazar Andreani por Envia.com, GET→POST
- `src/app/(public)/carrito/page.tsx` — POST, reemplazar "Andreani" por "nacional"
- `src/app/(public)/checkout/page.tsx` — POST
- `src/components/public/AddToCartSection.tsx` — pasar `weight_g` en `addItem`
- `src/app/(public)/producto/[slug]/page.tsx` — agregar `weight_g` al select
- `src/app/(public)/tienda/page.tsx` — agregar `weight_g` al select
- `src/components/admin/EditProductSheet.tsx` — campo de peso en formulario
- `src/app/api/admin/products/[id]/route.ts` — agregar `weight_g` al schema y update
- `src/lib/telegram/handlers/upload-product.ts` — preguntar peso al cargar producto

## Archivos a eliminar
- `src/lib/andreani/client.ts`

---

## Variables de entorno — resumen

| Variable | Antes | Después |
|---|---|---|
| `ANDREANI_USERNAME` | requerida | eliminar |
| `ANDREANI_PASSWORD` | requerida | eliminar |
| `ANDREANI_CONTRACT` | requerida | eliminar |
| `ANDREANI_ORIGIN_CP` | requerida | eliminar |
| `ANDREANI_PACKAGE_WEIGHT_KG` | requerida | eliminar |
| `ANDREANI_API_BASE` | requerida | eliminar |
| `ENVIA_API_KEY` | — | nueva |
| `ENVIA_API_BASE` | — | nueva |
| `ENVIA_ORIGIN_CP` | — | nueva |
| `ENVIA_PACKAGE_WIDTH_CM` | — | nueva (default 20) |
| `ENVIA_PACKAGE_HEIGHT_CM` | — | nueva (default 5) |
| `ENVIA_PACKAGE_LENGTH_CM` | — | nueva (default 30) |

---

## Verificación

1. Cargar un producto con peso vía bot → verificar que se guarda `weight_g` en DB
2. Admin: editar producto → cambiar peso → guardar → verificar en DB
3. Agregar productos al carrito → ir a carrito → ingresar CP → verificar que el POST incluye `items` con sus pesos
4. La respuesta de Envia.com muestra múltiples transportistas (Andreani, OCA, Correo Argentino)
5. Seleccionar un transportista → ir a checkout → el costo se suma al total
6. Confirmar pedido → verificar en DB que `shipping_method`, `shipping_cost` y `carrier_tracking_id` se guardan
7. Productos sin peso configurado usan el fallback de 200g sin romper la app

---

## Dependencias externas

- **Credenciales de Envia.com**: necesitás crear una cuenta en [envia.com](https://www.envia.com/ar) y generar una API Key desde el panel.
- **Documentación API**: [developers.envia.com](https://developers.envia.com/) — confirmar los endpoints exactos, estructura del body y la respuesta antes de implementar el cliente.
- **Peso por producto**: hay que cargar el peso de cada producto existente en la DB. Se puede hacer con un script one-time que setea todos a un valor default (ej: 300g) o editándolos individualmente desde el admin.
