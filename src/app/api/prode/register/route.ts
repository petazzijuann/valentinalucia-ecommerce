import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { hashPassword, createSession } from "@/lib/prode/auth";

const schema = z.object({
  instagram: z.string().min(1, "Ingresá tu usuario de Instagram"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

function isP2002(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const instagram = parsed.data.instagram.trim().replace(/^@+/, "").toLowerCase();
  const email = parsed.data.email.trim().toLowerCase();

  if (!instagram) {
    return NextResponse.json({ error: "Instagram inválido" }, { status: 400 });
  }

  try {
    const player = await prisma.prodePlayer.create({
      data: {
        instagram,
        email,
        password_hash: hashPassword(parsed.data.password),
      },
    });

    // Copiar el email a la lista de suscriptores (ignorar si ya existe).
    try {
      await prisma.subscriber.create({ data: { email } });
    } catch (err: unknown) {
      if (!isP2002(err)) throw err;
    }

    await createSession(player.id);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err: unknown) {
    if (isP2002(err)) {
      return NextResponse.json(
        { error: "Ese Instagram o email ya está registrado" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
