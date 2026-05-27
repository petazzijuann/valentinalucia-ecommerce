/**
 * Tarifas de envío nacional desde Rosario (CP 2000).
 * Precio base: 1 paquete — 500g · 50×30×5cm
 * Si el pedido pesa más, el precio escala proporcionalmente.
 */

export interface TarifaZona {
  nombre:    string;
  sucursal:  number;   // precio base (500g)
  domicilio: number;   // precio base (500g)
}

/** Peso base del paquete de referencia en gramos */
export const PESO_BASE_G = 500;

/** Rangos de CP → tarifa. Los rangos son inclusivos [desde, hasta]. */
const ZONAS: Array<{ desde: number; hasta: number; tarifa: TarifaZona }> = [
  // CABA (1000-1499) y Gran Buenos Aires / La Plata (1500-1999)
  {
    desde: 1000, hasta: 1999,
    tarifa: { nombre: "Buenos Aires / CABA / La Plata", sucursal: 9200, domicilio: 12700 },
  },
  // Chaco (3500-3599)
  {
    desde: 3500, hasta: 3599,
    tarifa: { nombre: "Chaco", sucursal: 9300, domicilio: 12700 },
  },
  // Catamarca (4700-4799)
  {
    desde: 4700, hasta: 4799,
    tarifa: { nombre: "Catamarca", sucursal: 10450, domicilio: 14300 },
  },
  // Tierra del Fuego (9400-9499)
  {
    desde: 9400, hasta: 9499,
    tarifa: { nombre: "Tierra del Fuego", sucursal: 11780, domicilio: 15300 },
  },
];

/**
 * Devuelve la tarifa correspondiente al CP ingresado,
 * o null si no hay cobertura para esa zona.
 */
export function buscarTarifa(cp: string): TarifaZona | null {
  // Aceptar solo la parte numérica (por si viene con letra, ej: "B1900")
  const n = parseInt(cp.replace(/\D/g, ""), 10);
  if (isNaN(n)) return null;

  const zona = ZONAS.find((z) => n >= z.desde && n <= z.hasta);
  return zona?.tarifa ?? null;
}

/**
 * Ajusta el precio base según el peso total del carrito.
 * Mínimo: precio base (aunque el carrito pese menos de 500g).
 * Redondea a múltiplos de $50 para que se vea limpio.
 */
export function calcularPrecio(precioBase: number, pesoTotalG: number): number {
  const factor = Math.max(1, pesoTotalG / PESO_BASE_G);
  return Math.round((precioBase * factor) / 50) * 50;
}
