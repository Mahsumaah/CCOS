import type { Prisma } from "@prisma/client";

export const meetingDetailInclude = {
  agenda: {
    orderBy: { order: "asc" as const },
    include: {
      attachments: {
        include: {
          uploadedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
  },
  invitations: {
    include: { user: true },
  },
  attachments: {
    where: { agendaItemId: null },
    include: {
      uploadedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  },
  createdBy: true,
  minutes: { select: { id: true } },
  _count: {
    select: { votes: true, decisions: true },
  },
} satisfies Prisma.MeetingInclude;

export type MeetingDetailDTO = Prisma.MeetingGetPayload<{
  include: typeof meetingDetailInclude;
}>;
