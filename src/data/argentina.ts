/** Provincias argentinas con su código corto para la API de Envia.com */
export interface Province {
  name: string;
  code: string;  // código corto usado en APIs de envío (ej: "SF" para Santa Fe)
}

export const PROVINCES: Province[] = [
  { name: "Buenos Aires",           code: "BA" },
  { name: "Ciudad de Buenos Aires", code: "CABA" },
  { name: "Catamarca",              code: "K" },
  { name: "Chaco",                  code: "H" },
  { name: "Chubut",                 code: "U" },
  { name: "Córdoba",                code: "X" },
  { name: "Corrientes",             code: "W" },
  { name: "Entre Ríos",             code: "E" },
  { name: "Formosa",                code: "P" },
  { name: "Jujuy",                  code: "Y" },
  { name: "La Pampa",               code: "L" },
  { name: "La Rioja",               code: "F" },
  { name: "Mendoza",                code: "M" },
  { name: "Misiones",               code: "N" },
  { name: "Neuquén",                code: "Q" },
  { name: "Río Negro",              code: "R" },
  { name: "Salta",                  code: "A" },
  { name: "San Juan",               code: "J" },
  { name: "San Luis",               code: "D" },
  { name: "Santa Cruz",             code: "Z" },
  { name: "Santa Fe",               code: "SF" },
  { name: "Santiago del Estero",    code: "G" },
  { name: "Tierra del Fuego",       code: "V" },
  { name: "Tucumán",                code: "T" },
];
