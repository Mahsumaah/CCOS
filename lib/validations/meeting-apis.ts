import { InvitationStatus, MeetingStatus } from "@prisma/client";
import { z } from "zod";

import { editMeetingMetadataSchema } from "@/lib/validations/edit-meeting";

/** Status-only PATCH (strict: no other keys). */
export const patchMeetingStatusBodySchema = z
  .object({
    status: z.nativeEnum(MeetingStatus),
  })
  .strict();

/** Either status transition or metadata update — not both in one request. */
export const patchMeetingBodySchema = z.union([
  patchMeetingStatusBodySchema,
  editMeetingMetadataSchema,
]);

export const agendaItemBodySchema = z.object({
  titleAr: z.string().min(1, { message: "validationAgendaTitleArRequired" }),
  titleEn: z.string().optional(),
  notes: z.string().optional(),
});

/** POST /api/meetings/[id]/attachments — file already uploaded to ImageKit. */
export const postMeetingAttachmentBodySchema = z.object({
  url: z
    .string()
    .url()
    .max(2048)
    .refine((s) => /^https:\/\//i.test(s), { message: "invalidAttachmentUrl" }),
  name: z.string().min(1).max(500),
  mime: z.string().max(200).nullable().optional(),
  size: z.number().int().nonnegative().nullable().optional(),
});

export type PostMeetingAttachmentBody = z.infer<
  typeof postMeetingAttachmentBodySchema
>;

export const patchInvitationBodySchema = z.object({
  status: z.nativeEnum(InvitationStatus),
});

const RSVP_UPDATE = new Set<InvitationStatus>([
  InvitationStatus.ACCEPTED,
  InvitationStatus.DECLINED,
  InvitationStatus.TENTATIVE,
]);

export const rsvpInvitationBodySchema = patchInvitationBodySchema.refine(
  (d) => RSVP_UPDATE.has(d.status),
  { message: "Invalid RSVP status" },
);

export function isAllowedStatusTransition(
  from: MeetingStatus,
  to: MeetingStatus,
): boolean {
  const map: Record<MeetingStatus, MeetingStatus[]> = {
    SCHEDULED: [MeetingStatus.LIVE, MeetingStatus.CANCELLED],
    LIVE: [MeetingStatus.ENDED],
    ENDED: [MeetingStatus.ARCHIVED],
    ARCHIVED: [],
    CANCELLED: [],
  };
  return map[from]?.includes(to) ?? false;
}

/** English message for API 400 responses. */
export function invalidStatusTransitionMessage(
  from: MeetingStatus,
  to: MeetingStatus,
): string {
  if (from === to) {
    return `Meeting is already ${from}.`;
  }
  switch (from) {
    case "SCHEDULED":
      return `From SCHEDULED, only LIVE or CANCELLED is allowed (requested: ${to}).`;
    case "LIVE":
      return `From LIVE, only ENDED is allowed (requested: ${to}).`;
    case "ENDED":
      return `From ENDED, only ARCHIVED is allowed (requested: ${to}).`;
    case "ARCHIVED":
      return "Archived meetings cannot change status.";
    case "CANCELLED":
      return "Cancelled meetings cannot change status.";
    default:
      return `Invalid status transition from ${from} to ${to}.`;
  }
}
