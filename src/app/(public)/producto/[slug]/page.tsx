import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma/client";
import ProductViewWithColors from "@/components/public/ProductViewWithColors";
import StickyCartBar from "@/components/public/StickyCartBar";
import type { ProductPublic, ColorVariant, StockMap } from "@/types";

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "https://valentinalucia.com.ar";

export const revalidate    = 60;
export const dynamicParams = true; // páginas no pre-renderizadas se generan on-demand

export async function generateStaticParams() {
  // Retornamos vacío para evitar pre-renderizado concurrente en build.
  // Con dynamicParams = true + revalidate = 60, las páginas se generan
  // on-demand al primer acceso y quedan cacheadas con ISR.
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await prisma.product.findUnique({
    where:  { slug, is_published: true },
    select: { name: true, description: true, images: true, price_sale: true },
  });
  if (!product) return {};

  const title       = product.name;
  const description = product.description;
  const image       = product.images[0];

  return {
    title,
    description,
    openGraph: {
      title, description, type: "website",
      url:    `${BASE}/producto/${slug}`,
      images: image ? [{ url: image, width: 1200, height: 1600, alt: product.name }] : [],
    },
    twitter: {
      card: "summary_large_image", title, description,
      images: image ? [image] : [],
    },
  };
}

export default async function ProductoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const raw = await prisma.product.findUnique({
    where: { slug, is_published: true },
    select: {
      id: true, name: true, slug: true, description: true,
      category: true, images: true, tags: true,
      price_sale: true, stock: true, color_variants: true,
      weight_g: true, length_cm: true, width_cm: true, height_cm: true,
      is_published: true, created_at: true, updated_at: true,
    },
  });

  if (!raw) notFound();

  const colorVariants = (raw.color_variants as ColorVariant[] | null) ?? [];
  const product: ProductPublic = {
    ...raw,
    price_sale:     Number(raw.price_sale),
    created_at:     raw.created_at.toISOString(),
    updated_at:     raw.updated_at.toISOString(),
    stock:          raw.stock as StockMap,
    color_variants: colorVariants,
    category:       raw.category as ProductPublic["category"],
  };

  // Para el schema.org: determinar stock disponible
  const effectiveStock: StockMap =
    colorVariants.length > 0
      ? colorVariants[0].stock
      : (product.stock as StockMap);
  const hasStock = Object.values(effectiveStock).some((q) => q > 0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type":    "Product",
    name:       product.name,
    description: product.description,
    image:      product.images,
    brand:      { "@type": "Brand", name: "VALENTINA LUCIA" },
    offers: {
      "@type":       "Offer",
      priceCurrency: "ARS",
      price:         product.price_sale.toString(),
      availability:  hasStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `${BASE}/producto/${product.slug}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 label-tag text-muted-foreground mb-8 text-xs overflow-x-auto whitespace-nowrap scrollbar-none pb-1 opacity-0 animate-[fadeSlideLeft_0.5s_ease-out_forwards]"
        >
          <Link href="/" className="hover:text-foreground transition-colors shrink-0">HOME</Link>
          <span aria-hidden>/</span>
          <Link href="/tienda" className="hover:text-foreground transition-colors shrink-0">TIENDA</Link>
          <span aria-hidden>/</span>
          <Link
            href={`/tienda?categoria=${product.category}`}
            className="hover:text-foreground transition-colors shrink-0"
          >
            {product.category.toUpperCase()}
          </Link>
          <span aria-hidden>/</span>
          <span className="text-foreground">{product.name.toUpperCase()}</span>
        </nav>

        <ProductViewWithColors product={product} />
      </div>

      {/* Barra sticky mobile */}
      <StickyCartBar name={product.name} price={product.price_sale} />
    </>
  );
}
