import { notFound } from "next/navigation";

import { MeetingDetailClient } from "@/components/meetings/MeetingDetailClient";
import { auth } from "@/lib/auth";
import {
  meetingDetailInclude,
  type MeetingDetailDTO,
} from "@/lib/meeting-detail-include";
import {
  calculateQuorum,
  countQuorumAttendance,
} from "@/lib/meeting-quorum";
import { parseMeetingDetailTabParam } from "@/lib/meeting-detail-tab";
import { prisma } from "@/lib/prisma";

export default async function MeetingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams?: Promise<{ tab?: string | string[] }>;
}) {
  const { locale, id } = await params;
  const sp = searchParams ? await searchParams : {};
  const initialActiveTab = parseMeetingDetailTabParam(sp.tab);
  const session = await auth();

  if (!session?.user) {
    notFound();
  }

  const [meeting, tenantRow] = await Promise.all([
    prisma.meeting.findFirst({
      where: { id, tenantId: session.user.tenantId },
      include: meetingDetailInclude,
    }),
    prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { plan: true },
    }),
  ]);

  if (!meeting) {
    notFound();
  }

  const [
    openVotesCount,
    openDecisionsCount,
    voteAgendaRows,
    decisionAgendaRows,
    agendaIdRows,
  ] = await Promise.all([
    prisma.vote.count({
      where: { meetingId: meeting.id, isOpen: true },
    }),
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
  const initialAgendaStats = agendaIdRows.map((row) => ({
    agendaItemId: row.id,
    votes: voteByAgenda.get(row.id) ?? 0,
    decisions: decByAgenda.get(row.id) ?? 0,
  }));

  const serialized = JSON.parse(
    JSON.stringify(meeting),
  ) as MeetingDetailDTO;

  const policy = await prisma.meetingTypeQuorumPolicy.findUnique({
    where: { meetingType: meeting.type },
  });

  const activeDelegationsForQuorum =
    meeting.status === "LIVE"
      ? await prisma.meetingDelegation.findMany({
          where: { meetingId: meeting.id, revokedAt: null },
          select: { fromUserId: true, toUserId: true, revokedAt: true },
        })
      : [];

  const initialQuorum =
    meeting.status === "LIVE"
      ? calculateQuorum({
          meetingType: meeting.type,
          policy,
          totalInvited: meeting.invitations.length,
          attendedCount: countQuorumAttendance(
            meeting.invitations.map((i) => ({
              userId: i.userId,
              status: i.status,
              attendanceCheckedInAt: i.attendanceCheckedInAt,
            })),
            activeDelegationsForQuorum,
          ),
        })
      : null;

  return (
    <MeetingDetailClient
      key={`${meeting.id}-${String(meeting.updatedAt)}`}
      meeting={serialized}
      locale={locale === "en" ? "en" : "ar"}
      currentUserId={session.user.id}
      currentUserName={session.user.name ?? session.user.email ?? ""}
      initialQuorum={initialQuorum}
      initialOpenVotesCount={openVotesCount}
      initialOpenDecisionsCount={openDecisionsCount}
      initialAgendaStats={initialAgendaStats}
      initialActiveTab={initialActiveTab}
      tenantPlan={tenantRow?.plan ?? "TRIAL"}
    />
  );
}
