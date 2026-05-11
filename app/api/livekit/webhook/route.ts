import { TrackSource, WebhookReceiver } from "livekit-server-sdk";
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

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const body = await request.text();

    const receiver = getWebhookReceiver();
    const event = await receiver.receive(body, authHeader);

    const roomName = event.room?.name;
    if (!roomName) return NextResponse.json({ ok: true });

    const liveSession = await prisma.liveSession.findFirst({
      where: { roomName },
      orderBy: { createdAt: "desc" },
      include: { meeting: { select: { id: true, tenantId: true } } },
    });

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
      event.track?.source === TrackSource.SCREEN_SHARE &&
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

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }
}
