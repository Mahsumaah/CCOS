import { LiveDecisionStatus, type Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit-log";
import { canApproveOrRejectLiveDecision } from "@/lib/live-decision-permissions";
import { currentLiveRoleForUser, ensureMeetingLiveAccess } from "@/lib/live-meeting";
import { hasLiveCapability } from "@/lib/live-permissions";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string; decisionId: string }> };

const patchSchema = z
  .object({
    action: z.enum(["approve", "reject"]).optional(),
    decisionText: z.string().min(5).max(5000).optional(),
    agendaItemId: z.string().cuid().nullable().optional(),
    proposedById: z.string().cuid().nullable().optional(),
    ownerId: z.string().cuid().nullable().optional(),
    dueDate: z.string().datetime().nullable().optional(),
    notes: z.string().max(3000).nullable().optional(),
    requiresVote: z.boolean().optional(),
  })
  .refine((b) => b.action != null || Object.keys(b).some((k) => k !== "action"), {
    message: "empty_patch",
  });

export async function PATCH(request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const { id: meetingId, decisionId } = await context.params;
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

  const json = (await request.json().catch(() => ({}))) as unknown;
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.liveDecisionEvent.findFirst({
    where: { id: decisionId, meetingId, tenantId: session.user.tenantId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const liveRole = currentLiveRoleForUser(session.user.role);
  const payload = parsed.data;

  if (payload.action === "approve" || payload.action === "reject") {
    if (!canApproveOrRejectLiveDecision(liveRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const approved = payload.action === "approve";
    const updated = await prisma.liveDecisionEvent.update({
      where: { id: decisionId },
      data: {
        approved,
        approvedAt: approved ? new Date() : null,
        status: approved ? LiveDecisionStatus.APPROVED : LiveDecisionStatus.REJECTED,
        updatedBy: { connect: { id: session.user.id } },
      },
    });
    await writeAuditLog({
      tenantId: session.user.tenantId,
      meetingId,
      actorId: session.user.id,
      liveDecisionEventId: decisionId,
      action: approved ? "LIVE_DECISION_APPROVED" : "LIVE_DECISION_UPDATED",
      targetType: "LiveDecisionEvent",
      targetId: decisionId,
      payloadJson: { decision: approved ? "approve" : "reject" },
    });
    return NextResponse.json(updated);
  }

  if (!hasLiveCapability(liveRole, "canRecordDecision")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data: Prisma.LiveDecisionEventUpdateInput = {
    updatedBy: { connect: { id: session.user.id } },
  };
  if (payload.decisionText != null) data.decisionText = payload.decisionText;
  if (payload.agendaItemId !== undefined) {
    data.agendaItem = payload.agendaItemId
      ? { connect: { id: payload.agendaItemId } }
      : { disconnect: true };
  }
  if (payload.proposedById !== undefined) {
    data.proposedBy = payload.proposedById
      ? { connect: { id: payload.proposedById } }
      : { disconnect: true };
  }
  if (payload.ownerId !== undefined) {
    data.owner = payload.ownerId ? { connect: { id: payload.ownerId } } : { disconnect: true };
  }
  if (payload.dueDate !== undefined) {
    data.dueDate = payload.dueDate ? new Date(payload.dueDate) : null;
  }
  if (payload.notes !== undefined) data.notes = payload.notes;
  if (payload.requiresVote != null) data.requiresVote = payload.requiresVote;
  if (
    existing.status === LiveDecisionStatus.APPROVED ||
    existing.status === LiveDecisionStatus.REJECTED
  ) {
    data.status = LiveDecisionStatus.IN_REVIEW;
    data.approved = false;
    data.approvedAt = null;
  }

  const updated = await prisma.liveDecisionEvent.update({
    where: { id: decisionId },
    data,
  });

  await writeAuditLog({
    tenantId: session.user.tenantId,
    meetingId,
    actorId: session.user.id,
    liveDecisionEventId: decisionId,
    action: "LIVE_DECISION_UPDATED",
    targetType: "LiveDecisionEvent",
    targetId: decisionId,
  });

  return NextResponse.json(updated);
}
