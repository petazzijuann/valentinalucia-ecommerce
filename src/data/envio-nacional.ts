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
  {
    desde: 0, hasta: 1000,
    tarifa: { nombre: "Buenos Aires / CABA", sucursal: 9200, domicilio: 12700 },
  },
  {
    desde: 2000, hasta: 3500,
    tarifa: { nombre: "Litoral / Centro", sucursal: 9300, domicilio: 12700 },
  },
  {
    desde: 3600, hasta: 4669,
    tarifa: { nombre: "NOA / Noroeste", sucursal: 10450, domicilio: 14300 },
  },
  {
    desde: 4800, hasta: 9399,
    tarifa: { nombre: "Patagonia / Sur", sucursal: 11780, domicilio: 15300 },
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
