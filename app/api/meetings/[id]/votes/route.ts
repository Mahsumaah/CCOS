import { NextResponse } from "next/server";

import { requirePermission, requireSession } from "@/lib/rbac";
import { createBulkNotifications, getMeetingInviteeUserIds } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { createVoteBodySchema } from "@/lib/validations/vote-apis";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const denied = requirePermission(session, "permCreateVotes");
  if (denied) return denied;

  const { id: meetingId } = await context.params;
  const tenantId = session.user.tenantId;
  const json = (await request.json()) as unknown;
  const parsed = createVoteBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { question, agendaItemId } = parsed.data;

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, tenantId },
    select: { id: true, status: true },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (meeting.status !== "LIVE") {
    return NextResponse.json(
      { error: "Meeting must be live to create votes" },
      { status: 400 },
    );
  }

  if (agendaItemId) {
    const item = await prisma.meetingAgendaItem.findFirst({
      where: { id: agendaItemId, meetingId },
      select: { id: true },
    });
    if (!item) {
      return NextResponse.json(
        { error: "Agenda item not found on this meeting" },
        { status: 400 },
      );
    }
  }

  const vote = await prisma.vote.create({
    data: {
      meetingId,
      question,
      agendaItemId: agendaItemId ?? undefined,
      createdById: session.user.id,
      isOpen: true,
      openedAt: new Date(),
    },
    select: {
      id: true,
      question: true,
      isOpen: true,
      openedAt: true,
      agendaItemId: true,
      createdBy: { select: { id: true, name: true } },
    },
  });

  const [meetingMeta, inviteeIds] = await Promise.all([
    prisma.meeting.findFirst({
      where: { id: meetingId, tenantId },
      select: { title: true },
    }),
    getMeetingInviteeUserIds(meetingId),
  ]);
  if (meetingMeta && inviteeIds.length) {
    await createBulkNotifications({
      userIds: inviteeIds,
      meetingId,
      type: "VOTE_OPENED",
      payload: { meetingTitle: meetingMeta.title, question },
    });
  }

  return NextResponse.json(vote, { status: 201 });
}
