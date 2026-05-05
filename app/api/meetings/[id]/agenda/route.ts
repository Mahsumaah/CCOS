import { MeetingStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireEditOrManageMeetings, requireSession } from "@/lib/rbac";
import { meetingDetailInclude } from "@/lib/meeting-detail-include";
import { prisma } from "@/lib/prisma";
import { agendaItemBodySchema } from "@/lib/validations/meeting-apis";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const denied = requireEditOrManageMeetings(session);
  if (denied) return denied;

  const { id: meetingId } = await context.params;
  const tenantId = session.user.tenantId;

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, tenantId },
    select: { id: true, status: true },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (meeting.status !== MeetingStatus.SCHEDULED && meeting.status !== MeetingStatus.LIVE) {
    return NextResponse.json(
      { error: "Agenda cannot be edited for this meeting status" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = agendaItemBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const d = parsed.data;

  const agg = await prisma.meetingAgendaItem.aggregate({
    where: { meetingId },
    _max: { order: true },
  });
  const nextOrder = (agg._max.order ?? -1) + 1;

  try {
    await prisma.meetingAgendaItem.create({
      data: {
        meetingId,
        order: nextOrder,
        titleAr: d.titleAr.trim(),
        titleEn: d.titleEn?.trim() || null,
        notes: d.notes?.trim() || null,
      },
    });

    const full = await prisma.meeting.findFirst({
      where: { id: meetingId, tenantId },
      include: meetingDetailInclude,
    });

    return NextResponse.json(full, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not add agenda item" },
      { status: 500 },
    );
  }
}
