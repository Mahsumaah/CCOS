import { LiveDecisionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit-log";
import { currentLiveRoleForUser, ensureMeetingLiveAccess } from "@/lib/live-meeting";
import { hasLiveCapability } from "@/lib/live-permissions";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string }> };

const createSchema = z.object({
  decisionText: z.string().min(5).max(5000),
  agendaItemId: z.string().cuid().nullable().optional(),
  proposedById: z.string().cuid().nullable().optional(),
  ownerId: z.string().cuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  notes: z.string().max(3000).nullable().optional(),
  requiresVote: z.boolean().optional(),
});

export async function GET(_request: Request, context: RouteContext) {
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

  const decisions = await prisma.liveDecisionEvent.findMany({
    where: { meetingId },
    orderBy: { eventAt: "asc" },
    include: {
      recordedBy: { select: { id: true, name: true } },
      proposedBy: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
      updatedBy: { select: { id: true, name: true } },
      agendaItem: { select: { id: true, titleAr: true, titleEn: true } },
    },
  });

  return NextResponse.json({ decisions });
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

  const role = currentLiveRoleForUser(session.user.role);
  if (!hasLiveCapability(role, "canRecordDecision")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = (await request.json().catch(() => ({}))) as unknown;
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;

  const created = await prisma.liveDecisionEvent.create({
    data: {
      tenantId: session.user.tenantId,
      meetingId,
      decisionText: payload.decisionText,
      agendaItemId: payload.agendaItemId ?? null,
      proposedById: payload.proposedById ?? null,
      recordedById: session.user.id,
      ownerId: payload.ownerId ?? null,
      dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
      notes: payload.notes ?? null,
      requiresVote: payload.requiresVote ?? false,
      status: LiveDecisionStatus.DRAFT,
      approved: false,
      eventAt: new Date(),
    },
  });

  await writeAuditLog({
    tenantId: session.user.tenantId,
    meetingId,
    actorId: session.user.id,
    liveDecisionEventId: created.id,
    action: "LIVE_DECISION_CREATED",
    targetType: "LiveDecisionEvent",
    targetId: created.id,
  });

  return NextResponse.json(created, { status: 201 });
}
