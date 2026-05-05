import { NextResponse } from "next/server";

import { requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  try {
    const count = await prisma.meeting.count({
      where: { tenantId: session.user.tenantId },
    });
    return NextResponse.json({ count });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not count meetings" },
      { status: 500 },
    );
  }
}
