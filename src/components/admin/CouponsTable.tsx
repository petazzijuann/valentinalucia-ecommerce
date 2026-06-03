"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { X, Pencil, Trash2 } from "lucide-react";
import { formatARS } from "@/lib/utils";
import type { CouponAdmin } from "@/types";
import DeleteConfirmDialog from "./DeleteConfirmDialog";

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<CouponAdmin[]>);

type CouponType = "percent" | "fixed" | "free_shipping";

interface FormState {
  code:         string;
  type:         CouponType;
  value:        string;
  stock:        string;
  min_purchase: string;
  expires_at:   string;
  is_active:    boolean;
}

const defaultForm: FormState = {
  code:         "",
  type:         "percent",
  value:        "",
  stock:        "",
  min_purchase: "",
  expires_at:   "",
  is_active:    true,
};

function toForm(c: CouponAdmin): FormState {
  return {
    code:         c.code,
    type:         c.type as CouponType,
    value:        c.value !== null ? String(c.value) : "",
    stock:        String(c.stock),
    min_purchase: c.min_purchase !== null ? String(c.min_purchase) : "",
    expires_at:   c.expires_at ? c.expires_at.slice(0, 10) : "",
    is_active:    c.is_active,
  };
}

function getCouponStatus(c: CouponAdmin): { label: string; cls: string; dot: string } {
  if (!c.is_active)                                                   return { label: "Inactivo", cls: "text-muted-foreground", dot: "bg-muted-foreground" };
  if (c.stock <= 0)                                                   return { label: "Agotado",  cls: "text-red-500",          dot: "bg-red-500" };
  if (c.expires_at && new Date(c.expires_at) < new Date())           return { label: "Vencido",  cls: "text-orange-500",       dot: "bg-orange-500" };
  return { label: "Activo", cls: "text-brand-green", dot: "bg-brand-green" };
}

function formatDiscount(c: CouponAdmin): string {
  if (c.type === "free_shipping") return "Envío gratis";
  if (c.type === "percent")       return `${c.value}%`;
  if (c.type === "fixed" && c.value !== null) return formatARS(c.value);
  return "—";
}

function formatExpiry(c: CouponAdmin): string {
  if (!c.expires_at) return "Sin venc.";
  return new Date(c.expires_at).toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

const inputClass = "w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand-green transition-colors";
const labelClass = "label-tag text-[10px] text-muted-foreground block mb-1";

export default function CouponsTable() {
  const { data: coupons, isLoading, mutate } = useSWR<CouponAdmin[]>("/api/admin/coupons", fetcher);

  const [panelOpen,    setPanelOpen]    = useState(false);
  const [editCoupon,   setEditCoupon]   = useState<CouponAdmin | null>(null);
  const [form,         setForm]         = useState<FormState>(defaultForm);
  const [saving,       setSaving]       = useState(false);
  const [formError,    setFormError]    = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CouponAdmin | null>(null);
  const [deleteOpen,   setDeleteOpen]   = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [toast,        setToast]        = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  function showToast(msg: string, type: "ok" | "err") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    if (!panelOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPanelOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panelOpen]);

  function openCreate() {
    setEditCoupon(null);
    setForm(defaultForm);
    setFormError(null);
    setPanelOpen(true);
  }

  function openEdit(c: CouponAdmin) {
    setEditCoupon(c);
    setForm(toForm(c));
    setFormError(null);
    setPanelOpen(true);
  }

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function validate(): string | null {
    if (!form.code.trim())                          return "El código es requerido";
    if (!/^[A-Z0-9]+$/.test(form.code.toUpperCase())) return "Solo letras y números";
    const stock = parseInt(form.stock, 10);
    if (isNaN(stock) || stock < 1)                  return "El stock debe ser al menos 1";
    if (form.type === "percent") {
      const v = parseFloat(form.value);
      if (isNaN(v) || v < 1 || v > 100) return "El porcentaje debe ser entre 1 y 100";
    }
    if (form.type === "fixed") {
      const v = parseFloat(form.value);
      if (isNaN(v) || v <= 0) return "El valor debe ser mayor a 0";
    }
    return null;
  }

  async function handleSave() {
    const err = validate();
    if (err) { setFormError(err); return; }

    setSaving(true);
    setFormError(null);

    const payload = {
      code:         form.code.toUpperCase(),
      type:         form.type,
      value:        form.type !== "free_shipping" ? parseFloat(form.value) || null : null,
      stock:        parseInt(form.stock, 10),
      min_purchase: form.min_purchase ? parseFloat(form.min_purchase) : null,
      expires_at:   form.expires_at || null,
      is_active:    form.is_active,
    };

    const url    = editCoupon ? `/api/admin/coupons/${editCoupon.id}` : "/api/admin/coupons";
    const method = editCoupon ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setFormError(data.error ?? "Error al guardar");
      return;
    }

    await mutate();
    setPanelOpen(false);
    showToast(editCoupon ? "Cupón actualizado" : "Cupón creado", "ok");
  }

  function openDelete(c: CouponAdmin) {
    setDeleteTarget(c);
    setDeleteOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/coupons/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteOpen(false);

    if (res.ok) {
      showToast("Cupón eliminado", "ok");
      await mutate();
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.error ?? "No se pudo eliminar", "err");
    }
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="label-tag text-muted-foreground text-[10px] mb-1">GESTIÓN</p>
          <h1 className="font-bebas text-5xl">CUPONES</h1>
        </div>
        <button
          onClick={openCreate}
          className="label-tag text-[11px] px-5 py-2 bg-brand-green text-brand-cream hover:bg-green-mid transition-colors"
        >
          NUEVO CUPÓN
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 text-sm font-medium shadow-lg ${
          toast.type === "ok" ? "bg-green-600 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-x-auto border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="label-tag text-[10px] text-left px-4 py-3">CÓDIGO</th>
              <th className="label-tag text-[10px] text-left px-4 py-3">TIPO</th>
              <th className="label-tag text-[10px] text-left px-4 py-3">DESCUENTO</th>
              <th className="label-tag text-[10px] text-right px-4 py-3">STOCK</th>
              <th className="label-tag text-[10px] text-right px-4 py-3">USOS</th>
              <th className="label-tag text-[10px] text-left px-4 py-3">VENCIMIENTO</th>
              <th className="label-tag text-[10px] text-left px-4 py-3">ESTADO</th>
              <th className="label-tag text-[10px] text-right px-4 py-3">ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {[...Array(8)].map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-3 bg-muted animate-pulse rounded w-16" />
                    </td>
                  ))}
                </tr>
              ))
            ) : coupons?.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No hay cupones todavía.
                </td>
              </tr>
            ) : (
              coupons?.map((c) => {
                const status = getCouponStatus(c);
                return (
                  <tr key={c.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{c.code}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.type === "percent" ? "%" : c.type === "fixed" ? "$" : "Envío"}
                    </td>
                    <td className="px-4 py-3">{formatDiscount(c)}</td>
                    <td className="px-4 py-3 text-right">{c.stock}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{c.used_count}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatExpiry(c)}</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1.5 label-tag text-[10px] ${status.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${status.dot}`} />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(c)}
                          className="p-1.5 hover:text-brand-green transition-colors"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => openDelete(c)}
                          className="p-1.5 hover:text-red-500 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Panel slide-out */}
      {panelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !saving && setPanelOpen(false)}
          />
          <div className="relative z-10 bg-card border-l border-border w-full max-w-md flex flex-col shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
              <h2 className="font-bebas text-2xl tracking-wide">
                {editCoupon ? "EDITAR CUPÓN" : "NUEVO CUPÓN"}
              </h2>
              <button
                onClick={() => setPanelOpen(false)}
                className="p-1 hover:text-muted-foreground transition-colors"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 px-6 py-6 space-y-5 overflow-y-auto">

              {/* Código */}
              <div>
                <label className={labelClass}>CÓDIGO *</label>
                <input
                  value={form.code}
                  onChange={(e) => setField("code", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  placeholder="VERANO20"
                  className={inputClass}
                />
              </div>

              {/* Tipo */}
              <div>
                <label className={labelClass}>TIPO DE DESCUENTO *</label>
                <div className="flex flex-col gap-2 mt-1">
                  {(["percent", "fixed", "free_shipping"] as CouponType[]).map((t) => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="type"
                        value={t}
                        checked={form.type === t}
                        onChange={() => setField("type", t)}
                        className="accent-brand-green"
                      />
                      <span className="text-sm">
                        {t === "percent" ? "% Porcentaje" : t === "fixed" ? "$ Monto fijo" : "Envío gratis"}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Valor (oculto para free_shipping) */}
              {form.type !== "free_shipping" && (
                <div>
                  <label className={labelClass}>
                    VALOR * {form.type === "percent" ? "(1–100)" : "(en pesos)"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.value}
                    onChange={(e) => setField("value", e.target.value)}
                    placeholder={form.type === "percent" ? "20" : "500"}
                    className={inputClass}
                  />
                </div>
              )}

              {/* Stock */}
              <div>
                <label className={labelClass}>STOCK (usos disponibles) *</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.stock}
                  onChange={(e) => setField("stock", e.target.value)}
                  placeholder="100"
                  className={inputClass}
                />
              </div>

              {/* Compra mínima */}
              <div>
                <label className={labelClass}>COMPRA MÍNIMA (opcional, en pesos)</label>
                <input
                  type="number"
                  min="0"
                  value={form.min_purchase}
                  onChange={(e) => setField("min_purchase", e.target.value)}
                  placeholder="Sin mínimo"
                  className={inputClass}
                />
              </div>

              {/* Fecha de vencimiento */}
              <div>
                <label className={labelClass}>FECHA DE VENCIMIENTO (opcional)</label>
                <input
                  type="date"
                  value={form.expires_at}
                  onChange={(e) => setField("expires_at", e.target.value)}
                  className={inputClass}
                />
              </div>

              {/* Activo */}
              <div className="flex items-center justify-between py-2">
                <label className="label-tag text-[10px] text-muted-foreground">ACTIVO</label>
                <button
                  type="button"
                  onClick={() => setField("is_active", !form.is_active)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    form.is_active ? "bg-brand-green" : "bg-muted"
                  }`}
                  aria-pressed={form.is_active}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      form.is_active ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {formError && (
                <p className="text-sm text-red-600">{formError}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-5 border-t border-border shrink-0">
              <button
                onClick={() => setPanelOpen(false)}
                disabled={saving}
                className="label-tag text-[11px] px-5 py-2 border border-border hover:bg-muted transition-colors disabled:opacity-50"
              >
                CANCELAR
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="label-tag text-[11px] px-5 py-2 bg-brand-green text-brand-cream hover:bg-green-mid transition-colors disabled:opacity-50"
              >
                {saving ? "GUARDANDO..." : editCoupon ? "GUARDAR CAMBIOS" : "CREAR CUPÓN"}
              </button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="¿Eliminar cupón?"
        description={`El cupón "${deleteTarget?.code}" será eliminado. Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
