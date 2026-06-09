"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Mode = "registro" | "login";

export default function ProdeAuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const isRegistro = mode === "registro";

  const [instagram, setInstagram] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const endpoint = isRegistro ? "/api/prode/register" : "/api/prode/login";
    const payload = isRegistro ? { instagram, email, password } : { email, password };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      router.push("/prode/jugar");
      router.refresh();
      return;
    }

    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setError(data.error ?? "Algo salió mal. Intentá de nuevo.");
    setLoading(false);
  }

  const inputCls =
    "w-full bg-green-mid border border-green-mid text-brand-cream px-4 py-3 text-sm focus:outline-none focus:border-brand-cream transition-colors placeholder:text-cream-dark/40";

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="mb-8 text-center">
        <p className="label-tag text-cream-dark text-[10px] tracking-widest">PRODE · FASE DE GRUPOS</p>
        <h1 className="font-bebas text-4xl text-brand-cream tracking-widest mt-1">
          {isRegistro ? "CREAR CUENTA" : "INGRESAR"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isRegistro && (
          <div>
            <label className="label-tag text-cream-dark block mb-2">INSTAGRAM</label>
            <input
              type="text"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              required
              autoComplete="username"
              className={inputCls}
              placeholder="@tu.usuario"
            />
          </div>
        )}

        <div>
          <label className="label-tag text-cream-dark block mb-2">EMAIL</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className={inputCls}
            placeholder="tu@email.com"
          />
        </div>

        <div>
          <label className="label-tag text-cream-dark block mb-2">CONTRASEÑA</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={isRegistro ? "new-password" : "current-password"}
            className={inputCls}
            placeholder="••••••••"
          />
        </div>

        {error && <p className="label-tag text-red-400 text-center text-xs">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 bg-brand-cream text-brand-green py-4 font-bold tracking-widest text-sm hover:bg-white transition-colors disabled:opacity-50"
        >
          {loading ? "PROCESANDO..." : isRegistro ? "REGISTRARME" : "INGRESAR"}
        </button>
      </form>

      <p className="text-center label-tag text-cream-dark text-[11px] mt-6">
        {isRegistro ? (
          <>
            ¿Ya tenés cuenta?{" "}
            <Link href="/prode/login" className="text-brand-cream underline hover:text-white">
              Ingresá
            </Link>
          </>
        ) : (
          <>
            ¿No tenés cuenta?{" "}
            <Link href="/prode/registro" className="text-brand-cream underline hover:text-white">
              Registrate
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
