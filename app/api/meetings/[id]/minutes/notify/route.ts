import { NextResponse } from "next/server";

import { requirePermission, requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const denied = requirePermission(session, "permFinalizeMinutes");
  if (denied) return denied;

  const { id: meetingId } = await context.params;
  const tenantId = session.user.tenantId;

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, tenantId },
    select: { id: true, title: true },
  });
  if (!meeting) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const minutes = await prisma.minutes.findUnique({
    where: { meetingId },
    select: { id: true, finalizedAt: true, attendeesNotifiedAt: true },
  });
  if (!minutes) {
    return NextResponse.json({ error: "Minutes not generated" }, { status: 404 });
  }
  if (!minutes.finalizedAt) {
    return NextResponse.json(
      { error: "Minutes must be finalized before notifying attendees." },
      { status: 400 },
    );
  }
  if (minutes.attendeesNotifiedAt) {
    return NextResponse.json(
      { error: "Attendees have already been notified." },
      { status: 400 },
    );
  }

  const invitees = await prisma.meetingInvitation.findMany({
    where: { meetingId, status: "ACCEPTED" },
    include: { user: { select: { email: true, name: true } } },
  });

  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      for (const inv of invitees) {
        await tx.boardNotification.create({
          data: {
            userId: inv.userId,
            meetingId,
            type: "MINUTES_READY",
            payload: {
              meetingId,
              meetingTitle: meeting.title,
            },
          },
        });
      }
      await tx.minutes.update({
        where: { meetingId },
        data: { attendeesNotifiedAt: now },
      });
    });

    for (const inv of invitees) {
      const to = inv.user.email?.trim();
      if (!to) continue;
      console.log("Email skipped:", {
        to,
        subject: `Minutes ready: ${meeting.title}`,
      });
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not notify attendees" },
      { status: 500 },
    );
  }

  return NextResponse.json({ notified: invitees.length });
}
