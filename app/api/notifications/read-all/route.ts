import { NextResponse } from "next/server";

import { requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const now = new Date();
  await prisma.boardNotification.updateMany({
    where: { userId: session.user.id, readAt: null },
    data: { readAt: now },
  });

  return NextResponse.json({ ok: true });
}
