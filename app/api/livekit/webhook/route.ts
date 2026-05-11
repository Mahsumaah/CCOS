import { ArtifactType, LiveRecordingStatus } from "@prisma/client";
import { TrackSource as LkTrackSource, WebhookReceiver } from "livekit-server-sdk";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit-log";
import { boardRoleToLiveRole } from "@/lib/live-permissions";
import { prisma } from "@/lib/prisma";

function getWebhookReceiver() {
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!key || !secret) {
    throw new Error("LIVEKIT_API_KEY/LIVEKIT_API_SECRET missing");
  }
  return new WebhookReceiver(key, secret);
}

type EgressEndedPayload = {
  egressId?: string;
  roomName?: string;
  status?: number | string;
  error?: string;
  fileResults?: Array<{ filename?: string; location?: string }>;
  streamResults?: Array<{ url?: string }>;
};

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const body = await request.text();

    const receiver = getWebhookReceiver();
    const event = await receiver.receive(body, authHeader);

    const roomName = event.room?.name;
    if (!roomName && event.event !== "egress_ended") {
      return NextResponse.json({ ok: true });
    }

    const liveSession =
      roomName != null
        ? await prisma.liveSession.findFirst({
            where: { roomName },
            orderBy: { createdAt: "desc" },
            include: { meeting: { select: { id: true, tenantId: true } } },
          })
        : null;

    if (event.event === "egress_ended") {
      const info = (event as unknown as { egressInfo?: EgressEndedPayload }).egressInfo;
      const egressId = info?.egressId;
      if (!egressId) return NextResponse.json({ ok: true });

      const sessionByEgress = await prisma.liveSession.findFirst({
        where: { egressId },
        include: { meeting: { select: { id: true, tenantId: true } } },
      });
      if (!sessionByEgress) return NextResponse.json({ ok: true });

      const tenantId = sessionByEgress.meeting.tenantId;
      const meetingId = sessionByEgress.meeting.id;
      const fileUrl =
        info.fileResults?.find((f) => f.location)?.location ??
        info.streamResults?.find((s) => s.url)?.url ??
        null;
      const errMsg = info.error?.trim() || null;
      const success = Boolean(fileUrl) && !errMsg;

      await prisma.liveSession.update({
        where: { id: sessionByEgress.id },
        data: {
          egressId: null,
          recordingStatus: success
            ? LiveRecordingStatus.COMPLETED
            : LiveRecordingStatus.FAILED,
          recordingUrl: success ? fileUrl : sessionByEgress.recordingUrl,
          recordingError: success ? null : errMsg ?? "egress_failed",
        },
      });

      if (success && fileUrl) {
        const artifact = await prisma.meetingArtifact.create({
          data: {
            tenantId,
            meetingId,
            liveSessionId: sessionByEgress.id,
            type: ArtifactType.RECORDING,
            url: fileUrl,
            name: `ccos-live-recording-${sessionByEgress.id}.mp4`,
            mime: "video/mp4",
            source: "ccos_live",
          },
        });
        await writeAuditLog({
          tenantId,
          meetingId,
          liveSessionId: sessionByEgress.id,
          actorId: null,
          action: "ARTIFACT_CREATED",
          targetType: "MeetingArtifact",
          targetId: artifact.id,
          payloadJson: { kind: "RECORDING" },
        });
      }

      return NextResponse.json({ ok: true });
    }

    if (!liveSession) return NextResponse.json({ ok: true });

    const tenantId = liveSession.meeting.tenantId;
    const meetingId = liveSession.meeting.id;

    if (event.event === "participant_joined" && event.participant?.identity) {
      const userId = event.participant.identity;
      const user = await prisma.boardUser.findFirst({
        where: { id: userId, tenantId },
        select: { id: true, role: true },
      });
      if (user) {
        const latest = await prisma.liveParticipantSession.findFirst({
          where: { liveSessionId: liveSession.id, userId },
          orderBy: { joinedAt: "desc" },
        });

        if (latest && latest.leftAt == null) {
          await prisma.liveParticipantSession.update({
            where: { id: latest.id },
            data: { participantSid: event.participant.sid ?? latest.participantSid },
          });
        } else if (latest?.leftAt) {
          await prisma.liveParticipantSession.update({
            where: { id: latest.id },
            data: {
              leftAt: null,
              participantSid: event.participant.sid,
              reconnectCount: { increment: 1 },
            },
          });
          await writeAuditLog({
            tenantId,
            meetingId,
            liveSessionId: liveSession.id,
            actorId: userId,
            action: "PARTICIPANT_REJOINED",
            targetType: "LiveParticipantSession",
            targetId: event.participant.sid,
            payloadJson: { participantName: event.participant.name ?? null },
          });
        } else {
          await prisma.liveParticipantSession.create({
            data: {
              tenantId,
              meetingId,
              liveSessionId: liveSession.id,
              userId,
              participantSid: event.participant.sid,
              role: boardRoleToLiveRole(user.role),
            },
          });
          await writeAuditLog({
            tenantId,
            meetingId,
            liveSessionId: liveSession.id,
            actorId: userId,
            action: "PARTICIPANT_JOINED",
            targetType: "LiveParticipantSession",
            targetId: event.participant.sid,
            payloadJson: { participantName: event.participant.name ?? null },
          });
        }
      }
    }

    if (event.event === "participant_left" && event.participant?.identity) {
      const userId = event.participant.identity;
      await prisma.liveParticipantSession.updateMany({
        where: {
          tenantId,
          meetingId,
          liveSessionId: liveSession.id,
          userId,
          leftAt: null,
        },
        data: { leftAt: new Date() },
      });
      await writeAuditLog({
        tenantId,
        meetingId,
        liveSessionId: liveSession.id,
        actorId: userId,
        action: "PARTICIPANT_LEFT",
        targetType: "LiveParticipantSession",
        targetId: event.participant.sid,
      });
    }

    if (
      event.event === "track_published" &&
      event.track?.source === LkTrackSource.SCREEN_SHARE &&
      event.participant?.identity
    ) {
      await writeAuditLog({
        tenantId,
        meetingId,
        liveSessionId: liveSession.id,
        actorId: event.participant.identity,
        action: "SCREEN_SHARE_STARTED",
        targetType: "Track",
        targetId: event.track.sid,
      });
    }

    if (
      event.event === "track_unpublished" &&
      event.track?.source === LkTrackSource.SCREEN_SHARE &&
      event.participant?.identity
    ) {
      await writeAuditLog({
        tenantId,
        meetingId,
        liveSessionId: liveSession.id,
        actorId: event.participant.identity,
        action: "SCREEN_SHARE_STOPPED",
        targetType: "Track",
        targetId: event.track.sid,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }
}
