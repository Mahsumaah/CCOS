import { NextResponse } from "next/server";

import { buildLiveKitToken, getLiveKitWsUrl } from "@/lib/livekit";
import { buildLiveRoomName, currentLiveRoleForUser, ensureMeetingLiveAccess } from "@/lib/live-meeting";
import { hasLiveCapability } from "@/lib/live-permissions";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
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

  const invitation = await prisma.meetingInvitation.findFirst({
    where: { meetingId, userId: session.user.id },
    select: { id: true },
  });

  if (!invitation && !session.user.permManageMeetings) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const liveRole = currentLiveRoleForUser(session.user.role);
  if (!hasLiveCapability(liveRole, "canJoinLive")) {
    return NextResponse.json({ error: "Not allowed to join live room" }, { status: 403 });
  }

  const roomName = buildLiveRoomName(session.user.tenantId, meetingId);
  let token: string;
  let wsUrl: string;
  try {
    token = await buildLiveKitToken({
      roomName,
      identity: session.user.id,
      name: session.user.name ?? session.user.email ?? session.user.id,
      canPublish: hasLiveCapability(liveRole, "canSpeak"),
      canSubscribe: true,
      canPublishData: true,
    });
    wsUrl = getLiveKitWsUrl();
  } catch {
    return NextResponse.json(
      { error: "live_not_configured" },
      { status: 503 },
    );
  }

  return NextResponse.json({
    token,
    wsUrl,
    roomName,
    liveRole,
    capabilities: {
      canSpeak: hasLiveCapability(liveRole, "canSpeak"),
      canShareScreen: hasLiveCapability(liveRole, "canShareScreen"),
      canRaiseHand: hasLiveCapability(liveRole, "canRaiseHand"),
      canModerateMedia: hasLiveCapability(liveRole, "canModerateMedia"),
      canOpenVote: hasLiveCapability(liveRole, "canOpenVote"),
      canRecordDecision: hasLiveCapability(liveRole, "canRecordDecision"),
    },
  });
}
