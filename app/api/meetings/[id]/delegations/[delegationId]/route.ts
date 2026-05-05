import { NextResponse } from "next/server";

import { requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string; delegationId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const { id: meetingId, delegationId } = await context.params;
  const tenantId = session.user.tenantId;

  const delegation = await prisma.meetingDelegation.findFirst({
    where: {
      id: delegationId,
      meetingId,
      meeting: { tenantId },
    },
    select: {
      id: true,
      fromUserId: true,
      revokedAt: true,
    },
  });

  if (!delegation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (delegation.revokedAt != null) {
    return NextResponse.json({ error: "Already revoked" }, { status: 400 });
  }

  const canRevoke =
    session.user.permManageMeetings ||
    delegation.fromUserId === session.user.id;
  if (!canRevoke) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.meetingDelegation.update({
    where: { id: delegationId },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
