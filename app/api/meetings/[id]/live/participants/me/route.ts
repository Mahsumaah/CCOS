import { LiveSessionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit-log";
import { ensureMeetingLiveAccess } from "@/lib/live-meeting";
import { boardRoleToLiveRole } from "@/lib/live-permissions";
import { hasLiveCapability } from "@/lib/live-permissions";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  raisedHand: z.boolean(),
});

export async function PATCH(request: Request, context: RouteContext) {
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

  if (access.meeting.status !== "LIVE") {
    return NextResponse.json({ error: "meeting_not_live" }, { status: 400 });
  }

  const liveRole = boardRoleToLiveRole(session.user.role);
  if (!hasLiveCapability(liveRole, "canRaiseHand")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = (await request.json().catch(() => ({}))) as unknown;
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const liveSession = await prisma.liveSession.findFirst({
    where: {
      meetingId,
      tenantId: session.user.tenantId,
      status: LiveSessionStatus.LIVE,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!liveSession) {
    return NextResponse.json({ error: "no_active_live_session" }, { status: 400 });
  }

  const row = await prisma.liveParticipantSession.findFirst({
    where: {
      liveSessionId: liveSession.id,
      userId: session.user.id,
      leftAt: null,
    },
    orderBy: { joinedAt: "desc" },
  });

  if (!row) {
    return NextResponse.json({ error: "not_in_roster" }, { status: 400 });
  }

  const raisedHandAt = parsed.data.raisedHand ? new Date() : null;
  const updated = await prisma.liveParticipantSession.update({
    where: { id: row.id },
    data: { raisedHandAt },
  });

  await writeAuditLog({
    tenantId: session.user.tenantId,
    meetingId,
    liveSessionId: liveSession.id,
    actorId: session.user.id,
    action: "PARTICIPANT_RAISED_HAND",
    targetType: "LiveParticipantSession",
    targetId: row.id,
    payloadJson: { raised: parsed.data.raisedHand },
  });

  return NextResponse.json(updated);
}
