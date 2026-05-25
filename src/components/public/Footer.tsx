import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-green-dark text-cream-dark border-t border-green-mid">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          <div>
            <Image
              src="/logo.png"
              alt="Valentina Lucia"
              width={160}
              height={64}
              className="h-12 w-auto object-contain mb-3"
              style={{ filter: "brightness(0) saturate(100%) invert(88%) sepia(18%) saturate(400%) hue-rotate(295deg) brightness(108%)" }}
            />
            <p className="text-sm">Indumentaria femenina. Rosario, Santa Fe.</p>
            <p className="text-sm mt-1 text-xs opacity-70">Fundada en 2026.</p>
          </div>

          <div>
            <p className="label-tag text-brand-cream mb-4">TIENDA</p>
            <div className="flex flex-col gap-2 text-sm">
              <Link href="/tienda" className="hover:text-brand-cream transition-colors">
                Ver colección
              </Link>
              <Link href="/tienda?categoria=remeras" className="hover:text-brand-cream transition-colors">
                Remeras
              </Link>
              <Link href="/tienda?categoria=pantalones" className="hover:text-brand-cream transition-colors">
                Pantalones
              </Link>
              <Link href="/tienda?categoria=buzos" className="hover:text-brand-cream transition-colors">
                Buzos
              </Link>
            </div>
          </div>

          <div>
            <p className="label-tag text-brand-cream mb-4">INFO</p>
            <div className="flex flex-col gap-2 text-sm">
              <p>Envíos a todo el país</p>
              <p>Pagos: AstroPay · Transferencia</p>
              <p>Consultas por Instagram</p>
            </div>
          </div>

        </div>

        <div className="mt-12 pt-6 border-t border-green-mid text-xs text-center">
          © {new Date().getFullYear()} VALENTINA LUCIA. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}
