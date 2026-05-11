import { LiveVoteChoice, LiveVoteRule, type Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit-log";
import { currentLiveRoleForUser, ensureMeetingLiveAccess } from "@/lib/live-meeting";
import { LIVE_VOTING_ALLOWED_ROLES, hasLiveCapability } from "@/lib/live-permissions";
import { getLivePresentUserIds } from "@/lib/live-session-utils";
import { buildLiveVoteResult } from "@/lib/live-vote-result";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string; voteId: string }> };

const castBody = z.object({ choice: z.nativeEnum(LiveVoteChoice) });
const patchBody = z.object({ action: z.enum(["close"]) });

export async function POST(request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const { id: meetingId, voteId } = await context.params;
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
  if (!LIVE_VOTING_ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invitation = await prisma.meetingInvitation.findFirst({
    where: { meetingId, userId: session.user.id },
    select: { id: true },
  });
  if (!invitation && !session.user.permManageMeetings) {
    return NextResponse.json({ error: "not_invited" }, { status: 403 });
  }

  const json = (await request.json().catch(() => ({}))) as unknown;
  const parsed = castBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const vote = await prisma.liveVote.findFirst({
    where: { id: voteId, meetingId, tenantId: session.user.tenantId },
    select: { id: true, isOpen: true, allowedRoles: true, liveSessionId: true },
  });
  if (!vote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!vote.isOpen) return NextResponse.json({ error: "Vote closed" }, { status: 400 });

  if (vote.liveSessionId) {
    const inSession = await prisma.liveParticipantSession.findFirst({
      where: {
        liveSessionId: vote.liveSessionId,
        userId: session.user.id,
        leftAt: null,
        tenantId: session.user.tenantId,
      },
      select: { id: true },
    });
    if (!inSession) {
      return NextResponse.json({ error: "join_live_to_vote" }, { status: 403 });
    }
  }

  const allowedRoles = Array.isArray(vote.allowedRoles) ? vote.allowedRoles : [];
  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Not eligible for this vote" }, { status: 403 });
  }

  const ballot = await prisma.liveVoteBallot.upsert({
    where: { liveVoteId_userId: { liveVoteId: voteId, userId: session.user.id } },
    create: {
      tenantId: session.user.tenantId,
      meetingId,
      liveVoteId: voteId,
      userId: session.user.id,
      choice: parsed.data.choice,
    },
    update: {
      choice: parsed.data.choice,
      castAt: new Date(),
    },
  });

  await writeAuditLog({
    tenantId: session.user.tenantId,
    meetingId,
    liveVoteId: voteId,
    actorId: session.user.id,
    action: "LIVE_VOTE_CAST",
    targetType: "LiveVoteBallot",
    targetId: ballot.id,
    payloadJson: { choice: ballot.choice },
  });

  return NextResponse.json(ballot);
}

export async function PATCH(request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const { id: meetingId, voteId } = await context.params;
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
  const parsed = patchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.liveVote.findFirst({
    where: { id: voteId, meetingId, tenantId: session.user.tenantId },
    include: {
      ballots: { include: { user: { select: { role: true } } } },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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

  const policy = await prisma.meetingTypeQuorumPolicy.findUnique({
    where: { meetingType: meeting.type },
  });

  let livePresentUserIds: string[] = [];
  if (existing.liveSessionId) {
    livePresentUserIds = await getLivePresentUserIds(
      existing.liveSessionId,
      session.user.tenantId,
    );
  }

  const needsQuorum =
    existing.rule === LiveVoteRule.QUORUM_GATED || existing.quorumRequired;

  const result = buildLiveVoteResult({
    rule: existing.rule,
    ballots: existing.ballots.map((b) => ({
      choice: b.choice,
      user: { role: b.user.role },
    })),
    quorumContext: needsQuorum
      ? {
          meetingType: meeting.type,
          policy,
          invitations: meeting.invitations,
          delegations: meeting.delegations,
          livePresentUserIds,
        }
      : undefined,
  });

  if (needsQuorum && !result.quorum?.met) {
    return NextResponse.json(
      { error: "quorum_not_met_close", quorum: result.quorum },
      { status: 400 },
    );
  }

  const updated = await prisma.liveVote.update({
    where: { id: voteId },
    data: {
      isOpen: false,
      closedAt: new Date(),
      closedById: session.user.id,
      resultJson: result as Prisma.InputJsonValue,
    },
  });

  await writeAuditLog({
    tenantId: session.user.tenantId,
    meetingId,
    liveVoteId: voteId,
    actorId: session.user.id,
    action: "LIVE_VOTE_CLOSED",
    targetType: "LiveVote",
    targetId: voteId,
    payloadJson: result as object,
  });

  return NextResponse.json(updated);
}
