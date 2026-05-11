import { NextResponse } from "next/server";

import { ensureMeetingLiveAccess } from "@/lib/live-meeting";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const { id: meetingId } = await context.params;
  const access = await ensureMeetingLiveAccess({
    meetingId,
    tenantId: session.user.tenantId,
    userId: session.user.id,
    sessionUser: {
      role: session.user.role,
      permManageMeetings: session.user.permManageMeetings,
    },
  });
  if (!access.ok) return access.response;

  const logs = await prisma.auditLog.findMany({
    where: { meetingId, tenantId: session.user.tenantId },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      actor: { select: { id: true, name: true, role: true } },
    },
  });

  return NextResponse.json({ logs });
}
