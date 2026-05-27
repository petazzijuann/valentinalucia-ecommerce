# Spec: Dimensiones y peso por producto — VALENTINA LUCIA

## Contexto

Los productos no tienen campos de peso ni dimensiones. Se necesitan para calcular el costo de envío con Envia.com (spec `spec-envia-shipping.md`). El flujo es simple: los campos arrancan vacíos (`null`) en todos los productos existentes, y el admin los carga manualmente desde el panel.

No se muestran en la página pública de la tienda.

---

## Campos nuevos

| Campo | Tipo | Unidad | Nullable | Default |
|---|---|---|---|---|
| `weight_g` | `Int` | gramos | sí | `null` |
| `length_cm` | `Int` | centímetros | sí | `null` |
| `width_cm` | `Int` | centímetros | sí | `null` |
| `height_cm` | `Int` | centímetros | sí | `null` |

Todos `nullable` para que los productos existentes no requieran migración de datos. El sistema de envío usa `200g` y `30×20×5cm` como fallback cuando el campo está vacío.

---

## Orden de implementación

### 1 · Prisma Schema — `prisma/schema.prisma`

```prisma
model Product {
  // ... campos existentes sin cambios ...

  // Dimensiones físicas (para cálculo de envío)
  weight_g   Int?
  length_cm  Int?
  width_cm   Int?
  height_cm  Int?
}
```

Después correr:
```bash
pnpm prisma:migrate   # nombre sugerido: add_product_dimensions
pnpm prisma:generate
```

Los productos existentes quedan con `null` en todos los campos. ✓

---

### 2 · Tipos — `src/types/index.ts`

Agregar los cuatro campos a `ProductPublic` (y por herencia a `ProductAdmin`):

```ts
export interface ProductPublic {
  // ... campos existentes ...
  weight_g:  number | null;
  length_cm: number | null;
  width_cm:  number | null;
  height_cm: number | null;
}
```

---

### 3 · API Admin PUT — `src/app/api/admin/products/[id]/route.ts`

Agregar al `putSchema` Zod:

```ts
weight_g:  z.number().int().positive().nullable().optional().default(null),
length_cm: z.number().int().positive().nullable().optional().default(null),
width_cm:  z.number().int().positive().nullable().optional().default(null),
height_cm: z.number().int().positive().nullable().optional().default(null),
```

Agregar al `prisma.product.update`:

```ts
weight_g:  parsed.data.weight_g  ?? null,
length_cm: parsed.data.length_cm ?? null,
width_cm:  parsed.data.width_cm  ?? null,
height_cm: parsed.data.height_cm ?? null,
```

---

### 4 · Admin EditProductSheet — `src/components/admin/EditProductSheet.tsx`

Agregar los cuatro campos al `FormState`:

```ts
interface FormState {
  // ... campos existentes ...
  weight_g:  string;   // string para el input, "" = null
  length_cm: string;
  width_cm:  string;
  height_cm: string;
}
```

En `toForm()`:
```ts
weight_g:  p.weight_g  !== null ? String(p.weight_g)  : "",
length_cm: p.length_cm !== null ? String(p.length_cm) : "",
width_cm:  p.width_cm  !== null ? String(p.width_cm)  : "",
height_cm: p.height_cm !== null ? String(p.height_cm) : "",
```

En `handleSave()`, parsear con `parseInt` y mapear vacío a `null`:
```ts
function parseDim(val: string): number | null {
  const n = parseInt(val, 10);
  return isNaN(n) || n <= 0 ? null : n;
}
// luego en el body del PUT:
weight_g:  parseDim(form.weight_g),
length_cm: parseDim(form.length_cm),
width_cm:  parseDim(form.width_cm),
height_cm: parseDim(form.height_cm),
```

**UI — nueva sección en el panel**, entre Precios y Stock:

```
┌─────────────────────────────────────────┐
│  DIMENSIONES DEL PAQUETE                │
│  (para cálculo de envío)                │
│                                         │
│  [Peso (g)]  [Largo (cm)]              │
│  [Ancho (cm)] [Alto (cm)]              │
└─────────────────────────────────────────┘
```

- Inputs `type="number"` con `min="0"`, `step="1"`
- Placeholder indicativo: `200`, `30`, `20`, `5`
- No son obligatorios (`required` = false)
- Texto de ayuda debajo: `_Si quedan vacíos se usa el valor por defecto al cotizar el envío._`

---

### 5 · Queries que devuelven `ProductPublic`

Agregar `weight_g, length_cm, width_cm, height_cm` al `select` en:

- `src/app/(public)/producto/[slug]/page.tsx`
- `src/app/(public)/tienda/page.tsx`

No se muestran en la UI pública pero se necesitan en `CartItem` para el cálculo de envío.

---

### 6 · Cart Store — `src/store/cart.ts`

Agregar `weight_g` a `CartItem` (para calcular el peso total al cotizar el envío):

```ts
export interface CartItem {
  // ... campos existentes ...
  weight_g: number | null;
}
```

En `AddToCartSection.tsx`, al llamar `addItem`, incluir:
```ts
weight_g: product.weight_g ?? null,
```

---

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | Agregar 4 campos nullable al modelo Product |
| `src/types/index.ts` | Agregar 4 campos a `ProductPublic`, `weight_g` a `CartItem` |
| `src/app/api/admin/products/[id]/route.ts` | `putSchema` + `prisma.product.update` |
| `src/components/admin/EditProductSheet.tsx` | `FormState`, `toForm`, `handleSave`, UI |
| `src/app/(public)/producto/[slug]/page.tsx` | Agregar campos al select |
| `src/app/(public)/tienda/page.tsx` | Agregar campos al select |
| `src/components/public/AddToCartSection.tsx` | Pasar `weight_g` en `addItem` |
| `src/store/cart.ts` | Agregar `weight_g` a `CartItem` |

## Archivos a crear

Ninguno.

---

## Verificación

1. `pnpm prisma:migrate` corre sin errores — productos existentes tienen `null` en los 4 campos.
2. Admin → Editar producto → sección "Dimensiones" visible con inputs vacíos.
3. Cargar `weight_g=350`, `length_cm=35`, `width_cm=25`, `height_cm=8` → guardar → verificar en DB.
4. Dejar los campos vacíos en otro producto → guardar → verificar que quedan `null` (no `0`).
5. Tienda y página de producto no muestran ningún cambio visual.
6. `CartItem` tiene `weight_g` con el valor del producto (o `null` si no está cargado).

---

## Relación con otros specs

- **`spec-envia-shipping.md`**: este spec es prerequisito. El cliente de Envia.com usa `weight_g`, `length_cm`, `width_cm`, `height_cm` de los productos del carrito para armar el body de la cotización. Si un producto tiene `null`, el quote usa los valores default de las variables de entorno.
