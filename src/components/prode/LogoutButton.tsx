"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function LogoutButton({ className = "" }: { className?: string }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/prode/logout", { method: "POST" });
    router.push("/prode");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className={`inline-flex items-center gap-2 label-tag text-[11px] text-cream-dark hover:text-brand-cream transition-colors ${className}`}
    >
      <LogOut size={14} />
      CERRAR SESIÓN
    </button>
  );
}
