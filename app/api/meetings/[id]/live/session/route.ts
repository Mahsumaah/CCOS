import { LiveRecordingStatus, LiveSessionStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit-log";
import { canApproveOrRejectLiveDecision } from "@/lib/live-decision-permissions";
import {
  buildLiveRoomName,
  canEndLive,
  canStartLive,
  currentLiveRoleForUser,
  ensureMeetingLiveAccess,
} from "@/lib/live-meeting";
import { hasLiveCapability } from "@/lib/live-permissions";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireSession } from "@/lib/rbac";

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

  const liveSession = await prisma.liveSession.findFirst({
    where: { meetingId },
    orderBy: { createdAt: "desc" },
    include: {
      participants: {
        where: { leftAt: null },
        include: { user: { select: { id: true, name: true, role: true } } },
      },
    },
  });

  const liveRole = currentLiveRoleForUser(session.user.role);

  return NextResponse.json({
    roomName:
      liveSession?.roomName ?? buildLiveRoomName(session.user.tenantId, meetingId),
    session: liveSession,
    canModerate: session.user.permManageMeetings,
    liveRole,
    governance: {
      canOpenLiveVote: hasLiveCapability(liveRole, "canOpenVote"),
      canRecordLiveDecision: hasLiveCapability(liveRole, "canRecordDecision"),
      canModerateMedia: hasLiveCapability(liveRole, "canModerateMedia"),
      canControlRecording:
        session.user.permManageMeetings || hasLiveCapability(liveRole, "canModerateMedia"),
      canApproveLiveDecision: canApproveOrRejectLiveDecision(liveRole),
    },
  });
}

export async function POST(_request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const denied = requirePermission(session, "permManageMeetings");
  if (denied) return denied;

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

  if (!canStartLive(access.meeting.status)) {
    return NextResponse.json(
      { error: "Meeting is not in a startable state" },
      { status: 400 },
    );
  }

  const roomName = buildLiveRoomName(session.user.tenantId, meetingId);

  const result = await prisma.$transaction(async (tx) => {
    if (access.meeting.status === "SCHEDULED") {
      await tx.meeting.update({
        where: { id: meetingId, tenantId: session.user.tenantId },
        data: { status: "LIVE", startedAt: new Date() },
      });
    }

    const active = await tx.liveSession.findFirst({
      where: { meetingId, status: LiveSessionStatus.LIVE },
      orderBy: { createdAt: "desc" },
    });

    if (active) return active;

    return tx.liveSession.create({
      data: {
        tenantId: session.user.tenantId,
        meetingId,
        roomName,
        status: LiveSessionStatus.LIVE,
        startedAt: new Date(),
        startedById: session.user.id,
        recordingStatus: LiveRecordingStatus.NOT_STARTED,
      },
    });
  });

  await writeAuditLog({
    tenantId: session.user.tenantId,
    meetingId,
    liveSessionId: result.id,
    actorId: session.user.id,
    action: "LIVE_SESSION_OPENED",
    targetType: "LiveSession",
    targetId: result.id,
    payloadJson: { roomName: result.roomName },
  });

  return NextResponse.json({ ok: true, session: result });
}

export async function PATCH(request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const denied = requirePermission(session, "permManageMeetings");
  if (denied) return denied;

  const { id: meetingId } = await context.params;
  const json = (await request.json().catch(() => ({}))) as { action?: string };
  if (json.action !== "end") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

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

  if (!canEndLive(access.meeting.status)) {
    return NextResponse.json(
      { error: "Meeting is not in an endable state" },
      { status: 400 },
    );
  }

  const ended = await prisma.$transaction(async (tx) => {
    await tx.meeting.update({
      where: { id: meetingId, tenantId: session.user.tenantId },
      data: { status: "ENDED", endedAt: new Date() },
    });

    const active = await tx.liveSession.findFirst({
      where: { meetingId, status: LiveSessionStatus.LIVE },
      orderBy: { createdAt: "desc" },
    });

    if (!active) return null;

    await tx.liveParticipantSession.updateMany({
      where: { liveSessionId: active.id, leftAt: null },
      data: { leftAt: new Date() },
    });

    return tx.liveSession.update({
      where: { id: active.id },
      data: {
        status: LiveSessionStatus.ENDED,
        endedAt: new Date(),
        endedById: session.user.id,
      },
    });
  });

  if (ended) {
    await writeAuditLog({
      tenantId: session.user.tenantId,
      meetingId,
      liveSessionId: ended.id,
      actorId: session.user.id,
      action: "LIVE_SESSION_CLOSED",
      targetType: "LiveSession",
      targetId: ended.id,
    });
  }

  return NextResponse.json({ ok: true, session: ended });
}
