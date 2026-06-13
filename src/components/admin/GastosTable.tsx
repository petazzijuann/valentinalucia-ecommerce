"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { X, Pencil, Trash2 } from "lucide-react";
import { formatARS } from "@/lib/utils";
import type { ExpenseAdmin } from "@/types";
import DeleteConfirmDialog from "./DeleteConfirmDialog";

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<ExpenseAdmin[]>);

interface FormState {
  description: string;
  amount:      string;
  date:        string;
  category:    string;
  notes:       string;
}

const defaultForm: FormState = {
  description: "",
  amount:      "",
  date:        new Date().toISOString().slice(0, 10),
  category:    "",
  notes:       "",
};

function toForm(e: ExpenseAdmin): FormState {
  return {
    description: e.description,
    amount:      String(e.amount),
    date:        e.date.slice(0, 10),
    category:    e.category ?? "",
    notes:       e.notes ?? "",
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

const inputClass = "w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand-green transition-colors";
const labelClass = "label-tag text-[10px] text-muted-foreground block mb-1";

const CATEGORIES = ["Packaging", "Materiales", "Marketing", "Servicios", "Envíos", "Impuestos", "Otro"];

export default function GastosTable() {
  const { data: expenses, isLoading, mutate } = useSWR<ExpenseAdmin[]>("/api/admin/gastos", fetcher);

  const [panelOpen,    setPanelOpen]    = useState(false);
  const [editExpense,  setEditExpense]  = useState<ExpenseAdmin | null>(null);
  const [form,         setForm]         = useState<FormState>(defaultForm);
  const [saving,       setSaving]       = useState(false);
  const [formError,    setFormError]    = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseAdmin | null>(null);
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
    setEditExpense(null);
    setForm({ ...defaultForm, date: new Date().toISOString().slice(0, 10) });
    setFormError(null);
    setPanelOpen(true);
  }

  function openEdit(e: ExpenseAdmin) {
    setEditExpense(e);
    setForm(toForm(e));
    setFormError(null);
    setPanelOpen(true);
  }

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function validate(): string | null {
    if (!form.description.trim()) return "La descripción es requerida";
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0)   return "El monto debe ser mayor a 0";
    if (!form.date)               return "La fecha es requerida";
    return null;
  }

  async function handleSave() {
    const err = validate();
    if (err) { setFormError(err); return; }

    setSaving(true);
    setFormError(null);

    const payload = {
      description: form.description.trim(),
      amount:      parseFloat(form.amount),
      date:        form.date,
      category:    form.category.trim() || null,
      notes:       form.notes.trim() || null,
    };

    const url    = editExpense ? `/api/admin/gastos/${editExpense.id}` : "/api/admin/gastos";
    const method = editExpense ? "PATCH" : "POST";

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
    showToast(editExpense ? "Gasto actualizado" : "Gasto registrado", "ok");
  }

  function openDelete(e: ExpenseAdmin) {
    setDeleteTarget(e);
    setDeleteOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/gastos/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteOpen(false);

    if (res.ok) {
      showToast("Gasto eliminado", "ok");
      await mutate();
    } else {
      showToast("No se pudo eliminar", "err");
    }
    setDeleteTarget(null);
  }

  const total = expenses?.reduce((s, e) => s + e.amount, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="label-tag text-muted-foreground text-[10px] mb-1">GESTIÓN</p>
          <h1 className="font-bebas text-5xl">GASTOS</h1>
        </div>
        <button
          onClick={openCreate}
          className="label-tag text-[11px] px-5 py-2 bg-brand-green text-brand-cream hover:bg-green-mid transition-colors"
        >
          NUEVO GASTO
        </button>
      </div>

      {/* Total */}
      {!isLoading && expenses && expenses.length > 0 && (
        <div className="border border-border px-5 py-4 bg-muted/20 flex items-center justify-between">
          <span className="label-tag text-[10px] text-muted-foreground">TOTAL REGISTRADO</span>
          <span className="font-bebas text-2xl text-red-500">{formatARS(total)}</span>
        </div>
      )}

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
              <th className="label-tag text-[10px] text-left px-4 py-3">FECHA</th>
              <th className="label-tag text-[10px] text-left px-4 py-3">DESCRIPCIÓN</th>
              <th className="label-tag text-[10px] text-left px-4 py-3">CATEGORÍA</th>
              <th className="label-tag text-[10px] text-right px-4 py-3">MONTO</th>
              <th className="label-tag text-[10px] text-right px-4 py-3">ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {[...Array(5)].map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-3 bg-muted animate-pulse rounded w-20" />
                    </td>
                  ))}
                </tr>
              ))
            ) : expenses?.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No hay gastos registrados todavía.
                </td>
              </tr>
            ) : (
              expenses?.map((e) => (
                <tr key={e.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatDate(e.date)}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {e.description}
                    {e.notes && (
                      <p className="text-xs text-muted-foreground font-normal mt-0.5">{e.notes}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {e.category ? (
                      <span className="label-tag text-[10px] px-2 py-0.5 border border-border text-muted-foreground">
                        {e.category}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-red-500">
                    {formatARS(e.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(e)}
                        className="p-1.5 hover:text-brand-green transition-colors"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => openDelete(e)}
                        className="p-1.5 hover:text-red-500 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
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
            <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
              <h2 className="font-bebas text-2xl tracking-wide">
                {editExpense ? "EDITAR GASTO" : "NUEVO GASTO"}
              </h2>
              <button
                onClick={() => setPanelOpen(false)}
                className="p-1 hover:text-muted-foreground transition-colors"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 px-6 py-6 space-y-5 overflow-y-auto">
              <div>
                <label className={labelClass}>DESCRIPCIÓN *</label>
                <input
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  placeholder="Bolsas, stickers, cartones..."
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>MONTO * (en pesos)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setField("amount", e.target.value)}
                  placeholder="1500"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>FECHA *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setField("date", e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>CATEGORÍA (opcional)</label>
                <select
                  value={form.category}
                  onChange={(e) => setField("category", e.target.value)}
                  className={inputClass}
                >
                  <option value="">Sin categoría</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>NOTAS (opcional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                  placeholder="Detalles adicionales..."
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
              </div>

              {formError && (
                <p className="text-sm text-red-600">{formError}</p>
              )}
            </div>

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
                {saving ? "GUARDANDO..." : editExpense ? "GUARDAR CAMBIOS" : "REGISTRAR GASTO"}
              </button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="¿Eliminar gasto?"
        description={`El gasto "${deleteTarget?.description}" será eliminado. Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
