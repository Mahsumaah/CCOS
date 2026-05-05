import { NextResponse } from "next/server";

import { requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const count = await prisma.boardNotification.count({
    where: { userId: session.user.id, readAt: null },
  });

  return NextResponse.json({ count });
}
