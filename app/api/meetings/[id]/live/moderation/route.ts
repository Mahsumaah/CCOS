import { LiveSessionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { TrackSource } from "livekit-server-sdk";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit-log";
import { currentLiveRoleForUser, ensureMeetingLiveAccess } from "@/lib/live-meeting";
import { hasLiveCapability } from "@/lib/live-permissions";
import { getLiveKitRoomService } from "@/lib/livekit";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  targetUserId: z.string().cuid(),
  action: z.enum(["mute_microphone", "mute_camera", "remove"]),
});

export async function POST(request: Request, context: RouteContext) {
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

  const liveRole = currentLiveRoleForUser(session.user.role);
  const mayModerate =
    session.user.permManageMeetings || hasLiveCapability(liveRole, "canModerateMedia");
  if (!mayModerate) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = (await request.json().catch(() => ({}))) as unknown;
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const { targetUserId, action } = parsed.data;
  if (targetUserId === session.user.id) {
    return NextResponse.json({ error: "cannot_moderate_self" }, { status: 400 });
  }

  const targetUser = await prisma.boardUser.findFirst({
    where: { id: targetUserId, tenantId: session.user.tenantId },
    select: { id: true },
  });
  if (!targetUser) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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

  const roomService = getLiveKitRoomService();

  try {
    if (action === "remove") {
      await roomService.removeParticipant(liveSession.roomName, targetUserId);
      await prisma.liveParticipantSession.updateMany({
        where: {
          liveSessionId: liveSession.id,
          userId: targetUserId,
          leftAt: null,
        },
        data: { leftAt: new Date(), removedAt: new Date() },
      });
      await writeAuditLog({
        tenantId: session.user.tenantId,
        meetingId,
        liveSessionId: liveSession.id,
        actorId: session.user.id,
        action: "PARTICIPANT_REMOVED",
        targetType: "BoardUser",
        targetId: targetUserId,
      });
      return NextResponse.json({ ok: true });
    }

    const participant = await roomService.getParticipant(liveSession.roomName, targetUserId);
    const tracks = participant.tracks ?? [];
    const wantSource =
      action === "mute_microphone" ? TrackSource.MICROPHONE : TrackSource.CAMERA;
    const track = tracks.find((tr) => tr.source === wantSource);
    if (!track?.sid) {
      return NextResponse.json({ error: "track_not_found" }, { status: 404 });
    }

    await roomService.mutePublishedTrack(
      liveSession.roomName,
      targetUserId,
      track.sid,
      true,
    );

    await prisma.liveParticipantSession.updateMany({
      where: {
        liveSessionId: liveSession.id,
        userId: targetUserId,
        leftAt: null,
      },
      data: { mutedByChairAt: new Date() },
    });

    await writeAuditLog({
      tenantId: session.user.tenantId,
      meetingId,
      liveSessionId: liveSession.id,
      actorId: session.user.id,
      action: "PARTICIPANT_MUTED",
      targetType: "Track",
      targetId: track.sid,
      payloadJson: { action, targetUserId },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[live/moderation]", e);
    return NextResponse.json({ error: "moderation_failed" }, { status: 502 });
  }
}
