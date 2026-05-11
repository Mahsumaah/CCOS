import { LiveVoteChoice } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit-log";
import { currentLiveRoleForUser, ensureMeetingLiveAccess } from "@/lib/live-meeting";
import { hasLiveCapability } from "@/lib/live-permissions";
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

  const role = currentLiveRoleForUser(session.user.role);
  if (!hasLiveCapability(role, "canSpeak")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = (await request.json().catch(() => ({}))) as unknown;
  const parsed = castBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const vote = await prisma.liveVote.findFirst({
    where: { id: voteId, meetingId, tenantId: session.user.tenantId },
    select: { id: true, isOpen: true, allowedRoles: true },
  });
  if (!vote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!vote.isOpen) return NextResponse.json({ error: "Vote closed" }, { status: 400 });

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

  const ballots = await prisma.liveVoteBallot.findMany({
    where: { liveVoteId: voteId },
    select: { choice: true },
  });

  const totals = {
    yes: ballots.filter((b) => b.choice === "YES").length,
    no: ballots.filter((b) => b.choice === "NO").length,
    abstain: ballots.filter((b) => b.choice === "ABSTAIN").length,
    total: ballots.length,
  };

  const existing = await prisma.liveVote.findFirst({
    where: { id: voteId, meetingId, tenantId: session.user.tenantId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.liveVote.update({
    where: { id: voteId },
    data: {
      isOpen: false,
      closedAt: new Date(),
      closedById: session.user.id,
      resultJson: totals,
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
    payloadJson: totals,
  });

  return NextResponse.json(updated);
}
