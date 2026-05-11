import { LiveSessionStatus, LiveVoteRule, LiveVoteVisibility } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit-log";
import { canViewSecretLiveVoteBallots } from "@/lib/live-secret-vote";
import { currentLiveRoleForUser, ensureMeetingLiveAccess } from "@/lib/live-meeting";
import { evaluateLiveQuorumSnapshot } from "@/lib/live-vote-result";
import { hasLiveCapability } from "@/lib/live-permissions";
import { getLivePresentUserIds } from "@/lib/live-session-utils";
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
    where: { meetingId, tenantId: session.user.tenantId },
    orderBy: { openedAt: "desc" },
    include: {
      openedBy: { select: { id: true, name: true } },
      closedBy: { select: { id: true, name: true } },
      ballots: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  const viewerRole = currentLiveRoleForUser(session.user.role);
  const canSeeSecretBallots = canViewSecretLiveVoteBallots(viewerRole);

  const votesOut = votes.map((v) => {
    if (v.visibility !== "SECRET" || canSeeSecretBallots) {
      return v;
    }
    return {
      ...v,
      ballots: [],
    };
  });

  return NextResponse.json({ votes: votesOut });
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

  if (access.meeting.status !== "LIVE") {
    return NextResponse.json({ error: "meeting_not_live" }, { status: 400 });
  }

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

  const liveSession = await prisma.liveSession.findFirst({
    where: {
      meetingId,
      tenantId: session.user.tenantId,
      status: LiveSessionStatus.LIVE,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!liveSession) {
    return NextResponse.json({ error: "no_active_live_session" }, { status: 400 });
  }

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, tenantId: session.user.tenantId },
    include: {
      invitations: {
        select: {
          userId: true,
          status: true,
          attendanceCheckedInAt: true,
        },
      },
      delegations: {
        where: { revokedAt: null },
        select: { fromUserId: true, toUserId: true, revokedAt: true },
      },
    },
  });
  if (!meeting) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rule = payload.rule ?? LiveVoteRule.MAJORITY;
  const quorumRequired = payload.quorumRequired ?? false;
  const needsQuorumCheck = rule === "QUORUM_GATED" || quorumRequired;

  if (needsQuorumCheck) {
    const policy = await prisma.meetingTypeQuorumPolicy.findUnique({
      where: { meetingType: meeting.type },
    });
    const liveIds = await getLivePresentUserIds(liveSession.id, session.user.tenantId);
    const q = evaluateLiveQuorumSnapshot({
      meetingType: meeting.type,
      policy,
      invitations: meeting.invitations,
      delegations: meeting.delegations,
      livePresentUserIds: liveIds,
    });
    if (!q.met) {
      return NextResponse.json(
        { error: "quorum_not_met", quorum: q },
        { status: 400 },
      );
    }
  }

  const vote = await prisma.liveVote.create({
    data: {
      tenantId: session.user.tenantId,
      meetingId,
      liveSessionId: liveSession.id,
      title: payload.title,
      question: payload.question,
      agendaItemId: payload.agendaItemId ?? null,
      visibility: payload.visibility ?? LiveVoteVisibility.PUBLIC,
      rule,
      quorumRequired,
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
    liveSessionId: liveSession.id,
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
