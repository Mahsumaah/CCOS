import { DelegationScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { requirePermission, requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { castBallotBodySchema } from "@/lib/validations/vote-apis";

type RouteContext = { params: Promise<{ voteId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const denied = requirePermission(session, "permCastVotes");
  if (denied) return denied;

  const { voteId } = await context.params;
  const tenantId = session.user.tenantId;

  const vote = await prisma.vote.findFirst({
    where: { id: voteId, meeting: { tenantId } },
    select: {
      id: true,
      meetingId: true,
      isOpen: true,
    },
  });

  if (!vote) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!vote.isOpen) {
    return NextResponse.json({ error: "Vote is closed" }, { status: 400 });
  }

  const json = (await request.json()) as unknown;
  const parsed = castBallotBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { choice, forUserId: delegatorForBallot } = parsed.data;
  const sessionUserId = session.user.id;

  let ballotUserId = sessionUserId;
  let castById: string | null = null;

  if (delegatorForBallot && delegatorForBallot !== sessionUserId) {
    ballotUserId = delegatorForBallot;
    castById = sessionUserId;

    const delegation = await prisma.meetingDelegation.findFirst({
      where: {
        meetingId: vote.meetingId,
        fromUserId: delegatorForBallot,
        toUserId: sessionUserId,
        revokedAt: null,
        scope: DelegationScope.ATTENDANCE_AND_VOTING,
      },
      select: { id: true },
    });

    if (!delegation) {
      return NextResponse.json(
        { error: "No valid voting delegation for this member" },
        { status: 403 },
      );
    }
  }

  const invited = await prisma.meetingInvitation.findFirst({
    where: { meetingId: vote.meetingId, userId: ballotUserId },
    select: { id: true },
  });

  if (!invited) {
    return NextResponse.json(
      { error: "User is not invited to this meeting" },
      { status: 403 },
    );
  }

  const ballot = await prisma.voteBallot.upsert({
    where: {
      voteId_userId: { voteId, userId: ballotUserId },
    },
    create: {
      voteId,
      userId: ballotUserId,
      castById,
      choice,
    },
    update: {
      choice,
      castById,
    },
    select: {
      id: true,
      voteId: true,
      userId: true,
      castById: true,
      choice: true,
      createdAt: true,
    },
  });

  return NextResponse.json(ballot);
}
