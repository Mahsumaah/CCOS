import { DelegationScope, type VoteChoice } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireSession, userMayAccessMeeting } from "@/lib/rbac";
import {
  calculateQuorum,
  countQuorumAttendance,
} from "@/lib/meeting-quorum";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

function tallyChoices(ballots: { choice: VoteChoice }[]) {
  let approve = 0;
  let reject = 0;
  let abstain = 0;
  for (const b of ballots) {
    if (b.choice === "APPROVE") approve += 1;
    else if (b.choice === "REJECT") reject += 1;
    else abstain += 1;
  }
  const total = approve + reject + abstain;
  return { approve, reject, abstain, total };
}

export async function GET(_request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const { id: meetingId } = await context.params;
  const tenantId = session.user.tenantId;
  const currentUserId = session.user.id;

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, tenantId },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      invitations: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      },
      votes: {
        orderBy: { openedAt: "desc" },
        include: {
          createdBy: { select: { id: true, name: true } },
          agendaItem: { select: { id: true, titleAr: true, titleEn: true } },
          ballots: {
            include: {
              user: { select: { id: true, name: true } },
              castBy: { select: { id: true, name: true } },
            },
          },
        },
      },
      _count: {
        select: { votes: true, decisions: true },
      },
    },
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

  const policy = await prisma.meetingTypeQuorumPolicy.findUnique({
    where: { meetingType: meeting.type },
  });

  const [activeDelegations, proxyRows] = await Promise.all([
    prisma.meetingDelegation.findMany({
      where: { meetingId: meeting.id, revokedAt: null },
      select: { fromUserId: true, toUserId: true, revokedAt: true },
    }),
    prisma.meetingDelegation.findMany({
      where: {
        meetingId: meeting.id,
        revokedAt: null,
        toUserId: currentUserId,
        scope: DelegationScope.ATTENDANCE_AND_VOTING,
      },
      select: {
        fromUser: { select: { id: true, name: true } },
      },
    }),
  ]);

  const totalInvited = meeting.invitations.length;
  const quorumCurrent = countQuorumAttendance(
    meeting.invitations.map((i) => ({
      userId: i.userId,
      status: i.status,
      attendanceCheckedInAt: i.attendanceCheckedInAt,
    })),
    activeDelegations,
  );
  const attendedCount = meeting.invitations.filter(
    (i) => i.attendanceCheckedInAt != null,
  ).length;

  const quorum = calculateQuorum({
    meetingType: meeting.type,
    policy,
    totalInvited,
    attendedCount: quorumCurrent,
  });

  const openVotesCount = meeting.votes.filter((v) => v.isOpen).length;

  const [openDecisionsCount, voteAgendaRows, decisionAgendaRows, agendaIds] =
    await Promise.all([
      prisma.decision.count({
        where: {
          meetingId: meeting.id,
          status: { in: ["OPEN", "IN_PROGRESS"] },
        },
      }),
      prisma.vote.groupBy({
        by: ["agendaItemId"],
        where: { meetingId: meeting.id, agendaItemId: { not: null } },
        _count: { _all: true },
      }),
      prisma.decision.groupBy({
        by: ["agendaItemId"],
        where: { meetingId: meeting.id, agendaItemId: { not: null } },
        _count: { _all: true },
      }),
      prisma.meetingAgendaItem.findMany({
        where: { meetingId: meeting.id },
        select: { id: true },
        orderBy: { order: "asc" },
      }),
    ]);

  const voteByAgenda = new Map(
    voteAgendaRows
      .filter((r) => r.agendaItemId != null)
      .map((r) => [r.agendaItemId as string, r._count._all]),
  );
  const decByAgenda = new Map(
    decisionAgendaRows
      .filter((r) => r.agendaItemId != null)
      .map((r) => [r.agendaItemId as string, r._count._all]),
  );
  const agendaStats = agendaIds.map((row) => ({
    agendaItemId: row.id,
    votes: voteByAgenda.get(row.id) ?? 0,
    decisions: decByAgenda.get(row.id) ?? 0,
  }));

  const votes = meeting.votes.map((v) => {
    const tallies = tallyChoices(v.ballots);
    const myBallot = v.ballots.find((b) => b.userId === currentUserId);
    return {
      id: v.id,
      question: v.question,
      isOpen: v.isOpen,
      agendaItemId: v.agendaItemId,
      agendaItem: v.agendaItem
        ? {
            id: v.agendaItem.id,
            titleAr: v.agendaItem.titleAr,
            titleEn: v.agendaItem.titleEn,
          }
        : null,
      openedAt: v.openedAt.toISOString(),
      closedAt: v.closedAt?.toISOString() ?? null,
      createdBy: v.createdBy,
      tallies,
      myBallot: myBallot?.choice ?? null,
      ballots: v.ballots.map((b) => ({
        userId: b.userId,
        userName: b.user.name,
        choice: b.choice,
        castById: b.castById,
        castByName: b.castBy?.name ?? null,
      })),
    };
  });

  return NextResponse.json({
    meetingId: meeting.id,
    meetingTitle: meeting.title,
    meetingType: meeting.type,
    status: meeting.status,
    invitations: meeting.invitations,
    votes,
    votesCount: meeting._count.votes,
    decisionsCount: meeting._count.decisions,
    openVotesCount,
    openDecisionsCount,
    agendaStats,
    attendedCount,
    quorumAttendedCount: quorumCurrent,
    totalInvited,
    quorum,
    proxyVoteFor: proxyRows.map((r) => ({
      userId: r.fromUser.id,
      name: r.fromUser.name,
    })),
  });
}
