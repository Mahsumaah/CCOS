import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { setBoardPasswordBodySchema } from "@/lib/validations/set-board-password-api";

export async function POST(request: Request) {
  const json = (await request.json()) as unknown;
  const parsed = setBoardPasswordBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { token, password } = parsed.data;

  const user = await prisma.boardUser.findUnique({
    where: { passwordSetupToken: token },
    select: {
      id: true,
      passwordSetupExpires: true,
    },
  });

  if (!user?.passwordSetupExpires) {
    return NextResponse.json({ error: "Invalid or expired" }, { status: 400 });
  }

  if (user.passwordSetupExpires.getTime() <= Date.now()) {
    return NextResponse.json({ error: "Invalid or expired" }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 12);

  await prisma.boardUser.update({
    where: { id: user.id },
    data: {
      password: hash,
      passwordSetupToken: null,
      passwordSetupExpires: null,
    },
  });

  return NextResponse.json({ ok: true });
}
