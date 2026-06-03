---
titulo: Cupones de descuento — admin CRUD + aplicación en checkout
proyecto: Valentina Lucia E-commerce
estado: borrador
fecha: 2026-06-03
agente: claude
prioridad: alta
estimacion: 2 días
---

## Objetivo

Permitir al administrador crear cupones de descuento (porcentaje, monto fijo o envío gratis) con stock limitado, y que el cliente pueda ingresar un código en el checkout para aplicar el descuento antes de confirmar el pedido.

## Contexto

El checkout actual calcula `total = subtotal + shippingOption.cost` sin ningún tipo de descuento. La variable `total` en el checkout es `totalWithShipping()` desde Zustand. La orden se crea en `/api/orders/route.ts` con ese mismo total.

Este spec agrega:
- Un nuevo modelo `Coupon` en Prisma
- Una página de admin en `/admin/cupones` para CRUD completo
- Un nuevo link en el sidebar del admin
- Un input de cupón en el checkout (en el bloque de resumen, columna derecha)
- Un endpoint público de validación `/api/coupons/validate`
- Actualización de `/api/orders` para aplicar y registrar el cupón

**Decisiones de diseño asumidas:**
- El descuento de porcentaje y monto fijo se aplica sobre el subtotal (antes del envío)
- El envío gratis reduce el `shippingOption.cost` a 0
- Solo se puede aplicar un cupón por pedido
- El stock del cupón se descuenta al confirmar el pedido (no al validar)
- Si el descuento fijo es mayor al subtotal, se aplica solo hasta llevar el subtotal a $0 (sin saldo a favor)
- Los cupones tienen stock: un número entero de usos disponibles. Cuando llega a 0, el cupón deja de funcionar aunque esté activo.

---

## Modelo Coupon — Prisma

```prisma
model Coupon {
  id           String    @id @default(uuid())
  code         String    @unique  // siempre en mayúsculas, ej: "VERANO20"
  type         String    // "percent" | "fixed" | "free_shipping"
  value        Decimal?  @db.Decimal(10, 2)  // null solo para free_shipping
  stock        Int       // usos disponibles restantes
  used_count   Int       @default(0)   // usos ya realizados (auditoría)
  min_purchase Decimal?  @db.Decimal(12, 2)  // compra mínima en pesos (null = sin mínimo)
  is_active    Boolean   @default(true)
  expires_at   DateTime? // null = sin vencimiento
  created_at   DateTime  @default(now())
  updated_at   DateTime  @updatedAt
}
```

**Cambios al modelo Order:**

```prisma
model Order {
  // ... campos existentes ...
  coupon_code      String?
  discount_amount  Decimal?  @db.Decimal(12, 2)
}
```

> Correr `npx prisma migrate dev --name add-coupons` después de modificar el schema.

---

## Comportamiento esperado

---

### ADMIN — Página /admin/cupones

**Link en el sidebar** (`src/components/admin/AdminSidebar.tsx`):

Agregar `{ href: "/admin/cupones", label: "CUPONES", icon: Tag }` en el array `NAV` entre PRODUCTOS y VENTAS. Importar `Tag` desde `lucide-react`.

```
DASHBOARD
PEDIDOS
PRODUCTOS
CUPONES   ← nuevo
VENTAS
REPORTES
SUSCRIPTORES
```

**Tabla de cupones:**

```
┌──────────────┬──────────┬─────────────┬───────┬───────┬────────────┬────────┬──────────┐
│ CÓDIGO       │ TIPO     │ DESCUENTO   │ STOCK │ USOS  │ VENCIMIENTO│ ESTADO │ ACCIONES │
├──────────────┼──────────┼─────────────┼───────┼───────┼────────────┼────────┼──────────┤
│ VERANO20     │ %        │ 20%         │ 50    │ 12    │ 31/12/2026 │ ●Activo│ ✏ 🗑    │
│ DESCUENTO500 │ $        │ $500        │ 100   │ 3     │ Sin venc.  │ ●Activo│ ✏ 🗑    │
│ ENVIOGRATIS  │ Envío    │ Envío gratis│ 10    │ 10    │ 30/06/2026 │ ○ Agot.│ ✏ 🗑    │
└──────────────┴──────────┴─────────────┴───────┴───────┴────────────┴────────┴──────────┘
```

- ESTADO muestra (cálculo solo visual en el frontend, no un campo en la DB):
  - `● Activo` (verde `text-brand-green`): `is_active = true` Y `stock > 0` Y (sin vencimiento O `expires_at` en el futuro)
  - `○ Inactivo` (gris `text-muted-foreground`): `is_active = false`
  - `○ Agotado` (rojo `text-red-500`): `stock === 0`
  - `○ Vencido` (naranja `text-orange-500`): `expires_at < now()`
- Botón "NUEVO CUPÓN" arriba a la derecha (mismo estilo que el resto del admin: `label-tag text-[11px] px-5 py-2 bg-brand-green text-brand-cream hover:bg-green-mid transition-colors`)

**Panel slide-out de creación/edición:**

Mismo patrón que `EditProductSheet`: `fixed inset-0 z-50 flex justify-end` con overlay semitransparente + panel `relative z-10 bg-card border-l border-border w-full max-w-lg flex flex-col shadow-xl overflow-y-auto`. Header con `font-bebas text-2xl` y botón X, body scrolleable, footer con botones CANCELAR / GUARDAR.

Campos del formulario:

```
CÓDIGO *
[VERANO20     ]  ← se convierte a MAYÚSCULAS automáticamente con .toUpperCase() en el onChange

TIPO DE DESCUENTO *
(●) % Porcentaje
( ) $ Monto fijo
( ) Envío gratis

VALOR *  (oculto si tipo = "free_shipping")
[500         ]  ← número positivo

STOCK (usos disponibles) *
[100         ]  ← número entero positivo

COMPRA MÍNIMA (opcional, en pesos)
[            ]  ← dejar vacío si no hay mínimo

FECHA DE VENCIMIENTO (opcional)
[            ]  ← <input type="date">, dejar vacío si no vence

ACTIVO
[toggle]        ← mismo toggle visual que "PUBLICADO" en EditProductSheet
```

Validaciones al guardar:
- Código: requerido, solo letras y números (`/^[A-Z0-9]+$/`)
- Tipo: requerido
- Valor: requerido y positivo para `percent` (1–100) y `fixed` (> 0); ignorado para `free_shipping`
- Stock: requerido, entero ≥ 1

**Editar:** Al abrir el panel de un cupón existente, el campo STOCK muestra el stock **restante** (no el original). Esto permite recargar cupones sumando más usos.

**Eliminar:** Usar `DeleteConfirmDialog` existente. Solo se puede eliminar si `used_count === 0`. Si tiene usos: mostrar error "Este cupón fue utilizado en pedidos y no puede eliminarse" (igual que el error de validación en el Sheet, `text-sm text-red-600`).

---

### CHECKOUT — Sección de cupón

Agregar entre la fila de envío y la fila TOTAL, dentro del div `border border-border p-6 sticky top-24` (columna derecha `lg:col-span-1`).

**Estado inicial (sin cupón):**

```
¿Tenés un cupón?
[CÓDIGO DE CUPÓN     ] [APLICAR]
```

**Cargando:**

```
[CÓDIGO DE CUPÓN     ] [APLICAR ...]   ← input disabled
```

**Cupón aplicado con éxito:**

```
✓ VERANO20 aplicado  [Quitar]
───────────────────────────────
Subtotal              $57.000
Descuento -20%       −$11.400   ← text-brand-green
Andreani (3-5 días)   $4.200
───────────────────────────────
TOTAL                 $49.800
```

**Cupón de envío gratis:**

```
✓ ENVIOGRATIS aplicado  [Quitar]
───────────────────────────────
Subtotal               $57.000
Andreani (gratis)           $0   ← "Gratis" o $0
───────────────────────────────
TOTAL                  $57.000
```

**Error:**

```
✗ [mensaje de error]   ← label-tag text-xs text-red-600, bajo el input
```

Mensajes de error posibles:
- `"Cupón no encontrado"`
- `"Este cupón ya no está disponible"`
- `"Este cupón requiere una compra mínima de $X.XXX"`
- `"No pudimos validar el cupón, intentá de nuevo"`

**Reglas de UX:**
- El input se convierte a MAYÚSCULAS con `.toUpperCase()` en el `onChange`
- Al hacer clic en "Quitar": limpiar el estado del cupón, input vacío, total vuelve al original
- El input se desactiva (`disabled`) mientras carga
- No hay debounce — el usuario hace clic explícito en "APLICAR"

**Estado local a agregar en `CheckoutPage`:**

```ts
const [coupon, setCoupon] = useState<{
  code:            string
  type:            "percent" | "fixed" | "free_shipping"
  discount_amount: number
} | null>(null)
const [couponInput,   setCouponInput]   = useState("")
const [couponLoading, setCouponLoading] = useState(false)
const [couponError,   setCouponError]   = useState("")
```

**Cálculo del total con cupón (reemplaza el uso de `totalWithShipping()`):**

```ts
const subtotal          = totalPrice()
const discountOnSubtotal = coupon ? coupon.discount_amount : 0
const shippingCost      = coupon?.type === "free_shipping"
  ? 0
  : (shippingOption?.cost ?? 0)
const total             = subtotal - discountOnSubtotal + shippingCost
```

> Nota: `totalWithShipping()` sigue usándose solo en lugares donde no hay cupón activo. Con cupón activo, usar la fórmula de arriba en el resumen del checkout.

---

## API — Endpoints

---

### `POST /api/coupons/validate` (público — sin Supabase auth)

**Request:**
```ts
{ code: string; subtotal: number }
```

**Lógica del backend:**
```
1. Buscar el cupón por código (case-insensitive con .toUpperCase() antes de buscar)
2. Si no existe → 404 { error: "not_found" }
3. Si is_active = false → 400 { error: "inactive" }
4. Si stock <= 0 → 400 { error: "out_of_stock" }
5. Si expires_at < now() → 400 { error: "expired" }
6. Si min_purchase != null && subtotal < min_purchase → 400 { error: "min_purchase", min: number }
7. Calcular discount_amount:
   - percent:       Math.floor(subtotal * value / 100)
   - fixed:         Math.min(Number(value), subtotal)
   - free_shipping: 0
8. → 200 { ... }
```

**Response exitosa:**
```ts
{
  code:            string
  type:            "percent" | "fixed" | "free_shipping"
  value:           number | null
  discount_amount: number
}
```

> Este endpoint NO descuenta stock — solo valida. El stock se descuenta al confirmar el pedido.

---

### `GET /api/admin/coupons` (requiere Supabase auth admin)

Devuelve todos los cupones ordenados por `created_at DESC`. Misma verificación de auth que los otros endpoints `/api/admin/*`.

```ts
Coupon[] // todos los campos del modelo
```

---

### `POST /api/admin/coupons` (requiere Supabase auth admin)

Crea un nuevo cupón. Validar con Zod: código único, tipo válido, valor positivo, stock ≥ 1. Normalizar el código a MAYÚSCULAS antes de guardar.

---

### `PATCH /api/admin/coupons/[id]` (requiere Supabase auth admin)

Actualización completa del cupón (misma validación que POST).

---

### `DELETE /api/admin/coupons/[id]` (requiere Supabase auth admin)

- Si `used_count > 0` → 409 `{ error: "has_uses" }`
- Si `used_count === 0` → eliminar y 200

---

### Actualización de `POST /api/orders`

**Nuevos campos opcionales en el body:**
```ts
{
  // ... campos existentes ...
  coupon_code?:     string
  discount_amount?: number
}
```

**Lógica adicional en el handler:**
```ts
let discountAmount = 0
let appliedCoupon: Coupon | null = null

if (data.coupon_code) {
  // 1. Buscar y re-validar el cupón (misma lógica que /api/coupons/validate)
  // 2. Si no es válido → ignorar el descuento silenciosamente
  // 3. Si es válido:
  //    - percent/fixed: calcular discount_amount sobre el subtotal
  //    - free_shipping: shipping_cost = 0
  //    - Decrementar stock de forma atómica:
  const updated = await prisma.coupon.updateMany({
    where: { id: coupon.id, stock: { gt: 0 } },
    data:  { stock: { decrement: 1 }, used_count: { increment: 1 } },
  })
  //    - Si updated.count === 0: race condition, continuar sin descuento
}

const subtotal = data.items.reduce((sum, i) => sum + i.price * i.qty, 0)
const shipping = (appliedCoupon?.type === "free_shipping") ? 0 : (data.shipping_cost ?? 0)
const total    = subtotal - discountAmount + shipping

await prisma.order.create({
  data: {
    // ... campos existentes ...
    total_amount:    total,
    coupon_code:     appliedCoupon?.code    ?? null,
    discount_amount: discountAmount > 0 ? discountAmount : null,
  },
})
```

**Importante:** La re-validación server-side es obligatoria — no confiar en el `discount_amount` del cliente.

---

## ADMIN — Visualización en pedidos

En `src/components/admin/OrdersTable.tsx`, en el card de cada pedido, si `order.coupon_code` existe mostrar:

```
🏷 VERANO20 (−$11.400)
```

Con estilos `label-tag text-[10px] text-muted-foreground` (o similar, siguiendo el patrón visual del card). Solo renderizar si `coupon_code !== null`.

---

## Types — `src/types/index.ts`

**Agregar:**
```ts
export type CouponType = "percent" | "fixed" | "free_shipping"

export interface CouponPublic {
  code:            string
  type:            CouponType
  value:           number | null
  discount_amount: number
}

export interface CouponAdmin {
  id:           string
  code:         string
  type:         CouponType
  value:        number | null
  stock:        number
  used_count:   number
  min_purchase: number | null
  is_active:    boolean
  expires_at:   string | null
  created_at:   string
  updated_at:   string
}
```

**Modificar `OrderPublic`:**
```ts
export interface OrderPublic {
  // ... campos existentes ...
  coupon_code:     string | null
  discount_amount: number | null
}
```

> `OrderPublic` es el tipo que usa `OrdersTable`. Agregar los dos campos como opcionales al final, ambos con valor por defecto `null` si el pedido no tiene cupón.

---

## Stack técnico

- Lenguaje: TypeScript
- Framework: Next.js 16 (App Router)
- UI: Tailwind CSS 4 + Lucide icons (sin librerías de componentes externas — seguir el patrón visual de `EditProductSheet` y `ProductsTable`)
- Base de datos: PostgreSQL vía Prisma
- Auth: Supabase Auth (solo las rutas `/api/admin/*`)
- Validación: Zod
- Data fetching en admin: SWR (igual que `ProductsTable` y `OrdersTable`)
- Estado checkout: `useState` local
- NO agregar librerías externas

---

## Restricciones y reglas

- Las rutas del admin van en `src/app/(admin)/admin/cupones/`
- El endpoint `/api/coupons/validate` es **público** (sin Supabase auth) — el cliente lo llama desde el checkout
- Los endpoints `/api/admin/coupons` y `/api/admin/coupons/[id]` requieren **autenticación de admin** (mismo patrón que los otros endpoints en `/api/admin/`)
- El código del cupón se guarda y busca **siempre en MAYÚSCULAS**
- El stock se decrementa de forma **atómica** con `stock: { gt: 0 }` como condición para evitar race conditions
- El descuento se aplica **sobre el subtotal**, no sobre el total con envío (excepto `free_shipping` que elimina el costo de envío)
- Un pedido puede tener **máximo un cupón**
- Si el cupón vence o se agota entre la validación y la confirmación del pedido, el pedido se crea **sin descuento** (no dar error al cliente)

---

## Criterios de aceptación

- [ ] El admin puede crear un cupón de cada tipo (%, monto, envío gratis)
- [ ] El admin puede editar y ver el stock restante de cada cupón
- [ ] El admin no puede eliminar un cupón que fue usado
- [ ] El estado visual (Activo / Inactivo / Agotado / Vencido) se muestra correctamente en la tabla
- [ ] En el checkout, al ingresar un código válido aparece el descuento en el resumen
- [ ] En el checkout, al ingresar un código inválido/vencido/agotado aparece el mensaje de error correcto
- [ ] El cupón de mínimo de compra rechaza pedidos por debajo del mínimo
- [ ] El total del pedido en la DB refleja el descuento aplicado
- [ ] El stock del cupón se decrementa exactamente 1 al confirmar un pedido
- [ ] El pedido muestra el `coupon_code` y `discount_amount` en el card del admin
- [ ] La navegación del admin tiene el link "CUPONES"
- [ ] TypeScript sin errores (`tsc --noEmit`)
- [ ] El flujo completo fue probado manualmente: crear cupón → aplicar en checkout → confirmar pedido → verificar stock decrementado

---

## Archivos a crear/modificar

**CREAR:**
- `src/app/(admin)/admin/cupones/page.tsx` — página de cupones del admin
- `src/components/admin/CouponsTable.tsx` — tabla + CRUD con panel slide-out
- `src/app/api/coupons/validate/route.ts` — endpoint público de validación
- `src/app/api/admin/coupons/route.ts` — GET (lista) + POST (crear)
- `src/app/api/admin/coupons/[id]/route.ts` — PATCH (editar) + DELETE (eliminar)

**MODIFICAR:**
- `prisma/schema.prisma` — agregar modelo `Coupon` y campos `coupon_code`/`discount_amount` a `Order`
- `src/components/admin/AdminSidebar.tsx` — agregar link "CUPONES" con icono `Tag` en el array `NAV`
- `src/app/(public)/checkout/page.tsx` — agregar estado del cupón, sección de input en el resumen, recalcular total
- `src/app/api/orders/route.ts` — aceptar cupón en el body, re-validar, decrementar stock atómico, guardar en Order
- `src/components/admin/OrdersTable.tsx` — mostrar `🏷 CÓDIGO (−$monto)` en el card si `coupon_code` existe
- `src/types/index.ts` — agregar `CouponType`, `CouponPublic`, `CouponAdmin`; extender `OrderPublic` con `coupon_code` y `discount_amount`

---

## Notas adicionales para el agente

- `CouponsTable` sigue el mismo patrón que `ProductsTable`: SWR para cargar, estado local para el panel slide-out, `DeleteConfirmDialog` para confirmar eliminación
- El panel slide-out de creación/edición es un componente custom siguiendo el patrón de `EditProductSheet`: `fixed inset-0 z-50 flex justify-end`, overlay con `bg-black/40`, panel con `bg-card border-l border-border w-full max-w-lg flex flex-col shadow-xl`
- Ocultar el campo VALOR condicionalmente: si `type === "free_shipping"` → no renderizar ese campo
- En el checkout, el bloque del cupón va **dentro** del div `border border-border p-6 sticky top-24`, entre la fila del envío (`shippingOption`) y la fila TOTAL
- No usar `totalWithShipping()` para calcular el total cuando hay un cupón activo — usar la fórmula manual `subtotal - discountOnSubtotal + shippingCost`
- Para la fecha de vencimiento en el panel, usar `<input type="date">` — no agregar date picker externo
- El toggle de ACTIVO usa el mismo patrón visual que el toggle "PUBLICADO" en `EditProductSheet`: `relative w-10 h-5 rounded-full transition-colors` con `bg-brand-green` si activo, `bg-muted` si inactivo
- La operación atómica en Prisma:
  ```ts
  const updated = await prisma.coupon.updateMany({
    where: { id: coupon.id, stock: { gt: 0 } },
    data:  { stock: { decrement: 1 }, used_count: { increment: 1 } },
  })
  // updated.count === 0 → race condition, no aplicar descuento
  ```
- El Zod schema del body en `/api/orders/route.ts` debe marcar `coupon_code` y `discount_amount` como `.optional()`
- Clases de input consistentes con el resto del proyecto: `w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand-green transition-colors`
- Clases de labels: `label-tag text-[10px] text-muted-foreground block mb-1`
