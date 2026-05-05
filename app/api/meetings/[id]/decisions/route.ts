import { NextResponse } from "next/server";

import { requirePermission, requireSession, userMayAccessMeeting } from "@/lib/rbac";
import { createBulkNotifications, getMeetingInviteeUserIds } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { createDecisionBodySchema } from "@/lib/validations/decision-apis";

type RouteContext = { params: Promise<{ id: string }> };

const decisionInclude = {
  createdBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true } },
  agendaItem: { select: { id: true, titleAr: true, titleEn: true } },
} as const;

function serializeDecision(
  d: {
    id: string;
    textAr: string;
    textEn: string | null;
    status: import("@prisma/client").DecisionStatus;
    agendaItemId: string | null;
    ownerId: string | null;
    dueDate: Date | null;
    createdById: string;
    approvedById: string | null;
    approvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    createdBy: { id: string; name: string };
    approvedBy: { id: string; name: string } | null;
    owner: { id: string; name: string } | null;
    agendaItem: {
      id: string;
      titleAr: string;
      titleEn: string | null;
    } | null;
  },
) {
  return {
    id: d.id,
    textAr: d.textAr,
    textEn: d.textEn,
    status: d.status,
    agendaItemId: d.agendaItemId,
    agendaItem: d.agendaItem,
    ownerId: d.ownerId,
    owner: d.owner,
    dueDate: d.dueDate?.toISOString() ?? null,
    createdBy: d.createdBy,
    createdById: d.createdById,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    approvedById: d.approvedById,
    approvedBy: d.approvedBy,
    approvedAt: d.approvedAt?.toISOString() ?? null,
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const { id: meetingId } = await context.params;
  const tenantId = session.user.tenantId;

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, tenantId },
    select: { id: true },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = await userMayAccessMeeting(
    session.user.id,
    meetingId,
    tenantId,
    session.user,
  );
  if (!allowed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const decisions = await prisma.decision.findMany({
    where: { meetingId },
    orderBy: { createdAt: "desc" },
    include: decisionInclude,
  });

  return NextResponse.json({
    decisions: decisions.map(serializeDecision),
  });
}

export async function POST(request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const denied = requirePermission(session, "permCreateDecisions");
  if (denied) return denied;

  const { id: meetingId } = await context.params;
  const tenantId = session.user.tenantId;

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, tenantId },
    select: { id: true },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const json = (await request.json()) as unknown;
  const parsed = createDecisionBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { textAr, textEn, agendaItemId, ownerId, dueDate } = parsed.data;

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

  if (ownerId) {
    const inv = await prisma.meetingInvitation.findFirst({
      where: { meetingId, userId: ownerId },
      select: { id: true },
    });
    if (!inv) {
      return NextResponse.json(
        { error: "Owner must be an invited user for this meeting" },
        { status: 400 },
      );
    }
  }

  const created = await prisma.decision.create({
    data: {
      meetingId,
      textAr,
      textEn: textEn?.trim() ? textEn.trim() : null,
      agendaItemId: agendaItemId ?? undefined,
      ownerId: ownerId ?? undefined,
      dueDate: dueDate ?? undefined,
      createdById: session.user.id,
    },
    include: decisionInclude,
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
      type: "DECISION_CREATED",
      payload: {
        meetingTitle: meetingMeta.title,
        preview: textAr.slice(0, 160),
      },
    });
  }

  return NextResponse.json(serializeDecision(created), { status: 201 });
}
