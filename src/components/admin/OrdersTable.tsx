"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import { formatARS } from "@/lib/utils";
import type { OrderItem } from "@/types";
import DeleteConfirmDialog from "./DeleteConfirmDialog";

type AdminOrderItem = OrderItem & { image?: string | null };

interface CustomerAddress {
  street:   string;
  city:     string;
  province: string;
  zip:      string;
}

interface AdminOrder {
  id: string;
  customer_name:    string;
  customer_email:   string;
  customer_phone:   string;
  customer_address: CustomerAddress;
  items: AdminOrderItem[];
  total_amount: number;
  payment_method: string;
  status: string;
  created_at: string;
  shipping_method:      string | null;
  shipping_cost:        number | null;
  shipping_days_label:  string | null;
  carrier_tracking_id:  string | null;
  coupon_code:          string | null;
  discount_amount:      number | null;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<AdminOrder[]>);

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending_payment:   { label: "PENDIENTE",  cls: "bg-yellow-500/10 text-yellow-600" },
  payment_confirmed: { label: "CONFIRMADO", cls: "bg-green-600/10 text-green-600" },
  cancelled:         { label: "RECHAZADO",  cls: "bg-red-600/10 text-red-600" },
  shipped:           { label: "ENVIADO",    cls: "bg-brand-green/10 text-brand-green" },
  delivered:         { label: "ENTREGADO",  cls: "bg-muted text-muted-foreground" },
};

const DELETABLE = ["pending_payment", "cancelled"];

export default function OrdersTable() {
  const { data: orders, isLoading, mutate } = useSWR<AdminOrder[]>("/api/admin/orders", fetcher);
  const [acting,      setActing]      = useState<string | null>(null);
  const [deleteOrder, setDeleteOrder] = useState<AdminOrder | null>(null);
  const [deleteOpen,  setDeleteOpen]  = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox]);

  function showToast(msg: string, type: "ok" | "err") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleAction(id: string, action: "confirm" | "reject") {
    setActing(id + action);
    await fetch(`/api/admin/orders/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action }),
    });
    await mutate();
    setActing(null);
  }

  function openDelete(order: AdminOrder) {
    setDeleteOrder(order);
    setDeleteOpen(true);
  }

  async function handleDelete() {
    if (!deleteOrder) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/orders/${deleteOrder.id}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteOpen(false);

    if (res.ok) {
      showToast("Pedido eliminado", "ok");
      await mutate();
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.error ?? "No se pudo eliminar", "err");
    }
    setDeleteOrder(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="label-tag text-muted-foreground text-[10px] mb-1">GESTIÓN</p>
        <h1 className="font-bebas text-5xl">PEDIDOS</h1>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 text-sm font-medium shadow-lg ${
          toast.type === "ok" ? "bg-green-600 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="border border-border p-4">
              <div className="h-4 bg-muted animate-pulse w-48 mb-2" />
              <div className="h-4 bg-muted animate-pulse w-32" />
            </div>
          ))
        ) : orders?.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">No hay pedidos todavía.</p>
        ) : (
          orders?.map((order) => {
            const status = STATUS_LABEL[order.status] ?? { label: order.status, cls: "bg-muted text-muted-foreground" };
            const isPending = order.status === "pending_payment";
            const isDeletable = DELETABLE.includes(order.status);
            const items = order.items;

            return (
              <div key={order.id} className="border border-border p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-medium">{order.customer_name}</span>
                      <span className={`label-tag text-[10px] px-2 py-0.5 ${status.cls}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      #{order.id.slice(0, 8).toUpperCase()} ·{" "}
                      {new Date(order.created_at).toLocaleDateString("es-AR", {
                        day: "2-digit", month: "2-digit", year: "2-digit",
                        hour: "2-digit", minute: "2-digit",
                      })} · {order.payment_method}
                    </p>
                    {/* Datos de contacto */}
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
                      <a href={`mailto:${order.customer_email}`} className="label-tag text-[10px] text-brand-green hover:underline">
                        {order.customer_email}
                      </a>
                      <a href={`tel:${order.customer_phone}`} className="label-tag text-[10px] text-muted-foreground hover:text-foreground">
                        {order.customer_phone}
                      </a>
                    </div>
                    {/* Dirección */}
                    {order.customer_address && (
                      <p className="label-tag text-[10px] text-muted-foreground mt-0.5">
                        {order.customer_address.street}, {order.customer_address.city}, {order.customer_address.province} ({order.customer_address.zip})
                      </p>
                    )}
                  </div>
                  <p className="price-text text-lg shrink-0">{formatARS(order.total_amount)}</p>
                </div>

                <ul className="flex flex-col gap-2">
                  {items.map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      {/* Thumbnail / placeholder */}
                      {item.image ? (
                        <button
                          type="button"
                          onClick={() => setLightbox(item.image!)}
                          className="relative w-12 h-14 shrink-0 overflow-hidden border border-border bg-muted hover:opacity-80 transition-opacity cursor-zoom-in"
                          title="Ver foto"
                        >
                          <Image src={item.image} alt={item.name} fill sizes="48px" className="object-cover" />
                        </button>
                      ) : (
                        <span className="w-12 h-14 shrink-0 grid place-items-center border border-border bg-muted text-muted-foreground label-tag text-[8px] text-center leading-tight">
                          SIN<br />FOTO
                        </span>
                      )}

                      {/* Detalle */}
                      <div className="min-w-0">
                        {item.slug ? (
                          <Link
                            href={`/producto/${item.slug}`}
                            target="_blank"
                            className="font-medium text-foreground hover:text-brand-green hover:underline"
                          >
                            {item.name}
                          </Link>
                        ) : (
                          <span className="font-medium text-foreground">{item.name}</span>
                        )}
                        <p className="text-muted-foreground text-xs mt-0.5">
                          Talle {item.size}
                          {item.color && item.color !== "Único" ? ` · ${item.color.toUpperCase()}` : ""}
                          {" · "}×{item.qty} — {formatARS(item.price * item.qty)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Cupón */}
                {order.coupon_code && (
                  <p className="label-tag text-[10px] text-muted-foreground">
                    🏷 {order.coupon_code}
                    {order.discount_amount ? ` (−${formatARS(order.discount_amount)})` : ""}
                  </p>
                )}

                {/* Envío y tracking */}
                {order.shipping_method && (
                  <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
                    <span className="label-tag">
                      {order.shipping_method === "rosario"           ? "Envío en Rosario"        :
                       order.shipping_method === "retiro_local"      ? "Retiro en local"          :
                       order.shipping_method === "nacional_sucursal" ? "Envío nacional · Sucursal" :
                       order.shipping_method === "nacional_domicilio"? "Envío nacional · Domicilio":
                       order.shipping_method}
                      {order.shipping_days_label ? ` · ${order.shipping_days_label}` : ""}
                      {order.shipping_cost ? ` · ${formatARS(order.shipping_cost)}` : ""}
                    </span>
                    {order.carrier_tracking_id ? (
                      <span className="label-tag text-brand-green">
                        TRACKING: {order.carrier_tracking_id}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">Sin tracking aún</span>
                    )}
                  </div>
                )}

                {(isPending || isDeletable) && (
                  <div className="flex flex-wrap gap-3 pt-1">
                    {isPending && (
                      <>
                        <button
                          onClick={() => handleAction(order.id, "confirm")}
                          disabled={!!acting}
                          className="label-tag text-[11px] px-5 py-2 bg-green-600 text-white hover:opacity-90 transition-opacity disabled:opacity-40"
                        >
                          {acting === order.id + "confirm" ? "..." : "CONFIRMAR PAGO"}
                        </button>
                        <button
                          onClick={() => handleAction(order.id, "reject")}
                          disabled={!!acting}
                          className="label-tag text-[11px] px-5 py-2 border border-red-500 text-red-600 hover:bg-red-600/10 transition-colors disabled:opacity-40"
                        >
                          {acting === order.id + "reject" ? "..." : "RECHAZAR"}
                        </button>
                      </>
                    )}
                    {isDeletable && (
                      <button
                        onClick={() => openDelete(order)}
                        disabled={!!acting}
                        className="label-tag text-[11px] px-5 py-2 border border-red-500/50 text-red-600 hover:bg-red-600/10 transition-colors disabled:opacity-40"
                      >
                        ELIMINAR PEDIDO
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Cerrar"
            className="absolute top-4 right-5 text-white/80 hover:text-white text-3xl leading-none"
          >
            ✕
          </button>
          <Image
            src={lightbox}
            alt="Foto del producto"
            width={1200}
            height={1200}
            onClick={(e) => e.stopPropagation()}
            className="h-auto w-auto max-h-[85vh] max-w-[90vw] object-contain"
          />
        </div>
      )}

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="¿Eliminar pedido?"
        description={`El pedido #${deleteOrder?.id.slice(0, 8).toUpperCase()} de ${deleteOrder?.customer_name} será eliminado. Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
