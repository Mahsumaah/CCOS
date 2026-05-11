import { LiveVoteRule, LiveVoteVisibility } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit-log";
import { currentLiveRoleForUser, ensureMeetingLiveAccess } from "@/lib/live-meeting";
import { hasLiveCapability } from "@/lib/live-permissions";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  title: z.string().min(3).max(200),
  question: z.string().min(3).max(2000),
  agendaItemId: z.string().cuid().nullable().optional(),
  visibility: z.nativeEnum(LiveVoteVisibility).optional(),
  rule: z.nativeEnum(LiveVoteRule).optional(),
  quorumRequired: z.boolean().optional(),
  allowedRoles: z.array(z.string()).optional(),
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

  const votes = await prisma.liveVote.findMany({
    where: { meetingId },
    orderBy: { openedAt: "desc" },
    include: {
      openedBy: { select: { id: true, name: true } },
      closedBy: { select: { id: true, name: true } },
      ballots: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  return NextResponse.json({ votes });
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
  if (!hasLiveCapability(role, "canOpenVote")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = (await request.json().catch(() => ({}))) as unknown;
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;

  const vote = await prisma.liveVote.create({
    data: {
      tenantId: session.user.tenantId,
      meetingId,
      title: payload.title,
      question: payload.question,
      agendaItemId: payload.agendaItemId ?? null,
      visibility: payload.visibility ?? LiveVoteVisibility.PUBLIC,
      rule: payload.rule ?? LiveVoteRule.MAJORITY,
      quorumRequired: payload.quorumRequired ?? false,
      allowedRoles:
        payload.allowedRoles && payload.allowedRoles.length > 0
          ? payload.allowedRoles
          : undefined,
      openedById: session.user.id,
      isOpen: true,
      openedAt: new Date(),
    },
  });

  await writeAuditLog({
    tenantId: session.user.tenantId,
    meetingId,
    liveVoteId: vote.id,
    actorId: session.user.id,
    action: "LIVE_VOTE_OPENED",
    targetType: "LiveVote",
    targetId: vote.id,
    payloadJson: {
      title: vote.title,
      visibility: vote.visibility,
      rule: vote.rule,
      quorumRequired: vote.quorumRequired,
    },
  });

  return NextResponse.json(vote, { status: 201 });
}
