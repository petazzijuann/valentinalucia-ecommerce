"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Trash2, ArrowLeft } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { formatARS } from "@/lib/utils";
import { buscarTarifa, calcularPrecio } from "@/data/envio-nacional";
import type { ShippingOption } from "@/types";

type ShippingType = "retiro_local" | "rosario" | "nacional";

const FIXED_OPTIONS: Record<"retiro_local" | "rosario", ShippingOption> = {
  retiro_local: {
    type:       "retiro_local",
    label:      "Retiro en local",
    days_label: "España 1541, Rosario · Coordinamos horario por WhatsApp",
    cost:       0,
  },
  rosario: {
    type:       "rosario",
    label:      "Envío en Rosario",
    days_label: "Coordinamos fecha de entrega",
    cost:       3000,
  },
};

export default function CarritoPage() {
  const {
    items, removeItem, updateQuantity, totalPrice, clearCart,
    shippingOption, setShippingOption, totalWithShipping, weightTotal,
  } = useCartStore();

  const [selectedType, setSelectedType] = useState<ShippingType | null>(
    shippingOption
      ? (shippingOption.type === "rosario" || shippingOption.type === "retiro_local"
          ? shippingOption.type
          : "nacional")
      : null
  );
  const [cpInput,   setCpInput]   = useState("");
  const [cpBuscado, setCpBuscado] = useState("");

  const pesoTotal = weightTotal();
  const tarifa    = cpBuscado.length >= 4 ? buscarTarifa(cpBuscado) : null;

  const precioSucursal  = tarifa ? calcularPrecio(tarifa.sucursal,  pesoTotal) : 0;
  const precioDomicilio = tarifa ? calcularPrecio(tarifa.domicilio, pesoTotal) : 0;

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <h1 className="font-bebas text-5xl mb-4">CARRITO VACÍO</h1>
        <p className="text-muted-foreground mb-8">Todavía no agregaste ningún producto.</p>
        <Link href="/tienda" className="inline-block bg-brand-green text-brand-cream px-10 py-4 font-bold tracking-widest text-sm hover:bg-green-mid transition-colors">
          IR A LA TIENDA
        </Link>
      </div>
    );
  }

  function handleTypeSelect(type: ShippingType) {
    setSelectedType(type);
    if (type === "retiro_local" || type === "rosario") {
      setShippingOption(FIXED_OPTIONS[type]);
      setCpBuscado("");
    } else {
      // nacional: limpiar hasta que el usuario calcule
      setShippingOption(null);
    }
  }

  function handleBuscarCP() {
    const cp = cpInput.trim();
    if (!/^\d{4,5}$/.test(cp)) return;
    setCpBuscado(cp);
    setShippingOption(null); // limpiar selección anterior
  }

  function selectNacional(modo: "sucursal" | "domicilio") {
    if (!tarifa) return;
    const precio = modo === "sucursal" ? precioSucursal : precioDomicilio;
    setShippingOption({
      type:       `nacional_${modo}`,
      label:      `Envío nacional · ${modo === "sucursal" ? "A sucursal" : "A domicilio"} (${tarifa.nombre})`,
      days_label: modo === "sucursal" ? "Retirás en sucursal del transportista" : "Entrega en tu domicilio",
      cost:       precio,
    });
  }

  const subtotal = totalPrice();
  const total    = totalWithShipping();

  const TIPOS: { id: ShippingType; label: string; sub: string }[] = [
    { id: "retiro_local", label: "Retiro en local",      sub: "Gratis · España 1541" },
    { id: "rosario",      label: "Envío en Rosario",     sub: formatARS(3000) },
    { id: "nacional",     label: "Envío a todo el país", sub: "Calculá por CP" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/tienda" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-bebas text-5xl">CARRITO</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Items */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {items.map((item) => (
            <div key={`${item.product_id}-${item.size}-${item.color ?? ""}`} className="flex gap-4 pb-6 border-b border-border">
              <div className="relative w-24 h-32 bg-muted shrink-0 overflow-hidden">
                {item.image ? (
                  <Image src={item.image} alt={item.name} fill className="object-cover" sizes="96px" />
                ) : (
                  <div className="w-full h-full bg-muted" />
                )}
              </div>

              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bebas text-xl">{item.name}</h3>
                  <p className="label-tag text-muted-foreground mt-1">
                    {item.size === "ÚNICO" ? "Talle único" : `Talle ${item.size}`}
                    {item.color && item.color !== "Único" && (
                      <> · Color: {item.color.toUpperCase()}</>
                    )}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center border border-border">
                    <button onClick={() => updateQuantity(item.product_id, item.size, item.color ?? null, item.quantity - 1)} className="px-3 py-2 text-sm hover:bg-muted transition-colors">−</button>
                    <span className="px-4 py-2 text-sm border-x border-border min-w-[40px] text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.product_id, item.size, item.color ?? null, item.quantity + 1)} className="px-3 py-2 text-sm hover:bg-muted transition-colors">+</button>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="price-text">{formatARS(item.price * item.quantity)}</p>
                    <button onClick={() => removeItem(item.product_id, item.size, item.color ?? null)} className="text-muted-foreground hover:text-red-600 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <button onClick={clearCart} className="label-tag text-muted-foreground hover:text-red-600 transition-colors self-start text-xs">
            VACIAR CARRITO
          </button>
        </div>

        {/* Resumen */}
        <div className="lg:col-span-1">
          <div className="border border-border p-6 sticky top-24">
            <h2 className="font-bebas text-2xl mb-6">RESUMEN</h2>

            {/* Items */}
            <div className="flex flex-col gap-3 mb-4 text-sm">
              {items.map((item) => (
                <div key={`${item.product_id}-${item.size}-${item.color ?? ""}`} className="flex justify-between text-muted-foreground">
                  <span>
                    {item.name} ({item.size === "ÚNICO" ? "único" : item.size}
                    {item.color && item.color !== "Único" ? ` · ${item.color.toUpperCase()}` : ""})
                    ×{item.quantity}
                  </span>
                  <span>{formatARS(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-3 flex items-center justify-between mb-6">
              <p className="label-tag text-muted-foreground">SUBTOTAL</p>
              <p className="text-sm">{formatARS(subtotal)}</p>
            </div>

            {/* Selector de tipo de envío */}
            <div className="mb-4">
              <p className="label-tag mb-3">ENVÍO</p>
              <div className="flex flex-col gap-2">
                {TIPOS.map(({ id, label, sub }) => {
                  const active = selectedType === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleTypeSelect(id)}
                      className={`w-full text-left border p-3 transition-colors ${
                        active ? "border-brand-green bg-brand-green/5" : "border-border hover:border-brand-green/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-3 h-3 rounded-full border-2 shrink-0 ${active ? "border-brand-green bg-brand-green" : "border-border"}`} />
                        <div className="flex-1 flex items-center justify-between">
                          <p className="label-tag text-xs">{label}</p>
                          <p className="text-xs text-muted-foreground">{sub}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bloque envío nacional */}
            {selectedType === "nacional" && (
              <div className="mb-4">
                {/* Input CP */}
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    value={cpInput}
                    onChange={(e) => setCpInput(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && handleBuscarCP()}
                    placeholder="Código postal"
                    className="flex-1 border border-border px-3 py-2 text-sm focus:outline-none focus:border-brand-green transition-colors bg-background"
                  />
                  <button
                    onClick={handleBuscarCP}
                    disabled={cpInput.trim().length < 4}
                    className="label-tag text-xs px-4 py-2 border border-brand-green text-brand-green hover:bg-brand-green hover:text-brand-cream transition-colors disabled:opacity-40"
                  >
                    CALCULAR
                  </button>
                </div>

                {/* Sin cobertura */}
                {cpBuscado && !tarifa && (
                  <p className="text-xs text-muted-foreground label-tag">
                    No tenemos tarifa para ese CP todavía. Consultanos por WhatsApp.
                  </p>
                )}

                {/* Opciones de tarifa */}
                {tarifa && (
                  <div className="flex flex-col gap-2">
                    <p className="label-tag text-[10px] text-muted-foreground mb-1">
                      ZONA: {tarifa.nombre.toUpperCase()}
                      {pesoTotal > 0 && <> · ~{Math.round(pesoTotal / 1000 * 10) / 10}kg</>}
                    </p>

                    {/* A sucursal */}
                    {(() => {
                      const sel = shippingOption?.type === "nacional_sucursal";
                      return (
                        <button
                          type="button"
                          onClick={() => selectNacional("sucursal")}
                          className={`w-full text-left border p-3 transition-colors ${sel ? "border-brand-green bg-brand-green/5" : "border-border hover:border-brand-green/50"}`}
                        >
                          <div className="flex items-start gap-3">
                            <span className={`mt-0.5 w-3 h-3 rounded-full border-2 shrink-0 ${sel ? "border-brand-green bg-brand-green" : "border-border"}`} />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="label-tag text-xs">A sucursal</p>
                                <p className="text-sm font-medium">{formatARS(precioSucursal)}</p>
                              </div>
                              <p className="text-muted-foreground text-[10px] mt-0.5">Retirás en la sucursal del transportista</p>
                            </div>
                          </div>
                        </button>
                      );
                    })()}

                    {/* A domicilio */}
                    {(() => {
                      const sel = shippingOption?.type === "nacional_domicilio";
                      return (
                        <button
                          type="button"
                          onClick={() => selectNacional("domicilio")}
                          className={`w-full text-left border p-3 transition-colors ${sel ? "border-brand-green bg-brand-green/5" : "border-border hover:border-brand-green/50"}`}
                        >
                          <div className="flex items-start gap-3">
                            <span className={`mt-0.5 w-3 h-3 rounded-full border-2 shrink-0 ${sel ? "border-brand-green bg-brand-green" : "border-border"}`} />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="label-tag text-xs">A domicilio</p>
                                <p className="text-sm font-medium">{formatARS(precioDomicilio)}</p>
                              </div>
                              <p className="text-muted-foreground text-[10px] mt-0.5">Entrega en tu puerta</p>
                            </div>
                          </div>
                        </button>
                      );
                    })()}

                    <p className="label-tag text-[10px] text-muted-foreground mt-1">
                      * Precio aproximado. Puede variar según el peso y embalaje final.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Total */}
            <div className="border-t border-border pt-4 mb-6">
              {shippingOption && (
                <div className="flex items-center justify-between mb-2 text-sm text-muted-foreground">
                  <span className="text-xs">{shippingOption.label}</span>
                  <span>{shippingOption.cost === 0 ? "Gratis" : formatARS(shippingOption.cost)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <p className="label-tag">TOTAL</p>
                <p className="price-text text-xl">{formatARS(total)}</p>
              </div>
            </div>

            <Link href="/checkout" className="block w-full bg-brand-green text-brand-cream text-center py-4 font-bold tracking-widest text-sm hover:bg-green-mid transition-colors">
              FINALIZAR COMPRA
            </Link>

            <Link href="/tienda" className="block w-full text-center label-tag text-muted-foreground hover:text-foreground transition-colors mt-4 py-2">
              SEGUIR COMPRANDO
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
