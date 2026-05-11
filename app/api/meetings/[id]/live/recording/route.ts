import { ArtifactType, LiveRecordingStatus, LiveSessionStatus } from "@prisma/client";
import { EncodedFileOutput, EncodedFileType, S3Upload } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit-log";
import { currentLiveRoleForUser, ensureMeetingLiveAccess } from "@/lib/live-meeting";
import { hasLiveCapability } from "@/lib/live-permissions";
import { getLiveKitEgressClient } from "@/lib/livekit";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  action: z.enum(["start", "stop"]),
});

function getRecordingS3Upload(): S3Upload | null {
  const bucket = process.env.CCOS_LIVE_RECORDING_S3_BUCKET?.trim();
  const accessKey = process.env.CCOS_LIVE_RECORDING_S3_ACCESS_KEY?.trim();
  const secret = process.env.CCOS_LIVE_RECORDING_S3_SECRET?.trim();
  const region = process.env.CCOS_LIVE_RECORDING_S3_REGION?.trim();
  const endpoint = process.env.CCOS_LIVE_RECORDING_S3_ENDPOINT?.trim();
  if (!bucket || !accessKey || !secret || !region) {
    return null;
  }
  return new S3Upload({
    accessKey,
    secret,
    bucket,
    region,
    ...(endpoint ? { endpoint } : {}),
  });
}

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
  const mayRecord =
    session.user.permManageMeetings || hasLiveCapability(liveRole, "canModerateMedia");
  if (!mayRecord) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (access.meeting.status !== "LIVE") {
    return NextResponse.json({ error: "meeting_not_live" }, { status: 400 });
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

  if (parsed.data.action === "stop") {
    if (!liveSession.egressId) {
      return NextResponse.json({ error: "recording_not_active" }, { status: 400 });
    }
    try {
      const egress = getLiveKitEgressClient();
      await egress.stopEgress(liveSession.egressId);
      await writeAuditLog({
        tenantId: session.user.tenantId,
        meetingId,
        liveSessionId: liveSession.id,
        actorId: session.user.id,
        action: "LIVE_RECORDING_STOP_REQUESTED",
        targetType: "LiveSession",
        targetId: liveSession.id,
        payloadJson: { egressId: liveSession.egressId },
      });
    } catch (e) {
      console.error("[live/recording] stop egress", e);
      return NextResponse.json({ error: "stop_recording_failed" }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  }

  const s3 = getRecordingS3Upload();
  if (!s3) {
    return NextResponse.json({ error: "recording_not_configured" }, { status: 503 });
  }

  if (
    liveSession.recordingStatus === LiveRecordingStatus.RECORDING &&
    liveSession.egressId
  ) {
    return NextResponse.json({ error: "recording_already_active" }, { status: 400 });
  }

  const filepath = `ccos-live/${session.user.tenantId}/${meetingId}/${liveSession.id}/${Date.now()}.mp4`;
  const file = new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath,
    // @ts-expect-error — @livekit/protocol EncodedFileOutput includes s3; typings omit union field
    s3,
  });

  try {
    const egress = getLiveKitEgressClient();
    const info = await egress.startRoomCompositeEgress(liveSession.roomName, file, {});
    const egressId = info.egressId;
    if (!egressId) {
      return NextResponse.json({ error: "egress_start_failed" }, { status: 502 });
    }

    await prisma.liveSession.update({
      where: { id: liveSession.id },
      data: {
        egressId,
        recordingStatus: LiveRecordingStatus.RECORDING,
        recordingStartedAt: new Date(),
        recordingError: null,
      },
    });

    await writeAuditLog({
      tenantId: session.user.tenantId,
      meetingId,
      liveSessionId: liveSession.id,
      actorId: session.user.id,
      action: "LIVE_RECORDING_STARTED",
      targetType: "LiveSession",
      targetId: liveSession.id,
      payloadJson: { egressId },
    });

    return NextResponse.json({ ok: true, egressId });
  } catch (e) {
    console.error("[live/recording] start egress", e);
    await prisma.liveSession.update({
      where: { id: liveSession.id },
      data: {
        recordingStatus: LiveRecordingStatus.FAILED,
        recordingError: "egress_start_failed",
      },
    });
    return NextResponse.json({ error: "start_recording_failed" }, { status: 502 });
  }
}
