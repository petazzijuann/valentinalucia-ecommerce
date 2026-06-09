import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionPlayer } from "@/lib/prode/auth";
import ProdeAuthForm from "@/components/prode/ProdeAuthForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prode — Ingresar",
};

export default async function ProdeLoginPage() {
  const player = await getSessionPlayer();
  if (player) redirect("/prode/jugar");

  return (
    <div className="min-h-[70vh] bg-green-dark flex items-center justify-center px-4 py-16">
      <ProdeAuthForm mode="login" />
    </div>
  );
}
