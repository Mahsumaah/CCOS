import { DecisionStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { requirePermission, requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { patchDecisionBodySchema } from "@/lib/validations/decision-apis";

type RouteContext = { params: Promise<{ decId: string }> };

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
    status: DecisionStatus;
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

export async function PATCH(request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const denied = requirePermission(session, "permEditDecisions");
  if (denied) return denied;

  const { decId } = await context.params;
  const tenantId = session.user.tenantId;

  const existing = await prisma.decision.findFirst({
    where: { id: decId, meeting: { tenantId } },
    include: decisionInclude,
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const json = (await request.json()) as unknown;
  const parsed = patchDecisionBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const patch = parsed.data;
  const nextStatus = patch.status ?? existing.status;
  const becomesDone =
    nextStatus === DecisionStatus.DONE && existing.status !== DecisionStatus.DONE;
  const leavesDone =
    existing.status === DecisionStatus.DONE && nextStatus !== DecisionStatus.DONE;

  const canRecordApproval =
    session.user.permFinalizeMinutes || session.user.permManageMeetings;

  if (patch.ownerId !== undefined && patch.ownerId !== null) {
    const inv = await prisma.meetingInvitation.findFirst({
      where: { meetingId: existing.meetingId, userId: patch.ownerId },
      select: { id: true },
    });
    if (!inv) {
      return NextResponse.json(
        { error: "Owner must be an invited user for this meeting" },
        { status: 400 },
      );
    }
  }

  if (patch.agendaItemId !== undefined && patch.agendaItemId !== null) {
    const item = await prisma.meetingAgendaItem.findFirst({
      where: { id: patch.agendaItemId, meetingId: existing.meetingId },
      select: { id: true },
    });
    if (!item) {
      return NextResponse.json(
        { error: "Agenda item not found on this meeting" },
        { status: 400 },
      );
    }
  }

  const data: Parameters<typeof prisma.decision.update>[0]["data"] = {};

  if (patch.textAr !== undefined) data.textAr = patch.textAr;
  if (patch.textEn !== undefined) {
    data.textEn = patch.textEn?.trim() ? patch.textEn.trim() : null;
  }
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.ownerId !== undefined) {
    data.ownerId = patch.ownerId;
  }
  if (patch.agendaItemId !== undefined) {
    data.agendaItemId = patch.agendaItemId;
  }
  if (patch.dueDate !== undefined) {
    data.dueDate = patch.dueDate ?? null;
  }

  if (leavesDone) {
    data.approvedById = null;
    data.approvedAt = null;
  }

  if (becomesDone && canRecordApproval) {
    data.approvedById = session.user.id;
    data.approvedAt = new Date();
  }

  const updated = await prisma.decision.update({
    where: { id: decId },
    data,
    include: decisionInclude,
  });

  return NextResponse.json(serializeDecision(updated));
}

export async function DELETE(_request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const denied = requirePermission(session, "permEditDecisions");
  if (denied) return denied;

  const { decId } = await context.params;
  const tenantId = session.user.tenantId;

  const existing = await prisma.decision.findFirst({
    where: { id: decId, meeting: { tenantId } },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.decision.delete({ where: { id: decId } });

  return NextResponse.json({ ok: true });
}
