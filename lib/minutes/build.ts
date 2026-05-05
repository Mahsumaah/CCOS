import type {
  DecisionStatus,
  InvitationStatus,
  MeetingType,
  VoteChoice,
} from "@prisma/client";

import { getRoleLabel } from "@/lib/board-roles";
import { getMeetingTypeLabel } from "@/lib/meeting-types";
import { prisma } from "@/lib/prisma";
import { computeVoteOutcome } from "@/lib/vote-outcome";

import type { MinutesData, MinutesVoteResult } from "./types";

function meetingTypeLabel(
  type: MeetingType,
  customMeetingType: string | null,
  locale: "ar" | "en",
): string {
  const base = getMeetingTypeLabel(type, locale);
  if (
    (type === "STRATEGIC" || type === "EMERGENCY") &&
    customMeetingType?.trim()
  ) {
    return `${base} — ${customMeetingType.trim()}`;
  }
  return base;
}

function tallyBallots(ballots: { choice: VoteChoice }[]) {
  let approve = 0;
  let reject = 0;
  let abstain = 0;
  for (const b of ballots) {
    if (b.choice === "APPROVE") approve += 1;
    else if (b.choice === "REJECT") reject += 1;
    else abstain += 1;
  }
  return {
    approve,
    reject,
    abstain,
    total: approve + reject + abstain,
  };
}

function voteResult(tallies: {
  approve: number;
  reject: number;
  abstain: number;
  total: number;
}): MinutesVoteResult {
  const o = computeVoteOutcome(tallies);
  if (o.kind === "WIN") {
    if (o.choice === "APPROVE") return "APPROVED";
    if (o.choice === "REJECT") return "REJECTED";
    return "TIE";
  }
  return "TIE";
}

export async function buildMinutesData(
  meetingId: string,
  tenantId: string,
  locale: "ar" | "en",
): Promise<MinutesData> {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, tenantId },
    include: {
      tenant: { select: { name: true, logo: true } },
      agenda: {
        orderBy: { order: "asc" },
        include: {
          decisions: {
            include: { createdBy: { select: { name: true } } },
            orderBy: { createdAt: "asc" },
          },
          votes: {
            include: {
              ballots: { select: { choice: true } },
              createdBy: { select: { name: true } },
            },
            orderBy: { openedAt: "asc" },
          },
        },
      },
      invitations: {
        include: {
          user: { select: { name: true, role: true } },
        },
      },
      decisions: {
        include: {
          owner: { select: { name: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      votes: {
        include: {
          ballots: { select: { choice: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { openedAt: "asc" },
      },
      minutes: {
        include: {
          signatures: {
            include: {
              user: { select: { name: true, role: true } },
            },
            orderBy: { signedAt: "asc" },
          },
        },
      },
    },
  });

  if (!meeting) {
    throw new Error("Meeting not found");
  }

  const attendees = meeting.invitations
    .filter(
      (inv) =>
        inv.status === "ACCEPTED" || inv.attendanceCheckedInAt != null,
    )
    .map((inv) => ({
      name: inv.user.name,
      role: inv.user.role,
      roleLabel: getRoleLabel(inv.user.role, locale),
      rsvpStatus: inv.status as InvitationStatus,
      checkedInAt: inv.attendanceCheckedInAt,
    }));

  const absentees = meeting.invitations
    .filter(
      (inv) =>
        inv.status === "DECLINED" ||
        (inv.status === "PENDING" && inv.attendanceCheckedInAt == null),
    )
    .map((inv) => ({
      name: inv.user.name,
      role: inv.user.role,
      roleLabel: getRoleLabel(inv.user.role, locale),
    }));

  const agenda = meeting.agenda.map((item) => ({
    order: item.order,
    titleAr: item.titleAr,
    titleEn: item.titleEn,
    notes: item.notes,
    decisions: item.decisions.map((d) => ({
      textAr: d.textAr,
      textEn: d.textEn,
      status: d.status as DecisionStatus,
      createdBy: d.createdBy.name,
    })),
    votes: item.votes.map((v) => {
      const tallies = tallyBallots(v.ballots);
      return {
        question: v.question,
        isOpen: v.isOpen,
        tallies,
        result: voteResult(tallies),
      };
    }),
  }));

  const allDecisions = meeting.decisions.map((d, i) => ({
    number: i + 1,
    textAr: d.textAr,
    textEn: d.textEn,
    status: d.status as DecisionStatus,
    owner: d.owner?.name ?? null,
    dueDate: d.dueDate,
  }));

  const allVotes = meeting.votes.map((v) => {
    const tallies = tallyBallots(v.ballots);
    return {
      question: v.question,
      result: voteResult(tallies),
      tallies,
    };
  });

  const signatures =
    meeting.minutes?.signatures.map((s) => ({
      userName: s.user.name,
      role: s.user.role,
      roleLabel: getRoleLabel(s.user.role, locale),
      signedAt: s.signedAt,
      typedName: s.typedName,
      signatureImageUrl: s.signatureImageUrl,
    })) ?? [];

  return {
    meeting: {
      title: meeting.title,
      type: meeting.type,
      typeLabel: meetingTypeLabel(
        meeting.type,
        meeting.customMeetingType,
        locale,
      ),
      scheduledAt: meeting.scheduledAt,
      startedAt: meeting.startedAt,
      endedAt: meeting.endedAt,
      durationMin: meeting.durationMin,
      location: meeting.location,
      objectives: meeting.objectives,
    },
    tenant: {
      name: meeting.tenant.name,
      logo: meeting.tenant.logo,
    },
    attendees,
    absentees,
    agenda,
    allDecisions,
    allVotes,
    signatures,
  };
}
