# Valentina Lucia — E-commerce

Tienda online de indumentaria femenina construida con Next.js 16, Supabase, Prisma y Telegram Bot para gestión de productos.

## Stack

- **Framework:** Next.js 16 (App Router)
- **Base de datos:** Supabase (PostgreSQL) + Prisma ORM
- **Auth:** Supabase Auth
- **Imágenes:** Cloudinary
- **Bot admin:** Telegram (Telegraf)
- **Pagos:** AstroPay + Transferencia bancaria
- **Envíos:** Andreani
- **Estilos:** Tailwind CSS v4

## Setup

### 1. Instalar dependencias
```
pnpm install
```

### 2. Variables de entorno
Copiar `.env.example` a `.env.local` y completar todos los valores:
```
cp .env.example .env.local
```

### 3. Base de datos
```
pnpm prisma:migrate
pnpm prisma:generate
```

### 4. Registrar webhook del bot de Telegram
```
pnpm webhook:register
```

### 5. Correr en desarrollo
```
pnpm dev
```

## Comandos del Bot de Telegram

| Comando     | Descripción                       |
|-------------|-----------------------------------|
| /nuevo      | Cargar un nuevo producto          |
| /venta      | Registrar venta offline           |
| /metricas   | Ver ventas y márgenes             |
| /stock      | Ver stock actual                  |
| /ayuda      | Lista de comandos disponibles     |

## Estructura

```
src/
├── app/
│   ├── (admin)/     # Panel de administración
│   ├── (public)/    # Tienda pública
│   └── api/         # API routes
├── components/
│   ├── admin/       # Componentes del panel
│   └── public/      # Componentes de la tienda
├── lib/             # Clientes (Telegram, Cloudinary, Supabase, etc.)
└── store/           # Zustand (carrito)
```