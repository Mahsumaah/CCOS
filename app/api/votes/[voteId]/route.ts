import { NextResponse } from "next/server";

import {
  requirePermission,
  requireSession,
} from "@/lib/rbac";
import { calculateQuorum, countQuorumAttendance } from "@/lib/meeting-quorum";
import { createBulkNotifications, getMeetingInviteeUserIds } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { patchVoteBodySchema } from "@/lib/validations/vote-apis";

type RouteContext = { params: Promise<{ voteId: string }> };

async function loadVoteForUser(voteId: string, tenantId: string) {
  return prisma.vote.findFirst({
    where: { id: voteId, meeting: { tenantId } },
    select: {
      id: true,
      meetingId: true,
      createdById: true,
      isOpen: true,
      meeting: {
        select: {
          type: true,
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
      },
    },
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const denied = requirePermission(session, "permManageMeetings");
  if (denied) return denied;

  const { voteId } = await context.params;
  const vote = await loadVoteForUser(voteId, session.user.tenantId);
  if (!vote) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const json = (await request.json()) as unknown;
  const parsed = patchVoteBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { isOpen, forceClose } = parsed.data;
  const now = new Date();

  const isClosing = isOpen === false && vote.isOpen;
  if (isClosing) {
    const policy = await prisma.meetingTypeQuorumPolicy.findUnique({
      where: { meetingType: vote.meeting.type },
    });
    const totalInvited = vote.meeting.invitations.length;
    const attendedCount = countQuorumAttendance(
      vote.meeting.invitations,
      vote.meeting.delegations,
    );
    const quorum = calculateQuorum({
      meetingType: vote.meeting.type,
      policy,
      totalInvited,
      attendedCount,
    });

    const canForce = Boolean(forceClose) && session.user.permManageMeetings;
    if (quorum.required && !quorum.met && !canForce) {
      return NextResponse.json({ error: "QUORUM_NOT_MET" }, { status: 400 });
    }
  }

  const updated = await prisma.vote.update({
    where: { id: voteId },
    data: {
      isOpen,
      closedAt: isOpen ? null : now,
    },
    select: {
      id: true,
      isOpen: true,
      closedAt: true,
    },
  });

  if (isClosing) {
    const voteMeta = await prisma.vote.findUnique({
      where: { id: voteId },
      select: {
        meetingId: true,
        question: true,
        meeting: { select: { title: true } },
      },
    });
    if (voteMeta) {
      const inviteeIds = await getMeetingInviteeUserIds(voteMeta.meetingId);
      if (inviteeIds.length) {
        await createBulkNotifications({
          userIds: inviteeIds,
          meetingId: voteMeta.meetingId,
          type: "VOTE_CLOSED",
          payload: {
            meetingTitle: voteMeta.meeting.title,
            question: voteMeta.question,
          },
        });
      }
    }
  }

  return NextResponse.json(updated);
}


export async function DELETE(_request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const denied = requirePermission(session, "permManageMeetings");
  if (denied) return denied;

  const { voteId } = await context.params;
  const vote = await loadVoteForUser(voteId, session.user.tenantId);
  if (!vote) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.vote.delete({ where: { id: voteId } });

  return NextResponse.json({ ok: true });
}
