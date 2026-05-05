import { MeetingStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireEditOrManageMeetings, requireSession } from "@/lib/rbac";
import { meetingDetailInclude } from "@/lib/meeting-detail-include";
import { prisma } from "@/lib/prisma";
import { agendaItemBodySchema } from "@/lib/validations/meeting-apis";

type RouteContext = { params: Promise<{ itemId: string }> };

async function loadItemContext(itemId: string, tenantId: string) {
  return prisma.meetingAgendaItem.findFirst({
    where: { id: itemId, meeting: { tenantId } },
    select: {
      id: true,
      meetingId: true,
      meeting: { select: { status: true } },
    },
  });
}

function canEditAgenda(status: MeetingStatus) {
  return status === MeetingStatus.SCHEDULED || status === MeetingStatus.LIVE;
}

export async function PATCH(request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const denied = requireEditOrManageMeetings(session);
  if (denied) return denied;

  const { itemId } = await context.params;
  const tenantId = session.user.tenantId;

  const ctx = await loadItemContext(itemId, tenantId);
  if (!ctx) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canEditAgenda(ctx.meeting.status)) {
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

  try {
    await prisma.meetingAgendaItem.update({
      where: { id: itemId },
      data: {
        titleAr: d.titleAr.trim(),
        titleEn: d.titleEn?.trim() || null,
        notes: d.notes?.trim() || null,
      },
    });

    const full = await prisma.meeting.findFirst({
      where: { id: ctx.meetingId, tenantId },
      include: meetingDetailInclude,
    });

    return NextResponse.json(full);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not update agenda item" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const denied = requireEditOrManageMeetings(session);
  if (denied) return denied;

  const { itemId } = await context.params;
  const tenantId = session.user.tenantId;

  const ctx = await loadItemContext(itemId, tenantId);
  if (!ctx) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canEditAgenda(ctx.meeting.status)) {
    return NextResponse.json(
      { error: "Agenda cannot be edited for this meeting status" },
      { status: 400 },
    );
  }

  try {
    await prisma.$transaction([
      prisma.meetingAttachment.deleteMany({ where: { agendaItemId: itemId } }),
      prisma.meetingAgendaItem.delete({ where: { id: itemId } }),
    ]);

    const full = await prisma.meeting.findFirst({
      where: { id: ctx.meetingId, tenantId },
      include: meetingDetailInclude,
    });

    return NextResponse.json(full);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not delete agenda item" },
      { status: 500 },
    );
  }
}
